#!/usr/bin/env python3
"""Katalog für die Online-Buchung aus den Planity-Daten bauen.

Zwei Schritte, beide aus der Projektwurzel:

    # 1. Rohdaten aus den gespeicherten Planity-Seiten lesen (optional,
    #    nur wenn sich bei Planity etwas geändert hat):
    python3 recherche/katalog.py --planity pasing.html grosshadern.html

    # 2. Katalog schreiben:
    python3 recherche/katalog.py

Schritt 1 schreibt `recherche/planity-buchung.json`: das Team je Salon,
jede buchbare Leistung mit Dauer, Preis, den Personen, die sie machen
(Planity-Feld `formula.xor.from`), und dem Ablauf mit Einwirkzeit
(`sequence`, PAUSE). Während einer Einwirkzeit ist die Person frei.

Schritt 2 schreibt `api/katalog.json`. Die Namen, Gruppen und Längen kommen
aus der Zuordnung in `preise.py` — Preisliste und Buchung benutzen also
dieselben Bezeichnungen. Bricht ab, wenn eine Leistung nicht aufgeht
(Summe der Phasen ≠ Dauer, Person unbekannt).
"""
import json
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WURZEL / 'recherche'))
import preise  # noqa: E402

ROH = WURZEL / 'recherche' / 'planity-buchung.json'
ZIEL = WURZEL / 'api' / 'katalog.json'

# Koordinaten aus OpenStreetMap, auf die Hausnummer genau (wie in alt/neu.js).
SALONS = {
    'pasing': {
        'name': 'Pasing', 'strasse': 'Irmonherstraße 7', 'ort': '81241 München',
        'telefon': '+49898211164', 'telefon_text': '089 821 116 4',
        'lat': 48.1485620, 'lon': 11.4591604,
    },
    'grosshadern': {
        'name': 'Großhadern', 'strasse': 'Würmtalstraße 119', 'ort': '81375 München',
        'telefon': '+498978597770', 'telefon_text': '089 785 977 70',
        'lat': 48.1152757, 'lon': 11.4776080,
    },
}
TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']


# ── Schritt 1: Planity-Seite lesen ────────────────────────────────────────

def objekt_ab(text, start):
    """JSON-Objekt ab der öffnenden Klammer lesen (Zeichenketten beachten)."""
    tiefe, in_text, flucht = 0, False, False
    for k in range(start, len(text)):
        c = text[k]
        if in_text:
            if flucht:
                flucht = False
            elif c == '\\':
                flucht = True
            elif c == '"':
                in_text = False
            continue
        if c == '"':
            in_text = True
        elif c == '{':
            tiefe += 1
        elif c == '}':
            tiefe -= 1
            if tiefe == 0:
                return json.loads(text[start:k + 1])
    raise ValueError('Objekt nicht geschlossen')


def planity_lesen(pfad):
    t = Path(pfad).read_text()
    kalender = objekt_ab(t, t.index('"calendars":{') + len('"calendars":'))
    team = {}
    for gruppe in kalender.values():
        for pid, p in gruppe['children'].items():
            if p.get('deletedAt'):
                continue
            team[pid] = {'name': p['name'].strip(), 'sort': p['sort'], 'online': not p.get('webHidden')}
    # Die größte „services“-Struktur ist der Katalog (Kategorien → Leistungen).
    katalog = None
    for m in re.finditer(r'"services":\{', t):
        try:
            o = objekt_ab(t, m.end() - 1)
        except (ValueError, json.JSONDecodeError):
            continue
        if katalog is None or len(json.dumps(o)) > len(json.dumps(katalog)):
            katalog = o
    alle = {}
    for kid, kat in katalog.items():
        for sid, s in (kat.get('children') or {}).items():
            alle[sid] = dict(s, kategorie=kat.get('name'), kategorie_geloescht=bool(kat.get('deletedAt')))
    leistungen = []
    for sid, s in alle.items():
        if s.get('deletedAt') or s.get('kategorie_geloescht') or not s.get('bookable') or s.get('webHidden'):
            continue
        phasen = []
        for schritt in s.get('sequence') or []:
            if schritt['serviceId'] == 'PAUSE':
                if schritt.get('defaultDuration'):
                    phasen.append(['pause', schritt['defaultDuration']])
                continue
            dauer = schritt.get('duration') or alle.get(schritt['serviceId'], {}).get('duration')
            if not dauer:
                raise SystemExit(f'{pfad}: Teilschritt ohne Dauer in {s["name"]!r}')
            phasen.append(['arbeit', dauer])
        if not phasen:
            phasen = [['arbeit', s['duration']]]
        # formula ist meist {xor: {from: [...]}}, bei Einzelpersonen nur die ID.
        formel = s.get('formula')
        if isinstance(formel, str):
            wer = [formel]
        else:
            wer = ((formel or {}).get('xor') or {}).get('from') or list(team)
        leistungen.append({
            'planity_id': sid, 'name': s['name'], 'kategorie': s['kategorie'],
            'dauer': s['duration'], 'preise': s.get('prices'), 'phasen': phasen,
            'personen': [p for p in wer if p in team],
        })
    m = t.index('"openingHours"><div')
    zeilen = re.findall(r'day-[^"]*">([^<]+)</span><span class="opening_hours-module_time[^"]*">(.*?)</span></li>',
                        t[m:m + 5000])
    oeffnung = {}
    for tag, zeit in zeilen:
        zeit = re.sub(r'<[^>]+>', ' ', zeit)
        oeffnung[tag.strip()] = re.findall(r'(\d\d:\d\d)\s*-\s*(\d\d:\d\d)', zeit)
    return {'team': team, 'leistungen': leistungen, 'oeffnung': oeffnung}


# ── Schritt 2: Katalog bauen ─────────────────────────────────────────────

def minuten(hhmm):
    h, m = hhmm.split(':')
    return int(h) * 60 + int(m)


def phasen_pruefen(salon, l):
    """Planity rechnet die Dauer manchmal ohne einen Teilschritt; die
    Gesamtdauer ist das, was Planity bucht — die letzte Arbeitsphase gleicht aus."""
    phasen = [list(p) for p in l['phasen']]
    summe = sum(p[1] for p in phasen)
    if summe != l['dauer']:
        rest = l['dauer'] - sum(p[1] for p in phasen[:-1])
        if rest < 5:
            raise SystemExit(f'{salon}: Phasen passen nicht zu {l["name"]!r}: {phasen} ≠ {l["dauer"]}')
        phasen[-1][1] = rest
    # Nachbarn gleicher Art zusammenlegen, Pausen von 0 streichen.
    aus = []
    for art, d in phasen:
        if d <= 0:
            continue
        if aus and aus[-1][0] == art:
            aus[-1][1] += d
        else:
            aus.append([art, d])
    return aus


def bauen():
    roh = json.loads(ROH.read_text())
    personen = {}   # Name → Eintrag; Bedia arbeitet in beiden Salons
    for salon in ('pasing', 'grosshadern'):
        for pid, p in sorted(roh[salon]['team'].items(), key=lambda x: x[1]['sort']):
            e = personen.setdefault(p['name'], {'name': p['name'], 'salons': [], 'online': p['online'], 'planity': {}})
            e['salons'].append(salon)
            e['planity'][salon] = pid
            e['online'] = e['online'] and p['online']
    kennung = {}
    for i, (name, e) in enumerate(personen.items(), 1):
        e['id'] = re.sub(r'[^a-z]', '', name.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue'))
        e['sort'] = i
        for salon, pid in e['planity'].items():
            kennung[(salon, pid)] = e['id']

    leistungen = []
    for salon, zuordnung in (('pasing', preise.PASING), ('grosshadern', preise.GROSSHADERN)):
        nach_id = {l['planity_id']: l for l in roh[salon]['leistungen']}
        index = preise.posten_lesen(salon)
        # Die Planity-Posten aus planity-preise.json haben keine ID; über
        # Name, Dauer und Preis finden wir die Leistung aus der Buchungsseite.
        for gruppe, name, zusatz, fassungen in zuordnung:
            familie = f'{salon}-{gruppe}-{len(leistungen)}'
            for planity_name, laenge in fassungen:
                p = preise.finden(salon, index, planity_name)
                treffer = [l for l in nach_id.values()
                           if preise.norm(l['name']) == preise.norm(p['name']) and l['dauer'] == p['duration']
                           and l['preise'] == p['prices']]
                if len(treffer) > 1:
                    raise SystemExit(f'{salon}: {len(treffer)} Buchungs-Treffer für {planity_name!r}')
                if not treffer:
                    # Bei Planity nicht online buchbar (Preis auf Anfrage): im
                    # Studio buchbar, online nicht; jede Person des Salons.
                    if not (p.get('prices') or {}).get('onQuotation'):
                        raise SystemExit(f'{salon}: keine Buchungs-Leistung für {planity_name!r}')
                    treffer = [{'planity_id': None, 'dauer': p['duration'], 'preise': p['prices'],
                                'phasen': [['arbeit', p['duration']]], 'personen': None, 'anfrage': True}]
                l = treffer[0]
                text, ab, cent = preise.preis(l['preise'])
                nur_anfrage = 'nur auf Anfrage' in (zusatz or '') or 'vor der Online-Buchung' in (zusatz or '')
                if l['personen'] is None:
                    wer = [e['id'] for e in personen.values() if salon in e['salons']]
                else:
                    wer = [kennung[(salon, pid)] for pid in l['personen'] if (salon, pid) in kennung]
                if not wer:
                    raise SystemExit(f'{salon}: niemand für {planity_name!r}')
                leistungen.append({
                    'id': f'{salon[0]}{len(leistungen) + 1:03d}',
                    'salon': salon, 'gruppe': gruppe, 'familie': familie,
                    'name': name, 'zusatz': zusatz, 'laenge': laenge,
                    'phasen': phasen_pruefen(salon, l),
                    'preis_cent': cent, 'preis_ab': ab, 'preis_text': None if cent is not None else text,
                    'online': not nur_anfrage and not l.get('anfrage'),
                    'personen': wer,
                    'zusatzleistung': (zusatz or '').startswith('als Zusatz'),
                    'planity_id': l['planity_id'],
                })
        # Posten, die nur auf der Website stehen: nicht online, aber im Studio buchbar.
        for gruppe, name, zusatz, fassungen in preise.WEBSITE[salon]:
            familie = f'{salon}-{gruppe}-{len(leistungen)}'
            for laenge, cent in fassungen:
                leistungen.append({
                    'id': f'{salon[0]}{len(leistungen) + 1:03d}',
                    'salon': salon, 'gruppe': gruppe, 'familie': familie,
                    'name': name, 'zusatz': zusatz, 'laenge': laenge,
                    'phasen': [['arbeit', 30]],
                    'preis_cent': cent, 'preis_ab': True, 'preis_text': None,
                    'online': False,
                    'personen': [e['id'] for e in personen.values() if salon in e['salons']],
                    'zusatzleistung': False, 'planity_id': None, 'dauer_offen': True,
                })

    salons = []
    for i, (sid, s) in enumerate(SALONS.items(), 1):
        oeffnung = {}
        for n, tag in enumerate(TAGE, 1):
            oeffnung[str(n)] = [[minuten(a), minuten(b)] for a, b in roh[sid]['oeffnung'].get(tag, [])]
        salons.append(dict(s, id=sid, sort=i, oeffnung=oeffnung, planity=preise.PLANITY[sid]))

    return {
        'stand': roh['gelesen'],
        'gruppen': [{'id': g, 'name': n, 'lauf': l} for g, n, l in preise.GRUPPEN],
        'salons': salons,
        'personen': [{k: e[k] for k in ('id', 'name', 'salons', 'online', 'sort')} for e in personen.values()],
        'leistungen': leistungen,
    }


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--planity':
        import datetime
        daten = {'gelesen': datetime.date.today().isoformat(),
                 'pasing': planity_lesen(sys.argv[2]), 'grosshadern': planity_lesen(sys.argv[3])}
        ROH.write_text(json.dumps(daten, ensure_ascii=False, indent=1) + '\n')
        print(f'{ROH.name}: {sum(len(daten[s]["leistungen"]) for s in ("pasing", "grosshadern"))} Leistungen')
        sys.exit()
    k = bauen()
    ZIEL.parent.mkdir(exist_ok=True)
    ZIEL.write_text(json.dumps(k, ensure_ascii=False, indent=1) + '\n')
    online = sum(1 for l in k['leistungen'] if l['online'])
    print(f'{ZIEL.relative_to(WURZEL)}: {len(k["personen"])} Personen, {len(k["leistungen"])} Leistungen ({online} online)')

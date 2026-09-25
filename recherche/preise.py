#!/usr/bin/env python3
"""Preisliste aus den Planity-Daten bauen.

Quelle: recherche/planity-preise.json — aus den beiden öffentlichen
Planity-Seiten gelesen (Stand im Feld „gelesen“). Hier wird nichts
abgetippt: jeder Preis und jede Dauer kommt aus der Datei, die Zuordnung
unten legt nur fest, in welcher Gruppe ein Posten steht, wie er heisst
und welche Längen er hat.

Aufruf aus der Projektwurzel:

    python3 recherche/preise.py

Schreibt zwischen die Marken <!-- preise:… --> in leistungen.html und
index.html. Fehlt ein Planity-Posten in der Zuordnung, bricht das Skript
ab und nennt ihn — nichts fällt still heraus.
"""
import html
import json
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
DATEN = json.loads((WURZEL / 'recherche' / 'planity-preise.json').read_text())

# Gruppen in der Reihenfolge des Ablaufs: erst Schnitt, dann Farbe, dann
# Pflege; Herren, Kinder und das Übrige danach.
GRUPPEN = [
    ('schnitt',   'Schnitt & Styling',     'Waschen, Schneiden, Föhnen — und Frisuren ohne Schnitt.'),
    ('farbe',     'Farbe & Glossing',      'Ansatz, Färben, Glossing und Tönung.'),
    ('straehnen', 'Strähnen & Balayage',   'Oberkopf, halber oder ganzer Kopf — und Balayage.'),
    ('pflege',    'Pflege & Dauerwelle',   'Haarkur, Olaplex, Kältebehandlung und Dauerwelle.'),
    ('herren',    'Herren',                'Schnitt, Bart und Farbe für Herren.'),
    ('kinder',    'Kinder',                'Haarschnitte für Mädchen und Jungen.'),
    ('verlaengerung', 'Haarverlängerung',  'Extensions und Verdichtung — zuerst die Beratung.'),
    ('gesicht',   'Augenbrauen & Make-up', 'Brauen, Wimpern, Permanent Make-up.'),
]

# (Gruppe, Name, Zusatz, [(Planity-Name, Länge), …])
# Länge None heisst: es gibt nur eine Fassung.
PASING = [
    ('schnitt', 'Waschen, Schneiden, Föhnen', None, [
        ('Damen Waschen-Schneiden-Fönen - kurz-mittel', 'kurz–mittel'),
        ('Damen - Waschen-Schneiden Fönen- lang', 'lang')]),
    ('schnitt', 'Waschen & Föhnen', 'ohne Schnitt', [
        ('Damen | Waschen-Fönen  - kurz', 'kurz'),
        ('Damen | Waschen-Fönen- mittel', 'mittel'),
        ('Damen | Waschen-Fönen - lang', 'lang')]),
    ('schnitt', 'Heiße Schere', 'als Zusatz zum Schnitt', [
        ('Damen -  Heiße Schere Zusatz Buchung', None)]),

    ('farbe', 'Färben, Schneiden, Föhnen', None, [
        ('Färben | Schneiden | Fönen| kurz', 'kurz'),
        ('Färben | Schneiden | Föhnen | mittel', 'mittel'),
        ('Färben |Schneiden | Fönen | lang', 'lang')]),
    ('farbe', 'Färben & Föhnen', None, [
        ('Färben | Föhnen | kurz', 'kurz'),
        ('Färben | Föhnen | mittel', 'mittel'),
        ('Färben | Föhnen | lang', 'lang')]),
    ('farbe', 'Glossing, Föhnen & Haarkur', None, [
        ('Damen - Glossing | Fönen | Haarkur - kurz', 'kurz'),
        ('Damen - Glossing | Fönen| Haarkur - mittel', 'mittel'),
        ('Damen - Glossing |Fönen | Haarkur - lang', 'lang')]),
    ('farbe', 'Glossing, Schneiden, Föhnen & Haarkur', None, [
        ('Damen - Glossing |Schneiden | Fönen | Haarkur  - kurz', 'kurz'),
        ('Damen - Glossing |Schneiden | Fönen | Haarkur  - mittel', 'mittel'),
        ('Damen - Glossing | Schneiden |Fönen| Haarkur  - lang', 'lang')]),
    ('farbe', 'Tönung & Veredelung', None, [
        ('Damen | Tönungen | Veredelung', None)]),

    ('straehnen', 'Strähnen Oberkopf, Schneiden, Föhnen & Pflege', None, [
        ('Damen - Strähnen Oberkopf, Schnitt & Föhnen & Pflege - kurz', 'kurz'),
        ('Damen - Strähnen Oberkopf, Schnitt & Föhnen & Pflege - mittel', 'mittel'),
        ('Damen - Strähnen Oberkopf, Schnitt & Föhnen & Pflege - lang', 'lang')]),
    ('straehnen', 'Strähnen Oberkopf & Föhnen', None, [
        ('Damen - Strähnen Oberkopf & Föhnen - kurz', 'kurz'),
        ('Damen - Strähnen Oberkopf & Föhnen - mittel', 'mittel'),
        ('Damen - Strähnen Oberkopf & Föhnen - lang', 'lang')]),
    ('straehnen', 'Strähnen halber Kopf, Schneiden & Föhnen', None, [
        ('Damen - Strähnen halber Kopf, Schnitt & Föhnen - kurz', 'kurz'),
        ('Damen - Strähnen halber Kopf, Schnitt & Föhnen - mittel', 'mittel'),
        ('Damen - Strähnen halber Kopf, Schnitt & Föhnen - lang', 'lang')]),
    ('straehnen', 'Strähnen halber Kopf & Föhnen', None, [
        ('Damen - Strähnen halber Kopf & Föhnen - kurz', 'kurz'),
        ('Damen - Strähnen halber Kopf & Föhnen - mittel', 'mittel'),
        ('Damen - Strähnen halber Kopf & Föhnen - lang', 'lang')]),
    ('straehnen', 'Strähnen ganzer Kopf, Schneiden & Föhnen', None, [
        ('Damen - Strähnchen ganzer Kopf, Schnitt & Föhnen - kurz', 'kurz'),
        ('Damen - Strähnchen ganzer Kopf, Schnitt & Föhnen - mittel', 'mittel'),
        ('Damen - Strähnchen ganzer Kopf, Schnitt & Föhnen - lang', 'lang')]),
    ('straehnen', 'Strähnen ganzer Kopf & Föhnen', None, [
        ('Damen - Strähnchen ganzer Kopf & Föhnen - kurz', 'kurz'),
        ('Damen - Strähnchen ganzer Kopf & Föhnen - mittel', 'mittel'),
        ('Damen - Strähnchen ganzer Kopf & Föhnen - lang', 'lang')]),
    ('straehnen', 'Balayage, Schneiden & Styling', None, [
        ('Damen - Balayage, Schnitt & Styling - kurz', 'kurz'),
        ('Damen - Balayage, Schnitt & Styling - mittel', 'mittel'),
        ('Damen - Balayage, Schnitt & Styling - lang', 'lang')]),
    ('straehnen', 'Balayage & Styling', 'ohne Schnitt', [
        ('Damen - Balayage & Styling - kurz', 'kurz'),
        ('Damen - Balayage & Styling - mittel', 'mittel'),
        ('Damen - Balayage & Styling - lang', 'lang')]),

    ('pflege', 'Conditioner', None, [('Damen | Conditioner', None)]),
    ('pflege', 'Haarkur', None, [
        ('Damen  | Haarkur kurz', 'kurz'),
        ('Damen  | Haarkur mittel', 'mittel'),
        ('Damen | Haarkur lang', 'lang')]),
    ('pflege', 'Crio-Kur mit Föhnen', 'Kältebehandlung fürs Haar', [
        ('Damen | Crioukur Kältebehandlung und Föhnen|kurz', 'kurz'),
        ('Damen | Crioukur Kältebehandlung und Föhnen | mittel', 'mittel'),
        ('Damen | Crioukur Kältebehandlung und Föhnen  | lang', 'lang')]),
    ('pflege', 'Dauerwelle', 'Preis je nach Länge und Menge', [
        ('Damen | | Dauerwelle - Preis je nach länge und Menge#100', '1 Std. 40 Min.'),
        ('Damen | | Dauerwelle - Preis je nach länge und Menge#135', '2 Std. 15 Min.')]),

    ('herren', 'Schnitt & Styling', None, [('Herren Cut | Styling', None)]),
    ('herren', 'Schnitt, Tonic-Massage & Styling', None, [('Herren | Cut | Tonic Massage | Styling', None)]),

    ('kinder', 'Haarschnitt bis 6 Jahre', None, [('Kinder | Haarschnitt bis 6 Jahre', None)]),

    ('verlaengerung', 'Beratung Extensions', None, [('Extensions Haarverlängerung Beratung', None)]),
    ('verlaengerung', 'Beratung Haarverdichtung', None, [('Haarverdichtung Beratung', None)]),
    ('verlaengerung', 'Tape-Technik & Bondings', None, [('Tapetechnik | Bondings', None)]),

    ('gesicht', 'Augenbrauen zupfen & formen', 'mit Fadentechnik', [('Brows | Zupfen | Formen | Fadentechnik', None)]),
    ('gesicht', 'Permanent Make-up', 'Augenbrauen, Lippen, Eyeliner', [('Permanent Make up', None)]),
    ('gesicht', 'Make-up', 'Business und Braut', [('Make up | Business | Braut', None)]),
]

GROSSHADERN = [
    ('schnitt', 'Waschen, Schneiden, Föhnen', None, [
        ('Damen - waschen-Schneiden & Föhnen - Kurz &Mittel', 'kurz–mittel'),
        ('Damen - waschen-Schneiden & Föhnen - Lang', 'lang')]),
    ('schnitt', 'Föhnen & Legen', 'ohne Schnitt', [
        ('Damen Föhnen / Legen - Kurz-Mittel', 'kurz–mittel'),
        ('Damen Föhnen / Legen - Lang', 'lang')]),
    ('schnitt', 'Hochsteckfrisur', None, [('Damen - Hochsteckfrisur', None)]),

    ('farbe', 'Ansatzfarbe, Schneiden & Föhnen', 'inkl. Haarkur · bis 1 cm Ansatz, sonst Aufschlag ab 10 €', [
        ('Ansatzfarbe, Schnitt & Föhnen inkl. Haarkur - Kurz & Mittel', 'kurz–mittel'),
        ('Ansatzfarbe, Schnitt & Föhnen inkl. Haarkur- Lang 2 Std.', 'lang')]),
    ('farbe', 'Ansatzfarbe & Stylen', 'inkl. Haarkur · je nach Produktverbrauch', [
        ('Ansatzfarbe & Stylen inkl. Haarkur - Kurz & Mittel', 'kurz–mittel'),
        ('Ansatzfarbe & Stylen inkl. Haarkur - Lang', 'lang')]),
    ('farbe', 'Glossing, Schneiden & Stylen', 'inkl. Haarkur · je nach Produktverbrauch', [
        ('Glossing, Schnitt & Stylen - Kurz & Mittel inkl. Haarkur', 'kurz–mittel'),
        ('Glossing, Schnitt & Stylen inkl. Haarkur - Lang ab', 'lang')]),
    ('farbe', 'Glossing & Stylen', 'inkl. Haarkur', [
        ('Glossing & Stylen inkl. Haarkur - Kurz & Mittel', 'kurz–mittel'),
        ('Glossing & Stylen - Lang inkl. Haarkur', 'lang')]),
    ('farbe', 'Glossing', 'als Zusatz', [('glossing', None)]),

    ('straehnen', 'Strähnen halber Kopf, Schneiden & Stylen', 'inkl. Haarkur, ohne Glossing', [
        ('Strähnen halber Kopf, Schnitt & Stylen inkl. Haarkur - Kurz & Mittel', 'kurz–mittel')]),
    ('straehnen', 'Strähnen halber Kopf & Stylen', 'inkl. Haarkur · je nach Aufwand', [
        ('Strähnen halber Kopf & Stylen - Kurz & Mittel inkl. Haarkur', 'kurz–mittel')]),
    ('straehnen', 'Strähnen ganzer Kopf, Schneiden & Stylen', 'inkl. Haarkur · je nach Aufwand', [
        ('Strähnen ganzer Kopf, Schnitt & Stylen - Kurz & Mittel inkl. Haarkur', 'kurz–mittel'),
        ('Strähnen ganzer Kopf, Schnitt & Stylen - Lang inkl. Haarkur', 'lang')]),
    ('straehnen', 'Strähnen ganzer Kopf & Stylen', 'inkl. Haarkur · je nach Aufwand', [
        ('Strähnen ganzer Kopf & Stylen - Kurz & Mittel inkl. Haarkur', 'kurz–mittel'),
        ('Strähnen ganzer Kopf & Stylen - Lang inkl. Haarkur', 'lang')]),
    ('straehnen', 'Balayage, Schneiden, Stylen & Glossing', 'inkl. Haarkur · Preis nach Länge, Material und Aufwand; vor der Online-Buchung bitte beraten lassen', [
        ('Balayage & Schnitt & Stylen & Glossing inkl. Haarkur', None)]),

    ('pflege', 'Olaplex-Behandlung', None, [
        ('Damen - OLAPLEX TREATMENT (60 min) - Kurz & Mittel', 'kurz–mittel'),
        ('Damen - OLAPLEX TREATMENT (60 min) - Lang', 'lang')]),
    ('pflege', 'Dauerwelle & Styling', None, [
        ('Damen - Dauerwelle & Styling - Kurz & Mittel', 'kurz–mittel'),
        ('Damen - Dauerwelle & Styling - Lang', 'lang')]),
    ('pflege', 'Dauerwelle, Schneiden & Styling', None, [
        ('Damen - Dauerwelle & Schnitt& Styling - kurz', 'kurz'),
        ('Damen - Dauerwelle & Schnitt& Styling - lang', 'lang')]),

    ('herren', 'Schnitt & Styling', None, [('Herren - Schnitt & Styling', None)]),
    ('herren', 'Neuschnitt & Stylen', None, [('Herren - Neuschnitt & Stylen', None)]),
    ('herren', 'Maschinenhaarschnitt', None, [('Herren - Maschinenhaarschnitt#Herren', None)]),
    ('herren', 'Bart', None, [('Herren - Bart', None)]),
    ('herren', 'Grauhaarkaschierung', None, [('Herren - Grauhaarkaschierung', None)]),
    ('herren', 'Dauerwelle mit Schnitt', 'inkl. Haarkur', [('Herren - Dauerwelle inkl. Schnitt & Haarkur', None)]),

    ('kinder', 'Mädchen bis 6 Jahre', None, [('Mädchen - Haarschnitt - bis 6 Jahre', None)]),
    ('kinder', 'Mädchen ab 6 Jahre', 'je nach Aufwand', [('Mädchen - Haarschnitt - je nach Aufwand ab 6 Jahre', None)]),
    ('kinder', 'Jungen bis 10 Jahre', None, [('Jungen - Haarschnitt bis 10 Jahre', None)]),

    ('verlaengerung', 'Beratung Extensions', None, [('Extensions / Haarverlängerung Beratung', None)]),
    ('verlaengerung', 'Beratung Haarverdichtung', None, [('Haarverdichtung Beratung', None)]),

    ('gesicht', 'Augenbrauen zupfen', None, [('Augenbrauen zupfen', None)]),
    ('gesicht', 'Augenbrauen färben', None, [('Augenbrauen färben', None)]),
    ('gesicht', 'Wimpern färben', None, [('Wimpern färben', None)]),
    ('gesicht', 'Permanent Make-up: Augenbrauen, Korrektur', 'Termin nur auf Anfrage', [('Permanent Make-Up - Augenbrauen - Korrektur', None)]),
    ('gesicht', 'Permanent Make-up: Augenbrauen, Rekonstruktion', 'Termin nur auf Anfrage', [('Permanent Make-Up - Augenbrauen - Rekonstruktion', None)]),
    ('gesicht', 'Permanent Make-up: Eyeliner', None, [
        ('Permanent Make-Up - Eyeliner Oberlid', 'Oberlid'),
        ('Permanent Make-Up - Eyeliner Unterlid', 'Unterlid')]),
    ('gesicht', 'Permanent Make-up: Lippen', None, [('Permanent Make-Up - Lippen', None)]),
]

# Leistungen, die nur auf irmonhair-muenchen.de/unsere-preise stehen und
# bei Planity fehlen (gelesen am selben Tag). Sie sind nicht online
# buchbar und tragen deshalb den Hinweis „telefonisch“. Wo es eine
# Leistung in beiden Quellen gibt, gilt Planity — die Buchung ist neuer
# gepflegt als die Website. Preise in Cent, alle als Ab-Preis.
# (Gruppe, Name, Zusatz, [(Länge, Cent), …])
WEBSITE = {
    'pasing': [
        ('farbe', 'Illumina', None, [(None, 6000)]),
        ('farbe', 'Elumen', None, [(None, 8000)]),
        ('farbe', 'Topchic', None, [(None, 4000)]),
        ('farbe', 'Greyshade', None, [(None, 4000)]),
        ('farbe', 'Olaplex Color', None, [('kurz', 4000), ('mittel', 6000), ('lang', 8000)]),
        ('pflege', 'Olaplex-Behandlung', None, [('kurz', 7000), ('mittel', 9000), ('lang', 11000)]),
        ('kinder', 'Mädchen bis 6 Jahre', None, [(None, 4500)]),
        ('verlaengerung', 'Extensions', 'pro Strähne · Überlänge extra', [(None, 700)]),
    ],
    'grosshadern': [
        ('farbe', 'Neufarbe', 'je nach Farbverbrauch und Haarlänge', [(None, 9000)]),
        ('pflege', 'Haarkur', None, [('kurz–mittel', 1000), ('lang', 1500)]),
        ('pflege', 'Conditioner', None, [(None, 600)]),
        ('herren', 'Farbe', None, [(None, 6000)]),
        ('kinder', 'Jungen ab 10 Jahre', None, [(None, 3500)]),
    ],
}

# Bewusst nicht gelistet, mit Grund: (Planity-Name, Planity-Gruppe)
AUSGELASSEN = {
    # Steht bei Planity ein zweites Mal unter „Damen“, dort mit 28 €.
    # Unter „Herren“ steht er mit 25 € — die Seite nimmt diesen.
    'grosshadern': {('Herren - Maschinenhaarschnitt', 'Damen - Haarschnitte & Stylings')},
    'pasing': set(),
}


def norm(s):
    return re.sub(r'\s+', ' ', s).strip().lower()


def posten_lesen(salon):
    """Planity-Posten nach Namen. Ein Name kann mehrfach vorkommen."""
    index = {}
    for kat in DATEN[salon]['kategorien']:
        for s in kat['services']:
            s = dict(s, gruppe=kat['name'])
            index.setdefault(norm(s['name']), []).append(s)
    return index


def finden(salon, index, planity):
    """„Name#Merkmal“ trennt Doppelte nach Dauer oder Planity-Gruppe."""
    name, _, merk = planity.partition('#')
    treffer = index.get(norm(name), [])
    if merk:
        treffer = [s for s in treffer if merk in (str(s['duration']), s['gruppe'].split(' ')[0])]
    if len(treffer) != 1:
        sys.exit(f'{salon}: {len(treffer)} Treffer für {planity!r}')
    return treffer[0]


def euro(cent):
    e = cent / 100
    return (f'{e:.0f}' if e == int(e) else f'{e:.2f}'.replace('.', ',')) + ' €'


def preis(p):
    """(Text, ab?, Zahl oder None)"""
    if not p:
        return ('nach Beratung', False, None)
    if p.get('onQuotation'):
        return ('auf Anfrage', False, None)
    if 'default' in p:
        return (euro(p['default']), False, p['default'])
    if 'min' in p:
        return (euro(p['min']), True, p['min'])
    raise ValueError(p)


def dauer(minuten):
    h, m = divmod(minuten, 60)
    if h and m:
        return f'{h} Std. {m} Min.'
    if h:
        return f'{h} Std.'
    return f'{m} Min.'


def aufbauen(salon, zuordnung):
    index = posten_lesen(salon)
    benutzt = set()
    gruppen = {g[0]: [] for g in GRUPPEN}
    for gruppe, name, zusatz, fassungen in zuordnung:
        stufen = []
        for planity, laenge in fassungen:
            s = finden(salon, index, planity)
            benutzt.add(id(s))
            stufen.append({'laenge': laenge, 'preis': preis(s.get('prices')),
                           'dauer': s['duration']})
        gruppen[gruppe].append({'name': name, 'zusatz': zusatz, 'stufen': stufen})
    for gruppe, name, zusatz, fassungen in WEBSITE[salon]:
        stufen = [{'laenge': l, 'preis': (euro(c), True, c), 'dauer': None} for l, c in fassungen]
        gruppen[gruppe].append({'name': name, 'zusatz': zusatz, 'stufen': stufen, 'telefonisch': True})
    rest = [(s['name'], s['gruppe']) for liste in index.values() for s in liste
            if id(s) not in benutzt and (s['name'], s['gruppe']) not in AUSGELASSEN[salon]]
    if rest:
        sys.exit(f'{salon}: nicht zugeordnet: {rest}')
    return gruppen


E = html.escape


def posten_html(p):
    stufen = p['stufen']
    dauern = sorted({s['dauer'] for s in stufen if s['dauer']})
    if p.get('telefonisch'):
        unten = '<p class="posten-dauer posten-telefon">telefonisch buchen</p>'
    else:
        d = dauer(dauern[0]) if len(dauern) == 1 else f'{dauer(dauern[0])} – {dauer(dauern[-1])}'
        unten = f'<p class="posten-dauer"><span class="nurlesen">Dauer: </span>{d}</p>'
    kopf = (f'<div class="posten-kopf"><h4 class="posten-name">{E(p["name"])}</h4>'
            + (f'<p class="posten-zusatz">{E(p["zusatz"])}</p>' if p['zusatz'] else '')
            + unten + '</div>')
    # Ohne Zahl in jeder Länge (Färben in Pasing) genügt ein einziges Wort.
    if len(stufen) > 1 and all(s['preis'][2] is None for s in stufen) and \
            len({s['preis'][0] for s in stufen}) == 1:
        stufen = [dict(stufen[0], laenge=None)]
    zellen = []
    for s in stufen:
        text, ab, _ = s['preis']
        wert = (f'<span class="ab">ab</span> {text}' if ab else text)
        klasse = 'preis' + ('' if s['preis'][2] is not None else ' preis-wort')
        if s['laenge']:
            zellen.append(f'<div><dt>{E(s["laenge"])}</dt><dd class="{klasse}">{wert}</dd></div>')
        else:
            zellen.append(f'<div class="einzeln"><dt class="nurlesen">Preis</dt><dd class="{klasse}">{wert}</dd></div>')
    return f'<li class="posten">{kopf}<dl class="stufen" data-n="{len(stufen)}">{"".join(zellen)}</dl></li>'


def salon_html(salon, gruppen):
    teile = []
    for gid, titel, lauf in GRUPPEN:
        posten = gruppen[gid]
        if not posten:
            continue
        teile.append(
            f'<section class="gruppe" id="{salon}-{gid}" aria-labelledby="{salon}-{gid}-t">'
            f'<header class="gruppe-kopf"><h3 id="{salon}-{gid}-t">{E(titel)}</h3>'
            f'<p>{E(lauf)}</p></header>'
            f'<ul class="posten-liste">{"".join(posten_html(p) for p in posten)}</ul></section>')
    return '\n'.join(teile)


def wegweiser_html(salon, gruppen):
    return ''.join(f'<a href="#{salon}-{gid}">{E(titel)}</a>'
                   for gid, titel, _ in GRUPPEN if gruppen[gid])


def ab_preis(posten):
    # Zusatzleistungen (Heiße Schere, Glossing als Zusatz) und Stückpreise
    # (Extensions pro Strähne) sind kein Einstieg.
    zahlen = [s['preis'][2] for p in posten if not (p['zusatz'] or '').startswith(('als Zusatz', 'pro '))
              for s in p['stufen'] if s['preis'][2] is not None]
    return euro(min(zahlen)) if zahlen else None


def uebersicht_html(pas, gro):
    zeilen = []
    for i, (gid, titel, lauf) in enumerate(GRUPPEN, 1):
        def wert(g):
            a = ab_preis(g[gid])
            if a:
                return f'ab {a}'
            return 'auf Anfrage' if g[gid] else '—'
        zeilen.append(
            f'<li><a class="angebot" href="leistungen.html#{gid}" data-gruppe="{gid}">'
            f'<span class="angebot-nr" aria-hidden="true">{i:02d}</span>'
            f'<span class="angebot-text"><span class="angebot-name">{E(titel)}</span>'
            f'<span class="angebot-lauf">{E(lauf)}</span></span>'
            f'<span class="angebot-preise"><span><i>Pasing</i> {wert(pas)}</span>'
            f'<span><i>Großhadern</i> {wert(gro)}</span></span></a></li>')
    return '<ol class="angebote">' + ''.join(zeilen) + '</ol>'


def einsetzen(datei, marke, inhalt):
    pfad = WURZEL / datei
    text = pfad.read_text()
    muster = re.compile(rf'(<!-- preise:{marke} -->).*?(<!-- /preise:{marke} -->)', re.S)
    if not muster.search(text):
        sys.exit(f'{datei}: Marke preise:{marke} fehlt')
    text = muster.sub(lambda m: m.group(1) + '\n' + inhalt + '\n' + m.group(2), text)
    pfad.write_text(text)


if __name__ == '__main__':
    pas = aufbauen('pasing', PASING)
    gro = aufbauen('grosshadern', GROSSHADERN)
    einsetzen('leistungen.html', 'pasing', salon_html('pasing', pas))
    einsetzen('leistungen.html', 'grosshadern', salon_html('grosshadern', gro))
    einsetzen('leistungen.html', 'weg-pasing', wegweiser_html('pasing', pas))
    einsetzen('leistungen.html', 'weg-grosshadern', wegweiser_html('grosshadern', gro))
    einsetzen('index.html', 'uebersicht', uebersicht_html(pas, gro))
    # Die erste Fassung unter /alt/ bekommt dieselben Listen.
    for marke, inhalt in [('pasing', salon_html('pasing', pas)), ('grosshadern', salon_html('grosshadern', gro)),
                          ('weg-pasing', wegweiser_html('pasing', pas)), ('weg-grosshadern', wegweiser_html('grosshadern', gro))]:
        einsetzen('alt/leistungen.html', marke, inhalt)
    einsetzen('alt/index.html', 'uebersicht', uebersicht_html(pas, gro))
    # Die Fassung mit der Schleife unter /schleife/ hat dieselben Marken.
    for marke, inhalt in [('pasing', salon_html('pasing', pas)), ('grosshadern', salon_html('grosshadern', gro)),
                          ('weg-pasing', wegweiser_html('pasing', pas)), ('weg-grosshadern', wegweiser_html('grosshadern', gro))]:
        einsetzen('schleife/leistungen.html', marke, inhalt)
    einsetzen('schleife/index.html', 'uebersicht', uebersicht_html(pas, gro))
    n = sum(len(v) for v in pas.values()) + sum(len(v) for v in gro.values())
    print(f'{n} Posten gesetzt, Stand {DATEN["pasing"]["gelesen"]}')

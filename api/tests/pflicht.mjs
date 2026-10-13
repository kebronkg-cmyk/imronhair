// Die Pflicht-Tests aus der Spezifikation (Abschnitt 4.5) — ohne Ausnahme
// grün vor jedem Deploy. Gegen einen laufenden Server mit FRISCHER Datenbank:
//   IRMONHAIR_KONFIG=/pfad/test-config.php PHP_CLI_SERVER_WORKERS=8 php -S 127.0.0.1:8098 &
//   node api/tests/pflicht.mjs http://127.0.0.1:8098/api/ testschluessel-123456
// Bricht beim ersten Fehler ab und nennt ihn.
import { feiertage } from './pruefen-hilfe.mjs';

const API = process.argv[2] || 'http://127.0.0.1:8098/api/';
const SCHLUESSEL = process.argv[3] || 'testschluessel-123456';
let ok = 0;
function pruefe(bedingung, text, daten) {
  if (!bedingung) {
    console.error('✗ ' + text + (daten !== undefined ? '\n  ' + JSON.stringify(daten).slice(0, 900) : ''));
    process.exit(1);
  }
  ok++;
  console.log('✓ ' + text);
}
let cookie = '', csrf = '';
async function rufe(a, { get, post, ohneAnmeldung } = {}) {
  const url = new URL(API);
  url.searchParams.set('a', a);
  for (const [k, v] of Object.entries(get || {})) url.searchParams.set(k, v);
  const h = {};
  if (cookie && !ohneAnmeldung) { h.Cookie = cookie; h['X-CSRF'] = csrf; }
  if (post !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(url, { method: post !== undefined ? 'POST' : 'GET', headers: h, body: post !== undefined ? JSON.stringify(post) : undefined });
  const sc = r.headers.get('set-cookie');
  if (sc) { const m = sc.match(/ih_studio=([^;]*)/); if (m) cookie = m[1] ? 'ih_studio=' + m[1] : ''; }
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { roh: text }; }
  return { status: r.status, json, text };
}
const iso = (d) => d.toISOString().slice(0, 10);
const istFeiertag = (s) => feiertage(+s.slice(0, 4)).has(s);
function tagAb(n, wochentag) {
  const d = new Date(); d.setDate(d.getDate() + n);
  while (d.getDay() !== wochentag || istFeiertag(iso(d))) d.setDate(d.getDate() + 1);
  return iso(d);
}
const MI = tagAb(10, 3);       // ein Mittwoch
const DO = tagAb(10, 4);       // ein Donnerstag
const FR = tagAb(10, 5);       // ein Freitag
const hat = (frei, d, t, p) => (frei.tage[d]?.zeiten || []).some((z) => z.t === t && (!p || z.p.includes(p)));
let nr = 0;
const neueId = () => 'pflicht-' + Date.now().toString(36) + '-' + (nr++) + '-' + Math.random().toString(36).slice(2, 8);
const buchung = (x) => ({ name: 'Paula Pflicht', telefon: '0176 4' + String(100000 + nr).slice(-6), einwilligung: true, anfrage_id: neueId(), ...x });

const kat = (await rufe('katalog')).json;
const L = (salon, name, laenge) => kat.leistungen.find((l) => l.salon === salon && l.name === name && (!laenge || l.laenge === laenge));
const schnitt = L('pasing', 'Waschen, Schneiden, Föhnen', 'lang');            // 75 Min.
const waschen = L('pasing', 'Waschen & Föhnen', 'kurz');                       // 30 Min.
const balayage = L('pasing', 'Balayage & Styling', 'kurz');                    // 30 Arbeit, 60 Einwirken, 60 Arbeit
const gs = kat.leistungen.find((l) => l.salon === 'grosshadern' && l.personen.includes('bedia') && l.dauer >= 30 && l.dauer <= 90);
pruefe(schnitt && waschen && balayage && gs, 'Katalog: Testleistungen vorhanden');

// Studio einrichten (Inhaberin), für die Tests mit Sonderdauern.
const st = (await rufe('studio_status')).json;
pruefe(st.eingerichtet === false, 'Frische Datenbank (Studio noch nicht eingerichtet)', st);
let r = await rufe('einrichten', { post: { schluessel: SCHLUESSEL, person: st.personen[0].id, anmeldename: 'chefin', passwort: 'chefin-passwort-1' } });
pruefe(r.status === 200, 'Studio eingerichtet');
csrf = (await rufe('studio_status')).json.csrf;

// ── 1. 200 gleichzeitige Buchungen auf denselben Slot → genau 1 Erfolg ──
const viele = await Promise.all(Array.from({ length: 200 }, (_, i) => rufe('buchen', {
  ohneAnmeldung: true,
  post: buchung({ salon: 'pasing', leistungen: [schnitt.id], person: 'tina', start: `${MI} 10:00`, telefon: '0151 7' + String(i).padStart(6, '0') }),
})));
const erfolge = viele.filter((x) => x.status === 200);
const status200 = {}; for (const x of viele) status200[x.status] = (status200[x.status] || 0) + 1;
pruefe(erfolge.length === 1 && viele.filter((x) => x.status === 409 && x.json.code === 'vergeben').length === 199,
  `1 · 200 gleichzeitig auf denselben Platz → genau 1 Termin`, status200);
pruefe(viele.find((x) => x.status === 409).json.alternativen?.length === 3, '    die übrigen bekommen sofort 3 Ausweichzeiten', viele.find((x) => x.status === 409).json);
const alt0 = viele.find((x) => x.status === 409).json.alternativen;
pruefe(alt0.every((a) => a.datum >= MI) && alt0[0].datum === MI, '    zuerst am selben Tag', alt0);

// ── 2. Doppelt abgeschickte Anfrage (gleiche anfrage_id) → 1 Termin ─────
const doppel = buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'csilla', start: `${MI} 09:00` });
const zwei = await Promise.all(Array.from({ length: 12 }, () => rufe('buchen', { post: doppel, ohneAnmeldung: true })));
pruefe(zwei.every((x) => x.status === 200 && x.json.id === zwei[0].json.id), '2 · 12× dieselbe Anfrage gleichzeitig → 1 Termin', zwei.map((x) => x.json.id || x.json.code));
r = await rufe('buchen', { post: doppel, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.id === zwei[0].json.id && r.json.wiederholt === true, '    und später noch einmal → derselbe Termin, als Wiederholung erkannt');
r = await rufe('anfrage', { get: { anfrage_id: doppel.anfrage_id }, ohneAnmeldung: true });
pruefe(r.json.angekommen === true && r.json.termin.id === zwei[0].json.id, '    „Ist meine Buchung angekommen?“ findet sie über die Anfrage-Kennung');
r = await rufe('anfrage', { get: { anfrage_id: neueId() }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.angekommen === false, '    unbekannte Kennung: nicht angekommen');

// ── 3. Halboffene Intervalle ────────────────────────────────────────────
const neu = (x) => rufe('termin_neu', { post: { salon: 'pasing', leistungen: [waschen.id], kunde: { name: 'Intervall Test' }, quelle: 'telefon', ...x } });
r = await neu({ person: 'bedia', start: `${DO} 13:00`, phasen: [['arbeit', 60]] });
const iv1 = r.json;
pruefe(r.status === 200 && iv1.ende === `${DO} 14:00`, '3 · 13:00–14:00 gebucht', r.json);
r = await neu({ person: 'bedia', start: `${DO} 14:00`, phasen: [['arbeit', 60]] });
pruefe(r.status === 200, '    14:00–15:00 direkt danach erlaubt (halboffen)', r.json);
r = await neu({ person: 'csilla', start: `${DO} 13:00`, phasen: [['arbeit', 65]] });
pruefe(r.status === 200 && r.json.ende === `${DO} 14:05`, '    13:00–14:05 bei Csilla', r.json);
r = await neu({ person: 'csilla', start: `${DO} 14:00`, phasen: [['arbeit', 60]] });
pruefe(r.status === 409 && r.json.hart, '    14:00 danach abgelehnt (fünf Minuten Überschneidung)', r.json);
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, person: 'csilla', von: DO, tage: 1 }, ohneAnmeldung: true });
pruefe(!hat(r.json, DO, '14:00') && hat(r.json, DO, '14:05'), '    online wird 14:00 nicht angeboten, 14:05 schon', r.json.tage[DO]?.zeiten.map((z) => z.t));
r = await rufe('termin_neu', { post: { salon: 'pasing', person: 'csilla', leistungen: [waschen.id], start: `${DO} 15:07`, kunde: { name: 'Krumm' } } });
pruefe(r.status === 422, '    krumme Minute (15:07) gibt es nicht — 5-Minuten-Raster', r.json);

// ── 4. Einwirkzeit ──────────────────────────────────────────────────────
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [balayage.id], person: 'tina', start: `${FR} 10:00` }), ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.ende === `${FR} 12:30`, '4 · Balayage 10:00–12:30 (Arbeit 10:00–10:30, Einwirken bis 11:30)', r.json);
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${FR} 10:30` }), ohneAnmeldung: true });
pruefe(r.status === 200, '    in der Einwirkzeit eine andere Kundin (10:30–11:00) → erlaubt', r.json);
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${FR} 11:15` }), ohneAnmeldung: true });
pruefe(r.status === 409, '    11:15 ragt in die zweite Arbeitsphase (ab 11:30) → abgelehnt', r.json);
r = await neu({ person: 'tina', start: `${FR} 10:15`, phasen: [['arbeit', 15]] });
pruefe(r.status === 409 && r.json.hart, '    in der Arbeitsphase (10:15) auch im Studio → abgelehnt', r.json);

// ── 5. Person in Salon A gebucht → gleiche Zeit in Salon B ──────────────
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], person: 'bedia', start: `${FR} 15:00` }), ohneAnmeldung: true });
pruefe(r.status === 200, '5 · Bedia in Pasing 15:00–16:15');
r = await rufe('buchen', { post: buchung({ salon: 'grosshadern', leistungen: [gs.id], person: 'bedia', start: `${FR} 15:30` }), ohneAnmeldung: true });
pruefe(r.status === 409, '    Bedia gleichzeitig in Großhadern online → abgelehnt', r.json);
r = await rufe('termin_neu', { post: { salon: 'grosshadern', person: 'bedia', leistungen: [gs.id], start: `${FR} 15:30`, kunde: { name: 'Salon B' }, ausserhalb_ok: true } });
pruefe(r.status === 409 && r.json.hart, '    und im Studio, auch mit Überstimmen → abgelehnt', r.json);

// ── 6. Schließtag, Urlaub, Pause, Feiertag → abgelehnt ──────────────────
const SA = tagAb(12, 6);
const SO = iso(new Date(new Date(SA + 'T12:00:00Z').getTime() + 86400000));
r = await rufe('abwesenheit_speichern', { post: { salon: 'pasing', von: `${SA} 00:00`, bis: `${SO} 00:00`, art: 'geschlossen' } });
pruefe(r.status === 200, '6 · Schließtag für Pasing eingetragen');
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, von: SA, tage: 1 }, ohneAnmeldung: true });
pruefe(r.json.tage[SA]?.zu === true, '    online geschlossen', r.json.tage[SA]);
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], start: `${SA} 10:00` }), ohneAnmeldung: true });
pruefe(r.status === 409, '    Buchung am Schließtag online → abgelehnt');
r = await neu({ person: 'tina', start: `${SA} 10:00`, ausserhalb_ok: true });
pruefe(r.status === 409 && r.json.konflikte.some((k) => k.art === 'geschlossen'), '    im Studio, auch mit Überstimmen → abgelehnt', r.json);
const urlaub = tagAb(22, 3);   // ein anderer Mittwoch als MI
await rufe('abwesenheit_speichern', { post: { person: 'csilla', von: `${urlaub} 00:00`, bis: `${urlaub} 23:55`, art: 'urlaub' } });
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'csilla', start: `${urlaub} 11:00` }), ohneAnmeldung: true });
pruefe(r.status === 409, '    Urlaub: online → abgelehnt');
r = await neu({ person: 'csilla', start: `${urlaub} 11:00`, ausserhalb_ok: true });
pruefe(r.status === 409 && r.json.konflikte.some((k) => k.art === 'abwesend'), '    Urlaub im Studio, auch mit Überstimmen → abgelehnt', r.json);
await rufe('abwesenheit_speichern', { post: { person: 'tina', von: `${urlaub} 12:00`, bis: `${urlaub} 13:00`, art: 'pause' } });
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${urlaub} 12:15` }), ohneAnmeldung: true });
pruefe(r.status === 409, '    Pause: online → abgelehnt');
r = await neu({ person: 'tina', start: `${urlaub} 11:45`, ausserhalb_ok: true });
pruefe(r.status === 409, '    Pause im Studio (11:45–12:15 ragt hinein) → abgelehnt', r.json);
r = await neu({ person: 'tina', start: `${urlaub} 18:15`, ausserhalb_ok: true });
pruefe(r.status === 409 && r.json.konflikte.some((k) => k.art === 'geschlossen'), '    nach Ladenschluss (Ende 18:45 > 18:30) → abgelehnt', r.json);
// Nächster Feiertag an einem Werktag im Buchungsfenster
let feiertag = null;
for (let i = 1; i <= 88 && !feiertag; i++) {
  const d = new Date(); d.setDate(d.getDate() + i);
  if (d.getDay() >= 2 && d.getDay() <= 6 && istFeiertag(iso(d))) feiertag = iso(d);
}
if (feiertag) {
  r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, von: feiertag, tage: 1 }, ohneAnmeldung: true });
  pruefe(r.json.tage[feiertag]?.zu === true, `    Feiertag ${feiertag}: online geschlossen`, r.json.tage[feiertag]);
  r = await neu({ person: 'tina', start: `${feiertag} 10:00`, ausserhalb_ok: true });
  pruefe(r.status === 409 && r.json.konflikte.some((k) => k.art === 'geschlossen'), '    Feiertag im Studio → abgelehnt', r.json);
} else console.log('  (kein Werktags-Feiertag in den nächsten 88 Tagen — übersprungen)');

// ── 7. Zeitumstellung März/Oktober ──────────────────────────────────────
// Die Salons haben sonntags zu; für die Prüfung öffnet Pasing sonntags
// rund um die Uhr und Benny (nicht online) arbeitet dann.
const sm = (await rufe('studio_status')).json.stammdaten;
const pasing = sm.salons.find((s) => s.id === 'pasing');
r = await rufe('salon_speichern', { post: { id: 'pasing', oeffnung: { ...pasing.oeffnung, 7: [[0, 1440]] }, telefon_text: pasing.telefon_text, strasse: pasing.strasse, ort: pasing.ort } });
pruefe(r.status === 200, '7 · Pasing für die Prüfung sonntags geöffnet');
const team = (await rufe('team')).json.personen;
const benny = team.find((p) => p.id === 'benny');
r = await rufe('person_speichern', { post: { ...benny, arbeitszeiten: [...benny.arbeitszeiten, { salon: 'pasing', tag: 7, von: 0, bis: 1440 }] } });
pruefe(r.status === 200, '    Benny arbeitet sonntags');
const letzterSonntag = (jahr, monat) => { const d = new Date(Date.UTC(jahr, monat + 1, 0)); while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() - 1); return iso(d); };
const heute = new Date();
const okt = letzterSonntag(heute.getMonth() > 9 || (heute.getMonth() === 9 && heute.getDate() > 20) ? heute.getFullYear() + 1 : heute.getFullYear(), 9);
const mrz = letzterSonntag(heute.getMonth() > 2 ? heute.getFullYear() + 1 : heute.getFullYear(), 2);
for (const [tagU, name, utcVorher, utcNachher] of [[mrz, 'März', '09:00', '08:00'], [okt, 'Oktober', '08:00', '09:00']]) {
  const bl = benny.leistungen.map((id) => kat.leistungen.find((l) => l.id === id) || sm.leistungen.find((l) => l.id === id)).find((l) => l && l.salon === 'pasing');
  const b = (start, phasen) => rufe('termin_neu', { post: { salon: 'pasing', person: 'benny', leistungen: [bl.id], start: `${tagU} ${start}`, phasen, kunde: { name: 'Zeit Umstellung' } } });
  r = await b('10:00', [['arbeit', 60]]);
  pruefe(r.status === 200 && r.json.start === `${tagU} 10:00` && r.json.ende === `${tagU} 11:00` && r.json.start_utc.endsWith(utcNachher + ':00'),
    `    ${name} (${tagU}): 10:00–11:00 hat 60 Min., UTC ${utcNachher} nach der Umstellung`, r.json);
  r = await b('00:30', [['arbeit', 60]]);
  pruefe(r.status === 200 && r.json.ende === `${tagU} 01:30` && r.json.start_utc.slice(11, 16) === (name === 'März' ? '23:30' : '22:30'), `    ${name}: 00:30–01:30 vor der Umstellung, UTC richtig`, r.json);
  r = await b('02:30', [['arbeit', 30]]);
  pruefe(r.status === 409 || r.status === 422, `    ${name}: 02:30 gibt es ${name === 'März' ? 'nicht' : 'zweimal'} → abgelehnt`, r.json);
  r = await b('01:30', [['arbeit', 120]]);
  pruefe(r.status === 409 || r.status === 422, `    ${name}: 01:30 + 120 Min. über die Umstellung → abgelehnt (Dauer wäre falsch)`, r.json);
  r = await rufe('kalender', { get: { salon: 'pasing', von: tagU } });
  pruefe(r.json.termine.filter((t) => t.person === 'benny').every((t) => ['10:00', '00:30'].includes(t.start.slice(11))), `    ${name}: im Kalender nur die zwei gültigen Termine`, r.json.termine.map((t) => t.start));
  void utcVorher;
}

// ── 8. Verschieben: neuer Slot belegt → alter Termin bleibt ─────────────
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'csilla', start: `${MI} 15:00` }), ohneAnmeldung: true });
const v1 = r.json;
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'csilla', start: `${MI} 16:00` }), ohneAnmeldung: true });
pruefe(r.status === 200 && v1.id, '8 · Zwei Termine bei Csilla: 15:00 und 16:00', [v1, r.json]);
const vVorher = (await rufe('termin', { get: { t: v1.token }, ohneAnmeldung: true })).json;
r = await rufe('verschieben', { post: { t: v1.token, start: `${MI} 16:00` }, ohneAnmeldung: true });
pruefe(r.status === 409 && r.json.code === 'vergeben' && r.json.alternativen?.length, '    Verschieben auf den belegten Platz → abgelehnt, mit Ausweichzeiten', r.json);
const vNach = (await rufe('termin', { get: { t: v1.token }, ohneAnmeldung: true })).json;
pruefe(vNach.start === vVorher.start && vNach.ende === vVorher.ende && vNach.status === 'gebucht' && vNach.person === 'csilla', '    der alte Termin ist unverändert', vNach);
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, person: 'csilla', von: MI, tage: 1 }, ohneAnmeldung: true });
pruefe(!hat(r.json, MI, '15:00'), '    und blockiert seinen Platz weiter');
// Studio: dasselbe mit Versionsschutz
const cal = (await rufe('kalender', { get: { salon: 'pasing', von: MI } })).json.termine.find((t) => t.id === v1.id);
r = await rufe('termin_aendern', { post: { id: v1.id, version: cal.version, start: `${MI} 16:00` } });
pruefe(r.status === 409, '    auch im Studio → abgelehnt');
const cal2 = (await rufe('kalender', { get: { salon: 'pasing', von: MI } })).json.termine.find((t) => t.id === v1.id);
pruefe(cal2.version === cal.version && cal2.start === cal.start, '    Version und Zeit unverändert', [cal, cal2]);

// ── 9. „Neu buchen“ bei bestehendem Termin → zusätzlicher Termin ────────
const tel = '0176 5559999';
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], start: `${DO} 09:00`, telefon: tel }), ohneAnmeldung: true });
const n1 = r.json;
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], start: `${DO} 16:00`, telefon: tel }), ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.id !== n1.id, '9 · Neu buchen mit derselben Nummer → zusätzlicher Termin', r.json);
r = await rufe('termin', { get: { t: n1.token }, ohneAnmeldung: true });
pruefe(r.json.status === 'gebucht' && r.json.start === n1.start, '    der erste bleibt bestehen');

// ── 10. Gewählte Person ≠ zugewiesene Person → unmöglich ────────────────
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${MI} 10:30` }), ohneAnmeldung: true });
pruefe(r.status === 409, '10 · Tina ist 10:30 belegt → keine stille Umverteilung auf jemand anderen', r.json);
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, von: MI, tage: 1 }, ohneAnmeldung: true });
pruefe(hat(r.json, MI, '10:30'), '    (obwohl um 10:30 andere frei wären)');
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${MI} 12:00` }), ohneAnmeldung: true });
const w1 = r.json;
pruefe(r.status === 200 && w1.person === 'tina' && w1.wunsch_person, '    Wunschperson Tina 12:00 gebucht, als Wunsch markiert');
await rufe('termin_neu', { post: { salon: 'pasing', person: 'tina', leistungen: [waschen.id], start: `${MI} 14:00`, kunde: { name: 'Blockiert Tina' } } });
r = await rufe('verschieben', { post: { t: w1.token, start: `${MI} 14:00` }, ohneAnmeldung: true });
pruefe(r.status === 409, '    Verschieben auf eine Zeit, in der nur andere frei sind → abgelehnt, nicht umverteilt', r.json);
r = await rufe('termin', { get: { t: w1.token }, ohneAnmeldung: true });
pruefe(r.json.person === 'tina' && r.json.start === `${MI} 12:00`, '    Person und Zeit bleiben');
const cw = (await rufe('kalender', { get: { salon: 'pasing', von: MI } })).json.termine.find((t) => t.id === w1.id);
r = await rufe('termin_aendern', { post: { id: w1.id, version: cw.version, person: 'bedia' } });
pruefe(r.status === 200 && r.json.person === 'bedia', '    der Salon kann aktiv umbesetzen (mit Benachrichtigung, siehe Protokoll)', r.json);
r = await rufe('termin_verlauf', { get: { id: w1.id } });
pruefe(r.json.verlauf.some((v) => v.akteur === 'kunde' && v.aktion === 'termin_angelegt') && r.json.verlauf.some((v) => v.akteur === 'mitarbeiter' && v.daten?.vorher?.person === 'tina' && v.daten?.nachher?.person === 'bedia'),
  '    Protokoll: wer, wann, vorher → nachher', r.json.verlauf);

// ── 11. Bestätigungstext = DB-Stand ─────────────────────────────────────
r = await rufe('buchen', { post: buchung({ salon: 'grosshadern', leistungen: [gs.id], start: `${DO} 10:00` }), ohneAnmeldung: true });
const b1 = r.json;
const db1 = (await rufe('kalender', { get: { salon: 'grosshadern', von: DO } })).json.termine.find((t) => t.id === b1.id);
pruefe(b1.start === db1.start && b1.ende === db1.ende && b1.person === db1.person && b1.person_name === db1.person_name && b1.salon.id === db1.salon,
  '11 · Bestätigung (Start, Ende, Person, Salon) = gespeicherter Stand', [b1, db1]);
r = await rufe('termin', { get: { t: b1.token }, ohneAnmeldung: true });
pruefe(r.json.start === b1.start && r.json.ende === b1.ende && r.json.person_name === b1.person_name, '    Bestätigungsseite liest denselben Stand');

// ── 12. Zwei Geräte bearbeiten denselben Termin ─────────────────────────
const g = (await rufe('kalender', { get: { salon: 'grosshadern', von: DO } })).json.termine.find((t) => t.id === b1.id);
const [ga, gb] = await Promise.all([
  rufe('termin_aendern', { post: { id: g.id, version: g.version, notiz: 'Gerät A' } }),
  rufe('termin_aendern', { post: { id: g.id, version: g.version, notiz: 'Gerät B' } }),
]);
const gStatus = [ga.status, gb.status].sort().join();
pruefe(gStatus === '200,409' && [ga, gb].find((x) => x.status === 409).json.code === 'veraltet', '12 · Zwei Geräte gleichzeitig → das zweite bekommt den Versionsfehler', [ga.json, gb.json]);
r = await rufe('termin_aendern', { post: { id: g.id, notiz: 'ohne Version' } });
pruefe(r.status === 422 && r.json.code === 'version', '    Ändern ohne Versionsstand geht nicht', r.json);

// ── 13. Handynummer in 3 Schreibweisen → derselbe Kunde ─────────────────
const formen = ['0176 5551234', '+49 (0) 176-555 1234', '0049 176 5551234'];
const ids = [];
for (const [i, t] of formen.entries()) {
  r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], start: `${tagAb(20, 4)} ${['09:00', '11:00', '15:00'][i]}`, telefon: t, name: 'Nina Nummer' }), ohneAnmeldung: true });
  pruefe(r.status === 200, `13 · Buchung mit „${t}“`, r.json);
  ids.push(r.json.id);
}
const kal = (await rufe('kalender', { get: { salon: 'pasing', von: tagAb(20, 4) } })).json.termine.filter((t) => ids.includes(t.id));
pruefe(kal.length === 3 && new Set(kal.map((t) => t.kunde.id)).size === 1 && kal[0].kunde.telefon === '+491765551234', '    alle drei bei derselben Kundin, als +49 gespeichert', kal.map((t) => t.kunde));

// ── Zustände, Absage, Einwilligungen ────────────────────────────────────
const s1 = (await rufe('kalender', { get: { salon: 'pasing', von: MI } })).json.termine.find((t) => t.id === v1.id);
r = await rufe('termin_aendern', { post: { id: v1.id, version: s1.version, status: 'storniert_salon' } });
pruefe(r.status === 422 && r.json.feld === 'storno_grund', 'Absage durch den Salon nur mit Grund', r.json);
r = await rufe('termin_aendern', { post: { id: v1.id, version: s1.version, status: 'storniert_salon', storno_grund: 'Csilla ist krank' } });
pruefe(r.status === 200 && r.json.status === 'storniert_salon' && r.json.storno_grund === 'Csilla ist krank', '    abgesagt mit Grund');
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, person: 'csilla', von: MI, tage: 1 }, ohneAnmeldung: true });
pruefe(hat(r.json, MI, '15:00'), '    die Zeit ist sofort wieder frei');
r = await rufe('termin_aendern', { post: { id: v1.id, version: r.json && s1.version + 1, status: 'gebucht' } });
pruefe(r.status === 200 && r.json.status === 'gebucht', '    wiederbeleben geht, wenn der Platz noch frei ist (über bucheTermin)', r.json);
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], start: `${FR} 09:00`, telefon: '0176 7778888', einwilligungen: { recall: true, terminnachrichten: false } }), ohneAnmeldung: true });
pruefe(r.status === 200, 'Buchung mit Recall-Einwilligung');
const kid = (await rufe('kalender', { get: { salon: 'pasing', von: FR } })).json.termine.find((t) => t.id === r.json.id).kunde.id;
r = await rufe('kunde', { get: { id: kid } });
pruefe(r.json.einwilligungen.recall?.erteilt === true && r.json.einwilligungen.terminnachrichten === null, '    gespeichert mit Zeit und Quelle; der leere Haken zählt nicht', r.json.einwilligungen);

// ── Selbstcheck, Gesundheit, Export, Rollen, Sofortmeldung ──────────────
r = await rufe('selbstcheck', { get: { schluessel: 'cron-123' }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.ok === true && r.json.ueberschneidungen.length === 0, 'Nächtlicher Selbstcheck: keine Überschneidung', r.json);
r = await rufe('selbstcheck', { get: { schluessel: 'falsch' }, ohneAnmeldung: true });
pruefe(r.status === 403, '    nur mit Cron-Schlüssel');
r = await rufe('gesund', { ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.ok === true, 'Gesundheitscheck für die Überwachung');
for (const was of ['kunden', 'termine', 'protokoll', 'einwilligungen']) {
  r = await rufe('export', { get: { was } });
  pruefe(r.status === 200 && /^Nr;/.test(r.text.replace(/^\uFEFF/, '')) && r.text.split('\n').length > 2 && !r.text.includes("'+49"), `CSV-Export „${was}“`, r.text.slice(0, 200));
}
r = await rufe('stand', { get: { seit: 0 } });
pruefe(r.json.ereignisse?.some((e) => e.aktion === 'termin_angelegt') && r.json.letztes > 0, 'Sofortmeldung: Online-Buchungen erscheinen im Studio', r.json);
r = await rufe('person_speichern', { post: { ...team.find((p) => p.id === 'csilla'), anmeldename: 'empfang', passwort: 'empfang-passwort-1', rolle: 'rezeption' } });
pruefe(r.status === 200, 'Eigener Zugang für die Rezeption');
const chefin = cookie;
r = await rufe('anmelden', { post: { anmeldename: 'empfang', passwort: 'empfang-passwort-1' } });
csrf = (await rufe('studio_status')).json.csrf;
r = await rufe('export', { get: { was: 'termine' } });
pruefe(r.status === 200, '    Rezeption darf exportieren');
r = await rufe('abwesenheit_speichern', { post: { salon: 'grosshadern', von: `${tagAb(30, 3)} 00:00`, bis: `${tagAb(30, 3)} 23:55`, art: 'geschlossen' } });
pruefe(r.status === 200, '    und salonweite Schließtage setzen');
r = await rufe('einstellungen_speichern', { post: { raster: 5 } });
pruefe(r.status === 403, '    aber keine Einstellungen ändern');
cookie = chefin;

// Zum Schluss: Nach allem darf es nirgends eine Doppelbelegung geben.
r = await rufe('selbstcheck', { get: { schluessel: 'cron-123' }, ohneAnmeldung: true });
pruefe(r.json.ok === true && r.json.ueberschneidungen.length === 0 && r.json.belegung_ohne_termin.length === 0 && r.json.termin_ohne_belegung.length === 0,
  'Abschluss-Selbstcheck: keine Überschneidung, Belegung stimmt', r.json);

console.log(`\n${ok} Pflicht-Prüfungen bestanden.`);

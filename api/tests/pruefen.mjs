// Prüfung der Termin-Schnittstelle gegen einen laufenden Server mit frischer
// Datenbank. Aufruf (aus der Projektwurzel):
//   IRMONHAIR_KONFIG=/pfad/test-config.php PHP_CLI_SERVER_WORKERS=8 php -S 127.0.0.1:8098 &
//   node api/tests/pruefen.mjs http://127.0.0.1:8098/api/ testschluessel
// Die Test-Konfiguration braucht einrichtungs_schluessel, cron_schluessel und
// 'erlaubte_herkunft' => ['http://andere.test'].
// Bricht beim ersten Fehler ab und nennt ihn.

const API = process.argv[2] || 'http://127.0.0.1:8098/api/';
const SCHLUESSEL = process.argv[3] || 'testschluessel-123456';
let ok = 0;

function pruefe(bedingung, text, daten) {
  if (!bedingung) {
    console.error('✗ ' + text + (daten !== undefined ? '\n  ' + JSON.stringify(daten).slice(0, 800) : ''));
    process.exit(1);
  }
  ok++;
  console.log('✓ ' + text);
}

let cookie = '';
let csrf = '';
async function rufe(a, { get, post, kopf = {} } = {}) {
  const url = new URL(API);
  url.searchParams.set('a', a);
  for (const [k, v] of Object.entries(get || {})) url.searchParams.set(k, v);
  const h = { ...kopf };
  if (cookie) h.Cookie = cookie;
  if (csrf) h['X-CSRF'] = csrf;
  let body;
  if (post !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(post); }
  const r = await fetch(url, { method: post !== undefined ? 'POST' : 'GET', headers: h, body });
  const sc = r.headers.get('set-cookie');
  if (sc) { const m = sc.match(/ih_studio=([^;]*)/); if (m) cookie = m[1] ? 'ih_studio=' + m[1] : ''; }
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { roh: text }; }
  return { status: r.status, json, kopf: r.headers };
}

// Ein Dienstag mindestens 8 Tage voraus: Pasing und Großhadern haben offen.
const tag = (() => {
  const d = new Date(); d.setDate(d.getDate() + 8);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
})();
const tag2 = (() => { const d = new Date(tag + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
const hat = (frei, d, t, p) => (frei.tage[d]?.zeiten || []).some((z) => z.t === t && (!p || z.p.includes(p)));
let n = 0;
const buchung = (x) => ({ name: 'Anna Test', telefon: '0176 100000' + (n++ % 10), einwilligung: true, anfrage_id: 'test-' + Math.random().toString(36).slice(2) + Date.now(), ...x });

// ── Katalog ──────────────────────────────────────────────────────────
let r = await rufe('katalog');
pruefe(r.status === 200 && r.json.salons.length === 2, 'Katalog: zwei Salons');
const kat = r.json;
pruefe(kat.personen.some((p) => p.id === 'bedia' && p.salons.length === 2), 'Bedia arbeitet in beiden Salons');
pruefe(!kat.personen.some((p) => p.id === 'benny'), 'Benny (bei Planity verborgen) ist online nicht wählbar');
const schnitt = kat.leistungen.find((l) => l.salon === 'pasing' && l.name === 'Waschen, Schneiden, Föhnen' && l.laenge === 'lang');
const balayage = kat.leistungen.find((l) => l.salon === 'pasing' && l.name === 'Balayage & Styling' && l.laenge === 'kurz');
const waschen = kat.leistungen.find((l) => l.salon === 'pasing' && l.name === 'Waschen & Föhnen' && l.laenge === 'kurz');
const gSchnitt = kat.leistungen.find((l) => l.salon === 'grosshadern' && l.gruppe === 'schnitt');
pruefe(schnitt && schnitt.dauer === 75 && schnitt.preis_cent === 8000, 'Schnitt lang: 75 Min., 80 €', schnitt);
pruefe(balayage && balayage.dauer === 150 && balayage.einwirken === 60, 'Balayage: 150 Min., davon 60 Einwirkzeit', balayage);
pruefe(!kat.leistungen.some((l) => l.name === 'Permanent Make-up'), 'Leistungen „auf Anfrage“ sind nicht online');

// ── Freie Zeiten und Buchung ────────────────────────────────────────
r = await rufe('frei', { get: { salon: 'pasing', leistungen: schnitt.id, von: tag, tage: 7 } });
pruefe(r.status === 200 && hat(r.json, tag, '09:00', 'tina'), 'Dienstag 9:00 ist Tina frei', r.json.tage[tag]);
pruefe(r.json.tage[tag].zeiten.at(-1).t === '17:15', 'Letzter Start 17:15 (75 Min. bis 18:30)', r.json.tage[tag].zeiten.at(-1));
const montag = Object.keys(r.json.tage).find((d) => new Date(d + 'T12:00:00').getDay() === 1);
pruefe(r.json.tage[montag].zu === true, 'Pasing montags geschlossen');

r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], person: 'tina', start: `${tag} 10:00`, email: 'anna@example.org', notiz: 'Erster Besuch' }) });
pruefe(r.status === 200 && r.json.person === 'tina' && r.json.token.length === 32, 'Buchung bei Tina um 10:00', r.json);
const t1 = r.json;
r = await rufe('frei', { get: { salon: 'pasing', leistungen: schnitt.id, person: 'tina', von: tag, tage: 1 } });
pruefe(!hat(r.json, tag, '10:00') && !hat(r.json, tag, '09:00') && hat(r.json, tag, '11:15') && hat(r.json, tag, '08:45') === false, 'Tina 9:00–11:00 blockiert, 11:15 frei');
pruefe(hat(r.json, tag, '08:45') === false && !hat(r.json, tag, '09:30'), '9:30 überschneidet sich');

// Lücke füllen: direkt nach dem Termin (11:15) wird angeboten, auch wenn 11:15 im Raster liegt.
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, person: 'tina', von: tag, tage: 1 } });
pruefe(hat(r.json, tag, '09:30') && hat(r.json, tag, '11:15'), 'Waschen (30 Min.) passt 9:30 vor den Termin und 11:15 danach');

// ── Einwirkzeit ─────────────────────────────────────────────────────
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [balayage.id], person: 'csilla', start: `${tag} 13:00` }) });
pruefe(r.status === 200, 'Balayage bei Csilla 13:00 (Arbeit 13:00–13:30, Einwirken bis 14:30)', r.json);
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, person: 'csilla', von: tag, tage: 1 } });
pruefe(hat(r.json, tag, '13:30') && hat(r.json, tag, '14:00') && !hat(r.json, tag, '13:15') && !hat(r.json, tag, '14:15'), 'In der Einwirkzeit ist Csilla für 30 Min. frei (13:30, 14:00), nicht 13:15 oder 14:15', r.json.tage[tag].zeiten.map((z) => z.t));
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [waschen.id], person: 'csilla', start: `${tag} 13:30` }) });
pruefe(r.status === 200, 'Buchung in der Einwirkzeit klappt');

// ── Doppelt abgeschickt ─────────────────────────────────────────────
const doppel = buchung({ salon: 'pasing', leistungen: [schnitt.id], person: 'bedia', start: `${tag} 15:00` });
const mehrfach = await Promise.all(Array.from({ length: 8 }, () => rufe('buchen', { post: doppel })));
pruefe(mehrfach.every((x) => x.status === 200 && x.json.id === mehrfach[0].json.id), 'Achtmal gleichzeitig abgeschickt = ein Termin', mehrfach.map((x) => x.json.id || x.json.code));

// ── Gleichzeitig: 20 wollen denselben Platz ─────────────────────────
const wett = await Promise.all(Array.from({ length: 20 }, (_, i) => rufe('buchen', {
  post: buchung({ salon: 'pasing', leistungen: [schnitt.id], person: 'tina', start: `${tag2} 11:00`, telefon: '0151 2000' + String(i).padStart(3, '0') }),
})));
const gewonnen = wett.filter((x) => x.status === 200).length;
pruefe(gewonnen === 1 && wett.filter((x) => x.status === 409).length === 19, `20 gleichzeitig auf einen Platz: genau 1 Termin (${gewonnen})`, wett.map((x) => x.status));

// „Egal wer“: 10 gleichzeitig um 16:00 → drei Personen online in Pasing.
const wett2 = await Promise.all(Array.from({ length: 10 }, (_, i) => rufe('buchen', {
  post: buchung({ salon: 'pasing', leistungen: [schnitt.id], start: `${tag2} 16:00`, telefon: '0152 3000' + String(i).padStart(3, '0') }),
})));
const wer = wett2.filter((x) => x.status === 200).map((x) => x.json.person).sort();
pruefe(wer.join() === 'bedia,csilla,tina', '10 gleichzeitig „egal wer“: jede der drei genau einmal', wett2.map((x) => [x.status, x.json.person || x.json.code]));

// ── Salonübergreifend: Bedia ────────────────────────────────────────
const gs = kat.leistungen.find((l) => l.salon === 'grosshadern' && l.personen.includes('bedia') && l.dauer >= 30);
r = await rufe('buchen', { post: buchung({ salon: 'grosshadern', leistungen: [gs.id], person: 'bedia', start: `${tag} 11:00` }) });
pruefe(r.status === 200, 'Bedia in Großhadern 11:00');
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, person: 'bedia', von: tag, tage: 1 } });
pruefe(!hat(r.json, tag, '11:00'), 'Dann ist Bedia um 11:00 in Pasing nicht frei');

// ── Prüfungen der Eingaben ──────────────────────────────────────────
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], start: `${tag} 17:15`, telefon: '12' }) });
pruefe(r.status === 422 && r.json.feld === 'telefon', 'Unlesbare Nummer wird abgelehnt', r.json);
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], start: `${tag} 17:15`, einwilligung: false }) });
pruefe(r.status === 422 && r.json.feld === 'einwilligung', 'Ohne Datenschutz-Hinweis keine Buchung');
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], start: `${tag} 17:15`, webseite: 'http://spam' }) });
pruefe(r.status === 422, 'Falle für Roboter greift');
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], start: `${tag} 17:20` }) });
pruefe(r.status === 409, 'Zeit außerhalb des Angebots (17:20 → 18:35) wird abgelehnt', r.json);
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [gSchnitt.id], start: `${tag} 12:00` }) });
pruefe(r.status === 422, 'Leistung aus dem anderen Salon wird abgelehnt');
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], person: 'benny', start: `${tag} 12:00` }) });
pruefe(r.status === 422, 'Nicht online buchbare Person wird abgelehnt');
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], start: new Date(Date.now() + 5 * 60000).toISOString().slice(0, 10) + ' 23:45' }) });
pruefe(r.status === 409 || r.status === 422, 'Heute nach Ladenschluss geht nicht');

// Zu viele offene Termine unter einer Nummer.
const viel = (h) => buchung({ salon: 'pasing', leistungen: [waschen.id], start: `${tag2} ${h}`, telefon: '0160 9999999' });
for (const h of ['09:00', '09:30', '10:00']) await rufe('buchen', { post: viel(h) });
r = await rufe('buchen', { post: viel('10:30') });
pruefe(r.status === 409 && r.json.code === 'zu_viele', 'Vierter offener Termin unter derselben Nummer: bitte anrufen');

// ── Termin ansehen, umbuchen, absagen ──────────────────────────────
r = await rufe('termin', { get: { t: t1.token } });
pruefe(r.status === 200 && r.json.storno_moeglich && r.json.salon.name === 'Pasing' && !('kunde' in r.json), 'Termin über den Link lesbar, ohne Kundendaten');
r = await rufe('buchen', { post: buchung({ salon: 'pasing', leistungen: [schnitt.id], person: 'tina', start: `${tag} 10:15`, ersetzt: t1.token, telefon: '0176 1000000' }) });
pruefe(r.status === 200 && r.json.start.endsWith('10:15'), 'Umbuchen auf 10:15 (überlappt den alten Platz) klappt', r.json);
const t1b = r.json;
r = await rufe('termin', { get: { t: t1.token } });
pruefe(r.json.status === 'storniert', 'Der alte Termin ist storniert');
r = await rufe('stornieren', { post: { t: t1b.token } });
pruefe(r.status === 200 && r.json.status === 'storniert', 'Absagen über den Link');
r = await rufe('frei', { get: { salon: 'pasing', leistungen: schnitt.id, person: 'tina', von: tag, tage: 1 } });
pruefe(hat(r.json, tag, '10:00'), 'Nach der Absage ist 10:00 wieder frei');
r = await rufe('termin', { get: { t: 'f'.repeat(32) } });
pruefe(r.status === 404, 'Unbekannter Link: 404');

// ── CORS ────────────────────────────────────────────────────────────
r = await rufe('katalog', { kopf: { Origin: 'http://andere.test' } });
pruefe(r.kopf.get('access-control-allow-origin') === 'http://andere.test', 'Erlaubte Herkunft bekommt CORS');
r = await rufe('katalog', { kopf: { Origin: 'http://boese.test' } });
pruefe(!r.kopf.get('access-control-allow-origin'), 'Fremde Herkunft nicht');
r = await rufe('kalender', { get: { salon: 'pasing', von: tag }, kopf: { Origin: 'http://andere.test' } });
pruefe(r.status === 401 && !r.kopf.get('access-control-allow-origin'), 'Studio ohne Anmeldung: 401, kein CORS');

// ── Studio: Einrichtung und Anmeldung ──────────────────────────────
r = await rufe('studio_status');
pruefe(r.json.eingerichtet === false && r.json.personen.length >= 8, 'Studio noch nicht eingerichtet');
r = await rufe('einrichten', { post: { schluessel: 'falsch', person: 'bedia', anmeldename: 'Bedia', passwort: 'sehr-geheim-123' } });
pruefe(r.status === 403, 'Falscher Einrichtungsschlüssel: 403');
r = await rufe('einrichten', { post: { schluessel: SCHLUESSEL, person: 'bedia', anmeldename: 'Bedia', passwort: 'kurz' } });
pruefe(r.status === 422, 'Zu kurzes Passwort: 422');
r = await rufe('einrichten', { post: { schluessel: SCHLUESSEL, person: 'bedia', anmeldename: 'Bedia', passwort: 'sehr-geheim-123' } });
pruefe(r.status === 200 && cookie, 'Eingerichtet und angemeldet');
r = await rufe('studio_status');
pruefe(r.json.angemeldet?.rolle === 'inhaberin' && r.json.csrf && r.json.stammdaten.leistungen.length > 100, 'Status: Inhaberin, Stammdaten da');
csrf = r.json.csrf;
r = await rufe('einrichten', { post: { schluessel: SCHLUESSEL, person: 'tina', anmeldename: 'x', passwort: 'sehr-geheim-123' } });
pruefe(r.status === 409, 'Einrichtung geht nur einmal');

// CSRF
const merk = csrf; csrf = '';
r = await rufe('kunde_speichern', { post: { vorname: 'X' } });
pruefe(r.status === 403 && r.json.code === 'csrf', 'Ohne CSRF-Schlüssel: 403');
csrf = merk;

// ── Studio: Kalender ───────────────────────────────────────────────
r = await rufe('kalender', { get: { salon: 'pasing', von: tag, bis: tag2 } });
pruefe(r.status === 200 && r.json.termine.length >= 6 && r.json.arbeitszeiten.tina, 'Kalender Pasing: Termine und Arbeitszeiten', r.json.termine.length);
const ersterTermin = r.json.termine.find((t) => t.kunde);
pruefe(ersterTermin.kunde.telefon.startsWith('+49') && ersterTermin.kunde.telefon_text.startsWith('01'), 'Telefon als +49 gespeichert, lesbar angezeigt', ersterTermin.kunde);
pruefe(r.json.woanders.some((w) => w.person === 'bedia' && w.salon === 'grosshadern'), 'Bedias Termin in Großhadern erscheint in Pasing als belegt');
const stand1 = (await rufe('stand')).json.stand;

r = await rufe('termin_neu', { post: { salon: 'pasing', person: 'tina', leistungen: [schnitt.id], start: `${tag} 11:30`, kunde: { name: 'Berta Beispiel', telefon: '+49 (0) 171 5550001', email: 'Berta@Example.org' }, quelle: 'telefon' } });
pruefe(r.status === 200 && r.json.kunde.telefon === '+491715550001' && r.json.kunde.email === 'berta@example.org', 'Studio: Termin mit neuer Kundin, Nummer und E-Mail sauber', r.json);
const t2 = r.json;
pruefe((await rufe('stand')).json.stand > stand1, 'Stand zählt hoch (andere Geräte laden nach)');
r = await rufe('termin_neu', { post: { salon: 'pasing', person: 'tina', leistungen: [schnitt.id], start: `${tag} 12:00`, kunde: { name: 'Clara C' } } });
pruefe(r.status === 409 && r.json.code === 'konflikt' && r.json.konflikte[0].text.includes('Berta'), 'Überschneidung wird gemeldet, mit Namen', r.json);
r = await rufe('termin_neu', { post: { salon: 'pasing', person: 'tina', leistungen: [schnitt.id], start: `${tag} 12:00`, kunde: { name: 'Clara C' }, trotzdem: true } });
pruefe(r.status === 200, 'Mit „trotzdem“ geht es (bewusste Doppelbelegung)');
const t3 = r.json;
r = await rufe('termin_neu', { post: { salon: 'pasing', person: 'tina', leistungen: [schnitt.id], start: `${tag} 18:00`, kunde: { name: 'Spät' } } });
pruefe(r.status === 409 && r.json.konflikte[0].art === 'ausserhalb', 'Nach Feierabend: „außerhalb der Arbeitszeit“');

// Verschieben mit Versionsschutz
r = await rufe('termin_aendern', { post: { id: t3.id, version: t3.version, start: `${tag} 14:30`, person: 'csilla' } });
pruefe(r.status === 409, 'Verschieben auf Csilla 14:30 kollidiert mit Waschen 13:30? nein — mit Balayage-Arbeit 14:30', r.json);
r = await rufe('termin_aendern', { post: { id: t3.id, version: t3.version, start: `${tag} 15:30`, person: 'csilla' } });
pruefe(r.status === 200 && r.json.person === 'csilla' && r.json.version === t3.version + 1, 'Verschoben zu Csilla 15:30', r.json);
r = await rufe('termin_aendern', { post: { id: t3.id, version: t3.version, status: 'erschienen' } });
pruefe(r.status === 409 && r.json.code === 'veraltet' && r.json.termin, 'Alte Version: 409 mit aktuellem Stand');
r = await rufe('termin_aendern', { post: { id: t3.id, version: t3.version + 1, phasen: [['arbeit', 30], ['pause', 20], ['arbeit', 25]] } });
pruefe(r.status === 200 && r.json.ende.endsWith('16:45'), 'Dauer mit Einwirkzeit angepasst (bis 16:45)', r.json);
r = await rufe('termin_verlauf', { get: { id: t3.id } });
pruefe(r.json.verlauf.length >= 3 && r.json.verlauf.some((v) => v.daten?.person_id), 'Verlauf zeigt Wer/Was', r.json.verlauf);

r = await rufe('vorschlaege', { post: undefined, get: { salon: 'pasing', von: tag } });
pruefe(r.status === 422, 'Vorschläge ohne Leistung: 422');

// ── Abwesenheit ────────────────────────────────────────────────────
r = await rufe('abwesenheit_speichern', { post: { person: 'tina', von: `${tag2} 12:00`, bis: `${tag2} 13:00`, art: 'pause' } });
pruefe(r.status === 200, 'Mittagspause für Tina');
const abw = r.json.id;
r = await rufe('frei', { get: { salon: 'pasing', leistungen: waschen.id, person: 'tina', von: tag2, tage: 1 } });
pruefe(!hat(r.json, tag2, '12:00') && !hat(r.json, tag2, '12:30') && hat(r.json, tag2, '13:00'), 'Pause blockiert online 12:00–13:00');
r = await rufe('abwesenheit_speichern', { post: { person: 'tina', von: `${tag} 00:00`, bis: `${tag2} 00:00`, art: 'krank' } });
pruefe(r.status === 200 && r.json.betroffen.length >= 1, 'Krankmeldung zeigt betroffene Termine', r.json.betroffen.length);
await rufe('abwesenheit_loeschen', { post: { id: r.json.id } });
await rufe('abwesenheit_loeschen', { post: { id: abw } });

// ── Kunden ─────────────────────────────────────────────────────────
r = await rufe('kunden', { get: { q: '0171 555' } });
pruefe(r.json.kunden.length === 1 && r.json.kunden[0].nachname === 'Beispiel', 'Suche nach „0171 555“ findet Berta');
r = await rufe('kunden', { get: { q: 'berta beisp' } });
pruefe(r.json.kunden.length === 1, 'Suche nach Namensteilen');
r = await rufe('kunde_speichern', { post: { vorname: 'Doppel', nachname: 'Gänger', telefon: '0171-5550001' } });
pruefe(r.status === 409 && r.json.code === 'doppelt', 'Gleiche Nummer: Hinweis auf Doppelte');
r = await rufe('kunde_speichern', { post: { vorname: 'Doppel', nachname: 'Gänger', telefon: '0171-5550001', trotzdem: true } });
const dop = r.json.id;
r = await rufe('kunden', { get: { q: 'gaenger' } });
pruefe(r.json.kunden.length === 1, 'Umlaute: „gaenger“ findet „Gänger“');
r = await rufe('kunden_zusammenfuehren', { post: { ziel: t2.kunde.id, quelle: dop } });
pruefe(r.status === 200, 'Zusammengeführt');
r = await rufe('kunde', { get: { id: t2.kunde.id } });
pruefe(r.json.termine.length === 1 && r.json.doppelt.length === 0, 'Kundenkarte mit Terminen, keine Doppelten mehr');
r = await rufe('kunde_auskunft', { get: { id: t2.kunde.id } });
pruefe(r.json.kunde.email === 'berta@example.org' && !r.json.termine[0].token, 'Auskunft enthält Daten, keine Zugangsschlüssel');
r = await rufe('kunde_loeschen', { post: { id: t2.kunde.id } });
r = await rufe('kalender', { get: { salon: 'pasing', von: tag } });
const anonym = r.json.termine.find((t) => t.id === t2.id);
pruefe(anonym && anonym.kunde.geloescht && !anonym.kunde.telefon && !anonym.gast_name, 'Gelöscht: Termin bleibt, ohne Personendaten');

// ── Team und Leistungen ────────────────────────────────────────────
r = await rufe('team');
const tina = r.json.personen.find((p) => p.id === 'tina');
pruefe(tina && tina.arbeitszeiten.length === 5 && !('pass_hash' in tina), 'Team: Tina mit 5 Arbeitstagen, kein Hash');
r = await rufe('person_speichern', { post: { ...tina, anmeldename: 'tina', passwort: 'tina-passwort-1', arbeitszeiten: tina.arbeitszeiten.filter((z) => z.tag !== 2) } });
pruefe(r.status === 200, 'Tina: dienstags frei, Passwort gesetzt');
r = await rufe('frei', { get: { salon: 'pasing', leistungen: schnitt.id, person: 'tina', von: tag, tage: 1 } });
pruefe(r.json.tage[tag].zu === true, 'Tina dienstags nicht mehr buchbar');
r = await rufe('leistung_speichern', { post: { salon: 'pasing', gruppe: 'schnitt', name: 'Pony schneiden', phasen: [['arbeit', 15]], preis_cent: 1500, personen: ['csilla'] } });
pruefe(r.status === 200, 'Neue Leistung angelegt');
r = await rufe('katalog');
pruefe(r.json.leistungen.some((l) => l.name === 'Pony schneiden' && l.personen.join() === 'csilla'), 'Neue Leistung sofort online');
r = await rufe('frei', { get: { salon: 'pasing', leistungen: schnitt.id, person: 'csilla', von: tag2, tage: 1 } });
const nachTermin = r.json.tage[tag2].zeiten.map((z) => z.t);
r = await rufe('einstellungen_speichern', { post: { raster: 30 } });
pruefe(r.status === 200 && r.json.raster === 30, 'Raster auf 30 Minuten');
r = await rufe('frei', { get: { salon: 'pasing', leistungen: schnitt.id, person: 'csilla', von: tag2, tage: 1 } });
const ungerade = r.json.tage[tag2].zeiten.filter((z) => !/:(00|30)$/.test(z.t)).map((z) => z.t);
pruefe(ungerade.length === 1 && ungerade[0] === '17:15' && nachTermin.includes('17:15'), 'Im 30-Minuten-Raster nur noch :00/:30 — und 17:15 direkt nach Csillas Termin (Lücke füllen)', ungerade);
await rufe('einstellungen_speichern', { post: { luecken_fuellen: false } });
r = await rufe('frei', { get: { salon: 'pasing', leistungen: schnitt.id, person: 'csilla', von: tag2, tage: 1 } });
pruefe(r.json.tage[tag2].zeiten.every((z) => /:(00|30)$/.test(z.t)), 'Ohne Lückenfüllung nur Raster');
await rufe('einstellungen_speichern', { post: { raster: 15, luecken_fuellen: true } });

r = await rufe('auswertung', { get: { von: tag, bis: tag2 } });
pruefe(r.status === 200 && r.json.summe.termine > 5 && r.json.summe.online > 3, 'Auswertung zählt Termine', r.json.summe);
r = await rufe('protokoll');
pruefe(r.json.eintraege.length > 10, 'Protokoll geführt');
const sich = await fetch(API + '?a=sicherung', { headers: { Cookie: cookie } });
const sj = await sich.json();
pruefe(sj.tabellen.termin.length > 5 && !sj.tabellen.person[0].pass_hash, 'Sicherung komplett, ohne Passwörter');

// Rolle Team darf keine Einstellungen
const inhaberinCookie = cookie;
await rufe('abmelden', { post: {} });
r = await rufe('anmelden', { post: { anmeldename: 'Tina', passwort: 'falsch-falsch' } });
pruefe(r.status === 401, 'Falsches Passwort: 401');
r = await rufe('anmelden', { post: { anmeldename: 'Tina', passwort: 'tina-passwort-1' } });
pruefe(r.status === 200, 'Tina meldet sich an');
csrf = (await rufe('studio_status')).json.csrf;
r = await rufe('einstellungen_speichern', { post: { raster: 5 } });
pruefe(r.status === 403, 'Team darf keine Einstellungen ändern');
r = await rufe('kunde_loeschen', { post: { id: 1 } });
pruefe(r.status === 403, 'Team darf keine Kunden löschen');
r = await rufe('kalender', { get: { salon: 'pasing', von: tag } });
pruefe(r.status === 200, 'Team sieht den Kalender');
cookie = inhaberinCookie;

r = await rufe('erinnern', { get: { schluessel: 'falsch' } });
pruefe(r.status === 403, 'Cron mit falschem Schlüssel: 403');
r = await rufe('erinnern', { get: { schluessel: 'cron-123' } });
pruefe(r.status === 200, 'Cron läuft (ohne Postversand)');

console.log(`\n${ok} Prüfungen bestanden.`);

// Nachrichten, Recall, Warteliste, Kampagnen, Codes, Gutscheine, Treue,
// Fotos, Lager, Import, Buchhaltung — gegen einen laufenden Server mit
// FRISCHER Datenbank, SMS und E-Mail im Vorführmodus (nichts geht hinaus):
//   'post' => ['aktiv' => true, 'versand' => 'vorfuehrung', 'absender' => 'termine@example.test'],
//   'sms'  => ['aktiv' => true, 'anbieter' => 'vorfuehrung', 'absender' => '+4915112345678', 'eingang_schluessel' => 'eingang-123'],
//   IRMONHAIR_KONFIG=/pfad/config.php php -S 127.0.0.1:8099 &
//   IRMONHAIR_KONFIG=/pfad/config.php node api/tests/nachrichten.mjs http://127.0.0.1:8099/api/
// Zeiten werden für Erinnerung und Recall direkt in der Test-Datenbank
// verschoben (api/tests/db.php, nur Kommandozeile, nur SQLite).
import { execFileSync } from 'node:child_process';
import { feiertage } from './pruefen-hilfe.mjs';

const API = process.argv[2] || 'http://127.0.0.1:8099/api/';
const SCHLUESSEL = process.argv[3] || 'testschluessel-123456';
const CRON = process.argv[4] || 'cron-123';
let ok = 0;
function pruefe(bedingung, text, daten) {
  if (!bedingung) {
    console.error('✗ ' + text + (daten !== undefined ? '\n  ' + JSON.stringify(daten).slice(0, 1200) : ''));
    process.exit(1);
  }
  ok++;
  console.log('✓ ' + text);
}
let cookie = '', csrf = '';
async function rufe(a, { get, post, ohneAnmeldung, form, roh } = {}) {
  const url = new URL(API);
  url.searchParams.set('a', a);
  for (const [k, v] of Object.entries(get || {})) url.searchParams.set(k, v);
  const h = {};
  if (cookie && !ohneAnmeldung) { h.Cookie = cookie; h['X-CSRF'] = csrf; }
  let body;
  if (form !== undefined) { h['Content-Type'] = 'application/x-www-form-urlencoded'; body = form; }
  else if (post !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(post); }
  const r = await fetch(url, { method: body !== undefined ? 'POST' : 'GET', headers: h, body });
  const sc = r.headers.get('set-cookie');
  if (sc) { const m = sc.match(/ih_studio=([^;]*)/); if (m) cookie = m[1] ? 'ih_studio=' + m[1] : ''; }
  if (roh) return { status: r.status, typ: r.headers.get('content-type'), buf: Buffer.from(await r.arrayBuffer()) };
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { roh: text }; }
  return { status: r.status, json, text };
}
const db = (sql, ...werte) => JSON.parse(execFileSync('php', ['api/tests/db.php', sql, ...werte.map(String)], { env: process.env }).toString());
const iso = (d) => d.toISOString().slice(0, 10);
const istFeiertag = (s) => feiertage(+s.slice(0, 4)).has(s);
function tagAb(n, wochentag) {
  const d = new Date(); d.setDate(d.getDate() + n);
  while (d.getDay() !== wochentag || istFeiertag(iso(d))) d.setDate(d.getDate() + 1);
  return iso(d);
}
const zeit = (ms) => { const d = new Date(ms); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`; };
/** Termin in der Datenbank verschieben (Beginn = jetzt + minuten), Belegung mit. */
function verschiebe(id, minutenAbJetzt, status) {
  const t = db('SELECT start, ende FROM {p}termin WHERE id = ?', id)[0];
  const dauer = new Date(t.ende.replace(' ', 'T')) - new Date(t.start.replace(' ', 'T'));
  const neu = Math.floor((Date.now() + minutenAbJetzt * 60000) / 300000) * 300000;
  const versatz = neu - new Date(t.start.replace(' ', 'T')).getTime();
  db('UPDATE {p}termin SET start = ?, ende = ?, start_utc = NULL, ende_utc = NULL' + (status ? ', status = ?' : '') + ' WHERE id = ?',
    zeit(neu), zeit(neu + dauer), ...(status ? [status] : []), id);
  // In die Vergangenheit verschoben: dann ist er auch damals angelegt worden.
  if (minutenAbJetzt < 0) db('UPDATE {p}termin SET erstellt = ? WHERE id = ?', zeit(neu - 7 * 86400000), id);
  for (const b of db('SELECT id, start, ende FROM {p}belegung WHERE termin_id = ?', id)) {
    db('UPDATE {p}belegung SET start = ?, ende = ? WHERE id = ?', zeit(new Date(b.start.replace(' ', 'T')).getTime() + versatz), zeit(new Date(b.ende.replace(' ', 'T')).getTime() + versatz), b.id);
  }
  if (status && !['gebucht', 'erschienen'].includes(status)) db('DELETE FROM {p}belegung WHERE termin_id = ?', id);
}
const ausgang = async (get = {}) => (await rufe('nachrichten_liste', { get })).json.nachrichten;
const cron = () => rufe('nachrichten', { get: { schluessel: CRON } });
let nr = 0;
const neueId = () => 'n-' + Date.now().toString(36) + '-' + (nr++) + '-' + Math.random().toString(36).slice(2, 8);
const tel = () => '0176 5' + String(200000 + (nr++)).slice(-6);

const kat = (await rufe('katalog')).json;
const schnitt = kat.leistungen.find((l) => l.salon === 'pasing' && l.name === 'Waschen, Schneiden, Föhnen' && l.laenge === 'lang');
const waschen = kat.leistungen.find((l) => l.salon === 'pasing' && l.name === 'Waschen & Föhnen' && l.laenge === 'kurz');
pruefe(schnitt && waschen, 'Katalog: Testleistungen vorhanden');
pruefe(kat.nachrichten?.sms === true && kat.nachrichten.email === true, 'Katalog meldet SMS und E-Mail als eingerichtet', kat.nachrichten);
pruefe(Object.keys(kat.einwilligungen).join() === 'terminnachrichten,recall,angebote', 'Drei Einwilligungen mit Wortlaut, Angebote mit Bestätigungslink', kat.einwilligungen);
pruefe(kat.einwilligungen.angebote.includes('höchstens eine Nachricht im Monat') && kat.einwilligungen.recall.includes('STOP'), '    Häufigkeit und STOP stehen im Wortlaut');
pruefe(schnitt.recall_tage === 49 && kat.leistungen.some((l) => /Balayage/.test(l.name) && l.recall_tage === 77), 'Recall-Abstand je Leistung vorbelegt (Damen 7 Wo., Balayage 11 Wo.)');
pruefe(kat.nachrichten.anteil_erinnerung === null, 'Kein erfundener Anteil „so viele lassen sich erinnern“ ohne genug echte Buchungen');

const st = (await rufe('studio_status')).json;
let r = await rufe('einrichten', { post: { schluessel: SCHLUESSEL, person: st.personen[0].id, anmeldename: 'chefin', passwort: 'chefin-passwort-1' } });
pruefe(r.status === 200, 'Studio eingerichtet');
csrf = (await rufe('studio_status')).json.csrf;

// ── Buchen mit Einwilligungen ───────────────────────────────────────────
const MI = tagAb(12, 3), DO = tagAb(12, 4), FR = tagAb(12, 5);
async function freiAm(tag, leistung = waschen.id, person = 'tina') {
  const f = (await rufe('frei', { get: { salon: 'pasing', leistungen: leistung, person, von: tag, tage: 1 }, ohneAnmeldung: true })).json;
  return f.tage[tag]?.zeiten.map((z) => z.t) || [];
}
let zeiten = await freiAm(MI);
const annaTel = tel();
r = await rufe('buchen', { ohneAnmeldung: true, post: { salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${MI} ${zeiten[0]}`,
  name: 'Anna Angebot', telefon: annaTel, email: 'anna@example.test', einwilligung: true, anfrage_id: neueId(),
  einwilligungen: { terminnachrichten: true, recall: true, angebote: true } } });
pruefe(r.status === 200 && r.json.bestaetigen === true, 'Buchung mit allen drei Haken: Angebote warten auf Bestätigung', r.json);
const anna = r.json;
pruefe(anna.einwilligungen.terminnachrichten.erteilt && anna.einwilligungen.recall.erteilt && !anna.einwilligungen.angebote.erteilt && anna.einwilligungen.angebote.wartet,
  '    Terminnachrichten und Recall gelten sofort, Angebote erst nach dem Klick', anna.einwilligungen);
let post = await ausgang();
const doi = post.find((n) => n.zweck === 'doi');
pruefe(post.some((n) => n.zweck === 'bestaetigung' && n.an === 'anna@example.test' && n.status === 'gesendet'), 'Buchungsbestätigung steht im Postausgang', post.map((n) => n.zweck));
pruefe(doi && doi.status === 'gesendet' && /nachrichten\.html\?b=[a-f0-9]{32}/.test(doi.text), 'Bestätigungslink für Angebote ging sofort per E-Mail', doi);
pruefe(post.some((n) => n.zweck === 'salon'), 'Salon bekommt die Online-Buchung gemeldet');
const bTok = doi.text.match(/\?b=([a-f0-9]{32})/)[1];
r = await rufe('bestaetigen', { post: { b: bTok }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.art === 'angebote' && /^\d+\.[a-f0-9]{24}$/.test(r.json.k), 'Klick auf den Link: Angebote bestätigt', r.json);
const annaK = r.json.k;
r = await rufe('bestaetigen', { post: { b: bTok }, ohneAnmeldung: true });
pruefe(r.status === 200, '    zweiter Klick schadet nicht');
r = await rufe('bestaetigen', { post: { b: 'f'.repeat(32) }, ohneAnmeldung: true });
pruefe(r.status === 404, '    falscher Link → 404');
const annaId = +annaK.split('.')[0];
r = await rufe('kunde', { get: { id: annaId } });
pruefe(r.json.einwilligungen.angebote?.erteilt === true, '    in der Kundenkarte: Angebote ja', r.json.einwilligungen);
pruefe(db("SELECT quelle FROM {p}einwilligung WHERE kunde_id = ? AND art = 'angebote'", annaId)[0].quelle.startsWith('bestaetigt'), '    mit Quelle „bestätigt“');

// Nach dem Buchen einschalten (zweite Chance auf der Bestätigungsseite).
zeiten = await freiAm(MI);
r = await rufe('buchen', { ohneAnmeldung: true, post: { salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${MI} ${zeiten[0]}`,
  name: 'Berta Danach', telefon: tel(), einwilligung: true, anfrage_id: neueId(), einwilligungen: {} } });
pruefe(r.status === 200 && !r.json.einwilligungen.terminnachrichten, 'Buchung ohne Haken: keine Einwilligung', r.json.einwilligungen);
const berta = r.json;
r = await rufe('einwilligung', { post: { t: berta.token, art: 'terminnachrichten' }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.einwilligungen.terminnachrichten.erteilt, '„Erinnerung per SMS einschalten?“ nach dem Buchen wirkt', r.json.einwilligungen);
pruefe(db("SELECT quelle FROM {p}einwilligung WHERE termin_id = ? AND art = 'terminnachrichten'", berta.id)[0]?.quelle === 'online_danach', '    gespeichert mit Quelle „online_danach“');
r = await rufe('einwilligung', { post: { t: '0'.repeat(32), art: 'recall' }, ohneAnmeldung: true });
pruefe(r.status === 404, '    ohne gültigen Termin-Link → 404');

// ── Kampagne (vor dem Abmelden) ─────────────────────────────────────────
const kText = 'Hallo {vorname}, im November 15 % auf Olaplex. Termin: {link}';
r = await rufe('kampagne_vorschau', { post: { kanal: 'sms', text: kText } });
pruefe(r.status === 200 && r.json.anzahl === 1 && r.json.mit_einwilligung === 1, 'Kampagne: nur wer Angeboten zugestimmt hat (1)', r.json);
pruefe(r.json.sms_text.endsWith('Abmelden: STOP') && r.json.teile === 1, '    SMS endet mit „Abmelden: STOP“, ein SMS-Teil', r.json);
r = await rufe('kampagne_senden', { post: { kanal: 'sms', text: kText, anzahl: 1, titel: 'Olaplex November' } });
pruefe(r.status === 200 && r.json.anzahl === 1, 'Kampagne eingereiht', r.json);
const kampagneId = r.json.id;
post = await ausgang({ zweck: 'kampagne' });
pruefe(post.length === 1 && post[0].text.includes('ref=kampagne-' + kampagneId) && post[0].text.endsWith('Abmelden: STOP'), '    Link mit Herkunft, STOP am Ende', post[0]);
const nv = post[0].nicht_vor;
const nvMin = +nv.slice(11, 13) * 60 + +nv.slice(14, 16);
const nvTag = new Date(nv.slice(0, 10) + 'T12:00:00').getDay();
pruefe(nvMin >= 540 && nvMin < 1200 && nvTag !== 0, '    Werbung nur zwischen 9 und 20 Uhr, nie sonntags', nv);
r = await rufe('kampagne_vorschau', { post: { kanal: 'sms', text: kText } });
pruefe(r.json.anzahl === 0 && r.json.monat_schon === 1, '    zweite Kampagne im selben Monat: ausgeschlossen (höchstens eine im Monat)', r.json);
r = await rufe('kampagne_senden', { post: { kanal: 'sms', text: kText, anzahl: 0 } });
pruefe(r.status === 409, '    leere Auswahl → nicht gesendet', r.json);

// ── Ihre Nachrichten: einzeln abbestellen, alles abbestellen, ein Klick ──
r = await rufe('kundin_nachrichten', { get: { k: annaK }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.vorname === 'Anna' && r.json.einwilligungen.recall.erteilt && r.json.email.includes('•'), '„Ihre Nachrichten“ über den signierten Link (Adresse verdeckt)', r.json);
r = await rufe('kundin_nachrichten', { get: { k: annaId + '.' + 'a'.repeat(24) }, ohneAnmeldung: true });
pruefe(r.status === 404, '    gefälschte Unterschrift → 404');
r = await rufe('abbestellen', { post: { k: annaK, arten: { recall: false } }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.einwilligungen.recall.erteilt === false && r.json.einwilligungen.terminnachrichten.erteilt, 'Recall einzeln abbestellt, Terminnachrichten bleiben', r.json.einwilligungen);
r = await rufe('abbestellen', { post: { k: annaK, arten: { recall: true } }, ohneAnmeldung: true });
pruefe(r.json.einwilligungen.recall.erteilt === true, '    und wieder eingeschaltet');
post = await ausgang({ zweck: 'kampagne' });
r = await rufe('abbestellen', { get: { k: annaK, alle: '1' }, form: 'List-Unsubscribe=One-Click', ohneAnmeldung: true });
pruefe(r.status === 200 && !r.json.einwilligungen.recall.erteilt && !r.json.einwilligungen.angebote.erteilt && r.json.gesperrt.sms && r.json.gesperrt.email,
  'Abmelden mit einem Klick aus dem Mailprogramm (RFC 8058): alles aus, beide Wege gesperrt', r.json);
post = await ausgang({ zweck: 'kampagne' });
pruefe(post[0].status === 'gesperrt' || post[0].status === 'zurueckgezogen', '    die eingereihte Kampagne geht nicht mehr raus', post[0].status);

// ── STOP per SMS ────────────────────────────────────────────────────────
r = await rufe('sms_eingang', { get: { schluessel: 'falsch' }, post: { data: { sender: '+491765000000', text: 'STOP' } }, ohneAnmeldung: true });
pruefe(r.status === 403, 'Eingang für STOP nur mit Schlüssel');
const bertaTel = db('SELECT telefon FROM {p}kunde k JOIN {p}termin t ON t.kunde_id = k.id WHERE t.id = ?', berta.id)[0].telefon;
r = await rufe('sms_eingang', { get: { schluessel: 'eingang-123' }, post: { webhook_event: 'sms_mo', data: { sender: bertaTel.slice(1), text: 'Stop bitte' } }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.erkannt === 'stop', 'STOP per SMS erkannt (seven.io-Format, Nummer ohne +)', r.json);
const bertaId = db('SELECT kunde_id FROM {p}termin WHERE id = ?', berta.id)[0].kunde_id;
r = await rufe('kunde', { get: { id: bertaId } });
pruefe(r.json.einwilligungen.terminnachrichten.erteilt === false && r.json.gesperrt.sms === true, '    sofort: Einwilligung zurück, Nummer gesperrt', r.json);
post = await ausgang({ zweck: 'stop' });
pruefe(post.length === 1 && post[0].status === 'gesendet', '    genau eine Bestätigung „Sie bekommen keine SMS mehr“', post);
r = await rufe('sms_eingang', { get: { schluessel: 'eingang-123' }, form: 'from=' + encodeURIComponent(bertaTel) + '&text=START', ohneAnmeldung: true });
pruefe(r.json.erkannt === 'start', 'START hebt die Sperre auf (als Formular gesendet)');

// ── Erinnerung am Vortag ────────────────────────────────────────────────
zeiten = await freiAm(DO);
r = await rufe('termin_neu', { post: { salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${DO} ${zeiten[0]}`, quelle: 'telefon',
  kunde: { name: 'Clara Telefon', telefon: tel(), email: 'clara@example.test' } } });
pruefe(r.status === 200, 'Telefonbuchung im Studio', r.json);
const clara = r.json;
r = await rufe('einwilligung_studio', { post: { kunde_id: clara.kunde.id, art: 'terminnachrichten', erteilt: true } });
pruefe(r.status === 200 && r.json.einwilligungen.terminnachrichten.quelle === 'studio', 'Einwilligung mündlich im Salon festgehalten');
verschiebe(clara.id, 24 * 60);
r = await cron();
pruefe(r.status === 200 && r.json.erinnerungen.email === 1 && r.json.erinnerungen.sms === 1, 'Cron: Erinnerung per E-Mail und SMS (Telefonbuchung) eingereiht', r.json);
post = await ausgang({ zweck: 'erinnerung' });
const sms = post.find((n) => n.kanal === 'sms');
pruefe(sms && sms.status === 'gesendet' && sms.teile === 1 && /termin\.html\?t=[a-f0-9]{32}/.test(sms.text), '    SMS gesendet, ein Teil, mit Link zum Verschieben', sms);
pruefe(!/[–„“]/.test(sms.text), '    ohne Gedankenstriche und typografische Zeichen (sonst 70 statt 160 Zeichen)', sms.text);
const echteLaenge = sms.text.replace(/http\S+/, 'https://www.irmonhair-muenchen.de/termin.html?t=' + 'x'.repeat(32)).length;
pruefe(echteLaenge <= 160, `    auch mit der echten Adresse eine SMS (${echteLaenge} Zeichen)`);
pruefe(post.find((n) => n.kanal === 'email')?.status === 'gesendet', '    E-Mail gesendet');
r = await cron();
pruefe(r.json.erinnerungen.email === 0 && r.json.erinnerungen.sms === 0, '    zweiter Cronlauf: nichts doppelt', r.json);
// Online gebucht, unter 80 €, mit E-Mail: nur E-Mail (SMS lohnt nicht).
zeiten = await freiAm(DO);
r = await rufe('buchen', { ohneAnmeldung: true, post: { salon: 'pasing', leistungen: [waschen.id], person: 'tina', start: `${DO} ${zeiten[0]}`,
  name: 'Dora Online', telefon: tel(), email: 'dora@example.test', einwilligung: true, anfrage_id: neueId(), einwilligungen: { terminnachrichten: true } } });
verschiebe(r.json.id, 23 * 60);
r = await cron();
pruefe(r.json.erinnerungen.email === 1 && r.json.erinnerungen.sms === 0, 'Online, günstig, mit E-Mail: nur E-Mail-Erinnerung (Regel der Spezifikation)', r.json);

// ── Recall ──────────────────────────────────────────────────────────────
zeiten = await freiAm(FR, schnitt.id);
r = await rufe('termin_neu', { post: { salon: 'pasing', leistungen: [schnitt.id], person: 'tina', start: `${FR} ${zeiten[0]}`, quelle: 'vorort',
  kunde: { name: 'Emma Recall', telefon: tel() } } });
const emma = r.json;
await rufe('einwilligung_studio', { post: { kunde_id: emma.kunde.id, art: 'recall', erteilt: true } });
verschiebe(emma.id, -50 * 24 * 60, 'erschienen');
r = await rufe('recall_liste');
pruefe(r.status === 200 && r.json.bald.some((x) => x.kunde_id === emma.kunde.id), 'Recall-Vorschau: Emma ist fällig (Schnitt vor 50 Tagen, Abstand 49)', r.json.bald);
r = await rufe('recall_starten', { post: {} });
pruefe(r.status === 200 && r.json.erste === 1, 'Recall gesendet', r.json);
post = await ausgang({ zweck: 'recall' });
pruefe(post.length === 1 && post[0].kanal === 'sms' && post[0].text.endsWith('Abmelden: STOP') && /\?r=[a-f0-9]{16}/.test(post[0].text), '    per SMS, mit Kurzlink und „Abmelden: STOP“', post[0]);
r = await rufe('recall_starten', { post: {} });
pruefe(r.json.erste === 0 && r.json.nachfass === 0, '    zweiter Lauf: nichts doppelt', r.json);
const rTok = post[0].text.match(/\?r=([a-f0-9]{16})/)[1];
r = await rufe('recall_link', { get: { r: rTok }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.salon === 'pasing' && r.json.leistungen[0] === schnitt.id && r.json.person === 'tina' && r.json.ref === 'recall-' + rTok,
  'Recall-Link öffnet die Buchung mit der Auswahl von damals', r.json);
// Nachfrage nach sieben Tagen, dann ist Schluss.
db("UPDATE {p}recall SET erste = ? WHERE token = ?", zeit(Date.now() - 8 * 86400000), rTok);
r = await rufe('recall_starten', { post: {} });
pruefe(r.json.nachfass === 1, 'Nach 7 Tagen ohne Buchung: genau eine Nachfrage', r.json);
r = await rufe('recall_starten', { post: {} });
pruefe(r.json.nachfass === 0 && r.json.erste === 0, '    und keine weitere', r.json);
const emmaTel = db('SELECT telefon FROM {p}kunde WHERE id = ?', emma.kunde.id)[0].telefon;
zeiten = await freiAm(FR, schnitt.id);
r = await rufe('buchen', { ohneAnmeldung: true, post: { salon: 'pasing', leistungen: [schnitt.id], person: 'tina', start: `${FR} ${zeiten[0]}`,
  name: 'Emma Recall', telefon: emmaTel, einwilligung: true, anfrage_id: neueId(), ref: 'recall-' + rTok } });
pruefe(r.status === 200, 'Emma bucht über den Recall-Link', r.json);
pruefe(db('SELECT status, termin_id FROM {p}recall WHERE token = ?', rTok)[0].termin_id === r.json.id, '    zurückgeholt und dem Recall zugeordnet');
pruefe(db('SELECT quelle FROM {p}termin WHERE id = ?', r.json.id)[0].quelle === 'recall', '    Quelle der Buchung: recall');
r = await rufe('bericht', { get: { monat: new Date().toISOString().slice(0, 7) } });
pruefe(r.status === 200 && r.json.recall.zurueckgeholt === 1 && r.json.recall.abrechnung_cent === 300 && r.json.text.includes('zurückgeholt'), 'Monatsbericht: 1 zurückgeholt, Abrechnung 3 €', r.json.recall);

// ── Warteliste: erster Klick gewinnt ────────────────────────────────────
async function eintragen(name) {
  return rufe('warteliste', { ohneAnmeldung: true, post: { salon: 'pasing', leistungen: [waschen.id], person: 'tina', von: FR, bis: FR, tageszeit: 'egal',
    name, telefon: tel(), email: null } });
}
r = await eintragen('Fiona Warte');
pruefe(r.status === 200 && r.json.kanal === 'sms', 'Auf die Warteliste (online)', r.json);
const fionaWl = r.json.token;
r = await eintragen('Greta Warte');
pruefe(r.status === 200, '    zweite Interessentin für denselben Tag');
post = await ausgang({ zweck: 'warteliste' });
pruefe(post.length === 2 && post.every((n) => /\?w=[a-f0-9]{24}/.test(n.text) && n.text.includes('STOP')), 'Beide bekommen sofort den freien Platz angeboten (Link + STOP)', post.map((n) => n.text));
const tokens = post.map((n) => n.text.match(/\?w=([a-f0-9]{24})/)[1]);
const starts = tokens.map((t) => db('SELECT start FROM {p}angebot WHERE token = ?', t)[0].start);
pruefe(starts[0] === starts[1], '    derselbe Platz für beide', starts);
r = await rufe('angebot', { get: { w: tokens[1] }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.status === 'offen' && r.json.person_name && r.json.leistungen.length === 1, 'Angebot ansehen: noch frei', r.json);
r = await rufe('angebot_annehmen', { post: { w: tokens[1] }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.status === 'angenommen' && r.json.termin?.id, 'Wer zuerst tippt, bekommt ihn', r.json);
const wTermin = r.json.termin.id;
r = await rufe('angebot_annehmen', { post: { w: tokens[1] }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.termin.id === wTermin, '    derselbe Link noch einmal: derselbe Termin, kein zweiter');
r = await rufe('angebot_annehmen', { post: { w: tokens[0] }, ohneAnmeldung: true });
pruefe(r.status === 409 && r.json.code === 'vergeben', 'Die Zweite: „schon vergeben“, ihr Platz auf der Warteliste bleibt', r.json);
r = await rufe('angebot', { get: { w: tokens[0] }, ohneAnmeldung: true });
pruefe(r.json.status === 'vergeben', '    der Link ist verfallen');
pruefe(db('SELECT quelle FROM {p}termin WHERE id = ?', wTermin)[0].quelle === 'warteliste', 'Quelle der Buchung: warteliste');
r = await rufe('warteliste_austragen', { post: { wl: fionaWl }, ohneAnmeldung: true });
pruefe(r.status === 200, 'Von der Warteliste austragen über den Link');
// Absage → sofort Angebot an die Warteliste
r = await rufe('warteliste_speichern', { post: { salon: 'pasing', leistungen: [waschen.id], person: 'tina', von: DO, bis: DO, tageszeit: 'egal',
  kunde: { name: 'Hanna Theke', telefon: tel() } } });
pruefe(r.status === 422 && r.json.feld === 'einverstanden', 'Studio-Eintrag nur mit „Kundin möchte benachrichtigt werden“');
r = await rufe('warteliste_speichern', { post: { salon: 'pasing', leistungen: [waschen.id], person: 'tina', von: DO, bis: DO, tageszeit: 'egal', einverstanden: true,
  kunde: { name: 'Hanna Theke', telefon: tel() } } });
pruefe(r.status === 200 && r.json.quelle === 'studio', 'Studio trägt am Telefon ein', r.json);
r = await rufe('warteliste_liste');
pruefe(r.json.eintraege.some((e) => e.name === 'Hanna Theke' && e.angebote.length === 1), '    und sie hat sofort ein Angebot', r.json.eintraege.map((e) => [e.name, e.angebote.length]));

// ── Aktionscode und Gutschein ───────────────────────────────────────────
r = await rufe('rabatt_speichern', { post: { code: 'herbst 10', name: 'Herbst', prozent: 10, nur_neu: true } });
pruefe(r.status === 200 && r.json.rabatte.some((x) => x.code === 'HERBST10'), 'Aktionscode angelegt (Schreibweise vereinheitlicht)', r.json);
r = await rufe('code_pruefen', { get: { code: 'Herbst10', salon: 'pasing', leistungen: schnitt.id }, ohneAnmeldung: true });
pruefe(r.status === 200 && r.json.art === 'rabatt' && r.json.rabatt_cent === Math.round(schnitt.preis_cent / 10), 'Code prüfen: 10 % auf den Schnitt', r.json);
zeiten = await freiAm(MI, schnitt.id);
const idaTel = tel();
r = await rufe('buchen', { ohneAnmeldung: true, post: { salon: 'pasing', leistungen: [schnitt.id], person: 'tina', start: `${MI} ${zeiten[0]}`,
  name: 'Ida Neu', telefon: idaTel, einwilligung: true, anfrage_id: neueId(), code: 'HERBST10' } });
pruefe(r.status === 200 && r.json.rabatt_code === 'HERBST10' && r.json.rabatt_cent === Math.round(schnitt.preis_cent / 10), 'Buchung mit Code: Nachlass am Termin', r.json);
zeiten = await freiAm(MI, schnitt.id);
r = await rufe('buchen', { ohneAnmeldung: true, post: { salon: 'pasing', leistungen: [schnitt.id], person: 'tina', start: `${MI} ${zeiten[0]}`,
  name: 'Ida Neu', telefon: idaTel, einwilligung: true, anfrage_id: neueId(), code: 'HERBST10' } });
pruefe(r.status === 422 && r.json.feld === 'code', '    zweimal „nur erster Besuch“ → abgelehnt, nichts gebucht', r.json);
r = await rufe('code_pruefen', { get: { code: 'GIBTSNICHT' }, ohneAnmeldung: true });
pruefe(r.status === 422, 'Unbekannter Code → klare Meldung');
r = await rufe('gutschein_anlegen', { post: { wert_cent: 5000, kaeufer: 'Jana', empfaenger: 'Mama' } });
pruefe(r.status === 200 && /^IH-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(r.json.code) && r.json.gueltig_bis.endsWith('-12-31'), 'Gutschein über 50 € ausgegeben (3 Jahre zum Jahresende)', r.json);
const gCode = r.json.code;
r = await rufe('code_pruefen', { get: { code: gCode.toLowerCase() }, ohneAnmeldung: true });
pruefe(r.json.art === 'gutschein' && r.json.rest_cent === 5000, '    online prüfbar: Restwert 50 €');
const [e1, e2] = await Promise.all([rufe('gutschein_einloesen', { post: { code: gCode, betrag_cent: 3000 } }), rufe('gutschein_einloesen', { post: { code: gCode, betrag_cent: 3000 } })]);
pruefe([e1.status, e2.status].sort().join() === '200,409', 'Zweimal gleichzeitig 30 € einlösen: nur einmal möglich', [e1.json, e2.json]);
r = await rufe('gutschein', { get: { code: gCode } });
pruefe(r.json.rest_cent === 2000 && r.json.verlauf.length === 2, '    Rest 20 €, Verlauf mit Ausgabe und Einlösung', r.json);
r = await rufe('gutschein_stornieren', { post: { code: gCode, grund: 'Test' } });
pruefe(r.json.status === 'storniert' && r.json.rest_cent === 0, 'Gutschein storniert (nur Inhaberin)');

// ── Treue ───────────────────────────────────────────────────────────────
r = await rufe('einstellungen_speichern', { post: { treue_aktiv: true, treue_n: 2 } });
pruefe(r.status === 200 && r.json.treue_aktiv === true, 'Treuekarte eingeschaltet (jeder 2. Besuch, für den Test)');
r = await rufe('kunde', { get: { id: emma.kunde.id } });
pruefe(r.json.treue && r.json.treue.besuche === 1 && r.json.treue.offen === 0, 'Emma: 1 Stempel', r.json.treue);
r = await rufe('treue_einloesen', { post: { kunde_id: emma.kunde.id } });
pruefe(r.status === 409, '    noch keine Prämie');
verschiebe(clara.id, -3 * 24 * 60, 'erschienen');
db('UPDATE {p}termin SET kunde_id = ? WHERE id = ?', emma.kunde.id, clara.id);
r = await rufe('treue_einloesen', { post: { kunde_id: emma.kunde.id } });
pruefe(r.status === 200 && r.json.offen === 0 && r.json.eingeloest === 1, 'Nach dem zweiten Besuch: Prämie eingelöst', r.json);
r = await rufe('termin', { get: { t: emma.token }, ohneAnmeldung: true });
pruefe(r.json.treue?.n === 2, 'Die Kundin sieht ihren Stand auf der Terminseite', r.json.treue);

// ── Fotos ───────────────────────────────────────────────────────────────
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
r = await rufe('foto_hochladen', { post: { kunde_id: emma.kunde.id, bild: png } });
pruefe(r.status === 422 && r.json.feld === 'einverstanden', 'Foto nur mit Einverständnis der Kundin');
r = await rufe('foto_hochladen', { post: { kunde_id: emma.kunde.id, bild: png, einverstanden: true, notiz: 'Ergebnis Balayage' } });
pruefe(r.status === 200 && r.json.fotos.length === 1, 'Foto in der Kartei', r.json);
const fotoId = r.json.id;
r = await rufe('foto', { get: { id: fotoId }, roh: true });
pruefe(r.status === 200 && r.typ === 'image/png' && r.buf.length > 50, '    angemeldet abrufbar');
r = await rufe('foto', { get: { id: fotoId }, roh: true, ohneAnmeldung: true });
pruefe(r.status === 401, '    ohne Anmeldung nicht');
r = await rufe('foto_hochladen', { post: { kunde_id: emma.kunde.id, bild: 'data:image/png;base64,' + Buffer.from('<?php echo 1;').toString('base64'), einverstanden: true } });
pruefe(r.status === 422, '    kein Bild → abgelehnt');
r = await rufe('foto_loeschen', { post: { id: fotoId } });
pruefe(r.status === 200 && r.json.fotos.length === 0, '    gelöscht');

// ── Lager ───────────────────────────────────────────────────────────────
r = await rufe('artikel_speichern', { post: { salon: 'pasing', name: 'No. 3 Hair Perfector 100 ml', marke: 'Olaplex', ean: '896364002350', bestand: 5, mindest: 2, ek_cent: 1650, vk_cent: 3200 } });
pruefe(r.status === 200 && r.json.bestand === 5, 'Artikel mit Anfangsbestand 5', r.json);
const art = r.json.id;
r = await rufe('lager_buchen', { post: { artikel_id: art, art: 'verkauf', menge: 4 } });
pruefe(r.json.bestand === 1, '    4 verkauft → 1');
r = await rufe('artikel', { get: { salon: 'pasing' } });
pruefe(r.json.nachbestellen === 1 && r.json.warenwert_cent === 1650, '    unter Mindestbestand: nachbestellen; Warenwert 16,50 €', r.json);
r = await rufe('lager_buchen', { post: { artikel_id: art, art: 'inventur', menge: 7 } });
pruefe(r.json.bestand === 7, '    Inventur: gezählt 7');
r = await rufe('lager_verlauf', { get: { artikel_id: art } });
pruefe(r.json.verlauf.length === 3 && r.json.verlauf[0].menge === 6, '    Verlauf mit Differenz (+6)', r.json.verlauf);
r = await rufe('artikel_speichern', { post: { salon: 'pasing', name: 'Doppelt', ean: '896364002350' } });
pruefe(r.status === 409, '    derselbe Strichcode zweimal → abgelehnt');

// ── Import aus Planity ──────────────────────────────────────────────────
const csv = '﻿Prénom;Nom;Téléphone;Email;Notes\nKlara;Import;0176 1112223;klara@example.test;Allergie Ammoniak\nLena;Ohne;;;\nEmma;Recall;' + emmaTel + ';;Stammkundin\nMara;Import;+49 176 1112224;;\n';
r = await rufe('import_pruefen', { post: { csv } });
pruefe(r.status === 200 && r.json.neu === 2 && r.json.vorhanden === 1 && r.json.ohne_kontakt === 1, 'Import prüfen: 2 neu, 1 vorhanden, 1 ohne Kontakt (französische Spalten erkannt)', r.json);
r = await rufe('import_kunden', { post: { csv } });
pruefe(r.status === 200 && r.json.neu === 2 && r.json.ergaenzt === 1, 'Import: 2 angelegt, vorhandene ergänzt (nicht überschrieben)', r.json);
r = await rufe('import_kunden', { post: { csv } });
pruefe(r.json.neu === 0 && r.json.ergaenzt === 0, '    zweimal importiert: nichts doppelt', r.json);
const klara = db("SELECT id, herkunft FROM {p}kunde WHERE email = 'klara@example.test'")[0];
pruefe(klara.herkunft === 'planity' && db('SELECT COUNT(*) AS n FROM {p}einwilligung WHERE kunde_id = ?', klara.id)[0].n === 0, '    Herkunft „planity“, keine Einwilligungen übernommen');

// ── Vorlagen ────────────────────────────────────────────────────────────
r = await rufe('vorlagen_speichern', { post: { vorlagen: { recall_sms: 'Hallo {vorname}, mal wieder Zeit?' } } });
pruefe(r.status === 422, 'Vorlage ohne {link} → abgelehnt');
r = await rufe('vorlagen_speichern', { post: { vorlagen: { recall_sms: 'Hallo {vorname}, mal wieder Zeit für {leistung}? {link}' } } });
pruefe(r.status === 200 && r.json.vorlagen.find((v) => v.name === 'recall_sms').eigen.includes('mal wieder'), 'Eigene Vorlage gespeichert');

// ── Buchhaltung, Export, Postausgang ────────────────────────────────────
const monat = new Date().toISOString().slice(0, 7);
const von = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10), bis = new Date().toISOString().slice(0, 10);
r = await rufe('export', { get: { was: 'umsatz', von, bis }, roh: true });
pruefe(r.status === 200 && r.buf.toString().includes('Dienstleistung') && r.buf.toString().includes('Summe'), 'Umsatzliste für die Kanzlei (CSV)');
r = await rufe('export', { get: { was: 'datev', von, bis }, roh: true });
pruefe(r.status === 200 && r.buf.toString('latin1').startsWith('"EXTF";700;21;"Buchungsstapel"') && r.typ.includes('1252'), 'DATEV-Buchungsstapel (EXTF, Windows-1252)', r.buf.toString('latin1').slice(0, 200));
for (const was of ['nachrichten', 'gutscheine', 'lager']) {
  r = await rufe('export', { get: { was }, roh: true });
  pruefe(r.status === 200 && r.buf.length > 20, `Export ${was}`);
}
r = await rufe('nachrichten_stand');
pruefe(r.status === 200 && r.json.kanaele.sms.stop === true && r.json.monat.length > 0, 'Postausgang: Kanäle und Zahlen des Monats', r.json);
r = await rufe('nachrichten_liste', { get: { kunde_id: emma.kunde.id } });
pruefe(r.json.nachrichten.length >= 2 && r.json.nachrichten.every((n) => n.kunde_id === emma.kunde.id), 'Nachrichten je Kundin (für die Kundenkarte)');

// Jede SMS passt in eine — auch mit der echten, längeren Adresse.
for (const n of (await rufe('nachrichten_liste')).json.nachrichten.filter((x) => x.kanal === 'sms' && x.zweck !== 'test')) {
  const laenge = n.text.replace(/http:\/\/127\.0\.0\.1:8099\//, 'https://www.irmonhair-muenchen.de/').length;
  pruefe(laenge <= 160 && !/[–„“…]/.test(n.text), `SMS „${n.zweck_name}“ passt in eine SMS (${laenge} Zeichen)`, n.text);
}

// ── Löschen nach DSGVO nimmt Fotos, Nachrichten, Warteliste mit ─────────
r = await rufe('kunde_loeschen', { post: { id: emma.kunde.id } });
pruefe(r.status === 200, 'Kundin gelöscht');
pruefe(db("SELECT COUNT(*) AS n FROM {p}nachricht WHERE kunde_id = ? AND (an <> '' OR text <> '')", emma.kunde.id)[0].n === 0, '    Nachrichten geleert');

r = await rufe('selbstcheck', { get: { schluessel: CRON } });
pruefe(r.json.ok === true, 'Abschluss-Selbstcheck: keine Überschneidung', r.json);
console.log(`\n${ok} Prüfungen zu Nachrichten und Verkauf bestanden.`);

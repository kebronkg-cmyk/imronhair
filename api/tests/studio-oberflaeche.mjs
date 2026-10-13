// Oberflächenprüfung des Studios im Browser (Playwright): Ziehen, Dauer,
// Abgleich zweier Geräte, Anlegen übers Formular, Tastatur.
// Braucht einen laufenden Server mit eingerichteter Inhaberin bedia /
// sehr-geheim-123 und Buchungen am Datum (z. B. aus last.mjs):
//   node api/tests/studio-oberflaeche.mjs http://127.0.0.1:8098/ 2026-09-30
import { chromium } from '../../.claude/skills/salon-website/scripts/pw.mjs';
const basis = process.argv[2], datum = process.argv[3];
const b = await (await chromium()).launch();
const fehler = [];
const ok = (b, t, d) => { if (!b) { console.log('✗ ' + t, d ?? ''); fehler.push(t); } else console.log('✓ ' + t); };
async function geraet() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fehler.push('pageerror ' + e.message));
  await p.goto(basis + 'studio/', { waitUntil: 'networkidle' });
  await p.fill('#tor-anmeldename', 'bedia'); await p.fill('#tor-passwort', 'sehr-geheim-123'); await p.click('#tor-knopf');
  await p.waitForSelector('.kal-leiste');
  await p.evaluate((d) => { const i = document.querySelector('.datum-feld'); i.value = d; i.dispatchEvent(new Event('change')); }, datum);
  await p.waitForTimeout(900);
  return p;
}
const api = (p, a, q = {}) => p.evaluate(async ([a, q]) => (await fetch('../api/?a=' + a + '&' + new URLSearchParams(q))).json(), [a, q]);
const p = await geraet();
const p2 = await geraet();

// 1. Ziehen: den ersten gebuchten Termin von Csilla 30 Minuten später.
const m = (t) => +t.slice(11, 13) * 60 + +t.slice(14, 16);
// Einen eigenen Termin anlegen, hinter dem 75 Minuten frei sind (30 Ziehen,
// 15 Griff, Rest als Luft fürs Runden der Pixel) — so hängt
// die Prüfung nicht davon ab, wie die Zufallsbuchungen gefallen sind.
const katalog = await api(p, 'katalog');
const eigen = await p.evaluate(async ([datum, kat]) => {
  const csrf = (await (await fetch('../api/?a=studio_status')).json()).csrf;
  const l = kat.leistungen.find((x) => x.salon === 'pasing' && x.personen.includes('csilla') && x.dauer <= 60);
  const q = new URLSearchParams({ a: 'vorschlaege', salon: 'pasing', person: 'csilla', von: datum, tage: 5 });
  const v = await (await fetch('../api/?' + q, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: JSON.stringify({ leistungen: [l.id], phasen: [['arbeit', 135]] }) })).json();
  const f = v.frei.find((x) => x.p.includes('csilla'));
  const r = await fetch('../api/?a=termin_neu', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf },
    body: JSON.stringify({ salon: 'pasing', person: 'csilla', leistungen: [l.id], phasen: [['arbeit', 60]], start: `${f.datum} ${f.t}`, kunde: { name: 'Zieh Test' } }) });
  return r.json();
}, [datum, katalog]);
if (eigen.start.slice(0, 10) !== datum) {
  await p.evaluate((d) => { const i = document.querySelector('.datum-feld'); i.value = d; i.dispatchEvent(new Event('change')); }, eigen.start.slice(0, 10));
  await p2.evaluate((d) => { const i = document.querySelector('.datum-feld'); i.value = d; i.dispatchEvent(new Event('change')); }, eigen.start.slice(0, 10));
}
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await p.waitForTimeout(1500);
const vorher = (await api(p, 'kalender', { salon: 'pasing', von: eigen.start.slice(0, 10) })).termine;
// Ein Termin, hinter dem 30 + 15 Minuten frei sind (Ziehen und Griff landen
// auf freier Zeit) — Bedia nicht, die arbeitet auch in Großhadern.
const frei = (t, von, bis) => !vorher.some((x) => x.id !== t.id && x.person === t.person && ['gebucht', 'erschienen'].includes(x.status) && m(x.start) < bis && m(x.ende) > von);
const ziel = vorher.find((t) => t.id === eigen.id);
// Und einer, dessen Nachfolger direkt anschließt: dorthin ziehen geht nicht.
const besetzt = vorher.find((t) => t.id !== ziel.id && t.start.slice(0, 10) === ziel.start.slice(0, 10) && t.phasen.length === 1 && t.status === 'gebucht' && t.person !== 'bedia' && t.person !== ziel.person && !frei(t, m(t.start) + 30, m(t.ende) + 30));
const block = p.locator(`.termin[data-id="${ziel.id}"]`);
await block.evaluate((e) => { e.closest('.kal-scroll').scrollTop = e.offsetTop - 250; });
await p.waitForTimeout(200);
const box = await block.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + 8);
await p.mouse.down();
for (let i = 1; i <= 10; i++) await p.mouse.move(box.x + box.width / 2, box.y + 8 + 48 * i / 10);   // 48 px = 30 Min.
const antwort = p.waitForResponse((r) => r.url().includes('termin_aendern'));
await p.mouse.up();
const erste = await antwort;
await p.waitForTimeout(600);
const frage = erste.status() === 409 ? await p.locator('#frage[open]').count() : 0;
if (frage) { await p.click('#frage [value="ja"]'); await p.waitForTimeout(1000); }
let nachher = (await api(p, 'kalender', { salon: 'pasing', von: ziel.start.slice(0, 10) })).termine.find((t) => t.id === ziel.id);
ok(m(nachher.start) - m(ziel.start) === 30, `Ziehen um 30 Min.: ${ziel.start.slice(11)} → ${nachher.start.slice(11)}${frage ? ' (mit Rückfrage Überschneidung)' : ''}`);
ok(await p.locator('.meldung').count() > 0, 'Meldung mit „Rückgängig“ erscheint');

// 1b. Auf eine belegte Zeit ziehen: abgelehnt, der Termin bleibt, wo er war.
if (besetzt) {
  const bl = p.locator(`.termin[data-id="${besetzt.id}"]`);
  await bl.evaluate((e) => { e.closest('.kal-scroll').scrollTop = e.offsetTop - 250; });
  await p.waitForTimeout(200);
  const bx = await bl.boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + 8);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(bx.x + bx.width / 2, bx.y + 8 + 48 * i / 10);
  const an = p.waitForResponse((r) => r.url().includes('termin_aendern'));
  await p.mouse.up();
  const st = (await an).status();
  await p.waitForTimeout(800);
  const da = (await api(p, 'kalender', { salon: 'pasing', von: ziel.start.slice(0, 10) })).termine.find((t) => t.id === besetzt.id);
  ok(st === 409 && da.start === besetzt.start && !(await p.locator('#frage[open]').count()), `Auf belegte Zeit gezogen: abgelehnt, ohne „trotzdem“ (${besetzt.start.slice(11)} bleibt)`);
}

// 2. Anderes Gerät sieht die Änderung beim Abgleich (Zähler), ohne Neuladen.
await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await p2.waitForTimeout(1500);
const top2 = await p2.locator(`.termin[data-id="${ziel.id}"] .termin-zeit`).textContent();
ok(top2.startsWith(nachher.start.slice(11)), `Zweites Gerät zeigt die neue Zeit (${top2})`);

// 3. Dauer ziehen: Griff unten 15 Min. länger.
const b2 = p.locator(`.termin[data-id="${ziel.id}"]`);
const bb = await b2.boundingBox();
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 3);
await p.mouse.down();
for (let i = 1; i <= 6; i++) await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 3 + 24 * i / 6);
await p.mouse.up();
await p.waitForTimeout(1200);
if (await p.locator('#frage[open]').count()) { await p.click('#frage [value="ja"]'); await p.waitForTimeout(1000); }
const n2 = (await api(p, 'kalender', { salon: 'pasing', von: ziel.start.slice(0, 10) })).termine.find((t) => t.id === ziel.id);
ok(m(n2.ende) - m(n2.start) === m(nachher.ende) - m(nachher.start) + 15, `Griff: Dauer +15 Min. (${nachher.ende.slice(11)} → ${n2.ende.slice(11)})`);

// 4. Veralteter Stand: Gerät 2 ändert mit alter Version → Hinweis, kein Überschreiben.
const alt = await p2.evaluate(async ([id, v]) => { const r = await fetch('../api/?a=termin_aendern', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': '' }, body: JSON.stringify({ id, version: v, status: 'erschienen' }) }); return r.status; }, [ziel.id, ziel.version]);
ok(alt === 403, 'Ohne CSRF-Schlüssel abgelehnt (403)');

// 5. Neuer Termin über das Formular, freie Zeit antippen.
await p.click('.neu-knopf');
await p.fill('.tafel .such-feld >> nth=0', 'Neu Kundin');
await p.waitForTimeout(700);
await p.click('.treffer-neu');
await p.fill('.tafel input[type=tel]', '0171 2223334');
await p.click('.tafel .leistung-zeile >> nth=0');
await p.waitForTimeout(1200);
const zeit = await p.locator('.tafel .chip-zeit >> nth=5').textContent();
await p.click('.tafel .chip-zeit >> nth=5');
await p.click('#termin-speichern');
await p.waitForTimeout(1500);
const titel = await p.locator('#tafel-titel').textContent();
ok(titel === 'Neu Kundin', `Termin angelegt, Tafel zeigt „${titel}“ um ${zeit}`);
const k = await api(p, 'kunden', { q: '0171 222' });
ok(k.kunden.length === 1 && k.kunden[0].telefon === '+491712223334', 'Kundin mit +49-Nummer in der Kartei');

// 6. Erschienen in der Liste (heute oder vergangene Tage nur) — hier: Status-Schalter gesperrt für die Zukunft.
const gesperrt = await p.locator('.status-schalter button >> nth=1').isDisabled();
ok(gesperrt, '„Erschienen“ ist vor dem Termintag gesperrt');

// 6b. Absagen durch den Salon: nur mit Grund, der Termin wird „storniert_salon“.
await p.click('.tafel-wege button:has-text("Absagen")');
await p.waitForSelector('#frage[open]');
await p.click('#frage button:has-text("Salon sagt ab")');
await p.click('#frage [value="ja"]');
await p.waitForTimeout(300);
ok(await p.locator('#frage[open] .form-fehler:not([hidden])').count() === 1, 'Salon sagt ab ohne Grund: Dialog bleibt offen, fragt nach dem Grund');
await p.fill('#frage input[type=text]', 'Krankheit');
if (process.env.AUFNAHMEN) await p.screenshot({ path: process.env.AUFNAHMEN + '/studio-absage.png' });
const abs = p.waitForResponse((r) => r.url().includes('termin_aendern'));
await p.click('#frage [value="ja"]');
const absJ = await (await abs).json();
await p.waitForTimeout(800);
ok(absJ.status === 'storniert_salon' && absJ.storno_grund === 'Krankheit', `Abgesagt durch den Salon, mit Grund (${absJ.status})`);
ok((await p.locator('.tafel .ist-abgesagt').textContent()).includes('Krankheit'), 'Tafel zeigt „Vom Salon abgesagt: Krankheit“');

// 7. Tastatur: Pfeil rechts blättert, t springt zurück.
await p.keyboard.press('Escape');
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600);
const titel2 = await p.locator('.datum-titel span').textContent();
ok(!titel2.includes('30.'), `Pfeil rechts: ${titel2}`);
await p.keyboard.press('/'); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.activeElement.id) === 'kunden-suche', '„/“ öffnet die Kundensuche');

console.log(fehler.length ? 'FEHLER: ' + fehler.join(' | ') : 'Alles bestanden.');
await b.close();

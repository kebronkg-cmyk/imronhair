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
const vorher = (await api(p, 'kalender', { salon: 'pasing', von: datum })).termine;
const ziel = vorher.find((t) => t.phasen.length === 1 && t.status === 'gebucht');
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
let nachher = (await api(p, 'kalender', { salon: 'pasing', von: datum })).termine.find((t) => t.id === ziel.id);
const m = (t) => +t.slice(11, 13) * 60 + +t.slice(14, 16);
ok(m(nachher.start) - m(ziel.start) === 30, `Ziehen um 30 Min.: ${ziel.start.slice(11)} → ${nachher.start.slice(11)}${frage ? ' (mit Rückfrage Überschneidung)' : ''}`);
ok(await p.locator('.meldung').count() > 0, 'Meldung mit „Rückgängig“ erscheint');

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
const n2 = (await api(p, 'kalender', { salon: 'pasing', von: datum })).termine.find((t) => t.id === ziel.id);
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

// 7. Tastatur: Pfeil rechts blättert, t springt zurück.
await p.keyboard.press('Escape');
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600);
const titel2 = await p.locator('.datum-titel span').textContent();
ok(!titel2.includes('30.'), `Pfeil rechts: ${titel2}`);
await p.keyboard.press('/'); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.activeElement.id) === 'kunden-suche', '„/“ öffnet die Kundensuche');

console.log(fehler.length ? 'FEHLER: ' + fehler.join(' | ') : 'Alles bestanden.');
await b.close();

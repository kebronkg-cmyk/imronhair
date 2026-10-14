// Die Fälle, an denen Planity und Treatwell gescheitert sind — im Browser
// gegen den echten Server:
//   node api/tests/buchung-ausfall.mjs http://127.0.0.1:8098/
//  1. Die Antwort geht verloren (Netz weg, nachdem der Server gebucht hat):
//     die Seite fragt nach und zeigt den einen Termin — kein zweiter.
//  2. Jemand schnappt die Zeit weg: drei Ausweichzeiten, eine Berührung.
//  3. Verschieben über den Link: derselbe Termin, „vorher → jetzt“.
//  4. Seite mitten im Buchen geschlossen: beim nächsten Öffnen ist er da.
import { chromium } from '../../.claude/skills/salon-website/scripts/pw.mjs';
import { tmpdir } from 'node:os';
const AUFNAHME = process.env.AUFNAHMEN || tmpdir();
const basis = process.argv[2] || 'http://127.0.0.1:8098/';
const API = basis + 'api/';
let ok = 0;
const pruefe = (b, t, d) => { if (!b) { console.error('Seitenfehler: ' + JSON.stringify(fehler)); console.error('✗ ' + t + (d !== undefined ? '\n  ' + JSON.stringify(d).slice(0, 600) : '')); process.exit(1); } ok++; console.log('✓ ' + t); };
const b = await (await chromium()).launch();
const fehler = [];
async function seite(breite = 390) {
  const ctx = await b.newContext({ viewport: { width: breite, height: 844 }, hasTouch: breite < 800, isMobile: breite < 800 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fehler.push(e.message));
  return { ctx, p };
}
async function bisZurZeit(p, opt = {}) {
  await p.goto(basis + 'termin.html', { waitUntil: 'networkidle' });
  await p.click('.salon-wahl >> nth=0');
  await p.click('.familie-kopf >> nth=0');
  if (await p.locator('.laenge').count()) await p.click('.laenge >> nth=0');
  await p.click('#leistung-fertig');
  await p.waitForSelector('.person-wahl');
  await p.click(opt.person ? `.person-wahl:has-text("${opt.person}")` : '.person-wahl >> nth=0');
  await p.waitForSelector('.zeit');
}
async function angaben(p, tel) {
  await p.fill('#k-name', 'Ausfall Test');
  await p.fill('#k-telefon', tel);
}

// ── 1. Antwort verloren ────────────────────────────────────────────────
{
  const { ctx, p } = await seite();
  await bisZurZeit(p);
  await p.click('.zeit >> nth=2');
  await angaben(p, '0176 8800001');
  const gesendet = [];
  let erste = true, serverTermin = null;
  await p.route('**/api/?a=buchen*', async (route) => {
    gesendet.push(JSON.parse(route.request().postData()).anfrage_id);
    if (erste) {
      erste = false;
      const r = await route.fetch();          // der Server bucht wirklich …
      serverTermin = await r.json();
      return route.abort('failed');           // … aber die Antwort kommt nie an
    }
    return route.continue();
  });
  await p.click('#buchen');
  await p.waitForSelector('#fertig:not([hidden])', { timeout: 15000 });
  const titel = await p.textContent('#fertig-titel');
  pruefe(titel.includes('gebucht'), '1 · Antwort verloren → die Seite findet den Termin und zeigt „gebucht“', titel);
  pruefe(new Set(gesendet).size === 1, '    jeder Versuch mit derselben Anfrage-Kennung (höchstens ein Termin)', gesendet);
  const link = await p.getAttribute('.fertig-notiz a', 'href');
  pruefe(serverTermin && link.includes(serverTermin.token), '    es ist genau der Termin, den der Server gespeichert hat', [link, serverTermin?.token]);
  await ctx.close();
}

// ── 2. Zeit weggeschnappt ──────────────────────────────────────────────
{
  const { ctx, p } = await seite(1440);
  await bisZurZeit(p, { person: 'Tina' });
  const zeit = (await p.textContent('.zeit >> nth=4 >> span')).trim();
  const tag = await p.getAttribute('.tag[aria-pressed="true"]', 'data-datum');
  await p.click('.zeit >> nth=4');
  await angaben(p, '0176 8800002');
  // Jemand anderes bucht genau diese Zeit, während die Kundin tippt.
  const leistung = await p.evaluate(() => JSON.parse(localStorage.getItem('irmonhair-letzte') || 'null'));
  void leistung;
  const kat = await (await fetch(API + '?a=katalog')).json();
  const gewaehlt = await p.evaluate(() => document.querySelector('.schritt[data-schritt="leistung"] .schritt-wahl').textContent);
  const l = kat.leistungen.find((x) => x.salon === 'pasing' && gewaehlt.startsWith(x.name) && (!x.laenge || gewaehlt.includes(x.laenge)));
  const weg = await fetch(API + '?a=buchen', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salon: 'pasing', leistungen: [l.id], person: 'tina', start: `${tag} ${zeit}`, name: 'Schneller', telefon: '0176 8800099', einwilligung: true }) });
  pruefe(weg.status === 200, `    (jemand anderes bucht ${tag} ${zeit} bei Tina)`);
  await p.click('#buchen');
  await p.waitForSelector('#ausweich:not([hidden]) .vorschlag', { timeout: 10000 });
  const n = await p.locator('#ausweich .vorschlag').count();
  pruefe(n === 3, '2 · Zeit weggeschnappt → drei Ausweichzeiten erscheinen', n);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${AUFNAHME}/ausfall-2-ausweich.png` });
  const erste = await p.textContent('#ausweich .vorschlag >> nth=0');
  await p.click('#ausweich .vorschlag >> nth=0');
  await p.waitForSelector('.schritt[data-schritt="kontakt"].ist-offen');
  await p.click('#buchen');
  await p.waitForSelector('#fertig:not([hidden])', { timeout: 10000 });
  pruefe((await p.textContent('#fertig-titel')).includes('gebucht'), '    eine Berührung auf die Ausweichzeit, und es ist gebucht', erste);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${AUFNAHME}/ausfall-2.png` });
  await ctx.close();
}

// ── 3. Verschieben über den Link ───────────────────────────────────────
{
  const { ctx, p } = await seite();
  await bisZurZeit(p);
  // Ein Tag in einigen Tagen: innerhalb der Frist (24 h) geht Verschieben nur telefonisch.
  await p.click('.tag.ist-frei >> nth=4');
  await p.click('.zeit >> nth=6');
  await angaben(p, '0176 8800003');
  await p.click('#buchen');
  await p.waitForSelector('#fertig:not([hidden])');
  const link = await p.getAttribute('.fertig-notiz a', 'href');
  const token = link.split('t=')[1];
  const vorher = await (await fetch(API + '?a=termin&t=' + token)).json();
  await p.goto(basis + link, { waitUntil: 'networkidle' });
  await p.click('#fertig-wege button:has-text("Verschieben")');
  await p.waitForSelector('.zeit');
  await p.click('.tag.ist-frei >> nth=6');
  await p.click('.zeit >> nth=10');
  const knopf = await p.textContent('#buchen');
  const felderZu = await p.evaluate(() => getComputedStyle(document.querySelector('#k-name').closest('.feld')).display === 'none');
  const hinweis = await p.textContent('#buchen-hinweis');
  pruefe(knopf.includes('verschieben') && felderZu && hinweis.includes('erst frei'), '3 · Verschieben: eigener Knopf, keine Angaben noch einmal, Hinweis „wird erst frei …“', [knopf, hinweis]);
  await p.click('#buchen');
  await p.waitForSelector('#fertig:not([hidden]), #kontakt-fehler:not([hidden]), #ausweich:not([hidden])', { timeout: 10000 }).catch(() => {});
  pruefe(await p.isVisible('#fertig'), '    verschoben (keine Fehlermeldung)', [await p.textContent('#buchen'), await p.getAttribute('#buchen', 'disabled'), await p.textContent('#hinweis-band'),await p.textContent('#kontakt-fehler'), await p.textContent('#ausweich')]);
  const t = await p.textContent('#fertig-titel');
  const vj = await p.textContent('.fertig-vorher');
  const nachher = await (await fetch(API + '?a=termin&t=' + token)).json();
  pruefe(t.includes('verschoben') && vj.includes('vorher') && vj.includes('jetzt'), '    Bestätigung „vorher → jetzt“', [t, vj]);
  pruefe(nachher.id === vorher.id && nachher.status === 'gebucht' && nachher.start !== vorher.start, '    derselbe Termin (gleicher Link), neue Zeit', [vorher.start, nachher.start]);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${AUFNAHME}/ausfall-3a.png` });
  await p.evaluate(() => document.querySelector('.fertig-wege').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${AUFNAHME}/ausfall-3b.png` });
  await ctx.close();
}

// ── 4. Seite mitten im Buchen geschlossen ──────────────────────────────
{
  const { ctx, p } = await seite();
  await bisZurZeit(p);
  await p.click('.zeit >> nth=8');
  await angaben(p, '0176 8800004');
  // Der Server bucht, aber keine Antwort und keine Nachfrage kommt durch.
  await p.route('**/api/?a=buchen*', async (route) => { await route.fetch(); return route.abort('failed'); });
  await p.route('**/api/?a=anfrage*', (route) => route.abort('failed'));
  await p.click('#buchen');
  await p.waitForSelector('#kontakt-fehler:not([hidden])', { timeout: 20000 });
  const text = await p.textContent('#kontakt-fehler');
  pruefe(text.includes('kein zweiter Termin'), '4 · Ohne jede Antwort: ehrliche Meldung, „noch einmal tippen ist sicher“', text);
  await p.unroute('**/api/?a=buchen*');
  await p.unroute('**/api/?a=anfrage*');
  await p.goto(basis + 'termin.html', { waitUntil: 'networkidle' });
  await p.waitForSelector('#fertig:not([hidden])', { timeout: 10000 });
  pruefe((await p.textContent('#hinweis-band')).includes('angekommen'), '    beim nächsten Öffnen: „Ihre Buchung von vorhin ist angekommen“');
  await ctx.close();
}

pruefe(fehler.length === 0, 'Keine Skriptfehler auf der Seite', fehler);
console.log(`\n${ok} Prüfungen im Browser bestanden.`);
await b.close();

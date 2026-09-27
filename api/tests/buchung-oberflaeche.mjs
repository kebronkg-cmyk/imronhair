// Durchlauf der Online-Buchung im Browser, mit Aufnahmen je Schritt.
//   node api/tests/buchung-oberflaeche.mjs http://127.0.0.1:8098/ 390 844 /tmp/buchung
// Mit Q='?vorschau' läuft er gegen die Vorschau ohne Server.
import { chromium } from '../../.claude/skills/salon-website/scripts/pw.mjs';
const [basis, w, h, praefix] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5]];
const b = await (await chromium()).launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 });
const p = await ctx.newPage();
const err = []; p.on('pageerror', e => err.push(e.message)); p.on('console', m => { if (m.type() === 'error') err.push('console: ' + m.text()); });
const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${praefix}-${n}.png` }); };
await p.goto(basis + 'fenster/termin.html' + (process.env.Q||''), { waitUntil: 'networkidle' });
await shot('1-salon');
await p.click('.salon-wahl >> nth=0'); await shot('2-leistung');
await p.click('.familie-kopf >> nth=0'); await shot('3-laenge');
await p.click('.laenge >> nth=1'); await shot('4-gewaehlt');
await p.click('#leistung-fertig'); await p.waitForTimeout(900); await shot('5-person');
await p.click('.person-wahl >> nth=0'); await p.waitForTimeout(900); await shot('6-zeit');
await p.click('.zeit >> nth=3'); await shot('7-kontakt');
await p.fill('#k-name', 'Anna Beispiel'); await p.fill('#k-telefon', '0176 1234567'); await p.fill('#k-email', 'anna@example.org');
await p.click('#buchen'); await p.waitForTimeout(1200); await shot('8-fertig');
console.log(JSON.stringify(err));
await b.close();

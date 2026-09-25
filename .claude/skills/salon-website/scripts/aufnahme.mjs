// Gültige Prüfaufnahmen: jeder Auftritt abgeschlossen, Leiste ganz da oder
// ganz weg, letzte Kachel ohne Doppelung.
//   node aufnahme.mjs <url> <breite> <höhe> <ziel.png>
// Schreibt die Kacheln nach <ziel>-kacheln/ und setzt sie mit Python/Pillow
// zu <ziel.png> zusammen.
import { chromium } from './pw.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const [url, w, h, ziel] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5]];
const ordner = ziel.replace(/\.png$/, '') + '-kacheln'; mkdirSync(ordner, { recursive: true });
const b = await (await chromium()).launch();
const p = await b.newPage({ viewport: { width: w, height: h } });
const fehler = []; p.on('pageerror', e => fehler.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
const H = await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; return document.documentElement.scrollHeight; });
const kacheln = [];
for (let y = 0, i = 0; y < H; y += h, i++) {
  const ist = Math.min(y, H - h);
  await p.evaluate(y => window.scrollTo(0, y), ist); await p.waitForTimeout(400);
  // Auftritte sofort abschliessen (Klassen des Projekts, bei Bedarf anpassen)
  await p.evaluate(() => document.querySelectorAll('.auftritt,.auftritt-gross,[data-auftritt]').forEach(e => e.classList.add('auftritt-da')));
  await p.waitForTimeout(1300);
  const f = `${ordner}/${String(i).padStart(2, '0')}.png`; await p.screenshot({ path: f }); kacheln.push([f, ist]);
}
await b.close();
execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
k = json.loads(sys.argv[1]); W, H, h = ${w}, ${H}, ${h}
c = Image.new('RGB', (W, H))
for f, y in k: c.paste(Image.open(f), (0, y))
c.save(sys.argv[2])`, JSON.stringify(kacheln), ziel]);
console.log(JSON.stringify({ ziel, hoehe: H, kacheln: kacheln.length, fehler }));

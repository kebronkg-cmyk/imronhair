import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const s = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await s.newPage();
const fehler = []; p.on('pageerror', e => fehler.push(String(e)));
await p.goto('http://localhost:8099/index.html');
await p.waitForTimeout(1500);
const lief = await p.evaluate(() => { const v=document.querySelector('.raum-film');
  return v ? { spielt: !v.paused, zeit: v.currentTime, quelle: v.currentSrc.split('/').pop(), breite: v.videoWidth } : null; });
console.log('Film:', JSON.stringify(lief));

// An mehreren Scrollstellen zwei Aufnahmen im Abstand von 400 ms vergleichen.
const stellen = [['Auftakt',0], ['Band',900], ['Leistungen',1600], ['Arbeiten',3200], ['Laden',4200], ['Kontakt',5200], ['Fuss',99999]];
for (const [name, y] of stellen) {
  await p.evaluate(v => scrollTo(0, v), y);
  await p.waitForTimeout(500);
  const a = await p.screenshot(); await p.waitForTimeout(400); const c = await p.screenshot();
  writeFileSync('ra.png', a); writeFileSync('rb.png', c);
  const { execSync } = await import('node:child_process');
  const FF='/tmp/ffs/node_modules/ffmpeg-static/ffmpeg';
  execSync(`${FF} -y -v error -i ra.png -vf format=gray -f rawvideo ra.raw`);
  execSync(`${FF} -y -v error -i rb.png -vf format=gray -f rawvideo rb.raw`);
  const { readFileSync } = await import('node:fs');
  const A=readFileSync('ra.raw'), B=readFileSync('rb.raw');
  let sum=0, stark=0;
  for (let i=0;i<A.length;i++){ const d=Math.abs(A[i]-B[i]); sum+=d; if(d>=2) stark++; }
  console.log(name.padEnd(12), 'mittlere Änderung', (sum/A.length).toFixed(2),
              ' Fläche mit >=2 Stufen', (100*stark/A.length).toFixed(1)+'%');
}
console.log('Konsolenfehler:', fehler.length ? fehler : 'keine');
await b.close();

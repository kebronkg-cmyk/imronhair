/* Der harte Fall: der Film kommt gar nicht. Dann muss das Standbild
   stehen, das Videofeld unsichtbar bleiben — und die Seite darf sich
   sonst nicht verändern. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const f = []; p.on('pageerror', e => f.push(String(e)));
await p.route('**/schere-rauch.{mp4,webm}', r => r.abort());
await p.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await p.waitForTimeout(3000);
const s = await p.evaluate(() => {
  const v = document.querySelector('.raum-film');
  const g = document.querySelector('.raum-grund');
  const t = document.querySelector('.wortmarke-wort');
  return { spielt: !v.paused && v.currentTime > 0,
           wartet: v.classList.contains('wartet'),
           deckung: getComputedStyle(v).opacity,
           grund: getComputedStyle(g).backgroundImage.split('/').pop().replace(/["')]/g,''),
           titelSichtbar: t ? getComputedStyle(t).opacity : null };
});
console.log('Film blockiert ', JSON.stringify({ ...s, fehler: f }));
await p.screenshot({ path: 'kn-ohne.png' });
await b.close();

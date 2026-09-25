// Überbreite finden: welche Elemente ragen rechts über den Schirm?
//   node breite.mjs <url> [breite=390]
import { chromium } from './pw.mjs';
const [url, w] = process.argv.slice(2);
const b = await (await chromium()).launch(); const p = await b.newPage({ viewport: { width: +(w || 390), height: 844 } });
await p.goto(url); await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(() => {
  const W = document.documentElement.clientWidth, out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    // Elemente in einer eigenen Scrollleiste (overflow-x: auto) zählen nicht.
    let s = el.parentElement, gescrollt = false;
    while (s) { if (/(auto|scroll)/.test(getComputedStyle(s).overflowX)) { gescrollt = true; break; } s = s.parentElement; }
    if (!gescrollt && r.right > W + 1 && r.width > 0) out.push([el.tagName.toLowerCase() + '.' + [...el.classList].join('.'), Math.round(r.left), Math.round(r.right)]);
  }
  return { W, scroll: document.documentElement.scrollWidth, ok: document.documentElement.scrollWidth <= W && out.length === 0, out: out.slice(0, 15) };
})));
await b.close();

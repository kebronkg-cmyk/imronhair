/* Echte Gesamtansicht: Fenster für Fenster aufnehmen und danach
   zusammensetzen. Ein fullPage-Bild lässt bei vielen Aufnahmen und einem
   fest verankerten Film Lücken — man sieht dann Löcher, die es nicht gibt. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [url, w, h, praefix] = process.argv.slice(2);
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport:{width:+w, height:+h}});
const f=[]; p.on('pageerror',e=>f.push(String(e)));
await p.goto(url, {waitUntil:'load'});
await p.evaluate(()=>{for(const i of document.querySelectorAll('img')) i.loading='eager';});
await p.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;})));});
// Warten, bis der Vorhang wirklich weg ist — sonst liegt er im Bild.
await p.waitForFunction(() => { const v = document.querySelector('.vorhang');
  return !v || getComputedStyle(v).display === 'none' || +getComputedStyle(v).opacity < 0.02; },
  null, { timeout: 9000 }).catch(()=>{});
await p.waitForTimeout(400);
const hoehe = await p.evaluate(()=>document.documentElement.scrollHeight);
const n = Math.ceil(hoehe / +h);
for (let i=0;i<n;i++){
  await p.evaluate(v=>scrollTo(0,v), i*+h);
  await p.waitForTimeout(500);
  await p.screenshot({path:`${praefix}-${String(i).padStart(2,'0')}.png`, animations:'allow'});
}
console.log(JSON.stringify({hoehe, teile:n, fehler:f}));
await b.close();

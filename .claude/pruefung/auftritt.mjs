import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({args:['--no-sandbox']});
for (const [w,h] of [[1440,900],[390,844]]) {
  const p=await b.newPage({viewport:{width:w,height:h}});
  const f=[]; p.on('pageerror',e=>f.push(String(e)));
  await p.goto('http://localhost:8099/index.html',{waitUntil:'load'});
  await p.waitForTimeout(500);
  const vorher = await p.evaluate(()=>({
    versteckt: [...document.querySelectorAll('.auftritt:not(.auftritt-da)')].length,
    gesamt: document.querySelectorAll('.auftritt').length }));
  const hoehe = await p.evaluate(()=>document.documentElement.scrollHeight);
  for (let y=0;y<hoehe;y+=h/2){ await p.evaluate(v=>scrollTo(0,v),y); await p.waitForTimeout(180); }
  await p.waitForTimeout(1200);
  const nachher = await p.evaluate(()=>({
    offen: document.querySelectorAll('.auftritt-da').length,
    zu: [...document.querySelectorAll('.auftritt:not(.auftritt-da)')].map(e=>e.className) }));
  console.log(w, JSON.stringify({...vorher, ...nachher, fehler:f}));
  await p.close();
}
await b.close();

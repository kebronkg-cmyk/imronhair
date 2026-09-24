import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1440,height:900}});
const f=[]; p.on('pageerror',e=>f.push(String(e)));
await p.route('**/schere-rauch.{mp4,webm}', r=>r.abort());   // Film kommt nie
await p.goto('http://localhost:8099/index.html',{waitUntil:'load'});
await p.waitForTimeout(2000);
console.log(JSON.stringify({...await p.evaluate(()=>{
  const v=document.querySelector('.raum-film'); const r=v.getBoundingClientRect();
  return {hoehe:Math.round(r.height), breite:Math.round(r.width), poster:!!v.poster,
          titelSichtbar:getComputedStyle(document.querySelector('.wortmarke')).opacity};
}), fehler:f}));
await p.screenshot({path:'ohne-film.png'});
await b.close();

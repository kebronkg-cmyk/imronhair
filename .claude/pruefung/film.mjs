import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [w,h,out] = process.argv.slice(2);
const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage({viewport:{width:+w,height:+h}});
const f=[]; p.on('pageerror',e=>f.push(String(e)));
await p.goto('http://localhost:8099/index.html',{waitUntil:'load'});
await p.waitForTimeout(2500);
const s=await p.evaluate(()=>{const v=document.querySelector('.raum-film');
  return {laeuft:v&&!v.paused, zeit:v?+v.currentTime.toFixed(2):null, dauer:v?+v.duration.toFixed(2):null,
          w:v?v.videoWidth:0, h:v?v.videoHeight:0};});
console.log(JSON.stringify({...s,fehler:f}));
await p.screenshot({path:out, animations:'allow'});
await b.close();

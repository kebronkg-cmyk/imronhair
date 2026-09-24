import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});

async function fall(name, vorbereiten, ruhig=false) {
  const p = await b.newPage({viewport:{width:390,height:844},
    reducedMotion: ruhig ? 'reduce' : 'no-preference'});
  const f=[]; p.on('pageerror',e=>f.push(String(e)));
  if (vorbereiten) await vorbereiten(p);
  const t0 = Date.now();
  await p.goto('http://localhost:8099/index.html',{waitUntil:'load'});
  await p.waitForTimeout(250);
  const frueh = await p.evaluate(() => {
    const v = document.querySelector('.vorhang');
    return v ? { da:true, deckung:+getComputedStyle(v).opacity.slice(0,4), sicht:getComputedStyle(v).display } : {da:false};
  });
  if (name === 'normal') await p.screenshot({path:'vh-fruech.png'});
  // warten, bis er weg ist
  let weg = null;
  for (let i=0;i<80;i++) {
    const s = await p.evaluate(() => {
      const v = document.querySelector('.vorhang');
      if (!v) return 'entfernt';
      const st = getComputedStyle(v);
      return (st.display === 'none' || +st.opacity < 0.02) ? 'weg' : null;
    });
    if (s) { weg = { zustand: s, nach: Date.now() - t0 }; break; }
    await p.waitForTimeout(100);
  }
  const klickbar = await p.evaluate(() => {
    const k = document.querySelector('.auftakt .knopf');
    if (!k) return null;
    const r = k.getBoundingClientRect();
    const o = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
    return o ? o.className || o.tagName : null;
  });
  console.log(name.padEnd(22), JSON.stringify({ frueh, weg, unterZeiger: klickbar, fehler: f }));
  await p.close();
}

await fall('normal', null);
await fall('ohne Film', p => p.route('**/schere-rauch.{mp4,webm}', r => r.abort()));
await fall('ohne Skript', p => p.route('**/neu.js', r => r.abort()));
await fall('ohne Bewegung', null, true);
await b.close();

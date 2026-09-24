import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
for (const [w,h] of [[1440,900],[390,844]]) {
  const p=await b.newPage({viewport:{width:w,height:h}});
  const f=[]; p.on('pageerror',e=>f.push(String(e)));
  await p.goto('http://localhost:8099/index.html',{waitUntil:'load'});
  await p.evaluate(()=>{for(const i of document.querySelectorAll('img'))i.loading='eager';});
  await p.evaluate(()=>document.querySelector('.werke-bahn').scrollIntoView({block:'center'}));
  await p.waitForTimeout(1200);
  const a=await p.evaluate(()=>{
    const zug=document.querySelector('.werke-zug');
    const s=[...document.querySelectorAll('.werke-satz')];
    return {t:getComputedStyle(zug).transform, saetze:s.length,
            breiten:s.map(x=>Math.round(x.getBoundingClientRect().width)),
            zugBreite:Math.round(zug.getBoundingClientRect().width),
            laeuft:zug.getAnimations().length,
            spielt:zug.getAnimations().map(x=>x.playState),
            bahnUeberlauf:getComputedStyle(document.querySelector('.werke-bahn')).overflow};
  });
  await p.waitForTimeout(1500);
  const t2=await p.evaluate(()=>getComputedStyle(document.querySelector('.werke-zug')).transform);
  console.log(w, JSON.stringify({...a, t2, bewegt:a.t!==t2, gleichBreit:a.breiten[0]===a.breiten[1],
    naht: a.breiten[0]*2===a.zugBreite, fehler:f}));
  await p.close();
}
// Ohne Bewegung
const q=await b.newPage({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
await q.goto('http://localhost:8099/index.html',{waitUntil:'load'});
await q.evaluate(()=>document.querySelector('.werke-bahn').scrollIntoView({block:'center'}));
await q.waitForTimeout(700);
console.log('ruhig', JSON.stringify(await q.evaluate(()=>{
  const zug=document.querySelector('.werke-zug');
  return {animationen:zug.getAnimations().length,
          zweiterSatz:getComputedStyle(document.querySelectorAll('.werke-satz')[1]).display,
          schiebbar:getComputedStyle(document.querySelector('.werke-bahn')).overflowX,
          sichtbar:[...document.querySelectorAll('.werke-satz img')].filter(i=>getComputedStyle(i).opacity==='1').length};
})));
await b.close();

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
for (const datei of ['index.html','leistungen.html'])
for (const [w,h] of [[1440,900],[390,844]]) {
  const p=await b.newPage({viewport:{width:w,height:h}});
  const f=[]; p.on('pageerror',e=>f.push(String(e)));
  await p.goto('http://localhost:8099/'+datei,{waitUntil:'load'});
  const hoehe=await p.evaluate(()=>document.documentElement.scrollHeight);
  for(let y=0;y<hoehe;y+=h/2){ await p.evaluate(v=>scrollTo(0,v),y); await p.waitForTimeout(100);}
  await p.waitForTimeout(700);
  const r = await p.evaluate(async ()=>{
    const aus=[];
    for (const d of document.querySelectorAll('.fach')) {
      d.open = true; await new Promise(r=>requestAnimationFrame(r));
      const z=[...d.querySelectorAll('.posten li')];
      const kaputt=z.filter(li=>{const s=getComputedStyle(li),b=li.getBoundingClientRect();
        return s.opacity!=='1'||s.visibility==='hidden'||b.height===0;}).length;
      // Preis muss rechts stehen, nicht am Wort kleben
      const kopf=d.querySelector('.fach-kopf');
      aus.push({zeilen:z.length, kaputt, grid:getComputedStyle(kopf).display,
                marker:getComputedStyle(kopf).listStyleType});
    }
    return {faecher:aus, verborgen:document.querySelectorAll('.auftritt:not(.auftritt-da)').length,
            ueberlauf:document.documentElement.scrollWidth>innerWidth+1};
  });
  const schlecht=r.faecher.filter(x=>x.kaputt>0||x.zeilen===0||x.grid!=='grid');
  console.log(datei, w, JSON.stringify({n:r.faecher.length, schlecht, verborgen:r.verborgen,
    ueberlauf:r.ueberlauf, fehler:f}));
  await p.close();
}
await b.close();

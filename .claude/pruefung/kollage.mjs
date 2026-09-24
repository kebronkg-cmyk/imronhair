import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport:{width:1440,height:900}});
await p.goto('http://localhost:8099/index.html',{waitUntil:'load'});
await p.evaluate(()=>{for(const i of document.querySelectorAll('img')) i.loading='eager';});
await p.waitForTimeout(2500);
const s = await p.evaluate(() => {
  const bilder = [...document.querySelectorAll('.werke-satz img')];
  return {
    anzahl: bilder.length,
    proSatz: document.querySelectorAll('.werke-satz')[0].children.length,
    braut: bilder.filter(i => i.src.includes('arbeit-braut.webp'))
                 .map(i => ({ geladen: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight })),
    ombre: bilder.filter(i => i.src.includes('ombre')).length,
    kaputt: bilder.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src.split('/').pop()),
  };
});
console.log(JSON.stringify(s));
await b.close();

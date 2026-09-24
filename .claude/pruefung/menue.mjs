import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const S='/tmp/claude-0/-home-user-bahaars-styling-studio/b589c048-5041-5874-91f5-4752a5abd3f1/scratchpad';
const b=await chromium.launch({args:['--no-sandbox']});
const fehler=[];
for (const [w,h,tag] of [[390,844,'h'],[1440,900,'d']]) {
  const p=await b.newPage({viewport:{width:w,height:h}});
  p.on('pageerror',e=>fehler.push(tag+' pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')fehler.push(tag+' console: '+m.text())});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'load'});
  const sicht = await p.evaluate(()=>({klapp:!!document.getElementById('klapp').offsetParent,
     wege:getComputedStyle(document.getElementById('wege')).display}));
  if (sicht.klapp) {
    await p.click('#klapp'); await p.waitForTimeout(400);
    await p.screenshot({path:`${S}/m-${tag}-auf.png`});
    console.log(tag,'nach Klick', JSON.stringify(await p.evaluate(()=>({
      auf:document.getElementById('klapp').getAttribute('aria-expanded'),
      display:getComputedStyle(document.getElementById('wege')).display,
      h:Math.round(document.getElementById('wege').getBoundingClientRect().height)}))));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    console.log(tag,'nach Escape', await p.getAttribute('#klapp','aria-expanded'));
  }
  console.log(tag, JSON.stringify(sicht));
  await p.close();
}
await b.close();
console.log('--- Fehler ---'); console.log(fehler.length?fehler.join('\n'):'keine');

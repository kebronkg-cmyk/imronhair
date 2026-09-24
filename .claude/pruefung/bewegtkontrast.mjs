/* Der Grund im Auftakt bewegt sich. Ein einzelnes Filmbild sagt nichts —
   gemessen wird die hellste Stelle hinter jeder Zeile über die ganze
   Schleife, also der wirklich ungünstigste Fall. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const FF = '/tmp/ffs/node_modules/ffmpeg-static/ffmpeg';
const lin = u => { u/=255; return u<=.04045 ? u/12.92 : ((u+.055)/1.055)**2.4; };
const L = (r,g,b) => .2126*lin(r)+.7152*lin(g)+.0722*lin(b);
const K = (a,b) => { const [h,d] = a>b?[a,b]:[b,a]; return (h+.05)/(d+.05); };

const [W,H] = (process.argv[2]||'1440x900').split('x').map(Number);
const ZIELE = ['.wortmarke-wort','.wortmarke-zusatz','.auftakt .lauf','.kennung','.stand-chip','.auftakt .knopf-still'];
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport:{width:W,height:H}});
await p.goto('http://localhost:8099/index.html?x='+Math.random(),{waitUntil:'load'});
await p.waitForFunction(()=>{const v=document.querySelector('.raum-film');return v&&v.readyState>=3;},null,{timeout:9000});
/* Erst wenn der Vorhang weg ist — sonst misst man seine eigene
   Wortmarke als "hellen Grund". */
await p.waitForFunction(()=>{const v=document.querySelector('.vorhang');
  return !v || getComputedStyle(v).display==='none' || +getComputedStyle(v).opacity<0.02;},null,{timeout:9000}).catch(()=>{});
await p.waitForTimeout(300);
const dauer = await p.evaluate(()=>{const v=document.querySelector('.raum-film');v.pause();return v.duration;});
const rects = await p.evaluate((sel)=>{const o={};
  for (const s of sel) { const e=document.querySelector(s); if(!e) continue;
    const r=e.getBoundingClientRect();
    /* Chromium gibt `oklch()` zurück. Über eine 1×1-Leinwand kommt
       daraus ein echter RGB-Wert. */
    const c=document.createElement('canvas'); c.width=c.height=1;
    const g=c.getContext('2d'); g.fillStyle=getComputedStyle(e).color; g.fillRect(0,0,1,1);
    const d=g.getImageData(0,0,1,1).data;
    o[s]={x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
          farbe:[d[0],d[1],d[2]], groesse:parseFloat(getComputedStyle(e).fontSize)};}
  return o;}, ZIELE);
/* Text weg, damit nur der Grund gemessen wird. */
/* Nur die Schrift verstecken, nicht den Block — der trägt seinen
   eigenen Schatten im ::before, und der gehört zum Grund. */
await p.addStyleTag({content:'.auftakt-satz > *, .kennung{visibility:hidden!important}'});
const schlecht = {};
const SCHRITTE = 20;
for (let i=0;i<SCHRITTE;i++){
  await p.evaluate(t=>{document.querySelector('.raum-film').currentTime=t;}, dauer*i/SCHRITTE);
  await p.waitForTimeout(180);
  await p.screenshot({path:'bk.png'});
  execSync(`${FF} -y -v error -i bk.png -vf format=rgb24 -f rawvideo bk.raw`);
  const px = readFileSync('bk.raw');
  for (const [sel,r] of Object.entries(rects)) {
    if (!r.w || !r.h) continue;
    let bestL = -1, best = null;
    for (let y=Math.max(0,r.y); y<Math.min(H,r.y+r.h); y++)
      for (let x=Math.max(0,r.x); x<Math.min(W,r.x+r.w); x++) {
        const k=(y*W+x)*3, l=L(px[k],px[k+1],px[k+2]);
        if (l>bestL){bestL=l;best=[px[k],px[k+1],px[k+2]];}
      }
    if (!schlecht[sel] || bestL > schlecht[sel].l) schlecht[sel] = {l:bestL, rgb:best, t:+(dauer*i/SCHRITTE).toFixed(2)};
  }
}
console.log(`Auftakt ${W}px — hellster Grund über die ganze Schleife`);
let fehler = 0;
for (const [sel,r] of Object.entries(rects)) {
  const s = schlecht[sel]; if (!s) continue;
  const k = K(L(r.farbe[0],r.farbe[1],r.farbe[2]), s.l);
  const noetig = r.groesse >= 24 ? 3 : 4.5;
  const ok = k >= noetig;
  if (!ok) fehler++;
  console.log((ok?'ok      ':'ZU WENIG').padEnd(9), k.toFixed(2)+':1', ('(nötig '+noetig+')').padStart(11),
    String(Math.round(r.groesse))+'px', ' hellster Grund rgb('+s.rgb.join(',')+') bei t='+s.t+'s ', sel);
}
console.log(fehler ? `\n${fehler} Stelle(n) unter der Grenze` : '\nalles über der Grenze');
await b.close();

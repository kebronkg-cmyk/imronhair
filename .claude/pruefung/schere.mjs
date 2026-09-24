/* Wo steht das Metall? Es ist hell und fast unbunt — der Rauch ist
   türkis. Damit lässt sich die Schere sauber vom Rauch trennen. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const FF='/tmp/ffs/node_modules/ffmpeg-static/ffmpeg';
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const [W,H] = (process.argv[2]||'1440x900').split('x').map(Number);
const p = await b.newPage({viewport:{width:W,height:H}});
await p.goto('http://localhost:8099/index.html?x='+Math.random(),{waitUntil:'load'});
await p.waitForFunction(()=>{const v=document.querySelector('.raum-film');return v&&v.readyState>=3;},null,{timeout:9000});
await p.evaluate(()=>{const v=document.querySelector('.raum-film');v.pause();v.currentTime=2.5;});
await p.waitForTimeout(600);
await p.addStyleTag({content:'main,.fuss,.leiste,.vorhang,.sprung,.raum-korn{visibility:hidden!important}'});
await p.waitForTimeout(250);
await p.screenshot({path:'sch.png'});
await b.close();
execSync(`${FF} -y -v error -i sch.png -vf format=rgb24 -f rawvideo sch.raw`);
const px = readFileSync('sch.raw');
const metall = new Uint8Array(W*H);
for (let i=0;i<W*H;i++){
  const r=px[i*3], g=px[i*3+1], bl=px[i*3+2];
  const max=Math.max(r,g,bl), min=Math.min(r,g,bl);
  const s = max ? (max-min)/max : 0;
  if (max > 95 && s < 0.22) metall[i]=1;      // hell und fast unbunt
}
let x0=W,x1=0,y0=H,y1=0,n=0;
for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (metall[y*W+x]) {
  n++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
}
console.log(`Metallfläche ${n} Punkte, Kasten x ${(100*x0/W).toFixed(0)}–${(100*x1/W).toFixed(0)}%  y ${(100*y0/H).toFixed(0)}–${(100*y1/H).toFixed(0)}%`);
let sp='Anteil Metall je Zehntel der Breite: ';
for (let k=0;k<10;k++){ let c=0;
  for (let y=0;y<H;y++) for (let x=Math.floor(k*W/10);x<Math.floor((k+1)*W/10);x++) if (metall[y*W+x]) c++;
  sp += (100*c/(W*H/10)).toFixed(1)+' ';
}
console.log(sp);
let zl='Anteil Metall je Zehntel der Höhe:   ';
for (let k=0;k<10;k++){ let c=0;
  for (let y=Math.floor(k*H/10);y<Math.floor((k+1)*H/10);y++) for (let x=0;x<W;x++) if (metall[y*W+x]) c++;
  zl += (100*c/(W*H/10)).toFixed(1)+' ';
}
console.log(zl);

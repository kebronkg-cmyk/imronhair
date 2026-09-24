/* Wieviel vom Metall der Schere liegt unter dem Textblock — und unter
   seinem Schatten? Das ist die Zahl, um die es geht. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const FF='/tmp/ffs/node_modules/ffmpeg-static/ffmpeg';
const [W,H] = (process.argv[2]||'1440x900').split('x').map(Number);
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport:{width:W,height:H}});
await p.goto('http://localhost:8099/index.html?x='+Math.random(),{waitUntil:'load'});
await p.waitForFunction(()=>{const v=document.querySelector('.raum-film');return v&&v.readyState>=3;},null,{timeout:9000});
await p.evaluate(()=>{const v=document.querySelector('.raum-film');v.pause();v.currentTime=2.5;});
await p.waitForTimeout(600);
const kasten = await p.evaluate(()=>{
  const e=document.querySelector('.auftakt-satz'); const r=e.getBoundingClientRect();
  const s=getComputedStyle(e,'::before');
  return {x:r.x,y:r.y,w:r.width,h:r.height};
});
/* Nackter Film, ohne Schleier, Schatten, Korn und Schrift. */
await p.addStyleTag({content:`main,.fuss,.leiste,.vorhang,.sprung,.raum-korn{visibility:hidden!important}
  .auftakt-schleier{display:none!important}.auftakt-satz::before{display:none!important}`});
await p.waitForTimeout(250);
await p.screenshot({path:'d-nackt.png'});
/* Und so, wie es die Besucherin sieht — mit allem. */
await p.addStyleTag({content:`main,.fuss{visibility:visible!important}
  .auftakt-schleier{display:block!important}.auftakt-satz::before{display:block!important}
  .raum-korn{visibility:visible!important}`});
await p.waitForTimeout(250);
await p.screenshot({path:'d-echt.png'});
await b.close();
for (const f of ['d-nackt','d-echt'])
  execSync(`${FF} -y -v error -i ${f}.png -vf format=rgb24 -f rawvideo ${f}.raw`);
const A=readFileSync('d-nackt.raw'), B=readFileSync('d-echt.raw');
const istMetall=(px,i)=>{const r=px[i*3],g=px[i*3+1],b=px[i*3+2];
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b); return mx>95 && (mx?(mx-mn)/mx:0)<0.22;};
let gesamt=0, sichtbar=0, imBlock=0;
for (let y=0;y<H;y++) for (let x=0;x<W;x++){
  const i=y*W+x;
  if (!istMetall(A,i)) continue;
  gesamt++;
  if (istMetall(B,i)) sichtbar++;
  if (x>=kasten.x && x<=kasten.x+kasten.w && y>=kasten.y && y<=kasten.y+kasten.h) imBlock++;
}
console.log(`${W}px  Metall gesamt ${gesamt}  davon nach Schleier+Schatten+Korn noch als Metall sichtbar ${(100*sichtbar/gesamt).toFixed(0)}%  im Kasten des Textblocks ${(100*imBlock/gesamt).toFixed(0)}%`);

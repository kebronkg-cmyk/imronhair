/* Steht irgendwo eine senkrechte Kante im Auftakt? Eine echte Kante
   zeigt sich als schmale Spalte mit auffällig hohem Sprung über viele
   Zeilen hinweg. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const FF='/tmp/ffs/node_modules/ffmpeg-static/ffmpeg';
const W=1440,H=900;
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport:{width:W,height:H}});
await p.goto('http://localhost:8099/index.html?x='+Math.random(),{waitUntil:'load'});
await p.waitForFunction(()=>{const v=document.querySelector('.raum-film');return v&&v.readyState>=3;},null,{timeout:9000});
await p.evaluate(()=>{const v=document.querySelector('.raum-film');v.pause();v.currentTime=2.5;});
await p.waitForTimeout(600);
const ohne = process.argv[2] === 'ohne';
await p.addStyleTag({content:'.auftakt-satz > *{visibility:hidden!important}main,.fuss,.leiste,.vorhang,.sprung{visibility:hidden!important}'
  + (ohne ? '.auftakt-satz::before{display:none!important}' : '')});
await p.waitForTimeout(250);
await p.screenshot({path: ohne ? 'ka-ohne.png' : 'ka.png'});
await b.close();
const datei = ohne ? 'ka-ohne' : 'ka';
execSync(`${FF} -y -v error -i ${datei}.png -vf format=gray -f rawvideo ${datei}.raw`);
const px=readFileSync(datei+'.raw');
const spalte=[];
for (let x=1;x<W-1;x++){ let s=0;
  for (let y=0;y<H;y++) s+=Math.abs(px[y*W+x+1]-px[y*W+x-1]);
  spalte.push(s/H);
}
const mit=spalte.reduce((a,b)=>a+b,0)/spalte.length;
const paare=spalte.map((v,i)=>[v,i+1]).sort((a,b)=>b[0]-a[0]).slice(0,6);
console.log((ohne?'ohne Schatten: ':'mit  Schatten: ')+'mittlerer Sprung', mit.toFixed(2));
console.log('stärkste Spalten:', paare.map(([v,x])=>`x=${x} (${v.toFixed(2)}, ${(v/mit).toFixed(1)}×)`).join('  '));

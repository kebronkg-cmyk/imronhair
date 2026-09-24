import { readFileSync } from 'node:fs';
const N=180*180, b=readFileSync('alle.raw'), k=b.length/N;
let max=0, summe=0; const alle=[];
for (let i=0;i<b.length;i++){ if(b[i]>max)max=b[i]; summe+=b[i]; alle.push(b[i]); }
alle.sort((a,c)=>a-c);
const p=q=>alle[Math.floor(alle.length*q)];
console.log('Bilder', k, ' Mittel', (summe/b.length).toFixed(1));
console.log('Perzentile  50%',p(.5),' 90%',p(.9),' 99%',p(.99),' 99.9%',p(.999),' max',max);

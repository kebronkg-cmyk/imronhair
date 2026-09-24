import { readFileSync } from 'node:fs';
const W=1440,H=1440, ideal=readFileSync('m-ideal.raw');
for (const d of process.argv.slice(2)) {
  const p=readFileSync(d); let s=0,max=0;
  for (let i=0;i<W*H;i++){ const e=Math.abs(p[i]-ideal[i]); s+=e; if(e>max)max=e; }
  console.log(d.padEnd(16), 'mittlere Abweichung', (s/(W*H)).toFixed(3), ' groesste', max);
}

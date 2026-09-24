import { readFileSync } from 'node:fs';
const N=160*160, b=readFileSync('quelle.raw'), K=b.length/N, FPS=24;
const m=[]; for(let f=0;f<K;f++){let s=0;for(let i=0;i<N;i++)s+=b[f*N+i];m.push(s/N);}
function kurve(a,L,D){
  const d=[];
  for(let i=0;i<L-D;i++) d.push(m[a+D+i]);
  for(let j=0;j<D;j++){const w=j/D; d.push((1-w)*m[a+L+j]+w*m[a+j]);}
  return d;
}
function zeig(name,a,L,D){
  const d=kurve(a,L,D);
  /* Über eine halbe Sekunde geglättet: so sieht das Auge eine
     Helligkeitsänderung, nicht Bild für Bild. */
  const g=12, s=[];
  for(let i=0;i<d.length;i++){let t=0;for(let j=0;j<g;j++)t+=d[(i+j)%d.length];s.push(t/g);}
  let maxRate=0, wo=0;
  for(let i=0;i<s.length;i++){const r=Math.abs(s[(i+1)%s.length]-s[i])*FPS; if(r>maxRate){maxRate=r;wo=i;}}
  const mit=s.reduce((x,y)=>x+y,0)/s.length;
  let zeile=''; for(let i=0;i<d.length;i+=6) zeile+=s[i].toFixed(1)+' ';
  console.log(name);
  console.log('   Verlauf:', zeile);
  console.log('   Spanne', (Math.max(...s)-Math.min(...s)).toFixed(2),
              ' stärkste Änderung', maxRate.toFixed(2)+'/s =', (100*maxRate/mit).toFixed(1)+'%/s',
              ' bei Sekunde', (wo/FPS).toFixed(1));
}
zeig('heute  7,0 s / 1,0 s Überblendung', 0, 168, 24);
zeig('A      4,3 s / 1,5 s', 0, 102, 36);
zeig('B      5,0 s / 2,0 s', 0, 120, 48);
zeig('C      6,0 s / 2,5 s', 0, 144, 60);

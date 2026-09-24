import { readFileSync } from 'node:fs';
const W=160,H=160,N=W*H, b=readFileSync('quelle.raw'), K=b.length/N, FPS=24;

const bild = f => b.subarray(f*N,(f+1)*N);
const mittelAll = [], schere = [];
for (let f=0;f<K;f++){
  const p = bild(f); let s=0; for (let i=0;i<N;i++) s+=p[i]; mittelAll.push(s/N);
  let t=0,n=0; for(let y=50;y<120;y++)for(let x=60;x<100;x++){t+=p[y*W+x];n++;} schere.push(t/n);
}
const unterschied = (f,g)=>{const A=bild(f),B=bild(g);let s=0;for(let i=0;i<N;i++)s+=Math.abs(A[i]-B[i]);return s/N;};

function bewerte(a, L, D) {           // a Startbild, L Schleifenlänge, D Überblendung (Bilder)
  if (a < 0 || a + L + D > K) return null;
  const d = [];
  for (let i=0;i<L-D;i++) d.push(mittelAll[a+D+i]);
  let geist = 0;
  for (let j=0;j<D;j++){
    const w = j/D;
    d.push((1-w)*mittelAll[a+L+j] + w*mittelAll[a+j]);
    geist += unterschied(a+L+j, a+j) * Math.min(w, 1-w) * 2;   // Doppelbild wiegt in der Mitte am schwersten
  }
  geist /= D;
  let maxAend = 0;
  for (let i=0;i<d.length;i++){
    const n = d[(i+1)%d.length];
    maxAend = Math.max(maxAend, Math.abs(n-d[i])*FPS);          // Einheiten je Sekunde
  }
  const spanne = Math.max(...d)-Math.min(...d);
  let sch=0; for(let i=0;i<L;i++) sch += schere[a+D+i<K?a+D+i:K-1]; sch/=L;
  return { a, L, D, sek:+(L/FPS).toFixed(1), ueberblend:+(D/FPS).toFixed(1),
           spanne:+spanne.toFixed(1), maxProSek:+maxAend.toFixed(1),
           geist:+geist.toFixed(1), schere:+sch.toFixed(1) };
}

console.log('heutige Fassung:');
console.log(' ', JSON.stringify(bewerte(0, 7*FPS, 1*FPS)));
console.log('\nSuche (Schleife 4–6 s, Überblendung 1–2,5 s):');
const treffer = [];
for (let a=0; a<=Math.floor(2.2*FPS); a+=6)
  for (let L=4*FPS; L<=6*FPS; L+=6)
    for (let D=FPS; D<=Math.floor(2.5*FPS); D+=6) {
      const r = bewerte(a,L,D); if (r) treffer.push(r);
    }
treffer.sort((x,y)=> (x.maxProSek + x.geist*0.5 - x.schere*0.05) - (y.maxProSek + y.geist*0.5 - y.schere*0.05));
for (const r of treffer.slice(0,10)) console.log(' ', JSON.stringify(r));

console.log('\nBeste Fassung je Schleifenlänge:');
for (let sek=4; sek<=7; sek+=0.5) {
  const L = Math.round(sek*FPS); let best=null;
  for (let a=0; a<=Math.floor(2.5*FPS); a+=6)
    for (let D=FPS; D<=Math.floor(3*FPS); D+=6) {
      const r = bewerte(a,L,D); if (!r) continue;
      const wert = r.maxProSek + r.geist*0.5 - r.schere*0.05;
      if (!best || wert < best.w) best = { w: wert, r };
    }
  if (best) console.log('  '+sek+' s:', JSON.stringify(best.r));
}

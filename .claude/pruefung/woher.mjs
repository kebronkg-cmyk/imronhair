import { readFileSync } from 'node:fs';
const W=160,H=160,N=W*H, b=readFileSync('quelle.raw'), k=b.length/N;
/* Die Schere steht in der Mitte, der Rauch aussen. Getrennt messen:
   wächst die Helligkeit überall, oder kommt nur mehr Rauch dazu? */
function mittel(f, x0,y0,x1,y1) {
  let s=0,n=0;
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ s+=b[f*N+y*W+x]; n++; }
  return s/n;
}
/* Und: wieviel Fläche ist überhaupt "Rauch" (über einer Schwelle)? */
function flaeche(f, schwelle) {
  let n=0; for (let i=0;i<N;i++) if (b[f*N+i]>schwelle) n++;
  return 100*n/N;
}
console.log('  t   Schere(Mitte)  Rand(Rauch)  Fläche>60  Fläche>120  hellste');
for (let f=0; f<k; f+=24) {
  let max=0; for (let i=0;i<N;i++) if (b[f*N+i]>max) max=b[f*N+i];
  console.log(('  '+(f/24).toFixed(0)).slice(-3),
    mittel(f,60,50,100,120).toFixed(1).padStart(12),
    mittel(f,0,0,45,160).toFixed(1).padStart(12),
    flaeche(f,60).toFixed(1).padStart(10),
    flaeche(f,120).toFixed(1).padStart(11),
    String(max).padStart(9));
}

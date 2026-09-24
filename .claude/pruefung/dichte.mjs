import { readFileSync } from 'node:fs';
const N = 160*160, b = readFileSync('quelle.raw'), k = b.length/N;
const d = [];
for (let f = 0; f < k; f++) {
  let s = 0;
  for (let i = 0; i < N; i++) s += b[f*N+i];
  d.push(s/N);
}
console.log('Bilder:', k);
// Verlauf in Zehntelsekunden-Schritten zeigen
let zeile = '';
for (let f = 0; f < k; f += 4) zeile += (f/24).toFixed(1)+':'+d[f].toFixed(0)+'  ';
console.log(zeile);
const min = Math.min(...d), max = Math.max(...d);
console.log('Dichte min', min.toFixed(1), ' max', max.toFixed(1), ' Spanne', (max-min).toFixed(1),
            ' = ', (100*(max-min)/max).toFixed(0)+'% des Höchstwerts');
console.log('erstes Bild', d[0].toFixed(1), ' letztes', d[k-1].toFixed(1),
            ' Sprung an der Naht', Math.abs(d[k-1]-d[0]).toFixed(1));

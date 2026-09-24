import { readFileSync } from 'node:fs';
export function energie(datei, W, H) {
  const p = readFileSync(datei); let s = 0, n = 0;
  for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++) {
    const i=y*W+x; s += Math.hypot(p[i+1]-p[i-1], p[i+W]-p[i-W]); n++;
  }
  return s/n;
}

import { readFileSync } from 'node:fs';
const W = 1440, H = 1440;
function energie(datei) {
  const p = readFileSync(datei);
  let s = 0, n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = p[i + 1] - p[i - 1], gy = p[i + W] - p[i - W];
    s += Math.hypot(gx, gy); n++;
  }
  return s / n;
}
for (const d of process.argv.slice(2)) console.log(d.padEnd(14), energie(d).toFixed(3));

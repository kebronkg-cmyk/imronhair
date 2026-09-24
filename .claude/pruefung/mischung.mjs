const lin = u => { u/=255; return u<=.04045 ? u/12.92 : ((u+.055)/1.055)**2.4; };
const gam = v => 255*(v<=.0031308 ? 12.92*v : 1.055*v**(1/2.4)-.055);
function oklch2rgb(L,C,H){
  const A=C*Math.cos(H*Math.PI/180), B2=C*Math.sin(H*Math.PI/180);
  const l=(L+.3963377774*A+.2158037573*B2)**3;
  const m=(L-.1055613458*A-.0638541728*B2)**3;
  const s=(L-.0894841775*A-1.2914855480*B2)**3;
  return [ 4.0767416621*l-3.3077115913*m+.2309699292*s,
          -1.2684380046*l+2.6097574011*m-.3413193965*s,
          -.0041960863*l-.7034186147*m+1.7076147010*s].map(v=>Math.max(0,Math.min(255,gam(v))));
}
const L=([r,g,b])=>.2126*lin(r)+.7152*lin(g)+.0722*lin(b);
const K=(a,b)=>{const [h,d]=a>b?[a,b]:[b,a];return (h+.05)/(d+.05);};
const scheibe = oklch2rgb(0.11, 0.012, 200);
const texte = { hell:[.965,.012,190], leise:[.84,.022,195], still:[.70,.026,200], lagune:[.80,.136,193] };
console.log('Plattenton sRGB', scheibe.map(v=>Math.round(v)).join(','));
for (const alpha of [.955,.94,.93,.92,.91,.90,.88,.86]) {
  const zeilen = [];
  for (const [name,[l,c,h]] of Object.entries(texte)) {
    const lt = L(oklch2rgb(l,c,h));
    let schlecht = Infinity, wo = 0;
    for (const film of [0, 112, 181, 220, 252]) {
      const g = scheibe.map(v => alpha*v + (1-alpha)*film);
      const k = K(lt, L(g));
      if (k < schlecht) { schlecht = k; wo = film; }
    }
    zeilen.push(`${name} ${schlecht.toFixed(2)}`);
  }
  console.log(`--durch ${alpha}  Bewegung ${((1-alpha)*20.8).toFixed(2)} sRGB  |  ${zeilen.join('  ')}`);
}

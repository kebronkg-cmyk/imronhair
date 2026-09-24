// rgb → oklch und zurück, ohne Abhängigkeiten.
const lin = u => { u/=255; return u<=.04045 ? u/12.92 : ((u+.055)/1.055)**2.4; };
const gam = v => 255*(v<=.0031308 ? 12.92*v : 1.055*v**(1/2.4)-.055);
function rgb2oklch(r,g,b){
  const R=lin(r),G=lin(g),B=lin(b);
  const l=Math.cbrt(.4122214708*R+.5363325363*G+.0514459929*B);
  const m=Math.cbrt(.2119034982*R+.6806995451*G+.1073969566*B);
  const s=Math.cbrt(.0883024619*R+.2817188376*G+.6299787005*B);
  const L=.2104542553*l+.7936177850*m-.0040720468*s;
  const A=1.9779984951*l-2.4285922050*m+.4505937099*s;
  const Bb=.0259040371*l+.7827717662*m-.8086757660*s;
  const C=Math.hypot(A,Bb); let H=Math.atan2(Bb,A)*180/Math.PI; if(H<0)H+=360;
  return [L,C,H];
}
function oklch2rgb(L,C,H){
  const A=C*Math.cos(H*Math.PI/180), B2=C*Math.sin(H*Math.PI/180);
  const l=(L+.3963377774*A+.2158037573*B2)**3;
  const m=(L-.1055613458*A-.0638541728*B2)**3;
  const s=(L-.0894841775*A-1.2914855480*B2)**3;
  return [ 4.0767416621*l-3.3077115913*m+.2309699292*s,
          -1.2684380046*l+2.6097574011*m-.3413193965*s,
          -.0041960863*l-.7034186147*m+1.7076147010*s].map(v=>Math.round(Math.max(0,Math.min(255,gam(v)))));
}
for(const arg of process.argv.slice(2)){
  if(arg.includes('oklch')){
    const [L,C,H]=arg.replace(/oklch\(|\)|%/g,'').trim().split(/\s+/).map(Number);
    const [r,g,b]=oklch2rgb(L/100,C,H);
    console.log(arg,'->','rgb('+r+','+g+','+b+')  #'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''));
  } else {
    const [r,g,b]=arg.split(',').map(Number);
    const [L,C,H]=rgb2oklch(r,g,b);
    console.log(`rgb(${r},${g},${b}) -> oklch(${(L*100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(0)})`);
  }
}

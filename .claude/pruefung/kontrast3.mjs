import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

/* Kontrast gegen den wirklich gerenderten Grund: einmal mit Text,
   einmal ohne. Aus der Aufnahme ohne Text wird die hellste Stelle hinter
   jeder Zeile genommen — der ungünstigste Fall. Die Farben werden über
   eine 1×1-Leinwand ausgelesen, weil Chromium `oklch()` zurückgibt. */

const [W,H] = (process.argv[2]||'1440x900').split('x').map(Number);
const datei = process.argv[3] || 'index.html';
const PROBEN = process.argv[4] ? process.argv[4].split(',') :
  ['.kennung','.braue','.lauf','.lese','.gross','.wortmarke-wort','.wortmarke-zusatz',
   '.wand-titel','.knopf','.knopf-still','.marke-wort','.marke-zusatz','.wege a','.pille',
   '.stand','.zeichen b','.beleg dt','.beleg dd','.karte dt','.karte dd',
   '.posten-name','.posten-name em','.posten-preis b','.posten-preis i',
   '.navigator-bahn a','.merk-stand','.merk-summe','.zeiten th','.zeiten td',
   '.fuss-wege a','.fuss-recht','.recht p','.recht a','.daten dt','.daten dd',
   '.gruppe-wort','.spruch','.spruch cite','.braut-preis','.stand-gross','.mehr']

const b = await chromium.launch({args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:W,height:H}});
//
await p.goto('http://127.0.0.1:8099/'+datei,{waitUntil:'load'});
await p.evaluate(()=>{for(const i of document.querySelectorAll('img'))i.loading='eager';});
await p.evaluate(()=>{ for (const d of document.querySelectorAll('details')) d.open = true; });
if (await p.$('#hebel')) { await p.focus('#hebel'); await p.keyboard.press('End'); }
await p.waitForTimeout(2500);

// Volle Seitenhöhe abbilden, damit auch Zeilen weiter unten geprüft werden
const hoehe = await p.evaluate(()=>document.documentElement.scrollHeight);
await p.setViewportSize({width:W, height: Math.min(hoehe, 8000)});
await p.waitForTimeout(900);

await p.evaluate(()=>window.scrollTo(0,0));
await p.waitForTimeout(300);
const felder = await p.evaluate((sel)=>{
  const c=document.createElement('canvas'); c.width=c.height=1;
  const g=c.getContext('2d',{willReadFrequently:true});
  const rgb=(f)=>{g.fillStyle='#000';g.fillRect(0,0,1,1);g.fillStyle=f;g.fillRect(0,0,1,1);
                  const d=g.getImageData(0,0,1,1).data;return [d[0],d[1],d[2]];};
  const out=[];
  for (const s of sel) for (const el of document.querySelectorAll(s)) {
    const r=el.getBoundingClientRect();
    if (!r.width||!r.height||r.top<0) continue;
    const st=getComputedStyle(el);
    if (st.visibility==='hidden'||st.display==='none') continue;
    let hg=null, n=el;
    while (n && n!==document.documentElement) {
      const bg=getComputedStyle(n).backgroundColor;
      if (bg && bg!=='rgba(0, 0, 0, 0)') { const q=rgb(bg); if (getComputedStyle(n).backgroundColor.includes('/')||true){hg=q;} break; }
      n=n.parentElement;
    }
    /* Hat das Feld einen eigenen deckenden Grund, wird gegen den gerechnet.
       Sonst versteckt `visibility:hidden` beim Messen auch diesen Grund,
       und ein gefüllter Knopf meldet 1,05:1 statt seiner echten Zahl. */
    const eig = st.backgroundColor;
    const deckend = eig && !/rgba\(.*,\s*0\)$/.test(eig) && eig !== 'transparent';
    out.push({sel:s, farbe:rgb(st.color), eigenerGrund: deckend ? rgb(eig) : null,
              groesse:parseFloat(st.fontSize), gewicht:Number(st.fontWeight),
              x:Math.round(r.x+window.scrollX), y:Math.round(r.y+window.scrollY),
              w:Math.round(r.width), h:Math.round(r.height)});
    break;
  }
  return out;
}, PROBEN);

await p.addStyleTag({content: PROBEN.join(',')+'{visibility:hidden !important}'});
await p.waitForTimeout(400);
const roh = await p.screenshot({fullPage:true});
await b.close();

const {writeFileSync, readFileSync} = await import('node:fs');
writeFileSync('/tmp/k-ohne.png', roh);
const {execFileSync} = await import('node:child_process');
execFileSync('/tmp/ffs/node_modules/ffmpeg-static/ffmpeg',
  ['-hide_banner','-loglevel','error','-i','/tmp/k-ohne.png','-pix_fmt','rgb24','-f','rawvideo','/tmp/k-ohne.rgb','-y']);
const buf = readFileSync('/tmp/k-ohne.rgb');
/* Die Breite nicht annehmen, sondern aus dem PNG lesen: stimmt sie
   nicht, verschiebt sich jede Zeile ein Stück weiter, und weit unten
   misst man irgendeinen Punkt. Genau daran ist die Messung des Fusses
   gescheitert. */
const kopf = readFileSync('/tmp/k-ohne.png');
const BW = kopf.readUInt32BE(16), PH = kopf.readUInt32BE(20);
const BH = Math.floor(buf.length/3/BW);
if (BW !== W) console.log(`  (Bildbreite ${BW} statt ${W} — Zeilen entsprechend gerechnet)`);
if (BH !== PH) console.log(`  (Bildhöhe ${BH} statt ${PH})`);

const lin=v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;};
const L=([r,g,b2])=>0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b2);
const verh=(a,b2)=>{const x=L(a),y=L(b2);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
const hex=c=>'#'+c.map(n=>n.toString(16).padStart(2,'0')).join('');

console.log(`${datei} ${W}px — Kontrast gegen den gerenderten Grund\n`);
let schlecht=0;
for (const f of felder) {
  /* Der ungünstigste Grund hängt von der Schriftfarbe ab: helle Schrift
     scheitert an der hellsten Stelle, dunkle an der dunkelsten. Vorher
     wurde immer die hellste genommen — bei dunkler Schrift ist das der
     GÜNSTIGSTE Fall, und die Messung log. */
  const dunkleSchrift = L(f.farbe) < 0.18;
  let best = dunkleSchrift ? Infinity : -1, pxl = f.eigenerGrund || [0,0,0];
  if (!f.eigenerGrund)
  for (let y=f.y; y<Math.min(f.y+f.h,BH); y++)
    for (let x=f.x; x<Math.min(f.x+f.w,BW); x++) {
      const i=(y*BW+x)*3, c=[buf[i],buf[i+1],buf[i+2]], l=L(c);
      if (dunkleSchrift ? l<best : l>best){best=l;pxl=c;}
    }
  const v=verh(f.farbe,pxl);
  const gross=f.groesse>=24||(f.groesse>=18.66&&f.gewicht>=700);
  const noetig=gross?3:4.5;
  const ok=v>=noetig; if(!ok)schlecht++;
  console.log(`${ok?'ok      ':'ZU WENIG'} ${v.toFixed(2).padStart(6)}:1 (nötig ${noetig})  ${String(Math.round(f.groesse)).padStart(3)}px  ${hex(f.farbe)} auf ${hex(pxl)}  ${f.sel}${ok?'':`   @${f.x},${f.y} ${f.w}×${f.h}`}`);
}
console.log(schlecht?`\n${schlecht} Stelle(n) unter der Grenze`:'\nalles über der Grenze');

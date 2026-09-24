/* Läuft der Film ohne jede Berührung an — und bleibt das Videofeld
   dabei durchgehend sichtbar? Ein weggeblendetes Feld war die Ursache;
   es darf nie wieder vorkommen. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({args:['--no-sandbox','--autoplay-policy=document-user-activation-required']});
const p = await b.newPage({viewport:{width:390,height:844}});
const f=[]; p.on('pageerror',e=>f.push(String(e)));
await p.goto('http://localhost:8099/index.html?x='+Math.random(),{waitUntil:'load'});
let minDeckung = 1, jeVersteckt = false;
for (let i=0;i<40;i++){
  const s = await p.evaluate(()=>{const v=document.querySelector('.raum-film');
    return {d:+getComputedStyle(v).opacity, w:v.classList.contains('wartet'), t:v.currentTime, p:v.paused};});
  minDeckung = Math.min(minDeckung, s.d);
  if (s.w) jeVersteckt = true;
  if (s.t > 0 && !s.p) { 
    const eig = await p.evaluate(()=>{const v=document.querySelector('.raum-film');
      return {stumm:v.muted, inline:v.playsInline, quelle:v.currentSrc.split('/').pop()};});
    console.log('läuft nach', (i*150)+' ms  ohne Berührung  ', JSON.stringify(eig),
                ' kleinste Deckung', minDeckung, ' je versteckt:', jeVersteckt, ' Fehler:', f.length?f:'keine');
    await b.close(); process.exit(0);
  }
  await p.waitForTimeout(150);
}
console.log('lief NICHT von selbst an  kleinste Deckung', minDeckung, ' Fehler:', f);
await b.close();

/* Die Seitentafel: rechts am Bildschirm (am Handy von unten), für einen
   Termin, eine Kundin, eine Person. Immer nur eine offen; Esc oder ein
   Tipp daneben schließt sie, der Fokus kehrt dorthin zurück, woher er kam. */

import { $, el, svg, ZEICHEN } from './hilfen.js';

let zurueck = null;
let beimSchliessen = null;

export const tafelOffen = () => !$('tafel').hidden;

/** Öffnet die Tafel. inhalt: Elemente; Rückgabe: der Körper zum Füllen. */
export function tafelAuf({ titel, unter = '', breit = false, schliessen = null }) {
  const t = $('tafel');
  if (t.hidden) zurueck = document.activeElement;
  beimSchliessen = schliessen;
  const koerper = el('div', { klasse: 'tafel-koerper' });
  t.classList.toggle('ist-breit', breit);
  t.replaceChildren(
    el('div', { klasse: 'tafel-kopf' },
      el('div', { klasse: 'tafel-titelzeile' },
        el('h2', { klasse: 'tafel-titel', id: 'tafel-titel', text: titel }),
        unter ? el('p', { klasse: 'tafel-unter', text: unter }) : null),
      el('button', { type: 'button', klasse: 'tafel-zu', 'aria-label': 'Schließen', onclick: tafelZu }, svg(ZEICHEN.zu))),
    koerper);
  t.hidden = false;
  $('tafel-grund').hidden = false;
  document.body.classList.add('mit-tafel');
  requestAnimationFrame(() => t.classList.add('ist-da'));
  t.focus({ preventScroll: true });
  return koerper;
}

export function tafelZu() {
  const t = $('tafel');
  if (t.hidden) return;
  t.classList.remove('ist-da');
  t.hidden = true;
  $('tafel-grund').hidden = true;
  document.body.classList.remove('mit-tafel');
  const f = beimSchliessen; beimSchliessen = null;
  f?.();
  if (zurueck && zurueck.isConnected) zurueck.focus({ preventScroll: true });
}

export function tafelTitel(titel, unter) {
  const h = $('tafel-titel');
  if (h) h.textContent = titel;
  const u = $('tafel').querySelector('.tafel-unter');
  if (u && unter !== undefined) u.textContent = unter;
}

$('tafel-grund').addEventListener('click', tafelZu);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && tafelOffen() && !$('frage').open) { e.preventDefault(); tafelZu(); }
  // Fokus in der Tafel halten (nur auf großen Bildschirmen modal wirkend).
  if (e.key === 'Tab' && tafelOffen()) {
    const t = $('tafel');
    const f = [...t.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Kalender: Tag (Spalte je Person), Woche (Spalte je Tag), Liste

   Ein Termin ist so hoch wie seine Dauer; die Einwirkzeit ist heller und
   gestrichelt — in ihr kann ein anderer Termin liegen, er wird dann leicht
   eingerückt darübergelegt. Nebeneinander rücken Termine nur, wenn sie sich
   in der Arbeitszeit wirklich überschneiden (bewusste Doppelbelegung).
   Ziehen verschiebt (auch zu einer anderen Person), der Griff unten ändert
   die Dauer. Am Touchbildschirm wird nicht gezogen — dort scrollt man;
   verschoben wird über die Tafel.
   ═══════════════════════════════════════════════════════════════════════ */

import { $, el, svg, ZEICHEN, euro, dauerText, TAG, tagText, alsDatum, plusTage, heute, minuten, hhmm,
  wochentag, montag, jetztMin, kundenName, meldung, fragen, summePhasen } from './hilfen.js';
import { Z, api, personVon, salonVon } from './api.js';
import { terminZeigen, terminNeu, abwesenheitZeigen } from './termin.js';

let flaeche = null;
let daten = null;
let ladeNr = 0;
let jetztUhr = null;
let feinZeiger = matchMedia('(hover: hover) and (pointer: fine)').matches;

const ANSICHTEN = [['tag', 'Tag'], ['woche', 'Woche'], ['liste', 'Liste']];
const PPM = () => (matchMedia('(max-width: 47.99rem)').matches ? 1.35 : 1.6);   // Pixel je Minute

export function zeigen(f) {
  flaeche = f;
  // Die Woche zeigt eine Person — bei vier nebeneinander wird jede Spalte zu schmal.
  if (Z.personWoche === null) Z.personWoche = (personVon(Z.ich.id)?.salons.includes(Z.salon) ? Z.ich.id : undefined);
  if (!f.querySelector('.kal-leiste')) {
    f.replaceChildren(el('div', { klasse: 'kal-leiste', id: 'kal-leiste' }), el('div', { klasse: 'kal-bau', id: 'kal-bau' }));
  }
  leisteZeichnen();
  laden();
}
export function verlassen() { clearInterval(jetztUhr); }
export function neuLaden() { laden(true); }

export function taste(e) {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft') blaettern(-1);
  else if (k === 'arrowright') blaettern(1);
  else if (k === 't' || k === 'h') { Z.datum = heute(); zeigen(flaeche); }
  else if (k === 'n') neuerTermin();
  else if (k === '1' || k === '2' || k === '3') { Z.ansicht = ANSICHTEN[+k - 1][0]; zeigen(flaeche); }
}

function blaettern(richtung) {
  Z.datum = plusTage(Z.datum, richtung * (Z.ansicht === 'woche' ? 7 : 1));
  zeigen(flaeche);
}

function neuerTermin(vorgabe = {}) {
  terminNeu({ salon: Z.salon, datum: Z.datum, ...vorgabe }, () => laden(true));
}

/* ── Leiste ─────────────────────────────────────────────────────────── */
function leisteZeichnen() {
  const l = $('kal-leiste');
  const salons = el('div', { klasse: 'schalter', role: 'group', 'aria-label': 'Salon' },
    Z.s.salons.map((s) => el('button', { type: 'button', 'aria-pressed': String(s.id === Z.salon), text: s.name,
      onclick: () => { Z.salon = s.id; Z.personWoche = null; try { localStorage.setItem('studio-salon', s.id); } catch (e) { /* privat */ } zeigen(flaeche); } })));
  const datumFeld = el('input', { type: 'date', klasse: 'datum-feld', value: Z.datum, 'aria-label': 'Datum wählen',
    onchange: (e) => { if (e.target.value) { Z.datum = e.target.value; zeigen(flaeche); } } });
  const woche = Z.ansicht === 'woche';
  const mo = montag(Z.datum);
  const titel = woche
    ? `${alsDatum(mo).getDate()}. – ${tagText(plusTage(mo, 6)).replace(/^\w+, /, '')}`
    : tagText(Z.datum, 'lang');
  const nav = el('div', { klasse: 'datum-nav' },
    el('button', { type: 'button', klasse: 'rund', 'aria-label': woche ? 'Vorige Woche' : 'Voriger Tag', onclick: () => blaettern(-1) }, svg(ZEICHEN.links)),
    el('button', { type: 'button', klasse: 'heute-knopf', text: 'Heute', disabled: !woche && Z.datum === heute() ? true : null, onclick: () => { Z.datum = heute(); zeigen(flaeche); } }),
    el('button', { type: 'button', klasse: 'rund', 'aria-label': woche ? 'Nächste Woche' : 'Nächster Tag', onclick: () => blaettern(1) }, svg(ZEICHEN.rechts)),
    el('label', { klasse: 'datum-titel' }, el('span', { text: titel }), datumFeld));
  const ansichten = el('div', { klasse: 'schalter schalter-klein', role: 'group', 'aria-label': 'Ansicht' },
    ANSICHTEN.map(([id, name]) => el('button', { type: 'button', 'aria-pressed': String(Z.ansicht === id), text: name,
      onclick: () => { Z.ansicht = id; zeigen(flaeche); } })));
  l.replaceChildren(salons, nav, ansichten,
    el('p', { klasse: 'tagesinfo', id: 'tagesinfo' }),
    el('button', { type: 'button', klasse: 'knopf neu-knopf', onclick: () => neuerTermin() }, svg(ZEICHEN.plus), el('span', { text: 'Termin' })));
}

/* ── Laden ──────────────────────────────────────────────────────────── */
async function laden(still = false) {
  const nr = ++ladeNr;
  const woche = Z.ansicht === 'woche';
  const von = woche ? montag(Z.datum) : Z.datum;
  const bis = woche ? plusTage(von, 6) : Z.datum;
  const bau = $('kal-bau');
  if (!still) bau.classList.add('ist-laden');
  try {
    const d = await api('kalender', { get: { salon: Z.salon, von, bis } });
    if (nr !== ladeNr) return;
    daten = d;
    bau.classList.remove('ist-laden');
    zeichnen();
  } catch (e) {
    if (nr !== ladeNr) return;
    bau.classList.remove('ist-laden');
    bau.replaceChildren(el('p', { klasse: 'leer', text: e.message }));
  }
}

function zeichnen() {
  const bau = $('kal-bau');
  const scroll = bau.querySelector('.kal-scroll');
  const oben = scroll ? scroll.scrollTop : null;
  const links = scroll ? scroll.scrollLeft : 0;
  clearInterval(jetztUhr);
  tagesinfo();
  if (Z.ansicht === 'liste') bau.replaceChildren(liste());
  else bau.replaceChildren(raster(Z.ansicht === 'woche'));
  const neu = bau.querySelector('.kal-scroll');
  if (neu) {
    if (oben !== null) { neu.scrollTop = oben; neu.scrollLeft = links; }
    else requestAnimationFrame(() => {
      // Beim ersten Zeichnen: zur aktuellen Uhrzeit (heute) oder zum ersten Termin.
      const ziel = neu.querySelector('.kal-jetzt') || neu.querySelector('.termin');
      if (ziel) neu.scrollTop = Math.max(0, ziel.offsetTop - 120);
    });
  }
}

function tagesinfo() {
  const t = daten.termine.filter((x) => x.status !== 'storniert');
  const summe = t.reduce((s, x) => s + (x.status === 'nicht_erschienen' ? 0 : x.preis_cent || 0), 0);
  const ab = t.some((x) => x.preis_ab || x.preis_cent === null);
  const info = $('tagesinfo');
  if (!info) return;
  info.textContent = t.length ? `${t.length} ${t.length === 1 ? 'Termin' : 'Termine'} · ${ab ? 'ab ' : ''}${euro(summe)}` : 'Keine Termine';
}

/* ── Hilfen für Arbeitszeiten ───────────────────────────────────────── */
function arbeitAm(pid, datum) {
  return (daten.arbeitszeiten[pid] || {})[wochentag(datum)] || [];
}
function abwesendAm(pid, datum) {
  return daten.abwesenheiten.filter((a) => (a.person === pid || a.person === null) && a.von.slice(0, 10) <= datum && a.bis.slice(0, 10) >= datum)
    .map((a) => ({ ...a, a: a.von.slice(0, 10) < datum ? 0 : minuten(a.von), b: a.bis.slice(0, 10) > datum ? 1440 : minuten(a.bis) }));
}
const terminBereich = (t) => [minuten(t.start), minuten(t.start) + (Date.parse(t.ende.replace(' ', 'T')) - Date.parse(t.start.replace(' ', 'T'))) / 60000];
function arbeitsTeile(t) {
  let x = minuten(t.start);
  const aus = [];
  for (const [art, m] of t.phasen) { if (art === 'arbeit') aus.push([x, x + m]); x += m; }
  return aus;
}
const schneiden = (a, b) => a.some(([x, y]) => b.some(([u, v]) => x < v && u < y));

/** Wer steht an diesem Tag im Salon? Arbeitszeit, Termin oder Abwesenheit. */
function personenAm(datum) {
  const ids = new Set();
  for (const [pid, tage] of Object.entries(daten.arbeitszeiten)) if ((tage[wochentag(datum)] || []).length) ids.add(pid);
  for (const t of daten.termine) if (t.start.startsWith(datum)) ids.add(t.person);
  return Z.s.personen.filter((p) => ids.has(p.id) && (p.aktiv || daten.termine.some((t) => t.person === p.id))).map((p) => p.id);
}

/* ── Zeitraster (Tag und Woche) ─────────────────────────────────────── */
function raster(woche) {
  const ppm = PPM();
  const tage = woche ? Array.from({ length: 7 }, (_, i) => plusTage(montag(Z.datum), i)) : [Z.datum];
  // Spalten: am Tag je Person, in der Woche je Tag.
  const spalten = woche
    ? tage.map((d) => ({ datum: d, person: Z.personWoche, schluessel: d }))
    : personenAm(Z.datum).map((pid) => ({ datum: Z.datum, person: pid, schluessel: pid }));
  const salon = salonVon(Z.salon);

  if (!spalten.length) {
    return el('div', { klasse: 'leer-gross' },
      el('p', { klasse: 'leer-titel', text: `${tagText(Z.datum, 'lang')}: in ${salon.name} arbeitet niemand.` }),
      el('p', { klasse: 'leer', text: 'Arbeitszeiten stehen unter Team. Ein Termin lässt sich trotzdem anlegen.' }),
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Termin anlegen', onclick: () => neuerTermin() }));
  }

  // Sichtbarer Bereich: Öffnung, Arbeitszeiten und Termine, auf volle Stunden.
  let a = 24 * 60, b = 0;
  for (const d of tage) {
    for (const [x, y] of salon.oeffnung[wochentag(d)] || []) { a = Math.min(a, x); b = Math.max(b, y); }
    for (const pid of Object.keys(daten.arbeitszeiten)) for (const [x, y] of arbeitAm(pid, d)) { a = Math.min(a, x); b = Math.max(b, y); }
  }
  for (const t of daten.termine) { const [x, y] = terminBereich(t); a = Math.min(a, x); b = Math.max(b, y); }
  if (a >= b) { a = 9 * 60; b = 18 * 60; }
  a = Math.max(0, Math.floor((a - 30) / 60) * 60);
  b = Math.min(24 * 60, Math.ceil((b + 30) / 60) * 60);
  const hoehe = (b - a) * ppm;
  const y = (m) => (m - a) * ppm;

  const kopf = el('div', { klasse: 'kal-kopf' }, el('div', { klasse: 'kal-ecke' }));
  const koerper = el('div', { klasse: 'kal-koerper', stil: { height: hoehe + 'px' } });
  const rinne = el('div', { klasse: 'kal-rinne', 'aria-hidden': 'true' });
  for (let m = a; m < b; m += 60) rinne.append(el('span', { klasse: 'kal-stunde', stil: { top: y(m) + 'px' }, text: hhmm(m) }));
  koerper.append(rinne);

  for (const sp of spalten) {
    const termine = daten.termine.filter((t) => t.start.startsWith(sp.datum) && (!sp.person || t.person === sp.person));
    kopf.append(spaltenKopf(sp, termine, woche));
    const spalte = el('div', {
      klasse: 'kal-spalte', daten: { person: sp.person || '', datum: sp.datum },
      stil: { '--stunde': 60 * ppm + 'px', '--viertel': 15 * ppm + 'px', '--versatz': (-(a % 60) * ppm) + 'px' },
    });
    // Außerhalb der Arbeitszeit: dunkler Grund.
    const arbeit = woche
      ? (sp.person ? arbeitAm(sp.person, sp.datum) : salon.oeffnung[wochentag(sp.datum)] || [])
      : arbeitAm(sp.person, sp.datum);
    let frei = a;
    for (const [x, z] of [...arbeit].sort((p, q) => p[0] - q[0])) {
      if (x > frei) spalte.append(el('div', { klasse: 'kal-zu', stil: { top: y(frei) + 'px', height: (x - frei) * ppm + 'px' } }));
      frei = Math.max(frei, z);
    }
    if (frei < b) spalte.append(el('div', { klasse: 'kal-zu', stil: { top: y(frei) + 'px', height: (b - frei) * ppm + 'px' } }));
    // Abwesenheiten.
    if (!woche || sp.person) {
      for (const ab of abwesendAm(sp.person, sp.datum)) {
        const x = Math.max(a, ab.a), z = Math.min(b, ab.b);
        if (z <= x) continue;
        spalte.append(el('button', { type: 'button', klasse: 'kal-abw', stil: { top: y(x) + 'px', height: (z - x) * ppm + 'px' },
          onclick: (e) => { e.stopPropagation(); abwesenheitZeigen(ab, () => laden(true)); } },
          el('span', { text: ABW[ab.art] || ab.art }), ab.notiz ? el('small', { text: ab.notiz }) : null));
      }
    } else {
      // Woche ohne Personenwahl: salonweite Sperren.
      for (const ab of abwesendAm('__salon__', sp.datum).filter((x) => x.person === null)) {
        const x = Math.max(a, ab.a), z = Math.min(b, ab.b);
        if (z > x) spalte.append(el('div', { klasse: 'kal-abw', stil: { top: y(x) + 'px', height: (z - x) * ppm + 'px' } }, el('span', { text: ABW[ab.art] || ab.art })));
      }
    }
    // Termine derselben Person im anderen Salon.
    if (sp.person) {
      for (const w of daten.woanders.filter((w) => w.person === sp.person && w.start.startsWith(sp.datum))) {
        const x = minuten(w.start), z = minuten(w.ende);
        spalte.append(el('div', { klasse: 'kal-woanders', stil: { top: y(x) + 'px', height: (z - x) * ppm + 'px' } },
          el('span', { text: 'in ' + (salonVon(w.salon)?.name || w.salon) })));
      }
    }
    for (const b2 of anordnen(termine, woche)) spalte.append(terminBlock(b2, y, ppm, woche));
    spalteBedienen(spalte, a, ppm);
    koerper.append(spalte);
  }

  // Jetzt: die LED-Linie quer über alle Spalten des heutigen Tages.
  const heuteIdx = tage.indexOf(heute());
  if (heuteIdx >= 0) {
    const linie = el('div', { klasse: 'kal-jetzt', 'aria-hidden': 'true' });
    const setzen = () => {
      const m = jetztMin();
      linie.hidden = m < a || m > b;
      linie.style.top = y(m) + 'px';
      if (woche) linie.style.gridColumn = `${heuteIdx + 2} / span 1`;
    };
    setzen();
    linie.classList.toggle('in-woche', woche);
    koerper.append(linie);
    jetztUhr = setInterval(setzen, 30000);
  }

  const n = spalten.length;
  const breite = woche ? 'minmax(7.5rem, 1fr)' : 'minmax(10.5rem, 1fr)';
  const rahmen = el('div', { klasse: 'kal' + (woche ? ' kal-woche' : ''), stil: { '--spalten': n, '--spaltenbreite': breite } }, kopf, koerper);
  const teile = [];
  if (woche) teile.push(wochenPersonen());
  teile.push(el('div', { klasse: 'kal-scroll' }, rahmen));
  return el('div', { klasse: 'kal-rahmen' }, teile);
}

const ABW = { urlaub: 'Urlaub', krank: 'Krank', pause: 'Pause', schulung: 'Schulung', frei: 'Frei', geschlossen: 'Geschlossen' };

function spaltenKopf(sp, termine, woche) {
  const aktiv = termine.filter((t) => t.status !== 'storniert');
  if (woche) {
    const d = alsDatum(sp.datum);
    return el('button', { type: 'button', klasse: 'kal-spaltenkopf' + (sp.datum === heute() ? ' ist-heute' : ''),
      onclick: () => { Z.datum = sp.datum; Z.ansicht = 'tag'; zeigen(flaeche); } },
      el('span', { klasse: 'kal-kopf-name', text: `${TAG[d.getDay()]} ${d.getDate()}.` }),
      el('span', { klasse: 'kal-kopf-info', text: aktiv.length ? `${aktiv.length} Termine` : '—' }));
  }
  const p = personVon(sp.person);
  const arbeit = arbeitAm(sp.person, sp.datum);
  const zeiten = arbeit.length ? arbeit.map(([x, y]) => `${hhmm(x).replace(/^0/, '').replace(':00', '')}–${hhmm(y).replace(/^0/, '').replace(':00', '')}`).join(', ') : 'frei';
  return el('div', { klasse: 'kal-spaltenkopf', stil: { '--farbe': `var(--person-${p?.farbe || 1})` } },
    el('span', { klasse: 'kal-kopf-zeichen', 'aria-hidden': 'true', text: (p?.name || '?').charAt(0) }),
    el('span', { klasse: 'kal-kopf-name', text: p?.name || sp.person }),
    el('span', { klasse: 'kal-kopf-info', text: `${zeiten} · ${aktiv.length || 'keine'} ${aktiv.length === 1 ? 'Termin' : 'Termine'}` }));
}

function wochenPersonen() {
  const ids = [...new Set(Object.keys(daten.arbeitszeiten))];
  const personen = Z.s.personen.filter((p) => ids.includes(p.id) && p.aktiv);
  return el('div', { klasse: 'schalter schalter-klein wochen-personen', role: 'group', 'aria-label': 'Person' },
    el('button', { type: 'button', 'aria-pressed': String(!Z.personWoche), text: 'Alle', onclick: () => { Z.personWoche = undefined; zeichnen(); } }),
    personen.map((p) => el('button', { type: 'button', 'aria-pressed': String(Z.personWoche === p.id), text: p.name,
      onclick: () => { Z.personWoche = p.id; zeichnen(); } })));
}

/**
 * Termine einer Spalte anordnen. Überschneiden sich zwei in der Arbeitszeit
 * (oder in der Woche überhaupt, weil dort mehrere Personen in einer Spalte
 * stehen), bekommen sie Bahnen nebeneinander. Liegt einer nur in der
 * Einwirkzeit eines anderen, wird er eingerückt darübergelegt.
 */
function anordnen(termine, woche) {
  const liste = termine.filter((t) => t.status !== 'storniert').map((t) => ({ t, bereich: terminBereich(t), teile: arbeitsTeile(t), bahn: 0, bahnen: 1, tiefe: 0 }))
    .sort((p, q) => p.bereich[0] - q.bereich[0] || q.bereich[1] - p.bereich[1]);
  const stoss = (p, q) => (woche && p.t.person !== q.t.person) ? p.bereich[0] < q.bereich[1] && q.bereich[0] < p.bereich[1] : schneiden(p.teile, q.teile);
  // Gruppen, die sich stoßen (zusammenhängend), bekommen gemeinsame Bahnen.
  for (let i = 0; i < liste.length; i++) {
    const belegt = new Set();
    for (let j = 0; j < i; j++) {
      const p = liste[j], q = liste[i];
      if (stoss(p, q)) belegt.add(p.bahn);
      else if (p.bereich[0] < q.bereich[1] && q.bereich[0] < p.bereich[1] && p.bahn === q.bahn) q.tiefe = Math.max(q.tiefe, p.tiefe + 1);
    }
    let bahn = 0;
    while (belegt.has(bahn)) bahn++;
    liste[i].bahn = bahn;
  }
  // Breite je Gruppe: größte Bahn aller, mit denen man sich stößt (transitiv).
  for (const p of liste) {
    const gruppe = new Set([p]);
    let wachsen = true;
    while (wachsen) {
      wachsen = false;
      for (const q of liste) if (!gruppe.has(q) && [...gruppe].some((r) => stoss(r, q))) { gruppe.add(q); wachsen = true; }
    }
    p.bahnen = Math.max(...[...gruppe].map((q) => q.bahn)) + 1;
  }
  return liste;
}

const STATUS = { gebucht: '', erschienen: 'erschienen', nicht_erschienen: 'nicht erschienen', storniert: 'storniert' };

function terminBlock(b, y, ppm, woche) {
  const t = b.t;
  const [start, ende] = b.bereich;
  const p = personVon(t.person);
  const name = kundenName(t);
  const was = t.posten.map((x) => x.name).join(' + ') || 'Termin';
  const neu = t.kunde && t.kunde.besuche <= 1 && t.status === 'gebucht';
  const block = el('div', {
    klasse: `termin ist-${t.status}` + (b.tiefe ? ' in-pause' : '') + (t.quelle === 'online' ? ' ist-online' : ''),
    role: 'button', tabindex: '0', daten: { id: t.id },
    'aria-label': `${t.start.slice(11)} bis ${t.ende.slice(11)}, ${name}, ${was}${STATUS[t.status] ? ', ' + STATUS[t.status] : ''}`,
    stil: {
      top: y(start) + 'px', height: Math.max(18, (ende - start) * ppm - 2) + 'px',
      '--farbe': `var(--person-${p?.farbe || 1})`, '--bahn': b.bahn, '--bahnen': b.bahnen, '--tiefe': b.tiefe,
    },
  });
  // Phasen als Streifen: die Einwirkzeit hell und gestrichelt.
  let x = start;
  for (const [art, m] of t.phasen) {
    if (art === 'pause') block.append(el('div', { klasse: 'termin-pause', stil: { top: (x - start) * ppm + 'px', height: m * ppm + 'px' } },
      m * ppm >= 26 ? el('span', { text: 'Einwirkzeit' }) : null));
    x += m;
  }
  // Platz bis zur ersten Einwirkzeit (oder bis zum Ende): davon hängt ab,
  // wie viele Zeilen stehen — nie eine halb abgeschnittene.
  const platz = t.phasen[0][1] * ppm - 4;
  block.classList.add(platz < 30 ? 'ist-knapp' : platz < 46 ? 'ist-zweizeilig' : 'ist-voll');
  const inhalt = el('div', { klasse: 'termin-inhalt' },
    el('span', { klasse: 'termin-zeit', text: `${t.start.slice(11)}${woche && p ? ' · ' + p.name : ''}` }),
    el('span', { klasse: 'termin-name' }, name,
      neu ? el('span', { klasse: 'termin-marke', title: 'Erster Besuch', text: 'neu' }) : null,
      t.kundennotiz || t.notiz ? el('span', { klasse: 'termin-marke', title: 'Mit Notiz', text: '✎' }) : null),
    el('span', { klasse: 'termin-was', text: was }));
  block.append(inhalt);
  if (t.status === 'erschienen') block.append(el('span', { klasse: 'termin-haken', 'aria-hidden': 'true' }, svg(ZEICHEN.haken)));
  if (feinZeiger && t.status === 'gebucht') block.append(el('span', { klasse: 'termin-griff', 'aria-hidden': 'true' }));
  block.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); terminZeigen(t.id, () => laden(true)); } });
  return block;
}

/* ── Ziehen, Dauer ändern, freie Stelle antippen ────────────────────── */
function spalteBedienen(spalte, anfang, ppm) {
  const minuteBei = (clientY) => {
    const r = spalte.getBoundingClientRect();
    return anfang + (clientY - r.top) / ppm;
  };
  // Freie Stelle: neuer Termin mit Person und Uhrzeit (auf 15 Minuten).
  spalte.addEventListener('click', (e) => {
    if (e.target.closest('.termin, .kal-abw') || zug.bewegt) return;
    const start = Math.floor(minuteBei(e.clientY) / 15) * 15;
    neuerTermin({ datum: spalte.dataset.datum, person: spalte.dataset.person || null, zeit: hhmm(Math.max(0, Math.min(start, 1425))) });
  });
  spalte.addEventListener('pointerdown', (e) => {
    const block = e.target.closest('.termin');
    if (!block || e.button !== 0) return;
    const t = daten.termine.find((x) => x.id === +block.dataset.id);
    if (!t) return;
    zug.start(e, block, t, spalte, ppm);
  });
}

/* Ein Zug: vom pointerdown bis pointerup. Klick ohne Bewegung öffnet die
   Tafel. Das gedrückte Element merken wir uns selbst — setPointerCapture
   würde das spätere click-Ereignis umlenken. */
const zug = {
  aktiv: null,
  bewegt: false,
  start(e, block, t, spalte, ppm) {
    const griff = e.target.classList.contains('termin-griff');
    const beruehrung = e.pointerType !== 'mouse';
    this.aktiv = { block, t, spalte, ppm, x0: e.clientX, y0: e.clientY, griff, beruehrung, dy: 0, ziel: spalte, hoehe0: block.offsetHeight };
    this.bewegt = false;
    const bewegen = (ev) => this.bewegen(ev);
    const los = (ev) => {
      removeEventListener('pointermove', bewegen);
      removeEventListener('pointerup', los);
      removeEventListener('pointercancel', los);
      this.ende(ev);
    };
    addEventListener('pointermove', bewegen);
    addEventListener('pointerup', los);
    addEventListener('pointercancel', los);
  },
  bewegen(e) {
    const z = this.aktiv;
    if (!z || z.beruehrung || z.t.status !== 'gebucht') return;
    const dx = e.clientX - z.x0, dy = e.clientY - z.y0;
    if (!this.bewegt && Math.hypot(dx, dy) < 6) return;
    if (!this.bewegt) { this.bewegt = true; z.block.classList.add('ist-gezogen'); document.body.classList.add('zieht'); }
    e.preventDefault();
    const schritt = 5 * z.ppm;
    z.dy = Math.round(dy / schritt) * schritt;
    if (z.griff) {
      const h = Math.max(10 * z.ppm, z.hoehe0 + z.dy);
      z.block.style.height = h + 'px';
      z.block.dataset.neu = `bis ${hhmm(minuten(z.t.start) + Math.round(h / z.ppm / 5) * 5)}`;
      return;
    }
    // Spalte unter dem Zeiger (Tag: Person, Woche: Datum).
    const unter = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList?.contains('kal-spalte'));
    if (unter && unter !== z.ziel) z.ziel = unter;
    const versatzX = z.ziel.getBoundingClientRect().left - z.spalte.getBoundingClientRect().left;
    z.block.style.transform = `translate(${versatzX}px, ${z.dy}px)`;
    const m = minuten(z.t.start) + Math.round(z.dy / z.ppm / 5) * 5;
    z.block.dataset.neu = hhmm(m) + (z.ziel !== z.spalte && z.ziel.dataset.person ? ' · ' + (personVon(z.ziel.dataset.person)?.name || '') : '');
  },
  async ende() {
    const z = this.aktiv;
    this.aktiv = null;
    if (!z) return;
    if (!this.bewegt) {
      setTimeout(() => { this.bewegt = false; }, 0);
      terminZeigen(z.t.id, () => laden(true));
      return;
    }
    document.body.classList.remove('zieht');
    setTimeout(() => { this.bewegt = false; }, 0);
    const t = z.t;
    const aenderung = { id: t.id, version: t.version };
    let text;
    if (z.griff) {
      const neueDauer = Math.max(10, Math.round(z.block.offsetHeight / z.ppm / 5) * 5);
      const alt = summePhasen(t.phasen);
      if (neueDauer === alt) return zurueck(z);
      // Die letzte Arbeitsphase wächst oder schrumpft.
      const ph = t.phasen.map((p) => [...p]);
      const letzte = ph.length - 1;
      ph[letzte][1] = Math.max(5, ph[letzte][1] + (neueDauer - alt));
      aenderung.phasen = ph;
      text = `Dauer ${dauerText(summePhasen(ph))}`;
    } else {
      const m = minuten(t.start) + Math.round(z.dy / z.ppm / 5) * 5;
      if (m < 0 || m > 1435) return zurueck(z);
      const datum = z.ziel.dataset.datum;
      aenderung.start = `${datum} ${hhmm(m)}`;
      if (z.ziel.dataset.person && z.ziel.dataset.person !== t.person) aenderung.person = z.ziel.dataset.person;
      if (aenderung.start === t.start && !aenderung.person) return zurueck(z);
      text = `${tagText(datum)} ${hhmm(m)}${aenderung.person ? ' bei ' + personVon(aenderung.person).name : ''}`;
    }
    await speichern(aenderung, text, z);
  },
};
function zurueck(z) { z.block.style.transform = ''; z.block.style.height = ''; z.block.classList.remove('ist-gezogen'); delete z.block.dataset.neu; }

async function speichern(aenderung, text, z, trotzdem = false) {
  try {
    const alt = daten.termine.find((x) => x.id === aenderung.id);
    await api('termin_aendern', { post: { ...aenderung, trotzdem } });
    meldung(`Verschoben: ${text}`, 'ok', alt ? { text: 'Rückgängig', tun: () => rueckgaengig(alt) } : null);
    laden(true);
  } catch (e) {
    if (e.daten.code === 'konflikt' && !trotzdem) {
      const ok = await fragen({ titel: 'Überschneidung', text: 'Dort ist schon etwas eingetragen:', liste: e.daten.konflikte.map((k) => k.text), ja: 'Trotzdem verschieben' });
      if (ok) return speichern(aenderung, text, z, true);
    } else {
      meldung(e.message, 'fehler');
    }
    zurueck(z);
    laden(true);
  }
}
async function rueckgaengig(alt) {
  const jetzt = await api('termin_verlauf', { get: { id: alt.id } });
  await api('termin_aendern', { post: { id: alt.id, version: jetzt.version, start: alt.start, person: alt.person, phasen: alt.phasen, trotzdem: true } });
  meldung('Zurückgenommen.', 'ok');
  laden(true);
}

/* ── Liste (Tagesübersicht, am Handy die erste Ansicht) ─────────────── */
function liste() {
  const d = Z.datum;
  const termine = daten.termine.filter((t) => t.start.startsWith(d)).sort((p, q) => (p.start < q.start ? -1 : 1));
  const f = document.createDocumentFragment();
  // Spontan frei: wer heute noch Luft hat — für Laufkundschaft am Telefon.
  const luecken = [];
  for (const pid of personenAm(d)) {
    const arbeit = arbeitAm(pid, d);
    if (!arbeit.length) continue;
    const belegt = daten.termine.filter((t) => t.person === pid && t.start.startsWith(d) && t.status !== 'storniert').flatMap(arbeitsTeile)
      .concat(abwesendAm(pid, d).map((x) => [x.a, x.b])).sort((p, q) => p[0] - q[0]);
    const ab = d === heute() ? Math.ceil(jetztMin() / 15) * 15 : 0;
    const frei = [];
    for (const [x, y] of arbeit) {
      let t0 = Math.max(x, ab);
      for (const [u, v] of belegt) {
        if (v <= t0 || u >= y) continue;
        if (u - t0 >= 30) frei.push([t0, u]);
        t0 = Math.max(t0, v);
      }
      if (y - t0 >= 30) frei.push([t0, y]);
    }
    if (frei.length) luecken.push({ pid, frei });
  }
  if (luecken.length) {
    f.append(el('section', { klasse: 'luecken', 'aria-label': 'Noch frei' },
      el('h2', { klasse: 'abschnitt-titel', text: d === heute() ? 'Heute noch frei' : 'Frei an diesem Tag' }),
      el('ul', { klasse: 'luecken-liste' }, luecken.map(({ pid, frei }) => el('li', { stil: { '--farbe': `var(--person-${personVon(pid)?.farbe || 1})` } },
        el('span', { klasse: 'luecken-name', text: personVon(pid)?.name || pid }),
        el('span', { klasse: 'luecken-zeiten' }, frei.slice(0, 4).map(([x, y]) => el('button', {
          type: 'button', klasse: 'luecke', text: `${hhmm(x)}–${hhmm(y)}`,
          onclick: () => neuerTermin({ datum: d, person: pid, zeit: hhmm(x) }),
        }))))))));
  }
  const offen = termine.filter((t) => t.status !== 'storniert');
  const ul = el('ol', { klasse: 'agenda' });
  if (!offen.length) ul.append(el('li', { klasse: 'leer', text: 'Keine Termine an diesem Tag.' }));
  for (const t of termine) {
    const p = personVon(t.person);
    ul.append(el('li', { klasse: `agenda-zeile ist-${t.status}`, stil: { '--farbe': `var(--person-${p?.farbe || 1})` } },
      el('button', { type: 'button', klasse: 'agenda-haupt', onclick: () => terminZeigen(t.id, () => laden(true)) },
        el('span', { klasse: 'agenda-zeit' }, el('strong', { text: t.start.slice(11) }), el('small', { text: t.ende.slice(11) })),
        el('span', { klasse: 'agenda-text' },
          el('span', { klasse: 'agenda-name' }, kundenName(t), t.kunde && t.kunde.besuche <= 1 && t.status === 'gebucht' ? el('span', { klasse: 'termin-marke', text: 'neu' }) : null),
          el('span', { klasse: 'agenda-was', text: t.posten.map((x) => x.name + (x.laenge ? ' · ' + x.laenge : '')).join(' + ') }),
          t.kundennotiz ? el('span', { klasse: 'agenda-notiz', text: '„' + t.kundennotiz + '“' }) : null),
        el('span', { klasse: 'agenda-person' }, el('span', { klasse: 'punkt', 'aria-hidden': 'true' }), p?.name || t.person)),
      t.status === 'gebucht' && d <= heute() ? el('button', {
        type: 'button', klasse: 'agenda-da', 'aria-label': `${kundenName(t)} ist erschienen`, title: 'Erschienen',
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { await api('termin_aendern', { post: { id: t.id, version: t.version, status: 'erschienen' } }); laden(true); }
          catch (err) { meldung(err.message, 'fehler'); laden(true); }
        },
      }, svg(ZEICHEN.haken)) : el('span', { klasse: 'agenda-status', text: STATUS[t.status] })));
  }
  f.append(el('section', { 'aria-label': 'Termine' }, el('h2', { klasse: 'abschnitt-titel', text: `${tagText(d, 'lang')} · ${salonVon(Z.salon).name}` }), ul));
  return el('div', { klasse: 'liste-bau' }, f);
}


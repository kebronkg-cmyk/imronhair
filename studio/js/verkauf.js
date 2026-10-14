/* ═══════════════════════════════════════════════════════════════════════
   Verkauf: Gutscheine, Aktionscodes, Lager

   Kassiert wird an der Kasse des Salons. Hier steht, was gilt: welcher
   Gutschein noch wie viel wert ist, welcher Code was abzieht, wie viel
   Olaplex noch im Regal steht. Einlösen geht ganz vorn, mit einem Feld —
   so schnell wie an der Theke nötig.
   ═══════════════════════════════════════════════════════════════════════ */

import { $, el, fuellen, svg, ZEICHEN, euro, tagText, heute, meldung, fragen, spaeter } from './hilfen.js';
import { Z, api, inhaberin, leitung, salonVon } from './api.js';
import { tafelAuf, tafelZu } from './tafel.js';

const REITER = [['gutscheine', 'Gutscheine'], ['codes', 'Aktionscodes', true], ['lager', 'Lager']];
let reiter = 'gutscheine';
let flaeche = null;
const kachel = (titel, wert, unter, warnung) => el('div', { klasse: 'kachel' + (warnung ? ' ist-warnung' : '') }, el('dt', { text: titel }), el('dd', { text: wert }), unter ? el('p', { klasse: 'kachel-unter', text: unter }) : null);
/** „12,50“ oder „12“ → Cent; leer → null. */
const cent = (s) => { const r = String(s ?? '').trim().replace(/[^\d,.]/g, '').replace(',', '.'); return r === '' ? null : Math.round(parseFloat(r) * 100); };
const geld = (c) => (c === null || c === undefined ? '' : String(c / 100).replace('.', ','));

export function zeigen(f, teile = []) {
  flaeche = f;
  const erlaubt = REITER.filter(([, , nurChefin]) => !nurChefin || inhaberin());
  if (teile[0] && erlaubt.some(([id]) => id === teile[0])) reiter = teile[0];
  fuellen(f, el('div', { klasse: 'seite' },
    el('div', { klasse: 'seiten-kopf' }, el('h1', { klasse: 'seiten-titel', text: 'Verkauf' })),
    el('div', { klasse: 'schalter schalter-umbruch', role: 'tablist', 'aria-label': 'Verkauf' }, erlaubt.map(([id, name]) => el('button', {
      type: 'button', role: 'tab', 'aria-pressed': String(id === reiter), 'aria-selected': String(id === reiter), text: name, onclick: () => { location.hash = '#verkauf/' + id; } }))),
    el('div', { id: 'v-inhalt', klasse: 'n-inhalt' }, el('p', { klasse: 'leer', text: 'Wird geladen …' }))));
  neuLaden();
}
export function neuLaden() {
  if (flaeche?.dataset.bereich !== 'verkauf') return;
  ({ gutscheine: gutscheineZeigen, codes: codesZeigen, lager: lagerZeigen })[reiter]?.();
}

/* ── Gutscheine ──────────────────────────────────────────────────────── */
let gSuche = '';
const G_STATUS = { aktiv: 'gültig', eingeloest: 'eingelöst', abgelaufen: 'abgelaufen', storniert: 'storniert' };
async function gutscheineZeigen() {
  const box = $('v-inhalt');
  const code = el('input', { type: 'text', klasse: 'such-feld', placeholder: 'Code, z. B. IH-7KQ2-M9XD', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Gutscheincode' });
  const ergebnis = el('div', { 'aria-live': 'polite' });
  const pruefen = async () => {
    if (!code.value.trim()) return;
    try { gutscheinKarte(await api('gutschein', { get: { code: code.value } }), ergebnis); }
    catch (e) { fuellen(ergebnis, el('p', { klasse: 'form-fehler', text: e.message })); }
  };
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') pruefen(); });
  const liste = el('ul', { klasse: 'verlauf-liste' });
  const info = el('dl', { klasse: 'kacheln kacheln-klein' });
  const laden = async () => {
    const r = await api('gutscheine', { get: { q: gSuche } });
    fuellen(info, kachel('Offener Gutscheinwert', euro(r.offen_cent), 'gültig, noch nicht eingelöst'));
    fuellen(liste, ...(r.gutscheine.length ? r.gutscheine.map((g) => el('li', {}, el('button', { type: 'button', klasse: 'verlauf-zeile', onclick: () => gutscheinTafel(g.code) },
      el('span', { klasse: 'zahl', text: g.code }),
      el('span', { text: [g.empfaenger && `für ${g.empfaenger}`, g.kaeufer && `von ${g.kaeufer}`, g.leistung].filter(Boolean).join(' · ') || '—' }),
      el('span', { klasse: 'verlauf-wer zahl', text: `${euro(g.rest_cent)} von ${euro(g.wert_cent)}` }),
      el('span', { klasse: 'n-status', text: G_STATUS[g.status] || g.status })))) : [el('li', { klasse: 'leer', text: gSuche ? 'Nichts gefunden.' : 'Noch keine Gutscheine.' })]));
  };
  fuellen(box, 
    el('section', { klasse: 'abschnitt' }, el('h2', { klasse: 'abschnitt-titel', text: 'Einlösen' }),
      el('div', { klasse: 'v-einloesen' }, code, el('button', { type: 'button', klasse: 'knopf-still', text: 'Prüfen', onclick: pruefen })), ergebnis),
    el('div', { klasse: 'tafel-wege' }, el('button', { type: 'button', klasse: 'knopf', onclick: gutscheinNeu }, svg(ZEICHEN.plus), el('span', { text: 'Gutschein ausgeben' }))),
    info,
    el('input', { type: 'search', klasse: 'such-feld', placeholder: 'Suchen: Code, Käufer, Empfänger', value: gSuche, 'aria-label': 'Gutscheine suchen', oninput: spaeter((e) => { gSuche = e.target.value; laden(); }, 250) }),
    liste);
  laden();
}

/** Kurz und an der Theke: Restwert, Einlösen mit Betrag. */
function gutscheinKarte(g, box, nachher) {
  const betrag = el('input', { type: 'text', inputmode: 'decimal', placeholder: geld(g.rest_cent), 'aria-label': 'Betrag in Euro' });
  const ok = g.status === 'aktiv' && g.rest_cent > 0;
  fuellen(box, el('div', { klasse: 'karte v-karte' },
    el('p', { klasse: 'karte-kopf' }, el('strong', { klasse: 'zahl', text: g.code }), el('span', { klasse: 'marke', text: G_STATUS[g.status] || g.status })),
    el('p', { klasse: 'v-rest' }, el('span', { klasse: 'zahl', text: euro(g.rest_cent) }), ` von ${euro(g.wert_cent)} · gültig bis ${tagText(g.gueltig_bis, 'zahl')}`),
    g.leistung ? el('p', { klasse: 'seiten-info', text: g.leistung }) : null,
    ok ? el('div', { klasse: 'v-einloesen' }, betrag, el('button', { type: 'button', klasse: 'knopf', text: 'Einlösen', onclick: async (e) => {
      const c = cent(betrag.value) ?? g.rest_cent;
      if (!await fragen({ titel: `${euro(c)} einlösen?`, text: `Danach bleiben ${euro(g.rest_cent - c)} auf dem Gutschein. Den Betrag an der Kasse als Gutschein-Zahlung buchen.`, ja: 'Einlösen' })) return;
      e.currentTarget.disabled = true;
      try { const neu = await api('gutschein_einloesen', { post: { code: g.code, betrag_cent: c } }); meldung(`${euro(c)} eingelöst · Rest ${euro(neu.rest_cent)}`, 'ok'); gutscheinKarte(neu, box, nachher); nachher?.(); if (reiter === 'gutscheine') gutscheineZeigen(); }
      catch (x) { meldung(x.message, 'fehler'); e.currentTarget.disabled = false; }
    } })) : null));
}

async function gutscheinTafel(code) {
  const g = await api('gutschein', { get: { code } });
  const koerper = tafelAuf({ titel: g.code, unter: G_STATUS[g.status] || g.status });
  const karte = el('div');
  gutscheinKarte(g, karte, () => gutscheinTafel(code));
  fuellen(koerper, karte,
    el('dl', { klasse: 'kennzahlen' },
      el('div', {}, el('dt', { text: 'Für' }), el('dd', { klasse: 'n-klein', text: g.empfaenger || '—' })),
      el('div', {}, el('dt', { text: 'Von' }), el('dd', { klasse: 'n-klein', text: g.kaeufer || '—' })),
      el('div', {}, el('dt', { text: 'Ausgegeben' }), el('dd', { klasse: 'n-klein', text: tagText(g.erstellt.slice(0, 10), 'zahl') })),
      el('div', {}, el('dt', { text: 'Gültig bis' }), el('dd', { klasse: 'n-klein', text: tagText(g.gueltig_bis, 'zahl') }))),
    g.notiz ? el('p', { klasse: 'kartei-notiz', text: g.notiz }) : null,
    el('h3', { klasse: 'form-titel', text: 'Verlauf' }),
    el('ul', { klasse: 'verlauf-liste' }, g.verlauf.map((b) => el('li', { klasse: 'verlauf-zeile' },
      el('span', { klasse: 'zahl', text: tagText(b.zeit.slice(0, 10), 'zahl') }), el('span', { text: { ausgabe: 'ausgegeben', einloesung: 'eingelöst', storno: 'storniert' }[b.art] + (b.notiz ? ' · ' + b.notiz : '') }),
      el('span', { klasse: 'verlauf-wer', text: b.wer || '' }), el('span', { klasse: 'zahl', text: euro(b.betrag_cent) })))),
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Drucken', onclick: () => gutscheinDrucken(g) }),
      inhaberin() && g.status === 'aktiv' ? el('button', { type: 'button', klasse: 'knopf-still knopf-leise', text: 'Stornieren', onclick: async () => {
        const grund = prompt('Grund für das Stornieren (z. B. falsch ausgestellt, Geld zurück):');
        if (!grund) return;
        await api('gutschein_stornieren', { post: { code: g.code, grund } }); meldung('Storniert', 'ok'); gutscheinTafel(code); gutscheineZeigen();
      } }) : null));
}

function gutscheinNeu() {
  const koerper = tafelAuf({ titel: 'Gutschein ausgeben' });
  const f = { wert: '50', leistung: '', kaeufer: '', empfaenger: '', notiz: '' };
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  const feld = (name, text, attr = {}) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }), el('input', { name, value: f[name], oninput: (e) => { f[name] = e.target.value; }, ...attr }));
  fuellen(koerper, 
    el('div', { klasse: 'v-betraege', role: 'group', 'aria-label': 'Schnellwahl' }, [25, 50, 75, 100, 150].map((b) => el('button', { type: 'button', klasse: 'chip', text: euro(b * 100),
      onclick: () => { f.wert = String(b); koerper.querySelector('[name="wert"]').value = String(b); } }))),
    el('div', { klasse: 'feld-reihe' }, feld('wert', 'Wert (€)', { inputmode: 'decimal' }), feld('leistung', 'Für eine Leistung (frei)', { placeholder: 'z. B. Balayage' })),
    el('div', { klasse: 'feld-reihe' }, feld('kaeufer', 'Gekauft von'), feld('empfaenger', 'Für')),
    feld('notiz', 'Notiz (intern)'),
    el('p', { klasse: 'seiten-info', text: 'Gültig drei Jahre zum Jahresende (gesetzliche Verjährung). Den Verkauf an der Kasse als Gutscheinverkauf buchen.' }),
    fehler,
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Abbrechen', onclick: tafelZu }),
      el('button', { type: 'button', klasse: 'knopf', text: 'Ausgeben', onclick: async () => {
        fehler.hidden = true;
        try {
          const g = await api('gutschein_anlegen', { post: { wert_cent: cent(f.wert), leistung: f.leistung || null, kaeufer: f.kaeufer || null, empfaenger: f.empfaenger || null, notiz: f.notiz || null } });
          meldung(`Gutschein ${g.code} ausgegeben`, 'ok');
          gutscheinTafel(g.code);
          gutscheineZeigen();
        } catch (e) { fehler.textContent = e.message; fehler.hidden = false; }
      } })));
}

/** Druckfassung: eine Karte im Format einer Postkarte, ohne das Studio drumherum. */
function gutscheinDrucken(g) {
  const w = open('', '_blank', 'noopener=no,width=720,height=560');
  if (!w) { meldung('Der Browser hat das Druckfenster blockiert.', 'fehler'); return; }
  const d = w.document;
  d.title = 'Gutschein ' + g.code;
  const stil = d.createElement('style');
  stil.textContent = `@page { size: A6 landscape; margin: 0; } body { margin: 0; font-family: Jost, 'Helvetica Neue', sans-serif; color: #1c1714; }
    .k { box-sizing: border-box; width: 148mm; height: 105mm; padding: 12mm 14mm; display: flex; flex-direction: column; justify-content: space-between; border: .4mm solid #b08a4a; }
    .m { letter-spacing: .4em; text-transform: uppercase; font-size: 11pt; } .w { font-size: 34pt; font-weight: 300; margin: 0; } .l { font-size: 12pt; margin: 2mm 0 0; }
    .f { display: flex; justify-content: space-between; font-size: 9pt; color: #5a4c40; } .c { font: 600 13pt/1 ui-monospace, Menlo, monospace; letter-spacing: .08em; color: #1c1714; }`;
  d.head.append(stil);
  const k = d.createElement('div');
  k.className = 'k';
  const zeile = (klasse, text) => { const p = d.createElement('p'); p.className = klasse; p.textContent = text; return p; };
  const oben = d.createElement('div');
  oben.append(zeile('m', 'Irmonhair · Gutschein'), zeile('w', euro(g.wert_cent)));
  if (g.leistung) oben.append(zeile('l', g.leistung));
  if (g.empfaenger) oben.append(zeile('l', 'für ' + g.empfaenger));
  const unten = d.createElement('div');
  unten.className = 'f';
  const links = d.createElement('div');
  links.append(zeile('c', g.code), zeile('', `Gültig bis ${tagText(g.gueltig_bis, 'zahl')} · einlösbar in Pasing und Großhadern`));
  unten.append(links, zeile('', 'Irmonherstraße 7 · Würmtalstraße 119'));
  k.append(oben, unten);
  d.body.append(k);
  setTimeout(() => w.print(), 300);
}

/* ── Aktionscodes ────────────────────────────────────────────────────── */
async function codesZeigen() {
  const box = $('v-inhalt');
  const r = await api('rabatte');
  fuellen(box, 
    el('p', { klasse: 'seiten-info', text: 'Ein Code, den Kundinnen beim Buchen eingeben (etwa „HERBST10“). Der Nachlass steht dann am Termin — abgezogen wird an der Kasse.' }),
    el('div', { klasse: 'tafel-wege' }, el('button', { type: 'button', klasse: 'knopf', onclick: () => codeBearbeiten(null) }, svg(ZEICHEN.plus), el('span', { text: 'Code' }))),
    r.rabatte.length ? el('ul', { klasse: 'verlauf-liste' }, r.rabatte.map((c) => el('li', {}, el('button', { type: 'button', klasse: 'verlauf-zeile' + (c.aktiv ? '' : ' ist-storniert'), onclick: () => codeBearbeiten(c) },
      el('span', { klasse: 'zahl', text: c.code }), el('span', { text: `${c.name} · ${c.prozent ? c.prozent + ' %' : euro(c.betrag_cent)}${c.nur_neu ? ' · nur erster Besuch' : ''}` }),
      el('span', { klasse: 'verlauf-wer', text: [c.von && 'ab ' + tagText(c.von, 'zahl'), c.bis && 'bis ' + tagText(c.bis, 'zahl')].filter(Boolean).join(' ') || 'unbefristet' }),
      el('span', { klasse: 'n-status', text: `${c.genutzt}${c.max_nutzungen ? ' / ' + c.max_nutzungen : ''} genutzt` }))))) : el('p', { klasse: 'leer', text: 'Noch keine Codes.' }));
}
function codeBearbeiten(c) {
  const koerper = tafelAuf({ titel: c ? c.code : 'Neuer Aktionscode' });
  const f = c ? { ...c, wert: c.prozent ? String(c.prozent) : geld(c.betrag_cent), art: c.prozent ? 'prozent' : 'betrag' } : { code: '', name: '', wert: '10', art: 'prozent', von: '', bis: '', max_nutzungen: '', nur_neu: false, aktiv: true };
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  const feld = (name, text, attr = {}) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }), el('input', { name, value: f[name] ?? '', oninput: (e) => { f[name] = e.target.value; }, ...attr }));
  const haken = (name, text) => el('label', { klasse: 'haken' }, el('input', { type: 'checkbox', checked: f[name], onchange: (e) => { f[name] = e.target.checked; } }), el('span', { text }));
  fuellen(koerper, 
    el('div', { klasse: 'feld-reihe' }, feld('code', 'Code', { autocapitalize: 'characters', spellcheck: 'false' }), feld('name', 'Name (sieht die Kundin)')),
    el('div', { klasse: 'feld-reihe' },
      el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Nachlass' }), el('div', { klasse: 'schalter schalter-klein', role: 'group' },
        [['prozent', 'Prozent'], ['betrag', 'Euro']].map(([id, t]) => el('button', { type: 'button', 'aria-pressed': String(f.art === id), text: t,
          onclick: (e) => { f.art = id; for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } })))),
      feld('wert', 'Wert', { inputmode: 'decimal' }), feld('max_nutzungen', 'Höchstens so oft (leer = unbegrenzt)', { inputmode: 'numeric' })),
    el('div', { klasse: 'feld-reihe' }, feld('von', 'Gültig ab', { type: 'date' }), feld('bis', 'Gültig bis', { type: 'date' })),
    el('div', { klasse: 'haken-reihe' }, haken('nur_neu', 'nur für den ersten Besuch'), haken('aktiv', 'aktiv')),
    fehler,
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Abbrechen', onclick: tafelZu }),
      el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: async () => {
        fehler.hidden = true;
        try {
          await api('rabatt_speichern', { post: { id: c?.id, code: f.code, name: f.name || null, prozent: f.art === 'prozent' ? Math.round(+String(f.wert).replace(',', '.')) : null,
            betrag_cent: f.art === 'betrag' ? cent(f.wert) : null, von: f.von || null, bis: f.bis || null,
            max_nutzungen: String(f.max_nutzungen ?? '').trim() ? +f.max_nutzungen : null, nur_neu: f.nur_neu, aktiv: f.aktiv } });
          meldung('Gespeichert', 'ok'); tafelZu(); codesZeigen();
        } catch (e) { fehler.textContent = e.message; fehler.hidden = false; koerper.querySelector(`[name="${e.daten.feld}"]`)?.focus(); }
      } })));
}

/* ── Lager ───────────────────────────────────────────────────────────── */
let lSalon = null;
let lSuche = '';
async function lagerZeigen() {
  lSalon = lSalon || Z.salon;
  const box = $('v-inhalt');
  const r = await api('artikel', { get: { salon: lSalon } });
  if (reiter !== 'lager' || !$('v-inhalt')) return;
  const liste = el('ul', { klasse: 'verlauf-liste' });
  const zeichnen = () => {
    const q = lSuche.trim().toLowerCase();
    // Ein Handscanner tippt den Strichcode wie eine Tastatur.
    const treffer = r.artikel.filter((a) => !q || a.ean === q || `${a.marke || ''} ${a.name}`.toLowerCase().includes(q));
    fuellen(liste, ...(treffer.length ? treffer.map((a) => el('li', {}, el('button', { type: 'button', klasse: 'verlauf-zeile' + (a.aktiv ? '' : ' ist-storniert') + (a.aktiv && a.bestand <= a.mindest ? ' ist-knapp' : ''), onclick: () => artikelTafel(a) },
      el('span', { klasse: 'zahl l-bestand', text: String(a.bestand) }), el('span', { text: [a.marke, a.name].filter(Boolean).join(' · ') }),
      el('span', { klasse: 'verlauf-wer', text: a.vk_cent !== null ? euro(a.vk_cent) : '' }),
      el('span', { klasse: 'n-status', text: !a.aktiv ? 'aus' : a.bestand <= a.mindest ? 'nachbestellen' : `min. ${a.mindest}` })))) : [el('li', { klasse: 'leer', text: q ? 'Nichts gefunden.' : 'Noch keine Artikel.' })]));
  };
  const suche = el('input', { type: 'search', klasse: 'such-feld', placeholder: 'Name oder Strichcode (Scanner geht auch)', value: lSuche, 'aria-label': 'Artikel suchen',
    oninput: (e) => { lSuche = e.target.value; zeichnen(); },
    onkeydown: (e) => { if (e.key === 'Enter') { const a = r.artikel.find((x) => x.ean && x.ean === lSuche.trim()); if (a) { artikelTafel(a); e.target.select(); } } } });
  fuellen(box, 
    el('div', { klasse: 'schalter', role: 'group', 'aria-label': 'Salon' }, Z.s.salons.map((s) => el('button', { type: 'button', 'aria-pressed': String(s.id === lSalon), text: s.name, onclick: () => { lSalon = s.id; lagerZeigen(); } }))),
    el('dl', { klasse: 'kacheln kacheln-klein' }, kachel('Artikel', String(r.artikel.filter((a) => a.aktiv).length)), kachel('Nachbestellen', String(r.nachbestellen), 'am oder unter Mindestbestand', r.nachbestellen > 0), kachel('Warenwert (EK)', euro(r.warenwert_cent))),
    leitung() ? el('div', { klasse: 'tafel-wege' }, el('button', { type: 'button', klasse: 'knopf', onclick: () => artikelBearbeiten(null) }, svg(ZEICHEN.plus), el('span', { text: 'Artikel' }))) : null,
    suche, liste);
  zeichnen();
}

async function artikelTafel(a) {
  const koerper = tafelAuf({ titel: a.name, unter: [a.marke, salonVon(a.salon)?.name].filter(Boolean).join(' · ') });
  const menge = el('input', { type: 'number', inputmode: 'numeric', min: 0, value: 1, 'aria-label': 'Menge', klasse: 'v-menge' });
  const bestand = el('p', { klasse: 'v-rest' }, el('span', { klasse: 'zahl', text: String(a.bestand) }), ` im Regal · Mindestbestand ${a.mindest}`);
  const verlauf = el('ul', { klasse: 'verlauf-liste' });
  const laden = async () => {
    const r = await api('lager_verlauf', { get: { artikel_id: a.id } });
    fuellen(verlauf, ...r.verlauf.map((b) => el('li', { klasse: 'verlauf-zeile' },
      el('span', { klasse: 'zahl', text: tagText(b.zeit.slice(0, 10), 'zahl').slice(0, 6) + ' ' + b.zeit.slice(11) }),
      el('span', { text: { eingang: 'Eingang', verkauf: 'Verkauf', verbrauch: 'Verbrauch im Salon', inventur: 'Inventur', korrektur: 'Korrektur' }[b.art] + (b.notiz ? ' · ' + b.notiz : '') }),
      el('span', { klasse: 'verlauf-wer', text: b.wer || '' }), el('span', { klasse: 'zahl', text: (b.menge > 0 ? '+' : '') + b.menge + ' → ' + b.bestand }))));
  };
  const buchen = (art, text) => el('button', { type: 'button', klasse: art === 'eingang' ? 'knopf' : 'knopf-still', text, onclick: async () => {
    try {
      const neu = await api('lager_buchen', { post: { artikel_id: a.id, art, menge: Math.max(0, Math.round(+menge.value)) } });
      Object.assign(a, neu);
      bestand.firstChild.textContent = String(neu.bestand);
      meldung(`${text}: Bestand ${neu.bestand}`, 'ok'); laden(); lagerZeigen();
    } catch (e) { meldung(e.message, 'fehler'); }
  } });
  fuellen(koerper, bestand,
    el('div', { klasse: 'v-einloesen' }, menge, buchen('eingang', 'Eingang'), buchen('verkauf', 'Verkauft'), buchen('verbrauch', 'Verbraucht'), buchen('inventur', 'Gezählt')),
    el('p', { klasse: 'seiten-info', text: '„Gezählt“ setzt den Bestand auf die Menge (Inventur). Verkäufe zusätzlich an der Kasse buchen.' }),
    el('dl', { klasse: 'kennzahlen' },
      el('div', {}, el('dt', { text: 'EK' }), el('dd', { klasse: 'n-klein', text: a.ek_cent !== null ? euro(a.ek_cent) : '—' })),
      el('div', {}, el('dt', { text: 'VK' }), el('dd', { klasse: 'n-klein', text: a.vk_cent !== null ? euro(a.vk_cent) : '—' })),
      el('div', {}, el('dt', { text: 'Strichcode' }), el('dd', { klasse: 'n-klein zahl', text: a.ean || '—' })),
      el('div', {}, el('dt', { text: 'Geändert' }), el('dd', { klasse: 'n-klein', text: tagText(a.geaendert.slice(0, 10), 'zahl') }))),
    el('h3', { klasse: 'form-titel', text: 'Verlauf' }), verlauf,
    leitung() ? el('div', { klasse: 'tafel-wege' }, el('button', { type: 'button', klasse: 'knopf-still', text: 'Bearbeiten', onclick: () => artikelBearbeiten(a) })) : null);
  laden();
}

function artikelBearbeiten(a) {
  const koerper = tafelAuf({ titel: a ? a.name : 'Neuer Artikel', unter: salonVon(a?.salon || lSalon)?.name });
  const f = a ? { ...a, ek: geld(a.ek_cent), vk: geld(a.vk_cent) } : { name: '', marke: '', ean: '', bestand: '0', mindest: '2', ek: '', vk: '', aktiv: true };
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  const feld = (name, text, attr = {}) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }), el('input', { name, value: f[name] ?? '', oninput: (e) => { f[name] = e.target.value; }, ...attr }));
  fuellen(koerper, 
    el('div', { klasse: 'feld-reihe' }, feld('marke', 'Marke'), feld('name', 'Artikel')),
    el('div', { klasse: 'feld-reihe' }, feld('ean', 'Strichcode', { inputmode: 'numeric' }), a ? null : feld('bestand', 'Bestand jetzt', { inputmode: 'numeric' }), feld('mindest', 'Mindestbestand', { inputmode: 'numeric' })),
    el('div', { klasse: 'feld-reihe' }, feld('ek', 'Einkauf (€)', { inputmode: 'decimal' }), feld('vk', 'Verkauf (€)', { inputmode: 'decimal' })),
    el('label', { klasse: 'haken' }, el('input', { type: 'checkbox', checked: f.aktiv, onchange: (e) => { f.aktiv = e.target.checked; } }), el('span', { text: 'im Sortiment' })),
    fehler,
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Abbrechen', onclick: tafelZu }),
      el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: async () => {
        fehler.hidden = true;
        try {
          const neu = await api('artikel_speichern', { post: { id: a?.id, salon: a?.salon || lSalon, name: f.name, marke: f.marke || null, ean: f.ean || null,
            bestand: a ? undefined : Math.round(+f.bestand || 0), mindest: Math.round(+f.mindest || 0), ek_cent: cent(f.ek), vk_cent: cent(f.vk), aktiv: f.aktiv } });
          meldung('Gespeichert', 'ok'); artikelTafel(neu); lagerZeigen();
        } catch (e) { fehler.textContent = e.message; fehler.hidden = false; koerper.querySelector(`[name="${e.daten.feld}"]`)?.focus(); }
      } })));
}

export { gutscheinKarte };

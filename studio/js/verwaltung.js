/* ═══════════════════════════════════════════════════════════════════════
   Verwaltung: Team, Leistungen, Auswertung, Einstellungen

   Was selten geändert wird, steht hier — aufgeräumt, damit der Kalender
   leer bleibt von allem, was man nicht täglich braucht.
   ═══════════════════════════════════════════════════════════════════════ */

import { $, el, fuellen, svg, ZEICHEN, euro, preisText, dauerText, TAG_LANG, MONAT_LANG, hhmm, minuten, heute, plusTage, montag, tagText,
  meldung, fragen, speichern, summePhasen, alsDatum, iso, themaWahl, themaSetzen } from './hilfen.js';
import { Z, api, inhaberin, leitung, ROLLE_NAME, stammdatenLaden, personVon, salonVon, gruppeVon } from './api.js';
import { tafelAuf, tafelZu } from './tafel.js';
import { abwesenheitZeigen, abwesenheitNeu } from './termin.js';

const TAGE = [1, 2, 3, 4, 5, 6, 7];
const tagName = (t) => TAG_LANG[t % 7];
const farbe = (n) => `var(--person-${n})`;
const kopf = (titel, ...rechts) => el('div', { klasse: 'seiten-kopf' }, el('h1', { klasse: 'seiten-titel', text: titel }), ...rechts);
const schalterWahl = (e) => { for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); };

/* ═══ Team ════════════════════════════════════════════════════════════ */
export const team = {
  flaeche: null,
  async zeigen(f) {
    this.flaeche = f;
    f.replaceChildren(el('div', { klasse: 'seite' }, kopf('Team',
      el('button', { type: 'button', klasse: 'knopf', onclick: () => personBearbeiten(null) }, svg(ZEICHEN.plus), el('span', { text: 'Person' }))),
      el('p', { klasse: 'seiten-info', text: 'Arbeitszeiten bestimmen, wann online gebucht werden kann. Wer in zwei Salons arbeitet, bekommt in jedem seine Tage — gleichzeitig belegt wird niemand.' }),
      el('ul', { klasse: 'team-liste', id: 'team-liste' })));
    await this.neuLaden();
  },
  async neuLaden() {
    const r = await api('team');
    team.daten = r.personen;
    const liste = $('team-liste');
    if (!liste) return;
    liste.replaceChildren(...r.personen.map((p) => {
      const salons = [...new Set(p.arbeitszeiten.map((z) => z.salon))].map((s) => salonVon(s)?.name).join(' & ') || 'keine Arbeitszeiten';
      const tage = [...new Set(p.arbeitszeiten.map((z) => z.tag))].sort().map((t) => tagName(t).slice(0, 2)).join(' ');
      return el('li', {}, el('button', { type: 'button', klasse: 'team-zeile' + (p.aktiv ? '' : ' ist-aus'), stil: { '--farbe': farbe(p.farbe) }, onclick: () => personBearbeiten(p) },
        el('span', { klasse: 'monogramm', 'aria-hidden': 'true', text: p.name.charAt(0) }),
        el('span', { klasse: 'team-text' },
          el('span', { klasse: 'team-name' }, p.name, p.rolle !== 'team' ? el('span', { klasse: 'marke', text: ROLLE_NAME[p.rolle] }) : null, !p.aktiv ? el('span', { klasse: 'marke', text: 'inaktiv' }) : null),
          el('span', { klasse: 'team-info', text: `${salons}${tage ? ' · ' + tage : ''}` })),
        el('span', { klasse: 'team-rechts' },
          el('span', { klasse: 'team-info', text: p.online ? 'online buchbar' : 'nur im Studio' }),
          el('span', { klasse: 'team-info', text: p.hat_passwort ? `Zugang: ${p.anmeldename}` : 'kein Zugang' }))));
    }));
  },
};

function personBearbeiten(p) {
  const neu = !p;
  const f = p ? structuredClone(p) : { name: '', farbe: (Z.s.personen.length % 8) + 1, rolle: 'team', anmeldename: '', aktiv: true, online: true, arbeitszeiten: [], leistungen: [] };
  f.passwort = '';
  const koerper = tafelAuf({ titel: neu ? 'Neue Person' : p.name, unter: neu ? '' : ROLLE_NAME[p.rolle] || 'Team', breit: true });
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  const feld = (name, text, attr = {}) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }),
    el('input', { value: f[name] ?? '', name, oninput: (e) => { f[name] = e.target.value; }, ...attr }));
  const schalter = (name, text) => el('label', { klasse: 'haken' }, el('input', { type: 'checkbox', checked: f[name], onchange: (e) => { f[name] = e.target.checked; } }), el('span', { text }));

  // Farben: acht ruhige Töne, nur als Kante und Punkt im Kalender.
  const farben = el('div', { klasse: 'farben', role: 'radiogroup', 'aria-label': 'Farbe im Kalender' },
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => el('button', { type: 'button', klasse: 'farbe', role: 'radio', 'aria-checked': String(f.farbe === n), 'aria-label': `Farbe ${n}`,
      stil: { '--farbe': farbe(n) }, onclick: (e) => { f.farbe = n; for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); } })));

  // Arbeitszeiten je Salon und Wochentag, mehrere Abschnitte möglich.
  const zeitenBox = el('div', { klasse: 'arbeitszeiten' });
  const zeitenZeichnen = () => {
    zeitenBox.replaceChildren(...Z.s.salons.map((s) => {
      const zeilen = TAGE.map((tag) => {
        const spannen = f.arbeitszeiten.filter((z) => z.salon === s.id && z.tag === tag);
        const auf = (s.oeffnung[tag] || []).length > 0;
        return el('div', { klasse: 'az-zeile' + (auf ? '' : ' ist-zu') },
          el('span', { klasse: 'az-tag', text: tagName(tag).slice(0, 2) }),
          el('span', { klasse: 'az-spannen' },
            spannen.length ? spannen.map((z) => el('span', { klasse: 'az-spanne' },
              el('input', { type: 'time', step: 900, value: hhmm(z.von), 'aria-label': `${tagName(tag)} von`, onchange: (e) => { z.von = minuten(e.target.value); } }),
              el('span', { text: '–' }),
              el('input', { type: 'time', step: 900, value: hhmm(z.bis), 'aria-label': `${tagName(tag)} bis`, onchange: (e) => { z.bis = minuten(e.target.value); } }),
              el('button', { type: 'button', klasse: 'klein-zu', 'aria-label': 'Abschnitt entfernen', onclick: () => { f.arbeitszeiten = f.arbeitszeiten.filter((x) => x !== z); zeitenZeichnen(); } }, svg(ZEICHEN.zu))))
              : el('span', { klasse: 'az-frei', text: auf ? 'frei' : 'geschlossen' })),
          el('button', { type: 'button', klasse: 'text-link', text: spannen.length ? '+ Pause teilen' : '+ Zeit', onclick: () => {
            const oe = (s.oeffnung[tag] || [])[0] || [540, 1110];
            if (spannen.length) {
              // Den letzten Abschnitt um eine Mittagspause teilen.
              const z = spannen.at(-1);
              const mitte = Math.round((z.von + z.bis) / 2 / 30) * 30;
              f.arbeitszeiten.push({ salon: s.id, tag, von: mitte + 30, bis: z.bis });
              z.bis = mitte;
            } else f.arbeitszeiten.push({ salon: s.id, tag, von: oe[0], bis: oe[1] });
            zeitenZeichnen();
          } }));
      });
      return el('fieldset', { klasse: 'az-salon' }, el('legend', { text: s.name }),
        el('p', { klasse: 'form-klein' },
          el('button', { type: 'button', klasse: 'text-link', text: 'wie Öffnungszeiten', onclick: () => {
            f.arbeitszeiten = f.arbeitszeiten.filter((z) => z.salon !== s.id);
            for (const tag of TAGE) for (const [von, bis] of s.oeffnung[tag] || []) f.arbeitszeiten.push({ salon: s.id, tag, von, bis });
            zeitenZeichnen();
          } }), ' · ',
          el('button', { type: 'button', klasse: 'text-link', text: 'hier nicht', onclick: () => { f.arbeitszeiten = f.arbeitszeiten.filter((z) => z.salon !== s.id); zeitenZeichnen(); } })),
        zeilen);
    }));
  };
  zeitenZeichnen();

  // Leistungen: nach Salon und Gruppe, mit „alle“ je Gruppe.
  const gewaehlt = new Set(f.leistungen);
  const leistungenBox = el('div', { klasse: 'leistungs-wahl' }, Z.s.salons.map((s) => el('details', { klasse: 'lw-salon' },
    el('summary', { text: `${s.name} · ${Z.s.leistungen.filter((l) => l.salon === s.id && gewaehlt.has(l.id)).length} von ${Z.s.leistungen.filter((l) => l.salon === s.id).length}` }),
    Z.s.gruppen.map((g) => {
      const ls = Z.s.leistungen.filter((l) => l.salon === s.id && l.gruppe === g.id);
      if (!ls.length) return null;
      const boxen = ls.map((l) => el('label', { klasse: 'haken' }, el('input', { type: 'checkbox', checked: gewaehlt.has(l.id), onchange: (e) => { e.target.checked ? gewaehlt.add(l.id) : gewaehlt.delete(l.id); } }),
        el('span', {}, l.name, l.laenge ? el('small', { text: ' · ' + l.laenge }) : null)));
      return el('div', { klasse: 'lw-gruppe' },
        el('p', { klasse: 'lw-kopf' }, el('span', { text: g.name }),
          el('button', { type: 'button', klasse: 'text-link', text: 'alle', onclick: () => { ls.forEach((l) => gewaehlt.add(l.id)); boxen.forEach((b) => { b.querySelector('input').checked = true; }); } }),
          el('button', { type: 'button', klasse: 'text-link', text: 'keine', onclick: () => { ls.forEach((l) => gewaehlt.delete(l.id)); boxen.forEach((b) => { b.querySelector('input').checked = false; }); } })),
        boxen);
    }))));

  koerper.replaceChildren(
    el('div', { klasse: 'feld-reihe' }, feld('name', 'Name', { required: true, autocomplete: 'off' }),
      el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Farbe im Kalender' }), farben)),
    el('div', { klasse: 'haken-reihe' }, schalter('aktiv', 'arbeitet hier'), schalter('online', 'online buchbar')),
    el('h3', { klasse: 'form-titel', text: 'Arbeitszeiten' }), zeitenBox,
    el('h3', { klasse: 'form-titel', text: 'Leistungen' }), leistungenBox,
    el('h3', { klasse: 'form-titel', text: 'Zugang zum Studio' }),
    el('div', { klasse: 'feld-reihe' },
      feld('anmeldename', 'Anmeldename', { autocomplete: 'off', autocapitalize: 'none', placeholder: 'leer = kein Zugang' }),
      feld('passwort', neu || !p.hat_passwort ? 'Passwort (mind. 10 Zeichen)' : 'Neues Passwort (leer = bleibt)', { type: 'password', autocomplete: 'new-password' })),
    el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Rolle' }),
      el('div', { klasse: 'schalter schalter-klein', role: 'group', 'aria-label': 'Rolle' },
        [['team', 'Team: Kalender und Kunden'], ['rezeption', 'Rezeption: dazu Schließtage und Export'], ['inhaberin', 'Inhaberin: alles']].map(([id, name]) => el('button', { type: 'button', 'aria-pressed': String(f.rolle === id), text: name,
          onclick: (e) => { f.rolle = id; schalterWahl(e); } })))),
    fehler,
    el('div', { klasse: 'tafel-wege tafel-wege-fest' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Abbrechen', onclick: tafelZu }),
      el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: async () => {
        fehler.hidden = true;
        try {
          await api('person_speichern', { post: {
            id: p?.id, name: f.name, farbe: f.farbe, rolle: f.rolle, anmeldename: f.anmeldename || null, passwort: f.passwort || null,
            aktiv: f.aktiv, online: f.online, arbeitszeiten: f.arbeitszeiten, leistungen: [...gewaehlt],
          } });
          await stammdatenLaden();
          meldung('Gespeichert', 'ok');
          tafelZu();
          team.neuLaden();
        } catch (e) { fehler.textContent = e.message; fehler.hidden = false; }
      } })));
}

/* ═══ Leistungen ══════════════════════════════════════════════════════ */
let lSalon = null;
export const leistungen = {
  zeigen(f) {
    lSalon = lSalon || Z.salon;
    f.replaceChildren(el('div', { klasse: 'seite' }, kopf('Leistungen',
      el('button', { type: 'button', klasse: 'knopf', onclick: () => leistungBearbeiten(null) }, svg(ZEICHEN.plus), el('span', { text: 'Leistung' }))),
      el('div', { klasse: 'schalter', role: 'group', 'aria-label': 'Salon' }, Z.s.salons.map((s) => el('button', {
        type: 'button', 'aria-pressed': String(s.id === lSalon), text: s.name, onclick: () => { lSalon = s.id; leistungen.zeigen(f); } }))),
      el('p', { klasse: 'seiten-info', text: 'Die Dauer steuert, welche Zeiten online frei sind. Die Einwirkzeit hält die Person frei für andere Kundinnen.' }),
      el('div', { id: 'leistungen-liste' })));
    this.liste();
  },
  neuLaden() { this.liste(); },
  liste() {
    const box = $('leistungen-liste');
    if (!box) return;
    box.replaceChildren(...Z.s.gruppen.map((g) => {
      const ls = Z.s.leistungen.filter((l) => l.salon === lSalon && l.gruppe === g.id);
      if (!ls.length) return null;
      return el('section', { klasse: 'l-gruppe' }, el('h2', { klasse: 'abschnitt-titel', text: g.name }),
        el('ul', { klasse: 'l-liste' }, ls.map((l) => el('li', {}, el('button', { type: 'button', klasse: 'l-zeile' + (l.aktiv ? '' : ' ist-aus'), onclick: () => leistungBearbeiten(l) },
          el('span', { klasse: 'l-name' }, l.name, l.laenge ? el('small', { text: ' · ' + l.laenge }) : null),
          el('span', { klasse: 'l-dauer', text: l.phasen.map(([a, m]) => (a === 'pause' ? `(${m})` : m)).join(' + ') + ' Min.' }),
          el('span', { klasse: 'l-wer', text: `${l.personen.length} ${l.personen.length === 1 ? 'Person' : 'Personen'}` }),
          el('span', { klasse: 'l-status', text: !l.aktiv ? 'aus' : l.online ? 'online' : 'nur Studio' }),
          el('span', { klasse: 'zahl l-preis', text: preisText(l.preis_cent, l.preis_ab, l.preis_text) }))))));
    }));
  },
};

function leistungBearbeiten(l) {
  const f = l ? structuredClone(l) : { salon: lSalon, gruppe: Z.s.gruppen[0].id, name: '', zusatz: '', laenge: '', phasen: [['arbeit', 30]], preis_cent: null, preis_ab: false, preis_text: '', online: true, aktiv: true, zusatzleistung: false, personen: Z.s.personen.filter((p) => p.salons.includes(lSalon)).map((p) => p.id) };
  const koerper = tafelAuf({ titel: l ? l.name : 'Neue Leistung', unter: salonVon(f.salon).name, breit: true });
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  const feld = (name, text, attr = {}) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }),
    el('input', { value: f[name] ?? '', oninput: (e) => { f[name] = e.target.value; }, ...attr }));
  const haken = (name, text) => el('label', { klasse: 'haken' }, el('input', { type: 'checkbox', checked: f[name], onchange: (e) => { f[name] = e.target.checked; } }), el('span', { text }));
  const phasenBox = el('div', { klasse: 'ablauf-reihe' });
  const phasenZeichnen = () => {
    phasenBox.replaceChildren(...f.phasen.map((ph, i) => el('span', { klasse: 'phase' },
      el('label', { klasse: 'feld feld-schmal' }, el('span', { klasse: 'feld-name', text: ph[0] === 'pause' ? 'Einwirken' : 'Arbeit' }),
        el('input', { type: 'number', min: 5, max: 480, step: 5, value: ph[1], onchange: (e) => { ph[1] = Math.max(5, Math.round(+e.target.value / 5) * 5); summe.textContent = dauerText(summePhasen(f.phasen)); } })),
      f.phasen.length > 1 ? el('button', { type: 'button', klasse: 'klein-zu', 'aria-label': 'Phase entfernen', onclick: () => { f.phasen.splice(i, 1); phasenZeichnen(); } }, svg(ZEICHEN.zu)) : null)),
      el('button', { type: 'button', klasse: 'text-link', text: '+ Einwirkzeit und Arbeit', onclick: () => { f.phasen.push(['pause', 30], ['arbeit', 30]); phasenZeichnen(); } }));
    summe.textContent = dauerText(summePhasen(f.phasen));
  };
  const summe = el('span', { klasse: 'zahl' });
  phasenZeichnen();
  const preis = el('input', { type: 'text', inputmode: 'decimal', value: f.preis_cent === null ? '' : String(f.preis_cent / 100).replace('.', ','), placeholder: 'leer = nach Beratung' });
  const personen = el('div', { klasse: 'haken-reihe' }, Z.s.personen.filter((p) => p.aktiv).map((p) => el('label', { klasse: 'haken' },
    el('input', { type: 'checkbox', checked: f.personen.includes(p.id), onchange: (e) => { f.personen = e.target.checked ? [...f.personen, p.id] : f.personen.filter((x) => x !== p.id); } }),
    el('span', { text: p.name }))));
  koerper.replaceChildren(
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Gruppe' }),
        el('select', { onchange: (e) => { f.gruppe = e.target.value; } }, Z.s.gruppen.map((g) => el('option', { value: g.id, text: g.name, selected: g.id === f.gruppe ? true : null })))),
      feld('name', 'Name', { required: true })),
    el('div', { klasse: 'feld-reihe' }, feld('laenge', 'Länge (kurz, mittel, lang, kurz–mittel …)'), feld('zusatz', 'Zusatz (z. B. inkl. Haarkur)')),
    el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name' }, 'Ablauf in Minuten · zusammen ', summe), phasenBox),
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld feld-schmal' }, el('span', { klasse: 'feld-name', text: 'Preis (€)' }), preis),
      el('div', { klasse: 'haken-reihe' }, haken('preis_ab', '„ab“-Preis'), haken('online', 'online buchbar'), haken('aktiv', 'angeboten'), haken('zusatzleistung', 'als Zusatz vorschlagen'))),
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld feld-schmal' }, el('span', { klasse: 'feld-name', text: 'Recall nach (Tagen, leer = keiner)' }),
        el('input', { type: 'number', min: 7, max: 365, inputmode: 'numeric', value: f.recall_tage ?? '', oninput: (e) => { f.recall_tage = e.target.value === '' ? null : Math.round(+e.target.value); } })),
      el('p', { klasse: 'seiten-info', text: 'So lange nach dem Besuch fragt das System nach, ob der nächste Termin fällig ist (nur mit Einwilligung). Hat die Kundin einen eigenen, regelmäßigen Rhythmus, gilt der.' })),
    el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Wer macht das' }), personen),
    fehler,
    el('div', { klasse: 'tafel-wege tafel-wege-fest' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Abbrechen', onclick: tafelZu }),
      el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: async () => {
        fehler.hidden = true;
        const roh = preis.value.trim().replace(/[^\d,.]/g, '').replace(',', '.');
        try {
          await api('leistung_speichern', { post: {
            id: l?.id, salon: f.salon, gruppe: f.gruppe, name: f.name, zusatz: f.zusatz || null, laenge: f.laenge || null, familie: l?.familie,
            phasen: f.phasen, preis_cent: roh === '' ? null : Math.round(parseFloat(roh) * 100), preis_ab: f.preis_ab, preis_text: f.preis_text || null,
            online: f.online, aktiv: f.aktiv, zusatzleistung: f.zusatzleistung, personen: f.personen, recall_tage: f.recall_tage ?? null,
          } });
          await stammdatenLaden();
          meldung('Gespeichert', 'ok');
          tafelZu();
          leistungen.liste();
        } catch (e) { fehler.textContent = e.message; fehler.hidden = false; }
      } })));
}

/* ═══ Auswertung ══════════════════════════════════════════════════════ */
let aZeitraum = 'monat';
let aSalon = '';
const ZEITRAEUME = [['heute', 'Heute'], ['woche', 'Diese Woche'], ['monat', 'Dieser Monat'], ['vormonat', 'Letzter Monat'], ['jahr', 'Dieses Jahr']];
function zeitraum(art) {
  const h = heute();
  const d = alsDatum(h);
  if (art === 'heute') return [h, h];
  if (art === 'woche') return [montag(h), plusTage(montag(h), 6)];
  if (art === 'monat') return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (art === 'vormonat') return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))];
  return [iso(new Date(d.getFullYear(), 0, 1)), iso(new Date(d.getFullYear(), 11, 31))];
}
export const auswertung = {
  async zeigen(f) {
    this.f = f;
    f.replaceChildren(el('div', { klasse: 'seite' }, kopf('Auswertung'),
      el('div', { klasse: 'steuer-reihe' },
        el('div', { klasse: 'schalter schalter-klein schalter-umbruch', role: 'group', 'aria-label': 'Zeitraum' }, ZEITRAEUME.map(([id, name]) => el('button', {
          type: 'button', 'aria-pressed': String(id === aZeitraum), text: name, onclick: () => { aZeitraum = id; auswertung.zeigen(f); } }))),
        el('div', { klasse: 'schalter schalter-klein', role: 'group', 'aria-label': 'Salon' },
          [['', 'Beide'], ...Z.s.salons.map((s) => [s.id, s.name])].map(([id, name]) => el('button', {
            type: 'button', 'aria-pressed': String(id === aSalon), text: name, onclick: () => { aSalon = id; auswertung.zeigen(f); } })))),
      el('div', { id: 'auswertung' }, el('p', { klasse: 'leer', text: 'Wird gerechnet …' }))));
    await this.neuLaden();
  },
  async neuLaden() {
    const [von, bis] = zeitraum(aZeitraum);
    const r = await api('auswertung', { get: { von, bis, salon: aSalon } });
    const box = $('auswertung');
    if (!box) return;
    const s = r.summe;
    const verfuegbar = Object.values(r.personen).reduce((x, p) => x + (p.auslastung ? p.arbeit_min / p.auslastung : 0), 0);
    const auslastung = verfuegbar ? s.arbeit_min / verfuegbar : null;
    const prozent = (x) => (x === null ? '—' : `${Math.round(x * 100)} %`);
    const kachel = (titel, wert, unter) => el('div', { klasse: 'kachel' }, el('dt', { text: titel }), el('dd', { text: wert }), unter ? el('p', { klasse: 'kachel-unter', text: unter }) : null);
    const zeilen = Object.entries(r.personen).filter(([, p]) => p.termine || p.auslastung).sort((a, b) => b[1].umsatz_cent - a[1].umsatz_cent);
    box.replaceChildren(
      el('p', { klasse: 'seiten-info', text: `${tagText(von, 'zahl')} – ${tagText(bis, 'zahl')} · Umsatz aus den Preisen der Termine bis heute, ohne „nicht erschienen“.` }),
      el('dl', { klasse: 'kacheln' },
        kachel('Umsatz', euro(s.umsatz_cent)),
        kachel('Termine', String(s.termine), s.termine ? `${prozent(s.online / s.termine)} online gebucht` : null),
        kachel('Auslastung', prozent(auslastung), 'Arbeitszeit mit Kundinnen'),
        kachel('Neue Kundinnen', String(s.neue_kunden)),
        kachel('Nicht erschienen', String(s.nicht_erschienen), s.termine ? prozent(s.nicht_erschienen / s.termine) : null),
        kachel('Abgesagt', String(s.storniert))),
      zeilen.length ? el('div', { klasse: 'tabelle-rahmen' }, el('table', { klasse: 'tabelle' },
        el('thead', {}, el('tr', {}, ['Person', 'Termine', 'Umsatz', 'Auslastung', 'Nicht erschienen'].map((t) => el('th', { scope: 'col', text: t })))),
        el('tbody', {}, zeilen.map(([pid, p]) => el('tr', { stil: { '--farbe': farbe(personVon(pid)?.farbe || 1) } },
          el('th', { scope: 'row' }, el('span', { klasse: 'punkt', 'aria-hidden': 'true' }), personVon(pid)?.name || pid),
          el('td', { klasse: 'zahl', text: String(p.termine) }),
          el('td', { klasse: 'zahl', text: euro(p.umsatz_cent) }),
          el('td', {}, el('span', { klasse: 'balken', stil: { '--anteil': Math.min(1, p.auslastung || 0) } }), el('span', { klasse: 'zahl', text: prozent(p.auslastung) })),
          el('td', { klasse: 'zahl', text: String(p.nicht_erschienen) })))))) : el('p', { klasse: 'leer', text: 'Keine Termine in diesem Zeitraum.' }),
      berichtTeil());
  },
};

/** Der Monatsbericht: geht am Monatsanfang per E-Mail an die Inhaberin; hier zum Nachlesen. */
function berichtTeil() {
  const d = alsDatum(heute());
  const monate = Array.from({ length: 12 }, (_, i) => new Date(d.getFullYear(), d.getMonth() - i, 1));
  const text = el('pre', { klasse: 'bericht' });
  const an = el('input', { type: 'email', placeholder: 'E-Mail-Adresse', autocomplete: 'email' });
  let monat = iso(monate[1]).slice(0, 7);
  const laden = async () => { text.textContent = 'Wird gerechnet …'; const r = await api('bericht', { get: { monat, salon: aSalon } }); text.textContent = r.text; };
  laden();
  return el('section', { klasse: 'abschnitt' }, el('h2', { klasse: 'abschnitt-titel', text: 'Monatsbericht' }),
    el('p', { klasse: 'seiten-info', text: 'Recall, Warteliste, Nachrichten und woher die Buchungen kamen. Geht am Monatsanfang von selbst per E-Mail (api/config.php → bericht_an).' }),
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Monat' }),
        el('select', { onchange: (e) => { monat = e.target.value; laden(); } }, monate.map((m, i) => el('option', { value: iso(m).slice(0, 7), selected: i === 1 ? true : null, text: `${MONAT_LANG[m.getMonth()]} ${m.getFullYear()}` })))),
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Per E-Mail an' }), an),
      el('div', { klasse: 'feld k-test' }, el('button', { type: 'button', klasse: 'knopf-still', text: 'Senden', onclick: async () => {
        try { await api('bericht_senden', { post: { monat, an: an.value } }); meldung('Gesendet', 'ok'); } catch (e) { meldung(e.message, 'fehler'); }
      } }))),
    text);
}

/* ═══ Einstellungen ═══════════════════════════════════════════════════ */
export const einstellungen = {
  zeigen(f) {
    const teile = [kopf('Einstellungen')];
    teile.push(darstellungTeil(), passwortTeil());
    if (inhaberin()) teile.push(regelnTeil(), nachrichtenTeil(), treueTeil(), oeffnungTeil());
    if (leitung()) teile.push(abwesenheitenTeil(), exportTeil());
    if (inhaberin()) teile.push(abgleichTeil(), importTeil(), sicherungTeil());
    f.replaceChildren(el('div', { klasse: 'seite seite-schmal' }, teile));
  },
  neuLaden() { /* nichts Lebendiges */ },
};

function abschnitt(titel, lauf, ...inhalt) {
  return el('section', { klasse: 'abschnitt' }, el('h2', { klasse: 'abschnitt-titel', text: titel }), lauf ? el('p', { klasse: 'seiten-info', text: lauf }) : null, ...inhalt);
}

/** Darstellung je Gerät: Dunkel (wie das Schaufenster), Off-White für helle
    Räume, oder wie das Gerät eingestellt ist. */
function darstellungTeil() {
  const w = themaWahl();
  return abschnitt('Darstellung', 'Gilt für dieses Gerät.',
    el('div', { klasse: 'schalter', role: 'group', 'aria-label': 'Darstellung' },
      [['dunkel', 'Dunkel'], ['hell', 'Off-White'], ['auto', 'Wie das Gerät']].map(([id, name]) => el('button', {
        type: 'button', 'aria-pressed': String(w === id), text: name,
        onclick: (e) => { themaSetzen(id); schalterWahl(e); },
      }))));
}

function passwortTeil() {
  const alt = el('input', { type: 'password', autocomplete: 'current-password' });
  const neu = el('input', { type: 'password', autocomplete: 'new-password', minlength: 10 });
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  return abschnitt('Mein Passwort', 'Nach dem Ändern sind alle anderen Geräte abgemeldet.',
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Bisheriges Passwort' }), alt),
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Neues Passwort (mind. 10 Zeichen)' }), neu)),
    fehler,
    el('button', { type: 'button', klasse: 'knopf-still', text: 'Passwort ändern', onclick: async () => {
      fehler.hidden = true;
      try { await api('passwort', { post: { alt: alt.value, neu: neu.value } }); alt.value = ''; neu.value = ''; meldung('Passwort geändert', 'ok'); }
      catch (e) { fehler.textContent = e.message; fehler.hidden = false; }
    } }));
}

function regelnTeil() {
  const e = structuredClone(Z.s.einstellungen);
  const zahl = (name, text, einheit, attr) => el('label', { klasse: 'feld feld-schmal' }, el('span', { klasse: 'feld-name', text }),
    el('span', { klasse: 'mit-einheit' }, el('input', { type: 'number', value: e[name], inputmode: 'numeric', onchange: (ev) => { e[name] = +ev.target.value; }, ...attr }), el('span', { text: einheit })));
  const haken = (name, text) => el('label', { klasse: 'haken' }, el('input', { type: 'checkbox', checked: e[name], onchange: (ev) => { e[name] = ev.target.checked; } }), el('span', { text }));
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  return abschnitt('Online-Buchung', null,
    el('div', { klasse: 'haken-reihe' }, haken('online_aktiv', 'Online-Buchung ist offen'), haken('luecken_fuellen', 'Lücken füllen: auch direkt nach einem Termin anbieten'),
      haken('feiertage', 'An gesetzlichen Feiertagen (Bayern) geschlossen')),
    el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Hinweis über der Buchung (z. B. Betriebsurlaub)' }),
      el('input', { value: e.hinweis, maxlength: 300, oninput: (ev) => { e.hinweis = ev.target.value; } })),
    el('div', { klasse: 'feld-raster' },
      zahl('raster', 'Startzeiten alle', 'Min.', { min: 5, max: 60, step: 5 }),
      zahl('vorlauf', 'Frühestens', 'Min. ab jetzt', { min: 0, max: 2880, step: 15 }),
      zahl('horizont', 'Buchbar im Voraus', 'Tage', { min: 1, max: 365 }),
      zahl('stornofrist', 'Online absagen bis', 'Std. vorher', { min: 0, max: 168 }),
      zahl('puffer', 'Luft nach jedem Termin', 'Min.', { min: 0, max: 60, step: 5 }),
      zahl('max_offen', 'Offene Termine je Nummer', '', { min: 1, max: 20 })),
    fehler,
    el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: async () => {
      fehler.hidden = true;
      try { await api('einstellungen_speichern', { post: e }); await stammdatenLaden(); meldung('Gespeichert', 'ok'); }
      catch (ex) { fehler.textContent = ex.message; fehler.hidden = false; }
    } }));
}

function oeffnungTeil() {
  return abschnitt('Salons', 'Öffnungszeiten, Adresse und Telefon, wie sie auf der Buchungsseite stehen. Wann wer arbeitet, steht unter Team.',
    ...Z.s.salons.map((s) => {
      const f = { oeffnung: structuredClone(s.oeffnung), strasse: s.strasse, ort: s.ort, telefon_text: s.telefon_text };
      const zeilen = TAGE.map((tag) => {
        const sp = (f.oeffnung[tag] ||= []);
        const zeichnen = () => {
          zelle.replaceChildren(...(sp.length ? sp.map((z, i) => el('span', { klasse: 'az-spanne' },
            el('input', { type: 'time', step: 900, value: hhmm(z[0]), onchange: (e) => { z[0] = minuten(e.target.value); } }), '–',
            el('input', { type: 'time', step: 900, value: hhmm(z[1]), onchange: (e) => { z[1] = minuten(e.target.value); } }),
            el('button', { type: 'button', klasse: 'klein-zu', 'aria-label': 'entfernen', onclick: () => { sp.splice(i, 1); zeichnen(); } }, svg(ZEICHEN.zu))))
            : [el('span', { klasse: 'az-frei', text: 'geschlossen' }), el('button', { type: 'button', klasse: 'text-link', text: '+ öffnen', onclick: () => { sp.push([540, 1110]); zeichnen(); } })]));
        };
        const zelle = el('span', { klasse: 'az-spannen' });
        zeichnen();
        return el('div', { klasse: 'az-zeile' }, el('span', { klasse: 'az-tag', text: tagName(tag).slice(0, 2) }), zelle);
      });
      const feld = (name, text) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }), el('input', { value: f[name], oninput: (e) => { f[name] = e.target.value; } }));
      return el('details', { klasse: 'az-salon' }, el('summary', { text: s.name }),
        el('div', { klasse: 'feld-reihe' }, feld('strasse', 'Straße'), feld('ort', 'PLZ und Ort'), feld('telefon_text', 'Telefon')),
        zeilen,
        el('button', { type: 'button', klasse: 'knopf-still', text: `${s.name} speichern`, onclick: async () => {
          try { await api('salon_speichern', { post: { id: s.id, ...f } }); await stammdatenLaden(); meldung('Gespeichert', 'ok'); }
          catch (e) { meldung(e.message, 'fehler'); }
        } }));
    }));
}

function abwesenheitenTeil() {
  const liste = el('ul', { klasse: 'verlauf-liste' }, el('li', { klasse: 'leer', text: 'Wird geladen …' }));
  const laden = async () => {
    const von = heute(), bis = plusTage(von, 41);
    const alle = [];
    for (const s of Z.s.salons) {
      const r = await api('kalender', { get: { salon: s.id, von, bis } });
      for (const a of r.abwesenheiten) if (!alle.some((x) => x.id === a.id) && a.art !== 'pause') alle.push(a);
    }
    alle.sort((a, b) => (a.von < b.von ? -1 : 1));
    liste.replaceChildren(...(alle.length ? alle.map((a) => el('li', {}, el('button', { type: 'button', klasse: 'verlauf-zeile', onclick: () => abwesenheitZeigen(a, laden) },
      el('span', { klasse: 'zahl', text: `${tagText(a.von.slice(0, 10), 'zahl').slice(0, 6)} – ${tagText(a.bis.slice(0, 10), 'zahl').slice(0, 6)}` }),
      el('span', { text: a.person ? personVon(a.person)?.name : `Salon ${salonVon(a.salon)?.name || ''}` }),
      el('span', { text: { urlaub: 'Urlaub', krank: 'Krank', frei: 'Frei', schulung: 'Schulung', geschlossen: 'Geschlossen' }[a.art] || a.art }),
      el('span', { text: a.notiz || '' })))) : [el('li', { klasse: 'leer', text: 'Keine in den nächsten sechs Wochen.' })]));
  };
  laden().catch((e) => liste.replaceChildren(el('li', { klasse: 'leer', text: e.message })));
  return abschnitt('Urlaub und Schließtage', 'Die nächsten sechs Wochen. Pausen einzelner Tage stehen direkt im Kalender.', liste,
    el('button', { type: 'button', klasse: 'knopf-still', text: '+ Urlaub oder Schließtag', onclick: () => abwesenheitNeu({ datum: heute(), zeit: '00:00' }, laden) }));
}

/** Alle Daten als CSV — jederzeit, ohne zu fragen. Die Daten gehören dem Salon. */
function exportTeil() {
  const api0 = new URL(document.querySelector('meta[name="irmonhair-api"]').content, location.href).href;
  const knopf = (was, text) => el('a', { klasse: 'knopf-still', href: `${api0}?a=export&was=${was}`, download: '' }, text);
  return abschnitt('Export', 'Als Tabelle (CSV, öffnet in Excel und Numbers). Monatlich kündbar heißt auch: Die Daten nehmen Sie jederzeit mit.',
    el('div', { klasse: 'tafel-wege' }, knopf('termine', 'Termine'), knopf('kunden', 'Kunden'), knopf('protokoll', 'Protokoll'), knopf('einwilligungen', 'Einwilligungen'),
      knopf('nachrichten', 'Nachrichten'), knopf('gutscheine', 'Gutscheine'), knopf('lager', 'Lager')));
}

/** Einstellungen speichern — ein Weg für alle Abschnitte. */
async function einstellungenSichern(e, fehler) {
  fehler.hidden = true;
  try { await api('einstellungen_speichern', { post: e }); await stammdatenLaden(); meldung('Gespeichert', 'ok'); }
  catch (ex) { fehler.textContent = ex.message; fehler.hidden = false; }
}
const zahlFeld = (e, name, text, einheit, attr, faktor = 1) => el('label', { klasse: 'feld feld-schmal' }, el('span', { klasse: 'feld-name', text }),
  el('span', { klasse: 'mit-einheit' }, el('input', { type: 'number', value: e[name] / faktor, inputmode: 'decimal', onchange: (ev) => { e[name] = Math.round(+ev.target.value * faktor); }, ...attr }), el('span', { text: einheit })));
const hakenFeld = (e, name, text) => el('label', { klasse: 'haken' }, el('input', { type: 'checkbox', checked: e[name], onchange: (ev) => { e[name] = ev.target.checked; } }), el('span', { text }));
const uhrFeld = (e, name, text) => el('label', { klasse: 'feld feld-schmal' }, el('span', { klasse: 'feld-name', text }),
  el('input', { type: 'time', step: 900, value: hhmm(e[name]), onchange: (ev) => { e[name] = minuten(ev.target.value); } }));

/** Wann das System von selbst schreibt. */
function nachrichtenTeil() {
  const e = structuredClone(Z.s.einstellungen);
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  return abschnitt('Nachrichten', 'SMS kosten pro Stück; E-Mails nicht. Deshalb geht die SMS am Vortag nur, wo sie sich lohnt — außer Sie stellen „immer“ ein.',
    el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'SMS-Erinnerung am Vortag (nur mit Einwilligung)' }),
      el('div', { klasse: 'schalter schalter-klein schalter-umbruch', role: 'group', 'aria-label': 'SMS-Erinnerung' },
        [['regel', 'Wenn es sich lohnt'], ['immer', 'Immer'], ['nie', 'Nie']].map(([id, name]) => el('button', { type: 'button', 'aria-pressed': String(e.erinnerung_sms === id), text: name,
          onclick: (ev) => { e.erinnerung_sms = id; schalterWahl(ev); } })))),
    el('p', { klasse: 'seiten-info', text: '„Wenn es sich lohnt“: ab dem Betrag unten, nach einem Nichterscheinen, bei Buchung am Telefon oder vor Ort — und immer, wenn keine E-Mail-Adresse da ist.' }),
    el('div', { klasse: 'feld-raster' },
      zahlFeld(e, 'erinnerung_schwelle', 'SMS ab Terminpreis', '€', { min: 0, max: 1000, step: 5 }, 100),
      zahlFeld(e, 'recall_nachfass', 'Recall-Nachfrage nach', 'Tagen', { min: 3, max: 30 }),
      uhrFeld(e, 'ruhe_von', 'Werbung frühestens'), uhrFeld(e, 'ruhe_bis', 'Werbung spätestens'),
      zahlFeld(e, 'sms_preis_cent', 'Preis je SMS (Schätzung)', 'Cent', { min: 0, max: 100 }),
      zahlFeld(e, 'recall_preis_cent', 'Abrechnung je Zurückgeholter', '€', { min: 0, max: 100, step: .5 }, 100),
      zahlFeld(e, 'recall_deckel_cent', 'höchstens im Monat', '€', { min: 0, max: 1000, step: 5 }, 100)),
    el('div', { klasse: 'haken-reihe' }, hakenFeld(e, 'recall_aktiv', 'Recall: an den nächsten Termin erinnern'), hakenFeld(e, 'warteliste_aktiv', 'Warteliste anbieten')),
    fehler,
    el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: () => einstellungenSichern(e, fehler) }));
}

function treueTeil() {
  const e = structuredClone(Z.s.einstellungen);
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  return abschnitt('Treuekarte', 'Jeder Besuch ist ein Stempel; die Kundin sieht ihren Stand nach dem Buchen, das Studio in der Kundenkarte. Die Prämie wird dort eingelöst.',
    hakenFeld(e, 'treue_aktiv', 'Treuekarte an'),
    el('div', { klasse: 'feld-raster' }, zahlFeld(e, 'treue_n', 'Prämie nach', 'Besuchen', { min: 2, max: 50 })),
    el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Prämie (so steht sie bei der Kundin)' }),
      el('input', { value: e.treue_praemie, maxlength: 200, oninput: (ev) => { e.treue_praemie = ev.target.value; } })),
    fehler,
    el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: () => einstellungenSichern(e, fehler) }));
}

/** Abgleich mit der Kasse: was laut Terminbuch hätte kassiert werden
    sollen, und welche Gutscheine noch offen sind. Kein Steuer-Export —
    die Zahlen für die Kanzlei kommen aus der Kasse. */
function abgleichTeil() {
  const d = alsDatum(heute());
  const monate = Array.from({ length: 13 }, (_, i) => new Date(d.getFullYear(), d.getMonth() - i, 1));
  let wahl = 1;
  const api0 = new URL(document.querySelector('meta[name="irmonhair-api"]').content, location.href).href;
  const laden = () => { const m = monate[wahl]; location.href = `${api0}?a=export&was=umsatz&von=${iso(m)}&bis=${iso(new Date(m.getFullYear(), m.getMonth() + 1, 0))}`; };
  return abschnitt('Abgleich mit der Kasse', 'Geplante Umsätze: was laut Terminbuch im Monat hätte kassiert werden sollen (Terminpreise, abzüglich Nachlass) — zum Vergleich mit den Tagesabschlüssen der Kasse. Für die Steuer gilt allein die Kasse. Offene Gutscheine: ausgegeben, aber noch nicht (ganz) eingelöst — diese Summe fragt die Steuerkanzlei zum Jahresende.',
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Monat' }),
        el('select', { onchange: (ev) => { wahl = +ev.target.value; } }, monate.map((m, i) => el('option', { value: i, selected: i === wahl ? true : null, text: `${MONAT_LANG[m.getMonth()]} ${m.getFullYear()}` })))),
      el('div', { klasse: 'tafel-wege' },
        el('button', { type: 'button', klasse: 'knopf-still', text: 'Geplante Umsätze (CSV)', onclick: laden }),
        el('a', { klasse: 'knopf-still', href: `${api0}?a=export&was=gutscheine`, download: '' }, 'Gutscheine (CSV)'))));
}

/** Kundenliste aus Planity (oder einem anderen Programm) übernehmen. */
function importTeil() {
  let csv = '';
  const ergebnis = el('div', { 'aria-live': 'polite' });
  const datei = el('input', { type: 'file', accept: '.csv,text/csv,text/plain', onchange: async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    csv = await f.text();
    try {
      const r = await api('import_pruefen', { post: { csv } });
      fuellen(ergebnis, 
        el('p', { klasse: 'hinweis-zeile', text: `${r.zeilen} Zeilen: ${r.neu} neu, ${r.vorhanden} schon in der Kartei (werden nur ergänzt), ${r.ohne_kontakt} ohne Nummer und E-Mail (bleiben weg)${r.doppelt_in_datei ? `, ${r.doppelt_in_datei} doppelt in der Datei` : ''}. Erkannte Spalten: ${r.spalten.join(', ')}.` }),
        r.beispiele.length ? el('ul', { klasse: 'verlauf-liste' }, r.beispiele.map((b) => el('li', { klasse: 'verlauf-zeile' }, el('span', { text: b.name || '—' }), el('span', { klasse: 'zahl', text: b.telefon || '' }), el('span', { text: b.email || '' })))) : null,
        el('p', { klasse: 'seiten-info', text: 'Einwilligungen werden nicht übernommen — für Recall und Angebote fragen wir neu. Terminerinnerungen per E-Mail gehen ohnehin.' }),
        r.neu || r.vorhanden ? el('button', { type: 'button', klasse: 'knopf', text: `${r.neu} übernehmen`, onclick: async (e2) => {
          e2.currentTarget.disabled = true;
          try { const x = await api('import_kunden', { post: { csv, herkunft: 'planity' } }); fuellen(ergebnis, el('p', { klasse: 'hinweis-zeile', text: `Fertig: ${x.neu} angelegt, ${x.ergaenzt} ergänzt.` })); }
          catch (x) { meldung(x.message, 'fehler'); e2.currentTarget.disabled = false; }
        } }) : null);
    } catch (x) { fuellen(ergebnis, el('p', { klasse: 'form-fehler', text: x.message })); }
    ev.target.value = '';
  } });
  return abschnitt('Kunden übernehmen', 'Die Kundenliste als CSV — aus Planity (Export der Kundenliste) oder einem anderen Programm. Erst kommt eine Vorschau; übernommen wird erst nach Ihrem Klick. Echte Kundendaten erst nach unterschriebenem Auftragsverarbeitungsvertrag.',
    el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'CSV-Datei' }), datei), ergebnis);
}

function sicherungTeil() {
  const protokoll = el('ul', { klasse: 'protokoll' });
  let vor = null;
  const mehr = el('button', { type: 'button', klasse: 'text-link', text: 'Protokoll zeigen', onclick: async () => {
    const r = await api('protokoll', { get: { vor } });
    for (const z of r.eintraege) protokoll.append(el('li', {}, el('span', { klasse: 'zahl', text: `${tagText(z.zeit.slice(0, 10), 'zahl').slice(0, 6)} ${z.zeit.slice(11)}` }),
      el('span', { text: z.wer || (z.akteur === 'system' ? 'System' : 'Kundin online') }), el('span', { text: z.aktion.replace(/_/g, ' ') + (z.termin ? ` #${z.termin}` : '') })));
    vor = r.eintraege.at(-1)?.id;
    mehr.textContent = r.eintraege.length === 100 ? 'weitere' : '';
    mehr.hidden = r.eintraege.length < 100;
  } });
  return abschnitt('Sicherung', 'Alle Daten als Datei (ohne Passwörter) — zusätzlich zur Sicherung beim Webhoster. Am besten einmal im Monat.',
    el('a', { klasse: 'knopf-still', href: new URL(document.querySelector('meta[name="irmonhair-api"]').content + '?a=sicherung', location.href).href, download: '' }, 'Sicherung herunterladen'),
    el('h3', { klasse: 'form-titel', text: 'Protokoll' }), el('p', { klasse: 'seiten-info', text: 'Wer hat wann was geändert.' }), protokoll, mehr);
}

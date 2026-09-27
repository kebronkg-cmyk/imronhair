/* ═══════════════════════════════════════════════════════════════════════
   Termin: ansehen, anlegen, ändern — und Abwesenheiten (Blocker)

   Die Tafel für einen Termin zeigt zuerst, was man an der Theke braucht:
   wer, was, wann, die Nummer zum Antippen, die Notiz. Darunter die
   Zustände (erschienen, nicht erschienen), dann Ändern, Nächsten Termin
   planen, Absagen. Das Formular denkt mit: Kundin nach Name oder Nummer
   finden, Leistungen mit Dauer und Preis, und freie Zeiten als Vorschläge.
   ═══════════════════════════════════════════════════════════════════════ */

import { el, svg, ZEICHEN, euro, preisText, dauerText, tagText, plusTage, heute, minuten, hhmm, summePhasen,
  kundenName, telLink, waLink, meldung, fragen, spaeter, sucheNorm } from './hilfen.js';
import { Z, api, inhaberin, personVon, salonVon, leistungVon } from './api.js';
import { tafelAuf, tafelZu, tafelTitel } from './tafel.js';
import { kundeZeigen } from './kunden.js';

const STATUS_NAME = { gebucht: 'Gebucht', erschienen: 'Erschienen', nicht_erschienen: 'Nicht erschienen', storniert: 'Abgesagt' };
const QUELLE = { online: 'online gebucht', telefon: 'am Telefon', vorort: 'vor Ort', studio: 'im Studio' };
const AKTION = {
  termin_angelegt: 'angelegt', termin_geaendert: 'geändert', online_storniert: 'online abgesagt', online_umgebucht: 'online verschoben',
};

/* ── Ansehen ─────────────────────────────────────────────────────────── */
export async function terminZeigen(id, nachher) {
  const koerper = tafelAuf({ titel: 'Termin', unter: '…' });
  let t;
  try {
    t = await api('termin_verlauf', { get: { id } });
  } catch (e) {
    koerper.replaceChildren(el('p', { klasse: 'leer', text: e.message }));
    return;
  }
  zeichneTermin(koerper, t, nachher);
}

function zeichneTermin(koerper, t, nachher) {
  const p = personVon(t.person);
  const s = salonVon(t.salon);
  const datum = t.start.slice(0, 10);
  tafelTitel(kundenName(t), `${tagText(datum, 'lang')} · ${t.start.slice(11)}–${t.ende.slice(11)} · ${p?.name || t.person}${Z.s.salons.length > 1 ? ' · ' + s.name : ''}`);
  const k = t.kunde && !t.kunde.geloescht ? t.kunde : null;

  const aendern = async (felder, text) => {
    try {
      const neu = await api('termin_aendern', { post: { id: t.id, version: t.version, ...felder } });
      if (text) meldung(text, 'ok');
      zeichneTermin(koerper, { ...neu, verlauf: t.verlauf }, nachher);
      nachher?.();
    } catch (e) {
      if (e.daten.code === 'konflikt') {
        const ok = await fragen({ titel: 'Überschneidung', text: 'Zu dieser Zeit ist schon etwas eingetragen:', liste: e.daten.konflikte.map((x) => x.text), ja: 'Trotzdem' });
        if (ok) return aendern({ ...felder, trotzdem: true }, text);
      } else if (e.daten.code === 'veraltet') {
        meldung('Jemand hat den Termin gerade geändert — hier ist der neue Stand.', 'fehler');
        zeichneTermin(koerper, { ...e.daten.termin, verlauf: t.verlauf }, nachher);
        nachher?.();
      } else meldung(e.message, 'fehler');
    }
  };

  const teile = [];

  // Zustand: drei Schalter; „Abgesagt“ steht unten als eigene Handlung.
  if (t.status !== 'storniert') {
    const vergangen = t.start.slice(0, 10) <= heute();
    teile.push(el('div', { klasse: 'schalter status-schalter', role: 'group', 'aria-label': 'Zustand' },
      ['gebucht', 'erschienen', 'nicht_erschienen'].map((st) => el('button', {
        type: 'button', 'aria-pressed': String(t.status === st), text: STATUS_NAME[st],
        disabled: !vergangen && st !== 'gebucht' ? true : null,
        title: !vergangen && st !== 'gebucht' ? 'Erst am Tag des Termins' : null,
        onclick: () => t.status !== st && aendern({ status: st }, `${kundenName(t)}: ${STATUS_NAME[st]}`),
      }))));
  } else {
    teile.push(el('p', { klasse: 'hinweis-zeile ist-abgesagt', text: 'Dieser Termin ist abgesagt.' }));
  }

  // Die Kundin: Nummer zum Antippen, WhatsApp, E-Mail, Karteinotiz.
  if (k) {
    const besuch = k.besuche <= 1 ? 'Erster Besuch' : `${k.besuche}. Besuch`;
    const erinnerung = `Hallo ${k.vorname || ''}, wir freuen uns auf Sie ${datum === plusTage(heute(), 1) ? 'morgen' : 'am ' + tagText(datum)} um ${t.start.slice(11)} Uhr bei Irmonhair in ${s.name}. Bis bald!`.replace('Hallo ,', 'Hallo,');
    teile.push(el('section', { klasse: 'karte kunde-karte' },
      el('div', { klasse: 'karte-kopf' },
        el('button', { type: 'button', klasse: 'text-link', text: [k.vorname, k.nachname].filter(Boolean).join(' ') || 'Kundin', onclick: () => kundeZeigen(k.id) }),
        el('span', { klasse: 'marke', text: besuch }),
        k.nicht_erschienen ? el('span', { klasse: 'marke ist-warnung', text: `${k.nicht_erschienen}× nicht erschienen` }) : null),
      el('div', { klasse: 'kontakt-wege' },
        k.telefon ? el('a', { klasse: 'weg', href: telLink(k.telefon) }, svg(ZEICHEN.tel), el('span', { text: k.telefon_text })) : null,
        k.telefon ? el('a', { klasse: 'weg', href: waLink(k.telefon, erinnerung), target: '_blank', rel: 'noopener' }, svg(ZEICHEN.nachricht), el('span', { text: 'WhatsApp-Erinnerung' })) : null,
        k.email ? el('a', { klasse: 'weg', href: 'mailto:' + k.email }, svg(ZEICHEN.post), el('span', { text: k.email })) : null),
      k.notiz ? el('p', { klasse: 'kartei-notiz' }, el('span', { klasse: 'klein-titel', text: 'Kartei' }), k.notiz) : null));
  } else if (t.kunde?.geloescht) {
    teile.push(el('p', { klasse: 'hinweis-zeile', text: 'Die Kundendaten wurden auf Wunsch gelöscht.' }));
  } else if (t.gast_name) {
    teile.push(el('p', { klasse: 'hinweis-zeile', text: `Ohne Kundenkarte: ${t.gast_name}` }));
  }
  if (t.kundennotiz) teile.push(el('blockquote', { klasse: 'kunden-nachricht' }, el('span', { klasse: 'klein-titel', text: 'Nachricht der Kundin' }), t.kundennotiz));
  if (t.gast_name && k && sucheNorm(t.gast_name) !== sucheNorm([k.vorname, k.nachname].filter(Boolean).join(' '))) {
    teile.push(el('p', { klasse: 'hinweis-zeile', text: `Gebucht als „${t.gast_name}“ — gleiche Nummer wie ${[k.vorname, k.nachname].filter(Boolean).join(' ')}.` }));
  }

  // Leistungen, Ablauf, Preis.
  const ablauf = t.phasen.length > 1 ? t.phasen.map(([art, m]) => `${dauerText(m)} ${art === 'pause' ? 'Einwirkzeit' : 'Arbeit'}`).join(' · ') : null;
  teile.push(el('section', { klasse: 'karte' },
    el('ul', { klasse: 'posten' }, t.posten.map((x) => el('li', {},
      el('span', {}, x.name, x.laenge ? el('small', { text: ' · ' + x.laenge }) : null),
      el('span', { klasse: 'zahl', text: preisText(x.preis_cent, x.preis_ab) })))),
    el('p', { klasse: 'summe' }, el('span', { text: dauerText(summePhasen(t.phasen)) + (ablauf ? '' : '') }), el('strong', { text: preisText(t.preis_cent, t.preis_ab) })),
    ablauf ? el('p', { klasse: 'ablauf', text: ablauf }) : null));

  // Interne Notiz: direkt bearbeiten, speichert beim Verlassen.
  const notiz = el('textarea', { klasse: 'notiz-feld', rows: 2, placeholder: 'Interne Notiz (sieht die Kundin nicht)', value: t.notiz || '' });
  notiz.addEventListener('change', () => aendern({ notiz: notiz.value.trim() || null }, 'Notiz gespeichert'));
  teile.push(el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Notiz' }), notiz));

  // Handlungen.
  const wege = el('div', { klasse: 'tafel-wege' });
  if (t.status !== 'storniert') {
    wege.append(
      el('button', { type: 'button', klasse: 'knopf-still', onclick: () => terminNeu({ termin: t }, nachher) }, svg(ZEICHEN.stift), el('span', { text: 'Ändern' })),
      k ? el('button', { type: 'button', klasse: 'knopf-still', onclick: () => naechsterTermin(t, nachher) }, svg(ZEICHEN.kalender), el('span', { text: 'Nächsten Termin planen' })) : null,
      el('button', { type: 'button', klasse: 'knopf-still knopf-leise', text: 'Absagen', onclick: async () => {
        const ok = await fragen({ titel: 'Termin absagen?', text: `${kundenName(t)}, ${tagText(datum, 'lang')} um ${t.start.slice(11)}. Die Zeit wird wieder frei.`, ja: 'Absagen', nein: 'Behalten', gefahr: true });
        if (ok) aendern({ status: 'storniert' }, 'Termin abgesagt');
      } }));
  } else {
    wege.append(el('button', { type: 'button', klasse: 'knopf-still', text: 'Wiederherstellen', onclick: () => aendern({ status: 'gebucht' }, 'Wiederhergestellt') }));
  }
  teile.push(wege);

  // Herkunft und Verlauf.
  const verlauf = (t.verlauf || []).map((v) => el('li', {}, el('span', { klasse: 'zahl', text: `${tagText(v.zeit.slice(0, 10), 'zahl').slice(0, 6)} ${v.zeit.slice(11)}` }),
    el('span', { text: `${AKTION[v.aktion] || v.aktion}${v.wer ? ' von ' + v.wer : ''}${verlaufText(v.daten)}` })));
  teile.push(el('details', { klasse: 'verlauf' },
    el('summary', { text: `${QUELLE[t.quelle] || t.quelle} · ${tagText(t.erstellt.slice(0, 10), 'zahl')}` }),
    el('ul', {}, verlauf)));

  koerper.replaceChildren(...teile);
}

function verlaufText(d) {
  if (!d) return '';
  const aus = [];
  if (d.start) aus.push(Array.isArray(d.start) ? ` · ${d.start[0].slice(5, 16)} → ${d.start[1].slice(5, 16)}` : '');
  if (d.person_id) aus.push(` · ${personVon(d.person_id[0])?.name || d.person_id[0]} → ${personVon(d.person_id[1])?.name || d.person_id[1]}`);
  if (d.status) aus.push(` · ${STATUS_NAME[d.status[1]] || d.status[1]}`);
  if (d.dauer) aus.push(' · Dauer');
  return aus.join('');
}

/** Nächster Termin: gleicher Rhythmus wie bisher, sonst sechs Wochen. */
async function naechsterTermin(t, nachher) {
  let tage = 42;
  try {
    const k = await api('kunde', { get: { id: t.kunde.id } });
    if (k.rhythmus_tage && k.rhythmus_tage >= 14 && k.rhythmus_tage <= 180) tage = k.rhythmus_tage;
  } catch (e) { /* Vorgabe reicht */ }
  const ziel = plusTage(t.start.slice(0, 10), tage);
  terminNeu({
    salon: t.salon, datum: ziel < heute() ? heute() : ziel, person: t.person, kunde: t.kunde,
    leistungen: t.posten.map((x) => x.leistung).filter((id) => id && leistungVon(id)?.aktiv),
    hinweis: `In ${Math.round(tage / 7)} Wochen — ${tage === 42 ? 'übliche Pause' : 'ihr gewohnter Abstand'}.`,
  }, nachher);
}

/* ── Anlegen und Ändern ──────────────────────────────────────────────── */
/**
 * v: { salon, datum, zeit?, person?, kunde?, leistungen?, termin? (zum Ändern), hinweis? }
 */
export function terminNeu(v, nachher) {
  const alt = v.termin || null;
  const f = {
    art: 'termin',
    salon: alt ? alt.salon : v.salon,
    kunde: alt ? (alt.kunde && !alt.kunde.geloescht ? alt.kunde : null) : (v.kunde || null),
    neuKunde: null,              // {name, telefon, email} beim Anlegen
    leistungen: alt ? alt.posten.map((x) => x.leistung).filter((id) => id && leistungVon(id)) : (v.leistungen || []),
    person: alt ? alt.person : (v.person || null),
    datum: alt ? alt.start.slice(0, 10) : v.datum,
    zeit: alt ? alt.start.slice(11) : (v.zeit || ''),
    phasen: alt ? alt.phasen : null,       // null = aus den Leistungen
    preis: alt && alt.preis_cent !== null ? alt.preis_cent : null,
    preisGeaendert: false,
    notiz: alt ? alt.notiz || '' : '',
    quelle: 'telefon',
    trotzdem: false,
  };
  const koerper = tafelAuf({ titel: alt ? 'Termin ändern' : 'Neuer Termin', unter: salonVon(f.salon).name, breit: true });
  const anfrageId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);

  const bereiche = {
    art: el('div'), kunde: el('section', { klasse: 'form-teil' }), leistungen: el('section', { klasse: 'form-teil' }),
    person: el('section', { klasse: 'form-teil' }), wann: el('section', { klasse: 'form-teil' }), rest: el('section', { klasse: 'form-teil' }),
    fehler: el('p', { klasse: 'form-fehler', role: 'alert', hidden: true }), wege: el('div', { klasse: 'tafel-wege tafel-wege-fest' }),
  };
  if (v.hinweis) koerper.append(el('p', { klasse: 'hinweis-zeile', text: v.hinweis }));
  if (!alt) koerper.append(bereiche.art);
  koerper.append(bereiche.kunde, bereiche.leistungen, bereiche.person, bereiche.wann, bereiche.rest, bereiche.fehler, bereiche.wege);

  const leistungen = () => f.leistungen.map(leistungVon).filter(Boolean);
  const phasen = () => {
    if (f.phasen) return f.phasen;
    const aus = [];
    for (const l of leistungen()) for (const [art, m] of l.phasen) { if (aus.length && aus.at(-1)[0] === art) aus.at(-1)[1] += m; else aus.push([art, m]); }
    while (aus.length && aus.at(-1)[0] === 'pause') aus.pop();
    return aus;
  };
  const preisRechnen = () => {
    const ls = leistungen();
    if (!ls.length) return { cent: null, ab: false };
    const bekannt = ls.filter((l) => l.preis_cent !== null);
    return { cent: bekannt.length ? bekannt.reduce((s, l) => s + l.preis_cent, 0) : null, ab: ls.some((l) => l.preis_ab || l.preis_cent === null) };
  };

  /* Art: Termin oder Blocker */
  function artZeichnen() {
    bereiche.art.replaceChildren(el('div', { klasse: 'schalter art-schalter', role: 'group', 'aria-label': 'Art' },
      [['termin', 'Termin'], ['blocker', 'Abwesenheit / Blocker']].map(([id, name]) => el('button', {
        type: 'button', 'aria-pressed': String(f.art === id), text: name,
        onclick: () => { if (id === 'blocker') { abwesenheitNeu({ person: f.person, datum: f.datum, zeit: f.zeit }, nachher); } },
      }))));
  }

  /* Kundin */
  function kundeZeichnen() {
    const b = bereiche.kunde;
    const titel = el('h3', { klasse: 'form-titel', text: 'Kundin' });
    if (f.kunde) {
      const k = f.kunde;
      b.replaceChildren(titel, el('div', { klasse: 'gewaehlt-karte' },
        el('span', { klasse: 'gewaehlt-name', text: [k.vorname, k.nachname].filter(Boolean).join(' ') || 'Ohne Namen' }),
        el('span', { klasse: 'gewaehlt-info', text: [k.telefon_text, k.besuche ? `${k.besuche} Besuche` : null].filter(Boolean).join(' · ') }),
        el('button', { type: 'button', klasse: 'text-link', text: 'andere', onclick: () => { f.kunde = null; kundeZeichnen(); b.querySelector('input')?.focus(); } })));
      return;
    }
    if (f.neuKunde) {
      const n = f.neuKunde;
      const feld = (name, text, attr) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }),
        el('input', { value: n[name] || '', oninput: (e) => { n[name] = e.target.value; }, ...attr }));
      b.replaceChildren(titel, el('div', { klasse: 'feld-reihe' },
        feld('name', 'Name', { autocomplete: 'off', required: true }),
        feld('telefon', 'Handy', { type: 'tel', inputmode: 'tel', autocomplete: 'off', placeholder: '0176 …' }),
        feld('email', 'E-Mail (freiwillig)', { type: 'email', inputmode: 'email', autocomplete: 'off' })),
        el('button', { type: 'button', klasse: 'text-link', text: 'Doch vorhandene Kundin suchen', onclick: () => { f.neuKunde = null; kundeZeichnen(); } }));
      b.querySelector('input').focus();
      return;
    }
    const liste = el('ul', { klasse: 'treffer', role: 'listbox' });
    const eingabe = el('input', { type: 'search', klasse: 'such-feld', placeholder: 'Name oder Nummer', autocomplete: 'off', 'aria-label': 'Kundin suchen' });
    const suchen = spaeter(async () => {
      const q = eingabe.value.trim();
      if (q.length < 2) { liste.replaceChildren(); return; }
      try {
        const r = await api('kunden', { get: { q } });
        if (eingabe.value.trim() !== q) return;
        const istNummer = /^[\d\s+/()-]{5,}$/.test(q);
        liste.replaceChildren(
          ...r.kunden.slice(0, 8).map((k) => el('li', {}, el('button', { type: 'button', klasse: 'treffer-zeile', onclick: () => { f.kunde = k; kundeZeichnen(); } },
            el('span', { klasse: 'treffer-name', text: [k.vorname, k.nachname].filter(Boolean).join(' ') || '—' }),
            el('span', { klasse: 'treffer-info', text: [k.telefon_text, k.naechster ? 'nächster ' + tagText(k.naechster.slice(0, 10)) : k.letzter ? 'zuletzt ' + tagText(k.letzter, 'zahl') : 'noch kein Termin'].filter(Boolean).join(' · ') })))),
          el('li', {}, el('button', { type: 'button', klasse: 'treffer-zeile treffer-neu', onclick: () => {
            f.neuKunde = istNummer ? { telefon: q } : { name: q };
            kundeZeichnen();
          } }, el('span', { klasse: 'treffer-name', text: `+ Neue Kundin „${q}“` }))));
      } catch (e) { liste.replaceChildren(el('li', { klasse: 'leer', text: e.message })); }
    });
    eingabe.addEventListener('input', suchen);
    b.replaceChildren(titel, eingabe, liste,
      el('p', { klasse: 'form-klein' },
        el('button', { type: 'button', klasse: 'text-link', text: 'Neue Kundin', onclick: () => { f.neuKunde = {}; kundeZeichnen(); } }),
        ' · ',
        el('button', { type: 'button', klasse: 'text-link', text: 'ohne Namen (Laufkundschaft)', onclick: () => { f.neuKunde = null; f.kunde = null; eingabe.value = ''; liste.replaceChildren(); meldung('Termin ohne Kundenkarte — Name kann später ergänzt werden.'); } })));
  }

  /* Leistungen */
  let auswahlOffen = !f.leistungen.length;
  function leistungenZeichnen() {
    const b = bereiche.leistungen;
    const ls = leistungen();
    const gewaehlt = el('ul', { klasse: 'gewaehlt-liste' }, ls.map((l) => el('li', {},
      el('span', {}, l.name, l.laenge ? el('small', { text: ' · ' + l.laenge }) : null),
      el('span', { klasse: 'zahl', text: `${dauerText(summePhasen(l.phasen))} · ${preisText(l.preis_cent, l.preis_ab, l.preis_text)}` }),
      el('button', { type: 'button', klasse: 'klein-zu', 'aria-label': `${l.name} entfernen`, onclick: () => {
        f.leistungen = f.leistungen.filter((x) => x !== l.id); f.phasen = null; if (!f.leistungen.length) auswahlOffen = true;
        alles();
      } }, svg(ZEICHEN.zu)))));
    const teile = [el('h3', { klasse: 'form-titel', text: 'Leistungen' }), ls.length ? gewaehlt : null];
    if (auswahlOffen) teile.push(leistungAuswahl());
    else teile.push(el('button', { type: 'button', klasse: 'text-link', text: '+ weitere Leistung', onclick: () => { auswahlOffen = true; leistungenZeichnen(); bereiche.leistungen.querySelector('.such-feld')?.focus(); } }));
    b.replaceChildren(...teile);
  }
  let lSuche = '';
  let lGruppe = null;
  function leistungAuswahl() {
    const alle = Z.s.leistungen.filter((l) => l.salon === f.salon && l.aktiv);
    const gruppen = Z.s.gruppen.filter((g) => alle.some((l) => l.gruppe === g.id));
    if (!lGruppe) lGruppe = gruppen[0]?.id;
    const liste = el('ul', { klasse: 'leistung-liste' });
    const fuellen = () => {
      const q = sucheNorm(lSuche);
      const treffer = alle.filter((l) => (q ? q.split(/\s+/).every((w) => sucheNorm(l.name + ' ' + (l.zusatz || '') + ' ' + (l.laenge || '')).includes(w)) : l.gruppe === lGruppe));
      liste.replaceChildren(...treffer.map((l) => el('li', {}, el('button', {
        type: 'button', klasse: 'leistung-zeile' + (f.leistungen.includes(l.id) ? ' ist-gewaehlt' : ''),
        onclick: () => {
          if (!f.leistungen.includes(l.id)) f.leistungen.push(l.id);
          f.phasen = null;
          auswahlOffen = false;
          alles();
        },
      },
        el('span', { klasse: 'leistung-name' }, l.name, l.laenge ? el('small', { text: ' · ' + l.laenge }) : null, !l.online ? el('small', { klasse: 'marke', text: 'nur Studio' }) : null),
        el('span', { klasse: 'zahl', text: `${dauerText(summePhasen(l.phasen))} · ${preisText(l.preis_cent, l.preis_ab, l.preis_text)}` })))));
      if (!treffer.length) liste.append(el('li', { klasse: 'leer', text: 'Nichts gefunden.' }));
    };
    const suche = el('input', { type: 'search', klasse: 'such-feld', placeholder: 'Leistung suchen', value: lSuche, 'aria-label': 'Leistung suchen',
      oninput: (e) => { lSuche = e.target.value; fuellen(); reiter.hidden = !!lSuche; } });
    const reiter = el('div', { klasse: 'reiter', role: 'tablist', hidden: !!lSuche }, gruppen.map((g) => el('button', {
      type: 'button', role: 'tab', 'aria-selected': String(g.id === lGruppe), text: g.name,
      onclick: (e) => { lGruppe = g.id; for (const r of reiter.children) r.setAttribute('aria-selected', String(r === e.currentTarget)); fuellen(); },
    })));
    fuellen();
    return el('div', { klasse: 'leistung-auswahl' }, suche, reiter, liste,
      f.leistungen.length ? el('button', { type: 'button', klasse: 'text-link', text: 'fertig', onclick: () => { auswahlOffen = false; leistungenZeichnen(); } }) : null);
  }

  /* Person */
  function personZeichnen() {
    const ls = leistungen();
    const inSalon = Z.s.personen.filter((p) => p.aktiv && (p.salons.includes(f.salon) || p.id === f.person));
    const koennen = (p) => ls.every((l) => l.personen.includes(p.id));
    const reihe = [...inSalon].sort((a, b) => Number(koennen(b)) - Number(koennen(a)));
    bereiche.person.replaceChildren(el('h3', { klasse: 'form-titel', text: 'Bei' }),
      el('div', { klasse: 'personen-wahl', role: 'group', 'aria-label': 'Person' },
        alt ? null : el('button', { type: 'button', klasse: 'chip', 'aria-pressed': String(!f.person), text: 'Wer frei ist', onclick: () => { f.person = null; personZeichnen(); vorschlaegeLaden(); } }),
        reihe.map((p) => el('button', {
          type: 'button', klasse: 'chip' + (koennen(p) || !ls.length ? '' : ' ist-fremd'), 'aria-pressed': String(f.person === p.id),
          title: koennen(p) || !ls.length ? null : 'Macht diese Leistung sonst nicht',
          stil: { '--farbe': `var(--person-${p.farbe})` },
          onclick: () => { f.person = p.id; personZeichnen(); vorschlaegeLaden(); },
        }, el('span', { klasse: 'punkt', 'aria-hidden': 'true' }), p.name))));
  }

  /* Wann: Datum, Uhrzeit, freie Zeiten */
  const vorschlagBox = el('div', { klasse: 'vorschlaege' });
  function wannZeichnen() {
    const datum = el('input', { type: 'date', value: f.datum, required: true, onchange: (e) => { f.datum = e.target.value; vorschlaegeLaden(); } });
    const zeit = el('input', { type: 'time', value: f.zeit, step: 300, required: true, onchange: (e) => { f.zeit = e.target.value; markieren(); } });
    const dauer = summePhasen(phasen());
    bereiche.wann.replaceChildren(el('h3', { klasse: 'form-titel', text: 'Wann' }),
      el('div', { klasse: 'feld-reihe' },
        el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Datum' }), datum),
        el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Beginn' }), zeit),
        el('p', { klasse: 'feld feld-info' }, el('span', { klasse: 'feld-name', text: 'Ende' }),
          el('span', { klasse: 'zahl', text: f.zeit && dauer ? `${hhmm(minuten(f.zeit) + dauer)} · ${dauerText(dauer)}` : '—' }))),
      vorschlagBox, ablaufEditor());
  }
  let vorschlagNr = 0;
  async function vorschlaegeLaden() {
    const nr = ++vorschlagNr;
    if (!f.leistungen.length) { vorschlagBox.replaceChildren(el('p', { klasse: 'form-klein', text: 'Nach der Wahl einer Leistung stehen hier freie Zeiten.' })); return; }
    vorschlagBox.replaceChildren(el('p', { klasse: 'form-klein', text: 'Freie Zeiten werden gesucht …' }));
    let antwort;
    try {
      antwort = await vorschlaegeHolen();
    } catch (e) {
      if (nr === vorschlagNr) vorschlagBox.replaceChildren(el('p', { klasse: 'form-klein', text: e.message }));
      return;
    }
    if (nr !== vorschlagNr) return;
    const nachTag = new Map();
    for (const z of antwort.frei) { if (!nachTag.has(z.datum)) nachTag.set(z.datum, []); nachTag.get(z.datum).push(z); }
    const tage = [...nachTag.keys()].slice(0, 3);
    if (!tage.length) { vorschlagBox.replaceChildren(el('p', { klasse: 'form-klein', text: 'In den nächsten sieben Tagen ist dafür nichts frei.' })); return; }
    vorschlagBox.replaceChildren(el('p', { klasse: 'klein-titel', text: 'Frei' }), ...tage.map((d) => el('div', { klasse: 'vorschlag-tag' },
      el('span', { klasse: 'vorschlag-datum', text: tagText(d) }),
      el('div', { klasse: 'vorschlag-zeiten' }, nachTag.get(d).slice(0, 14).map((z) => el('button', {
        type: 'button', klasse: 'chip chip-zeit', daten: { datum: z.datum, zeit: z.t }, text: z.t,
        title: z.p.map((id) => personVon(id)?.name).join(', '),
        onclick: () => {
          f.datum = z.datum; f.zeit = z.t;
          if (!f.person || !z.p.includes(f.person)) f.person = z.p[0];
          personZeichnen(); wannZeichnen(); markieren();
        },
      }))))));
    markieren();
  }
  function vorschlaegeHolen() {
    // Die Leistungen gehen als Liste im Körper mit (POST), der Rest in der Adresse.
    return api('vorschlaege', { get: { salon: f.salon, person: f.person || '', von: f.datum < heute() ? heute() : f.datum, tage: 7, ohne: alt?.id || '' }, post: { leistungen: f.leistungen, phasen: f.phasen || undefined } });
  }
  function markieren() {
    for (const c of vorschlagBox.querySelectorAll('.chip-zeit')) c.setAttribute('aria-pressed', String(c.dataset.datum === f.datum && c.dataset.zeit === f.zeit));
    const ende = bereiche.wann.querySelector('.feld-info .zahl');
    const dauer = summePhasen(phasen());
    if (ende) ende.textContent = f.zeit && dauer ? `${hhmm(minuten(f.zeit) + dauer)} · ${dauerText(dauer)}` : '—';
    const d = bereiche.wann.querySelector('input[type=date]'); if (d && d.value !== f.datum) d.value = f.datum;
    const z = bereiche.wann.querySelector('input[type=time]'); if (z && z.value !== f.zeit) z.value = f.zeit;
  }

  /* Ablauf: Arbeit und Einwirkzeit anpassen */
  function ablaufEditor() {
    const ph = phasen();
    if (!ph.length) return null;
    const box = el('details', { klasse: 'ablauf-editor', open: f.phasen ? true : null },
      el('summary', { text: `Ablauf: ${ph.map(([a, m]) => `${m} ${a === 'pause' ? 'Einwirken' : 'Arbeit'}`).join(' · ')} Min.` }));
    const reihe = el('div', { klasse: 'ablauf-reihe' });
    ph.forEach(([art, m], i) => {
      reihe.append(el('label', { klasse: 'feld feld-schmal' }, el('span', { klasse: 'feld-name', text: art === 'pause' ? 'Einwirken' : 'Arbeit' }),
        el('input', { type: 'number', min: art === 'pause' ? 0 : 5, max: 480, step: 5, value: m, inputmode: 'numeric',
          onchange: (e) => {
            const neu = phasen().map((p) => [...p]);
            neu[i][1] = Math.max(0, Math.min(480, Math.round(+e.target.value / 5) * 5 || 0));
            f.phasen = neu.filter((p) => p[1] > 0);
            markieren();
            vorschlaegeLaden();
            box.querySelector('summary').textContent = `Ablauf: ${f.phasen.map(([a, mm]) => `${mm} ${a === 'pause' ? 'Einwirken' : 'Arbeit'}`).join(' · ')} Min.`;
          } })));
    });
    if (f.phasen) reihe.append(el('button', { type: 'button', klasse: 'text-link', text: 'wie die Leistung', onclick: () => { f.phasen = null; wannZeichnen(); vorschlaegeLaden(); } }));
    box.append(reihe);
    return box;
  }

  /* Preis, Notiz, Quelle */
  function restZeichnen() {
    const p = preisRechnen();
    const preisFeld = el('input', { type: 'text', inputmode: 'decimal', klasse: 'preis-feld', 'aria-label': 'Preis in Euro',
      value: f.preisGeaendert && f.preis !== null ? String(f.preis / 100).replace('.', ',') : '',
      placeholder: p.cent !== null ? (p.ab ? 'ab ' : '') + euro(p.cent).replace(' €', '') : 'offen',
      onchange: (e) => {
        const w = e.target.value.trim().replace(/[^\d,.]/g, '').replace(',', '.');
        f.preisGeaendert = w !== '';
        f.preis = w === '' ? null : Math.round(parseFloat(w) * 100);
      } });
    bereiche.rest.replaceChildren(
      el('div', { klasse: 'feld-reihe' },
        el('label', { klasse: 'feld feld-schmal' }, el('span', { klasse: 'feld-name', text: 'Preis (€)' }), preisFeld),
        alt ? null : el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Gebucht' }),
          el('div', { klasse: 'schalter schalter-klein', role: 'group', 'aria-label': 'Wie gebucht' },
            [['telefon', 'am Telefon'], ['vorort', 'vor Ort']].map(([id, name]) => el('button', { type: 'button', 'aria-pressed': String(f.quelle === id), text: name,
              onclick: (e) => { f.quelle = id; for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } }))))),
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Interne Notiz' }),
        el('textarea', { rows: 2, value: f.notiz, placeholder: 'z. B. Farbe 7.1 + 20 Vol.', oninput: (e) => { f.notiz = e.target.value; } })));
  }

  function wegeZeichnen() {
    bereiche.wege.replaceChildren(
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Abbrechen', onclick: tafelZu }),
      el('button', { type: 'button', klasse: 'knopf', id: 'termin-speichern', text: alt ? 'Änderung speichern' : 'Termin eintragen', onclick: () => speichern() }));
  }

  function alles() {
    kundeZeichnen(); leistungenZeichnen(); personZeichnen(); wannZeichnen(); restZeichnen();
    vorschlaegeLaden();
  }

  async function speichern(trotzdem = false) {
    const fehler = (text) => { bereiche.fehler.textContent = text; bereiche.fehler.hidden = false; bereiche.fehler.scrollIntoView({ block: 'nearest' }); };
    bereiche.fehler.hidden = true;
    if (!f.leistungen.length) return fehler('Bitte mindestens eine Leistung wählen.');
    if (!f.datum || !/^\d\d:\d\d$/.test(f.zeit || '')) return fehler('Bitte Datum und Beginn angeben — oder eine freie Zeit antippen.');
    if (f.neuKunde && !(f.neuKunde.name || '').trim() && !(f.neuKunde.telefon || '').trim()) return fehler('Bitte Name oder Nummer der Kundin angeben.');
    const knopf = document.getElementById('termin-speichern');
    knopf.disabled = true;
    const daten = {
      leistungen: f.leistungen, person: f.person, start: `${f.datum} ${f.zeit}`,
      phasen: f.phasen || undefined, notiz: f.notiz.trim() || null, trotzdem,
    };
    if (f.preisGeaendert) daten.preis_cent = f.preis;
    if (f.kunde) daten.kunde_id = f.kunde.id;
    else if (f.neuKunde) daten.kunde = { name: (f.neuKunde.name || '').trim(), telefon: (f.neuKunde.telefon || '').trim(), email: (f.neuKunde.email || '').trim() };
    try {
      let t;
      if (alt) {
        if (!f.kunde && !f.neuKunde && alt.kunde) daten.kunde_id = null;
        t = await api('termin_aendern', { post: { id: alt.id, version: alt.version, ...daten } });
        meldung('Termin geändert', 'ok');
      } else {
        t = await api('termin_neu', { post: { salon: f.salon, quelle: f.quelle, anfrage_id: anfrageId, ...daten } });
        meldung(`Eingetragen: ${tagText(f.datum)} ${f.zeit} bei ${t.person_name}`, 'ok');
      }
      nachher?.();
      terminZeigen(t.id, nachher);
    } catch (e) {
      knopf.disabled = false;
      if (e.daten.code === 'konflikt') {
        const ok = await fragen({ titel: 'Überschneidung', text: 'Zu dieser Zeit ist schon etwas eingetragen:', liste: e.daten.konflikte.map((x) => x.text), ja: 'Trotzdem eintragen', nein: 'Andere Zeit' });
        if (ok) return speichern(true);
      } else if (e.daten.code === 'veraltet') {
        fehler('Jemand hat den Termin inzwischen geändert. Bitte die Tafel schließen und neu öffnen.');
      } else {
        fehler(e.message);
      }
    }
  }

  if (!alt) artZeichnen();
  alles();
  wegeZeichnen();
  if (!alt && !f.kunde) requestAnimationFrame(() => bereiche.kunde.querySelector('input')?.focus());
}

/* ── Abwesenheit / Blocker ───────────────────────────────────────────── */
const ARTEN = [['pause', 'Pause'], ['frei', 'Frei'], ['urlaub', 'Urlaub'], ['krank', 'Krank'], ['schulung', 'Schulung'], ['geschlossen', 'Salon geschlossen']];

export function abwesenheitNeu(v, nachher) { abwesenheitForm(null, v, nachher); }
export function abwesenheitZeigen(ab, nachher) { abwesenheitForm(ab, {}, nachher); }

function abwesenheitForm(ab, v, nachher) {
  const f = ab
    ? { person: ab.person, salon: ab.salon, von: ab.von, bis: ab.bis, art: ab.art, notiz: ab.notiz || '' }
    : { person: v.person || null, salon: null, von: `${v.datum} ${v.zeit || '12:00'}`, bis: `${v.datum} ${hhmm(Math.min(1439, minuten(v.zeit || '12:00') + 60))}`, art: 'pause', notiz: '' };
  if (!ab && !f.person) f.person = Z.ich.id;
  const koerper = tafelAuf({ titel: ab ? 'Abwesenheit' : 'Neue Abwesenheit', unter: 'Blockt die Zeit für Online-Buchungen' });
  const personen = Z.s.personen.filter((p) => p.aktiv);
  const wer = el('select', { onchange: (e) => { f.person = e.target.value || null; if (!f.person) f.salon = Z.salon; } },
    personen.map((p) => el('option', { value: p.id, text: p.name, selected: f.person === p.id ? true : null })),
    inhaberin() ? el('option', { value: '', text: `Ganzer Salon ${salonVon(Z.salon).name}`, selected: !f.person ? true : null }) : null);
  const feldZeit = (name) => el('div', { klasse: 'feld-reihe' },
    el('input', { type: 'date', value: f[name].slice(0, 10), onchange: (e) => { f[name] = `${e.target.value} ${f[name].slice(11)}`; } }),
    el('input', { type: 'time', step: 300, value: f[name].slice(11, 16), onchange: (e) => { f[name] = `${f[name].slice(0, 10)} ${e.target.value}`; } }));
  const art = el('div', { klasse: 'schalter schalter-klein schalter-umbruch', role: 'group', 'aria-label': 'Art' },
    ARTEN.map(([id, name]) => el('button', { type: 'button', 'aria-pressed': String(f.art === id), text: name,
      onclick: (e) => { f.art = id; for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } })));
  const schnell = el('p', { klasse: 'form-klein' },
    el('button', { type: 'button', klasse: 'text-link', text: 'ganzer Tag', onclick: () => { f.von = f.von.slice(0, 10) + ' 00:00'; f.bis = plusTage(f.von.slice(0, 10), 1) + ' 00:00'; neu(); } }),
    ' · ',
    el('button', { type: 'button', klasse: 'text-link', text: 'eine Woche', onclick: () => { f.von = f.von.slice(0, 10) + ' 00:00'; f.bis = plusTage(f.von.slice(0, 10), 7) + ' 00:00'; neu(); } }));
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  const neu = () => abwesenheitForm(ab ? { ...ab, ...f, id: ab.id } : null, { person: f.person, datum: f.von.slice(0, 10), zeit: f.von.slice(11) }, nachher);
  koerper.replaceChildren(
    el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Wer' }), wer),
    el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Art' }), art),
    el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Von' }), feldZeit('von')),
    el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Bis' }), feldZeit('bis')),
    schnell,
    el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Notiz' }), el('input', { value: f.notiz, maxlength: 255, oninput: (e) => { f.notiz = e.target.value; } })),
    fehler,
    el('div', { klasse: 'tafel-wege' },
      ab ? el('button', { type: 'button', klasse: 'knopf-still knopf-leise', text: 'Löschen', onclick: async () => {
        if (!await fragen({ titel: 'Abwesenheit löschen?', text: 'Die Zeit ist danach wieder buchbar.', ja: 'Löschen', gefahr: true })) return;
        await api('abwesenheit_loeschen', { post: { id: ab.id } });
        meldung('Gelöscht', 'ok'); tafelZu(); nachher?.();
      } }) : null,
      el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: async () => {
        fehler.hidden = true;
        try {
          const r = await api('abwesenheit_speichern', { post: { id: ab?.id, person: f.person, salon: f.person ? null : (f.salon || Z.salon), von: f.von, bis: f.bis, art: f.art, notiz: f.notiz.trim() || null } });
          tafelZu();
          nachher?.();
          if (r.betroffen.length) {
            await fragen({ titel: `${r.betroffen.length} ${r.betroffen.length === 1 ? 'Termin liegt' : 'Termine liegen'} in dieser Zeit`, text: 'Sie bleiben stehen. Bitte die Kundinnen anrufen und verschieben:',
              liste: r.betroffen.map((t) => `${tagText(t.start.slice(0, 10))} ${t.start.slice(11)} · ${kundenName(t)} · ${t.kunde?.telefon_text || 'ohne Nummer'}`), ja: 'Verstanden', nein: 'Schließen' });
          } else meldung('Gespeichert', 'ok');
        } catch (e) { fehler.textContent = e.message; fehler.hidden = false; }
      } })));
}


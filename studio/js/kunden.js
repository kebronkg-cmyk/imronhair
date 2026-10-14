/* ═══════════════════════════════════════════════════════════════════════
   Kunden: Kartei mit Suche, Kundenkarte, Doppelte, Auskunft, Löschen

   Die Suche versteht Namen (auch „mueller“ für „Müller“) und Nummern in
   jeder Schreibweise („0176 12“, „+49176…“). Die Karte zeigt, was man vor
   dem Termin wissen will: wann zuletzt, wie oft, in welchem Abstand — und
   daraus, wann der nächste Besuch ansteht.
   ═══════════════════════════════════════════════════════════════════════ */

import { $, el, fuellen, svg, ZEICHEN, euro, tagText, plusTage, heute, preisText, telLink, waLink, meldung, fragen, spaeter, speichern, tageZwischen, abgesagt } from './hilfen.js';
import { Z, api, apiAdresse, inhaberin, personVon, salonVon } from './api.js';
import { nachrichtZeile, eintragNeu } from './nachrichten.js';
import { tafelAuf, tafelZu } from './tafel.js';
import { terminZeigen, terminNeu } from './termin.js';

let flaeche = null;
let q = '';

export function zeigen(f) {
  flaeche = f;
  const eingabe = el('input', { type: 'search', klasse: 'such-feld such-gross', id: 'kunden-suche', value: q, placeholder: 'Name, Nummer oder E-Mail',
    autocomplete: 'off', 'aria-label': 'Kunden suchen', oninput: spaeter((e) => { q = e.target.value; laden(); }, 200) });
  f.replaceChildren(el('div', { klasse: 'seite' },
    el('div', { klasse: 'seiten-kopf' },
      el('h1', { klasse: 'seiten-titel', text: 'Kunden' }),
      el('button', { type: 'button', klasse: 'knopf', onclick: () => kundeBearbeiten(null) }, svg(ZEICHEN.plus), el('span', { text: 'Kundin' }))),
    eingabe,
    el('p', { klasse: 'seiten-info', id: 'kunden-info' }),
    el('ul', { klasse: 'kunden-liste', id: 'kunden-liste' })));
  if (fokusGleich) { fokusGleich = false; eingabe.focus(); }
  laden();
}
export function neuLaden() { if (flaeche?.dataset.bereich === 'kunden') laden(); }

/** „/“ oder der Suchknopf: zur Kartei und ins Suchfeld. */
let fokusGleich = false;
export function suchen() {
  // Erst wenn die Kartei gezeichnet ist, gibt es das Feld.
  if (location.hash !== '#kunden') { fokusGleich = true; location.hash = '#kunden'; return; }
  const i = $('kunden-suche');
  if (i) { i.focus(); i.select(); }
}

let ladeNr = 0;
async function laden() {
  const nr = ++ladeNr;
  try {
    const r = await api('kunden', { get: { q } });
    if (nr !== ladeNr || !$('kunden-liste')) return;
    $('kunden-info').textContent = q ? `${r.kunden.length === 60 ? 'Mehr als 60' : r.kunden.length} Treffer` : `${r.gesamt} in der Kartei · zuletzt bearbeitet`;
    $('kunden-liste').replaceChildren(...r.kunden.map((k) => el('li', {}, el('button', { type: 'button', klasse: 'kunden-zeile', onclick: () => kundeZeigen(k.id) },
      el('span', { klasse: 'kunden-name', text: [k.vorname, k.nachname].filter(Boolean).join(' ') || 'Ohne Namen' }),
      el('span', { klasse: 'kunden-tel zahl', text: k.telefon_text || '' }),
      el('span', { klasse: 'kunden-info', text: k.naechster ? `nächster ${tagText(k.naechster.slice(0, 10))}, ${k.naechster.slice(11)}` : k.letzter ? `${k.besuche}× · zuletzt ${tagText(k.letzter, 'zahl')}` : 'noch kein Termin' })))));
    if (!r.kunden.length) $('kunden-liste').append(el('li', { klasse: 'leer', text: q ? 'Niemand gefunden.' : 'Noch keine Kundinnen. Sie entstehen mit dem ersten Termin.' }));
  } catch (e) {
    if ($('kunden-liste')) $('kunden-liste').replaceChildren(el('li', { klasse: 'leer', text: e.message }));
  }
}

/* ── Kundenkarte ────────────────────────────────────────────────────── */
export async function kundeZeigen(id) {
  const koerper = tafelAuf({ titel: 'Kundin', unter: '…' });
  let k;
  try { k = await api('kunde', { get: { id } }); } catch (e) { koerper.replaceChildren(el('p', { klasse: 'leer', text: e.message })); return; }
  const name = [k.vorname, k.nachname].filter(Boolean).join(' ') || 'Ohne Namen';
  const kopf = $('tafel-titel');
  if (kopf) kopf.textContent = name;
  const unter = document.querySelector('.tafel-unter');
  if (unter) unter.textContent = `in der Kartei seit ${tagText(k.erstellt, 'zahl')}`;

  const kommend = k.termine.filter((t) => t.status === 'gebucht' && t.start >= heute()).reverse();
  const vergangen = k.termine.filter((t) => !(t.status === 'gebucht' && t.start >= heute()));
  const letzter = vergangen.find((t) => !abgesagt(t.status) && t.status !== 'nicht_erschienen');
  const teile = [];

  teile.push(el('div', { klasse: 'kontakt-wege' },
    k.telefon ? el('a', { klasse: 'weg', href: telLink(k.telefon) }, svg(ZEICHEN.tel), el('span', { text: k.telefon_text })) : null,
    k.telefon ? el('a', { klasse: 'weg', href: waLink(k.telefon), target: '_blank', rel: 'noopener' }, svg(ZEICHEN.nachricht), el('span', { text: 'WhatsApp' })) : null,
    k.email ? el('a', { klasse: 'weg', href: 'mailto:' + k.email }, svg(ZEICHEN.post), el('span', { text: k.email })) : null));

  // Zahlen auf einen Blick.
  const besuche = vergangen.filter((t) => t.status === 'erschienen' || (t.status === 'gebucht' && t.start < heute())).length;
  const faellig = letzter && k.rhythmus_tage ? plusTage(letzter.start.slice(0, 10), k.rhythmus_tage) : null;
  teile.push(el('dl', { klasse: 'kennzahlen' },
    el('div', {}, el('dt', { text: 'Besuche' }), el('dd', { text: String(besuche) })),
    el('div', {}, el('dt', { text: 'Umsatz' }), el('dd', { text: euro(k.umsatz_cent) })),
    el('div', {}, el('dt', { text: 'Rhythmus' }), el('dd', { text: k.rhythmus_tage ? `alle ${Math.round(k.rhythmus_tage / 7)} Wo.` : '—' })),
    el('div', { klasse: k.nicht_erschienen ? 'ist-warnung' : '' }, el('dt', { text: 'Nicht erschienen' }), el('dd', { text: String(k.nicht_erschienen) }))));

  if (!kommend.length && faellig) {
    const ueber = tageZwischen(faellig, heute());
    teile.push(el('p', { klasse: 'hinweis-zeile' + (ueber > 0 ? ' ist-faellig' : '') },
      ueber > 0 ? `Nächster Besuch wäre seit ${ueber} ${ueber === 1 ? 'Tag' : 'Tagen'} fällig — anrufen?` : `Nächster Besuch voraussichtlich um den ${tagText(faellig, 'zahl')}.`));
  }
  if (k.doppelt?.length) {
    teile.push(el('div', { klasse: 'hinweis-zeile ist-faellig' },
      el('span', { text: `Gleiche Nummer wie: ${k.doppelt.map((d) => [d.vorname, d.nachname].filter(Boolean).join(' ')).join(', ')}. ` }),
      ...k.doppelt.map((d) => el('button', { type: 'button', klasse: 'text-link', text: `${d.vorname || 'Karte'} hier zusammenführen`, onclick: async () => {
        if (!await fragen({ titel: 'Zusammenführen?', text: `Die Termine und Notizen von ${[d.vorname, d.nachname].filter(Boolean).join(' ')} wandern auf diese Karte; die andere Karte verschwindet.`, ja: 'Zusammenführen' })) return;
        await api('kunden_zusammenfuehren', { post: { ziel: k.id, quelle: d.id } });
        meldung('Zusammengeführt', 'ok'); kundeZeigen(k.id); neuLaden();
      } }))));
  }

  if (k.notiz) teile.push(el('p', { klasse: 'kartei-notiz' }, el('span', { klasse: 'klein-titel', text: 'Kartei' }), k.notiz));
  if (k.treue) teile.push(treueTeil(k));
  teile.push(einwilligungTeil(k));
  teile.push(fotoTeil(k));
  if (k.warteliste?.length) teile.push(el('p', { klasse: 'hinweis-zeile' }, el('span', { klasse: 'klein-titel', text: 'Warteliste' }),
    k.warteliste.map((w) => `${w.leistungen_namen.join(' + ')} · ${salonVon(w.salon)?.name} · ${tagText(w.von, 'zahl').slice(0, 6)}–${tagText(w.bis, 'zahl').slice(0, 6)}`).join(' / ')));
  if (k.gutscheine?.length) teile.push(el('p', { klasse: 'hinweis-zeile' }, el('span', { klasse: 'klein-titel', text: 'Gutscheine' }),
    k.gutscheine.map((g) => `${g.code}: ${euro(g.rest_cent)} bis ${tagText(g.gueltig_bis, 'zahl')}`).join(' · ')));

  const zeile = (t) => el('li', {}, el('button', { type: 'button', klasse: `verlauf-zeile ist-${t.status}`, onclick: () => terminZeigen(t.id) },
    el('span', { klasse: 'zahl', text: tagText(t.start.slice(0, 10), 'zahl') }),
    el('span', { text: t.posten.map((x) => x.name).join(' + ') }),
    el('span', { klasse: 'verlauf-wer', text: (personVon(t.person)?.name || '') + (t.status !== 'gebucht' && t.status !== 'erschienen' ? ' · ' + (abgesagt(t.status) ? 'abgesagt' : 'nicht erschienen') : '') }),
    el('span', { klasse: 'zahl', text: preisText(t.preis_cent, t.preis_ab) })));
  if (kommend.length) teile.push(el('section', {}, el('h3', { klasse: 'form-titel', text: 'Kommend' }), el('ul', { klasse: 'verlauf-liste' }, kommend.map(zeile))));
  teile.push(el('section', {}, el('h3', { klasse: 'form-titel', text: 'Bisher' }),
    vergangen.length ? el('ul', { klasse: 'verlauf-liste' }, vergangen.map(zeile)) : el('p', { klasse: 'leer', text: 'Noch keine Termine.' })));

  const naechste = letzter || k.termine[0];
  teile.push(el('div', { klasse: 'tafel-wege' },
    el('button', { type: 'button', klasse: 'knopf', onclick: () => terminNeu({
      salon: naechste?.salon || Z.salon, datum: faellig && faellig > heute() ? faellig : heute(), kunde: k,
      person: naechste?.person || null, leistungen: naechste ? naechste.posten.map((x) => x.leistung).filter(Boolean) : [],
    }) }, svg(ZEICHEN.kalender), el('span', { text: 'Termin' })),
    el('button', { type: 'button', klasse: 'knopf-still', onclick: () => kundeBearbeiten(k) }, svg(ZEICHEN.stift), el('span', { text: 'Bearbeiten' })),
    el('button', { type: 'button', klasse: 'knopf-still', text: 'Warteliste', onclick: () => eintragNeu({ kunde_id: k.id, name, telefon: k.telefon_text, salon: naechste?.salon,
      leistung: naechste?.posten[0]?.leistung }) }),
    k.nachrichten_n ? el('button', { type: 'button', klasse: 'knopf-still', text: `Nachrichten (${k.nachrichten_n})`, onclick: () => nachrichtenZeigen(k) }) : null,
    inhaberin() ? el('button', { type: 'button', klasse: 'knopf-still', text: 'Auskunft (DSGVO)', onclick: async () => {
      const r = await api('kunde_auskunft', { get: { id: k.id } });
      speichern(`auskunft-${(k.nachname || k.vorname || 'kunde').toLowerCase()}-${heute()}.json`, JSON.stringify(r, null, 2));
    } }) : null,
    inhaberin() ? el('button', { type: 'button', klasse: 'knopf-still knopf-leise', text: 'Löschen', onclick: async () => {
      if (!await fragen({ titel: `${name} löschen?`, text: 'Name, Nummer, E-Mail und Notizen werden unwiderruflich entfernt. Die Termine bleiben ohne Namen für die Buchhaltung stehen.', ja: 'Endgültig löschen', gefahr: true })) return;
      await api('kunde_loeschen', { post: { id: k.id } });
      meldung('Gelöscht', 'ok'); tafelZu(); neuLaden();
    } }) : null));
  koerper.replaceChildren(...teile);
}

/* ── Anlegen und Bearbeiten ─────────────────────────────────────────── */
function kundeBearbeiten(k) {
  const koerper = tafelAuf({ titel: k ? 'Kundin bearbeiten' : 'Neue Kundin' });
  const f = { vorname: k?.vorname || '', nachname: k?.nachname || '', telefon: k?.telefon_text || '', email: k?.email || '', notiz: k?.notiz || '' };
  const feld = (name, text, attr = {}) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }),
    el(attr.mehrzeilig ? 'textarea' : 'input', { value: f[name], name, oninput: (e) => { f[name] = e.target.value; }, ...attr, mehrzeilig: null }));
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  const sichern = async (trotzdem = false) => {
    fehler.hidden = true;
    try {
      const r = await api('kunde_speichern', { post: { id: k?.id, ...f, trotzdem } });
      meldung('Gespeichert', 'ok');
      neuLaden();
      kundeZeigen(r.id);
    } catch (e) {
      if (e.daten.code === 'doppelt') {
        const ok = await fragen({ titel: 'Nummer schon vergeben', text: e.message + ' Trotzdem eine eigene Karte anlegen (z. B. für ein Kind)?', ja: 'Eigene Karte', nein: 'Zur vorhandenen' });
        if (ok) return sichern(true);
        return kundeZeigen(e.daten.kunde);
      }
      fehler.textContent = e.message; fehler.hidden = false;
      koerper.querySelector(`[name="${e.daten.feld}"]`)?.focus();
    }
  };
  koerper.replaceChildren(
    el('div', { klasse: 'feld-reihe' }, feld('vorname', 'Vorname', { autocomplete: 'off' }), feld('nachname', 'Nachname', { autocomplete: 'off' })),
    el('div', { klasse: 'feld-reihe' }, feld('telefon', 'Handy', { type: 'tel', inputmode: 'tel', autocomplete: 'off' }), feld('email', 'E-Mail', { type: 'email', inputmode: 'email', autocomplete: 'off' })),
    feld('notiz', 'Kartei (Farbrezept, Vorlieben, Allergien)', { mehrzeilig: true, rows: 5 }),
    fehler,
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Abbrechen', onclick: () => (k ? kundeZeigen(k.id) : tafelZu()) }),
      el('button', { type: 'button', klasse: 'knopf', text: 'Speichern', onclick: () => sichern() })));
  koerper.querySelector('input').focus();
}

/* ── Treue, Einwilligungen, Fotos ───────────────────────────────────── */
function treueTeil(k) {
  const t = k.treue;
  return el('div', { klasse: 'k-treue' },
    el('span', { klasse: 'klein-titel', text: 'Treuekarte' }),
    el('span', { klasse: 'treue-stempel', 'aria-label': `${t.stempel} von ${t.n} Stempeln` }, Array.from({ length: t.n }, (_, i) => el('i', { klasse: i < t.stempel ? 'ist-voll' : '' }))),
    t.offen ? el('button', { type: 'button', klasse: 'knopf', text: 'Prämie einlösen', onclick: async () => {
      if (!await fragen({ titel: 'Prämie einlösen?', text: t.praemie, ja: 'Einlösen' })) return;
      await api('treue_einloesen', { post: { kunde_id: k.id } }); meldung('Prämie eingelöst', 'ok'); kundeZeigen(k.id);
    } }) : el('span', { klasse: 'seiten-info', text: `noch ${t.n - t.stempel} bis: ${t.praemie}` }));
}

const EW_NAME = { terminnachrichten: 'Erinnerung per SMS', recall: 'Recall', angebote: 'Angebote' };
const QUELLE = { online: 'online', online_danach: 'online nach dem Buchen', studio: 'im Salon', link: 'über den Link', sms_stop: 'per STOP' };
function einwilligungTeil(k) {
  const ew = k.einwilligungen || {};
  const box = el('div', { klasse: 'k-ew' }, el('span', { klasse: 'klein-titel', text: 'Nachrichten' }));
  for (const [art, name] of Object.entries(EW_NAME)) {
    const e = ew[art];
    const an = !!e?.erteilt;
    box.append(el('div', { klasse: 'k-ew-zeile' },
      el('span', { klasse: 'k-ew-name' }, el('span', { klasse: 'punkt' + (an ? ' ist-an' : ''), 'aria-hidden': 'true' }), name),
      el('span', { klasse: 'k-ew-stand', text: an ? `ja seit ${tagText(e.zeit.slice(0, 10), 'zahl')} (${QUELLE[e.quelle] || (String(e.quelle).startsWith('bestaetigt') ? 'bestätigt' : e.quelle)})` : e?.wartet ? 'wartet auf Bestätigung' : e ? `nein seit ${tagText(e.zeit.slice(0, 10), 'zahl')}` : 'nicht gefragt' }),
      el('button', { type: 'button', klasse: 'text-link', text: an ? 'zurücknehmen' : 'Kundin sagt Ja', onclick: async () => {
        if (!an && !await fragen({ titel: `${name}: Kundin sagt Ja`, text: 'Bitte der Kundin diesen Wortlaut vorlesen oder zeigen — so wird er mit Datum und Ihrem Namen gespeichert:', liste: [k.texte?.[art] || ''], ja: 'Sie stimmt zu' })) return;
        await api('einwilligung_studio', { post: { kunde_id: k.id, art, erteilt: !an } });
        meldung('Gespeichert', 'ok'); kundeZeigen(k.id);
      } })));
  }
  if (k.telefon) {
    box.append(el('div', { klasse: 'k-ew-zeile' },
      el('span', { klasse: 'k-ew-name', text: 'SMS an diese Nummer' }),
      el('span', { klasse: 'k-ew-stand', text: k.gesperrt?.sms ? 'abgemeldet (STOP)' : 'erlaubt' }),
      el('button', { type: 'button', klasse: 'text-link', text: k.gesperrt?.sms ? 'wieder erlauben' : 'STOP eintragen', onclick: async () => {
        if (!k.gesperrt?.sms && !await fragen({ titel: 'STOP eintragen?', text: 'Die Nummer bekommt danach keine SMS mehr, und alle Einwilligungen zu Nachrichten werden zurückgenommen.', ja: 'STOP eintragen' })) return;
        await api('sperre_studio', { post: { kunde_id: k.id, kanal: 'sms', gesperrt: !k.gesperrt?.sms } });
        meldung('Gespeichert', 'ok'); kundeZeigen(k.id);
      } })));
  }
  return box;
}

/** Fotos: im Browser verkleinert (lange Seite 1600 px) und als JPEG neu
    gespeichert — damit sind auch Ort und Kamera aus den Bilddaten weg. */
function fotoTeil(k) {
  const datei = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!await fragen({ titel: 'Foto in die Kartei?', text: 'Ist die Kundin einverstanden, dass das Foto in ihrer Kartei gespeichert wird? Sie kann es jederzeit löschen lassen.', ja: 'Ja, einverstanden' })) return;
    try {
      const bild = await verkleinern(f, 1600);
      await api('foto_hochladen', { post: { kunde_id: k.id, bild, einverstanden: true, termin_id: k.termine.find((t) => t.start.slice(0, 10) === heute())?.id || null } });
      meldung('Foto gespeichert', 'ok'); kundeZeigen(k.id);
    } catch (x) { meldung(x.message, 'fehler'); }
  } });
  return el('div', { klasse: 'k-fotos' },
    el('span', { klasse: 'klein-titel', text: 'Fotos' }),
    el('div', { klasse: 'k-foto-reihe' },
      (k.fotos || []).map((f) => el('button', { type: 'button', klasse: 'k-foto', 'aria-label': `Foto vom ${tagText(f.erstellt, 'zahl')}${f.notiz ? ': ' + f.notiz : ''}`, onclick: () => fotoZeigen(k, f) },
        el('img', { src: apiAdresse('foto', { id: f.id }), alt: '', loading: 'lazy', width: f.breite, height: f.hoehe }))),
      el('button', { type: 'button', klasse: 'k-foto k-foto-neu', onclick: () => datei.click() }, svg(ZEICHEN.plus), el('span', { text: 'Foto' }))),
    datei);
}
function verkleinern(datei, lang) {
  return new Promise((fertig, fehler) => {
    const bild = new Image();
    bild.onload = () => {
      const f = Math.min(1, lang / Math.max(bild.naturalWidth, bild.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(bild.naturalWidth * f); c.height = Math.round(bild.naturalHeight * f);
      c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
      URL.revokeObjectURL(bild.src);
      fertig(c.toDataURL('image/jpeg', 0.85));
    };
    bild.onerror = () => fehler(new Error('Das Bild lässt sich nicht lesen.'));
    bild.src = URL.createObjectURL(datei);
  });
}
function fotoZeigen(k, f) {
  const koerper = tafelAuf({ titel: `Foto vom ${tagText(f.erstellt, 'zahl')}`, unter: [k.vorname, k.nachname].filter(Boolean).join(' '), breit: true, schliessen: () => kundeZeigen(k.id) });
  fuellen(koerper, 
    el('img', { klasse: 'k-foto-gross', src: apiAdresse('foto', { id: f.id }), alt: f.notiz || 'Foto aus der Kartei', width: f.breite, height: f.hoehe }),
    f.notiz ? el('p', { klasse: 'seiten-info', text: f.notiz }) : null,
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Zurück zur Kundin', onclick: () => kundeZeigen(k.id) }),
      el('button', { type: 'button', klasse: 'knopf-still knopf-leise', text: 'Foto löschen', onclick: async () => {
        if (!await fragen({ titel: 'Foto löschen?', text: 'Das Foto wird endgültig entfernt.', ja: 'Löschen', gefahr: true })) return;
        await api('foto_loeschen', { post: { id: f.id } }); meldung('Gelöscht', 'ok'); kundeZeigen(k.id);
      } })));
}
async function nachrichtenZeigen(k) {
  const koerper = tafelAuf({ titel: 'Nachrichten', unter: [k.vorname, k.nachname].filter(Boolean).join(' ') });
  const r = await api('nachrichten_liste', { get: { kunde_id: k.id } });
  fuellen(koerper, el('ul', { klasse: 'verlauf-liste n-liste' }, r.nachrichten.map(nachrichtZeile)),
    el('div', { klasse: 'tafel-wege' }, el('button', { type: 'button', klasse: 'knopf-still', text: 'Zurück zur Kundin', onclick: () => kundeZeigen(k.id) })));
}

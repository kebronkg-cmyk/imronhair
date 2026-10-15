/* Kleine Hilfen: Elemente bauen, Zahlen und Zeiten schreiben, Meldungen. */

export const $ = (id) => document.getElementById(id);

/** Element bauen. Text immer über textContent — nie HTML aus Daten. */
export function el(tag, attr, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') e.textContent = v;
    else if (k === 'klasse') e.className = v;
    else if (k === 'stil') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv; }
    else if (k === 'daten') for (const [dk, dv] of Object.entries(v)) e.dataset[dk] = dv;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinder.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}

/** replaceChildren, das null und false überspringt (wie el()). */
export const fuellen = (ziel, ...kinder) => ziel.replaceChildren(...kinder.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));

export const svg = (pfad, klasse = 'zeichen') => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 20 20');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', klasse);
  s.innerHTML = pfad; // nur feste Pfade aus dem Code, nie Daten
  return s;
};
export const ZEICHEN = {
  plus: '<path d="M10 4v12M4 10h12"/>',
  links: '<path d="M12.5 4.5L7 10l5.5 5.5"/>',
  rechts: '<path d="M7.5 4.5L13 10l-5.5 5.5"/>',
  zu: '<path d="M5 5l10 10M15 5L5 15"/>',
  haken: '<path d="M4.5 10.5l3.5 3.5 7.5-8"/>',
  tel: '<path d="M5 3h3l1.5 4-2 1.2a9 9 0 004.3 4.3L13 10.5l4 1.5v3a2 2 0 01-2 2A13 13 0 013 5a2 2 0 012-2z"/>',
  post: '<rect x="3" y="5" width="14" height="10" rx="1.5"/><path d="M3.5 6l6.5 5 6.5-5"/>',
  nachricht: '<path d="M4 15.5l1-3A6.5 6.5 0 1110 16.5a6.6 6.6 0 01-3-.7z"/>',
  uhr: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/>',
  stift: '<path d="M4 16l1-4 8-8 3 3-8 8zM11.5 5.5l3 3"/>',
  kalender: '<rect x="3" y="4.5" width="14" height="12" rx="1.5"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
  auge: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
  augeZu: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/><path d="M3.5 3.5l13 13"/>',
};

/* ── Geld, Dauer ─────────────────────────────────────────────────────── */
export const euro = (c) => (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100).replace(/\B(?=(\d{3})+(?!\d))/g, '.')) + ' €';
export const preisText = (cent, ab, text) => cent === null || cent === undefined ? (text || 'nach Beratung') : (ab ? 'ab ' : '') + euro(cent);
export function dauerText(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h && m ? `${h}:${String(m).padStart(2, '0')} Std.` : h ? `${h} Std.` : `${m} Min.`;
}
export const summePhasen = (ph) => ph.reduce((s, p) => s + p[1], 0);

/* ── Datum und Zeit (Ortszeit, als Text „YYYY-MM-DD“ und „HH:MM“) ──── */
export const TAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const TAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONAT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
export const MONAT_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const alsDatum = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const plusTage = (s, n) => { const d = alsDatum(s); d.setDate(d.getDate() + n); return iso(d); };
export const heute = () => iso(new Date());
export const minuten = (t) => +t.slice(-5, -3) * 60 + +t.slice(-2);
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const wochentag = (s) => alsDatum(s).getDay() || 7;  // 1 = Montag … 7 = Sonntag
export const montag = (s) => plusTage(s, 1 - wochentag(s));
export const jetztMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export function tagText(s, art = 'kurz') {
  const d = alsDatum(s);
  const h = heute();
  const rel = s === h ? 'Heute' : s === plusTage(h, 1) ? 'Morgen' : s === plusTage(h, -1) ? 'Gestern' : null;
  if (art === 'lang') return `${rel ? rel + ', ' : TAG_LANG[d.getDay()] + ', '}${d.getDate()}. ${MONAT_LANG[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
  if (art === 'zahl') return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  return rel || `${TAG[d.getDay()]}, ${d.getDate()}. ${MONAT[d.getMonth()]}`;
}
export const tageZwischen = (a, b) => Math.round((alsDatum(b) - alsDatum(a)) / 86400000);

/* ── Namen ──────────────────────────────────────────────────────────── */
export function kundenName(t) {
  const k = t.kunde;
  if (k && !k.geloescht) return [k.vorname, k.nachname].filter(Boolean).join(' ') || k.telefon_text || 'Ohne Namen';
  if (k && k.geloescht) return 'Gelöschte Kundin';
  return t.gast_name || 'Ohne Namen';
}
export const initialen = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Links zum Anrufen und Schreiben. WhatsApp braucht die Nummer ohne +. */
export const telLink = (e164) => 'tel:' + e164;
export const waLink = (e164, text) => `https://wa.me/${e164.replace(/\D/g, '')}${text ? '?text=' + encodeURIComponent(text) : ''}`;

/* ── Meldungen unten ────────────────────────────────────────────────── */
export function meldung(text, art = 'info', aktion) {
  const box = $('meldungen');
  const m = el('div', { klasse: `meldung ist-${art}`, role: art === 'fehler' ? 'alert' : 'status' },
    el('span', { text }),
    aktion ? el('button', { type: 'button', klasse: 'meldung-aktion', text: aktion.text, onclick: () => { aktion.tun(); weg(); } }) : null);
  box.append(m);
  const weg = () => { m.classList.add('geht'); setTimeout(() => m.remove(), 300); };
  setTimeout(weg, art === 'fehler' ? 8000 : aktion ? 7000 : 3500);
}

/** Rückfrage als Dialog. Gibt true/false zurück. */
export function fragen({ titel, text, liste = [], ja = 'OK', nein = 'Abbrechen', gefahr = false }) {
  const d = $('frage');
  return new Promise((fertig) => {
    d.replaceChildren(el('form', { method: 'dialog', klasse: 'frage-form' },
      el('h2', { klasse: 'frage-titel', text: titel }),
      text ? el('p', { klasse: 'frage-text', text }) : null,
      liste.length ? el('ul', { klasse: 'frage-liste' }, liste.map((x) => el('li', { text: x }))) : null,
      el('div', { klasse: 'frage-wege' },
        el('button', { klasse: 'knopf-still', value: 'nein', text: nein }),
        el('button', { klasse: gefahr ? 'knopf knopf-gefahr' : 'knopf', value: 'ja', text: ja }))));
    d.onclose = () => fertig(d.returnValue === 'ja');
    d.returnValue = '';
    d.showModal();
    d.querySelector('[value="ja"]').focus();
  });
}

/* ── Darstellung: Dunkel, Off-White oder wie das Gerät ─────────────── */
const THEMA = 'studio-thema';
const geraetHell = matchMedia('(prefers-color-scheme: light)');
export function themaWahl() {
  try { return localStorage.getItem(THEMA) || 'dunkel'; } catch (e) { return 'dunkel'; }
}
export function themaAnwenden() {
  const w = themaWahl();
  const hell = w === 'hell' || (w === 'auto' && geraetHell.matches);
  document.documentElement.dataset.thema = hell ? 'hell' : 'dunkel';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hell ? '#f6f2ec' : '#0d0907');
}
export function themaSetzen(w) {
  try { localStorage.setItem(THEMA, w); } catch (e) { /* privat: gilt nur bis zum Neuladen */ }
  themaAnwenden();
}
geraetHell.addEventListener('change', themaAnwenden);

/** Abgesagt — von wem auch immer. */
export const abgesagt = (status) => String(status).startsWith('storniert');

/**
 * Absage aus dem Studio: Wer sagt ab? Sagt der Salon ab, braucht es einen
 * Grund — die Kundin bekommt ihn mitgeteilt. Gibt {status, grund} oder null.
 */
export function absageFragen({ titel, text }) {
  const d = $('frage');
  return new Promise((fertig) => {
    let wer = 'storniert_kunde';
    const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true, text: 'Bitte einen Grund angeben.' });
    const grund = el('input', { type: 'text', maxlength: 255, placeholder: 'z. B. Krankheit, Notfall im Salon', autocomplete: 'off', oninput: () => { fehler.hidden = true; } });
    const grundFeld = el('label', { klasse: 'feld', hidden: true }, el('span', { klasse: 'feld-name', text: 'Grund (geht an die Kundin)' }), grund);
    const wahl = (id, name) => el('button', { type: 'button', 'aria-pressed': String(wer === id), text: name, onclick: (e) => {
      wer = id;
      for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
      grundFeld.hidden = id !== 'storniert_salon';
      if (!grundFeld.hidden) grund.focus();
    } });
    const form = el('form', { method: 'dialog', klasse: 'frage-form' },
      el('h2', { klasse: 'frage-titel', text: titel }),
      text ? el('p', { klasse: 'frage-text', text }) : null,
      el('div', { klasse: 'schalter', role: 'group', 'aria-label': 'Wer sagt ab?' },
        wahl('storniert_kunde', 'Kundin sagt ab'), wahl('storniert_salon', 'Salon sagt ab')),
      grundFeld, fehler,
      el('div', { klasse: 'frage-wege' },
        el('button', { klasse: 'knopf-still', value: 'nein', text: 'Behalten' }),
        el('button', { klasse: 'knopf knopf-gefahr', value: 'ja', text: 'Absagen' })));
    form.addEventListener('submit', (e) => {
      if (e.submitter?.value === 'ja' && wer === 'storniert_salon' && !grund.value.trim()) { e.preventDefault(); fehler.hidden = false; grund.focus(); }
    });
    d.replaceChildren(form);
    d.onclose = () => fertig(d.returnValue === 'ja' ? { status: wer, grund: grund.value.trim() || null } : null);
    d.returnValue = '';
    d.showModal();
  });
}

/** Ein Auge neben jedes Passwortfeld: antippen zeigt das Passwort. */
export function augen(bereich) {
  for (const feld of bereich.querySelectorAll('input[type="password"]')) {
    if (feld.parentElement.classList.contains('passwort-rahmen')) continue;
    const rahmen = el('span', { klasse: 'passwort-rahmen' });
    feld.replaceWith(rahmen);
    const knopf = el('button', { type: 'button', klasse: 'passwort-auge', 'aria-label': 'Passwort zeigen', 'aria-pressed': 'false' }, svg(ZEICHEN.auge));
    knopf.addEventListener('click', () => {
      const zeigen = feld.type === 'password';
      feld.type = zeigen ? 'text' : 'password';
      knopf.setAttribute('aria-pressed', String(zeigen));
      knopf.setAttribute('aria-label', zeigen ? 'Passwort verbergen' : 'Passwort zeigen');
      knopf.replaceChildren(svg(zeigen ? ZEICHEN.augeZu : ZEICHEN.auge));
      feld.focus();
    });
    rahmen.append(feld, knopf);
  }
}

/** Wartet kurz, bevor eine Funktion läuft (Eingabe beim Tippen). */
export function spaeter(f, ms = 180) {
  let uhr;
  return (...a) => { clearTimeout(uhr); uhr = setTimeout(() => f(...a), ms); };
}

/** Datei im Browser speichern. */
export function speichern(name, inhalt, typ = 'application/json') {
  const a = el('a', { href: URL.createObjectURL(new Blob([inhalt], { type: typ })), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const sucheNorm = (s) => s.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

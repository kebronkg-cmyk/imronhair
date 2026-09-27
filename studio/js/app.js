/* ═══════════════════════════════════════════════════════════════════════
   Irmonhair Studio — Start, Anmeldung, Bereiche, Abgleich

   Bereiche über die Adresse (#kalender, #kunden, …), damit Zurück im
   Browser und Lesezeichen funktionieren. Alle 20 Sekunden fragt das
   Studio den Änderungszähler ab; hat jemand anderes etwas geändert, lädt
   der aktuelle Bereich still nach.
   ═══════════════════════════════════════════════════════════════════════ */

import { $, el, meldung, heute } from './hilfen.js';
import { Z, api, inhaberin, ApiFehler } from './api.js';
import { tafelZu, tafelOffen } from './tafel.js';
import * as kalender from './kalender.js';
import * as kunden from './kunden.js';
import * as verwaltung from './verwaltung.js';

const BEREICHE = [
  { id: 'kalender', name: 'Kalender', modul: kalender },
  { id: 'kunden', name: 'Kunden', modul: kunden },
  { id: 'team', name: 'Team', modul: verwaltung.team, inhaberin: true },
  { id: 'leistungen', name: 'Leistungen', kurz: 'Leistung', modul: verwaltung.leistungen, inhaberin: true },
  { id: 'auswertung', name: 'Auswertung', kurz: 'Zahlen', modul: verwaltung.auswertung, inhaberin: true },
  { id: 'einstellungen', name: 'Einstellungen', kurz: 'Optionen', modul: verwaltung.einstellungen },
];
let aktiv = null;

/* ── Start ──────────────────────────────────────────────────────────── */
async function start() {
  Z.beiAbmeldung = () => { if (!$('app').hidden) torZeigen('anmelden', 'Die Sitzung ist abgelaufen. Bitte neu anmelden.'); };
  let s;
  try {
    s = await api('studio_status');
  } catch (e) {
    $('start-text').textContent = e.status === 503 && e.daten.code === 'nicht_eingerichtet'
      ? 'Der Server ist noch nicht eingerichtet: api/config.php fehlt (siehe BUCHUNG.md).'
      : e.message;
    return;
  }
  $('start').hidden = true;
  if (!s.eingerichtet) return torZeigen('einrichten', '', s.personen);
  if (!s.angemeldet) return torZeigen('anmelden');
  angemeldet(s);
}

function angemeldet(s) {
  Z.ich = s.angemeldet;
  Z.csrf = s.csrf;
  Z.s = s.stammdaten;
  Z.stand = s.stammdaten.stand;
  const gemerkt = (() => { try { return localStorage.getItem('studio-salon'); } catch (e) { return null; } })();
  Z.salon = Z.s.salons.some((x) => x.id === gemerkt) ? gemerkt : Z.s.salons[0].id;
  Z.datum = heute();
  Z.ansicht = matchMedia('(max-width: 47.99rem)').matches ? 'liste' : 'tag';
  $('tor').hidden = true;
  $('app').hidden = false;
  kopfZeichnen();
  bereichZeigen();
  abgleichStarten();
}

/* ── Anmeldung / Einrichtung ────────────────────────────────────────── */
function feld(name, beschriftung, attr = {}) {
  return el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: beschriftung }),
    el('input', { name, id: 'tor-' + name, ...attr }));
}

function torZeigen(art, hinweis = '', personen = []) {
  tafelZu();
  $('app').hidden = true;
  $('start').hidden = true;
  $('tor').hidden = false;
  const felder = $('tor-felder');
  const einrichten = art === 'einrichten';
  $('tor-titel').textContent = einrichten ? 'Einrichten' : 'Anmelden';
  $('tor-text').textContent = hinweis || (einrichten
    ? 'Einmalig: Wer führt den Salon? Diese Person bekommt alle Rechte und legt danach die Zugänge fürs Team an.'
    : '');
  $('tor-knopf').textContent = einrichten ? 'Einrichten und anmelden' : 'Anmelden';
  if (einrichten) {
    felder.replaceChildren(
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Inhaberin' }),
        el('select', { name: 'person', id: 'tor-person' }, personen.map((p) => el('option', { value: p.id, text: p.name })))),
      feld('anmeldename', 'Anmeldename', { autocomplete: 'username', required: true, placeholder: 'z. B. bedia' }),
      feld('passwort', 'Passwort (mindestens 10 Zeichen)', { type: 'password', autocomplete: 'new-password', required: true, minlength: 10 }),
      feld('schluessel', 'Einrichtungsschlüssel aus api/config.php', { autocomplete: 'off', required: true, spellcheck: 'false' }));
  } else {
    felder.replaceChildren(
      feld('anmeldename', 'Name', { autocomplete: 'username', required: true, autocapitalize: 'none' }),
      feld('passwort', 'Passwort', { type: 'password', autocomplete: 'current-password', required: true }),
      el('label', { klasse: 'merken' }, el('input', { type: 'checkbox', id: 'tor-merken', checked: true }), el('span', { text: 'Auf diesem Gerät angemeldet bleiben (30 Tage)' })));
  }
  $('tor-fehler').hidden = true;
  $('tor-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData($('tor-form'));
    const knopf = $('tor-knopf');
    knopf.disabled = true;
    try {
      if (einrichten) {
        await api('einrichten', { post: { person: f.get('person'), anmeldename: f.get('anmeldename'), passwort: f.get('passwort'), schluessel: f.get('schluessel').trim() } });
      } else {
        await api('anmelden', { post: { anmeldename: f.get('anmeldename'), passwort: f.get('passwort'), merken: $('tor-merken').checked } });
      }
      const s = await api('studio_status');
      angemeldet(s);
    } catch (err) {
      $('tor-fehler').textContent = err.message;
      $('tor-fehler').hidden = false;
      const falsch = err.daten.feld && $('tor-' + err.daten.feld);
      (falsch || $('tor-passwort')).focus();
    } finally {
      knopf.disabled = false;
    }
  };
  requestAnimationFrame(() => $('tor-form').querySelector('input:not([type=checkbox])')?.focus());
}

/* ── Kopf und Bereiche ──────────────────────────────────────────────── */
function kopfZeichnen() {
  $('bereiche').replaceChildren(...BEREICHE.filter((b) => !b.inhaberin || inhaberin()).map((b) =>
    el('a', { href: '#' + b.id, klasse: 'bereich', daten: { bereich: b.id } },
      el('span', { klasse: 'bereich-lang', text: b.name }), b.kurz ? el('span', { klasse: 'bereich-kurz', text: b.kurz, 'aria-hidden': 'true' }) : null)));
  const ich = $('ich');
  ich.replaceChildren(el('span', { klasse: 'ich-zeichen', text: Z.ich.name.charAt(0) }), el('span', { klasse: 'ich-name', text: Z.ich.name }));
  const menue = $('ich-menue');
  menue.replaceChildren(
    el('p', { klasse: 'ich-rolle', text: Z.ich.rolle === 'inhaberin' ? 'Inhaberin' : 'Team' }),
    el('button', { type: 'button', role: 'menuitem', text: 'Passwort ändern', onclick: () => { menueZu(); location.hash = '#einstellungen'; } }),
    el('button', { type: 'button', role: 'menuitem', text: 'Online-Buchung ansehen', onclick: () => { menueZu(); open('../fenster/termin.html', '_blank', 'noopener'); } }),
    el('button', { type: 'button', role: 'menuitem', text: 'Abmelden', onclick: abmelden }));
  ich.onclick = () => (menue.hidden ? menueAuf() : menueZu());
  $('suche-knopf').onclick = () => kunden.suchen();
}
function menueAuf() { $('ich-menue').hidden = false; $('ich').setAttribute('aria-expanded', 'true'); $('ich-menue').querySelector('button')?.focus(); }
function menueZu() { $('ich-menue').hidden = true; $('ich').setAttribute('aria-expanded', 'false'); }
document.addEventListener('click', (e) => { if (!e.target.closest('#ich, #ich-menue')) menueZu(); });

async function abmelden() {
  menueZu();
  try { await api('abmelden', { post: {} }); } catch (e) { /* trotzdem */ }
  Z.ich = null;
  torZeigen('anmelden', 'Abgemeldet.');
}

function bereichZeigen() {
  const id = (location.hash.slice(1).split('/')[0]) || 'kalender';
  let b = BEREICHE.find((x) => x.id === id && (!x.inhaberin || inhaberin()));
  if (!b) b = BEREICHE[0];
  for (const a of document.querySelectorAll('.bereich')) a.toggleAttribute('aria-current', a.dataset.bereich === b.id);
  if (aktiv !== b) {
    aktiv?.modul.verlassen?.();
    aktiv = b;
    tafelZu();
    $('flaeche').replaceChildren();
    $('flaeche').dataset.bereich = b.id;
  }
  b.modul.zeigen($('flaeche'), location.hash.slice(1).split('/').slice(1));
}
addEventListener('hashchange', () => { if (Z.ich) bereichZeigen(); });

/* ── Abgleich mit anderen Geräten ───────────────────────────────────── */
let abgleichUhr = null;
function abgleichStarten() {
  clearInterval(abgleichUhr);
  abgleichUhr = setInterval(abgleichen, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') abgleichen(); });
  addEventListener('online', abgleichen);
}
async function abgleichen() {
  if (!Z.ich || document.visibilityState !== 'visible') return;
  try {
    const alt = Z.stand;
    const r = await api('stand');
    if (r.stand > alt) {
      Z.stand = r.stand;
      aktiv?.modul.neuLaden?.();
    }
    document.body.classList.remove('ist-offline');
  } catch (e) {
    if (e instanceof ApiFehler && e.daten.code === 'netz') document.body.classList.add('ist-offline');
  }
}
/* ── Tastatur ───────────────────────────────────────────────────────── */
addEventListener('keydown', (e) => {
  if (!Z.ich || e.metaKey || e.ctrlKey || e.altKey) return;
  const imFeld = e.target.closest('input, textarea, select, [contenteditable]');
  if (e.key === 'Escape') { if (!$('ich-menue').hidden) menueZu(); return; }
  if (imFeld || tafelOffen() || $('frage').open) return;
  if (e.key === '/') { e.preventDefault(); kunden.suchen(); }
  else aktiv?.modul.taste?.(e);
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof ApiFehler) { meldung(e.reason.message, 'fehler'); e.preventDefault(); }
});

start();

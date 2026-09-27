/* Verbindung zur Schnittstelle und gemeinsamer Zustand des Studios. */

const API = new URL(document.querySelector('meta[name="irmonhair-api"]')?.content || '../api/', location.href).href;

export class ApiFehler extends Error {
  constructor(text, status, daten) { super(text); this.status = status; this.daten = daten || {}; }
}

/** Der Zustand, den alle Teile teilen. */
export const Z = {
  ich: null,            // {id, name, rolle}
  csrf: '',
  s: null,              // Stammdaten: salons, personen, leistungen, gruppen, einstellungen
  stand: 0,             // Änderungszähler der Datenbank
  salon: null,
  datum: null,
  ansicht: 'tag',       // tag | woche | liste
  personWoche: null,    // null = noch nicht gewählt, undefined = alle
  beiAbmeldung: null,   // wird von app.js gesetzt
};

export const inhaberin = () => Z.ich?.rolle === 'inhaberin';
export const salonVon = (id) => Z.s.salons.find((s) => s.id === id);
export const personVon = (id) => Z.s.personen.find((p) => p.id === id);
export const leistungVon = (id) => Z.s.leistungen.find((l) => l.id === id);
export const gruppeVon = (id) => Z.s.gruppen.find((g) => g.id === id);

export async function api(aktion, { get, post, roh = false } = {}) {
  const url = new URL(API);
  url.searchParams.set('a', aktion);
  for (const [k, v] of Object.entries(get || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const kopf = {};
  if (post !== undefined) { kopf['Content-Type'] = 'application/json'; kopf['X-CSRF'] = Z.csrf; }
  const steuer = new AbortController();
  const uhr = setTimeout(() => steuer.abort(), 20000);
  let r;
  try {
    r = await fetch(url, { method: post !== undefined ? 'POST' : 'GET', headers: kopf, credentials: 'same-origin', signal: steuer.signal,
      body: post !== undefined ? JSON.stringify(post) : undefined });
  } catch (e) {
    throw new ApiFehler('Keine Verbindung zum Server. Bitte Netz prüfen.', 0, { code: 'netz' });
  } finally { clearTimeout(uhr); }
  if (roh && r.ok) return r;
  let daten;
  try { daten = await r.json(); } catch (e) { throw new ApiFehler('Der Server antwortet nicht wie erwartet (ist PHP eingerichtet?).', r.status, { code: 'unerreichbar' }); }
  if (r.status === 401 && aktion !== 'anmelden' && Z.beiAbmeldung) Z.beiAbmeldung();
  if (!r.ok) throw new ApiFehler(daten.fehler || 'Das hat nicht geklappt.', r.status, daten);
  if (typeof daten.stand === 'number') Z.stand = Math.max(Z.stand, daten.stand);
  return daten;
}

/** Stammdaten neu holen (nach Änderungen an Team, Leistungen, Einstellungen). */
export async function stammdatenLaden() {
  const s = await api('studio_status');
  if (s.stammdaten) { Z.s = s.stammdaten; Z.csrf = s.csrf; }
  return s;
}

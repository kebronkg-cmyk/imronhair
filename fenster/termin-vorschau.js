/* Vorschau der Online-Buchung ohne Server (termin.html?vorschau).
   Liest denselben Katalog wie die Schnittstelle (api/katalog.json) und
   rechnet freie Zeiten mit ausgedachter Auslastung — gleiche Regeln wie
   api/lib/planer.php, aber nichts wird gespeichert oder gebucht.
   Die Auslastung ist je Tag und Person fest ausgewürfelt, damit die
   Vorschau bei jedem Laden gleich aussieht. */
(() => {
  'use strict';
  let katalog = null;
  const gebucht = new Map();   // Token → Termin (nur in diesem Tab)
  const RASTER = 15, VORLAUF = 60, HORIZONT = 90;

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const alsDatum = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const plus = (s, n) => { const d = alsDatum(s); d.setDate(d.getDate() + n); return iso(d); };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  // Kleiner, fester Zufall aus einem Text.
  function wuerfel(text) {
    let h = 2166136261;
    for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }

  /** Ausgedachte Belegung: ein voller Salon am Samstag, ruhiger am Dienstag. */
  function belegt(pid, datum, fenster) {
    const r = wuerfel(pid + datum);
    const wt = alsDatum(datum).getDay();
    const dichte = wt === 6 ? 0.8 : wt === 5 ? 0.65 : 0.45;
    const aus = [];
    for (const [a, b] of fenster) {
      for (let t = a; t < b;) {
        const lang = [30, 45, 60, 75, 90][Math.floor(r() * 5)];
        if (r() < dichte) aus.push([t, Math.min(b, t + lang)]);
        t += lang + (r() < 0.3 ? 15 : 0);
      }
    }
    for (const t of gebucht.values()) {
      if (t.person !== pid || t.status !== 'gebucht' || t.start.slice(0, 10) !== datum) continue;
      let x = +t.start.slice(11, 13) * 60 + +t.start.slice(14, 16);
      for (const [art, m] of t.phasen) { if (art === 'arbeit') aus.push([x, x + m]); x += m; }
    }
    return aus.sort((a, b) => a[0] - b[0]);
  }

  function phasenVon(ids) {
    const aus = [];
    for (const id of ids) {
      for (const [art, m] of katalog.leistungen.find((l) => l.id === id).phasen) {
        if (aus.length && aus.at(-1)[0] === art) aus.at(-1)[1] += m; else aus.push([art, m]);
      }
    }
    while (aus.length && aus.at(-1)[0] === 'pause') aus.pop();
    return aus;
  }

  function frei(salonId, ids, personen, von, bis) {
    const salon = katalog.salons.find((s) => s.id === salonId);
    const phasen = phasenVon(ids);
    const dauer = phasen.reduce((s, p) => s + p[1], 0);
    const abschnitte = []; let x = 0;
    for (const [art, m] of phasen) { if (art === 'arbeit') abschnitte.push([x, x + m]); x += m; }
    const jetzt = new Date(Date.now() + VORLAUF * 60000);
    const fruehTag = iso(jetzt), fruehMin = Math.ceil((jetzt.getHours() * 60 + jetzt.getMinutes()) / RASTER) * RASTER;
    const tage = {};
    for (let d = von; d <= bis; d = plus(d, 1)) {
      const wt = alsDatum(d).getDay() || 7;
      const fenster = salon.oeffnung[wt] || [];
      if (!fenster.length) { tage[d] = { zu: true, zeiten: [] }; continue; }
      const zeiten = new Map();
      for (const pid of personen) {
        const busy = belegt(pid, d, fenster);
        const kandidaten = new Set();
        for (const [a, b] of fenster) for (let t = Math.ceil(a / RASTER) * RASTER; t + dauer <= b; t += RASTER) kandidaten.add(t);
        for (const [, e] of busy) kandidaten.add(e);
        for (const t of kandidaten) {
          if (d < fruehTag || (d === fruehTag && t < fruehMin)) continue;
          if (!fenster.some(([a, b]) => t >= a && t + dauer <= b)) continue;
          if (abschnitte.some(([x0, x1]) => busy.some(([a, b]) => a < t + x1 && b > t + x0))) continue;
          if (!zeiten.has(t)) zeiten.set(t, []);
          zeiten.get(t).push(pid);
        }
      }
      tage[d] = { zu: false, zeiten: [...zeiten.entries()].sort((a, b) => a[0] - b[0]).map(([t, p]) => ({ t: hhmm(t), p })) };
    }
    return tage;
  }

  async function laden() {
    if (katalog) return;
    const r = await fetch('../api/katalog.json');
    const k = await r.json();
    katalog = {
      salons: k.salons, gruppen: k.gruppen,
      personen: k.personen.filter((p) => p.online),
      leistungen: k.leistungen.filter((l) => l.online).map((l) => ({
        ...l, dauer: l.phasen.reduce((s, p) => s + p[1], 0),
        einwirken: l.phasen.reduce((s, p) => s + (p[0] === 'pause' ? p[1] : 0), 0),
        personen: l.personen.filter((p) => k.personen.find((x) => x.id === p)?.online),
      })),
    };
  }

  function oeffentlich(t) {
    const s = katalog.salons.find((x) => x.id === t.salon);
    return { ...t, salon: s, storno_moeglich: t.status === 'gebucht', vergangen: false };
  }

  async function rufe(aktion, { get = {}, post } = {}) {
    await laden();
    await new Promise((r) => setTimeout(r, 180));   // wie über das Netz
    const heute = iso(new Date());
    if (aktion === 'katalog') {
      return { ...katalog, regeln: { raster: RASTER, horizont: HORIZONT, stornofrist: 24, online_aktiv: true, hinweis: '' }, heute };
    }
    const fehler = (text, code, status = 409) => Object.assign(new Error(text), { status, daten: { code } });
    if (aktion === 'frei') {
      const ids = String(get.leistungen).split(',');
      const personen = katalog.personen.filter((p) => ids.every((id) => katalog.leistungen.find((l) => l.id === id).personen.includes(p.id))).map((p) => p.id);
      const letzter = plus(heute, HORIZONT);
      const von = get.von < heute ? heute : get.von;
      const bis = [plus(von, (+get.tage || 14) - 1), letzter].sort()[0];
      const tage = frei(get.salon, ids, personen, von, bis);
      let naechster = null;
      for (const [d, t] of Object.entries(tage)) if (t.zeiten.length) { naechster = { datum: d, ...t.zeiten[0] }; break; }
      return { von, bis, letzter, tage, naechster };
    }
    if (aktion === 'buchen') {
      const ids = post.leistungen;
      const d = post.start.slice(0, 10), t = post.start.slice(11);
      const personen = post.person ? [post.person] : katalog.personen.filter((p) => ids.every((id) => katalog.leistungen.find((l) => l.id === id).personen.includes(p.id))).map((p) => p.id);
      const z = frei(post.salon, ids, personen, d, d)[d]?.zeiten.find((x) => x.t === t);
      if (!z) throw fehler('Diese Uhrzeit wurde gerade vergeben. Bitte wählen Sie eine andere.', 'vergeben');
      if (post.ersetzt && gebucht.has(post.ersetzt)) gebucht.get(post.ersetzt).status = 'storniert';
      const phasen = phasenVon(ids);
      const ende = new Date(alsDatum(d).setHours(0, +t.slice(0, 2) * 60 + +t.slice(3, 5) + phasen.reduce((s, p) => s + p[1], 0)));
      const ls = ids.map((id) => katalog.leistungen.find((l) => l.id === id));
      const cent = ls.reduce((s, l) => s + (l.preis_cent || 0), 0);
      const pid = z.p[0];
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      const termin = {
        id: gebucht.size + 1, token, salon: post.salon, person: pid, person_name: katalog.personen.find((p) => p.id === pid).name,
        start: post.start, ende: `${iso(ende)} ${hhmm(ende.getHours() * 60 + ende.getMinutes())}`, phasen, status: 'gebucht',
        posten: ls.map((l) => ({ leistung: l.id, name: l.name, laenge: l.laenge, dauer: l.dauer, preis_cent: l.preis_cent, preis_ab: l.preis_ab })),
        preis_cent: ls.some((l) => l.preis_cent === null) && !cent ? null : cent, preis_ab: ls.some((l) => l.preis_ab || l.preis_cent === null),
        name: post.name, wunsch_person: !!post.person, kundennotiz: post.notiz,
      };
      gebucht.set(token, termin);
      return oeffentlich(termin);
    }
    if (aktion === 'termin' || aktion === 'stornieren') {
      const tok = (get && get.t) || (post && post.t);
      const t = gebucht.get(tok);
      if (!t) throw fehler('In der Vorschau gibt es diesen Termin nur im selben Tab.', 'unbekannt', 404);
      if (aktion === 'stornieren') t.status = 'storniert';
      return oeffentlich(t);
    }
    throw fehler('Unbekannt', 'unbekannt', 404);
  }

  window.IrmonhairVorschau = { rufe };
})();

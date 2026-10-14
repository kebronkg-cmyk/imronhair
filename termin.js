/* ═══════════════════════════════════════════════════════════════════════
   Irmonhair — Online-Buchung

   Fünf Schritte: Salon, Leistung, Person, Zeit, Angaben. Die Seite denkt
   mit, ohne zu drängen:
   - Salon und Haarlänge aus der Preisliste werden übernommen;
   - zu einer Leistung erscheint höchstens ein passender Zusatz;
   - bei jeder Person steht, wann sie frühestens frei ist — aus derselben
     Abfrage, die auch die Uhrzeiten liefert;
   - „Nächster freier Termin“ und „Wie gewohnt“ als zwei stille Vorschläge;
   - wer sich merken lässt, bucht beim nächsten Mal mit einem Tipp.

   Was hier nie passieren darf (gelernt aus der Kritik an Planity und
   Treatwell): eine Buchung, von der die Kundin nicht weiß, ob sie da ist;
   ein doppelter Termin, weil die Seite hing; ein Umbuchen, das den alten
   Termin still löscht. Deshalb:
   - jede Buchung trägt eine Anfrage-Kennung; wiederholtes Senden ergibt
     genau einen Termin, und bleibt die Antwort aus, fragt die Seite nach
     („angekommen?“), statt die Kundin raten zu lassen;
   - Verschieben ist eine eigene Handlung — der alte Termin wird erst frei,
     wenn der neue sicher gebucht ist; „Neu buchen“ sagt dazu, dass ein
     zusätzlicher Termin entsteht;
   - überall Beginn und Ende, Person und Salon — nie nur eine Startzeit.

   Ohne Schnittstelle (etwa auf GitHub Pages) bleibt die Rückfallebene aus
   dem HTML stehen: Telefon und Planity. Mit ?vorschau läuft die Seite mit
   ausgedachten Terminen, damit man sie ansehen kann, ohne zu buchen.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const VORSCHAU = params.has('vorschau');
  const API = new URL(document.querySelector('meta[name="irmonhair-api"]')?.content || 'api/', location.href).href;

  /* ── Gedächtnis (nur dieses Gerät) ─────────────────────────────────── */
  const lesen = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const schreiben = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat */ } };
  // Salon und Länge schreibt die Preisliste als rohen Text.
  const roh = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const rohSchreiben = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* privat */ } };

  /* ── Hilfen ─────────────────────────────────────────────────────────── */
  function el(tag, attr, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'klasse') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kinder.flat()) if (k !== null && k !== undefined && k !== false) e.append(k);
    return e;
  }
  const euro = (c) => (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €';
  const preisText = (cent, ab, text) => cent === null || cent === undefined ? (text || 'nach Beratung') : (ab ? 'ab ' : '') + euro(cent);
  function dauerText(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return h && m ? `${h} Std. ${m} Min.` : h ? `${h} Std.` : `${m} Min.`;
  }
  const TAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const TAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MONAT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
  const MONAT_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const alsDatum = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plusTage = (s, n) => { const d = alsDatum(s); d.setDate(d.getDate() + n); return iso(d); };
  const minuten = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const bis = (t, dauer) => hhmm(minuten(t) + dauer);
  const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const heute = () => iso(new Date());
  function tagText(s, lang) {
    const d = alsDatum(s);
    const h = heute();
    if (s === h) return 'heute';
    if (s === plusTage(h, 1)) return 'morgen';
    return lang ? `${TAG_LANG[d.getDay()]}, ${d.getDate()}. ${MONAT_LANG[d.getMonth()]}` : `${TAG[d.getDay()]}, ${d.getDate()}. ${MONAT[d.getMonth()]}`;
  }
  const gross = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ansage = (t) => { $('ansage').textContent = ''; setTimeout(() => { $('ansage').textContent = t; }, 30); };
  const vornamen = (ids) => ids.map((id) => person(id)?.name || id);
  function undListe(namen) {
    if (namen.length <= 1) return namen.join('');
    return namen.slice(0, -1).join(', ') + ' oder ' + namen.at(-1);
  }

  /* ── Schnittstelle ──────────────────────────────────────────────────── */
  class ApiFehler extends Error {
    constructor(text, status, daten) { super(text); this.status = status; this.daten = daten || {}; }
  }
  async function api(aktion, { get, post } = {}) {
    if (VORSCHAU) return window.IrmonhairVorschau.rufe(aktion, { get, post });
    const url = new URL(API);
    url.searchParams.set('a', aktion);
    for (const [k, v] of Object.entries(get || {})) if (v !== undefined && v !== null) url.searchParams.set(k, v);
    const steuer = new AbortController();
    const uhr = setTimeout(() => steuer.abort(), 15000);
    let r;
    try {
      r = await fetch(url, {
        method: post ? 'POST' : 'GET', signal: steuer.signal, credentials: 'omit',
        headers: post ? { 'Content-Type': 'application/json' } : {}, body: post ? JSON.stringify(post) : undefined,
      });
    } catch (e) {
      throw new ApiFehler('Keine Verbindung. Bitte prüfen Sie Ihr Netz und versuchen Sie es noch einmal.', 0);
    } finally { clearTimeout(uhr); }
    let daten;
    try { daten = await r.json(); } catch (e) { throw new ApiFehler('Die Buchung ist gerade nicht erreichbar.', r.status || 0, { code: 'unerreichbar' }); }
    if (!r.ok) throw new ApiFehler(daten.fehler || 'Das hat nicht geklappt.', r.status, daten);
    return daten;
  }

  /* ── Zustand ────────────────────────────────────────────────────────── */
  const Z = {
    k: null,              // Katalog
    salon: null,
    gruppe: null,
    gewaehlt: [],         // Leistungs-IDs in Reihenfolge
    offen: null,          // aufgeklappte Familie
    person: 'egal',
    frei: null,           // Antwort von „frei“ (egal wer), wächst mit „weitere Tage“
    tag: null,
    zeit: null,           // {t, p}
    schritt: 'salon',
    ersetzt: null,        // Token beim Verschieben
    ersetztTermin: null,  // der Termin, der verschoben wird (für „vorher → jetzt“)
    eigene: [],           // kommende eigene Termine (nur wenn gemerkt)
    dazuAus: new Set(),   // abgelehnte Zusätze
    ladeNr: 0,
  };
  const SCHRITTE = ['salon', 'leistung', 'person', 'zeit', 'kontakt'];
  const salon = (id) => Z.k.salons.find((s) => s.id === id);
  const person = (id) => Z.k.personen.find((p) => p.id === id);
  const leistung = (id) => Z.k.leistungen.find((l) => l.id === id);
  const gewaehlt = () => Z.gewaehlt.map(leistung).filter(Boolean);

  /** Wer kann alle gewählten Leistungen? */
  function koenner() {
    const ls = gewaehlt();
    if (!ls.length) return [];
    return Z.k.personen.filter((p) => ls.every((l) => l.personen.includes(p.id))).map((p) => p.id);
  }
  function summe() {
    const ls = gewaehlt();
    let cent = 0, ab = false, offen = false, dauer = 0, einwirken = 0;
    for (const l of ls) {
      if (l.preis_cent === null) offen = true; else cent += l.preis_cent;
      if (l.preis_ab) ab = true;
      dauer += l.dauer; einwirken += l.einwirken;
    }
    return { cent, ab: ab || offen, offen: offen && cent === 0, dauer, einwirken, n: ls.length };
  }

  /* ── Schritte: auf- und zuklappen ──────────────────────────────────── */
  const schrittEl = (s) => document.querySelector(`.schritt[data-schritt="${s}"]`);

  function zu(s, rollen = true) {
    Z.schritt = s;
    const i = SCHRITTE.indexOf(s);
    SCHRITTE.forEach((n, j) => {
      const e = schrittEl(n);
      e.classList.toggle('ist-offen', j === i);
      e.classList.toggle('ist-fertig', j < i);
      e.classList.toggle('ist-spaeter', j > i);
      e.querySelector('.schritt-inhalt').hidden = j !== i;
      const knopf = e.querySelector('.schritt-aendern');
      if (knopf) knopf.hidden = !(j < i);
    });
    wahlZeilen();
    if (rollen) {
      const e = schrittEl(s);
      requestAnimationFrame(() => {
        const oben = e.getBoundingClientRect().top;
        // Nur rollen, wenn der Schritt nicht schon gut im Blick ist.
        if (oben < 70 || oben > innerHeight * 0.55) e.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
      });
    }
    beleg();
  }

  function wahlZeilen() {
    const s = Z.salon && salon(Z.salon);
    setzeWahl('salon', s ? s.name : '');
    const ls = gewaehlt();
    setzeWahl('leistung', ls.map((l) => l.name + (l.laenge ? ' · ' + l.laenge : '')).join(' + '));
    setzeWahl('person', Z.person === 'egal' ? 'Wer zuerst frei ist' : (person(Z.person)?.name || ''));
    setzeWahl('zeit', Z.tag && Z.zeit ? `${gross(tagText(Z.tag))}, ${Z.zeit.t}–${bis(Z.zeit.t, summe().dauer)} Uhr` : '');
  }
  function setzeWahl(s, text) {
    const e = schrittEl(s)?.querySelector('.schritt-wahl');
    if (e) e.textContent = SCHRITTE.indexOf(s) < SCHRITTE.indexOf(Z.schritt) ? text : '';
  }

  /* ── 1. Salon ───────────────────────────────────────────────────────── */
  function offenText(s) {
    const d = new Date();
    const wt = d.getDay() === 0 ? 7 : d.getDay();
    const jetzt = d.getHours() * 60 + d.getMinutes();
    const heuteZ = s.oeffnung[wt] || [];
    for (const [a, b] of heuteZ) if (jetzt >= a && jetzt < b) return { offen: true, text: `Geöffnet bis ${hhmm(b)}` };
    for (let i = 0; i < 8; i++) {
      const tag = ((wt - 1 + i) % 7) + 1;
      for (const [a] of s.oeffnung[tag] || []) {
        if (i === 0 && a <= jetzt) continue;
        return { offen: false, text: `Geschlossen · ${i === 0 ? 'heute' : i === 1 ? 'morgen' : TAG_LANG[tag % 7]} ab ${hhmm(a)}` };
      }
    }
    return { offen: false, text: 'Geschlossen' };
  }
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  function salonsZeichnen() {
    const f = document.createDocumentFragment();
    for (const s of Z.k.salons) {
      const o = offenText(s);
      f.append(el('button', {
        type: 'button', klasse: 'salon-wahl', 'aria-pressed': String(Z.salon === s.id),
        onclick: () => salonWaehlen(s.id, true),
      },
        el('span', { klasse: 'salon-wahl-name', text: s.name }),
        el('span', { klasse: 'salon-wahl-ort', text: s.strasse }),
        el('span', { klasse: 'salon-wahl-offen' + (o.offen ? ' ist-auf' : ''), text: o.text })));
    }
    $('salons').replaceChildren(f);
  }

  function salonWaehlen(id, weiter) {
    if (Z.salon !== id) {
      Z.salon = id;
      Z.gewaehlt = [];
      Z.offen = null;
      Z.person = 'egal';
      Z.frei = null; Z.tag = null; Z.zeit = null;
      Z.gruppe = null;
      rohSchreiben('irmonhair-salon', id);
    }
    salonsZeichnen();
    leistungenZeichnen();
    if (weiter) zu('leistung');
  }

  /* ── 2. Leistung ────────────────────────────────────────────────────── */
  function familien(salonId, gruppe, suche) {
    const nach = new Map();
    for (const l of Z.k.leistungen) {
      if (l.salon !== salonId) continue;
      if (gruppe && l.gruppe !== gruppe) continue;
      if (suche) {
        const t = (l.name + ' ' + (l.zusatz || '')).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
        if (!suche.split(/\s+/).every((w) => t.includes(w))) continue;
      }
      if (!nach.has(l.familie)) nach.set(l.familie, []);
      nach.get(l.familie).push(l);
    }
    return [...nach.values()];
  }
  const sucheNorm = (s) => s.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

  /** Passt eine Fassung zur gemerkten Länge? „kurz–mittel“ passt zu beiden. */
  function passtLaenge(l, laenge) {
    if (!laenge || laenge === 'alle' || !l.laenge) return false;
    return l.laenge.split('–').includes(laenge);
  }

  function leistungenZeichnen() {
    if (!Z.salon) return;
    const gruppenMit = Z.k.gruppen.filter((g) => Z.k.leistungen.some((l) => l.salon === Z.salon && l.gruppe === g.id));
    if (!Z.gruppe || !gruppenMit.some((g) => g.id === Z.gruppe)) Z.gruppe = gruppenMit[0]?.id;
    const suche = sucheNorm($('suche').value);
    const gf = document.createDocumentFragment();
    for (const g of gruppenMit) {
      const n = Z.gewaehlt.filter((id) => leistung(id)?.gruppe === g.id).length;
      gf.append(el('button', {
        type: 'button', role: 'tab', klasse: 'gruppe-reiter', 'aria-selected': String(!suche && Z.gruppe === g.id),
        onclick: () => { $('suche').value = ''; Z.gruppe = g.id; Z.offen = null; leistungenZeichnen(); },
      }, g.name, n ? el('span', { klasse: 'gruppe-zahl', text: String(n), 'aria-label': `${n} gewählt` }) : null));
    }
    $('gruppen').replaceChildren(gf);

    const liste = familien(Z.salon, suche ? null : Z.gruppe, suche);
    const laenge = roh('irmonhair-laenge');
    const f = document.createDocumentFragment();
    for (const fam of liste) {
      const erste = fam[0];
      const gewaehlteFassung = fam.find((l) => Z.gewaehlt.includes(l.id));
      const auf = Z.offen === erste.familie || !!gewaehlteFassung;
      const preise = fam.map((l) => l.preis_cent).filter((c) => c !== null);
      const preis = gewaehlteFassung ? preisText(gewaehlteFassung.preis_cent, gewaehlteFassung.preis_ab, gewaehlteFassung.preis_text)
        : preise.length ? (preise.length < fam.length || fam.some((l) => l.preis_ab) || new Set(preise).size > 1 ? 'ab ' : '') + euro(Math.min(...preise))
        : preisText(null, false, erste.preis_text);
      const dauern = [...new Set(fam.map((l) => l.dauer))].sort((a, b) => a - b);
      const dauer = gewaehlteFassung ? dauerText(gewaehlteFassung.dauer) : dauern.length > 1 ? `${dauerText(dauern[0])} – ${dauerText(dauern.at(-1))}` : dauerText(dauern[0]);
      const meta = [erste.zusatz, dauer].filter(Boolean).join(' · ');
      const kopf = el('button', {
        type: 'button', klasse: 'familie-kopf', 'aria-expanded': fam.length > 1 ? String(auf) : null,
        'aria-pressed': fam.length === 1 ? String(!!gewaehlteFassung) : null,
        onclick: () => familieTippen(fam),
      },
        el('span', { klasse: 'familie-marke', 'aria-hidden': 'true' }),
        el('span', { klasse: 'familie-text' },
          el('span', { klasse: 'familie-name', text: erste.name }),
          el('span', { klasse: 'familie-meta', text: meta })),
        el('span', { klasse: 'familie-preis', text: preis }));
      const li = el('li', { klasse: 'familie' + (gewaehlteFassung ? ' ist-gewaehlt' : '') }, kopf);
      if (fam.length > 1 && auf) {
        const chips = el('div', { klasse: 'laengen', role: 'group', 'aria-label': 'Haarlänge' },
          el('span', { klasse: 'laengen-frage', text: fam.every((l) => /kurz|mittel|lang/.test(l.laenge || '')) ? 'Meine Haare sind' : 'Welche?' }));
        for (const l of fam) {
          chips.append(el('button', {
            type: 'button', klasse: 'laenge', 'aria-pressed': String(Z.gewaehlt.includes(l.id)),
            onclick: () => fassungWaehlen(fam, l),
          }, el('span', { text: l.laenge || l.name }), el('small', { text: preisText(l.preis_cent, l.preis_ab, l.preis_text) })));
        }
        // Die gemerkte Länge sanft markieren, solange noch nichts gewählt ist.
        if (!gewaehlteFassung && laenge) {
          const passend = fam.filter((l) => passtLaenge(l, laenge));
          if (passend.length === 1) chips.querySelectorAll('.laenge')[fam.indexOf(passend[0])].classList.add('ist-vermutet');
        }
        li.append(chips);
      }
      f.append(li);
    }
    if (!liste.length) f.append(el('li', { klasse: 'familien-leer', text: suche ? 'Nichts gefunden. Vielleicht unter einem anderen Wort — oder rufen Sie uns an.' : 'Hier gibt es online nichts zu buchen.' }));
    $('familien').replaceChildren(f);
    dazuZeichnen();
    $('leistung-weiter').hidden = !Z.gewaehlt.length;
    const s = summe();
    $('leistung-fertig').textContent = Z.gewaehlt.length ? `Weiter · ${dauerText(s.dauer)}` : 'Weiter';
    nochmalZeichnen();
    beleg();
  }

  function familieTippen(fam) {
    if (fam.length === 1) {
      const l = fam[0];
      if (Z.gewaehlt.includes(l.id)) Z.gewaehlt = Z.gewaehlt.filter((x) => x !== l.id);
      else leistungDazu(l);
      leistungenZeichnen();
      return;
    }
    const gewaehlte = fam.find((l) => Z.gewaehlt.includes(l.id));
    if (gewaehlte) {
      // Aufgeklappt und gewählt: Tippen auf den Kopf nimmt die Wahl zurück.
      Z.gewaehlt = Z.gewaehlt.filter((x) => x !== gewaehlte.id);
      Z.offen = fam[0].familie;
    } else {
      Z.offen = Z.offen === fam[0].familie ? null : fam[0].familie;
      // Gemerkte Länge: gleich wählen, wenn genau eine Fassung passt.
      const laenge = roh('irmonhair-laenge');
      const passend = fam.filter((l) => passtLaenge(l, laenge));
      if (Z.offen && passend.length === 1) leistungDazu(passend[0]);
    }
    leistungenZeichnen();
  }

  function fassungWaehlen(fam, l) {
    const ids = fam.map((x) => x.id);
    const war = Z.gewaehlt.includes(l.id);
    Z.gewaehlt = Z.gewaehlt.filter((x) => !ids.includes(x));
    if (!war) {
      leistungDazu(l);
      const teile = (l.laenge || '').split('–');
      if (teile.length === 1 && ['kurz', 'mittel', 'lang'].includes(teile[0])) rohSchreiben('irmonhair-laenge', teile[0]);
    }
    leistungenZeichnen();
  }

  function leistungDazu(l) {
    // Höchstens sechs; und nur, wenn jemand alles zusammen machen kann.
    const neu = [...Z.gewaehlt, l.id];
    if (neu.length > 6) { ansage('Mehr als sechs Leistungen bitte telefonisch.'); return; }
    const koennen = Z.k.personen.filter((p) => neu.every((id) => leistung(id).personen.includes(p.id)));
    if (!koennen.length) {
      ansage(`${l.name} und die übrige Auswahl macht niemand in einem Termin. Bitte zwei Termine buchen.`);
      zeigeHinweis(`„${l.name}“ lässt sich nicht mit der übrigen Auswahl verbinden — dafür gibt es niemanden in einem Termin. Buchen Sie es bitte als eigenen Termin.`);
      return;
    }
    Z.gewaehlt = neu;
    Z.frei = null; Z.tag = null; Z.zeit = null;
    if (Z.person !== 'egal' && !koennen.some((p) => p.id === Z.person)) Z.person = 'egal';
  }

  /** Ein passender Zusatz aus derselben Gruppe (Heiße Schere zum Schnitt). */
  function dazuZeichnen() {
    const ls = gewaehlt();
    const box = $('dazu');
    const haupt = ls.filter((l) => !l.zusatzleistung);
    const vorschlag = haupt.length && Z.k.leistungen.find((z) => z.zusatzleistung && z.salon === Z.salon
      && haupt.some((h) => h.gruppe === z.gruppe) && !Z.gewaehlt.includes(z.id) && !Z.dazuAus.has(z.id)
      && Z.k.personen.some((p) => [...Z.gewaehlt, z.id].every((id) => leistung(id).personen.includes(p.id))));
    if (!vorschlag) { box.hidden = true; box.replaceChildren(); return; }
    box.hidden = false;
    box.replaceChildren(
      el('span', { klasse: 'dazu-text' }, 'Dazu passt ', el('strong', { text: vorschlag.name }),
        ` · ${vorschlag.zusatz ? vorschlag.zusatz.replace(/^als /, '') + ' · ' : ''}+ ${dauerText(vorschlag.dauer)} · ${preisText(vorschlag.preis_cent, vorschlag.preis_ab)}`),
      el('span', { klasse: 'dazu-wege' },
        el('button', { type: 'button', klasse: 'dazu-ja', text: 'Hinzufügen', onclick: () => { leistungDazu(vorschlag); leistungenZeichnen(); } }),
        el('button', { type: 'button', klasse: 'dazu-nein', text: 'Nein, danke', onclick: () => { Z.dazuAus.add(vorschlag.id); dazuZeichnen(); } })));
  }

  /** Wiederkehrend: die letzte Buchung mit einem Tipp noch einmal. */
  function nochmalZeichnen() {
    const box = $('nochmal');
    const letzte = lesen('irmonhair-letzte');
    const ids = letzte && letzte.salon === Z.salon ? letzte.leistungen.filter((id) => leistung(id)) : [];
    if (!ids.length || Z.gewaehlt.length || Z.ersetzt) { box.hidden = true; return; }
    const namen = ids.map((id) => leistung(id).name + (leistung(id).laenge ? ' · ' + leistung(id).laenge : '')).join(' + ');
    const bei = letzte.person && person(letzte.person) && ids.every((id) => leistung(id).personen.includes(letzte.person)) ? letzte.person : 'egal';
    box.hidden = false;
    box.replaceChildren(el('button', {
      type: 'button', klasse: 'nochmal-knopf',
      onclick: () => {
        Z.gewaehlt = ids.slice(); Z.person = bei; Z.frei = null; Z.tag = null; Z.zeit = null;
        leistungenZeichnen(); personenZeichnen(); zu('zeit'); freiLaden();
      },
    }, el('span', { klasse: 'nochmal-zeile', text: 'Wie beim letzten Mal' }),
      el('span', { klasse: 'nochmal-was', text: namen + (bei !== 'egal' ? ` · bei ${person(bei).name}` : '') })));
  }

  /* ── 3. Person ──────────────────────────────────────────────────────── */
  function erstesFrei(pid) {
    if (!Z.frei) return null;
    for (const [d, tag] of Object.entries(Z.frei.tage)) {
      const z = tag.zeiten.find((x) => pid === 'egal' || x.p.includes(pid));
      if (z) return { datum: d, t: z.t };
    }
    return null;
  }

  function personenZeichnen() {
    const ids = koenner();
    const f = document.createDocumentFragment();
    const karte = (pid, name, zeile) => el('button', {
      type: 'button', klasse: 'person-wahl' + (pid === 'egal' ? ' ist-egal' : ''), 'aria-pressed': String(Z.person === pid),
      onclick: () => { Z.person = pid; Z.tag = null; Z.zeit = null; personenZeichnen(); zu('zeit'); zeitenZeichnen(); if (!Z.frei) freiLaden(); },
    },
      el('span', { klasse: 'person-zeichen', 'aria-hidden': 'true', text: pid === 'egal' ? '' : name.charAt(0) }),
      el('span', { klasse: 'person-name', text: name }),
      el('span', { klasse: 'person-frei', text: zeile }));
    const frei = (pid) => {
      if (!Z.frei) return 'wird geprüft …';
      const e = erstesFrei(pid);
      return e ? `frei ab ${tagText(e.datum)}, ${e.t}` : 'in den nächsten Wochen ausgebucht';
    };
    if (ids.length > 1) f.append(karte('egal', 'Wer zuerst frei ist', frei('egal')));
    for (const id of ids) f.append(karte(id, person(id).name, frei(id)));
    if (ids.length === 1 && Z.person === 'egal') Z.person = ids[0];
    $('personen').replaceChildren(f);
  }

  /* ── 4. Zeit ────────────────────────────────────────────────────────── */
  async function freiLaden(mehr = false) {
    if (!Z.gewaehlt.length) return;
    const nr = ++Z.ladeNr;
    const von = mehr && Z.frei ? plusTage(Z.frei.bis, 1) : heute();
    if (!mehr) { $('zeiten').replaceChildren(el('p', { klasse: 'zeiten-laden', text: 'Freie Zeiten werden gesucht …' })); tageZeichnen(); }
    try {
      const antwort = await api('frei', { get: { salon: Z.salon, leistungen: Z.gewaehlt.join(','), von, tage: 21 } });
      if (nr !== Z.ladeNr) return;
      if (mehr && Z.frei) {
        Object.assign(Z.frei.tage, antwort.tage);
        Z.frei.bis = antwort.bis;
        Z.frei.naechster = Z.frei.naechster || antwort.naechster;
      } else {
        Z.frei = antwort;
      }
      Z.frei.geladen = Date.now();
      personenZeichnen();
      zeitenZeichnen();
    } catch (e) {
      if (nr !== Z.ladeNr) return;
      $('zeiten').replaceChildren(el('p', { klasse: 'zeiten-leer' }, e.message + ' ', el('button', { type: 'button', klasse: 'text-knopf', text: 'Noch einmal', onclick: () => freiLaden(mehr) })));
    }
  }

  /** Zeiten des Tages für die gewählte Person. */
  function zeitenAm(d) {
    const tag = Z.frei?.tage[d];
    if (!tag) return [];
    return Z.person === 'egal' ? tag.zeiten : tag.zeiten.filter((z) => z.p.includes(Z.person));
  }

  function tageZeichnen() {
    const f = document.createDocumentFragment();
    if (!Z.frei) {
      for (let i = 0; i < 14; i++) f.append(el('span', { klasse: 'tag ist-laden', 'aria-hidden': 'true' }, el('span', { klasse: 'tag-name', text: TAG[alsDatum(plusTage(heute(), i)).getDay()] }), el('span', { klasse: 'tag-zahl', text: String(alsDatum(plusTage(heute(), i)).getDate()) })));
      $('tage').replaceChildren(f);
      return;
    }
    let monat = null;
    for (const [d, tag] of Object.entries(Z.frei.tage)) {
      const dt = alsDatum(d);
      const n = zeitenAm(d).length;
      const status = tag.zu ? 'zu' : n ? 'frei' : 'voll';
      // Dichte als bis zu drei Punkte: wenig, einiges, viel frei.
      const punkte = n === 0 ? 0 : n < 6 ? 1 : n < 16 ? 2 : 3;
      const neuerMonat = dt.getMonth() !== monat;
      monat = dt.getMonth();
      f.append(el('button', {
        type: 'button', klasse: `tag ist-${status}` + (neuerMonat ? ' ist-monatsanfang' : ''), 'data-datum': d,
        'aria-pressed': String(Z.tag === d), disabled: status !== 'frei' ? true : null,
        'aria-label': `${tagText(d, true)}: ${status === 'zu' ? 'geschlossen' : status === 'voll' ? 'ausgebucht' : n + ' freie Zeiten'}`,
        onclick: () => { Z.tag = d; Z.zeit = null; tageMarkieren(); zeitenListe(); },
      },
        neuerMonat ? el('span', { klasse: 'tag-monat', text: MONAT[dt.getMonth()] }) : null,
        el('span', { klasse: 'tag-name', text: d === heute() ? 'heute' : TAG[dt.getDay()] }),
        el('span', { klasse: 'tag-zahl', text: String(dt.getDate()) }),
        el('span', { klasse: 'tag-punkte', 'data-n': String(punkte), 'aria-hidden': 'true' }, el('i'), el('i'), el('i'))));
    }
    if (Z.frei.bis < Z.frei.letzter) {
      f.append(el('button', { type: 'button', klasse: 'tag tag-mehr', onclick: (e) => { e.currentTarget.disabled = true; freiLaden(true); } },
        el('span', { klasse: 'tag-name', text: 'weiter' }), el('span', { klasse: 'tag-zahl', text: '→' })));
    }
    $('tage').replaceChildren(f);
  }
  function tageMarkieren() {
    for (const b of $('tage').querySelectorAll('.tag[data-datum]')) b.setAttribute('aria-pressed', String(b.dataset.datum === Z.tag));
    const akt = $('tage').querySelector('[aria-pressed="true"]');
    if (akt) {
      const r = $('tage');
      const links = akt.offsetLeft - r.clientWidth / 2 + akt.clientWidth / 2;
      r.scrollTo({ left: Math.max(0, links), behavior: ruhig ? 'auto' : 'smooth' });
    }
  }

  function zeitenZeichnen() {
    if (!Z.frei) { tageZeichnen(); return; }
    // Ohne gewählten Tag: den ersten mit freier Zeit.
    if (!Z.tag || !zeitenAm(Z.tag).length) Z.tag = Object.keys(Z.frei.tage).find((d) => zeitenAm(d).length) || null;
    tageZeichnen();
    tageMarkieren();
    vorschlaegeZeichnen();
    zeitenListe();
  }

  function zeitenListe() {
    const box = $('zeiten');
    if (!Z.tag) {
      const n = Z.frei?.naechster;
      const pid = Z.person;
      box.replaceChildren(el('p', { klasse: 'zeiten-leer' },
        pid !== 'egal' ? `${person(pid).name} hat in den nächsten drei Wochen nichts mehr frei. ` : 'In den nächsten drei Wochen ist nichts mehr frei. ',
        n && pid === 'egal' ? el('button', { type: 'button', klasse: 'text-knopf', text: `Erst wieder ${tagText(n.datum)} — weiter suchen`, onclick: () => freiLaden(true) }) : null,
        pid !== 'egal' && koenner().length > 1 ? el('button', { type: 'button', klasse: 'text-knopf', text: 'Bei jemand anderem schauen', onclick: () => { Z.person = 'egal'; personenZeichnen(); zeitenZeichnen(); } }) : null));
      return;
    }
    const zeiten = zeitenAm(Z.tag);
    const teile = [['Vormittag', 0, 720], ['Mittag', 720, 900], ['Nachmittag', 900, 1440]];
    const f = document.createDocumentFragment();
    f.append(el('p', { klasse: 'zeiten-tag', text: gross(tagText(Z.tag, true)) }));
    for (const [name, a, b] of teile) {
      const hier = zeiten.filter((z) => minuten(z.t) >= a && minuten(z.t) < b);
      if (!hier.length) continue;
      const reihe = el('div', { klasse: 'zeit-reihe', role: 'group', 'aria-label': name });
      const dauer = summe().dauer;
      for (const z of hier) {
        reihe.append(el('button', {
          type: 'button', klasse: 'zeit', 'aria-pressed': String(Z.zeit?.t === z.t),
          'aria-label': `${z.t} bis ${bis(z.t, dauer)} Uhr`,
          onclick: () => zeitWaehlen(Z.tag, z),
        }, el('span', { text: z.t }), el('small', { klasse: 'zeit-bis', 'aria-hidden': 'true', text: 'bis ' + bis(z.t, dauer) })));
      }
      f.append(el('div', { klasse: 'zeit-gruppe' }, el('span', { klasse: 'zeit-gruppe-name', text: name }), reihe));
    }
    // Hinweis, bei wem es wird, wenn „egal“ und mehrere frei sind.
    if (Z.person === 'egal') f.append(el('p', { klasse: 'zeiten-fuss', text: 'Wir teilen Sie der Person zu, bei der der Tag am besten passt.' }));
    box.replaceChildren(f);
  }

  /** Zwei stille Vorschläge: der nächste freie Termin und — wer schon
      einmal gebucht hat — derselbe Wochentag zur gewohnten Zeit. */
  function vorschlaegeZeichnen() {
    const box = $('vorschlaege');
    const f = document.createDocumentFragment();
    const alle = Object.keys(Z.frei.tage).flatMap((d) => zeitenAm(d).map((z) => ({ d, z })));
    if (alle.length) {
      const erster = alle[0];
      const dauer = summe().dauer;
      f.append(vorschlag('Nächster freier Termin', `${gross(tagText(erster.d))}, ${erster.z.t}–${bis(erster.z.t, dauer)}`, erster.d, erster.z));
      const letzte = lesen('irmonhair-letzte');
      if (letzte && letzte.wochentag !== undefined && letzte.minute !== undefined) {
        const passend = alle.filter(({ d, z }) => alsDatum(d).getDay() === letzte.wochentag && Math.abs(minuten(z.t) - letzte.minute) <= 90)
          .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : Math.abs(minuten(a.z.t) - letzte.minute) - Math.abs(minuten(b.z.t) - letzte.minute)))[0];
        if (passend && !(passend.d === erster.d && passend.z.t === erster.z.t)) {
          const tageszeit = letzte.minute < 720 ? 'vormittags' : letzte.minute < 900 ? 'mittags' : 'nachmittags';
          f.append(vorschlag(`Wie gewohnt: ${TAG_LANG[letzte.wochentag]} ${tageszeit}`, `${gross(tagText(passend.d))}, ${passend.z.t}–${bis(passend.z.t, dauer)}`, passend.d, passend.z));
        }
      }
    }
    box.replaceChildren(f);
  }
  const vorschlag = (zeile, wann, d, z) => el('button', { type: 'button', klasse: 'vorschlag', onclick: () => zeitWaehlen(d, z) },
    el('span', { klasse: 'vorschlag-zeile', text: zeile }), el('span', { klasse: 'vorschlag-wann', text: wann }));

  function zeitWaehlen(d, z) {
    Z.tag = d; Z.zeit = z;
    $('ausweich').hidden = true;
    buchenHinweis();
    tageMarkieren();
    zeitenListe();
    zu('kontakt');
    const erstes = ['k-name', 'k-telefon'].map($).find((i) => !i.value);
    // Die Tastatur am Handy erst öffnen, wenn man ins Feld tippt.
    if (erstes && matchMedia('(pointer: fine)').matches) setTimeout(() => erstes.focus({ preventScroll: true }), 350);
  }

  /* ── Beleg: das Etikett ─────────────────────────────────────────────── */
  function belegInhalt(t) {
    // t: entweder die laufende Wahl (null) oder ein gebuchter Termin
    const s = t ? t.salon : (Z.salon && salon(Z.salon));
    const zeilen = t ? t.posten.map((p) => ({ name: p.name, laenge: p.laenge, preis: preisText(p.preis_cent, p.preis_ab) }))
      : gewaehlt().map((l) => ({ name: l.name, laenge: l.laenge, preis: preisText(l.preis_cent, l.preis_ab, l.preis_text) }));
    const sm = summe();
    const gesamt = t ? preisText(t.preis_cent, t.preis_ab) : (sm.n ? (sm.offen ? 'nach Beratung' : (sm.ab ? 'ab ' : '') + euro(sm.cent)) : '');
    const dauer = t ? minuten(t.ende.slice(11)) - minuten(t.start.slice(11)) : sm.dauer;
    const nachPerson = SCHRITTE.indexOf(Z.schritt) > SCHRITTE.indexOf('person');
    // Bei „egal“ die Namen nennen, die zur gewählten Zeit frei sind — die
    // Bestätigung nennt dann die eine, bei der es wird.
    const wer = t ? t.person_name : !nachPerson ? '' : Z.person === 'egal'
      ? (Z.zeit ? (Z.zeit.p.length === 1 ? person(Z.zeit.p[0]).name : undListe(vornamen(Z.zeit.p))) : 'wer zuerst frei ist')
      : person(Z.person)?.name;
    const wann = t ? `${gross(tagText(t.start.slice(0, 10), true))} · ${t.start.slice(11)}–${t.ende.slice(11)} Uhr`
      : (Z.tag && Z.zeit ? `${gross(tagText(Z.tag, true))} · ${Z.zeit.t}–${bis(Z.zeit.t, sm.dauer)} Uhr` : '');
    const f = document.createDocumentFragment();
    f.append(el('span', { klasse: 'beleg-loch', 'aria-hidden': 'true' }));
    f.append(el('p', { klasse: 'beleg-marke', text: 'Irmonhair' + (s ? ' · ' + s.name : '') }));
    if (!zeilen.length && !t) {
      f.append(el('p', { klasse: 'beleg-leer', text: 'Ihre Wahl erscheint hier.' }));
      return f;
    }
    const ul = el('ul', { klasse: 'beleg-posten' });
    for (const z of zeilen) ul.append(el('li', {}, el('span', {}, z.name, z.laenge ? el('small', { text: ' · ' + z.laenge }) : null), el('span', { klasse: 'beleg-preis', text: z.preis })));
    f.append(ul);
    const dl = el('dl', { klasse: 'beleg-daten' });
    const zeile = (dt, dd) => dd && dl.append(el('div', {}, el('dt', { text: dt }), el('dd', { text: dd })));
    zeile('Bei', wer);
    if (s && (t || nachPerson)) zeile('Wo', `${s.name}, ${s.strasse}`);
    zeile('Wann', wann);
    zeile('Dauer', dauer ? 'ca. ' + dauerText(dauer) + (!t && sm.einwirken ? `, davon ${dauerText(sm.einwirken)} Einwirkzeit` : '') : '');
    f.append(dl);
    f.append(el('p', { klasse: 'beleg-summe' }, el('span', { text: 'Zusammen' }), el('strong', { text: gesamt })));
    return f;
  }

  function beleg() {
    if (!Z.k) return;
    $('beleg').replaceChildren(belegInhalt(null));
    $('etikett-handy').replaceChildren(belegInhalt(null));
    const sm = summe();
    const zeile = $('beleg-zeile');
    const zeigen = sm.n > 0 && Z.schritt !== 'kontakt';
    zeile.hidden = !zeigen;
    document.body.classList.toggle('mit-belegzeile', zeigen);
    if (zeigen) {
      const preis = sm.offen ? 'nach Beratung' : (sm.ab ? 'ab ' : '') + euro(sm.cent);
      const wann = Z.tag && Z.zeit ? ` · ${gross(tagText(Z.tag))} ${Z.zeit.t}–${bis(Z.zeit.t, sm.dauer)}` : '';
      zeile.textContent = `${sm.n === 1 ? gewaehlt()[0].name : sm.n + ' Leistungen'} · ${preis} · ${dauerText(sm.dauer)}${wann}`;
    }
  }

  /* ── 5. Angaben und Buchen ─────────────────────────────────────────── */
  function kontaktVorfuellen() {
    const k = lesen('irmonhair-kontakt');
    if (!k) return;
    $('k-name').value = k.name || '';
    $('k-telefon').value = k.telefon || '';
    $('k-email').value = k.email || '';
    $('k-merken').checked = true;
  }

  /** Zwei Haken, keiner vorausgewählt; der Wortlaut kommt von der
      Schnittstelle und wird genau so mit Zeitstempel gespeichert. */
  function einwilligungenZeichnen() {
    const box = $('einwilligungen');
    const texte = Z.k?.einwilligungen;
    if (!texte) { box.hidden = true; return; }
    box.replaceChildren(...Object.entries(texte).map(([art, text]) => el('label', { klasse: 'merken einwilligung' },
      el('input', { type: 'checkbox', 'data-art': art }), el('span', { text }))));
    box.hidden = false;
  }
  function einwilligungen() {
    const aus = {};
    for (const i of $('einwilligungen').querySelectorAll('input[data-art]')) aus[i.dataset.art] = i.checked;
    return aus;
  }

  /** Klar sagen, was der Knopf tut: zusätzlich buchen oder verschieben. */
  function buchenHinweis() {
    const box = $('buchen-hinweis');
    const knopf = $('buchen');
    const alt = Z.ersetztTermin;
    $('kontakt').classList.toggle('ist-verschieben', !!alt);
    if (alt) {
      const neu = Z.tag && Z.zeit ? `${gross(tagText(Z.tag))}, ${Z.zeit.t}–${bis(Z.zeit.t, summe().dauer)}` : 'die neue Zeit';
      box.replaceChildren(el('strong', { text: 'Verschieben: ' }),
        `${gross(tagText(alt.start.slice(0, 10)))}, ${alt.start.slice(11)}–${alt.ende.slice(11)} → ${neu}. `,
        'Der bisherige Termin wird erst frei, wenn die neue Zeit sicher gebucht ist.');
      box.hidden = false;
      if (!knopf.disabled) knopf.textContent = 'Auf diese Zeit verschieben';
      return;
    }
    if (!knopf.disabled) knopf.textContent = 'Termin verbindlich buchen';
    const andere = Z.eigene.filter((t) => t.status === 'gebucht');
    if (andere.length) {
      const t = andere[0];
      box.replaceChildren(el('strong', { text: 'Zusätzlicher Termin: ' }),
        `Ihr Termin am ${tagText(t.start.slice(0, 10))}, ${t.start.slice(11)}–${t.ende.slice(11)} bleibt bestehen. `,
        'Wollen Sie ihn stattdessen verschieben? ', el('a', { href: `termin.html?t=${t.token}`, text: 'Hier ändern' }), '.');
      box.hidden = false;
    } else {
      box.hidden = true;
    }
  }

  function feldFehler(feld, text) {
    const input = feld && $('k-' + feld);
    for (const i of document.querySelectorAll('#kontakt [aria-invalid]')) i.removeAttribute('aria-invalid');
    const box = $('kontakt-fehler');
    box.hidden = !text;
    box.textContent = text || '';
    if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
  }

  /* Senden, ohne dass je ein doppelter oder ein „vielleicht“-Termin
     entsteht. Dieselbe Anfrage-Kennung bei jedem Versuch: Die Schnittstelle
     bucht sie höchstens einmal. Bleibt die Antwort aus, wird nachgefragt
     und — falls nötig — noch einmal gesendet. Erfolg zeigt die Seite erst,
     wenn die Schnittstelle den gespeicherten Termin zurückgibt. */
  const OFFEN = 'irmonhair-offen';
  async function sicherSenden(aktion, post, knopf) {
    for (let versuch = 1; ; versuch++) {
      try {
        return await api(aktion, { post });
      } catch (err) {
        const unklar = err.status === 0 || (err.status >= 500 && ['intern', 'unerreichbar', undefined].includes(err.daten.code));
        if (!unklar || versuch >= 3) throw err;
        knopf.textContent = 'Die Verbindung hakt — wir prüfen, ob es angekommen ist …';
        await warte(1200 * versuch);
        if (post.anfrage_id) {
          try {
            const a = await api('anfrage', { get: { anfrage_id: post.anfrage_id } });
            if (a.angekommen) return a.termin;
          } catch (e) { /* weiter versuchen */ }
        }
        knopf.textContent = 'Noch einmal …';
      }
    }
  }

  let anfrageId = null;
  async function buchen(e) {
    e.preventDefault();
    const knopf = $('buchen');
    if (knopf.disabled) return;
    if (!Z.zeit) { zu('zeit'); return; }
    if (Z.ersetzt) return verschiebenSenden(knopf);
    const name = $('k-name').value.trim();
    const telefon = $('k-telefon').value.trim();
    const email = $('k-email').value.trim();
    if (name.length < 2) return feldFehler('name', 'Bitte Ihren Namen angeben.');
    if (telefon.replace(/\D/g, '').length < 6) return feldFehler('telefon', 'Bitte eine Handynummer angeben, z. B. 0176 1234567.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return feldFehler('email', 'Diese E-Mail-Adresse sieht nicht richtig aus.');
    feldFehler(null, '');
    knopf.disabled = true;
    knopf.setAttribute('aria-busy', 'true');
    knopf.textContent = 'Wird gebucht …';
    // Dieselbe Kennung bei jedem neuen Versuch derselben Wahl: ein zweiter
    // Tipp (oder ein wiederholtes Senden bei schlechtem Netz) ergibt einen Termin.
    const schluessel = [Z.salon, Z.gewaehlt.join(), Z.person, Z.tag, Z.zeit.t, telefon].join('|');
    if (!anfrageId || anfrageId.schluessel !== schluessel) anfrageId = { schluessel, id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) };
    // Wird die Seite mitten im Senden geschlossen, fragt sie beim nächsten
    // Öffnen nach, ob der Termin angekommen ist.
    schreiben(OFFEN, { id: anfrageId.id, zeit: Date.now() });
    try {
      const t = await sicherSenden('buchen', {
        salon: Z.salon, leistungen: Z.gewaehlt, person: Z.person === 'egal' ? null : Z.person,
        start: `${Z.tag} ${Z.zeit.t}`, name, telefon, email: email || null, notiz: $('k-notiz').value.trim() || null,
        webseite: $('k-webseite').value, einwilligung: true, einwilligungen: einwilligungen(),
        anfrage_id: anfrageId.id, ref: params.get('ref') || null,
      }, knopf);
      schreiben(OFFEN, null);
      if ($('k-merken').checked) {
        schreiben('irmonhair-kontakt', { name, telefon, email });
        schreiben('irmonhair-letzte', { salon: Z.salon, leistungen: Z.gewaehlt, person: t.wunsch_person ? t.person : null,
          wochentag: alsDatum(Z.tag).getDay(), minute: minuten(Z.zeit.t) });
      } else {
        schreiben('irmonhair-kontakt', null);
      }
      // Den Link zum Termin immer auf dem Gerät behalten — sonst steht er
      // nach dem Schließen der Seite nur in der E-Mail (falls angegeben).
      const liste = lesen('irmonhair-termine') || [];
      schreiben('irmonhair-termine', [t.token, ...liste.filter((x) => x !== t.token)].slice(0, 5));
      anfrageId = null;
      fertigZeigen(t, true);
    } catch (err) {
      knopf.disabled = false;
      knopf.removeAttribute('aria-busy');
      buchenHinweis();
      fehlerNachSenden(err);
    }
  }

  /** Verschieben: nur die neue Zeit, keine Angaben. Atomar auf der Schnittstelle. */
  async function verschiebenSenden(knopf) {
    feldFehler(null, '');
    knopf.disabled = true;
    knopf.setAttribute('aria-busy', 'true');
    knopf.textContent = 'Wird verschoben …';
    try {
      const t = await sicherSenden('verschieben', { t: Z.ersetzt, start: `${Z.tag} ${Z.zeit.t}` }, knopf);
      const vorher = t.vorher || Z.ersetztTermin;
      Z.ersetzt = null; Z.ersetztTermin = null;
      knopf.disabled = false;
      knopf.removeAttribute('aria-busy');
      fertigZeigen({ ...t, vorher }, true);
    } catch (err) {
      knopf.disabled = false;
      knopf.removeAttribute('aria-busy');
      buchenHinweis();
      fehlerNachSenden(err);
    }
  }

  function fehlerNachSenden(err) {
    if (err.daten.code === 'vergeben') {
      // Die Zeit ist weg: frisch laden, drei Ausweichzeiten anbieten.
      Z.zeit = null;
      zu('zeit');
      freiLaden();
      ausweichZeigen(err.message, err.daten.alternativen || []);
      return;
    }
    if (err.status === 0 || err.status >= 500) {
      const s = Z.salon && salon(Z.salon);
      const box = $('kontakt-fehler');
      for (const i of document.querySelectorAll('#kontakt [aria-invalid]')) i.removeAttribute('aria-invalid');
      box.replaceChildren('Das hat gerade nicht geklappt. Noch einmal tippen ist sicher — es entsteht kein zweiter Termin. ',
        s ? el('span', {}, 'Oder rufen Sie an: ', el('a', { href: 'tel:' + s.telefon, text: s.telefon_text }), '.') : '');
      box.hidden = false;
      return;
    }
    feldFehler(err.daten.feld && $('k-' + err.daten.feld) ? err.daten.feld : null, err.message);
  }

  /** Gerade vergeben: drei freie Zeiten, so nah wie möglich an der gewünschten. */
  function ausweichZeigen(text, alternativen) {
    const box = $('ausweich');
    const dauer = summe().dauer;
    box.replaceChildren(el('p', { klasse: 'ausweich-text', text }),
      alternativen.length ? el('div', { klasse: 'vorschlaege ausweich-wege' },
        alternativen.map((a) => vorschlag(gross(tagText(a.datum, true)), `${a.t}–${bis(a.t, dauer)}`, a.datum, { t: a.t, p: a.p }))) : null);
    box.hidden = false;
    ansage(text);
    requestAnimationFrame(() => box.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'center' }));
  }

  function zeigeHinweis(text) {
    const h = $('hinweis-band');
    h.textContent = text;
    h.hidden = false;
    clearTimeout(zeigeHinweis.uhr);
    zeigeHinweis.uhr = setTimeout(() => { h.hidden = true; }, 9000);
  }

  /* ── Gebucht, oder: Termin verwalten ───────────────────────────────── */
  function fertigZeigen(t, frisch) {
    $('bogen').hidden = true;
    $('rueckfall').hidden = true;
    $('beleg-zeile').hidden = true;
    document.body.classList.remove('mit-belegzeile');
    document.querySelector('.buchung-kopf').hidden = true;
    const box = $('fertig');
    box.hidden = false;
    const vorname = (t.name || $('k-name').value || '').trim().split(/\s+/).slice(0, -1).join(' ') || (t.name || '').trim();
    const storniert = String(t.status).startsWith('storniert');
    const verschoben = frisch && !!t.vorher;
    $('fertig-gruss').textContent = storniert ? 'Schade.' : frisch ? (vorname ? `Bis bald, ${vorname}.` : 'Bis bald.') : t.vergangen ? 'Danke für Ihren Besuch.' : 'Wir freuen uns auf Sie.';
    $('fertig-titel').textContent = storniert ? (t.status === 'storniert_salon' ? 'Wir mussten den Termin absagen' : 'Der Termin ist abgesagt')
      : verschoben ? 'Ihr Termin ist verschoben' : frisch ? 'Ihr Termin ist gebucht' : t.vergangen ? 'Dieser Termin liegt zurück' : 'Ihr Termin';
    const b = $('beleg-fertig');
    b.replaceChildren(belegInhalt(t));
    b.classList.toggle('ist-storniert', storniert);
    const wege = document.createDocumentFragment();
    const s = t.salon;
    if (verschoben) {
      wege.append(el('p', { klasse: 'fertig-notiz fertig-vorher' },
        'vorher: ', el('s', { text: `${gross(tagText(t.vorher.start.slice(0, 10)))}, ${t.vorher.start.slice(11)}–${t.vorher.ende.slice(11)}` }),
        el('br'), 'jetzt: ', el('strong', { text: `${gross(tagText(t.start.slice(0, 10)))}, ${t.start.slice(11)}–${t.ende.slice(11)}, bei ${t.person_name}` })));
    }
    if (storniert && t.status === 'storniert_salon' && t.storno_grund) {
      wege.append(el('p', { klasse: 'fertig-notiz', text: t.storno_grund }));
    }
    if (!storniert && !t.vergangen) {
      // Nur eine Lampe: „In den Kalender“. Google und Weg stehen still daneben.
      wege.append(el('button', { type: 'button', klasse: 'knopf', text: 'In den Kalender', onclick: () => icsLaden(t) }));
      wege.append(el('a', { klasse: 'knopf-still', href: googleLink(t), target: '_blank', rel: 'noopener', text: 'Google Kalender' }));
      wege.append(el('a', { klasse: 'knopf-still', href: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`, target: '_blank', rel: 'noopener', text: 'Wegbeschreibung' }));
    }
    if (frisch && !storniert) {
      wege.append(el('p', { klasse: 'fertig-notiz' },
        $('k-email').value.trim() ? 'Die Bestätigung kommt per E-Mail. ' : '',
        'Verschieben oder absagen können Sie ', el('a', { href: `termin.html?t=${t.token}`, text: 'über diesen Link' }),
        ` — bis ${Z.k?.regeln.stornofrist ?? 24} Stunden vorher. Er ist auf diesem Gerät gespeichert und steht auch im Kalendereintrag.`));
    }
    if (!frisch && !storniert && !t.vergangen) {
      if (t.storno_moeglich) {
        wege.append(el('button', { type: 'button', klasse: 'knopf-still', text: 'Verschieben', onclick: () => verschieben(t) }));
        wege.append(el('button', { type: 'button', klasse: 'knopf-still knopf-leise', text: 'Absagen', onclick: (e) => absagen(t, e.currentTarget) }));
      } else {
        wege.append(el('p', { klasse: 'fertig-notiz' }, 'So kurz vorher geht eine Änderung nur telefonisch: ', el('a', { href: 'tel:' + s.telefon, text: s.telefon_text }), '.'));
      }
    }
    if (storniert || t.vergangen || frisch) {
      wege.append(el('a', { klasse: storniert || t.vergangen ? 'knopf' : 'knopf-still', href: 'termin.html' + (s ? `?salon=${s.id}` : ''), text: 'Neuen Termin buchen' }));
    }
    $('fertig-wege').replaceChildren(wege);
    // Nur eine Lampe: ist „In den Kalender“ da, leuchtet „Neuen Termin“ nicht.
    box.focus({ preventScroll: true });
    scrollTo({ top: 0, behavior: ruhig ? 'auto' : 'smooth' });
    ansage($('fertig-titel').textContent);
  }

  async function absagen(t, knopf) {
    if (knopf.dataset.sicher !== 'ja') {
      knopf.dataset.sicher = 'ja';
      knopf.textContent = 'Wirklich absagen?';
      setTimeout(() => { if (knopf.isConnected) { knopf.dataset.sicher = ''; knopf.textContent = 'Absagen'; } }, 5000);
      return;
    }
    knopf.disabled = true;
    knopf.textContent = 'Wird abgesagt …';
    try {
      const neu = await sicherSenden('stornieren', { t: t.token }, knopf);
      schreiben('irmonhair-termine', (lesen('irmonhair-termine') || []).filter((x) => x !== t.token));
      fertigZeigen(neu, false);
    } catch (e) {
      knopf.disabled = false;
      knopf.dataset.sicher = '';
      knopf.textContent = 'Absagen';
      zeigeHinweis(e.message);
    }
  }

  /** Verschieben: dieselbe Wahl, neue Zeit; der alte Termin wird beim
      Buchen des neuen im selben Zug freigegeben. */
  function verschieben(t) {
    Z.ersetzt = t.token;
    Z.ersetztTermin = t;
    $('fertig').hidden = true;
    document.querySelector('.buchung-kopf').hidden = false;
    $('bogen').hidden = false;
    salonWaehlen(t.salon.id, false);
    Z.gewaehlt = t.posten.map((p) => p.leistung).filter((id) => leistung(id));
    Z.person = t.wunsch_person ? t.person : 'egal';
    if (!Z.gewaehlt.length) { zu('leistung'); return; }
    leistungenZeichnen();
    personenZeichnen();
    zu('zeit');
    freiLaden();
    buchenHinweis();
    zeigeHinweis(`Neue Zeit wählen — Ihr Termin am ${tagText(t.start.slice(0, 10))}, ${t.start.slice(11)}–${t.ende.slice(11)} bleibt bestehen, bis die neue Zeit sicher gebucht ist.`);
    history.replaceState(null, '', 'termin.html');
  }

  /* ── Kalenderdatei (.ics) ──────────────────────────────────────────── */
  function berlinUtc(datum, zeit) {
    // Ortszeit Berlin → UTC, unabhängig von der Zeitzone des Geräts.
    const [y, m, d] = datum.split('-').map(Number);
    const [h, mi] = zeit.split(':').map(Number);
    let utc = Date.UTC(y, m - 1, d, h, mi);
    for (let i = 0; i < 2; i++) {
      const teile = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(utc));
      const w = Object.fromEntries(teile.map((p) => [p.type, p.value]));
      const alsUtc = Date.UTC(+w.year, +w.month - 1, +w.day, +w.hour, +w.minute);
      utc -= alsUtc - Date.UTC(y, m - 1, d, h, mi);
    }
    return new Date(utc).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  function icsLaden(t) {
    const x = (s) => String(s).replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const was = t.posten.map((p) => p.name + (p.laenge ? ` (${p.laenge})` : '')).join(', ');
    const s = t.salon;
    const zeilen = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Irmonhair//Termine//DE', 'BEGIN:VEVENT',
      `UID:termin-${t.id}@irmonhair`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `DTSTART:${berlinUtc(t.start.slice(0, 10), t.start.slice(11))}`, `DTEND:${berlinUtc(t.ende.slice(0, 10), t.ende.slice(11))}`,
      `SUMMARY:${x('Irmonhair ' + s.name + ': ' + was)}`, `LOCATION:${x(`Irmonhair, ${s.strasse}, ${s.ort}`)}`,
      `DESCRIPTION:${x(`Bei ${t.person_name}. Telefon ${s.telefon_text}. Verwalten: ${new URL('termin.html?t=' + t.token, location.href).href}`)}`,
      // Ein späterer Eintrag mit derselben UID ersetzt diesen (nach einem Verschieben).
      `SEQUENCE:${Math.floor(Date.now() / 60000) % 100000000}`,
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', `DESCRIPTION:${x('Morgen Irmonhair um ' + t.start.slice(11))}`, 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${x('Irmonhair um ' + t.start.slice(11))}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'];
    const blob = new Blob([zeilen.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `irmonhair-${t.start.slice(0, 10)}.ics` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function googleLink(t) {
    const s = t.salon;
    const q = new URLSearchParams({
      action: 'TEMPLATE', text: `Irmonhair ${s.name}: ${t.posten.map((p) => p.name).join(', ')}`,
      dates: `${berlinUtc(t.start.slice(0, 10), t.start.slice(11))}/${berlinUtc(t.ende.slice(0, 10), t.ende.slice(11))}`,
      location: `Irmonhair, ${s.strasse}, ${s.ort}`,
      details: `Bei ${t.person_name}. Telefon ${s.telefon_text}. Verwalten: ${new URL('termin.html?t=' + t.token, location.href).href}`,
    });
    return 'https://calendar.google.com/calendar/render?' + q;
  }

  /* ── Eigene Termine oben (nur wenn gemerkt) ─────────────────────────── */
  async function eigeneZeigen() {
    const tokens = lesen('irmonhair-termine') || [];
    if (!tokens.length) return;
    const offen = [];
    for (const tok of tokens.slice(0, 3)) {
      try {
        const t = await api('termin', { get: { t: tok } });
        if (t.status === 'gebucht' && !t.vergangen) offen.push(t);
      } catch (e) { /* weg oder nicht erreichbar */ }
    }
    schreiben('irmonhair-termine', offen.map((t) => t.token));
    offen.sort((a, b) => (a.start < b.start ? -1 : 1));
    Z.eigene = offen;
    buchenHinweis();
    if (!offen.length) return;
    const box = $('eigene');
    box.hidden = false;
    box.replaceChildren(...offen.map((t) => el('a', { klasse: 'eigener', href: `termin.html?t=${t.token}` },
      el('span', { klasse: 'eigener-zeile', text: 'Ihr nächster Termin' }),
      el('span', { klasse: 'eigener-wann', text: `${gross(tagText(t.start.slice(0, 10), true))}, ${t.start.slice(11)}–${t.ende.slice(11)} Uhr · ${t.salon.name}, bei ${t.person_name}` }),
      el('span', { klasse: 'eigener-mehr', text: 'ansehen oder ändern' }))));
  }

  /* ── Start ─────────────────────────────────────────────────────────── */
  async function start() {
    if (VORSCHAU) {
      await new Promise((ok, nein) => {
        const s = document.createElement('script');
        s.src = 'termin-vorschau.js';
        s.onload = ok; s.onerror = nein;
        document.head.append(s);
      });
      $('vorschau-band').hidden = false;
    }
    const token = params.get('t');
    let k;
    try {
      k = await api('katalog');
    } catch (e) {
      // Rückfallebene bleibt stehen; der Satz erklärt, warum.
      $('rueckfall-hinweis').hidden = false;
      document.body.classList.add('ohne-buchung');
      return;
    }
    Z.k = k;
    if (!k.regeln.online_aktiv) {
      $('rueckfall-hinweis').textContent = k.regeln.hinweis || 'Die Online-Buchung ist gerade pausiert. Rufen Sie uns an oder buchen Sie über Planity.';
      $('rueckfall-hinweis').hidden = false;
      return;
    }
    // Bedienung einrichten, bevor es irgendwohin abzweigt — auch wer über
    // den Link aus der Bestätigung kommt, verschiebt über dasselbe Formular.
    kontaktVorfuellen();
    einwilligungenZeichnen();
    buchenHinweis();
    for (const e of document.querySelectorAll('.schritt-aendern')) {
      e.addEventListener('click', () => {
        const s = e.closest('.schritt').dataset.schritt;
        zu(s);
        if (s === 'zeit') zeitenZeichnen();
      });
    }
    $('leistung-fertig').addEventListener('click', () => {
      personenZeichnen();
      const ids = koenner();
      if (ids.length === 1) { Z.person = ids[0]; zu('zeit'); } else zu('person');
      if (!Z.frei) freiLaden(); else { personenZeichnen(); zeitenZeichnen(); }
    });
    let sucheUhr;
    $('suche').addEventListener('input', () => { clearTimeout(sucheUhr); sucheUhr = setTimeout(leistungenZeichnen, 120); });
    $('kontakt').addEventListener('submit', buchen);
    for (const id of ['k-name', 'k-telefon', 'k-email']) $(id).addEventListener('input', () => { if (!$('kontakt-fehler').hidden) feldFehler(null, ''); });
    addEventListener('offline', () => zeigeHinweis('Keine Verbindung. Ihre Auswahl bleibt stehen — gebucht wird erst, wenn das Netz zurück ist.'));
    // Zurück nach einer Weile: freie Zeiten auffrischen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Z.frei && Date.now() - Z.frei.geladen > 120000 && ['person', 'zeit'].includes(Z.schritt)) freiLaden();
    });

    // Wurde die Seite mitten im Buchen geschlossen? Nachfragen statt raten.
    const offen = lesen(OFFEN);
    if (offen && Date.now() - offen.zeit < 6 * 3600000) {
      try {
        const a = await api('anfrage', { get: { anfrage_id: offen.id } });
        schreiben(OFFEN, null);
        if (a.angekommen) {
          const liste = lesen('irmonhair-termine') || [];
          schreiben('irmonhair-termine', [a.termin.token, ...liste.filter((x) => x !== a.termin.token)].slice(0, 5));
          document.querySelector('.buchung-kopf').hidden = true;
          $('rueckfall').hidden = true;
          fertigZeigen(a.termin, true);
          zeigeHinweis('Ihre Buchung von vorhin ist angekommen — hier ist sie.');
          return;
        }
      } catch (e) { /* später erneut */ }
    } else if (offen) schreiben(OFFEN, null);
    if (token) {
      try {
        const t = await api('termin', { get: { t: token } });
        document.querySelector('.buchung-kopf').hidden = true;
        $('rueckfall').hidden = true;
        fertigZeigen(t, false);
        return;
      } catch (e) {
        zeigeHinweis(e.message);
      }
    }
    $('rueckfall').hidden = true;
    $('bogen').hidden = false;
    $('buchung-lauf').textContent = 'Salon, Leistung und Uhrzeit wählen — Sie sehen sofort, wer wann frei ist.';
    if (k.regeln.hinweis) { const h = $('hinweis-band'); h.textContent = k.regeln.hinweis; h.hidden = false; h.classList.add('ist-dauerhaft'); }
    // Salon aus der Adresse, sonst aus dem Gedächtnis; die Gruppe aus der Preisliste.
    const wunsch = params.get('salon') || roh('irmonhair-salon');
    const gruppe = params.get('gruppe');
    salonsZeichnen();
    if (wunsch && salon(wunsch)) {
      salonWaehlen(wunsch, false);
      if (gruppe) Z.gruppe = gruppe;
      leistungenZeichnen();
      // Aus der Preisliste in eine Gruppe ohne Online-Termin: das sagen.
      if (gruppe && Z.gruppe !== gruppe) {
        const g = Z.k.gruppen.find((x) => x.id === gruppe);
        const s = salon(wunsch);
        if (g) zeigeHinweis(`${g.name} in ${s.name} vereinbaren wir am Telefon: ${s.telefon_text}.`);
      }
      zu('leistung', !!params.get('salon'));
    } else {
      zu('salon', false);
    }
    eigeneZeigen();
  }

  start();
})();

/* ═══════════════════════════════════════════════════════════════════════
   Irmonhair — Friseur in München

   Leiste, Menü, Öffnungsstand je Standort und der Auftritt. Mehr
   Verhalten hat die Seite nicht.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── Die Leiste und das Menü ─────────────────────────────────────────
     Die Leiste weicht beim Runterscrollen aus und kommt beim Hochscrollen
     zurück; der Navigator der Preisliste fährt mit. Sechs Pixel Hysterese,
     sonst flackert das beim sanften Auslaufen.                         */

  const leiste    = document.querySelector('.leiste');
  const klapp     = document.getElementById('klapp');
  const wege      = document.getElementById('wege');

  function menue(auf) {
    if (!klapp || !wege) return;
    wege.classList.toggle('auf', auf);
    klapp.setAttribute('aria-expanded', String(auf));
    klapp.setAttribute('aria-label', auf ? 'Menü schliessen' : 'Menü öffnen');
  }
  if (klapp && wege) {
    klapp.addEventListener('click', () =>
      menue(klapp.getAttribute('aria-expanded') !== 'true'));
    wege.addEventListener('click', (e) => { if (e.target.closest('a')) menue(false); });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && klapp.getAttribute('aria-expanded') === 'true') {
        menue(false); klapp.focus();
      }
    });
  }

  /* Über der schwarzen Bühne trägt die Leiste keine Fläche. Umgeschaltet
     wird an der Unterkante des Auftakts, minus der eigenen Höhe — sonst
     wechselte sie die Farbe, während sie noch über dem Glanz steht. */
  const buehne = document.querySelector('.auftakt');
  if (leiste && buehne) {
    const buehnenstand = () => {
      const grenze = buehne.offsetHeight - leiste.offsetHeight - 8;
      leiste.classList.toggle('leiste-buehne', window.scrollY < grenze);
    };
    buehnenstand();
    addEventListener('scroll', buehnenstand, { passive: true });
    addEventListener('resize', buehnenstand);
  }

  if (leiste) {
    let letzt = window.scrollY, weg = false;
    const setzen = (w) => {
      weg = w;
      leiste.classList.toggle('weg', w);
      if (w) menue(false);
    };
    addEventListener('scroll', () => {
      const y = window.scrollY;
      if (Math.abs(y - letzt) < 6) return;
      const runter = y > letzt;
      letzt = y;
      if (runter && y > 140 && !weg) setzen(true);
      else if (!runter && weg) setzen(false);
    }, { passive: true });
  }

  /* ── Öffnungsstand ───────────────────────────────────────────────────
     Gerechnet wird nach der Uhr des Ladens, nicht nach der des Geräts. */

  /* Zwei Salons, zwei Zeitpläne — Pasing hat montags zu, Großhadern
     nicht. Halbe Stunden als Bruch: 18.5 heisst 18:30. */
  const ZEITEN = {
    pasing:      { 0: null, 1: null,      2: [9, 18.5], 3: [9, 18.5], 4: [9, 18.5], 5: [9, 18.5], 6: [9, 16] },
    grosshadern: { 0: null, 1: [9, 18.5], 2: [9, 18.5], 3: [9, 18.5], 4: [9, 18.5], 5: [9, 18.5], 6: [9, 16] },
  };
  const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function ladenzeit() {
    const f = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const t = {};
    for (const teil of f.formatToParts(new Date())) t[teil.type] = teil.value;
    const kurz = { 'So': 0, 'Mo': 1, 'Di': 2, 'Mi': 3, 'Do': 4, 'Fr': 5, 'Sa': 6 };
    return { tag: kurz[t.weekday.replace('.', '')],
             stunden: Number(t.hour) + Number(t.minute) / 60 };
  }
  const uhr = (h) => String(Math.floor(h)).padStart(2, '0') + ':' +
                     String(Math.round((h % 1) * 60)).padStart(2, '0');

  /* Der Stand steht an mehreren Stellen — im Auftakt und auf jeder
     Standortkarte. `data-ort` wählt den Zeitplan, `data-vorsatz` stellt
     den Namen des Salons davor, wo er sonst fehlen würde. */
  function standText(ort) {
    const plan = ZEITEN[ort] || ZEITEN.pasing;
    const { tag, stunden } = ladenzeit();
    const heute = plan[tag];
    if (heute && stunden >= heute[0] && stunden < heute[1])
      return ['Jetzt geöffnet · bis ' + uhr(heute[1]), true];
    if (heute && stunden < heute[0]) return ['Heute ab ' + uhr(heute[0]), false];
    for (let i = 1; i <= 7; i++) {
      const t = (tag + i) % 7;
      if (plan[t])
        return ['Geschlossen · ' + (i === 1 ? 'Morgen' : TAGE[t]) + ' ab ' + uhr(plan[t][0]), false];
    }
    return ['', false];
  }

  function standSetzen() {
    for (const el of document.querySelectorAll('.stand')) {
      const [text, offen] = standText(el.dataset.ort);
      el.textContent = (el.dataset.vorsatz ? el.dataset.vorsatz + ' · ' : '') + text;
      el.classList.toggle('offen', offen);
    }
  }
  standSetzen();
  setInterval(standSetzen, 60000);
})();

/* ── Der Vorhang ────────────────────────────────────────────────────────
   Er geht, sobald das Bild des Auftakts dekodiert ist — dann steht der
   Glanz schon da, wenn der Vorhang aufgeht, und nicht halb geladen.
   Zwei Grenzen: frühestens nach 1 s, damit das Siegel nicht nur
   aufblitzt, spätestens nach 2 s, denn niemand wartet auf eine
   Kulisse. Kommt diese Datei gar nicht an, holt ihn die CSS-Animation
   nach 5 s weg. */

(function () {
  const vorhang = document.querySelector('.vorhang');
  if (!vorhang) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    vorhang.remove();
    return;
  }

  let fort = false;
  function heben() {
    if (fort) return;
    fort = true;
    vorhang.classList.add('geht');
    /* Erst nach dem Ausblenden aus dem Weg räumen, sonst springt es. */
    vorhang.addEventListener('transitionend', () => vorhang.classList.add('fort'), { once: true });
    setTimeout(() => vorhang.classList.add('fort'), 1200);
    document.documentElement.dispatchEvent(new CustomEvent('vorhang-weg'));
  }

  const beginn = performance.now();
  const bild = document.querySelector('.auftakt-grund img');
  const bereit = bild && bild.decode ? bild.decode().catch(() => {}) : Promise.resolve();
  bereit.then(() => setTimeout(heben, Math.max(0, 1000 - (performance.now() - beginn))));
  setTimeout(heben, 2000);
})();

/* ── Der Auftritt ───────────────────────────────────────────────────────
   Ein einziger gestalteter Moment: der Auftakt baut sich beim Laden auf,
   aus der Unschärfe heraus, in Gruppen zu dritt. Alles Weitere kommt
   beim Scrollen nach — aber leiser und ohne Unschärfe, damit es dem
   Auftakt nicht die Bühne nimmt.

   Die Klassen setzt in beiden Fällen das Skript. Ohne Skript steht die
   Seite vollständig da; die Klasse `vorlauf` im Kopf der Seite nimmt
   sich nach 1,6 s selbst zurück, falls diese Datei gar nicht ankommt. */

(function () {
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wurzel = document.documentElement;

  /* ── Der Auftakt ─────────────────────────────────────────────────── */

  const satz = document.querySelector('.auftakt-satz');
  if (satz && !ruhig) {
    /* Die Schere kommt mit der ersten Gruppe. */
    const schere = document.querySelector('.auftakt-schere');
    const teile = [...(schere ? [schere] : []), ...satz.children];
    for (const el of teile) el.classList.add('auftritt-gross');
    wurzel.classList.remove('vorlauf');

    /* Hinter dem Vorhang aufzubauen hiesse, den einen gestalteten
       Moment an eine schwarze Fläche zu verschenken. Also erst, wenn
       der Vorhang geht — und ohne Vorhang sofort. */
    const vorhang = document.querySelector('.vorhang');
    let begonnen = false;
    const anfangen = () => { if (begonnen) return; begonnen = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
      teile.forEach((el, i) => {
        setTimeout(() => el.classList.add('auftritt-da'), Math.floor(i / 3) * 90);
      });
    })); };
    if (vorhang && !vorhang.classList.contains('geht')) {
      wurzel.addEventListener('vorhang-weg', anfangen, { once: true });
      /* Nichts darf am Vorhang hängen bleiben, falls er anders geht. */
      setTimeout(anfangen, 2600);
    } else {
      anfangen();
    }
  } else {
    wurzel.classList.remove('vorlauf');
  }

  /* ── Der Rest beim Scrollen ──────────────────────────────────────── */

  if (ruhig || !('IntersectionObserver' in window)) return;

  /* Nicht die Bilder im Zug einzeln: die wandern, treten dem Beobachter
     nie richtig ins Bild und blieben unsichtbar stehen. Der Zug tritt
     als Ganzes ein. */
  const ZIELE = '.gross, .wand-titel, .belege p, .fach, .werke-bahn, ' +
                '.laden figure, .spruch, .abschluss, .spalten > div, .karte, ' +
                '.stimme, .stimmen-kopf, .kontakt-satz, .ort-karte, .galerie-bilder li, .salon-reihe, .finder';

  /* Nichts aus einem geschlossenen Fach: was `display: none` trägt,
     meldet der Beobachter nie — es bliebe beim Aufklappen unsichtbar
     stehen. Und nichts aus dem Auftakt, der hat seinen eigenen Auftritt. */
  const stuecke = [...document.querySelectorAll(ZIELE)]
    .filter((el) => !el.closest('.auftakt') && !el.closest('.fach-inhalt'));
  if (!stuecke.length) return;

  for (const el of stuecke) el.classList.add('auftritt');

  const beob = new IntersectionObserver((eintraege) => {
    const dran = eintraege.filter((e) => e.isIntersecting).map((e) => e.target);
    dran.forEach((el, i) => {
      setTimeout(() => el.classList.add('auftritt-da'), Math.floor(i / 3) * 90);
      beob.unobserve(el);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  for (const el of stuecke) beob.observe(el);
})();

/* ── Preisliste: Salonwahl und Wegweiser ─────────────────────────────────
   Die Wahl steht in Radioknöpfen; hier wird sie gemerkt und aus der
   Adresse gelesen (#grosshadern, #farbe, #grosshadern-farbe). Der Späher
   markiert die Gruppe, die gerade oben steht. Die Preisleiste weicht mit
   der Leiste aus — dafür spiegelt `leiste-weg` deren Zustand. */
(function () {
  const wurzel = document.documentElement;
  const leiste = document.querySelector('.leiste');
  if (leiste) new MutationObserver(() =>
    wurzel.classList.toggle('leiste-weg', leiste.classList.contains('weg'))
  ).observe(leiste, { attributes: true, attributeFilter: ['class'] });

  const wahl = document.querySelectorAll('.salonwahl input');
  if (!wahl.length) return;
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gewaehlt = () => (document.querySelector('.salonwahl input:checked') || {}).value || 'pasing';
  const waehlen = (s) => { const el = document.getElementById('wahl-' + s); if (el) el.checked = true; };
  try { const g = localStorage.getItem('irmonhair-salon'); if (g) waehlen(g); } catch (e) { /* privat */ }

  function adresse() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    const [a, b] = h.split('-');
    if (a === 'pasing' || a === 'grosshadern') waehlen(a);
    const ziel = document.getElementById(b ? h : (a === 'pasing' || a === 'grosshadern' ? '' : gewaehlt() + '-' + a));
    if (ziel) requestAnimationFrame(() => ziel.scrollIntoView());
  }
  adresse();
  addEventListener('hashchange', adresse);

  let beob = null;
  function spaeher() {
    if (beob) beob.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const s = gewaehlt();
    const verweise = [...document.querySelectorAll('.wegweiser-bahn.salon-' + s + ' a')];
    const gruppen = [...document.querySelectorAll('#' + s + ' .gruppe')];
    const sichtbar = new Set();
    beob = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) (e.isIntersecting ? sichtbar.add(e.target) : sichtbar.delete(e.target));
      const erste = gruppen.find((g) => sichtbar.has(g));
      if (!erste) return;
      for (const v of verweise) {
        const an = v.getAttribute('href') === '#' + erste.id;
        if (an && v.getAttribute('aria-current') !== 'true') {
          v.setAttribute('aria-current', 'true');
          const bahn = v.parentElement;
          bahn.scrollTo({ left: v.offsetLeft - bahn.clientWidth / 2 + v.offsetWidth / 2, behavior: ruhig ? 'auto' : 'smooth' });
        } else if (!an) v.removeAttribute('aria-current');
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    for (const g of gruppen) beob.observe(g);
  }
  for (const r of wahl) r.addEventListener('change', () => {
    try { localStorage.setItem('irmonhair-salon', r.value); } catch (e) { /* privat */ }
    history.replaceState(null, '', '#' + r.value);
    spaeher();
  });
  spaeher();
})();

/* ── Die Ansicht der Fotos ──────────────────────────────────────────────
   Ein eigenes Fenster statt der nackten Bilddatei: blättern mit den
   Knöpfen, den Pfeiltasten oder Wischen, schliessen mit Esc, dem Kreuz
   oder einem Tipp neben das Bild. Beim Schliessen steht die Seite genau
   dort, wo sie war, und der Fokus liegt wieder auf dem Foto, von dem
   man kam. */
(function () {
  const ansicht = document.getElementById('ansicht');
  const links = [...document.querySelectorAll('.galerie-link')];
  if (!ansicht || !ansicht.showModal || !links.length) return;
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Das Bild entsteht erst hier — ein leeres <img> im Quelltext wäre
     ohne Skript ein kaputtes Bild. */
  const bild = document.createElement('img');
  bild.alt = ''; bild.decoding = 'async';
  ansicht.querySelector('.ansicht-bild').prepend(bild);
  const text = ansicht.querySelector('.ansicht-text');
  const zahl = ansicht.querySelector('.ansicht-zahl');
  const wurzel = document.documentElement;
  let nr = 0, herkunft = null, oben = 0;

  /* „Pasing · Waschplatz“ — der Salon steht fett davor und bekommt
     in der Ansicht einen Punkt als Trenner. */
  const unterschrift = (a) => {
    const p = a.parentElement.querySelector('p'), b = p.querySelector('b');
    const rest = p.textContent.replace(b ? b.textContent : '', '').trim();
    return b ? b.textContent + ' · ' + rest : rest;
  };
  function vorladen(i) { const a = links[(i + links.length) % links.length]; const v = new Image(); v.src = a.dataset.gross; }
  function zeigen(i, richtung) {
    nr = (i + links.length) % links.length;
    const a = links[nr];
    const setzen = () => {
      bild.src = a.dataset.gross; bild.width = +a.dataset.b; bild.height = +a.dataset.h;
      bild.alt = a.querySelector('img').alt;
      text.textContent = unterschrift(a);
      zahl.textContent = (nr + 1) + ' / ' + links.length;
      bild.classList.remove('wechselt');
    };
    if (richtung && !ruhig) {
      bild.style.setProperty('--weg', (richtung > 0 ? -24 : 24) + 'px');
      bild.classList.add('wechselt');
      setTimeout(() => { bild.style.setProperty('--weg', (richtung > 0 ? 24 : -24) + 'px'); setzen(); }, 200);
    } else setzen();
    vorladen(nr + 1); vorladen(nr - 1);
  }
  function oeffnen(i, a) {
    herkunft = a; oben = window.scrollY;
    zeigen(i, 0);
    wurzel.classList.add('ansicht-offen');
    ansicht.classList.remove('zu');
    ansicht.showModal();
  }
  function schliessen() {
    if (!ansicht.open) return;
    const ende = () => {
      ansicht.close(); ansicht.classList.remove('zu');
      wurzel.classList.remove('ansicht-offen');
      window.scrollTo({ top: oben, behavior: 'instant' });
      if (herkunft) herkunft.focus({ preventScroll: true });
    };
    if (ruhig) return ende();
    ansicht.classList.add('zu');
    setTimeout(ende, 280);
  }

  links.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); oeffnen(i, a); }));
  ansicht.querySelector('.ansicht-weiter').addEventListener('click', () => zeigen(nr + 1, 1));
  ansicht.querySelector('.ansicht-zurueck').addEventListener('click', () => zeigen(nr - 1, -1));
  ansicht.querySelector('.ansicht-zu').addEventListener('click', schliessen);
  /* Ein Tipp neben das Bild schliesst — ein Tipp aufs Bild nicht. */
  ansicht.addEventListener('click', (e) => { if (e.target === ansicht || e.target.classList.contains('ansicht-bild')) schliessen(); });
  ansicht.addEventListener('cancel', (e) => { e.preventDefault(); schliessen(); });
  ansicht.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') zeigen(nr + 1, 1);
    else if (e.key === 'ArrowLeft') zeigen(nr - 1, -1);
  });
  /* Wischen: waagrecht mehr als 50 px, und deutlich mehr als senkrecht. */
  let x0 = null, y0 = 0;
  ansicht.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
  ansicht.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) zeigen(nr + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
})();

/* ── Welcher Salon liegt näher? ─────────────────────────────────────────
   Auf Knopfdruck fragt der Browser nach dem Standort; die Entfernung zu
   beiden Salons wird hier gerechnet (Luftlinie) und nirgends hin
   geschickt. Der nähere Salon bekommt ein Zeichen, und die Seite fährt
   zu ihm. Koordinaten: OpenStreetMap, auf die Hausnummer genau. */
(function () {
  const knopf = document.getElementById('finder');
  const meldung = document.getElementById('finder-text');
  if (!knopf || !meldung) return;
  if (!('geolocation' in navigator)) { knopf.parentElement.hidden = true; return; }
  const SALONS = {
    pasing:      { name: 'Pasing',     lat: 48.1485620, lon: 11.4591604 },
    grosshadern: { name: 'Großhadern', lat: 48.1152757, lon: 11.4776080 },
  };
  const km = (a, b) => {
    const r = Math.PI / 180, R = 6371;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const schoen = (d) => d < 1 ? Math.round(d * 1000 / 50) * 50 + ' m' : d.toFixed(1).replace('.', ',') + ' km';

  knopf.addEventListener('click', () => {
    knopf.disabled = true;
    meldung.textContent = 'Einen Moment — der Browser fragt nach Ihrem Standort …';
    navigator.geolocation.getCurrentPosition((pos) => {
      const ich = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const wege = Object.entries(SALONS).map(([ort, s]) => [ort, km(ich, s)]).sort((a, b) => a[1] - b[1]);
      for (const [ort, d] of wege) {
        const weg = document.querySelector('.salon-weg[data-ort="' + ort + '"]');
        if (weg) { weg.textContent = schoen(d) + ' Luftlinie von Ihnen'; weg.hidden = false; }
        const marke = document.querySelector('.salon-naeher[data-ort="' + ort + '"]');
        if (marke) marke.hidden = ort !== wege[0][0];
        const reihe = document.getElementById('salon-' + ort);
        if (reihe) reihe.classList.toggle('ist-naeher', ort === wege[0][0]);
      }
      const [erster, d] = wege[0];
      meldung.textContent = SALONS[erster].name + ' liegt näher — ' + schoen(d) + ' Luftlinie.';
      knopf.disabled = false;
      const ziel = document.getElementById('salon-' + erster);
      if (ziel) ziel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    }, (fehler) => {
      knopf.disabled = false;
      meldung.textContent = fehler.code === 1
        ? 'Kein Standort freigegeben — kein Problem: Pasing liegt an der Irmonherstraße, Großhadern an der Würmtalstraße.'
        : 'Der Standort liess sich gerade nicht bestimmen. Bitte später noch einmal versuchen.';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
})();

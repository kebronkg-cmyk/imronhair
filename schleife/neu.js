/* ═══════════════════════════════════════════════════════════════════════
   Irmonhair — Friseur in München

   Leiste und Menü, Öffnungsstand je Salon, der Spiegel im Auftakt, das
   grosse Bild, die Salonwahl und der Wegweiser der Preisliste, der
   Auftritt. Ohne diese Datei steht die Seite vollständig da.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const wurzel = document.documentElement;
  wurzel.classList.add('js');
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const feinZeiger = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── Die Leiste und das Menü ─────────────────────────────────────────
     Die Leiste weicht beim Runterscrollen aus und kommt beim Hochscrollen
     zurück; der Wegweiser der Preisliste fährt mit (über die Klasse am
     Wurzelelement). Sechs Pixel Hysterese, sonst flackert es beim
     sanften Auslaufen. */

  const leiste = document.querySelector('.leiste');
  const klapp  = document.getElementById('klapp');
  const wege   = document.getElementById('wege');

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

  if (leiste) {
    let letzt = window.scrollY, weg = false;
    const setzen = (w) => {
      weg = w;
      leiste.classList.toggle('weg', w);
      wurzel.classList.toggle('leiste-weg', w);
      if (w) menue(false);
    };
    addEventListener('scroll', () => {
      const y = window.scrollY;
      if (Math.abs(y - letzt) < 6) return;
      const runter = y > letzt;
      letzt = y;
      if (runter && y > 160 && !weg) setzen(true);
      else if ((!runter || y < 80) && weg) setzen(false);
    }, { passive: true });
  }

  /* ── Öffnungsstand ───────────────────────────────────────────────────
     Gerechnet wird nach der Uhr des Ladens, nicht nach der des Geräts.
     Pasing hat montags zu, Großhadern nicht. 18.5 heisst 18:30. */

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
        return ['Geschlossen · ' + (i === 1 ? 'morgen' : TAGE[t]) + ' ab ' + uhr(plan[t][0]), false];
    }
    return ['', false];
  }
  function standSetzen() {
    for (const el of document.querySelectorAll('.stand')) {
      const [text, offen] = standText(el.dataset.ort);
      el.textContent = text;
      el.classList.toggle('offen', offen);
    }
  }
  standSetzen();
  setInterval(standSetzen, 60000);

  /* ── Der Spiegel ─────────────────────────────────────────────────────
     Das Licht auf dem Glas folgt dem Zeiger über dem ganzen Auftakt —
     wie ein Spiegel, an dem man vorbeigeht. Am Handy übernimmt das
     Scrollen die Rolle des Zeigers. Gerechnet wird einmal pro Bild. */

  const spiegel = document.querySelector('.spiegel');
  if (spiegel) {
    const rahmen = spiegel.querySelector('.spiegel-rahmen');
    const ort = spiegel.querySelector('.spiegel-ort');
    const ORTE = { pasing: 'Irmonherstraße 7', grosshadern: 'Würmtalstraße 119' };
    const knoepfe = [...spiegel.querySelectorAll('.spiegel-wahl button')];

    for (const k of knoepfe) {
      k.addEventListener('click', () => {
        const salon = k.dataset.salon;
        if (spiegel.dataset.salon === salon) return;
        spiegel.dataset.salon = salon;
        for (const b of knoepfe) b.setAttribute('aria-pressed', String(b === k));
        if (ort) ort.textContent = ORTE[salon];
        spiegel.classList.remove('wechsel');
        void spiegel.offsetWidth;
        spiegel.classList.add('wechsel');
      });
    }
    /* Beide Bilder laden sofort und werden vorab dekodiert — der Wechsel
       zeigt dann ein fertiges Bild statt eines, das erst aufgebaut wird. */
    for (const b of spiegel.querySelectorAll('.spiegel-bild')) if (b.decode) b.decode().catch(() => {});

    if (!ruhig && rahmen) {
      let ziel = null, lauf = false;
      const setzen = () => {
        lauf = false;
        if (!ziel) return;
        rahmen.style.setProperty('--lx', ziel[0].toFixed(1) + '%');
        rahmen.style.setProperty('--ly', ziel[1].toFixed(1) + '%');
      };
      const anfordern = (x, y) => {
        ziel = [x, y];
        if (!lauf) { lauf = true; requestAnimationFrame(setzen); }
      };
      if (feinZeiger) {
        const feld = document.querySelector('.auftakt') || spiegel;
        feld.addEventListener('pointermove', (e) => {
          const r = rahmen.getBoundingClientRect();
          /* Der Glanz darf über den Rand hinaus wandern, aber nicht weit. */
          const x = Math.max(-20, Math.min(120, (e.clientX - r.left) / r.width * 100));
          const y = Math.max(-10, Math.min(90, (e.clientY - r.top) / r.height * 100));
          anfordern(x, y);
        });
      } else {
        addEventListener('scroll', () => {
          const r = rahmen.getBoundingClientRect();
          const p = 1 - (r.top + r.height) / (innerHeight + r.height);
          anfordern(20 + p * 90, 10 + p * 50);
        }, { passive: true });
      }
    }
  }

  /* ── Das grosse Bild ─────────────────────────────────────────────── */

  const dialog = document.getElementById('gross-bild');
  if (dialog && dialog.showModal) {
    /* Das Bild entsteht erst hier — ein leeres <img> im Quelltext wäre
       ohne Skript ein kaputtes Bild. */
    const img = document.createElement('img');
    img.width = 1600; img.height = 1200;
    dialog.prepend(img);
    const text = dialog.querySelector('.gross-bild-text');
    let zurueck = null;
    document.addEventListener('click', (e) => {
      const k = e.target.closest('.bild-knopf');
      if (!k) return;
      zurueck = k;
      img.src = k.dataset.gross;
      const unter = k.parentElement.querySelector('p');
      img.alt = unter ? unter.textContent : '';
      text.textContent = unter ? unter.textContent : '';
      dialog.showModal();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('.gross-bild-zu')) dialog.close();
    });
    dialog.addEventListener('close', () => { if (zurueck) zurueck.focus(); });
  }

  /* ── Salonwahl und Wegweiser (Preisliste) ────────────────────────────
     Die Wahl steht in Radioknöpfen; das Skript merkt sie sich und liest
     sie aus der Adresse: #grosshadern wählt den Salon, #farbe springt
     in die Gruppe des gewählten Salons, #grosshadern-farbe in beides. */

  const wahl = document.querySelectorAll('.salonwahl input');
  if (wahl.length) {
    const GRUPPEN = ['schnitt', 'farbe', 'straehnen', 'pflege', 'herren', 'kinder', 'verlaengerung', 'gesicht'];
    const merken = (s) => { try { localStorage.setItem('irmonhair-salon', s); } catch (e) { /* privat */ } };
    const gemerkt = () => { try { return localStorage.getItem('irmonhair-salon'); } catch (e) { return null; } };
    const waehlen = (s) => {
      const el = document.getElementById('wahl-' + s);
      if (el) el.checked = true;
    };
    const gewaehlt = () => (document.querySelector('.salonwahl input:checked') || {}).value || 'pasing';

    function adresseLesen() {
      const h = decodeURIComponent(location.hash.slice(1));
      if (!h) return;
      const [a, b] = h.split('-');
      if (a === 'pasing' || a === 'grosshadern') {
        waehlen(a);
        if (b && document.getElementById(h)) requestAnimationFrame(() => document.getElementById(h).scrollIntoView());
      } else if (GRUPPEN.includes(a)) {
        const ziel = document.getElementById(gewaehlt() + '-' + a);
        if (ziel) requestAnimationFrame(() => ziel.scrollIntoView());
      }
    }

    const vorher = gemerkt();
    if (vorher) waehlen(vorher);
    adresseLesen();
    addEventListener('hashchange', adresseLesen);

    for (const r of wahl) {
      r.addEventListener('change', () => {
        merken(r.value);
        history.replaceState(null, '', '#' + r.value);
        spaeher();
      });
    }

    /* Der Späher markiert im Wegweiser die Gruppe, die gerade oben
       steht, und schiebt sie in der Bahn ins Bild. */
    let beob = null;
    function spaeher() {
      if (beob) beob.disconnect();
      const salon = document.getElementById(gewaehlt());
      if (!salon || !('IntersectionObserver' in window)) return;
      const verweise = [...salon.querySelectorAll('.wegweiser a')];
      const gruppen = [...salon.querySelectorAll('.gruppe')];
      const sichtbar = new Set();
      const markieren = () => {
        const erste = gruppen.find((g) => sichtbar.has(g));
        if (!erste) return;
        for (const v of verweise) {
          const an = v.getAttribute('href') === '#' + erste.id;
          if (an) {
            if (v.getAttribute('aria-current') !== 'true') {
              v.setAttribute('aria-current', 'true');
              const bahn = v.parentElement;
              bahn.scrollTo({ left: v.offsetLeft - bahn.clientWidth / 2 + v.offsetWidth / 2,
                              behavior: ruhig ? 'auto' : 'smooth' });
            }
          } else v.removeAttribute('aria-current');
        }
      };
      beob = new IntersectionObserver((eintraege) => {
        for (const e of eintraege) (e.isIntersecting ? sichtbar.add(e.target) : sichtbar.delete(e.target));
        markieren();
      }, { rootMargin: '-35% 0px -55% 0px' });
      for (const g of gruppen) beob.observe(g);
    }
    spaeher();
  }

  /* ── Der Vorhang ──────────────────────────────────────────────────────
     Er geht, sobald das Spiegelbild dekodiert ist — frühestens nach
     0,9 s, damit das Logo nicht nur aufblitzt, spätestens nach 1,8 s.
     Kommt diese Datei gar nicht an, holt ihn die CSS nach 4 s weg. */

  const vorhang = document.querySelector('.vorhang');
  let vorhangWeg = !vorhang;
  const nachVorhang = [];
  if (vorhang) {
    if (ruhig || sessionStorageHat()) {
      vorhang.remove(); vorhangWeg = true;
    } else {
      let fort = false;
      const heben = () => {
        if (fort) return;
        fort = true;
        vorhang.classList.add('geht');
        setTimeout(() => vorhang.classList.add('fort'), 700);
        vorhangWeg = true;
        nachVorhang.splice(0).forEach((f) => f());
        try { sessionStorage.setItem('irmonhair-vorhang', '1'); } catch (e) { /* privat */ }
      };
      const beginn = performance.now();
      const bild = document.querySelector('.spiegel-bild-pasing');
      const bereit = bild && bild.decode ? bild.decode().catch(() => {}) : Promise.resolve();
      bereit.then(() => setTimeout(heben, Math.max(0, 900 - (performance.now() - beginn))));
      setTimeout(heben, 1800);
    }
  }
  /* Einmal pro Besuch reicht — wer von der Preisliste zurückkommt,
     soll nicht noch einmal warten. */
  function sessionStorageHat() {
    try { return sessionStorage.getItem('irmonhair-vorhang') === '1'; } catch (e) { return false; }
  }

  /* ── Der Auftritt ─────────────────────────────────────────────────────
     Ein gestalteter Moment beim Laden: der Auftakt baut sich auf, in
     Gruppen zu höchstens drei, 90 ms versetzt. Alles Weitere kommt beim
     Scrollen nach, leiser und ohne Unschärfe. */

  const satz = document.querySelector('.auftakt-satz');
  if (satz && !ruhig) {
    const teile = [...satz.children];
    if (spiegel) teile.splice(2, 0, spiegel);
    for (const el of teile) el.classList.add('auftritt-gross');
    wurzel.classList.remove('vorlauf');
    const anfangen = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      teile.forEach((el, i) => setTimeout(() => el.classList.add('auftritt-da'), Math.floor(i / 3) * 90 + (i % 3) * 30));
    }));
    if (vorhangWeg) anfangen(); else nachVorhang.push(anfangen);
  } else {
    wurzel.classList.remove('vorlauf');
  }

  if (ruhig || !('IntersectionObserver' in window)) return;

  const ZIELE = '.kopfzeile, .angebote li, .mehr, .bild, .stimmen-kopf, .stimme, .ort, ' +
                '.preise-kopf .mitte > *, .salon-schluss, .legende > div';
  const stuecke = [...document.querySelectorAll(ZIELE)].filter((el) => !el.closest('.auftakt'));
  for (const el of stuecke) el.classList.add('auftritt');
  const beob = new IntersectionObserver((eintraege) => {
    const dran = eintraege.filter((e) => e.isIntersecting).map((e) => e.target);
    dran.forEach((el, i) => {
      setTimeout(() => el.classList.add('auftritt-da'), Math.floor(i / 3) * 90);
      beob.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const el of stuecke) beob.observe(el);
})();

/* ── Welcher Salon liegt näher? ─────────────────────────────────────────
   Auf Knopfdruck fragt der Browser nach dem Standort; die Entfernung zu
   beiden Salons wird hier gerechnet (Luftlinie) und nirgends hin
   geschickt. Der nähere Salon bekommt ein Schild, und die Seite fährt
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
      const erster = wege[0][0];
      for (const [ort, d] of wege) {
        const weg = document.querySelector('.ort-weg[data-ort="' + ort + '"]');
        if (weg) { weg.textContent = schoen(d) + ' Luftlinie von Ihnen'; weg.hidden = false; }
        const schild = document.querySelector('.ort-naeher[data-ort="' + ort + '"]');
        if (schild) schild.hidden = ort !== erster;
        const karte = document.getElementById('salon-' + ort);
        if (karte) karte.classList.toggle('ist-naeher', ort === erster);
      }
      meldung.textContent = SALONS[erster].name + ' liegt näher — ' + schoen(wege[0][1]) + ' Luftlinie.';
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

/* ── Das Farbregal ────────────────────────────────────────────────────────
   Ton, Länge und Wunsch sind Radioknöpfe; hier wird daraus der Satz, der
   unter dem Regal steht, und auf Wunsch der Text für eine Nachricht an
   den Salon. Ohne Skript bleibt die Auswahl sichtbar, nur der Satz ruht. */
(function () {
  const regal = document.getElementById('regal');
  if (!regal) return;
  const tonFeld = regal.querySelector('.regal-ton');
  const satz = regal.querySelector('.regal-satz');
  const kopie = regal.querySelector('.regal-kopie');
  const still = regal.querySelector('.regal-still');
  const ruhe = still ? still.textContent : '';
  const wert = (name) => (regal.querySelector('input[name="' + name + '"]:checked') || {}).value || '';
  const ZIEL = { 'mehr Länge': 'mit mehr Länge', 'mehr Volumen': 'mit mehr Volumen', 'Länge und Volumen': 'mit mehr Länge und Volumen' };

  function setzen() {
    const ton = wert('ton'), laenge = wert('laenge'), ziel = wert('ziel');
    if (tonFeld) tonFeld.textContent = ton;
    satz.replaceChildren();
    const b = document.createElement('b'); b.textContent = ton;
    satz.append(b, ', ' + laenge + ', ' + (ZIEL[ziel] || ziel) + '.');
  }
  regal.addEventListener('change', setzen);
  regal.addEventListener('submit', (e) => e.preventDefault());
  setzen();

  /* Den Wunsch als fertigen Text kopieren — für eine Nachricht an den Salon. */
  if (kopie && navigator.clipboard) {
    kopie.hidden = false;
    kopie.addEventListener('click', async () => {
      const text = 'Hallo Irmonhair, ich interessiere mich für Extensions: Farbton ' + wert('ton') +
        ' (Farbbeispiel von der Website), ' + wert('laenge') + ', ' + (ZIEL[wert('ziel')] || wert('ziel')) +
        '. Ich hätte gern einen Termin zur Beratung.';
      try {
        await navigator.clipboard.writeText(text);
        still.textContent = 'Kopiert — fügen Sie den Text in Ihre Nachricht an den Salon ein.';
      } catch (err) {
        still.textContent = 'Kopieren ging gerade nicht. Rufen Sie gern an: 089 821 116 4.';
      }
      clearTimeout(kopie.zeit);
      kopie.zeit = setTimeout(() => { still.textContent = ruhe; }, 5000);
    });
  }
})();

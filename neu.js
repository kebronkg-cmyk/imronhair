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
                '.stimme, .stimmen-kopf, .kontakt-satz, .ort-karte';

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

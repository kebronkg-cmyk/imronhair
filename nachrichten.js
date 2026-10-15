/* „Ihre Nachrichten“ (nachrichten.html): Was eine Kundin von uns bekommt,
   über den signierten Link aus jeder Nachricht (?k=…), und die Bestätigung
   der Angebote (?b=…). Jede Art einzeln an und aus, dazu „alles
   abbestellen“ — ohne Anmeldung, ohne Rückfrage, ohne Umweg. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const API = new URL(document.querySelector('meta[name="irmonhair-api"]')?.content || 'api/', location.href).href;
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
  async function api(aktion, { get, post } = {}) {
    const url = new URL(API);
    url.searchParams.set('a', aktion);
    for (const [k, v] of Object.entries(get || {})) url.searchParams.set(k, v);
    let r;
    try {
      r = await fetch(url, { method: post ? 'POST' : 'GET', credentials: 'same-origin', headers: post ? { 'Content-Type': 'application/json' } : {}, body: post ? JSON.stringify(post) : undefined });
    } catch (e) { throw new Error('Keine Verbindung. Bitte noch einmal versuchen.'); }
    let d;
    try { d = await r.json(); } catch (e) { throw new Error('Gerade nicht erreichbar. Bitte später noch einmal.'); }
    if (!r.ok) throw new Error(d.fehler || 'Das hat nicht geklappt.');
    return d;
  }
  const TITEL = {
    terminnachrichten: 'Erinnerung am Vortag per SMS',
    recall: 'Bescheid, wenn der nächste Termin fällig ist',
    angebote: 'Ab und zu ein Angebot',
  };
  const box = $('nachrichten');
  const k = params.get('k');

  function zeichnen(d, meldung) {
    $('gruss').textContent = d.vorname ? `Hallo ${d.vorname}.` : 'Sie entscheiden.';
    const karten = Object.entries(d.texte).map(([art, text]) => {
      const e = d.einwilligungen[art];
      const an = !!e?.erteilt;
      const haken = el('input', { type: 'checkbox', 'data-art': art });
      haken.checked = an;
      haken.addEventListener('change', () => speichern({ arten: { [art]: haken.checked } }, haken.checked ? (art === 'angebote' ? 'Fast fertig: Bitte bestätigen Sie über den Link, den wir gerade geschickt haben.' : 'Eingeschaltet.') : 'Abbestellt. Ab sofort kommt dazu nichts mehr.'));
      return el('label', { klasse: 'zusage' + (an ? ' ist-an' : '') }, haken,
        el('span', { klasse: 'zusage-text' },
          el('span', { klasse: 'zusage-titel', text: TITEL[art] || art }),
          e?.wartet && !an ? el('span', { klasse: 'zusage-danke', text: 'Wartet auf Ihre Bestätigung über den Link.' }) : null,
          el('span', { klasse: 'zusage-wortlaut', text: text })));
    });
    const gesperrt = d.gesperrt.sms || d.gesperrt.email;
    box.replaceChildren(...[
      meldung ? el('p', { klasse: 'hinweis-band', role: 'status', text: meldung }) : null,
      el('p', { klasse: 'zusagen-lauf', text: [d.telefon && `Handy ${d.telefon}`, d.email && `E-Mail ${d.email}`].filter(Boolean).join(' · ') }),
      el('fieldset', { klasse: 'einwilligungen' }, el('legend', { klasse: 'zusagen-titel', text: 'Das bekommen Sie von uns' }), karten),
      gesperrt ? el('p', { klasse: 'zusagen-fuss', text: 'Abgemeldet' + (d.gesperrt.sms ? ' per SMS' : '') + (d.gesperrt.sms && d.gesperrt.email ? ' und' : '') + (d.gesperrt.email ? ' per E-Mail' : '') + '. Bestätigungen zu Ihren eigenen Buchungen kommen weiter.' }) : null,
      el('div', { klasse: 'nachrichten-wege' },
        el('button', { type: 'button', klasse: 'knopf-still', text: 'Alles abbestellen', onclick: () => speichern({ alle: true }, 'Erledigt. Sie bekommen nichts mehr von uns außer Bestätigungen zu Buchungen, die Sie selbst machen.') }),
        el('a', { klasse: 'knopf-still', href: 'termin.html', text: 'Termin buchen' })),
      el('p', { klasse: 'zusagen-fuss', text: 'Jede Änderung gilt sofort und wird mit Datum festgehalten. Ihre Nummer geben wir nicht weiter.' })].filter(Boolean));
  }
  async function speichern(post, meldung) {
    for (const i of box.querySelectorAll('input, button')) i.disabled = true;
    try { zeichnen(await api('abbestellen', { post: { k, ...post } }), meldung); }
    catch (e) { for (const i of box.querySelectorAll('input, button')) i.disabled = false; $('hinweis')?.remove(); box.prepend(el('p', { klasse: 'fehler', role: 'alert', text: e.message })); }
  }

  async function start() {
    const b = params.get('b');
    if (b) {
      try {
        const r = await api('bestaetigen', { post: { b } });
        history.replaceState(null, '', 'nachrichten.html?k=' + r.k);
        zeichnen(await api('kundin_nachrichten', { get: { k: r.k } }), 'Danke, bestätigt. Höchstens einmal im Monat kommt etwas von uns. Mit STOP hören wir sofort auf.');
      } catch (e) { $('hinweis').textContent = e.message; }
      return;
    }
    if (!k) return;
    try { zeichnen(await api('kundin_nachrichten', { get: { k } })); }
    catch (e) { $('hinweis').textContent = e.message; }
  }
  start();
})();

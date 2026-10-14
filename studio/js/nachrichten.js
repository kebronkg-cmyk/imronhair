/* ═══════════════════════════════════════════════════════════════════════
   Nachrichten: Postausgang, Recall, Warteliste, Kampagne, Vorlagen

   Alles, was das System von selbst schickt, steht hier — mit Status,
   Kosten und dem genauen Text. Nichts geht still raus: Wer wissen will,
   warum eine Kundin eine SMS bekommen hat, findet sie im Postausgang.
   ═══════════════════════════════════════════════════════════════════════ */

import { $, el, fuellen, svg, ZEICHEN, euro, tagText, heute, plusTage, meldung, fragen, spaeter } from './hilfen.js';
import { Z, api, inhaberin, salonVon, personVon } from './api.js';
import { tafelAuf, tafelZu } from './tafel.js';
import { kundeZeigen } from './kunden.js';

const REITER = [['post', 'Postausgang'], ['recall', 'Recall'], ['warteliste', 'Warteliste'], ['kampagne', 'Kampagne', true], ['vorlagen', 'Vorlagen', true]];
const STATUS = { wartet: 'wartet', sendet: 'wird gesendet', gesendet: 'gesendet', fehler: 'Fehler', gesperrt: 'abgemeldet (STOP)', zurueckgezogen: 'Einwilligung zurückgenommen', ueberholt: 'nicht mehr nötig' };
const KANAL = { sms: 'SMS', email: 'E-Mail', whatsapp: 'WhatsApp' };
const TAGESZEIT = { egal: 'egal wann', vormittag: 'vormittags', mittag: 'mittags', nachmittag: 'nachmittags', abend: 'ab 17 Uhr' };
const kurzZeit = (z) => z ? `${tagText(z.slice(0, 10), 'zahl').slice(0, 6)} ${z.slice(11, 16)}` : '';
let reiter = 'post';
let flaeche = null;

export function zeigen(f, teile = []) {
  flaeche = f;
  const erlaubt = REITER.filter(([, , nurChefin]) => !nurChefin || inhaberin());
  if (teile[0] && erlaubt.some(([id]) => id === teile[0])) reiter = teile[0];
  if (!erlaubt.some(([id]) => id === reiter)) reiter = 'post';
  fuellen(f, el('div', { klasse: 'seite' },
    el('div', { klasse: 'seiten-kopf' }, el('h1', { klasse: 'seiten-titel', text: 'Nachrichten' }),
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Fälliges jetzt senden', onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { const r = await api('warteschlange_senden', { post: {} }); meldung(`${r.gesendet} gesendet${r.fehler ? `, ${r.fehler} mit Fehler` : ''}`, r.fehler ? 'fehler' : 'ok'); neuLaden(); }
        finally { e.currentTarget.disabled = false; }
      } })),
    el('div', { id: 'n-stand' }),
    el('div', { klasse: 'schalter schalter-umbruch', role: 'tablist', 'aria-label': 'Nachrichten' }, erlaubt.map(([id, name]) => el('button', {
      type: 'button', role: 'tab', 'aria-pressed': String(id === reiter), 'aria-selected': String(id === reiter), text: name,
      onclick: () => { location.hash = '#nachrichten/' + id; } }))),
    el('div', { id: 'n-inhalt', klasse: 'n-inhalt' }, el('p', { klasse: 'leer', text: 'Wird geladen …' }))));
  neuLaden();
}

export function neuLaden() {
  if (flaeche?.dataset.bereich !== 'nachrichten') return;
  standZeigen();
  ({ post: postausgang, recall: recallZeigen, warteliste: wartelisteZeigen, kampagne: kampagneZeigen, vorlagen: vorlagenZeigen })[reiter]?.();
}

/* ── Kanäle und Zahlen des Monats ───────────────────────────────────── */
async function standZeigen() {
  const r = await api('nachrichten_stand');
  const box = $('n-stand');
  if (!box) return;
  const k = r.kanaele;
  const weg = (name, x, extra) => el('span', { klasse: 'kanal' + (x.aktiv ? ' ist-an' : '') },
    el('span', { klasse: 'punkt', 'aria-hidden': 'true' }), `${name}: ${x.aktiv ? (x.vorfuehrung ? 'Vorführung (nichts geht raus)' : 'eingerichtet') : 'aus'}`, extra || '');
  let gesendet = 0, teile = 0, kosten = 0;
  for (const z of r.monat) if (z.status === 'gesendet') { gesendet += z.n; if (z.kanal === 'sms') teile += z.teile; kosten += z.kosten_cent; }
  fuellen(box, 
    el('p', { klasse: 'kanaele' }, weg('E-Mail', k.email, k.email.absender ? ` · ${k.email.absender}` : ''), weg('SMS', k.sms, k.sms.aktiv ? ` · Absender ${k.sms.absender}` : ''), weg('WhatsApp', k.whatsapp)),
    k.sms.aktiv && !k.sms.stop ? el('p', { klasse: 'hinweis-zeile ist-faellig', text: 'Achtung: Antworten mit STOP kommen so nicht an — der SMS-Absender ist ein Name statt einer Nummer, oder der Eingang beim Anbieter fehlt (siehe BUCHUNG.md, „SMS einrichten“). Abmelden geht dann nur über den Link oder im Salon.' }) : null,
    !k.sms.aktiv && !k.whatsapp.aktiv ? el('p', { klasse: 'seiten-info', text: 'SMS ist noch nicht eingerichtet: Erinnerungen und Recall gehen bis dahin per E-Mail (wo eine Adresse da ist). Einrichten in api/config.php → sms.' }) : null,
    el('dl', { klasse: 'kacheln kacheln-klein' },
      kachel('Gesendet im Monat', String(gesendet)),
      kachel('SMS-Teile', String(teile), kosten ? 'Kosten ' + euro(kosten) : `geschätzt ${euro(teile * r.sms_preis_cent)}`),
      kachel('Wartet', String(r.wartet), r.wartet ? 'Ruhezeit oder nächster Lauf' : null),
      kachel('Fehler (7 Tage)', String(r.fehler), null, r.fehler > 0),
      kachel('Warteliste', String(r.warteliste), 'aktive Einträge'),
      kachel('Abgemeldet', String(r.stop_monat), 'in diesem Monat')));
}
const kachel = (titel, wert, unter, warnung) => el('div', { klasse: 'kachel' + (warnung ? ' ist-warnung' : '') }, el('dt', { text: titel }), el('dd', { text: wert }), unter ? el('p', { klasse: 'kachel-unter', text: unter }) : null);

/* ── Postausgang ─────────────────────────────────────────────────────── */
let postFilter = '';
async function postausgang() {
  const box = $('n-inhalt');
  const r = await api('nachrichten_liste', { get: { status: postFilter } });
  if (reiter !== 'post' || !$('n-inhalt')) return;
  fuellen(box, 
    el('div', { klasse: 'schalter schalter-klein schalter-umbruch', role: 'group', 'aria-label': 'Status' },
      [['', 'Alle'], ['wartet', 'Wartet'], ['gesendet', 'Gesendet'], ['fehler', 'Fehler'], ['gesperrt', 'Abgemeldet']].map(([id, name]) => el('button', {
        type: 'button', 'aria-pressed': String(id === postFilter), text: name, onclick: () => { postFilter = id; postausgang(); } }))),
    r.nachrichten.length ? el('ul', { klasse: 'verlauf-liste n-liste' }, r.nachrichten.map(nachrichtZeile))
      : el('p', { klasse: 'leer', text: 'Noch keine Nachrichten.' }));
}
export function nachrichtZeile(n) {
  return el('li', {}, el('button', { type: 'button', klasse: `verlauf-zeile n-zeile ist-${n.status}`, onclick: () => nachrichtZeigen(n) },
    el('span', { klasse: 'zahl', text: kurzZeit(n.status === 'wartet' ? n.nicht_vor : n.zeit) }),
    el('span', { text: `${n.zweck_name} · ${n.kunde || n.an}` }),
    el('span', { klasse: 'verlauf-wer', text: KANAL[n.kanal] + (n.kanal === 'sms' && n.teile > 1 ? ` (${n.teile})` : '') }),
    el('span', { klasse: 'n-status', text: STATUS[n.status] || n.status })));
}
function nachrichtZeigen(n) {
  const koerper = tafelAuf({ titel: n.zweck_name, unter: `${KANAL[n.kanal]} an ${n.an}` });
  fuellen(koerper, 
    el('dl', { klasse: 'kennzahlen' },
      el('div', {}, el('dt', { text: 'Status' }), el('dd', { klasse: 'n-klein', text: STATUS[n.status] || n.status })),
      el('div', {}, el('dt', { text: n.status === 'wartet' ? 'Geht raus' : 'Zeit' }), el('dd', { klasse: 'n-klein', text: kurzZeit(n.status === 'wartet' ? n.nicht_vor : n.zeit) })),
      el('div', {}, el('dt', { text: 'Teile' }), el('dd', { klasse: 'n-klein', text: String(n.teile) })),
      el('div', {}, el('dt', { text: 'Kosten' }), el('dd', { klasse: 'n-klein', text: n.kosten_cent === null ? '—' : euro(n.kosten_cent) }))),
    n.fehler ? el('p', { klasse: 'hinweis-zeile ist-faellig', text: `${n.fehler} (Versuche: ${n.versuche})` }) : null,
    n.betreff ? el('p', { klasse: 'form-titel', text: n.betreff }) : null,
    el('p', { klasse: n.kanal === 'email' ? 'n-text' : 'n-text sms-blase', text: n.text }),
    el('div', { klasse: 'tafel-wege' },
      n.kunde_id ? el('button', { type: 'button', klasse: 'knopf-still', text: 'Zur Kundin', onclick: () => kundeZeigen(n.kunde_id) }) : null,
      n.status === 'fehler' ? el('button', { type: 'button', klasse: 'knopf', text: 'Noch einmal senden', onclick: async () => {
        const r = await api('nachricht_wiederholen', { post: { id: n.id } });
        meldung(r.gesendet ? 'Gesendet' : 'Wieder nicht angekommen', r.gesendet ? 'ok' : 'fehler'); tafelZu(); neuLaden();
      } }) : null));
}

/* ── Recall ──────────────────────────────────────────────────────────── */
const RECALL_STATUS = { offen: 'läuft', gebucht: 'zurückgeholt', ohne_antwort: 'keine Antwort' };
async function recallZeigen() {
  const box = $('n-inhalt');
  const r = await api('recall_liste');
  if (reiter !== 'recall' || !$('n-inhalt')) return;
  const m = r.monat;
  const zeile = (x) => el('li', {}, el('button', { type: 'button', klasse: 'verlauf-zeile', onclick: () => kundeZeigen(x.kunde_id) },
    el('span', { klasse: 'zahl', text: tagText(x.faellig, 'zahl') }),
    el('span', { text: x.kunde }),
    el('span', { klasse: 'verlauf-wer', text: x.letzter ? `zuletzt ${tagText(x.letzter, 'zahl')}` : '' }),
    el('span', { klasse: 'n-status', text: x.status ? (RECALL_STATUS[x.status] || x.status) + (x.zweite ? ' · nachgefragt' : '') : (x.kanal ? KANAL[x.kanal] : 'nicht erreichbar') })));
  fuellen(box, 
    el('p', { klasse: 'seiten-info', text: r.aktiv
      ? `Einmal am Tag (ab 9 Uhr) bekommt, wer fällig ist und nichts gebucht hat, eine Nachricht mit ihrer Auswahl von damals — nach ${r.nachfass} Tagen eine einzige Nachfrage, dann ist Schluss. Nur mit Einwilligung, nie nachts oder sonntags.`
      : 'Recall ist ausgeschaltet (Einstellungen → Nachrichten).' }),
    el('dl', { klasse: 'kacheln kacheln-klein' },
      kachel('Mit Einwilligung', String(r.mit_einwilligung)),
      kachel('Fällig, ohne Einwilligung', String(r.ohne_einwilligung), 'beim nächsten Besuch fragen'),
      kachel('Gesendet im Monat', String(m.gesendet), m.nachfass ? `${m.nachfass} Nachfragen` : null),
      kachel('Zurückgeholt', String(m.zurueckgeholt), m.umsatz_cent ? euro(m.umsatz_cent) + ' Umsatz' : null),
      m.abrechnung_cent ? kachel('Abrechnung Recall', euro(m.abrechnung_cent), 'diesen Monat') : null),
    inhaberin() ? el('div', { klasse: 'tafel-wege' }, el('button', { type: 'button', klasse: 'knopf-still', text: 'Jetzt prüfen und senden', onclick: async (e) => {
      if (!await fragen({ titel: 'Recall jetzt senden?', text: 'Wer heute fällig ist, bekommt die Nachricht — tagsüber sofort, sonst ab 9 Uhr. Das passiert sonst ohnehin einmal am Tag.', ja: 'Senden' })) return;
      e.currentTarget.disabled = true;
      const x = await api('recall_starten', { post: {} });
      meldung(`${x.erste} Erinnerungen, ${x.nachfass} Nachfragen`, 'ok'); neuLaden();
    } })) : null,
    el('h3', { klasse: 'form-titel', text: 'Bald fällig (14 Tage)' }),
    r.bald.length ? el('ul', { klasse: 'verlauf-liste' }, r.bald.map(zeile)) : el('p', { klasse: 'leer', text: 'Niemand mit Einwilligung in den nächsten zwei Wochen.' }),
    el('h3', { klasse: 'form-titel', text: 'Gesendet (90 Tage)' }),
    r.laufend.length ? el('ul', { klasse: 'verlauf-liste' }, r.laufend.map(zeile)) : el('p', { klasse: 'leer', text: 'Noch nichts gesendet.' }));
}

/* ── Warteliste ──────────────────────────────────────────────────────── */
async function wartelisteZeigen() {
  const box = $('n-inhalt');
  const r = await api('warteliste_liste');
  if (reiter !== 'warteliste' || !$('n-inhalt')) return;
  const aktiv = r.eintraege.filter((e) => e.status === 'aktiv');
  const sonst = r.eintraege.filter((e) => e.status !== 'aktiv');
  const zeile = (e) => el('li', {}, el('button', { type: 'button', klasse: 'verlauf-zeile wl-zeile', onclick: () => eintragZeigen(e) },
    el('span', { klasse: 'zahl', text: e.von === e.bis ? tagText(e.von, 'zahl').slice(0, 6) : `${tagText(e.von, 'zahl').slice(0, 6)}–${tagText(e.bis, 'zahl').slice(0, 6)}` }),
    el('span', { text: `${e.name} · ${e.leistungen_namen.join(' + ')}` }),
    el('span', { klasse: 'verlauf-wer', text: `${salonVon(e.salon)?.name || e.salon}${e.person ? ' · ' + (personVon(e.person)?.name || '') : ''} · ${TAGESZEIT[e.tageszeit]}` }),
    el('span', { klasse: 'n-status', text: e.status === 'aktiv' ? (e.angebote.length ? `${e.angebote.length} Angebot${e.angebote.length > 1 ? 'e' : ''}` : 'wartet') : { gebucht: 'gebucht', abgelaufen: 'abgelaufen', entfernt: 'entfernt' }[e.status] || e.status })));
  fuellen(box, 
    el('p', { klasse: 'seiten-info', text: r.aktiv
      ? 'Wird ein passender Platz frei (Absage, Verschieben, gelöschte Sperre), bekommen bis zu drei Wartende sofort eine Nachricht mit Link. Wer zuerst tippt, bekommt den Platz; für die anderen verfällt der Link.'
      : 'Die Warteliste ist ausgeschaltet (Einstellungen → Nachrichten).' }),
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf', onclick: eintragNeu }, svg(ZEICHEN.plus), el('span', { text: 'Eintragen' })),
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Freie Plätze jetzt anbieten', onclick: async () => {
        const x = await api('warteliste_abgleichen', { post: {} }); meldung(`${x.angebote} Angebote verschickt`, 'ok'); neuLaden();
      } })),
    el('h3', { klasse: 'form-titel', text: `Wartet (${aktiv.length})` }),
    aktiv.length ? el('ul', { klasse: 'verlauf-liste' }, aktiv.map(zeile)) : el('p', { klasse: 'leer', text: 'Niemand auf der Warteliste.' }),
    sonst.length ? el('h3', { klasse: 'form-titel', text: 'Erledigt (30 Tage)' }) : null,
    sonst.length ? el('ul', { klasse: 'verlauf-liste' }, sonst.map(zeile)) : null);
}
function eintragZeigen(e) {
  const koerper = tafelAuf({ titel: e.name, unter: 'Warteliste' });
  fuellen(koerper, 
    el('p', { text: `${e.leistungen_namen.join(' + ')} · Salon ${salonVon(e.salon)?.name}${e.person ? ' · bei ' + personVon(e.person)?.name : ''}` }),
    el('p', { klasse: 'seiten-info', text: `Zeitraum ${tagText(e.von, 'zahl')} bis ${tagText(e.bis, 'zahl')}, ${TAGESZEIT[e.tageszeit]} · eingetragen ${kurzZeit(e.erstellt)} (${e.quelle === 'online' ? 'online' : 'im Studio'})` }),
    e.notiz ? el('p', { klasse: 'kartei-notiz', text: e.notiz }) : null,
    e.angebote.length ? el('ul', { klasse: 'verlauf-liste' }, e.angebote.map((a) => el('li', { klasse: 'verlauf-zeile', text: `Angebot ${kurzZeit(a.start)} · ${({ offen: 'offen', angenommen: 'angenommen', vergeben: 'jemand war schneller', abgelaufen: 'abgelaufen', ueberholt: 'überholt', zurueckgezogen: 'zurückgezogen' })[a.status] || a.status}` }))) : null,
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Zur Kundin', onclick: () => kundeZeigen(e.kunde_id) }),
      e.status === 'aktiv' ? el('button', { type: 'button', klasse: 'knopf-still knopf-leise', text: 'Entfernen', onclick: async () => {
        await api('warteliste_entfernen', { post: { id: e.id } }); meldung('Entfernt', 'ok'); tafelZu(); neuLaden();
      } }) : null));
}
export function eintragNeu(vorgabe = {}) {
  const koerper = tafelAuf({ titel: 'Auf die Warteliste', unter: 'am Telefon oder an der Theke' });
  const f = { salon: vorgabe.salon || Z.salon, leistung: vorgabe.leistung || '', person: '', von: heute(), bis: plusTage(heute(), 13), tageszeit: 'egal',
    name: vorgabe.name || '', telefon: vorgabe.telefon || '', notiz: '', einverstanden: false };
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  const feld = (name, text, attr = {}) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }),
    el('input', { value: f[name], name, oninput: (e) => { f[name] = e.target.value; }, ...attr }));
  const leistungWahl = el('select', { name: 'leistung', onchange: (e) => { f.leistung = e.target.value; } });
  const fuellen = () => fuellen(leistungWahl, el('option', { value: '', text: 'Leistung wählen …' }),
    ...Z.s.gruppen.map((g) => { const ls = Z.s.leistungen.filter((l) => l.salon === f.salon && l.gruppe === g.id && l.aktiv); return ls.length ? el('optgroup', { label: g.name }, ls.map((l) => el('option', { value: l.id, selected: l.id === f.leistung ? true : null, text: l.name + (l.laenge ? ' · ' + l.laenge : '') }))) : null; }));
  fuellen();
  fuellen(koerper, 
    el('div', { klasse: 'feld-reihe' }, feld('name', 'Name', { autocomplete: 'off' }), feld('telefon', 'Handy', { type: 'tel', inputmode: 'tel', autocomplete: 'off' })),
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Salon' }),
        el('select', { onchange: (e) => { f.salon = e.target.value; f.leistung = ''; fuellen(); } }, Z.s.salons.map((s) => el('option', { value: s.id, text: s.name, selected: s.id === f.salon ? true : null })))),
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Leistung' }), leistungWahl)),
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Bei' }),
        el('select', { onchange: (e) => { f.person = e.target.value; } }, el('option', { value: '', text: 'egal' }), Z.s.personen.filter((p) => p.aktiv).map((p) => el('option', { value: p.id, text: p.name })))),
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Tageszeit' }),
        el('select', { onchange: (e) => { f.tageszeit = e.target.value; } }, Object.entries(TAGESZEIT).map(([id, t]) => el('option', { value: id, text: t }))))),
    el('div', { klasse: 'feld-reihe' }, feld('von', 'Frühestens', { type: 'date', min: heute() }), feld('bis', 'Spätestens', { type: 'date', min: heute() })),
    feld('notiz', 'Notiz (nur intern)', { maxlength: 255 }),
    el('label', { klasse: 'haken' }, el('input', { type: 'checkbox', name: 'einverstanden', onchange: (e) => { f.einverstanden = e.target.checked; } }),
      el('span', { text: 'Die Kundin möchte per SMS (oder E-Mail) benachrichtigt werden, wenn etwas frei wird.' })),
    fehler,
    el('div', { klasse: 'tafel-wege' },
      el('button', { type: 'button', klasse: 'knopf-still', text: 'Abbrechen', onclick: tafelZu }),
      el('button', { type: 'button', klasse: 'knopf', text: 'Eintragen', onclick: async () => {
        fehler.hidden = true;
        if (!f.leistung) { fehler.textContent = 'Bitte eine Leistung wählen.'; fehler.hidden = false; return; }
        try {
          const r = await api('warteliste_speichern', { post: { salon: f.salon, leistungen: [f.leistung], person: f.person || null, von: f.von, bis: f.bis,
            tageszeit: f.tageszeit, notiz: f.notiz || null, einverstanden: f.einverstanden, kunde_id: vorgabe.kunde_id || null,
            kunde: vorgabe.kunde_id ? undefined : { name: f.name, telefon: f.telefon } } });
          meldung(`${r.name} steht auf der Warteliste`, 'ok'); tafelZu(); neuLaden();
        } catch (e) { fehler.textContent = e.message; fehler.hidden = false; koerper.querySelector(`[name="${e.daten.feld}"]`)?.focus(); }
      } })));
}

/* ── Kampagne ────────────────────────────────────────────────────────── */
const kampagne = { kanal: 'auto', salon: '', gruppe: '', seit_wochen: 0, betreff: 'Neuigkeiten von Irmonhair', text: 'Hallo {vorname}, ', titel: '' };
async function kampagneZeigen() {
  const box = $('n-inhalt');
  const vorschau = el('div', { klasse: 'k-vorschau', 'aria-live': 'polite' });
  let letzte = null;
  const rechnen = spaeter(async () => {
    try {
      letzte = await api('kampagne_vorschau', { post: kampagne });
      fuellen(vorschau, 
        el('dl', { klasse: 'kacheln kacheln-klein' },
          kachel('Empfängerinnen', String(letzte.anzahl), `${letzte.sms} per SMS, ${letzte.email} per E-Mail`),
          kachel('Ausgelassen', String(letzte.monat_schon + letzte.nicht_erreichbar), `${letzte.monat_schon} hatten diesen Monat schon eine, ${letzte.nicht_erreichbar} nicht erreichbar`),
          kachel('SMS-Teile', String(letzte.teile), `${letzte.zeichen} Zeichen`, letzte.teile > 1),
          kachel('Kosten', euro(letzte.kosten_cent), 'geschätzt')),
        el('p', { klasse: 'seiten-info', text: `Nur an Kundinnen, die Angeboten zugestimmt und das bestätigt haben (${letzte.mit_einwilligung}). Geht raus ab ${kurzZeit(letzte.naechste_sendezeit)} — nie nachts, nie sonntags.` }),
        el('p', { klasse: 'klein-titel', text: 'So kommt die SMS an' }), el('p', { klasse: 'n-text sms-blase', text: letzte.sms_text }));
      senden.textContent = letzte.anzahl ? `An ${letzte.anzahl} senden` : 'Niemand in dieser Auswahl';
      senden.disabled = !letzte.anzahl;
    } catch (e) { fuellen(vorschau, el('p', { klasse: 'form-fehler', text: e.message })); senden.disabled = true; }
  }, 350);
  const feld = (name, text, attr = {}) => el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text }),
    el(attr.mehrzeilig ? 'textarea' : 'input', { value: kampagne[name], oninput: (e) => { kampagne[name] = attr.type === 'number' ? +e.target.value : e.target.value; rechnen(); }, ...attr, mehrzeilig: null }));
  const testAn = el('input', { type: 'text', placeholder: 'Ihre Handynummer oder E-Mail', autocomplete: 'off' });
  const senden = el('button', { type: 'button', klasse: 'knopf', text: 'Senden', disabled: true, onclick: async () => {
    if (!letzte?.anzahl) return;
    if (!await fragen({ titel: `An ${letzte.anzahl} Kundinnen senden?`, text: `${letzte.sms} SMS und ${letzte.email} E-Mails, ab ${kurzZeit(letzte.naechste_sendezeit)}. Geschätzte Kosten ${euro(letzte.kosten_cent)}. Jede Nachricht endet mit „Abmelden: STOP“ bzw. einem Abmeldelink.`, ja: 'Senden' })) return;
    try { const r = await api('kampagne_senden', { post: { ...kampagne, anzahl: letzte.anzahl } }); meldung(`${r.anzahl} eingereiht`, 'ok'); kampagneZeigen(); }
    catch (e) { meldung(e.message, 'fehler'); rechnen(); }
  } });
  const liste = el('ul', { klasse: 'verlauf-liste' });
  fuellen(box, 
    el('p', { klasse: 'seiten-info', text: 'Eine Nachricht an viele — etwa „15 % auf Olaplex im November“. Platzhalter: {vorname} und {link} (Buchungsseite; Buchungen darüber werden der Kampagne zugerechnet).' }),
    el('div', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Weg' }), el('div', { klasse: 'schalter schalter-klein', role: 'group', 'aria-label': 'Weg' },
      [['auto', 'SMS, sonst E-Mail'], ['sms', 'Nur SMS'], ['email', 'Nur E-Mail']].map(([id, name]) => el('button', { type: 'button', 'aria-pressed': String(kampagne.kanal === id), text: name,
        onclick: (e) => { kampagne.kanal = id; for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); rechnen(); } })))),
    el('div', { klasse: 'feld-reihe' },
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Salon' }), el('select', { onchange: (e) => { kampagne.salon = e.target.value; rechnen(); } },
        el('option', { value: '', text: 'Beide' }), Z.s.salons.map((s) => el('option', { value: s.id, text: s.name, selected: s.id === kampagne.salon ? true : null })))),
      el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'War schon einmal da für' }), el('select', { onchange: (e) => { kampagne.gruppe = e.target.value; rechnen(); } },
        el('option', { value: '', text: 'egal' }), Z.s.gruppen.map((g) => el('option', { value: g.id, text: g.name, selected: g.id === kampagne.gruppe ? true : null })))),
      feld('seit_wochen', 'Nicht da seit Wochen (0 = alle)', { type: 'number', min: 0, max: 104, inputmode: 'numeric' })),
    feld('betreff', 'Betreff (E-Mail)', { maxlength: 160 }),
    feld('text', 'Text', { mehrzeilig: true, rows: 4, maxlength: 1200 }),
    vorschau,
    el('div', { klasse: 'feld-reihe' }, el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name', text: 'Erst an mich (Test)' }), testAn),
      el('div', { klasse: 'feld k-test' }, el('button', { type: 'button', klasse: 'knopf-still', text: 'Test senden', onclick: async () => {
        try { const r = await api('kampagne_test', { post: { ...kampagne, an: testAn.value } }); meldung(r.gesendet ? 'Test gesendet' : 'Test nicht angekommen', r.gesendet ? 'ok' : 'fehler'); }
        catch (e) { meldung(e.message, 'fehler'); }
      } }))),
    el('div', { klasse: 'tafel-wege' }, senden),
    el('h3', { klasse: 'form-titel', text: 'Bisherige Kampagnen' }), liste);
  rechnen();
  const r = await api('kampagnen');
  fuellen(liste, ...(r.kampagnen.length ? r.kampagnen.map((k) => el('li', { klasse: 'verlauf-zeile', title: k.text },
    el('span', { klasse: 'zahl', text: kurzZeit(k.erstellt) }), el('span', { text: k.titel }),
    el('span', { klasse: 'verlauf-wer', text: `${k.gesendet} von ${k.anzahl} gesendet${k.wartet ? `, ${k.wartet} warten` : ''}` }),
    el('span', { klasse: 'n-status', text: `${k.gebucht} gebucht` }))) : [el('li', { klasse: 'leer', text: 'Noch keine.' })]));
}

/* ── Vorlagen ────────────────────────────────────────────────────────── */
const VORLAGE_NAME = {
  erinnerung_sms: 'Erinnerung am Vortag · SMS', erinnerung_email_betreff: 'Erinnerung · E-Mail-Betreff', erinnerung_email: 'Erinnerung · E-Mail',
  recall_sms: 'Recall · SMS', recall_email_betreff: 'Recall · E-Mail-Betreff', recall_email: 'Recall · E-Mail',
  nachfass_sms: 'Recall-Nachfrage · SMS', nachfass_email_betreff: 'Recall-Nachfrage · Betreff', nachfass_email: 'Recall-Nachfrage · E-Mail',
  warteliste_sms: 'Warteliste · SMS', warteliste_email_betreff: 'Warteliste · Betreff', warteliste_email: 'Warteliste · E-Mail',
  doi_email_betreff: 'Bestätigung Angebote · Betreff', doi_email: 'Bestätigung Angebote · E-Mail', doi_sms: 'Bestätigung Angebote · SMS',
};
/** Ungefähre SMS-Länge mit eingesetztem Link (rund 80 Zeichen). */
const smsLaenge = (t) => t.replace(/\{link\}/g, 'x'.repeat(80)).replace(/\{vorname\}/g, 'Annette').replace(/\{person\}/g, 'Bedia').replace(/\{adresse\}/g, 'Irmonherstr. 7').replace(/\{[a-z_]+\}/g, 'xxxxxxxx').length;
async function vorlagenZeigen() {
  const box = $('n-inhalt');
  const r = await api('vorlagen');
  if (reiter !== 'vorlagen' || !$('n-inhalt')) return;
  const werte = {};
  const fehler = el('p', { klasse: 'form-fehler', role: 'alert', hidden: true });
  fuellen(box, 
    el('p', { klasse: 'seiten-info', text: 'Platzhalter in geschweiften Klammern werden eingesetzt ({vorname}, {zeit}, {person}, {link} …). SMS ohne Gedankenstriche und „typografische“ Anführungszeichen schreiben — sonst passen nur 70 statt 160 Zeichen in eine SMS. Werbende SMS bekommen „Abmelden: STOP“ automatisch angehängt.' }),
    ...r.vorlagen.map((v) => {
      werte[v.name] = v.eigen ?? v.vorgabe;
      const sms = v.name.endsWith('_sms');
      const zaehler = el('span', { klasse: 'feld-zusatz' });
      const zaehlen = () => { if (sms) { const n = smsLaenge(werte[v.name]); zaehler.textContent = `≈ ${n} Zeichen${n > 160 ? ' — zwei SMS' : ''}`; zaehler.classList.toggle('ist-warnung', n > 160); } };
      const ta = el(v.name.endsWith('betreff') ? 'input' : 'textarea', { name: v.name, value: werte[v.name], rows: sms ? 3 : 6, oninput: (e) => { werte[v.name] = e.target.value; zaehlen(); } });
      zaehlen();
      return el('label', { klasse: 'feld' }, el('span', { klasse: 'feld-name' }, VORLAGE_NAME[v.name] || v.name, v.eigen ? el('span', { klasse: 'marke', text: 'eigen' }) : null, ' ', zaehler), ta,
        v.eigen ? el('button', { type: 'button', klasse: 'text-link', text: 'Vorgabe wiederherstellen', onclick: () => { ta.value = v.vorgabe; werte[v.name] = v.vorgabe; zaehlen(); } }) : null);
    }),
    fehler,
    el('div', { klasse: 'tafel-wege' }, el('button', { type: 'button', klasse: 'knopf', text: 'Vorlagen speichern', onclick: async () => {
      fehler.hidden = true;
      try { await api('vorlagen_speichern', { post: { vorlagen: werte } }); meldung('Gespeichert', 'ok'); vorlagenZeigen(); }
      catch (e) { fehler.textContent = e.message; fehler.hidden = false; box.querySelector(`[name="${e.daten.feld}"]`)?.focus(); }
    } })));
}


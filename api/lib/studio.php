<?php
/* Aktionen des Studios (Verwaltung). Anmeldung mit Name und Passwort;
   die Sitzung ist ein Zufallsschlüssel im Cookie (HttpOnly, SameSite=Strict),
   in der Datenbank nur als SHA-256. Jede schreibende Aktion braucht dazu
   den CSRF-Schlüssel der Sitzung im Kopf „X-CSRF“. */

declare(strict_types=1);

const COOKIE = 'ih_studio';
const ROLLEN = ['inhaberin', 'team'];

function cookie_setzen(string $wert, int $ablauf): void
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    setcookie(COOKIE, $wert, ['expires' => $ablauf, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
}

function sitzung_anlegen(array $person, bool $merken): array
{
    $token = zufall(32);
    $csrf = zufall(16);
    $dauer = $merken ? 30 * 86400 : 12 * 3600;
    db()->einfuegen('sitzung', [
        'token_hash' => hash('sha256', $token), 'person_id' => $person['id'], 'csrf' => $csrf,
        'erstellt' => jetzt(), 'zuletzt' => jetzt(), 'ablauf' => date('Y-m-d H:i:s', time() + $dauer),
        'ip' => ip(), 'geraet' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
    ]);
    cookie_setzen($token, $merken ? time() + $dauer : 0);
    return ['csrf' => $csrf];
}

/** Angemeldete Person oder null. Setzt $GLOBALS['ANGEMELDET']. */
function angemeldet(): ?array
{
    $token = $_COOKIE[COOKIE] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    $db = db();
    $s = $db->eins('SELECT s.*, p.name, p.rolle, p.aktiv FROM {p}sitzung s JOIN {p}person p ON p.id = s.person_id WHERE s.token_hash = ?', [hash('sha256', $token)]);
    if (!$s || $s['ablauf'] < jetzt() || !$s['aktiv']) return null;
    if (strtotime($s['zuletzt']) < time() - 300) {
        $db->aendern('sitzung', ['zuletzt' => jetzt()], 'token_hash = ?', [$s['token_hash']]);
    }
    $GLOBALS['ANGEMELDET'] = ['id' => $s['person_id'], 'name' => $s['name'], 'rolle' => $s['rolle'], 'csrf' => $s['csrf'], 'token_hash' => $s['token_hash']];
    return $GLOBALS['ANGEMELDET'];
}

function anmeldung_pflicht(bool $schreibend, bool $inhaberin = false): array
{
    $a = angemeldet();
    if (!$a) throw new Fehler('Bitte neu anmelden.', 401, 'abgemeldet');
    if ($schreibend) {
        methode('POST');
        if (!hash_equals($a['csrf'], (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) throw new Fehler('Sitzung abgelaufen, bitte Seite neu laden.', 403, 'csrf');
    }
    if ($inhaberin && $a['rolle'] !== 'inhaberin') throw new Fehler('Das darf nur die Inhaberin.', 403, 'rolle');
    return $a;
}

/* ── Anmeldung ───────────────────────────────────────────────────── */

function aktion_studio_status(): array
{
    $db = db();
    $eingerichtet = (bool)$db->wert("SELECT COUNT(*) FROM {p}person WHERE rolle = 'inhaberin' AND pass_hash IS NOT NULL");
    $a = angemeldet();
    $aus = ['eingerichtet' => $eingerichtet, 'angemeldet' => null];
    if (!$eingerichtet) {
        $aus['personen'] = $db->alle('SELECT id, name FROM {p}person WHERE aktiv = 1 ORDER BY sort');
    }
    if ($a) {
        $aus['angemeldet'] = ['id' => $a['id'], 'name' => $a['name'], 'rolle' => $a['rolle']];
        $aus['csrf'] = $a['csrf'];
        $aus['stammdaten'] = stammdaten();
    }
    return $aus;
}

function stammdaten(): array
{
    $db = db();
    $salons = [];
    foreach ($db->alle('SELECT * FROM {p}salon WHERE aktiv = 1 ORDER BY sort') as $s) {
        $s['oeffnung'] = json_decode((string)$s['oeffnung'], true);
        $s['lat'] = (float)$s['lat']; $s['lon'] = (float)$s['lon'];
        $salons[] = $s;
    }
    $personen = $db->alle('SELECT id, name, farbe, rolle, aktiv, online, sort FROM {p}person ORDER BY sort, name');
    $salonsJe = [];
    foreach ($db->alle('SELECT DISTINCT person_id, salon_id FROM {p}arbeitszeit') as $z) $salonsJe[$z['person_id']][] = $z['salon_id'];
    foreach ($personen as &$p) {
        $p['farbe'] = (int)$p['farbe']; $p['aktiv'] = (bool)$p['aktiv']; $p['online'] = (bool)$p['online']; $p['sort'] = (int)$p['sort'];
        $p['salons'] = $salonsJe[$p['id']] ?? [];
    }
    unset($p);
    $zuordnung = [];
    foreach ($db->alle('SELECT leistung_id, person_id FROM {p}leistung_person') as $z) $zuordnung[$z['leistung_id']][] = $z['person_id'];
    $leistungen = [];
    foreach ($db->alle('SELECT * FROM {p}leistung ORDER BY sort') as $l) {
        $leistungen[] = [
            'id' => $l['id'], 'salon' => $l['salon_id'], 'gruppe' => $l['gruppe'], 'familie' => $l['familie'],
            'name' => $l['name'], 'zusatz' => $l['zusatz'], 'laenge' => $l['laenge'], 'phasen' => json_decode($l['phasen'], true),
            'preis_cent' => $l['preis_cent'] === null ? null : (int)$l['preis_cent'], 'preis_ab' => (bool)$l['preis_ab'],
            'preis_text' => $l['preis_text'], 'online' => (bool)$l['online'], 'aktiv' => (bool)$l['aktiv'],
            'zusatzleistung' => (bool)$l['zusatzleistung'], 'sort' => (int)$l['sort'], 'personen' => $zuordnung[$l['id']] ?? [],
        ];
    }
    return [
        'salons' => $salons, 'personen' => $personen, 'leistungen' => $leistungen,
        'gruppen' => json_decode((string)$db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'gruppen'"), true),
        'einstellungen' => einstellungen(), 'heute' => date('Y-m-d'),
        'stand' => (int)$db->wert("SELECT wert FROM {p}zaehler WHERE name = 'stand'"),
    ];
}

function passwort_pruefen(string $pw): void
{
    if (mb_strlen($pw) < 10) throw new Fehler('Das Passwort braucht mindestens 10 Zeichen.', 422, 'passwort', ['feld' => 'passwort']);
}

function aktion_einrichten(): array
{
    methode('POST');
    bremse('einrichten', ip(), 10, 900);
    $db = db();
    if ($db->wert("SELECT COUNT(*) FROM {p}person WHERE rolle = 'inhaberin' AND pass_hash IS NOT NULL")) throw new Fehler('Schon eingerichtet.', 409);
    $soll = (string)konfig('einrichtungs_schluessel', '');
    if (strlen($soll) < 12 || !hash_equals($soll, (string)feld('schluessel', ''))) throw new Fehler('Der Einrichtungsschlüssel stimmt nicht (steht in api/config.php).', 403, 'schluessel', ['feld' => 'schluessel']);
    $person = text_feld('person', 32, true);
    $name = text_feld('anmeldename', 80, true);
    $pw = (string)feld('passwort', '');
    passwort_pruefen($pw);
    $p = $db->eins('SELECT * FROM {p}person WHERE id = ?', [$person]);
    if (!$p) throw new Fehler('Unbekannte Person.', 422);
    $db->schreiben(function (DB $db) use ($person, $name, $pw) {
        $db->aendern('person', ['rolle' => 'inhaberin', 'anmeldename' => mb_strtolower($name), 'pass_hash' => password_hash($pw, PASSWORD_DEFAULT), 'geaendert' => jetzt()], 'id = ?', [$person]);
        protokoll('eingerichtet', null, null, [], $person);
    });
    sitzung_anlegen($p, true);
    return ['ok' => true];
}

function aktion_anmelden(): array
{
    methode('POST');
    $name = mb_strtolower((string)text_feld('anmeldename', 80, true));
    $pw = (string)feld('passwort', '');
    bremse('anmelden', ip(), 30, 900);
    bremse('anmelden-name', $name, 8, 900);
    $p = db()->eins('SELECT * FROM {p}person WHERE anmeldename = ? AND aktiv = 1', [$name]);
    // Auch ohne Treffer rechnen, damit die Antwortzeit nichts verrät.
    $hash = $p['pass_hash'] ?? '$2y$12$0p/Avk43Omh5KrQNODyM0.0hBLtmLhmuW2sgUT0/QKkxdIKHgXDeu';
    if (!password_verify($pw, $hash) || !$p) throw new Fehler('Name oder Passwort stimmt nicht.', 401, 'falsch');
    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) db()->aendern('person', ['pass_hash' => password_hash($pw, PASSWORD_DEFAULT)], 'id = ?', [$p['id']]);
    sitzung_anlegen($p, feld('merken') === true);
    protokoll('angemeldet', null, null, [], $p['id']);
    return ['ok' => true];
}

function aktion_abmelden(): array
{
    $a = angemeldet();
    if ($a) db()->q('DELETE FROM {p}sitzung WHERE token_hash = ?', [$a['token_hash']]);
    cookie_setzen('', time() - 3600);
    return ['ok' => true];
}

function aktion_passwort(): array
{
    $a = anmeldung_pflicht(true);
    $p = db()->eins('SELECT * FROM {p}person WHERE id = ?', [$a['id']]);
    if (!password_verify((string)feld('alt', ''), (string)$p['pass_hash'])) throw new Fehler('Das bisherige Passwort stimmt nicht.', 403, 'falsch', ['feld' => 'alt']);
    $neu = (string)feld('neu', '');
    passwort_pruefen($neu);
    db()->schreiben(function (DB $db) use ($a, $neu) {
        $db->aendern('person', ['pass_hash' => password_hash($neu, PASSWORD_DEFAULT)], 'id = ?', [$a['id']]);
        // Andere Geräte abmelden.
        $db->q('DELETE FROM {p}sitzung WHERE person_id = ? AND token_hash <> ?', [$a['id'], $a['token_hash']]);
        protokoll('passwort_geaendert');
    });
    return ['ok' => true];
}

/* ── Kalender ────────────────────────────────────────────────────── */

function aktion_stand(): array
{
    anmeldung_pflicht(false);
    return ['stand' => (int)db()->wert("SELECT wert FROM {p}zaehler WHERE name = 'stand'")];
}

function aktion_kalender(): array
{
    anmeldung_pflicht(false);
    $db = db();
    $salon = text_feld('salon', 32, true);
    $von = datum_pruefen((string)feld('von'));
    $bis = datum_pruefen((string)(feld('bis') ?? $von));
    if ($bis < $von || $bis > tag_plus($von, 41)) throw new Fehler('Zeitraum zu groß.', 422);
    $vonZ = "$von 00:00:00";
    $bisZ = tag_plus($bis, 1) . ' 00:00:00';
    $stand = (int)$db->wert("SELECT wert FROM {p}zaehler WHERE name = 'stand'");
    $termine = $db->alle("SELECT * FROM {p}termin WHERE salon_id = ? AND start < ? AND ende > ?" . (feld('storno') ? '' : " AND status <> 'storniert'") . ' ORDER BY start',
        [$salon, $bisZ, $vonZ]);
    // Termine derselben Personen im anderen Salon: nur als belegt zeigen.
    $woanders = $db->alle("SELECT t.id, t.person_id, t.start, t.ende, t.salon_id FROM {p}termin t
        WHERE t.salon_id <> ? AND t.status <> 'storniert' AND t.start < ? AND t.ende > ?
        AND t.person_id IN (SELECT DISTINCT person_id FROM {p}arbeitszeit WHERE salon_id = ?)", [$salon, $bisZ, $vonZ, $salon]);
    $zeiten = $db->alle('SELECT person_id, wochentag, von, bis FROM {p}arbeitszeit WHERE salon_id = ? ORDER BY von', [$salon]);
    $abw = $db->alle('SELECT * FROM {p}abwesenheit WHERE von < ? AND bis > ? AND (salon_id IS NULL OR salon_id = ?) ORDER BY von', [$bisZ, $vonZ, $salon]);
    $arbeit = [];
    foreach ($zeiten as $z) $arbeit[$z['person_id']][(int)$z['wochentag']][] = [(int)$z['von'], (int)$z['bis']];
    return [
        'salon' => $salon, 'von' => $von, 'bis' => $bis, 'stand' => $stand,
        'termine' => termine_aufbereiten($termine),
        'woanders' => array_map(fn($t) => ['id' => (int)$t['id'], 'person' => $t['person_id'], 'start' => substr($t['start'], 0, 16), 'ende' => substr($t['ende'], 0, 16), 'salon' => $t['salon_id']], $woanders),
        'arbeitszeiten' => $arbeit,
        'abwesenheiten' => array_map(fn($a) => ['id' => (int)$a['id'], 'person' => $a['person_id'], 'salon' => $a['salon_id'],
            'von' => substr($a['von'], 0, 16), 'bis' => substr($a['bis'], 0, 16), 'art' => $a['art'], 'notiz' => $a['notiz']], $abw),
    ];
}

function studio_leistungen(string $salon): array
{
    $ids = feld('leistungen');
    if (!is_array($ids)) throw new Fehler('Bitte eine Leistung wählen.', 422, 'leistungen');
    return leistungen_laden($ids, $salon, false);
}

/** Kunde aus dem Termin-Dialog: vorhandene ID oder neu aus Name/Telefon. */
function studio_kunde(): ?int
{
    $id = feld('kunde_id');
    if ($id) {
        if (!db()->wert('SELECT 1 FROM {p}kunde WHERE id = ? AND geloescht = 0', [(int)$id])) throw new Fehler('Kunde nicht gefunden.', 422);
        return (int)$id;
    }
    $k = feld('kunde');
    if (!is_array($k)) return null;
    $name = trim((string)($k['name'] ?? ''));
    $telRoh = trim((string)($k['telefon'] ?? ''));
    $tel = telefon_normal($telRoh);
    if ($telRoh !== '' && !$tel) throw new Fehler('Die Telefonnummer ist nicht lesbar.', 422, 'telefon', ['feld' => 'telefon']);
    $email = email_normal($k['email'] ?? null);
    if (!empty($k['email']) && !$email) throw new Fehler('Die E-Mail-Adresse sieht nicht richtig aus.', 422, 'email', ['feld' => 'email']);
    if ($name === '' && !$tel) return null;
    [$vor, $nach] = name_teilen(mb_substr($name, 0, 160));
    return kunde_zu_telefon($vor ?: null, $nach, $tel, $email);
}

function aktion_termin_neu(): array
{
    anmeldung_pflicht(true);
    $salon = text_feld('salon', 32, true);
    $leistungen = studio_leistungen($salon);
    $person = text_feld('person', 32);
    if ($person && !db()->wert('SELECT 1 FROM {p}person WHERE id = ? AND aktiv = 1', [$person])) throw new Fehler('Unbekannte Person.', 422);
    $phasen = feld('phasen') !== null ? phasen_pruefen(feld('phasen')) : null;
    $preis = feld('preis_cent');
    return db()->schreiben(function () use ($salon, $leistungen, $person, $phasen, $preis) {
        $kunde = studio_kunde();
        $k = feld('kunde');
        return termin_anlegen([
            'salon' => $salon, 'leistungen' => $leistungen, 'person' => $person ?: null, 'phasen' => $phasen,
            'start' => zeitpunkt_pruefen(text_feld('start', 20, true)), 'kunde_id' => $kunde,
            'gast_name' => is_array($k) ? (mb_substr(trim((string)($k['name'] ?? '')), 0, 160) ?: null) : null,
            'notiz' => text_feld('notiz', 2000), 'quelle' => in_array(feld('quelle'), ['telefon', 'vorort', 'studio'], true) ? feld('quelle') : 'studio',
            'trotzdem' => feld('trotzdem') === true, 'preis_cent' => is_int($preis) ? $preis : null,
            'anfrage_id' => text_feld('anfrage_id', 64),
        ]);
    });
}

function aktion_termin_aendern(): array
{
    anmeldung_pflicht(true);
    $id = (int)feld('id');
    $t = db()->eins('SELECT salon_id FROM {p}termin WHERE id = ?', [$id]);
    if (!$t) throw new Fehler('Termin nicht gefunden.', 404);
    $a = [];
    if (feld('start') !== null) $a['start'] = zeitpunkt_pruefen((string)feld('start'));
    if (feld('person') !== null) {
        $p = text_feld('person', 32);
        if (!db()->wert('SELECT 1 FROM {p}person WHERE id = ?', [$p])) throw new Fehler('Unbekannte Person.', 422);
        $a['person'] = $p;
    }
    if (feld('phasen') !== null) $a['phasen'] = phasen_pruefen(feld('phasen'));
    if (feld('status') !== null) $a['status'] = (string)feld('status');
    foreach (['notiz' => 2000, 'kundennotiz' => 600] as $f => $max) if (array_key_exists($f, eingabe())) $a[$f] = text_feld($f, $max);
    if (array_key_exists('preis_cent', eingabe())) $a['preis_cent'] = is_int(feld('preis_cent')) ? feld('preis_cent') : null;
    if (feld('leistungen') !== null) {
        $a['leistungen'] = studio_leistungen($t['salon_id']);
        if (!isset($a['phasen'])) $a['phasen'] = phasen_verketten($a['leistungen']);
    }
    return db()->schreiben(function () use ($id, $a) {
        if (array_key_exists('kunde_id', eingabe()) || feld('kunde') !== null) {
            $a['kunde_id'] = studio_kunde();
        }
        return termin_aendern($id, $a, feld('version') !== null ? (int)feld('version') : null, feld('trotzdem') === true);
    });
}

function aktion_termin_verlauf(): array
{
    anmeldung_pflicht(false);
    $id = (int)feld('id');
    $t = termin_lesen($id);
    $verlauf = db()->alle('SELECT p.zeit, p.aktion, p.daten, pe.name FROM {p}protokoll p LEFT JOIN {p}person pe ON pe.id = p.person_id WHERE p.termin_id = ? ORDER BY p.id', [$id]);
    $t['verlauf'] = array_map(fn($v) => ['zeit' => substr($v['zeit'], 0, 16), 'aktion' => $v['aktion'], 'wer' => $v['name'], 'daten' => json_decode((string)$v['daten'], true)], $verlauf);
    return $t;
}

/** Freie Zeiten fürs Studio: ohne Vorlauf, alle aktiven Personen. */
function aktion_vorschlaege(): array
{
    anmeldung_pflicht(false);
    $salon = text_feld('salon', 32, true);
    $leistungen = studio_leistungen($salon);
    $phasen = feld('phasen') !== null ? phasen_pruefen(feld('phasen')) : phasen_verketten($leistungen);
    $person = text_feld('person', 32);
    $personen = array_keys(personen_fuer($leistungen, false, $person ?: null));
    $von = datum_pruefen((string)(feld('von') ?? date('Y-m-d')));
    $tage = max(1, min(21, (int)(feld('tage') ?? 7)));
    $ohne = feld('ohne') ? (int)feld('ohne') : null;
    $ab = $von === date('Y-m-d') ? date('Y-m-d H:i:00') : null;
    $frei = freie_zeiten($salon, $phasen, $personen, $von, tag_plus($von, $tage - 1), $ab, $ohne);
    $aus = [];
    foreach ($frei as $d => $z) foreach ($z as $t => $wer) $aus[] = ['datum' => $d, 't' => hhmm($t), 'p' => $wer];
    return ['dauer' => phasen_dauer($phasen), 'phasen' => $phasen, 'personen' => $personen, 'frei' => $aus];
}

/* ── Abwesenheiten ──────────────────────────────────────────────── */

function aktion_abwesenheit_speichern(): array
{
    $a = anmeldung_pflicht(true);
    $person = text_feld('person', 32);
    $salon = text_feld('salon', 32);
    if (!$person && $a['rolle'] !== 'inhaberin') throw new Fehler('Salonweite Sperren setzt die Inhaberin.', 403, 'rolle');
    $von = zeitpunkt_pruefen(text_feld('von', 20, true));
    $bis = zeitpunkt_pruefen(text_feld('bis', 20, true));
    if ($bis <= $von) throw new Fehler('Das Ende muss nach dem Anfang liegen.', 422);
    $art = in_array(feld('art'), ['urlaub', 'krank', 'pause', 'schulung', 'frei', 'geschlossen'], true) ? feld('art') : 'frei';
    $id = feld('id') ? (int)feld('id') : null;
    return db()->schreiben(function (DB $db) use ($person, $salon, $von, $bis, $art, $id) {
        $zeile = ['person_id' => $person ?: null, 'salon_id' => $salon ?: null, 'von' => $von, 'bis' => $bis, 'art' => $art, 'notiz' => text_feld('notiz', 255)];
        if ($id) $db->aendern('abwesenheit', $zeile, 'id = ?', [$id]);
        else $id = $db->einfuegen('abwesenheit', $zeile + ['erstellt' => jetzt(), 'erstellt_von' => $GLOBALS['ANGEMELDET']['id']]);
        $db->standErhoehen();
        protokoll('abwesenheit', null, null, $zeile + ['id' => $id]);
        // Betroffene Termine melden, nicht still verschieben.
        $werte = [$bis, $von];
        $sql = "SELECT * FROM {p}termin WHERE status = 'gebucht' AND start < ? AND ende > ?";
        if ($person) { $sql .= ' AND person_id = ?'; $werte[] = $person; }
        if ($salon) { $sql .= ' AND salon_id = ?'; $werte[] = $salon; }
        return ['id' => $id, 'betroffen' => termine_aufbereiten($db->alle($sql . ' ORDER BY start', $werte))];
    });
}

function aktion_abwesenheit_loeschen(): array
{
    anmeldung_pflicht(true);
    $id = (int)feld('id');
    db()->schreiben(function (DB $db) use ($id) {
        $db->q('DELETE FROM {p}abwesenheit WHERE id = ?', [$id]);
        $db->standErhoehen();
        protokoll('abwesenheit_geloescht', null, null, ['id' => $id]);
    });
    return ['ok' => true];
}

/* ── Kunden ─────────────────────────────────────────────────────── */

function aktion_kunden(): array
{
    anmeldung_pflicht(false);
    $db = db();
    $q = trim((string)(text_feld('q', 100) ?? ''));
    $werte = [];
    $sql = 'SELECT k.*, (SELECT MAX(start) FROM {p}termin t WHERE t.kunde_id = k.id AND t.status <> \'storniert\') AS letzter,
        (SELECT COUNT(*) FROM {p}termin t WHERE t.kunde_id = k.id AND t.status <> \'storniert\') AS besuche
        FROM {p}kunde k WHERE k.geloescht = 0';
    if ($q !== '') {
        foreach (preg_split('/\s+/u', mb_strtolower($q)) as $wort) {
            $ziffern = preg_replace('/\D/', '', $wort);
            if (strlen($ziffern) >= 4 && strlen($ziffern) === strlen(preg_replace('/[\s\/+()-]/', '', $wort))) {
                $wort = ltrim($ziffern, '0');
            }
            $sql .= ' AND k.suche LIKE ?';
            $werte[] = '%' . str_replace(['%', '_'], ['\%', '\_'], $wort) . '%';
        }
    }
    $sql .= $q === '' ? ' ORDER BY k.geaendert DESC' : ' ORDER BY k.nachname, k.vorname';
    $sql .= ' LIMIT 60';
    $aus = [];
    foreach ($db->alle($sql, $werte) as $k) {
        $aus[] = ['id' => (int)$k['id'], 'vorname' => $k['vorname'], 'nachname' => $k['nachname'], 'telefon' => $k['telefon'],
            'telefon_text' => telefon_anzeige($k['telefon']), 'email' => $k['email'], 'letzter' => $k['letzter'] ? substr($k['letzter'], 0, 10) : null,
            'besuche' => (int)$k['besuche']];
    }
    $gesamt = (int)$db->wert('SELECT COUNT(*) FROM {p}kunde WHERE geloescht = 0');
    return ['kunden' => $aus, 'gesamt' => $gesamt];
}

function aktion_kunde(): array
{
    anmeldung_pflicht(false);
    $id = (int)feld('id');
    $k = kunde_lesen($id);
    $db = db();
    $termine = termine_aufbereiten($db->alle('SELECT * FROM {p}termin WHERE kunde_id = ? ORDER BY start DESC LIMIT 200', [$id]));
    $vergangen = array_values(array_filter($termine, fn($t) => $t['start'] < date('Y-m-d H:i') && $t['status'] !== 'storniert'));
    $umsatz = array_sum(array_map(fn($t) => $t['status'] === 'erschienen' ? (int)$t['preis_cent'] : 0, $vergangen));
    // Üblicher Abstand zwischen Besuchen (Median) → Vorschlag für den nächsten.
    $abstaende = [];
    for ($i = 0; $i + 1 < count($vergangen); $i++) {
        $abstaende[] = (int)round((strtotime($vergangen[$i]['start']) - strtotime($vergangen[$i + 1]['start'])) / 86400);
    }
    sort($abstaende);
    $rhythmus = $abstaende ? $abstaende[intdiv(count($abstaende), 2)] : null;
    $doppelt = [];
    if ($k['telefon']) {
        $doppelt = $db->alle('SELECT id, vorname, nachname FROM {p}kunde WHERE telefon = ? AND id <> ? AND geloescht = 0', [$k['telefon'], $id]);
    }
    return $k + ['termine' => $termine, 'umsatz_cent' => $umsatz, 'rhythmus_tage' => $rhythmus,
        'nicht_erschienen' => count(array_filter($termine, fn($t) => $t['status'] === 'nicht_erschienen')), 'doppelt' => $doppelt];
}

function aktion_kunde_speichern(): array
{
    anmeldung_pflicht(true);
    $id = feld('id') ? (int)feld('id') : null;
    $vor = text_feld('vorname', 80);
    $nach = text_feld('nachname', 80);
    if (!$vor && !$nach) throw new Fehler('Bitte einen Namen angeben.', 422, 'pflicht', ['feld' => 'vorname']);
    $telRoh = text_feld('telefon', 40);
    $tel = telefon_normal($telRoh);
    if ($telRoh && !$tel) throw new Fehler('Die Telefonnummer ist nicht lesbar. Bitte mit Vorwahl, z. B. 0176 1234567.', 422, 'telefon', ['feld' => 'telefon']);
    $emailRoh = text_feld('email', 190);
    $email = email_normal($emailRoh);
    if ($emailRoh && !$email) throw new Fehler('Die E-Mail-Adresse sieht nicht richtig aus.', 422, 'email', ['feld' => 'email']);
    return db()->schreiben(function (DB $db) use ($id, $vor, $nach, $tel, $email) {
        if ($tel && feld('trotzdem') !== true) {
            $andere = $db->eins('SELECT id, vorname, nachname FROM {p}kunde WHERE telefon = ? AND geloescht = 0' . ($id ? ' AND id <> ?' : ''), $id ? [$tel, $id] : [$tel]);
            if ($andere) throw new Fehler('Diese Nummer gehört schon zu ' . trim($andere['vorname'] . ' ' . $andere['nachname']) . '.', 409, 'doppelt', ['kunde' => (int)$andere['id']]);
        }
        $k = ['vorname' => $vor, 'nachname' => $nach, 'telefon' => $tel, 'email' => $email, 'notiz' => text_feld('notiz', 4000), 'geaendert' => jetzt()];
        $k['suche'] = kunde_suchtext($k);
        if ($id) {
            if (!$db->aendern('kunde', $k, 'id = ? AND geloescht = 0', [$id])) throw new Fehler('Kunde nicht gefunden.', 404);
            protokoll('kunde_geaendert', null, $id);
        } else {
            $id = $db->einfuegen('kunde', $k + ['erstellt' => jetzt(), 'geloescht' => 0]);
            protokoll('kunde_angelegt', null, $id);
        }
        $db->standErhoehen();
        return kunde_lesen($id);
    });
}

function aktion_kunden_zusammenfuehren(): array
{
    anmeldung_pflicht(true);
    $ziel = (int)feld('ziel');
    $quelle = (int)feld('quelle');
    if ($ziel === $quelle) throw new Fehler('Zweimal derselbe Kunde.', 422);
    return db()->schreiben(function (DB $db) use ($ziel, $quelle) {
        $z = kunde_lesen($ziel);
        $q = kunde_lesen($quelle);
        $db->q('UPDATE {p}termin SET kunde_id = ? WHERE kunde_id = ?', [$ziel, $quelle]);
        $neu = [];
        foreach (['vorname', 'nachname', 'telefon', 'email'] as $f) if (!$z[$f] && $q[$f]) $neu[$f] = $q[$f];
        if ($q['notiz']) $neu['notiz'] = trim(($z['notiz'] ?? '') . "\n" . $q['notiz']);
        $neu['geaendert'] = jetzt();
        $neu['suche'] = kunde_suchtext(array_merge($z, $neu));
        $db->aendern('kunde', $neu, 'id = ?', [$ziel]);
        $db->aendern('kunde', ['geloescht' => 1, 'vorname' => null, 'nachname' => null, 'telefon' => null, 'email' => null, 'notiz' => null, 'suche' => null, 'geaendert' => jetzt()], 'id = ?', [$quelle]);
        $db->standErhoehen();
        protokoll('kunden_zusammengefuehrt', null, $ziel, ['quelle' => $quelle]);
        return kunde_lesen($ziel);
    });
}

/** Löschen nach DSGVO: personenbezogene Daten weg, Termine bleiben anonym. */
function aktion_kunde_loeschen(): array
{
    anmeldung_pflicht(true, true);
    $id = (int)feld('id');
    db()->schreiben(function (DB $db) use ($id) {
        kunde_lesen($id);
        $db->aendern('kunde', ['geloescht' => 1, 'vorname' => null, 'nachname' => null, 'telefon' => null, 'email' => null,
            'notiz' => null, 'suche' => null, 'geaendert' => jetzt()], 'id = ?', [$id]);
        $db->q('UPDATE {p}termin SET gast_name = NULL, kundennotiz = NULL WHERE kunde_id = ?', [$id]);
        $db->standErhoehen();
        protokoll('kunde_geloescht', null, $id);
    });
    return ['ok' => true];
}

/** Auskunft nach Art. 15 DSGVO: alles, was zu einer Person gespeichert ist. */
function aktion_kunde_auskunft(): array
{
    anmeldung_pflicht(false, true);
    $id = (int)feld('id');
    $k = kunde_lesen($id);
    $termine = termine_aufbereiten(db()->alle('SELECT * FROM {p}termin WHERE kunde_id = ? ORDER BY start', [$id]));
    foreach ($termine as &$t) unset($t['token'], $t['kunde']);
    unset($t);
    return ['erstellt' => jetzt(), 'kunde' => $k, 'termine' => $termine];
}

/* ── Team, Leistungen, Einstellungen (Inhaberin) ───────────────── */

function aktion_team(): array
{
    anmeldung_pflicht(false, true);
    $db = db();
    $aus = [];
    foreach ($db->alle('SELECT id, name, farbe, rolle, anmeldename, aktiv, online, sort, pass_hash FROM {p}person ORDER BY sort, name') as $p) {
        $p['hat_passwort'] = $p['pass_hash'] !== null;
        unset($p['pass_hash']);
        $p['farbe'] = (int)$p['farbe']; $p['aktiv'] = (bool)$p['aktiv']; $p['online'] = (bool)$p['online']; $p['sort'] = (int)$p['sort'];
        $p['arbeitszeiten'] = array_map(fn($z) => ['salon' => $z['salon_id'], 'tag' => (int)$z['wochentag'], 'von' => (int)$z['von'], 'bis' => (int)$z['bis']],
            $db->alle('SELECT * FROM {p}arbeitszeit WHERE person_id = ? ORDER BY salon_id, wochentag, von', [$p['id']]));
        $p['leistungen'] = array_column($db->alle('SELECT leistung_id FROM {p}leistung_person WHERE person_id = ?', [$p['id']]), 'leistung_id');
        $aus[] = $p;
    }
    return ['personen' => $aus];
}

function aktion_person_speichern(): array
{
    $ich = anmeldung_pflicht(true, true);
    $id = text_feld('id', 32);
    $name = text_feld('name', 80, true);
    $rolle = in_array(feld('rolle'), ROLLEN, true) ? feld('rolle') : 'team';
    $anmelde = text_feld('anmeldename', 80);
    $anmelde = $anmelde ? mb_strtolower($anmelde) : null;
    $pw = feld('passwort');
    if ($pw !== null && $pw !== '') passwort_pruefen((string)$pw);
    $zeiten = feld('arbeitszeiten');
    $leistungen = feld('leistungen');
    if ($id === $ich['id'] && ($rolle !== 'inhaberin' || feld('aktiv') === false)) throw new Fehler('Die eigene Inhaberin-Rolle kann man sich nicht selbst nehmen.', 422);
    return db()->schreiben(function (DB $db) use ($id, $name, $rolle, $anmelde, $pw, $zeiten, $leistungen) {
        if ($anmelde) {
            $belegt = $db->wert('SELECT id FROM {p}person WHERE anmeldename = ?' . ($id ? ' AND id <> ?' : ''), $id ? [$anmelde, $id] : [$anmelde]);
            if ($belegt) throw new Fehler('Diesen Anmeldenamen hat schon jemand.', 409, 'doppelt', ['feld' => 'anmeldename']);
        }
        $zeile = ['name' => $name, 'farbe' => max(1, min(8, (int)(feld('farbe') ?? 1))), 'rolle' => $rolle, 'anmeldename' => $anmelde,
            'aktiv' => feld('aktiv') === false ? 0 : 1, 'online' => feld('online') === false ? 0 : 1, 'geaendert' => jetzt()];
        if (feld('sort') !== null) $zeile['sort'] = (int)feld('sort');
        if ($pw !== null && $pw !== '') $zeile['pass_hash'] = password_hash((string)$pw, PASSWORD_DEFAULT);
        if ($id) {
            if (!$db->aendern('person', $zeile, 'id = ?', [$id])) throw new Fehler('Person nicht gefunden.', 404);
            if (isset($zeile['pass_hash']) || !$zeile['aktiv']) $db->q('DELETE FROM {p}sitzung WHERE person_id = ?', [$id]);
        } else {
            $basis = preg_replace('/[^a-z]/', '', strtr(mb_strtolower($name), ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss'])) ?: 'person';
            $id = $basis;
            for ($i = 2; $db->wert('SELECT 1 FROM {p}person WHERE id = ?', [$id]); $i++) $id = $basis . $i;
            $db->einfuegen('person', $zeile + ['id' => $id, 'sort' => (int)$db->wert('SELECT COALESCE(MAX(sort), 0) + 1 FROM {p}person')]);
        }
        if (is_array($zeiten)) {
            $db->q('DELETE FROM {p}arbeitszeit WHERE person_id = ?', [$id]);
            $salons = array_column($db->alle('SELECT id FROM {p}salon'), 'id');
            foreach ($zeiten as $z) {
                $von = (int)($z['von'] ?? -1); $bis = (int)($z['bis'] ?? -1); $tag = (int)($z['tag'] ?? 0);
                if (!in_array($z['salon'] ?? '', $salons, true) || $tag < 1 || $tag > 7 || $von < 0 || $bis > 1440 || $bis <= $von) {
                    throw new Fehler('Eine Arbeitszeit ist ungültig.', 422);
                }
                $db->einfuegen('arbeitszeit', ['person_id' => $id, 'salon_id' => $z['salon'], 'wochentag' => $tag, 'von' => $von, 'bis' => $bis]);
            }
        }
        if (is_array($leistungen)) {
            $db->q('DELETE FROM {p}leistung_person WHERE person_id = ?', [$id]);
            $gueltig = array_flip(array_column($db->alle('SELECT id FROM {p}leistung'), 'id'));
            foreach (array_unique($leistungen) as $l) if (isset($gueltig[$l])) $db->einfuegen('leistung_person', ['leistung_id' => $l, 'person_id' => $id]);
        }
        $db->standErhoehen();
        protokoll('person_gespeichert', null, null, ['person' => $id]);
        return ['id' => $id];
    });
}

function aktion_leistung_speichern(): array
{
    anmeldung_pflicht(true, true);
    $id = text_feld('id', 16);
    $salon = text_feld('salon', 32, true);
    if (!db()->wert('SELECT 1 FROM {p}salon WHERE id = ?', [$salon])) throw new Fehler('Unbekannter Salon.', 422);
    $phasen = phasen_pruefen(feld('phasen'));
    $preis = feld('preis_cent');
    if ($preis !== null && (!is_int($preis) || $preis < 0 || $preis > 10000000)) throw new Fehler('Preis ungültig.', 422, 'preis', ['feld' => 'preis']);
    $gruppen = array_column(json_decode((string)db()->wert("SELECT wert FROM {p}meta WHERE schluessel = 'gruppen'"), true), 'id');
    $gruppe = in_array(feld('gruppe'), $gruppen, true) ? feld('gruppe') : throw new Fehler('Gruppe ungültig.', 422);
    return db()->schreiben(function (DB $db) use ($id, $salon, $phasen, $preis, $gruppe) {
        $zeile = [
            'salon_id' => $salon, 'gruppe' => $gruppe, 'name' => text_feld('name', 160, true), 'zusatz' => text_feld('zusatz', 255),
            'laenge' => text_feld('laenge', 40), 'phasen' => json_encode($phasen), 'preis_cent' => $preis,
            'preis_ab' => feld('preis_ab') === true ? 1 : 0, 'preis_text' => text_feld('preis_text', 60),
            'online' => feld('online') === false ? 0 : 1, 'aktiv' => feld('aktiv') === false ? 0 : 1,
            'zusatzleistung' => feld('zusatzleistung') === true ? 1 : 0, 'geaendert' => jetzt(),
        ];
        if ($id) {
            $alt = $db->eins('SELECT familie FROM {p}leistung WHERE id = ?', [$id]);
            if (!$alt) throw new Fehler('Leistung nicht gefunden.', 404);
            $zeile['familie'] = text_feld('familie', 64) ?: $alt['familie'];
            $db->aendern('leistung', $zeile, 'id = ?', [$id]);
        } else {
            $n = (int)$db->wert('SELECT COUNT(*) FROM {p}leistung') + 1;
            do { $id = substr($salon, 0, 1) . sprintf('%03d', $n++); } while ($db->wert('SELECT 1 FROM {p}leistung WHERE id = ?', [$id]));
            $zeile['familie'] = text_feld('familie', 64) ?: $salon . '-' . $id;
            $db->einfuegen('leistung', $zeile + ['id' => $id, 'sort' => (int)$db->wert('SELECT COALESCE(MAX(sort), 0) + 1 FROM {p}leistung')]);
        }
        $personen = feld('personen');
        if (is_array($personen)) {
            $db->q('DELETE FROM {p}leistung_person WHERE leistung_id = ?', [$id]);
            $gueltig = array_flip(array_column($db->alle('SELECT id FROM {p}person'), 'id'));
            foreach (array_unique($personen) as $p) if (isset($gueltig[$p])) $db->einfuegen('leistung_person', ['leistung_id' => $id, 'person_id' => $p]);
        }
        $db->standErhoehen();
        protokoll('leistung_gespeichert', null, null, ['leistung' => $id]);
        return ['id' => $id];
    });
}

function aktion_salon_speichern(): array
{
    anmeldung_pflicht(true, true);
    $id = text_feld('id', 32, true);
    $oeff = feld('oeffnung');
    if (!is_array($oeff)) throw new Fehler('Öffnungszeiten fehlen.', 422);
    $sauber = [];
    for ($t = 1; $t <= 7; $t++) {
        $sauber[(string)$t] = [];
        foreach ($oeff[(string)$t] ?? [] as $s) {
            if (!is_array($s) || count($s) !== 2 || $s[0] < 0 || $s[1] > 1440 || $s[1] <= $s[0]) throw new Fehler('Öffnungszeit ungültig.', 422);
            $sauber[(string)$t][] = [(int)$s[0], (int)$s[1]];
        }
    }
    db()->schreiben(function (DB $db) use ($id, $sauber) {
        $db->aendern('salon', ['oeffnung' => json_encode($sauber), 'telefon_text' => text_feld('telefon_text', 40, true),
            'telefon' => telefon_normal(text_feld('telefon_text', 40)) ?? '', 'strasse' => text_feld('strasse', 120, true), 'ort' => text_feld('ort', 120, true)], 'id = ?', [$id]);
        $db->standErhoehen();
        protokoll('salon_gespeichert', null, null, ['salon' => $id]);
    });
    return ['ok' => true];
}

function aktion_einstellungen_speichern(): array
{
    anmeldung_pflicht(true, true);
    $e = einstellungen();
    $grenzen = ['raster' => [5, 60], 'vorlauf' => [0, 2880], 'horizont' => [1, 365], 'stornofrist' => [0, 168], 'puffer' => [0, 60], 'max_offen' => [1, 20]];
    foreach ($grenzen as $f => [$min, $max]) {
        if (feld($f) === null) continue;
        $w = (int)feld($f);
        if ($w < $min || $w > $max) throw new Fehler("„{$f}“ muss zwischen $min und $max liegen.", 422, 'bereich', ['feld' => $f]);
        $e[$f] = $w;
    }
    foreach (['luecken_fuellen', 'online_aktiv'] as $f) if (is_bool(feld($f))) $e[$f] = feld($f);
    if (feld('hinweis') !== null) $e['hinweis'] = (string)text_feld('hinweis', 300);
    db()->schreiben(function (DB $db) use ($e) {
        $db->q("UPDATE {p}meta SET wert = ? WHERE schluessel = 'einstellungen'", [json_encode($e, JSON_UNESCAPED_UNICODE)]);
        $db->standErhoehen();
        protokoll('einstellungen', null, null, $e);
    });
    return $e;
}

/* ── Auswertung, Protokoll, Sicherung ───────────────────────────── */

function aktion_auswertung(): array
{
    anmeldung_pflicht(false, true);
    $db = db();
    $von = datum_pruefen((string)feld('von'));
    $bis = datum_pruefen((string)feld('bis'));
    if ($bis < $von || $bis > tag_plus($von, 400)) throw new Fehler('Zeitraum ungültig.', 422);
    $salon = text_feld('salon', 32);
    $w = [$von . ' 00:00:00', tag_plus($bis, 1) . ' 00:00:00'];
    $wo = 'start >= ? AND start < ?' . ($salon ? ' AND salon_id = ?' : '');
    if ($salon) $w[] = $salon;
    $zeilen = $db->alle("SELECT person_id, status, quelle, preis_cent, start, ende, phasen FROM {p}termin WHERE $wo", $w);
    $jePerson = [];
    $summe = ['termine' => 0, 'umsatz_cent' => 0, 'storniert' => 0, 'nicht_erschienen' => 0, 'online' => 0, 'arbeit_min' => 0];
    foreach ($zeilen as $t) {
        $p = &$jePerson[$t['person_id']];
        $p ??= ['termine' => 0, 'umsatz_cent' => 0, 'arbeit_min' => 0, 'nicht_erschienen' => 0];
        if ($t['status'] === 'storniert') { $summe['storniert']++; unset($p); continue; }
        $summe['termine']++; $p['termine']++;
        if ($t['quelle'] === 'online') $summe['online']++;
        if ($t['status'] === 'nicht_erschienen') { $summe['nicht_erschienen']++; $p['nicht_erschienen']++; }
        if ($t['status'] !== 'nicht_erschienen' && $t['start'] < jetzt()) { $summe['umsatz_cent'] += (int)$t['preis_cent']; $p['umsatz_cent'] += (int)$t['preis_cent']; }
        $arbeit = array_sum(array_map(fn($x) => $x[0] === 'arbeit' ? $x[1] : 0, json_decode($t['phasen'], true)));
        $summe['arbeit_min'] += $arbeit; $p['arbeit_min'] += $arbeit;
        unset($p);
    }
    // Verfügbare Minuten laut Arbeitszeit, für die Auslastung.
    $verfuegbar = [];
    $zeiten = $db->alle('SELECT person_id, wochentag, von, bis FROM {p}arbeitszeit' . ($salon ? ' WHERE salon_id = ?' : ''), $salon ? [$salon] : []);
    for ($d = $von; $d <= $bis; $d = tag_plus($d, 1)) {
        $wt = wochentag($d);
        foreach ($zeiten as $z) if ((int)$z['wochentag'] === $wt) $verfuegbar[$z['person_id']] = ($verfuegbar[$z['person_id']] ?? 0) + (int)$z['bis'] - (int)$z['von'];
    }
    foreach ($jePerson as $pid => &$p) $p['auslastung'] = !empty($verfuegbar[$pid]) ? round($p['arbeit_min'] / $verfuegbar[$pid], 3) : null;
    unset($p);
    $neu = (int)$db->wert('SELECT COUNT(*) FROM {p}kunde WHERE erstellt >= ? AND erstellt < ? AND geloescht = 0', [$von . ' 00:00:00', tag_plus($bis, 1) . ' 00:00:00']);
    return ['von' => $von, 'bis' => $bis, 'summe' => $summe + ['neue_kunden' => $neu], 'personen' => $jePerson];
}

function aktion_protokoll(): array
{
    anmeldung_pflicht(false, true);
    $vor = feld('vor') ? (int)feld('vor') : PHP_INT_MAX;
    $zeilen = db()->alle('SELECT p.*, pe.name FROM {p}protokoll p LEFT JOIN {p}person pe ON pe.id = p.person_id WHERE p.id < ? ORDER BY p.id DESC LIMIT 100', [$vor]);
    return ['eintraege' => array_map(fn($z) => ['id' => (int)$z['id'], 'zeit' => substr($z['zeit'], 0, 16), 'wer' => $z['name'], 'aktion' => $z['aktion'],
        'termin' => $z['termin_id'] ? (int)$z['termin_id'] : null, 'kunde' => $z['kunde_id'] ? (int)$z['kunde_id'] : null,
        'daten' => json_decode((string)$z['daten'], true)], $zeilen)];
}

/** Vollständige Sicherung als JSON (ohne Sitzungen und Passwörter). */
function aktion_sicherung(): never
{
    anmeldung_pflicht(false, true);
    $db = db();
    $aus = ['erstellt' => jetzt(), 'schema' => (int)$db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'schema'"), 'tabellen' => []];
    foreach (['meta', 'salon', 'person', 'arbeitszeit', 'abwesenheit', 'leistung', 'leistung_person', 'kunde', 'termin', 'termin_posten', 'belegung', 'protokoll'] as $t) {
        $zeilen = $db->alle("SELECT * FROM {p}$t");
        if ($t === 'person') foreach ($zeilen as &$z) unset($z['pass_hash']);
        unset($z);
        $aus['tabellen'][$t] = $zeilen;
    }
    protokoll('sicherung');
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="irmonhair-sicherung-' . date('Y-m-d-His') . '.json"');
    header('Cache-Control: no-store');
    echo json_encode($aus, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

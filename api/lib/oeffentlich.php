<?php
/* Aktionen der Online-Buchung. Keine Anmeldung; geschützt durch
   Mengenbremsen, eine Falle für Formular-Roboter (Feld „webseite“) und
   einen Zugangsschlüssel je Termin (32 Zeichen Zufall) zum Verwalten. */

declare(strict_types=1);

function aktion_katalog(): array
{
    $db = db();
    $e = einstellungen();
    $salons = [];
    foreach ($db->alle('SELECT * FROM {p}salon WHERE aktiv = 1 ORDER BY sort') as $s) {
        $salons[] = [
            'id' => $s['id'], 'name' => $s['name'], 'strasse' => $s['strasse'], 'ort' => $s['ort'],
            'telefon' => $s['telefon'], 'telefon_text' => $s['telefon_text'], 'lat' => (float)$s['lat'], 'lon' => (float)$s['lon'],
            'oeffnung' => json_decode((string)$s['oeffnung'], true),
        ];
    }
    $personen = [];
    $salonsJePerson = [];
    foreach ($db->alle('SELECT DISTINCT person_id, salon_id FROM {p}arbeitszeit') as $z) $salonsJePerson[$z['person_id']][] = $z['salon_id'];
    foreach ($db->alle('SELECT id, name, sort FROM {p}person WHERE aktiv = 1 AND online = 1 ORDER BY sort') as $p) {
        $personen[] = ['id' => $p['id'], 'name' => $p['name'], 'salons' => array_values(array_unique($salonsJePerson[$p['id']] ?? []))];
    }
    $zuordnung = [];
    foreach ($db->alle('SELECT lp.leistung_id, lp.person_id FROM {p}leistung_person lp JOIN {p}person p ON p.id = lp.person_id WHERE p.aktiv = 1 AND p.online = 1') as $z) {
        $zuordnung[$z['leistung_id']][] = $z['person_id'];
    }
    $leistungen = [];
    foreach ($db->alle('SELECT * FROM {p}leistung WHERE aktiv = 1 AND online = 1 ORDER BY sort') as $l) {
        if (empty($zuordnung[$l['id']])) continue;
        $phasen = json_decode($l['phasen'], true);
        $leistungen[] = [
            'id' => $l['id'], 'salon' => $l['salon_id'], 'gruppe' => $l['gruppe'], 'familie' => $l['familie'],
            'name' => $l['name'], 'zusatz' => $l['zusatz'], 'laenge' => $l['laenge'],
            'dauer' => phasen_dauer($phasen), 'einwirken' => array_sum(array_map(fn($p) => $p[0] === 'pause' ? $p[1] : 0, $phasen)),
            'preis_cent' => $l['preis_cent'] === null ? null : (int)$l['preis_cent'], 'preis_ab' => (bool)$l['preis_ab'],
            'preis_text' => $l['preis_text'], 'zusatzleistung' => (bool)$l['zusatzleistung'],
            'personen' => $zuordnung[$l['id']], 'recall_tage' => isset($l['recall_tage']) ? (int)$l['recall_tage'] ?: null : null,
        ];
    }
    return [
        'salons' => $salons, 'personen' => $personen, 'leistungen' => $leistungen,
        'gruppen' => json_decode((string)$db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'gruppen'"), true),
        'regeln' => ['raster' => (int)$e['raster'], 'horizont' => (int)$e['horizont'], 'stornofrist' => (int)$e['stornofrist'],
                     'online_aktiv' => (bool)$e['online_aktiv'], 'hinweis' => (string)$e['hinweis']],
        // Der Wortlaut, der neben den Haken steht — genau so wird er gespeichert.
        'einwilligungen' => EINWILLIGUNGEN,
        'einwilligung_warteliste' => EINWILLIGUNG_WARTELISTE,
        'nachrichten' => katalog_nachrichten(),
        'heute' => date('Y-m-d'), 'jetzt' => date('H:i'),
    ];
}

/** Was die Buchungsseite über Nachrichten wissen muss: welche Wege es
    gibt (ohne SMS-Anbieter keine Frage nach SMS), ob es Warteliste und
    Treue gibt — und wie viele Kundinnen sich wirklich erinnern lassen.
    Der Anteil erscheint nur mit genug echten Buchungen; erfunden wird nichts. */
function katalog_nachrichten(): array
{
    require_once __DIR__ . '/nachrichten.php';
    $e = einstellungen();
    $db = db();
    $seit = date('Y-m-d H:i:s', time() - 120 * 86400);
    $anteil = null;
    $n = (int)$db->wert("SELECT COUNT(DISTINCT kunde_id) FROM {p}termin WHERE quelle = 'online' AND erstellt >= ? AND kunde_id IS NOT NULL", [$seit]);
    if ($n >= 40) {
        $ja = (int)$db->wert("SELECT COUNT(DISTINCT e.kunde_id) FROM {p}einwilligung e JOIN {p}termin t ON t.kunde_id = e.kunde_id
            WHERE t.quelle = 'online' AND t.erstellt >= ? AND e.art = 'terminnachrichten' AND e.erteilt = 1", [$seit]);
        $anteil = (int)floor($ja / $n * 10) * 10;   // abgerundet auf volle zehn Prozent
        if ($anteil < 50) $anteil = null;
    }
    $treue = $e['treue_aktiv'] ? ['n' => (int)$e['treue_n'], 'praemie' => (string)$e['treue_praemie']] : null;
    return ['sms' => sms_aktiv() || whatsapp_aktiv(), 'whatsapp' => whatsapp_aktiv(), 'email' => post_aktiv(),
        'warteliste' => (bool)$e['warteliste_aktiv'], 'recall' => (bool)$e['recall_aktiv'], 'anteil_erinnerung' => $anteil,
        'treue' => $treue, 'vorschau_sms' => vorlage('erinnerung_sms'), 'codes' => (bool)$db->wert('SELECT 1 FROM {p}rabatt WHERE aktiv = 1') || (bool)$db->wert("SELECT 1 FROM {p}gutschein WHERE status = 'aktiv'")];
}

/** Anfrage lesen, die bei „frei“ und „buchen“ gleich ist. */
function auswahl_lesen(): array
{
    $salon = text_feld('salon', 32, true);
    if (!db()->wert('SELECT 1 FROM {p}salon WHERE id = ? AND aktiv = 1', [$salon])) throw new Fehler('Unbekannter Salon.', 422);
    $ids = feld('leistungen');
    if (is_string($ids)) $ids = explode(',', $ids);
    if (!is_array($ids)) throw new Fehler('Bitte eine Leistung wählen.', 422);
    $leistungen = leistungen_laden($ids, $salon, true);
    $person = text_feld('person', 32);
    if ($person === '' || $person === 'egal') $person = null;
    $personen = personen_fuer($leistungen, true, $person);
    if (!$personen) throw new Fehler($person ? 'Diese Person bietet die Auswahl nicht online an.' : 'Diese Auswahl ist online nicht buchbar.', 422, 'person');
    return [$salon, $leistungen, $person, array_keys($personen)];
}

function aktion_frei(): array
{
    bremse('frei', ip(), (int)konfig('bremse_frei', 240), 60);
    [$salon, $leistungen, $person, $personen] = auswahl_lesen();
    $phasen = phasen_verketten($leistungen);
    $e = einstellungen();
    $heute = date('Y-m-d');
    $letzter = tag_plus($heute, (int)$e['horizont']);
    $von = feld('von') ? datum_pruefen((string)feld('von')) : $heute;
    if ($von < $heute) $von = $heute;
    $tage = max(1, min(42, (int)(feld('tage') ?? 14)));
    $bis = min($letzter, tag_plus($von, $tage - 1));
    $fruehestens = online_fruehestens();

    $antwort = ['von' => $von, 'bis' => $bis, 'tage' => [], 'naechster' => null, 'letzter' => $letzter];
    if (!$e['online_aktiv']) return $antwort + ['pausiert' => true];
    $frei = $von <= $bis ? freie_zeiten($salon, $phasen, $personen, $von, $bis, $fruehestens) : [];
    for ($d = $von; $d <= $bis; $d = tag_plus($d, 1)) {
        if (!array_key_exists($d, $frei)) { $antwort['tage'][$d] = ['zu' => true, 'zeiten' => []]; continue; }
        $zeiten = [];
        foreach ($frei[$d] as $t => $wer) $zeiten[] = ['t' => hhmm($t), 'p' => $wer];
        $antwort['tage'][$d] = ['zu' => false, 'zeiten' => $zeiten];
        if (!$antwort['naechster'] && $zeiten) $antwort['naechster'] = ['datum' => $d, 't' => $zeiten[0]['t'], 'p' => $zeiten[0]['p']];
    }
    // Nichts im Fenster: vorausschauen, damit wir einen Tag vorschlagen können.
    if (!$antwort['naechster']) {
        for ($a = tag_plus($bis, 1); $a <= $letzter && !$antwort['naechster']; $a = tag_plus($a, 21)) {
            $b = min($letzter, tag_plus($a, 20));
            foreach (freie_zeiten($salon, $phasen, $personen, $a, $b, $fruehestens) as $d => $z) {
                if ($z) { $t = array_key_first($z); $antwort['naechster'] = ['datum' => $d, 't' => hhmm($t), 'p' => $z[$t]]; break; }
            }
        }
    }
    return $antwort;
}

function aktion_buchen(): array
{
    methode('POST');
    // Formular-Roboter füllen jedes Feld aus; Menschen sehen dieses nicht.
    if (text_feld('webseite')) throw new Fehler('Die Buchung konnte nicht gespeichert werden.', 422);
    $anfrage = text_feld('anfrage_id', 64);
    if ($anfrage !== null && !preg_match('/^[A-Za-z0-9-]{8,64}$/', $anfrage)) $anfrage = null;
    // Ein wiederholtes Absenden derselben Anfrage (schlechtes Netz, zweiter
    // Tipp) bekommt den schon gebuchten Termin — ohne Bremse und ohne Prüfung.
    if ($anfrage && ($id = db()->wert('SELECT token FROM {p}termin WHERE anfrage_id = ?', [$anfrage]))) {
        return oeffentlicher_termin((string)$id) + ['wiederholt' => true];
    }
    // Verschieben über das Buchungsformular (ältere Seiten): derselbe Weg.
    if (text_feld('ersetzt', 32)) return aktion_verschieben();

    // Großzügig: im Mobilfunk teilen sich viele Kundinnen eine IP-Adresse.
    bremse('buchen', ip(), (int)konfig('bremse_buchen', 30), 3600);
    [$salon, $leistungen, $person] = auswahl_lesen();
    $start = zeitpunkt_pruefen(text_feld('start', 20, true));
    $name = text_feld('name', 160, true);
    if (mb_strlen($name) < 2) throw new Fehler('Bitte Ihren Namen angeben.', 422, 'pflicht', ['feld' => 'name']);
    $telRoh = text_feld('telefon', 40, true);
    $telefon = telefon_normal($telRoh);
    if (!$telefon) throw new Fehler('Bitte eine Handynummer angeben, unter der wir Sie erreichen (z. B. 0176 1234567).', 422, 'telefon', ['feld' => 'telefon']);
    $emailRoh = text_feld('email', 190);
    $email = email_normal($emailRoh);
    if ($emailRoh && !$email) throw new Fehler('Diese E-Mail-Adresse sieht nicht richtig aus.', 422, 'email', ['feld' => 'email']);
    if (feld('einwilligung') !== true) throw new Fehler('Bitte bestätigen Sie den Hinweis zum Datenschutz.', 422, 'einwilligung', ['feld' => 'einwilligung']);
    $zustimmung = is_array(feld('einwilligungen')) ? feld('einwilligungen') : [];
    $ref = text_feld('ref', 40);
    if ($ref !== null && !preg_match('/^[A-Za-z0-9_.-]{1,40}$/', $ref)) $ref = null;
    require_once __DIR__ . '/verkauf.php';
    $code = code_normal(text_feld('code', 24));

    $e = einstellungen();
    $offen = (int)db()->wert("SELECT COUNT(*) FROM {p}termin t JOIN {p}kunde k ON k.id = t.kunde_id
        WHERE k.telefon = ? AND t.status = 'gebucht' AND t.start > ? AND t.quelle = 'online'", [$telefon, jetzt()]);
    if ($offen >= (int)$e['max_offen']) {
        throw new Fehler('Unter dieser Nummer sind schon mehrere Termine offen. Bitte rufen Sie uns an.', 409, 'zu_viele');
    }

    [$vor, $nach] = name_teilen($name);
    try {
        $r = db()->schreiben(function () use ($salon, $leistungen, $person, $start, $vor, $nach, $telefon, $email, $name, $anfrage, $ref, $zustimmung, $code) {
            $kunde = kunde_zu_telefon($vor, $nach, $telefon, $email);
            // Aktionscode in derselben Sperre prüfen: „nur erster Besuch“ und
            // „höchstens n-mal“ halten auch bei gleichzeitigen Buchungen.
            $rabatt = null;
            if ($code !== '') {
                $rc = rabatt_finden($code);
                $g = $rc ? null : gutschein_finden($code);
                if (!$rc && (!$g || $g['status'] !== 'aktiv')) throw new Fehler('Diesen Code kennen wir nicht (oder er ist abgelaufen).', 422, 'code', ['feld' => 'code']);
                if ($rc) {
                    [$cent, $warum] = rabatt_anwenden($rc, preis_aus($leistungen)[0], $kunde);
                    if ($warum) throw new Fehler($warum, 422, 'code', ['feld' => 'code']);
                    $rabatt = ['rabatt_code' => $rc['code'], 'rabatt_cent' => $cent];
                } else {
                    $rabatt = ['rabatt_code' => $g['code'], 'rabatt_cent' => null];
                }
            }
            $r = bucheTermin([
                'salon' => $salon, 'leistungen' => $leistungen, 'start' => $start, 'person' => $person,
                'kunde_id' => $kunde, 'gast_name' => $name, 'kundennotiz' => text_feld('notiz', 600),
                'quelle' => str_starts_with((string)$ref, 'recall-') ? 'recall' : 'online', 'ref' => $ref, 'anfrage_id' => $anfrage, 'kanal' => 'online',
            ]);
            $r['doi'] = [];
            if (!$r['wiederholt']) {
                if ($rabatt) db()->aendern('termin', $rabatt, 'id = ?', [$r['termin']['id']]);
                if ($kunde) {
                    $r['doi'] = einwilligungen_speichern($kunde, $zustimmung, 'online', $r['termin']['id']);
                    require_once __DIR__ . '/nachrichten.php';
                    herkunft_zuordnen($ref, $kunde, (int)$r['termin']['id']);
                }
            }
            $r['kunde'] = $kunde;
            return $r;
        });
    } catch (PDOException $ex) {
        // Doppelt abgeschickt, beide gleichzeitig: der zweite trifft den eindeutigen Schlüssel.
        if ($anfrage && (($ex->errorInfo[0] ?? '') === '23000' || str_contains($ex->getMessage(), 'UNIQUE'))
            && ($tok = db()->wert('SELECT token FROM {p}termin WHERE anfrage_id = ?', [$anfrage]))) {
            return oeffentlicher_termin((string)$tok) + ['wiederholt' => true];
        }
        throw $ex;
    }
    // Erst nach dem COMMIT: Bestätigung aus dem gespeicherten Stand.
    if (!$r['wiederholt']) {
        require_once __DIR__ . '/nachrichten.php';
        post_bestaetigung($r['termin'], $email);
        foreach ($r['doi'] as $tok) doi_senden((int)$r['kunde'], $tok);
    }
    return oeffentlicher_termin($r['termin']['token']) + ['wiederholt' => $r['wiederholt'], 'bestaetigen' => (bool)$r['doi']];
}

/**
 * Verschieben über den Link: eine eigene, atomare Aktion. Derselbe Termin
 * bekommt die neue Zeit; der alte Platz wird erst frei, wenn der neue
 * sicher gebucht ist. Ist der neue weg, bleibt der alte unverändert.
 * Eine gewählte Person bleibt verbindlich.
 */
function aktion_verschieben(): array
{
    methode('POST');
    bremse('token', ip(), 60, 600);
    $token = text_feld('ersetzt', 32) ?? text_feld('t', 64, true);
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) throw new Fehler('Diesen Termin gibt es nicht.', 404, 'unbekannt');
    $start = zeitpunkt_pruefen(text_feld('start', 20, true));
    $t = db()->eins('SELECT * FROM {p}termin WHERE token = ?', [$token]);
    if (!$t) throw new Fehler('Diesen Termin gibt es nicht.', 404, 'unbekannt');
    if ($t['status'] !== 'gebucht' || !storno_moeglich($t)) {
        throw new Fehler('Der Termin kann nicht mehr online verschoben werden. Bitte rufen Sie an.', 409, 'storno_frist');
    }
    $r = bucheTermin(['termin_id' => (int)$t['id'], 'start' => $start, 'kanal' => 'online']);
    if ($r['vorher']) {
        require_once __DIR__ . '/nachrichten.php';
        post_aenderung($r['vorher'], $r['termin']);
        nach_freigabe($t['salon_id'], substr($t['start'], 0, 10));
    }
    $aus = oeffentlicher_termin($token);
    if ($r['vorher']) $aus['vorher'] = ['start' => $r['vorher']['start'], 'ende' => $r['vorher']['ende'], 'person_name' => $r['vorher']['person_name']];
    return $aus;
}

/**
 * Ist meine Buchung angekommen? Die Seite fragt mit ihrer Anfrage-Kennung
 * nach, wenn die Antwort ausblieb (Netz weg, Seite hing). Die Kennung ist
 * zufällig und nur der Seite bekannt, die gebucht hat.
 */
function aktion_anfrage(): array
{
    bremse('token', ip(), 60, 600);
    $anfrage = text_feld('anfrage_id', 64, true);
    if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $anfrage)) throw new Fehler('Unbekannte Anfrage.', 404, 'unbekannt');
    $tok = db()->wert('SELECT token FROM {p}termin WHERE anfrage_id = ?', [$anfrage]);
    if (!$tok) return ['angekommen' => false];
    return ['angekommen' => true, 'termin' => oeffentlicher_termin((string)$tok)];
}

/** Für die Überwachung (Uptime-Check): antwortet die Datenbank? */
function aktion_gesund(): array
{
    $stand = (int)db()->wert("SELECT wert FROM {p}zaehler WHERE name = 'stand'");
    return ['ok' => true, 'zeit' => jetzt(), 'stand' => $stand > 0];
}

function storno_moeglich(array $t): bool
{
    $frist = (int)einstellungen()['stornofrist'];
    return strtotime($t['start']) - time() >= $frist * 3600;
}

function oeffentlicher_termin(string $token): array
{
    $t = db()->eins('SELECT * FROM {p}termin WHERE token = ?', [$token]);
    if (!$t) throw new Fehler('Diesen Termin gibt es nicht (mehr).', 404, 'unbekannt');
    $a = termine_aufbereiten([$t], false)[0];
    $s = db()->eins('SELECT id, name, strasse, ort, telefon, telefon_text, lat, lon FROM {p}salon WHERE id = ?', [$t['salon_id']]);
    $a['salon'] = $s;
    $a['token'] = $token;
    $a['storno_moeglich'] = $t['status'] === 'gebucht' && storno_moeglich($t);
    $a['vergangen'] = $t['start'] < jetzt();
    $a['wunsch_person'] = (bool)$t['wunsch_person'];
    $a['storniert'] = storniert($t['status']);
    // Für „Erinnerung einschalten?“ nach dem Buchen: was schon gilt.
    if ($t['kunde_id']) {
        $ew = einwilligungen_lesen((int)$t['kunde_id']);
        $a['einwilligungen'] = array_map(fn($x) => $x ? ['erteilt' => $x['erteilt'], 'wartet' => !empty($x['wartet'])] : null, $ew);
        require_once __DIR__ . '/verkauf.php';
        $a['treue'] = treue_stand((int)$t['kunde_id']);
        $k = db()->eins('SELECT telefon, email FROM {p}kunde WHERE id = ?', [$t['kunde_id']]);
        $a['hat_email'] = !empty($k['email']);
        $a['hat_telefon'] = !empty($k['telefon']);
    }
    return $a;
}

function aktion_termin(): array
{
    bremse('token', ip(), 60, 600);
    $token = text_feld('t', 64, true);
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) throw new Fehler('Diesen Termin gibt es nicht.', 404, 'unbekannt');
    return oeffentlicher_termin($token);
}

function aktion_stornieren(): array
{
    methode('POST');
    bremse('token', ip(), 60, 600);
    $token = text_feld('t', 64, true);
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) throw new Fehler('Diesen Termin gibt es nicht.', 404, 'unbekannt');
    $neu = db()->schreiben(function (DB $db) use ($token) {
        $t = $db->eins('SELECT * FROM {p}termin WHERE token = ?', [$token]);
        if (!$t) throw new Fehler('Diesen Termin gibt es nicht.', 404, 'unbekannt');
        if (storniert($t['status'])) return false;
        if ($t['status'] !== 'gebucht' || !storno_moeglich($t)) {
            throw new Fehler('So kurz vorher geht das nur telefonisch.', 409, 'storno_frist');
        }
        $db->aendern('termin', ['status' => 'storniert_kunde', 'storniert_am' => jetzt(), 'geaendert' => jetzt(),
            'version' => (int)$t['version'] + 1], 'id = ?', [$t['id']]);
        $db->q('DELETE FROM {p}belegung WHERE termin_id = ?', [$t['id']]);
        $db->standErhoehen();
        protokoll('online_storniert', (int)$t['id'], $t['kunde_id'] ? (int)$t['kunde_id'] : null,
            ['status' => [$t['status'], 'storniert_kunde']], null);
        return true;
    });
    if ($neu) {
        require_once __DIR__ . '/nachrichten.php';
        post_storno($token);
        $t = db()->eins('SELECT salon_id, start FROM {p}termin WHERE token = ?', [$token]);
        nach_freigabe($t['salon_id'], substr($t['start'], 0, 10));
    }
    return oeffentlicher_termin($token);
}

/* ── Nachrichten, Warteliste, Codes ─────────────────────────────────── */

/** Nach dem Buchen: „Erinnerung per SMS einschalten?“ — derselbe Wortlaut,
    Quelle „online_danach“. Wer den Link zum Termin hat, darf das. */
function aktion_einwilligung(): array
{
    methode('POST');
    bremse('token', ip(), 60, 600);
    $token = text_feld('t', 64, true);
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) throw new Fehler('Diesen Termin gibt es nicht.', 404, 'unbekannt');
    $art = (string)feld('art');
    if (!isset(EINWILLIGUNGEN[$art])) throw new Fehler('Unbekannt.', 422);
    $t = db()->eins('SELECT id, kunde_id FROM {p}termin WHERE token = ?', [$token]);
    if (!$t || !$t['kunde_id']) throw new Fehler('Diesen Termin gibt es nicht.', 404, 'unbekannt');
    $kunde = (int)$t['kunde_id'];
    $doi = db()->schreiben(fn() => einwilligungen_speichern($kunde, [$art => true], 'online_danach', (int)$t['id']));
    if ($doi) { require_once __DIR__ . '/nachrichten.php'; foreach ($doi as $tok) doi_senden($kunde, $tok); }
    return oeffentlicher_termin($token) + ['bestaetigen' => (bool)$doi];
}

/** „Ihre Nachrichten“: was die Kundin bekommt, über den Link aus jeder Nachricht. */
function aktion_kundin_nachrichten(): array
{
    bremse('token', ip(), 60, 600);
    require_once __DIR__ . '/nachrichten.php';
    $id = kunde_aus_schluessel(text_feld('k', 40));
    if (!$id) throw new Fehler('Dieser Link ist ungültig. Rufen Sie uns gern an.', 404, 'unbekannt');
    return kundin_nachrichten_daten($id);
}

function kundin_nachrichten_daten(int $id): array
{
    $k = db()->eins('SELECT * FROM {p}kunde WHERE id = ? AND geloescht = 0', [$id]);
    if (!$k) throw new Fehler('Zu diesem Link gibt es keine Daten mehr.', 404, 'unbekannt');
    $mask = fn(?string $s, int $sichtbar) => $s ? mb_substr($s, 0, $sichtbar) . str_repeat('•', max(3, mb_strlen($s) - $sichtbar - 3)) . mb_substr($s, -3) : null;
    return ['vorname' => $k['vorname'], 'einwilligungen' => einwilligungen_lesen($id), 'texte' => EINWILLIGUNGEN,
        'telefon' => $mask(telefon_anzeige($k['telefon']), 4), 'email' => $mask($k['email'], 2),
        'gesperrt' => ['sms' => $k['telefon'] ? gesperrt('sms', $k['telefon']) : false, 'email' => $k['email'] ? gesperrt('email', $k['email']) : false],
        'warteliste' => (int)db()->wert("SELECT COUNT(*) FROM {p}warteliste WHERE kunde_id = ? AND status = 'aktiv'", [$id])];
}

/** Abbestellen oder ändern — auch mit einem Klick aus dem Mailprogramm. */
function aktion_abbestellen(): array
{
    methode('POST');
    bremse('token', ip(), 60, 600);
    require_once __DIR__ . '/nachrichten.php';
    $id = kunde_aus_schluessel(text_feld('k', 40));
    if (!$id) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    $k = db()->eins('SELECT * FROM {p}kunde WHERE id = ? AND geloescht = 0', [$id]);
    if (!$k) throw new Fehler('Zu diesem Link gibt es keine Daten mehr.', 404, 'unbekannt');
    $alle = in_array(feld('alle'), [true, '1', 1], true) || feld('List-Unsubscribe') === 'One-Click';
    $doi = db()->schreiben(function () use ($id, $k, $alle) {
        if ($alle) {
            kundin_abmelden($id, 'link');
            if ($k['telefon']) sperren('sms', $k['telefon'], 'link');
            if ($k['email']) sperren('email', $k['email'], 'link');
            return [];
        }
        $arten = is_array(feld('arten')) ? feld('arten') : [];
        $doi = [];
        foreach ($arten as $art => $an) {
            if (!isset(EINWILLIGUNGEN[$art]) || !is_bool($an)) continue;
            if ($an) $doi = array_merge($doi, einwilligungen_speichern($id, [$art => true], 'link'));
            else einwilligung_setzen($id, $art, false, 'link');
        }
        // Wer etwas wieder einschaltet, will auch wieder erreichbar sein.
        if (array_filter($arten, fn($x) => $x === true)) {
            if ($k['telefon']) entsperren('sms', $k['telefon']);
            if ($k['email']) entsperren('email', $k['email']);
        }
        return $doi;
    });
    foreach ($doi as $tok) doi_senden($id, $tok);
    return kundin_nachrichten_daten($id) + ['bestaetigen' => (bool)$doi];
}

/** Double-Opt-in: der Klick auf den Link in der Bestätigungsnachricht. */
function aktion_bestaetigen(): array
{
    methode('POST');
    bremse('token', ip(), 60, 600);
    $token = text_feld('b', 40, true);
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    require_once __DIR__ . '/nachrichten.php';
    $b = db()->eins('SELECT * FROM {p}bestaetigung WHERE token = ?', [$token]);
    if (!$b) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    if ($b['erstellt'] < date('Y-m-d H:i:s', time() - 30 * 86400) && !$b['bestaetigt']) throw new Fehler('Dieser Link ist abgelaufen. Sie können die Angebote auf der Buchungsseite neu bestellen.', 410, 'abgelaufen');
    db()->schreiben(function () use ($b) {
        if ($b['bestaetigt']) return;
        db()->aendern('bestaetigung', ['bestaetigt' => jetzt()], 'id = ?', [$b['id']]);
        if (!einwilligung_aktiv((int)$b['kunde_id'], $b['art'])) {
            db()->einfuegen('einwilligung', ['kunde_id' => $b['kunde_id'], 'art' => $b['art'], 'erteilt' => 1, 'zeit' => jetzt(),
                'quelle' => 'bestaetigt_' . substr($b['quelle'], 0, 5), 'wortlaut' => EINWILLIGUNGEN[$b['art']], 'termin_id' => null]);
            protokoll('einwilligung', null, (int)$b['kunde_id'], ['art' => $b['art'], 'quelle' => 'bestaetigt']);
        }
    });
    return ['ok' => true, 'art' => $b['art'], 'k' => kunde_schluessel((int)$b['kunde_id'])];
}

/** Auf die Warteliste: Name und Nummer wie beim Buchen. */
function aktion_warteliste(): array
{
    methode('POST');
    if (text_feld('webseite')) throw new Fehler('Der Eintrag konnte nicht gespeichert werden.', 422);
    bremse('warteliste', ip(), (int)konfig('bremse_buchen', 30), 3600);
    if (!einstellungen()['warteliste_aktiv']) throw new Fehler('Die Warteliste ist gerade nicht offen. Bitte rufen Sie an.', 409, 'aus');
    [$salon, $leistungen, $person] = auswahl_lesen();
    $name = text_feld('name', 160, true);
    if (mb_strlen($name) < 2) throw new Fehler('Bitte Ihren Namen angeben.', 422, 'pflicht', ['feld' => 'name']);
    $telefon = telefon_normal(text_feld('telefon', 40, true));
    if (!$telefon) throw new Fehler('Bitte eine Handynummer angeben, unter der wir Sie erreichen (z. B. 0176 1234567).', 422, 'telefon', ['feld' => 'telefon']);
    $emailRoh = text_feld('email', 190);
    $email = email_normal($emailRoh);
    if ($emailRoh && !$email) throw new Fehler('Diese E-Mail-Adresse sieht nicht richtig aus.', 422, 'email', ['feld' => 'email']);
    require_once __DIR__ . '/nachrichten.php';
    [$vor, $nach] = name_teilen($name);
    $w = db()->schreiben(function () use ($vor, $nach, $telefon, $email, $salon, $leistungen, $person) {
        $kunde = kunde_zu_telefon($vor, $nach, $telefon, $email);
        // Wer sich einträgt, will die Nachricht: eine frühere STOP-Sperre fällt.
        entsperren('sms', $telefon);
        return warteliste_eintragen(['kunde_id' => $kunde, 'salon' => $salon, 'leistungen' => array_column($leistungen, 'id'),
            'person' => $person, 'von' => (string)feld('von', date('Y-m-d')), 'bis' => (string)feld('bis'), 'tageszeit' => (string)feld('tageszeit', 'egal'),
            'quelle' => 'online', 'notiz' => text_feld('notiz', 255), 'online' => true]);
    });
    post_salon($salon, 'Warteliste: ' . $name, "Neu auf der Warteliste

$name · " . telefon_anzeige($telefon) . "
"
        . implode(' + ', $w['leistungen_namen']) . "
" . $w['von'] . ' bis ' . $w['bis'] . ' · ' . $w['tageszeit'] . "
");
    // Ist gerade etwas frei, kommt die Nachricht gleich.
    nach_antwort(function () use ($w) { $ids = warteliste_abgleich($w['salon']); if ($ids) warteschlange_abarbeiten(10, $ids); });
    return ['ok' => true, 'von' => $w['von'], 'bis' => $w['bis'], 'tageszeit' => $w['tageszeit'], 'token' => $w['token'],
        'kanal' => sms_aktiv() ? 'sms' : ($email && post_aktiv() ? 'email' : null)];
}

function aktion_warteliste_austragen(): array
{
    methode('POST');
    bremse('token', ip(), 60, 600);
    $token = text_feld('wl', 40, true);
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    $n = db()->schreiben(function (DB $db) use ($token) {
        $w = $db->eins('SELECT * FROM {p}warteliste WHERE token = ?', [$token]);
        if (!$w) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
        if ($w['status'] === 'aktiv') {
            $db->aendern('warteliste', ['status' => 'entfernt'], 'id = ?', [$w['id']]);
            $db->q("UPDATE {p}angebot SET status = 'zurueckgezogen' WHERE warteliste_id = ? AND status = 'offen'", [$w['id']]);
            $db->standErhoehen();
            protokoll('warteliste_ausgetragen', null, (int)$w['kunde_id'], ['id' => (int)$w['id']]);
        }
        return $w;
    });
    return ['ok' => true, 'bis' => $n['bis']];
}

/** Ein Platz von der Warteliste: noch zu haben? */
function aktion_angebot(): array
{
    bremse('token', ip(), 60, 600);
    $token = text_feld('w', 40, true);
    if (!preg_match('/^[a-f0-9]{24}$/', $token)) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    require_once __DIR__ . '/nachrichten.php';
    $a = db()->eins('SELECT * FROM {p}angebot WHERE token = ?', [$token]);
    if (!$a) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    [$a, $w] = angebot_pruefen($a);
    return angebot_aufbereiten($a, $w);
}

function angebot_aufbereiten(array $a, ?array $w): array
{
    $db = db();
    $aus = ['status' => $a['status'], 'start' => substr($a['start'], 0, 16), 'salon' => $db->eins('SELECT id, name, strasse, ort, telefon, telefon_text FROM {p}salon WHERE id = ?', [$a['salon_id']])];
    if ($w) {
        $ids = json_decode($w['leistungen'], true) ?: [];
        $ls = $ids ? $db->alle('SELECT id, name, laenge, phasen, preis_cent, preis_ab FROM {p}leistung WHERE id IN (' . DB::liste($ids) . ')', $ids) : [];
        $dauer = array_sum(array_map(fn($l) => phasen_dauer(json_decode($l['phasen'], true)), $ls));
        $aus['ende'] = substr(zeit_plus($a['start'], $dauer), 0, 16);
        $aus['leistungen'] = array_map(fn($l) => ['id' => $l['id'], 'name' => $l['name'], 'laenge' => $l['laenge']], $ls);
        $aus['person_name'] = (string)$db->wert('SELECT name FROM {p}person WHERE id = ?', [$a['person_id']]);
        $aus['vorname'] = (string)$db->wert('SELECT vorname FROM {p}kunde WHERE id = ?', [$w['kunde_id']]);
        $aus['warteliste'] = ['bis' => $w['bis'], 'aktiv' => $w['status'] === 'aktiv', 'token' => $w['token']];
    }
    if ($a['status'] === 'angenommen' && $a['termin_id']) $aus['termin'] = oeffentlicher_termin((string)$db->wert('SELECT token FROM {p}termin WHERE id = ?', [$a['termin_id']]));
    return $aus;
}

/** Wer zuerst tippt, bekommt den Platz. Derselbe Link zweimal ergibt
    denselben Termin (die Angebotsnummer ist die Anfrage-Kennung). */
function aktion_angebot_annehmen(): array
{
    methode('POST');
    bremse('token', ip(), 60, 600);
    $token = text_feld('w', 40, true);
    if (!preg_match('/^[a-f0-9]{24}$/', $token)) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    require_once __DIR__ . '/nachrichten.php';
    $a = db()->eins('SELECT * FROM {p}angebot WHERE token = ?', [$token]);
    if (!$a) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    if ($a['status'] === 'angenommen') return angebot_aufbereiten($a, db()->eins('SELECT * FROM {p}warteliste WHERE id = ?', [$a['warteliste_id']]));
    [$a, $w] = angebot_pruefen($a);
    if ($a['status'] !== 'offen' || !$w) {
        throw new Fehler('Schade — dieser Platz ist schon vergeben. Ihr Platz auf der Warteliste bleibt; wir melden uns beim nächsten.', 409, 'vergeben', angebot_aufbereiten($a, $w));
    }
    $k = db()->eins('SELECT * FROM {p}kunde WHERE id = ?', [$w['kunde_id']]);
    try {
        $r = bucheTermin(['salon' => $w['salon_id'], 'leistungen' => leistungen_laden(json_decode($w['leistungen'], true), $w['salon_id'], true),
            'start' => $a['start'], 'person' => $w['person_id'] ?: null, 'kunde_id' => (int)$w['kunde_id'],
            'gast_name' => trim($k['vorname'] . ' ' . $k['nachname']), 'quelle' => 'warteliste', 'ref' => 'warteliste-' . $w['id'],
            'anfrage_id' => 'angebot-' . $a['id'] . '-' . substr($token, 0, 8), 'kanal' => 'online']);
    } catch (Fehler $e) {
        if ($e->status === 409) {
            db()->aendern('angebot', ['status' => 'vergeben'], 'id = ?', [$a['id']]);
            $a['status'] = 'vergeben';
            throw new Fehler('Schade — jemand war schneller. Ihr Platz auf der Warteliste bleibt; wir melden uns beim nächsten.', 409, 'vergeben', angebot_aufbereiten($a, $w));
        }
        throw $e;
    }
    $tid = (int)$r['termin']['id'];
    db()->schreiben(function (DB $db) use ($a, $w, $tid) {
        $db->aendern('angebot', ['status' => 'angenommen', 'termin_id' => $tid], 'id = ?', [$a['id']]);
        $db->aendern('warteliste', ['status' => 'gebucht', 'termin_id' => $tid], 'id = ?', [$w['id']]);
        // Derselbe Platz für die anderen: weg. Weitere Angebote dieses Eintrags: überholt.
        $db->q("UPDATE {p}angebot SET status = 'vergeben' WHERE status = 'offen' AND salon_id = ? AND start = ? AND id <> ?", [$a['salon_id'], $a['start'], $a['id']]);
        $db->q("UPDATE {p}angebot SET status = 'ueberholt' WHERE status = 'offen' AND warteliste_id = ?", [$w['id']]);
        protokoll('warteliste_gebucht', $tid, (int)$w['kunde_id'], ['angebot' => (int)$a['id']]);
    });
    if (!$r['wiederholt']) {
        post_bestaetigung($r['termin'], null);
        post_salon($w['salon_id'], 'Warteliste gebucht: ' . termin_zeile(termin_lesen($tid), salon_lesen($w['salon_id'])),
            "Eine Lücke ist gefüllt: " . trim($k['vorname'] . ' ' . $k['nachname']) . " hat den freien Platz von der Warteliste genommen.
");
    }
    $a['status'] = 'angenommen'; $a['termin_id'] = $tid;
    return angebot_aufbereiten($a, $w);
}

/** Recall-Link „?r=…“: die Auswahl von damals, damit nur noch die Zeit fehlt. */
function aktion_recall_link(): array
{
    bremse('token', ip(), 60, 600);
    $token = text_feld('r', 20, true);
    if (!preg_match('/^[a-f0-9]{16}$/', $token)) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    $r = db()->eins('SELECT * FROM {p}recall WHERE token = ?', [$token]);
    if (!$r) throw new Fehler('Dieser Link ist ungültig.', 404, 'unbekannt');
    $t = db()->eins('SELECT * FROM {p}termin WHERE id = ?', [$r['letzter_termin_id']]);
    $ids = array_values(array_filter(array_column(db()->alle('SELECT leistung_id FROM {p}termin_posten WHERE termin_id = ? ORDER BY pos', [$t['id']]), 'leistung_id')));
    $online = $ids ? array_column(db()->alle('SELECT id FROM {p}leistung WHERE aktiv = 1 AND online = 1 AND salon_id = ? AND id IN (' . DB::liste($ids) . ')', array_merge([$t['salon_id']], $ids)), 'id') : [];
    $person = db()->wert('SELECT 1 FROM {p}person WHERE id = ? AND aktiv = 1 AND online = 1', [$t['person_id']]) ? $t['person_id'] : null;
    return ['salon' => $t['salon_id'], 'leistungen' => array_values(array_filter($ids, fn($i) => in_array($i, $online, true))), 'person' => $person,
        'ref' => 'recall-' . $token, 'vorname' => (string)db()->wert('SELECT vorname FROM {p}kunde WHERE id = ?', [$r['kunde_id']])];
}

/** Gutschein- oder Aktionscode prüfen, bevor gebucht wird. */
function aktion_code_pruefen(): array
{
    bremse('code', ip(), 20, 600);
    require_once __DIR__ . '/verkauf.php';
    $code = code_normal(text_feld('code', 24, true));
    $r = rabatt_finden($code);
    if ($r) {
        $preis = null;
        $salon = text_feld('salon', 32);
        $ids = feld('leistungen');
        if ($salon && $ids) { try { $preis = preis_aus(leistungen_laden(is_array($ids) ? $ids : explode(',', (string)$ids), $salon, true))[0]; } catch (Fehler $e) { $preis = null; } }
        [$cent, $warum] = rabatt_anwenden($r, $preis, null);
        if ($warum) throw new Fehler($warum, 422, 'code', ['feld' => 'code']);
        return ['art' => 'rabatt', 'code' => $r['code'], 'name' => $r['name'], 'text' => rabatt_text($r), 'rabatt_cent' => $cent,
            'nur_neu' => (bool)$r['nur_neu'], 'bis' => $r['bis']];
    }
    $g = gutschein_finden($code);
    if (!$g || $g['status'] !== 'aktiv' || (int)$g['rest_cent'] <= 0) throw new Fehler('Diesen Code kennen wir nicht (oder er ist abgelaufen oder aufgebraucht).', 422, 'code', ['feld' => 'code']);
    return ['art' => 'gutschein', 'code' => $g['code'], 'rest_cent' => (int)$g['rest_cent'], 'gueltig_bis' => $g['gueltig_bis'], 'leistung' => $g['leistung']];
}

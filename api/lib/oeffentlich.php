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
            'personen' => $zuordnung[$l['id']],
        ];
    }
    return [
        'salons' => $salons, 'personen' => $personen, 'leistungen' => $leistungen,
        'gruppen' => json_decode((string)$db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'gruppen'"), true),
        'regeln' => ['raster' => (int)$e['raster'], 'horizont' => (int)$e['horizont'], 'stornofrist' => (int)$e['stornofrist'],
                     'online_aktiv' => (bool)$e['online_aktiv'], 'hinweis' => (string)$e['hinweis']],
        'heute' => date('Y-m-d'), 'jetzt' => date('H:i'),
    ];
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
    $anfrage = text_feld('anfrage_id', 64);
    if ($anfrage !== null && !preg_match('/^[A-Za-z0-9-]{8,64}$/', $anfrage)) $anfrage = null;
    $ersetzt = text_feld('ersetzt', 32);

    $e = einstellungen();
    $offen = (int)db()->wert("SELECT COUNT(*) FROM {p}termin t JOIN {p}kunde k ON k.id = t.kunde_id
        WHERE k.telefon = ? AND t.status = 'gebucht' AND t.start > ? AND t.quelle = 'online'" . ($ersetzt ? ' AND t.token <> ?' : ''),
        array_merge([$telefon, jetzt()], $ersetzt ? [$ersetzt] : []));
    if ($offen >= (int)$e['max_offen']) {
        throw new Fehler('Unter dieser Nummer sind schon mehrere Termine offen. Bitte rufen Sie uns an.', 409, 'zu_viele');
    }

    [$vor, $nach] = name_teilen($name);
    try {
        $termin = db()->schreiben(function (DB $db) use ($salon, $leistungen, $person, $start, $vor, $nach, $telefon, $email, $name, $anfrage, $ersetzt) {
            $alt = null;
            if ($ersetzt) {
                $alt = $db->eins('SELECT * FROM {p}termin WHERE token = ?', [$ersetzt]);
                if (!$alt || $alt['status'] !== 'gebucht' || !storno_moeglich($alt)) {
                    throw new Fehler('Der bisherige Termin kann nicht mehr online verschoben werden. Bitte rufen Sie an.', 409, 'storno_frist');
                }
            }
            $kunde = kunde_zu_telefon($vor, $nach, $telefon, $email);
            if ($alt) {
                // Erst den alten freigeben, damit derselbe Platz wieder wählbar ist.
                $db->personenSperren([$alt['person_id']]);
                $db->aendern('termin', ['status' => 'storniert', 'storniert_am' => jetzt(), 'geaendert' => jetzt(),
                    'version' => (int)$alt['version'] + 1], 'id = ?', [$alt['id']]);
                $db->q('DELETE FROM {p}belegung WHERE termin_id = ?', [$alt['id']]);
                protokoll('online_umgebucht', (int)$alt['id'], $kunde, [], null);
            }
            return termin_anlegen([
                'salon' => $salon, 'leistungen' => $leistungen, 'start' => $start, 'person' => $person,
                'kunde_id' => $kunde, 'gast_name' => $name, 'kundennotiz' => text_feld('notiz', 600),
                'quelle' => 'online', 'anfrage_id' => $anfrage, 'online' => true,
            ]);
        });
    } catch (PDOException $ex) {
        // Doppelt abgeschickt, beide gleichzeitig: der zweite trifft den eindeutigen Schlüssel.
        if ($anfrage && (($ex->errorInfo[0] ?? '') === '23000' || str_contains($ex->getMessage(), 'UNIQUE'))) {
            $id = db()->wert('SELECT id FROM {p}termin WHERE anfrage_id = ?', [$anfrage]);
            if ($id) $termin = termin_lesen((int)$id) + ['wiederholt' => true];
            else throw $ex;
        } else {
            throw $ex;
        }
    }
    if (empty($termin['wiederholt'])) {
        require_once __DIR__ . '/post.php';
        post_bestaetigung($termin, $email);
    }
    return oeffentlicher_termin($termin['token']);
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
    db()->schreiben(function (DB $db) use ($token) {
        $t = $db->eins('SELECT * FROM {p}termin WHERE token = ?', [$token]);
        if (!$t) throw new Fehler('Diesen Termin gibt es nicht.', 404, 'unbekannt');
        if ($t['status'] === 'storniert') return;
        if ($t['status'] !== 'gebucht' || !storno_moeglich($t)) {
            throw new Fehler('So kurz vorher geht das nur telefonisch.', 409, 'storno_frist');
        }
        $db->aendern('termin', ['status' => 'storniert', 'storniert_am' => jetzt(), 'geaendert' => jetzt(),
            'version' => (int)$t['version'] + 1], 'id = ?', [$t['id']]);
        $db->q('DELETE FROM {p}belegung WHERE termin_id = ?', [$t['id']]);
        $db->standErhoehen();
        protokoll('online_storniert', (int)$t['id'], $t['kunde_id'] ? (int)$t['kunde_id'] : null, [], null);
    });
    require_once __DIR__ . '/post.php';
    post_storno_salon($token);
    return oeffentlicher_termin($token);
}

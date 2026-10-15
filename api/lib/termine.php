<?php
/* Termine und Kunden anlegen, ändern, lesen — gemeinsam für die
   Online-Buchung und das Studio. Alles, was schreibt, läuft in
   DB::schreiben() und sperrt vorher die betroffenen Personen. */

declare(strict_types=1);

/** Name in Vor- und Nachname teilen: das letzte Wort ist der Nachname. */
function name_teilen(string $name): array
{
    $name = trim(preg_replace('/\s+/u', ' ', $name));
    $teile = explode(' ', $name);
    if (count($teile) === 1) return [$teile[0], null];
    $nach = array_pop($teile);
    return [implode(' ', $teile), $nach];
}

function kunde_suchtext(array $k): string
{
    $tel = $k['telefon'] ?? null;
    return suchtext([$k['vorname'] ?? null, $k['nachname'] ?? null, $tel, $tel ? '0' . substr($tel, 3) : null, $k['email'] ?? null]);
}

/** Kunde über die Telefonnummer finden oder neu anlegen. */
function kunde_zu_telefon(?string $vorname, ?string $nachname, ?string $telefon, ?string $email): ?int
{
    $db = db();
    if ($telefon) {
        $k = $db->eins('SELECT * FROM {p}kunde WHERE telefon = ? AND geloescht = 0 ORDER BY id LIMIT 1', [$telefon]);
        if ($k) {
            // Fehlendes ergänzen, Vorhandenes nicht überschreiben — die Kartei
            // pflegt das Studio.
            $neu = [];
            if (!$k['email'] && $email) $neu['email'] = $email;
            if (!$k['nachname'] && $nachname) $neu['nachname'] = $nachname;
            if (!$k['vorname'] && $vorname) $neu['vorname'] = $vorname;
            if ($neu) {
                $neu['geaendert'] = jetzt();
                $neu['suche'] = kunde_suchtext(array_merge($k, $neu));
                $db->aendern('kunde', $neu, 'id = ?', [$k['id']]);
            }
            return (int)$k['id'];
        }
    }
    if (!$vorname && !$nachname) return null;
    $k = ['vorname' => $vorname, 'nachname' => $nachname, 'telefon' => $telefon, 'email' => $email,
          'erstellt' => jetzt(), 'geaendert' => jetzt(), 'geloescht' => 0];
    $k['suche'] = kunde_suchtext($k);
    return $db->einfuegen('kunde', $k);
}

/**
 * bucheTermin() — die einzige Stelle, die Termine anlegt oder zeitlich
 * verändert. Online, Telefon, Kasse (und später Warteliste und Recall)
 * laufen alle hierüber; kein anderer Code schreibt Zeiten in {p}termin.
 *
 * Ablauf, alles in einer Transaktion:
 *   1. BEGIN (SQLite: BEGIN IMMEDIATE, sperrt sofort)
 *   2. Sperre auf die betroffenen Personen (MySQL: SELECT … FOR UPDATE) —
 *      gleichzeitige Buchungen derselben Person warten aufeinander
 *   3. Verfügbarkeit in der Transaktion neu prüfen (nie dem Browser trauen)
 *   4. Termin, Posten und Belegung schreiben, Protokoll mit vorher/nachher
 *   5. COMMIT — erst danach Bestätigung zeigen und versenden (Aufrufer)
 * Bei einer Kollision wird alles zurückgerollt; online kommen drei
 * Ausweichzeiten mit.
 *
 * $o:
 *   termin_id     gesetzt = verschieben. Atomar: Der alte Platz wird erst
 *                 frei, wenn der neue sicher gebucht ist; derselbe Termin
 *                 (gleicher Link, gleiche Nummer), neue Version.
 *   version       Stand, den der Aufrufer kennt (Studio: Pflicht beim Verschieben)
 *   salon, leistungen (geladen), phasen (eigener Ablauf, Studio), start
 *   person        null = wer frei ist; gesetzt = verbindlich
 *   kanal         'online' (strenge Regeln: Vorlauf, Horizont, nur freie
 *                 Zeiten) oder 'studio'
 *   ausserhalb_ok nur Studio: außerhalb der eingetragenen Arbeitszeit bei
 *                 offenem Salon bewusst buchen. Überschneidungen, Abwesenheit,
 *                 Schließtage und Feiertage blocken immer.
 *   status        beim Wiederbeleben einer Absage: 'gebucht'
 *   kunde_id, gast_name, notiz, kundennotiz, quelle, ref, anfrage_id, preis_cent
 * Rückgabe: ['termin' => Termin aus der DB, 'vorher' => alter Stand | null,
 *            'wiederholt' => true, wenn die Anfrage schon gebucht war]
 */
function bucheTermin(array $o): array
{
    return db()->schreiben(function (DB $db) use ($o) {
        $online = ($o['kanal'] ?? 'studio') === 'online';
        $anfrage = $o['anfrage_id'] ?? null;
        $tid = isset($o['termin_id']) ? (int)$o['termin_id'] : null;

        // Idempotenz: dieselbe Anfrage-Kennung ergibt denselben Termin.
        if ($anfrage && !$tid && ($alt = $db->wert('SELECT id FROM {p}termin WHERE anfrage_id = ?', [$anfrage]))) {
            return ['termin' => termin_lesen((int)$alt), 'vorher' => null, 'wiederholt' => true];
        }

        $alt = null;
        if ($tid) {
            $alt = $db->eins('SELECT * FROM {p}termin WHERE id = ?', [$tid]);
            if (!$alt) throw new Fehler('Termin nicht gefunden.', 404);
        }
        $salon = $alt ? $alt['salon_id'] : $o['salon'];
        $leistungen = $o['leistungen'] ?? null;
        $phasen = $o['phasen'] ?? ($leistungen ? phasen_verketten($leistungen) : ($alt ? json_decode($alt['phasen'], true) : null));
        if (!$phasen) throw new Fehler('Bitte eine Leistung wählen.', 422, 'leistungen');
        $start = $o['start'] ?? ($alt ? $alt['start'] : null);
        if (!$start) throw new Fehler('Ungültige Uhrzeit.', 422, 'zeit');

        // Wer kommt in Frage? Eine gewählte Person ist verbindlich.
        if (array_key_exists('person', $o) && $o['person']) {
            $kandidaten = [$o['person']];
        } elseif ($alt && ($alt['wunsch_person'] || !$online)) {
            $kandidaten = [$alt['person_id']];
        } else {
            $basis = $leistungen ?? posten_leistungen($tid, $salon, $online);
            $kandidaten = $basis ? array_keys(personen_fuer($basis, $online)) : ($alt ? [$alt['person_id']] : []);
        }
        if ($online && $leistungen && count($kandidaten) === 1 && !isset(personen_fuer($leistungen, true, $kandidaten[0])[$kandidaten[0]])) {
            throw new Fehler('Diese Person bietet die Leistung nicht online an.', 422, 'person');
        }
        if (!$kandidaten) throw new Fehler('Für diese Auswahl gibt es niemanden.', 422, 'person');

        $db->personenSperren(array_merge($kandidaten, $alt ? [$alt['person_id']] : []));

        if ($anfrage && !$tid && ($nochmal = $db->wert('SELECT id FROM {p}termin WHERE anfrage_id = ?', [$anfrage]))) {
            // Doppelt abgeschickt und hinter der Sperre gewartet: das ist unser Termin.
            return ['termin' => termin_lesen((int)$nochmal), 'vorher' => null, 'wiederholt' => true];
        }
        if ($alt) {
            // Nach der Sperre frisch lesen; mit veralteter Version wird nichts gespeichert.
            $alt = $db->eins('SELECT * FROM {p}termin WHERE id = ?', [$tid]);
            if (isset($o['version']) && (int)$alt['version'] !== (int)$o['version']) {
                throw new Fehler('Der Termin wurde inzwischen geändert. Bitte neu laden.', 409, 'veraltet', ['termin' => termin_lesen($tid)]);
            }
            $neuerStatus = $o['status'] ?? $alt['status'];
            if (!in_array($neuerStatus, STATUS_BELEGT, true)) throw new Fehler('Ein abgesagter Termin lässt sich nicht verschieben.', 409, 'status');
            if ($online && $alt['status'] !== 'gebucht') throw new Fehler('Dieser Termin lässt sich online nicht mehr ändern.', 409, 'status');
            // Nichts geändert (etwa doppelt abgeschickt): derselbe Termin, keine neue Version.
            if ($alt['start'] === $start && json_decode($alt['phasen'], true) === $phasen && $alt['status'] === $neuerStatus
                && in_array($alt['person_id'], $kandidaten, true) && !$leistungen) {
                return ['termin' => termin_lesen($tid), 'vorher' => null, 'wiederholt' => true];
            }
        }

        [$person, $ausserhalb] = platz_pruefen($online, $salon, $phasen, $start, $kandidaten, $tid, !empty($o['ausserhalb_ok']), $alt);

        $ende = zeit_plus($start, phasen_dauer($phasen));
        $jetzt = jetzt();
        $wer = $GLOBALS['ANGEMELDET']['id'] ?? null;

        if ($alt) {
            $vorher = termin_lesen($tid);
            $neu = [
                'person_id' => $person, 'start' => $start, 'ende' => $ende, 'start_utc' => utc($start), 'ende_utc' => utc($ende),
                'phasen' => json_encode($phasen), 'status' => $o['status'] ?? $alt['status'],
                'version' => (int)$alt['version'] + 1, 'geaendert' => $jetzt, 'geaendert_von' => $wer,
                'erinnert' => $alt['start'] === $start ? (int)$alt['erinnert'] : 0,
                'erinnert_sms' => $alt['start'] === $start ? (int)($alt['erinnert_sms'] ?? 0) : 0,
            ];
            if (!storniert($neu['status'])) { $neu['storniert_am'] = null; $neu['storno_grund'] = null; }
            if ($leistungen) {
                $db->q('DELETE FROM {p}termin_posten WHERE termin_id = ?', [$tid]);
                posten_schreiben($tid, $leistungen);
                if (!array_key_exists('preis_cent', $o)) [$neu['preis_cent'], $neu['preis_ab']] = preis_aus($leistungen);
            }
            $db->aendern('termin', $neu, 'id = ?', [$tid]);
            belegung_schreiben($tid, $person, $start, $phasen, $neu['status']);
            $db->standErhoehen();
            $spur = ['vorher' => ['start' => $alt['start'], 'ende' => $alt['ende'], 'person' => $alt['person_id'], 'status' => $alt['status']],
                     'nachher' => ['start' => $start, 'ende' => $ende, 'person' => $person, 'status' => $neu['status']]];
            if ($ausserhalb) $spur['ausserhalb_arbeitszeit'] = true;
            protokoll($online ? 'online_verschoben' : 'termin_verschoben', $tid, $alt['kunde_id'] ? (int)$alt['kunde_id'] : null, $spur);
            return ['termin' => termin_lesen($tid), 'vorher' => $vorher, 'wiederholt' => false];
        }

        if (isset($o['preis_cent']) && is_int($o['preis_cent'])) { $preis = $o['preis_cent']; $ab = 0; }
        else [$preis, $ab] = preis_aus($leistungen ?? []);
        $id = $db->einfuegen('termin', [
            'salon_id' => $salon, 'person_id' => $person, 'kunde_id' => $o['kunde_id'] ?? null,
            'start' => $start, 'ende' => $ende, 'start_utc' => utc($start), 'ende_utc' => utc($ende),
            'phasen' => json_encode($phasen), 'status' => 'gebucht', 'quelle' => $o['quelle'] ?? 'studio', 'ref' => $o['ref'] ?? null,
            'gast_name' => $o['gast_name'] ?? null, 'notiz' => $o['notiz'] ?? null, 'kundennotiz' => $o['kundennotiz'] ?? null,
            'preis_cent' => $preis, 'preis_ab' => $ab, 'wunsch_person' => !empty($o['person']) ? 1 : 0,
            'token' => zufall(16), 'anfrage_id' => $anfrage, 'version' => 1, 'erinnert' => 0,
            'erstellt' => $jetzt, 'erstellt_von' => $wer, 'geaendert' => $jetzt, 'geaendert_von' => $wer,
        ]);
        posten_schreiben($id, $leistungen ?? []);
        belegung_schreiben($id, $person, $start, $phasen, 'gebucht');
        $db->standErhoehen();
        $spur = ['quelle' => $o['quelle'] ?? 'studio', 'nachher' => ['start' => $start, 'ende' => $ende, 'person' => $person, 'status' => 'gebucht'],
                 'wunsch_person' => !empty($o['person'])];
        if ($ausserhalb) $spur['ausserhalb_arbeitszeit'] = true;
        protokoll('termin_angelegt', $id, $o['kunde_id'] ?? null, $spur);
        return ['termin' => termin_lesen($id), 'vorher' => null, 'wiederholt' => false];
    });
}

/**
 * Ist der Platz frei? Läuft innerhalb der Sperre. Gibt [person, ausserhalb]
 * zurück oder wirft 409 — online mit drei Ausweichzeiten, im Studio mit
 * der Liste der Konflikte.
 */
function platz_pruefen(bool $online, string $salon, array $phasen, string $start, array $kandidaten, ?int $ohne, bool $ausserhalbOk, ?array $alt): array
{
    $datum = substr($start, 0, 10);
    $t = zeit_zu_min($start);
    $ende = zeit_plus($start, phasen_dauer($phasen));
    if (substr($ende, 0, 10) !== $datum && $ende !== tag_plus($datum, 1) . ' 00:00:00') throw new Fehler('Ein Termin endet am selben Tag.', 422, 'zeit');
    if (!zeitraum_eindeutig($start, $ende)) {
        throw new Fehler('In der Stunde der Zeitumstellung werden keine Termine vergeben.', 409, 'umstellung');
    }
    if ($online) {
        $e = einstellungen();
        if (!$e['online_aktiv']) throw new Fehler('Online-Buchung ist gerade pausiert. Bitte rufen Sie an.', 503, 'pausiert');
        $fr = online_fruehestens();
        $weg = fn(string $text, string $code) => new Fehler($text, 409, $code, ['alternativen' => alternativen($salon, $phasen, $kandidaten, max($start, $fr), $fr, $ohne)]);
        if ($start < $fr) throw $weg('Dieser Termin ist zu kurzfristig. Hier sind die nächsten freien Zeiten, oder rufen Sie an.', 'vergeben');
        if ($datum > tag_plus(date('Y-m-d'), (int)$e['horizont'])) throw new Fehler('So weit im Voraus ist noch nichts buchbar.', 409, 'horizont');
        $wer = freie_zeiten($salon, $phasen, $kandidaten, $datum, $datum, $fr, $ohne)[$datum][$t] ?? [];
        if (!$wer) throw $weg('Diese Uhrzeit wurde gerade vergeben. Hier sind die nächsten freien Zeiten:', 'vergeben');
        // Bleibt die bisherige Person frei, bleibt sie es auch nach dem Verschieben.
        if ($alt && in_array($alt['person_id'], $wer, true)) return [$alt['person_id'], false];
        return [count($kandidaten) === 1 ? $kandidaten[0] : beste_person($wer, $salon, $datum, $t, $phasen, $ohne), false];
    }
    if (count($kandidaten) > 1) {
        $wer = freie_zeiten($salon, $phasen, $kandidaten, $datum, $datum, null, $ohne)[$datum][$t] ?? [];
        if (!$wer) throw new Fehler('Zu dieser Zeit ist niemand frei.', 409, 'vergeben');
        return [beste_person($wer, $salon, $datum, $t, $phasen, $ohne), false];
    }
    $person = $kandidaten[0];
    $k = konflikte($person, $salon, $start, $phasen, $ohne);
    $hart = array_values(array_filter($k, fn($x) => $x['art'] !== 'ausserhalb'));
    if ($hart) throw new Fehler('Überschneidung im Kalender.', 409, 'konflikt', ['konflikte' => konflikte_beschreiben($k), 'hart' => true]);
    if ($k && !$ausserhalbOk) throw new Fehler('Außerhalb der Arbeitszeit.', 409, 'konflikt', ['konflikte' => konflikte_beschreiben($k), 'hart' => false]);
    return [$person, (bool)$k];
}

/** Die Leistungen eines bestehenden Termins (für das Verschieben ohne Wechsel). */
function posten_leistungen(?int $termin, string $salon, bool $online): ?array
{
    if (!$termin) return null;
    $ids = array_values(array_filter(array_column(db()->alle('SELECT leistung_id FROM {p}termin_posten WHERE termin_id = ? ORDER BY pos', [$termin]), 'leistung_id')));
    if (!$ids) return null;
    try { return leistungen_laden($ids, $salon, $online); } catch (Fehler $e) { return null; }
}

function posten_schreiben(int $termin, array $leistungen): void
{
    foreach ($leistungen as $i => $l) {
        db()->einfuegen('termin_posten', [
            'termin_id' => $termin, 'leistung_id' => $l['id'], 'name' => $l['name'], 'laenge' => $l['laenge'],
            'dauer' => phasen_dauer($l['phasen']), 'preis_cent' => $l['preis_cent'], 'preis_ab' => (int)$l['preis_ab'], 'pos' => $i,
        ]);
    }
}

/** Summe der Preise: [cent|null, ab(0|1)]. Unbekannter Preis → „ab“. */
function preis_aus(array $leistungen): array
{
    $preis = null; $ab = false; $bekannt = true;
    foreach ($leistungen as $l) {
        if ($l['preis_cent'] === null) $bekannt = false;
        else $preis = ($preis ?? 0) + (int)$l['preis_cent'];
        if ($l['preis_ab']) $ab = true;
    }
    return [$preis, ($ab || !$bekannt) ? 1 : 0];
}

function konflikte_beschreiben(array $k): array
{
    $aus = [];
    foreach ($k as $x) {
        if ($x['art'] === 'termin') {
            $t = db()->eins('SELECT t.start, t.ende, t.gast_name, k.vorname, k.nachname, s.name AS salon FROM {p}termin t LEFT JOIN {p}kunde k ON k.id = t.kunde_id LEFT JOIN {p}salon s ON s.id = t.salon_id WHERE t.id = ?', [$x['termin_id']]);
            $name = trim(($t['vorname'] ?? '') . ' ' . ($t['nachname'] ?? '')) ?: ($t['gast_name'] ?? 'Termin');
            $aus[] = ['art' => 'termin', 'termin_id' => $x['termin_id'], 'text' => substr($t['start'], 11, 5) . '–' . substr($t['ende'], 11, 5) . ' ' . $name . ' (Salon ' . $t['salon'] . ')'];
        } elseif ($x['art'] === 'abwesend') {
            $aus[] = ['art' => 'abwesend', 'text' => 'In dieser Zeit abwesend'];
        } elseif ($x['art'] === 'geschlossen') {
            $aus[] = ['art' => 'geschlossen', 'text' => 'Der Salon ist zu dieser Zeit geschlossen (Öffnungszeit, Feiertag oder Schließtag)'];
        } elseif ($x['art'] === 'umstellung') {
            $aus[] = ['art' => 'umstellung', 'text' => 'Stunde der Zeitumstellung'];
        } else {
            $aus[] = ['art' => 'ausserhalb', 'text' => 'Außerhalb der Arbeitszeit'];
        }
    }
    return $aus;
}

/** Termin mit Posten, Kunde und Salon, so wie Studio und Kundin ihn sehen. */
function termin_lesen(int $id, bool $intern = true): array
{
    $db = db();
    $t = $db->eins('SELECT * FROM {p}termin WHERE id = ?', [$id]);
    if (!$t) throw new Fehler('Termin nicht gefunden.', 404);
    return termine_aufbereiten([$t], $intern)[0];
}

function termine_aufbereiten(array $zeilen, bool $intern = true): array
{
    if (!$zeilen) return [];
    $db = db();
    $ids = array_map(fn($t) => (int)$t['id'], $zeilen);
    $posten = $db->alle('SELECT * FROM {p}termin_posten WHERE termin_id IN (' . DB::liste($ids) . ') ORDER BY termin_id, pos', $ids);
    $nachTermin = [];
    foreach ($posten as $p) $nachTermin[(int)$p['termin_id']][] = [
        'leistung' => $p['leistung_id'], 'name' => $p['name'], 'laenge' => $p['laenge'], 'dauer' => (int)$p['dauer'],
        'preis_cent' => $p['preis_cent'] === null ? null : (int)$p['preis_cent'], 'preis_ab' => (bool)$p['preis_ab'],
    ];
    $kundenIds = array_values(array_unique(array_filter(array_map(fn($t) => $t['kunde_id'] ? (int)$t['kunde_id'] : null, $zeilen))));
    $kunden = [];
    if ($kundenIds) {
        foreach ($db->alle('SELECT id, vorname, nachname, telefon, email, notiz, geloescht FROM {p}kunde WHERE id IN (' . DB::liste($kundenIds) . ')', $kundenIds) as $k) {
            $kunden[(int)$k['id']] = $k;
        }
        if ($intern) {
            // Besuche bisher (ohne Stornos) — fürs Studio: „Stammkundin“ oder „neu“.
            $n = $db->alle("SELECT kunde_id, COUNT(*) AS n, SUM(CASE WHEN status = 'nicht_erschienen' THEN 1 ELSE 0 END) AS weg
                FROM {p}termin WHERE kunde_id IN (" . DB::liste($kundenIds) . ") AND status NOT IN ('storniert_kunde', 'storniert_salon') GROUP BY kunde_id", $kundenIds);
            foreach ($n as $z) {
                $kunden[(int)$z['kunde_id']]['besuche'] = (int)$z['n'];
                $kunden[(int)$z['kunde_id']]['nicht_erschienen'] = (int)$z['weg'];
            }
        }
    }
    $personen = array_column($db->alle('SELECT id, name, farbe FROM {p}person'), null, 'id');
    $aus = [];
    foreach ($zeilen as $t) {
        $k = $t['kunde_id'] ? ($kunden[(int)$t['kunde_id']] ?? null) : null;
        $e = [
            'id' => (int)$t['id'], 'salon' => $t['salon_id'], 'person' => $t['person_id'],
            'person_name' => $personen[$t['person_id']]['name'] ?? $t['person_id'],
            'start' => substr($t['start'], 0, 16), 'ende' => substr($t['ende'], 0, 16),
            'phasen' => json_decode($t['phasen'], true), 'status' => $t['status'],
            'posten' => $nachTermin[(int)$t['id']] ?? [],
            'preis_cent' => $t['preis_cent'] === null ? null : (int)$t['preis_cent'], 'preis_ab' => (bool)$t['preis_ab'],
            'kundennotiz' => $t['kundennotiz'],
            'storno_grund' => $t['storno_grund'] ?? null,
            'rabatt_code' => $t['rabatt_code'] ?? null,
            'rabatt_cent' => isset($t['rabatt_cent']) ? (int)$t['rabatt_cent'] : null,
        ];
        if ($intern) {
            $e += [
                'kunde' => $k ? [
                    'id' => (int)$k['id'], 'vorname' => $k['vorname'], 'nachname' => $k['nachname'],
                    'telefon' => $k['telefon'], 'telefon_text' => telefon_anzeige($k['telefon']), 'email' => $k['email'],
                    'notiz' => $k['notiz'], 'besuche' => $k['besuche'] ?? 0, 'nicht_erschienen' => $k['nicht_erschienen'] ?? 0,
                    'geloescht' => (bool)$k['geloescht'],
                ] : null,
                'gast_name' => $t['gast_name'], 'notiz' => $t['notiz'], 'quelle' => $t['quelle'],
                'wunsch_person' => (bool)$t['wunsch_person'], 'version' => (int)$t['version'], 'ref' => $t['ref'] ?? null,
                'erstellt' => substr($t['erstellt'], 0, 16), 'geaendert' => substr($t['geaendert'], 0, 16),
                'start_utc' => $t['start_utc'] ?? null, 'ende_utc' => $t['ende_utc'] ?? null,
                'token' => $t['token'],
            ];
        } else {
            $e['name'] = $t['gast_name'];
        }
        $aus[] = $e;
    }
    return $aus;
}

/**
 * Termin ändern (Studio). $aenderung kann enthalten: start, person, phasen,
 * leistungen (geladen), status, storno_grund, notiz, kundennotiz, kunde_id,
 * preis_cent. Alles, was Zeit oder Person berührt (auch das Wiederbeleben
 * einer Absage), geht über bucheTermin(). $version ist Pflicht: Hat jemand
 * anderes den Termin inzwischen geändert, gibt es 409 und den neuen Stand.
 * Rückgabe: ['termin' => …, 'vorher' => …]
 */
function termin_aendern(int $id, array $aenderung, int $version, bool $ausserhalbOk = false): array
{
    return db()->schreiben(function (DB $db) use ($id, $aenderung, $version, $ausserhalbOk) {
        $t = $db->eins('SELECT * FROM {p}termin WHERE id = ?', [$id]);
        if (!$t) throw new Fehler('Termin nicht gefunden.', 404);
        $db->personenSperren(array_unique(array_filter([$t['person_id'], $aenderung['person'] ?? null])));
        $t = $db->eins('SELECT * FROM {p}termin WHERE id = ?', [$id]);
        if ((int)$t['version'] !== $version) {
            throw new Fehler('Der Termin wurde inzwischen von jemand anderem geändert. Bitte neu laden.', 409, 'veraltet', ['termin' => termin_lesen($id)]);
        }
        $vorher = termin_lesen($id);
        $status = $aenderung['status'] ?? $t['status'];
        if (!in_array($status, STATUS, true)) throw new Fehler('Unbekannter Status.', 422);
        if ($status === 'storniert_salon' && $t['status'] !== 'storniert_salon' && trim((string)($aenderung['storno_grund'] ?? '')) === '') {
            throw new Fehler('Bitte einen Grund für die Absage angeben. Die Kundin bekommt ihn mitgeteilt.', 422, 'grund', ['feld' => 'storno_grund']);
        }

        $phasen = $aenderung['phasen'] ?? json_decode($t['phasen'], true);
        $start = $aenderung['start'] ?? $t['start'];
        $person = $aenderung['person'] ?? $t['person_id'];
        $zeitGeaendert = $start !== $t['start'] || $person !== $t['person_id'] || $phasen !== json_decode($t['phasen'], true) || !empty($aenderung['leistungen']);
        $wiederBelebt = !in_array($t['status'], STATUS_BELEGT, true) && in_array($status, STATUS_BELEGT, true);

        if (($zeitGeaendert || $wiederBelebt) && in_array($status, STATUS_BELEGT, true)) {
            // Zeit, Person oder Dauer: nur über die eine Buchungsfunktion.
            bucheTermin(['termin_id' => $id, 'version' => $version, 'start' => $start, 'person' => $person, 'phasen' => $phasen,
                'leistungen' => $aenderung['leistungen'] ?? null, 'status' => $status, 'kanal' => 'studio', 'ausserhalb_ok' => $ausserhalbOk]
                + (array_key_exists('preis_cent', $aenderung) ? ['preis_cent' => $aenderung['preis_cent']] : []));
            $t = $db->eins('SELECT * FROM {p}termin WHERE id = ?', [$id]);
        } elseif ($zeitGeaendert) {
            throw new Fehler('Ein abgesagter Termin lässt sich nicht verschieben.', 409, 'status');
        }

        $neu = [];
        if ($status !== $t['status']) {
            $neu['status'] = $status;
            if (storniert($status)) {
                $neu['storniert_am'] = jetzt();
                $neu['storno_grund'] = text_kuerzen($aenderung['storno_grund'] ?? null, 255);
            }
        } elseif (storniert($status) && array_key_exists('storno_grund', $aenderung)) {
            $neu['storno_grund'] = text_kuerzen($aenderung['storno_grund'], 255);
        }
        foreach (['notiz', 'kundennotiz', 'gast_name'] as $f) if (array_key_exists($f, $aenderung)) $neu[$f] = $aenderung[$f];
        if (array_key_exists('kunde_id', $aenderung)) $neu['kunde_id'] = $aenderung['kunde_id'];
        if (array_key_exists('preis_cent', $aenderung) && !$zeitGeaendert) { $neu['preis_cent'] = $aenderung['preis_cent']; $neu['preis_ab'] = 0; }
        if ($neu) {
            $neu += ['version' => (int)$t['version'] + 1, 'geaendert' => jetzt(), 'geaendert_von' => $GLOBALS['ANGEMELDET']['id'] ?? null];
            $db->aendern('termin', $neu, 'id = ?', [$id]);
            if (isset($neu['status'])) belegung_schreiben($id, $t['person_id'], $t['start'], json_decode($t['phasen'], true), $status);
            $db->standErhoehen();
            $spur = [];
            foreach ($neu as $f => $w) {
                if (in_array($f, ['version', 'geaendert', 'geaendert_von', 'storniert_am'], true)) continue;
                $spur[$f] = [$t[$f] ?? null, $w];
            }
            protokoll(isset($neu['status']) ? 'status_geaendert' : 'termin_geaendert', $id, $t['kunde_id'] ? (int)$t['kunde_id'] : null, $spur);
        }
        return ['termin' => termin_lesen($id), 'vorher' => $vorher];
    });
}

function text_kuerzen(mixed $w, int $max): ?string
{
    if ($w === null) return null;
    $w = trim((string)$w);
    return $w === '' ? null : mb_substr($w, 0, $max);
}

/**
 * Einwilligungen aus einem Formular festhalten: Zeitstempel, Quelle und
 * genauer Wortlaut. Nur ein gesetzter Haken zählt; ein leerer nimmt keine
 * frühere Einwilligung zurück — dafür gibt es STOP, den Link „Ihre
 * Nachrichten“ und die Kundenkarte. Angebote gelten erst nach der
 * Bestätigung über einen Link (Double-Opt-in); zurück kommen die
 * Bestätigungsschlüssel, die der Aufrufer nach dem COMMIT verschickt.
 */
function einwilligungen_speichern(int $kunde, array $werte, string $quelle, ?int $termin = null): array
{
    $doppelt = [];
    foreach (EINWILLIGUNGEN as $art => $wortlaut) {
        if (($werte[$art] ?? null) !== true || einwilligung_aktiv($kunde, $art)) continue;
        if (in_array($art, EINWILLIGUNG_DOPPELT, true)) {
            $doppelt[] = bestaetigung_anlegen($kunde, $art, $quelle);
            continue;
        }
        db()->einfuegen('einwilligung', ['kunde_id' => $kunde, 'art' => $art, 'erteilt' => 1, 'zeit' => jetzt(),
            'quelle' => $quelle, 'wortlaut' => $wortlaut, 'termin_id' => $termin]);
    }
    return array_values(array_filter($doppelt));
}

/** Eine Einwilligung erteilen oder zurücknehmen. Gibt true, wenn sich etwas geändert hat. */
function einwilligung_setzen(int $kunde, string $art, bool $erteilt, string $quelle, ?int $termin = null): bool
{
    if (!isset(EINWILLIGUNGEN[$art])) throw new Fehler('Unbekannte Einwilligung.', 422);
    if (einwilligung_aktiv($kunde, $art) === $erteilt) return false;
    db()->einfuegen('einwilligung', ['kunde_id' => $kunde, 'art' => $art, 'erteilt' => $erteilt ? 1 : 0, 'zeit' => jetzt(),
        'quelle' => $quelle, 'wortlaut' => $erteilt ? EINWILLIGUNGEN[$art] : 'Widerruf: ' . EINWILLIGUNGEN[$art], 'termin_id' => $termin]);
    protokoll($erteilt ? 'einwilligung' : 'widerruf', $termin, $kunde, ['art' => $art, 'quelle' => $quelle]);
    return true;
}

function einwilligung_aktiv(int $kunde, string $art): bool
{
    return (int)db()->wert('SELECT erteilt FROM {p}einwilligung WHERE kunde_id = ? AND art = ? ORDER BY id DESC LIMIT 1', [$kunde, $art]) === 1;
}

/** Bestätigungslink für den Double-Opt-in. Ein offener, junger wird wiederverwendet. */
function bestaetigung_anlegen(int $kunde, string $art, string $quelle): ?string
{
    $offen = db()->wert('SELECT token FROM {p}bestaetigung WHERE kunde_id = ? AND art = ? AND bestaetigt IS NULL AND erstellt > ? ORDER BY id DESC LIMIT 1',
        [$kunde, $art, date('Y-m-d H:i:s', time() - 86400)]);
    if ($offen) return null;   // schon unterwegs: keine zweite Nachricht
    $token = zufall(16);
    db()->einfuegen('bestaetigung', ['kunde_id' => $kunde, 'art' => $art, 'token' => $token, 'quelle' => $quelle, 'erstellt' => jetzt()]);
    return $token;
}

function einwilligungen_lesen(int $kunde): array
{
    $aus = [];
    foreach (array_keys(EINWILLIGUNGEN) as $art) {
        $z = db()->eins('SELECT erteilt, zeit, quelle FROM {p}einwilligung WHERE kunde_id = ? AND art = ? ORDER BY id DESC LIMIT 1', [$kunde, $art]);
        $aus[$art] = $z ? ['erteilt' => (bool)$z['erteilt'], 'zeit' => substr($z['zeit'], 0, 16), 'quelle' => $z['quelle']] : null;
        if (in_array($art, EINWILLIGUNG_DOPPELT, true) && !($z['erteilt'] ?? false)
            && db()->wert('SELECT 1 FROM {p}bestaetigung WHERE kunde_id = ? AND art = ? AND bestaetigt IS NULL AND erstellt > ?', [$kunde, $art, date('Y-m-d H:i:s', time() - 30 * 86400)])) {
            $aus[$art] = ($aus[$art] ?? ['erteilt' => false, 'zeit' => null, 'quelle' => null]) + ['wartet' => true];
            $aus[$art]['wartet'] = true;
        }
    }
    return $aus;
}

function kunde_lesen(int $id): array
{
    $k = db()->eins('SELECT * FROM {p}kunde WHERE id = ?', [$id]);
    if (!$k) throw new Fehler('Kunde nicht gefunden.', 404);
    return [
        'id' => (int)$k['id'], 'vorname' => $k['vorname'], 'nachname' => $k['nachname'],
        'telefon' => $k['telefon'], 'telefon_text' => telefon_anzeige($k['telefon']), 'email' => $k['email'],
        'notiz' => $k['notiz'], 'erstellt' => substr($k['erstellt'], 0, 10), 'geloescht' => (bool)$k['geloescht'],
    ];
}

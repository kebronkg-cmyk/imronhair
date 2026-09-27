<?php
/* Termine und Kunden anlegen, ändern, lesen — gemeinsam für die
   Online-Buchung und das Studio. Alles, was schreibt, läuft in
   DB::schreiben() und sperrt vorher die betroffenen Personen. */

declare(strict_types=1);

const STATUS = ['gebucht', 'erschienen', 'nicht_erschienen', 'storniert'];

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
 * Termin anlegen.
 * $o: salon, leistungen (geladen), start, person|null, phasen|null,
 *     kunde_id|null, gast_name, notiz, kundennotiz, quelle, anfrage_id,
 *     online (bool: strenge Regeln), trotzdem (bool, nur Studio), preis_cent
 */
function termin_anlegen(array $o): array
{
    $db = db();
    return $db->schreiben(function (DB $db) use ($o) {
        if (!empty($o['anfrage_id'])) {
            $alt = $db->eins('SELECT id FROM {p}termin WHERE anfrage_id = ?', [$o['anfrage_id']]);
            if ($alt) return termin_lesen((int)$alt['id']) + ['wiederholt' => true];
        }
        $online = !empty($o['online']);
        $salon = $o['salon'];
        $leistungen = $o['leistungen'];
        $phasen = $o['phasen'] ?? phasen_verketten($leistungen);
        $start = $o['start'];
        $datum = substr($start, 0, 10);
        $t = zeit_zu_min($start);

        $kandidaten = $o['person']
            ? [$o['person']]
            : array_keys(personen_fuer($leistungen, $online));
        if ($online && $o['person'] && !isset(personen_fuer($leistungen, true, $o['person'])[$o['person']])) {
            throw new Fehler('Diese Person bietet die Leistung nicht online an.', 422, 'person');
        }
        if (!$kandidaten) throw new Fehler('Für diese Auswahl gibt es niemanden.', 422, 'person');
        $db->personenSperren($kandidaten);

        if ($online) {
            $e = einstellungen();
            if (!$e['online_aktiv']) throw new Fehler('Online-Buchung ist gerade pausiert. Bitte rufen Sie an.', 503, 'pausiert');
            if ($start < online_fruehestens()) throw new Fehler('Dieser Termin ist zu kurzfristig. Bitte rufen Sie an.', 409, 'vergeben');
            if ($datum > tag_plus(date('Y-m-d'), (int)$e['horizont'])) throw new Fehler('So weit im Voraus ist noch nichts buchbar.', 409, 'horizont');
            $frei = freie_zeiten($salon, $phasen, $kandidaten, $datum, $datum, online_fruehestens());
            $wer = $frei[$datum][$t] ?? [];
            if (!$wer) throw new Fehler('Diese Uhrzeit wurde gerade vergeben. Bitte wählen Sie eine andere.', 409, 'vergeben');
            $person = beste_person($wer, $salon, $datum, $t, $phasen);
        } else {
            $person = $kandidaten[0];
            if (!$o['person']) {
                $frei = freie_zeiten($salon, $phasen, $kandidaten, $datum, $datum);
                $wer = $frei[$datum][$t] ?? [];
                if (!$wer) throw new Fehler('Zu dieser Zeit ist niemand frei.', 409, 'vergeben');
                $person = beste_person($wer, $salon, $datum, $t, $phasen);
            }
            $k = konflikte($person, $salon, $start, $phasen);
            if ($k && empty($o['trotzdem'])) {
                throw new Fehler('Überschneidung im Kalender.', 409, 'konflikt', ['konflikte' => konflikte_beschreiben($k)]);
            }
        }

        $preis = $o['preis_cent'] ?? null;
        $ab = false;
        if ($preis === null) {
            $bekannt = true;
            foreach ($leistungen as $l) {
                if ($l['preis_cent'] === null) $bekannt = false;
                else $preis = ($preis ?? 0) + (int)$l['preis_cent'];
                if ($l['preis_ab']) $ab = true;
            }
            if (!$bekannt) $ab = true;
        }
        $jetzt = jetzt();
        $wer = $GLOBALS['ANGEMELDET']['id'] ?? null;
        $id = $db->einfuegen('termin', [
            'salon_id' => $salon, 'person_id' => $person, 'kunde_id' => $o['kunde_id'] ?? null,
            'start' => $start, 'ende' => zeit_plus($start, phasen_dauer($phasen)),
            'phasen' => json_encode($phasen), 'status' => 'gebucht', 'quelle' => $o['quelle'],
            'gast_name' => $o['gast_name'] ?? null, 'notiz' => $o['notiz'] ?? null, 'kundennotiz' => $o['kundennotiz'] ?? null,
            'preis_cent' => $preis, 'preis_ab' => $ab ? 1 : 0, 'wunsch_person' => $o['person'] ? 1 : 0,
            'token' => zufall(16), 'anfrage_id' => $o['anfrage_id'] ?? null, 'version' => 1, 'erinnert' => 0,
            'erstellt' => $jetzt, 'erstellt_von' => $wer, 'geaendert' => $jetzt, 'geaendert_von' => $wer,
        ]);
        foreach ($leistungen as $i => $l) {
            $db->einfuegen('termin_posten', [
                'termin_id' => $id, 'leistung_id' => $l['id'], 'name' => $l['name'], 'laenge' => $l['laenge'],
                'dauer' => phasen_dauer($l['phasen']), 'preis_cent' => $l['preis_cent'], 'preis_ab' => (int)$l['preis_ab'], 'pos' => $i,
            ]);
        }
        belegung_schreiben($id, $person, $start, $phasen, 'gebucht');
        $db->standErhoehen();
        protokoll('termin_angelegt', $id, $o['kunde_id'] ?? null, ['quelle' => $o['quelle'], 'start' => $start, 'person' => $person]);
        return termin_lesen($id);
    });
}

function konflikte_beschreiben(array $k): array
{
    $aus = [];
    foreach ($k as $x) {
        if ($x['art'] === 'termin') {
            $t = db()->eins('SELECT t.start, t.ende, t.gast_name, k.vorname, k.nachname FROM {p}termin t LEFT JOIN {p}kunde k ON k.id = t.kunde_id WHERE t.id = ?', [$x['termin_id']]);
            $name = trim(($t['vorname'] ?? '') . ' ' . ($t['nachname'] ?? '')) ?: ($t['gast_name'] ?? 'Termin');
            $aus[] = ['art' => 'termin', 'termin_id' => $x['termin_id'], 'text' => substr($t['start'], 11, 5) . '–' . substr($t['ende'], 11, 5) . ' ' . $name];
        } elseif ($x['art'] === 'abwesend') {
            $aus[] = ['art' => 'abwesend', 'text' => 'In dieser Zeit abwesend'];
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
                FROM {p}termin WHERE kunde_id IN (" . DB::liste($kundenIds) . ") AND status <> 'storniert' GROUP BY kunde_id", $kundenIds);
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
                'wunsch_person' => (bool)$t['wunsch_person'], 'version' => (int)$t['version'],
                'erstellt' => substr($t['erstellt'], 0, 16), 'geaendert' => substr($t['geaendert'], 0, 16),
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
 * Termin ändern (Studio und Umbuchen). $aenderung kann enthalten:
 * start, person, phasen, status, notiz, kundennotiz, kunde_id, preis_cent,
 * leistungen (neu geladen). $version schützt vor Überschreiben: hat jemand
 * anderes den Termin inzwischen geändert, gibt es 409.
 */
function termin_aendern(int $id, array $aenderung, ?int $version, bool $trotzdem = false): array
{
    return db()->schreiben(function (DB $db) use ($id, $aenderung, $version, $trotzdem) {
        $t = $db->eins('SELECT * FROM {p}termin WHERE id = ?', [$id]);
        if (!$t) throw new Fehler('Termin nicht gefunden.', 404);
        $person = $aenderung['person'] ?? $t['person_id'];
        $db->personenSperren(array_unique([$t['person_id'], $person]));
        $t = $db->eins('SELECT * FROM {p}termin WHERE id = ?', [$id]);
        if ($version !== null && (int)$t['version'] !== $version) {
            throw new Fehler('Der Termin wurde inzwischen von jemand anderem geändert.', 409, 'veraltet', ['termin' => termin_lesen($id)]);
        }
        $start = $aenderung['start'] ?? $t['start'];
        $phasen = $aenderung['phasen'] ?? json_decode($t['phasen'], true);
        $status = $aenderung['status'] ?? $t['status'];
        if (!in_array($status, STATUS, true)) throw new Fehler('Unbekannter Status.', 422);
        $zeitGeaendert = $start !== $t['start'] || $person !== $t['person_id'] || $phasen !== json_decode($t['phasen'], true);
        $wiederBelebt = $t['status'] === 'storniert' && $status !== 'storniert';
        if (($zeitGeaendert || $wiederBelebt) && $status !== 'storniert' && !$trotzdem) {
            $k = konflikte($person, $t['salon_id'], $start, $phasen, $id);
            if ($k) throw new Fehler('Überschneidung im Kalender.', 409, 'konflikt', ['konflikte' => konflikte_beschreiben($k)]);
        }
        $neu = [
            'person_id' => $person, 'start' => $start, 'ende' => zeit_plus($start, phasen_dauer($phasen)),
            'phasen' => json_encode($phasen), 'status' => $status, 'version' => (int)$t['version'] + 1,
            'geaendert' => jetzt(), 'geaendert_von' => $GLOBALS['ANGEMELDET']['id'] ?? null,
        ];
        if ($zeitGeaendert) $neu['erinnert'] = 0;
        if ($status === 'storniert' && $t['status'] !== 'storniert') $neu['storniert_am'] = jetzt();
        if ($status !== 'storniert') $neu['storniert_am'] = null;
        foreach (['notiz', 'kundennotiz', 'gast_name'] as $f) if (array_key_exists($f, $aenderung)) $neu[$f] = $aenderung[$f];
        if (array_key_exists('kunde_id', $aenderung)) $neu['kunde_id'] = $aenderung['kunde_id'];
        if (array_key_exists('preis_cent', $aenderung)) { $neu['preis_cent'] = $aenderung['preis_cent']; $neu['preis_ab'] = 0; }
        if (!empty($aenderung['leistungen'])) {
            $db->q('DELETE FROM {p}termin_posten WHERE termin_id = ?', [$id]);
            $preis = 0; $ab = false; $bekannt = true;
            foreach ($aenderung['leistungen'] as $i => $l) {
                $db->einfuegen('termin_posten', ['termin_id' => $id, 'leistung_id' => $l['id'], 'name' => $l['name'], 'laenge' => $l['laenge'],
                    'dauer' => phasen_dauer($l['phasen']), 'preis_cent' => $l['preis_cent'], 'preis_ab' => (int)$l['preis_ab'], 'pos' => $i]);
                if ($l['preis_cent'] === null) $bekannt = false; else $preis += (int)$l['preis_cent'];
                if ($l['preis_ab']) $ab = true;
            }
            if (!array_key_exists('preis_cent', $aenderung)) { $neu['preis_cent'] = $bekannt || $preis ? $preis : null; $neu['preis_ab'] = ($ab || !$bekannt) ? 1 : 0; }
        }
        $db->aendern('termin', $neu, 'id = ?', [$id]);
        belegung_schreiben($id, $person, $start, $phasen, $status);
        $db->standErhoehen();
        $spur = [];
        foreach (['start' => $t['start'], 'person_id' => $t['person_id'], 'status' => $t['status']] as $f => $alt) {
            if ($neu[$f] !== $alt) $spur[$f] = [$alt, $neu[$f]];
        }
        if ($zeitGeaendert && !isset($spur['start']) && !isset($spur['person_id'])) $spur['dauer'] = [$t['ende'], $neu['ende']];
        protokoll('termin_geaendert', $id, $t['kunde_id'] ? (int)$t['kunde_id'] : null, $spur ?: ['felder' => array_keys($aenderung)]);
        return termin_lesen($id);
    });
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

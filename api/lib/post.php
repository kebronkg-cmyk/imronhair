<?php
/* E-Mails: Bestätigung und Erinnerung an die Kundin, Hinweis an den Salon.
   Versand über PHP mail() — bei All-Inkl ohne weitere Einrichtung möglich,
   sobald die Absenderadresse als Postfach existiert. Ein Fehler beim
   Versand bricht nie eine Buchung ab; er landet im Protokoll. */

declare(strict_types=1);

function post_aktiv(): bool
{
    $p = konfig('post', []);
    return !empty($p['aktiv']) && !empty($p['absender']);
}

function kopfzeile_kodieren(string $s): string
{
    return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

/**
 * $zusatz: kopf (weitere Kopfzeilen, etwa List-Unsubscribe), zweck,
 * kunde_id, termin_id — für den Postausgang im Studio; ohne_protokoll,
 * wenn der Aufrufer (die Warteschlange) selbst Buch führt.
 */
function post_senden(string $an, string $betreff, string $text, ?string $ics = null, array $zusatz = []): bool
{
    if (!post_aktiv() || !filter_var($an, FILTER_VALIDATE_EMAIL)) return false;
    $p = konfig('post');
    $von = $p['absender'];
    $name = $p['absender_name'] ?? 'Irmonhair';
    $grenze = 'ih-' . zufall(8);
    $kopf = array_merge([
        'From: ' . kopfzeile_kodieren($name) . " <$von>",
        'Reply-To: ' . ($p['antwort_an'] ?? $von),
        'MIME-Version: 1.0',
        'X-Mailer: Irmonhair-Termine',
    ], array_values(array_filter($zusatz['kopf'] ?? [], fn($z) => !preg_match('/[\r\n]/', $z))));
    if ($ics) {
        $kopf[] = "Content-Type: multipart/mixed; boundary=\"$grenze\"";
        $inhalt = "--$grenze\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text)) . "--$grenze\r\n"
            . "Content-Type: text/calendar; charset=UTF-8; method=PUBLISH; name=\"termin.ics\"\r\n"
            . "Content-Disposition: attachment; filename=\"termin.ics\"\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($ics)) . "--$grenze--\r\n";
    } else {
        $kopf[] = 'Content-Type: text/plain; charset=UTF-8';
        $kopf[] = 'Content-Transfer-Encoding: base64';
        $inhalt = chunk_split(base64_encode($text));
    }
    try {
        // In der Vorführung geht nichts hinaus; der Postausgang im Studio zeigt sie trotzdem.
        $ok = ($p['versand'] ?? '') === 'vorfuehrung' ? true : mail($an, kopfzeile_kodieren($betreff), $inhalt, implode("\r\n", $kopf), '-f' . $von);
    } catch (Throwable $e) {
        $ok = false;
    }
    if (!$ok) protokoll('post_fehler', null, null, ['an' => $an, 'betreff' => $betreff], null);
    if (empty($zusatz['ohne_protokoll'])) {
        try {
            db()->einfuegen('nachricht', ['kunde_id' => $zusatz['kunde_id'] ?? null, 'termin_id' => $zusatz['termin_id'] ?? null, 'kanal' => 'email',
                'zweck' => $zusatz['zweck'] ?? 'post', 'an' => mb_strtolower($an), 'betreff' => mb_substr($betreff, 0, 255), 'text' => $text,
                'status' => $ok ? 'gesendet' : 'fehler', 'versuche' => 1, 'nicht_vor' => jetzt(), 'teile' => 1, 'kosten_cent' => 0,
                'erstellt' => jetzt(), 'gesendet' => $ok ? jetzt() : null, 'fehler' => $ok ? null : 'E-Mail nicht angenommen']);
        } catch (Throwable $e) { /* der Versand zählt, nicht das Buchführen */ }
    }
    return $ok;
}

function termin_link(string $token): string
{
    $basis = rtrim((string)konfig('buchung_adresse', ''), '/');
    return $basis ? $basis . '?t=' . $token : '';
}

function datum_lang(string $zeit): string
{
    $tage = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    $monate = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    $ts = strtotime($zeit);
    return $tage[(int)date('N', $ts)] . ', ' . (int)date('j', $ts) . '. ' . $monate[(int)date('n', $ts)] . ' ' . date('Y', $ts);
}

function euro_text(?int $cent, bool $ab): string
{
    if ($cent === null) return 'nach Beratung';
    $e = $cent % 100 ? number_format($cent / 100, 2, ',', '.') : number_format($cent / 100, 0, ',', '.');
    return ($ab ? 'ab ' : '') . $e . ' €';
}

/** Eine Zeile, überall gleich: „Di, 14.10.2026 · 14:00–14:45 · Salon Pasing · bei Anna“.
    Nie nur die Startzeit. */
function termin_zeile(array $t, array $salon): string
{
    $tage = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    $ts = strtotime($t['start']);
    return $tage[(int)date('N', $ts)] . ', ' . date('d.m.Y', $ts) . ' · ' . substr($t['start'], 11, 5) . '–' . substr($t['ende'], 11, 5)
        . ' · Salon ' . $salon['name'] . ' · bei ' . $t['person_name'];
}

function ics_bauen(array $t, array $salon): string
{
    $utc = fn(string $z) => gmdate('Ymd\THis\Z', strtotime($z));
    $x = fn(string $s) => str_replace(["\\", ';', ',', "\n"], ["\\\\", '\;', '\,', '\n'], $s);
    $was = implode(', ', array_map(fn($p) => $p['name'] . ($p['laenge'] ? ' (' . $p['laenge'] . ')' : ''), $t['posten']));
    $link = termin_link($t['token'] ?? '');
    $zeilen = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Irmonhair//Termine//DE', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        'UID:termin-' . $t['id'] . '@irmonhair', 'DTSTAMP:' . gmdate('Ymd\THis\Z'),
        // Dieselbe UID mit höherer SEQUENCE ersetzt einen früheren Eintrag im Kalender.
        'SEQUENCE:' . (int)($t['version'] ?? 1),
        'DTSTART:' . $utc($t['start'] . ':00'), 'DTEND:' . $utc($t['ende'] . ':00'),
        'SUMMARY:' . $x('Irmonhair ' . $salon['name'] . ': ' . $was),
        'LOCATION:' . $x('Irmonhair, ' . $salon['strasse'] . ', ' . $salon['ort']),
        'DESCRIPTION:' . $x('Bei ' . $t['person_name'] . '. Telefon ' . $salon['telefon_text'] . '.' . ($link ? ' Verschieben oder absagen: ' . $link : '')),
        'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:' . $x('Morgen Irmonhair um ' . substr($t['start'], 11, 5)), 'END:VALARM',
        'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:' . $x('Irmonhair um ' . substr($t['start'], 11, 5)), 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR',
    ];
    return implode("\r\n", $zeilen) . "\r\n";
}

/** Link „In Google Kalender eintragen“. */
function google_link(array $t, array $salon): string
{
    $utc = fn(string $z) => gmdate('Ymd\THis\Z', strtotime($z . ':00'));
    $was = implode(', ', array_map(fn($p) => $p['name'], $t['posten']));
    return 'https://calendar.google.com/calendar/render?' . http_build_query([
        'action' => 'TEMPLATE', 'text' => 'Irmonhair ' . $salon['name'] . ': ' . $was,
        'dates' => $utc($t['start']) . '/' . $utc($t['ende']),
        'location' => 'Irmonhair, ' . $salon['strasse'] . ', ' . $salon['ort'],
        'details' => 'Bei ' . $t['person_name'] . '. Telefon ' . $salon['telefon_text'],
    ]);
}

function termin_text(array $t, array $salon): string
{
    $zeilen = [];
    foreach ($t['posten'] as $p) {
        $zeilen[] = '  ' . $p['name'] . ($p['laenge'] ? ' · ' . $p['laenge'] : '') . '  ' . euro_text($p['preis_cent'], $p['preis_ab']);
    }
    return termin_zeile($t, $salon) . "\n" . $salon['strasse'] . ', ' . $salon['ort'] . "\n\n"
        . implode("\n", $zeilen) . "\n  Zusammen: " . euro_text($t['preis_cent'], $t['preis_ab']);
}

/** E-Mail der Kundin zu einem Termin (aus der Kartei, sonst null). */
function kunden_email(array $t): ?string
{
    if (!empty($t['kunde']['email']) && empty($t['kunde']['geloescht'])) return $t['kunde']['email'];
    return null;
}

function post_bestaetigung(array $termin, ?string $email): void
{
    if (!post_aktiv()) return;
    $termin = termin_lesen((int)$termin['id']);     // immer der gespeicherte Stand
    $salon = db()->eins('SELECT * FROM {p}salon WHERE id = ?', [$termin['salon']]);
    $email ??= kunden_email($termin);
    $link = termin_link($termin['token']);
    $name = $termin['gast_name'] ? name_teilen($termin['gast_name'])[0] : '';
    $text = ("Guten Tag" . ($name ? " $name" : '') . ",\n\nIhr Termin ist gebucht:\n\n" . termin_text($termin, $salon)
        . "\n\nDer Endpreis richtet sich nach Länge, Material und Aufwand; Sie erfahren ihn vor der Behandlung.\n\n"
        . "In Ihren Kalender (Datei im Anhang) oder in Google Kalender:\n" . google_link($termin, $salon) . "\n\n"
        . ($link ? "Termin ansehen, verschieben oder absagen:\n$link\n\n" : '')
        . "Bis bald,\nIhr Irmonhair-Team\n{$salon['strasse']}, {$salon['ort']} · {$salon['telefon_text']}\n");
    if ($email) post_senden($email, 'Ihr Termin: ' . termin_zeile($termin, $salon), $text, ics_bauen($termin, $salon), post_bezug($termin, 'bestaetigung'));
    if ($termin['quelle'] === 'online') {
        post_salon($termin['salon'], 'Online gebucht: ' . termin_zeile($termin, $salon),
            "Neue Online-Buchung\n\n" . ($termin['gast_name'] ?? '') . ' · ' . ($termin['kunde']['telefon_text'] ?? '') . "\n"
            . termin_text($termin, $salon) . ($termin['kundennotiz'] ? "\n\nNotiz: " . $termin['kundennotiz'] : '') . "\n");
    }
}

function post_salon(string $salonId, string $betreff, string $text): void
{
    $an = konfig('post')['salon_an'][$salonId] ?? null;
    if ($an) post_senden($an, $betreff, $text, null, ['zweck' => 'salon']);
}

/**
 * Nach jeder Änderung an Zeit, Dauer oder Person: eine neue Bestätigung
 * mit „vorher → jetzt“, erzeugt aus dem gespeicherten Stand. Nach einer
 * Absage die Absage (beim Salon mit Grund). Vergangenes wird nicht gemeldet.
 */
function post_aenderung(array $vorher, array $nachher): void
{
    if (!post_aktiv()) return;
    $t = termin_lesen((int)$nachher['id']);
    $salon = db()->eins('SELECT * FROM {p}salon WHERE id = ?', [$t['salon']]);
    if (storniert($t['status']) && !storniert($vorher['status'])) { post_storno($t['token']); return; }
    $zeitAnders = $vorher['start'] !== $t['start'] || $vorher['ende'] !== $t['ende'] || $vorher['person'] !== $t['person'];
    if (!$zeitAnders || !in_array($t['status'], STATUS_BELEGT, true) || $t['start'] < date('Y-m-d H:i')) return;
    $alt = termin_zeile($vorher, db()->eins('SELECT * FROM {p}salon WHERE id = ?', [$vorher['salon']]));
    $link = termin_link($t['token']);
    $text = "Guten Tag,\n\nIhr Termin wurde geändert.\n\nvorher: $alt\njetzt:  " . termin_zeile($t, $salon) . "\n\n"
        . termin_text($t, $salon) . "\n\n"
        . "In Ihren Kalender (Datei im Anhang ersetzt den alten Eintrag) oder in Google Kalender:\n" . google_link($t, $salon) . "\n\n"
        . ($link ? "Termin ansehen, verschieben oder absagen:\n$link\n\n" : '')
        . "Ihr Irmonhair-Team · {$salon['telefon_text']}\n";
    if ($email = kunden_email($t)) post_senden($email, 'Geändert: ' . termin_zeile($t, $salon), $text, ics_bauen($t, $salon), post_bezug($t, 'aenderung'));
    if (akteur() === 'kunde') post_salon($t['salon'], 'Online verschoben: ' . termin_zeile($t, $salon),
        "Die Kundin hat online verschoben.\n\n" . ($t['gast_name'] ?? '') . "\nvorher: $alt\njetzt:  " . termin_zeile($t, $salon) . "\n");
}

function post_storno(string $token): void
{
    if (!post_aktiv()) return;
    $id = db()->wert('SELECT id FROM {p}termin WHERE token = ?', [$token]);
    if (!$id) return;
    $t = termin_lesen((int)$id);
    $salon = db()->eins('SELECT * FROM {p}salon WHERE id = ?', [$t['salon']]);
    $vomSalon = $t['status'] === 'storniert_salon';
    if (($email = kunden_email($t)) && $t['start'] >= date('Y-m-d H:i')) {
        $text = "Guten Tag,\n\n" . ($vomSalon
                ? "leider müssen wir Ihren Termin absagen" . ($t['storno_grund'] ? ":\n" . $t['storno_grund'] : '.') . "\n\nDas tut uns leid. Rufen Sie uns an, dann finden wir eine neue Zeit."
                : "Ihre Absage ist bei uns angekommen.")
            . "\n\nAbgesagt: " . termin_zeile($t, $salon) . "\n\n"
            . "Neuen Termin buchen: " . preg_replace('/\?.*$/', '', termin_link('x')) . "\n"
            . "Ihr Irmonhair-Team · {$salon['telefon_text']}\n";
        post_senden($email, 'Abgesagt: ' . termin_zeile($t, $salon), $text, null, post_bezug($t, 'absage'));
    }
    if (akteur() === 'kunde') post_salon($t['salon'], 'Online abgesagt: ' . termin_zeile($t, $salon),
        "Die Kundin hat online abgesagt.\n\n" . ($t['gast_name'] ?? '') . "\n" . termin_text($t, $salon) . "\n");
}

/** Für den Postausgang: zu welcher Kundin und welchem Termin. */
function post_bezug(array $t, string $zweck): array
{
    return ['zweck' => $zweck, 'kunde_id' => $t['kunde']['id'] ?? null, 'termin_id' => $t['id'] ?? null];
}

/** Früherer Cronjob „erinnern“: läuft jetzt über den einen Nachrichten-Cron
    (Erinnerungen per E-Mail und SMS, Recall, Warteliste, Versand). */
function aktion_erinnern(): array
{
    require_once __DIR__ . '/nachrichten.php';
    $r = aktion_nachrichten();
    return $r + ['erinnert' => ($r['erinnerungen']['email'] ?? 0) + ($r['erinnerungen']['sms'] ?? 0)];
}

function cron_pruefen(): void
{
    $schluessel = (string)konfig('cron_schluessel', '');
    if ($schluessel === '' || !hash_equals($schluessel, (string)feld('schluessel', ''))) throw new Fehler('Nicht erlaubt.', 403);
}

/**
 * Nächtlicher Selbstcheck (Cronjob, z. B. täglich 3:10 Uhr). Sucht, was es
 * nie geben darf: dieselbe Person zweimal zur selben Zeit, Belegung ohne
 * gültigen Termin, gültige Termine ohne Belegung. Dazu als Warnung: künftige
 * Termine an Schließtagen, Feiertagen oder in einer Abwesenheit (etwa
 * nach einer Krankmeldung). Findet er etwas, geht sofort ein Alarm raus.
 */
function aktion_selbstcheck(): array
{
    cron_pruefen();
    $db = db();
    $belegt = "'" . implode("','", STATUS_BELEGT) . "'";
    $ueber = $db->alle("SELECT a.person_id, a.termin_id AS a_termin, b.termin_id AS b_termin, a.start AS a_start, a.ende AS a_ende, b.start AS b_start, b.ende AS b_ende
        FROM {p}belegung a JOIN {p}belegung b ON b.person_id = a.person_id AND b.termin_id > a.termin_id AND b.start < a.ende AND a.start < b.ende
        JOIN {p}termin ta ON ta.id = a.termin_id AND ta.status IN ($belegt)
        JOIN {p}termin tb ON tb.id = b.termin_id AND tb.status IN ($belegt)
        ORDER BY a.start LIMIT 200");
    $verwaist = $db->alle("SELECT b.termin_id FROM {p}belegung b LEFT JOIN {p}termin t ON t.id = b.termin_id
        WHERE t.id IS NULL OR t.status NOT IN ($belegt) GROUP BY b.termin_id LIMIT 200");
    $ohne = $db->alle("SELECT t.id FROM {p}termin t WHERE t.status IN ($belegt) AND t.start >= ?
        AND NOT EXISTS (SELECT 1 FROM {p}belegung b WHERE b.termin_id = t.id) AND t.phasen LIKE '%arbeit%' LIMIT 200", [date('Y-m-d') . ' 00:00:00']);
    $falscheZeit = $db->alle("SELECT id FROM {p}termin WHERE ende <= start LIMIT 200");

    // Künftige Termine, die so nicht mehr stattfinden können.
    $warnung = [];
    $kuenftig = $db->alle("SELECT id, salon_id, person_id, start, phasen FROM {p}termin WHERE status = 'gebucht' AND start >= ? AND start < ? ORDER BY start",
        [jetzt(), tag_plus(date('Y-m-d'), 120) . ' 00:00:00']);
    foreach ($kuenftig as $t) {
        $k = array_filter(konflikte($t['person_id'], $t['salon_id'], $t['start'], json_decode($t['phasen'], true), (int)$t['id']),
            fn($x) => in_array($x['art'], ['geschlossen', 'abwesend', 'umstellung'], true));
        if ($k) $warnung[] = ['termin' => (int)$t['id'], 'start' => substr($t['start'], 0, 16), 'person' => $t['person_id'], 'grund' => array_values(array_column($k, 'art'))];
    }

    $fehler = $ueber || $verwaist || $ohne || $falscheZeit;
    $bericht = ['ok' => !$fehler, 'geprueft' => jetzt(), 'ueberschneidungen' => $ueber,
        'belegung_ohne_termin' => array_column($verwaist, 'termin_id'), 'termin_ohne_belegung' => array_column($ohne, 'id'),
        'ende_vor_start' => array_column($falscheZeit, 'id'), 'warnungen' => $warnung];
    if ($fehler || $warnung) {
        error_log('[irmonhair] Selbstcheck: ' . json_encode($bericht, JSON_UNESCAPED_UNICODE));
        $an = konfig('alarm_an');
        foreach ((array)$an as $adresse) {
            if (!$adresse) continue;
            post_senden((string)$adresse, ($fehler ? 'ALARM Terminbuchung: Überschneidung gefunden' : 'Hinweis Terminbuchung: Termine an geschlossenen Tagen'),
                "Der nächtliche Selbstcheck hat etwas gefunden:\n\n" . json_encode($bericht, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
        }
        protokoll('selbstcheck', null, null, ['ok' => !$fehler, 'warnungen' => count($warnung)]);
    }
    return $bericht;
}

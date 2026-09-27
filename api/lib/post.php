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

function post_senden(string $an, string $betreff, string $text, ?string $ics = null): bool
{
    if (!post_aktiv() || !filter_var($an, FILTER_VALIDATE_EMAIL)) return false;
    $p = konfig('post');
    $von = $p['absender'];
    $name = $p['absender_name'] ?? 'Irmonhair';
    $grenze = 'ih-' . zufall(8);
    $kopf = [
        'From: ' . kopfzeile_kodieren($name) . " <$von>",
        'Reply-To: ' . ($p['antwort_an'] ?? $von),
        'MIME-Version: 1.0',
        'X-Mailer: Irmonhair-Termine',
    ];
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
        $ok = mail($an, kopfzeile_kodieren($betreff), $inhalt, implode("\r\n", $kopf), '-f' . $von);
    } catch (Throwable $e) {
        $ok = false;
    }
    if (!$ok) protokoll('post_fehler', null, null, ['an' => $an, 'betreff' => $betreff], null);
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

function ics_bauen(array $t, array $salon): string
{
    $utc = fn(string $z) => gmdate('Ymd\THis\Z', strtotime($z));
    $x = fn(string $s) => str_replace(["\\", ';', ',', "\n"], ["\\\\", '\;', '\,', '\n'], $s);
    $was = implode(', ', array_map(fn($p) => $p['name'] . ($p['laenge'] ? ' (' . $p['laenge'] . ')' : ''), $t['posten']));
    $zeilen = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Irmonhair//Termine//DE', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        'UID:termin-' . $t['id'] . '@irmonhair', 'DTSTAMP:' . gmdate('Ymd\THis\Z'),
        'DTSTART:' . $utc($t['start'] . ':00'), 'DTEND:' . $utc($t['ende'] . ':00'),
        'SUMMARY:' . $x('Irmonhair ' . $salon['name'] . ': ' . $was),
        'LOCATION:' . $x('Irmonhair, ' . $salon['strasse'] . ', ' . $salon['ort']),
        'DESCRIPTION:' . $x('Bei ' . $t['person_name'] . '. Telefon ' . $salon['telefon_text'] . '.'),
        'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:' . $x('Irmonhair um ' . substr($t['start'], 11, 5)), 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR',
    ];
    return implode("\r\n", $zeilen) . "\r\n";
}

function termin_text(array $t, array $salon): string
{
    $zeilen = [];
    foreach ($t['posten'] as $p) {
        $zeilen[] = '  ' . $p['name'] . ($p['laenge'] ? ' · ' . $p['laenge'] : '') . '  ' . euro_text($p['preis_cent'], $p['preis_ab']);
    }
    return datum_lang($t['start']) . ', ' . substr($t['start'], 11, 5) . " Uhr\n"
        . 'bei ' . $t['person_name'] . ' in ' . $salon['name'] . ', ' . $salon['strasse'] . "\n\n"
        . implode("\n", $zeilen);
}

function post_bestaetigung(array $termin, ?string $email): void
{
    if (!post_aktiv()) return;
    $salon = db()->eins('SELECT * FROM {p}salon WHERE id = ?', [$termin['salon']]);
    $link = termin_link($termin['token']);
    $name = $termin['gast_name'] ? name_teilen($termin['gast_name'])[0] : '';
    $text = ("Guten Tag" . ($name ? " $name" : '') . ",\n\nIhr Termin ist gebucht:\n\n" . termin_text($termin, $salon)
        . "\n\nDer Endpreis richtet sich nach Länge, Material und Aufwand; Sie erfahren ihn vor der Behandlung.\n\n"
        . ($link ? "Termin ansehen, verschieben oder absagen:\n$link\n\n" : '')
        . "Bis bald,\nIhr Irmonhair-Team\n{$salon['strasse']}, {$salon['ort']} · {$salon['telefon_text']}\n");
    if ($email) post_senden($email, 'Ihr Termin am ' . date('d.m.', strtotime($termin['start'])) . ' um ' . substr($termin['start'], 11, 5) . ' Uhr', $text, ics_bauen($termin, $salon));
    $an = konfig('post')['salon_an'][$termin['salon']] ?? null;
    if ($an) {
        post_senden($an, 'Online gebucht: ' . date('d.m. H:i', strtotime($termin['start'])) . ' · ' . $termin['person_name'],
            ("Neue Online-Buchung\n\n" . ($termin['gast_name'] ?? '') . ' · ' . ($termin['kunde']['telefon_text'] ?? '') . "\n"
            . termin_text($termin, $salon) . ($termin['kundennotiz'] ? "\n\nNotiz: " . $termin['kundennotiz'] : '') . "\n"));
    }
}

function post_storno_salon(string $token): void
{
    if (!post_aktiv()) return;
    $t = db()->eins('SELECT id, salon_id FROM {p}termin WHERE token = ?', [$token]);
    $an = konfig('post')['salon_an'][$t['salon_id']] ?? null;
    if (!$an) return;
    $termin = termin_lesen((int)$t['id']);
    $salon = db()->eins('SELECT * FROM {p}salon WHERE id = ?', [$t['salon_id']]);
    post_senden($an, 'Online abgesagt: ' . date('d.m. H:i', strtotime($termin['start'])) . ' · ' . $termin['person_name'],
        ("Die Kundin hat online abgesagt.\n\n" . ($termin['gast_name'] ?? '') . "\n" . termin_text($termin, $salon) . "\n"));
}

/** Aufruf durch einen Cronjob (All-Inkl: KAS → Tools → Cronjobs), z. B. stündlich. */
function aktion_erinnern(): array
{
    $schluessel = (string)konfig('cron_schluessel', '');
    if ($schluessel === '' || !hash_equals($schluessel, (string)feld('schluessel', ''))) throw new Fehler('Nicht erlaubt.', 403);
    $db = db();
    $von = date('Y-m-d H:i:s', time() + 20 * 3600);
    $bis = date('Y-m-d H:i:s', time() + 28 * 3600);
    $zeilen = $db->alle("SELECT t.id, k.email FROM {p}termin t JOIN {p}kunde k ON k.id = t.kunde_id
        WHERE t.status = 'gebucht' AND t.erinnert = 0 AND t.start >= ? AND t.start < ? AND k.email IS NOT NULL AND k.geloescht = 0", [$von, $bis]);
    $n = 0;
    foreach ($zeilen as $z) {
        $t = termin_lesen((int)$z['id']);
        $salon = $db->eins('SELECT * FROM {p}salon WHERE id = ?', [$t['salon']]);
        $link = termin_link($t['token']);
        $text = ("Guten Tag,\n\nwir freuen uns auf Sie:\n\n" . termin_text($t, $salon)
            . "\n\n" . ($link ? "Falls etwas dazwischenkommt:\n$link\n\n" : '') . "Ihr Irmonhair-Team · {$salon['telefon_text']}\n");
        if (post_senden($z['email'], 'Erinnerung: morgen um ' . substr($t['start'], 11, 5) . ' Uhr bei Irmonhair', $text)) $n++;
        $db->aendern('termin', ['erinnert' => 1], 'id = ?', [$z['id']]);
    }
    // Aufräumen: abgelaufene Sitzungen.
    $db->q('DELETE FROM {p}sitzung WHERE ablauf < ?', [jetzt()]);
    return ['erinnert' => $n];
}

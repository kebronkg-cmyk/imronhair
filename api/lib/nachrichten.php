<?php
/* Nachrichten an Kundinnen: SMS, WhatsApp und E-Mail über eine Warteschlange.

   Alles, was nicht sofort als Antwort auf eine Handlung der Kundin geht
   (Erinnerung, Recall, Warteliste, Angebote), wird in {p}nachricht
   eingereiht und vom Cronjob abgearbeitet — mit Wiederholung bei
   Netzfehlern, ohne Doppelversand (eindeutiger Schlüssel je Anlass) und
   mit einer letzten Prüfung direkt vor dem Senden: Hat die Kundin
   inzwischen STOP geschrieben oder die Einwilligung zurückgenommen, geht
   nichts mehr raus.

   Regeln aus der Spezifikation:
   - Werbung und Recall nur mit Einwilligung, nie vorausgewählt; jede
     solche SMS endet mit „Abmelden: STOP“, STOP wirkt sofort.
   - Recall nur, wenn kein Folgetermin gebucht ist; höchstens eine
     Nachricht und eine Nachfrage.
   - SMS/WhatsApp am Vortag nur, wenn es sich lohnt (Preis, früheres
     Nichterscheinen, Telefonbuchung) — oder wenn es keine E-Mail gibt.
   - Warteliste: Wer zuerst tippt, bekommt den Platz; der Link verfällt,
     sobald der Platz weg ist.
   - Keine Werbung nachts, sonntags und an Feiertagen. */

declare(strict_types=1);

require_once __DIR__ . '/post.php';

/** Werbung im Sinne des UWG: nur mit Einwilligung, immer mit STOP. */
const ZWECK_WERBUNG = ['recall' => 'recall', 'recall_nachfass' => 'recall', 'kampagne' => 'angebote'];
/** Nicht nachts, nicht sonntags. */
const ZWECK_RUHE = ['recall', 'recall_nachfass', 'kampagne', 'warteliste'];

/* ── Kanäle ──────────────────────────────────────────────────────────── */

function sms_konfig(): array
{
    return (array)konfig('sms', []) + ['aktiv' => false, 'anbieter' => 'seven', 'schluessel' => '', 'absender' => 'Irmonhair', 'eingang_schluessel' => ''];
}

function sms_aktiv(): bool
{
    $k = sms_konfig();
    return !empty($k['aktiv']) && ($k['anbieter'] === 'vorfuehrung' || (string)$k['schluessel'] !== '');
}

function whatsapp_konfig(): array
{
    return (array)konfig('whatsapp', []) + ['aktiv' => false, 'token' => '', 'telefon_id' => '', 'vorlage_erinnerung' => 'termin_erinnerung', 'sprache' => 'de', 'anbieter' => 'meta'];
}

function whatsapp_aktiv(): bool
{
    $k = whatsapp_konfig();
    return !empty($k['aktiv']) && ($k['anbieter'] === 'vorfuehrung' || ($k['token'] !== '' && $k['telefon_id'] !== ''));
}

function kanal_bereit(string $kanal): bool
{
    return match ($kanal) { 'email' => post_aktiv(), 'sms' => sms_aktiv(), 'whatsapp' => whatsapp_aktiv(), default => false };
}

/** Kann eine Antwort „STOP“ überhaupt ankommen? Nur mit einer Absendernummer
    (kein Name wie „Irmonhair“) und eingerichtetem Eingang beim Anbieter. */
function stop_moeglich(): bool
{
    $k = sms_konfig();
    return $k['anbieter'] === 'vorfuehrung' || ((string)$k['eingang_schluessel'] !== '' && preg_match('/^\+?\d{6,16}$/', (string)$k['absender']));
}

/** SMS-Teile: 160 Zeichen im GSM-Zeichensatz (153 je Teil bei mehreren),
    sonst 70 (67). Ein einziger Gedankenstrich macht aus 160 Zeichen 70 —
    deshalb wird vorher geglättet. */
function sms_teile(string $text): int
{
    static $gsm = null, $ext = null;
    $gsm ??= array_flip(mb_str_split("@£\$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"));
    $ext ??= array_flip(mb_str_split("^{}\\[~]|€\f"));
    $n = 0;
    foreach (mb_str_split($text) as $z) {
        if (isset($gsm[$z])) $n++;
        elseif (isset($ext[$z])) $n += 2;
        else { $l = mb_strlen($text); return $l <= 70 ? 1 : (int)ceil($l / 67); }
    }
    return $n <= 160 ? 1 : (int)ceil($n / 153);
}

function sms_glaetten(string $t): string
{
    return trim(strtr($t, ['–' => '-', '—' => '-', '„' => '"', '“' => '"', '”' => '"', '‚' => "'", '‘' => "'", '’' => "'",
        '…' => '...', '·' => '-', "\u{00A0}" => ' ', '•' => '-', '✓' => '', '→' => '->']));
}

function adresse_normal(string $kanal, ?string $an): ?string
{
    if ($an === null) return null;
    return $kanal === 'email' ? email_normal($an) : telefon_normal($an);
}

/* ── STOP ────────────────────────────────────────────────────────────── */

/** STOP gilt je Kanal und Adresse; eine STOP-SMS sperrt auch WhatsApp an dieselbe Nummer. */
function gesperrt(string $kanal, ?string $an): bool
{
    $k = $kanal === 'whatsapp' ? 'sms' : $kanal;
    $a = adresse_normal($k, $an);
    return $a === null || (bool)db()->wert('SELECT 1 FROM {p}sperre WHERE kanal = ? AND adresse = ?', [$k, $a]);
}

function sperren(string $kanal, string $an, string $quelle): void
{
    $k = $kanal === 'whatsapp' ? 'sms' : $kanal;
    $a = adresse_normal($k, $an);
    if (!$a || gesperrt($k, $a)) return;
    try { db()->einfuegen('sperre', ['kanal' => $k, 'adresse' => $a, 'zeit' => jetzt(), 'quelle' => $quelle]); }
    catch (PDOException $e) { /* gleichzeitig schon gesperrt */ }
    // Was noch in der Warteschlange liegt, bleibt liegen.
    db()->q("UPDATE {p}nachricht SET status = 'gesperrt' WHERE status = 'wartet' AND kanal IN (" . ($k === 'sms' ? "'sms','whatsapp'" : "'email'") . ') AND an = ?', [$a]);
    protokoll('stop', null, null, ['kanal' => $k, 'quelle' => $quelle]);
}

function entsperren(string $kanal, string $an): void
{
    $a = adresse_normal($kanal, $an);
    if ($a) db()->q('DELETE FROM {p}sperre WHERE kanal = ? AND adresse = ?', [$kanal, $a]);
}

/** Abmelden: Kundin will nichts Werbliches mehr. Termine bleiben, die
    Bestätigung zu einer Buchung auch (die verlangt sie selbst). */
function kundin_abmelden(int $kunde, string $quelle, bool $auchTermin = true): void
{
    $arten = ['recall', 'angebote'];
    if ($auchTermin) $arten[] = 'terminnachrichten';
    foreach ($arten as $art) einwilligung_setzen($kunde, $art, false, $quelle);
    db()->q("UPDATE {p}warteliste SET status = 'entfernt' WHERE kunde_id = ? AND status = 'aktiv'", [$kunde]);
    db()->q("UPDATE {p}nachricht SET status = 'zurueckgezogen' WHERE kunde_id = ? AND status = 'wartet' AND zweck <> 'erinnerung'", [$kunde]);
}

/* ── Einreihen und Senden ────────────────────────────────────────────── */

/** Nächste erlaubte Sendezeit für Werbung, Recall und Warteliste. */
function naechste_sendezeit(string $ab): string
{
    $e = einstellungen();
    $von = (int)$e['ruhe_von']; $bis = (int)$e['ruhe_bis'];
    $t = $ab;
    for ($i = 0; $i < 10; $i++) {
        $d = substr($t, 0, 10);
        $m = zeit_zu_min($t);
        if (wochentag($d) === 7 || isset(feiertage((int)substr($d, 0, 4))[$d])) { $t = min_zu_zeit(tag_plus($d, 1), $von); continue; }
        if ($m < $von) return min_zu_zeit($d, $von);
        if ($m >= $bis) { $t = min_zu_zeit(tag_plus($d, 1), $von); continue; }
        return $t;
    }
    return $t;
}

/**
 * Eine Nachricht einreihen. $n: kanal, zweck, an, text; dazu betreff,
 * kunde_id, termin_id, bezug, schluessel (verhindert Doppelversand),
 * nicht_vor, trotz_sperre (nur für die eine Bestätigung nach STOP).
 * Gibt die Nummer zurück — oder null, wenn der Kanal aus, die Adresse
 * gesperrt oder die Nachricht schon eingereiht ist.
 */
function nachricht_einreihen(array $n): ?int
{
    $kanal = $n['kanal'];
    if (!kanal_bereit($kanal)) return null;
    $an = adresse_normal($kanal, $n['an'] ?? null);
    if (!$an) return null;
    if (empty($n['trotz_sperre']) && gesperrt($kanal, $an)) return null;
    $text = (string)$n['text'];
    $zweck = $n['zweck'];
    if ($kanal !== 'email') {
        $text = sms_glaetten($text);
        if (isset(ZWECK_WERBUNG[$zweck]) && !preg_match('/Abmelden: STOP$/', $text)) $text .= "\nAbmelden: STOP";
        if ($zweck === 'warteliste' && !str_contains($text, 'STOP')) $text .= "\nAustragen: STOP";
    }
    $nichtVor = $n['nicht_vor'] ?? jetzt();
    if (in_array($zweck, ZWECK_RUHE, true)) $nichtVor = naechste_sendezeit($nichtVor);
    try {
        return db()->einfuegen('nachricht', [
            'kunde_id' => $n['kunde_id'] ?? null, 'termin_id' => $n['termin_id'] ?? null, 'kanal' => $kanal, 'zweck' => $zweck,
            'an' => $an, 'betreff' => $n['betreff'] ?? null, 'text' => $text, 'status' => 'wartet', 'versuche' => 0,
            'nicht_vor' => $nichtVor, 'teile' => $kanal === 'sms' ? sms_teile($text) : 1,
            'bezug' => $n['bezug'] ?? null, 'schluessel' => $n['schluessel'] ?? null, 'erstellt' => jetzt(),
        ]);
    } catch (PDOException $e) {
        if (($e->errorInfo[0] ?? '') === '23000' || str_contains($e->getMessage(), 'UNIQUE')) return null;
        throw $e;
    }
}

/**
 * Die Warteschlange abarbeiten. Jede Zeile wird erst „beansprucht“
 * (wartet → sendet, nur wenn sie noch wartet), dann gesendet — zwei
 * gleichzeitige Cronläufe senden nie dieselbe Nachricht. Netzfehler:
 * dreimal mit wachsendem Abstand, dann „fehler“.
 */
function warteschlange_abarbeiten(int $max = 80, ?array $nurIds = null): array
{
    $db = db();
    // Abgebrochen mitten im Senden: lieber nicht noch einmal (vielleicht ist sie schon raus).
    $db->q("UPDATE {p}nachricht SET status = 'fehler', fehler = 'Abgebrochen, Zustand unklar' WHERE status = 'sendet' AND nicht_vor < ?",
        [date('Y-m-d H:i:s', time() - 1800)]);
    $sql = "SELECT * FROM {p}nachricht WHERE status = 'wartet' AND nicht_vor <= ?";
    $werte = [jetzt()];
    if ($nurIds !== null) {
        if (!$nurIds) return ['gesendet' => 0, 'fehler' => 0, 'uebersprungen' => 0];
        $sql .= ' AND id IN (' . DB::liste($nurIds) . ')';
        $werte = array_merge($werte, array_values($nurIds));
    }
    $zeilen = $db->alle($sql . ' ORDER BY id LIMIT ' . max(1, min(500, $max)), $werte);
    $aus = ['gesendet' => 0, 'fehler' => 0, 'uebersprungen' => 0];
    foreach ($zeilen as $n) {
        $genommen = $db->q("UPDATE {p}nachricht SET status = 'sendet', versuche = versuche + 1, nicht_vor = ? WHERE id = ? AND status = 'wartet'", [jetzt(), $n['id']])->rowCount();
        if (!$genommen) continue;
        $grund = nachricht_noch_gueltig($n);
        if ($grund !== null) {
            $db->aendern('nachricht', ['status' => $grund], 'id = ?', [$n['id']]);
            $aus['uebersprungen']++;
            continue;
        }
        try {
            [$ok, $anbieterId, $kosten, $fehler] = kanal_senden($n);
        } catch (Throwable $e) {
            [$ok, $anbieterId, $kosten, $fehler] = [false, null, null, 'Technischer Fehler'];
            error_log('[irmonhair] Versand: ' . $e->getMessage());
        }
        $versuche = (int)$n['versuche'] + 1;
        if ($ok) {
            $db->aendern('nachricht', ['status' => 'gesendet', 'gesendet' => jetzt(), 'anbieter_id' => $anbieterId, 'kosten_cent' => $kosten, 'fehler' => null], 'id = ?', [$n['id']]);
            $aus['gesendet']++;
        } elseif ($versuche < 3) {
            $db->aendern('nachricht', ['status' => 'wartet', 'fehler' => mb_substr((string)$fehler, 0, 255), 'nicht_vor' => date('Y-m-d H:i:s', time() + 600 * $versuche)], 'id = ?', [$n['id']]);
        } else {
            $db->aendern('nachricht', ['status' => 'fehler', 'fehler' => mb_substr((string)$fehler, 0, 255)], 'id = ?', [$n['id']]);
            $aus['fehler']++;
        }
    }
    return $aus;
}

/** Letzte Prüfung vor dem Senden. Null = senden, sonst der neue Status. */
function nachricht_noch_gueltig(array $n): ?string
{
    if ($n['zweck'] !== 'stop' && gesperrt($n['kanal'], $n['an'])) return 'gesperrt';
    $art = ZWECK_WERBUNG[$n['zweck']] ?? null;
    if ($art && (!$n['kunde_id'] || !einwilligung_aktiv((int)$n['kunde_id'], $art))) return 'zurueckgezogen';
    if ($n['zweck'] === 'erinnerung' && $n['termin_id']) {
        $t = db()->eins('SELECT status, start FROM {p}termin WHERE id = ?', [$n['termin_id']]);
        if (!$t || $t['status'] !== 'gebucht' || $t['start'] < jetzt()) return 'ueberholt';
        if ($n['kanal'] !== 'email' && $n['kunde_id'] && !einwilligung_aktiv((int)$n['kunde_id'], 'terminnachrichten')) return 'zurueckgezogen';
    }
    if (in_array($n['zweck'], ['recall', 'recall_nachfass'], true) && $n['kunde_id']) {
        // Inzwischen gebucht? Dann ist die Erinnerung überflüssig.
        if (db()->wert("SELECT 1 FROM {p}termin WHERE kunde_id = ? AND status = 'gebucht' AND start >= ?", [$n['kunde_id'], jetzt()])) return 'ueberholt';
    }
    if ($n['zweck'] === 'warteliste' && preg_match('/^angebot-(\d+)$/', (string)$n['bezug'], $m)) {
        $a = db()->eins('SELECT status, ablauf FROM {p}angebot WHERE id = ?', [(int)$m[1]]);
        if (!$a || $a['status'] !== 'offen' || $a['ablauf'] < jetzt()) return 'ueberholt';
    }
    return null;
}

/** [ok, anbieter_id, kosten_cent, fehler] */
function kanal_senden(array $n): array
{
    if ($n['kanal'] === 'email') {
        $kopf = [];
        if ($n['kunde_id'] && $n['zweck'] !== 'stop') {
            // Abmelden mit einem Klick im Mailprogramm (RFC 8058).
            $url = api_adresse() . '?a=abbestellen&k=' . kunde_schluessel((int)$n['kunde_id']) . '&alle=1';
            if (api_adresse() !== '') { $kopf[] = "List-Unsubscribe: <$url>"; $kopf[] = 'List-Unsubscribe-Post: List-Unsubscribe=One-Click'; }
        }
        $ok = post_senden($n['an'], (string)$n['betreff'], (string)$n['text'], null, ['kopf' => $kopf, 'ohne_protokoll' => true]);
        return [$ok, null, 0, $ok ? null : 'E-Mail nicht angenommen'];
    }
    if ($n['kanal'] === 'sms') return sms_senden($n['an'], $n['text']);
    if ($n['kanal'] === 'whatsapp') return whatsapp_senden($n);
    return [false, null, null, 'Unbekannter Kanal'];
}

/** Adresse der Schnittstelle selbst (für Links in Nachrichten). */
function api_adresse(): string
{
    $k = (string)konfig('api_adresse', '');
    if ($k !== '') return $k;
    $b = (string)konfig('buchung_adresse', '');
    return $b !== '' ? preg_replace('#[^/]*$#', '', $b) . 'api/' : '';
}

/** Adresse einer Seite neben der Buchungsseite. */
function seite_adresse(string $datei, array $param = []): string
{
    $b = (string)konfig('buchung_adresse', '');
    if ($b === '') return '';
    return preg_replace('#[^/]*$#', '', $b) . $datei . ($param ? '?' . http_build_query($param) : '');
}

function http_senden(string $url, string $koerper, array $kopf, int $zeit = 15): array
{
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $koerper, CURLOPT_HTTPHEADER => $kopf,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $zeit, CURLOPT_CONNECTTIMEOUT => 8]);
        $antwort = curl_exec($c);
        $status = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
        $fehler = curl_error($c);
        curl_close($c);
        return [$antwort === false ? 0 : $status, $antwort === false ? $fehler : (string)$antwort];
    }
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $kopf), 'content' => $koerper, 'timeout' => $zeit, 'ignore_errors' => true]]);
    $antwort = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+ (\d{3})#', $h, $m)) $status = (int)$m[1];
    return [$status, $antwort === false ? 'keine Verbindung' : $antwort];
}

/** SMS über seven.io (oder in der Vorführung nur ins Protokoll). */
function sms_senden(string $an, string $text): array
{
    $k = sms_konfig();
    if ($k['anbieter'] === 'vorfuehrung') return [true, 'vorfuehrung', 0, null];
    [$status, $roh] = http_senden('https://gateway.seven.io/api/sms',
        http_build_query(['to' => $an, 'text' => $text, 'from' => (string)$k['absender'], 'json' => 1]),
        ['X-Api-Key: ' . $k['schluessel'], 'Accept: application/json', 'Content-Type: application/x-www-form-urlencoded']);
    $j = json_decode($roh, true);
    $erfolg = $status === 200 && is_array($j) && ((string)($j['success'] ?? '') === '100' || !empty($j['messages'][0]['success']));
    if (!$erfolg) return [false, null, null, 'SMS-Anbieter: ' . ($status ?: 'keine Verbindung') . ' ' . mb_substr(is_array($j) ? (string)($j['success'] ?? '') : $roh, 0, 80)];
    $preis = (float)($j['total_price'] ?? ($j['messages'][0]['price'] ?? 0));
    return [true, (string)($j['messages'][0]['id'] ?? ''), (int)round($preis * 100), null];
}

/** WhatsApp: geschäftlich angestoßene Nachrichten nur als freigegebene Vorlage.
    Die Werte der Vorlage stehen als JSON im Betreff der Nachricht. */
function whatsapp_senden(array $n): array
{
    $k = whatsapp_konfig();
    if ($k['anbieter'] === 'vorfuehrung') return [true, 'vorfuehrung', 0, null];
    $v = json_decode((string)$n['betreff'], true) ?: [];
    $koerper = json_encode(['messaging_product' => 'whatsapp', 'to' => ltrim($n['an'], '+'), 'type' => 'template',
        'template' => ['name' => $v['vorlage'] ?? $k['vorlage_erinnerung'], 'language' => ['code' => $k['sprache']],
            'components' => [['type' => 'body', 'parameters' => array_map(fn($w) => ['type' => 'text', 'text' => (string)$w], $v['werte'] ?? [])]]]],
        JSON_UNESCAPED_UNICODE);
    [$status, $roh] = http_senden('https://graph.facebook.com/v21.0/' . rawurlencode((string)$k['telefon_id']) . '/messages', $koerper,
        ['Authorization: Bearer ' . $k['token'], 'Content-Type: application/json']);
    $j = json_decode($roh, true);
    if ($status !== 200 || empty($j['messages'][0]['id'])) return [false, null, null, 'WhatsApp: ' . $status . ' ' . mb_substr((string)($j['error']['message'] ?? $roh), 0, 120)];
    return [true, (string)$j['messages'][0]['id'], null, null];
}

/* ── Vorlagen ────────────────────────────────────────────────────────── */

/** Texte mit Platzhaltern in {geschweiften Klammern}. Das Studio kann jede
    überschreiben; leer zurück = wieder die Vorgabe. SMS-Texte ohne
    Gedankenstriche und typografische Anführungszeichen (sonst 70 statt
    160 Zeichen je SMS). */
const VORLAGEN = [
    // Eine SMS hat 160 Zeichen; der Link allein braucht rund 80.
    'erinnerung_sms' => 'Irmonhair: Morgen {zeit} Uhr bei {person}, {adresse}. Ändern/absagen: {link}',
    'erinnerung_email_betreff' => 'Erinnerung: {zeile}',
    'erinnerung_email' => "Guten Tag {vorname},\n\nwir freuen uns auf Sie:\n\n{termin}\n\nFalls etwas dazwischenkommt, verschieben oder absagen Sie hier:\n{link}\n\nBis morgen,\nIhr Irmonhair-Team · {telefon}",
    'recall_sms' => 'Irmonhair: Hallo {vorname}, {wochen} Wochen seit Ihrem letzten Besuch. Ihr Wunschtermin: {link}',
    'recall_email_betreff' => 'Zeit für {leistung}?',
    'recall_email' => "Hallo {vorname},\n\nIhr letzter Besuch ist {wochen} Wochen her. Ungefähr jetzt wäre {leistung} wieder dran.\n\nIhre Auswahl von damals ist schon eingetragen, Sie wählen nur noch die Zeit:\n{link}\n\nHerzlich,\n{person} und das Irmonhair-Team · {telefon}",
    'nachfass_sms' => 'Irmonhair: Bei {person} sind diese Woche noch Zeiten frei. {link}',
    'nachfass_email_betreff' => 'Noch Zeiten frei bei {person}',
    'nachfass_email' => "Hallo {vorname},\n\nnur ein kurzer Nachtrag: Bei {person} sind in den nächsten Tagen noch Zeiten frei.\n{link}\n\nDanach melden wir uns nicht noch einmal.\n\nIhr Irmonhair-Team · {telefon}",
    'warteliste_sms' => 'Irmonhair: Platz frei! {tag} {zeit} bei {person}. Wer zuerst tippt: {link}',
    'warteliste_email_betreff' => 'Ein Platz ist frei: {tag}, {zeit} Uhr',
    'warteliste_email' => "Guten Tag {vorname},\n\nauf Ihrer Warteliste ist etwas frei geworden:\n\n{tag}, {zeit} Uhr bei {person} (Salon {salon})\n\nWer zuerst tippt, bekommt den Platz:\n{link}\n\nIhr Eintrag auf der Warteliste bleibt bestehen, falls es nicht passt.\n\nIhr Irmonhair-Team · {telefon}",
    'doi_email_betreff' => 'Bitte bestätigen: Angebote von Irmonhair',
    'doi_email' => "Guten Tag {vorname},\n\nSie möchten gelegentlich Angebote von Irmonhair bekommen, höchstens eins im Monat. Bitte bestätigen Sie das mit einem Klick:\n\n{link}\n\nWaren Sie das nicht? Dann ignorieren Sie diese E-Mail einfach; es passiert nichts.\n\nIhr Irmonhair-Team",
    'doi_sms' => 'Irmonhair: Bitte bestätigen Sie, dass Sie gelegentlich Angebote bekommen möchten (max. 1 im Monat): {link}',
];

function vorlage(string $name): string
{
    static $eigene = null;
    $eigene ??= json_decode((string)db()->wert("SELECT wert FROM {p}meta WHERE schluessel = 'vorlagen'"), true) ?: [];
    $t = trim((string)($eigene[$name] ?? ''));
    return $t !== '' ? $t : VORLAGEN[$name];
}

function ausfuellen(string $vorlage, array $werte): string
{
    $t = preg_replace_callback('/\{([a-z_]+)\}/', fn($m) => (string)($werte[$m[1]] ?? ''), $vorlage);
    // Ohne Vornamen: „Hallo ,“ → „Hallo,“
    return preg_replace(['/ +([,!.?])/', '/ {2,}/'], ['$1', ' '], $t);
}

/* ── Gemeinsame Bausteine ────────────────────────────────────────────── */

function salon_lesen(string $id): array
{
    static $c = [];
    return $c[$id] ??= (db()->eins('SELECT * FROM {p}salon WHERE id = ?', [$id]) ?? ['id' => $id, 'name' => $id, 'strasse' => '', 'ort' => '', 'telefon_text' => '']);
}

function kurz_strasse(string $s): string
{
    return preg_replace('/stra(ss|ß)e\b/u', 'str.', $s);
}

function tag_kurz(string $zeit): string
{
    $tage = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    return $tage[(int)date('N', strtotime($zeit))] . ' ' . date('d.m.', strtotime($zeit));
}

/** Kanal für eine Kundin: SMS (wenn erlaubt und erreichbar), sonst E-Mail. */
function kanal_fuer(array $k, bool $smsErlaubt = true): ?array
{
    if ($smsErlaubt && !empty($k['telefon']) && sms_aktiv() && !gesperrt('sms', $k['telefon'])) return ['sms', $k['telefon']];
    if (!empty($k['email']) && post_aktiv() && !gesperrt('email', $k['email'])) return ['email', $k['email']];
    return null;
}

/** Fußzeile jeder werblichen E-Mail: Abmelden mit einem Klick. */
function email_fuss(int $kunde): string
{
    $link = seite_adresse('nachrichten.html', ['k' => kunde_schluessel($kunde)]);
    return $link ? "\n\nNachrichten abbestellen oder ändern:\n$link\n" : '';
}

/* ── Erinnerung am Vortag ────────────────────────────────────────────── */

/** Lohnt eine SMS? Spezifikation: ab 80 €, nach einem Nichterscheinen,
    bei Telefonbuchung. Dazu: wenn es keine E-Mail gibt — sonst bekäme
    die Kundin gar keine Erinnerung. */
function sms_erinnerung_lohnt(array $t): bool
{
    $e = einstellungen();
    if ($e['erinnerung_sms'] === 'nie') return false;
    if ($e['erinnerung_sms'] === 'immer') return true;
    if ((int)$t['preis_cent'] >= (int)$e['erinnerung_schwelle']) return true;
    if (in_array($t['quelle'], ['telefon', 'vorort', 'kasse_vorausbuchung'], true)) return true;
    if (empty($t['email'])) return true;
    return (bool)db()->wert("SELECT 1 FROM {p}termin WHERE kunde_id = ? AND status = 'nicht_erschienen'", [$t['kunde_id']]);
}

function erinnerungen_einreihen(): array
{
    $db = db();
    $von = date('Y-m-d H:i:s', time() + 20 * 3600);
    $bis = date('Y-m-d H:i:s', time() + 28 * 3600);
    $zeilen = $db->alle("SELECT t.id, t.start, t.kunde_id, t.preis_cent, t.quelle, t.erinnert, t.erinnert_sms, k.email, k.telefon, k.vorname
        FROM {p}termin t JOIN {p}kunde k ON k.id = t.kunde_id
        WHERE t.status = 'gebucht' AND t.start >= ? AND t.start < ? AND k.geloescht = 0 AND (t.erinnert = 0 OR t.erinnert_sms = 0)", [$von, $bis]);
    $aus = ['email' => 0, 'sms' => 0];
    foreach ($zeilen as $z) {
        $t = null;
        $werte = function () use (&$t, $z) {
            $t ??= termin_lesen((int)$z['id']);
            $s = salon_lesen($t['salon']);
            return ['vorname' => $z['vorname'], 'tag' => tag_kurz($t['start']), 'zeit' => substr($t['start'], 11, 5), 'person' => $t['person_name'],
                'adresse' => kurz_strasse((string)$s['strasse']), 'salon' => $s['name'], 'link' => termin_link($t['token']),
                'termin' => termin_text($t, $s), 'zeile' => termin_zeile($t, $s), 'telefon' => $s['telefon_text']];
        };
        if (!(int)$z['erinnert']) {
            if ($z['email'] && post_aktiv()) {
                $w = $werte();
                if (nachricht_einreihen(['kanal' => 'email', 'zweck' => 'erinnerung', 'an' => $z['email'], 'kunde_id' => (int)$z['kunde_id'], 'termin_id' => (int)$z['id'],
                    'betreff' => ausfuellen(vorlage('erinnerung_email_betreff'), $w), 'text' => ausfuellen(vorlage('erinnerung_email'), $w),
                    'schluessel' => 'erinnerung-email-' . $z['id'] . '-' . $z['start']])) $aus['email']++;
            }
            $db->aendern('termin', ['erinnert' => 1], 'id = ?', [$z['id']]);
        }
        if (!(int)$z['erinnert_sms']) {
            $kanal = whatsapp_aktiv() ? 'whatsapp' : (sms_aktiv() ? 'sms' : null);
            if ($kanal && $z['telefon'] && einwilligung_aktiv((int)$z['kunde_id'], 'terminnachrichten') && sms_erinnerung_lohnt($z)) {
                $w = $werte();
                $n = ['kanal' => $kanal, 'zweck' => 'erinnerung', 'an' => $z['telefon'], 'kunde_id' => (int)$z['kunde_id'], 'termin_id' => (int)$z['id'],
                    'text' => ausfuellen(vorlage('erinnerung_sms'), $w), 'schluessel' => 'erinnerung-tel-' . $z['id'] . '-' . $z['start']];
                if ($kanal === 'whatsapp') $n['betreff'] = json_encode(['vorlage' => whatsapp_konfig()['vorlage_erinnerung'],
                    'werte' => [$w['vorname'] ?: 'Guten Tag', $w['tag'] . ' ' . $w['zeit'] . ' Uhr', $w['person'], $w['adresse'], $w['link']]], JSON_UNESCAPED_UNICODE);
                if (nachricht_einreihen($n)) $aus['sms']++;
            }
            $db->aendern('termin', ['erinnert_sms' => 1], 'id = ?', [$z['id']]);
        }
    }
    return $aus;
}

/* ── Recall ──────────────────────────────────────────────────────────── */

/** Abstand bis zum nächsten Besuch: der eigene Rhythmus der Kundin (ab
    drei Besuchen, wenn er plausibel ist), sonst der der Leistung. */
function recall_abstand(int $kunde, array $letzter): ?int
{
    $db = db();
    $tage = $db->wert('SELECT MAX(l.recall_tage) FROM {p}termin_posten p JOIN {p}leistung l ON l.id = p.leistung_id WHERE p.termin_id = ?', [$letzter['id']]);
    if ($tage === null) return null;
    $tage = (int)$tage;
    $starts = array_column($db->alle("SELECT start FROM {p}termin WHERE kunde_id = ? AND (status = 'erschienen' OR (status = 'gebucht' AND start < ?)) ORDER BY start DESC LIMIT 7", [$kunde, jetzt()]), 'start');
    if (count($starts) >= 3) {
        $ab = [];
        for ($i = 0; $i + 1 < count($starts); $i++) $ab[] = (int)round((strtotime($starts[$i]) - strtotime($starts[$i + 1])) / 86400);
        sort($ab);
        $median = $ab[intdiv(count($ab), 2)];
        if ($median >= $tage / 2 && $median <= $tage * 2) return $median;
    }
    return $tage;
}

function recall_token(): string { return zufall(8); }

/** Täglich: wer ist fällig, wer bekommt die eine Nachfrage, was kam zurück? */
function recall_pruefen(bool $erzwingen = false): array
{
    $e = einstellungen();
    $aus = ['erste' => 0, 'nachfass' => 0, 'zurueck' => 0];
    if (!$e['recall_aktiv'] && !$erzwingen) return $aus;
    $db = db();
    $heute = date('Y-m-d');
    $jetzt = jetzt();

    // Zurückgeholt: nach der Nachricht neu gebucht (über den Link oder anders).
    foreach ($db->alle("SELECT r.id, r.kunde_id, r.erste FROM {p}recall r WHERE r.termin_id IS NULL AND r.erste IS NOT NULL AND r.status IN ('offen', 'ohne_antwort')") as $r) {
        $t = $db->wert("SELECT id FROM {p}termin WHERE kunde_id = ? AND erstellt >= ? AND erstellt < ? AND status NOT IN ('storniert_kunde', 'storniert_salon') ORDER BY erstellt LIMIT 1",
            [$r['kunde_id'], $r['erste'], date('Y-m-d H:i:s', strtotime($r['erste']) + 30 * 86400)]);
        if ($t) { $db->aendern('recall', ['termin_id' => (int)$t, 'status' => 'gebucht'], 'id = ?', [$r['id']]); $aus['zurueck']++; }
    }

    $kunden = $db->alle("SELECT k.* FROM {p}kunde k JOIN {p}einwilligung e ON e.kunde_id = k.id AND e.art = 'recall'
        WHERE k.geloescht = 0 AND e.id = (SELECT MAX(e2.id) FROM {p}einwilligung e2 WHERE e2.kunde_id = k.id AND e2.art = 'recall') AND e.erteilt = 1");
    foreach ($kunden as $k) {
        $kid = (int)$k['id'];
        if ($db->wert("SELECT 1 FROM {p}termin WHERE kunde_id = ? AND status = 'gebucht' AND start >= ?", [$kid, $jetzt])) continue;
        $letzter = $db->eins("SELECT * FROM {p}termin WHERE kunde_id = ? AND (status = 'erschienen' OR (status = 'gebucht' AND start < ?)) ORDER BY start DESC LIMIT 1", [$kid, $jetzt]);
        if (!$letzter) continue;
        $row = $db->eins('SELECT * FROM {p}recall WHERE kunde_id = ? AND letzter_termin_id = ?', [$kid, $letzter['id']]);
        if (!$row) {
            $tage = recall_abstand($kid, $letzter);
            if ($tage === null) continue;
            $faellig = tag_plus(substr($letzter['start'], 0, 10), $tage);
            // Fällig, aber nicht uralt: wer seit Monaten weg ist, bekommt
            // beim Einschalten keinen Schwall alter Erinnerungen.
            if ($faellig > $heute || $faellig < tag_plus($heute, -45)) continue;
            $id = $db->einfuegen('recall', ['kunde_id' => $kid, 'letzter_termin_id' => (int)$letzter['id'], 'faellig' => $faellig,
                'token' => recall_token(), 'status' => 'offen', 'erstellt' => $jetzt]);
            $row = $db->eins('SELECT * FROM {p}recall WHERE id = ?', [$id]);
            if (recall_senden($k, $row, $letzter, 'recall')) $aus['erste']++;
            continue;
        }
        if ($row['status'] !== 'offen') continue;
        if (!$row['erste']) {
            if (recall_senden($k, $row, $letzter, 'recall')) $aus['erste']++;
        } elseif (!$row['zweite'] && $row['erste'] <= date('Y-m-d H:i:s', time() - (int)$e['recall_nachfass'] * 86400)) {
            if (recall_senden($k, $row, $letzter, 'recall_nachfass')) $aus['nachfass']++;
        } elseif ($row['zweite'] && $row['zweite'] <= date('Y-m-d H:i:s', time() - 14 * 86400)) {
            // Eine Nachricht, eine Nachfrage — dann ist Schluss.
            $db->aendern('recall', ['status' => 'ohne_antwort'], 'id = ?', [$row['id']]);
        }
    }
    return $aus;
}

function recall_senden(array $k, array $row, array $letzter, string $zweck): bool
{
    $kanal = kanal_fuer($k);
    if (!$kanal) return false;
    [$art, $an] = $kanal;
    $t = termin_lesen((int)$letzter['id']);
    $s = salon_lesen($t['salon']);
    $leistung = $t['posten'][0]['name'] ?? 'Ihren nächsten Termin';
    $w = ['vorname' => $k['vorname'], 'wochen' => max(1, (int)round((time() - strtotime($letzter['start'])) / 604800)),
        'leistung' => $leistung, 'person' => $t['person_name'], 'salon' => $s['name'], 'telefon' => $s['telefon_text'],
        'link' => termin_basis() . '?r=' . $row['token']];
    $vor = $zweck === 'recall' ? 'recall' : 'nachfass';
    $n = ['kanal' => $art, 'zweck' => $zweck, 'an' => $an, 'kunde_id' => (int)$k['id'], 'bezug' => 'recall-' . $row['id'],
        'schluessel' => $zweck . '-' . $row['id']];
    if ($art === 'email') {
        $n['betreff'] = ausfuellen(vorlage($vor . '_email_betreff'), $w);
        $n['text'] = ausfuellen(vorlage($vor . '_email'), $w) . email_fuss((int)$k['id']);
    } else {
        $n['text'] = ausfuellen(vorlage($vor . '_sms'), $w);
    }
    $id = nachricht_einreihen($n);
    if (!$id) return false;
    db()->aendern('recall', [$zweck === 'recall' ? 'erste' : 'zweite' => jetzt(), 'kanal' => $art], 'id = ?', [$row['id']]);
    return true;
}

/** Buchungsseite ohne Parameter. */
function termin_basis(): string
{
    return preg_replace('/\?.*$/', '', (string)konfig('buchung_adresse', ''));
}

/** Die Buchung kam über einen Link aus einer Nachricht: zuordnen. */
function herkunft_zuordnen(?string $ref, ?int $kunde, int $termin): void
{
    if (!$ref || !$kunde) return;
    if (preg_match('/^recall-([a-f0-9]{16})$/', $ref, $m)) {
        db()->q("UPDATE {p}recall SET termin_id = ?, status = 'gebucht' WHERE token = ? AND kunde_id = ? AND termin_id IS NULL", [$termin, $m[1], $kunde]);
    }
}

/* ── Warteliste ──────────────────────────────────────────────────────── */

const TAGESZEITEN = ['egal' => [0, 1440], 'vormittag' => [0, 720], 'mittag' => [690, 900], 'nachmittag' => [720, 1020], 'abend' => [1020, 1440]];

/**
 * Eintragen. $w: kunde_id, salon, leistungen (IDs), person|null, von, bis,
 * tageszeit, quelle, notiz, online (nur online buchbare Leistungen).
 */
function warteliste_eintragen(array $w): array
{
    $db = db();
    $leistungen = leistungen_laden($w['leistungen'], $w['salon'], !empty($w['online']));
    if (!personen_fuer($leistungen, !empty($w['online']), $w['person'] ?: null)) throw new Fehler('Für diese Auswahl gibt es niemanden.', 422, 'person');
    $heute = date('Y-m-d');
    $von = max($heute, datum_pruefen($w['von']));
    $bis = datum_pruefen($w['bis']);
    if ($bis < $von) throw new Fehler('Das Ende des Zeitraums liegt vor dem Anfang.', 422, 'zeitraum');
    if ($bis > tag_plus($heute, 90)) throw new Fehler('Höchstens drei Monate im Voraus.', 422, 'zeitraum');
    $tz = isset(TAGESZEITEN[$w['tageszeit'] ?? '']) ? $w['tageszeit'] : 'egal';
    $offen = (int)$db->wert("SELECT COUNT(*) FROM {p}warteliste WHERE kunde_id = ? AND status = 'aktiv' AND bis >= ?", [$w['kunde_id'], $heute]);
    if ($offen >= 3) throw new Fehler('Sie stehen schon dreimal auf der Warteliste. Bitte rufen Sie uns an.', 409, 'zu_viele');
    $id = $db->schreiben(function (DB $db) use ($w, $leistungen, $von, $bis, $tz) {
        $id = $db->einfuegen('warteliste', ['kunde_id' => $w['kunde_id'], 'salon_id' => $w['salon'], 'leistungen' => json_encode(array_column($leistungen, 'id')),
            'person_id' => $w['person'] ?: null, 'von' => $von, 'bis' => $bis, 'tageszeit' => $tz, 'status' => 'aktiv', 'token' => zufall(16),
            'quelle' => $w['quelle'], 'notiz' => $w['notiz'] ?? null, 'erstellt' => jetzt()]);
        $db->einfuegen('einwilligung', ['kunde_id' => $w['kunde_id'], 'art' => 'warteliste', 'erteilt' => 1, 'zeit' => jetzt(),
            'quelle' => $w['quelle'], 'wortlaut' => EINWILLIGUNG_WARTELISTE, 'termin_id' => null]);
        $db->standErhoehen();
        protokoll('warteliste_eingetragen', null, (int)$w['kunde_id'], ['id' => $id, 'salon' => $w['salon'], 'von' => $von, 'bis' => $bis]);
        return $id;
    });
    return warteliste_lesen($id);
}

function warteliste_lesen(int $id): array
{
    $w = db()->eins('SELECT w.*, k.vorname, k.nachname, k.telefon, k.email FROM {p}warteliste w JOIN {p}kunde k ON k.id = w.kunde_id WHERE w.id = ?', [$id]);
    if (!$w) throw new Fehler('Eintrag nicht gefunden.', 404);
    $ids = json_decode($w['leistungen'], true) ?: [];
    $namen = $ids ? array_column(db()->alle('SELECT id, name FROM {p}leistung WHERE id IN (' . DB::liste($ids) . ')', $ids), 'name', 'id') : [];
    return ['id' => (int)$w['id'], 'kunde_id' => (int)$w['kunde_id'], 'name' => trim($w['vorname'] . ' ' . $w['nachname']),
        'telefon_text' => telefon_anzeige($w['telefon']), 'email' => $w['email'], 'salon' => $w['salon_id'], 'leistungen' => $ids,
        'leistungen_namen' => array_values(array_map(fn($i) => $namen[$i] ?? $i, $ids)), 'person' => $w['person_id'],
        'von' => $w['von'], 'bis' => $w['bis'], 'tageszeit' => $w['tageszeit'], 'status' => $w['status'], 'token' => $w['token'],
        'quelle' => $w['quelle'], 'notiz' => $w['notiz'], 'erstellt' => substr($w['erstellt'], 0, 16),
        'letztes_angebot' => $w['letztes_angebot'] ? substr($w['letztes_angebot'], 0, 16) : null,
        'termin_id' => $w['termin_id'] ? (int)$w['termin_id'] : null];
}

/**
 * Passende freie Plätze suchen und anbieten. Nach jeder Absage für den
 * Tag ($datum), sonst stündlich über alle Einträge. Ein Platz geht an
 * bis zu drei Wartende zugleich — wer zuerst tippt, bekommt ihn.
 * Gibt die Nummern der eingereihten Nachrichten zurück.
 */
function warteliste_abgleich(?string $salon = null, ?string $datum = null): array
{
    $e = einstellungen();
    if (!$e['warteliste_aktiv'] || !$e['online_aktiv']) return [];
    $db = db();
    $heute = date('Y-m-d');
    $db->q("UPDATE {p}warteliste SET status = 'abgelaufen' WHERE status = 'aktiv' AND bis < ?", [$heute]);
    $db->q("UPDATE {p}angebot SET status = 'abgelaufen' WHERE status = 'offen' AND ablauf < ?", [jetzt()]);
    $sql = "SELECT * FROM {p}warteliste WHERE status = 'aktiv' AND bis >= ? AND (letztes_angebot IS NULL OR letztes_angebot < ?)";
    $werte = [$heute, date('Y-m-d H:i:s', time() - 4 * 3600)];
    if ($salon) { $sql .= ' AND salon_id = ?'; $werte[] = $salon; }
    if ($datum) { $sql .= ' AND von <= ? AND bis >= ?'; $werte[] = $datum; $werte[] = $datum; }
    $eintraege = $db->alle($sql . ' ORDER BY erstellt LIMIT 200', $werte);
    if (!$eintraege) return [];
    // Mindestens zwei Stunden Vorlauf: Wer die Nachricht liest, muss es noch schaffen.
    $fr = max(online_fruehestens(), date('Y-m-d H:i:00', (int)(ceil((time() + 7200) / 900) * 900)));
    $letzter = tag_plus($heute, (int)$e['horizont']);
    $jePlatz = [];
    $ids = [];
    foreach ($eintraege as $w) {
        try { $ls = leistungen_laden(json_decode($w['leistungen'], true) ?: [], $w['salon_id'], true); } catch (Fehler $ex) { continue; }
        $personen = array_keys(personen_fuer($ls, true, $w['person_id'] ?: null));
        if (!$personen) continue;
        $von = $datum ?? max($w['von'], $heute);
        $bis = $datum ?? min($w['bis'], $letzter, tag_plus($von, 20));
        if ($bis < $von) continue;
        [$tzVon, $tzBis] = TAGESZEITEN[$w['tageszeit']] ?? TAGESZEITEN['egal'];
        $frei = freie_zeiten($w['salon_id'], phasen_verketten($ls), $personen, $von, $bis, $fr);
        $schon = array_flip(array_column($db->alle('SELECT start FROM {p}angebot WHERE warteliste_id = ?', [$w['id']]), 'start'));
        foreach ($frei as $d => $zeiten) {
            foreach ($zeiten as $t => $wer) {
                if ($t < $tzVon || $t >= $tzBis) continue;
                $start = min_zu_zeit($d, $t);
                if (isset($schon[$start])) continue;
                $platz = $w['salon_id'] . '|' . $start;
                if (($jePlatz[$platz] ?? 0) >= 3) continue;
                $n = angebot_machen($w, $start, $wer[0]);
                if ($n) { $ids[] = $n; $jePlatz[$platz] = ($jePlatz[$platz] ?? 0) + 1; }
                continue 3;
            }
        }
    }
    return $ids;
}

function angebot_machen(array $w, string $start, string $person): ?int
{
    $db = db();
    $k = $db->eins('SELECT * FROM {p}kunde WHERE id = ? AND geloescht = 0', [$w['kunde_id']]);
    if (!$k) return null;
    $kanal = kanal_fuer($k);
    if (!$kanal) return null;
    $token = zufall(12);
    $ablauf = min(date('Y-m-d H:i:s', strtotime($start) - 3600), date('Y-m-d H:i:s', time() + 24 * 3600));
    $aid = $db->einfuegen('angebot', ['warteliste_id' => (int)$w['id'], 'salon_id' => $w['salon_id'], 'person_id' => $w['person_id'] ?: $person,
        'start' => $start, 'token' => $token, 'status' => 'offen', 'erstellt' => jetzt(), 'ablauf' => $ablauf]);
    $db->aendern('warteliste', ['letztes_angebot' => jetzt()], 'id = ?', [$w['id']]);
    $s = salon_lesen($w['salon_id']);
    $pName = (string)$db->wert('SELECT name FROM {p}person WHERE id = ?', [$w['person_id'] ?: $person]);
    $vals = ['vorname' => $k['vorname'], 'tag' => tag_kurz($start), 'zeit' => substr($start, 11, 5), 'person' => $pName, 'salon' => $s['name'],
        'telefon' => $s['telefon_text'], 'link' => termin_basis() . '?w=' . $token];
    [$art, $an] = $kanal;
    $n = ['kanal' => $art, 'zweck' => 'warteliste', 'an' => $an, 'kunde_id' => (int)$k['id'], 'bezug' => 'angebot-' . $aid, 'schluessel' => 'angebot-' . $aid];
    if ($art === 'email') {
        $n['betreff'] = ausfuellen(vorlage('warteliste_email_betreff'), $vals);
        $n['text'] = ausfuellen(vorlage('warteliste_email'), $vals) . "\n\nVon der Warteliste austragen: " . termin_basis() . '?wl=' . $w['token'] . "\n";
    } else {
        $n['text'] = ausfuellen(vorlage('warteliste_sms'), $vals);
    }
    // Die Warteliste darf nachts nicht klingeln; dann verfällt das Angebot eben.
    $nv = naechste_sendezeit(jetzt());
    if ($nv > $ablauf) { $db->aendern('angebot', ['status' => 'abgelaufen'], 'id = ?', [$aid]); return null; }
    return nachricht_einreihen($n);
}

/** Ist das Angebot noch zu haben? Sonst gleich als vergeben markieren. */
function angebot_pruefen(array $a): array
{
    $db = db();
    if ($a['status'] === 'offen' && $a['ablauf'] < jetzt()) {
        $db->aendern('angebot', ['status' => 'abgelaufen'], 'id = ?', [$a['id']]);
        $a['status'] = 'abgelaufen';
    }
    $w = $db->eins('SELECT * FROM {p}warteliste WHERE id = ?', [$a['warteliste_id']]);
    $frei = false;
    $wer = [];
    if ($a['status'] === 'offen' && $w) {
        try {
            $ls = leistungen_laden(json_decode($w['leistungen'], true) ?: [], $w['salon_id'], true);
            $personen = array_keys(personen_fuer($ls, true, $w['person_id'] ?: null));
            $d = substr($a['start'], 0, 10);
            $wer = freie_zeiten($w['salon_id'], phasen_verketten($ls), $personen, $d, $d, online_fruehestens())[$d][zeit_zu_min($a['start'])] ?? [];
            $frei = (bool)$wer;
        } catch (Fehler $e) { $frei = false; }
        if (!$frei) { $db->aendern('angebot', ['status' => 'vergeben'], 'id = ?', [$a['id']]); $a['status'] = 'vergeben'; }
    }
    return [$a, $w, $wer];
}

/* ── Monatsbericht ───────────────────────────────────────────────────── */

function bericht(string $monat, ?string $salon = null): array
{
    if (!preg_match('/^\d{4}-\d{2}$/', $monat)) throw new Fehler('Monat ungültig.', 422);
    $db = db();
    $von = "$monat-01 00:00:00";
    $bis = date('Y-m-01 00:00:00', strtotime("$monat-01 +1 month"));
    $vorVon = date('Y-m-01 00:00:00', strtotime("$monat-01 -1 month"));
    $s = $salon ? ' AND salon_id = ?' : '';
    $w = fn(string $a, string $b) => $salon ? [$a, $b, $salon] : [$a, $b];
    $zahlen = function (string $a, string $b) use ($db, $s, $w) {
        $z = ['termine' => 0, 'umsatz_cent' => 0, 'nicht_erschienen' => 0, 'storniert_kunde' => 0, 'storniert_salon' => 0, 'online' => 0, 'quellen' => []];
        foreach ($db->alle("SELECT status, quelle, preis_cent, rabatt_cent, start FROM {p}termin WHERE start >= ? AND start < ?$s", $w($a, $b)) as $t) {
            if (storniert($t['status'])) { $z[$t['status']]++; continue; }
            $z['termine']++;
            $z['quellen'][$t['quelle']] = ($z['quellen'][$t['quelle']] ?? 0) + 1;
            if ($t['quelle'] === 'online') $z['online']++;
            if ($t['status'] === 'nicht_erschienen') { $z['nicht_erschienen']++; continue; }
            if ($t['start'] < jetzt()) $z['umsatz_cent'] += max(0, (int)$t['preis_cent'] - (int)$t['rabatt_cent']);
        }
        return $z;
    };
    $jetztZ = $zahlen($von, $bis);
    $vorher = $zahlen($vorVon, $von);
    $neu = (int)$db->wert('SELECT COUNT(*) FROM {p}kunde WHERE erstellt >= ? AND erstellt < ? AND geloescht = 0', [$von, $bis]);

    // Recall: gesendet in diesem Monat, und was daraus gebucht wurde.
    $rc = ['gesendet' => (int)$db->wert('SELECT COUNT(*) FROM {p}recall WHERE erste >= ? AND erste < ?', [$von, $bis]),
           'nachfass' => (int)$db->wert('SELECT COUNT(*) FROM {p}recall WHERE zweite >= ? AND zweite < ?', [$von, $bis])];
    $zurueck = $db->alle("SELECT r.id, t.preis_cent, t.status, t.salon_id FROM {p}recall r JOIN {p}termin t ON t.id = r.termin_id
        WHERE t.erstellt >= ? AND t.erstellt < ? AND t.status NOT IN ('storniert_kunde', 'storniert_salon')" . ($salon ? ' AND t.salon_id = ?' : ''), $w($von, $bis));
    $rc['zurueckgeholt'] = count($zurueck);
    $rc['umsatz_cent'] = array_sum(array_map(fn($z) => (int)$z['preis_cent'], $zurueck));
    $e = einstellungen();
    $rc['abrechnung_cent'] = (int)$e['recall_preis_cent'] > 0 ? min((int)$e['recall_deckel_cent'] ?: PHP_INT_MAX, $rc['zurueckgeholt'] * (int)$e['recall_preis_cent']) : 0;

    $wl = ['eingetragen' => (int)$db->wert("SELECT COUNT(*) FROM {p}warteliste WHERE erstellt >= ? AND erstellt < ?" . ($salon ? ' AND salon_id = ?' : ''), $w($von, $bis)),
           'angebote' => (int)$db->wert("SELECT COUNT(*) FROM {p}angebot WHERE erstellt >= ? AND erstellt < ?" . ($salon ? ' AND salon_id = ?' : ''), $w($von, $bis)),
           'gefuellt' => (int)$db->wert("SELECT COUNT(*) FROM {p}angebot WHERE status = 'angenommen' AND erstellt >= ? AND erstellt < ?" . ($salon ? ' AND salon_id = ?' : ''), $w($von, $bis))];
    $wl['umsatz_cent'] = (int)$db->wert("SELECT COALESCE(SUM(t.preis_cent), 0) FROM {p}angebot a JOIN {p}termin t ON t.id = a.termin_id
        WHERE a.status = 'angenommen' AND a.erstellt >= ? AND a.erstellt < ? AND t.status NOT IN ('storniert_kunde', 'storniert_salon')", [$von, $bis]);

    $nach = [];
    foreach ($db->alle("SELECT kanal, status, COUNT(*) AS n, COALESCE(SUM(teile), 0) AS teile, COALESCE(SUM(kosten_cent), 0) AS kosten FROM {p}nachricht WHERE erstellt >= ? AND erstellt < ? GROUP BY kanal, status", [$von, $bis]) as $z) {
        $nach[$z['kanal']][$z['status']] = ['n' => (int)$z['n'], 'teile' => (int)$z['teile'], 'kosten_cent' => (int)$z['kosten']];
    }
    $zwecke = array_column($db->alle("SELECT zweck, COUNT(*) AS n FROM {p}nachricht WHERE status = 'gesendet' AND gesendet >= ? AND gesendet < ? GROUP BY zweck", [$von, $bis]), 'n', 'zweck');
    $refs = $db->alle("SELECT ref, COUNT(*) AS n FROM {p}termin WHERE ref IS NOT NULL AND erstellt >= ? AND erstellt < ?$s GROUP BY ref ORDER BY n DESC LIMIT 10", $w($von, $bis));
    $gutscheine = ['verkauft' => (int)$db->wert('SELECT COUNT(*) FROM {p}gutschein WHERE erstellt >= ? AND erstellt < ?', [$von, $bis]),
        'verkauft_cent' => (int)$db->wert('SELECT COALESCE(SUM(wert_cent), 0) FROM {p}gutschein WHERE erstellt >= ? AND erstellt < ?', [$von, $bis]),
        'eingeloest_cent' => (int)$db->wert("SELECT COALESCE(SUM(betrag_cent), 0) FROM {p}gutschein_bewegung WHERE art = 'einloesung' AND zeit >= ? AND zeit < ?", [$von, $bis])];
    $stop = (int)$db->wert('SELECT COUNT(*) FROM {p}sperre WHERE zeit >= ? AND zeit < ?', [$von, $bis]);
    return ['monat' => $monat, 'salon' => $salon, 'termine' => $jetztZ, 'vormonat' => $vorher, 'neue_kunden' => $neu,
        'recall' => $rc, 'warteliste' => $wl, 'nachrichten' => $nach, 'zwecke' => $zwecke, 'stop' => $stop,
        'refs' => array_map(fn($r) => ['ref' => $r['ref'], 'n' => (int)$r['n']], $refs), 'gutscheine' => $gutscheine];
}

function bericht_text(array $b): string
{
    $mon = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    $t = $b['termine']; $v = $b['vormonat'];
    $pfeil = fn(int $a, int $b) => $b === 0 ? '' : ' (' . ($a >= $b ? '+' : '') . round(($a - $b) / $b * 100) . ' % zum Vormonat)';
    $quote = fn(int $n, int $von) => $von ? round($n / $von * 100, 1) . ' %' : '–';
    $kosten = 0; $sms = 0;
    foreach ($b['nachrichten'] as $kanal => $st) foreach ($st as $z) { $kosten += $z['kosten_cent']; if ($kanal === 'sms') $sms += $z['teile']; }
    $zeilen = [
        'Monatsbericht ' . $mon[(int)substr($b['monat'], 5, 2)] . ' ' . substr($b['monat'], 0, 4), '',
        'Termine: ' . $t['termine'] . $pfeil($t['termine'], $v['termine']),
        'Umsatz laut Terminpreisen: ' . euro_text($t['umsatz_cent'], false) . $pfeil($t['umsatz_cent'], $v['umsatz_cent']),
        'Online gebucht: ' . $t['online'] . ' (' . $quote($t['online'], $t['termine']) . ')',
        'Nicht erschienen: ' . $t['nicht_erschienen'] . ' (' . $quote($t['nicht_erschienen'], $t['termine']) . ', Vormonat ' . $quote($v['nicht_erschienen'], $v['termine']) . ')',
        'Abgesagt: ' . $t['storniert_kunde'] . ' von Kundinnen, ' . $t['storniert_salon'] . ' vom Salon',
        'Neue Kundinnen: ' . $b['neue_kunden'], '',
        'Recall: ' . $b['recall']['gesendet'] . ' Erinnerungen, ' . $b['recall']['nachfass'] . ' Nachfragen, ' . $b['recall']['zurueckgeholt'] . ' zurückgeholt (' . euro_text($b['recall']['umsatz_cent'], false) . ')',
        'Warteliste: ' . $b['warteliste']['eingetragen'] . ' neu eingetragen, ' . $b['warteliste']['angebote'] . ' Plätze angeboten, ' . $b['warteliste']['gefuellt'] . ' Lücken gefüllt (' . euro_text($b['warteliste']['umsatz_cent'], false) . ')',
        'Nachrichten: ' . array_sum($b['zwecke']) . ' gesendet, davon ' . $sms . ' SMS-Teile; Kosten ' . euro_text($kosten, false) . '; ' . $b['stop'] . ' Abmeldungen (STOP)',
        'Gutscheine: ' . $b['gutscheine']['verkauft'] . ' ausgegeben (' . euro_text($b['gutscheine']['verkauft_cent'], false) . '), eingelöst ' . euro_text($b['gutscheine']['eingeloest_cent'], false),
    ];
    if ($b['recall']['abrechnung_cent']) $zeilen[] = "\nAbrechnung Recall: " . $b['recall']['zurueckgeholt'] . ' × ' . euro_text((int)einstellungen()['recall_preis_cent'], false) . ' = ' . euro_text($b['recall']['abrechnung_cent'], false) . ' (höchstens ' . euro_text((int)einstellungen()['recall_deckel_cent'], false) . ')';
    if ($b['refs']) { $zeilen[] = "\nWoher die Buchungen kamen (Link-Kennung):"; foreach ($b['refs'] as $r) $zeilen[] = '  ' . $r['ref'] . ': ' . $r['n']; }
    $zeilen[] = "\nDer Umsatz stammt aus den Preisen im Terminbuch, nicht aus der Kasse.";
    return implode("\n", $zeilen) . "\n";
}

/** Am Monatsanfang einmal: der Bericht des Vormonats an die Inhaberin. */
function bericht_senden_wenn_faellig(): bool
{
    $monat = date('Y-m', strtotime(date('Y-m-01') . ' -1 month'));
    $db = db();
    if ($db->wert('SELECT 1 FROM {p}meta WHERE schluessel = ?', ['bericht-' . $monat])) return false;
    $an = (array)(konfig('bericht_an') ?: konfig('alarm_an', []));
    $an = array_values(array_filter($an));
    if (!$an || !post_aktiv()) return false;
    try { $db->q('INSERT INTO {p}meta (schluessel, wert) VALUES (?, ?)', ['bericht-' . $monat, jetzt()]); } catch (PDOException $e) { return false; }
    $text = bericht_text(bericht($monat));
    foreach ($an as $a) post_senden((string)$a, 'Irmonhair: Monatsbericht ' . $monat, $text, null, ['zweck' => 'bericht']);
    return true;
}

/* ── Cron ────────────────────────────────────────────────────────────── */

/** Der eine Cronjob für alles (alle 10–15 Minuten). Recall läuft einmal am Tag. */
function aktion_nachrichten(): array
{
    cron_pruefen();
    $db = db();
    $aus = ['erinnerungen' => erinnerungen_einreihen()];
    $heute = date('Y-m-d');
    $letzter = (string)$db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'recall_lauf'");
    if ($letzter !== $heute && (int)date('G') >= 9) {
        if ($letzter === '') $db->q("INSERT INTO {p}meta (schluessel, wert) VALUES ('recall_lauf', ?)", [$heute]);
        else $db->q("UPDATE {p}meta SET wert = ? WHERE schluessel = 'recall_lauf'", [$heute]);
        $aus['recall'] = recall_pruefen();
    }
    $aus['warteliste'] = count(warteliste_abgleich());
    $aus['versand'] = warteschlange_abarbeiten();
    $aus['bericht'] = bericht_senden_wenn_faellig();
    $db->q('DELETE FROM {p}sitzung WHERE ablauf < ?', [jetzt()]);
    return $aus;
}

/** Nach einer Absage oder Verschiebung: die Warteliste für diesen Tag
    prüfen und sofort senden (nicht erst beim nächsten Cronlauf). */
function nach_freigabe(string $salon, string $datum): void
{
    nach_antwort(function () use ($salon, $datum) {
        try {
            $ids = warteliste_abgleich($salon, $datum);
            if ($ids) warteschlange_abarbeiten(10, $ids);
        } catch (Throwable $e) {
            error_log('[irmonhair] Warteliste: ' . $e->getMessage());
        }
    });
}

/* ── Eingehende SMS: STOP ────────────────────────────────────────────── */

/** Webhook des SMS-Anbieters: api/?a=sms_eingang&schluessel=… (seven.io:
    „Eingehende SMS“). Versteht STOP, STOPP, ABMELDEN, ENDE — und START. */
function aktion_sms_eingang(): array
{
    $soll = (string)sms_konfig()['eingang_schluessel'];
    if ($soll === '' || !hash_equals($soll, (string)feld('schluessel', ''))) throw new Fehler('Nicht erlaubt.', 403);
    $d = feld('data');
    $d = is_array($d) ? $d : eingabe();
    $von = telefon_normal((string)($d['sender'] ?? $d['from'] ?? $d['phone'] ?? ''));
    $text = mb_strtoupper(trim((string)($d['text'] ?? $d['message'] ?? $d['body'] ?? '')));
    if (!$von) return ['ok' => true, 'erkannt' => false];
    $wort = preg_split('/[\s.!,]+/u', $text)[0] ?? '';
    if (in_array($wort, ['STOP', 'STOPP', 'ABMELDEN', 'ENDE', 'AUS', 'UNSUBSCRIBE', 'ABBESTELLEN'], true)) {
        db()->schreiben(function () use ($von) {
            sperren('sms', $von, 'sms_stop');
            foreach (db()->alle('SELECT id FROM {p}kunde WHERE telefon = ? AND geloescht = 0', [$von]) as $k) kundin_abmelden((int)$k['id'], 'sms_stop');
        });
        nachricht_einreihen(['kanal' => 'sms', 'zweck' => 'stop', 'an' => $von, 'trotz_sperre' => true,
            'text' => 'Irmonhair: Erledigt, Sie bekommen keine SMS mehr von uns. Termine buchen Sie weiter online oder telefonisch.']);
        warteschlange_abarbeiten(5);
        return ['ok' => true, 'erkannt' => 'stop'];
    }
    if ($wort === 'START') {
        entsperren('sms', $von);
        protokoll('start', null, null, ['kanal' => 'sms']);
        return ['ok' => true, 'erkannt' => 'start'];
    }
    protokoll('sms_eingang', null, null, ['text' => mb_substr($text, 0, 160)]);
    return ['ok' => true, 'erkannt' => false];
}

/* ── Bestätigung (Double-Opt-in) ─────────────────────────────────────── */

/** Den Bestätigungslink für Angebote schicken — per E-Mail, sonst per SMS.
    Er geht sofort (die Kundin wartet darauf), nicht in den Ruhezeiten. */
function doi_senden(int $kunde, string $token): void
{
    $k = db()->eins('SELECT * FROM {p}kunde WHERE id = ? AND geloescht = 0', [$kunde]);
    if (!$k) return;
    $link = seite_adresse('nachrichten.html', ['b' => $token]);
    if ($link === '') return;
    $w = ['vorname' => $k['vorname'], 'link' => $link];
    $id = null;
    if ($k['email'] && post_aktiv()) {
        $id = nachricht_einreihen(['kanal' => 'email', 'zweck' => 'doi', 'an' => $k['email'], 'kunde_id' => $kunde, 'schluessel' => 'doi-' . $token,
            'betreff' => ausfuellen(vorlage('doi_email_betreff'), $w), 'text' => ausfuellen(vorlage('doi_email'), $w)]);
    } elseif ($k['telefon'] && sms_aktiv()) {
        $id = nachricht_einreihen(['kanal' => 'sms', 'zweck' => 'doi', 'an' => $k['telefon'], 'kunde_id' => $kunde, 'schluessel' => 'doi-' . $token,
            'text' => ausfuellen(vorlage('doi_sms'), $w)]);
    }
    if ($id) nach_antwort(fn() => warteschlange_abarbeiten(3, [$id]));
}

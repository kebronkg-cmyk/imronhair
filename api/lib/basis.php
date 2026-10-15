<?php
/* Grundlagen: Einstellungen, Datenbank, Antworten, Zeit.
   Läuft auf PHP 8.0+ ohne Erweiterungen außer PDO (mysql oder sqlite),
   mbstring und json — bei All-Inkl standardmäßig an. */

declare(strict_types=1);

date_default_timezone_set('Europe/Berlin');
mb_internal_encoding('UTF-8');

const API_WURZEL = __DIR__ . '/..';

/** Fehler, die der Aufrufer sehen darf (Text auf Deutsch, für Menschen). */
final class Fehler extends RuntimeException
{
    public function __construct(string $text, public int $status = 400, public ?string $code_ = null, public array $extra = [])
    {
        parent::__construct($text);
    }
}

function konfig(?string $schluessel = null, mixed $vorgabe = null): mixed
{
    static $k = null;
    if ($k === null) {
        $datei = getenv('IRMONHAIR_KONFIG') ?: API_WURZEL . '/config.php';
        if (!is_file($datei)) {
            throw new Fehler('Die Buchung ist noch nicht eingerichtet (api/config.php fehlt).', 503, 'nicht_eingerichtet');
        }
        $k = mandant_waehlen(require $datei);
    }
    if ($schluessel === null) return $k;
    return $k[$schluessel] ?? $vorgabe;
}

/** Mandantenfähig: Stehen in der Konfiguration mehrere Mandanten (Salons
    oder Salonketten), gilt der, dessen Adresse aufgerufen wird (oder der
    aus IRMONHAIR_MANDANT). Jeder Mandant hat ein eigenes Tabellen-Präfix
    und damit eigene, getrennte Daten; seine Einträge überschreiben die
    gemeinsamen. Ohne „mandanten“ bleibt alles wie bei einem Salon. */
function mandant_waehlen(array $k): array
{
    if (empty($k['mandanten']) || !is_array($k['mandanten'])) return $k;
    $wahl = getenv('IRMONHAIR_MANDANT') ?: null;
    if ($wahl === null) {
        $host = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
        foreach ($k['mandanten'] as $id => $m) {
            if (in_array($host, array_map('strtolower', $m['hosts'] ?? []), true)) { $wahl = (string)$id; break; }
        }
    }
    if ($wahl === null || !isset($k['mandanten'][$wahl])) {
        throw new Fehler('Für diese Adresse ist keine Terminbuchung eingerichtet.', 503, 'nicht_eingerichtet');
    }
    $m = $k['mandanten'][$wahl];
    unset($k['mandanten'], $m['hosts']);
    if (empty($m['db']['praefix'])) throw new Fehler('Mandant ohne eigenes Tabellen-Präfix.', 500);
    return array_replace_recursive($k, $m) + ['mandant' => $wahl];
}

/* ── Datenbank ─────────────────────────────────────────────────────────
   Eine dünne Schicht über PDO. `{p}` im SQL wird durch das Tabellen-
   Präfix ersetzt. Schreibvorgänge laufen über schreiben(): SQLite nimmt
   mit BEGIN IMMEDIATE die Schreibsperre sofort (keine Zwei-Leser-Falle),
   MySQL sperrt die betroffenen Personen mit SELECT … FOR UPDATE. */

final class DB
{
    public PDO $pdo;
    public string $treiber;
    public string $p;
    private int $tiefe = 0;

    public function __construct(array $c)
    {
        $this->treiber = $c['treiber'] ?? 'sqlite';
        $this->p = $c['praefix'] ?? 'ih_';
        $opt = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ];
        if ($this->treiber === 'mysql') {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $c['host'] ?? 'localhost', (int)($c['port'] ?? 3306), $c['name']);
            if (!empty($c['socket'])) $dsn = sprintf('mysql:unix_socket=%s;dbname=%s;charset=utf8mb4', $c['socket'], $c['name']);
            $this->pdo = new PDO($dsn, $c['benutzer'], $c['passwort'], $opt);
            // Zeiten sind Ortszeit-Texte; die Zeitzone der Verbindung spielt keine Rolle.
            $this->pdo->exec("SET sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
            $this->pdo->exec('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
        } elseif ($this->treiber === 'sqlite') {
            $pfad = $c['pfad'] ?? API_WURZEL . '/daten/irmonhair.sqlite';
            $ordner = dirname($pfad);
            if (!is_dir($ordner)) mkdir($ordner, 0770, true);
            $this->pdo = new PDO('sqlite:' . $pfad, null, null, $opt);
            $this->pdo->exec('PRAGMA busy_timeout = 10000');
            $this->pdo->exec('PRAGMA journal_mode = WAL');
            $this->pdo->exec('PRAGMA synchronous = NORMAL');
            $this->pdo->exec('PRAGMA foreign_keys = ON');
        } else {
            throw new Fehler('Unbekannter Datenbanktreiber.', 500);
        }
    }

    public function sql(string $s): string
    {
        return str_replace('{p}', $this->p, $s);
    }

    public function q(string $sql, array $werte = []): PDOStatement
    {
        $st = $this->pdo->prepare($this->sql($sql));
        foreach (array_values($werte) as $i => $w) {
            $typ = is_int($w) ? PDO::PARAM_INT : (is_bool($w) ? PDO::PARAM_INT : ($w === null ? PDO::PARAM_NULL : PDO::PARAM_STR));
            $st->bindValue($i + 1, is_bool($w) ? (int)$w : $w, $typ);
        }
        $st->execute();
        return $st;
    }

    public function alle(string $sql, array $werte = []): array { return $this->q($sql, $werte)->fetchAll(); }
    public function eins(string $sql, array $werte = []): ?array { $r = $this->q($sql, $werte)->fetch(); return $r === false ? null : $r; }
    public function wert(string $sql, array $werte = []): mixed { $r = $this->q($sql, $werte)->fetchColumn(); return $r === false ? null : $r; }

    public function einfuegen(string $tabelle, array $zeile): int
    {
        $spalten = array_keys($zeile);
        $sql = 'INSERT INTO {p}' . $tabelle . ' (' . implode(',', $spalten) . ') VALUES (' . implode(',', array_fill(0, count($spalten), '?')) . ')';
        $this->q($sql, array_values($zeile));
        return (int)$this->pdo->lastInsertId();
    }

    public function aendern(string $tabelle, array $zeile, string $wo, array $woWerte): int
    {
        $teile = array_map(fn($s) => $s . ' = ?', array_keys($zeile));
        return $this->q('UPDATE {p}' . $tabelle . ' SET ' . implode(', ', $teile) . ' WHERE ' . $wo,
            array_merge(array_values($zeile), $woWerte))->rowCount();
    }

    /** Platzhalter für IN (…) */
    public static function liste(array $werte): string
    {
        return implode(',', array_fill(0, max(1, count($werte)), '?'));
    }

    /** Schreibtransaktion mit Wiederholung bei Sperrkonflikten. */
    public function schreiben(callable $f): mixed
    {
        if ($this->tiefe > 0) return $f($this);
        for ($versuch = 1; ; $versuch++) {
            try {
                if ($this->treiber === 'sqlite') $this->pdo->exec('BEGIN IMMEDIATE');
                else $this->pdo->beginTransaction();
                $this->tiefe++;
                $r = $f($this);
                $this->tiefe--;
                if ($this->treiber === 'sqlite') $this->pdo->exec('COMMIT');
                else $this->pdo->commit();
                return $r;
            } catch (Throwable $e) {
                $this->tiefe = 0;
                try {
                    if ($this->treiber === 'sqlite') $this->pdo->exec('ROLLBACK');
                    elseif ($this->pdo->inTransaction()) $this->pdo->rollBack();
                } catch (Throwable $_) { /* schon zurückgerollt */ }
                $sperre = $e instanceof PDOException && (
                    in_array((int)($e->errorInfo[1] ?? 0), [1213, 1205], true)       // MySQL: Deadlock, Lock-Timeout
                    || str_contains($e->getMessage(), 'database is locked'));        // SQLite
                if ($sperre && $versuch < 4) { usleep(random_int(40000, 160000) * $versuch); continue; }
                throw $e;
            }
        }
    }

    /** In MySQL die Zeilen dieser Personen bis zum Ende der Transaktion sperren. */
    public function personenSperren(array $ids): void
    {
        if ($this->treiber !== 'mysql' || !$ids) return;
        $ids = array_values(array_unique($ids));
        sort($ids);
        $this->q('SELECT id FROM {p}person WHERE id IN (' . self::liste($ids) . ') ORDER BY id FOR UPDATE', $ids);
    }

    /** Zähler für „hat sich etwas geändert?“ — das Studio fragt ihn ab. */
    public function standErhoehen(): void
    {
        $this->q("UPDATE {p}zaehler SET wert = wert + 1 WHERE name = 'stand'");
    }
}

function db(): DB
{
    static $db = null;
    if ($db === null) {
        $db = new DB(konfig('db', []));
        require_once __DIR__ . '/schema.php';
        schema_aktualisieren($db);
    }
    return $db;
}

/* ── Anfrage und Antwort ───────────────────────────────────────────── */

function eingabe(): array
{
    static $e = null;
    if ($e !== null) return $e;
    $e = $_GET;
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        // Fotos für die Kartei sind größer; alles andere bleibt klein.
        $grenze = match ((string)($_GET['a'] ?? '')) { 'foto_hochladen' => 8000000, 'import_pruefen', 'import_kunden' => 4000000, default => 200000 };
        $roh = file_get_contents('php://input') ?: '';
        if (strlen($roh) > $grenze) throw new Fehler('Anfrage zu groß.', 413);
        if (str_starts_with((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/x-www-form-urlencoded')) {
            // Abmelden mit einem Klick aus dem Mailprogramm (RFC 8058) und
            // eingehende SMS mancher Anbieter kommen als Formular.
            parse_str($roh, $form);
            $e = array_merge($e, $form);
            return $e;
        }
        $json = $roh === '' ? [] : json_decode($roh, true);
        if (!is_array($json)) throw new Fehler('Ungültige Anfrage.', 400);
        $e = array_merge($e, $json);
    }
    return $e;
}

function feld(string $name, mixed $vorgabe = null): mixed
{
    return eingabe()[$name] ?? $vorgabe;
}

function text_feld(string $name, int $max = 200, bool $pflicht = false): ?string
{
    $w = feld($name);
    if ($w === null || (is_string($w) && trim($w) === '')) {
        if ($pflicht) throw new Fehler("Bitte „{$name}“ angeben.", 422, 'pflicht', ['feld' => $name]);
        return null;
    }
    if (!is_string($w) && !is_int($w)) throw new Fehler("„{$name}“ ist ungültig.", 422, 'ungueltig', ['feld' => $name]);
    $w = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$w) ?? '');
    if (!mb_check_encoding($w, 'UTF-8')) throw new Fehler("„{$name}“ ist ungültig.", 422);
    if (mb_strlen($w) > $max) $w = mb_substr($w, 0, $max);
    return $w;
}

function antwort(mixed $daten, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    nachlauf();
    exit;
}

/** Arbeit, die nach der Antwort laufen soll (etwa die Warteliste nach
    einer Absage benachrichtigen) — die Kundin wartet nicht darauf. */
function nach_antwort(?callable $f = null): array
{
    static $liste = [];
    if ($f) $liste[] = $f;
    return $liste;
}

function nachlauf(): void
{
    $liste = nach_antwort();
    if (!$liste) return;
    // Unter PHP-FPM geht die Antwort jetzt schon raus; sonst nach dem Nachlauf.
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    ignore_user_abort(true);
    foreach ($liste as $f) {
        try { $f(); } catch (Throwable $e) { error_log('[irmonhair] Nachlauf: ' . $e->getMessage()); }
    }
}

function methode(string $m): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $m) throw new Fehler('Falsche Methode.', 405);
}

function ip(): string
{
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
}

/** Einfache Mengenbremse: höchstens $max Ereignisse je $sekunden. */
function bremse(string $art, string $schluessel, int $max, int $sekunden): void
{
    $db = db();
    $seit = date('Y-m-d H:i:s', time() - $sekunden);
    $schluessel = hash('sha256', $schluessel);
    $n = (int)$db->wert('SELECT COUNT(*) FROM {p}versuch WHERE art = ? AND schluessel = ? AND zeit > ?', [$art, $schluessel, $seit]);
    if ($n >= $max) throw new Fehler('Zu viele Versuche. Bitte in ein paar Minuten noch einmal.', 429, 'bremse');
    $db->einfuegen('versuch', ['art' => $art, 'schluessel' => $schluessel, 'zeit' => date('Y-m-d H:i:s')]);
    if (random_int(1, 50) === 1) $db->q('DELETE FROM {p}versuch WHERE zeit < ?', [date('Y-m-d H:i:s', time() - 86400)]);
}

/* ── Zeit ─────────────────────────────────────────────────────────────
   Alle Zeiten sind Ortszeit des Salons (Europe/Berlin) als
   „YYYY-MM-DD HH:MM:SS“. Innerhalb eines Tages wird in Minuten ab
   Mitternacht gerechnet. */

function jetzt(): string { return date('Y-m-d H:i:s'); }

function datum_pruefen(?string $d): string
{
    if (!$d || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) || !checkdate((int)substr($d, 5, 2), (int)substr($d, 8, 2), (int)substr($d, 0, 4))) {
        throw new Fehler('Ungültiges Datum.', 422, 'datum');
    }
    return $d;
}

function zeitpunkt_pruefen(?string $z): string
{
    if (!$z || !preg_match('/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(:00)?$/', $z, $m) || (int)$m[2] > 23 || (int)$m[3] > 59) {
        throw new Fehler('Ungültige Uhrzeit.', 422, 'zeit');
    }
    datum_pruefen($m[1]);
    // Intern rechnet alles im 5-Minuten-Raster; krumme Minuten gibt es nicht.
    if ((int)$m[3] % 5 !== 0) throw new Fehler('Ungültige Uhrzeit.', 422, 'zeit');
    return "{$m[1]} {$m[2]}:{$m[3]}:00";
}

/** Gibt es diese Ortszeit genau einmal? Nein in der Stunde, die bei der
    Umstellung auf Sommerzeit fehlt, und in der, die es im Oktober doppelt gibt. */
function zeit_eindeutig(string $lokal): bool
{
    $ts = strtotime($lokal);
    if ($ts === false || date('Y-m-d H:i:s', $ts) !== $lokal) return false;
    return date('Y-m-d H:i:s', $ts - 3600) !== $lokal && date('Y-m-d H:i:s', $ts + 3600) !== $lokal;
}

/** Liegt an diesem Tag eine Zeitumstellung? (Dann wird jede Zeit geprüft.) */
function umstellungstag(string $datum): bool
{
    return date('I', strtotime("$datum 00:30:00")) !== date('I', strtotime("$datum 23:30:00"));
}

/** Ein Zeitraum ist nur dann eindeutig, wenn Anfang und Ende es sind und
    keine Zeitumstellung dazwischen liegt — sonst stimmt die Dauer nicht. */
function zeitraum_eindeutig(string $start, string $ende): bool
{
    return zeit_eindeutig($start) && zeit_eindeutig($ende)
        && date('Z', strtotime($start)) === date('Z', strtotime($ende));
}

/** Ortszeit Europe/Berlin → UTC (für die zweite, eindeutige Speicherung). */
function utc(string $lokal): string
{
    return gmdate('Y-m-d H:i:s', strtotime($lokal));
}

/** Gesetzliche Feiertage in Bayern (München), als „YYYY-MM-DD“ => Name. */
function feiertage(int $jahr): array
{
    static $cache = [];
    if (isset($cache[$jahr])) return $cache[$jahr];
    // Ostersonntag nach Gauß (ohne die Kalender-Erweiterung von PHP).
    $a = $jahr % 19; $b = intdiv($jahr, 100); $c = $jahr % 100;
    $d = intdiv($b, 4); $e = $b % 4; $f = intdiv($b + 8, 25); $g = intdiv($b - $f + 1, 3);
    $h = (19 * $a + $b - $d - $g + 15) % 30; $i = intdiv($c, 4); $k = $c % 4;
    $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7; $m = intdiv($a + 11 * $h + 22 * $l, 451);
    $monat = intdiv($h + $l - 7 * $m + 114, 31); $tag = (($h + $l - 7 * $m + 114) % 31) + 1;
    $ostern = sprintf('%04d-%02d-%02d', $jahr, $monat, $tag);
    $f = [
        "$jahr-01-01" => 'Neujahr', "$jahr-01-06" => 'Heilige Drei Könige',
        tag_plus($ostern, -2) => 'Karfreitag', tag_plus($ostern, 1) => 'Ostermontag',
        "$jahr-05-01" => 'Tag der Arbeit', tag_plus($ostern, 39) => 'Christi Himmelfahrt',
        tag_plus($ostern, 50) => 'Pfingstmontag', tag_plus($ostern, 60) => 'Fronleichnam',
        "$jahr-08-15" => 'Mariä Himmelfahrt', "$jahr-10-03" => 'Tag der Deutschen Einheit',
        "$jahr-11-01" => 'Allerheiligen', "$jahr-12-25" => '1. Weihnachtstag', "$jahr-12-26" => '2. Weihnachtstag',
    ];
    return $cache[$jahr] = $f;
}

function feiertag(string $datum): ?string
{
    if (!einstellungen()['feiertage']) return null;
    return feiertage((int)substr($datum, 0, 4))[$datum] ?? null;
}

function tag_plus(string $datum, int $tage): string
{
    return date('Y-m-d', strtotime("$datum 12:00:00 " . ($tage >= 0 ? '+' : '') . "$tage days"));
}

function wochentag(string $datum): int { return (int)date('N', strtotime("$datum 12:00:00")); }

function min_zu_zeit(string $datum, int $min): string
{
    // Über Mitternacht hinaus (selten, aber möglich) auf den Folgetag.
    $tag = intdiv($min, 1440);
    $min %= 1440;
    if ($tag) $datum = tag_plus($datum, $tag);
    return sprintf('%s %02d:%02d:00', $datum, intdiv($min, 60), $min % 60);
}

function zeit_zu_min(string $zeit): int
{
    return (int)substr($zeit, 11, 2) * 60 + (int)substr($zeit, 14, 2);
}

function hhmm(int $min): string { return sprintf('%02d:%02d', intdiv($min, 60), $min % 60); }

/** Zeitraum-Differenz in Minuten zwischen zwei Zeitpunkten. */
function minuten_zwischen(string $a, string $b): int
{
    return (int)round((strtotime($b) - strtotime($a)) / 60);
}

function zeit_plus(string $zeit, int $min): string
{
    return date('Y-m-d H:i:s', strtotime($zeit) + $min * 60);
}

/* ── Kontaktdaten ─────────────────────────────────────────────────── */

/** Telefonnummer nach E.164 (+49…). Deutsche Nummern ohne Vorwahl-Land
    werden als +49 gelesen. Gibt null zurück, wenn es keine Nummer ist. */
function telefon_normal(?string $roh): ?string
{
    if ($roh === null) return null;
    $s = trim($roh);
    if ($s === '') return null;
    $s = preg_replace('/\(0\)/', '', $s);
    $plus = str_starts_with(ltrim($s), '+');
    $ziffern = preg_replace('/\D/', '', $s);
    if ($ziffern === '') return null;
    if ($plus) {
        $e = '+' . $ziffern;
    } elseif (str_starts_with($ziffern, '00')) {
        $e = '+' . substr($ziffern, 2);
    } elseif (str_starts_with($ziffern, '0')) {
        $e = '+49' . substr($ziffern, 1);
    } elseif (str_starts_with($ziffern, '49') && strlen($ziffern) >= 11) {
        $e = '+' . $ziffern;
    } else {
        return null; // ohne Vorwahl nicht eindeutig
    }
    if (str_starts_with($e, '+490')) $e = '+49' . substr($e, 4);
    $n = strlen($e) - 1;
    if ($n < 8 || $n > 15) return null;
    return $e;
}

/** Lesbar: +49 176 1234567 → „0176 1234567“, Ausland bleibt mit +. */
function telefon_anzeige(?string $e164): ?string
{
    if (!$e164) return null;
    if (str_starts_with($e164, '+49')) {
        $rest = substr($e164, 3);
        if (preg_match('/^(1[5-7]\d)(\d+)$/', $rest, $m)) return '0' . $m[1] . ' ' . $m[2];
        if (preg_match('/^(89)(\d+)$/', $rest, $m)) return '089 ' . $m[2];
        return '0' . $rest;
    }
    return $e164;
}

function email_normal(?string $roh): ?string
{
    if ($roh === null) return null;
    $e = mb_strtolower(trim($roh));
    if ($e === '') return null;
    if (mb_strlen($e) > 190 || !filter_var($e, FILTER_VALIDATE_EMAIL)) return null;
    return $e;
}

/** Suchtext: klein, Umlaute doppelt (ä und ae), Telefonziffern dabei. */
function suchtext(array $teile): string
{
    $t = mb_strtolower(implode(' ', array_filter($teile, fn($x) => $x !== null && $x !== '')));
    $t2 = strtr($t, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
    return trim($t . ' ' . ($t2 !== $t ? $t2 : ''));
}

function zufall(int $bytes = 16): string { return bin2hex(random_bytes($bytes)); }

/** Wer gerade handelt: die Kundin (öffentliche Seite), jemand aus dem
    Salon (angemeldet) oder das System (Cronjob). Ohne Verursacher keine
    Änderung — das Protokoll hält es zu jedem Eintrag fest. */
function akteur(): string
{
    if (!empty($GLOBALS['ANGEMELDET'])) return 'mitarbeiter';
    return $GLOBALS['AKTEUR'] ?? 'system';
}

function protokoll(string $aktion, ?int $termin = null, ?int $kunde = null, array $daten = [], ?string $person = null): void
{
    db()->einfuegen('protokoll', [
        'zeit' => jetzt(), 'person_id' => $person ?? ($GLOBALS['ANGEMELDET']['id'] ?? null),
        'akteur' => akteur(),
        'aktion' => $aktion, 'termin_id' => $termin, 'kunde_id' => $kunde,
        'daten' => $daten ? json_encode($daten, JSON_UNESCAPED_UNICODE) : null,
    ]);
}

function einstellungen(): array
{
    static $e = null;
    if ($e === null) {
        $roh = db()->wert("SELECT wert FROM {p}meta WHERE schluessel = 'einstellungen'");
        $e = array_merge(EINSTELLUNGEN_VORGABE, $roh ? (json_decode((string)$roh, true) ?: []) : []);
    }
    return $e;
}

const EINSTELLUNGEN_VORGABE = [
    'raster' => 15,            // Minuten zwischen angebotenen Startzeiten
    'vorlauf' => 60,           // frühestens so viele Minuten ab jetzt online buchbar
    'horizont' => 90,          // so viele Tage im Voraus online buchbar
    'stornofrist' => 24,       // Stunden vor Beginn, bis zu denen online storniert werden kann
    'puffer' => 0,             // Minuten Luft nach jedem Termin
    'wegzeit' => 30,           // Minuten zwischen Terminen in zwei verschiedenen Salons
    'max_offen' => 3,          // offene Online-Termine je Telefonnummer
    'luecken_fuellen' => true, // auch Startzeiten direkt nach einem Termin anbieten
    'online_aktiv' => true,
    'hinweis' => '',           // Satz über der Buchung, z. B. Urlaubshinweis
    'feiertage' => true,       // gesetzliche Feiertage (Bayern) sind geschlossen
    // Nachrichten
    'erinnerung_sms' => 'regel',   // regel | immer | nie — SMS/WhatsApp am Vortag
    'erinnerung_schwelle' => 8000, // „regel“: ab diesem Preis (Cent), nach einem
                                   // Nichterscheinen oder bei Telefonbuchung
    'recall_aktiv' => true,
    'recall_nachfass' => 7,        // Tage bis zur einzigen Nachfrage
    'warteliste_aktiv' => true,
    'ruhe_von' => 540,             // Werbung, Recall, Warteliste nur zwischen
    'ruhe_bis' => 1200,            // 9 und 20 Uhr, nicht sonntags und feiertags
    'recall_preis_cent' => 300,    // Abrechnung je zurückgeholter Kundin (0 = aus)
    'recall_deckel_cent' => 6000,  // höchstens so viel im Monat
    'sms_preis_cent' => 8,         // für die Kostenschätzung je SMS-Teil
    // Treue: jeder n-te Besuch mit Prämie
    'treue_aktiv' => false,
    'treue_n' => 10,
    'treue_praemie' => 'Der zehnte Besuch: Waschen, Schneiden, Föhnen geht aufs Haus.',
];

/** Recall-Abstand in Tagen (Spezifikation 4.3): Herren 4–5 Wochen, Damen
    6–8, Ansatz 5–6, Balayage 10–12, Keratin 3–4 Monate. Gilt als Vorgabe
    je Leistung; das Studio ändert ihn unter „Leistungen“. */
function recall_vorgabe(string $gruppe, string $name): ?int
{
    $n = mb_strtolower($name);
    if (str_contains($n, 'keratin')) return 105;
    if (str_contains($n, 'balayage')) return 77;
    if (str_contains($n, 'ansatz')) return 42;
    if (str_contains($n, 'dauerwelle')) return 84;
    return match ($gruppe) {
        'herren' => 35, 'kinder' => 42, 'schnitt' => 49, 'farbe' => 49,
        'straehnen' => 70, 'verlaengerung' => 56, 'gesicht' => 28,
        default => null,
    };
}

/** Geheimnis für signierte Links (Abmelden, Nachrichten-Einstellungen).
    Einmal zufällig erzeugt und in der Datenbank abgelegt. */
function geheimnis(): string
{
    static $g = null;
    if ($g !== null) return $g;
    $db = db();
    $g = (string)($db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'geheimnis'") ?? '');
    if ($g === '') {
        $g = zufall(32);
        try { $db->q("INSERT INTO {p}meta (schluessel, wert) VALUES ('geheimnis', ?)", [$g]); }
        catch (PDOException $e) { $g = (string)$db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'geheimnis'"); }
    }
    return $g;
}

/** „17.3fa…“: Kundennummer und Unterschrift — für den Link „Ihre Nachrichten“. */
function kunde_schluessel(int $id): string
{
    return $id . '.' . substr(hash_hmac('sha256', 'kunde-' . $id, geheimnis()), 0, 24);
}

function kunde_aus_schluessel(?string $s): ?int
{
    if (!$s || !preg_match('/^(\d{1,10})\.([a-f0-9]{24})$/', $s, $m)) return null;
    return hash_equals(kunde_schluessel((int)$m[1]), $s) ? (int)$m[1] : null;
}

/* ── Termin-Zustände ───────────────────────────────────────────────────
   gebucht → erschienen | nicht_erschienen | storniert_kunde | storniert_salon
   Nie gelöscht. Zeit belegen nur „gebucht“ und „erschienen“ (die Kundin
   sitzt schon im Stuhl); nach einer Absage oder einem Nichterscheinen ist
   die Zeit wieder frei. */
const STATUS = ['gebucht', 'erschienen', 'nicht_erschienen', 'storniert_kunde', 'storniert_salon'];
const STATUS_BELEGT = ['gebucht', 'erschienen'];
const STATUS_STORNIERT = ['storniert_kunde', 'storniert_salon'];

function storniert(string $status): bool
{
    return in_array($status, STATUS_STORNIERT, true);
}

/** Wortlaut der Einwilligungen — so steht er auf der Seite, so wird er gespeichert. */
const EINWILLIGUNGEN = [
    'terminnachrichten' => 'Erinnerung am Vortag per SMS, mit Link zum Verschieben. Abbestellen mit STOP.',
    'recall' => 'Bescheid geben, wenn mein nächster Termin fällig ist. Höchstens zwei Nachrichten, abbestellen mit STOP.',
    'angebote' => 'Gelegentlich Angebote von Irmonhair, höchstens eins im Monat. Abbestellen jederzeit mit STOP oder über den Link.',
];

/** Gilt mit dem Eintrag in die Warteliste (dort steht er neben dem Knopf). */
const EINWILLIGUNG_WARTELISTE = 'Nachricht per SMS oder E-Mail, sobald etwas frei wird. Endet von selbst am Ende des Zeitraums. Austragen mit STOP.';

/** Nur nach Bestätigung über einen Link gültig (Double-Opt-in). */
const EINWILLIGUNG_DOPPELT = ['angebote'];

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
        $k = require $datei;
    }
    if ($schluessel === null) return $k;
    return $k[$schluessel] ?? $vorgabe;
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
        $roh = file_get_contents('php://input') ?: '';
        if (strlen($roh) > 200000) throw new Fehler('Anfrage zu groß.', 413);
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
    exit;
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
    return "{$m[1]} {$m[2]}:{$m[3]}:00";
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

function protokoll(string $aktion, ?int $termin = null, ?int $kunde = null, array $daten = [], ?string $person = null): void
{
    db()->einfuegen('protokoll', [
        'zeit' => jetzt(), 'person_id' => $person ?? ($GLOBALS['ANGEMELDET']['id'] ?? null),
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
    'max_offen' => 3,          // offene Online-Termine je Telefonnummer
    'luecken_fuellen' => true, // auch Startzeiten direkt nach einem Termin anbieten
    'online_aktiv' => true,
    'hinweis' => '',           // Satz über der Buchung, z. B. Urlaubshinweis
];

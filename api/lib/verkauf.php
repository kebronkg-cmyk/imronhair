<?php
/* Gutscheine, Aktionscodes und Treue — gemeinsam für Buchungsseite und
   Studio. Bezahlt wird an der Kasse des Salons; hier steht, was gilt:
   Restwert eines Gutscheins, Nachlass eines Codes, Stand der Treuekarte. */

declare(strict_types=1);

require_once __DIR__ . '/post.php';

const CODE_ZEICHEN = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // ohne 0/O, 1/I

function code_normal(?string $c): string
{
    return preg_replace('/[^A-Z0-9-]/', '', strtoupper(trim((string)$c))) ?? '';
}

/** Gutscheincode „IH-7KQ2-M9XD“: 8 Zeichen aus 32 — rund eine Billion Möglichkeiten. */
function gutschein_code(): string
{
    $z = '';
    for ($i = 0; $i < 8; $i++) $z .= CODE_ZEICHEN[random_int(0, 31)];
    return 'IH-' . substr($z, 0, 4) . '-' . substr($z, 4);
}

function gutschein_finden(string $code): ?array
{
    $g = db()->eins('SELECT * FROM {p}gutschein WHERE code = ?', [code_normal($code)]);
    if (!$g) return null;
    if ($g['status'] === 'aktiv' && $g['gueltig_bis'] < date('Y-m-d')) $g['status'] = 'abgelaufen';
    return $g;
}

function rabatt_finden(string $code): ?array
{
    $r = db()->eins('SELECT * FROM {p}rabatt WHERE code = ?', [code_normal($code)]);
    if (!$r || !$r['aktiv']) return null;
    $heute = date('Y-m-d');
    if (($r['von'] && $r['von'] > $heute) || ($r['bis'] && $r['bis'] < $heute)) return null;
    return $r;
}

/** Nachlass eines Aktionscodes auf einen Preis. [cent|null, fehler|null] —
    ohne bekannten Preis rechnet der Salon vor Ort. */
function rabatt_anwenden(array $r, ?int $preis, ?int $kunde): array
{
    $db = db();
    if ($r['max_nutzungen'] !== null) {
        $n = (int)$db->wert("SELECT COUNT(*) FROM {p}termin WHERE rabatt_code = ? AND status NOT IN ('storniert_kunde', 'storniert_salon')", [$r['code']]);
        if ($n >= (int)$r['max_nutzungen']) return [null, 'Dieser Code ist schon aufgebraucht.'];
    }
    if ($r['nur_neu'] && $kunde && $db->wert("SELECT 1 FROM {p}termin WHERE kunde_id = ? AND status NOT IN ('storniert_kunde', 'storniert_salon')", [$kunde])) {
        return [null, 'Dieser Code gilt nur für den ersten Besuch.'];
    }
    if ($preis === null) return [null, null];
    $cent = $r['prozent'] !== null ? (int)round($preis * (int)$r['prozent'] / 100) : min($preis, (int)$r['betrag_cent']);
    return [max(0, $cent), null];
}

function rabatt_text(array $r): string
{
    return $r['prozent'] !== null ? $r['prozent'] . ' % Nachlass' : euro_text((int)$r['betrag_cent'], false) . ' Nachlass';
}

/** Treuekarte: jeder Besuch (erschienen oder vorbei und nicht abgesagt)
    ist ein Stempel; jede eingelöste Prämie verbraucht n Stempel. */
function treue_stand(int $kunde): ?array
{
    $e = einstellungen();
    if (!$e['treue_aktiv']) return null;
    $n = max(2, (int)$e['treue_n']);
    $db = db();
    $besuche = (int)$db->wert("SELECT COUNT(*) FROM {p}termin WHERE kunde_id = ? AND (status = 'erschienen' OR (status = 'gebucht' AND ende < ?))", [$kunde, jetzt()]);
    $eingeloest = (int)$db->wert('SELECT COUNT(*) FROM {p}treue WHERE kunde_id = ?', [$kunde]);
    $stempel = max(0, $besuche - $eingeloest * $n);
    return ['n' => $n, 'stempel' => min($stempel, $n), 'offen' => intdiv($stempel, $n), 'besuche' => $besuche,
        'eingeloest' => $eingeloest, 'praemie' => (string)$e['treue_praemie']];
}

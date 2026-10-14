<?php
/* Geplante Umsätze zum Abgleich mit der Kasse. Grundlage sind die Preise
   im Terminbuch (erschienen, abzüglich Nachlass) — nicht, was wirklich
   bezahlt wurde. Für die Steuer gilt allein die Kasse mit ihrer TSE;
   deshalb gibt es hier bewusst keinen Buchungsstapel für die Kanzlei
   (er stünde sonst neben den Kassendaten doppelt in der Buchhaltung). */

declare(strict_types=1);

function buchhaltung_zeitraum(): array
{
    $von = feld('von') ? datum_pruefen((string)feld('von')) : date('Y-m-01', strtotime(date('Y-m-01') . ' -1 month'));
    $bis = feld('bis') ? datum_pruefen((string)feld('bis')) : date('Y-m-t', strtotime($von));
    if ($bis < $von || $bis > tag_plus($von, 400)) throw new Fehler('Zeitraum ungültig.', 422);
    return [$von, $bis];
}

/** Erschienene Termine (und vergangene gebuchte ohne „nicht erschienen“) im Zeitraum. */
function buchhaltung_termine(string $von, string $bis): array
{
    return db()->alle("SELECT * FROM {p}termin WHERE start >= ? AND start < ? AND start < ?
        AND (status = 'erschienen' OR status = 'gebucht') AND preis_cent IS NOT NULL ORDER BY start",
        [$von . ' 00:00:00', tag_plus($bis, 1) . ' 00:00:00', jetzt()]);
}

function geld(int $cent): string { return number_format($cent / 100, 2, ',', ''); }

function buchhaltung_export(string $was): never
{
    anmeldung_pflicht(false, true);
    [$von, $bis] = buchhaltung_zeitraum();
    $db = db();
    $termine = buchhaltung_termine($von, $bis);
    $personen = array_column($db->alle('SELECT id, name FROM {p}person'), 'name', 'id');
    $posten = [];
    if ($termine) {
        $ids = array_map(fn($t) => (int)$t['id'], $termine);
        foreach ($db->alle('SELECT termin_id, name FROM {p}termin_posten WHERE termin_id IN (' . DB::liste($ids) . ') ORDER BY pos', $ids) as $p) $posten[$p['termin_id']][] = $p['name'];
    }
    protokoll('export', null, null, ['was' => $was, 'von' => $von, 'bis' => $bis]);
    header('Cache-Control: no-store');

    if ($was === 'umsatz') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="irmonhair-geplante-umsaetze-' . $von . '-bis-' . $bis . '.csv"');
        $f = fopen('php://output', 'w');
        fwrite($f, "\xEF\xBB\xBF");
        fputcsv($f, ['Datum', 'Beleg', 'Art', 'Salon', 'Person', 'Kunden-Nr', 'Leistungen', 'Brutto €', 'Nachlass €', 'Code', 'Zu zahlen €', 'Netto €', 'USt 19 % €', 'Status'], ';', '"', '');
        $summe = 0;
        foreach ($termine as $t) {
            $brutto = (int)$t['preis_cent'];
            $nachlass = (int)($t['rabatt_cent'] ?? 0);
            $zahl = max(0, $brutto - $nachlass);
            $netto = (int)round($zahl / 1.19);
            $summe += $zahl;
            fputcsv($f, [substr($t['start'], 0, 10), 'T' . $t['id'], 'Dienstleistung', $t['salon_id'], $personen[$t['person_id']] ?? $t['person_id'], $t['kunde_id'],
                implode(' + ', $posten[$t['id']] ?? []), geld($brutto), $nachlass ? geld($nachlass) : '', $t['rabatt_code'], geld($zahl), geld($netto), geld($zahl - $netto),
                $t['status'] === 'gebucht' ? 'nicht als erschienen markiert' : 'erschienen'], ';', '"', '');
        }
        // Gutscheine sind kein Umsatz beim Verkauf (Mehrzweckgutschein), aber
        // die Kanzlei muss sie sehen: ausgegeben und eingelöst.
        foreach ($db->alle("SELECT b.*, g.code FROM {p}gutschein_bewegung b JOIN {p}gutschein g ON g.id = b.gutschein_id
            WHERE b.zeit >= ? AND b.zeit < ? ORDER BY b.zeit", [$von . ' 00:00:00', tag_plus($bis, 1) . ' 00:00:00']) as $b) {
            fputcsv($f, [substr($b['zeit'], 0, 10), 'G' . $b['id'], ['ausgabe' => 'Gutschein ausgegeben', 'einloesung' => 'Gutschein eingelöst', 'storno' => 'Gutschein storniert'][$b['art']] ?? $b['art'],
                '', $personen[$b['person_id']] ?? '', '', $b['code'], geld((int)$b['betrag_cent']), '', '', '', '', '', $b['termin_id'] ? 'zu Termin T' . $b['termin_id'] : ''], ';', '"', '');
        }
        foreach ($db->alle("SELECT b.*, a.name, a.marke, a.vk_cent, a.salon_id FROM {p}lager_bewegung b JOIN {p}artikel a ON a.id = b.artikel_id
            WHERE b.art = 'verkauf' AND b.zeit >= ? AND b.zeit < ? ORDER BY b.zeit", [$von . ' 00:00:00', tag_plus($bis, 1) . ' 00:00:00']) as $b) {
            $zahl = abs((int)$b['menge']) * (int)$b['vk_cent'];
            $netto = (int)round($zahl / 1.19);
            fputcsv($f, [substr($b['zeit'], 0, 10), 'L' . $b['id'], 'Produktverkauf', $b['salon_id'], $personen[$b['person_id']] ?? '', '', abs((int)$b['menge']) . ' × ' . trim($b['marke'] . ' ' . $b['name']),
                geld($zahl), '', '', geld($zahl), geld($netto), geld($zahl - $netto), ''], ';', '"', '');
        }
        fputcsv($f, ['Summe Dienstleistungen', '', '', '', '', '', '', '', '', '', geld($summe), '', '', ''], ';', '"', '');
        fclose($f);
        exit;
    }

    throw new Fehler('Unbekannter Export.', 422);
}

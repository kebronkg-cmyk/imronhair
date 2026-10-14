<?php
/* Beispieldaten für die Vorführung (aufgerufen von demo/starten.sh).
   Legt einmalig Zugänge und ausgedachte Termine für heute und die
   nächsten Tage an — über bucheTermin(), also mit denselben Regeln wie
   jede echte Buchung. Läuft nur mit 'demo' => true in api/config.php. */

declare(strict_types=1);

require __DIR__ . '/../api/lib/basis.php';
require __DIR__ . '/../api/lib/planer.php';
require __DIR__ . '/../api/lib/termine.php';

if (konfig('demo') !== true) {
    fwrite(STDERR, "Nur für die Vorführung: 'demo' => true fehlt in api/config.php.\n");
    exit(1);
}
$db = db();
if ($db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'vorfuehrung'")) {
    nachrichten_beispiele($db);
    echo "Beispieldaten sind schon da.\n";
    exit(0);
}

mt_srand(20261014);   // jedes Mal dieselben Termine
$jetzt = jetzt();

// Zugänge: Inhaberin und Empfang als eigene Vorführ-Personen (nicht online
// buchbar, ohne Arbeitszeit), dazu ein Team-Zugang für Tina.
foreach ([['demo', 'Inhaberin (Vorführung)', 'inhaberin', 'demo', 'demo-passwort'],
          ['empfang', 'Empfang (Vorführung)', 'rezeption', 'empfang', 'empfang-passwort']] as [$id, $name, $rolle, $login, $pw]) {
    $db->einfuegen('person', ['id' => $id, 'name' => $name, 'farbe' => 8, 'rolle' => $rolle, 'anmeldename' => $login,
        'pass_hash' => password_hash($pw, PASSWORD_DEFAULT), 'aktiv' => 1, 'online' => 0, 'sort' => 90, 'geaendert' => $jetzt]);
}
$db->aendern('person', ['anmeldename' => 'tina', 'pass_hash' => password_hash('tina-passwort', PASSWORD_DEFAULT)], 'id = ?', ['tina']);

// Hinweis über der Buchung, damit niemand glaubt, er hätte wirklich gebucht.
$e = einstellungen();
$e['hinweis'] = 'Vorführung: Die Termine hier sind ausgedacht — gebucht wird nichts Echtes.';
$db->q("UPDATE {p}meta SET wert = ? WHERE schluessel = 'einstellungen'", [json_encode($e, JSON_UNESCAPED_UNICODE)]);

$vornamen = ['Anna', 'Lena', 'Sophie', 'Mia', 'Laura', 'Julia', 'Sarah', 'Nina', 'Elif', 'Marie', 'Hannah', 'Lea', 'Jonas', 'Lukas', 'Paul'];
$nachnamen = ['Beispiel', 'Muster', 'Probe', 'Testa', 'Vorlage', 'Entwurf'];
$quellen = ['online', 'online', 'online', 'telefon', 'telefon', 'kasse_vorausbuchung'];
$n = 0;

$personen = $db->alle('SELECT DISTINCT p.id, a.salon_id FROM {p}person p JOIN {p}arbeitszeit a ON a.person_id = p.id WHERE p.aktiv = 1 AND p.online = 1');
for ($tag = 0, $datum = date('Y-m-d'); $tag < 8; $tag++, $datum = tag_plus($datum, 1)) {
    foreach ($personen as $p) {
        $leistungen = $db->alle("SELECT l.* FROM {p}leistung l JOIN {p}leistung_person lp ON lp.leistung_id = l.id
            WHERE lp.person_id = ? AND l.salon_id = ? AND l.aktiv = 1 AND l.online = 1", [$p['id'], $p['salon_id']]);
        if (!$leistungen) continue;
        $anzahl = $tag === 0 ? 4 : mt_rand(1, 4);
        for ($i = 0; $i < $anzahl; $i++) {
            $l = $leistungen[mt_rand(0, count($leistungen) - 1)];
            $l['phasen'] = json_decode($l['phasen'], true);
            $phasen = phasen_verketten([$l]);
            $frei = freie_zeiten($p['salon_id'], $phasen, [$p['id']], $datum, $datum)[$datum] ?? [];
            if (!$frei) continue;
            $zeiten = array_keys($frei);
            $t = $zeiten[mt_rand(0, count($zeiten) - 1)];
            $vor = $vornamen[mt_rand(0, count($vornamen) - 1)];
            $nach = $nachnamen[mt_rand(0, count($nachnamen) - 1)];
            $kunde = kunde_zu_telefon($vor, $nach, sprintf('+49170000%04d', mt_rand(1, 60)), null);
            try {
                $r = bucheTermin([
                    'salon' => $p['salon_id'], 'leistungen' => [$l], 'start' => min_zu_zeit($datum, $t), 'person' => $p['id'],
                    'kunde_id' => $kunde, 'gast_name' => "$vor $nach", 'quelle' => $quellen[mt_rand(0, count($quellen) - 1)], 'kanal' => 'studio',
                ]);
                $n++;
                // Was heute schon vorbei ist, ist „erschienen“.
                if ($r['termin']['ende'] < date('Y-m-d H:i')) termin_aendern((int)$r['termin']['id'], ['status' => 'erschienen'], (int)$r['termin']['version']);
            } catch (Fehler $f) {
                // Platz inzwischen belegt — einfach weiter.
            }
        }
    }
}
$db->q("INSERT INTO {p}meta (schluessel, wert) VALUES ('vorfuehrung', ?)", [$jetzt]);
echo "Beispieldaten angelegt: $n Termine.\n";
nachrichten_beispiele($db);

/**
 * Zweite Stufe (auch für ältere Vorführungen): Besuche vor einigen Wochen,
 * Einwilligungen, Warteliste, Gutscheine, ein Aktionscode, Lager — und ein
 * Lauf von Recall und Warteliste, damit der Postausgang etwas zeigt.
 * SMS und E-Mail laufen in der Vorführung ins Leere ('vorfuehrung').
 */
function nachrichten_beispiele(DB $db): void
{
    if ($db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'vorfuehrung2'")) return;
    require_once __DIR__ . '/../api/lib/nachrichten.php';
    require_once __DIR__ . '/../api/lib/verkauf.php';
    mt_srand(20261015);
    $jetzt = jetzt();
    $GLOBALS['AKTEUR'] = 'system';
    $kunden = $db->alle('SELECT id FROM {p}kunde WHERE geloescht = 0 ORDER BY id');
    // Besuche vor sieben bis acht Wochen: daraus wird der Recall fällig.
    $personen = $db->alle("SELECT DISTINCT p.id, a.salon_id FROM {p}person p JOIN {p}arbeitszeit a ON a.person_id = p.id WHERE p.aktiv = 1 AND p.online = 1 AND a.salon_id = 'pasing'");
    $schnitt = $db->eins("SELECT * FROM {p}leistung WHERE salon_id = 'pasing' AND gruppe = 'schnitt' AND aktiv = 1 AND recall_tage IS NOT NULL ORDER BY sort LIMIT 1");
    $alt = 0;
    if ($schnitt && $personen) {
        $schnitt['phasen'] = json_decode($schnitt['phasen'], true);
        // Eigene Stammkundinnen ohne kommenden Termin — nur die sind fällig.
        foreach (['Petra Rückkehr', 'Sabine Wieder', 'Claudia Stamm', 'Eva Treu', 'Ines Bald', 'Karin Oft', 'Mona Gern', 'Ute Gewohnt'] as $i => $name) {
            [$vor, $nach] = name_teilen($name);
            $kid = kunde_zu_telefon($vor, $nach, sprintf('+4917100009%02d', $i), $i % 2 ? null : strtolower($vor) . '@beispiel.invalid');
            einwilligung_setzen($kid, 'recall', true, 'online');
            $datum = tag_plus(date('Y-m-d'), -(44 + $i * 2));
            $p = $personen[$i % count($personen)];
            $frei = freie_zeiten('pasing', phasen_verketten([$schnitt]), [$p['id']], $datum, $datum)[$datum] ?? [];
            if (!$frei) continue;
            try {
                $r = bucheTermin(['salon' => 'pasing', 'leistungen' => [$schnitt], 'start' => min_zu_zeit($datum, array_key_first($frei)), 'person' => $p['id'],
                    'kunde_id' => $kid, 'gast_name' => $name, 'quelle' => 'telefon', 'kanal' => 'studio']);
                termin_aendern((int)$r['termin']['id'], ['status' => 'erschienen'], (int)$r['termin']['version']);
                $alt++;
            } catch (Fehler $f) { /* belegt — weiter */ }
        }
    }
    // Einwilligungen: wie im echten Leben nicht alle.
    foreach ($kunden as $i => $k) {
        if ($i % 3 !== 2) einwilligung_setzen((int)$k['id'], 'terminnachrichten', true, 'online');
        if ($i % 2 === 0) einwilligung_setzen((int)$k['id'], 'recall', true, 'online');
        if ($i % 5 === 0) einwilligung_setzen((int)$k['id'], 'angebote', true, 'studio');
    }
    // Treuekarte an, ein Aktionscode, zwei Gutscheine, ein kleines Lager.
    $e = einstellungen();
    $e['treue_aktiv'] = true;
    $db->q("UPDATE {p}meta SET wert = ? WHERE schluessel = 'einstellungen'", [json_encode($e, JSON_UNESCAPED_UNICODE)]);
    if (!$db->wert("SELECT 1 FROM {p}rabatt WHERE code = 'HERBST10'")) {
        $db->einfuegen('rabatt', ['code' => 'HERBST10', 'name' => 'Herbst-Aktion', 'prozent' => 10, 'nur_neu' => 1, 'aktiv' => 1, 'erstellt' => $jetzt]);
    }
    foreach ([[5000, 'Lisa', 'Mama', null], [8500, 'Tom', 'Julia', 'Balayage']] as [$wert, $von, $fuer, $leistung]) {
        $id = $db->einfuegen('gutschein', ['code' => gutschein_code(), 'wert_cent' => $wert, 'rest_cent' => $wert, 'leistung' => $leistung, 'kaeufer' => $von,
            'empfaenger' => $fuer, 'gueltig_bis' => ((int)date('Y') + 3) . '-12-31', 'status' => 'aktiv', 'erstellt' => $jetzt]);
        $db->einfuegen('gutschein_bewegung', ['gutschein_id' => $id, 'art' => 'ausgabe', 'betrag_cent' => $wert, 'zeit' => $jetzt]);
    }
    foreach ([['Olaplex', 'No. 3 Hair Perfector 100 ml', 6, 3, 1650, 3200], ['Olaplex', 'No. 4 Bond Maintenance Shampoo 250 ml', 2, 3, 1500, 3000],
              ['Moroccanoil', 'Treatment Original 100 ml', 9, 4, 2100, 4290], ['Moroccanoil', 'Hydrating Mask 250 ml', 1, 2, 2400, 4890]] as [$marke, $name, $bestand, $min, $ek, $vk]) {
        $id = $db->einfuegen('artikel', ['name' => $name, 'marke' => $marke, 'salon_id' => 'pasing', 'bestand' => $bestand, 'mindest' => $min,
            'ek_cent' => $ek, 'vk_cent' => $vk, 'aktiv' => 1, 'geaendert' => $jetzt]);
        $db->einfuegen('lager_bewegung', ['artikel_id' => $id, 'menge' => $bestand, 'art' => 'inventur', 'bestand_danach' => $bestand, 'zeit' => $jetzt, 'notiz' => 'Anfangsbestand']);
    }
    // Zwei auf der Warteliste.
    $l = $db->eins("SELECT id FROM {p}leistung WHERE salon_id = 'pasing' AND online = 1 AND aktiv = 1 ORDER BY sort LIMIT 1");
    foreach (array_slice($kunden, -2) as $k) {
        try {
            warteliste_eintragen(['kunde_id' => (int)$k['id'], 'salon' => 'pasing', 'leistungen' => [$l['id']], 'person' => null,
                'von' => tag_plus(date('Y-m-d'), 1), 'bis' => tag_plus(date('Y-m-d'), 10), 'tageszeit' => 'nachmittag', 'quelle' => 'studio', 'online' => false]);
        } catch (Fehler $f) { /* schon drauf */ }
    }
    $r = recall_pruefen(true);
    warteliste_abgleich();
    warteschlange_abarbeiten(200);
    $db->q("INSERT INTO {p}meta (schluessel, wert) VALUES ('vorfuehrung2', ?)", [$jetzt]);
    echo "Nachrichten-Beispiele: $alt frühere Besuche, {$r['erste']} Recall-Nachrichten.\n";
}

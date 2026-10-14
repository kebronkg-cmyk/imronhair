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

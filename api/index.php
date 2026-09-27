<?php
/* Irmonhair Termine — Schnittstelle.
   Aufruf: api/?a=<aktion>. Antwort immer JSON (außer der Sicherung).
   Öffentlich: katalog, frei, buchen, termin, stornieren (erinnern: Cron).
   Studio: alles andere, nur angemeldet. */

declare(strict_types=1);

require __DIR__ . '/lib/basis.php';
require __DIR__ . '/lib/planer.php';
require __DIR__ . '/lib/termine.php';

const OEFFENTLICH = ['katalog', 'frei', 'buchen', 'termin', 'stornieren'];
const STUDIO = [
    'studio_status', 'einrichten', 'anmelden', 'abmelden', 'passwort',
    'stand', 'kalender', 'termin_neu', 'termin_aendern', 'termin_verlauf', 'vorschlaege',
    'abwesenheit_speichern', 'abwesenheit_loeschen',
    'kunden', 'kunde', 'kunde_speichern', 'kunden_zusammenfuehren', 'kunde_loeschen', 'kunde_auskunft',
    'team', 'person_speichern', 'leistung_speichern', 'salon_speichern', 'einstellungen_speichern',
    'auswertung', 'protokoll', 'sicherung',
];

$aktion = (string)($_GET['a'] ?? '');

try {
    // Die Buchungsseite darf auch von einer anderen Adresse kommen (etwa
    // GitHub Pages); nur die öffentlichen Aktionen, ohne Cookies.
    if (in_array($aktion, OEFFENTLICH, true)) {
        $herkunft = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
        if ($herkunft !== '' && in_array($herkunft, konfig('erlaubte_herkunft', []), true)) {
            header('Access-Control-Allow-Origin: ' . $herkunft);
            header('Vary: Origin');
            header('Access-Control-Allow-Methods: GET, POST');
            header('Access-Control-Allow-Headers: Content-Type');
            header('Access-Control-Max-Age: 86400');
        }
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
        require __DIR__ . '/lib/oeffentlich.php';
        antwort(('aktion_' . $aktion)());
    }
    if ($aktion === 'erinnern') {
        require __DIR__ . '/lib/post.php';
        antwort(aktion_erinnern());
    }
    if (in_array($aktion, STUDIO, true)) {
        header('X-Frame-Options: DENY');
        require __DIR__ . '/lib/studio.php';
        antwort(('aktion_' . $aktion)());
    }
    throw new Fehler('Unbekannte Aktion.', 404);
} catch (Fehler $e) {
    antwort(['fehler' => $e->getMessage(), 'code' => $e->code_] + $e->extra, $e->status);
} catch (Throwable $e) {
    // Technische Details ins Server-Protokoll, nie an den Browser.
    error_log('[irmonhair] ' . $aktion . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    antwort(['fehler' => 'Da ist etwas schiefgegangen. Bitte noch einmal versuchen oder anrufen.', 'code' => 'intern'], 500);
}

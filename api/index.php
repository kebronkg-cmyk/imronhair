<?php
/* Irmonhair Termine — Schnittstelle.
   Aufruf: api/?a=<aktion>. Antwort immer JSON (außer der Sicherung).
   Öffentlich: Buchung, Verwalten über den Link, Nachrichten-Einstellungen
   der Kundin, Warteliste, Codes. Cron: nachrichten (früher erinnern),
   selbstcheck; dazu der Eingang für STOP-SMS.
   Studio: alles andere, nur angemeldet. */

declare(strict_types=1);

require __DIR__ . '/lib/basis.php';
require __DIR__ . '/lib/planer.php';
require __DIR__ . '/lib/termine.php';

const OEFFENTLICH = ['katalog', 'frei', 'buchen', 'verschieben', 'anfrage', 'termin', 'stornieren', 'gesund',
    'einwilligung', 'kundin_nachrichten', 'abbestellen', 'bestaetigen', 'warteliste', 'warteliste_austragen',
    'angebot', 'angebot_annehmen', 'recall_link', 'code_pruefen'];
const CRON = ['erinnern', 'nachrichten', 'selbstcheck', 'sms_eingang'];
/* Studio, nach Datei: Nachrichten (Postausgang, Recall, Warteliste,
   Kampagnen) und Verkauf (Gutscheine, Codes, Treue, Fotos, Lager, Import). */
const STUDIO_NACHRICHTEN = ['nachrichten_stand', 'nachrichten_liste', 'nachricht_wiederholen', 'warteschlange_senden',
    'recall_liste', 'recall_starten', 'warteliste_liste', 'warteliste_speichern', 'warteliste_entfernen', 'warteliste_abgleichen',
    'kampagne_vorschau', 'kampagne_test', 'kampagne_senden', 'kampagnen', 'vorlagen', 'vorlagen_speichern',
    'einwilligung_studio', 'sperre_studio', 'bericht', 'bericht_senden'];
const STUDIO_VERKAUF = ['gutscheine', 'gutschein', 'gutschein_anlegen', 'gutschein_einloesen', 'gutschein_stornieren',
    'rabatte', 'rabatt_speichern', 'treue_einloesen', 'foto_hochladen', 'foto', 'foto_loeschen',
    'artikel', 'artikel_speichern', 'lager_buchen', 'lager_verlauf', 'import_pruefen', 'import_kunden'];
const STUDIO = [
    'studio_status', 'einrichten', 'anmelden', 'abmelden', 'passwort',
    'stand', 'kalender', 'termin_neu', 'termin_aendern', 'termin_verlauf', 'vorschlaege',
    'abwesenheit_speichern', 'abwesenheit_loeschen',
    'kunden', 'kunde', 'kunde_speichern', 'kunden_zusammenfuehren', 'kunde_loeschen', 'kunde_auskunft',
    'team', 'person_speichern', 'leistung_speichern', 'salon_speichern', 'einstellungen_speichern',
    'auswertung', 'protokoll', 'sicherung', 'export',
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
        $GLOBALS['AKTEUR'] = 'kunde';
        require __DIR__ . '/lib/oeffentlich.php';
        antwort(('aktion_' . $aktion)());
    }
    if (in_array($aktion, CRON, true)) {
        $GLOBALS['AKTEUR'] = 'system';
        require __DIR__ . '/lib/nachrichten.php';
        antwort(('aktion_' . $aktion)());
    }
    $nachrichten = in_array($aktion, STUDIO_NACHRICHTEN, true);
    $verkauf = in_array($aktion, STUDIO_VERKAUF, true);
    if ($nachrichten || $verkauf || in_array($aktion, STUDIO, true)) {
        header('X-Frame-Options: DENY');
        require __DIR__ . '/lib/studio.php';
        if ($nachrichten) require __DIR__ . '/lib/studio-nachrichten.php';
        if ($verkauf) require __DIR__ . '/lib/studio-verkauf.php';
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

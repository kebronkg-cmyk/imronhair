<?php
/* Weiche für den Vorführ-Server (php -S … demo/router.php): Adressen der
   früheren Ablage unter /fenster/ führen auf dieselbe Seite im Hauptordner
   (Links aus alten Bestätigungen, Lesezeichen). Alles andere liefert der
   Server wie gewohnt. */
$uri = $_SERVER['REQUEST_URI'] ?? '/';
if (preg_match('#^/fenster(/.*)?$#', parse_url($uri, PHP_URL_PATH) ?? '', $m)) {
    $rest = substr($uri, strlen('/fenster'));
    header('Location: ' . ($rest === '' ? '/' : $rest), true, 301);
    exit;
}
return false;

<?php
/* Weiche für den Vorführ-Server (php -S … demo/router.php): Die Adresse
   ohne Pfad führt zur aktuellen Website im Ordner fenster/, nicht zur
   älteren Fassung im Hauptordner. Alles andere liefert der Server wie gewohnt. */
$pfad = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if ($pfad === '/' || $pfad === '/index.html') {
    header('Location: /fenster/', true, 302);
    exit;
}
return false;

<?php
/* Einstellungen der Terminbuchung.
   Diese Datei als config.php kopieren und ausfüllen. config.php gehört
   nicht ins Git (steht in .gitignore) — sie enthält Passwörter. */

return [
    // ── Datenbank ─────────────────────────────────────────────────────
    // Empfohlen bei All-Inkl: MySQL (KAS → Datenbanken → Neue Datenbank).
    'db' => [
        'treiber'  => 'mysql',
        'host'     => 'localhost',
        'name'     => 'd0xxxxxx',
        'benutzer' => 'd0xxxxxx',
        'passwort' => 'HIER-DAS-DATENBANKPASSWORT',
        'praefix'  => 'ih_',
    ],
    // Ohne MySQL geht es auch mit einer Datei (SQLite). Der Ordner muss
    // für PHP beschreibbar und von außen gesperrt sein (api/daten ist es).
    // 'db' => ['treiber' => 'sqlite', 'pfad' => __DIR__ . '/daten/irmonhair.sqlite'],

    // Einmalig zum Einrichten des Studios (erste Anmeldung der Inhaberin).
    // Lang und zufällig wählen, z. B. 24 Zeichen aus einem Passwortgenerator.
    'einrichtungs_schluessel' => 'HIER-EIN-LANGER-ZUFALLSSCHLUESSEL',

    // Für den Cronjob der Erinnerungsmails: api/?a=erinnern&schluessel=…
    'cron_schluessel' => 'HIER-EIN-ZWEITER-ZUFALLSSCHLUESSEL',

    // Adresse der Buchungsseite — daraus entsteht der Link „Termin verwalten“.
    'buchung_adresse' => 'https://www.irmonhair-muenchen.de/fenster/termin.html',

    // Liegt die Buchungsseite woanders als diese Schnittstelle (z. B. auf
    // GitHub Pages), hier deren Herkunft eintragen.
    'erlaubte_herkunft' => [
        // 'https://kebronkg-cmyk.github.io',
    ],

    // ── E-Mail ───────────────────────────────────────────────────────
    // Der Absender muss als Postfach bei All-Inkl existieren.
    'post' => [
        'aktiv'         => false,
        'absender'      => 'termine@irmonhair-muenchen.de',
        'absender_name' => 'Irmonhair',
        'antwort_an'    => 'termine@irmonhair-muenchen.de',
        // Wer bei Online-Buchungen und -Absagen Bescheid bekommt (leer = niemand).
        'salon_an'      => [
            'pasing'      => '',
            'grosshadern' => '',
        ],
    ],
];

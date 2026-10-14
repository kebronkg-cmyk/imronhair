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

    // Für die Cronjobs: api/?a=nachrichten&schluessel=… (alle 15 Minuten:
    // Erinnerungen, Recall, Warteliste, Versand, Monatsbericht) und
    // api/?a=selbstcheck&schluessel=… (nachts). Das alte „erinnern“ geht weiter.
    'cron_schluessel' => 'HIER-EIN-ZWEITER-ZUFALLSSCHLUESSEL',

    // Wer einen Alarm bekommt, wenn der nächtliche Selbstcheck eine
    // Überschneidung findet (erwartet: nie). Braucht 'post' => aktiv.
    'alarm_an' => [
        // 'inhaberin@irmonhair-muenchen.de',
    ],

    // Adresse der Buchungsseite — daraus entsteht der Link „Termin verwalten“.
    'buchung_adresse' => 'https://www.irmonhair-muenchen.de/termin.html',

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
        // 'versand' => 'vorfuehrung',   // nichts hinausschicken, nur im Postausgang zeigen
        // Wer bei Online-Buchungen und -Absagen Bescheid bekommt (leer = niemand).
        'salon_an'      => [
            'pasing'      => '',
            'grosshadern' => '',
        ],
    ],

    // Wer am Monatsanfang den Monatsbericht bekommt (leer = alarm_an).
    'bericht_an' => [
        // 'inhaberin@irmonhair-muenchen.de',
    ],

    // ── SMS ──────────────────────────────────────────────────────────
    // Anbieter seven.io (Deutschland): Konto anlegen, API-Schlüssel unter
    // „Entwickler“. Damit STOP-Antworten ankommen, als Absender eine
    // eigene Nummer mit Eingang nehmen (kein Name wie „Irmonhair“) und dort
    // als Webhook für eingehende SMS eintragen:
    //   https://…/api/?a=sms_eingang&schluessel=<eingang_schluessel>
    // Zum Ausprobieren ohne Versand: 'anbieter' => 'vorfuehrung'.
    'sms' => [
        'aktiv'              => false,
        'anbieter'           => 'seven',
        'schluessel'         => 'HIER-DER-API-SCHLUESSEL',
        'absender'           => '+49151XXXXXXXX',
        'eingang_schluessel' => 'HIER-EIN-DRITTER-ZUFALLSSCHLUESSEL',
    ],

    // ── WhatsApp (Meta Cloud API, wahlweise statt SMS am Vortag) ─────
    // Braucht ein WhatsApp-Business-Konto und eine freigegebene Vorlage
    // „termin_erinnerung“ mit fünf Platzhaltern: Vorname, Zeit, Person,
    // Adresse, Link. Ist WhatsApp aktiv, geht die Erinnerung am Vortag
    // dorthin; Recall und Warteliste bleiben bei SMS/E-Mail.
    'whatsapp' => [
        'aktiv'              => false,
        'token'              => '',
        'telefon_id'         => '',
        'vorlage_erinnerung' => 'termin_erinnerung',
        'sprache'            => 'de',
    ],

    // Fotos der Kundenkartei: außerhalb des Webs (api/daten ist gesperrt).
    // 'foto_ordner' => __DIR__ . '/daten/fotos',

    // ── Mehrere Salons (Mandanten) ───────────────────────────────────
    // Für weitere Salons auf demselben Webspace: je Mandant die Adressen,
    // unter denen er erreichbar ist, ein eigenes Tabellen-Präfix (eigene,
    // getrennte Daten) und alles, was abweicht. Ohne diesen Eintrag gilt
    // alles oben für genau einen Salon.
    // 'mandanten' => [
    //     'irmonhair' => ['hosts' => ['www.irmonhair-muenchen.de'], 'db' => ['praefix' => 'ih_']],
    //     'beispiel'  => ['hosts' => ['termine.beispiel-salon.de'], 'db' => ['praefix' => 'bsp_'],
    //                     'katalog' => __DIR__ . '/katalog-beispiel.json',
    //                     'buchung_adresse' => 'https://termine.beispiel-salon.de/termin.html'],
    // ],
];

<?php
/* Tabellen anlegen und bei neuen Fassungen erweitern.
   Jede Stufe läuft genau einmal; die erreichte Stufe steht in meta.schema.
   SQL ist für MySQL 5.7+/MariaDB und SQLite 3 geschrieben; {auto},
   {text} und {tab} setzen die Unterschiede ein. */

declare(strict_types=1);

const SCHEMA_STUFEN = [
    1 => [
        "CREATE TABLE {p}meta (schluessel VARCHAR(64) NOT NULL PRIMARY KEY, wert {text}){tab}",
        "CREATE TABLE {p}zaehler (name VARCHAR(32) NOT NULL PRIMARY KEY, wert BIGINT NOT NULL DEFAULT 0){tab}",
        "CREATE TABLE {p}salon (
            id VARCHAR(32) NOT NULL PRIMARY KEY, name VARCHAR(80) NOT NULL, strasse VARCHAR(120), ort VARCHAR(120),
            telefon VARCHAR(20), telefon_text VARCHAR(40), lat DOUBLE, lon DOUBLE, planity VARCHAR(255),
            oeffnung {text}, sort INT NOT NULL DEFAULT 0, aktiv INT NOT NULL DEFAULT 1){tab}",
        "CREATE TABLE {p}person (
            id VARCHAR(32) NOT NULL PRIMARY KEY, name VARCHAR(80) NOT NULL, farbe INT NOT NULL DEFAULT 1,
            rolle VARCHAR(16) NOT NULL DEFAULT 'team', anmeldename VARCHAR(80) NULL, pass_hash VARCHAR(255) NULL,
            aktiv INT NOT NULL DEFAULT 1, online INT NOT NULL DEFAULT 1, sort INT NOT NULL DEFAULT 0,
            geaendert DATETIME NULL){tab}",
        "CREATE UNIQUE INDEX {p}person_anmeldename ON {p}person (anmeldename)",
        "CREATE TABLE {p}arbeitszeit (
            id {auto}, person_id VARCHAR(32) NOT NULL, salon_id VARCHAR(32) NOT NULL,
            wochentag INT NOT NULL, von INT NOT NULL, bis INT NOT NULL){tab}",
        "CREATE INDEX {p}arbeitszeit_person ON {p}arbeitszeit (person_id)",
        "CREATE TABLE {p}abwesenheit (
            id {auto}, person_id VARCHAR(32) NULL, salon_id VARCHAR(32) NULL,
            von DATETIME NOT NULL, bis DATETIME NOT NULL, art VARCHAR(20) NOT NULL DEFAULT 'frei',
            notiz VARCHAR(255) NULL, erstellt DATETIME NOT NULL, erstellt_von VARCHAR(32) NULL){tab}",
        "CREATE INDEX {p}abwesenheit_zeit ON {p}abwesenheit (von, bis)",
        "CREATE TABLE {p}leistung (
            id VARCHAR(16) NOT NULL PRIMARY KEY, salon_id VARCHAR(32) NOT NULL, gruppe VARCHAR(32) NOT NULL,
            familie VARCHAR(64) NOT NULL, name VARCHAR(160) NOT NULL, zusatz VARCHAR(255) NULL, laenge VARCHAR(40) NULL,
            phasen {text} NOT NULL, preis_cent INT NULL, preis_ab INT NOT NULL DEFAULT 0, preis_text VARCHAR(60) NULL,
            online INT NOT NULL DEFAULT 1, zusatzleistung INT NOT NULL DEFAULT 0, aktiv INT NOT NULL DEFAULT 1,
            sort INT NOT NULL DEFAULT 0, planity_id VARCHAR(40) NULL, geaendert DATETIME NULL){tab}",
        "CREATE INDEX {p}leistung_salon ON {p}leistung (salon_id, sort)",
        "CREATE TABLE {p}leistung_person (
            leistung_id VARCHAR(16) NOT NULL, person_id VARCHAR(32) NOT NULL,
            PRIMARY KEY (leistung_id, person_id)){tab}",
        "CREATE TABLE {p}kunde (
            id {auto}, vorname VARCHAR(80) NULL, nachname VARCHAR(80) NULL, telefon VARCHAR(20) NULL,
            email VARCHAR(190) NULL, notiz {text} NULL, suche {text} NULL,
            erstellt DATETIME NOT NULL, geaendert DATETIME NOT NULL, geloescht INT NOT NULL DEFAULT 0){tab}",
        "CREATE INDEX {p}kunde_telefon ON {p}kunde (telefon)",
        "CREATE INDEX {p}kunde_email ON {p}kunde (email)",
        "CREATE TABLE {p}termin (
            id {auto}, salon_id VARCHAR(32) NOT NULL, person_id VARCHAR(32) NOT NULL, kunde_id INT NULL,
            start DATETIME NOT NULL, ende DATETIME NOT NULL, phasen {text} NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'gebucht', quelle VARCHAR(16) NOT NULL DEFAULT 'studio',
            gast_name VARCHAR(160) NULL, notiz {text} NULL, kundennotiz {text} NULL,
            preis_cent INT NULL, preis_ab INT NOT NULL DEFAULT 0, wunsch_person INT NOT NULL DEFAULT 0,
            token CHAR(32) NOT NULL, anfrage_id VARCHAR(64) NULL, version INT NOT NULL DEFAULT 1,
            erinnert INT NOT NULL DEFAULT 0,
            erstellt DATETIME NOT NULL, erstellt_von VARCHAR(32) NULL,
            geaendert DATETIME NOT NULL, geaendert_von VARCHAR(32) NULL, storniert_am DATETIME NULL){tab}",
        "CREATE UNIQUE INDEX {p}termin_token ON {p}termin (token)",
        "CREATE UNIQUE INDEX {p}termin_anfrage ON {p}termin (anfrage_id)",
        "CREATE INDEX {p}termin_salon_start ON {p}termin (salon_id, start)",
        "CREATE INDEX {p}termin_person_start ON {p}termin (person_id, start)",
        "CREATE INDEX {p}termin_kunde ON {p}termin (kunde_id)",
        "CREATE TABLE {p}termin_posten (
            id {auto}, termin_id INT NOT NULL, leistung_id VARCHAR(16) NULL, name VARCHAR(200) NOT NULL,
            laenge VARCHAR(40) NULL, dauer INT NOT NULL, preis_cent INT NULL, preis_ab INT NOT NULL DEFAULT 0,
            pos INT NOT NULL DEFAULT 0){tab}",
        "CREATE INDEX {p}termin_posten_termin ON {p}termin_posten (termin_id)",
        // Die Zeiten, in denen eine Person wirklich arbeitet (ohne Einwirkzeit).
        "CREATE TABLE {p}belegung (
            id {auto}, termin_id INT NOT NULL, person_id VARCHAR(32) NOT NULL,
            start DATETIME NOT NULL, ende DATETIME NOT NULL){tab}",
        "CREATE INDEX {p}belegung_person ON {p}belegung (person_id, start)",
        "CREATE INDEX {p}belegung_termin ON {p}belegung (termin_id)",
        "CREATE TABLE {p}sitzung (
            token_hash CHAR(64) NOT NULL PRIMARY KEY, person_id VARCHAR(32) NOT NULL, csrf CHAR(32) NOT NULL,
            erstellt DATETIME NOT NULL, zuletzt DATETIME NOT NULL, ablauf DATETIME NOT NULL,
            ip VARCHAR(45) NULL, geraet VARCHAR(200) NULL){tab}",
        "CREATE TABLE {p}versuch (id {auto}, art VARCHAR(16) NOT NULL, schluessel CHAR(64) NOT NULL, zeit DATETIME NOT NULL){tab}",
        "CREATE INDEX {p}versuch_suche ON {p}versuch (art, schluessel, zeit)",
        "CREATE TABLE {p}protokoll (
            id {auto}, zeit DATETIME NOT NULL, person_id VARCHAR(32) NULL, aktion VARCHAR(40) NOT NULL,
            termin_id INT NULL, kunde_id INT NULL, daten {text} NULL){tab}",
        "CREATE INDEX {p}protokoll_zeit ON {p}protokoll (zeit)",
        "CREATE INDEX {p}protokoll_termin ON {p}protokoll (termin_id)",
        "INSERT INTO {p}zaehler (name, wert) VALUES ('stand', 1)",
    ],
];

function schema_aktualisieren(DB $db): void
{
    $vorhanden = true;
    try {
        $stufe = (int)$db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'schema'");
    } catch (PDOException $e) {
        $vorhanden = false;
        $stufe = 0;
    }
    $ziel = max(array_keys(SCHEMA_STUFEN));
    if ($vorhanden && $stufe >= $ziel) return;

    $ersatz = $db->treiber === 'mysql'
        ? ['{auto}' => 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY', '{text}' => 'MEDIUMTEXT',
           '{tab}' => ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci']
        : ['{auto}' => 'INTEGER PRIMARY KEY AUTOINCREMENT', '{text}' => 'TEXT', '{tab}' => ''];

    // Zwei Aufrufe gleichzeitig beim allerersten Start: nur einer legt an.
    if ($db->treiber === 'mysql') {
        if ((int)$db->wert("SELECT GET_LOCK(?, 20)", [$db->p . 'schema']) !== 1) throw new Fehler('Datenbank beschäftigt.', 503);
    } else {
        $db->pdo->exec('BEGIN IMMEDIATE');
    }
    try {
        try {
            $stufe = (int)$db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'schema'");
        } catch (PDOException $e) {
            $stufe = 0;
        }
        for ($s = $stufe + 1; $s <= $ziel; $s++) {
            foreach (SCHEMA_STUFEN[$s] as $sql) {
                $db->pdo->exec($db->sql(strtr($sql, $ersatz)));
            }
            if ($s === 1) {
                $db->q("INSERT INTO {p}meta (schluessel, wert) VALUES ('schema', ?)", [(string)$s]);
                katalog_einspielen($db);
            } else {
                $db->q("UPDATE {p}meta SET wert = ? WHERE schluessel = 'schema'", [(string)$s]);
            }
        }
        if ($db->treiber === 'sqlite') $db->pdo->exec('COMMIT');
    } catch (Throwable $e) {
        if ($db->treiber === 'sqlite') { try { $db->pdo->exec('ROLLBACK'); } catch (Throwable $_) {} }
        throw $e;
    } finally {
        if ($db->treiber === 'mysql') $db->wert("SELECT RELEASE_LOCK(?)", [$db->p . 'schema']);
    }
}

/** Erstbefüllung aus api/katalog.json (erzeugt von recherche/katalog.py).
    Danach gehören die Daten dem Studio; der Katalog wird nie wieder gelesen. */
function katalog_einspielen(DB $db): void
{
    $k = json_decode((string)file_get_contents(API_WURZEL . '/katalog.json'), true);
    if (!$k) throw new Fehler('katalog.json fehlt oder ist kaputt.', 500);
    $jetzt = jetzt();
    foreach ($k['salons'] as $s) {
        $db->einfuegen('salon', [
            'id' => $s['id'], 'name' => $s['name'], 'strasse' => $s['strasse'], 'ort' => $s['ort'],
            'telefon' => $s['telefon'], 'telefon_text' => $s['telefon_text'], 'lat' => $s['lat'], 'lon' => $s['lon'],
            'planity' => $s['planity'], 'oeffnung' => json_encode($s['oeffnung']), 'sort' => $s['sort'], 'aktiv' => 1,
        ]);
    }
    $salons = array_column($k['salons'], null, 'id');
    foreach ($k['personen'] as $i => $p) {
        $db->einfuegen('person', [
            'id' => $p['id'], 'name' => $p['name'], 'farbe' => ($i % 8) + 1, 'rolle' => 'team',
            'aktiv' => 1, 'online' => $p['online'] ? 1 : 0, 'sort' => $p['sort'], 'geaendert' => $jetzt,
        ]);
        // Vorläufig: jede Person arbeitet zu den Öffnungszeiten ihrer Salons.
        // Die echten Arbeitszeiten trägt das Studio unter „Team“ ein.
        foreach ($p['salons'] as $sid) {
            foreach ($salons[$sid]['oeffnung'] as $tag => $spannen) {
                foreach ($spannen as [$von, $bis]) {
                    $db->einfuegen('arbeitszeit', ['person_id' => $p['id'], 'salon_id' => $sid,
                        'wochentag' => (int)$tag, 'von' => $von, 'bis' => $bis]);
                }
            }
        }
    }
    foreach ($k['leistungen'] as $i => $l) {
        $db->einfuegen('leistung', [
            'id' => $l['id'], 'salon_id' => $l['salon'], 'gruppe' => $l['gruppe'], 'familie' => $l['familie'],
            'name' => $l['name'], 'zusatz' => $l['zusatz'], 'laenge' => $l['laenge'],
            'phasen' => json_encode($l['phasen']), 'preis_cent' => $l['preis_cent'], 'preis_ab' => $l['preis_ab'] ? 1 : 0,
            'preis_text' => $l['preis_text'], 'online' => $l['online'] ? 1 : 0,
            'zusatzleistung' => $l['zusatzleistung'] ? 1 : 0, 'aktiv' => 1, 'sort' => $i + 1,
            'planity_id' => $l['planity_id'], 'geaendert' => $jetzt,
        ]);
        foreach ($l['personen'] as $pid) {
            $db->einfuegen('leistung_person', ['leistung_id' => $l['id'], 'person_id' => $pid]);
        }
    }
    $db->q("INSERT INTO {p}meta (schluessel, wert) VALUES ('gruppen', ?)", [json_encode($k['gruppen'], JSON_UNESCAPED_UNICODE)]);
    $db->q("INSERT INTO {p}meta (schluessel, wert) VALUES ('einstellungen', ?)", [json_encode(EINSTELLUNGEN_VORGABE)]);
}

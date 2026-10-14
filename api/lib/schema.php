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
    // Abgleich mit der Spezifikation: Absage mit Verursacher und Grund,
    // Zeiten zusätzlich in UTC, Herkunft der Buchung, Verursacher im
    // Protokoll, Einwilligungen mit Wortlaut.
    2 => [
        "ALTER TABLE {p}termin ADD COLUMN storno_grund VARCHAR(255) NULL",
        "ALTER TABLE {p}termin ADD COLUMN start_utc DATETIME NULL",
        "ALTER TABLE {p}termin ADD COLUMN ende_utc DATETIME NULL",
        "ALTER TABLE {p}termin ADD COLUMN ref VARCHAR(40) NULL",
        "ALTER TABLE {p}protokoll ADD COLUMN akteur VARCHAR(16) NULL",
        "UPDATE {p}termin SET status = 'storniert_kunde' WHERE status = 'storniert' AND id IN
            (SELECT termin_id FROM {p}protokoll WHERE aktion IN ('online_storniert', 'online_umgebucht') AND termin_id IS NOT NULL)",
        "UPDATE {p}termin SET status = 'storniert_salon' WHERE status = 'storniert'",
        "DELETE FROM {p}belegung WHERE termin_id IN (SELECT id FROM {p}termin WHERE status NOT IN ('gebucht', 'erschienen'))",
        "CREATE TABLE {p}einwilligung (
            id {auto}, kunde_id INT NOT NULL, art VARCHAR(24) NOT NULL, erteilt INT NOT NULL,
            zeit DATETIME NOT NULL, quelle VARCHAR(16) NOT NULL, wortlaut {text} NOT NULL, termin_id INT NULL){tab}",
        "CREATE INDEX {p}einwilligung_kunde ON {p}einwilligung (kunde_id, art, id)",
        "CREATE INDEX {p}termin_start_utc ON {p}termin (start_utc)",
    ],
    // Nachrichten (SMS, WhatsApp, E-Mail) mit Warteschlange und STOP,
    // Recall, Warteliste, Kampagnen, Gutscheine, Aktionscodes, Treue,
    // Fotos in der Kartei, Lager, Import.
    3 => [
        "CREATE TABLE {p}nachricht (
            id {auto}, kunde_id INT NULL, termin_id INT NULL, kanal VARCHAR(10) NOT NULL, zweck VARCHAR(24) NOT NULL,
            an VARCHAR(190) NOT NULL, betreff VARCHAR(255) NULL, text {text} NOT NULL, status VARCHAR(14) NOT NULL DEFAULT 'wartet',
            versuche INT NOT NULL DEFAULT 0, nicht_vor DATETIME NOT NULL, anbieter_id VARCHAR(80) NULL, teile INT NOT NULL DEFAULT 1,
            kosten_cent INT NULL, fehler VARCHAR(255) NULL, bezug VARCHAR(40) NULL, schluessel VARCHAR(120) NULL,
            erstellt DATETIME NOT NULL, gesendet DATETIME NULL){tab}",
        "CREATE UNIQUE INDEX {p}nachricht_schluessel ON {p}nachricht (schluessel)",
        "CREATE INDEX {p}nachricht_status ON {p}nachricht (status, nicht_vor)",
        "CREATE INDEX {p}nachricht_kunde ON {p}nachricht (kunde_id, id)",
        "CREATE INDEX {p}nachricht_erstellt ON {p}nachricht (erstellt)",
        "CREATE TABLE {p}sperre (
            id {auto}, kanal VARCHAR(10) NOT NULL, adresse VARCHAR(190) NOT NULL, zeit DATETIME NOT NULL, quelle VARCHAR(16) NOT NULL){tab}",
        "CREATE UNIQUE INDEX {p}sperre_adresse ON {p}sperre (kanal, adresse)",
        "CREATE TABLE {p}bestaetigung (
            id {auto}, kunde_id INT NOT NULL, art VARCHAR(24) NOT NULL, token CHAR(32) NOT NULL, quelle VARCHAR(16) NOT NULL,
            erstellt DATETIME NOT NULL, bestaetigt DATETIME NULL){tab}",
        "CREATE UNIQUE INDEX {p}bestaetigung_token ON {p}bestaetigung (token)",
        "CREATE TABLE {p}recall (
            id {auto}, kunde_id INT NOT NULL, letzter_termin_id INT NOT NULL, faellig DATE NOT NULL, token CHAR(16) NOT NULL,
            erste DATETIME NULL, zweite DATETIME NULL, kanal VARCHAR(10) NULL, termin_id INT NULL, status VARCHAR(14) NOT NULL DEFAULT 'offen',
            erstellt DATETIME NOT NULL){tab}",
        "CREATE UNIQUE INDEX {p}recall_letzter ON {p}recall (kunde_id, letzter_termin_id)",
        "CREATE UNIQUE INDEX {p}recall_token ON {p}recall (token)",
        "CREATE TABLE {p}warteliste (
            id {auto}, kunde_id INT NOT NULL, salon_id VARCHAR(32) NOT NULL, leistungen {text} NOT NULL, person_id VARCHAR(32) NULL,
            von DATE NOT NULL, bis DATE NOT NULL, tageszeit VARCHAR(12) NOT NULL DEFAULT 'egal', status VARCHAR(14) NOT NULL DEFAULT 'aktiv',
            token CHAR(32) NOT NULL, quelle VARCHAR(16) NOT NULL, notiz VARCHAR(255) NULL, letztes_angebot DATETIME NULL,
            termin_id INT NULL, erstellt DATETIME NOT NULL){tab}",
        "CREATE UNIQUE INDEX {p}warteliste_token ON {p}warteliste (token)",
        "CREATE INDEX {p}warteliste_salon ON {p}warteliste (salon_id, status, bis)",
        "CREATE TABLE {p}angebot (
            id {auto}, warteliste_id INT NOT NULL, salon_id VARCHAR(32) NOT NULL, person_id VARCHAR(32) NULL, start DATETIME NOT NULL,
            token CHAR(24) NOT NULL, status VARCHAR(14) NOT NULL DEFAULT 'offen', termin_id INT NULL,
            erstellt DATETIME NOT NULL, ablauf DATETIME NOT NULL){tab}",
        "CREATE UNIQUE INDEX {p}angebot_token ON {p}angebot (token)",
        "CREATE INDEX {p}angebot_liste ON {p}angebot (warteliste_id)",
        "CREATE TABLE {p}kampagne (
            id {auto}, titel VARCHAR(120) NOT NULL, kanal VARCHAR(10) NOT NULL, betreff VARCHAR(255) NULL, text {text} NOT NULL,
            zielgruppe {text} NULL, anzahl INT NOT NULL DEFAULT 0, erstellt DATETIME NOT NULL, erstellt_von VARCHAR(32) NULL){tab}",
        "CREATE TABLE {p}gutschein (
            id {auto}, code VARCHAR(20) NOT NULL, wert_cent INT NOT NULL, rest_cent INT NOT NULL, leistung VARCHAR(160) NULL,
            kaeufer VARCHAR(160) NULL, empfaenger VARCHAR(160) NULL, kunde_id INT NULL, gueltig_bis DATE NOT NULL,
            status VARCHAR(14) NOT NULL DEFAULT 'aktiv', notiz VARCHAR(255) NULL, erstellt DATETIME NOT NULL, erstellt_von VARCHAR(32) NULL){tab}",
        "CREATE UNIQUE INDEX {p}gutschein_code ON {p}gutschein (code)",
        "CREATE TABLE {p}gutschein_bewegung (
            id {auto}, gutschein_id INT NOT NULL, art VARCHAR(14) NOT NULL, betrag_cent INT NOT NULL, termin_id INT NULL,
            zeit DATETIME NOT NULL, person_id VARCHAR(32) NULL, notiz VARCHAR(255) NULL){tab}",
        "CREATE INDEX {p}gutschein_bewegung_g ON {p}gutschein_bewegung (gutschein_id)",
        "CREATE TABLE {p}rabatt (
            id {auto}, code VARCHAR(24) NOT NULL, name VARCHAR(120) NOT NULL, prozent INT NULL, betrag_cent INT NULL,
            von DATE NULL, bis DATE NULL, max_nutzungen INT NULL, nur_neu INT NOT NULL DEFAULT 0, aktiv INT NOT NULL DEFAULT 1,
            erstellt DATETIME NOT NULL){tab}",
        "CREATE UNIQUE INDEX {p}rabatt_code ON {p}rabatt (code)",
        "CREATE TABLE {p}treue (
            id {auto}, kunde_id INT NOT NULL, termin_id INT NULL, zeit DATETIME NOT NULL, person_id VARCHAR(32) NULL, notiz VARCHAR(255) NULL){tab}",
        "CREATE INDEX {p}treue_kunde ON {p}treue (kunde_id)",
        "CREATE TABLE {p}foto (
            id {auto}, kunde_id INT NOT NULL, termin_id INT NULL, datei VARCHAR(80) NOT NULL, breite INT NOT NULL, hoehe INT NOT NULL,
            bytes INT NOT NULL, notiz VARCHAR(255) NULL, erstellt DATETIME NOT NULL, person_id VARCHAR(32) NULL){tab}",
        "CREATE INDEX {p}foto_kunde ON {p}foto (kunde_id)",
        "CREATE TABLE {p}artikel (
            id {auto}, name VARCHAR(160) NOT NULL, marke VARCHAR(80) NULL, ean VARCHAR(20) NULL, salon_id VARCHAR(32) NOT NULL,
            bestand INT NOT NULL DEFAULT 0, mindest INT NOT NULL DEFAULT 0, ek_cent INT NULL, vk_cent INT NULL,
            aktiv INT NOT NULL DEFAULT 1, geaendert DATETIME NOT NULL){tab}",
        "CREATE INDEX {p}artikel_salon ON {p}artikel (salon_id, aktiv)",
        "CREATE TABLE {p}lager_bewegung (
            id {auto}, artikel_id INT NOT NULL, menge INT NOT NULL, art VARCHAR(14) NOT NULL, bestand_danach INT NOT NULL,
            zeit DATETIME NOT NULL, person_id VARCHAR(32) NULL, notiz VARCHAR(255) NULL){tab}",
        "CREATE INDEX {p}lager_bewegung_a ON {p}lager_bewegung (artikel_id, id)",
        "ALTER TABLE {p}termin ADD COLUMN rabatt_code VARCHAR(24) NULL",
        "ALTER TABLE {p}termin ADD COLUMN rabatt_cent INT NULL",
        "ALTER TABLE {p}termin ADD COLUMN erinnert_sms INT NOT NULL DEFAULT 0",
        "ALTER TABLE {p}leistung ADD COLUMN recall_tage INT NULL",
        "ALTER TABLE {p}kunde ADD COLUMN herkunft VARCHAR(24) NULL",
        "CREATE INDEX {p}termin_ref ON {p}termin (ref)",
    ],
];

/** Was sich nicht in SQL sagen lässt, nach der jeweiligen Stufe. */
function schema_nacharbeit(DB $db, int $stufe): void
{
    if ($stufe === 2) {
        foreach ($db->alle('SELECT id, start, ende FROM {p}termin') as $t) {
            $db->q('UPDATE {p}termin SET start_utc = ?, ende_utc = ? WHERE id = ?', [utc($t['start']), utc($t['ende']), $t['id']]);
        }
    }
    if ($stufe === 3) {
        // Recall-Abstand je Leistung vorbelegen (Spezifikation 4.3); das
        // Studio kann ihn je Leistung ändern.
        foreach ($db->alle('SELECT id, gruppe, name FROM {p}leistung') as $l) {
            $db->q('UPDATE {p}leistung SET recall_tage = ? WHERE id = ?', [recall_vorgabe($l['gruppe'], $l['name']), $l['id']]);
        }
    }
}

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
                schema_nacharbeit($db, $s);
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
    // Jeder Mandant kann seinen eigenen Erstkatalog haben.
    $k = json_decode((string)file_get_contents(konfig('katalog', API_WURZEL . '/katalog.json')), true);
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

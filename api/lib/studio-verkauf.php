<?php
/* Studio: Gutscheine, Aktionscodes, Treue, Fotos in der Kartei, Lager und
   der Import der Kundenliste aus Planity (oder einem anderen System).
   Kassiert wird weiter an der Kasse des Salons — hier steht, was gilt. */

declare(strict_types=1);

require_once __DIR__ . '/verkauf.php';

/* ── Gutscheine ──────────────────────────────────────────────────────── */

function gutschein_aufbereiten(array $g, bool $mitVerlauf = false): array
{
    $aus = ['id' => (int)$g['id'], 'code' => $g['code'], 'wert_cent' => (int)$g['wert_cent'], 'rest_cent' => (int)$g['rest_cent'],
        'leistung' => $g['leistung'], 'kaeufer' => $g['kaeufer'], 'empfaenger' => $g['empfaenger'], 'kunde_id' => $g['kunde_id'] ? (int)$g['kunde_id'] : null,
        'gueltig_bis' => $g['gueltig_bis'], 'status' => $g['status'] === 'aktiv' && $g['gueltig_bis'] < date('Y-m-d') ? 'abgelaufen' : $g['status'],
        'notiz' => $g['notiz'], 'erstellt' => substr($g['erstellt'], 0, 16)];
    if ($mitVerlauf) {
        $aus['verlauf'] = array_map(fn($b) => ['art' => $b['art'], 'betrag_cent' => (int)$b['betrag_cent'], 'zeit' => substr($b['zeit'], 0, 16),
            'wer' => $b['name'], 'notiz' => $b['notiz'], 'termin_id' => $b['termin_id'] ? (int)$b['termin_id'] : null],
            db()->alle('SELECT b.*, p.name FROM {p}gutschein_bewegung b LEFT JOIN {p}person p ON p.id = b.person_id WHERE b.gutschein_id = ? ORDER BY b.id', [$g['id']]));
    }
    return $aus;
}

function aktion_gutscheine(): array
{
    anmeldung_pflicht(false);
    $q = code_normal(text_feld('q', 40));
    $roh = trim((string)text_feld('q', 40));
    $sql = 'SELECT * FROM {p}gutschein';
    $w = [];
    if ($roh !== '') { $sql .= ' WHERE code LIKE ? OR kaeufer LIKE ? OR empfaenger LIKE ?'; $w = ['%' . $q . '%', '%' . $roh . '%', '%' . $roh . '%']; }
    $zeilen = db()->alle($sql . ' ORDER BY id DESC LIMIT 100', $w);
    $db = db();
    return ['gutscheine' => array_map('gutschein_aufbereiten', $zeilen),
        'offen_cent' => (int)$db->wert("SELECT COALESCE(SUM(rest_cent), 0) FROM {p}gutschein WHERE status = 'aktiv' AND gueltig_bis >= ?", [date('Y-m-d')])];
}

/** Gutschein ausgeben. Gültig nach § 195 BGB drei Jahre, gerechnet ab dem
    Ende des Ausgabejahres — das ist die Vorgabe, kürzer geht nicht ohne Weiteres. */
function aktion_gutschein_anlegen(): array
{
    anmeldung_pflicht(true);
    $wert = feld('wert_cent');
    if (!is_int($wert) || $wert < 100 || $wert > 100000) throw new Fehler('Bitte einen Wert zwischen 1 und 1.000 € angeben.', 422, 'wert', ['feld' => 'wert']);
    $bis = feld('gueltig_bis') ? datum_pruefen((string)feld('gueltig_bis')) : ((int)date('Y') + 3) . '-12-31';
    if ($bis < date('Y-m-d')) throw new Fehler('Das Datum liegt in der Vergangenheit.', 422, 'gueltig_bis', ['feld' => 'gueltig_bis']);
    $g = db()->schreiben(function (DB $db) use ($wert, $bis) {
        for ($i = 0; $i < 5; $i++) {
            $code = gutschein_code();
            if (!$db->wert('SELECT 1 FROM {p}gutschein WHERE code = ?', [$code])) break;
        }
        $id = $db->einfuegen('gutschein', ['code' => $code, 'wert_cent' => $wert, 'rest_cent' => $wert, 'leistung' => text_feld('leistung', 160),
            'kaeufer' => text_feld('kaeufer', 160), 'empfaenger' => text_feld('empfaenger', 160), 'kunde_id' => feld('kunde_id') ? (int)feld('kunde_id') : null,
            'gueltig_bis' => $bis, 'status' => 'aktiv', 'notiz' => text_feld('notiz', 255), 'erstellt' => jetzt(), 'erstellt_von' => $GLOBALS['ANGEMELDET']['id']]);
        $db->einfuegen('gutschein_bewegung', ['gutschein_id' => $id, 'art' => 'ausgabe', 'betrag_cent' => $wert, 'zeit' => jetzt(), 'person_id' => $GLOBALS['ANGEMELDET']['id']]);
        protokoll('gutschein_ausgegeben', null, null, ['code' => $code, 'wert_cent' => $wert]);
        return $db->eins('SELECT * FROM {p}gutschein WHERE id = ?', [$id]);
    });
    return gutschein_aufbereiten($g, true);
}

function aktion_gutschein(): array
{
    anmeldung_pflicht(false);
    bremse('gutschein', (string)$GLOBALS['ANGEMELDET']['id'], 120, 600);
    $g = gutschein_finden((string)text_feld('code', 24, true));
    if (!$g) throw new Fehler('Diesen Gutschein gibt es nicht.', 404, 'unbekannt');
    return gutschein_aufbereiten($g, true);
}

/** Einlösen: ganz oder teilweise. In einer Transaktion, damit derselbe
    Restwert nie zweimal ausgegeben wird. */
function aktion_gutschein_einloesen(): array
{
    anmeldung_pflicht(true);
    $code = code_normal(text_feld('code', 24, true));
    $betrag = feld('betrag_cent');
    if (!is_int($betrag) || $betrag <= 0) throw new Fehler('Bitte einen Betrag angeben.', 422, 'betrag', ['feld' => 'betrag']);
    $g = db()->schreiben(function (DB $db) use ($code, $betrag) {
        if ($db->treiber === 'mysql') $db->q('SELECT id FROM {p}gutschein WHERE code = ? FOR UPDATE', [$code]);
        $g = $db->eins('SELECT * FROM {p}gutschein WHERE code = ?', [$code]);
        if (!$g) throw new Fehler('Diesen Gutschein gibt es nicht.', 404, 'unbekannt');
        if ($g['status'] !== 'aktiv') throw new Fehler('Dieser Gutschein ist ' . ($g['status'] === 'eingeloest' ? 'schon ganz eingelöst.' : 'nicht mehr gültig.'), 409, 'status');
        if ($g['gueltig_bis'] < date('Y-m-d')) throw new Fehler('Dieser Gutschein ist seit ' . date('d.m.Y', strtotime($g['gueltig_bis'])) . ' abgelaufen.', 409, 'abgelaufen');
        if ($betrag > (int)$g['rest_cent']) throw new Fehler('Auf dem Gutschein sind nur noch ' . euro_text((int)$g['rest_cent'], false) . '.', 409, 'zu_viel');
        $rest = (int)$g['rest_cent'] - $betrag;
        $db->aendern('gutschein', ['rest_cent' => $rest, 'status' => $rest === 0 ? 'eingeloest' : 'aktiv'], 'id = ?', [$g['id']]);
        $db->einfuegen('gutschein_bewegung', ['gutschein_id' => $g['id'], 'art' => 'einloesung', 'betrag_cent' => $betrag,
            'termin_id' => feld('termin_id') ? (int)feld('termin_id') : null, 'zeit' => jetzt(), 'person_id' => $GLOBALS['ANGEMELDET']['id'], 'notiz' => text_feld('notiz', 255)]);
        protokoll('gutschein_eingeloest', feld('termin_id') ? (int)feld('termin_id') : null, null, ['code' => $code, 'betrag_cent' => $betrag, 'rest_cent' => $rest]);
        return $db->eins('SELECT * FROM {p}gutschein WHERE id = ?', [$g['id']]);
    });
    return gutschein_aufbereiten($g, true);
}

function aktion_gutschein_stornieren(): array
{
    anmeldung_pflicht(true, true);
    $code = code_normal(text_feld('code', 24, true));
    $grund = text_feld('grund', 255, true);
    $g = db()->schreiben(function (DB $db) use ($code, $grund) {
        $g = $db->eins('SELECT * FROM {p}gutschein WHERE code = ?', [$code]);
        if (!$g) throw new Fehler('Diesen Gutschein gibt es nicht.', 404);
        if ($g['status'] === 'storniert') return $g;
        $db->aendern('gutschein', ['status' => 'storniert', 'rest_cent' => 0], 'id = ?', [$g['id']]);
        $db->einfuegen('gutschein_bewegung', ['gutschein_id' => $g['id'], 'art' => 'storno', 'betrag_cent' => (int)$g['rest_cent'], 'zeit' => jetzt(),
            'person_id' => $GLOBALS['ANGEMELDET']['id'], 'notiz' => $grund]);
        protokoll('gutschein_storniert', null, null, ['code' => $code, 'grund' => $grund]);
        return $db->eins('SELECT * FROM {p}gutschein WHERE id = ?', [$g['id']]);
    });
    return gutschein_aufbereiten($g, true);
}

/* ── Aktionscodes ────────────────────────────────────────────────────── */

function aktion_rabatte(): array
{
    anmeldung_pflicht(false, true);
    $db = db();
    return ['rabatte' => array_map(fn($r) => ['id' => (int)$r['id'], 'code' => $r['code'], 'name' => $r['name'],
        'prozent' => $r['prozent'] === null ? null : (int)$r['prozent'], 'betrag_cent' => $r['betrag_cent'] === null ? null : (int)$r['betrag_cent'],
        'von' => $r['von'], 'bis' => $r['bis'], 'max_nutzungen' => $r['max_nutzungen'] === null ? null : (int)$r['max_nutzungen'],
        'nur_neu' => (bool)$r['nur_neu'], 'aktiv' => (bool)$r['aktiv'],
        'genutzt' => (int)$db->wert("SELECT COUNT(*) FROM {p}termin WHERE rabatt_code = ? AND status NOT IN ('storniert_kunde', 'storniert_salon')", [$r['code']])],
        $db->alle('SELECT * FROM {p}rabatt ORDER BY aktiv DESC, id DESC'))];
}

function aktion_rabatt_speichern(): array
{
    anmeldung_pflicht(true, true);
    $id = feld('id') ? (int)feld('id') : null;
    $code = code_normal(text_feld('code', 24, true));
    if (strlen($code) < 4) throw new Fehler('Der Code braucht mindestens vier Zeichen (Buchstaben und Ziffern).', 422, 'code', ['feld' => 'code']);
    $prozent = feld('prozent');
    $betrag = feld('betrag_cent');
    if (($prozent === null) === ($betrag === null)) throw new Fehler('Entweder Prozent oder einen Betrag angeben.', 422, 'prozent', ['feld' => 'prozent']);
    if ($prozent !== null && (!is_int($prozent) || $prozent < 1 || $prozent > 100)) throw new Fehler('Prozent zwischen 1 und 100.', 422, 'prozent', ['feld' => 'prozent']);
    if ($betrag !== null && (!is_int($betrag) || $betrag < 100)) throw new Fehler('Betrag mindestens 1 €.', 422, 'betrag', ['feld' => 'betrag']);
    $zeile = ['code' => $code, 'name' => text_feld('name', 120) ?? $code, 'prozent' => $prozent, 'betrag_cent' => $betrag,
        'von' => feld('von') ? datum_pruefen((string)feld('von')) : null, 'bis' => feld('bis') ? datum_pruefen((string)feld('bis')) : null,
        'max_nutzungen' => is_int(feld('max_nutzungen')) && feld('max_nutzungen') > 0 ? feld('max_nutzungen') : null,
        'nur_neu' => feld('nur_neu') === true ? 1 : 0, 'aktiv' => feld('aktiv') === false ? 0 : 1];
    db()->schreiben(function (DB $db) use ($id, $zeile) {
        $belegt = $db->wert('SELECT id FROM {p}rabatt WHERE code = ?' . ($id ? ' AND id <> ?' : ''), $id ? [$zeile['code'], $id] : [$zeile['code']]);
        if ($belegt || $db->wert('SELECT 1 FROM {p}gutschein WHERE code = ?', [$zeile['code']])) throw new Fehler('Diesen Code gibt es schon.', 409, 'doppelt', ['feld' => 'code']);
        if ($id) $db->aendern('rabatt', $zeile, 'id = ?', [$id]);
        else $db->einfuegen('rabatt', $zeile + ['erstellt' => jetzt()]);
        protokoll('rabatt_gespeichert', null, null, $zeile);
    });
    return aktion_rabatte();
}

/* ── Treue ───────────────────────────────────────────────────────────── */

function aktion_treue_einloesen(): array
{
    anmeldung_pflicht(true);
    $kunde = (int)feld('kunde_id');
    kunde_lesen($kunde);
    return db()->schreiben(function (DB $db) use ($kunde) {
        $s = treue_stand($kunde);
        if (!$s) throw new Fehler('Die Treuekarte ist ausgeschaltet (Einstellungen).', 409);
        if ($s['offen'] < 1) throw new Fehler('Noch ' . ($s['n'] - $s['stempel']) . ' Besuche bis zur Prämie.', 409);
        $db->einfuegen('treue', ['kunde_id' => $kunde, 'termin_id' => feld('termin_id') ? (int)feld('termin_id') : null, 'zeit' => jetzt(),
            'person_id' => $GLOBALS['ANGEMELDET']['id'], 'notiz' => text_feld('notiz', 255)]);
        protokoll('treue_eingeloest', null, $kunde, ['praemie' => $s['praemie']]);
        return treue_stand($kunde);
    });
}

/* ── Fotos in der Kartei ─────────────────────────────────────────────── */

function foto_ordner(): string
{
    $o = rtrim((string)konfig('foto_ordner', API_WURZEL . '/daten/fotos'), '/') . '/' . preg_replace('/[^a-z0-9_]/i', '', db()->p);
    if (!is_dir($o)) mkdir($o, 0770, true);
    return $o;
}

/** Hochladen. Das Bild ist im Browser schon verkleinert (lange Seite
    höchstens 1600 px) und als JPEG neu kodiert — damit sind auch die
    Ortsdaten der Kamera weg. Hier wird nur noch geprüft. */
function aktion_foto_hochladen(): array
{
    anmeldung_pflicht(true);
    $kunde = (int)feld('kunde_id');
    kunde_lesen($kunde);
    if (feld('einverstanden') !== true) throw new Fehler('Bitte bestätigen, dass die Kundin mit dem Foto einverstanden ist.', 422, 'einverstanden', ['feld' => 'einverstanden']);
    $roh = (string)feld('bild', '');
    if (!preg_match('#^data:image/(jpeg|png|webp);base64,(.+)$#s', $roh, $m)) throw new Fehler('Kein Bild.', 422, 'bild');
    $daten = base64_decode($m[2], true);
    if ($daten === false || strlen($daten) > 4000000) throw new Fehler('Das Bild ist zu groß (höchstens 4 MB).', 413, 'bild');
    $info = @getimagesizefromstring($daten);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) throw new Fehler('Das ist kein lesbares Bild.', 422, 'bild');
    $endung = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]];
    $datei = zufall(16) . '.' . $endung;
    if (file_put_contents(foto_ordner() . '/' . $datei, $daten, LOCK_EX) === false) throw new Fehler('Das Foto konnte nicht gespeichert werden.', 500);
    $id = db()->schreiben(function (DB $db) use ($kunde, $datei, $info, $daten) {
        $id = $db->einfuegen('foto', ['kunde_id' => $kunde, 'termin_id' => feld('termin_id') ? (int)feld('termin_id') : null, 'datei' => $datei,
            'breite' => (int)$info[0], 'hoehe' => (int)$info[1], 'bytes' => strlen($daten), 'notiz' => text_feld('notiz', 255),
            'erstellt' => jetzt(), 'person_id' => $GLOBALS['ANGEMELDET']['id']]);
        protokoll('foto', null, $kunde, ['id' => $id]);
        return $id;
    });
    return ['id' => $id, 'fotos' => fotos_lesen($kunde)];
}

function fotos_lesen(int $kunde): array
{
    return array_map(fn($f) => ['id' => (int)$f['id'], 'erstellt' => substr($f['erstellt'], 0, 10), 'notiz' => $f['notiz'],
        'breite' => (int)$f['breite'], 'hoehe' => (int)$f['hoehe'], 'termin_id' => $f['termin_id'] ? (int)$f['termin_id'] : null],
        db()->alle('SELECT * FROM {p}foto WHERE kunde_id = ? ORDER BY id DESC', [$kunde]));
}

/** Das Foto selbst — nur angemeldet, nie öffentlich erreichbar. */
function aktion_foto(): never
{
    anmeldung_pflicht(false);
    $f = db()->eins('SELECT * FROM {p}foto WHERE id = ?', [(int)feld('id')]);
    $pfad = $f ? foto_ordner() . '/' . basename($f['datei']) : '';
    if (!$f || !is_file($pfad)) throw new Fehler('Foto nicht gefunden.', 404);
    $typ = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][pathinfo($pfad, PATHINFO_EXTENSION)] ?? 'application/octet-stream';
    header('Content-Type: ' . $typ);
    header('Content-Length: ' . filesize($pfad));
    header('Cache-Control: private, max-age=86400');
    header('X-Content-Type-Options: nosniff');
    readfile($pfad);
    exit;
}

function aktion_foto_loeschen(): array
{
    anmeldung_pflicht(true);
    $f = db()->eins('SELECT * FROM {p}foto WHERE id = ?', [(int)feld('id')]);
    if (!$f) throw new Fehler('Foto nicht gefunden.', 404);
    db()->schreiben(function (DB $db) use ($f) {
        $db->q('DELETE FROM {p}foto WHERE id = ?', [$f['id']]);
        protokoll('foto_geloescht', null, (int)$f['kunde_id'], ['id' => (int)$f['id']]);
    });
    @unlink(foto_ordner() . '/' . basename($f['datei']));
    return ['fotos' => fotos_lesen((int)$f['kunde_id'])];
}

/** Beim Löschen einer Kundin: Fotos mit weg. */
function fotos_loeschen(int $kunde): void
{
    foreach (db()->alle('SELECT datei FROM {p}foto WHERE kunde_id = ?', [$kunde]) as $f) @unlink(foto_ordner() . '/' . basename($f['datei']));
    db()->q('DELETE FROM {p}foto WHERE kunde_id = ?', [$kunde]);
}

/* ── Lager ───────────────────────────────────────────────────────────── */

function artikel_aufbereiten(array $a): array
{
    return ['id' => (int)$a['id'], 'name' => $a['name'], 'marke' => $a['marke'], 'ean' => $a['ean'], 'salon' => $a['salon_id'],
        'bestand' => (int)$a['bestand'], 'mindest' => (int)$a['mindest'], 'ek_cent' => $a['ek_cent'] === null ? null : (int)$a['ek_cent'],
        'vk_cent' => $a['vk_cent'] === null ? null : (int)$a['vk_cent'], 'aktiv' => (bool)$a['aktiv'], 'geaendert' => substr($a['geaendert'], 0, 16)];
}

function aktion_artikel(): array
{
    anmeldung_pflicht(false);
    $salon = text_feld('salon', 32, true);
    $db = db();
    $zeilen = $db->alle('SELECT * FROM {p}artikel WHERE salon_id = ? ORDER BY aktiv DESC, marke, name', [$salon]);
    $wert = 0;
    foreach ($zeilen as $a) if ($a['aktiv'] && $a['ek_cent'] !== null) $wert += max(0, (int)$a['bestand']) * (int)$a['ek_cent'];
    return ['artikel' => array_map('artikel_aufbereiten', $zeilen), 'warenwert_cent' => $wert,
        'nachbestellen' => count(array_filter($zeilen, fn($a) => $a['aktiv'] && (int)$a['bestand'] <= (int)$a['mindest']))];
}

function aktion_artikel_speichern(): array
{
    anmeldung_pflicht(true, ['inhaberin', 'rezeption']);
    $id = feld('id') ? (int)feld('id') : null;
    $salon = text_feld('salon', 32, true);
    if (!db()->wert('SELECT 1 FROM {p}salon WHERE id = ?', [$salon])) throw new Fehler('Unbekannter Salon.', 422);
    $cent = function (string $f) { $w = feld($f); if ($w === null || $w === '') return null; if (!is_int($w) || $w < 0) throw new Fehler('Preis ungültig.', 422, $f, ['feld' => $f]); return $w; };
    $ean = preg_replace('/\D/', '', (string)text_feld('ean', 20)) ?: null;
    $zeile = ['name' => text_feld('name', 160, true), 'marke' => text_feld('marke', 80), 'ean' => $ean, 'salon_id' => $salon,
        'mindest' => max(0, (int)feld('mindest', 0)), 'ek_cent' => $cent('ek_cent'), 'vk_cent' => $cent('vk_cent'),
        'aktiv' => feld('aktiv') === false ? 0 : 1, 'geaendert' => jetzt()];
    $id = db()->schreiben(function (DB $db) use ($id, $zeile) {
        if ($zeile['ean'] && $db->wert('SELECT 1 FROM {p}artikel WHERE ean = ? AND salon_id = ?' . ($id ? ' AND id <> ?' : ''), $id ? [$zeile['ean'], $zeile['salon_id'], $id] : [$zeile['ean'], $zeile['salon_id']])) {
            throw new Fehler('Diesen Strichcode hat schon ein anderer Artikel.', 409, 'doppelt', ['feld' => 'ean']);
        }
        if ($id) $db->aendern('artikel', $zeile, 'id = ?', [$id]);
        else {
            $id = $db->einfuegen('artikel', $zeile + ['bestand' => 0]);
            $start = (int)feld('bestand', 0);
            if ($start) lager_bewegen($id, $start, 'inventur', 'Anfangsbestand');
        }
        protokoll('artikel_gespeichert', null, null, ['id' => $id, 'name' => $zeile['name']]);
        return $id;
    });
    return artikel_aufbereiten(db()->eins('SELECT * FROM {p}artikel WHERE id = ?', [$id]));
}

/** Bestand ändern: Eingang (+), Verkauf/Verbrauch (−), Inventur (= gezählt). */
function lager_bewegen(int $artikel, int $menge, string $art, ?string $notiz): array
{
    $db = db();
    if ($db->treiber === 'mysql') $db->q('SELECT id FROM {p}artikel WHERE id = ? FOR UPDATE', [$artikel]);
    $a = $db->eins('SELECT * FROM {p}artikel WHERE id = ?', [$artikel]);
    if (!$a) throw new Fehler('Artikel nicht gefunden.', 404);
    $alt = (int)$a['bestand'];
    if ($art === 'inventur') { $neu = $menge; $menge = $neu - $alt; }
    else {
        $menge = in_array($art, ['verkauf', 'verbrauch'], true) ? -abs($menge) : ($art === 'eingang' ? abs($menge) : $menge);
        $neu = $alt + $menge;
    }
    $db->aendern('artikel', ['bestand' => $neu, 'geaendert' => jetzt()], 'id = ?', [$artikel]);
    $db->einfuegen('lager_bewegung', ['artikel_id' => $artikel, 'menge' => $menge, 'art' => $art, 'bestand_danach' => $neu, 'zeit' => jetzt(),
        'person_id' => $GLOBALS['ANGEMELDET']['id'] ?? null, 'notiz' => $notiz]);
    return $db->eins('SELECT * FROM {p}artikel WHERE id = ?', [$artikel]);
}

function aktion_lager_buchen(): array
{
    anmeldung_pflicht(true);
    $art = (string)feld('art');
    if (!in_array($art, ['eingang', 'verkauf', 'verbrauch', 'inventur', 'korrektur'], true)) throw new Fehler('Unbekannte Buchung.', 422);
    $menge = feld('menge');
    if (!is_int($menge) || abs($menge) > 100000 || ($menge === 0 && $art !== 'inventur') || ($art === 'inventur' && $menge < 0)) throw new Fehler('Menge ungültig.', 422, 'menge', ['feld' => 'menge']);
    $a = db()->schreiben(fn() => lager_bewegen((int)feld('artikel_id'), $menge, $art, text_feld('notiz', 255)));
    return artikel_aufbereiten($a);
}

function aktion_lager_verlauf(): array
{
    anmeldung_pflicht(false);
    return ['verlauf' => array_map(fn($b) => ['zeit' => substr($b['zeit'], 0, 16), 'menge' => (int)$b['menge'], 'art' => $b['art'],
        'bestand' => (int)$b['bestand_danach'], 'wer' => $b['name'], 'notiz' => $b['notiz']],
        db()->alle('SELECT b.*, p.name FROM {p}lager_bewegung b LEFT JOIN {p}person p ON p.id = b.person_id WHERE b.artikel_id = ? ORDER BY b.id DESC LIMIT 60', [(int)feld('artikel_id')]))];
}

/* ── Import (Planity und andere) ─────────────────────────────────────── */

/** CSV lesen: Trennzeichen erraten, Spalten an ihren Namen erkennen
    (Deutsch, Englisch, Französisch — Planity exportiert je nach Konto). */
function import_lesen(string $csv): array
{
    $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);
    if (!mb_check_encoding($csv, 'UTF-8')) $csv = mb_convert_encoding($csv, 'UTF-8', 'Windows-1252');
    $zeilen = preg_split('/\r\n|\n|\r/', trim($csv));
    if (count($zeilen) < 2) throw new Fehler('Die Datei hat keine Zeilen (oder nur die Kopfzeile).', 422, 'leer');
    $kopfRoh = $zeilen[0];
    $trenn = ';';
    $best = 0;
    foreach ([';', ',', "\t"] as $t) { $n = substr_count($kopfRoh, $t); if ($n > $best) { $best = $n; $trenn = $t; } }
    $kopf = array_map(fn($x) => strtr(mb_strtolower(trim((string)$x)), ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss', 'é' => 'e', '-' => '', '_' => '', ' ' => '']),
        str_getcsv($kopfRoh, $trenn, '"', ''));
    $muster = [
        'vorname' => ['vorname', 'firstname', 'prenom', 'first'],
        'nachname' => ['nachname', 'lastname', 'nom', 'familienname', 'last', 'surname'],
        'name' => ['name', 'kunde', 'kundin', 'client', 'customer', 'vollername', 'fullname'],
        'telefon' => ['telefon', 'handy', 'mobil', 'mobilnummer', 'handynummer', 'telefonnummer', 'phone', 'mobile', 'tel', 'telephone', 'portable', 'mobilephone', 'phonenumber'],
        'email' => ['email', 'mail', 'emailadresse', 'courriel'],
        'notiz' => ['notiz', 'notizen', 'bemerkung', 'bemerkungen', 'kommentar', 'notes', 'note', 'comment', 'comments'],
    ];
    $spalten = [];
    foreach ($muster as $feld => $namen) foreach ($kopf as $i => $k) if (in_array($k, $namen, true) && !in_array($i, $spalten, true)) { $spalten[$feld] = $i; break; }
    if (!isset($spalten['telefon']) && !isset($spalten['email'])) throw new Fehler('Keine Spalte für Telefon oder E-Mail erkannt. Erste Zeile: ' . mb_substr($kopfRoh, 0, 120), 422, 'spalten');
    if (!isset($spalten['vorname']) && !isset($spalten['nachname']) && !isset($spalten['name'])) throw new Fehler('Keine Spalte für den Namen erkannt.', 422, 'spalten');
    $aus = [];
    foreach (array_slice($zeilen, 1) as $z) {
        if (trim($z) === '') continue;
        $w = str_getcsv($z, $trenn, '"', '');
        $hol = fn(string $f) => isset($spalten[$f]) ? trim((string)($w[$spalten[$f]] ?? '')) : '';
        $vor = $hol('vorname'); $nach = $hol('nachname');
        if ($vor === '' && $nach === '' && $hol('name') !== '') [$vor, $nach] = name_teilen($hol('name'));
        $aus[] = ['vorname' => mb_substr($vor, 0, 80) ?: null, 'nachname' => mb_substr((string)$nach, 0, 80) ?: null,
            'telefon_roh' => $hol('telefon'), 'telefon' => telefon_normal($hol('telefon')), 'email' => email_normal($hol('email')),
            'notiz' => mb_substr($hol('notiz'), 0, 2000) ?: null];
    }
    return ['spalten' => array_keys($spalten), 'zeilen' => $aus];
}

function import_einordnen(array $zeilen): array
{
    $db = db();
    $sicht = ['neu' => [], 'vorhanden' => [], 'ohne_kontakt' => [], 'doppelt_in_datei' => 0];
    $gesehen = [];
    foreach ($zeilen as $z) {
        if (!$z['telefon'] && !$z['email']) { $sicht['ohne_kontakt'][] = $z; continue; }
        $schluessel = $z['telefon'] ?: $z['email'];
        if (isset($gesehen[$schluessel])) { $sicht['doppelt_in_datei']++; continue; }
        $gesehen[$schluessel] = true;
        $da = $z['telefon'] ? $db->wert('SELECT id FROM {p}kunde WHERE telefon = ? AND geloescht = 0', [$z['telefon']]) : null;
        $da ??= $z['email'] ? $db->wert('SELECT id FROM {p}kunde WHERE email = ? AND geloescht = 0', [$z['email']]) : null;
        if ($da) $sicht['vorhanden'][] = $z + ['id' => (int)$da]; else $sicht['neu'][] = $z;
    }
    return $sicht;
}

function aktion_import_pruefen(): array
{
    anmeldung_pflicht(true, true);
    $l = import_lesen((string)feld('csv', ''));
    $s = import_einordnen($l['zeilen']);
    $zeige = fn($z) => ['name' => trim(($z['vorname'] ?? '') . ' ' . ($z['nachname'] ?? '')), 'telefon' => telefon_anzeige($z['telefon']) ?? $z['telefon_roh'], 'email' => $z['email']];
    return ['spalten' => $l['spalten'], 'zeilen' => count($l['zeilen']), 'neu' => count($s['neu']), 'vorhanden' => count($s['vorhanden']),
        'ohne_kontakt' => count($s['ohne_kontakt']), 'doppelt_in_datei' => $s['doppelt_in_datei'],
        'beispiele' => array_map($zeige, array_slice($s['neu'], 0, 5)), 'unlesbar' => array_map($zeige, array_slice($s['ohne_kontakt'], 0, 5))];
}

/** Übernehmen: neue Kundinnen anlegen, vorhandene nur ergänzen (nie
    überschreiben). Einwilligungen werden NICHT übernommen — für Recall und
    Angebote fragen wir neu; Terminerinnerungen per E-Mail gehen ohnehin. */
function aktion_import_kunden(): array
{
    anmeldung_pflicht(true, true);
    $herkunft = preg_replace('/[^a-z]/', '', strtolower((string)feld('herkunft', 'planity'))) ?: 'import';
    $l = import_lesen((string)feld('csv', ''));
    $s = import_einordnen($l['zeilen']);
    $n = db()->schreiben(function (DB $db) use ($s, $herkunft) {
        $neu = 0; $ergaenzt = 0;
        foreach ($s['neu'] as $z) {
            $k = ['vorname' => $z['vorname'], 'nachname' => $z['nachname'], 'telefon' => $z['telefon'], 'email' => $z['email'], 'notiz' => $z['notiz'],
                'erstellt' => jetzt(), 'geaendert' => jetzt(), 'geloescht' => 0, 'herkunft' => $herkunft];
            $k['suche'] = kunde_suchtext($k);
            $db->einfuegen('kunde', $k);
            $neu++;
        }
        foreach ($s['vorhanden'] as $z) {
            $alt = $db->eins('SELECT * FROM {p}kunde WHERE id = ?', [$z['id']]);
            $dazu = [];
            foreach (['vorname', 'nachname', 'telefon', 'email'] as $f) if (!$alt[$f] && $z[$f]) $dazu[$f] = $z[$f];
            if ($z['notiz'] && !str_contains((string)$alt['notiz'], $z['notiz'])) $dazu['notiz'] = trim(($alt['notiz'] ?? '') . "\n" . $z['notiz']);
            if ($dazu) { $dazu['geaendert'] = jetzt(); $dazu['suche'] = kunde_suchtext(array_merge($alt, $dazu)); $db->aendern('kunde', $dazu, 'id = ?', [$z['id']]); $ergaenzt++; }
        }
        $db->standErhoehen();
        protokoll('import', null, null, ['herkunft' => $herkunft, 'neu' => $neu, 'ergaenzt' => $ergaenzt, 'ohne_kontakt' => count($s['ohne_kontakt'])]);
        return ['neu' => $neu, 'ergaenzt' => $ergaenzt];
    });
    return $n + ['ohne_kontakt' => count($s['ohne_kontakt']), 'doppelt_in_datei' => $s['doppelt_in_datei']];
}

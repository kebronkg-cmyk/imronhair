<?php
/* Studio: Nachrichten — Postausgang, Recall, Warteliste, Kampagnen,
   Vorlagen, Einwilligungen von Hand, Monatsbericht. */

declare(strict_types=1);

require_once __DIR__ . '/nachrichten.php';

const ZWECK_NAME = ['erinnerung' => 'Erinnerung', 'recall' => 'Recall', 'recall_nachfass' => 'Recall-Nachfrage', 'warteliste' => 'Warteliste',
    'kampagne' => 'Kampagne', 'doi' => 'Bestätigung', 'stop' => 'Abmeldung bestätigt', 'bestaetigung' => 'Buchungsbestätigung',
    'aenderung' => 'Änderung', 'absage' => 'Absage', 'salon' => 'An den Salon', 'bericht' => 'Monatsbericht', 'test' => 'Test', 'post' => 'E-Mail'];

function aktion_nachrichten_stand(): array
{
    anmeldung_pflicht(false, ['inhaberin', 'rezeption']);
    $db = db();
    $monat = date('Y-m-01 00:00:00');
    $s = sms_konfig();
    $p = (array)konfig('post', []);
    $zahlen = [];
    foreach ($db->alle('SELECT status, COUNT(*) AS n, COALESCE(SUM(kosten_cent), 0) AS kosten, COALESCE(SUM(teile), 0) AS teile, kanal FROM {p}nachricht WHERE erstellt >= ? GROUP BY status, kanal', [$monat]) as $z) {
        $zahlen[] = ['status' => $z['status'], 'kanal' => $z['kanal'], 'n' => (int)$z['n'], 'kosten_cent' => (int)$z['kosten'], 'teile' => (int)$z['teile']];
    }
    $e = einstellungen();
    return [
        'kanaele' => [
            'email' => ['aktiv' => post_aktiv(), 'absender' => $p['absender'] ?? null, 'vorfuehrung' => ($p['versand'] ?? '') === 'vorfuehrung'],
            'sms' => ['aktiv' => sms_aktiv(), 'anbieter' => $s['anbieter'], 'absender' => $s['absender'], 'stop' => stop_moeglich(), 'vorfuehrung' => $s['anbieter'] === 'vorfuehrung'],
            'whatsapp' => ['aktiv' => whatsapp_aktiv(), 'vorfuehrung' => whatsapp_konfig()['anbieter'] === 'vorfuehrung'],
        ],
        'monat' => $zahlen,
        'wartet' => (int)$db->wert("SELECT COUNT(*) FROM {p}nachricht WHERE status = 'wartet'"),
        'fehler' => (int)$db->wert("SELECT COUNT(*) FROM {p}nachricht WHERE status = 'fehler' AND erstellt >= ?", [date('Y-m-d H:i:s', time() - 7 * 86400)]),
        'recall_lauf' => $db->wert("SELECT wert FROM {p}meta WHERE schluessel = 'recall_lauf'"),
        'warteliste' => (int)$db->wert("SELECT COUNT(*) FROM {p}warteliste WHERE status = 'aktiv' AND bis >= ?", [date('Y-m-d')]),
        'sms_preis_cent' => (int)$e['sms_preis_cent'],
        'stop_monat' => (int)$db->wert('SELECT COUNT(*) FROM {p}sperre WHERE zeit >= ?', [$monat]),
    ];
}

function nachricht_zeile(array $n, array $namen): array
{
    return ['id' => (int)$n['id'], 'zeit' => substr($n['gesendet'] ?? $n['erstellt'], 0, 16), 'erstellt' => substr($n['erstellt'], 0, 16),
        'nicht_vor' => substr($n['nicht_vor'], 0, 16), 'kanal' => $n['kanal'], 'zweck' => $n['zweck'], 'zweck_name' => ZWECK_NAME[$n['zweck']] ?? $n['zweck'],
        'an' => $n['kanal'] === 'email' ? $n['an'] : telefon_anzeige($n['an']), 'betreff' => $n['kanal'] === 'whatsapp' ? null : $n['betreff'],
        'text' => $n['text'], 'status' => $n['status'], 'fehler' => $n['fehler'], 'teile' => (int)$n['teile'],
        'kosten_cent' => $n['kosten_cent'] === null ? null : (int)$n['kosten_cent'], 'versuche' => (int)$n['versuche'],
        'kunde_id' => $n['kunde_id'] ? (int)$n['kunde_id'] : null, 'kunde' => $n['kunde_id'] ? ($namen[(int)$n['kunde_id']] ?? null) : null,
        'termin_id' => $n['termin_id'] ? (int)$n['termin_id'] : null];
}

function kunden_namen(array $ids): array
{
    $ids = array_values(array_unique(array_filter($ids)));
    if (!$ids) return [];
    $aus = [];
    foreach (db()->alle('SELECT id, vorname, nachname FROM {p}kunde WHERE id IN (' . DB::liste($ids) . ')', $ids) as $k) {
        $aus[(int)$k['id']] = trim($k['vorname'] . ' ' . $k['nachname']) ?: 'Ohne Namen';
    }
    return $aus;
}

function aktion_nachrichten_liste(): array
{
    $a = anmeldung_pflicht(false);
    $kunde = feld('kunde_id') ? (int)feld('kunde_id') : null;
    if (!$kunde && !in_array($a['rolle'], ['inhaberin', 'rezeption'], true)) throw new Fehler('Das darf Ihre Rolle nicht.', 403, 'rolle');
    $sql = 'SELECT * FROM {p}nachricht WHERE 1 = 1';
    $w = [];
    if ($kunde) { $sql .= ' AND kunde_id = ?'; $w[] = $kunde; }
    $status = (string)feld('status', '');
    if ($status !== '') { $sql .= ' AND status = ?'; $w[] = $status; }
    $zweck = (string)feld('zweck', '');
    if ($zweck !== '') { $sql .= ' AND zweck = ?'; $w[] = $zweck; }
    if (feld('vor')) { $sql .= ' AND id < ?'; $w[] = (int)feld('vor'); }
    $zeilen = db()->alle($sql . ' ORDER BY id DESC LIMIT 80', $w);
    $namen = kunden_namen(array_map(fn($n) => (int)$n['kunde_id'], $zeilen));
    return ['nachrichten' => array_map(fn($n) => nachricht_zeile($n, $namen), $zeilen)];
}

function aktion_nachricht_wiederholen(): array
{
    anmeldung_pflicht(true, ['inhaberin', 'rezeption']);
    $id = (int)feld('id');
    $n = db()->q("UPDATE {p}nachricht SET status = 'wartet', versuche = 0, nicht_vor = ?, fehler = NULL WHERE id = ? AND status = 'fehler'", [jetzt(), $id])->rowCount();
    if (!$n) throw new Fehler('Nur fehlgeschlagene Nachrichten lassen sich wiederholen.', 409);
    protokoll('nachricht_wiederholt', null, null, ['id' => $id]);
    return warteschlange_abarbeiten(5, [$id]);
}

/** „Jetzt senden“: was fällig ist, gleich — ohne auf den Cronjob zu warten. */
function aktion_warteschlange_senden(): array
{
    anmeldung_pflicht(true, ['inhaberin', 'rezeption']);
    $GLOBALS['AKTEUR'] = 'system';
    $aus = ['erinnerungen' => erinnerungen_einreihen(), 'warteliste' => count(warteliste_abgleich())];
    return $aus + warteschlange_abarbeiten(200);
}

/* ── Recall ──────────────────────────────────────────────────────────── */

function aktion_recall_liste(): array
{
    anmeldung_pflicht(false, ['inhaberin', 'rezeption']);
    $db = db();
    $seit = date('Y-m-d H:i:s', time() - 90 * 86400);
    $zeilen = $db->alle('SELECT r.*, t.start AS letzter_start FROM {p}recall r LEFT JOIN {p}termin t ON t.id = r.letzter_termin_id WHERE r.erstellt >= ? ORDER BY r.id DESC LIMIT 200', [$seit]);
    $namen = kunden_namen(array_map(fn($r) => (int)$r['kunde_id'], $zeilen));
    $laufend = array_map(fn($r) => ['id' => (int)$r['id'], 'kunde_id' => (int)$r['kunde_id'], 'kunde' => $namen[(int)$r['kunde_id']] ?? '—',
        'faellig' => $r['faellig'], 'erste' => $r['erste'] ? substr($r['erste'], 0, 16) : null, 'zweite' => $r['zweite'] ? substr($r['zweite'], 0, 16) : null,
        'kanal' => $r['kanal'], 'status' => $r['status'], 'termin_id' => $r['termin_id'] ? (int)$r['termin_id'] : null,
        'letzter' => $r['letzter_start'] ? substr($r['letzter_start'], 0, 10) : null], $zeilen);
    $vorschau = recall_vorschau(14);
    $e = einstellungen();
    $monat = date('Y-m');
    $b = bericht($monat);
    return ['aktiv' => (bool)$e['recall_aktiv'], 'nachfass' => (int)$e['recall_nachfass'], 'laufend' => $laufend,
        'bald' => $vorschau['bald'], 'ohne_einwilligung' => $vorschau['ohne_einwilligung'], 'mit_einwilligung' => $vorschau['mit_einwilligung'],
        'monat' => $b['recall']];
}

/** Wer wird in den nächsten Tagen fällig? Und wie viele wären fällig,
    haben aber keine Einwilligung (beim nächsten Besuch fragen). */
function recall_vorschau(int $tage): array
{
    $db = db();
    $jetzt = jetzt();
    $heute = date('Y-m-d');
    $bis = tag_plus($heute, $tage);
    $mit = array_flip(array_column($db->alle("SELECT e.kunde_id FROM {p}einwilligung e WHERE e.art = 'recall' AND e.erteilt = 1
        AND e.id = (SELECT MAX(e2.id) FROM {p}einwilligung e2 WHERE e2.kunde_id = e.kunde_id AND e2.art = 'recall')"), 'kunde_id'));
    $kunden = $db->alle("SELECT k.id, k.vorname, k.nachname, k.telefon, k.email FROM {p}kunde k WHERE k.geloescht = 0
        AND NOT EXISTS (SELECT 1 FROM {p}termin t WHERE t.kunde_id = k.id AND t.status = 'gebucht' AND t.start >= ?)
        AND EXISTS (SELECT 1 FROM {p}termin t WHERE t.kunde_id = k.id AND t.start >= ?)", [$jetzt, date('Y-m-d', time() - 400 * 86400)]);
    $bald = []; $ohne = 0;
    foreach ($kunden as $k) {
        $letzter = $db->eins("SELECT * FROM {p}termin WHERE kunde_id = ? AND (status = 'erschienen' OR (status = 'gebucht' AND start < ?)) ORDER BY start DESC LIMIT 1", [$k['id'], $jetzt]);
        if (!$letzter) continue;
        $abstand = recall_abstand((int)$k['id'], $letzter);
        if ($abstand === null) continue;
        $faellig = tag_plus(substr($letzter['start'], 0, 10), $abstand);
        if ($faellig > $bis || $faellig < tag_plus($heute, -45)) continue;
        if (!isset($mit[$k['id']])) { $ohne++; continue; }
        if ($db->wert('SELECT 1 FROM {p}recall WHERE kunde_id = ? AND letzter_termin_id = ?', [$k['id'], $letzter['id']])) continue;
        $bald[] = ['kunde_id' => (int)$k['id'], 'kunde' => trim($k['vorname'] . ' ' . $k['nachname']), 'faellig' => $faellig,
            'letzter' => substr($letzter['start'], 0, 10), 'abstand' => $abstand,
            'kanal' => kanal_fuer($k)[0] ?? null];
    }
    usort($bald, fn($a, $b) => strcmp($a['faellig'], $b['faellig']));
    return ['bald' => array_slice($bald, 0, 100), 'ohne_einwilligung' => $ohne, 'mit_einwilligung' => count($mit)];
}

function aktion_recall_starten(): array
{
    anmeldung_pflicht(true, true);
    $GLOBALS['AKTEUR'] = 'system';
    $r = recall_pruefen(true);
    return $r + ['versand' => warteschlange_abarbeiten(200)];
}

/* ── Warteliste ──────────────────────────────────────────────────────── */

function aktion_warteliste_liste(): array
{
    anmeldung_pflicht(false);
    $db = db();
    $db->q("UPDATE {p}warteliste SET status = 'abgelaufen' WHERE status = 'aktiv' AND bis < ?", [date('Y-m-d')]);
    $salon = text_feld('salon', 32);
    $sql = "SELECT id FROM {p}warteliste WHERE (status = 'aktiv' OR erstellt >= ?)";
    $w = [date('Y-m-d H:i:s', time() - 30 * 86400)];
    if ($salon) { $sql .= ' AND salon_id = ?'; $w[] = $salon; }
    $liste = array_map(fn($z) => warteliste_lesen((int)$z['id']), $db->alle($sql . " ORDER BY CASE WHEN status = 'aktiv' THEN 0 ELSE 1 END, erstellt LIMIT 200", $w));
    foreach ($liste as &$e) {
        unset($e['token']);
        $e['angebote'] = array_map(fn($a) => ['start' => substr($a['start'], 0, 16), 'status' => $a['status'], 'erstellt' => substr($a['erstellt'], 0, 16)],
            $db->alle('SELECT start, status, erstellt FROM {p}angebot WHERE warteliste_id = ? ORDER BY id DESC LIMIT 5', [$e['id']]));
    }
    unset($e);
    return ['eintraege' => $liste, 'aktiv' => (bool)einstellungen()['warteliste_aktiv']];
}

/** Aus dem Studio eintragen (am Telefon, an der Theke). */
function aktion_warteliste_speichern(): array
{
    anmeldung_pflicht(true);
    if (feld('einverstanden') !== true) throw new Fehler('Bitte bestätigen, dass die Kundin benachrichtigt werden möchte.', 422, 'einverstanden', ['feld' => 'einverstanden']);
    $salon = text_feld('salon', 32, true);
    $ids = feld('leistungen');
    if (!is_array($ids)) throw new Fehler('Bitte eine Leistung wählen.', 422, 'leistungen');
    $w = db()->schreiben(function () use ($salon, $ids) {
        $kunde = studio_kunde();
        if (!$kunde) throw new Fehler('Bitte Name und Handynummer angeben.', 422, 'pflicht');
        $k = db()->eins('SELECT telefon, email FROM {p}kunde WHERE id = ?', [$kunde]);
        if (!$k['telefon'] && !$k['email']) throw new Fehler('Ohne Handynummer oder E-Mail können wir nicht Bescheid geben.', 422, 'telefon', ['feld' => 'telefon']);
        if ($k['telefon']) entsperren('sms', $k['telefon']);
        return warteliste_eintragen(['kunde_id' => $kunde, 'salon' => $salon, 'leistungen' => $ids, 'person' => text_feld('person', 32),
            'von' => (string)feld('von', date('Y-m-d')), 'bis' => (string)feld('bis'), 'tageszeit' => (string)feld('tageszeit', 'egal'),
            'quelle' => 'studio', 'notiz' => text_feld('notiz', 255), 'online' => false]);
    });
    nach_antwort(function () use ($w) { $ids = warteliste_abgleich($w['salon']); if ($ids) warteschlange_abarbeiten(10, $ids); });
    unset($w['token']);
    return $w;
}

function aktion_warteliste_entfernen(): array
{
    anmeldung_pflicht(true);
    $id = (int)feld('id');
    db()->schreiben(function (DB $db) use ($id) {
        $w = $db->eins('SELECT * FROM {p}warteliste WHERE id = ?', [$id]);
        if (!$w) throw new Fehler('Eintrag nicht gefunden.', 404);
        $db->aendern('warteliste', ['status' => 'entfernt'], 'id = ?', [$id]);
        $db->q("UPDATE {p}angebot SET status = 'zurueckgezogen' WHERE warteliste_id = ? AND status = 'offen'", [$id]);
        $db->standErhoehen();
        protokoll('warteliste_entfernt', null, (int)$w['kunde_id'], ['id' => $id]);
    });
    return ['ok' => true];
}

function aktion_warteliste_abgleichen(): array
{
    anmeldung_pflicht(true);
    $GLOBALS['AKTEUR'] = 'system';
    $ids = warteliste_abgleich(text_feld('salon', 32));
    return ['angebote' => count($ids)] + warteschlange_abarbeiten(30, $ids);
}

/* ── Kampagnen ───────────────────────────────────────────────────────── */

/** Wer bekäme diese Kampagne? Nur mit bestätigter Einwilligung „Angebote“,
    höchstens eine im Monat (so steht es im Wortlaut der Einwilligung). */
function kampagne_empfaenger(array $f): array
{
    $db = db();
    $kanal = in_array($f['kanal'] ?? '', ['sms', 'email', 'auto'], true) ? $f['kanal'] : 'auto';
    $werte = [];
    $sql = "SELECT k.* FROM {p}kunde k JOIN {p}einwilligung e ON e.kunde_id = k.id AND e.art = 'angebote'
        WHERE k.geloescht = 0 AND e.erteilt = 1 AND e.id = (SELECT MAX(e2.id) FROM {p}einwilligung e2 WHERE e2.kunde_id = k.id AND e2.art = 'angebote')";
    if (!empty($f['salon'])) { $sql .= ' AND EXISTS (SELECT 1 FROM {p}termin t WHERE t.kunde_id = k.id AND t.salon_id = ?)'; $werte[] = $f['salon']; }
    if (!empty($f['gruppe'])) {
        $sql .= ' AND EXISTS (SELECT 1 FROM {p}termin t JOIN {p}termin_posten p ON p.termin_id = t.id JOIN {p}leistung l ON l.id = p.leistung_id WHERE t.kunde_id = k.id AND l.gruppe = ?)';
        $werte[] = $f['gruppe'];
    }
    if (!empty($f['seit_wochen'])) {
        $sql .= " AND NOT EXISTS (SELECT 1 FROM {p}termin t WHERE t.kunde_id = k.id AND t.status IN ('gebucht', 'erschienen') AND t.start >= ?)";
        $werte[] = date('Y-m-d H:i:s', time() - (int)$f['seit_wochen'] * 7 * 86400);
    }
    $alle = $db->alle($sql, $werte);
    $kuerzlich = array_flip(array_column($db->alle("SELECT DISTINCT kunde_id FROM {p}nachricht WHERE zweck = 'kampagne' AND status IN ('wartet', 'sendet', 'gesendet') AND erstellt >= ?",
        [date('Y-m-d H:i:s', time() - 28 * 86400)]), 'kunde_id'));
    $aus = ['liste' => [], 'monat_schon' => 0, 'nicht_erreichbar' => 0, 'mit_einwilligung' => count($alle)];
    foreach ($alle as $k) {
        if (isset($kuerzlich[$k['id']])) { $aus['monat_schon']++; continue; }
        $weg = match ($kanal) {
            'sms' => ($k['telefon'] && sms_aktiv() && !gesperrt('sms', $k['telefon'])) ? ['sms', $k['telefon']] : null,
            'email' => ($k['email'] && post_aktiv() && !gesperrt('email', $k['email'])) ? ['email', $k['email']] : null,
            default => kanal_fuer($k),
        };
        if (!$weg) { $aus['nicht_erreichbar']++; continue; }
        $aus['liste'][] = ['k' => $k, 'kanal' => $weg[0], 'an' => $weg[1]];
    }
    return $aus;
}

function kampagne_eingabe(): array
{
    $f = ['kanal' => (string)feld('kanal', 'auto'), 'salon' => text_feld('salon', 32), 'gruppe' => text_feld('gruppe', 32),
        'seit_wochen' => max(0, min(104, (int)feld('seit_wochen', 0)))];
    $text = (string)text_feld('text', 1200, true);
    $betreff = text_feld('betreff', 160) ?? 'Neuigkeiten von Irmonhair';
    return [$f, $text, $betreff];
}

function kampagne_text(string $text, array $k, string $kanal, ?int $kampagne): string
{
    $link = termin_basis() . ($kampagne ? '?ref=kampagne-' . $kampagne : '');
    $t = ausfuellen($text, ['vorname' => $k['vorname'], 'link' => $link]);
    if ($kanal === 'email') return $t . email_fuss((int)$k['id']);
    return $t;
}

function aktion_kampagne_vorschau(): array
{
    anmeldung_pflicht(false, true);
    [$f, $text, $betreff] = kampagne_eingabe();
    $e = kampagne_empfaenger($f);
    $sms = array_filter($e['liste'], fn($x) => $x['kanal'] === 'sms');
    $beispiel = $e['liste'][0] ?? null;
    $smsText = sms_glaetten(kampagne_text($text, ['vorname' => 'Anna', 'id' => 0], 'sms', 1)) . "\nAbmelden: STOP";
    $teile = sms_teile($smsText);
    return ['anzahl' => count($e['liste']), 'sms' => count($sms), 'email' => count($e['liste']) - count($sms),
        'monat_schon' => $e['monat_schon'], 'nicht_erreichbar' => $e['nicht_erreichbar'], 'mit_einwilligung' => $e['mit_einwilligung'],
        'teile' => $teile, 'zeichen' => mb_strlen($smsText), 'kosten_cent' => count($sms) * $teile * (int)einstellungen()['sms_preis_cent'],
        'sms_text' => $smsText, 'naechste_sendezeit' => substr(naechste_sendezeit(jetzt()), 0, 16),
        'beispiel' => $beispiel ? kampagne_text($text, $beispiel['k'], $beispiel['kanal'], 1) : null];
}

function aktion_kampagne_test(): array
{
    anmeldung_pflicht(true, true);
    [$f, $text, $betreff] = kampagne_eingabe();
    $an = text_feld('an', 190, true);
    $kanal = email_normal($an) ? 'email' : (telefon_normal($an) ? 'sms' : null);
    if (!$kanal) throw new Fehler('Bitte eine E-Mail-Adresse oder Handynummer für den Test angeben.', 422, 'an', ['feld' => 'an']);
    if (!kanal_bereit($kanal)) throw new Fehler($kanal === 'sms' ? 'SMS ist noch nicht eingerichtet (api/config.php → sms).' : 'E-Mail ist noch nicht eingerichtet.', 409);
    $id = nachricht_einreihen(['kanal' => $kanal, 'zweck' => 'test', 'an' => $an, 'betreff' => '[Test] ' . $betreff, 'trotz_sperre' => true,
        'text' => kampagne_text($text, ['vorname' => $GLOBALS['ANGEMELDET']['name'], 'id' => 0], $kanal, null) . ($kanal === 'sms' ? "\nAbmelden: STOP" : '')]);
    return warteschlange_abarbeiten(1, $id ? [$id] : []);
}

function aktion_kampagne_senden(): array
{
    anmeldung_pflicht(true, true);
    [$f, $text, $betreff] = kampagne_eingabe();
    $titel = text_feld('titel', 120) ?? mb_substr($text, 0, 60);
    $e = kampagne_empfaenger($f);
    if (!$e['liste']) throw new Fehler('Niemand in dieser Auswahl hat Angeboten zugestimmt oder ist erreichbar.', 409, 'leer');
    $erwartet = feld('anzahl');
    if ($erwartet !== null && (int)$erwartet !== count($e['liste'])) throw new Fehler('Die Zahl der Empfängerinnen hat sich gerade geändert. Bitte Vorschau neu laden.', 409, 'veraltet');
    $id = db()->schreiben(function (DB $db) use ($f, $text, $betreff, $titel, $e) {
        $id = $db->einfuegen('kampagne', ['titel' => $titel, 'kanal' => $f['kanal'], 'betreff' => $betreff, 'text' => $text,
            'zielgruppe' => json_encode($f), 'anzahl' => 0, 'erstellt' => jetzt(), 'erstellt_von' => $GLOBALS['ANGEMELDET']['id']]);
        $n = 0;
        foreach ($e['liste'] as $x) {
            if (nachricht_einreihen(['kanal' => $x['kanal'], 'zweck' => 'kampagne', 'an' => $x['an'], 'kunde_id' => (int)$x['k']['id'],
                'betreff' => ausfuellen($betreff, ['vorname' => $x['k']['vorname']]), 'text' => kampagne_text($text, $x['k'], $x['kanal'], $id),
                'bezug' => 'kampagne-' . $id, 'schluessel' => 'kampagne-' . $id . '-' . $x['k']['id']])) $n++;
        }
        $db->aendern('kampagne', ['anzahl' => $n], 'id = ?', [$id]);
        protokoll('kampagne', null, null, ['id' => $id, 'anzahl' => $n, 'kanal' => $f['kanal']]);
        return $id;
    });
    nach_antwort(fn() => warteschlange_abarbeiten(200));
    return ['id' => $id, 'anzahl' => (int)db()->wert('SELECT anzahl FROM {p}kampagne WHERE id = ?', [$id]),
        'ab' => substr(naechste_sendezeit(jetzt()), 0, 16)];
}

function aktion_kampagnen(): array
{
    anmeldung_pflicht(false, true);
    $db = db();
    $aus = [];
    foreach ($db->alle('SELECT * FROM {p}kampagne ORDER BY id DESC LIMIT 50') as $k) {
        $bezug = 'kampagne-' . $k['id'];
        $st = array_column($db->alle('SELECT status, COUNT(*) AS n FROM {p}nachricht WHERE bezug = ? GROUP BY status', [$bezug]), 'n', 'status');
        $aus[] = ['id' => (int)$k['id'], 'titel' => $k['titel'], 'kanal' => $k['kanal'], 'erstellt' => substr($k['erstellt'], 0, 16), 'anzahl' => (int)$k['anzahl'],
            'gesendet' => (int)($st['gesendet'] ?? 0), 'wartet' => (int)($st['wartet'] ?? 0), 'fehler' => (int)($st['fehler'] ?? 0),
            'gebucht' => (int)$db->wert("SELECT COUNT(*) FROM {p}termin WHERE ref = ? AND status NOT IN ('storniert_kunde', 'storniert_salon')", [$bezug]),
            'text' => $k['text']];
    }
    return ['kampagnen' => $aus];
}

/* ── Vorlagen ────────────────────────────────────────────────────────── */

function aktion_vorlagen(): array
{
    anmeldung_pflicht(false, true);
    $eigene = json_decode((string)db()->wert("SELECT wert FROM {p}meta WHERE schluessel = 'vorlagen'"), true) ?: [];
    $aus = [];
    foreach (VORLAGEN as $name => $vorgabe) $aus[] = ['name' => $name, 'vorgabe' => $vorgabe, 'eigen' => $eigene[$name] ?? null];
    return ['vorlagen' => $aus];
}

function aktion_vorlagen_speichern(): array
{
    anmeldung_pflicht(true, true);
    $neu = feld('vorlagen');
    if (!is_array($neu)) throw new Fehler('Keine Vorlagen.', 422);
    $eigene = [];
    foreach ($neu as $name => $text) {
        if (!isset(VORLAGEN[$name]) || !is_string($text)) continue;
        $text = trim(mb_substr($text, 0, 2000));
        if ($text === '' || $text === VORLAGEN[$name]) continue;
        // Ohne Link kommt niemand zum Termin; ohne ihn ist die Vorlage kaputt.
        if (str_contains(VORLAGEN[$name], '{link}') && !str_contains($text, '{link}')) throw new Fehler("In „{$name}“ fehlt {link}.", 422, 'link', ['feld' => $name]);
        $eigene[$name] = $text;
    }
    db()->schreiben(function (DB $db) use ($eigene) {
        $j = json_encode($eigene, JSON_UNESCAPED_UNICODE);
        if ($db->wert("SELECT 1 FROM {p}meta WHERE schluessel = 'vorlagen'")) $db->q("UPDATE {p}meta SET wert = ? WHERE schluessel = 'vorlagen'", [$j]);
        else $db->q("INSERT INTO {p}meta (schluessel, wert) VALUES ('vorlagen', ?)", [$j]);
        protokoll('vorlagen', null, null, ['geaendert' => array_keys($eigene)]);
    });
    return aktion_vorlagen();
}

/* ── Einwilligung und STOP von Hand ──────────────────────────────────── */

/** Die Kundin sagt es im Salon: ja oder nein. Festgehalten mit Wortlaut,
    Zeit und wer es eingetragen hat (Protokoll). */
function aktion_einwilligung_studio(): array
{
    anmeldung_pflicht(true);
    $kunde = (int)feld('kunde_id');
    $art = (string)feld('art');
    $erteilt = feld('erteilt') === true;
    kunde_lesen($kunde);
    db()->schreiben(function () use ($kunde, $art, $erteilt) {
        einwilligung_setzen($kunde, $art, $erteilt, 'studio');
        if ($erteilt) {
            $k = db()->eins('SELECT telefon, email FROM {p}kunde WHERE id = ?', [$kunde]);
            if ($k['telefon']) entsperren('sms', $k['telefon']);
        }
    });
    return ['einwilligungen' => einwilligungen_lesen($kunde)];
}

function aktion_sperre_studio(): array
{
    anmeldung_pflicht(true);
    $kunde = (int)feld('kunde_id');
    $k = kunde_lesen($kunde);
    $kanal = feld('kanal') === 'email' ? 'email' : 'sms';
    $an = $kanal === 'email' ? $k['email'] : $k['telefon'];
    if (!$an) throw new Fehler('Dafür ist keine Adresse eingetragen.', 422);
    db()->schreiben(function () use ($kanal, $an, $kunde) {
        if (feld('gesperrt') === true) { sperren($kanal, $an, 'studio'); kundin_abmelden($kunde, 'studio', $kanal === 'sms'); }
        else entsperren($kanal, $an);
    });
    return ['sms' => $k['telefon'] ? gesperrt('sms', $k['telefon']) : false, 'email' => $k['email'] ? gesperrt('email', $k['email']) : false];
}

/* ── Monatsbericht ───────────────────────────────────────────────────── */

function aktion_bericht(): array
{
    anmeldung_pflicht(false, true);
    $monat = (string)feld('monat', date('Y-m'));
    $b = bericht($monat, text_feld('salon', 32));
    return $b + ['text' => bericht_text($b)];
}

function aktion_bericht_senden(): array
{
    anmeldung_pflicht(true, true);
    $monat = (string)feld('monat', date('Y-m'));
    $an = email_normal(text_feld('an', 190, true));
    if (!$an) throw new Fehler('Bitte eine E-Mail-Adresse angeben.', 422, 'an', ['feld' => 'an']);
    if (!post_aktiv()) throw new Fehler('E-Mail ist noch nicht eingerichtet.', 409);
    $ok = post_senden($an, 'Irmonhair: Monatsbericht ' . $monat, bericht_text(bericht($monat)), null, ['zweck' => 'bericht']);
    return ['ok' => $ok];
}

<?php
/* Der Planer: welche Startzeiten sind frei, und für wen?

   Eine Leistung ist eine Folge von Phasen: Arbeit, Einwirkzeit, Arbeit …
   Belegt ist eine Person nur während der Arbeit; in der Einwirkzeit kann
   sie eine andere Kundin bedienen. Die Arbeitszeiten eines Termins stehen
   in {p}belegung, damit die Frage „frei?“ eine einfache Bereichsabfrage ist.

   Alle Rechnungen eines Tages laufen in Minuten ab Mitternacht. */

declare(strict_types=1);

/** Leistungen laden und prüfen, dass sie in diesem Salon buchbar sind. */
function leistungen_laden(array $ids, string $salon, bool $online): array
{
    $ids = array_values(array_unique(array_filter(array_map('strval', $ids))));
    if (!$ids || count($ids) > 6) throw new Fehler('Bitte eine bis sechs Leistungen wählen.', 422, 'leistungen');
    $zeilen = db()->alle('SELECT * FROM {p}leistung WHERE id IN (' . DB::liste($ids) . ')', $ids);
    $nach = array_column($zeilen, null, 'id');
    $aus = [];
    foreach ($ids as $id) {
        $l = $nach[$id] ?? null;
        if (!$l || !$l['aktiv'] || $l['salon_id'] !== $salon || ($online && !$l['online'])) {
            throw new Fehler('Diese Leistung ist hier nicht online buchbar.', 422, 'leistung', ['leistung' => $id]);
        }
        $l['phasen'] = json_decode($l['phasen'], true);
        $aus[] = $l;
    }
    return $aus;
}

/** Phasen mehrerer Leistungen hintereinander; gleiche Nachbarn verschmelzen. */
function phasen_verketten(array $leistungen): array
{
    $aus = [];
    foreach ($leistungen as $l) {
        foreach ($l['phasen'] as [$art, $min]) {
            $min = (int)$min;
            if ($min <= 0) continue;
            if ($aus && $aus[count($aus) - 1][0] === $art) $aus[count($aus) - 1][1] += $min;
            else $aus[] = [$art, $min];
        }
    }
    // Eine Einwirkzeit am Ende gehört nicht mehr zum Termin.
    while ($aus && $aus[count($aus) - 1][0] === 'pause') array_pop($aus);
    if (!$aus) throw new Fehler('Die Leistung hat keine Dauer.', 422);
    return $aus;
}

function phasen_pruefen(mixed $phasen): array
{
    if (!is_array($phasen) || !$phasen || count($phasen) > 12) throw new Fehler('Ablauf ungültig.', 422, 'phasen');
    $aus = [];
    foreach ($phasen as $p) {
        if (!is_array($p) || count($p) !== 2 || !in_array($p[0], ['arbeit', 'pause'], true)) throw new Fehler('Ablauf ungültig.', 422, 'phasen');
        $m = (int)$p[1];
        if ($m < 0 || $m > 720) throw new Fehler('Ablauf ungültig.', 422, 'phasen');
        if ($m > 0) $aus[] = [$p[0], $m];
    }
    return phasen_verketten([['phasen' => $aus]]);
}

function phasen_dauer(array $phasen): int
{
    return array_sum(array_column($phasen, 1));
}

/** Arbeitsabschnitte relativ zum Start: [[von, bis], …] in Minuten. */
function arbeit_abschnitte(array $phasen): array
{
    $t = 0;
    $aus = [];
    foreach ($phasen as [$art, $min]) {
        if ($art === 'arbeit') $aus[] = [$t, $t + $min];
        $t += $min;
    }
    return $aus;
}

/** Wer darf alle diese Leistungen machen? */
function personen_fuer(array $leistungen, bool $online, ?string $nur = null): array
{
    $ids = array_column($leistungen, 'id');
    $zeilen = db()->alle(
        'SELECT p.id, p.name, p.sort, COUNT(*) AS n FROM {p}person p
         JOIN {p}leistung_person lp ON lp.person_id = p.id
         WHERE p.aktiv = 1' . ($online ? ' AND p.online = 1' : '') . ' AND lp.leistung_id IN (' . DB::liste($ids) . ')
         GROUP BY p.id, p.name, p.sort ORDER BY p.sort', $ids);
    $aus = [];
    foreach ($zeilen as $z) {
        if ((int)$z['n'] === count($ids) && ($nur === null || $nur === $z['id'])) $aus[$z['id']] = $z;
    }
    return $aus;
}

/** Intervalle [a, b) zusammenführen. */
function intervalle_vereinen(array $iv): array
{
    usort($iv, fn($x, $y) => $x[0] <=> $y[0]);
    $aus = [];
    foreach ($iv as [$a, $b]) {
        if ($b <= $a) continue;
        if ($aus && $a <= $aus[count($aus) - 1][1]) $aus[count($aus) - 1][1] = max($aus[count($aus) - 1][1], $b);
        else $aus[] = [$a, $b];
    }
    return $aus;
}

/** Aus Fenstern die Sperren herausschneiden. */
function intervalle_abziehen(array $fenster, array $sperren): array
{
    $sperren = intervalle_vereinen($sperren);
    $aus = [];
    foreach ($fenster as [$a, $b]) {
        $teile = [[$a, $b]];
        foreach ($sperren as [$s, $e]) {
            $neu = [];
            foreach ($teile as [$x, $y]) {
                if ($e <= $x || $s >= $y) { $neu[] = [$x, $y]; continue; }
                if ($s > $x) $neu[] = [$x, $s];
                if ($e < $y) $neu[] = [$e, $y];
            }
            $teile = $neu;
        }
        array_push($aus, ...$teile);
    }
    return $aus;
}

/** Einen Zeitraum [von, bis) auf einen Tag in Minuten abbilden (oder null). */
function auf_tag(string $datum, string $von, string $bis): ?array
{
    $tagAnfang = "$datum 00:00:00";
    $tagEnde = tag_plus($datum, 1) . ' 00:00:00';
    if ($bis <= $tagAnfang || $von >= $tagEnde) return null;
    $a = $von <= $tagAnfang ? 0 : zeit_zu_min($von);
    $b = $bis >= $tagEnde ? 1440 : zeit_zu_min($bis);
    return $b > $a ? [$a, $b] : null;
}

/**
 * Tagespläne für Personen: je Person und Datum die Arbeitsfenster im Salon
 * (ohne Abwesenheiten) und die belegten Minuten (aus allen Salons).
 *   $plan[$person][$datum] = ['fenster' => [[a,b],…], 'belegt' => [[a,b,termin],…]]
 */
function tagesplaene(array $personen, string $salon, string $vonDatum, string $bisDatum, ?int $ohneTermin = null): array
{
    $db = db();
    $plan = [];
    if (!$personen) return $plan;
    $ids = array_values($personen);
    $in = DB::liste($ids);
    $zeiten = $db->alle("SELECT person_id, wochentag, von, bis FROM {p}arbeitszeit WHERE salon_id = ? AND person_id IN ($in)",
        array_merge([$salon], $ids));
    $bisZeit = tag_plus($bisDatum, 1) . ' 00:00:00';
    $vonZeit = "$vonDatum 00:00:00";
    $abw = $db->alle("SELECT person_id, salon_id, von, bis FROM {p}abwesenheit
        WHERE von < ? AND bis > ? AND (person_id IS NULL OR person_id IN ($in)) AND (salon_id IS NULL OR salon_id = ?)",
        array_merge([$bisZeit, $vonZeit], $ids, [$salon]));
    $bel = $db->alle("SELECT termin_id, person_id, start, ende FROM {p}belegung
        WHERE person_id IN ($in) AND start < ? AND ende > ?" . ($ohneTermin ? ' AND termin_id <> ?' : ''),
        array_merge($ids, [$bisZeit, $vonZeit], $ohneTermin ? [$ohneTermin] : []));
    $puffer = (int)einstellungen()['puffer'];

    for ($d = $vonDatum; $d <= $bisDatum; $d = tag_plus($d, 1)) {
        $wt = wochentag($d);
        foreach ($ids as $pid) {
            $fenster = [];
            foreach ($zeiten as $z) {
                if ($z['person_id'] === $pid && (int)$z['wochentag'] === $wt) $fenster[] = [(int)$z['von'], (int)$z['bis']];
            }
            $fenster = intervalle_vereinen($fenster);
            $sperren = [];
            foreach ($abw as $a) {
                if ($a['person_id'] !== null && $a['person_id'] !== $pid) continue;
                if ($iv = auf_tag($d, $a['von'], $a['bis'])) $sperren[] = $iv;
            }
            $belegt = [];
            foreach ($bel as $b) {
                if ($b['person_id'] !== $pid) continue;
                if ($iv = auf_tag($d, $b['start'], $b['ende'])) $belegt[] = [$iv[0], min(1440, $iv[1] + $puffer), (int)$b['termin_id']];
            }
            usort($belegt, fn($x, $y) => $x[0] <=> $y[0]);
            $plan[$pid][$d] = ['fenster' => intervalle_abziehen($fenster, $sperren), 'belegt' => $belegt];
        }
    }
    return $plan;
}

/** Passt ein Termin mit diesen Phasen um $t in den Tagesplan? */
function passt(array $tag, int $t, array $abschnitte, int $dauer, int $puffer): bool
{
    $ende = $t + $dauer;
    $imFenster = false;
    foreach ($tag['fenster'] as [$a, $b]) {
        if ($t >= $a && $ende <= $b) { $imFenster = true; break; }
    }
    if (!$imFenster) return false;
    $letzter = count($abschnitte) - 1;
    foreach ($abschnitte as $i => [$x, $y]) {
        $s = $t + $x;
        $e = $t + $y + ($i === $letzter ? $puffer : 0);
        foreach ($tag['belegt'] as [$ba, $bb]) {
            if ($ba >= $e) break;
            if ($bb > $s) return false;
        }
    }
    return true;
}

/** Wie gut schließt ein Termin an? Höher = weniger Lücken im Tag. */
function anschluss(array $tag, int $t, array $abschnitte): int
{
    $s = $t + $abschnitte[0][0];
    $e = $t + $abschnitte[count($abschnitte) - 1][1];
    $punkte = 0;
    foreach ($tag['belegt'] as [$ba, $bb]) {
        if ($bb === $s) $punkte += 2;
        if ($ba === $e) $punkte += 2;
    }
    foreach ($tag['fenster'] as [$a, $b]) {
        if ($a === $t) $punkte += 1;
        if ($b === $t + phasen_dauer_aus($abschnitte)) $punkte += 1;
    }
    return $punkte;
}

function phasen_dauer_aus(array $abschnitte): int
{
    return $abschnitte ? $abschnitte[count($abschnitte) - 1][1] : 0;
}

/**
 * Freie Startzeiten.
 * Rückgabe: [$datum => [$minute => [personId, …]], …], nur Tage mit Arbeit
 * tauchen mit leerem Array auf (geschlossen = fehlt).
 */
function freie_zeiten(string $salon, array $phasen, array $personIds, string $vonDatum, string $bisDatum, ?string $fruehestens = null, ?int $ohneTermin = null): array
{
    $e = einstellungen();
    $raster = max(5, (int)$e['raster']);
    $puffer = (int)$e['puffer'];
    $dauer = phasen_dauer($phasen);
    $abschnitte = arbeit_abschnitte($phasen);
    $plan = tagesplaene($personIds, $salon, $vonDatum, $bisDatum, $ohneTermin);
    $aus = [];
    for ($d = $vonDatum; $d <= $bisDatum; $d = tag_plus($d, 1)) {
        $ab = 0;
        if ($fruehestens !== null) {
            if ($fruehestens >= tag_plus($d, 1) . ' 00:00:00') continue;
            if (substr($fruehestens, 0, 10) === $d) $ab = zeit_zu_min($fruehestens);
        }
        $tag = [];
        $arbeitet = false;
        foreach ($personIds as $pid) {
            $tp = $plan[$pid][$d] ?? null;
            if (!$tp || !$tp['fenster']) continue;
            $arbeitet = true;
            $kandidaten = [];
            foreach ($tp['fenster'] as [$a, $b]) {
                $kandidaten[$a] = true;
                for ($t = (int)(ceil($a / $raster) * $raster); $t + $dauer <= $b; $t += $raster) $kandidaten[$t] = true;
            }
            if ($e['luecken_fuellen']) {
                foreach ($tp['belegt'] as [$ba, $bb]) $kandidaten[$bb] = true;
            }
            foreach (array_keys($kandidaten) as $t) {
                if ($t < $ab) continue;
                if (passt($tp, $t, $abschnitte, $dauer, $puffer)) $tag[$t][] = $pid;
            }
        }
        if (!$arbeitet) continue;
        ksort($tag);
        $aus[$d] = $tag;
    }
    return $aus;
}

/** Frühester online buchbarer Zeitpunkt (Vorlauf, aufs Raster gerundet). */
function online_fruehestens(): string
{
    $e = einstellungen();
    $raster = max(5, (int)$e['raster']);
    $t = time() + (int)$e['vorlauf'] * 60;
    $t = (int)(ceil($t / ($raster * 60)) * $raster * 60);
    return date('Y-m-d H:i:00', $t);
}

/** Aus mehreren freien Personen die wählen, bei der der Termin am besten anschließt. */
function beste_person(array $kandidaten, string $salon, string $datum, int $t, array $phasen): string
{
    if (count($kandidaten) === 1) return $kandidaten[0];
    $plan = tagesplaene($kandidaten, $salon, $datum, $datum);
    $abschnitte = arbeit_abschnitte($phasen);
    $sort = [];
    $reihung = db()->alle('SELECT id, sort FROM {p}person WHERE id IN (' . DB::liste($kandidaten) . ')', $kandidaten);
    $reihung = array_column($reihung, 'sort', 'id');
    foreach ($kandidaten as $pid) {
        $tp = $plan[$pid][$datum];
        $belegtMin = array_sum(array_map(fn($b) => $b[1] - $b[0], $tp['belegt']));
        // Anschluss zuerst (weniger Lücken), dann die weniger Ausgelastete.
        $sort[$pid] = [-anschluss($tp, $t, $abschnitte), $belegtMin, (int)($reihung[$pid] ?? 99)];
    }
    uasort($sort, fn($a, $b) => $a <=> $b);
    return (string)array_key_first($sort);
}

/**
 * Konflikte eines Termins (fürs Studio): andere Termine in der Arbeitszeit,
 * Abwesenheiten, außerhalb der Arbeitszeit. Leere Liste = passt.
 */
function konflikte(string $person, string $salon, string $start, array $phasen, ?int $ohneTermin = null): array
{
    $datum = substr($start, 0, 10);
    $t = zeit_zu_min($start);
    $dauer = phasen_dauer($phasen);
    $abschnitte = arbeit_abschnitte($phasen);
    $aus = [];
    $plan = tagesplaene([$person], $salon, $datum, $datum, $ohneTermin)[$person][$datum];
    $ende = $t + $dauer;
    $imFenster = false;
    foreach ($plan['fenster'] as [$a, $b]) if ($t >= $a && $ende <= $b) $imFenster = true;
    $puffer = (int)einstellungen()['puffer'];
    $gesehen = [];
    foreach ($abschnitte as [$x, $y]) {
        foreach ($plan['belegt'] as [$ba, $bb, $tid]) {
            if ($ba < $t + $y && $bb - $puffer > $t + $x && !isset($gesehen[$tid])) {
                $gesehen[$tid] = true;
                $aus[] = ['art' => 'termin', 'termin_id' => $tid];
            }
        }
    }
    if (!$imFenster) {
        $abw = db()->wert('SELECT COUNT(*) FROM {p}abwesenheit WHERE von < ? AND bis > ? AND (person_id IS NULL OR person_id = ?) AND (salon_id IS NULL OR salon_id = ?)',
            [zeit_plus($start, $dauer), $start, $person, $salon]);
        $aus[] = ['art' => $abw ? 'abwesend' : 'ausserhalb'];
    }
    return $aus;
}

/** Belegung eines Termins neu schreiben (nach Anlegen, Verschieben, Status). */
function belegung_schreiben(int $termin, string $person, string $start, array $phasen, string $status): void
{
    $db = db();
    $db->q('DELETE FROM {p}belegung WHERE termin_id = ?', [$termin]);
    if (in_array($status, ['storniert'], true)) return;
    foreach (arbeit_abschnitte($phasen) as [$x, $y]) {
        $db->einfuegen('belegung', ['termin_id' => $termin, 'person_id' => $person,
            'start' => zeit_plus($start, $x), 'ende' => zeit_plus($start, $y)]);
    }
}

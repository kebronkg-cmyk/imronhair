<?php
/* Tabellen ansehen — nur für die Vorführung ('demo' => true in api/config.php).
   Zeigt jede Tabelle mit ihren Spalten und den letzten Zeilen, nur lesend.
   Zugangsschlüssel und Passwort-Hashes werden nie angezeigt. */

declare(strict_types=1);

require __DIR__ . '/../api/lib/basis.php';

if (konfig('demo') !== true) { http_response_code(404); exit; }

$db = db();
$p = $db->p;
$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$geheim = ['pass_hash', 'token', 'token_hash', 'csrf', 'anfrage_id'];
$tabellen = $db->treiber === 'sqlite'
    ? array_column($db->alle("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ? ORDER BY name", [$p . '%']), 'name')
    : array_column($db->alle('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE ? ORDER BY table_name', [$p . '%']), 'name');
$wahl = in_array($_GET['t'] ?? '', $tabellen, true) ? $_GET['t'] : ($p . 'termin');
$beschreibung = [
    'termin' => 'Jeder Termin: Beginn und Ende (Ortszeit und UTC), Person, Status, Quelle, Version.',
    'belegung' => 'Wann eine Person wirklich arbeitet — ohne Einwirkzeit. Daran wird „frei?“ geprüft.',
    'kunde' => 'Kundenkartei; Telefon einheitlich als +49…',
    'protokoll' => 'Wer hat wann was geändert — mit vorher und nachher.',
    'einwilligung' => 'Einwilligungen mit Zeitpunkt, Quelle und genauem Wortlaut.',
    'termin_posten' => 'Die Leistungen eines Termins mit Preis zum Buchungszeitpunkt.',
    'leistung' => 'Katalog: Leistungen mit Ablauf (Arbeit, Einwirkzeit) und Preis.',
    'person' => 'Team und Zugänge (Passwörter nur als Hash, hier ausgeblendet).',
    'arbeitszeit' => 'Arbeitszeiten je Person, Salon und Wochentag (Minuten ab Mitternacht).',
    'abwesenheit' => 'Urlaub, Krankheit, Pausen, Schließtage.',
    'salon' => 'Die Salons mit Öffnungszeiten.',
];
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Tabellen — Vorführung</title>
<script>
  // Dieselbe Wahl wie im Studio (Dunkel, Off-White, wie das Gerät).
  try {
    var w = localStorage.getItem('studio-thema') || 'dunkel';
    if (w === 'auto') w = matchMedia('(prefers-color-scheme: light)').matches ? 'hell' : 'dunkel';
    document.documentElement.dataset.thema = w;
  } catch (e) {}
</script>
<style>
  :root { color-scheme: dark; --grund: oklch(14.5% .008 55); --flaeche: oklch(17.5% .01 55); --linie: oklch(92% .02 80 / .16);
          --tinte: oklch(94% .014 85); --leise: oklch(74% .02 80); --gold: oklch(83% .095 84); --kante: oklch(85% .1 84); }
  :root[data-thema="hell"] { color-scheme: light; --grund: oklch(96.5% .008 85); --flaeche: oklch(93.5% .011 82); --linie: oklch(30% .02 60 / .14);
          --tinte: oklch(24% .02 55); --leise: oklch(47% .022 65); --gold: oklch(46% .09 66); --kante: oklch(62% .11 72); }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: var(--grund); color: var(--tinte); font: 15px/1.45 system-ui, sans-serif; }
  h1 { font-weight: 400; letter-spacing: .04em; margin: 0 0 4px; }
  p { color: var(--leise); margin: 0 0 16px; }
  nav { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
  nav a { padding: 8px 12px; border: 1px solid var(--linie); border-radius: 3px; color: var(--leise); text-decoration: none; }
  nav a[aria-current] { border-color: var(--kante); color: var(--tinte); }
  .kopf { display: flex; justify-content: space-between; align-items: start; gap: 12px; flex-wrap: wrap; }
  .umschalter { padding: 8px 14px; border: 1px solid var(--linie); border-radius: 3px; background: none; color: var(--tinte); font: inherit; cursor: pointer; }
  .umschalter:focus-visible { outline: 2px solid var(--kante); outline-offset: 2px; }
  nav a:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .rahmen { overflow-x: auto; border: 1px solid var(--linie); border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { padding: 6px 10px; border-bottom: 1px solid var(--linie); text-align: left; vertical-align: top; white-space: nowrap; }
  th { background: var(--flaeche); color: var(--gold); font-weight: 500; position: sticky; top: 0; }
  td.lang { white-space: normal; min-width: 18rem; }
  .spalten { color: var(--leise); font-size: 13px; margin: 0 0 12px; }
</style>
</head>
<body>
<div class="kopf">
  <h1>Tabellen</h1>
  <button class="umschalter" type="button" id="umschalter"></button>
</div>
<p>Nur lesend, nur in der Vorführung. Ändern geht ausschließlich über das Studio — sonst greift der Schutz vor Doppelbuchungen nicht.</p>
<nav aria-label="Tabellen">
<?php foreach ($tabellen as $t): $n = (int)$db->wert("SELECT COUNT(*) FROM `$t`"); ?>
  <a href="?t=<?= $e($t) ?>"<?= $t === $wahl ? ' aria-current="page"' : '' ?>><?= $e(substr($t, strlen($p))) ?> · <?= $n ?></a>
<?php endforeach; ?>
</nav>
<?php
$kurz = substr($wahl, strlen($p));
$spalten = $db->treiber === 'sqlite'
    ? array_column($db->alle("PRAGMA table_info(`$wahl`)"), 'name')
    : array_column($db->alle("SHOW COLUMNS FROM `$wahl`"), 'Field');
$sichtbar = array_values(array_diff($spalten, $geheim));
$ordnung = in_array('id', $spalten, true) ? 'id' : $spalten[0];
$zeilen = $db->alle("SELECT * FROM `$wahl` ORDER BY `$ordnung` DESC LIMIT 40");
?>
<h2><?= $e($kurz) ?></h2>
<p><?= $e($beschreibung[$kurz] ?? '') ?></p>
<p class="spalten">Spalten: <?= $e(implode(', ', $spalten)) ?><?= array_intersect($spalten, $geheim) ? ' (Schlüssel und Hashes ausgeblendet)' : '' ?> — die letzten <?= count($zeilen) ?> Zeilen:</p>
<div class="rahmen">
<table>
  <thead><tr><?php foreach ($sichtbar as $s): ?><th scope="col"><?= $e($s) ?></th><?php endforeach; ?></tr></thead>
  <tbody>
  <?php foreach ($zeilen as $z): ?>
    <tr><?php foreach ($sichtbar as $s): $w = $z[$s]; ?><td<?= is_string($w) && strlen($w) > 60 ? ' class="lang"' : '' ?>><?= $w === null ? '<span style="color:var(--leise)">—</span>' : $e($w) ?></td><?php endforeach; ?></tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>
<script>
  const knopf = document.getElementById('umschalter');
  const beschriften = () => { knopf.textContent = document.documentElement.dataset.thema === 'hell' ? 'Dunkler Modus' : 'Off-White-Modus'; };
  knopf.addEventListener('click', () => {
    const neu = document.documentElement.dataset.thema === 'hell' ? 'dunkel' : 'hell';
    document.documentElement.dataset.thema = neu;
    try { localStorage.setItem('studio-thema', neu); } catch (e) {}
    beschriften();
  });
  beschriften();
</script>
</body>
</html>

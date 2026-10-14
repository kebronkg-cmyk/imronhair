<?php
/* Nur für die Prüfskripte, nur auf der Kommandozeile: eine SQL-Anweisung
   gegen die Test-Datenbank (SQLite) aus IRMONHAIR_KONFIG. Über den
   Webserver aufgerufen, antwortet die Datei mit 404. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$k = require getenv('IRMONHAIR_KONFIG');
if (($k['db']['treiber'] ?? '') !== 'sqlite') { fwrite(STDERR, "Nur SQLite.\n"); exit(1); }
$pdo = new PDO('sqlite:' . $k['db']['pfad'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('PRAGMA busy_timeout = 10000');
$st = $pdo->prepare(str_replace('{p}', $k['db']['praefix'] ?? 'ih_', $argv[1]));
$st->execute(array_slice($argv, 2));
echo json_encode($st->columnCount() ? $st->fetchAll(PDO::FETCH_ASSOC) : ['geaendert' => $st->rowCount()]);

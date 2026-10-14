#!/usr/bin/env bash
# Vorführung starten: legt beim ersten Mal eine Test-Konfiguration (SQLite)
# und Beispieltermine an, dann läuft der Server, bis das Fenster zugeht.
# Echte Kundendaten gehören hier nicht hinein.
set -euo pipefail
cd "$(dirname "$0")/.."

ADRESSE="http://localhost:8000"
if [ -n "${CODESPACE_NAME:-}" ]; then
  ADRESSE="https://${CODESPACE_NAME}-8000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi

if [ ! -f api/config.php ]; then
  cat > api/config.php <<PHP
<?php
// Nur für die Vorführung (von demo/starten.sh angelegt).
return [
    'db' => ['treiber' => 'sqlite', 'pfad' => __DIR__ . '/daten/vorfuehrung.sqlite'],
    'einrichtungs_schluessel' => '$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')',
    'cron_schluessel' => 'vorfuehrung',
    'buchung_adresse' => '${ADRESSE}/termin.html',
    'post' => ['aktiv' => false],
    'demo' => true,
];
PHP
fi

php demo/beispieldaten.php

cat <<TEXT

  ────────────────────────────────────────────────────────────
  Irmonhair — Vorführung läuft

  Website:              ${ADRESSE}/
  Buchung (Kundin):     ${ADRESSE}/termin.html
  Studio (Mitarbeiter): ${ADRESSE}/studio/
      Inhaberin  demo     / demo-passwort
      Rezeption  empfang  / empfang-passwort
      Team       tina     / tina-passwort
  Tabellen ansehen:     ${ADRESSE}/demo/tabellen.php

  Neu anfangen: Fenster schließen, api/daten/vorfuehrung.sqlite
  löschen, demo/starten.sh erneut starten.
  ────────────────────────────────────────────────────────────

TEXT
exec php -S 0.0.0.0:8000 demo/router.php

# Umzug der Domain irmonhair-muenchen.de auf die neue Website

Stand 04.10.2026. Diese Datei bleibt im Repo und wird nicht veröffentlicht.

Vorbereitet ist alles, was im Repo geht: Die Website läuft auf GitHub
Pages, die Adressen der früheren Seite (`/unsere-preise/`,
`/ueberblick-leistungen/`, `/frauen-herrenhaarschnitte/`, `/impressum/`,
`/datenschutz/`, `/danke/`) leiten auf die passenden neuen Seiten weiter.
Offen sind nur die Schritte beim Domain-Anbieter und ein Feld bei GitHub.

## Heute: wo die Domain liegt

- Verwaltet von **RegioHelden GmbH** (Marke „Ströer Online Marketing“),
  Rotebühlstraße 50, 70178 Stuttgart, 0711 128 501 100,
  info@stroeer-online-marketing.de. Registriert über INWX.
- Website: Ströer-Server `116.202.71.53` (WordPress).
- E-Mail: **Google Workspace** — bleibt, nur die Einträge werden übernommen.

## Reihenfolge

1. **Neuen Domain-Anbieter wählen** (INWX, IONOS, Strato, All-Inkl …),
   Konto auf die **Irmonhair GmbH**.
2. **Auth-Code bei RegioHelden anfordern** — Mail von der
   Geschäftsführerin; Domaininhaber muss die Irmonhair GmbH sein.
3. **Auth-Code beim neuen Anbieter eingeben**, Umzug starten.
4. **DNS beim neuen Anbieter eintragen** (Tabelle unten) — sofort beim
   Umzug, damit E-Mail und Website ohne Lücke weiterlaufen.
5. **GitHub umschalten** (Abschnitt unten).
6. **Prüfen** (Abschnitt unten).
7. **Erst dann RegioHelden kündigen.** Vertragsende nach dem Umzug.
8. Google-Unternehmensprofil und Planity-Profil: Website-Link prüfen
   (bleibt `https://www.irmonhair-muenchen.de/`, nichts zu ändern, wenn
   der Umzug geklappt hat).

## DNS-Einträge beim neuen Anbieter

**E-Mail (übernehmen, wie heute):**

| Name | Typ | Wert |
|---|---|---|
| @ | MX | 1 `aspmx.l.google.com` |
| @ | MX | 5 `alt1.aspmx.l.google.com` |
| @ | MX | 5 `alt2.aspmx.l.google.com` |
| @ | MX | 10 `alt3.aspmx.l.google.com` |
| @ | MX | 10 `alt4.aspmx.l.google.com` |
| @ | TXT | `v=spf1 include:_spf.google.com ~all` |
| _dmarc | TXT | `v=DMARC1; p=quarantine; sp=none; aspf=r; pct=100` |

Falls in der Google-Workspace-Verwaltung unter „E-Mail authentifizieren“
ein DKIM-Schlüssel steht (`google._domainkey`), diesen ebenfalls eintragen.

**Website (neu, auf GitHub Pages):**

| Name | Typ | Wert |
|---|---|---|
| @ | A | `185.199.108.153` |
| @ | A | `185.199.109.153` |
| @ | A | `185.199.110.153` |
| @ | A | `185.199.111.153` |
| @ | AAAA | `2606:50c0:8000::153` |
| @ | AAAA | `2606:50c0:8001::153` |
| @ | AAAA | `2606:50c0:8002::153` |
| @ | AAAA | `2606:50c0:8003::153` |
| www | CNAME | `kebronkg-cmyk.github.io` |

Den alten A-Eintrag `116.202.71.53` löschen.

## GitHub umschalten (erst wenn die DNS-Einträge stehen)

Vorher **nicht** — sobald die Domain bei GitHub eingetragen ist, leitet
`kebronkg-cmyk.github.io/imronhair/` auf irmonhair-muenchen.de um, und dort
stünde bis zum Umzug noch die alte Seite.

1. Optional, aber empfohlen (schützt vor Übernahme der Domain durch
   Fremde): GitHub → Profilbild → **Settings → Pages → Add a domain** →
   `irmonhair-muenchen.de`. GitHub zeigt einen TXT-Eintrag
   (`_github-pages-challenge-kebronkg-cmyk`), den beim Domain-Anbieter
   eintragen und auf „Verify“ klicken.
2. Repo **imronhair → Settings → Pages → Custom domain**:
   `www.irmonhair-muenchen.de` eintragen, **Save**.
3. Warten, bis „DNS check successful“ erscheint (Minuten bis eine Stunde),
   dann **Enforce HTTPS** anhaken. Das Zertifikat kann bis zu einem Tag
   brauchen; meist unter einer Stunde.

GitHub leitet `irmonhair-muenchen.de` ohne www automatisch auf die
www-Adresse um.

## Prüfen nach dem Umzug

- `https://www.irmonhair-muenchen.de/` → zeigt die neue Seite (Fenster).
- `https://irmonhair-muenchen.de/` → leitet auf www um.
- `https://www.irmonhair-muenchen.de/unsere-preise/` → Preisliste.
- `https://www.irmonhair-muenchen.de/impressum/` → neues Impressum.
- Eine Test-Mail an eine Adresse @irmonhair-muenchen.de schicken und
  beantworten.
- Schlosssymbol im Browser (HTTPS) ohne Warnung.

## Wenn etwas schiefgeht

- Website zeigt Fehler 404 von GitHub: Custom domain in den
  Pages-Einstellungen prüfen (Schritt 2).
- Zertifikatswarnung: „Enforce HTTPS“ erst anhaken, wenn GitHub das
  Zertifikat ausgestellt hat; notfalls Domain einmal entfernen und neu
  eintragen.
- E-Mails kommen nicht an: MX-Einträge mit der Tabelle oben vergleichen.
- Zurück zur alten Seite (Notfall): A-Eintrag wieder auf `116.202.71.53`,
  solange der Vertrag mit RegioHelden noch läuft.

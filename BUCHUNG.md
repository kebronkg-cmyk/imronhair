# Terminbuchung und Studio — Einrichtung und Betrieb

Eigene Online-Buchung für beide Salons, dazu das **Studio**: der
Kalender und die Kartei für den Salon. Was gegenüber der Spezifikation
geprüft und geschlossen wurde, steht in `BUCHUNG-ABGLEICH.md`. Läuft auf jedem gewöhnlichen
Webspace mit PHP — gebaut und geprüft für **All-Inkl** (PHP 8, MySQL).
Keine Abhängigkeiten, kein Build, keine fremden Dienste.

| Adresse | Was |
|---|---|
| `termin.html` | Online-Buchung für Kundinnen |
| `termin.html?t=…` | Termin ansehen, verschieben, absagen (Link aus der Bestätigung) |
| `termin.html?vorschau` | Vorschau mit ausgedachten Terminen — bucht nichts, braucht keinen Server |
| `studio/` | Studio: Kalender, Kunden, Team, Leistungen, Auswertung, Einstellungen |
| `api/` | Schnittstelle (PHP); Daten in MySQL oder einer SQLite-Datei |

Auf GitHub Pages läuft kein PHP. Dort zeigt `termin.html` die
Rückfallebene (Telefon und Planity) und `?vorschau` die Buchung zum
Ansehen. Echt gebucht wird erst auf dem eigenen Webspace.

## Einrichten bei All-Inkl (einmalig, etwa 20 Minuten)

1. **Datenbank anlegen:** KAS → *Datenbanken* → *Neue Datenbank*.
   Name, Benutzer und Passwort notieren.
2. **Dateien hochladen** (FTP oder KAS-Dateimanager) in das Verzeichnis
   der Domain: die Website aus dem Hauptordner (`*.html`, `*.css`,
   `*.js`, `logo-*.svg`, `bilder/`, `schrift/`) sowie `api/` und `studio/`.
   Die älteren Fassungen (`spiegel/`, `alt/`, …) nur, wenn sie dort auch
   erreichbar sein sollen.
3. **`api/config.beispiel.php` als `api/config.php` kopieren** und
   ausfüllen:
   - `db`: die Zugangsdaten aus Schritt 1 (`treiber` bleibt `mysql`);
   - `einrichtungs_schluessel` und `cron_schluessel`: je eine lange
     Zufallsfolge (Passwortgenerator, 24 Zeichen);
   - `alarm_an`: wer einen Alarm bekommt, falls der nächtliche
     Selbstcheck je eine Überschneidung findet;
   - `buchung_adresse`: die volle Adresse von `termin.html`;
   - `post`: `aktiv => true`, wenn Bestätigungen per E-Mail gehen sollen.
     Die Absenderadresse muss als Postfach bei All-Inkl existieren
     (KAS → *E-Mail* → *Postfach anlegen*). Unter `salon_an` stehen die
     Adressen, die bei Online-Buchungen und -Absagen Bescheid bekommen.
4. **PHP-Version** in KAS → *Domain* → *PHP-Version* auf 8.1 oder neuer
   stellen (8.3 empfohlen).
5. **Studio öffnen:** `https://…/studio/`. Beim ersten Aufruf legt die
   Schnittstelle die Tabellen an und übernimmt Team, Leistungen, Preise,
   Dauern und Einwirkzeiten aus Planity (`api/katalog.json`). Dann
   „Einrichten“: Inhaberin wählen, Anmeldename und Passwort festlegen,
   Einrichtungsschlüssel aus `config.php` eintragen.
6. **Team:** unter *Team* für jede Person die echten Arbeitszeiten je
   Salon eintragen (vorläufig stehen dort die Öffnungszeiten) und einen
   Zugang anlegen (Anmeldename + Passwort), wer das Studio nutzen soll.
7. **Cronjobs** (KAS → *Tools* → *Cronjobs*):
   - alle 15 Minuten `https://…/api/?a=nachrichten&schluessel=<cron_schluessel>`
     — Erinnerung am Vortag (E-Mail, SMS nach Regel), einmal am Tag ab
     9 Uhr der Recall, die Warteliste, der Versand der Warteschlange und
     am Monatsanfang der Monatsbericht. (Ein alter Cronjob auf
     `?a=erinnern` tut dasselbe.)
   - nachts (z. B. 3:10 Uhr) `https://…/api/?a=selbstcheck&schluessel=<cron_schluessel>`
     — sucht Überschneidungen und Termine an Schließtagen, schickt bei
     einem Fund sofort eine Mail an `alarm_an`. Erwartet: nie.
   - **Überwachung:** `https://…/api/?a=gesund` bei einem Uptime-Dienst
     (z. B. UptimeRobot, kostenlos) mit Alarm aufs Handy eintragen.
8. **Prüfen:** in `termin.html` einen Termin buchen, im Studio
   ansehen, über den Link aus der Bestätigung wieder absagen.

Ohne MySQL geht es auch mit SQLite (eine Datei, keine Einrichtung):
in `config.php` den zweiten `db`-Eintrag nehmen. Der Ordner `api/daten/`
ist per `.htaccess` gesperrt.

Liegt die Buchungsseite auf einer anderen Adresse als die Schnittstelle,
deren Herkunft unter `erlaubte_herkunft` eintragen und in
`termin.html` die Zeile `<meta name="irmonhair-api" …>` auf die
volle Adresse der Schnittstelle setzen.

## Nachrichten: SMS, WhatsApp, E-Mail

Alles, was das System von selbst schickt, läuft über eine Warteschlange
(`{p}nachricht`) und steht im Studio unter **Nachrichten → Postausgang**
mit Text, Status und Kosten. Ohne SMS-Anbieter läuft alles per E-Mail,
soweit eine Adresse da ist.

| Nachricht | Wann | Weg | Bedingung |
|---|---|---|---|
| Bestätigung, Änderung, Absage | sofort | E-Mail | Adresse angegeben |
| Erinnerung | am Vortag (20–28 h vorher) | E-Mail | Adresse angegeben |
| Erinnerung | am Vortag | SMS oder WhatsApp | Einwilligung „Terminnachrichten“ **und** Termin ab 80 € (einstellbar), früheres Nichterscheinen, Buchung am Telefon/vor Ort oder keine E-Mail |
| Recall | wenn fällig, ohne Folgetermin | SMS, sonst E-Mail | Einwilligung „Recall“; eine Nachricht, nach 7 Tagen eine Nachfrage, dann Schluss |
| Warteliste | sobald ein passender Platz frei wird | SMS, sonst E-Mail | Eintrag auf der Warteliste; bis zu drei zugleich, wer zuerst tippt, bekommt ihn |
| Kampagne | von Hand im Studio | SMS oder E-Mail | Einwilligung „Angebote“, per Link bestätigt; höchstens eine im Monat |
| Bestätigungslink Angebote | sofort | E-Mail, sonst SMS | Haken „Angebote“ gesetzt |

- **Ruhezeiten:** Recall, Kampagne und Warteliste nur zwischen 9 und
  20 Uhr, nicht sonntags und feiertags (Einstellungen → Nachrichten).
- **STOP:** wirkt sofort und für alles auf dieser Nummer; was noch in der
  Warteschlange liegt, geht nicht mehr raus (vor jedem Versand wird neu
  geprüft). Jede werbende SMS endet mit „Abmelden: STOP“. Jede werbende
  E-Mail hat den Link „Ihre Nachrichten“ (`nachrichten.html?k=…`, signiert)
  und Abmelden mit einem Klick im Mailprogramm (RFC 8058).
- **Nie doppelt:** Jeder Anlass hat einen eindeutigen Schlüssel; zwei
  gleichzeitige Cronläufe senden dieselbe Nachricht nicht zweimal.
- **SMS-Länge:** Die Vorlagen bleiben mit Link unter 160 Zeichen. Sie
  sind im Studio änderbar (Nachrichten → Vorlagen); dort steht die
  Länge dabei. Gedankenstriche werden vor dem Versand geglättet.

### SMS einrichten (seven.io)

1. Konto bei seven.io anlegen, Guthaben aufladen, API-Schlüssel kopieren.
2. Eine Nummer mit Eingang mieten (für STOP-Antworten) und als
   Webhook für eingehende SMS
   `https://…/api/?a=sms_eingang&schluessel=<eingang_schluessel>`
   eintragen.
3. In `config.php` unter `sms`: `aktiv => true`, Schlüssel, Absender
   (diese Nummer), `eingang_schluessel`.
4. Im Studio unter Nachrichten → Kampagne einen Test an die eigene
   Nummer schicken. Antwort „STOP“ → die Nummer steht unter „Abgemeldet“.
5. AVV mit seven.io abschließen und in der Datenschutzerklärung
   (Abschnitt 5, „Versand von SMS“) den Namen nachtragen.

## Recall, Warteliste, Gutscheine, Lager

- **Recall-Abstand** je Leistung unter *Leistungen* (vorbelegt: Herren 5,
  Damen 7, Ansatz 6, Balayage 11 Wochen, Keratin 15 Wochen). Hat eine
  Kundin ab drei Besuchen einen eigenen, plausiblen Rhythmus, gilt der.
  Der Link `termin.html?r=…` öffnet die Buchung mit der Auswahl von
  damals; Buchungen darüber zählen als „zurückgeholt“ (Monatsbericht,
  Abrechnung je Zurückgeholter mit Monatsdeckel, Einstellungen).
- **Warteliste:** online („Nichts Passendes?“ unter den Uhrzeiten) oder
  im Studio. Absage, Verschieben oder gelöschte Sperre lösen sofort die
  Suche aus. Der Link `termin.html?w=…` bucht mit einem Tipp; derselbe
  Link zweimal ergibt denselben Termin, für alle anderen verfällt er.
- **Gutscheine** (Verkauf → Gutscheine): Code `IH-XXXX-XXXX`, Restwert,
  teilweise Einlösung, Druckkarte, drei Jahre zum Jahresende gültig.
  **Aktionscodes** (`HERBST10`): Prozent oder Betrag, Zeitraum, Höchstzahl,
  „nur erster Besuch“ — geprüft in derselben Sperre wie die Buchung.
  Bezahlt wird weiter an der Kasse.
- **Treuekarte** (Einstellungen): jeder Besuch ein Stempel, Prämie nach n
  Besuchen, eingelöst in der Kundenkarte.
- **Fotos** in der Kundenkarte: nur mit Einverständnis; im Browser auf
  1600 px verkleinert und als JPEG neu gespeichert (Ort und Kamera sind
  dann weg); abgelegt in `api/daten/fotos/` (von außen gesperrt).
- **Lager** (Verkauf → Lager): Bestand, Mindestbestand, Eingang, Verkauf,
  Verbrauch, Inventur, Handscanner wie Tastatur.
- **Steuerkanzlei** (Einstellungen): Umsatzliste (CSV) und
  DATEV-Buchungsstapel (EXTF 700, Windows-1252, je Tag und Salon „Kasse
  an Erlöse“). Aus den Terminpreisen, nicht aus der Kasse — einmal mit
  der Kanzlei testen.
- **Kunden übernehmen** (Einstellungen): CSV aus Planity oder einem
  anderen Programm; Spalten werden erkannt (auch französisch/englisch),
  erst Vorschau, dann Übernahme. Vorhandene werden nur ergänzt;
  Einwilligungen werden nicht übernommen.

## Wichtig vor dem Umschalten

- **Planity und die eigene Buchung nicht parallel offen lassen.** Beide
  Systeme wissen nichts voneinander; ein Termin bei Planity blockiert die
  eigene Buchung nicht (und umgekehrt). Entweder bei Planity die
  Online-Buchung schließen, sobald die eigene läuft, oder die kommenden
  Planity-Termine einmalig im Studio eintragen und Planity dann schließen.
- Die Datenschutzerklärung nennt noch GitHub Pages als Hoster (Abschnitt 2).
  Beim Umzug auf All-Inkl dort All-Inkl eintragen und mit All-Inkl den
  Vertrag zur Auftragsverarbeitung abschließen (im KAS abrufbar).

## So funktioniert es

**Freie Zeiten.** Eine Leistung ist eine Folge von Phasen — Arbeit,
Einwirkzeit, Arbeit, Puffer (aus Planity übernommen, im Studio änderbar,
alles in Fünf-Minuten-Schritten). Belegt ist eine Person während Arbeit
und Puffer; in der Einwirkzeit kann sie eine andere Kundin bedienen.
Buchbar ist nur, was in die Öffnungszeit des Salons **und** die
Arbeitszeit der Person fällt — gesetzliche Feiertage (Bayern),
Schließtage, Urlaub und Pausen blocken hart. In der Stunde der
Zeitumstellung gibt es keine Termine. Angeboten werden die Startzeiten im
Raster (Vorgabe 15 Minuten) und zusätzlich die Minute direkt nach einem
Termin („Lücken füllen“), damit keine Viertelstunden verloren gehen.
Bei „wer zuerst frei ist“ bekommt die Person den Termin, bei der er am
besten an einen anderen anschließt.

**Keine Doppelbuchung.** Eine einzige Funktion legt Termine an und
verschiebt sie: `bucheTermin()` in `api/lib/termine.php` — für online,
Telefon und Kasse. Sie sperrt in einer Transaktion die betroffenen
Personen (MySQL: `SELECT … FOR UPDATE`, SQLite: `BEGIN IMMEDIATE`),
prüft die Belegung neu und trägt ein; bestätigt wird erst nach dem
COMMIT. Gleichzeitige Anfragen warten aufeinander; die zweite bekommt
„gerade vergeben“ und drei Ausweichzeiten. Ein doppelt abgeschicktes
Formular ergibt denselben Termin (Anfrage-Kennung); bleibt die Antwort
aus, fragt die Seite nach, statt die Kundin raten zu lassen. Wer in zwei
Salons arbeitet, ist über beide hinweg nur einmal belegbar. Im Studio
gibt es kein „trotzdem“ für Überschneidungen.

**Verschieben** ist eine eigene Handlung: derselbe Termin, gleicher Link,
neue Zeit. Der alte Platz wird erst frei, wenn der neue sicher gebucht
ist. Die Kundin bekommt eine neue Bestätigung mit „vorher → jetzt“ —
auch, wenn der Salon im Studio verschiebt oder umbesetzt. Eine gewählte
Person bleibt verbindlich.

**Zustände:** gebucht → erschienen | nicht erschienen | abgesagt von der
Kundin | abgesagt vom Salon (nur mit Grund, die Kundin wird informiert).
Nichts wird gelöscht; jede Änderung steht mit Verursacher (Kundin,
Mitarbeiterin, System) und vorher/nachher im Protokoll.

**Gleichzeitig im Studio.** Jeder Termin hat eine Version. Ändern zwei
Geräte denselben Termin, gewinnt das erste; das zweite bekommt den neuen
Stand gezeigt statt ihn zu überschreiben. Alle Geräte fragen alle 20
Sekunden einen Änderungszähler ab und laden nach, wenn sich etwas getan
hat.

**Kundendaten.** Telefonnummern werden einheitlich als `+49…` gespeichert
(„0176 …“, „+49 (0) 176 …“, „0049 …“ ergeben dieselbe Nummer); daran
erkennt die Buchung Stammkundinnen. E-Mail-Adressen klein und geprüft.
Doppelte Karten meldet das Studio und führt sie zusammen. Löschen nach
DSGVO entfernt Name, Nummer, E-Mail und Notizen; die Termine bleiben
ohne Namen für die Buchhaltung. „Auskunft“ lädt alles zu einer Person
als Datei.

**Sicherheit.** Passwörter nur als Hash, Sitzungen als Zufallsschlüssel
im Cookie (HttpOnly, SameSite=Strict), jede Änderung braucht zusätzlich
den CSRF-Schlüssel der Sitzung. Mengenbremsen gegen Durchprobieren
(Anmeldung) und Massenbuchungen, eine Falle für Formular-Roboter, höchstens
drei offene Online-Termine je Nummer. Rollen: *Inhaberin* (alles),
*Rezeption* (dazu salonweite Schließtage und Export) und *Team*
(Kalender und Kunden). Jede Änderung steht im Protokoll.

**Sicherung und Export.** Einstellungen → *Export* lädt Termine, Kunden,
Protokoll und Einwilligungen als CSV (Excel-tauglich); *Sicherung
herunterladen* speichert alles als JSON (ohne Passwörter). Zusätzlich sichert All-Inkl die Datenbank
täglich (KAS → *Datenbanken* → *Backups*).

## Dateien

| Datei | Inhalt |
|---|---|
| `api/index.php` | Verteiler: welche Aktion, öffentlich oder Studio |
| `api/lib/basis.php` | Einstellungen, Datenbankschicht, Transaktionen, Zeit, Telefon/E-Mail |
| `api/lib/schema.php` | Tabellen (MySQL und SQLite), Erstbefüllung aus `katalog.json` |
| `api/lib/planer.php` | Freie Zeiten, Einwirkzeit, Überschneidungen, Belegung |
| `api/lib/termine.php` | `bucheTermin()` (einzige Stelle für Anlegen und Verschieben), Ändern, Kunden, Einwilligungen |
| `api/lib/oeffentlich.php` | Online-Buchung: Katalog, frei, buchen, verschieben, anfrage, ansehen, absagen, gesund |
| `api/lib/studio.php` | Studio: Anmeldung, Kalender, Kunden, Team, Leistungen, Auswertung |
| `api/lib/post.php` | E-Mails mit Kalenderdatei („vorher → jetzt“ bei Änderungen), Selbstcheck per Cronjob |
| `api/lib/nachrichten.php` | Warteschlange, SMS (seven.io), WhatsApp, STOP, Vorlagen, Erinnerung, Recall, Warteliste, Monatsbericht, Cron `nachrichten` |
| `api/lib/verkauf.php` | Gutscheine, Aktionscodes, Treue (gemeinsam für Buchung und Studio) |
| `api/lib/studio-nachrichten.php` | Studio: Postausgang, Recall, Warteliste, Kampagnen, Vorlagen, Einwilligung von Hand, Bericht |
| `api/lib/studio-verkauf.php` | Studio: Gutscheine, Codes, Treue, Fotos, Lager, Import |
| `api/lib/studio-buchhaltung.php` | Umsatzliste und DATEV-Buchungsstapel |
| `nachrichten.html` | „Ihre Nachrichten“: Einwilligungen ändern, alles abbestellen, Angebote bestätigen |
| `api/katalog.json` | Erstbefüllung, erzeugt von `recherche/katalog.py` aus Planity |
| `termin.*` | Online-Buchung; `termin-vorschau.js` rechnet ohne Server |
| `studio/` | Studio; `js/` als Module ohne Build |

`recherche/katalog.py` liest Planity neu (`--planity pasing.html
grosshadern.html`) und schreibt den Katalog. Er wird nur beim ersten
Start eingespielt; danach gehören die Daten dem Studio.

## Prüfen

```sh
# Server mit einer Test-Konfiguration (SQLite oder MySQL)
IRMONHAIR_KONFIG=/pfad/test-config.php PHP_CLI_SERVER_WORKERS=8 php -S 127.0.0.1:8098 &
# Jede Zeile mit frischer Datenbank (Datei löschen, Server neu starten):
node api/tests/pflicht.mjs http://127.0.0.1:8098/api/ <einrichtungs_schluessel>   # Pflicht-Tests 4.5 (88)
node api/tests/pruefen.mjs http://127.0.0.1:8098/api/ <einrichtungs_schluessel>   # Schnittstelle (92)
node api/tests/buchung-ausfall.mjs http://127.0.0.1:8098/                         # Netzausfall, Kollision, Verschieben (13)
node api/tests/last.mjs http://127.0.0.1:8098/api/ 200                            # gleichzeitige Buchungen
node api/tests/studio-oberflaeche.mjs http://127.0.0.1:8098/ <Datum mit Terminen> # Studio im Browser
node api/tests/buchung-oberflaeche.mjs http://127.0.0.1:8098/ 390 844 /tmp/b      # Buchung im Browser
# Nachrichten und Verkauf (124): SMS und E-Mail im Vorführmodus, siehe Kopf der Datei
IRMONHAIR_KONFIG=/pfad/test-config.php node api/tests/nachrichten.mjs http://127.0.0.1:8099/api/
```

Die Pflicht-Tests sind ohne Ausnahme grün vor jedem Deploy. Danach
`api/?a=selbstcheck&schluessel=…` — er muss `"ok":true` melden.

Die Test-Konfiguration braucht `cron_schluessel => 'cron-123'`,
`erlaubte_herkunft => ['http://andere.test']` und hohe Mengenbremsen
(`bremse_buchen`, `bremse_frei`, `bremse_anmelden`,
`bremse_anmelden_name`), weil alle Anfragen von einer Adresse kommen.

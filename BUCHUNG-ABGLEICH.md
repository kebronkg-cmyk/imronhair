# Buchungssystem — Abgleich mit der Spezifikation

Geprüft gegen die Spezifikation „Salon-Buchungssystem (Pilotkunde Irmonhair,
2 Salons)“. Vorgehen wie dort verlangt: bestehenden Code gegen jede Regel
prüfen, Lücken auflisten, dann schließen — nicht neu schreiben.

Stand: alle Pflicht-Tests aus Abschnitt 4.5 grün (`api/tests/pflicht.mjs`,
88 Prüfungen), dazu die bisherigen Schnittstellen-Prüfungen (92), der
Lasttest, die Ausfall-Prüfungen im Browser (13) und die Studio-Prüfungen
im Browser (14).

## Lücken, die es gab — und wie sie geschlossen sind

| # | Regel | Vorher | Jetzt |
|---|---|---|---|
| K1 / K16 | Verschieben atomar, „Neu buchen“ legt immer zusätzlich an | Umbuchen hat den alten Termin storniert und einen neuen angelegt (neuer Link, Status „storniert“ am alten) | Eigene Aktion `verschieben`: derselbe Termin, gleicher Link, neue Version. Der alte Platz wird erst frei, wenn der neue sicher gebucht ist; ist der neue belegt, bleibt alles unverändert. Die Seite sagt vor dem Knopf, ob verschoben oder zusätzlich gebucht wird |
| K2 | Bestätigung nur aus dem DB-Stand, jede Änderung mit „vorher → jetzt“ | Bestätigung aus dem DB-Stand, aber Änderungen im Studio blieben stumm; Mail nannte nur die Startzeit | Jede Änderung an Zeit, Dauer oder Person (online wie im Studio) erzeugt eine neue Bestätigung mit „vorher → jetzt“ und Kalenderdatei, die den alten Eintrag ersetzt (gleiche UID, höhere SEQUENCE). Immer nach dem COMMIT, immer frisch aus der Datenbank gelesen |
| K3 | Kein Statuswechsel ohne Verursacher, Protokoll mit vorher/nachher | Protokoll ohne Verursacher bei Kundinnen; nur teilweise vorher/nachher | Jeder Eintrag hat `akteur` (kunde / mitarbeiter / system) und bei Terminen `vorher` und `nachher` (Start, Ende, Person, Status). Keine automatischen Absagen, nie hart gelöscht |
| K4 | Gewählte Person verbindlich; Bestätigung nennt die Person | verbindlich bei der Buchung; Umbesetzen im Studio ohne Nachricht | Verbindlich auch beim Verschieben (keine stille Umverteilung). Umbesetzen nur aktiv im Studio, mit Nachricht an die Kundin. Bei „egal“ zeigt die Zusammenfassung die Namen, die zur Zeit frei sind; die Bestätigung nennt die eine |
| K6 | Eigener Login, Rollen Inhaber / Rezeption / Mitarbeiter | Inhaberin und Team | Dazu **Rezeption** (Kalender, Kunden, salonweite Schließtage, Export) |
| K8 | Neue Buchung, Storno, Verschiebung sofort im Dashboard plus Benachrichtigung | Zähler alle 20 s, E-Mail an den Salon nur bei Buchung und Absage | Dazu Sofortmeldung im Studio und — wenn erlaubt — Benachrichtigung des Geräts, auch im Hintergrund. E-Mail an den Salon auch beim Verschieben |
| K9 | Export aller Daten als CSV per Knopf | Sicherung als JSON | CSV-Export (Termine, Kunden, Protokoll, Einwilligungen), Excel-tauglich, gegen Formel-Einschleusung geschützt |
| K10 | Idempotenz, gesperrter Knopf, Erfolg erst nach COMMIT | Anfrage-Kennung und eindeutiger Index vorhanden | Dazu: Bleibt die Antwort aus, fragt die Seite nach (`anfrage`) und sendet mit derselben Kennung erneut — höchstens ein Termin. Wird die Seite mitten im Buchen geschlossen, zeigt sie beim nächsten Öffnen den angekommenen Termin. Ehrliche Meldung, wenn gar nichts durchkommt: „Noch einmal tippen ist sicher“ |
| K13 | Salon kann nur aktiv absagen, mit Grund und Benachrichtigung | Absage ohne Grund, ohne Nachricht | Zwei Zustände `storniert_kunde` / `storniert_salon`; der Salon muss einen Grund angeben, die Kundin bekommt ihn per E-Mail und sieht ihn hinter ihrem Link |
| K15 | Schließtage, Urlaub, Feiertage blocken hart | Online ja; im Studio ließ sich alles mit „Trotzdem“ überstimmen; Öffnungszeiten des Salons und Feiertage wurden gar nicht geprüft | Öffnungszeiten des Salons, gesetzliche Feiertage (Bayern), Schließtage, Urlaub und Pausen blocken überall hart. Überstimmen lässt sich nur „außerhalb der eingetragenen Arbeitszeit bei offenem Salon“ (bewusst, protokolliert) |
| 3.1 | UTC speichern; Zeitumstellung; 5-Minuten-Raster | Ortszeit gespeichert; kein Raster-Zwang; keine DST-Prüfung | Zusätzlich `start_utc`/`ende_utc` je Termin. Termine in oder über der Stunde der Zeitumstellung werden abgelehnt (dort stimmte sonst die Dauer nicht). Jede Zeit und jede Phase im 5-Minuten-Raster |
| 3.1 | Nie nur eine Startzeit zeigen | Uhrzeit-Knöpfe, Zusammenfassung, Bestätigung, Mail nannten nur den Beginn | Überall Beginn–Ende: unter jeder Uhrzeit, in Vorschlägen, Zusammenfassung, Bestätigung, Mail, Erinnerung, Kalender. Mailzeile genau im Format der Spezifikation: „Di, 14.10.2026 · 14:00–14:45 · Salon Pasing · bei Anna“ |
| 3.2 | Segment „puffer“ | nur Arbeit und Einwirkzeit | `puffer` belegt Person (wie Arbeit) |
| 3.3 #5 | Ende ≤ Schließzeit des Salons | nur Arbeitszeit der Person | Arbeitszeit wird mit den Öffnungszeiten geschnitten |
| 4.1 | `bucheTermin()` einzige schreibende Stelle | zwei Wege (`termin_anlegen`, `termin_aendern`) | `bucheTermin()` legt an und verschiebt — online, Telefon, Kasse; das Studio ändert Zeit/Person/Dauer nur darüber |
| 4.2 | Bei Kollision drei Alternativen | „gerade vergeben“ ohne Vorschlag | Drei Ausweichzeiten (zuerst derselbe Tag, so nah wie möglich), eine Berührung zum Übernehmen |
| 4.3 | Optimistische Sperre | Version optional | Version beim Ändern Pflicht |
| 4.3 | Nächtlicher Selbstcheck mit Alarm | fehlte | `api/?a=selbstcheck` (Cron): Überschneidungen, Belegung ohne Termin, Termin ohne Belegung; Warnung für künftige Termine an Schließtagen/Feiertagen/in Abwesenheiten. Alarm per E-Mail an `alarm_an` |
| 4.4 | Statusmodell | `storniert` | `gebucht → erschienen | nicht_erschienen | storniert_kunde | storniert_salon`, Bestand wird beim ersten Aufruf umgestellt |
| 4.5 | Pflicht-Tests | 88 Prüfungen, nicht alle Punkte | Alle 13 Punkte einzeln in `api/tests/pflicht.mjs` |
| 5 | Einwilligungen: zwei Häkchen, keins vorausgewählt, mit Zeitstempel, Quelle, Wortlaut | fehlte | Tabelle `einwilligung`; Wortlaut kommt von der Schnittstelle und wird genau so gespeichert; in der Kundenkarte sichtbar |
| 5 | Kalender: .ics mit Alarm 24 h und 2 h, Google-Link | nur 2 h | 24 h und 2 h; Google-Kalender-Link auf der Bestätigung und in der Mail |
| 1 | Mandantenfähig | fest ein Salon | `mandanten` in `config.php`: je Adresse eigenes Tabellen-Präfix, eigener Katalog, eigene Einstellungen |
| 8 | Quelle jeder Buchung, `ref` im Link | online/telefon/vorort/studio | dazu `kasse_vorausbuchung` („Nächsten Termin planen“), `recall`, `warteliste`; `?ref=` aus dem Link wird gespeichert |
| 10 | Uptime-Check | fehlte | `api/?a=gesund` antwortet mit `{"ok":true}`, wenn die Datenbank antwortet |

Dabei gefunden und behoben: Wer über den Link aus der Bestätigung kam und
„Verschieben“ wählte, schickte das Formular ohne Skript ab — die Seite lud
neu, statt zu verschieben. Die Bedienung wird jetzt eingerichtet, bevor die
Seite in „Termin ansehen“ abzweigt.

## Bewusst anders als wörtlich verlangt

- **Speicherung:** Planung und Anzeige rechnen weiter in Ortszeit
  (Europe/Berlin), daneben steht jede Zeit zusätzlich in UTC. Ein Umbau
  aller Zeitrechnungen auf UTC hätte das Kernstück neu geschrieben; das
  Ziel der Regel (eindeutige Zeiten, richtige Dauer an Umstellungstagen)
  ist erreicht, weil mehrdeutige und fehlende Ortszeiten abgelehnt werden.
  Die Pflicht-Tests prüfen das an beiden Umstellungstagen.
- **Sperre:** pro Person statt pro Person und Tag. Das ist strenger (eine
  Person kann nie gleichzeitig von zwei Buchungen geändert werden) und bei
  einem Salon ohne messbaren Nachteil; 200 gleichzeitige Anfragen sind in
  unter zwei Sekunden durch.
- **„Erschienen“ belegt weiter Zeit.** Die Kundin sitzt dann im Stuhl;
  würde die Zeit frei, könnte das Studio in einen laufenden Termin buchen.
  Freigegeben wird bei den Absagen und bei „nicht erschienen“.
- **Arbeitszeit überstimmen** (nur Studio, nur bei offenem Salon): damit
  eine Mitarbeiterin einen Termin am Abend dranhängen kann, ohne dafür ihre
  Wochenarbeitszeit zu ändern. Doppelbelegung entsteht dadurch nie; der
  Eintrag steht im Protokoll.

## Noch offen (V2 laut Spezifikation)

SMS/WhatsApp-Versand, Recall-Nachrichten, Warteliste, Monatsbericht,
Slot-Reservierung während der Eingabe, Mehrpersonen-Buchung in einem
Vorgang, Anzahlung über Stripe. Die Daten dafür werden schon erfasst
(Einwilligungen mit Wortlaut, Quelle jeder Buchung, `ref`).

Was nicht im Code liegt und vor dem Umschalten erledigt sein muss: AVV mit
dem Salon, Datenschutztext prüfen lassen (Abschnitt 5 ist um die
Einwilligungen ergänzt), Kündigungsfrist bei Planity, und bei Planity die
Online-Buchung schließen, sobald die eigene läuft (sonst entstehen genau
die Doppelbuchungen aus K11).

## Gegen Planity und Treatwell

| Was dort schiefging | Was hier passiert |
|---|---|
| Seite hing, Kundin buchte doppelt (Treatwell) | Ein Termin je Anfrage-Kennung, die Seite fragt bei ausbleibender Antwort selbst nach und sagt ehrlich, was sie weiß |
| „Neu buchen“ überschrieb den Termin (Planity) | Verschieben ist eine eigene Handlung; „Neu buchen“ sagt „zusätzlicher Termin, Ihr Termin am … bleibt“ |
| Falsche Uhrzeit bestätigt (Planity) | Bestätigung nur aus der Datenbank, mit „vorher → jetzt“ |
| Stornomail ohne Absage (Planity) | Keine automatischen Absagen; jede Absage mit Verursacher, beim Salon mit Grund |
| Wunschperson ignoriert (Planity) | Verbindlich, auch beim Verschieben; Umbesetzen nur aktiv mit Nachricht |
| Buchung bei geschlossenem Salon angenommen | Öffnungszeiten, Feiertage, Schließtage blocken hart |
| „Leider vergeben“ ohne Ausweg | Drei Ausweichzeiten, eine Berührung |
| Nur Startzeit | Überall Beginn–Ende |
| Daten bleiben beim Anbieter | CSV-Export per Knopf |
| Salon wusste nichts vom Termin (Treatwell) | Eine Tabelle für alle Wege, Sofortmeldung im Studio |

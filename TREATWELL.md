# Treatwell als Schaufenster, ein Kalender

Stand 15.10.2026. Irmonhair will Treatwell für die Neukunden behalten.
Ziel: Treatwell bleibt der Marktplatz, der Kalender von Irmonhair bleibt
der einzige, der zählt. Kein Termin wird zweimal vergeben, keiner geht
verloren, und das Studio sieht jeden Treatwell-Termin wie jeden anderen.

## Was Treatwell anbietet (belegt)

- **Externer Kalender je Mitarbeiterin:** In Treatwell Connect lässt sich
  pro Person eine iCal-Adresse eintragen („Team → Person → Externer
  Kalender → Kalender verknüpfen“). Belegte Zeiten daraus sperrt Treatwell
  für Buchungen. Übernommen wird nur frei/belegt, keine Namen.
  Quelle: Treatwell-Partnerhilfe „iCal-Synchronisation einstellen“.
- **Zweite E-Mail-Adresse:** Treatwell schickt Buchungsmails zusätzlich an
  eine „Secondary email address“. Genau so binden Drittanbieter (Booking
  Connect für Phorest) Treatwell an: iCal hin, Mails zurück.
- **Kosten bleiben:** Starter 39 € / Monat je Standort (Kalender plus
  Marktplatz), 35 % Provision nur auf die erste Buchung einer Neukundin,
  0 % für Wiederkehrende, alles zzgl. MwSt. Ob jemand „neu“ ist,
  entscheidet Treatwell nach eigenen Daten.
- **Keine offene Schnittstelle.** Zwei-Wege-Abgleich gibt es nur mit
  ausgewählten Partnern (Salonized u. a.). Unser Weg ist der dokumentierte
  Weg über iCal und E-Mail.

## Noch offen, vor dem Bau klären (Phase 0)

| Frage | Wie klären | Warum wichtig |
|---|---|---|
| Wie oft liest Treatwell die iCal-Adresse neu? | Testfeed eintragen, Sperre setzen, Minuten bis zur Sperre in Treatwell messen | Bestimmt das Zeitfenster für eine Überschneidung |
| Gibt es „Secondary email“ im Tarif von Irmonhair? | Im Treatwell-Konto nachsehen | Ohne sie nur Weiterleitung aus dem Hauptpostfach |
| Wie sehen Buchung, Änderung, Absage als Mail aus? | Je Salon 10 echte Mails weiterleiten lassen (unter AVV, nie ins Repo; für Tests anonymisiert) | Grundlage für den Leser |
| Tarif, Standorte, Laufzeit bei Treatwell | Vertrag | Ehrliche Kostenrechnung |
| Kann Irmonhair eine Provision für eine Stammkundin anfechten? | Treatwell-Ansprechpartner fragen | Entscheidet, ob die Prüfliste Geld zurückholt oder nur vorbeugt |
| PHP-IMAP und Cron-Takt bei All-Inkl | `php -m`, KAS-Cronjobs | Takt des Postfach-Abrufs |

Erst wenn der iCal-Takt gemessen ist, wird die Zahl im Angebot genannt.

## Aufbau

```
Website · Telefon · Studio ─┐
                            ├─▶ Irmonhair-Kalender ──iCal „belegt“──▶ Treatwell (je Person)
Treatwell-Mail ─▶ Postfach ─┘         ▲
                  (alle 5 Min.)       └─ Sofortmeldung bei Überschneidung
```

### Phase 1: Belegt-Feed je Person und Salon (1 Tag)

- `GET api/?aktion=belegt_ical&p=<person>&s=<salon>&t=<geheim>` liefert
  `text/calendar` mit `VEVENT`s, `SUMMARY:Belegt`, `TRANSP:OPAQUE`, keine
  Namen, keine Leistungen. Zeitraum heute bis Buchungshorizont.
- Inhalt: Belegung (Arbeitsphasen, Einwirkzeit bleibt frei, wie im Planer),
  Termine im **anderen** Salon samt Wegzeit davor und danach, Abwesenheit,
  Pausen und alles außerhalb der Arbeitszeit. Dann pflegt der Salon die
  Arbeitszeiten nur noch einmal, in Treatwell bleiben sie weit offen.
- Die Belegt-Zeiten kommen aus derselben Funktion wie die Online-Buchung
  (`tagesplaene()`), nicht aus einer zweiten Rechnung.
- Geheimnis je Person in `meta`, im Studio unter Einstellungen →
  Treatwell mit Kopierknopf und „neu erzeugen“.
- Treatwell-Termine selbst stehen im Feed nicht (Treatwell kennt sie).

### Phase 2: Treatwell-Mails einlesen (3–4 Tage, hängt an den Beispielmails)

- Eigenes Postfach bei All-Inkl, z. B. `treatwell@…`, als zweite Adresse in
  Treatwell. Abruf per IMAP im bestehenden Cron (`aktion_nachrichten`),
  alle 5 Minuten oder so oft der Cron darf.
- Leser erkennt Buchung, Änderung, Absage; liest Buchungsnummer, Salon,
  Person, Datum, Beginn, Dauer, Leistung(en), Name, Telefon, E-Mail.
- Schreiben nur über `bucheTermin()` mit `quelle = 'treatwell'` und
  `anfrage_id = 'tw:<Buchungsnummer>'`: dieselbe Mail zweimal ergibt
  denselben Termin. Änderung und Absage finden den Termin über diese
  Kennung.
- Zuordnung Treatwell-Leistung → eigene Leistung als Tabelle im Studio;
  Unbekanntes wird mit der Dauer aus der Mail angelegt und markiert.
- **Treatwell-Termine werden nie abgelehnt.** Die Kundin hat dort schon
  eine Bestätigung. Liegt etwas im Weg, wird der Termin trotzdem
  eingetragen, als Überschneidung markiert und sofort gemeldet (Studio,
  SMS an den Salon): mit freier Kollegin zum Umbesetzen und Telefonnummer.
- Was der Leser nicht versteht, geht nicht verloren: es steht im Studio
  als „Treatwell-Mail prüfen“ mit dem Originaltext und einem Knopf
  „als Termin anlegen“. Jede Mail landet entweder als Termin oder in
  dieser Liste, nie im Nichts. Zähler je Woche im Bericht.
- Keine Erinnerungs-SMS für Treatwell-Termine (Treatwell erinnert selbst),
  keine Werbung ohne eigene Einwilligung.

### Phase 3: Aus Treatwell-Neukundinnen werden Stammkundinnen (1–2 Tage)

- Abgleich über Telefon und E-Mail mit der Kundenkartei. Treffer → selbe
  Karte. War sie schon Kundin, kommt der Termin auf die **Prüfliste
  Provision** (Datum, Leistung, Preis, 35 % davon).
- Beim Kassieren zeigt das Studio bei Treatwell-Erstbesuch: „Nächsten
  Termin gleich eintragen?“ (in den eigenen Kalender, keine Provision).
- Karte mit QR zur eigenen Buchung; dort die bestehende Recall-Frage und
  das Einverständnis für Nachrichten (DOI wie gehabt). Ohne Einwilligung
  kein Recall, keine Angebote.
- Recall- und Verschieben-Links führen auf die eigene Website, nie zu
  Treatwell.

### Phase 4: Bericht „Was Treatwell bringt“ (1 Tag)

Im Monatsbericht je Salon:
- Treatwell-Termine, davon Neukundinnen laut Treatwell
- Davon wiedergekommen, und über welchen Weg (Treatwell, Website, Studio)
- Umsatz aus Treatwell-Erstbesuchen und Folgebesuchen
- Geschätzte Provision (35 % der Erstbesuche) gegen Grundgebühr
- Prüfliste: Stammkundinnen, die über Treatwell als neu gebucht haben
- Überschneidungen und ungelesene Mails (soll beides null sein)

Damit entscheidet Irmonhair nach Zahlen, ob Treatwell sich lohnt.

### Phase 5: Probelauf (2 Wochen)

1. Ein Salon (Pasing), Feed für alle Personen, Mail-Abruf an.
2. Täglich: jede Treatwell-Mail gegen den Kalender, Abweichungen notieren.
3. Gemessen werden: Verzögerung Mail → Termin, Verzögerung Sperre →
   Treatwell, Überschneidungen, unverstandene Mails.
4. Dann Großhadern, zuerst Bedia (arbeitet in beiden, mit Wegzeit).

## Tests

- `api/tests/treatwell.mjs`: Feed enthält Belegung, anderen Salon mit
  Wegzeit, Abwesenheit, keine Namen; falsches Geheimnis → 404.
- Leser gegen anonymisierte Beispielmails: Buchung, Änderung, Absage,
  zwei Leistungen, unbekannte Leistung, doppelte Zustellung.
- Überschneidung: Treatwell-Termin auf belegter Zeit wird angelegt,
  markiert, gemeldet; nichts wird abgelehnt.

## Risiken

| Risiko | Antwort |
|---|---|
| Treatwell ändert das Mailformat | Unverstandenes landet in „prüfen“, Meldung ans Studio; Leser nachziehen |
| Überschneidung im Zeitfenster bis zur nächsten iCal-Abfrage | Wird binnen Minuten gemeldet; selten, weil dieselbe Person und Minute nötig sind; jede wird gezählt. Wird es mehr als eine im Monat: Treatwell nur bestimmte Personen oder Tage geben |
| Treatwell schaltet die zweite Adresse oder iCal ab | Beides sind offizielle Funktionen; Rückfall: Weiterleitung aus dem Hauptpostfach |
| Datenschutz | Feed nur „belegt“ mit Geheimnis; Mails im Auftrag (AVV); Treatwell in der Datenschutzerklärung als Buchungsweg nennen |

# Übergabe — Irmonhair

Diese Datei in eine neue Sitzung einfügen. `CLAUDE.md` (Arbeitsweise)
und `ABNAHME.md` (offene Punkte) gelten weiter.

## Stand

- Grundgerüst aus *BaHaar's Styling Studio* (Fassung „Hell II"),
  vollständig auf Irmonhair umgeschrieben: Texte, Preise beider Salons,
  Öffnungszeiten, Planity-Buchung, echte Planity-Bewertungen, Farben,
  Schrift, Logo, Hintergründe, Impressum, Datenschutz.
- Noch **nicht** veröffentlicht. Das Repository `irmonhair` muss der
  Auftraggeber selbst anlegen; danach Push auf `main`, der Workflow
  `.github/workflows/deploy-pages.yml` liefert aus.

## Gestaltung — die Entscheidungen

- **Grund** fast neutrales Weiss (das Weiss des Logos). Creme war ein
  Reflex und flog raus — der Detektor meldet es zu Recht.
- **Schrift** warmes Schwarz in drei Stufen, Anzeige in **Jost**
  (dem gesperrten Schriftzug im Logo am nächsten), Lauf in Mulish.
- **Farbe** nur aus dem Material: blonde Strähnen (Auftakt, Leistungen,
  Standorte), Karamell (Stimmen), Schwarz (Fuss). Akzent Honig für
  Flächen, Bronze `--akzent-schrift` für Verweise; auf dem Glanz lokal
  eine Sprosse dunkler.
- **Knopf** schwarz wie das Logo.
- **Hintergründe** selbst gerechnet: `recherche/straehne.py`
  (Linienintegral-Faltung über ein Wirbelfeld). Parameter der Irmon-Serie:
  Farbwinkel 78 (Blond), 66 (Karamell), 60 (Schwarz).
- **Zwei Salons** überall gleichwertig: Nummern beider im Auftakt,
  Preise nebeneinander (links Pasing, rechts Großhadern), zwei
  Standortkarten mit eigenem Live-Stand (`neu.js`, `ZEITEN.pasing` /
  `.grosshadern`, `data-ort` am `.stand`).

## Gemessen

- Kontrast (`kontrast3.mjs`, 1440 und 390): alles über der Grenze,
  schwächste Zeile 5,3:1 (Datum der Stimmen auf Karamell).
- Keine horizontale Überbreite bei 390 und 360 px (vorher 21 px durch die
  Leiste, behoben).
- Schere im Auftakt überdeckt den Namen nicht; auf niedrigen Schirmen
  (< 820 px Höhe, schmal) wird sie ausgeblendet.
- Detektor: 15 Hinweise, alle aus Vorlagenregeln für Abschnitte, die hier
  noch nicht vorkommen (Laufband, Braut, Arbeiten).
- Keine Konsolenfehler.

## Nicht übernommen, mit Grund

- Stockfotos der alten Seite (Rechte liegen bei der Agentur).
- „Chemiefreie Farben" (irreführend, siehe ABNAHME 2).
- Das Kontaktformular der alten Seite — gebucht wird bei Planity oder am
  Telefon; ein Formular bräuchte einen Server.

## Prüfskripte

`.claude/pruefung/` stammt aus dem Vorgängerprojekt; einige Skripte
(Film, Rauch) sind dort entstanden und hier ohne Gegenstand. Brauchbar:
`kontrast3.mjs`, `ueberblick.mjs`, `menue.mjs`, `faecher2.mjs`.

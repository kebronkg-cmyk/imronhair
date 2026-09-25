# Übergabe — Irmonhair

Diese Datei in eine neue Sitzung einfügen. `CLAUDE.md` (Arbeitsweise)
und `ABNAHME.md` (offene Punkte) gelten weiter.

## Stand

- Online über GitHub Pages: https://kebronkg-cmyk.github.io/imronhair/
  (Push auf `main` → `.github/workflows/deploy-pages.yml`).
- Zweite Fassung (24.09.2026): echte Salonfotos, neues Zeichen, edlere
  Überschriften, Strähne zurückgenommen, Preisliste neu aus Planity.

## Gestaltung — die Entscheidungen

- **Material aus den Salons.** Pasing: schwarzes Kroko-Leder, barocke
  goldene Spiegelrahmen, weisse Regale, graue Fliesen. Großhadern:
  schwarze Sessel, dunkles Holz. Daraus: Papierweiss, warmes Schwarz
  (`--tinte`, `--nacht`), Gold der Rahmen (`--gold…`). Gold tritt als
  Linie, Rahmen und als *ein* kursives Wort je Überschrift auf, nie als
  Fläche hinter Text und nie als Verlauf in der Schrift (der Detektor
  wertet Verlaufsschrift zu Recht als Schablone).
- **Schrift.** Überschriften in Cormorant Garamond (300, kursiv 400 für
  das Goldwort), Marke/Zahlen/Knöpfe in Jost, Lauftext in Mulish. Alles
  lokal in `schrift/`, OFL.
- **Das Zeichen** oben links: Medaillon aus drei Ringen (Rahmen, Perlen,
  Innenring), darin das I auf dem Haarstrich, der Schwung aus dem Logo.
  Zieht sich beim Laden, die Perlen drehen beim Überfahren. Inline-SVG in
  jeder Seite (Verlauf `#zeichen-gold`), eigenständig in
  `logo-zeichen.svg`, dunkel als `logo-favicon.svg`.
- **Die eigene Idee: der Spiegel.** Im Auftakt ein Rundbogen-Spiegel im
  Goldrahmen, darin der Salon. Das Licht auf dem Glas folgt dem Zeiger
  (am Handy dem Scrollen); der Umschalter wechselt Pasing ↔ Großhadern
  mit einem Lichtstreif; das sichtbare Bild fährt langsam heran.
- **Strähne zurückgenommen.** Nicht mehr Hintergrund der ganzen Seite:
  einmal als schmales Band unter dem Auftakt, dunkel im Fuss.
  `recherche/straehne.py` rechnet sie weiter; die übrigen Varianten und
  die Schere sind gelöscht.
- **Stimmen auf schwarzem Leder**, Standortkarten mit Salonfoto.

## Preisliste

- `recherche/planity-preise.json` — Rohdaten aus beiden Planity-Seiten.
- `recherche/preise.py` — ordnet jeden Planity-Posten einer von acht
  Gruppen zu (Ablauf: Schnitt, Farbe, Strähnen, Pflege, Herren, Kinder,
  Verlängerung, Gesicht) und schreibt zwischen die Marken
  `<!-- preise:… -->` in `leistungen.html` und `index.html`. Bricht ab,
  wenn ein Planity-Posten nicht zugeordnet ist.
- Leistungen nur von irmonhair-muenchen.de stehen in `WEBSITE` im Skript
  und tragen „telefonisch buchen“.
- Seite: zuerst Salonwahl (Radioknöpfe, ohne Skript über `:has()`),
  dann ein Wegweiser, der mit der Leiste ausweicht und die aktuelle
  Gruppe markiert. Preise in festen Spalten kurz / mittel / lang.
  Adressen: `#grosshadern`, `#farbe`, `#grosshadern-farbe`.

## Gemessen (24.09.2026)

- Detektor (`detect.mjs --json` über alle Seiten und `neu.css`): `[]`.
  Er versteht `padding-block`/`-inline` nicht — Abschnitte mit eigener
  Fläche tragen deshalb `padding: … …`.
- Kontrast (`kontrast3.mjs`, 1440 und 390): alles über der Grenze,
  schwächste Zeile 5,2:1 (das Goldwort, gross). Das Skript fällt ohne
  ffmpeg jetzt auf Pillow zurück.
- Keine horizontale Überbreite bei 390 und 360 px.
- Keine Konsolenfehler; geprüft mit Maus, Touch, ohne Skript, mit
  reduzierter Bewegung. Ohne Skript fing der Notausgang des Vorhangs die
  Klicks ab (Chrome hält `visibility` auf „visible“) — behoben, er wird
  am Ende aus dem Bild geschoben.

## Prüfskripte

`.claude/pruefung/` stammt aus dem Vorgängerprojekt. Brauchbar:
`kontrast3.mjs`, `ueberblick.mjs`. Server: `python3 -m http.server 8099`.
Der Detektor braucht einmal
`cd .claude/skills/impeccable && npm install --no-save htmlparser2 css-select css-tree domutils`
(der Ordner `node_modules` ist ignoriert), sonst läuft er eingeschränkt.

## Erste Fassung unter /alt/

https://kebronkg-cmyk.github.io/imronhair/alt/ — die Fassung aus der Zip
(Stand `8eb16f9`), mit `noindex`, als stimmige Alternative ausgebaut:

- **Eine Fläche.** Der Auftakt (Strähne, Schere) bleibt das Markenzeichen;
  danach liegt alles auf derselben Scheibe (`--durch: .8`), die Wand
  schimmert nur durch. Keine Abschnittsbilder mehr, keine harten Wechsel.
  Unter jeder grossen Überschrift zieht sich der Haarstrich aus dem Logo.
- **Glanzband** einmal zwischen Galerie und Stimmen, nach allen Seiten
  ausgeblendet.
- **Galerie:** sechs grosse Fotos (3:2, zwei nebeneinander), eigene
  Ansicht mit Blättern, Pfeiltasten, Wischen; Schliessen führt an dieselbe
  Stelle und auf dasselbe Foto zurück.
- **Standorte:** je Salon eine Zeile, der ganze Raum unbeschnitten im
  feinen Goldrahmen, Angaben daneben; zweite Zeile gespiegelt.
- **Besonderheit:** „Welcher Salon liegt näher?“ — Geolocation im
  Browser, Luftlinie zu beiden Salons (Koordinaten OpenStreetMap, auf die
  Hausnummer genau), der nähere wird markiert. In `alt/datenschutz.html`
  beschrieben.
- Stimmen ruhig, die grosse ohne Friseurnamen; Medaillon als Zeichen;
  Preisliste mit einer klebenden Zeile, Listen aus `preise.py`.
- Detektor: 10 Meldungen, alle aus der Vorlage (vorher 11).

## Dritte Fassung unter /schleife/ (25.09.2026)

https://kebronkg-cmyk.github.io/imronhair/schleife/ — Kopie der
Spiegel-Fassung mit `noindex`, neu gestimmt nach den Vorlagen der
Inhaberin. Die Hauptadresse bleibt die Spiegel-Fassung.

- **Nacht statt Papier.** Tokens in `schleife/neu.css` überschrieben:
  warmes Schwarz als Grund, Travertin als einzige helle Fläche (Stimmen),
  LED-Gold als Leitfarbe (`--gold…`, `--led-schein`). Lesbares Gold
  (`--gold-schrift`, `--gold-wort`) getrennt vom Ornament-Gold.
- **Schrift:** Jost 300 gesperrt für Überschriften und Wortmarke
  (Schaufensterbuchstaben), Sacramento für die zwei Handschriftzeilen,
  Mulish für den Lauftext. Cormorant ist hier entfernt.
- **Die Schleife** liegt als Inline-SVG oben links am Spiegel: ein
  flaches schwarzes Leuchtschild wie an der Fassade (Bandknoten,
  umgeschlagene Schlaufen, Bänder mit V-Schnitt), das Licht nur als Kante,
  die sich beim Laden einmal entlangzieht. Jedes Band trägt seine Kante
  selbst, damit das vordere die des hinteren verdeckt.
- **Überschriften** wie das Schild: ein Wort in gesperrten Versalien
  (`.schild`), darunter eine Handschriftzeile (`.schild-zeile`).
- **Knöpfe** schwarz mit LED-Kante (`--knopf-grund`, `--knopf-kante`),
  nie gefüllt gold.
- **Travertin** hinter den Stimmen ist echter Stein aus der Fassade der
  Vorlage (`schleife/bilder/travertin.webp`, nahtlos), hell überlegt.
- **Extensions** als eigener Abschnitt `#extensions` direkt nach dem
  Auftakt, mit fünf Werten aus der Vorlage (ohne Zahlen).
- **Das Farbregal** (`form.regal`): zehn Haarstränge an Klammern unter
  einer LED-Leiste, dazu Länge und Wunsch; daraus entsteht ein Satz, der
  kopiert werden kann, und die Beratung bei Planity in beiden Salons.
  Ohne Skript bleibt es eine Auswahl mit Buchungsknöpfen.
- `recherche/preise.py` schreibt jetzt auch `schleife/`. Stückpreise
  („pro Strähne“) zählen nicht mehr als Einstieg — die Übersicht zeigte
  bei Haarverlängerung „ab 7 €“, jetzt „ab 50 €“ (die Beratung), auch in
  der Hauptfassung und unter /alt/.
- Detektor: 5 Meldungen, alle zum LED-Schein (gewollt, er ist das Licht
  aus der Vorlage). Kontrast über der Grenze, keine Überbreite bei 390
  und 360 px, keine Konsolenfehler.

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
(Stand `8eb16f9`), mit `noindex`, und darauf aufgebaut:

- Zeichen oben links: das Medaillon der neuen Fassung (40 px).
- Leistungen: Einstiegspreise aus `preise.py` statt der alten Klappfächer.
- „Einblick in beide Salons“: sechs Fotos, antippen öffnet das Bild.
- Stimmen: ruhige Fläche statt Karamell, davor das Glanzband; die grosse
  Stimme nennt keinen Namen mehr (vorher Momo).
- Standorte: je das beste Foto oben in der Karte, Schleier im Ton des
  Papiers, dicht unter Zeiten und Knöpfen.
- Preisliste: eine klebende Zeile mit Salonwahl und Gruppen, darunter
  dieselben Planity-Listen wie in der neuen Fassung (`preise.py` schreibt
  beide Fassungen).
- Detektor: auf den Hauptseiten gleich viele Meldungen wie vorher (11),
  alle aus der Vorlage (Laufband-Regel ohne Verwendung, `overflow` am
  `body`, Innenabstände im Band); keine aus den neuen Teilen.

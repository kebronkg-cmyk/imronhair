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
- **Die Schleife** ist aus dem Schaufensterfoto nachgezeichnet
  (`recherche/schleife.py`, Koordinaten des Fotoausschnitts 560 × 900):
  Satin mit Volumen (Verlauf je Fläche, weiche Glanzbahnen), hinterleuchtet,
  LED nur an den Kanten, an denen es im Foto steht. Das Skript setzt sie
  zwischen Marken `<!-- schleife:… -->` an vier Stellen: gross oben rechts
  am Spiegel (gespiegelt, das lange Band fällt aussen), im Ladebildschirm
  über dem Schriftzug, als Zeichen in der Leiste (nur Schlaufen und Knoten,
  Bänder laufen aus) und als Favicon `schleife/logo-schleife.svg`.
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
- **Tokens:** Jede Farbe im Stil ist ein Token aus `:root`, Alpha-Stufen
  über `color-mix`; neue Rollen (`weiss-licht`, `schatten`, `bronze`,
  `linie-gold-hell`, `offen`, `sterne`, `travertin-*`) und die
  Schrifttreppe stehen in `schleife/DESIGN.md`. Dabei zwei Fehler behoben:
  „Extensions entdecken“ und die Telefonpille wurden beim Überfahren fast
  weiß (Rest der hellen Fassung).
- **Galerie am Handy** zwei nebeneinander, weiter antippbar.
- Detektor: 10 Meldungen, alle „dark-glow“ und gewollt — der Leuchtschein
  am Spiegel, an der Regal-Klammer und am Hauptknopf (je Seite).
- Die Norm für weitere Salons: `.claude/skills/salon-website/`.
- Kontrast über der Grenze, keine Überbreite bei 390
  und 360 px, keine Konsolenfehler.

## Vierte Fassung unter /fenster/ (26.09.2026) — das Handy als Schaufenster

https://kebronkg-cmyk.github.io/imronhair/fenster/ — Kopie von /schleife/
(die bleibt unverändert). Nur die Handy-Ansicht (< 48rem) ist neu
komponiert; Desktop (1440) und iPad (820) der Startseite sind gemessen
pixelgleich mit /schleife/. Die Preisliste ist auf allen Größen neu.

- **Erster Bildschirm:**
  - Der Bildschirm ist das Fenster. Die LED-Kante zieht sich beim Laden links hinauf, oben quer und rechts hinab; die Schleife sitzt auf der Ecke (`<!-- schleife:fenster -->`).
  - Auf dem Glas steht die Beschriftung aus der Vorlage (Extensions, Haarverlängerung, Haarverdichtung, Beratung, ♡).
  - Darunter hängt die **Auslage**: sieben Echthaar-Bündel an einer Lichtstange, mit derselben Textur wie das Farbregal. Hier kann später das Porträt der Inhaberin stehen. Unter 720 px Bildschirmhöhe wird sie ausgeblendet.
  - Unten stehen Name, Handschrift, genau ein leuchtender Knopf und die zwei Telefonnummern als Schilder.
  - Der Satz über die Leistungen steht unter dem Spiegel.
  - Die untere Kante (`.fenster-fuge`) wandert über die ersten 320 px Scrollweg hinab, wird schmaler und geht in die Lichtkante des Spiegels über (`--glut`).
- **Kapitel:** Die Nummer steht über jedem Schild (`data-nr`). Eine LED-Fuge leuchtet beim Hereinscrollen auf, und in der Leiste steht das aktuelle Kapitel (`.leiste-kapitel`). Der Grund wechselt: Preise auf tieferem Schwarz.
- **Schrifttreppe am Handy:** Schild 1,95 rem, Handschrift 1,75 rem, Unterüberschrift 1,5 rem, Text 1 rem, Angaben 0,72–0,8 rem.
- **Extensions:** Schild, Spruch, eine Zeile zum Aufklappen, dann gleich das Regal; die fünf Werte als kompakte zweispaltige Liste ohne Kästen; die Beratungsknöpfe untereinander.
- **Preisvorschau:** Die acht Gruppen hängen als Preisetiketten an zwei Lichtstangen zu je vier, alle auf einen Blick (`preise.py` → `<!-- preise:etiketten -->`, kurze Namen in `ETIKETT_KURZ`). Ein Umschalter wählt den Salon; ein Tipp führt nach `leistungen.html?salon=…#gruppe`.
- **Stimmen:** am Handy wischbar.
- **Preisliste (alle Größen):**
  - Eine klebende Steuerleiste mit Salon und „Meine Haare sind kurz / mittel / lang / alle Längen“. Ohne Wahl ist die Frage gold hervorgehoben; die Wahl wird gemerkt.
  - Die Gruppen sind `<details name>`, immer nur eine offen, ihr Kopf klebt unter der Leiste.
  - Eine Zeile pro Leistung, der Preis rechts. Die Längenfilterung läuft per `:has()`, also auch ohne Skript.
  - Am Ende jeder Gruppe steht „… in Pasing buchen“.
  - Erzeugt mit `karte_html()` in `recherche/preise.py`.

Gemessen am Handy (390 × 844), alt → neu:

| Messgröße | alt | neu |
|---|---|---|
| Wörter im ersten Bildschirm | 50 | 24 |
| Knöpfe im ersten Bildschirm | 2 | 1 |
| Startseite | 11 301 px | 8 898 px |
| Extensions bis zum Regal | 971 px | 430 px |
| Preisvorschau | 1 803 px (8 Gruppen untereinander) | 827 px (alle 8 Etiketten auf einen Blick) |
| Stimmen | 2 357 px | 1 150 px |
| Kapitelmarken | 0 | 5 |
| Preisliste | 9 427 px, 106 Kästen | 2 921 px zugeklappt, 0 Kästen |
| Preise pro Leistung | bis zu 3 | 1 bei gewählter Länge (38 statt 69 Preisangaben in Pasing) |
| Schriftgröße Gruppe : Leistung : Angaben | — | 1,51 : 1,41; dazu das Gewicht 500 bei Leistungen gegen 400 bei den Angaben |

- Detektor: 10 × dark-glow (gewollt, wie /schleife/).
- Kontrast überall über der Grenze.
- Keine Überbreite bei 390 und 360 px; die Schleife ragt bewusst über die Bildschirmkante und wird abgeschnitten.
- Keine Konsolenfehler.
- Verhalten getestet: Etikett → Preisliste, alter Direktlink, ohne Skript, reduzierte Bewegung, Farbregal.

Abschlussprüfung (eine Runde), umgesetzt:
- das leere Fenster mit der Auslage gefüllt;
- die LED-Fuge als deutliche Schwelle;
- die Werte als Liste statt als Karussell;
- alle Etiketten ohne Wischen sichtbar, der Hinweis „Wischen“ entfernt;
- mehr Luft über den Schildern als darunter;
- das Kapitel in der Leiste zweizeilig statt abgeschnitten;
- „telefonisch buchen“ im Ton der Angaben;
- die Beratungsknöpfe untereinander.

Bewusst nicht übernommen: die Kapitelnummern 01–05 über den Schildern zu streichen. Sie standen im freigegebenen Plan; nur die doppelten Nummern auf den Etiketten sind weg.

### /fenster/ ab iPad: Kapitel in der Leiste und Preisschrank (26.09.2026)

- **Ab 48rem steht in der Leiste unter „IRMONHAIR“ das aktuelle Kapitel** (Extensions, Preise, Salons, Stimmen, Termin) an Stelle von „Friseur · München“. Beim Wechsel blendet es kurz ein.
- **Die Preisvorschau ist ab 48rem ein Schrank:** zwei Lichtstangen mit je vier Etiketten und dem Salon-Umschalter. Ab 80rem steht er rechts neben der Überschrift, darunter in voller Breite (max. 46rem).
- **Nebenbei behoben:** Bei 1024–1280 px ließ sich die Seite seitlich schieben, weil Telefonpille und Schleife über den Rand ragten. Dieser Fehler besteht in /schleife/ weiterhin.
- **Handy (< 48rem): gemessen pixelgleich** mit dem Stand davor, Startseite und Preisliste.
- **Zurück („back“):** den Commit dieser Änderung rückgängig machen (`git revert`). Alles steht in der Schicht „Schrank“ am Ende von `fenster/neu.css` und in wenigen Zeilen in `neu.js`.

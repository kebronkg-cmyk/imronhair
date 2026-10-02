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

### /fenster/ Extensions: Details und WhatsApp-Nachricht (26.09.2026)

- **Details, ohne die Seite zu strecken:**
  - Die Werte-Liste trägt jetzt die echten Angaben: Beratung 30 Min. · 50 € in beiden Salons (Planity), Tape-Technik oder Bondings (Planity Pasing), ab 7 € pro Strähne und Überlänge extra (Preisliste der Salon-Website), Farben von Platin bis Espresso.
  - Am Handy stehen diese Fakten in der aufklappbaren Einstiegszeile statt als eigene Liste.
- **Vier Schritte:** Farbton, Länge, Wunsch, Methode (Tape / Bondings / Beraten Sie mich). Zu Wunsch und Methode erscheint nur die Erklärung zur gewählten Option (`.regal-tipp`, per `:has()`, auch ohne Skript).
- **Nachricht statt Planity:**
  - Die Auswahl baut eine WhatsApp-Nachricht, Zeile für Zeile. Der Salon wird als kleiner Umschalter im Kopf der Nachricht gewählt.
  - Der Text ist vor dem Senden änderbar. Eigene Änderungen bleiben erhalten; eine neue Wahl ersetzt nur ihre Zeile.
  - „Per WhatsApp senden“ öffnet `wa.me` mit dem fertigen Text; „Text kopieren“ ist der Ausweg.
  - **Die Nummer steht nur an einer Stelle:** `data-whatsapp` am Knopf in `fenster/index.html` (dazu das `href` für Besucher ohne Skript).
- **Am Desktop** wird links unter den Werten gewählt und rechts daneben die Nachricht als Live-Vorschau gezeigt. Sie füllt dort den Platz, statt den Abschnitt zu verlängern.
- **Höhe des Abschnitts, alt → neu:** Handy 1669 → 1890 px (+13 %), iPad 1983 → 2111 px (+6 %), Desktop 1296 → 1455 px (+12 %). Sichtbare Wörter am Handy 108 → 103.

### /fenster/ Handy: Name höher, LED-Linie glatter (27.09.2026)

- **Name:** Er steht direkt unter der Schleife wie das Schild über dem Fenster (bei 390 px bei ca. 345 statt 545 px); darunter hängt die Auslage, unten Knopf und Nummern. Der Abstand oben folgt der Größe der Schleife.
- **LED-Linie:**
  - gleitet mit exponentieller Nachführung (τ = 110 ms, ohne Überschwingen);
  - Schein als Verlauf statt `drop-shadow`;
  - `--glut` sitzt am Spiegelrahmen statt an `<html>`.
- **Gemessen bei groben Scroll-Schritten:** Bewegung in 77 statt 8 Einzelbildern, größter Sprung 1,9 statt 7,4 px.
- **Gegenprobe:** iPad und Desktop pixelgleich.

## Terminbuchung und Studio (27.09.2026)

Eigene Buchung statt Planity, dazu das Studio für den Salon. Einrichtung,
Aufbau und Betrieb: **`BUCHUNG.md`**. Offene Fragen an den Salon:
`ABNAHME.md`, Punkt 10.

- **Bauart:** `api/` in PHP 8 ohne Abhängigkeiten, MySQL (All-Inkl) oder
  SQLite. Oberflächen bleiben statisch: `fenster/termin.html` und
  `studio/` (ES-Module, kein Build). Der Katalog stammt aus Planity
  (`recherche/katalog.py` → `api/katalog.json`): 9 Personen, 125
  Leistungen (102 online), wer was macht, Abläufe mit Einwirkzeit.
- **Rückfallebene:** Ohne Schnittstelle (GitHub Pages) zeigt
  `termin.html` Telefon und Planity; das ist auch der Ladezustand.
  `?vorschau` rechnet mit ausgedachter Auslastung (`termin-vorschau.js`).
- **Die eigene Idee der Buchungsseite:** das Etikett an der Lichtstange
  (wie die Preisetiketten), das sich mit der Wahl füllt; nach dem Buchen
  hängt es allein da. Schritte mit Nummer und Lichtfuge wie die Kapitel.
- **Mitdenken:** gemerkte Länge und Salon aus der Preisliste, ein
  passender Zusatz (Heiße Schere), frühester Termin je Person aus
  derselben Abfrage, „Nächster freier Termin“, „Wie gewohnt“, „Wie beim
  letzten Mal“. Im Studio: „Heute noch frei“ für Laufkundschaft, nächster
  Termin im gewohnten Rhythmus der Kundin, fällige Kundinnen.
- **Tipps bis zum Termin** (Handy): neu 7 Tipps plus Name und Nummer;
  mit gemerktem Salon und Länge 5; wiederkehrend mit „Wie beim letzten
  Mal“ und gemerkten Angaben 3 (Nochmal, Uhrzeit, Buchen).
- **Behoben beim Prüfen:**
  - `.zeiten`, `.salons`, `.kontakt` gab es in `neu.css` schon (Falle
    „schon vergebener Name“) → `.uhrzeiten`, `.salon-wahlen`, `.angaben`;
  - CSS-Variablen über `Object.assign(style)` werden still ignoriert → `setProperty`;
  - `backdrop-filter` am Studio-Kopf machte ihn zum Bezugsrahmen der festen
    Leiste unten → am Handy ohne Filter;
  - unter MySQL ergab doppelt abgeschickt „vergeben“ statt denselben
    Termin → Kennung nach dem Sperren erneut prüfen.

### Gemessen

- Schnittstelle: `api/tests/pruefen.mjs` 88 Prüfungen, je dreimal auf
  SQLite und MariaDB 10.11 bestanden; 20 gleichzeitige Buchungen auf einen
  Platz → genau 1; 10 × „wer zuerst frei ist“ → jede der drei Personen
  einmal; 8 × dieselbe Anfrage gleichzeitig → ein Termin.
- Last: 200 gleichzeitige Buchungen in 0,6–0,8 s, 0 Überschneidungen in
  der Belegung (SQL-Prüfung), keine Serverfehler.
- Studio im Browser (`studio-oberflaeche.mjs`): Ziehen, Rückgängig,
  Abgleich zweier Geräte, Dauer, CSRF, Anlegen, Tastatur — bestanden.
- Keine Überbreite bei 390 und 360 px in allen Schritten der Buchung und
  allen Bereichen des Studios; keine Konsolenfehler.
- Kontrast: schwächstes Schrift-/Grund-Paar 7,6 : 1 (`--tinte-still` auf
  gewähltem Grund).
- Detektor über `termin.*` und `studio/*`: nur `dark-glow` (Hauptknopf,
  Lichtstange, Uhrzeitlinie im Kalender — das LED-Licht wie auf der
  ganzen Fassung) und `repeating-stripes-gradient` (Schraffur für „nicht
  verfügbar“ und Einwirkzeit im Kalender; das ist Bedeutung, nicht
  Schmuck). Farbkanten links (`side-tab`) und breite Schatten sind
  entfernt; die Person steht als Punkt vor der Uhrzeit.

## Fenster: Terminknöpfe der Salons auf gleicher Höhe (iPad)

- Ab 48 rem stehen die beiden Salonkarten nebeneinander (vorher erst ab
  52 rem — auf dem iPad hochkant untereinander).
- Die Knopfreihe entscheidet über einen Container-Query an der
  Kartenbreite, ob sie umbricht; beide Karten sind gleich breit, also
  brechen beide gleich um. Vorher brach nur „Termin in Großhadern buchen“
  um und stand auf dem iPad quer 61 px höher als Pasing.
- Unter 21 rem Kartenbreite heißt der Knopf „Termin buchen“ (der Salon
  steht als Überschrift darüber, `aria-label` nennt ihn weiter).
- Gemessen, Oberkante beider Knöpfe gleich: 768, 820, 1024, 1180 px.
  Handy (390) pixelgleich; Desktop (1440) bis auf die Kantenglättung
  von vier Buchstaben gleich.

## Fenster: Extensions und WhatsApp auf großen Schirmen neu geordnet

Vorher stand die fertige Nachricht links unter den Werten, die Schritte
rechts — man wählte rechts und las das Ergebnis links weiter oben; rechts
blieb unter „Methode“ ein Loch von rund 300 px, und die Knöpfe von
„Länge“ und „Wunsch“ brachen einzeln um.

Jetzt (ab 64 rem) zwei Bänder auf denselben Spaltenkanten:

1. links Titel, Spruch, Text, Werte | rechts das Formular: Farbregal, dann
   Länge, Wunsch, Methode als Zeilen (Beschriftung in fester Spalte, alle
   Knöpfe auf einer Kante bei x = 809 px auf 1440, Hinweis darunter)
2. links „Ihre Nachricht an“ (gleiche Schrift wie „Ihr Wunsch, in vier
   Schritten“), Salonwahl, Hinweis | rechts die Nachricht und der
   Sendeknopf — Überschrift und Textfeld beginnen auf derselben Höhe.

Unter 80 rem steht die Beschriftung über den Knöpfen statt daneben.

| | vorher | nachher |
|---|---|---|
| Höhe des Abschnitts 1440 px | 1455 px | 1482 px |
| Höhe 1920 px | 1452 px | 1479 px |
| größte Lücke rechts | ~300 px (unter Methode) | keine (Spalten enden 846 / 969 px) |
| umbrechende Knopfreihen | 2 | 0 (1024–1920 px) |
| Leserichtung | rechts → links zurück | oben → unten, links → rechts |

Handy, iPad hochkant und quer bis 1023 px pixelgleich zu vorher.
Verhalten getestet (Farbton, Länge, Wunsch, Methode, Salon → Nachricht und
WhatsApp-Link), keine Konsolenfehler, Kontrast der kleinsten Zeilen
≥ 8,6 : 1, Detektor unverändert (5 × dark-glow, gewollt).

## Fenster: Preise auf großen Schirmen — der Schrank nimmt die ganze Breite

Vorher (ab 80 rem) stand links Überschrift, Text und Knopf, rechts der
Etikettenschrank mit zwei Reihen à vier; links blieb unter dem Text und
unter dem Knopf eine leere Fläche.

Jetzt (ab 80 rem):

- Kopfzeile in zwei Spalten: Schild und Handschrift links, der Text rechts
  auf der Grundlinie der Handschrift. Die Handschrift bricht fest hinter
  dem Gedankenstrich um (`.zeilenrest`, nur ab 80 rem als Block).
- Der Schrank über die volle Breite: eine durchgehende Stange, alle acht
  Etiketten in einer Reihe. Oben im Schrank links die Salonwahl, rechts
  „Zur vollständigen Preisliste“.
- Beim Hineinscrollen hängen sich die Etiketten nacheinander ein (vom
  Haken aus, leicht schräg, ausbremsend; 0,6 s, 220 ms versetzt).
  Gemessen höchstens drei gleichzeitig in Bewegung. Nur wenn der Schrank
  beim Laden noch nicht im Bild ist; ohne Skript und bei reduzierter
  Bewegung hängen sie einfach da.

Gemessen: kein Überlauf von Namen oder Preisen bei 1280–1920 px, keine
Überbreite, keine Konsolenfehler, Kontrast ≥ 12 : 1, Detektor unverändert
(5 × dark-glow, gewollt). Unter 80 rem (390, 820, 1024, 1180, 1279 px)
pixelgleich zu vorher. Höhe des Abschnitts 1440 px: 809 → 828 px.

### Nachtrag: der Schrank auch auf dem iPad

Die Anordnung galt zuerst erst ab 80 rem; auf dem iPad (768–1366 px) stand
noch der schmale Schrank mit leerer Fläche daneben und einem einzelnen
Knopf darunter. Jetzt:

- ab 48 rem (iPad hochkant): Schrank über die volle Breite, zwei Stangen à
  vier, Salonwahl und „Zur vollständigen Preisliste“ oben im Schrank,
  die Etiketten hängen sich ein;
- ab 64 rem (iPad Pro hochkant, iPad quer): Kopfzeile zweispaltig;
- ab 72 rem (iPad Air/Pro quer, 1180 px und mehr): eine Stange, alle acht.

Gemessen bei 768, 820, 1024 und 1180 px: kein Überlauf, keine Überbreite,
höchstens drei Etiketten zugleich in Bewegung, keine Konsolenfehler.
Handy (360, 390) und Desktop (1280, 1440, 1920) pixelgleich zum Stand davor.

---
name: salon-website
description: Norm für Websites inhabergeführter Salons und Studios (Friseur, Extensions, Kosmetik, Barbier) — statisch, ohne Build, auf GitHub Pages. Ablauf von der Recherche bis zur Live-Abnahme, Gestaltungsregeln aus dem echten Laden, Wahrheitsregeln für Preise und Aussagen, Prüfskripte (Aufnahmen, Überbreite, Kontrast) und die Fallen, die schon zugeschlagen haben. Benutzen bei „Website für Salon X“, „neue Fassung“, „Redesign nach der Vision der Inhaberin“, „Preisliste von Planity/Treatwell“, „Schleife/Logo/Ornament aus einem Foto nachbauen“. Zusammen mit dem Skill impeccable einsetzen, nicht statt seiner.
---

# Salon-Website — die Norm

Entstanden im Projekt Irmonhair (drei Fassungen, zwei Prüfrunden je
Fassung). Alles hier ist gemessen oder hat schon einmal einen Fehler
verursacht. Übertragbar auf jeden Salon: den Ordner
`.claude/skills/salon-website/` ins neue Repo kopieren, dazu
`vorlagen/CLAUDE.md` als `CLAUDE.md` in die Wurzel.

## 1. Ablauf

1. **Einrichten.** Repo-Wurzel = Seite. `.github/workflows/deploy-pages.yml`
   deployt bei jedem Push. Pages einmal von Hand auf „GitHub Actions“
   stellen (mit `GITHUB_TOKEN` geht das nicht). Server lokal:
   `python3 -m http.server 8099`.
2. **Recherche, bevor gestaltet wird.**
   - Buchungsdienst (Planity, Treatwell, …) öffnen: Preise, Dauer, Fotos,
     Bewertungen. Rohdaten als JSON unter `recherche/` ablegen.
   - Alte Website nur als zweite Quelle. Weicht sie ab, gilt der
     Buchungsdienst, und die Abweichung kommt in `ABNAHME.md`.
   - Koordinaten der Salons aus OpenStreetMap, auf die Hausnummer genau.
3. **Welt festlegen** mit impeccable (`context.mjs` → `new-work.md` →
   `craft-floor.md`). Den Richtungsvertrag als Kommentar gleich nach
   `<body>` schreiben: THESE, EIGENE WELT, ERSTER BILDSCHIRM, FORM.
   Hat die Inhaberin Vorlagen/Visionsbilder geschickt, **gewinnen die** —
   auch gegen jeden Zufallswurf und jeden Geschmack.
4. **Bauen** — Token zuerst (`:root`), dann Seiten. Wiederkehrende
   Ornamente über einen Generator mit Marken (Abschnitt 5).
5. **Prüfen** (Abschnitt 7), dann **Abschlussprüfer** (impeccable
   finish-reviewer) mit gültigen Aufnahmen, höchstens zwei Runden.
6. **Dokumentieren**: impeccable documenter schreibt `DESIGN.md` +
   `.impeccable/design.json` aus dem gebauten Stand. Danach den Detektor
   noch einmal laufen lassen — ab jetzt gleicht er gegen das System ab.
7. **Übergabe**: `UEBERGABE.md` (was, warum, gemessen) und `ABNAHME.md`
   (was nur der Salon beantworten kann). Commit, Push, Live-URL abfragen,
   bis die Änderung wirklich ausgeliefert ist — erst dann „fertig“.

Neue Fassungen nie über die alte bauen: eigener Pfad (`/alt/`,
`/schleife/`), `noindex`, eigene Kopie von CSS/JS/Bildern. Die
Hauptadresse wechselt erst auf Zuruf.

## 2. Gestaltung

- **Die Atmosphäre kommt aus dem Laden.** Palette, Schrift, Material aus
  den echten Fotos. Prüftest für die Leitfarbe: Verschwände sie, wenn der
  Laden den Lieferanten wechselt? Dann ist sie nicht seine.
- **Die Person im ersten Bildschirm**, sobald es ein echtes Foto gibt.
  Bis dahin: der Raum, und das fehlende Porträt steht in `ABNAHME.md`.
- **Eine eigene Idee pro Seite**, die klein funktioniert (Spiegel mit
  Licht, Farbregal mit Haarsträngen). Was nur groß wirkt, ist Schaustück.
- **Schild und Handschrift.** Spricht der Laden in gesperrten Versalien
  und Schreibschrift, sprechen die Überschriften genauso: ein Wort als
  Schild (`letter-spacing ≈ .28em`, Linie darunter), darunter eine Zeile
  Handschrift. Kein „leicht + kursives Goldwort“-Muster aus einer
  anderen Fassung weitertragen.
- **Licht als Kante, nie als Fläche.** Hauptknopf schwarz mit leuchtender
  Kante und engem Schein; Nebenknöpfe nur mit Linie. **Eine Lampe pro
  Knopfgruppe** — leuchten zwei, führt keiner.
- **Zweite Farbe nur als Ornament.** Auf einer hellen Insel (Stein,
  Papier) jede Farbe neu messen, nicht invertieren.
- **Fotos:** Bildauswahl ist Gestaltung. Kein Bild über seine Vorlage
  gezogen. **Dasselbe Motiv nie zweimal auf einer Seite** (Auftakt und
  Karte). Detailausschnitte aus hochaufgelösten Originalen sind
  willkommen, wenn sie scharf bleiben.
- **Galerie:** am Handy zwei Bilder nebeneinander, am Desktop drei;
  einheitliches 3:2, Kachel ohne Symbol und ohne Text darauf, Klick
  öffnet eine Ansicht mit Blättern, Esc und Rückkehr an dieselbe Stelle.
- **Material echt statt gemalt.** Stein aus einem Fotoausschnitt
  (nahtlos gemacht, hell überlegt), Haar aus einer Textur mit weich
  auslaufender Maske — keine Rauschmuster, die „Stoff“ oder „Wasser“
  sagen.
- **Keine Füllfarbe aus einer hellen Vorgängerfassung** übernehmen:
  Hover-Flächen, Menü-Knöpfe, `theme-color` einmal gezielt suchen.

## 3. Wahrheit

- Nur echte Preise, Zeiten, Fotos. Nie Platzhalter.
- **Aussagen aus Visionsbildern sind keine Belege.** „100 %“, „über 100
  Farbtöne“, „Premium“, „schonend & unsichtbar“ erst nach schriftlicher
  Bestätigung; bis dahin weglassen und in `ABNAHME.md` fragen.
- **Stückpreise sind kein Einstieg.** „ab 7 €“ pro Strähne neben
  „Haarverlängerung“ liest sich als Preis der Leistung — in Übersichten
  zählen nur Leistungspreise (`pro …` ausschließen).
- Preislisten werden **generiert** (Skript schreibt zwischen
  `<!-- preise:… -->`-Marken) und brechen ab, wenn ein Posten nicht
  zugeordnet ist. Nach Ablauf gegliedert, nicht alphabetisch.
- Illustrative Elemente (Farbproben, Stränge) so beschriften:
  „Farbbeispiel, am Bildschirm angenähert“.
- Standort-Finder rechnet nur im Browser; das steht im Datenschutz.

## 4. Technik

- HTML, CSS, Vanilla JS. Keine Abhängigkeiten, keine CDNs, Schriften
  lokal (OFL) mit `font-display: swap` und Preload der zwei wichtigsten.
- **Jeder Gestaltungswert ist ein Token in `:root`.** Alpha-Stufen
  entstehen aus dem Token: `color-mix(in oklch, var(--gold) 35%,
  transparent)`. Kein Rohwert im Stil — sonst meldet der Detektor nach
  `DESIGN.md` jede Stelle.
- Kanten als `border`, nicht als `box-shadow: 0 0 0 1px` (zählt als
  Glühen).
- Termin statt Warenkorb: Auswahl sammeln → fertiger Satz zum Kopieren
  → Buchungsdienst je Salon. Kein Server.
- Salonwahl ohne Skript über Radioknöpfe und `:has()`.

## 5. Ornamente aus einer Vorlage nachbauen

Beispiel: `beispiele/schleife.py` (die Schleife vom Schaufenster).

1. Den Ausschnitt aus dem Foto nehmen und **im Koordinatenraum dieses
   Ausschnitts** zeichnen (viewBox = Ausschnittgröße). Nebeneinander
   rendern und vergleichen, bis die Silhouette stimmt.
2. **Teile von hinten nach vorn** zeichnen; jedes Teil trägt seine Kante
   selbst, damit das vordere die hintere verdeckt.
3. **Volumen:** Verlauf je Fläche (Licht von der Seite der Lampe im
   Foto), weiche Glanzbahnen (Weichzeichner, 13–16 % Weiß), dunkle
   Innenseiten.
4. **Licht nur dort, wo es im Foto steht** (meist Außen- und
   Unterkanten), die übrigen Kanten nur als Hauch; Hinterleuchtung als
   stark weichgezeichnete Silhouette dahinter.
5. **Ein Generator, mehrere Einsätze** über Marken
   (`<!-- schleife:gross -->` …): Auftakt, Ladebildschirm, Logo,
   Favicon. Jede Kopie bekommt ein eigenes ID-Präfix.
6. **Ein Zeichen in 40 px ist ein Ausschnitt, keine Verkleinerung** —
   beim Logo nur das Erkennbare (Schlaufen und Knoten), der Rest läuft
   über eine Maske aus.
7. Farbe des Lichts als SVG-Attribut, nur Breite und Animation in CSS
   (CSS-`stroke` überschreibt das Attribut).

## 6. Bewegung

`ease-out`, 0,3–0,9 s, nur `transform`/`opacity` (SVG-Striche über
`stroke-dashoffset` mit `pathLength="1"`), höchstens drei gleichzeitig,
`prefers-reduced-motion` bedienen. Ladebildschirm: frühestens 0,9 s,
spätestens 1,8 s, ohne Skript nach 4 s aus dem Bild geschoben — und was
er zeigt, muss auch stehen, wenn nichts lädt.

## 7. Prüfen statt behaupten

Skripte in `scripts/` (Playwright; Pfad über `PLAYWRIGHT_PFAD`):

| Prüfung | Aufruf | Soll |
|---|---|---|
| Aufnahmen 1440 + 390, angesehen | `node scripts/aufnahme.mjs <url> 1440 900 .impeccable/review/desktop.png` | jeder Auftritt fertig, Leiste ganz da/weg |
| Überbreite 390 + 360 | `node scripts/breite.mjs <url> 360` | `"ok":true` |
| Kontrast gegen gerenderten Grund | `node scripts/kontrast.mjs 390x844 seite.html '.lauf,.knopf'` | „alles über der Grenze“ |
| Detektor | `node .claude/skills/impeccable/scripts/detect.mjs --json <ordner>/` | `[]` oder nur begründete Meldungen aus der Übergabe |
| Konsole | `pageerror` + `console.error` abfangen | leer |
| Verhalten | eigener Kurztest: Umschalter, Auswahl, Ansicht, Tastatur, ohne Skript | alles grün |

Behauptungen über Größe, Tempo, Richtung **messen**. Die kleinste Zeile
über Bild oder Stein scheitert zuerst — sie wird dunkler oder an eine
dichtere Stelle gesetzt, nicht der Schleier gedreht.

## 8. Fallen

| Falle | Auflösung |
|---|---|
| `#` in einer SVG-Daten-URI (Masken, Muster) → Bild bleibt still leer | als `%23` kodieren |
| Prüfaufnahmen mitten im Auftritt → Prüfer verwirft sie | `auftritt-da` setzen, 1,2 s warten, letzte Kachel an `scrollHeight − h` |
| Nach `DESIGN.md` meldet der Detektor jede Rohfarbe, jeden Zwischengrad | Tokens + `color-mix`; Schrifttreppe als `typography.scale` dokumentieren |
| CSS-`stroke` überschreibt das `stroke`-Attribut im SVG | Farbe am Element, Breite in CSS |
| Mehrere Inline-Kopien desselben SVG → Verläufe verweisen auf die falsche | ID-Präfix je Einsatz |
| Helle Hover-Flächen aus der Vorgängerfassung auf dunklem Grund | nach `98%`/`97%`-Hellwerten und `theme-color` suchen |
| Doppeltes Motiv: Auftaktbild wandert beim Tauschen in die Karte | nach dem Tausch alle `src` der Seite vergleichen |
| Stückpreis als „ab“-Einstieg | `pro …` beim Minimum ausschließen |
| Polygon-Spitzen an organischen Formen (Haar) | Maske mit Verjüngung und Alpha-Verlauf |
| Zwei gleich wichtige Knöpfe nebeneinander | nur der Hauptknopf leuchtet |

Die älteren Fallen (sticky, Pointer-Capture, `[hidden]`, Grid-Stapel,
Hysterese, WebView-Textaufblähung …) stehen in `vorlagen/CLAUDE.md`.

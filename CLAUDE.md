# Arbeitsweise für dieses Projekt

Übernommen aus dem JaSuVi-Projekt — Konventionen, Vorlieben des Auftraggebers
und Fallen, die dort tatsächlich zugeschlagen haben.

## Sprache

Alles auf Deutsch: Oberfläche, Kommentare im Code, Commit-Nachrichten, Antworten.
Kein Modellname in Commits, PR-Texten oder Codekommentaren.

## Bauart

Statische Seite: HTML, CSS, Vanilla JS. **Kein Build-Schritt, keine Abhängigkeiten.**
Ausliefern über GitHub Pages, `.github/workflows/deploy-pages.yml` deployt bei
jedem Push. Nach dem Push die Live-URL abfragen, bis die Änderung wirklich
drin ist — erst dann als fertig melden.

Gestaltungswerte gehören als Token in `:root`, nie verstreut. Farben, Abstände,
Kurven, Muster (als SVG-Daten-URI) — alles an einer Stelle.

## Gestaltung: was der Auftraggeber will

- **Die Atmosphäre kommt aus dem Laden, nicht aus einer Vorlage.** Palette,
  Schrift und Bildsprache werden aus dem echten Ort abgeleitet: aus den Fotos,
  dem Material, dem Licht, der Kundschaft. Kein Farbschema aus einem früheren
  Projekt übernehmen — Gold auf Schwarz war die Antwort für ein japanisches
  Restaurant, nicht die Handschrift des Auftraggebers. Erst schauen, dann
  festlegen; die Leitfarbe hat einen Grund im Laden zu haben.
- **Gemessen reicht nicht — die Farbe muss dem Laden gehören.** Hier wurde
  einmal das Türkis der Moroccanoil-Regale zur Leitfarbe gemacht, weil es an
  jeder Wand hing und sauber gemessen war. Es ist trotzdem die Markenfarbe
  eines Lieferanten, und die Seite wirkte damit aufgesetzt. Prüftest: Würde
  diese Farbe verschwinden, wenn der Laden den Lieferanten wechselt? Dann ist
  sie nicht seine Handschrift. Was bleibt, ist das eigene Material — bei
  einem Friseur das Haar und die Person, die es macht.
- **Bei einem inhabergeführten Betrieb steht die Person im ersten
  Bildschirm.** Nicht das Material, nicht der Raum, nicht eine Idee über den
  Beruf. Die Leute kaufen die Person. Eine originelle Idee darf danach
  kommen, aber nicht dort, wo die Besucherin wissen will, wer hier schneidet
  und was es kostet.
- **Eine eigene Idee muss auch klein funktionieren.** Der Farbfächer aus acht
  Kartonblättern war originell und fraß einen halben Bildschirm an der
  wichtigsten Stelle. Geblieben ist derselbe Gedanke als Tonprobe neben dem
  Preis: zwei Farbproben, aus dem Foto genau dieser Arbeit gemessen. Wenn
  eine Idee nur groß funktioniert, ist sie meistens ein Schaustück.
- **Kommt eine zweite Farbe dazu, tritt sie nur als Ornament auf**, nie als
  Textfarbe. Sonst kippt die einmal gesetzte Ordnung.
- **Eine dunkle Variante ist keine Umkehrung.** Die Leitfarbe muss von der
  anderen Seite neu gemessen werden, die Ankerfläche geht tiefer statt
  höher, und ein feines dunkles Muster auf dunklem Grund ist kein feines
  Muster, sondern keines.
- **Vollflächige Fotohintergründe.** Bilder tragen ganze Abschnitte, nicht als
  Kachel daneben. Darüber ein mehrstufiger Schleier: von oben und unten in den
  Abschnittsrand hinein, seitlich dichter dort, wo Text steht. Der Schleier
  nimmt die Grundfarbe der Seite auf — hell wie dunkel. Am schmalen Schirm
  greift der seitliche Verlauf oft genau in den Text; dort gleichmäßig
  überlagern statt seitlich.
- **Eine eigene Idee pro Seite**, die es sonst nirgends gibt. Etwas Räumliches,
  das zum Laden gehört.
- **Ein Schleier, der das Bild rettet, tötet es.** Wenn ein Film oder ein
  Foto den ganzen Bildschirm trägt, darf der Schleier nicht über die ganze
  Fläche gehen — dann sieht man ihn und nicht das Bild. Ein Schatten hinter
  dem Textblock reicht; vier Fünftel der Aufnahme bleiben offen.
- **Eine Leiste, die dauerhaft über dem Bild steht, versperrt die Sicht.**
  Beim Runterscrollen weicht sie aus, beim Hochscrollen kommt sie zurück.
- **Zurückhaltung beim Ornament.** Wenige Einsätze, dafür an Stellen, wo sie
  inhaltlich etwas bedeuten. Lieber zu leise als zu laut — zurücknehmen ist
  schwerer als nachlegen.
- **Echte Inhalte.** Richtige Preise, richtige Öffnungszeiten, richtige Fotos.
  Nie Platzhalter, nie Blindtext, nie „hier Ihr Text".
- **Ein Film gehört nur dorthin, wo sein Format passt.** Eine 16:9-Aufnahme
  am Hochkantschirm zeigt einen Mittelstreifen von einem Viertel der Breite.
  Dann lieber Standbilder mit eigenem Hochkantzuschnitt.
- **Der Ladezustand soll die Rückfallebene sein.** Was steht, solange der
  Film lädt, muss auch dann stehen, wenn er nie kommt — sonst gibt es ein
  Zwischenbild, das aussieht wie ein Fehler.
- **Ein Standbild aus einem Video ist kein Foto.** Es taugt in der Größe, in
  der es aufgenommen wurde, und nicht darüber. Prüftest vor dem Einsetzen:
  Kantenenergie bei gleicher Breite gegen die vorhandenen Aufnahmen messen —
  liegt sie bei einem Drittel, gehört das Bild an eine kleinere Stelle, nicht
  auf die Fläche.
- **Der Rahmen gibt nicht das Format vor, die Aufnahme tut es.** Ein
  erzwungenes `aspect-ratio` mit `object-fit: cover` schneidet einer
  Aufnahme im falschen Format genau das weg, worum es geht.
- **Bildauswahl ist Gestaltung.** Eine Aufnahme, auf der das Haar kraus,
  fahl oder farbstichig aussieht, macht die Arbeit schlechter, als sie ist —
  bei einem Friseur ist das Foto das Produkt. Lieber acht saubere Bilder als
  zwölf, von denen vier schaden. Kein Bild wird über seine Vorlage hinaus
  gezogen; ein Bild, das kleiner bleibt, sieht besser aus als ein gezogenes.
- Impressum und Datenschutz als eigene Seite. Copyright in den Footer.
  Telefonnummer schon auf dem ersten Bildschirm.

## Struktur für Salon und Studio

Was hier den Platz der Speisekarte einnimmt:

- **Leistungen mit Preisen** als eigene Seite, nach Ablauf gegliedert statt
  alphabetisch — was zuerst passiert, steht zuerst. Nicht alles auf einmal
  sichtbar; ein Navigator über den Gruppen, der beim Runterscrollen ausweicht.
- **Termin statt Warenkorb.** Der Weg zum Termin ist das, was der Warenkorb
  beim Restaurant war: Auswahl sammeln, daraus einen fertigen Text bauen, den
  der Gast selbst per WhatsApp schickt oder am Telefon durchgibt. Kein Server,
  keine Zahlung. Falls ein Buchungsdienst im Einsatz ist, verlinken wir ihn —
  aber erst prüfen, was er wirklich ist (bei JaSuVi entpuppte sich der
  vermeintlich eigene Bestellshop als Lieferando-Ableger).
- **Vorher/Nachher oder Arbeiten** statt Galerie der Gerichte. Fotos anklickbar,
  aber ohne Symbol und ohne Beschriftung auf der Kachel.
- **Das Team** mit Gesichtern — bei Salons kaufen Leute die Person, nicht den
  Laden.

## Bewegung

- Nur `ease-out`-Kurven, kein Federn, kein Zurückschwingen.
- Nie Layout-Eigenschaften animieren — `transform` und `opacity`.
- Hover-Effekte hinter `@media (hover: hover) and (pointer: fine)`.
- `prefers-reduced-motion` immer bedienen. Was ruhend sinnlos aussieht
  (rieselnde Partikel), wird dort ganz abgeschaltet statt eingefroren.
- Dauern zwischen 0,3 s und 0,9 s. Endlosschleifen deutlich langsamer.
- **Tempo aus gemessenen Werten rechnen, nicht aus festen Dauern**, sobald die
  Strecke von Schriftgröße oder Inhalt abhängt.
- **Höchstens drei Bewegungen gleichzeitig.** Vier gleichzeitig anlaufende
  Bewegungen kann das Auge nicht mehr einzeln verfolgen; es sieht dann nur
  noch, dass sich etwas bewegt, nicht mehr was. Der Rest kommt als nächste
  Gruppe, rund 90 ms später.
- **Auftritt bremst aus, Abgang beschleunigt.** Andersherum sieht es aus, als
  würde etwas weggezogen und dann hingeworfen.
- **Eine Kamerafahrt fährt heran, nicht heraus.** Wer heranfährt, schneidet
  den Rand der Aufnahme weg; wer herausfährt, deckt ihn auf — und am Rand
  einer Salonaufnahme stehen Föhn, Steckdose und Bodenfliesen.

## Prüfen statt behaupten

Vor jeder Fertigmeldung:

1. Screenshot auf 1440 px **und** 390 px, angeschaut — nicht nur erzeugt.
2. `node .claude/skills/impeccable/scripts/detect.mjs --json` muss `[]` liefern.
3. Konsolenfehler abfragen (`pageerror`), nicht hoffen.
4. Behauptungen über Geschwindigkeit, Richtung, Position **messen**. Im
   JaSuVi-Projekt stellte sich mehrfach heraus, dass die Vermutung falsch war
   und erst die Messung den echten Fehler zeigte.

Wenn etwas unklar ist — etwa welches Gericht auf einem Foto liegt — lieber
weglassen und nachfragen, als raten. Ein falsch beschriftetes Foto ist
schlimmer als ein unbeschriftetes.

## Fallen, die schon zugeschlagen haben

| Falle | Auflösung |
|---|---|
| `position: sticky` meldet beim Scrollen die Klebeposition — auch über `offsetTop` | Festen Anker davor setzen und dessen `offsetTop` nehmen |
| `setPointerCapture` lenkt das spätere `click`-Event auf das Capture-Ziel um | Gedrücktes Element beim `pointerdown` merken |
| `preserve-3d` löst sich schneidende Flächen nicht sauber auf | Getrennte 3D-Ebenen mit gleicher Perspektive stapeln |
| Richtungswechsel einer CSS-Animation springt mitten im Muster | Versatz selbst per `requestAnimationFrame` fortschreiben |
| Android-WebViews (u. a. WhatsApp) blasen Text auf → Laufschrift rast | `text-size-adjust: 100%` **und** Dauer aus gemessener Breite |
| `[hidden]` verliert gegen Klassen, die `display` setzen | `[hidden] { display: none !important; }` |
| Grid mit zwei Kindern erzeugt zwei Zeilen | `grid-area: 1 / 1` zum Stapeln |
| Scroll-Umschalter flackert beim sanften Auslaufen | 6 px Hysterese |
| Viele DOM-Zeilen einzeln einfügen ruckelt | `DocumentFragment` + `replaceChildren` |
| Zwei `set` an derselben Stelle einer GSAP-Zeitleiste laufen beim Rückwärtslesen in umgekehrter Reihenfolge | Ausgangszustand außerhalb der Zeitleiste setzen |
| Eine spezifischere Nachbarregel (`.wegweiser a`, zwei Klassen) hebelt eine Ein-Klassen-Regel aus — auch bei Polsterung, nicht nur bei Farbe | Die Regel mit dem Elternselektor davor schreiben, nicht mit `!important` |
| Ein Schleierfenster, das „über dem Bild offen" ist, kann vollständig hinter einer Karte liegen | Kanten von Text und Karte messen, dann die Verlaufsstufen daraus rechnen |
| Ein Farbtoken, dessen Name sich mit „auf X" oder „unter X" ergänzen lässt, trägt zwei Aufgaben, sobald X in einer Variante anders hell ist | Entzweien, bevor die dunkle Variante kommt — nicht danach |
| `position: relative` für ein `::before` überschreibt `position: sticky`, wenn die Regel spezifischer ist | `sticky` ist selbst schon Bezugsrahmen; die Zeile ist überflüssig |
| `:nth-of-type` zählt nach Elementtyp, nicht nach Klasse — ein `<video>` zwischen `<div>`-Ebenen ist „das erste seiner Art" | Den Elementtyp aus dem Selektor halten (`:not(.klasse):nth-of-type(n)`) |
| Ein Video am Scrollrad entlangzuspulen kostet so viel, wie zwischen den Schlüsselbildern liegt | Schlüsselbilder in der Datei zählen; sind es wenige, linear abspielen und nur die Kamera scrollen |
| Ein Verlauf, dessen letzter Halt vor 100 % liegt, wird vom eigenen Kasten abgeschnitten — man sieht eine gerade Linie quer durchs Bild | Radius und letzten Halt so setzen, dass die Ellipse innerhalb ihres Kastens auf null ausläuft |
| Eine neue Klasse mit einem schon vergebenen Namen zerlegt die andere Seite still — hier wurde aus einem Spaltenraster ein 3000 px breiter Streifen | Vor dem Benennen `grep` über alle Seiten |
| Die kleinste Zeile über einem Bild ist die, die am Kontrast scheitert — gesperrte Kapitälchen in 12 px haben keine Reserve | Nicht am Verlauf drehen, sondern die Zeile dorthin setzen, wo der Schleier ohnehin dicht ist |
| Bei einem radialen Verlauf zählt der Abstand in beiden Achsen zusammen — an den Enden einer breiten, tiefen Zeile liegt der Punkt schon bei 82 % des Radius | Für einen breiten Textblock ein senkrechtes Band nehmen, keine Ellipse |
| Zwei Regeln mit demselben Selektor: die zweite gewinnt, und die erste sieht im Quelltext richtig aus | Nach dem Einfügen `grep -c` auf den Selektor |

## Zugänglichkeit

Jede klickbare Fläche braucht einen Namen — auch wenn sie bewusst unsichtbar
bleibt. Sichtbarer Fokusrahmen über `:focus-visible`. Dekoratives bekommt
`aria-hidden="true"`.

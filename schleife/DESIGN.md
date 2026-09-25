---
name: Irmonhair — Fassung „Schleife“
description: Das Schaufenster an der Irmonherstraße bei Nacht — warmes Schwarz, LED-Gold nur als Kante, Travertin als einziger heller Raum.
colors:
  papier: "oklch(14.5% .008 55)"
  papier-tief: "oklch(17.5% .01 55)"
  weiss: "oklch(19.5% .012 55)"
  knopf-grund: "oklch(10.5% .006 55)"
  nacht: "oklch(11% .006 55)"
  nacht-tief: "oklch(9.5% .005 55)"
  tinte: "oklch(94% .014 85)"
  tinte-leise: "oklch(84% .016 82)"
  tinte-still: "oklch(74% .02 80)"
  nacht-schrift: "oklch(95% .01 85)"
  nacht-still: "oklch(78% .02 80)"
  gold: "oklch(85% .1 84)"
  gold-tief: "oklch(76% .1 80)"
  gold-wort: "oklch(86% .09 84)"
  gold-schrift: "oklch(83% .095 84)"
  gold-hell: "oklch(88% .07 88)"
  knopf-kante: "oklch(89% .095 86)"
  led-schein: "oklch(84% .1 84 / .45)"
  linie: "oklch(92% .02 80 / .14)"
  linie-stark: "oklch(92% .02 80 / .3)"
  linie-gold: "oklch(84% .1 84 / .5)"
  travertin: "oklch(88% .022 78)"
  travertin-tinte: "oklch(20% .012 60)"
  travertin-gold: "oklch(46% .09 66)"
  travertin-hand: "oklch(34% .08 62)"
  travertin-hell: "oklch(93% .018 80)"
  travertin-tief: "oklch(80% .026 74)"
  travertin-still: "oklch(29% .018 62)"
  travertin-linie: "oklch(30% .02 60)"
  sterne: "oklch(56% .11 70)"
  weiss-licht: "oklch(100% 0 0)"
  schatten: "oklch(0% 0 0)"
  bronze: "oklch(36% .04 70)"
  linie-gold-hell: "oklch(86% .075 88)"
  offen: "oklch(62% .15 150)"
typography:
  display:
    fontFamily: "Jost, Mulish, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.2rem + 4vw, 4.8rem)"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: ".3em"
  headline:
    fontFamily: "Jost, Mulish, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 1.3rem + 2.6vw, 3.3rem)"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: ".28em"
  handschrift:
    fontFamily: "Sacramento, Segoe Script, cursive"
    fontSize: "clamp(1.9rem, 1.5rem + 1.2vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1.05
  title:
    fontFamily: "Jost, Mulish, system-ui, sans-serif"
    fontSize: "1.7rem"
    fontWeight: 300
    lineHeight: 1.1
  body:
    fontFamily: "Mulish, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Jost, Mulish, system-ui, sans-serif"
    fontSize: ".72rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: ".16em"
  button:
    fontFamily: "Jost, Mulish, system-ui, sans-serif"
    fontSize: ".8rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: ".16em"
  scale:
    mini: ".72rem"
    knopf: ".8rem"
    klein: ".85rem"
    notiz: ".92rem"
    lese: "1rem"
    fliess: "1.0625rem"
    zwischen: "1.25rem"
    zahl: "1.5rem"
    titel: "1.7rem"
    stufe-2-2: "2.2rem"
    stufe-2-5: "2.5rem"
    stufe-3: "3rem"
    stufe-4-6: "4.6rem"
  preis:
    fontFamily: "Jost, Mulish, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 500
    lineHeight: 1.2
    fontFeature: "tnum, lnum"
rounded:
  klammer: "1px"
  fokus: "2px"
  nische: "3px"
  pille: "999px"
  bogen-fuss: "6px"
  rahmen-fuss: "10px"
spacing:
  a2: "1rem"
  a3: "1.75rem"
  a4: "3rem"
  a5: "5rem"
  a6: "8rem / 10rem ab 64rem"
  rand: "1.25rem / 2rem ab 48rem / 2.75rem ab 64rem"
components:
  button-primary:
    backgroundColor: "{colors.knopf-grund}"
    textColor: "{colors.tinte}"
    typography: "{typography.button}"
    rounded: "{rounded.pille}"
    padding: ".85rem 1.65rem"
    height: "3.1rem"
  button-still:
    backgroundColor: "transparent"
    textColor: "{colors.tinte}"
    typography: "{typography.button}"
    rounded: "{rounded.pille}"
    padding: ".85rem 1.65rem"
    height: "3.1rem"
  button-still-auf-travertin:
    backgroundColor: "transparent"
    textColor: "{colors.travertin-tinte}"
    rounded: "{rounded.pille}"
  chip-wahl:
    backgroundColor: "transparent"
    textColor: "{colors.tinte-leise}"
    rounded: "{rounded.pille}"
    padding: ".6rem 1.15rem"
    height: "2.75rem"
  chip-wahl-gewaehlt:
    backgroundColor: "oklch(84% .1 84 / .12)"
    textColor: "{colors.tinte}"
  karte-satin:
    backgroundColor: "{colors.weiss}"
    textColor: "{colors.tinte}"
    padding: "1.75rem"
  schalter-gewaehlt:
    backgroundColor: "{colors.knopf-grund}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.pille}"
  leiste:
    backgroundColor: "oklch(14.5% .008 55 / .82)"
    textColor: "{colors.tinte-leise}"
    typography: "{typography.label}"
    height: "64px / 72px ab 48rem"
---

# Design System: Irmonhair — Fassung „Schleife“

Gilt nur für die Welt unter `/schleife/`. Die Spiegel-Fassung im Wurzelverzeichnis ist eine eigene Welt und folgt diesem Dokument nicht. Die Tokennamen in `neu.css` stammen aus der Spiegel-Fassung und passen nicht immer zu ihrem Wert (`--weiss` ist dunkler Satin, `--serif` ist Jost, `--gold-metall` ist der schwarze Rahmen); das Frontmatter behält sie, damit jeder Eintrag auf eine echte Variable zeigt.

## Overview

**Creative North Star: „Das Schaufenster bei Nacht“**

Die Seite ist das Fenster der Irmonherstraße nach Ladenschluss: eine warme schwarze Fläche, in der Licht nur dort sitzt, wo ein Ding eine Kante hat. Gold leuchtet nicht flächig, es läuft als LED-Linie um die Schleife, den Spiegel, den Hauptknopf und die gewählte Strähne. Alles andere bleibt Satin, Creme-Schrift und dunkle Haarlinien.

Die Stimme hat zwei Register, wie die Beschriftung am Fenster: gesperrte, dünne Jost-Versalien als Schild, darunter eine Zeile in Sacramento wie die Handschrift der Inhaberin. Lauftext in Mulish bleibt ruhig und hell. Einmal auf der Seite öffnet sich ein heller Raum — Travertin, die Steinfassade um das Fenster —, und dort tragen die Stimmen der Kundschaft.

Die Dichte ist die eines Schaufensters: große Abstände (bis 10rem zwischen Abschnitten), wenige Elemente pro Ansicht, jedes mit Luft. Die eigene Idee der Seite ist räumlich und gehört dem Laden: die leuchtende Schleife am Spiegel im ersten Bildschirm und das Farbregal mit zehn lang hängenden Haarsträngen.

**Key Characteristics:**
- Warmes Schwarz (Hue 55) als Grund, drei Stufen Satin darüber, der Fuß noch tiefer.
- LED-Gold als Kante, Linie, Schein — nie als Fläche.
- Travertin als einzige helle Fläche, mit echter Steintextur.
- Schild in Jost 300 mit weiter Sperrung, darunter Handschrift in Sacramento.
- Knöpfe schwarz mit Pillenform; nur der Hauptknopf trägt Licht.
- Zeichnungen (Schleife, Herz) als feine Linie, flach, ohne Volumen.

## Colors

Eine warme Nachtpalette aus einem Farbton (Hue 55–85), in der das Gold nur durch Helligkeit und Chroma, nie durch Fläche auffällt.

### Primary
- **LED-Gold** (`gold`): Die Lichtkante. Unterstrich der Schilder (Verlauf ins Transparente), Sternfüllung, Rand der gewählten Wahl, Fokusrahmen im Regal. Immer 1–1,6 px oder als Schein.
- **Kantenlicht** (`knopf-kante`): Die hellste Goldstufe, reserviert für die Kante des Hauptknopfs, des gewählten Umschalters und der gewählten Salonkarte.
- **LED-Schein** (`led-schein`): Der weiche Hof um eine leuchtende Kante (Hauptknopf, Spiegel-Innenkante, gewählte Strähnenklammer). Nie auf mehr als diesen drei Elementen.
- **Tiefes Gold** (`gold-tief`): Ruhe- und Hover-Stufe der Linie: Hover-Rand der stillen Knöpfe, Unterstrich der Rufnummer, Fokusrahmen `:focus-visible`.
- **Handschrift-Gold** (`gold-wort`): Die einzige Schriftfarbe aus der Goldfamilie in großer Größe — ausschließlich für die Sacramento-Zeile und das hervorgehobene Wort im Regal-Satz.
- **Marken-Gold** (`gold-schrift`): Kleine Ordnungsmarken: Ort in der Telefonpille, Schrittziffern im Regal, Gruppennummern der Preisliste, Legende, Hinweis „am Telefon“. Nie Lauftext.

### Neutral
- **Nacht** (`papier`): Grund der ganzen Seite, Leiste und Wegweiser leicht transparent darüber.
- **Nische** (`papier-tief`): Abgesenkter Grund (Salonfotos, Preisstufen am Handy).
- **Satin** (`weiss`): Karten und Tafeln — Standortkarten, Salonwahl, Schlusstafel der Preisliste, Umschalter-Fassung.
- **Schildschwarz** (`knopf-grund`): Grund aller Knöpfe und gewählten Zustände; tiefer als die Seite, damit das Schild sich absetzt.
- **Tiefste Nacht** (`nacht`, `nacht-tief`): Bildgrund hinter Fotos und der Fuß.
- **Creme** (`tinte`, `tinte-leise`, `tinte-still`): Schrift in drei Stufen — Überschrift und Name, Lauftext, Beschriftung und Metadaten.
- **Fuß-Creme** (`nacht-schrift`, `nacht-still`): Schrift auf dem tiefsten Grund.
- **Haarlinien** (`linie`, `linie-stark`, `linie-gold`): Trenner zwischen Posten, Rand der stillen Knöpfe und Chips, goldene Fassung von Umschalter, Pille und Schlusstafel.

### Tertiary
- **Travertin** (`travertin`) mit `--travertin-stein` (`bilder/travertin.webp`, 350×190 px gekachelt, hell überlegt 93→85 %): der eine helle Raum, der Bewertungsabschnitt.
- **Travertin-Tinte** (`travertin-tinte`): Schild, Zahlen und Knopfschrift auf Stein.
- **Travertin-Gold** (`travertin-gold`) und **Travertin-Hand** (`travertin-hand`): das Gold, auf hellem Grund neu gemessen — Unterstrich und Handschriftzeile werden dort zu dunklem Umbra statt hellem Gold.
- **Auf dem Stein außerdem:** `travertin-hell` (Karten, Schleieranfang), `travertin-tief` (Schleierende), `travertin-still` (kleine Zeilen, mind. 6:1), `travertin-linie` (Trennlinien, nur mit Alpha), `sterne` (Sternleiste).
- **Licht und Schatten:** `weiss-licht` nur mit Alpha als Glanz auf dem Spiegelglas, `schatten` nur mit Alpha für Schlagschatten, `bronze` für warme Vignetten und die Regalstange, `linie-gold-hell` für Haarlinien über Fotos und Unterstreichungen.
- **Zustand:** `offen` — der grüne Punkt „geöffnet“; die einzige kühle Farbe, nur als 8-px-Punkt.
- **Alpha-Stufen** entstehen immer aus einem Token: `color-mix(in oklch, var(--token) 35%, transparent)`. Kein Rohwert im Stil.

### Named Rules
**Die Kantenlicht-Regel.** Gold ist Licht, und Licht sitzt an Kanten. Es erscheint als Linie, Rand, Unterstrich oder Schein — nie als gefüllte Fläche, nie als Knopfgrund.

**Die Eine-Lampe-Regel.** In jeder Knopfgruppe leuchtet höchstens ein Knopf (Kante `knopf-kante` plus Schein `0 0 10px -1px led-schein`). Alle anderen sind still: transparent mit Haarlinie.

**Die Neu-gemessen-Regel.** Auf Travertin wird Gold nicht übernommen, sondern von der hellen Seite neu gemessen (`travertin-gold`, `travertin-hand`); Creme wird zu `travertin-tinte`. Kein Element aus der Nacht wird auf Stein invertiert.

**Die Handschrift-Ausnahme.** Gold als Schriftfarbe gibt es nur in der Sacramento-Zeile und in kleinen Ordnungsmarken. Schild, Titel und Lauftext bleiben Creme.

## Typography

**Display Font:** Jost (mit Mulish, system-ui) — lokal, variabel 100–900
**Body Font:** Mulish (mit system-ui, -apple-system, Segoe UI)
**Handschrift:** Sacramento (mit Segoe Script, cursive)

**Character:** Dünne, weit gesperrte Versalien wie die Folienbeschriftung am Fenster, gegen eine lockere Handschrift, die wie mit dem Stift darunter gesetzt ist. Mulish trägt den Lauftext unauffällig.

### Hierarchy
- **Display** (Jost 300, `clamp(2.25rem, 1.2rem + 4vw, 4.8rem)`, 1, Sperrung .3em, Versalien): nur der Name IRMONHAIR im ersten Bildschirm. Darunter die Wortmarken-Linie (Jost 400, .78–.95rem, Sperrung .42em) zwischen zwei auslaufenden Haarlinien.
- **Headline / Schild** (Jost 300, `clamp(2.1rem, 1.3rem + 2.6vw, 3.3rem)`, 1, Sperrung .28em, Versalien): ein Wort pro Abschnitt (EXTENSIONS, PREISE, SALONS, STIMMEN, TERMIN, PREISLISTE), darunter 4,5rem Goldlinie, 1,4rem Abstand.
- **Handschrift** (Sacramento 400, `clamp(1.9rem, 1.5rem + 1.2vw, 2.6rem)` unter dem Schild, `clamp(2.1rem, 1.6rem + 1.6vw, 3rem)` im Auftakt, 1.05): ein Satz, optional mit dem Linienherz am Ende.
- **Title** (Jost 300, 1.7rem, 1.1): Leistungsgruppen, Salonname der Karte (2.6rem), Gruppenkopf der Preisliste (`clamp(2rem, 1.6rem + 1.5vw, 2.9rem)`), Regal-Ton (1.5rem). Posten der Preisliste in Jost 500, 1.32rem.
- **Body** (Mulish 400, 1.0625rem, 1.65): Lauftext in `tinte-leise`, höchstens 36rem breit (`--lese`), `text-wrap: pretty`.
- **Label** (Jost 500, .72rem, Sperrung .12–.28em, Versalien): Orte, Stufen, Legende, Bildunterschriften, Navigation (.74rem, .18em). Kleiner als .72rem wird nichts.
- **Preis / Zahl** (Jost 500, 1.05rem, tabellarische Ziffern): Preise in festen rechtsbündigen Spalten; Rufnummern in Jost 400, 1.55–1.8rem.

### Named Rules
**Die Schild-und-Hand-Regel.** Jeder Abschnitt öffnet mit genau einem Schild-Wort und darunter einer Handschriftzeile. Keine zusätzliche Zeile über dem Schild.

**Die Dünn-bleibt-dünn-Regel.** Große Jost-Schrift steht in 300. Gewicht 500 gibt es nur klein (Labels, Knöpfe, Preise, Posten).

## Layout

Eine zentrierte Spalte von 76rem (`--spalte`) mit Seitenrand `--rand` (1.25rem → 2rem ab 48rem → 2.75rem ab 64rem). Abschnitte atmen mit `a6` (8rem, ab 64rem 10rem) oben und unten; innen gilt die Reihe `a2` 1rem · `a3` 1.75rem · `a4` 3rem · `a5` 5rem. Kopfzeilen halten 46rem, Lauftext 36rem.

Der erste Bildschirm teilt sich ab 60rem in 1.12fr : .88fr (Name, Handschrift, Knöpfe, beide Nummern links; Spiegel rechts), darunter gestapelt. Zweispaltige Abschnitte (Extensions, Stimmen) teilen ab 64rem 5fr : 7fr, der linke Kopf klebt beim Stimmenabschnitt unter der Leiste. Fotos im Raster 1 → 2 (40rem) → 3 Spalten (64rem). Die Preisliste verengt auf 62rem; am Handy (unter 44rem) rutschen die Preisstufen unter den Posten auf eine Nischenfläche.

Die Leiste (64 px, ab 48rem 72 px) weicht beim Runterscrollen aus und kommt beim Hochscrollen zurück (6 px Hysterese); der Wegweiser der Preisliste fährt mit ihr.

## Elevation & Depth

Tiefe entsteht durch Licht, nicht durch Anheben. Flächen liegen flach übereinander in drei Satinstufen; Schatten gibt es nur als Dunkelheit unter Dingen, die im Fenster hängen (Spiegel, Schleife), und als Schein um leuchtende Kanten.

### Shadow Vocabulary
- **Hauptknopf-Schein** (`box-shadow: 0 0 10px -1px var(--led-schein)`): eng, nur am Hauptknopf.
- **LED-Innenkante des Spiegels** (`box-shadow: 0 0 0 1.5px oklch(90% .09 86), 0 0 16px 2px var(--led-schein), inset 0 0 22px oklch(84% .1 84 / .28)`): die leuchtende Fuge zwischen schwarzem Rahmen und Glas.
- **Klammerglut** (`box-shadow: 0 2px 14px 1px var(--led-schein)`): die gewählte Strähne.
- **Fenstertiefe** (`box-shadow: 0 50px 90px -40px oklch(0% 0 0 / .85), 0 0 90px -30px oklch(70% .1 75 / .35)`): unter dem Spiegelrahmen.
- **Schleifenschatten** (`filter: drop-shadow(0 22px 26px oklch(0% 0 0 / .65))`): hinter der Schleife.
- **Raumlicht** (radialer Verlauf `oklch(40–44% .06–.07 72 / .22–.28)` ins Transparente): warmer Schein hinter Spiegel und Regal, nie mit harter Kante.

### Named Rules
**Die Licht-statt-Lift-Regel.** Karten, Knöpfe und Chips haben keinen Schlagschatten. Wer hervortreten soll, bekommt eine Kante, keinen Schatten.

## Shapes

Drei Formen, klar getrennt: die **Pille** (999px) für alles Antippbare (Knöpfe, Chips, Telefonpille, Umschalter, Wegweiser); die **gerade Kante** (0) für Karten, Tafeln, Stimmen und Fotos; der **Rundbogen** (999px 999px 6px 6px) allein für den Spiegel. Die Regalnische hat 3 px, der Fokusrahmen 2 px. Linienzeichnungen (Schleife, Herz, Strähnen) sind flach, 1,3–1,6 px Strich, runde Verbindungen, keine Füllung außer Schwarz.

## Components

### Buttons
Schwarz wie das Schild am Fenster; das Licht ist die Kante.
- **Shape:** Pille (999px), mindestens 3.1rem hoch, Innenabstand .85rem 1.65rem, Jost 500 .8rem, Sperrung .16em, Versalien.
- **Primary (Hauptknopf):** `knopf-grund` mit 1 px `knopf-kante` und engem LED-Schein; Schrift `tinte`. Hover: Grund hebt sich auf `oklch(22% .03 70)`.
- **Still:** transparent, Rand `linie-stark`, Schrift `tinte`. Hover: Rand `gold-tief`, Grund `oklch(84% .1 84 / .08)`. Auf Travertin: Schrift und Rand in `travertin-tinte`-Tönen.
- **Aktiv:** `scale(.98)`. Übergänge 0,3 s `--kurve`; Hover nur hinter `(hover: hover) and (pointer: fine)`.

### Chips
- **Style:** Pille, 2.75rem hoch, Rand `linie-stark`, Jost 500 .84rem, Schrift `tinte-leise`.
- **State:** gewählt = Rand `gold`, Grund Gold 12 %, Schrift `tinte`; Hover = Rand `gold-tief`.

### Umschalter und Auswahlkarten
- **Umschalter (Spiegel):** Fassung aus Satin mit `linie-gold`, gewähltes Segment `knopf-grund` mit `knopf-kante`.
- **Salonwahl (Preisliste):** gerade Karte auf Satin, Rand `linie-stark`, Kreis links; gewählt = `knopf-grund`, Rand `knopf-kante`, Goldpunkt im Kreis.

### Cards / Containers
- **Corner Style:** gerade (0).
- **Background:** Satin (`weiss`) mit 1 px `linie`; Schlusstafel mit `linie-gold`. Stimmen auf Travertin: `oklch(95% .012 80 / .8)` mit dunkler Haarlinie.
- **Shadow Strategy:** keiner (siehe Licht-statt-Lift).
- **Internal Padding:** `a3` (1.75rem), ab 64rem `a4` (3rem).
- **Hervorhebung:** die nähere Salonkarte bekommt Rand `gold` und ein Schild in Knopfform.

### Navigation
- **Leiste:** Nacht zu 82 % mit Weichzeichner, Haarlinie unten; Links in Jost 500 .74rem gesperrt, aktiv/hover mit Goldunterstrich, der von links einläuft. Rechts die Telefonpille mit Goldrand.
- **Mobil (unter 64rem):** Klappmenü von oben, Einträge mit Haarlinien getrennt.
- **Wegweiser (Preisliste):** klebt unter der Leiste, Pillen in Label-Schrift, rechts ausgeblendet; der aktive Eintrag schwarz mit LED-Kante (wie der Menü-Termin am Handy).

### Die Schleife (Signatur)
Flaches schwarzes Leuchtschild (`#0c0a09`) aus vier Bändern und einem Knoten, oben links über dem Spiegelrahmen, −9° gedreht. Jedes Band trägt seine LED-Kante selbst (1,6 px Verlauf `#fff0cc → #e9b865`) plus weichen Schein; das vordere Band verdeckt die Kante des hinteren. Beim Laden läuft das Licht einmal um die Kontur (1,8 s), dann glimmt der Schein auf und alles steht still.

### Das Farbregal (Signatur)
Eine Lichtnische (Verlauf von warmem Gold oben in Nacht, Lichtleiste und Stange) mit zehn Strähnen in einer Reihe, auch am Handy. Jede Strähne ist gut sechsmal so hoch wie breit (1 : 6.2), hängt an einer schwarzen Klammer, verläuft von Wurzel über Ton zur Spitze, trägt Glanz und Faserstruktur und läuft weich und leicht asymmetrisch aus. Gewählt: hebt sich 7 px, Klammer leuchtet. Die Töne sind als Annäherung beschriftet.

### Der Spiegel
Rundbogen im Seitenverhältnis 3 : 4, schwarzer Rahmen, LED-Innenkante, im Glas das Salonfoto mit langsamer Kamerafahrt heran (scale 1.08 → 1, 9 s) und einem Glanz, der dem Zeiger folgt.

## Do's and Don'ts

### Do:
- **Do** Gold als 1–1,6 px Kante, Linie oder Schein setzen — und nur an dem Element, das gerade im Fokus steht.
- **Do** jeden Abschnitt mit einem Schild-Wort (Jost 300, .28em, Versalien) und einer Sacramento-Zeile öffnen.
- **Do** Knöpfe auf `knopf-grund` bauen; pro Gruppe genau ein Hauptknopf mit Kante und Schein.
- **Do** auf Travertin jede Farbe von der hellen Seite neu setzen (`travertin-tinte`, `travertin-gold`, `travertin-hand`).
- **Do** Bewegung nur mit `--kurve` / `--kurve-weich` für Auftritte und `--kurve-fort` für Abgänge, 0,3/0,6/0,9 s, bei `prefers-reduced-motion` abgeschaltet.
- **Do** Zeichnungen als feine Linie auf Schwarz halten, wie die Schleife und das Herz.

### Don't:
- **Don't** Gold als Fläche verwenden — kein goldener Knopfgrund, kein Goldverlauf in Schrift, keine goldene Karte.
- **Don't** mehr als einen leuchtenden Knopf in eine Gruppe stellen.
- **Don't** eine zweite helle Fläche neben Travertin einführen; Karten, Tafeln und gewählte Zustände bleiben dunkel.
- **Don't** Schild oder Lauftext in Gold setzen; Gold in Schrift nur in der Handschriftzeile und in kleinen Ordnungsmarken.
- **Don't** Karten mit Schlagschatten anheben oder Ecken runden; rund ist nur, was man antippt, und der Spiegelbogen.
- **Don't** unter .72rem gehen.

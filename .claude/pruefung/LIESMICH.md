# Messwerkzeuge

Kleine Skripte, mit denen die Behauptungen über diese Seite geprüft
werden, statt sie zu glauben. Sie gehören nicht zur Website und werden
nicht von ihr geladen.

## Voraussetzungen

```bash
cd <projektwurzel> && python3 -m http.server 8099 &   # alle Skripte lesen von hier
```

Playwright liegt im Container unter `/opt/node22/lib/node_modules/playwright/`.
Liegt es woanders, den Importpfad oben in den Skripten anpassen.
`ffmpeg` kommt aus `/tmp/ffs/node_modules/ffmpeg-static/ffmpeg` (kein `ffprobe`
vorhanden — `ffmpeg -i` nehmen).

## Was womit geprüft wird

| Skript | prüft |
|---|---|
| `kontrast3.mjs <br>x<hö> <seite> [auswahl,…]` | Kontrast gegen den **gerenderten** Grund, ein Filmbild |
| `bewegtkontrast.mjs <br>x<hö>` | Kontrast im Auftakt über die **ganze Filmschleife** — der ungünstigste Moment. Für alles über dem Film ist nur diese Zahl gültig |
| `ueberblick.mjs <url> <br> <hö> <präfix>` | Fenster für Fenster aufnehmen, danach zusammensetzen. **Immer zuerst ansehen** |
| `deckung.mjs <br>x<hö>` | wieviel Metall der Schere unter dem Textblock liegt |
| `schere.mjs <br>x<hö>` | wo das Metall im Bild steht (Zehntel der Breite/Höhe) |
| `kante2.mjs [ohne]` | steht irgendwo eine senkrechte Kante im Auftakt |
| `vorhang.mjs` | Ladeschirm in vier Fällen: normal, ohne Film, ohne Skript, ohne Bewegung |
| `autostart.mjs` | läuft der Film **ohne Berührung** an, bleibt das Feld sichtbar |
| `knopf3.mjs` | Rückfall, wenn der Film gar nicht kommt |
| `film.mjs <br> <hö> <datei>` | läuft der Film, welche Quelle, Bildgrösse |
| `rauch.mjs` | wieviel sich je Abschnitt in 400 ms ändert |
| `zug.mjs` `faecher2.mjs` `auftritt.mjs` `ohnefilm.mjs` `menue.mjs` `kollage.mjs` | Laufband, Klappfächer, Auftritt, Standbild-Rückfall, Menü, Collage |
| `dichte.mjs` `woher.mjs` `suche.mjs` `kurve.mjs` | Analyse der Filmschleife (brauchen `quelle.raw`, siehe unten) |
| `oklch.mjs` `mischung.mjs` `hell.mjs` `kante.mjs` `abweich.mjs` | Farbe, Mischung, Helligkeit, Kantenenergie, Abstand zum Ideal |

Für die Schleifenanalyse zuerst:

```bash
ffmpeg -i ../../vorlagen/schere-rauch-quelle.mp4 \
  -vf "fps=24,scale=160:160,format=gray" -f rawvideo quelle.raw
```

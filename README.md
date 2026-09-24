# Irmonhair — Website

Friseur mit zwei Salons in München: **Pasing** (Irmonherstraße 7) und
**Großhadern** (Würmtalstraße 119).

Statische Seite: HTML, CSS, Vanilla JS. Kein Build-Schritt, keine
Abhängigkeiten. Auslieferung über GitHub Pages
(`.github/workflows/deploy-pages.yml`, bei jedem Push auf `main`).

| Datei | Inhalt |
|---|---|
| `index.html` | Startseite: Auftakt, Leistungen beider Salons nebeneinander, Planity-Bewertungen, zwei Standortkarten |
| `leistungen.html` | vollständige Preisliste, Pasing und Großhadern |
| `impressum.html`, `datenschutz.html` | Rechtliches |
| `neu.css`, `neu.js` | Gestaltung und Verhalten |
| `bilder/` | selbst gerechnete Strähnen-Hintergründe, freigestellte Schere |
| `recherche/` | Quellen und Werkzeuge (`straehne.py` rechnet die Hintergründe) |

Arbeitsweise: `CLAUDE.md`. Offene Punkte für den Salon: `ABNAHME.md`.
Stand für die nächste Sitzung: `UEBERGABE.md`.

Grundgerüst übernommen aus dem Projekt *BaHaar's Styling Studio*.

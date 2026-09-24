# Irmonhair — Website

Friseur mit zwei Salons in München: **Pasing** (Irmonherstraße 7) und
**Großhadern** (Würmtalstraße 119).

Statische Seite: HTML, CSS, Vanilla JS. Kein Build-Schritt, keine
Abhängigkeiten. Auslieferung über GitHub Pages
(`.github/workflows/deploy-pages.yml`, bei jedem Push auf `main`).

| Datei | Inhalt |
|---|---|
| `index.html` | Startseite: Auftakt mit Spiegel, Leistungen mit Einstiegspreisen, Salonfotos, Planity-Bewertungen, zwei Standortkarten |
| `leistungen.html` | vollständige Preisliste, erst Salon wählen, dann Gruppe; erzeugt von `recherche/preise.py` |
| `impressum.html`, `datenschutz.html` | Rechtliches |
| `neu.css`, `neu.js` | Gestaltung und Verhalten |
| `bilder/` | Salonfotos (aus den Planity-Einträgen), zwei gerechnete Strähnen |
| `recherche/` | Quellen, Planity-Preisdaten, `preise.py` (Preisliste), `straehne.py` (Strähnen) |

Arbeitsweise: `CLAUDE.md`. Offene Punkte für den Salon: `ABNAHME.md`.
Stand für die nächste Sitzung: `UEBERGABE.md`.

Grundgerüst übernommen aus dem Projekt *BaHaar's Styling Studio*.

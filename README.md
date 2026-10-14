# Irmonhair — Website

Friseur mit zwei Salons in München: **Pasing** (Irmonherstraße 7) und
**Großhadern** (Würmtalstraße 119).

Statische Seite: HTML, CSS, Vanilla JS. Kein Build-Schritt, keine
Abhängigkeiten. Die Terminbuchung braucht zusätzlich PHP (All-Inkl,
siehe `BUCHUNG.md`). Auslieferung der Website über GitHub Pages
(`.github/workflows/deploy-pages.yml`, bei jedem Push auf `main`).

| Datei | Inhalt |
|---|---|
| `index.html` | Hauptseite „Schaufenster bei Nacht“: Auftakt, Leistungen mit Einstiegspreisen, Salonfotos, Bewertungen, zwei Standortkarten mit Buchung |
| `leistungen.html` | vollständige Preisliste, erst Salon wählen, dann Gruppe; erzeugt von `recherche/preise.py` |
| `impressum.html`, `datenschutz.html` | Rechtliches |
| `neu.css`, `neu.js` | Gestaltung und Verhalten |
| `bilder/` | Salonfotos (aus den Planity-Einträgen), zwei gerechnete Strähnen |
| `recherche/` | Quellen, Planity-Preisdaten, `preise.py` (Preisliste), `straehne.py` (Strähnen), `katalog.py` (Buchungskatalog) |
| `termin.html` | Online-Buchung (braucht PHP auf dem Webspace; sonst Telefon und Planity) |
| `spiegel/`, `schleife/`, `alt/`, `alt2/` | frühere Fassungen der Website |
| `demo/`, `.devcontainer/` | Vorführung im Browser (GitHub Codespaces), siehe unten |
| `studio/` | Studio: Kalender und Kartei für den Salon |
| `api/` | Schnittstelle der Buchung, PHP + MySQL/SQLite — Einrichtung in `BUCHUNG.md` |

Die frühere Ablage der Hauptseite unter `/fenster/` leitet auf die
Wurzel weiter (GitHub Pages und Vorführung), alte Links tragen weiter.

**Vorführung ohne Webspace:** auf GitHub *Code → Codespaces → Create
codespace* auf dem Branch mit `demo/`. Der Server startet von selbst mit
ausgedachten Terminen; Zugänge stehen im Terminal.

Arbeitsweise: `CLAUDE.md`. Offene Punkte für den Salon: `ABNAHME.md`.
Stand für die nächste Sitzung: `UEBERGABE.md`.

Grundgerüst übernommen aus dem Projekt *BaHaar's Styling Studio*.

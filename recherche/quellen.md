# Quellen (gelesen am 24.09.2026)

- https://www.irmonhair-muenchen.de/ — Startseite, Standorte, Öffnungszeiten
- https://www.irmonhair-muenchen.de/unsere-preise/ — Preise beider Standorte
- https://www.irmonhair-muenchen.de/ueberblick-leistungen/ — Leistungen
- https://www.irmonhair-muenchen.de/frauen-herrenhaarschnitte/
- https://www.irmonhair-muenchen.de/impressum/
- https://www.planity.com/de-DE/irmonhair-pasing-81241-munchen — 5,0 aus 5
- https://www.planity.com/de-DE/irmonhair-grosshadern-81375-munchen — 4,86 aus 31

Die Bewertungen auf der Startseite sind wörtlich aus dem JSON-LD der
beiden Planity-Seiten übernommen (Autor dort „Anonyme"), nur solche mit
5 Sternen und Text.

Die Farbe #ff5a10 im Quelltext der alten Seite gehört zur
WordPress-Verwaltungsleiste, nicht zur Marke.

## Zweite Fassung

- Preise und Salonfotos aus den beiden Planity-Seiten, gelesen am
  24.09.2026. Die Preise liegen maschinenlesbar in `planity-preise.json`
  (Dienstleistungen, Dauer, Preis in Cent, Bewertung); `preise.py` baut
  daraus die Liste. Die Fotos liegen bei Planity unter
  `res.cloudinary.com/planity/image/upload/<id>` — Pasing: f9dt1bsv8utnubfk2l75,
  nfy13dladip8hciyabho, zhgszgbks59c3eelvt0u, kcfsohgjfljmfztmwkta,
  uglh9sugrfebzi4xblzd, hjmsflfw2an66wczed9v; Großhadern:
  nvzomoql6siwi1fe7lfj, iycktbnmrztmx97nrecn.
- Die Preisseite von irmonhair-muenchen.de wurde am selben Tag erneut
  gelesen; Leistungen, die nur dort stehen, führt `preise.py` unter
  `WEBSITE`.
- Cormorant Garamond aus dem npm-Paket `@fontsource/cormorant-garamond`
  5.3.0 (OFL, `schrift/Cormorant-OFL.txt`).

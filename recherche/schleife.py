"""Die Schleife aus der Vorlage der Inhaberin (Schaufenster, Nachtaufnahme),
nachgezeichnet im Koordinatenraum des Fotoausschnitts 560 × 900.

Schwarzer Satin mit Volumen: jede Fläche trägt einen eigenen Verlauf
(Licht von oben links, wie die Wandleuchte), darüber weiche Glanzbahnen;
die LED läuft als Kante um jedes Teil. Gezeichnet wird von hinten nach
vorn, damit das vordere Band die Kante des hinteren verdeckt.

    python3 recherche/schleife.py     # setzt die Schleife in schleife/*.html

Einsatzstellen (Marken im HTML):
    <!-- schleife:gross -->   Auftakt, am Spiegel
    <!-- schleife:vorhang --> Ladebildschirm
    <!-- schleife:zeichen --> Logo in der Leiste (ohne Schein, ohne Glanz)
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent

# Teile, von hinten nach vorn: (Name, Pfad, Verlauf)
TEILE = [
    # das lange Band hinten links, endet schräg
    ('band-lang', 'M262 214C262 360 263 560 262 764L120 886C138 776 160 660 178 578C200 480 226 330 246 214Z', 'band'),
    # die Fahne rechts unter der Schlaufe
    ('fahne', 'M298 204C338 198 362 214 382 250C400 282 412 316 420 348C394 336 360 318 334 298C308 276 294 240 298 204Z', 'fahne'),
    # das vordere Band links mit V-Schnitt
    ('band-vorn', 'M252 196C196 214 128 236 96 252C116 300 138 352 146 404C152 470 142 534 130 592L182 580L234 640C242 520 252 390 262 302C268 256 280 224 296 206Z', 'vorn'),
    # Schlaufe links
    ('schlaufe-l', 'M246 100C215 70 170 30 120 12C90 2 50 0 30 20C12 40 6 90 10 130C12 150 16 160 24 168C90 190 180 196 252 186Z', 'sl'),
    # Schlaufe rechts
    ('schlaufe-r', 'M342 106C372 76 420 30 470 16C500 8 530 14 540 36C552 64 550 110 546 140C544 158 540 168 532 176C470 192 400 196 338 184Z', 'sr'),
]
# Öffnungen der Schlaufen: die Innenseite, dunkel, mit Licht an der Unterlippe
OEFFNUNG = [
    ('M14 140C60 120 170 128 246 150L248 168C170 172 70 168 14 146Z', 'M14 146C70 168 170 172 248 168'),
    ('M546 136C500 120 400 128 344 150L342 168C400 172 490 166 546 146Z', 'M546 146C490 166 400 172 342 168'),
]
# Die Kanten, an denen das LED-Licht wirklich steht (aus dem Foto): aussen
# und unten. Die Oberkanten liegen im Dunkeln, dort nur ein Hauch.
KANTEN = {
    'band-lang':  ['M178 578C160 660 138 776 120 886L262 764', 'M262 300C263 460 263 620 262 764'],
    'fahne':      ['M298 204C338 198 362 214 382 250C400 282 412 316 420 348'],
    'band-vorn':  ['M96 252C116 300 138 352 146 404C152 470 142 534 130 592L182 580L234 640'],
    'schlaufe-l': ['M40 14C18 30 8 80 10 130C12 150 16 160 24 168'],
    'schlaufe-r': ['M540 36C552 64 550 110 546 140C544 158 540 168 532 176'],
}
KNOTEN = 'M244 98C276 86 316 86 346 100L338 206C310 216 276 216 252 208Z'

VERLAEUFE = {
    'band':  [(0, '#221d1b'), (.3, '#0b0909'), (.58, '#35302d'), (.72, '#0e0c0b'), (1, '#060505')],
    'fahne': [(0, '#3a3330'), (.45, '#121010'), (1, '#040303')],
    'vorn':  [(0, '#4a423d'), (.22, '#141211'), (.5, '#3b3431'), (.66, '#0f0d0c'), (1, '#040303')],
    'sl':    [(0, '#514742'), (.28, '#1e1a18'), (.58, '#0a0808'), (.86, '#2a2522'), (1, '#141110')],
    'sr':    [(0, '#1a1614'), (.35, '#48403b'), (.62, '#100e0d'), (1, '#050404')],
    'knoten': [(0, '#554b45'), (.25, '#1a1715'), (.62, '#0b0909'), (1, '#2e2826')],
}
RICHTUNG = {'band': (0, 0, 1, 1), 'fahne': (0, 0, 1, 1), 'vorn': (0, 0, 1, .6),
            'sl': (0, 0, .8, 1), 'sr': (1, 0, .2, 1), 'knoten': (0, 0, 1, 0)}

# Glanzbahnen: weiche helle Streifen auf dem Satin (Volumen)
GLANZ = [
    'M56 24C120 20 196 58 238 104C190 78 120 50 52 46Z',
    'M40 70C90 76 150 96 200 128C140 110 90 100 36 96Z',
    'M500 26C452 30 392 64 352 108C400 82 452 54 506 46Z',
    'M112 268C140 330 150 400 148 470C166 400 160 330 132 262Z',
    'M200 250C214 330 214 420 206 520C224 420 226 330 214 246Z',
    'M236 330C244 460 246 600 240 740C256 600 256 460 248 326Z',
    'M290 92C294 130 294 170 290 206C304 170 306 130 302 94Z',
]


def verlauf(i, name):
    x1, y1, x2, y2 = RICHTUNG[name]
    halte = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in VERLAEUFE[name])
    return f'<linearGradient id="{i}-{name}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{halte}</linearGradient>'


def schleife(i, klasse, *, schein=True, glanz=True, beschriftung='', ausschnitt=False):
    """Die Schleife als Inline-SVG. `i` ist das Präfix für alle IDs."""
    defs = [verlauf(i, n) for n in VERLAEUFE]
    defs.append(f'<linearGradient id="{i}-led" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d6"/>'
                f'<stop offset=".5" stop-color="#f7d99c"/><stop offset="1" stop-color="#eab96a"/></linearGradient>')
    if schein:
        defs.append(f'<filter id="{i}-glut" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>')
    if glanz:
        defs.append(f'<filter id="{i}-weich" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>')
    teile = []
    if schein:
        # Hinterleuchtung: die Wand hinter der Schleife glüht warm.
        defs.append(f'<filter id="{i}-wand" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="22"/></filter>')
        teile.append(f'<g class="wand" filter="url(#{i}-wand)" fill="#f0c67a">'
                     + ''.join(f'<path d="{d}"/>' for _, d, _ in TEILE) + '</g>')
    for name, d, v in TEILE:
        teile.append(f'<path d="{d}" fill="url(#{i}-{v})"/>')
        teile.append(f'<path class="led led-hauch" d="{d}" pathLength="1" stroke="url(#{i}-led)"/>')
        for k in KANTEN.get(name, []):
            if schein:
                teile.append(f'<path class="schein" d="{k}" filter="url(#{i}-glut)"/>')
            teile.append(f'<path class="led" d="{k}" pathLength="1" stroke="url(#{i}-led)"/>')
        if name.startswith('schlaufe'):
            o, lippe = OEFFNUNG[0 if name.endswith('l') else 1]
            teile.append(f'<path d="{o}" fill="#030202"/>')
            if schein:
                teile.append(f'<path class="schein" d="{lippe}" filter="url(#{i}-glut)"/>')
            teile.append(f'<path class="led" d="{lippe}" pathLength="1" stroke="url(#{i}-led)"/>')
    if glanz:
        teile.append(f'<g filter="url(#{i}-weich)" fill="#fff" opacity=".16">'
                     + ''.join(f'<path d="{g}"/>' for g in GLANZ) + '</g>')
    teile.append(f'<path d="{KNOTEN}" fill="url(#{i}-knoten)"/>')
    teile.append(f'<path class="led led-hauch" d="{KNOTEN}" pathLength="1" stroke="url(#{i}-led)"/>')
    teile.append(f'<path class="led" d="M244 98L252 208" pathLength="1" stroke="url(#{i}-led)" opacity=".75"/>')
    teile.append('<path d="M258 104C262 140 262 176 258 206M330 106C326 140 326 176 330 206" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="3"/>')
    if ausschnitt:
        # Für das Zeichen: nur Schlaufen und Knoten, die Bänder laufen aus.
        defs.append(f'<linearGradient id="{i}-aus" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#fff"/>'
                    f'<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
                    f'<mask id="{i}-maske" maskUnits="userSpaceOnUse" x="-20" y="-20" width="600" height="420">'
                    f'<rect x="-20" y="-20" width="600" height="420" fill="url(#{i}-aus)"/></mask>')
        return (f'<svg class="{klasse}" viewBox="-6 -6 572 356" aria-hidden="true" focusable="false">{beschriftung}'
                f'<defs>{"".join(defs)}</defs><g mask="url(#{i}-maske)">{"".join(teile)}</g></svg>')
    return (f'<svg class="{klasse}" viewBox="0 0 560 900" aria-hidden="true" focusable="false">{beschriftung}'
            f'<defs>{"".join(defs)}</defs>{"".join(teile)}</svg>')


def einsetzen(datei, marke, inhalt):
    pfad = WURZEL / datei
    text = pfad.read_text()
    muster = re.compile(rf'(<!-- schleife:{marke} -->).*?(<!-- /schleife:{marke} -->)', re.S)
    if not muster.search(text):
        sys.exit(f'{datei}: Marke schleife:{marke} fehlt')
    pfad.write_text(muster.sub(lambda m: m.group(1) + inhalt + m.group(2), text))


if __name__ == '__main__':
    if len(sys.argv) > 1:              # Vorschau: python3 recherche/schleife.py datei.html
        Path(sys.argv[1]).write_text('<body style="margin:0;background:#0d0907">'
            '<style>svg{width:560px;overflow:visible}.led{fill:none;stroke-width:2.6;stroke-linecap:round}.led-hauch{stroke-width:1.2;opacity:.28}.schein{fill:none;stroke:#f3cf86;stroke-width:9;opacity:.7}.wand{opacity:.22}</style>'
            + schleife('v', 'x') + '</body>')
        sys.exit()
    for seite in ('index.html', 'leistungen.html', 'impressum.html', 'datenschutz.html'):
        text = (WURZEL / 'schleife' / seite).read_text()
        if '<!-- schleife:zeichen -->' in text:
            einsetzen(f'schleife/{seite}', 'zeichen', schleife('sz', 'zeichen-schleife', schein=False, glanz=False, ausschnitt=True))
        if '<!-- schleife:vorhang -->' in text:
            einsetzen(f'schleife/{seite}', 'vorhang', schleife('sv', 'vorhang-schleife'))
        if '<!-- schleife:gross -->' in text:
            einsetzen(f'schleife/{seite}', 'gross', schleife('sg', 'schleife'))
    # Eigenständig als Favicon: dunkler Grund, damit sie im hellen Tab steht.
    zeichen = schleife('sf', 'x', schein=False, glanz=False, ausschnitt=True)
    zeichen = zeichen.replace('<svg class="x" ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1)
    zeichen = zeichen.replace('<defs>', '<style>.led{fill:none;stroke-width:14;stroke-linejoin:round}.led-hauch{display:none}</style>'
                              '<rect x="-6" y="-114" width="572" height="572" rx="90" fill="#0d0907"/><defs>', 1)
    zeichen = zeichen.replace('viewBox="-6 -6 572 356"', 'viewBox="-6 -114 572 572"', 1)
    (WURZEL / 'schleife' / 'logo-schleife.svg').write_text(zeichen + '\n')
    print('Schleife gesetzt')

"""Baut aus einem Git-Stand eine eigenständige, lauffähige Fassung unter fassungen/<name>/."""
import re, subprocess, sys, os, shutil
rev, name, titel = sys.argv[1], sys.argv[2], sys.argv[3]
ziel = f'fassungen/{name}'
shutil.rmtree(ziel, ignore_errors=True); os.makedirs(ziel)
def lies(p): return subprocess.run(['git','show',f'{rev}:{p}'],capture_output=True,check=True).stdout
SEITEN=['index.html','leistungen.html','impressum.html','datenschutz.html']
REF=re.compile(r'''(?:src|href|poster|srcset)="([^"#?]+)"|url\(['"]?([^'")]+)['"]?\)''')
offen=['neu.css','neu.js']; erledigt=set()
for s in SEITEN:
    t=lies(s).decode('utf8')
    # Zur eigenen Startseite, nicht zur Wurzel der Domain; nicht in Suchmaschinen.
    t=t.replace('href="/"','href="index.html"')
    t=t.replace('<meta charset="utf-8">','<meta charset="utf-8">\n<meta name="robots" content="noindex">',1)
    open(f'{ziel}/{s}','w',encoding='utf8').write(t)
    offen+= [a or b for a,b in REF.findall(t)]
while offen:
    p=offen.pop()
    if p in erledigt or re.match(r'(https?:|mailto:|tel:|data:|#|/)',p) or p in SEITEN: continue
    erledigt.add(p)
    try: d=lies(p)
    except subprocess.CalledProcessError: print('fehlt',p); continue
    os.makedirs(os.path.dirname(f'{ziel}/{p}') or ziel, exist_ok=True)
    open(f'{ziel}/{p}','wb').write(d)
    if p.endswith('.css'): offen+=[a or b for a,b in REF.findall(d.decode('utf8'))]
print(name, len(erledigt),'Dateien')

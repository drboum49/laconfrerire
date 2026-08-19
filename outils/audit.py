#!/usr/bin/env python3
"""Audit du dossier du site : doublons, code mort, cohérence."""
import re, os, glob, hashlib, json
from collections import defaultdict

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
pages = sorted(glob.glob('*.html'))
html = {p: open(p, encoding='utf-8').read() for p in pages}
# version sans les commentaires HTML, pour les contrôles structurels
html_net = {p: re.sub(r'<!--.*?-->', '', t, flags=re.S) for p, t in html.items()}
css = open('css/styles.css', encoding='utf-8').read()
js = open('js/site.js', encoding='utf-8').read()

print('=' * 70)
print('1. IMAGES EN DOUBLE (même contenu, nom différent)')
print('=' * 70)
h = defaultdict(list)
for f in glob.glob('images/**/*.*', recursive=True):
    h[hashlib.md5(open(f, 'rb').read()).hexdigest()].append(f)
dups = [v for v in h.values() if len(v) > 1]
print('\n'.join(' = '.join(d) for d in dups) if dups else 'aucun doublon')

print()
print('=' * 70)
print('2. IMAGES PRÉSENTES MAIS JAMAIS AFFICHÉES')
print('=' * 70)
used = set()
for t in html.values():
    used |= set(re.findall(r'(?:src|data-photo)="(images/[^"]+)"', t))
    for jeu in re.findall(r'srcset="([^"]+)"', t):
        used |= set(re.findall(r'(images/[^\s,]+)', jeu))
used |= set(re.findall(r'url\(["\']?(images/[^)"\']+)', css))
# Windows renvoie des chemins avec des antislashs, tandis que les pages HTML
# utilisent des slashs. On les uniformise avant comparaison.
allimg = {f.replace('\\', '/') for f in glob.glob('images/**/*.*', recursive=True)}
unused = sorted(allimg - used)
for f in unused:
    print('%-46s %6d ko' % (f, os.path.getsize(f) // 1024))
if not unused:
    print('aucune')

print()
print('=' * 70)
print("3. RÈGLES CSS JAMAIS UTILISÉES")
print('=' * 70)
# on retire commentaires et blocs @media pour extraire les sélecteurs
clean = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
selectors = set()
for bloc in re.findall(r'([^{}]+)\{[^{}]*\}', clean):
    for sel in bloc.split(','):
        sel = sel.strip()
        if not sel or sel.startswith('@'):
            continue
        selectors.add(sel)
classes = set()
for sel in selectors:
    classes |= set(re.findall(r'\.([a-zA-Z][\w-]*)', sel))
declarees_html = set()
for t in html.values():
    for attr in re.findall(r'class="([^"]*)"', t):
        declarees_html |= set(attr.split())
declarees_js = set(re.findall(r"className = '([^']+)'", js))
declarees_js |= set(re.findall(r"classList\.(?:add|toggle|remove)\('([^']+)'", js))
# Classes créées par la fonction utilitaire de l'agenda.
declarees_js |= set(re.findall(r"addText\([^,]+,\s*'[^']+',\s*'([^']+)'", js))
declarees = declarees_html | declarees_js
mortes = sorted(classes - declarees)
print('\n'.join(mortes) if mortes else 'aucune classe orpheline')

print()
print('=' * 70)
print('4. IDENTIFIANTS CSS/JS SANS CIBLE HTML')
print('=' * 70)
# on écarte les codes couleur hexadécimaux, qui commencent aussi par #
ids_css = {i for i in re.findall(r'#([a-zA-Z][\w-]*)', clean)
           if not re.fullmatch(r'[0-9a-fA-F]{3,8}', i)}
ids_js = set(re.findall(r"getElementById\('([^']+)'\)", js))
ids_html = set()
for t in html.values():
    ids_html |= set(re.findall(r'id="([^"]+)"', t))
orphelins = sorted((ids_css | ids_js) - ids_html)
print('\n'.join(orphelins) if orphelins else 'aucun')

print()
print('=' * 70)
print('5. IDENTIFIANTS EN DOUBLE DANS UNE MÊME PAGE')
print('=' * 70)
souci = False
for p, t in html_net.items():
    ids = re.findall(r'id="([^"]+)"', t)
    for i in set(ids):
        if ids.count(i) > 1:
            print('%s : id="%s" apparaît %d fois' % (p, i, ids.count(i)))
            souci = True
if not souci:
    print('aucun')

print()
print('=' * 70)
print('6. EN-TÊTE ET PIED DE PAGE IDENTIQUES SUR LES 4 PAGES')
print('=' * 70)
def bloc(t, deb, fin):
    a = t.index(deb); b = t.index(fin, a)
    return t[a:b]
def norm(s):
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s*aria-current="page"', '', s)
    return s.strip()
navs = {p: norm(bloc(t, '<nav class="site-nav"', '</nav>')) for p, t in html.items()}
foots = {p: norm(bloc(t, '<footer class="site-footer"', '</footer>')) for p, t in html.items()}
print('en-tête  :', 'identique partout' if len(set(navs.values())) == 1
      else 'DIFFÉRENCES → ' + ', '.join(navs))
print('pied     :', 'identique partout' if len(set(foots.values())) == 1
      else 'DIFFÉRENCES → ' + ', '.join(foots))

print()
print('=' * 70)
print('7. LIENS ET ANCRES')
print('=' * 70)
pbs = []
for p, t in html.items():
    t = html_net[p]
    for a, v in re.findall(r'(href|src|data-photo)="([^"]+)"', t):
        if v.startswith(('http', 'mailto:', 'data:', '//')):
            continue
        if v.startswith('#'):
            if v != '#' and not re.search(r'id="%s"' % re.escape(v[1:]), t):
                pbs.append('%s : ancre %s inexistante' % (p, v))
        elif not os.path.exists(v):
            pbs.append('%s : %s introuvable' % (p, v))
    # liens externes sans rel="noopener"
    for lien in re.findall(r'<a [^>]*target="_blank"[^>]*>', t):
        if 'rel="noopener"' not in lien:
            pbs.append('%s : target=_blank sans rel=noopener → %s' % (p, lien[:70]))
print('\n'.join(pbs) if pbs else 'aucun problème')

print()
print('=' * 70)
print('8. IMAGES SANS TEXTE ALTERNATIF OU SANS DIMENSIONS')
print('=' * 70)
pbs = []
for p, t in html.items():
    for img in re.findall(r'<img [^>]*>', t):
        if 'alt=' not in img:
            pbs.append('%s : alt manquant → %s' % (p, img[:80]))
        if 'width=' not in img and 'id="modalPhoto"' not in img:
            pbs.append('%s : dimensions manquantes → %s' % (p, img[:80]))
print('\n'.join(pbs) if pbs else 'toutes les images sont correctes')

print()
print('=' * 70)
print('9. BALISES DE RÉFÉRENCEMENT PAR PAGE')
print('=' * 70)
for p, t in html.items():
    titre = re.search(r'<title>(.*?)</title>', t, re.S)
    desc = re.search(r'name="description" content="(.*?)"', t, re.S)
    canon = 'oui' if 'rel="canonical"' in t else 'NON'
    og = len(re.findall(r'property="og:', t))
    h1 = re.findall(r'<h1[^>]*>(.*?)</h1>', t, re.S)
    print('%-16s titre %3d car. | description %3d car. | canonical %s | og %d | h1 %d'
          % (p, len(titre.group(1)) if titre else 0,
             len(desc.group(1)) if desc else 0, canon, og, len(h1)))

print()
print('=' * 70)
print('10. HIÉRARCHIE DES TITRES')
print('=' * 70)
for p, t in html.items():
    niveaux = [int(n) for n in re.findall(r'<h([1-6])[^>]*>', t)]
    saut = [(niveaux[i-1], niveaux[i]) for i in range(1, len(niveaux))
            if niveaux[i] - niveaux[i-1] > 1]
    print('%-16s %s   %s' % (p, niveaux, ('SAUT ' + str(saut)) if saut else 'ok'))

print()
print('=' * 70)
print('11. POIDS DU SITE')
print('=' * 70)
total = 0
par_type = defaultdict(int)
for f in glob.glob('**/*', recursive=True):
    if os.path.isfile(f) and not f.startswith('outils/'):
        s = os.path.getsize(f)
        total += s
        par_type[os.path.splitext(f)[1] or 'autre'] += s
for ext, s in sorted(par_type.items(), key=lambda x: -x[1]):
    print('%-8s %7d ko' % (ext, s // 1024))
print('%-8s %7d ko  (dossier complet)' % ('TOTAL', total // 1024))

print()
print('12. POIDS DE CHAQUE PAGE AU CHARGEMENT (hors polices)')
print('=' * 70)
for p, t in html.items():
    poids = os.path.getsize(p) + os.path.getsize('css/styles.css') + os.path.getsize('js/site.js')
    # images non différées = celles sans loading="lazy"
    immediat = [m for m in re.findall(r'<img [^>]*>', t) if 'loading="lazy"' not in m]
    for img in immediat:
        src = re.search(r'src="([^"]+)"', img)
        if src and os.path.exists(src.group(1)):
            poids += os.path.getsize(src.group(1))
    print('%-16s %6d ko affichés immédiatement (%d image(s))' % (p, poids // 1024, len(immediat)))

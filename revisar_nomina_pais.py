#!/usr/bin/env python3
"""Compara la nómina que manda un país contra la que tenemos publicada.

Los países van mandando su nómina definitiva de a poco, y lo que llega no
siempre coincide con lo que tenemos. Lo que importa de cada diferencia no es lo
mismo:

  · La CATEGORÍA DE PESO no puede cambiar. Si su archivo dice otra, uno de los
    dos está mal y hay que resolverlo antes de la competencia — pasó con Vicente
    González, que figuraba en -120 cuando compite en +120. Salen como ERROR.
  · La MODALIDAD sí puede cambiar: alguien agrega Only Bench, alguien pasa de
    clásico a equipado. Salen como cambio a revisar, no como error.
  · Los que están en su archivo y no en el nuestro son altas; los que están en el
    nuestro y no en el suyo, bajas. Las dos cosas hay que confirmarlas: puede ser
    un cambio de verdad o un nombre escrito distinto.

Además arma el bloque listo para pegar en nomina_suda_correcciones.json con los
nombres como se leen de verdad ("Lucas Andrés Montecinos Alarcón" y no
"Montecinos Alarcón Lucas"), que es lo que se muestra en yourlift.cl.

    python3 revisar_nomina_pais.py Brasil nomina_brasil.xlsx
    python3 revisar_nomina_pais.py Brasil nomina_brasil.csv --hoja "Final"

El archivo del país necesita una columna de nombre. Las de categoría, modalidad,
sexo y división se toman si están; si no, esa comparación se salta. Los nombres
de columna se reconocen solos (NOMBRE / NAME / ATLETA / CATEGORÍA / WEIGHT
CLASS / MODALIDAD / DIVISION…).
"""
import json, sys, os, re, unicodedata, collections

# ── Nombres ────────────────────────────────────────────────────────────────
def nrm(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-zA-Z ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip().lower()

def toks(s):
    return frozenset(nrm(s).split())

def titulo(s):
    """Cada palabra con mayúscula inicial, salvo las partículas de apellido. Los
    archivos vienen con la mano de quien los tipeó —"Francisco javier",
    "MARCELA DE LA BARRA"— y sin esto cada revisión propondría cambiar mayúsculas
    en vez de mostrar diferencias de verdad."""
    part = {'de', 'la', 'del', 'los', 'las', 'da', 'do', 'dos', 'van', 'von', 'y'}
    out = []
    for i, p in enumerate(str(s).split()):
        pl = p.lower()
        out.append(pl if (pl in part and i > 0) else pl[:1].upper() + pl[1:])
    return ' '.join(out)

def parea(a, b):
    """Dos escrituras del mismo nombre. El orden no importa —el nuestro viene
    'Apellidos Nombres' y el de ellos casi siempre al revés— y a uno de los dos
    le pueden faltar el segundo nombre o el segundo apellido."""
    if a == b: return True
    if len(a & b) < 3: return False
    return a <= b or b <= a

# ── Categorías ─────────────────────────────────────────────────────────────
def ncat(s):
    """'-83 kg', '83', '+120 KG' → '-83', '-83', '+120'."""
    t = str(s or '').strip().lower().replace('kg', '').strip()
    if not t: return ''
    mas = t.startswith('+') or t.endswith('+')
    num = re.sub(r'[^0-9.]', '', t)
    if not num: return ''
    num = num.rstrip('.')
    return ('+' if mas else '-') + num

def nmod(s):
    t = nrm(s)
    if not t: return ''
    t = t.replace('powerlifting', '').replace('press', '').strip()
    if 'olimpiadas especiales' in t or 'special olympic' in t: return 'olimpiadas especiales'
    if 'universitar' in t: return 'universitario'
    ob = 'only bench' in t or 'bench' in t or t == 'ob'
    eq = 'equipad' in t or 'equipped' in t
    if ob and eq: return 'only bench equipado'
    if ob: return 'only bench clasico'
    if eq: return 'equipado'
    return 'clasico'

# ── Lectura del archivo del país ───────────────────────────────────────────
COL = {
    'nombre':    ['nombre', 'name', 'atleta', 'athlete', 'lifter', 'apellidos y nombres', 'nome'],
    'cat':       ['categoria', 'category', 'weight class', 'peso', 'division de peso', 'cat'],
    'mod':       ['modalidad', 'modality', 'event', 'prueba', 'equipment'],
    'sexo':      ['sexo', 'sex', 'gender', 'genero'],
    'div':       ['division', 'age division', 'categoria de edad'],
}

def _cual(hdr):
    """Qué columna es cada cosa, por su encabezado."""
    m = {}
    for i, h in enumerate(hdr):
        hn = nrm(h)
        if not hn: continue
        for campo, alias in COL.items():
            if campo in m: continue
            if any(hn == a or hn.startswith(a) for a in alias): m[campo] = i
    return m

def leer(path, hoja=None):
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.csv', '.tsv', '.txt'):
        import csv
        sep = '\t' if ext == '.tsv' else ','
        with open(path, encoding='utf-8-sig', newline='') as f:
            filas = [r for r in csv.reader(f, delimiter=sep)]
    else:
        try:
            import openpyxl
        except ImportError:
            sys.exit('Falta openpyxl para leer Excel:  pip install openpyxl\n'
                     '(o exporta la hoja a .csv y pásame ese archivo)')
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb[hoja] if hoja else wb.worksheets[0]
        filas = [[c.value for c in r] for r in ws.iter_rows()]
    # El encabezado no siempre está en la primera línea: se busca la primera que
    # tenga una columna de nombre reconocible.
    for i, r in enumerate(filas[:15]):
        m = _cual(r)
        if 'nombre' in m:
            return [dict(zip(range(len(x)), x)) for x in filas[i+1:]], m
    sys.exit('No encontré una columna de nombre en ese archivo. '
             'Encabezados de la primera fila: ' + repr(filas[0] if filas else []))

# ── Main ───────────────────────────────────────────────────────────────────
if len(sys.argv) < 3:
    sys.exit(__doc__)
PAIS, ARCHIVO = sys.argv[1], sys.argv[2]
HOJA = None
if '--hoja' in sys.argv: HOJA = sys.argv[sys.argv.index('--hoja') + 1]

NOM = json.load(open('nomina_sudamericano.json', encoding='utf-8'))
nuestros = [a for a in NOM['atletas'] if nrm(a.get('pais')) == nrm(PAIS)]
if not nuestros:
    paises = sorted({a.get('pais') for a in NOM['atletas']})
    sys.exit(f'No tenemos a nadie de "{PAIS}". Los que hay: ' + ', '.join(paises))

filas, col = leer(ARCHIVO, HOJA)
suyos = []
for r in filas:
    n = r.get(col['nombre'])
    if not n or not str(n).strip() or len(nrm(n).split()) < 2: continue
    suyos.append({
        'n': titulo(' '.join(str(n).split())),
        'cat': ncat(r.get(col['cat'])) if 'cat' in col else '',
        'mod': nmod(r.get(col['mod'])) if 'mod' in col else '',
        'sexo': str(r.get(col['sexo']) or '').strip() if 'sexo' in col else '',
        'div': str(r.get(col['div']) or '').strip() if 'div' in col else '',
    })

print(f'{PAIS}: {len(suyos)} en su archivo · {len(nuestros)} inscripciones nuestras '
      f'({len({nrm(a["n"]) for a in nuestros})} personas)')
print(f'columnas reconocidas: {", ".join(sorted(col))}\n')

# Agrupar lo nuestro por persona: alguien puede tener 2 inscripciones (PL + OB).
mios = collections.OrderedDict()
for a in nuestros: mios.setdefault(toks(a['n']), []).append(a)

errores, cambios, altas, bajas, visibles = [], [], [], [], {}
emparejados = set()
for s in suyos:
    ts = toks(s['n'])
    hit = next((k for k in mios if k not in emparejados and parea(ts, k)), None)
    if hit is None:
        altas.append(s); continue
    emparejados.add(hit)
    filas_mias = mios[hit]
    base = filas_mias[0]
    if s['n'] != base.get('nDisp'): visibles[base['n']] = s['n']
    # La categoría de peso no puede cambiar.
    if s['cat']:
        mias = {ncat(a['cat']) for a in filas_mias}
        if s['cat'] not in mias:
            errores.append((base['n'], s['n'], '/'.join(sorted(mias)), s['cat']))
    # La modalidad sí.
    if s['mod']:
        mias = {nmod(a['mod']) for a in filas_mias}
        if s['mod'] not in mias:
            cambios.append((base['n'], '/'.join(sorted(mias)), s['mod']))
bajas = [mios[k][0] for k in mios if k not in emparejados]

if errores:
    print('══ CATEGORÍA DE PESO DISTINTA — no puede pasar, hay que resolverlo')
    for mio, suyo, nuestra, suya in errores:
        print(f'  {mio[:38]:40} nuestra {nuestra:>6}   ellos {suya:>6}')
        if nrm(mio) != nrm(suyo): print(f'  {"":40} (allá figura como {suyo})')
    print()
if cambios:
    print('══ CAMBIO DE MODALIDAD — posible, confirmar')
    for mio, nuestra, suya in cambios:
        print(f'  {mio[:38]:40} {nuestra} → {suya}')
    print()
if altas:
    print('══ EN SU ARCHIVO Y NO EN EL NUESTRO — alta, o el nombre no calza')
    for s in altas: print(f'  {s["n"][:44]:46} {s["cat"]:>6} {s["mod"]}')
    print()
if bajas:
    print('══ EN EL NUESTRO Y NO EN EL SUYO — baja, o el nombre no calza')
    for a in bajas: print(f'  {a["n"][:44]:46} {a["cat"]:>6} {a["mod"]}')
    print()
if not (errores or cambios or altas or bajas):
    print('Sin diferencias.\n')

if visibles:
    print('══ NOMBRES — para pegar dentro de "nombres_visibles" en '
          'nomina_suda_correcciones.json')
    print('  (después:  python3 aplicar_correcciones_suda.py && python3 build_suda_dias.py)')
    cuerpo = json.dumps(collections.OrderedDict(sorted(visibles.items())),
                        ensure_ascii=False, indent=1)
    print('\n'.join(cuerpo.split('\n')[1:-1]))

#!/usr/bin/env python3
"""Reconstruye la nómina completa de un campeonato leyendo su acta FESUPO en PDF.

Sirve cuando la competencia ya terminó y el livecast de ese evento quedó con la
nómina revuelta: el acta publicada es la fuente fiel — trae los nueve intentos de
cada atleta, con cuáles fueron válidos y cuáles nulos.

Cómo sabe si un intento fue nulo: el acta FESUPO los dibuja en gris y tachados, así
que en vez de leer solo el texto se recorre el flujo del PDF anotando el color de
cada celda. Negro = válido, gris = nulo.

El acta no trae el club, así que se lo pega desde las inscripciones de Firestore
(lectura pública) cruzando por nombre.

    python3 reconstruir_desde_acta.py acta.pdf regionalcentrosur > roster.json

La salida es la lista de atletas con la forma que usa el livecast, lista para
cargarla y volver a generar el acta en el formato nuevo.
"""
import re, sys, json, unicodedata, urllib.request
from pypdf import PdfReader
from pypdf.generic import ContentStream

PROY = 'fechipo-db-13148'

# ── Lectura del PDF ───────────────────────────────────────────────────────────
def celdas(pdf):
    """[(texto, gris)] en orden de lectura. Gris = intento nulo."""
    out = []
    for pg in PdfReader(pdf).pages:
        cs = ContentStream(pg.get_contents(), pg.pdf)
        col = (0, 0, 0)
        for ops, op in cs.operations:
            o = op.decode() if isinstance(op, bytes) else str(op)
            if o == 'rg':   col = tuple(round(float(v), 2) for v in ops)
            elif o == 'g':  v = round(float(ops[0]), 2); col = (v, v, v)
            elif o in ('Tj', 'TJ'):
                t = str(ops[0]) if o == 'Tj' else ''.join(
                    str(z) for z in ops[0] if not isinstance(z, (int, float)))
                if t.strip(): out.append((t.strip(), col[0] > 0.3))
    return out

TITULO = re.compile(r'^(POWERLIFTING CLASSIC|POWERLIFTING EQUIPADO|ONLY BENCH CLASSIC|'
                    r'ONLY BENCH EQUIPADO|SPECIAL OLYMPICS)\s+-\s+(DAMAS|CABALLEROS)\s+-\s+'
                    r'(.+?)\s+([+-]?\d+(?:\.\d+)?)\s*kg$')
MOD  = {'POWERLIFTING CLASSIC': 'classic', 'POWERLIFTING EQUIPADO': 'equipped',
        'ONLY BENCH CLASSIC': 'onlybench', 'ONLY BENCH EQUIPADO': 'equipped_bench',
        'SPECIAL OLYMPICS': 'oe_classic'}
NUM  = re.compile(r'^-?\d+(?:\.\d+)?$')
PAIS = re.compile(r'^[A-Z]{3}$')
ANIO = re.compile(r'^(19|20)\d{2}$')
LETRA = re.compile(r'[A-Za-zÁÉÍÓÚÑáéíóúñ]')

def leer(pdf):
    """Una fila por atleta y por tabla en la que aparece."""
    cs = celdas(pdf)

    def arranca(i):
        """¿Acá empieza la fila de un atleta? Devuelve el índice del país."""
        t = cs[i][0]
        if not (NUM.match(t) or t == '-'): return None
        for z in range(i + 1, min(i + 5, len(cs))):
            if PAIS.match(cs[z][0]):
                # Entre el puesto y el país solo va el nombre. Si alguna celda no
                # tiene letras, lo que se tomó por puesto era el GL del anterior.
                trozos = [cs[q][0] for q in range(i + 1, z)]
                return z if trozos and all(LETRA.search(x) for x in trozos) else None
        return None

    out, grupo, lifts, i = [], None, None, 0
    while i < len(cs):
        t = cs[i][0]
        m = TITULO.match(t)
        if m:
            grupo = {'mod': MOD[m.group(1)],
                     'sex': 'Mujer' if m.group(2) == 'DAMAS' else 'Hombre',
                     'div': m.group(3).strip(), 'cat': m.group(4)}
            i += 1; continue
        if t == '#':
            j, cab = i, []
            while j < len(cs) and cs[j][0] != 'IPF GL':
                cab.append(cs[j][0]); j += 1
            lifts = [l for l in ('SQ', 'BP', 'DL') if l + ' [BST]' in cab]
            i = j + 1; continue
        jp = arranca(i) if (grupo and lifts) else None
        if jp is None:
            i += 1; continue

        # La fila llega hasta donde empieza la siguiente, o hasta el próximo título.
        fin = i + 1
        while fin < len(cs) and not TITULO.match(cs[fin][0]) and cs[fin][0] != '#' \
              and arranca(fin) is None:
            fin += 1
        nombre = ' '.join(cs[z][0] for z in range(i + 1, jp))
        k = jp + 1
        # Peso corporal y año de nacimiento son opcionales: el que no dio el peso no
        # trae ninguno. Se distinguen porque el año es un entero de cuatro cifras.
        bw = ''
        if k < fin and NUM.match(cs[k][0]) and not ANIO.match(cs[k][0]): bw = cs[k][0]; k += 1
        nac = ''
        if k < fin and ANIO.match(cs[k][0]): nac = cs[k][0]; k += 1

        resto = cs[k:fin]
        att = {'sq': [], 'bp': [], 'dl': []}
        total = 0.0
        # Por movimiento van 3 intentos + el mejor, y al final total y GL. El que no
        # levantó nada no trae esas celdas: el PDF no las dibuja. Si la cuenta no da,
        # se lo deja sin marcas en vez de correr los campos.
        if len(resto) >= 4 * len(lifts) + 2:
            z = 0
            for L in lifts:
                tres = []
                for _ in range(3):
                    v, gris = resto[z]; z += 1
                    tres.append({'w': float(v) if NUM.match(v) else 0.0,
                                 'r': ('n' if gris else 'g') if NUM.match(v) else None})
                z += 1                                    # la celda del mejor
                att[L.lower()] = tres
            if z < len(resto) and NUM.match(resto[z][0]): total = float(resto[z][0])
        out.append({'nombre': nombre, 'pais': cs[jp][0], 'bw': float(bw) if bw else 0.0,
                    'nac': nac, 'total': total, 'att': att, **grupo})
        i = fin
    return out

# ── Clubes desde las inscripciones ────────────────────────────────────────────
def _nn(s):
    s = unicodedata.normalize('NFD', str(s or '').lower())
    return ' '.join(''.join(c for c in s if unicodedata.category(c) != 'Mn').split())

def _val(v):
    k = list(v.keys())[0]
    if k == 'mapValue':     return {a: _val(b) for a, b in v[k].get('fields', {}).items()}
    if k == 'integerValue': return int(v[k])
    if k == 'doubleValue':  return float(v[k])
    return v[k]

def inscripciones(evento):
    base = (f'https://firestore.googleapis.com/v1/projects/{PROY}/databases/'
            '(default)/documents/inscripciones?pageSize=300')
    tok, out = None, []
    while True:
        r = json.load(urllib.request.urlopen(base + ('&pageToken=' + tok if tok else '')))
        for d in r.get('documents', []):
            f = {k: _val(v) for k, v in d.get('fields', {}).items()}
            if f.get('evento') == evento: out.append(f)
        tok = r.get('nextPageToken')
        if not tok: break
    return out

# ── Armado de la nómina del livecast ──────────────────────────────────────────
def roster(filas, ins):
    """El acta lista dos veces al que compite en powerlifting y en Only Bench, una
    en cada tabla. Acá se juntan en un solo atleta con la marca plusBench."""
    fichas = {_nn(x['nombre']): x for x in ins}
    por = {}
    for f in filas:
        a = por.setdefault(_nn(f['nombre']), {
            'nombre': f['nombre'], 'pais': f['pais'], 'bw': f['bw'], 'nac': f.get('nac', ''),
            'sex': f['sex'], 'div': f['div'], 'cat': f['cat'], 'mods': set(),
            'att': {'sq': [], 'bp': [], 'dl': []}})
        a['mods'].add(f['mod'])
        for l in ('sq', 'bp', 'dl'):
            if f['att'][l]: a['att'][l] = f['att'][l]
        if f['mod'] in ('classic', 'equipped', 'oe_classic'):   # la tabla de PL manda
            a['div'], a['cat'] = f['div'], f['cat']

    vacio = lambda: [{'w': 0, 'r': None} for _ in range(3)]
    out = []
    for i, (k, a) in enumerate(por.items(), start=1):
        mods, plus = a['mods'], len(a['mods']) > 1
        if 'oe_classic' in mods:       mod = 'oe_classic'
        elif 'equipped' in mods:       mod = 'equipped_bench' if plus else 'equipped'
        elif 'equipped_bench' in mods: mod = 'equipped_bench'
        elif 'classic' in mods:        mod = 'classic_bench' if plus else 'classic'
        else:                          mod = 'onlybench'
        ficha = fichas.get(k, {})
        out.append({'id': i, 'name': a['nombre'], 'sex': a['sex'], 'cat': a['cat'].lstrip('-'),
                    'div': a['div'], 'mod': mod, 'plusBench': plus,
                    'club': ficha.get('club') or ficha.get('clubOtro') or '',
                    'country': a['pais'], 'bw': a['bw'], 'born': a.get('nac', ''),
                    'lot': 100 + i, 'flight': 'A', 'bombed': False,
                    'att': {l: (a['att'][l] or vacio()) for l in ('sq', 'bp', 'dl')}})
    return out

def revisar(filas):
    """El total que sale de los intentos tiene que dar el mismo que trae el acta.
    Es la comprobación de que se leyó bien qué intento fue válido y cuál nulo."""
    mejor = lambda att: max([x['w'] for x in att if x['r'] == 'g'] or [0])
    malos = []
    for f in filas:
        if f['mod'] in ('onlybench', 'equipped_bench') and not f['att']['sq']:
            t = mejor(f['att']['bp'])
        else:
            s, b, d = (mejor(f['att'][l]) for l in ('sq', 'bp', 'dl'))
            t = s + b + d if (s and b and d) else 0
        if f['total'] and abs(t - f['total']) > 0.01:
            malos.append((f['nombre'], t, f['total']))
    return malos

if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit('uso: reconstruir_desde_acta.py <acta.pdf> <id_del_evento>')
    filas = leer(sys.argv[1])
    malos = revisar(filas)
    r = roster(filas, inscripciones(sys.argv[2]))
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print(f'{len(r)} atletas · {sum(1 for a in r if a["bw"] > 0)} pesados · '
          f'{len(malos)} totales que no cuadran', file=sys.stderr)
    for m in malos: print('   descuadre:', m, file=sys.stderr)

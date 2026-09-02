#!/usr/bin/env python3
"""Lee la nómina oficial de FESUPO (Excel) y saca de ahí la nómina Y el cronograma.

El archivo trae, además de quién compite, dos cosas que hasta ahora no teníamos:
el NÚMERO DE LOTE de cada atleta (columna «OR.») y los DÍAS Y HORARIOS reales de
cada sesión, con la hora de pesaje y la de inicio.

La estructura de cada hoja es la de siempre en powerlifting: una cabecera de
sesión («23 Sep - Weigh in start 07.00 hs - competition start 09.00 hs»), abajo
las rondas («Round 1», «Round 2») y, dentro de cada ronda, las categorías de peso
(«59 kg») con sus atletas.

Dos trampas del archivo, las dos comprobadas contra los datos:

  · En «Women Eq» las columnas de categoría y lote están al revés que en el resto.
    No se corrige a mano: se mira cuál de las dos coincide con la categoría de
    peso que encabeza el bloque.
  · Un atleta que además compite en Only Bench aparece DOS VECES en la misma
    sesión: la segunda fila trae solo el press de banca. No es un duplicado.

Uso:
    python3 leer_nomina_fesupo.py Nominaciones_final_2026.xlsx
"""
import json
import re
import sys
from collections import OrderedDict

sys.modules.setdefault('cryptography', None)
import openpyxl  # noqa: E402

SESION = re.compile(r'^\s*(\d{1,2})\s+(\w{3})\s*-\s*Weigh in start\s+([\d.]+)\s*hs'
                    r'\s*-\s*competition start\s+([\d.]+)\s*hs', re.I)
RONDA = re.compile(r'^\s*Round\s+(\d+)\s*$', re.I)
# La categoría más pesada se escribe «120+ kg», con el más DESPUÉS del número.
# Con la expresión pidiéndolo adelante, esos bloques no se reconocían como
# categoría y sus atletas quedaban colgando del grupo anterior.
PESO = re.compile(r'^\s*(\+?)\s*(\d+(?:\.\d+)?)\s*(\+?)\s*kg\s*$', re.I)
MES = {'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
       'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'}

# Cada hoja es un campeonato distinto. La modalidad sale de acá y no del nombre
# de la hoja, que viene con espacios de más ("Men Eq ").
HOJAS = {
    'SOI':           {'sexo': None,      'mod': 'SO',  'nombre': 'Special Olympics'},
    'Men Classic':   {'sexo': 'M',       'mod': 'PL',  'nombre': 'Clásico'},
    'Women Classic': {'sexo': 'F',       'mod': 'PL',  'nombre': 'Clásico'},
    'Men Eq':        {'sexo': 'M',       'mod': 'EQ',  'nombre': 'Equipado'},
    'Women Eq':      {'sexo': 'F',       'mod': 'EQ',  'nombre': 'Equipado'},
}


def _txt(v):
    return '' if v is None else str(v).strip()


def _mismo_peso(celda, peso):
    """¿La celda trae el número de esta categoría de peso?

    Sirve para saber cuál de las dos columnas es la categoría y cuál el lote: en
    «Women Eq» vienen al revés que en las demás hojas.

    El «una más» —121 por +120, 85 por +84— vale SOLO en las superpesadas, que son
    las únicas que el Excel escribe así. Aceptarlo en todas hacía que en la fila
    «Open | 53 | 52 | Bueno Carmen» del bloque de 52 kg el 53 pasara por categoría
    y el 52, que es el lote, quedara de categoría: ella y Zoboli Camila terminaban
    con el mismo número de lote en la misma sesión.
    """
    n = _num(celda)
    k = _num((peso or '').lstrip('+-'))
    if n is None or k is None:
        return False
    return n == k or (str(peso).startswith('+') and (n - k) == 1)


def _cat(celda):
    """La categoría como la escribe la federación: -74, +120. En el Excel la
    superpesada va como el peso de la anterior más uno (121 es +120, 85 es +84)."""
    n = _num(celda)
    if n is None:
        return ''
    TOPES = {121: '+120', 85: '+84', 84.1: '+84'}
    if n in TOPES:
        return TOPES[n]
    e = int(n) if float(n).is_integer() else n
    return f'-{e}'


def letra_tanda(i):
    """A, B, C… Z, y después AA, AB… El Sudamericano tiene 36 rondas y el
    abecedario tiene 26, así que las últimas diez van de a dos letras."""
    s = ''
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def _num(v):
    if v is None or _txt(v) == '':
        return None
    try:
        return float(str(v).replace(',', '.'))
    except ValueError:
        return None


def leer(path, anio=2026):
    wb = openpyxl.load_workbook(path, data_only=True)
    sesiones = []          # el cronograma
    atletas = []           # la nómina
    for ws in wb.worksheets:
        clave = ws.title.strip()
        meta = HOJAS.get(clave)
        if not meta:
            print(f'  ! hoja desconocida, se ignora: {ws.title!r}', file=sys.stderr)
            continue
        ses = None
        ronda = 1
        peso = None
        vistos = {}        # (sesión, nombre) → índice, para detectar el Only Bench
        for fila in ws.iter_rows(values_only=True):
            celdas = [_txt(c) for c in fila] + [''] * 12
            linea = ' '.join(c for c in celdas if c)

            m = SESION.match(linea)
            if m:
                dia, mes, pesaje, inicio = m.groups()
                ses = {
                    'fecha': f'{anio}-{MES.get(mes.lower(), "09")}-{int(dia):02d}',
                    'pesaje': pesaje.replace('.', ':'),
                    'inicio': inicio.replace('.', ':'),
                    'hoja': clave, 'mod': meta['mod'], 'sexo': meta['sexo'],
                    'campeonato': meta['nombre'], 'grupos': OrderedDict(),
                }
                sesiones.append(ses)
                ronda = 1
                peso = None
                continue

            m = RONDA.match(linea)
            if m:
                # No se borra la categoría acá. El Excel no es parejo: casi siempre
                # va «Round 1» y después «59 kg», pero en el bloque de 74 kg de
                # hombres va al revés, primero «74 kg» y después «Round 1». Al
                # borrarla, esos doce atletas se quedaban sin categoría.
                ronda = int(m.group(1))
                continue

            m = PESO.match(linea)
            if m:
                mas, kilos, mas2 = m.groups()
                # Nada de recortar ceros a la derecha: «120» se convertía en «12».
                k = float(kilos)
                peso = ('+' if (mas or mas2) else '-') + (
                    str(int(k)) if k.is_integer() else str(k))
                continue

            # Fila de atleta: nombre en la 4ª columna y país en la 6ª.
            nombre, nacido, pais = celdas[3], celdas[4], celdas[5]
            if not nombre or not pais or not ses:
                continue
            # La fila de títulos tiene la misma forma que una de atleta.
            if nombre == 'Name' or pais == 'Team':
                continue
            div = celdas[0]
            # LA CATEGORÍA ES LA DEL ENCABEZADO DEL BLOQUE, no la de la fila.
            #
            # La columna de categoría del Excel se contradice con el bloque en el
            # que está la fila, y cuando eso pasa manda el bloque: es lo que define
            # con quién levanta. Dos casos comprobados con la comisión técnica:
            # Ortiz Guevara Samuel figura «83» dentro del bloque de 74 kg y compite
            # en −74; Thierry Thiago figura «105» en su fila de Only Bench dentro
            # del bloque de 120 kg y compite en −120 en las dos modalidades.
            #
            # De paso esto resuelve solo el lío de «Women Eq», donde las columnas
            # de categoría y lote vienen al revés que en las otras hojas.
            a, b = celdas[1], celdas[2]
            # El lote es la columna que NO es la categoría.
            lote = b if _mismo_peso(a, peso) else (a if _mismo_peso(b, peso) else b)
            sq, bp, dl, tot = (_num(celdas[i]) for i in (6, 7, 8, 9))

            # SOLO BANCA. Quien compite además en Only Bench aparece otra vez
            # dentro de la misma sesión con el press y nada más, a veces en otra
            # categoría (se sube de peso para la banca). No es un duplicado.
            solo_bp = bp is not None and sq is None and dl is None
            clave_at = (len(sesiones) - 1, nombre.lower(), div.lower())
            if solo_bp and clave_at in vistos:
                prev = atletas[vistos[clave_at]]
                prev['only_bench'] = True
                prev['ob_bp'] = bp
                prev['ob_cat'] = peso or prev['categoria']
                continue

            # En la hoja de Special Olympics esa columna NO es el lote: la cabecera
            # dice «Pos» y trae la posición final («1.», «2.»). Tomarla por lote
            # dejaba a tres atletas de esa sesión con el número 1.
            if meta['mod'] == 'SO':
                lote = ''

            at = {
                'nombre': nombre, 'pais': pais, 'nacido': nacido,
                'division': div, 'categoria': peso,
                'lote': lote, 'mod': meta['mod'], 'sexo': meta['sexo'],
                'campeonato': meta['nombre'],
                'fecha': ses['fecha'], 'pesaje': ses['pesaje'], 'inicio': ses['inicio'],
                'ronda': ronda, 'peso_grupo': peso,
                'sq': sq, 'bp': bp, 'dl': dl, 'total': tot,
                # Sin marca de sentadilla ni de peso muerto y sin una fila
                # completa antes: este atleta compite SOLO en Only Bench.
                'solo_banca': solo_bp,
                'only_bench': solo_bp,
            }
            if solo_bp:
                at['ob_bp'] = bp
                at['ob_cat'] = peso or at['categoria']
            vistos[clave_at] = len(atletas)
            atletas.append(at)
            g = ses['grupos'].setdefault(ronda, OrderedDict())
            g.setdefault(at['peso_grupo'], []).append(len(atletas) - 1)
    return sesiones, atletas


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'Nominaciones_final_2026.xlsx'
    sesiones, atletas = leer(path)

    # ── EL NÚMERO DE LOTE ───────────────────────────────────────────────
    # La columna «OR.» del Excel va del 1 al 99 y se sortea POR SESIÓN, así que
    # el mismo número aparece en varios días. Para que el número identifique a
    # una sola persona en todo el campeonato se le antepone el día: día 1 los
    # 100, día 2 los 200, y así. El OR 67 del día 3 es el lote 367.
    #
    # Los de Special Olympics quedan sin lote: en esa hoja la columna no es el
    # sorteo sino la posición final («Pos» dice la cabecera, y trae 1., 2., 3.).
    dia_de = {f: i + 1 for i, f in enumerate(sorted({a['fecha'] for a in atletas}))}
    for a in atletas:
        a['or_fesupo'] = a['lote']
        a['dia'] = dia_de[a['fecha']]
        a['lote'] = (str(a['dia'] * 100 + int(a['lote']))
                     if str(a['lote']).strip().isdigit() else '')

    # ── LA TANDA ────────────────────────────────────────────────────────
    # Una letra por RONDA, corridas de principio a fin del campeonato: la primera
    # ronda del 20 es la A, la segunda la B, y así hasta la última del 27. El
    # orden lo da el reloj —primero la fecha, después la hora de pesaje— y no el
    # orden en que las hojas del Excel traen las sesiones, que va por campeonato.
    #
    # Dos sesiones pueden empezar a la misma hora (el 20 a las 14.30 corren
    # Special Olympics y el Equipado de hombres, cada una en su tarima): son
    # tandas distintas igual, con letras seguidas.
    rondas = sorted({(a['fecha'], a['pesaje'], a['inicio'], a['campeonato'], a['ronda'])
                     for a in atletas})
    tandas = {r: letra_tanda(i) for i, r in enumerate(rondas)}
    for a in atletas:
        a['tanda'] = tandas[(a['fecha'], a['pesaje'], a['inicio'],
                             a['campeonato'], a['ronda'])]

    # El cronograma que consume la web: un día, sus sesiones, y dentro de cada
    # sesión las rondas con sus categorías.
    dias = OrderedDict()
    for s in sesiones:
        d = dias.setdefault(s['fecha'], [])
        rondas = []
        for r, cats in s['grupos'].items():
            rondas.append({
                'ronda': r,
                'categorias': [
                    {'peso': p, 'atletas': [atletas[i] for i in idxs]}
                    for p, idxs in cats.items()
                ],
            })
        d.append({'campeonato': s['campeonato'], 'sexo': s['sexo'], 'mod': s['mod'],
                  'pesaje': s['pesaje'], 'inicio': s['inicio'], 'rondas': rondas})

    print(f'{len(atletas)} atletas · {len(sesiones)} sesiones · {len(dias)} días '
          f'· {len(tandas)} tandas ({letra_tanda(0)} a {letra_tanda(len(tandas)-1)})')
    for f in sorted(dias):
        n = sum(len(c['atletas']) for s in dias[f] for r in s['rondas'] for c in r['categorias'])
        print(f'  {f}  {len(dias[f])} sesión(es), {n} atletas')
    ob = sum(1 for a in atletas if a['only_bench'])
    print(f'  de ellos, {ob} compiten además en Only Bench')

    # Se escribe UN solo archivo. El cronograma no se guarda aparte a propósito:
    # sería una segunda copia de lo mismo, y dos listas que dicen quién compite
    # cuándo terminan diciendo cosas distintas. El cronograma que se publica es
    # una vista de la nómina (nomina_sudamericano.json), no un archivo propio.
    with open('nomina_suda_fesupo.json', 'w', encoding='utf-8') as fh:
        json.dump(atletas, fh, ensure_ascii=False, indent=1)
    print('escrito nomina_suda_fesupo.json')


if __name__ == '__main__':
    main()

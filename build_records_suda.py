#!/usr/bin/env python3
"""Convierte el Excel de récords de FESUPO (RECORD_SUDA_Nuevo.xls) a records_suda.json.

Las cuatro hojas tienen la misma forma: secciones por división (CABALLEROS OPEN,
DAMAS JUNIOR…) y adentro bloques SQUAT / BENCH / DEADLIFT / TOTAL / BENCH PRESS
SINGLE LIFT. Las columnas G, H e I ya traen normalizado el movimiento, el código
de división y el equipamiento, así que se leen de ahí en vez de adivinar por el
título de la sección.

    python3 build_records_suda.py <RECORD_SUDA_Nuevo.xls>
"""
import json, sys, datetime, xlrd

SRC = sys.argv[1] if len(sys.argv) > 1 else 'RECORD_SUDA_Nuevo.xls'
OUT = 'records_suda.json'

HOJAS = {'Fesupo power men ': 'M', 'power wom': 'F',
         'power raw men': 'M', 'power raw wom': 'F'}
# Columna G → movimiento. 'BENCH PRESS SINGLE LIFT' es la banca de Only Bench,
# que tiene récord propio y distinto del press de banca dentro del powerlifting.
LIFT = {'SQUAT': 'sq', 'BENCH': 'bp', 'BENCH PRESS': 'bp', 'DEADLIFT': 'dl',
        'TOTAL': 'total', 'BENCH PRESS SINGLE LIFT': 'bpsl'}
DIV = {'O': 'Open', 'J': 'Junior', 'S': 'Sub-Junior',
       'M1': 'Master I', 'M2': 'Master II', 'M3': 'Master III', 'M4': 'Master IV'}
EQ = {'R': 'classic', 'E': 'equipped'}

def cat(v):
    """La categoría viene como número (59.0) o como texto ('120+')."""
    if isinstance(v, (int, float)):
        n = int(v) if float(v).is_integer() else v
        return '-' + str(n)
    t = str(v).strip()
    if not t: return ''
    return '+' + t.replace('+', '') if t.endswith('+') else '-' + t

def fecha(v, dm):
    if not isinstance(v, (int, float)) or not v: return ''
    try: return datetime.date(*xlrd.xldate_as_tuple(v, dm)[:3]).isoformat()
    except Exception: return ''

wb = xlrd.open_workbook(SRC)
# El movimiento se saca del ENCABEZADO DE BLOQUE (columna A), no de la columna
# auxiliar G: el Excel trae filas con G mal puesta (ej. el total +120 Open classic
# de Mardones aparece marcado 'SQUAT'). La división sale del título de la sección.
SECCION = {'OPEN': 'Open', 'JUNIOR': 'Junior', 'SUBJUNIOR': 'Sub-Junior',
           'SUB JUNIOR': 'Sub-Junior', 'MASTER 1': 'Master I', 'MASTER 2': 'Master II',
           'MASTER 3': 'Master III', 'MASTER 4': 'Master IV'}
recs, fuentes, discrepancias = {}, {}, []
for hoja, sexo in HOJAS.items():
    sh = wb.sheet_by_name(hoja)
    fuentes[str(sh.cell_value(0, 0)).strip()] = True
    eq = EQ['R'] if 'raw' in hoja else EQ['E']
    div = lift = None
    for r in range(sh.nrows):
        a = str(sh.cell_value(r, 0)).strip()
        au = a.upper()
        if au in LIFT: lift = LIFT[au]; continue
        if au.startswith(('CABALLEROS', 'DAMAS')):
            resto = au.replace('CABALLEROS', '').replace('DAMAS', '').strip()
            div = next((v for k, v in SECCION.items() if resto.startswith(k)), None)
            if div is None: print('  ! sección no reconocida:', repr(a))
            lift = None
            continue
        marca = sh.cell_value(r, 3)
        c = cat(sh.cell_value(r, 0))
        if not (div and lift and c) or not isinstance(marca, (int, float)) or not marca:
            continue
        gcol = LIFT.get(str(sh.cell_value(r, 6)).strip().upper())
        if gcol and gcol != lift:
            discrepancias.append((hoja, r + 1, a, lift, gcol))
        k = '|'.join([sexo, eq, div, c, lift])
        if k in recs:
            print('  ! clave repetida:', k, recs[k]['kg'], 'vs', marca)
            if recs[k]['kg'] >= marca: continue
        recs[k] = {'kg': round(float(marca), 2),
                   'quien': str(sh.cell_value(r, 1)).replace('\xa0', ' ').strip(),
                   'pais': str(sh.cell_value(r, 2)).strip(),
                   'fecha': fecha(sh.cell_value(r, 4), wb.datemode),
                   'lugar': str(sh.cell_value(r, 5)).strip()}

data = {'_nota': 'Récords sudamericanos oficiales (FESUPO). Generado por build_records_suda.py '
                 'desde RECORD_SUDA_Nuevo.xls — no editar a mano.',
        'fuente': ' · '.join(sorted(fuentes)),
        'generado': datetime.date.today().isoformat(),
        'clave': 'sexo|equipo|division|categoria|movimiento  (movimiento: sq bp dl total bpsl)',
        'records': dict(sorted(recs.items()))}
json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

import collections
print(f'{len(recs)} récords → {OUT}')
print('fuente:', data['fuente'])
for d in ('classic', 'equipped'):
    c = collections.Counter(k.split('|')[4] for k in recs if k.split('|')[1] == d)
    print(f'  {d:9}', dict(sorted(c.items())), '=', sum(c.values()))
faltan = [(s, e, d, c, l) for s in 'MF' for e in EQ.values() for d in DIV.values()
          for c in (['-53','-59','-66','-74','-83','-93','-105','-120','+120'] if s == 'M'
                    else ['-43','-47','-52','-57','-63','-69','-76','-84','+84'])
          for l in LIFT.values() if '|'.join([s, e, d, c, l]) not in recs]
print(f'  sin récord cargado: {len(faltan)} combinaciones (categoría vacía en el Excel)')
if discrepancias:
    print(f'\n  {len(discrepancias)} fila(s) donde la columna auxiliar G del Excel no coincide')
    print('  con el bloque en el que está la fila (manda el bloque):')
    for h, r, a, blo, g in discrepancias:
        print(f'    {h:20} fila {r:>4}  cat {a:>5}  bloque={blo:<6} columna G={g}')

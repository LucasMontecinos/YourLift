#!/usr/bin/env python3
"""Aplica nomina_suda_correcciones.json sobre nomina_sudamericano.json.

El archivo de FESUPO trae errores de categoría. Las correcciones viven aparte
para que sobrevivan a cualquier regeneración de la nómina desde el Excel.
Es idempotente: correr esto dos veces no cambia nada la segunda vez.

    python3 aplicar_correcciones_suda.py        # aplica y reporta
    python3 aplicar_correcciones_suda.py --dry  # solo muestra qué haría
"""
import json, sys, unicodedata

DRY = '--dry' in sys.argv

def nrm(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower().strip()

NOM = json.load(open('nomina_sudamericano.json', encoding='utf-8'))
_C = json.load(open('nomina_suda_correcciones.json', encoding='utf-8'))
COR = _C['correcciones']
EXC = _C.get('exclusiones', [])
VIS = _C.get('nombres_visibles', {})

cambios, sin_match = [], []
for c in COR:
    objetivo = [a for a in NOM['atletas']
                if nrm(a['n']) == nrm(c['n'])
                and (not c.get('lista') or nrm(a['lista']) == nrm(c['lista']))
                and (not c.get('div') or nrm(a['div']) == nrm(c['div']))]
    if not objetivo:
        sin_match.append(c); continue
    for a in objetivo:
        # 'n' sirve para emparejar tildes y ñ, que es donde el archivo de FESUPO se
        # contradice a sí mismo y deja al mismo atleta escrito de dos formas. Sirve
        # para eso y no para renombrar: el emparejado ignora los acentos, así que un
        # cambio de nombre de verdad dejaría de encontrar a nadie la segunda vez.
        for campo in ('n', 'cat', 'div', 'mod', 'sexo', 'pais'):
            if campo in c and a.get(campo) != c[campo]:
                cambios.append((a['n'], a['lista'], campo, a.get(campo), c[campo]))
                if not DRY: a[campo] = c[campo]

# Los que quedaron fuera del team se sacan enteros: todas sus listas. Van acá y
# no borrados a mano para que no reaparezcan cuando la nómina se regenere desde
# el Excel de FESUPO, que los sigue trayendo.
sacados, exc_sin_match = [], []
for e in EXC:
    filas = [a for a in NOM['atletas'] if nrm(a['n']) == nrm(e['n'])]
    if not filas:
        exc_sin_match.append(e); continue
    for a in filas:
        sacados.append((a['n'], a['lista'], e.get('_motivo', '')))
if sacados and not DRY:
    fuera = {nrm(e['n']) for e in EXC}
    NOM['atletas'] = [a for a in NOM['atletas'] if nrm(a['n']) not in fuera]

# Cómo se lee cada nombre. Va en un campo aparte (`nDisp`) y no encima de `n`
# porque `n` es la llave con la que están guardadas las fotos de la nómina y las
# correcciones del admin en Firestore.
_vis = {nrm(k): v for k, v in VIS.items()}
visibles = 0
for a in NOM['atletas']:
    v = _vis.get(nrm(a['n']))
    if v and a.get('nDisp') != v:
        visibles += 1
        if not DRY: a['nDisp'] = v

if cambios:
    print(f'{"atleta":34} {"lista":30} campo  antes → después')
    for n, l, campo, antes, desp in cambios:
        print(f'{n[:33]:34} {l[:29]:30} {campo:5}  {antes} → {desp}')
else:
    print('Sin cambios de categoría: la nómina ya está corregida.')
# Una corrección de alguien que además está excluido no es un error: quedó vieja
# cuando esa persona salió del team. Se separa para que el aviso de "revisar el
# nombre" siga significando lo que dice.
_fuera = {nrm(e['n']) for e in EXC}
viejas = [c for c in sin_match if nrm(c['n']) in _fuera]
sin_match = [c for c in sin_match if nrm(c['n']) not in _fuera]
if sin_match:
    print('\nCorrecciones que no encontraron a nadie (revisar el nombre):')
    for c in sin_match: print('  ', c.get('n'), '·', c.get('lista', ''))
if viejas:
    print('\nCorrecciones que quedaron sin efecto porque el atleta salió del team:')
    for c in viejas: print('  ', c.get('n'), '·', c.get('lista', ''))

if sacados:
    print(f'\nFuera del team ({len(sacados)} inscripción/es):')
    for n, l, motivo in sacados:
        print(f'  {n[:33]:34} {l[:29]:30} {motivo}')
if exc_sin_match:
    # No es un aviso: si ya no están en la nómina, la exclusión hizo su trabajo.
    # Solo importa si el nombre nunca calzó, y eso se ve la primera vez que se corre.
    print(f'\n{len(exc_sin_match)} exclusión(es) ya estaban aplicadas.')

if visibles:
    print(f'\n{visibles} nombre(s) con su forma de mostrarse actualizada.')

if (cambios or sacados or visibles) and not DRY:
    json.dump(NOM, open('nomina_sudamericano.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'\n✓ {len(cambios)} corrección(es), {len(sacados)} baja(s) y {visibles} nombre(s) aplicados a nomina_sudamericano.json')
    print('  Acuérdate de correr build_suda_dias.py para rehacer los días del livecast.')

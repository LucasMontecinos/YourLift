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
ALT = _C.get('altas', [])

# ── ALTAS ────────────────────────────────────────────────────────────────
# Gente que está en la nominación oficial de GoodLift y no venía en el Excel de
# FESUPO. Se agregan acá y no a mano en la nómina para que no desaparezcan la
# próxima vez que la nómina se regenere desde el Excel: es el mismo motivo por el
# que las exclusiones viven en este archivo y no se borran a mano.
altas = []
for al in ALT:
    ya = [a for a in NOM['atletas']
          if nrm(a['n']) == nrm(al['n'])
          and (not al.get('lista') or nrm(a['lista']) == nrm(al['lista']))]
    if ya:
        continue
    fila = {k: v for k, v in al.items() if not k.startswith('_')}
    NOM['atletas'].append(fila)
    altas.append(fila)

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

# Los que quedaron fuera van acá y no borrados a mano, para que no reaparezcan
# cuando la nómina se regenere desde el Excel de FESUPO, que los sigue trayendo.
#
# Sin 'lista' se saca la persona entera, con todas sus inscripciones: se bajó del
# campeonato. Con 'lista' se saca SOLO esa inscripción, y las demás siguen en pie.
# Esa distinción importa: hay veinte atletas nominados en una modalidad y no en
# otra —Borbor Juan está en la clásica de Ecuador pero no en la equipada, Obando
# Diego al revés—, y sacarlos enteros les borraría la inscripción que sí vale.
def _palabras(n):
    """El nombre como conjunto de palabras. El Excel de FESUPO trae a la misma
    persona con los apellidos y los nombres en los dos órdenes —"Ortiz Portugal
    Neto Clotario" y "Neto Clotario Ortiz Portugal" son la misma fila duplicada—,
    y comparando la cadena exacta se sacaba una y quedaba la otra."""
    import re as _re
    t = unicodedata.normalize('NFD', str(n or ''))
    t = ''.join(ch for ch in t if unicodedata.category(ch) != 'Mn')
    return frozenset(_re.sub(r'[^a-z ]', '', t.lower()).split())


def _toca(a, e):
    return _palabras(a['n']) == _palabras(e['n']) and (not e.get('lista')
                                                       or nrm(a['lista']) == nrm(e['lista']))

sacados, exc_sin_match = [], []
for e in EXC:
    filas = [a for a in NOM['atletas'] if _toca(a, e)]
    if not filas:
        exc_sin_match.append(e); continue
    for a in filas:
        sacados.append((a['n'], a['lista'], e.get('_motivo', '')))
if sacados and not DRY:
    NOM['atletas'] = [a for a in NOM['atletas']
                      if not any(_toca(a, e) for e in EXC)]

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
def _excluida(c):
    return any(nrm(c['n']) == nrm(e['n'])
               and (not e.get('lista') or not c.get('lista')
                    or nrm(c['lista']) == nrm(e['lista'])) for e in EXC)
viejas = [c for c in sin_match if _excluida(c)]
sin_match = [c for c in sin_match if not _excluida(c)]
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

if altas:
    print(f'\nAltas desde la nominación oficial ({len(altas)}):')
    for a in altas:
        print(f"  {a['n'][:33]:34} {a.get('lista','')[:24]:25} {a.get('div','')} {a.get('cat','')}")

if (cambios or sacados or visibles or altas) and not DRY:
    json.dump(NOM, open('nomina_sudamericano.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'\n✓ {len(cambios)} corrección(es), {len(sacados)} baja(s), {len(altas)} alta(s) y {visibles} nombre(s) aplicados a nomina_sudamericano.json')
    print('  Acuérdate de correr build_suda_dias.py para rehacer los días del livecast.')

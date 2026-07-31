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
COR = json.load(open('nomina_suda_correcciones.json', encoding='utf-8'))['correcciones']

cambios, sin_match = [], []
for c in COR:
    objetivo = [a for a in NOM['atletas']
                if nrm(a['n']) == nrm(c['n'])
                and (not c.get('lista') or nrm(a['lista']) == nrm(c['lista']))
                and (not c.get('div') or nrm(a['div']) == nrm(c['div']))]
    if not objetivo:
        sin_match.append(c); continue
    for a in objetivo:
        for campo in ('cat', 'div', 'mod', 'sexo', 'pais'):
            if campo in c and a.get(campo) != c[campo]:
                cambios.append((a['n'], a['lista'], campo, a.get(campo), c[campo]))
                if not DRY: a[campo] = c[campo]

if cambios:
    print(f'{"atleta":34} {"lista":30} campo  antes → después')
    for n, l, campo, antes, desp in cambios:
        print(f'{n[:33]:34} {l[:29]:30} {campo:5}  {antes} → {desp}')
else:
    print('Sin cambios: la nómina ya está corregida.')
if sin_match:
    print('\nCorrecciones que no encontraron a nadie (revisar el nombre):')
    for c in sin_match: print('  ', c.get('n'), '·', c.get('lista', ''))

if cambios and not DRY:
    json.dump(NOM, open('nomina_sudamericano.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'\n✓ {len(cambios)} cambio(s) aplicados a nomina_sudamericano.json')
    print('  Acordate de correr build_suda_dias.py para rehacer los días del livecast.')

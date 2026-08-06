#!/usr/bin/env python3
"""Trae a data.json las correcciones que solo existían en la copia de Firebase Storage.

El sitio tiene dos copias de data.json: la del repositorio y `public/data.json` en
Storage, que es la que sube admin con "Publicar data.json al sitio". Las dos se
fueron por caminos distintos:

  · el repositorio tiene lo nuevo (GL corregidos, competencias agregadas, el
    Mundial 2026, los sudamericanos de Only Bench);
  · Storage tiene arreglos hechos a mano desde admin que nunca volvieron acá:
    26 códigos limpios (los del repositorio traen tildes y caracteres sueltos),
    5 clubes, y 2 nombres.

Publicar sin esto desharía esos arreglos: 26 atletas cambiarían de código y se
romperían los links a sus perfiles. Este script los trae al repositorio para que
publicar sea seguro.

NO se toca:
  · el RUT de María Paz Sáez Soto (21117407-6 acá, 21117307-6 en Storage): uno de
    los dos está mal tipeado y no hay cómo saber cuál sin ver su carnet.
  · el RUT 22195983-3. Acá es Francisca Yañez Salgado (4 competencias desde
    2024) y en Storage ese mismo registro aparece renombrado como Francisca
    Cortes Acuña (debut 2026), con un tercer registro suelto para Cortes Acuña
    sin RUT. Alguien escribió encima de la ficha equivocada: traer eso borraría
    a Yañez Salgado. Hay que separarlas a mano en admin.

    python3 alinear_con_storage.py            # muestra qué cambiaría
    python3 alinear_con_storage.py --aplicar  # lo escribe
"""
import json, re, sys, urllib.request

RUTA = 'data.json'
STORAGE = ('https://firebasestorage.googleapis.com/v0/b/'
           'fechipo-db-13148.firebasestorage.app/o/public%2Fdata.json?alt=media')

# RUTs con conflicto real: se dejan como están y se avisan.
NO_TOCAR = {'21117407-6', '22195983-3'}

def rut(s):
    return re.sub(r'[^0-9kK]', '', str(s or '')).upper()

def main():
    aplicar = '--aplicar' in sys.argv
    repo = json.load(open(RUTA, encoding='utf-8'))
    with urllib.request.urlopen(STORAGE, timeout=120) as r:
        stor = json.loads(r.read().decode('utf-8'))
    print(f'repositorio {len(repo)} atletas · Storage {len(stor)}\n')

    por_rut = {}
    for a in stor:
        k = rut(a.get('rut'))
        if k:
            por_rut[k] = a
    saltados = {rut(x) for x in NO_TOCAR}

    cambios = {'codigo': [], 'club': [], 'nombre': []}
    for a in repo:
        k = rut(a.get('rut'))
        s = por_rut.get(k)
        if not s or k in saltados:
            continue
        for campo in ('codigo', 'club', 'nombre'):
            viejo, nuevo = str(a.get(campo) or ''), str(s.get(campo) or '')
            if viejo and nuevo and viejo != nuevo:
                cambios[campo].append((a.get('nombre'), viejo, nuevo))
                a[campo] = nuevo

    for campo, lista in cambios.items():
        if not lista:
            continue
        print(f'── {campo}: {len(lista)}')
        for n, v, nv in lista:
            print(f'   {str(n)[:34]:34} {v:22} → {nv}')

    # Un código repetido rompe los perfiles (se buscan por código): se aborta.
    vistos = {}
    dobles = []
    for a in repo:
        c = a.get('codigo')
        if c in vistos:
            dobles.append((c, vistos[c], a.get('nombre')))
        vistos[c] = a.get('nombre')
    if dobles:
        print('\n!! ABORTADO — quedarían códigos repetidos:')
        for c, n1, n2 in dobles:
            print(f'   {c}: {n1} / {n2}')
        return 1
    print('\nsin códigos repetidos ✓')

    if aplicar:
        json.dump(repo, open(RUTA, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('data.json escrito.')
    else:
        print('(prueba — no se escribió nada; usar --aplicar)')
    return 0

if __name__ == '__main__':
    sys.exit(main())

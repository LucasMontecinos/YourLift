# -*- coding: utf-8 -*-
"""Compara los récords sudamericanos que mandó FESUPO (los cuatro PDF) contra
records_suda.json, y dice qué cambió.

Los PDF tienen una sección por división —CABALLEROS OPEN, DAMAS JUNIOR…— y
adentro bloques SQUAT / BENCH / DEADLIFT / TOTAL / BENCH PRESS SINGLE LIFT. Cada
línea es: categoría, nombre/año, país, marca, fecha, lugar.
"""
import json, re, sys, datetime

# En caballeros el bloque se titula BENCH y en damas BENCH PRESS: es el mismo
# movimiento. 'BENCH PRESS SINGLE LIFT' es otra cosa —la banca de Only Bench,
# que tiene récord propio— y por eso va aparte.
LIFT = {'SQUAT': 'sq', 'BENCH': 'bp', 'BENCH PRESS': 'bp', 'DEADLIFT': 'dl',
        'TOTAL': 'total', 'BENCH PRESS SINGLE LIFT': 'bpsl'}
DIV = {'OPEN': 'Open', 'JUNIOR': 'Junior', 'SUBJUNIOR': 'Sub-Junior',
       'MASTER 1': 'Master I', 'MASTER 2': 'Master II',
       'MASTER 3': 'Master III', 'MASTER 4': 'Master IV'}
MES = {'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
       'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12}

ARCHIVOS = [('raw_men.txt', 'M', 'classic'), ('eq_men.txt', 'M', 'equipped'),
            ('raw_wom.txt', 'F', 'classic'), ('eq_wom.txt', 'F', 'equipped')]

# categoría · nombre · país · marca · fecha · lugar. El lugar puede faltar.
FILA = re.compile(r'^\s*(\d+\+?|\+\d+)\s+(.+?)\s{2,}([A-Za-zÁ-ú .]+?)\s{2,}([\d.]+)\s+(\d{2}-\w{3}-\d{2})(?:\s+(.*?))?\s*$')
# Hay récords de los que FESUPO conserva la marca pero perdió de quién era: la
# fila trae la categoría y el peso y nada más. Cuentan igual como récord.
SOLO = re.compile(r'^\s*(\d+\+?|\+\d+)\s+([\d.]+)\s*$')


def fecha_iso(t):
    d, m, a = t.split('-')
    return '%d-%02d-%02d' % (2000 + int(a), MES.get(m.lower(), 1), int(d))


def cat_norm(c):
    c = c.strip()
    return '+' + c[:-1] if c.endswith('+') else ('-' + c if not c.startswith('+') else c)


def leer(path, sexo, eq):
    out, div, lift = {}, None, None
    for ln in open(path, encoding='utf-8'):
        s = ln.rstrip('\n')
        t = s.strip()
        m = re.match(r'^(CABALLEROS|DAMAS)\s+(.+)$', t)
        if m:
            div = DIV.get(m.group(2).strip().upper())
            lift = None
            continue
        cab = re.match(r'^([A-Z][A-Z ]+?)(?:\s+NOMBRE.*)?$', t)
        if cab and cab.group(1).strip() in LIFT:
            lift = LIFT[cab.group(1).strip()]
            continue
        if not (div and lift):
            continue
        f = FILA.match(s)
        if f:
            cat, quien, pais, kg, fec, lugar = f.groups()
            reg = {'kg': float(kg), 'quien': quien.strip(), 'pais': pais.strip(),
                   'fecha': fecha_iso(fec), 'lugar': (lugar or '').strip()}
        else:
            g = SOLO.match(s)
            if not g:
                continue
            cat, kg = g.groups()
            reg = {'kg': float(kg), 'quien': '', 'pais': '', 'fecha': '', 'lugar': ''}
        out['%s|%s|%s|%s|%s' % (sexo, eq, div, cat_norm(cat), lift)] = reg
    return out


nuevo = {}
for arch, sexo, eq in ARCHIVOS:
    d = leer(arch, sexo, eq)
    print('  %-14s %s %-9s → %d récords' % (arch, sexo, eq, len(d)))
    nuevo.update(d)

viejo = json.load(open('records_suda.json', encoding='utf-8'))['records']
print('\nPDF de FESUPO: %d   ·   records_suda.json: %d\n' % (len(nuevo), len(viejo)))

subidos, bajados, nuevos, iguales = [], [], [], 0
for k, v in nuevo.items():
    a = viejo.get(k)
    if not a:
        nuevos.append((k, v)); continue
    if abs(a['kg'] - v['kg']) < .01:
        iguales += 1
    elif v['kg'] > a['kg']:
        subidos.append((k, a, v))
    else:
        bajados.append((k, a, v))
faltan = [k for k in viejo if k not in nuevo]

print('SIN CAMBIO      %d' % iguales)
print('MARCA SUBIÓ     %d' % len(subidos))
print('MARCA BAJÓ      %d   (revisar: un récord no debería bajar)' % len(bajados))
print('NUEVOS          %d   (no estaban en nuestro archivo)' % len(nuevos))
print('NO VIENEN       %d   (están en el nuestro y no en el PDF)' % len(faltan))

def muestra(t, filas, n=100):
    if not filas: return
    print('\n' + t)
    for x in filas[:n]:
        if len(x) == 3:
            k, a, v = x
            print('  %-34s %7.1f → %7.1f   %s (%s) %s' %
                  (k, a['kg'], v['kg'], v['quien'], v['pais'], v['fecha']))
        else:
            k, v = x
            print('  %-34s %7.1f   %s (%s) %s' % (k, v['kg'], v['quien'], v['pais'], v['fecha']))
    if len(filas) > n: print('  … y %d más' % (len(filas) - n))

muestra('── SUBIERON ──', subidos)
muestra('── BAJARON (raro) ──', bajados)
muestra('── NUEVOS ──', nuevos, 40)
if faltan:
    print('\n── EN EL NUESTRO Y NO EN EL PDF ── (%d)' % len(faltan))
    for k in faltan[:25]: print('  ', k)
    if len(faltan) > 25: print('  … y %d más' % (len(faltan) - 25))

json.dump(nuevo, open('nuevo.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

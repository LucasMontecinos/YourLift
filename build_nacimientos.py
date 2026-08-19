#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Arma nacimientos.js: el año de nacimiento de cada atleta, por nombre.

El ranking necesita el año de nacimiento para saber en qué división de edad
está HOY cada atleta (ver yl-divisiones.js). Los resultados históricos ya
publicados no lo traen —solo el nombre— así que se saca de los archivos que
sí lo tienen y se deja en una tabla al lado.

Los resultados nuevos que publica el livecast al cerrar una competencia sí
guardan el año en el propio resultado, así que esta tabla es solo para lo
viejo. Igual conviene regenerarla de vez en cuando:

    python3 build_nacimientos.py

Solo guarda el AÑO, no la fecha completa: es lo único que hace falta para la
división y es menos dato del que ya se publica en data.json.
"""
import json
import os
import re
import unicodedata

RAIZ = os.path.dirname(os.path.abspath(__file__))

FUENTES = [
    # (archivo, campo de la fecha)
    ('data.json', 'fechaNac'),
    ('inscripciones.json', 'fechanac'),
]


def clave(nombre):
    """Mismo normalizado que ylClaveNombre() en yl-divisiones.js."""
    s = unicodedata.normalize('NFD', str(nombre or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return ' '.join(s.lower().split())


def anio(fecha):
    m = re.search(r'\b(?:19|20)\d{2}\b', str(fecha or ''))
    if not m:
        return 0
    y = int(m.group(0))
    # En la base quedaron fechas de relleno (31/12/1900 y parecidas) de cuando no
    # se conocía la real. No sirven para calcular la división y mandarían a esa
    # persona a Master IV, así que es mejor no tener el dato que tenerlo malo.
    return y if y >= 1920 else 0


def recolectar():
    tabla = {}
    for archivo, campo in FUENTES:
        ruta = os.path.join(RAIZ, archivo)
        if not os.path.exists(ruta):
            print('  (falta %s, se salta)' % archivo)
            continue
        with open(ruta, encoding='utf-8') as fh:
            datos = json.load(fh)
        antes = len(tabla)
        for a in datos:
            if not isinstance(a, dict):
                continue
            y = anio(a.get(campo) or a.get('fechaNac') or a.get('fechanac'))
            k = clave(a.get('nombre'))
            if y and k:
                tabla.setdefault(k, y)
        print('  %-24s %4d nombres nuevos' % (archivo, len(tabla) - antes))
    return tabla


def main():
    print('Leyendo fuentes:')
    tabla = recolectar()
    salida = os.path.join(RAIZ, 'nacimientos.js')
    cuerpo = json.dumps(tabla, ensure_ascii=False, sort_keys=True,
                        separators=(',', ':'))
    with open(salida, 'w', encoding='utf-8') as fh:
        fh.write('/* Generado por build_nacimientos.py — no editar a mano.\n'
                 '   Año de nacimiento por nombre normalizado, para que el ranking\n'
                 '   pueda recalcular la división de edad (ver yl-divisiones.js).\n'
                 '   %d atletas. */\n' % len(tabla))
        fh.write('window.YL_NAC=' + cuerpo + ';\n')
    print('\n%s: %d atletas, %.1f KB' %
          (os.path.basename(salida), len(tabla), os.path.getsize(salida) / 1024))


if __name__ == '__main__':
    main()

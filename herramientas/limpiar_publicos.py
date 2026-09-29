#!/usr/bin/env python3
"""Saca los datos personales de los archivos que publica el sitio.

data.json y nominas.json se sirven a cualquiera desde yourlift.cl. No pueden
llevar RUT ni fecha de nacimiento completa: se dejan el año (anioNac / born),
que alcanza para la división por edad. El RUT y la fecha viven en Firestore
(privado/padron y rut_indice), ver compartido/privacidad.js: es la misma regla.

Correr desde la raíz del repositorio, antes de subir un data.json o un
nominas.json nuevos:
    python3 herramientas/limpiar_publicos.py
La prueba t_datospublicos.js falla si alguno quedó con datos personales.
"""
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Los mismos de compartido/privacidad.js, más 'dob' (así lo llama nominas.json).
PRIVADOS = ['rut', 'fechaNac', 'fechanac', 'fechanacimiento', 'dob', 'email', 'correo',
            'telefono', 'fono', 'celular', 'direccion']


def anio(fecha):
    m = re.search(r'\b(19|20)\d{2}\b', str(fecha or ''))
    return m.group(0) if m else ''


def limpiar(a, campo_anio):
    y = a.get(campo_anio) or anio(a.get('fechaNac') or a.get('fechanac') or a.get('dob'))
    o = {k: v for k, v in a.items() if k not in PRIVADOS}
    if y:
        o[campo_anio] = str(y)
    return o


def guardar(nombre, datos, sangria):
    ruta = os.path.join(RAIZ, nombre)
    with open(ruta, 'w', encoding='utf-8') as fh:
        json.dump(datos, fh, ensure_ascii=False, indent=sangria)
        fh.write('\n')


def main():
    ruta = os.path.join(RAIZ, 'data.json')
    texto = open(ruta, encoding='utf-8').read()
    data = json.loads(texto)
    antes = sum(1 for a in data if a.get('rut') or a.get('fechaNac'))
    data = [limpiar(a, 'anioNac') for a in data]
    guardar('data.json', data, 1 if texto.startswith('[\n {') else 2)
    print('data.json: %d atletas, %d tenían RUT o fecha' % (len(data), antes))

    ruta = os.path.join(RAIZ, 'nominas.json')
    texto = open(ruta, encoding='utf-8').read()
    nom = json.loads(texto)
    n = 0
    for ev in nom.get('events', []):
        ats = ev.get('athletes') or []
        n += sum(1 for a in ats if a.get('rut') or a.get('dob'))
        ev['athletes'] = [limpiar(a, 'born') for a in ats]
    guardar('nominas.json', nom, 1 if texto.startswith('{\n "') else 2)
    print('nominas.json: %d inscritos tenían RUT o fecha' % n)


if __name__ == '__main__':
    main()

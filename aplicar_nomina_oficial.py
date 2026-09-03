#!/usr/bin/env python3
"""Pasa la nómina FINAL de FESUPO (el Excel) a la que publica yourlift.cl.

Hasta ahora la nómina del sitio venía de los PDF de nominación de GoodLift, que
dicen quién está nominado pero no cuándo compite ni con qué número de lote. El
Excel final trae las dos cosas, así que de acá sale:

  · el NÚMERO DE LOTE de cada atleta (la columna «OR.» del Excel). Se repite
    entre sesiones distintas —cada sesión tiene su propio sorteo— pero nunca
    dentro de la misma, que es lo que importa al cantarlo en el pesaje.
  · el DÍA, la hora de PESAJE, la de INICIO, la RONDA y la TANDA de cada uno.
    La tanda es una letra corrida por ronda, de la A a la AJ, ordenada por
    fecha y hora de pesaje: la primera ronda del 20 es la A y la última del 27
    es la AJ.
  · y las bajas: quien está en la web y ya no está en el Excel.

Cada sesión del Excel («23 Sep - Weigh in start 07.00 hs…») se convierte en una
jornada, y cada inscripción queda apuntando a la suya. El cronograma público es
después una vista de esto: no hay una segunda fuente que se pueda desincronizar.

    python3 leer_nomina_fesupo.py Nominaciones_final_2026.xlsx
    python3 aplicar_nomina_oficial.py
"""
import json
import re
import sys
import unicodedata
from collections import OrderedDict

LIG = str.maketrans({'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff',
                     'ﬃ': 'ffi', 'ﬄ': 'ffl'})

# Cómo se llama cada división en el Excel y cómo la escribe la federación.
DIV = {
    'open': 'Open', 'juniors': 'Junior', 'junior': 'Junior',
    'sjr': 'Sub-Junior', 'sjrs': 'Sub-Junior',
    'm1': 'Master I', 'm2': 'Master II', 'm3': 'Master III', 'm4': 'Master IV',
    'univ': 'Universitario', 'soi': 'Special Olympics',
}
# La modalidad sale de la hoja y de la división, no del nombre del campeonato.
MOD_PLENA = {'PL': 'Clásico', 'EQ': 'Equipado', 'SO': 'Olimpiadas Especiales'}
MOD_BANCA = {'PL': 'Only Bench Clásico', 'EQ': 'Only Bench Equipado'}


def palabras(s):
    """El nombre como conjunto de palabras, sin tildes ni ligaduras.

    Se compara así porque el mismo atleta viene escrito con los apellidos en
    distinto orden según la lista, y algunos PDF traen «ﬁ» como un solo carácter.
    """
    t = str(s or '').translate(LIG)
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return frozenset(re.sub(r'[^a-z ]', '', t.lower()).split())


def modalidad(of, banca=False):
    if of['division'].lower() == 'univ':
        return 'Universitario'
    if banca:
        return MOD_BANCA.get(of['mod'], 'Only Bench Clásico')
    return MOD_PLENA.get(of['mod'], 'Clásico')


def main():
    ofi = json.load(open('nomina_suda_fesupo.json', encoding='utf-8'))
    nom = json.load(open('nomina_sudamericano.json', encoding='utf-8'))

    # ── Las jornadas, tal como vienen del Excel ──────────────────────────
    sesiones = OrderedDict()
    for a in ofi:
        k = (a['fecha'], a['pesaje'], a['inicio'], a['campeonato'], a['sexo'])
        sesiones.setdefault(k, [])
    orden = sorted(sesiones, key=lambda k: (k[0], k[2], k[1]))
    jid = {k: i for i, k in enumerate(orden)}

    # ── Qué le toca a cada inscripción ───────────────────────────────────
    # Una fila del Excel puede ser dos inscripciones en la web: la completa y,
    # si además hace Only Bench, la de banca.
    plan = {}
    for a in ofi:
        k = (a['fecha'], a['pesaje'], a['inicio'], a['campeonato'], a['sexo'])
        base = {
            'lote': a['lote'], 'fecha': a['fecha'], 'pesaje': a['pesaje'],
            'inicio': a['inicio'], 'ronda': a['ronda'], 'tanda': a['tanda'],
            'jornada': jid[k],
            'div': DIV.get(a['division'].lower(), a['division']),
        }
        nm = palabras(a['nombre'])
        if not a.get('solo_banca'):
            plan[(nm, modalidad(a))] = dict(base, cat=a['categoria'])
        if a.get('only_bench'):
            plan[(nm, modalidad(a, banca=True))] = dict(
                base, cat=a.get('ob_cat') or a['categoria'])

    nombres_ofi = {palabras(a['nombre']) for a in ofi}

    # ── Aplicar ──────────────────────────────────────────────────────────
    puestos = cambio_cat = cambio_div = 0
    sin_dia = []
    bajas = []
    quedan = []
    for at in nom['atletas']:
        nm = palabras(at['n'])
        if nm not in nombres_ofi:
            bajas.append(at)
            continue
        p = plan.get((nm, at.get('mod')))
        if not p:
            sin_dia.append(at)
            quedan.append(at)
            continue
        if at.get('cat') != p['cat']:
            cambio_cat += 1
            at['catAntes'] = at.get('cat')
            at['cat'] = p['cat']
        if at.get('div') != p['div']:
            cambio_div += 1
            at['div'] = p['div']
        # LA «R» DE RESERVA SE CAE. Venía de los PDF de nominación de GoodLift,
        # que marcaban con una R a los suplentes de cada país. En la nominación
        # FINAL no hay suplentes: los catorce que estaban marcados aparecen con
        # sesión, ronda y tanda asignadas, o sea que compiten. Dejar la marca
        # ponía una R al lado de gente que sí levanta.
        at.pop('res', None)
        at['lote'] = p['lote']
        at['tanda'] = p['tanda']
        at['fecha'] = p['fecha']
        at['pesaje'] = p['pesaje']
        at['inicio'] = p['inicio']
        at['ronda'] = p['ronda']
        at['jornada'] = p['jornada']
        puestos += 1
        quedan.append(at)

    nom['atletas'] = quedan
    nom['jornadas'] = [
        {'id': jid[k], 'dia': orden.index(k) + 1, 'fecha': k[0],
         'pesaje': k[1], 'inicio': k[2], 'campeonato': k[3], 'sexo': k[4]}
        for k in orden
    ]
    # Los días, para el selector del cronograma.
    dias = OrderedDict()
    for k in orden:
        dias.setdefault(k[0], []).append(jid[k])
    nom['dias'] = [{'fecha': f, 'jornadas': js} for f, js in sorted(dias.items())]
    nom['fuente'] = 'Nominaciones finales FESUPO (Nominaciones_final_2026.xlsx)'
    nom['cronogramaPublico'] = True

    json.dump(nom, open('nomina_sudamericano.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    print(f'{puestos} inscripciones con día, hora y lote')
    print(f'{cambio_cat} cambios de categoría · {cambio_div} cambios de división')
    print(f'{len(nom["jornadas"])} jornadas en {len(nom["dias"])} días')
    if bajas:
        print(f'\nBAJAS ({len(bajas)}) — están en la web y ya no en el Excel:')
        for b in bajas:
            print(f'   {b["n"]} · {b.get("pais")} · {b.get("div")} {b.get("cat")} · {b.get("mod")}')
    if sin_dia:
        print(f'\nSIN DÍA ({len(sin_dia)}) — el atleta está, pero esa modalidad no:')
        for b in sin_dia:
            print(f'   {b["n"]} · {b.get("div")} {b.get("cat")} · {b.get("mod")}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

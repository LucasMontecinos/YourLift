#!/usr/bin/env python3
"""Cruza el team Chile de nomina_sudamericano.json contra la NOMINACIÓN OFICIAL
de goodlift.info (nomina_suda_goodlift.json).

GoodLift manda. El Excel de FESUPO es un preliminar que llega con errores y se
desactualiza; goodlift.info es donde las federaciones suben y bajan gente, y lo
que está ahí es lo que ya pagó. Así que esto no es un chequeo de estilo: si un
atleta está en GoodLift y no en nuestra nómina, el día de la competencia no
aparece en el livecast; y si está en la nuestra y en ninguna lista oficial,
figura en una nómina pública gente que no va a levantar.

    python3 verificar_goodlift.py

Sale con código 1 si hay diferencias, para poder colgarlo de la batería.

Cómo se compara: por nombre (sin tildes, sin orden —la planilla escribe
"Apellidos Nombres" y GoodLift a veces al revés—), por categoría y por MODALIDAD.

La modalidad importa porque el mismo atleta puede estar nominado en dos
campeonatos a la vez y son dos inscripciones distintas: sube dos veces a la
tarima y compite por dos medallas. Pasa harto —Núñez Rodríguez y Briones están en
equipado y en banca equipada— y si se juntaran en una sola familia, la segunda
inscripción se perdería sin que nadie lo note.

    PL   powerlifting clásico
    UNI  universitario
    SO   Special Olympics
    EQ   powerlifting equipado
    OB   banca clásica    (Only Bench Classic)
    OBEQ banca equipada   (Only Bench Equipado)

UNIVERSITARIO Y SPECIAL OLYMPICS NO SON CLÁSICO. Se levanta con el mismo
reglamento, sí, pero son campeonatos aparte: nominación propia en GoodLift
—"South American Men's University Powerlifting 2026", "Pan-American Open Men's
2026 - Special Olympics"— y medallas propias. Contarlos como clásico esconde
inscripciones y arma podios que no existen.

Son DOCE nominaciones en total: esas seis modalidades repartidas en hombres y
mujeres. Las doce tienen que estar en nomina_suda_goodlift.json.
"""
import json, re, sys, unicodedata

MOD = {'Clásico': 'PL', 'Universitario': 'UNI', 'Olimpiadas Especiales': 'SO',
       'Equipado': 'EQ', 'Only Bench Clásico': 'OB', 'Only Bench Equipado': 'OBEQ'}


def _palabras(n):
    s = unicodedata.normalize('NFD', str(n or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z ]', '', s.lower()).split()


def clave(n):
    """El nombre como conjunto de palabras: aguanta el orden dado vuelta."""
    return tuple(sorted(_palabras(n)))


def main():
    oficial = json.load(open('nomina_suda_goodlift.json', encoding='utf-8'))['chilenos']
    nuestra = [a for a in json.load(open('nomina_sudamericano.json', encoding='utf-8'))['atletas']
               if a.get('pais') == 'Chile']

    idx = {}
    for a in nuestra:
        idx.setdefault((clave(a['n']), MOD[a['mod']]), []).append(a)

    print(f"NOMINACIÓN OFICIAL de Chile (GoodLift): {len(oficial)}")
    print(f"Team Chile en nuestra nómina:           {len(nuestra)}\n")

    calzan, otracat, faltan, usadas = 0, [], [], set()
    for o in oficial:
        k = (clave(o['n']), o['ev'])
        if k not in idx:
            faltan.append(o)
            continue
        usadas.add(k)
        a = idx[k][0]
        if a['cat'] != o['cat']:
            otracat.append((o, a))
        else:
            calzan += 1
    sobran = [a for k, v in idx.items() if k not in usadas for a in v]

    print(f"✔ calzan nombre + categoría + modalidad: {calzan} de {len(oficial)}")
    if otracat:
        print(f"\n⚠ MISMA PERSONA, OTRA CATEGORÍA ({len(otracat)}):")
        for o, a in otracat:
            print(f"   {o['n']:38} GoodLift {o['ev']:5} {o['cat']:6} · nosotros {a['cat']}")
    if faltan:
        print(f"\n✗ EN GOODLIFT Y NO EN NUESTRA NÓMINA ({len(faltan)}) — no saldrían en el livecast:")
        for o in faltan:
            print(f"   {o['n']:38} {o['ev']:5} {o['div']:12} {o['cat']}")
    if sobran:
        print(f"\n△ EN NUESTRA NÓMINA Y EN NINGUNA LISTA OFICIAL ({len(sobran)}):")
        for a in sobran:
            print(f"   {a['n']:38} {a['mod']:22} {a['cat']}")
    if not (otracat or faltan or sobran):
        print("\nSin diferencias: la nómina publicada es la nominación oficial.")
        return 0
    print("\nLas diferencias se arreglan en nomina_suda_correcciones.json "
          "(altas / exclusiones / correcciones)\ny después: "
          "python3 aplicar_correcciones_suda.py && python3 build_suda_dias.py")
    return 1


if __name__ == '__main__':
    sys.exit(main())

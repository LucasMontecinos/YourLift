#!/usr/bin/env python3
"""Cruza el team Chile de nomina_sudamericano.json contra la NOMINACIÓN OFICIAL
de goodlift.info (nomina_suda_goodlift.json).

GoodLift manda. El Excel de FESUPO es un preliminar que llega con errores y se
desactualiza; goodlift.info es donde las federaciones suben y bajan gente, y lo
que está ahí es lo que ya pagó. Así que esto no es un chequeo de estilo: si un
atleta está en GoodLift y no en nuestra nómina, el día de la competencia no
aparece en el livecast; y si está en la nuestra y en ninguna lista oficial,
figura en una nómina pública gente que no va a levantar.

    python3 verificar_goodlift.py            # los 615 de la nómina, todos los países
    python3 verificar_goodlift.py Chile      # solo un país

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


def _cerca(a, b):
    """¿Son la misma persona escrita distinto? El Excel de FESUPO y GoodLift no
    siempre coinciden en la ortografía —"Sebantian" contra "Sebastian", "Luisa"
    contra "Luiza"— y una letra de diferencia hacía que la misma persona saliera
    dos veces en el informe: una como que falta y otra como que sobra. Se comparan
    los nombres palabra a palabra permitiendo una errata chica en una sola."""
    if len(a) != len(b):
        return False
    distintas = [(x, y) for x, y in zip(sorted(a), sorted(b)) if x != y]
    if len(distintas) != 1:
        return False
    x, y = distintas[0]
    if abs(len(x) - len(y)) > 1 or max(len(x), len(y)) < 5:
        return False
    # Distancia de edición <= 1, calculada corta porque son palabras sueltas.
    if len(x) == len(y):
        return sum(1 for i, j in zip(x, y) if i != j) == 1
    corto, largo = (x, y) if len(x) < len(y) else (y, x)
    for i in range(len(largo)):
        if largo[:i] + largo[i + 1:] == corto:
            return True
    return False


def main():
    import sys as _s
    solo = None
    for a in _s.argv[1:]:
        if not a.startswith('-'):
            solo = a
    oficial = json.load(open('nomina_suda_goodlift.json', encoding='utf-8'))['nominaciones']
    nuestra = json.load(open('nomina_sudamericano.json', encoding='utf-8'))['atletas']
    if solo:
        oficial = [o for o in oficial if o['pais'] == solo]
        nuestra = [a for a in nuestra if a.get('pais') == solo]

    idx = {}
    for a in nuestra:
        idx.setdefault((clave(a['n']), MOD[a['mod']]), []).append(a)

    quien = solo or "todos los países"
    print(f"NOMINACIÓN OFICIAL de GoodLift ({quien}): {len(oficial)}")
    print(f"Nuestra nómina publicada:               {len(nuestra)}\n")

    calzan, otracat, faltan, erratas, usadas = 0, [], [], [], set()
    for o in oficial:
        k = (clave(o['n']), o['ev'])
        if k not in idx:
            # Antes de darlo por ausente: puede ser la misma persona mal escrita.
            k2 = next((kk for kk in idx
                       if kk[1] == o['ev'] and kk not in usadas and _cerca(kk[0], k[0])), None)
            if k2 is None:
                faltan.append(o)
                continue
            erratas.append((o, idx[k2][0]))
            k = k2
        usadas.add(k)
        a = idx[k][0]
        if a['cat'] != o['cat']:
            otracat.append((o, a))
        else:
            calzan += 1
    sobran = [a for k, v in idx.items() if k not in usadas for a in v]

    print(f"✔ calzan nombre + categoría + modalidad: {calzan} de {len(oficial)}")
    if erratas:
        print(f"\n✎ MISMA PERSONA, NOMBRE MAL ESCRITO ({len(erratas)}):")
        for o, a in erratas:
            print(f"   {a['n']:38} {o['pais']:10} GoodLift dice: {o['n']}")
    if otracat:
        print(f"\n⚠ MISMA PERSONA, OTRA CATEGORÍA ({len(otracat)}):")
        for o, a in otracat:
            print(f"   {o['n']:38} {o['pais']:10} GoodLift {o['ev']:5} {o['cat']:6} · nosotros {a['cat']}")
    if faltan:
        print(f"\n✗ EN GOODLIFT Y NO EN NUESTRA NÓMINA ({len(faltan)}) — no saldrían en el livecast:")
        for o in faltan:
            print(f"   {o['n']:38} {o['pais']:10} {o['ev']:5} {o['div']:12} {o['cat']}")
    if sobran:
        print(f"\n△ EN NUESTRA NÓMINA Y EN NINGUNA LISTA OFICIAL ({len(sobran)}):")
        for a in sobran:
            print(f"   {a['n']:38} {a['pais']:10} {a['mod']:22} {a['cat']}")
    if not (otracat or faltan or sobran or erratas):
        print("\nSin diferencias: la nómina publicada es la nominación oficial.")
        return 0
    print("\nLas diferencias se arreglan en nomina_suda_correcciones.json "
          "(altas / exclusiones / correcciones)\ny después: "
          "python3 aplicar_correcciones_suda.py && python3 build_suda_dias.py")
    return 1


if __name__ == '__main__':
    sys.exit(main())

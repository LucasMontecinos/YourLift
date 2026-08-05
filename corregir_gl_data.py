#!/usr/bin/env python3
"""Recalcula los GL Points guardados en data.json (perfiles y ranking).

Los GL se guardaban con una tabla de coeficientes equivocada y sin distinguir la
banca sola, así que quedaron mal en el histórico. Este script los recalcula, pero
SOLO donde se puede hacer con certeza:

  · Se corrige cuando la modalidad dice sin ambigüedad el equipamiento Y si fue
    solo banca ("Powerlifting Equipado", "Only Bench Classic IPF", "classic"…).
  · NO se toca cuando la modalidad es de las viejas y ambiguas ("RAW",
    "EQUIPADO"): no dicen si el resultado fue de banca sola, y recalcular a ciegas
    rompería los que hoy están bien. Se verificó que 650 de esos 686 ya coinciden
    con la serie correcta.
  · Aparte se arreglan los valores corruptos (un total de 750 kg con 10.68
    puntos, o 6.7 millones), que están mal con cualquier criterio.

bestLifts.glp se actualiza solo si venía siendo el máximo de sus resultados; si
salía de otro lado, se deja y se avisa.

    python3 corregir_gl_data.py           # muestra qué cambiaría
    python3 corregir_gl_data.py --aplicar # lo escribe
"""
import json, math, sys, collections

RUTA = 'data.json'
COEF = {
    ('cl', 'M'):  (1199.72839, 1025.18162, 0.00921),
    ('cl', 'F'):  (610.32796,  1045.59282, 0.03048),
    ('eq', 'M'):  (1236.25115, 1449.21864, 0.01644),
    ('eq', 'F'):  (758.63878,  949.31382,  0.02435),
    ('bcl', 'M'): (320.98041,  281.40258,  0.01008),
    ('bcl', 'F'): (142.40398,  442.52671,  0.04724),
    ('beq', 'M'): (381.22073,  733.79378,  0.02398),
    ('beq', 'F'): (221.82209,  357.00377,  0.02937),
}

def sexo_k(s):
    return 'F' if str(s or '').lower().startswith(('muj', 'fem')) else 'M'

def serie(modalidad):
    """Serie de coeficientes, o None si la modalidad no alcanza para decidir."""
    m = (modalidad or '').lower().strip()
    if not m:
        return None
    if 'powerlifting' in m or 'only bench' in m:
        eq = 'equip' in m
        solo_banca = ('bench' in m) and ('powerlifting' not in m)
        return ('beq' if eq else 'bcl') if solo_banca else ('eq' if eq else 'cl')
    if m in ('classic', 'raw_classic'):
        return 'cl'
    if m == 'onlybench':
        return 'bcl'
    return None      # 'RAW', 'EQUIPADO': no dicen si fue solo banca

def gl(total, bw, k):
    a, b, c = COEF[k]
    den = a - b * math.exp(-c * bw)
    return round(total * 100 / den, 2) if den > 0 else 0

def corregir(datos):
    cambios, corruptos, sin_datos, ambiguos, best_ok, best_omitido = [], [], 0, 0, 0, []
    for at in datos:
        viejos = [(c.get('resultado') or {}).get('glp') or 0 for c in (at.get('competencias') or [])]
        max_viejo = max(viejos) if viejos else 0
        toco = False
        for c in (at.get('competencias') or []):
            r = c.get('resultado') or {}
            g, t, bw, sx = r.get('glp'), r.get('total'), r.get('bw'), c.get('sexo')
            if g is None:
                continue
            if not t or not bw or not sx:
                sin_datos += 1
                continue
            k = serie(c.get('modalidad'))
            # Valor corrupto: no hay criterio con el que 6.7 millones o 10.68
            # para un total de 750 kg sean correctos. Se recalcula igual, con la
            # serie que corresponda (para los ambiguos, powerlifting según su
            # equipamiento, que es lo que son esos casos).
            es_corrupto = g > 500 or (g > 0 and t / bw > 3 and g < 20)
            if k is None:
                if not es_corrupto:
                    ambiguos += 1
                    continue
                m = (c.get('modalidad') or '').lower()
                k = 'eq' if 'equip' in m else 'cl'
                nuevo = gl(t, bw, (k, sexo_k(sx)))
                corruptos.append((at.get('nombre'), c.get('modalidad'), t, bw, g, nuevo))
                r['glp'] = nuevo; toco = True
                continue
            nuevo = gl(t, bw, (k, sexo_k(sx)))
            if abs(nuevo - g) > 0.1:
                (corruptos if es_corrupto else cambios).append(
                    (at.get('nombre'), c.get('modalidad'), t, bw, g, nuevo))
                r['glp'] = nuevo; toco = True
        if toco:
            bl = at.get('bestLifts') or {}
            if bl.get('glp'):
                nuevos = [(c.get('resultado') or {}).get('glp') or 0 for c in (at.get('competencias') or [])]
                max_nuevo = max(nuevos) if nuevos else 0
                if abs((bl['glp'] or 0) - max_viejo) < 0.02:
                    bl['glp'] = max_nuevo; best_ok += 1
                else:
                    best_omitido.append((at.get('nombre'), bl['glp'], round(max_nuevo, 2)))
    return cambios, corruptos, sin_datos, ambiguos, best_ok, best_omitido

def main():
    aplicar = '--aplicar' in sys.argv
    datos = json.load(open(RUTA, encoding='utf-8'))
    cambios, corruptos, sin_datos, ambiguos, best_ok, best_om = corregir(datos)

    print('GL Points en data.json\n')
    print(f'  corregidos (modalidad clara) ....... {len(cambios)}')
    print(f'  corregidos por valor corrupto ...... {len(corruptos)}')
    print(f'  sin tocar, modalidad ambigua ....... {ambiguos}   (RAW / EQUIPADO: no dicen si fue solo banca)')
    print(f'  sin tocar, falta bw/total/sexo ..... {sin_datos}')
    print(f'  bestLifts.glp actualizado .......... {best_ok}')
    if best_om:
        print(f'  bestLifts.glp NO tocado ............ {len(best_om)}   (no salía del máximo de sus resultados)')

    for titulo, lista in (('CORREGIDOS', cambios), ('VALORES CORRUPTOS', corruptos)):
        if not lista:
            continue
        print(f'\n── {titulo}')
        for n, m, t, bw, v, nv in lista:
            print(f'   {str(n)[:26]:26} {str(m)[:32]:32} total {t:<7} bw {bw:<7} {v:<12} → {nv}')
    if best_om:
        print('\n── bestLifts.glp que quedaron como estaban (revisar a mano)')
        for n, v, mx in best_om:
            print(f'   {str(n)[:26]:26} bestLifts {v:<12} máximo de sus resultados {mx}')

    if aplicar:
        # indent=2 como estaba: si no, el archivo pasa a una sola línea y el
        # diff se vuelve ilegible (son 60 mil líneas).
        json.dump(datos, open(RUTA, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('\ndata.json escrito.')
    else:
        print('\n(prueba — nada se escribió; usá --aplicar)')

if __name__ == '__main__':
    main()

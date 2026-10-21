#!/usr/bin/env python3
"""Agrega a data.json competencias que estaban en OpenIPF/OpenPowerlifting y no en YourLift.

Los datos salen del repositorio público de OpenPowerlifting (gitlab.com/openpowerlifting/opl-data),
que es la misma fuente que alimenta openipf.org, así que coinciden exactamente con el perfil
que ve el atleta.

Caso Felipe Pizarro Arroyo (1769FPA-2017) — openipf.org/u/felipepizarro:
  · fechipo/1701  2017-01-01  Nacional Chile                              Raw SBD 582.5  2º
  · fesupo/2101   2021-12-08  XXXV Campeonato Sudamericano                Single-ply SBD 677.5 2º
                                                                          (+ Only Bench 172.5, 1º)
  · fesupo/2305   2023-09-09  South American Powerlifting Equipped Champ. Single-ply SBD 772.5 1º
  · fesupo/2304   2023-09-09  South American Bench Press Equipped Champ.  Single-ply B 200, 1º

Cuando el atleta compitió powerlifting Y banca sola en el mismo campeonato se guarda UNA
competencia con la modalidad combinada, que es como ya lo hace FECHIPO en data.json
("Powerlifting Equipado + Only Bench Equipado IPF"): ningún atleta tiene dos competencias
con el mismo evento.

    python3 herramientas/agregar_competencias_openipf.py           # muestra qué agregaría
    python3 herramientas/agregar_competencias_openipf.py --aplicar # lo escribe
"""
import json, math, re, sys

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

def gl(total, bw, serie, sexo='M'):
    a, b, c = COEF[(serie, sexo)]
    return round(total * 100 / (a - b * math.exp(-c * bw)), 2)

def dots(total, bw, sexo='M'):
    c = ([-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706] if sexo == 'F'
         else [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093])
    den = c[0] + c[1]*bw + c[2]*bw**2 + c[3]*bw**3 + c[4]*bw**4
    return total * 500 / den

def att(*trios):
    """[(peso, 'g'|'n'), ...] -> lista de intentos como los guarda el livecast."""
    return [{"w": w, "r": r} for w, r in trios]

def comp(evento, fecha, cat, modalidad, serie, bw, sq, bp, dl, place, intentos=None,
         lugar=None, anio=None, source='openpowerlifting', opl=None, internacional=False,
         division='Open', sexo='Hombre', bw_estimado=False):
    """bw=None cuando no se sabe el peso corporal: queda sin GL ni DOTS hasta que
    se cargue. bw_estimado: el peso se dedujo de los puntos GL del tablero."""
    total = round((sq or 0) + (bp or 0) + (dl or 0), 2)
    sx = 'F' if str(sexo).lower().startswith(('muj', 'fem')) else 'M'
    res = {"bw": bw, "sq": sq, "bp": bp, "dl": dl, "total": total,
           "glp": gl(total, bw, serie, sx) if bw else None,
           "dots": dots(total, bw, sx) if bw else None}
    if bw_estimado:
        res["bwEstimado"] = True
    if intentos:
        res["intentos"] = intentos
    res.update({"categoria": cat, "division": division, "pesoCorporal": bw})
    c = {"evento": evento, "fecha": fecha}
    if anio:  c["año"] = anio
    if lugar: c["lugar"] = lugar
    c.update({"division": division, "categoria": cat, "modalidad": modalidad, "sexo": sexo,
              "resultado": res, "place": place, "source": source})
    if opl: c["opl_meet"] = opl
    if internacional: c["internacional"] = True
    return c

# ── Lo que falta, por código de atleta ────────────────────────────────────────
FALTAN = {
  '1769FPA-2017': [
    comp("II Campeonarto Nacional Classic Raw Chile 2017", "2017-01-01", "105",
         "Powerlifting Classic", "cl", 102, 200, 137.5, 245, "2",
         opl="fechipo/1701"),
    # Powerlifting y Only Bench son campeonatos aparte, con su propio título: en
    # los dos sudamericanos ganó la banca sola además de su puesto en powerlifting.
    # Van en líneas separadas, con el nombre oficial de cada uno.
    comp("XXXV Campeonato Sudamericano FESUPO 2021", "2021-12-08", "105",
         "Powerlifting Equipado IPF", "eq", 97.2, 255, 172.5, 250, "2",
         intentos={"sq": att((225,'g'), (240,'g'), (255,'g')),
                   "bp": att((145,'g'), (160,'g'), (172.5,'g')),
                   "dl": att((230,'g'), (250,'g'), (265,'n'))},
         opl="fesupo/2101", internacional=True),
    comp("XXXV Campeonato Sudamericano FESUPO 2021 (Only Bench)", "2021-12-08", "105",
         "Only Bench Equipado IPF", "beq", 97.2, None, 172.5, None, "1",
         intentos={"bp": att((145,'g'), (160,'g'), (172.5,'g'))},
         opl="fesupo/2101", internacional=True),
    comp("Campeonato Sudamericano de Powerlifting Equipado 2023", "2023-09-09",
         "105", "Powerlifting Equipado IPF", "eq", 96.8, 292.5, 200, 280, "1",
         intentos={"sq": att((270,'g'), (280,'g'), (292.5,'g')),
                   "bp": att((180,'g'), (190,'g'), (200,'g')),
                   "dl": att((255,'g'), (270,'g'), (280,'g'))},
         lugar="Lima, Perú", anio=2023, opl="fesupo/2305", internacional=True),
    comp("Campeonato Sudamericano de Bench Press Equipado 2023", "2023-09-09",
         "105", "Only Bench Equipado IPF", "beq", 96.8, None, 200, None, "1",
         intentos={"bp": att((180,'g'), (190,'g'), (200,'g'))},
         lugar="Lima, Perú", anio=2023, opl="fesupo/2304", internacional=True),
  ],
  # Mundial Classic 2026 (Druskininkai, Lituania). Los dos chilenos que fueron
  # no tenían cargado el resultado — ipf/2603 en opl-data.
  '1718SMM-2025': [
    comp("IPF World Classic Powerlifting Championships 2026", "2026-06-13", "120+",
         "Powerlifting Classic IPF", "cl", 182.7, 420, 222.5, 310, "9",
         intentos={"sq": att((365,'g'), (405,'g'), (420,'g')),
                   "bp": att((185,'g'), (205,'g'), (222.5,'g')),
                   "dl": att((265,'g'), (290,'g'), (310,'g'))},
         lugar="Druskininkai, Lituania", anio=2026, opl="ipf/2603", internacional=True),
  ],
  '1981MDZ-2025': [
    comp("IPF World Classic Powerlifting Championships 2026", "2026-06-13", "84+",
         "Powerlifting Classic IPF", "cl", 98.8, 180, 102.5, 175, "12",
         intentos={"sq": att((170,'g'), (180,'g'), (187.5,'n')),
                   "bp": att((97.5,'g'), (102.5,'g'), (105,'n')),
                   "dl": att((162.5,'g'), (175,'g'), (190,'n'))},
         lugar="Druskininkai, Lituania", anio=2026, opl="ipf/2603", internacional=True,
         sexo="Mujer"),
  ],
  # Mundial Master Classic 2026 (Reno, Estados Unidos), Master I. Sale del tablero
  # de la transmisión de Powerlifting America; los pesos de Miguel y Mauricio los
  # confirmó la federación. El de Fabiola y Nataly no se sabe todavía. El puesto de ellas es el que mostraba el tablero tras su último intento.
  '1624MMA-2024': [
    comp("IPF World Masters Classic Powerlifting Championships 2026", "2026-10-20", "105",
         "Powerlifting Classic IPF", "cl", 102.65, 297.5, 192.5, 252.5, "3",
         lugar="Reno, Estados Unidos", anio=2026, source='transmision', internacional=True,
         division='Master I'),
  ],
  '1563MHT-2024': [
    comp("IPF World Masters Classic Powerlifting Championships 2026", "2026-10-20", "105",
         "Powerlifting Classic IPF", "cl", 104.3, 212.5, 132.5, 262.5, "7",
         lugar="Reno, Estados Unidos", anio=2026, source='transmision', internacional=True,
         division='Master I'),
  ],
  '1358FAO-2023': [
    comp("IPF World Masters Classic Powerlifting Championships 2026", "2026-10-19", "57",
         "Powerlifting Classic IPF", "cl", None, 102.5, 55, 137.5, "9",
         lugar="Reno, Estados Unidos", anio=2026, source='transmision', internacional=True,
         division='Master I', sexo='Mujer'),
  ],
  '1611NMR-2025': [
    comp("IPF World Masters Classic Powerlifting Championships 2026", "2026-10-19", "63",
         "Powerlifting Classic IPF", "cl", None, 150, 67.5, 152.5, "9",
         lugar="Reno, Estados Unidos", anio=2026, source='transmision', internacional=True,
         division='Master I', sexo='Mujer'),
  ],
}

# Competencias que se reemplazan por las de arriba (cambió el nombre del evento o
# se separó powerlifting de la banca sola). Se quitan antes de agregar las nuevas.
QUITAR = {
  '1769FPA-2017': {'Campeonato Sudamericano de Powerlifting y Bench Press Equipado 2023'},
  # Un resultado de hombres -93 kg de 2017 que se le pegó por error: no es de ella.
  '1611NMR-2025': {'II Campeonarto Nacional Classic Raw Chile 2017'},
}
# Además, campos que hay que corregir en competencias que ya estaban cargadas.
CORREGIR = {
  '1769FPA-2017': {'XXXV Campeonato Sudamericano FESUPO 2021': {'modalidad': 'Powerlifting Equipado IPF'}},
}

def orden(c):
    """Clave para dejar el historial de la más nueva a la más antigua.

    Varias competencias no traen fecha (las que vienen del livecast), así que en
    ese caso se usa el año que va en el nombre del evento.
    """
    f = str(c.get('fecha') or '')
    if not f:
        anio = c.get('año') or (re.search(r'(19|20)\d{2}', c.get('evento') or '') or [''])[0]
        f = f'{anio}-00-00' if anio else ''
    return f

def main():
    aplicar = '--aplicar' in sys.argv
    datos = json.load(open(RUTA, encoding='utf-8'))
    por_cod = {a.get('codigo'): a for a in datos}

    for cod, nuevas in FALTAN.items():
        a = por_cod.get(cod)
        if not a:
            print(f'!! no está el atleta {cod}'); continue
        fuera = QUITAR.get(cod) or set()
        if fuera:
            antes = len(a.get('competencias') or [])
            a['competencias'] = [c for c in (a.get('competencias') or []) if (c.get('evento') or '') not in fuera]
            if antes != len(a['competencias']):
                print(f"  − se quita (queda reemplazada): {', '.join(sorted(fuera))}")
        for ev, campos in (CORREGIR.get(cod) or {}).items():
            for c in a.get('competencias') or []:
                if (c.get('evento') or '') == ev:
                    for k, v in campos.items():
                        if c.get(k) != v:
                            print(f"  ~ {ev}: {k} '{c.get(k)}' → '{v}'")
                            c[k] = v
        ya = {(c.get('evento') or '') for c in a.get('competencias') or []}
        agrego = [c for c in nuevas if c['evento'] not in ya]
        print(f"\n{a['nombre']} ({cod}) — tenía {len(a.get('competencias') or [])} competencias")
        for c in nuevas:
            marca = '  +' if c in agrego else '  = (ya estaba)'
            r = c['resultado']
            print(f"{marca} {c['fecha']}  {c['evento'][:52]:52} {c['modalidad'][:38]:38} "
                  f"total {r['total']:<7} GL {str(r['glp'] or '—'):<7} {c['place']}º")
        a.setdefault('competencias', []).extend(agrego)
        a['competencias'].sort(key=orden, reverse=True)

        # bestLifts = máximo sobre todas sus competencias
        bl = a.setdefault('bestLifts', {})
        for campo in ('sq', 'bp', 'dl', 'total', 'glp', 'dots'):
            vals = [(c.get('resultado') or {}).get(campo) or 0 for c in a['competencias']]
            mx = max(vals + [0])
            if mx and abs(mx - (bl.get(campo) or 0)) > 1e-9:
                print(f"     bestLifts.{campo}: {bl.get(campo)} → {mx}")
                bl[campo] = mx
        print(f"     queda con {len(a['competencias'])} competencias")

    if aplicar:
        # Mismo formato que tiene data.json (sangría de 1 y salto al final): con
        # otro, el archivo entero sale cambiado y no se ve qué se agregó.
        with open(RUTA, 'w', encoding='utf-8') as f:
            f.write(json.dumps(datos, ensure_ascii=False, indent=1) + '\n')
        print('\ndata.json escrito.')
    else:
        print('\n(prueba — no se escribió nada; usar --aplicar)')

if __name__ == '__main__':
    main()

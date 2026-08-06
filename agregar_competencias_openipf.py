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

    python3 agregar_competencias_openipf.py           # muestra qué agregaría
    python3 agregar_competencias_openipf.py --aplicar # lo escribe
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
         division='Open', sexo='Hombre'):
    total = round((sq or 0) + (bp or 0) + (dl or 0), 2)
    sx = 'F' if str(sexo).lower().startswith(('muj', 'fem')) else 'M'
    res = {"bw": bw, "sq": sq, "bp": bp, "dl": dl, "total": total,
           "glp": gl(total, bw, serie, sx), "dots": dots(total, bw, sx)}
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
    comp("XXXV Campeonato Sudamericano FESUPO 2021", "2021-12-08", "105",
         "Powerlifting Equipado + Only Bench Equipado IPF", "eq", 97.2, 255, 172.5, 250, "2",
         intentos={"sq": att((225,'g'), (240,'g'), (255,'g')),
                   "bp": att((145,'g'), (160,'g'), (172.5,'g')),
                   "dl": att((230,'g'), (250,'g'), (265,'n'))},
         opl="fesupo/2101", internacional=True),
    comp("Campeonato Sudamericano de Powerlifting y Bench Press Equipado 2023", "2023-09-09",
         "105", "Powerlifting Equipado + Only Bench Equipado IPF", "eq", 96.8, 292.5, 200, 280, "1",
         intentos={"sq": att((270,'g'), (280,'g'), (292.5,'g')),
                   "bp": att((180,'g'), (190,'g'), (200,'g')),
                   "dl": att((255,'g'), (270,'g'), (280,'g'))},
         lugar="Lima, Perú", anio=2023, opl="fesupo/2305", internacional=True),
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
        ya = {(c.get('evento') or '') for c in a.get('competencias') or []}
        agrego = [c for c in nuevas if c['evento'] not in ya]
        print(f"\n{a['nombre']} ({cod}) — tenía {len(a.get('competencias') or [])} competencias")
        for c in nuevas:
            marca = '  +' if c in agrego else '  = (ya estaba)'
            r = c['resultado']
            print(f"{marca} {c['fecha']}  {c['evento'][:52]:52} {c['modalidad'][:38]:38} "
                  f"total {r['total']:<7} GL {r['glp']:<7} {c['place']}º")
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
        json.dump(datos, open(RUTA, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('\ndata.json escrito.')
    else:
        print('\n(prueba — no se escribió nada; usar --aplicar)')

if __name__ == '__main__':
    main()

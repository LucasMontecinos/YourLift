#!/usr/bin/env python3
"""Saca los datos de YourLift a CSV, listos para Power BI.

    python3 exportar_powerbi.py            # deja los CSV en powerbi/
    python3 exportar_powerbi.py --dir X    # en otra carpeta

Por qué varios archivos y no uno grande. Power BI trabaja mejor con un modelo en
estrella: una tabla de HECHOS —acá cada marca de cada atleta en cada campeonato—
y alrededor tablas de DIMENSIONES que la describen (el atleta, el campeonato, el
calendario). Un solo archivo plano obliga a repetir el nombre y el club del
atleta en cada fila, y cualquier gráfico que agrupe por club empieza a contar mal
en cuanto alguien se cambia de club.

Los archivos y cómo se relacionan:

    atletas.csv      codigo ─┐
    resultados.csv   codigo ─┴─ atleta_codigo   (1 a muchos)
                     evento_id ─┐
    campeonatos.csv  evento_id ─┘               (1 a muchos)
                     fecha ─┐
    calendario.csv   fecha ──┘                  (1 a muchos)

    trafico_web.csv        y  trafico_regiones.csv  van aparte: no se relacionan
                              con lo deportivo, son del sitio.

Formato: UTF-8 con BOM (si no, Power BI en Windows rompe las tildes), coma como
separador, punto como decimal y fechas en AAAA-MM-DD. Al importar hay que elegir
"Origen del archivo: 65001 UTF-8" y configuración regional "Inglés (Estados
Unidos)", que es la que entiende el punto decimal.
"""
import json, csv, os, sys, io, re, unicodedata

DEST = 'powerbi'
if '--dir' in sys.argv:
    DEST = sys.argv[sys.argv.index('--dir') + 1]
os.makedirs(DEST, exist_ok=True)

def nrm(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip().lower()

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', nrm(s)).strip('_')[:60]

def escribir(nombre, columnas, filas):
    """UTF-8 con BOM: sin el BOM, Power BI en Windows lee 'García' como 'GarcÃ­a'."""
    ruta = os.path.join(DEST, nombre)
    with io.open(ruta, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=columnas, extrasaction='ignore')
        w.writeheader()
        w.writerows(filas)
    print(f'  {nombre:26} {len(filas):>6} filas')
    return len(filas)

def anio_de(fecha, anio, evento=''):
    """El año del resultado, con la misma regla que usa el panel.

    Muchos resultados no traen fecha, pero el año está en el nombre del
    campeonato ('IX Campeonato Nacional 2025'). Tomando solo la fecha se caían
    de la cuenta más de la mitad de los atletas de cada temporada, y Power BI
    mostraba números que no cuadraban con el panel."""
    if anio: return anio
    m = re.match(r'^(\d{4})', str(fecha or ''))
    if m: return int(m.group(1))
    m = re.search(r'20\d{2}', str(evento or ''))
    return int(m.group(0)) if m else None

def nac_de(f):
    """'14/09/2004' o '2004-09-14' → 2004. Los 31/12/1900 son relleno: se descartan."""
    t = str(f or '')
    m = re.search(r'(\d{4})', t)
    if not m: return None
    a = int(m.group(1))
    return a if 1920 <= a <= 2030 else None

print('Leyendo data.json…')
D = json.load(open('data.json', encoding='utf-8'))

# ── Atletas (dimensión) ───────────────────────────────────────────────────
atletas = []
for a in D:
    b = a.get('bestLifts') or {}
    # El sexo no está en el atleta: viaja en cada resultado. Se toma el primero
    # que lo traiga, que es el único lugar donde existe.
    sexo = next((c.get('sexo') for c in (a.get('competencias') or []) if c.get('sexo')), '')
    atletas.append({
        'codigo': a.get('codigo') or '',
        'nombre': a.get('nombre') or '',
        'sexo': sexo,
        'anio_nacimiento': nac_de(a.get('fechaNac')),
        'club': a.get('club') or '',
        'debut': a.get('debut') or '',
        'mejor_sentadilla': b.get('sq') or 0,
        'mejor_banca': b.get('bp') or 0,
        'mejor_peso_muerto': b.get('dl') or 0,
        'mejor_total': b.get('total') or 0,
        'mejor_gl_points': b.get('glp') or 0,
    })

# ── Resultados (hechos) y campeonatos (dimensión) ─────────────────────────
resultados, camps = [], {}
for a in D:
    cod = a.get('codigo') or ''
    for c in a.get('competencias') or []:
        ev = c.get('evento') or ''
        eid = slug(ev)
        fecha = c.get('fecha') or ''
        anio = anio_de(fecha, c.get('año'), ev)
        # Hay resultados con la fecha a medias ('2024-05', sin día). Se guarda el
        # año, que sí se sabe, y la fecha se deja vacía: si se dejara así, Power BI
        # no la encontraría en el calendario y esa fila se caería de todo gráfico
        # que filtre por tiempo, sin avisar.
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', fecha):
            fecha = ''
        r = c.get('resultado') or {}
        tiene = any(r.get(k) for k in ('sq', 'bp', 'dl', 'total'))
        resultados.append({
            'atleta_codigo': cod,
            'evento_id': eid,
            'fecha': fecha,
            'anio': anio,
            'division': c.get('division') or '',
            'categoria': c.get('categoria') or '',
            'modalidad': c.get('modalidad') or '',
            'sexo': c.get('sexo') or '',
            # Sin marcas es una inscripción sin resultado, no un cero: va vacío.
            # Un cero se promediaría y hundiría cualquier media que se calcule.
            'sentadilla': r.get('sq') if tiene else '',
            'banca': r.get('bp') if tiene else '',
            'peso_muerto': r.get('dl') if tiene else '',
            'total': r.get('total') if tiene else '',
            'peso_corporal': r.get('bw') or '',
            'gl_points': r.get('glp') or '',
            'lugar': c.get('place') or c.get('lugar') or '',
            'con_marcas': 1 if tiene else 0,
            'internacional': 1 if c.get('internacional') else 0,
            'fuente': c.get('source') or 'yourlift',
        })
        if eid and eid not in camps:
            camps[eid] = {'evento_id': eid, 'campeonato': ev, 'fecha': fecha, 'anio': anio,
                          'internacional': 1 if c.get('internacional') else 0, 'resultados': 0}
        if eid:
            camps[eid]['resultados'] += 1
            if fecha and not camps[eid]['fecha']:
                camps[eid]['fecha'] = fecha
                camps[eid]['anio'] = anio

# ── Calendario ────────────────────────────────────────────────────────────
# Power BI necesita una tabla de fechas propia para que funcionen los filtros de
# tiempo ("este año", "trimestre anterior"). Se arma con las fechas que existen.
MES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
fechas = sorted({r['fecha'] for r in resultados if re.match(r'^\d{4}-\d{2}-\d{2}$', str(r['fecha']))})
calendario = []
for f in fechas:
    y, m, d = int(f[:4]), int(f[5:7]), int(f[8:10])
    calendario.append({'fecha': f, 'anio': y, 'mes': m, 'mes_nombre': MES[m],
                       'trimestre': f'T{(m - 1) // 3 + 1}', 'dia': d,
                       'anio_mes': f'{y}-{m:02d}'})

print('\nEscribiendo CSV en ' + DEST + '/')
escribir('atletas.csv', ['codigo', 'nombre', 'sexo', 'anio_nacimiento', 'club', 'debut',
                         'mejor_sentadilla', 'mejor_banca', 'mejor_peso_muerto',
                         'mejor_total', 'mejor_gl_points'], atletas)
escribir('resultados.csv', ['atleta_codigo', 'evento_id', 'fecha', 'anio', 'division',
                            'categoria', 'modalidad', 'sexo', 'sentadilla', 'banca',
                            'peso_muerto', 'total', 'peso_corporal', 'gl_points', 'lugar',
                            'con_marcas', 'internacional', 'fuente'], resultados)
escribir('campeonatos.csv', ['evento_id', 'campeonato', 'fecha', 'anio', 'internacional',
                             'resultados'], sorted(camps.values(), key=lambda x: str(x['fecha'])))
escribir('calendario.csv', ['fecha', 'anio', 'mes', 'mes_nombre', 'trimestre', 'dia',
                            'anio_mes'], calendario)

# ── Tráfico web (Google Analytics) ────────────────────────────────────────
# Sale de la misma foto que muestra el panel. Se copia acá para que Power BI la
# tenga junto al resto; cuando se actualice la foto en admin.html hay que volver
# a correr esto.
GA = [
    {'periodo': '2026-04-28 a 2026-05-27', 'desde': '2026-04-28', 'hasta': '2026-05-27',
     'sesiones': 2592, 'usuarios': 1053, 'usuarios_nuevos': 1058, 'vistas': 6870, 'campeonatos': 1},
    {'periodo': '2026-05-28 a 2026-06-26', 'desde': '2026-05-28', 'hasta': '2026-06-26',
     'sesiones': 7051, 'usuarios': 2193, 'usuarios_nuevos': 1938, 'vistas': '', 'campeonatos': 1},
    {'periodo': '2026-06-27 a 2026-07-26', 'desde': '2026-06-27', 'hasta': '2026-07-26',
     'sesiones': 2577, 'usuarios': 729, 'usuarios_nuevos': 453, 'vistas': '', 'campeonatos': 0},
    {'periodo': '2026-07-27 a 2026-08-25', 'desde': '2026-07-27', 'hasta': '2026-08-25',
     'sesiones': 8306, 'usuarios': 2289, 'usuarios_nuevos': 1905, 'vistas': 24373, 'campeonatos': 2},
]
escribir('trafico_web.csv', ['periodo', 'desde', 'hasta', 'sesiones', 'usuarios',
                             'usuarios_nuevos', 'vistas', 'campeonatos'], GA)

REG = [('2026-04-28 a 2026-05-27', 1009, [('Santiago', 683), ('Biobio', 116), ('Valparaiso', 91), ('Antofagasta', 89)]),
       ('2026-05-28 a 2026-06-26', 2149, [('Santiago', 1306), ('Biobio', 409), ('Antofagasta', 224), ('Valparaiso', 198)]),
       ('2026-06-27 a 2026-07-26', 667,  [('Santiago', 467), ('Biobio', 122), ('Antofagasta', 79), ('Valparaiso', 71)]),
       ('2026-07-27 a 2026-08-25', 1984, [('Santiago', 1320), ('Biobio', 340), ('Antofagasta', 274), ('Valparaiso', 203)])]
regs = []
for per, cl, rs in REG:
    nombradas = sum(v for _, v in rs)
    for nom, v in rs:
        regs.append({'periodo': per, 'region': nom, 'usuarios': v, 'usuarios_chile': cl})
    # El resto del país no viene desglosado en el informe: se deja como una fila
    # propia en vez de repartirlo, que sería inventar.
    regs.append({'periodo': per, 'region': 'Otras regiones', 'usuarios': cl - nombradas,
                 'usuarios_chile': cl})
escribir('trafico_regiones.csv', ['periodo', 'region', 'usuarios', 'usuarios_chile'], regs)

print(f"""
Listo. Para cargarlo en Power BI:

  1. Inicio → Obtener datos → Texto/CSV, y abre los seis archivos.
  2. En cada uno, antes de "Cargar": Origen del archivo = 65001 UTF-8,
     y Configuración regional = Inglés (Estados Unidos). Es lo que hace que
     84.5 se lea como número y no como texto.
  3. Vista de modelo, y arrastra para crear las relaciones:
       atletas[codigo]        →  resultados[atleta_codigo]
       campeonatos[evento_id] →  resultados[evento_id]
       calendario[fecha]      →  resultados[fecha]
     Las tres son de uno a muchos, con la flecha apuntando a resultados.
  4. Marca calendario como tabla de fechas: clic derecho → Marcar como tabla de
     fechas → fecha. Sin esto los filtros de tiempo no funcionan bien.

Un primer gráfico para agarrarle la mano: de barras, campeonatos[campeonato] en
el eje y Recuento de resultados[atleta_codigo] en los valores. Sale cuántos
atletas tuvo cada campeonato.""")

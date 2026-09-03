#!/usr/bin/env python3
"""Rehace el livecast del Sudamericano a partir del CRONOGRAMA OFICIAL de FESUPO
(Schedule 2026) y de nomina_sudamericano.json.

El campeonato se corre del 20 al 27 de septiembre: son 8 días, no 9. El 19 es el
Technical Meeting, que no es jornada de competencia. Lo dice la cabecera de las
nueve nominaciones de goodlift.info —«20 – 27 September, 2026» y «The Technical
Meeting Day: 19.09.2026»— y lo confirmó la comisión técnica. La planilla de FESUPO
que teníamos ponía Special Olympics el 19 a las 16.00, o sea el mismo día del
Technical Meeting.

Ya no hay nada provisorio: FESUPO mandó la nómina final (Nominaciones_final_2026)
y de ahí salen las sesiones, con su día, su hora de pesaje, su hora de inicio y
el NÚMERO DE LOTE de cada atleta. Special Olympics va el 20 a las 16.30.

El campeonato se corre en UN SOLO livecast con todos los atletas, no en nueve
eventos separados: un link, una nómina, un acta. El cronograma no desaparece —
cada día es una TANDA (A = día 1 … I = día 9) y cada atleta lleva anotada su
sesión con fecha y hora, así que el operador cambia de tanda para cambiar de día
y el acta por jornada sigue saliendo. La nómina pública también conserva el día
de cada inscripción: eso vive en las reglas que se escriben más abajo.

Cada inscripción trae anotada su sesión (`jornada`), que viene del Excel oficial
y la escribe aplicar_nomina_oficial.py. Los Only Bench levantan en la sesión de su
compañero de categoría: el cronograma no les da una aparte.

    python3 leer_nomina_fesupo.py Nominaciones_final_2026.xlsx
    python3 aplicar_nomina_oficial.py
    python3 build_suda_dias.py
"""
import json, collections, unicodedata, re

NOM = json.load(open('nomina_sudamericano.json', encoding='utf-8'))
A = NOM['atletas']
OLD = json.load(open('nominas.json', encoding='utf-8'))

CL = {'Clásico', 'Only Bench Clásico', 'Universitario'}   # familia CLASSIC
EQ = {'Equipado', 'Only Bench Equipado'}                  # familia EQUIPPED
SO = {'Olimpiadas Especiales'}
MAS = {'Master I', 'Master II', 'Master III', 'Master IV'}
JOV = {'Sub-Junior', 'Junior', 'Universitario'}

def sel(sexo=None, cats=None, fam=None, divs=None):
    """Filtro de una sesión. Además de filtrar, se queda con la regla en forma de
    datos (`.regla`) para escribirla en nomina_sudamericano.json: así yourlift.cl
    calcula el día de cada inscripción con la MISMA regla, y si desde el panel se
    le cambia la categoría o la división a alguien, el día se recalcula solo."""
    def f(a):
        if sexo and a['sexo'] != sexo: return False
        if cats and a['cat'] not in cats: return False
        if fam and a['mod'] not in fam: return False
        if divs and a['div'] not in divs: return False
        return True
    f.regla = {k: v for k, v in (
        ('sexo', sexo),
        ('cats', sorted(cats) if cats else None),
        ('mods', sorted(fam) if fam else None),
        ('divs', sorted(divs) if divs else None),
    ) if v}
    return f

# ── Las sesiones, del cronograma FINAL de FESUPO ─────────────────────────────
#
# Antes esta era una tabla escrita a mano, y cada sesión se resolvía por REGLA
# (sexo + categoría + modalidad + división) porque no teníamos el detalle. Con la
# nómina final ya no hace falta adivinar: el Excel dice, atleta por atleta, en qué
# sesión levanta. `aplicar_nomina_oficial.py` deja eso anotado en cada inscripción
# como `jornada`, y acá se arma la sesión juntando a los que la comparten.
#
# Se nota la diferencia: por regla, Special Olympics quedaba al cierre del 27 —era
# lo único que no pisaba otra sesión— y en el cronograma real va el 20 a las 16.30.
# Los -120 y +120 de hombres eran dos sesiones el 27 y son una sola.
#
# `sel()` sigue existiendo más arriba porque el filtro por regla se usa para
# repartir a quien no tenga jornada anotada, que hoy no es nadie.
if not NOM.get('jornadas') or 'id' not in NOM['jornadas'][0]:
    raise SystemExit('Falta el cronograma oficial: corre antes aplicar_nomina_oficial.py')

CATN0 = lambda c: (float(re.sub(r'[^0-9.]', '', c) or 999)) + (0.5 if c.startswith('+') else 0)


def _nombre_sesion(j, atletas):
    """Cómo se lee la sesión: «Mujeres -43/-47/-52 Classic». Sale de quién está
    adentro, así que no puede contradecir a la lista que muestra abajo."""
    sexo = {'F': 'Mujeres', 'M': 'Hombres'}.get(j.get('sexo'), '')
    if j['campeonato'] == 'Special Olympics':
        return 'Special Olympics'
    cats = sorted({a['cat'] for a in atletas}, key=CATN0)
    fam = 'Classic' if j['campeonato'] == 'Clásico' else j['campeonato']
    # Con muchas categorías el nombre se vuelve ilegible («-47/-52/-57/-63/-69/
    # -76/-84/+84»); ahí conviene decir de dónde a dónde va.
    txt = '/'.join(cats) if len(cats) <= 3 else f'{cats[0]} a {cats[-1]}'
    return ' '.join(x for x in (sexo, txt, fam) if x)


_dia_de = {f: i + 1 for i, f in enumerate(sorted({j['fecha'] for j in NOM['jornadas']}))}
SES = []
for j in sorted(NOM['jornadas'], key=lambda x: (x['fecha'], x['inicio'])):
    m = [a for a in A if a.get('jornada') == j['id']]
    SES.append((j['fecha'], _dia_de[j['fecha']], j['pesaje'], j['inicio'],
                _nombre_sesion(j, m), (lambda i: lambda a: a.get('jornada') == i)(j['id']),
                len(m)))

# ── Conversión nómina → atleta del livecast (mismas convenciones que ya usaban
# los eventos por día: 'Powerlifting Classic', 'Subjunior', club = país…) ──
MOD = {'Clásico':'Powerlifting Classic', 'Equipado':'Powerlifting Equipado',
       'Only Bench Clásico':'Only Bench Classic', 'Only Bench Equipado':'Only Bench Equipado',
       'Olimpiadas Especiales':'Special Olympics', 'Universitario':'Powerlifting Classic'}
DIV = {'Sub-Junior':'Subjunior', 'Junior':'Junior', 'Open':'Open', 'Universitario':'Universitario',
       'Master I':'Master I', 'Master II':'Master II', 'Master III':'Master III',
       'Master IV':'Master IV', 'Special Olympics':'Special Olympics'}

def nrm(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower().strip()

# País (nombre → código) y universidad se sacan de los eventos que ya existían,
# porque la nómina guarda el nombre del país pero no el código ni la universidad.
PAIS_COD, UNIV = {}, {}
for e in OLD['events']:
    for a in e.get('athletes', []):
        if a.get('pais') and a.get('club') and not a.get('universidad'):
            PAIS_COD[nrm(a['club'])] = a['pais']
        if a.get('universidad'):
            UNIV[nrm(a['nombre'])] = a['universidad']
# Códigos que falten (ej. si un país sólo tiene universitarios)
FALLBACK = {'chile':'CHI','argentina':'ARG','brasil':'BRA','brazil':'BRA','uruguay':'URU',
            'paraguay':'PAR','peru':'PER','ecuador':'ECU','colombia':'COL','bolivia':'BOL',
            'venezuela':'VEN','guyana':'GUY','surinam':'SUR','suriname':'SUR','costa rica':'CRC',
            'panama':'PAN','mexico':'MEX'}
for k, v in FALLBACK.items(): PAIS_COD.setdefault(k, v)

SEXO = {'M':'Hombre', 'F':'Mujer'}
def to_ath(a, flight, lot, jornada):
    uni = UNIV.get(nrm(a['n']), '')
    pais = PAIS_COD.get(nrm(a['pais']), (a['pais'] or '')[:3].upper())
    return {
        # En pantalla va el nombre como se lee, "Joaquín Alfonso Tapia Inda", y no
        # como viene en la planilla de FESUPO, "Tapia Inda Joaquín Alfonso". Es lo
        # que se pidió, y además es el formato de data.json, así que el livecast
        # cruza mejor con la ficha del atleta. El nombre de planilla sigue siendo
        # la clave interna —agrupar, fusionar, buscar la universidad—; lo único
        # que cambia es lo que ve la gente.
        'nombre': a.get('nDisp') or a['n'], 'rut': '', 'sexo': SEXO.get(a['sexo'], ''), 'dob': '',
        'born': str(a['born']) if a.get('born') else '',
        'division': DIV.get(a['div'], a['div']),
        'categoria': f"{a['cat']} kg ({SEXO.get(a['sexo'],'')})",
        'modalidad': (MOD[a['mod'].replace(' + Only Bench', '')] + ' + Only Bench'
                      if a['mod'].endswith(' + Only Bench') else MOD.get(a['mod'], a['mod'])),
        'club': uni or a['pais'], 'universidad': uni, 'pais': pais,
        # EL LOTE ES EL DE FESUPO. Antes era un contador nuestro, 1, 2, 3… por
        # orden de armado, que no coincidía con el número que el atleta ve en su
        # tarjeta ni con el que se canta en el pesaje. La nómina final lo trae en
        # la columna «OR.» y es el que manda; el contador queda solo por si a
        # alguien le faltara.
        'flight': flight, 'lot': a.get('lote') or lot, 'jornada': jornada,
    }

FAM = lambda m: 'eq' if 'Equipado' in m else 'cl'
def _fusionar_pl_ob(g):
    """Junta la inscripción de Powerlifting con la de Only Bench de la misma línea.
    Devuelve la lista de inscripciones ya fusionadas (el resto queda igual)."""
    pl = [a for a in g if not a['mod'].startswith('Only Bench')]
    ob = [a for a in g if a['mod'].startswith('Only Bench')]
    if not pl or not ob: return g
    out, usados = [], set()
    for a in pl:
        par = next((b for i, b in enumerate(ob)
                    if i not in usados and FAM(b['mod']) == FAM(a['mod'])), None)
        if par is not None:
            usados.add(ob.index(par))
            a = dict(a, mod=a['mod'] + ' + Only Bench', _ob=par['lista'])
        out.append(a)
    out += [b for i, b in enumerate(ob) if i not in usados]
    return out

CATN = lambda c: (float(re.sub(r'[^0-9.]', '', c) or 999)) + (0.5 if c.startswith('+') else 0)
DIVORD = {'Sub-Junior':0,'Junior':1,'Universitario':2,'Open':3,
          'Master I':4,'Master II':5,'Master III':6,'Master IV':7,'Special Olympics':8}
FL = 'ABCDEFGHIJKL'
MAXFL = 14        # tanda IPF típica; el desglose fino se hace en el pesaje
# Las tandas todavía no están definidas (dependen del pesaje y del cupo de cada
# sesión), así que TODOS arrancan en la tanda A: es lo más cómodo para la logística
# del pesaje, donde se reparten de verdad. Pon TANDA_UNICA = None para volver a
# repartirlos automáticamente en A, B, C…
TANDA_UNICA = 'A'

dias = collections.OrderedDict()
asignado, filas = {}, []
for fecha, d, pesaje, hora, nombre, filt, esp in SES:
    m = [a for a in A if filt(a)]
    for a in m: asignado.setdefault((a['n'], a['lista']), []).append(nombre)
    dias.setdefault(d, {'fecha': fecha, 'sesiones': []})
    dias[d]['sesiones'].append({'pesaje': pesaje, 'hora': hora, 'nombre': nombre,
                                'atletas': m, 'fesupo': esp})
    filas.append((fecha, d, nombre, m, (pesaje, hora)))

# ── Chequeos antes de escribir nada ──
dup = {k: v for k, v in asignado.items() if len(v) > 1}
falta = [a for a in A if (a['n'], a['lista']) not in asignado]
assert not dup, f'inscripciones en 2 sesiones: {list(dup.items())[:5]}'
assert not falta, f'inscripciones sin sesión: {falta[:5]}'

# Cada día es una tanda del evento único: A el día 1, B el día 2, y así.
DIA_FL = 'ABCDEFGHIJKL'
ath, lot = [], 0
sesiones_todas = []
for d, info in dias.items():
    for s in info['sesiones']:
        # Orden de tanda: por categoría, después división, después nombre. Las dos
        # inscripciones de un mismo atleta (PL + Only Bench) quedan juntas para que
        # levanten en la misma tanda — es la misma persona en la tarima.
        pers = collections.OrderedDict()
        # El Powerlifting va primero y el Only Bench justo debajo: el livecast
        # espeja la fila de abajo desde la de arriba (das válido en banca en la
        # Classic y se marca solo en la Only Bench).
        OBLAST = lambda x: 1 if x['mod'].startswith('Only Bench') else 0
        for a in sorted(s['atletas'], key=lambda x: (CATN(x['cat']), DIVORD.get(x['div'], 9), nrm(x['n']), OBLAST(x))):
            pers.setdefault(nrm(a['n']), []).append(a)
        # Aunque la nómina traiga la fila Only Bench con otra división (pasa: el
        # mismo atleta figura Open en Only Bench y Master I en Classic), la fila
        # de Powerlifting va siempre arriba.
        grupos = [sorted(g, key=OBLAST) for g in pers.values()]
        # PL + Only Bench de la MISMA línea son UNA sola persona en la tarima: sube
        # una vez, tira una banca y le cuenta para los dos rankings. Se fusionan en
        # un solo atleta con modalidad combinada ("... + Only Bench"), que es lo que
        # el livecast entiende para mostrar la fila espejo debajo. Si no, el mismo
        # atleta salía dos veces y el conteo quedaba inflado.
        grupos = [_fusionar_pl_ob(g) for g in grupos]
        # Cortar la sesión en tandas PAREJAS de <=14 sin partir a una persona
        # (una sesión de 29 son tres tandas de 10, no 14+14+1).
        n = len(s['atletas'])
        k = max(1, -(-n // MAXFL))
        target = -(-n // k)
        tandas, cur = [], []
        for g in grupos:
            if cur and len(cur) + len(g) > target and len(tandas) < k - 1:
                tandas.append(cur); cur = []
            cur += g
        if cur: tandas.append(cur)
        base = len(set(x['flight'] for x in ath))
        for ti, t in enumerate(tandas):
            # LA TANDA ES LA DE FESUPO: una letra por ronda, corridas de la A a
            # la AJ de principio a fin del campeonato. Antes era una letra por
            # DÍA, que juntaba en una sola tanda las tres sesiones de una jornada
            # —sesenta y pico de atletas— y el operador no tenía cómo separarlas.
            fl = DIA_FL[d - 1]
            jor = f"D{d} {info['fecha'][8:10]}/{info['fecha'][5:7]} · {s['hora']} · {s['nombre']}"
            for a in t:
                lot += 1
                ath.append(to_ath(a, a.get('tanda') or fl, lot, jor))
    sesiones_todas += [{'dia': d, 'fecha': info['fecha'], 'pesaje': s['pesaje'],
                        'inicio': s['hora'], 'nombre': s['nombre'],
                        'atletas': len(s['atletas']),
                        'tanda': '/'.join(sorted({x.get('tanda') or DIA_FL[d - 1]
                                                  for x in s['atletas']}))}
                       for s in info['sesiones']]

primer = min(i['fecha'] for i in dias.values())
ultimo = max(i['fecha'] for i in dias.values())
events = [{
    'id': 'suda2026', 'name': 'Sudamericano 2026',
    'short': 'SUDA 2026', 'date': primer, 'closeDate': primer,
    'location': 'Estadio Nacional, Ñuñoa, Chile', 'organizer': 'FESUPO / FECHIPO',
    'days': len(dias), 'pin': '', 'extraCols': [],
    'records': 'suda',            # habilita los récords sudamericanos de FESUPO
    'sesiones': sesiones_todas,
    'resumen': f"{len(dias)} días · {primer[8:10]}/{primer[5:7]} al {ultimo[8:10]}/{ultimo[5:7]}",
    'athletes': ath,
}]

# ── Reemplazar en nominas.json (se conservan los ensayos y el resto) ──
# Se sacan tanto los nueve días viejos (suda2026_d1…d9) como el evento único de
# una corrida anterior, para que correr esto dos veces no deje duplicados.
def _reemplazable(e):
    i = str(e.get('id', ''))
    return i.startswith('suda2026_d') or i == 'suda2026'
otros = [e for e in OLD['events'] if not _reemplazable(e)]
ins = min([i for i, e in enumerate(OLD['events']) if _reemplazable(e)] or [len(otros)])
OLD['events'] = otros[:ins] + events + otros[ins:]
json.dump(OLD, open('nominas.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ── El día de competencia, dentro de la nómina ──
# En la nómina de yourlift.cl cada cabecera de categoría dice qué día compite. Se
# guarda la REGLA de cada sesión, no el día pegado a cada inscripción: si desde el
# panel le corrigen la categoría o la división a alguien, el día se recalcula solo.
# La tarjeta de la nómina en yourlift.cl enlaza al livecast con este id. Antes
# apuntaba al campeonato padre, que existía solo como agrupador de los nueve días;
# ahora apunta derecho al evento único.
NOM['eventoId'] = events[0]['id']
# Las fechas que se leen en la tarjeta de la nómina salen del cronograma, no de un
# texto escrito a mano: cuando se corrige una sesión, la fecha se corrige sola. Así
# se arrastraba el «19 al 27» de la planilla vieja después de que el 19 pasara a ser
# el Technical Meeting.
MESES = ('enero febrero marzo abril mayo junio julio agosto septiembre octubre '
         'noviembre diciembre').split()
_m = MESES[int(ultimo[5:7]) - 1]
NOM['fechas'] = (f"{int(primer[8:10])} al {int(ultimo[8:10])} de {_m} de {ultimo[:4]}"
                 if primer[5:7] == ultimo[5:7] else
                 f"{int(primer[8:10])} de {MESES[int(primer[5:7])-1]} al "
                 f"{int(ultimo[8:10])} de {_m} de {ultimo[:4]}")
# Las jornadas ya vienen del cronograma oficial (aplicar_nomina_oficial.py). Acá
# solo se les pega el nombre legible, que se arma con quién está adentro.
#
# El nombre se calcula por JORNADA y no se busca por (fecha, hora): el 20 a las
# 16.30 corren dos sesiones a la vez —el Equipado de hombres y Special Olympics—
# y con esa clave las dos se quedaban con el nombre de la última. En la página,
# la tarjeta de Special Olympics salía titulada «Hombres -59/-66/-74 Equipado».
for j in NOM['jornadas']:
    j['dia'] = _dia_de[j['fecha']]
    j['nombre'] = _nombre_sesion(j, [a for a in A if a.get('jornada') == j['id']])
json.dump(NOM, open('nomina_sudamericano.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ── Reporte ──
# Ya no hay columna «FESUPO» ni diferencia contra ella: la sesión SE ARMA con lo
# que dice el cronograma oficial, así que compararse consigo misma no dice nada.
print(f"{'fecha':11}{'D':>2}  {'pesaje':>7}{'inicio':>7}  {'sesión':42} {'total':>5} {'PL':>4} {'OB':>4}")
tot = 0
for fecha, d, nombre, m, esp in filas:
    ob = len([a for a in m if a['mod'].startswith('Only Bench')])
    tot += len(m)
    print(f"{fecha:11}{d:>2}  {esp[0]:>7}{esp[1]:>7}  {nombre:42} {len(m):>5} {len(m)-ob:>4} {ob:>4}")
print(f"\nasignados {tot} / {len(A)} inscripciones · 0 duplicados · 0 sin sesión")
e = events[0]
fl = collections.Counter(a['flight'] for a in e['athletes'])
print(f"  {e['id']} · {e['name']} · {e['date']} · {len(e['athletes'])} atletas en un solo livecast")
# Una tanda por RONDA, así que hay varias por día. Se listan en el orden en que
# se corren, que es el orden de las letras.
_ses_de = {}
for s in sesiones_todas:
    for t in str(s['tanda']).split('/'):
        _ses_de.setdefault(t, s)
for k, v in sorted(fl.items(), key=lambda x: (len(x[0]), x[0])):
    s = _ses_de.get(k)
    donde = f"día {s['dia']} ({s['fecha']}) · {s['inicio']} · {s['nombre']}" if s else '—'
    print(f"    tanda {k:>2} = {donde} · {v} atletas")

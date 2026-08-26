#!/usr/bin/env python3
"""Rehace el livecast del Sudamericano a partir del CRONOGRAMA OFICIAL de FESUPO
(Schedule 2026, 19–27 sep = 9 días) y de nomina_sudamericano.json.

El campeonato se corre en UN SOLO livecast con todos los atletas, no en nueve
eventos separados: un link, una nómina, un acta. El cronograma no desaparece —
cada día es una TANDA (A = día 1 … I = día 9) y cada atleta lleva anotada su
sesión con fecha y hora, así que el operador cambia de tanda para cambiar de día
y el acta por jornada sigue saliendo. La nómina pública también conserva el día
de cada inscripción: eso vive en las reglas que se escriben más abajo.

Cada sesión del cronograma se resuelve por REGLA (sexo + categoría + modalidad +
división), no por los números de la planilla: así los cambios de la nómina entran
solos. Los Only Bench van a la sesión de su misma categoría — el cronograma no
les da sesión propia (hay que confirmarlo con FESUPO).
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

# (fecha, día, hora pesaje, hora comp, nombre de la sesión, filtro, lifters según FESUPO)
SES = [
 ('2026-09-19',1,'14.00–15.30','16.00','Special Olympics',                          sel(fam=SO), 22),
 ('2026-09-20',2,'07.00–08.30','09.00','Mujeres -43/-47/-52 Classic',               sel('F',{'-43','-47','-52'},CL), 27),
 ('2026-09-20',2,'11.00–12.30','13.00','Mujeres -57 Classic',                       sel('F',{'-57'},CL), 22),
 ('2026-09-20',2,'14.30–16.00','16.30','Hombres -59/-66/-74 Equipado',              sel('M',{'-59','-66','-74'},EQ), 19),
 ('2026-09-21',3,'07.00–08.30','09.00','Mujeres -63 Classic',                       sel('F',{'-63'},CL), 25),
 ('2026-09-21',3,'11.00–12.30','13.00','Mujeres -76 Classic',                       sel('F',{'-76'},CL), 23),
 ('2026-09-21',3,'14.30–16.00','16.30','Hombres -83 a +120 Equipado',               sel('M',{'-83','-93','-105','-120','+120'},EQ), 24),
 ('2026-09-22',4,'08.00–09.30','10.00','Mujeres -69 Classic',                       sel('F',{'-69'},CL), 26),
 ('2026-09-22',4,'12.30–14.00','14.30','Mujeres -84/+84 Classic',                   sel('F',{'-84','+84'},CL), 28),
 ('2026-09-23',5,'07.00–08.30','09.00','Hombres -53/-59 Classic',                   sel('M',{'-53','-59'},CL), 23),
 ('2026-09-23',5,'11.00–12.30','13.00','Hombres -74 Classic (Open + Master)',       sel('M',{'-74'},CL,{'Open'}|MAS), 21),
 ('2026-09-23',5,'14.30–16.00','16.30','Hombres -74 Classic (Sjr + Jr + Univ)',     sel('M',{'-74'},CL,JOV), 27),
 ('2026-09-24',6,'08.00–09.30','10.00','Hombres -66 Classic',                       sel('M',{'-66'},CL), 28),
 ('2026-09-24',6,'12.30–14.00','14.30','Hombres -83 Classic (Sjr + Jr + Univ)',     sel('M',{'-83'},CL,JOV), 29),
 ('2026-09-25',7,'07.00–08.30','09.00','Mujeres Equipado',                          sel('F',fam=EQ), 29),
 ('2026-09-25',7,'11.00–12.30','13.00','Hombres -83 Classic (Open + Master)',       sel('M',{'-83'},CL,{'Open'}|MAS), 23),
 ('2026-09-25',7,'14.30–16.00','16.30','Hombres -93 Classic (Jr + Univ)',           sel('M',{'-93'},CL,{'Junior','Universitario'}), 19),
 ('2026-09-26',8,'08.00–09.30','10.00','Hombres -93 Classic (Sjr + Master + Open)', sel('M',{'-93'},CL,{'Sub-Junior','Open'}|MAS), 33),
 ('2026-09-26',8,'13.00–14.30','15.00','Hombres -105 Classic',                      sel('M',{'-105'},CL), 34),
 ('2026-09-27',9,'08.00–09.30','10.00','Hombres -120 Classic',                      sel('M',{'-120'},CL), 21),
 ('2026-09-27',9,'13.00–14.30','15.00','Hombres +120 Classic',                      sel('M',{'+120'},CL), 16),
]

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
        'nombre': a['n'], 'rut': '', 'sexo': SEXO.get(a['sexo'], ''), 'dob': '',
        'born': str(a['born']) if a.get('born') else '',
        'division': DIV.get(a['div'], a['div']),
        'categoria': f"{a['cat']} kg ({SEXO.get(a['sexo'],'')})",
        'modalidad': (MOD[a['mod'].replace(' + Only Bench', '')] + ' + Only Bench'
                      if a['mod'].endswith(' + Only Bench') else MOD.get(a['mod'], a['mod'])),
        'club': uni or a['pais'], 'universidad': uni, 'pais': pais,
        'flight': flight, 'lot': lot, 'jornada': jornada,
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
    filas.append((fecha, d, nombre, m, esp))

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
            fl = DIA_FL[d - 1]
            jor = f"D{d} {info['fecha'][8:10]}/{info['fecha'][5:7]} · {s['hora']} · {s['nombre']}"
            for a in t:
                lot += 1
                ath.append(to_ath(a, fl, lot, jor))
    sesiones_todas += [{'dia': d, 'fecha': info['fecha'], 'pesaje': s['pesaje'],
                        'inicio': s['hora'], 'nombre': s['nombre'],
                        'atletas': len(s['atletas']), 'tanda': DIA_FL[d - 1]}
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
NOM['jornadas'] = [{'dia': d, 'fecha': fecha, 'pesaje': pesaje, 'inicio': hora,
                    'nombre': nombre, 'regla': filt.regla}
                   for fecha, d, pesaje, hora, nombre, filt, esp in SES]
json.dump(NOM, open('nomina_sudamericano.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ── Reporte ──
print(f"{'fecha':11}{'D':>2}  {'sesión':44} {'total':>5} {'PL':>4} {'OB':>4} {'FESUPO':>7} {'Δ':>4}")
tot = 0
for fecha, d, nombre, m, esp in filas:
    ob = len([a for a in m if a['mod'].startswith('Only Bench')])
    tot += len(m)
    print(f"{fecha:11}{d:>2}  {nombre:44} {len(m):>5} {len(m)-ob:>4} {ob:>4} {esp:>7} {len(m)-ob-esp:>+4}")
print(f"\nasignados {tot} / {len(A)} inscripciones · 0 duplicados · 0 sin sesión")
e = events[0]
fl = collections.Counter(a['flight'] for a in e['athletes'])
print(f"  {e['id']} · {e['name']} · {e['date']} · {len(e['athletes'])} atletas en un solo livecast")
for k, v in sorted(fl.items()):
    dia = [s for s in sesiones_todas if s['tanda'] == k]
    print(f"    tanda {k} = día {dia[0]['dia']} ({dia[0]['fecha']}) · {v} atletas · "
          + ', '.join(s['nombre'] for s in dia))

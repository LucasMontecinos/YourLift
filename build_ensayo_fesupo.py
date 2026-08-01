#!/usr/bin/env python3
"""Arma los dos livecast de prueba que pidió FESUPO, sobre la nómina del Día 3.

  ENSAYO FESUPO Dia 3 completo    → los nueve intentos de todos, ya juzgados
  ENSAYO FESUPO Dia 3 a medio     → sentadilla lista, banca a mitad, peso muerto sin abrir

En los dos hay válidos, nulos y RÉCORDS SUDAMERICANOS de verdad: los pesos de
récord se calculan contra records_suda.json, así que se ven amarillos en el
control, en la pantalla de tarima y en el acta.

Se llaman "ENSAYO …" a propósito: el livecast reconoce ese prefijo y los deja
operar sin iniciar sesión, con el botón para cambiar entre admin y espectador.
No son públicos: no están en Competencia en Vivo, se entra por el link directo.
"""
import json, io, random, unicodedata

random.seed(20260919)                      # mismo resultado en cada corrida
NOM = json.load(open('nominas.json', encoding='utf-8'))
REC = json.load(open('records_suda.json', encoding='utf-8'))['records']
D3 = next(e for e in NOM['events'] if e.get('id') == 'suda2026_d3')

MAS = {'Master I', 'Master II', 'Master III', 'Master IV'}
def sexo_k(a): return 'F' if a['sexo'] == 'Mujer' else 'M'
def equipo_k(a):
    m = a['modalidad']
    return 'equipped' if 'Equipado' in m else 'classic'
def solo_banca(a): return a['modalidad'].startswith('Only Bench')
def cat_k(a):
    c = a['categoria'].split(' kg')[0].strip()
    return c if c[0] in '+-' else '-' + c
def divs_k(a):
    d = {'Subjunior': 'Sub-Junior'}.get(a['division'], a['division'])
    out = [d] if d in ({'Sub-Junior', 'Junior', 'Open'} | MAS) else []
    if 'Open' not in out: out.append('Open')
    return out

def record_de(a, lift):
    """Marca a superar: la más baja entre su división y el Open (0 = no hay récord)."""
    key_lift = 'bpsl' if (lift == 'bp' and solo_banca(a)) else lift
    marcas = []
    for d in divs_k(a):
        r = REC.get('|'.join([sexo_k(a), equipo_k(a), d, cat_k(a), key_lift]))
        marcas.append(r['kg'] if r else 0)
    return min(marcas) if marcas else 0

def redondea(x):
    """Peso cargable: de 2.5 en 2.5, que es el salto normal en competencia."""
    return round(x / 2.5) * 2.5

def redondea_fino(x):
    """Intento de récord: ahí sí se usan los discos chicos, de 0.5 en 0.5."""
    return round(x * 2) / 2

def peso_corporal(a):
    c = cat_k(a)
    lim = float(c.replace('+', '').replace('-', ''))
    return round(lim + random.uniform(1.5, 9) if c[0] == '+' else lim - random.uniform(0.2, 2.4), 2)

# ── Los tres intentos de un movimiento ────────────────────────────
# apertura conservadora, +5/+7.5 por intento, y un patrón de válidos/nulos que
# se parece a una competencia: casi todos abren bien y el tercero se cae seguido.
def intentos(a, lift, i, hasta=3, con_record=False):
    rec = record_de(a, lift)
    base = rec * random.uniform(0.62, 0.80) if rec else {'sq': 150, 'bp': 90, 'dl': 180}[lift]
    if con_record:
        base = rec * 0.94                                   # abre cerca y lo pasa después
    w1 = redondea(max(30, base))
    paso = redondea(max(2.5, w1 * 0.045))
    pesos = [w1, redondea(w1 + paso), redondea(w1 + 2 * paso)]
    if con_record and rec:
        idx = 1 if i % 2 == 0 else 2                       # récord en el 2º o en el 3º
        pesos[idx] = redondea_fino(rec + random.choice([0.5, 1, 1.5, 2.5, 5]))
        for j in range(idx + 1, 3):
            pesos[j] = redondea(pesos[idx] + paso)
    # resultado: 1º casi siempre válido, 2º casi siempre válido, 3º se cae seguido
    patron = [
        random.random() > 0.08,
        random.random() > 0.22,
        random.random() > 0.45,
    ]
    if con_record and rec:                                  # el de récord tiene que ser válido
        patron[idx] = True
    out = []
    for j in range(3):
        if j >= hasta:
            out.append({'w': 0, 'r': None}); continue
        out.append({'w': pesos[j], 'r': 'g' if patron[j] else 'n'})
    return out

def arma(a, i, completo):
    """Los dos ensayos quedan CON GENTE EN TARIMA: el último intento abierto tiene
    el peso declarado pero sin juzgar. Si no, la cola queda vacía y Control TX y la
    pantalla de tarima salen en blanco (es lo correcto entre atleta y atleta, pero
    para probar no sirve).
      completo → los nueve intentos cargados; falta juzgar el 3º de peso muerto
      a medio  → sentadilla lista, banca 1 juzgada y la 2 declarada, peso muerto sin abrir
    """
    at = {}
    solo = solo_banca(a)
    quiere_record = (i % 6 == 0)          # uno de cada seis va a por un récord
    for lift in ('sq', 'bp', 'dl'):
        if solo and lift != 'bp':
            at[lift] = [{'w': 0, 'r': None} for _ in range(3)]
            continue
        if completo:
            hasta, sin_juzgar = 3, (3 if lift == 'dl' else 0)
        else:
            hasta = 3 if lift == 'sq' else (2 if lift == 'bp' else 0)
            sin_juzgar = 2 if lift == 'bp' else 0
        tres = intentos(a, lift, i, hasta, quiere_record and lift in ('sq', 'bp'))
        if sin_juzgar and len(tres) >= sin_juzgar and tres[sin_juzgar - 1]['w']:
            tres[sin_juzgar - 1]['r'] = None               # declarado, todavía en tarima
        at[lift] = tres
    return at

def evento(idev, nombre, corto, completo):
    ath = []
    for i, a in enumerate(D3['athletes']):
        b = dict(a)
        b['bw'] = peso_corporal(a)
        b['att'] = arma(a, i, completo)
        b['rackSQ'] = str(random.randint(8, 16))
        b['rackBP'] = str(random.randint(2, 7))
        ath.append(b)
    return {'id': idev, 'name': nombre, 'short': corto,
            'startLift': 'dl' if completo else 'bp',      # dónde abre el control
            'startRound': 2 if completo else 1,
            'date': D3['date'], 'closeDate': D3['date'],
            'location': 'Estadio Nacional, Ñuñoa, Chile',
            'organizer': 'FESUPO — livecast de prueba',
            'days': 1, 'pin': '', 'extraCols': [], 'records': 'suda',
            'sesiones': D3.get('sesiones', []),
            'athletes': ath}

nuevos = [
    evento('suda2026_fesupo_full', 'ENSAYO FESUPO Dia 3 completo', 'FESUPO LLENO', True),
    evento('suda2026_fesupo_medio', 'ENSAYO FESUPO Dia 3 a medio', 'FESUPO MEDIO', False),
]
NOM['events'] = [e for e in NOM['events'] if e.get('id') not in {n['id'] for n in nuevos}] + nuevos
io.open('nominas.json', 'w', encoding='utf-8').write(json.dumps(NOM, ensure_ascii=False, indent=1))

# ── Reporte ───────────────────────────────────────────────────────
for ev in nuevos:
    n_int = n_ok = n_nulo = n_rec = 0
    for a in ev['athletes']:
        for lift in ('sq', 'bp', 'dl'):
            rec = record_de(a, lift)
            for x in a['att'][lift]:
                if not x['w']: continue
                n_int += 1
                if x['r'] == 'g':
                    n_ok += 1
                    if rec and x['w'] > rec: n_rec += 1
                elif x['r'] == 'n':
                    n_nulo += 1
    print(f"{ev['id']:24} {len(ev['athletes']):>3} atletas · {n_int:>4} intentos "
          f"· {n_ok} válidos · {n_nulo} nulos · {n_rec} récords sudamericanos")
    print(f"    livecast.html?evento={ev['id']}")

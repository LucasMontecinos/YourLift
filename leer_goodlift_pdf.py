#!/usr/bin/env python3
"""Lee las nominaciones oficiales de goodlift.info en PDF y arma
nomina_suda_goodlift.json.

    python3 leer_goodlift_pdf.py carpeta/con/los/pdf

Son doce PDF, uno por campeonato, los que salen del botón de PDF en la página de
cada nominación. Se leen los doce y de ahí sale el archivo contra el que se cruza
nuestra nómina (verificar_goodlift.py).

Por qué esto y no las capturas: el PDF trae el texto, no una foto del texto. Las
capturas hay que transcribirlas a mano —seiscientas filas— y ahí se cuelan
erratas que después parecen bajas de atletas. Con el PDF el archivo se rehace en
un segundo cada vez que GoodLift cambie algo.

Lo único fiero del formato es que los nombres largos se parten en varias líneas:

     2. Medina Villegas Geanmarco
    Cassiell
    2004 Peru 182.5 135.0 215.5 533.0

así que una fila no es una línea. Se juntan líneas hasta que aparece el año de
nacimiento seguido del equipo y los kilos, que es donde de verdad termina.
"""
import json, re, sys, unicodedata
from pathlib import Path

sys.modules.setdefault('cryptography', None)   # pypdf no la necesita y acá no está
from pypdf import PdfReader                    # noqa: E402

# Nombre del campeonato → modalidad. Universitario y Special Olympics son
# campeonatos propios, no una división del clásico.
MODALIDAD = [
    ('equipped bench press', 'OBEQ'),
    ('classic bench press',  'OB'),
    ('university',           'UNI'),
    ('special olympics',     'SO'),
    ('equipped',             'EQ'),
    ('classic',              'PL'),
]
PAIS = {'Brazil': 'Brasil', 'Peru': 'Perú', 'Suriname': 'Surinam'}
DIV = {'Open': 'Open', 'Subjuniors': 'Sub-Junior', 'Juniors': 'Junior',
       'Masters I': 'Master I', 'Masters II': 'Master II',
       'Masters III': 'Master III', 'Masters IV': 'Master IV'}

# " 3. Chura Gutierrez Franz Jhonatan 2000 Bolivia 150.0 90.0 190.0 430.0"
# Los suplentes llevan una "R" suelta en la línea de arriba del número, así que
# se admite y se anota.
FILA = re.compile(r'^\s*(R\s+)?(\d+)\.\s+(.+?)\s+(19\d{2}|20\d{2})\s+(.+?)\s+([\d.]+(?:\s+[\d.]+)*)\s*$')
CAT = re.compile(r'^\s*([-+]?\d+)\+?kg\s*$')
DIVISION = re.compile(r'Division «(.+?)»')
TOTAL = re.compile(r'In Total there (?:are|is)\s+(\d+)\s+Lifter')


def modalidad(titulo):
    t = titulo.lower()
    for aguja, ev in MODALIDAD:
        if aguja in t:
            return ev
    raise SystemExit(f'no sé qué modalidad es: {titulo}')


def categoria(txt):
    """"-59kg" → "-59";  "120+kg" → "+120"."""
    m = CAT.match(txt)
    if not m:
        return None
    n = m.group(1)
    return ('+' + n.lstrip('+')) if txt.strip().replace('kg', '').endswith('+') else n


COD_PAIS = {'ARG': 'Argentina', 'BRA': 'Brasil', 'BOL': 'Bolivia', 'CHI': 'Chile',
            'COL': 'Colombia', 'CRC': 'Costa Rica', 'ECU': 'Ecuador', 'GUY': 'Guyana',
            'PAR': 'Paraguay', 'PER': 'Perú', 'SUR': 'Surinam', 'URU': 'Uruguay',
            'VEN': 'Venezuela'}


PAISES = set(COD_PAIS) | set(COD_PAIS.values()) | set(PAIS)

# El PDF del universitario no dice de qué país es nadie: pone la universidad y
# nada más. La mayoría de esos atletas compiten además en la clásica o en la
# banca, y de ahí se saca el país; para los que no, está esta tabla, que sale de
# la propia página de GoodLift, donde la bandera sí se ve al lado de cada equipo.
# Una universidad no cambia de país, así que esto sirve el año que viene igual.
UNIVERSIDAD_PAIS = {
    'facuvale': 'Brasil',   # Facuvale
    'institutocolombianodeestudiossuperioresdeincolda': 'Colombia',   # Instituto Colombiano de Estudios Superiores de INCOLDA
    'institutotecnologicodebuenosaires': 'Argentina',   # Instituto Tecnologico de Buenos Aires
    'juanmisaelsarachoautonomousuniversity': 'Bolivia',   # JUAN MISAEL SARACHO AUTONOMOUS UNIVERSITY
    'peruvianuniversityofappliedsciences': 'Perú',   # Peruvian University of Applied Sciences
    'pontificiauniversidadcatolicadevalparaiso': 'Chile',   # Pontificia Universidad Catolica De Valparaiso
    'pontificiauniversidadecatolicadoriodejaneiro': 'Brasil',   # Pontificia Universidade Catolica do Rio de Janeiro
    'unicesumar': 'Brasil',   # UNICESUMAR
    'unicive': 'Brasil',   # UNICIVE
    'unisul': 'Brasil',   # UniSul
    'universidadadolfoibanez': 'Chile',   # Universidad Adolfo Ibanez
    'universidadandresbello': 'Chile',   # Universidad Andres Bello
    'universidadautonomadechile': 'Chile',   # Universidad Autonoma De Chile
    'universidadbernardoohiggins': 'Chile',   # Universidad Bernardo OHiggins
    'universidadcatolicadesantiagodeguayaquil': 'Ecuador',   # UNIVERSIDAD CATOLICA DE SANTIAGO DE GUAYAQUIL
    'universidadcatolicadelmaule': 'Chile',   # Universidad Catolica Del Maule
    'universidadcentraldelecuador': 'Ecuador',   # Universidad Central del Ecuador
    'universidaddepamplona': 'Colombia',   # Universidad de Pamplona
    'universidaddetalca': 'Chile',   # Universidad de Talca
    'universidaddiegoportales': 'Chile',   # Universidad Diego Portales
    'universidadestatalpeninsuladesantaelena': 'Ecuador',   # Universidad Estatal Peninsula de Santa Elena
    'universidadlibre': 'Colombia',   # Universidad Libre
    'universidadperuanadeciencias': 'Perú',   # UNIVERSIDAD PERUANA DE CIENCIAS
    'universidadpolitecnicasalesiana': 'Ecuador',   # Universidad Politecnica Salesiana
    'universidadtecnicademanabi': 'Ecuador',   # Universidad Tecnica de Manabi
    'universidadeanhanguera': 'Brasil',   # Universidade Anhanguera
    'universidadecruzeirodosul': 'Brasil',   # Universidade Cruzeiro do Sul
    'universidadefederaldoparana': 'Brasil',   # Universidade Federal do Parana
}


# El PDF usa ligaduras tipográficas: "Soﬁa", "Caﬁero", "Chaﬂoque" son una sola
# letra en el archivo, no dos. Sin deshacerlas, esos nombres no calzan con nada.
LIGADURAS = str.maketrans({'\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl',
                           '\ufb03': 'ffi', '\ufb04': 'ffl', '\ufb05': 'st',
                           '\ufb06': 'st'})


def _uk(s):
    t = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', t.lower())



def equipo(txt):
    """El equipo es el país. En el universitario el PDF pone la universidad y se
    come el país: la página web muestra la bandera al lado, el PDF no la lleva.
    Cuando pasa eso el país queda vacío y se resuelve después, buscando a la
    persona en las otras once listas."""
    m = re.search(r'\[([A-Z]{3})\]\s*$', txt)
    if m:
        return m.group(1), txt[:m.start()].strip()
    txt = re.sub(r'\s+', ' ', txt).strip()
    if txt in PAISES:
        return txt, ''
    return '', txt          # es una universidad


def leer(pdf):
    r = PdfReader(str(pdf))
    texto = '\n'.join((p.extract_text() or '') for p in r.pages).translate(LIGADURAS)
    lineas = [l.rstrip() for l in texto.splitlines()]
    titulo = next(l for l in lineas if l.strip()).strip()
    # El título viene partido en dos líneas cuando es largo; el que sirve es el
    # que se repite entero más abajo, después de "Generated by".
    for l in lineas:
        if 'Championships 2026' in l and 'Generated' not in l and len(l) > len(titulo):
            titulo = l.strip()
            break
    ev = modalidad(titulo)

    lifters, div, cat, buf = [], None, None, []
    declarado = None
    for l in lineas:
        if not l.strip():
            continue
        m = DIVISION.search(l)
        if m:
            div, buf = DIV.get(m.group(1).strip(), m.group(1).strip()), []
            continue
        m = TOTAL.search(l)
        if m:
            declarado = int(m.group(1))
        c = categoria(l)
        if c:
            cat, buf = c, []
            continue
        if l.lstrip().startswith('#') or 'In Division' in l or 'Generated by' in l:
            buf = []
            continue
        buf.append(l.strip())
        m = FILA.match(' '.join(buf))
        if not m:
            # Un nombre parte en dos o tres líneas, no en diez. Si el buffer se
            # pasa, es que algo no calzó: se descarta el arranque en vez de
            # arrastrar el error a todas las filas que siguen.
            if len(buf) > 6:
                buf = buf[-1:]
            continue
        buf = []
        reserva, _, nombre, born, team, _kilos = m.groups()
        pais, univ = equipo(team)
        pais = COD_PAIS.get(pais, PAIS.get(pais, pais))
        # El PDF del universitario llama «Open» a su división, porque dentro de
        # ese campeonato todos son universitarios. En nuestra nómina Universitario
        # ES la división, así que se traduce y se guarda de dónde salió.
        fila = {'div': 'Universitario' if ev == 'UNI' else div,
                'cat': cat, 'n': re.sub(r'\s+', ' ', nombre).strip(),
                'born': int(born), 'pais': pais, 'ev': ev}
        if ev == 'UNI' and div != 'Universitario':
            fila['div_goodlift'] = div
        if univ:
            fila['univ'] = univ
        if reserva:
            fila['reserva'] = True
        lifters.append(fila)
    return titulo, ev, lifters, declarado


def main():
    carpeta = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
    pdfs = sorted(carpeta.glob('*generatepdfnom*.pdf'))
    if not pdfs:
        raise SystemExit(f'no hay PDF de nominación en {carpeta}')

    todo, listas, malas = [], [], 0
    for p in pdfs:
        titulo, ev, lifters, declarado = leer(p)
        ok = declarado is None or declarado == len(lifters)
        if not ok:
            malas += 1
        print(('  ✓ ' if ok else '  ✗ ') +
              f'{len(lifters):>4} de {declarado if declarado is not None else "?":>4}  {titulo}')
        listas.append(f'{titulo} ({len(lifters)})')
        todo += lifters

    # Los universitarios quedaron sin país porque el PDF no lo trae. Casi todos
    # compiten además en la clásica o en la banca de su país, así que el país se
    # saca de ahí, buscándolos por nombre.
    def llave(n):
        t = unicodedata.normalize('NFD', n).encode('ascii', 'ignore').decode()
        return tuple(sorted(re.sub(r'[^a-z ]', '', t.lower()).split()))

    conocido = {}
    for x in todo:
        if x['pais']:
            conocido.setdefault(llave(x['n']), x['pais'])
    huerfanos = []
    for x in todo:
        if not x['pais']:
            x['pais'] = (conocido.get(llave(x['n']))
                         or UNIVERSIDAD_PAIS.get(_uk(x.get('univ', '')), ''))
            if not x['pais']:
                huerfanos.append(x)
    if huerfanos:
        print(f'\n  ⚠ {len(huerfanos)} universitario(s) sin país. No compiten en ninguna otra')
        print('    lista y su universidad no está en UNIVERSIDAD_PAIS: hay que agregarla ahí,')
        print('    mirando la bandera en la página de la nominación.')
        for x in huerfanos:
            print(f"     {x['n']:38} {x['cat']:6} {x.get('univ','')}")

    todo.sort(key=lambda x: (x['ev'], x['pais'], x['n']))
    salida = {
        '_fuente': 'goodlift.info — los doce PDF de nominación oficial, leídos con '
                   'leer_goodlift_pdf.py. No transcritos a mano.',
        '_ev_nota': 'ev: PL clásico · UNI universitario · SO Special Olympics · '
                    'EQ equipado · OB banca clásica · OBEQ banca equipada. Universitario y '
                    'Special Olympics NO son clásico: campeonato propio, nominación propia y '
                    'medallas propias.',
        '_fechas': '20 al 27 de septiembre de 2026, Santiago de Chile. '
                   'Technical Meeting: 19 de septiembre.',
        '_listas': listas,
        '_conteo': {},
        'nominaciones': todo,
    }
    from collections import Counter
    salida['_conteo'] = dict(sorted(Counter(x['pais'] for x in todo).items(),
                                    key=lambda kv: -kv[1]))
    salida['_por_modalidad'] = dict(Counter(x['ev'] for x in todo))
    with open('nomina_suda_goodlift.json', 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print(f'\n{len(todo)} nominaciones · {len(pdfs)} listas')
    print('por país:', salida['_conteo'])
    return 1 if malas else 0


if __name__ == '__main__':
    sys.exit(main())

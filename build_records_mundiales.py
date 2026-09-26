"""Récords mundiales IPF (goodlift.info) → records_mundiales.json

Lee los PDF que exporta goodlift.info ("World <División> <Men's|Women's> <Classic|Equipped>
Records") y arma la misma clave que records_suda.json:
    sexo|equipo|division|categoria|movimiento   (movimiento: sq bp dl total bpsl)
El livecast los usa solo para decir "RÉCORD MUNDIAL" en el cartel de intento de
récord: la detección sudamericana no se toca.

Las columnas se separan por la posición de cada palabra en la página, así un nombre
o un país que ocupa dos renglones no se mezcla con el de al lado.

Uso:  python3 build_records_mundiales.py archivo1.pdf archivo2.pdf …
Se pueden pasar todos juntos (hombres, mujeres, classic, equipado): cada PDF dice
en su título qué es.
"""
import json, re, sys, datetime, unicodedata
import pymupdf

DIVS = {'Sub-Juniors': 'Sub-Junior', 'Juniors': 'Junior', 'Open': 'Open',
        'Masters 1': 'Master I', 'Masters 2': 'Master II', 'Masters 3': 'Master III', 'Masters 4': 'Master IV'}
MOVS = {'SQUAT': 'sq', 'BENCH': 'bp', 'DEADLIFT': 'dl', 'TOTAL': 'total'}
FECHA = re.compile(r'^\d{2}\.\d{2}\.\d{4}$')


def leer(pdf):
    out = {}
    cols = {}
    mov = None   # la página 2 sigue con el movimiento donde quedó la 1, sin repetir el título
    for page in pymupdf.open(pdf):
        titulo = page.get_text().splitlines()[0]
        m = re.match(r"World (.+?) (Men's|Women's) (Classic|Equipped) Records", titulo)
        if not m:
            raise SystemExit('Título que no entiendo: ' + titulo)
        div = DIVS[m.group(1)]
        sx = 'M' if m.group(2) == "Men's" else 'F'
        eq = m.group(3).lower()
        # NFKC: el PDF trae ligaduras ("Sheﬃeld" con ﬃ en un solo carácter).
        words = [w[:4] + (unicodedata.normalize('NFKC', w[4]),) + w[5:] for w in page.get_text('words')]
        enc = {w[4]: w[0] for w in words if w[4] in ('name', 'nation', 'born')}
        if 'nation' in enc:
            cols = enc                      # sin encabezado: las de la página anterior

        # Renglones: palabras a la misma altura, con 3 pt de tolerancia.
        filas = {}
        for w in sorted(words, key=lambda w: w[1]):
            y = next((k for k in filas if abs(k - w[1]) <= 3), None)
            filas.setdefault(w[1] if y is None else y, []).append(w)

        # Filas de récord: las que empiezan con la categoría.
        recs = []
        for y in sorted(filas):
            if y < 60 or y > 790:           # título, encabezado y pie
                continue
            ws = sorted(filas[y], key=lambda w: w[0])
            primera = ws[0][4]
            if primera in MOVS and ws[0][0] < 52:
                # "BENCH PRESS (SINGLE LIFT)" es la banca de Only Bench, con récord
                # propio: va en 'bpsl', igual que en records_suda.json.
                mov = 'bpsl' if any('SINGLE' in w[4] for w in ws) else MOVS[primera]
                continue
            mc = re.match(r'^-?(\d+)kg$|^(\d+)\+kg$', primera)
            if mc and ws[0][0] < 80:
                cat = ('-' + mc.group(1)) if mc.group(1) else ('+' + mc.group(2))
                recs.append({'y': y, 'cat': cat, 'mov': mov, 'fila': ws[1:], 'resto': []})

        # El segundo renglón de un nombre o de un país largo puede quedar arriba o
        # abajo de su fila: va a la fila de récord más cercana en altura.
        ys = {r['y'] for r in recs}
        for y in sorted(filas):
            if y < 60 or y > 790 or y in ys or not recs:
                continue
            ws = filas[y]
            if min(w[0] for w in ws) < 52 and ws[0][4] in MOVS:
                continue
            r = min(recs, key=lambda r: abs(r['y'] - y))
            if abs(r['y'] - y) < 12:
                r['resto'] += [(y, w) for w in ws]

        for r in recs:
            # Año, peso corporal, marca y fecha van en la fila, en ese orden: la
            # marca es la que va justo antes de la fecha.
            toks = [w[4].rstrip('*') for w in r['fila']]   # * = pendiente de homologación
            toks = [t for t in toks if t]
            iF = next((i for i, t in enumerate(toks) if FECHA.match(t)), None)
            if iF is None or iF < 3 or not re.match(r'^(19|20)\d{2}$', toks[iF - 3]):
                raise SystemExit('Renglón que no entiendo (%s): %s' % (pdf, ' '.join(toks)))
            xNac = r['fila'][iF - 3][0]
            todas = [(r['y'], w) for w in r['fila']] + r['resto']
            todas.sort(key=lambda t: (t[0], t[1][0]))
            texto = lambda a, b: ' '.join(w[4] for _, w in todas if a <= w[0] < b).strip()
            k = '|'.join([sx, eq, div, r['cat'], r['mov']])
            out[k] = {'kg': float(toks[iF - 1]),
                      'quien': texto(0, cols['nation'] - 5),
                      'pais': texto(cols['nation'] - 5, xNac - 2),
                      'fecha': toks[iF],
                      'lugar': ' '.join(toks[iF + 1:])}
    return out


if __name__ == '__main__':
    recs = {}
    for f in sys.argv[1:]:
        recs.update(leer(f))
    json.dump({'_nota': 'Récords mundiales IPF. Generado por build_records_mundiales.py desde los PDF de goodlift.info — no editar a mano.',
               'fuente': 'Récords mundiales IPF (goodlift.info)',
               'generado': datetime.date.today().isoformat(),
               'clave': 'sexo|equipo|division|categoria|movimiento  (movimiento: sq bp dl total bpsl)',
               'records': dict(sorted(recs.items()))},
              open('records_mundiales.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(recs), 'récords')

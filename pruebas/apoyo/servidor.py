"""Servidor local de la batería de pruebas.

Sirve el repositorio igual que `python3 -m http.server`, con una diferencia: a
nominas.json le suma los eventos de prueba de pruebas/fixtures/eventos_ensayo.json.

Las pruebas usan esos eventos (atletas con intentos ya cargados, varios días,
dos tarimas) como datos de ejemplo. Antes vivían en el nominas.json del sitio y
aparecían en el livecast de verdad; ahora el sitio queda limpio y la batería los
sigue teniendo.

    python3 pruebas/apoyo/servidor.py 8972      (desde la raíz del repo)
"""
import http.server
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIXTURE = os.path.join(RAIZ, 'pruebas', 'fixtures', 'eventos_ensayo.json')


def nominas_con_pruebas():
    with open(os.path.join(RAIZ, 'nominas.json'), encoding='utf-8') as f:
        nom = json.load(f)
    with open(FIXTURE, encoding='utf-8') as f:
        extra = json.load(f)['events']
    ids = {e.get('id') for e in nom.get('events', [])}
    nom['events'] = nom.get('events', []) + [e for e in extra if e.get('id') not in ids]
    return json.dumps(nom, ensure_ascii=False).encode('utf-8')


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def do_GET(self):
        if self.path.split('?')[0] == '/nominas.json':
            cuerpo = nominas_con_pruebas()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(cuerpo)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(cuerpo)
            return
        super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8972
    http.server.ThreadingHTTPServer(('', puerto), Manejador).serve_forever()

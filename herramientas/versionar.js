// Pone en cada página la huella del contenido de los archivos propios que carga:
//   <script src="livecast/reglas.js?v=3f9a1c2b">
// Si un archivo cambia, cambia su huella, y el navegador lo pide de nuevo en vez
// de usar el que tenía guardado. Sin esto, después de publicar, una página nueva
// podía correr con un archivo viejo del caché (GitHub Pages deja guardar ~10 min).
//
// Correr después de cambiar cualquier .js o .css propio, antes de subir:
//   node herramientas/versionar.js
// La prueba t_versiones.js falla si alguna huella quedó atrasada.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');

const huella = rel => crypto.createHash('sha1').update(fs.readFileSync(path.join(RAIZ, rel))).digest('hex').slice(0, 8);
// src="x.js?v=…" o href="x.css?v=…" de archivos del propio sitio
const RE = /((?:src|href)=")((?!https?:|\/\/|data:)[^"?#]+\.(?:js|css))(?:\?v=[^"]*)?(")/g;

function versionar(html) {
  return html.replace(RE, (t, a, rel, z) => fs.existsSync(path.join(RAIZ, rel)) ? a + rel + '?v=' + huella(rel) + z : t);
}
function paginas() { return fs.readdirSync(RAIZ).filter(f => f.endsWith('.html')); }

if (require.main === module) {
  let n = 0;
  for (const p of paginas()) {
    const f = path.join(RAIZ, p), antes = fs.readFileSync(f, 'utf8'), despues = versionar(antes);
    if (despues !== antes) { fs.writeFileSync(f, despues); n++; console.log('actualizada', p); }
  }
  console.log(n ? n + ' página(s) con huellas nuevas' : 'todas las huellas al día');
}
module.exports = { versionar, paginas, huella };

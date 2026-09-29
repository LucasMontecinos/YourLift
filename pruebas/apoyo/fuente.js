// El código de una página tal como lo ve el navegador: el HTML más los archivos
// propios que carga con <script src> (livecast.html carga livecast/*.js), en
// ese orden. Las pruebas que revisan el código fuente leen esto en vez del
// HTML solo, así no les importa en qué archivo quedó cada función.
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');

function pagina(nombre) {
  const html = fs.readFileSync(path.join(RAIZ, nombre), 'utf8');
  const propios = [];
  // livecast/*.js (scripts normales) y admin/panel.js (el módulo armado del panel)
  const re = /<script(?: type="module")? src="((?:livecast|admin|sitio|inscripcion)\/[^"?]+)(?:\?[^"]*)?"><\/script>/g;
  let m;
  while ((m = re.exec(html))) propios.push(fs.readFileSync(path.join(RAIZ, m[1]), 'utf8'));
  return [html].concat(propios).join('\n');
}

module.exports = { pagina, livecast: () => pagina('livecast.html'), admin: () => pagina('admin.html') };

// Desde `marca` hasta la próxima declaración de nivel superior (una función,
// un window.x=, una const/let/var o un comentario que empieza en la columna 0).
// Sirve para mirar un bloque sin depender de qué viene después en el archivo:
// desde que el livecast está partido, lo que antes seguía puede estar en otro.
function trozo(src, marca) {
  const i = src.indexOf(marca);
  if (i < 0) return '';
  const resto = src.slice(i + 1);
  const m = resto.match(/\n(?:async function |function |window\.[\w$]+\s*=|const |let |var |\/\/)/);
  return src.slice(i, m ? i + 1 + m.index : src.length);
}
// El texto de una función de nivel superior, por nombre.
function funcion(src, nombre) {
  const m = src.match(new RegExp('\\n(?:async )?function ' + nombre.replace(/\$/g, '\\$') + '\\('));
  return m ? trozo(src, m[0].slice(1)) : '';
}
module.exports.trozo = trozo;
module.exports.funcion = funcion;
// Varias piezas juntas, pedidas por su comienzo ('const X=', 'function f', …).
// Para las pruebas que antes cortaban un tramo contiguo del archivo.
function piezas(src, marcas) {
  return marcas.map(m => {
    const f = m.match(/^(?:async )?function ([\w$]+)$/);
    return f ? funcion(src, f[1]) : trozo(src, m);
  }).join('\n');
}
module.exports.piezas = piezas;

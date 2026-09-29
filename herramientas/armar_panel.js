// Arma admin/panel.js, el módulo que carga admin.html, juntando las fuentes de
// admin/ (un archivo por tema).
//
// Por qué hay que armarlo: el panel es un módulo de JavaScript (import de
// Firebase, await en el nivel superior, funciones privadas del módulo). Un
// módulo no se puede partir en varios <script> como el livecast sin cambiar
// cómo funciona. Así que se edita por partes y el navegador recibe una sola
// pieza, idéntica a la de antes.
//
// Correr después de editar cualquier archivo de admin/, antes de subir:
//   node herramientas/armar_panel.js && node herramientas/versionar.js
// La prueba t_panelarmado.js falla si admin/panel.js quedó atrasado.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'admin');
// Los temas solo definen funciones: el orden entre ellos no cambia nada. Lo
// que corre al cargar (arranque.js) va al final y en su orden.
const ORDEN = ['interfaz', 'sesion', 'datos', 'atletas', 'inscripciones', 'entrenadores', 'jueces',
  'campeonatos', 'cronograma', 'nominas', 'ranking', 'estadisticas', 'resultados', 'fotos',
  'medallero', 'records', 'publicaciones', 'certificados', 'sitio', 'administradores', 'arranque'];

function armar() {
  const sobran = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && f !== 'panel.js' && !ORDEN.includes(f.slice(0, -3)));
  if (sobran.length) throw new Error('archivos de admin/ que no están en ORDEN: ' + sobran.join(', '));
  return '// GENERADO por herramientas/armar_panel.js — NO EDITAR ESTE ARCHIVO.\n' +
    '// Se edita en admin/<tema>.js y se vuelve a armar.\n' +
    ORDEN.map(k => '\n// ═══════════════════════ admin/' + k + '.js ═══════════════════════\n' +
      fs.readFileSync(path.join(DIR, k + '.js'), 'utf8')).join('');
}

if (require.main === module) {
  const nuevo = armar(), f = path.join(DIR, 'panel.js');
  const antes = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (nuevo !== antes) { fs.writeFileSync(f, nuevo); console.log('admin/panel.js armado'); }
  else console.log('admin/panel.js ya estaba al día');
}
module.exports = { armar };

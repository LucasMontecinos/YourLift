// Cada archivo propio que carga una página lleva la huella de su contenido
// (?v=…), para que el navegador no mezcle una página nueva con un archivo viejo
// de su caché. Si esta prueba falla: node herramientas/versionar.js
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_versiones.js
const fs = require('fs');
const path = require('path');
const { versionar, paginas } = require('../herramientas/versionar');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

console.log('\nLas huellas de los archivos están al día');
for (const p of paginas()) {
  const html = fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  if (versionar(html) !== html) ok(false, p + ' tiene huellas atrasadas: correr node herramientas/versionar.js');
}
ok(fallas === 0, 'todas las páginas piden la versión actual de sus archivos');
const lc = fs.readFileSync(path.join(__dirname, '..', 'livecast.html'), 'utf8');
ok((lc.match(/<script src="livecast\/[a-z_]+\.js\?v=[0-9a-f]{8}"><\/script>/g) || []).length >= 20,
   'el livecast carga sus archivos con huella');
ok(/livecast\/arranque\.js\?v=[0-9a-f]{8}"><\/script>\s*$/m.test(lc.split('<script src="livecast/arranque.js')[0] + '<script src="livecast/arranque.js' + lc.split('<script src="livecast/arranque.js')[1].split('\n')[0] + '\n')
   && lc.lastIndexOf('livecast/arranque.js') > lc.lastIndexOf('livecast/interfaz.js'),
   'y arranque.js va al final, después de todas las funciones');
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

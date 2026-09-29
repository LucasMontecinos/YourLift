// Las reglas del deporte que usan varias páginas viven una sola vez, en
// compartido/. Si alguien vuelve a copiar una en una página, esta prueba lo
// dice: dos copias terminan diciendo cosas distintas (ya pasó con el GL, que en
// una página tenía los coeficientes corridos, y con la clave de campeonato).
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_reglascomunes.js
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Todo el código del sitio, menos compartido/ y el panel armado (que es copia de admin/).
const archivos = fs.readdirSync(RAIZ).filter(f => f.endsWith('.html'))
  .concat(['livecast', 'admin'].flatMap(d => fs.readdirSync(path.join(RAIZ, d))
    .filter(f => f.endsWith('.js') && f !== 'panel.js').map(f => d + '/' + f)));
const donde = re => archivos.filter(f => re.test(fs.readFileSync(path.join(RAIZ, f), 'utf8')));
const REGLAS = [
  ['los coeficientes GL', /1199\.72839|1025\.18162|610\.32796/, 'gl.js', 'YLGL'],
  ['el orden de los días de la semana', /'miercoles',\s*'jueves'/, 'dias.js', 'YLDias'],
  ['la clave de campeonato', /campeonato\|fechipo\|torneo\|de\|del\|cd/, 'campeonatos.js', 'YLCampeonato'],
  ['el canal de un campeonato en Firestore', /\.substring\(0,\s*55\)/, 'canales.js', 'YLCanal'],
];
console.log('\nCada regla está escrita una sola vez');
for (const [que, re, arch, glob] of REGLAS) {
  const src = fs.readFileSync(path.join(RAIZ, 'compartido', arch), 'utf8');
  ok(re.test(src) && src.indexOf('window.' + glob + ' =') >= 0, que + ': en compartido/' + arch + ' (' + glob + ')');
  const copias = donde(re);
  ok(copias.length === 0, '  y en ninguna otra parte' + (copias.length ? ': también en ' + copias.join(', ') : ''));
}
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

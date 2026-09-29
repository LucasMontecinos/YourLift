// admin/panel.js es el módulo que carga el panel y se arma juntando las fuentes
// de admin/. Si alguien edita una fuente y no vuelve a armar, el panel publicado
// no tendría el cambio. Si esta prueba falla: node herramientas/armar_panel.js
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_panelarmado.js
const fs = require('fs');
const path = require('path');
const { armar } = require('../herramientas/armar_panel');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };
const panel = fs.readFileSync(path.join(__dirname, '..', 'admin', 'panel.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
console.log('\nEl panel publicado es el que dicen las fuentes');
ok(panel === armar(), 'admin/panel.js está al día con admin/*.js');
ok(/^\/\/ GENERADO/.test(panel), 'y avisa que no se edita a mano');
ok(/<script type="module" src="admin\/panel\.js\?v=[0-9a-f]{8}"><\/script>/.test(html),
   'admin.html lo carga como módulo, con su huella');
ok(!/<script type="module">/.test(html), 'y ya no tiene el módulo escrito adentro');
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

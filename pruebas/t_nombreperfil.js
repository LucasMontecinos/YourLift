// El nombre en la pantalla de perfil (Control TX).
//
// La pantalla parte el nombre en dos: los nombres de pila arriba y los apellidos
// en grande. Con tres palabras o más eso funciona —"Juan Pérez González" da
// "Juan" + "Pérez González"—, pero con DOS el corte de dos apellidos daba vacío
// y el respaldo repetía la primera palabra: "Ojeda Emilse" salía al aire como
// "OJEDA OJEDA EMILSE".
//
// No es un caso raro: la nómina de FESUPO viene casi entera en formato
// "Apellido Nombre", o sea dos palabras. Habría salido así todo el Sudamericano.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_nombreperfil.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const CASOS = [
  ['Ojeda Emilse', 'OJEDA EMILSE', 'dos palabras: no se repite ninguna'],
  ['Diaz Kassandra', 'DIAZ KASSANDRA', 'dos palabras, otra atleta'],
  ['Juan Pérez González', 'JUAN PÉREZ GONZÁLEZ', 'tres palabras: nombre + dos apellidos'],
  ['María José Soto Ríos', 'MARÍA JOSÉ SOTO RÍOS', 'cuatro palabras'],
  ['Prince', 'PRINCE', 'una sola palabra'],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=suda2026_fesupo_full&tx=profile`,
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length,
    null, { timeout: 30000 });

  const r = await p.evaluate(casos => casos.map(([nombre, esperado]) => {
    const a = DATA.athletes[0];
    a.name = nombre;
    DATA.flight = a.flight; DATA.forcedCurrent = a.id;
    const html = renderTxProfile(a);
    // El nombre va en el cartel dorado de arriba; se lee del texto plano.
    const d = document.createElement('div'); d.innerHTML = html;
    const txt = (d.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    return { nombre, esperado, sale: txt.includes(esperado), repetido: new RegExp('\\b' + esperado.split(' ')[0] + '\\b[\\s\\S]{0,3}\\b' + esperado.split(' ')[0] + '\\b').test(txt) };
  }), CASOS);

  r.forEach((x, i) => {
    ok(x.sale && !x.repetido, CASOS[i][2] + ' — "' + x.nombre + '" → ' + x.esperado
      + (x.repetido ? ' (SE REPITE)' : '') + (x.sale ? '' : ' (NO APARECE)'));
  });
  ok(!errs.length, 'sin errores de página' + (errs.length ? ' — ' + errs[0] : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

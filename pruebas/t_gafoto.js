// La foto de Google Analytics en Tráfico web del admin.
//
// El contador propio (analytics_daily) empezó a correr después que el sitio, así
// que le faltan los primeros meses. Lo que sí los tiene es Google Analytics, pero
// no hay conexión con su API: los números se copiaron a mano de los informes.
//
// Eso obliga a dos cosas. Una, que la pantalla diga con todas sus letras hasta
// cuándo llega la foto y que no se actualiza sola — si alguien la lee como dato
// vivo, va a llevar números viejos a una reunión. Y dos, que la foto se vea
// aunque el contador propio esté vacío, porque justamente cubre el período que
// el contador no midió.
//
// Lo que se cuida:
//   · que los totales sean la suma de los períodos y no un número suelto;
//   · que se declare la fecha de la foto y que es a mano;
//   · que se vea con el contador vacío;
//   · que los períodos sin dato muestren un guión en vez de un cero, que mentiría;
//   · y que esto viva solo en el admin, no en el sitio público.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_gafoto.js
const fs = require('fs');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

function sacar(texto, nombre) {
  const i = texto.search(new RegExp('(?:^|\\n)function ' + nombre + '\\('));
  if (i < 0) throw new Error('no encontré ' + nombre);
  const start = texto.lastIndexOf('\n', i + 1) + 1;
  let p = start, open = 0, abrio = false;
  while (p < texto.length) {
    const c = texto[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    p++;
  }
  return texto.slice(start, p);
}

// Monta GA_FOTO y renderGAFoto() con un esc() de mentira.
const bloque = adm.slice(adm.indexOf('const GA_FOTO={'), adm.indexOf('async function loadWebAnalytics()'));
const esc = s => String(s == null ? '' : s);
// El bloque declara GA_FOTO y renderGAFoto con const/function: se evalúa y se
// devuelven, en vez de declararlos también acá y chocar.
// eslint-disable-next-line no-eval
const { GA_FOTO, renderGAFoto } = eval('(function(){' + bloque + ';return {GA_FOTO,renderGAFoto}})()');

console.log('\nLos totales salen de los períodos, no de un número suelto');
{
  const ses = GA_FOTO.periodos.reduce((s, x) => s + x.ses, 0);
  const nue = GA_FOTO.periodos.reduce((s, x) => s + x.nue, 0);
  ok(GA_FOTO.periodos.length === 4, 'están los cuatro períodos medidos');
  ok(ses === 20526, 'las sesiones suman 20.526 (' + ses + ')');
  ok(nue === 5354, 'las personas distintas suman 5.354 (' + nue + ')');
  const h = renderGAFoto();
  ok(h.indexOf(ses.toLocaleString('es-CL')) >= 0, 'y el total que se muestra es esa suma');
  ok(h.indexOf(nue.toLocaleString('es-CL')) >= 0, 'lo mismo con las personas');
}

console.log('\n  Se declara que es una foto y hasta cuándo llega');
{
  const h = renderGAFoto();
  ok(/Foto tomada el/.test(h), 'dice cuándo se tomó');
  ok(/No se actualiza sola/.test(h), 'y que no se actualiza sola');
  ok(h.indexOf(GA_FOTO.hasta) >= 0, 'dice hasta qué fecha llega: ' + GA_FOTO.hasta);
  ok(h.indexOf(GA_FOTO.desde) >= 0, 'y desde cuándo');
  ok(/GOOGLE ANALYTICS/.test(h), 'y de dónde salió el dato');
}

console.log('\n  Un período sin dato muestra un guión, no un cero');
{
  const h = renderGAFoto();
  const sinVistas = GA_FOTO.periodos.filter(x => !x.vis).length;
  ok(sinVistas === 2, 'hay dos períodos sin vistas cargadas');
  ok((h.match(/>—</g) || []).length >= sinVistas, 'y se muestran con guión');
  ok(/vistas de junio y julio no están/.test(h), 'y se explica que falta sacarlas');
}

console.log('\n  Lo que se afirma, se afirma con el dato al lado');
{
  const h = renderGAFoto();
  ok(new RegExp(String(GA_FOTO.peak.ses) + ' sesiones en una sola jornada').test(h),
     'el peak de un día va con su número');
  ok(h.indexOf(GA_FOTO.peak.evento) >= 0, 'y con el campeonato que lo causó');
  ok(/publicidad pagada en Instagram/.test(h), 'la publicidad pagada se declara');
  ok(h.indexOf(String(GA_FOTO.igPagado)) >= 0, 'con cuántas sesiones fueron');
}

console.log('\n  Se ve aunque el contador propio esté vacío');
{
  const cuerpo = sacar(adm, 'renderWebAnalytics');
  const primerReturn = cuerpo.slice(0, cuerpo.indexOf('\n', cuerpo.indexOf('if(!days.length)')));
  ok(/renderGAFoto\(\)/.test(primerReturn),
     'sin datos propios igual se muestra la foto — es el período que el contador no midió');
  ok((cuerpo.match(/renderGAFoto\(\)/g) || []).length === 2,
     'y también cuando sí hay datos');
}

console.log('\n  Es solo del admin');
{
  ok(!/GA_FOTO/.test(idx), 'el sitio público no la trae');
  ok(!/renderGAFoto/.test(idx), 'ni la función que la dibuja');
  const i = adm.indexOf('function renderGAFoto');
  const j = adm.indexOf('function loadWebAnalytics');
  ok(i > 0 && j > 0, 'vive junto al resto de Tráfico web, que ya es del panel');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

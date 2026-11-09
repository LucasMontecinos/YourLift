// Hoja de pesaje con categoría y división; revisión de equipo con calcetas SQ/BP y DL.
//
// La mesa pidió que la hoja de pesaje diga la categoría y la división de edad de
// cada atleta (no venían), y que en la revisión de equipo las calcetas se revisen
// aparte para peso muerto: "Calcetas SQ/BP" y "Calcetas DL".
// Se genera el PDF de verdad (jsPDF local) y se lee el texto que quedó adentro.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_hojapesaje.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  await ctx.route('**/jspdf.umd.min.js', r => r.fulfill({ path: __dirname + '/apoyo/jspdf.umd.min.js', contentType: 'application/javascript' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => { errs.push('aviso: ' + d.message()); d.accept().catch(() => {}); });
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof generateHojaPesaje === 'function', null, { timeout: 25000 });

  // El texto de cada PDF que se "descarga".
  const generar = fn => p.evaluate(async f => {
    const n9 = () => ({ sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
    const mk = (i, n, cat, div) => ({ id: i, lot: 100 + i, name: n, flight: 'A', sex: 'Hombre', cat, div, mod: 'classic', bw: 0, club: 'Club', att: n9() });
    DATA.event = { id: 'x', name: 'Prueba' };
    DATA.athletes = [mk(1, 'Atleta Superpesado Prueba', '120+', 'Open'), mk(2, 'Atleta Subjunior Prueba', '66', 'Sub-Junior'),
      mk(3, 'Atleta Master Prueba', '83', 'Master I'), mk(4, 'Atleta Junior Prueba', '76', 'Junior')];
    if (!window.jspdf) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    let texto = '';
    const guardar = window.jspdf.jsPDF.API.save;
    window.jspdf.jsPDF.API.save = function () { texto = this.output(); };
    try { await window[f](); } finally { window.jspdf.jsPDF.API.save = guardar; }
    return texto;
  }, fn);
  const tiene = (txt, s) => txt.indexOf('(' + s + ')') >= 0;

  console.log('\nHoja de pesaje');
  const hp = await generar('generateHojaPesaje');
  ok(hp.length > 0, 'se genera');
  ok(tiene(hp, 'Cat.') && tiene(hp, 'Div.'), 'tiene las columnas Cat. y Div.');
  ok(tiene(hp, '+120kg') && tiene(hp, '-66kg') && tiene(hp, '-83kg'), 'con la categoría de cada uno (+120kg, -66kg, -83kg)');
  ok(tiene(hp, 'OPEN') && tiene(hp, 'SUB-JR') && tiene(hp, 'M1') && tiene(hp, 'JR'), 'y su división de edad (OPEN, SUB-JR, M1, JR)');

  console.log('\nRevisión de equipo');
  const re = await generar('generateHojaEquipo');
  ok(tiene(re, 'Calcetas SQ/BP') && tiene(re, 'Calcetas DL'), 'tiene Calcetas SQ/BP y Calcetas DL');
  ok(!tiene(re, 'Calcetas'), 'y ya no la columna única "Calcetas"');

  console.log('\nRestaurar lotes sigue leyendo la hoja nueva');
  const lotes = await p.evaluate(() => _lotesParse('A 102 Atleta Subjunior Prueba -66kg SUB-JR\nA 101 Atleta Superpesado Prueba +120kg OPEN'));
  ok(lotes.length === 2 && lotes[0].nombre === 'Atleta Subjunior Prueba' && lotes[1].nombre === 'Atleta Superpesado Prueba',
    'saca el lote y el nombre, sin la categoría ni la división: ' + JSON.stringify(lotes));

  ok(errs.length === 0, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

// Resultados recién publicados: el ranking y el perfil no se quedan con una copia vieja.
//
// Los dos guardan en el navegador lo que leen de competition_results (30 y 10
// minutos). Quien abrió la página MIENTRAS el livecast publicaba el cierre se
// quedaba con la mitad: en el Regional Sur Austral faltó Vicente González
// Vivanco, de los últimos en subir. Ahora el cierre escribe la hora en
// publico/resultados_version y, si es posterior a la copia, la copia se descarta.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_resversion.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const res = (cod, nombre, total) => ({ id: 'regional_sur_x_' + cod + '_meet', evento: 'Regional Sur Prueba', evento_id: 'regional_sur_x', fecha: '2026-11-08',
  codigo: cod, nombre, club: 'Club', sexo: 'Masculino', division: 'Open', categoria: '120+', modalidad: 'Powerlifting Classic', view: 'meet',
  anioNac: '2001', resultado: { bw: 149, sq: 260, bp: 145, dl: 230, total, glp: 67.5, status: 'OK' }, source: 'yourlift_livecast' });
const A = res('9001AAA-2026', 'Atleta Primero Prueba', 600);
const B = res('9002BBB-2026', 'Atleta Ultimo Prueba', 635);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const src = { cierre: fs.readFileSync(__dirname + '/../livecast/cierre.js', 'utf8'), atletas: fs.readFileSync(__dirname + '/../admin/atletas.js', 'utf8') };

  // marca: la hora de la última publicación (null = no responde)
  async function abrir(pagina, marca, copia) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await montarFirebase(ctx, {});
    await ctx.addInitScript(([d, c, pag]) => {
      window.__FAKE = { competition_results: d };
      if (c) {
        if (pag === 'ranking') localStorage.setItem('_rkCR3', JSON.stringify({ ts: c.ts, d: c.d }));
        else localStorage.setItem('_yfc_atl_res2', JSON.stringify({ ts: c.ts, d: c.d }));
      }
    }, [[A, B], copia, pagina]);
    await ctx.route('**/documents/publico/resultados_version**', r => marca === null
      ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fields: { ts: { integerValue: String(marca) } } }) }));
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    return { ctx, p, errs };
  }
  const ahora = Date.now();
  const copiaVieja = { ts: ahora - 60000, d: [A] };     // guardada a media publicación: falta B

  console.log('\nRanking');
  {
    const { ctx, p, errs } = await abrir('ranking', ahora - 1000, copiaVieja);
    await p.goto('http://localhost:8972/ranking.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof D !== 'undefined' && D.some(e => /Ultimo Prueba/.test(e.n)), null, { timeout: 15000 }).catch(() => {});
    const r = await p.evaluate(() => ({ b: D.some(e => /Ultimo Prueba/.test(e.n) && e.tt === 635), lec: (window.__LEC || []).filter(l => l.col === 'competition_results').length }));
    ok(r.b, 'con un cierre posterior a la copia, aparece el que faltaba');
    ok(r.lec === 1, 'y para eso vuelve a leer los resultados (' + r.lec + ' lectura)');
    ok(errs.length === 0, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  {
    const { ctx, p } = await abrir('ranking', ahora - 120000, copiaVieja);
    await p.goto('http://localhost:8972/ranking.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);
    const n = await p.evaluate(() => (window.__LEC || []).filter(l => l.col === 'competition_results').length);
    ok(n === 0, 'si nada se publicó después de la copia, se usa la copia y no se lee nada');
    await ctx.close();
  }
  {
    const { ctx, p } = await abrir('ranking', null, copiaVieja);
    await p.goto('http://localhost:8972/ranking.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);
    const r = await p.evaluate(() => ({ a: D.some(e => /Primero Prueba/.test(e.n)), est: window._rkResultados }));
    ok(r.a && r.est === 'ok', 'sin poder consultar la marca, sigue funcionando con la copia');
    await ctx.close();
  }

  console.log('\nPerfil');
  {
    const { ctx, p, errs } = await abrir('perfil', ahora - 1000, copiaVieja);
    await p.goto('http://localhost:8972/atleta.html?codigo=9002BBB-2026', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window._DB_LISTA, null, { timeout: 30000 }).catch(() => {});
    await p.waitForFunction(() => /Regional Sur Prueba/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    ok(/Regional Sur Prueba/.test(await p.evaluate(() => document.body.innerText)), 'la ficha del que faltaba muestra su resultado');
    ok(errs.length === 0, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  console.log('\nQuién escribe la marca');
  ok(/setDoc\(fb\.doc\(fbDB,'publico','resultados_version'\),\{ts:Date\.now\(\)/.test(src.cierre), 'el cierre del livecast, al terminar de publicar');
  ok((src.atletas.match(/await _resVersion\(\);/g) || []).length === 4, 'y el panel, al agregar, borrar o corregir un resultado');

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

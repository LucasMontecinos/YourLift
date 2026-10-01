// Resultados publicados dos veces por un cierre repetido.
//
// El cierre del Sudamericano se corrió dos veces. La primera publicó a los
// universitarios como "Powerlifting Classic" ({evento}_{código}_meet); la
// segunda, ya corregida, como "Classic Universitario" (…_meet_uni), sin borrar
// la primera. Francisco Javier Pérez Tapia salía con el Sudamericano dos veces,
// con los mismos números. Si existe la versión _uni, la vieja no cuenta.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cierredoble.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const base = { evento: 'Sudamericano 2026', evento_id: 'suda2026', codigo: '2260FPT-2025', nombre: 'Francisco Javier Perez Tapia',
  club: 'Universidad Bernardo OHiggins', sexo: 'Hombre', division: 'Universitario', categoria: '-83 kg (Hombre)', anioNac: '2005',
  view: 'meet', posicion: '1', source: 'yourlift_livecast',
  resultado: { sq: '250', bp: '150', dl: '295', total: '695', bw: 82.7, glp: 96.38, status: 'OK' } };
const DOCS = [
  Object.assign({}, base, { id: 'suda2026_2260FPT-2025_meet', modalidad: 'Powerlifting Classic', fecha: '2026-09-25' }),
  Object.assign({}, base, { id: 'suda2026_2260FPT-2025_meet_uni', modalidad: 'Powerlifting Classic Universitario', fecha: '2026-09-29' }),
  // Banca y powerlifting en el mismo campeonato: son dos resultados de verdad.
  Object.assign({}, base, { id: 'suda2026_2260FPT-2025_bench', modalidad: 'Only Bench Classic', view: 'bench', fecha: '2026-09-25',
    resultado: { sq: 0, bp: 152.5, dl: 0, total: 152.5, bw: 82.7, glp: 80, status: 'OK' } }),
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 1400 }, serviceWorkers: 'block' });
  await montarFirebase(ctx);
  await ctx.addInitScript(d => { window.__FAKE = { competition_results: d, athlete_edits: [] }; try { localStorage.clear(); } catch (e) {} }, DOCS);
  const errs = [];

  console.log('\nFicha del atleta');
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/atleta.html?codigo=2260FPT-2025`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /HISTORIAL/i.test(document.body.innerText) && /Sudamericano/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  const hist = await p.evaluate(() => (document.body.innerText.match(/HISTORIAL[\s\S]*/i) || [''])[0]);
  const veces = (hist.match(/Sudamericano 2026/g) || []).length;
  ok(veces === 2, 'el Sudamericano sale una vez en powerlifting y otra en banca, no tres (' + veces + ')');
  ok(/Classic Universitario/.test(hist), 'queda el universitario, que es el bueno');

  console.log('\nRanking');
  const r = await ctx.newPage(); r.on('pageerror', e => errs.push(e.message));
  await r.goto(`http://localhost:${PUERTO}/ranking.html`, { waitUntil: 'domcontentloaded' });
  await r.waitForFunction(() => typeof D !== 'undefined' && D.some(e => e._live), null, { timeout: 20000 }).catch(() => {});
  const filas = await r.evaluate(() => D.filter(e => e._live && /Perez Tapia/.test(e.n) && e.tab.indexOf('bench') < 0).map(e => e.tab));
  ok(filas.length === 1, 'una sola entrada de powerlifting: ' + filas.join(', '));

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

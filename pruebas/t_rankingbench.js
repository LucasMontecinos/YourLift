// Ranking de Bench: el total es la banca.
//
// Se reportó así: en Bench Classic, el overall ordenaba con el total de Classic.
// Quien hace powerlifting y banca en el mismo campeonato trae en su resultado de
// banca el total de los tres movimientos (y el GL de powerlifting), y el ranking
// lo tomaba tal cual.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_rankingbench.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const res = (id, nombre, modalidad, r) => ({ id, nombre, club: 'Club Prueba', sexo: 'Hombre', categoria: '83', division: 'Open',
  modalidad, evento: 'Regional de Prueba 2026', fecha: '2026-11-08', resultado: r });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  await montarFirebase(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.__FAKE = { competition_results: d, athlete_edits: [] }; }, [
    // Hizo powerlifting y banca: su resultado de banca trae el total de los tres.
    res('a1', 'Atleta Combinado Prueba', 'Only Bench Classic', { bw: 82.5, sq: 250, bp: 170, dl: 300, total: 720, glp: 101.4 }),
    // Solo banca.
    res('a2', 'Atleta Banca Prueba', 'Only Bench Classic', { bw: 82, bp: 180, total: 180 }),
  ]);
  await p.goto(`http://localhost:${PUERTO}/ranking.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof D !== 'undefined' && D.some(e => e._live), null, { timeout: 20000 }).catch(() => {});
  const v = await p.evaluate(() => D.filter(e => e._live).map(e => ({ n: e.n, tab: e.tab, tt: e.tt, bp: e.bp, dt: e.dt })));
  const comb = v.find(x => /Combinado/.test(x.n)), solo = v.find(x => /Banca Prueba/.test(x.n));

  console.log('\nEn la pestaña Bench, el total es la banca');
  ok(comb && comb.tab === 'bench_cl_m', 'el que hizo powerlifting y banca cae en Bench Classic: ' + (comb && comb.tab));
  ok(comb && comb.tt === 170, 'con total 170 (su banca), no 720 (su total de powerlifting): ' + (comb && comb.tt));
  ok(comb && comb.dt > 0 && comb.dt < 101, 'y su GL es el de banca, no el de powerlifting: ' + (comb && comb.dt && comb.dt.toFixed(1)));
  ok(solo && solo.tt === 180, 'el que hizo solo banca sigue igual: ' + (solo && solo.tt));

  console.log('\nEl overall de Bench los ordena por banca');
  await p.evaluate(() => { setTab('bench_cl_m'); setVista('ov'); });
  const orden = await p.evaluate(() => [...document.querySelectorAll('.rt tbody tr')].map(tr => tr.querySelector('strong').textContent));
  const iC = orden.indexOf('Atleta Combinado Prueba'), iS = orden.indexOf('Atleta Banca Prueba');
  ok(iS >= 0 && iC > iS, 'el de 180 kg de banca va antes que el de 170 kg: ' + iS + ' < ' + iC);
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

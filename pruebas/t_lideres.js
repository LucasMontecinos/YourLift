// Portada → Líderes del ranking: el mismo ranking que la página Ranking.
//
// La tabla que trae ranking.html es la base; la página le suma al abrirse los
// resultados del año que están en data.json (los internacionales). La portada
// leía solo la tabla y ponía a Sergio Mardones con 860 del Nacional, cuando su
// marca del año es 952,5 del Mundial. Se revisa con el data.json real:
//   · Sergio sale con 952,5 y el GL de esa marca;
//   · cada líder de la portada está, con el mismo total, en la tabla que arma
//     la página Ranking (la portada no inventa ni se queda atrás);
//   · en Bench, quien hizo powerlifting y banca entra con su banca, no con su
//     total de tres movimientos.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_lideres.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack || e)); try { await b.close(); } catch (x) {} process.exit(1); });
  const abrir = async url => {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.addInitScript(() => { window.__FAKE = { eventos: [] }; try { localStorage.setItem('yl_cookies', 'no'); } catch (e) {} });
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    return p;
  };

  console.log('\nLíderes de la portada');
  const p = await abrir('index.html');
  await p.waitForFunction(() => window._LID && _LID.lista && _LID.lista.length, null, { timeout: 30000 });
  const L = await p.evaluate(() => _LID.lista.map(e => ({ tab: e.tab, c: e.c, n: e.n, tt: e.tt, dt: e.dt, sq: e.sq, bp: e.bp, dl: e.dl })));
  const sergio = L.find(e => e.tab === 'cl_m' && e.c === '120+');
  ok(sergio && /Sergio Hernan Mardones/.test(sergio.n) && sergio.tt === 952.5, 'Classic masculino 120+: Sergio Mardones con 952,5 del Mundial (no 860 del Nacional): ' + JSON.stringify(sergio));
  ok(sergio && sergio.sq === 420 && sergio.bp === 222.5 && sergio.dl === 310 && Math.abs(sergio.dt - 94.38) < 0.2, 'con sus tres movimientos y el GL de esa marca');
  const bancas = L.filter(e => e.tab.indexOf('bench') === 0);
  ok(bancas.length && bancas.every(e => e.tt === e.bp && e.sq === 0 && e.dl === 0), 'en Bench cuenta la banca, no el total de tres movimientos');
  await p.evaluate(() => { const i = _LID.lista.findIndex(e => e.tab === 'cl_m' && e.c === '120+'); _lideresIr(i); });
  const txt = await p.evaluate(() => (document.getElementById('ylLideres') || {}).innerText || '');
  ok(/Sergio Hernan Mardones Meza/i.test(txt) && /952\.5/.test(txt), 'y así se ve en la portada');
  ok(!p.errs.length, 'sin errores' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));

  console.log('\nLo mismo que la página Ranking');
  const r = await abrir('ranking.html');
  await r.waitForFunction(() => typeof D !== 'undefined' && D.some(e => /Sergio Hernan Mardones/.test(e.n) && e.tt === 952.5), null, { timeout: 30000 }).catch(() => {});
  const filas = await r.evaluate(() => D.filter(e => !e._baja).map(e => e.tab + '|' + e.c + '|' + e.tt));
  const set = new Set(filas);
  const faltan = L.filter(e => !set.has(e.tab + '|' + e.c + '|' + e.tt));
  ok(!faltan.length, 'cada líder de la portada está con ese total en el ranking' + (faltan.length ? ': ' + JSON.stringify(faltan) : ''));
  // Y nadie del ranking (Open) le gana al líder que muestra la portada.
  const mejores = await r.evaluate(() => {
    const m = {};
    D.forEach(e => { if (e._baja || !(e.tt > 0) || e.d !== 'Open') return; const k = e.tab + '|' + e.c; if (!m[k] || e.tt > m[k]) m[k] = e.tt; });
    return m;
  });
  const atrasados = L.filter(e => (mejores[e.tab + '|' + e.c] || 0) > e.tt);
  ok(!atrasados.length, 'ningún líder de la portada quedó atrás del ranking' + (atrasados.length ? ': ' + JSON.stringify(atrasados) : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

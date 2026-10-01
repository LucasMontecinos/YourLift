// Ranking: filtro por categoría de peso, en "Por categoría" y en "Overall · GL".
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_rankingpeso.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await montarFirebase(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__FAKE = { competition_results: [], athlete_edits: [] }; });
  await p.goto(`http://localhost:${PUERTO}/ranking.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('#pesos .pz').length > 2, null, { timeout: 20000 }).catch(() => {});

  // (Antes de tocar nada: la tabla del Overall es ancha por sí misma.)
  const ancho = await p.evaluate(() => { const f = document.getElementById('pesos');
    return document.documentElement.scrollWidth <= window.innerWidth + 1 && f.scrollWidth > f.clientWidth; });
  const info = await p.evaluate(() => {
    const cats = [...document.querySelectorAll('#pesos .pz')].map(b => b.textContent);
    const c83 = [...document.querySelectorAll('#pesos .pz')].find(b => b.textContent === '83 kg');
    if (c83) c83.click();
    const heads = [...document.querySelectorAll('#ct .ch span:first-child')].map(s => s.textContent);
    return { cats, heads, act: (document.querySelector('#pesos .pz.act') || {}).textContent };
  });
  console.log('\nLos botones salen de las categorías de la pestaña');
  ok(info.cats[0] === 'Todas' && info.cats.includes('83 kg'), 'Todas, y las categorías: ' + info.cats.slice(0, 6).join(', ') + '…');
  const nums = info.cats.slice(1).map(c => parseFloat(c));
  ok(nums.every((n, i) => i === 0 || n >= nums[i - 1]), 'ordenadas de menor a mayor');

  ok(ancho, 'en el teléfono la fila se desliza sola, sin correr la página hacia el lado');

  console.log('\nPor categoría: solo quedan las tablas de esa categoría');
  ok(info.act === '83 kg', 'el botón queda marcado');
  ok(info.heads.length > 0 && info.heads.every(h => /^83 kg/.test(h)), 'todas las tablas son de 83 kg: ' + info.heads.join(' | '));

  console.log('\nOverall: el mismo filtro');
  const ov = await p.evaluate(() => {
    setVista('ov');
    const cats = [...document.querySelectorAll('#ct .rt tbody tr td.cat:nth-of-type(3)')].map(td => td.textContent);
    return { cats, head: (document.querySelector('#ct .ch span') || {}).textContent, filas: document.querySelectorAll('#ct .rt tbody tr').length };
  });
  ok(ov.filas > 0 && ov.cats.every(c => c === '83'), 'solo atletas de 83 (' + ov.filas + ')');
  ok(/83 kg/.test(ov.head), 'y el título lo dice: ' + ov.head);

  console.log('\n"Todas" vuelve a mostrar todo, y cambiar de pestaña no deja un filtro que no existe');
  const tod = await p.evaluate(() => {
    setPeso('');
    const n = document.querySelectorAll('#ct .rt tbody tr').length;
    setPeso('120+'); setTab('cl_f');
    return { n, peso: PESO };
  });
  ok(tod.n > ov.filas, 'Todas: ' + tod.n + ' atletas');
  ok(tod.peso === '', 'en Classic Femenino no hay 120+, vuelve a Todas');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

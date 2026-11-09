// Atletas & Pesaje se ve siempre por número de lote, de menor a mayor, cada vez
// que se entra. Los botones "Ordenar por…" cambian solo la vista mientras se
// está ahí (no reordenan la nómina ni la guardan) y al volver a entrar, otra vez
// por lote.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_manorden.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length, null, { timeout: 20000 });
  await p.waitForTimeout(1200);

  // Seis atletas en desorden: lotes salteados, tandas y categorías cruzadas.
  await p.evaluate(() => {
    isAdmin = true;
    const n9 = () => ({ sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
    const datos = [[7, 'B', '59'], [2, 'A', '105'], [11, 'B', '74'], [1, 'A', '83'], [5, 'A', '66'], [9, 'B', '120']];
    DATA.athletes = datos.map(([lot, fl, cat], i) => ({ id: 100 + i, name: 'Atleta ' + lot, lot, flight: fl, sex: 'Hombre', cat, div: 'Open', mod: 'classic', bw: 0, club: 'Club', bombed: false, att: n9() }));
    window._MAN_F = { q: '', flight: '' };
    window.__guardados = 0; const s0 = window.save; window.save = function () { window.__guardados++; return s0.apply(this, arguments); };
  });
  const lotes = () => p.evaluate(() => [...document.querySelectorAll('input[onchange^="setLot("]')].map(i => +i.value));
  const ordenOriginal = await p.evaluate(() => DATA.athletes.map(a => a.id).join());

  console.log('\nAl entrar a Atletas & Pesaje');
  await p.evaluate(() => go('manage'));
  let l = await lotes();
  ok(l.join() === '1,2,5,7,9,11', 'sale por lote, de menor a mayor (' + l.join(' ') + ')');
  ok(await p.evaluate(() => { const e = document.querySelector('button[onclick="sortByLot()"]'); return !!e && e.getAttribute('aria-pressed') === 'true' && /●/.test(e.textContent); }), 'y el botón de Lote se ve marcado');

  console.log('\nLos otros botones cambian solo la vista');
  await p.evaluate(() => { window.__guardados = 0; });
  await p.evaluate(() => sortByFlight());
  l = await lotes();
  ok(l.join() === '5,1,2,7,11,9', 'por tanda: A primero (por categoría) y después B (' + l.join(' ') + ')');
  await p.evaluate(() => sortByCat());
  l = await lotes();
  ok(l.join() === '7,5,11,1,2,9', 'por categoría (' + l.join(' ') + ')');
  ok(await p.evaluate(() => window.__guardados) === 0, 'ordenar no guarda ni reescribe la nómina');
  ok(await p.evaluate(() => DATA.athletes.map(a => a.id).join()) === ordenOriginal, 'el orden de la nómina queda igual');

  console.log('\nAl salir y volver a entrar');
  await p.evaluate(() => go('docs'));
  await p.evaluate(() => go('manage'));
  l = await lotes();
  ok(l.join() === '1,2,5,7,9,11', 'otra vez por lote (' + l.join(' ') + ')');

  console.log('\nSi se cambia un lote, la fila se acomoda');
  await p.evaluate(() => { setLot(103, 8); });   // el del lote 1 pasa al 8
  await p.waitForTimeout(200);
  l = await lotes();
  ok(l.join() === '2,5,7,8,9,11', 'sigue ordenado por lote (' + l.join(' ') + ')');

  console.log('\nCon una búsqueda también');
  await p.evaluate(() => { window._MAN_F = { q: '', flight: 'B' }; R(); });
  l = await lotes();
  ok(l.join() === '7,9,11', 'solo la tanda B, por lote (' + l.join(' ') + ')');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

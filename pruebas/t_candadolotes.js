// Candado de lotes: los lotes sorteados quedan guardados y la mesa los defiende.
//
// En el Regional Sur Austral los lotes se perdieron (una recarga rearmó la
// nómina desde las inscripciones y una mezcla con el servidor los movió) y hubo
// que restaurarlos desde la hoja impresa. Ahora, al sortear, los lotes quedan en
// publico/lotes__{evento}; si a un atleta le cambia el lote sin que nadie lo haya
// cambiado a mano, vuelve solo a su número. Un cambio a mano sí se respeta.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_candadolotes.js
const { chromium } = require('playwright');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_sur_2026', name: 'Regional Sur Prueba 2026', canal: 'Regional_Sur_Prueba_2026' };
const datos = () => ({
  eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
  inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
  admins: [{ id: 'u', role: 'admin' }],
});
const atletas = () => [1, 2, 3, 4, 5, 6].map(i => ({ id: i, lot: i, name: 'Atleta Numero ' + ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'][i - 1], codigo: 'C' + i,
  flight: i <= 3 ? 'A' : 'B', sex: 'Hombre', cat: '83', div: 'Open', mod: 'classic', bw: 80, club: 'Club',
  att: { sq: [{ w: 100, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const red = crearRed({ subida: [100, 300], bajada: [100, 300] });
  red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas()),
    flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: false, forcedCurrent: null, timer: 60, timerOn: false, writer: 'semilla' });
  const errs = [];
  async function abrir(nombre, semilla) {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
    if (semilla) await ctx.route('**/cronogramas/lotes_' + EV.id + '.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(semilla) }));
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    await red.montar(ctx, p, { nombre, auth: true, datos: datos() });
    await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=${EV.id}&controller=1`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 6, null, { timeout: 25000 });
    await p.evaluate(() => { window.confirm = () => true; DATA.phase = 'manage'; R(); });
    return p;
  }
  const lotes = p => p.evaluate(() => DATA.athletes.slice().sort((a, b) => a.id - b.id).map(a => a.lot).join(','));
  const candado = () => red.leer('publico/lotes__' + EV.id);

  const mesa = await abrir('mesa');
  await red.calma(2000);

  console.log('\nSortear guarda los lotes');
  await mesa.evaluate(() => generateLots());
  await red.calma(3000);
  const sorteados = await lotes(mesa);
  const c1 = candado();
  ok(!!c1 && c1.lotes.length === 6, 'quedan guardados en el servidor (' + (c1 ? c1.lotes.length : 0) + ' atletas)');
  ok(c1 && c1.lotes.every(x => x.tanda === 'A' ? x.lote >= 100 && x.lote < 200 : x.lote >= 200 && x.lote < 300), 'con su tanda: A en los 100, B en los 200 (' + sorteados + ')');

  console.log('\nSe pierden (como una recarga que rearma la nómina)');
  await mesa.evaluate(() => { DATA.athletes.forEach((a, j) => { a.lot = j + 1; }); R(); });
  ok(await lotes(mesa) === '1,2,3,4,5,6', 'la mesa queda con 1, 2, 3…');
  await mesa.waitForFunction(s => DATA.athletes.slice().sort((a, b) => a.id - b.id).map(a => a.lot).join(',') === s, sorteados, { timeout: 15000 }).catch(() => {});
  ok(await lotes(mesa) === sorteados, 'a los segundos vuelven solos a los sorteados (' + await lotes(mesa) + ')');
  await red.calma(3000);
  const srv = JSON.parse(red.leer('livecast_sync/' + EV.canal).athletes).sort((a, b) => a.id - b.id).map(a => a.lot).join(',');
  ok(srv === sorteados, 'y el servidor (el público) también: ' + srv);

  console.log('\nUn cambio a mano se respeta');
  const libre = await mesa.evaluate(() => { const a = DATA.athletes.find(x => x.id === 1); return a.lot; });
  const otro = await mesa.evaluate(() => DATA.athletes.find(x => x.id === 2).lot);
  await mesa.evaluate(([o]) => setLot(1, o), [otro]);        // intercambia con el 2
  await red.calma(9000);
  const tras = await mesa.evaluate(() => [DATA.athletes.find(x => x.id === 1).lot, DATA.athletes.find(x => x.id === 2).lot]);
  ok(tras[0] === otro && tras[1] === libre, 'el intercambio queda (' + tras.join(' / ') + ')');
  const c2 = candado();
  ok(c2.lotes.find(x => x.codigo === 'C1').lote === otro, 'y el candado lo anota');

  console.log('\nOtra mesa que abre después toma el candado');
  const mesa2 = await abrir('mesa2');
  await mesa2.evaluate(() => { DATA.athletes.forEach((a, j) => { a.lot = 50 + j; }); R(); });
  await mesa2.waitForFunction(() => DATA.athletes.every(a => a.lot >= 100), null, { timeout: 15000 }).catch(() => {});
  ok(await lotes(mesa2) === await lotes(mesa), 'y defiende los mismos lotes (' + await lotes(mesa2) + ')');

  console.log('\nSin candado en el servidor, se usa el respaldo del repositorio');
  red.escribir('publico/lotes__' + EV.id, null);
  const semilla = { evento: EV.id, guardado: new Date().toISOString(), lotes: [1, 2, 3, 4, 5, 6].map(i => ({ codigo: 'C' + i, nombre: '', lote: (i <= 3 ? 100 : 200) + (i % 3), tanda: i <= 3 ? 'A' : 'B' })) };
  const ctxOk = typeof red.borrar === 'function';
  if (ctxOk) red.borrar('publico/lotes__' + EV.id);
  const mesa3 = await abrir('mesa3', semilla);
  await mesa3.waitForFunction(() => window._lotesFijos && /respaldo/.test(window._lotesFijos.motivo || ''), null, { timeout: 15000 }).catch(() => {});
  const m3 = await mesa3.evaluate(() => (window._lotesFijos || {}).motivo || '');
  ok(!ctxOk || /respaldo/.test(m3), 'la mesa toma el respaldo guardado' + (ctxOk ? '' : ' (la red falsa no borra: se omite)'));

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

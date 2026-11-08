// Cambiar de tanda a un atleta en el livecast lo anota también en el Cronograma.
//
// El livecast toma las tandas del Cronograma y las vuelve a aplicar cada vez que
// ese documento cambia; al revés no iba nada. En el Regional Sur Austral se pasó
// a un atleta a la tanda E en el livecast y el Cronograma (admin y público)
// siguió con la vieja — y la siguiente edición del Cronograma se la devolvía.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_tandacrono.js
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
const NOMBRES = ['Luis Alberto Alarcon Ramirez', 'Pedro Soto Rojas', 'Ana Perez Diaz', 'Juan Munoz Vera'];
const atletas = () => NOMBRES.map((n, k) => ({ id: k, lot: 600 + k, name: n, flight: 'F', sex: 'Hombre', cat: '83',
  div: 'Open', mod: 'classic', bw: 80, club: 'Club',
  att: { sq: [{ w: 100, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }));
// En el Cronograma el nombre viene con tilde y sin el segundo nombre: igual tiene que encontrarlo.
const filas = () => [
  { nombre: 'Luis Alarcón Ramírez', flight: 'F', categoria: '-83', division: 'Open', modalidad: 'Classic' },
  { nombre: 'Pedro Soto Rojas', flight: 'F', categoria: '-83', division: 'Open', modalidad: 'Classic' },
  { nombre: 'Ana Perez Diaz', flight: 'F', categoria: '-83', division: 'Open', modalidad: 'Classic' },
  { nombre: 'Juan Munoz Vera', flight: 'F', categoria: '-83', division: 'Open', modalidad: 'Classic' },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const red = crearRed({ subida: [100, 300], bajada: [100, 300] });
  red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas()),
    flight: 'F', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: true, forcedCurrent: null,
    timer: 60, timerOn: false, writer: 'semilla' });
  red.sembrar('cronograma/' + EV.id, { rows: filas() });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  const mesa = await ctx.newPage();
  mesa.on('pageerror', e => errs.push(e.message));
  mesa.on('dialog', d => d.accept().catch(() => {}));
  await red.montar(ctx, mesa, { nombre: 'mesa', auth: true, datos: datos() });
  await mesa.goto(`http://localhost:${PUERTO}/livecast.html?evento=${EV.id}&controller=1`, { waitUntil: 'domcontentloaded' });
  await mesa.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 4, null, { timeout: 25000 });
  await red.calma(1500);

  console.log('\nLa mesa pasa a Luis Alarcón de la tanda F a la E');
  await mesa.evaluate(() => { DATA.phase = 'manage'; R(); const a = DATA.athletes.find(x => /Alarcon/.test(x.name)); updA(a.id, 'flight', 'E'); R(); });
  await red.calma(2500);
  const cr = red.leer('cronograma/' + EV.id);
  const fila = cr.rows.find(r => /Alarc/.test(r.nombre));
  ok(fila && fila.flight === 'E', 'el Cronograma queda con Luis en la tanda E (' + (fila && fila.flight) + ')');
  ok(cr.rows.filter(r => r.flight === 'F').length === 3, 'los demás siguen en la F');
  ok(fila && fila.categoria === '-83' && fila.division === 'Open', 'y el resto de su fila no se toca');

  console.log('\nUna edición posterior del Cronograma ya no se la devuelve');
  const r2 = filas(); r2[0].flight = 'E'; r2[3].flight = 'G';   // el admin mueve a otro
  red.escribir('cronograma/' + EV.id, { rows: r2 }, true);
  await red.calma(2500);
  const fl = await mesa.evaluate(() => DATA.athletes.map(a => a.flight).join(''));
  ok(fl === 'EFFG', 'en el livecast Luis sigue en la E y el otro pasa a la G (' + fl + ')');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

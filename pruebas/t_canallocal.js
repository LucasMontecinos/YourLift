// Pantallas de tarima en el MISMO computador que la mesa: los cambios llegan al
// instante, sin esperar a Firestore.
//
// La mesa avisa cada cambio por un canal del navegador (BroadcastChannel) y las
// pantallas del mismo computador lo aplican de una. Firestore sigue siendo la
// fuente de verdad y llega después. Para probar que es el canal y no la red, a
// las pantallas del mismo computador se les CORTA la red: lo que ven, lo vieron
// por el canal. Una tarima en otro computador, también sin red, no tiene que
// enterarse (ahí no hay canal).
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_canallocal.js
const { chromium } = require('playwright');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026',
  canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };
const datos = () => ({
  eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
  inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
  admins: [{ id: 'u', role: 'admin' }],
});
const atletas = () => [1, 2, 3, 4].map(i => ({ id: i, lot: 100 + i, name: 'Atleta ' + i, flight: 'A', sex: 'Hombre', cat: '83',
  div: 'Open', mod: 'classic', bw: 80, club: 'Club',
  att: { sq: [{ w: 100 + i * 5, r: null }, { w: 0, r: null }, { w: 0, r: null }],
         bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  // Red lenta a propósito: Firestore tarda 1,5 a 2,5 s en subir lo de la mesa.
  const red = crearRed({ subida: [1500, 2500], bajada: [300, 800] });
  red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas()),
    flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: true, forcedCurrent: null,
    timer: 60, timerOn: false, writer: 'semilla' });
  const errs = [];
  async function abrir(ctx, nombre, url, auth) {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    await red.montar(ctx, p, { nombre, auth, datos: datos() });
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 4, null, { timeout: 25000 });
    return p;
  }
  const pc1 = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  const mesa = await abrir(pc1, 'mesa', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const tarima = await abrir(pc1, 'tarima', 'livecast.html?tx=screen&evento=' + EV.id, false);
  const jornada = await abrir(pc1, 'jornada', 'livecast.html?tx=jornada&evento=' + EV.id, false);
  const obs = await abrir(pc1, 'obs', 'livecast.html?tx=director&evento=' + EV.id, false);
  const pc2 = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  const lejos = await abrir(pc2, 'lejos', 'livecast.html?tx=screen&evento=' + EV.id, false);
  await mesa.evaluate(() => { window.confirm = () => true; DATA.phase = 'compete'; R(); });
  await red.calma(3000);
  const MISMO = { tarima, jornada, obs };
  // Sin red las pantallas: lo único que les puede llegar es el canal local.
  for (const n of ['tarima', 'jornada', 'obs', 'lejos']) red.cortar(n, true);

  // Cuánto tarda cada pantalla en ver lo que se pide (fn corre en la página).
  async function esperar(p, fn, arg, ms) {
    const t0 = Date.now();
    try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 20 }); return Date.now() - t0; }
    catch (e) { return null; }
  }
  // Se mide desde que la MESA tiene el cambio: lo que tarda en llegarle a ella
  // (por ejemplo, desde el teléfono del jurado) es la red, no el canal.
  async function caso(titulo, accion, fn, arg) {
    console.log('\n' + titulo);
    await accion();
    const tm = await esperar(mesa, fn, arg, 5000);
    ok(tm !== null, 'la mesa lo tiene');
    const t0 = Date.now();
    const llegadas = await Promise.all(Object.values(MISMO).map(p => esperar(p, fn, arg, 1500).then(t => t === null ? null : Date.now() - t0)));
    Object.keys(MISMO).forEach((n, i) => {
      const t = llegadas[i];
      ok(t !== null && t < 300, n + ' lo ve al instante, sin red (' + (t === null ? 'no llegó' : t + ' ms después que la mesa') + ')');
    });
    const lj = await esperar(lejos, fn, arg, 600);
    ok(lj === null, 'la tarima de OTRO computador, sin red, no se entera (no hay canal entre computadores)');
  }
  const casilla = ([id, l, r, campo, v]) => { const a = DATA.athletes.find(x => x.id === id); return !!a && a.att[l][r][campo] === v; };

  await caso('La mesa en Control en Vivo marca válido', () => mesa.evaluate(() => overrideResult(1, 'sq', 0, 'g')), casilla, [1, 'sq', 0, 'r', 'g']);
  await caso('La mesa en Atletas y Pesaje cambia una apertura', () => mesa.evaluate(() => {
    DATA.phase = 'manage'; R(); const a = DATA.athletes.find(x => x.id === 3); a.att.sq[0].w = 190; _markAtt(3, 'att_sq_0'); saveNow(); R();
  }), casilla, [3, 'sq', 0, 'w', 190]);
  await caso('La mesa en Control TX: el jurado, desde su teléfono, revierte a nulo', async () => {
    await mesa.evaluate(() => { DATA.phase = 'director'; R(); });
    red.escribir('judge_decisions/' + await mesa.evaluate(() => juezDocId()), { jurado: { ts: Date.now(), res: 'n', card: 'red', id: 1, lift: 'sq', round: 0, name: 'Atleta 1' } }, true);
  }, casilla, [1, 'sq', 0, 'r', 'n']);

  console.log('\nCuando vuelve la red, el otro computador queda igual');
  for (const n of ['tarima', 'jornada', 'obs', 'lejos']) red.cortar(n, false);
  await red.calma(6000);
  const l1 = await lejos.evaluate(() => { const a = DATA.athletes.find(x => x.id === 1); const c = DATA.athletes.find(x => x.id === 3); return a.att.sq[0].r + '/' + c.att.sq[0].w; });
  ok(l1 === 'n/190', 'la tarima del otro computador lo recibe por Firestore: ' + l1);

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

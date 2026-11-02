// Todo en un computador, o repartido en varios: la tarima y Control TX siguen
// la competencia aunque la mesa no esté en la pestaña Control en Vivo.
//
// Se reportó: "si me salgo de Control en Vivo no se actualiza la pantalla de
// tarima ni Control TX / control remoto, cuando estoy todo en un PC". Lo que
// dependía de esa pestaña eran las órdenes que llegan de los teléfonos —el
// reloj de la Planilla y del juez central, la decisión del jurado— y el aviso
// al panel de jueces. Esta prueba abre de verdad la mesa, la pantalla de tarima
// y Control TX en el MISMO navegador (un computador), y un segundo computador,
// conectados por el Firestore falso con demoras de red (apoyo/firebase_red.js).
// Y revisa que con varios equipos cada orden de reloj se cumpla UNA vez.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_unpc.js
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
// El 4 ya levantó su primera sentadilla (válida): es la que revierte el jurado.
const atletas = () => [1, 2, 3, 4].map(i => ({ id: i, lot: 100 + i, name: 'Atleta ' + i, flight: 'A', sex: 'Hombre', cat: '83',
  div: 'Open', mod: 'classic', bw: 80, club: 'Club',
  att: { sq: [{ w: 100 + i * 5, r: i === 4 ? 'g' : null, t: i === 4 ? 1000 : undefined }, { w: 0, r: null }, { w: 0, r: null }],
         bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const red = crearRed({ subida: [150, 500], bajada: [80, 500] });
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
  // Computador 1: la mesa, la pantalla de tarima y Control TX, en el mismo navegador.
  const pc1 = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  const mesa = await abrir(pc1, 'mesa', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const tarima = await abrir(pc1, 'tarima', 'livecast.html?tx=screen&evento=' + EV.id, false);
  const ctrlTx = await abrir(pc1, 'ctrlTx', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  // Computador 2: otra mesa.
  const pc2 = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  const mesa2 = await abrir(pc2, 'mesa2', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const ADMIN = { mesa, ctrlTx, mesa2 };
  const TODAS = { mesa, tarima, ctrlTx, mesa2 };
  // Todos arrancan FUERA de Control en Vivo: es lo que pasa al recargar la
  // página estando en Control TX (la pestaña queda guardada). Así la mesa nunca
  // pasó por Control en Vivo desde que se abrió.
  for (const [n, p] of Object.entries(ADMIN)) await p.evaluate(fase => {
    window.confirm = () => true; window.prompt = () => null;
    // Cuántas veces cumple cada equipo una orden de reloj.
    window.__ordenes = 0; const o = _ordenReloj; _ordenReloj = function (d) { window.__ordenes++; return o.apply(this, arguments); };
    DATA.phase = fase; R();
  }, n === 'mesa' ? 'manage' : 'director');
  await red.calma(2500);
  const juez = await mesa.evaluate(() => juezDocId());
  const fase = (p, f) => p.evaluate(f => { DATA.phase = f; R(); }, f);
  const casilla = async (id, l, r) => {
    const out = {};
    for (const [n, p] of Object.entries(TODAS)) out[n] = await p.evaluate(([id, l, r]) => { const a = DATA.athletes.find(x => x.id === id); const at = a && a.att[l][r]; return at ? (at.r || '·') : '?'; }, [id, l, r]);
    return out;
  };
  const iguales = (c, v) => Object.values(c).every(x => x === v);
  const ordenes = async () => { let n = 0; for (const p of Object.values(ADMIN)) n += await p.evaluate(() => window.__ordenes); return n; };
  const cero = async () => { for (const p of Object.values(ADMIN)) await p.evaluate(() => { window.__ordenes = 0; }); };
  const relojes = async () => { const out = {}; for (const [n, p] of Object.entries(TODAS)) out[n] = await p.evaluate(() => ({ on: !!DATA.timerOn, vis: !!DATA.relojVisible, t0: DATA.timerStartedAt || 0 })); return out; };

  console.log('\nUn computador: la mesa en Atletas y Pesaje, nadie en Control en Vivo');
  {
    // El que está en barra sube su apertura: pasa a ser otro el que levanta.
    await mesa.evaluate(() => { const a = DATA.athletes.find(x => x.id === 1); a.att.sq[0].w = 200; _markAtt(1, 'att_sq_0'); saveNow(); R(); });
    await red.calma(3000);
    const enBarra0 = await tarima.evaluate(() => (liftQueue()[0] || {}).name || '');
    const panel0 = red.leer('judge_decisions/' + juez) || {};
    ok(enBarra0 === 'Atleta 2', 'la tarima pasa al siguiente: ' + enBarra0);
    ok(panel0.athlete_name === enBarra0 && panel0.athlete_weight === 110, 'y el panel de jueces también: ' + panel0.athlete_name + ' · ' + panel0.athlete_weight + ' kg');
    red.escribir('judge_decisions/' + juez, { jurado: { ts: Date.now(), res: 'n', card: 'red', id: 4, lift: 'sq', round: 0, name: 'Atleta 4' } }, true);
    await red.calma(3500);
    const c0 = await casilla(4, 'sq', 0);
    ok(iguales(c0, 'n'), 'el jurado revierte el válido y lo muestran la tarima y Control TX: ' + JSON.stringify(c0));
    red.escribir('timer_control/' + juez, { action: 'start', ts: Date.now(), by: 'planilla' });
    await red.calma(3500);
    const r0 = await relojes();
    ok(r0.tarima.vis && r0.tarima.on, 'el INICIAR de la Planilla prende el reloj en la tarima: ' + JSON.stringify(r0.tarima));
    const n0 = await ordenes();
    ok(n0 === 1, 'y lo cumple un solo equipo (' + n0 + ')');
    red.escribir('timer_control/' + juez, { action: 'hide', ts: Date.now(), by: 'planilla' });
    await red.calma(2500);
    await cero();
  }

  console.log('\nUn computador: la mesa marca en Control en Vivo');
  await fase(mesa, 'compete');
  await red.calma(1000);
  await mesa.evaluate(() => overrideResult(1, 'sq', 0, 'g'));
  await red.calma(2500);
  let c = await casilla(1, 'sq', 0);
  ok(iguales(c, 'g'), 'el válido llega a la tarima y a Control TX: ' + JSON.stringify(c));

  console.log('\nUn computador: la mesa se va a Control TX y nadie queda en Control en Vivo');
  await fase(mesa, 'director');
  await red.calma(1500);
  red.escribir('judge_decisions/' + juez, { jurado: { ts: Date.now(), res: 'n', card: 'red', id: 1, lift: 'sq', round: 0, name: 'Atleta 1' } }, true);
  await red.calma(3500);
  c = await casilla(1, 'sq', 0);
  ok(iguales(c, 'n'), 'el jurado revierte a nulo y lo muestran la tarima y Control TX: ' + JSON.stringify(c));
  await cero();
  red.escribir('timer_control/' + juez, { action: 'start', ts: Date.now(), by: 'planilla' });
  await red.calma(3500);
  let rl = await relojes();
  ok(rl.tarima.vis && rl.tarima.on, 'el INICIAR de la Planilla prende el reloj en la tarima: ' + JSON.stringify(rl.tarima));
  ok(rl.ctrlTx.vis && rl.ctrlTx.on, 'y en Control TX: ' + JSON.stringify(rl.ctrlTx));
  let n = await ordenes();
  ok(n === 1, 'la orden la cumple UN equipo, aunque la mesa y Control TX estén abiertos (' + n + ')');
  const t0s = Object.values(rl).map(x => x.t0);
  ok(t0s.every(t => t === t0s[0] && t > 0), 'y todos cuentan desde la misma hora');
  red.escribir('timer_control/' + juez, { action: 'hide', ts: Date.now(), by: 'planilla' });
  await red.calma(3000);
  rl = await relojes();
  ok(!rl.tarima.vis, 'QUITAR lo saca de la tarima');

  console.log('\nVarios computadores: solo la mesa 2 en Control en Vivo');
  await fase(mesa2, 'compete');
  await red.calma(1500);
  await mesa2.evaluate(() => overrideResult(2, 'sq', 0, 'g'));
  await red.calma(3000);
  c = await casilla(2, 'sq', 0);
  ok(iguales(c, 'g'), 'lo que marca la mesa 2 llega a todos: ' + JSON.stringify(c));
  const enBarra = await mesa2.evaluate(() => (liftQueue()[0] || {}).name || '');
  const panel = red.leer('judge_decisions/' + juez) || {};
  ok(panel.athlete_name === enBarra, 'el panel de jueces tiene al atleta en barra: ' + panel.athlete_name + ' (' + enBarra + ')');
  await cero();
  red.escribir('timer_control/' + juez, { action: 'start', ts: Date.now(), by: 'central' });
  await red.calma(3500);
  n = await ordenes();
  ok(n === 1, 'el INICIAR del juez central lo cumple un solo equipo de los tres (' + n + ')');
  rl = await relojes();
  const t1 = Object.values(rl).map(x => x.t0);
  ok(t1.every(t => t === t1[0] && t > 0) && Object.values(rl).every(x => x.on && x.vis), 'y las cuatro pantallas muestran el mismo reloj');

  console.log('\nEspera una orden de descanso');
  await cero();
  const desc = [];
  for (const p of Object.values(ADMIN)) await p.evaluate(() => { const o = _descEscribe; window.__desc = 0; _descEscribe = function () { window.__desc++; return o.apply(this, arguments); }; });
  red.escribir('timer_control/' + juez, { action: 'break', min: 10, ts: Date.now(), by: 'planilla' });
  await red.calma(3500);
  for (const p of Object.values(ADMIN)) desc.push(await p.evaluate(() => window.__desc));
  ok(desc.reduce((a, x) => a + x, 0) === 1, 'el YA VOLVEMOS de la Planilla se pone una sola vez (' + desc.join('/') + ')');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

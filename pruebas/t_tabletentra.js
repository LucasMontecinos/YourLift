// Entrar con la misma cuenta desde un segundo aparato no le borra nada al primero.
//
// Lo que pasó: en el computador, Control en Vivo con todo cargado (pesaje,
// racks, lotes sorteados, aperturas, resultados). Se abre la tablet con la
// misma cuenta para el Control Remoto y el computador queda con "la versión de
// la tablet, que no tenía todo".
//
// La tablet, al abrir, arma el campeonato desde las inscripciones —sin pesaje,
// sin lotes sorteados, en sentadilla, intento 1— y antes de recibir lo que hay
// en el servidor ya estaba escribiendo: los inscritos que "le faltaban" los
// subía como altas suyas (con peso 0 y sin racks), mandaba su movimiento, ronda
// y tanda, y por el canal rápido la tanda entera sin intentos.
//
// Lo que se cuida: un aparato que recién entra NO escribe nada hasta haber
// recibido y adoptado lo que hay en el servidor; después opera normal.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_tabletentra.js
const { chromium } = require('playwright');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026',
  canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };
const NOMBRES = ['Matías Rojas Fuentes', 'Diego Soto Muñoz', 'Felipe Contreras Lagos', 'Tomás Herrera Vidal', 'Ignacio Pérez Araya', 'Joaquín Morales Silva'];

function datos() {
  return {
    eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
    inscripciones: NOMBRES.map((n, i) => ({ id: 'ins' + i, evento: EV.id, status: 'approved', nombre: n, sexo: 'Hombre',
      categoria: '93', division: 'Open', club: 'Club Primavera', modalidad: 'Classic' })),
    atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
    admins: [{ id: 'u', role: 'owner' }],
  };
}
// Lo que el computador ya subió: pesaje, racks, lotes sorteados (101…), la
// sentadilla completa, la banca empezada y el reloj corriendo.
const T0 = Date.now() - 600000;
function cargado() {
  return NOMBRES.map((name, i) => {
    const c = (w, r, k) => ({ w, r, t: T0 + k, tw: T0 + k, tr: r ? T0 + k : undefined });
    return { id: i, lot: 101 + ((i * 7) % 6), name, flight: 'A', sex: 'Hombre', cat: '93', div: 'Open', mod: 'classic',
      club: 'Club Primavera', bw: 90.5 + i, weighedIn: true, rackSQ: String(10 + i), rackBP: String(5 + i), bombed: false,
      att: { sq: [c(200 + i * 5, 'g', 1), c(210 + i * 5, 'g', 2), c(217.5 + i * 5, i % 2 ? 'n' : 'g', 3)],
        bp: [c(130 + i * 2.5, i < 3 ? 'g' : null, 4), { w: 0, r: null }, { w: 0, r: null }],
        dl: [c(240 + i * 5, null, 5), { w: 0, r: null }, { w: 0, r: null }] } };
  });
}
const resumen = arr => (arr || []).map(a => [a.name.split(' ')[0], a.lot, a.bw, a.rackSQ,
  ['sq', 'bp', 'dl'].map(l => (a.att[l] || []).map(x => (x && x.w ? x.w + (x.r || '') : '')).join(',')).join('|')].join(' ')).sort().join('\n');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const errs = [];
  const RUTA = 'livecast_sync/' + EV.canal;

  async function escenario(titulo, prepTablet) {
    console.log('\n' + titulo);
    const red = crearRed({ subida: [300, 900], bajada: [400, 1500] });
    red.sembrar(RUTA, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(cargado()),
      flight: 'A', lift: 'bp', round: 0, changeTimers: '{}', ts: T0 + 10, tsAth: T0 + 10, lotsGenerated: true, forcedCurrent: null,
      timer: 60, timerOn: false, writer: 'compu-antes' });
    const esperado = resumen(cargado());
    async function abrir(nombre, url, init) {
      const ctx = await b.newContext({ viewport: { width: 1200, height: 850 }, serviceWorkers: 'block' });
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await red.montar(ctx, p, { nombre, auth: true, datos: datos() });
      if (init) await p.addInitScript(init.fn, init.arg);
      await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 6, null, { timeout: 25000 });
      return { p, ctx };
    }
    const compu = await abrir('compu', 'livecast.html?evento=' + EV.id + '&controller=1');
    await red.calma(3000);
    const c0 = await compu.p.evaluate(() => ({ lift: DATA.lift, ctrl: !!window.IS_CONTROLLER }));
    ok(c0.lift === 'bp' && c0.ctrl, 'el computador opera con lo cargado (press banca)');
    const tablet = await abrir('tablet', 'livecast.html?evento=' + EV.id + '&remote=1', prepTablet);
    await red.calma(6000);
    const srv = JSON.parse(red.leer(RUTA) ? JSON.stringify(red.leer(RUTA)) : 'null');
    const ath = JSON.parse(srv.athletes);
    ok(resumen(ath) === esperado, 'el servidor conserva pesaje, racks, lotes e intentos'
      + (resumen(ath) === esperado ? '' : '\n' + resumen(ath)));
    ok(srv.lift === 'bp' && srv.round === 0, 'y el movimiento y la ronda (' + srv.lift + ' ' + srv.round + ')');
    const vc = await compu.p.evaluate(() => ({ ath: DATA.athletes, lift: DATA.lift }));
    ok(resumen(vc.ath) === esperado && vc.lift === 'bp', 'el computador no pierde nada');
    const vt = await tablet.p.evaluate(() => ({ ath: DATA.athletes, lift: DATA.lift, ctrl: !!window.IS_CONTROLLER, fase: DATA.phase }));
    ok(resumen(vt.ath) === esperado && vt.lift === 'bp', 'la tablet queda con lo del computador');
    ok(vt.ctrl && vt.fase === 'remote', 'y en el Control Remoto, lista para operar');
    // Y la tablet sigue sirviendo: un válido desde ella llega al computador.
    await tablet.p.evaluate(() => { window.confirm = () => true; overrideResult(3, 'bp', 0, 'n'); });
    await red.calma(4500);
    const r = await compu.p.evaluate(() => { const a = DATA.athletes.find(x => x.id === 3); return a.att.bp[0].r; });
    const rs = JSON.parse(red.leer(RUTA).athletes).find(x => x.id === 3).att.bp[0].r;
    ok(r === 'n' && rs === 'n', 'lo que se marca en la tablet llega al computador (' + r + '/' + rs + ')');
    const bw = JSON.parse(red.leer(RUTA).athletes).map(a => a.bw).join(',');
    ok(bw === cargado().map(a => a.bw).join(','), 'sin tocar el pesaje de nadie');
    await compu.ctx.close(); await tablet.ctx.close();
  }

  await escenario('Tablet nueva, con la misma cuenta, abre el Control Remoto');
  // La tablet ya se usó antes para este campeonato: tiene guardada una copia
  // vieja (sentadilla, sin pesaje) y se abre con ella.
  await escenario('Tablet con una copia vieja del mismo campeonato', {
    fn: ([ev, nombres]) => {
      try {
        if (sessionStorage.getItem('__ya')) return; sessionStorage.setItem('__ya', '1');
        localStorage.setItem('yl_controller', '1');
        localStorage.setItem('fechipo_lc3', JSON.stringify({ phase: 'compete', event: { id: ev.id, name: ev.name }, lift: 'sq', round: 0, flight: 'A',
          changeTimers: {}, lotsGenerated: false, forcedCurrent: null,
          athletes: nombres.map((name, i) => ({ id: i, lot: i + 1, name, flight: 'A', sex: 'Hombre', cat: '93', div: 'Open', mod: 'classic', bw: 0,
            att: { sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] } })) }));
      } catch (e) {}
    }, arg: [EV, NOMBRES] });

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

// El computador de la mesa le avisa a los jueces quién está en la barra, anota
// las luces y obedece las órdenes de reloj ESTÉ EN LA PESTAÑA QUE ESTÉ.
//
// Pasó en competencia: con el computador de la mesa en Control TX (o en la
// Pantalla de Tarima, o en el Pesaje), el panel de jueces se quedaba con el
// atleta anterior. Todo eso se hacía solo con la pestaña Control en Vivo
// abierta. Y con "Vista libre" se le avisaba el atleta de la tanda que se estaba
// mirando, no el de la tarima.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_puestoopera.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(`http://localhost:${PUERTO}/livecast.html?practica=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length > 4
    && typeof _deberesDelPuesto === 'function', null, { timeout: 20000 });
  await p.waitForTimeout(600);

  const r = await p.evaluate(async () => {
    const espera = ms => new Promise(res => setTimeout(res, ms));
    window.__oy = {}; window.__esc = [];
    window._fb = Object.assign({}, window._fb || {}, {
      doc: (_d, col, id) => ({ col, id }),
      onSnapshot: (ref, cb) => { window.__oy[ref.col] = cb; return () => {}; },
      setDoc: async (ref, campos) => { window.__esc.push({ col: ref.col, campos: JSON.parse(JSON.stringify(campos)) }); },
    });
    fbReady = true; fbDB = {}; isAdmin = true;
    const tandas = [...new Set(DATA.athletes.map(a => a.flight))].sort();
    DATA.lift = 'sq'; DATA.round = 0; DATA.forcedCurrent = null; DATA.flight = tandas[0];
    DATA.athletes.forEach(x => { x.att.sq = [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }]; });
    DATA.athletes.forEach((x, i) => { x.att.sq[0] = { w: 100 + i * 5, r: null }; });
    const ultimoAviso = () => { const w = window.__esc.filter(e => e.col === 'judge_decisions' && 'athlete_name' in e.campos); return w.length ? w[w.length - 1].campos : null; };
    const out = { tandas };

    // 1. Mesa en Control TX
    window.IS_CONTROLLER = true; DATA.phase = 'director'; _juezUltAtleta = '';
    R();
    await espera(50);
    out.cur1 = liftQueue()[0].name;
    out.aviso1 = ultimoAviso();
    out.oyeReloj = typeof window.__oy.timer_control === 'function';

    // 2. Se juzga el intento SIN pasar por R() (como cuando se está tecleando en
    //    una casilla y la pantalla no se redibuja): el reloj maestro avisa igual.
    const c1 = liftQueue()[0];
    DATA.athletes.find(a => a.id === c1.id).att.sq[0].r = 'g';
    await espera(1300);
    out.cur2 = liftQueue()[0].name;
    out.aviso2 = ultimoAviso();

    // 3. Las luces se anotan aunque la mesa esté en el Pesaje
    DATA.phase = 'manage';
    const c3 = liftQueue()[0];
    const luces = d => window.__oy.judge_decisions({ exists: () => true, data: () => d });
    luces({ izq: null, central: null, der: null });
    luces({ izq: 'white', central: 'white', der: 'red' });
    out.luces = JSON.stringify((DATA.athletes.find(a => a.id === c3.id).att.sq[0] || {}).luces || null);

    // 4. Vista libre: la mesa mira otra tanda, pero a los jueces les llega la de la tarima
    window._NAV_REMOTA = { lift: 'sq', round: 0, flight: tandas[0], forcedCurrent: null };
    window.NAV_LIBRE = true; DATA.flight = tandas[1]; _juezUltAtleta = '';
    out.curLibre = liftQueue()[0] ? liftQueue()[0].name : '';
    window.__esc.length = 0;
    _deberesDelPuesto();
    await espera(50);
    out.avisoLibre = ultimoAviso();
    out.curTarima = c3.name;
    out.flightQueda = DATA.flight;
    window.NAV_LIBRE = false; DATA.flight = tandas[0];

    // 5. Un equipo en Espectador fuera de Control en Vivo no escribe
    window.IS_CONTROLLER = false; DATA.phase = 'director'; _juezUltAtleta = '';
    window.__esc.length = 0;
    _deberesDelPuesto();
    await espera(50);
    out.espectador = window.__esc.length;
    // …ni la página pública
    window.IS_CONTROLLER = true; DATA.phase = 'liveView'; _juezUltAtleta = '';
    _deberesDelPuesto();
    await espera(50);
    out.publico = window.__esc.length;
    return out;
  });

  console.log('\nCon la mesa en Control TX');
  ok(r.aviso1 && r.aviso1.athlete_name === r.cur1, 'el panel de jueces recibe al atleta en barra: ' + (r.aviso1 && r.aviso1.athlete_name));
  ok(r.oyeReloj, 'y se escuchan las órdenes de reloj del juez central y la Planilla');
  ok(r.aviso2 && r.aviso2.athlete_name === r.cur2 && r.cur2 !== r.cur1, 'al juzgar, el panel pasa al siguiente aunque la pantalla no se redibuje: ' + (r.aviso2 && r.aviso2.athlete_name));
  ok(r.aviso2 && r.aviso2.athlete_weight > 0, 'con el peso del intento: ' + (r.aviso2 && r.aviso2.athlete_weight));

  console.log('\nCon la mesa en Atletas y Pesaje');
  ok(r.luces === JSON.stringify({ izq: 'white', central: 'white', der: 'red' }), 'las luces quedan anotadas en el intento: ' + r.luces);

  console.log('\nCon Vista libre en otra tanda');
  ok(r.tandas.length > 1, 'la práctica tiene más de una tanda (' + r.tandas.join(',') + ')');
  ok(r.avisoLibre && r.avisoLibre.athlete_name === r.curTarima && r.curTarima !== r.curLibre,
    'a los jueces les llega el de la tarima (' + (r.avisoLibre && r.avisoLibre.athlete_name) + '), no el de la tanda que se mira (' + r.curLibre + ')');
  ok(r.flightQueda === r.tandas[1], 'y la mesa sigue mirando su tanda');

  console.log('\nQuién no lo hace');
  ok(r.espectador === 0, 'un equipo en Espectador fuera de Control en Vivo no escribe');
  ok(r.publico === 0, 'ni la página pública');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

// La Planilla (panel de jueces): el minuto del intento y el "Ya volvemos".
//
// Lo que manda va al documento timer_control del canal, el mismo del INICIAR
// TIMER del juez central. El puesto que opera el livecast lo escucha SIEMPRE
// (antes solo con el "modo jueces", que no se usa: el botón no hacía nada):
//   · INICIAR → el minuto desde 60, y se muestra en el scoreboard de la
//     transmisión y en las pantallas de tarima (intento y atleta en barra).
//     Si nadie lo inicia, no se muestra: el reloj que arranca solo después de
//     cada decisión no sale en pantalla.
//   · Con la decisión del intento, el reloj se va.
//   · YA VOLVEMOS con N minutos → el descanso de Control TX con esos minutos.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_planilla.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const STUB_FS = `
let DOC={izq:null,central:null,der:null,reset_ts:0,athlete_name:'Ana Prueba',athlete_lift:'sq',athlete_round:0};
const subs=[];
window.__escrituras=[];
window.__doc=()=>DOC;
function snap(){return {exists:()=>true,data:()=>DOC};}
export function getFirestore(){return{};}
export function doc(_d,col){return{col};}
export function onSnapshot(d,cb){subs.push(cb);setTimeout(()=>cb(snap()),5);return()=>{};}
export async function updateDoc(d,campos){ window.__escrituras.push({col:d.col,campos:JSON.parse(JSON.stringify(campos))}); }
export async function setDoc(d,campos){ window.__escrituras.push({col:d.col,campos:JSON.parse(JSON.stringify(campos))}); }
`;
const STUB_APP = `export function initializeApp(){return{};}`;
const STUB_AUTH = `
export function getAuth(){return{_u:{uid:'u1'}};}
export function onAuthStateChanged(a,cb){setTimeout(()=>cb(a._u),5);return()=>{};}
export async function signInWithEmailAndPassword(){return{};}
export async function signOut(a){a._u=null;}
`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  console.log('\nPanel de jueces, posición PLANILLA');
  {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('yl_juez_desde', String(Date.now())); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('jueces: ' + e.message));
    await p.route('**/firebase-app.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_APP }));
    await p.route('**/firebase-firestore.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_FS }));
    await p.route('**/firebase-auth.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_AUTH }));
    await p.goto(`http://localhost:${PUERTO}/jueces.html?canal=Regional_Noviembre`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof selectPos === 'function' && window.__doc, null, { timeout: 20000 });
    await p.evaluate(() => selectPos('planilla'));
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('planBox')).display !== 'none'
      && getComputedStyle(document.querySelector('.vote-grid')).display === 'none'), 'tiene su pantalla, sin botones de voto');
    await p.click('text=▶ INICIAR TIMER');
    await p.waitForTimeout(1300);
    const w1 = await p.evaluate(() => window.__escrituras.slice(-1)[0]);
    ok(w1 && w1.col === 'timer_control' && w1.campos.action === 'start' && w1.campos.by === 'planilla', 'INICIAR TIMER manda la orden: ' + JSON.stringify(w1 && w1.campos));
    const reloj = await p.evaluate(() => document.getElementById('planReloj').textContent);
    ok(/^0:5\d$/.test(reloj), 'y el teléfono muestra el minuto corriendo: ' + reloj);
    await p.fill('#planMin', '15');
    await p.click('text=INICIAR YA VOLVEMOS');
    await p.waitForTimeout(150);
    const w2 = await p.evaluate(() => window.__escrituras.slice(-1)[0]);
    ok(w2 && w2.campos.action === 'break' && w2.campos.min === 15, 'YA VOLVEMOS manda los minutos: ' + JSON.stringify(w2 && w2.campos));
    await p.screenshot({ path: '/tmp/claude-0/-home-user-YourLift/0692ef33-d41b-5709-98fb-6a0aca869c32/scratchpad/planilla.png' });
    await ctx.close();
  }

  console.log('\nLa mesa cumple las órdenes');
  {
    const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
    p.on('pageerror', e => errs.push('mesa: ' + e.message));
    p.on('dialog', d => d.accept());
    await p.goto(`http://localhost:${PUERTO}/livecast.html?practica=1`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length > 2, null, { timeout: 20000 });
    await p.waitForTimeout(600);
    const r = await p.evaluate(async () => {
      window.__oy = {}; window.__desc = [];
      window._fb = Object.assign({}, window._fb || {}, { doc: (_d, col, id) => ({ col, id }), onSnapshot: (ref, cb) => { window.__oy[ref.col] = cb; return () => {}; }, setDoc: async () => {} });
      fbReady = true; fbDB = {};
      _descEscribe = bt => { window.__desc.push(bt); };
      DATA.lift = 'sq'; DATA.round = 0; DATA.forcedCurrent = null;
      DATA.flight = DATA.athletes[0].flight;
      DATA.athletes.forEach(x => { x.att.sq = [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }]; });
      DATA.athletes.filter(x => x.flight === DATA.flight).forEach((x, i) => { x.att.sq[0] = { w: 100 + i * 10, r: null }; });
      DATA.relojVisible = false;
      const cur = liftQueue()[0];
      // El reloj de tarima corriendo solo (como tras cada decisión): no sale.
      startTimer();
      const sinPlanilla = { sb: /sbRelojTx/.test(_renderTxCerScoreboardBL(cur, { noAnimate: true })), barra: /pantBarraTimer/.test(renderScreenBarra(cur)) };
      _escucharTimerControl();
      const snap = d => window.__oy.timer_control({ exists: () => true, data: () => d });
      snap({ action: 'start', ts: 5, by: 'planilla' });            // ya estaba al abrir: vieja
      const viejaNo = !DATA.relojVisible;
      snap({ action: 'start', ts: Date.now(), by: 'planilla' });
      await new Promise(r => setTimeout(r, 1300));
      const conPlanilla = { vis: DATA.relojVisible, on: DATA.timerOn, t: DATA.timer,
        sb: /sbRelojTx/.test(_renderTxCerScoreboardBL(cur, { noAnimate: true })), barra: /pantBarraTimer/.test(renderScreenBarra(cur)) };
      snap({ action: 'break', min: 15, ts: Date.now() + 1, by: 'planilla' });
      const desc = window.__desc.slice(-1)[0];
      overrideResult(cur.id, 'sq', 0, 'g');                       // la decisión del intento
      const trasDecision = DATA.relojVisible;
      snap({ action: 'start', ts: Date.now() + 2, by: 'central' }); // el juez central también puede
      const central = DATA.relojVisible;
      snap({ action: 'hide', ts: Date.now() + 3, by: 'planilla' });
      return { sinPlanilla, viejaNo, conPlanilla, desc, trasDecision, central, oculto: DATA.relojVisible };
    });
    ok(!r.sinPlanilla.sb && !r.sinPlanilla.barra, 'sin la Planilla, el reloj no sale en el scoreboard ni en la tarima');
    ok(r.viejaNo, 'la orden que ya estaba al abrir no se cumple');
    ok(r.conPlanilla.vis && r.conPlanilla.on && r.conPlanilla.t <= 59 && r.conPlanilla.t >= 57, 'INICIAR: el minuto corre desde 60 (' + r.conPlanilla.t + ' s)');
    ok(r.conPlanilla.sb, 'y sale en el scoreboard de la transmisión');
    ok(r.conPlanilla.barra, 'y en la pantalla de atleta en barra');
    ok(r.desc && r.desc.active && r.desc.durationSec === 900, 'YA VOLVEMOS 15 → el descanso de Control TX con 15 min');
    ok(r.trasDecision === false, 'con la decisión del intento, el reloj se va de la pantalla');
    ok(r.central === true, 'el INICIAR TIMER del juez central ahora también funciona');
    ok(r.oculto === false, 'QUITAR lo saca de la pantalla');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

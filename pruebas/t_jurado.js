// El jurado revierte una decisión desde el panel de jueces.
//
// Posición JURY: muestra el último intento que juzgó la mesa y tiene "revertir a
// válido" y "revertir a nulo" con la tarjeta (roja, azul o amarilla). Lo que
// manda queda en el campo `jurado` del documento de los jueces; la mesa lo
// aplica al intento una sola vez, y la transmisión lo muestra en la esquina
// superior izquierda: "JURY HAS OVERRULED · Decisión del jurado".
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_jurado.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const STUB_FS = `
let DOC={izq:null,central:null,der:null,reset_ts:0,athlete_name:'Ana Prueba',athlete_lift:'sq',athlete_round:1,
  ultimo:{id:7,name:'Bruno Revertido',lift:'sq',round:0,r:'g',w:180,ts:1000}};
const subs=[];
window.__escrituras=[];
window.__doc=()=>DOC;
function snap(){return {exists:()=>true,data:()=>DOC};}
export function getFirestore(){return{};}
export function doc(){return{};}
export function onSnapshot(d,cb){subs.push(cb);setTimeout(()=>cb(snap()),5);return()=>{};}
export async function updateDoc(d,campos){ window.__escrituras.push(JSON.parse(JSON.stringify(campos))); DOC=Object.assign({},DOC,campos); subs.forEach(f=>f(snap())); }
export async function setDoc(d,campos){ window.__escrituras.push(JSON.parse(JSON.stringify(campos))); DOC=Object.assign({},campos); subs.forEach(f=>f(snap())); }
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

  console.log('\nPanel de jueces, posición JURY');
  let jurado;
  {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('yl_juez_desde', String(Date.now())); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('jueces: ' + e.message));
    p.on('dialog', d => d.accept());
    await p.route('**/firebase-app.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_APP }));
    await p.route('**/firebase-firestore.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_FS }));
    await p.route('**/firebase-auth.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_AUTH }));
    await p.goto(`http://localhost:${PUERTO}/jueces.html?canal=Regional_Noviembre`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof selectPos === 'function' && window.__doc, null, { timeout: 20000 });
    ok(await p.evaluate(() => /JURY/.test(document.getElementById('pick').innerText)), 'en la elección de posición está JURY');
    await p.evaluate(() => selectPos('jury'));
    await p.waitForTimeout(200);
    const ui = await p.evaluate(() => ({
      ult: document.getElementById('juryUlt').innerText,
      votos: getComputedStyle(document.querySelector('.vote-grid')).display,
      caja: getComputedStyle(document.getElementById('juryBox')).display,
    }));
    ok(/Bruno Revertido/.test(ui.ult) && /VÁLIDO/.test(ui.ult), 'muestra el último intento juzgado: ' + ui.ult.replace(/\n/g, ' · '));
    ok(ui.votos === 'none' && ui.caja !== 'none', 'sin los botones de voto: tiene los suyos');
    await p.screenshot({ path: '/tmp/claude-0/-home-user-YourLift/0692ef33-d41b-5709-98fb-6a0aca869c32/scratchpad/jury_panel.png' });
    await p.click('.jury-card:nth-child(2)');   // NULO · tarjeta azul
    await p.waitForTimeout(200);
    jurado = await p.evaluate(() => __doc().jurado);
    ok(jurado && jurado.res === 'n' && jurado.card === 'blue' && jurado.id === 7 && jurado.lift === 'sq' && jurado.round === 0,
       'manda: nulo, tarjeta azul, al intento de Bruno (' + JSON.stringify(jurado) + ')');
    await ctx.close();
  }

  console.log('\nLa mesa la aplica una vez');
  {
    const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
    p.on('pageerror', e => errs.push('mesa: ' + e.message));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?practica=1`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length > 2, null, { timeout: 20000 });
    await p.waitForTimeout(600);
    const r = await p.evaluate(async (j) => {
      window.__toasts = []; const t0 = showToastLC; showToastLC = m => { window.__toasts.push(m); return t0(m); };
      window.__oy = {};
      window._fb = Object.assign({}, window._fb || {}, { doc: (_d, col, id) => ({ col, id }), onSnapshot: (ref, cb) => { window.__oy[ref.col] = cb; return () => {}; }, setDoc: async () => {} });
      fbReady = true; fbDB = {};
      const a = DATA.athletes[0]; j = Object.assign({}, j, { id: a.id });
      a.att.sq[0] = { w: 180, r: 'g', t: 1000 };
      const ult = _ultimoJuzgado();
      _escucharLucesHistorial();
      const snap = d => window.__oy.judge_decisions({ exists: () => true, data: () => d });
      snap({ jurado: { ts: 1, res: 'n', card: 'red', id: a.id, lift: 'sq', round: 0 } });   // ya estaba: viejo
      const tras_viejo = a.att.sq[0].r;
      snap({ jurado: j });
      const tras = { r: a.att.sq[0].r, jur: a.att.sq[0].jurado };
      a.att.sq[0].r = 'g';                      // la mesa lo vuelve a tocar a mano
      snap({ jurado: j, athlete_name: 'otro' });   // el documento cambia por otra cosa
      return { ult, tras_viejo, tras, despues: a.att.sq[0].r, toast: window.__toasts.join(' | ') };
    }, jurado);
    ok(r.ult && r.ult.lift === 'sq' && r.ult.round === 0 && r.ult.r === 'g', 'la mesa anota cuál fue el último intento juzgado');
    ok(r.tras_viejo === 'g', 'lo que ya estaba en el documento al abrir no se aplica');
    ok(r.tras.r === 'n' && r.tras.jur && r.tras.jur.card === 'blue', 'la decisión del jurado cambia el intento a NULO, con su tarjeta');
    ok(/jurado/i.test(r.toast), 'y la mesa lo ve avisado: ' + r.toast);
    ok(r.despues === 'g', 'se aplica una sola vez: después manda la mesa');
  }

  console.log('\nLa transmisión la muestra en la esquina');
  {
    const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    p.on('pageerror', e => errs.push('tx: ' + e.message));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?tx=director&practica=1`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof renderTxWidget === 'function' && typeof TX_DIR_DEFAULT !== 'undefined', null, { timeout: 20000 });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(async (j) => {
      window.__oy = {};
      window._fb = Object.assign({}, window._fb || {}, { doc: (_d, col, id) => ({ col, id }), onSnapshot: (ref, cb) => { window.__oy[ref.col] = cb; return () => {}; } });
      fbReady = true; fbDB = {};
      if (typeof _txLightsUnsub !== 'undefined' && _txLightsUnsub) { try { _txLightsUnsub(); } catch (e) {} _txLightsUnsub = null; }
      document.documentElement.style.background = document.body.style.background = '#1a3a1a';
      _txDirState = Object.assign({}, TX_DIR_DEFAULT, { jurado: { active: true, until: 0, scale: 1 } });
      _txDirLastSig = null; renderTxWidget();
      const snap = d => window.__oy.judge_decisions({ exists: () => true, data: () => d });
      snap({ izq: null, central: null, der: null });             // primer documento: sin jurado
      const antes = document.body.innerText;
      snap({ izq: null, central: null, der: null, jurado: j });
      await new Promise(r => setTimeout(r, 700));
      const txt = document.body.innerText;
      return { antes: /OVERRULED/.test(antes), txt };
    }, jurado);
    ok(!r.antes, 'armado, no muestra nada mientras el jurado no decide');
    ok(/JURY HAS OVERRULED/.test(r.txt) && /DECISIÓN DEL JURADO/.test(r.txt) && /NO LIFT/.test(r.txt), 'al revertir aparece "JURY HAS OVERRULED · Decisión del jurado"');
    await p.screenshot({ path: '/tmp/claude-0/-home-user-YourLift/0692ef33-d41b-5709-98fb-6a0aca869c32/scratchpad/jury_tx.png' });
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

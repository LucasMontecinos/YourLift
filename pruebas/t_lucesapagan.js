// Las luces se apagan solas cuando ya votaron los tres.
//
// Se probó en vivo y quedaban puestas: en la pantalla de tarima se veían las del
// intento anterior mientras el siguiente atleta ya estaba en la barra.
//
// Nadie las limpiaba, y no era un olvido: resetJudgeLights() del control solo
// corre con el "modo jueces" encendido, y ese modo es justamente el que da
// válido/nulo desde las luces — lo que se pidió NO usar. Así que la limpieza la
// hace el panel de jueces, que es la misma página que puso los votos.
//
// Lo que hay que cuidar:
//   · que se limpie el DOCUMENTO y no solo la pantalla — la tarima es un espejo,
//     si acá no se borra, allá no se apaga;
//   · que no se apaguen antes de tiempo, con dos votos puestos y el tercero por
//     llegar;
//   · y que si un teléfono se cae, las luces igual se apaguen.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_lucesapagan.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../jueces.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Firestore simulado: guarda el documento, avisa a los suscriptos y anota cada
// escritura, que es lo que se quiere observar.
const STUB_FS = `
let DOC={izq:null,central:null,der:null,reset_ts:0,athlete_name:'Prueba',athlete_lift:'sq',athlete_round:0};
const subs=[];
window.__escrituras=[];
window.__doc=()=>DOC;
window.__votar=(pos,color)=>{DOC=Object.assign({},DOC,{[pos]:color});subs.forEach(f=>f(snap()));};
function snap(){return {exists:()=>true,data:()=>DOC};}
export function getFirestore(){return{};}
export function doc(){return{};}
export function onSnapshot(d,cb){subs.push(cb);setTimeout(()=>cb(snap()),5);return()=>{};}
export async function updateDoc(d,campos){
  window.__escrituras.push(JSON.parse(JSON.stringify(campos)));
  DOC=Object.assign({},DOC,campos);
  subs.forEach(f=>f(snap()));
}
export async function setDoc(d,campos){
  window.__escrituras.push(JSON.parse(JSON.stringify(campos)));
  DOC=Object.assign({},campos);
  subs.forEach(f=>f(snap()));
}
`;
const STUB_APP = `export function initializeApp(){return{};}`;
const STUB_AUTH = `
export function getAuth(){return{_u:{uid:'u1'}};}
export function onAuthStateChanged(a,cb){setTimeout(()=>cb(a._u),5);return()=>{};}
export async function signInWithEmailAndPassword(){return{};}
export async function signOut(a){a._u=null;}
`;

async function abrir(b, pos) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // El reloj se adelanta a mano: esperar cinco segundos de verdad en cada caso
  // haría que la prueba tardara más de lo que aporta.
  await ctx.addInitScript(() => {
    // El juez ya entró con su cuenta en esta pestaña. Sin esta marca la página
    // da la sesión por ajena, la cierra y muestra el login — que es justo lo que
    // tiene que hacer, pero acá lo que se prueba son las luces, no el ingreso.
    try { sessionStorage.setItem('yl_juez_desde', String(Date.now())); } catch (e) {}
    // Los ids arrancan bien arriba para no chocar con los del navegador: si
    // clearTimeout de un id real cayera en esta tabla, se cancelaría el timer
    // equivocado y la prueba mediría cualquier cosa.
    window.__timers = new Map();
    let id = 100000;
    const real = window.setTimeout, realClear = window.clearTimeout;
    window.setTimeout = function (fn, ms) {
      if (ms >= 1000) { window.__timers.set(++id, fn); return id; }
      return real(fn, ms);
    };
    window.clearTimeout = function (x) {
      if (window.__timers.has(x)) { window.__timers.delete(x); return; }
      return realClear(x);
    };
    window.__correrReloj = () => {
      const fns = [...window.__timers.values()];
      window.__timers.clear();
      fns.forEach(f => f());
      return fns.length;
    };
  });
  await p.route('**/firebase-app.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_APP }));
  await p.route('**/firebase-firestore.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_FS }));
  await p.route('**/firebase-auth.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_AUTH }));
  await p.goto('http://localhost:8972/jueces.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof selectPos === 'function' && window.__doc, null, { timeout: 20000 });
  await p.evaluate(x => selectPos(x), pos);
  await p.waitForTimeout(120);
  return { p, ctx, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  console.log('\nCon los tres votos puestos, se apagan');
  {
    const { p, errs: e } = await abrir(b, 'central'); errs.push(...e);
    await p.evaluate(() => { __votar('izq', 'white'); __votar('central', 'white'); __votar('der', 'red'); });
    await p.waitForTimeout(120);
    let d = await p.evaluate(() => __doc());
    ok(d.izq === 'white' && d.der === 'red', 'primero quedan puestas, para que se puedan ver');
    ok(await p.evaluate(() => window.__escrituras.length) === 0, 'y no se apagan al instante');

    const n = await p.evaluate(() => __correrReloj());
    ok(n > 0, 'hay un apagado programado (' + n + ')');
    await p.waitForTimeout(150);
    d = await p.evaluate(() => __doc());
    ok(d.izq === null && d.central === null && d.der === null, 'pasado el rato, las tres se apagan');
    const esc = await p.evaluate(() => window.__escrituras);
    ok(esc.length >= 1 && esc[0].reset_ts > 0, 'se avisa con reset_ts, que es lo que limpia los teléfonos');
  }

  console.log('\n  Son cinco segundos, no dos ni quince');
  ok(/const LUCES_SEGUNDOS=5;/.test(src), 'el tiempo está en un solo lugar y es 5');
  ok(/LUCES_SEGUNDOS\*1000\+atraso/.test(src), 'y es el que se usa para programar el apagado');

  console.log('\nCon dos votos NO se apagan: falta el tercero');
  {
    const { p, errs: e } = await abrir(b, 'central'); errs.push(...e);
    await p.evaluate(() => { __votar('izq', 'white'); __votar('central', 'red'); });
    await p.waitForTimeout(120);
    const n = await p.evaluate(() => __correrReloj());
    ok(n === 0, 'no hay ningún apagado programado (' + n + ')');
    const d = await p.evaluate(() => __doc());
    ok(d.izq === 'white' && d.central === 'red', 'los dos votos siguen ahí, esperando al que falta');
  }

  console.log('\n  Y si el tercero llega tarde, recién ahí empieza a contar');
  {
    const { p, errs: e } = await abrir(b, 'central'); errs.push(...e);
    await p.evaluate(() => { __votar('izq', 'white'); __votar('central', 'white'); });
    await p.waitForTimeout(100);
    await p.evaluate(() => __votar('der', 'white'));
    await p.waitForTimeout(100);
    ok(await p.evaluate(() => __correrReloj()) > 0, 'ahí sí queda programado');
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => __doc().central) === null, 'y se apagan');
  }

  console.log('\n  Si un juez se corrige antes de que se apaguen, se vuelve a esperar');
  {
    const { p, errs: e } = await abrir(b, 'central'); errs.push(...e);
    await p.evaluate(() => { __votar('izq', 'white'); __votar('central', 'white'); __votar('der', 'red'); });
    await p.waitForTimeout(100);
    await p.evaluate(() => __votar('der', null));       // se arrepiente
    await p.waitForTimeout(100);
    ok(await p.evaluate(() => __correrReloj()) === 0, 'se cancela el apagado mientras falte un voto');
    ok(await p.evaluate(() => window.__escrituras.length) === 0, 'y no se borró nada');
  }

  console.log('\nSi un teléfono se cae, las otras igual las apagan');
  {
    // Cada teléfono programa lo suyo, escalonado. Con uno solo vivo alcanza.
    for (const pos of ['izq', 'der']) {
      const { p, errs: e } = await abrir(b, pos); errs.push(...e);
      await p.evaluate(() => { __votar('izq', 'white'); __votar('central', 'white'); __votar('der', 'white'); });
      await p.waitForTimeout(120);
      await p.evaluate(() => __correrReloj());
      await p.waitForTimeout(150);
      ok(await p.evaluate(() => __doc().izq) === null, 'con solo el juez ' + pos + ' conectado, se apagan igual');
    }
    ok(/atraso=\{izq:0,central:250,der:500\}/.test(src),
       'van escalonados, para que normalmente escriba uno solo');
  }

  console.log('\nLa tarima sigue sin escribir: se limpia el documento, no la pantalla');
  {
    const liv = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    const i = liv.indexOf('function renderLucesTarima(');
    ok(!/updateDoc|setDoc/.test(liv.slice(i, liv.indexOf('\n}', i))), 'la pantalla de tarima no escribe nada');
    const j = src.indexOf('function _programarLimpieza');
    const cuerpo = src.slice(j, src.indexOf('\n}', j));
    ok(/updateDoc/.test(src.slice(j, j + 1600)), 'quien limpia es el panel de jueces');
    ok(!/setResult|judgeMode/.test(cuerpo), 'y limpiar no juzga ningún intento');
  }

  console.log('\n  Los teléfonos quedan en blanco para la vuelta siguiente');
  ok(/if\(d\.reset_ts&&d\.reset_ts>\(_lastReset\|\|0\)\)\{/.test(src),
     'el reset_ts que se escribe es el mismo que ya limpiaba los votos locales');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

// Entrar a juzgar desde un teléfono nuevo.
//
// Pasó en competencia: en la tablet las luces salían, en el teléfono del juez
// decía "sin permiso" y no había en la página dónde arreglarlo. La sesión de
// Firebase vive en el NAVEGADOR, no en la cuenta: entrar en la tablet no le
// sirve al teléfono, y Chrome no la comparte con el navegador de Samsung ni con
// una pestaña de incógnito. La página de jueces no tenía login propio, así que
// había que ir a entrar al admin en ese mismo navegador y recién volver.
//
// Ahora entra desde acá. Lo que se cuida:
//   · que sin sesión el login aparezca solo, sin que nadie tenga que buscarlo;
//   · que con sesión NO moleste;
//   · y que el login no toque el voto — sigue siendo la misma página de juzgar.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_juecessesion.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../jueces.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const VISIBLE = id => {
  const el = document.getElementById(id);
  if (!el) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && el.offsetHeight > 0;
};

// Firebase no se alcanza desde las pruebas, así que se simulan los dos módulos
// que usa la página: el de auth (con y sin sesión) y el de firestore.
function stubs(haySesion) {
  return `
export function getAuth(){return{_u:${haySesion ? '{uid:"u1"}' : 'null'}};}
export function onAuthStateChanged(a,cb){setTimeout(()=>cb(a._u),10);return()=>{};}
export async function signInWithEmailAndPassword(a,em,pw){
  if(pw==='mala'){const e=new Error('bad');e.code='auth/invalid-credential';throw e;}
  a._u={uid:'u1',email:em};
  window.__entro=em;
  return {user:a._u};
}
export async function signOut(a){ a._u=null; window.__salio=true; }
export const browserSessionPersistence={tipo:'sesion'};
export const browserLocalPersistence={tipo:'local'};
export async function setPersistence(a,p){ window.__persistencia=p&&p.tipo; }`;
}
const STUB_APP = `export function initializeApp(){return{};}`;
const STUB_FS = `
export function getFirestore(){return{};}
export function doc(){return{};}
export function onSnapshot(d,cb){return()=>{};}
export async function updateDoc(){return;}
export async function setDoc(){return;}
`;

async function abrir(b, haySesion) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebase-app.js', r =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_APP }));
  await p.route('**/firebase-firestore.js', r =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_FS }));
  await p.route('**/firebase-auth.js', r =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: stubs(haySesion) }));
  await p.goto('http://localhost:8972/jueces.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof abrirLogin === 'function', null, { timeout: 20000 });
  await p.waitForTimeout(400); // que corra onAuthStateChanged
  return { p, ctx, errs };
}

// Entrar con la cuenta, que ahora es el único camino para llegar a juzgar.
async function entrarComo(p, mail) {
  await p.fill('#logEmail', mail || 'juez@fechipo.cl');
  await p.fill('#logPass', 'buena');
  await p.click('#logBtn');
  await p.waitForTimeout(400);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nTeléfono nuevo, sin sesión: el login aparece solo');
  const { p, ctx, errs } = await abrir(b, false);
  {
    ok(await p.evaluate(VISIBLE, 'login'), 'se ve la pantalla de entrar');
    ok(!(await p.evaluate(VISIBLE, 'pick')), 'y no se pasa directo a elegir posición');
    const txt = await p.evaluate(() => document.getElementById('login').innerText);
    ok(/cuenta de juez/i.test(txt), 'pide la cuenta: ' + txt.split('\n').find(l => /cuenta/i.test(l)));
    ok(/lleguen a la tarima/i.test(txt), 'y para qué sirve entrar');
    ok(/4 horas/.test(txt), 'y avisa desde el principio cuánto dura la sesión');
    ok(await p.evaluate(() => window.__persistencia) === 'sesion',
       'la sesión se guarda solo mientras la página esté abierta');
  }

  console.log('\n  Y no hay forma de saltárselo');
  {
    const txt = await p.evaluate(() => document.getElementById('login').innerText);
    ok(!/sin entrar|solo para mirar/i.test(txt), 'no queda ningún "seguir sin entrar"');
    ok(!/saltarLogin/.test(src), 'ni la función que lo hacía');
  }

  console.log('\n  Se entra desde ahí mismo');
  {
    await p.fill('#logEmail', 'juez@fechipo.cl');
    await p.fill('#logPass', 'mala');
    await p.click('#logBtn');
    await p.waitForTimeout(300);
    const err = await p.evaluate(() => document.getElementById('logErr').textContent);
    ok(/incorrect/i.test(err), 'con la clave mala avisa: "' + err + '"');
    ok(await p.evaluate(VISIBLE, 'login'), 'y no deja pasar');

    await p.fill('#logPass', 'buena');
    await p.click('#logBtn');
    await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.__entro) === 'juez@fechipo.cl', 'con la clave buena entra');
    ok(!(await p.evaluate(VISIBLE, 'login')), 'el login se cierra solo');
    ok(await p.evaluate(VISIBLE, 'pick'), 'y aparece la elección de posición');
    const label = await p.evaluate(() => document.getElementById('fbLabel').textContent);
    ok(label === 'En vivo', 'el indicador pasa a "En vivo" (' + label + ')');
  }

  console.log('\nUna sesión que no se abrió acá no sirve');
  {
    // El navegador puede traer la sesión del panel o del livecast. Antes eso
    // dejaba pasar directo. Pero quien marca una luz tiene que haberse
    // identificado en esta página: si no, cualquiera que tome el teléfono ya
    // está adentro, juzgando a nombre de otro.
    const { p: p3, errs: e3 } = await abrir(b, true);
    ok(await p3.evaluate(VISIBLE, 'login'), 'igual pide la cuenta');
    ok(!(await p3.evaluate(VISIBLE, 'pick')), 'y no deja pasar a elegir posición');
    ok(await p3.evaluate(() => window.__salio) === true, 'y esa sesión ajena se cierra');
    errs.push(...e3);
  }

  console.log('\nAl cerrar la página hay que volver a entrar');
  {
    // Cada pestaña nueva arranca con sessionStorage vacío, que es exactamente lo
    // que pasa cuando el juez cierra la página y la vuelve a abrir.
    const { p: p7, errs: e7 } = await abrir(b, true);
    ok(await p7.evaluate(VISIBLE, 'login'), 'pide la cuenta de nuevo');
    await entrarComo(p7);
    ok(await p7.evaluate(VISIBLE, 'pick'), 'y entrando se llega a juzgar');
    errs.push(...e7);
  }

  console.log('\nA las 4 horas se vuelve a pedir, aunque la página siga abierta');
  {
    const { p: p8, errs: e8 } = await abrir(b, false);
    await entrarComo(p8);
    await p8.evaluate(() => selectPos('central'));
    ok(await p8.evaluate(VISIBLE, 'panel'), 'está juzgando desde la posición central');

    await p8.evaluate(() => window._vencerSesion(true));
    await p8.waitForTimeout(300);
    ok(await p8.evaluate(VISIBLE, 'login'), 'cumplido el plazo, vuelve a pedir la cuenta');
    ok(await p8.evaluate(() => window.__salio) === true, 'y cierra la sesión de verdad');
    const txt = await p8.evaluate(() => document.getElementById('logMsg').textContent);
    ok(/4 horas/.test(txt), 'diciendo por qué: "' + txt.trim() + '"');
    ok(await p8.evaluate(() => document.getElementById('logPass').value) === '',
       'y sin dejar la clave escrita en pantalla');

    await entrarComo(p8);
    ok(await p8.evaluate(VISIBLE, 'panel'), 'al volver a entrar sigue en su misma posición');
    ok(!(await p8.evaluate(VISIBLE, 'pick')), 'sin hacerlo elegir de nuevo en medio de la tanda');
    errs.push(...e8);
  }

  console.log('\n  El plazo está en un solo lugar, para poder cambiarlo');
  {
    ok(/const SESION_MAX_MS=4\*60\*60\*1000;/.test(src), 'las 4 horas son una constante');
    ok(/const SESION_AVISO_MS=/.test(src), 'y el aviso previo también');
  }

  console.log('\nSe puede cerrar la sesión al terminar');
  {
    const { p: p6, errs: e6 } = await abrir(b, false);
    await entrarComo(p6);
    await p6.evaluate(() => selectPos('der'));
    p6.on('dialog', d => d.accept());
    await p6.click('text=Cerrar sesión en este dispositivo');
    await p6.waitForTimeout(400);
    ok(await p6.evaluate(() => window.__salio) === true, 'la sesión se cierra de verdad');
    ok(await p6.evaluate(VISIBLE, 'login'), 'y vuelve a pedir entrar');
    ok(!(await p6.evaluate(VISIBLE, 'panel')), 'sin dejar el panel de juzgar abierto detrás');
    errs.push(...e6);
  }

  console.log('\nUna cuenta de juez NO es una cuenta de admin');
  {
    // Esto es lo que importa de todo el cambio. La sesión de un juez queda abierta
    // en un teléfono que se presta, se pierde o se olvida; tiene que no servir
    // para nada más que marcar la luz.
    const reglas = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
    const admin = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

    ok(/function esJuez\(\)[\s\S]{0,200}documents\/jueces\/\$\(request\.auth\.uid\)/.test(reglas),
       'los jueces viven en su propia colección, no en admins/');
    ok(/match \/judge_decisions\/\{doc\}[^\n]*esJuez\(\)/.test(reglas), 'un juez puede marcar su luz');
    ok(/match \/timer_control\/\{doc\}[^\n]*esJuez\(\)/.test(reglas), 'y arrancar el cronómetro');

    // Y NADA más: ninguna otra colección lo nombra.
    const otras = reglas.split('\n')
      .filter(l => /esJuez\(\)/.test(l) && /^\s*match /.test(l))
      .map(l => (l.match(/match \/([a-z_]+)/) || [])[1]);
    ok(otras.length === 2 && otras.indexOf('judge_decisions') >= 0 && otras.indexOf('timer_control') >= 0,
       'y no toca ninguna otra colección (' + otras.join(', ') + ')');
    ok(!/inscripciones[\s\S]{0,300}esJuez/.test(reglas), 'no escribe inscripciones');
    ok(!/competition_results[\s\S]{0,200}esJuez/.test(reglas), 'ni resultados');
    ok(!/match \/admins\/\{uid\}[\s\S]{0,120}esJuez/.test(reglas), 'ni se puede hacer admin a sí mismo');

    ok(/const esJuez = role==='juez';/.test(admin), 'al crear la cuenta, el panel separa al juez');
    ok(/setDoc\(doc\(db, esJuez\?'jueces':'admins', newUID\)/.test(admin),
       'y la guarda en jueces/ en vez de admins/');
    ok(/⚠ Cuenta de juez guardada entre los admins/.test(admin),
       'y avisa si quedó alguna cuenta vieja de juez con acceso completo');
  }

  console.log('\nEl login no toca el voto');
  ok(/window\.entrar=async function/.test(src), 'entrar() existe');
  {
    const i = src.indexOf('window.entrar=async function');
    const cuerpo = src.slice(i, src.indexOf('\n};', i));
    ok(!/castVote|updateDoc|judge_decisions/.test(cuerpo), 'y no escribe ningún voto');
  }
  ok(/if\(sinPermiso&&!fbSesion\)abrirLogin\(\);/.test(src),
     'si un voto rebota por permiso, se ofrece entrar en vez de dejar un cartel sin salida');

  console.log('\nSigue funcionando lo de antes');
  {
    const { p: p5, errs: e5 } = await abrir(b, false);
    await entrarComo(p5);
    await p5.evaluate(() => { selectPos('central'); pintarMotivos('sq'); });
    const r = await p5.evaluate(() => ({
      pos: document.getElementById('posBadge').textContent,
      mot: document.getElementById('mot_sq_red').textContent,
      botones: document.querySelectorAll('.vote-btn').length,
    }));
    ok(/CENTRAL/.test(r.pos), 'se elige posición');
    ok(/[Pp]rofundidad/.test(r.mot), 'los motivos de nulo siguen ahí');
    ok(r.botones === 4, 'y los cuatro botones de voto (' + r.botones + ')');
    errs.push(...e5);
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

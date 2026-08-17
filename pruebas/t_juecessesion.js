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
}`;
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

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nTeléfono nuevo, sin sesión: el login aparece solo');
  const { p, ctx, errs } = await abrir(b, false);
  {
    ok(await p.evaluate(VISIBLE, 'login'), 'se ve la pantalla de entrar');
    ok(!(await p.evaluate(VISIBLE, 'pick')), 'y no se pasa directo a elegir posición');
    const txt = await p.evaluate(() => document.getElementById('login').innerText);
    ok(/no tiene sesión/i.test(txt), 'dice por qué: ' + txt.split('\n').find(l => /sesión/i.test(l)));
    ok(/lleguen a la tarima/i.test(txt), 'y para qué sirve entrar');
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

  console.log('\n  Y se puede mirar sin entrar, si alguien solo quiere ver');
  {
    const { p: p2, errs: e2 } = await abrir(b, false);
    await p2.click('text=Seguir sin entrar');
    ok(!(await p2.evaluate(VISIBLE, 'login')), 'se sale del login');
    ok(await p2.evaluate(VISIBLE, 'pick'), 'y se puede usar la página');
    const label = await p2.evaluate(() => document.getElementById('fbLabel').textContent);
    ok(/Sin sesión/.test(label), 'pero el aviso queda arriba: "' + label + '"');
    errs.push(...e2);
  }

  console.log('\nTablet que ya tenía sesión: no molesta');
  {
    const { p: p3, errs: e3 } = await abrir(b, true);
    ok(!(await p3.evaluate(VISIBLE, 'login')), 'no aparece el login');
    ok(await p3.evaluate(VISIBLE, 'pick'), 'entra directo a elegir posición');
    ok(await p3.evaluate(() => document.getElementById('fbLabel').textContent) === 'En vivo',
       'y dice "En vivo"');
    errs.push(...e3);
  }

  console.log('\nSe puede volver a abrir desde el aviso de arriba');
  {
    const { p: p4, errs: e4 } = await abrir(b, false);
    await p4.click('text=Seguir sin entrar');
    await p4.evaluate(() => selectPos('central'));
    await p4.click('#fbLabel');
    ok(await p4.evaluate(VISIBLE, 'login'), 'tocando "Sin sesión" vuelve el login');
    errs.push(...e4);
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
    const { p: p5, errs: e5 } = await abrir(b, true);
    await p5.evaluate(() => { selectPos('central'); pintarMotivos('sq'); });
    const r = await p5.evaluate(() => ({
      pos: document.getElementById('posBadge').textContent,
      mot: document.getElementById('motRed').textContent,
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

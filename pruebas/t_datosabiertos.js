// Datos abiertos: la pestaña del público con el enlace de solo lectura al
// documento en vivo del campeonato, para que otras apps (por ejemplo un
// asistente para entrenadores) sigan la competencia.
//
// Solo el enlace: la mesa NO escribe nada aparte para esto. Hubo una versión con
// una copia de formato fijo que la mesa subía después de cada intento, y se sacó
// porque era una escritura más por la misma vía que la competencia. Lo que se
// cuida:
//   · la pestaña "Datos abiertos", en su sección aparte, con el enlace al
//     documento en vivo (livecast_sync/{canal}) del campeonato;
//   · que al cargar intentos la mesa escriba solo lo de siempre (nada de
//     livecast_sync/abierto__…) y que la sincronización no llame a nada de esto;
//   · que el documento en vivo no lleve RUT, fecha de nacimiento ni contactos,
//     aunque la nómina los traiga, y que el público lo lea sin cuenta;
//   · que las reglas lo sigan dejando leer sin cuenta y escribir solo a la mesa.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_datosabiertos.js
const { chromium } = require('playwright');
const fs = require('fs');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026',
  canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };

function atletas() {
  const nueve = (s) => ({ sq: [{ w: 100 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }],
    bp: [{ w: 60 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
  return [1, 2, 3, 4, 5, 6].map(i => ({ id: i, lot: i, name: 'Atleta Prueba ' + i, flight: 'A', sex: 'Hombre', cat: '83', div: 'Open',
    mod: 'classic', bw: 80, club: 'Club ' + i, att: nueve(i * 2.5),
    rut: '11111111-1', dob: '2000-01-01', fechaNac: '01/01/2000', correo: 'x@y.cl', telefono: '+56900000000' }));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const errs = [];

  console.log('\nEl código');
  const sinc = fs.readFileSync(__dirname + '/../livecast/sincronizacion.js', 'utf8');
  const da = fs.readFileSync(__dirname + '/../livecast/datos_abiertos.js', 'utf8');
  ok(!/_daProgramar|_daEscribir|datos_abiertos|abierto__/.test(sinc), 'la sincronización de la competencia no llama a nada de datos abiertos');
  ok(!/setDoc|updateDoc|setInterval/.test(da), 'datos_abiertos.js no escribe nada ni corre solo: es solo la pestaña');

  console.log('\nLa mesa escribe solo lo de siempre (red simulada)');
  const red = crearRed({ subida: [200, 600], bajada: [100, 500] });
  red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas()),
    flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: false, forcedCurrent: null, timer: 60, timerOn: false, writer: 'semilla' });
  const datos = () => ({ eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
    inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [], admins: [{ id: 'u', role: 'admin' }] });
  async function abrir(nombre, url, auth) {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await red.montar(ctx, p, { nombre, auth, datos: datos() });
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 6, null, { timeout: 25000 });
    return p;
  }
  const mesa = await abrir('mesa', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const publico = await abrir('publico', 'livecast.html?evento=' + EV.id, false);
  await mesa.evaluate(() => { window.confirm = () => true; window.prompt = () => null; DATA.phase = 'compete'; R(); });
  await red.calma(2500);
  await mesa.evaluate(() => overrideResult(1, 'sq', 0, 'g'));
  await red.calma(3500);
  await mesa.evaluate(() => changeResult(1, 'sq', 0, 'n'));
  await red.calma(3500);
  const rutasMesa = [...new Set(red.log.filter(x => x.quien === 'mesa').map(x => x.ruta))];
  ok(!rutasMesa.some(r => /abierto__/.test(r)), 'la mesa no escribe ninguna copia aparte (escribió: ' + rutasMesa.join(', ') + ')');
  const s = red.leer('livecast_sync/' + EV.canal);
  const a1 = JSON.parse(s.athletes).find(a => a.id === 1);
  ok(a1 && a1.att.sq[0].r === 'n', 'el documento en vivo trae el intento recién corregido (válido → nulo)');
  ok(!/11111111|2000-01-01|01\/01\/2000|x@y\.cl|\+569/.test(s.athletes), 'y no lleva RUT, fecha de nacimiento, correo ni teléfono, aunque la nómina los traiga');
  const leido = await publico.evaluate(async (ruta) => {
    const [c, d] = ruta.split('/');
    const snap = await window._fb.getDoc(window._fb.doc(fbDB, c, d));
    return snap.exists() ? JSON.parse(snap.data().athletes).length : -1;
  }, 'livecast_sync/' + EV.canal);
  ok(leido === 6, 'el público lo lee sin cuenta');

  console.log('\nLa pestaña del público');
  const pg = await publico.evaluate(() => {
    go('datosAbiertos');
    return { t: document.body.innerText, url: (document.getElementById('daUrl') || {}).textContent || '', canal: fbDocId(),
      lado: [...document.querySelectorAll('.side-label')].map(x => x.textContent.trim()),
      boton: [...document.querySelectorAll('.side-btn')].some(x => /Datos abiertos/.test(x.textContent) && x.classList.contains('active')) };
  });
  ok(pg.lado.includes('Para desarrolladores'), 'sección aparte en el menú: "Para desarrolladores"');
  ok(pg.boton, 'con su pestaña "Datos abiertos", marcada al abrirla');
  ok(/DATOS ABIERTOS/.test(pg.t) && pg.url.includes('/documents/livecast_sync/' + encodeURIComponent(pg.canal) + '?key='), 'muestra el enlace al documento en vivo del campeonato');
  ok(/Copiar/.test(pg.t) && /Abrir/.test(pg.t), 'con Copiar y Abrir');

  console.log('\nLas reglas');
  const reglas = fs.readFileSync(__dirname + '/../reglas/firestore.rules', 'utf8');
  ok(/match \/livecast_sync\/\{doc\}\s*\{\s*allow read: if true; allow write: if isAdmin\(\) \|\| esEnsayo\(doc\); \}/.test(reglas),
    'livecast_sync se lee sin cuenta y solo la mesa escribe');

  console.log('\nLa política de privacidad lo cuenta');
  const sitio = fs.readFileSync(__dirname + '/../sitio/interfaz.js', 'utf8');
  ok(/datos abiertos/.test(sitio) && /peso corporal/.test(sitio), 'menciona los datos abiertos y el peso corporal');

  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? '\n' + fallas + ' FALLA(S)' : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

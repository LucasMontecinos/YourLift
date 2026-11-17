// Datos abiertos: la copia pública de solo lectura de la competencia en vivo,
// con formato fijo, para que otras apps (por ejemplo un asistente para
// entrenadores) la lean sin depender del formato interno del livecast.
//
// Lo que se cuida:
//   · el formato: los campos documentados y nada más, con los intentos como
//     { peso, resultado } y "valido"/"nulo"/null;
//   · que NO salga nada privado ni de la operación (RUT, nacimiento, código,
//     contactos, fotos, racks), aunque el atleta lo traiga;
//   · que "en tarima" y "siguiente" sean los de la cola de la tarima, también
//     con un cuarto intento y con una pantalla en vista libre;
//   · que la mesa lo escriba en livecast_sync/abierto__{id} al cargar un
//     intento, que solo escriba si cambió algo y que el público no escriba;
//   · que la pestaña "Datos abiertos" del público muestre el enlace;
//   · y que las reglas sigan dejando leer esa colección sin cuenta.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_datosabiertos.js
const { chromium } = require('playwright');
const fs = require('fs');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026',
  canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };
const DOC = 'livecast_sync/abierto__' + EV.id;

function atletas() {
  const nueve = (s) => ({ sq: [{ w: 100 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }],
    bp: [{ w: 60 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
  return [1, 2, 3, 4, 5, 6].map(i => ({ id: i, lot: i, name: 'Atleta Prueba ' + i, flight: 'A', sex: i % 2 ? 'Hombre' : 'Mujer', cat: i % 2 ? '83' : '63', div: 'Open',
    mod: 'classic', bw: 80 + i / 10, club: 'Club ' + i, att: nueve(i * 2.5),
    // cosas que nunca deben salir
    rut: '11111111-1', dob: '2000-01-01', fechaNac: '01/01/2000', born: 2000, codigo: 'YL-0000' + i, correo: 'x@y.cl', telefono: '+56900000000', rackSQ: 12, foto: 'https://x/y.jpg' }));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const errs = [];

  console.log('\nEl formato, armado en la página');
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('formato: ' + e.message));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=suda2026_fesupo_full`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof _daArmar === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
    await p.waitForTimeout(800);
    const r = await p.evaluate((L) => {
      DATA.athletes = L; DATA.flight = 'A'; DATA.lift = 'sq'; DATA.round = 0; DATA.forcedCurrent = null;
      DATA.event = Object.assign({}, DATA.event, { id: 'regional_centro_2026', name: 'Regional de prueba', date: '2026-11-21', location: 'Maipú' });
      const a1 = DATA.athletes.find(a => a.id === 1);
      a1.att.sq[0] = { w: 102.5, r: 'g' }; a1.att.sq[1] = { w: 110, r: 'n' }; a1.att.sq[2] = { w: 112.5, r: null };
      const q = liftQueue();
      const d = _daArmar();
      return { d, q: q.slice(0, 2).map(c => ({ id: c.id, i: curAtt(c), w: c.att.sq[curAtt(c)].w })), id: _daId(), url: _daUrl(_daId()), puede: _daPuedeEscribir() };
    }, atletas());
    const d = r.d;
    ok(d.formato === 'yourlift-vivo/1', 'formato yourlift-vivo/1');
    ok(r.id === 'abierto__regional_centro_2026', 'el documento se llama abierto__{id del campeonato} (' + r.id + ')');
    ok(r.url.includes('/documents/livecast_sync/abierto__regional_centro_2026?key='), 'el enlace apunta a ese documento');
    ok(d.campeonato.id === 'regional_centro_2026' && d.campeonato.nombre === 'Regional de prueba' && d.campeonato.fecha === '2026-11-21' && d.campeonato.lugar === 'Maipú' && d.campeonato.tarima === null,
      'campeonato: id, nombre, fecha, lugar y tarima');
    ok(d.atletas.length === 6, 'están los 6 atletas');
    const claves = ['id', 'nombre', 'club', 'sexo', 'division', 'categoria', 'modalidad', 'peso_corporal', 'dia', 'tanda', 'lote', 'intentos'];
    ok(d.atletas.every(a => JSON.stringify(Object.keys(a)) === JSON.stringify(claves)), 'cada atleta trae exactamente los campos documentados');
    const texto = JSON.stringify(d);
    ok(!/11111111|2000-01-01|01\/01\/2000|YL-0000|x@y\.cl|\+569|x\/y\.jpg/.test(texto), 'no sale RUT, nacimiento, código, correo, teléfono ni foto');
    ok(!/"(rut|dob|fechaNac|born|codigo|correo|telefono|rackSQ|foto|att|cambios)"/.test(texto), 'ni sus campos internos');
    const a1 = d.atletas.find(a => a.id === 1);
    ok(a1.nombre === 'Atleta Prueba 1' && a1.club === 'Club 1' && a1.sexo === 'M' && a1.division === 'Open' && a1.categoria === '83' && a1.modalidad === 'classic'
      && a1.peso_corporal === 80.1 && a1.tanda === 'A' && a1.lote === 1, 'nómina: nombre, club, sexo, división, categoría, modalidad, peso, tanda y lote');
    ok(JSON.stringify(a1.intentos.sq) === JSON.stringify([{ peso: 102.5, resultado: 'valido' }, { peso: 110, resultado: 'nulo' }, { peso: 112.5, resultado: null }]),
      'intentos: peso y válido / nulo / sin juzgar');
    ok(JSON.stringify(a1.intentos.bp[1]) === JSON.stringify({ peso: null, resultado: null }), 'un intento no pedido va con peso null');
    ok(d.tanda_activa.tanda === 'A' && d.tanda_activa.movimiento === 'sq' && d.tanda_activa.ronda === 1, 'tanda activa: tanda, movimiento y ronda (1 a 3)');
    ok(d.en_tarima && d.en_tarima.atleta_id === r.q[0].id && d.en_tarima.intento === r.q[0].i + 1 && d.en_tarima.peso === r.q[0].w,
      'en tarima: el primero de la cola (' + JSON.stringify(d.en_tarima) + ')');
    ok(d.siguiente && d.siguiente.atleta_id === r.q[1].id, 'siguiente: el segundo de la cola');
    ok(!r.puede, 'el público no puede escribir');

    // Cuarto intento y vista libre
    const r2 = await p.evaluate(() => {
      const a2 = DATA.athletes.find(a => a.id === 2);
      a2.att.sq[3] = { w: 140, r: null, extra: true, mode: 'self', grantedRound: 0 };
      const d1 = _daArmar();
      const c2 = d1.atletas.find(a => a.id === 2).intentos.sq;
      // vista libre: esta pantalla mira el banco, la tarima sigue en sentadilla
      window.NAV_LIBRE = true; window._NAV_REMOTA = { flight: 'A', lift: 'sq', round: 0, forcedCurrent: null };
      DATA.lift = 'bp';
      const d2 = _daArmar();
      window.NAV_LIBRE = false; DATA.lift = 'sq';
      return { c2, en1: d1.en_tarima, ta2: d2.tanda_activa, en2: d2.en_tarima };
    });
    ok(r2.c2.length === 4 && r2.c2[3].cuarto === true && r2.c2[3].peso === 140, 'un cuarto intento concedido va al final con "cuarto": true');
    ok(r2.en1 && r2.en1.atleta_id === 2 && r2.en1.intento === 4, 'y si es su turno, en tarima dice intento 4');
    ok(r2.ta2.movimiento === 'sq' && r2.en2 && r2.en2.movimiento === 'sq', 'con vista libre manda lo de la tarima, no lo que mira la pantalla');

    console.log('\nLa pestaña del público');
    const pg = await p.evaluate(() => {
      const side = document.body.innerText.includes('Para desarrolladores') || true;
      go('datosAbiertos');
      const t = document.body.innerText;
      return { t, url: (document.getElementById('daUrl') || {}).textContent || '', side,
        lado: [...document.querySelectorAll('.side-label')].map(x => x.textContent.trim()), boton: [...document.querySelectorAll('.side-btn')].some(x => /Datos abiertos/.test(x.textContent) && x.classList.contains('active')) };
    });
    ok(pg.lado.includes('Para desarrolladores'), 'sección aparte en el menú: "Para desarrolladores"');
    ok(pg.boton, 'con su pestaña "Datos abiertos", marcada al abrirla');
    ok(/DATOS ABIERTOS/.test(pg.t) && pg.url.includes('abierto__regional_centro_2026'), 'la página muestra el enlace del campeonato');
    ok(/EN TIEMPO REAL/.test(pg.t) && /onSnapshot/.test(pg.t) && /QUÉ TRAE/.test(pg.t) && /USO RESPONSABLE/.test(pg.t), 'con el ejemplo en tiempo real, los campos y el uso responsable');
    await ctx.close();
  }

  console.log('\nLa mesa lo publica (red simulada)');
  {
    const red = crearRed({ subida: [200, 600], bajada: [100, 500] });
    red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas().map(a => { const { rut, dob, fechaNac, correo, telefono, ...x } = a; return x; })),
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
    let s = red.leer(DOC);
    ok(!!s, 'al cargar un intento aparece ' + DOC);
    if (s) {
      ok(s.formato === 'yourlift-vivo/1' && typeof s.actualizado === 'number' && typeof s.datos === 'string', 'con formato, actualizado y datos (texto JSON)');
      const v = JSON.parse(s.datos);
      ok(/^\d{4}-\d\d-\d\dT/.test(v.actualizado), 'datos.actualizado en ISO');
      ok(v.atletas.find(a => a.id === 1).intentos.sq[0].resultado === 'valido', 'trae el válido recién cargado');
      ok(v.en_tarima && v.en_tarima.atleta_id === 2, 'y en tarima ya está el siguiente (' + JSON.stringify(v.en_tarima) + ')');
      ok(!/11111111|YL-0000|"codigo"|"born"/.test(s.datos), 'sin datos privados ni el código del atleta');
    }
    await mesa.evaluate(() => changeResult(1, 'sq', 0, 'n'));
    await red.calma(3500);
    s = red.leer(DOC);
    ok(s && JSON.parse(s.datos).atletas.find(a => a.id === 1).intentos.sq[0].resultado === 'nulo', 'una corrección (válido → nulo) se actualiza');
    const escrituras = () => red.log.filter(x => x.ruta === DOC);
    const antes = escrituras().length;
    await mesa.evaluate(() => _daEscribir());
    await red.calma(1500);
    ok(escrituras().length === antes, 'si no cambió nada, no vuelve a escribir');
    ok(escrituras().every(x => x.quien === 'mesa'), 'solo la mesa lo escribe (el público no)');
    // El público puede leerlo
    const leido = await publico.evaluate(async (ruta) => {
      const [c, d] = ruta.split('/');
      const snap = await window._fb.getDoc(window._fb.doc(fbDB, c, d));
      return snap.exists() ? JSON.parse(snap.data().datos).atletas.length : -1;
    }, DOC);
    ok(leido === 6, 'el público lo lee sin cuenta');
  }

  console.log('\nLas reglas');
  const reglas = fs.readFileSync(__dirname + '/../reglas/firestore.rules', 'utf8');
  ok(/match \/livecast_sync\/\{doc\}\s*\{\s*allow read: if true; allow write: if isAdmin\(\) \|\| esEnsayo\(doc\); \}/.test(reglas),
    'livecast_sync se lee sin cuenta y solo la mesa escribe: no hay reglas nuevas que publicar');

  console.log('\nLa política de privacidad lo cuenta');
  const sitio = fs.readFileSync(__dirname + '/../sitio/interfaz.js', 'utf8');
  ok(/datos abiertos/.test(sitio) && /peso corporal/.test(sitio), 'menciona los datos abiertos y el peso corporal');

  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? '\n' + fallas + ' FALLA(S)' : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

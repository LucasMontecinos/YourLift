// Campeonato abierto: el que no es de la federación (la Copa Panda, por ejemplo).
//
// Lo crea el admin en Campeonatos marcando "Campeonato abierto" y escribiendo lo
// que cobra y adónde se transfiere. Se inscribe cualquiera, con su propio
// formulario (inscripcion_abierta.html), y lo que importa es lo que NO pasa:
//   · no se pide RUT ni código de atleta;
//   · nada de lo que llega toca la base de atletas, el ranking ni los récords:
//     va a inscripciones_abiertas (sin datos personales) y _priv (lo demás);
//   · al cerrar la competencia, el livecast no publica sus resultados.
// Y lo que el formulario guarda tiene que caber en lo que aceptan las reglas,
// que usan listas cerradas: un campo de más bota la inscripción entera.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_abierto.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
const RAIZ = path.join(__dirname, '..');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const PROX = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 16);
const AYER = new Date(Date.now() - 864e5).toISOString().slice(0, 16);
// Datos de transferencia de mentira: los de verdad los escribe el admin.
const COPA = {
  id: 'copa_prueba_2026', name: 'Copa Prueba Clausura 2026', date: '2026-12-05', days: '5 y 6 de diciembre',
  location: 'Talca', status: 'open', preNominaCloseAt: PROX, abierto: true, organizers: [{ name: 'Club Organizador' }],
  ab: { reglamento: 'IPF', precio: 35000, polera: true, precioPolera: 43000, tallas: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    mods: ['Classic', 'Equipado'],
    pago: { titular: 'TITULAR DE PRUEBA', rut: '11.111.111-1', banco: 'Banco de Prueba', tipo: 'Cuenta Vista', numero: '000123456789', correo: 'pagos@ejemplo.cl' } },
};
const FED = { id: 'nac_2026', name: 'Nacional 2026', date: '2026-12-12', status: 'open' };

// Lo que aceptan las reglas, leído del archivo: así la prueba no se queda con una
// copia vieja de la lista.
const REGLAS = fs.readFileSync(path.join(RAIZ, 'reglas', 'firestore.rules'), 'utf8');
const hasOnly = fn => {
  const i = REGLAS.indexOf('function ' + fn);
  const m = REGLAS.slice(i).match(/hasOnly\(\[([^\]]+)\]\)/);
  return m ? m[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean) : [];
};
const bloque = k => { const i = REGLAS.indexOf('match /' + k); return i < 0 ? '' : REGLAS.slice(i, REGLAS.indexOf('\n    }', i)); };

console.log('\nUn abierto no pone récords (compartido/campeonatos.js)');
{
  globalThis.window = globalThis.window || globalThis;
  require('../compartido/campeonatos.js');
  ok(window.YLCampeonato.daRecordEvento({ name: 'Nacional 2026' }) === true, 'un Nacional de la federación sí');
  ok(window.YLCampeonato.daRecordEvento({ name: 'Nacional Abierto 2026', abierto: true, recordsNac: 'si' }) === false,
    'un abierto no, aunque se llame Nacional o lo marquen a mano');
}

console.log('\nLas reglas');
{
  const pub = bloque('inscripciones_abiertas/'), priv = bloque('inscripciones_abiertas_priv/');
  ok(/allow read: if isAdmin\(\);/.test(pub) && !/allow read: if true/.test(pub), 'inscripciones_abiertas: las lee el panel y el livecast, no el público');
  ok(/allow create: if \(isAdmin\(\) && creaSinPersonales\(\)\) \|\| inscAbiertaValida\(\);/.test(pub), 'y ni el admin le escribe datos personales');
  ok(/allow read: if veDatosPersonales\(\);/.test(priv), 'inscripciones_abiertas_priv: solo quien ve datos personales');
  const f = REGLAS.slice(REGLAS.indexOf('function campeonatoAbierto'), REGLAS.indexOf('function inscAbiertaValida'));
  ok(/get\('abierto', false\) == true/.test(f) && /get\('status', ''\) == 'open'/.test(f),
    'solo se acepta para un campeonato abierto y con inscripciones abiertas');
  ok(/getAfter\(\/databases\/\$\(database\)\/documents\/inscripciones_abiertas\/\$\(id\)\)\.data\.evento == request\.resource\.data\.evento/.test(REGLAS),
    'lo privado tiene que ir junto con lo público, del mismo campeonato');
  const pers = (REGLAS.match(/function camposPersonales\(\) \{\s*return \[([^\]]+)\]/) || [])[1] || '';
  const enPub = hasOnly('inscAbiertaValida');
  ok(enPub.length && !enPub.some(k => pers.includes("'" + k + "'")), 'la lista de lo público no tiene ningún campo personal');
  ok(!enPub.includes('rut') && !enPub.includes('codigo'), 'ni RUT ni código de atleta');
}

console.log('\nEl livecast');
{
  const nom = fs.readFileSync(path.join(RAIZ, 'livecast', 'nomina.js'), 'utf8');
  ok(/meta&&meta\.abierto\?'inscripciones_abiertas':'inscripciones'/.test(nom), 'carga la nómina de un abierto desde inscripciones_abiertas');
  const sinc = fs.readFileSync(path.join(RAIZ, 'livecast', 'sincronizacion.js'), 'utf8');
  ok(/abierto:e\.abierto===true/.test(sinc) && /DATA\.event\.abierto=true/.test(sinc), 'sabe qué campeonato es abierto');
  // cierre.js en una caja: si llega a escribir algo, se anota.
  const escrito = [], avisos = [];
  const ctx = {
    DATA: { event: { id: COPA.id, name: COPA.name, abierto: true }, athletes: [{ id: 0, name: 'Ana', bw: 60, att: {} }] },
    window: { _fb: { setDoc: async () => escrito.push(1), doc: () => ({}), serverTimestamp: () => 0 }, LIVE_EVENT_META: {} },
    fbDB: {}, alert: m => avisos.push(String(m)), confirm: () => { avisos.push('confirm'); return true; },
    showToastLC: () => {}, _isEnsayo: () => false, console,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'livecast', 'cierre.js'), 'utf8'), ctx);
  vm.runInContext('cerrarCompetenciaConfirm()', ctx);
  vm.runInContext(`cerrarCompetencia('${COPA.id}','${COPA.name}')`, ctx);
  ok(avisos.length === 1 && /CAMPEONATO ABIERTO/.test(avisos[0]) && !avisos.includes('confirm'),
    'al cerrar avisa que es abierto y no pregunta si publicar');
  ok(escrito.length === 0, 'y no escribe resultados (ni llamándolo directo)');
  ctx.DATA.event = { id: 'x', name: 'Otro' };
  ctx.window.LIVE_EVENT_META = { x: { abierto: true } };
  ok(vm.runInContext("_esAbierto('x')", ctx) === true, 'también lo reconoce por la lista de campeonatos');
}

console.log('\nLas nóminas públicas del sitio no lo muestran');
{
  const s = fs.readFileSync(path.join(RAIZ, 'sitio', 'nominas.js'), 'utf8');
  ok((s.match(/ev\.abierto!==true/g) || []).length >= 2, 'ni en la pestaña Nóminas ni en lo que escucha');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack || e)); try { await b.close(); } catch (x) {} process.exit(1); });

  async function pagina(url, fake, extra) {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    await p.addInitScript(([f, auth]) => { window.__FAKE = f; if (auth) window.__AUTH = auth; }, [fake, (extra && extra.auth) || null]);
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    return p;
  }
  const FAKE = { eventos: [COPA, FED], clubs: [{ id: 'nuevo', name: 'Club Nuevo Talca' }, { id: 'lt', name: 'Los Toros' }] };

  console.log('\nEl formulario');
  {
    const p = await pagina('inscripcion_abierta.html?ev=' + COPA.id, FAKE);
    await p.waitForFunction(() => document.querySelector('#app h1'), null, { timeout: 20000 });
    const t = await p.evaluate(() => document.getElementById('app').innerText);
    ok(/Copa Prueba Clausura 2026/.test(t) && /Talca/.test(t) && /IPF/.test(t) && /5 y 6 de diciembre/.test(t), 'muestra el campeonato: nombre, ciudad, fecha y reglamento');
    ok(/\$35\.000/.test(t) && /\$43\.000 con polera/.test(t), 'y lo que cuesta, con y sin polera');
    const labels = await p.evaluate(() => [...document.querySelectorAll('.field label')].map(l => l.textContent.toLowerCase()));
    ok(!labels.some(l => /\brut\b|c[oó]digo/.test(l)), 'no pide RUT ni código de atleta');
    for (const c of ['nombre completo', 'correo', 'teléfono', 'fecha de nacimiento', 'género', 'club', 'división', 'categoría', 'modalidad', '¿quieres polera?', 'comprobante'])
      ok(labels.some(l => l.includes(c)), 'pide ' + c);
    ok(await p.evaluate(() => !!document.querySelector('input[type=file][accept="image/*"]')), 'tiene dónde subir la foto del atleta');
    ok(/TITULAR DE PRUEBA/.test(t) && /000123456789/.test(t) && /Cuenta Vista/.test(t) && /pagos@ejemplo\.cl/.test(t), 'muestra los datos de transferencia junto al comprobante');
    const clubs = await p.evaluate(() => [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'Otro')).innerText);
    ok(/Los Toros/.test(clubs) && /Club Nuevo Talca/.test(clubs) && /Otro/.test(clubs) && (clubs.match(/Los Toros/g) || []).length === 1,
      'clubes: los de FECHIPO (más los de Firestore, sin repetir) y "Otro"');

    // La división la elige el atleta (la organización lo pidió así): las siete
    // de la IPF, sin calcularla ni cambiarla sola por la fecha de nacimiento.
    const d = await p.evaluate(() => {
      setCampo('fechaNac', '2008-03-10', true);
      const opciones = [...[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'Master IV')).options].map(o => o.value).filter(Boolean);
      return { todas: divisionesPosibles(), opciones, sola: _estado.f.division };
    });
    ok(d.todas.join() === 'Sub-Junior,Junior,Open,Master I,Master II,Master III,Master IV' && d.opciones.join() === d.todas.join(),
      'la división se elige de las siete de la IPF');
    ok(d.sola === '', 'y no se pone sola por la fecha de nacimiento');
    const c = await p.evaluate(() => {
      const r = {};
      setCampo('sexo', 'Masculino', true); setCampo('division', 'Open', true); r.hOpen = categoriasPosibles();
      setCampo('division', 'Sub-Junior', true); r.hSJ = categoriasPosibles();
      setCampo('sexo', 'Femenino', true); r.mSJ = categoriasPosibles();
      return r;
    });
    ok(!c.hOpen.includes('-53 kg') && c.hOpen.includes('+120 kg'), 'categorías IPF: -53 kg no es para Open');
    ok(c.hSJ.includes('-53 kg') && c.mSJ.includes('-43 kg') && c.mSJ.includes('+84 kg'), 'sí para Sub-Junior/Junior, y las de mujeres van por género');
    const tot = await p.evaluate(() => { const a = total(); setCampo('polera', 'si', true); const b = total();
      const txt = document.getElementById('app').innerText; return { a, b, txt }; });
    ok(tot.a === 35000 && tot.b === 43000 && /\$43\.000/.test(tot.txt), 'el total pasa de $35.000 a $43.000 al pedir polera');
    ok(/Talla/i.test(tot.txt) && ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'].every(x => new RegExp('\\b' + x + '\\b').test(tot.txt)), 'y entonces pide la talla, de S a XXXL');

    console.log('\n  Enviar incompleto no escribe nada');
    await p.evaluate(() => { window.__ESCRITO = []; });
    await p.click('#btnEnviar');
    const inc = await p.evaluate(() => ({ t: document.getElementById('app').innerText, w: window.__ESCRITO.length }));
    ok(/Falta completar/.test(inc.t) && /Foto del atleta/.test(inc.t) && /Comprobante/.test(inc.t), 'dice qué falta');
    ok(inc.w === 0, 'y no escribe nada');

    console.log('\n  Completo');
    await p.evaluate(() => {
      Object.assign(_estado.f, { nombre: 'María José Pérez Soto', correo: 'maria@ejemplo.cl', telefono: '+56 9 1111 2222',
        sexo: 'Femenino', fechaNac: '1995-06-01', club: 'Otro', clubOtro: 'Gimnasio Talca', division: 'Open',
        categoria: '-63 kg', modalidad: 'Classic', polera: 'si', talla: 'L' });
      _estado.consiente = true; render();
    });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await p.setInputFiles('input[aria-label="Foto del atleta"]', { name: 'yo.png', mimeType: 'image/png', buffer: png });
    await p.waitForFunction(() => _estado.archivos.fotoAtleta);
    await p.setInputFiles('input[aria-label="Comprobante de transferencia"]', { name: 'comprobante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
    await p.waitForFunction(() => _estado.archivos.comprobante);
    ok(await p.evaluate(() => faltantes().length === 0), 'no falta nada');
    await p.click('#btnEnviar');
    await p.waitForFunction(() => _estado.ok || _estado.error, null, { timeout: 10000 });
    const r = await p.evaluate(() => ({ ok: _estado.ok, err: _estado.error, w: window.__ESCRITO, t: document.getElementById('app').innerText }));
    ok(r.ok && /Inscripción enviada/.test(r.t), 'se envía' + (r.err ? ': ' + r.err : ''));
    const pub = r.w.find(x => x.col === 'inscripciones_abiertas'), priv = r.w.find(x => x.col === 'inscripciones_abiertas_priv');
    ok(r.w.every(x => x.col === 'inscripciones_abiertas' || x.col === 'inscripciones_abiertas_priv'),
      'escribe solo en sus colecciones: nada en inscripciones, padrón, debutantes ni rut_indice');
    ok(pub && priv && pub.id === priv.id && pub.id.length >= 16, 'lo público y lo privado van con el mismo id, al azar');
    const permitidoPub = hasOnly('inscAbiertaValida'), permitidoPriv = hasOnly('datosAbiertosValidos');
    ok(pub && Object.keys(pub.d).every(k => permitidoPub.includes(k)), 'lo público cabe en lo que aceptan las reglas: ' + (pub ? Object.keys(pub.d).filter(k => !permitidoPub.includes(k)).join(',') : ''));
    ok(priv && Object.keys(priv.d).every(k => permitidoPriv.includes(k)), 'lo privado también: ' + (priv ? Object.keys(priv.d).filter(k => !permitidoPriv.includes(k)).join(',') : ''));
    const txtPub = JSON.stringify(pub && pub.d);
    ok(pub && pub.d.evento === COPA.id && pub.d.status === 'pending' && pub.d.privacyConsent === true && pub.d.anioNac === '1995'
      && !/maria@|1111 2222|1995-06-01|storage:/.test(txtPub), 'lo público: sin correo, teléfono, fecha completa ni archivos (solo el año)');
    ok(pub && pub.d.club === 'Otro' && pub.d.clubOtro === 'Gimnasio Talca', 'el club escrito a mano va en clubOtro');
    ok(priv && priv.d.correo === 'maria@ejemplo.cl' && priv.d.fechaNac === '1995-06-01' && priv.d.polera === true && priv.d.talla === 'L' && priv.d.monto === 43000,
      'lo privado: correo, fecha, polera L y el monto ($43.000)');
    const docs = (priv && priv.d.docs) || {};
    ok(/^storage:athlete_files\/abierto_copa_prueba_2026\//.test(docs.fotoAtleta || '') && /^storage:athlete_files\/abierto_copa_prueba_2026\/.*\.pdf$/.test(docs.comprobante || ''),
      'la foto y el comprobante quedan en la carpeta privada, por ubicación (sin enlace)');
    ok(!/maria|perez|soto/i.test(JSON.stringify(docs)), 'y el nombre del archivo no lleva el nombre de la persona');
    ok(!p.errs.length, 'sin errores en la página' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
    await p.context().close();
  }

  console.log('\nCuándo no se puede');
  {
    let p = await pagina('inscripcion_abierta.html?ev=' + COPA.id, { eventos: [{ ...COPA, preNominaCloseAt: AYER }] });
    await p.waitForFunction(() => /cerraron/.test(document.getElementById('app').innerText), null, { timeout: 20000 }).catch(() => {});
    let t = await p.evaluate(() => document.getElementById('app').innerText);
    ok(/cerraron/.test(t) && !(await p.$('#btnEnviar')), 'pasado el cierre: lo dice y no muestra el formulario');
    await p.context().close();
    p = await pagina('inscripcion_abierta.html?ev=' + FED.id, { eventos: [FED] });
    await p.waitForFunction(() => /no disponible/.test(document.getElementById('app').innerText), null, { timeout: 20000 }).catch(() => {});
    t = await p.evaluate(() => document.getElementById('app').innerText);
    ok(/no disponible/.test(t), 'un campeonato de la federación no se inscribe por acá');
    await p.context().close();
    p = await pagina('inscripcion_abierta.html?ev=' + COPA.id + '&embedded=1', FAKE);
    await p.waitForFunction(() => document.querySelector('#app h1'), null, { timeout: 20000 });
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.hdr')).display === 'none'), 'dentro del sitio (embedded=1) no repite la barra de arriba');
    await p.context().close();
  }

  console.log('\nDesde el formulario de siempre');
  {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${PUERTO}/inscripcion.html?embedded=1`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof selectEvent === 'function' && typeof EVENTS !== 'undefined', null, { timeout: 20000 });
    const t = await p.evaluate(([c, f]) => { EVENTS.length = 0; EVENTS.push(c, f); state.step = 0; render(); return document.getElementById('app').innerText; }, [COPA, FED]);
    ok(/Abierto · sin RUT/i.test(t), 'el campeonato abierto sale marcado en la lista');
    await p.evaluate(f => selectEvent(f), FED.id);
    ok(await p.evaluate(f => state.form.evento === f && /inscripcion\.html/.test(location.pathname), FED.id), 'uno de la federación sigue en el formulario de siempre');
    await Promise.all([p.waitForURL(/inscripcion_abierta\.html/, { timeout: 10000 }).catch(() => {}), p.evaluate(c => selectEvent(c), COPA.id)]);
    ok(/inscripcion_abierta\.html\?ev=copa_prueba_2026&embedded=1$/.test(p.url()), 'el abierto lleva a su formulario (y sigue dentro del sitio)');
    await ctx.close();
  }

  console.log('\nEl panel');
  {
    const fake = {
      admins: [{ id: 'u1', role: 'owner', email: 'owner@correo.cl', nombre: 'Owner' }],
      eventos: [COPA, FED],
      inscripciones_abiertas: [
        { id: 'a1', evento: COPA.id, nombre: 'Ana Abierta', sexo: 'Femenino', anioNac: '1995', division: 'Open', categoria: '-63 kg', modalidad: 'Classic', club: 'Los Toros', status: 'pending', timestamp: { seconds: 1 } },
        { id: 'a2', evento: COPA.id, nombre: 'Beto Abierto', sexo: 'Masculino', anioNac: '1980', division: 'Master I', categoria: '-93 kg', modalidad: 'Equipado', club: 'Otro', clubOtro: 'Gimnasio Sur', status: 'approved', timestamp: { seconds: 2 } }],
      inscripciones_abiertas_priv: [
        { id: 'a1', evento: COPA.id, correo: 'ana@ejemplo.cl', telefono: '911112222', fechaNac: '1995-06-01', polera: true, talla: 'M', monto: 43000, docs: { fotoAtleta: 'storage:athlete_files/abierto_copa_prueba_2026/a1_fotoAtleta.jpg', comprobante: 'storage:athlete_files/abierto_copa_prueba_2026/a1_comprobante.pdf' } },
        { id: 'a2', evento: COPA.id, correo: 'beto@ejemplo.cl', telefono: '933334444', fechaNac: '1980-02-02', polera: false, talla: '', monto: 35000, docs: {} }],
      inscripciones: [], inscripciones_private: [],
    };
    const p = await pagina('admin.html', fake, { auth: { uid: 'u1', email: 'owner@correo.cl' } });
    await p.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo && document.querySelector('.side-btn') && (ST.eventos || []).length === 2, null, { timeout: 25000 });
    await p.evaluate(() => go('campeonatos'));
    await p.waitForTimeout(200);
    let t = await p.evaluate(() => document.getElementById('app').innerText);
    ok(/ABIERTO · FUERA DEL RANKING/.test(t) && /Ver inscritos/i.test(t), 'la tarjeta del campeonato dice que es abierto y lleva a sus inscritos');
    ok(await p.evaluate(() => !![...document.querySelectorAll('a')].find(a => /inscripcion_abierta\.html\?ev=copa_prueba_2026/.test(a.getAttribute('href') || ''))),
      'su "Formulario público" es el formulario abierto');
    await p.evaluate(id => abVer(id), COPA.id);
    await p.waitForFunction(() => Array.isArray(ST.abLista), null, { timeout: 10000 });
    t = await p.evaluate(() => document.getElementById('app').innerText);
    ok(/Ana Abierta/.test(t) && /Beto Abierto/.test(t) && /Gimnasio Sur/.test(t), 'lista a los inscritos (con el club escrito a mano)');
    ok(/ana@ejemplo\.cl/.test(t) && /Sí · M/.test(t) && /\$43\.000/.test(t), 'con su contacto, polera, talla y monto');
    ok(/RECAUDADO \(APROBADAS\)/i.test(t) && /\$35\.000/.test(t) && /M: 1/.test(t), 'y los totales: lo recaudado de las aprobadas y las poleras por talla');
    await p.evaluate(() => { window.__ESCRITO = []; return abEstado('a1', 'approved'); });
    const w = await p.evaluate(() => window.__ESCRITO);
    ok(w.some(x => x.col === 'inscripciones_abiertas' && x.id === 'a1' && x.d && x.d.status === 'approved'), 'aprobar cambia el estado');

    console.log('\n  Crear un campeonato abierto');
    await p.evaluate(() => { abCerrar(); newEvento(); });
    await p.waitForSelector('#ef_abierto');
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('ef_abBox')).display === 'none'), 'en "+ Nuevo campeonato" la opción viene apagada');
    await p.evaluate(() => { ST.eventoForm = null; render(); });
    ok(await p.evaluate(() => [...document.querySelectorAll('button')].some(x => /\+ Campeonato abierto/i.test(x.textContent) && /newEvento\(true\)/.test(x.getAttribute('onclick') || ''))),
      'la lista de campeonatos tiene su botón "+ Campeonato abierto"');
    await p.evaluate(() => newEvento(true));
    await p.waitForSelector('#ef_abierto');
    ok(await p.evaluate(() => document.getElementById('ef_abierto').checked && getComputedStyle(document.getElementById('ef_abBox')).display !== 'none'
      && /Abierto/i.test(document.querySelector('.h1').textContent)), 'que abre el formulario con la opción ya marcada y a la vista');
    ok(await p.evaluate(() => { const g = document.getElementById('ef_abierto'), n = document.getElementById('ef_date');
      return !!(g.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING); }), 'arriba en el formulario, antes de las fechas');
    await p.evaluate(() => { const c = document.getElementById('ef_abierto'); c.checked = false; c.dispatchEvent(new Event('change')); });
    await p.evaluate(() => {
      document.getElementById('ef_id').value = 'copa_panda_2026';
      document.getElementById('ef_name').value = 'Copa Panda Clausura 2026';
      document.getElementById('ef_location').value = 'Talca';
      document.getElementById('ef_date').value = '2026-12-05';
      document.getElementById('ef_days').value = '5 y 6 de diciembre';
      document.getElementById('ef_preNominaCloseAt').value = '2026-11-22T23:59';
      const c = document.getElementById('ef_abierto'); c.checked = true; c.dispatchEvent(new Event('change'));
      window.__ESCRITO = [];
    });
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('ef_abBox')).display !== 'none'), 'al marcarla aparecen precios, polera y datos de transferencia');
    ok(await p.evaluate(() => document.getElementById('ef_abPrecio').value === '35000' && document.getElementById('ef_abPrecioPolera').value === '43000'
      && document.getElementById('ef_abTallas').value === 'S, M, L, XL, XXL, XXXL' && document.getElementById('ef_abReg').value === 'IPF'),
      'trae de partida IPF, $35.000 / $43.000 y las tallas S a XXXL');
    await p.evaluate(() => saveEvento());
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => !(window.__ESCRITO || []).some(x => x.col === 'eventos')), 'sin datos de transferencia no se guarda');
    await p.evaluate(() => {
      const v = (id, x) => { document.getElementById(id).value = x; };
      v('ef_abTitular', 'TITULAR DE PRUEBA'); v('ef_abRut', '11.111.111-1'); v('ef_abBanco', 'Banco de Prueba');
      v('ef_abTipo', 'Cuenta Vista'); v('ef_abNumero', '000123456789'); v('ef_abCorreo', 'pagos@ejemplo.cl');
      v('ef_abPrecio', '35.000');
    });
    await p.evaluate(() => saveEvento());
    await p.waitForFunction(() => (window.__ESCRITO || []).some(x => x.col === 'eventos'), null, { timeout: 5000 }).catch(() => {});
    const ev = await p.evaluate(() => ((window.__ESCRITO || []).find(x => x.col === 'eventos') || {}).d || null);
    ok(ev && ev.abierto === true && ev.recordsEnabled === false, 'se guarda como abierto, sin récords');
    ok(ev && ev.ab && ev.ab.precio === 35000 && ev.ab.precioPolera === 43000 && ev.ab.polera === true && ev.ab.reglamento === 'IPF'
      && ev.ab.tallas.join() === 'S,M,L,XL,XXL,XXXL' && ev.ab.mods.join() === 'Classic,Equipado', 'con su configuración ("35.000" se lee como 35000)');
    ok(ev && ev.ab.pago.titular === 'TITULAR DE PRUEBA' && ev.ab.pago.numero === '000123456789' && ev.ab.pago.correo === 'pagos@ejemplo.cl', 'y los datos de transferencia');
    ok(ev && ev.preNominaCloseAt === '2026-11-22T23:59' && ev.location === 'Talca', 'el cierre de inscripciones es el de siempre (pre-nómina)');
    ok(!p.errs.length, 'sin errores en el panel' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
    await p.context().close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

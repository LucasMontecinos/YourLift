// Ley 21.719: lo que se lee sin sesión no trae datos personales.
//
// Antes cualquiera podía bajar, sin cuenta, las 770 inscripciones con el RUT, la
// fecha de nacimiento y la comuna de cada atleta (y el RUT en el id del
// documento), los entrenadores con sus correos, las ediciones del padrón con RUT
// y fecha, y fotos de perfil que eran enlaces a la carpeta privada de documentos.
// Ahora lo público identifica al atleta por su código y lo personal vive aparte,
// en colecciones que solo lee el panel. Se revisa:
//   · qué separa compartido/privacidad.js y qué piden las reglas;
//   · que el formulario de inscripción escriba así (y guarde los documentos por
//     ubicación, sin enlace);
//   · que "Editar mi inscripción" y la ficha del atleta funcionen sin RUT;
//   · que el panel junte lo privado para trabajar, y que la migración deje los
//     datos de antes sin nada personal a la vista.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_ley21719.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
const RAIZ = path.join(__dirname, '..');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

globalThis.window = globalThis.window || globalThis;
globalThis.localStorage = globalThis.localStorage || { getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, length: 0 };
require('../compartido/privacidad.js');
const P = window.YLPrivacidad;

const RUT_RE = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;
const MAIL_RE = /[^@\s"]+@[^@\s"]+\.[a-z]{2,}/i;
// Lo que se lee sin sesión. (rut_indice y entrenadores_indice van por RUT a
// propósito: se leen de a uno y no se listan.)
const PUBLICAS = ['inscripciones', 'atletas_pending', 'athlete_edits', 'atleta_fotos', 'competition_results',
  'cronograma', 'handlers', 'livecast_sync', 'livecast_flash', 'publico', 'inscripciones_entrenador', 'eventos'];
const PERS = P.INSC_PRIVADOS.concat(['correos']);

// Una escritura a una colección pública: ningún dato personal con valor (un
// campo personal en null es un deleteField(), o sea, se está borrando).
function revisarPublica(w) {
  const d = w.d || {};
  const malos = Object.keys(d).filter(k => PERS.includes(k) && d[k] !== null);
  const texto = JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !PERS.includes(k))));
  return { malos, rut: RUT_RE.test(texto) || RUT_RE.test(String(w.id || '')) || /_\d{8}[\dkK]$/i.test(String(w.id || '')), mail: MAIL_RE.test(texto) };
}

console.log('\nQué es público y qué no (compartido/privacidad.js)');
{
  const { pub, priv } = P.separarInscripcion({ evento: 'ev', nombre: 'Ana', codigo: '1543APS-2026', rut: '15.432.987-0',
    fechaNac: '1998-04-03', comuna: 'Talca', carnetName: 'carnet ana.jpg', declaraMayorFecha: '1998-04-03', club: 'X', status: 'pending' });
  ok(!PERS.some(k => k in pub) && pub.codigo && pub.club === 'X', 'lo público: sin RUT, fecha, comuna ni nombres de archivo');
  ok(pub.anioNac === '1998', 'con el año de nacimiento, para la división');
  ok(priv.rut && priv.fechaNac && priv.comuna && priv.carnetName && priv.declaraMayorFecha, 'lo privado lleva todo eso');
  ok(P.idInscripcion('ev', '1543aps-2026') === 'ev_1543APS-2026', 'el id de una inscripción es campeonato + código, no el RUT');
  ok(P.rutaArchivo('athlete_files/1/c.pdf') === 'storage:athlete_files/1/c.pdf' && P.rutaDe('storage:x/y') === 'x/y', 'un documento se guarda por su ubicación');
  const a = P.publico({ codigo: 'C', rut: '1-9', foto_url: 'https://x/o/athlete_files%2F154329870%2Fc.jpg?alt=media&token=t' });
  const b = P.publico({ codigo: 'C', foto_url: 'https://x/o/athlete_photos%2F154329870_17.jpg?alt=media' });
  const c = P.publico({ codigo: 'C', foto_url: 'https://x/o/athlete_photos%2FC_17.jpg?alt=media' });
  ok(!a.foto_url && !b.foto_url && c.foto_url, 'data.json no publica enlaces a documentos ni fotos con el RUT en el nombre');
}

console.log('\nLas reglas');
{
  const r = fs.readFileSync(path.join(RAIZ, 'reglas', 'firestore.rules'), 'utf8');
  const bloque = k => { const i = r.indexOf('match /' + k); return i < 0 ? '' : r.slice(i, r.indexOf('\n    }', i)); };
  const lista = (r.match(/function camposPersonales\(\) \{\s*return \[([^\]]+)\]/) || [])[1] || '';
  const enReglas = lista.split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
  ok(PERS.every(k => enReglas.includes(k)), 'la lista de campos personales de las reglas es la de compartido/privacidad.js');
  const ins = bloque('inscripciones/');
  ok(/allow read: if true;/.test(ins) && /isAdmin\(\) && creaSinPersonales\(\)/.test(ins) && /isAdmin\(\) && modificaSinPersonales\(\)/.test(ins),
    'inscripciones: pública, y ni el admin puede escribirle datos personales');
  ok(/codigo is string/.test(r.slice(r.indexOf('function inscripcionValida'), r.indexOf('match /inscripciones/'))),
    'el formulario público tiene que mandar el código de atleta');
  for (const c of ['inscripciones_private/', 'privado/', 'athlete_edits_priv/', 'cronograma_priv/', 'solicitudes_datos/', 'incidentes/'])
    ok(/allow read[^;]*: if veDatosPersonales\(\)/.test(bloque(c)), c + ' solo lo leen quienes ven datos personales');
  for (const c of ['entrenadores/', 'referees/'])
    ok(/allow read: if veDatosPersonales\(\);/.test(bloque(c)), c + ' ya no es de lectura pública');
  ok(/allow get: if true;/.test(bloque('entrenadores_indice/')) && /allow list: if isAdmin\(\);/.test(bloque('entrenadores_indice/')),
    'entrenadores_indice: se lee de a uno, no se lista');
  ok(/allow get: if true;/.test(bloque('inscripciones_entrenador/')) && /allow list: if veDatosPersonales\(\);/.test(bloque('inscripciones_entrenador/')),
    'inscripciones_entrenador: se lee de a uno (el id lleva el RUT), no se lista');
  ok(/hasOnly\(\['codigo', 'nuevo'\]\)/.test(bloque('rut_indice/')) && /allow list: if false;/.test(bloque('rut_indice/')),
    'rut_indice: solo el código, y no se lista');
  ok(/\['streaming', 'transmision', 'mesa', 'juez'\]/.test(r), 'las cuentas de competencia no ven datos personales');
  const s = fs.readFileSync(path.join(RAIZ, 'reglas', 'storage.rules'), 'utf8');
  const af = s.slice(s.indexOf('match /athlete_files/'), s.indexOf('\n    }', s.indexOf('match /athlete_files/')));
  ok(/allow get, list: if veDatosPersonales\(\);/.test(af) && !/allow get: if true/.test(af), 'Storage: los documentos no se abren sin ser admin');
  ok(/match \/athlete_photos\/\{file\} \{\s*allow get: if true;\s*allow list: if isAdmin\(\);/.test(s), 'Storage: las fotos se abren, pero la carpeta no se lista');
}

console.log('\nEl panel no carga Google Analytics; el sitio, sin señales publicitarias');
{
  ok(!/googletagmanager/.test(fs.readFileSync(path.join(RAIZ, 'admin.html'), 'utf8')), 'admin.html sin Google Analytics');
  ok(/allow_google_signals: false/.test(fs.readFileSync(path.join(RAIZ, 'compartido', 'consentimiento.js'), 'utf8')), 'Analytics sin señales de Google (compartido/consentimiento.js)');
}

const EV = { id: 'ev_ley', name: 'Campeonato Ley', status: 'open', date: '2026-12-05', closeDate: '2026-11-30' };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack || e)); try { await b.close(); } catch (x) {} process.exit(1); });
  const padron = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data.json'), 'utf8')).map(P.publico);

  async function pagina(url, fake, extra) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 1000 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    if (extra && extra.dataJson) await ctx.route(/\/data\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(extra.dataJson) }));
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    await p.addInitScript(([f, auth]) => { window.__FAKE = f; if (auth) window.__AUTH = auth; }, [fake, (extra && extra.auth) || null]);
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    return p;
  }

  console.log('\nInscripción de un atleta nuevo');
  {
    const p = await pagina('inscripcion.html', { eventos: [EV], inscripciones: [], atleta_fotos: [], rut_indice: [] }, { dataJson: padron });
    await p.waitForFunction(() => typeof firebaseReady !== 'undefined' && firebaseReady && EVENTS.length && athleteDB.length > 100, null, { timeout: 20000 });
    const r = await p.evaluate(async () => {
      Object.assign(state.form, { evento: 'ev_ley', nombre: 'Ana Prueba Soto', rut: '15432987-0', sexo: 'Femenino', fechaNac: '1998-04-03',
        division: 'Open', categoria: '63 kg', modalidad: 'Powerlifting Classic', club: 'Los Toros', zona: 'Sur', comuna: 'Punta Arenas',
        correo: 'ana@correo.cl', pin: '1234' });
      state.carnetFile = new File(['x'], 'carnet ana 15432987.pdf', { type: 'application/pdf' }); state.carnetName = state.carnetFile.name;
      state.wadeFile = new File(['x'], 'wada.pdf', { type: 'application/pdf' }); state.wadeName = 'wada.pdf';
      state.privacyConsent = true;
      autoFillCode();
      await submitForm();
      return { err: state.error, view: state.view, cod: state.form.codigo, esc: window.__ESCRITO || [], lec: window.__LEC || [] };
    });
    ok(!r.err && r.view === 'confirm', 'se envía' + (r.err ? ': ' + r.err : ''));
    const de = (col, id) => r.esc.find(w => w.col === col && (!id || w.id === id));
    const pub = de('inscripciones'), priv = de('inscripciones_private');
    ok(pub && pub.id === 'ev_ley_' + r.cod && /^1543APS-\d{4}$/.test(r.cod), 'id = campeonato + código: ' + (pub && pub.id));
    const rv = revisarPublica(pub || {});
    ok(pub && !rv.malos.length && !rv.rut && !rv.mail && pub.d.codigo === r.cod && pub.d.anioNac === '1998',
      'la inscripción pública: código y año, sin RUT, fecha, comuna, correo ni nombres de archivo' + (rv.malos.length ? ' (trae ' + rv.malos.join(', ') + ')' : ''));
    ok(priv && priv.id === pub.id && priv.d.rut === '15432987-0' && priv.d.fechaNac === '1998-04-03' && priv.d.comuna === 'Punta Arenas'
      && priv.d.carnetName && priv.d.pin === '1234' && priv.d.correo === 'ana@correo.cl', 'la privada, con el mismo id, lleva todo eso');
    ok(priv && /^storage:athlete_files\/154329870\//.test(priv.d.carnetURL || '') && /^storage:/.test(priv.d.wadeURL || ''),
      'los documentos quedan por ubicación, sin enlace de descarga');
    const pend = de('atletas_pending'), pendPriv = de('atletas_pending_priv'), ix = de('rut_indice');
    ok(pend && pend.id === r.cod && !revisarPublica(pend).malos.length && pend.d.anioNac === '1998', 'el debutante, público por código y sin RUT ni fecha');
    ok(pendPriv && pendPriv.id === r.cod && pendPriv.d.rut === '15432987-0', 'su RUT y fecha, aparte');
    ok(ix && ix.id === '154329870' && JSON.stringify(Object.keys(ix.d).sort()) === '["codigo","nuevo"]' && ix.d.codigo === r.cod,
      'y el índice por RUT con solo su código, para reconocerlo la próxima vez');
    ok(!r.lec.some(l => (l.filtros || []).some(f => f.campo === 'rut')), 'nunca busca por RUT en lo público');
    ok(!p.errs.length, 'sin errores de página' + (p.errs.length ? ': ' + p.errs[0] : ''));
    await p.context().close();
  }

  console.log('\nEditar mi inscripción, sin RUT en lo público');
  {
    const p = await pagina('inscripcion.html', { eventos: [EV], rut_indice: [{ id: '123456785', codigo: '1234JPX-2020' }],
      inscripciones: [{ id: 'ev_ley_1234JPX-2020', codigo: '1234JPX-2020', evento: 'ev_ley', status: 'approved', nombre: 'Juan Prueba', categoria: '83 kg' }] },
      { dataJson: padron });
    await p.waitForFunction(() => typeof firebaseReady !== 'undefined' && firebaseReady && EVENTS.length, null, { timeout: 20000 });
    const r = await p.evaluate(async () => {
      document.body.insertAdjacentHTML('beforeend', '<input id="editRut" value="12.345.678-5"><input id="editPin" value="4321">');
      await lookupEdit();
      return { id: state.editId, err: state.error, rut: state.form.rut, fecha: state.form.fechaNac, lec: (window.__LEC || []) };
    });
    ok(r.id === 'ev_ley_1234JPX-2020', 'encuentra la inscripción por el código que da rut_indice' + (r.err ? ' — ' + r.err : ''));
    ok(r.lec.some(l => l.col === 'rut_indice' && l.op === 'getDoc') && r.lec.some(l => l.col === 'inscripciones' && (l.filtros || []).some(f => f.campo === 'codigo'))
      && !r.lec.some(l => (l.filtros || []).some(f => f.campo === 'rut')), 'pregunta a rut_indice de a uno y busca por código');
    ok(r.fecha === '', 'la fecha de nacimiento no se muestra (no es pública): solo se escribe si hay que corregirla');
    await p.context().close();
  }

  console.log('\nLa ficha del atleta, desde las copias públicas');
  {
    const a = padron.find(x => x.codigo && (x.competencias || []).length);
    const p = await pagina('atleta.html?codigo=' + encodeURIComponent(a.codigo), {
      eventos: [], inscripciones: [], atleta_fotos: [], atletas_pending: [], athlete_edits: [], competition_results: [],
      publico: [{ id: 'entrenadores', lista: [{ codigoAtleta: a.codigo, categoria: 'Nivel 2', nombre: a.nombre, club: '' }] },
                { id: 'jueces', lista: [{ codigoAtleta: a.codigo, categoria: '1', ambito: 'nacional' }] }],
    }, { dataJson: padron });
    await p.waitForFunction(() => /JUEZ NACIONAL CAT I\b/.test(document.body.innerText) && /ENTRENADOR CAT II/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
    const r = await p.evaluate(() => ({ t: document.body.innerText, lec: window.__LEC || [] }));
    ok(/ENTRENADOR CAT II/.test(r.t) && /JUEZ NACIONAL CAT I\b/.test(r.t), 'la insignia de entrenador y de juez sale de publico/, por código');
    ok(!r.lec.some(l => l.col === 'entrenadores' || l.col === 'referees'), 'no lee las bases de entrenadores ni de jueces (ya no son públicas)');
    ok(!r.lec.some(l => (l.filtros || []).some(f => f.campo === 'rut')), 'ni busca nada por RUT');
    ok(!p.errs.length, 'sin errores de página' + (p.errs.length ? ': ' + p.errs[0] : ''));
    await p.context().close();
  }

  console.log('\nEl panel: junta lo privado y migra lo de antes');
  {
    const J = 'ev_ley_123456785', N = 'ev_ley_1543APS-2026', COD = '1234JPX-2020';
    const URL_DOC = 'https://firebasestorage.googleapis.com/v0/b/b/o/athlete_files%2F123456785%2FcarnetPhoto_1.webp?alt=media&token=t';
    const hace = d => Date.now() - d * 86400000;
    const fake = {
      admins: [{ id: 'u1', role: 'owner', email: 'owner@correo.cl', nombre: 'Owner' }],
      eventos: [EV],
      privado: [{ id: 'padron', atletas: { [COD]: { rut: '12.345.678-5', fechaNac: '02/01/1990' } } }],
      inscripciones: [
        { id: J, evento: 'ev_ley', nombre: 'Juan Prueba', rut: '12.345.678-5', fechaNac: '1990-01-02', comuna: 'Talca', codigo: COD, status: 'approved', carnetName: 'carnet juan.jpg' },
        { id: N, evento: 'ev_ley', nombre: 'Ana Prueba Soto', codigo: '1543APS-2026', anioNac: '1998', status: 'pending' }],
      inscripciones_private: [
        { id: J, pin: '1111', rut: '12.345.678-5', correo: 'juan@correo.cl', carnetURL: URL_DOC },
        { id: N, pin: '2222', rut: '15.432.987-0', fechaNac: '1998-04-03', carnetURL: 'storage:athlete_files/154329870/carnet_1.pdf' }],
      edit_requests: [{ id: 'er1', inscripcionId: J, rut: '12.345.678-5', pin: '1111', changes: {}, status: 'pending' }],
      atletas_pending: [{ id: '154329870', nombre: 'Ana Prueba Soto', rut: '15.432.987-0', codigo: '1543APS-2026', fechaNac: '1998-04-03', sexo: 'Femenino', debut: true }],
      athlete_edits: [{ id: 'rut_123456785', rut: '12.345.678-5', codigo: COD, nombre: 'Juan Prueba', fechaNac: '02/01/1990', ts: 1 }],
      atleta_fotos: [{ id: COD, codigo: COD, rut: '12.345.678-5', foto_url: URL_DOC, source_url: URL_DOC, approved_by: 'admin@correo.cl', status: 'approved' }],
      competition_results: [{ id: 'ev_ley_' + COD + '_meet', codigo: COD, rut: '12.345.678-5', addedBy: 'admin@correo.cl', evento: 'Campeonato Ley' }],
      cronograma: [{ id: 'ev_ley', rows: [{ nombre: 'Juan Prueba', rut: '12.345.678-5', handler1: { nombre: 'Hugo', correo: 'hugo@correo.cl' }, handler2: { nombre: '', correo: '' } }] }],
      livecast_sync: [{ id: 'ev_ley', athletes: JSON.stringify([{ id: 0, name: 'Juan Prueba', rut: '12.345.678-5', dob: '1990-01-02', codigo: COD }]), event: { name: 'Campeonato Ley' } }],
      entrenadores: [{ id: '12.345.678-5', nombre: 'Juan Prueba', rut: '12.345.678-5', correos: ['juan@correo.cl'], club: 'Los Toros', categoria: 'Nivel 1', codigoAtleta: COD, acreditaciones: [{ vence: '2030-01' }] }],
      referees: [{ id: '123456785', nombre: 'Juan Prueba', rut: '12.345.678-5', categoria: '2', ambito: 'nacional', codigoAtleta: COD }],
      solicitudes_datos: [{ id: 'sol_1', tipo: 'acceso', nombre: 'Juan Prueba', rut: '12.345.678-5', correo: 'juan@correo.cl', detalle: '', status: 'recibida', ts: hace(40) }],
    };
    const dj = [{ codigo: COD, nombre: 'Juan Prueba', club: 'Los Toros', anioNac: '1990', sexo: 'M', competencias: [{ evento: 'Viejo', fecha: '2019-05-01' }] }];
    const p = await pagina('admin.html', fake, { dataJson: dj, auth: { uid: 'u1', email: 'owner@correo.cl' } });
    await p.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo && typeof window.pdMigracionRevisar === 'function'
      && document.querySelector('.side-btn') && (ST.inscripciones || []).length === 2 && ST.inscripcionesPrivate, null, { timeout: 25000 });
    await p.waitForTimeout(400);
    const m = await p.evaluate(n => { const i = ST.inscripciones.find(x => x.id === n) || {}; return { rut: i.rut, fecha: i.fechaNac,
      doc: (ST.inscripcionesPrivate[n] || {}).carnetURL, boton: [...document.querySelectorAll('.side-btn')].some(x => /Protección de datos/.test(x.textContent)) }; }, N);
    ok(m.rut === '15.432.987-0' && m.fecha === '1998-04-03', 'ST.inscripciones trae el RUT y la fecha desde inscripciones_private');
    ok(!/^storage:/.test(m.doc || ''), 'el documento guardado por ubicación se cambia por su enlace, para abrirlo');
    ok(m.boton, 'el Owner tiene "Protección de datos" en el menú');
    await p.evaluate(() => go('proteccion'));
    await p.waitForTimeout(300);
    const t = await p.evaluate(() => document.getElementById('app').innerText);
    ok(/SOLICITUDES ABIERTAS/.test(t) && /1 fuera de plazo/.test(t), 'la pantalla avisa la solicitud fuera de plazo (30 días)');
    await p.evaluate(() => { window.__ESCRITO = []; pdMigracionRevisar(); });
    await p.waitForFunction(() => ST.pdMig && (ST.pdMig.plan || ST.pdMig.error), null, { timeout: 15000 });
    const res = await p.evaluate(() => ST.pdMig.plan ? ST.pdMig.plan.resumen : { error: ST.pdMig.error });
    ok(!res.error && res['Inscripciones con el RUT en el id (se renombran)'] === 1 && res['Debutantes con RUT y fecha a la vista'] === 1
      && res['Ediciones con el RUT en el id (se renombran)'] === 1 && res['Cronogramas con RUT o correos'] === 1, 'la revisión cuenta lo que hay que arreglar' + (res.error ? ': ' + res.error : ''));
    ok(await p.evaluate(() => (window.__ESCRITO || []).length === 0), 'revisar no escribe nada');
    await p.evaluate(() => pdMigracionAplicar());
    await p.waitForFunction(() => ST.pdMig && (ST.pdMig.hecho || ST.pdMig.error), null, { timeout: 30000 });
    const r = await p.evaluate(() => ({ estado: ST.pdMig, esc: window.__ESCRITO || [] }));
    ok(r.estado.hecho, 'la migración termina' + (r.estado.error ? ': ' + r.estado.error : ''));
    const w = r.esc;
    const pubW = w.filter(x => PUBLICAS.includes(x.col) && x.op !== 'delete');
    const malas = pubW.map(x => ({ x, v: revisarPublica(x) })).filter(o => o.v.malos.length || o.v.rut || o.v.mail);
    ok(pubW.length > 8 && !malas.length, pubW.length + ' escrituras a colecciones públicas, ninguna con RUT, fechas, correos ni RUT en el id'
      + (malas.length ? ' — ' + malas.slice(0, 3).map(o => o.x.col + '/' + o.x.id + ' ' + JSON.stringify(o.v)).join(' · ') : ''));
    const hay = (op, col, id) => w.some(x => x.op === op && x.col === col && (typeof id === 'function' ? id(x) : x.id === id));
    ok(hay('set', 'inscripciones', 'ev_ley_' + COD) && hay('delete', 'inscripciones', J) && hay('delete', 'inscripciones_private', J),
      'la inscripción con el RUT en el id pasa a campeonato + código');
    ok(hay('set', 'inscripciones_private', x => x.id === 'ev_ley_' + COD && x.d.rut && x.d.comuna === 'Talca' && x.d.pin === '1111' && x.d.carnetName),
      'y lo suyo privado, completo, a la privada nueva');
    ok(hay('update', 'edit_requests', x => x.id === 'er1' && x.d.inscripcionId === 'ev_ley_' + COD), 'su solicitud de edición apunta a la nueva');
    ok(hay('set', 'atletas_pending', '1543APS-2026') && hay('set', 'atletas_pending_priv', x => x.id === '1543APS-2026' && x.d.rut) && hay('delete', 'atletas_pending', '154329870'),
      'el debutante pasa a su código; RUT y fecha aparte');
    ok(hay('set', 'athlete_edits', x => /^ed_/.test(x.id)) && hay('delete', 'athlete_edits', 'rut_123456785') && hay('set', 'athlete_edits_priv', x => /^ed_/.test(x.id) && x.d.rut),
      'la edición con el RUT en el id se renombra, y su RUT y fecha van aparte');
    ok(hay('update', 'atleta_fotos', x => x.id === COD && x.d.rut === null && x.d.approved_by === '' && x.d.source_url === null && /^h/.test(x.d.source_ref || '')),
      'la foto pierde el RUT, el correo de quien la aprobó y el enlace a la carpeta de documentos');
    ok(hay('update', 'competition_results', x => x.d.rut === null && x.d.addedBy === ''), 'el resultado pierde el RUT y el correo');
    ok(hay('set', 'cronograma_priv', x => x.id === 'ev_ley' && JSON.stringify(x.d).includes('hugo@correo.cl')), 'los correos de handlers pasan a cronograma_priv');
    ok(hay('update', 'livecast_sync', x => x.d.athletes && !/rut|dob/.test(x.d.athletes) && /1234JPX/.test(x.d.athletes)), 'la nómina del livecast queda sin RUT ni fecha');
    const ix = w.filter(x => x.col === 'rut_indice');
    ok(ix.length && ix.every(x => JSON.stringify(Object.keys(x.d)) === '["codigo"]'), 'el índice por RUT se reescribe con solo el código');
    ok(hay('set', 'publico', x => x.id === 'entrenadores' && (x.d.lista || [])[0] && x.d.lista[0].codigoAtleta === COD && !JSON.stringify(x.d).includes('@')),
      'se publica la copia de entrenadores, sin RUT ni correos');
    ok(hay('set', 'entrenadores_indice', x => x.id === '123456785' && x.d.nombre === 'Juan Prueba' && !JSON.stringify(x.d).includes('@')),
      'y el índice para que el formulario de entrenador lo reconozca por su RUT');
    ok(hay('set', 'publico', x => x.id === 'jueces' && (x.d.lista || [])[0] && x.d.lista[0].codigoAtleta === COD), 'y la de jueces, por código');
    ok(hay('set', 'config', 'ley21719'), 'queda anotado que se migró');
    ok(!p.errs.length, 'sin errores de página' + (p.errs.length ? ': ' + p.errs[0] : ''));
    if (process.env.FOTO) { await p.evaluate(() => { ST.pdTab = 'resumen'; render(); }); await p.waitForTimeout(200); await p.screenshot({ path: process.env.FOTO, fullPage: true }); }
    await p.context().close();
  }

  console.log('\nLa política de privacidad y el formulario de solicitudes');
  {
    const p = await pagina('index.html#privacidad', { eventos: [] }, { dataJson: padron });
    await p.waitForFunction(() => /POLÍTICA DE/.test(document.body.innerText) && document.getElementById('sd_nombre'), null, { timeout: 20000 });
    const t = await p.evaluate(() => document.body.innerText);
    ok(/Federación Chilena de Powerlifting \(FECHIPO\)/.test(t) && /YourLift SpA/.test(t) && /21\.719/.test(t), 'dice quién es responsable (FECHIPO) y quién opera (YourLift SpA)');
    ok(/DÓNDE ESTÁ/.test(t) && /QUIÉN LO VE/.test(t) && /CUÁNTO TIEMPO/.test(t) && /5 años desde tu última competencia/.test(t), 'la tabla: dónde está cada dato, quién lo ve y cuánto tiempo');
    ok(/Google Analytics/.test(t) && !/No se utilizan cookies de rastreo/.test(t), 'dice que se usa Google Analytics');
    const r = await p.evaluate(async () => {
      document.getElementById('sd_tipo').value = 'rectificacion';
      document.getElementById('sd_nombre').value = 'Juan Prueba';
      document.getElementById('sd_rut').value = '12.345.678-5';
      document.getElementById('sd_correo').value = 'juan@correo.cl';
      document.getElementById('sd_detalle').value = 'Mi club cambió';
      await enviarSolicitudDatos();
      return { esc: window.__ESCRITO || [], t: document.body.innerText };
    });
    const s = r.esc.find(x => x.col === 'solicitudes_datos');
    ok(s && s.d.tipo === 'rectificacion' && s.d.status === 'recibida' && s.d.rut && s.d.correo && JSON.stringify(Object.keys(s.d).sort()) === '["correo","detalle","nombre","rut","status","tipo","ts"]',
      'la solicitud llega a solicitudes_datos con los campos que permiten las reglas');
    ok(/Recibimos tu solicitud/.test(r.t), 'y se le confirma a la persona');
    ok(!p.errs.length, 'sin errores de página' + (p.errs.length ? ': ' + p.errs[0] : ''));
    await p.context().close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

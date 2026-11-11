// Campeonato abierto: la foto del atleta sale en la nómina solo si él lo
// autoriza y la organización la acepta.
//
// Pasó con la Copa Panda: en la nómina del sitio no se veían las fotos. Era a
// propósito —el formulario decía que la foto no se publica, y queda en la
// carpeta privada—, pero la organización quiere mostrarlas. Ahora:
//   · el formulario tiene una casilla OPCIONAL ("mi foto puede salir en la
//     nómina y la transmisión"), sin marcar de entrada;
//   · el admin la revisa en Nóminas y la acepta: recién ahí se copia a una
//     carpeta pública y sale en el sitio y en la transmisión. Si el atleta no
//     marcó la casilla, aceptar pide confirmar que autorizó por otro lado;
//   · rechazarla o quitarla borra la copia pública.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_fotoabierto.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
const RAIZ = path.join(__dirname, '..');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const PROX = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 16);
const COPA = {
  id: 'copa_prueba_2026', name: 'Copa Prueba Clausura 2026', date: '2026-12-05', days: '5 y 6 de diciembre',
  location: 'Talca', status: 'open', preNominaCloseAt: PROX, abierto: true, organizers: [{ name: 'Club Organizador' }],
  ab: { reglamento: 'IPF', precio: 35000, polera: false, precioPolera: 0, tallas: ['M'], mods: ['Classic'],
    pago: { titular: 'TITULAR DE PRUEBA', rut: '11.111.111-1', banco: 'Banco de Prueba', tipo: 'Cuenta Vista', numero: '000123456789', correo: 'pagos@ejemplo.cl' } },
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const URL_FS = 'https://firebasestorage.googleapis.com/v0/b/prueba/o/';
const REGLAS = fs.readFileSync(path.join(RAIZ, 'reglas', 'firestore.rules'), 'utf8');
const hasOnly = fn => {
  const i = REGLAS.indexOf('function ' + fn);
  const m = REGLAS.slice(i).match(/hasOnly\(\[([^\]]+)\]\)/);
  return m ? m[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean) : [];
};

console.log('\nLas reglas');
{
  const pub = hasOnly('inscAbiertaValida');
  ok(pub.includes('fotoAutoriza') && pub.includes('fotoAutorizaTs'), 'el formulario puede guardar la autorización de la foto');
  ok(!pub.includes('fotoUrl') && !pub.includes('fotoEstado'), 'pero no publicarla: la foto publicada (fotoUrl) la pone solo el admin');
  const f = REGLAS.slice(REGLAS.indexOf('function inscAbiertaValida'), REGLAS.indexOf('match /inscripciones_abiertas/'));
  ok(/request\.resource\.data\.fotoAutoriza == true/.test(f), 'y la autorización solo puede ser un sí');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack || e)); try { await b.close(); } catch (x) {} process.exit(1); });
  async function pagina(url, fake, auth, vp) {
    const ctx = await b.newContext({ viewport: vp || { width: 1100, height: 1000 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    // Los enlaces de Storage del Firebase falso sirven una imagen de verdad.
    await ctx.route(/firebasestorage\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    p.dialogos = []; p.aceptar = true;
    p.on('dialog', d => { p.dialogos.push(d.message()); (p.aceptar ? d.accept() : d.dismiss()).catch(() => {}); });
    await p.addInitScript(([f, a, base]) => {
      window.__FAKE = f; if (a) window.__AUTH = a;
      window.__URL_DE = ruta => base + encodeURIComponent(ruta || '') + '?alt=media&token=t';
    }, [fake, auth || null, URL_FS]);
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    return p;
  }

  console.log('\nEl formulario');
  async function inscribir(marcar, reglasViejas) {
    const p = await pagina('inscripcion_abierta.html?ev=' + COPA.id, { eventos: [COPA], clubs: [] });
    await p.waitForFunction(() => document.querySelector('#app h1'), null, { timeout: 20000 });
    const caja = await p.evaluate(() => { const c = document.getElementById('fotoPublica'); return c ? { marcada: c.checked, txt: c.closest('label').innerText } : null; });
    await p.evaluate(() => {
      Object.assign(_estado.f, { nombre: 'María José Pérez Soto', correo: 'maria@ejemplo.cl', telefono: '+56 9 1111 2222',
        sexo: 'Femenino', fechaNac: '1995-06-01', club: 'Otro', clubOtro: 'Gimnasio Talca', division: 'Open',
        categoria: '-63 kg', modalidad: 'Classic' });
      _estado.consiente = true; render();
    });
    await p.setInputFiles('input[aria-label="Foto del atleta"]', { name: 'yo.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForFunction(() => _estado.archivos.fotoAtleta);
    await p.setInputFiles('input[aria-label="Comprobante de transferencia"]', { name: 'c.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 x') });
    await p.waitForFunction(() => _estado.archivos.comprobante);
    if (marcar) await p.check('#fotoPublica');
    // Las reglas publicadas todavía sin la autorización de la foto: rechazan el
    // lote si trae un campo que no conocen.
    if (reglasViejas) await p.evaluate(() => { window.__FALLA_LOTE = ops => ops.some(o => o.d && 'fotoAutoriza' in o.d) ? Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }) : null; });
    const consent = await p.evaluate(() => document.getElementById('app').innerText);
    await p.click('#btnEnviar');
    await p.waitForFunction(() => _estado.ok || _estado.error, null, { timeout: 10000 });
    const r = await p.evaluate(() => ({ ok: _estado.ok, err: _estado.error, w: window.__ESCRITO || [], subido: window.__SUBIDO || [] }));
    r.caja = caja; r.consent = consent; r.errs = p.errs;
    await p.context().close();
    return r;
  }
  const sin = await inscribir(false), con = await inscribir(true);
  ok(sin.caja && sin.caja.marcada === false && /mi foto salga en la nómina y en la transmisión/i.test(sin.caja.txt) && /opcional/i.test(sin.caja.txt),
    'junto a la foto hay una casilla opcional, sin marcar, para que salga en la nómina y la transmisión');
  ok(/revise/.test(sin.caja && sin.caja.txt || ''), 'y dice que la organización la revisa antes');
  ok(/Mi foto tampoco, salvo que haya marcado/.test(sin.consent) && !/fecha de nacimiento, foto y comprobante no se publican/.test(sin.consent),
    'la autorización de datos ya no dice que la foto nunca se publica');
  const pubSin = sin.w.find(x => x.col === 'inscripciones_abiertas'), pubCon = con.w.find(x => x.col === 'inscripciones_abiertas');
  ok(sin.ok && pubSin && !('fotoAutoriza' in pubSin.d), 'sin marcarla, la inscripción no autoriza nada' + (sin.err ? ': ' + sin.err : ''));
  ok(con.ok && pubCon && pubCon.d.fotoAutoriza === true && /^\d{4}-/.test(pubCon.d.fotoAutorizaTs || ''), 'marcada, queda la autorización con su fecha');
  const permitido = hasOnly('inscAbiertaValida');
  ok(pubCon && Object.keys(pubCon.d).every(k => permitido.includes(k)), 'y cabe en lo que aceptan las reglas');
  ok(pubCon && !('fotoUrl' in pubCon.d) && con.subido.every(r => /^athlete_files\//.test(r)),
    'la foto igual queda solo en la carpeta privada: nada se publica desde el formulario');
  const vieja = await inscribir(true, true);
  const ult = vieja.w.filter(x => x.col === 'inscripciones_abiertas').pop();
  ok(vieja.ok && ult && !('fotoAutoriza' in ult.d) && vieja.w.filter(x => x.col === 'inscripciones_abiertas_priv').length === 2,
    'si las reglas publicadas aún no conocen la autorización, la inscripción se guarda igual (sin ella)' + (vieja.err ? ': ' + vieja.err : ''));
  ok(!sin.errs.length && !con.errs.length && !vieja.errs.length, 'sin errores en el formulario');

  console.log('\nAdmin → Nóminas: revisar y aceptar');
  const insc = (id, nombre, extra) => Object.assign({ id, evento: COPA.id, nombre, sexo: 'Femenino', anioNac: '1995', division: 'Open',
    categoria: '-63 kg', modalidad: 'Classic', club: 'Otro', clubOtro: 'Gimnasio Talca', status: 'pending', timestamp: { seconds: 1 } }, extra || {});
  const priv = id => ({ id, evento: COPA.id, correo: id + '@ejemplo.cl', telefono: '1', fechaNac: '1995-06-01',
    docs: { fotoAtleta: 'storage:athlete_files/abierto_' + COPA.id + '/' + id + '_fotoAtleta.png', comprobante: 'storage:athlete_files/abierto_' + COPA.id + '/' + id + '_comprobante.pdf' } });
  const RUTA_A3 = 'athlete_photos/abierto_' + COPA.id + '_a3_1.png';
  const FAKE_ADM = {
    admins: [{ id: 'u1', role: 'owner', email: 'a@b.cl', nombre: 'Prueba' }], eventos: [COPA], inscripciones: [], inscripciones_private: [],
    inscripciones_abiertas: [insc('a1', 'Ana Autoriza', { fotoAutoriza: true, fotoAutorizaTs: '2026-11-10T10:00:00Z' }), insc('a2', 'Berta Sin Marcar'),
      insc('a3', 'Carla Publicada', { fotoAutoriza: true, fotoUrl: URL_FS + 'pub_a3.png?alt=media', fotoRuta: RUTA_A3, fotoEstado: 'aceptada' })],
    inscripciones_abiertas_priv: [priv('a1'), priv('a2'), priv('a3')],
  };
  {
    const q = await pagina('admin.html', FAKE_ADM, { uid: 'u1', email: 'a@b.cl' }, { width: 1500, height: 1000 });
    await q.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo && document.querySelector('.side-btn'), null, { timeout: 25000 });
    await q.evaluate(id => { go('nominas'); ST.filterEv = id; render(); }, COPA.id);
    await q.waitForFunction(() => /Autorizó · por revisar/.test(document.getElementById('app').innerText), null, { timeout: 15000 }).catch(() => {});
    await q.waitForFunction(() => document.querySelectorAll('#app img[title="Ver grande"]').length >= 3, null, { timeout: 8000 }).catch(() => {});
    const v = await q.evaluate(() => {
      const t = document.getElementById('app').innerText;
      const filas = [...document.querySelectorAll('#app table.tbl tr')].slice(1).map(tr => tr.innerText.replace(/\s+/g, ' '));
      return { t, filas, minis: [...document.querySelectorAll('#app img[title="Ver grande"]')].map(i => i.getAttribute('src')) };
    });
    const fila = n => v.filas.find(f => f.includes(n)) || '';
    ok(/1 foto\(s\) por revisar/.test(v.t), 'avisa cuántas fotos autorizadas faltan por revisar');
    ok(/Autorizó · por revisar/.test(fila('Ana Autoriza')) && /Aceptar/.test(fila('Ana Autoriza')) && /Rechazar/.test(fila('Ana Autoriza')),
      'la que autorizó: "por revisar", con Aceptar y Rechazar');
    ok(/No marcó que se publique/.test(fila('Berta Sin Marcar')), 'la que no marcó la casilla lo dice');
    ok(/En la nómina/.test(fila('Carla Publicada')) && /Quitar/.test(fila('Carla Publicada')), 'la ya publicada dice "En la nómina", con Quitar');
    ok(v.minis.length === 3 && v.minis.every(s => s.startsWith(URL_FS)), 'se ve la foto de cada una, en miniatura, para revisarla');

    // Aceptar la que autorizó: se copia a la carpeta pública y se guarda el enlace.
    await q.evaluate(() => { window.__ESCRITO = []; window.__SUBIDO = []; window.__BORRADO = []; });
    await q.evaluate(() => abFotoAceptar('a1'));
    let w = await q.evaluate(() => ({ e: window.__ESCRITO, s: window.__SUBIDO, t: document.getElementById('app').innerText }));
    const upd1 = w.e.find(x => x.col === 'inscripciones_abiertas' && x.id === 'a1');
    ok(w.s.length === 1 && w.s[0].startsWith('athlete_photos/abierto_' + COPA.id + '_a1_') && !/ana|autoriza/i.test(w.s[0]),
      'Aceptar copia la foto a la carpeta pública (sin el nombre de la persona en el archivo)');
    ok(upd1 && upd1.d.fotoUrl && upd1.d.fotoUrl.startsWith(URL_FS) && upd1.d.fotoEstado === 'aceptada' && upd1.d.fotoRuta === w.s[0],
      'y guarda el enlace en la inscripción: ya sale en la nómina');
    ok(!/foto\(s\) por revisar/.test(w.t), 'el aviso de "por revisar" se va');

    // La que no marcó: aceptar pregunta; si dice que no, no se publica nada.
    q.aceptar = false; q.dialogos.length = 0;
    await q.evaluate(() => { window.__ESCRITO = []; window.__SUBIDO = []; });
    await q.evaluate(() => abFotoAceptar('a2'));
    w = await q.evaluate(() => ({ e: window.__ESCRITO, s: window.__SUBIDO }));
    ok(q.dialogos.length === 1 && /no marcó/.test(q.dialogos[0]) && /autoriz/.test(q.dialogos[0]), 'si el atleta no marcó la casilla, pregunta si autorizó por otro lado');
    ok(!w.e.length && !w.s.length, 'y si no, no publica nada');
    q.aceptar = true;
    await q.evaluate(() => abFotoAceptar('a2'));
    w = await q.evaluate(() => ({ e: window.__ESCRITO }));
    const upd2 = w.e.find(x => x.col === 'inscripciones_abiertas' && x.id === 'a2');
    ok(upd2 && upd2.d.fotoUrl && upd2.d.fotoAutoriza === true && upd2.d.fotoAutorizaVia === 'organizacion',
      'si confirma, la publica y queda anotado que autorizó a la organización');

    // Quitar la publicada: se borra la copia pública y el enlace.
    await q.evaluate(() => { window.__ESCRITO = []; window.__BORRADO = []; });
    await q.evaluate(() => abFotoQuitar('a3'));
    w = await q.evaluate(() => ({ e: window.__ESCRITO, bo: window.__BORRADO, t: document.getElementById('app').innerText }));
    const upd3 = w.e.find(x => x.col === 'inscripciones_abiertas' && x.id === 'a3');
    ok(w.bo.includes(RUTA_A3), 'Quitar borra la copia pública de la foto');
    ok(upd3 && upd3.d.fotoUrl === null && upd3.d.fotoEstado === 'rechazada', 'y el enlace: deja de salir en la nómina');
    ok(!w.bo.some(r => /^athlete_files\//.test(r)), 'la foto privada queda para la organización');

    // Campeonatos → Ver inscritos muestra lo mismo (vuelve a leer: en el
    // Firebase falso los datos no cambian, así que se ve lo de la base).
    await q.evaluate(id => { go('campeonatos'); abVer(id); }, COPA.id);
    await q.waitForFunction(() => /Foto en la nómina/i.test(document.getElementById('app').innerText), null, { timeout: 8000 }).catch(() => {});
    const vi = await q.evaluate(() => document.getElementById('app').innerText);
    ok(/Foto en la nómina/i.test(vi) && /En la nómina/.test(vi) && /Autorizó · por revisar/.test(vi) && /No marcó que se publique/.test(vi),
      'en Campeonatos → Ver inscritos se ve el estado de cada foto, con las mismas acciones' + (/Foto en la nómina/i.test(vi) ? '' : ': ' + vi.slice(0, 200)));
    ok(!q.errs.length, 'sin errores en el admin' + (q.errs.length ? ': ' + q.errs.slice(0, 2).join(' | ') : ''));
    await q.context().close();
  }

  console.log('\nLa nómina del sitio');
  {
    const p = await pagina('index.html', { eventos: [COPA], inscripciones_abiertas: [
      insc('a1', 'Ana Autoriza', { fotoAutoriza: true, fotoUrl: URL_FS + 'pub_a1.png?alt=media', status: 'approved' }),
      insc('a2', 'Berta Sin Foto', { fotoAutoriza: true }),
      insc('a4', 'Dora Enlace Raro', { fotoUrl: 'https://otro-sitio.cl/x.png' })] });
    await p.waitForFunction(() => typeof fbReady !== 'undefined' && fbReady && window._eventosFS === true, null, { timeout: 20000 });
    await p.evaluate(() => { ST.v = 'nominas'; cargarParaVista('nominas'); });
    await p.waitForFunction(() => window._nominasCargadas, null, { timeout: 10000 }).catch(() => {});
    const r = await p.evaluate(id => {
      const ev = (NM.events || []).find(e => e.id === id) || {};
      const fotos = {}; (ev.athletes || []).forEach(a => { fotos[a.nombre] = a.foto || ''; });
      const filas = {}; _nomEvRows(ev).forEach(x => { filas[x.n] = x.nameHtml; });
      nomFichaEv(_nomEvKey(ev, (ev.athletes || []).find(a => a.nombre === 'Ana Autoriza')));
      const ficha = document.getElementById('nomFichaEvModal');
      return { fotos, filas, ficha: ficha ? (ficha.querySelector('img') || {}).src || '' : null };
    }, COPA.id);
    ok(r.fotos['Ana Autoriza'] === URL_FS + 'pub_a1.png?alt=media' && /<img src="https:\/\/firebasestorage/.test(r.filas['Ana Autoriza'] || ''),
      'la foto aceptada sale junto al nombre en la nómina');
    ok(r.ficha === URL_FS + 'pub_a1.png?alt=media', 'y en la ficha al tocar el nombre');
    ok(r.fotos['Berta Sin Foto'] === '' && !/<img/.test(r.filas['Berta Sin Foto'] || ''), 'autorizar no basta: sin aceptarla, no sale (iniciales)');
    ok(r.fotos['Dora Enlace Raro'] === '', 'un enlace que no es de nuestro Storage no se muestra');
    ok(!p.errs.length, 'sin errores en el sitio' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
    await p.context().close();
  }

  console.log('\nLa transmisión (livecast)');
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 860 } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=suda2026_fesupo_full`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && typeof _lcMediaFor === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
    const r = await p.evaluate(base => {
      const id = DATA.event.id;
      window.LIVE_EVENT_META = window.LIVE_EVENT_META || {};
      window.LIVE_EVENT_META[id] = Object.assign({}, window.LIVE_EVENT_META[id], { abierto: true });
      // Lo que llega de inscripciones_abiertas de este campeonato.
      const real = window._fb, fbR = fbReady, dbR = fbDB, oyentes = [];
      window._fb = { query: (c, ...w) => ({ c, w }), collection: (_d, n) => n, where: (f, o, v) => [f, o, v],
        onSnapshot: (q, cb) => { oyentes.push(q); cb({ docs: [
          { data: () => ({ nombre: 'María José Pérez', status: 'approved', fotoUrl: base + 'a.png?alt=media' }) },
          { data: () => ({ nombre: 'Rocío Rechazada', status: 'rejected', fotoUrl: base + 'r.png?alt=media' }) },
          { data: () => ({ nombre: 'Sin Aceptar', status: 'pending', fotoAutoriza: true }) },
          { data: () => ({ nombre: 'Enlace Raro', status: 'approved', fotoUrl: 'https://otro.cl/x.png' }) }] }); return () => {}; } };
      try { fbReady = true; if (!fbDB) fbDB = {}; } catch (e) {}      // en la prueba Firebase no arranca
      _abFotosEv = null;
      const at = n => ({ name: n, codigo: '', att: {} });
      const m1 = _lcMediaFor(at('Maria Jose Perez'));       // sin tildes: el mismo nombre
      const out = { oyentes: oyentes.map(o => JSON.stringify(o)), m1: m1 && m1.foto_url, rech: _lcMediaFor(at('Rocío Rechazada')),
        pend: _lcMediaFor(at('Sin Aceptar')), raro: _lcMediaFor(at('Enlace Raro')) };
      window._fb = real; try { fbReady = fbR; fbDB = dbR; } catch (e) {}
      return out;
    }, URL_FS);
    ok(r.oyentes.length === 1 && /inscripciones_abiertas/.test(r.oyentes[0]) && /evento/.test(r.oyentes[0]), 'en un abierto, escucha las fotos de las inscripciones de ese campeonato');
    ok(r.m1 === URL_FS + 'a.png?alt=media', 'el perfil de la transmisión usa la foto aceptada del atleta');
    ok(!r.rech && !r.pend && !r.raro, 'y nada de inscripciones rechazadas, fotos sin aceptar o enlaces de afuera');
    ok(!errs.length, 'sin errores en el livecast' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    await ctx.close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

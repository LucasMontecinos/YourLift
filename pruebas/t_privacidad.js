// Los datos personales del padrón no se publican.
//
// data.json se podía bajar entero desde el sitio con el RUT y la fecha de
// nacimiento completa de más de mil atletas, y el repositorio es público. Ahora:
//   · compartido/privacidad.js decide qué es público: sin RUT ni fecha, con el año;
//   · el RUT y la fecha viven en Firestore, privado/padron (solo admin);
//   · el formulario de inscripción reconoce a quien escribe SU RUT preguntando a
//     rut_indice/{rut}, que se lee de a uno pero no se lista;
//   · el panel publica y exporta data.json siempre sin esos datos (salvo el
//     respaldo completo, que se descarga con otro nombre para no confundirlo).
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_privacidad.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
const RAIZ = path.join(__dirname, '..');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

globalThis.window = globalThis.window || globalThis;
require('../compartido/privacidad.js');
const P = window.YLPrivacidad;

console.log('\nQué se publica de un atleta');
{
  const a = { codigo: '1995JPE-2024', rut: '12.345.678-5', nombre: 'Juan Pérez', fechaNac: '20/03/1995',
    club: 'X', email: 'j@x.cl', competencias: [{ evento: 'Nacional' }] };
  const pub = P.publico(a);
  ok(!('rut' in pub) && !('fechaNac' in pub) && !('email' in pub), 'sin RUT, sin fecha completa, sin correo');
  ok(pub.anioNac === '1995', 'con el año de nacimiento, que alcanza para la división: ' + pub.anioNac);
  ok(pub.nombre === 'Juan Pérez' && pub.codigo === a.codigo && pub.competencias.length === 1, 'y todo lo demás igual');
  ok(a.rut === '12.345.678-5', 'sin tocar el original');
  ok(JSON.stringify(P.privado(a)) === JSON.stringify({ rut: '12.345.678-5', fechaNac: '20/03/1995' }),
     'lo privado es el RUT y la fecha');
  ok(P.norm('12.345.678-k') === '12345678K', 'el RUT se guarda y se busca normalizado');
  ok(P.publico({ fechaNac: '1995-03-20' }).anioNac === '1995', 'entiende también la fecha en formato ISO');
}

console.log('\nLas reglas de Firestore');
{
  const r = fs.readFileSync(path.join(RAIZ, 'reglas', 'firestore.rules'), 'utf8');
  const bloque = k => { const i = r.indexOf('match /' + k); return r.slice(i, r.indexOf('\n    }', i)); };
  ok(/allow read, write: if isAdmin\(\);/.test(bloque('privado/')), 'privado/: solo un admin lee y escribe');
  const ix = bloque('rut_indice/');
  ok(/allow get: if true;/.test(ix) && /allow list: if false;/.test(ix) && /allow write: if isAdmin\(\);/.test(ix),
     'rut_indice/: se lee de a uno, no se lista, y solo lo escribe un admin');
}

console.log('\nEl panel nunca publica el padrón con datos personales');
{
  const adm = require('./apoyo/fuente').admin();
  const up = require('./apoyo/fuente').funcion(adm, '_uploadToStorage');
  ok(/YLPrivacidad\.publico\(a\)/.test(up) && /_guardarPadronPrivado\(dataArr\)/.test(up),
     'lo que sube a Storage pasa por publico(), después de guardar lo privado');
  const ex = require('./apoyo/fuente').trozo(adm, 'window.exportData=');
  ok(/completo\?a:YLPrivacidad\.publico\(a\)/.test(ex) && /respaldo_completo_NO_PUBLICAR\.json/.test(ex),
     'la descarga para el sitio va sin datos; el respaldo completo lleva otro nombre');
  ok(/getDoc\(doc\(db,'privado','padron'\)\)/.test(require('./apoyo/fuente').funcion(adm, '_mezclarPadronPrivado')),
     'al cargar, el panel completa RUT y fechas desde privado/padron');
  ok(/rut_indice/.test(require('./apoyo/fuente').funcion(adm, '_guardarPadronPrivado')),
     'y al guardar arma el índice por RUT');
}

console.log('\nLos archivos semilla con datos personales ya no están');
for (const f of ['inscripciones.json', 'entrenadores_db.json'])
  ok(!fs.existsSync(path.join(RAIZ, f)), f + ' fuera del sitio y del repositorio');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {} process.exit(1); });

  console.log('\nLa inscripción reconoce al atleta sin RUT en el padrón');
  {
    // El padrón real, pero como quedará publicado: sin RUT ni fechas.
    const full = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data.json'), 'utf8'));
    const a = full.find(x => x.rut && x.codigo && /\d{2}\/\d{2}\/\d{4}/.test(x.fechaNac || ''));
    const limpio = full.map(P.publico);
    const ctx = await b.newContext({ viewport: { width: 900, height: 1000 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    await ctx.route(/\/data\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(limpio) }));
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([n, cod, fn]) => { window.__FAKE = { eventos: [], inscripciones: [], atleta_fotos: [],
      rut_indice: [{ id: n, codigo: cod, fechaNac: fn }] }; }, [P.norm(a.rut), a.codigo, a.fechaNac]);
    await p.goto(`http://localhost:${PUERTO}/inscripcion.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof firebaseReady !== 'undefined' && firebaseReady && athleteDB.length > 100,
      null, { timeout: 20000 });
    const antes = await p.evaluate(r => !!findAthleteByRut(r), a.rut);
    ok(!antes, 'sin el índice, el RUT solo no alcanza (el padrón publicado no lo trae)');
    const r = await p.evaluate(async rut => {
      state.form.rut = rut; await cargarDatosDeRut(rut);
      await new Promise(x => setTimeout(x, 200));
      return { codigo: state.form.codigo, nombre: state.form.nombre, fechaNac: state.form.fechaNac,
        lecturas: (window.__LEC || []).filter(l => l.col === 'rut_indice').map(l => l.op) };
    }, a.rut);
    ok(r.codigo === a.codigo, 'con el índice lo reconoce: ' + r.codigo);
    ok(r.nombre === a.nombre, 'y completa su nombre: ' + r.nombre);
    const [d, m, y] = a.fechaNac.split('/');
    ok(r.fechaNac === `${y}-${m}-${d}`, 'y su fecha de nacimiento, que viene del índice: ' + r.fechaNac);
    ok(r.lecturas.length === 1 && r.lecturas[0] === 'getDoc', 'pidiendo solo ese documento, sin listar el índice');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

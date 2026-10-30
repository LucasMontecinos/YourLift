// Estadísticas → Afiliaciones del año: los torneos regionales.
//
// Cuántas personas se inscribieron en los regionales del año (cada una una vez,
// aunque haya ido a varios), por división de edad y por sexo, y cuántas en cada
// torneo. La división es la que corresponde por año de nacimiento, no la que se
// eligió al inscribirse. Un mismo regional escrito de dos formas cuenta una vez.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_regionales.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };
const A = new Date().getFullYear();

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack || e)); try { await b.close(); } catch (x) {} process.exit(1); });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, serviceWorkers: 'block' });
  await montarFirebase(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__FAKE = { admins: [{ id: 'u1', role: 'owner' }], eventos: [], inscripciones: [], inscripciones_private: [] };
    window.__AUTH = { uid: 'u1', email: 'owner@correo.cl' }; });
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo && document.querySelector('.side-btn') && window.ylDivisionPorAnio, null, { timeout: 25000 });

  console.log('\nTorneos regionales del año');
  const r = await p.evaluate(A => {
    const comp = (ev, fecha, sexo) => ({ evento: ev, fecha, sexo, resultado: { total: 400, sq: 150, bp: 100, dl: 150 } });
    const centro = 'Regional Centro ' + A, centroLargo = 'Campeonato Regional Centro FECHIPO ' + A;
    // Ana fue al Centro (escrito de dos formas) y está inscrita en el Sur Austral:
    // es una persona. Fede fue solo al Nacional. Gabi no tiene sexo ni año.
    ST.data = [
      { codigo: 'A', rut: '11.111.111-1', nombre: 'Ana Uno', anioNac: String(A - 18), competencias: [comp(centro, A + '-05-10', 'Femenino'), comp(centroLargo, A + '-05-10', 'Femenino')] },
      { codigo: 'B', rut: '22.222.222-2', nombre: 'Beto Dos', anioNac: String(A - 31), competencias: [comp(centro, A + '-05-10', 'Masculino')] },
      { codigo: 'C', rut: '33.333.333-3', nombre: 'Caro Tres', anioNac: String(A - 42), competencias: [comp(centroLargo, A + '-05-10', 'Femenino')] },
      { codigo: 'F', rut: '66.666.666-6', nombre: 'Fede Seis', anioNac: String(A - 30), competencias: [comp('Campeonato Nacional FECHIPO ' + A, A + '-08-10', 'Masculino')] },
      { codigo: 'G', rut: '77.777.777-7', nombre: 'Gabi Siete', competencias: [comp(centro, A + '-05-10', '')] },
      { codigo: 'V', rut: '88.888.888-8', nombre: 'Vito Viejo', anioNac: '1990', competencias: [comp('Regional Centro ' + (A - 1), (A - 1) + '-05-10', 'Masculino')] },
    ];
    ST.allCompResults = [];
    ST.eventos = [{ id: 'sur_austral', name: 'Regional Sur Austral ' + A, date: A + '-12-12' }];
    ST.inscripciones = [
      { id: 'i1', evento: 'sur_austral', status: 'pending', rut: '44.444.444-4', nombre: 'Dani Cuatro', sexo: 'Masculino', anioNac: String(A - 22) },
      { id: 'i2', evento: 'sur_austral', status: 'approved', rut: '11.111.111-1', nombre: 'Ana Uno', sexo: 'Femenino', anioNac: String(A - 18) },
      { id: 'i3', evento: 'sur_austral', status: 'rejected', rut: '55.555.555-5', nombre: 'Eli Rechazada', sexo: 'Femenino', anioNac: String(A - 25) },
    ];
    ST.statsTab = '2026'; go('stats');
    const card = [...document.querySelectorAll('#statsContent > div')].find(d => /TORNEOS REGIONALES/.test(d.textContent));
    if (!card) return { card: '' };
    const tablas = [...card.querySelectorAll('table')].map(t => [...t.querySelectorAll('tbody tr, tfoot tr')]
      .map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim().split('\n')[0])));
    return { card: card.innerText, div: tablas[0], tor: tablas[1] };
  }, A);
  ok(/TORNEOS REGIONALES/.test(r.card), 'sale en Estadísticas → Afiliaciones del año');
  ok(/\b5\s*personas inscritas en 2 torneos regionales/.test(r.card),
    '5 personas en 2 regionales: cada una una vez, sin el Nacional, sin el rechazado ni el regional del año pasado');
  ok(/2 mujeres/.test(r.card) && /2 hombres/.test(r.card) && /1 sin sexo registrado/.test(r.card), 'por sexo: 2 mujeres, 2 hombres y 1 sin el dato');
  const fila = n => (r.div || []).find(x => x[0] === n) || [];
  // columnas: división, mujeres, hombres, s/sexo, total, %
  ok(fila('Sub-Junior').slice(1, 5).join() === '1,0,0,1' && fila('Junior').slice(1, 5).join() === '0,1,0,1'
    && fila('Open').slice(1, 5).join() === '0,1,0,1' && fila('Master I').slice(1, 5).join() === '1,0,0,1',
    'por división de edad y sexo, según el año de nacimiento: ' + JSON.stringify(r.div));
  ok(fila('Sin dato').slice(1, 5).join() === '0,0,1,1', 'quien no tiene año de nacimiento va en "Sin dato"');
  ok(fila('TOTAL').slice(1, 5).join() === '2,2,1,5' && fila('Sub-Junior')[5] === '20%', 'con totales y porcentaje');
  const tor = (r.tor || []).map(x => x.slice(0, 4).join('|'));
  ok(tor.length === 2 && (tor[0] === 'Regional Centro ' + A + '|4|2|1' || tor[0] === 'Campeonato Regional Centro FECHIPO ' + A + '|4|2|1'),
    'el Regional Centro escrito de dos formas cuenta una vez: 4 personas (2 mujeres, 1 hombre): ' + JSON.stringify(tor));
  ok(/Regional Sur Austral \d{4}\|2\|1\|1/.test(tor[1] || ''), 'y el Sur Austral, con inscripción abierta, cuenta su nómina: 2 personas');
  ok(/inscripción abierta/.test(r.card), 'dice cuál todavía tiene la inscripción abierta');
  ok(!/Ana Uno|Beto Dos|Dani Cuatro/.test(r.card), 'sin nombres de personas');
  ok(!errs.length, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

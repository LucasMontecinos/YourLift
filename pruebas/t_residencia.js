// Estadísticas → Afiliaciones del año: residencia por región.
//
// La residencia es lo que cada atleta escribió en "Ciudad / región" al
// inscribirse (texto libre, en lo privado de la inscripción). Se cuenta a quien
// compitió en el año, una vez por persona, con su inscripción más reciente que
// la traiga, y se muestra solo el total por región: nunca nombres.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_residencia.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
const RAIZ = path.join(__dirname, '..');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };
const ANIO = String(new Date().getFullYear()), ANTES = String(new Date().getFullYear() - 1);

console.log('\nQué región es cada texto');
{
  const ctx = { window: {}, ST: {}, console, esc: x => x };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'admin', 'estadisticas.js'), 'utf8'), ctx);
  const r = t => vm.runInContext('_resRegion(' + JSON.stringify(t) + ')', ctx) || {};
  const casos = [
    ['Talca, Región del Maule', 'Maule', 'Talca'], ['Puente Alto', 'Metropolitana', 'Puente Alto'],
    ['8va región', 'Biobío', ''], ['Región VIII', 'Biobío', ''], ['V region', 'Valparaíso', ''],
    ['Viña', 'Valparaíso', 'Viña del Mar'], ['Ñuñoa', 'Metropolitana', 'Ñuñoa'],
    ['Los Lagos, Región de Los Ríos', 'Los Ríos', 'Los Lagos'], ['Los Lagos', 'Los Lagos', ''],
    ["O'Higgins", "O'Higgins", ''], ['San Pedro de la Paz', 'Biobío', 'San Pedro de la Paz'],
    ['San Pedro de Atacama', 'Antofagasta', 'San Pedro de Atacama'], ['Temuco IX region', 'La Araucanía', 'Temuco'],
    ['RM', 'Metropolitana', ''], ['Pto Montt', 'Los Lagos', 'Puerto Montt'], ['Mendoza, Argentina', 'Fuera de Chile', ''],
    ['Chillán', 'Ñuble', 'Chillán'], ['Calera de Tango', 'Metropolitana', 'Calera de Tango'], ['asdf', '', ''],
  ];
  const malos = casos.filter(([t, reg, com]) => { const x = r(t); return x.region !== reg || x.comuna !== com; });
  ok(!malos.length, casos.length + ' textos típicos (comuna, región por nombre y por número, abreviaturas, extranjero)'
    + (malos.length ? ': ' + malos.map(m => m[0] + ' → ' + JSON.stringify(r(m[0]))).join(' | ') : ''));
  const n = vm.runInContext("RES_REGIONES.reduce((s,r)=>s+r[2].split(',').length,0)", ctx);
  ok(n >= 346, 'tiene las comunas de Chile (' + n + ', con algunos nombres alternativos)');
}

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
  await p.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo && document.querySelector('.side-btn'), null, { timeout: 25000 });

  console.log('\nEn el panel');
  const res = await p.evaluate(([A, B]) => {
    const comp = (ev, fecha) => ({ evento: ev, fecha, resultado: { total: 400, sq: 150, bp: 100, dl: 150 } });
    // Compitieron este año: Ana, Beto, Caro, Dani (sin inscripción), Eli (texto raro) y Gabi
    // (dos inscripciones: vale la más reciente). Fede compitió solo el año pasado.
    ST.data = [
      { codigo: 'A', rut: '11.111.111-1', nombre: 'Ana Uno', competencias: [comp('Regional Centro ' + A, A + '-05-10')] },
      { codigo: 'B', rut: '22.222.222-2', nombre: 'Beto Dos', competencias: [comp('Regional Centro ' + A, A + '-05-10')] },
      { codigo: 'C', rut: '33.333.333-3', nombre: 'Caro Tres', competencias: [comp('Regional Sur ' + A, A + '-06-10')] },
      { codigo: 'D', rut: '44.444.444-4', nombre: 'Dani Cuatro', competencias: [comp('Regional Sur ' + A, A + '-06-10')] },
      { codigo: 'E', rut: '55.555.555-5', nombre: 'Eli Cinco', competencias: [comp('Regional Sur ' + A, A + '-06-10')] },
      { codigo: 'F', rut: '66.666.666-6', nombre: 'Fede Seis', competencias: [comp('Nacional ' + B, B + '-09-10')] },
      { codigo: 'G', nombre: 'Gabi Siete', competencias: [comp('Regional Sur ' + A, A + '-06-10')] },
    ];
    ST.allCompResults = [];
    ST.eventos = [{ id: 'ev_b', name: 'Nacional ' + B, date: B + '-09-10' }, { id: 'ev_a', name: 'Regional Sur ' + A, date: A + '-06-10' }];
    ST.inscripciones = [
      { id: 'i1', evento: 'ev_a', status: 'approved', rut: '11.111.111-1', nombre: 'Ana Uno', comuna: 'Talca, Región del Maule' },
      { id: 'i2', evento: 'ev_a', status: 'approved', rut: '22.222.222-2', nombre: 'Beto Dos', comuna: 'Puente Alto' },
      { id: 'i3', evento: 'ev_a', status: 'approved', rut: '33.333.333-3', nombre: 'Caro Tres', comuna: '8va región' },
      { id: 'i5', evento: 'ev_a', status: 'approved', rut: '55.555.555-5', nombre: 'Eli Cinco', comuna: 'Mi casa' },
      { id: 'i6', evento: 'ev_b', status: 'approved', rut: '66.666.666-6', nombre: 'Fede Seis', comuna: 'Arica' },
      { id: 'i7', evento: 'ev_b', status: 'approved', nombre: 'Gabi Siete', comuna: 'Arica' },
      { id: 'i8', evento: 'ev_a', status: 'approved', nombre: 'Gabi Siete', comuna: 'Temuco' },
    ];
    ST.statsTab = '2026'; go('stats');
    const card = [...document.querySelectorAll('#statsContent > div')].find(d => /RESIDENCIA POR REGIÓN/.test(d.textContent));
    if (!card) return { card: '' };
    const filas = {};
    [...card.querySelectorAll('tbody tr')].forEach(tr => { const td = tr.querySelectorAll('td'); filas[td[0].innerText.trim()] = td[1].innerText.trim() + '|' + td[2].innerText.trim(); });
    return { card: card.innerText, filas };
  }, [ANIO, ANTES]);
  ok(/RESIDENCIA POR REGIÓN/.test(res.card), 'sale en Estadísticas → Afiliaciones del año');
  ok(/De las 6 personas que compitieron/.test(res.card), 'cuenta a los 6 que compitieron este año, no al que compitió solo el año pasado');
  const f = res.filas || {};
  ok(f['Maule'] === '1|25%' && f['Metropolitana'] === '1|25%' && f['Biobío'] === '1|25%' && f['La Araucanía'] === '1|25%' && !f['Arica y Parinacota'],
    'una persona por región, con la inscripción más reciente de cada una: ' + JSON.stringify(f));
  ok(/4 tienen su residencia/.test(res.card) && /1 sin dato/.test(res.card) && /1 con un texto que no se reconoce/.test(res.card),
    'separa a quien no tiene el dato y el texto que no se reconoce');
  ok(/Talca\s*Maule\s*1/.test(res.card), 'y las comunas con más atletas');
  ok(res.card && !/Ana Uno|Beto Dos|Gabi Siete|Eli Cinco/.test(res.card), 'sin ningún nombre: solo totales');
  ok(/Mi casa/.test(res.card), 'muestra los textos que no reconoce, para corregirlos');
  ok(!errs.length, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

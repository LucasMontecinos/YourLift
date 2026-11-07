// Admin → Cronograma → "Filtrar nómina con el cronograma".
//
// Cuando la organización entrega el cronograma oficial, la nómina queda con
// exactamente esos atletas (pasó con el Regional Centro 2026: 144 en el
// cronograma, 180 inscripciones). Se cruza por código y, si no, por nombre:
//   · pendiente que está en el cronograma → aprobado
//   · aprobado o pendiente que no está → rechazado (se puede deshacer)
//   · rechazado que no está → no se toca
//   · categoría / división / modalidad / club → los del cronograma
//   · y se publica el cronograma si estaba oculto
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_filtrocrono.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026', status: 'closed', cronogramaPublic: false };
const ins = (id, nombre, status, extra) => Object.assign({ id, codigo: id, nombre, status, evento: EV.id, division: 'Open',
  categoria: '-83 kg', modalidad: 'Powerlifting Classic', club: 'Himalaya Powerlifting', sexo: 'Masculino' }, extra || {});
const INSC = [
  ins('C1', 'Ana Rojas Pinto', 'approved', { categoria: '-63 kg', sexo: 'Femenino' }),   // corrige categoría
  ins('C2', 'Vicente Bareientos Diaz', 'approved'),                                        // error de tipeo: va por código
  ins('C3', 'Berta Soto Vera', 'pending'),                                                 // se aprueba
  ins('C4', 'Daniela Andrea Mansilla Gallardo', 'pending'),                                // el cronograma trae un nombre más
  ins('C5', 'Carlos Díaz Mora', 'approved'),                                               // no está: se baja
  ins('C6', 'Diego Paz Rivas', 'pending'),                                                 // no está: se baja
  ins('C7', 'Maria Jesus Jeria Vasquez', 'rejected'),                                      // no está, ya rechazada: nada
  ins('C8', 'Javier Benjamin Jimenez Pardo', 'approved', { club: 'Potencia Muscular' }),   // corrige club
];
const fila = (nombre, extra) => Object.assign({ nombre, codigo: '', division: 'Open', categoria: '-83 kg', sexo: 'H',
  club: 'Himalaya Powerlifting', modalidad: 'Powerlifting Classic', tarima: '1', flight: 'A', jornada: 'AM', dia: 'Sábado' }, extra || {});
const CRONO = [
  fila('Ana Rojas Pinto', { categoria: '-69 kg', sexo: 'M' }),
  fila('Vicente Javier Barrientos Diaz', { codigo: 'C2' }),
  fila('Berta Soto Vera'),
  fila('Daniela Andrea Montserrat Mansilla Gallardo'),
  fila('Javier Benjamin Jimenez Pardo', { club: 'Black Bars' }),
  fila('Nadie Inscrito Todavia'),
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
  await montarFirebase(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const dialogos = [];
  p.on('dialog', async d => { dialogos.push(d.message()); await d.accept(); });
  await p.addInitScript(([ev, insc]) => {
    window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }], eventos: [ev], inscripciones: insc };
  }, [EV, INSC]);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof ST !== 'undefined' && typeof cronoFiltrarNomina === 'function', null, { timeout: 25000 });

  console.log('\nEl plan');
  const plan = await p.evaluate(([insc, crono]) => {
    const r = _cronoPlanFiltro(crono, insc);
    return { aprobar: r.aprobar.map(x => x.ins.id), bajar: r.bajar.map(i => i.id), sin: r.sinInsc.map(f => f.nombre),
      corregir: r.corregir.map(x => x.ins.id + ':' + x.cambios.map(c => c.campo + '=' + c.ahora).join(',')) };
  }, [INSC, CRONO]);
  ok(plan.aprobar.join(',') === 'C3,C4', 'se aprueban los pendientes del cronograma, también con un nombre de más: ' + plan.aprobar);
  ok(plan.bajar.join(',') === 'C5,C6', 'se bajan el aprobado y el pendiente que no están: ' + plan.bajar);
  ok(!plan.bajar.includes('C2'), 'el del error de tipeo se cruza por su código y se queda');
  ok(!plan.bajar.includes('C7') && !plan.aprobar.includes('C7'), 'la que ya estaba rechazada no se toca');
  ok(plan.corregir.join(' | ') === 'C1:categoria=-69 kg | C8:club=Black Bars', 'corrige categoría y club con lo del cronograma: ' + plan.corregir.join(' | '));
  ok(plan.sin.join(',') === 'Nadie Inscrito Todavia', 'avisa de la fila sin inscripción: ' + plan.sin);

  console.log('\nAplicar');
  const res = await p.evaluate(async ([ev, insc, crono]) => {
    ST.user = { email: 'x@y.cl', uid: 'u1' };
    ST.eventos = [ev]; ST.inscripciones = JSON.parse(JSON.stringify(insc)); ST.cronoEv = ev.id; ST.cronoRows = crono;
    window.__ESCRITO = [];
    await cronoFiltrarNomina();
    return window.__ESCRITO.filter(w => w.col === 'inscripciones' || w.col === 'eventos').map(w => ({ col: w.col, id: w.id, d: w.d }));
  }, [EV, INSC, CRONO]);
  const de = id => res.filter(w => w.col === 'inscripciones' && w.id === id).map(w => w.d);
  ok(dialogos.length === 1 && /SE APRUEBAN \(2\)/.test(dialogos[0]) && /SE BAJAN.*\(2\)/.test(dialogos[0]) && /se PUBLICA el cronograma/.test(dialogos[0]),
    'pide confirmación mostrando qué se aprueba, qué se baja y que se publica');
  ok(de('C3')[0] && de('C3')[0].status === 'approved' && de('C4')[0].status === 'approved', 'los dos pendientes quedan aprobados');
  ok(de('C5')[0] && de('C5')[0].status === 'rejected' && de('C5')[0].filtroCrono.statusAntes === 'approved', 'el aprobado que no está queda rechazado y recuerda que estaba aprobado');
  ok(de('C6')[0] && de('C6')[0].status === 'rejected' && de('C6')[0].filtroCrono.statusAntes === 'pending', 'el pendiente que no está queda rechazado y recuerda que estaba pendiente');
  ok(de('C1')[0] && de('C1')[0].categoria === '-69 kg' && de('C1')[0].filtroCrono.camposAntes.categoria === '-63 kg', 'la categoría se corrige y se guarda la de antes');
  ok(de('C8')[0] && de('C8')[0].club === 'Black Bars', 'el club se corrige');
  ok(!de('C2').length && !de('C7').length, 'a los que no cambian no se les escribe nada');
  ok(res.some(w => w.col === 'eventos' && w.id === EV.id && w.d.cronogramaPublic === true), 'el cronograma queda publicado');

  console.log('\nDeshacer');
  const des = await p.evaluate(async (escritos) => {
    // Lo que devolvería el servidor después del filtrado.
    escritos.filter(w => w.col === 'inscripciones').forEach(w => { const i = ST.inscripciones.find(x => x.id === w.id); Object.assign(i, w.d); });
    window.__ESCRITO = [];
    await cronoDeshacerFiltro();
    return window.__ESCRITO.filter(w => w.col === 'inscripciones').map(w => ({ id: w.id, d: w.d }));
  }, res);
  const d2 = id => (des.find(w => w.id === id) || {}).d || {};
  ok(d2('C5').status === 'approved' && d2('C6').status === 'pending' && d2('C3').status === 'pending', 'cada uno vuelve a su estado');
  ok(d2('C1').categoria === '-63 kg' && d2('C8').club === 'Potencia Muscular', 'y a sus datos de antes');
  ok(des.every(w => w.d.filtroCrono === null), 'y se borra la marca');

  console.log('\nImportar Excel trae el código');
  const src = require('./apoyo/fuente').admin();
  ok(/iCod=headers\.findIndex\(h=>\/\^c\[oó\]digo\/\.test\(h\)\)/.test(src) && /codigo:iCod>=0/.test(src), 'la columna Código se lee al importar');

  console.log('\nDesde el link admin.html?cronoOficial=regional_centro_2026');
  {
    const p2 = await ctx.newPage();
    p2.on('pageerror', e => errs.push('link: ' + e.message));
    const dlg = [];
    p2.on('dialog', async d => { dlg.push(d.message()); await d.accept(); });
    await p2.addInitScript(([ev, insc]) => {
      window.__AUTH = { uid: 'u1', email: 'x@y.cl' };
      window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }], eventos: [ev], inscripciones: insc };
      window.__ESCRITO = [];
    }, [EV, INSC]);
    await p2.goto(`http://localhost:${PUERTO}/admin.html?cronoOficial=${EV.id}`, { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => (window.__ESCRITO || []).some(w => w.col === 'eventos'), null, { timeout: 30000 }).catch(() => {});
    const r = await p2.evaluate(() => ({
      crono: (window.__ESCRITO.filter(w => w.col === 'cronograma').slice(-1)[0] || {}).d,
      priv: (window.__ESCRITO.filter(w => w.col === 'cronograma_priv').slice(-1)[0] || {}).d,
      ev: window.__ESCRITO.filter(w => w.col === 'eventos').map(w => w.d),
      url: location.search, vista: ST.view,
    }));
    ok(dlg.length === 2 && /CRONOGRAMA OFICIAL/.test(dlg[0]) && /144 atletas/.test(dlg[0]) && /FILTRAR LA NÓMINA/.test(dlg[1]),
      'pide confirmar el cronograma oficial (144) y después el filtrado: ' + dlg.map(x => x.split('\n')[0]).join(' / '));
    const filas = (r.crono && r.crono.rows) || [];
    ok(filas.length === 144 && filas.every(f => f.codigo), 'guarda las 144 filas del cronograma oficial, todas con su código');
    ok(filas.filter(f => f.flight === 'L').length === 13 && filas[0].dia === 'Sábado' && filas[0].jornada === 'AM', 'con tanda, día y jornada');
    ok(!JSON.stringify(r.crono || {}).includes('@') && !JSON.stringify(r.priv || {}).includes('@'), 'sin ningún correo');
    ok(r.ev.some(d => d.cronogramaPublic === true), 'y al aceptar el filtrado queda publicado');
    ok(r.url === '' && r.vista === 'cronograma', 'queda en la pestaña Cronograma, y recargar no lo vuelve a ofrecer');
    await p2.close();
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

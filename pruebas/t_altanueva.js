// Un inscrito agregado en el admin DESPUÉS de cargar la nómina tiene que entrar
// al livecast y quedarse.
//
// Pasó en el Regional Sur Austral: 86 aprobados en el admin y 85 en el livecast.
// El que faltaba se agregó a mano en el admin cuando la nómina ya estaba
// cargada. El livecast lo agregaba solo con la mesa en Atletas y Pesaje, y aun
// así sin marcarlo como alta propia: la escritura al servidor sube únicamente
// los atletas nuevos marcados, así que lo descartaba, y el siguiente documento
// del servidor lo sacaba también de la mesa. Nunca llegaba a nadie.
//
// Mesa, segunda mesa, pantalla de tarima y público, conectados por el Firestore
// falso con demoras de red (apoyo/firebase_red.js).
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_altanueva.js
const { chromium } = require('playwright');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026',
  canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };
const datos = () => ({
  eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
  inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
  admins: [{ id: 'u', role: 'admin' }],
});
const vacio = () => ({ sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
  bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
const BASE = [
  { n: 'Ana Rojas Pinto', f: 'A', lot: 100, cod: 'C1' }, { n: 'Berta Soto Vera', f: 'A', lot: 101, cod: 'C2' },
  { n: 'Carlos Díaz Mora', f: 'B', lot: 200, cod: 'C3' }, { n: 'Diego Paz Rivas', f: 'B', lot: 201, cod: 'C4' },
];
const NUEVO = { n: 'José Ignacio Prueba González', f: 'B', cod: 'C5' };
const enLivecast = () => BASE.map((x, i) => ({ id: i, lot: x.lot, name: x.n, codigo: x.cod, flight: x.f, sex: 'Masculino',
  cat: '83', div: 'Open', mod: 'classic', bw: 0, club: 'Club', att: vacio() }));
const insc = x => ({ id: EV.id + '_' + x.cod, nombre: x.n, codigo: x.cod, sexo: 'Masculino', division: 'Open', categoria: '83',
  modalidad: 'Powerlifting Classic', club: 'South Side Club', evento: EV.id, status: 'approved', anioNac: '1997' });
const inscripciones = () => BASE.map(insc).concat([Object.assign(insc(NUEVO), { _manualAdmin: true, timestamp: 1792032015229 })]);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const red = crearRed({ subida: [150, 600], bajada: [80, 600] });
  red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(enLivecast()),
    flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: false, forcedCurrent: null,
    timer: 60, timerOn: false, writer: 'semilla' });
  red.sembrar('cronograma/' + EV.id, { rows: BASE.concat([NUEVO]).map(x => ({ nombre: x.n, flight: x.f, division: 'Open', categoria: '-83 kg', modalidad: 'Powerlifting Classic' })) });
  const errs = [];
  async function abrir(nombre, url, auth) {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    await red.montar(ctx, p, { nombre, auth, datos: datos() });
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 4, null, { timeout: 25000 });
    return p;
  }
  const mesa = await abrir('mesa', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const mesa2 = await abrir('mesa2', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const tarima = await abrir('tarima', 'livecast.html?tx=screen&evento=' + EV.id, false);
  const publico = await abrir('publico', 'livecast.html?evento=' + EV.id, false);
  const P = { mesa, mesa2, tarima, publico };
  await mesa.evaluate(() => { DATA.phase = 'compete'; R(); });
  await mesa2.evaluate(() => { DATA.phase = 'director'; R(); });
  await red.calma(2500);
  const cuantos = async () => { const o = {}; for (const [n, p] of Object.entries(P)) o[n] = await p.evaluate(() => DATA.athletes.length); o.servidor = JSON.parse(red.leer('livecast_sync/' + EV.canal).athletes).length; return o; };
  // Los lotes del servidor están sorteados (100…, 200…) aunque la marca diga
  // que no: así quedó el Regional Sur Austral. Abrir el livecast no puede
  // dejarla en false, y el pesaje no puede ofrecer "Generar Lotes".
  const lg = red.log.filter(x => x.ruta.startsWith('livecast_sync')).map(x => x.quien + ':' + JSON.parse(x.doc).lotsGenerated);
  const primeraTrue = lg.findIndex(x => /:true$/.test(x));
  ok(red.leer('livecast_sync/' + EV.canal).lotsGenerated === true && primeraTrue >= 0 && lg.slice(primeraTrue).every(x => /:true$/.test(x)),
    'abrir el livecast en dos computadores deja los lotes como sorteados, y nadie lo desmarca (' + lg.join(' ') + ')');
  const boton = await mesa.evaluate(() => { DATA.phase = 'manage'; R(); const t = document.getElementById('R').innerText; DATA.phase = 'compete'; R(); return /Re-sortear lotes/i.test(t) ? 'Re-sortear' : (/Generar Lotes/i.test(t) ? 'Generar' : '?'); });
  ok(boton === 'Re-sortear', 'Atletas y Pesaje ofrece "Re-sortear lotes", no "Generar Lotes": ' + boton);
  let c = await cuantos();
  ok(Object.values(c).every(n => n === 4), 'al principio todos tienen los 4 de la nómina cargada: ' + JSON.stringify(c));

  console.log('\nEn el admin agregan a uno más; la mesa (en Control en Vivo) re-sincroniza');
  for (const p of [mesa, mesa2]) await p.evaluate(l => { window.__FAKE.inscripciones = l; }, inscripciones());
  await mesa.evaluate(() => resyncFromAdmin());
  await red.calma(5000);
  c = await cuantos();
  ok(Object.values(c).every(n => n === 5), 'el nuevo llega al servidor y a todas las pantallas: ' + JSON.stringify(c));
  const srv = JSON.parse(red.leer('livecast_sync/' + EV.canal).athletes);
  const nuevo = srv.find(a => a.name === NUEVO.n);
  ok(nuevo && nuevo.flight === 'B', 'en la tanda del Cronograma: ' + (nuevo && nuevo.flight));
  ok(nuevo && nuevo.lot === 202, 'con el primer lote libre de su tanda: ' + (nuevo && nuevo.lot));
  ok(srv.filter(a => a.name === NUEVO.n).length === 1, 'una sola vez');
  ok(new Set(srv.map(a => a.id)).size === srv.length, 'sin ids repetidos');
  const lotesAntes = BASE.map(x => x.lot).join(',');
  ok(BASE.map(x => (srv.find(a => a.name === x.n) || {}).lot).join(',') === lotesAntes, 'los lotes de los demás no se tocan');

  console.log('\nLa otra mesa re-sincroniza también (ya lo tiene)');
  await mesa2.evaluate(() => { DATA.phase = 'manage'; R(); resyncFromAdmin(); });
  await red.calma(4000);
  c = await cuantos();
  ok(Object.values(c).every(n => n === 5), 'no se duplica: ' + JSON.stringify(c));

  console.log('\nY se queda después de recargar');
  await tarima.reload({ waitUntil: 'domcontentloaded' });
  await tarima.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length >= 4, null, { timeout: 25000 });
  await red.calma(2500);
  ok(await tarima.evaluate(n => DATA.athletes.some(a => a.name === n), NUEVO.n), 'la pantalla de tarima lo trae al volver a abrir');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

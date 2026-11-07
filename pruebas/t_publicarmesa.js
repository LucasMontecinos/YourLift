// El público no ve lo mismo que la mesa: la mesa se da cuenta y lo publica.
//
// La mesa no aplica el eco de sus propias escrituras y escribe mezclando encima
// de lo que hay en el servidor. Si el servidor quedó con otra nómina (atletas de
// más, lotes movidos), la mesa no se enteraba nunca: en el Regional Sur Austral
// la mesa tenía 86 atletas bien y el público veía 115 con los lotes cambiados.
// Ahora la mesa compara lo que volvió del servidor con lo suyo, avisa con un
// cartel, y el botón deja al servidor (y al público) exactamente con lo de la mesa.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_publicarmesa.js
const { chromium } = require('playwright');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_sur_2026', name: 'Regional Sur Prueba 2026', canal: 'Regional_Sur_Prueba_2026' };
const datos = () => ({
  eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
  inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
  admins: [{ id: 'u', role: 'admin' }],
});
const at = (i, lot, nombre) => ({ id: i, lot, name: nombre || 'Atleta ' + i, flight: 'A', sex: 'Hombre', cat: '83',
  div: 'Open', mod: 'classic', bw: 80, club: 'Club',
  att: { sq: [{ w: 100 + i * 5, r: null }, { w: 0, r: null }, { w: 0, r: null }],
         bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] } });
const atletas = () => [1, 2, 3, 4].map(i => at(i, 100 + i));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const red = crearRed({ subida: [100, 300], bajada: [100, 300] });
  red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas()),
    flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: true, forcedCurrent: null,
    timer: 60, timerOn: false, writer: 'semilla' });
  const errs = [];
  async function abrir(ctx, nombre, url, auth) {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    await red.montar(ctx, p, { nombre, auth, datos: datos() });
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 4, null, { timeout: 25000 });
    return p;
  }
  const pc1 = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  const mesa = await abrir(pc1, 'mesa', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const pc2 = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  const publico = await abrir(pc2, 'publico', 'livecast.html?evento=' + EV.id, false);
  await mesa.evaluate(() => { window.confirm = () => true; DATA.phase = 'compete'; R(); });
  await red.calma(1500);

  console.log('\nCon todo igual, no hay cartel');
  await mesa.evaluate(() => { const a = DATA.athletes.find(x => x.id === 2); a.att.sq[0].w = 140; _markAtt(2, 'att_sq_0'); saveNow(); R(); });
  await red.calma(8000);
  ok(await mesa.evaluate(() => !document.getElementById('rosterDifBanner')), 'la mesa no muestra el cartel');

  console.log('\nEl servidor queda con otra nómina, escrita a nombre de la misma mesa');
  const w = await mesa.evaluate(() => window._WRITER_ID);
  const sucio = atletas().map(a => a.id === 3 ? Object.assign(a, { lot: 1 }) : a)
    .concat([at(5, 6, 'Atleta 4'), at(6, 7, 'Intruso de otro evento')]);
  red.escribir('livecast_sync/' + EV.canal, { athletes: JSON.stringify(sucio), ts: Date.now(), tsAth: Date.now(), writer: w }, true);
  await red.calma(1000);
  const pub0 = await publico.evaluate(() => DATA.athletes.length);
  ok(pub0 === 6, 'el público ve 6 atletas (' + pub0 + ')');
  ok(await mesa.evaluate(() => DATA.athletes.length) === 4, 'la mesa sigue con sus 4 (el eco propio no se aplica)');
  await mesa.waitForFunction(() => !!document.getElementById('rosterDifBanner'), null, { timeout: 15000 }).catch(() => {});
  const txt = await mesa.evaluate(() => { const e = document.getElementById('rosterDifBanner'); return e ? e.textContent : ''; });
  ok(/PÚBLICO NO VE LO MISMO/.test(txt), 'la mesa avisa: ' + txt.replace(/\s+/g, ' ').slice(0, 140));
  ok(/2 que esta mesa no tiene/.test(txt) && /1 con otro lote/.test(txt), 'dice qué está distinto');

  console.log('\nPublicar lo de esta mesa');
  await mesa.click('#rosterDifBanner button');
  await red.calma(2500);
  const srv = red.leer('livecast_sync/' + EV.canal);
  const sa = JSON.parse(srv.athletes);
  ok(sa.length === 4 && sa.find(a => a.id === 3).lot === 103, 'el servidor queda con los 4 de la mesa y el lote 103 de vuelta');
  ok(sa.find(a => a.id === 2).att.sq[0].w === 140, 'y con los pesos de la mesa');
  await publico.waitForFunction(() => DATA.athletes.length === 4, null, { timeout: 8000 }).catch(() => {});
  const pub = await publico.evaluate(() => DATA.athletes.length + '/' + DATA.athletes.find(a => a.id === 3).lot);
  ok(pub === '4/103', 'el público ve lo mismo que la mesa: ' + pub);
  await red.calma(8000);
  ok(await mesa.evaluate(() => !document.getElementById('rosterDifBanner')), 'el cartel se va');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

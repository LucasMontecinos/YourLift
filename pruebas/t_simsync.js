// Simulación de competencia con varias pantallas conectadas por una red falsa.
//
// Se reportó en competencia: "pongo válido y después nulo por decisión del
// jurado, y en la versión del público sigue marcando válido", y pesos que no
// aparecen. Esta prueba abre de verdad Control en Vivo (dos computadores de
// mesa), el público y la pantalla de tarima, conectados por un Firestore falso
// compartido que demora las escrituras y las entregas como una red de recinto
// (pruebas/apoyo/firebase_red.js), y juega los casos: válido → nulo, la
// corrección rápida mientras la escritura anterior viaja, el jurado, dos mesas
// corrigiendo la misma casilla, una mesa con la hora corrida, pesos cargados a
// la vez desde dos equipos y una mesa que pierde la red un rato.
// Al final de cada caso, TODAS las pantallas tienen que mostrar lo mismo que el
// servidor, y eso tiene que ser lo último que se decidió.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_simsync.js
const { chromium } = require('playwright');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026',
  canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };

function datos() {
  return {
    eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
    inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
    admins: [{ id: 'u', role: 'admin' }],
  };
}
function atletas() {
  const nueve = (s) => ({ sq: [{ w: 100 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }],
    bp: [{ w: 60 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
  return [1, 2, 3, 4, 5, 6].map(i => ({ id: i, lot: i, name: 'Atleta ' + i, flight: 'A', sex: 'Hombre', cat: '83', div: 'Open',
    mod: 'classic', bw: 80, club: 'Club', att: nueve(i * 2.5) }));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  // Red de recinto: la escritura del documento tarda en subir y cada pantalla
  // lo recibe con su propia demora.
  const red = crearRed({ subida: [400, 1400], bajada: [150, 1200] });
  red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas()),
    flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: false, forcedCurrent: null,
    timer: 60, timerOn: false, writer: 'semilla' });
  const errs = [];
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
  const mesa2 = await abrir('mesa2', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const publico = await abrir('publico', 'livecast.html?evento=' + EV.id, false);
  const tarima = await abrir('tarima', 'livecast.html?tx=screen&evento=' + EV.id, false);
  const P = { mesa, mesa2, publico, tarima };
  if (process.env.DEBUG) for (const p of [mesa, mesa2]) await p.evaluate(() => {
    window.__dbg = [];
    const orig = _mergeForWrite;
    _mergeForWrite = function (loc, rem) {
      const pend = [...(window._pendingEdits || [])];
      const out = orig(loc, rem);
      pend.forEach(k => { const m = /^(\d+)\|att_(\w+)_(\d)$/.exec(k); if (!m) return; const id = +m[1], l = m[2], r = +m[3];
        const c = arr => { const a = (arr || []).find(x => x.id === id); return a && a.att[l][r] ? (a.att[l][r].r || '·') + '/' + a.att[l][r].w : '?'; };
        window.__dbg.push((Date.now() % 100000) + ' ' + k + ' loc=' + c(loc) + ' rem=' + c(rem) + ' out=' + c(out)); });
      return out;
    };
    const ss = syncToFB;
    syncToFB = async function () { window.__dbg.push((Date.now() % 100000) + ' sync inflight=' + _syncInFlight + ' pend=' + [...window._pendingEdits].join(',')); return ss.apply(this, arguments); };
  });
  for (const p of [mesa, mesa2]) {
    await p.evaluate(() => { window.confirm = () => true; window.prompt = () => null; DATA.phase = 'compete'; R(); });
  }
  await red.calma(2500);
  const info = await mesa.evaluate(() => ({ ctrl: !!window.IS_CONTROLLER, admin: !!isAdmin, doc: fbDocId(), juez: juezDocId() }));
  ok(info.ctrl && info.admin && info.doc === EV.canal, 'la mesa opera el campeonato (' + JSON.stringify(info) + ')');

  // Lo que muestra cada pantalla de una casilla, y lo que tiene el servidor.
  async function casilla(id, l, r) {
    const out = {};
    for (const [n, p] of Object.entries(P)) out[n] = await p.evaluate(([id, l, r]) => { const a = DATA.athletes.find(x => x.id === id); const at = a && a.att[l][r]; return at ? (at.r || '·') + '/' + at.w : '?'; }, [id, l, r]);
    const s = red.leer('livecast_sync/' + EV.canal); const a = JSON.parse(s.athletes).find(x => x.id === id); const at = a.att[l][r];
    out.servidor = at ? (at.r || '·') + '/' + at.w : '?';
    return out;
  }
  function todosIguales(c, esperado) { return Object.values(c).every(v => v === esperado); }
  async function caso(titulo, id, l, r, esperado, fn) {
    await fn();
    await red.calma(4500);
    const c = await casilla(id, l, r);
    ok(todosIguales(c, esperado), titulo + ' → ' + JSON.stringify(c));
  }

  console.log('\nVálido y después nulo, desde la mesa');
  await caso('válido → nulo: todas las pantallas en nulo', 1, 'sq', 0, 'n/102.5', async () => {
    await mesa.evaluate(() => overrideResult(1, 'sq', 0, 'g'));
    await red.calma(3500);
    await mesa.evaluate(() => overrideResult(1, 'sq', 0, 'n'));
  });

  console.log('\nLa corrección llega mientras la escritura anterior todavía viaja');
  await caso('válido y a los 0,3 s nulo', 2, 'sq', 0, 'n/105', async () => {
    await mesa.evaluate(() => overrideResult(2, 'sq', 0, 'g'));
    await new Promise(r => setTimeout(r, 300));
    await mesa.evaluate(() => overrideResult(2, 'sq', 0, 'n'));
  });
  await caso('nulo → válido → nulo en dos segundos', 3, 'sq', 0, 'n/107.5', async () => {
    await mesa.evaluate(() => overrideResult(3, 'sq', 0, 'n'));
    await new Promise(r => setTimeout(r, 700));
    await mesa.evaluate(() => changeResult(3, 'sq', 0, 'g'));
    await new Promise(r => setTimeout(r, 700));
    await mesa.evaluate(() => changeResult(3, 'sq', 0, 'n'));
  });
  await caso('válido y después se ANULA la decisión (queda sin decidir)', 4, 'sq', 0, '·/110', async () => {
    await mesa.evaluate(() => overrideResult(4, 'sq', 0, 'g'));
    await red.calma(3000);
    await mesa.evaluate(() => overrideResult(4, 'sq', 0, 'g'));      // tocar la misma decisión la borra
  });

  console.log('\nEl jurado, desde el panel de jueces');
  await caso('válido y el jurado lo da nulo', 5, 'sq', 0, 'n/112.5', async () => {
    await mesa.evaluate(() => overrideResult(5, 'sq', 0, 'g'));
    await red.calma(3000);
    red.escribir('judge_decisions/' + info.juez, { jurado: { ts: Date.now(), res: 'n', card: 'red', id: 5, lift: 'sq', round: 0, name: 'Atleta 5' } }, true);
  });

  console.log('\nDos mesas sobre la misma casilla');
  await caso('la mesa 1 da válido, la mesa 2 lo corrige a nulo', 6, 'sq', 0, 'n/115', async () => {
    await mesa.evaluate(() => overrideResult(6, 'sq', 0, 'g'));
    await red.calma(3000);
    await mesa2.evaluate(() => changeResult(6, 'sq', 0, 'n'));
  });
  await caso('y la mesa 1 lo vuelve a válido', 6, 'sq', 0, 'g/115', async () => {
    await mesa.evaluate(() => changeResult(6, 'sq', 0, 'g'));
  });
  await caso('una mesa con la hora mal calculada corrige igual', 1, 'bp', 0, 'n/62.5', async () => {
    await mesa.evaluate(() => changeResult(1, 'bp', 0, 'g'));
    await red.calma(3000);
    // La diferencia de hora se estima con lo que tarda en llegar el documento:
    // con la red lenta puede quedar corrida varios segundos.
    await mesa2.evaluate(() => { window._skewMs = 45000; changeResult(1, 'bp', 0, 'n'); });
  });
  await mesa2.evaluate(() => { window._skewMs = 0; });

  console.log('\nPesos cargados a la vez desde los dos computadores');
  {
    await mesa.evaluate(() => { const a = id => DATA.athletes.find(x => x.id === id);
      [[1, 132.5], [2, 135], [3, 137.5]].forEach(([id, w], i) => setTimeout(() => { a(id).att.sq[1].w = w; _markAtt(id, 'att_sq_1'); saveNow(); }, i * 250)); });
    await mesa2.evaluate(() => { const a = id => DATA.athletes.find(x => x.id === id);
      [[4, 140], [5, 142.5], [6, 145]].forEach(([id, w], i) => setTimeout(() => { a(id).att.sq[1].w = w; _markAtt(id, 'att_sq_1'); saveNow(); }, 120 + i * 250)); });
    await red.calma(6000);
    const esperado = { 1: 132.5, 2: 135, 3: 137.5, 4: 140, 5: 142.5, 6: 145 };
    let bien = true; const det = [];
    for (const id of [1, 2, 3, 4, 5, 6]) { const c = await casilla(id, 'sq', 1); if (!todosIguales(c, '·/' + esperado[id])) { bien = false; det.push(id + ':' + JSON.stringify(c)); } }
    ok(bien, 'los seis pesos llegan a todas las pantallas' + (det.length ? ' — ' + det.join(' ') : ''));
  }

  console.log('\nUna mesa pierde la red un rato');
  await caso('decide sin red y al volver se publica', 2, 'bp', 0, 'g/65', async () => {
    red.cortar('mesa', true);
    await mesa.evaluate(() => changeResult(2, 'bp', 0, 'g'));
    await new Promise(r => setTimeout(r, 4000));
    red.cortar('mesa', false);
  });
  await caso('la otra mesa la corrigió mientras tanto: gana la corrección más nueva', 3, 'bp', 0, 'n/67.5', async () => {
    red.cortar('mesa', true);
    await mesa.evaluate(() => changeResult(3, 'bp', 0, 'g'));
    await new Promise(r => setTimeout(r, 1500));
    await mesa2.evaluate(() => changeResult(3, 'bp', 0, 'n'));
    await new Promise(r => setTimeout(r, 3000));
    red.cortar('mesa', false);
  });

  console.log('\nDeshacer (Ctrl+Z)');
  await caso('válido y deshacer: vuelve a sin decidir en todas', 4, 'bp', 0, '·/70', async () => {
    await mesa.evaluate(() => changeResult(4, 'bp', 0, 'g'));
    await red.calma(3000);
    await mesa.evaluate(() => histUndo());
  });

  console.log('\n4º intento');
  await caso('se agrega y se borra: nadie lo sigue viendo', 5, 'bp', 3, '?', async () => {
    await mesa.evaluate(() => { DATA.lift = 'bp'; DATA.round = 2; add4thAttempt(5, 'bp', 'self'); });
    await red.calma(3000);
    await mesa.evaluate(() => remove4thAttempt(5, 'bp'));
  });

  console.log('\nPrueba de carga: 40 cambios al azar desde las dos mesas');
  {
    const ops = []; const fin = {}; const __hist = {};
    const celdas = [];
    [1, 2, 3, 4, 5, 6].forEach(id => ['sq', 'dl'].forEach(l => [1, 2].forEach(r => celdas.push([id, l, r]))));
    for (let i = 0; i < 40; i++) {
      const [id, l, r] = celdas[Math.floor(Math.random() * celdas.length)];
      const quien = Math.random() < 0.5 ? mesa : mesa2;
      const tipo = Math.random();
      __hist[id + l + r] = (__hist[id + l + r] || []).concat([(quien === mesa ? 'M1 ' : 'M2 ') + (tipo < 0.5 ? 'w' : (tipo < 0.75 ? 'g' : 'n')) + ' @' + (Date.now() % 100000)]);
      if (tipo < 0.5) {
        const w = 150 + Math.floor(Math.random() * 40) * 2.5;
        await quien.evaluate(([id, l, r, w]) => { const a = DATA.athletes.find(x => x.id === id); a.att[l][r].w = w; _markAtt(id, 'att_' + l + '_' + r); saveNow(); }, [id, l, r, w]);
        fin[id + l + r] = Object.assign(fin[id + l + r] || { r: null }, { w });
      } else {
        const res = tipo < 0.75 ? 'g' : 'n';
        await quien.evaluate(([id, l, r, res]) => { const a = DATA.athletes.find(x => x.id === id); a.att[l][r].r = res; _markAtt(id, 'att_' + l + '_' + r); saveNow(); }, [id, l, r, res]);
        fin[id + l + r] = Object.assign(fin[id + l + r] || {}, { r: res });
      }
      await new Promise(rr => setTimeout(rr, 150 + Math.random() * 500));
    }
    await red.calma(8000);
    let malas = [];
    for (const k of Object.keys(fin)) {
      const id = +k[0], l = k.slice(1, 3), r = +k[3];
      const c = await casilla(id, l, r);
      const vals = new Set(Object.values(c));
      const srv = c.servidor;
      // Si los dos últimos cambios de la casilla los hicieron mesas distintas con
      // menos de 1,5 s de diferencia, el orden lo deciden los relojes de cada
      // equipo: basta con que todas las pantallas terminen iguales.
      const h = __hist[k] || [], u = h[h.length - 1] || '', pu = h[h.length - 2] || '';
      const at = x => +(x.split('@')[1] || 0);
      const casiJuntos = pu && u.slice(0, 2) !== pu.slice(0, 2) && Math.abs(at(u) - at(pu)) < 1500;
      const okR = casiJuntos || fin[k].r === undefined || srv.split('/')[0] === (fin[k].r || '·');
      const okW = casiJuntos || fin[k].w === undefined || +srv.split('/')[1] === fin[k].w;
      if (vals.size !== 1 || !okR || !okW) {
        malas.push(k + ' esperado ' + JSON.stringify(fin[k]) + ' ' + JSON.stringify(c));
        if (process.env.DEBUG) {
          console.log('    historia', k, JSON.stringify(__hist[k]));
          for (const [n, p] of Object.entries(P)) console.log('     ', n, await p.evaluate(([id, l, r]) => JSON.stringify(DATA.athletes.find(x => x.id === id).att[l][r]), [id, l, r]));
          const sv = JSON.parse(red.leer('livecast/sync'.replace('livecast/sync', 'livecast_sync/' + EV.canal)).athletes).find(x => x.id === id).att[l][r];
          console.log('      servidor', JSON.stringify(sv));
          for (const [n, p] of [['mesa', mesa], ['mesa2', mesa2]]) {
            const d = await p.evaluate(k => (window.__dbg || []).filter(x => x.indexOf(k) >= 0 || x.indexOf(' sync ') >= 0 && x.indexOf(k) >= 0), id + '|att_' + l + '_' + r);
            d.forEach(x => console.log('        dbg ' + n + ' ' + x));
          }
          red.log.filter(e => e.ruta === 'livecast_sync/' + EV.canal && e.doc).forEach(e => {
            const c = JSON.parse(JSON.parse(e.doc).athletes).find(x => x.id === id).att[l][r];
            console.log('        ' + (e.t % 100000) + ' ' + e.quien + (e.tx ? ' tx' : ' set') + ' ' + JSON.stringify(c));
          });
        }
      }
    }
    ok(!malas.length, 'todas las pantallas terminan iguales y con el último cambio de cada casilla' + (malas.length ? ' — ' + malas.slice(0, 3).join(' | ') : ' (' + Object.keys(fin).length + ' casillas)'));
  }

  console.log('\nReiniciar datos en vivo');
  {
    await mesa.evaluate(() => { DATA.athletes.forEach(a => ['sq', 'bp', 'dl'].forEach(l => a.att[l] = a.att[l].slice(0, 3).map((x, i) => ({ w: i ? 0 : x.w, r: null })))); window._forceFullWrite = true; saveNow(); });
    await red.calma(5000);
    const c = await casilla(6, 'sq', 0);
    ok(todosIguales(c, '·/115'), 'todas las decisiones se borran en todas las pantallas → ' + JSON.stringify(c));
  }

  // El público y la pantalla de tarima dibujan lo mismo que tienen en memoria.
  const vista = await publico.evaluate(() => { go('liveView'); return document.body.innerText.indexOf('Atleta 1') >= 0; });
  ok(vista, 'el público dibuja la competencia');
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

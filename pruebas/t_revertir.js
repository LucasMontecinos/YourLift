// Revertir una decisión y que se quede revertida.
//
// Se reportó en competencia: "revierto y a los minutos vuelve a la primera
// decisión". Había dos caminos por los que volvía:
//
//   1. Dos equipos operando. Uno con la red caída guardaba su decisión como
//      PENDIENTE; mientras tanto ignoraba la corrección que llegaba de la mesa, y
//      al recuperar la red la volvía a escribir encima. Ahora cada intento lleva
//      la hora de su último cambio y gana el más nuevo.
//   2. El modo jueces volvía a aplicar las luces en CADA cambio del documento de
//      los jueces mientras las tres siguieran puestas (y el documento cambia
//      solo, cuando la mesa avisa quién está en barra). Ahora cada votación se
//      aplica una vez, al intento que estaba en barra, y solo si sigue sin juzgar.
//
// Y al corregir, el minuto para declarar el intento siguiente no vuelve a 60.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_revertir.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(`http://localhost:${PUERTO}/livecast.html?practica=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length > 2, null, { timeout: 20000 });
  await p.waitForTimeout(800);

  console.log('\nDos equipos: gana el cambio más nuevo, no el pendiente');
  const m = await p.evaluate(() => {
    const a = DATA.athletes[0];
    const local = JSON.parse(JSON.stringify(DATA.athletes));
    const remoto = JSON.parse(JSON.stringify(DATA.athletes));
    const k = a.id + '|att_sq_0';
    // Este equipo marcó VÁLIDO hace rato y no pudo guardarlo (pendiente).
    local[0].att.sq[0] = { w: 100, r: 'g', t: 1000 };
    window._pendingEdits.add(k);
    // La mesa lo corrigió a NULO después.
    remoto[0].att.sq[0] = { w: 100, r: 'n', t: 2000 };
    const llega = _mergeAthletes(local, remoto)[0].att.sq[0].r;
    const sigue = window._pendingEdits.has(k);
    window._pendingEdits.add(k);
    const escribe = _mergeForWrite(local, remoto)[0].att.sq[0].r;
    // Al revés: lo mío es más nuevo → manda lo mío.
    window._pendingEdits.add(k);
    local[0].att.sq[0] = { w: 100, r: 'g', t: 3000 };
    const mio = _mergeAthletes(local, remoto)[0].att.sq[0].r;
    const mioEscribe = _mergeForWrite(local, remoto)[0].att.sq[0].r;
    window._pendingEdits.delete(k);
    // Y la casilla conserva lo que traía (las luces de los jueces, por ejemplo).
    window._pendingEdits.add(k);
    local[0].att.sq[0] = { w: 100, r: 'g', t: 5000 };
    remoto[0].att.sq[0] = { w: 100, r: null, t: 1, luces: { izq: 'white', central: 'white', der: 'white' } };
    const conLuces = !!_mergeAthletes(local, remoto)[0].att.sq[0].luces;
    window._pendingEdits.delete(k);
    return { llega, sigue, escribe, mio, mioEscribe, conLuces };
  });
  ok(m.llega === 'n', 'la corrección de la mesa llega aunque acá hubiera un válido pendiente');
  ok(!m.sigue, 'y el válido viejo deja de estar pendiente');
  ok(m.escribe === 'n', 'al guardar, este equipo ya no vuelve a escribir el válido viejo');
  ok(m.mio === 'g' && m.mioEscribe === 'g', 'si lo de acá es más nuevo, manda lo de acá (como siempre)');
  ok(m.conLuces, 'la casilla conserva las luces que traía');

  const t = await p.evaluate(() => {
    const a = DATA.athletes[0];
    a.att.sq[0] = { w: 100, r: null };
    _markAtt(a.id, 'att_sq_0');
    return typeof a.att.sq[0].t === 'number' && a.att.sq[0].t > 0;
  });
  ok(t, 'cada cambio de un intento le anota la hora');

  console.log('\nModo jueces: cada votación se aplica una vez');
  await p.evaluate(() => {
    // Firestore falso dentro de la página: se guardan los oyentes para poder
    // mandarles documentos a mano.
    window.__oy = {};
    window._fb = Object.assign({}, window._fb || {}, {
      doc: (_d, col, id) => ({ col, id }),
      onSnapshot: (ref, cb) => { window.__oy[ref.col] = cb; return () => {}; },
      setDoc: async () => {},
    });
    fbReady = true; fbDB = {};
    DATA.lift = 'sq'; DATA.round = 0; DATA.forcedCurrent = null;
    const fl = DATA.athletes[0].flight; DATA.flight = fl;
    DATA.athletes.forEach(x => { x.att.sq = [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }]; });
    const deFl = DATA.athletes.filter(x => x.flight === fl);
    deFl.forEach((x, i) => { x.att.sq[0] = { w: 100 + i * 10, r: null }; });
    judgeMode = true;
    startJudgeListener();
    window.__juez = d => window.__oy.judge_decisions({ exists: () => true, data: () => d });
    window.__juez({ izq: null, central: null, der: null, reset_ts: 1 });   // lo que había al encender
  });
  const primero = await p.evaluate(() => liftQueue()[0].id);
  await p.evaluate(() => {
    __juez({ izq: 'white', central: null, der: null, reset_ts: 2 });
    __juez({ izq: 'white', central: 'white', der: 'red', reset_ts: 2 });
  });
  await p.waitForTimeout(2400);
  const r1 = await p.evaluate(id => DATA.athletes.find(x => x.id === id).att.sq[0].r, primero);
  ok(r1 === 'g', 'tres luces: dos blancas → válido al que estaba en barra');

  // La mesa revierte a NULO.
  await p.evaluate(id => { changeResult(id, 'sq', 0, 'n'); }, primero);
  const siguiente = await p.evaluate(() => liftQueue()[0].id);
  // El documento de los jueces vuelve a cambiar con las mismas luces (la mesa
  // avisa quién está en barra, por ejemplo).
  await p.evaluate(() => {
    __juez({ izq: 'white', central: 'white', der: 'red', reset_ts: 2, athlete_name: 'Otro' });
    __juez({ izq: 'white', central: 'white', der: 'red', reset_ts: 2, athlete_name: 'Otro más' });
  });
  await p.waitForTimeout(2400);
  const r2 = await p.evaluate(id => DATA.athletes.find(x => x.id === id).att.sq[0].r, primero);
  const r3 = await p.evaluate(id => DATA.athletes.find(x => x.id === id).att.sq[0].r, siguiente);
  ok(r2 === 'n', 'lo revertido se queda revertido: ' + r2);
  ok(r3 === null, 'y las luces viejas no le caen al siguiente en barra: ' + r3);

  // Si la mesa ya lo juzgó a mano antes que llegue el tercer voto, manda la mesa.
  await p.evaluate(id => {
    __juez({ izq: null, central: null, der: null, reset_ts: 3 });
    __juez({ izq: 'red', central: null, der: null, reset_ts: 3 });
    overrideResult(id, 'sq', 0, 'g');
    __juez({ izq: 'red', central: 'red', der: 'red', reset_ts: 3 });
  }, siguiente);
  await p.waitForTimeout(2400);
  const r4 = await p.evaluate(id => DATA.athletes.find(x => x.id === id).att.sq[0].r, siguiente);
  ok(r4 === 'g', 'si la mesa ya decidió a mano, las luces no la pisan: ' + r4);

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

// El minuto para entregar el intento siguiente.
//
// Reportado en competencia: a veces se queda pegado, y un peso cargado con dos
// segundos restantes salía como fuera de tiempo. Causas:
//   · se contaba con la hora de cada equipo y no con el reloj común: con las
//     horas descuadradas, uno lo veía detenido y otro lo daba por vencido antes;
//   · al vencer, cada equipo guardaba su copia de los relojes, y podía volver a
//     subir uno que otro ya había cerrado al cargar el peso (quedaba en TIEMPO);
//   · el peso se guarda al salir de la casilla: lo que se empezó a escribir a
//     tiempo terminaba de cargarse vencido.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_timerentrega.js
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
  await p.evaluate(() => {
    window.__toasts = []; const t0 = showToastLC; showToastLC = m => { window.__toasts.push(m); return t0(m); };
    window._CT_ENABLED = true;
    DATA.lift = 'sq'; DATA.round = 0;
    DATA.athletes.forEach(x => { x.att.sq = [{ w: 100, r: null }, { w: 0, r: null }, { w: 0, r: null }]; });
    DATA.changeTimers = {};
  });

  console.log('\nSe cuenta con el reloj común');
  const r1 = await p.evaluate(async () => {
    const a = DATA.athletes[0];
    window._skewMs = -30000;          // este equipo va 30 s ADELANTADO respecto del reloj común
    setResult(a.id, 'sq', 0, 'g');
    await new Promise(r => setTimeout(r, 1300));
    const ct = DATA.changeTimers[a.id + '_sq_1'];
    window._skewMs = 0;
    return ct && { rem: ct.remaining, exp: ct.expired };
  });
  ok(r1 && !r1.exp && r1.rem >= 57 && r1.rem <= 60, 'con la hora del equipo corrida, el minuto igual va bien: ' + JSON.stringify(r1));

  console.log('\nUn intento con peso no tiene minuto corriendo');
  const r2 = await p.evaluate(async () => {
    const a = DATA.athletes[1];
    DATA.changeTimers[a.id + '_sq_1'] = { remaining: 0, expired: true, startedAt: _ahora() - 90000 };   // repuesto por otro equipo
    a.att.sq[1].w = 110;
    await new Promise(r => setTimeout(r, 1300));
    return !DATA.changeTimers[a.id + '_sq_1'];
  });
  ok(r2, 'si ya tiene su peso, el reloj se cierra aunque otro equipo lo haya repuesto');

  console.log('\nVencer no se guarda');
  const r3 = await p.evaluate(async () => {
    const a = DATA.athletes[2];
    DATA.changeTimers[a.id + '_sq_1'] = { remaining: 1, expired: false, startedAt: _ahora() - 59500 };
    let guardados = 0; const s0 = save; save = function () { guardados++; return s0.apply(this, arguments); };
    await new Promise(r => setTimeout(r, 1600));
    save = s0;
    return { exp: DATA.changeTimers[a.id + '_sq_1'].expired, guardados };
  });
  ok(r3.exp, 'el reloj vence');
  ok(r3.guardados === 0, 'y eso no se escribe al servidor (cada pantalla lo calcula): ' + r3.guardados + ' guardados');

  console.log('\nUn peso que se empezó a escribir a tiempo, entra a tiempo');
  const r4 = await p.evaluate(async () => {
    const a = DATA.athletes[3], k = a.id + '_sq_1';
    DATA.changeTimers[k] = { remaining: 2, expired: false, startedAt: _ahora() - 58000 };
    _ctEmpezo(k);                                    // primera tecla con 2 s restantes
    await new Promise(r => setTimeout(r, 3400));      // termina de escribir ya vencido
    const vencido = DATA.changeTimers[k] && DATA.changeTimers[k].expired;
    window.__toasts = [];
    setAtt(a.id, 'sq', 1, '110');
    const tarde = window.__toasts.some(m => /expirado/i.test(m));
    // Y uno que se empezó tarde sí avisa.
    const b2 = DATA.athletes[4], k2 = b2.id + '_sq_1';
    DATA.changeTimers[k2] = { remaining: 0, expired: true, startedAt: _ahora() - 70000 };
    window.__toasts = [];
    setAtt(b2.id, 'sq', 1, '110');
    const avisa = window.__toasts.some(m => /expirado/i.test(m));
    return { vencido, tarde, avisa, peso: a.att.sq[1].w };
  });
  ok(r4.vencido, '(el reloj alcanzó a vencer mientras escribía)');
  ok(!r4.tarde && r4.peso === 110, 'no sale el aviso de tiempo expirado y el peso queda');
  ok(r4.avisa, 'el que se empezó a escribir con el tiempo ya vencido sí avisa');

  console.log('\nEl reloj de tarima no queda doble');
  const r5 = await p.evaluate(async () => {
    startTimer(); startTimer();          // dos arranques seguidos
    pauseTimer();
    const t = DATA.timer;
    await new Promise(r => setTimeout(r, 2200));
    return { antes: t, despues: DATA.timer, on: DATA.timerOn };
  });
  ok(r5.antes === r5.despues && !r5.on, 'arrancado dos veces y pausado, se queda quieto: ' + r5.antes + ' → ' + r5.despues);

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

// Cambio de intento (reglamento IPF).
//
// El 3er intento de peso muerto —y el 3er de banca de quien compite solo en
// banca— se puede cambiar hasta dos veces. En Control en Vivo sale el botón
// "CAMBIO n/2" arriba de la casilla y la opción en el menú ⋮; cada cambio suma
// a la cuenta. Tocar la casilla para corregir el peso NO cuenta. Mientras el
// intento no se juzga, la pantalla de tarima y la transmisión muestran el
// cartel amarillo "CAMBIO DE INTENTO".
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cambiointento.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/livecast.html?practica=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length > 2, null, { timeout: 20000 });
  await p.waitForTimeout(600);

  const r = await p.evaluate(() => {
    const out = {};
    window.__resp = []; window.prompt = () => window.__resp.shift(); window.confirm = () => true;
    window.__toasts = []; const t0 = showToastLC; showToastLC = m => { window.__toasts.push(m); return t0(m); };
    const pl = DATA.athletes.find(a => !a.__is4 && a.mod !== 'onlybench');
    const ob = DATA.athletes.find(a => a.id !== pl.id);
    pl.mod = 'classic'; ob.mod = 'onlybench';
    pl.att.dl[2] = { w: 200, r: null }; pl.att.dl[1] = { w: 190, r: 'g' }; pl.att.bp[2] = { w: 120, r: null };
    ob.att.bp[2] = { w: 100, r: null };
    const celda = (a, l, j) => _attCellCompete(a, l, j, false);
    out.btnDl3 = /att-cambio/.test(celda(pl, 'dl', 2));
    out.btnDl2 = /att-cambio/.test(celda(pl, 'dl', 1));
    out.btnBpPl = /att-cambio/.test(celda(pl, 'bp', 2));
    out.btnBpOb = /att-cambio/.test(celda(ob, 'bp', 2));
    ob.mod = 'classic_bench'; out.btnBpCb = /att-cambio/.test(celda(ob, 'bp', 2)); ob.mod = 'onlybench';
    window._attMenuOpen = pl.id + '_dl_2';
    out.menu = /Cambio de intento \(0\/2\)/.test(_attMenuHtml(pl, 'dl', 2, 1));
    window._attMenuOpen = null;

    // Corregir tocando la casilla no cuenta.
    window.__resp.push('202.5'); editAtt(pl.id, 'dl', 2);
    out.trasEditar = [pl.att.dl[2].w, pl.att.dl[2].cambios || 0];
    // El mismo peso tampoco.
    window.__resp.push('202.5'); cambioIntento(pl.id, 'dl', 2);
    out.mismo = pl.att.dl[2].cambios || 0;
    window.__resp.push('205'); cambioIntento(pl.id, 'dl', 2);
    out.uno = [pl.att.dl[2].w, pl.att.dl[2].cambios];
    out.boton1 = /CAMBIO 1\/2/.test(celda(pl, 'dl', 2));
    window.__resp.push('207.5'); cambioIntento(pl.id, 'dl', 2);
    window.__resp.push('210'); cambioIntento(pl.id, 'dl', 2);
    out.dos = [pl.att.dl[2].w, pl.att.dl[2].cambios];
    out.avisoLleno = window.__toasts.some(t => /ya usó sus 2 cambios/.test(t));

    // En tarima: el cartel sale en la pantalla y en la transmisión.
    DATA.flight = pl.flight; DATA.lift = 'dl'; DATA.round = 2;
    forceCurrentAttempt(pl.id, 'dl', 2);
    const cur = liftQueue()[0];
    out.cur = cur && cur.id === pl.id;
    out.cuenta = _cambiosIntentoActual(cur);
    out.barra = /CAMBIO DE INTENTO/.test(renderScreenBarra(cur));
    // Transmisión: cartel suelto abajo a la derecha, no dentro del marcador, y sin el nombre.
    out.txSb = /CAMBIO DE INTENTO/.test(renderTxScoreboard(cur, false) + _renderTxCerScoreboardBL(cur, { noAnimate: true }));
    if (!_txDirState) _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT));
    const caja = document.createElement('div'); document.body.appendChild(caja);
    _txDirLastSig = null; renderTxDirector(caja);
    const cartel = [...caja.children].find(d => /CAMBIO DE INTENTO/.test(d.textContent));
    out.tx = !!cartel && /bottom:24px/.test(cartel.getAttribute('style')) && /right:24px/.test(cartel.getAttribute('style'));
    out.txSinNombre = !!cartel && cartel.textContent.indexOf(pl.name) < 0;
    // Juzgado: el cartel se apaga.
    pl.att.dl[2].r = 'g';
    out.juzgado = [_cambiosIntentoActual(cur), /CAMBIO DE INTENTO/.test(renderScreenBarra(cur)), /att-cambio/.test(celda(pl, 'dl', 2))];
    return out;
  });

  console.log('\nDónde se puede cambiar');
  ok(r.btnDl3, 'botón CAMBIO arriba del 3er peso muerto');
  ok(!r.btnDl2, 'el 2do peso muerto no tiene botón');
  ok(!r.btnBpPl, 'la banca de un powerlifter no tiene botón');
  ok(r.btnBpOb, 'el 3er intento de banca de un Only Bench sí');
  ok(!r.btnBpCb, 'Classic + Only Bench no (solo el Only Bench puro)');
  ok(r.menu, 'el menú ⋮ trae "Cambio de intento (0/2)"');
  console.log('\nLa cuenta');
  ok(r.trasEditar[0] === 202.5 && r.trasEditar[1] === 0, 'corregir tocando la casilla no cuenta como cambio');
  ok(r.mismo === 0, 'mandar el mismo peso no cuenta');
  ok(r.uno[0] === 205 && r.uno[1] === 1 && r.boton1, 'primer cambio: 205 kg, botón dice 1/2');
  ok(r.dos[0] === 207.5 && r.dos[1] === 2 && r.avisoLleno, 'segundo cambio: 207.5 kg; un tercero no entra');
  console.log('\nEl cartel');
  ok(r.cur && r.cuenta === 2, 'el atleta en tarima tiene el intento cambiado');
  ok(r.barra, 'pantalla de tarima: CAMBIO DE INTENTO');
  ok(r.tx, 'transmisión: CAMBIO DE INTENTO abajo a la derecha');
  ok(!r.txSb, 'no va dentro del marcador');
  ok(r.txSinNombre, 'el cartel no lleva el nombre del atleta');
  ok(r.juzgado[0] === 0 && !r.juzgado[1] && !r.juzgado[2], 'con la decisión, el cartel y el botón se van');
  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

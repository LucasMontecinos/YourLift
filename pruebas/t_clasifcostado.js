// Transmisión: la Clasificación entra por el costado (sin cascada) y el marcador
// va esquinado abajo a la izquierda.
//
// La cascada roja, blanca y negra es para las escenas a pantalla completa (perfil,
// Ya volvemos). La Clasificación es una caja sobre la cámara: con la cascada se
// tapaba todo para mostrar una caja, y en el navegador de OBS se veía trabada.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_clasifcostado.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=director&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const n9 = () => ({ sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
    DATA.athletes = [1, 2, 3].map(i => { const a = { id: i, name: 'Atleta Numero ' + i, lot: i, flight: 'A', sex: 'Hombre', cat: '83', div: 'Open', mod: 'classic', bw: 82, club: 'Club', bombed: false, att: n9() }; a.att.sq[0].w = 200 + i * 5; return a; });
    DATA.lift = 'sq'; DATA.round = 0; DATA.flight = 'A';
    _txDirState = Object.assign({}, TX_DIR_DEFAULT, { scoreboard: { active: true, until: 0, scale: 1 } });
    renderTxWidget();
  });
  await p.waitForTimeout(1500);

  console.log('\nEl marcador');
  const sb = await p.evaluate(() => { const e = document.querySelector('.sb-card-explode'); const r = e.getBoundingClientRect(); return { left: Math.round(r.left), abajo: Math.round(innerHeight - r.bottom) }; });
  ok(sb.left <= 30 && sb.abajo <= 30, 'esquinado abajo a la izquierda, a ~24 px de los bordes (' + sb.left + ', ' + sb.abajo + ')');

  console.log('\nLa Clasificación');
  await p.evaluate(() => { _txDirState.leaderboard = { active: true, until: 0, cat: '', scale: 1 }; renderTxWidget(); });
  await p.waitForTimeout(80);
  const cascada = await p.evaluate(() => !!document.querySelector('[style*="txStripeFwd"]'));
  ok(!cascada, 'entra sin la cascada');
  const x1 = await p.evaluate(() => { const e = document.querySelector('[style*="txLbIn"]'); return e ? Math.round(e.getBoundingClientRect().left) : null; });
  ok(x1 !== null && x1 > 300, 'arranca corrida a la derecha, fuera de su lugar (' + x1 + ' px)');
  // Un redibujo a mitad de camino no la hace partir de nuevo
  await p.waitForTimeout(250);
  const xa = await p.evaluate(() => { const e = document.querySelector('[style*="txLbIn"]'); return e ? e.getBoundingClientRect().left : null; });
  await p.evaluate(() => { _txDirLastSig = null; renderTxWidget(); });
  const xb = await p.evaluate(() => { const e = document.querySelector('[style*="txLbIn"]'); return e ? e.getBoundingClientRect().left : null; });
  ok(xa !== null && xb !== null && xb <= xa + 5, 'si se redibuja a mitad de camino, sigue desde donde iba (' + Math.round(xa) + ' → ' + Math.round(xb) + ')');
  await p.waitForTimeout(900);
  const fin = await p.evaluate(() => { const t = document.body.innerText; const caja = [...document.querySelectorAll('div')].find(d => /CLASIFICACI/.test(d.textContent || '') && d.getBoundingClientRect().width > 300 && d.getBoundingClientRect().width < 1700); return { t: /CLASIFICACI/.test(t), x: caja ? Math.round(caja.getBoundingClientRect().left) : -1 }; });
  ok(fin.t && fin.x > 0 && fin.x < 700, 'termina en su lugar, al centro (' + fin.x + ' px)');
  await p.screenshot({ path: process.env.CAPTURA || '/dev/null' }).catch(() => {});
  ok(await p.evaluate(() => !document.querySelector('.sb-card-explode')), 'el marcador se esconde mientras está la Clasificación');

  console.log('\nAl sacarla');
  await p.evaluate(() => { _txDirState.leaderboard.active = false; renderTxWidget(); });
  await p.waitForTimeout(80);
  ok(await p.evaluate(() => !document.querySelector('[style*="txStripeBack"]') && !!document.querySelector('[style*="txLbOut"]')), 'sale por el costado, sin cascada');
  await p.waitForTimeout(1600);
  ok(await p.evaluate(() => !/CLASIFICACI/.test(document.body.innerText) && !!document.querySelector('.sb-card-explode')), 'se va y vuelve el marcador');

  console.log('\nEl perfil sigue con su cascada');
  await p.evaluate(() => { _txDirState.profile = { active: true, until: 0, scale: 1 }; renderTxWidget(); });
  await p.waitForTimeout(80);
  ok(await p.evaluate(() => !!document.querySelector('[style*="txStripeFwd"]')), 'el perfil entra con la cascada, como siempre');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

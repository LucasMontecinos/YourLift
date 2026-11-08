// El Perfil de la transmisión cubre toda la pantalla aunque se le cambie el tamaño.
//
// El TAMAÑO del Perfil (Control Remoto / Control TX) achicaba el bloque entero,
// fondo negro incluido: bajo 1.00x quedaba un recuadro al medio de la
// transmisión con la cámara asomando por los costados. Ahora el tamaño se le
// aplica solo a lo de adentro; el fondo y los logos de la esquina no se mueven.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_perfilescala.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=director&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
  await p.waitForTimeout(1500);
  for (const esc of [1, 0.6, 1.4]) {
    await p.evaluate(e => {
      const a = DATA.athletes.find(x => x.flight === DATA.flight) || DATA.athletes[0];
      a.att[DATA.lift][0].w = a.att[DATA.lift][0].w || 150; a.att[DATA.lift][0].r = null;
      window._txDirState = window._txDirState || {};
      _txDirState.profile = { active: true, until: 0, scale: e };
      renderTxWidget();
    }, esc);
    await p.waitForTimeout(1800);   // que termine la animación de entrada
    const r = await p.evaluate(() => {
      // El fondo negro del perfil: el primer div con background:#000 a pantalla completa.
      const fondo = [...document.querySelectorAll('div')].find(d => /background:#000/.test(d.getAttribute('style') || '') && d.querySelector('.txCascade'));
      const rf = fondo ? fondo.getBoundingClientRect() : null;
      const col = document.querySelector('.txCascade').getBoundingClientRect();
      return { fondo: rf && [rf.left, rf.top, rf.width, rf.height].map(Math.round), ancho: Math.round(col.width) };
    });
    ok(r.fondo && r.fondo[0] <= 0 && r.fondo[1] <= 0 && r.fondo[2] >= 1920 && r.fondo[3] >= 1080,
      esc.toFixed(2) + 'x: el fondo cubre toda la pantalla (' + (r.fondo || []).join(',') + ')');
    if (esc === 1) p._ancho1 = r.ancho;
    else ok(Math.abs(r.ancho / p._ancho1 - esc) < 0.05, esc.toFixed(2) + 'x: lo de adentro cambia de tamaño (' + r.ancho + ' px)');
  }
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

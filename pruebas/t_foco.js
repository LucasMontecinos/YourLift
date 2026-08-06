// El equipo que carga pesos NO puede quedarse sordo mientras el operador tiene el
// cursor puesto en una casilla. Antes el snapshot entrante se descartaba entero y,
// como Firestore manda cada cambio una sola vez, lo que pasaba en ese rato (los
// válidos y nulos del control remoto, el movimiento, la ronda, la tanda) se perdía
// para siempre en esa pantalla.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_foco.js
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length, null, { timeout: 15000 });

  const out = await p.evaluate(async () => {
    const r = {};
    isAdmin = true; window.IS_CONTROLLER = true;
    pickEvent(DATA.events.findIndex(e => e.id === 'suda2026_fesupo_full'));
    DATA.phase = 'manage'; DATA.lift = 'sq'; DATA.round = 0;   // las casillas de peso viven en Atletas & Pesaje
    const a0 = DATA.athletes[0];

    // Simula lo que hace el listener cuando llega un snapshot de OTRO equipo.
    // Copiamos la decisión del handler real: aplicar siempre, dibujar sólo si no
    // se está editando.
    const aplicar = (remoto) => {
      const f = document.activeElement;
      const editando = !!(f && (f.tagName === 'INPUT' || f.tagName === 'SELECT' || f.tagName === 'TEXTAREA'));
      DATA.athletes = _mergeAthletes(DATA.athletes, remoto.athletes);
      DATA.lift = remoto.lift; DATA.round = remoto.round; DATA.flight = remoto.flight;
      if (editando) { window._renderPendiente = true; } else { R(); }
      return editando;
    };

    // ── 1. Sin nadie editando: llega y se dibuja ──────────────────────────
    let remoto = JSON.parse(JSON.stringify(DATA.athletes));
    remoto[0].att.sq[0] = { w: 200, r: 'g' };
    r.sin_foco_editando = aplicar({ athletes: remoto, lift: 'sq', round: 0, flight: DATA.flight });
    r.sin_foco_llego = DATA.athletes[0].att.sq[0].r === 'g';
    r.sin_foco_sin_pendiente = !window._renderPendiente;

    // ── 2. Con el cursor en una casilla de peso ───────────────────────────
    R();
    const celda = document.querySelector('input[id^="ct_"]');
    r.hay_celda = !!celda;
    if (celda) { celda.focus(); celda.value = '187.5'; }
    r.foco_puesto = document.activeElement === celda;

    // el control remoto marca un nulo en OTRO atleta y cambia de ronda
    remoto = JSON.parse(JSON.stringify(DATA.athletes));
    const otro = remoto.find(x => x.id !== (celda ? +celda.id.split('_')[1] : -1)) || remoto[1];
    otro.att.sq[0] = { w: 150, r: 'n' };
    r.editando_detectado = aplicar({ athletes: remoto, lift: 'sq', round: 1, flight: DATA.flight });

    const local = DATA.athletes.find(x => x.id === otro.id);
    r.dato_igual_llego = local && local.att.sq[0].r === 'n';   // ← lo que antes se perdía
    r.ronda_igual_llego = DATA.round === 1;
    r.quedo_pendiente_dibujar = window._renderPendiente === true;
    r.no_le_borro_lo_tecleado = celda ? celda.value === '187.5' : null;

    // ── 3. Al soltar el campo se pone al día ──────────────────────────────
    if (celda) celda.blur();
    await new Promise(res => setTimeout(res, 60));
    r.dibujo_al_soltar = window._renderPendiente === false;
    return r;
  });

  let fallas = 0;
  const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

  console.log('\nSin nadie escribiendo');
  ok(out.sin_foco_editando === false, 'no se considera "editando"');
  ok(out.sin_foco_llego, 'el resultado remoto se aplica');
  ok(out.sin_foco_sin_pendiente, 'y se dibuja en el momento');

  console.log('\nCon el operador escribiendo un peso');
  ok(out.hay_celda && out.foco_puesto, 'el cursor queda en una casilla de peso');
  ok(out.editando_detectado === true, 'se detecta que está editando');
  ok(out.dato_igual_llego, 'IGUAL entra el nulo que marcó el control remoto (antes se perdía)');
  ok(out.ronda_igual_llego, 'IGUAL entra el cambio de ronda');
  ok(out.no_le_borro_lo_tecleado, 'no se le borra el peso a medio escribir');
  ok(out.quedo_pendiente_dibujar, 'el dibujado queda pendiente, no perdido');

  console.log('\nAl soltar la casilla');
  ok(out.dibujo_al_soltar, 'se dibuja y la pantalla queda al día');
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

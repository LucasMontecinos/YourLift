// Timer de descanso en las pantallas de tarima.
//
// "Cuánto falta para que empiece": el cartel con la cuenta regresiva se pone
// desde el engranaje de abajo a la izquierda y se ve en la Pantalla de Intentos,
// en Atleta en Barra y en la Tabla de Jornada.
//
// Es EL MISMO timer que el de la transmisión (Control TX → Descanso): vive en
// livecast_director/{evento}. Por eso lo que se prueba acá es que las pantallas
// lean ESE estado y no uno propio — dos relojes de descanso distintos marcando
// cosas distintas en la misma sala sería peor que no tener ninguno.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_descanso.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

async function abrir(b, qs) {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  p.on('dialog', async d => { await d.accept(); });
  await p.goto(`http://localhost:${PUERTO}/livecast.html?${qs}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length, null, { timeout: 30000 });
  return p;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  // ── Pantalla de Intentos ────────────────────────────────────────────────
  const p = await abrir(b, 'evento=suda2026_fesupo_full&tx=screen&modo=intentos');
  p.on('pageerror', e => errs.push(e.message));

  const r = await p.evaluate(() => {
    const out = {};
    // La pantalla de tarima se abre desde el mismo navegador del control, con la
    // sesión puesta: es lo que le deja poner el descanso desde el engranaje. Sin
    // sesión el panel lo dice y solo muestra.
    isAdmin = true;
    const poner = (bt) => { _txDirState = Object.assign({}, _txDirState || {}, { breakTimer: bt }); renderTxWidget(); };
    const card = () => document.querySelector('.pi-desc-capa');
    const rel = () => { const e = document.getElementById('descRel'); return e && e.textContent; };

    // Sin descanso puesto no hay cartel.
    poner({ active: false });
    out['1_sin_descanso_no_hay_cartel'] = !card();

    // Diez minutos recién arrancados.
    poner({ active: true, startedAt: Date.now(), durationSec: 600, label: 'COMENZAMOS EN', pausedAt: 0 });
    out['2_aparece'] = !!card();
    out['2_reloj'] = rel();
    out['2_rotulo'] = /COMENZAMOS EN/.test(document.body.innerText);

    // Es un bloque del editor: se puede arrastrar y agrandar como los demás.
    const blk = document.querySelector('.pi-block[data-pi-key="descanso"]');
    out['3_es_bloque_movible'] = !!blk;
    // Y la capa deja pasar los clicks, si no se come la selección de lo de abajo.
    out['3_capa_deja_pasar_clicks'] = !!card() && getComputedStyle(card()).pointerEvents === 'none';
    out['3_el_bloque_si_recibe'] = !!blk && getComputedStyle(blk).pointerEvents === 'auto';

    // Pausado: el reloj se congela en lo que quedaba al pausar, no sigue bajando.
    const t0 = Date.now();
    poner({ active: true, startedAt: t0 - 120000, durationSec: 600, label: '', pausedAt: t0 - 60000 });
    out['4_pausado_congela'] = rel();          // pausó al minuto: quedan 9:00
    out['4_dice_pausado'] = /PAUSADO/.test(document.body.innerText);

    // Corrido pero sin pausa: descuenta de verdad.
    poner({ active: true, startedAt: Date.now() - 90000, durationSec: 600, label: '', pausedAt: 0 });
    out['5_corriendo'] = rel();                // 10:00 - 1:30 = 8:30

    // Llegado a cero se queda un rato en 0:00 y después se saca solo, para que
    // no quede un "DESCANSO 0:00" toda la competencia.
    poner({ active: true, startedAt: Date.now() - 605000, durationSec: 600, label: '', pausedAt: 0 });
    out['6_en_cero_sigue_un_rato'] = !!card() && rel() === '0:00';
    poner({ active: true, startedAt: Date.now() - 640000, durationSec: 600, label: '', pausedAt: 0 });
    out['7_pasado_el_rato_se_va'] = !card();

    // El engranaje trae la sección para ponerlo.
    poner({ active: false });
    window._piPanelOpen = true; renderTxWidget();
    const panel = document.body.innerText;
    out['8_engranaje_tiene_descanso'] = /DESCANSO/.test(panel) && !!document.getElementById('descTexto');
    out['8_minutos_de_siempre'] = ["5'", "10'", "15'", "20'", "30'"]
      .every(m => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === m));

    // Ponerlo desde el engranaje se ve al toque, sin esperar a Firestore.
    const te = document.getElementById('descTexto'); if (te) te.value = 'VOLVEMOS EN';
    descPoner(15);
    out['9_poner_desde_el_engranaje'] = !!_txDirState.breakTimer && _txDirState.breakTimer.active
      && _txDirState.breakTimer.durationSec === 900 && _txDirState.breakTimer.label === 'VOLVEMOS EN';
    out['9_se_dibuja'] = !!document.getElementById('descRel');

    // Pausar y seguir. Al seguir NO se pierde el tiempo que estuvo detenido.
    descPausar();
    out['10_pausa'] = !!_txDirState.breakTimer.pausedAt;
    // Como si la pausa llevara 30 segundos: se corren juntos el arranque y el
    // momento de la pausa, que es el mismo estado 30 segundos más tarde.
    _txDirState.breakTimer.startedAt -= 30000;
    _txDirState.breakTimer.pausedAt -= 30000;
    const antes = _descInfo().rem;
    descPausar();
    out['11_al_seguir_no_pierde_tiempo'] = Math.abs(_descInfo().rem - antes) <= 1;
    out['11_ya_no_esta_pausado'] = !_txDirState.breakTimer.pausedAt;

    descQuitar();
    out['12_quitar'] = !_descInfo() && !document.querySelector('.pi-desc-capa');
    return out;
  });
  Object.entries(r).forEach(([k, v]) => { if (typeof v !== 'boolean') console.log('   · ' + k + ' = ' + v); });

  ok(r['1_sin_descanso_no_hay_cartel'], 'sin descanso puesto no hay cartel');
  ok(r['2_aparece'] && r['2_reloj'] === '10:00' && r['2_rotulo'], 'aparece con su rótulo y el reloj en 10:00');
  ok(r['3_es_bloque_movible'], 'el cartel es un bloque que se puede mover y agrandar');
  ok(r['3_capa_deja_pasar_clicks'] && r['3_el_bloque_si_recibe'], 'su capa no le roba los clicks a los demás bloques');
  ok(r['4_pausado_congela'] === '9:00' && r['4_dice_pausado'], 'pausado se congela y lo dice');
  ok(r['5_corriendo'] === '8:30', 'corriendo descuenta de verdad');
  ok(r['6_en_cero_sigue_un_rato'], 'al llegar a cero se queda en 0:00 un rato');
  ok(r['7_pasado_el_rato_se_va'], 'y después se saca solo');
  ok(r['8_engranaje_tiene_descanso'] && r['8_minutos_de_siempre'], 'el engranaje trae la sección con los minutos de siempre');
  ok(r['9_poner_desde_el_engranaje'] && r['9_se_dibuja'], 'ponerlo desde el engranaje se ve al toque');
  ok(r['10_pausa'], 'pausar');
  ok(r['11_al_seguir_no_pierde_tiempo'] && r['11_ya_no_esta_pausado'], 'al seguir no se pierde el tiempo que estuvo detenido');
  ok(r['12_quitar'], 'quitar lo saca de la pantalla');
  await p.context().close();

  // ── Las otras dos pantallas ─────────────────────────────────────────────
  for (const [modo, qs] of [
    ['Atleta en Barra', 'evento=suda2026_fesupo_full&tx=screen&modo=barra'],
    ['Tabla de Jornada', 'evento=suda2026_fesupo_full&tx=screen&modo=jornada'],
    ['Tabla de Jornada (link suelto)', 'evento=suda2026_fesupo_full&tx=jornada'],
  ]) {
    const q = await abrir(b, qs);
    q.on('pageerror', e => errs.push(e.message));
    const v = await q.evaluate(() => {
      isAdmin = true;
      _txDirState = Object.assign({}, _txDirState || {}, {
        breakTimer: { active: true, startedAt: Date.now(), durationSec: 300, label: 'DESCANSO', pausedAt: 0 }
      });
      renderTxWidget();
      const e = document.getElementById('descRel');
      // Estas dos pantallas no tienen el panel de ajustes de la de Intentos, así
      // que llevan su propio botón de reloj: sin eso, el descanso solo se podría
      // poner estando en la Pantalla de Intentos.
      const bt = [...document.querySelectorAll('button')].find(b => b.getAttribute('onclick') === 'descTogglePanel()');
      let abre = false;
      if (bt) { descTogglePanel(); abre = !!document.getElementById('descTexto'); descTogglePanel(); }
      return { hay: !!e, txt: e && e.textContent, gear: !!bt, abre };
    });
    ok(v.hay && v.txt === '5:00', 'se ve también en ' + modo);
    ok(v.gear && v.abre, 'y se puede poner desde su propio botón en ' + modo);
    await q.context().close();
  }

  await b.close();
  ok(!errs.length, 'sin errores de página' + (errs.length ? ' — ' + errs[0] : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

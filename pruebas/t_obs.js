// Las fuentes de navegador de OBS tienen que recibir los cambios en vivo.
//
// En el Regional pasó esto: el link de Control TX / pantalla puesto como fuente de
// navegador en OBS no reaccionaba a los botones del control remoto, pero el MISMO
// link abierto en Chrome sí. El navegador interno de OBS (CEF) no es Chrome: el
// canal en tiempo real de Firestore se le queda colgado — la página carga con el
// estado del momento y no se entera de nada más. La detección automática de long
// polling no lo salva, porque da por bueno un canal que después no entrega nada.
//
// Acá se comprueba que la página se dé cuenta de que está adentro de OBS y arranque
// Firestore en long polling forzado, y que el vigilante de conexión siga corriendo
// ahí (una fuente de OBS se declara "hidden" aunque esté al aire).
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_obs.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const URL_BASE = 'http://localhost:8972/livecast.html';

async function abrir(b, query, initScript) {
  const ctx = await b.newContext();
  if (initScript) await ctx.addInitScript(initScript);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_BASE + query, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof EN_OBS !== 'undefined', null, { timeout: 20000 });
  return { p, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nEn un navegador normal nada cambia');
  {
    const { p, errs } = await abrir(b, '?tx=timer&evento=suda2026_fesupo_full');
    const r = await p.evaluate(() => ({ obs: EN_OBS, lp: FORZAR_LONGPOLL }));
    ok(r.obs === false, 'no se cree que está en OBS');
    ok(r.lp === false, 'y sigue con la detección automática de siempre');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  }

  console.log('\nAdentro de OBS se reconoce y fuerza el long polling');
  {
    // OBS inyecta window.obsstudio en cada fuente de navegador.
    const { p, errs } = await abrir(b, '?tx=screen&evento=suda2026_fesupo_full',
      () => { window.obsstudio = { pluginVersion: '2.18.4' }; });
    const r = await p.evaluate(() => ({ obs: EN_OBS, lp: FORZAR_LONGPOLL }));
    ok(r.obs === true, 'se detecta la fuente de navegador de OBS');
    ok(r.lp === true, 'y arranca Firestore en long polling forzado');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  }

  console.log('\nTambién por el user agent, si la inyección no llegó a tiempo');
  {
    const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36 OBS/30.1.2' });
    const p = await ctx.newPage();
    await p.goto(URL_BASE + '?tx=lights&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof EN_OBS !== 'undefined', null, { timeout: 20000 });
    ok(await p.evaluate(() => EN_OBS) === true, 'el user agent de OBS también cuenta');
  }

  console.log('\nSe puede forzar a mano desde cualquier navegador');
  {
    const { p } = await abrir(b, '?tx=timer&longpoll=1&evento=suda2026_fesupo_full');
    const r = await p.evaluate(() => ({ obs: EN_OBS, lp: FORZAR_LONGPOLL }));
    ok(r.lp === true, '?longpoll=1 lo activa');
    ok(r.obs === false, 'sin hacerse pasar por OBS');
  }

  console.log('\nEl vigilante de conexión sigue corriendo en OBS');
  // Una fuente de OBS se declara "hidden" aunque esté al aire: si el vigilante se
  // saltea por eso, la pantalla se queda pegada para siempre y nadie se entera.
  ok(/if\(!EN_OBS&&document\.visibilityState==='hidden'\)return;/.test(src),
     'la salida por pestaña oculta no aplica adentro de OBS');
  ok(/experimentalForceLongPolling:true/.test(src), 'el long polling forzado está en el código');
  ok(/fb\.memoryLocalCache/.test(src), 'y usa caché en memoria, no IndexedDB, en esa rama');

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

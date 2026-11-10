// El estilo guardado del campeonato no se pierde.
//
// Pasó con Lirio: en un computador la página salía en negro y en el teléfono
// con el estilo. El livecast leía el estilo de DATA.event, y DATA.event se
// reemplaza entero con cada sincronización que manda la mesa de control; si esa
// copia venía sin el campo, la pantalla volvía al negro hasta el próximo cambio
// en el admin. Ahora manda la ficha del campeonato (eventos/{id}.estilo, que el
// listener de eventos deja en LIVE_EVENT_META), y se recuerda en el equipo para
// que al abrir no parpadee en negro.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_estilofijo.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';
const EV = 'suda2026_fesupo_full';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

async function abrir(ctx, extra) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=${EV}${extra || ''}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && typeof _estiloId === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
  await p.waitForTimeout(2500);   // que pase el primer aviso del listener de eventos
  return p;
}
const errs = [];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 860 } });

  console.log('\nLa ficha del campeonato manda');
  const p = await abrir(ctx);
  const r = await p.evaluate(() => {
    const id = DATA.event.id, M = window.LIVE_EVENT_META = window.LIVE_EVENT_META || {};
    const html = document.documentElement, var_ = () => html.getAttribute('data-estilo-var') || '';
    M[id] = Object.assign({}, M[id] || { name: DATA.event.name }, { estilo: 'lirio' });
    R(); const puesto = var_();
    // La mesa de control manda su copia del campeonato SIN el estilo (como
    // `DATA.event=d.event||DATA.event` en la sincronización)…
    const sin = Object.assign({}, DATA.event); delete sin.estilo; DATA.event = sin; R(); const trasSync = var_();
    // …o con el estilo vacío.
    DATA.event = Object.assign({}, DATA.event, { estilo: '' }); R(); const trasVacio = var_();
    return { id, puesto, trasSync, trasVacio, guardado: localStorage.getItem('yl_estilo_' + id) };
  });
  ok(r.puesto === 'lirio', 'con Lirio guardado en la ficha, la página sale en Lirio');
  ok(r.trasSync === 'lirio', 'y sigue en Lirio cuando llega una copia del campeonato sin el estilo (' + r.trasSync + ')');
  ok(r.trasVacio === 'lirio', 'y también si la copia trae el estilo vacío (' + r.trasVacio + ')');
  ok(r.guardado === 'lirio', 'queda recordado en este equipo');

  console.log('\nAl volver a abrir, sin esperar la ficha');
  const q = await abrir(ctx);
  const s = await q.evaluate(() => {
    window.LIVE_EVENT_META = {};               // la ficha todavía no llega
    const ev = Object.assign({}, DATA.event); delete ev.estilo; DATA.event = ev;
    R(); return { id: _estiloId(), var_: document.documentElement.getAttribute('data-estilo-var') || '' };
  });
  ok(s.id === 'lirio' && s.var_ === 'lirio', 'abre directo en Lirio, sin pasar por el negro (' + s.id + ')');

  console.log('\nLa transmisión (Control TX) igual');
  const t = await abrir(ctx, '&tx=director');
  const tx = await t.evaluate(() => {
    const ev = Object.assign({}, DATA.event); delete ev.estilo; DATA.event = ev;
    try { _txDirLastSig = null; } catch (e) {} renderTxWidget();
    return document.documentElement.getAttribute('data-estilo-var') || '';
  });
  ok(tx === 'lirio', 'el marcador de la transmisión sigue con el estilo (' + tx + ')');

  console.log('\nCambiarlo en el admin sí lo cambia');
  const c = await p.evaluate(() => {
    const id = DATA.event.id, M = window.LIVE_EVENT_META;
    M[id] = Object.assign({}, M[id], { estilo: '' }); R();
    const normal = document.documentElement.getAttribute('data-estilo') || '';
    M[id] = Object.assign({}, M[id], { estilo: 'liriocrema' }); R();
    return { normal, sub: document.documentElement.getAttribute('data-estilo-sub') || '', guardado: localStorage.getItem('yl_estilo_' + id) };
  });
  ok(c.normal === '', 'si el owner lo saca (Normal), la página vuelve a lo de siempre');
  ok(c.sub === 'crema' && c.guardado === 'liriocrema', 'y si pone Lirio crema, cambia y se recuerda el nuevo');

  console.log('\nEl link para mirar otro estilo sigue funcionando');
  const u = await abrir(ctx, '&estilo=normal');
  const un = await u.evaluate(() => { R(); return document.documentElement.getAttribute('data-estilo') || ''; });
  ok(un === '', '?estilo=normal lo muestra sin estilo aunque el campeonato tenga uno guardado');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

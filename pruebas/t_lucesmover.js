// En la pantalla de tarima todo se mueve y se agranda: las luces de los jueces,
// el reloj y, en Intentos, cada cosa (título, tanda, rack, barra…).
//
// En "Atleta en barra" ya eran un bloque del editor. En Intentos estaban fijas
// abajo al centro, y en la pantalla de Luces las tres grandes iban siempre al
// medio. Ahora en las dos son bloques como el resto: click para elegirlas,
// arrastrar para moverlas, la manija para el tamaño, y la posición queda
// guardada en esa pantalla.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_lucesmover.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MONTAR = `(modo)=>{
  const n9=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  const a={id:1,name:'Sebastian Nicolas VERGARA BARICIH',lot:1,flight:'A',sex:'Hombre',
    cat:'93',div:'Junior',mod:'classic',bw:92,club:'Athor',country:'CHI',bombed:false,att:n9()};
  a.att.sq=[{w:250,r:null},{w:0,r:null},{w:0,r:null}];
  DATA.athletes=[a]; DATA.lift='sq'; DATA.round=0; DATA.flight='A'; DATA.phase='compete';
  DATA.event={id:'x',name:'Prueba',logoUrl:''};
  window._SCREEN_STATE={mode:modo,flights:null,fondo:'yourlift',luces:true};
  _txLights={izq:'white',central:'red',der:'white'};
  window._piSelected=null;
  renderTxWidget();
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto('http://localhost:8972/livecast.html?tx=screen&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function', null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  const montar = m => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [MONTAR, m]);
  const caja = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }, sel);

  async function probar(modo, clave, titulo) {
    console.log('\n' + titulo);
    await montar(modo);
    const sel = '.pi-block[data-pi-key="' + clave + '"]';
    const c0 = await caja(sel);
    ok(!!c0, 'las luces son un bloque del editor (' + clave + ')');
    if (!c0) return;
    ok(await p.evaluate(s => document.querySelectorAll(s + ' [data-luz]').length, sel) === 3, 'adentro van las tres luces');
    await p.mouse.click(c0.x, c0.y);
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => window._piSelected) === clave, 'un click las elige');
    // Arrastrar hacia arriba a la izquierda
    const c1 = await caja(sel);
    await p.mouse.move(c1.x, c1.y); await p.mouse.down();
    await p.mouse.move(c1.x - 300, c1.y - 200, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(150);
    const c2 = await caja(sel);
    ok(c2.x < c1.x - 250 && c2.y < c1.y - 150, 'se arrastran a otro lugar (' + Math.round(c1.x) + ',' + Math.round(c1.y) + ' → ' + Math.round(c2.x) + ',' + Math.round(c2.y) + ')');
    // Agrandar con la manija
    const m = await caja('.pi-resize[data-pi-key="' + clave + '"]');
    await p.mouse.move(m.x, m.y); await p.mouse.down();
    await p.mouse.move(m.x, m.y + 120, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(150);
    const esc = await p.evaluate(k => (window._piLayout[k] || {}).scale, clave);
    ok(esc > 140, 'la manija las agranda (escala ' + Math.round(esc) + '%)');
    const guardado = await p.evaluate(k => { const g = JSON.parse(localStorage.getItem(PI_LAYOUT_KEY) || '{}'); return g[k]; }, clave);
    ok(guardado && guardado.x < 40 && guardado.scale > 140, 'la posición queda guardada en esta pantalla');
    // Siguen siendo las de los jueces: al cambiar las luces, se redibujan en el lugar nuevo
    await p.evaluate(() => { _txLights = { izq: 'white', central: 'white', der: 'white' }; window._piSelected = null; renderTxWidget(); });
    const c3 = await caja(sel);
    ok(Math.abs(c3.x - c2.x) < 40 && Math.abs(c3.y - c2.y) < 60, 'con luces nuevas siguen donde se dejaron');
    await p.screenshot({ path: process.env.CAPTURA_DIR ? process.env.CAPTURA_DIR + '/luces_' + modo + '.png' : '/dev/null' }).catch(() => {});
  }

  await probar('intentos', 'luces', 'Pantalla de Intentos');
  await probar('luces', 'lLuces', 'Pantalla de Luces');

  // El reloj del intento (el que prende la Planilla) también es un bloque.
  async function probarReloj(modo, clave, titulo) {
    console.log('\n' + titulo);
    await montar(modo);
    await p.evaluate(() => { DATA.relojVisible = true; DATA.timer = 47; DATA.timerOn = true; DATA.timerStartedAt = _ahora() - 13000; window._piSelected = null; renderTxWidget(); });
    const sel = '.pi-block[data-pi-key="' + clave + '"]';
    const c0 = await caja(sel);
    ok(!!c0, 'el reloj es un bloque del editor (' + clave + ')');
    if (!c0) return;
    await p.mouse.click(c0.x, c0.y); await p.waitForTimeout(150);
    const c1 = await caja(sel);
    await p.mouse.move(c1.x, c1.y); await p.mouse.down();
    await p.mouse.move(c1.x - 200, c1.y + 250, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(150);
    const c2 = await caja(sel);
    ok(c2.x < c1.x - 150 && c2.y > c1.y + 200, 'se arrastra a otro lugar');
    await p.evaluate(() => { window._piSelected = null; renderTxWidget(); });
    const txt = await p.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.trim() : ''; }, sel);
    ok(/^\d:\d\d$/.test(txt), 'y sigue marcando el tiempo ahí (' + txt + ')');
    await p.evaluate(() => { DATA.relojVisible = false; DATA.timerOn = false; renderTxWidget(); });
  }
  await probarReloj('intentos', 'reloj', 'Reloj en Intentos');
  await probarReloj('barra', 'bReloj', 'Reloj en Atleta en barra');

  // Todo lo de la pantalla de Intentos es un bloque: también el título y la
  // tanda de la franja de arriba, el rack y la barra.
  console.log('\nTodo en Intentos se mueve');
  await montar('intentos');
  await p.evaluate(() => { const a = DATA.athletes[0]; a.rackSQ = '12'; DATA.relojVisible = true; window._piSelected = null; renderTxWidget(); });
  const claves = await p.evaluate(() => [...document.querySelectorAll('.pi-block')].map(e => e.getAttribute('data-pi-key')));
  for (const k of ['titulo', 'tanda', 'liftLabel', 'weight', 'rack', 'discos', 'name', 'subtitle', 'luces', 'reloj'])
    ok(claves.includes(k), k + ' es un bloque');
  ok(!/Por lado/.test(await p.evaluate(() => document.body.innerText)), 'sin la línea "Por lado … collar": solo el dibujo de la barra');
  const fijos = await p.evaluate(() => [...document.querySelectorAll('#pantIntentosBox *')].filter(e => {
    if (e.closest('.pi-block') || e.closest('button') || e.closest('[style*="z-index:50"]')) return false;
    return [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  }).map(e => e.textContent.trim().slice(0, 30)));
  ok(fijos.length === 0, 'no queda ningún texto fijo fuera de los bloques' + (fijos.length ? ': ' + fijos.join(' | ') : ''));
  for (const k of ['titulo', 'discos', 'rack']) {
    const sel = '.pi-block[data-pi-key="' + k + '"]';
    const antes = await p.evaluate(x => Object.assign({}, _piPos(x)), k);
    const a = await caja(sel);
    await p.mouse.click(a.x, a.y); await p.waitForTimeout(120);
    const b0 = await caja(sel);
    await p.mouse.move(b0.x, b0.y); await p.mouse.down();
    await p.mouse.move(b0.x + 120, b0.y + 90, { steps: 6 }); await p.mouse.up();
    const m = await caja('.pi-resize[data-pi-key="' + k + '"]');
    await p.mouse.move(m.x, m.y); await p.mouse.down();
    await p.mouse.move(m.x, m.y + 60, { steps: 4 }); await p.mouse.up();
    await p.evaluate(() => { window._piSelected = null; renderTxWidget(); });
    const des = await p.evaluate(x => Object.assign({}, _piPos(x)), k);
    ok(des.x > antes.x + 5 && des.y > antes.y + 8 && des.scale > 115,
      k + ': se mueve y se agranda (x ' + antes.x + '→' + des.x.toFixed(1) + ', y ' + antes.y + '→' + des.y.toFixed(1) + ', escala ' + Math.round(des.scale) + '%)');
  }

  console.log('\nRestablecer');
  await p.evaluate(() => lucesResetLayout());
  ok(await p.evaluate(() => window._piLayout.lLuces.x === 50 && window._piLayout.lLuces.scale === 100), 'el ⟲ de la pantalla de Luces la deja como venía');
  ok(await p.evaluate(() => window._piLayout.luces.x !== 50), 'y no toca lo acomodado en Intentos');
  await p.evaluate(() => piResetLayout());
  ok(await p.evaluate(() => window._piLayout.luces.x === 50 && window._piLayout.luces.y === 89), 'Restablecer posiciones de Intentos vuelve las luces abajo al centro');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

// La cuenta de STREAMING: la que se le entrega a quien transmite.
//
// Entra a yourlift.cl/admin y ahí adentro tiene una sola puerta, YourLift
// (LiftingCast) — nada de la base de atletas, nóminas ni inscripciones. Ya en el
// livecast elige el campeonato como cualquiera, y una vez adentro solo ve lo de la
// transmisión: Control TX, Control Remoto, Transmisión, Widgets OBS y Pantalla de
// Tarima. No entra a Atletas & Pesaje ni a Control en Vivo, así que no puede
// tocar la competencia por accidente.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_streaming.js
const fs = require('fs');
const { chromium } = require('playwright');
const srcLC = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
const srcAD = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Los botones del menú lateral, tal cual los lee alguien mirando la pantalla.
const MENU = () => [...document.querySelectorAll('.side .side-btn')]
  .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);

async function menuConRol(p, rol) {
  return await p.evaluate(async r => {
    isAdmin = true; window.IS_CONTROLLER = false; window.ADMIN_ROLE = r;
    pickEvent(DATA.events.findIndex(e => e.id === 'suda2026_fesupo_full'));
    R();
    return {
      menu: [...document.querySelectorAll('.side .side-btn')]
        .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
      fase: DATA.phase,
    };
  }, rol);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length, null, { timeout: 15000 });

  console.log('\nEn el livecast, con la cuenta de streaming');
  const st = await menuConRol(p, 'streaming');
  const tiene = t => st.menu.some(x => x.includes(t));
  ok(tiene('Control TX'), 'está Control TX');
  ok(tiene('Control Remoto'), 'está Control Remoto');
  ok(tiene('Transmisión'), 'está Transmisión');
  ok(tiene('Widgets OBS'), 'están los Widgets OBS');
  ok(tiene('Pantalla Tarima'), 'está la Pantalla de Tarima');
  ok(tiene('Selección de Campeonato'), 'y puede volver a elegir campeonato');
  ok(!tiene('Atletas & Pesaje'), 'NO está Atletas & Pesaje');
  ok(!tiene('Control en Vivo'), 'NO está Control en Vivo');
  ok(!tiene('Reiniciar datos en vivo'), 'NO está Reiniciar datos en vivo');
  ok(!tiene('Exportar Backup'), 'NO está Exportar Backup');
  ok(tiene('Cerrar sesión'), 'pero sí puede cerrar sesión');

  console.log('\n  Al elegir el campeonato aterriza en Control TX');
  ok(st.fase === 'director', 'la pantalla que se abre es Control TX (' + st.fase + ')');

  console.log('\n  Y aunque le pidan una pantalla que no le toca, no entra');
  const forzado = await p.evaluate(() => {
    const r = {};
    DATA.phase = 'manage'; R();
    r.desdeManage = DATA.phase;
    DATA.phase = 'compete'; R();
    r.desdeCompete = DATA.phase;
    r.hayPesaje = !!document.querySelector('input[id^="wi_"]');
    return r;
  });
  ok(forzado.desdeManage === 'director', 'go("manage") lo devuelve a Control TX (' + forzado.desdeManage + ')');
  ok(forzado.desdeCompete === 'director', 'go("compete") también (' + forzado.desdeCompete + ')');
  ok(!forzado.hayPesaje, 'no se dibuja ninguna casilla de pesaje');

  console.log('\n  En Resultados puede sacar las actas, pero no cerrar la competencia');
  const res = await p.evaluate(() => {
    DATA.phase = 'results'; R();
    const btns = [...document.querySelectorAll('button')].map(e => e.textContent.trim());
    return { acta: btns.some(t => /Acta/i.test(t)), cerrar: btns.some(t => /Cerrar competencia/i.test(t)) };
  });
  ok(res.acta, 'los botones de acta siguen ahí');
  ok(!res.cerrar, 'el de "Cerrar competencia" no');

  console.log('\nLos demás roles quedan como estaban');
  const adm = await menuConRol(p, 'admin');
  ok(adm.menu.some(x => x.includes('Atletas & Pesaje')), 'el admin sigue viendo Atletas & Pesaje');
  ok(adm.menu.some(x => x.includes('Control en Vivo')), 'y Control en Vivo');
  ok(adm.fase === 'manage', 'y aterriza en Atletas & Pesaje (' + adm.fase + ')');
  const juez = await menuConRol(p, 'juez');
  ok(!juez.menu.some(x => x.includes('Control TX')), 'el juez sigue sin Control TX');
  ok(juez.menu.some(x => x.includes('Atletas & Pesaje')), 'pero con Atletas & Pesaje');
  const tx = await menuConRol(p, 'transmision');
  ok(!tx.menu.some(x => x.includes('Control en Vivo')), 'el rol transmisión sigue sin Control en Vivo');
  ok(tx.menu.some(x => x.includes('Control TX')), 'y con Control TX');

  console.log('\nEn el panel de admin');
  ok(/role==='streaming'\)\{ app\.innerHTML=renderStreamingShell\(\); return; \}/.test(srcAD),
     'la cuenta de streaming entra a su propia pantalla, no al panel');
  ok(/function renderStreamingShell\(\)/.test(srcAD), 'esa pantalla existe');
  ok(/<option value="streaming">/.test(srcAD), 'el rol se puede elegir al crear la cuenta');

  // El panel de admin corre como módulo, así que su ST/render no se ven desde acá:
  // se saca la función del archivo y se dibuja con una cuenta de prueba.
  const iRS = srcAD.indexOf('function renderStreamingShell(){');
  const fnRS = (() => {
    let q = iRS, open = 0, abrio = false;
    while (q < srcAD.length) {
      const c = srcAD[q];
      if (c === '{') { open++; abrio = true; }
      else if (c === '}') { open--; if (abrio && open === 0) { q++; break; } }
      q++;
    }
    return srcAD.slice(iRS, q);
  })();
  const pa = await ctx.newPage();
  const errsA = [];
  pa.on('pageerror', e => errsA.push(e.message));
  await pa.goto('http://localhost:8972/admin.html', { waitUntil: 'domcontentloaded' });
  const panel = await pa.evaluate(([fn]) => {
    window.ST = { user: { email: 'tx@yourlift.cl' }, adminInfo: { role: 'streaming', nombre: 'Cabina TX' } };
    eval(fn);
    document.body.innerHTML = renderStreamingShell();
    return {
      menu: [...document.querySelectorAll('.side .side-btn')]
        .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
      links: [...document.querySelectorAll('.side a')].map(e => e.getAttribute('href')),
      nombre: (document.querySelector('.side .user') || {}).textContent || '',
    };
  }, [fnRS]);
  ok(panel.links.includes('livecast.html?operar=1'), 'el acceso a YourLift (LiftingCast) está');
  ok(panel.menu.length === 3, 'y el menú tiene solo esas tres cosas: ' + panel.menu.join(' · '));
  ok(!panel.menu.some(t => /Atletas|Nóminas|Inscripciones|Campeonatos|Audit/i.test(t)),
     'nada del panel de administración');
  ok(/Cabina TX/.test(panel.nombre) && /streaming/.test(panel.nombre),
     'se ve de quién es la cuenta y con qué rol');
  ok(errsA.length === 0, 'el panel dibuja sin errores' + (errsA.length ? ': ' + errsA.join(' | ') : ''));

  console.log('\nY el rol está escrito en un solo lugar');
  ok(/const _PAGS_STREAMING=/.test(srcLC), 'la lista de páginas permitidas vive en _canAccess');
  ok(/if\(role==='streaming'\)return _PAGS_STREAMING\.indexOf\(page\)>=0;/.test(srcLC),
     'y _canAccess la respeta');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

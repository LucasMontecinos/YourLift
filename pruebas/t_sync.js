// La pastilla de SYNC: lo que el operador mira para saber si lo que carga está
// llegando al público y a OBS.
//
// Es el aviso más delicado de la competencia, y por eso lo que más lo arruina es
// que se encienda cuando no pasa nada. Un rojo permanente deja de avisar: la
// gente aprende a ignorarlo y el día que importa de verdad, no lo mira.
//
// Dos cosas que estaban mal y se arreglaron:
//
//   · Una pantalla en modo ESPECTADOR salía en ROJO "NO GUARDA", igual que una
//     escritura caída. Pero no está fallando: está haciendo lo suyo. El PC de
//     OBS y cualquier pantalla de apoyo mostraban esa alarma todo el día.
//   · Al revés: cuando llegaban datos del servidor se daba por guardado TODO lo
//     de esta pantalla, incluso lo que todavía no había salido de acá. La
//     pastilla se ponía verde con cambios sin mandar, que es el error peor.
//
// Y el rojo ahora dice QUÉ pasa: permisos y conexión se arreglan distinto.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_sync.js
const { chromium } = require('playwright');
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };
const ROJO = /rgb\(239, 68, 68\)/;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&controller=1',
               { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length,
                          null, { timeout: 30000 });

  const pill = () => p.evaluate(() => {
    const e = document.getElementById('syncPill');
    return e ? { txt: e.innerText.trim(), color: getComputedStyle(e).color, tip: e.title } : null;
  });
  const set = async f => { await p.evaluate(f); await p.waitForTimeout(150); };
  const limpio = () => set(() => {
    isAdmin = true; window.IS_CONTROLLER = true; fbReady = true; fbUnsub = function () {};
    DATA.phase = 'compete'; window._lastSyncedSig = _dataSig(); _fbLastOk = Date.now();
    window._syncFallo = 0; window._syncFalloMsg = ''; window._desincDesde = 0;
    if (window._pendingEdits) window._pendingEdits.clear();
    R();
  });

  console.log('\nCuando todo está bien, no molesta');
  {
    await limpio();
    let s = await pill();
    ok(/EN LÍNEA/.test(s.txt) && !ROJO.test(s.color), 'todo guardado → verde: ' + s.txt);
    // Entre tandas nadie toca nada por minutos. Eso no es una falla.
    await set(() => { _fbLastOk = Date.now() - 3 * 60 * 1000; R(); });
    s = await pill();
    ok(/EN LÍNEA/.test(s.txt) && !ROJO.test(s.color),
       '3 minutos sin tocar nada sigue verde — un descanso no es una falla');
  }

  console.log('\n  El espectador no es una falla');
  {
    await limpio();
    await set(() => { window.IS_CONTROLLER = false; R(); });
    const s = await pill();
    ok(/SOLO LECTURA/.test(s.txt), 'dice SOLO LECTURA, no "NO GUARDA": ' + s.txt);
    ok(!ROJO.test(s.color), 'y no va en rojo (' + s.color + ')');
    ok(/no escribe|mira/i.test(s.tip) && /Controlador/.test(s.tip),
       'y explica cómo darle permiso de escribir');
  }

  console.log('\n  El rojo se enciende cuando de verdad no está llegando');
  {
    await limpio();
    await set(() => { fbReady = false; R(); });
    let s = await pill();
    ok(/SIN CONEXIÓN/.test(s.txt) && ROJO.test(s.color), 'sin conexión al servidor');

    await limpio();
    await set(() => { fbUnsub = null; R(); });
    s = await pill();
    ok(/SIN CAMPEONATO/.test(s.txt) && ROJO.test(s.color),
       'conectado pero sin escuchar ningún campeonato: ' + s.txt);

    await limpio();
    await set(() => { window._desincDesde = Date.now() - 20000;
                      DATA.athletes[0].att.sq[0].w = 123; R(); });
    s = await pill();
    ok(/NO SE GUARDA/.test(s.txt) && ROJO.test(s.color), '20s con cambios sin confirmar');

    await limpio();
    await set(() => { DATA.athletes[0].att.sq[0].w = 124; window._desincDesde = 0; R(); });
    s = await pill();
    ok(/GUARDANDO/.test(s.txt) && !ROJO.test(s.color),
       'pero un cambio recién hecho es ámbar, no rojo: ' + s.txt);
  }

  console.log('\n  Y dice QUÉ falló, que se arreglan distinto');
  {
    await limpio();
    await set(() => { window._syncFallo = Date.now();
                      window._syncFalloMsg = 'permission-denied'; R(); });
    let s = await pill();
    ok(/permisos|sesión/i.test(s.tip), 'permisos → habla de la sesión: ' + s.tip.slice(0, 60));

    await set(() => { window._syncFalloMsg = 'unavailable: network error'; R(); });
    s = await pill();
    ok(/conexión/i.test(s.tip), 'red → habla de la conexión: ' + s.tip.slice(0, 60));

    await set(() => { window._syncFalloMsg = 'algo raro'; R(); });
    s = await pill();
    ok(/falló/i.test(s.tip) && /reintent/i.test(s.tip),
       'y si no se reconoce, al menos dice que se sigue intentando');
  }

  console.log('\n  Lo que llega del servidor no da por guardado lo mío');
  {
    // Esto es lo que ponía la pastilla en VERDE con cambios sin mandar.
    const r = await p.evaluate(() => {
      window.IS_CONTROLLER = true; fbReady = true; fbUnsub = function () {};
      window._lastSyncedSig = 'firma-vieja';
      window._pendingEdits = new Set(['1|sq|0']);   // hay algo sin mandar
      const antes = window._lastSyncedSig;
      // el trozo del listener que alinea la firma
      const _limpio = !_syncInFlight && !_syncPending
        && !(window._pendingEdits && window._pendingEdits.size);
      if (_limpio) window._lastSyncedSig = _dataSig();
      const conPendientes = window._lastSyncedSig;
      window._pendingEdits.clear();
      const _limpio2 = !_syncInFlight && !_syncPending
        && !(window._pendingEdits && window._pendingEdits.size);
      if (_limpio2) window._lastSyncedSig = _dataSig();
      return { antes, conPendientes, sinPendientes: window._lastSyncedSig, real: _dataSig() };
    });
    ok(r.conPendientes === r.antes,
       'con ediciones sin mandar, la firma NO se alinea (seguiría avisando)');
    ok(r.sinPendientes === r.real,
       'y sin nada pendiente sí se alinea, para no avisar de gusto');
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/const _limpio=!_syncInFlight&&!_syncPending/.test(lc),
       'y esa guarda está en el listener de verdad, no solo acá');
  }

  ok(errs.length === 0, 'sin errores en la página' + (errs.length ? ': ' + errs.slice(0, 2) : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

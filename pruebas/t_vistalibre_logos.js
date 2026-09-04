// Tres cosas que se pidieron juntas y se cuidan juntas.
//
// 1) LA VISTA LIBRE ARRANCA APAGADA.
//    Deja que una pantalla mire otra tanda sin arrastrar a las demás, y está
//    bien que exista. El problema era que se recordaba entre sesiones: quedaba
//    prendida de un día para otro, nadie se acordaba, y al operar se veía una
//    tanda distinta a la que estaba en tarima. Parecía una desincronización y no
//    lo era — el widget estaba bien y la pantalla del operador era la corrida.
//    Algo que cambia lo que ves tiene que prenderse a propósito cada vez.
//
// 2) EL LEADERBOARD LLEVA SOLO EL LOGO DEL CAMPEONATO.
//    Es la tabla grande que queda fija en pantalla: ahí lo que corresponde es de
//    quién es el campeonato, no de quién es el software.
//
// 3) EL FECHIPO DEL SITIO ES EL LOGO DE VERDAD.
//    En la portada había una imitación dibujada con CSS —una barra roja inclinada
//    más la palabra en Oswald— que se parecía pero no era el logo. Ahora va el
//    archivo, en blanco para que se lea sobre el fondo oscuro, y el dibujo queda
//    de respaldo por si el archivo faltara.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_vistalibre_logos.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  console.log('\nLa vista libre no sobrevive a cerrar la página');
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 850 } });
    await ctx.route('**/firebasejs/**', r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
    // Se simula el caso real: quedó prendida de la sesión anterior.
    await p.addInitScript(() => { try { localStorage.setItem('yl_nav_libre', '1'); } catch (e) {} });
    await p.goto(`http://localhost:${PUERTO}/livecast.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof R === 'function', null, { timeout: 25000 });
    const r = await p.evaluate(() => ({
      libre: !!window.NAV_LIBRE,
      guardado: (() => { try { return localStorage.getItem('yl_nav_libre'); } catch (e) { return 'ERR'; } })(),
    }));
    ok(r.libre === false, 'venía prendida de antes y arranca apagada');
    ok(r.guardado === null, 'y la marca vieja se borra, no queda esperando');

    // Sigue sirviendo dentro de esta pestaña, que es para lo que existe.
    const r2 = await p.evaluate(() => {
      setNavLibre(true);
      return { prendida: !!window.NAV_LIBRE,
               guardado: (() => { try { return localStorage.getItem('yl_nav_libre'); } catch (e) { return 'ERR'; } })() };
    });
    ok(r2.prendida, 'se puede prender a mano');
    ok(r2.guardado === null, 'pero no se guarda: dura lo que dura la pestaña');
    await ctx.close();
  }

  console.log('\n  El leaderboard lleva solo el logo del campeonato');
  {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
    await p.route('**/firebasejs/**', r => r.abort());
    await p.goto(`http://localhost:${PUERTO}/livecast.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof renderTxLeaderboard === 'function', null, { timeout: 25000 });
    const r = await p.evaluate(() => {
      const at = w => ({ sq: [{ w, r: null }, { w: 0, r: null }, { w: 0, r: null }],
                         bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
                         dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
      DATA.event = { id: 'e', name: 'X', logoUrl: 'CAMP.png', logoFedUrl: 'FED.png' };
      DATA.athletes = [{ id: 1, name: 'A B', lot: 1, flight: 'A', sex: 'Hombre', sexo: 'Hombre',
        cat: '-83', div: 'Open', mod: 'Powerlifting Classic', club: 'C', country: 'CHI',
        pais: 'CHI', bw: 80, bombed: false, att: at(100) }];
      DATA.phase = 'compete'; DATA.lift = 'sq'; DATA.round = 0; DATA.flight = 'A';
      const d = document.createElement('div');
      d.innerHTML = renderTxLeaderboard(DATA.athletes[0], false);
      return [...d.querySelectorAll('img')].map(i => i.getAttribute('src'));
    });
    ok(r.join(',') === 'CAMP.png', 'solo el del campeonato — ' + (r.join(',') || '(ninguno)'));
    ok(!r.some(x => /yourlift/i.test(x)), 'sin el de YourLift');
    ok(!r.includes('FED.png'), 'y sin el de la federación');
    await p.close();
  }

  console.log('\n  El FECHIPO de la portada es el logo, no un dibujo');
  {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
    await p.route('**/firebasejs/**', r => r.abort());
    await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const img = document.querySelector('.fechipo-logo');
      const txt = document.querySelector('.fechipo-mini .txt');
      return {
        hay: !!img,
        cargo: img ? (img.complete && img.naturalWidth > 0) : false,
        alto: img ? Math.round(img.getBoundingClientRect().height) : 0,
        dibujoOculto: txt ? getComputedStyle(txt).display === 'none' : null,
        // Sigue llevando a nóminas, que es lo que hacía antes.
        clic: !!document.querySelector('.fechipo-mini[onclick]'),
      };
    });
    ok(r.hay, 'está la imagen del logo');
    ok(r.cargo, 'y el archivo carga de verdad');
    ok(r.alto > 20, 'con un tamaño razonable (' + r.alto + 'px)');
    ok(r.dibujoOculto === true, 'el dibujo hecho a mano queda oculto');
    ok(r.clic, 'y sigue llevando a las nóminas al hacer clic');
    await p.close();
  }

  await b.close();

  console.log('\n  Los archivos y el código');
  {
    ok(fs.existsSync(__dirname + '/../fechipo_logo_blanco.png'), 'está el logo en blanco, para fondo oscuro');
    // El PDF de la planilla se imprime sobre papel: ahí el blanco desaparecería.
    ok(fs.existsSync(__dirname + '/../fechipo_logo.png'), 'y el original a color, que es el que usa el PDF');

    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/window\._navLibreGuardada=false;/.test(lc), 'la vista libre arranca apagada, sin excepción');
    ok(!/localStorage\.setItem\('yl_nav_libre'/.test(lc), 'y ya no se guarda en ninguna parte');

    // Voseo: el usuario es chileno y no habla así.
    const ix = fs.readFileSync(__dirname + '/../index.html', 'utf8');
    const ad = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    const VOSEO = /\b(movés|arrastrás|cargás|activás|subís|Confirmás|Asegurate|editás|scrolleás|dejás|podés|tenés|querés|sabés|para vos|ves vos)\b/;
    ok(!VOSEO.test(lc), 'sin voseo en el livecast');
    ok(!VOSEO.test(ix), 'ni en el inicio');
    ok(!VOSEO.test(ad), 'ni en el panel');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

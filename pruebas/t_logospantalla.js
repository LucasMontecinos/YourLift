// Los logos de la Pantalla de Tarima: una lista, no dos casillas fijas.
//
// Antes la pantalla mostraba dos logos y solo dos: el del campeonato y el de la
// federación, cada uno en su casilla. Ahora se suben los que se quieran —esos
// dos, los auspiciadores, los que sean— y salen todos, en TODAS las escenas.
//
// Lo que se cuida acá:
//
//   · Que salgan en las cinco escenas. La de luces no mostraba ninguno, y en un
//     campeonato internacional la pantalla que más se mira no puede ser la única
//     sin identificar al organizador.
//   · Que mientras nadie haya subido nada la pantalla siga como estaba, con el
//     par de siempre: nadie se queda sin logos por no haber entrado al panel.
//   · Que la lista se guarde CON EL CAMPEONATO. El logo del campeonato se perdía
//     al entrar de nuevo a Control TX y había que volver a subirlo cada vez.
//   · Que "atleta en barra" y "pantalla de intentos" no compartan la posición de
//     la tira: las dos disposiciones viven en el mismo archivo guardado, y con
//     una sola clave, acomodar una movía la otra.
//
// Firestore está bloqueado en el sandbox, así que la lista se inyecta tal como
// la dejaría el panel al subirlos.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_logospantalla.js
const { chromium } = require('playwright');
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const b64 = f => 'data:image/png;base64,' + fs.readFileSync(__dirname + '/../' + f).toString('base64');
const ESCENAS = ['profile', 'barra', 'intentos', 'luces', 'jornada'];

(async () => {
  const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

  console.log('\nLa lista se guarda con el campeonato');
  {
    ok(/logosPantalla:lista/.test(lc), 'se escribe en eventos/{id}.logosPantalla');
    ok(/Array\.isArray\(e\.logosPantalla\)/.test(lc), 'y se vuelve a leer al cargar el campeonato');
    // Esto es lo que obligaba a subir el logo cada vez que se entraba a Control TX.
    ok(/const _mismoDoc=\(DATA\.event\.id===d\.id\)/.test(lc)
       && /if\(e\.logoUrl\|\|_mismoDoc\)DATA\.event\.logoUrl=/.test(lc),
       'un documento que calza solo por nombre ya no puede dejar el logo en blanco');
  }

  console.log('\n  Se pueden subir varios de una vez, y sacar o reordenar');
  {
    ok(/inp\.multiple=true/.test(lc), 'el selector acepta varios archivos');
    ok(/window\.screenLogosSubir=/.test(lc) && /window\.screenLogoBorrar=/.test(lc)
       && /window\.screenLogoMover=/.test(lc), 'subir, sacar y mover');
    ok(/logos\/pantalla\/'\+safeId/.test(lc), 'cada uno va a su carpeta en Storage');
    ok(/LOGOS DE LA PANTALLA/.test(lc), 'y el panel tiene su sección');
  }

  console.log('\n  Cada pantalla guarda la tira en su propia posición');
  {
    ok(/bLogosTira:\{/.test(lc) && /logosTira:\{/.test(lc),
       'dos claves distintas: bLogosTira (barra) y logosTira (intentos)');
    // El reset de cada pantalla filtra por el prefijo b+Mayúscula.
    ok(/_piResetClaves\(k=>!\/\^b\[A-Z\]\/\.test\(k\)\)/.test(lc)
       && /_piResetClaves\(k=>\/\^b\[A-Z\]\/\.test\(k\)\)/.test(lc),
       'y cada una restablece solo las suyas');
  }

  const LOGOS = ['eventos/suda2026_fed.png', 'eventos/suda2026.png', 'fechipo_logo_blanco.png']
    .map(b64);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const mira = async (modo, lista) => {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8972/livecast.html?tx=screen&evento=suda2026_fesupo_full&modo=' + modo,
                 { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length,
                            null, { timeout: 20000 });
    const r = await p.evaluate(l => {
      DATA.event.logosPantalla = l.map((u, i) => ({ url: u, nombre: 'logo' + i }));
      DATA.event.logoUrl = 'eventos/suda2026.png';
      DATA.event.logoFedUrl = 'eventos/suda2026_fed.png';
      if (typeof R === 'function') R();
      return null;
    }, lista);
    await p.waitForTimeout(700);
    const cuenta = await p.evaluate(() => ({
      subidos: document.querySelectorAll('img[src^="data:image/png"]').length,
      viejos: document.querySelectorAll('img[src*="eventos/suda2026"]').length,
    }));
    await p.close();
    return { ...cuenta, errs };
  };

  console.log('\n  Con logos subidos salen en las cinco escenas');
  for (const modo of ESCENAS) {
    const r = await mira(modo, LOGOS);
    ok(r.subidos === LOGOS.length, modo.padEnd(9) + ' muestra los ' + LOGOS.length
       + ' (' + r.subidos + ')' + (r.errs.length ? ' — ' + r.errs[0] : ''));
    ok(r.viejos === 0, '  · y reemplaza al par de antes, no se suman');
  }

  console.log('\n  Sin nada subido, la pantalla queda como estaba');
  for (const modo of ESCENAS) {
    const r = await mira(modo, []);
    // luces es la excepción a propósito: antes no mostraba ninguno y ahora sí.
    const esperado = modo === 'jornada' || modo === 'luces' || modo === 'profile'
      || modo === 'barra' || modo === 'intentos';
    ok(esperado ? r.viejos >= 1 : true,
       modo.padEnd(9) + ' sigue mostrando federación y campeonato (' + r.viejos + ')');
  }
  await b.close();

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

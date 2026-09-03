// Los tres logos de la transmisión, y dónde va cada uno.
//
// Hasta ahora había dos: el del campeonato y el de YourLift, y el de la
// federación no existía. En el Sudamericano manda FESUPO y en los nacionales
// FECHIPO, así que no puede estar escrito en el código: se sube por campeonato
// en el panel, igual que el del campeonato.
//
// Cada pantalla muestra los que le corresponden:
//
//   pantalla        federación  campeonato  yourlift
//   transición          no       sí, grande     no
//   scoreboard          sí          sí          no
//   tabla actual        no          sí          no
//   perfil              sí          sí          sí
//
// El scoreboard y la tabla están al aire todo el rato, y ahí lo que tiene que
// leerse es de quién es el campeonato, no de quién es el software. En el perfil,
// que es una pantalla completa y pausada, caben los tres.
//
// Lo otro que se cuida es el hueco: si un campeonato no subió ningún logo, el
// bloque no se dibuja. Antes quedaba un recuadro azul vacío al lado del nombre.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_treslogos.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const FED = 'https://ejemplo.cl/fesupo.png';
const CAMP = 'https://ejemplo.cl/sudamericano.png';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto(`http://localhost:${PUERTO}/livecast.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof _tiraLogos === 'function', null, { timeout: 25000 });

  // Qué logos quedaron en un pedazo de HTML, en orden.
  const cuales = (html) => (html.match(/src="([^"]+)"/g) || [])
    .map(s => s.slice(5, -1))
    .map(u => u === FED ? 'fed' : u === CAMP ? 'camp' : /YourLift_logo|yourlift_logo/.test(u) ? 'yl' : u);

  await p.evaluate(([fed, camp]) => {
    DATA.event = { id: 'ev1', name: 'Prueba', logoUrl: camp, logoFedUrl: fed };
  }, [FED, CAMP]);

  console.log('\nCada pantalla muestra los que le corresponden');
  {
    const r = await p.evaluate(() => ({
      scoreboard: _tiraLogos(['fed', 'camp'], '76px', '16px'),
      tabla: _tiraLogos(['camp'], '92px', '12px'),
      perfil: _tiraLogos(['fed', 'camp', 'yl'], '40px', '14px'),
      barrido: _barridoLogoImg(),
    }));
    ok(cuales(r.scoreboard).join(',') === 'fed,camp',
       'scoreboard: federación y campeonato, sin YourLift — ' + cuales(r.scoreboard).join(','));
    ok(cuales(r.tabla).join(',') === 'camp',
       'tabla actual: solo el del campeonato — ' + cuales(r.tabla).join(','));
    ok(cuales(r.perfil).join(',') === 'fed,camp,yl',
       'perfil: los tres — ' + cuales(r.perfil).join(','));
    ok(cuales(r.barrido).join(',') === 'camp',
       'transición: solo el del campeonato — ' + cuales(r.barrido).join(','));
  }

  console.log('\n  El de la transición se ve grande');
  {
    const r = await p.evaluate(() => _barridoLogoImg());
    // Era min(46vw,520px) y en medio de la cascada no se alcanzaba a ver.
    ok(/max-width:min\(72vw,1000px\)/.test(r), 'ocupa hasta el 72% del ancho');
    ok(/max-height:min\(52vh,520px\)/.test(r), 'y más de la mitad del alto');
    ok(/object-fit:contain/.test(r), 'sin deformarlo');
  }

  console.log('\n  Sin logos cargados no queda un hueco');
  {
    const r = await p.evaluate(() => {
      DATA.event = { id: 'ev1', name: 'Prueba' };     // ningún logo subido
      return {
        scoreboard: _tiraLogos(['fed', 'camp'], '76px', '16px'),
        tabla: _tiraLogos(['camp'], '92px', '12px'),
        perfil: _tiraLogos(['fed', 'camp', 'yl'], '40px', '14px'),
      };
    });
    ok(r.scoreboard === '', 'el bloque del scoreboard no se dibuja');
    ok(r.tabla === '', 'ni el de la tabla');
    ok(cuales(r.perfil).join(',') === 'yl', 'y en el perfil queda el de YourLift solo');
  }

  console.log('\n  Con solo uno de los dos, sale ese');
  {
    const r = await p.evaluate(fed => {
      DATA.event = { id: 'ev1', name: 'Prueba', logoFedUrl: fed };
      return _tiraLogos(['fed', 'camp'], '76px', '16px');
    }, FED);
    ok(cuales(r).join(',') === 'fed', 'solo el de la federación — ' + cuales(r).join(','));
    // Con uno solo no puede quedar la rayita separadora colgando.
    ok(!/background:rgba\(212,168,67,\.35\)/.test(r), 'y sin el separador, que separaría de nada');
  }

  console.log('\n  Si un logo no carga en medio de la transmisión');
  {
    const r = await p.evaluate(() => {
      DATA.event = { id: 'ev1', name: 'Prueba', logoUrl: 'x', logoFedUrl: 'y' };
      return _tiraLogos(['fed', 'camp'], '76px', '16px');
    });
    ok((r.match(/onerror=/g) || []).length === 2,
       'cada uno se esconde solo en vez de dejar el ícono de imagen rota');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/function _tiraLogos\(/.test(lc), 'una sola forma de armar la tira');
    ok(/DATA\.event\.logoFedUrl=e\.logoFedUrl\|\|''/.test(lc),
       'y el logo de la federación llega desde el campeonato');
    // Si el scoreboard volviera a tener el de YourLift escrito adentro, la regla
    // se rompería sin que nadie se diera cuenta.
    const sb = lc.slice(lc.indexOf('sb-card-explode'), lc.indexOf('sb-wipe-content'));
    ok(!/YourLift_logo\.png/.test(sb), 'el scoreboard ya no lo tiene escrito a mano');
    ok(/_tiraLogos\(\['camp'\],'92px'/.test(lc),
       'y la tabla actual pide solo el del campeonato');

    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/id="ef_logoFedUrl"/.test(adm), 'se sube desde la ficha del campeonato');
    ok(/logoFedUrl,/.test(adm), 'y se guarda con el evento');
    ok(/uploadEventLogo\(this\.files\[0\],'fed'\)/.test(adm), 'con la misma rutina que el otro logo');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

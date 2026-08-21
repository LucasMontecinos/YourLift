// El logo del campeonato en el barrido de transición.
//
// Entre una pantalla completa y otra, la transmisión pasa un barrido de tres
// cintas —rojo, blanco y azul— con un logo en el medio. Ese logo estaba escrito
// a mano: siempre el de YourLift, aunque el campeonato tuviera el suyo subido y
// ya se estuviera viendo en el Scoreboard y en la Tabla Actual.
//
// Ahora, si el campeonato subió su logo, en el barrido va el suyo.
//
// Lo que se cuida:
//   · que si no hay logo del campeonato, siga saliendo el de YourLift — la
//     transmisión no puede quedarse con un barrido pelado;
//   · que si el logo del campeonato no carga en medio de la transmisión, caiga
//     al de YourLift en vez de dejar un hueco;
//   · y que el barrido siga siendo lo que era: tres cintas, misma duración, y
//     que se limpie solo al terminar.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_barridologo.js
const fs = require('fs');
const { chromium } = require('playwright');
const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

console.log('\nEl logo sale del campeonato, no está escrito a mano');
{
  ok(/function _barridoLogoImg\(\)\{/.test(lc), 'hay una función que lo decide');
  ok(/\+_barridoLogoImg\(\)/.test(lc), 'y el barrido la usa');
  const f = lc.slice(lc.indexOf('function _barridoLogoImg'), lc.indexOf('function _startBarrido'));
  ok(/DATA\.event&&DATA\.event\.logoUrl/.test(f), 'mira el logo del campeonato');
  ok(/yourlift_logo_hd\.png/.test(f), 'y tiene al de YourLift de respaldo');
  ok(/onerror=/.test(f), 'con salida si la imagen no carga');
  // El barrido ya no puede tener el logo escrito adentro.
  const b = lc.slice(lc.indexOf('function _startBarrido'), lc.indexOf('function _txDetectTransitions'));
  ok(!/yourlift_logo_hd\.png/.test(b), 'y en el barrido ya no queda ninguno fijo');
}

console.log('\nDonde se sube, se dice que también sale ahí');
{
  ok(/barrido de transición<\/b>/.test(lc),
     'el panel donde se sube el logo lo menciona');
  ok(/en el barrido va el de YourLift/.test(lc),
     'y explica qué pasa si no hay ninguno');
  ok(/en el barrido se ve a pantalla completa/.test(lc),
     'y por qué conviene subirlo grande');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto('http://localhost:8972/livecast.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof _startBarrido === 'function' && typeof _barridoLogoImg === 'function',
    null, { timeout: 20000 });

  // Se corre el barrido de verdad y se mira lo que quedó en pantalla.
  const correr = async (logoUrl) => p.evaluate((url) => {
    DATA.event = { id: 'ev1', name: 'Campeonato de Prueba', logoUrl: url || '' };
    _startBarrido('in');
    const el = _txBarridoEl;
    const img = el && el.querySelector('img');
    const cintas = el ? [...el.querySelectorAll('div')].filter(d => /animation:txStripe/.test(d.getAttribute('style') || '')) : [];
    return {
      hay: !!el,
      src: img ? img.getAttribute('src') : null,
      onerror: img ? (img.getAttribute('onerror') || '') : '',
      estilo: img ? (img.getAttribute('style') || '') : '',
      cintas: cintas.length,
      colores: cintas.map(d => (d.getAttribute('style').match(/background:(#[0-9a-f]{6})/) || [])[1]),
    };
  }, logoUrl);

  console.log('\nCon el campeonato SIN logo propio');
  {
    const r = await correr('');
    ok(r.hay, 'el barrido se dibuja');
    ok(r.src === 'yourlift_logo_hd.png', 'y va el logo de YourLift: ' + r.src);
    ok(/YourLift_logo\.png/.test(r.onerror), 'con el respaldo del archivo chico si el grande falla');
  }

  console.log('\nCon el campeonato CON su logo');
  {
    const r = await correr('https://ejemplo.cl/logo-campeonato.png');
    ok(r.src === 'https://ejemplo.cl/logo-campeonato.png', 'va el del campeonato: ' + r.src);
    ok(/yourlift_logo_hd\.png/.test(r.onerror),
       'y si no carga en medio de la transmisión, cae al de YourLift');
    ok(/object-fit:contain/.test(r.estilo), 'sin deformarlo');
    ok(/max-width:min\(46vw,520px\)/.test(r.estilo),
       'y con lugar para uno apaisado, que es como suelen ser');
  }

  console.log('\n  El barrido sigue siendo el mismo');
  {
    const r = await correr('https://ejemplo.cl/logo-campeonato.png');
    ok(r.cintas === 3, 'las tres cintas siguen ahí (' + r.cintas + ')');
    ok(r.colores.join(',') === '#c41e3a,#ffffff,#0a1f44',
       'rojo, blanco y azul, en ese orden');
    // Y se limpia solo: si quedara pegado, taparía la transmisión.
    const antes = await p.evaluate(() => document.body.contains(_txBarridoEl) ? 1 : 0);
    ok(antes === 1, 'queda uno solo mientras corre');
    await p.waitForTimeout(2200);
    const despues = await p.evaluate(() => _txBarridoEl ? 1 : 0);
    ok(despues === 0, 'y al terminar se saca solo de la pantalla');
  }

  console.log('\n  Llamarlo dos veces seguidas no deja dos encima');
  {
    await p.evaluate(() => { _startBarrido('in'); _startBarrido('out'); });
    const n = await p.evaluate(() =>
      [...document.body.children].filter(e => (e.style || {}).zIndex === '200').length);
    ok(n === 1, 'reemplaza al anterior en vez de apilarlos (' + n + ')');
    await p.waitForTimeout(2200);
  }

  console.log('\n  Y sin evento cargado tampoco se cae');
  {
    let revento = false;
    try {
      const r = await p.evaluate(() => {
        DATA.event = null;
        _startBarrido('in');
        const img = _txBarridoEl && _txBarridoEl.querySelector('img');
        return img ? img.getAttribute('src') : null;
      });
      ok(r === 'yourlift_logo_hd.png', 'sin evento va el de YourLift');
    } catch (e) { revento = true; }
    ok(!revento, 'y no revienta');
    await p.waitForTimeout(2200);
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

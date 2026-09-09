// Una marca nominada imposible no se publica.
//
// La nómina de FESUPO llega como archivo y se muestra tal cual. José Manuel
// Conejera venía con 1125.5 kg en banca —son 112.5, un dedo de más al tipear— y
// así salió publicada una lámina del día 4 antes de que alguien lo notara.
//
// El control NO puede ser que SQ+BP+DL sume el total. Las marcas nominadas son
// la mejor sentadilla, la mejor banca y el mejor peso muerto de la carrera del
// atleta, y el mejor total de una competencia: vienen de fechas distintas y casi
// nunca cuadran entre sí. En esta misma nómina hay veinte atletas con
// diferencias de medio kilo a cincuenta, y las veinte son legítimas.
//
// Lo que sí es imposible, sin excepción: que UN solo movimiento sea mayor que el
// total declarado. El total es la suma de los tres, así que ninguno puede
// pasarlo. Esa es la regla, y atrapa el caso sin tocar ninguno de los veinte.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_marcanominada.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  console.log('\nLa nómina que se publica no trae marcas imposibles');
  {
    const nom = JSON.parse(fs.readFileSync('/home/user/YourLift/nomina_sudamericano.json', 'utf8'));
    const ats = nom.atletas || [];
    const malos = ats.filter(a => ['sq', 'bp', 'dl'].some(k => (+a[k] || 0) > (+a.total || 0) && (+a.total || 0) > 0));
    ok(!malos.length, 'ningún levantamiento pasa al total declarado'
      + (malos.length ? ' — ' + malos.slice(0, 3).map(a => (a.nDisp || a.n)).join(', ') : ''));
    // Y que el caso que lo destapó quedó con su valor bueno.
    const c = ats.find(a => /Conejera/i.test(a.n || ''));
    ok(c && c.bp === 112.5, 'Conejera quedó con 112.5 en banca (venía 1125.5)');
    ok(c && Math.abs(c.sq + c.bp + c.dl - c.total) < 0.01,
      'y ahora su suma cuadra con su total: ' + (c ? c.sq + ' + ' + c.bp + ' + ' + c.dl + ' = ' + c.total : ''));

    // La suma NO se usa de control, y este número lo explica: si se usara,
    // habría que "corregir" a veinte atletas que están bien.
    const noCuadran = ats.filter(a => (+a.total || 0) > 0 &&
      Math.abs((+a.sq || 0) + (+a.bp || 0) + (+a.dl || 0) - a.total) > 0.01);
    ok(noCuadran.length > 10, 'la suma no cuadra en ' + noCuadran.length
      + ' atletas y eso es normal: las marcas vienen de fechas distintas');
  }

  console.log('\n  Y si igual llegara una, no se muestra');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=suda2026_fesupo_full`,
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof _marcaSana === 'function', null, { timeout: 25000 });
  const r = await p.evaluate(() => ({
    imposible: _marcaSana(1125.5, 547.5),   // el caso real
    normal: _marcaSana(112.5, 547.5),
    igualAlTotal: _marcaSana(547.5, 547.5), // un total de un solo movimiento (only bench)
    sinTotal: _marcaSana(1125.5, 0),        // sin total no hay con qué comparar
    vacio: _marcaSana(null, 500),
  }));
  ok(r.imposible === 0, 'una banca mayor que el total se descarta');
  ok(r.normal === 112.5, 'una normal pasa igual');
  ok(r.igualAlTotal === 547.5, 'y una IGUAL al total también: es el caso del only bench');
  ok(r.sinTotal === 1125.5, 'sin total declarado no se descarta nada — no hay contra qué comparar');
  ok(r.vacio === 0, 'un valor vacío da cero');

  // La misma regla tiene que estar en el sitio público, que es donde se ve la nómina.
  const idx = await (await fetch(`http://localhost:${PUERTO}/index.html`)).text();
  ok(/function _marcaSana\(/.test(idx), 'el sitio público tiene la misma regla');
  ok(/sq:_marcaSana\(a\.sq,a\.total\)/.test(idx), 'y la aplica al armar la fila de la nómina');
  ok(!errs.length, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

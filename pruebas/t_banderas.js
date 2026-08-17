// Las banderas del país en el medallero.
//
// Dos cosas se pidieron mirando un medallero real del Regional Norte:
//   1. Que la bandera salga ENTRE el nombre y el total, no antes del nombre.
//   2. Que salga, a secas — en la captura no había ninguna.
//
// Lo segundo era el problema de fondo: las banderas venían de un servidor externo
// (flagcdn) y en competencia no cargaban. Se probó en el Regional Norte, en un
// iPad, y en el medallero no aparecía ninguna: quedaba el código de tres letras.
//
// Ahora se dibujan dentro del propio sistema, como SVG. No hay red de por medio,
// así que no pueden fallar. Los países que no están en la tabla —fuera de
// Sudamérica— siguen mostrando su código.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_banderas.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// La categoría del ejemplo, pero sudamericana: tres países distintos.
const MONTAR = `(paisRaro)=>{
  const n9=()=>({sq:[{w:230,r:'g'},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:150,r:'g'},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:255,r:'g'},{w:0,r:null},{w:0,r:null}]});
  const mk=(id,nom,pais,sq)=>{const a={id,name:nom,lot:id,flight:'A',sex:'Hombre',cat:'93',
    div:'Junior',mod:'classic',bw:92,club:'X',country:pais,bombed:false,att:n9()};
    a.att.sq[0]={w:sq,r:'g'};return a;};
  DATA.athletes=[mk(1,'Sebastian Nicolas VERGARA BARICIH',paisRaro||'CHI',250),
                 mk(2,'Benjamin Alejandro MOLINA RIOS','ARG',240),
                 mk(3,'Diego Ignacio Andres SILVA TERRAZAS','BRA',230)];
  DATA.phase='compete';
  _txDirState={medals:{active:true,until:0,mod:'classic',sex:'Hombre',div:'Junior',cat:'93'}};
  _txDirLastSig=null; renderTxWidget();
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  const externas = [];
  async function abrir(paisRaro) {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    // Se corta TODA la red externa: si algo saliera a buscar una bandera afuera,
    // esta prueba lo delataría.
    await p.route('**://**', r => {
      const u = r.request().url();
      if (/flagcdn|flag|bandera/i.test(u)) { externas.push(u); return r.abort(); }
      return /localhost:8972/.test(u) ? r.continue() : r.abort();
    });
    await p.goto('http://localhost:8972/livecast.html?tx=director&evento=suda2026_fesupo_full',
      { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
      null, { timeout: 20000 });
    await p.evaluate(([f, pa]) => eval('(' + f + ')')(pa), [MONTAR, paisRaro || '']);
    await p.waitForTimeout(700);
    return { p, errs };
  }

  console.log('\nLa bandera va entre el nombre y el total');
  {
    const { p, errs } = await abrir();
    const pos = await p.evaluate(() => {
      const bandera = document.querySelector('.flag-img');
      const fila = bandera && bandera.parentElement;
      if (!fila) return null;
      return [...fila.children].map(e =>
        e.classList.contains('flag-img') ? 'bandera'
        : /^\d+$/.test(e.textContent.trim()) ? 'puesto'
        : /VERGARA/.test(e.textContent) ? 'nombre'
        : /\d+\.\d/.test(e.textContent) ? 'total' : '?');
    });
    ok(!!pos, 'se encuentra la fila del podio');
    const iN = pos ? pos.indexOf('nombre') : -1;
    const iB = pos ? pos.indexOf('bandera') : -1;
    const iT = pos ? pos.indexOf('total') : -1;
    ok(iN >= 0 && iB >= 0 && iT >= 0, 'están el nombre, la bandera y el total: ' + (pos || []).join(' → '));
    ok(iN < iB && iB < iT, 'y en ese orden: nombre → bandera → total');
    ok(errs.length === 0, 'sin errores de JavaScript');
  }

  console.log('\n  Una bandera por atleta, y son las de su país');
  {
    const { p } = await abrir();
    const r = await p.evaluate(() => {
      const svgs = [...document.querySelectorAll('.flag-img')];
      return { n: svgs.length, paises: svgs.map(s => s.getAttribute('aria-label')),
               colores: svgs.map(s => (s.innerHTML.match(/#[0-9A-Fa-f]{6}/g) || []).join(',')) };
    });
    ok(r.n === 3, 'tres banderas (' + r.n + ')');
    ok(r.paises.join(',') === 'CHI,ARG,BRA', 'cada una con su país: ' + r.paises.join(', '));
    ok(/0039A6/i.test(r.colores[0]), 'Chile lleva su azul');
    ok(/74ACDF/i.test(r.colores[1]), 'Argentina su celeste');
    ok(/009C3B/i.test(r.colores[2]), 'Brasil su verde');
  }

  console.log('\nNo se sale a buscar nada afuera: no hay red que pueda fallar');
  ok(externas.length === 0,
     'ninguna petición externa' + (externas.length ? ': ' + externas.slice(0, 3).join(' | ') : ''));
  const fs2 = require('fs');
  const src = fs2.readFileSync(__dirname + '/../livecast.html', 'utf8');
  ok(!/flagcdn/.test(src), 'y no queda ninguna referencia a flagcdn en el código');

  console.log('\nUn país fuera de la tabla queda con su código');
  {
    const { p } = await abrir('XXX');
    const r = await p.evaluate(() => ({
      svgs: document.querySelectorAll('.flag-img').length,
      chips: [...document.querySelectorAll('.flag-code')].map(e => e.textContent.trim()),
    }));
    ok(r.svgs === 2, 'los dos que sí están se dibujan (' + r.svgs + ')');
    ok(r.chips.includes('XXX'), 'y el que no, muestra su código: ' + r.chips.join(', '));
  }

  console.log('\nEn "Atleta en barra" el código no se duplica');
  {
    const { p } = await abrir();
    const txt = await p.evaluate(() => {
      DATA.event = { id: 'x', name: 'P', logoUrl: '' };
      window._SCREEN_STATE = { mode: 'barra', flights: null, fondo: 'bandera' };
      renderTxWidget();
      return document.body.innerText;
    });
    ok((txt.match(/CHI/g) || []).length <= 1, 'el código aparece una sola vez');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

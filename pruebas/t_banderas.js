// Las banderas del país en el medallero.
//
// Dos cosas se pidieron mirando un medallero real del Regional Norte:
//   1. Que la bandera salga ENTRE el nombre y el total, no antes del nombre.
//   2. Que salga, a secas — en la captura no había ninguna.
//
// Lo segundo era el problema de fondo: la imagen viene de un servidor externo
// (flagcdn) y el `onerror` la escondía sin dejar nada en su lugar. En una
// transmisión eso pasa por cualquier cosa —la red del gimnasio, el servicio
// caído— y el podio queda sin ninguna referencia de país. Justo lo que más
// importa en un sudamericano.
//
// Ahora detrás de la bandera va el código de tres letras, que aparece solo si la
// imagen no llegó.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_banderas.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// La categoría del ejemplo, pero sudamericana: tres países distintos.
const MONTAR = `(()=>{
  const n9=()=>({sq:[{w:230,r:'g'},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:150,r:'g'},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:255,r:'g'},{w:0,r:null},{w:0,r:null}]});
  const mk=(id,nom,pais,sq)=>{const a={id,name:nom,lot:id,flight:'A',sex:'Hombre',cat:'93',
    div:'Junior',mod:'classic',bw:92,club:'X',country:pais,bombed:false,att:n9()};
    a.att.sq[0]={w:sq,r:'g'};return a;};
  DATA.athletes=[mk(1,'Sebastian Nicolas VERGARA BARICIH','CHI',250),
                 mk(2,'Benjamin Alejandro MOLINA RIOS','ARG',240),
                 mk(3,'Diego Ignacio Andres SILVA TERRAZAS','BRA',230)];
  DATA.phase='compete';
  _txDirState={medals:{active:true,until:0,mod:'classic',sex:'Hombre',div:'Junior',cat:'93'}};
  _txDirLastSig=null; renderTxWidget();
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  async function abrir(banderaCarga) {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    // Bandera de mentira (o 503) — desde acá no se alcanza flagcdn.
    await p.route('**/flagcdn.com/**', r => banderaCarga
      ? r.fulfill({ status: 200, contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><rect width="30" height="20" fill="#0039A6"/></svg>' })
      : r.fulfill({ status: 503, body: 'sin bandera' }));
    await p.goto('http://localhost:8972/livecast.html?tx=director&evento=suda2026_fesupo_full',
      { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
      null, { timeout: 20000 });
    await p.evaluate(MONTAR);
    await p.waitForTimeout(700);
    return { p, errs };
  }

  console.log('\nLa bandera va entre el nombre y el total');
  {
    const { p, errs } = await abrir(true);
    const pos = await p.evaluate(() => {
      // La fila del podio es la que tiene como hijo directo la bandera.
      const bandera = document.querySelector('.flag-wrap');
      const fila = bandera && bandera.parentElement;
      if (!fila) return null;
      return [...fila.children].map(e =>
        e.classList.contains('flag-wrap') ? 'bandera'
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

  console.log('\n  Se dibuja una bandera por cada atleta del podio');
  {
    const { p } = await abrir(true);
    const n = await p.evaluate(() =>
      document.querySelectorAll('.flag-img').length);
    ok(n === 3, 'tres banderas para tres países (' + n + ')');
  }

  console.log('\nSi la bandera no carga, queda el código del país');
  {
    const { p } = await abrir(false);
    const r = await p.evaluate(() => {
      const vis = e => e && getComputedStyle(e).display !== 'none';
      const imgs = [...document.querySelectorAll('.flag-img')];
      const chips = [...document.querySelectorAll('.flag-code')];
      return {
        imgsOcultas: imgs.every(i => !vis(i)),
        chipsVisibles: chips.filter(vis).map(e => e.textContent.trim()).sort(),
      };
    });
    ok(r.imgsOcultas, 'la imagen rota se esconde');
    ok(r.chipsVisibles.length === 3, 'y aparece el código de los tres (' + r.chipsVisibles.join(', ') + ')');
    ok(r.chipsVisibles.join(',') === 'ARG,BRA,CHI', 'cada uno con su país');
  }

  console.log('\n  Con la bandera cargada, el código NO estorba');
  {
    const { p } = await abrir(true);
    const chips = await p.evaluate(() =>
      [...document.querySelectorAll('.flag-code')]
        .filter(e => getComputedStyle(e).display !== 'none').length);
    ok(chips === 0, 'el código queda oculto detrás de la bandera (' + chips + ' visibles)');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

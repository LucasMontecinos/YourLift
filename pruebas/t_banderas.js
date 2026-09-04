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

  console.log('\n  Los escudos y soles están dibujados, no son un círculo liso');
  {
    // Lo que se pidió mirando las banderas de otra página: que se note el sol de
    // Argentina y Uruguay, el escudo de Ecuador, el de Bolivia. Antes cada uno de
    // esos era un <circle> amarillo y a simple vista todas las banderas con
    // emblema se parecían entre sí.
    const { p } = await abrir();
    const F = await p.evaluate(() => FLAG_SVG);

    // Un sol se dibuja con rayos: muchos triangulitos en un path, no un círculo.
    const rayos = k => ((F[k].match(/Z/g) || []).length);
    ok(rayos('ARG') >= 16, 'el sol de Argentina tiene sus rayos (' + rayos('ARG') + ')');
    ok(rayos('URU') >= 16, 'y el de Uruguay también (' + rayos('URU') + ')');
    ok(/85340A/.test(F.ARG), 'con la cara del sol marcada');

    // Los escudos son un dibujo, no un disco de un solo color.
    const cuerpos = k => ((F[k].match(/<path|<ellipse/g) || []).length);
    ok(cuerpos('ECU') >= 5, 'Ecuador lleva su escudo con el cóndor (' + cuerpos('ECU') + ' piezas)');
    ok(cuerpos('BOL') >= 5, 'Bolivia el suyo con los laureles (' + cuerpos('BOL') + ')');
    ok(/F5C518/.test(F.PAR), 'Paraguay la estrella de su emblema');
    ok((F.VEN.match(/Z/g) || []).length >= 8, 'Venezuela sus ocho estrellas');
    ok((F.USA.match(/Z/g) || []).length >= 12, 'y Estados Unidos las suyas en el cantón');
    ok(/<path/.test(F.MEX) && /<path/.test(F.ESP) && /<path/.test(F.POR),
       'México, España y Portugal dejan de ser franjas peladas');

    // El detalle no puede costar el peso de la página: son 20 banderas dibujadas
    // a mano, no imágenes.
    const peso = Object.values(F).join('').length;
    ok(peso < 20000, 'las veinte pesan ' + Math.round(peso / 1024) + ' KB en total');
  }

  console.log('\n  Son rectangulares, no redondas');
  {
    const { p } = await abrir();
    const r = await p.evaluate(() => {
      const s = document.querySelector('.flag-img');
      const c = getComputedStyle(s);
      return { radio: c.borderRadius, w: s.getBoundingClientRect().width,
               h: s.getBoundingClientRect().height, box: s.getAttribute('viewBox') };
    });
    ok(!/50%|9999/.test(r.radio), 'la esquina apenas se redondea: ' + r.radio);
    ok(Math.abs(r.w / r.h - 1.5) < 0.05, 'y guarda la proporción 3:2 de una bandera');
    ok(r.box === '0 0 30 20', 'el lienzo también');
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

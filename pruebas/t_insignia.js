// Qué se muestra junto al nombre: la bandera del país o el logo del club.
//
// En un sudamericano la bandera es EL dato: dice a quién representa cada uno. En
// un campeonato chileno son todos CHI y la bandera no informa nada — ahí lo que se
// busca es de qué club viene. Poner las dos cosas es ruido, y hacer que alguien lo
// configure antes de cada campeonato es una cosa más que se puede olvidar.
//
// Se decide solo: si el campeonato tiene más de un país, manda la bandera; si es
// de uno solo, manda el club. Es el mismo criterio con el que el acta elige entre
// la columna "País" y la columna "Club".
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_insignia.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// paises: cuántos distintos hay en la nómina
const MONTAR = `(paises)=>{
  const n9=()=>({sq:[{w:200,r:'g'},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:120,r:'g'},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:230,r:'g'},{w:0,r:null},{w:0,r:null}]});
  const P=['CHI','ARG','BRA'], CLUB=['Black Bars','Hannya','All Power'];
  const out=[];
  for(let i=0;i<6;i++){
    out.push({id:i+1,name:'Atleta Numero '+(i+1),lot:100+i,flight:'A',sex:'Hombre',
      cat:'93',div:'Open',mod:'classic',bw:92,club:CLUB[i%CLUB.length],
      country:P[i%paises],bombed:false,att:n9()});
  }
  DATA.athletes=out; DATA.lift='sq'; DATA.round=0; DATA.flight='A';
  DATA.event={id:'x',name:'Campeonato de Prueba',short:'Prueba'};
  window._VARIOS_PAISES=undefined;      // el caché se recalcula
  return _variosPaises();
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof _insignia === 'function',
    null, { timeout: 20000 });

  const montar = n => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [MONTAR, n]);

  console.log('\nEl sistema detecta solo si el campeonato es internacional');
  ok(await montar(3) === true, 'con tres países dice que sí');
  ok(await montar(1) === false, 'con uno solo dice que no');

  console.log('\nCampeonato con varios países → manda la bandera');
  {
    await montar(3);
    const r = await p.evaluate(() => {
      const html = _insignia(DATA.athletes[0], 14);
      return { bandera: /class="flag-img"/.test(html), club: /clubLogo|club-logo/i.test(html) };
    });
    ok(r.bandera, 'sale la bandera del país');
    ok(!r.club, 'y no el logo del club');
  }

  console.log('\nCampeonato de un solo país → manda el club');
  {
    await montar(1);
    const r = await p.evaluate(() => {
      const html = _insignia(DATA.athletes[0], 14);
      return { bandera: /class="flag-img"/.test(html), algo: html.length > 0, html: html.slice(0, 60) };
    });
    ok(!r.bandera, 'ya no sale la bandera, que no informaba nada');
    ok(/clubs\//.test(r.html), 'sale el logo del club: ' + r.html);
  }

  console.log('\n  Sin logo de club, la bandera igual sirve de respaldo');
  {
    const r = await p.evaluate(() => {
      DATA.athletes.forEach(a => { a.club = ''; });
      window._VARIOS_PAISES = undefined;
      return /class="flag-img"|flag-code/.test(_insignia(DATA.athletes[0], 14));
    });
    ok(r, 'no queda el hueco vacío');
  }

  console.log('\nSe usa en las cuatro pantallas');
  ok(/\$\{_insignia\(a,15\)\}/.test(src), 'Tabla Actual (el ranking de la esquina)');
  ok(/_insignia\(a,fs\(13\)\)/.test(src), 'la tabla de jornada');
  ok(/_insignia\(a,13\)/.test(src), 'las fichas de Atletas del campeonato');
  ok(/_variosPaises\(\)\?_flagImg\(_ctry\(a\),12,true\):''/.test(src),
     'y en Resultados, donde el club ya se muestra abajo, la bandera sale solo si hay varios países');

  console.log('\n  El caché se rehace al cambiar de campeonato');
  ok(/window\._VARIOS_PAISES=undefined;/.test(src), 'se limpia en pickEvent');

  console.log('\nEn Tabla Actual se dibuja de verdad');
  {
    await montar(3);
    const r = await p.evaluate(() => {
      const html = renderTxTablaActual(DATA.athletes[0], {});
      return { hay: /class="flag-img"/.test(html), n: (html.match(/class="flag-img"/g) || []).length };
    });
    ok(r.hay, 'aparecen banderas en la tabla (' + r.n + ')');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

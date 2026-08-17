// "Atleta en barra": el modo nuevo de la Pantalla de Tarima, al estilo del
// tablero de intentos de la IPF.
//
// Se pidió calcado de una foto de un mundial, con tres cosas fuera a propósito:
// el nombre largo del país (la bandera y el código ya lo dicen), la conversión a
// libras y el cronómetro. Y con el logo del campeonato donde ese tablero pone el
// número de lote.
//
// El fondo es una cadena que se corta en el primero que exista:
//   bandera del país del atleta → logo del campeonato → azul de YourLift.
//
// Y si el peso que va a levantar sería récord, parpadea el cartel. Qué récord
// dice lo manda el campeonato: hoy solo está cargada la tabla sudamericana.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_barra.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MONTAR = `(pais,logo,fondo)=>{
  const n9=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  const a={id:1,name:'Angelo Matias FORTINO SILVA',lot:197,flight:'A',sex:'Hombre',
    cat:'83',div:'Open',mod:'classic',bw:82.4,club:'Athor',country:pais,bombed:false,att:n9()};
  a.att.sq=[{w:300,r:'g'},{w:312.5,r:'g'},{w:322.5,r:null}];
  DATA.athletes=[a];
  DATA.lift='sq'; DATA.round=2; DATA.flight='A'; DATA.phase='compete';
  DATA.event={id:'x',name:'Campeonato de Prueba',short:'Prueba',logoUrl:logo||''};
  window._SCREEN_STATE={mode:'barra',flights:null,fondo:fondo||'bandera'};
  renderTxWidget();
  return document.body.innerHTML;
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/flagcdn.com/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><rect width="30" height="20" fill="#0039A6"/></svg>' }));
  await p.goto('http://localhost:8972/livecast.html?tx=screen&evento=suda2026_fesupo_full',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
    null, { timeout: 20000 });

  const montar = (pais, logo, fondo) =>
    p.evaluate(([f, pa, lo, fo]) => eval('(' + f + ')')(pa, lo, fo), [MONTAR, pais, logo, fondo]);

  console.log('\nLo que se ve en pantalla');
  let html = await montar('CHI', '', 'bandera');
  const txt = await p.evaluate(() => document.body.innerText);
  ok(/FORTINO SILVA/.test(txt), 'el apellido, grande');
  ok(/Angelo Matias/.test(txt), 'y el nombre, más chico');
  ok(/SQ 3/.test(txt), 'el movimiento y el intento: SQ 3');
  ok(/322\.5/.test(txt), 'el peso de la barra');
  ok(/KG/.test(txt), 'en kilos');
  ok(/CHI/.test(txt), 'el código del país');
  ok(/83/.test(txt) && /OPN|Open/i.test(txt), 'la categoría y la división: ' + (txt.match(/83[^\n]*/)||[''])[0]);

  console.log('\n  Y lo que se sacó a propósito');
  ok(!/LBS|LIBRAS/i.test(txt), 'no hay libras');
  ok(!/\b\d{1,2}:\d{2}\b/.test(txt), 'no hay cronómetro');
  ok(!/CHILE|U\.S\.|AMERICA/i.test(txt), 'no está el nombre largo del país');

  console.log('\n  El intento sale del movimiento y la ronda en curso');
  const otros = await p.evaluate(() => {
    const out = {};
    DATA.lift = 'sq'; DATA.round = 0; renderTxWidget();
    out.sq1 = /SQ 1/.test(document.body.innerText);
    DATA.athletes[0].att.bp = [{ w: 200, r: null }, { w: 0, r: null }, { w: 0, r: null }];
    DATA.lift = 'bp'; DATA.round = 0; renderTxWidget();
    out.bp1 = /BP 1/.test(document.body.innerText);
    DATA.athletes[0].att.dl = [{ w: 250, r: 'g' }, { w: 0, r: null }, { w: 270, r: null }];
    DATA.lift = 'dl'; DATA.round = 2; renderTxWidget();
    out.dl3 = /DL 3/.test(document.body.innerText);
    return out;
  });
  ok(otros.sq1 && otros.bp1 && otros.dl3, 'SQ 1, BP 1 y DL 3 se leen bien');

  console.log('\nEl fondo es una cadena de tres');
  {
    const conBandera = await montar('BRA', '', 'bandera');
    ok(/0,\s*156,\s*59|009C3B/i.test(conBandera), 'con BRA toma el verde de Brasil');
    const chi = await montar('CHI', '', 'bandera');
    ok(/0,\s*57,\s*166|0039A6/i.test(chi), 'con CHI toma el azul de Chile');
    const sinPais = await montar('XXX', '', 'bandera');
    // El <script> vive dentro del body, así que innerHTML trae también el código
    // fuente: hay que mirar el estilo del contenedor, no el HTML entero.
    const fondoXXX = await p.evaluate(() => {
      const d = [...document.querySelectorAll('div')]
        .find(e => /linear-gradient/.test(e.getAttribute('style') || ''));
      return d ? d.getAttribute('style') : '';
    });
    ok(/0A1628/i.test(fondoXXX) && !/rgba\(0, ?57, ?166/.test(fondoXXX),
       'un país sin tabla cae al azul YourLift');
  }
  {
    const conLogo = await montar('CHI', 'https://ejemplo.cl/logo.png', 'logo');
    ok(/ejemplo\.cl\/logo\.png/.test(conLogo), 'con fondo "logo" y logo cargado, se usa el logo');
    const sinLogo = await montar('CHI', '', 'logo');
    ok(!/url\(\)/.test(sinLogo) && /0A1628/i.test(sinLogo),
       'con fondo "logo" y sin logo cargado, cae al azul YourLift');
    const azul = await montar('CHI', 'https://ejemplo.cl/logo.png', 'yourlift');
    ok(/0A1628/i.test(azul), 'y el azul se puede elegir a mano');
  }

  console.log('\n  El logo del campeonato va abajo, donde el tablero pone el lote');
  {
    const conLogo = await montar('CHI', 'https://ejemplo.cl/logo.png', 'bandera');
    ok(/<img[^>]+ejemplo\.cl\/logo\.png/.test(conLogo), 'el logo se dibuja');
    const visible = await p.evaluate(() => document.body.innerText);
    ok(!/Lot|197/.test(visible), 'y el número de lote ya no aparece en pantalla');
  }

  console.log('\nEl cartel de récord parpadea solo cuando corresponde');
  {
    const r = await p.evaluate(() => {
      const out = {};
      out.sinRecords = /INTENTO DE RÉCORD/.test(document.body.innerText);
      // El campeonato define qué tabla rige.
      DATA.event.records = 'nacional';
      out.etiquetaNacional = _recordEtiqueta();
      DATA.event.records = 'suda';
      out.etiquetaSuda = _srOn() ? _recordEtiqueta() : '(sin tabla suda cargada acá)';
      DATA.event.records = '';
      out.etiquetaVacia = _recordEtiqueta();
      return out;
    });
    ok(!r.sinRecords, 'sin récord a la vista, no hay cartel');
    ok(r.etiquetaNacional === 'INTENTO DE RÉCORD NACIONAL',
       'un campeonato nacional diría: ' + r.etiquetaNacional);
    ok(r.etiquetaVacia === '', 'y uno sin tabla de récords no dice nada');
  }
  ok(/function _recordEtiqueta\(\)/.test(src), 'la etiqueta sale del campeonato, no está fija');
  ok(/r==='nacional'\)return 'INTENTO DE RÉCORD NACIONAL'/.test(src), 'ya contempla la tabla nacional para cuando se cargue');
  ok(/@keyframes barraParpadeo/.test(src), 'y el parpadeo está definido');
  ok(/prefers-reduced-motion/.test(src), 'respetando a quien pidió menos animación');

  console.log('\nEl modo está en el panel de control');
  ok(/mb\('barra','ATLETA EN BARRA'/.test(src), 'aparece el botón del modo');
  ok(/window\.screenSetFondo=function/.test(src), 'y el selector de fondo');
  ok(/fondo:window\._SCREEN_LOCAL\.fondo\|\|'bandera'/.test(src),
     'el fondo elegido viaja a la pantalla junto con el modo');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

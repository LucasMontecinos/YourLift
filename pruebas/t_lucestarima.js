// Luces de jueces dentro de las pantallas de tarima.
//
// Se pidieron en "Pantalla de Intentos" y en "Atleta en barra", sincronizadas con
// las luces que ya existen, con dos condiciones:
//   · que se puedan quitar, por si el campeonato no usa luces;
//   · y —lo importante— que NO sirvan para dar válido o nulo. Eso se sigue dando
//     en Control en Vivo o en la planilla. Acá la pantalla es un espejo: mira el
//     mismo documento de Firestore que los jueces escriben, y no escribe nada.
//
// Esa última parte es la que hay que cuidar: si esta pantalla llegara a marcar un
// intento, dos caminos distintos estarían decidiendo lo mismo y en una competencia
// eso termina en un intento juzgado dos veces.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_lucestarima.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MONTAR = `(modo,luces)=>{
  const n9=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  const a={id:1,name:'Sebastian Nicolas VERGARA BARICIH',lot:1,flight:'A',sex:'Hombre',
    cat:'93',div:'Junior',mod:'classic',bw:92,club:'Athor',country:'CHI',bombed:false,att:n9()};
  a.att.sq=[{w:250,r:null},{w:0,r:null},{w:0,r:null}];
  DATA.athletes=[a]; DATA.lift='sq'; DATA.round=0; DATA.flight='A'; DATA.phase='compete';
  DATA.event={id:'x',name:'Prueba',logoUrl:''};
  window._SCREEN_STATE={mode:modo,flights:null,fondo:'yourlift',luces:luces};
  renderTxWidget();
}`;

// Enciende las luces como si los jueces las hubieran marcado.
const MARCAR = `(izq,central,der)=>{
  _txLights={izq:izq,central:central,der:der};
  renderTxWidget();
}`;

const LEER = `()=>{
  // Las luces son círculos: se cuentan por su border-radius y su tamaño.
  const luces=[...document.querySelectorAll('div')].filter(e=>{
    const st=e.getAttribute('style')||'';
    return /border-radius:50%/.test(st) && /border:4px solid/.test(st);
  });
  return { n:luces.length, colores:luces.map(e=>{
    const st=e.getAttribute('style')||'';
    return /background:#fff/.test(st)?'blanca':(/background:#ef4444/.test(st)?'roja':'apagada');
  })};
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=screen&evento=suda2026_fesupo_full',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
    null, { timeout: 20000 });

  const montar = (modo, luces) => p.evaluate(([f, m, l]) => eval('(' + f + ')')(m, l), [MONTAR, modo, luces]);
  const marcar = (i, c, d) => p.evaluate(([f, a, b2, c2]) => eval('(' + f + ')')(a, b2, c2), [MARCAR, i, c, d]);
  const leer = () => p.evaluate(([f]) => eval('(' + f + ')')(), [LEER]);

  console.log('\nSe muestran en las dos pantallas de tarima');
  for (const modo of ['barra', 'intentos']) {
    await montar(modo, true);
    await marcar('white', 'white', 'red');
    const r = await leer();
    ok(r.n === 3, modo + ': se dibujan las tres luces (' + r.n + ')');
    ok(r.colores.join(',') === 'blanca,blanca,roja',
       modo + ': con el color que marcó cada juez (' + r.colores.join(', ') + ')');
  }

  console.log('\nSe pueden quitar');
  for (const modo of ['barra', 'intentos']) {
    await montar(modo, false);
    await marcar('white', 'white', 'red');
    const r = await leer();
    ok(r.n === 0, modo + ': apagadas, no queda ninguna en pantalla (' + r.n + ')');
  }

  console.log('\nSiguen a los jueces en vivo');
  {
    await montar('barra', true);
    await marcar(null, null, null);
    let r = await leer();
    ok(r.colores.every(c => c === 'apagada'), 'antes de que voten, las tres apagadas');
    await marcar('red', 'red', 'red');
    r = await leer();
    ok(r.colores.join(',') === 'roja,roja,roja', 'tres nulos se ven rojos');
    await marcar('white', 'red', 'white');
    r = await leer();
    ok(r.colores.join(',') === 'blanca,roja,blanca', 'y un dos-a-uno se ve tal cual');
  }

  console.log('\nLa pantalla NO decide: solo mira');
  {
    await montar('barra', true);
    const antes = await p.evaluate(() => JSON.stringify(DATA.athletes[0].att.sq[0]));
    await marcar('white', 'white', 'white');
    const despues = await p.evaluate(() => JSON.stringify(DATA.athletes[0].att.sq[0]));
    ok(antes === despues, 'con tres luces blancas el intento sigue sin juzgar: ' + despues);
    const modo = await p.evaluate(() => (typeof judgeMode !== 'undefined') ? judgeMode : 'n/d');
    ok(modo === false, 'y no se enciende el modo jueces (' + modo + ')');
  }
  // Lo mismo, mirando el código: la pantalla solo se suscribe, nunca escribe.
  const iLuces = src.indexOf('function renderLucesTarima()');
  const cuerpo = src.slice(iLuces, src.indexOf('\n}', iLuces));
  ok(!/setDoc|setAtt|updA|_markAtt/.test(cuerpo), 'la función de las luces no escribe nada');
  ok(/_txStartLightsListener\(\);/.test(cuerpo), 'solo se suscribe al documento de los jueces');

  console.log('\nEl interruptor está en el panel');
  ok(/window\.screenToggleLuces=function/.test(src), 'existe el botón para prenderlas y apagarlas');
  ok(/mode==='barra'\|\|mode==='intentos'/.test(src), 'y aparece solo en las dos pantallas donde aplica');
  ok(/luces:!!window\._SCREEN_LOCAL\.luces,/.test(src), 'la elección viaja a la pantalla con el resto del estado');
  ok(/luces:false\}/.test(src), 'arranca apagado: no aparece solo en una competencia en curso');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

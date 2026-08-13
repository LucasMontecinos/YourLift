// La vista del espectador en Competencia en Vivo: elegir qué tanda mirar, y ver la
// posición proyectada de cada categoría.
//
// Lo que pidieron los que la usaron: poder revisar otra tanda sin que la pantalla
// los devuelva de un salto en cuanto alguien carga un peso en la tanda que está
// compitiendo; y ver dónde quedaría cada atleta en su categoría y división si
// levanta lo que tiene declarado — al empezar el movimiento, su apertura.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_espectador.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Tres tandas. En -83 conviven Junior y Open, que premian por separado.
const MONTAR = `(()=>{
  const nueve=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  DATA.phase='compete'; DATA.lift='sq'; DATA.round=0; DATA.flight='A';
  DATA.event={id:'x',name:'Regional Norte FECHIPO 2026'};
  const N=[
   ['Juan Perez Soto','Hombre','83','Junior','Black Bars','A',82.1,180],
   ['Pedro Diaz Rojas','Hombre','83','Junior','Los Toros','A',82.8,190],
   ['Luis Mora Vera','Hombre','83','Open','Black Bars','A',82.5,200],
   ['Ivan Castro Lillo','Hombre','83','Open','Primal Strength','A',82.9,210],
   ['Marco Nunez Paz','Hombre','93','Open','Los Toros','B',92.4,230],
   ['Raul Vega Pinto','Hombre','93','Open','Hannya Strength','B',92.0,240],
   ['Ana Rios Leiva','Mujer','63','Open','Primal Strength','C',62.4,120],
   ['Sofia Lagos Bravo','Mujer','63','Open','Hannya Strength','C',62.8,125],
  ];
  DATA.athletes=N.map(([name,sex,cat,div,club,flight,bw,op],i)=>{
    const a={id:i+1,name,sex,cat,div,mod:'classic',club,flight,bw,
             lot:(flight.charCodeAt(0)-64)*100+i,bombed:false,att:nueve()};
    a.att.sq[0]={w:op,r:null};
    return a;
  });
  // Los dos de Junior ya salieron: Pedro hizo 190, Juan hizo 180 y pidió 190.
  DATA.athletes[0].att.sq[0]={w:180,r:'g'};
  DATA.athletes[0].att.sq[1]={w:190,r:null};
  DATA.athletes[1].att.sq[0]={w:190,r:'g'};
  isAdmin=false;
  setNavLibre(false);
  go('liveView');
})()`;

const TEXTO = () => document.querySelector('.main').innerText;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined', null, { timeout: 20000 });
  await p.evaluate(MONTAR);
  await p.waitForTimeout(400);

  console.log('\nEl espectador elige qué tanda mirar');
  const auto = await p.evaluate(() => ({ libre: !!window.NAV_LIBRE, flight: DATA.flight }));
  ok(auto.libre === false && auto.flight === 'A', 'arranca en automático, siguiendo a la tarima');
  ok(/VER TANDA/.test(await p.evaluate(TEXTO)), 'aparece el selector de tandas');
  ok(/AUTOMÁTICO/.test(await p.evaluate(TEXTO)), 'con la opción automática');

  await p.evaluate(() => liveVerTanda('C'));
  await p.waitForTimeout(250);
  const elegida = await p.evaluate(() => ({ libre: !!window.NAV_LIBRE, flight: DATA.flight }));
  ok(elegida.libre === true && elegida.flight === 'C', 'al elegir la C se queda en la C');
  ok(/Ana Rios Leiva/.test(await p.evaluate(TEXTO)), 'y se ven los atletas de esa tanda');

  console.log('\n  Y no lo devuelven de un salto cuando avanza la tarima');
  // Llega un snapshot: la tarima se movió a la B y alguien cargó un peso.
  await p.evaluate(() => {
    window._NAV_REMOTA = { lift: 'sq', round: 0, flight: 'B', forcedCurrent: null };
    if (!window.NAV_LIBRE) DATA.flight = 'B';   // es lo que hace el merge real
    R();
  });
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => DATA.flight) === 'C', 'sigue mirando la C');
  const aviso = await p.evaluate(TEXTO);
  ok(/En tarima está compitiendo la B/.test(aviso), 'y se le avisa dónde está la tarima');
  ok(/IR A LA TARIMA/.test(aviso), 'con un atajo para volver');

  await p.evaluate(() => liveVerTanda(null));
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => !window.NAV_LIBRE), 'AUTOMÁTICO vuelve a seguir a la tarima');

  console.log('\nPestaña "Resultados por categoría"');
  // Ahora es una pestaña propia del menú, no un botón dentro de Competencia en Vivo.
  await p.evaluate(() => { DATA.flight = 'A'; go('catResults'); });
  await p.waitForTimeout(300);
  const cat = await p.evaluate(() => {
    const filas = [...document.querySelectorAll('.main table')].map(t => ({
      titulo: (t.closest('.card') || {}).innerText.split('\n')[0] || '',
      filas: [...t.querySelectorAll('tr')].slice(1).map(tr =>
        [...tr.children].map(td => td.innerText.replace(/\s+/g, ' ').trim())),
    }));
    return { filas, texto: document.querySelector('.main').innerText };
  });
  const grupo = t => cat.filas.find(g => new RegExp(t).test(g.titulo));

  ok(!!grupo('Junior -83'), 'hay un cuadro para Junior -83 kg');
  ok(!!grupo('Open -83'), 'y otro aparte para Open -83 kg');
  ok(!!grupo('DAMAS.*Open -63'), 'y uno para las damas -63 Open');

  console.log('\n  Con los openers ya se ve el orden, antes de que levante nadie');
  const d63 = grupo('DAMAS.*Open -63');
  ok(d63 && d63.filas.length === 2, 'las dos atletas de -63 están');
  ok(d63 && /Sofia/.test(d63.filas[0].join(' ')), 'primera la de la apertura más alta: ' +
     (d63 ? d63.filas[0][1].split('\n')[0] : '—'));
  ok(d63 && d63.filas[0].join('|').includes('125'), 'con su declarado y su proyectado en 125');

  console.log('\n  Y el puesto proyectado manda sobre el orden de las filas');
  // Junior -83: Pedro hizo 190; Juan hizo 180 y pidió 190. Empatan en 190, y con el
  // total empatado gana el más liviano (82.1 contra 82.8): Juan va 1°.
  const jr = grupo('Junior -83');
  ok(jr && jr.filas.length === 2, 'los dos de Junior están');
  ok(jr && /^1°/.test(jr.filas[0][0]), 'la primera fila es la que muestra 1°: ' + (jr ? jr.filas[0][0] : '—'));
  ok(jr && /Juan/.test(jr.filas[0][1]), 'y es Juan, que empata en 190 y pesa menos');
  ok(jr && /▲/.test(jr.filas[0][0]), 'marcado con ▲ porque sube de puesto si lo levanta');

  console.log('\n  Se ven todas las tandas, no solo la que está en tarima');
  ok(/tanda B/.test(cat.texto) && /tanda C/.test(cat.texto),
     'los cuadros traen atletas de la B y de la C aunque la tarima esté en la A');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

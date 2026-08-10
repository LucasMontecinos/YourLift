// El marcador: nombre como se escribe, letra blanca con reborde negro, y colores
// que siguen la paleta elegida en Control TX.
//
// Antes el apellido salía en MAYÚSCULAS y más marcado que el nombre ("Walter
// Humberto OLIVARES GUTIÉRREZ"), la letra era azul oscuro sobre la barra dorada, y
// los colores del marcador estaban fijos en el código: la paleta de Control TX no
// le hacía nada.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_marcador.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const BANDERA = {
  goodLift: '#22c55e', noLift: '#ef4444', puesto: '#ffffff', curAttempt: '#122c52',
  nameBg: '#C41E3A', nameBg2: '#8B1525', nameText: '#ffffff', accent: '#ffffff',
  headerBg: '#0A1628', gridBg: '#0b1826', lbHighlight: '#C41E3A', cardBg: '#0d1e38',
};

const MONTAR = `(()=>{
  const nueve=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  DATA.phase='compete'; DATA.lift='sq'; DATA.round=0; DATA.flight='A';
  DATA.event={id:'x',name:'Regional Norte FECHIPO 2026'};
  const a={id:1,name:'WALTER HUMBERTO OLIVARES GUTIÉRREZ',lot:101,flight:'A',sex:'Hombre',
    cat:'93',div:'Junior',mod:'classic',bw:92,club:'Black Bars',country:'CHI',bombed:false,att:nueve()};
  a.att.sq[0]={w:120,r:null};
  DATA.athletes=[a];
  window._txSbShownAt=Date.now(); window._txSbSig=null;
  if(typeof renderTxWidget==='function')renderTxWidget();
})()`;

async function abrir(b, colores) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 340 } });
  if (colores) await ctx.addInitScript(c => localStorage.setItem('fechipo_tx_colors', JSON.stringify(c)), colores);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=scoreboard&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined', null, { timeout: 20000 });
  await p.evaluate(MONTAR);
  await p.waitForTimeout(500);
  return { p, errs };
}

// Nombre y categoría del marcador, con su color y su sombra ya calculados.
const LEER = () => {
  const divs = [...document.querySelectorAll('div')];
  const n = divs.find(e => /Olivares/i.test(e.textContent) && e.children.length === 0);
  const c = divs.find(e => /^-?\d+kg/.test(e.textContent.trim()) && e.children.length === 0);
  const cs = e => e ? getComputedStyle(e) : null;
  return {
    nombre: n ? n.textContent.trim() : '',
    nombreColor: n ? cs(n).color : '',
    nombreSombra: n ? cs(n).textShadow : '',
    nombreSize: n ? cs(n).fontSize : '',
    cat: c ? c.textContent.trim() : '',
    catColor: c ? cs(c).color : '',
    catSombra: c ? cs(c).textShadow : '',
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nEl nombre va como se escribe');
  const { p, errs } = await abrir(b, null);
  const r = await p.evaluate(LEER);
  ok(r.nombre === 'Walter Humberto Olivares Gutiérrez',
     'inicial en mayúscula y el resto en minúscula: "' + r.nombre + '"');
  ok(!/[A-ZÁÉÍÓÚÑ]{3}/.test(r.nombre), 'el apellido ya no va en mayúsculas');

  console.log('\nBlanco con reborde negro');
  ok(r.nombreColor === 'rgb(255, 255, 255)', 'la letra del nombre es blanca (' + r.nombreColor + ')');
  ok(/rgb\(0, 0, 0\)/.test(r.nombreSombra), 'con reborde negro');
  ok((r.nombreSombra.match(/rgb\(0, 0, 0\)/g) || []).length >= 8,
     'el reborde rodea la letra entera, no es una sombra a un lado');
  ok(r.cat === '-93kg JR', 'la categoría se lee: ' + r.cat);
  ok(r.catColor === 'rgb(255, 255, 255)', 'y también va blanca (' + r.catColor + ')');
  ok(/rgb\(0, 0, 0\)/.test(r.catSombra), 'con su reborde negro');

  console.log('\nEl color de la letra se cambia; el reborde no');
  const verde = await abrir(b, { ...BANDERA, marcadorText: '#22c55e' });
  const rv = await verde.p.evaluate(LEER);
  ok(rv.nombreColor === 'rgb(34, 197, 94)', 'la letra toma el color puesto en Control TX (' + rv.nombreColor + ')');
  ok(/rgb\(0, 0, 0\)/.test(rv.nombreSombra), 'el reborde sigue negro');
  ok(rv.catColor === 'rgb(34, 197, 94)', 'la categoría acompaña al nombre');
  ok(/marcadorText/.test(src) && /Letra del marcador/.test(src),
     'el color está en el panel de colores de Control TX');
  ok(/marcadorText:'#ffffff'/.test(src), 'y arranca en blanco');

  console.log('\nLos colores del marcador siguen la paleta');
  const { p: p2, errs: e2 } = await abrir(b, BANDERA);
  const cols = await p2.evaluate(() => {
    const rgb = e => getComputedStyle(e).backgroundColor;
    const divs = [...document.querySelectorAll('div')];
    const barra = divs.find(e => /linear-gradient/.test(e.style.background || ''));
    // El encabezado es el que trae el club: se toman todos sus contenedores y se
    // busca el que realmente tiene fondo (los de arriba son transparentes).
    const fondos = divs.filter(e => /Black Bars/.test(e.textContent)).map(rgb);
    return { barra: barra ? barra.style.background : '', fondos };
  });
  ok(/#C41E3A|rgb\(196, 30, 58\)/i.test(cols.barra), 'la barra del nombre toma el rojo de la paleta');
  ok(cols.fondos.includes('rgb(10, 22, 40)'), 'y el encabezado el azul (' + cols.fondos.join(' ') + ')');
  ok(!/const YL_NAVY='#0A1628', YL_RED='#C41E3A', YL_GOLD='#D4A843';/.test(src),
     'ya no quedan colores fijos en el código del marcador');

  console.log('\nLa paleta azul-rojo-blanco está disponible');
  ok(/bandera:\{/.test(src), 'existe la paleta');
  ok(/label:'YourLift Bandera'/.test(src), 'con su nombre en el panel');
  ok(/desc:'Azul · Rojo · Blanco'/.test(src), 'y dice de qué colores es');

  ok(errs.length === 0 && e2.length === 0,
     'sin errores de JavaScript' + ([...errs, ...e2].length ? ': ' + [...errs, ...e2].join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

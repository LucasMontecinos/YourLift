// Cómo sale el nombre del atleta en las pantallas, y de dónde saca sus colores el
// marcador.
//
// En el MARCADOR el apellido salía en MAYÚSCULAS y quedaba más marcado que el
// nombre ("Walter Humberto OLIVARES GUTIÉRREZ"). Se pidió como se escribe: todo del
// mismo tamaño y con la inicial en mayúscula. El color de la letra es el de siempre.
//
// En el PERFIL es al revés: el nombre iba en fina y el apellido en negrita y
// mayúsculas, y se leían como dos cosas distintas. Ahí van los dos iguales.
//
// Y los colores del marcador estaban fijos en el código: la paleta de Control TX no
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

const ATLETA = `{id:1,name:'WALTER HUMBERTO OLIVARES GUTIÉRREZ',lot:101,flight:'A',sex:'Hombre',
  cat:'93',div:'Junior',mod:'classic',bw:92,club:'Black Bars',country:'CHI',bombed:false,att:nueve()}`;
const MONTAR = modo => `(()=>{
  const nueve=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  DATA.phase='compete'; DATA.lift='sq'; DATA.round=0; DATA.flight='A';
  DATA.event={id:'x',name:'Regional Norte FECHIPO 2026'};
  const a=${ATLETA};
  a.att.sq[0]={w:120,r:null};
  DATA.athletes=[a];
  window._txSbShownAt=Date.now(); window._txSbSig=null;
  ${modo ? "window._SCREEN_STATE={mode:'" + modo + "',flights:null};" : ''}
  if(typeof renderTxWidget==='function')renderTxWidget();
})()`;

async function abrir(b, tx, colores, modo) {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 640 } });
  if (colores) await ctx.addInitScript(c => localStorage.setItem('fechipo_tx_colors', JSON.stringify(c)), colores);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=' + tx + '&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined', null, { timeout: 20000 });
  await p.evaluate(MONTAR(modo));
  await p.waitForTimeout(600);
  return { p, errs };
}

// El nodo que muestra el nombre, con su color y tipografía ya calculados.
const LEER = () => {
  const divs = [...document.querySelectorAll('div')];
  const n = divs.find(e => /Olivares/i.test(e.textContent) && e.children.length === 0);
  const c = divs.find(e => /^-?\d+kg/.test(e.textContent.trim()) && e.children.length === 0);
  const cs = e => e ? getComputedStyle(e) : null;
  return {
    nombre: n ? n.textContent.trim() : '',
    nombreColor: n ? cs(n).color : '',
    nombreSombra: n ? cs(n).textShadow : '',
    cat: c ? c.textContent.trim() : '',
    catColor: c ? cs(c).color : '',
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nMarcador: el nombre va como se escribe');
  const { p, errs } = await abrir(b, 'scoreboard', null, null);
  const r = await p.evaluate(LEER);
  ok(r.nombre === 'Walter Humberto Olivares Gutiérrez',
     'inicial en mayúscula y el resto en minúscula: "' + r.nombre + '"');
  ok(!/[A-ZÁÉÍÓÚÑ]{3}/.test(r.nombre), 'el apellido ya no va en mayúsculas');
  ok(r.cat === '-93kg JR', 'la categoría se lee: ' + r.cat);

  console.log('\n  Y con los colores de siempre');
  ok(r.nombreColor === 'rgb(10, 22, 40)', 'la letra vuelve al azul oscuro sobre la barra (' + r.nombreColor + ')');
  ok(r.catColor === 'rgb(212, 168, 67)', 'la categoría en dorado (' + r.catColor + ')');
  ok(r.nombreSombra === 'none', 'sin reborde negro');
  ok(!/_contorno/.test(src), 'no quedó código del reborde dando vueltas');

  console.log('\n  El color sale de la paleta, no está fijo en el código');
  const { p: p2, errs: e2 } = await abrir(b, 'scoreboard', BANDERA, null);
  const rb = await p2.evaluate(LEER);
  ok(rb.nombreColor === 'rgb(255, 255, 255)',
     'con la paleta Bandera la letra sale blanca (' + rb.nombreColor + ')');
  const cols = await p2.evaluate(() => {
    const divs = [...document.querySelectorAll('div')];
    const barra = divs.find(e => /linear-gradient/.test(e.style.background || ''));
    const fondos = divs.filter(e => /Black Bars/.test(e.textContent)).map(e => getComputedStyle(e).backgroundColor);
    return { barra: barra ? barra.style.background : '', fondos };
  });
  ok(/#C41E3A|rgb\(196, 30, 58\)/i.test(cols.barra), 'la barra del nombre toma el rojo de la paleta');
  ok(cols.fondos.includes('rgb(10, 22, 40)'), 'y el encabezado el azul');
  ok(!/const YL_NAVY='#0A1628', YL_RED='#C41E3A', YL_GOLD='#D4A843';/.test(src),
     'ya no quedan colores fijos en el código del marcador');

  console.log('\n  La paleta azul-rojo-blanco está disponible');
  ok(/label:'YourLift Bandera'/.test(src), 'aparece en el panel de Control TX');
  ok(/desc:'Azul · Rojo · Blanco'/.test(src), 'y dice de qué colores es');

  console.log('\nPerfil: nombre y apellido con la misma letra');
  const { p: p3, errs: e3 } = await abrir(b, 'screen', null, 'profile');
  const perf = await p3.evaluate(() => {
    // El más adentro: los contenedores de arriba traen también la bandera y el país.
    const d = [...document.querySelectorAll('div')]
      .filter(e => /OLIVARES/i.test(e.textContent))
      .sort((x, y) => x.textContent.length - y.textContent.length)[0];
    if (!d) return null;
    // Si quedara un <span> con otro peso, se ve acá.
    const hijos = [...d.querySelectorAll('span')].map(e => getComputedStyle(e).fontWeight);
    const cs = getComputedStyle(d);
    return { txt: d.textContent.trim(), peso: cs.fontWeight, size: cs.fontSize,
             fam: cs.fontFamily, pesosHijos: hijos };
  });
  ok(!!perf, 'se encuentra el nombre en la pantalla de perfil');
  ok(perf && perf.txt === 'WALTER HUMBERTO OLIVARES GUTIÉRREZ',
     'nombre y apellido, los dos en mayúsculas: "' + (perf && perf.txt) + '"');
  ok(perf && perf.pesosHijos.length === 0,
     'no queda ningún trozo con otro grosor de letra');
  ok(perf && perf.peso === '700', 'todo en negrita, como el apellido (' + (perf && perf.peso) + ')');
  ok(!/<span style="font-weight:400">\$\{firstName\}<\/span>/.test(src),
     'el nombre ya no se dibuja aparte y en fina');

  ok(errs.length === 0 && e2.length === 0 && e3.length === 0,
     'sin errores de JavaScript' + ([...errs, ...e2, ...e3].length ? ': ' + [...errs, ...e2, ...e3].join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

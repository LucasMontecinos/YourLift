// La paleta de colores de la transmisión, desde Control TX.
//
// Todas las pantallas que van al aire —scoreboard, perfil, tabla actual,
// leaderboard y ahora el medallero— sacan sus colores del MISMO lugar: la paleta
// elegida en Control TX. Eso permite cambiar el ambiente de todo el campeonato
// desde un botón, en vez de ir pantalla por pantalla.
//
// Lo que se agrega y se cuida acá:
//
//   · El tema "Sudamericano Chile": fondo azul marino YourLift, banda del nombre
//     en el azul de la bandera y el nombre en blanco. El acento va BLANCO y no
//     rojo a propósito — el rojo de la bandera se parece demasiado al rojo de NO
//     LIFT, y ese color tiene que significar una sola cosa en pantalla.
//
//   · El MEDALLERO, que era el único que tenía todos sus colores escritos a mano
//     y no le hacía caso a la paleta. Ahora la sigue como el resto.
//
//   · Pero el ORO, la PLATA y el BRONCE del medallero NO se tocan con el tema:
//     son el color de la medalla, no del ambiente. Un primer lugar plateado no
//     se entiende en ninguna paleta.
//
//   · Y el verde de válido y el rojo de nulo se quedan como están en TODOS los
//     temas: son señal de competencia, no decoración.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_paletatx.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Un podio completo: el medallero pide total, y el total pide los tres movimientos.
const MONTAR = `(() => {
  const g = w => [{w,r:'g'},{w:0,r:null},{w:0,r:null}];
  const mk = (id,name,pais,s,bp,dl) => ({id,name,lot:id,flight:'A',sex:'Hombre',sexo:'Hombre',
    cat:'-93',div:'Open',mod:'Powerlifting Classic',club:pais,country:pais,pais,bw:92,
    bombed:false,att:{sq:g(s),bp:g(bp),dl:g(dl)}});
  DATA.event={id:'e',name:'Sudamericano Chile 2026'};
  DATA.athletes=[mk(1,'Uno Chileno','CHI',250,150,250),
                 mk(2,'Dos Brasileno','BRA',240,140,240),
                 mk(3,'Tres Argentino','ARG',230,130,230)];
  DATA.phase='compete'; DATA.lift='sq'; DATA.round=0; DATA.flight='A';
})()`;

const MEDALLERO = `renderTxMedals({mod:'Powerlifting Classic',sex:'Hombre',div:'Open',cat:'-93',tipo:'total'})`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto(`http://localhost:${PUERTO}/livecast.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof _txC === 'function' && typeof renderTxMedals === 'function',
    null, { timeout: 25000 });

  console.log('\nEl tema del Sudamericano está entre los demás');
  {
    const r = await p.evaluate(() => {
      const t = _TX_COLOR_PALETTES.suda;
      return t ? { label: t.label, claves: Object.keys(t.colors).sort(),
                   otros: Object.keys(_TX_COLOR_PALETTES).length,
                   nameBg: t.colors.nameBg, nameText: t.colors.nameText,
                   accent: t.colors.accent, headerBg: t.colors.headerBg } : null;
    });
    ok(!!r, 'existe el tema');
    ok(r && r.label === 'Sudamericano Chile', 'se llama ' + ((r || {}).label || '—'));
    ok(r && r.otros === 8, 'y queda junto a los otros siete (' + ((r || {}).otros || 0) + ' en total)');
    // Lo que se pidió: el nombre en blanco, bien legible.
    ok(r && r.nameText === '#ffffff', 'el nombre va en blanco');
    ok(r && r.nameBg === '#0F3E9E', 'sobre el azul de la bandera');
    ok(r && r.headerBg === '#0A1628', 'y el fondo sigue siendo el azul marino de YourLift');
    // La decisión de diseño que importa defender.
    ok(r && r.accent === '#ffffff',
       'el acento es BLANCO, no rojo: el rojo queda reservado para NO LIFT');
  }

  console.log('\n  Ningún tema toca el verde de válido ni el rojo de nulo');
  {
    const r = await p.evaluate(() =>
      Object.entries(_TX_COLOR_PALETTES)
        .filter(([, t]) => t.colors.goodLift !== '#22c55e' || t.colors.noLift !== '#ef4444')
        .map(([k]) => k));
    ok(r.length === 0, 'los ocho temas mantienen la señal de competencia'
       + (r.length ? ' — se salen: ' + r.join(', ') : ''));
  }

  console.log('\n  El medallero sigue la paleta, como el resto de las pantallas');
  {
    const r = await p.evaluate(([montar, medallero]) => {
      eval(montar);
      const leer = () => {
        const h = eval(medallero);
        return {
          vacio: !h,
          fondo: (h.match(/linear-gradient\(90deg,([^)]*\))/) || [])[1],
          titulo: (h.match(/letter-spacing:3px;color:([^;"]+)/) || [])[1],
          medallas: [...new Set(h.match(/#D4A843|#C0C0C0|#CD7F32/gi) || [])].sort(),
        };
      };
      const hoy = leer();
      _txColorsLS = JSON.parse(JSON.stringify(_TX_COLOR_PALETTES.suda.colors));
      const suda = leer();
      _txColorsLS = {};
      return { hoy, suda };
    }, [MONTAR, MEDALLERO]);

    ok(!r.hoy.vacio && !r.suda.vacio, 'el medallero se dibuja');
    // Antes el título era dorado fijo y no le hacía caso a ningún tema.
    ok(r.hoy.titulo !== r.suda.titulo,
       'el título cambia con el tema: ' + r.hoy.titulo + ' → ' + r.suda.titulo);
    ok(r.suda.titulo === '#ffffff', 'y con el tema del Sudamericano queda blanco');
    ok(r.hoy.fondo !== r.suda.fondo, 'el fondo de las filas también cambia');
    // Lo que NO puede cambiar nunca.
    ok(r.hoy.medallas.join(',') === '#C0C0C0,#CD7F32,#D4A843'.split(',').sort().join(','),
       'están el oro, la plata y el bronce');
    ok(r.suda.medallas.join(',') === r.hoy.medallas.join(','),
       'y el tema NO se los cambia: un primer lugar plateado no se entiende');
  }

  await p.close();
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/\n  suda:\{/.test(lc), 'el tema vive junto a los otros, no aparte');
    // El medallero ya no puede tener el fondo escrito a mano.
    const i = lc.indexOf('function renderTxMedals');
    const f = lc.slice(i, i + 2500);
    ok(/_txC\('cardBg'\)/.test(f), 'el medallero pide su fondo a la paleta');
    ok(/_txC\('accent'\)/.test(f), 'y su título también');
    ok(!/rgba\(10,22,40,\.94\)/.test(f), 'sin el fondo fijo que tenía antes');
    // Y que se pueda tocar a mano desde Control TX.
    ok(/LEADERBOARD Y MEDALLERO/.test(lc), 'el editor de Control TX lo nombra');
    ok(/dirApplyPalette/.test(lc) && /dirSetColor/.test(lc),
       'con paletas rápidas y ajuste fino por color');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

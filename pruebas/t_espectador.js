// Lo que ve el espectador: elegir qué tanda mirar en Competencia en Vivo, y los
// resultados de TODAS las categorías en la pestaña de Resultados.
//
// Lo que pidieron los que la usaron: poder revisar otra tanda sin que la pantalla
// los devuelva de un salto en cuanto alguien carga un peso en la tanda que está
// compitiendo; y que Resultados muestre todas las categorías con su división, no
// solo las de la tanda que está en tarima.
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

  console.log('\nResultados: todas las categorías, de todas las tandas');
  // La pestaña de Resultados miraba solo la tanda en tarima. Una categoría se
  // reparte entre varias, así que nunca se veía completa.
  await p.evaluate(() => {
    // Marcas en las tres tandas para que todas clasifiquen.
    DATA.athletes.forEach(a => ['sq','bp','dl'].forEach((l, k) => {
      const base = [a.att.sq[0].w || 150, Math.round((a.att.sq[0].w || 150) * .6),
                    Math.round((a.att.sq[0].w || 150) * 1.15)][k];
      a.att[l][0] = { w: base, r: 'g' };
      a.att[l][1] = { w: base + 10, r: 'n' };
      a.att[l][2] = { w: base + 5, r: 'g' };
    }));
    DATA.flight = 'A';
    go('results');
  });
  await p.waitForTimeout(400);
  const res = await p.evaluate(() => {
    const t = document.querySelector('.main').innerText;
    return { texto: t, titulo: t.split('\n')[0],
             menu: [...document.querySelectorAll('.side-btn')].map(e => e.textContent.trim()) };
  });
  ok(res.titulo === 'RESULTADOS', 'el título ya no habla de una tanda: "' + res.titulo + '"');
  ok(!/VUELO/.test(res.texto), 'no queda la insignia del vuelo');
  ok(/todas las tandas/.test(res.texto), 'y dice que están todas');

  console.log('\n  Salen los atletas de las tres tandas');
  ['Juan Perez Soto', 'Marco Nunez Paz', 'Ana Rios Leiva'].forEach(n =>
    ok(res.texto.includes(n), n + ' (estaba en otra tanda que la de tarima)'));

  console.log('\n  Agrupadas por categoría CON su división');
  ok(/83 — Junior/.test(res.texto), 'hay un grupo "83 — Junior"');
  ok(/83 — Open/.test(res.texto), 'y otro "83 — Open", aparte');
  ok(/63 — Open/.test(res.texto), 'y "63 — Open" para las damas');
  ok(/93 — Open/.test(res.texto), 'y "93 — Open"');
  // Cada grupo numera desde 1: los cuatro de -83 no pueden ir del 1 al 4 seguidos.
  const jrIdx = res.texto.indexOf('83 — Junior'), opIdx = res.texto.indexOf('83 — Open');
  ok(jrIdx > 0 && opIdx > jrIdx, 'Junior va antes que Open dentro de la misma categoría');

  console.log('\n  Y no quedó la pestaña que se descartó');
  ok(!res.menu.some(x => /por categor/i.test(x)), 'no hay "Resultados por categoría" en el menú');

  console.log('\nLa posición virtual, con lo declarado');
  // Se arma una categoría que recién arranca (solo aperturas) y otra ya terminada.
  await p.evaluate(() => {
    const nueve = () => ({ sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                           bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                           dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}] });
    DATA.athletes = [
      // -93 Sub-Junior: nadie levantó, solo aperturas declaradas
      ['Aldrin Ticona Choque', 92.5, 140, 50, 130],
      ['Javier Pizarro Castillo', 92.0, 120, 40, 120],
      ['Renato Martinez Aguirre', 91.0, 0, 0, 0],
    ].map(([name, bw, sq, bp, dl], i) => {
      const a = { id:i+1, name, sex:'Hombre', cat:'93', div:'Sub-Junior', mod:'classic',
                  club:'Club', flight:'A', bw, lot:100+i, bombed:false, att:nueve() };
      if (sq) { a.att.sq[0]={w:sq,r:null}; a.att.bp[0]={w:bp,r:null}; a.att.dl[0]={w:dl,r:null}; }
      return a;
    });
    // -83 Open: los nueve intentos juzgados
    [[200,'Sebastian Cabrera',82.5],[190,'Michael Lecaros',82.1]].forEach(([base,name,bw],k)=>{
      const a = { id:10+k, name, sex:'Hombre', cat:'83', div:'Open', mod:'classic',
                  club:'Club', flight:'B', bw, lot:200+k, bombed:false, att:nueve() };
      ['sq','bp','dl'].forEach((l,j)=>{
        const w=[base,Math.round(base*.6),Math.round(base*1.2)][j];
        a.att[l][0]={w:w-10,r:'g'}; a.att[l][1]={w:w,r:'g'}; a.att[l][2]={w:w+10,r:'n'};
      });
      DATA.athletes.push(a);
    });
    go('results');
  });
  await p.waitForTimeout(400);
  const vr = await p.evaluate(() => ({
    texto: document.querySelector('.main').innerText,
    filas: [...document.querySelectorAll('.main tbody tr')]
      .map(tr => [...tr.children].map(td => td.innerText.trim()))
      .filter(f => f.length > 3).map(f => ({ pos: f[0], nombre: f[1].split('\n')[0] })),
  }));

  // Aldrin declara 140+50+130 = 320; Javier 120+40+120 = 280. Sin levantar nada,
  // la tabla ya los ordena: primero el de las aperturas más altas.
  const sj = vr.filas.filter(f => /Ticona|Pizarro|Renato/.test(f.nombre));
  ok(sj[0] && /Ticona/.test(sj[0].nombre), 'con solo las aperturas ya hay un 1°: ' + (sj[0]||{}).nombre);
  ok(sj[0] && sj[0].pos.startsWith('1'), 'y le pone el puesto: ' + (sj[0]||{}).pos);
  ok(sj[1] && /Pizarro/.test(sj[1].nombre), '2° el de las aperturas más bajas');
  ok(sj[2] && sj[2].pos === '—', 'el que no declaró nada queda sin puesto');
  ok(sj[0] && sj[0].pos.includes('~'), 'el puesto va marcado como virtual (~)');
  ok(/POSICIÓN VIRTUAL/.test(vr.texto), 'y la categoría lo dice en su encabezado');

  console.log('\n  Y cuando la categoría termina, el puesto queda firme');
  const op = vr.filas.filter(f => /Cabrera|Lecaros/.test(f.nombre));
  ok(op[0] && /Cabrera/.test(op[0].nombre) && op[0].pos === '1', 'sale 1° sin el ~: "' + (op[0]||{}).pos + '"');
  ok(op[1] && op[1].pos === '2', 'y 2° el otro');
  ok(/POSICIÓN FINAL/.test(vr.texto), 'la categoría cerrada se marca como final');

  console.log('\nLas dos columnas de total: virtual y real');
  await p.evaluate(() => {
    const nueve = () => ({ sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                           bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                           dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}] });
    const mk = (id, name, bw) => ({ id, name, sex:'Hombre', cat:'83', div:'Open',
      mod:'classic', club:'Club', flight:'A', bw, lot:100+id, bombed:false, att:nueve() });
    // Sentadilla terminada (mejor válido 65) y banca y peso muerto solo declarados.
    const a = mk(1, 'Con sentadilla lista', 82.0);
    a.att.sq[0]={w:60,r:'g'}; a.att.sq[1]={w:65,r:'g'}; a.att.sq[2]={w:70,r:'n'};
    a.att.bp[0]={w:50,r:null}; a.att.dl[0]={w:90,r:null};
    // Sin levantar nada: las tres aperturas.
    const b2 = mk(2, 'Solo aperturas', 82.5);
    b2.att.sq[0]={w:70,r:null}; b2.att.bp[0]={w:45,r:null}; b2.att.dl[0]={w:95,r:null};
    // Los nueve intentos juzgados.
    const c = mk(3, 'Terminado', 81.5);
    ['sq','bp','dl'].forEach((l,j)=>{ const w=[80,55,100][j];
      c.att[l][0]={w:w-5,r:'g'}; c.att[l][1]={w:w,r:'g'}; c.att[l][2]={w:w+5,r:'n'}; });
    DATA.athletes = [a, b2, c];
    go('results');
  });
  await p.waitForTimeout(400);
  const tot = await p.evaluate(() => {
    const th = [...document.querySelectorAll('.main thead th')].map(e => e.innerText.trim());
    const iV = th.indexOf('Virtual'), iT = th.indexOf('Total');
    const filas = [...document.querySelectorAll('.main tbody tr')]
      .map(tr => [...tr.children].map(td => td.innerText.trim())).filter(f => f.length > 5);
    return { th, filas: filas.map(f => ({ nombre: f[1].split('\n')[0], virtual: f[iV], total: f[iT] })) };
  });
  const at = n => tot.filas.find(f => f.nombre === n) || {};

  ok(tot.th.includes('Virtual') && tot.th.includes('Total'), 'están las dos columnas');
  ok(tot.th.indexOf('Virtual') < tot.th.indexOf('Total'), 'el virtual va antes del total');

  // 65 de sentadilla ya válidos + 50 de banca declarados + 90 de peso muerto declarados.
  ok(at('Con sentadilla lista').virtual === '205',
     'suma lo válido con lo declarado: ' + at('Con sentadilla lista').virtual);
  ok(at('Con sentadilla lista').total === '—',
     'y el total real queda vacío hasta que valide los tres movimientos');

  ok(at('Solo aperturas').virtual === '210', 'con solo aperturas, el virtual es su suma: 70+45+95');
  ok(at('Solo aperturas').total === '—', 'sin total real todavía');

  ok(at('Terminado').virtual === '235' && at('Terminado').total === '235',
     'con los nueve intentos juzgados, virtual y total coinciden');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

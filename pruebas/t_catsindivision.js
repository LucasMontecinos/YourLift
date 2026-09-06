// Una categoría que no existe en una división no es un récord vacío.
//
// El sistema mide a cada atleta contra el récord de SU división y contra el
// Open, porque una subjunior que levanta más que el récord Open se lleva los
// dos. Pero no todas las categorías se compiten en todas las divisiones: la -43
// de mujeres y la -53 de hombres existen solo en Sub-Junior y Junior — el Open
// arranca en -47 y en -59.
//
// Al buscar el récord Open de una -43, no había ninguno, y eso se leía como
// "categoría sin récord cargado": cualquier peso lo rompía. En la planilla del
// Sudamericano a González Morena (-43) y a Peralta (-53) les salían los nueve
// intentos marcados como RÉCORD, y a nadie le sirve una planilla donde todo
// brilla.
//
// Cuáles categorías existen en cada división se lee de la propia tabla de
// récords, no de una lista escrita en el código: si FESUPO cambia las
// categorías, cambia el archivo y esto lo sigue.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_catsindivision.js
const { chromium } = require('playwright');
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const recs = JSON.parse(fs.readFileSync(__dirname + '/../records_suda.json', 'utf8')).records;
  const clases = new Set(Object.keys(recs).map(k => k.split('|').slice(0, 4).join('|')));

  console.log('\nLa tabla de récords es la que manda');
  ok(clases.has('F|classic|Sub-Junior|-43'), 'la -43 de mujeres existe en Sub-Junior');
  ok(clases.has('F|classic|Junior|-43'), 'y en Junior');
  ok(!clases.has('F|classic|Open|-43'), 'pero NO en Open — por eso salía vacía');
  ok(clases.has('M|classic|Sub-Junior|-53'), 'la -53 de hombres existe en Sub-Junior');
  ok(!clases.has('M|classic|Open|-53'), 'y tampoco en Open');
  ok(clases.has('F|classic|Open|-47') && clases.has('M|classic|Open|-59'),
     'el Open arranca en -47 y en -59');

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full',
               { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.RECSUDA && typeof DATA !== 'undefined'
                                && DATA.athletes && DATA.athletes.length, null, { timeout: 20000 });

  const r = await p.evaluate(() => {
    isAdmin = true;
    pickEvent(DATA.events.findIndex(e => e.id === 'suda2026_fesupo_full'));
    const arma = (sex, div, cat, mod) => ({
      id: 'x', name: 'Prueba', sex, div, cat, mod: mod || 'classic',
      att: { sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
             bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
             dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] } });
    window._SR_HOY = {};   // nadie ha levantado nada todavía hoy
    const mide = a => ({ divs: _srDivs(a), recs: _srRecords(a, 'sq').map(x => x.div + ':' + x.kg),
                         rompe20: _srRompe(a, 'sq', 20), rompe500: _srRompe(a, 'sq', 500) });
    return {
      sj43:  mide(arma('Mujer', 'Sub-Junior', '-43 kg (Mujer)')),
      jr43:  mide(arma('Mujer', 'Junior', '-43 kg (Mujer)')),
      sj53:  mide(arma('Hombre', 'Sub-Junior', '-53 kg (Hombre)')),
      sj47:  mide(arma('Mujer', 'Sub-Junior', '-47 kg (Mujer)')),
      op47:  mide(arma('Mujer', 'Open', '-47 kg (Mujer)')),
      m1_47: mide(arma('Mujer', 'Master I', '-47 kg (Mujer)')),
    };
  });
  await b.close();

  console.log('\n  La -43 no se mide contra un Open que no existe');
  {
    ok(r.sj43.divs.join(',') === 'Sub-Junior',
       'una subjunior de -43 compite solo contra Sub-Junior (' + r.sj43.divs.join(', ') + ')');
    ok(r.jr43.divs.join(',') === 'Junior', 'y una junior de -43, solo contra Junior');
    ok(r.sj53.divs.join(',') === 'Sub-Junior', 'lo mismo un subjunior de -53');
    // Lo que se veía en pantalla: 20 kg marcados como récord sudamericano.
    ok(r.sj43.rompe20.length === 0,
       'un intento de 20 kg ya no sale como récord' +
       (r.sj43.rompe20.length ? ' — todavía rompe ' + r.sj43.rompe20.map(x => x.div) : ''));
    ok(r.sj53.rompe20.length === 0, 'ni en la -53');
    ok(r.sj43.recs.every(x => !/:0$/.test(x)),
       'y ninguno de sus récords queda en 0: ' + r.sj43.recs.join(' · '));
  }

  console.log('\n  Pero el récord de verdad se sigue marcando');
  {
    ok(r.sj43.rompe500.length === 1, 'un peso enorme en -43 sí rompe su Sub-Junior');
    ok(r.sj53.rompe500.length === 1, 'y el de -53 su Sub-Junior');
  }

  console.log('\n  Las categorías que sí existen en Open no se tocan');
  {
    ok(r.sj47.divs.join(',') === 'Sub-Junior,Open',
       'una subjunior de -47 se sigue midiendo contra Sub-Junior y Open ('
       + r.sj47.divs.join(', ') + ')');
    ok(r.sj47.rompe500.length === 2, 'y un peso enorme le rompe los dos');
    ok(r.op47.divs.join(',') === 'Open', 'una Open de -47 compite contra Open');
    ok(r.m1_47.divs.join(',') === 'Master I,Open',
       'y una Master I de -47 contra Master I y Open (' + r.m1_47.divs.join(', ') + ')');
    ok(r.sj47.recs.every(x => !/:0$/.test(x)),
       'todos con un récord cargado: ' + r.sj47.recs.join(' · '));
  }

  console.log('\n  Queda escrito de dónde salen las categorías');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/function _srClases\(\)/.test(lc) && /Object\.keys\(RECSUDA/.test(lc),
       'se leen del archivo de récords, no de una lista escrita a mano');
    ok(/_SR_CLASES=null/.test(lc.slice(lc.indexOf('RECSUDA=d.records'))),
       'y se vuelven a leer cuando llega una tabla nueva');
    ok(/return hay\.length\?hay:out/.test(lc),
       'si la tabla no conoce ninguna división del atleta, no se le callan los récords');
  }

  ok(errs.length === 0, 'sin errores en la página' + (errs.length ? ': ' + errs.slice(0, 2) : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

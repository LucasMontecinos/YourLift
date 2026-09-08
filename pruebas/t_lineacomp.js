// Contra quién se compara cada atleta en las pantallas de posiciones.
//
// El sexo, la categoría de peso y la división NO alcanzan para saber contra
// quién compite alguien. Un EQUIPADO no compite contra un CLASSIC: sale con más
// kilos porque lleva traje, no porque levante más. Y el ONLY BENCH es otra
// competencia distinta de la del total.
//
// Esto salió de una competencia real: en el Control TX, un -93 Junior EQUIPADO
// aparecía en la Tabla Actual y en el Leaderboard mezclado con los -93 Junior
// classic, y su posición se calculaba contra ellos.
//
// El caso enredado que también se cuida acá: 'equipped_bench' le toca tanto al
// combinado equipado (compite por el total Y en banca) como al Only Bench
// Equipado puro (solo banca). Lo que los separa es la bandera plusBench, no el
// código de modalidad.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_lineacomp.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Todos -93, Junior, hombres: lo único que los diferencia es la modalidad.
const MONTAR = `(() => {
  const at = w => ({ sq:[{w,r:'g'},{w:0,r:null},{w:0,r:null}],
                     bp:[{w:w*0.6,r:'g'},{w:0,r:null},{w:0,r:null}],
                     dl:[{w:w*1.1,r:'g'},{w:0,r:null},{w:0,r:null}] });
  const mk = (id,nom,w,mod,plusBench) => ({ id, name:nom, lot:100+id, flight:'A',
    sex:'Hombre', sexo:'Hombre', cat:'93', div:'Junior', mod, plusBench:!!plusBench,
    club:'Chile', country:'CHI', bw:92, bombed:false, att:at(w),
    jornada:'D1 20/09 · 09:00 · S' });
  DATA.event = { id:'x', name:'Prueba' };
  DATA.athletes = [
    mk(1,'Classic Uno',   200,'classic'),
    mk(2,'Classic Dos',   190,'classic'),
    mk(3,'Equipado Uno',  260,'equipped'),
    mk(4,'Equipado Dos',  250,'equipped'),
    mk(5,'Banca Sola',    180,'onlybench'),
    mk(6,'Combinado Eq',  255,'equipped_bench',true),
  ];
  DATA.phase='compete'; DATA.lift='dl'; DATA.round=1; DATA.flight='A';
})()`;

const NOMBRES = t => ['Classic Uno','Classic Dos','Equipado Uno','Equipado Dos','Banca Sola','Combinado Eq']
  .filter(n => t.includes(n));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/livecast.html?tx=tablaactual&evento=suda2026_fesupo_full`,
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
    null, { timeout: 25000 });
  await p.evaluate(MONTAR);

  const dibuja = (fn, quien) => p.evaluate(([f, q]) => {
    const a = DATA.athletes.find(x => x.name === q);
    DATA.forcedCurrent = a.id;
    const d = document.createElement('div');
    d.innerHTML = (f === 'tabla') ? renderTxTablaActual(a) : renderTxLeaderboard(a, false, {});
    return (d.textContent || '').replace(/\s+/g, ' ');
  }, [fn, quien]);

  console.log('\nLa Tabla Actual compara contra la misma línea');
  {
    const t = await dibuja('tabla', 'Equipado Uno');
    const v = NOMBRES(t);
    ok(v.includes('Equipado Uno') && v.includes('Equipado Dos'), 'el equipado ve a los equipados');
    ok(!v.includes('Classic Uno') && !v.includes('Classic Dos'), 'y NO a los classic');
    ok(!v.includes('Banca Sola'), 'ni al de banca sola');
    ok(v.includes('Combinado Eq'), 'pero sí al combinado equipado, que compite por el total');
    ok(/EQUIPADO/i.test(t), 'y el encabezado dice de qué línea es');
  }
  {
    const t = await dibuja('tabla', 'Classic Uno');
    const v = NOMBRES(t);
    ok(v.includes('Classic Uno') && v.includes('Classic Dos') && v.length === 2,
       'y el classic ve solo a los classic');
  }
  {
    const t = await dibuja('tabla', 'Banca Sola');
    const v = NOMBRES(t);
    ok(v.length === 1 && v[0] === 'Banca Sola', 'el only bench no se mezcla con los del total');
    ok(/ONLY BENCH/i.test(t), 'y se dice en el encabezado');
  }

  console.log('\n  El Leaderboard hace lo mismo');
  {
    const t = await dibuja('lb', 'Equipado Uno');
    const v = NOMBRES(t);
    ok(!v.includes('Classic Uno') && v.includes('Equipado Dos'),
       'el equipado no aparece rankeado contra los classic');
    ok(/EQUIPADO/i.test(t), 'y el encabezado lo dice');
  }

  console.log('\n  La posición sale de la comparación correcta');
  {
    // Mezclados, el equipado (que levanta más por el traje) sería 1º de todos.
    // Separado, es 1º entre equipados — que es su puesto de verdad.
    const r = await p.evaluate(() => {
      const eq = DATA.athletes.find(a => a.name === 'Equipado Uno');
      const cl = DATA.athletes.find(a => a.name === 'Classic Uno');
      return { mismos: _lineaComp(eq) === _lineaComp(cl),
               eq: _lineaComp(eq), cl: _lineaComp(cl),
               bench: _lineaComp(DATA.athletes.find(a => a.name === 'Banca Sola')),
               comb: _lineaComp(DATA.athletes.find(a => a.name === 'Combinado Eq')) };
    });
    ok(!r.mismos, 'equipado y classic no caen en el mismo grupo (' + r.eq + ' ≠ ' + r.cl + ')');
    ok(r.comb === r.eq, 'el combinado equipado sí cae con los equipados');
    ok(r.bench !== r.eq && r.bench !== r.cl, 'y la banca sola en el suyo (' + r.bench + ')');
  }

  console.log('\n  Queda escrito en el código');
  {
    const src = await (await fetch(`http://localhost:${PUERTO}/livecast.html`)).text();
    ok(/_catGroupKey\(a\)\{[^}]*_lineaComp\(a\)/.test(src),
       'la llave de agrupación incluye la línea competitiva');
  }
  ok(!errs.length, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

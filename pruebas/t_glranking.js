// El GL Points del ranking se calcula, no se hereda.
//
// Los GL Points de la IPF tienen cuatro juegos de coeficientes —powerlifting
// clásico, powerlifting equipado, banca clásica y banca equipada— y otro par para
// cada sexo. El mismo levantamiento vale distinto según en qué campeonato se hizo,
// así que no existe UN número que sea "el GL" de un atleta: existe el GL de esa
// marca en esa modalidad.
//
// El ranking no respetaba eso. Traía el número guardado en cada fila, y esos
// números venían de cualquier parte: unos eran el bestLifts.glp del padrón —el GL
// de powerlifting de la persona— puesto tal cual en la tabla de banca; otros eran
// restos de cálculos anteriores a que se separaran las modalidades. De 205 filas,
// 50 estaban malas. Las 25 de banca clásica, todas. Los equipados, todos: a un
// levantador de banca equipada se le mostraba 33 donde le corresponden 59.
//
// Y no es un adorno: el GL es el desempate del ranking y con lo que se compara a
// gente de categorías distintas.
//
// Ahora el número sale de la propia fila —peso corporal, total y la tabla, que
// dice sexo y modalidad sin ambigüedad—, así que no puede quedar viejo.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_glranking.js
const fs = require('fs');
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// La fórmula oficial, escrita acá aparte: si la prueba llamara a la función de la
// página, comprobaría que la página se parece a sí misma y nada más.
const COEF = {
  cl_m:      [1199.72839, 1025.18162, 0.00921], cl_f:      [610.32796, 1045.59282, 0.03048],
  uni_m:     [1199.72839, 1025.18162, 0.00921], uni_f:     [610.32796, 1045.59282, 0.03048],
  oe_m:      [1199.72839, 1025.18162, 0.00921], oe_f:      [610.32796, 1045.59282, 0.03048],
  eq_m:      [1236.25115, 1449.21864, 0.01644], eq_f:      [758.63878, 949.31382, 0.02435],
  bench_cl_m:[320.98041,  281.40258,  0.01008], bench_cl_f:[142.40398, 442.52671, 0.04724],
  bench_eq_m:[381.22073,  733.79378,  0.02398], bench_eq_f:[221.82209, 357.00377, 0.02937],
};
const glEsperado = (tab, bw, total) => {
  const c = COEF[tab];
  if (!c || !(bw > 0) || !(total > 0)) return null;
  const d = c[0] - c[1] * Math.exp(-c[2] * bw);
  return d > 0 ? Math.round(total * 100 / d * 100) / 100 : null;
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  // Sin service worker: se mete a medio cargar y deja la página colgada.
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/ranking.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => Array.isArray(window.D) && typeof glDeFila === 'function',
    null, { timeout: 20000 });

  const D = await p.evaluate(() => D.map(e => ({ n: e.n, tab: e.tab, bw: e.bw, tt: e.tt, dt: e.dt })));
  ok(D.length > 100, `el ranking trae ${D.length} filas`);

  console.log('\nCada fila lleva el GL de SU modalidad');
  {
    const malas = [], sinCoef = [];
    for (const e of D) {
      const esp = glEsperado(e.tab, e.bw, e.tt);
      if (esp === null) { if (e.tt > 0 && e.bw > 0) sinCoef.push(e); continue; }
      if (Math.abs(esp - (e.dt || 0)) >= 0.06) malas.push({ e, esp });
    }
    ok(malas.length === 0, malas.length === 0
      ? 'las ' + D.filter(e => e.tt > 0 && e.bw > 0).length + ' filas con marca válida calzan con la fórmula'
      : malas.length + ' no calzan, p.ej. ' + malas[0].e.n + ' (' + malas[0].e.tab + '): '
        + malas[0].e.dt + ' en vez de ' + malas[0].esp);
    ok(sinCoef.length === 0, sinCoef.length === 0
      ? 'y no hay ninguna tabla sin coeficientes asignados'
      : 'tabla sin coeficientes: ' + sinCoef[0].tab);
  }

  console.log('\n  El equipado no se mide con la tabla del clásico');
  {
    // Es el error que más caro sale: los coeficientes de equipado dan un número
    // bastante más bajo que los de clásico para el mismo total, así que usar los
    // que no son deja al equipado peleando en desventaja o en ventaja según el
    // caso, sin que se note a simple vista.
    const eq = D.filter(e => (e.tab === 'eq_m' || e.tab === 'eq_f') && e.tt > 0 && e.bw > 0);
    ok(eq.length > 0, 'hay equipados en el ranking (' + eq.length + ')');
    const conClasico = eq.filter(e => {
      const clas = glEsperado(e.tab === 'eq_m' ? 'cl_m' : 'cl_f', e.bw, e.tt);
      return clas !== null && Math.abs(clas - (e.dt || 0)) < 0.06;
    });
    ok(conClasico.length === 0, conClasico.length === 0
      ? 'ninguno lleva el GL de powerlifting clásico'
      : conClasico[0].n + ' lleva el de clásico');
    const bench = D.filter(e => (e.tab === 'bench_eq_m' || e.tab === 'bench_eq_f') && e.tt > 0 && e.bw > 0);
    ok(bench.length > 0, 'hay banca equipada (' + bench.length + ')');
    const conPL = bench.filter(e => {
      const pl = glEsperado(e.tab === 'bench_eq_m' ? 'eq_m' : 'eq_f', e.bw, e.tt);
      return pl !== null && Math.abs(pl - (e.dt || 0)) < 0.06;
    });
    ok(conPL.length === 0, conPL.length === 0
      ? 'y ninguno lleva el de powerlifting equipado sobre su banca sola'
      : conPL[0].n + ' lleva el de powerlifting');
  }

  console.log('\n  Y la banca no lleva el GL de powerlifting de la persona');
  {
    // Éste era el caso más frecuente: el bestLifts.glp del padrón es el GL de
    // powerlifting del atleta, y se estaba mostrando en la tabla de banca.
    const bench = D.filter(e => e.tab.indexOf('bench') === 0 && e.tt > 0 && e.bw > 0);
    ok(bench.length > 0, 'hay filas de banca (' + bench.length + ')');
    // El GL de banca de alguien nunca puede salir de un total de tres movimientos:
    // se comprueba que el número guardado corresponda a SU banca, no a otra marca.
    const raras = bench.filter(e => Math.abs(glEsperado(e.tab, e.bw, e.tt) - e.dt) >= 0.06);
    ok(raras.length === 0, raras.length === 0
      ? 'todas salen de su propia banca'
      : raras[0].n + ' no');
  }

  console.log('\n  Una marca sin total no inventa un GL');
  {
    const bomba = D.filter(e => !(e.tt > 0));
    ok(bomba.every(e => !e.dt), bomba.length + ' fila(s) sin total válido, todas con GL en cero');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const rk = fs.readFileSync(__dirname + '/../ranking.html', 'utf8');
    ok(/var GL_COEFS=/.test(rk), 'los cuatro juegos de coeficientes están en el ranking');
    ok(/ple_m:|ple_f:/.test(rk), 'incluidos los de equipado');
    ok(/boe_m:|boe_f:/.test(rk), 'y los de banca equipada');
    ok(/D\.forEach\(glNormalizar\)/.test(rk), 'y se recalcula toda la tabla al cargar');
    ok(/liveEntries\.push\(glNormalizar\(/.test(rk),
       'también lo que llega en vivo desde el livecast');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

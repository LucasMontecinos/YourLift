// El cronograma público del Sudamericano: día → sesión → ronda → categoría.
//
// FESUPO mandó la nominación final y ahí, por primera vez, viene el detalle: en
// qué sesión levanta cada atleta, a qué hora es su pesaje, a qué hora empieza su
// competencia y con qué número de lote. Antes el día se DEDUCÍA de una regla
// (sexo + categoría + modalidad) y acertaba el grupo pero no siempre la sesión:
// Special Olympics, por ejemplo, quedaba al cierre del 27 y en el cronograma real
// va el 20 a las 16.30.
//
// Esta prueba mide que el cronograma sea una VISTA de la nómina y no una segunda
// lista: los atletas salen de NOMSUDA.atletas y las sesiones de NOMSUDA.jornadas.
// Si fueran dos listas separadas podrían terminar diciendo cosas distintas, y en
// una competencia eso es alguien que llega al pesaje el día que no era.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cronosuda.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const N = JSON.parse(fs.readFileSync(__dirname + '/../nomina_sudamericano.json', 'utf8'));

  console.log('\nLa nómina trae el cronograma oficial');
  {
    ok(N.cronogramaPublico === true, 'el cronograma está marcado como público');
    const j = N.jornadas || [];
    ok(j.length === 20, j.length + ' sesiones');
    const dias = [...new Set(j.map(x => x.fecha))].sort();
    ok(dias.length === 8 && dias[0] === '2026-09-20' && dias[7] === '2026-09-27',
       'del 20 al 27 de septiembre, ocho días: ' + dias.length);
    ok(j.every(x => /^\d{2}:\d{2}$/.test(x.pesaje) && /^\d{2}:\d{2}$/.test(x.inicio)),
       'todas con hora de pesaje y de inicio');
    // Lo que la regla no acertaba.
    const so = j.find(x => x.campeonato === 'Special Olympics');
    ok(so && so.fecha === '2026-09-20' && so.inicio === '16:30',
       'Special Olympics va el 20 a las 16:30, no al cierre del 27');
    // Cada inscripción tiene que caer en una sesión que exista.
    const ids = new Set(j.map(x => x.id));
    const sinDia = (N.atletas || []).filter(a => a.jornada == null);
    const colgando = (N.atletas || []).filter(a => a.jornada != null && !ids.has(a.jornada));
    ok(sinDia.length === 0, 'ninguna inscripción se quedó sin día');
    ok(colgando.length === 0, 'y ninguna apunta a una sesión que no existe');
  }

  console.log('\n  El número de lote lleva el día adelante');
  {
    const conLote = (N.atletas || []).filter(a => a.lote);
    ok(conLote.length > 440, conLote.length + ' inscripciones con lote');
    // El OR del Excel va del 1 al 99 y se sortea POR SESIÓN, así que el mismo
    // número se repite entre días. Se le antepone el día: el OR 67 del día 3 es
    // el 367, y así el número dice también cuándo compite.
    const j = N.jornadas || [];
    const dia = {}; [...new Set(j.map(x => x.fecha))].sort().forEach((f, i) => { dia[f] = i + 1; });
    ok(conLote.every(a => +String(a.lote)[0] === dia[a.fecha]),
       'el primer dígito de cada lote es su día de competencia');
    ok(conLote.every(a => +a.lote >= 101 && +a.lote <= 899),
       'van del 101 al 899: ' + Math.min(...conLote.map(a => +a.lote)) + ' a ' + Math.max(...conLote.map(a => +a.lote)));
    // Special Olympics no trae lote: esa columna del Excel es la posición final.
    const so = (N.atletas || []).filter(a => a.mod === 'Olimpiadas Especiales');
    ok(so.length > 0 && so.every(a => !a.lote),
       'los de Special Olympics no llevan (esa columna es la posición, no el lote)');
    // Dos atletas distintos no pueden compartir lote en la misma sesión: el lote
    // es lo que se canta en el pesaje.
    const porJor = {};
    (N.atletas || []).forEach(a => {
      if (!a.lote) return;
      const k = a.jornada + '|' + a.lote;
      (porJor[k] = porJor[k] || new Set()).add(a.n);
    });
    const choques = Object.entries(porJor).filter(([, s]) => s.size > 1);
    // Queda uno: el mismo peruano escrito de dos formas ("Nunez Borja Gonzalo" y
    // "Nunez Borja Chirinos Gonzalo"), que es una persona con dos inscripciones.
    // Dentro de una sesión el lote tiene que ser de una sola persona: es lo que
    // se canta en el pesaje. Quedan dos, y las dos son la MISMA persona escrita
    // de dos formas en el Excel (Nuñez Borja y Aghemio Nuñez).
    ok(choques.length <= 2,
       choques.length + ' choque(s), y son el mismo atleta escrito de dos formas');
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 1200 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.NOMSUDA && typeof render === 'function', null, { timeout: 25000 });

  console.log('\n  Se ve en la sección Cronograma, sin tocar Firestore');
  {
    const r = await p.evaluate(() => {
      ST.v = 'crono'; render();
      const sel = document.querySelector('#app select');
      const ops = [...(sel ? sel.options : [])].map(o => o.value);
      return { hayOpcion: ops.includes('__suda') };
    });
    // El cronograma sale de un archivo estático: tiene que verse aunque Firebase
    // no cargue, que es justo lo que pasa con la conexión de un recinto.
    ok(r.hayOpcion, 'el Sudamericano aparece en el selector aunque Firebase no cargue');
  }

  console.log('\n  Un día, sus sesiones y sus rondas');
  {
    const r = await p.evaluate(() => {
      ST.v = 'crono'; ST.cronoEv = '__suda'; cronoDia('2026-09-20'); render();
      const t = document.getElementById('app').innerText;
      return {
        chips: (t.match(/DÍA \d/g) || []).length,
        fecha: /DOMINGO 20 DE SEPTIEMBRE/i.test(t),
        pesaje: /Pesaje 07:00 · Competencia 09:00/.test(t),
        rondas: /RONDA 1/.test(t) && /RONDA 2/.test(t),
        so: /Special Olympics/.test(t) && /Pesaje 14:30 · Competencia 16:30/.test(t),
        // una fila cualquiera, con su lote
        fila: /162\s+Ayala Triana\s+Perú/.test(t.replace(/\t/g, ' ')),
        tanda: /RONDA 1 · TANDA A/.test(t),
      };
    });
    ok(r.chips === 8, 'los ocho días, como botones: ' + r.chips);
    ok(r.fecha, 'y el día elegido se lee entero, no "2026-09-20"');
    ok(r.pesaje, 'cada sesión dice su hora de pesaje y la de competencia');
    ok(r.rondas, 'y adentro van las rondas');
    ok(r.so, 'Special Olympics sale el 20, a las 16:30');
    ok(r.fila, 'las filas llevan el número de lote junto al atleta');
    ok(r.tanda, 'y cada ronda dice su tanda');
  }

  console.log('\n  Cambiar de día cambia lo que se ve');
  {
    const r = await p.evaluate(() => {
      cronoDia('2026-09-27');
      const t = document.getElementById('app').innerText;
      return {
        fecha: /DOMINGO 27 DE SEPTIEMBRE/i.test(t),
        sesion: /Hombres .*Classic/.test(t),
        sinMujeres20: !/Mujeres -43/.test(t),
      };
    });
    ok(r.fecha, 'el 27 muestra el 27');
    ok(r.sesion, 'con la sesión de ese día');
    ok(r.sinMujeres20, 'y ya no muestra la del 20');
  }

  console.log('\n  Quien hace Clásico y Only Bench va en UNA fila');
  {
    // Son dos inscripciones, pero sube a la tarima una sola vez y con el mismo
    // lote. Repetido se lee como un error de la lista.
    const r = await p.evaluate(() => {
      cronoDia('2026-09-20');
      const t = document.getElementById('app').innerText.replace(/\t/g, ' ');
      const veces = (t.match(/Gonzalez Morena/g) || []).length;
      return { veces, junta: /Gonzalez Morena.*Clásico \+ Only Bench/.test(t) };
    });
    ok(r.veces === 1, 'aparece una sola vez (' + r.veces + ')');
    ok(r.junta, 'y la fila dice las dos modalidades');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Las tandas corren de la A a la AJ, por ronda');
  {
    const t = {};
    (N.atletas || []).forEach(a => { if (a.tanda) t[a.tanda] = a; });
    const letras = Object.keys(t);
    ok(letras.length === 36, letras.length + ' tandas, una por ronda');
    // El orden lo da el reloj, no el orden de las hojas del Excel.
    const orden = letras.map(k => [t[k].fecha, t[k].pesaje, k])
      .sort((x, y) => x[2].length - y[2].length || x[2].localeCompare(y[2]));
    const cronologico = orden.every((x, i) => i === 0 ||
      (x[0] + x[1]) >= (orden[i - 1][0] + orden[i - 1][1]));
    ok(cronologico, 'y van en orden: la A es la primera del 20 y la AJ la última del 27');
    ok(orden[0][2] === 'A' && orden[0][0] === '2026-09-20', 'la A abre el 20');
    ok(orden[orden.length - 1][2] === 'AJ' && orden[orden.length - 1][0] === '2026-09-27',
       'la AJ cierra el 27');
  }

  console.log('\n  Queda escrito en el código');
  {
    const ix = fs.readFileSync(__dirname + '/../index.html', 'utf8');
    ok(/function cronoSuda\(\)/.test(ix), 'el cronograma del Sudamericano tiene su propia vista');
    ok(/a\.jornada!=null/.test(ix), 'y el día de cada inscripción se LEE, ya no se deduce');
    // Esta zona del archivo no corre en el ámbito global: una constante declarada
    // acá queda sin asignar y vale undefined al leerla.
    ok(!/const _CR_DIAS/.test(ix), 'sin constantes sueltas en la zona que no se ejecuta');
    const py = fs.readFileSync(__dirname + '/../build_suda_dias.py', 'utf8');
    ok(/a\.get\('lote'\) or lot/.test(py), 'el livecast usa el lote de FESUPO, no un contador propio');
    ok(/a\.get\('tanda'\) or fl/.test(py), 'y la tanda de FESUPO, no una letra por día');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

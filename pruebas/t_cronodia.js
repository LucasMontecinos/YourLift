// El cronograma público tiene que decir el día y correr en orden: primero todas
// las tandas del sábado, después las del domingo.
//
// Dos problemas: el cronograma de yourlift.cl ignoraba el campo Día — no lo mostraba
// ni lo usaba para ordenar, así que las tandas del domingo se mezclaban con las del
// sábado. Y el orden de días, cuando está escrito con el nombre suelto ("sábado",
// "domingo"), salía alfabético: domingo antes que sábado, al revés de como se corre.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cronodia.js
const fs = require('fs');
const { chromium } = require('playwright');
const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
const pub = fs.readFileSync(__dirname + '/../cronograma.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// El comparador está dentro de render() en index.html: se corta del archivo.
const ini = idx.indexOf('const _DIAS_SEMANA=');
const fin = idx.indexOf('function cronoRender(');
const { _cronoCmpDia } = eval('(function(){' + idx.slice(ini, fin) + '\nreturn {_cronoCmpDia};})()');
const ordenar = ds => ds.slice().sort(_cronoCmpDia);

// Un Regional Norte: A B C D E el sábado, F G el domingo.
const FILAS = [];
[['A', 'Sábado'], ['B', 'Sábado'], ['C', 'Sábado'], ['D', 'Sábado'], ['E', 'Sábado'],
 ['F', 'Domingo'], ['G', 'Domingo']].forEach(([fl, dia], k) => {
  for (let i = 0; i < 3; i++) FILAS.push({
    nombre: 'Atleta ' + fl + i, division: 'Open', categoria: '-83 kg', club: 'Club',
    modalidad: 'Powerlifting Classic', tarima: '1', flight: fl, dia,
    jornada: k < 3 ? 'AM' : 'PM', entrenador: '', handler1: {}, handler2: {},
  });
});

(async () => {
  console.log('\nEl fin de semana va en orden');
  ok(JSON.stringify(ordenar(['Domingo', 'Sábado'])) === JSON.stringify(['Sábado', 'Domingo']),
     'sábado antes que domingo, aunque alfabéticamente sea al revés');
  ok(JSON.stringify(ordenar(['domingo', 'sabado', 'viernes'])) === JSON.stringify(['viernes', 'sabado', 'domingo']),
     'sin tildes y en minúscula, igual: ' + ordenar(['domingo', 'sabado', 'viernes']).join(' · '));
  ok(JSON.stringify(ordenar(['Domingo 9', 'Sábado 8'])) === JSON.stringify(['Sábado 8', 'Domingo 9']),
     'con el número del día también');
  ok(JSON.stringify(ordenar(['Día 2', 'Día 1', 'Día 3'])) === JSON.stringify(['Día 1', 'Día 2', 'Día 3']),
     'y los campeonatos que numeran los días');
  ok(ordenar(['Sábado', ''])[1] === '', 'las tandas sin día quedan al final');
  ok(JSON.stringify(ordenar(['Sab 8', 'Dom 9'])) === JSON.stringify(['Sab 8', 'Dom 9']),
     'las abreviaturas se entienden');
  ok(JSON.stringify(ordenar(['Sábado 7 de marzo', 'Domingo 8 de marzo']))
     === JSON.stringify(['Sábado 7 de marzo', 'Domingo 8 de marzo']),
     '"marzo" no se confunde con "martes"');
  // Un fin de semana que cruza de mes: el nombre del día manda sobre el número.
  ok(JSON.stringify(ordenar(['Domingo 1', 'Sábado 31'])) === JSON.stringify(['Sábado 31', 'Domingo 1']),
     'y si el finde cambia de mes, tampoco se da vuelta');

  console.log('\nLos tres lados usan el mismo criterio');
  ok(/const _DIAS_SEMANA=/.test(idx), 'yourlift.cl');
  ok(/const _DIAS_SEMANA=/.test(adm), 'el panel de admin');
  ok(/const _DIAS_SEMANA=/.test(pub), 'y la página de cronograma');
  ok(!/if\(!s\)return \[2,Infinity,''\];/.test(idx + adm + pub), 'no quedó ninguna copia del criterio viejo');

  console.log('\nEn yourlift.cl el cronograma muestra y agrupa por día');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof sv === 'function' && typeof ST === 'object', null, { timeout: 25000 });

  const r = await p.evaluate(async filas => {
    // Se le da el cronograma a mano: acá no hay Firestore.
    window.FBQ = {
      doc: () => ({}), collection: () => ({}), query: () => ({}), where: () => ({}),
      getDoc: async () => ({ exists: () => true, data: () => ({ rows: filas, hideCoaches: true }) }),
      getDocs: async () => ({ forEach: () => {} }),
    };
    window.ALL_EVENTS = [{ id: 'regionalnorte', name: 'Regional Norte FECHIPO 2026', date: '2026-09-12', status: 'open' }];
    ST.cronoEv = 'regionalnorte';
    sv('crono');
    await new Promise(res => setTimeout(res, 500));
    const m = document.getElementById('cronoMount');
    return {
      dias: [...m.querySelectorAll('h3')].map(e => e.textContent.trim()),
      tandas: [...m.querySelectorAll('div[style*="font-family:Oswald"]')]
        .map(e => e.textContent.trim()).filter(t => /^Flight /.test(t)),
    };
  }, FILAS);

  ok(JSON.stringify(r.dias) === JSON.stringify(['Sábado', 'Domingo']),
     'sale un encabezado por día, en orden: ' + r.dias.join(' → '));
  const letras = r.tandas.map(t => (t.match(/^Flight (\w+)/) || [])[1]);
  ok(JSON.stringify(letras) === JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
     'las tandas salen A B C D E (sábado) y después F G (domingo): ' + letras.join(' '));
  ok(r.tandas.every(t => /Sábado|Domingo/.test(t)), 'y cada tanda dice de qué día es');
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));

  console.log('\nUn cronograma sin días cargados queda como antes');
  const sinDia = await p.evaluate(async filas => {
    const limpias = filas.map(f => ({ ...f, dia: '' }));
    window.FBQ.getDoc = async () => ({ exists: () => true, data: () => ({ rows: limpias, hideCoaches: true }) });
    sv('crono');
    await new Promise(res => setTimeout(res, 500));
    const m = document.getElementById('cronoMount');
    return {
      dias: m.querySelectorAll('h3').length,
      tandas: [...m.querySelectorAll('div[style*="font-family:Oswald"]')]
        .map(e => e.textContent.trim()).filter(t => /^Flight /.test(t)).length,
    };
  }, FILAS);
  ok(sinDia.dias === 0, 'no aparece ningún encabezado de día');
  ok(sinDia.tandas === 7, 'y las 7 tandas siguen listándose');

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

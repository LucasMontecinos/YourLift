// Actas por día, para premiar al final de cada jornada.
//
// Un campeonato de dos días premia el sábado y vuelve a premiar el domingo. El
// acta, en cambio, salía siempre con el campeonato entero: para la premiación del
// sábado había que leerla salteando a los del domingo.
//
// El día no hay que cargarlo en ningún lado: ya viene del Cronograma del admin,
// que guarda día + sesión y el livecast deja en cada atleta como
// jornada = "Sábado · AM". Acá se comprueba que las actas se puedan acotar a un
// día, que el archivo salga con otro nombre (si no, la del sábado y la del
// domingo se pisan), y que avise cuando una categoría queda repartida entre los
// dos días — ahí el podio del acta de hoy está incompleto.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_actadia.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Deja el campeonato como el Regional Norte: tandas A–E el sábado, F–G el domingo.
const MONTAR = `(()=>{
  isAdmin = true; window.IS_CONTROLLER = false; window.ADMIN_ROLE = 'admin';
  pickEvent(DATA.events.findIndex(e => e.id === 'suda2026_fesupo_full'));
  const sabado = ['A','B','C','D','E'];
  const tandas = ['A','B','C','D','E','F','G'];
  DATA.athletes.forEach((a, i) => {
    a.flight = tandas[i % tandas.length];
    a.jornada = (sabado.indexOf(a.flight) >= 0 ? 'Sábado' : 'Domingo') + ' · ' +
                (a.flight === 'A' || a.flight === 'F' ? 'AM' : 'PM');
  });
  window._ACTA_DIA = '';
  DATA.phase = 'results'; R();
  return DATA.athletes.length;
})()`;

const cuenta = () => {
  // Cuántos atletas distintos hay en las tablas del acta (uno puede salir dos
  // veces: en powerlifting y en Only Bench).
  const ids = new Set();
  _actaGrupos().forEach(gr => gr.filas.forEach(f => ids.add(f.a.id)));
  return ids.size;
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length, null, { timeout: 15000 });
  const total = await p.evaluate(MONTAR);

  console.log('\nLos días salen solos del Cronograma');
  const dias = await p.evaluate(() => _diasDelEvento());
  ok(dias.length === 2, 'detecta los dos días (' + dias.join(', ') + ')');
  ok(dias[0] === 'Sábado' && dias[1] === 'Domingo', 'y en el orden en que se corren');
  ok(await p.evaluate(() => _diaDeAtleta({ jornada: 'Sábado · PM' })) === 'Sábado',
     'de "Sábado · PM" saca el día y descarta la sesión');
  ok(await p.evaluate(() => _diaDeAtleta({ jornada: 'AM' })) === '',
     'y si el campeonato es de un día no inventa ninguno');
  ok(await p.evaluate(() => _diaDeAtleta({ jornada: 'Día 2 · AM' })) === 'Día 2',
     'también entiende "Día 2"');

  console.log('\nEl acta acotada a un día lleva solo a los de ese día');
  const r = await p.evaluate(([cnt]) => {
    const f = eval('(' + cnt + ')');
    const out = { todo: 0, sabado: 0, domingo: 0, nombres: {} };
    window._ACTA_DIA = ''; out.todo = f(); out.nombres.todo = _actaNombreArchivo('pdf');
    window._ACTA_DIA = 'Sábado'; out.sabado = f(); out.nombres.sabado = _actaNombreArchivo('pdf');
    out.sabadoTodosDelDia = _actaAthletes().every(a => _diaDeAtleta(a) === 'Sábado');
    window._ACTA_DIA = 'Domingo'; out.domingo = f(); out.nombres.domingo = _actaNombreArchivo('pdf');
    window._ACTA_DIA = '';
    return out;
  }, [cuenta.toString()]);
  ok(r.todo === total, 'sin elegir día sale el campeonato entero (' + r.todo + '/' + total + ')');
  ok(r.sabado > 0 && r.domingo > 0, 'cada día tiene gente (' + r.sabado + ' y ' + r.domingo + ')');
  ok(r.sabado + r.domingo === total, 'y entre los dos suman el campeonato completo');
  ok(r.sabado < total && r.domingo < total, 'ninguno de los dos trae el campeonato entero');
  ok(r.sabadoTodosDelDia, 'en el acta del sábado no se cuela nadie del domingo');

  console.log('\n  Y el archivo no se pisa con el del otro día');
  ok(/Sabado/.test(r.nombres.sabado), 'el del sábado lo dice: ' + r.nombres.sabado);
  ok(/Domingo/.test(r.nombres.domingo), 'y el del domingo también');
  ok(r.nombres.sabado !== r.nombres.domingo && r.nombres.todo !== r.nombres.sabado,
     'los tres nombres son distintos');
  ok(!/Sabado|Domingo/.test(r.nombres.todo), 'el del campeonato entero queda como antes: ' + r.nombres.todo);

  console.log('\n  Y el PDF que sale dice de qué día es');
  const pdf = await p.evaluate(async () => {
    // jsPDF de mentira: anota cada texto que se dibuja.
    let textos = [], pagina = 1;
    class FakeDoc {
      constructor() { this.lastAutoTable = { finalY: 60 }; }
      setTextColor() {} setFont() {} setFontSize() {} setDrawColor() {} setLineWidth() {}
      setFillColor() {} rect() {} line() {} autoTable() {}
      addPage() { pagina++; } setPage(n) { pagina = n; }
      text(t) { textos.push(String(t)); }
      getTextWidth(t) { return String(t).length * 1.6; }
      internal = { getNumberOfPages: () => pagina };
      save(n) { this.saved = n; }
    }
    window.jspdf = { jsPDF: FakeDoc };
    const correr = async (dia, fn) => {
      window._ACTA_DIA = dia; textos = []; pagina = 1;
      await fn();
      return textos.slice();
    };
    const todoYL = await correr('', generateActaPDF);
    const sabYL  = await correr('Sábado', generateActaPDF);
    const sabFS  = await correr('Sábado', exportActaFesupoPDF);
    window._ACTA_DIA = '';
    return {
      cabecera: sabYL.some(t => /SABADO/i.test(t)),
      cabeceraFS: sabFS.some(t => /Sabado/i.test(t)),
      menos: sabYL.length < todoYL.length,
      todo: todoYL.length, sab: sabYL.length,
    };
  });
  ok(pdf.cabecera, 'el acta de YourLift lo dice en el encabezado');
  ok(pdf.cabeceraFS, 'y la de FESUPO también');
  ok(pdf.menos, 'y trae menos filas que la del campeonato entero (' + pdf.sab + ' vs ' + pdf.todo + ')');

  console.log('\nEn Resultados aparece el selector');
  const ui = await p.evaluate(() => {
    window._ACTA_DIA = ''; R();
    const sel = [...document.querySelectorAll('select')].find(s => /Acta:/.test(s.textContent));
    return sel ? { ops: [...sel.options].map(o => o.textContent.trim()) } : null;
  });
  ok(!!ui, 'está el selector de día');
  ok(ui && ui.ops.length === 3, 'con todo el campeonato y los dos días: ' + (ui && ui.ops.join(' | ')));
  ok(ui && /todo el campeonato/i.test(ui.ops[0]), 'la opción de siempre viene primero y elegida');
  ok(ui && /\(\d+\)/.test(ui.ops[1]), 'cada opción dice cuántos atletas trae');

  console.log('\n  Al elegir un día avisa qué categorías quedan partidas');
  const aviso = await p.evaluate(() => {
    setActaDia('Sábado');
    const t = document.body.textContent;
    return { partidas: _catsPartidas().length, texto: /Ojo:|Ninguna categoría queda partida/.test(t),
             dice: /solo con/.test(t) };
  });
  ok(aviso.dice, 'dice que las actas van a salir solo con ese día');
  ok(aviso.texto, 'y avisa si algún podio queda incompleto (' + aviso.partidas + ' categorías partidas)');

  console.log('\n  Un campeonato de un solo día no cambia en nada');
  const unDia = await p.evaluate(() => {
    window._ACTA_DIA = '';
    DATA.athletes.forEach(a => { a.jornada = 'AM'; });
    R();
    const sel = [...document.querySelectorAll('select')].find(s => /Acta:/.test(s.textContent));
    const ids = new Set(); _actaGrupos().forEach(gr => gr.filas.forEach(f => ids.add(f.a.id)));
    return { hay: !!sel, dias: _diasDelEvento().length, n: ids.size };
  });
  ok(!unDia.hay, 'no aparece ningún selector');
  ok(unDia.dias === 0, 'no detecta días');
  ok(unDia.n === total, 'y el acta sigue trayendo a todos (' + unDia.n + '/' + total + ')');

  console.log('\n  El espectador no ve nada de esto');
  const pub = await p.evaluate(() => {
    isAdmin = false; DATA.phase = 'results'; R();
    return [...document.querySelectorAll('select')].some(s => /Acta:/.test(s.textContent));
  });
  ok(!pub, 'el selector es solo del que opera');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

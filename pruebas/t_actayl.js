// El acta de YourLift (la de Resultados, la de fondo oscuro — no la de FESUPO).
//
// Antes agrupaba solo por sexo y categoría: dentro de "-83 kg" quedaban mezclados
// Junior y Open en un mismo top, cuando cada división compite y premia por
// separado. Ahora agrupa como la de FESUPO —modalidad + sexo + división +
// categoría— con el club a la vista, y al final suma los cuadros de OVERALL por
// división: classic, only bench, equipado y only bench equipado, damas y varones.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_actayl.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Nómina de prueba: varias divisiones dentro de la misma categoría, los dos sexos,
// y las cuatro modalidades que llevan overall.
const NOMINA = [
  // Classic varones -83: Junior y Open en la MISMA categoría de peso
  ['Juan Perez Soto',        'Hombre', '83',  'Junior', 'classic', 'Black Bars',   82.1, 200, 130, 230],
  ['Pedro Diaz Rojas',       'Hombre', '83',  'Junior', 'classic', 'Los Toros',    82.8, 190, 120, 220],
  ['Luis Mora Vera',         'Hombre', '83',  'Open',   'classic', 'Black Bars',   82.5, 240, 150, 260],
  ['Ivan Castro Lillo',      'Hombre', '83',  'Open',   'classic', 'Primal',       82.9, 230, 145, 255],
  ['Marco Nunez Paz',        'Hombre', '93',  'Open',   'classic', 'Los Toros',    92.4, 250, 160, 270],
  ['Raul Vega Pinto',        'Hombre', '93',  'Master I','classic','Hannya',       92.0, 210, 140, 235],
  // Classic damas
  ['Ana Rios Leiva',         'Mujer',  '63',  'Open',   'classic', 'Primal',       62.4, 140,  80, 160],
  ['Sofia Lagos Bravo',      'Mujer',  '63',  'Open',   'classic', 'Hannya',       62.8, 135,  78, 155],
  ['Camila Soto Nunez',      'Mujer',  '63',  'Junior', 'classic', 'Black Bars',   62.1, 120,  70, 145],
  ['Josefa Pardo Salas',     'Mujer',  '76',  'Sub-Junior','classic','Los Toros',  75.5, 110,  65, 135],
  // Only Bench classic
  ['Diego Rivas Cruz',       'Hombre', '83',  'Open',   'onlybench','Primal',      82.2,   0, 160,   0],
  ['Hugo Salas Toro',        'Hombre', '83',  'Open',   'onlybench','Hannya',      82.7,   0, 155,   0],
  ['Paula Vidal Reyes',      'Mujer',  '63',  'Open',   'onlybench','Primal',      62.6,   0,  90,   0],
  // Equipado
  ['Tomas Guzman Ortiz',     'Hombre', '93',  'Open',   'equipped', 'Black Bars',  92.7, 300, 200, 300],
  ['Felipe Araya Munoz',     'Hombre', '93',  'Open',   'equipped', 'Los Toros',   92.2, 290, 195, 295],
  // Only Bench equipado
  ['Cristian Toro Lopez',    'Hombre', '105', 'Open',   'equipped_bench','Primal', 104.3,  0, 240,   0],
  ['Nicolas Bravo Silva',    'Hombre', '105', 'Open',   'equipped_bench','Hannya', 104.8,  0, 230,   0],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined', null, { timeout: 20000 });

  const cap = await p.evaluate(async nomina => {
    // jsPDF de mentira: anota cada texto con su posición, así se puede leer el
    // acta como si fuera una tabla.
    const textos = [];
    let pagina = 1;
    class FakeDoc {
      constructor() { this.lastAutoTable = { finalY: 60 }; }
      setTextColor() {} setFont() {} setFontSize() {} setDrawColor() {} setLineWidth() {}
      setFillColor() {} rect() {} line() {}
      addPage() { pagina++; }
      setPage(n) { pagina = n; }
      text(t, x, y) { textos.push({ t: String(t), x, y, pagina }); }
      getTextWidth(t) { return String(t).length * 1.6; }
      autoTable() {}
      internal = { getNumberOfPages: () => pagina };
      save(n) { this.saved = n; }
    }
    FakeDoc.prototype.autoTable = FakeDoc.prototype.autoTable;
    window.jspdf = { jsPDF: FakeDoc };

    const nueve = () => ({
      sq: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
      bp: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
      dl: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
    });
    DATA.phase = 'compete'; DATA.lift = 'dl'; DATA.round = 2; DATA.flight = 'A';
    DATA.event = { id: 'x', name: 'Regional Norte FECHIPO 2026', short: 'RegionalNorte' };
    DATA.athletes = nomina.map(([name, sex, cat, div, mod, club, bw, sq, bp, dl], i) => {
      const a = { id: i + 1, name, sex, cat, div, mod, club, bw, lot: 100 + i,
                  flight: 'A', bombed: false, att: nueve() };
      // Tres intentos: el 2º nulo, para que el acta tenga válidos y nulos.
      [['sq', sq], ['bp', bp], ['dl', dl]].forEach(([l, top]) => {
        if (!top) return;
        a.att[l][0] = { w: top - 10, r: 'g' };
        a.att[l][1] = { w: top + 5,  r: 'n' };
        a.att[l][2] = { w: top,      r: 'g' };
      });
      return a;
    });

    let sinGuardar = null;
    const saveOrig = FakeDoc.prototype.save;
    FakeDoc.prototype.save = function (n) { sinGuardar = n; };
    await generateActaPDF();
    FakeDoc.prototype.save = saveOrig;

    return { textos, paginas: pagina, archivo: sinGuardar };
  }, NOMINA);

  // Los títulos pasan por _stripAccentsForPdf, que también cambia el "·" por "-":
  // se los busca por el nombre de la modalidad, no por el separador.
  const titulos = cap.textos.filter(t => /^(POWERLIFTING|ONLY BENCH|SPECIAL OLYMPICS|OVERALL)/.test(t.t)).map(t => t.t);
  const todo = cap.textos.map(t => t.t);

  console.log('\nUna tabla por división, no una por categoría');
  const t83 = titulos.filter(t => /-83 kg/.test(t) && !/OVERALL/.test(t));
  ok(t83.some(t => /CABALLEROS.*Junior/.test(t)), 'existe "-83 kg Junior": ' + (t83.find(t => /Junior/.test(t)) || '—'));
  ok(t83.some(t => /CABALLEROS.*Open/.test(t)), 'y "-83 kg Open" aparte: ' + (t83.find(t => /CABALLEROS.*Open/.test(t)) || '—'));
  ok(titulos.some(t => /POWERLIFTING CLASSIC.*DAMAS.*Open -63/.test(t)), 'las damas también van por división');
  ok(titulos.some(t => /ONLY BENCH CLASSIC/.test(t)), 'Only Bench tiene sus propias tablas');
  ok(titulos.some(t => /POWERLIFTING EQUIPADO/.test(t)), 'el equipado también');
  ok(titulos.some(t => /ONLY BENCH EQUIPADO/.test(t)), 'y el Only Bench equipado');

  console.log('\nCada tabla numera su propio top');
  // En "-83 kg Junior" hay 2 atletas y en "-83 kg Open" otros 2: los cuatro no
  // pueden numerarse del 1 al 4 seguidos.
  const yTit = t => (cap.textos.find(x => x.t === t) || {}).y;
  const jr = titulos.find(t => /-83 kg/.test(t) && /Junior/.test(t) && !/OVERALL/.test(t));
  const filasJr = cap.textos.filter(x => x.y > yTit(jr) && x.y < yTit(jr) + 30 && /^[12]$/.test(x.t));
  ok(filasJr.length >= 2, 'la tabla de Junior arranca en 1 y numera solo a los suyos');
  // Un atleta sale una vez en la tabla de su categoría y otra en el overall de su
  // división: dos veces en todo el acta, no más.
  const iOv = todo.indexOf('OVERALL POR DIVISION');
  const antesOv = todo.slice(0, iOv).filter(t => t === 'Juan Perez Soto').length;
  const despuesOv = todo.slice(iOv).filter(t => t === 'Juan Perez Soto').length;
  ok(antesOv === 1, 'sale una sola vez en la tabla de su categoría');
  ok(despuesOv === 1, 'y una sola vez en el overall de su división');

  console.log('\nEl club está a la vista');
  ok(todo.includes('Club'), 'hay una columna Club');
  ['Black Bars', 'Los Toros', 'Primal', 'Hannya'].forEach(c =>
    ok(todo.includes(c), 'se ve el club "' + c + '"'));

  console.log('\nLos overall por división');
  const ovs = titulos.filter(t => /^OVERALL/.test(t));
  ok(todo.includes('OVERALL POR DIVISION'), 'hay una sección de overall');
  ok(ovs.some(t => /POWERLIFTING CLASSIC.*CABALLEROS.*Junior/.test(t)), 'Classic · caballeros · Junior');
  ok(ovs.some(t => /POWERLIFTING CLASSIC.*CABALLEROS.*Open/.test(t)), 'Classic · caballeros · Open');
  ok(ovs.some(t => /POWERLIFTING CLASSIC.*CABALLEROS.*Master I/.test(t)), 'Classic · caballeros · Master I');
  ok(ovs.some(t => /POWERLIFTING CLASSIC.*DAMAS.*Open/.test(t)), 'Classic · damas · Open');
  ok(ovs.some(t => /POWERLIFTING CLASSIC.*DAMAS.*Junior/.test(t)), 'Classic · damas · Junior');
  ok(ovs.some(t => /POWERLIFTING CLASSIC.*DAMAS.*Sub-Junior/.test(t)), 'Classic · damas · Sub-Junior');
  ok(ovs.some(t => /ONLY BENCH CLASSIC.*CABALLEROS/.test(t)), 'Only Bench · caballeros');
  ok(ovs.some(t => /ONLY BENCH CLASSIC.*DAMAS/.test(t)), 'Only Bench · damas');
  ok(ovs.some(t => /POWERLIFTING EQUIPADO.*CABALLEROS/.test(t)), 'Equipado · caballeros');
  ok(ovs.some(t => /ONLY BENCH EQUIPADO.*CABALLEROS/.test(t)), 'Only Bench equipado · caballeros');

  console.log('\n  El overall mezcla las categorías de peso de la división');
  // En Classic · caballeros · Open hay -83 (dos) y -93 (uno): el cuadro los junta.
  const ovOpen = ovs.find(t => /POWERLIFTING CLASSIC.*CABALLEROS.*Open/.test(t));
  const y0 = yTit(ovOpen);
  const enBloque = cap.textos.filter(x => x.y > y0 && x.y < y0 + 40).map(x => x.t);
  ok(enBloque.includes('Marco Nunez Paz') && enBloque.includes('Luis Mora Vera'),
     'el de -93 y el de -83 salen en el mismo overall');
  ok(enBloque.includes('83') && enBloque.includes('93'), 'y se ve de qué categoría es cada uno');

  console.log('\nEl archivo ya no dice el vuelo');
  ok(/^Acta_YourLift_/.test(cap.archivo || ''), 'se llama Acta_YourLift_…: ' + cap.archivo);
  ok(!/Vuelo/.test(cap.archivo || ''), 'el acta cubre todo el campeonato, no una tanda');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

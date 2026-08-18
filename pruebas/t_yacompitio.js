// "¿Ya compitió este año?" en la revisión de inscripciones.
//
// Un atleta puede correr UN SOLO regional por año. Con el Sur Austral y el Centro
// abriendo inscripciones a la vez, controlarlo de memoria no se sostiene: hay que
// verlo en la misma pantalla donde la comisión técnica acepta o rechaza.
//
// El dato ya existía —cada campeonato cerrado desde el livecast deja sus
// resultados en competition_results, con RUT— pero había que ir a buscarlo al
// perfil de cada uno.
//
// Lo que se cuida acá:
//   · que un regional del año se vea a la primera, sin abrir nada;
//   · que Debutantes o Universitario NO se marquen como si gastaran el cupo, para
//     que la comisión no tenga que abrir todos los tickets;
//   · y que el Debutantes, que vino partido en dos tarimas, cuente como uno.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_yacompitio.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Se sacan las funciones del admin y se ejecutan tal cual, sin abrir el panel:
// lo que se prueba es el cruce, no la pantalla de login.
function sacar(nombre) {
  const i = src.search(new RegExp('(?:^|\\n)function ' + nombre + '\\('));
  if (i < 0) throw new Error('no encontré ' + nombre);
  const start = src.lastIndexOf('\n', i + 1) + 1;
  let p = start, open = 0, abrio = false;
  while (p < src.length) {
    const c = src[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    p++;
  }
  return src.slice(start, p);
}
const ST = { allCompResults: [], data: [], cupoCfg: null };
const window_ = {};
eval(['_hRut', '_hNom', '_esRegional', '_evClave', '_cupoCfg', '_cuentaEvento', '_histAnio', '_histDe']
  .map(sacar).join('\n').replace(/window\._HIST_ANIO/g, 'window_._HIST_ANIO'));

const ANIO = String(new Date().getFullYear());
const R = (rut, nombre, evento, fecha, extra) => Object.assign(
  { rut, nombre, evento, fecha, categoria: '93', division: 'Open',
    modalidad: 'Powerlifting Classic', resultado: { total: 600, status: 'OK' } }, extra || {});

(async () => {
  console.log('\nUn regional del año se ve sin abrir nada');
  {
    ST.allCompResults = [
      R('21.523.046-5', 'Benjamin Garcia', 'Campeonato Regional Norte ' + ANIO, ANIO + '-06-14'),
      R('17.111.222-3', 'Sergio Mardones', 'Campeonato Debutantes All Power CD ' + ANIO + ' - Tarima 1', ANIO + '-05-10'),
    ];
    window_._HIST_ANIO = null;
    const h = _histDe('21523046-5', 'Benjamin Garcia');
    ok(h.length === 1, 'se le encuentra su campeonato (' + h.length + ')');
    ok(h[0].regional === true, 'y queda marcado como REGIONAL: ' + h[0].evento);
  }

  console.log('\nDebutantes y Universitario no gastan el cupo del regional');
  {
    const h = _histDe('17111222-3', 'Sergio Mardones');
    ok(h.length === 1, 'compitió este año');
    ok(h[0].regional === false, 'pero el Debutantes NO se marca como regional');
    ok(_esRegional('Primer Campeonato Nacional Universitario FECHIPO ' + ANIO) === false,
       'el Universitario tampoco');
    ok(_esRegional("World Powerlifting Classic Men's & Women's Championships " + ANIO) === false,
       'ni un internacional');
    ok(_esRegional('Campeonato Regional CENTRO SUR  FECHIPO ' + ANIO) === true, 'el Centro Sur sí');
    ok(_esRegional('Campeonato Regional Centro FECHIPO ' + ANIO) === true, 'y el Centro también');
  }

  console.log('\nEl Debutantes vino en dos tarimas: es UN campeonato');
  {
    ST.allCompResults = [
      R('11.111.111-1', 'Dos Tarimas', 'Campeonato Debutantes All Power CD ' + ANIO + ' - Tarima 1', ANIO + '-05-10'),
      R('11.111.111-1', 'Dos Tarimas', 'Campeonato Debutantes All Power CD ' + ANIO + ' - Tarima 2', ANIO + '-05-10',
        { modalidad: 'Only Bench Classic' }),
    ];
    window_._HIST_ANIO = null;
    const h = _histDe('11111111-1', 'Dos Tarimas');
    ok(h.length === 1, 'se muestra una sola vez, no dos (' + h.length + ')');
    ok(!/Tarima/i.test(h[0].evento), 'y sin el "- Tarima N" colgando: ' + h[0].evento);
  }

  console.log('\nEl que no compitió este año queda limpio');
  {
    ST.allCompResults = [
      R('22.222.222-2', 'Del Año Pasado', 'Campeonato Regional Norte 2025', '2025-06-14'),
    ];
    window_._HIST_ANIO = null;
    ok(_histDe('22222222-2', 'Del Año Pasado').length === 0,
       'un regional del año pasado no bloquea: el cupo es por año');
    ok(_histDe('99999999-9', 'Nadie Conocido').length === 0, 'y el desconocido tampoco');
  }

  console.log('\nEl RUT se cruza aunque venga escrito distinto');
  {
    ST.allCompResults = [R('21.523.046-5', 'Benjamin Garcia', 'Campeonato Regional Norte ' + ANIO, ANIO + '-06-14')];
    window_._HIST_ANIO = null;
    for (const r of ['21523046-5', '21.523.046-5', '215230465', '21523046-K'.replace('K', '5')])
      ok(_histDe(r, '').length === 1, '"' + r + '" encuentra al mismo');
  }

  console.log('\n  Y si la inscripción vino sin RUT, se prueba por nombre');
  {
    ok(_histDe('', 'BENJAMIN  GARCIA').length === 1, 'con mayúsculas y espacios de más');
    ok(_histDe('', 'Benjamín García').length === 1, 'y con tildes, que en un formulario van y vienen');
    ok(_histDe('7.777.777-7', 'Benjamin Garcia').length === 1,
       'si el RUT no calza con ninguno, igual lo encuentra por nombre');
  }

  console.log('\nSe ordena por fecha, lo último primero');
  {
    ST.allCompResults = [
      R('33.333.333-3', 'Tres Veces', 'Campeonato Regional Centro FECHIPO ' + ANIO, ANIO + '-03-15'),
      R('33.333.333-3', 'Tres Veces', 'Campeonato Regional Norte ' + ANIO, ANIO + '-08-02'),
      R('33.333.333-3', 'Tres Veces', 'Primer Campeonato Nacional Universitario FECHIPO ' + ANIO, ANIO + '-06-20'),
    ];
    window_._HIST_ANIO = null;
    const h = _histDe('33333333-3', '');
    ok(h.length === 3, 'los tres campeonatos (' + h.length + ')');
    ok(h[0].fecha > h[1].fecha && h[1].fecha > h[2].fecha, 'del más nuevo al más viejo');
    ok(h.filter(x => x.regional).length === 2,
       'dos regionales en el mismo año — el caso que hay que cazar');
  }

  console.log('\nEl Nacional también cuenta, aunque no haya pasado por el livecast');
  {
    // El Campeonato Nacional 2026 (San Vicente, febrero) nunca se cerró desde
    // YourLift: no está en competition_results, está en data.json. Mirando una sola
    // fuente, los 214 atletas que compitieron ahí salían con ✗, como si no
    // hubieran competido en todo el año. Es el falso negativo más caro posible:
    // justo el campeonato del que sale la gente que va al Mundial.
    ST.allCompResults = [];
    ST.data = [{ rut: '5.555.555-5', nombre: 'Del Nacional',
      competencias: [{ evento: 'Campeonato Nacional FECHIPO ' + ANIO, fecha: '',
        categoria: '93', division: 'Open', modalidad: 'Powerlifting Classic',
        resultado: { total: 700, status: 'OK' } }] }];
    window_._HIST_ANIO = null;
    const h = _histDe('5.555.555-5', '');
    ok(h.length === 1, 'aparece igual (' + h.length + ')');
    ok(/Nacional/.test(h[0].evento), 'y es el Nacional: ' + h[0].evento);
    ok(true, 'sin fecha, el año se saca del nombre del campeonato');
  }

  console.log('\n  El mismo campeonato escrito de dos formas es UNO solo');
  {
    // En los datos conviven "Regional Centro 2026" y "Campeonato Regional Centro
    // FECHIPO 2026" — 29 personas figuran con los dos. Sin unificar, la comisión
    // vería a alguien compitiendo dos veces donde compitió una.
    ST.allCompResults = [R('6.666.666-6', 'Dos Nombres', 'Campeonato Regional Centro FECHIPO ' + ANIO, ANIO + '-05-11')];
    ST.data = [{ rut: '6.666.666-6', nombre: 'Dos Nombres',
      competencias: [{ evento: 'Regional Centro ' + ANIO, fecha: ANIO + '-05-11',
        categoria: '93', division: 'Open', modalidad: 'Powerlifting Classic',
        resultado: { total: 600, status: 'OK' } }] }];
    window_._HIST_ANIO = null;
    const h = _histDe('6.666.666-6', '');
    ok(h.length === 1, 'se muestra una sola vez (' + h.length + ')');
    ok(/FECHIPO/.test(h[0].evento), 'con el nombre más completo de los dos: ' + h[0].evento);

    ok(_evClave('Regional Centro 2026') === _evClave('Campeonato Regional Centro FECHIPO 2026'),
       'las dos escrituras dan la misma clave');
    ok(_evClave('Campeonato Regional Centro FECHIPO 2026') !== _evClave('Campeonato Regional CENTRO SUR  FECHIPO 2026'),
       'pero Centro y Centro Sur siguen siendo campeonatos distintos');
    ok(_evClave('Campeonato Nacional FECHIPO 2026') !== _evClave('Primer Campeonato Nacional Universitario FECHIPO 2026'),
       'y el Nacional no se confunde con el Nacional Universitario');
    ok(_evClave('Campeonato Nacional FECHIPO 2026') !== _evClave('Campeonato Nacional FECHIPO 2025'),
       'ni un año con el otro');
  }

  console.log('\nContra los datos DE VERDAD de este año');
  {
    const reales = JSON.parse(fs.readFileSync(__dirname + '/cr_reales.json', 'utf8'));
    const hist = JSON.parse(fs.readFileSync(__dirname + '/datajson_2026.json', 'utf8'));
    ST.allCompResults = reales;
    ST.data = hist;
    window_._HIST_ANIO = null;
    const H = _histAnio();
    const ruts = Object.keys(H.porRut);
    ok(ruts.length > 250, ruts.length + ' personas con resultados en ' + ANIO);
    // Con las dos fuentes tiene que aparecer el Nacional, que en la de Firestore no está.
    const conNacional = ruts.filter(r => (H.porRut[r] || [])
      .some(x => /nacional/i.test(x.evento) && !/universitario/i.test(x.evento)));
    ok(conNacional.length > 150,
       conNacional.length + ' compitieron en el Nacional — antes salían todos con ✗');
    const conRegional = ruts.filter(r => (H.porRut[r] || []).some(x => x.regional));
    ok(conRegional.length > 100, conRegional.length + ' ya corrieron un regional este año');
    // Se cuenta con el MISMO unificador que usa la pantalla. Con los nombres
    // crudos daban 53 personas "con dos regionales", que era falso: eran las que
    // figuran con las dos escrituras del mismo Regional Centro.
    const dobles = ruts.filter(r => {
      const evs = new Set((H.porRut[r] || []).filter(x => x.regional).map(x => _evClave(x.evento)));
      return evs.size > 1;
    });
    console.log('    · con DOS regionales distintos este año: ' + dobles.length);
    ok(true, 'el cruce corre sobre las dos fuentes reales sin romperse');
    // El nombre del campeonato es lo que la comisión lee, y no puede faltar. La
    // fecha sí falta a veces —el histórico viejo no la trae— y se muestra "—".
    const rotas = ruts.filter(r => (H.porRut[r] || []).some(x => !x.evento));
    ok(rotas.length === 0, 'ninguna ficha queda sin campeonato' + (rotas.length ? ' — fallan ' + rotas.length : ''));
    const sinFecha = ruts.filter(r => (H.porRut[r] || []).some(x => !x.fecha)).length;
    console.log('    · fichas sin fecha (se muestran con "—"): ' + sinFecha);
  }

  console.log('\nEl ✓ y la ✗ van sin colores ni etiquetas');
  {
    // Al principio esto separaba los regionales del resto, dando por hecho que el
    // Debutantes no gastaba cupo. Sí lo gasta: todos los campeonatos del año
    // gastan. Así que la marca es una sola y el detalle se ve abriendo el ✓.
    const i = src.indexOf('function _marcaCompitio');
    const cuerpo = src.slice(i, src.indexOf('\n}', i));
    ok(!/REGIONAL/.test(cuerpo), 'el ✓ no lleva la etiqueta REGIONAL');
    ok(!/var\(--red\)|var\(--green\)/.test(cuerpo), 'ni colores que separen unos de otros');
    ok(/✓/.test(cuerpo) && /✗/.test(cuerpo), 'solo un ✓ o una ✗');
    const j = src.indexOf('function _detalleHist');
    const det = src.slice(j, src.indexOf('\n}', j));
    ok(!/REGIONAL/.test(det), 'y en el detalle tampoco se resalta ningún campeonato');
  }

  console.log('\nLos dos casos que se reportaron desde la nómina');
  {
    // Markos Salgado salía con ✗ habiendo competido, y Andrea Fábregas con ✗
    // estando en la nómina final aunque no compitió. Los dos estaban en data.json
    // y no en competition_results: es el mismo agujero de una sola fuente.
    const db = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));
    ST.allCompResults = []; ST.data = db; ST.cupoCfg = null;
    window_._HIST_ANIO = null;
    const markos = _histDe('19839518-9', '');
    ok(markos.length > 0, 'Markos Salgado aparece con ✓ (' + markos.length + ' campeonatos)');
    ok(markos.some(x => /Regional Centro/i.test(x.evento)), 'con su Regional Centro');
    const andrea = _histDe('21031231-5', '');
    ok(andrea.length > 0, 'Andrea Fábregas también, por estar en la nómina final');
    ok(andrea.some(x => /Regional Centro/i.test(x.evento)),
       'aunque no haya competido: la nómina final ya gastó el cupo');
  }

  console.log('\nLos campeonatos de 2025 no se cuelan como si fueran de este año');
  {
    // En data.json conviven los mismos nombres de las dos temporadas —Regional
    // Centro 2025 con 212 personas, Centro Sur 2025, Norte 2025, Sur Austral
    // 2025— y varios vienen SIN FECHA. Si el año saliera solo de la fecha, esos
    // quedarían sin año y podrían contarse como del año en curso.
    ST.allCompResults = []; ST.cupoCfg = null;
    ST.data = [{ rut: '40.404.040-4', nombre: 'Del Año Pasado', competencias: [
      { evento: 'Regional Centro 2025', fecha: '' },          // sin fecha, como en el archivo real
      { evento: 'Regional Norte 2025', fecha: '' },
      { evento: 'Regional Centro Sur 2025', fecha: '' },
      { evento: 'Regional Sur Austral 2025', fecha: '2025-09-01' },
    ] }];
    window_._HIST_ANIO = null;
    ok(_histDe('40.404.040-4', '').length === 0,
       'ninguno cuenta: el año sale del nombre cuando falta la fecha');
    const H = _histAnio();
    ok(H.todos.every(x => x.anio === '2025'), 'y el selector los ordena bajo 2025');
    ok(H.delAnio.length === 0, 'así que no entran en "los del año en curso"');
  }

  console.log('\nQué campeonatos cuentan se puede elegir a mano');
  {
    // "Los de este año" sirve para arrancar, pero el sistema va a correr muchos
    // años y el circuito no siempre calza con el año calendario.
    ST.allCompResults = [
      R('44.444.444-4', 'Config', 'Campeonato Regional Norte ' + ANIO, ANIO + '-06-14'),
      R('44.444.444-4', 'Config', 'Campeonato Debutantes All Power CD ' + ANIO, ANIO + '-05-10'),
    ];
    ST.data = []; ST.cupoCfg = null;
    window_._HIST_ANIO = null;
    ok(_histDe('44.444.444-4', '').length === 2, 'sin configurar nada, cuentan los dos del año');

    const H = _histAnio();
    ok(Array.isArray(H.todos) && H.todos.length === 2, 'el selector ofrece los campeonatos detectados (' + H.todos.length + ')');
    ok(H.todos.every(x => x.clave && x.nombre && x.n > 0), 'cada uno con su nombre y cuántos registros trae');
    ok(H.delAnio.length === 2, 'y sabe cuáles son los del año en curso');

    // Ahora se elige solo el regional.
    ST.cupoCfg = { seleccionados: [_evClave('Campeonato Regional Norte ' + ANIO)] };
    window_._HIST_ANIO = null;
    const h = _histDe('44.444.444-4', '');
    ok(h.length === 1, 'eligiendo uno solo, cuenta uno solo (' + h.length + ')');
    ok(/Norte/.test(h[0].evento), 'y es el que se eligió: ' + h[0].evento);

    // Un campeonato de otro año se puede hacer contar, si el circuito lo cruza.
    ST.allCompResults.push(R('44.444.444-4', 'Config', 'Campeonato Nacional FECHIPO 2025', '2025-11-20'));
    ST.cupoCfg = { seleccionados: [_evClave('Campeonato Nacional FECHIPO 2025')] };
    window_._HIST_ANIO = null;
    const h2 = _histDe('44.444.444-4', '');
    ok(h2.length === 1 && /2025/.test(h2[0].evento),
       'y se puede contar uno de otro año, para temporadas que cruzan diciembre');
  }

  console.log('\n  Lo elegido queda guardado, y lo nuevo se avisa');
  ok(/setDoc\(doc\(db,'config','participacion'\)/.test(src), 'se guarda en Firestore, no en el navegador');
  ok(/match \/config\/\{id\} \{[\s\S]{0,80}allow read, write: if isAdmin\(\);/.test(
       fs.readFileSync(__dirname + '/../firestore.rules', 'utf8')),
     'con su regla, y solo para el admin');
  ok(/vistos:H\.todos\.map\(x=>x\.clave\)/.test(src), 'se anota qué campeonatos había al guardar');
  ok(/NUEVO<\/span>/.test(src), 'para marcar como NUEVO lo que aparezca después');
  ok(/campeonato\$\{nuevos\.length===1\?'':'s'\} nuevo/.test(src),
     'y avisarlo arriba, sin abrir el panel');
  ok(/window\.cupoVolverAlAnio=function/.test(src), 'se puede volver a "los del año en curso"');
  ok(/return anioEv===anioActual;/.test(src), 'que sigue siendo el comportamiento por defecto');

  console.log('\nLa columna está en las DOS pantallas');
  ok(/<th title="Si ya compitió este año[^>]*>Compitió<\/th>/.test(src), 'en Nóminas');
  ok(/_marcaCompitio\(_hCargando\(\)\?\[\]:_histDe\(i\.rut,i\.nombre\),'nom_'\+i\.id/.test(src),
     'con su propia marca por fila');
  ok(/return `<tr><td colspan="20"[\s\S]{0,120}_detalleHist\(_h,_histAnio\(\)\.anio\)/.test(src),
     'y el mismo detalle se abre ahí');
  ok(/if\(el&&ST\.view==='approvals'\)el\.innerHTML=apprListHtml\(\);\n\s*else render\(\);/.test(src),
     'abrir el ✓ funciona en las dos, cada una como le corresponde');
  ok(/ST\.view==='nominas'\)render\(\)/.test(src), 'y Nóminas también se actualiza sola');

  console.log('\nUna cuenta de juez no entra a ningún panel');
  {
    const liv = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    // El respaldo del livecast daba admin ante CUALQUIER error al leer admins/.
    // Las reglas solo dejan esa lectura a un admin, así que una cuenta de juez
    // rebotaba ahí y salía con acceso completo — al revés de lo que se buscaba.
    ok(/const negado=err&&\(err\.code==='permission-denied'/.test(liv),
       'el livecast distingue "permiso denegado" de una caída de red');
    ok(/if\(negado\)\{\n\s*isAdmin=false;/.test(liv),
       'y con permiso denegado NO da admin');
    ok(/isAdmin=true;window\.ADMIN_ROLE='admin';/.test(liv),
       'pero ante una caída de red sigue dejando operar, que era para lo que estaba');
    ok(/try\{ adminDoc=await getDoc\(doc\(db,'admins',u\.uid\)\); \}catch\(e\)\{ adminDoc=null; \}/.test(src),
       'el admin trata el permiso denegado como "no es admin", no como error de sistema');
    ok(/Esta es una cuenta de juez: sirve solamente para marcar las luces/.test(src),
       'y se lo dice al juez con esas palabras, en vez de "acceso denegado"');
    ok(/Luces jueces — SOLO yourlift\.cl\/jueces/.test(src), 'el rol se llama "Luces jueces"');
    ok(/setDoc\(doc\(db, esJuez\?'jueces':'admins', newUID\)/.test(src),
       'y la cuenta se crea fuera de admins/');
  }

  console.log('\nLa columna está en la pantalla de revisión');
  ok(/<th title="Si ya compitió este año/.test(src), 'hay una columna con su encabezado');
  ok(/window\.apprToggleHist=function/.test(src), 'el ✓ se puede abrir para ver en qué compitió');
  ok(/✗<\/span>/.test(src), 'y el que no compitió lleva una ✗');
  ok(/apprToggleHist\('\$\{esc\(id\|\|''\)\}'\)/.test(src), 'cada fila abre la suya');
  ok(/COMPITIÓ EN \$\{anio\}/.test(src), 'el detalle dice el año');
  ok(/Un campeonato que no se cerró desde acá no aparece/.test(src),
     'y avisa hasta dónde llega el dato, para no dar por limpio a alguien que no lo está');
  ok(/ST\.view==='athleteProfile'\|\|ST\.view==='approvals'/.test(src),
     'la pantalla se actualiza sola cuando llegan los resultados');

  console.log('\nEl recordatorio de prioridad va abajo del detalle');
  {
    // Los nueve puntos son el reglamento, no un cálculo. Van como recordatorio
    // para la comisión y NO deben decir en qué punto cae el atleta: el sistema no
    // tiene cómo saber si alguien quiere bajar de categoría o de qué organización
    // viene, y una pantalla que insinúe un veredicto que no puede sostener es peor
    // que no mostrar nada.
    const i = src.indexOf('const PRIORIDAD_CUPOS=[');
    ok(i > 0, 'los nueve puntos están escritos en un solo lugar');
    const bloque = src.slice(i, src.indexOf('];', i));
    const puestos = (bloque.match(/^\s+'.*',$/gm) || [])
      .map(l => l.trim().replace(/^'/, '').replace(/',$/, '').replace(/\\'/g, "'"));
    ok(puestos.length === 9, 'son nueve, del uno al nueve (' + puestos.length + ')');

    // Se comparan LETRA POR LETRA contra el Anexo 3 del compendio oficial, sacado
    // del PDF. Es normativa: una paráfrasis bien intencionada le puede cambiar el
    // sentido a un punto, y de hecho pasó — el punto 2 estaba escrito al revés,
    // "se consideran" en vez de "no considera", que es justo el error capaz de
    // dejar entrar a quien no correspondía.
    const oficial = JSON.parse(fs.readFileSync(__dirname + '/anexo3_oficial.json', 'utf8'));
    // El PDF deja espacios sueltos donde hay negrita ("Anexo 2 ,"), así que se
    // normalizan los espacios antes de puntuación antes de comparar.
    const limpiar = s => String(s).replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1')
      .trim().toLowerCase().replace(/\.$/, '');
    oficial.puntos.forEach((txt, k) => {
      ok(limpiar(puestos[k]) === limpiar(txt),
         'el punto ' + (k + 1) + ' dice lo mismo que el compendio'
         + (limpiar(puestos[k]) === limpiar(txt) ? '' : '\n      nuestro: ' + puestos[k] + '\n      oficial: ' + txt));
    });
    // El punto 2 aparte, porque es el que ya salió mal una vez.
    ok(/Este punto no considera a los atletas que compitieron y fueron descalificados/.test(bloque),
       'el punto 2 dice NO CONSIDERA, no lo contrario');
    ok(!/En este punto se consideran los atletas/.test(bloque), 'y no quedó rastro de la versión invertida');
    ok(limpiar(src.slice(src.indexOf("const PRIORIDAD_NOTA='") + 22, src.indexOf("';", src.indexOf("const PRIORIDAD_NOTA='"))))
       === limpiar(oficial.nota), 'la nota final también es la del compendio');
    ok(/ANEXO 3/.test(src) && /Compendio de Normas de Clasificación FECHIPO 2026/.test(src),
       'y se dice de dónde sale, para poder ir a verificarlo');
    ok(/65 atletas de Powerlifting/.test(src) && /71 en total/.test(src),
       'van también los cupos, que son la razón por la que existe la priorización');

    ok(/<ol /.test(src.slice(src.indexOf('function _prioridadHtml'))),
       'se dibuja como lista numerada, para poder decir "es el punto 4"');
    ok(/\$\{_prioridadHtml\(\)\}/.test(src), 'y aparece al abrir el ✓, debajo de los campeonatos');
  }

  console.log('\n  Es un recordatorio, no un veredicto');
  {
    const j = src.indexOf('function _prioridadHtml');
    const cuerpo = src.slice(j, src.indexOf('\n}', j));
    ok(/No dice en qué punto cae este atleta/.test(cuerpo),
       'lo dice en la propia pantalla');
    // Que no reciba al atleta es la garantía de que no puede señalarlo.
    ok(/function _prioridadHtml\(\)\{/.test(src),
       'la función no recibe al atleta, así que no puede marcar ninguno');
    ok(!/hist|regional|rut/i.test(cuerpo.replace(/PRIORIDAD_\w+/g, '')),
       'y no mira su historial para nada');
  }

  console.log('\n  Es solo de lectura: no cambia ninguna inscripción');
  {
    const i = src.indexOf('function _histDe(');
    const cuerpo = src.slice(i, src.indexOf('\n}', i));
    ok(!/setDoc|updateDoc|deleteDoc|setStatus/.test(cuerpo), 'el cruce no escribe nada');
    const j = src.indexOf('window.apprToggleHist=function');
    ok(!/setDoc|updateDoc|setStatus/.test(src.slice(j, src.indexOf('\n};', j))),
       'y abrir el ticket tampoco: acepta y rechaza la comisión, no esta columna');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  process.exit(fallas ? 1 : 0);
})();

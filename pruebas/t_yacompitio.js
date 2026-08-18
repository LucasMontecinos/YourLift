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
const ST = { allCompResults: [] };
const window_ = {};
eval(['_hRut', '_hNom', '_esRegional', '_histAnio', '_histDe'].map(sacar).join('\n')
  .replace(/window\._HIST_ANIO/g, 'window_._HIST_ANIO'));

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

  console.log('\nContra los datos DE VERDAD de este año');
  {
    const reales = JSON.parse(fs.readFileSync(__dirname + '/cr_reales.json', 'utf8'));
    ST.allCompResults = reales;
    window_._HIST_ANIO = null;
    const H = _histAnio();
    const ruts = Object.keys(H.porRut);
    ok(ruts.length > 250, ruts.length + ' personas con resultados en ' + ANIO);
    const conRegional = ruts.filter(r => (H.porRut[r] || []).some(x => x.regional));
    ok(conRegional.length > 100, conRegional.length + ' ya corrieron un regional este año');
    const dobles = ruts.filter(r => {
      const evs = new Set((H.porRut[r] || []).filter(x => x.regional)
        .map(x => x.evento.replace(/\s*[-–]\s*Tarima\s*\d+\s*$/i, '').trim()));
      return evs.size > 1;
    });
    console.log('    · con DOS regionales distintos este año: ' + dobles.length);
    ok(true, 'el cruce corre sobre los ' + reales.length + ' resultados reales sin romperse');
    // Y ninguna ficha sale vacía o a medio armar.
    const rotas = ruts.filter(r => (H.porRut[r] || []).some(x => !x.evento || !x.fecha));
    ok(rotas.length === 0, 'todas las fichas traen campeonato y fecha' + (rotas.length ? ' — fallan ' + rotas.length : ''));
  }

  console.log('\nLa columna está en la pantalla de revisión');
  ok(/<th title="Si ya compitió este año/.test(src), 'hay una columna con su encabezado');
  ok(/window\.apprToggleHist=function/.test(src), 'el ✓ se puede abrir para ver en qué compitió');
  ok(/✗<\/span>/.test(src), 'y el que no compitió lleva una ✗');
  ok(/apprToggleHist\('\$\{esc\(i\.id\|\|''\)\}'\)/.test(src), 'cada fila abre la suya');
  ok(/COMPITIÓ EN \$\{H\.anio\}/.test(src), 'el detalle dice el año');
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
    const n = (bloque.match(/^\s+'/gm) || []).length;
    ok(n === 9, 'son nueve, del uno al nueve (' + n + ')');
    ok(/Atletas debutantes sin registros de participación/.test(bloque),
       'el 1 es el de los debutantes sin registro en otra organización');
    ok(/no tienen registro en el actual circuito competitivo/.test(bloque),
       'el 2, los que compitieron y no están en el ranking');
    ok(/Anexo 2/.test(bloque), 'el 3 cita el Anexo 2');
    ok(/desean bajar de categoría/.test(bloque), 'el 8, los que quieren bajar de categoría');
    ok(/desean subir de categoría/.test(bloque), 'y el 9, los que quieren subir');
    ok(/Los puntos 7, 8 y 9 quedarán a criterio de la comisión técnica/.test(src),
       'y queda la nota de que 7, 8 y 9 los define la comisión');

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

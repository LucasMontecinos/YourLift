// Cuántos atletas hay DE VERDAD.
//
// El panel decía "1.051 atletas". Ese número es todo el que alguna vez pisó una
// tarima desde 2016, y adentro está el que compitió una sola vez en 2019 y no
// volvió nunca. Para proyectar un campeonato, o para decirle a un auspiciador a
// cuánta gente se llega, ese número miente por exceso.
//
// Así que la base se parte en dos:
//   · la HISTÓRICA, todos los que alguna vez compitieron;
//   · la ACTUAL, los que compitieron en la temporada en curso o en la anterior.
//
// Y se muestra el movimiento entre las dos últimas temporadas: cuántos siguen,
// cuántos no han vuelto y cuántas caras nuevas hay. Los tres tienen que cerrar
// contra los totales, que es lo que esta prueba comprueba: un panel que dice
// tres cifras que no suman es peor que uno que no las dice.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_basereal.js
const fs = require('fs');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
const data = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Se monta lo mismo que usa el panel: buildStatsRows arma las filas y
// buildBaseAtletas las cuenta. Se sacan del archivo tal cual, sin copiarlas.
const sacar = nombre => {
  const i = adm.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('no está ' + nombre);
  let n = 0, dentro = false;
  for (let j = i; j < adm.length; j++) {
    if (adm[j] === '{') { n++; dentro = true; }
    else if (adm[j] === '}') { n--; if (dentro && n === 0) return adm.slice(i, j + 1); }
  }
  throw new Error('no cierra ' + nombre);
};

const ST = { data, statsFilters: {} };
const esc = s => String(s == null ? '' : s);
const ctx = {};
// eslint-disable-next-line no-eval
eval('(function(){' + sacar('buildStatsRows') + sacar('buildBaseAtletas') +
     'ctx.buildStatsRows=buildStatsRows;ctx.buildBaseAtletas=buildBaseAtletas;})()');
const { buildStatsRows, buildBaseAtletas } = ctx;

// La cuenta hecha aparte, directo del data.json, sin pasar por buildStatsRows.
// Si las dos coinciden es que ninguna de las dos se equivocó sola.
const aMano = () => {
  const porAnio = {};
  data.forEach(a => (a.competencias || []).forEach(c => {
    let y = '';
    if (c.fecha) y = String(c.fecha).substring(0, 4);
    else { const m = /20\d{2}/.exec(c.evento || ''); if (m) y = m[0]; }
    const yn = parseInt(y);
    if (!y || yn < 2016 || yn > 2030 || !a.codigo) return;
    (porAnio[yn] = porAnio[yn] || new Set()).add(a.codigo);
  }));
  return porAnio;
};

console.log('\nLa base actual no es la histórica');
const B = buildBaseAtletas();
const M = aMano();
const anios = Object.keys(M).map(Number).sort((a, b) => a - b);
const ult = anios[anios.length - 1], pen = anios[anios.length - 2];
{
  ok(B.anioActual === ult, 'la temporada en curso es la última con resultados: ' + B.anioActual);
  ok(B.anioPrevio === pen, 'y la anterior, ' + B.anioPrevio);

  const historica = new Set();
  anios.forEach(y => M[y].forEach(c => historica.add(c)));
  ok(B.historica === historica.size, 'la histórica son ' + B.historica + ' atletas');

  // Y no es lo mismo que el largo del archivo. Hay fichas con código asignado y
  // cero competencias: gente inscrita que nunca subió a tarima. Ese era parte
  // del problema — esas fichas engordaban el "atletas totales" del panel.
  const sinComp = data.filter(a => !(a.competencias || []).length).length;
  ok(B.registrados === data.length, 'el archivo tiene ' + B.registrados + ' fichas');
  ok(B.sinCompetir === data.length - historica.size,
     B.sinCompetir + ' de esas fichas nunca compitieron y quedan fuera de la histórica');
  ok(B.sinCompetir === sinComp,
     'y son exactamente las que tienen cero competencias cargadas (' + sinComp + ')');

  const actual = new Set([...M[pen], ...M[ult]]);
  ok(B.activos === actual.size, 'la actual son ' + B.activos + ', los de ' + pen + ' y ' + ult);
  ok(B.activos < B.historica,
     'bastantes menos que la histórica — esa era la queja: no son ' + B.historica);
  ok(B.hoy === M[ult].size, ult + ': ' + B.hoy + ' atletas');
  ok(B.ayer === M[pen].size, pen + ': ' + B.ayer + ' atletas');
}

console.log('\n  El movimiento entre las dos temporadas cierra');
{
  ok(B.siguen + B.seFueron === B.ayer,
     'los de ' + B.anioPrevio + ' se parten en los que siguen y los que no volvieron: ' +
     B.siguen + ' + ' + B.seFueron + ' = ' + B.ayer);
  ok(B.siguen + B.nuevos === B.hoy,
     'y los de ' + B.anioActual + ', en los que ya estaban y las caras nuevas: ' +
     B.siguen + ' + ' + B.nuevos + ' = ' + B.hoy);
  ok(B.activos === B.ayer + B.nuevos,
     'la base actual es la anterior más las caras nuevas: ' + B.activos);
  ok(B.retencion === Math.round(B.siguen / B.ayer * 100),
     'la retención es esa división, redondeada: ' + B.retencion + '%');
  ok(B.porAnio.length === anios.length && B.porAnio.every(p => p.n === M[p.anio].size),
     'y el desglose año por año coincide en los ' + anios.length + ' años');
}

console.log('\n  No la mueven los filtros');
{
  // A propósito: es el tamaño de la base, no el del recorte que uno esté mirando.
  // Si respetara los filtros, el número cambiaría al tocar un select y dejaría de
  // ser el dato que se lleva a una reunión.
  const antes = ST.statsFilters;
  ST.statsFilters = { sex: 'F', yearFrom: '2019', yearTo: '2019', div: 'Junior' };
  const conFiltro = buildBaseAtletas();
  ok(conFiltro.historica === B.historica && conFiltro.activos === B.activos,
     'con filtros puestos da lo mismo: ' + conFiltro.activos + ' y ' + conFiltro.historica);
  ST.statsFilters = antes;
}

console.log('\n  Y se dice en pantalla, con las palabras justas');
{
  const i = adm.indexOf('function _baseAtletasHtml');
  const f = adm.slice(i, adm.indexOf('function renderStatsContent'));
  ok(i > 0, 'el bloque existe');
  ok(/BASE ACTUAL/.test(f) && /BASE HIST[ÓO]RICA/.test(f), 'las dos cifras van juntas y separadas');
  ok(/INSCRITOS SIN COMPETIR/.test(f), 'y las fichas que nunca compitieron, aparte');
  ok(/SIGUEN COMPITIENDO/.test(f) && /NO HAN VUELTO/.test(f) && /CARAS NUEVAS/.test(f),
     'y el movimiento entre temporadas');
  ok(/no dependen de los filtros/.test(f), 'y dice que no dependen de los filtros');
  ok(/est[áa] en curso/.test(f),
     'y avisa que la temporada corre: el que "no ha vuelto" todavía puede volver');
  ok(/Nacional a Nacional/.test(f),
     'y deja anotado que el corte correcto es de Nacional a Nacional, cuando haya fecha');
  ok(adm.indexOf('${_baseAtletasHtml()}') > 0, 'y el bloque se dibuja en Estadísticas');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

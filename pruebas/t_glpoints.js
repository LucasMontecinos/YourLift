// Las estadísticas de GL points en el panel.
//
// Los kilos crudos no se pueden comparar entre una mujer de -52 y un hombre de
// -120, ni entre un Sub-Junior y un Master: cada uno levanta contra una vara
// distinta. Los GL points existen justo para eso, y son lo único con lo que se
// pueden mirar juntos el sexo, la división de edad y la modalidad.
//
// Lo que se cuida acá:
//   · que un resultado SIN GL no cuente como cero — hundiría todos los promedios;
//   · que se diga cuántos resultados hay detrás de cada promedio, porque con
//     trece resultados un promedio no significa lo mismo que con mil;
//   · que los que no tienen el sexo cargado no desaparezcan sin avisar;
//   · que respete los mismos filtros que el resto del panel;
//   · y que no toque nada de lo que ya estaba.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_glpoints.js
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

function sacar(texto, nombre) {
  const i = texto.search(new RegExp('(?:^|\\n)function ' + nombre + '\\('));
  if (i < 0) throw new Error('no encontré ' + nombre);
  const start = texto.lastIndexOf('\n', i + 1) + 1;
  let p = start, open = 0, abrio = false;
  while (p < texto.length) {
    const c = texto[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    p++;
  }
  return texto.slice(start, p);
}

// El panel es un módulo ES y no se puede abrir sin Firebase, así que las
// funciones se montan acá con los datos reales.
const ST = { data: JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8')), statsFilters: {},
  corte: { modo: 'cantidad', valor: 10, agrupar: 'cat_div_mod' }, glMin: 0,
  glRankAnios: { desde: '', hasta: '' } };
const GL_RANK_TOPE = 300;
const esc = s => String(s == null ? '' : s);
const GL_ORDEN_DIV = ['Sub-Junior', 'Junior', 'Open', 'Master I', 'Master II', 'Master III', 'Master IV', 'Universitario'];
const FUNCS = ['_hNom', 'buildStatsRows', 'applyStatsFilters', '_glRows', '_glProm', '_glCuartil',
  '_glMediana', '_glResumen', '_glTablaHtml', '_glDispersionHtml', '_glRowsRank', '_glRankingAtletas',
  'renderGLRanking', '_corteTemporada', '_corteFilas', '_corteGrupos', '_corteDe',
  '_corteUnico', 'renderCorte', 'renderGL'];
eval(FUNCS.map(n => sacar(adm, n)).join('\n'));

const todas = applyStatsFilters(buildStatsRows());
const rows = _glRows();

console.log('\nLos GL salen de los resultados de verdad');
{
  ok(rows.length > 500, 'hay con qué comparar: ' + rows.length + ' resultados con GL');
  ok(rows.every(r => r.glp > 0), 'y todos traen un GL de verdad');
  const sinGl = todas.length - rows.length;
  ok(sinGl > 0, 'los ' + sinGl + ' que no lo traen quedan afuera, no entran como cero');
  // Es el punto que más daño haría: contar los sin GL como cero.
  const promConCeros = todas.reduce((s, r) => s + r.glp, 0) / todas.length;
  ok(_glProm(rows) > promConCeros + 5,
     'contarlos como cero bajaría el promedio de ' + _glProm(rows).toFixed(1) +
     ' a ' + promConCeros.toFixed(1) + ' — por eso se excluyen');
}

console.log('\nHombres y mujeres se pueden comparar');
{
  const M = rows.filter(r => r.sexo === 'M'), F = rows.filter(r => r.sexo === 'F');
  ok(M.length > 100 && F.length > 100,
     'hay volumen en los dos: ' + M.length + ' hombres, ' + F.length + ' mujeres');
  ok(_glProm(M) > 0 && _glProm(F) > 0,
     'GL promedio ♂ ' + _glProm(M).toFixed(1) + ' · ♀ ' + _glProm(F).toFixed(1));
}

console.log('\n  Y los que no tienen el sexo cargado no desaparecen en silencio');
{
  const sinSexo = rows.filter(r => r.sexo !== 'M' && r.sexo !== 'F').length;
  const html = _glTablaHtml(rows);
  if (sinSexo) {
    ok(new RegExp(sinSexo.toLocaleString().replace('.', '\\.') + ' resultados no tienen el sexo cargado').test(html),
       'la tabla avisa que hay ' + sinSexo + ' sin sexo');
    ok(/las dos columnas no suman el total/.test(html),
       'y explica por qué las columnas no cuadran');
  } else {
    ok(!/no tienen el sexo cargado/.test(html), 'si están todos, no molesta con el aviso');
  }
}

console.log('\nJunior contra Sub-Junior, y todas las divisiones de edad');
{
  const html = _glTablaHtml(rows);
  const conDatos = GL_ORDEN_DIV.filter(d => rows.some(r => r.div === d));
  ok(conDatos.includes('Sub-Junior') && conDatos.includes('Junior') && conDatos.includes('Open'),
     'están las divisiones que importan: ' + conDatos.join(', '));
  conDatos.forEach(d => ok(html.indexOf('>' + d + '<') > 0, d + ' aparece en la tabla'));
  ok(GL_ORDEN_DIV.indexOf('Sub-Junior') < GL_ORDEN_DIV.indexOf('Junior')
     && GL_ORDEN_DIV.indexOf('Junior') < GL_ORDEN_DIV.indexOf('Open'),
     'y van en orden de edad, no alfabético');
  const sj = rows.filter(r => r.div === 'Sub-Junior'), jr = rows.filter(r => r.div === 'Junior');
  ok(sj.length > 10 && jr.length > 10,
     'la comparación tiene base: Sub-Junior ' + sj.length + ' · Junior ' + jr.length);
}

console.log('\n  Se dice cuántos hay detrás de cada promedio');
{
  // Con trece resultados un promedio no significa lo mismo que con mil, y en la
  // base hay divisiones con un solo resultado.
  const html = _glTablaHtml(rows);
  ok(/con tres o cuatro, el promedio no dice mucho/.test(html),
     'lo advierte con todas las letras');
  const chicas = GL_ORDEN_DIV.filter(d => {
    const n = rows.filter(r => r.div === d).length; return n > 0 && n < 20;
  });
  ok(chicas.length === 0 || chicas.every(d => {
    const n = rows.filter(r => r.div === d && r.sexo === 'M').length;
    return html.indexOf('(' + n + ')') > 0;
  }), 'y cada promedio lleva su número al lado' + (chicas.length ? ' (' + chicas.join(', ') + ' tienen pocos)' : ''));
}

console.log('\nLas modalidades también');
{
  const mods = [...new Set(rows.map(r => r.mod))];
  ok(mods.length >= 2, 'hay más de una para comparar: ' + mods.join(', '));
  mods.forEach(m => {
    const a = rows.filter(r => r.mod === m);
    ok(_glProm(a) > 0, m + ': ' + a.length + ' resultados, GL promedio ' + _glProm(a).toFixed(1));
  });
}

console.log('\nLa pantalla se arma entera');
{
  const html = renderGL();
  const canvas = (html.match(/<canvas id="(\w+)"/g) || []).map(s => s.match(/id="(\w+)"/)[1]);
  ok(canvas.length === 7, 'siete gráficos (' + canvas.length + ')');
  ['glAnioSexo', 'glDist', 'glDiv', 'glMod', 'glDivAnio', 'glModDiv', 'glTop']
    .forEach(id => ok(canvas.includes(id), id));
  // Y cada gráfico se inicializa: un canvas sin su mk() queda en blanco.
  const init = adm.slice(adm.indexOf('function initGLCharts'), adm.indexOf('let _sc={};'));
  canvas.forEach(id => ok(init.indexOf("'" + id + "'") > 0, id + ' se dibuja'));
  ok(/GL PROMEDIO<\/div>/.test(html), 'y arriba van los números gruesos');
  ok(/MEJOR GL/.test(html), 'incluido el mejor GL del filtro');
}

console.log('\n  Sin datos no revienta, avisa');
{
  const guardado = ST.statsFilters;
  ST.statsFilters = { yearFrom: '2099', yearTo: '2099' };
  let revento = false, html = '';
  try { html = renderGL(); } catch (e) { revento = true; }
  ok(!revento, 'con un filtro que no deja nada, no se cae');
  ok(/Ning[úu]n resultado con GL points/.test(html), 'y lo dice en vez de mostrar cuadros vacíos');
  ok(!/<canvas/.test(html), 'sin gráficos que dibujar');
  ST.statsFilters = guardado;
}

console.log('\nUsa los mismos filtros que el resto del panel');
{
  const guardado = ST.statsFilters;
  const total = _glRows().length;
  ST.statsFilters = { sex: 'F' };
  const soloF = _glRows();
  ok(soloF.length > 0 && soloF.length < total, 'filtrando mujeres quedan ' + soloF.length + ' de ' + total);
  ok(soloF.every(r => r.sexo === 'F'), 'y son todas mujeres');
  ST.statsFilters = { div: 'Junior' };
  const soloJr = _glRows();
  ok(soloJr.length > 0 && soloJr.every(r => r.div === 'Junior'),
     'y por división también (' + soloJr.length + ' Junior)');
  ST.statsFilters = guardado;
  ok(_glRows().length === total, 'al sacar el filtro vuelve todo');
}

console.log('\nNo toca nada de lo que ya estaba');
{
  ok(/glp:parseFloat\(c\.resultado\?\.glp\)\|\|0\}/.test(adm),
     'el GL se agrega a la fila, junto al total que ya venía');
  ok(/total:parseFloat\(c\.resultado\?\.total\)\|\|0,/.test(adm),
     'y el total sigue igual');
  ok(/'gl_points'\]/.test(adm), 'el export a CSV ahora también lo lleva');
  // Los GL points dejaron de ser una pestaña aparte: van dentro de Deporte, que
  // es lo que se pidió. Así que se dibujan junto con el resto, no al entrar a
  // una pestaña propia.
  ok(!/tabBtn\('gl','GL POINTS'\)/.test(adm), 'ya no hay una pestaña propia de GL points');
  ok(/\$\{renderGL\(\)\}`;/.test(adm), 'el contenido cuelga de la pantalla de Deporte');
  ok(/else setTimeout\(\(\)=>\{initStatsCharts\(\);initGLCharts\(\);\},0\);/.test(adm),
     'y sus gráficos se montan junto con los de Deporte');
  // Las tres pestañas que ya existían siguen enganchadas.
  ok(/if\(_st==='web'\) setTimeout\(loadWebAnalytics,0\);/.test(adm), 'tráfico web sigue');
  ok(/else if\(_st==='demografia'\) setTimeout\(initDemoCharts,0\);/.test(adm), 'demografía sigue');
  ok(/const tab=ST\.statsTab\|\|'deporte';/.test(adm), 'y deporte sigue siendo la de por defecto');
  // Cada set de gráficos guarda los suyos: si compartieran el mismo objeto, al
  // cambiar de pestaña se destruirían entre ellos.
  ok(/let _glc=\{\};/.test(adm) && /let _sc=\{\};/.test(adm),
     'y cada pestaña guarda sus propios gráficos por separado');
}


console.log('\nLos cuartiles dan lo mismo que una planilla');
{
  // Si los números de acá no calzan con Excel, el primero que rehaga la cuenta
  // por su cuenta va a pensar que el panel está mal.
  const s = _glResumen([1,2,3,4,5,6,7,8,9,10].map(x => ({ glp: x })));
  ok(s.q1 === 3.25, 'Q1 = 3,25 igual que QUARTILE.INC (' + s.q1 + ')');
  ok(s.med === 5.5, 'mediana = 5,5 (' + s.med + ')');
  ok(s.q3 === 7.75, 'Q3 = 7,75 (' + s.q3 + ')');
  ok(s.ric === 4.5, 'y el rango intercuartil es Q3−Q1 = 4,5 (' + s.ric + ')');
  ok(Math.abs(s.desv - 3.0276503) < 1e-6,
     'la desviación es la muestral, con n−1: ' + s.desv.toFixed(4));
  // Con n−1 y no con n: son una muestra de los que compiten, no todos.
  const conN = Math.sqrt([1,2,3,4,5,6,7,8,9,10].reduce((a,x)=>a+(x-5.5)**2,0)/10);
  ok(Math.abs(s.desv - conN) > 0.1, 'no es la poblacional (' + conN.toFixed(4) + ')');
  ok(_glResumen([{ glp: 42 }]).desv === 0, 'con un solo dato no hay dispersión que medir');
  ok(_glResumen([]) === null, 'y sin datos devuelve nada, no un cero engañoso');
}

console.log('\n  El recorte de Tukey sigue separando lo normal de lo excepcional');
{
  // El diagrama de caja se sacó del panel, pero el recorte sigue: el resumen da
  // el mínimo y el máximo DOS veces —el del grupo entero y el del grupo sin las
  // marcas que se salen de la norma— y esa distinción es la que hace que un
  // promedio se pueda leer. Lo que se pasa son marcas reales, casi siempre las
  // mejores, y se cuentan aparte en vez de desaparecer.
  const v = [10,11,12,13,14,15,16,17,18,19,20,90];
  const s = _glResumen(v.map(x => ({ glp: x })));
  ok(s.fuera.includes(90), 'el 90 queda marcado como atípico');
  ok(s.max < 90, 'el máximo del grupo NO llega hasta él (' + s.max + ')');
  ok(s.real.max === 90, 'pero el máximo real se conserva aparte');
  ok(s.real.min === 10 && s.min === 10, 'y abajo, sin atípicos, los dos coinciden');
  const limpio = _glResumen([10,11,12,13,14].map(x => ({ glp: x })));
  ok(limpio.fuera.length === 0, 'sin nada raro, no inventa atípicos');
  ok(limpio.min === 10 && limpio.max === 14, 'y va de punta a punta');
}

console.log('\nEl diagrama de caja y bigote ya no está');
{
  // Se sacó a pedido: la caja se leía mal y los mismos números están escritos en
  // las tablas de dispersión, que es de donde se copian a un informe.
  ok(!/GL_CAJA_PLUGIN/.test(adm), 'no queda el complemento que lo dibujaba');
  ok(!/CAJA Y BIGOTE/.test(adm), 'ni las tarjetas que lo mostraban');
  ok(!/glCajaDiv|glCajaMod/.test(adm), 'ni los lienzos donde se dibujaba');
  ok(!/boxplot|@sgratzl/i.test(adm), 'y nunca se agregó una librería para esto');
  // El panel carga tres librerías (Chart.js, html2canvas y xlsx). Sacar el
  // diagrama no tenía que dejar ninguna colgando sin uso.
  const scripts = (adm.match(/<script src="https:\/\/[^"]+"/g) || []);
  ok(scripts.length === 3,
     'sigue cargando las mismas tres librerías de siempre (' + scripts.length + ')');
  // Las tablas con los mismos números siguen ahí: no se perdió información.
  const html = renderGL();
  ok(/LA DISPERSIÓN, POR DIVISIÓN DE EDAD/.test(html),
     'y los números que acompañaban al dibujo siguen escritos');
}

console.log('\nLos números escritos, no solo el dibujo');
{
  const html = renderGL();
  ok(/DESVIACIÓN ESTÁNDAR/.test(html), 'la desviación está arriba, entre los números gruesos');
  ok(/RANGO INTERCUARTIL/.test(html), 'y el rango intercuartil también');
  const R = _glResumen(_glRows());
  ok(html.indexOf('±' + R.desv.toFixed(1)) > 0, 'con el valor real: ±' + R.desv.toFixed(1));
  ok(html.indexOf(R.ric.toFixed(1)) > 0, 'y el RIC: ' + R.ric.toFixed(1));
  ok(/dos de cada tres, entre/.test(html), 'y se explica qué significa la desviación');
  ok(/la mitad del medio, de/.test(html), 'y qué significa el rango intercuartil');

  ['LA DISPERSIÓN, POR DIVISIÓN DE EDAD', 'LA DISPERSIÓN, POR MODALIDAD', 'LA DISPERSIÓN, POR SEXO']
    .forEach(t => ok(html.indexOf(t) > 0, 'hay tabla: ' + t));
  ['N', 'PROMEDIO', 'DESV.', 'MÍN', 'Q1', 'MEDIANA', 'Q3', 'RIC', 'MÁX', 'ATÍPICOS']
    .forEach(c => ok(new RegExp('>' + c.replace('.', '\\.') + '</th>').test(html), 'columna ' + c));
  ok(/Con menos de una decena de resultados, ninguno de los dos dice gran cosa/.test(html),
     'y advierte cuándo estos números no significan nada');
}


console.log('\nEl ranking sin repetir atleta');
{
  // "¿Cuántos hay en Open con 80 GL o más?" — el ranking corriente no sirve para
  // eso: el que corrió tres veces aparece tres veces y el número sale inflado.
  const guardado = ST.statsFilters;
  ST.statsFilters = {};
  const filas = _glRows().length;
  const atletas = _glRankingAtletas();
  ok(atletas.length < filas,
     filas + ' resultados quedan en ' + atletas.length + ' atletas distintos');
  const claves = atletas.map(r => r.codigo || _hNom(r.nombre));
  ok(new Set(claves).size === claves.length, 'y ninguno aparece dos veces');
  ok(atletas.every((r, i) => i === 0 || atletas[i-1].glp >= r.glp),
     'salen ordenados de mayor a menor GL');

  // Y se queda con la MEJOR marca, no con la primera ni con la última.
  const conVarias = atletas.find(a => _glRows().filter(r => (r.codigo && r.codigo === a.codigo)).length > 2);
  if (conVarias) {
    const suyas = _glRows().filter(r => r.codigo === conVarias.codigo);
    ok(conVarias.glp === Math.max(...suyas.map(r => r.glp)),
       conVarias.nombre + ' tiene ' + suyas.length + ' resultados y se queda con el mejor (' + conVarias.glp.toFixed(1) + ')');
  } else {
    ok(true, 'no hay nadie con varias marcas en este conjunto');
  }
  ST.statsFilters = guardado;
}

console.log('\n  Se puede preguntar por un mínimo, y por división');
{
  const guardado = ST.statsFilters, guardadoMin = ST.glMin;
  ST.statsFilters = { yearFrom: '2026', yearTo: '2026', div: 'Open' };
  const open = _glRankingAtletas();
  const con80 = open.filter(r => r.glp >= 80);
  ok(open.length > 0 && con80.length > 0 && con80.length < open.length,
     'en Open 2026 hay ' + con80.length + ' con 80 GL o más, de ' + open.length);
  ok(con80.every(r => r.div === 'Open' && r.year === '2026'),
     'y son todos de Open y del año pedido');

  ST.glMin = 80;
  const html = renderGLRanking();
  ok(new RegExp('<b[^>]*>' + con80.length + '</b> atletas? con <b>80</b> GL o m[áa]s').test(html),
     'la pantalla dice cuántos son');
  ok(html.indexOf(esc(con80[0].nombre)) > 0, 'y los nombra: primero ' + con80[0].nombre);
  ok(/Cada uno una sola vez, con su mejor marca/.test(html), 'diciendo que no se repiten');
  ok(/RANKING SIN REPETIR ATLETA/.test(html), 'con su título');

  ST.glMin = 999;
  ok(/Ninguno llega a ese m[íi]nimo/.test(renderGLRanking()),
     'y con un mínimo imposible lo dice en vez de mostrar una tabla vacía');
  ST.glMin = guardadoMin; ST.statsFilters = guardado;
}

console.log('\n  El ranking tiene su propio rango de años');
{
  // Para poder mirar una temporada acá sin mover el resto del panel: los
  // gráficos siguen mostrando lo que estaban mostrando.
  const guardado = ST.statsFilters, guardadoRa = ST.glRankAnios;
  ST.statsFilters = {}; ST.glRankAnios = { desde: '', hasta: '' };
  const todos = _glRankingAtletas().length;

  ST.glRankAnios = { desde: '2026', hasta: '2026' };
  const uno = _glRankingAtletas();
  ok(uno.length < todos, 'eligiendo 2026 quedan ' + uno.length + ' de ' + todos);
  ok(uno.every(r => r.year === '2026'), 'y todas las marcas son de ese año');

  ST.glRankAnios = { desde: '2024', hasta: '2026' };
  const tres = _glRankingAtletas();
  ok(tres.length > uno.length, '2024–2026 junta más: ' + tres.length);
  const claves = tres.map(r => r.codigo || _hNom(r.nombre));
  ok(new Set(claves).size === claves.length, 'y juntando tres temporadas nadie se repite');
  ok(tres.every(r => r.year >= '2024' && r.year <= '2026'), 'ninguna marca se sale del rango');

  ST.glRankAnios = { desde: '2026', hasta: '' };
  ok(_glRankingAtletas().every(r => r.year >= '2026'), 'con solo "desde", corta por abajo');
  ST.glRankAnios = { desde: '', hasta: '2020' };
  ok(_glRankingAtletas().every(r => r.year <= '2020'), 'y con solo "hasta", por arriba');

  console.log('\n    Y manda por sobre el filtro de años de arriba');
  ST.statsFilters = { yearFrom: '2022', yearTo: '2022' };
  ST.glRankAnios = { desde: '2026', hasta: '2026' };
  const r = _glRankingAtletas();
  ok(r.length > 0 && r.every(x => x.year === '2026'),
     'con el filtro global en 2022 y el del ranking en 2026, manda el del ranking');
  ok(ST.statsFilters.yearFrom === '2022' && ST.statsFilters.yearTo === '2022',
     'y el filtro global queda intacto: no se le mueve al resto del panel');

  console.log('\n    Pero los demás filtros sí se respetan');
  ST.statsFilters = { div: 'Open', sex: 'F' };
  ST.glRankAnios = { desde: '2026', hasta: '2026' };
  const of = _glRankingAtletas();
  ok(of.length > 0 && of.every(x => x.div === 'Open' && x.sexo === 'F' && x.year === '2026'),
     'Open + mujeres + 2026: ' + of.length + ' atletas');

  console.log('\n    Y un rango al revés no rompe nada');
  ST.statsFilters = {};
  ST.glRankAnios = { desde: '2026', hasta: '2020' };
  let revento = false;
  try { _glRankingAtletas(); renderGLRanking(); } catch (e) { revento = true; }
  ok(!revento, 'no se cae');
  ok(/Ninguno llega|0<\/b> atletas/.test(renderGLRanking()) || _glRankingAtletas().length === 0,
     'simplemente no hay nadie en ese rango');

  ST.glRankAnios = { desde: '2026', hasta: '2026' };
  const html = renderGLRanking();
  ok(/updGlRankAnio\('desde'/.test(html) && /updGlRankAnio\('hasta'/.test(html),
     'los dos selectores están en la pantalla');
  ok(/Todos los años/.test(html), 'con un botón para volver atrás');
  // El selector ofrece TODOS los años, no solo los del filtro puesto: si no, al
  // elegir 2026 desaparecerían los demás y no habría cómo volver.
  const anios = [...new Set(buildStatsRows().map(x => x.year))].filter(Boolean);
  ok(anios.every(y => html.indexOf('value="' + y + '"') > 0),
     'y ofrece los ' + anios.length + ' años que existen, no solo el elegido');

  ST.statsFilters = guardado; ST.glRankAnios = guardadoRa;
}

console.log('\nEl simulador del corte para el Nacional');
{
  const guardado = ST.statsFilters, guardadoCorte = ST.corte;
  ST.statsFilters = {};              // así se abre: sin tocar nada
  ST.corte = { modo: 'cantidad', valor: 10, agrupar: 'cat' };
  const grupos = _corteGrupos();
  ok(grupos.length > 5, 'arma los grupos: ' + grupos.length + ' categorías');
  grupos.forEach(g => {
    const claves = g.atletas.map(r => r.codigo || _hNom(r.nombre));
    if (new Set(claves).size !== claves.length) ok(false, 'se repite alguien en ' + g.label);
  });
  ok(true, 'y dentro de cada grupo nadie se repite');

  const grande = grupos[0];
  const x = _corteDe(grande);
  ok(x.dentro >= 10, grande.label + ': con un objetivo de 10 clasifican ' + x.dentro);
  ok(grande.atletas.filter(a => a.glp >= x.min).length === x.dentro,
     'y el mínimo de ' + x.min.toFixed(1) + ' es exactamente el que deja pasar a esos');
  ok(grande.atletas[x.dentro - 1].glp >= x.min, 'el último que entra llega al mínimo');
  ok(x.dentro === grande.n || grande.atletas[x.dentro].glp < x.min,
     'y el primero que queda fuera no lo alcanza');

  // Si el grupo tiene menos gente que el objetivo, clasifican todos y no se
  // inventa un corte imposible.
  const chico = grupos[grupos.length - 1];
  if (chico.n < 10) {
    const y = _corteDe(chico);
    ok(y.dentro === chico.n, chico.label + ' tiene ' + chico.n + ': clasifican todos, sin romperse');
  } else { ok(true, 'no hay grupos por debajo del objetivo'); }

  // Por porcentaje tiene que dar menos gente que por cantidad, con estos datos.
  ST.corte = { modo: 'porcentaje', valor: 30, agrupar: 'cat' };
  const porPct = _corteGrupos().reduce((s, g) => s + _corteDe(g).dentro, 0);
  ST.corte = { modo: 'cantidad', valor: 10, agrupar: 'cat' };
  const porCant = _corteGrupos().reduce((s, g) => s + _corteDe(g).dentro, 0);
  ok(porPct !== porCant, 'el 30% deja ' + porPct + ' y los 10 mejores dejan ' + porCant);

  // Un solo mínimo para todos: mismo total, reparto distinto.
  const u = _corteUnico(grupos, porCant);
  ok(u && u.total >= porCant - 2 && u.total <= porCant + 2,
     'un mínimo único de ' + u.min.toFixed(1) + ' deja un total parecido (' + u.total + ')');
  ok(u.maximo > u.minimo, 'pero reparte muy distinto: de ' + u.minimo + ' a ' + u.maximo + ' por grupo');

  const html = renderCorte();
  ok(/EL MÍNIMO DE CADA GRUPO/.test(html), 'la tabla está');
  ok(/Calculado sobre la temporada <b>\d{4}<\/b>/.test(html), 'y dice sobre qué temporada está calculando');
  ok(/Cada atleta cuenta una vez/.test(html), 'y que no se cuentan resultados repetidos');
  ok(/updCorte\('modo'/.test(html) && /updCorte\('valor'/.test(html) && /updCorte\('agrupar'/.test(html),
     'los tres controles se pueden mover');
  ok(!/setDoc|updateDoc|deleteDoc/.test(adm.slice(adm.indexOf('function renderCorte'), adm.indexOf('window.updCorte'))),
     'y es solo un simulador: no escribe nada en ninguna parte');
  ST.statsFilters = guardado; ST.corte = guardadoCorte;
}

console.log('\n  El corte es de la temporada en curso, no de todo el historial');
{
  // Un mínimo para clasificar al Nacional se saca de lo que se corrió ESTE año.
  // Antes, al abrir la pestaña sin tocar nada, calculaba sobre todo el historial
  // —diez temporadas juntas— y los mínimos no querían decir nada.
  const guardado = ST.statsFilters, guardadoCorte = ST.corte;
  ST.corte = { modo: 'cantidad', valor: 10, agrupar: 'cat' };
  ST.statsFilters = {};
  const t = _corteTemporada();
  const enCurso = String(new Date().getFullYear());
  ok(t.anio === enCurso || t.fuente === 'ultima',
     'al abrirla toma ' + t.anio + (t.fuente === 'curso' ? ', el año en curso' : ', la última con datos'));
  const anios = [...new Set(_corteFilas().map(r => r.year))];
  ok(anios.length === 1 && anios[0] === t.anio,
     'y solo entran resultados de esa temporada (' + anios.join(', ') + ')');
  ok(_corteFilas().length < _glRows().length,
     'no todo el historial: ' + _corteFilas().length + ' de ' + _glRows().length + ' resultados');
  const html = renderCorte();
  ok(!/temporadas juntas/.test(html), 'así que ya no hace falta advertir nada');
  if (t.fuente === 'curso') ok(/\(el año en curso\)/.test(html), 'y lo dice en pantalla');
  else ok(/todavía no hay resultados cargados/.test(html), 'o avisa que usó la última con datos');

  // Si el operador pone un rango a mano, manda él — pero se le avisa.
  ST.statsFilters = { yearFrom: '2025', yearTo: '2026' };
  ok(_corteTemporada().fuente === 'filtro', 'con el filtro puesto, manda el filtro');
  ok([...new Set(_corteFilas().map(r => r.year))].length === 2, 'y entran las dos temporadas');
  ok(/Estás usando el filtro de años/.test(renderCorte()),
     'avisando que se salió de la temporada en curso');
  ST.statsFilters = guardado; ST.corte = guardadoCorte;
}

console.log('\n  Cambiar un filtro no te saca de la pestaña en la que estás');
{
  // Antes updStatsFilter siempre redibujaba la de Deporte: si estabas en otra
  // pestaña y tocabas un filtro, te cambiaba de pantalla.
  const f = adm.slice(adm.indexOf('window.updStatsFilter'), adm.indexOf('window.updCorte'));
  ok(/const tab=ST\.statsTab\|\|'deporte';/.test(f), 'mira en qué pestaña estás');
  ['corte', 'demografia'].forEach(t =>
    ok(new RegExp("tab==='" + t + "'").test(f), 'y respeta ' + t));
  ok(/initStatsCharts\(\);initGLCharts\(\);/.test(f),
     'y al volver a dibujar Deporte redibuja también sus GL points');
}

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

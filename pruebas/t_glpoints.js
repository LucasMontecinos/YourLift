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
const ST = { data: JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8')), statsFilters: {} };
const esc = s => String(s == null ? '' : s);
const GL_ORDEN_DIV = ['Sub-Junior', 'Junior', 'Open', 'Master I', 'Master II', 'Master III', 'Master IV', 'Universitario'];
const FUNCS = ['buildStatsRows', 'applyStatsFilters', '_glRows', '_glProm', '_glCuartil',
  '_glMediana', '_glResumen', '_glTablaHtml', '_glDispersionHtml', 'renderGL'];
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
  ok(canvas.length === 9, 'nueve gráficos (' + canvas.length + ')');
  ['glAnioSexo', 'glDist', 'glCajaDiv', 'glCajaMod', 'glDiv', 'glMod', 'glDivAnio', 'glModDiv', 'glTop']
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
  ok(/tabBtn\('gl','GL POINTS'\)/.test(adm), 'la pestaña está en su lugar');
  ok(/else if\(_st==='gl'\) setTimeout\(initGLCharts,0\);/.test(adm),
     'y sus gráficos se dibujan al entrar');
  // Las tres pestañas que ya existían siguen enganchadas.
  ok(/if\(_st==='web'\) setTimeout\(loadWebAnalytics,0\);/.test(adm), 'tráfico web sigue');
  ok(/else if\(_st==='demografia'\) setTimeout\(initDemoCharts,0\);/.test(adm), 'demografía sigue');
  ok(/else setTimeout\(initStatsCharts,0\);/.test(adm), 'y deporte sigue siendo la de por defecto');
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

console.log('\n  Los bigotes cortan donde corresponde, y lo de más allá no se pierde');
{
  // Criterio de Tukey: el bigote llega al dato más lejano que siga dentro de una
  // vez y media el rango intercuartil. Lo que se pasa son marcas reales —casi
  // siempre las mejores— y tienen que verse, no desaparecer.
  const v = [10,11,12,13,14,15,16,17,18,19,20,90];
  const s = _glResumen(v.map(x => ({ glp: x })));
  ok(s.fuera.includes(90), 'el 90 queda marcado como atípico');
  ok(s.max < 90, 'el bigote NO llega hasta él (' + s.max + ')');
  ok(s.real.max === 90, 'pero el máximo real se conserva aparte');
  ok(s.real.min === 10 && s.min === 10, 'y abajo, sin atípicos, el bigote llega al mínimo');
  const limpio = _glResumen([10,11,12,13,14].map(x => ({ glp: x })));
  ok(limpio.fuera.length === 0, 'sin nada raro, no inventa atípicos');
  ok(limpio.min === 10 && limpio.max === 14, 'y los bigotes van de punta a punta');
}

console.log('\nLos diagramas de caja se dibujan con lo que ya está cargado');
{
  // Chart.js no trae caja y bigote. En vez de sumar otra librería de un CDN a un
  // panel que se usa en competencia, la caja es una barra flotante de Q1 a Q3 y
  // un complemento le dibuja encima los bigotes, la mediana y los atípicos.
  ok(!/boxplot|@sgratzl/i.test(adm), 'no se agregó ninguna librería nueva');
  // El panel ya cargaba tres librerías (Chart.js, html2canvas y xlsx). Lo que
  // importa es que los diagramas de caja no sumaron una cuarta.
  const scripts = (adm.match(/<script src="https:\/\/[^"]+"/g) || []);
  ok(scripts.length === 3,
     'sigue cargando las mismas tres librerías de siempre (' + scripts.length + ')');
  ok(/const GL_CAJA_PLUGIN=\{/.test(adm), 'el complemento está escrito acá');
  ok(/data:cajas\[i\]\.map\(r=>r\?\[r\.q1,r\.q3\]:null\)/.test(adm),
     'la caja va de Q1 a Q3');

  // Se ejecuta de verdad contra un lienzo de mentira: así se comprueba que dibuja
  // los bigotes, la mediana y los atípicos, y que no revienta con un grupo vacío.
  const plug = eval('(' + adm.slice(adm.indexOf('const GL_CAJA_PLUGIN={') + 'const GL_CAJA_PLUGIN='.length,
                                    adm.indexOf('let _glc={};')).trim().replace(/;\s*$/, '') + ')');
  const trazos = [];
  const ctx = {
    save(){}, restore(){}, beginPath(){ trazos.push({ tipo: 'path', pts: [] }); },
    moveTo(x,y){ trazos[trazos.length-1].pts.push(['m',x,y]); },
    lineTo(x,y){ trazos[trazos.length-1].pts.push(['l',x,y]); },
    stroke(){ trazos[trazos.length-1].hecho = true; },
    arc(x,y){ trazos.push({ tipo: 'punto', x, y }); }, fill(){},
    set strokeStyle(v){}, set lineWidth(v){}, set fillStyle(v){},
  };
  const r = _glResumen([10,11,12,13,14,15,16,17,18,19,20,90].map(x => ({ glp: x })));
  const chart = {
    ctx, $cajas: [[r, null]],
    scales: { y: { getPixelForValue: v => 400 - v * 2 } },
    data: { datasets: [{ borderColor: '#fff' }] },
    getDatasetMeta: () => ({ hidden: false, data: [{ x: 100, width: 30 }, { x: 200, width: 30 }] }),
  };
  let revento = false;
  try { plug.afterDatasetsDraw(chart); } catch (e) { revento = true; console.log('    ' + e.message); }
  ok(!revento, 'el complemento corre sin caerse');
  const paths = trazos.filter(t => t.tipo === 'path' && t.hecho);
  const puntos = trazos.filter(t => t.tipo === 'punto');
  ok(paths.length === 2, 'dibuja los bigotes y la mediana (' + paths.length + ' trazos)');
  const ys = paths[0].pts.map(p => p[2]);
  ok(ys.includes(400 - r.max * 2) && ys.includes(400 - r.min * 2),
     'los bigotes llegan hasta donde cortan los datos, no hasta el atípico');
  ok(puntos.length === r.fuera.length && puntos.length === 1,
     'y el atípico se dibuja como punto suelto');
  ok(paths[1].pts.every(p => p[2] === 400 - r.med * 2), 'la mediana va a su altura');

  // El segundo grupo del lienzo falso viene vacío: no puede tumbar el dibujo.
  ok(!revento, 'un grupo sin datos no rompe nada');
  chart.$cajas = null;
  let revento2 = false;
  try { plug.afterDatasetsDraw(chart); } catch (e) { revento2 = true; }
  ok(!revento2, 'y si el gráfico no es de caja, el complemento se aparta');
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

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

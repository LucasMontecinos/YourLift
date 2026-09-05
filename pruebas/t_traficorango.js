// Tráfico web con rango de fechas, como en Analytics pero adentro del panel.
//
// El contador propio guarda un documento POR DÍA en Firestore, así que puede
// responder cualquier rango sin pedirle nada a nadie. Antes mostraba tres cifras
// fijas —hoy, 7 días, 30 días— y para comparar un mes contra otro había que
// bajar el CSV y abrirlo en una planilla.
//
// Lo que se cuida acá:
//
//   · Que los botones de rango calculen las fechas correctas, incluida la
//     frontera de mes, que es donde estas cuentas se equivocan: "mes pasado" el
//     día 1, o un rango que cruza de un año al otro.
//   · Que las cifras, el gráfico, las páginas y el CSV miren TODOS el mismo
//     rango. Si el gráfico queda clavado en 30 días mientras las cifras dicen
//     "este mes", el panel se contradice solo y uno no sabe cuál creer.
//   · Que la comparación con el período anterior sea de igual largo, y que no se
//     invente un porcentaje cuando no hay con qué comparar.
//
// Lo que este panel NO es: no es Google Analytics. Analytics mide con otra vara
// —sesiones, no visitas— y trae el histórico anterior a este contador. Por eso su
// foto sigue abajo, aparte y fechada, en vez de mezclar dos formas de contar en
// el mismo número.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_traficorango.js
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

// Se saca del panel el trozo que calcula los rangos y se ejecuta tal cual, para
// no tener una copia que pueda ir divergiendo de lo que corre de verdad.
const trozo = adm.slice(adm.indexOf('const _WEB_RANGOS='), adm.indexOf('window.webSetRango='));
const ST = { webRango: { k: '30' } };
// Se ejecuta en su propio ámbito y se devuelven las funciones, para no chocar
// con nombres de acá.
const { _ymd, _webRango, _webEnRango, _webAnterior, _WEB_RANGOS } =
  new Function('ST', trozo + '\nreturn {_ymd,_webRango,_webEnRango,_webAnterior,_WEB_RANGOS};')(ST);

const hoy = new Date();
const ymd = _ymd;
const menos = n => { const d = new Date(hoy); d.setDate(hoy.getDate() - n); return ymd(d); };

console.log('\nLos botones calculan las fechas que dicen');
{
  ST.webRango = { k: '7' };
  let r = _webRango();
  ok(r.hasta === ymd(hoy), '7 días termina hoy');
  ok(r.desde === menos(6), 'y empieza hace 6 días — son 7 contando hoy');

  ST.webRango = { k: '30' };
  r = _webRango();
  ok(r.desde === menos(29), '30 días empieza hace 29');

  ST.webRango = { k: '90' };
  r = _webRango();
  ok(r.desde === menos(89), 'y 90 hace 89');

  ST.webRango = { k: 'todo' };
  r = _webRango();
  ok(r.desde === '0000-01-01' && r.hasta === ymd(hoy), '"todo" no deja nada afuera');
}

console.log('\n  Los meses, que es donde estas cuentas se equivocan');
{
  ST.webRango = { k: 'mes' };
  let r = _webRango();
  ok(/-01$/.test(r.desde), 'este mes empieza el día 1: ' + r.desde);
  ok(r.desde.slice(0, 7) === ymd(hoy).slice(0, 7), 'y es el mes de hoy');
  ok(r.hasta === ymd(hoy), 'hasta hoy, no hasta fin de mes: los días que faltan no existen todavía');

  ST.webRango = { k: 'ant' };
  r = _webRango();
  const m = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  ok(r.desde === ymd(m), 'el mes pasado empieza el 1 de ese mes: ' + r.desde);
  const finAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  ok(r.hasta === ymd(finAnt), 'y termina el último día de ese mes: ' + r.hasta);
  ok(r.desde < r.hasta, 'el mes pasado es un mes entero, no un día suelto');
  // El caso que se rompe si uno resta 30 días en vez de usar meses de verdad:
  // febrero, y el paso de enero a diciembre del año anterior.
  ok(new Date(r.hasta + 'T00:00:00').getMonth() === m.getMonth(),
     'y los dos extremos caen en el MISMO mes, aunque tenga 28 o 31 días');
}

console.log('\n  Un rango escrito a mano manda sobre los botones');
{
  ST.webRango = { k: 'libre', desde: '2026-03-01', hasta: '2026-03-15' };
  const r = _webRango();
  ok(r.desde === '2026-03-01' && r.hasta === '2026-03-15', 'se respeta tal cual');
  ok(r.libre === true, 'y queda marcado como elegido a mano');
}

console.log('\n  Se cuentan los días de adentro del rango, y solo esos');
{
  const days = [];
  for (let i = 0; i < 40; i++) days.push({ date: menos(39 - i), total: 10, unique: 4, pages: {}, refs: {} });
  ST.webRango = { k: '7' };
  const r = _webRango();
  const en = _webEnRango(days, r);
  ok(en.length === 7, '7 días de datos para un rango de 7 (' + en.length + ')');
  ok(en[en.length - 1].date === ymd(hoy), 'el último es hoy');
  ok(en.every(d => d.date >= r.desde && d.date <= r.hasta), 'ninguno se sale de los bordes');
}

console.log('\n  La comparación con el período anterior es del mismo largo');
{
  const days = [];
  for (let i = 0; i < 40; i++) days.push({ date: menos(39 - i), total: 10, unique: 4, pages: {}, refs: {} });
  ST.webRango = { k: '7' };
  const r = _webRango();
  const prev = _webAnterior(days, r);
  ok(prev && prev.length === 7, 'el período anterior también tiene 7 días (' + (prev || []).length + ')');
  ok(prev && prev[prev.length - 1].date < r.desde, 'y termina justo antes de que empiece el actual');
  ok(prev && prev.every(d => !_webEnRango(days, r).some(x => x.date === d.date)),
     'sin superponerse: un día no puede contar en los dos');

  ST.webRango = { k: 'todo' };
  ok(_webAnterior(days, _webRango()) === null,
     'contra "todo" no hay período anterior, y no se inventa uno');
}

console.log('\n  Todo el panel mira el mismo rango');
{
  // Si las cifras dicen "este mes" y el gráfico sigue clavado en 30 días, el
  // panel se contradice solo. Esto es lo que estaba mal antes.
  const graf = adm.slice(adm.indexOf('function initWebCharts'), adm.indexOf('window.exportWebCSV'));
  ok(/const R=_webRango\(\)/.test(graf) && /_webEnRango\(days,R\)/.test(graf),
     'el gráfico de visitas por día usa el rango elegido');
  ok(!/days\.slice\(-30\)/.test(graf), 'y ya no está clavado en los últimos 30 días');
  ok(/last\.forEach\(d=>Object\.entries\(d\.pages/.test(graf),
     'las páginas más vistas también');
  ok(/last\.forEach\(d=>Object\.entries\(d\.refs/.test(graf), 'y el origen del tráfico');

  const csv = adm.slice(adm.indexOf('window.exportWebCSV'), adm.indexOf('window.exportWebCSV') + 900);
  ok(/_webEnRango\(window\._WEB_DAYS/.test(csv),
     'el CSV baja lo que se está mirando, no el archivo entero');
  ok(/R\.desde/.test(csv) && /R\.hasta/.test(csv), 'y el nombre del archivo dice qué rango trae');
}

console.log('\n  Los siete botones están, y el de fechas a mano');
{
  const ks = _WEB_RANGOS.map(r => r.k);
  ok(ks.length === 7, ks.length + ' rangos: ' + ks.join(', '));
  ['7', '30', '60', '90', 'mes', 'ant', 'todo'].forEach(k =>
    ok(ks.includes(k), '  · ' + k));
  ok(/window\.webSetFecha=/.test(adm), 'y se puede escribir un desde/hasta cualquiera');
}

console.log('\n  La foto de Google Analytics sigue siendo eso: una foto');
{
  // No se mezcla con el contador propio. Analytics mide sesiones, el contador
  // mide visitas, y la foto cubre meses que el contador no alcanzó a medir.
  ok(/renderGAFoto/.test(adm), 'se sigue mostrando aparte');
  ok(/No se actualiza sola/.test(adm), 'diciendo que no se actualiza sola');
  ok(/tomada:/.test(adm), 'y con la fecha en que se tomó');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

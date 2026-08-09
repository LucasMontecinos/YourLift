// Orden de la tabla de COMPETENCIA EN VIVO (la que ve el público).
//
// El problema: los primeros intentos salían de menor a mayor y por lote, pero
// apenas un atleta daba válido y declaraba el segundo, se iba al final de la lista
// y ahí se quedaba hasta que terminara la ronda. Recién ahí se ordenaba todo de
// golpe. En pantalla parecía que el orden de salida se rompía.
//
// Lo que tiene que pasar: adelante los que todavía deben el intento de la ronda
// (de menor a mayor, y a igual peso el lote más chico), y detrás los que ya
// levantaron, ordenados entre ellos por el peso que acaban de declarar. Y bajo el
// intento del que acaba de salir a tarima, un cartelito.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_ordenvivo.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

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

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

global.window = global;
const DATA = { lift: 'sq', round: 0, flight: 'A', forcedCurrent: null, athletes: [] };
global.DATA = DATA;
eval(sacar('_proxPeso'));
eval(sacar('_cmpProx'));
eval(sacar('_ultimoEnTarima'));
eval(sacar('_mk4clone'));
eval(sacar('liftQueue'));

// ── La tanda OE del Sudamericano, en el momento que describió el usuario ──────
// Van corriendo los primeros intentos de sentadilla. Ya salieron Gallardo,
// Camargo, Tapia y Brito (en ese orden, de menor a mayor peso) y los cuatro
// declararon su segundo. Faltan por salir Chinchia y Gutiérrez.
const nueve = () => ({ sq: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                       bp: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                       dl: [{w:0,r:null},{w:0,r:null},{w:0,r:null}] });
function at(id, name, lot, sq1, r1, sq2) {
  const a = { id, name, lot, flight: 'A', bombed: false, att: nueve() };
  a.att.sq[0] = { w: sq1, r: r1 };
  if (sq2) a.att.sq[1] = { w: sq2, r: null };
  DATA.athletes.push(a);
  return a;
}
at(1, 'Camargo Contreras Ivan Rafael', 1, 195, 'g', 210);
at(2, 'Gallardo Celsa Cristian',       2, 190, 'g', 205);
at(3, 'Tapia Inda Joaquin Alfonso',    3, 198, 'g', 225);
at(4, 'Brito Peralta Edmundo Alberto', 4, 200, 'g', 215);
at(5, 'Chinchia Calvo Daniel Andres',  5, 202.5, null);   // todavía no sale
at(6, 'Gutierrez Ortega Alexi Rafael', 6, 204,   null);   // todavía no sale

// El orden que arma renderLiveView: primero la cola de la ronda, después el resto.
function ordenPantalla() {
  const q = liftQueue();
  const enCola = new Set(q.map(a => a.id));
  const flight = DATA.athletes.filter(a => a.flight === DATA.flight);
  return [
    ...q,
    ...flight.filter(a => !enCola.has(a.id) && !a.bombed).sort(_cmpProx),
    ...flight.filter(a => a.bombed),
  ].map(a => a.name.split(' ')[0]);
}

console.log('\nEl orden en pantalla es el que pidió el usuario');
const esperado = ['Chinchia', 'Gutierrez', 'Gallardo', 'Camargo', 'Brito', 'Tapia'];
const real = ordenPantalla();
ok(JSON.stringify(real) === JSON.stringify(esperado), real.join(' · '));

console.log('\nLos que ya levantaron se acomodan por su segundo intento');
ok(_proxPeso(DATA.athletes[1]) === 205, 'Gallardo va con 205');
ok(_proxPeso(DATA.athletes[0]) === 210, 'Camargo va con 210');
ok(real.indexOf('Gallardo') < real.indexOf('Camargo'), 'y 205 sale antes que 210');

console.log('\nEl que todavía no declara el segundo queda al final');
DATA.athletes[2].att.sq[1] = { w: 0, r: null };   // Tapia no declaró nada
ok(_proxPeso(DATA.athletes[2]) === 0, 'sin peso declarado, _proxPeso da 0');
ok(ordenPantalla().pop() === 'Tapia', 'y va último, no adelante');
DATA.athletes[2].att.sq[1] = { w: 225, r: null };

console.log('\nA igual peso manda el lote más chico, como en la tarima');
DATA.athletes[0].att.sq[1].w = 205;               // Camargo empata con Gallardo
const empate = ordenPantalla();
ok(empate.indexOf('Camargo') < empate.indexOf('Gallardo'),
   'lote 1 antes que lote 2 con los dos en 205: ' + empate.join(' · '));
DATA.athletes[0].att.sq[1].w = 210;

console.log('\nLa cola de la ronda no se toca: sigue mandando el peso del intento');
const q = liftQueue().map(a => a.name.split(' ')[0]);
ok(JSON.stringify(q) === JSON.stringify(['Chinchia', 'Gutierrez']),
   'en tarima van los que deben el primero: ' + q.join(' · '));
ok(real[0] === q[0], 'y el primero de la lista es el que está en tarima');

console.log('\nEl que acaba de salir a tarima queda marcado');
const u = _ultimoEnTarima();
ok(!!u, 'se identifica a alguien');
ok(u && u.id === 4, 'es Brito: el intento juzgado más pesado de la ronda (' + (u && u.w) + ' kg)');
ok(u && u.round === 0 && u.lift === 'sq', 'apunta a su primer intento de sentadilla');

console.log('\nSi la ronda recién arranca, se mira la anterior');
DATA.round = 1;
DATA.athletes.forEach(a => { a.att.sq[1] = { w: a.att.sq[1].w || 210, r: null }; });
const u2 = _ultimoEnTarima();
ok(u2 && u2.round === 0 && u2.id === 4, 'sigue marcando a Brito hasta que salga alguien del segundo');
DATA.athletes[1].att.sq[1] = { w: 205, r: 'g' };   // sale Gallardo con su segundo
const u3 = _ultimoEnTarima();
ok(u3 && u3.round === 1 && u3.id === 2, 'y después pasa a Gallardo, en la ronda 2');
DATA.round = 0;

console.log('\nrenderLiveView usa esto de verdad');
const i = src.indexOf('function renderLiveView');
const cuerpo = src.slice(i, src.indexOf('function renderAtletaInfo', i));
ok(/\.sort\(_cmpProx\)/.test(cuerpo), 'ordena a los que ya levantaron con _cmpProx');
ok(/const ultimo = _ultimoEnTarima\(\)/.test(cuerpo), 'calcula quién acaba de salir');
ok(/RECIÉN SALIÓ/.test(cuerpo), 'y dibuja el cartelito bajo su intento');
ok(/ra\.id===ultimo\.id\s*&&\s*l===ultimo\.lift\s*&&\s*j===ultimo\.round/.test(cuerpo),
   'el cartelito va en la celda exacta de ese intento');

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

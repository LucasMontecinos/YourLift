// Tandas de la A a la Z.
//
// El livecast llegaba hasta la F. Un Regional con tres tandas en la mañana, dos en
// la tarde y dos al día siguiente (A B C D E F G) ya se quedaba sin letras: no se
// podía elegir la tanda del atleta ni en "Agregar atleta" ni en la tabla de pesaje,
// y las tandas nuevas quedaban sin color.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_tandas.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
const admin = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

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

// FL_LETTERS y FL_C se declaran juntos, con FL_C como IIFE: se corta el bloque entero.
const ini = src.indexOf('const FL_LETTERS=');
const fin = src.indexOf('})();', ini) + 5;
// Se evalúan dentro de una función y se devuelven: un `const` en un eval no sale
// de su propio ámbito.
const { FL_LETTERS, FL_C } =
  eval('(function(){' + src.slice(ini, fin) + '\nreturn {FL_LETTERS:FL_LETTERS, FL_C:FL_C};})()');

console.log('\nLas 26 letras están');
ok(FL_LETTERS.length === 26, 'hay 26 tandas posibles');
ok(FL_LETTERS[0] === 'A' && FL_LETTERS[25] === 'Z', 'van de la A a la Z');
ok(FL_LETTERS[6] === 'G', 'la G existe (la que faltaba en el Regional Norte)');

console.log('\nCada tanda tiene su color');
const cols = FL_LETTERS.map(L => FL_C[L]);
ok(cols.every(c => /^#[0-9a-f]{6}$/.test(c)), 'todos son HEX de 6 dígitos');
ok(new Set(cols).size === 26, 'los 26 son distintos');
// El HEX importa: en varias pantallas se le pega la transparencia al final.
ok(/^#[0-9a-f]{8}$/.test(FL_C.G + '22'), 'se le puede pegar la transparencia (' + FL_C.G + '22)');

console.log('\nLas seis de siempre no cambian de color');
const antes = { A:'#3b82f6', B:'#f59e0b', C:'#22c55e', D:'#a855f7', E:'#ec4899', F:'#06b6d4' };
ok(Object.keys(antes).every(L => FL_C[L] === antes[L]), 'A a F quedan igual que antes');

console.log('\nEl sorteo de lotes le da su centena a cada tanda');
// lot = número de letra × 100 + posición. G → 700, Z → 2600.
const base = L => (L.charCodeAt(0) - 64) * 100;
ok(base('G') === 700, 'la G arranca en 700');
ok(base('Z') === 2600, 'la Z arranca en 2600');
const rangos = FL_LETTERS.map(L => [base(L), base(L) + 99]);
ok(rangos.every((r, i) => i === 0 || r[0] > rangos[i-1][1]), 'ninguna centena pisa a la anterior');

console.log('\nUn atleta que se muda a una tanda nueva toma lote de ahí');
global.DATA = { lotsGenerated: true, athletes: [] };
// _reubicarLote se apoya en _baseTanda, que traduce la tanda a número: A→100,
// Z→2600, AA→2700. Se saca también, porque acá la función corre suelta y no
// tiene alrededor el resto del livecast.
eval(sacar('_baseTanda'));
eval(sacar('_reubicarLote'));
let id = 0;
'ABCDEFG'.split('').forEach(L => { for (let i = 0; i < 10; i++)
  DATA.athletes.push({ id: ++id, name: L + i, flight: L, lot: base(L) + i }); });
const viajero = DATA.athletes.find(a => a.lot === 104);
viajero.flight = 'G';
ok(_reubicarLote(viajero) === true, 'se le reasigna el lote');
ok(viajero.lot >= 700 && viajero.lot < 800, 'y queda en la G: ' + viajero.lot);
ok(viajero.lot === 710, 'toma el primer lote libre de la G, sin pisar a nadie');
const lotes = DATA.athletes.map(a => a.lot);
ok(new Set(lotes).size === lotes.length, 'no quedan lotes repetidos');

console.log('\nLos desplegables ofrecen las 26');
ok(/const flights=TARIMA\?FL_LETTERS\.map\(L=>L\+TARIMA\):FL_LETTERS\.slice\(\);/.test(src),
   '"Agregar atleta" sale de FL_LETTERS');
ok(/const _flOpts = TARIMA \? FL_LETTERS\.map\(L=>L\+TARIMA\) : FL_LETTERS\.slice\(\);/.test(src),
   'la tabla de pesaje también');
ok(!/\['A','B','C','D','E','F'\]/.test(src), 'no queda ninguna lista cortada en la F');

console.log('\nEl Cronograma del admin va igual hasta la Z');
ok(/const CRONO_FLIGHTS=Array\.from\(\{length:26\}/.test(admin), 'CRONO_FLIGHTS llega a la Z');
ok(!/\['A','B','C','D','E','F'(,'G','H')?\]/.test(admin), 'no queda ninguna lista corta en admin');

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

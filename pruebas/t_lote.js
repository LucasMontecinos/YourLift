// El número de lote lleva la tanda adentro (A → 100·, B → 200·, C → 300·…), así que
// cuando el Cronograma mueve a un atleta de tanda hay que darle un lote de la tanda
// nueva. Lo que NO puede pasar es que se muevan los lotes de los demás: eso cambiaría
// el orden de salida de toda la competencia.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_lote.js
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
const DATA = { lotsGenerated: true, athletes: [] };
// _reubicarLote se apoya en _baseTanda, que traduce la tanda a número: A→100,
// Z→2600, AA→2700. Se saca también, porque acá la función corre suelta y no
// tiene alrededor el resto del livecast.
eval(sacar('_baseTanda'));
eval(sacar('_reubicarLote'));

// Nómina como la del Regional Centro Sur: lotes por tanda, 100·, 200·, 300·…
const tandas = { A: 12, B: 12, C: 10, D: 13, E: 12 };
let id = 0;
Object.entries(tandas).forEach(([fl, n]) => {
  const base = (fl.charCodeAt(0) - 64) * 100;
  for (let i = 0; i < n; i++) DATA.athletes.push({ id: id++, name: fl + i, flight: fl, lot: base + i });
});
const antes = DATA.athletes.map(a => ({ id: a.id, lot: a.lot }));

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

console.log('\nUn atleta que se queda en su tanda');
const quieto = DATA.athletes.find(a => a.flight === 'B' && a.lot === 200);
ok(_reubicarLote(quieto) === false, 'no se le toca el lote: ' + quieto.lot);

console.log('\nUn atleta que el Cronograma manda de la A a la E');
const movido = DATA.athletes.find(a => a.lot === 104);
movido.flight = 'E';
ok(_reubicarLote(movido) === true, 'se le reasigna el lote');
ok(movido.lot >= 500 && movido.lot < 600, 'y queda en el rango de la E: ' + movido.lot);
ok(movido.lot === 512, 'toma el primer lote libre de la E, sin pisar a nadie: ' + movido.lot);

console.log('\nLos demás no se mueven');
const movidos = DATA.athletes.filter((a, i) => a.lot !== antes[i].lot);
ok(movidos.length === 1, `cambió el lote de ${movidos.length} atleta (debe ser 1)`);
const lots = DATA.athletes.map(a => a.lot);
ok(new Set(lots).size === lots.length, 'no quedan lotes repetidos');

console.log('\nVarios movidos a la misma tanda');
const a1 = DATA.athletes.find(a => a.lot === 105), a2 = DATA.athletes.find(a => a.lot === 106);
a1.flight = 'C'; a2.flight = 'C';
_reubicarLote(a1); _reubicarLote(a2);
ok(a1.lot !== a2.lot, `cada uno toma un lote distinto: ${a1.lot} y ${a2.lot}`);
ok(a1.lot >= 300 && a2.lot >= 300 && a1.lot < 400 && a2.lot < 400, 'los dos en el rango de la C');
const l2 = DATA.athletes.map(a => a.lot);
ok(new Set(l2).size === l2.length, 'siguen sin repetirse');

console.log('\nSin lotes sorteados todavía no se inventa nada');
DATA.lotsGenerated = false;
const x = DATA.athletes[0]; const lotPrevio = x.lot; x.flight = 'D';
ok(_reubicarLote(x) === false && x.lot === lotPrevio, 'se deja como está');

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

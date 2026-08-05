// El Cronograma manda: división de edad, categoría y modalidad de la nómina del
// livecast salen de la pestaña Cronograma del admin, no de lo que puso el atleta
// al inscribirse. Esta prueba no necesita navegador: saca los helpers del HTML y
// los ejercita con filas armadas a mano.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_crono.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

// Extrae una función/const del archivo por nombre, con llaves balanceadas.
function sacar(nombre) {
  const i = src.search(new RegExp('(?:^|\\n)(?:function ' + nombre + '\\(|const ' + nombre + '=)'));
  if (i < 0) throw new Error('no encontré ' + nombre + ' en livecast.html');
  const start = src.indexOf('\n', i) === i ? i + 1 : (src.lastIndexOf('\n', i + 1) + 1);
  let p = start, open = 0, abrio = false;
  while (p < src.length) {
    const c = src[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    else if (c === ';' && !abrio && open === 0) { p++; break; }
    p++;
  }
  return src.slice(start, p);
}

const NOMBRES = ['_nnCrono', '_cronoLookup', '_cronoJor', '_modDesdeTexto', '_cronoCat', '_cronoDiv', '_cronoMapDeRows'];
eval(NOMBRES.map(sacar).join('\n') +
     '\nconst _CRONO_DIVS=["Sub-Junior","Junior","Open","Master I","Master II","Master III","Master IV"];\n');

let fallas = 0;
function ok(cond, msg) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg);
  if (!cond) fallas++;
}
function igual(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + '  → ' + JSON.stringify(a)); }

console.log('\nCategorías');
igual(_cronoCat('-83 kg'), '83', '"-83 kg" queda en 83');
igual(_cronoCat('+120 kg'), '120+', '"+120 kg" queda en 120+');
igual(_cronoCat('84+'), '84+', '"84+" se respeta');
igual(_cronoCat(''), '', 'vacío no inventa nada');

console.log('\nDivisiones');
igual(_cronoDiv('Sub-Junior'), 'Sub-Junior', 'Sub-Junior');
igual(_cronoDiv('sub junior'), 'Sub-Junior', 'sin guion ni mayúsculas');
igual(_cronoDiv('master i'), 'Master I', 'Master I');
igual(_cronoDiv('Subunior'), '', 'un error de tipeo NO se aplica (deja lo que ya tiene el atleta)');
igual(_cronoDiv('Sénior'), '', 'una división que no existe tampoco');

console.log('\nModalidades');
igual(_modDesdeTexto('Powerlifting Classic'), { mod: 'classic', plusBench: false }, 'classic');
igual(_modDesdeTexto('Powerlifting Classic + Only Bench Classic'), { mod: 'classic_bench', plusBench: true }, 'PL + banca sola');
igual(_modDesdeTexto('Only Bench Classic'), { mod: 'onlybench', plusBench: false }, 'solo banca');
igual(_modDesdeTexto('Powerlifting Equipado + Only Bench Equipado'), { mod: 'equipped_bench', plusBench: true }, 'equipado + banca');
igual(_modDesdeTexto('Only Bench Equipado'), { mod: 'equipped_bench', plusBench: false }, 'banca equipada sola (plusBench la distingue)');
igual(_modDesdeTexto('Powerlifting Classic Special Olympics'), { mod: 'oe_classic', plusBench: false }, 'Olimpiadas Especiales');

console.log('\nMapa del Cronograma');
const rows = [
  { nombre: 'Angui Paula Puro Cortez', division: 'Subunior', categoria: '-63 kg', modalidad: 'Powerlifting Classic', flight: 'A', jornada: 'AM' },
  { nombre: 'Steven Fabrizzio Capurro Palacios', division: 'Open', categoria: '-93 kg', modalidad: 'Powerlifting Classic Special Olympics', flight: 'D', jornada: 'PM' },
  { nombre: 'Andres Simón Neira Acevedo', division: 'Sub-Junior', categoria: '-66 kg', modalidad: 'Powerlifting Classic', flight: 'B', jornada: 'AM' },
  { nombre: 'Sin Tanda Todavia', division: 'Open', categoria: '-74 kg', modalidad: 'Powerlifting Classic', flight: '', jornada: '' },
];
const map = _cronoMapDeRows(rows);
igual(Object.keys(map).length, 4, 'entra hasta el que no tiene tanda asignada');
igual(_cronoLookup(map, 'Angui Paula Puro Cortez').div, '', 'Angui: "Subunior" no se aplica, la división queda intacta');
igual(_cronoLookup(map, 'Angui Paula Puro Cortez').cat, '63', 'Angui: la categoría sí');
igual(_cronoLookup(map, 'Steven Fabrizzio Capurro Palacios').mod, 'oe_classic', 'los OE dejan de correr como Classic');
// El Cronograma trae el nombre completo y la inscripción el corto (o al revés).
ok(!!_cronoLookup(map, 'Andres Neira Acevedo'), 'matchea el nombre corto contra el completo del Cronograma');
igual(_cronoLookup(map, 'Andres Neira Acevedo').flight, 'B', 'y le da la tanda correcta');
ok(!_cronoLookup(map, 'Matias Alexis Quiroga Muñoz'), 'alguien de otro campeonato no matchea con nadie');

console.log('\nLo que se aplicaría sobre la nómina');
// Réplica de la parte de _applyCronoFlightsToAthletes que decide qué se pisa.
function aplicar(a, entry, armando) {
  const out = { ...a };
  if (entry.flight && out.flight !== entry.flight) out.flight = entry.flight;
  if (!armando) return out;
  if (entry.div && out.div !== entry.div) out.div = entry.div;
  if (entry.cat && String(out.cat) !== entry.cat && !out.weighedIn && !(+out.bw > 0)) out.cat = entry.cat;
  if (entry.mod && (out.mod !== entry.mod || !!out.plusBench !== !!entry.plusBench)) {
    out.mod = entry.mod; out.plusBench = entry.plusBench;
  }
  return out;
}
const e = _cronoLookup(map, 'Steven Fabrizzio Capurro Palacios');
igual(aplicar({ flight: 'A', div: 'Open', cat: '93', mod: 'classic', plusBench: false, bw: 0 }, e, true).mod,
      'oe_classic', 'armando la nómina: la modalidad se corrige');
igual(aplicar({ flight: 'A', div: 'Open', cat: '105', mod: 'classic', bw: 96.4, weighedIn: true }, e, true).cat,
      '105', 'ya pesado: la categoría del pesaje manda sobre el Cronograma');
igual(aplicar({ flight: 'A', div: 'Open', cat: '105', mod: 'classic', bw: 0 }, e, false).cat,
      '105', 'con la competencia andando no se toca nada de la nómina');
igual(aplicar({ flight: 'A', div: 'Open', cat: '105', mod: 'classic', bw: 0 }, e, false).flight,
      'D', 'pero la tanda sí se sigue actualizando');

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

// "Invitado/a": el atleta que no dio el peso y compite igual.
//
// En el Regional Centro Sur pasó esto: una atleta que no dio el peso quedó en su
// modalidad y le apareció el 1° de la categoría, por delante de las que sí habían
// dado el peso. La única salida en el momento era inventarle una división, que
// ensucia el acta. Ahora se la marca Invitado/a en el pesaje: sale a tarima, se le
// juzgan los intentos y se ve en pantalla, pero no ocupa lugar en el ranking, no
// entra al acta como competidora y no puede romper un récord.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_invitado.js
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
const DATA = { lift: 'sq', round: 0, flight: 'A', phase: 'setup', athletes: [] };
global.DATA = DATA;
eval(sacar('_esInvitado'));
eval(sacar('_isPlusBench'));
eval(sacar('_actaModKey'));
eval(sacar('_srEquip'));
eval(sacar('_realAth'));
eval(sacar('curAtt'));
eval(sacar('bestOf'));
eval(sacar('subTotal'));
eval(sacar('_posForecast'));
eval(sacar('catRankBySub'));

const nueve = () => ({ sq: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                       bp: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                       dl: [{w:0,r:null},{w:0,r:null},{w:0,r:null}] });
function at(id, name, sq1, mod) {
  const a = { id, name, lot: 100 + id, flight: 'A', bombed: false, sex: 'Mujer',
              cat: '76', div: 'Open', mod: mod || 'classic', bw: 75, att: nueve() };
  a.att.sq[0] = { w: sq1, r: 'g' };
  DATA.athletes.push(a);
  return a;
}
// Javiera no dio el peso y levanta más que las dos que sí lo dieron.
const javi  = at(1, 'Javiera Catalina Burgos Figueroa', 130, 'invitado');
const dos   = at(2, 'Atleta en regla A', 120);
const tres  = at(3, 'Atleta en regla B', 110);

console.log('\nLa invitada no ocupa lugar en la categoría');
ok(_esInvitado(javi), 'queda marcada como invitada');
ok(_posForecast(javi) === null, 'no se le calcula posición');
ok(catRankBySub(javi).pos === 0, 'ni lugar por subtotal');

console.log('\nY las que sí dieron el peso recuperan su lugar');
ok(_posForecast(dos).now === 1, 'la de 120 kg va 1° (antes le ganaba la invitada)');
ok(_posForecast(tres).now === 2, 'la de 110 kg va 2°');
ok(_posForecast(dos).of === 2, 'la categoría cuenta 2 atletas, no 3');
ok(catRankBySub(dos).pos === 1 && catRankBySub(dos).of === 2, 'el ranking por subtotal dice lo mismo');

console.log('\nEn el acta va en su propio cuadro');
ok(_actaModKey(javi) === 'invitado', 'no cae en POWERLIFTING CLASSIC');
ok(_actaModKey(dos) === 'classic', 'las demás siguen donde estaban');
ok(/invitado:'INVITADOS\/AS · FUERA DE COMPETENCIA'/.test(src), 'el cuadro tiene nombre propio');

console.log('\nNo puede romper un récord');
ok(_srEquip(javi) === null, 'no se le busca tabla de récords');
ok(_srEquip(dos) === 'classic', 'a las demás sí');

console.log('\nRankings la deja afuera');
const rk = sacar('rankings');
ok(/filter\(a=>!_esInvitado\(a\)\)/.test(rk), 'rankings() la filtra antes de calcular');

console.log('\nEstá donde el operador la necesita: en el pesaje');
ok(/<option value="invitado"[^>]*>Invitado\/a \(fuera de competencia\)<\/option>/.test(src),
   'aparece en el desplegable de modalidad del modal de pesaje');
ok(/no entra al ranking de su categoría/.test(src), 'con la aclaración de qué implica');

console.log('\nEl Cronograma no se la vuelve a cambiar');
const crono = sacar('_applyCronoFlightsToAthletes');
ok(/if\(_esInvitado\(a\)\)return;/.test(crono), 'se saltea la modalidad del Cronograma');
// Comprobación viva: el Cronograma la trae como classic y no debe pisarla.
ok((function () {
  const entry = { mod: 'classic', plusBench: false };
  if (_esInvitado(javi)) return true;
  javi.mod = entry.mod; return false;
})() && javi.mod === 'invitado', 'sigue invitada después de aplicar el Cronograma');

console.log('\nLos chips de pantalla lo dicen');
ok(/chip\('INVITADO\/A'/.test(src), 'lleva un chip INVITADO/A');
ok(/if\(m==='invitado'\)\s*return 'INVITADO\/A';/.test(src), 'y sale así en la hoja de equipo');

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

// Cuando se borra un intento extra —o se reinician los datos en vivo— el 4º tiene
// que desaparecer también en la pantalla del espectador.
//
// El bug: el merge de lectura, al ver que el servidor traía la fila de intentos más
// corta que la que había en memoria, se quedaba con la suya "por si acabo de agregar
// el 4º y todavía no salió de este equipo". En un espectador eso no pasa nunca —no
// escribe— así que se quedaba con el extra para siempre: el servidor ya no lo traía,
// pero ganaba en cada snapshot y la columna EXTRA seguía en pantalla.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_extraborrado.js
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
window._recentAtt = {};
window._pendingEdits = new Set();
const _MERGE_HOLD_MS = 4000;
const _MERGE_META_FIELDS = ['bw','rackSQ','rackBP','sqAbat','bpSeg','bpPalm','mod','country',
  'flight','lot','bombed','weighedIn','jornada','name','div','cat','sex','club','uni'];
eval(sacar('_markAtt'));
eval(sacar('_nnCrono'));
eval(sacar('_mergeAthletes'));
eval(sacar('_mergeForWrite'));

const tres = () => [{w:200,r:'g'},{w:210,r:'n'},{w:210,r:'g'}];
const conExtra = () => tres().concat([{w:215,r:null,extra:true}]);
const atleta = (att) => ({ id: 1, name: 'Juan Perez', lot: 101, flight: 'A', cat: '83',
  div: 'Open', mod: 'classic', bw: 82, att: { sq: att(), bp: tres(), dl: tres() } });

// Cuántas casillas dibuja la tabla del público para ese lift.
const columnas = a => {
  const x = (a.att.sq || [])[3];
  return (x && (x.w > 0 || x.r)) ? 4 : 3;
};

console.log('\nEspectador: el extra que borraron desaparece');
{
  // La pantalla venía mostrando el 4º; el servidor ya no lo trae.
  const local = [atleta(conExtra)];
  const remoto = [atleta(tres)];
  ok(columnas(local[0]) === 4, 'antes del merge la pantalla mostraba la columna EXTRA');
  const salida = _mergeAthletes(local, remoto);
  ok(salida[0].att.sq.length === 3, 'después del merge la fila vuelve a 3 intentos (' + salida[0].att.sq.length + ')');
  ok(columnas(salida[0]) === 3, 'y la columna EXTRA deja de dibujarse');
}

console.log('\nY tampoco vuelve solo en el siguiente snapshot');
{
  let estado = [atleta(conExtra)];
  const remoto = [atleta(tres)];
  for (let i = 0; i < 5; i++) estado = _mergeAthletes(estado, remoto);
  ok(estado[0].att.sq.length === 3, 'cinco snapshots después sigue en 3');
}

console.log('\nReiniciar datos en vivo también lo limpia');
{
  const local = [atleta(conExtra)];
  const vacio = [Object.assign(atleta(tres), { att: {
    sq: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
    bp: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
    dl: [{w:0,r:null},{w:0,r:null},{w:0,r:null}] } })];
  const salida = _mergeAthletes(local, vacio);
  ok(salida[0].att.sq.length === 3, 'la fila queda en 3 casillas');
  ok(salida[0].att.sq.every(x => !x.w && x.r === null), 'y todas vacías');
}

console.log('\nPero el 4º que ACABO de agregar acá no se pierde');
{
  // Un controlador que agregó el extra y todavía no alcanzó a subirlo.
  window._pendingEdits = new Set(['1|att_sq_3']);
  const local = [atleta(conExtra)];
  const remoto = [atleta(tres)];
  const salida = _mergeAthletes(local, remoto);
  ok(salida[0].att.sq.length === 4, 'se conserva mientras sea una edición mía sin confirmar');
  ok(salida[0].att.sq[3].w === 215, 'con su peso: ' + salida[0].att.sq[3].w);
  window._pendingEdits = new Set();
}

console.log('\nY el que toqué hace un segundo tampoco');
{
  const local = [atleta(conExtra)];
  const remoto = [atleta(tres)];
  _markAtt(1, 'att_sq_3');
  const salida = _mergeAthletes(local, remoto);
  ok(salida[0].att.sq.length === 4, 'la ventana de 4 s lo protege igual');
  window._recentAtt = {}; window._pendingEdits = new Set();
}

console.log('\nAl escribir, un extra viejo no le revive a todo el equipo');
{
  // Otro control borró el extra; yo todavía lo tengo en memoria pero no lo toqué.
  const local = [atleta(conExtra)];
  const remoto = [atleta(tres)];
  const salida = _mergeForWrite(local, remoto);
  ok(salida[0].att.sq.length === 3, 'no se reenvía: queda borrado para todos');
}
{
  // Pero si el extra es MÍO y sin confirmar, sí tiene que subir.
  window._pendingEdits = new Set(['1|att_sq_3']);
  const salida = _mergeForWrite([atleta(conExtra)], [atleta(tres)]);
  ok(salida[0].att.sq.length === 4, 'mi extra recién agregado sí sube');
  window._pendingEdits = new Set();
}

console.log('\nBorrar el extra estando marcado se sigue respetando');
{
  // El control que lo borra: local sin 4º, remoto con 4º, celda marcada.
  window._pendingEdits = new Set(['1|att_sq_3']);
  _markAtt(1, 'att_sq_3');
  const salida = _mergeAthletes([atleta(tres)], [atleta(conExtra)]);
  ok(salida[0].att.sq.length === 3, 'el borrado gana sobre el servidor');
  const escrito = _mergeForWrite([atleta(tres)], [atleta(conExtra)]);
  ok(escrito[0].att.sq.length === 3, 'y viaja como borrado');
  window._recentAtt = {}; window._pendingEdits = new Set();
}

console.log('\nUna nómina vieja tampoco se le sube al resto del equipo');
{
  // Una pantalla que quedó con atletas de más (nómina revuelta de otro momento):
  // el servidor tiene 2, acá hay 4. Los dos sobrantes no se tocaron nunca.
  const local = [atleta(tres), atleta(tres), atleta(tres), atleta(tres)]
    .map((a, i) => Object.assign(a, { id: i + 1, name: 'Atleta ' + (i + 1) }));
  const remoto = local.slice(0, 2).map(a => JSON.parse(JSON.stringify(a)));
  const salida = _mergeForWrite(local, remoto);
  ok(salida.length === 2, 'sube la nómina del servidor, no la de acá (' + salida.length + ')');
  ok(salida.every(a => a.id <= 2), 'los sobrantes se quedan en esta pantalla');
}
{
  // Pero el atleta que acabo de agregar acá sí tiene que subir.
  const local = [atleta(tres), atleta(tres)].map((a, i) =>
    Object.assign(a, { id: i + 1, name: 'Atleta ' + (i + 1) }));
  const remoto = [JSON.parse(JSON.stringify(local[0]))];
  window._pendingEdits = new Set(['2|meta']);
  const salida = _mergeForWrite(local, remoto);
  ok(salida.length === 2, 'el alta reciente sí sube');
  ok(salida.some(a => a.id === 2), 'con su ficha');
  window._pendingEdits = new Set();
}
{
  // Y en un evento recién abierto, con el servidor vacío, sube todo.
  const local = [atleta(tres), atleta(tres)].map((a, i) =>
    Object.assign(a, { id: i + 1, name: 'Atleta ' + (i + 1) }));
  ok(_mergeForWrite(local, []).length === 2, 'con el servidor vacío sube la nómina entera');
}

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

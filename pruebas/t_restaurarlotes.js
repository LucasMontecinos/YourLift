// Restaurar los lotes desde la hoja de pesaje, y que re-sincronizar no los pierda.
//
// Pasó en el Regional Sur Austral: después de imprimir la hoja de pesaje se
// apretó Re-sincronizar y los lotes cambiaron. Ahora:
//   · En Atletas y Pesaje → Restaurar lotes se pega el texto de la hoja (o una
//     lista "lote nombre") y cada lote vuelve a su atleta, buscando por nombre.
//   · Antes de re-sincronizar o re-sortear se guarda una copia de los lotes, y
//     Restaurar lotes ofrece volver a ella.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_restaurarlotes.js
const src = require('./apoyo/fuente').livecast();

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

eval(sacar('_lotesParse'));
eval(sacar('_lotesPlan'));

console.log('\nLee el texto copiado de la hoja de pesaje');
const hoja = `                     REGIONAL SUR AUSTRAL NOVIEMBRE 2026        02/11/2026
                     HOJA DE PESAJE — TANDA A
    Tarima           Tanda          Lot #        Nombre                     BW   Opener SQ
                       A             100         Paulette Natalia Devaud Roa
                       A             101         Leslye Noemith Faundez Fuentealba
                       B             200         José Tomás Salamanca Ormeño
La firma del atleta confirma conformidad con el pesaje y los primeros intentos declarados.
FECHIPO — Federacion Chilena de Powerlifting                     Pag. 1/4`;
const lista = _lotesParse(hoja);
ok(lista.length === 3, 'tres atletas leídos, sin encabezados ni pie de página (' + lista.length + ')');
ok(lista[0].lot === 100 && lista[0].nombre === 'Paulette Natalia Devaud Roa', 'lote y nombre: ' + JSON.stringify(lista[0]));
ok(_lotesParse('205\tAna Pérez\n206 Luis Soto').length === 2, 'también una lista "lote nombre"');

console.log('\nEmpareja por nombre y arma el plan');
const atl = [
  { id: 1, name: 'Paulette Natalia Devaud Roa', lot: 104, flight: 'A' },
  { id: 2, name: 'Leslye Noemith Faúndez Fuentealba', lot: 101, flight: 'A' },   // con tilde
  { id: 3, name: 'José Salamanca Ormeño', lot: 203, flight: 'B' },               // sin el segundo nombre
  { id: 4, name: 'Otra Atleta Nueva', lot: 202, flight: 'B' },                   // no está en la hoja
];
const p = _lotesPlan(lista, atl);
ok(p.cambios.length === 2 && p.iguales.length === 1, 'cambian 2 y uno ya estaba bien (' + p.cambios.length + '/' + p.iguales.length + ')');
ok(p.cambios.some(c => c.a.id === 3 && c.lot === 200), 'encuentra a "José Salamanca Ormeño" aunque la hoja diga "José Tomás"');
ok(p.fuera.length === 1 && p.fuera[0].id === 4, 'avisa del que está en el campeonato y no en la hoja');
const p2 = _lotesPlan(_lotesParse('300 Nadie Conocido\n100 Paulette Natalia Devaud Roa\n100 Leslye Noemith Faundez Fuentealba'), atl);
ok(p2.sinMatch.length === 1, 'avisa del nombre que no encuentra');
ok(p2.repetidos.length === 1, 'y no usa un lote repetido en la lista');

console.log('\nEstá en Atletas y Pesaje');
ok(/onclick="lotesRestaurarAbrir\(\)"[^>]*>Restaurar lotes</.test(src), 'botón "Restaurar lotes" junto a los de sortear');
ok(/Aplicar '\+p\.cambios\.length\+' cambios/.test(src), 'muestra el plan antes de aplicar');
ok(/window\._forceFullWrite=true;   \/\/ como el sorteo/.test(src), 'y al aplicar se escriben los lotes de todos');

console.log('\nRe-sincronizar y re-sortear guardan una copia antes');
ok(/_lotesRespaldar\('re-sincronización'\);\s*const _lotAntes=/.test(src), 're-sincronizar guarda los lotes antes de tocar nada');
ok(/lote.*al re-sincronizar\. Si no correspondía/.test(src), 'y avisa si cambió alguno');
ok(/_lotesRespaldar\(ya\?'re-sorteo':'sorteo'\);/.test(src), 'sortear y re-sortear guardan la copia');
ok(/lotesUsarRespaldo\(\)/.test(src) && /Volver a los de antes/.test(src), 'y Restaurar lotes ofrece volver a ella');

console.log('\nCambiar un lote a mano por uno ocupado intercambia y sube los dos');
{
  const i = src.indexOf('window.setLot=function');
  const cuerpo = src.slice(i, src.indexOf('\n};', i));
  ok(/other\.lot=a\.lot;[\s\S]*_markAtt\(other\.id,'meta'\)/.test(cuerpo), 'el otro atleta también queda marcado para subir');
}

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

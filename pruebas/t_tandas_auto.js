// Armado automático de tandas, con las reglas del reglamento.
//
// En el Regional Norte el cronograma salió mal y hubo que rehacerlo a mano. La
// causa estaba en el armado automático, que rompía dos reglas:
//
//   1. Un grupo de más de 14 lo cortaba en pedazos de 14. Pero una categoría de
//      peso con su división de edad NO se puede partir: si se parte, la misma
//      premiación queda repartida en dos tandas distintas.
//   2. El mínimo de 8 estaba escrito en el aviso pero no en el código, así que
//      podían quedar tandas de dos personas.
//
// Las reglas, tal como las dicta la comisión técnica:
//   · hombres y mujeres nunca en la misma tanda;
//   · categoría de peso + división de edad va entera en una tanda;
//   · 8 mínimo y 14 máximo de powerlifting por tanda;
//   · los Only Bench no ocupan lugar en ese 14 —suben a tarima una vez— y
//     pueden llevar la tanda hasta 17.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_tandas_auto.js
const fs = require('fs');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Monta cronoAutoDistribute con un panel de mentira.
const bloque = adm.slice(adm.indexOf('window.cronoAutoDistribute=async function(){'),
                         adm.indexOf('window.cronoLoadFromNomina=async function(){'));
const ST = { cronoRows: [] };
const avisos = [];
const showToast = (m, _u, err) => avisos.push({ m, err: !!err });
const cronoSaveDoc = async () => {};
const render = () => {};
const confirm = () => true;
const console2 = console;
const window = {};
// eslint-disable-next-line no-eval
eval(bloque);
const armar = async filas => { ST.cronoRows = filas; avisos.length = 0; await window.cronoAutoDistribute(); return ST.cronoRows; };

const at = (sexo, division, categoria, modalidad, n) =>
  Array.from({ length: n }, (_, i) => ({
    nombre: `${sexo}${categoria}${division}-${i + 1}`, sexo, division, categoria,
    modalidad: modalidad || 'Powerlifting Classic', tarima: '', flight: '', jornada: '',
  }));

const porTanda = filas => {
  const t = {};
  filas.forEach(r => { (t[r.flight] = t[r.flight] || []).push(r); });
  return t;
};
const esBench = m => /bench|banca/i.test(m || '') && !/powerlifting/i.test(m || '');
const nPL = g => g.filter(r => !esBench(r.modalidad)).length;

(async () => {

console.log('\nUna categoría con su división NO se parte');
{
  // 18 hombres en -74 Junior. Antes salían dos tandas de 14 y 4.
  const filas = await armar(at('H', 'Junior', '-74 kg', null, 18));
  const t = porTanda(filas);
  const conJunior74 = Object.values(t).filter(g => g.some(r => r.categoria === '-74 kg' && r.division === 'Junior'));
  ok(conJunior74.length === 1, 'los 18 quedan en UNA sola tanda (quedaron en ' + conJunior74.length + ')');
  ok(conJunior74[0].length === 18, 'con los 18 completos');
  ok(avisos.some(a => a.err && /pasan de 14/.test(a.m)), 'y se avisa que pasa de 14 para que lo mire la comisión');
}

console.log('\n  Hombres y mujeres nunca se mezclan');
{
  const filas = await armar([
    ...at('H', 'Open', '-83 kg', null, 9),
    ...at('M', 'Open', '-63 kg', null, 9),
    ...at('M', 'Junior', '-57 kg', null, 9),
  ]);
  const t = porTanda(filas);
  const mezcladas = Object.entries(t).filter(([, g]) => new Set(g.map(r => r.sexo)).size > 1);
  ok(mezcladas.length === 0, 'ninguna tanda mezcla sexos');
  const sexos = Object.values(t).map(g => g[0].sexo);
  const bloques = sexos.filter((s, i) => s !== sexos[i - 1]).length;
  ok(bloques === 2, 'las mujeres quedan juntas, en un bloque corrido (bloques: ' + bloques + ')');
}

console.log('\n  Máximo 14 de powerlifting');
{
  const filas = await armar([
    ...at('H', 'Open', '-83 kg', null, 8),
    ...at('H', 'Open', '-93 kg', null, 8),
    ...at('H', 'Open', '-105 kg', null, 8),
  ]);
  const t = porTanda(filas);
  Object.entries(t).forEach(([k, g]) =>
    ok(nPL(g) <= 14, 'tanda ' + k + ' tiene ' + nPL(g) + ' de powerlifting'));
  ok(Object.keys(t).length === 3, 'los tres grupos de 8 no se pueden juntar de a dos sin pasarse: 3 tandas');
}

console.log('\n  Mínimo 8: una tanda de dos no se corre');
{
  // Dos grupos chicos del mismo sexo que juntos caben.
  const filas = await armar([
    ...at('H', 'Open', '-83 kg', null, 3),
    ...at('H', 'Open', '-93 kg', null, 6),
  ]);
  const t = porTanda(filas);
  ok(Object.keys(t).length === 1, 'los dos grupos chicos se juntan en una sola tanda');
  ok(nPL(Object.values(t)[0]) === 9, 'y la tanda queda con 9, sobre el mínimo');
}
{
  // Un grupo chico solo, sin vecino compatible: queda corto y se avisa.
  const filas = await armar([
    ...at('M', 'Open', '-63 kg', null, 3),
    ...at('H', 'Open', '-83 kg', null, 14),
  ]);
  const t = porTanda(filas);
  const chica = Object.values(t).find(g => g[0].sexo === 'M');
  ok(chica.length === 3, 'la tanda de mujeres queda con 3 — no se junta con hombres');
  ok(avisos.some(a => a.err && /bajo 8/.test(a.m)), 'y se avisa que quedó bajo el mínimo');
}

console.log('\n  Only Bench no ocupa lugar en el 14, pero el total tiene tope');
{
  const filas = await armar([
    ...at('H', 'Open', '-83 kg', null, 14),
    ...at('H', 'Open', '-83 kg', 'Only Bench Clásico', 3),
  ]);
  const t = porTanda(filas);
  ok(Object.keys(t).length === 1, 'los 14 de powerlifting y los 3 de Only Bench van en la misma tanda');
  const g = Object.values(t)[0];
  ok(nPL(g) === 14, 'cuentan 14 para el cupo de powerlifting');
  ok(g.length === 17, 'y la tanda queda con 17 personas en total');
}
{
  const filas = await armar([
    ...at('H', 'Open', '-83 kg', null, 14),
    ...at('H', 'Open', '-93 kg', 'Only Bench Clásico', 6),
  ]);
  const t = porTanda(filas);
  ok(Object.keys(t).length === 2, 'pasado el tope de 17 se abre otra tanda');
  Object.values(t).forEach(g => ok(g.length <= 17, 'ninguna tanda pasa de 17 personas (' + g.length + ')'));
}

console.log('\n  Una tanda de puro Only Bench no se mide contra el mínimo');
{
  const filas = await armar([
    ...at('H', 'Open', '-83 kg', null, 14),
    ...at('H', 'Open', '-93 kg', 'Only Bench Clásico', 6),
  ]);
  const t = porTanda(filas);
  const pura = Object.values(t).find(g => nPL(g) === 0);
  ok(!!pura && pura.length === 6, 'la tanda de solo banca queda con sus 6');
  ok(!avisos.some(a => /bajo 8/.test(a.m)),
     'y no se avisa que está bajo el mínimo: ese mínimo es de powerlifting');
}

console.log('\n  Los tres números están en un solo lugar');
{
  ok(/const MIN_PL=8;/.test(bloque), 'el mínimo es una constante con nombre');
  ok(/const MAX_PL=14;/.test(bloque), 'el máximo de powerlifting también');
  ok(/const MAX_TOT=17;/.test(bloque), 'y el tope con Only Bench');
  ok(!/for\(let i=0;i<g\.length;i\+=MAXP\)/.test(bloque), 'ya no queda el corte que partía los grupos');
}

console.log('\n  Nadie se pierde en el camino');
{
  const entrada = [
    ...at('H', 'Open', '-83 kg', null, 11),
    ...at('H', 'Junior', '-74 kg', null, 9),
    ...at('M', 'Open', '-63 kg', null, 10),
    ...at('M', 'Open', '-63 kg', 'Only Bench Clásico', 2),
  ];
  const filas = await armar(entrada);
  ok(filas.length === entrada.length, 'salen los mismos ' + entrada.length + ' atletas que entraron');
  ok(filas.every(r => r.flight && r.jornada && r.tarima), 'todos quedan con tanda, jornada y tarima');
  const jor = new Set(filas.map(r => r.jornada));
  ok([...jor].every(j => j === 'AM' || j === 'PM'), 'la jornada es AM o PM');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
})();

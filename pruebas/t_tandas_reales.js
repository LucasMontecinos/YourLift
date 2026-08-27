// El armado automático, medido contra los cronogramas que la federación armó a mano.
//
// Los dos que se corrieron en agosto —Regional Centro Sur y Regional Norte— están
// cargados en el sistema, así que sirven de patrón: se toman sus atletas, se pasan
// por el armado automático y se compara el resultado con lo que decidió la
// comisión técnica.
//
// De ahí salieron tres correcciones que las reglas dictadas no mencionaban y que
// solo se ven mirando los cronogramas de verdad:
//
//   · Las MUJERES ABREN. En el Centro Sur la tanda A es de mujeres y de la B a la
//     E son hombres. El código las mandaba al final.
//   · Las tandas salen PAREJAS, no llenas hasta el tope: 12·12·12·13·13, no
//     14·14·14·10·10. Se reparte el total entre las tandas que hagan falta.
//   · El máximo real observado es 13. Nunca llegan a 14, aunque el reglamento lo
//     permita.
//
// Esta prueba no exige calcar el cronograma —hay decisiones humanas que no se
// deducen— sino que el armado cumpla las reglas y se parezca en forma: mismo
// orden de sexos, tandas parejas y ningún grupo partido.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_tandas_reales.js
const fs = require('fs');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const bloque = adm.slice(adm.indexOf('window.cronoAutoDistribute=async function(){'),
                         adm.indexOf('window.cronoLoadFromNomina=async function(){'));
const ST = { cronoRows: [] };
const avisos = [];
const showToast = (m, _u, err) => avisos.push({ m, err: !!err });
const cronoSaveDoc = async () => {};
const render = () => {};
const confirm = () => true;
const window = {};
// eslint-disable-next-line no-eval
eval(bloque);
const armar = async filas => { ST.cronoRows = JSON.parse(JSON.stringify(filas)); avisos.length = 0; await window.cronoAutoDistribute(); return ST.cronoRows; };

const esBench = m => /bench|banca/i.test(m || '') && !/powerlifting/i.test(m || '');
const nPL = g => g.filter(r => !esBench(r.modalidad)).length;
const porTanda = filas => {
  const t = new Map();
  filas.forEach(r => { if (!t.has(r.flight)) t.set(r.flight, []); t.get(r.flight).push(r); });
  return t;
};

// Los dos cronogramas reales, reducidos a lo que importa para armar tandas.
// Se guardan acá y no se leen de Firestore: una prueba no puede depender de la red.
const REALES = JSON.parse(fs.readFileSync(__dirname + '/fixtures_cronogramas.json', 'utf8'));

(async () => {

for (const [nombre, filas] of Object.entries(REALES)) {
  console.log(`\n${nombre} · ${filas.length} atletas`);
  const salida = await armar(filas);
  const t = porTanda(salida);
  const tandas = [...t.entries()];

  ok(salida.length === filas.length, 'salen los mismos atletas que entraron');

  // Regla 1: nunca se mezclan sexos.
  const mezcladas = tandas.filter(([, g]) => new Set(g.map(r => r.sexo)).size > 1);
  ok(mezcladas.length === 0, 'ninguna tanda mezcla hombres con mujeres');

  // Regla 2: ningún grupo categoría+división partido en dos tandas.
  const donde = {};
  salida.forEach(r => {
    const k = r.sexo + '|' + r.division + '|' + r.categoria;
    (donde[k] = donde[k] || new Set()).add(r.flight);
  });
  const partidos = Object.entries(donde).filter(([, s]) => s.size > 1);
  ok(partidos.length === 0, 'ningún grupo de categoría+división queda partido' +
     (partidos.length ? ' — partidos: ' + partidos.map(([k]) => k).join(', ') : ''));

  // Regla 3: los topes.
  const sobre = tandas.filter(([, g]) => nPL(g) > 14);
  const sobreTot = tandas.filter(([, g]) => g.length > 17);
  ok(sobreTot.length === 0, 'ninguna tanda pasa de 17 personas');
  ok(sobre.length === 0 || avisos.some(a => /pasan de 14/.test(a.m)),
     sobre.length ? 'las que pasan de 14 vienen avisadas' : 'ninguna tanda pasa de 14 de powerlifting');

  // Regla 4: mínimo 8, salvo tandas de puro Only Bench.
  const cortas = tandas.filter(([, g]) => nPL(g) > 0 && nPL(g) < 8);
  ok(cortas.length === 0 || avisos.some(a => /bajo 8/.test(a.m)),
     cortas.length ? 'las que quedan bajo 8 vienen avisadas' : 'ninguna tanda queda bajo 8');

  // Forma: las mujeres abren.
  const sexos = tandas.map(([, g]) => g[0].sexo);
  const hayM = sexos.includes('M'), hayH = sexos.includes('H');
  if (hayM && hayH) {
    ok(sexos.indexOf('M') < sexos.indexOf('H'), 'las mujeres abren, como en el cronograma real');
    const bloques = sexos.filter((s, i) => s !== sexos[i - 1]).length;
    ok(bloques === 2, 'cada sexo queda en un bloque corrido, sin alternar (bloques: ' + bloques + ')');
  }

  // Forma: tandas parejas. Se mide DENTRO de cada sexo, que es donde el reparto
  // se decide: las mujeres pueden ser pocas y dar tandas chicas sin que eso sea
  // un desbalance del armado, sino del campeonato.
  console.log('      tamaños: ' + tandas.map(([f, g]) => f + '=' + nPL(g)).join(' '));
  for (const sx of ['M', 'H']) {
    const tam = tandas.filter(([, g]) => g[0].sexo === sx).map(([, g]) => nPL(g)).filter(n => n > 0);
    if (tam.length < 2) continue;
    const dif = Math.max(...tam) - Math.min(...tam);
    ok(dif <= 5, (sx === 'M' ? 'mujeres' : 'hombres') + ': tandas parejas, ' +
       tam.join('·') + ' (diferencia ' + dif + ')');
  }
}

console.log('\n  Lo que se aprendió de los cronogramas reales queda fijado');
{
  ok(/const srank=\{M:0,H:1/.test(bloque), 'las mujeres van primero en el orden');
  ok(/costo\[/.test(bloque) && /p\*p/.test(bloque),
     'el reparto se calcula entero y se elige el más parejo, no tanda a tanda');
  ok(/tandasMinimas/.test(bloque) && !/Math\.ceil\(totPL\/MAX_PL\)/.test(bloque),
     'la cantidad de tandas sale de cuántas hacen falta, no de dividir el total por 14');
  ok(/const kilos=/.test(bloque) && /const drank=/.test(bloque),
     'las categorías van de la más liviana a la más pesada, y las edades de menor a mayor');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
})();

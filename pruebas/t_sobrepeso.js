// Una marca hecha sin dar el peso no entra al ranking.
//
// Joaquín Cocio salía primero en 59 kg Universitario con 537,5: pesó 59,6, no
// dio el peso, y el resultado se había publicado como válido. Lo mismo con dos
// marcas de 2026 en la base de atletas (83 con 88,7 kg; 76 con 78,29 kg).
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_sobrepeso.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../ranking.html', 'utf8');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const p = await ctx.newPage();
  await p.goto('http://localhost:8972/ranking.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof rkNoDioPeso === 'function', null, { timeout: 20000 });
  const r = await p.evaluate(() => ({
    cocio: rkNoDioPeso('59', 59.6), justo: rkNoDioPeso('59', 59), bajo: rkNoDioPeso('83', 82.1),
    hernan: rkNoDioPeso('83', 88.7), javiera: rkNoDioPeso('76', 78.29),
    abierta: rkNoDioPeso('120+', 139.4), sinPeso: rkNoDioPeso('59', 0) }));
  console.log('\nNo dio el peso');
  ok(r.cocio && r.hernan && r.javiera, 'pesar más que el límite deja la marca afuera (59,6 en 59; 88,7 en 83; 78,29 en 76)');
  console.log('\nSí dio el peso');
  ok(!r.justo && !r.bajo, 'justo en el límite o por debajo, la marca cuenta');
  ok(!r.abierta, 'las categorías abiertas (120+) no tienen límite');
  ok(!r.sinPeso, 'sin peso corporal anotado no se descarta nada');
  ok(/if\(rkNoDioPeso\(cat,_bwC\)\)return;/.test(src), 'y la regla se aplica a lo que llega de resultados y de la base de atletas');
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

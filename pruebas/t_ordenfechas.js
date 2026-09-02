// Las competencias de una ficha se ordenan por fecha, no por el nombre.
//
// Más de la mitad de las competencias del padrón no traen `fecha`. Los ordenes de
// la ficha hacían `x.fecha || x.evento`: cuando faltaba la fecha, comparaban
// contra el NOMBRE del campeonato. Eso no es un orden, es un sorteo — "2026-06-13"
// queda antes que "Campeonato Nacional…" y ese antes que "Regional…", porque los
// dígitos van antes que las letras.
//
// Lo reportaron los propios atletas. A Sergio Mardones Meza, la evolución de GL
// Points le mostraba el Nacional —su peor marca, y su SEGUNDA competencia— al
// final del gráfico: parecía que venía en bajada cuando después había hecho su
// mejor marca en el Mundial.
//
// Dos arreglos, y esta prueba mide los dos: se rellenaron las fechas que se podían
// deducir del propio campeonato, y el orden ya no compara nunca una fecha con un
// nombre.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_ordenfechas.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const atletas = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));

  console.log('\nEl padrón trae las fechas que se podían deducir');
  {
    let con = 0, sin = 0;
    atletas.forEach(a => (a.competencias || []).forEach(c => c.fecha ? con++ : sin++));
    ok(con > sin * 3, `${con} competencias con fecha contra ${sin} sin`);
    // Las que quedan sin fecha tienen que poder ordenarse igual: todas llevan el
    // año en el nombre del campeonato.
    const huerfanas = [];
    atletas.forEach(a => (a.competencias || []).forEach(c => {
      if (!c.fecha && !c['año'] && !/20\d{2}/.test(String(c.evento || ''))) huerfanas.push(c.evento || '(sin nombre)');
    }));
    ok(huerfanas.length === 0, huerfanas.length
      ? huerfanas.length + ' sin fecha NI año, p.ej. "' + huerfanas[0] + '"'
      : 'y las que no la tienen llevan el año en el nombre, así que se ordenan igual');
    // Lo rellenado queda marcado: es la fecha de inicio del campeonato, no la del
    // atleta, y eso hay que poder distinguirlo después.
    let aprox = 0;
    atletas.forEach(a => (a.competencias || []).forEach(c => { if (c.fechaAprox) aprox++; }));
    ok(aprox > 0, aprox + ' quedaron marcadas como aproximadas');
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const ctx = await b.newContext({ viewport: { width: 900, height: 1400 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/atleta.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof showProfile === 'function', null, { timeout: 20000 });
  await p.waitForTimeout(2500);

  console.log('\n  La evolución de GL Points va en orden cronológico');
  {
    // El caso que lo destapó: tres competencias, la del medio es la peor.
    await p.evaluate(() => showProfile('1718SMM-2025'));
    await p.waitForTimeout(500);
    const puntos = await p.evaluate(() => {
      const sec = document.getElementById('profileSection');
      return [...sec.querySelectorAll('*')].map(e => (e.textContent || '').trim())
        .filter(t => /—\s*[A-Z][a-z]{2}·\d{2}\s*—\s*[\d.]+ GL/.test(t) && t.length < 90)
        .filter((v, i, a) => a.indexOf(v) === i);
    });
    ok(puntos.length === 3, 'se dibujan sus tres competencias');
    const gl = puntos.map(t => parseFloat((t.match(/([\d.]+) GL/) || [])[1]));
    ok(gl.length === 3 && gl[1] < gl[0] && gl[2] > gl[0],
       'y la peor queda al MEDIO, no al final: ' + gl.join(' → '));
    ok(/Regional Sur Austral/.test(puntos[0] || ''), 'empieza por el Regional de 2025');
    ok(/IPF World/.test(puntos[2] || ''), 'y termina en el Mundial, que es su mejor marca');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const at = fs.readFileSync(__dirname + '/../atleta.html', 'utf8');
    ok(/function fechaOrden\(c\)/.test(at), 'hay una sola forma de sacar la fecha con que se ordena');
    // Lo que no puede volver: comparar una fecha contra el nombre del campeonato.
    ok(!/fecha\|\|[xy]\.evento/.test(at),
       'y ya nadie compara una fecha con el nombre del campeonato');
    ok(/fechaOrden\(y\)\.localeCompare\(fechaOrden\(x\)\)/.test(at)
       && /fechaOrden\(x\)\.localeCompare\(fechaOrden\(y\)\)/.test(at),
       'los ordenes de la ficha pasan todos por ahí');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

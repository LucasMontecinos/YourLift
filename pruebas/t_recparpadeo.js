// El cartel de intento de récord sudamericano tiene que PARPADEAR — entrar y salir,
// como en las pantallas de la IPF — en la pantalla de tarima y en el marcador.
// Y el peso de la barra NO puede parpadear: los cargadores lo leen todo el tiempo.
//
// Que el récord se DETECTE ya lo cubre t_rec.js. Acá se verifica lo otro: que los
// dos carteles lleven la marca del parpadeo, que la animación exista de verdad en
// el navegador, y que el peso quede fuera.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_recparpadeo.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Trozo de código donde se arma cada cartel, para revisar que lleve la clase.
function bloque(marca, largo) {
  const i = src.indexOf(marca);
  return i < 0 ? '' : src.slice(i, i + largo);
}

(async () => {
  console.log('\nLos dos carteles llevan la marca del parpadeo');
  const tarima = bloque('const recordHtml=', 900);
  ok(!!tarima, 'se encuentra el cartel de la pantalla de tarima');
  ok(/class="sr-parpadea"/.test(tarima), 'el de la pantalla de tarima parpadea');
  ok(/INTENTO DE RÉCORD SUDAMERICANO/.test(tarima), 'y dice intento de récord sudamericano');

  const marcador = bloque("return rr.length?'<span", 500);
  ok(!!marcador, 'se encuentra el cartel del marcador');
  ok(/class="sr-parpadea"/.test(marcador), 'el del marcador parpadea');

  console.log('\nEl peso de la barra queda fuera');
  const peso = bloque('const weightHtml=', 320);
  ok(!!peso && !/sr-parpadea/.test(peso), 'el peso grande no lleva la clase');
  const nombre = bloque('const nameHtml=', 260);
  ok(!!nombre && !/sr-parpadea/.test(nombre), 'el nombre tampoco');

  console.log('\nLa animación existe y corre en el navegador');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=timer&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined', null, { timeout: 15000 });

  const anim = await p.evaluate(() => {
    const d = document.createElement('div');
    d.className = 'sr-parpadea';
    d.textContent = 'INTENTO DE RÉCORD SUDAMERICANO';
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    const r = { nombre: cs.animationName, dur: cs.animationDuration, rep: cs.animationIterationCount };
    // Y que la opacidad realmente cambie a lo largo del ciclo
    r.opacidades = [];
    return new Promise(res => {
      const t0 = performance.now();
      const tic = () => {
        r.opacidades.push(+getComputedStyle(d).opacity);
        if (performance.now() - t0 < 3200) requestAnimationFrame(tic);
        else { d.remove(); res(r); }
      };
      tic();
    });
  });
  ok(anim.nombre === 'srParpadeo', 'la animación se llama srParpadeo (' + anim.nombre + ')');
  ok(anim.rep === 'infinite', 'se repite mientras dure el intento');
  ok(parseFloat(anim.dur) >= 2 && parseFloat(anim.dur) <= 5, 'a un ritmo legible: ' + anim.dur);

  const min = Math.min(...anim.opacidades), max = Math.max(...anim.opacidades);
  ok(max > 0.9, 'llega a verse entero (opacidad máxima ' + max.toFixed(2) + ')');
  ok(min < 0.1, 'y llega a desaparecer (opacidad mínima ' + min.toFixed(2) + ')');
  const visible = anim.opacidades.filter(o => o > 0.5).length / anim.opacidades.length;
  ok(visible > 0.5, 'pasa más tiempo visible que oculto: ' + Math.round(visible * 100) + '%');
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

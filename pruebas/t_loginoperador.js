// El inicio de sesión del operador, fuera de la vista del público.
//
// El livecast se proyecta en el recinto. Un botón "Iniciar sesión (operador)" en
// la barra lateral queda a la vista de todos, y no corresponde: al público no se
// le ofrece entrar a ninguna parte.
//
// Pero la razón por la que ese botón existía sigue en pie, y es seria: si al
// operador se le vence la sesión EN MEDIO de la competencia, el livecast deja de
// guardar en silencio. Sin una forma de volver a entrar desde la propia pantalla,
// habría que salirse del sistema con la competencia andando.
//
// Por eso la puerta no se elimina, se esconde: Ctrl+Shift+L. No se ve, nadie la
// encuentra de casualidad, y el que opera la tiene siempre.
//
// Lo que se cuida acá:
//   · que el botón ya no esté en la barra;
//   · que el atajo abra el inicio de sesión igual;
//   · y que en las pantallas de transmisión el atajo NO haga nada: esas van al
//     aire y un cuadro de sesión encima sería peor que el botón.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_loginoperador.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const haySesion = () => /INICIAR SESI[OÓ]N/i.test(document.body.innerText || '');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  const abrir = async (q) => {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
    await p.route('**/firebasejs/**', r => r.abort());
    await p.goto(`http://localhost:${PUERTO}/livecast.html${q || ''}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof R === 'function' || typeof renderTxWidget === 'function',
      null, { timeout: 25000 });
    await p.waitForTimeout(1200);
    return p;
  };

  console.log('\nEl botón no está a la vista del público');
  {
    const p = await abrir();
    const r = await p.evaluate(() => ({
      enBarra: /Iniciar sesi/i.test(document.body.innerText || ''),
      // Y que no quede ningún control que lo llame. Se miran los atributos
      // onclick y no el HTML entero: el <script> de la página vive dentro del
      // body, así que buscar el nombre suelto encuentra el propio manejador de
      // teclado y da un falso positivo.
      onclick: [...document.querySelectorAll('[onclick]')]
        .some(el => /openLoginModal/.test(el.getAttribute('onclick') || '')),
    }));
    ok(!r.enBarra, 'no aparece "Iniciar sesión" en la barra lateral');
    ok(!r.onclick, 'ni queda un botón escondido que lo llame');
    await p.close();
  }

  console.log('\n  Pero el operador puede entrar igual');
  {
    const p = await abrir();
    const antes = await p.evaluate(haySesion);
    ok(!antes, 'antes del atajo no hay ningún cuadro de sesión');
    await p.keyboard.press('Control+Shift+L');
    await p.waitForTimeout(500);
    const despues = await p.evaluate(haySesion);
    ok(despues, 'Ctrl+Shift+L lo abre');
    await p.close();
  }

  console.log('\n  En las pantallas al aire el atajo no hace nada');
  {
    for (const modo of ['scoreboard', 'screen']) {
      const p = await abrir('?tx=' + modo);
      await p.keyboard.press('Control+Shift+L');
      await p.waitForTimeout(400);
      const r = await p.evaluate(haySesion);
      ok(!r, modo + ': no aparece ningún cuadro de sesión encima de la transmisión');
      await p.close();
    }
  }

  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/Ctrl\+Shift\+L/.test(lc), 'el atajo está documentado donde se define');
    // Si volviera a aparecer el botón, esto lo agarra.
    ok(!/Iniciar sesi\\u00f3n \(operador\)/.test(lc) && !/Iniciar sesión \(operador\)/.test(lc),
       'y el botón no volvió a la barra');
    // La guarda que lo deja fuera de las pantallas de transmisión.
    const i = lc.indexOf('Ctrl+Shift+L abre el inicio');
    const bloque = lc.slice(i, i + 900);
    ok(/if\(TX_MODE\)return;/.test(bloque), 'con TX_MODE afuera, explícito');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

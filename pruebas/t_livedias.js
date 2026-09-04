// La vista pública del livecast: elegir el DÍA y después la tanda.
//
// El Sudamericano tiene 36 tandas repartidas en ocho días. En una sola tira de
// botones —A, B, C… Z, AA… AJ— no hay forma de encontrar la de uno sin contar
// letras. Ahora primero se elige el día y quedan a la vista las cuatro o cinco
// tandas de ese día.
//
// Lo que esta prueba cuida sobre todo es que elegir un día NO mueva nada más:
// no cambia la tanda que se está mirando, no toca la tarima y no saca al
// espectador de la vista libre. Es un filtro de botones y nada más — en una
// competencia en vivo, una vista que se mueve sola es peor que una incómoda.
//
// Y que los campeonatos de un día sigan viéndose igual que siempre: si los
// atletas no traen jornada anotada, la fila de días no aparece.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_livedias.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Un campeonato de tres días con dos tandas cada uno, como el Sudamericano.
function atletas() {
  const out = [];
  const dias = [[1, '20/09', ['A', 'B']], [2, '21/09', ['C', 'D']], [3, '22/09', ['E', 'F']]];
  let id = 0;
  dias.forEach(([d, fecha, tandas]) => tandas.forEach(fl => {
    for (let i = 0; i < 3; i++) {
      out.push({
        id: id++, lot: 100 * d + i, name: `Atleta ${fl}${i}`, sexo: 'Hombre',
        cat: '-74', div: 'Open', mod: 'Powerlifting Classic', club: 'Chile',
        pais: 'CHI', flight: fl, jornada: `D${d} ${fecha} · 09:00 · Sesión ${fl}`,
        bw: 80, bombed: false, sex: 'Hombre', country: 'CHI',
        att: { sq: [{ w: 100, r: null }, { w: 0, r: null }, { w: 0, r: null }],
               bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }],
               dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] },
      });
    }
  }));
  return out;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // Sin ?evento: si se le pide uno, la página lo carga sola y pisa los atletas de
  // la prueba justo después de montarlos.
  await p.goto(`http://localhost:${PUERTO}/livecast.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderLiveView === 'function',
    null, { timeout: 25000 });
  await p.waitForTimeout(1500);

  // Las tandas que se ven en la fila de "VER TANDA" — hay otros botones con
  // letras en la página y hay que mirar solo esa fila.
  await p.evaluate(() => {
    window.__tandasVisibles = () => {
      const lbl = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'VER TANDA');
      if (!lbl) return [];
      return [...lbl.parentElement.querySelectorAll('button')]
        .map(b => b.textContent.trim()).filter(t => !/^AUTOM/.test(t))
        .map(t => (t.match(/^[A-Z]{1,2}/) || [''])[0]);
    };
  });

  // Se monta un campeonato a mano y se abre la vista pública.
  await p.evaluate(ath => {
    DATA.event = { id: 'x', name: 'Prueba' };
    DATA.athletes = ath;
    DATA.phase = 'liveView'; DATA.lift = 'sq'; DATA.round = 0;
    DATA.flight = 'C';                 // la tarima está en el día 2
    window.NAV_LIBRE = false;
    window._DIA_SEL = {};
    R();
  }, atletas());
  await p.waitForTimeout(400);

  console.log('\nAl entrar se ve el día que se está compitiendo');
  {
    const r = await p.evaluate(() => ({
      hayDias: /VER DÍA/.test(document.body.innerText),
      sel: window._DIA_SEL.publico,
      // Solo los de la vista pública: la barra lateral tiene su propia fila de
      // días para el Vuelo Activo, y contarlos todos juntos daba seis.
      botones: [...(document.querySelector('.main') || document).querySelectorAll('button')]
        .map(b => b.textContent.trim()).filter(t => /^DÍA \d/.test(t)),
      // Las tandas listadas tienen que ser las de ese día.
      tandas: window.__tandasVisibles(),
    }));
    ok(r.hayDias, 'aparece la fila de días');
    ok(r.botones.length === 3, 'los tres días: ' + r.botones.join(' · '));
    ok(r.sel === 2, 'y arranca en el día 2, que es donde está la tarima');
    ok(r.tandas.join(',') === 'C,D', 'con las tandas de ese día y no las seis: ' + r.tandas.join(','));
    ok(/EN TARIMA/.test(r.botones.join(' ')), 'el día que se compite va marcado');
  }

  console.log('\n  Elegir otro día no mueve nada más');
  {
    const antes = await p.evaluate(() => ({ fl: DATA.flight, libre: !!window.NAV_LIBRE }));
    const r = await p.evaluate(() => {
      verDia('publico',3);
      return {
        fl: DATA.flight, libre: !!window.NAV_LIBRE, sel: window._DIA_SEL.publico,
        tandas: window.__tandasVisibles(),
      };
    });
    ok(r.sel === 3, 'el día 3 queda elegido');
    ok(r.tandas.join(',') === 'E,F', 'y se listan sus tandas: ' + r.tandas.join(','));
    // Lo que no puede pasar en una competencia en vivo.
    ok(r.fl === antes.fl, 'la tanda que se está mirando NO cambió (' + r.fl + ')');
    ok(r.libre === antes.libre, 'y no saca de automático');
  }

  console.log('\n  Elegir una tanda sigue funcionando igual');
  {
    const r = await p.evaluate(() => {
      verDia('publico',1); liveVerTanda('B');
      return { fl: DATA.flight, libre: !!window.NAV_LIBRE };
    });
    ok(r.fl === 'B', 'pasa a la tanda B');
    ok(r.libre === true, 'y entra en vista libre, como antes');
  }

  console.log('\n  Un campeonato de un día se ve igual que siempre');
  {
    const r = await p.evaluate(() => {
      // Sin jornada anotada: no hay días que elegir.
      DATA.athletes.forEach(a => { a.jornada = ''; });
      window._DIA_SEL = {}; R();
      return {
        hayDias: /VER DÍA/.test(document.body.innerText),
        tandas: window.__tandasVisibles(),
      };
    });
    ok(!r.hayDias, 'no aparece la fila de días');
    ok(r.tandas.length === 6, 'y se listan las seis tandas, como siempre: ' + r.tandas.join(','));
  }

  console.log('\n  Lo mismo en Control en Vivo y en Atletas & Pesaje');
  {
    // Estas dos SÍ mueven la tarima con sus botones de tanda, así que lo que hay
    // que cuidar es que elegir el DÍA no la mueva por su cuenta.
    const r = await p.evaluate(() => {
      DATA.athletes.forEach((a, i) => { a.jornada = `D${Math.floor(i / 6) + 1} 2${Math.floor(i / 6)}/09 · 09:00 · S`; });
      window._DIA_SEL = {};
      const out = {};
      DATA.flight = 'C';
      ST_ADMIN = true;
      DATA.phase = 'compete'; R();
      out.control = /VER DÍA/.test(document.body.innerText);
      out.flightTrasControl = DATA.flight;
      verDia('control', 1);
      out.flightTrasElegirDia = DATA.flight;
      DATA.phase = 'manage'; R();
      out.pesaje = /VER DÍA/.test(document.body.innerText);
      verDia('pesaje', 2);
      out.flightTrasPesaje = DATA.flight;
      // Cada pantalla recuerda su propio día.
      out.sel = { control: window._DIA_SEL.control, pesaje: window._DIA_SEL.pesaje };
      return out;
    }).catch(e => ({ err: e.message }));
    if (r.err) { ok(false, 'no se pudo abrir: ' + r.err); }
    else {
      ok(r.control, 'Control en Vivo tiene su fila de días');
      ok(r.pesaje, 'y Atletas & Pesaje también');
      ok(r.flightTrasElegirDia === r.flightTrasControl && r.flightTrasPesaje === r.flightTrasControl,
         'elegir el día no mueve la tanda en tarima (' + r.flightTrasControl + ')');
      ok(r.sel.control === 1 && r.sel.pesaje === 2,
         'y cada pantalla recuerda el suyo: control ' + r.sel.control + ', pesaje ' + r.sel.pesaje);
    }
  }

  console.log('\n  Y en la barra lateral, el Vuelo Activo');
  {
    // Era la última tira que quedaba entera: 36 botones, A hasta AJ, donde
    // encontrar el propio era contar letras.
    const leer = () => {
      const lbl = [...document.querySelectorAll('.side-label')].find(x => /Vuelo Activo/i.test(x.textContent));
      if (!lbl) return null;
      // El botón dice la letra y debajo la cantidad, y textContent los pega sin
      // espacio: "D3" es la tanda D con 3 atletas.
      return [...lbl.parentElement.querySelectorAll('button')]
        .map(x => (x.textContent.trim().replace(/\s+/g, '').match(/^([A-Z]{1,2})\d+$/) || [])[1])
        .filter(Boolean);
    };
    const r = await p.evaluate((fn) => {
      const at = w => ({ sq: [{ w, r: null }, { w: 0, r: null }, { w: 0, r: null }],
                         bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
                         dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
      const dias = [[1, '20/09', ['A', 'B', 'C']], [2, '21/09', ['D', 'E']], [3, '22/09', ['F', 'G', 'H']]];
      const ats = []; let id = 0;
      dias.forEach(([d, fe, fls]) => fls.forEach(fl => {
        for (let i = 0; i < 3; i++) ats.push({ id: id++, name: 'At ' + fl + i, lot: 100 * d + i,
          flight: fl, sex: 'Hombre', sexo: 'Hombre', cat: '-83', div: 'Open',
          mod: 'Powerlifting Classic', club: 'C', country: 'CHI', pais: 'CHI', bw: 80,
          bombed: false, jornada: 'D' + d + ' ' + fe + ' · 09:00 · S', att: at(100) });
      }));
      DATA.event = { id: 'e', name: 'X' }; DATA.athletes = ats;
      DATA.phase = 'compete'; DATA.lift = 'sq'; DATA.round = 0; DATA.flight = 'E';
      ST_ADMIN = true; window._DIA_SEL = {}; R();
      const lee = eval('(' + fn + ')');
      const out = { arranque: lee(), sel: window._DIA_SEL.lateral };
      verDia('lateral', 1); out.dia1 = lee();
      verDia('lateral', 3); out.dia3 = lee();
      out.tarima = DATA.flight;
      return out;
    }, leer.toString());
    ok(r.sel === 2, 'arranca en el día donde está la tarima (' + r.sel + ')');
    ok(r.arranque.join(',') === 'D,E', 'con las tandas de ese día: ' + r.arranque.join(','));
    ok(r.dia1.join(',') === 'A,B,C', 'día 1 → ' + r.dia1.join(','));
    ok(r.dia3.join(',') === 'F,G,H', 'día 3 → ' + r.dia3.join(','));
    ok(r.tarima === 'E', 'y elegir el día no movió la tarima (' + r.tarima + ')');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/window\.verDia=function/.test(lc), 'elegir día es su propia acción');
    ok((lc.match(/_filaDias\(/g) || []).length >= 5,
       'y una sola forma de armar la fila, usada en las cuatro pantallas');
    // Si esto cambiara DATA.flight, elegir un día movería la pantalla de todos.
    const i = lc.indexOf('window.verDia=function');
    const f = lc.slice(i, lc.indexOf('};', i) + 2);
    ok(!/DATA\.flight/.test(f), 'y no toca DATA.flight: filtra botones, no cambia la vista');
    ok(!/setNavLibre/.test(f), 'ni la vista libre');
    // La foto de la nómina, para los que no están en el padrón.
    ok(/_fotoSudaFor\(a\)\|\|\{\}\)\.foto_url/.test(lc),
       'la ficha del atleta busca la foto en la nómina si no está en el padrón');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

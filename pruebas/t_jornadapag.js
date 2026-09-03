// La Tabla de Jornada: que entre completa, que se lea, y los logos.
//
// Esta pantalla se proyecta en el recinto y no se sabe en qué televisor: puede
// ser un monitor de 1366 o una pantalla grande. Se pide que muestre las tandas
// elegidas, que se lea de cerca y de lejos, y que no falte nadie.
//
// El problema que se arregla acá es silencioso y por eso es feo: la tabla se
// escalaba para llenar la pantalla, pero con varias tandas elegidas terminaba
// más alta que el alto disponible y el contenedor la recortaba. Las últimas
// filas simplemente no estaban, sin ningún aviso — nadie se entera de que faltan
// atletas hasta que alguien busca a uno y no aparece.
//
// Ahora hay un piso: por debajo de cierto alto de fila no se lee ni de cerca, y
// si no entra se reparte en páginas que rotan solas. Se pierde el verlo todo de
// un vistazo; no se pierde información.
//
// Y van los tres logos: federación, campeonato y YourLift.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_jornadapag.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const FED = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><rect width="300" height="120" fill="#f00"/></svg>');
const CAMP = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><rect width="300" height="120" fill="#0f0"/></svg>');

// Monta un campeonato con n atletas repartidos en varias categorías y tandas.
const MONTAR = (n, fed, camp, tandas) => {
  const at = w => ({ sq: [{ w, r: 'g' }, { w: w + 5, r: 'g' }, { w: w + 10, r: null }],
                     bp: [{ w: 60, r: 'g' }, { w: 65, r: null }, { w: 0, r: null }],
                     dl: [{ w: 120, r: 'g' }, { w: 0, r: null }, { w: 0, r: null }] });
  const cats = ['-59', '-66', '-74', '-83', '-93', '-105'];
  const fls = tandas || ['A'];
  DATA.event = { id: 'ev1', name: 'Sudamericano Chile 2026', logoUrl: camp, logoFedUrl: fed };
  DATA.athletes = Array.from({ length: n }, (_, i) => ({
    id: i, name: 'Apellido Largo Atleta ' + String(i + 1).padStart(3, '0'), lot: 100 + i, flight: fls[i % fls.length],
    sex: i % 2 ? 'Mujer' : 'Hombre', sexo: i % 2 ? 'Mujer' : 'Hombre',
    cat: cats[i % cats.length], div: 'Open', mod: 'Powerlifting Classic',
    club: 'Club', country: 'CHI', pais: 'CHI', bw: 80, bombed: false, att: at(100 + i),
  }));
  DATA.phase = 'compete'; DATA.lift = 'sq'; DATA.round = 0; DATA.flight = fls[0];
  window._JORN_PAG = 0;
  renderTxWidget();
};

const MEDIR = () => {
  const d = document.documentElement;
  const t = document.querySelector('table');
  const txt = document.body.innerText || '';
  const m = txt.match(/Página (\d+) de (\d+)/);
  const celda = t && t.querySelector('td');
  return {
    altoTabla: t ? Math.round(t.getBoundingClientRect().height) : 0,
    altoPantalla: d.clientHeight,
    paginas: m ? Number(m[2]) : 1,
    pagina: m ? Number(m[1]) : 1,
    letra: celda ? parseFloat(getComputedStyle(celda).fontSize) : 0,
    // Cuántos atletas se ven ahora mismo.
    filas: (txt.match(/Apellido Largo Atleta/g) || []).length,
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  const abrir = async (w, h) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
    await p.route('**/firebasejs/**', r => r.abort());
    await p.goto(`http://localhost:${PUERTO}/livecast.html?tx=screen&modo=jornada`,
      { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof renderTxWidget === 'function', null, { timeout: 25000 });
    return p;
  };

  console.log('\nLos tres logos están en la tabla de jornada');
  {
    const p = await abrir(1920, 1080);
    await p.evaluate(([n, f, c]) => MONTARFN(n, f, c), [12, FED, CAMP])
      .catch(() => p.evaluate(({ n, f, c, fn }) => eval('(' + fn + ')')(n, f, c), { n: 12, f: FED, c: CAMP, fn: MONTAR.toString() }));
    const r = await p.evaluate(() => ({
      fed: [...document.querySelectorAll('img')].some(i => i.src.includes('%23f00') || i.src.includes('%23F00')),
      camp: [...document.querySelectorAll('img')].some(i => i.src.includes('%230f0') || i.src.includes('%230F0')),
      yl: [...document.querySelectorAll('img')].some(i => /yourlift/i.test(i.src)),
    }));
    ok(r.fed, 'el de la federación');
    ok(r.camp, 'el del campeonato');
    ok(r.yl, 'y el de YourLift');
    await p.close();
  }

  console.log('\n  Muestra solo las tandas elegidas');
  {
    const p = await abrir(1920, 1080);
    const r = await p.evaluate(({ fn, f, c }) => {
      eval('(' + fn + ')')(24, f, c, ['A', 'B', 'C']);
      window._SCREEN_STATE = { mode: 'jornada', flights: ['B'] };
      renderTxWidget();
      const vistos = new Set();
      DATA.athletes.forEach(a => {
        if ((document.body.innerText || '').includes(a.name)) vistos.add(a.flight);
      });
      return { tandas: [...vistos].sort(), rotulo: /Tandas: B/.test(document.body.innerText || '') };
    }, { fn: MONTAR.toString(), f: FED, c: CAMP });
    ok(r.tandas.join(',') === 'B', 'solo salen los de la tanda B — ' + r.tandas.join(','));
    ok(r.rotulo, 'y el título dice cuáles se están mostrando');
    await p.close();
  }

  // Lo importante: en NINGÚN caso puede quedar gente afuera sin avisar.
  console.log('\n  Nunca se corta, en ninguna pantalla');
  for (const [w, h] of [[1920, 1080], [1366, 768], [3840, 2160]]) {
    const p = await abrir(w, h);
    for (const n of [12, 40, 80, 140]) {
      const r = await p.evaluate(({ fn, f, c, n }) => {
        eval('(' + fn + ')')(n, f, c);
        return (function () {
          const d = document.documentElement, t = document.querySelector('table');
          const txt = document.body.innerText || '';
          const m = txt.match(/Página (\d+) de (\d+)/);
          const celda = t && t.querySelector('td');
          return {
            altoTabla: t ? Math.round(t.getBoundingClientRect().height) : 0,
            altoPantalla: d.clientHeight,
            paginas: m ? Number(m[2]) : 1,
            letra: celda ? parseFloat(getComputedStyle(celda).fontSize) : 0,
          };
        })();
      }, { fn: MONTAR.toString(), f: FED, c: CAMP, n });
      ok(r.altoTabla <= r.altoPantalla + 2,
         `${w}×${h} con ${n} atletas: entra (${r.altoTabla}px de ${r.altoPantalla})`
         + (r.paginas > 1 ? ` en ${r.paginas} páginas` : ''));
      // Y que quepa no puede lograrse encogiendo la letra hasta que no se lea.
      ok(r.letra >= 11, `  y la letra sigue legible (${r.letra}px)`);
    }
    await p.close();
  }

  console.log('\n  Las páginas rotan y entre todas está todo');
  {
    const p = await abrir(1366, 768);
    const r = await p.evaluate(({ fn, f, c }) => {
      eval('(' + fn + ')')(140, f, c);
      const total = DATA.athletes.length;
      const vistos = new Set();
      let paginas = 0;
      for (let i = 0; i < 12; i++) {
        window._JORN_PAG = i; renderTxWidget();
        const txt = document.body.innerText || '';
        const m = txt.match(/Página (\d+) de (\d+)/);
        if (m) paginas = Number(m[2]);
        DATA.athletes.forEach(a => { if (txt.includes(a.name)) vistos.add(a.id); });
        if (paginas && i >= paginas - 1) break;
      }
      return { total, vistos: vistos.size, paginas, hayReloj: !!window._jornPagTimer };
    }, { fn: MONTAR.toString(), f: FED, c: CAMP });
    ok(r.paginas > 1, 'con 140 atletas se reparte en ' + r.paginas + ' páginas');
    ok(r.vistos === r.total,
       'y entre todas las páginas están los ' + r.total + ' (se vieron ' + r.vistos + ')');
    ok(r.hayReloj, 'las páginas rotan solas, sin que nadie las pase');
    await p.close();
  }

  console.log('\n  Con pocos atletas no se pagina ni queda el reloj andando');
  {
    const p = await abrir(1920, 1080);
    const r = await p.evaluate(({ fn, f, c }) => {
      eval('(' + fn + ')')(140, f, c);            // primero paginado, para dejar el reloj puesto
      const conReloj = !!window._jornPagTimer;
      eval('(' + fn + ')')(10, f, c);             // y ahora una tanda chica
      const txt = document.body.innerText || '';
      return { conReloj, sinReloj: !window._jornPagTimer, sinCartel: !/Página \d+ de/.test(txt) };
    }, { fn: MONTAR.toString(), f: FED, c: CAMP });
    ok(r.conReloj, 'con muchos atletas el reloj se pone en marcha');
    ok(r.sinReloj, 'y al volver a una tanda chica se apaga, no queda redibujando de gusto');
    ok(r.sinCartel, 'ni queda el cartel de página');
    await p.close();
  }

  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/const UNIT_MIN=/.test(lc), 'hay un piso de alto de fila');
    ok(/_jornPagTimer/.test(lc), 'y páginas que rotan cuando no entra');
    ok(/_tiraLogos\(\['fed','camp'\]/.test(lc.slice(lc.indexOf('function renderTxJornada'))),
       'la tabla de jornada arma sus logos con la misma función que el resto');
    // Los logos movibles de las otras dos pantallas.
    ok(/logoFed:\{x:/.test(lc) && /logoCamp:\{x:/.test(lc),
       'la Pantalla de Intentos tiene sus dos logos como bloques movibles');
    ok(/bLogoFed:\{x:/.test(lc), 'y Atleta en barra el de la federación');
    ok(/function _piLogoBloque\(/.test(lc), 'con una sola forma de armar un bloque de logo');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

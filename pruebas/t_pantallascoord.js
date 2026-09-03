// Las pantallas de tarima, todas abiertas a la vez, mostrando lo mismo.
//
// En el Sudamericano van a estar prendidas al mismo tiempo la pantalla de
// intentos, la del atleta y la tabla de clasificación, cada una en su televisor
// y cada una con su link. Lo que no puede pasar es que una vaya un atleta atrás:
// el público mira una, el entrenador otra y el que carga los discos una tercera.
//
// Las tres salen del MISMO estado —`liftQueue()[0]`, el que está en la barra— y
// eso es lo que esta prueba fija: dadas las mismas marcas, las tres nombran al
// mismo atleta, y cuando el que operaba marca un intento las tres pasan al
// siguiente juntas.
//
// Lo que esta prueba NO cubre: el viaje por la red. Acá el estado se monta igual
// en cada pantalla; que Firestore lo reparta a tiempo es otra cosa y se prueba
// en t_sync. Acá se cuida que, con el mismo estado, ninguna pantalla se quede
// dibujando lo anterior.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_pantallascoord.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Tres atletas en la misma tanda, con la sentadilla abierta. El orden de la
// barra lo da el peso: primero el que menos pide.
const MONTAR = `(() => {
  const at = (w) => ({ sq:[{w,r:null},{w:0,r:null},{w:0,r:null}],
                       bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                       dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}] });
  const mk = (id,nom,w) => ({ id, name:nom, lot:100+id, flight:'A', sex:'Hombre',
    sexo:'Hombre', cat:'-83', div:'Open', mod:'Powerlifting Classic', club:'Chile',
    country:'CHI', pais:'CHI', bw:82, bombed:false, att:at(w), jornada:'D1 20/09 · 09:00 · S' });
  DATA.event = { id:'x', name:'Prueba' };
  DATA.athletes = [ mk(1,'Primero Uno',100), mk(2,'Segundo Dos',110), mk(3,'Tercero Tres',120) ];
  DATA.phase = 'compete'; DATA.lift = 'sq'; DATA.round = 0; DATA.flight = 'A';
})()`;

// Quién está en la barra según cada pantalla, leído de lo que se ve.
const QUIEN = `(() => {
  const t = (document.body.innerText || '').toUpperCase();
  const nombres = ['PRIMERO UNO','SEGUNDO DOS','TERCERO TRES','CUARTO CUATRO'];
  return nombres.filter(n => t.includes(n));
})()`;

// Dos formas de mostrar, y se miden distinto. La del atleta muestra SOLO al que
// está en la barra: ahí el nombre que se ve tiene que ser exactamente ese. Las
// otras dos listan la tanda entera, así que lo que se mide es que el actual esté
// y que el estado del que sale sea el mismo en todas.
const PANTALLAS = [
  ['screen',      'Pantalla de intentos', 'lista'],
  ['profile',     'Pantalla del atleta',  'solo'],
  ['tablaactual', 'Tabla de la categoría','lista'],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const errs = [];

  // Se abre una pestaña por pantalla, como los televisores del recinto.
  const paginas = [];
  for (const [modo, nombre, forma] of PANTALLAS) {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?tx=${modo}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
      null, { timeout: 25000 });
    await p.evaluate(MONTAR);
    await p.evaluate(() => renderTxWidget());
    paginas.push({ p, modo, nombre, forma });
  }
  await paginas[0].p.waitForTimeout(600);

  const leer = async () => {
    const out = [];
    for (const { p, nombre, forma } of paginas) {
      out.push({ nombre, forma,
        vistos: await p.evaluate(QUIEN),
        // A quién considera en la barra cada pantalla, según su propio estado.
        actual: await p.evaluate(() => { const c = liftQueue()[0]; return c ? c.name.toUpperCase() : null; }) });
    }
    return out;
  };

  // Qué se le pide a cada pantalla, según su forma.
  const revisar = (r, quien, etiqueta) => {
    r.forEach(({ nombre, forma, vistos, actual }) => {
      ok(actual === quien, nombre + ' tiene en la barra a ' + (actual || '(nadie)'));
      if (forma === 'solo') {
        ok(vistos.length === 1 && vistos[0] === quien,
           '  y muestra solo a ese: ' + (vistos.join(', ') || '(nadie)'));
      } else {
        ok(vistos.includes(quien), '  y lo tiene en su lista');
      }
    });
    const actuales = r.map(x => x.actual);
    ok(new Set(actuales).size === 1, etiqueta + ': las tres coinciden en ' + actuales[0]);
  };

  console.log('\nCon el mismo estado, las tres van por el mismo atleta');
  { revisar(await leer(), 'PRIMERO UNO', 'al empezar'); }

  console.log('\n  Al marcar el intento, las tres pasan al siguiente juntas');
  {
    // Se marca el primer intento como válido en todas —es lo que haría llegar la
    // sincronización— y se redibuja.
    for (const { p } of paginas) {
      await p.evaluate(() => {
        const a = DATA.athletes.find(x => x.id === 1);
        a.att.sq[0].r = 'g';
        renderTxWidget();
      });
    }
    await paginas[0].p.waitForTimeout(500);
    revisar(await leer(), 'SEGUNDO DOS', 'tras el intento');
  }

  console.log('\n  Y al cambiar de tanda tampoco se quedan atrás');
  {
    for (const { p } of paginas) {
      await p.evaluate(() => {
        // El cuarto atleta, en otra tanda: es a donde llevaría el operador.
        DATA.athletes.push({ id: 9, name: 'Cuarto Cuatro', lot: 209, flight: 'B',
          sex: 'Hombre', sexo: 'Hombre', cat: '-83', div: 'Open',
          mod: 'Powerlifting Classic', club: 'Chile', country: 'CHI', pais: 'CHI',
          bw: 90, bombed: false, jornada: 'D2 21/09 · 09:00 · S',
          att: { sq: [{ w: 150, r: null }, { w: 0, r: null }, { w: 0, r: null }],
                 bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
                 dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] } });
        DATA.flight = 'B';
        renderTxWidget();
      });
    }
    await paginas[0].p.waitForTimeout(500);
    revisar(await leer(), 'CUARTO CUATRO', 'tras cambiar de tanda');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    // La razón por la que coordinan: todas leen el mismo lugar.
    ok(/const cur=liftQueue\(\)\[0\];/.test(lc),
       'todas las pantallas sacan al de la barra del mismo sitio');
    ok(/if\(TX_MODE==='screen'\)\{renderTxScreen\(c\);return true\}/.test(lc),
       'y la de intentos se dibuja desde el mismo despachador');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

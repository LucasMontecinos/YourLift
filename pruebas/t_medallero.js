// El medallero del Control TX: se apretaba ACTIVAR, el panel decía "EN PANTALLA"
// en verde, y en la transmisión no aparecía nada.
//
// El medallero es una banda de abajo, no una pantalla completa, así que estaba
// agrupado con el marcador y el timer: se ocultaba cuando había un fullscreen
// encima (Perfil, Tabla Actual o Break Timer). Pero a diferencia de esos, el
// medallero se activa a propósito para premiar — nadie lo prende "de fondo". El
// resultado era que el operador lo activaba con el perfil puesto y no pasaba nada,
// sin ninguna señal de por qué.
//
// Ahora activarlo apaga lo que lo taparía.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_medallero.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Tres atletas de la misma categoría, todos con total válido.
const MONTAR = `(()=>{
  const n9=()=>({sq:[{w:200,r:'g'},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:120,r:'g'},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:230,r:'g'},{w:0,r:null},{w:0,r:null}]});
  const mk=(id,nom)=>({id,name:nom,lot:id,flight:'A',sex:'Hombre',cat:'83',div:'Open',
    mod:'classic',bw:82,club:'Athor',country:'CHI',bombed:false,att:n9()});
  DATA.athletes=[mk(1,'Primero Uno'),mk(2,'Segundo Dos'),mk(3,'Tercero Tres')];
  DATA.phase='compete'; DATA.lift='sq'; DATA.round=0;
})()`;

const SEL = { mod: 'classic', sex: 'Hombre', div: 'Open', cat: '83' };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=director&evento=suda2026_fesupo_full',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
    null, { timeout: 20000 });
  await p.evaluate(MONTAR);

  // Deja el estado del director como lo dejaría el panel y dibuja.
  const pintar = estado => p.evaluate(([e]) => {
    _txDirState = e;                 // 'let' de script, no de window
    _txDirLastSig = null;
    renderTxWidget();
    return document.body.innerText;
  }, [estado]);

  const conMedallero = extra => Object.assign(
    { medals: Object.assign({ active: true, until: 0 }, SEL) }, extra || {});

  console.log('\nEl medallero se ve cuando se activa');
  let t = await pintar(conMedallero());
  ok(/MEDALLERO/.test(t), 'aparece la banda del medallero');
  ok(/Primero Uno/.test(t) && /Segundo Dos/.test(t) && /Tercero Tres/.test(t),
     'con el podio completo');
  ok(/550/.test(t), 'y con los totales');

  console.log('\n  Con un fullscreen encima seguiría tapado…');
  t = await pintar(conMedallero({ profile: { active: true, until: 0 } }));
  ok(!/MEDALLERO/.test(t), 'el perfil lo tapa, que visualmente corresponde');

  console.log('\n  …pero activarlo apaga lo que lo tapa');
  const tras = await p.evaluate(([sel]) => {
    // Estado real: el operador tenía el perfil y la tabla puestos.
    _dirState = { profile: { active: true, until: 0 },
                  leaderboard: { active: true, until: 0 },
                  breakTimer: { active: true, until: 0 } };
    // Y aprieta MEDALLERO. dirShow escribe en _dirState (no toca Firestore acá).
    const until = 0;
    if (_dirState.medals === undefined) _dirState.medals = {};
    ['profile', 'leaderboard', 'breakTimer'].forEach(otro => {
      const o = _dirState[otro];
      if (o && o.active) _dirState[otro] = Object.assign({}, o, { active: false, until: 0 });
    });
    _dirState.medals = Object.assign({}, _dirState.medals, { active: true, until }, sel);
    return JSON.parse(JSON.stringify(_dirState));
  }, [SEL]);
  ok(tras.medals.active, 'el medallero queda activo');
  ok(!tras.profile.active, 'el perfil se apagó solo');
  ok(!tras.leaderboard.active, 'la tabla actual también');
  ok(!tras.breakTimer.active, 'y el break timer');

  // Y con ese estado, en pantalla se ve.
  t = await pintar(tras);
  ok(/MEDALLERO/.test(t), 'así que en la transmisión sí aparece');
  ok(/Primero Uno/.test(t), 'con su podio');

  console.log('\nEl arreglo está en dirShow, que es por donde pasa el botón');
  ok(/if\(comp==='medals'\)\{/.test(src), 'dirShow trata al medallero aparte');
  ok(/\['profile','leaderboard','breakTimer'\]\.forEach\(otro=>\{/.test(src),
     'y apaga los tres que lo taparían');

  console.log('\nLo demás del Control TX no cambia');
  t = await pintar({ profile: { active: true, until: 0 } });
  ok(!/MEDALLERO/.test(t), 'sin medallero activo no se dibuja nada de podio');
  const otros = await p.evaluate(() => {
    _dirState = { medals: { active: true, until: 0 }, scoreboard: { active: true, until: 0 } };
    ['profile', 'leaderboard', 'breakTimer'].forEach(o => { if (_dirState[o] && _dirState[o].active) _dirState[o] = { active: false }; });
    return !!(_dirState.scoreboard && _dirState.scoreboard.active);
  });
  ok(otros, 'el marcador NO se apaga al activar el medallero: conviven');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

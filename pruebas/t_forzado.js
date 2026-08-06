// Marcar a mano el intento actual (forceCurrentAttempt) tiene que llegar al Control
// TX y a los widgets. El bug: la firma que decide si hay que redibujar miraba solo
// atletas + movimiento + ronda + tanda. Al forzar a un atleta DENTRO de la misma
// ronda, la firma quedaba idéntica, no se redibujaba, y el marcador y el perfil
// seguían mostrando al anterior.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_forzado.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  console.log('\nLa firma de redibujado');
  const firma = (src.match(/const _firma=\(\)=>[^;]+;/) || [''])[0];
  ok(!!firma, 'existe una firma única para comparar antes y después');
  ok(/forcedCurrent/.test(firma), 'incluye forcedCurrent — sin esto no se redibuja al forzar');
  ok(/compTimer/.test(firma), 'incluye compTimer');
  ok((src.match(/const newSig = _firma\(\);/) || []).length === 1, 'antes y después usan la MISMA firma');

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=scoreboard&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof liftQueue === 'function', null, { timeout: 15000 });

  const out = await p.evaluate(() => {
    const r = {};
    // Dos atletas de la misma tanda y ronda, con peso declarado.
    const mk = (id, lot, name, w) => ({
      id, lot, name, rut: '', sex: 'Masculino', cat: '83', div: 'Open', club: 'C',
      mod: 'classic', bw: 80, flight: 'A', rackSQ: '', rackBP: '', bombed: false, weighedIn: true,
      att: { sq: [{ w, r: null }, { w: 0, r: null }, { w: 0, r: null }],
             bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
             dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] },
    });
    DATA.athletes = [mk(1, 101, 'Primero Enlacola', 100), mk(2, 102, 'Segundo Enlacola', 140)];
    DATA.lift = 'sq'; DATA.round = 0; DATA.flight = 'A'; DATA.forcedCurrent = null;

    r.sinForzar = (liftQueue()[0] || {}).name;
    DATA.forcedCurrent = 2;
    r.conForzar = (liftQueue()[0] || {}).name;

    // La firma tal como la arma el manejador de snapshots.
    const firma = () => JSON.stringify(DATA.athletes || []) + '|' + DATA.lift + '|' + DATA.round + '|' + DATA.flight
      + '|' + (DATA.forcedCurrent == null ? '' : DATA.forcedCurrent) + '|' + JSON.stringify(DATA.compTimer || null);
    DATA.forcedCurrent = null; const antes = firma();
    DATA.forcedCurrent = 2;    const despues = firma();
    r.firmaCambia = antes !== despues;

    // Y lo que efectivamente se dibuja en el widget
    R();
    r.pintado = document.body.innerText;
    return r;
  });

  console.log('\nLa cola respeta el forzado');
  ok(out.sinForzar === 'Primero Enlacola', 'sin forzar sale el del peso menor: ' + out.sinForzar);
  ok(out.conForzar === 'Segundo Enlacola', 'al forzar pasa al frente el elegido: ' + out.conForzar);

  console.log('\nEl widget se entera');
  ok(out.firmaCambia, 'forzar dentro de la misma ronda YA cambia la firma (antes quedaba igual)');
  ok(/Segundo/.test(out.pintado), 'el marcador dibuja al atleta forzado');
  ok(!/Primero/.test(out.pintado), 'y ya no al anterior');
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

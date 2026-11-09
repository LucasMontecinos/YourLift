// Perfil automático: con cada válido o nulo, la transmisión muestra sola el
// perfil del atleta que sigue, a los 2 segundos y durante 3.
//
// Se prende desde el Control Remoto (PERFIL AUTO) y queda en el documento del
// director. Lo ejecuta la propia transmisión (el Browser Source de OBS),
// mirando los resultados que le llegan: no escribe nada.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_perfilauto.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=director&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
  await p.waitForTimeout(1500);

  // Tres atletas en la tanda A con su apertura; nadie juzgado todavía.
  const montar = auto => p.evaluate(on => {
    const n9 = () => ({ sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
    DATA.athletes = [1, 2, 3].map(i => { const a = { id: i, name: 'Atleta Numero ' + i, lot: i, flight: 'A', sex: 'Hombre', cat: '93', div: 'Open', mod: 'classic', bw: 90, club: 'Club', bombed: false, att: n9() }; a.att.sq[0].w = 100 + i * 10; return a; });
    DATA.lift = 'sq'; DATA.round = 0; DATA.flight = 'A'; DATA.forcedCurrent = null;
    _txDirState = Object.assign({}, TX_DIR_DEFAULT, { autoPerfil: { on, espera: 2, dura: 3 } });
    window._autoPerfilHasta = 0; clearTimeout(window._apT1); clearTimeout(window._apT2);
    renderTxWidget();
  }, auto);
  const decidir = (id, r) => p.evaluate(([i, x]) => { DATA.athletes.find(a => a.id === i).att.sq[0].r = x; renderTxWidget(); }, [id, r]);
  const perfil = () => p.evaluate(() => { const e = document.querySelector('.txCascade'); return e ? (e.textContent.match(/ATLETA NUMERO \d/) || [''])[0] : ''; });

  console.log('\nCon PERFIL AUTO prendido');
  await montar(true);
  await p.waitForTimeout(300);
  ok(await perfil() === '', 'sin decisión no sale nada');
  await decidir(1, 'g');
  await p.waitForTimeout(1500);
  ok(await perfil() === '', 'al marcar válido no sale de inmediato (espera 2 s)');
  await p.waitForTimeout(1200);
  const quien = await perfil();
  ok(quien === 'ATLETA NUMERO 2', 'a los 2 s sale el perfil del que sigue en tarima (' + (quien || 'nada') + ')');
  await p.waitForTimeout(1500);
  ok(await perfil() !== '', 'sigue en pantalla durante los 3 s');
  await p.waitForTimeout(3200);   // 3 s + la cortina de salida
  ok(await perfil() === '', 'y se va solo');

  console.log('\nTambién con un nulo');
  await decidir(2, 'n');
  await p.waitForTimeout(2600);
  ok(await perfil() === 'ATLETA NUMERO 3', 'el nulo también lo dispara');
  await p.waitForTimeout(4500);
  ok(await perfil() === '', 'y se va solo');

  console.log('\nCon PERFIL AUTO apagado');
  await montar(false);
  await p.waitForTimeout(300);
  await decidir(1, 'g');
  await p.waitForTimeout(3000);
  ok(await perfil() === '', 'el válido no muestra el perfil');

  console.log('\nUna nómina que llega entera no es una decisión');
  await montar(true);
  await p.waitForTimeout(300);
  await p.evaluate(() => { DATA.athletes.forEach(a => { a.att.sq[0].r = 'g'; a.att.sq[1].w = 200; a.att.sq[1].r = 'g'; }); renderTxWidget(); });
  await p.waitForTimeout(3000);
  ok(await perfil() === '', 'muchos resultados de golpe no disparan el perfil');

  console.log('\nEl botón del Control Remoto');
  const fuente = require('fs').readFileSync(__dirname + '/../livecast/control_remoto.js', 'utf8');
  const ftx = require('fs').readFileSync(__dirname + '/../livecast/transmision.js', 'utf8');
  ok(/window\.remoteAutoPerfil=/.test(fuente) && /PERFIL AUTO: /.test(fuente) && /autoPerfil=\{on,espera:2,dura:3\}/.test(ftx),
    'PERFIL AUTO guarda {on, espera 2, dura 3} en el documento del director');
  ok(/onclick="dirAutoPerfil\(\)"/.test(ftx), 'y está también en el Control TX');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

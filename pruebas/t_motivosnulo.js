// Los motivos de nulo en el panel de jueces.
//
// El juez marca el color y la pantalla de tarima lo repite, pero por qué se dio
// ese nulo estaba solo en la cabeza de cada uno. Ahora está escrito al lado de
// las luces, y cambia con el movimiento que hay en la tarima: en sentadilla los
// motivos de sentadilla, en banca los de banca.
//
// Lo que hay que cuidar es que sea SOLO un texto. El panel de jueces manda votos;
// si esto llegara a tocar el voto, el juez estaría marcando sin querer.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_motivosnulo.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../jueces.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const LEER = () => ({
  titulo: document.getElementById('motTitulo').textContent,
  red: document.getElementById('motRed').textContent,
  blue: document.getElementById('motBlue').textContent,
  yellow: document.getElementById('motYellow').textContent,
  cerrado: document.getElementById('motivos').classList.contains('closed'),
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } }); // un teléfono
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // La página importa Firebase; sin red esos import fallan y el resto igual corre.
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto('http://localhost:8972/jueces.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof pintarMotivos === 'function', null, { timeout: 20000 });
  await p.evaluate(() => selectPos('central'));

  console.log('\nAntes de que haya atleta no se inventa un movimiento');
  {
    const r = await p.evaluate(LEER);
    ok(r.titulo === 'MOTIVOS DE NULO', 'el título no nombra ningún movimiento: ' + r.titulo);
    ok(r.red === '—', 'y los motivos están en blanco');
  }

  console.log('\nCada movimiento tiene los suyos');
  {
    await p.evaluate(() => pintarMotivos('sq'));
    const r = await p.evaluate(LEER);
    ok(/SENTADILLA/.test(r.titulo), 'sentadilla: ' + r.titulo);
    ok(/[Pp]rofundidad/.test(r.red), 'rojo + rojo es la profundidad');
    ok(/rebote/.test(r.blue) && /rodillas/.test(r.blue), 'rojo + azul: descenso, doble rebote, rodillas');
    ok(/comando/.test(r.yellow) && /posición inicial/.test(r.yellow), 'rojo + amarillo: comandos y posición');
  }
  {
    await p.evaluate(() => pintarMotivos('bp'));
    const r = await p.evaluate(LEER);
    ok(/BANCA/.test(r.titulo), 'banca: ' + r.titulo);
    ok(/pecho/.test(r.red) && /codos/.test(r.red), 'rojo + rojo: el pecho y la profundidad de codos');
    ok(/codos no bloqueados/.test(r.blue), 'rojo + azul: codos no bloqueados');
    ok(/glúteo/.test(r.yellow) && /pies/.test(r.yellow), 'rojo + amarillo: glúteo, cabeza, pies');
  }
  {
    await p.evaluate(() => pintarMotivos('dl'));
    const r = await p.evaluate(LEER);
    ok(/PESO MUERTO/.test(r.titulo), 'peso muerto: ' + r.titulo);
    ok(/[Hh]ombros/.test(r.red), 'rojo + rojo: hombros no bloqueados');
    ok(/[Tt]irones/.test(r.blue) && /muslos/.test(r.blue), 'rojo + azul: tirones y apoyo en los muslos');
    ok(/comando/.test(r.yellow), 'rojo + amarillo: comandos');
  }

  console.log('\n  Y los tres textos son distintos entre movimientos');
  {
    const t = {};
    for (const l of ['sq', 'bp', 'dl']) {
      await p.evaluate(x => pintarMotivos(x), l);
      t[l] = await p.evaluate(() => document.getElementById('motRed').textContent);
    }
    ok(new Set(Object.values(t)).size === 3, 'el rojo+rojo dice algo distinto en cada uno');
  }

  console.log('\nSigue al movimiento que está en la tarima');
  ok(/if\(d\.athlete_lift&&d\.athlete_lift!==_liftActual\)\{_liftActual=d\.athlete_lift;pintarMotivos\(_liftActual\);\}/.test(src),
     'se repinta cuando el livecast avisa que cambió el movimiento');

  console.log('\nSe puede plegar y queda guardado en ese teléfono');
  {
    await p.evaluate(() => toggleMotivos());
    let r = await p.evaluate(LEER);
    ok(r.cerrado, 'se cierra');
    const vis = await p.evaluate(() => getComputedStyle(document.querySelector('.motivos-body')).display);
    ok(vis === 'none', 'y el texto deja de ocupar lugar');
    const guardado = await p.evaluate(() => localStorage.getItem('_yl_jueces_motivos'));
    ok(guardado === '0', 'la elección queda guardada');
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof pintarMotivos === 'function', null, { timeout: 20000 });
    r = await p.evaluate(LEER);
    ok(r.cerrado, 'y al volver a entrar sigue cerrado');
    await p.evaluate(() => toggleMotivos());
    ok(!(await p.evaluate(LEER)).cerrado, 'se vuelve a abrir');
  }

  console.log('\nEs un texto: no vota');
  {
    // El voto vive dentro del módulo, así que se mira por donde se ve: la luz de
    // previsualización y el botón que queda marcado.
    await p.evaluate(() => selectPos('central'));
    await p.click('.motivos-head');
    await p.click('.motivos-head');
    const r = await p.evaluate(() => ({
      etiqueta: document.getElementById('prevLabel').textContent,
      marcados: document.querySelectorAll('.vote-btn.selected').length,
    }));
    ok(r.etiqueta === 'SIN VOTO', 'tocar los motivos deja el voto sin marcar (' + r.etiqueta + ')');
    ok(r.marcados === 0, 'y ningún botón de voto queda elegido');
  }
  {
    // Lo que importa no es qué tan cerca están en el archivo, sino que dentro del
    // bloque de motivos no haya nada que vote.
    const r = await p.evaluate(() => {
      const el = document.getElementById('motivos');
      return [...el.querySelectorAll('*'), el]
        .map(n => n.getAttribute('onclick') || '')
        .filter(s => /castVote|clearVote|sendStartTimer/.test(s));
    });
    ok(r.length === 0, 'nada dentro del bloque de motivos vota' + (r.length ? ': ' + r.join(' | ') : ''));
  }

  console.log('\nLos botones de voto siguen alcanzables en un teléfono');
  {
    const r = await p.evaluate(() => {
      const b = document.querySelector('.vote-btn.yellow-btn').getBoundingClientRect();
      const lim = document.getElementById('btnClear').getBoundingClientRect();
      return { voto: b.bottom, limpiar: lim.bottom, alto: window.innerHeight,
        scroll: document.getElementById('panel').scrollHeight > document.getElementById('panel').clientHeight };
    });
    ok(r.limpiar <= r.alto + 1 || r.scroll,
       'nada queda cortado abajo (limpiar en ' + Math.round(r.limpiar) + ' de ' + r.alto
       + (r.scroll ? ', con scroll disponible' : '') + ')');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

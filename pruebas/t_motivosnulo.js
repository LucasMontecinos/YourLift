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

// Las tres guías están siempre puestas; se lee la del movimiento que se pida.
const LEER = (k) => ({
  titulo: document.getElementById('mot_' + k + '_tit').textContent,
  red: document.getElementById('mot_' + k + '_red').textContent,
  blue: document.getElementById('mot_' + k + '_blue').textContent,
  yellow: document.getElementById('mot_' + k + '_yellow').textContent,
  cerrado: document.getElementById('motivos').classList.contains('closed'),
});
// En cuál de las tres está parado el bloque deslizable.
const DONDE = () => {
  const c = document.getElementById('motBody');
  return {
    i: Math.round(c.scrollLeft / Math.max(1, c.clientWidth)),
    punto: [...document.getElementById('motNav').children].findIndex(d => d.classList.contains('on')),
    deslizable: c.scrollWidth > c.clientWidth + 2,
    cerrado: document.getElementById('motivos').classList.contains('closed'),
  };
};

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

  console.log('\nLas tres guías están puestas desde el principio');
  {
    // Antes se mostraba solo la del movimiento en tarima, y como ese dato nunca
    // salía del control en vivo, el bloque se veía vacío. Ahora están las tres y
    // se pasan deslizando: el juez de banca puede mirar la de peso muerto un
    // minuto antes de que empiece.
    const r = await p.evaluate(DONDE);
    ok(r.deslizable, 'el bloque se desliza de lado');
    ok(r.i === 0 && r.punto === 0, 'arranca en la primera, y el puntito lo dice');
    const n = await p.evaluate(() => document.querySelectorAll('.mot-lift').length);
    ok(n === 3, 'hay tres guías, una por movimiento (' + n + ')');
    const puntos = await p.evaluate(() => document.getElementById('motNav').children.length);
    ok(puntos === 3, 'y tres puntitos para saber en cuál va');
    const vacios = await p.evaluate(() =>
      [...document.querySelectorAll('.mot-txt')].filter(e => !e.textContent.trim() || e.textContent === '—').length);
    ok(vacios === 0, 'ninguna queda en blanco ni con una raya');
  }

  console.log('\nCada movimiento tiene los suyos');
  {
    const r = await p.evaluate(LEER, 'sq');
    ok(/SENTADILLA/.test(r.titulo), 'sentadilla: ' + r.titulo);
    ok(/[Pp]rofundidad/.test(r.red), 'rojo + rojo es la profundidad');
    ok(/rebote/.test(r.blue) && /rodillas/.test(r.blue), 'rojo + azul: descenso, doble rebote, rodillas');
    ok(/comando/.test(r.yellow) && /posición inicial/.test(r.yellow), 'rojo + amarillo: comandos y posición');
  }
  {
    const r = await p.evaluate(LEER, 'bp');
    ok(/BANCA/.test(r.titulo), 'banca: ' + r.titulo);
    ok(/pecho/.test(r.red) && /codos/.test(r.red), 'rojo + rojo: el pecho y la profundidad de codos');
    ok(/codos no bloqueados/.test(r.blue), 'rojo + azul: codos no bloqueados');
    ok(/glúteo/.test(r.yellow) && /pies/.test(r.yellow), 'rojo + amarillo: glúteo, cabeza, pies');
  }
  {
    const r = await p.evaluate(LEER, 'dl');
    ok(/PESO MUERTO/.test(r.titulo), 'peso muerto: ' + r.titulo);
    ok(/[Hh]ombros/.test(r.red), 'rojo + rojo: hombros no bloqueados');
    ok(/[Tt]irones/.test(r.blue) && /muslos/.test(r.blue), 'rojo + azul: tirones y apoyo en los muslos');
    ok(/comando/.test(r.yellow), 'rojo + amarillo: comandos');
  }

  console.log('\n  Y los tres textos son distintos entre movimientos');
  {
    const t = {};
    for (const l of ['sq', 'bp', 'dl']) t[l] = (await p.evaluate(LEER, l)).red;
    ok(new Set(Object.values(t)).size === 3, 'el rojo+rojo dice algo distinto en cada uno');
  }

  console.log('\n  Se puede deslizar a mano a cualquiera de las tres');
  {
    for (const [i, nombre] of [[2, 'peso muerto'], [1, 'banca'], [0, 'sentadilla']]) {
      await p.evaluate(x => {
        const c = document.getElementById('motBody');
        c.scrollLeft = x * c.clientWidth;
      }, i);
      await p.waitForTimeout(150);
      const r = await p.evaluate(DONDE);
      ok(r.i === i && r.punto === i, 'deslizando llega a ' + nombre + ' y el puntito la sigue');
    }
  }

  console.log('\nLa del movimiento en tarima se trae sola al frente');
  {
    for (const [l, i, nombre] of [['dl', 2, 'peso muerto'], ['bp', 1, 'banca'], ['sq', 0, 'sentadilla']]) {
      await p.evaluate(x => pintarMotivos(x), l);
      await p.waitForTimeout(450);   // el deslizado es suave
      const r = await p.evaluate(DONDE);
      ok(r.i === i && r.punto === i, 'con ' + nombre + ' en tarima queda esa a la vista');
    }
    // Y sin movimiento conocido no se mueve de donde esté: no le saca la guía de
    // las manos al juez que estaba leyendo otra.
    await p.evaluate(() => { const c = document.getElementById('motBody'); c.scrollLeft = 2 * c.clientWidth; });
    await p.waitForTimeout(150);
    await p.evaluate(() => pintarMotivos(null));
    await p.waitForTimeout(200);
    ok((await p.evaluate(DONDE)).i === 2, 'y sin atleta en tarima no se mueve sola');
  }
  ok(/if\(d\.athlete_lift&&d\.athlete_lift!==_liftActual\)\{_liftActual=d\.athlete_lift;pintarMotivos\(_liftActual\);\}/.test(src),
     'se repinta cuando el livecast avisa que cambió el movimiento');
  {
    // Y el aviso tiene que SALIR del control en vivo. Antes ese dato viajaba solo
    // dentro de resetJudgeLights(), que corre nada más si el modo jueces está
    // encendido: como no se usa, el movimiento nunca llegaba y el bloque se veía
    // siempre vacío. Es la causa de que la explicación "no estuviera".
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/async function _avisarAtletaAJueces\(\)\{/.test(lc),
       'el control en vivo tiene su propio aviso, fuera del modo jueces');
    // Se mira el bloque, no la línea exacta: ahí adentro se fue sumando más de
    // una cosa (también se anotan las luces de cada intento) y una comprobación
    // pegada al texto se rompía sola.
    const bloque = lc.slice(lc.indexOf("if(isAdmin&&DATA.phase==='compete')"),
                            lc.indexOf("if(isAdmin&&DATA.phase==='compete')") + 320);
    ok(/isAdmin&&DATA\.phase==='compete'/.test(bloque) && /_avisarAtletaAJueces\(\)/.test(bloque),
       'y sale desde el puesto que opera, en la pantalla de competencia');
    const f = lc.slice(lc.indexOf('async function _avisarAtletaAJueces'),
                       lc.indexOf('async function resetJudgeLights'));
    ok(/\{merge:true\}/.test(f),
       'escribe con merge: no puede apagarle una luz a nadie a mitad de un intento');
    ok(!/izq:|central:|der:|reset_ts/.test(f), 'y no toca los votos ni el reset');
    ok(/if\(firma===_juezUltAtleta\)return;/.test(f),
       'solo escribe cuando cambió el atleta, el movimiento o el intento');
    ok(/athlete_lift:lift,/.test(f), 'y manda el movimiento, que es lo que faltaba');
  }

  console.log('\nSe puede plegar y queda guardado en ese teléfono');
  {
    await p.evaluate(() => toggleMotivos());
    let r = await p.evaluate(DONDE);
    ok(r.cerrado, 'se cierra');
    const vis = await p.evaluate(() => getComputedStyle(document.querySelector('.motivos-body')).display);
    ok(vis === 'none', 'y el texto deja de ocupar lugar');
    const guardado = await p.evaluate(() => localStorage.getItem('_yl_jueces_motivos'));
    ok(guardado === '0', 'la elección queda guardada');
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof pintarMotivos === 'function', null, { timeout: 20000 });
    r = await p.evaluate(DONDE);
    ok(r.cerrado, 'y al volver a entrar sigue cerrado');
    await p.evaluate(() => toggleMotivos());
    ok(!(await p.evaluate(DONDE)).cerrado, 'se vuelve a abrir');
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

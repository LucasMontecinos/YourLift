// Las luces quedan anotadas en cada intento, y su banda en el control remoto.
//
// Las luces de los jueces son de paso: el documento guarda solo las de ahora y a
// los cinco segundos se borra. Así, cuando el atleta iba por el segundo intento
// ya no había forma de saber qué luces le habían dado en el primero.
//
// Ahora se anotan en el propio intento cuando llegan, y el scoreboard las
// muestra debajo del peso: tres blancas si fue válido, tres rojas si fue nulo, y
// bajo cada roja el circulito del color de la tarjeta.
//
// Lo que se cuida:
//   · que esto NO dé válido ni nulo — el resultado lo sigue dando el operador;
//   · que se anoten en el atleta que estaba en la barra cuando empezaron a
//     votar, no en el que quedó al frente cuando terminaron;
//   · y que si no hay luces, no aparezca nada: en un campeonato sin luces el
//     scoreboard tiene que quedar igual que siempre.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_luceshistorial.js
const fs = require('fs');
const { chromium } = require('playwright');
const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

console.log('\nAnotar las luces no es decidir el intento');
{
  const f = lc.slice(lc.indexOf('let _lucesHistUnsub'), lc.indexOf('function _lucesDeIntento'));
  ok(f.length > 100, 'el que las anota está escrito aparte');
  ok(!/setResult|changeResult|\.r=/.test(f),
     'y no toca el resultado del intento: eso lo sigue dando el operador');
  ok(/at\.luces=L;/.test(f), 'solo guarda lo que marcaron los jueces');
  ok(/saveNow\(\)/.test(f), 'y lo sincroniza como cualquier otro dato');
  // El listener del modo jueces, el que SÍ decide, sigue siendo otro y aparte.
  ok(/function startJudgeListener\(\)\{/.test(lc), 'el modo jueces sigue existiendo');
  ok(/if\(judgeMode\)resetJudgeLights\(\);/.test(lc), 'y sigue siendo cosa suya');
}

console.log('\n  Se anotan en el atleta que estaba en la barra');
{
  // Es el detalle fino: si el operador marca el resultado antes de que vote el
  // tercer juez, la cola avanza. Fijando el destino con la PRIMERA luz, las
  // luces igual quedan donde corresponde.
  const f = lc.slice(lc.indexOf('let _lucesHistUnsub'), lc.indexOf('function _lucesDeIntento'));
  ok(/if\(!_lucesHistDestino\)\{/.test(f), 'el destino se fija con la primera luz');
  ok(/if\(cuantas<3\)return;/.test(f), 'y se escribe recién cuando votaron los tres');
  ok(/if\(cuantas===0\)\{_lucesHistDestino=null;return;\}/.test(f),
     'al apagarse las luces queda listo para el intento siguiente');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto('http://localhost:8972/livecast.html?tx=director', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof renderTxLucesBanda === 'function'
    && typeof _lucesDeIntento === 'function', null, { timeout: 20000 });

  const montar = () => p.evaluate(() => {
    DATA.event = { id: 'ev', name: 'Prueba' };
    DATA.athletes = [{ id: 1, name: 'Atleta Uno', lot: 1, flight: 'A', div: 'Open', cat: '83',
      bw: 82, sex: 'M', club: 'Club',
      att: { sq: [{ w: 150, r: null }, { w: 160, r: null }, { w: 0, r: null }],
             bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
             dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }];
    DATA.flight = 'A'; DATA.lift = 'sq'; DATA.round = 0;
  });

  console.log('\nLos circulitos de un intento');
  {
    await montar();
    const r = await p.evaluate(() => ({
      sin: _lucesDeIntento({ w: 150 }, 9),
      incompleto: _lucesDeIntento({ w: 150, luces: { izq: 'white', central: null, der: null } }, 9),
      blancas: _lucesDeIntento({ w: 150, luces: { izq: 'white', central: 'white', der: 'white' } }, 9),
      rojas: _lucesDeIntento({ w: 150, luces: { izq: 'red', central: 'red', der: 'red' } }, 9),
      mixto: _lucesDeIntento({ w: 150, luces: { izq: 'white', central: 'blue', der: 'yellow' } }, 9),
    }));
    ok(r.sin === '', 'sin luces guardadas no dibuja nada');
    ok(r.incompleto === '', 'con luces a medias tampoco: o están las tres o no va nada');
    ok((r.blancas.match(/background:#fff/g) || []).length === 3, 'válido: tres circulitos blancos');
    ok(!/#3b82f6|#f59e0b/.test(r.blancas), 'y sin ningún chip de color debajo');
    ok((r.rojas.match(/background:#ef4444/g) || []).length === 3, 'nulo: tres circulitos rojos');
    ok(/#3b82f6/.test(r.mixto) && /#f59e0b/.test(r.mixto),
       'y bajo cada roja va el color de la tarjeta: azul y amarillo');
    ok((r.mixto.match(/background:#fff/g) || []).length === 1,
       'con la blanca del juez que sí lo dio por válido');
  }

  console.log('\n  Y aparecen en el scoreboard debajo del peso');
  {
    ok(/const lucesAt=_lucesDeIntento\(at,9\);/.test(lc), 'el scoreboard las pide por intento');
    ok(/\(lucesAt\?'<div style="margin-top:3px;text-decoration:none">'\+lucesAt\+'<\/div>':''\)/.test(lc),
       'y las pone debajo del peso');
    ok(/text-decoration:none/.test(lc.slice(lc.indexOf('const lucesAt='), lc.indexOf('const lucesAt=') + 900)),
       'sin que les llegue la tachadura del intento nulo');
    // Se dibuja de verdad, con un intento que tiene luces.
    const r = await p.evaluate(() => {
      DATA.athletes[0].att.sq[0].r = 'n';
      DATA.athletes[0].att.sq[0].luces = { izq: 'red', central: 'blue', der: 'red' };
      DATA.round = 1;
      const html = renderTxScoreboard(DATA.athletes[0], false);
      return { html, tiene: html.indexOf('#3b82f6') > 0 };
    });
    ok(r.tiene, 'el scoreboard dibujado trae el chip azul del primer intento');
  }

  console.log('\nLa banda de luces del control remoto');
  {
    await montar();
    const r = await p.evaluate(() => {
      const out = {};
      _txLights = { izq: null, central: null, der: null };
      out.apagado = renderTxLucesBanda();
      _txLights = { izq: 'white', central: 'white', der: 'white' };
      out.blancas = renderTxLucesBanda();
      _txLights = { izq: 'red', central: 'blue', der: 'yellow' };
      out.nulo = renderTxLucesBanda();
      return out;
    });
    ok(r.apagado === '',
       'mientras no hay decisión no dibuja nada: por eso se puede dejar prendida toda la competencia');
    ok(r.blancas.length > 500, 'al llegar la decisión aparece sola');
    ok(/Atleta Uno/.test(r.blancas), 'con el nombre del atleta');
    ok(/SQ 1 · 150 KG/.test(r.blancas), 'y el movimiento, el intento y el peso');
    ok(/#3b82f6/.test(r.nulo) && /#f59e0b/.test(r.nulo),
       'y los chips de color cuando el nulo fue con tarjeta azul o amarilla');
  }

  console.log('\n  Está en el control remoto y en el panel');
  {
    ok(/bigBtn\('LUCES'/.test(lc), 'el botón está en el control remoto');
    ok(/ARMADO · aparece al decidir/.test(lc), 'y dice que queda armado, no encendido');
    ok(/compToggle\('luces'/.test(lc), 'y también en el panel del director');
    ok(/dirToggle\('luces'\)/.test(lc), 'los dos lo prenden y apagan igual');
    ok(/if\(k==='u'\)\{e\.preventDefault\(\);window\.dirToggle\('luces'\);return\}/.test(lc),
       'con su tecla, para el Stream Deck');
    ok(/'medals','luces'\]/.test(lc), 'y al limpiar todo también se apaga');
  }

  console.log('\n  Entra con el mismo barrido que los demás');
  {
    ok(/const comps=\['profile','scoreboard','leaderboard','timer','breakTimer','tablaActual','medals','luces'\]/.test(lc),
       'entra en la lista de transiciones');
    const bloque = lc.slice(lc.indexOf("const showLuces=_txDirActive('luces')"),
                            lc.indexOf('// Medallero (Top 3)'));
    ok(/txSlideInBottom/.test(bloque) && /txSlideOutBottom/.test(bloque),
       'sube desde abajo y se va igual, como la tabla actual y el medallero');
    ok(/_txStartLightsListener\(\)/.test(bloque), 'y se engancha a las luces en vivo');
  }

  console.log('\n  El widget se redibuja cuando cambian las luces');
  {
    // Si la firma no las incluyera, la banda quedaría congelada en la primera
    // decisión de la jornada.
    ok(/\+'\|luz-'\+\(_txLights\.izq\|\|''\)\+\(_txLights\.central\|\|''\)\+\(_txLights\.der\|\|''\)/.test(lc),
       'las luces entran en la firma del redibujado');
    ok(/_txDirActive\('luces'\)\]\.join\('\|'\)/.test(lc), 'y también si el componente está prendido');
  }


console.log('\nEl tamaño se puede cambiar de verdad');
{
  // Esto falló en competencia: mover el tamaño de la Tabla Actual o del
  // Medallero no hacía nada. Eran dos cosas apiladas.
  //
  // Una: la escala de esos dos no entraba en la firma que decide si hay que
  // redibujar, así que el widget se saltaba el redibujado y no pasaba nada.
  const sig = lc.slice(lc.indexOf("+'|sc-'+"), lc.indexOf("+'|col-'"));
  ['profile', 'scoreboard', 'leaderboard', 'timer', 'slam', 'breakTimer',
   'tablaActual', 'medals', 'luces'].forEach(k =>
    ok(sig.indexOf('_txDirState.' + k + '?.scale') > 0,
       'la escala de ' + k + ' entra en la firma del redibujado'));

  // Y otra: la escala iba en el MISMO elemento que la animación de entrada. Los
  // fotogramas animan transform y terminan con "forwards", así que el último
  // fotograma pisaba la escala para siempre.
  const capas = (bloque) => {
    const anim = /animation:txSlide/.test(bloque);
    const escalaEnLaMisma = /transform:scale\([^)]*\);transform-origin:[^;]*;'\+\w*Anim/.test(bloque);
    return { anim, escalaEnLaMisma };
  };
  const ta = lc.slice(lc.indexOf('const taScale=_txDirState.tablaActual'), lc.indexOf('// Medallero (Top 3)'));
  ok(capas(ta).anim, 'la Tabla Actual entra con animación');
  ok(!capas(ta).escalaEnLaMisma, 'y su escala ya NO comparte elemento con ella');
  ok(/transform:scale\('\+taScale\+'\);transform-origin:bottom right/.test(ta),
     'va en una capa propia');

  const mdI = lc.indexOf('const mdScale=md.scale||1;');
  const md = lc.slice(mdI, mdI + 800);
  ok(!capas(md).escalaEnLaMisma, 'el Medallero, lo mismo');
  ok(/transform:scale\('\+mdScale\+'\);transform-origin:bottom center/.test(md),
     'con su capa propia');

  const lzI = lc.indexOf('const lzScale=_txDirState.luces');
  const lz = lc.slice(lzI, lzI + 700);
  ok(/transform:scale\('\+lzScale\+'\);transform-origin:bottom left/.test(lz),
     'y las luces nacen ya con la escala en su capa');
}

console.log('\n  Las luces van abajo a la izquierda');
{
  ok(/position:fixed;left:34px;bottom:48px;transform-origin:bottom left/.test(lc),
     'la banda se ancla en la esquina de abajo a la izquierda');
  ok(!/left:50%;bottom:48px;transform:translateX\(-50%\)/.test(lc),
     'ya no queda centrada, donde chocaba con el scoreboard');
  ok(/abajo a la izquierda/.test(lc), 'y el panel dice dónde va');
  ok(/El tamaño se ajusta acá abajo/.test(lc), 'y que el tamaño se ajusta ahí mismo');
}

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

// Lo que elige el operador tiene que LLEGAR a la pantalla.
//
// Se probó en competencia y no se veía nada: las luces prendidas en el panel no
// aparecían en la tarima, y "Atleta en barra" salía azul aunque el fondo estuviera
// puesto en bandera. No era ni el fondo ni las luces: era el camino entre los dos.
//
// El panel guardaba bien `fondo` y `luces` en Firestore, pero la pantalla, al
// recibir el documento, rearmaba su estado copiando solo `mode`, `flights` y
// `nameScale`. Los otros dos quedaban en undefined, así que la pantalla creía que
// las luces estaban apagadas y que el fondo era el de siempre.
//
// El error es fácil de repetir: cada vez que se agregue una opción al panel hay
// que acordarse de copiarla en el otro lado. Por eso la prueba no mira las dos
// opciones de hoy, sino que compara las dos listas.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_pantallaestado.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Simula el documento que el panel dejó en Firestore y lo hace pasar por el mismo
// armado que usa la pantalla al recibirlo.
const RECIBIR = `(doc)=>{
  // Es el cuerpo del onSnapshot de subscribeScreenChannel, tal cual.
  const d=doc||{};
  window._SCREEN_STATE={mode:d.mode||'jornada',
    flights:Array.isArray(d.flights)?d.flights:null,
    nameScale:typeof d.nameScale==='number'?d.nameScale:1,
    fondo:d.fondo||'bandera',luces:!!d.luces,
    veloBandera:typeof d.veloBandera==='number'?d.veloBandera:0.55};
  return window._SCREEN_STATE;
}`;

// Cuenta las luces dibujadas y el punto de tarjeta que lleva cada una.
const LUCES = `(borde)=>{
  const luces=[...document.querySelectorAll('div')].filter(e=>{
    const s=e.getAttribute('style')||'';
    return /border-radius:50%/.test(s) && s.indexOf('border:'+borde+' solid')>=0;
  });
  return luces.map(l=>{
    const s=l.getAttribute('style')||'';
    const color=/background:#fff/.test(s)?'blanca':(/background:#ef4444/.test(s)?'roja':'apagada');
    // El punto de la tarjeta es el hermano de abajo, dentro de la misma columna.
    const col=l.parentElement;
    const punto=col?[...col.children].find(c=>c!==l):null;
    const ps=punto?(punto.getAttribute('style')||''):'';
    const chip=/background:#ef4444/.test(ps)?'rojo'
      :(/background:#3b82f6/.test(ps)?'azul'
      :(/background:#f59e0b/.test(ps)?'amarillo':'sin punto'));
    return {color:color,chip:chip};
  });
}`;

const MONTAR = `(()=>{
  const n9=()=>({sq:[{w:250,r:null},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  const a={id:1,name:'Juan Exaquiel Suarez',lot:1,flight:'A',sex:'Hombre',cat:'74',
    div:'Special Olympics',mod:'classic',bw:73,club:'',country:'ARG',bombed:false,att:n9()};
  DATA.athletes=[a]; DATA.lift='sq'; DATA.round=0; DATA.flight='A';
  DATA.event={id:'x',name:'Prueba',logoUrl:''};
  return true;
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=screen&evento=suda2026_fesupo_full',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
    null, { timeout: 20000 });
  await p.evaluate(MONTAR);

  const recibir = d => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [RECIBIR, d]);

  console.log('\nLo que manda el panel llega entero');
  {
    const st = await recibir({ mode: 'barra', fondo: 'bandera', luces: true, nameScale: 1.2, flights: ['A'] });
    ok(st.luces === true, 'las luces prendidas llegan prendidas');
    ok(st.fondo === 'bandera', 'el fondo elegido llega como se eligió: ' + st.fondo);
    ok(st.mode === 'barra', 'y el modo también');
  }
  {
    const st = await recibir({ mode: 'barra', fondo: 'logo', luces: false });
    ok(st.luces === false, 'apagadas llegan apagadas');
    ok(st.fondo === 'logo', 'y el fondo del logo no se pierde');
  }

  console.log('\n  Ninguna opción del panel se queda en el camino');
  {
    // El panel arma su estado en _SCREEN_LOCAL y lo publica con _screenPush.
    const local = (src.match(/window\._SCREEN_LOCAL=\{([^}]*)\}/) || [])[1] || '';
    const claves = local.split(',').map(s => s.split(':')[0].trim()).filter(Boolean);
    const recibidas = await p.evaluate(() => Object.keys(window._SCREEN_STATE));
    const faltan = claves.filter(k => recibidas.indexOf(k) < 0);
    ok(faltan.length === 0,
       'el panel manda ' + claves.length + ' opciones y la pantalla las recibe todas'
       + (faltan.length ? ' — FALTAN: ' + faltan.join(', ') : ''));
  }

  console.log('\nEl fondo de bandera se dibuja de verdad');
  {
    await recibir({ mode: 'barra', fondo: 'bandera', luces: false });
    const r = await p.evaluate(() => {
      const html = renderScreenBarra(DATA.athletes[0]);
      return { bandera: /data:image\/svg\+xml/.test(html), azulSolo: /background:linear-gradient\(160deg/.test(html) };
    });
    ok(r.bandera, 'la bandera del país queda de fondo, no el azul liso');
  }
  {
    await recibir({ mode: 'barra', fondo: 'yourlift', luces: false });
    const r = await p.evaluate(() => /data:image\/svg\+xml/.test(renderScreenBarra(DATA.athletes[0])));
    ok(!r, 'y con el azul YourLift elegido, no aparece bandera');
  }

  console.log('\nLas luces se dibujan en las pantallas de atleta');
  for (const modo of ['barra', 'intentos']) {
    await recibir({ mode: modo, fondo: 'bandera', luces: true });
    await p.evaluate(() => { _txLights = { izq: 'white', central: 'white', der: 'red' }; renderTxWidget(); });
    const n = await p.evaluate(() => [...document.querySelectorAll('div')]
      .filter(e => /border-radius:50%/.test(e.getAttribute('style') || '')
                && /border:4px solid/.test(e.getAttribute('style') || '')).length);
    ok(n === 3, modo + ': las tres luces en pantalla (' + n + ')');
  }

  console.log('\nLos tres nulos son distintos: la tarjeta se ve');
  {
    const leerLuces = bd => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [LUCES, bd]);
    await recibir({ mode: 'barra', fondo: 'bandera', luces: true });
    await p.evaluate(() => { _txLights = { izq: 'red', central: 'blue', der: 'yellow' }; renderTxWidget(); });
    const r = await leerLuces('4px');
    ok(r.length === 3, 'las tres luces (' + r.length + ')');
    ok(r.every(x => x.color === 'roja'),
       'azul y amarillo TAMBIÉN encienden la luz roja — antes salían apagadas, como si el juez no hubiera votado ('
       + r.map(x => x.color).join(', ') + ')');
    ok(r.map(x => x.chip).join(',') === 'rojo,azul,amarillo',
       'y cada una lleva abajo el punto de su tarjeta (' + r.map(x => x.chip).join(', ') + ')');
  }
  {
    const leerLuces = bd => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [LUCES, bd]);
    await p.evaluate(() => { _txLights = { izq: 'white', central: 'white', der: 'red' }; renderTxWidget(); });
    const r = await leerLuces('4px');
    ok(r[0].chip === 'sin punto' && r[1].chip === 'sin punto',
       'el intento válido no lleva punto: no hay nada que explicar');
    ok(r[2].chip === 'rojo', 'y el nulo sí lo lleva');
  }
  {
    const leerLuces = bd => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [LUCES, bd]);
    await p.evaluate(() => { _txLights = { izq: null, central: null, der: null }; renderTxWidget(); });
    const r = await leerLuces('4px');
    ok(r.every(x => x.color === 'apagada' && x.chip === 'sin punto'),
       'sin votos, las tres apagadas y sin puntos');
  }

  console.log('\nLa pantalla nueva: solo las luces');
  {
    await recibir({ mode: 'luces' });
    await p.evaluate(() => { _txLights = { izq: 'white', central: 'red', der: 'white' }; renderTxWidget(); });
    const r = await p.evaluate(() => {
      const luces = [...document.querySelectorAll('div')]
        .filter(e => /border:7px solid/.test(e.getAttribute('style') || ''));
      return { n: luces.length, txt: document.getElementById('txWidget').innerText,
        colores: luces.map(e => {
          const s = e.getAttribute('style') || '';
          return /background:#fff/.test(s) ? 'blanca' : (/background:#ef4444/.test(s) ? 'roja' : 'apagada');
        }) };
    });
    ok(r.n === 3, 'se ven las tres luces grandes (' + r.n + ')');
    ok(r.colores.join(',') === 'blanca,roja,blanca', 'con lo que marcó cada juez (' + r.colores.join(', ') + ')');
    ok(/SUAREZ|Suarez/i.test(r.txt), 'y arriba dice de quién es el intento');
    ok(/SQ 1/.test(r.txt), 'con el movimiento y el número de intento: ' + r.txt.replace(/\n/g, ' · ').slice(0, 60));
  }

  console.log('\n  Sigue siendo un espejo: no juzga');
  {
    const antes = await p.evaluate(() => JSON.stringify(DATA.athletes[0].att.sq[0]));
    await p.evaluate(() => { _txLights = { izq: 'white', central: 'white', der: 'white' }; renderTxWidget(); });
    const despues = await p.evaluate(() => JSON.stringify(DATA.athletes[0].att.sq[0]));
    ok(antes === despues, 'tres blancas y el intento sigue sin juzgar: ' + despues);
  }
  const iL = src.indexOf('function renderScreenLuces(');
  const cuerpo = src.slice(iL, src.indexOf('\n}', iL));
  ok(!/setDoc|updateDoc|setAtt|updA|_markAtt/.test(cuerpo), 'la pantalla de luces no escribe nada');

  console.log('\n  La pantalla grande también muestra la tarjeta');
  {
    await recibir({ mode: 'luces' });
    await p.evaluate(() => { _txLights = { izq: 'blue', central: 'yellow', der: 'white' }; renderTxWidget(); });
    const r = await p.evaluate(([f, x]) => eval('(' + f + ')')(x), [LUCES, '7px']);
    ok(r.map(x => x.chip).join(',') === 'azul,amarillo,sin punto',
       'los puntos siguen a los jueces (' + r.map(x => x.chip).join(', ') + ')');
    ok(r[0].color === 'roja' && r[2].color === 'blanca', 'y la luz de arriba es roja en los nulos, blanca en el válido');
  }

  console.log('\nSe puede regular cuánto se difumina la bandera');
  {
    const opac = async v => {
      await recibir({ mode: 'barra', fondo: 'bandera', veloBandera: v });
      return p.evaluate(() => {
        const f = _fondoBarra(DATA.athletes[0], 'bandera');
        const m = f.match(/rgba\(10,22,40,([\d.]+)\)/);
        return m ? parseFloat(m[1]) : null;
      });
    };
    const claro = await opac(0.2), normal = await opac(0.55), tapado = await opac(0.85);
    ok(claro < normal && normal < tapado,
       'el deslizador cambia de verdad el velo (' + claro + ' → ' + normal + ' → ' + tapado + ')');
    ok(claro === 0.2 && tapado === 0.85, 'y llega a los dos extremos');
    const porDefecto = await p.evaluate(() => {
      window._SCREEN_STATE = { mode: 'barra', fondo: 'bandera' };  // sin el dato
      const m = _fondoBarra(DATA.athletes[0], 'bandera').match(/rgba\(10,22,40,([\d.]+)\)/);
      return parseFloat(m[1]);
    });
    ok(porDefecto === 0.55, 'y si el campeonato es viejo y no lo tiene guardado, queda en el normal');
  }
  ok(/window\.screenSetVelo=function/.test(src), 'el deslizador existe en el panel');
  ok(!/screenSetVelo=function[\s\S]{0,400}R\(\);/.test(src),
     'y no re-dibuja el panel mientras se arrastra, para no cortarlo');

  console.log('\nEstá en el panel para elegirla');
  ok(/mb\('luces','LUCES JUECES'/.test(src), 'aparece el botón "LUCES JUECES"');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

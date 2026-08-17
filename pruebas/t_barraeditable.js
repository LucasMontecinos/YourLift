// Mover y redimensionar lo que hay en "Atleta en barra".
//
// La pantalla estaba armada con una columna fija: el nombre al medio, el peso
// arriba a la derecha, los datos abajo. Servía, pero cada gimnasio tiene su
// pantalla y su distancia, y no había forma de correr nada.
//
// La Pantalla de Intentos ya tenía este editor, así que en vez de escribir otro
// se generalizó el que había: el que arrastra y redimensiona ahora trabaja sobre
// cualquier pantalla marcada como lienzo.
//
// Lo que hay que cuidar:
//   · que de fábrica se vea igual que antes — nadie pidió que le cambien la
//     pantalla, pidió poder moverla;
//   · que sin nada seleccionado quede limpia, sin bordes ni manijas, porque esto
//     se proyecta en competencia;
//   · y que acomodar una pantalla no desacomode la otra.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_barraeditable.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MONTAR = `(rec)=>{
  const n9=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:0,r:null},{w:0,r:null},{w:92,r:null}],
                 dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  DATA.athletes=[{id:1,name:'Emilse Ojeda Fernandez',lot:1,flight:'A',sex:'Mujer',cat:'63',
    div:'Junior',mod:'classic',bw:62,club:'',country:'ARG',bombed:false,att:n9()}];
  DATA.lift='bp'; DATA.round=2; DATA.flight='A';
  // records:'suda' es lo que hace que exista la etiqueta de récord; sin eso el
  // cartel no se dibuja aunque el intento lo rompa.
  DATA.event={id:'x',name:'Sudamericano',logoUrl:'',records:'suda'};
  window._SCREEN_STATE={mode:'barra',fondo:'bandera',luces:true,veloBandera:0.55};
  _txLights={izq:'white',central:'red',der:'white'};
  window._esIntentoRecord=function(){return !!rec;};
  renderTxWidget();
}`;

// Se mide el .pi-inner, no el bloque de afuera: el tamaño se aplica con un
// transform:scale(), y un transform no cambia la caja del contenedor. Midiendo
// el de afuera, agrandar un bloque no se nota.
const CAJA = `(k)=>{
  const el=document.querySelector('.pi-block[data-pi-key="'+k+'"]');
  if(!el)return null;
  const r=(el.querySelector('.pi-inner')||el).getBoundingClientRect();
  return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2),
          w:Math.round(r.width), h:Math.round(r.height)};
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=screen&evento=suda2026_fesupo_full',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function',
    null, { timeout: 20000 });
  const montar = rec => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [MONTAR, !!rec]);
  const caja = k => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [CAJA, k]);
  await montar(false);

  console.log('\nCada cosa de la pantalla es un bloque');
  {
    const ks = await p.evaluate(() => [...document.querySelectorAll('.pi-block')].map(e => e.getAttribute('data-pi-key')));
    for (const k of ['bSigla', 'bPeso', 'bNombre', 'bPais', 'bDatos', 'bLuces'])
      ok(ks.indexOf(k) >= 0, k + ' se puede agarrar');
    ok(await p.evaluate(() => !!document.querySelector('.pi-canvas')), 'y la pantalla es un lienzo');
  }
  {
    await montar(true);
    const ks = await p.evaluate(() => [...document.querySelectorAll('.pi-block')].map(e => e.getAttribute('data-pi-key')));
    ok(ks.indexOf('bRecord') >= 0, 'el cartel de récord también, cuando aparece');
    await montar(false);
  }

  console.log('\nDe fábrica se ve como antes');
  {
    const sigla = await caja('bSigla'), peso = await caja('bPeso'),
          nom = await caja('bNombre'), datos = await caja('bDatos'), luces = await caja('bLuces');
    ok(sigla.x < 300 && sigla.y < 200, 'la sigla del movimiento arriba a la izquierda');
    ok(peso.x > 980 && peso.y < 200, 'el peso arriba a la derecha');
    ok(Math.abs(nom.x - 640) < 60 && nom.y > 250 && nom.y < 420, 'el nombre grande al medio');
    ok(datos.y > nom.y, 'la categoría debajo del nombre');
    ok(luces.y > datos.y, 'y las luces al final');
  }

  console.log('\nSe elige, se mueve y se agranda');
  {
    const antes = await caja('bNombre');
    await p.click('.pi-block[data-pi-key="bNombre"]');
    const sel = await p.evaluate(() => ({
      elegido: window._piSelected,
      borde: /outline/.test(document.querySelector('.pi-block[data-pi-key="bNombre"]').getAttribute('style') || ''),
      manija: !!document.querySelector('.pi-resize[data-pi-key="bNombre"]'),
    }));
    ok(sel.elegido === 'bNombre', 'un click lo selecciona');
    ok(sel.borde, 'se le marca el borde');
    ok(sel.manija, 'y aparece la manija para el tamaño');

    // Arrastrarlo 200 px a la izquierda y 120 arriba.
    await p.mouse.move(antes.x, antes.y);
    await p.mouse.down();
    await p.mouse.move(antes.x - 200, antes.y - 120, { steps: 12 });
    await p.mouse.up();
    const despues = await caja('bNombre');
    ok(Math.abs(despues.x - (antes.x - 200)) < 25, 'se movió a donde se lo llevó (x ' + antes.x + '→' + despues.x + ')');
    ok(Math.abs(despues.y - (antes.y - 120)) < 25, 'y en vertical también (y ' + antes.y + '→' + despues.y + ')');

    const escalaAntes = await p.evaluate(() => window._piLayout.bNombre.scale);
    const man = await p.evaluate(() => {
      const r = document.querySelector('.pi-resize[data-pi-key="bNombre"]').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await p.mouse.move(man.x, man.y);
    await p.mouse.down();
    await p.mouse.move(man.x, man.y + 100, { steps: 10 });
    await p.mouse.up();
    const escalaDespues = await p.evaluate(() => window._piLayout.bNombre.scale);
    ok(escalaDespues > escalaAntes, 'la manija lo agranda (' + escalaAntes + ' → ' + escalaDespues + ')');
    const grande = await caja('bNombre');
    ok(grande.w > despues.w, 'y se ve más grande de verdad (' + despues.w + ' → ' + grande.w + ' px)');
  }

  console.log('\n  Y queda guardado');
  {
    const guardado = await p.evaluate(() => JSON.parse(localStorage.getItem('yl_pant_intentos_layout') || '{}'));
    ok(guardado.bNombre && guardado.bNombre.scale > 100, 'el tamaño se guardó');
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof renderTxWidget === 'function', null, { timeout: 20000 });
    await montar(false);
    const tras = await p.evaluate(() => window._piLayout.bNombre);
    ok(tras.scale > 100 && tras.x < 50, 'y al volver a abrir la pantalla sigue como se dejó');
  }

  console.log('\nSin nada seleccionado, la pantalla queda limpia para proyectar');
  {
    await p.click('.pi-block[data-pi-key="bPeso"]');
    ok(await p.evaluate(() => window._piSelected) === 'bPeso', 'se selecciona otro');
    // Un punto vacío de verdad: al medio-derecha no hay ningún bloque. (En el
    // centro de abajo están las luces, y a lo ancho del 68% pasa la línea.)
    await p.mouse.click(1150, 380);
    const limpio = await p.evaluate(() => ({
      sel: window._piSelected,
      bordes: [...document.querySelectorAll('.pi-block')].filter(e => /outline/.test(e.getAttribute('style') || '')).length,
      manijas: document.querySelectorAll('.pi-resize').length,
    }));
    ok(limpio.sel === null, 'click en el fondo deselecciona');
    ok(limpio.bordes === 0, 'no queda ningún borde a la vista');
    ok(limpio.manijas === 0, 'ni ninguna manija');
  }

  console.log('\nRestablecer una pantalla no desacomoda la otra');
  {
    await p.evaluate(() => {
      window._piLayout.weight.x = 12;        // de Pantalla de Intentos
      window._piLayout.bPeso.x = 12;         // de Atleta en barra
    });
    p.on('dialog', d => d.accept());
    await p.evaluate(() => barraResetLayout());
    const r = await p.evaluate(() => ({ intentos: window._piLayout.weight.x, barra: window._piLayout.bPeso.x }));
    ok(r.barra === 91, '"Atleta en barra" vuelve a fábrica (bPeso x=' + r.barra + ')');
    ok(r.intentos === 12, 'y la Pantalla de Intentos queda como estaba (weight x=' + r.intentos + ')');
    await p.evaluate(() => piResetLayout());
    const r2 = await p.evaluate(() => window._piLayout.weight.x);
    ok(r2 === 50, 'y al revés también: restablecer Intentos la deja en su lugar (' + r2 + ')');
  }

  console.log('\nLas luces siguen siendo un espejo');
  {
    await montar(false);
    const antes = await p.evaluate(() => JSON.stringify(DATA.athletes[0].att.bp[2]));
    await p.click('.pi-block[data-pi-key="bLuces"]');
    await p.mouse.click(1150, 380);
    const despues = await p.evaluate(() => JSON.stringify(DATA.athletes[0].att.bp[2]));
    ok(antes === despues, 'moverlas no juzga el intento: ' + despues);
  }
  {
    const i = src.indexOf('function renderScreenBarra');
    const cuerpo = src.slice(i, src.indexOf('\n}', i));
    ok(!/setAtt|_markAtt|updateDoc/.test(cuerpo), 'y la pantalla sigue sin escribir nada');
  }

  console.log('\nNo se dibujan dos veces');
  {
    const n = await p.evaluate(() => document.querySelectorAll('.pi-block[data-pi-key="bLuces"]').length);
    ok(n === 1, 'las luces aparecen una sola vez (' + n + ')');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

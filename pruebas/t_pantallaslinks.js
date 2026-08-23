// Un link por pantalla de tarima, y corregir el nombre de un atleta.
//
// 1) Todas las pantallas de tarima compartían el mismo canal: dos televisores
//    con el mismo link mostraban siempre lo mismo, y al cambiar lo que se veía
//    en uno se le cambiaba también al otro. Ahora el modo puede ir EN EL LINK, y
//    esa pantalla queda clavada en lo suyo.
//
//    Lo que se cuida: que la pantalla clavada siga obedeciendo el resto del
//    canal —fondo, difuminado, tandas, tamaño del nombre—, porque eso es lo que
//    el operador sí quiere ajustar desde el panel para todas a la vez. Y que el
//    link de siempre, sin modo, siga funcionando como antes.
//
// 2) Los nombres llegan mal escritos desde la inscripción y se ven en la tarima,
//    en la transmisión y en el acta. Ahora se corrigen desde la propia tabla.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_pantallaslinks.js
const fs = require('fs');
const { chromium } = require('playwright');
const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MODOS = ['profile', 'barra', 'intentos', 'jornada', 'luces', 'off'];

console.log('\nEl modo puede viajar en el link');
{
  ok(/const SCREEN_FIJO=\(\(\)=>\{/.test(lc), 'se lee del link al arrancar');
  const f = lc.slice(lc.indexOf('const SCREEN_FIJO'), lc.indexOf('const IS_OBS') > 0
    ? lc.indexOf('const IS_OBS') : lc.indexOf('const SCREEN_FIJO') + 700);
  MODOS.forEach(m => ok(f.indexOf("'" + m + "'") > 0, 'acepta ' + m));
  ok(/indexOf\(m\)>=0\?m:null/.test(f), 'y cualquier otra cosa se ignora');
  ok(/const st=SCREEN_FIJO\?Object\.assign\(\{\},canal,\{mode:SCREEN_FIJO\}\):canal;/.test(lc),
     'solo pisa el modo: el resto del canal se sigue obedeciendo');
}

console.log('\nEl panel da un link por pantalla');
{
  ok(/UN LINK POR PANTALLA/.test(lc), 'con su propio apartado');
  ok(/const fijo=\(m\)=>screenUrl\+'&modo='\+m;/.test(lc), 'y arma cada uno con su modo');
  ['intentos', 'luces', 'barra', 'profile', 'jornada']
    .forEach(m => ok(new RegExp("fila\\('" + m + "'").test(lc), 'ofrece el de ' + m));
  ok(/no cambia aunque se toquen los botones de abajo/.test(lc),
     'y explica para qué sirve');
  ok(/Si tienes más de una pantalla y cada una tiene que mostrar algo distinto/.test(lc),
     'y cuándo usar cada link');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });

  // Abre una pantalla de tarima y devuelve qué modo terminó mostrando.
  const abrir = async (query) => {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/firebasejs/**', r => r.abort());
    await p.goto('http://localhost:8972/livecast.html?tx=screen' + (query || ''),
      { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof renderTxScreen === 'function', null, { timeout: 20000 });
    return { p, errs };
  };

  // Se le dice al canal que muestre X y se mira qué dibujó realmente.
  const mostrar = async (p, delCanal) => p.evaluate((m) => {
    window._SCREEN_STATE = { mode: m, flights: null, nameScale: 1.6, fondo: 'liso', luces: true, veloBandera: 0.3 };
    DATA.event = { id: 'ev', name: 'Prueba' };
    DATA.athletes = [{ id: 1, name: 'Atleta Uno', lot: 1, flight: 'A', div: 'Open', cat: '83',
      bw: 82, sex: 'M', club: 'Club', att: { sq: [{ w: 100, r: null }, { w: 0, r: null }, { w: 0, r: null }],
      bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
      dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }];
    DATA.flight = 'A'; DATA.lift = 'sq'; DATA.round = 0;
    const c = document.getElementById('txWidget') || document.body;
    renderTxScreen(c);
    const t = c.innerText || '';
    return {
      vacio: !c.innerHTML.trim(),
      // El modo luces es el único que dibuja tres círculos grandes y no usa
      // el lienzo movible de la pantalla de barra.
      luces: c.querySelectorAll('[style*="border-radius:50%"]').length >= 3
             && !c.querySelector('.pi-canvas'),
      canvas: !!c.querySelector('.pi-canvas'),
      texto: t.slice(0, 120),
      html: c.innerHTML.length,
      nameScale: window._JORNADA_NAMESCALE,
    };
  }, delCanal);

  console.log('\nCon el modo en el link, el canal no la mueve');
  {
    const { p, errs } = await abrir('&modo=intentos');
    const a = await mostrar(p, 'intentos');
    const b2 = await mostrar(p, 'jornada');     // el operador cambia el canal…
    const c2 = await mostrar(p, 'off');         // …y hasta lo apaga
    ok(a.html > 0, 'la pantalla dibuja algo');
    ok(b2.html === a.html && c2.html === a.html,
       'y sigue mostrando exactamente lo mismo aunque el canal cambie a jornada y a apagado');
    ok(!c2.vacio, 'apagar el canal no la apaga a ella');
    ok(errs.length === 0, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await p.close();
  }

  console.log('\n  Cada link muestra lo suyo');
  {
    const vistas = {};
    for (const m of ['intentos', 'luces', 'barra', 'jornada']) {
      const { p } = await abrir('&modo=' + m);
      // El canal dice otra cosa a propósito: tiene que ganar el link.
      vistas[m] = await mostrar(p, 'jornada');
      await p.close();
    }
    ok(vistas.luces.luces, 'el link de luces muestra las luces');
    ok(vistas.barra.canvas, 'el de la barra muestra la pantalla movible');
    const firmas = Object.values(vistas).map(v => v.html);
    ok(new Set(firmas).size === firmas.length,
       'y las cuatro dibujan cosas distintas entre sí');
  }

  console.log('\n  Pero el resto del canal se sigue obedeciendo');
  {
    // Es la parte fina: la pantalla queda clavada en su MODO, no aislada. El
    // operador tiene que poder ajustarle el fondo y el tamaño del nombre a
    // todas desde el panel.
    const { p } = await abrir('&modo=jornada');
    const r = await mostrar(p, 'intentos');
    ok(r.nameScale === 1.6, 'el tamaño del nombre llega del canal (' + r.nameScale + ')');
    const r2 = await p.evaluate(() => {
      window._SCREEN_STATE = { mode: 'off', nameScale: 0.8, flights: ['A'], fondo: 'liso' };
      renderTxScreen(document.getElementById('txWidget') || document.body);
      return { nameScale: window._JORNADA_NAMESCALE, flights: window._JORNADA_FLIGHTS };
    });
    ok(r2.nameScale === 0.8, 'y si el operador lo cambia, esta pantalla también lo toma');
    ok(Array.isArray(r2.flights) && r2.flights[0] === 'A', 'las tandas elegidas también llegan');
    await p.close();
  }

  console.log('\n  Y el link de siempre, sin modo, sigue igual que antes');
  {
    const { p, errs } = await abrir('');
    const a = await mostrar(p, 'luces');
    const b2 = await mostrar(p, 'jornada');
    ok(a.luces, 'obedece al canal: le piden luces y muestra luces');
    ok(b2.html !== a.html, 'le piden la jornada y cambia');
    const c2 = await mostrar(p, 'off');
    ok(c2.vacio, 'y apagar lo apaga');
    ok(errs.length === 0, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await p.close();
  }

  console.log('\n  Un modo inventado en el link no rompe nada');
  {
    const { p, errs } = await abrir('&modo=cualquiercosa');
    const a = await mostrar(p, 'luces');
    ok(a.luces, 'se ignora y la pantalla vuelve a obedecer al canal');
    ok(errs.length === 0, 'sin errores');
    await p.close();
  }

  console.log('\nCorregir el nombre de un atleta');
  {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/firebasejs/**', r => r.abort());
    await p.goto('http://localhost:8972/livecast.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof renameAthlete === 'function', null, { timeout: 20000 });

    const preparar = () => p.evaluate(() => {
      isAdmin = true;
      DATA.athletes = [{ id: 7, name: 'Jose Peres', nombre: 'Jose Peres', lot: 1, flight: 'A',
        div: 'Open', cat: '83', bw: 82, sex: 'M', club: 'Club',
        att: { sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
               bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
               dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }];
    });

    const renombrar = async (respuesta) => {
      await p.evaluate((r) => { window.prompt = () => r; }, respuesta);
      return p.evaluate(() => {
        renameAthlete(7);
        const a = DATA.athletes.find(x => x.id === 7);
        return { name: a.name, nombre: a.nombre };
      });
    };

    await preparar();
    let r = await renombrar('José Pérez Soto');
    ok(r.name === 'José Pérez Soto', 'se corrige el nombre: ' + r.name);
    ok(r.nombre === 'José Pérez Soto', 'y también el campo con el que vino de la inscripción');

    r = await renombrar('   Ana   María   Díaz  ');
    ok(r.name === 'Ana María Díaz', 'se le sacan los espacios de más: "' + r.name + '"');

    r = await renombrar('   ');
    ok(r.name === 'Ana María Díaz', 'un nombre vacío no se acepta: queda el anterior');

    await p.evaluate(() => { window.prompt = () => null; });
    r = await p.evaluate(() => { renameAthlete(7); return DATA.athletes[0].name; });
    ok(r === 'Ana María Díaz', 'y cancelar no cambia nada');

    // Una pantalla que solo mira no puede renombrar.
    const bloq = await p.evaluate(() => {
      isAdmin = false;
      window.prompt = () => 'Nombre Cambiado A La Fuerza';
      renameAthlete(7);
      isAdmin = true;
      return DATA.athletes[0].name;
    });
    ok(bloq === 'Ana María Díaz', 'una pantalla espectadora no puede renombrar');

    ok(errs.length === 0, 'sin errores' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await p.close();
  }

  console.log('\n  Y se llega desde el nombre en la tabla');
  {
    ok(/onclick="renameAthlete\('\+a\.id\+'\)"/.test(lc), 'el nombre es clickeable');
    ok(/Click para corregir el nombre/.test(lc), 'con su explicación al pasar el mouse');
    ok(/se cambia en la tarima, el acta y la transmisión/.test(lc),
       'diciendo dónde se va a ver el cambio');
    const f = lc.slice(lc.indexOf('window.renameAthlete'), lc.indexOf('window.forceCurrentAttempt'));
    ok(/saveNow\(\);R\(\);/.test(f), 'y se guarda y sincroniza en el momento');
    ok(/La inscripción en Admin no cambia/.test(f),
       'avisando que la inscripción no se toca');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

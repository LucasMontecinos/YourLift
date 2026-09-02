// La página deja de pestañear y de borrarte lo que estabas eligiendo.
//
// Al abrir el sitio salen a buscarse una docena de cosas a Firestore. Cada una,
// al llegar, llamaba a render(), que rehace la pantalla ENTERA. Como llegan
// escalonadas durante los primeros segundos, la página se redibujaba una docena
// de veces seguidas: eso es el pestañeo. Y si en el intermedio uno había elegido
// algo en un desplegable —inscripción, sobre todo— el redibujado se lo llevaba
// puesto. De ahí lo de "a la tercera funciona": había que apurarse a hacer clic
// entre dos redibujados.
//
// Dos arreglos, y esta prueba mide los dos:
//
//   · Un dibujado que NACE de una carga de fondo no puede pisar lo que la
//     persona está haciendo. Si hay un campo enfocado, queda pendiente y se hace
//     apenas lo suelta. Los que nacen de un clic siguen siendo inmediatos.
//   · Las consultas iban en fila india, esperando cada una a la anterior, así
//     que la espera era la SUMA de todas —cerca de 1.350 documentos—. Ahora se
//     piden a la vez y la espera es la de la más lenta.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_pestaneo.js
const fs = require('fs');
const { chromium } = require('playwright');
const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  // Sin service worker: se mete a medio cargar y deja la página colgada.
  const ctx = await b.newContext({ viewport: { width: 420, height: 860 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof renderFondo === 'function' && typeof render === 'function',
    null, { timeout: 20000 });

  console.log('\nUn dibujado de fondo no pisa lo que estás usando');
  {
    const r = await p.evaluate(() => {
      // Un campo cualquiera, enfocado: es la situación de alguien eligiendo su
      // categoría en la inscripción cuando llegan los datos de Firestore.
      const campo = document.createElement('select');
      campo.innerHTML = '<option value="a">a</option><option value="b">b</option>';
      document.body.appendChild(campo);
      campo.focus();
      campo.value = 'b';                       // "su selección"

      let dibujos = 0;
      const real = window.render;
      window.render = () => { dibujos++; };

      window._renderPendiente = false;
      renderFondo(); renderFondo(); renderFondo();
      const durante = { dibujos, pendiente: window._renderPendiente, valor: campo.value };

      // Suelta el campo: recién ahí se hace el dibujado que quedó esperando.
      campo.blur();
      return new Promise(res => setTimeout(() => {
        const despues = { dibujos, pendiente: window._renderPendiente };
        window.render = real; campo.remove();
        res({ durante, despues });
      }, 60));
    });
    ok(r.durante.dibujos === 0, 'con un campo enfocado no se dibuja nada (' + r.durante.dibujos + ')');
    ok(r.durante.pendiente === true, 'queda anotado que hay un dibujado pendiente');
    ok(r.durante.valor === 'b', 'y la selección sigue intacta');
    ok(r.despues.dibujos === 1, 'al soltar el campo se dibuja UNA vez, no una por cada aviso');
    ok(r.despues.pendiente === false, 'y queda sin pendientes');
  }

  console.log('\n  Sin nadie escribiendo, el dibujado de fondo es inmediato');
  {
    const r = await p.evaluate(() => {
      let dibujos = 0;
      const real = window.render;
      window.render = () => { dibujos++; };
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      renderFondo();
      window.render = real;
      return dibujos;
    });
    ok(r === 1, 'se dibuja al toque (' + r + ')');
  }

  console.log('\n  Un clic del usuario manda siempre');
  {
    // render() directo NO se difiere: si la persona aprieta una pestaña, la
    // pestaña tiene que cambiar aunque tenga el dedo en un campo.
    const r = await p.evaluate(() => {
      const campo = document.createElement('input');
      document.body.appendChild(campo); campo.focus();
      let dibujos = 0;
      const real = window.render;
      window.render = () => { dibujos++; };
      window.render();          // como cuando se aprieta una pestaña
      window.render = real; campo.remove();
      return dibujos;
    });
    ok(r === 1, 'el dibujado pedido por el usuario no se aplaza');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\nLas consultas de arranque ya no van en fila india');
  {
    const ini = idx.indexOf('const _sueltas=[');
    const fin = idx.indexOf('await Promise.allSettled(');
    ok(ini > 0 && fin > ini, 'se piden juntas y se espera a todas de una vez');
    const bloque = idx.slice(ini, fin);
    const enParalelo = (bloque.match(/\(async\(\)=>\{/g) || []).length;
    ok(enParalelo >= 6, enParalelo + ' consultas salen a la vez');
    ok(/Promise\.allSettled/.test(idx),
       'con allSettled: si una falla no se lleva a las demás por delante');
    // Lo que sí lleva orden tiene que seguir teniéndolo: la nómina muestra el
    // nombre corregido de cada atleta, así que las ediciones van antes.
    const enc = idx.slice(idx.indexOf('const _encadenadas='), idx.indexOf('await Promise.allSettled('));
    ok(enc.indexOf('loadEdits()') < enc.indexOf('loadFBNominas()') && enc.indexOf('loadEdits()') > 0,
       'y las ediciones siguen cargándose antes que las nóminas');
  }

  console.log('\n  Y ninguna carga de fondo llama a render() a secas');
  {
    // Si alguna se escapa, vuelve el pestañeo por esa puerta.
    const sueltas = (idx.match(/if\(ST\.v==='[a-z]+'\)render\(\)/g) || []);
    ok(sueltas.length === 0,
       sueltas.length ? 'quedaron ' + sueltas.length + ': ' + sueltas.join(', ')
                      : 'todas pasan por renderFondo()');
    ok(/function renderFondo\(\)/.test(idx), 'que es la que respeta al que está usando la página');
    ok(/addEventListener\('focusout'/.test(idx), 'y se engancha a cuando suelta el campo');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

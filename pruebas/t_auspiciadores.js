// La franja de auspiciadores: dónde sale y qué se mide.
//
// Los logos de auspiciadores se cargan desde Admin → Auspiciadores y salen en una
// franja que se desplaza. El logo ya era un enlace al Instagram o al sitio de la
// marca, pero faltaban dos cosas para poder cobrar por esto:
//
//   · Los clics no se contaban. Un auspiciador que paga tiene derecho a saber
//     cuánta gente se le mandó; sin medirlo, el precio es una promesa.
//   · El logo no llevaba a ninguna parte.
//
// La franja va SOLO en el inicio. Estuvo un tiempo también en ranking,
// inscripción, ficha del atleta y cronograma, y se sacó de esas cuatro. Esta
// prueba fija eso: que salga en el inicio y en ninguna otra, para que no se
// vuelva a colar sin querer.
//
// Vale la pena tenerlo presente al vender: la propuesta de auspicio habla de
// cinco pantallas, y hoy es una.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_auspiciadores.js
const fs = require('fs');
const { chromium } = require('playwright');
const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MARCAS = [
  { nombre: 'Barra Fuerte', logoUrl: 'https://ejemplo.cl/a.png', ig: '@barrafuerte', activo: true },
  { nombre: 'Cinturones Ñuñoa', logoUrl: 'https://ejemplo.cl/b.png', link: 'https://cinturones.cl', activo: true },
  { nombre: 'Marca apagada', logoUrl: 'https://ejemplo.cl/c.png', ig: '@apagada', activo: false },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  // Sin service worker: se mete a medio cargar y deja la página colgada.
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof sponsorStrip === 'function' && typeof render === 'function',
    null, { timeout: 20000 });
  await p.evaluate(ms => {
    window._BG_SETTINGS = window._BG_SETTINGS || {};
    window._BG_SETTINGS.sponsors = { items: ms };
  }, MARCAS);

  console.log('\nEl logo lleva a la marca');
  {
    const r = await p.evaluate(() => {
      const d = document.createElement('div');
      d.innerHTML = sponsorStrip();
      const as = [...d.querySelectorAll('a')];
      return {
        enlaces: as.length,
        hrefs: [...new Set(as.map(a => a.getAttribute('href')))],
        blanco: as.every(a => a.getAttribute('target') === '_blank'),
        seguro: as.every(a => (a.getAttribute('rel') || '').includes('noopener')),
        apagada: d.innerHTML.includes('Marca apagada'),
      };
    });
    ok(r.enlaces > 0, 'los logos son enlaces (' + r.enlaces + ')');
    ok(r.hrefs.includes('https://instagram.com/barrafuerte'),
       'un @usuario de Instagram se convierte en su dirección completa');
    ok(r.hrefs.includes('https://cinturones.cl'),
       'y si no hay Instagram, se usa el sitio de la marca');
    ok(r.blanco, 'abren en pestaña nueva: no se saca a nadie del sitio');
    ok(r.seguro, 'con rel noopener, que es lo que corresponde al abrir hacia afuera');
    ok(!r.apagada, 'una marca desactivada no se dibuja');
  }

  console.log('\n  Y el clic se cuenta');
  {
    const r = await p.evaluate(() => {
      const visto = [];
      const real = window.gtag;
      window.gtag = (...a) => visto.push(a);
      window.ST = window.ST || {}; const antes = ST.v; ST.v = 'rank';
      clicAuspiciador('Barra Fuerte');
      ST.v = antes; window.gtag = real;
      return visto;
    });
    ok(r.length === 1, 'se manda un evento a Analytics');
    ok(r[0] && r[0][0] === 'event' && r[0][1] === 'clic_auspiciador',
       'con nombre propio: ' + (r[0] && r[0][1]));
    ok(r[0] && r[0][2] && r[0][2].marca === 'Barra Fuerte',
       'y dice de qué marca fue');
    ok(r[0] && r[0][2] && r[0][2].pantalla === 'rank',
       'y desde qué pantalla, que es lo que permite cobrar por pantalla');
    // Sin Analytics cargado no puede reventar el sitio.
    const revento = await p.evaluate(() => {
      const real = window.gtag; window.gtag = undefined;
      let malo = false;
      try { clicAuspiciador('X'); } catch (e) { malo = true; }
      window.gtag = real; return malo;
    });
    ok(!revento, 'y si Analytics no cargó, el clic igual funciona');
  }

  console.log('\n  Sale en el inicio y en ninguna otra');
  {
    const r = await p.evaluate(() => {
      const out = {};
      const antes = ST.v, antesSel = ST.sel;
      ST.sel = null;
      ['home', 'rank', 'insc', 'atletas', 'crono', 'records', 'entrenadores'].forEach(v => {
        ST.v = v; render();
        out[v] = document.getElementById('app').innerHTML.includes('AUSPICIADORES');
      });
      ST.v = antes; ST.sel = antesSel; render();
      return out;
    });
    ok(r.home, 'sale en el inicio');
    const otras = ['rank', 'insc', 'atletas', 'crono', 'records', 'entrenadores']
      .filter(v => r[v]);
    ok(otras.length === 0, otras.length
      ? 'quedó colada en: ' + otras.join(', ')
      : 'y en ninguna otra pantalla');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Solo el owner los define');
  {
    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    const reglas = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
    // Quién sale en el sitio y a dónde lleva su logo es un compromiso comercial.
    ok(/view==='sponsors'\)\{if\(ST\.adminInfo\?\.role==='owner'/.test(adm),
       'la pantalla es solo del owner');
    const i = adm.indexOf("setDoc(doc(db,'site_backgrounds','sponsors')");
    ok(/role!=='owner'/.test(adm.slice(i - 500, i)), 'y el guardado lo vuelve a comprobar');
    // Pero esconder un botón no cierra una puerta: la regla del servidor es la
    // única que de verdad lo impide.
    ok(/function isOwner\(\)/.test(reglas),
       'las reglas saben distinguir al owner del resto de los admin');
    ok(/match \/site_backgrounds\/sponsors \{[\s\S]{0,90}allow write: if isOwner\(\)/.test(reglas),
       'y el documento de auspiciadores solo lo puede escribir el owner');
  }

  console.log('\n  Queda escrito en el código');
  {
    ok(/function clicAuspiciador\(marca\)/.test(idx), 'la función que cuenta el clic existe');
    ok(/'clic_auspiciador'/.test(idx), 'con un nombre de evento propio, buscable en Analytics');
    ok(!/includes\(ST\.v\)\)h=sponsorStrip\(\)\+h/.test(idx),
       'ya no se antepone en las pantallas embebidas');
    ok((idx.match(/sponsorStrip\(\)/g) || []).length === 2,
       'y solo queda donde se define y donde se dibuja: el inicio');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

// Aviso de cookies: Google Analytics solo con permiso (Ley 21.719).
//
// Analytics guarda cookies en el equipo de quien visita. Hasta que la persona
// acepte, no se carga; si rechaza, no se carga nunca y se borran las cookies que
// hubiera. El aviso no sale dentro de la inscripción embebida (ya está en la
// página de afuera) ni en el livecast, que sale al aire en OBS y en las
// pantallas del recinto.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cookies.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
const RAIZ = path.join(__dirname, '..');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

console.log('\nLas páginas');
{
  const PAGS = ['index.html', 'atleta.html', 'ranking.html', 'resultados.html', 'inscripcion.html', 'livecast.html'];
  for (const f of PAGS) {
    const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    ok(/<script src="compartido\/consentimiento\.js\?v=[0-9a-f]+"/.test(s) && !/googletagmanager/.test(s), f + ': Analytics pasa por el aviso, no se carga directo');
  }
  ok(/consentimiento\.js\?v=[0-9a-f]+" data-aviso="no"/.test(fs.readFileSync(path.join(RAIZ, 'livecast.html'), 'utf8')), 'el livecast no muestra el aviso');
  const otras = fs.readdirSync(RAIZ).filter(f => f.endsWith('.html') && !PAGS.includes(f));
  ok(otras.every(f => !/googletagmanager/.test(fs.readFileSync(path.join(RAIZ, f), 'utf8'))), 'ninguna otra página carga Analytics');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack || e)); try { await b.close(); } catch (x) {} process.exit(1); });

  // Un equipo nuevo cada vez: el localStorage y las cookies empiezan vacíos.
  async function equipo() {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    ctx.ga = 0;
    // Va después: Playwright prueba las rutas de la última registrada a la primera.
    await ctx.route(/googletagmanager\.com/, r => { ctx.ga++; return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }); });
    return ctx;
  }
  async function abrir(ctx, url) {
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.addInitScript(() => { window.__FAKE = { eventos: [] }; });
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'load' });
    await p.waitForTimeout(300);
    return p;
  }
  const hayAviso = p => p.evaluate(() => !!document.getElementById('yl-cookies'));

  console.log('\nPrimera visita');
  {
    const ctx = await equipo();
    const p = await abrir(ctx, 'index.html');
    ok(await hayAviso(p), 'sale el aviso');
    ok(await p.evaluate(() => /Google Analytics/.test(document.getElementById('yl-cookies').innerText)
      && [...document.querySelectorAll('#yl-cookies button')].map(x => x.textContent).join() === 'RECHAZAR,ACEPTAR'), 'dice qué es, con Rechazar y Aceptar');
    ok(ctx.ga === 0, 'y mientras no se acepte, Analytics no se carga');
    ok(await p.evaluate(() => typeof gtag === 'function'), 'gtag() existe igual (los eventos no fallan)');

    console.log('\nRechazar');
    await p.evaluate(() => { document.cookie = '_ga=GA1.1.123.456; path=/'; document.cookie = '_ga_109D5LTPQ7=GS1.1; path=/'; });
    await p.click('#yl-cookies button[data-v="no"]');
    ok(!(await hayAviso(p)) && await p.evaluate(() => localStorage.getItem('yl_cookies') === 'no'), 'se va el aviso y queda guardado');
    ok(await p.evaluate(() => !/_ga/.test(document.cookie)), 'se borran las cookies de Analytics que hubiera');
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
    ok(!(await hayAviso(p)) && ctx.ga === 0, 'al volver no pregunta de nuevo, y Analytics sigue sin cargarse');

    console.log('\nCambiar de opinión desde la Política de privacidad');
    await p.evaluate(() => sv('terminos'));
    await p.waitForFunction(() => [...document.querySelectorAll('button')].some(x => /Cambiar preferencias de cookies/.test(x.textContent)), null, { timeout: 10000 }).catch(() => {});
    const boton = await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find(x => /Cambiar preferencias de cookies/.test(x.textContent)); if (x) x.click(); return !!x; });
    ok(boton && await hayAviso(p), 'la política tiene "Cambiar preferencias de cookies", que vuelve a mostrar el aviso');
    await p.click('#yl-cookies button[data-v="si"]');
    await p.waitForTimeout(200);
    ok(ctx.ga === 1 && await p.evaluate(() => localStorage.getItem('yl_cookies') === 'si'), 'aceptar ahí carga Analytics');
    ok(!p.errs.length, 'sin errores' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
    await ctx.close();
  }

  console.log('\nAceptar');
  {
    const ctx = await equipo();
    const p = await abrir(ctx, 'atleta.html');
    ok(await hayAviso(p) && ctx.ga === 0, 'en cualquier página del sitio pregunta primero');
    await p.click('#yl-cookies button[data-v="si"]');
    await p.waitForTimeout(200);
    ok(!(await hayAviso(p)) && ctx.ga === 1, 'al aceptar se va el aviso y se carga Analytics');
    ok(await p.evaluate(() => (window.dataLayer || []).some(a => a[0] === 'config' && a[2] && a[2].allow_google_signals === false && a[2].allow_ad_personalization_signals === false)),
      'sin señales publicitarias de Google');
    const p2 = await abrir(ctx, 'ranking.html');
    ok(!(await hayAviso(p2)) && ctx.ga === 2, 'en la página siguiente no pregunta y mide');
    await ctx.close();
  }

  console.log('\nDonde no tiene que salir');
  {
    const ctx = await equipo();
    const p = await abrir(ctx, 'livecast.html');
    ok(!(await hayAviso(p)) && ctx.ga === 0, 'el livecast (OBS, pantallas) no muestra el aviso ni carga Analytics sin permiso');
    const q = await abrir(ctx, 'index.html');
    const dentro = await q.evaluate(() => new Promise(res => {
      const f = document.createElement('iframe'); f.src = 'inscripcion.html?embedded=1';
      f.onload = () => setTimeout(() => res({ cargo: !!f.contentWindow.ylCookies, aviso: !!f.contentDocument.getElementById('yl-cookies') }), 300);
      document.body.appendChild(f);
    }));
    ok(dentro.cargo && !dentro.aviso && await hayAviso(q), 'la inscripción embebida no repite el aviso: sale una vez, en la página de afuera');
    await ctx.close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

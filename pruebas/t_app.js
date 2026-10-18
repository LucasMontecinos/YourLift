// El sitio dentro de la app de Android/iOS (compartido/app.js).
//
// La app abre yourlift.cl adentro; ahí no hay navegador que sepa descargar un
// blob ni abrir una pestaña nueva. Se simula la app con un window.Capacitor
// falso que anota lo que se le pide, y se fija:
//  · en un navegador común el archivo no toca nada,
//  · en la app, las descargas armadas en el teléfono (el <a download> suelto,
//    el doc.save de jsPDF, el que se agrega a la página) se guardan y abren el
//    menú de compartir, una sola vez cada una,
//  · navigator.share existe y un "cancelar" llega como AbortError,
//  · los PDF del sitio se abren en el visor, los enlaces de afuera los abre el
//    teléfono y un target="_blank" del sitio se queda en la app.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_app.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';
const BASE = `http://localhost:${PUERTO}`;

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const APP_FALSA = () => {
  window.__LLAMADAS = [];
  window.__CANCELAR = false;
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    nativePromise: (p, m, o) => {
      window.__LLAMADAS.push({ p, m, o: JSON.parse(JSON.stringify(o || {})) });
      if (p === 'Filesystem') return Promise.resolve({ uri: 'file:///cache/' + o.path });
      if (p === 'Share' && window.__CANCELAR) return Promise.reject(new Error('Share canceled'));
      return Promise.resolve({});
    },
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const nueva = async (init) => {
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    await ctx.route(/googletagmanager|google-analytics|gstatic\.com\/firebasejs/, r => r.abort());
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    if (init) await p.addInitScript(init);
    await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(300);
    return p;
  };

  console.log('\nEn un navegador común no cambia nada');
  {
    const p = await nueva();
    const r = await p.evaluate(() => ({
      cargado: !!document.querySelector('script[src*="compartido/app.js"]'),
      clase: document.documentElement.classList.contains('en-app'),
      blob: /native code/.test(String(URL.createObjectURL)),
      click: /native code/.test(String(HTMLAnchorElement.prototype.click)),
    }));
    ok(r.cargado, 'la página carga compartido/app.js');
    ok(!r.clase && r.blob && r.click, 'sin clase en-app y sin tocar URL ni los enlaces');
    await p.context().close();
  }

  const p = await nueva(APP_FALSA);
  const llamadas = () => p.evaluate(() => window.__LLAMADAS.splice(0));
  const espera = () => p.waitForTimeout(250);

  console.log('\nDentro de la app');
  {
    const r = await p.evaluate(() => [...document.documentElement.classList]);
    ok(r.includes('en-app') && r.includes('en-app-android'), 'marca la página como app (' + r.join(' ') + ')');
    const ll = await llamadas();
    ok(ll.some(x => x.p === 'SplashScreen' && x.m === 'hide'), 'saca la pantalla del logo al cargar');
  }

  console.log('\nUna descarga armada en el teléfono se guarda y se comparte');
  {
    await p.evaluate(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['hola'], { type: 'application/pdf' }));
      a.download = 'Acta/Nacional.pdf';
      URL.revokeObjectURL(a.href);                      // como hacen muchas descargas
      a.click();
    });
    await espera();
    const ll = await llamadas();
    const fs = ll.find(x => x.p === 'Filesystem'), sh = ll.find(x => x.p === 'Share');
    ok(fs && fs.m === 'writeFile' && fs.o.directory === 'CACHE', 'escribe el archivo en el caché de la app');
    ok(fs && fs.o.path === 'Acta_Nacional.pdf', 'con un nombre que sirve como archivo (' + (fs && fs.o.path) + ')');
    ok(fs && fs.o.data === Buffer.from('hola').toString('base64'), 'con el contenido del blob aunque ya lo hayan anulado');
    ok(sh && sh.m === 'share' && sh.o.files && sh.o.files[0] === 'file:///cache/Acta_Nacional.pdf', 'y abre el menú de compartir');
    ok(p.url().endsWith('/index.html'), 'la página no se va a ninguna parte');
  }

  console.log('\nEl doc.save de jsPDF (click con dispatchEvent) también');
  {
    await p.evaluate(() => {
      const a = document.createElement('a');
      a.download = 'Papeletas.pdf'; a.rel = 'noopener';
      a.href = URL.createObjectURL(new Blob(['%PDF'], { type: 'application/pdf' }));
      a.dispatchEvent(new MouseEvent('click'));
    });
    await espera();
    const ll = await llamadas();
    ok(ll.filter(x => x.p === 'Share').length === 1 && ll.find(x => x.p === 'Filesystem').o.path === 'Papeletas.pdf', 'un solo menú con Papeletas.pdf');
  }

  console.log('\nEl <a download> que se agrega a la página se maneja una sola vez');
  {
    await p.evaluate(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['x'], { type: 'image/png' })); a.download = 'qr.png';
      document.body.appendChild(a); a.click(); a.remove();
      window.open(a.href, '_blank');                     // lo que hace el QR por si el iPad no obedece
    });
    await espera();
    const ll = await llamadas();
    ok(ll.filter(x => x.p === 'Filesystem').length === 1 && ll.filter(x => x.p === 'Share').length === 1,
       'un archivo y un menú, aunque además se haya pedido abrirlo en otra ventana');
  }

  console.log('\nCompartir');
  {
    const r = await p.evaluate(async () => {
      const f = new File(['png'], 'QR_inscripcion.png', { type: 'image/png' });
      const puede = navigator.canShare({ files: [f] });
      await navigator.share({ files: [f], title: 'QR' });
      window.__CANCELAR = true;
      let nombre = '';
      try { await navigator.share({ files: [f], title: 'QR' }); } catch (e) { nombre = e.name; }
      window.__CANCELAR = false;
      return { puede, nombre };
    });
    const ll = await llamadas();
    const sh = ll.find(x => x.p === 'Share');
    ok(r.puede, 'navigator.canShare dice que sí con archivos');
    ok(sh && sh.o.title === 'QR' && sh.o.files[0] === 'file:///cache/QR_inscripcion.png', 'navigator.share manda el archivo al menú del teléfono');
    ok(r.nombre === 'AbortError', 'cerrar el menú llega como AbortError, igual que en el navegador (' + r.nombre + ')');
  }

  console.log('\nEnlaces');
  {
    const r = await p.evaluate(() => {
      const prueba = (href, attrs) => {
        const a = document.createElement('a'); a.href = href; a.textContent = 'x';
        Object.entries(attrs || {}).forEach(([k, v]) => a.setAttribute(k, v));
        document.body.appendChild(a);
        let prevenido = null;
        const ver = e => { prevenido = e.defaultPrevented; e.preventDefault(); };
        window.addEventListener('click', ver);
        a.click();
        window.removeEventListener('click', ver); a.remove();
        return prevenido;
      };
      return {
        pdf: prueba('consentimiento_menores.pdf'),
        afuera: prueba('https://www.instagram.com/yourlift_oficial/', { target: '_blank' }),
        whatsapp: prueba('https://wa.me/56900000000'),
        ancla: prueba('#records'),
      };
    });
    await espera();
    const ll = await llamadas();
    const br = ll.find(x => x.p === 'Browser');
    ok(r.pdf === true && br && br.o.url === `${BASE}/consentimiento_menores.pdf`, 'un PDF del sitio se abre en el visor del teléfono');
    ok(r.afuera === false && r.whatsapp === false, 'Instagram y WhatsApp los abre el teléfono (la app no los toca)');
    ok(r.ancla === false, 'los enlaces internos (#) siguen igual');
    ok(ll.filter(x => x.p === 'Browser').length === 1, 'solo el PDF fue al visor');
  }

  console.log('\nUn target="_blank" del propio sitio se queda en la app');
  {
    await Promise.all([
      p.waitForURL(/ranking\.html/, { timeout: 8000 }).catch(() => {}),
      p.evaluate(() => {
        const a = document.createElement('a'); a.href = 'ranking.html'; a.target = '_blank'; a.textContent = 'r';
        document.body.appendChild(a); a.click();
      }),
    ]);
    ok(/ranking\.html$/.test(p.url()), 'abre ranking.html en la misma vista (' + p.url().replace(BASE, '') + ')');
    ok((await p.context().pages()).length === 1, 'sin ventanas nuevas');
  }
  ok(!p.errs.length, 'sin errores de página' + (p.errs.length ? ': ' + p.errs[0] : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

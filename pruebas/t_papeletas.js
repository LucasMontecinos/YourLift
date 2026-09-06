// Papeletas de intentos: las dos versiones, y los logos.
//
// En la mesa se reparte una papeleta por atleta y por movimiento. Con 461
// atletas, escribir el nombre a mano en cada una es media hora de trabajo y una
// fuente de nombres ilegibles, así que ahora hay dos botones: la de siempre en
// blanco, y una con el nombre ya impreso tal como está en la nómina.
//
// Lo que se cuida acá:
//
//   · Que salga UNA papeleta por atleta en las dos versiones. Si sobra o falta
//     una, alguien se queda sin papeleta en medio de la competencia.
//   · Que el nombre impreso sea el de la nómina, con sus tildes y su ñ. Las
//     fuentes base de jsPDF son WinAnsi y las tienen; el "strip" que usan las
//     actas dejaría "Munoz" impreso en el papel que firma el atleta.
//   · Que un nombre largo se achique en vez de desbordarse por encima de la
//     línea o pisar el borde de la papeleta.
//   · Que el logo grande sea el del CAMPEONATO —el que se subió a su ficha— y no
//     el par FECHIPO + YourLift que había antes.
//   · Que en cada cuadradito de intento quede la marca de agua de YourLift, sola,
//     sin recuadro detrás.
//
// jsPDF viene de un CDN que el sandbox no alcanza, así que se le entrega una
// copia local por la ruta que pide, y el documento se inspecciona con un doble
// que anota cada llamada de dibujo.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_papeletas.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// La misma jsPDF que carga la página, servida desde el disco. Si no está, la
// prueba lo dice en vez de fallar por una razón que no es la que se está
// mirando.
const JSPDF = ['/opt/node22/lib/node_modules/jspdf/dist/jspdf.umd.min.js',
  path.join(__dirname, 'apoyo', 'jspdf.umd.min.js')].find(p => fs.existsSync(p));

(async () => {
  const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

  console.log('\nLos dos botones están, y cada uno llama a lo suyo');
  ok(/id="btnPapeletas"[^>]*generatePapeletas\(false\)/.test(lc), 'Papeletas en Blanco PDF');
  ok(/id="btnPapeletasNom"[^>]*generatePapeletas\(true\)/.test(lc), 'Papeletas con Nombre PDF');
  ok(/async function generatePapeletas\(conNombre\)/.test(lc), 'y las genera la misma función');

  console.log('\n  El logo grande es el del campeonato');
  {
    const fn = lc.slice(lc.indexOf('async function generatePapeletas'),
                        lc.indexOf('async function generatePapeletas') + 9000);
    ok(/eventos\/'\+_evId\+'\.png/.test(fn),
       'primero el archivo local del campeonato — ese imprime siempre');
    ok(/_logoCamp\(\)/.test(fn), 'y si no, el que se subió a la ficha del campeonato');
    ok(/_dibujable/.test(fn),
       'se comprueba antes si se puede incrustar: una imagen de otro dominio sin '
       + 'CORS carga bien y recién revienta al meterla en el PDF');
    ok(/fechipoText/.test(fn), 'sin logo de campeonato se vuelve al par FECHIPO + YourLift');
  }

  console.log('\n  La marca de agua va sola, sin recuadro detrás');
  {
    const ma = lc.slice(lc.indexOf('const marcaAgua='), lc.indexOf('const drawCard='));
    ok(/addImage\(yourliftImg/.test(ma), 'es el logo de YourLift');
    ok(!/roundedRect|setFillColor/.test(ma), 'y no se dibuja ningún cuadrado abajo');
    ok(/GS\(0?\.\d+\)/.test(ma), 'va con transparencia: encima se escribe el kilaje a mano');
    ok(/marcaAgua\(bX,bY,bW,bH\)/.test(lc), 'y se pinta en cada cuadradito de intento');
  }

  if (!fs.existsSync(__dirname + '/../eventos/suda2026.png')) {
    ok(false, 'falta eventos/suda2026.png — la papeleta del Sudamericano quedaría sin logo');
  } else ok(true, 'el logo del Sudamericano está en el repo (eventos/suda2026.png)');

  if (!JSPDF) {
    console.log('\n  (sin copia local de jsPDF: no se puede generar el PDF de verdad)');
    console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
    process.exit(fallas ? 1 : 0);
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => { errs.push('alert: ' + d.message()); d.dismiss(); });
  await p.route('**/jspdf*.js', r => r.fulfill({
    contentType: 'application/javascript', body: fs.readFileSync(JSPDF, 'utf8') }));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full',
               { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length,
                          null, { timeout: 20000 });

  const r = await p.evaluate(async () => {
    isAdmin = true; window.IS_CONTROLLER = true;
    pickEvent(DATA.events.findIndex(e => e.id === 'suda2026_fesupo_full'));
    DATA.event.id = 'suda2026'; DATA.event.short = 'Suda2026';
    const LARGO = 'Ana Beatriz Da Silva Nascimento Rodrigues Fernández';
    DATA.athletes[0].name = 'Rodolpho Vicente García Muñoz';
    DATA.athletes[1].name = LARGO;
    DATA.athletes[2].name = 'María José Peñailillo Órdenes';

    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });

    // Doble del documento: envuelve al de verdad y anota lo que se le pide.
    const Orig = window.jspdf.jsPDF;
    const corre = async conNombre => {
      const cap = { textos: [], imgs: [], rects: 0, cajaW: 0, archivo: '' };
      window.jspdf = { jsPDF: function (...a) {
        const d = new Orig(...a);
        const txt = d.text.bind(d), img = d.addImage.bind(d), rc = d.rect.bind(d);
        d.text = (t, x, y, o) => { cap.textos.push({ t: String(t), x, y, fs: d.getFontSize() }); return txt(t, x, y, o); };
        d.addImage = (i, f, x, y, w, h) => { cap.imgs.push({ src: (i && i.src) || '', x, y, w, h }); return img(i, f, x, y, w, h); };
        d.rect = (x, y, w, h, s) => { cap.rects++; return rc(x, y, w, h, s); };
        d.save = n => { cap.archivo = n; };
        return d;
      } };
      await generatePapeletas(conNombre);
      return cap;
    };
    const blanco = await corre(false), conNom = await corre(true);
    return { blanco, conNom, largo: LARGO, atletas: DATA.athletes.length,
             nombres: DATA.athletes.map(a => a.name) };
  });
  await b.close();

  const N = r.atletas;
  console.log('\n  Una papeleta por atleta (' + N + ' en la nómina de prueba)');
  {
    const marca = c => c.imgs.filter(i => /yourlift/i.test(i.src)).length;
    ok(marca(r.blanco) === N * 5, 'la de blanco: 5 cuadraditos marcados por papeleta ('
       + marca(r.blanco) + ')');
    ok(marca(r.conNom) === N * 5, 'la de nombre también (' + marca(r.conNom) + ')');
    const camp = c => c.imgs.filter(i => /suda2026|eventos\//i.test(i.src)).length;
    ok(camp(r.blanco) === N, 'y un logo de campeonato por papeleta (' + camp(r.blanco) + ')');
    ok(!r.blanco.imgs.some(i => /fechipo/i.test(i.src)),
       'con logo de campeonato ya no se dibuja el de FECHIPO');
  }

  console.log('\n  El nombre solo aparece en la versión con nombre');
  {
    const hay = (c, n) => c.textos.some(t => t.t === n);
    ok(hay(r.conNom, 'Rodolpho Vicente García Muñoz'),
       'sale con su tilde y su ñ, no "Munoz"');
    ok(hay(r.conNom, 'María José Peñailillo Órdenes'), 'y el otro igual');
    ok(!hay(r.blanco, 'Rodolpho Vicente García Muñoz'),
       'la papeleta en blanco sigue en blanco');
    const impresos = new Set(r.conNom.textos.map(t => t.t));
    const faltan = r.nombres.filter(n => !impresos.has(n));
    ok(faltan.length === 0, 'están los ' + N + ' nombres de la nómina'
       + (faltan.length ? ' — faltan ' + faltan.length + ': ' + faltan.slice(0, 3).join(' | ') : ''));
  }

  console.log('\n  Un nombre largo se achica, no se desborda');
  {
    const t = r.conNom.textos.find(x => x.t === r.largo);
    const corto = r.conNom.textos.find(x => x.t === 'María José Peñailillo Órdenes');
    ok(!!t, 'el nombre de 7 palabras se imprime entero, no cortado');
    ok(t && corto && t.fs < corto.fs,
       'y en cuerpo más chico que uno normal (' + (t || {}).fs + ' vs ' + (corto || {}).fs + ')');
    ok(t && t.fs >= 4.5, 'pero no tanto como para no poder leerlo (' + (t || {}).fs + ')');
  }

  console.log('\n  El archivo se llama distinto según cuál sea');
  ok(/^Papeletas_Suda2026\.pdf$/.test(r.blanco.archivo), r.blanco.archivo);
  ok(/^Papeletas_con_nombre_Suda2026\.pdf$/.test(r.conNom.archivo), r.conNom.archivo);

  ok(errs.length === 0, 'sin errores en la página' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

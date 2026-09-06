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

  console.log('\nTodo lo que se imprime vive en Documentos, no en Atletas & Pesaje');
  {
    ok(/onclick="go\('docs'\)"[^>]*Documentos/.test(lc) || /go\(\\?'docs\\?'\)/.test(lc),
       'hay una sección Documentos en el menú');
    ok(/p==='docs'&&isAdmin\)h\+=renderDocs\(\)/.test(lc), 'y su propia pantalla');
    ok(/function renderDocs\(\)/.test(lc), 'renderDocs existe');
    // Los cinco botones de PDF se fueron de la barra de Atletas & Pesaje: ahí
    // quedaban apretados entre "Generar Lotes" y "Ordenar por Categoría".
    const man = lc.slice(lc.indexOf('function renderManage()'),
                         lc.indexOf('function renderManage()') + 4000);
    ok(!/generateHojaPesaje\(\)|generatePapeletas\(/.test(man),
       'y ya no están sueltos en la barra de Atletas & Pesaje');
    ok(/go\(\\'docs\\'\)/.test(man), 'que ahora solo tiene un acceso a Documentos');
    const docs = lc.slice(lc.indexOf('function renderDocs()'),
                          lc.indexOf('function renderManage()'));
    ['generateHojaPesaje', 'generateHojaRack', 'generateHojaEquipo',
     'generatePapeletasNom', 'generatePapeletasBco'].forEach(f =>
      ok(docs.indexOf("fn:'" + f + "'") >= 0, '  · ' + f + ' se baja desde Documentos'));
  }

  console.log('\n  Los cinco documentos aceptan un día, no solo las papeletas');
  {
    // Son los papeles de la mesa: en un campeonato de ocho días, a la mesa del
    // día 3 se llevan los del día 3.
    ['generateHojaPesaje', 'generateHojaRack', 'generateHojaEquipo'].forEach(f =>
      ok(new RegExp('async function ' + f + '\\(dia,idBoton\\)').test(lc), '  · ' + f));
    ok(/async function generatePapeletas\(conNombre,dia,idBoton\)/.test(lc),
       '  · generatePapeletas');
    // Cada uno tiene que elegir a los atletas con la MISMA regla. Si uno se
    // arma su propio filtro, la hoja de rack del día 2 y las papeletas del día 2
    // pueden traer gente distinta, y eso no se nota hasta la mesa.
    ['generateHojaRack', 'generateHojaEquipo', 'generateHojaPesaje',
     'generatePapeletas'].forEach(f => {
      const i = lc.indexOf('async function ' + f + '(');
      const cuerpo = lc.slice(i, lc.indexOf('\n}\n', i));
      ok(cuerpo.indexOf('_athDeDia(dia)') >= 0, '  · ' + f + ' usa _athDeDia');
      ok(/doc\.save\([\s\S]{0,140}?_sufDiaArchivo\(dia,strip\)/.test(cuerpo),
         '    y le pone el día al nombre del archivo');
    });
    ok(/function _athDeDia\(dia\)\{[\s\S]{0,220}!a\.__is4/.test(lc),
       '_athDeDia deja afuera los cuartos intentos — si no, esa persona sale dos veces');
  }

  console.log('\n  Los dos tipos de papeleta, y cada uno llama a lo suyo');
  ok(/async function generatePapeletas\(conNombre,dia,idBoton\)/.test(lc),
     'las genera la misma función, que además acepta un día');
  // El botón lleva el id que la función usa para ponerlo en "Generando…" y
  // devolverle después su texto; si no calzan, queda pegado en "Generando…".
  ok(/getElementById\(idBoton\|\|\(conNombre\?'btnPapeletasNom':'btnPapeletas'\)\)/.test(lc),
     'y sabe qué botón deshabilitar mientras arma el PDF');

  console.log('\n  El logo grande es el del campeonato');
  {
    const fn = lc.slice(lc.indexOf('async function generatePapeletas'),
                        lc.indexOf('async function generatePapeletas') + 9000);
    // Manda el logo cargado en la ficha del campeonato: es el que cambia cuando
    // el campeonato cambia de logo, y el que hace que esto sirva para el
    // Regional Centro Sur, el Sur Austral y cualquier otro sin tocar código.
    ok(fn.indexOf('campSrcs.push(_remoto)') < fn.indexOf("campSrcs.push('eventos/'+_evId"),
       'primero el logo cargado en la ficha del campeonato');
    ok(/eventos\/'\+_evId\+'\.png/.test(fn),
       'y detrás un archivo local con el nombre del campeonato, por si el de la '
       + 'ficha no se deja incrustar');
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

    // Un campeonato de tres días, como los pone el Cronograma: "Día N · AM/PM".
    // Uno queda sin día a propósito: es el caso que se le escapa a cualquiera y
    // que dejaría a esa persona sin papeleta el día que compite.
    const TANDAS = ['A', 'B', 'C', 'D', 'E', 'F'];
    DATA.athletes.forEach((a, i) => {
      a.flight = TANDAS[i % TANDAS.length];
      a.jornada = 'Día ' + (1 + (TANDAS.indexOf(a.flight) >> 1)) + ' · ' +
                  (TANDAS.indexOf(a.flight) % 2 ? 'PM' : 'AM');
    });
    const SIN_DIA = DATA.athletes[4].name;
    DATA.athletes[4].jornada = 'AM';   // sin día: no cae en ninguna jornada

    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });

    // Doble del documento: envuelve al de verdad y anota lo que se le pide.
    const Orig = window.jspdf.jsPDF;
    const corre = async (conNombre, dia) => {
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
      await generatePapeletas(conNombre, dia);
      return cap;
    };
    const blanco = await corre(false), conNom = await corre(true);
    const dias = _diasDelEvento();
    const porDia = {};
    for (const d of dias) porDia[d] = await corre(true, d);
    const blancoDia1 = await corre(false, dias[0]);
    return { blanco, conNom, porDia, blancoDia1, dias, largo: LARGO, sinDia: SIN_DIA,
             atletas: DATA.athletes.filter(a => !a.__is4).length,
             nombres: DATA.athletes.filter(a => !a.__is4).map(a => a.name),
             porDiaEsperado: dias.map(d => _docsAtletas(d).map(a => a.name)),
             enPantalla: (DATA.phase = 'docs', renderDocs()) };
  });
  await b.close();

  const N = r.atletas;
  console.log('\n  Una papeleta por atleta (' + N + ' en la nómina de prueba)');
  {
    const marca = c => c.imgs.filter(i => /yourlift/i.test(i.src)).length;
    ok(marca(r.blanco) === N * 5, 'la de blanco: 5 cuadraditos marcados por papeleta ('
       + marca(r.blanco) + ')');
    ok(marca(r.conNom) === N * 5, 'la de nombre también (' + marca(r.conNom) + ')');
    // El logo del campeonato entra APLANADO sobre blanco —el archivo del repo es
    // transparente para que sirva en la pantalla de tarima, y jsPDF pinta de
    // negro lo transparente—, así que llega como data URI y no como ruta.
    const camp = c => c.imgs.filter(i => !/yourlift|fechipo/i.test(i.src)).length;
    ok(camp(r.blanco) === N, 'y un logo de campeonato por papeleta (' + camp(r.blanco) + ')');
    ok(r.blanco.imgs.some(i => /^data:image\/png/.test(i.src)),
       'apoyado sobre blanco, no transparente: si no, saldría como una mancha negra');
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

  console.log('\n  Las papeletas con nombre se bajan por día');
  {
    ok(r.dias.length === 3, 'el campeonato de prueba tiene 3 días: ' + r.dias.join(', '));
    let sumaDias = 0;
    r.dias.forEach((d, i) => {
      const cap = r.porDia[d];
      const esperado = r.porDiaEsperado[i];
      const impresos = cap.textos.map(t => t.t).filter(t => esperado.indexOf(t) >= 0);
      sumaDias += esperado.length;
      const marca = cap.imgs.filter(x => /yourlift/i.test(x.src)).length;
      ok(marca === esperado.length * 5,
         d + ': ' + esperado.length + ' papeletas, una por atleta de ese día (' + marca / 5 + ')');
      ok(new Set(impresos).size === esperado.length,
         '  · con los nombres de ese día, sin repetir');
      // Lo que rompe el propósito: que se cuele alguien de otro día.
      const ajenos = cap.textos.map(t => t.t)
        .filter(t => r.nombres.indexOf(t) >= 0 && esperado.indexOf(t) < 0);
      ok(ajenos.length === 0, '  · y sin nadie de otro día'
         + (ajenos.length ? ' — se colaron: ' + ajenos.slice(0, 3).join(' | ') : ''));
    });
    ok(sumaDias === N - 1, 'entre los tres días están todos menos el que no tiene día asignado ('
       + sumaDias + ' de ' + N + ')');
    const enAlguno = r.dias.some(d =>
      r.porDia[d].textos.some(t => t.t === r.sinDia));
    ok(!enAlguno, 'el que no tiene día en el Cronograma no aparece en ninguna');
    ok(r.conNom.textos.some(t => t.t === r.sinDia),
       'pero sí en la de todo el campeonato, para que no se pierda');
    ok(/Ojo:/.test(r.enPantalla) && /día asignado en el Cronograma/.test(r.enPantalla),
       'y la pantalla avisa que ese atleta se está quedando fuera');

    // La versión en blanco se parte igual: a la mesa del día 1 hay que llevar
    // tantas papeletas como atletas compiten ese día, se escriba el nombre o no.
    const bd = r.blancoDia1, esperado = r.porDiaEsperado[0].length;
    const marcaBd = bd.imgs.filter(x => /yourlift/i.test(x.src)).length;
    ok(marcaBd === esperado * 5,
       'en blanco, ' + r.dias[0] + ': las mismas ' + esperado + ' papeletas (' + marcaBd / 5 + ')');
    ok(!bd.textos.some(t => r.nombres.indexOf(t.t) >= 0), '  · y ninguna trae nombre escrito');
  }

  console.log('\n  La pantalla de Documentos ofrece las descargas de verdad');
  {
    const H = r.enPantalla;
    ok(/id="btnHojaPesaje"/.test(H) && /id="btnHojaRack"/.test(H) && /id="btnHojaEquipo"/.test(H),
       'están los tres papeles de la mesa');
    // El día viaja como &quot;Día 1&quot; dentro del atributo onclick: el
    // navegador lo decodifica a comillas antes de que lo lea JavaScript.
    // Las dos versiones se parten por día: la cantidad que hace falta ese día es
    // la misma se escriba el nombre o no.
    const DOCS = [['generatePapeletasNom', 'btnPapeletasNom', 'papeletas con nombre'],
                  ['generatePapeletasBco', 'btnPapeletas', 'papeletas en blanco'],
                  ['generateHojaPesaje', 'btnHojaPesaje', 'hoja de pesaje'],
                  ['generateHojaRack', 'btnHojaRack', 'altura de rack'],
                  ['generateHojaEquipo', 'btnHojaEquipo', 'revisión de equipo']];
    DOCS.forEach(([fn, id, nombre]) => {
      const falta = r.dias.filter((d, i) =>
        H.indexOf(fn + '(&quot;' + d + '&quot;,\'' + id + 'D' + i + '\')') < 0);
      ok(falta.length === 0, '  · ' + nombre + ': un botón por cada día'
         + (falta.length ? ' — falta ' + falta.join(', ') : ''));
      ok(H.indexOf('id="' + id + '" class="btn btn-o" onclick="' + fn + '()"') >= 0,
         '    y el de todo el campeonato');
    });
    ok(new RegExp('· ' + r.porDiaEsperado[0].length + '<').test(H) ||
       H.indexOf('· ' + r.porDiaEsperado[0].length) >= 0,
       'y cada botón dice cuántos atletas trae, para no imprimir a ciegas');
  }

  console.log('\n  El archivo se llama distinto según cuál sea');
  ok(/^Papeletas_Suda2026\.pdf$/.test(r.blanco.archivo), r.blanco.archivo);
  ok(/^Papeletas_con_nombre_Suda2026\.pdf$/.test(r.conNom.archivo), r.conNom.archivo);
  r.dias.forEach(d => ok(/^Papeletas_con_nombre_D[ií]a_\d_Suda2026\.pdf$/.test(r.porDia[d].archivo),
    '  · ' + r.porDia[d].archivo));
  ok(/^Papeletas_D[ií]a_\d_Suda2026\.pdf$/.test(r.blancoDia1.archivo), '  · ' + r.blancoDia1.archivo);

  ok(errs.length === 0, 'sin errores en la página' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

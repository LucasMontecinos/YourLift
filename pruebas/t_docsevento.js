// Documentos propios de un campeonato: se crean en el panel y salen en la
// inscripción, con su formulario para descargar y su link.
//
// El catálogo fijo —carnet, pasaporte, WADA, los consentimientos— cubre lo que
// pide la federación. Pero cada organización trae lo suyo: Olimpiadas Especiales
// tiene antecedentes propios, y esperar a que alguien toque el código para poder
// abrir una inscripción no sirve.
//
// Lo que se fija acá es que un documento agregado desde Admin → Campeonatos se
// comporte EXACTAMENTE como uno del catálogo: aparece su casilla para subir, su
// botón de descargar el formulario, su link si el documento se saca en otra
// página, y no deja enviar la inscripción sin él.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_docsevento.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EVENTO = {
  id: 'oe_prueba', name: 'Copa Olimpiadas Especiales', date: '2026-12-01', status: 'open',
  requiredDocs: ['carnetIdFront', 'x_med1'],
  docsExtra: [{
    key: 'med1',
    label: 'Certificado médico OE',
    desc: 'Formulario de Olimpiadas Especiales firmado por el médico',
    plantillaUrl: 'https://ejemplo.cl/certificado.pdf',
    linkUrl: 'https://olimpiadasespeciales.cl/registro',
    linkTexto: 'Primero regístrate en el sitio de Olimpiadas Especiales',
  }],
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/inscripcion.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof docsDelEvento === 'function', null, { timeout: 25000 });

  console.log('\nEl catálogo del campeonato suma los propios a los fijos');
  {
    const r = await p.evaluate(ev => {
      const cat = docsDelEvento(ev);
      const m = cat['x_med1'];
      return {
        fijosSiguen: !!cat.carnetIdFront && !!cat.wadaIntl,
        hay: !!m, label: m && m.label, plantilla: m && m.plantillaUrl, link: m && m.linkUrl,
        // Las claves de estado y la ruta del archivo salen de la clave del
        // documento: no pueden chocar con las fijas.
        choca: Object.keys(DOC_TYPES).some(k => k === 'x_med1'),
        rutas: Object.values(cat).map(x => x.storagePath),
      };
    }, EVENTO);
    ok(r.fijosSiguen, 'los documentos fijos siguen estando');
    ok(r.hay && r.label === 'Certificado médico OE', 'y aparece el propio del campeonato');
    ok(r.plantilla && r.link, 'con su formulario para descargar y su link');
    ok(!r.choca, 'su clave no pisa ninguna del catálogo fijo');
    ok(new Set(r.rutas).size === r.rutas.length, 'ninguna ruta de archivo se repite');
  }

  console.log('\n  Sale dibujado en el paso de documentos');
  {
    const txt = await p.evaluate(ev => {
      EVENTS.length = 0; EVENTS.push(ev);
      state.form.evento = ev.id;
      state.form.fechaNac = '1998-05-10';       // mayor: sin consentimiento de tutor
      state.step = 3;
      render();
      return document.body.innerHTML;
    }, EVENTO);
    ok(/Certificado médico OE/.test(txt), 'se ve el nombre del documento');
    ok(/Formulario de Olimpiadas Especiales firmado/.test(txt), 'y su descripción');
    ok(/DESCARGAR FORMULARIO/.test(txt) && /ejemplo\.cl\/certificado\.pdf/.test(txt),
       'con el botón para descargar el PDF que se cargó desde el panel');
    ok(/IR A LA PÁGINA/.test(txt) && /olimpiadasespeciales\.cl\/registro/.test(txt),
       'y el link a la otra página, en el mismo bloque');
    ok(/Primero regístrate en el sitio/.test(txt), 'con el texto que se le escribió al link');
    ok(/handleFile\(this,'x_med1'\)/.test(txt), 'y su propio espacio para subir el archivo');
  }

  console.log('\n  Y se comporta como uno más: no deja enviar sin él');
  {
    const r = await p.evaluate(ev => {
      const cat = docsDelEvento(ev);
      const meta = cat['x_med1'];
      // Sin archivo: el botón de enviar tiene que estar bloqueado.
      state[meta.stateKey] = null; state[meta.nameKey] = '';
      state.form.evento = ev.id; state.step = 3; render();
      const bloqueado = !!document.querySelector('button[disabled]');
      const faltaEnResumen = /Certificado médico OE:[\s\S]{0,40}Falta/.test(document.body.innerText);
      // Con archivo: se destraba.
      state[meta.stateKey] = new File(['x'], 'cert.pdf', { type: 'application/pdf' });
      state[meta.nameKey] = 'cert.pdf';
      // El carnet fijo también, que es el otro requerido.
      state.carnetFile = new File(['x'], 'c.jpg', { type: 'image/jpeg' }); state.carnetName = 'c.jpg';
      render();
      const listo = document.body.innerText;
      return { bloqueado, faltaEnResumen, ok: /Certificado médico OE:\s*✅/.test(listo) };
    }, EVENTO);
    ok(r.bloqueado, 'sin el documento propio no se puede enviar');
    ok(r.faltaEnResumen, 'y el resumen dice que falta');
    ok(r.ok, 'al adjuntarlo, queda marcado como listo');
  }

  console.log('\n  Elegir el archivo lo guarda donde corresponde');
  {
    const r = await p.evaluate(ev => {
      EVENTS.length = 0; EVENTS.push(ev); state.form.evento = ev.id;
      const f = new File(['y'], 'otro.pdf', { type: 'application/pdf' });
      const inp = { files: [f] };
      handleFile(inp, 'x_med1');
      return { archivo: !!state['xf_med1'], nombre: state['xn_med1'] };
    }, EVENTO);
    ok(r.archivo && r.nombre === 'otro.pdf', 'handleFile encuentra el documento propio por su ruta');
  }

  console.log('\n  Modalidades y divisiones propias del campeonato');
  {
    const r = await p.evaluate(() => {
      const base = { id: 'x', name: 'X' };
      const suma = { ...base, modsExtra: ['Juegos Especiales'], divsExtra: ['Nivel 1'] };
      const solo = { ...suma, modsSolo: true, divsSolo: true };
      return {
        sinNada: modalidadesDe(base).length === MODALITIES.length,
        suma: modalidadesDe(suma),
        soloMods: modalidadesDe(solo),
        soloDivs: divisionesDe(solo),
        vacias: modalidadesDe({ modsExtra: ['', '  '] }).length === MODALITIES.length,
      };
    });
    ok(r.sinNada, 'sin nada propio, se usan las de siempre');
    ok(r.suma.length === (await p.evaluate(() => MODALITIES.length)) + 1
       && r.suma.includes('Juegos Especiales'), 'una modalidad propia se suma a la lista');
    ok(r.soloMods.length === 1 && r.soloMods[0] === 'Juegos Especiales',
       'con "solo estas", reemplaza la lista entera');
    ok(r.soloDivs.length === 1 && r.soloDivs[0] === 'Nivel 1', 'lo mismo con las divisiones');
    ok(r.vacias, 'las líneas en blanco no crean modalidades fantasma');
  }

  console.log('\n  Y se ven en el formulario');
  {
    const ev = { ...EVENTO, modsExtra: ['Juegos Especiales'], modsSolo: true,
                 divsExtra: ['Nivel 1', 'Nivel 2'], divsSolo: true };
    // Se leen las OPCIONES de los desplegables, no el HTML entero: el nombre de
    // una modalidad aparece además en los textos explicativos de la página, y
    // buscarlo suelto daba un falso negativo.
    const sels = await p.evaluate(e => {
      EVENTS.length = 0; EVENTS.push(e);
      state.form.evento = e.id; state.step = 2; render();
      return [...document.querySelectorAll('select')]
        .map(s => [...s.options].map(o => o.textContent.trim()));
    }, ev);
    const opciones = sels.flat();
    ok(opciones.includes('Juegos Especiales'), 'la modalidad propia sale en el desplegable');
    ok(opciones.includes('Nivel 1') && opciones.includes('Nivel 2'),
       'y las divisiones propias también');
    ok(!opciones.some(o => /Powerlifting|Sub-Junior|Master/.test(o)),
       'y con "solo estas" ya no se ofrecen las que no corresponden');
  }

  console.log('\n  Un documento se le puede pedir solo a una modalidad');
  {
    // Un campeonato mixto: Olimpiadas Especiales corre junto al powerlifting.
    // Sus antecedentes son de ellos, y pedírselos a todo el campeonato es
    // papeleo que no corresponde.
    const ev = { ...EVENTO,
      requiredDocs: ['carnetIdFront', 'x_med1'],
      docsCond: { x_med1: { mods: ['Olimpiadas Especiales'], divs: [] } } };
    const r = await p.evaluate(e => {
      EVENTS.length = 0; EVENTS.push(e); state.form.evento = e.id;
      state.form.fechaNac = '1998-05-10';
      const pide = mod => { state.form.modalidad = mod; state.form.division = 'Open';
                            return docsRequeridos(e, '1998-05-10'); };
      const oe = pide('Olimpiadas Especiales');
      const cl = pide('Powerlifting Classic');
      // Y lo que se DIBUJA tiene que ser lo mismo que se exige: si el documento
      // no sale en pantalla pero sigue en la lista, el atleta queda trancado sin
      // poder enviar y sin nada que subir.
      state.form.modalidad = 'Powerlifting Classic'; state.step = 3; render();
      const dibujaClassic = /Certificado médico OE/.test(document.body.innerHTML);
      state.form.modalidad = 'Olimpiadas Especiales'; render();
      const dibujaOE = /Certificado médico OE/.test(document.body.innerHTML);
      return { oe, cl, dibujaClassic, dibujaOE };
    }, ev);
    ok(r.oe.indexOf('x_med1') >= 0, 'al de Olimpiadas Especiales se le pide');
    ok(r.cl.indexOf('x_med1') < 0, 'y al de Powerlifting Classic no');
    ok(r.cl.indexOf('carnetIdFront') >= 0, 'pero el carnet, que no está limitado, se le pide igual');
    ok(!r.dibujaClassic, 'al classic no se le dibuja la casilla');
    ok(r.dibujaOE, 'y al de Olimpiadas Especiales sí');
  }
  {
    // La división filtra igual, y las dos condiciones se suman.
    const r = await p.evaluate(() => {
      const ev = { id: 'z', name: 'Z', requiredDocs: ['notas'],
                   docsCond: { notas: { mods: [], divs: ['Universitario'] } } };
      const pide = (mod, div) => { state.form.modalidad = mod; state.form.division = div;
                                   return docsRequeridos(ev, '1998-05-10').length; };
      const ambas = { id: 'z2', name: 'Z2', requiredDocs: ['notas'],
                      docsCond: { notas: { mods: ['Powerlifting Universitario'], divs: ['Universitario'] } } };
      const pide2 = (mod, div) => { state.form.modalidad = mod; state.form.division = div;
                                    return docsRequeridos(ambas, '1998-05-10').length; };
      return { uni: pide('Powerlifting Classic', 'Universitario'),
               open: pide('Powerlifting Classic', 'Open'),
               lasDos: pide2('Powerlifting Universitario', 'Universitario'),
               soloUna: pide2('Powerlifting Classic', 'Universitario') };
    });
    ok(r.uni === 1 && r.open === 0, 'la división filtra igual que la modalidad');
    ok(r.lasDos === 1, 'con las dos condiciones puestas, hay que cumplir las dos');
    ok(r.soloUna === 0, 'y cumplir solo una no alcanza');
  }
  {
    // Lo de siempre no puede cambiar: sin condición, se le pide a todos.
    const r = await p.evaluate(() => {
      const ev = { id: 'w', name: 'W', requiredDocs: ['carnetIdFront', 'wadaIntl'] };
      state.form.modalidad = 'Lo Que Sea'; state.form.division = 'Cualquiera';
      return { sinCond: docsRequeridos(ev, '1998-05-10').length,
               condVacia: docsRequeridos({ ...ev, docsCond: { carnetIdFront: { mods: [], divs: [] } } },
                                         '1998-05-10').length };
    });
    ok(r.sinCond === 2, 'un campeonato sin condiciones sigue pidiendo todo a todos');
    ok(r.condVacia === 2, 'y una condición vacía tampoco esconde nada');
  }

  console.log('\n  Las reglas publicadas dejan pasar lo que el formulario guarda');
  {
    // Esto no es un detalle de estilo. Las reglas de Firestore para
    // inscripciones_private usan hasOnly([...]): una lista CERRADA de campos. Un
    // campo que no esté ahí no se rechaza solo, bota la inscripción entera con
    // "Missing or insufficient permissions", y pasa al final, después de que el
    // atleta ya subió todos sus archivos. Por eso las URLs de los documentos
    // propios van dentro del mapa `docs`, que sí está permitido.
    const reglas = fs.readFileSync('/home/user/YourLift/firestore.rules', 'utf8');
    const m = reglas.match(/function datosPrivadosValidos\(\)[\s\S]*?hasOnly\(\[([^\]]*)\]\)/);
    const permitidos = m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : [];
    ok(permitidos.includes('docs'), 'las reglas permiten el mapa docs');

    const ins = fs.readFileSync('/home/user/YourLift/inscripcion.html', 'utf8');
    const escritos = new Set();
    for (const mm of ins.matchAll(/privateEntry\.([A-Za-z_$][\w$]*)\s*=/g)) escritos.add(mm[1]);
    for (const mm of ins.matchAll(/privateEntry\[\s*'([^']+)'\s*\]\s*=/g)) escritos.add(mm[1]);
    const fuera = [...escritos].filter(k => !permitidos.includes(k));
    ok(!fuera.length, 'ningún campo que se guarda queda fuera de la lista de las reglas'
      + (fuera.length ? ' — sobra: ' + fuera.join(', ') : ''));

    // Y la contraparte en Storage: el formulario en blanco que sube el admin va a
    // una ruta nueva, y toda ruta que el código toca tiene que tener su match.
    const st = fs.readFileSync('/home/user/YourLift/storage.rules', 'utf8');
    ok(/match \/evento_docs\//.test(st), 'storage.rules tiene la ruta de los formularios del campeonato');
    const bloque = st.split('match /evento_docs/')[1].split('allow delete')[0];
    ok(/allow read: if true/.test(bloque),
       'y se pueden descargar sin sesión: el que se inscribe no la tiene');
  }

  ok(!errs.length, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

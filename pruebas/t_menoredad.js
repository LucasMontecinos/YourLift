// El consentimiento del tutor es solo para los que todavía no cumplen 18.
//
// En producción pasó esto: a los adultos les aparecía el "Consentimiento Menor"
// como documento obligatorio y no podían enviar la inscripción. El botón quedaba
// apagado esperando un papel que no les corresponde.
//
// La causa: el sistema nuevo de documentos (`requiredDocs` en el evento) dibujaba
// y exigía TODA la lista sin mirar quién se está inscribiendo. El sistema viejo sí
// preguntaba por la edad; el nuevo se saltó ese paso.
//
// La regla: cuenta la EDAD REAL al día en que se inscribe. Es un papel legal —lo
// firma el tutor de quien todavía no cumplió 18—, así que el que ya los cumplió
// firma por sí mismo aunque haya nacido el mismo año que un menor. Dos personas
// de 2008 pueden estar en lados distintos según el día de su cumpleaños.
//
// No confundir con la división de edad, que sí va por año calendario (Sub Junior,
// Junior, Open…, ver yl-divisiones.js). Son dos cuentas distintas a propósito:
// alguien de 2008 puede ser Sub Junior todo 2026 y no necesitar el consentimiento
// desde el día que cumple 18.
//
// Lo que se cuida acá:
//   · que el adulto no vea el documento ni quede trabado por él;
//   · que el menor lo siga viendo y siga sin poder enviar hasta subirlo;
//   · que el corte sea el cumpleaños y no el 1 de enero;
//   · que no se caiga NINGÚN otro documento del evento — hay gente ya inscrita y
//     la inscripción funciona bien: esto no puede tocar nada más;
//   · y que el formulario y la validación final usen el mismo criterio, porque si
//     se separan vuelve a pasar lo mismo por el otro lado.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_menoredad.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../inscripcion.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

function sacar(texto, nombre) {
  const i = texto.search(new RegExp('(?:^|\\n)function ' + nombre + '\\('));
  if (i < 0) throw new Error('no encontré ' + nombre);
  const start = texto.lastIndexOf('\n', i + 1) + 1;
  let p = start, open = 0, abrio = false;
  while (p < texto.length) {
    const c = texto[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    p++;
  }
  return texto.slice(start, p);
}

// Las funciones, montadas con un calendario falso: así se puede pararse en
// cualquier día y ver el corte moverse con el cumpleaños.
const FUNCS = ['isMinor', 'requiereConsentimientoMenor', '_edadHoy', '_partesFecha',
               '_anioNac', 'docsRequeridos'];
const CUERPO = FUNCS.map(n => sacar(src, n)).join('\n');
function elDia(iso) {
  const t = iso.split('-').map(Number);
  const FechaFalsa = function () {
    return { getFullYear: () => t[0], getMonth: () => t[1] - 1, getDate: () => t[2] };
  };
  FechaFalsa.prototype = Date.prototype;
  return new Function('Date', CUERPO + '\nreturn {' + FUNCS.join(',') + '};')(FechaFalsa);
}

const DOCS_EVENTO = ['carnetIdFront', 'wadaIntl', 'menorConsent', 'carnetIdReverso'];
const EVENTO = { id: 'sur_austral', name: 'Regional Sur Austral', requiredDocs: DOCS_EVENTO };

console.log('\nCuenta la edad real, no el año de nacimiento');
{
  // El caso que llegó de producción: nacidos en 2008 que ya cumplieron 18 y a los
  // que se les seguía pidiendo el consentimiento del tutor.
  const A = elDia('2026-08-19');
  ok(!A.isMinor('2008-01-15'), 'nacido el 15/01/2008 → ya cumplió 18, no se le pide');
  ok(!A.isMinor('2008-08-19'), 'y el que los cumple justo hoy, tampoco');
  ok(A.isMinor('2008-08-20'), 'pero el que los cumple mañana, sí — todavía es menor');
  ok(A.isMinor('2008-12-31'), 'y el de diciembre de 2008, sí');
  ok(A.isMinor('2010-05-01'), 'los más chicos, obviamente');
  ok(!A.isMinor('1995-03-20'), 'y a un adulto no se le pide');
  ok(!A.isMinor('1968-07-04'), 'ni a un Master');
}

console.log('\n  El corte se mueve con el cumpleaños, no con el 1 de enero');
{
  const nacido = '2008-06-10';
  ok(elDia('2026-06-09').isMinor(nacido), 'el 9 de junio de 2026 todavía es menor');
  ok(!elDia('2026-06-10').isMinor(nacido), 'el 10, el día que cumple 18, ya no');
  ok(!elDia('2026-06-11').isMinor(nacido), 'y al día siguiente tampoco');
  // Dos personas del mismo año, en lados distintos el mismo día.
  const hoy = elDia('2026-08-19');
  ok(!hoy.isMinor('2008-02-02') && hoy.isMinor('2008-11-02'),
     'dos de 2008 el mismo día: al de febrero no se le pide, al de noviembre sí');
}

console.log('\n  Y esto es distinto de la división de edad, a propósito');
{
  // La división va por año calendario: el de 2008 es Sub Junior TODO 2026, incluso
  // después de cumplir 18. El consentimiento no: se corta el día del cumpleaños.
  const div = require(__dirname + '/../yl-divisiones.js');
  ok(div.ylDivisionPorAnio(2008, 2026) === 'Sub Junior',
     'un nacido en 2008 es Sub Junior durante todo 2026…');
  ok(!elDia('2026-12-01').isMinor('2008-03-03'),
     '…y aun así, en diciembre, ya no necesita el consentimiento del tutor');
}

console.log('\nLa edad se calcula bien');
{
  const A = elDia('2026-08-19');
  ok(A._edadHoy('1995-03-20') === 31, 'cumpleaños ya pasado este año: 31');
  ok(A._edadHoy('1995-12-20') === 30, 'cumpleaños que aún no llega: 30');
  ok(A._edadHoy('2026-08-19') === 0, 'recién nacido hoy: 0');
  ok(A._edadHoy('') === null && A._edadHoy(null) === null,
     'y sin fecha devuelve null: no inventa una edad');
  ok(!A.isMinor('') && !A.isMinor(null),
     'sin fecha no se le pide el consentimiento — el campo es obligatorio antes de este paso');
  ok(!A.isMinor('cualquier cosa'), 'ni con una fecha que no se entiende');
}

console.log('\n  La fecha se entiende venga como venga');
{
  const A = elDia('2026-08-19');
  ok(A._edadHoy('20/03/1995') === 31, 'dd/mm/yyyy, que es como está en la base de atletas');
  ok(A._edadHoy('1995-03-20') === 31, 'yyyy-mm-dd, que es lo que manda el campo de fecha');
  ok(A._edadHoy('5/3/1995') === 31, 'y sin el cero adelante también');
  ok(A._partesFecha('20/03/1995').mes === 3, 'no confunde el día con el mes: 20/03 es marzo');
  ok(A._anioNac('20/03/1995') === 1995 && A._anioNac('1995-03-20') === 1995,
     'y el año se saca igual de los dos formatos');
}

console.log('\nAl adulto se le piden los demás documentos, todos');
{
  const A = elDia('2026-08-19');
  const pedidos = A.docsRequeridos(EVENTO, '1995-03-20');
  ok(pedidos.indexOf('menorConsent') < 0, 'el consentimiento del tutor no aparece');
  ok(pedidos.length === 3, 'quedan los otros tres (' + pedidos.length + ')');
  ok(pedidos.join(',') === 'carnetIdFront,wadaIntl,carnetIdReverso',
     'los mismos y en el mismo orden: ' + pedidos.join(', '));
  ok(EVENTO.requiredDocs.length === 4,
     'y la lista del evento no se toca — se devuelve una copia, no el arreglo del evento');
}

console.log('\n  Al menor se le piden los cuatro');
{
  const A = elDia('2026-08-19');
  const pedidos = A.docsRequeridos(EVENTO, '2010-08-08');
  ok(pedidos.length === 4 && pedidos.indexOf('menorConsent') >= 0,
     'incluido el consentimiento: ' + pedidos.join(', '));
}

console.log('\n  Y un evento sin la lista no rompe nada');
{
  const A = elDia('2026-08-19');
  ok(A.docsRequeridos(null, '1995-03-20').length === 0, 'sin evento, lista vacía');
  ok(A.docsRequeridos({}, '1995-03-20').length === 0, 'evento viejo sin requiredDocs, lista vacía');
  ok(A.docsRequeridos({ requiredDocs: 'no es un arreglo' }, '1995-03-20').length === 0,
     'y con el campo mal escrito tampoco revienta');
}

console.log('\nUn solo criterio: el formulario y la validación final preguntan lo mismo');
{
  // Esto es lo que falló: el paso de documentos y la validación del envío miraban
  // la lista cruda por separado. Si vuelven a separarse, el adulto se traba en uno
  // de los dos lados y no se nota hasta que alguien no puede inscribirse.
  ok(/const _docsPedidos = docsRequeridos\(_evObj, f\.fechaNac\);/.test(src),
     'el paso de documentos calcula la lista una vez');
  ok(/_docsPedidos\.forEach\(docKey =>/.test(src), 'con eso dibuja las zonas de subida');
  ok(/const allDocsCheck = _docsPedidos\.map/.test(src), 'con eso arma el resumen');
  ok(/for\(const k of _docsPedidos\)\{/.test(src), 'con eso decide si el botón de enviar se prende');
  ok(/const missing = docsRequeridos\(_evObj2, f\.fechaNac\)\.filter\(dk => !_docsMap\[dk\]\)/.test(src),
     'y la validación previa al guardado usa la misma función');
  ok(!/_evObj\.requiredDocs\.forEach|_evObj\.requiredDocs\.map|of _evObj\.requiredDocs|_evObj2\.requiredDocs\.filter/.test(src),
     'no quedó ningún lugar leyendo la lista cruda del evento');
}

console.log('\nEn el formulario de verdad');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // Sin service worker: esta página registra /sw.js y el worker toma el
  // control a medio cargar, dejando la carga colgada contra el servidor local.
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto('http://localhost:8972/inscripcion.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof render === 'function' && typeof docsRequeridos === 'function',
    null, { timeout: 20000 });

  // Se para el formulario en el paso de documentos, con todo lo demás ya lleno y
  // el carnet y la WADA ya subidos. Es exactamente la situación en la que la
  // gente se quedó trabada: solo faltaba el papel que no le correspondía.
  async function pasoDocumentos(fechaNac) {
    return await p.evaluate((fn) => {
      EVENTS = [{
        id: 'ev1', name: 'Regional Sur Austral 2026', closeDate: '2030-12-31',
        requiredDocs: ['carnetIdFront', 'wadaIntl', 'menorConsent'],
      }];
      state.view = 'form'; state.step = 3; state.error = ''; state.success = '';
      state.privacyConsent = true;
      state.carnetName = 'carnet.jpg';        // ya subidos
      state.wadeName = 'wada.pdf';
      state.consentimientoName = '';          // este es el que está en discusión
      state.form = {
        evento: 'ev1', rut: '19839518-9', nombre: 'Persona De Prueba',
        fechaNac: fn, sexo: 'Masculino', club: 'FECHIPO',
        division: 'Open', categoria: '-83 kg', modalidad: 'Clásico',
        email: 'a@b.cl', telefono: '999999999',
      };
      render();
      const txt = document.getElementById('app').innerText;
      const enviar = [...document.querySelectorAll('button')]
        .find(x => /Enviar Inscripci/.test(x.textContent));
      return {
        pideConsentimiento: /Consentimiento Menor/i.test(txt),
        zonas: document.querySelectorAll('.upload-zone').length,
        pideCarnet: /Carnet de Identidad/i.test(txt),
        pideWada: /WADA/i.test(txt),
        puedeEnviar: !!enviar && !enviar.disabled,
      };
    }, fechaNac);
  }

  const adulto = await pasoDocumentos('1995-03-20');
  ok(!adulto.pideConsentimiento, 'al adulto no se le muestra el Consentimiento Menor');
  ok(adulto.zonas === 2, 'le quedan dos documentos por subir, no tres (' + adulto.zonas + ')');
  ok(adulto.pideCarnet && adulto.pideWada, 'el carnet y la WADA siguen pidiéndose');
  ok(adulto.puedeEnviar, 'y puede enviar la inscripción — que era el problema');

  const menor = await pasoDocumentos((new Date().getFullYear() - 16) + '-08-08');
  ok(menor.pideConsentimiento, 'al menor sí se le muestra');
  ok(menor.zonas === 3, 'con sus tres documentos (' + menor.zonas + ')');
  ok(!menor.puedeEnviar, 'y no puede enviar hasta subirlo');

  // El caso que llegó de producción, calculado contra el día de hoy para que no
  // se pudra con el calendario: alguien que cumplió 18 hace un mes.
  const hoy = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const cumplio18 = new Date(hoy.getFullYear() - 18, hoy.getMonth() - 1, 15);
  const cumple18Manana = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate() + 1);

  const recienAdulto = await pasoDocumentos(iso(cumplio18));
  ok(!recienAdulto.pideConsentimiento,
     'al que cumplió 18 hace poco (' + iso(cumplio18) + ') ya no se le pide — era el problema');
  ok(recienAdulto.puedeEnviar, 'y puede enviar');

  const casiAdulto = await pasoDocumentos(iso(cumple18Manana));
  ok(casiAdulto.pideConsentimiento,
     'y al que los cumple mañana (' + iso(cumple18Manana) + ') todavía sí');
  ok(!casiAdulto.puedeEnviar, 'ese no puede enviar hasta subirlo');

  console.log('\n  La salida para cuando la fecha está mal');
  {
    // La cuenta depende de una fecha que se autocompleta desde la base, y ahí hay
    // datos viejos y hasta fechas de relleno. Si esa fecha miente, a un adulto se
    // le pide un papel que no existe y su inscripción queda trabada sin nadie a
    // quien preguntarle. La salida es declararlo y seguir; queda anotado.
    const declarar = (v) => p.evaluate((val) => {
      state.declaraMayor = val; render();
      const txt = document.getElementById('app').innerText;
      const enviar = [...document.querySelectorAll('button')]
        .find(x => /Enviar Inscripci/.test(x.textContent));
      const casilla = [...document.querySelectorAll('input[type=checkbox]')]
        .find(c => (c.parentElement.innerText || '').indexOf('mayor de edad') >= 0);
      return {
        txt, puedeEnviar: !!enviar && !enviar.disabled,
        zonas: document.querySelectorAll('.upload-zone').length,
        hayCasilla: !!casilla, marcada: !!(casilla && casilla.checked),
      };
    }, v);

    // Se parte de un menor de verdad, con el consentimiento pedido.
    await pasoDocumentos((new Date().getFullYear() - 16) + '-08-08');
    const antes = await declarar(false);
    ok(!antes.puedeEnviar, 'de entrada no puede enviar: le falta el consentimiento');
    ok(antes.hayCasilla && !antes.marcada, 'pero tiene la casilla a la vista, sin marcar');
    ok(/ya eres mayor de edad/i.test(antes.txt), 'con el mensaje: "¿Ya eres mayor de edad?"');
    ok(/Comisión Técnica/.test(antes.txt), 'y diciendo que la Comisión Técnica lo revisa');
    ok(/\d{2}\/\d{2}\/\d{4}/.test(antes.txt),
       'y mostrándole la fecha que el sistema tiene, para que vea si está mal');

    const despues = await declarar(true);
    ok(despues.puedeEnviar, 'al marcarla, puede enviar');
    ok(despues.zonas === antes.zonas - 1, 'y el consentimiento deja de pedirse');
    ok(despues.hayCasilla && despues.marcada,
       'la casilla sigue a la vista y marcada — se puede volver atrás');

    const vuelta = await declarar(false);
    ok(!vuelta.puedeEnviar && vuelta.zonas === antes.zonas,
       'y al desmarcarla vuelve a pedirse: no es un camino de ida');

    await p.evaluate(() => { state.declaraMayor = false; });
  }

  console.log('\n  Al adulto normal no se le muestra la salida: no la necesita');
  {
    const r = await pasoDocumentos('1995-03-20');
    const txt = await p.evaluate(() => document.getElementById('app').innerText);
    ok(!/ya eres mayor de edad/i.test(txt), 'no aparece la casilla');
    ok(r.puedeEnviar, 'y puede enviar igual');
  }

  console.log('\n  Queda anotado para la Comisión Técnica');
  {
    ok(/declaraMayorEdad: !!state\.declaraMayor,/.test(src),
       'la declaración viaja en la inscripción');
    ok(/declaraMayorFecha: state\.declaraMayor \? \(f\.fechaNac \|\| ''\) : '',/.test(src),
       'junto con la fecha que el sistema tenía');
    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/i\.declaraMayorEdad\?/.test(adm), 'y se muestra al revisar inscripciones');
    ok(/Confirmar con el carnet/.test(adm),
       'pidiendo que se contraste con el carnet: es lo que evita que sirva para colar a un menor');
  }

  console.log('\n  Lo que ya funcionaba sigue igual');
  {
    // El sistema viejo —eventos sin requiredDocs— nunca tuvo el problema, pero
    // comparte la función isMinor, que se cambió. Hay gente inscrita por ahí.
    const r = await p.evaluate(() => {
      EVENTS = [{ id: 'ev2', name: 'Campeonato Viejo', closeDate: '2030-12-31' }];
      state.step = 3; state.form.evento = 'ev2'; state.form.fechaNac = '1995-03-20';
      state.consentimientoName = '';
      render();
      const txt = document.getElementById('app').innerText;
      const enviar = [...document.querySelectorAll('button')]
        .find(x => /Enviar Inscripci/.test(x.textContent));
      return { consent: /Consentimiento/i.test(txt), carnet: /Carnet de Identidad/i.test(txt),
               puedeEnviar: !!enviar && !enviar.disabled };
    });
    ok(!r.consent, 'en un evento sin lista de documentos, al adulto tampoco se le pide');
    ok(r.carnet, 'y el carnet se sigue pidiendo igual que siempre');
    ok(r.puedeEnviar, 'puede enviar');
    const r2 = await p.evaluate(() => {
      state.form.fechaNac = (new Date().getFullYear() - 16) + '-08-08'; render();
      return /Consentimiento/i.test(document.getElementById('app').innerText);
    });
    ok(r2, 'y al menor se le sigue pidiendo, como antes');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

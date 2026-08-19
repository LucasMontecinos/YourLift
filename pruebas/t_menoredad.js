// El consentimiento del tutor es solo para los menores.
//
// En producción pasó esto: a los adultos les aparecía el "Consentimiento Menor"
// como documento obligatorio y no podían enviar la inscripción. El botón quedaba
// apagado esperando un papel que no les corresponde.
//
// La causa: el sistema nuevo de documentos (`requiredDocs` en el evento) dibujaba
// y exigía TODA la lista sin mirar quién se está inscribiendo. El sistema viejo sí
// preguntaba por la edad; el nuevo se saltó ese paso.
//
// La regla que pidió la federación: el consentimiento le toca a los nacidos desde
// 2008 en 2026, y desde 2009 en 2027. Es por AÑO de nacimiento, no por la edad
// exacta al día de hoy, y la cuenta tiene que correrse sola cada enero.
//
// Lo que se cuida acá:
//   · que el adulto no vea el documento ni quede trabado por él;
//   · que el menor lo siga viendo y siga sin poder enviar hasta subirlo;
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

// Las tres funciones, montadas con un calendario falso: así se puede pararse en
// 2026 y en 2027 sin esperar a que llegue enero.
const CUERPO = ['isMinor', '_anioNac', 'docsRequeridos'].map(n => sacar(src, n)).join('\n');
function enElAnio(anio) {
  const FechaFalsa = function () { return { getFullYear: () => anio }; };
  FechaFalsa.prototype = Date.prototype;
  return new Function('Date', CUERPO + '\nreturn {isMinor,_anioNac,docsRequeridos};')(FechaFalsa);
}

const DOCS_EVENTO = ['carnetIdFront', 'wadaIntl', 'menorConsent', 'carnetIdReverso'];
const EVENTO = { id: 'sur_austral', name: 'Regional Sur Austral', requiredDocs: DOCS_EVENTO };

console.log('\nEn 2026 el consentimiento parte en los nacidos en 2008');
{
  const A = enElAnio(2026);
  ok(A.isMinor('2008-01-15'), 'nacido en enero de 2008 → sí (aunque ya cumplió 18)');
  ok(A.isMinor('2008-12-31'), 'nacido en diciembre de 2008 → sí');
  ok(A.isMinor('2012-06-01'), 'nacido en 2012 → sí');
  ok(!A.isMinor('2007-12-31'), 'nacido en diciembre de 2007 → no');
  ok(!A.isMinor('1995-03-20'), 'nacido en 1995 → no');
  ok(!A.isMinor('1968-07-04'), 'un Master nacido en 1968 → no');
}

console.log('\n  Y en 2027 se corre sola a los nacidos en 2009');
{
  const A = enElAnio(2027);
  ok(A.isMinor('2009-01-01'), '2009 → sí');
  ok(!A.isMinor('2008-01-15'), '2008 → ya no, sin tocar una línea de código');
  const B = enElAnio(2030);
  ok(B.isMinor('2012-05-05') && !B.isMinor('2011-05-05'),
     'en 2030 el corte queda en 2012: la cuenta es del calendario, no está escrita a mano');
}

console.log('\nLa fecha se entiende venga como venga');
{
  const A = enElAnio(2026);
  ok(A._anioNac('1995-03-20') === 1995, 'yyyy-mm-dd, que es lo que manda el campo de fecha');
  ok(A._anioNac('20/03/1995') === 1995, 'dd/mm/yyyy, que es como está en la base de atletas');
  ok(A._anioNac('') === 0 && A._anioNac(null) === 0 && A._anioNac(undefined) === 0,
     'y si no hay fecha, no inventa un año');
  ok(!A.isMinor('') && !A.isMinor(null),
     'sin fecha no se le pide el consentimiento: el campo es obligatorio antes de este paso');
}

console.log('\nAl adulto se le piden los demás documentos, todos');
{
  const A = enElAnio(2026);
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
  const A = enElAnio(2026);
  const pedidos = A.docsRequeridos(EVENTO, '2010-08-08');
  ok(pedidos.length === 4 && pedidos.indexOf('menorConsent') >= 0,
     'incluido el consentimiento: ' + pedidos.join(', '));
}

console.log('\n  Y un evento sin la lista no rompe nada');
{
  const A = enElAnio(2026);
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
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
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

  const menor = await pasoDocumentos('2010-08-08');
  ok(menor.pideConsentimiento, 'al menor sí se le muestra');
  ok(menor.zonas === 3, 'con sus tres documentos (' + menor.zonas + ')');
  ok(!menor.puedeEnviar, 'y no puede enviar hasta subirlo');

  const borde = await pasoDocumentos('2008-01-15');
  ok(borde.pideConsentimiento, 'y al nacido en enero de 2008 también, aunque ya tenga 18 cumplidos');

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
      state.form.fechaNac = '2010-08-08'; render();
      return /Consentimiento/i.test(document.getElementById('app').innerText);
    });
    ok(r2, 'y al menor se le sigue pidiendo, como antes');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

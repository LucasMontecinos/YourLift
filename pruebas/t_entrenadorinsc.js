// La inscripción de entrenadores: un período aparte del de los atletas.
//
// Olimpiadas Especiales lo pidió así: el entrenador se inscribe él, dice a qué
// atletas lleva —de los que YA están inscritos en ese campeonato— y sube los
// documentos que ese campeonato le pide a él. Hasta ahora ese vínculo
// atleta↔entrenador solo existía en el cronograma, escrito a mano después.
//
// Las dos decisiones que se cuidan acá:
//
// · NO pide iniciar sesión. Se identifica por RUT y guarda un PIN, igual que la
//   inscripción del atleta. Si pidiera cuenta, no se inscribiría nadie.
//
// · Estar acreditado NO es requisito. Se busca el RUT en la base de acreditados y
//   se rellena lo que hay, pero quien no está —una organización que no es
//   FECHIPO— se inscribe igual y queda marcado para que lo revise la
//   organización. Exigirlo dejaría fuera campeonatos enteros el primer día.
//
// Y una que es de seguridad y no se ve: lo que el formulario guarda tiene que
// caber en lo que las reglas publicadas aceptan. Las reglas usan hasOnly/hasAny
// —listas cerradas— y un campo de más no se descarta: bota la inscripción entera
// con "Missing or insufficient permissions", al final, después de subir todo.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_entrenadorinsc.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const HOY = new Date().toISOString().slice(0, 10);
const AYER = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const PROX = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

// Los campeonatos existen solo para poder decir el nombre del que le toca a un
// formulario. El formulario es el que manda.
const EVENTOS = [
  { id: 'oe_nac', name: 'Nacional Olimpiadas Especiales', date: '2026-11-14', status: 'open' },
  { id: 'reg', name: 'Regional', date: '2026-10-01', status: 'open' },
];

const FORMS = [
  { id: 'f_camp', nombre: 'Entrenadores · Nacional Olimpiadas Especiales', tipo: 'campeonato',
    evento: 'oe_nac', abierto: true, cierra: PROX,
    texto: 'Inscribe primero a tus atletas y después vuelve acá.',
    documentos: [{ key: 'ant1', label: 'Certificado de antecedentes',
      desc: 'Vigente, no más de 90 días', plantillaUrl: 'https://ejemplo.cl/form.pdf',
      linkUrl: 'https://registrocivil.cl', linkTexto: 'Se saca en el Registro Civil' }] },
  { id: 'f_venc', nombre: 'Formulario con el plazo vencido', tipo: 'campeonato',
    evento: 'reg', abierto: true, cierra: AYER, documentos: [] },
  { id: 'f_cerr', nombre: 'Formulario todavía cerrado', tipo: 'campeonato',
    evento: 'reg', abierto: false, documentos: [] },
  // El que justifica todo el cambio: una convocatoria de acreditación no tiene
  // campeonato ni atletas.
  { id: 'f_acred', nombre: 'Quinta acreditación de entrenadores 2027', tipo: 'acreditacion',
    evento: '', abierto: true, cierra: PROX, texto: 'Postulación a Cat. 2.',
    documentos: [{ key: 'cv', label: 'Currículum deportivo', desc: 'PDF' }] },
];

const ATLETAS = [
  { rut: '111111111', nombre: 'Ana Soto', club: 'Club Uno', modalidad: 'Olimpiadas Especiales',
    division: 'Open', categoria: '57', status: 'approved' },
  { rut: '222222222', nombre: 'Bruno Díaz', club: 'Club Dos', modalidad: 'Olimpiadas Especiales',
    division: 'Junior', categoria: '74', status: 'pending' },
  { rut: '333333333', nombre: 'Carla Vera', club: 'Club Uno', modalidad: 'Powerlifting Classic',
    division: 'Open', categoria: '63', status: 'approved' },
];

// Un Firebase de mentira que solo sabe lo justo: buscar un entrenador por RUT y
// dejarse escribir, guardando lo que le mandaron para poder mirarlo después.
const FB_FALSO = `{
  db:{}, storage:{},
  collection:(_d,n)=>({__n:n}), doc:(_d,n,i)=>({__n:n,__i:i}),
  query:c=>c, where:()=>({}), serverTimestamp:()=>'TS',
  getDoc: async r => {
    const b = (window.__BASE||{})[r.__i];
    return { exists:()=>!!b, data:()=>b||{} };
  },
  getDocs: async () => ({ forEach(f){ (window.__INSC||[]).forEach(x=>f({data:()=>x})); } }),
  setDoc: async ()=>{},
  ref:()=>({}), uploadBytes: async()=>({}), getDownloadURL: async()=>'https://archivo/x.pdf',
  runTransaction: async (_db, fn) => fn({
    get: async ()=>({exists:()=>false, data:()=>({})}),
    set: (ref,data)=>{ (window.__ESCRITO=window.__ESCRITO||{})[ref.__n]=data; }
  })
}`;

const montar = async (p, forms, evs) => p.evaluate(([f, fb, e]) => {
  window._montar(f, eval('(' + fb + ')'), e);
}, [forms, FB_FALSO, evs || EVENTOS_G]);

global.EVENTOS_G = EVENTOS;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 900, height: 1100 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(a => { window.__INSC = a; }, ATLETAS);
  await p.goto(`http://localhost:${PUERTO}/inscripcion_entrenador.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof window._montar === 'function', null, { timeout: 25000 });

  console.log('\nSolo salen los formularios abiertos');
  {
    await montar(p, FORMS);
    const r = await p.evaluate(() => {
      const ops = [...document.querySelectorAll('select option')].map(o => o.textContent.trim());
      return { ops,
        abierto: formAbierto({ abierto: true, cierra: '' }),
        vencido: formAbierto({ abierto: true, cierra: '2020-01-01' }),
        apagado: formAbierto({ abierto: false }) };
    });
    ok(r.ops.some(o => /Olimpiadas Especiales/.test(o)), 'el abierto sale');
    ok(r.ops.some(o => /Quinta acreditación/.test(o)), 'la acreditación también, sin campeonato ninguno');
    ok(!r.ops.some(o => /plazo vencido/.test(o)), 'el que ya cerró, no');
    ok(!r.ops.some(o => /todavía cerrado/.test(o)), 'y el que no está abierto, tampoco');
    ok(r.abierto && !r.vencido && !r.apagado, 'sin fecha de cierre queda abierto; con fecha pasada, cerrado');
  }

  console.log('\n  Si no hay ninguno abierto, se dice y no se muestra un formulario vacío');
  {
    await montar(p, [FORMS[2]]);
    const t = await p.evaluate(() => document.body.innerText);
    ok(/no hay ningún formulario/i.test(t), 'lo dice con todas sus letras');
    ok(!/Tus datos/.test(t), 'y no ofrece llenar nada');
  }

  console.log('\n  Una acreditación no pide atletas: ese paso no existe');
  {
    await montar(p, FORMS);
    const r = await p.evaluate(() => {
      setForm('f_acred');
      const acred = pasos().slice();
      setForm('f_camp');
      const camp = pasos().slice();
      // Y avanzando desde los datos, la acreditación salta al de documentos.
      setForm('f_acred'); _estado.step = 1; avanzar();
      const siguiente = _estado.step;
      return { acred, camp, siguiente, texto: document.body.innerText };
    });
    ok(r.camp.join() === '0,1,2,3,4', 'la de campeonato tiene el paso de atletas');
    ok(r.acred.join() === '0,1,3,4', 'la acreditación no');
    ok(r.siguiente === 3, 'y avanzar desde los datos lleva directo a los documentos');
    ok(!/Tus atletas/.test(r.texto), 'no se dibuja el paso de atletas');
  }

  console.log('\n  El RUT se valida antes de tocar la base');
  {
    const r = await p.evaluate(() => ({
      bueno: rutValido('11.111.111-1'), malo: rutValido('11.111.111-2'),
      corto: rutValido('123'), conK: rutValido('16.179.810-K'), vacio: rutValido(''),
    }));
    ok(r.bueno && r.conK, 'un RUT bien tipeado pasa, con dígito K incluido');
    ok(!r.malo, 'uno con el dígito verificador cambiado, no');
    ok(!r.corto && !r.vacio, 'ni uno corto ni uno vacío');
  }

  console.log('\n  La acreditación: se mira, pero no tranca');
  {
    const mes = new Date().toISOString().slice(0, 7);
    const futuro = (new Date().getFullYear() + 1) + '-05';
    const r = await p.evaluate(([m, f]) => ({
      vigente: !!acreditacionVigente({ acreditaciones: [{ vence: f }] }),
      vencida: !!acreditacionVigente({ acreditaciones: [{ vence: '2020-01' }] }),
      justoHoy: !!acreditacionVigente({ acreditaciones: [{ vence: m }] }),
      ninguna: !!acreditacionVigente({ acreditaciones: [] }),
      // De varias, se queda con la que vence más tarde.
      laUltima: (acreditacionVigente({ acreditaciones: [{ vence: '2020-01' }, { vence: f }] }) || {}).vence,
    }), [mes, futuro]);
    ok(r.vigente && !r.vencida, 'una acreditación al día está vigente y una del 2020 no');
    ok(r.justoHoy, 'la que vence este mismo mes todavía cuenta');
    ok(!r.ninguna, 'sin acreditaciones, no hay vigencia');
    ok(r.laUltima === futuro, 'de varias, manda la que vence más tarde');
  }
  {
    // Acreditado: se le rellenan los datos y sale en verde. Pero el CORREO no se
    // rellena: la base de entrenadores se lee sin sesión, y devolver el correo de
    // quien sea que tecleen convertiría esto en un buscador de correos ajenos.
    await montar(p, FORMS);
    const r = await p.evaluate(async f => {
      window.__BASE = { '11.111.111-1': { nombre: 'Pedro Rojas', club: 'Club Uno',
        categoria: 'Cat. 2', correos: ['secreto@ejemplo.cl'],
        acreditaciones: [{ vence: f, categoria: 'Cat. 2' }] } };
      _estado.step = 1; setCampo('rut', '11.111.111-1');
      await buscarRut();
      return { nombre: _estado.ent.nombre, club: _estado.ent.club, correo: _estado.ent.correo,
               acred: _estado.acred, texto: document.body.innerText };
    }, (new Date().getFullYear() + 1) + '-05');
    ok(r.acred.encontrado && r.acred.vigente, 'lo encuentra y ve la acreditación vigente');
    ok(r.nombre === 'Pedro Rojas' && r.club === 'Club Uno', 'le rellena nombre y club');
    ok(r.correo === '', 'pero NO el correo: la base se lee sin sesión');
    ok(!/secreto@ejemplo\.cl/.test(r.texto), 'y el correo de la base no aparece en pantalla');
    ok(/vigente/i.test(r.texto), 'y se le dice que está vigente');
  }
  {
    // No está en la base: se inscribe igual. Éste es el caso de Olimpiadas
    // Especiales, que no son entrenadores acreditados por FECHIPO.
    const r = await p.evaluate(async () => {
      window.__BASE = {};
      _estado.ent = { rut: '', nombre: '', club: '', categoria: '', correo: '', telefono: '', pin: '' };
      _estado.step = 1; setCampo('rut', '11.111.111-1');
      await buscarRut();
      // Y con sus datos llenos a mano, puede seguir.
      setCampo('nombre', 'Marta Fuentes'); setCampo('correo', 'marta@ejemplo.cl'); setCampo('pin', '4321');
      const btn = [...document.querySelectorAll('button')].find(b => /Continuar/i.test(b.textContent));
      return { acred: _estado.acred, texto: document.body.innerText, trancado: !!btn && btn.disabled };
    });
    ok(r.acred && !r.acred.encontrado, 'no lo encuentra');
    ok(/[Pp]uedes inscribirte igual/.test(r.texto), 'y le dice que se puede inscribir igual');
    ok(!r.trancado, 'el botón de continuar no queda trancado');
  }
  {
    // En la base pero vencida: mismo trato, aviso distinto.
    const r = await p.evaluate(async () => {
      window.__BASE = { '11.111.111-1': { nombre: 'Ana Vieja', club: 'X',
        acreditaciones: [{ vence: '2020-01' }] } };
      _estado.ent = { rut: '', nombre: '', club: '', categoria: '', correo: '', telefono: '', pin: '' };
      _estado.step = 1; setCampo('rut', '11.111.111-1'); await buscarRut();
      return { a: _estado.acred, t: document.body.innerText };
    });
    ok(r.a.encontrado && !r.a.vigente, 'lo encuentra pero sin vigencia');
    ok(/no está vigente/i.test(r.t), 'y se lo dice');
    ok(/[Pp]uedes inscribirte igual/.test(r.t), 'sin trancarlo');
  }

  console.log('\n  Elegir atletas: de los que ya están inscritos, y al menos uno');
  {
    const r = await p.evaluate(async () => {
      // Se deja que los atletas los cargue el propio formulario desde Firestore,
      // que es como pasa de verdad: setForm dispara la carga.
      setForm('f_camp');
      await new Promise(r => setTimeout(r, 150));
      _estado.step = 2; _estado.atletas = []; render();
      const nombres = [...document.querySelectorAll('.ath .n')].map(x => x.textContent.trim());
      const btnAntes = [...document.querySelectorAll('button')].find(b => /Continuar/i.test(b.textContent));
      const trancadoSinNinguno = !!btnAntes && btnAntes.disabled;
      togglAtleta('111111111'); togglAtleta('222222222');
      const btn = [...document.querySelectorAll('button')].find(b => /Continuar/i.test(b.textContent));
      return { nombres, trancadoSinNinguno, elegidos: _estado.atletas.length,
               libre: !!btn && !btn.disabled, texto: document.body.innerText };
    });
    ok(r.nombres.length === 3, 'salen los atletas inscritos en ese campeonato');
    ok(r.trancadoSinNinguno, 'sin elegir a ninguno no se puede seguir');
    ok(r.elegidos === 2 && r.libre, 'con uno o más, sí — y no hay tope');
    ok(/por revisar/.test(r.texto), 'los que están pendientes se marcan como tales');
  }
  {
    // Un rechazado no puede aparecer: ése no va a competir, y ofrecérselo al
    // entrenador sería mandarlo a inscribir a alguien que quedó fuera.
    const r = await p.evaluate(async () => {
      window.__INSC = [
        { rut: '444444444', nombre: 'Rechazado Pérez', status: 'rejected', evento: 'oe_nac' },
        { rut: '555555555', nombre: 'Aceptada Rojas', status: 'approved', evento: 'oe_nac' },
      ];
      setForm('f_camp');
      await new Promise(r => setTimeout(r, 120));
      _estado.step = 2; render();
      return document.body.innerText;
    });
    ok(!/Rechazado Pérez/.test(r), 'un atleta rechazado no se ofrece');
    ok(/Aceptada Rojas/.test(r), 'y uno aceptado sí');
  }

  console.log('\n  Los documentos del entrenador, con su formulario y su link');
  {
    const r = await p.evaluate(() => {
      const cat = docsEntrenador({ documentos: [{ key: 'ant1', label: 'Certificado de antecedentes',
        desc: 'Vigente', plantillaUrl: 'https://ejemplo.cl/form.pdf', linkUrl: 'https://registrocivil.cl',
        linkTexto: 'Se saca en el Registro Civil' }] });
      _estado.step = 3; _estado.archivos = {}; _estado.nombres = {}; render();
      const btn = [...document.querySelectorAll('button')].find(b => /Continuar/i.test(b.textContent));
      return { claves: Object.keys(cat), texto: document.body.innerText,
               html: document.body.innerHTML, trancado: !!btn && btn.disabled };
    });
    ok(r.claves.length === 1 && r.claves[0] === 'e_ant1',
       'la clave lleva su prefijo, para no pisar la de un documento del atleta');
    ok(/Certificado de antecedentes/.test(r.texto), 'se ve el nombre del documento');
    ok(/DESCARGAR FORMULARIO/.test(r.texto) && /ejemplo\.cl\/form\.pdf/.test(r.html),
       'con el formulario en blanco para descargar');
    ok(/IR A LA PÁGINA/.test(r.texto) && /registrocivil\.cl/.test(r.html), 'y el link a la otra página');
    ok(/Se saca en el Registro Civil/.test(r.texto), 'con el texto que se le escribió');
    ok(r.trancado, 'y sin subirlo no se puede seguir');
  }
  {
    // Un campeonato que no le pide nada al entrenador no lo deja trancado.
    const r = await p.evaluate(() => {
      window._montar([{ id: 'sin_docs', nombre: 'Sin documentos', tipo: 'acreditacion', abierto: true, documentos: [] }]);
      _estado.form = 'sin_docs'; _estado.step = 3; _estado.archivos = {}; render();
      const btn = [...document.querySelectorAll('button')].find(b => /Continuar/i.test(b.textContent));
      return { t: document.body.innerText, trancado: !!btn && btn.disabled };
    });
    ok(/no pide documentos/i.test(r.t), 'lo dice');
    ok(!r.trancado, 'y deja continuar');
  }

  console.log('\n  Lo que se guarda cabe en lo que las reglas aceptan');
  {
    await montar(p, FORMS);
    const escrito = await p.evaluate(async ats => {
      window.__ESCRITO = {};
      setForm('f_camp'); _estado.ok = '';
      _estado.ent = { rut: '11.111.111-1', nombre: 'Marta Fuentes', club: 'Club Uno',
                      categoria: 'Cat. 2', correo: 'marta@ejemplo.cl', telefono: '+56 9 1111 1111', pin: '4321' };
      _estado.acred = { encontrado: true, vigente: true, hasta: '2027-05', categoria: 'Cat. 2' };
      window._atletas(ats);
      _estado.atletas = ['111111111', '222222222'];
      _estado.archivos = { e_ant1: new File(['x'], 'ant.pdf', { type: 'application/pdf' }) };
      _estado.nombres = { e_ant1: 'ant.pdf' };
      await enviar();
      return { pub: window.__ESCRITO['inscripciones_entrenador'],
               priv: window.__ESCRITO['inscripciones_entrenador_priv'],
               error: _estado.error, ok: _estado.ok };
    }, ATLETAS);
    ok(!escrito.error && escrito.ok === 'listo', 'la inscripción se envía' + (escrito.error ? ': ' + escrito.error : ''));
    ok(escrito.pub && escrito.pub.status === 'pending', 'queda pendiente de revisión');
    ok(escrito.pub && escrito.pub.atletas.length === 2, 'con los dos atletas que eligió');
    ok(escrito.pub && escrito.pub.acreditado === true && escrito.pub.enBase === true,
       'y con la acreditación anotada, que es lo que la organización revisa');
    ok(escrito.priv && escrito.priv.docs && escrito.priv.docs.e_ant1,
       'el documento queda guardado en el mapa docs, en la parte privada');

    // La parte que no se ve y es la que rompe: los campos tienen que caber en la
    // lista cerrada de las reglas.
    const reglas = fs.readFileSync('/home/user/YourLift/firestore.rules', 'utf8');
    const prohibidos = (reglas.match(/function inscEntrenadorValida\(\)[\s\S]*?hasAny\(\[([^\]]*)\]\)/) || [])[1] || '';
    const veto = prohibidos.split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    const colados = Object.keys(escrito.pub || {}).filter(k => veto.includes(k));
    ok(veto.length > 0, 'las reglas vetan campos en la parte pública (' + veto.join(', ') + ')');
    ok(!colados.length, 'y la parte pública no lleva ninguno' + (colados.length ? ' — se coló: ' + colados.join(', ') : ''));

    const permit = (reglas.match(/function datosEntrenadorValidos\(\)[\s\S]*?hasOnly\(\[([^\]]*)\]\)/) || [])[1] || '';
    const listaOk = permit.split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    const fuera = Object.keys(escrito.priv || {}).filter(k => !listaOk.includes(k));
    ok(listaOk.includes('pin') && listaOk.includes('docs'), 'y una lista cerrada en la parte privada');
    ok(!fuera.length, 'donde tampoco sobra nada' + (fuera.length ? ' — sobra: ' + fuera.join(', ') : ''));
    ok(String(escrito.priv.pin).length === 4, 'el PIN tiene los 4 dígitos que la regla exige');
  }

  console.log('\n  Y el archivo va a una carpeta que ya tiene su regla');
  {
    // Se reusa athlete_files/{rut}/, que es la carpeta de quien se inscribe y ya
    // está publicada. El nombre lleva "entrenador_" delante porque hay
    // entrenadores que además compiten: mismo RUT, misma carpeta.
    const src = await (await fetch(`http://localhost:${PUERTO}/inscripcion_entrenador.html`)).text();
    ok(/athlete_files\/\$\{rc\}\/entrenador_/.test(src), 'sube a athlete_files con el prefijo entrenador_');
    const st = fs.readFileSync('/home/user/YourLift/storage.rules', 'utf8');
    ok(/match \/athlete_files\/\{rut\}\/\{file\}/.test(st), 'y esa ruta tiene su match en storage.rules');
  }

  console.log('\n  Y salen en la nómina pública del campeonato');
  {
    const p2 = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
    const e2 = []; p2.on('pageerror', x => e2.push(x.message));
    await p2.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => typeof _nomEntrenadores === 'function', null, { timeout: 25000 });
    const r = await p2.evaluate(() => {
      // Tres inscripciones: dos aprobadas y una pendiente.
      _aplicaEntrenadores([
        { evento: 'oe', status: 'approved', nombre: 'Marta Fuentes', club: 'Club Uno',
          atletas: [{ nombre: 'Ana Soto' }, { nombre: 'Bruno Díaz' }] },
        { evento: 'oe', status: 'approved', nombre: 'Ana Reyes', club: 'Club Dos', atletas: [] },
        { evento: 'oe', status: 'pending', nombre: 'Pendiente Pérez', club: 'X', atletas: [] },
        { evento: 'oe', status: 'rejected', nombre: 'Rechazado Ruiz', club: 'X', atletas: [] },
      ]);
      return { conEnt: _nomEntrenadores({ id: 'oe', name: 'Nacional OE' }),
               sinEnt: _nomEntrenadores({ id: 'otro', name: 'Otro' }),
               orden: (window.ENTRE_NOM.oe || []).map(x => x.nombre) };
    });
    ok(/Marta Fuentes/.test(r.conEnt) && /Ana Reyes/.test(r.conEnt), 'salen los entrenadores aprobados');
    ok(!/Pendiente Pérez/.test(r.conEnt), 'el pendiente NO se publica: todavía lo revisa la organización');
    ok(!/Rechazado Ruiz/.test(r.conEnt), 'y el rechazado tampoco');
    ok(/ENTRENADORES · 2/.test(r.conEnt), 'con la cuenta correcta');
    ok(/Ana Soto/.test(r.conEnt) && /Bruno Díaz/.test(r.conEnt), 'y los atletas que lleva cada uno');
    ok(r.orden.join('|') === 'Ana Reyes|Marta Fuentes', 'ordenados por nombre');
    ok(r.sinEnt === '', 'un campeonato sin entrenadores no dibuja una sección vacía');
    ok(!e2.length, 'sin errores en el sitio público' + (e2.length ? ': ' + e2[0] : ''));

    // Y el entrenador tiene que poder ENCONTRAR el formulario. Si el aviso no
    // sale en la pestaña de inscripción, nadie va a adivinar que la página existe.
    const av = await p2.evaluate(([prox, ayer]) => {
      const hacer = fs => { window.FORMS_ENT = fs; return _avisoEntrenadores(); };
      return {
        abierto: hacer([{ id: 'f1', nombre: 'Entrenadores · Nacional OE', abierto: true, cierra: prox }]),
        cerrado: hacer([{ id: 'f1', nombre: 'Entrenadores · Nacional OE', abierto: true, cierra: ayer }]),
        apagado: hacer([{ id: 'f1', nombre: 'Entrenadores · Nacional OE', abierto: false }]),
        dos: hacer([{ id: 'a', nombre: 'Uno', abierto: true }, { id: 'b', nombre: 'Dos', abierto: true }]),
      };
    }, [PROX, AYER]);
    ok(/inscripcion_entrenador\.html/.test(av.abierto), 'el aviso enlaza al formulario del entrenador');
    ok(/Nacional OE/.test(av.abierto), 'y lo nombra cuando es uno solo');
    ok(av.cerrado === '' && av.apagado === '', 'y no sale si está cerrado o vencido');
    ok(/2 formularios/.test(av.dos), 'con varios, dice cuántos son');

    // Y en la pestaña de entrenadores del sitio, que es donde mira quien anda
    // buscando algo de entrenadores. Antes solo salía en la del atleta.
    // Se dibuja la pantalla de verdad —ST.v + render()— en vez de llamar a la
    // función suelta: las de esa zona de index.html no quedan colgadas de window,
    // y pasar por render() es además lo que hace el sitio.
    const ent = await p2.evaluate(prox => {
      window._ENTRENADORES_PUB = [{ nombre: 'Pedro Rojas', club: 'Club Uno', categoria: 'Cat. 2' }];
      const pinta = fs => { window.FORMS_ENT = fs; ST.v = 'entrenadores'; render();
                            return document.getElementById('app').innerHTML; };
      const con = pinta([{ id: 'f1', nombre: 'Quinta acreditación 2027', abierto: true, cierra: prox }]);
      return { con, sin: pinta([]) };
    }, PROX);
    ok(/inscripcion_entrenador\.html/.test(ent.con),
       'la pestaña Entrenadores del sitio también lleva al formulario');
    ok(/Quinta acreditación 2027/.test(ent.con), 'y lo nombra');
    ok(/Pedro Rojas/.test(ent.con), 'sin tapar la lista de acreditados');
    ok(!/inscripcion_entrenador\.html/.test(ent.sin),
       'y si no hay ninguno abierto, no sale el aviso');
    await p2.close();
  }

  ok(!errs.length, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

// El panel: los documentos del campeonato y la inscripción de entrenadores.
//
// Dos cosas se cuidan acá, y las dos salieron de errores reales.
//
// 1. Los documentos PROPIOS del campeonato desaparecían de la lista. La lista se
//    dibujaba en dos lugares: dentro del HTML del formulario, con los propios
//    incluidos, y otra vez en renderDocsChecklist(), que corre en un hook después
//    de CADA render y solo conocía el catálogo fijo. El segundo pisaba al primero,
//    así que apenas la pantalla se redibujaba, los propios se borraban de la vista
//    y no se podían desmarcar. Ahora hay un solo lugar que la dibuja.
//
// 2. Un documento se le puede pedir a una modalidad y no a todo el campeonato.
//    Olimpiadas Especiales corre junto al powerlifting en el mismo campeonato, y
//    sus antecedentes son de ellos.
//
// El panel no arranca sin Firebase, así que se interceptan sus módulos y se
// sirven falsos. Es la única forma de abrirlo acá y mirarlo de verdad.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_docsadmin.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MODULOS = {
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `
    export const getAuth=()=>({currentUser:{uid:'u1',email:'x@y.cl'}});
    export const signInWithEmailAndPassword=async()=>({user:{uid:'u1'}});
    export const signOut=async()=>{};
    export const createUserWithEmailAndPassword=async()=>({user:{uid:'u2'}});
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb({uid:'u1',email:'x@y.cl'}),0);return()=>{};};`,
  'firebase-firestore.js': `
    const snap=(d)=>({docs:d.map(x=>({id:x.id,data:()=>x,exists:()=>true})),forEach(f){this.docs.forEach(f)},size:d.length,empty:!d.length});
    const busca=q=>(globalThis.__FAKE&&globalThis.__FAKE[q&&(q.__n||(q.__q&&q.__q.__n))])||[];
    export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
    export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
    export const collection=(_d,n)=>({__n:n}); export const doc=(_d,n,i)=>({__n:n,__i:i});
    export const getDocs=async q=>snap(busca(q));
    export const getDoc=async r=>{const d=(busca(r)||[]).find(x=>x.id===r.__i);return{exists:()=>!!d,data:()=>d||{},id:r.__i};};
    export const setDoc=async()=>{}; export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
    export const deleteField=()=>null; export const addDoc=async()=>({id:'x'});
    export const query=c=>({__q:c,__n:c&&c.__n}); export const where=()=>({}); export const orderBy=()=>({}); export const limit=()=>({});
    export const onSnapshot=(q,cb)=>{try{cb(snap(busca(q)))}catch(e){}return()=>{};};
    export const serverTimestamp=()=>0;
    export const writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});`,
  'firebase-storage.js': `
    export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>''; export const deleteObject=async()=>{}; export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}});`,
};

const EVENTO = {
  id: 'oe_nac', name: 'Nacional con Olimpiadas Especiales', date: '2026-11-14', status: 'open',
  requiredDocs: ['carnetIdFront', 'x_med1'],
  docsExtra: [{ key: 'med1', label: 'Certificado médico OE', desc: 'Firmado por el médico',
                plantillaUrl: '', linkUrl: '', linkTexto: '' }],
  docsCond: { x_med1: { mods: ['Olimpiadas Especiales'], divs: [] } },
  modsExtra: ['Juegos Especiales'], modsSolo: false,
};

// Lee la lista de documentos como la ve el admin: cada casilla con su nombre,
// si está marcada y si dice "limitado".
const LEER = `(() => {
  const fila = [...document.querySelectorAll('#ef_docs_container label')];
  return fila.map(l => ({
    key: l.querySelector('input[type=checkbox]')?.getAttribute('data-doc-key'),
    texto: (l.textContent||'').replace(/\\s+/g,' ').trim(),
    marcado: !!l.querySelector('input[type=checkbox]')?.checked,
    limitado: /limitado/.test(l.textContent||''),
    chips: [...l.querySelectorAll('button')].map(b => b.textContent.trim()),
  }));
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(ev => {
    window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }], eventos: [ev] };
  }, EVENTO);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof ST !== 'undefined' && typeof window.renderDocsChecklist === 'function',
    null, { timeout: 25000 });
  await p.waitForTimeout(700);

  // Abrir el campeonato en el formulario de edición, como lo haría el admin.
  await p.evaluate(ev => { ST.eventos = [ev]; ST.view = 'campeonatos'; editEvento(ev.id); }, EVENTO);
  await p.waitForTimeout(400);

  console.log('\nLos documentos propios salen en la lista, y se quedan');
  {
    const filas = await p.evaluate(LEER);
    const propio = filas.find(f => f.key === 'x_med1');
    ok(filas.length > 5, 'la lista se dibujó (' + filas.length + ' documentos)');
    ok(!!propio, 'el documento propio del campeonato aparece');
    ok(propio && /Certificado médico OE/.test(propio.texto), 'con el nombre que se le puso');
    ok(propio && propio.marcado, 'y marcado, porque está en los requeridos');
    ok(filas.some(f => f.key === 'carnetIdFront' && f.marcado), 'el carnet sigue marcado');
    ok(filas.some(f => f.key === 'wadaIntl' && !f.marcado), 'y el que no se pide, sin marcar');

    // Éste es el error que se arregló: volver a dibujar la pantalla borraba los
    // propios de la lista, porque el hook la repintaba solo con el catálogo fijo.
    await p.evaluate(() => render());
    await p.waitForTimeout(300);
    const otra = await p.evaluate(LEER);
    ok(otra.some(f => f.key === 'x_med1'), 'y después de redibujar la pantalla sigue ahí');
    ok(otra.find(f => f.key === 'x_med1')?.marcado, 'todavía marcado');
  }

  console.log('\n  Se ve a qué modalidad se le pide');
  {
    const filas = await p.evaluate(LEER);
    const propio = filas.find(f => f.key === 'x_med1');
    const carnet = filas.find(f => f.key === 'carnetIdFront');
    ok(propio && propio.limitado, 'el que está limitado lo dice');
    ok(carnet && !carnet.limitado, 'y el que se le pide a todos, no');
    ok(propio && propio.chips.includes('Olimpiadas Especiales'),
       'las modalidades salen para elegir');
    ok(propio && propio.chips.includes('Juegos Especiales'),
       'incluida la modalidad propia del campeonato');
    ok(propio && propio.chips.includes('Open'), 'y las divisiones también');
  }

  console.log('\n  Limitar y soltar funciona desde la pantalla');
  {
    const r = await p.evaluate(() => {
      // Limitar el carnet a una modalidad.
      efCondToggle('carnetIdFront', 'mods', 'Powerlifting Equipado');
      const tras = JSON.parse(JSON.stringify(window._efDocsCond.carnetIdFront));
      // Y soltarlo: vuelve a ser de todos.
      efCondLimpiar('carnetIdFront');
      return { tras, despues: window._efDocsCond.carnetIdFront || null };
    });
    ok(r.tras.mods.length === 1 && r.tras.mods[0] === 'Powerlifting Equipado',
       'marcar una modalidad la guarda');
    ok(r.despues === null, 'y "pedírselo a todos" borra la condición entera');
  }

  console.log('\n  Desmarcar un documento no se pierde al redibujar');
  {
    // La casilla se repinta entera en cada cambio: si el visto no quedara
    // guardado en el estado antes de repintar, se desharía solo.
    const r = await p.evaluate(async () => {
      const cb = document.querySelector('#ef_docs_container input[data-doc-key="carnetIdFront"]');
      cb.checked = false; efDocMarcado(cb, 'carnetIdFront');
      render();
      await new Promise(r => setTimeout(r, 250));
      const ahora = document.querySelector('#ef_docs_container input[data-doc-key="carnetIdFront"]');
      return { enEstado: (ST.eventoForm.requiredDocs || []).indexOf('carnetIdFront'),
               enPantalla: !!ahora && ahora.checked };
    });
    ok(r.enEstado < 0, 'sale de la lista de requeridos');
    ok(!r.enPantalla, 'y sigue desmarcado después de redibujar');
  }

  console.log('\n  Un documento propio nuevo queda pedido de inmediato');
  {
    const r = await p.evaluate(() => {
      const antes = (ST.eventoForm.requiredDocs || []).length;
      efDocAgregar('x');
      const nuevo = window._efDocsX[window._efDocsX.length - 1];
      efDocSet('x', window._efDocsX.length - 1, 'label', 'Autorización del apoderado');
      return { antes, despues: (ST.eventoForm.requiredDocs || []).length,
               marcado: (ST.eventoForm.requiredDocs || []).indexOf('x_' + nuevo.key) >= 0,
               enLista: /Autorización del apoderado/
                 .test(document.getElementById('ef_docs_container').textContent || '') };
    });
    ok(r.despues === r.antes + 1 && r.marcado,
       'se agrega marcado: quien crea un documento lo crea para pedirlo');
    ok(r.enLista, 'y su nombre aparece arriba apenas se escribe');
  }

  console.log('\n  El constructor de formularios de entrenador');
  {
    // El formulario de entrenador NO cuelga de un campeonato: empezó ahí y se
    // sacó, porque el mismo mecanismo tiene que servir para las convocatorias de
    // acreditación, que no tienen campeonato ninguno.
    const r = await p.evaluate(() => {
      ST.eventoForm = null;
      ST.eventos = [{ id: 'oe', name: 'Nacional OE', status: 'open' }];
      ST.formEnt = []; ST.view = 'formEnt'; render();
      const vacio = document.body.innerText;
      feNuevo();
      return { vacio, editor: document.body.innerHTML,
               tipos: [...document.querySelectorAll('#fe_tipo option')].map(o => o.value) };
    });
    ok(/Todavía no hay ninguno/.test(r.vacio), 'sin formularios, explica para qué sirve cada tipo');
    ok(/acreditación/i.test(r.vacio), 'nombrando la acreditación, que es lo que motivó sacarlo del campeonato');
    ok(/Nuevo formulario de entrenador/.test(r.editor), 'se puede crear uno');
    ok(r.tipos.join() === 'campeonato,acreditacion', 'con los dos tipos');
  }
  {
    // De campeonato: pide elegir cuál. De acreditación: ese campo desaparece,
    // porque no hay campeonato al que pertenezca.
    const r = await p.evaluate(async () => {
      feCampo('tipo', 'campeonato');
      await new Promise(r => setTimeout(r, 50));
      const conCamp = !!document.getElementById('fe_evento');
      const textoCamp = document.body.innerText;
      feCampo('tipo', 'acreditacion');
      await new Promise(r => setTimeout(r, 50));
      return { conCamp, textoCamp, sinCamp: !!document.getElementById('fe_evento'),
               textoAcred: document.body.innerText };
    });
    ok(r.conCamp, 'el de campeonato pide de cuál es');
    ok(/elija a los atletas/i.test(r.textoCamp), 'y avisa que va a pedir atletas');
    ok(!r.sinCamp, 'el de acreditación no pide campeonato');
    ok(/No pide atletas/i.test(r.textoAcred), 'y avisa que no pide atletas');
  }
  {
    // Los documentos se editan acá, en el formulario, y no tocan nada del atleta.
    const r = await p.evaluate(async () => {
      feCampo('tipo', 'acreditacion');
      await new Promise(r => setTimeout(r, 60));
      efDocAgregar('e');
      await new Promise(r => setTimeout(r, 30));
      const inp = document.querySelector('#fe_docs input');
      inp.value = 'Currículum deportivo';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return { cuantos: window._efDocsE.length,
               enPantalla: [...document.querySelectorAll('#fe_docs input')].some(x => x.value === 'Currículum deportivo'),
               leido: efDocLeer('e') };
    });
    ok(r.cuantos === 1 && r.enPantalla, 'se agrega un documento y se dibuja en el formulario');
    ok(r.leido.length === 1 && r.leido[0].label === 'Currículum deportivo',
       'y lo que se guarda es lo que se escribió');
  }
  {
    // Y al abrir uno guardado, sus documentos salen de él, no del campeonato.
    const r = await p.evaluate(() => {
      ST.feForm = null;
      ST.formEnt = [{ id: 'f1', nombre: 'Quinta acreditación 2027', tipo: 'acreditacion',
        abierto: true, cierra: '2027-03-01',
        documentos: [{ key: 'cv', label: 'Currículum deportivo' }] }];
      ST.view = 'formEnt'; render();
      const lista = document.body.innerText;
      feEditar('f1');
      return { lista, docs: (window._efDocsE || []).map(d => d.label),
               nombre: document.getElementById('fe_nombre').value };
    });
    ok(/Quinta acreditación 2027/.test(r.lista), 'el formulario guardado sale en la lista');
    ok(/Abierto/.test(r.lista), 'con su estado');
    ok(r.nombre === 'Quinta acreditación 2027' && r.docs.join() === 'Currículum deportivo',
       'y al editarlo vuelven su nombre y sus documentos');
  }
  {
    // Un formulario con la fecha pasada se ve vencido aunque siga marcado abierto.
    const r = await p.evaluate(() => {
      ST.feForm = null;
      ST.formEnt = [{ id: 'f2', nombre: 'Ya pasó', tipo: 'acreditacion', abierto: true, cierra: '2020-01-01' }];
      render();
      return document.body.innerText;
    });
    ok(/Vencido/.test(r), 'la fecha pasada manda sobre el interruptor');
  }

  console.log('\n  La revisión de inscripciones de entrenadores');
  {
    const r = await p.evaluate(() => {
      ST.eventoForm = null;
      ST.eventos = [{ id: 'oe', name: 'Nacional OE' }];
      ST.formEnt = [{ id: 'f_oe', nombre: 'Entrenadores · Nacional OE', tipo: 'campeonato', evento: 'oe',
        documentos: [{ key: 'ant', label: 'Certificado de antecedentes' }] }];
      ST.entInsc = [
        { id: 'oe_111', evento: 'oe', formulario: 'f_oe', nombre: 'Marta Fuentes', rut: '11.111.111-1', club: 'Club Uno',
          acreditado: true, enBase: true, acreditadoHasta: '2027-05', status: 'pending',
          atletas: [{ rut: '1', nombre: 'Ana Soto' }, { rut: '2', nombre: 'Bruno Díaz' }] },
        { id: 'oe_222', evento: 'oe', nombre: 'Pedro Sin Base', rut: '22.222.222-2', club: '',
          acreditado: false, enBase: false, status: 'pending', atletas: [{ rut: '3', nombre: 'Carla Vera' }] },
        { id: 'oe_333', evento: 'oe', nombre: 'Ana Vencida', rut: '33.333.333-3',
          acreditado: false, enBase: true, status: 'approved', atletas: [{ rut: '4', nombre: 'Dani Paz' }] },
      ];
      ST.entInscPriv = { oe_111: { correo: 'marta@ejemplo.cl', telefono: '+56 9 1', docs: { e_ant: 'https://x/a.pdf' } } };
      ST.view = 'entInsc'; ST.entIns_q = ''; ST.entIns_evento = ''; ST.entIns_status = '';
      render();
      const t = document.body.innerText;
      return { t, html: document.body.innerHTML };
    });
    ok(/Marta Fuentes/.test(r.t) && /Pedro Sin Base/.test(r.t), 'salen las inscripciones que llegaron');
    ok(/Vigente/.test(r.t), 'la acreditación vigente se ve');
    ok(/No está en la base/.test(r.t), 'y el que no está en la base sale marcado — es lo que hay que revisar');
    ok(/Vencida/.test(r.t), 'igual que el que la tiene vencida');
    ok(/Ana Soto/.test(r.t) && /Bruno Díaz/.test(r.t), 'con los atletas que declaró cada uno');
    ok(/Certificado de antecedentes/.test(r.t) && /x\/a\.pdf/.test(r.html),
       'y sus documentos, con el nombre que les puso el formulario');
    ok(/marta@ejemplo\.cl/.test(r.t), 'el correo se ve acá, que es donde corresponde');
    ok(/2 por revisar/.test(r.t) && /2 sin acreditación vigente/.test(r.t),
       'y el resumen dice cuántos hay que mirar');
  }
  {
    const r = await p.evaluate(() => {
      entInscFiltro('status', 'approved');
      const soloAprob = document.body.innerText;
      entInscFiltro('status', '');
      entInscFiltro('q', 'pedro');
      const soloPedro = document.body.innerText;
      entInscFiltro('q', '');
      return { soloAprob, soloPedro };
    });
    ok(/Ana Vencida/.test(r.soloAprob) && !/Marta Fuentes/.test(r.soloAprob), 'el filtro por estado funciona');
    ok(/Pedro Sin Base/.test(r.soloPedro) && !/Marta Fuentes/.test(r.soloPedro), 'y el buscador también');
  }
  {
    // Sin ninguna inscripción, la pantalla explica dónde se abre el período en
    // vez de mostrar una tabla vacía.
    const t = await p.evaluate(() => { ST.entInsc = []; render(); return document.body.innerText; });
    ok(/Todavía no hay ninguna inscripción de entrenador/.test(t), 'lo dice');
    ok(/inscripcion_entrenador\.html/.test(t), 'y dice dónde está el formulario');
  }

  ok(!errs.length, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

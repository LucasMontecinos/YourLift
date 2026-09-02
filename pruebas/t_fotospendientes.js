// Las fotos que mandan los atletas al inscribirse, y cuándo el panel las muestra
// como pendientes de revisión.
//
// El 1 y el 2 de septiembre pasó esto: se confirmó una tanda de fotos en la
// noche, y a la mañana siguiente los mismos atletas seguían apareciendo como
// pendientes. Se volvieron a confirmar. Mirando los documentos en el servidor,
// las dos confirmaciones habían guardado EXACTAMENTE la misma foto: no se había
// perdido nada, la lista estaba mostrando datos viejos.
//
// De ahí salieron tres arreglos, y esta prueba mide los tres:
//
//   · Una foto rechazada dejaba al atleta fuera para siempre. Al rechazar se le
//     dice que puede mandar otra, pero la nueva no aparecía nunca. Ahora vuelve
//     a la lista si la foto que hay es distinta de la que se rechazó.
//   · La tarjeta y el botón de confirmar buscaban la foto cada uno por su lado y
//     desempataban al revés. Con dos inscripciones con foto se veía una y se
//     publicaba la otra. Ahora hay una sola forma de encontrarla.
//   · Firestore devuelve su copia guardada en el navegador sin avisar cuando no
//     alcanza el servidor. Ahora el panel lo dice y ofrece recargar.
//
// admin.html es un módulo y no expone nada por dentro, así que se le interceptan
// los módulos de Firebase y se mira la pantalla como la ve una persona.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_fotospendientes.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const mods = (cache) => ({
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `
    export const getAuth=()=>({currentUser:{uid:'u1',email:'x@y.cl'}});
    export const signInWithEmailAndPassword=async()=>({user:{uid:'u1'}});
    export const signOut=async()=>{}; export const createUserWithEmailAndPassword=async()=>({user:{uid:'u2'}});
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb({uid:'u1',email:'x@y.cl'}),0);return()=>{};};`,
  'firebase-firestore.js': `
    const snap=(d)=>({docs:d.map(x=>({id:x.id,data:()=>x,exists:()=>true})),forEach(f){this.docs.forEach(f)},
                      size:d.length,empty:!d.length,metadata:{fromCache:${cache ? 'true' : 'false'}}});
    const busca=q=>(globalThis.__FAKE&&globalThis.__FAKE[q&&(q.__n||(q.__q&&q.__q.__n))])||[];
    export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
    export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
    export const collection=(_d,n)=>({__n:n}); export const doc=(_d,n,i)=>({__n:n,__i:i});
    export const getDocs=async q=>snap(busca(q));
    export const getDoc=async r=>{const d=(busca(r)||[]).find(x=>x.id===r.__i);return{exists:()=>!!d,data:()=>d||{},id:r.__i};};
    export const setDoc=async(r,d)=>{(globalThis.__ESCRITO=globalThis.__ESCRITO||[]).push({col:r.__n,id:r.__i,data:d});};
    export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
    export const deleteField=()=>null; export const addDoc=async()=>({id:'x'});
    export const query=c=>({__q:c,__n:c&&c.__n}); export const where=()=>({}); export const orderBy=()=>({}); export const limit=()=>({});
    export const onSnapshot=(q,cb)=>{try{cb(snap(busca(q)))}catch(e){}return()=>{};};
    export const serverTimestamp=()=>0;
    export const writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});`,
  'firebase-storage.js': `
    export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>''; export const deleteObject=async()=>{}; export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}});`,
});

// El nombre del archivo lleva el instante de la subida en milisegundos, que es
// lo que usa el panel para desempatar. Trece dígitos, como los de verdad.
const T0 = 1787000000000;
const foto = ms => 'https://s/o/athlete_files%2Fx%2FcarnetPhoto_' + (T0 + ms) + '.webp?token=t' + ms;

async function abrir(b, FAKE, cache, padron) {
  const M = mods(cache);
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, serviceWorkers: 'block' });
  // El padrón se sirve como data.json, que es de donde lo saca el panel. Ponerlo
  // a mano después no sirve: la foto ya confirmada se pega sobre el atleta
  // mientras carga, y si el padrón llega después, esa parte ya pasó.
  await ctx.route('**/data.json', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(padron),
  }));
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(M).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: M[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(f => { window.__FAKE = f; }, FAKE);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 25000 });
  await p.waitForTimeout(2500);
  return { ctx, p, errs };
}

// Un padrón chico, escrito acá para que la prueba no dependa de data.json.
const PADRON = [
  { codigo: 'AAA-2025', nombre: 'Ana Aguirre Aros', rut: '11111111-1' },
  { codigo: 'BBB-2025', nombre: 'Bruno Bravo Barra', rut: '22222222-2' },
  { codigo: 'CCC-2025', nombre: 'Carla Cid Cortés', rut: '33333333-3' },
  { codigo: 'DDD-2025', nombre: 'Diego Díaz Durán', rut: '44444444-4' },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  // Ana: foto sin revisar.
  // Bruno: ya confirmada — no tiene que volver a aparecer.
  // Carla: rechazada, y sigue con LA MISMA foto — no aparece.
  // Diego: rechazada, pero mandó OTRA — tiene que volver.
  const FAKE = {
    admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }],
    atleta_fotos: [
      { id: 'BBB-2025', codigo: 'BBB-2025', rut: '22222222-2', foto_url: foto(1000), status: 'approved' },
      { id: 'CCC-2025', codigo: 'CCC-2025', rut: '33333333-3', status: 'rejected', rejected_url: foto(2000) },
      { id: 'DDD-2025', codigo: 'DDD-2025', rut: '44444444-4', status: 'rejected', rejected_url: foto(3000) },
    ],
    inscripciones_private: [
      { id: 'ev_111111111', rut: '11111111-1', carnetPhotoURL: foto(1111) },
      { id: 'ev_222222222', rut: '22222222-2', carnetPhotoURL: foto(1000) },
      { id: 'ev_333333333', rut: '33333333-3', carnetPhotoURL: foto(2000) },   // la misma que se rechazó
      { id: 'ev_444444444', rut: '44444444-4', carnetPhotoURL: foto(3500) },   // mandó otra
    ],
    inscripciones: [], atletas_pending: [], athlete_edits: [],
  };

  console.log('\nQuién aparece como pendiente de revisión');
  {
    const { ctx, p, errs } = await abrir(b, FAKE, false, PADRON);
    // El panel arranca de data.json; se le pone el padrón de la prueba y se
    // redibuja, que es lo mismo que hace al cambiar de pestaña.
    const r = await p.evaluate(() => {
      ST.view = 'fotos'; render();
      const t = document.body.innerText;
      const card = document.body.innerHTML;
      const m = t.match(/(\d+) atleta\(s\) con foto pendiente/);
      return {
        n: m ? +m[1] : 0,
        ana: /Ana Aguirre/.test(t), bruno: /Bruno Bravo/.test(t),
        carla: /Carla Cid/.test(t), diego: /Diego D[ií]az/.test(t),
        // La foto que muestra la tarjeta de Diego
        fotoDiego: (card.match(/carnetPhoto_(\d+)\.webp[^"]*"[^>]*>\s*<div[^>]*>\s*<div[^>]*>Diego/) || [])[1]
          || (card.match(/carnetPhoto_(\d+)/) || [])[1],
        avisoCache: /puede estar desactualizada/i.test(t),
      };
    });

    ok(r.ana, 'Ana, que mandó su foto y nadie la revisó, aparece');
    ok(!r.bruno, 'Bruno, ya confirmado, NO vuelve a aparecer');
    ok(!r.carla, 'Carla, rechazada y con la misma foto, no aparece');
    // Lo que estaba roto: al rechazar se le dice al atleta que mande otra, y la
    // otra no aparecía nunca.
    ok(r.diego, 'Diego, rechazado pero que mandó OTRA foto, vuelve a la lista');
    ok(r.n === 2, 'el contador dice 2, que son los que se ven: ' + r.n);
    ok(r.fotoDiego === String(T0 + 3500), 'y de Diego se muestra la foto NUEVA, no la rechazada');
    ok(!r.avisoCache, 'sin aviso de datos viejos cuando vinieron del servidor');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n  La tarjeta muestra la MISMA foto que se publica');
  {
    // Dos inscripciones con foto y las dos sin `ts`: antes una se quedaba con la
    // primera que encontraba y la otra con la última, así que se veía una foto y
    // se publicaba otra. El desempate ahora es el instante de la subida.
    const F2 = JSON.parse(JSON.stringify(FAKE));
    F2.inscripciones_private = [
      { id: 'evA_111111111', rut: '11111111-1', carnetPhotoURL: foto(1111) },
      { id: 'evB_111111111', rut: '11111111-1', carnetPhotoURL: foto(9999) },
    ];
    const { ctx, p, errs } = await abrir(b, F2, false, PADRON.slice(0,1));
    const r = await p.evaluate(() => {
      ST.view = 'fotos'; render();
      const mostrada = (document.body.innerHTML.match(/carnetPhoto_(\d+)/) || [])[1];
      // Confirmar y ver qué foto se guardó de verdad
      window.confirm = () => true;
      window._fotosState.bulkSel = { 'AAA-2025': true };
      return window.confirmarFotosBulk().then(() => ({
        mostrada,
        guardada: ((globalThis.__ESCRITO || []).find(e => e.col === 'atleta_fotos') || {}).data,
      }));
    });
    ok(r.mostrada === String(T0 + 9999), 'la tarjeta muestra la última que subió');
    const g = (r.guardada && r.guardada.foto_url || '').match(/carnetPhoto_(\d+)/);
    ok(g && g[1] === String(T0 + 9999), 'y al confirmar se publica ESA misma, no la otra');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n  Si los datos salieron de la copia del navegador, lo dice');
  {
    const { ctx, p, errs } = await abrir(b, FAKE, true, PADRON);
    const r = await p.evaluate(() => {
      ST.view = 'fotos'; render();
      return { aviso: /puede estar desactualizada/i.test(document.body.innerText),
               recargar: /Recargar/.test(document.body.innerText) };
    });
    // Esto es lo que hizo confirmar dos veces lo mismo: la lista mostraba lo de
    // la noche anterior y nada lo decía.
    ok(r.aviso, 'avisa que la lista puede estar desactualizada');
    ok(r.recargar, 'y ofrece recargar antes de confirmar de nuevo');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/function _fotosPendientes\(\)/.test(adm),
       'hay una sola respuesta a "quién tiene foto pendiente"');
    // Lo que no puede volver: cada pantalla armando su propio índice.
    ok(!/const photosByRut *= *\{\}/.test(adm),
       'y ya nadie arma su propio índice de fotos por RUT');
    ok((adm.match(/_fotosPendientes\(\)/g) || []).length >= 3,
       'la tarjeta, el contador y "seleccionar todas" preguntan lo mismo');
    ok(/status === 'rejected' && u === fotoDoc\.rejected_url/.test(adm),
       'una foto rechazada solo queda fuera si sigue siendo la misma');
    ok(/fotosSnap\.metadata\?\.fromCache/.test(adm),
       'y el panel sabe si las fotos vinieron de la copia del navegador');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

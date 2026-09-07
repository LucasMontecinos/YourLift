// Tarjetas de Nóminas (panel) — qué campeonatos aparecen.
//
// Tienen que ser los MISMOS que salen en la pestaña Nóminas de yourlift.cl: los
// de la colección `eventos` que no están archivados ni en borrador, más el
// Sudamericano (que vive en nomina_sudamericano.json).
//
// Antes la lista se armaba con nominas.json, un archivo estático con ocho
// eventos escritos adentro: tres campeonatos ya corridos y los cuatro ensayos.
// O sea, salían siempre los mismos —"cargados determinados algunos"— y los
// campeonatos con inscripciones abiertas o cerradas no aparecían nunca.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_tarjetasnomina.js
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

// Los eventos son los de verdad, tal como están hoy en Firestore: cuatro sin
// archivar (tres con inscripciones abiertas, uno cerrado) y varios archivados.
const EVENTOS = [
  { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026', status: 'open', date: '2026-11-21' },
  { id: 'regional_sur_austral_2026', name: 'Regional Sur Austral Noviembre 2026', status: 'open', date: '2026-11-08' },
  { id: 'ipfworld_master_2026', name: '2026 IPF World Masters Classic & Equipped Powerlifting Championships', status: 'open', date: '2026-10-15' },
  { id: 'World_Open_Equipped', name: 'World Open Equipped Powerlifting Championships', status: 'closed', date: '' },
  { id: 'regionalnorte', name: 'Campeonato Regional Norte 2026', status: 'archived', date: '2026-08-15' },
  { id: 'suda2026', name: 'Sudamericano 2026', status: 'archived', date: '' },
  { id: 'borrador1', name: 'Campeonato en borrador', status: 'draft', date: '2027-01-10' },
  { id: 'jornada1', name: 'Sudamericano 2026 — Día 1', status: 'open', parent: 'suda2026', date: '2026-09-20' },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(evs => {
    window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }], eventos: evs, nomina_cards: [] };
  }, EVENTOS);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo, null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(900);

  const r = await p.evaluate(async () => {
    ST.eventos = window.__FAKE.eventos.slice();
    ST.view = 'nomcards';
    await ncLoad();                       // baja nomina_cards + el nombre del Sudamericano
    render();
    const lista = _ncEventos();
    return {
      nombres: lista.map(x => x.name),
      ids: lista.map(x => x.id),
      texto: document.body.innerText,
      // El id de la tarjeta tiene que ser el slug del NOMBRE: así la busca el
      // sitio (_nsudaSlug(ev.name)). Con el id del evento no la encontraría.
      slugPorNombre: lista.some(x => x.id === 'regional-sur-austral-noviembre-2026'),
    };
  });

  ok(r.nombres.includes('Regional Sur Austral Noviembre 2026'), 'sale un campeonato con inscripciones abiertas');
  ok(r.nombres.includes('World Open Equipped Powerlifting Championships'), 'sale uno con inscripciones cerradas');
  ok(!r.nombres.includes('Campeonato Regional Norte 2026'), 'NO sale un archivado');
  ok(!r.nombres.includes('Campeonato en borrador'), 'NO sale un borrador');
  ok(!r.nombres.includes('Sudamericano 2026 — Día 1'), 'NO sale una jornada suelta');
  ok(r.ids.includes('suda2026'), 'sigue estando la tarjeta del Sudamericano');
  ok(r.slugPorNombre, 'el id de la tarjeta es el slug del nombre, no el del evento');
  ok(!r.nombres.some(n => /^ENSAYO/i.test(n)), 'no aparecen los ensayos de nominas.json');
  ok(/Inscripciones abiertas/.test(r.texto) && /Inscripciones cerradas/.test(r.texto), 'cada tarjeta dice en qué estado está');
  ok(!errs.length, 'sin errores de página' + (errs.length ? ' — ' + errs[0] : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

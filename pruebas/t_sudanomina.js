// Dejar las inscripciones del Sudamericano como la nómina final de FESUPO.
//
// Se inscribieron 103 chilenos y viajan 81. Hacerlo a mano son 103 clics, y basta
// equivocarse en uno para que alguien viaje sin estar aceptado —o al revés, que
// aparezca en la nómina alguien que se bajó—.
//
// El cruce tiene una trampa, y esta prueba existe sobre todo por ella: en la
// nómina de FESUPO los nombres vienen ACORTADOS y con los apellidos primero.
// "Sofía Monserrat Olave Vega" figura como "Olave Vega Sofia". Comparar nombres
// deja fuera a gente que sí viaja, así que el cruce va por RUT, que sale del
// código YourLift que la nómina ya trae para cada chileno.
//
// Se corre contra los datos de verdad: la nómina publicada y el padrón.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_sudanomina.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MODULOS = {
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `
    export const getAuth=()=>({currentUser:{uid:'u1',email:'x@y.cl'}});
    export const signInWithEmailAndPassword=async()=>({user:{uid:'u1'}});
    export const signOut=async()=>{}; export const createUserWithEmailAndPassword=async()=>({user:{uid:'u2'}});
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb({uid:'u1',email:'x@y.cl'}),0);return()=>{};};`,
  'firebase-firestore.js': `
    const snap=(d)=>({docs:d.map(x=>({id:x.id,data:()=>x,exists:()=>true})),forEach(f){this.docs.forEach(f)},
                      size:d.length,empty:!d.length,metadata:{fromCache:false}});
    const busca=q=>(globalThis.__FAKE&&globalThis.__FAKE[q&&(q.__n||(q.__q&&q.__q.__n))])||[];
    export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
    export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
    export const collection=(_d,n)=>({__n:n}); export const doc=(_d,n,i)=>({__n:n,__i:i});
    export const getDocs=async q=>snap(busca(q));
    export const getDoc=async r=>{const d=(busca(r)||[]).find(x=>x.id===r.__i);return{exists:()=>!!d,data:()=>d||{},id:r.__i};};
    export const setDoc=async()=>{};
    export const updateDoc=async(r,d)=>{(globalThis.__ESCRITO=globalThis.__ESCRITO||[]).push({col:r.__n,id:r.__i,data:d});};
    export const deleteDoc=async(r)=>{(globalThis.__BORRADO=globalThis.__BORRADO||[]).push({col:r.__n,id:r.__i});};
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

const rn = s => String(s || '').replace(/[^0-9kK]/g, '').toUpperCase();

(async () => {
  const nom = JSON.parse(fs.readFileSync(__dirname + '/../nomina_sudamericano.json', 'utf8'));
  const padron = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));
  const rutDeCod = {};
  padron.forEach(a => { if (a.codigo && a.rut) rutDeCod[a.codigo] = rn(a.rut); });

  // Los chilenos de la nómina: los que traen código YourLift.
  const enNomina = new Map();
  nom.atletas.forEach(a => { const r = a.cod && rutDeCod[a.cod]; if (r) enNomina.set(r, a); });

  console.log('\nLa nómina publicada identifica al equipo de Chile');
  {
    ok(enNomina.size > 70, enNomina.size + ' chilenos con RUT resuelto desde su código');
    // La razón de cruzar por RUT y no por nombre.
    const sofia = nom.atletas.find(a => /Olave Vega Sofia/i.test(a.n || ''));
    ok(!!sofia, 'FESUPO escribe los nombres acortados y al revés: "' + (sofia || {}).n + '"');
    const enPadron = padron.find(a => a.codigo === (sofia || {}).cod);
    ok(!!enPadron && /Sof[ií]a Monserrat Olave Vega/i.test(enPadron.nombre || ''),
       'y en el padrón es "' + ((enPadron || {}).nombre || '?') + '" — por eso el cruce va por RUT');
  }

  // Inscripciones de prueba: tres que viajan y dos que se bajaron.
  const viajan = [...enNomina.keys()].slice(0, 3);
  const bajas = padron.filter(a => a.rut && !enNomina.has(rn(a.rut))).slice(0, 2);
  const INS = [
    ...viajan.map((r, i) => ({ id: 'Sudamericano_2026_' + r, evento: 'Sudamericano_2026',
      nombre: 'Viaja ' + (i + 1), rut: r, status: 'pending' })),
    ...bajas.map((a, i) => ({ id: 'Sudamericano_2026_' + rn(a.rut), evento: 'Sudamericano_2026',
      nombre: 'Se bajó ' + (i + 1), rut: a.rut, status: 'pending' })),
    // De otro campeonato: no se puede tocar.
    { id: 'regionalnorte_1', evento: 'regionalnorte', nombre: 'Ajeno', rut: '11111111-1', status: 'pending' },
  ];

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(f => { window.__FAKE = f; }, {
    admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }],
    inscripciones: INS, inscripciones_private: [], atleta_fotos: [],
    atletas_pending: [], athlete_edits: [],
  });
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 25000 });
  await p.waitForTimeout(3000);

  console.log('\n  El botón aparece solo donde corresponde');
  {
    const r = await p.evaluate(() => {
      ST.view = 'approvals'; render();
      const conSuda = /SUDAMERICANO 2026 · \d+ INSCRIPCIONES/.test(document.body.innerText);
      // Sin inscripciones del Sudamericano no tiene que aparecer nada.
      const guardadas = ST.inscripciones;
      ST.inscripciones = guardadas.filter(i => i.evento !== 'Sudamericano_2026');
      render();
      const sinSuda = /SUDAMERICANO 2026 ·/.test(document.body.innerText);
      ST.inscripciones = guardadas; render();
      return { conSuda, sinSuda };
    });
    ok(r.conSuda, 'con inscripciones del Sudamericano, el botón está');
    ok(!r.sinSuda, 'y en un campeonato cualquiera no aparece');
  }

  console.log('\n  Aplica la nómina: acepta a los que van y rechaza a los que no');
  {
    const r = await p.evaluate(() => {
      window.confirm = () => true;
      globalThis.__ESCRITO = []; globalThis.__BORRADO = [];
      return window.sudaAplicarNomina().then(() => ({
        escrito: globalThis.__ESCRITO,
        borrado: globalThis.__BORRADO,
        estados: ST.inscripciones.map(i => [i.nombre, i.status]),
      }));
    });
    const est = Object.fromEntries(r.estados);
    ok(['Viaja 1', 'Viaja 2', 'Viaja 3'].every(n => est[n] === 'approved'),
       'los tres que están en la nómina quedan aceptados');
    ok(['Se bajó 1', 'Se bajó 2'].every(n => est[n] === 'rejected'),
       'y los dos que no están, rechazados');
    // Lo importante: nadie se borra. Rechazar se deshace, borrar no.
    ok(r.borrado.length === 0, 'no se borró ninguna inscripción');
    ok(est['Ajeno'] === 'pending', 'y la de otro campeonato no se tocó');
    ok(r.escrito.length === 5, 'cinco escrituras, una por inscripción cambiada: ' + r.escrito.length);
    ok(r.escrito.every(e => e.col === 'inscripciones'), 'todas sobre inscripciones');
  }

  console.log('\n  Correrlo dos veces no vuelve a escribir');
  {
    const r = await p.evaluate(() => {
      window.confirm = () => true;
      globalThis.__ESCRITO = [];
      return window.sudaAplicarNomina().then(() => globalThis.__ESCRITO.length);
    });
    // Ya está todo en su estado: no hay nada que cambiar y no se gastan escrituras.
    ok(r === 0, 'la segunda pasada no escribe nada (' + r + ')');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/const SUDA_EV='Sudamericano_2026'/.test(adm), 'el campeonato está nombrado una sola vez');
    ok(/porCod\[a\.cod\]/.test(adm), 'el cruce va por el código YourLift, no por nombre');
    ok(!/deleteDoc[^\n]*sudaAplicar/.test(adm) && /status:estado/.test(adm),
       'cambia el estado, no borra');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

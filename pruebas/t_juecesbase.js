// Cargar la planilla de jueces de FECHIPO a la base del panel.
//
// La base de jueces ya existía —Firestore `referees`, con su categoría, su
// ámbito y el color de corbata— pero se llenaba de a uno. Llegó la planilla con
// 51 jueces y hay que meterlos.
//
// El problema: la planilla NO trae RUT, y esta base se guarda POR RUT, porque es
// lo único que no cambia. El RUT hay que sacarlo del padrón, cruzando por nombre.
//
// Y ese cruce es justo el que ya nos falló una vez: los nombres de la planilla
// vienen cortos ("Felipe Romero") y el padrón los tiene completos ("Felipe
// Antonio Romero Díaz"), así que NINGUNO calza exacto y hay que buscar por
// palabras. Con los atletas, una regla parecida pegó a una peruana con la ficha
// de una chilena.
//
// Por eso la importación PROPONE y la persona confirma, y lo que esta prueba
// cuida es que no se guarde nada que no esté seguro:
//
//   · el que tiene una sola candidata en el padrón entra, con SU RUT;
//   · el que tiene dos o ninguna NO entra: se avisa para agregarlo a mano;
//   · se guarda el nombre completo del padrón, no el corto de la planilla;
//   · IPF es internacional y FECHIPO nacional — es la columna que distingue;
//   · y correrla dos veces no duplica a nadie.
//
// Lo público: en el perfil del atleta se ve SOLO la categoría del juez con su
// corbata. Nada de correo, teléfono ni club.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_juecesbase.js
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
    export const setDoc=async(r,d)=>{(globalThis.__ESCRITO=globalThis.__ESCRITO||[]).push({col:r.__n,id:r.__i,data:d});};
    export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
    export const deleteField=()=>null; export const addDoc=async()=>({id:'x'});
    export const query=c=>({__q:c,__n:c&&c.__n}); export const where=()=>({}); export const orderBy=()=>({}); export const limit=()=>({});
    export const onSnapshot=(q,cb)=>{try{cb(snap(busca(q)))}catch(e){}return()=>{};};
    export const serverTimestamp=()=>'TS';
    export const writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});`,
  'firebase-storage.js': `
    export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>''; export const deleteObject=async()=>{}; export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}});`,
};

const nrm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().split(/\s+/).filter(Boolean).join(' ');

(async () => {
  const base = JSON.parse(fs.readFileSync(__dirname + '/../jueces_base.json', 'utf8'));
  const padron = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));

  console.log('\nLa planilla está y no trae datos de contacto');
  {
    ok(base.jueces.length === 51, 'son ' + base.jueces.length + ' jueces');
    const crudo = fs.readFileSync(__dirname + '/../jueces_base.json', 'utf8');
    // Este archivo se publica en yourlift.cl: no puede llevar correo ni teléfono.
    ok(!/@/.test(crudo), 'sin correos');
    ok(!/\+?56\s?9/.test(crudo), 'sin teléfonos');
    ok((base.bajas || []).length === 2, 'con las dos bajas anotadas: '
       + (base.bajas || []).map(b => b.nombre).join(', '));
    const fuera = new Set((base.bajas || []).map(b => nrm(b.nombre)));
    ok(!base.jueces.some(j => fuera.has(nrm(j.nombre))), 'y ninguno de los dos quedó en la lista');
  }

  // Cuánta gente de la planilla se puede vincular sin dudar. Es la misma cuenta
  // que hace la importación, y sirve para saber qué esperar.
  const cuantos = (() => {
    let solo = 0, dudoso = 0;
    base.jueces.forEach(j => {
      const pal = nrm(j.nombre).split(' ');
      const c = padron.filter(a => pal.length >= 2 && pal.every(x => nrm(a.nombre).split(' ').includes(x)));
      if (c.length === 1) solo++; else dudoso++;
    });
    return { solo, dudoso };
  })();

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
  await p.addInitScript(() => {
    window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }], referees: [],
      inscripciones: [], inscripciones_private: [], atleta_fotos: [], atletas_pending: [],
      athlete_edits: [], eventos: [] };
  });
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 25000 });
  await p.waitForTimeout(3000);

  console.log('\n  El botón está en la sección Jueces');
  {
    const r = await p.evaluate(() => {
      ST.adminInfo = { role: 'owner', email: 'x@y.cl' };
      ST._refLoaded = true; ST.referees = [];
      ST.view = 'referees'; render();
      return [...document.querySelectorAll('button')].map(x => x.textContent.trim())
        .filter(t => /planilla|Agregar juez/i.test(t));
    });
    ok(r.some(t => /Importar planilla/i.test(t)), 'aparece "Importar planilla FECHIPO"');
    ok(r.some(t => /Agregar juez/i.test(t)), 'y sigue el de agregar a mano, para los que no calzan');
  }

  console.log('\n  Importa solo a los que se pueden vincular sin dudar');
  {
    const r = await p.evaluate(() => {
      window.confirm = () => true; window.alert = () => {};
      ST._refLoaded = true; ST.referees = [];
      globalThis.__ESCRITO = [];
      return window.refImportarBase().then(() => globalThis.__ESCRITO.filter(e => e.col === 'referees'));
    });
    ok(r.length === cuantos.solo,
       `entran los ${cuantos.solo} que tienen una sola candidata (${r.length} escritos)`);
    ok(r.length < base.jueces.length,
       `y los ${cuantos.dudoso} dudosos quedan fuera, no se adivina`);
    ok(r.every(e => e.id && /^[0-9]+[0-9kK]$/.test(e.id)),
       'cada uno se guarda bajo su RUT, que es lo que no cambia');
    ok(r.every(e => e.data.rut), 'y ninguno queda sin RUT');

    // El nombre corto de la planilla no sirve para nada más: se guarda el del padrón.
    const felipe = r.find(e => /Romero/i.test(e.data.nombre || ''));
    ok(!!felipe && felipe.data.nombre.split(' ').length > 2,
       'se guarda el nombre completo del padrón: ' + ((felipe || {}).data || {}).nombre);

    // Las dos columnas que definen la corbata.
    ok(r.every(e => e.data.ambito === 'nacional' || e.data.ambito === 'internacional'),
       'el ámbito sale de la certificación: IPF internacional, FECHIPO nacional');
    ok(r.every(e => e.data.categoria === '1' || e.data.categoria === '2'),
       'y la categoría queda en 1 o 2, que es lo que lee la insignia');
    ok(r.some(e => e.data.ambito === 'internacional'), 'entraron internacionales');
    ok(r.some(e => e.data.categoria === '1'), 'y entraron de Cat 1');
  }

  console.log('\n  Correrla dos veces no duplica a nadie');
  {
    const r = await p.evaluate(() => {
      // Ahora la base ya tiene a los importados.
      const prev = (globalThis.__ESCRITO || []).filter(e => e.col === 'referees')
        .map(e => ({ id: e.id, ...e.data }));
      ST._refLoaded = true; ST.referees = prev;
      window.confirm = () => true; window.alert = () => {};
      globalThis.__ESCRITO = [];
      return window.refImportarBase().then(() => globalThis.__ESCRITO.filter(e => e.col === 'referees').length);
    });
    ok(r === 0, 'la segunda vez no escribe nada (' + r + ')');
  }

  await ctx.close();
  await b.close();

  console.log('\n  En el perfil público se ve la categoría y nada más');
  {
    const at = fs.readFileSync(__dirname + '/../atleta.html', 'utf8');
    ok(/JUEZ NACIONAL CAT I{1,2}/.test(at) && /JUEZ INTERNACIONAL CAT I{1,2}/.test(at),
       'la insignia dice la categoría y el ámbito');
    // La corbata: es como se distinguen en la tarima.
    ok(/#9AA5B1/.test(at) && /#2B303B/.test(at) && /#1E5BA8/.test(at) && /#C41E3A/.test(at),
       'con el color de corbata de cada una');
    const i = at.indexOf('const _JUEZ=');
    const bloque = at.slice(i, at.indexOf('const entrenadorBadge', i));
    ok(!/correo|telefono|teléfono|mail/i.test(bloque),
       'y no se filtra ningún dato de contacto al público');
  }

  console.log('\n  Queda escrito en el código');
  {
    const ad = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/window\.refImportarBase=/.test(ad), 'la importación es su propia acción');
    const i = ad.indexOf('window.refImportarBase');
    const f = ad.slice(i, ad.indexOf('window.refDel', i));
    ok(/cand\.length===1/.test(f), 'solo entra el que tiene una sola candidata');
    ok(/if\(!confirm\(/.test(f), 'y no se aplica sola: se pregunta antes');
    ok(/→/.test(f), 'mostrando a quién se va a vincular cada uno');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

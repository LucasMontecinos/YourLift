// La ficha del atleta dice si además es entrenador, y de qué categoría.
//
// Setenta y seis de los ciento un entrenadores acreditados son además atletas.
// Su ficha era la de un competidor cualquiera: en ninguna parte decía que además
// entrena. Ahora lleva una insignia al lado del nombre, como los logros.
//
// Lo delicado es el cruce. Se hace por RUT y no por nombre, porque el nombre del
// entrenador está escrito a mano en su ficha y el del atleta viene de la
// inscripción: no coinciden en tildes ni en el orden de los apellidos. Y los dos
// RUT vienen con formatos distintos —con puntos, sin puntos, con guion— así que
// hay que normalizarlos antes de comparar.
//
// La categoría se guarda como 'Cat. 1' o 'Cat. 2' y se muestra en romanos, que es
// como se nombran: CAT I y CAT II.
//
// atleta.html es un módulo y no expone nada, así que no se puede espiar por
// dentro: se interceptan los módulos de Firebase, se le entregan los entrenadores
// y se mira la ficha como la ve una persona.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_entrenador.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MODULOS = {
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `
    export const getAuth=()=>({currentUser:null});
    export const signInWithEmailAndPassword=async()=>({user:{uid:'u1'}});
    export const signOut=async()=>{}; export const createUserWithEmailAndPassword=async()=>({user:{uid:'u2'}});
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(null),0);return()=>{};};`,
  'firebase-firestore.js': `
    const snap=(d)=>({docs:d.map(x=>({id:x.id||x.rut,data:()=>x,exists:()=>true})),forEach(f){this.docs.forEach(f)},size:d.length,empty:!d.length});
    const busca=q=>(globalThis.__FAKE&&globalThis.__FAKE[q&&(q.__n||(q.__q&&q.__q.__n))])||[];
    export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
    export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
    export const collection=(_d,n)=>({__n:n}); export const doc=(_d,n,i)=>({__n:n,__i:i});
    export const getDocs=async q=>snap(busca(q));
    export const getDoc=async r=>({exists:()=>false,data:()=>({}),id:r.__i});
    export const setDoc=async()=>{}; export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
    export const addDoc=async()=>({id:'x'}); export const deleteField=()=>null;
    export const query=c=>({__q:c,__n:c&&c.__n}); export const where=()=>({}); export const orderBy=()=>({}); export const limit=()=>({});
    export const onSnapshot=(q,cb)=>{try{cb(snap(busca(q)))}catch(e){}return()=>{};};
    export const serverTimestamp=()=>0; export const writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});`,
  'firebase-storage.js': `
    export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>''; export const deleteObject=async()=>{}; export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}});`,
};

const soloNum = r => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();

(async () => {
  const atletas = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));
  const entrenadores = JSON.parse(fs.readFileSync(__dirname + '/../entrenadores_db.json', 'utf8'));

  const porRut = {};
  entrenadores.forEach(e => { if (e.rut) porRut[soloNum(e.rut)] = e; });
  const cruzados = atletas.filter(a => a.rut && porRut[soloNum(a.rut)]);

  console.log('\nEl cruce por RUT encuentra a los que son las dos cosas');
  ok(cruzados.length > 50,
     cruzados.length + ' de los ' + entrenadores.length + ' entrenadores son además atletas');
  ok(cruzados.some(a => /1/.test(porRut[soloNum(a.rut)].categoria)), 'hay de categoría 1');
  ok(cruzados.some(a => /2/.test(porRut[soloNum(a.rut)].categoria)), 'y de categoría 2');

  const ej1 = cruzados.find(a => /1/.test(porRut[soloNum(a.rut)].categoria));
  const ej2 = cruzados.find(a => /2/.test(porRut[soloNum(a.rut)].categoria));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const ctx = await b.newContext({ viewport: { width: 900, height: 1100 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(e => { window.__FAKE = { entrenadores: e }; }, entrenadores);
  await p.goto(`http://localhost:${PUERTO}/atleta.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof showProfile === 'function', null, { timeout: 20000 });
  await p.waitForTimeout(4000);

  const ver = async cod => {
    await p.evaluate(c => showProfile(c), cod);
    await p.waitForTimeout(250);
    return await p.evaluate(() => document.getElementById('profileSection').innerText);
  };

  console.log('\n  La ficha lo dice, en romanos');
  {
    const t1 = await ver(ej1.codigo);
    ok(/ENTRENADOR CAT I(?!I)/.test(t1), ej1.nombre + ' → CAT I');
    const t2 = await ver(ej2.codigo);
    ok(/ENTRENADOR CAT II/.test(t2), ej2.nombre + ' → CAT II');
  }

  console.log('\n  Y a quien no es entrenador no le inventa nada');
  {
    const noEs = atletas.find(a => a.rut && !porRut[soloNum(a.rut)] && a.codigo);
    const t = await ver(noEs.codigo);
    ok(!/ENTRENADOR CAT/.test(t), noEs.nombre + ' no lleva insignia');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const at = fs.readFileSync(__dirname + '/../atleta.html', 'utf8');
    ok(/_aC\('atl_entren'/.test(at), 'los entrenadores se cachean, no se piden en cada ficha');
    ok(/porRut\[soloNum\(a\.rut\)\]/.test(at), 'el cruce es por RUT normalizado, no por nombre');
    ok(/const _catRomana=/.test(at), 'y la categoría se pasa a números romanos');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

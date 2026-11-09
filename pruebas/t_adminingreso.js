// Entrar al panel (yourlift.cl/admin) sin tener que recargar la página.
//
// Le pasaba al owner casi cada vez: apretaba INGRESAR, se quedaba pegado o
// volvía al formulario, y tenía que recargar. Eran tres cosas juntas:
//   · a los 5 s, si la pantalla decía "Cargando", una red de seguridad lo
//     devolvía al formulario — aunque estuviera bajando los datos de alguien
//     que YA había entrado;
//   · ahí apretar INGRESAR no hacía nada: Firebase ya tenía la sesión abierta y
//     no vuelve a avisar por la misma cuenta;
//   · y a los 12 s otro vigilante tapaba todo con "Error al cargar".
// Además la carga pedía ocho cosas a la base una detrás de otra.
//
// Firebase se reemplaza por uno falso, con la base lenta a propósito.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_adminingreso.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MODULOS = {
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `
    const A={currentUser:null};
    export const getAuth=()=>A;
    // Al entrar: si la cuenta ya tenía sesión (modo 'misma'), Firebase NO vuelve a avisar.
    export const signInWithEmailAndPassword=async()=>{const u={uid:'u1',email:'owner@x.cl'};A.currentUser=u;
      globalThis.__INGRESOS=(globalThis.__INGRESOS||0)+1;
      if(globalThis.__MODO!=='misma'&&globalThis.__CB)setTimeout(()=>globalThis.__CB(u),0);return{user:u};};
    export const signOut=async()=>{A.currentUser=null;};
    export const createUserWithEmailAndPassword=async()=>({user:{uid:'u2'}});
    export const onAuthStateChanged=(a,cb)=>{globalThis.__CB=cb;
      setTimeout(()=>cb(globalThis.__MODO==='conSesion'?(A.currentUser={uid:'u1',email:'owner@x.cl'}):null),30);return()=>{};};`,
  'firebase-firestore.js': `
    const snap=(d)=>({docs:d.map(x=>({id:x.id,data:()=>x,exists:()=>true})),forEach(f){this.docs.forEach(f)},size:d.length,empty:!d.length,metadata:{fromCache:false}});
    const busca=q=>(globalThis.__FAKE&&globalThis.__FAKE[q&&(q.__n||(q.__q&&q.__q.__n))])||[];
    const espera=n=>new Promise(r=>setTimeout(r,(globalThis.__LENTO||{})[n]||0));
    export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
    export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
    export const collection=(_d,n)=>({__n:n}); export const doc=(_d,n,i)=>({__n:n,__i:i});
    export const getDocs=async q=>{await espera(q.__n||(q.__q&&q.__q.__n));return snap(busca(q));};
    export const getDoc=async r=>{await espera(r.__n);const d=(busca(r)||[]).find(x=>x.id===r.__i);return{exists:()=>!!d,data:()=>d||{},id:r.__i};};
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

// La base lenta: cada una de estas tarda 2,4 s. Pedidas una tras otra serían
// más de 14 s; pedidas juntas, poco más de 2.
const LENTO = { atletas_pending: 2400, atletas_pending_priv: 2400, athlete_edits_priv: 2400, atleta_fotos: 2400, atleta_achievements: 2400, padron: 2400, privado: 2400 };

async function abrir(b, modo) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([m, l]) => {
    window.__MODO = m; window.__LENTO = l;
    window.__FAKE = { admins: [{ id: 'u1', role: 'owner', name: 'Owner' }] };
  }, [modo, LENTO]);
  const t0 = Date.now();
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  return { p, ctx, errs, t0 };
}
const estado = p => p.evaluate(() => {
  const t = document.body.innerText || '';
  return { formulario: !!document.getElementById('lPw'), panel: !!document.querySelector('.side'),
           error: /Error al cargar/.test(t), cargando: /Cargando/.test(t), ingresos: window.__INGRESOS || 0 };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nCon la sesión ya abierta y la base lenta');
  {
    const { p, ctx, errs, t0 } = await abrir(b, 'conSesion');
    await p.waitForTimeout(6200);
    const e6 = await estado(p);
    ok(!e6.formulario, 'a los 6 s NO lo devuelve al formulario mientras bajan los datos');
    await p.waitForFunction(() => !!document.querySelector('.side'), null, { timeout: 15000 }).catch(() => {});
    const ms = Date.now() - t0;
    const e = await estado(p);
    ok(e.panel, 'el panel se abre solo, sin recargar');
    ok(ms < 9000, 'y lo pedido a la base va junto: tarda ' + (ms / 1000).toFixed(1) + ' s (una tras otra serían más de 14)');
    await p.waitForTimeout(Math.max(0, 12600 - (Date.now() - t0)));
    ok(!(await estado(p)).error, 'a los 12 s tampoco aparece "Error al cargar"');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    await ctx.close();
  }

  console.log('\nApretar INGRESAR con una cuenta que Firebase ya tenía adentro');
  {
    const { p, ctx, errs } = await abrir(b, 'misma');
    await p.waitForFunction(() => !!document.getElementById('lPw'), null, { timeout: 15000 });
    await p.fill('#lEm', 'owner@x.cl'); await p.fill('#lPw', 'secreta');
    await p.click('button:has-text("INGRESAR")');
    await p.waitForFunction(() => !!document.querySelector('.side'), null, { timeout: 15000 }).catch(() => {});
    const e = await estado(p);
    ok(e.panel, 'entra igual, aunque Firebase no vuelva a avisar');
    ok(e.ingresos === 1, 'con un solo click');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    await ctx.close();
  }

  console.log('\nEntrar de la forma normal');
  {
    const { p, ctx, errs } = await abrir(b, 'normal');
    await p.waitForFunction(() => !!document.getElementById('lPw'), null, { timeout: 15000 });
    await p.fill('#lEm', 'owner@x.cl'); await p.fill('#lPw', 'secreta');
    await p.click('button:has-text("INGRESAR")');
    await p.waitForFunction(() => !!document.querySelector('.side'), null, { timeout: 15000 }).catch(() => {});
    ok((await estado(p)).panel, 'abre el panel');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    await ctx.close();
  }

  console.log('\nSin sesión, el formulario aparece igual');
  {
    const { p, ctx } = await abrir(b, 'normal');
    await p.waitForTimeout(1500);
    ok((await estado(p)).formulario, 'se ve el formulario de ingreso');
    await ctx.close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

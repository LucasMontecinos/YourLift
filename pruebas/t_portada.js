// Portada: el owner elige la foto y la mueve, por separado en computador y teléfono.
//
// En un computador ancho la foto tapaba la cara del atleta con el título, y cada
// ajuste pasaba por el código. Ahora el panel tiene "Portada": el owner mueve la
// foto viendo cómo queda en cada pantalla, o sube otra, y el sitio la aplica.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_portada.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
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


async function panel(b, admin, portada) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url(); const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([a, pt]) => { window.__FAKE = { admins: [a], site_backgrounds: pt ? [{ id: 'portada', ...pt }] : [] }; }, [admin, portada]);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(600);
  return { p, ctx, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nEl owner tiene la pantalla Portada; el resto de los admins no');
  {
    const { p, ctx, errs } = await panel(b, { id: 'u1', email: 'x@y.cl', role: 'owner' }, { pc: { x: 70, y: 10 }, movil: { x: 40, y: 60 } });
    ok(/PORTADA/.test(await p.evaluate(() => document.body.innerText)), 'el owner ve "Portada" en el menú');
    await p.evaluate(() => go('portada')); await p.waitForTimeout(700);
    const v = await p.evaluate(() => ({
      pc: document.getElementById('pt_img_pc') && document.getElementById('pt_img_pc').style.objectPosition,
      mv: document.getElementById('pt_img_movil') && document.getElementById('pt_img_movil').style.objectPosition,
      rangos: document.querySelectorAll('input[type=range]').length }));
    ok(v.pc === '70% 10%' && v.mv === '40% 60%', 'abre con el encuadre guardado: computador ' + v.pc + ', teléfono ' + v.mv);
    ok(v.rangos === 4, 'con controles horizontal y vertical para cada uno: ' + v.rangos);
    await p.evaluate(() => ptMover('pc', 'x', 55));
    ok(await p.evaluate(() => document.getElementById('pt_img_pc').style.objectPosition) === '55% 10%', 'al mover el control, la vista previa se mueve al tiro');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }
  {
    const { p, ctx } = await panel(b, { id: 'u1', email: 'x@y.cl', role: 'admin' });
    ok(!/PORTADA/.test(await p.evaluate(() => document.body.innerText)), 'un admin que no es owner no la ve');
    await ctx.close();
  }

  console.log('\nEl sitio aplica lo que eligió el owner');
  for (const [ancho, varX, esperado] of [[1440, '--hpc-x', '70%'], [390, '--hm-x', '40%']]) {
    const ctx = await b.newContext({ viewport: { width: ancho, height: 900 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelector('.yl-hero picture img'), null, { timeout: 15000 });
    const r = await p.evaluate(() => {
      window._BG_SETTINGS = { portada: { foto: 'portada/portada_movil.jpg', pc: { x: 70, y: 10 }, movil: { x: 40, y: 60 } } };
      _aplicarPortada();
      const img = document.querySelector('.yl-hero picture img');
      return { pos: getComputedStyle(img).objectPosition, src: img.getAttribute('src') };
    });
    ok(r.pos.startsWith(esperado), (ancho > 1000 ? 'computador' : 'teléfono') + ': la foto usa el encuadre del owner (' + r.pos + ')');
    ok(r.src === 'portada/portada_movil.jpg', (ancho > 1000 ? 'computador' : 'teléfono') + ': y la foto que subió');
    await ctx.close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

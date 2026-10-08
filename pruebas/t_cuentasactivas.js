// Activar y desactivar cuentas del panel desde Admin → Gestión Admin.
//
// Revocar borra la ficha de admins/ y no hay vuelta atrás desde el panel: para
// devolverle el acceso a alguien había que ir a Firestore con su UID, porque su
// correo ya tiene cuenta en Firebase y no se puede crear de nuevo. Desactivar
// deja la ficha con disabled:true; activarla la devuelve con su mismo rol.
//
// Se fija:
//  · el owner ve el estado de cada cuenta y un botón para cambiarlo, menos en
//    la suya (no puede dejarse afuera a sí mismo),
//  · desactivar y activar escriben disabled en la ficha y la lista lo muestra,
//  · una cuenta desactivada no entra al panel, y si lo tenía abierto se le cierra,
//  · el control en vivo y la inscripción manual tampoco la dejan pasar,
//  · las reglas de Firestore la dejan de tratar como admin o juez, y las cuentas
//    las maneja solo el owner. (Las reglas se probaron además en el emulador de
//    Firestore; acá se revisa que el archivo diga lo que tiene que decir.)
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cuentasactivas.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// La sesión es la de window.__UID. updateDoc cambia los datos de verdad, y los
// oyentes de un documento quedan guardados para poder dispararlos a mano.
const MODULOS = {
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `
    const yo=()=>({uid:globalThis.__UID,email:globalThis.__UID+'@y.cl'});
    export const getAuth=()=>({get currentUser(){return yo();}});
    export const signInWithEmailAndPassword=async()=>({user:yo()});
    export const signOut=async()=>{globalThis.__SALIO=(globalThis.__SALIO||0)+1;};
    export const createUserWithEmailAndPassword=async()=>({user:{uid:'nuevo'}});
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(yo()),0);return()=>{};};`,
  'firebase-firestore.js': `
    const G=globalThis;
    const snap=(d)=>({docs:d.map(x=>({id:x.id,data:()=>x,exists:()=>true})),forEach(f){this.docs.forEach(f)},size:d.length,empty:!d.length});
    const col=n=>((G.__FAKE=G.__FAKE||{})[n]=G.__FAKE[n]||[]);
    const busca=q=>col(q&&(q.__n||(q.__q&&q.__q.__n)));
    const snapDoc=r=>{const d=busca(r).find(x=>x.id===r.__i);return{exists:()=>!!d,data:()=>d||{},id:r.__i};};
    export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
    export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
    export const collection=(_d,n)=>({__n:n}); export const doc=(_d,n,i)=>({__n:n,__i:i});
    export const getDocs=async q=>snap(busca(q));
    export const getDoc=async r=>snapDoc(r);
    export const setDoc=async()=>{};
    export const updateDoc=async(r,d)=>{(G.__ESCRITO=G.__ESCRITO||[]).push({col:r.__n,id:r.__i,d});
      const x=busca(r).find(x=>x.id===r.__i); if(x)Object.assign(x,d);
      (G.__OYENTES||[]).filter(o=>o.r.__n===r.__n&&o.r.__i===r.__i).forEach(o=>o.cb(snapDoc(r)));};
    export const deleteDoc=async()=>{};
    export const deleteField=()=>null; export const addDoc=async()=>({id:'x'});
    export const query=c=>({__q:c,__n:c&&c.__n}); export const where=()=>({}); export const orderBy=()=>({}); export const limit=()=>({});
    export const onSnapshot=(q,cb)=>{
      if(q&&q.__i!==undefined){const o={r:q,cb};(G.__OYENTES=G.__OYENTES||[]).push(o);
        setTimeout(()=>{try{cb(snapDoc(q))}catch(e){}},0);
        return()=>{G.__OYENTES=(G.__OYENTES||[]).filter(x=>x!==o);};}
      try{cb(snap(busca(q)))}catch(e){}return()=>{};};
    export const serverTimestamp=()=>0;
    export const writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});`,
  'firebase-storage.js': `
    export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>''; export const deleteObject=async()=>{}; export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}});`,
};

const CUENTAS = () => ({
  admins: [
    { id: 'dueno', uid: 'dueno', email: 'dueno@y.cl', nombre: 'Owner', role: 'owner' },
    { id: 'ana', uid: 'ana', email: 'ana@y.cl', nombre: 'Ana Mesa', role: 'mesa' },
    { id: 'beto', uid: 'beto', email: 'beto@y.cl', nombre: 'Beto Off', role: 'admin', disabled: true },
  ],
  jueces: [{ id: 'juez1', uid: 'juez1', email: 'juez1@y.cl', nombre: 'Juez Uno', role: 'juez' }],
});

async function abrir(b, uid) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 950 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const alertas = [];
  p.on('dialog', d => { alertas.push(d.message()); d.accept().catch(() => {}); });
  await p.addInitScript(([uid, datos]) => { window.__UID = uid; window.__FAKE = datos; }, [uid, CUENTAS()]);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof ST !== 'undefined' && typeof window.toggleAdminActivo === 'function',
    null, { timeout: 25000 });
  await p.waitForTimeout(900);
  return { ctx, p, errs, alertas };
}

const LISTA = `(() => [...document.querySelectorAll('.adm-cuenta')].map(f => ({
  uid: f.getAttribute('data-uid'),
  off: f.classList.contains('adm-off'),
  dice: /DESACTIVADA/.test(f.textContent),
  boton: (f.querySelector('.adm-activar') || {}).textContent || null,
  tu: /\\(tú\\)/.test(f.textContent),
})))()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  // ── El owner ───────────────────────────────────────────────────
  {
    const { ctx, p, errs } = await abrir(b, 'dueno');
    await p.evaluate(async () => { go('admins'); await new Promise(r => setTimeout(r, 400)); });

    console.log('\nEl owner ve el estado de cada cuenta');
    {
      const f = await p.evaluate(LISTA);
      const de = u => f.find(x => x.uid === u) || {};
      ok(f.length === 4, 'las cuatro cuentas, admins y jueces (' + f.length + ')');
      ok(!de('ana').off && de('ana').boton === 'Desactivar', 'una activa ofrece "Desactivar"');
      ok(de('beto').off && de('beto').dice && de('beto').boton === 'Activar', 'una desactivada lo dice y ofrece "Activar"');
      ok(de('juez1').boton === 'Desactivar', 'los jueces también');
      ok(de('dueno').tu && !de('dueno').boton, 'la propia no tiene botón: el owner no se deja afuera');
      ok(/3 activas · 1 desactivadas/.test(await p.evaluate(() => document.body.innerText)), 'arriba dice cuántas hay de cada una');
    }

    console.log('\nDesactivar y activar');
    {
      await p.evaluate(async () => { window.__ESCRITO = []; await toggleAdminActivo('ana', 'admins', false); });
      await p.waitForTimeout(300);
      const r = await p.evaluate(`(async () => ({ w: window.__ESCRITO, f: ${LISTA} }))()`);
      const w = (r.w || []).find(x => x.id === 'ana') || {};
      ok(w.col === 'admins' && w.d && w.d.disabled === true, 'desactivar escribe disabled:true en su ficha');
      ok(w.d && w.d.disabledBy === 'dueno@y.cl', 'y anota quién lo hizo');
      ok((r.f.find(x => x.uid === 'ana') || {}).dice, 'la lista la muestra desactivada');

      await p.evaluate(async () => { window.__ESCRITO = []; await toggleAdminActivo('beto', 'admins', true); });
      await p.waitForTimeout(300);
      const r2 = await p.evaluate(`(async () => ({ w: window.__ESCRITO, f: ${LISTA} }))()`);
      const w2 = (r2.w || []).find(x => x.id === 'beto') || {};
      ok(w2.d && w2.d.disabled === false, 'activar escribe disabled:false');
      ok(!(r2.f.find(x => x.uid === 'beto') || {}).off, 'y vuelve a la lista como activa, con su rol de antes');

      await p.evaluate(async () => { window.__ESCRITO = []; await toggleAdminActivo('juez1', 'jueces', false); });
      const w3 = (await p.evaluate(() => window.__ESCRITO)).find(x => x.id === 'juez1') || {};
      ok(w3.col === 'jueces' && w3.d && w3.d.disabled === true, 'un juez se desactiva en su propia colección');

      await p.evaluate(async () => { window.__ESCRITO = []; await toggleAdminActivo('dueno', 'admins', false); });
      ok(!(await p.evaluate(() => window.__ESCRITO)).length, 'y la propia no se puede desactivar ni llamando la función');
    }
    ok(!errs.length, 'sin errores de página' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  // ── Una cuenta desactivada ─────────────────────────────────────
  console.log('\nUna cuenta desactivada no entra al panel');
  {
    const { ctx, p, alertas } = await abrir(b, 'beto');
    const r = await p.evaluate(() => ({ entro: !!ST.adminInfo, salio: window.__SALIO || 0 }));
    ok(!r.entro && r.salio > 0, 'se le cierra la sesión');
    ok(alertas.some(a => /desactivada/i.test(a)), 'y se le dice que está desactivada, no "acceso denegado"');
    await ctx.close();
  }

  console.log('\nSi la desactivan con el panel abierto, se le cierra');
  {
    const { ctx, p, alertas } = await abrir(b, 'ana');
    const antes = await p.evaluate(() => !!ST.adminInfo);
    ok(antes, 'entra mientras está activa');
    // El owner la desactiva desde otro computador: le llega el cambio a su ficha.
    await p.evaluate(async () => {
      const a = window.__FAKE.admins.find(x => x.id === 'ana'); a.disabled = true;
      (window.__OYENTES || []).filter(o => o.r.__n === 'admins' && o.r.__i === 'ana')
        .forEach(o => o.cb({ exists: () => true, data: () => a, id: 'ana' }));
      await new Promise(r => setTimeout(r, 200));
    });
    const r = await p.evaluate(() => ({ entro: !!ST.adminInfo, salio: window.__SALIO || 0 }));
    ok(!r.entro && r.salio > 0, 'queda afuera en el momento');
    ok(alertas.some(a => /desactivada/i.test(a)), 'con el aviso de que la desactivaron');
    await ctx.close();
  }

  // ── El resto de las puertas y las reglas ───────────────────────
  console.log('\nLas otras puertas y las reglas');
  {
    const raiz = __dirname + '/..';
    const lc = fs.readFileSync(raiz + '/livecast/sincronizacion.js', 'utf8');
    const ins = fs.readFileSync(raiz + '/inscripcion/datos.js', 'utf8');
    const rules = fs.readFileSync(raiz + '/reglas/firestore.rules', 'utf8');
    ok(/_desact=snap\.exists\(\)&&!!\(snap\.data\(\)\|\|\{\}\)\.disabled/.test(lc) && /if\(_desact\)\{\s*isAdmin=false/.test(lc),
       'el control en vivo trata a la cuenta desactivada como público');
    ok(/state\.adminAuth = adminDoc\.exists\(\) && !desactivada/.test(ins), 'la inscripción manual tampoco la deja pasar');
    const fn = n => (rules.match(new RegExp('function ' + n + '\\(\\) \\{[\\s\\S]*?\\n    \\}')) || [''])[0];
    ok(/admins\/\$\(request\.auth\.uid\)\)\.data\.get\('disabled', false\) != true/.test(fn('isAdmin')),
       'para las reglas, un admin desactivado no es admin');
    ok(/jueces\/\$\(request\.auth\.uid\)\)\.data\.get\('disabled', false\) != true/.test(fn('esJuez')),
       'ni un juez desactivado es juez');
    const adm = (rules.match(/match \/admins\/\{uid\} \{[\s\S]*?\n    \}/) || [''])[0];
    ok(/allow create, delete: if isOwner\(\);/.test(adm) && /allow update: if isOwner\(\) &&/.test(adm),
       'las cuentas del panel las maneja solo el owner');
    ok(/uid == request\.auth\.uid && request\.resource\.data\.get\('disabled', false\) == true/.test(adm),
       'y el owner no puede desactivarse a sí mismo');
    ok(/request\.auth\.uid == uid/.test(adm), 'cada uno puede leer su propia ficha, para saber que está desactivado');
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

// Firebase falso para las pruebas: se sirve en lugar del SDK de gstatic y anota
// cada lectura en window.__LEC ({op, col, filtros, n}).
//
//   window.__FAKE      datos por colección: { eventos: [{id, ...campos}], ... }
//   window.__FAKE_DOC  documento suelto por colección, para onSnapshot(doc)
//   window.__AUTH      usuario con sesión ({uid, email}); sin él, nadie entró
//
// Uso:
//   const { montarFirebase } = require('./apoyo/firebase_falso');
//   await montarFirebase(ctx, { demora: { 'firebase-firestore.js': 9000 } });
//
// `demora` retrasa la entrega de un módulo: así se simula el teléfono con mala
// señal, donde Firestore llega varios segundos después que la página.
const FIRESTORE = `
  const L=(x)=>{(globalThis.__LEC=globalThis.__LEC||[]).push(x);};
  const datos=c=>((globalThis.__FAKE||{})[c]||[]);
  const filtra=(docs,f)=>docs.filter(d=>f.every(w=>{
    const v=d[w.campo];
    if(w.op==='==')return v===w.val;
    if(w.op==='in')return w.val.indexOf(v)>=0;
    return true;
  }));
  const snapDe=(docs)=>({docs:docs.map(x=>({id:x.id,data:()=>x,exists:()=>true})),
    forEach(f){this.docs.forEach(f)},size:docs.length,empty:!docs.length,metadata:{fromCache:false}});
  export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
  export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
  export const memoryLocalCache=()=>({});
  export const collection=(_d,n)=>({__col:n,__f:[]});
  export const doc=(_d,n,i)=>({__col:n,__id:i});
  export const where=(campo,op,val)=>({campo,op,val});
  export const orderBy=()=>null; export const limit=()=>null;
  export const query=(c,...fs)=>({__col:c.__col,__f:(c.__f||[]).concat(fs.filter(Boolean))});
  export const getDocs=async q=>{const r=filtra(datos(q.__col),q.__f||[]);L({op:'getDocs',col:q.__col,filtros:q.__f||[],n:r.length});return snapDe(r);};
  export const getDoc=async r=>{const d=datos(r.__col).find(x=>x.id===r.__id);L({op:'getDoc',col:r.__col,n:1});
    return{exists:()=>!!d,data:()=>d||{},id:r.__id};};
  export const getCountFromServer=async q=>{const r=filtra(datos(q.__col),q.__f||[]);
    L({op:'count',col:q.__col,filtros:q.__f||[],n:Math.max(1,Math.ceil(r.length/1000))});return{data:()=>({count:r.length})};};
  export const onSnapshot=(q,cb)=>{
    // Soltar un oyente también queda anotado ({op:'suelta'}): así una prueba sabe
    // qué canales quedan escuchándose de verdad.
    if(q.__id!==undefined){const d=datos(q.__col).find(x=>x.id===q.__id)||(globalThis.__FAKE_DOC||{})[q.__col];
      L({op:'oyente',col:q.__col,id:q.__id,n:1});
      setTimeout(()=>{try{cb({exists:()=>!!d,data:()=>d||{},id:q.__id,metadata:{hasPendingWrites:false,fromCache:false}})}catch(e){}},0);
      return()=>L({op:'suelta',col:q.__col,id:q.__id,n:0});}
    const r=filtra(datos(q.__col),q.__f||[]);L({op:'oyente',col:q.__col,filtros:q.__f||[],n:r.length});
    setTimeout(()=>{try{cb(snapDe(r))}catch(e){}},0);return()=>L({op:'suelta',col:q.__col,n:0});};
  export const setDoc=async(r,d)=>{L({op:'escribe',col:r.__col,id:r.__id,n:0});}; export const updateDoc=async(r)=>{L({op:'escribe',col:r.__col,id:r.__id,n:0});};
  export const deleteDoc=async()=>{};
  export const addDoc=async()=>({id:'x'}); export const deleteField=()=>null;
  export const serverTimestamp=()=>0; export const increment=n=>n; export const arrayUnion=(...a)=>a;
  // Lo que se escribe dentro de una transacción o de un lote también se anota.
  const E=r=>L({op:'escribe',col:r.__col,id:r.__id,n:0});
  export const writeBatch=()=>({set(r){E(r);return this},update(r){E(r);return this},delete(){return this},commit:async()=>{}});
  export const runTransaction=async(_d,fn)=>fn({get:async r=>getDoc(r),set(r){E(r)},update(r){E(r)}});
  export const Timestamp={now:()=>({seconds:0})};`;

const MODULOS = {
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `
    export const getAuth=()=>({currentUser:globalThis.__AUTH||null});
    export const signInWithEmailAndPassword=async()=>({user:{uid:'u'}}); export const signOut=async()=>{};
    export const signInAnonymously=async()=>({user:{uid:'anon'}});
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(globalThis.__AUTH||null),0);return()=>{};};
    export const setPersistence=async()=>{}; export const browserLocalPersistence={};`,
  'firebase-firestore.js': FIRESTORE,
  'firebase-storage.js': `
    export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>''; export const deleteObject=async()=>{}; export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}});`,
};

// Corta todo lo que no sea el servidor local y sirve el Firebase falso.
async function montarFirebase(ctx, opciones) {
  const demora = (opciones && opciones.demora) || {};
  // Va primero: Playwright prueba las rutas de la última registrada a la primera.
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.route('**/firebasejs/**', async r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    if (!k) return r.abort();
    if (demora[k]) await new Promise(res => setTimeout(res, demora[k]));
    return r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }).catch(() => {});
  });
}

module.exports = { FIRESTORE, MODULOS, montarFirebase };

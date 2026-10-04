// Firestore falso COMPARTIDO entre varias pantallas, con la red en el medio.
//
// firebase_falso.js le da a cada pantalla su propio Firestore de mentira: sirve
// para ver qué lee y qué escribe una pantalla sola. Para probar la
// sincronización hace falta lo contrario: que lo que escribe Control en Vivo lo
// reciba el público, el segundo computador y la pantalla de tarima, con las
// demoras de una red de verdad. Este módulo arma eso.
//
//   const red = crearRed({ subida: 300, bajada: [100, 900] });
//   await red.montar(ctx, page, { nombre: 'mesa', auth: true, datos });
//
// · Los documentos viven en Node (red.docs). Las colecciones de solo lectura
//   (eventos, inscripciones…) salen de `datos`, como en firebase_falso.js.
// · Cada escritura llega al "servidor" `subida` ms después, en orden por
//   pantalla (Firestore no reordena lo que manda un mismo cliente).
// · Cada pantalla suscrita recibe cada cambio `bajada` ms después (fijo o al
//   azar entre dos valores), también en orden por pantalla.
// · Se puede cortar la red de una pantalla (red.cortar(nombre, true)): sus
//   escrituras esperan y no le llega nada hasta que vuelve.
// · runTransaction lee lo que tiene el servidor al momento de confirmar.
const { MODULOS } = require('./firebase_falso');

const FIRESTORE_RED = `
  const G=globalThis;
  G.__subs=G.__subs||{};
  const datos=c=>((G.__FAKE||{})[c]||[]);
  const ruta=r=>r.__col+'/'+r.__id;
  const filtra=(docs,f)=>docs.filter(d=>f.every(w=>{
    const v=d[w.campo];
    if(w.op==='==')return v===w.val;
    if(w.op==='in')return w.val.indexOf(v)>=0;
    return true;
  }));
  const snapCol=(docs)=>({docs:docs.map(x=>({id:x.id,data:()=>x,exists:()=>true})),
    forEach(f){this.docs.forEach(f)},size:docs.length,empty:!docs.length,metadata:{fromCache:false}});
  const snapDoc=(r,d)=>({exists:()=>d!=null,data:()=>d||{},id:r.__id,metadata:{hasPendingWrites:false,fromCache:false}});
  export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
  export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
  export const memoryLocalCache=()=>({});
  export const collection=(_d,n)=>({__col:n,__f:[]});
  export const doc=(_d,n,i)=>({__col:n,__id:i});
  export const where=(campo,op,val)=>({campo,op,val});
  export const orderBy=()=>null; export const limit=()=>null;
  export const query=(c,...fs)=>({__col:c.__col,__f:(c.__f||[]).concat(fs.filter(Boolean))});
  export const getDocs=async q=>snapCol(filtra(datos(q.__col),q.__f||[]));
  export const getCountFromServer=async q=>({data:()=>({count:filtra(datos(q.__col),q.__f||[]).length})});
  const leer=async r=>{const t=await G.__redGet(ruta(r)); if(t!=null)return JSON.parse(t);
    return datos(r.__col).find(x=>x.id===r.__id)||null;};
  export const getDoc=async r=>snapDoc(r,await leer(r));
  export const onSnapshot=(q,cb,err)=>{
    if(q.__id!==undefined){
      const id='s'+Math.random().toString(36).slice(2);
      G.__subs[id]=(t)=>{ const d=t==null?(datos(q.__col).find(x=>x.id===q.__id)||null):JSON.parse(t); try{cb(snapDoc(q,d))}catch(e){console.warn(e)} };
      G.__redSub(ruta(q),id);
      return()=>{ delete G.__subs[id]; G.__redUnsub(id); };
    }
    const r=filtra(datos(q.__col),q.__f||[]);
    setTimeout(()=>{try{cb(snapCol(r))}catch(e){}},0);return()=>{};
  };
  export const setDoc=async(r,d,o)=>G.__redSet(ruta(r),JSON.stringify(d),!!(o&&o.merge));
  export const updateDoc=async(r,d)=>G.__redSet(ruta(r),JSON.stringify(d),true);
  export const deleteDoc=async r=>G.__redSet(ruta(r),'null',false);
  export const addDoc=async()=>({id:'x'}); export const deleteField=()=>null;
  export const serverTimestamp=()=>Date.now(); export const increment=n=>n; export const arrayUnion=(...a)=>a;
  export const writeBatch=()=>{const w=[];return{set(r,d,o){w.push([r,d,o]);return this},update(r,d){w.push([r,d,{merge:true}]);return this},
    delete(){return this},commit:async()=>{for(const [r,d,o] of w)await setDoc(r,d,o);}};};
  // Como Firestore: si lo que se leyó cambió antes de confirmar, la transacción
  // se vuelve a correr con lo nuevo.
  export const runTransaction=async(_d,fn)=>{
    for(let i=0;i<8;i++){
      const w=[], vers={};
      const res=await fn({get:async r=>{const [t,v]=await G.__redGetV(ruta(r)); vers[ruta(r)]=v;
          return snapDoc(r,t!=null?JSON.parse(t):(datos(r.__col).find(x=>x.id===r.__id)||null));},
        set(r,d,o){w.push([r,d,o])},update(r,d){w.push([r,d,{merge:true}])}});
      const okc=await G.__redCommit(JSON.stringify(w.map(([r,d,o])=>[ruta(r),JSON.stringify(d),!!(o&&o.merge)])),JSON.stringify(vers));
      if(okc)return res;
    }
    throw new Error('transacción: demasiados reintentos');
  };
  export const Timestamp={now:()=>({seconds:Math.floor(Date.now()/1000)})};`;

function crearRed(op) {
  op = Object.assign({ subida: 200, bajada: [80, 600] }, op || {});
  const docs = {};                 // ruta → JSON (texto) en el "servidor"
  const vers = {};                 // ruta → número de versión
  const subs = {};                 // id → {pantalla, ruta}
  const pantallas = {};            // nombre → {page, colaSubida, colasBajada, cortada}
  const log = [];
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const demora = v => Array.isArray(v) ? v[0] + Math.random() * (v[1] - v[0]) : v;

  function poner(ruta, d, merge) {
    if (d === null) delete docs[ruta];
    else if (merge && docs[ruta]) docs[ruta] = JSON.stringify(Object.assign(JSON.parse(docs[ruta]), d));
    else docs[ruta] = JSON.stringify(d);
    vers[ruta] = (vers[ruta] || 0) + 1;
  }
  function avisar(ruta) {
    const t = docs[ruta] === undefined ? null : docs[ruta];
    for (const [id, s] of Object.entries(subs)) {
      if (s.ruta !== ruta) continue;
      const P = pantallas[s.pantalla];
      const ms = demora(P.bajada != null ? P.bajada : op.bajada);
      // En orden por pantalla: cada entrega espera a la anterior.
      P.colaBajada = P.colaBajada.then(async () => {
        await espera(ms);
        while (P.cortada) await espera(50);
        if (!subs[id]) return;
        await P.page.evaluate(([i, txt]) => { const f = window.__subs && window.__subs[i]; if (f) f(txt); }, [id, t]).catch(() => {});
      });
    }
  }

  async function montar(ctx, page, o) {
    const nombre = o.nombre;
    const P = pantallas[nombre] = { page, colaSubida: Promise.resolve(), colaBajada: Promise.resolve(), cortada: false,
      subida: o.subida, bajada: o.bajada };
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route('**/firebasejs/**', async r => {
      const u = r.request().url();
      if (u.endsWith('firebase-firestore.js')) return r.fulfill({ status: 200, contentType: 'text/javascript', body: FIRESTORE_RED }).catch(() => {});
      const k = Object.keys(MODULOS).find(k => u.endsWith(k));
      if (!k) return r.abort();
      return r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }).catch(() => {});
    });
    await page.exposeFunction('__redGet', async ruta => { while (P.cortada) await espera(50); return docs[ruta] === undefined ? null : docs[ruta]; });
    await page.exposeFunction('__redSub', (ruta, id) => {
      subs[id] = { pantalla: nombre, ruta };
      // Como Firestore: al suscribirse llega enseguida lo que hay.
      const t = docs[ruta] === undefined ? null : docs[ruta];
      P.colaBajada = P.colaBajada.then(async () => {
        await espera(demora(P.bajada != null ? P.bajada : op.bajada));
        await page.evaluate(([i, txt]) => { const f = window.__subs && window.__subs[i]; if (f) f(txt); }, [id, t]).catch(() => {});
      });
    });
    await page.exposeFunction('__redUnsub', id => { delete subs[id]; });
    await page.exposeFunction('__redSet', (ruta, txt, merge) => {
      const ms = demora(P.subida != null ? P.subida : op.subida);
      const hecho = P.colaSubida.then(async () => {
        await espera(ms);
        while (P.cortada) await espera(50);
        const d = JSON.parse(txt);
        poner(ruta, d, merge);
        log.push({ t: Date.now(), quien: nombre, ruta, doc: docs[ruta] });
        avisar(ruta);
      });
      P.colaSubida = hecho.catch(() => {});
      return hecho;
    });
    await page.exposeFunction('__redGetV', async ruta => { while (P.cortada) await espera(50); return [docs[ruta] === undefined ? null : docs[ruta], vers[ruta] || 0]; });
    await page.exposeFunction('__redCommit', (escrituras, leidas) => {
      const ms = demora(P.subida != null ? P.subida : op.subida);
      const hecho = P.colaSubida.then(async () => {
        await espera(ms);
        while (P.cortada) await espera(50);
        const lv = JSON.parse(leidas);
        if (Object.keys(lv).some(r => (vers[r] || 0) !== lv[r])) return false;   // cambió: reintentar
        for (const [ruta, txt, merge] of JSON.parse(escrituras)) { poner(ruta, JSON.parse(txt), merge); avisar(ruta); log.push({ t: Date.now(), quien: nombre, ruta, tx: true, doc: docs[ruta] }); }
        return true;
      });
      P.colaSubida = hecho.catch(() => {});
      return hecho;
    });
    await page.addInitScript(([d, auth]) => { window.__FAKE = d; if (auth) window.__AUTH = { uid: 'u', email: 'a@b.cl' }; },
      [o.datos || {}, !!o.auth]);
  }

  return {
    docs, log, montar,
    sembrar(ruta, obj) { docs[ruta] = JSON.stringify(obj); },
    leer(ruta) { return docs[ruta] ? JSON.parse(docs[ruta]) : null; },
    escribir(ruta, obj, merge) {           // escribe "otro" (por ejemplo el jurado desde su teléfono)
      poner(ruta, obj, merge);
      avisar(ruta);
    },
    cortar(nombre, si) { pantallas[nombre].cortada = !!si; },
    // Espera a que no quede nada viajando.
    async calma(ms) { await espera(ms || 0); for (const P of Object.values(pantallas)) { await P.colaSubida; await P.colaBajada; } },
  };
}

module.exports = { crearRed, FIRESTORE_RED };

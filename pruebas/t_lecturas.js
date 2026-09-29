// Cuánto le cuesta a Firestore que alguien abra una pantalla.
//
// El lunes después del Sudamericano la base pasó las 700 mil lecturas en un día
// (la cuota gratis es de 50 mil). No era un error puntual: cada apertura del
// livecast —cada espectador, cada televisor, cada widget de OBS— leía unas
// 2.500 cosas que casi nunca mostraba:
//
//   · las ~500 fotos de atleta_fotos, DOS veces (dos oyentes sobre la misma
//     colección), aunque la pantalla no mostrara ninguna foto;
//   · las 544 fotos de la nómina del Sudamericano, también en un nacional;
//   · todas las inscripciones de cada campeonato activo, solo para escribir
//     "N atletas" en la lista de elección, y de nuevo con cada cambio en
//     cualquier campeonato;
//   · y cada pantalla de tarima, las 712 inscripciones enteras para sacar años
//     de nacimiento que la nómina ya traía.
//
// Y en el sitio, la pestaña Nóminas volvía a bajar la colección entera de
// inscripciones cada tres minutos mientras alguien la tuviera abierta.
//
// Acá se abre cada pantalla con un Firestore falso que anota qué se le pide, y
// se verifica que lo caro no vuelva.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_lecturas.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// ── Firestore falso ───────────────────────────────────────────────────────
// Cada lectura queda en globalThis.__LEC: {op, col, filtros, n}. Los datos salen
// de globalThis.__FAKE[col] (lista de documentos con id).
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
    if(q.__id!==undefined){const d=datos(q.__col).find(x=>x.id===q.__id)||(globalThis.__FAKE_DOC||{})[q.__col];
      L({op:'oyente',col:q.__col,n:1});
      setTimeout(()=>{try{cb({exists:()=>!!d,data:()=>d||{},id:q.__id,metadata:{hasPendingWrites:false,fromCache:false}})}catch(e){}},0);
      return()=>{};}
    const r=filtra(datos(q.__col),q.__f||[]);L({op:'oyente',col:q.__col,filtros:q.__f||[],n:r.length});
    setTimeout(()=>{try{cb(snapDe(r))}catch(e){}},0);return()=>{};};
  export const setDoc=async()=>{}; export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
  export const addDoc=async()=>({id:'x'}); export const deleteField=()=>null;
  export const serverTimestamp=()=>0; export const increment=n=>n; export const arrayUnion=(...a)=>a;
  export const writeBatch=()=>({set(){return this},update(){return this},delete(){return this},commit:async()=>{}});
  export const runTransaction=async(_d,fn)=>fn({get:async r=>getDoc(r),set(){},update(){}});
  export const Timestamp={now:()=>({seconds:0})};`;
const MODULOS = {
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `
    export const getAuth=()=>({currentUser:null});
    export const signInWithEmailAndPassword=async()=>({user:{uid:'u'}}); export const signOut=async()=>{};
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(null),0);return()=>{};};
    export const setPersistence=async()=>{}; export const browserLocalPersistence={};`,
  'firebase-firestore.js': FIRESTORE,
  'firebase-storage.js': `
    export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>''; export const deleteObject=async()=>{}; export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}});`,
};

// Una base de juguete del tamaño de la real: 712 inscripciones, ~500 fotos.
function base() {
  const ev = [
    { id: 'regional_centro_2026', name: 'Primavera Open', status: 'open' },
    { id: 'regional_sur_austral_2026', name: 'Regional Sur Austral', status: 'open' },
    { id: 'Sudamericano_2026', name: 'Sudamericano', status: 'archived' },
    { id: 'regionalnorte', name: 'Regional Norte', status: 'archived' },
  ];
  const insc = [];
  for (let i = 0; i < 712; i++) {
    const e = i < 120 ? ev[0] : i < 180 ? ev[1] : i < 600 ? ev[2] : ev[3];
    insc.push({ id: 'i' + i, evento: e.id, status: 'approved', nombre: 'Atleta ' + i,
      rut: String(10000000 + i) + '-1', fechaNac: '1995-01-01', categoria: '-83 kg', division: 'Open', sexo: 'Hombre' });
  }
  const fotos = []; for (let i = 0; i < 494; i++) fotos.push({ id: 'f' + i, rut: String(10000000 + i) + '-1', foto_url: 'x.jpg' });
  const suda = []; for (let i = 0; i < 544; i++) suda.push({ id: 's' + i, foto_url: 'y.jpg' });
  return { eventos: ev, inscripciones: insc, atleta_fotos: fotos, nomina_suda_fotos: suda,
           athlete_edits: [], clubs: [], site_backgrounds: [] };
}

async function abrir(b, url, prep) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
  // Lo que está fuera del servidor local no se alcanza desde acá: se corta rápido.
  // (Va primero: Playwright prueba las rutas de la última registrada a la primera.)
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([d, extra]) => { window.__FAKE = d; window.__FAKE_DOC = extra || {}; window.__LEC = [];
    try { localStorage.clear(); } catch (e) {} }, [base(), prep || null]);
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  return { p, ctx, errs };
}
const lecturas = (p) => p.evaluate(() => globalThis.__LEC || []);
const suma = (l, f) => l.filter(f).reduce((n, x) => n + x.n, 0);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  console.log('\nUn espectador abre el livecast');
  {
    const { p, ctx, errs } = await abrir(b, `http://localhost:${PUERTO}/livecast.html`);
    await p.waitForFunction(() => typeof fbReady !== 'undefined' && fbReady, null, { timeout: 20000 });
    await p.waitForTimeout(2500);
    const l = await lecturas(p);
    ok(suma(l, x => x.col === 'atleta_fotos') === 0, 'no lee las fotos de los atletas (no las muestra)');
    ok(suma(l, x => x.col === 'nomina_suda_fotos') === 0, 'ni las fotos del Sudamericano');
    ok(!l.some(x => x.col === 'inscripciones' && x.op !== 'count'),
       'no baja inscripciones: para la lista de elección solo pide el número');
    const cuenta = l.filter(x => x.col === 'inscripciones' && x.op === 'count');
    ok(cuenta.length >= 1 && suma(l, x => x.op === 'count') <= cuenta.length,
       'y cada conteo cuesta una lectura (' + cuenta.length + ' campeonatos activos)');
    const total = suma(l, () => true);
    ok(total < 120, 'en total, ' + total + ' lecturas (antes, unas 2.500)');
    // Recargar dentro de los diez minutos no vuelve a contar.
    await p.evaluate(() => { globalThis.__LEC = []; });
    await p.evaluate(() => { const fb = window._fb; _contarAtletasEventos(fb, Object.keys(window.LIVE_EVENT_META || {})); });
    await p.waitForTimeout(400);
    ok(!(await lecturas(p)).some(x => x.op === 'count'), 'el número queda guardado diez minutos en el equipo');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  console.log('\n  Un cambio en cualquier campeonato ya no dispara la recuenta');
  {
    const { p, ctx } = await abrir(b, `http://localhost:${PUERTO}/livecast.html?tx=scoreboard&evento=regional_centro_2026`);
    await p.waitForFunction(() => typeof fbReady !== 'undefined' && fbReady, null, { timeout: 20000 });
    await p.waitForTimeout(2000);
    const l = await lecturas(p);
    ok(!l.some(x => x.col === 'inscripciones'), 'un widget de OBS no cuenta atletas: nunca muestra la lista');
    ok(suma(l, x => x.col === 'atleta_fotos') === 0, 'el marcador no pide fotos');
    await ctx.close();
  }

  console.log('\nLas pantallas que sí muestran fotos, las piden una sola vez');
  {
    const { p, ctx, errs } = await abrir(b, `http://localhost:${PUERTO}/livecast.html`);
    await p.waitForFunction(() => typeof fbReady !== 'undefined' && fbReady, null, { timeout: 20000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { globalThis.__LEC = []; _pedirFotos(); _pedirFotos(); });
    await p.waitForTimeout(600);
    const l = await lecturas(p);
    ok(l.filter(x => x.col === 'atleta_fotos').length === 1, 'un solo oyente sobre atleta_fotos (antes, dos)');
    ok(suma(l, x => x.col === 'nomina_suda_fotos') === 0, 'en un campeonato de un país no se bajan las del Sudamericano');
    const conFotos = await p.evaluate(() => Object.keys(window._ADMIN_FOTOS_BY_RUT || {}).length);
    ok(conFotos > 400, 'y las fotos llegan igual al panel (' + conFotos + ')');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  console.log('\nLa tabla de jornada no baja todas las inscripciones');
  {
    const { p, ctx, errs } = await abrir(b, `http://localhost:${PUERTO}/livecast.html?tx=screen`);
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function' && fbReady, null, { timeout: 20000 });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => {
      const n9 = () => ({ sq: [{ w: 100, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
      DATA.event = { id: 'regional_centro_2026', name: 'Primavera Open' };
      DATA.athletes = [1, 2, 3].map(i => ({ id: i, lot: 100 + i, name: 'Atleta ' + i, rut: String(10000000 + i) + '-1', born: '1990',
        flight: 'A', sex: 'Hombre', cat: '83', div: 'Open', mod: 'classic', bw: 82, club: 'X', country: 'CHI', bombed: false, att: n9() }));
      DATA.lift = 'sq'; DATA.round = 0; DATA.flight = 'A'; DATA.phase = 'compete';
      globalThis.__LEC = [];
      window._SCREEN_STATE = { mode: 'jornada', flights: ['A'], fondo: 'yourlift' };
      renderTxWidget();
      return /\b90\b/.test(document.body.innerText);
    });
    await p.waitForTimeout(500);
    let l = await lecturas(p);
    ok(r, 'el año sale de la nómina (90)');
    ok(!l.some(x => x.col === 'inscripciones'), 'sin tocar inscripciones');
    // Si a uno le falta el año, se va a buscar una vez, y queda guardado.
    await p.evaluate(() => { DATA.athletes[0].born = ''; globalThis.__LEC = []; renderTxWidget(); renderTxWidget(); });
    await p.waitForTimeout(600);
    l = await lecturas(p);
    ok(l.filter(x => x.col === 'inscripciones').length === 1, 'si a alguno le falta, se busca una sola vez');
    const guardado = await p.evaluate(() => { try { return !!JSON.parse(localStorage.getItem('yl_nac_rut')).m; } catch (e) { return false; } });
    ok(guardado, 'y queda guardado en el equipo para la próxima recarga');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  console.log('\nLa pestaña Nóminas del sitio');
  {
    const { p, ctx, errs } = await abrir(b, `http://localhost:${PUERTO}/index.html`);
    await p.waitForFunction(() => typeof fbReady !== 'undefined' && fbReady, null, { timeout: 20000 });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { globalThis.__LEC = []; ST.v = 'nominas'; cargarParaVista('nominas'); });
    await p.waitForTimeout(5500);
    const l = await lecturas(p);
    const insc = l.filter(x => x.col === 'inscripciones');
    ok(insc.length >= 1 && insc.every(x => x.op === 'oyente'), 'las inscripciones llegan por un oyente, no releyendo cada 3 minutos');
    ok(insc.every(x => (x.filtros || []).some(f => f.op === 'in')), 'filtradas por los campeonatos que la pestaña muestra');
    const n = suma(insc, () => true);
    ok(n === 180, 'lee ' + n + ' inscripciones de las 712 (las de campeonatos archivados no se muestran)');
    const tarjetas = await p.evaluate(() => (NM.events || []).map(e => e.id + ':' + (e.athletes || []).length).join(' '));
    ok(/regional_centro_2026:120/.test(tarjetas) && /regional_sur_austral_2026:60/.test(tarjetas),
       'y las tarjetas muestran a todos sus inscritos: ' + tarjetas);
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

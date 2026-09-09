// Auto-distribuir tandas, medido contra los cronogramas que YA se corrieron.
//
// Las tres listas de abajo son los atletas reales del Regional Centro Sur, el
// Regional Norte y el Regional Sur Austral —sexo, categoría, división y
// modalidad, que es lo único que el repartidor mira—. Los dos primeros los armó
// la comisión técnica a mano y se corrieron así; sirven de patrón.
//
// Lo que se fija acá:
//
//   · Ninguna tanda bajo 8 ni sobre 14 de powerlifting.
//   · Una categoría + división NUNCA se parte entre dos tandas. Es lo que hubo
//     que deshacer a mano en el Regional Norte: parte una misma premiación.
//   · El only bench no ocupa cupo del 14 (sube a tarima solo en banca).
//   · Hombres y mujeres van separados, SALVO la tanda de apertura y solo cuando
//     no hay otra forma. Con quince mujeres no hay reparto legal —15 se pasa,
//     8+7 deja una corta— y la comisión técnica lo resolvió en el Norte metiendo
//     los hombres de las categorías más livianas en la tanda de las mujeres.
//     Pasó con quince en el Norte y otra vez en el Sur Austral.
//   · Y esa mezcla NO se usa cuando no hace falta: en el Centro Sur las mujeres
//     son doce y entran solas.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cronotandas.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  \u2713 ' : '  \u2717 ') + m); if (!c) fallas++; };

const PADRON = {
  centrosur: [
    ["H", "-105 kg", "Junior", "Powerlifting Classic Special Olympics", 1],
    ["H", "-105 kg", "Open", "Powerlifting Classic", 1],
    ["H", "-105 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-120 kg", "Master I", "Powerlifting Classic", 1],
    ["H", "-120 kg", "Open", "Powerlifting Classic", 2],
    ["H", "-120 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-120 kg", "Open", "Powerlifting Classic Special Olympics", 1],
    ["H", "-120 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["H", "-66 kg", "Junior", "Only Bench Classic", 1],
    ["H", "-66 kg", "Junior", "Powerlifting Classic", 3],
    ["H", "-66 kg", "Open", "Powerlifting Classic", 3],
    ["H", "-66 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-66 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["H", "-74 kg", "Junior", "Powerlifting Classic", 5],
    ["H", "-74 kg", "Open", "Powerlifting Classic", 4],
    ["H", "-74 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-74 kg", "Sub-Junior", "Powerlifting Classic", 3],
    ["H", "-83 kg", "Junior", "Powerlifting Classic", 8],
    ["H", "-83 kg", "Open", "Powerlifting Classic", 2],
    ["H", "-83 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-83 kg", "Sub-Junior", "Powerlifting Classic", 2],
    ["H", "-93 kg", "Junior", "Powerlifting Classic", 3],
    ["H", "-93 kg", "Junior", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-93 kg", "Open", "Powerlifting Classic", 1],
    ["H", "-93 kg", "Open", "Powerlifting Classic Special Olympics", 1],
    ["M", "-57 kg", "Junior", "Powerlifting Classic", 1],
    ["M", "-63 kg", "Junior", "Powerlifting Classic", 2],
    ["M", "-63 kg", "Open", "Only Bench Classic", 1],
    ["M", "-63 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["M", "-69 kg", "Open", "Powerlifting Classic", 1],
    ["M", "-69 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["M", "-76 kg", "Junior", "Powerlifting Classic", 1],
    ["M", "-76 kg", "Open", "Powerlifting Classic", 2],
    ["M", "-84 kg", "Open", "Powerlifting Classic", 1],
    ["M", "-84 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1]
  ],
  norte: [
    ["H", "+120 kg", "Junior", "Powerlifting Classic", 1],
    ["H", "-105 kg", "Junior", "Powerlifting Classic", 1],
    ["H", "-105 kg", "Open", "Powerlifting Classic", 4],
    ["H", "-120 kg", "Open", "Powerlifting Classic", 1],
    ["H", "-120 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["H", "-59 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["H", "-66 kg", "Junior", "Powerlifting Classic", 1],
    ["H", "-66 kg", "Open", "Powerlifting Classic", 2],
    ["H", "-66 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["H", "-74 kg", "Junior", "Powerlifting Classic", 7],
    ["H", "-74 kg", "Junior", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-74 kg", "Open", "Powerlifting Classic", 8],
    ["H", "-74 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-74 kg", "Sub-Junior", "Powerlifting Classic", 2],
    ["H", "-83 kg", "Junior", "Powerlifting Classic", 6],
    ["H", "-83 kg", "Open", "Powerlifting Classic", 7],
    ["H", "-83 kg", "Sub-Junior", "Powerlifting Classic", 4],
    ["H", "-93 kg", "Junior", "Powerlifting Classic", 6],
    ["H", "-93 kg", "Open", "Powerlifting Classic", 5],
    ["H", "-93 kg", "Sub-Junior", "Powerlifting Classic", 3],
    ["M", "-47 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["M", "-57 kg", "Open", "Powerlifting Classic", 1],
    ["M", "-63 kg", "Junior", "Powerlifting Classic", 3],
    ["M", "-63 kg", "Junior", "Powerlifting Classic + Only Bench Classic", 1],
    ["M", "-63 kg", "Open", "Powerlifting Classic", 3],
    ["M", "-63 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["M", "-69 kg", "Open", "Powerlifting Classic", 3],
    ["M", "-76 kg", "Junior", "Powerlifting Classic", 1],
    ["M", "-76 kg", "Open", "Powerlifting Classic", 1]
  ],
  suraustral: [
    ["H", "+120 kg", "Junior", "Powerlifting Classic", 1],
    ["H", "+120 kg", "Open", "Powerlifting Classic", 1],
    ["H", "-105 kg", "Junior", "Powerlifting Classic", 1],
    ["H", "-105 kg", "Master I", "Powerlifting Classic", 1],
    ["H", "-105 kg", "Open", "Powerlifting Classic", 1],
    ["H", "-105 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-120 kg", "Open", "Powerlifting Classic", 2],
    ["H", "-59 kg", "Junior", "Powerlifting Classic", 1],
    ["H", "-66 kg", "Junior", "Powerlifting Classic", 1],
    ["H", "-66 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["H", "-66 kg", "Sub-Junior", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-74 kg", "Junior", "Powerlifting Classic", 3],
    ["H", "-74 kg", "Open", "Powerlifting Classic", 3],
    ["H", "-74 kg", "Sub-Junior", "Only Bench Classic", 1],
    ["H", "-74 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["H", "-83 kg", "Junior", "Powerlifting Classic", 9],
    ["H", "-83 kg", "Open", "Powerlifting Classic", 6],
    ["H", "-83 kg", "Open", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-83 kg", "Sub-Junior", "Powerlifting Classic", 1],
    ["H", "-83 kg", "Sub-Junior", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-93 kg", "Junior", "Powerlifting Classic", 3],
    ["H", "-93 kg", "Junior", "Powerlifting Classic + Only Bench Classic", 1],
    ["H", "-93 kg", "Open", "Only Bench Classic", 1],
    ["H", "-93 kg", "Open", "Powerlifting Classic", 5],
    ["H", "-93 kg", "Open", "Powerlifting Classic + Only Bench Classic", 2],
    ["M", "+84 kg", "Open", "Powerlifting Classic", 2],
    ["M", "-57 kg", "Open", "Powerlifting Classic", 1],
    ["M", "-63 kg", "Master II", "Powerlifting Classic", 1],
    ["M", "-63 kg", "Open", "Powerlifting Classic", 3],
    ["M", "-69 kg", "Junior", "Powerlifting Classic", 1],
    ["M", "-69 kg", "Open", "Powerlifting Classic", 2],
    ["M", "-76 kg", "Junior", "Powerlifting Classic", 1],
    ["M", "-76 kg", "Open", "Powerlifting Classic", 1],
    ["M", "-76 kg", "Open", "Powerlifting Classic + Only Bench Classic", 2],
    ["M", "-84 kg", "Open", "Powerlifting Equipado", 1]
  ]
};

const MOD = {
  'firebase-app.js': `export const initializeApp=()=>({});`,
  'firebase-auth.js': `export const getAuth=()=>({currentUser:{uid:'u1',email:'x@y.cl'}});
    export const signInWithEmailAndPassword=async()=>({user:{uid:'u1'}});export const signOut=async()=>{};
    export const createUserWithEmailAndPassword=async()=>({user:{uid:'u2'}});
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb({uid:'u1',email:'x@y.cl'}),0);return()=>{};};`,
  'firebase-firestore.js': `
    const snap=d=>({docs:d.map(x=>({id:x.id,data:()=>x,exists:()=>true})),forEach(f){this.docs.forEach(f)},size:d.length,empty:!d.length});
    const busca=q=>(globalThis.__FAKE&&globalThis.__FAKE[q&&(q.__n||(q.__q&&q.__q.__n))])||[];
    export const initializeFirestore=()=>({});export const getFirestore=()=>({});
    export const persistentLocalCache=()=>({});export const persistentMultipleTabManager=()=>({});
    export const collection=(_d,n)=>({__n:n});export const doc=(_d,n,i)=>({__n:n,__i:i});
    export const getDocs=async q=>snap(busca(q));
    export const getDoc=async r=>{const d=(busca(r)||[]).find(x=>x.id===r.__i);return{exists:()=>!!d,data:()=>d||{},id:r.__i};};
    export const setDoc=async()=>{};export const updateDoc=async()=>{};export const deleteDoc=async()=>{};
    export const deleteField=()=>null;export const addDoc=async()=>({id:'x'});
    export const query=c=>({__q:c,__n:c&&c.__n});export const where=()=>({});export const orderBy=()=>({});export const limit=()=>({});
    export const onSnapshot=(q,cb)=>{try{cb(snap(busca(q)))}catch(e){}return()=>{};};
    export const serverTimestamp=()=>0;
    export const writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});`,
  'firebase-storage.js': `export const getStorage=()=>({});export const ref=()=>({});export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>'';export const deleteObject=async()=>{};export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({});export const httpsCallable=()=>async()=>({data:{}});`,
};

// De la lista compacta a filas del cronograma, que es lo que come el repartidor.
const filas = clave => {
  const out = [];
  PADRON[clave].forEach(([sexo, categoria, division, modalidad, n], gi) => {
    for (let k = 0; k < n; k++)
      out.push({ nombre: 'A' + gi + '_' + k, sexo, categoria, division, modalidad,
                 club: '', flight: '', jornada: '', dia: '', tarima: '',
                 entrenador: '', handler1: {}, handler2: {} });
  });
  return out;
};
const esBench = m => { m = (m || '').toLowerCase(); return /bench|banca/.test(m) && !/powerlifting/.test(m); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url(), k = Object.keys(MOD).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MOD[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  p.on('dialog', async d => { await d.accept(); });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }] }; });
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof ST !== 'undefined' && typeof cronoAutoDistribute === 'function',
    null, { timeout: 25000 });

  const repartir = async rs => p.evaluate(async r => {
    ST.cronoEv = 'prueba'; ST.cronoRows = r;
    await cronoAutoDistribute();
    return ST.cronoRows.map(x => ({ flight: x.flight, jornada: x.jornada, sexo: x.sexo,
                                    categoria: x.categoria, division: x.division, modalidad: x.modalidad }));
  }, rs);

  const tandas = out => {
    const by = {};
    out.forEach(r => { (by[r.flight] = by[r.flight] || []).push(r); });
    return Object.keys(by).sort().map(f => {
      const v = by[f];
      return { f, n: v.length, pl: v.filter(r => !esBench(r.modalidad)).length,
               sexos: [...new Set(v.map(r => r.sexo))].sort(),
               grupos: [...new Set(v.map(r => r.sexo + '|' + r.categoria + '|' + r.division))] };
    });
  };

  for (const [nom, clave, mujeres] of [['Regional Centro Sur', 'centrosur', 12],
                                       ['Regional Norte', 'norte', 15],
                                       ['Regional Sur Austral', 'suraustral', 15]]) {
    const rs = filas(clave);
    const out = await repartir(rs);
    const t = tandas(out);
    console.log('\n' + nom + ' \u00b7 ' + rs.length + ' atletas \u00b7 ' + mujeres + ' mujeres');
    console.log('  reparto: ' + t.map(x => x.f + ':' + x.n + (x.pl !== x.n ? '(' + x.pl + 'PL)' : '')).join('  '));

    ok(out.length === rs.length, 'no se pierde ni se duplica ning\u00fan atleta');
    ok(out.every(r => r.flight), 'todos quedan con tanda');
    const cortas = t.filter(x => x.pl > 0 && x.pl < 8);
    const largas = t.filter(x => x.pl > 14);
    ok(!cortas.length, 'ninguna bajo 8 de powerlifting' + (cortas.length ? ' \u2014 ' + cortas.map(x => x.f + ':' + x.pl).join(', ') : ''));
    ok(!largas.length, 'ninguna sobre 14 de powerlifting' + (largas.length ? ' \u2014 ' + largas.map(x => x.f + ':' + x.pl).join(', ') : ''));

    // Una categor\u00eda + divisi\u00f3n no se parte entre dos tandas.
    const donde = {};
    out.forEach(r => { const k = r.sexo + '|' + r.categoria + '|' + r.division;
                       (donde[k] = donde[k] || new Set()).add(r.flight); });
    const partidas = Object.keys(donde).filter(k => donde[k].size > 1);
    ok(!partidas.length, 'ninguna categor\u00eda partida en dos tandas'
       + (partidas.length ? ' \u2014 ' + partidas.slice(0, 3).join(', ') : ''));

    const mixtas = t.filter(x => x.sexos.length > 1);
    if (mujeres === 12) {
      ok(!mixtas.length, 'con doce mujeres NO se mezcla: entran solas');
    } else {
      ok(mixtas.length === 1, 'con quince mujeres hay UNA tanda mixta, no m\u00e1s');
      ok(mixtas.length === 1 && mixtas[0].f === t[0].f, 'y es la de apertura');
    }
  }

  ok(!errs.length, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO CORRECTO');
  process.exit(fallas ? 1 : 0);
})();

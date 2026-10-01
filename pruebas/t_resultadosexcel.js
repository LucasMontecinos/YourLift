// Panel → Exports → "Descargar los resultados en Excel" (solo el Owner).
//
// Una pestaña por campeonato cerrado en YourLift, y adentro cada modalidad,
// categoría y división por separado. Las dos tarimas de un campeonato van en la
// misma pestaña; el resultado repetido por un cierre doble (…_meet y …_meet_uni)
// sale una vez; los subidos a mano de campeonatos del extranjero no van.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_resultadosexcel.js
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

const R = (id, o) => Object.assign({ id, source: 'yourlift_livecast', view: 'meet', sexo: 'Hombre', categoria: '83', division: 'Open',
  modalidad: 'Powerlifting Classic', club: 'Club Uno' }, o);
const RES = [
  R('deb_T1_a_meet', { evento: 'Campeonato Debutantes Prueba 2026 - Tarima 1', evento_id: 'deb_T1', fecha: '2026-06-14', nombre: 'Ana Primera', sexo: 'Mujer', categoria: '63',
    resultado: { bw: 62, sq: 100, bp: 50, dl: 120, total: 270, glp: 60, status: 'OK' }, anioNac: '2001' }),
  R('deb_T2_b_meet', { evento: 'Campeonato Debutantes Prueba 2026 - Tarima 2', evento_id: 'deb_T2', fecha: '2026-06-14', nombre: 'Beto Segundo',
    resultado: { bw: 82, sq: 200, bp: 120, dl: 230, total: 550, glp: 77, status: 'OK' } }),
  R('deb_T2_c_meet', { evento: 'Campeonato Debutantes Prueba 2026 - Tarima 2', evento_id: 'deb_T2', fecha: '2026-06-14', nombre: 'Carlos Nulo',
    resultado: { bw: 80, sq: 0, bp: 110, dl: 220, total: 0, glp: 0, status: 'DQ' } }),
  R('deb_T2_d_meet', { evento: 'Campeonato Debutantes Prueba 2026 - Tarima 2', evento_id: 'deb_T2', fecha: '2026-06-14', nombre: 'Diego Tercero',
    resultado: { bw: 83, sq: 210, bp: 130, dl: 240, total: 580, glp: 80, status: 'OK' }, posicion: '1' }),
  // Cierre doble: el viejo (_meet) y el bueno (_meet_uni).
  R('suda_x_meet', { evento: 'Sudamericano Prueba 2026', evento_id: 'suda', fecha: '2026-09-25', nombre: 'Uno Universitario', division: 'Universitario',
    club: 'Universidad de Prueba', resultado: { bw: 82, sq: 250, bp: 150, dl: 295, total: 695, glp: 96, status: 'OK' }, posicion: '1' }),
  R('suda_x_meet_uni', { evento: 'Sudamericano Prueba 2026', evento_id: 'suda', fecha: '2026-09-29', nombre: 'Uno Universitario', division: 'Universitario',
    modalidad: 'Powerlifting Classic Universitario', club: 'Universidad de Prueba', resultado: { bw: 82, sq: 250, bp: 150, dl: 295, total: 695, glp: 96, status: 'OK' }, posicion: '1' }),
  R('suda_y_bench', { evento: 'Sudamericano Prueba 2026', evento_id: 'suda', fecha: '2026-09-25', nombre: 'Uno Universitario', view: 'bench',
    modalidad: 'Only Bench Classic', resultado: { bw: 82, sq: 0, bp: 152.5, dl: 0, total: 152.5, glp: 80, status: 'OK' } }),
  // Subido a mano: un mundial. No es un campeonato corrido acá.
  { id: 'manual1', source: 'manual', evento: 'IPF World Prueba 2026', nombre: 'Otra Persona', sexo: 'Mujer', categoria: '57',
    resultado: { total: 400, status: 'OK' } },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  await ctx.route(/exceljs/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/apoyo/exceljs.min.js') }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(res => {
    window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }], competition_results: res };
    const orig = URL.createObjectURL;
    URL.createObjectURL = function (b) { if (b && /spreadsheet/.test(b.type)) window.__xl = b; return orig.call(URL, b); };
  }, RES);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 20000 }).catch(() => {});
  await p.waitForFunction(() => (window.ST && (ST.allCompResults || []).length) || false, null, { timeout: 10000 }).catch(() => {});
  await p.evaluate(() => go('exports'));
  await p.waitForTimeout(400);
  const txtBtn = await p.evaluate(() => (document.getElementById('btnExportResultados') || {}).textContent || '');
  ok(/2 campeonatos/.test(txtBtn), 'el botón cuenta los campeonatos, sin el mundial: ' + txtBtn);
  await p.click('#btnExportResultados');
  await p.waitForFunction(() => !!window.__xl, null, { timeout: 60000 }).catch(() => {});
  const r = await p.evaluate(async () => {
    if (!window.__xl) return null;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await window.__xl.arrayBuffer());
    const hoja = n => { const w = wb.getWorksheet(n); const o = []; w && w.eachRow(row => o.push(row.values.slice(1))); return o; };
    return { hojas: wb.worksheets.map(w => w.name), deb: hoja('Debutantes Prueba 2026'), suda: hoja('Sudamericano Prueba 2026') };
  });
  ok(!!r, 'se genera el archivo');
  if (r) {
    ok(r.hojas.join('|') === 'Resumen|Debutantes Prueba 2026|Sudamericano Prueba 2026', 'una pestaña por campeonato, en orden de fecha: ' + r.hojas.join(', '));
    const nombres = r.deb.map(f => f[1]);
    ok(['Ana Primera', 'Beto Segundo', 'Diego Tercero', 'Carlos Nulo'].every(n => nombres.includes(n)), 'las dos tarimas de Debutantes en la misma pestaña');
    const tit = r.deb.filter(f => typeof f[0] === 'string' && /^Powerlifting|^Only Bench/.test(f[0])).map(f => f[0]);
    ok(tit.length === 2 && /Mujeres · 63 kg · Open/.test(tit[0]) && /Hombres · 83 kg · Open/.test(tit[1]), 'cada categoría aparte: ' + tit.join(' / '));
    const fila = n => r.deb.find(f => f[1] === n) || [];
    ok(fila('Diego Tercero')[0] === 1 && fila('Beto Segundo')[0] === 2 && fila('Carlos Nulo')[0] === 'DQ', 'con su lugar, y el DQ al final');
    ok(fila('Ana Primera')[3] === 2001 && fila('Ana Primera')[8] === 270, 'con año de nacimiento y total');
    const cab = r.deb.find(f => f[0] === 'LUGAR') || [];
    ok(cab.join('|') === 'LUGAR|ATLETA|CLUB|AÑO NAC.|PESO CORP.|SQ|BP|DL|TOTAL|GL POINTS', 'columnas: ' + cab.join(' | '));
    const uno = r.suda.filter(f => f[1] === 'Uno Universitario');
    ok(uno.length === 2, 'en el Sudamericano: powerlifting y banca, sin el repetido del cierre doble (' + uno.length + ')');
    ok((r.suda.find(f => f[0] === 'LUGAR') || []).includes('UNIVERSIDAD') && uno[0][3] === 'Universidad de Prueba', 'y con la universidad');
  }
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

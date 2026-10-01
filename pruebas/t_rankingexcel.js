// Panel → Exports → "Descargar el ranking en Excel" (solo el Owner).
//
// Una hoja por pestaña del ranking y, adentro, cada categoría de peso y división
// por separado. Los números salen de ranking.html (rkGrupos), así que el Excel
// es lo mismo que se ve publicado: se revisa con un resultado recién publicado.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_rankingexcel.js
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
    // competition_results llega tarde, como en un teléfono con mala señal: el
    // Excel no puede salir antes de tenerlo (los de data.json llegan primero).
    export const getDocs=async q=>{ if(q&&(q.__n||(q.__q&&q.__q.__n))==='competition_results')await new Promise(r=>setTimeout(r,3000)); return snap(busca(q)); };
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

const RES = [{ id: 'prueba_x_meet', nombre: 'Atleta Excel Prueba', club: 'Club Prueba', sexo: 'Hombre', categoria: '83', division: 'Open',
  modalidad: 'Powerlifting Classic', view: 'meet', evento: 'Regional de Prueba 2026', fecha: '2026-11-08', anioNac: '1999',
  resultado: { bw: 82.5, sq: 400, bp: 300, dl: 420, total: 1120, glp: 150 } }];

async function abrir(b, rol) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  await ctx.route(/exceljs/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/apoyo/exceljs.min.js') }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([a, res]) => {
    window.__FAKE = { admins: [a], competition_results: res, athlete_edits: [] };
    try { localStorage.clear(); } catch (e) {}
    // El archivo no se baja: se guarda acá para leerlo.
    const orig = URL.createObjectURL;
    URL.createObjectURL = function (b) { if (b && /spreadsheet/.test(b.type)) window.__xl = b; return orig.call(URL, b); };
  }, [Object.assign({ id: 'u1', email: 'x@y.cl' }, rol), RES]);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 20000 }).catch(() => {});
  await p.evaluate(() => go('exports'));
  await p.waitForTimeout(500);
  return { p, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nSolo el Owner ve el botón');
  {
    const { p } = await abrir(b, { role: 'admin' });
    ok(!(await p.$('#btnExportRanking')), 'un admin común no lo ve');
    await p.context().close();
  }

  const { p, errs } = await abrir(b, { role: 'owner' });
  ok(!!(await p.$('#btnExportRanking')), 'el Owner sí');
  await p.click('#btnExportRanking');
  await p.waitForFunction(() => !!window.__xl, null, { timeout: 60000 }).catch(() => {});
  const r = await p.evaluate(async () => {
    if (!window.__xl) return null;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await window.__xl.arrayBuffer());
    const hojas = wb.worksheets.map(w => w.name);
    const cm = wb.getWorksheet('Classic Masculino');
    const filas = []; cm.eachRow(row => filas.push(row.values.slice(1).map(v => (v && v.richText) ? v.richText.map(x => x.text).join('') : v)));
    const bench = wb.getWorksheet('Bench Classic Masculino');
    const cabBench = []; bench && bench.eachRow(row => { if (row.getCell(1).value === '#') cabBench.push(row.values.slice(1).join('|')); });
    return { hojas, filas, cabBench: cabBench[0] || '' };
  });
  console.log('\nEl archivo');
  ok(!!r, 'se genera');
  if (r) {
    ok(r.hojas[0] === 'Resumen', 'primero el resumen');
    ok(['Classic Masculino', 'Classic Femenino', 'Bench Classic Masculino'].every(h => r.hojas.includes(h)), 'una hoja por pestaña: ' + r.hojas.join(', '));
    const tit = r.filas.filter(f => typeof f[0] === 'string' && / kg — /.test(f[0])).map(f => f[0]);
    ok(tit.length > 5, 'dentro de la hoja, cada categoría y división aparte (' + tit.length + ': ' + tit.slice(0, 3).join(' · ') + '…)');
    const iTit = r.filas.findIndex(f => /^83 kg — Open/.test(f[0] || ''));
    const prim = r.filas[iTit + 2] || [];
    ok(prim[0] === 1 && prim[1] === 'Atleta Excel Prueba' && prim[8] === 1120, 'trae el resultado recién publicado, primero en 83 kg Open: ' + prim.slice(0, 3).join(' · '));
    ok(prim[2] === 'Club Prueba' && prim[3] === 1999, 'con club y año de nacimiento: ' + prim[2] + ' · ' + prim[3]);
    ok(prim[10] === 'Regional de Prueba 2026', 'y el campeonato donde hizo la marca: ' + prim[10]);
    const cab = r.filas.find(f => f[0] === '#') || [];
    ok(cab.join('|') === '#|ATLETA|CLUB|AÑO NAC.|PESO CORP.|SQ|BP|DL|TOTAL|GL POINTS|CAMPEONATO', 'columnas: ' + cab.join(' | '));
    // Los del archivo del ranking no traen el campeonato: sale de la base de atletas.
    const conCamp = r.filas.filter(f => typeof f[0] === 'number' && f[10]).length, total = r.filas.filter(f => typeof f[0] === 'number').length;
    ok(conCamp / total > 0.8, 'casi todos con su campeonato, también los del archivo (' + conCamp + ' de ' + total + ')');
    const conAnio = r.filas.filter(f => typeof f[0] === 'number' && f[3]).length;
    ok(conAnio / total > 0.8, 'y con su año de nacimiento (' + conAnio + ' de ' + total + ')');
    ok(r.filas.every(f => f[1] !== 'Atleta Excel Prueba' || f[0] === 1) && r.filas.filter(f => f[1] === 'Atleta Excel Prueba').length === 1, 'una sola vez');
    ok(/^#\|ATLETA\|CLUB\|AÑO NAC\.\|PESO CORP\.\|BP\|GL POINTS\|CAMPEONATO$/.test(r.cabBench), 'en Bench, solo la banca: ' + r.cabBench);
  }
  ok(!(await p.$('iframe[src*="ranking.html"]')), 'el marco del ranking se cierra al terminar');
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

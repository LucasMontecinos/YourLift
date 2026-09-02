// Quién ve qué en el panel, según su cuenta.
//
// Entrar al panel lo decide estar en admins/{uid}. El campo `role` solo AFINA:
// dice quién ve además la demografía y el tráfico web, que son del negocio y no
// del deporte.
//
// Había dos errores, y juntos daban el síntoma más confuso posible:
//
//   · El botón de Estadísticas se dibujaba preguntando una cosa y la pantalla se
//     dibujaba preguntando otra. A la comisión técnica le aparecía el botón en el
//     menú y, al apretarlo, la devolvía a Atletas. Se veía como si el panel
//     estuviera fallando.
//   · Y la pregunta era una lista de roles: ['superadmin','admin']. Un documento
//     de admin sin el campo `role` —o con uno propio, 'comision'— daba false y
//     quedaba fuera, aunque hubiera entrado al panel sin problema.
//
// Ahora las dos puertas preguntan lo mismo, y preguntan al revés: puede cualquiera
// que esté en admins/, salvo las cuentas que tienen su propia pantalla y no operan
// el panel.
//
// El panel no carga sin Firebase, así que se interceptan sus módulos y se sirven
// falsos. Es la única forma de abrirlo acá y mirarlo de verdad.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_permisosadmin.js
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

const TABS = ['DEPORTE', 'CORTE NACIONAL', 'DEMOGRAFÍA', 'TRÁFICO WEB'];

async function abrirComo(b, admin) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  await p.addInitScript(a => { window.__FAKE = { admins: [a] }; }, admin);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  // Hay que esperar a que el panel TERMINE de dibujar el menú: si se lee antes,
  // el botón todavía no existe y la prueba culpa a los permisos de algo que es
  // puro tiempo. Las cuentas que no operan el panel nunca dibujan el menú, así
  // que la espera se cae sola y se sigue igual.
  await p.waitForFunction(
    () => /ATLETAS|Esta cuenta es para|Acceso denegado/i.test(document.body.innerText || ''),
    null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(900);
  const r = await p.evaluate(t => {
    const menu = document.body.innerText;
    let pest = [];
    try {
      ST.view = 'stats'; render();
      pest = [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(x => t.includes(x));
    } catch (e) {}
    return {
      entro: !!ST.adminInfo,
      vista: ST.view,
      menuEstadisticas: menu.includes('ESTADÍSTICAS'),
      menuClubes: menu.includes('CLUBES'),
      pestanas: pest,
    };
  }, TABS);
  await ctx.close();
  return r;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  console.log('\nEl owner ve todo');
  {
    const r = await abrirComo(b, { id: 'u1', email: 'x@y.cl', role: 'owner' });
    ok(r.menuEstadisticas, 'tiene Estadísticas en el menú');
    ok(r.pestanas.length === 4, 'y las cuatro pestañas: ' + JSON.stringify(r.pestanas));
  }

  console.log('\n  La comisión técnica ve la parte deportiva, y entra de verdad');
  {
    // Los tres casos que daban el mismo síntoma: el rol de siempre, un documento
    // sin el campo role, y un rol propio que no estaba en ninguna lista.
    for (const admin of [
      { id: 'u1', email: 'x@y.cl', role: 'admin' },
      { id: 'u1', email: 'x@y.cl' },
      { id: 'u1', email: 'x@y.cl', role: 'comision' },
    ]) {
      const quien = admin.role || '(sin campo role)';
      const r = await abrirComo(b, admin);
      ok(r.menuEstadisticas, quien + ': tiene el botón en el menú');
      // Lo que fallaba: el botón estaba pero la vista rebotaba a Atletas.
      ok(r.vista === 'stats', quien + ': y al abrirlo NO lo devuelve a Atletas');
      ok(r.pestanas.includes('DEPORTE') && r.pestanas.includes('CORTE NACIONAL'),
         quien + ': ve Deporte y Corte Nacional');
      ok(!r.pestanas.includes('DEMOGRAFÍA') && !r.pestanas.includes('TRÁFICO WEB'),
         quien + ': y NO ve demografía ni tráfico web');
      ok(r.menuClubes, quien + ': puede entrar a Clubes');
    }
  }

  console.log('\n  Una cuenta de transmisión no entra al panel');
  {
    const r = await abrirComo(b, { id: 'u1', email: 'x@y.cl', role: 'streaming' });
    ok(!r.menuEstadisticas, 'sin Estadísticas');
    ok(!r.menuClubes, 'sin Clubes');
    ok(r.pestanas.length === 0, 'y sin ninguna pestaña de estadísticas');
  }

  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/_ROLES_SIN_PANEL=\['juez','streaming','transmision'\]/.test(adm),
       'la lista es de quién NO opera el panel, no de quién sí');
    // Las dos puertas —el botón y la vista— tienen que preguntar lo mismo.
    ok(/\$\{_statsPuede\(\)\?`<button class="side-btn \$\{ST\.view==='stats'/.test(adm),
       'el botón pregunta _statsPuede()');
    ok(/else if\(ST\.view==='stats'\)\{if\(_statsPuede\(\)\)/.test(adm),
       'y la vista pregunta lo mismo');
    ok(/_statsOwner\(\)\?tabBtn\('demografia'/.test(adm) && /_statsOwner\(\)\?tabBtn\('web'/.test(adm),
       'y adentro, demografía y tráfico web siguen siendo solo del owner');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

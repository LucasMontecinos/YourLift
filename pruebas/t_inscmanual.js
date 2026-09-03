// Agregar una inscripción a mano, desde el panel.
//
// Las inscripciones entran por el formulario público y hasta ahora no había forma
// de crear una desde el panel. Hace falta: Carolina Andrea Ramos Donoso está en la
// nómina de FESUPO y compite el día 3 del Sudamericano, pero nunca se inscribió en
// el sitio. Aparecía en la nómina pública y en el livecast, y no en las listas de
// inscritos, que son de donde salen la acreditación y el control de cupos.
//
// Dos cosas importan acá:
//
//   · El atleta se elige del PADRÓN, no se escribe a mano. Así el RUT, el código y
//     el club salen de una sola fuente y la inscripción queda cruzable con su
//     ficha. Escribir el nombre a mano es como se crean los duplicados.
//   · El id del documento se arma igual que en el formulario público
//     —{evento}_{rut sin puntos}—, así que si esa persona ya está inscrita en ese
//     campeonato hay que avisar, no pisarle la inscripción que ya tiene.
//
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_inscmanual.js
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
    export const signOut=async()=>{}; export const createUserWithEmailAndPassword=async()=>({user:{uid:'u2'}});
    export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb({uid:'u1',email:'x@y.cl'}),0);return()=>{};};`,
  'firebase-firestore.js': `
    const snap=(d)=>({docs:d.map(x=>({id:x.id,data:()=>x,exists:()=>true})),forEach(f){this.docs.forEach(f)},
                      size:d.length,empty:!d.length,metadata:{fromCache:false}});
    const busca=q=>(globalThis.__FAKE&&globalThis.__FAKE[q&&(q.__n||(q.__q&&q.__q.__n))])||[];
    export const initializeFirestore=()=>({}); export const getFirestore=()=>({});
    export const persistentLocalCache=()=>({}); export const persistentMultipleTabManager=()=>({});
    export const collection=(_d,n)=>({__n:n}); export const doc=(_d,n,i)=>({__n:n,__i:i});
    export const getDocs=async q=>snap(busca(q));
    export const getDoc=async r=>{const d=(busca(r)||[]).find(x=>x.id===r.__i);return{exists:()=>!!d,data:()=>d||{},id:r.__i};};
    export const setDoc=async(r,d)=>{(globalThis.__ESCRITO=globalThis.__ESCRITO||[]).push({col:r.__n,id:r.__i,data:d});};
    export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
    export const deleteField=()=>null; export const addDoc=async()=>({id:'x'});
    export const query=c=>({__q:c,__n:c&&c.__n}); export const where=()=>({}); export const orderBy=()=>({}); export const limit=()=>({});
    export const onSnapshot=(q,cb)=>{try{cb(snap(busca(q)))}catch(e){}return()=>{};};
    export const serverTimestamp=()=>'TS';
    export const writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}});`,
  'firebase-storage.js': `
    export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytes=async()=>({});
    export const getDownloadURL=async()=>''; export const deleteObject=async()=>{}; export const listAll=async()=>({items:[],prefixes:[]});`,
  'firebase-functions.js': `export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}});`,
};

(async () => {
  const padron = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));
  // La atleta del caso real.
  const caro = padron.find(a => /Ramos Donoso/i.test(a.nombre || '') && /Carolina/i.test(a.nombre || ''));

  console.log('\nLa atleta del caso está en el padrón y en la nómina');
  {
    ok(!!caro, 'Carolina Andrea Ramos Donoso está en el padrón');
    ok(!!(caro && caro.rut), 'con RUT: ' + ((caro || {}).rut || '—'));
    const nom = JSON.parse(fs.readFileSync(__dirname + '/../nomina_sudamericano.json', 'utf8'));
    const enNom = nom.atletas.find(a => a.cod === (caro || {}).codigo);
    ok(!!enNom, 'y en la nómina del Sudamericano, ' + ((enNom || {}).div || '') + ' ' + ((enNom || {}).cat || ''));
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(f => { window.__FAKE = f; }, {
    admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }],
    inscripciones: [{ id: 'Sudamericano_2026_11111111', evento: 'Sudamericano_2026',
                      nombre: 'Ya inscrito', rut: '1111111-1', status: 'approved' }],
    inscripciones_private: [], atleta_fotos: [], atletas_pending: [], athlete_edits: [],
    eventos: [{ id: 'Sudamericano_2026', name: 'Sudamericano_2026' }],
  });
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 25000 });
  await p.waitForTimeout(3000);

  console.log('\n  El botón está en Revisión inscripciones');
  {
    const hay = await p.evaluate(() => {
      try { ST.view = 'approvals'; render(); } catch (e) { return 'ERR ' + e.message; }
      return /\+ Agregar inscripción/.test(document.body.innerText)
        || document.body.innerHTML.includes('openInsModal');
    });
    if (errs.length) console.log('   [pageerror] ' + errs[0].slice(0, 160));
    ok(hay === true, 'aparece "+ Agregar inscripción"' + (typeof hay === 'string' ? ' — ' + hay : ''));
  }

  // Todo lo que sigue se hace COMO UNA PERSONA: escribiendo en el buscador y
  // haciendo clic. El estado del modal vive dentro del módulo y no se toca desde
  // afuera — y además así se prueba que los manejadores en línea del HTML
  // funcionen, que es donde estaba el error: llamaban a funciones que no estaban
  // colgadas de window y no hacían nada.
  console.log('\n  El atleta se elige del padrón, no se escribe');
  {
    await p.evaluate(() => openInsModal());
    await p.fill('#ins_q', caro.nombre.slice(0, 16));
    const r = await p.evaluate(nombre => {
      const modal = document.getElementById('insModal');
      const btn = [...modal.querySelectorAll('button')].find(b => /^Agregar$/.test(b.textContent.trim()));
      return { sugerencia: modal.innerText.includes(nombre), bloqueado: !!(btn && btn.disabled) };
    }, caro.nombre);
    ok(r.sugerencia, 'buscando por nombre la propone desde el padrón');
    ok(r.bloqueado, 'y sin atleta elegido no deja guardar');
  }

  console.log('\n  Guarda con los datos del padrón');
  {
    // Se elige la atleta de la lista, el campeonato del desplegable y se escribe
    // la categoría, igual que lo haría una persona.
    await p.evaluate(nombre => {
      const modal = document.getElementById('insModal');
      const fila = [...modal.querySelectorAll('div')].find(d => d.getAttribute('onclick') && d.textContent.includes(nombre));
      fila.click();
    }, caro.nombre);
    await p.selectOption('#ins_ev', 'Sudamericano_2026');
    await p.selectOption('#ins_div', 'Sub-Junior');
    await p.fill('#ins_cat', '-69');
    const r = await p.evaluate(() => {
      globalThis.__ESCRITO = [];
      return window.insGuardar().then(() => globalThis.__ESCRITO);
    });
    ok(r.length === 1, 'una sola escritura');
    const e = r[0] || {};
    const d = e.data || {};
    ok(e.col === 'inscripciones', 'sobre inscripciones');
    // El id se arma igual que en el formulario público: si no, la misma persona
    // podría quedar inscrita dos veces con dos ids distintos.
    ok(e.id === 'Sudamericano_2026_' + String(caro.rut).replace(/[^0-9kK]/g, ''),
       'el id es {evento}_{rut}, igual que el del formulario público: ' + e.id);
    ok(d.rut === caro.rut && d.codigo === caro.codigo && d.nombre === caro.nombre,
       'el nombre, el RUT y el código salen del padrón');
    ok(d.status === 'approved', 'queda aceptada');
    ok(d.categoria === '-69 kg', 'la categoría se guarda con la unidad: ' + d.categoria);
    // Quien la revise después tiene que poder ver que no vino del formulario y
    // por eso no tiene PIN ni carnet ni WADA.
    ok(d.origen === 'panel', 'y queda anotado que se creó desde el panel');
  }

  console.log('\n  No pisa una inscripción que ya existe');
  {
    await p.evaluate(() => {
      ST.data.push({ nombre: 'Ya inscrito Persona', rut: '1111111-1', codigo: 'YA-1' });
      openInsModal();
    });
    await p.fill('#ins_q', 'Ya inscrito Persona');
    await p.evaluate(() => {
      const modal = document.getElementById('insModal');
      [...modal.querySelectorAll('div')].find(d => d.getAttribute('onclick') && /Ya inscrito Persona/.test(d.textContent)).click();
    });
    await p.selectOption('#ins_ev', 'Sudamericano_2026');
    const r = await p.evaluate(() => {
      globalThis.__ESCRITO = [];
      return window.insGuardar().then(() => globalThis.__ESCRITO.length);
    });
    ok(r === 0, 'no escribe nada y avisa (' + r + ' escrituras)');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/window\.openInsModal=/.test(adm), 'el panel sabe crear una inscripción');
    ok(/origen:'panel'/.test(adm), 'y las marca para distinguirlas de las del formulario');
    ok(/ya tiene inscripción en ese campeonato/.test(adm), 'avisa si ya existe en vez de pisarla');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

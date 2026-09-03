// El desplegable de clubes del formulario de inscripción.
//
// La lista era fija, escrita a mano dentro de inscripcion.html, y se fue quedando
// atrás: ofrecía "Club Kensei", que ya no es club, y le faltaba Club Deportivo
// Jaques Oliger, que sí lo es. Quien se inscribía desde ese club tenía que elegir
// "Otro" y después alguien lo corregía a mano en el panel.
//
// Ahora sale del padrón, que es de donde la saca también la sección Clubes del
// panel ("un club figura mientras alguien lo tenga puesto"). Las dos listas no se
// pueden separar porque son la misma cuenta sobre los mismos datos, y eso es lo
// que se fija acá: no que contengan tal o cual nombre, sino que coincidan.
//
// Lo otro que se cuida es el caso feo: alguien inscrito con un club que dejó de
// figurar. Si el <select> no incluye su club, se dibuja en blanco y a la primera
// vez que esa persona toca cualquier otro campo del formulario, guarda sin club.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_clubes.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// La misma cuenta que hace renderClubs() en admin.html.
function clubesDelPadron(padron) {
  return [...new Set(padron.map(a => (a.club || '').trim()).filter(Boolean))].sort();
}

// Firebase de mentira para abrir el panel sin tocar la base de verdad. Las
// escrituras y los borrados quedan anotados para poder mirarlos después.
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
    export const updateDoc=async(r,d)=>{(globalThis.__ESCRITO=globalThis.__ESCRITO||[]).push({col:r.__n,id:r.__i,data:d});};
    export const deleteDoc=async r=>{(globalThis.__BORRADO=globalThis.__BORRADO||[]).push({col:r.__n,id:r.__i});};
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

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/inscripcion.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof clubsParaElegir === 'function' && athleteDB.length > 0,
    null, { timeout: 25000 });

  console.log('\nLa lista sale del padrón, igual que la sección Clubes del panel');
  {
    const lista = await p.evaluate(() => clubsParaElegir(''));
    // "Otro" no es un club: es la salida para quien no está en ninguno, y va al final.
    ok(lista[lista.length - 1] === 'Otro', '"Otro" queda al final, como salida');
    const clubes = lista.slice(0, -1);

    // Lo que ve el panel. Se descuenta "Otro" porque allá tampoco es un club.
    const enPanel = clubesDelPadron(padron).filter(c => c !== 'Otro');
    const faltan = enPanel.filter(c => !clubes.includes(c));
    const sobran = clubes.filter(c => !enPanel.includes(c));
    ok(faltan.length === 0, 'no falta ninguno de los del panel' + (faltan.length ? ': ' + faltan.join(', ') : ''));
    ok(sobran.length === 0, 'ni sobra ninguno que el panel no muestre' + (sobran.length ? ': ' + sobran.join(', ') : ''));
    ok(clubes.length === enPanel.length, `los mismos ${clubes.length} clubes en los dos lados`);

    // Los dos casos que dieron origen a todo esto.
    ok(clubes.some(c => /jaques oliger/i.test(c)),
       'está Jaques Oliger: ' + (clubes.find(c => /jaques oliger/i.test(c)) || '—'));
    ok(!clubes.some(c => /kensei/i.test(c)), 'y ya no está Kensei');

    // Ordenada, o buscar el propio club en el desplegable es una lotería.
    const ordenada = clubes.slice().sort((a, b) => a.localeCompare(b, 'es'));
    ok(clubes.join('|') === ordenada.join('|'), 'y van en orden alfabético');
  }

  console.log('\n  A quien tenga un club que ya no figura no se le borra');
  {
    const r = await p.evaluate(() => ({
      conViejo: clubsParaElegir('Club Kensei'),
      sinNada: clubsParaElegir(''),
    }));
    ok(r.conViejo.includes('Club Kensei'),
       'el club viejo se agrega solo para esa persona, así el <select> no queda en blanco');
    ok(!r.sinNada.includes('Club Kensei'),
       'pero no se le ofrece a nadie más');
    // Si se colara dos veces, el desplegable mostraría el mismo club repetido.
    ok(new Set(r.conViejo).size === r.conViejo.length, 'y no queda repetido');
  }

  console.log('\n  El desplegable dibujado muestra eso mismo');
  {
    const r = await p.evaluate(() => {
      // El formulario es un asistente de cuatro pasos y el club está en uno de
      // ellos; se lo pone en pantalla igual que las otras pruebas del formulario.
      EVENTS = [{ id: 'ev1', name: 'Campeonato de Prueba', closeDate: '2030-12-31' }];
      state.view = 'form'; state.privacyConsent = true;
      state.form = { evento: 'ev1', rut: '19839518-9', nombre: 'Persona De Prueba',
                     fechaNac: '1995-03-20', sexo: 'Masculino', club: '',
                     division: 'Open', categoria: '-83 kg', modalidad: 'Clásico',
                     email: 'a@b.cl', telefono: '999999999' };
      let s = null;
      for (let paso = 1; paso <= 4 && !s; paso++) {
        state.step = paso; render();
        s = [...document.querySelectorAll('select')].find(x => /Seleccionar club/.test(x.innerHTML));
      }
      if (!s) return { falta: true };
      const opts = [...s.options].map(o => o.textContent.trim()).filter(t => !/^Seleccionar/.test(t));
      return { opts, esperado: clubsParaElegir('') };
    });
    if (r.falta) ok(false, 'no se encontró el desplegable de clubes en la página');
    else {
      ok(r.opts.join('|') === r.esperado.join('|'),
         `el <select> tiene las ${r.opts.length} opciones, en el mismo orden`);
      ok(r.opts.includes('Club Deportivo Jaques Oliger'),
         'y ahí está Jaques Oliger para elegirlo');
    }
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await p.close();

  // ── Renombrar un club desde el panel ────────────────────────────────────────
  // Un club mal escrito no se arregla en un solo lugar: como la lista se arma de
  // los atletas, hay que cambiárselo a todos los que lo tienen puesto. Si se
  // cambiara a medias quedarían dos clubes donde hay uno, y el desplegable de
  // inscripción —que sale del mismo padrón— mostraría los dos.
  console.log('\n  Renombrar un club desde el panel se lo cambia a todos');
  {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
    await ctx.route('**/firebasejs/**', r => {
      const u = r.request().url();
      const k = Object.keys(MODULOS).find(k => u.endsWith(k));
      return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
    });
    const a = await ctx.newPage();
    const errA = [];
    a.on('pageerror', e => errA.push(e.message));
    await a.addInitScript(f => { window.__FAKE = f; }, {
      admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }],
      clubs: [{ id: 'clubdeportivojaquesoliger', slug: 'clubdeportivojaquesoliger',
                name: 'Club Deportivo Jaques Oliger', logoUrl: 'https://x/logo.png' }],
      entrenadores: [], inscripciones: [], inscripciones_private: [],
      atleta_fotos: [], atletas_pending: [], athlete_edits: [], eventos: [],
    });
    await a.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
    await a.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 25000 });
    await a.waitForTimeout(3000);

    // Dos clubes: el que se renombra, con dos atletas, y otro que no se toca.
    const hay = await a.evaluate(() => {
      ST.data = [
        { codigo: 'A-1', nombre: 'Uno Uno', rut: '11111111-1', club: 'Club Deportivo Jaques Oliger' },
        { codigo: 'A-2', nombre: 'Dos Dos', rut: '22222222-2', club: 'Club Deportivo Jaques Oliger' },
        { codigo: 'B-1', nombre: 'Tres Tres', rut: '33333333-3', club: 'Otro Club' },
      ];
      window._CLUBS_FS = { clubdeportivojaquesoliger: { logoUrl: 'https://x/logo.png' } };
      ST.view = 'clubs'; render();
      return document.body.innerHTML.includes('clubRenombrar');
    });
    ok(hay, 'la tarjeta del club tiene botón Renombrar');

    const r = await a.evaluate(() => {
      // Se responde el prompt y los confirm como lo haría una persona.
      window.prompt = () => 'Jaques Oliger';
      window.confirm = () => true;
      globalThis.__ESCRITO = []; globalThis.__BORRADO = [];
      return window.clubRenombrar('Club Deportivo Jaques Oliger').then(() => ({
        escrito: globalThis.__ESCRITO,
        borrado: globalThis.__BORRADO,
        clubes: ST.data.map(x => x.codigo + '=' + x.club),
      }));
    });
    const edits = r.escrito.filter(e => e.col === 'athlete_edits' && e.id !== '__version');
    ok(edits.length === 2, 'se guarda la corrección de sus dos atletas (' + edits.length + ')');
    ok(edits.every(e => e.data.club === 'Jaques Oliger'),
       'con el nombre nuevo: ' + [...new Set(edits.map(e => e.data.club))].join(', '));
    ok(r.clubes.join(' · ') === 'A-1=Jaques Oliger · A-2=Jaques Oliger · B-1=Otro Club',
       'y al otro club no se le toca nada: ' + r.clubes.join(' · '));

    // El logo tiene que irse con el nombre, o el club renombrado queda sin logo
    // y el viejo sigue ocupando su lugar en la colección.
    const logoNuevo = r.escrito.find(e => e.col === 'clubs' && e.id === 'jaquesoliger');
    ok(!!logoNuevo, 'el logo se guarda con el slug nuevo');
    ok(!!logoNuevo && logoNuevo.data.logoUrl === 'https://x/logo.png', 'y es el mismo logo');
    ok(r.borrado.some(x => x.col === 'clubs' && x.id === 'clubdeportivojaquesoliger'),
       'y el registro viejo se borra, así no queda duplicado');

    console.log('\n  Si se cancela, no se toca nada');
    {
      const c = await a.evaluate(() => {
        globalThis.__ESCRITO = [];
        window.prompt = () => null;            // se apretó Cancelar
        return window.clubRenombrar('Otro Club').then(() => globalThis.__ESCRITO.length);
      });
      ok(c === 0, 'cancelar el nombre no escribe nada (' + c + ')');
      const m = await a.evaluate(() => {
        globalThis.__ESCRITO = [];
        window.prompt = () => 'Otro Club';     // el mismo nombre de siempre
        window.confirm = () => true;
        return window.clubRenombrar('Otro Club').then(() => globalThis.__ESCRITO.length);
      });
      ok(m === 0, 'y poner el mismo nombre tampoco (' + m + ')');
      const n = await a.evaluate(() => {
        globalThis.__ESCRITO = [];
        window.prompt = () => 'Nombre Nuevo';
        window.confirm = () => false;          // se echó atrás en la confirmación
        return window.clubRenombrar('Otro Club').then(() => globalThis.__ESCRITO.length);
      });
      ok(n === 0, 'ni echarse atrás en la confirmación (' + n + ')');
    }

    ok(errA.length === 0, 'sin errores de JavaScript en el panel' + (errA.length ? ': ' + errA[0] : ''));
  }

  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/window\.clubRenombrar=/.test(adm), 'el panel sabe renombrar un club');
    ok(/clubRenombrar\(/.test(adm.slice(adm.indexOf('function renderClubs'))),
       'y el botón está en la tarjeta del club');
    const ins = fs.readFileSync(__dirname + '/../inscripcion.html', 'utf8');
    ok(/function clubsParaElegir/.test(ins), 'una sola forma de armar la lista');
    ok(!/\$\{CLUBS\.map/.test(ins), 'y ningún desplegable quedó con la lista fija');
    // Si el padrón llega después de dibujar, hay que redibujar o se queda el respaldo.
    ok(/athleteDB=d;_insAplicarEdits\(\);[\s\S]{0,220}?render\(\)/.test(ins),
       'y se redibuja cuando llega el padrón');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

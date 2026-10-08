// Los papeles de Olimpiadas Especiales, uno por uno, desde el campeonato.
//
// Pidieron sacar la ficha médica de OE de las inscripciones, pero poder volver a
// pedirla en un campeonato puntual. Así que cada papel de OE tiene un valor de
// siempre (la ficha: no; la exoneración y el certificado de DI: sí) y cada
// campeonato lo puede cambiar en Admin → Campeonatos (oeDocs).
//
// Se fija:
//  · la inscripción no pide la ficha si el campeonato no dice nada,
//  · la pide si el campeonato la activó, y deja de pedir lo que se apagó,
//  · en el panel la ficha sale desmarcada, se puede marcar, y al guardar va a
//    oeDocs sin colarse en los documentos requeridos del campeonato.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_oedocs.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const OE = 'Olimpiadas Especiales';
const EVENTO = { id: 'oe_nac', name: 'Nacional con Olimpiadas Especiales', date: '2026-11-14', status: 'open',
  requiredDocs: ['carnetIdFront'] };

// Igual que t_docsadmin.js, pero setDoc guarda lo que se le manda para mirarlo.
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
    export const setDoc=async(r,d)=>{(globalThis.__ESCRITO=globalThis.__ESCRITO||[]).push({col:r.__n,id:r.__i,d:JSON.parse(JSON.stringify(d))});};
    export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
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

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // ── La inscripción ─────────────────────────────────────────────
  {
    const p = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://localhost:${PUERTO}/inscripcion.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof docsRequeridos === 'function' && typeof _oeDocsAparte === 'function',
      null, { timeout: 25000 });

    const pide = (ev, mod) => p.evaluate(([ev, mod]) => {
      const req = docsRequeridos(ev, '1990-01-01', mod);
      state.form = state.form || {}; state.form.modalidad = mod;
      const aparte = _oeDocsAparte(ev).map(d => d.key);
      return { req, aparte, bloque: _oeBloqueHtml(ev) };
    }, [ev, mod]);

    console.log('\nSin decir nada, el campeonato no pide la ficha médica');
    {
      const r = await pide(EVENTO, OE);
      ok(r.req.indexOf('x_oe_ficha') < 0, 'no está en los documentos requeridos');
      ok(r.aparte.indexOf('x_oe_ficha') < 0, 'ni en el bloque de Olimpiadas Especiales');
      ok(!/Ficha médica/.test(r.bloque), 'y el formulario no la muestra');
      ok(r.req.indexOf('x_oe_exoneracion') >= 0 && r.req.indexOf('x_oe_di') >= 0,
         'la exoneración y el certificado de DI se siguen pidiendo');
      ok(/Exoneración/.test(r.bloque), 'y se ven en el formulario');
    }

    console.log('\nUn campeonato puede volver a pedirla, y apagar otro papel');
    {
      const r = await pide(Object.assign({}, EVENTO, { oeDocs: { x_oe_ficha: true, x_oe_di: false } }), OE);
      ok(r.req.indexOf('x_oe_ficha') >= 0 && r.aparte.indexOf('x_oe_ficha') >= 0, 'la ficha vuelve a pedirse');
      ok(/Ficha médica/.test(r.bloque), 'y aparece en el formulario');
      ok(r.req.indexOf('x_oe_di') < 0 && r.aparte.indexOf('x_oe_di') < 0, 'el certificado de DI apagado ya no se pide');
      ok(r.req.indexOf('x_oe_exoneracion') >= 0, 'lo que no se tocó sigue igual');
    }

    console.log('\nA quien no es de Olimpiadas Especiales no se le pide nada de esto');
    {
      const r = await pide(Object.assign({}, EVENTO, { oeDocs: { x_oe_ficha: true } }), 'Powerlifting Clásico');
      ok(!r.req.some(k => /^x_oe_/.test(k)) && !r.aparte.length, 'ningún papel de OE');
    }
    ok(!errs.length, 'la inscripción sin errores de página' + (errs.length ? ': ' + errs[0] : ''));
    await p.context().close();
  }

  // ── El panel ───────────────────────────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, serviceWorkers: 'block' });
    await ctx.route('**/firebasejs/**', r => {
      const u = r.request().url();
      const k = Object.keys(MODULOS).find(k => u.endsWith(k));
      return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(ev => {
      window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }], eventos: [ev] };
    }, EVENTO);
    await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof ST !== 'undefined' && typeof window.renderDocsChecklist === 'function',
      null, { timeout: 25000 });
    await p.waitForTimeout(700);
    await p.evaluate(ev => { ST.eventos = [ev]; ST.view = 'campeonatos'; editEvento(ev.id); }, EVENTO);
    await p.waitForTimeout(400);

    const leer = () => p.evaluate(() => [...document.querySelectorAll('#ef_docs_container input[data-oe-doc]')]
      .map(i => ({ k: i.getAttribute('data-oe-doc'), marcado: i.checked })));

    console.log('\nEn Admin → Campeonatos cada papel de OE tiene su casilla');
    {
      const f = await leer();
      const de = k => f.find(x => x.k === k) || {};
      ok(f.length === 3, 'las tres casillas (' + f.length + ')');
      ok(de('x_oe_ficha').marcado === false, 'la ficha médica sale desmarcada');
      ok(de('x_oe_exoneracion').marcado && de('x_oe_di').marcado, 'las otras dos, marcadas');
    }

    console.log('\nMarcar la ficha se mantiene al redibujar y se guarda');
    {
      await p.evaluate(async () => {
        const i = document.querySelector('#ef_docs_container input[data-oe-doc="x_oe_ficha"]');
        i.checked = true; efOeDocMarcado(i, 'x_oe_ficha');
        render(); await new Promise(r => setTimeout(r, 250));
      });
      const f = await leer();
      ok((f.find(x => x.k === 'x_oe_ficha') || {}).marcado === true, 'sigue marcada después de redibujar');
      const r = await p.evaluate(async () => {
        window.__ESCRITO = [];
        window.confirm = () => true; window.alert = () => {};
        try { await saveEvento(); } catch (e) { return { err: e.message }; }
        const w = (window.__ESCRITO || []).filter(x => x.col === 'eventos').pop();
        return { d: w && w.d };
      });
      const d = r.d || {};
      ok(!r.err, 'guardar no falla' + (r.err ? ': ' + r.err : ''));
      ok(d.oeDocs && d.oeDocs.x_oe_ficha === true, 'el campeonato queda con oeDocs.x_oe_ficha = true');
      ok(Array.isArray(d.requiredDocs) && !d.requiredDocs.some(k => k == null || /^x_oe_/.test(k)),
         'y las casillas de OE no se cuelan en los documentos requeridos (' + JSON.stringify(d.requiredDocs) + ')');
      ok(Array.isArray(d.requiredDocs) && d.requiredDocs.indexOf('carnetIdFront') >= 0, 'el carnet sigue pedido');
    }
    ok(!errs.length, 'el panel sin errores de página' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

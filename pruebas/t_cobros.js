// Admin → Cobros YourLift (solo owner).
//
// Calcula lo que hay que boletear por campeonato (inscritos aprobados × tarifa)
// y por mensualidad, y lleva el registro en cobros/yourlift. Se fija:
//  · que solo el owner tenga el botón y la pantalla,
//  · que cuente una vez a quien tiene dos inscripciones y no cuente pendientes,
//  · los montos con retención de honorarios (15,25%) y con IVA (19%),
//  · que al guardar quede la boleta con su número, y que se pueda marcar pagada,
//  · el PDF de detalle (con el anexo de atletas) y la mensualidad.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cobros.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EVENTO = { id: 'regional_sur_austral_2026', name: 'Regional Sur Austral Noviembre 2026', date: '2026-11-08',
  org: 'Powerlifting Los Toros', status: 'closed' };
const INSCR = [
  { id: 'i1', evento: EVENTO.id, status: 'approved', nombre: 'Ana Pérez', rut: '11.111.111-1', modalidad: 'Powerlifting Classic' },
  { id: 'i2', evento: EVENTO.id, status: 'approved', nombre: 'Ana Pérez', rut: '11111111-1', modalidad: 'Only Bench Classic' },
  { id: 'i3', evento: EVENTO.id, status: 'approved', nombre: 'Bruno Soto', rut: '22.222.222-2', modalidad: 'Powerlifting Classic' },
  { id: 'i4', evento: EVENTO.id, status: 'pending', nombre: 'Carla Ruiz', rut: '33.333.333-3', modalidad: 'Powerlifting Classic' },
  { id: 'i5', evento: 'otro', status: 'approved', nombre: 'Diego Lara', rut: '44.444.444-4', modalidad: 'Powerlifting Classic' },
];

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

async function abrir(b, rol) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, serviceWorkers: 'block' });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(([rol, ev, ins]) => {
    window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: rol }], eventos: [ev], inscripciones: ins };
    // jsPDF de mentira: anota lo que se escribe y el nombre del archivo.
    window.__PDF = { textos: [], archivo: null, paginas: 1 };
    function FakeDoc() {}
    const nada = () => {};
    Object.assign(FakeDoc.prototype, {
      setFillColor: nada, rect: nada, setTextColor: nada, setFont: nada, setFontSize: nada, addImage: nada,
      setDrawColor: nada, line: nada, setLineWidth: nada, setPage: nada,
      text(t) { window.__PDF.textos.push([].concat(t).join(' ')); },
      splitTextToSize(t) { return [t]; },
      addPage() { window.__PDF.paginas++; },
      getNumberOfPages() { return window.__PDF.paginas; },
      save(n) { window.__PDF.archivo = n; },
    });
    window.jspdf = { jsPDF: FakeDoc };
  }, [rol, EVENTO, INSCR]);
  await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo && typeof window.cobroPreparar === 'function',
    null, { timeout: 25000 });
  await p.waitForSelector('.side-btn', { timeout: 25000 });   // el menú ya está dibujado
  await p.waitForTimeout(300);
  return p;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nUn admin que no es owner no ve Cobros');
  {
    const p = await abrir(b, 'admin');
    const boton = await p.evaluate(() => [...document.querySelectorAll('.side-btn')].some(x => /Cobros YourLift/.test(x.textContent)));
    ok(!boton, 'no tiene el botón en el menú');
    await p.evaluate(() => { go('cobros'); });
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => ST.view !== 'cobros'), 'y si entra a la fuerza lo devuelve a otra pantalla');
    ok(!p.errs.length, 'sin errores de página' + (p.errs.length ? ': ' + p.errs[0] : ''));
    await p.context().close();
  }

  const p = await abrir(b, 'owner');
  const escrito = () => p.evaluate(() => (window.__ESCRITO || []).filter(x => x.col === 'cobros').pop());

  console.log('\nEl owner tiene Cobros, con los inscritos de cada campeonato');
  {
    const boton = await p.evaluate(() => [...document.querySelectorAll('.side-btn')].some(x => /Cobros YourLift/.test(x.textContent)));
    ok(boton, 'tiene el botón en el menú');
    await p.evaluate(() => { go('cobros'); });
    await p.waitForFunction(() => ST._cobrosLoaded === true, null, { timeout: 5000 });
    await p.waitForTimeout(100);
    const fila = await p.evaluate(() => {
      const tr = [...document.querySelectorAll('tr')].find(t => /Regional Sur Austral/.test(t.textContent));
      return tr ? tr.innerText : '';
    });
    ok(/Powerlifting Los Toros/.test(fila), 'aparece el campeonato con su organizador');
    const n = await p.evaluate(() => {
      const tr = [...document.querySelectorAll('tr')].find(t => /Regional Sur Austral/.test(t.textContent));
      return tr.querySelectorAll('td')[2].innerText.trim();
    });
    ok(n === '2', 'cuenta 2 atletas: la de dos inscripciones una vez, sin la pendiente ni las de otro campeonato (' + n + ')');
  }

  console.log('\nTarifa y montos');
  {
    await p.evaluate(async () => {
      document.getElementById('cc_tarifa').value = '3000';
      document.getElementById('cc_mensual').value = '50000';
      await cobroCfgGuardar();
    });
    const w = await escrito();
    ok(w && w.id === 'yourlift' && w.d.config.tarifa === 3000 && w.d.config.mensualidad === 50000, 'guarda las tarifas en cobros/yourlift');
    ok(w && w.d.config.retencion === 15.25 && w.d.config.documento === 'honorarios', 'por defecto boleta de honorarios con 15,25% de retención');
  }

  console.log('\nPreparar y registrar la boleta del campeonato');
  {
    await p.evaluate(() => cobroPreparar('regional_sur_austral_2026'));
    await p.waitForTimeout(100);
    const f = await p.evaluate(() => ({ ...ST.cobroForm, texto: document.getElementById('cobro_form').innerText }));
    ok(f.atletas === 2 && f.tarifa === 3000 && f.cliente === 'Powerlifting Los Toros', 'el formulario viene con 2 atletas, la tarifa y el organizador');
    ok(/Servicio plataforma YourLift – Regional Sur Austral Noviembre 2026 \(2 atletas\)/.test(f.texto), 'arma la glosa');
    ok(/Bruto \$6\.000/.test(f.texto) && /\$915/.test(f.texto) && /\$5\.085/.test(f.texto), 'muestra bruto, retención y líquido');
    await p.evaluate(async () => {
      document.getElementById('cb_rut').value = '65.000.000-1';
      document.getElementById('cb_doc').value = 'iva'; cobroRecalcular();
      await new Promise(r => setTimeout(r, 50));
    });
    const conIva = await p.evaluate(() => document.getElementById('cobro_form').innerText);
    ok(/Neto \$6\.000/.test(conIva) && /IVA 19%\s*\$1\.140/.test(conIva) && /Total \$7\.140/.test(conIva), 'con IVA: neto 6.000, IVA 1.140, total 7.140');
    await p.evaluate(async () => {
      document.getElementById('cb_boleta').value = '123';
      await cobroGuardar();
    });
    const w = await escrito();
    const it = w && w.d.items.find(x => x.eventoId === 'regional_sur_austral_2026');
    ok(it && it.boleta === '123' && it.estado === 'emitida', 'queda registrada la boleta N° 123 como emitida');
    ok(it && it.documento === 'iva' && it.total === 7140 && it.clienteRut === '65.000.000-1', 'con IVA, total 7.140 y el RUT del cliente');
    const fila = await p.evaluate(() => [...document.querySelectorAll('tr')].find(t => /Regional Sur Austral/.test(t.textContent)).innerText);
    ok(/BOLETA EMITIDA/.test(fila) && /N° 123/.test(fila) && /\$7\.140/.test(fila), 'la fila muestra el estado, el número y el total');
    await p.evaluate(async () => { await cobroPagado(ST.cobros[0].id, true); });
    const w2 = await escrito();
    ok(w2 && w2.d.items[0].estado === 'pagada' && /^\d{4}-\d{2}-\d{2}$/.test(w2.d.items[0].fechaPago), 'se marca pagada con la fecha del pago');
  }

  console.log('\nEl detalle en PDF');
  {
    await p.evaluate(async () => { await cobroPDF(ST.cobros[0].id); });
    const pdf = await p.evaluate(() => window.__PDF);
    ok(pdf.archivo === 'Cobro_YourLift_Regional_Sur_Austral_Noviembre_2026.pdf', 'se descarga con el nombre del campeonato');
    ok(pdf.textos.some(t => /DETALLE DE COBRO/.test(t)) && pdf.textos.includes('$7.140'), 'trae el título y el total');
    ok(pdf.textos.some(t => /Atletas considerados \(2\)/.test(t)) && pdf.textos.includes('1. Ana Pérez'), 'y el anexo con los atletas cobrados');
  }

  console.log('\nMensualidad de FECHIPO');
  {
    await p.evaluate(async () => {
      cobroMensualidad(); await new Promise(r => setTimeout(r, 50));
      document.getElementById('cb_mes').value = '2026-10';
      document.getElementById('cb_boleta').value = '124';
      await cobroGuardar();
    });
    const w = await escrito();
    const it = w && w.d.items.find(x => x.tipo === 'mensualidad');
    ok(it && it.cliente === 'FECHIPO' && it.mes === '2026-10' && it.monto === 50000 && it.boleta === '124', 'queda la mensualidad de octubre por 50.000 con su boleta');
    ok(it && /Mensualidad plataforma YourLift – octubre 2026/.test(it.glosa), 'con su glosa');
    const total = await p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent.trim() === 'BOLETEADO').parentElement.innerText);
    ok(/\$57\.140/.test(total), 'el total boleteado suma las dos (7.140 + 50.000 con honorarios)');
  }
  ok(!p.errs.length, 'sin errores de página' + (p.errs.length ? ': ' + p.errs[0] : ''));
  // FOTO=archivo.png guarda cómo quedó la pantalla (para mirarla, no se compara).
  if (process.env.FOTO) { await p.evaluate(() => cobroPreparar('regional_sur_austral_2026')); await p.waitForTimeout(200);
    await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: process.env.FOTO, fullPage: true }); }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

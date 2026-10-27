// Admin → Cobros YourLift (solo owner).
//
// Lo que YourLift SpA cobra por campeonato (inscritos aprobados × tarifa) y por
// mensualidad, con el registro en cobros/yourlift. Se fija:
//  · que solo el owner tenga el botón y la pantalla,
//  · que cuente una vez a quien tiene dos inscripciones y no cuente pendientes,
//  · los montos: factura con IVA 19% por defecto, y honorarios con retención,
//  · lo que se copia para el formulario del SII,
//  · que al guardar quede el documento con su número, y que se pueda marcar pagado,
//  · el cobro en PDF (empresa, transferencia, anexo de atletas), la mensualidad,
//  · que los datos del cliente se reusen en su próximo cobro, y el resumen del F29.
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
  { id: 'i6', evento: 'copa_toros_2026', status: 'approved', nombre: 'Elisa Mora', rut: '55.555.555-5', modalidad: 'Powerlifting Classic' },
];
// Otro campeonato del mismo organizador: su cobro debe traer los datos del cliente ya escritos.
const EVENTO2 = { id: 'copa_toros_2026', name: 'Copa Los Toros 2026', date: '2026-09-20', org: 'Powerlifting Los Toros', status: 'closed' };

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
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, serviceWorkers: 'block',
    permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.route('**/firebasejs/**', r => {
    const u = r.request().url();
    const k = Object.keys(MODULOS).find(k => u.endsWith(k));
    return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
  });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(([rol, ev, ins]) => {
    window.__FAKE = { admins: [{ id: 'u1', email: 'x@y.cl', role: rol }], eventos: ev, inscripciones: ins };
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
  }, [rol, [EVENTO, EVENTO2], INSCR]);
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

  console.log('\nTarifas y datos de la empresa');
  {
    await p.evaluate(async () => {
      const pon = (id, v) => { document.getElementById(id).value = v; };
      pon('cc_tarifa', '3000'); pon('cc_mensual', '50000');
      pon('ce_rut', '77.000.000-7'); pon('ce_giro', 'Servicios de software');
      pon('cbk_banco', 'Banco de Prueba'); pon('cbk_num', '12345678');
      await cobroCfgGuardar();
    });
    const w = await escrito();
    ok(w && w.id === 'yourlift' && w.d.config.tarifa === 3000 && w.d.config.mensualidad === 50000, 'guarda las tarifas en cobros/yourlift');
    ok(w && w.d.config.documento === 'factura' && w.d.config.iva === 19, 'por defecto factura electrónica con IVA 19%');
    ok(w && w.d.config.emisor.razon === 'YourLift SpA' && w.d.config.emisor.rut === '77.000.000-7' && w.d.config.banco.numero === '12345678',
      'y los datos de la SpA y de la cuenta');
  }

  console.log('\nLa guía: cómo facturar y pagar el IVA');
  {
    await p.evaluate(() => render());
    const g = await p.evaluate(() => { const d = document.getElementById('cobro_guia'); return d ? { abierta: d.open, t: d.textContent } : null; });
    ok(g && g.abierta, 'está en la pantalla, abierta mientras no se haya emitido nada');
    ok(g && /factura electrónica del SII/.test(g.t) && /No va boleta de honorarios/.test(g.t) && /no es el documento tributario/.test(g.t),
      'dice qué documento emitir (y que el PDF no lo reemplaza)');
    ok(g && /\$300\.000/.test(g.t) && /\$57\.000/.test(g.t) && /\$357\.000/.test(g.t), 'con la tarifa guardada: 100 atletas = $300.000 + $57.000 de IVA');
    ok(g && /\$252\.101/.test(g.t) && /\$47\.899/.test(g.t) && /\$2\.521/.test(g.t), 'y si los $3.000 son con IVA incluido: neto $252.101, IVA $47.899, tarifa neta $2.521');
    ok(g && /Preparar cobro/.test(g.t) && /Copiar datos para el SII/.test(g.t) && /Marcar pagado/.test(g.t), 'los pasos nombran los botones de esta pantalla');
    ok(g && /día 20/.test(g.t) && /503/.test(g.t) && /502/.test(g.t) && /sin movimiento/.test(g.t), 'y cómo declarar el IVA en el F29');
    await p.evaluate(() => { const d = document.getElementById('cobro_guia'); d.open = false; d.dispatchEvent(new Event('toggle')); render(); });
    ok(await p.evaluate(() => !document.getElementById('cobro_guia').open), 'si se cierra, queda cerrada');
  }

  console.log('\nPreparar y registrar la factura del campeonato');
  {
    await p.evaluate(() => cobroPreparar('regional_sur_austral_2026'));
    await p.waitForTimeout(100);
    const f = await p.evaluate(() => ({ ...ST.cobroForm, texto: document.getElementById('cobro_form').innerText }));
    ok(f.atletas === 2 && f.tarifa === 3000 && f.cliente === 'Powerlifting Los Toros' && f.documento === 'factura',
      'el formulario viene con 2 atletas, la tarifa, el organizador y factura');
    ok(/Servicio plataforma YourLift – Regional Sur Austral Noviembre 2026 \(2 atletas\)/.test(f.texto), 'arma la glosa');
    ok(/Neto \$6\.000/.test(f.texto) && /IVA 19%\s*\$1\.140/.test(f.texto) && /Total \$7\.140/.test(f.texto), 'neto 6.000 + IVA 1.140 = total 7.140');
    await p.evaluate(async () => {
      document.getElementById('cb_doc').value = 'honorarios'; cobroRecalcular();
      await new Promise(r => setTimeout(r, 50));
    });
    const hon = await p.evaluate(() => document.getElementById('cobro_form').innerText);
    ok(/Bruto \$6\.000/.test(hon) && /\$915/.test(hon) && /\$5\.085/.test(hon), 'con boleta de honorarios: bruto, retención 15,25% y líquido');
    await p.evaluate(async () => {
      document.getElementById('cb_doc').value = 'factura'; cobroRecalcular();
      await new Promise(r => setTimeout(r, 50));
      const pon = (id, v) => { document.getElementById(id).value = v; };
      pon('cb_rut', '65.000.000-1'); pon('cb_giro', 'Club deportivo'); pon('cb_dir', 'Av. Siempre Viva 123, Punta Arenas');
    });
    await p.evaluate(() => cobroCopiar());
    const copia = await p.evaluate(() => navigator.clipboard.readText());
    ok(/Documento: Factura electrónica/.test(copia) && /RUT receptor: 65\.000\.000-1/.test(copia) && /Giro: Club deportivo/.test(copia)
      && /Cantidad: 2 {3}Precio unitario \(neto\): \$3\.000/.test(copia) && /Neto: \$6\.000 {3}IVA 19%: \$1\.140 {3}Total: \$7\.140/.test(copia),
      'copia para el SII el receptor, el detalle, la cantidad, el precio neto y los montos');
    await p.evaluate(async () => {
      document.getElementById('cb_boleta').value = '123';
      await cobroGuardar();
    });
    const w = await escrito();
    const it = w && w.d.items.find(x => x.eventoId === 'regional_sur_austral_2026');
    ok(it && it.boleta === '123' && it.estado === 'emitida', 'queda registrada la factura N° 123 como emitida');
    ok(it && it.documento === 'factura' && it.bruto === 6000 && it.impuesto === 1140 && it.total === 7140 && it.clienteRut === '65.000.000-1',
      'con neto, IVA, total y el RUT del cliente');
    const fila = await p.evaluate(() => [...document.querySelectorAll('tr')].find(t => /Regional Sur Austral/.test(t.textContent)).innerText);
    ok(/EMITIDO/.test(fila) && /Factura electrónica N° 123/.test(fila) && /\$7\.140/.test(fila), 'la fila muestra el estado, el documento y el total');
    await p.evaluate(async () => { await cobroPagado(ST.cobros[0].id, true); });
    const w2 = await escrito();
    ok(w2 && w2.d.items[0].estado === 'pagada' && /^\d{4}-\d{2}-\d{2}$/.test(w2.d.items[0].fechaPago), 'se marca pagado con la fecha del pago');
  }

  console.log('\nEl cobro en PDF');
  {
    await p.evaluate(async () => { await cobroPDF(ST.cobros[0].id); });
    const pdf = await p.evaluate(() => window.__PDF);
    ok(pdf.archivo === 'Cobro_YourLift_Regional_Sur_Austral_Noviembre_2026.pdf', 'se descarga con el nombre del campeonato');
    ok(pdf.textos.includes('COBRO') && pdf.textos.includes('YourLift SpA') && pdf.textos.includes('RUT 77.000.000-7'), 'trae el título y los datos de la SpA');
    ok(pdf.textos.includes('Factura electrónica N° 123') && pdf.textos.includes('$1.140') && pdf.textos.includes('$7.140'), 'el documento, el IVA y el total');
    ok(pdf.textos.includes('DATOS PARA TRANSFERENCIA') && pdf.textos.includes('12345678') && pdf.textos.includes('Banco de Prueba'), 'dónde transferir');
    ok(pdf.textos.some(t => /Atletas considerados \(2\)/.test(t)) && pdf.textos.includes('1. Ana Pérez'), 'y el anexo con los atletas cobrados');
  }

  console.log('\nLos datos del cliente se reusan');
  {
    await p.evaluate(() => cobroPreparar('copa_toros_2026'));
    await p.waitForTimeout(100);
    const v = await p.evaluate(() => ['cb_rut', 'cb_giro', 'cb_dir'].map(id => document.getElementById(id).value));
    ok(v[0] === '65.000.000-1' && v[1] === 'Club deportivo' && /Punta Arenas/.test(v[2]), 'otro campeonato del mismo organizador trae su RUT, giro y dirección');
    await p.evaluate(() => cobroCerrarForm());
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
    ok(it && it.cliente === 'FECHIPO' && it.mes === '2026-10' && it.monto === 50000 && it.total === 59500 && it.boleta === '124',
      'queda la mensualidad de octubre: 50.000 + IVA = 59.500, factura N° 124');
    ok(it && /Mensualidad plataforma YourLift – octubre 2026/.test(it.glosa), 'con su glosa');
    const total = await p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent.trim() === 'EMITIDO').parentElement.innerText);
    ok(/\$66\.640/.test(total), 'el total emitido suma las dos (7.140 + 59.500)');
  }

  console.log('\nResumen para el F29');
  {
    const t = await p.evaluate(() => document.getElementById('cobro_f29').innerText);
    const fac = (t.split('\n').find(l => /^Facturas emitidas/.test(l)) || '');
    ok(/\t2\t\$56\.000\t\$10\.640/.test(fac), 'el mes de emisión: 2 facturas, neto 56.000, IVA débito 10.640 (' + fac.replace(/\t/g, ' | ') + ')');
    await p.evaluate(() => cobroF29Mes('2020-01'));
    const t2 = await p.evaluate(() => document.getElementById('cobro_f29').innerText);
    ok(/Total del mes\t0\t\$0\t\$0/.test(t2), 'otro mes queda en cero');
    await p.evaluate(() => cobroF29Mes(''));
  }
  ok(!p.errs.length, 'sin errores de página' + (p.errs.length ? ': ' + p.errs[0] : ''));
  // FOTO=archivo.png guarda cómo quedó la pantalla (para mirarla, no se compara).
  if (process.env.FOTO) { await p.evaluate(() => cobroPreparar('regional_sur_austral_2026')); await p.waitForTimeout(200);
    await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: process.env.FOTO, fullPage: true }); }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

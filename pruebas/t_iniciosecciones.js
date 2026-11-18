// Inicio: el owner elige en Admin → Portada qué bloques van abajo de la foto:
// próximos campeonatos, personas que siguieron la competencia, campeonatos (lo
// último), récords y totales (top 5 GL).
//
// Lo que se cuida:
//   · sin elegir nada, el inicio queda como antes (próximos, lo último y top 5);
//   · cada bloque aparece o no según lo marcado, y en su orden;
//   · "campeonatos" carga aunque "totales" esté apagado (comparten la carga);
//   · los récords recientes son los de fecha más nueva;
//   · "personas" muestra solo lo publicado y no deja un bloque vacío;
//   · el livecast cuenta a cada equipo una vez por campeonato, sin datos de la
//     persona, y no cuenta a la mesa;
//   · el panel tiene los cinco interruptores, la lista con lo medido y guarda
//     todo en site_backgrounds/portada.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_iniciosecciones.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MODULOS_ADMIN = {
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
    export const setDoc=async(r,d)=>{(globalThis.__SET=globalThis.__SET||[]).push({ruta:r.__n+'/'+r.__i,d:JSON.parse(JSON.stringify(d))});};
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
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const errs = [];

  console.log('\nEl inicio del sitio');
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('sitio: ' + e.message));
    await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof render === 'function' && typeof _inicioSecciones === 'function' && typeof ST !== 'undefined' && document.querySelector('.yl-hero'), null, { timeout: 20000 });
    await p.waitForTimeout(800);
    const pintar = async (portada) => p.evaluate((pt) => {
      window._BG_SETTINGS = Object.assign({}, window._BG_SETTINGS || {}, { portada: pt });
      ST.v = 'home'; render();
      return [...document.querySelectorAll('section.yl-sec')].map(s => s.id);
    }, portada);
    let ids = await pintar({});
    ok(JSON.stringify(ids) === JSON.stringify(['ylProx', 'ylUltimo', 'ylLideres']), 'sin elegir nada queda como antes: ' + ids.join(', '));
    // Récords de prueba (con y sin fecha)
    await p.evaluate(() => {
      R = { classic: { sq: [
        { nombre: 'Atleta Vieja Uno', division: 'Open', categoria: '63', campeonato: 'Nacional 2024', marca: 150, fecha: '2024-05-01' },
        { nombre: 'Atleta Nueva Dos', division: 'Junior', categoria: '93', campeonato: 'Regional Centro FECHIPO 2026', marca: 250.5, fecha: '2026-11-21' },
        { nombre: 'Sin Fecha Tres', division: 'Open', categoria: '74', campeonato: 'Algo', marca: 300 }] },
        equipped: { total: [{ nombre: 'Atleta Media Cuatro', division: 'Open', categoria: '84', campeonato: 'Nacional Equipado 2025', marca: 600, fecha: '2025-10-10' }] } };
    });
    ids = await pintar({ secciones: { proximos: true, campeonatos: true, totales: true, records: true, publico: true },
      publico: [{ id: 'regional_centro_2026', nombre: '“Primavera Open” Regional Centro Noviembre 2026', fecha: '2026-11-21', personas: 1234 }] });
    ok(JSON.stringify(ids) === JSON.stringify(['ylProx', 'ylPublico', 'ylUltimo', 'ylRecords', 'ylLideres']), 'todo marcado, en orden: ' + ids.join(', '));
    const txt = await p.evaluate(() => ({ pub: document.getElementById('ylPublico').innerText, rec: document.getElementById('ylRecords').innerText }));
    ok(/Personas que siguieron la competencia/i.test(txt.pub) && /1\.234/.test(txt.pub) && /personas/i.test(txt.pub) && /21 nov 2026/i.test(txt.pub), 'personas: el campeonato, su fecha y 1.234 personas' + (/1\.234/.test(txt.pub) ? '' : ' → ' + JSON.stringify(txt.pub)));
    ok(/Récords recientes/.test(txt.rec) && txt.rec.indexOf('Nueva') < txt.rec.indexOf('Media') && txt.rec.indexOf('Media') < txt.rec.indexOf('Vieja'), 'récords: del más nuevo al más viejo');
    ok(!/Sin Fecha/.test(txt.rec) && /250,5/.test(txt.rec) && /récord de sentadilla/.test(txt.rec) && /récord de total/.test(txt.rec) && /Equipado/.test(txt.rec), 'solo los que tienen fecha, con marca, movimiento y modalidad');
    ids = await pintar({ secciones: { proximos: false, campeonatos: true, totales: false, records: false, publico: true }, publico: [] });
    ok(JSON.stringify(ids) === JSON.stringify(['ylUltimo']), 'solo campeonatos (y "personas" sin nada publicado no deja un bloque vacío): ' + ids.join(', '));
    await p.waitForFunction(() => typeof _LID !== 'undefined' && _LID.ult, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(500);
    ok(await p.evaluate(() => /Lo último/.test((document.getElementById('ylUltimo') || {}).innerText || '')), '"campeonatos" se carga aunque "totales" esté apagado');
    ids = await pintar({ secciones: { proximos: false, campeonatos: false, totales: true, records: false, publico: false } });
    ok(JSON.stringify(ids) === JSON.stringify(['ylLideres']), 'solo totales: ' + ids.join(', '));
    await ctx.close();
  }

  console.log('\nEl livecast cuenta a quien sigue la competencia');
  {
    const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026', canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };
    const red = crearRed({ subida: [50, 150], bajada: [50, 150] });
    const ath = [1, 2, 3, 4].map(i => ({ id: i, lot: i, name: 'Atleta Prueba ' + i, flight: 'A', sex: 'Hombre', cat: '83', div: 'Open', mod: 'classic', bw: 80, club: 'Club',
      att: { sq: [{ w: 100 + i, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }));
    red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(ath), flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: false, forcedCurrent: null, timer: 60, timerOn: false, writer: 'semilla' });
    const datos = () => ({ eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
      inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [], admins: [{ id: 'u', role: 'admin' }] });
    async function abrir(nombre, url, auth) {
      const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await red.montar(ctx, p, { nombre, auth, datos: datos() });
      await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 4, null, { timeout: 25000 });
      return p;
    }
    const d = new Date(), ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const mesa = await abrir('mesa', 'livecast.html?evento=' + EV.id + '&controller=1', true);
    await mesa.evaluate(() => { DATA.phase = 'compete'; R(); });
    const publico = await abrir('publico', 'livecast.html?evento=' + EV.id, false);
    await publico.evaluate(() => { DATA.phase = 'liveView'; R(); });
    await red.calma(1500);
    const doc = red.leer('analytics_daily/' + ymd);
    ok(doc && doc.lc && doc.lc[EV.id] && doc.lc_u && doc.lc_u[EV.id] && doc.date === ymd, 'el público que abre la Competencia en Vivo queda contado (vez y equipo nuevo) en analytics_daily/' + ymd);
    ok(doc && Object.keys(doc).every(k => ['date', 'lc', 'lc_u'].includes(k)), 'sin nada de la persona: solo la fecha y los contadores (' + (doc ? Object.keys(doc).join(',') : '-') + ')');
    ok(red.log.filter(x => /^analytics_daily\//.test(x.ruta)).every(x => x.quien === 'publico'), 'la mesa no cuenta');
    // El mismo equipo vuelve a abrir: cuenta la vez, no como persona nueva
    const p2 = await publico.evaluate(async (id) => {
      // window._fb puede ser el módulo (no se le pueden cambiar funciones): se
      // espía con una copia y se devuelve el original al final.
      const orig = window._fb, vistos = [];
      window._fb = Object.assign({}, orig, { setDoc: (r, d, o) => { vistos.push(JSON.parse(JSON.stringify(d))); return orig.setDoc(r, d, o); } });
      delete _lcContado[id]; _contarEspectador();
      await new Promise(r => setTimeout(r, 300));
      window._fb = orig;
      return vistos;
    }, EV.id);
    ok(p2.length === 1 && p2[0].lc && !p2[0].lc_u, 'el mismo equipo otra vez suma una apertura, no una persona nueva' + ' → ' + JSON.stringify(p2));
    const n = await publico.evaluate(async () => { const o = window._fb; let c = 0; window._fb = Object.assign({}, o, { setDoc: (...a) => { if (/analytics/.test(JSON.stringify(a[0]))) c++; return o.setDoc(...a); } }); R(); R(); await new Promise(r => setTimeout(r, 300)); window._fb = o; return c; });
    ok(n === 0, 'redibujar la página no vuelve a contar');
  }

  console.log('\nEl panel: Admin → Portada');
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
    await ctx.route('**/firebasejs/**', r => {
      const u = r.request().url(); const k = Object.keys(MODULOS_ADMIN).find(k => u.endsWith(k));
      return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS_ADMIN[k] }) : r.abort();
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('panel: ' + e.message));
    await p.addInitScript(() => { window.__FAKE = {
      admins: [{ id: 'u1', email: 'x@y.cl', role: 'owner' }],
      site_backgrounds: [{ id: 'portada', intervalo: 6, fotos: [{ url: '' }], secciones: { records: true } }],
      eventos: [{ id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026', date: '2026-11-21', status: 'closed' },
        { id: 'osorno_2026', name: 'Regional Sur Austral 2026', date: '2026-11-08', status: 'closed' }],
      analytics_daily: [{ id: '2026-11-21', date: '2026-11-21', lc_u: { regional_centro_2026: 300 }, lc: { regional_centro_2026: 900 } },
        { id: '2026-11-22', date: '2026-11-22', lc_u: { regional_centro_2026: 120 }, lc: { regional_centro_2026: 400 } }] }; });
    await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(600);
    await p.evaluate(() => go('portada'));
    await p.waitForFunction(() => /QUÉ SE VE EN EL INICIO/.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
    const v = await p.evaluate(() => {
      const t = document.body.innerText;
      const cajas = [...document.querySelectorAll('input[type=checkbox][onchange^="ptSec"]')];
      return { t, n: cajas.length, marcadas: cajas.filter(c => c.checked).map(c => c.getAttribute('onchange').match(/'(\w+)'/)[1]) };
    });
    ok(v.n === 5 && /Próximos campeonatos/.test(v.t) && /Personas que siguieron la competencia/.test(v.t) && /Campeonatos/.test(v.t) && /Récords/.test(v.t) && /Totales/.test(v.t), 'los cinco interruptores');
    ok(JSON.stringify(v.marcadas) === JSON.stringify(['proximos', 'campeonatos', 'records', 'totales']), 'abre con lo guardado (récords) y lo de siempre marcado: ' + v.marcadas.join(','));
    await p.evaluate(() => ptSec('publico', true));
    await p.waitForTimeout(400);
    const t2 = await p.evaluate(() => document.body.innerText);
    ok(/medido: 420 personas/.test(t2), 'con "personas" marcado, lista los campeonatos con lo medido (300 + 120 = 420)');
    ok(/Regional Sur Austral 2026/.test(t2) && /sin medición/.test(t2), 'y también los anteriores, sin medición, para escribir la cifra a mano');
    await p.evaluate(() => { ptPubSel('regional_centro_2026', true); });
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => ST.portada.publico[0] && ST.portada.publico[0].personas) === 420, 'al marcarlo toma lo medido');
    await p.evaluate(() => { ptPubSel('osorno_2026', true); ptPubNum('osorno_2026', '850'); ptSec('totales', false); });
    await p.evaluate(() => ptSave());
    await p.waitForTimeout(500);
    const g = await p.evaluate(() => (window.__SET || []).filter(x => x.ruta === 'site_backgrounds/portada').pop());
    ok(g && g.d.secciones && g.d.secciones.publico === true && g.d.secciones.totales === false && g.d.secciones.records === true, 'guarda los interruptores');
    ok(g && JSON.stringify(g.d.publico.map(x => [x.id, x.personas])) === JSON.stringify([['regional_centro_2026', 420], ['osorno_2026', 850]]), 'y lo que se publica de personas (medido o escrito a mano)');
    ok(g && g.d.fotos && g.d.fotos.length === 1, 'sin tocar las fotos');
    await ctx.close();
  }

  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

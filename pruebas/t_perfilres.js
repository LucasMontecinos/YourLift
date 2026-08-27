// Los resultados publicados desde el livecast tienen que aparecer en la ficha del
// atleta, también cuando el navegador ya tiene la caché caliente.
//
// El bug: los overlays de Firestore (resultados de competencias cerradas, fotos,
// logros, posiciones) buscan al atleta dentro de DB, que sale de data.json. Cuando
// venían de la caché del navegador se aplicaban al toque — antes de que data.json
// terminara de bajar — no encontraban a nadie y se perdían sin reintento. Por eso
// a Benjamín García no le aparecía el Regional Centro Sur aunque el resultado sí
// estaba publicado: cargando de cero funcionaba, y al volver a entrar dentro de
// los 10 minutos de caché, no.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_perfilres.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../atleta.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// El resultado tal cual lo dejó el livecast al cerrar el Regional Centro Sur.
const RESULTADO = {
  id: 'doc1', source: 'yourlift_livecast', view: 'meet', codigo: '', rut: '21523046-5',
  nombre: 'Benjamin Ignacio García Pino', club: 'Hannya Strength', sexo: 'Masculino',
  division: 'Junior', categoria: '93', modalidad: 'Powerlifting Classic',
  evento: 'Campeonato Regional CENTRO SUR  FECHIPO 2026', evento_id: 'regionalcentrosur',
  fecha: '2026-08-09',
  resultado: { bw: 89.71, sq: 280, bp: 175, dl: 295, total: 750, glp: 99.87, status: 'OK' },
};

// Stub del SDK de Firebase: desde acá no se llega a gstatic, y además queremos
// controlar qué devuelve cada colección para reproducir el caso exacto.
const STUB = `
export function initializeApp(){return{};}
export function getFirestore(){return{};}
export function collection(db,n){return{n};}
export function doc(){return{};}
export async function getDoc(){return{exists:()=>false,data:()=>({})};}
export async function getDocs(c){return{docs:[]};}
export function query(){return{};}
export function where(){return{};}
`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  async function abrir() {
    // Sin service worker: el de atleta.html toma el control de la página a
    // medio cargar y deja la carga colgada contra el servidor local.
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    // Caché caliente: es la situación en la que fallaba.
    await ctx.addInitScript(r => {
      localStorage.setItem('_yfc_atl_res', JSON.stringify({ ts: Date.now(), d: [r] }));
    }, RESULTADO);
    const p = await ctx.newPage();
    await p.route('**/firebasejs/**', route =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8972/atleta.html?codigo=2152BGP-2024', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => {
      const el = document.getElementById('profileSection');
      return el && el.style.display !== 'none' && /Benjamin/i.test(el.innerText);
    }, null, { timeout: 40000 });
    return { p, errs };
  }

  console.log('\nCon la caché caliente, el resultado igual llega a la ficha');
  const { p, errs } = await abrir();
  const t = await p.evaluate(() => document.getElementById('profileSection').innerText);
  ok(/CENTRO SUR/i.test(t), 'aparece el Regional Centro Sur en el historial');
  ok(/750 kg/.test(t), 'con su total: 750 kg');
  ok(/SQ 280/.test(t) && /BP 175/.test(t) && /DL 295/.test(t), 'y los tres levantamientos');
  const n = await p.evaluate(() => (document.querySelector('#profileSection .sec-title')
    ? [...document.querySelectorAll('#profileSection .sec-title')]
        .map(e => e.textContent).find(x => /Historial/i.test(x)) : ''));
  // En data.json tiene 4 competencias, pero una (Nacional 2026) todavía no trae
  // resultado y el historial solo lista las que tienen. Antes se veían 3.
  ok(/\(4\)/.test(n || ''), 'pasa de 3 a 4 competencias en el historial: ' + n);

  console.log('\nY no se le inventa un atleta aparte');
  const dobles = await p.evaluate(() => document.getElementById('profileSection').innerText.match(/CENTRO SUR/gi) || []);
  ok(dobles.length === 1, 'la competencia sale una sola vez');

  console.log('\nLos mejores levantamientos se actualizan solos');
  ok(/280/.test(t), 'el PR de sentadilla toma el 280 nuevo');

  console.log('\nLa cola espera a data.json y se suelta una sola vez');
  ok(/window\._DB_LISTA=false;/.test(src), 'arranca marcada como no lista');
  ok(/if\(cr\)\{_conDB\(\(\)=>_applyResults\(cr\)\);\}/.test(src), 'los resultados se encolan');
  ok(/_conDB\(\(\)=>_applyFotos/.test(src), 'las fotos también');
  ok(/_conDB\(\(\)=>_applyAch/.test(src), 'los logros también');
  ok(/_conDB\(\(\)=>_applyPos/.test(src), 'y las posiciones');
  // Tiene que soltarse DESPUÉS de las altas pendientes y las ediciones del admin:
  // esas pueden cambiarle el código o el RUT al atleta, y el resultado matchea por ahí.
  const iEdits = src.indexOf("catch(ee){console.warn('[athlete_edits]'");
  const iFlush = src.indexOf('_dbLista();', iEdits);
  ok(iEdits > 0 && iFlush > iEdits, 'se suelta después de aplicar las ediciones del admin');
  ok(/if\(!window\._DB_LISTA\)_dbLista\(\);/.test(src), 'y si data.json falla, igual se suelta');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

// Escribir en un buscador sin que se cierre el teclado.
//
// En el teléfono, escribir en Admin → Atletas era imposible: con cada letra el
// teclado se cerraba y se volvía a abrir.
//
// La causa no era el teclado ni el teléfono. Cada letra disparaba un redibujado
// de la PANTALLA ENTERA, y eso destruye el campo de texto y crea uno nuevo. Un
// campo que muere pierde el foco, y sin foco el teclado del sistema se cierra.
// Había un intento de arreglo —devolver el foco por programa después de
// redibujar— que no podía funcionar: para cuando corre, el campo original ya no
// existe, así que el teclado ya se cerró y lo que se ve es el parpadeo.
//
// El arreglo de verdad es no tocar el campo: se dibuja una vez y lo único que se
// rehace es la lista de resultados.
//
// Buscando la causa apareció que la vista "Atletas" del inicio no usa el
// buscador que tiene index.html escrito —ese quedó sin uso— sino atleta.html
// embebido. Esta prueba mide el que de verdad se usa.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_teclado.js
const fs = require('fs');
const { chromium } = require('playwright');
const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

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
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  // Sin service worker: se mete a medio cargar y deja la página colgada.
  const ctx = await b.newContext({ viewport: { width: 420, height: 860 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', route =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
  await p.goto('http://localhost:8972/atleta.html', { waitUntil: 'domcontentloaded' });
  // DB vive dentro de un <script type="module">, así que no se ve desde acá.
  // La página avisa que ya cargó el padrón poniendo _DB_LISTA en window.
  await p.waitForFunction(() => window._DB_LISTA === true, null, { timeout: 30000 });

  console.log('\nEl buscador de atletas —el que se usa desde el inicio—');
  {
    // Se marca el campo para reconocerlo después: si el redibujado lo destruye,
    // la marca se pierde con él.
    await p.evaluate(() => { document.getElementById('sInput')._marca = 'el-mismo'; });
    await (await p.$('#sInput')).click();
    await p.keyboard.type('garcia', { delay: 60 });
    await p.waitForTimeout(400);

    const r = await p.evaluate(() => {
      const el = document.getElementById('sInput');
      return {
        mismoNodo: !!(el && el._marca === 'el-mismo'),
        enfocado: document.activeElement === el,
        valor: el ? el.value : null,
        cursor: el ? el.selectionStart : null,
        resultados: document.querySelectorAll('#sResults .result-item').length,
      };
    });
    ok(r.mismoNodo, 'el campo es EL MISMO de antes: no se destruyó ni se recreó');
    ok(r.enfocado, 'y sigue enfocado — que es lo que mantiene el teclado abierto');
    ok(r.valor === 'garcia', 'con el texto completo: "' + r.valor + '"');
    ok(r.cursor === 6, 'y el cursor al final, sin saltar (posición ' + r.cursor + ')');
    ok(r.resultados > 0, 'y buscó de verdad: ' + r.resultados + ' resultados');
  }

  console.log('\n  Escribiendo rápido no se pierde ninguna letra');
  {
    await p.evaluate(() => { const el = document.getElementById('sInput'); el.value = ''; el.focus(); });
    await p.keyboard.type('montecinos', { delay: 12 });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const el = document.getElementById('sInput');
      return { valor: el.value, enfocado: document.activeElement === el, marca: el._marca };
    });
    ok(r.valor === 'montecinos', 'quedó "montecinos" entero');
    ok(r.enfocado && r.marca === 'el-mismo', 'y el campo sigue siendo el mismo, enfocado');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\nEl buscador del panel: la tabla se repinta sola, el campo no se toca');
  {
    const sd = adm.slice(adm.indexOf('window.searchDebounced=function'), adm.indexOf('window.atlLetra=function'));
    ok(/atlTabla/.test(sd), 'repinta solo la tabla de atletas');
    ok(!/inp\.focus\(\)/.test(sd),
       'y ya no devuelve el foco a mano: no hace falta, el campo nunca se pierde');
    ok(/function _atletasTablaHtml\(\)/.test(adm), 'la tabla se dibuja aparte del buscador');
    ok(/id="atlTabla"/.test(adm) && /id="atlBuscar"/.test(adm),
       'y cada uno tiene su contenedor');
    // Las letras del costado filtran la misma tabla: tampoco pueden redibujar todo.
    ok(/window\.atlLetra=function/.test(adm) && !/ST\.filterLetter='';render\(\)/.test(adm),
       'las letras del costado también repintan solo la tabla');
  }

  console.log('\n  Y el buscador de nóminas del inicio, igual');
  {
    const nomFn = idx.slice(idx.indexOf('function nomQ(v){'), idx.indexOf('function nomQ(v){') + 700);
    ok(/nomLista/.test(nomFn), 'repinta solo la lista');
    ok(!/document\.querySelectorAll\('\.nomq input'\)/.test(nomFn),
       'y ya no anda persiguiendo el campo para devolverle el foco');
    ok(/id="nomFiltros"/.test(idx) && /id="nomLista"/.test(idx),
       'el campo vive fuera de lo que se repinta');
    ok(/const NOM_CORTE=/.test(idx),
       'con una marca que separa lo que no se toca de lo que sí');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

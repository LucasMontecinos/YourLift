// "Competencias pasadas": el acta que se baja del livecast se sube en admin y
// queda para descargar en yourlift.cl.
//
// Se prueban las dos puntas: que el sitio muestre las actas publicadas (y solo
// esas), y que el admin detecte bien qué campeonatos ya pasaron.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_pasadas.js
const fs = require('fs');
const { chromium } = require('playwright');
const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Fichas como las que deja el admin en Firestore.
const FICHAS = [
  { id: 'regionalcentrosur', name: 'Campeonato Regional CENTRO SUR FECHIPO 2026',
    fecha: '2026-08-08', lugar: 'San Pedro de la Paz', logoUrl: '', publicado: true,
    docs: [ { nombre: 'Acta oficial', archivo: 'Acta_CentroSur.pdf', url: 'https://ejemplo/a.pdf', tamano: 240000 },
            { nombre: 'Acta en Excel', archivo: 'Acta_CentroSur.xlsx', url: 'https://ejemplo/a.xlsx', tamano: 51200 } ] },
  { id: 'nacional2025', name: 'Nacional FECHIPO 2025', fecha: '2025-11-15', lugar: 'Santiago',
    logoUrl: '', publicado: true, docs: [ { nombre: 'Acta', archivo: 'Acta.pdf', url: 'https://ejemplo/n.pdf', tamano: 1048576 } ] },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // Sin service worker: esta página registra /sw.js y el worker toma el
  // control a medio cargar, dejando la carga colgada contra el servidor local.
  const p = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/index.html', { waitUntil: 'domcontentloaded' });
  // renderPasadasPub vive DENTRO de render() (así está armado index.html), así que
  // no se la puede llamar desde afuera: se navega a la sección como lo hace la gente.
  await p.waitForFunction(() => typeof sv === 'function' && typeof ST === 'object', null, { timeout: 25000 });
  const ver = (fichas) => p.evaluate(f => {
    if (f === null) delete window.COMPES_PASADAS; else window.COMPES_PASADAS = f;
    sv('pasadas');
    return document.getElementById('app').innerHTML;
  }, fichas);

  console.log('\nLa opción está en la hamburguesa');
  const menu = await p.evaluate(() => { buildMenu(); return [...document.querySelectorAll('#menuItems .mi')].map(e => e.textContent.trim()); });
  ok(menu.includes('Competencias pasadas'), 'aparece "Competencias pasadas"');
  ok(menu.indexOf('Competencias pasadas') === menu.indexOf('Competencia en Vivo') + 1,
     'va justo después de "Competencia en Vivo": ' + menu.slice(1, 5).join(' · '));

  console.log('\nMientras carga no dice que no hay nada');
  const cargando = await ver(null);
  ok(/Cargando actas/.test(cargando), 'muestra que está cargando');
  ok(!/TODAVÍA NO HAY ACTAS/.test(cargando), 'y no el cartel de vacío');

  console.log('\nSin actas publicadas lo dice claro');
  const vacio = await ver([]);
  ok(/TODAVÍA NO HAY ACTAS PUBLICADAS/.test(vacio), 'sale el cartel de vacío');

  console.log('\nCon actas, se ven los campeonatos y sus documentos');
  await ver(FICHAS);
  const r = await p.evaluate(() => {
    const d = document.getElementById('app');
    const enlaces = [...d.querySelectorAll('a[href^="https://ejemplo/"]')]
      .map(a => ({ href: a.getAttribute('href'), txt: a.innerText.replace(/\s+/g, ' ').trim() }));
    return { titulos: [...d.querySelectorAll('.envivo-nom')].map(e => e.textContent), enlaces };
  });
  ok(r.titulos.length === 2, 'hay una tarjeta por campeonato');
  ok(/CENTRO SUR/i.test(r.titulos[0]), 'el más reciente va primero: ' + r.titulos[0]);
  ok(/2025/.test(r.titulos[1]), 'y después el de 2025');
  ok(r.enlaces.length === 3, 'los tres documentos tienen su enlace');
  ok(r.enlaces.every(e => /^https:\/\/ejemplo\//.test(e.href)), 'apuntan al archivo subido');
  ok(/PDF/.test(r.enlaces[0].txt) && /Acta oficial/.test(r.enlaces[0].txt), 'se ve el tipo y el nombre: ' + r.enlaces[0].txt);
  ok(/XLSX/.test(r.enlaces[1].txt), 'el Excel sale como XLSX');
  ok(/234 KB/.test(r.enlaces[0].txt), 'y el tamaño: ' + r.enlaces[0].txt);
  ok(/1\.0 MB/.test(r.enlaces[2].txt), 'en MB cuando corresponde: ' + r.enlaces[2].txt);

  console.log('\nEl sitio solo pide las publicadas');
  ok(/\.filter\(e=>e\.publicado&&\(e\.docs\|\|\[\]\)\.length\)/.test(idx),
     'se filtran las no publicadas y las que no tienen archivo');

  console.log('\nEl admin detecta los campeonatos que ya pasaron');
  const cp = await p.evaluate(src => {
    // Se extrae cpEsPasado del admin y se prueba con casos reales.
    const i = src.indexOf('function cpEsPasado(');
    const fin = src.indexOf('function cpPasados(', i);
    eval(src.slice(i, fin));
    const hoy = new Date().toISOString().slice(0, 10);
    const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const manana = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    return {
      archivado: cpEsPasado({ status: 'archived', date: manana }),
      ayer: cpEsPasado({ status: 'open', date: ayer }),
      hoy: cpEsPasado({ status: 'open', date: hoy }),
      manana: cpEsPasado({ status: 'open', date: manana }),
      sinFecha: cpEsPasado({ status: 'open' }),
    };
  }, adm);
  ok(cp.archivado === true, 'un campeonato archivado cuenta como pasado');
  ok(cp.ayer === true, 'uno con fecha de ayer también');
  ok(cp.hoy === false, 'el de hoy todavía no (puede estar corriendo)');
  ok(cp.manana === false, 'ni el de mañana');
  ok(cp.sinFecha === false, 'sin fecha ni estado, no se asume nada');

  console.log('\nEl admin tiene su entrada y sus acciones');
  ok(/onclick="go\('pasadas'\)">Competencias pasadas</.test(adm), 'botón en la barra lateral');
  ok(/ST\.view==='pasadas'\)content=renderCompetenciasPasadas\(\)/.test(adm), 'la vista está enrutada');
  ok(/window\.cpSubir=async function/.test(adm), 'se puede subir');
  ok(/window\.cpBorrar=async function/.test(adm), 'borrar');
  ok(/window\.cpRenombrar=async function/.test(adm), 'y renombrar lo que se ve en el sitio');
  ok(/setDoc\(doc\(db,'competencias_pasadas',id\),dato\)/.test(adm), 'la ficha va a competencias_pasadas');
  ok(/actas\/\$\{id\}\//.test(adm), 'y el archivo a actas/{campeonato}/');
  ok(/if\(on&&!\(ficha\.docs\|\|\[\]\)\.length\)/.test(adm), 'no deja publicar un campeonato sin documentos');

  console.log('\nLas reglas dejan leer a cualquiera y escribir solo al admin');
  const fr = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
  const sr = fs.readFileSync(__dirname + '/../storage.rules', 'utf8');
  ok(/match \/competencias_pasadas\/\{id\} \{\s*allow read: if true;\s*allow write: if isAdmin\(\);/.test(fr),
     'Firestore: lectura pública, escritura de admin');
  ok(/match \/actas\/\{allPaths=\*\*\} \{[\s\S]*?allow read: if true;[\s\S]*?allow write: if isAdmin\(\)/.test(sr),
     'Storage: lo mismo para los archivos');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

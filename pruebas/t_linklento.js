// "VER EN VIVO" con el teléfono lento.
//
// Se reportó así: en el sitio, Competencia en Vivo lista los dos regionales;
// al tocar uno, el livecast abría la LISTA de campeonatos con los dos, en vez
// del campeonato elegido. Y con la sesión de admin, en esa lista aparecía
// además el Debutantes, que está archivado.
//
// Lo primero era la espera: el livecast esperaba unos 8 segundos a que llegara
// el campeonato del link (y en la práctica la mitad, porque dos llamadas
// gastaban el mismo contador). En un teléfono, Firestore puede tardar más; se
// rendía, mostraba la lista, y cuando los campeonatos llegaban ya nadie volvía
// a buscar el del link. Con Firebase servido al instante desde el disco, como
// en el resto de las pruebas, no se veía nunca.
//
// Lo segundo: el Debutantes se corrió en dos tarimas y en Firestore quedó como
// "… - Tarima 1" y "… - Tarima 2", pero en nominas.json sigue con el nombre
// solo. Archivar los de Firestore no ocultaba ese nombre suelto.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_linklento.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// El id del documento de livecast_sync sale del nombre del campeonato (fbDocId).
const docId = n => n.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 55);
const CENTRO = '“Primavera Open” Regional Centro Noviembre 2026';
const SUR = 'Regional Sur Austral Noviembre 2026';

function base() {
  const E = (id, name, status, pub, lcv) => ({ id, name, status, publicoVisible: pub, livecastVisible: lcv });
  const nueve = () => ({ sq: [{ w: 100, r: null }, { w: 0, r: null }, { w: 0, r: null }],
    bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
  const atletas = sufijo => JSON.stringify([1, 2, 3].map(i => ({ id: i, lot: i, name: 'Atleta ' + i + ' ' + sufijo,
    flight: 'A', sex: 'Hombre', cat: '83', div: 'Open', mod: 'classic', bw: 80, club: 'Club ' + sufijo, att: nueve() })));
  const sync = (nombre, sufijo) => ({ id: docId(nombre), athletes: atletas(sufijo), flight: 'A', lift: 'sq', round: 0,
    changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: false, forcedCurrent: null, timer: 60, timerOn: false });
  return {
    // Los campeonatos como están hoy en la base.
    eventos: [
      E('Campeonato Regional Centro FECHIPO 2026', 'Campeonato Regional Centro FECHIPO 2026', 'archived', undefined, false),
      E('Campeonato_Debutantes_All_Power_CD_2026_T1', 'Campeonato Debutantes All Power CD 2026 - Tarima 1', 'archived', undefined, false),
      E('Campeonato_Debutantes_All_Power_CD_2026_T2', 'Campeonato Debutantes All Power CD 2026 - Tarima 2', 'archived', undefined, false),
      E('Primer Campeonato Nacional Universitario FECHIPO 2026', 'Primer Campeonato Nacional Universitario FECHIPO 2026', 'archived', undefined, false),
      E('suda2026', 'Sudamericano 2026', 'archived', false, true),
      E('regional_centro_2026', CENTRO, 'open', true, true),
      E('regional_sur_austral_2026', SUR, 'open', true, true),
    ],
    inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
    admins: [{ id: 'u', role: 'admin' }],
    livecast_sync: [sync(CENTRO, 'Centro'), sync(SUR, 'Sur')],
  };
}

async function abrir(b, url, { demora, admin } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
  await montarFirebase(ctx, { demora: demora ? { 'firebase-firestore.js': demora } : {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([d, adm]) => { window.__FAKE = d; if (adm) window.__AUTH = { uid: 'u', email: 'a@b.cl' }; },
    [base(), !!admin]);
  await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
  return { p, ctx, errs };
}
const estado = p => p.evaluate(() => ({
  fase: DATA.phase, ev: DATA.event ? DATA.event.id : null, esperando: !!window._EV_ESPERANDO,
  nombres: (DATA.athletes || []).map(a => a.name),
  lista: [...document.querySelectorAll('.card[onclick^="pickEvent"] .os')].map(x => x.textContent.trim()),
}));
// Mira la pantalla cada medio segundo hasta `ms` y anota si alguna vez mostró la lista.
async function mirar(p, ms) {
  let vioLista = false, e = null;
  for (let t = 0; t < ms; t += 500) {
    await p.waitForTimeout(500);
    e = await estado(p);
    if (e.lista.length) vioLista = true;
  }
  return { vioLista, e };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  console.log('\nEl público toca "VER EN VIVO" y Firestore tarda 9 segundos');
  for (const [id, suf] of [['regional_centro_2026', 'Centro'], ['regional_sur_austral_2026', 'Sur']]) {
    const { p, ctx, errs } = await abrir(b, 'livecast.html?evento=' + id, { demora: 9000 });
    const a = await mirar(p, 5000);
    ok(a.e.esperando && !a.vioLista, id + ': mientras espera dice que está entrando, sin mostrar la lista');
    const c = await mirar(p, 8000);
    ok(!c.vioLista, id + ': nunca pasa por la lista de campeonatos');
    ok(c.e.fase === 'liveView' && c.e.ev === id, id + ': entra al campeonato del link (' + c.e.fase + ', ' + c.e.ev + ')');
    ok(c.e.nombres.length === 3 && c.e.nombres.every(n => n.endsWith(suf)),
       id + ': con sus atletas, no los del otro: ' + c.e.nombres.join(', '));
    ok(errs.length === 0, id + ': sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  console.log('\n  Y si Firestore tarda más que la espera entera (30 s)');
  {
    const { p, ctx } = await abrir(b, 'livecast.html?evento=regional_sur_austral_2026', { demora: 33000 });
    const a = await mirar(p, 31500);
    ok(!a.e.esperando && a.e.fase === 'setup', 'se rinde a los 30 s y muestra la lista');
    const c = await mirar(p, 5000);
    ok(c.e.fase === 'liveView' && c.e.ev === 'regional_sur_austral_2026',
       'pero cuando Firestore llega, entra igual al campeonato del link');
    await ctx.close();
  }

  console.log('\n  Un link a algo que no existe sigue terminando en la lista');
  {
    const { p, ctx } = await abrir(b, 'livecast.html?evento=no_existe_2026');
    const c = await mirar(p, 4000);
    ok(!c.e.esperando && c.e.fase === 'setup' && c.e.lista.length === 2,
       'lista con los dos publicados: ' + c.e.lista.join(' | '));
    await ctx.close();
  }

  console.log('\nLa lista del admin no muestra campeonatos archivados');
  {
    const { p, ctx } = await abrir(b, 'livecast.html', { admin: true });
    const c = await mirar(p, 4000);
    ok(c.e.lista.includes(CENTRO) && c.e.lista.includes(SUR), 'están los dos regionales');
    ok(!c.e.lista.some(n => /Debutantes/.test(n)),
       'y no el Debutantes: en Firestore se archivó como "- Tarima 1" y "- Tarima 2"');
    ok(!c.e.lista.some(n => /Regional Centro FECHIPO|Universitario|^Sudamericano 2026$/.test(n)),
       'ni los otros archivados de nominas.json');
    await ctx.close();
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

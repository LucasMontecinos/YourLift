// Récords de Only Bench: clásico y equipado, aparte de los de powerlifting.
//
// La banca de quien compite solo en banca no se mide contra la banca de
// powerlifting: son modalidades distintas y sus récords pueden ser distintos.
// Antes la tabla nacional no tenía Only Bench, ni en el sitio ni en el panel, y
// el cierre de competencia se los saltaba.
//
// Se fija:
//  · el sitio tiene las pestañas Only Bench Clásico y Only Bench Equipado, con
//    un solo movimiento (press banca), y muestra sus récords,
//  · los récords con sexo "Hombre" salen en Hombres (los universitarios caían
//    en Mujeres),
//  · el panel deja editar las dos tablas nuevas, solo con press banca,
//  · en vivo y al cerrar, el de Only Bench se mide contra su tabla; quien hace
//    powerlifting y banca, contra las dos; el de powerlifting solo, contra la
//    suya.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_recordsbanca.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const TABLA = {
  classic: {
    sq: [], dl: [], total: [],
    bp: [{ nombre: 'Clásica Récord', division: 'Open', categoria: '63', campeonato: 'Nacional', marca: 100 },
         { nombre: 'Clásico Hombre', division: 'Open', categoria: '83', campeonato: 'Nacional', marca: 180 }],
  },
  equipped: { sq: [], bp: [{ nombre: 'Equipada Récord', division: 'Open', categoria: '63', campeonato: 'Nacional', marca: 130 }], dl: [], total: [] },
  bench: { bp: [{ nombre: 'Banca Récord', division: 'Open', categoria: '63', campeonato: 'Nacional', marca: 90 },
                { nombre: 'Banca Hombre', division: 'Open', categoria: '83', campeonato: 'Nacional', marca: 170 }] },
  bench_eq: { bp: [{ nombre: 'Banca Equipada', division: 'Open', categoria: '63', campeonato: 'Nacional', marca: 120 }] },
  universitario: { sq: [{ nombre: 'Uni Hombre', division: 'Universitario', categoria: '120', sexo: 'Hombre', marca: 300 }], bp: [], dl: [], total: [] },
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  // ── El sitio ───────────────────────────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof rec === 'function' && typeof sinRetiradas === 'function', null, { timeout: 25000 });
    const ver = (tipo, sexo) => p.evaluate(([t, tabla, sx]) => {
      R = sinRetiradas(tabla); ST.v = 'records'; ST.rt = t; ST.rl = 'sq'; ST.rs = sx; ST.rd = ''; ST.rc = ''; ST.rq = '';
      const h = document.createElement('div'); h.innerHTML = rec();
      const botones = [...h.querySelectorAll('button')].map(x => x.textContent.trim());
      return { botones, rl: ST.rl, texto: h.textContent.replace(/\s+/g, ' ') };
    }, [tipo, TABLA, sexo]);

    console.log('\nEl sitio tiene las pestañas de Only Bench');
    {
      const r = await ver('classic', 'F');
      ok(r.botones.includes('Only Bench Clásico') && r.botones.includes('Only Bench Equipado'), 'las dos pestañas nuevas');
      ok(r.botones.includes('Sentadilla') && r.botones.includes('Total'), 'en Clásico siguen los cuatro movimientos');
    }
    {
      const r = await ver('bench', 'F');
      ok(r.rl === 'bp', 'en Only Bench queda elegido press banca aunque viniera de sentadilla');
      ok(!r.botones.includes('Sentadilla') && !r.botones.includes('Peso Muerto') && !r.botones.includes('Total'),
         'y no ofrece sentadilla, peso muerto ni total');
      ok(/Banca Récord/.test(r.texto) && /90 kg/.test(r.texto), 'muestra el récord de Only Bench');
      ok(!/Clásica Récord/.test(r.texto), 'y no el de la banca de powerlifting');
      ok(/Récords Press Banca Only Bench Clásico/.test(r.texto), 'con el título de la modalidad');
    }
    {
      const r = await ver('bench_eq', 'F');
      ok(/Banca Equipada/.test(r.texto) && /120 kg/.test(r.texto), 'Only Bench Equipado muestra el suyo');
    }
    {
      const vacia = JSON.parse(JSON.stringify(TABLA)); vacia.bench_eq.bp = [];
      const t = await p.evaluate(tabla => { R = sinRetiradas(tabla); ST.rt = 'bench_eq'; ST.rs = 'F';
        const h = document.createElement('div'); h.innerHTML = rec(); return h.textContent; }, vacia);
      ok(/Todavía no hay récords cargados en esta modalidad/.test(t), 'una tabla vacía lo dice así, no "con estos filtros"');
    }
    console.log('\nEl sexo escrito "Hombre" va a Hombres');
    {
      const m = await ver('universitario', 'M'), f = await ver('universitario', 'F');
      ok(/Uni Hombre/.test(m.texto), 'el récord universitario de un hombre sale en Hombres');
      ok(!/Uni Hombre/.test(f.texto), 'y ya no en Mujeres');
      const s = await p.evaluate(() => ['Hombre', 'Mujer', 'M', 'F', 'Masculino', 'Femenino'].map(x => sexoDeRecord({ sexo: x })).join(''));
      ok(s === 'MFMFMF', 'Hombre/Mujer/M/F/Masculino/Femenino se leen bien (' + s + ')');
    }
    ok(!errs.length, 'el sitio sin errores de página' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  // ── El panel ───────────────────────────────────────────────────
  {
    // El falso compartido no trae createUserWithEmailAndPassword, que el panel importa.
    const MODULOS = Object.assign({}, require('./apoyo/firebase_falso').MODULOS);
    MODULOS['firebase-auth.js'] += '\n export const createUserWithEmailAndPassword=async()=>({user:{uid:"n"}});';
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route('**/firebasejs/**', r => {
      const u = r.request().url(); const k = Object.keys(MODULOS).find(k => u.endsWith(k));
      return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__AUTH = { uid: 'u1', email: 'x@y.cl' }; window.__FAKE = { admins: [{ id: 'u1', role: 'owner' }] }; });
    await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof ST !== 'undefined' && typeof window.recAdd === 'function' && typeof window.render === 'function'
      && /ATLETAS/i.test(document.body.innerText || ''), null, { timeout: 25000 });
    console.log('\nEl panel edita las tablas de Only Bench');
    const r = await p.evaluate(tabla => {
      // El editor vive dentro del módulo del panel: se lo abre como lo abre el menú.
      ST._recLoaded = true; ST.recR = JSON.parse(JSON.stringify(tabla)); ST.recTipo = 'bench'; ST.recLift = 'dl';
      ST.view = 'records'; render();
      const botones = [...document.querySelectorAll('#app button, main button, button')].map(x => x.textContent.trim());
      const nombres = [...document.querySelectorAll('input.inp')].map(i => i.value);
      ST.recR.bench_eq = undefined; recAdd('bench_eq', 'bp');
      return { botones, nombres, agregado: ST.recR.bench_eq && ST.recR.bench_eq.bp.length };
    }, TABLA);
    const fuente = require('fs').readFileSync(__dirname + '/../admin/arranque.js', 'utf8');
    r.vacio = /bench:\{bp:\[\]\},bench_eq:\{bp:\[\]\}/.test(fuente) ? '{"bp":[]}{"bp":[]}' : 'no';
    ok(r.botones.includes('Only Bench Classic') && r.botones.includes('Only Bench Equipado'), 'tiene las dos modalidades');
    ok(r.botones.includes('Press Banca') && !r.botones.includes('Sentadilla') && !r.botones.includes('Total'),
       'en Only Bench solo ofrece press banca');
    ok(r.nombres.includes('Banca Récord') && !r.nombres.includes('Clásica Récord'), 'y muestra los récords de esa tabla');
    ok(r.agregado === 1, 'se puede agregar un récord aunque la tabla no existiera');
    ok(r.vacio === '{"bp":[]}{"bp":[]}', 'la tabla vacía de arranque ya trae las dos');
    ok(!errs.length, 'el panel sin errores de página' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  // ── El control en vivo ─────────────────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=suda2026_fesupo_full&controller=1`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof checkRecord === 'function' && typeof _rnDetectar === 'function'
      && typeof DATA !== 'undefined' && DATA.athletes, null, { timeout: 30000 });

    const r = await p.evaluate(tabla => {
      RECORDS = JSON.parse(JSON.stringify(tabla));
      DATA.event = Object.assign({}, DATA.event || {}, { name: 'Campeonato Nacional', recordsEnabled: true, date: '2026-11-01' });
      const avisos = [];
      showRecordAlert = function (n, l, r, w, old, holder, cat, div, mod) { avisos.push({ n, w, old, mod }); };
      pushRecordToFB = async function () {};
      const at = bp => ({ sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
        bp: [{ w: bp, r: 'g' }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
      const atleta = (id, mod, bp, extra) => Object.assign({ id, name: id, sex: 'Femenino', cat: '-63 kg (Mujer)', div: 'Open',
        country: 'CHI', mod, att: at(bp) }, extra || {});
      const prueba = a => { avisos.length = 0; checkRecord(a, 'bp', 0); return avisos.map(x => x.mod + ':' + x.old).join(',') || 'nada'; };
      const vivo = {
        soloBanca95: prueba(atleta('sb', 'onlybench', 95)),
        soloBanca85: prueba(atleta('sb2', 'onlybench', 85)),
        clasica95: prueba(atleta('cl', 'classic', 95)),
        clasica101: prueba(atleta('cl2', 'classic', 101)),
        ambas95: prueba(atleta('am', 'classic_bench', 95, { plusBench: true })),
        ambas101: prueba(atleta('am2', 'classic_bench', 101, { plusBench: true })),
        bancaEq125: prueba(atleta('be', 'equipped_bench', 125, { plusBench: false })),
        oe: prueba(atleta('oe', 'oe_classic', 200)),
      };
      // Al cerrar: se arma la lista con los que superan la tabla.
      const guardados = DATA.athletes;
      DATA.athletes = [
        atleta('Solo Banca', 'onlybench', 95),
        atleta('Powerlifting', 'classic', 95),
        atleta('Las Dos', 'classic_bench', 101, { plusBench: true }),
        atleta('Banca Equipada', 'equipped_bench', 125, { plusBench: false }),
        atleta('Hombre Banca', 'onlybench', 175, { sex: 'Masculino', cat: '-83 kg (Hombre)' }),
      ];
      const lista = _rnDetectar(JSON.parse(JSON.stringify(tabla))).map(x => x.tipo + '|' + x.l + '|' + x.div + '|' + x.cat + '|' + x.a.name + '|' + x.w);
      const resumen = _rnResumen(_rnDetectar(JSON.parse(JSON.stringify(tabla))));
      DATA.athletes = guardados;
      return { vivo, lista, resumen };
    }, TABLA);

    console.log('\nEn vivo, cada banca contra su tabla');
    ok(r.vivo.soloBanca95 === 'bench:90', 'Only Bench con 95 rompe el de Only Bench (90), no el de powerlifting');
    ok(r.vivo.soloBanca85 === 'nada', 'con 85 no rompe nada');
    ok(r.vivo.clasica95 === 'nada', 'la de powerlifting con 95 no rompe nada: no compite por el de Only Bench');
    ok(r.vivo.clasica101 === 'classic:100', 'con 101 rompe el suyo');
    ok(r.vivo.ambas95 === 'bench:90', 'quien hace las dos, con 95, rompe el de Only Bench');
    ok(r.vivo.ambas101 === 'classic:100', 'y con 101 se avisa el de powerlifting primero');
    ok(r.vivo.bancaEq125 === 'bench_eq:120', 'Only Bench Equipado contra su tabla');
    ok(r.vivo.oe === 'nada', 'Olimpiadas Especiales no tiene tabla');

    console.log('\nAl cerrar la competencia');
    const tiene = s => r.lista.some(x => x.indexOf(s) === 0);
    ok(tiene('bench|bp|Open|83|Hombre Banca|175'), 'el de Only Bench queda en su tabla');
    ok(!r.lista.some(x => /\|Powerlifting\|/.test(x)), 'la de powerlifting con 95 no entra en ninguna');
    ok(tiene('classic|bp|Open|63|Las Dos|101'), 'quien hace las dos rompe el de powerlifting');
    const banca63 = r.lista.filter(x => /^bench\|bp\|Open\|63\|/.test(x));
    ok(banca63.length === 1 && /\|Las Dos\|101$/.test(banca63[0]),
       'y también el de Only Bench, con la misma banca: un casillero, un récord, el más alto (101 sobre el 95 de Only Bench)');
    ok(tiene('bench_eq|bp|Open|63|Banca Equipada|125'), 'Only Bench Equipado en la suya');
    ok(/Only Bench Classic F Open 63 PRESS DE BANCA/.test(r.resumen), 'el resumen dice la modalidad');
    ok(!errs.filter(e => !/Firebase|firestore|fetch|network/i.test(e)).length,
       'el control en vivo sin errores de página' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
  process.exit(fallas ? 1 : 0);
})();

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
//    suya,
//  · solo ponen récord los Nacionales, Sudamericanos, Mundiales y Bolivarianos:
//    un zonal o un regional no, salvo que en Admin → Campeonatos se marque a mano,
//  · "Proponer desde resultados" arma la tabla de Only Bench solo con esos
//    campeonatos, para revisarla antes de guardar.
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
    console.log('\nMientras no se publiquen, el sitio no muestra Only Bench');
    {
      const r = await p.evaluate(tabla => {
        R = sinRetiradas(tabla); ST.v = 'records'; ST.rt = 'bench'; ST.rl = 'bp'; ST.rs = 'F';
        const h = document.createElement('div'); h.innerHTML = rec();
        return { botones: [...h.querySelectorAll('button')].map(x => x.textContent.trim()), rt: ST.rt, texto: h.textContent };
      }, TABLA);
      ok(!r.botones.includes('Only Bench Clásico') && !r.botones.includes('Only Bench Equipado'), 'no aparecen las pestañas de Only Bench');
      ok(r.rt === 'classic' && !/Banca Récord/.test(r.texto), 'y si alguien llega con Only Bench elegido, ve Clásico');
    }
    // De acá en adelante, como se verá cuando se publiquen.
    await p.evaluate(() => { window.YL_REC_BANCA_PUBLICA = true; });
    const ver = (tipo, sexo) => p.evaluate(([t, tabla, sx]) => {
      R = sinRetiradas(tabla); ST.v = 'records'; ST.rt = t; ST.rl = 'sq'; ST.rs = sx; ST.rd = ''; ST.rc = ''; ST.rq = '';
      const h = document.createElement('div'); h.innerHTML = rec();
      const botones = [...h.querySelectorAll('button')].map(x => x.textContent.trim());
      return { botones, rl: ST.rl, texto: h.textContent.replace(/\s+/g, ' ') };
    }, [tipo, TABLA, sexo]);

    console.log('\nCuando se publiquen, el sitio tiene las pestañas de Only Bench');
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
    // El falso compartido ya trae createUserWithEmailAndPassword, que el panel importa.
    const MODULOS = Object.assign({}, require('./apoyo/firebase_falso').MODULOS);
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await ctx.route('**/firebasejs/**', r => {
      const u = r.request().url(); const k = Object.keys(MODULOS).find(k => u.endsWith(k));
      return k ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MODULOS[k] }) : r.abort();
    });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
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

    console.log('\nProponer desde resultados: solo campeonatos que ponen récord');
    {
      const comp = (evento, modalidad, division, categoria, sexo, bp) => ({ evento, modalidad, division, categoria, sexo, fecha: '2026-02-22',
        resultado: { bp, categoria, division } });
      const q = await p.evaluate(datos => {
        ST.data = datos; ST.recR = { bench: { bp: [{ nombre: 'Ya Estaba', division: 'Open', categoria: '74', campeonato: 'Nacional', marca: 200 }] } };
        recProponerBanca('bench');
        const banca = ST.recR.bench.bp.map(x => x.division + '|' + x.categoria + '|' + x.nombre + '|' + x.marca);
        recProponerBanca('bench_eq');
        const eq = (ST.recR.bench_eq.bp || []).map(x => x.division + '|' + x.categoria + '|' + x.nombre + '|' + x.marca);
        return { banca, eq, dirty: ST.recDirty };
      }, [
        { nombre: 'Nacional Junior', competencias: [comp('Campeonato Nacional FECHIPO 2026', 'Only Bench Classic IPF', 'Junior Only Bench', '-74 kg (Hombre)', 'Hombre', 150)] },
        { nombre: 'Zonal Fuerte', competencias: [comp('III Campeonato Zona Sur FECHIPO 2025', 'Only Bench Classic', 'Open', '74', 'Hombre', 190)] },
        { nombre: 'Regional Fuerte', competencias: [comp('Regional Centro 2025', 'Only Bench Classic', 'Open', '63', 'Mujer', 120)] },
        { nombre: 'Las Dos Sudamericano', competencias: [comp('Campeonato Sudamericano de Powerlifting Classic 2023', 'Powerlifting Classic + Only Bench Classic', 'Open', '63', 'Mujer', 95)] },
        { nombre: 'Solo Powerlifting', competencias: [comp('Campeonato Nacional FECHIPO 2026', 'Powerlifting Classic', 'Open', '57', 'Mujer', 99)] },
        { nombre: 'Equipado Mundial', competencias: [comp('IPF World Classic Powerlifting Championships 2026', 'Only Bench Equipado IPF', 'Open', '105', 'Hombre', 210)] },
      ]);
      ok(q.banca.includes('Junior|74|Nacional Junior|150'), 'un Nacional entra, con la división limpia ("Junior Only Bench" → Junior)');
      ok(q.banca.includes('Open|74|Ya Estaba|200'), 'en el Open no reemplaza una marca más alta que ya estaba');
      ok(!q.banca.some(x => /Zonal Fuerte|Regional Fuerte/.test(x)), 'un zonal y un regional no entran, aunque tengan la marca más alta');
      ok(q.banca.includes('Open|63|Las Dos Sudamericano|95'), 'un Sudamericano sí, y cuenta la banca de quien hace powerlifting y banca');
      ok(!q.banca.some(x => /Solo Powerlifting/.test(x)), 'la de quien hace solo powerlifting no');
      ok(q.eq.length === 1 && q.eq[0] === 'Open|105|Equipado Mundial|210', 'el equipado va a su tabla, desde un Mundial');
      ok(q.dirty === true, 'queda como cambio sin guardar: nada se publica solo');
    }

    console.log('\nEn Admin → Campeonatos se ve si el campeonato pone récords');
    {
      const f = await p.evaluate(() => {
        const ev = { id: 'reg', name: 'Regional Centro 2027', status: 'open' };
        ST.eventos = [ev]; ST.view = 'campeonatos'; editEvento('reg');
        const sel = document.getElementById('ef_recordsNac');
        const aviso = () => (document.getElementById('ef_recordsAviso') || {}).textContent || '';
        const a1 = aviso();
        document.getElementById('ef_name').value = 'Campeonato Nacional FECHIPO 2027'; efRecordsAviso();
        const a2 = aviso();
        document.getElementById('ef_name').value = 'Regional Centro 2027'; sel.value = 'si'; efRecordsAviso();
        const a3 = aviso();
        return { hay: !!sel, opciones: sel ? [...sel.options].map(o => o.value).join(',') : '', a1, a2, a3 };
      });
      ok(f.hay && f.opciones === ',si,no', 'el selector: según el nombre, sí o no');
      ok(/No pone récords/.test(f.a1), 'un regional dice que no pone récords');
      ok(/Pone récords nacionales/.test(f.a2), 'al escribir "Nacional" en el nombre cambia a que sí');
      ok(/Pone récords nacionales/.test(f.a3) && !/el nombre lo dice/.test(f.a3), 'y marcado a mano, un regional puede ponerlos (excepción)');
      const fuente = require('fs').readFileSync(__dirname + '/../admin/campeonatos.js', 'utf8');
      ok(/recordsEnabled, recordsNac, cronogramaPublic/.test(fuente), 'lo elegido se guarda en el campeonato (recordsNac)');
    }
    ok(!errs.length, 'el panel sin errores de página' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  // ── La regla de los campeonatos ────────────────────────────────
  console.log('\nQué campeonatos ponen récord');
  {
    const vm = require('vm'); const ctxR = { window: {} };
    vm.runInNewContext(require('fs').readFileSync(__dirname + '/../compartido/campeonatos.js', 'utf8'), ctxR);
    const Y = ctxR.window.YLCampeonato;
    const si = ['Campeonato Nacional FECHIPO 2026', 'VIII Campeonato Nacional FECHIPO 2024', 'Primer Campeonato Nacional Universitario FECHIPO 2026',
      'XII Campeonato Sudamericano 2025', 'XI Campeonato Sudamericaco de Powerlifting Classic 2024', 'South American Championships 2025',
      'IPF World Classic Powerlifting Championships 2026', 'Mundial Junior 2027', 'I Juegos Bolivarianos Bicentenario Ayacucho 2024'];
    const no = ['Regional Centro 2025', 'VI Campeonato Zona Centro FECHIPO 2025', 'III Campeonato Zona Sur FECHIPO 2025',
      'Campeonato Debutantes All Power CD 2026', '"EL DESHIELO" Torneo Debutantes II y Nacional Olimpiadas Especiales (OE)',
      '“Primavera Open” Regional Centro Noviembre 2026', 'Campeonato Panamericano de Powerlifting Classic 2019', 'Copa Internacional 2026'];
    const malSi = si.filter(n => !Y.daRecord(n)), malNo = no.filter(n => Y.daRecord(n));
    ok(!malSi.length, 'Nacionales, Sudamericanos, Mundiales y Bolivarianos ponen récord' + (malSi.length ? ': falla ' + malSi.join(' / ') : ''));
    ok(!malNo.length, 'zonales, regionales y debutantes no' + (malNo.length ? ': falla ' + malNo.join(' / ') : ''));
    ok(Y.daRecordEvento({ name: 'Regional Centro 2026', recordsNac: 'si' }) === true, 'un regional marcado a mano sí');
    ok(Y.daRecordEvento({ name: 'Campeonato Nacional 2027', recordsNac: 'no' }) === false, 'un nacional marcado que no, no');
    ok(Y.daRecordEvento({ name: 'Campeonato Nacional 2027', recordsEnabled: false }) === false, 'y el interruptor viejo apagado se respeta');
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
      // Universitario: contra la tabla universitaria, no "todo es récord".
      vivo.uni = prueba(Object.assign(atleta('uni', 'classic', 0), { div: 'Universitario', cat: '-120 kg (Hombre)', sex: 'M',
        att: { sq: [{ w: 310, r: 'g' }, { w: 0, r: null }, { w: 0, r: null }], bp: at(0).bp, dl: at(0).dl } }));
      avisos.length = 0; checkRecord(Object.assign(atleta('uni2', 'classic', 0), { div: 'Universitario', cat: '-120 kg (Hombre)', sex: 'M',
        att: { sq: [{ w: 310, r: 'g' }, { w: 0, r: null }, { w: 0, r: null }], bp: at(0).bp, dl: at(0).dl } }), 'sq', 0);
      vivo.uniSq = avisos.map(x => x.mod + ':' + x.old).join(',') || 'nada';
      avisos.length = 0; checkRecord(Object.assign(atleta('uni3', 'classic', 0), { div: 'Universitario', cat: '-120 kg (Hombre)', sex: 'M',
        att: { sq: [{ w: 290, r: 'g' }, { w: 0, r: null }, { w: 0, r: null }], bp: at(0).bp, dl: at(0).dl } }), 'sq', 0);
      vivo.uniSqBajo = avisos.map(x => x.mod + ':' + x.old).join(',') || 'nada';
      // Un regional no pone récord; marcado a mano, sí.
      const nac = DATA.event;
      DATA.event = Object.assign({}, nac, { name: 'Regional Centro 2026', recordsEnabled: true });
      vivo.regional = prueba(atleta('rg', 'onlybench', 95));
      let alerto = false; const _al = window.alert; window.alert = () => { alerto = true; };
      mostrarRecordsNac(true); vivo.cierreRegionalCalla = !alerto;
      DATA.event.recordsNac = 'si';
      vivo.regionalMarcado = prueba(atleta('rg2', 'onlybench', 95));
      window.alert = _al; DATA.event = nac;
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
    ok(r.vivo.uniSq === 'universitario:300', 'un universitario se mide contra la tabla universitaria (310 > 300)');
    ok(r.vivo.uniSqBajo === 'nada', 'y si no la supera no se avisa (antes todo buen intento salía como récord)');
    ok(r.vivo.regional === 'nada', 'en un regional no se avisa ningún récord');
    ok(r.vivo.cierreRegionalCalla, 'y al cerrarlo no ofrece guardar récords');
    ok(r.vivo.regionalMarcado === 'bench:90', 'salvo que el campeonato esté marcado a mano como que sí');

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

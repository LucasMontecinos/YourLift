// Estilo del campeonato: "Primavera" (livecast/estilo.js).
//
// Se elige en el admin (Campeonatos → Estilo del campeonato) y cambia TODO lo
// de ese campeonato a la vez: la transmisión, la Pantalla Tarima, el Control
// Remoto y la Competencia en Vivo del público. Sin estilo, nada cambia.
//
// Acá se pone el estilo como lo deja el admin —en DATA.event.estilo— y se mira
// que cada pantalla lo lleve (rama, logo, medallas de flor…), que sin él quede
// todo como siempre, y que se pueda probar con ?estilo= en el link.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_estiloprimavera.js
const fs = require('fs');
const { chromium, devices } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MONTAR = (estilo) => {
  const n9 = () => ({ sq: [], bp: [], dl: [] });
  const L = [['Matías Ignacio Rojas Fuentes', 'Raíces Strength', 230, 145, 265], ['Diego Andrés Soto Muñoz', 'Club Primavera', 225, 145, 260],
    ['Felipe Contreras Lagos', 'Barra Libre', 220, 140, 255], ['Tomás Herrera Vidal', 'Hannya Barbell', 210, 142.5, 250]];
  DATA.athletes = L.map(([name, club, sq, bp, dl], i) => {
    const a = { id: i + 1, name, club, lot: i + 1, flight: 'A', sex: 'Hombre', cat: '93', div: 'Open', mod: 'classic', bw: 92.1, country: 'CHI', bombed: false, att: n9() };
    a.att.sq = [{ w: sq - 15, r: 'g' }, { w: sq - 5, r: 'g' }, { w: sq, r: i % 2 ? 'n' : 'g' }];
    a.att.bp = [{ w: bp - 10, r: 'g' }, { w: bp - 5, r: 'g' }, { w: bp, r: 'g' }];
    a.att.dl = [{ w: dl - 20, r: 'g' }, { w: dl - 10, r: i < 2 ? null : 'g' }, { w: i < 2 ? 0 : dl, r: null }];
    return a;
  });
  DATA.lift = 'dl'; DATA.round = 1; DATA.flight = 'A'; DATA.forcedCurrent = 1;
  DATA.event = Object.assign({}, DATA.event || {}, { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026', estilo });
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const abrir = async (q, opts) => {
    const ctx = await b.newContext(opts || { viewport: { width: 1920, height: 1080 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(q + ': ' + e.message));
    await p.goto(`http://localhost:${PUERTO}/livecast.html${q}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof R === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
    await p.waitForTimeout(1200);
    return { p, ctx };
  };
  const montar = (p, e) => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [MONTAR.toString(), e]);

  console.log('\nLa transmisión, con el estilo puesto en el campeonato');
  {
    const { p, ctx } = await abrir('?tx=director&evento=suda2026_fesupo_full');
    await montar(p, 'primavera');
    const ver = (st, sels) => p.evaluate(([s, sels]) => {
      _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT));
      Object.keys(s).forEach(k => { _txDirState[k] = Object.assign({}, _txDirState[k] || {}, s[k]); });
      _txDirLastSig = null; renderTxWidget();
      const w = document.getElementById('txWidget');
      return sels.every(x => !!w.querySelector(x));
    }, [st, sels]);
    const sb = await p.evaluate(() => {
      _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.scoreboard.active = true; _txDirState.tablaActual = { active: true, until: 0 };
      _txDirLastSig = null; renderTxWidget();
      const w = document.getElementById('txWidget');
      return { attr: document.documentElement.getAttribute('data-estilo'), rama: !!w.querySelector('.pvSb .pvDeco-sb svg.pvRama'),
        logo: !!w.querySelector('.pvSb img.pvLogo'), att: [...w.querySelectorAll('.pvSb-att')].map(e => e.className.replace('pvSb-att', '').trim()).join(','),
        medTa: w.querySelectorAll('.pvTa svg.pvMedalla').length, ramaTa: !!w.querySelector('.pvDeco-ta svg') };
    });
    ok(sb.attr === 'primavera', 'la página queda marcada con el estilo (data-estilo="primavera")');
    ok(sb.rama && sb.logo, 'el marcador lleva la rama arriba y el logo');
    ok(/g/.test(sb.att) && /p/.test(sb.att), 'los intentos del marcador dicen si son válidos y cuál va (' + sb.att + ')');
    ok(sb.medTa === 3 && sb.ramaTa, 'la tabla actual: rama y las medallas en flor de los tres primeros');
    const lb = await ver({ leaderboard: { active: true, cat: '93' } }, ['.pvLb .pvDeco-lb svg', '.pvDeco-lbv svg', '.pvLb-row.cur']);
    ok(lb, 'la clasificación: rama, enredadera y el atleta en tarima marcado');
    const md = await ver({ medals: { active: true, cat: '93', sex: 'Hombre', div: 'Open', mod: 'classic', tipo: 'total' } }, ['.pvMd-med svg.pvMedalla', '.pvDeco-md svg']);
    ok(md, 'el medallero: medallas de flor y la rama en el letrero');
    const pf = await ver({ profile: { active: true } }, ['.pvPf .pvPf-marco svg', '.pvPf .txCascade .pvPf-nombre', '.pvPf-ev img.pvLogo']);
    ok(pf, 'el perfil: tablas, ramas en las esquinas, nombre y logo');
    const jr = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = renderTxJurado({ id: 3, res: 'n', card: 'red', lift: 'dl', round: 1 }); return { rama: !!d.querySelector('.pvDeco-jr svg'), luz: !!d.querySelector('.pvJr-luz svg'), res: (d.querySelector('.pvJr-res') || {}).textContent }; });
    ok(jr.rama && jr.luz && jr.res === 'NULO', 'la decisión del jurado: rama, luz con contorno y NULO');
    const ci = await p.evaluate(() => { DATA.athletes[0].att.dl[2] = { w: 267.5, r: null, cambios: 1, cambioTs: _ahora() }; DATA.forcedCurrent = 1;
      _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.scoreboard.active = true; _txDirState.cambioIntento.active = true; _txDirLastSig = null; renderTxWidget();
      return !!document.querySelector('#txWidget .pvCi'); });
    ok(ci, 'el cambio de intento sale con su cartel');
    // Se saca el estilo en el admin: la próxima vez que se dibuja, vuelve lo de siempre.
    const sin = await p.evaluate(() => { DATA.event.estilo = ''; _txDirState.profile = { active: true, until: 0 }; _txDirLastSig = null; renderTxWidget();
      const w = document.getElementById('txWidget'); return { attr: document.documentElement.getAttribute('data-estilo'), pv: !!w.querySelector('.pvDeco,.pvPf,.pvLogo') }; });
    ok(sin.attr === null && !sin.pv, 'al sacarle el estilo, la transmisión vuelve a ser la de siempre');
    const logoOk = await p.evaluate(async () => { const i = new Image(); i.src = _pvLogoUrl(); try { await i.decode(); } catch (e) {} return i.naturalWidth > 100; });
    ok(logoOk, 'el logo del estilo carga (' + 'estilos/primavera/logo.webp)');
    await ctx.close();
  }

  console.log('\nSin estilo no cambia nada');
  {
    const { p, ctx } = await abrir('?tx=director&evento=suda2026_fesupo_full');
    await montar(p, '');
    const r = await p.evaluate(() => { _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.scoreboard.active = true; _txDirLastSig = null; renderTxWidget();
      const w = document.getElementById('txWidget'); return { attr: document.documentElement.getAttribute('data-estilo'), deco: w.querySelectorAll('.pvDeco,.pvLogo,.pvMedalla').length, fuentes: !!document.getElementById('estiloFuentes') }; });
    ok(r.attr === null && r.deco === 0, 'ni marca en la página ni rama, logo o medallas');
    ok(!r.fuentes, 'y no se bajan las letras del estilo');
    await ctx.close();
  }

  console.log('\nLa Pantalla Tarima');
  {
    const { p, ctx } = await abrir('?tx=screen&evento=suda2026_fesupo_full');
    await montar(p, 'primavera');
    const modo = m => p.evaluate(mm => { window._SCREEN_STATE = { mode: mm, flights: null, fondo: 'yourlift', luces: true }; _txLights = { izq: 'white', central: 'red', der: 'white' }; window._piSelected = null; renderTxWidget();
      const c = document.getElementById('txWidget'); return { pant: !!c.querySelector('.pvPant'), rama: !!c.querySelector('.pvPant-rama svg'), marco: !!c.querySelector('.pvPant-marco svg'),
        logo: !!c.querySelector('img.pvPant-logo,img.pvJo-logo'), jo: !!c.querySelector('.pvJo .pvJo-rama svg'), at: c.querySelectorAll('.pvAt.g span').length,
        bloques: c.querySelectorAll('.pi-block').length }; }, m);
    const it = await modo('intentos');
    // Sin ramas encima de la pantalla: los bloques se ponen donde se quiera y una
    // rama colgando bajo la franja tapaba "SENTADILLA · 1er INTENTO · RACK…".
    ok(it.pant && !it.rama && !it.marco && it.logo, 'Pantalla cargadores: tablas y el logo, sin ramas que tapen el texto');
    ok(it.bloques > 5, 'y sus bloques siguen ahí para moverlos (' + it.bloques + ')');
    const ba = await modo('barra');
    ok(ba.pant && !ba.marco && !ba.rama && ba.logo, 'Atleta en barra: el logo, sin ramas encima');
    const lu = await modo('luces');
    ok(lu.pant && !lu.marco && lu.logo, 'Luces: el logo, sin ramas encima');
    const jo = await modo('jornada');
    ok(jo.jo && jo.logo && jo.at > 0, 'Tabla jornada: rama en la franja, logo e intentos en placas (' + jo.at + ' válidos)');
    // En Lirio, los datos (movimiento, rack, categoría, club) van en recuadro
    // sólido: se leen sobre el papel y sobre la franja vino.
    await montar(p, 'lirio');
    const lr = await p.evaluate(() => { window._SCREEN_STATE = { mode: 'intentos', flights: null, fondo: 'yourlift', luces: false }; window._piSelected = null; renderTxWidget();
      return ['liftLabel', 'subtitle'].map(k => { const el = document.querySelector('.pi-block[data-pi-key="' + k + '"]>.pi-inner>*'); return el ? getComputedStyle(el).backgroundColor : 'no'; }); });
    ok(lr.every(c => c === 'rgb(31, 110, 94)'), 'Lirio: los datos de los cargadores en recuadro verde sólido (' + lr.join(' · ') + ')');
    await ctx.close();
  }

  console.log('\nEl Control Remoto y la página del público');
  {
    const { p, ctx } = await abrir('?evento=suda2026_fesupo_full', devices['iPhone 13']);
    await montar(p, 'primavera');
    const rm = await p.evaluate(() => { isAdmin = true; DATA.phase = 'remote'; R();
      return { logo: !!document.querySelector('.pvRm .pvRm-logo'), btn: document.querySelectorAll('.pvRm-btn').length }; });
    ok(rm.logo && rm.btn >= 8, 'Control Remoto: logo, rama y los botones vestidos (' + rm.btn + ')');
    const lv = await p.evaluate(() => { isAdmin = false; DATA.phase = 'liveView'; R();
      return { logo: !!document.querySelector('.lv-cab .pvLv-logo'), rama: !!document.querySelector('.pvLv-rama svg'),
        fondo: getComputedStyle(document.querySelector('#R .lv-cab')).backgroundImage.includes('gradient') }; });
    ok(lv.logo && lv.rama && lv.fondo, 'Competencia en Vivo: la barra de arriba de tablas, con el logo y la rama');
    await ctx.close();
  }

  console.log('\nProbar con el link');
  {
    const { p, ctx } = await abrir('?evento=suda2026_fesupo_full&estilo=primavera');
    await montar(p, '');
    const a = await p.evaluate(() => { R(); return document.documentElement.getAttribute('data-estilo'); });
    ok(a === 'primavera', '?estilo=primavera lo muestra aunque el campeonato no lo tenga');
    await ctx.close();
    const x = await abrir('?evento=suda2026_fesupo_full&estilo=normal');
    await montar(x.p, 'primavera');
    const n = await x.p.evaluate(() => { R(); return document.documentElement.getAttribute('data-estilo'); });
    ok(n === null, '?estilo=normal lo esconde aunque el campeonato lo tenga');
    await x.ctx.close();
  }

  console.log('\nEl admin lo guarda y el livecast lo lee');
  {
    const panel = fs.readFileSync(__dirname + '/../admin/panel.js', 'utf8');
    const sinc = fs.readFileSync(__dirname + '/../livecast/sincronizacion.js', 'utf8');
    ok(/name="ef_estilo"/.test(panel) && /input\[name="ef_estilo"\]:checked/.test(panel) && /\n\s+estilo,\s/.test(panel), 'Campeonatos → Estilo del campeonato se guarda en la ficha (estilo)');
    ok(/DATA\.event\.estilo=e\.estilo/.test(sinc) && /estilo:e\.estilo/.test(sinc), 'y el livecast lo toma de la ficha del campeonato');
  }

  console.log('\nLirio: la variante de la credencial (vino, crema, verde, lirios)');
  {
    const { p, ctx } = await abrir('?tx=director&evento=suda2026_fesupo_full');
    await montar(p, 'lirio');
    const r = await p.evaluate(() => {
      _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.scoreboard.active = true;
      _txDirLastSig = null; renderTxWidget();
      const h = document.documentElement, w = document.getElementById('txWidget');
      const head = w.querySelector('.pvSb-head'), nom = w.querySelector('.pvSb-name'), logo = w.querySelector('img.pvLogo');
      return { fam: h.getAttribute('data-estilo'), v: h.getAttribute('data-estilo-var'), lirio: !!w.querySelector('.pvDeco-sb ellipse'),
        logo: logo ? logo.getAttribute('src') : '', head: head ? getComputedStyle(head).backgroundImage : '', fuente: nom ? getComputedStyle(nom).fontFamily : '' };
    });
    ok(r.fam === 'primavera' && r.v === 'lirio', 'usa las piezas de Primavera con su variante (' + r.fam + '/' + r.v + ')');
    ok(r.lirio, 'la rama del marcador lleva lirios');
    ok(/estilos\/primavera\/logo\.webp/.test(r.logo), 'y el logo del campeonato, el mismo de siempre');
    ok(/142, 30, 49/.test(r.head) && /Anton/.test(r.fuente), 'la barra del marcador es vino y la letra condensada');
    const pf = await p.evaluate(() => {
      _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.profile.active = true; _txDirLastSig = null; renderTxWidget();
      const el = document.querySelector('.pvPf'); return { fondo: el ? getComputedStyle(el).backgroundImage : '', lirios: !!document.querySelector('.pvPf-marco ellipse') };
    });
    ok(/248, 241, 228/.test(pf.fondo) && pf.lirios, 'el perfil, en papel crema con lirios en las esquinas');
    const vuelta = await p.evaluate(() => {
      DATA.event.estilo = 'primavera'; _txDirLastSig = null; renderTxWidget();
      return { v: document.documentElement.getAttribute('data-estilo-var'), lirios: !!document.querySelector('.pvPf-marco ellipse'), tinta: _PV.ink };
    });
    ok(vuelta.v === null && !vuelta.lirios && vuelta.tinta === '#15110E', 'y al volver a Primavera vuelven sus flores y su contorno negro');
    await ctx.close();
    const x = await abrir('?evento=suda2026_fesupo_full&estilo=lirio');
    await montar(x.p, '');
    const a = await x.p.evaluate(() => { R(); return document.documentElement.getAttribute('data-estilo-var'); });
    ok(a === 'lirio', '?estilo=lirio lo muestra aunque el campeonato no lo tenga');
    await x.ctx.close();
  }

  console.log('\nSolo el owner elige el estilo');
  for (const [rol, ve] of [['owner', true], ['admin', false]]) {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 }, serviceWorkers: 'block' });
    await montarFirebase(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('admin ' + rol + ': ' + e.message)); p.on('dialog', d => d.accept().catch(() => {}));
    const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026', status: 'open', date: '2026-11-21', estilo: 'lirio' };
    await p.addInitScript(([f, auth]) => { window.__FAKE = f; window.__AUTH = auth; },
      [{ admins: [{ id: 'u1', role: rol, email: 'a@b.cl', nombre: 'Prueba' }], eventos: [EV] }, { uid: 'u1', email: 'a@b.cl' }]);
    await p.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo && document.querySelector('.side-btn') && (ST.eventos || []).length === 1, null, { timeout: 25000 });
    await p.evaluate(id => { go('campeonatos'); editEvento(id); }, EV.id);
    await p.waitForSelector('#ef_name');
    const radios = await p.evaluate(() => [...document.querySelectorAll('input[name="ef_estilo"]')].map(x => x.value + (x.checked ? '*' : '')).join(','));
    if (ve) ok(radios === ',primavera,lirio*', 'el owner ve Normal, Primavera y Lirio, con el del campeonato marcado (' + radios + ')');
    else ok(radios === '', 'un admin que no es owner no ve el selector');
    const w = await p.evaluate(async () => { window.__ESCRITO = []; await saveEvento(); return (window.__ESCRITO.find(x => x.col === 'eventos') || {}).d; });
    ok(w && w.estilo === 'lirio', (ve ? 'el owner' : 'el admin') + ' guarda otros cambios y el estilo sigue en Lirio');
    await ctx.close();
  }
  const reglas = fs.readFileSync(__dirname + '/../reglas/firestore.rules', 'utf8');
  ok(/allow update: if isAdmin\(\) && \(isOwner\(\) \|\| request\.resource\.data\.get\('estilo', ''\) == resource\.data\.get\('estilo', ''\)\)/.test(reglas),
    'y en el servidor: solo el owner puede cambiar el estilo de un campeonato');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

// Estilo "Panda" (Copa Panda): Lirio con los colores de un panda y bambú.
//
// - Se elige como los otros (admin → Campeonatos → Estilo) o con ?estilo=panda.
// - Negro en la transmisión y la operación; blanco en lo que ve el público
//   (Pantalla Tarima y la página del público, con el tema día).
// - Las ramas son cañas de bambú con hojas (ni flores ni lirios), y en el
//   marcador el intento en curso no lleva florcita.
// - El logo es el del campeonato, el que se sube en el admin; sin logo cargado
//   no queda una imagen rota.
// - Lirio sigue igual.
// - livecast/estilo_panda.css está al día con la de Lirio (herramientas/estilo_panda.js).
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_estilopanda.js
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const LOGO = 'fechipo_logo.png';   // cualquier imagen del sitio, como logo del campeonato
const MONTAR = `(o)=>{
  const n9=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  const L=[['Catalina Andrea Rivas Fuentes',132.5],['Josefa Paz Morales Ruiz',140],['Antonia Soto Lagos',120]];
  DATA.athletes=L.map(([name,w],i)=>{const a={id:i+1,name,club:'Club '+(i+1),lot:100+i,flight:'A',sex:'Mujer',cat:'63',div:'Open',mod:'classic',bw:62,country:'CHI',bombed:false,att:n9(),rackSQ:'9'};
    a.att.sq[0]={w:w-10,r:'g'};a.att.sq[1]={w,r:null};return a;});
  DATA.lift='sq'; DATA.round=1; DATA.flight='A'; DATA.forcedCurrent=1;
  DATA.event=Object.assign({},DATA.event||{},{name:'Copa Panda',estilo:o.estilo,logoUrl:o.logo||''});
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const abrir = async (q, est, logo) => {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(q + ': ' + e.message));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?${q}&evento=suda2026_fesupo_full&estilo=${est}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof R === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
    await p.waitForTimeout(1200);
    await p.evaluate(([f, x]) => eval('(' + f + ')')(x), [MONTAR, { estilo: est, logo }]);
    return { p, ctx };
  };
  const attrs = p => p.evaluate(() => { const h = document.documentElement; return [h.getAttribute('data-estilo'), h.getAttribute('data-estilo-var'), h.getAttribute('data-estilo-sub') || ''].join('/'); });

  console.log('\nLa hoja de Panda está al día con la de Lirio');
  {
    let al = true; try { execFileSync(process.execPath, [path.join(__dirname, '../herramientas/estilo_panda.js'), '--revisar'], { stdio: 'pipe' }); } catch (e) { al = false; }
    ok(al, 'livecast/estilo_panda.css sale igual al armarla de nuevo (si no: node herramientas/estilo_panda.js)');
  }

  console.log('\nPantalla cargadores: blanco, letra negra, bambú y el logo del campeonato');
  {
    const { p, ctx } = await abrir('tx=screen', 'panda', LOGO);
    const r = await p.evaluate(() => { window._SCREEN_STATE = { mode: 'intentos', flights: null, fondo: 'yourlift', luces: false }; window._piSelected = null; renderTxWidget();
      const box = document.getElementById('pantIntentosBox'), w = document.querySelector('.pi-block[data-pi-key="weight"]>.pi-inner>*');
      const lift = document.querySelector('.pi-block[data-pi-key="liftLabel"]>.pi-inner>*'), logo = document.querySelector('#pantIntentosBox .pvPant-logo');
      return { fondo: getComputedStyle(box).backgroundImage, peso: getComputedStyle(w).color, sello: getComputedStyle(lift).boxShadow, logo: logo ? logo.getAttribute('src') : '' }; });
    ok((await attrs(p)) === 'primavera/panda/crema', 'la página queda en Panda, en la capa clara del público (' + await attrs(p) + ')');
    ok(/bambu\.svg/.test(r.fondo) && /255, 255, 255|247, 246, 242/.test(r.fondo), 'fondo blanco con el bambusal a la izquierda');
    ok(r.peso === 'rgb(20, 20, 22)', 'el peso en negro (' + r.peso + ')');
    ok(/200, 16, 46/.test(r.sello), 'el cartel del movimiento lleva el sello rojo');
    ok(r.logo === 'fechipo_logo.png', 'abajo a la izquierda va el logo del campeonato (' + r.logo + ')');
    await ctx.close();
  }

  console.log('\nTransmisión: negro, con una caña de bambú y sin florcita');
  {
    const { p, ctx } = await abrir('tx=director', 'panda', LOGO);
    await p.evaluate(() => { _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.scoreboard.active = true; _txDirLastSig = null; renderTxWidget(); });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const rama = document.querySelector('#txWidget .pvDeco-sb svg'), flor = document.querySelector('#txWidget .pvSb-flor'), logo = document.querySelector('#txWidget .pvLogo'), head = document.querySelector('#txWidget .pvSb-head');
      return { rama: rama ? rama.innerHTML : '', flor: flor ? getComputedStyle(flor).display : 'no está', logo: logo ? logo.getAttribute('src') : '', head: head ? getComputedStyle(head).backgroundImage + getComputedStyle(head).backgroundColor : '' };
    });
    ok(!(await attrs(p)).endsWith('crema'), 'la transmisión va en negro, no en la capa clara (' + await attrs(p) + ')');
    ok(/#5B8E2B/i.test(r.rama) && !/#740221/i.test(r.rama) && !/F28AAE/i.test(r.rama), 'la rama del marcador es una caña de bambú con hojas, sin lirios ni flores');
    ok(r.flor === 'none' || r.flor === 'no está', 'el intento en curso no lleva la florcita (' + r.flor + ')');
    ok(r.logo === 'fechipo_logo.png', 'el logo del marcador es el del campeonato');
    ok(/35, 35, 38|13, 13, 15/.test(r.head), 'la cabeza del marcador en negro');
    await ctx.close();
  }

  console.log('\nSin logo cargado no queda una imagen rota');
  {
    const { p, ctx } = await abrir('tx=director', 'panda', '');
    await p.evaluate(() => { _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.scoreboard.active = true; _txDirLastSig = null; renderTxWidget(); });
    await p.waitForTimeout(300);
    const n1 = await p.evaluate(() => [...document.querySelectorAll('img.pvLogo')].filter(i => !i.getAttribute('src')).length + document.querySelectorAll('img.pvLogo').length);
    ok(n1 === 0, 'en la transmisión no se dibuja el logo (' + n1 + ' imágenes)');
    await ctx.close();
    const s = await abrir('tx=screen', 'panda', '');
    const n2 = await s.p.evaluate(() => { window._SCREEN_STATE = { mode: 'intentos', flights: null, fondo: 'yourlift', luces: false }; renderTxWidget(); return document.querySelectorAll('img.pvLogo').length; });
    ok(n2 === 0, 'ni en la Pantalla Tarima');
    await s.ctx.close();
  }

  console.log('\nLa página del público: blanca, con el tema día');
  {
    const { p, ctx } = await abrir('x=1', 'panda', LOGO);
    const r = await p.evaluate(() => { isAdmin = false; DATA.phase = 'liveView'; R();
      return { tema: document.documentElement.getAttribute('data-tema'), sub: document.documentElement.getAttribute('data-estilo-sub'), bg: getComputedStyle(document.body).backgroundColor, logo: (document.querySelector('.pvLv-logo') || {}).src || '' }; });
    ok(r.tema === 'dia' && r.sub === 'crema', 'tema día en la capa clara (' + r.tema + '/' + r.sub + ')');
    ok(r.bg === 'rgb(247, 246, 242)', 'fondo blanco hueso (' + r.bg + ')');
    ok(/fechipo_logo\.png$/.test(r.logo), 'arriba, el logo del campeonato');
    const op = await p.evaluate(() => { isAdmin = true; DATA.phase = 'compete'; R(); return [document.documentElement.getAttribute('data-tema'), document.documentElement.getAttribute('data-estilo-sub') || '', getComputedStyle(document.body).backgroundColor]; });
    ok(op[1] === '' && /16, 16, 18|11, 11, 12/.test(op[2]), 'Control en Vivo (operación) en negro (' + op.join(' / ') + ')');
    await ctx.close();
  }

  // Todo lo que viste Lirio también sale en Panda: cada pieza con su caña de
  // bambú (nada de lirios) y el logo del campeonato donde va el logo.
  const bambu = s => /#5B8E2B/i.test(s) && !/#740221|#F28AAE/i.test(s);
  console.log('\nTodo lo de la transmisión');
  {
    const { p, ctx } = await abrir('tx=director', 'panda', LOGO);
    const ver = (st, fn) => p.evaluate(([s, f]) => {
      _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT));
      Object.keys(s).forEach(k => { _txDirState[k] = Object.assign({}, _txDirState[k] || {}, s[k]); });
      _txDirLastSig = null; renderTxWidget();
      return eval('(' + f + ')')(document.getElementById('txWidget'));
    }, [st, fn.toString()]);
    const svgs = w => [...w.querySelectorAll('.pvDeco svg,.pvPf-marco svg')].map(s => s.innerHTML).join('');
    const ta = await ver({ scoreboard: { active: true }, tablaActual: { active: true, until: 0 } }, w => ({ deco: [...w.querySelectorAll('.pvDeco-ta svg')].map(s => s.innerHTML).join(''), med: w.querySelectorAll('.pvTa svg.pvMedalla').length }));
    ok(bambu(ta.deco) && ta.med === 3, 'tabla actual: caña de bambú y las medallas de los tres primeros');
    const lb = await ver({ leaderboard: { active: true, cat: '63' } }, w => ({ deco: [...w.querySelectorAll('.pvDeco-lb svg,.pvDeco-lbv svg')].map(s => s.innerHTML).join(''), n: w.querySelectorAll('.pvDeco-lb svg,.pvDeco-lbv svg').length, logo: (w.querySelector('.pvLb img.pvLogo,.pvDeco ~ img.pvLogo,img.pvLogo') || {}).getAttribute ? w.querySelector('img.pvLogo').getAttribute('src') : '' }));
    ok(lb.n === 2 && bambu(lb.deco), 'clasificación: bambú arriba y al costado');
    ok(lb.logo === LOGO, 'clasificación: con el logo del campeonato');
    const md = await ver({ medals: { active: true, cat: '63', sex: 'Mujer', div: 'Open', mod: 'classic', tipo: 'sq' } }, w => ({ deco: [...w.querySelectorAll('.pvDeco-md svg')].map(s => s.innerHTML).join(''), med: w.querySelectorAll('.pvMd-med svg.pvMedalla').length }));
    ok(bambu(md.deco) && md.med > 0, 'medallero: bambú en el letrero y las medallas');
    const pf = await ver({ profile: { active: true } }, w => ({ deco: [...w.querySelectorAll('.pvPf-marco svg')].map(s => s.innerHTML).join(''), logo: (w.querySelector('.pvPf-ev img.pvLogo') || { getAttribute: () => '' }).getAttribute('src') }));
    ok(bambu(pf.deco) && pf.logo === LOGO, 'perfil: bambú en las esquinas y el logo del campeonato');
    const jr = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = renderTxJurado({ id: 2, res: 'n', card: 'red', lift: 'sq', round: 1 }); return (d.querySelector('.pvDeco-jr svg') || {}).innerHTML || ''; });
    ok(bambu(jr), 'decisión del jurado: con su caña de bambú');
    const ci = await p.evaluate(() => { DATA.athletes[0].att.sq[1] = { w: 135, r: null, cambios: 1, cambioTs: _ahora() };
      _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.scoreboard.active = true; _txDirState.cambioIntento.active = true; _txDirLastSig = null; renderTxWidget();
      const c = document.querySelector('#txWidget .pvCi'); return c ? getComputedStyle(c).backgroundColor : ''; });
    ok(ci === 'rgb(247, 246, 242)', 'cambio de intento: el cartel blanco (' + ci + ')');
    await ctx.close();
  }

  console.log('\nTabla jornada, Control Remoto y la Competencia en Vivo del espectador en el teléfono');
  {
    const s = await abrir('tx=screen', 'panda', LOGO);
    const jo = await s.p.evaluate(() => { window._SCREEN_STATE = { mode: 'jornada', flights: null, fondo: 'yourlift', luces: false }; renderTxWidget();
      return { deco: (document.querySelector('.pvJo .pvJo-rama svg') || {}).innerHTML || '', logo: (document.querySelector('img.pvJo-logo') || { getAttribute: () => '' }).getAttribute('src') }; });
    ok(bambu(jo.deco) && jo.logo === LOGO, 'tabla jornada: bambú en la franja y el logo del campeonato');
    await s.ctx.close();
    const ctx = await b.newContext(Object.assign({}, require('playwright').devices['iPhone 13']));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('teléfono: ' + e.message));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=suda2026_fesupo_full&estilo=panda`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof R === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
    await p.waitForTimeout(1200);
    await p.evaluate(([f, x]) => eval('(' + f + ')')(x), [MONTAR, { estilo: 'panda', logo: LOGO }]);
    const lv = await p.evaluate(() => { isAdmin = false; DATA.phase = 'liveView'; R();
      return { deco: (document.querySelector('.pvLv-rama svg') || {}).innerHTML || '', logo: (document.querySelector('.lv-cab .pvLv-logo') || { getAttribute: () => '' }).getAttribute('src'), sub: document.documentElement.getAttribute('data-estilo-sub') }; });
    ok(bambu(lv.deco) && lv.logo === LOGO && lv.sub === 'crema', 'Competencia en Vivo del espectador (teléfono): blanca, con bambú y el logo');
    const rm = await p.evaluate(() => { isAdmin = true; DATA.phase = 'remote'; R();
      return { deco: (document.querySelector('.pvRm-rama svg') || {}).innerHTML || '', logo: (document.querySelector('.pvRm .pvRm-logo') || { getAttribute: () => '' }).getAttribute('src'), btn: document.querySelectorAll('.pvRm-btn').length }; });
    ok(bambu(rm.deco) && rm.logo === LOGO && rm.btn >= 8, 'Control Remoto: bambú, el logo y los botones (' + rm.btn + ')');
    await ctx.close();
  }

  console.log('\nLirio sigue como estaba');
  {
    const { p, ctx } = await abrir('tx=director', 'lirio', LOGO);
    await p.evaluate(() => { _txDirState = JSON.parse(JSON.stringify(TX_DIR_DEFAULT)); _txDirState.scoreboard.active = true; _txDirLastSig = null; renderTxWidget(); });
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ rama: (document.querySelector('#txWidget .pvDeco-sb svg') || {}).innerHTML || '', logo: (document.querySelector('#txWidget .pvLogo') || {}).getAttribute ? document.querySelector('#txWidget .pvLogo').getAttribute('src') : '' }));
    ok(/#740221/i.test(r.rama) && !/#5B8E2B/i.test(r.rama), 'en Lirio la rama sigue con lirios');
    ok(r.logo === 'estilos/primavera/logo.webp', 'y con su logo de siempre');
    await ctx.close();
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

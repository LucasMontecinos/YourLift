// Pantalla cargadores (Pantalla Tarima → Intentos): la disposición de fábrica es
// la que dejó acomodada la mesa, y la toman todas las pantallas.
//
// - Arriba el movimiento y debajo el nombre del que está en tarima, centrado en
//   su altura sea cual sea el largo del nombre; la barra a la izquierda, el peso
//   a la derecha; abajo, centrado, quién sigue.
// - Abajo del peso: si lo levanta, en qué puesto queda (en los tres movimientos,
//   no solo en peso muerto), del tamaño de letra del nombre.
// - En la franja de abajo, a la derecha: cuántos atletas tiene la tanda.
// - Una pantalla que ya tenía posiciones guardadas de la disposición vieja parte
//   una vez con la nueva (si no, el televisor seguía como estaba); lo de
//   "Atleta en barra" no se toca. Y se sigue pudiendo mover todo.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cargadores.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const MONTAR = `(o)=>{
  const n9=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  const L=[['Catalina Andrea Rivas Fuentes de la Maza','Raíces Strength',300,'15'],['Josefa Paz Morales Ruiz','Club Primavera',330,'7'],
    ['Antonia Soto Lagos','Barra Libre',120,'9'],['Isidora Herrera Vidal','Hannya Barbell',140,'11'],['Florencia Díaz Mena','Barra Libre',100,'5']];
  DATA.athletes=L.map(([name,club,sq,rk],i)=>{const a={id:i+1,name,club,lot:100+i,flight:'A',sex:'Mujer',cat:'57',div:'Open',mod:'classic',bw:56,country:'CHI',bombed:false,att:n9(),rackSQ:rk};
    a.att.sq[0]={w:sq,r:null};return a;});
  DATA.athletes[2].att.sq[0].r='g'; DATA.athletes[3].att.sq[0].r='g';
  DATA.athletes[4].bombed=true;                      // fuera de competencia: no cuenta en la tanda
  if(o&&o.corto)DATA.athletes[0].name='Ana Paz';
  DATA.lift='sq'; DATA.round=0; DATA.flight='A'; DATA.forcedCurrent=1;
  DATA.event=Object.assign({},DATA.event||{},{estilo:o&&o.estilo||''});
  window._SCREEN_STATE={mode:'intentos',flights:null,fondo:'yourlift',luces:false};
  window._piSelected=null; renderTxWidget();
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const abrir = async (ctx, q) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept().catch(() => {}));
    await p.goto(`http://localhost:${PUERTO}/livecast.html?tx=screen&evento=suda2026_fesupo_full${q || ''}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
    await p.waitForTimeout(1200);
    return p;
  };
  const montar = (p, o) => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [MONTAR, o || {}]);
  const caja = (p, k) => p.evaluate(k => { const e = document.querySelector('.pi-block[data-pi-key="' + k + '"]>.pi-inner>*'); if (!e) return null;
    const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; }, k);

  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await abrir(ctx);

  console.log('\nLa disposición de fábrica');
  {
    await p.evaluate(() => { localStorage.removeItem(PI_LAYOUT_KEY); window._piLayout = _piLoadLayout(); });
    await montar(p);
    const W = 1920, H = 1080;
    const [lift, nom, sig, peso, barra, pos, nt] = await Promise.all(['liftLabel', 'name', 'next', 'weight', 'discos', 'position', 'nTanda'].map(k => caja(p, k)));
    ok(lift && nom && lift.cy < nom.cy, 'arriba el movimiento y debajo el nombre del que está en tarima');
    ok(nom && Math.abs(nom.cx - W / 2) < 4, 'el nombre va centrado (centro en ' + Math.round(nom.cx) + ' de ' + W + ')');
    ok(sig && Math.abs(sig.cx - W / 2) < 4 && sig.cy > H * 0.82, 'quién sigue, centrado abajo (' + Math.round(sig.cx) + ')');
    ok(barra && peso && barra.r < peso.l && peso.l > W / 2, 'la barra a la izquierda y el peso a la derecha');
    ok(pos && peso && pos.t > peso.b - 5 && pos.cx > W / 2, 'el puesto, abajo del peso');
    ok(nt && nt.cx > W * 0.85 && nt.cy > H * 0.89, 'los atletas de la tanda, abajo a la derecha');
    // Con un nombre corto sigue al medio: no queda pegado a donde empezaba el largo.
    await montar(p, { corto: true });
    const n2 = await caja(p, 'name');
    ok(n2 && Math.abs(n2.cx - W / 2) < 4 && n2.l > nom.l + 100, 'con un nombre corto también queda al medio (' + Math.round(n2.cx) + ')');
  }

  console.log('\nSi lo levanta, en qué puesto queda');
  {
    await montar(p);
    const t = await p.evaluate(() => (document.querySelector('.pi-block[data-pi-key="position"]') || {}).innerText || '');
    ok(/SI LO LEVANTA/.test(t) && /QUEDA 1° LUGAR/.test(t.replace(/\s+/g, ' ')), 'en sentadilla también (antes solo salía con el total): ' + t.replace(/\s+/g, ' '));
    const tam = await p.evaluate(() => {
      const f = s => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) * (window._piLayout[s.match(/"(\w+)"/)[1]].scale / 100) : 0; };
      return [f('.pi-block[data-pi-key="name"] .pi-inner>div'), f('.pi-block[data-pi-key="position"] .pi-inner>div>div:last-child')];
    });
    ok(tam[0] > 0 && Math.abs(tam[0] - tam[1]) < 1, 'del mismo tamaño de letra que el nombre (' + tam.map(x => Math.round(x)).join(' / ') + ' px)');
    // Ya tiene puesto: dice de cuál a cuál pasa.
    await p.evaluate(() => { const a = DATA.athletes[0]; a.att.sq[0] = { w: 110, r: 'g' }; a.att.sq[1] = { w: 150, r: null }; DATA.round = 1; renderTxWidget(); });
    const t2 = (await p.evaluate(() => (document.querySelector('.pi-block[data-pi-key="position"]') || {}).innerText || '')).replace(/\s+/g, ' ');
    ok(/PASA DEL 3° AL 1° LUGAR/.test(t2), 'si ya tiene puesto, de cuál a cuál pasa: ' + t2);
    // Y en banca, con el subtotal.
    await p.evaluate(() => { DATA.athletes.forEach(a => { a.att.sq = [{ w: 100, r: 'g' }, { w: 0, r: null }, { w: 0, r: null }]; a.att.bp = [{ w: 60, r: 'g' }, { w: 0, r: null }, { w: 0, r: null }]; });
      DATA.athletes[0].att.bp = [{ w: 50, r: 'g' }, { w: 70, r: null }, { w: 0, r: null }]; DATA.lift = 'bp'; DATA.round = 1; renderTxWidget(); });
    const t3 = (await p.evaluate(() => (document.querySelector('.pi-block[data-pi-key="position"]') || {}).innerText || '')).replace(/\s+/g, ' ');
    ok(/PASA DEL 4° AL 1° LUGAR/.test(t3), 'en banca, con sentadilla + banca: ' + t3);
  }

  console.log('\nCuántos atletas tiene la tanda');
  {
    await montar(p);
    const t = (await p.evaluate(() => (document.querySelector('.pi-block[data-pi-key="nTanda"]') || {}).innerText || '')).replace(/\s+/g, ' ');
    ok(/ATLETAS EN LA TANDA 4/.test(t), 'los que siguen en competencia en la tanda (el que quedó fuera no cuenta): ' + t);
  }

  console.log('\nSe sigue pudiendo mover, y queda guardado');
  {
    await montar(p);
    const c = await caja(p, 'name');
    await p.mouse.click(c.cx, c.cy); await p.waitForTimeout(120);
    await p.mouse.move(c.cx, c.cy); await p.mouse.down(); await p.mouse.move(c.cx - 200, c.cy + 60, { steps: 6 }); await p.mouse.up();
    await p.evaluate(() => { window._piSelected = null; renderTxWidget(); });
    const g = await p.evaluate(() => Object.assign({ verAhora: PI_LAYOUT_VER }, JSON.parse(localStorage.getItem(PI_LAYOUT_KEY) || '{}')));
    ok(g.name && g.name.x < 45 && g.__ver === g.verAhora, 'el nombre se arrastra y la posición queda guardada (x ' + (g.name && g.name.x.toFixed(1)) + ')');
    const p2 = await abrir(ctx);
    const x2 = await p2.evaluate(() => window._piLayout.name.x);
    ok(Math.abs(x2 - g.name.x) < 0.01, 'al volver a abrir la pantalla sigue donde se dejó');
    await p2.close();
  }

  console.log('\nUna pantalla con posiciones de antes toma la de fábrica nueva');
  {
    await p.evaluate(() => localStorage.setItem(PI_LAYOUT_KEY, JSON.stringify({ name: { x: 8, y: 67, scale: 100 }, weight: { x: 8, y: 43, scale: 100 }, logoN0: { x: 94, y: 4.5, scale: 100 }, bPeso: { x: 70, y: 20, scale: 120 } })));
    const p3 = await abrir(ctx);
    const r = await p3.evaluate(() => ({ name: window._piLayout.name, weight: window._piLayout.weight, bPeso: window._piLayout.bPeso, logoN0: _piPos('logoN0') }));
    ok(r.name.x === 50 && r.name.y === 22 && r.weight.x === 66.5, 'la Pantalla cargadores parte con la disposición nueva');
    ok(r.logoN0.x === 8.4 && r.logoN0.y === 17, 'el primer logo subido, donde va el de la federación');
    ok(r.bPeso.x === 70 && r.bPeso.scale === 120, 'lo acomodado en "Atleta en barra" se queda como estaba');
    await p3.close();
  }

  console.log('\nEn Lirio');
  {
    const p4 = await abrir(ctx, '&estilo=lirio');
    await p4.evaluate(() => localStorage.removeItem(PI_LAYOUT_KEY));
    await montar(p4, { estilo: 'lirio' });
    const c = await p4.evaluate(() => {
      const e = document.querySelector('.pi-block[data-pi-key="nTanda"]>.pi-inner>*');
      const r = document.querySelector('.pi-block[data-pi-key="record"] .sr-parpadea>div+div');
      return { nt: e ? getComputedStyle(e).color : '', rec: r ? getComputedStyle(r).color : 'sin récord' };
    });
    ok(c.nt === 'rgb(241, 226, 189)', 'los atletas de la tanda, en crema sobre la franja burdeo (' + c.nt + ')');
    ok(c.rec === 'sin récord' || c.rec === 'rgb(116, 2, 33)', 'las líneas chicas del récord se leen sobre el crema (' + c.rec + ')');
    await p4.close();
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

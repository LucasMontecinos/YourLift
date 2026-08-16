// Filtros de la pestaña Resultados: género, categoría, división de edad y
// modalidad. Los pidieron para las dos vistas, la del que opera y la del público.
//
// Lo que hay que cuidar acá no es que filtre —eso es fácil— sino que la POSICIÓN
// de los que quedan no se mueva. La tabla ya está agrupada por sexo + categoría +
// división, así que esos tres filtros tienen que sacar grupos enteros: si alguna
// vez sacaran medio grupo, un 3° pasaría a mostrarse como 1° y en una premiación
// eso es un desastre.
//
// Y las actas no se enteran de nada: siguen saliendo con el campeonato completo.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_resfiltros.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Lee la tabla dibujada: por cada atleta, su posición y en qué tabla salió.
const LEER = `(()=>{
  const filas=[];
  document.querySelectorAll('table').forEach(t=>{
    const tabla=(t.closest('.card')||{}).textContent||'';
    const titulo=/POWERLIFTING CLASSIC/.test(tabla)?'classic'
      :/POWERLIFTING EQUIPADO/.test(tabla)?'equipped'
      :/ONLY BENCH/.test(tabla)?'bench':/OLIMPIADAS/.test(tabla)?'oe':'?';
    t.querySelectorAll('tbody tr').forEach(tr=>{
      const c=tr.querySelectorAll('td');
      if(c.length<3)return;
      const pos=c[0].textContent.trim(), nom=c[1].textContent.trim();
      if(nom)filas.push({pos,nom,tabla:titulo});
    });
  });
  return filas;
})()`;

const MONTAR = `(()=>{
  isAdmin=true; window.IS_CONTROLLER=false; window.ADMIN_ROLE='admin';
  pickEvent(DATA.events.findIndex(e=>e.id==='suda2026_fesupo_full'));
  DATA.phase='results'; R();
  return { n: DATA.athletes.filter(a=>!a.__is4).length };
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length, null, { timeout: 15000 });
  const { n } = await p.evaluate(MONTAR);

  console.log('\nLa barra de filtros sale con lo que hay en el campeonato');
  const barra = await p.evaluate(() => {
    const sels = [...document.querySelectorAll('select')].filter(s => /Todos los géneros|Todas las/.test(s.textContent));
    return sels.map(s => ({ primera: s.options[0].textContent, n: s.options.length }));
  });
  ok(barra.length === 4, 'están los cuatro filtros (' + barra.length + ')');
  ok(barra.some(x => /géneros/.test(x.primera)), 'género');
  ok(barra.some(x => /categorías/.test(x.primera)), 'categoría');
  ok(barra.some(x => /divisiones/.test(x.primera)), 'división de edad');
  ok(barra.some(x => /modalidades/.test(x.primera)), 'modalidad');
  ok(barra.every(x => x.n > 1), 'ninguno viene vacío');

  const base = await p.evaluate(LEER);
  ok(base.length > 0, 'sin filtros la tabla trae ' + base.length + ' filas');

  console.log('\nFiltrar por género no mueve ninguna posición');
  const porSexo = await p.evaluate(([leer]) => {
    setResF('sex', 'F');
    return eval(leer);
  }, [LEER]);
  const baseM = base.filter(f => porSexo.some(x => x.nom === f.nom && x.tabla === f.tabla));
  ok(porSexo.length > 0 && porSexo.length < base.length,
     'quedan menos filas (' + porSexo.length + ' de ' + base.length + ')');
  ok(porSexo.every(f => {
       const antes = baseM.find(x => x.nom === f.nom && x.tabla === f.tabla);
       return antes && antes.pos === f.pos;
     }), 'y cada una conserva EXACTAMENTE la posición que tenía');

  console.log('\nPor categoría tampoco');
  const porCat = await p.evaluate(([leer]) => {
    limpiarResF(); setResF('cat', '83');
    return eval(leer);
  }, [LEER]);
  ok(porCat.length > 0 && porCat.length < base.length, 'quedan ' + porCat.length + ' filas');
  ok(porCat.every(f => {
       const antes = base.find(x => x.nom === f.nom && x.tabla === f.tabla);
       return antes && antes.pos === f.pos;
     }), 'las posiciones se mantienen');

  console.log('\nPor división de edad tampoco');
  const divs = await p.evaluate(() => {
    limpiarResF();
    return [...new Set(DATA.athletes.filter(a => !a.__is4).map(a => _normDiv(a.div || '')))].filter(Boolean);
  });
  const porDiv = await p.evaluate(([leer, d]) => {
    limpiarResF(); setResF('div', d);
    return eval(leer);
  }, [LEER, divs[0]]);
  ok(porDiv.length > 0, 'con "' + divs[0] + '" quedan ' + porDiv.length + ' filas');
  ok(porDiv.every(f => {
       const antes = base.find(x => x.nom === f.nom && x.tabla === f.tabla);
       return antes && antes.pos === f.pos;
     }), 'las posiciones se mantienen');

  console.log('\nLa modalidad deja una sola tabla');
  const porMod = await p.evaluate(([leer]) => {
    limpiarResF(); setResF('mod', 'bench');
    return eval(leer);
  }, [LEER]);
  ok(porMod.length > 0, 'Only Bench trae ' + porMod.length + ' filas');
  ok(porMod.every(f => f.tabla === 'bench'), 'y ninguna de otra modalidad');
  ok(porMod.every(f => {
       const antes = base.find(x => x.nom === f.nom && x.tabla === f.tabla);
       return antes && antes.pos === f.pos;
     }), 'con sus mismas posiciones');

  console.log('\nSe combinan entre sí');
  const combi = await p.evaluate(([leer]) => {
    limpiarResF();
    // Una combinación que exista de verdad en esta nómina: el primer atleta de
    // classic manda su género y su categoría.
    const a = DATA.athletes.filter(x => !x.__is4 && isMeetClassic(x))[0];
    const sex = _normSex(a.sex), cat = _normCat(a.cat || '');
    setResF('sex', sex); setResF('cat', cat); setResF('mod', 'classic');
    return { filas: eval(leer), sex, cat, texto: document.body.innerText };
  }, [LEER]);
  ok(combi.filas.length > 0, combi.sex + ' + ' + combi.cat + ' + classic: ' + combi.filas.length + ' filas');
  ok(combi.filas.every(f => f.tabla === 'classic'), 'todas de la tabla que se pidió');
  // Lo que de verdad importa: que lo dibujado sea lo pedido. Las columnas Div y Cat
  // de cada fila tienen que coincidir con el filtro, sin colados.
  const celdas = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('tbody tr').forEach(tr => {
      const c = tr.querySelectorAll('td');
      if (c.length >= 5) out.push({ cat: c[4].textContent.trim(), div: c[3].textContent.trim() });
    });
    return out;
  });
  ok(celdas.length > 0 && celdas.every(x => x.cat.includes(combi.cat)),
     'todas las filas son de la categoría pedida: ' + [...new Set(celdas.map(x => x.cat))].join(', '));
  ok(new Set(celdas.map(x => x.div)).size > 1,
     'y dentro conviven todas sus divisiones (' + new Set(celdas.map(x => x.div)).size + '), que es lo que se quiere ver');
  ok(/de \d+ atletas/.test(combi.texto), 'dice cuántos está mostrando de cuántos');
  ok(/Limpiar/.test(combi.texto), 'y ofrece limpiar');

  console.log('\n  Limpiar deja todo como estaba');
  const limpio = await p.evaluate(([leer]) => { limpiarResF(); return eval(leer); }, [LEER]);
  ok(limpio.length === base.length, 'vuelven las ' + base.length + ' filas');
  ok(limpio.every((f, i) => f.nom === base[i].nom && f.pos === base[i].pos),
     'en el mismo orden y con las mismas posiciones');

  console.log('\nUna combinación sin nadie lo dice, no deja la pantalla en blanco');
  const vacio = await p.evaluate(() => {
    limpiarResF(); setResF('cat', '43'); setResF('mod', 'equipped');
    return { txt: /NO HAY ATLETAS CON ESOS FILTROS/.test(document.body.innerText),
             btn: /Limpiar filtros/.test(document.body.innerText) };
  });
  ok(vacio.txt, 'avisa que no hay nadie');
  ok(vacio.btn, 'y deja el botón para salir de ahí');

  console.log('\nLas actas NO se filtran: son el campeonato completo');
  const acta = await p.evaluate(() => {
    limpiarResF();
    const todos = new Set(); _actaGrupos().forEach(g => g.filas.forEach(f => todos.add(f.a.id)));
    setResF('sex', 'F'); setResF('cat', '63');
    const conFiltro = new Set(); _actaGrupos().forEach(g => g.filas.forEach(f => conFiltro.add(f.a.id)));
    limpiarResF();
    return { todos: todos.size, conFiltro: conFiltro.size };
  });
  ok(acta.todos === acta.conFiltro,
     'con la pantalla filtrada el acta sigue trayendo a todos (' + acta.conFiltro + '/' + acta.todos + ')');

  console.log('\nEl espectador también los tiene');
  const pub = await p.evaluate(() => {
    isAdmin = false; DATA.phase = 'results'; R();
    const hay = [...document.querySelectorAll('select')].filter(s => /Todas las/.test(s.textContent)).length;
    setResF('cat', '83');
    const filas = document.querySelectorAll('tbody tr').length;
    limpiarResF();
    // Los botones de acta de verdad, no el texto: en el body vive también el
    // <script> de la página y ahí "Generar Acta PDF" aparece como literal.
    const acta = [...document.querySelectorAll('button')].some(x => /Acta/.test(x.textContent));
    return { hay, filas, acta };
  });
  ok(pub.hay >= 3, 'los filtros están en la vista del público (' + pub.hay + ')');
  ok(pub.filas > 0, 'y funcionan (' + pub.filas + ' filas al filtrar por 83)');
  ok(!pub.acta, 'sin que se le aparezcan los botones de acta');

  console.log('\nCambiar de campeonato limpia los filtros');
  const cambio = await p.evaluate(() => {
    isAdmin = true;
    setResF('cat', '43'); setResF('mod', 'equipped');
    pickEvent(DATA.events.findIndex(e => e.id === 'suda2026_fesupo_full'));
    return JSON.stringify(window._RES_F);
  });
  ok(cambio === '{"sex":"","cat":"","div":"","mod":""}',
     'el evento nuevo abre sin filtros puestos (' + cambio + ')');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

// Medallero por movimiento, y los menús del Control Remoto.
//
// Los campeonatos pasaron a premiar por movimiento: las tres mejores sentadillas
// de la -83 Junior, las tres mejores bancas, los tres mejores pesos muertos, y
// aparte los tres mejores totales. Antes el medallero solo sabía de totales.
//
// Y el orden estaba a medias: ordenaba por el número y nada más, así que tres
// atletas con 190 kg quedaban en el orden en que aparecían en la lista. El
// desempate de la IPF es por peso corporal —gana el más liviano— y si también
// empatan, por lote: el que pesó antes.
//
// En el Control Remoto, MEDALLERO llamaba a dirToggle('medals') sin decir cuál:
// se ponía en verde y en pantalla no salía nada. Ahora abre el menú. Y el cartel
// de descanso, que no estaba en el remoto, pregunta los minutos.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_medallero2.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Una categoría con empates a propósito, que es donde se nota el criterio.
const MONTAR = `(()=>{
  const att=(sq,bp,dl)=>({
    sq:[{w:sq,r:'g'},{w:0,r:null},{w:0,r:null}],
    bp:[{w:bp,r:'g'},{w:0,r:null},{w:0,r:null}],
    dl:[{w:dl,r:'g'},{w:0,r:null},{w:0,r:null}]});
  // Los tres primeros empatan en peso muerto (190) y se separan por peso corporal.
  const A=[
    {id:1,name:'Pesado Empate',   lot:5, bw:82.9, sq:200,bp:120,dl:190},
    {id:2,name:'Liviano Empate',  lot:9, bw:80.1, sq:190,bp:130,dl:190},
    {id:3,name:'Medio Empate',    lot:2, bw:81.5, sq:210,bp:110,dl:190},
    // Estos dos empatan en TODO salvo el lote, y con una sentadilla que SÍ entra
    // al podio: si no, el criterio de lote nunca se llega a ejercitar.
    {id:4,name:'Lote Alto',       lot:40,bw:83.0, sq:210,bp:100,dl:150},
    {id:5,name:'Lote Bajo',       lot:11,bw:83.0, sq:210,bp:100,dl:150},
  ].map(x=>({id:x.id,name:x.name,lot:x.lot,flight:'A',sex:'Hombre',cat:'83',div:'Junior',
             mod:'classic',bw:x.bw,club:'',country:'CHI',bombed:false,att:att(x.sq,x.bp,x.dl)}));
  DATA.athletes=A; DATA.lift='dl'; DATA.round=0; DATA.flight='A';
  DATA.event={id:'x',name:'Prueba'};
  return A.length;
})()`;

const TOP = `(tipo)=>{
  const r=_medalTop3({mod:'classic',sex:'Hombre',div:'Junior',cat:'83',tipo:tipo});
  return r.map(x=>({nombre:x.a.name, valor:x.valor, bw:x.a.bw, lot:x.a.lot}));
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // SIN ?evento=: con un evento en la URL, la página carga su nómina de forma
  // asíncrona y pisa el escenario de la prueba a mitad de camino. Se vio: el podio
  // pasaba a tener 0 atletas de un momento a otro. Sin evento no hay carga que
  // interfiera, y el escenario se arma acá.
  await p.goto('http://localhost:8972/livecast.html',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof _medalTop3 === 'function',
    null, { timeout: 20000 });
  const n = await p.evaluate(MONTAR);
  const top = t => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [TOP, t]);
  ok(n === 5, 'categoría de prueba con ' + n + ' atletas');

  console.log('\nHay un medallero por movimiento, no solo del total');
  {
    const sq = await top('sq'), bp = await top('bp'), dl = await top('dl'), tot = await top('total');
    ok(sq[0].nombre === 'Medio Empate' && sq[0].valor === 210, 'la mejor sentadilla es 210: ' + sq[0].nombre);
    ok(bp[0].nombre === 'Liviano Empate' && bp[0].valor === 130, 'la mejor banca es 130: ' + bp[0].nombre);
    ok(dl[0].valor === 190, 'el mejor peso muerto es 190');
    ok(tot[0].valor === 520 || tot[0].valor === 510,
       'y el total suma los tres movimientos: ' + tot[0].valor);
    ok(new Set([sq[0].nombre, bp[0].nombre].join()).size > 0 && sq[0].nombre !== bp[0].nombre,
       'cada premio puede ser de otra persona — por eso son cuatro medalleros');
  }

  console.log('\nA igual marca, gana el más liviano');
  {
    // Los tres levantaron 190 en peso muerto.
    const dl = await top('dl');
    ok(dl.length === 3, 'hay podio de tres (' + dl.length + ')');
    ok(dl.every(x => x.valor === 190), 'los tres con la misma marca');
    ok(dl[0].nombre === 'Liviano Empate', '1° el de 80,1 kg: ' + dl[0].nombre);
    ok(dl[1].nombre === 'Medio Empate', '2° el de 81,5 kg: ' + dl[1].nombre);
    ok(dl[2].nombre === 'Pesado Empate', '3° el de 82,9 kg: ' + dl[2].nombre);
    ok(dl[0].bw < dl[1].bw && dl[1].bw < dl[2].bw,
       'de menor a mayor peso corporal (' + dl.map(x => x.bw).join(' < ') + ')');
  }

  console.log('\n  Y si también empatan en peso corporal, manda el lote menor');
  {
    const sq = await top('sq');
    // Tres levantaron 210: primero el de 81,5 kg, y los dos de 83,0 se ordenan por lote.
    ok(sq.every(x => x.valor === 210), 'el podio de sentadilla es un triple empate en 210');
    ok(sq[0].nombre === 'Medio Empate', '1° el más liviano de los tres: ' + sq[0].nombre);
    const empatados = sq.filter(x => x.bw === 83);
    ok(empatados.length === 2, 'los dos que empatan en marca y en peso (' + empatados.length + ')');
    ok(empatados[0].lot < empatados[1].lot,
       'primero el lote ' + empatados[0].lot + ', después el ' + empatados[1].lot);
    ok(empatados[0].nombre === 'Lote Bajo', 'que es ' + empatados[0].nombre);
  }
  ok(/\(\(x\.a\.bw\|\|0\)-\(y\.a\.bw\|\|0\)\)/.test(src), 'el desempate por peso corporal está en el código');
  ok(/\(\(x\.a\.lot\|\|9999\)-\(y\.a\.lot\|\|9999\)\)/.test(src), 'y el de lote también');

  console.log('\nEl que no tiene marca válida no entra al podio');
  {
    await p.evaluate(() => {
      DATA.athletes.push({id:9,name:'Sin Marca',lot:99,flight:'A',sex:'Hombre',cat:'83',div:'Junior',
        mod:'classic',bw:79,club:'',country:'CHI',bombed:false,
        att:{sq:[{w:200,r:'n'},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]}});
    });
    const sq = await top('sq');
    ok(!sq.some(x => x.nombre === 'Sin Marca'),
       'un intento nulo no cuenta, por más que sea el más liviano');
  }

  console.log('\nSe dibuja con el título del premio');
  {
    for (const [t, txt] of [['sq', 'SENTADILLA'], ['bp', 'PRESS DE BANCA'], ['dl', 'PESO MUERTO'], ['total', 'TOTAL']]) {
      const html = await p.evaluate(x => renderTxMedals({ mod: 'classic', sex: 'Hombre', div: 'Junior', cat: '83', tipo: x }), t);
      ok(html.indexOf(txt) >= 0, t + ' → "' + txt + '"');
    }
    const html = await p.evaluate(() => renderTxMedals({ mod: 'classic', sex: 'Hombre', div: 'Junior', cat: '83', tipo: 'dl' }));
    ok(/190\.0/.test(html), 'y el número que se muestra es el del movimiento, no el total');
  }

  console.log('\n  Un medallero viejo, sin tipo, sigue siendo el del total');
  {
    const html = await p.evaluate(() => renderTxMedals({ mod: 'classic', sex: 'Hombre', div: 'Junior', cat: '83' }));
    ok(html.indexOf('TOTAL') >= 0, 'no se rompe ni cambia de premio solo');
  }

  console.log('\nEn el Control Remoto, MEDALLERO abre el menú');
  {
    await p.evaluate(() => { isAdmin = true; DATA.phase = 'remote'; window._remoteMenu = ''; R(); });
    let txt = await p.evaluate(() => document.body.innerText);
    ok(/MEDALLERO/.test(txt), 'está el botón');
    ok(!/QUÉ MEDALLERO MOSTRAR/.test(txt), 'y el menú arranca cerrado');
    await p.evaluate(() => remoteMenu('medals'));
    txt = await p.evaluate(() => document.body.innerText);
    ok(/QUÉ MEDALLERO MOSTRAR/.test(txt), 'al apretarlo se abre');
    for (const t of ['TOTAL', 'SENTADILLA', 'PRESS DE BANCA', 'PESO MUERTO'])
      ok(txt.indexOf(t) >= 0, 'con la opción ' + t);
    const selects = await p.evaluate(() => document.querySelectorAll('select').length);
    ok(selects >= 4, 'y los cuatro selectores de categoría (' + selects + ')');
  }

  console.log('\n  No deja mostrar un podio vacío');
  {
    const antes = await p.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /MOSTRAR EN PANTALLA/.test(x.textContent));
      return b ? b.disabled : null;
    });
    ok(antes === true, 'sin elegir categoría, el botón está deshabilitado');
    await p.evaluate(() => {
      dirMdSet('mod', 'classic'); dirMdSet('sex', 'Hombre'); dirMdSet('div', 'Junior'); dirMdSet('cat', '83');
    });
    const despues = await p.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /MOSTRAR EN PANTALLA/.test(x.textContent));
      return b ? b.disabled : null;
    });
    ok(despues === false, 'con la categoría elegida se habilita');
    const txt = await p.evaluate(() => document.body.innerText);
    ok(/Listo: 3 en el podio/.test(txt), 'y avisa cuántos van a salir');
  }

  console.log('\n  Cambiar el premio no borra la categoría elegida');
  {
    await p.evaluate(() => dirMdSet('tipo', 'dl'));
    const sel = await p.evaluate(() => JSON.parse(JSON.stringify(window._mdSel)));
    ok(sel.cat === '83' && sel.div === 'Junior' && sel.tipo === 'dl',
       'sigue en -83 Junior, ahora peso muerto — en la ceremonia se pasan los cuatro seguidos');
  }

  console.log('\nY el descanso pregunta los minutos');
  {
    await p.evaluate(() => { window._remoteMenu = ''; R(); });
    let txt = await p.evaluate(() => document.body.innerText);
    ok(/YA VOLVEMOS/.test(txt), 'está el botón de descanso en el remoto');
    ok(!/CUÁNTOS MINUTOS/.test(txt), 'con el menú cerrado');
    await p.evaluate(() => remoteMenu('break'));
    txt = await p.evaluate(() => document.body.innerText);
    ok(/CUÁNTOS MINUTOS/.test(txt), 'al apretarlo pregunta');
    for (const m of ['5', '10', '15', '20', '30', '45'])
      ok(new RegExp('\\b' + m + '\\b').test(txt), 'con el atajo de ' + m + ' min');
    ok(await p.evaluate(() => !!document.getElementById('remoteBreakMin')),
       'y un campo para poner otro número');
  }

  console.log('\n  Arranca el descanso sin depender del Control TX');
  {
    const i = src.indexOf('window.remoteBreakStart=async function');
    const cuerpo = src.slice(i, src.indexOf('\n};', i));
    ok(!/getElementById\('dirBreak/.test(cuerpo),
       'no lee los campos del Control TX, que en el teléfono no existen');
    ok(/Object\.assign\(\{\},previo,/.test(cuerpo),
       'y conserva el estilo y los videos que ya estaban configurados allá');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

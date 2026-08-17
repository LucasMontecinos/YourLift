// Buscar en Atletas & Pesaje.
//
// El Sudamericano va a ir entero en un solo link: 552 atletas, nueve días y tandas
// hasta la Z. La tabla se dibujaba de corrido, así que en el cuarto día encontrar a
// alguien era bajar por quinientas filas.
//
// Lo que hay que cuidar: el filtro es SOLO de lo que se dibuja. Los lotes, el orden
// y todo lo que se calcula tienen que seguir viendo la nómina completa — si
// "Generar Lotes" mirara lo filtrado, sortearía media competencia.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_buscaratletas.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Una nómina como la del Sudamericano: muchas tandas, varios países.
const MONTAR = `(()=>{
  const n9=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  const NOM=['Vergara Baricih','Molina Rios','Silva Terrazas','Fortino Silva','Salinas Tapia',
             'Olivares Gutierrez','Anderson Perez','Figueroa Contreras'];
  const PAIS=['CHI','ARG','BRA','PER','COL','URU','BOL','ECU'];
  const TAN=['A','B','C','D','E','F','G','H','I','J','K','L'];
  const CAT=['59','66','74','83','93','105','120'];
  const CLUB=['Athor','Black Bars','Primal','All Power','Hannya'];
  const out=[];
  for(let i=0;i<180;i++){
    out.push({id:i+1,name:'Atleta'+i+' '+NOM[i%NOM.length],lot:100+i,flight:TAN[i%TAN.length],
      sex:i%3?'Hombre':'Mujer',cat:CAT[i%CAT.length],div:'Open',mod:'classic',
      bw:0,club:CLUB[i%CLUB.length],country:PAIS[i%PAIS.length],bombed:false,att:n9()});
  }
  // Uno inconfundible, para buscarlo por nombre.
  out[77].name='Benjamin Ignacio Garcia Pino'; out[77].club='Hannya'; out[77].cat='93';
  out[77].flight='H'; out[77].country='CHI'; out[77].lot=777;
  DATA.athletes=out;
  isAdmin=true; DATA.phase='manage';
  window._MAN_F={q:'',flight:''};
  R();
  return out.length;
})()`;

const FILAS = () => document.querySelectorAll('table tbody tr').length
  || [...document.querySelectorAll('tr')].filter(t => t.querySelector('input[type=number]')).length;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes, null, { timeout: 20000 });
  const total = await p.evaluate(MONTAR);

  console.log('\nLa barra de búsqueda está');
  const base = await p.evaluate(FILAS);
  ok(total === 180, 'la nómina de prueba tiene ' + total + ' atletas');
  ok(base === total, 'sin filtrar se dibujan todas las filas (' + base + ')');
  ok(await p.evaluate(() => !!document.getElementById('manQ')), 'hay un buscador');
  ok(await p.evaluate(() => /180 atletas/.test(document.body.innerText)), 'y dice cuántos hay');

  console.log('\nBuscar por nombre');
  let r = await p.evaluate(() => { manBuscar('garcia pino'); return {
    filas: document.querySelectorAll('table tbody tr').length,
    txt: document.body.innerText }; });
  ok(r.filas === 1, 'queda una sola fila (' + r.filas + ')');
  ok(/Benjamin Ignacio Garcia Pino/.test(r.txt), 'y es el que se buscaba');
  ok(/mostrando 1 de 180/.test(r.txt), 'dice cuántos está mostrando de cuántos');

  console.log('\n  Sirve también por club, país, categoría y lote');
  for (const [q, espera] of [['hannya', n => n > 1], ['777', n => n === 1], ['bra', n => n > 1]]) {
    const n = await p.evaluate(x => { manBuscar(x); return document.querySelectorAll('table tbody tr').length; }, q);
    ok(espera(n), '"' + q + '" → ' + n + ' filas');
  }

  console.log('\n  Y todas las palabras tienen que aparecer');
  {
    const n = await p.evaluate(() => { manBuscar('garcia 93'); return document.querySelectorAll('table tbody tr').length; });
    ok(n === 1, '"garcia 93" encuentra solo al de la -93 (' + n + ')');
    const cero = await p.evaluate(() => { manBuscar('garcia 59'); return {
      filas: document.querySelectorAll('table tbody tr').length, txt: document.body.innerText }; });
    ok(/Ningún atleta con esa búsqueda/.test(cero.txt), 'y si no hay nadie, lo dice');
  }

  console.log('\nFiltrar por tanda');
  {
    const r2 = await p.evaluate(() => { manLimpiar(); manTanda('H'); return {
      filas: document.querySelectorAll('table tbody tr').length,
      tandas: [...document.querySelectorAll('table tbody tr')]
        .map(t => (t.querySelector('select') || {}).value) }; });
    ok(r2.filas > 0 && r2.filas < 180, 'la tanda H deja ' + r2.filas + ' de 180');
    ok(r2.tandas.every(t => t === 'H'), 'y todas son de la H');
    const otra = await p.evaluate(() => { manTanda('H'); return document.querySelectorAll('table tbody tr').length; });
    ok(otra === 180, 'volver a apretarla la desactiva (' + otra + ')');
  }

  console.log('\n  Búsqueda y tanda se combinan');
  {
    const n = await p.evaluate(() => { manLimpiar(); manTanda('H'); manBuscar('garcia');
      return document.querySelectorAll('table tbody tr').length; });
    ok(n === 1, 'tanda H + "garcia" → ' + n);
  }

  console.log('\nLimpiar devuelve todo');
  {
    const n = await p.evaluate(() => { manLimpiar(); return document.querySelectorAll('table tbody tr').length; });
    ok(n === 180, 'vuelven las 180 filas');
  }

  console.log('\nLo que se calcula NO mira el filtro');
  {
    const r3 = await p.evaluate(() => {
      manTanda('H'); manBuscar('garcia');            // en pantalla queda 1 fila
      const visibles = document.querySelectorAll('table tbody tr').length;
      // Lo que operan los botones sigue siendo la nómina entera.
      const enMemoria = DATA.athletes.length;
      const tandas = new Set(DATA.athletes.map(a => a.flight)).size;
      manLimpiar();
      return { visibles, enMemoria, tandas };
    });
    ok(r3.visibles === 1, 'la pantalla muestra 1');
    ok(r3.enMemoria === 180, 'pero la nómina en memoria sigue con 180');
    ok(r3.tandas === 12, 'y con sus 12 tandas');
  }
  ok(/window\._MAN_F=\{q:'',flight:''\};/.test(src), 'el filtro vive aparte de los datos');
  ok(!/DATA\.athletes=_visibles/.test(src), 'nunca se reemplaza la nómina con lo filtrado');

  console.log('\nSe puede escribir de corrido sin perder el cursor');
  {
    await p.evaluate(() => manLimpiar());
    await p.click('#manQ');
    await p.type('#manQ', 'garcia', { delay: 40 });
    const r4 = await p.evaluate(() => ({
      valor: document.getElementById('manQ').value,
      foco: document.activeElement && document.activeElement.id,
      filas: document.querySelectorAll('table tbody tr').length,
    }));
    ok(r4.valor === 'garcia', 'el texto queda completo: "' + r4.valor + '"');
    ok(r4.foco === 'manQ', 'y el cursor no se pierde entre letra y letra');
    ok(r4.filas === 1, 'filtrando mientras se escribe (' + r4.filas + ')');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

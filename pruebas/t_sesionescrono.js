// Sesiones por día y turno en regionales y campeonatos creados en el panel.
//
// Se pidió así, igual que en el Sudamericano: en el Cronograma se pone a cada
// tanda su día y su turno, y Control en Vivo corre juntas las tandas de la misma
// sesión. Con A y B el día 1 en la mañana, C y D el día 1 en la tarde, E y F el
// día 2 en la mañana y G el día 2 en la tarde:
//
//   sentadilla A, B → banca A, B → peso muerto A, B →
//   sentadilla C, D → banca C, D → peso muerto C, D → … y así.
//
// El motor de sesiones ya existía para el Sudamericano, pero solo entendía su
// formato ("D1 20/09 · 09:00 · Sesión A"). Las jornadas que arma el Cronograma
// del panel ("Día 1 · AM") no daban fila de días, y el orden de las sesiones
// dependía solo de la letra de la tanda.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_sesionescrono.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Monta el campeonato: tandas con su día y turno tal como los escribe el Cronograma.
const MONTAR = `(plan)=>{
  // Los primeros intentos se declaran en el pesaje: todos los traen desde el
  // arranque. (Una tanda sin nada declarado se da por terminada.)
  const n9=()=>({sq:[{w:100,r:null},{w:0,r:null},{w:0,r:null}],
                 bp:[{w:60,r:null},{w:0,r:null},{w:0,r:null}],
                 dl:[{w:120,r:null},{w:0,r:null},{w:0,r:null}]});
  const out=[]; let id=0;
  plan.forEach(([fl,dia,turno])=>{
    for(let i=0;i<3;i++){
      out.push({id:++id,lot:id,name:'Atleta '+fl+i,flight:fl,sex:'Hombre',cat:'83',div:'Open',
        mod:'classic',bw:80,club:'X',country:'CHI',bombed:false,att:n9(),
        jornada:_cronoJor({dia:dia,jornada:turno})});
    }
  });
  DATA.athletes=out; DATA.phase='compete'; DATA.lift='sq'; DATA.round=0;
  DATA.flight=_allFlightsSorted()[0];
  window._DIA_SEL={};
  return out.map(a=>a.flight+'='+a.jornada).filter((x,i,arr)=>arr.indexOf(x)===i);
}`;
// Corre la competencia entera: cada ronda se juzga completa y se pide a dónde
// sigue. Devuelve la secuencia de tandas por movimiento, como la vería la tarima.
const CORRER = `()=>{
  const pasos=[]; let c={flight:DATA.flight,lift:DATA.lift,round:0}; let guard=0;
  while(c&&guard++<500){
    DATA.flight=c.flight; DATA.lift=c.lift; DATA.round=c.round;
    if(c.round===0)pasos.push(c.lift.toUpperCase()+' '+c.flight);
    DATA.athletes.filter(a=>a.flight===c.flight).forEach(a=>{a.att[c.lift][c.round]={w:100+c.round*5,r:'g'};});
    c=_cursorSiguiente();
  }
  return pasos;
}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/livecast.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof _cursorSiguiente === 'function', null, { timeout: 25000 });
  await p.waitForTimeout(800);
  const montar = plan => p.evaluate(([f, x]) => eval('(' + f + ')')(x), [MONTAR, plan]);
  const correr = () => p.evaluate(f => eval('(' + f + ')')(), CORRER);

  console.log('\nEl ejemplo: dos días, mañana y tarde');
  {
    const j = await montar([['A', 'Día 1', 'AM'], ['B', 'Día 1', 'AM'], ['C', 'Día 1', 'PM'], ['D', 'Día 1', 'PM'],
                            ['E', 'Día 2', 'AM'], ['F', 'Día 2', 'AM'], ['G', 'Día 2', 'PM']]);
    ok(j.includes('A=Día 1 · AM') && j.includes('G=Día 2 · PM'), 'la jornada sale del Cronograma: "Día 1 · AM"');
    const pasos = await correr();
    const esperado = [
      'SQ A', 'SQ B', 'BP A', 'BP B', 'DL A', 'DL B',
      'SQ C', 'SQ D', 'BP C', 'BP D', 'DL C', 'DL D',
      'SQ E', 'SQ F', 'BP E', 'BP F', 'DL E', 'DL F',
      'SQ G', 'BP G', 'DL G'];
    ok(pasos.join(' | ') === esperado.join(' | '), 'la competencia avanza sesión por sesión:\n      ' + pasos.join(' → '));
  }

  console.log('\n  Las tandas de la tarde con letras antes que las de la mañana');
  {
    // Quien arma el Cronograma no siempre pone las letras en orden de horario.
    await montar([['A', 'Día 1', 'PM'], ['B', 'Día 1', 'PM'], ['C', 'Día 1', 'AM'], ['D', 'Día 1', 'AM']]);
    const r = await p.evaluate(() => ({ orden: _jornadasEnOrden(), primera: _allFlightsSorted()[0] }));
    ok(r.orden[0] === 'Día 1 · AM', 'la mañana va primero aunque su letra sea la C: ' + r.orden.join(' → '));
  }

  console.log('\n  Días con nombre');
  {
    await montar([['A', 'Domingo 9', 'AM'], ['B', 'Sábado 8', 'AM'], ['C', 'Sábado 8', 'PM']]);
    const r = await p.evaluate(() => ({ dias: _diasDelCampeonato(), orden: _jornadasEnOrden(),
      porDia: _tandasPorDia(_allFlightsSorted()) }));
    ok(r.dias.join(',') === 'Sábado 8,Domingo 9', 'el sábado va antes que el domingo: ' + r.dias.join(', '));
    ok(r.orden.join(' | ') === 'Sábado 8 · AM | Sábado 8 · PM | Domingo 9 · AM', 'y las sesiones en ese orden');
    ok(JSON.stringify(r.porDia) === JSON.stringify({ 1: ['B', 'C'], 2: ['A'] }), 'cada tanda cae en su día');
  }

  console.log('\nLa fila de días aparece como en el Sudamericano');
  {
    await montar([['A', 'Día 1', 'AM'], ['B', 'Día 1', 'PM'], ['C', 'Día 2', 'AM']]);
    const r = await p.evaluate(() => {
      const fd = _filaDias('publico', _allFlightsSorted(), _diaDeTanda(DATA.flight));
      return { html: fd.html, tandas: fd.tandas };
    });
    ok(/VER DÍA/.test(r.html) && /DÍA 1/.test(r.html) && /DÍA 2/.test(r.html), 'con los dos días');
    ok(r.tandas.join(',') === 'A,B', 'y arranca en el día que está en tarima, con sus tandas');
    const et = await p.evaluate(() => _sesionEtiqueta('B'));
    ok(et === 'DÍA 1 · TARDE', 'el operador ve la sesión de cada tanda: ' + et);
  }

  console.log('\n  Un campeonato de un solo día, con mañana y tarde');
  {
    await montar([['A', '', 'AM'], ['B', '', 'AM'], ['C', '', 'PM']]);
    const r = await p.evaluate(() => ({ fila: _filaDias('publico', _allFlightsSorted(), null).html,
      pasos: null }));
    ok(r.fila === '', 'no hay fila de días (hay uno solo)');
    const pasos = await correr();
    ok(pasos.join(' | ') === 'SQ A | SQ B | BP A | BP B | DL A | DL B | SQ C | BP C | DL C',
       'pero sí las dos sesiones: ' + pasos.join(' → '));
  }

  console.log('\n  Y sin días ni turnos, todo es una sola sesión, como siempre');
  {
    await montar([['A', '', ''], ['B', '', ''], ['C', '', '']]);
    const pasos = await correr();
    ok(pasos.join(' | ') === 'SQ A | SQ B | SQ C | BP A | BP B | BP C | DL A | DL B | DL C',
       'sentadilla de todas, después banca, después peso muerto');
  }

  console.log('\nEl formato del Sudamericano sigue funcionando');
  {
    const r = await p.evaluate(() => ({
      d: _jornadaPartes('D3 22/09 · 14:30 · Sesión F'),
      t: _turnoDe('Mañana') + _turnoDe('tarde') + _turnoDe('P.M.'),
    }));
    ok(r.d.num === 3 && r.d.fecha === '22/09' && r.d.hora === 14 * 60 + 30, 'día, fecha y hora');
    ok(r.t === 'AMPMPM', 'y el turno se entiende escrito de varias formas');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

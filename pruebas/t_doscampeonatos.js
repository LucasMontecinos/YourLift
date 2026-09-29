// Dos campeonatos a la misma hora, en computadores distintos, sin mezclarse.
//
// Se pidió así: el Regional Centro en un computador y el Regional Sur en otro,
// el mismo día y a la misma hora, en el mismo recinto o no. Control en Vivo,
// Control TX, la pantalla de tarima, los jueces y el público de cada uno, sin
// que nada de uno aparezca en el otro.
//
// Casi todo ya iba por campeonato: el estado de la competencia, el canal rápido
// del público, la pantalla de tarima, Control TX y los récords usan documentos
// cuyo id sale del nombre del campeonato. Faltaban las luces de los jueces y la
// señal del cronómetro: tenían un id FIJO ('current', o 'current_T1' con dos
// tarimas), así que el juez del Sur encendía la pantalla del Centro.
//
// La prueba abre cada pantalla con un Firestore falso que anota todo lo que se
// escribe y se escucha, y verifica que ningún documento de uno lo toque el otro.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_doscampeonatos.js
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const CENTRO = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026',
  canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };
const SUR = { id: 'regional_sur_austral_2026', name: 'Regional Sur Austral Noviembre 2026',
  canal: 'Regional_Sur_Austral_Noviembre_2026' };
// Los canales que se sincronizan en vivo. Todos tienen que ser del campeonato.
const VIVO = ['livecast_sync', 'livecast_flash', 'livecast_screen', 'livecast_director', 'livecast_record',
  'judge_decisions', 'timer_control'];

function base() {
  const nueve = () => ({ sq: [{ w: 100, r: null }, { w: 0, r: null }, { w: 0, r: null }],
    bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
  const atletas = suf => JSON.stringify([1, 2, 3].map(i => ({ id: i, lot: i, name: 'Atleta ' + i + ' ' + suf,
    flight: 'A', sex: 'Hombre', cat: '83', div: 'Open', mod: 'classic', bw: 80, club: 'Club ' + suf, att: nueve() })));
  const sync = (ev, suf) => ({ id: ev.canal, athletes: atletas(suf), flight: 'A', lift: 'sq', round: 0,
    changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: false, forcedCurrent: null, timer: 60, timerOn: false });
  const insc = [];
  [[CENTRO, 'Centro'], [SUR, 'Sur']].forEach(([ev, suf]) => { for (let i = 1; i <= 3; i++)
    insc.push({ id: suf + i, evento: ev.id, status: 'approved', nombre: 'Atleta ' + i + ' ' + suf, rut: '1' + i + '-' + suf.length,
      fechaNac: '1995-01-01', categoria: '-83 kg', division: 'Open', sexo: 'Hombre', club: 'Club ' + suf }); });
  return {
    eventos: [
      { id: CENTRO.id, name: CENTRO.name, status: 'open', publicoVisible: true, livecastVisible: true },
      { id: SUR.id, name: SUR.name, status: 'open', publicoVisible: true, livecastVisible: true },
      { id: 'viejo', name: 'Campeonato Archivado', status: 'archived', livecastVisible: false },
    ],
    inscripciones: insc, atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
    admins: [{ id: 'u', role: 'admin' }],
    livecast_sync: [sync(CENTRO, 'Centro'), sync(SUR, 'Sur')],
  };
}

async function abrir(b, url, admin, vista) {
  const ctx = await b.newContext({ viewport: vista || { width: 1300, height: 900 }, serviceWorkers: 'block' });
  await montarFirebase(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([d, adm]) => { window.__FAKE = d; window.__LEC = [];
    if (adm) window.__AUTH = { uid: 'u', email: 'a@b.cl' }; }, [base(), !!admin]);
  await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
  return { p, ctx, errs };
}
const lecturas = p => p.evaluate(() => (window.__LEC || []).filter(x => x.id !== undefined));
// Los documentos en vivo que una pantalla ESCRIBIÓ, y los que sigue ESCUCHANDO
// (se abrió un oyente y no se soltó).
function resumen(lec) {
  const esc = new Set(), abiertos = new Map();
  lec.forEach(x => {
    if (VIVO.indexOf(x.col) < 0) return;
    const k = x.col + '/' + x.id;
    if (x.op === 'escribe') esc.add(k);
    if (x.op === 'oyente') abiertos.set(k, (abiertos.get(k) || 0) + 1);
    if (x.op === 'suelta') abiertos.set(k, (abiertos.get(k) || 0) - 1);
  });
  return { escribe: [...esc], escucha: [...abiertos].filter(([, n]) => n > 0).map(([k]) => k) };
}
const delCampeonato = (docs, ev) => docs.every(k => k.split('/')[1].indexOf(ev.canal) >= 0);

// El operador de un campeonato: entra por su link, compite y usa todo lo que
// escribe en Firestore (luces, pantalla, director, récords).
async function operar(b, ev, tarima) {
  const r = await abrir(b, 'livecast.html?evento=' + ev.id + (tarima ? '&tarima=' + tarima : ''), true);
  await r.p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.phase === 'manage', null, { timeout: 20000 });
  await r.p.evaluate(async () => {
    DATA.phase = 'compete'; R();                                  // avisa a los jueces quién está en la barra
    save();                                                        // estado de la competencia
    await resetJudgeLights();
    await _screenPush();
    await _dirPush();
    await pushRecordToFB({ athName: 'x', lift: 'sq', round: 0, newMark: 1, oldMark: 0, ts: Date.now() });
    if (!judgeMode) await toggleJudgeMode();                      // escucha las luces y el cronómetro
  });
  await r.p.waitForTimeout(2500);
  r.info = await r.p.evaluate(() => ({ juez: juezDocId(), canal: fbDocId(), atletas: DATA.athletes.map(a => a.name),
    link: (() => { DATA.phase = 'obsTx'; R(); const l = [...document.querySelectorAll('input[readonly]')].map(i => i.value)
      .find(v => /jueces\.html/.test(v)); DATA.phase = 'compete'; R(); return l; })() }));
  r.res = resumen(await lecturas(r.p));
  return r;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const errs = [];

  console.log('\nControl en Vivo: el Centro en un computador, el Sur en otro');
  const c = await operar(b, CENTRO); errs.push(...c.errs);
  const s = await operar(b, SUR); errs.push(...s.errs);
  ok(c.info.atletas.every(n => /Centro$/.test(n)) && s.info.atletas.every(n => /Sur$/.test(n)),
     'cada uno con su nómina');
  for (const col of ['livecast_sync', 'livecast_flash', 'livecast_screen', 'livecast_director', 'livecast_record', 'judge_decisions']) {
    const dc = c.res.escribe.filter(k => k.startsWith(col + '/')), ds = s.res.escribe.filter(k => k.startsWith(col + '/'));
    ok(dc.length && ds.length && delCampeonato(dc, CENTRO) && delCampeonato(ds, SUR),
       col + ': cada uno escribe el suyo (' + dc.join(', ') + ' · ' + ds.join(', ') + ')');
  }
  ok(!c.res.escribe.some(k => s.res.escribe.indexOf(k) >= 0), 'ningún documento lo escriben los dos');
  ok(delCampeonato(c.res.escucha, CENTRO) && delCampeonato(s.res.escucha, SUR),
     'y cada uno escucha solo lo suyo: ' + c.res.escucha.join(', '));
  ok(c.res.escucha.indexOf('judge_decisions/current__' + CENTRO.canal) >= 0
     && c.res.escucha.indexOf('timer_control/current__' + CENTRO.canal) >= 0,
     'las luces y el cronómetro de los jueces también: current__' + CENTRO.canal);

  console.log('\n  Con dos tarimas en uno de ellos');
  {
    const t1 = await operar(b, SUR, '1'); errs.push(...t1.errs);
    ok(t1.info.juez === 'current__' + SUR.canal + '_T1', 'las luces de la tarima 1 del Sur: ' + t1.info.juez);
    ok(delCampeonato(t1.res.escribe, SUR) && t1.res.escribe.every(k => /_T1$/.test(k)),
       'todo lo que escribe es de esa tarima de ese campeonato');
    await t1.ctx.close();
  }

  console.log('\nLas pantallas de cada campeonato (OBS, pantalla de tarima, luces)');
  for (const tx of ['lights', 'screen', 'scoreboard']) {
    const w = await abrir(b, 'livecast.html?tx=' + tx + '&evento=' + SUR.id);
    await w.p.waitForTimeout(3000);
    const r = resumen(await lecturas(w.p));
    ok(r.escucha.length > 0 && delCampeonato(r.escucha, SUR),
       'tx=' + tx + ' del Sur escucha solo al Sur: ' + r.escucha.join(', '));
    errs.push(...w.errs);
    await w.ctx.close();
  }

  console.log('\nEl público de cada uno');
  {
    const w = await abrir(b, 'livecast.html?evento=' + CENTRO.id);
    await w.p.waitForTimeout(3000);
    const r = resumen(await lecturas(w.p));
    const nom = await w.p.evaluate(() => DATA.athletes.map(a => a.name));
    ok(nom.length === 3 && nom.every(n => /Centro$/.test(n)), 've los atletas del Centro: ' + nom.join(', '));
    ok(r.escucha.length > 0 && delCampeonato(r.escucha, CENTRO), 'y escucha solo al Centro: ' + r.escucha.join(', '));
    errs.push(...w.errs);
    await w.ctx.close();
  }

  console.log('\nLos jueces');
  {
    ok(c.info.link && c.info.link.indexOf('jueces.html?canal=' + encodeURIComponent(CENTRO.canal)) >= 0,
       'el link de jueces del Centro lleva su canal: ' + c.info.link);
    // El juez del Sur, con su link, vota: el voto va al canal del Sur.
    const j = await abrir(b, 'jueces.html?canal=' + SUR.canal, false, { width: 412, height: 915 });
    await j.p.waitForFunction(() => typeof castVote === 'function', null, { timeout: 20000 });
    await j.p.waitForTimeout(500);
    await j.p.evaluate(async () => { selectPos('central'); await castVote('white'); await sendStartTimer(); });
    const r = resumen(await lecturas(j.p));
    ok(r.escribe.indexOf('judge_decisions/' + s.info.juez) >= 0 && r.escribe.every(k => k.endsWith(s.info.juez)),
       'su voto y su cronómetro van a donde escucha el Sur: ' + r.escribe.join(', '));
    ok(r.escribe.every(k => k.indexOf(CENTRO.canal) < 0), 'y nada llega al Centro');
    errs.push(...j.errs);
    await j.ctx.close();
  }

  console.log('\n  Un link de jueces sin campeonato (los viejos) pregunta de cuál es');
  {
    const j = await abrir(b, 'jueces.html', false, { width: 412, height: 915 });
    await j.p.waitForFunction(() => typeof entrar === 'function', null, { timeout: 20000 });
    await j.p.waitForTimeout(500);
    await j.p.fill('#logEmail', 'juez@fechipo.cl'); await j.p.fill('#logPass', 'x'); await j.p.click('#logBtn');
    await j.p.waitForTimeout(800);
    const vis = id => j.p.evaluate(i => { const e = document.getElementById(i); return !!e && e.offsetHeight > 0; }, id);
    ok(await vis('camp') && !(await vis('pick')), 'después de entrar, elige el campeonato antes que la posición');
    const lista = await j.p.$$eval('#campLista button', bs => bs.map(x => x.textContent));
    ok(lista.length === 2 && lista.indexOf(CENTRO.name) >= 0 && lista.indexOf(SUR.name) >= 0,
       'le ofrece los dos en curso, no los archivados: ' + lista.join(' | '));
    await j.p.click('#campTarima button:has-text("TARIMA 1")');
    await j.p.click('#campLista button:has-text("Regional Sur")');
    await j.p.waitForTimeout(300);
    const st = await j.p.evaluate(() => ({ url: location.search, ev: document.getElementById('evNombre').textContent }));
    ok(/canal=Regional_Sur_Austral_Noviembre_2026_T1/.test(st.url) && /tarima=1/.test(st.url),
       'y queda en la dirección, por si recarga: ' + st.url);
    ok(await vis('pick'), 'y pasa a elegir la posición');
    ok(st.ev === SUR.name, 'con el nombre del campeonato a la vista');
    // Vota: el voto tiene que caer donde escucha la tarima 1 del Sur.
    await j.p.evaluate(async () => { selectPos('izq'); await castVote('red'); });
    const r = resumen(await lecturas(j.p));
    ok(r.escribe.length === 1 && r.escribe[0] === 'judge_decisions/current__' + SUR.canal + '_T1',
       'queda en el mismo canal que la tarima 1 del Sur: ' + r.escribe.join(', '));
    errs.push(...j.errs);
    await j.ctx.close();
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await c.ctx.close(); await s.ctx.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

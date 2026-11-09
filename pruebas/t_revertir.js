// REVERTIR desde Control en Vivo: la decisión del jurado sale en la transmisión.
//
// El jurado podía revertir solo desde el panel de jueces (posición JURY). Ahora
// la mesa tiene ⚖ REVERTIR arriba del último intento juzgado: cambia la decisión,
// la deja anotada como del jurado y la transmisión (con JURADO armado) muestra
// "DECISIÓN DEL JURADO · NULO/VÁLIDO". El ✓ y la ✗ de abajo siguen siendo corrección de la mesa
// (un error del juez) y no salen en la transmisión.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_revertir.js
const { chromium } = require('playwright');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const EV = { id: 'regional_sur_2026', name: 'Regional Sur Prueba 2026', canal: 'Regional_Sur_Prueba_2026' };
const datos = () => ({
  eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true }],
  inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
  admins: [{ id: 'u', role: 'admin' }],
});
const atletas = () => [1, 2, 3].map(i => ({ id: i, lot: 100 + i, name: 'Atleta Numero ' + ['Uno', 'Dos', 'Tres'][i - 1], flight: 'A', sex: 'Hombre', cat: '83',
  div: 'Open', mod: 'classic', bw: 80, club: 'Club',
  att: { sq: [{ w: 110 + i * 5, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 60, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120, r: null }, { w: 0, r: null }, { w: 0, r: null }] } }));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  const red = crearRed({ subida: [100, 300], bajada: [100, 300] });
  red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas()),
    flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: true, forcedCurrent: null, timer: 60, timerOn: false, writer: 'semilla' });
  // JURADO armado en la transmisión (como lo deja el Control Remoto / Control TX).
  red.sembrar('livecast_director/current__' + EV.canal, { show: { jurado: { active: true, until: 0, scale: 1 } }, ts: 1 });
  const errs = [];
  async function abrir(nombre, url, auth, vp) {
    const ctx = await b.newContext({ viewport: vp || { width: 1300, height: 900 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    await red.montar(ctx, p, { nombre, auth, datos: datos() });
    await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 3, null, { timeout: 25000 });
    return p;
  }
  const mesa = await abrir('mesa', 'livecast.html?evento=' + EV.id + '&controller=1', true);
  const tx = await abrir('tx', 'livecast.html?tx=director&evento=' + EV.id, false, { width: 1920, height: 1080 });
  await mesa.evaluate(() => { window.confirm = () => true; DATA.phase = 'compete'; R(); });
  await red.calma(2500);
  const jury = () => tx.evaluate(() => /DECISIÓN DEL JURADO/.test(document.body.innerText));

  console.log('\nLa mesa marca válido el 1er intento de sentadilla de Atleta Numero Uno');
  await mesa.evaluate(() => { overrideResult(1, 'sq', 0, 'g'); });
  await red.calma(2000);
  const btn = await mesa.evaluate(() => { const b = [...document.querySelectorAll('.att-revertir')]; return b.length + '|' + (b[0] ? b[0].getAttribute('onclick') : ''); });
  ok(/^1\|.*revertirJurado\(1,'sq',0\)/.test(btn), 'aparece ⚖ REVERTIR, una sola vez, arriba de ese intento (' + btn + ')');

  console.log('\nCorrección de la mesa (la ✗ de abajo): no es del jurado');
  await mesa.evaluate(() => { changeResult(1, 'sq', 0, 'n'); });
  await red.calma(2500);
  ok(await mesa.evaluate(() => DATA.athletes.find(a => a.id === 1).att.sq[0].r) === 'n', 'el intento queda nulo');
  ok(!(await jury()), 'y la transmisión no muestra nada');
  await mesa.evaluate(() => { changeResult(1, 'sq', 0, 'g'); });
  await red.calma(2500);

  console.log('\n⚖ REVERTIR → NULO con tarjeta azul');
  await mesa.evaluate(() => { document.querySelector('.att-revertir').click(); });
  await mesa.waitForSelector('#juradoModal');
  const modal = await mesa.evaluate(() => document.getElementById('juradoModal').innerText.replace(/\s+/g, ' '));
  ok(/DECISIÓN DEL JURADO/.test(modal) && /ROJA/.test(modal) && /AZUL/.test(modal) && /AMARILLA/.test(modal), 'pregunta la tarjeta: ' + modal.slice(0, 90));
  await mesa.evaluate(() => { [...document.querySelectorAll('#juradoModal button')].find(x => /AZUL/.test(x.textContent)).click(); });
  await red.calma(2500);
  const at = await mesa.evaluate(() => DATA.athletes.find(a => a.id === 1).att.sq[0]);
  ok(at.r === 'n' && at.jurado && at.jurado.res === 'n' && at.jurado.card === 'blue', 'en la mesa queda NULO, anotado como del jurado con tarjeta azul');
  const jd = red.leer('judge_decisions/' + await mesa.evaluate(() => juezDocId()));
  ok(jd && jd.jurado && jd.jurado.res === 'n' && jd.jurado.id === 1, 'se publica como decisión del jurado (judge_decisions)');
  await tx.waitForFunction(() => /DECISIÓN DEL JURADO/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const t = await tx.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  ok(/DECISIÓN DEL JURADO/.test(t) && /NULO/.test(t) && !/OVERRULED/.test(t) && /Atleta Numero Uno/i.test(t), 'la transmisión muestra DECISIÓN DEL JURADO · NULO con el atleta');
  await tx.screenshot({ path: process.env.CAPTURA || '/dev/null' }).catch(() => {});
  await mesa.screenshot({ path: process.env.CAPTURA2 || '/dev/null' }).catch(() => {});

  console.log('\nStream Deck');
  const fuente = require('fs').readFileSync(__dirname + '/../livecast/transmision.js', 'utf8');
  ok(/action==='revertir'/.test(fuente) && /action==='autoPerfil'/.test(fuente), 'eventos "revertir" y "autoPerfil"');
  ok(/\{"action":"revertir","card":"red"\}/.test(fuente) && /J jurado · C cambio de intento · F perfil auto/.test(fuente), 'y están en la guía, con las teclas');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

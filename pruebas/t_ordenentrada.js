// El orden en que entra cada uno no importa.
//
// La pregunta antes del Regional Centro: ¿pasa algo si el de streaming, los
// jueces o el público entran antes que la mesa, o en cualquier otro orden? Acá
// la mesa (Control en Vivo), la transmisión (director, con las luces prendidas
// desde Control TX), la pantalla de tarima, los tres jueces y el público entran
// en distinto orden —la mesa última, el orden de siempre y uno mezclado—, con el
// estilo Lirio y por una red con demoras de recinto (apoyo/firebase_red.js). En
// cada orden se juegan cuatro intentos: los jueces ven a quien está en barra,
// votan, sus luces llegan a la transmisión, la mesa decide, una vez corrige a
// nulo, y a mitad de camino se recargan el público y la transmisión. Al final de
// cada intento todas las pantallas tienen que mostrar lo mismo que el servidor,
// y las luces se tienen que apagar solas.
//
// La red falsa entrega los cambios de a uno por pantalla, así que acá las luces
// tardan hasta unos 5 s en llegar (con Firestore de verdad es menos de un
// segundo): por eso se miran en un registro de lo que mostró la transmisión, no
// en un momento fijo.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_ordenentrada.js
const { chromium } = require('playwright');
const { crearRed } = require('./apoyo/firebase_red');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };
const esperar = ms => new Promise(r => setTimeout(r, ms));

const EV = { id: 'regional_centro_2026', name: '“Primavera Open” Regional Centro Noviembre 2026',
  canal: '_Primavera_Open__Regional_Centro_Noviembre_2026' };
const datos = () => ({
  eventos: [{ id: EV.id, name: EV.name, status: 'open', publicoVisible: true, livecastVisible: true, estilo: 'lirio', logoUrl: 'estilos/primavera/logo.webp' }],
  inscripciones: [], atleta_fotos: [], nomina_suda_fotos: [], athlete_edits: [], clubs: [], site_backgrounds: [],
  admins: [{ id: 'u', role: 'admin' }],
});
function atletas() {
  const at = s => ({ sq: [{ w: 100 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }],
    bp: [{ w: 60 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 120 + s, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
  return [1, 2, 3, 4, 5, 6].map(i => ({ id: i, lot: 100 + i, name: 'Atleta Prueba ' + i, flight: 'A', sex: 'Mujer', cat: '57', div: 'Open',
    mod: 'classic', bw: 56, club: 'Club ' + i, att: at(i * 2.5) }));
}
const LC = 'livecast.html?evento=' + EV.id;
const PAG = {
  mesa: [LC + '&controller=1', true], tx: ['livecast.html?tx=director&evento=' + EV.id, false],
  tarima: ['livecast.html?tx=screen&evento=' + EV.id, false], publico: [LC, false],
  juez_izq: ['jueces.html?canal=' + encodeURIComponent(EV.canal), true],
  juez_central: ['jueces.html?canal=' + encodeURIComponent(EV.canal), true],
  juez_der: ['jueces.html?canal=' + encodeURIComponent(EV.canal), true],
};
const ORDENES = {
  'la mesa entra ÚLTIMA (público, transmisión, tarima y jueces antes)': ['publico', 'tx', 'tarima', 'juez_izq', 'juez_central', 'juez_der', 'mesa'],
  'orden normal (mesa, jueces, transmisión, público, tarima)': ['mesa', 'juez_izq', 'juez_central', 'juez_der', 'tx', 'publico', 'tarima'],
  'mezclado (juez central, transmisión, mesa, público, juez izq, tarima, juez der)': ['juez_central', 'tx', 'mesa', 'publico', 'juez_izq', 'tarima', 'juez_der'],
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ reventó: ' + (e && e.stack)); try { await b.close(); } catch (x) {} process.exit(1); });
  for (const [titulo, orden] of Object.entries(ORDENES).filter((x, i) => !process.env.SOLO || String(i) === process.env.SOLO)) {
    console.log('\n' + titulo);
    const red = crearRed({ subida: [300, 1200], bajada: [150, 1100] });
    red.sembrar('livecast_sync/' + EV.canal, { event: { id: EV.id, name: EV.name }, athletes: JSON.stringify(atletas()),
      flight: 'A', lift: 'sq', round: 0, changeTimers: '{}', ts: 1, tsAth: 1, lotsGenerated: true, forcedCurrent: null, timer: 60, timerOn: false, writer: 'semilla' });
    const errs = [], P = {}, ctxs = [];
    const abrir = async (n) => {
      const [url, auth] = PAG[n];
      const ctx = await b.newContext({ viewport: n.startsWith('juez') ? { width: 412, height: 915 } : { width: 1300, height: 900 }, serviceWorkers: 'block' });
      ctxs.push(ctx);
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(n + ': ' + e.message));
      await red.montar(ctx, p, { nombre: n, auth, datos: datos() });
      // El juez entró con su cuenta en esta pestaña (la marca que deja el login)
      if (n.startsWith('juez')) await ctx.addInitScript(() => { try { sessionStorage.setItem('yl_juez_desde', String(Date.now())); } catch (e) {} });
      await p.goto(`http://localhost:${PUERTO}/${url}`, { waitUntil: 'domcontentloaded' });
      if (n.startsWith('juez')) {
        await p.waitForFunction(() => typeof selectPos === 'function' && (document.getElementById('fbLabel') || {}).textContent === 'En vivo', null, { timeout: 25000 });
        await p.evaluate(pos => selectPos(pos), n.slice(5));
      } else {
        await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 6, null, { timeout: 25000 });
        if (n === 'mesa') await p.evaluate(() => { window.confirm = () => true; window.prompt = () => null; DATA.phase = 'compete'; R(); });
      }
      P[n] = p;
    };
    let director = false;
    for (const n of orden) {
      await abrir(n); await esperar(300 + Math.random() * 900);
      // Apenas hay transmisión, el operador de streaming prende las luces en
      // Control TX (queda en el documento del director, como lo deja el Control TX)
      if (n === 'tx' && !director) {
        director = true;
        const id = await P.tx.evaluate(() => evStateDocId('current'));
        red.escribir('livecast_director/' + id, { show: { luces: { active: true, until: 0, scale: 1 }, jurado: { active: true, until: 0, scale: 1 } } }, true);
      }
    }
    await red.calma(3500);
    const estilo = await P.publico.evaluate(() => document.documentElement.getAttribute('data-estilo-var'));
    ok(estilo === 'lirio', 'el público lo ve en estilo Lirio');

    // Registro de las luces que muestra la transmisión, con su hora
    const grabar = n => P[n].evaluate(() => { window.__luces = []; let ult = '';
      setInterval(() => { try { const j = JSON.stringify(_txLights); if (j !== ult) { ult = j; window.__luces.push([Date.now(), _txLights.izq, _txLights.central, _txLights.der]); } } catch (e) {} }, 25); });
    await grabar('tx');
    const LIVE = ['mesa', 'tx', 'tarima', 'publico'];
    const estado = async () => {
      const o = {};
      for (const n of LIVE) o[n] = await P[n].evaluate(() => {
        const c = liftQueue()[0];
        const res = DATA.athletes.map(a => a.att.sq.map(x => x.r || '·').join('')).join(' ');
        return DATA.lift + '/' + DATA.round + '/' + DATA.flight + ' barra:' + (c ? c.id : '-') + ' ' + res;
      });
      return o;
    };
    const iguales = o => new Set(Object.values(o)).size === 1;
    const votos = [['white', 'white', 'white'], ['white', 'red', 'red'], ['red', 'white', 'white'], ['white', 'white', 'red']];
    for (let k = 0; k < 4; k++) {
      const cur = await P.mesa.evaluate(() => { const c = liftQueue()[0]; return c && { id: c.id, name: c.name, lift: DATA.lift, round: DATA.round }; });
      await red.calma(2500);
      const vistos = {};
      for (const j of ['juez_izq', 'juez_central', 'juez_der']) vistos[j] = await P[j].evaluate(() => document.getElementById('athName').textContent);
      ok(Object.values(vistos).every(v => v === cur.name), 'intento ' + (k + 1) + ': los tres jueces ven a quien está en barra (' + cur.name + ')');
      const [a, c, d] = votos[k];
      await Promise.all([P.juez_izq.evaluate(v => castVote(v), a), P.juez_central.evaluate(v => castVote(v), c), P.juez_der.evaluate(v => castVote(v), d)]);
      // Las luces en la transmisión (se apagan solas a los 5 s: se buscan en el
      // registro de lo que fue mostrando)
      const tVoto = Date.now();
      const vio = await P.tx.waitForFunction(([a, c, d]) => (window.__luces || []).some(x => x[1] === a && x[2] === c && x[3] === d), [a, c, d], { timeout: 15000 }).then(() => true).catch(() => false);
      const cuando = await P.tx.evaluate(([a, c, d, t]) => { const x = (window.__luces || []).find(x => x[0] >= t - 50 && x[1] === a && x[2] === c && x[3] === d); return x ? x[0] - t : null; }, [a, c, d, tVoto]);
      ok(vio, '  la transmisión muestra las tres luces (' + [a, c, d].join(', ') + ')' + (cuando != null ? ' a los ' + (cuando / 1000).toFixed(1) + ' s' : ''));
      await red.calma(300);
      const r = [a, c, d].filter(x => x === 'white').length >= 2 ? 'g' : 'n';
      await P.mesa.evaluate(([id, l, rd, r]) => overrideResult(id, l, rd, r), [cur.id, cur.lift, cur.round, r]);
      if (k === 1) {   // a mitad de camino se recargan el público y la transmisión
        await esperar(400);
        for (const n of ['publico', 'tx']) {
          await P[n].reload({ waitUntil: 'domcontentloaded' });
          await P[n].waitForFunction(() => typeof DATA !== 'undefined' && DATA.event && DATA.athletes && DATA.athletes.length >= 6, null, { timeout: 25000 });
        }
        await grabar('tx');
      }
      if (k === 2) {   // la mesa corrige a nulo (decisión del jurado desde la mesa)
        await red.calma(2500);
        await P.mesa.evaluate(([id, l, rd]) => changeResult(id, l, rd, 'n'), [cur.id, cur.lift, cur.round]);
      }
      await red.calma(4500);
      const e = await estado();
      const serv = JSON.parse(red.leer('livecast_sync/' + EV.canal).athletes).map(a => a.att.sq.map(x => x.r || '·').join('')).join(' ');
      ok(iguales(e) && e.mesa.endsWith(serv), '  mesa, transmisión, tarima y público iguales y = servidor → ' + e.mesa + (iguales(e) ? '' : ' | ' + JSON.stringify(e)));
    }
    await esperar(6500); await red.calma(1500);
    const luz = red.leer('judge_decisions/' + await P.mesa.evaluate(() => juezDocId())) || {};
    ok(!luz.izq && !luz.central && !luz.der, 'las luces se apagan solas después de cada votación');
    ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
    for (const c of ctxs) await c.close();
  }
  await b.close();
  console.log(fallas ? '\n' + fallas + ' FALLA(S)' : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

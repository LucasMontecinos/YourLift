// Dos tarimas a la vez, sin que se crucen los datos.
//
// En noviembre hay un campeonato con doble tarima. Buena parte ya estaba resuelta:
// cada tarima usa su propio documento de sincronización (_T1 / _T2), sus tandas
// son A1/B1 contra A2/B2, y el overlay del director también va separado.
//
// Pero quedaban tres canales con id FIJO, que las dos tarimas habrían compartido:
//   · judge_decisions → el juez de la tarima 1 encendía las luces de la 2;
//   · timer_control   → el cronómetro de una arrancaba el de la otra;
//   · livecast_screen → cambiar la pantalla en una se la cambiaba a la otra.
//
// Nada de eso se nota probando con una sola tarima, que es como se probó siempre.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_dostarimas.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
const jue = fs.readFileSync(__dirname + '/../jueces.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const IDS = `()=>({
  sync:   (function(){ DATA.event={id:'x',name:'Regional Noviembre'}; return fbDocId(); })(),
  jueces: juezDocId(),
  screen: _screenDocId(),
  dir:    evStateDocId('current'),
})`;

async function abrir(b, tarima) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html' + (tarima ? '?tarima=' + tarima : ''),
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof juezDocId === 'function' && typeof fbDocId === 'function',
    null, { timeout: 20000 });
  const ids = await p.evaluate(([f]) => eval('(' + f + ')')(), [IDS]);
  return { p, ids, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  const t1 = await abrir(b, '1'); errs.push(...t1.errs);
  const t2 = await abrir(b, '2'); errs.push(...t2.errs);
  const solo = await abrir(b, null); errs.push(...solo.errs);

  console.log('\nCada tarima escribe en documentos distintos');
  for (const k of ['sync', 'jueces', 'screen', 'dir']) {
    ok(t1.ids[k] !== t2.ids[k],
       k + ': "' + t1.ids[k] + '" ≠ "' + t2.ids[k] + '"');
  }

  console.log('\n  Las luces y el cronómetro, que era lo que faltaba');
  ok(t1.ids.jueces === 'current_T1' && t2.ids.jueces === 'current_T2',
     'un documento de luces por tarima (' + t1.ids.jueces + ' / ' + t2.ids.jueces + ')');
  ok(/function juezDocId\(\)\{return TARIMA\?'current_T'\+TARIMA:'current';\}/.test(src),
     'sale de un solo lugar');
  // Lo que importa no es cuántos accesos hay —eso cambia cada vez que se agrega
  // uno— sino que TODOS pasen por juezDocId(). Antes esto era un número fijo y se
  // rompía al sumar un acceso nuevo, aunque estuviera bien escrito.
  const todos = (src.match(/'judge_decisions',|'timer_control',/g) || []).length;
  const conId = (src.match(/'judge_decisions',juezDocId\(\)|'timer_control',juezDocId\(\)/g) || []).length;
  ok(todos > 0 && todos === conId,
     'y todos los accesos del livecast pasan por ahí (' + conId + ' de ' + todos + ')');
  ok(!/'judge_decisions','current'/.test(src) && !/'timer_control','current'/.test(src),
     'no quedó ningún acceso con el id fijo');

  console.log('\n  Y la pantalla de tarima');
  ok(/TARIMA\?base\+'_T'\+TARIMA:base/.test(src), 'el canal de la pantalla también se separa');

  console.log('\nCon UNA sola tarima, todo sigue como estaba');
  ok(solo.ids.jueces === 'current', 'las luces siguen en "current" — no se rompe lo que funciona hoy');
  ok(solo.ids.screen.indexOf('_T') < 0, 'y la pantalla tampoco cambia de canal');
  ok(solo.ids.sync.indexOf('_T') < 0, 'ni el documento de la competencia');

  console.log('\nEl panel de jueces sabe en qué tarima está');
  {
    ok(/const TARIMA=\(\(\)=>\{try\{return new URLSearchParams\(location\.search\)\.get\('tarima'\)/.test(jue),
       'lee la tarima del link');
    ok(/const JUEZ_DOC=TARIMA\?'current_T'\+TARIMA:'current';/.test(jue),
       'y arma el mismo id que el livecast');
    ok(!/'judge_decisions','current'/.test(jue), 'ningún acceso quedó con el id fijo');
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    const p = await ctx.newPage();
    await p.route('**/firebasejs/**', r => r.abort());
    await p.goto('http://localhost:8972/jueces.html?tarima=2', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof selectPos === 'function', null, { timeout: 20000 });
    await p.evaluate(() => selectPos('central'));
    const txt = await p.evaluate(() => document.getElementById('tarimaBadge').textContent);
    const visible = await p.evaluate(() => document.getElementById('tarimaBadge').style.display !== 'none');
    ok(visible && /TARIMA 2/.test(txt), 'y se lo muestra al juez: "' + txt + '"');
    // Con una sola tarima no debe aparecer el cartel: sería ruido.
    const p2 = await ctx.newPage();
    await p2.route('**/firebasejs/**', r => r.abort());
    await p2.goto('http://localhost:8972/jueces.html', { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => typeof selectPos === 'function', null, { timeout: 20000 });
    await p2.evaluate(() => selectPos('izq'));
    ok(await p2.evaluate(() => document.getElementById('tarimaBadge').style.display === 'none'),
       'con una sola tarima el cartel no aparece');
  }

  console.log('\nEl panel entrega los links de los teléfonos con la tarima puesta');
  {
    const r = await t1.p.evaluate(() => {  // Widgets OBS: ahí viven los links
      isAdmin = true; DATA.event = { id: 'x', name: 'Regional Noviembre' };
      DATA.phase = 'obsTx'; R();
      return document.body.innerText + '||' + [...document.querySelectorAll('input[readonly]')].map(i => i.value).join(' ');
    });
    ok(/LINKS PARA LOS TEL/.test(r), 'hay una sección para los teléfonos');
    ok(/jueces\.html\?tarima=1/.test(r), 'el del juez lleva tarima=1');
    ok(/remote=1&tarima=1/.test(r), 'y el del control remoto también');
    ok(/manda las luces a la otra pantalla/.test(r),
       'con el aviso de por qué importa el link correcto');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

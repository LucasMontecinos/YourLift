// CAMBIO DE INTENTO en la transmisión: se arma desde el Control Remoto o el
// Control TX y sale con cualquier atleta que cambie su intento (3er peso muerto,
// o la banca de quien compite solo en banca), con su nombre y el peso nuevo.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cambiotx.js
const { chromium } = require('playwright');
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=director&evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof renderTxWidget === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const n9 = () => ({ sq: [{ w: 200, r: 'g' }, { w: 210, r: 'g' }, { w: 220, r: 'g' }], bp: [{ w: 120, r: 'g' }, { w: 125, r: 'g' }, { w: 130, r: 'g' }], dl: [{ w: 240, r: 'g' }, { w: 250, r: 'g' }, { w: 0, r: null }] });
    DATA.athletes = [1, 2, 3].map(i => { const a = { id: i, name: 'Atleta Numero ' + ['Uno', 'Dos', 'Tres'][i - 1], lot: i, flight: 'A', sex: 'Hombre', cat: '83', div: 'Open', mod: 'classic', bw: 82, club: 'Club', bombed: false, att: n9() }; a.att.dl[2].w = 255 + i * 5; return a; });
    DATA.lift = 'dl'; DATA.round = 2; DATA.flight = 'A';
    _txDirState = Object.assign({}, TX_DIR_DEFAULT, { scoreboard: { active: true, until: 0, scale: 1 } });
    renderTxWidget();
  });
  const cartel = () => p.evaluate(() => { const d = [...document.querySelectorAll('#txWidget > div')].find(x => /CAMBIO DE INTENTO/.test(x.textContent)); return d ? d.textContent.replace(/\s+/g, ' ').trim() : ''; });
  const cambiar = (id, w) => p.evaluate(([i, kg]) => { const a = DATA.athletes.find(x => x.id === i); const at = a.att.dl[2]; at.w = kg; at.cambios = (at.cambios || 0) + 1; at.cambioTs = _ahora(); renderTxWidget(); }, [id, w]);

  console.log('\nSin armar');
  await cambiar(3, 280);
  await p.waitForTimeout(300);
  ok(await cartel() === '', 'un cambio de intento no sale en la transmisión');

  console.log('\nArmado (CAMBIO DE INTENTO)');
  await p.evaluate(() => { _txDirState.cambioIntento = { active: true, until: 0, scale: 1 }; renderTxWidget(); });
  await cambiar(3, 282.5);
  await p.waitForTimeout(300);
  const t = await cartel();
  ok(/CAMBIO DE INTENTO/.test(t) && /Atleta Numero Tres/.test(t) && /PESO MUERTO · 3ER INTENTO · 282\.5 KG/.test(t),
    'sale con el nombre, el movimiento y el peso nuevo, aunque no sea el que está en tarima: "' + t + '"');
  // Sale de atrás del borde de arriba del marcador, deslizándose hacia arriba.
  const pos = await p.evaluate(() => {
    const sb = document.querySelector('.sb-card-explode'); const tarj = sb && sb.querySelector('[style*="min-width:1040px"]');
    const ranura = sb && [...sb.querySelectorAll('div')].find(d => /overflow:hidden/.test(d.getAttribute('style') || '') && /CAMBIO DE INTENTO/.test(d.textContent));
    const anim = ranura && ranura.firstElementChild.getAttribute('style');
    return tarj && ranura ? { borde: Math.round(tarj.getBoundingClientRect().top), ranura: Math.round(ranura.getBoundingClientRect().bottom), sube: /txCambioSube/.test(anim), baja: /txCambioBaja/.test(anim) } : null;
  });
  ok(pos && Math.abs(pos.borde - pos.ranura) <= 2 && pos.sube && pos.baja,
    'sale del borde de arriba del marcador, deslizándose hacia arriba, y vuelve a bajar: ' + JSON.stringify(pos));
  await p.waitForTimeout(500);
  await p.screenshot({ path: process.env.CAPTURA || '/dev/null' }).catch(() => {});
  // Entra, se ve 2 segundos y sale (antes eran 6 s y se quedaba demasiado).
  const desde = () => p.evaluate(() => _ahora() - DATA.athletes.find(x => x.id === 3).att.dl[2].cambioTs);
  await p.waitForTimeout(Math.max(0, 2000 - await desde()));
  ok(await cartel() !== '', 'a los 2 segundos sigue en pantalla');
  await p.waitForTimeout(Math.max(0, 3400 - await desde()));
  ok(await cartel() === '' && await p.evaluate(() => TX_CAMBIO_MS) <= 3000, 'y a los 3,4 s ya se fue solo');

  console.log('\nLos botones');
  const rm = fs.readFileSync(__dirname + '/../livecast/control_remoto.js', 'utf8');
  const tx = fs.readFileSync(__dirname + '/../livecast/transmision.js', 'utf8');
  ok(/bigBtn\('CAMBIO DE INTENTO'/.test(rm) && /dirToggle\('cambioIntento'\)/.test(rm), 'Control Remoto: botón CAMBIO DE INTENTO');
  ok(/compToggle\('cambioIntento',''\s*,\s*'Cambio de intento'/.test(tx), 'Control TX: "Cambio de intento"');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

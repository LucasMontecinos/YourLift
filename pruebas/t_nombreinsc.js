// El nombre corregido en la inscripción llega al livecast, y el logo blanco de
// un club se ve en cualquier tema.
//
// Pasó en el Regional Centro: el atleta venía como "Vicente Bareientos Diaz"
// (mal escrito en su ficha y en la inscripción) y el livecast no lo cruzaba con
// el Cronograma, que lo tenía bien. Corregir la inscripción no alcanzaba: el
// livecast actualizaba la tanda y la categoría, pero el nombre se quedaba.
//
// Y con el estilo Lirio crema (tema claro), la baldosa oscura del logo de
// Himalaya —logo blanco— salía clara: no se veía.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_nombreinsc.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/livecast.html?evento=suda2026_fesupo_full`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && typeof _mergeFirebaseAthletes === 'function' && DATA.athletes && DATA.athletes.length, null, { timeout: 25000 });
  await p.waitForTimeout(1200);

  console.log('\nEl nombre corregido en la inscripción');
  const r = await p.evaluate(() => {
    isAdmin = true; window.IS_CONTROLLER = true; DATA.phase = 'compete';
    window._pendingEdits = new Set(); window._recentAtt = {};
    const att = () => ({ sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }], dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] });
    DATA.athletes = [
      { id: 0, lot: 101, name: 'Vicente Bareientos Diaz', codigo: '2078VBD-2024', flight: 'A', sex: 'Hombre', cat: '66', div: 'Open', mod: 'classic', club: 'Iron Forces Powerlifting', bw: 65.2, att: att() },
      { id: 1, lot: 102, name: 'Ana Correcta Mano', nombreOrig: 'Ana Correcta', codigo: 'X1', flight: 'A', sex: 'Mujer', cat: '57', div: 'Open', mod: 'classic', club: 'Club', bw: 56, att: att() },
      { id: 2, lot: 103, name: 'Pedro Pérez', codigo: 'X2', flight: 'A', sex: 'Hombre', cat: '74', div: 'Open', mod: 'classic', club: 'Club', bw: 73, att: att() },
    ];
    const fa = (name, codigo, cat) => ({ id: 9, lot: 1, name, codigo, flight: 'A', sex: 'Hombre', cat, div: 'Open', mod: 'classic', club: 'Club', bw: 0, att: att() });
    _mergeFirebaseAthletes([fa('Vicente Javier Barrientos Diaz', '2078VBD-2024', '66'), fa('Ana Correcta', 'X1', '57'), fa('PEDRO PEREZ', 'X2', '74')]);
    const by = id => DATA.athletes.find(a => a.id === id);
    return { v: by(0).name, vOrig: by(0).nombreOrig, vBw: by(0).bw, pend: window._pendingEdits.has('0|meta'), ana: by(1).name, pedro: by(2).name, n: DATA.athletes.length };
  });
  ok(r.v === 'Vicente Javier Barrientos Diaz' && r.vOrig === 'Vicente Bareientos Diaz', 'el livecast toma el nombre corregido (por su código) y guarda el anterior');
  ok(r.vBw === 65.2 && r.n === 3, 'sin tocar su pesaje ni duplicar al atleta');
  ok(r.pend, 'y queda marcado para subirlo al servidor');
  ok(r.ana === 'Ana Correcta Mano', 'si el nombre ya se corrigió a mano en el livecast, esa corrección manda');
  ok(r.pedro === 'Pedro Pérez', 'mayúsculas o tildes distintas no cuentan como corrección');

  console.log('\nEl logo blanco de un club, con el tema claro (Lirio crema)');
  const t = await p.evaluate(() => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#fff"/></svg>';
    window._CLUBS_FS = { himalaya: { logoUrl: 'data:image/svg+xml;base64,' + btoa(svg), fondoLogo: 'claro' }, ironforces: { logoUrl: 'data:image/svg+xml;base64,' + btoa(svg) } };
    document.documentElement.setAttribute('data-tema', 'dia');
    const d = document.createElement('div'); d.id = 'pruebaLogos';
    d.innerHTML = _logoClub({ club: 'Himalaya Powerlifting' }, 28) + _logoClub({ club: 'Iron Forces Powerlifting' }, 28);
    document.getElementById('R').appendChild(d);
    return [...d.querySelectorAll('.club-logo')].map(x => getComputedStyle(x).backgroundColor + '|' + /background:rgba\(10,22,40/.test(x.getAttribute('style')));
  });
  ok(t[0] === 'rgb(14, 20, 36)|false', 'Himalaya: baldosa oscura siempre, aunque en Clubes diga clara (' + t[0] + ')');
  ok(t[1] === 'rgb(14, 20, 36)|false', 'y la de los demás logos blancos sigue oscura en el tema claro (' + t[1] + ')');

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

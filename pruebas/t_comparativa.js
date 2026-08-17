// La "Comparativa en categoría" de la ficha del atleta.
//
// Salió mirando el perfil de un -83 Open: el cuadro decía "47 atletas en el grupo"
// y justo al lado "#5 de 11". Las dos cifras salían del mismo grupo, así que una
// de las dos estaba mal — y era la del puesto: el ranking se calculaba contra
// `members`, que son solo los diez que se dibujan. Un atleta que va 5° entre 47
// aparecía en el top 45% cuando en realidad está en el top 11%.
//
// Y había dos problemas más, del mismo lugar:
//   · Only Bench entraba a la bolsa del powerlifting. Una banca sola de 165 kg no
//     se compara con totales de 700; el que solo hace banca quedaba último de una
//     lista en la que ni tendría que estar.
//   · El total con el que se comparaba era el mejor del atleta EN CUALQUIER lado,
//     no el de la categoría del grupo: el que sube de categoría se comparaba en la
//     nueva con el total de la vieja.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_comparativa.js
const fs = require('fs');
const { chromium } = require('playwright');
const src = fs.readFileSync(__dirname + '/../atleta.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const STUB = `
export function initializeApp(){return{};}
export function getFirestore(){return{};}
export function collection(db,n){return{n};}
export function doc(){return{};}
export async function getDoc(){return{exists:()=>false,data:()=>({})};}
export async function getDocs(c){return{docs:[]};}
export function query(){return{};}
export function where(){return{};}
`;

// El mismo atleta con dos resultados del mismo campeonato: el total de
// powerlifting y, aparte, su banca sola. Es el caso que se reportó.
const BASE = {
  source: 'yourlift_livecast', codigo: '', rut: '21523046-5',
  nombre: 'Benjamin Ignacio García Pino', club: 'Hannya Strength', sexo: 'Masculino',
  division: 'Junior', categoria: '93',
  // El nombre del campeonato lleva una marca que NO puede estar en data.json.
  // Sirve para saber con certeza que ya se aplicaron los resultados inyectados:
  // esperar por el nombre del atleta no alcanza, porque ese nombre lo trae
  // data.json y aparece en el primer dibujo, antes del overlay. Ahí la prueba
  // leía la ficha a medio armar y veía la comparativa vieja. El agrupamiento no
  // mira el nombre del campeonato, así que cambiarlo no altera lo que se prueba.
  evento: 'CENTRO SUR ⟪OVERLAY⟫ FECHIPO 2026', evento_id: 'regionalcentrosur',
  fecha: '2026-08-09',
};
const R_PL = { ...BASE, id: 'r1', view: 'meet', modalidad: 'Powerlifting Classic',
  resultado: { bw: 89.71, sq: 280, bp: 175, dl: 295, total: 750, glp: 99.87, status: 'OK' } };
const R_BENCH = { ...BASE, id: 'r2', view: 'bench', modalidad: 'Only Bench Classic',
  resultado: { bw: 89.71, sq: 0, bp: 175, dl: 0, total: 175, glp: 83.4, status: 'OK' } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  const abiertos = [];
  async function abrir(resultados) {
    // El servidor de las pruebas atiende de a una petición. Con varios contextos
    // vivos a la vez las cargas se encolan y da timeout, así que se cierra el
    // anterior antes de abrir el siguiente.
    while (abiertos.length) { try { await abiertos.pop().close(); } catch (e) {} }
    const ctx = await b.newContext({ viewport: { width: 900, height: 1400 } });
    abiertos.push(ctx);
    await ctx.addInitScript(rs => {
      localStorage.setItem('_yfc_atl_res', JSON.stringify({ ts: Date.now(), d: rs }));
    }, resultados);
    const p = await ctx.newPage();
    await p.route('**/firebasejs/**', route =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8972/atleta.html?codigo=2152BGP-2024', { waitUntil: 'domcontentloaded' });
    // La ficha se dibuja una primera vez con lo que trae data.json, y recién
    // después llega el overlay con los resultados inyectados. Antes se esperaba el
    // nombre del atleta más 1,5 s: el nombre está en data.json, así que la espera
    // se cumplía con el PRIMER dibujo y el tiempo fijo tapaba el resto — de ahí que
    // fallara de a ratos y solo dentro de la batería. Se espera la marca del
    // overlay, que no puede venir de data.json: cuando está, los resultados
    // inyectados ya se aplicaron.
    await p.waitForFunction(() => {
      const el = document.getElementById('profileSection');
      return el && el.style.display !== 'none' && el.innerText.indexOf('⟪OVERLAY⟫') >= 0;
    }, null, { timeout: 90000 });
    return { p, errs };
  }

  // Lee cada tarjeta de comparativa: su título, el tamaño del grupo que anuncia y
  // el "#N de M" del puesto.
  const TARJETAS = () => [...document.querySelectorAll('#profileSection .card')]
    .filter(c => /Comparativa/i.test((c.querySelector('.sec-title') || {}).textContent || ''))
    .map(c => {
      const t = c.innerText;
      const grupo = (t.match(/(\d+)\s+atletas en el grupo/) || [])[1];
      const puesto = t.match(/#(\d+)\s+de\s+(\d+)/);
      const top = (t.match(/Top\s+(\d+)%/) || [])[1];
      return {
        titulo: (c.querySelector('.sec-title') || {}).textContent || '',
        sub: (t.split('\n')[1] || ''),
        grupo: +grupo, rank: puesto ? +puesto[1] : null, de: puesto ? +puesto[2] : null,
        top: top ? +top : null,
        top1: +((t.match(/Top 1\n(\d+(?:\.\d+)?)/) || [])[1] || 0),
        yo: /← tú/.test(t),
      };
    });

  console.log('\nEl puesto se cuenta contra el grupo entero, no contra el top 10');
  const { p, errs } = await abrir([R_PL, R_BENCH]);
  const tarj = await p.evaluate(TARJETAS);
  ok(tarj.length > 0, 'hay comparativa (' + tarj.length + ' tarjeta' + (tarj.length === 1 ? '' : 's') + ')');
  tarj.forEach(t => {
    ok(t.de === t.grupo,
       t.titulo.trim() + ': "#' + t.rank + ' de ' + t.de + '" coincide con los ' + t.grupo + ' del grupo');
  });
  ok(tarj.every(t => t.de > 10 ? t.de === t.grupo : true), 'ningún grupo queda recortado en 11');

  console.log('\n  Y el percentil sale de ese mismo número');
  tarj.forEach(t => {
    const esperado = 100 - Math.round((1 - t.rank / t.de) * 100);
    ok(t.top === esperado, t.titulo.trim() + ': Top ' + t.top + '% es lo que da #' + t.rank + ' de ' + t.de);
  });

  console.log('\nPowerlifting y Only Bench son dos comparativas distintas');
  ok(tarj.length === 2, 'el que hizo las dos cosas tiene las dos (' + tarj.length + ')');
  const pl = tarj.find(t => /Powerlifting/i.test(t.titulo + t.sub));
  const bench = tarj.find(t => /Only Bench/i.test(t.titulo + t.sub));
  ok(!!pl, 'una de Powerlifting Clásico');
  ok(!!bench, 'y otra de Only Bench Clásico');
  ok(bench && pl && bench.top1 < pl.top1,
     'el techo del grupo de banca es mucho menor que el de powerlifting ('
     + (bench && bench.top1) + ' vs ' + (pl && pl.top1) + ')');
  ok(bench && bench.top1 < 400, 'y es una marca de banca, no un total: ' + (bench && bench.top1));

  console.log('\n  El que solo hace powerlifting sigue teniendo una sola');
  const { p: p2, errs: e2 } = await abrir([R_PL]);
  const solo = await p2.evaluate(TARJETAS);
  ok(solo.length === 1, 'una sola tarjeta (' + solo.length + ')');
  ok(solo[0].de === solo[0].grupo, 'con el puesto bien contado: #' + solo[0].rank + ' de ' + solo[0].de);
  ok(/Comparativa en categoría/.test(solo[0].titulo), 'y con el título de siempre: ' + solo[0].titulo.trim());

  console.log('\n  El que solo hace banca no aparece entre los de powerlifting');
  const { p: p3, errs: e3 } = await abrir([R_BENCH]);
  const soloBp = await p3.evaluate(TARJETAS);
  ok(soloBp.length === 1, 'tiene su comparativa (' + soloBp.length + ')');
  ok(soloBp[0] && soloBp[0].top1 < 400,
     'y es la de banca, con marcas de banca: top ' + (soloBp[0] && soloBp[0].top1));

  // ── El caso tal cual se reportó ────────────────────────────────────────────
// Los grupos se arman con data.json, que se publica cada tanto. Un resultado
// recién cerrado en el livecast NO está ahí: el atleta se comparaba con su marca
// de hoy contra un grupo que todavía no lo tenía. Como no se encontraba a sí
// mismo, `peerPerc` lo agregaba al top 10 y devolvía "de 11" — de ahí el
// "47 atletas en el grupo" arriba y el "#5 de 11" al lado. Por eso pasaba con
// TODAS las competencias cerradas desde YourLift.
const R_GRANDE = { ...BASE, id: 'r3', view: 'meet', modalidad: 'Powerlifting Classic',
  division: 'Open', categoria: '83',
  resultado: { bw: 82.4, sq: 265, bp: 165, dl: 282.5, total: 712.5, glp: 99.3, status: 'OK' } };

console.log('\nUn resultado recién cerrado en el livecast entra al grupo');
const { p: p4, errs: e4 } = await abrir([R_GRANDE]);
const grande = await p4.evaluate(TARJETAS);
ok(grande.length === 1, 'tiene su comparativa');
ok(grande[0] && grande[0].de > 20,
   'el grupo de -83 Open es grande de verdad, no once: ' + (grande[0] && grande[0].de));
ok(grande[0] && grande[0].de === grande[0].grupo,
   '"#' + grande[0].rank + ' de ' + grande[0].de + '" coincide con los ' + grande[0].grupo + ' anunciados');
ok(grande[0] && grande[0].rank > 1 && grande[0].rank < grande[0].de,
   'y queda en el medio de la tabla, donde le toca: #' + (grande[0] && grande[0].rank));
ok(grande[0] && grande[0].top <= 20,
   'con un percentil acorde — top ' + (grande[0] && grande[0].top) + '%, no top 45%');
ok(/PEERS=_peersBuild\(DB\);\n      if\(window\._curCodigo\)showProfile/.test(src),
   'los grupos se rehacen cuando llegan los resultados del livecast');

console.log('\nSi no entra al top 10, igual se ve dónde quedó');
  const dentro = tarj.concat(solo).every(t => t.rank <= 10 ? true : t.yo);
  ok(dentro, 'los que quedan fuera del top 10 llevan su propia barra al final');

  console.log('\nEl código quedó con un solo criterio');
  ok(/function _modalKey\(c\)\{/.test(src), 'hay un clasificador único de modalidad');
  ok(/const glModalKey=_modalKey;/.test(src), 'el gráfico de GL usa el mismo');
  ok(/const totals=g\.totals\|\|g\.members\.map\(m=>m\.total\);/.test(src),
     'el ranking usa la lista completa del grupo');
  ok(/if\(_modalKey\(c\)!==modal\)return;/.test(src),
     'la mejor marca del grupo se busca dentro de la misma modalidad');
  ok(!/const peer=peerKey&&bl\.total\?peerPerc\(bl\.total,peerKey\)/.test(src),
     'ya no se compara con el mejor total de cualquier categoría');

  const todos = [...errs, ...e2, ...e3, ...e4];
  ok(todos.length === 0, 'sin errores de JavaScript' + (todos.length ? ': ' + todos.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

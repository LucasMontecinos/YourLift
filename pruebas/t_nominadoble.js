// Un campeonato, una nómina.
//
// El Sudamericano existe en dos lados a la vez, y está bien que así sea:
//
//   · la NÓMINA OFICIAL, que llega en nomina_sudamericano.json con sus 414
//     atletas y es la que se publica;
//   · el EVENTO DEL PANEL, con id suda2026, que hace falta para la transmisión,
//     el cronograma y el livecast.
//
// Pero en la pestaña Nóminas son el MISMO campeonato. Al marcar la nómina como
// cerrada en Campeonatos aparecían DOS tarjetas de Sudamericano: la buena con
// los 414, y otra vacía —"0 inscritos"— porque las inscripciones no cuelgan de
// ese id. Para quien mira desde afuera son dos nóminas de lo mismo y una está
// mal, que es peor que no tener ninguna.
//
// Es exactamente el caso de las jornadas —los días del campeonato tienen su doc
// en `eventos` para poder publicarlas, pero su gente está en la nómina grande— y
// se resuelve igual: la tarjeta del evento sobra y no se dibuja.
//
// La red de seguridad: se saca SOLO si está vacía. Si alguna vez ese evento
// tuviera inscripciones propias se muestra igual, porque esconder una tarjeta
// con gente adentro sería peor que mostrar dos.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_nominadoble.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  console.log('\nLa nómina publicada dice de qué campeonato es');
  const nom = JSON.parse(fs.readFileSync(__dirname + '/../nomina_sudamericano.json', 'utf8'));
  {
    ok(nom.eventoId === 'suda2026', 'su eventoId es ' + nom.eventoId);
    ok(nom.publicada === true, 'y está publicada');
    ok((nom.atletas || []).length > 400, 'con ' + (nom.atletas || []).length + ' inscripciones');
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof nom === 'function' && window.NOMSUDA, null, { timeout: 25000 });

  // Monta la pestaña Nóminas con los eventos que llegarían del panel.
  const pintar = (evs) => p.evaluate((lista) => {
    const mk = (id, name, n) => ({ id, name, status: 'active', fromFirebase: true,
      date: '2026-09-20',
      athletes: Array.from({ length: n }, (_, i) => ({ id: i, nombre: 'Atleta ' + i, status: 'approved' })),
      liveCount: { total: n, approved: n, pending: 0 } });
    window._nominasCargadas = true;
    NM.events = lista.map(([id, name, n]) => mk(id === '__SUDA__' ? NOMSUDA.eventoId : id, name, n));
    const h = nom();
    const d = document.createElement('div'); d.innerHTML = h;
    return {
      html: h,
      // Cuántas veces aparece un encabezado de campeonato llamado Sudamericano.
      tarjetas: d.querySelectorAll('.card').length,
    };
  }, evs);

  console.log('\n  Con la nómina publicada, el evento vacío no se dibuja');
  {
    const r = await pintar([['__SUDA__', 'Sudamericano 2026', 0], ['otro', 'Campeonato Otro', 5]]);
    ok(!/Sudamericano 2026/.test(r.html), 'no sale la tarjeta vacía del evento suda2026');
    ok(/Campeonato Otro/.test(r.html), 'y los demás campeonatos siguen saliendo');
    // La buena tiene que seguir ahí: si se fuera, el arreglo sería peor.
    ok(/nsuda|NÓMINA OFICIAL|Sudamericano Classic/i.test(r.html),
       'la nómina publicada, la de los 414, sigue en su lugar');
  }

  console.log('\n  Pero si ese evento tuviera gente, se muestra igual');
  {
    const r = await pintar([['__SUDA__', 'Sudamericano 2026', 7], ['otro', 'Campeonato Otro', 5]]);
    ok(/Sudamericano 2026/.test(r.html),
       'con inscripciones propias no se esconde: esconder datos es peor que repetir');
  }

  console.log('\n  Y sin nómina publicada nada cambia');
  {
    const r = await p.evaluate(() => {
      const guardada = window.NOMSUDA;
      window.NOMSUDA = null;               // como un campeonato cualquiera
      const mk = (id, name, n) => ({ id, name, status: 'active', fromFirebase: true,
        date: '2026-09-20',
        athletes: Array.from({ length: n }, (_, i) => ({ id: i, nombre: 'A' + i, status: 'approved' })),
        liveCount: { total: n, approved: n, pending: 0 } });
      window._nominasCargadas = true;
      NM.events = [mk('suda2026', 'Sudamericano 2026', 0), mk('otro', 'Campeonato Otro', 5)];
      const h = nom();
      window.NOMSUDA = guardada;
      return h;
    });
    ok(/Sudamericano 2026/.test(r),
       'sin nómina publicada el evento se dibuja normal, como cualquier otro');
  }

  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const ix = fs.readFileSync(__dirname + '/../index.html', 'utf8');
    ok(/function _nsudaMismoEvento\(/.test(ix), 'hay una sola forma de saber cuál es el mismo campeonato');
    // Se empareja por id y por nombre: el panel puede tener escrito cualquiera.
    ok(/j\.eventoId,j\.evento,j\.eventoCorto/.test(ix), 'empareja por id y por nombre');
    const i = ix.indexOf('function nom(){');
    const f = ix.slice(i, i + 1400);
    ok(/\(ev\.athletes\|\|\[\]\)\.length>0/.test(f), 'y solo saca la tarjeta si está vacía');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

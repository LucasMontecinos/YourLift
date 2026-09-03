// El desplegable de clubes del formulario de inscripción.
//
// La lista era fija, escrita a mano dentro de inscripcion.html, y se fue quedando
// atrás: ofrecía "Club Kensei", que ya no es club, y le faltaba Club Deportivo
// Jaques Oliger, que sí lo es. Quien se inscribía desde ese club tenía que elegir
// "Otro" y después alguien lo corregía a mano en el panel.
//
// Ahora sale del padrón, que es de donde la saca también la sección Clubes del
// panel ("un club figura mientras alguien lo tenga puesto"). Las dos listas no se
// pueden separar porque son la misma cuenta sobre los mismos datos, y eso es lo
// que se fija acá: no que contengan tal o cual nombre, sino que coincidan.
//
// Lo otro que se cuida es el caso feo: alguien inscrito con un club que dejó de
// figurar. Si el <select> no incluye su club, se dibuja en blanco y a la primera
// vez que esa persona toca cualquier otro campo del formulario, guarda sin club.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_clubes.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// La misma cuenta que hace renderClubs() en admin.html.
function clubesDelPadron(padron) {
  return [...new Set(padron.map(a => (a.club || '').trim()).filter(Boolean))].sort();
}

(async () => {
  const padron = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/inscripcion.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof clubsParaElegir === 'function' && athleteDB.length > 0,
    null, { timeout: 25000 });

  console.log('\nLa lista sale del padrón, igual que la sección Clubes del panel');
  {
    const lista = await p.evaluate(() => clubsParaElegir(''));
    // "Otro" no es un club: es la salida para quien no está en ninguno, y va al final.
    ok(lista[lista.length - 1] === 'Otro', '"Otro" queda al final, como salida');
    const clubes = lista.slice(0, -1);

    // Lo que ve el panel. Se descuenta "Otro" porque allá tampoco es un club.
    const enPanel = clubesDelPadron(padron).filter(c => c !== 'Otro');
    const faltan = enPanel.filter(c => !clubes.includes(c));
    const sobran = clubes.filter(c => !enPanel.includes(c));
    ok(faltan.length === 0, 'no falta ninguno de los del panel' + (faltan.length ? ': ' + faltan.join(', ') : ''));
    ok(sobran.length === 0, 'ni sobra ninguno que el panel no muestre' + (sobran.length ? ': ' + sobran.join(', ') : ''));
    ok(clubes.length === enPanel.length, `los mismos ${clubes.length} clubes en los dos lados`);

    // Los dos casos que dieron origen a todo esto.
    ok(clubes.some(c => /jaques oliger/i.test(c)),
       'está Jaques Oliger: ' + (clubes.find(c => /jaques oliger/i.test(c)) || '—'));
    ok(!clubes.some(c => /kensei/i.test(c)), 'y ya no está Kensei');

    // Ordenada, o buscar el propio club en el desplegable es una lotería.
    const ordenada = clubes.slice().sort((a, b) => a.localeCompare(b, 'es'));
    ok(clubes.join('|') === ordenada.join('|'), 'y van en orden alfabético');
  }

  console.log('\n  A quien tenga un club que ya no figura no se le borra');
  {
    const r = await p.evaluate(() => ({
      conViejo: clubsParaElegir('Club Kensei'),
      sinNada: clubsParaElegir(''),
    }));
    ok(r.conViejo.includes('Club Kensei'),
       'el club viejo se agrega solo para esa persona, así el <select> no queda en blanco');
    ok(!r.sinNada.includes('Club Kensei'),
       'pero no se le ofrece a nadie más');
    // Si se colara dos veces, el desplegable mostraría el mismo club repetido.
    ok(new Set(r.conViejo).size === r.conViejo.length, 'y no queda repetido');
  }

  console.log('\n  El desplegable dibujado muestra eso mismo');
  {
    const r = await p.evaluate(() => {
      // El formulario es un asistente de cuatro pasos y el club está en uno de
      // ellos; se lo pone en pantalla igual que las otras pruebas del formulario.
      EVENTS = [{ id: 'ev1', name: 'Campeonato de Prueba', closeDate: '2030-12-31' }];
      state.view = 'form'; state.privacyConsent = true;
      state.form = { evento: 'ev1', rut: '19839518-9', nombre: 'Persona De Prueba',
                     fechaNac: '1995-03-20', sexo: 'Masculino', club: '',
                     division: 'Open', categoria: '-83 kg', modalidad: 'Clásico',
                     email: 'a@b.cl', telefono: '999999999' };
      let s = null;
      for (let paso = 1; paso <= 4 && !s; paso++) {
        state.step = paso; render();
        s = [...document.querySelectorAll('select')].find(x => /Seleccionar club/.test(x.innerHTML));
      }
      if (!s) return { falta: true };
      const opts = [...s.options].map(o => o.textContent.trim()).filter(t => !/^Seleccionar/.test(t));
      return { opts, esperado: clubsParaElegir('') };
    });
    if (r.falta) ok(false, 'no se encontró el desplegable de clubes en la página');
    else {
      ok(r.opts.join('|') === r.esperado.join('|'),
         `el <select> tiene las ${r.opts.length} opciones, en el mismo orden`);
      ok(r.opts.includes('Club Deportivo Jaques Oliger'),
         'y ahí está Jaques Oliger para elegirlo');
    }
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const ins = fs.readFileSync(__dirname + '/../inscripcion.html', 'utf8');
    ok(/function clubsParaElegir/.test(ins), 'una sola forma de armar la lista');
    ok(!/\$\{CLUBS\.map/.test(ins), 'y ningún desplegable quedó con la lista fija');
    // Si el padrón llega después de dibujar, hay que redibujar o se queda el respaldo.
    ok(/athleteDB=d;_insAplicarEdits\(\);[\s\S]{0,220}?render\(\)/.test(ins),
       'y se redibuja cuando llega el padrón');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

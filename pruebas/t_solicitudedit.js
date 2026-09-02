// Una solicitud de edición sale solo si de verdad se cambió algo.
//
// El atleta entra a "editar inscripción" con su RUT y su PIN, mira sus datos y a
// veces cierra sin tocar nada —o aprieta guardar por costumbre—. Antes eso mandaba
// igual una solicitud con los doce campos, todos iguales a los que ya estaban. El
// organizador terminaba con una bandeja de avisos que no pedían nada, y entre
// medio se le perdía el que sí importaba.
//
// Ahora la solicitud lleva SOLO los campos que cambiaron, y si no cambió ninguno
// no se manda nada. Que lleve solo los cambiados importa por sí mismo: el admin
// aplica las llaves que vengan, así que mandar las doce siempre significaba pisar
// con el valor viejo del formulario cualquier corrección que el organizador
// hubiera hecho mientras tanto.
//
// La comparación usa la MISMA limpieza que se le aplica al campo al enviarlo. Si
// no, un club guardado con un espacio de más se vería como un cambio cada vez que
// alguien abre el formulario, y volveríamos al problema por otra puerta.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_solicitudedit.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Una inscripción como la que devuelve Firestore, con un par de valores sucios a
// propósito: el club con espacios al final es exactamente el caso que hacía
// aparecer cambios fantasma.
const INSCRIPCION = {
  id: 'insc1', evento: 'nac2026', rut: '11111111-1',
  nombre: 'Ana María Pérez', codigo: '1111APM-2024', sexo: 'Mujer',
  fechaNac: '2000-01-01', division: 'Open', categoria: '-63 kg (Mujer)',
  modalidad: 'Powerlifting Classic', club: 'Los Toros  ', clubOtro: '',
  zona: 'Centro', comuna: 'Ñuñoa', universidad: '',
};

// Prepara la página como si el atleta ya hubiera entrado a editar, y deja anotado
// lo que se iba a guardar en vez de guardarlo.
//
// Sin Firebase configurado, saveEdit() se va por la rama de demostración y llama a
// demoUpdate(). Da lo mismo cuál de las dos corra: el `changes` se arma ANTES de
// esa bifurcación, y es lo que esta prueba mira. Se enganchan las dos igual.
async function preparar(p, cambios) {
  return await p.evaluate(({ ins, cambios }) => {
    window.__enviado = null;
    window.FB = window.FB || {};
    window.FB.collection = () => ({});
    window.FB.serverTimestamp = () => 0;
    window.FB.addDoc = (_c, doc) => { window.__enviado = doc; return Promise.resolve({ id: 'x' }); };
    window.demoUpdate = (id, changes) => { window.__enviado = { inscripcionId: id, changes: changes }; };
    window.EVENTS = [{ id: 'nac2026' }];          // sin cierre de pre-nómina
    state.view = 'edit';
    state.editId = ins.id;
    state.editDoc = ins;
    state.form = Object.assign({}, ins, { pin: '1234' }, cambios);
    state.error = ''; state.success = '';
  }, { ins: INSCRIPCION, cambios });
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  // Sin service worker: se mete a medio cargar y deja la página colgada.
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PUERTO}/inscripcion.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof saveEdit === 'function' && typeof state === 'object',
    null, { timeout: 20000 });

  console.log('\nSin tocar nada, no se manda ninguna solicitud');
  {
    await preparar(p, {});
    const r = await p.evaluate(async () => {
      await saveEdit();
      return { enviado: window.__enviado, error: state.error, exito: state.success };
    });
    ok(r.enviado === null, 'no llegó nada a Firestore');
    ok(!!r.error, 'y se le avisa al atleta: "' + (r.error || '').slice(0, 60) + '…"');
    ok(!r.exito, 'no se le dice que envió algo que no envió');
  }

  console.log('\n  Un espacio de más en un dato viejo no es un cambio');
  {
    // El club viene guardado como 'Los Toros  '. El formulario lo muestra igual y
    // al enviar se limpia; si se comparara lo limpio contra lo sucio, saldría una
    // solicitud sola por eso.
    await preparar(p, {});
    const r = await p.evaluate(async () => { await saveEdit(); return window.__enviado; });
    ok(r === null, 'sigue sin mandarse nada');
  }

  console.log('\n  Con un cambio real, la solicitud lleva SOLO ese campo');
  {
    await preparar(p, { categoria: '-69 kg (Mujer)' });
    const r = await p.evaluate(async () => {
      await saveEdit();
      return { doc: window.__enviado, exito: state.success };
    });
    ok(!!r.doc, 'la solicitud se envió');
    const ks = r.doc ? Object.keys(r.doc.changes || {}) : [];
    ok(ks.length === 1 && ks[0] === 'categoria',
       'y trae un solo campo: ' + JSON.stringify(ks));
    ok(r.doc && r.doc.changes.categoria === '-69 kg (Mujer)', 'con el valor nuevo');
    ok(r.doc && r.doc.inscripcionId === 'insc1', 'apuntando a la inscripción correcta');
    ok(/1 cambio/.test(r.exito || ''), 'al atleta se le dice cuántos cambios mandó');
  }

  console.log('\n  Dos cambios van los dos, y nada más');
  {
    await preparar(p, { categoria: '-69 kg (Mujer)', club: 'Himalaya Powerlifting' });
    const r = await p.evaluate(async () => {
      await saveEdit();
      return { doc: window.__enviado, exito: state.success };
    });
    const ks = r.doc ? Object.keys(r.doc.changes || {}).sort() : [];
    ok(ks.length === 2 && ks[0] === 'categoria' && ks[1] === 'club',
       'llegan los dos y solo los dos: ' + JSON.stringify(ks));
    ok(/2 cambios/.test(r.exito || ''), 'y se le dice que fueron 2');
  }

  console.log('\n  Lo que el atleta no puede tocar nunca viaja');
  {
    // Aunque alguien manosee el formulario desde la consola, estos campos no
    // salen: el evento, el estado y el RUT no son suyos para cambiarlos.
    await preparar(p, { categoria: '-69 kg (Mujer)', evento: 'otro', rut: '99999999-9' });
    const r = await p.evaluate(async () => { await saveEdit(); return window.__enviado; });
    const ks = r ? Object.keys(r.changes || {}) : [];
    ok(!ks.includes('evento') && !ks.includes('rut') && !ks.includes('status'),
       'ni evento, ni rut, ni status: ' + JSON.stringify(ks));
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const ins = fs.readFileSync(__dirname + '/../inscripcion.html', 'utf8');
    ok(/const antes = state\.editDoc/.test(ins), 'se compara contra la inscripción original');
    ok(/if \(!Object\.keys\(changes\)\.length\)/.test(ins), 'y sin diferencias no se envía');
    ok(/const LIMPIEZA = \{/.test(ins), 'con la misma limpieza en los dos lados');
    // El sobre que va a Firestore no se puede ejercitar sin Firebase, así que se
    // comprueba leyendo el código que manda el `changes` ya filtrado.
    ok(/'edit_requests'\), \{[\s\S]{0,200}changes: changes,/.test(ins),
       'y a Firestore va ese mismo changes, no el formulario entero');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

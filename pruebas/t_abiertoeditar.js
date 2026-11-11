// Campeonato abierto: en Admin → Nóminas se corrige lo que llenó el atleta.
//
// Pasó en la Copa Panda: un atleta se inscribió con el club "Odolingym" (escrito
// a mano, "Otro") y había que dejarlo como Independiente, pero la nómina de un
// abierto solo dejaba aprobar o rechazar. Ahora nombre, género, división,
// categoría, modalidad y club se corrigen con un click, con las opciones del
// formulario abierto, y queda en el registro.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_abiertoeditar.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { montarFirebase } = require('./apoyo/firebase_falso');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const COPA = { id: 'copa_prueba_2026', name: 'Copa Prueba Clausura 2026', date: '2026-12-05', status: 'open', abierto: true,
  ab: { reglamento: 'IPF', precio: 35000, polera: false, mods: ['Classic', 'Equipado'], pago: { titular: 'X', numero: '1' } } };
const insc = (id, nombre, extra) => Object.assign({ id, evento: COPA.id, nombre, sexo: 'Masculino', anioNac: '1995', division: 'Open',
  categoria: '-83 kg', modalidad: 'Classic', club: 'Los Toros', clubOtro: '', status: 'pending', timestamp: { seconds: 1 } }, extra || {});

console.log('\nLas reglas dejan corregirlo');
{
  const R = fs.readFileSync(path.join(__dirname, '..', 'reglas', 'firestore.rules'), 'utf8');
  const pers = (R.match(/function camposPersonales\(\) \{\s*return \[([^\]]+)\]/) || [])[1] || '';
  ok(['nombre', 'sexo', 'division', 'categoria', 'modalidad', 'club', 'clubOtro'].every(k => !pers.includes("'" + k + "'")),
    'ninguno de esos campos es personal: el admin los puede cambiar (isAdmin && modificaSinPersonales)');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => { console.log('\n  ✗ la prueba reventó: ' + (e && e.stack || e)); try { await b.close(); } catch (x) {} process.exit(1); });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, serviceWorkers: 'block' });
  await montarFirebase(ctx);
  const q = await ctx.newPage(); const errs = []; q.on('pageerror', e => errs.push(e.message)); q.on('dialog', d => d.accept().catch(() => {}));
  await q.addInitScript(f => { window.__FAKE = f; window.__AUTH = { uid: 'u1', email: 'a@b.cl' }; },
    { admins: [{ id: 'u1', role: 'owner', email: 'a@b.cl' }], eventos: [COPA], inscripciones: [], inscripciones_private: [],
      inscripciones_abiertas: [insc('g1', 'Guillermo Ejemplo Prueba', { club: 'Otro', clubOtro: 'Odolingym' }), insc('a2', 'Ana Ejemplo', { sexo: 'Femenino', categoria: '-63 kg' })],
      inscripciones_abiertas_priv: [] });
  await q.goto(`http://localhost:${PUERTO}/admin.html`, { waitUntil: 'domcontentloaded' });
  await q.waitForFunction(() => typeof ST !== 'undefined' && ST.adminInfo && document.querySelector('.side-btn'), null, { timeout: 25000 });
  await q.evaluate(id => { go('nominas'); ST.filterEv = id; render(); }, COPA.id);
  await q.waitForFunction(() => /Odolingym/.test(document.getElementById('app').innerText), null, { timeout: 15000 }).catch(() => {});

  // Abre la celda que tiene el texto y devuelve lo que muestra el cuadro de edición.
  const abrir = (fila, texto) => q.evaluate(([fila, texto]) => {
    document.querySelectorAll('.modal').forEach(m => m.remove());     // el cuadro anterior, sin guardar
    const tr = [...document.querySelectorAll('#app table.tbl tr')].find(t => t.innerText.includes(fila));
    const s = tr && [...tr.querySelectorAll('span.editable')].find(x => x.textContent.trim() === texto || x.textContent.includes(texto));
    if (!s) return null; s.click();
    const i = document.getElementById('emInp'); if (!i) return { sinCuadro: true };
    return { tag: i.tagName, valor: i.value, opciones: i.tagName === 'SELECT' ? [...i.options].map(o => o.value) : [...document.querySelectorAll('#emClubList option')].map(o => o.value) };
  }, [fila, texto]);
  const guardar = valor => q.evaluate(async v => { window.__ESCRITO = []; document.getElementById('emInp').value = v; document.getElementById('emSave').click();
    await new Promise(r => setTimeout(r, 400)); return { w: (window.__ESCRITO || []).filter(x => x.col === 'inscripciones_abiertas'), t: document.getElementById('app').innerText }; }, valor);

  console.log('\nEl club');
  let c = await abrir('Guillermo', 'Odolingym');
  ok(c && c.tag === 'INPUT' && c.valor === 'Odolingym', 'el club se puede tocar: abre el cuadro con el club que escribió el atleta');
  ok(c && c.opciones.includes('Independiente') && c.opciones.includes('Los Toros'), 'y propone los clubes, con "Independiente"');
  let r = await guardar('  Independiente ');
  const u = r.w.find(x => x.id === 'g1');
  ok(u && u.op === 'update' && u.d.club === 'Independiente' && u.d.clubOtro === '', 'queda Independiente (y se borra el "Otro: Odolingym")');
  ok(/Independiente/.test(r.t) && !/Odolingym/.test(r.t), 'la nómina ya lo muestra así' + (/Odolingym/.test(r.t) ? ': ' + r.t.split('\n').filter(l => /Odolingym/.test(l)).join(' / ') : ''));
  c = await abrir('Guillermo', 'Independiente');
  r = await guardar('   ');
  ok(!r.w.length, 'el club no puede quedar vacío');

  console.log('\nLo demás');
  c = await abrir('Ana Ejemplo', '-63 kg');
  ok(c && c.tag === 'SELECT' && c.opciones.includes('-69 kg') && c.opciones.includes('+84 kg') && !c.opciones.includes('-83 kg'),
    'la categoría se elige entre las de su género (las del formulario abierto)');
  r = await guardar('-69 kg');
  ok(r.w.some(x => x.id === 'a2' && x.d.categoria === '-69 kg' && Object.keys(x.d).length === 1), 'y se guarda solo ese campo');
  c = await abrir('Guillermo', 'Classic');
  ok(c && c.opciones.join() === 'Classic,Equipado', 'la modalidad, entre las que ofrece el campeonato');
  c = await abrir('Guillermo', 'Open');
  ok(c && c.opciones.includes('Sub-Junior') && c.opciones.includes('Master IV') && !c.opciones.includes('Debutantes'), 'la división, entre las siete de la IPF');
  await q.evaluate(() => document.querySelector('.modal') && document.querySelector('.modal').remove());
  c = await abrir('Guillermo', 'Guillermo Ejemplo Prueba');
  r = await guardar('  Guillermo   Jesús  Ejemplo ');
  ok(r.w.some(x => x.id === 'g1' && x.d.nombre === 'Guillermo Jesús Ejemplo'), 'el nombre también, sin espacios de más');

  // También en Campeonatos → Ver inscritos.
  await q.evaluate(id => { go('campeonatos'); abVer(id); }, COPA.id);
  await q.waitForFunction(() => document.querySelectorAll('#app span.editable').length >= 6, null, { timeout: 8000 }).catch(() => {});
  ok(await q.evaluate(() => [...document.querySelectorAll('#app span.editable')].some(s => /Odolingym|Independiente|Los Toros/.test(s.textContent))),
    'en Campeonatos → Ver inscritos se corrige igual');
  ok(!errs.length, 'sin errores en el admin' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

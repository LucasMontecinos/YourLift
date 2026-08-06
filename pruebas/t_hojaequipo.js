// Hoja de Revisión de Equipo: cada atleta debe salir con su modalidad entre
// paréntesis justo después del nombre, y las columnas tienen que seguir sumando
// el ancho útil de la hoja. Se intercepta jsPDF para leer lo que se dibuja.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_hojaequipo.js
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length, null, { timeout: 15000 });

  const out = await p.evaluate(async () => {
    const cap = { textos: [], anchos: [], saved: null };
    class FakeDoc {
      setTextColor() {} setFont() {} setFontSize(s) { this._fs = s; }
      addPage() {} setPage() {} setDrawColor() {} setLineWidth() {}
      setFillColor() {} rect() {} line() {}
      getTextWidth(t) { return String(t).length * (this._fs || 7) * 0.24; }
      text(t, x, y, o) { cap.textos.push({ t: String(t), x, fs: this._fs }); }
      internal = { getNumberOfPages: () => 1 };
      save(n) { cap.saved = n; }
    }
    window.jspdf = { jsPDF: function () { return new FakeDoc(); } };
    isAdmin = true; window.IS_CONTROLLER = true;
    pickEvent(DATA.events.findIndex(e => e.id === 'suda2026_fesupo_full'));

    // Un atleta de cada modalidad, para ver las siete etiquetas.
    const mods = [
      ['classic', false], ['classic_bench', true], ['onlybench', false], ['oe_classic', false],
      ['equipped', false], ['equipped_bench', true], ['equipped_bench', false],
    ];
    DATA.athletes = mods.map((m, i) => ({
      id: i, lot: i + 1, name: 'Atleta Numero ' + (i + 1), rut: '', sex: 'Masculino',
      cat: '83', div: 'Open', club: 'Club', mod: m[0], plusBench: m[1], bw: 0, flight: 'A',
      rackSQ: '', rackBP: '', bombed: false, weighedIn: false,
      att: { sq: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
             bp: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }],
             dl: [{ w: 0, r: null }, { w: 0, r: null }, { w: 0, r: null }] },
    }));
    // Uno con nombre larguísimo: se debe recortar el nombre, nunca la modalidad.
    DATA.athletes.push({ ...DATA.athletes[1], id: 99, lot: 99,
      name: 'Sebastian Alejandro Jesus Maldonado Carrillo de la Fuente' });

    await generateHojaEquipo();
    return { cap, etiquetas: DATA.athletes.map(a => _modHojaEquipo(a)) };
  });

  let fallas = 0;
  const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

  console.log('\nEtiquetas por modalidad');
  const esperadas = ['CLASSIC', 'CLASSIC + ONLY BENCH', 'ONLY BENCH', 'OE',
                     'EQUIPADO', 'EQUIPADO + ONLY BENCH', 'ONLY BENCH EQUIPADO', 'CLASSIC + ONLY BENCH'];
  esperadas.forEach((e, i) => ok(out.etiquetas[i] === e, `${e}  (dio "${out.etiquetas[i]}")`));

  console.log('\nLo que se dibuja en el PDF');
  const parentesis = out.cap.textos.filter(t => /^\s*\(.+\)$/.test(t.t));
  ok(parentesis.length === 8, `hay un paréntesis por atleta: ${parentesis.length} de 8`);
  ok(parentesis.every(t => t.fs < 7), 'la modalidad va en cuerpo menor que el nombre');
  const dibujadas = parentesis.map(t => t.t.trim().replace(/^\(|\)$/g, ''));
  ok(esperadas.every(e => dibujadas.includes(e)), 'las siete modalidades aparecen en la hoja');

  // La modalidad tiene que ir después del nombre, nunca antes.
  const largo = out.cap.textos.findIndex(t => t.t.startsWith('Sebastian Alejandro'));
  ok(largo >= 0, 'el nombre largo se dibuja');
  if (largo >= 0) {
    const sig = out.cap.textos[largo + 1];
    ok(/^\s*\(/.test(sig.t), 'y su modalidad va inmediatamente después');
    ok(sig.x > out.cap.textos[largo].x, 'a la derecha del nombre, no encima');
    ok(dibujadas[dibujadas.length - 1] === 'CLASSIC + ONLY BENCH',
       'con el nombre recortado la modalidad se mantiene entera');
  }
  ok(!!out.cap.saved, 'el PDF se guarda: ' + out.cap.saved);
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

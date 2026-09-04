// El código QR del seguimiento en vivo.
//
// Sirve para que la gente en el recinto entre a la competencia sin escribir
// nada: se proyecta en la pantalla o se imprime en la entrada, apuntan la cámara
// y quedan adentro. Es el MISMO link de "VER EN VIVO", no uno aparte.
//
// El generador está escrito dentro del sistema (yl-qr.js) y no se le pide a un
// servicio de internet, por lo mismo de siempre: si el servicio se cae o el
// recinto tiene mala señal, en la pantalla queda un cuadro vacío. Es lo que pasó
// en el Regional Norte con las banderas que venían de afuera.
//
// Lo que se prueba acá no es que "dibuje algo": esta prueba LEE de vuelta el
// código, igual que lo haría un teléfono —lo desenmascara, saca los datos de su
// zigzag, desarma los bloques intercalados y arma el texto— y comprueba que
// diga exactamente la dirección que se le pidió. Un QR con un módulo cambiado se
// ve idéntico a simple vista y la corrección de error puede tapar el error hasta
// que un día, con una dirección más larga, deja de leerse.
//
// Mientras se escribió, además, se comprobó contra dos implementaciones ajenas
// —un generador y un lector distintos— en 304 combinaciones de versión, nivel de
// corrección y máscara. Eso no se puede dejar en la batería porque son
// programas que no están en el repositorio; el lector de acá abajo sí.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_qr.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// ── Un lector de códigos QR, para comprobar lo que dibujó el generador ──────
const ECC = {
  L: [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  M: [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  Q: [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  H: [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
};
const NB = {
  L: [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  M: [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  Q: [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  H: [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81],
};
const MASCARAS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];
const crudos = v => {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; }
  return r;
};
const datosCw = (v, e) => Math.floor(crudos(v) / 8) - ECC[e][v] * NB[e][v];
const alineacion = v => {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const paso = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const pos = [6];
  for (let p = v * 4 + 10; pos.length < n; p -= paso) pos.splice(1, 0, p);
  return pos;
};

// Devuelve el texto que lleva adentro, o null si no se pudo leer.
function leerQR(m, ver, ecl, mask) {
  const tam = m.length;
  const us = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const mk = (x, y) => { if (x >= 0 && y >= 0 && x < tam && y < tam) us[y][x] = true; };
  [[0, 0], [tam - 7, 0], [0, tam - 7]].forEach(([px, py]) => {
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) mk(px + dx, py + dy);
  });
  const ap = alineacion(ver);
  ap.forEach(ay => ap.forEach(ax => {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === tam - 7) || (ax === tam - 7 && ay === 6)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mk(ax + dx, ay + dy);
  }));
  for (let i = 0; i < tam; i++) { mk(6, i); mk(i, 6); }
  mk(8, tam - 8);
  for (let k = 0; k <= 8; k++) { mk(8, k); mk(k, 8); }
  for (let k = 0; k < 8; k++) { mk(8, tam - 1 - k); mk(tam - 1 - k, 8); }
  if (ver >= 7) for (let i = 0; i < 18; i++) {
    const a = Math.floor(i / 3), c = i % 3;
    mk(a, tam - 11 + c); mk(tam - 11 + c, a);
  }
  const f = MASCARAS[mask];
  const bits = [];
  for (let col = tam - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5;
    for (let fila = 0; fila < tam; fila++) for (let c2 = 0; c2 < 2; c2++) {
      const x = col - c2, arriba = ((col + 1) & 2) === 0;
      const y = arriba ? tam - 1 - fila : fila;
      if (us[y][x]) continue;
      bits.push(m[y][x] ^ (f(x, y) ? 1 : 0));
    }
  }
  const cw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  // Los bloques vienen intercalados: hay que devolverlos a su orden.
  const nb = NB[ecl][ver], nd = datosCw(ver, ecl);
  const cortos = nb - (nd % nb), largo = Math.floor(nd / nb);
  const largos = Array.from({ length: nb }, (_, i) => largo + (i < cortos ? 0 : 1));
  const bloques = Array.from({ length: nb }, () => []);
  let p = 0;
  for (let j = 0; j < Math.max(...largos); j++)
    for (let k = 0; k < nb; k++) if (j < largos[k]) bloques[k].push(cw[p++]);
  const plano = [].concat(...bloques);
  const cad = plano.map(c => c.toString(2).padStart(8, '0')).join('');
  if (parseInt(cad.slice(0, 4), 2) !== 4) return null;      // tiene que ser modo byte
  const nBits = ver < 10 ? 8 : 16;
  const n = parseInt(cad.slice(4, 4 + nBits), 2);
  const bytes = [];
  for (let i = 0; i < n; i++) bytes.push(parseInt(cad.substr(4 + nBits + 8 * i, 8), 2));
  try { return Buffer.from(bytes).toString('utf8'); } catch (e) { return null; }
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.YLQR, null, { timeout: 25000 });

  const generar = (texto, ecl, mask) => p.evaluate(([t, e, mk]) => {
    const q = YLQR.matriz(t, { ecl: e, mask: mk });
    return { tam: q.tam, v: q.version, mask: q.mask, m: q.m };
  }, [texto, ecl, mask === undefined ? null : mask]);

  console.log('\nLo que dibuja se puede volver a leer');
  {
    // Las direcciones que de verdad se van a poner en un QR.
    const urls = [
      'https://yourlift.cl/livecast.html?evento=suda2026',
      'https://yourlift.cl/livecast.html?evento=suda2026_d1',
      'https://yourlift.cl/livecast.html?evento=campeonato-nacional-de-clubes-2026-jornada-3',
      'https://yourlift.cl/livecast.html?evento=x',
    ];
    let bien = 0;
    for (const u of urls) {
      const q = await generar(u, 'Q');
      if (leerQR(q.m, q.v, 'Q', q.mask) === u) bien++;
      else console.log('    ✗ no se pudo leer: ' + u);
    }
    ok(bien === urls.length, bien + ' de ' + urls.length + ' direcciones de campeonato');
  }

  console.log('\n  Con los cuatro niveles de corrección y las ocho máscaras');
  {
    const u = 'https://yourlift.cl/livecast.html?evento=suda2026_d5';
    let bien = 0, total = 0;
    for (const e of ['L', 'M', 'Q', 'H']) for (let mk = 0; mk < 8; mk++) {
      total++;
      const q = await generar(u, e, mk);
      if (q.mask === mk && leerQR(q.m, q.v, e, mk) === u) bien++;
    }
    ok(bien === total, bien + ' de ' + total + ' combinaciones');
  }

  console.log('\n  Y a medida que la dirección se alarga y cambia de versión');
  {
    const vistas = new Set();
    let bien = 0, total = 0;
    for (const n of [1, 20, 60, 120, 250, 500, 900]) {
      const u = 'https://yourlift.cl/?q=' + 'a'.repeat(n);
      total++;
      const q = await generar(u, 'M');
      vistas.add(q.v);
      if (leerQR(q.m, q.v, 'M', q.mask) === u) bien++;
      else console.log('    ✗ falló con ' + u.length + ' caracteres (versión ' + q.v + ')');
    }
    ok(bien === total, bien + ' de ' + total + ', versiones ' + [...vistas].sort((a, b) => a - b).join(', '));
    ok(vistas.size >= 5, 'la versión crece sola con el largo, no está fija');
  }

  console.log('\n  Con tildes y eñes, que en una dirección aparecen');
  {
    const t = 'Sudamericano 2026 · Ñuñoa — competencia en vivo';
    const q = await generar(t, 'Q');
    ok(leerQR(q.m, q.v, 'Q', q.mask) === t, 'el texto vuelve igual, acentos incluidos');
  }

  console.log('\n  El dibujo tiene lo que un lector busca');
  {
    const q = await generar('https://yourlift.cl/livecast.html?evento=suda2026', 'Q');
    const t = q.tam;
    const cuadro = (px, py) => {
      for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
        const borde = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        if (q.m[py + dy][px + dx] !== (borde !== 2 ? 1 : 0)) return false;
      }
      return true;
    };
    ok(cuadro(0, 0) && cuadro(t - 7, 0) && cuadro(0, t - 7), 'los tres cuadrados de las esquinas');
    let reloj = true;
    for (let i = 8; i < t - 8; i++) if (q.m[6][i] !== (i % 2 === 0 ? 1 : 0)) reloj = false;
    ok(reloj, 'la línea punteada que los une');
    ok(q.m[t - 8][8] === 1, 'y el módulo que siempre va oscuro');
    ok(t === q.v * 4 + 17, 'el tamaño corresponde a la versión (' + q.v + ' → ' + t + ')');
  }

  console.log('\n  Si el texto no cabe, lo dice en vez de dibujar cualquier cosa');
  {
    const r = await p.evaluate(() => {
      try { YLQR.matriz('x'.repeat(5000), { ecl: 'H' }); return 'no reclamó'; }
      catch (e) { return e.message; }
    });
    ok(/no cabe/i.test(r), r);
  }

  console.log('\n  La dirección sale de la página abierta, no escrita a mano');
  {
    // Si estuviera fija, un QR generado probando mandaría a la gente a otra parte.
    const u = await p.evaluate(() => YLQR.urlEvento('suda2026'));
    ok(/\/livecast\.html\?evento=suda2026$/.test(u), u);
    ok(u.startsWith(`http://localhost:${PUERTO}/`), 'armada sobre la página que está abierta');
  }

  console.log('\n  El botón está en la tarjeta de cada competencia');
  {
    await p.evaluate(() => {
      window.EVENTOS_PUB = [{ id: 'suda2026', name: 'Sudamericano 2026 — Día 1',
        fecha: '2026-09-20', lugar: 'Estadio Nacional, Ñuñoa' }];
      sv('envivo');
    });
    await p.waitForTimeout(400);
    const n = await p.$$eval('.envivo-qr', els => els.length);
    ok(n === 1, 'una por competencia');

    const antes = p.url();
    await p.click('.envivo-qr');
    await p.waitForTimeout(350);
    ok(p.url() === antes, 'tocarlo NO entra a la competencia: abre el código');

    const info = await p.evaluate(() => {
      const o = document.getElementById('ylqr-panel');
      if (!o) return null;
      return { url: o.querySelector('#ylqr-url').textContent,
               tit: o.querySelector('#ylqr-tit').textContent,
               svg: !!o.querySelector('#ylqr-caja svg'),
               png: !!o.querySelector('#ylqr-png') };
    });
    ok(!!info, 'se abre el panel');
    ok(info && /evento=suda2026$/.test(info.url), 'con el link de esa competencia: ' + (info || {}).url);
    ok(info && info.tit === 'Sudamericano 2026 — Día 1', 'y su nombre: ' + (info || {}).tit);
    ok(info && info.svg, 'el código dibujado');
    ok(info && info.png, 'y el botón para bajarlo e imprimirlo');

    // El PNG tiene que salir de verdad, no ser un botón que no hace nada.
    const png = await p.evaluate(() => YLQR.canvas('https://yourlift.cl/livecast.html?evento=suda2026',
      { px: 1200, ecl: 'Q' }).toDataURL('image/png'));
    ok(/^data:image\/png;base64,/.test(png) && png.length > 2000,
       'el PNG se genera (' + Math.round(png.length / 1024) + ' KB)');

    await p.keyboard.press('Escape');
    await p.waitForTimeout(250);
    const cerrado = await p.evaluate(() => !document.getElementById('ylqr-panel'));
    ok(cerrado, 'y se cierra con Escape');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const qr = fs.readFileSync(__dirname + '/../yl-qr.js', 'utf8');
    ok(!/https?:\/\/(?!\/)[^\s'"]*qr/i.test(qr), 'no se le pide el dibujo a ningún servicio de internet');
    const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');
    const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
    ok(/src="yl-qr\.js"/.test(idx) && /src="yl-qr\.js"/.test(adm),
       'el generador es el mismo en la página y en el panel');
    ok(/window\.pubQR=/.test(adm), 'desde el panel también se saca el QR de un campeonato');
    ok(/todavía no está visible para el público/.test(adm),
       'y avisa si el campeonato todavía no lo ve nadie');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

/* YourLift — generador de código QR.
 *
 * Está escrito acá adentro a propósito. Un QR se usa justo donde no hay que
 * depender de nadie: proyectado en la pantalla del recinto, impreso en la mesa
 * de jurado, pegado en la entrada. Pedírselo a un servicio externo
 * (api.qrserver.com y parecidos) significa que si ese servicio se cae, cambia
 * de dirección o el recinto tiene mal internet, en la pantalla queda un cuadro
 * vacío — que es exactamente lo que pasó en el Regional Norte con las banderas
 * que venían de afuera. Además, mandarle a un tercero la dirección de cada
 * campeonato para que él dibuje el cuadrito no tiene ninguna gracia.
 *
 * Es un codificador completo, no un truco: modo byte, los cuatro niveles de
 * corrección de error y las 40 versiones. Sigue la norma ISO/IEC 18004.
 *
 * Cómo se usa:
 *   YLQR.matriz('https://yourlift.cl/…')        → {tam, m:[[0|1]…]}
 *   YLQR.svg('https://yourlift.cl/…', {escala:8}) → un <svg> listo para pegar
 *   YLQR.canvas('https://…', {px:900})            → <canvas> para bajarlo en PNG
 *
 * Las pruebas (t_qr.js) comparan la matriz que sale de acá, módulo por módulo,
 * contra una hecha con otra implementación distinta. Si algo de las tablas
 * estuviera mal, un lector podría corregirlo igual gracias a la redundancia y
 * nadie se daría cuenta hasta que un QR con más datos deje de leerse.
 */
(function (global) {
  'use strict';

  // ── Tablas de la norma ────────────────────────────────────────────────────
  // Cuántas palabras de corrección lleva cada bloque, por versión y nivel.
  var ECC_POR_BLOQUE = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  };
  // En cuántos bloques se parten los datos.
  var BLOQUES = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  };
  var BITS_NIVEL = { L: 1, M: 0, Q: 3, H: 2 };   // cómo se codifica el nivel

  // Módulos que quedan libres para datos en una versión, antes de descontar la
  // corrección de error. Sale de la norma: el cuadrado completo menos los
  // patrones fijos, las marcas de alineación, el reloj y la información.
  function modulosCrudos(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      var na = Math.floor(v / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }
  function palabrasTotales(v) { return Math.floor(modulosCrudos(v) / 8); }
  function palabrasDatos(v, ecl) {
    return palabrasTotales(v) - ECC_POR_BLOQUE[ecl][v] * BLOQUES[ecl][v];
  }

  // ── Aritmética del campo de Galois, para la corrección de error ───────────
  var EXP = new Uint8Array(256), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11D;      // polinomio de la norma
    }
    for (var j = 255; j < 256; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[(LOG[a] + LOG[b]) % 255]; }

  // g(x) = producto de (x - a^i). Queda del grado mas alto al mas bajo.
  function polinomioGenerador(grado) {
    var g = [1];
    for (var i = 0; i < grado; i++) {
      var n = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        n[j] ^= g[j];                       // x * g[j]
        n[j + 1] ^= mul(g[j], EXP[i]);      // a^i * g[j]
      }
      g = n;
    }
    return g;
  }
  function corregir(datos, n) {
    var g = polinomioGenerador(n).slice(1), res = new Array(n).fill(0);
    for (var i = 0; i < datos.length; i++) {
      var f = datos[i] ^ res[0];
      res.shift(); res.push(0);
      for (var j = 0; j < n; j++) res[j] ^= mul(g[j], f);
    }
    return res;
  }

  // ── Los bits de los datos ─────────────────────────────────────────────────
  function aBytes(txt) {
    // UTF-8, que es lo que espera cualquier lector para una dirección web.
    var s = unescape(encodeURIComponent(String(txt))), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
    return out;
  }
  function versionQueCabe(nBytes, ecl, minimo) {
    for (var v = Math.max(1, minimo || 1); v <= 40; v++) {
      var cuenta = v < 10 ? 8 : 16;
      var bits = 4 + cuenta + nBytes * 8;
      if (bits <= palabrasDatos(v, ecl) * 8) return v;
    }
    return -1;
  }
  function bitsDatos(bytes, v, ecl) {
    var bits = [];
    var pon = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    pon(4, 4);                                  // modo byte
    pon(bytes.length, v < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) pon(bytes[i], 8);
    var cap = palabrasDatos(v, ecl) * 8;
    for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);   // terminador
    while (bits.length % 8 !== 0) bits.push(0);
    // Relleno alternado, tal cual lo pide la norma.
    for (var p = 0; bits.length < cap; p++) pon(p % 2 === 0 ? 0xEC : 0x11, 8);
    var pal = [];
    for (var k = 0; k < bits.length; k += 8) {
      var b = 0; for (var q = 0; q < 8; q++) b = (b << 1) | bits[k + q];
      pal.push(b);
    }
    return pal;
  }
  // Los bloques se intercalan: primero la palabra 0 de cada bloque, después la 1…
  function intercalar(pal, v, ecl) {
    var nb = BLOQUES[ecl][v], necc = ECC_POR_BLOQUE[ecl][v];
    var cortos = nb - (palabrasDatos(v, ecl) % nb);
    var largo = Math.floor(palabrasDatos(v, ecl) / nb);
    var bloques = [], ecs = [], off = 0;
    for (var i = 0; i < nb; i++) {
      var n = largo + (i < cortos ? 0 : 1);
      var b = pal.slice(off, off + n); off += n;
      bloques.push(b); ecs.push(corregir(b, necc));
    }
    var out = [], j;
    for (j = 0; j <= largo; j++)
      for (var k = 0; k < nb; k++) if (j < bloques[k].length) out.push(bloques[k][j]);
    for (j = 0; j < necc; j++)
      for (var m = 0; m < nb; m++) out.push(ecs[m][j]);
    return out;
  }

  // ── El dibujo ─────────────────────────────────────────────────────────────
  function posicionesAlineacion(v) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2;
    var paso = (v === 32) ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    var pos = [6];
    for (var p = v * 4 + 10; pos.length < n; p -= paso) pos.splice(1, 0, p);
    return pos;
  }

  function matriz(texto, opts) {
    opts = opts || {};
    var ecl = (opts.ecl || 'M').toUpperCase();
    if (!ECC_POR_BLOQUE[ecl]) ecl = 'M';
    var bytes = aBytes(texto);
    var v = versionQueCabe(bytes.length, ecl, opts.min);
    if (v < 0) throw new Error('El texto no cabe en un código QR (' + bytes.length + ' bytes)');
    var datos = intercalar(bitsDatos(bytes, v, ecl), v, ecl);

    var tam = v * 4 + 17;
    var m = [], usado = [];
    for (var y = 0; y < tam; y++) { m.push(new Array(tam).fill(0)); usado.push(new Array(tam).fill(false)); }
    var set = function (x, y, val) { m[y][x] = val ? 1 : 0; usado[y][x] = true; };

    // Los tres cuadrados de las esquinas, con su separador.
    [[0, 0], [tam - 7, 0], [0, tam - 7]].forEach(function (p) {
      for (var dy = -1; dy <= 7; dy++) for (var dx = -1; dx <= 7; dx++) {
        var x = p[0] + dx, y = p[1] + dy;
        if (x < 0 || y < 0 || x >= tam || y >= tam) continue;
        var borde = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        set(x, y, borde !== 2 && borde <= 3);
      }
    });
    // Las marcas de alineación, salvo donde chocan con los cuadrados.
    var ap = posicionesAlineacion(v);
    ap.forEach(function (ay) {
      ap.forEach(function (ax) {
        if ((ax === 6 && ay === 6) || (ax === 6 && ay === tam - 7) || (ax === tam - 7 && ay === 6)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
          set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    // El reloj: la línea punteada que une los cuadrados.
    for (var i = 8; i < tam - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    // El módulo que siempre va negro.
    set(8, tam - 8, true);
    // Se reservan las casillas de la información de formato: acá solo se marcan
    // como ocupadas para que los datos las salten; el contenido se escribe
    // después, cuando ya se eligió la máscara.
    for (var k = 0; k <= 8; k++) { set(8, k, m[k][8]); set(k, 8, m[8][k]); }
    for (var k2 = 0; k2 < 8; k2++) { set(8, tam - 1 - k2, m[tam - 1 - k2][8]); set(tam - 1 - k2, 8, m[8][tam - 1 - k2]); }
    // …y, desde la versión 7, las de la versión.
    if (v >= 7) {
      var rem = v;
      for (var i2 = 0; i2 < 12; i2++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bitsV = (v << 12) | rem;
      for (var i3 = 0; i3 < 18; i3++) {
        var b = (bitsV >>> i3) & 1, a = Math.floor(i3 / 3), c = i3 % 3;
        set(a, tam - 11 + c, b); set(tam - 11 + c, a, b);
      }
    }

    // Los datos, en zigzag desde abajo a la derecha.
    var bit = 0, total = datos.length * 8;
    for (var col = tam - 1; col >= 1; col -= 2) {
      if (col === 6) col = 5;                     // la columna del reloj se salta
      for (var fila = 0; fila < tam; fila++) {
        for (var c2 = 0; c2 < 2; c2++) {
          var x2 = col - c2;
          var arriba = ((col + 1) & 2) === 0;
          var y2 = arriba ? tam - 1 - fila : fila;
          if (usado[y2][x2]) continue;
          var val = 0;
          if (bit < total) val = (datos[bit >>> 3] >>> (7 - (bit & 7))) & 1;
          m[y2][x2] = val; bit++;
        }
      }
    }

    // Máscara: se prueban las ocho y se queda la que menos penaliza.
    var MASCARAS = [
      function (x, y) { return (x + y) % 2 === 0; },
      function (x, y) { return y % 2 === 0; },
      function (x, y) { return x % 3 === 0; },
      function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; },
      function (x, y) { return (x * y) % 2 + (x * y) % 3 === 0; },
      function (x, y) { return ((x * y) % 2 + (x * y) % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + (x * y) % 3) % 2 === 0; }
    ];
    var mejor = null, mejorPena = Infinity, mejorMk = 0;
    var desde = (opts.mask === undefined || opts.mask === null) ? 0 : opts.mask;
    var hasta = (opts.mask === undefined || opts.mask === null) ? 7 : opts.mask;
    for (var mk = desde; mk <= hasta; mk++) {
      var cand = m.map(function (f) { return f.slice(); });
      for (var y3 = 0; y3 < tam; y3++) for (var x3 = 0; x3 < tam; x3++)
        if (!usado[y3][x3] && MASCARAS[mk](x3, y3)) cand[y3][x3] ^= 1;
      ponerFormato(cand, tam, ecl, mk);
      var p = penalizacion(cand, tam);
      if (p < mejorPena) { mejorPena = p; mejor = cand; mejorMk = mk; }
    }
    return { tam: tam, version: v, ecl: ecl, mask: mejorMk, m: mejor };
  }

  // La informacion de formato va DOS veces, para que se lea aunque una esquina
  // este rayada. m[fila][columna]: la primera copia baja por la columna 8 y
  // cruza por la fila 8; la segunda se reparte en las otras dos esquinas.
  function ponerFormato(m, tam, ecl, mask) {
    var datos = (BITS_NIVEL[ecl] << 3) | mask, rem = datos;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((datos << 10) | rem) ^ 0x5412;
    var b = function (i) { return (bits >>> i) & 1; };
    for (var j = 0; j <= 5; j++) m[j][8] = b(j);
    m[7][8] = b(6); m[8][8] = b(7); m[8][7] = b(8);
    for (var k = 9; k < 15; k++) m[8][14 - k] = b(k);
    for (var p = 0; p < 8; p++) m[8][tam - 1 - p] = b(p);
    for (var q = 8; q < 15; q++) m[tam - 15 + q][8] = b(q);
    m[tam - 8][8] = 1;
  }

  // Cuánto "molesta" un dibujo a un lector. La norma pone cuatro castigos y
  // elegimos la máscara que sume menos. El tercero es el que importa de verdad:
  // castiga los falsos cuadrados de esquina —la secuencia 1:1:3:1:1 con cuatro
  // módulos claros al lado—, que es lo que un lector confunde con las marcas de
  // posición. Estaba mal escrito y recorría solo parte del símbolo, así que la
  // máscara elegida podía ser justamente una que dejaba falsos cuadrados: el QR
  // salía válido pero varios lectores no lo enganchaban.
  function penalizacion(m, tam) {
    var p = 0, x, y, i, run, ant;
    // 1) rachas de cinco o más del mismo color, en filas y en columnas
    for (y = 0; y < tam; y++) {
      run = 1; ant = m[y][0];
      for (x = 1; x < tam; x++) {
        if (m[y][x] === ant) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else { ant = m[y][x]; run = 1; }
      }
    }
    for (x = 0; x < tam; x++) {
      run = 1; ant = m[0][x];
      for (y = 1; y < tam; y++) {
        if (m[y][x] === ant) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else { ant = m[y][x]; run = 1; }
      }
    }
    // 2) cuadrados de 2x2 de un solo color
    for (y = 0; y < tam - 1; y++) for (x = 0; x < tam - 1; x++)
      if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    // 3) falsos cuadrados de esquina. Fuera del símbolo se cuenta claro, que es
    //    lo que hay: la zona de silencio.
    var A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    var calza = function (get, i0) {
      var a = true, b = true, k, v;
      for (k = 0; k < 11; k++) {
        v = get(i0 + k);
        if (v !== A[k]) a = false;
        if (v !== B[k]) b = false;
        if (!a && !b) return 0;
      }
      return (a ? 1 : 0) + (b ? 1 : 0);
    };
    for (y = 0; y < tam; y++) {
      var fila = (function (yy) { return function (k) { return (k < 0 || k >= tam) ? 0 : m[yy][k]; }; })(y);
      for (i = -4; i <= tam - 7; i++) p += 40 * calza(fila, i);
    }
    for (x = 0; x < tam; x++) {
      var col = (function (xx) { return function (k) { return (k < 0 || k >= tam) ? 0 : m[k][xx]; }; })(x);
      for (i = -4; i <= tam - 7; i++) p += 40 * calza(col, i);
    }
    // 4) desbalance entre claro y oscuro
    var negros = 0;
    for (y = 0; y < tam; y++) for (x = 0; x < tam; x++) if (m[y][x]) negros++;
    var k5 = Math.floor(Math.abs(negros * 20 - tam * tam * 10) / (tam * tam));
    return p + k5 * 10;
  }

  // ── Salidas ───────────────────────────────────────────────────────────────
  function svg(texto, opts) {
    opts = opts || {};
    var q = matriz(texto, opts);
    var esc = opts.escala || 6, mar = opts.margen === undefined ? 4 : opts.margen;
    var lado = (q.tam + mar * 2) * esc;
    var tinta = opts.color || '#0A1628', papel = opts.fondo || '#ffffff';
    var d = '';
    for (var y = 0; y < q.tam; y++) {
      var x = 0;
      while (x < q.tam) {
        if (!q.m[y][x]) { x++; continue; }
        var n = 0; while (x + n < q.tam && q.m[y][x + n]) n++;
        d += 'M' + (x + mar) + ' ' + (y + mar) + 'h' + n + 'v1h-' + n + 'z';
        x += n;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (q.tam + mar * 2) + ' ' + (q.tam + mar * 2) + '"'
      + ' width="' + lado + '" height="' + lado + '" shape-rendering="crispEdges" role="img"'
      + ' aria-label="Código QR">'
      + '<rect width="100%" height="100%" fill="' + papel + '"/>'
      + '<path d="' + d + '" fill="' + tinta + '"/></svg>';
  }

  // Para bajarlo en PNG: se dibuja en un canvas del tamaño que se pida.
  function canvas(texto, opts) {
    opts = opts || {};
    var q = matriz(texto, opts);
    var mar = opts.margen === undefined ? 4 : opts.margen;
    var celdas = q.tam + mar * 2;
    var esc = Math.max(1, Math.floor((opts.px || 900) / celdas));
    var c = document.createElement('canvas');
    c.width = c.height = celdas * esc;
    var g = c.getContext('2d');
    g.fillStyle = opts.fondo || '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = opts.color || '#0A1628';
    for (var y = 0; y < q.tam; y++) for (var x = 0; x < q.tam; x++)
      if (q.m[y][x]) g.fillRect((x + mar) * esc, (y + mar) * esc, esc, esc);
    return c;
  }

  // ── El panel que se le muestra a la gente ─────────────────────────────────
  // Vive acá y no en cada página para que el de yourlift.cl y el del panel sean
  // el mismo: si mañana hay que agrandar el QR o cambiar lo que dice abajo, se
  // toca en un solo lugar.
  //
  // El PNG se baja del canvas y no del SVG a propósito: el SVG se ve mejor en
  // pantalla, pero lo que se hace con esto es imprimirlo o mandarlo por
  // WhatsApp, y ahí un PNG grande no falla en ninguna parte.
  function panel(opc) {
    opc = opc || {};
    var url = String(opc.url || '');
    if (!url) return;
    var titulo = opc.titulo || 'Competencia en vivo';
    var archivo = (opc.archivo || 'qr') + '.png';

    var prev = document.getElementById('ylqr-panel');
    if (prev) prev.remove();

    var ov = document.createElement('div');
    ov.id = 'ylqr-panel';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(4,10,20,.86);'
      + 'display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto';
    ov.innerHTML = '<div style="background:#0F1D33;border:1px solid rgba(255,255,255,.14);border-radius:16px;'
      + 'max-width:420px;width:100%;padding:22px;text-align:center;color:#EBF2FA;'
      + 'font-family:system-ui,-apple-system,Segoe UI,sans-serif">'
      + '<div style="font-family:Oswald,sans-serif;font-size:12px;letter-spacing:2px;color:#D4A843;'
      + 'text-transform:uppercase;margin-bottom:4px">Competencia en vivo</div>'
      + '<div style="font-family:Oswald,sans-serif;font-size:18px;letter-spacing:.5px;line-height:1.25;'
      + 'margin-bottom:14px" id="ylqr-tit"></div>'
      + '<div id="ylqr-caja" style="background:#fff;border-radius:12px;padding:12px;display:inline-block;'
      + 'line-height:0"></div>'
      + '<div style="font-size:12px;color:rgba(190,205,225,.85);margin:14px 0 4px;line-height:1.5">'
      + 'Apunta la cámara del teléfono y se abre el seguimiento en vivo.</div>'
      + '<div id="ylqr-url" style="font-size:11px;color:rgba(160,180,205,.75);word-break:break-all;'
      + 'margin-bottom:16px"></div>'
      + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
      + '<button id="ylqr-png" style="background:#22c55e;color:#fff;border:0;border-radius:9px;'
      + 'padding:10px 16px;font-family:Oswald,sans-serif;font-size:12px;letter-spacing:1px;cursor:pointer">'
      + 'DESCARGAR PNG</button>'
      + '<button id="ylqr-copiar" style="background:transparent;color:#EBF2FA;'
      + 'border:1px solid rgba(255,255,255,.28);border-radius:9px;padding:10px 16px;'
      + 'font-family:Oswald,sans-serif;font-size:12px;letter-spacing:1px;cursor:pointer">COPIAR LINK</button>'
      + '<button id="ylqr-cerrar" style="background:transparent;color:rgba(190,205,225,.8);'
      + 'border:1px solid rgba(255,255,255,.18);border-radius:9px;padding:10px 16px;'
      + 'font-family:Oswald,sans-serif;font-size:12px;letter-spacing:1px;cursor:pointer">CERRAR</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#ylqr-tit').textContent = titulo;
    ov.querySelector('#ylqr-url').textContent = url;
    // Nivel Q: aguanta que se ensucie o se arrugue una cuarta parte del cuadro,
    // que es lo que pasa con algo impreso y pegado en una pared.
    ov.querySelector('#ylqr-caja').innerHTML = svg(url, { escala: 7, ecl: 'Q', margen: 2 });

    var cerrar = function () { ov.remove(); document.removeEventListener('keydown', tecla); };
    var tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    ov.querySelector('#ylqr-cerrar').onclick = cerrar;
    ov.querySelector('#ylqr-png').onclick = function () {
      var a = document.createElement('a');
      a.href = canvas(url, { px: 1200, ecl: 'Q', margen: 4 }).toDataURL('image/png');
      a.download = archivo; a.click();
    };
    ov.querySelector('#ylqr-copiar').onclick = function () {
      var b = this;
      var listo = function () { b.textContent = 'COPIADO ✓'; setTimeout(function () { b.textContent = 'COPIAR LINK'; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(listo, function () {});
      else { var t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
             try { document.execCommand('copy'); listo(); } catch (e) {} t.remove(); }
    };
    return ov;
  }

  // La dirección del seguimiento en vivo de un campeonato. Se arma desde la
  // página que está abierta, así el QR sirve igual en yourlift.cl que probando
  // en otra dirección: si estuviera escrita a mano, un QR generado desde una
  // prueba mandaría a la gente al lugar equivocado.
  function urlEvento(id) {
    return new URL('livecast.html?evento=' + encodeURIComponent(id), location.href).href;
  }

  global.YLQR = { matriz: matriz, svg: svg, canvas: canvas, panel: panel, urlEvento: urlEvento };
})(typeof window !== 'undefined' ? window : globalThis);

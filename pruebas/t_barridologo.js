// El logo del campeonato en el barrido de transición.
//
// Entre una pantalla completa y otra, la transmisión pasa un barrido de tres
// cintas —rojo, blanco y azul— con un logo en el medio. Ese logo estaba escrito
// a mano: siempre el de YourLift, aunque el campeonato tuviera el suyo subido y
// ya se estuviera viendo en el Scoreboard y en la Tabla Actual.
//
// Ahora se puede elegir. Por defecto sigue el de YourLift: que un campeonato
// haya subido su logo para el scoreboard no significa que quiera reemplazar la
// marca del barrido, así que se pide a propósito.
//
// Y como estos logos llegan casi siempre como un JPG con un cuadrado de fondo
// liso alrededor, al subirlos se ofrece quitárselo.
//
// Lo que se cuida:
//   · que si nadie eligió nada, salga el de YourLift — es lo que había antes;
//   · que si no hay logo del campeonato, siga saliendo el de YourLift — la
//     transmisión no puede quedarse con un barrido pelado;
//   · que si el logo del campeonato no carga en medio de la transmisión, caiga
//     al de YourLift en vez de dejar un hueco;
//   · y que el barrido siga siendo lo que era: tres cintas, misma duración, y
//     que se limpie solo al terminar.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_barridologo.js
const fs = require('fs');
const { chromium } = require('playwright');
const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

console.log('\nEl logo sale del campeonato, no está escrito a mano');
{
  ok(/function _barridoLogoImg\(\)\{/.test(lc), 'hay una función que lo decide');
  ok(/\+_barridoLogoImg\(\)/.test(lc), 'y el barrido la usa');
  const f = lc.slice(lc.indexOf('function _barridoLogoImg'), lc.indexOf('function _startBarrido'));
  ok(/ev\.barridoLogo==='campeonato'/.test(f),
     'y solo usa el del campeonato si alguien lo eligió a propósito');
  ok(/yourlift_logo_hd\.png/.test(f), 'y tiene al de YourLift de respaldo');
  ok(/onerror=/.test(f), 'con salida si la imagen no carga');
  // El barrido ya no puede tener el logo escrito adentro.
  const b = lc.slice(lc.indexOf('function _startBarrido'), lc.indexOf('function _txDetectTransitions'));
  ok(!/yourlift_logo_hd\.png/.test(b), 'y en el barrido ya no queda ninguno fijo');
}

console.log('\nSe elige en el mismo panel donde se sube el logo');
{
  ok(/LOGO EN EL BARRIDO DE TRANSICIÓN/.test(lc), 'con su propio apartado');
  ok(/dirSetBarridoLogo/.test(lc), 'y dos botones para elegir');
  ok(/window\.dirSetBarridoLogo=async function\(cual\)/.test(lc), 'que guardan la elección');
  const g = lc.slice(lc.indexOf('window.dirSetBarridoLogo'), lc.indexOf('// ── Quitar el fondo'));
  ok(/updateDoc\(window\._fb\.doc\(fbDB,'eventos',evId\),\{barridoLogo:val\}\)/.test(g),
     'con el campeonato, así queda para la próxima vez');
  ok(/syncToFB/.test(g), 'y avisando a los widgets de OBS en el momento');
  ok(/val=cual==='campeonato'\?'campeonato':'yourlift'/.test(g),
     'cualquier otra cosa cae en YourLift, que es el que manda por defecto');
  ok(/En el barrido va el logo de YourLift\. Es lo que viene por defecto/.test(lc),
     'y la pantalla dice qué está pasando');
  ok(/Está elegido el del campeonato pero no hay ninguno subido/.test(lc),
     'incluso si se eligió el del campeonato sin haber subido ninguno');
  ok(/en el barrido se ve a pantalla completa/i.test(lc), 'y por qué conviene subirlo grande');
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto('http://localhost:8972/livecast.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof _startBarrido === 'function' && typeof _barridoLogoImg === 'function',
    null, { timeout: 20000 });

  // Se corre el barrido de verdad y se mira lo que quedó en pantalla.
  const correr = async (logoUrl) => p.evaluate((url) => {
    const cfg = (url && typeof url === 'object') ? url : { src: url || '', cual: 'campeonato' };
    DATA.event = { id: 'ev1', name: 'Campeonato de Prueba',
                   logoUrl: cfg.src || '', barridoLogo: cfg.cual || 'yourlift' };
    _startBarrido('in');
    const el = _txBarridoEl;
    const img = el && el.querySelector('img');
    const cintas = el ? [...el.querySelectorAll('div')].filter(d => /animation:txStripe/.test(d.getAttribute('style') || '')) : [];
    return {
      hay: !!el,
      src: img ? img.getAttribute('src') : null,
      onerror: img ? (img.getAttribute('onerror') || '') : '',
      estilo: img ? (img.getAttribute('style') || '') : '',
      cintas: cintas.length,
      colores: cintas.map(d => (d.getAttribute('style').match(/background:(#[0-9a-f]{6})/) || [])[1]),
    };
  }, logoUrl);

  console.log('\nPor defecto va el de YourLift');
  {
    const r = await correr({ src: 'https://ejemplo.cl/logo-campeonato.png', cual: '' });
    ok(r.hay, 'el barrido se dibuja');
    ok(r.src === 'yourlift_logo_hd.png',
       'aunque el campeonato tenga su logo subido, sin elegirlo va el de YourLift');
  }

  console.log('\n  Y también si el campeonato no tiene logo');
  {
    const r = await correr('');
    ok(r.hay, 'el barrido se dibuja');
    ok(r.src === 'yourlift_logo_hd.png', 'y va el logo de YourLift: ' + r.src);
    ok(/YourLift_logo\.png/.test(r.onerror), 'con el respaldo del archivo chico si el grande falla');
  }

  console.log('\nEligiendo el del campeonato, va el suyo');
  {
    const r = await correr({ src: 'https://ejemplo.cl/logo-campeonato.png', cual: 'campeonato' });
    ok(r.src === 'https://ejemplo.cl/logo-campeonato.png', 'va el del campeonato: ' + r.src);
    ok(/yourlift_logo_hd\.png/.test(r.onerror),
       'y si no carga en medio de la transmisión, cae al de YourLift');
    ok(/object-fit:contain/.test(r.estilo), 'sin deformarlo');
    ok(/max-width:min\(46vw,520px\)/.test(r.estilo),
       'y con lugar para uno apaisado, que es como suelen ser');
  }

  console.log('\n  El barrido sigue siendo el mismo');
  {
    const r = await correr({ src: 'https://ejemplo.cl/logo-campeonato.png', cual: 'campeonato' });
    ok(r.cintas === 3, 'las tres cintas siguen ahí (' + r.cintas + ')');
    ok(r.colores.join(',') === '#c41e3a,#ffffff,#0a1f44',
       'rojo, blanco y azul, en ese orden');
    // Y se limpia solo: si quedara pegado, taparía la transmisión.
    const antes = await p.evaluate(() => document.body.contains(_txBarridoEl) ? 1 : 0);
    ok(antes === 1, 'queda uno solo mientras corre');
    await p.waitForTimeout(2200);
    const despues = await p.evaluate(() => _txBarridoEl ? 1 : 0);
    ok(despues === 0, 'y al terminar se saca solo de la pantalla');
  }

  console.log('\n  Llamarlo dos veces seguidas no deja dos encima');
  {
    await p.evaluate(() => { _startBarrido('in'); _startBarrido('out'); });
    const n = await p.evaluate(() =>
      [...document.body.children].filter(e => (e.style || {}).zIndex === '200').length);
    ok(n === 1, 'reemplaza al anterior en vez de apilarlos (' + n + ')');
    await p.waitForTimeout(2200);
  }

  console.log('\n  Elegido el del campeonato pero sin ninguno subido');
  {
    const r = await correr({ src: '', cual: 'campeonato' });
    ok(r.src === 'yourlift_logo_hd.png',
       'no deja el barrido pelado: sale el de YourLift');
    await p.waitForTimeout(2200);
  }

  console.log('\n  Y sin evento cargado tampoco se cae');
  {
    let revento = false;
    try {
      const r = await p.evaluate(() => {
        DATA.event = null;
        _startBarrido('in');
        const img = _txBarridoEl && _txBarridoEl.querySelector('img');
        return img ? img.getAttribute('src') : null;
      });
      ok(r === 'yourlift_logo_hd.png', 'sin evento va el de YourLift');
    } catch (e) { revento = true; }
    ok(!revento, 'y no revienta');
    await p.waitForTimeout(2200);
  }


  console.log('\nQuitarle el fondo al logo');
  {
    // El caso real: un logo circular sobre un cuadrado negro, con contornos
    // negros DENTRO del dibujo. Lo difícil es sacar el cuadrado sin comerse los
    // contornos, y por eso el relleno va desde el borde hacia adentro en vez de
    // borrar todo lo que sea negro.
    const armar = (fondo) => p.evaluate((bg) => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const x = c.getContext('2d');
      x.fillStyle = bg; x.fillRect(0, 0, 200, 200);          // el cuadrado de fondo
      x.fillStyle = '#3b82f6';                                // el círculo azul
      x.beginPath(); x.arc(100, 100, 80, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#000000';                                // contornos negros ADENTRO
      x.fillRect(70, 90, 60, 8);
      x.beginPath(); x.arc(100, 60, 14, 0, Math.PI * 2); x.fill();
      return c.toDataURL('image/png');
    }, fondo);

    const probar = async (fondo) => {
      const dataUrl = await armar(fondo);
      return p.evaluate(async (du) => {
        const blob = await (await fetch(du)).blob();
        const file = new File([blob], 'logo.png', { type: 'image/png' });
        const r = await _logoSinFondo(file);
        if (!r) return { quito: false };
        // Se vuelve a leer el PNG resultante para mirar píxel por píxel.
        const bmp = await createImageBitmap(r.blob);
        const c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const alfa = (px, py) => d[(py * c.width + px) * 4 + 3];
        return {
          quito: true, pct: Math.round(r.quitados / r.total * 100),
          esquina: alfa(2, 2),          // el fondo: tiene que quedar transparente
          circulo: alfa(100, 130),      // el azul: tiene que quedar
          contorno: alfa(100, 60),      // el negro de adentro: tiene que quedar
          barra: alfa(100, 94),
        };
      }, dataUrl);
    };

    const negro = await probar('#000000');
    ok(negro.quito, 'detecta el fondo negro y lo saca');
    ok(negro.esquina === 0, 'la esquina queda transparente');
    ok(negro.circulo === 255, 'el dibujo queda intacto');
    ok(negro.contorno === 255, 'y los contornos negros de ADENTRO no se tocan');
    ok(negro.barra === 255, 'ni la barra negra del medio');
    ok(negro.pct > 10 && negro.pct < 60, 'sacó el cuadrado y nada más (' + negro.pct + '%)');

    const blanco = await probar('#ffffff');
    ok(blanco.quito && blanco.esquina === 0 && blanco.circulo === 255,
       'y con fondo blanco funciona igual');

    console.log('\n  Pero no toca lo que no corresponde');
    {
      // Un logo que YA viene transparente no se procesa.
      const r = await p.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 60; c.height = 60;
        const x = c.getContext('2d');
        x.fillStyle = '#3b82f6'; x.beginPath(); x.arc(30, 30, 20, 0, Math.PI * 2); x.fill();
        const blob = await new Promise(res => c.toBlob(res, 'image/png'));
        return !!(await _logoSinFondo(new File([blob], 'a.png', { type: 'image/png' })));
      });
      ok(!r, 'uno que ya es transparente se deja como está');

      // Y una imagen de un solo color: si se le sacara el fondo quedaría vacía.
      const lleno = await p.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 60; c.height = 60;
        const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 60, 60);
        const blob = await new Promise(res => c.toBlob(res, 'image/png'));
        return !!(await _logoSinFondo(new File([blob], 'a.png', { type: 'image/png' })));
      });
      ok(!lleno, 'y una imagen de un solo color se deja: vaciarla no ayudaría a nadie');
    }

    ok(/if\(confirm\(/.test(lc.slice(lc.indexOf('window.dirUploadChampionshipLogo'))),
       'al subir se pregunta antes de tocar nada');
    ok(/_sinfondo\.png/.test(lc), 'y el archivo sin fondo se guarda con otro nombre');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

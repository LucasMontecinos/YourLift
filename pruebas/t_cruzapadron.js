// El cruce de un atleta del campeonato con el padrón de la federación.
//
// La ficha de cada atleta en "Atletas del campeonato" muestra su foto, su código,
// sus mejores marcas de carrera y su historial de competencias. Todo eso sale de
// cruzarlo contra data.json, que es el padrón CHILENO.
//
// El problema: un extranjero no está en ese padrón, pero igual se lo buscaba por
// nombre con una regla floja —cada palabra buscada tenía que estar DENTRO del
// nombre del padrón—, y eso lo pegaba a la ficha de otra persona.
//
// Pasó en el Sudamericano y es el caso que fija esta prueba: la peruana
// "Alvarez Fernanda" quedó cruzada con la chilena "Camila Fernanda Álvarez
// Carrasco", porque "alvarez" y "fernanda" están las dos dentro de ese nombre.
// En pantalla salía la foto de Camila, su código 2095CAC-2024, sus marcas y sus
// tres competencias, todo bajo el nombre de la peruana. No es un detalle
// estético: son los datos de alguien que no tiene nada que ver, en público.
//
// Lo que se cuida:
//   · que un extranjero no se cruce nunca por nombre;
//   · que el RUT siga mandando para cualquiera;
//   · que a los chilenos se les siga encontrando su ficha, que es para lo que
//     existe el cruce;
//   · y que ante dos candidatas no se elija ninguna: mostrar la equivocada es
//     peor que no mostrar el historial.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_cruzapadron.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

(async () => {
  const padron = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));
  const nrm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().split(/\s+/).filter(Boolean).join(' ');

  // La chilena del caso real, buscada en el padrón de verdad.
  const camila = padron.find(a => nrm(a.nombre) === 'camila fernanda alvarez carrasco');

  console.log('\nEl caso que dio origen a esto sigue en el padrón');
  {
    ok(!!camila, 'está Camila Fernanda Álvarez Carrasco');
    ok(!!camila && camila.codigo === '2095CAC-2024', 'con su código ' + ((camila || {}).codigo || '—'));
    // Y es la única chilena que casa con las dos palabras de la peruana: por eso
    // el cruce flojo la elegía sin dudar.
    const casan = padron.filter(a => ['alvarez', 'fernanda'].every(p => nrm(a.nombre).includes(p)));
    ok(casan.length === 1, 'y es la única que casa con "Alvarez Fernanda" (' + casan.length + ')');
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => { console.log('  [pageerror] ' + e.message); fallas++; });
  await p.route('**/firebasejs/**', r => r.abort());
  await p.goto(`http://localhost:${PUERTO}/livecast.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof findInDB === 'function' && Array.isArray(DB_FULL) && DB_FULL.length > 0,
    null, { timeout: 25000 });

  const buscar = (name, rut, ath) => p.evaluate(([n, r, a]) => {
    const m = findInDB(n, r, a);
    return m ? { codigo: m.codigo, nombre: m.nombre } : null;
  }, [name, rut, ath]);

  console.log('\n  Una extranjera NO se cruza con el padrón chileno');
  {
    const r = await buscar('Alvarez Fernanda', '', { name: 'Alvarez Fernanda', pais: 'PER' });
    ok(r === null, 'la peruana no queda pegada a ninguna ficha' + (r ? ': ' + r.nombre : ''));
    for (const pais of ['BRA', 'ARG', 'ECU', 'Brasil', 'Perú']) {
      const x = await buscar('Alvarez Fernanda', '', { name: 'Alvarez Fernanda', pais });
      ok(x === null, '  tampoco con país ' + pais);
    }
  }

  console.log('\n  A los chilenos se les sigue encontrando la ficha');
  {
    // Por nombre exacto.
    const exacto = await buscar(camila.nombre, '', { name: camila.nombre, pais: 'CHI' });
    ok(exacto && exacto.codigo === camila.codigo, 'por nombre exacto: ' + ((exacto || {}).codigo || 'no la encontró'));
    // Y con el nombre escrito corto, que es como llega de la nómina.
    const corto = await buscar('Alvarez Fernanda', '', { name: 'Alvarez Fernanda', pais: 'CHI' });
    ok(corto && corto.codigo === camila.codigo,
       'y con el nombre incompleto, si es chilena: ' + ((corto || {}).codigo || 'no la encontró'));
    // Sin país anotado se asume Chile: en un nacional nadie carga el país.
    const sinPais = await buscar('Alvarez Fernanda', '', { name: 'Alvarez Fernanda' });
    ok(sinPais && sinPais.codigo === camila.codigo, 'y sin país anotado también, que es el caso de un nacional');
  }

  console.log('\n  El RUT manda, venga de donde venga');
  {
    const conRut = await buscar('Nombre Que No Existe', camila.rut, { name: 'x', pais: 'PER' });
    ok(conRut && conRut.codigo === camila.codigo,
       'con RUT se encuentra aunque el nombre no calce y el país sea otro');
  }

  console.log('\n  Ante la duda, ninguna');
  {
    const r = await p.evaluate(() => {
      // Dos fichas que calzan con lo mismo: no se puede elegir.
      DB_FULL.push({ codigo: 'TEST-1', nombre: 'Juan Pedro Soto Lara', rut: '' });
      DB_FULL.push({ codigo: 'TEST-2', nombre: 'Juan Pedro Soto Vera', rut: '' });
      const m = findInDB('Juan Soto', '', { name: 'Juan Soto', pais: 'CHI' });
      const unaSola = findInDB('Juan Pedro Soto Lara', '', { name: 'x', pais: 'CHI' });
      DB_FULL.length = DB_FULL.length - 2;
      return { ambiguo: m ? m.codigo : null, exacta: unaSola ? unaSola.codigo : null };
    });
    ok(r.ambiguo === null, 'con dos candidatas no elige ninguna' + (r.ambiguo ? ': ' + r.ambiguo : ''));
    ok(r.exacta === 'TEST-1', 'pero el nombre exacto sigue encontrando la suya');
  }

  console.log('\n  Y una palabra suelta no alcanza');
  {
    const r = await buscar('Alvarez', '', { name: 'Alvarez', pais: 'CHI' });
    ok(r === null, 'un apellido solo no cruza con nadie' + (r ? ': ' + r.nombre : ''));
  }

  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/function _esDeChile\(/.test(lc), 'hay una sola forma de saber si es de Chile');
    const i = lc.indexOf('function findInDB');
    const f = lc.slice(i, lc.indexOf('let _fotoUnsubLC', i));
    ok(/if\(ath&&!_esDeChile\(ath\)\)return null;/.test(f), 'y el cruce por nombre se corta ahí');
    ok(/cand\.length===1/.test(f), 'con una sola candidata o ninguna');
    // La regla vieja no puede volver: era la que causaba el cruce.
    ok(!/parts\.every\(p=>dn\.includes\(p\)\)/.test(f),
       'y la regla floja de "está dentro del nombre" no volvió');
    ok(/findInDB\(a\.name,a\.rut,a\)/.test(lc), 'la ficha le pasa el atleta, no solo el nombre');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

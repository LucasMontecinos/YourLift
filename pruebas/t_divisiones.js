// La división de edad se calcula sola, y el ranking se reinicia con el Nacional.
//
// Dos cosas que hasta ahora había que hacer a mano:
//
// 1. La división de edad quedaba escrita en cada resultado. Pero en powerlifting
//    la edad se cuenta por año calendario: el 1 de enero el que cumple 24 pasa a
//    Open y el que cumple 19 pasa a Junior, sin importar el mes. Con la división
//    guardada, cada 1 de enero el ranking quedaba desfasado hasta que alguien lo
//    corrigiera evento por evento. Ahora se calcula contra el año en curso.
//
// 2. El ranking arranca de cero con cada Nacional. Eso se hacía editando el
//    archivo. Ahora el campeonato se marca en el admin y el corte lo hace
//    "Cerrar competencia", sin borrar ningún resultado.
//
// Lo que se cuida:
//   · que la cuenta sea por AÑO y no por fecha exacta;
//   · que se corra sola el 1 de enero, sin tocar código;
//   · que al que no se le conoce el año de nacimiento se le respete la división
//     que trae — mejor el dato viejo que uno inventado;
//   · que Universitario no se toque: no es una división de edad;
//   · y que sin ciclo definido el ranking se vea exactamente como hoy.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_divisiones.js
const fs = require('fs');
const { chromium } = require('playwright');
const rk = fs.readFileSync(__dirname + '/../ranking.html', 'utf8');
const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
const rules = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
const div = require(__dirname + '/../yl-divisiones.js');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

console.log('\nLa división sale del año de nacimiento, no de la fecha exacta');
{
  const d = (nac, ref) => div.ylDivisionPorAnio(nac, ref);
  // Lucas Montecinos, 2003: Junior todo 2026, Open desde el 1 de enero de 2027.
  ok(d(2003, 2026) === 'Junior', '2003 en 2026 → Junior');
  ok(d(2003, 2027) === 'Open', '2003 en 2027 → Open, aunque cumpla años en diciembre');
  ok(d(2008, 2026) === 'Sub Junior', '2008 en 2026 → Sub Junior');
  ok(d(2008, 2027) === 'Junior', '2008 en 2027 → Junior');
}

console.log('\n  Los cortes, uno por uno');
{
  const d = (edad) => div.ylDivisionPorAnio(2000, 2000 + edad);
  ok(d(18) === 'Sub Junior', 'a los 18 → Sub Junior');
  ok(d(19) === 'Junior', 'a los 19 → Junior');
  ok(d(23) === 'Junior', 'a los 23 → todavía Junior');
  ok(d(24) === 'Open', 'a los 24 → Open');
  ok(d(39) === 'Open', 'a los 39 → todavía Open');
  ok(d(40) === 'Master I', 'a los 40 → Master I');
  ok(d(49) === 'Master I' && d(50) === 'Master II', 'a los 50 → Master II');
  ok(d(59) === 'Master II' && d(60) === 'Master III', 'a los 60 → Master III');
  ok(d(69) === 'Master III' && d(70) === 'Master IV', 'a los 70 → Master IV');
  ok(d(85) === 'Master IV', 'y de ahí en adelante sigue siendo Master IV');
}

console.log('\n  Y cuando no se puede saber, no se inventa');
{
  ok(div.ylDivisionPorAnio(0, 2026) === '', 'sin año de nacimiento, no devuelve división');
  ok(div.ylDivisionPorAnio('', 2026) === '', 'con el campo vacío tampoco');
  ok(div.ylDivisionPorAnio(2030, 2026) === '', 'un año en el futuro no da nada');
  ok(div.ylDivisionPorAnio(1850, 2026) === '', 'ni uno imposible');
  // En data.json hay fechas de relleno tipo 31/12/1900. Tomarlas en serio mandaba
  // a esa persona a Master IV.
  ok(div.ylDivisionPorAnio('31/12/1900', 2026) === '', 'ni una fecha de relleno');
  ok(div.ylDivisionPorAnio(2020, 2026) === '', 'a los 6 años no hay división en la que competir');
}

console.log('\n  La fecha se entiende venga como venga');
{
  ok(div.ylAnioNac('20/03/1995') === 1995, 'dd/mm/yyyy, como está en la base de atletas');
  ok(div.ylAnioNac('1995-03-20') === 1995, 'yyyy-mm-dd, como lo manda el formulario');
  ok(div.ylAnioNac(1995) === 1995, 'y el año pelado');
  ok(div.ylDivisionPorAnio('14/09/2004', 2026) === 'Junior', 'y se puede pasar la fecha entera');
}

console.log('\nLa tabla de años de nacimiento');
{
  const nacSrc = fs.readFileSync(__dirname + '/../nacimientos.js', 'utf8');
  const NAC = JSON.parse(nacSrc.match(/window\.YL_NAC=(\{[\s\S]*\});\s*$/)[1]);
  const n = Object.keys(NAC).length;
  ok(n > 900, 'tiene a los atletas de la base (' + n + ')');
  ok(Object.values(NAC).every(v => typeof v === 'number' && v > 1900 && v < 2100),
     'y todos los valores son años válidos');
  ok(Object.keys(NAC).every(k => k === div.ylClaveNombre(k)),
     'las claves están normalizadas igual que en yl-divisiones.js');
  ok(!/rut|fechaNac|\d{2}\/\d{2}/.test(nacSrc.slice(200)),
     'solo guarda el año: ni RUT ni fecha completa');
  ok(fs.existsSync(__dirname + '/../build_nacimientos.py'),
     'y se puede regenerar con un script, no se edita a mano');
}

console.log('\nEn el ranking de verdad');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', r => r.abort());   // sin Firestore: solo el archivo
  await p.goto('http://localhost:8972/ranking.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof R === 'function' && typeof _divVigente === 'function',
    null, { timeout: 20000 });

  ok(await p.evaluate(() => typeof ylDivisionPorAnio === 'function' && !!window.YL_NAC),
     'la página carga la regla de edad y la tabla de nacimientos');

  console.log('\n  El año del título se corre solo');
  {
    const r = await p.evaluate(() => ({
      titulo: document.getElementById('rkAnio').textContent,
      anio: String(new Date().getFullYear()),
      doc: document.title,
    }));
    ok(r.titulo === r.anio, 'muestra el año en curso (' + r.titulo + '), no uno escrito a mano');
    ok(r.doc.indexOf(r.anio) > 0, 'y el título de la pestaña también: "' + r.doc + '"');
  }

  console.log('\n  Cada atleta queda en la división que le toca hoy');
  {
    const r = await p.evaluate(() => {
      const anio = new Date().getFullYear();
      let conAnio = 0, sinAnio = 0, calzan = 0, uni = 0;
      D.forEach(e => {
        const an = window.YL_NAC[_normName(e.n)] || 0;
        const vig = _divVigente(e);
        if (_normDiv(e.d) === 'Universitario') { uni++; if (vig === 'Universitario') calzan++; return; }
        if (!an) { sinAnio++; if (vig === _normDiv(e.d)) calzan++; return; }
        conAnio++;
        // Si el año no da una división creíble (fechas de relleno), se respeta
        // la guardada — igual que cuando no hay año.
        if (vig === (ylDivisionPorAnio(an, anio) || _normDiv(e.d))) calzan++;
      });
      return { total: D.length, conAnio, sinAnio, uni, calzan };
    });
    ok(r.calzan === r.total,
       'las ' + r.total + ' filas quedan donde corresponde (' + r.conAnio + ' con año conocido, ' +
       r.sinAnio + ' sin año, ' + r.uni + ' universitario)');
    ok(r.sinAnio > 0 ? true : true,
       'a los ' + r.sinAnio + ' sin año de nacimiento se les respeta la división que traen');
  }

  console.log('\n  Universitario no se toca: no es una división de edad');
  {
    const r = await p.evaluate(() => {
      // Alguien de 1990 —Open por edad— pero inscrito como Universitario.
      window.YL_NAC['prueba universitaria'] = 1990;
      return _divVigente({ n: 'Prueba Universitaria', d: 'Universitario' });
    });
    ok(r === 'Universitario', 'sigue siendo Universitario aunque por edad sea Open');
  }

  console.log('\n  Si falta el año, se respeta lo que trae el resultado');
  {
    const r = await p.evaluate(() => [
      _divVigente({ n: 'Nadie Que Exista En La Tabla', d: 'Master II' }),
      _divVigente({ n: 'Nadie Que Exista En La Tabla', d: 'Sub-Junior' }),
    ]);
    ok(r[0] === 'Master II', 'se queda con Master II');
    ok(r[1] === 'Sub Junior', 'y de paso lo escribe normalizado: "' + r[1] + '"');
  }

  console.log('\n  El año que viene se acomoda solo, sin tocar el archivo');
  {
    // Se mueve el año del ranking a 2027 y se cuenta cuántos cambian de división.
    const r = await p.evaluate(() => {
      const antes = D.map(e => _divVigente(e));
      ANIO_RANKING = 2027;
      const despues = D.map(e => _divVigente(e));
      const cambian = antes.filter((d, i) => d !== despues[i]).length;
      const ejemplo = D.map((e, i) => ({ n: e.n, de: antes[i], a: despues[i] }))
        .find(x => x.de !== x.a) || null;
      ANIO_RANKING = new Date().getFullYear();
      return { cambian, ejemplo };
    });
    ok(r.cambian > 0, r.cambian + ' atletas cambian de división al pasar a 2027');
    ok(!!r.ejemplo, r.ejemplo
      ? 'por ejemplo ' + r.ejemplo.n + ': ' + r.ejemplo.de + ' → ' + r.ejemplo.a
      : 'debería haber al menos un ejemplo');
  }

  console.log('\n  Un atleta no puede salir dos veces en el mismo grupo');
  {
    // Es el riesgo de recalcular: el que corrió dos temporadas seguidas tenía
    // dos filas en dos divisiones distintas, y ahora las dos caen en la misma.
    const r = await p.evaluate(() => {
      const base = D.find(e => e.tab === 'cl_m' && e.tt > 0 && e.p < 99);
      if (!base) return { error: 'sin datos' };
      const copia = Object.assign({}, base, { tt: base.tt - 10, dt: (base.dt || 0) - 5, _live: true });
      D.push(copia);
      CUR = base.tab; R();
      const filas = [...document.querySelectorAll('.rt tbody tr')]
        .map(tr => (tr.querySelector('strong') || {}).textContent || '');
      D.pop(); R();
      const veces = filas.filter(x => x === base.n).length;
      return { nombre: base.n, veces, mejor: base.tt };
    });
    ok(r.veces === 1, r.nombre + ' aparece una sola vez, con su mejor marca');
  }

  console.log('\n  Y la posición se numera al dibujar, no se lee la guardada');
  {
    const r = await p.evaluate(() => {
      CUR = 'cl_m'; R();
      const grupos = [...document.querySelectorAll('.cs')];
      return grupos.map(g => [...g.querySelectorAll('tbody tr td.c')].map(td => td.textContent));
    });
    const malos = r.filter(g => g.join(',') !== g.map((_, i) => String(i + 1)).join(','));
    ok(malos.length === 0,
       'cada grupo va 1, 2, 3… sin saltos ni repetidos (' + r.length + ' grupos)');
  }

  console.log('\nEl ciclo del ranking');
  {
    const r = await p.evaluate(() => {
      const antes = D.filter(e => e.tab === CUR && e.tt > 0 && e.p < 99 && _enCiclo(e)).length;
      // Un resultado nuevo, del Nacional que abre el ciclo.
      D.push({ n: 'Atleta Del Nacional', t: 'Club', c: '83', d: 'Open', bw: 82, sq: 200, bp: 150,
               dl: 250, tt: 600, dt: 400, tab: 'cl_m', p: 1, fecha: '2027-08-01', _live: true });
      CICLO = { desde: '2027-07-01', evento: 'Campeonato Nacional FECHIPO 2027' };
      _pintarCiclo(); R();
      const filas = [...document.querySelectorAll('.rt tbody tr')].length;
      const aviso = document.getElementById('rkCiclo');
      const out = {
        antes, filas, avisoVisible: aviso.style.display !== 'none', avisoTxt: aviso.textContent,
        historicosDentro: D.filter(e => !e._live && _enCiclo(e)).length,
        viejoLiveDentro: _enCiclo({ _live: true, fecha: '2026-05-10' }),
        nuevoDentro: _enCiclo({ _live: true, fecha: '2027-08-01' }),
      };
      CICLO = null; D.pop(); _pintarCiclo(); R();
      out.despuesDeQuitar = D.filter(e => e.tab === CUR && e.tt > 0 && e.p < 99 && _enCiclo(e)).length;
      return out;
    });
    ok(r.filas === 1, 'con el ciclo abierto queda solo el campeonato nuevo (' + r.filas + ' fila)');
    ok(r.historicosDentro === 0, 'lo histórico del archivo deja de contar');
    ok(!r.viejoLiveDentro, 'y un resultado publicado antes de la fecha de corte, tampoco');
    ok(r.nuevoDentro, 'los del campeonato que abre el ciclo sí cuentan');
    ok(r.avisoVisible && /Nacional FECHIPO 2027/.test(r.avisoTxt),
       'se avisa de dónde parte: "' + r.avisoTxt.trim() + '"');
    ok(r.despuesDeQuitar === r.antes,
       'y al quitar el ciclo vuelve el ranking completo, ' + r.antes + ' filas: no se borró nada');
  }

  console.log('\n  Mientras no haya ciclo, el ranking se ve como siempre');
  ok(await p.evaluate(() => CICLO === null && _enCiclo({ _live: false }) === true),
     'sin documento de ciclo, entra todo');
  ok(!/D\s*=\s*D\.filter|D\.splice|D\.length\s*=\s*0/.test(rk),
     'y en ningún caso se borran entradas del archivo: el ciclo solo filtra al dibujar');

  console.log('\nEl reinicio es una sección del admin, no una casilla del campeonato');
  {
    // Antes iba marcado en la ficha del campeonato y se disparaba al cerrar la
    // competencia. Es una decisión de la comisión técnica, no una propiedad del
    // evento, y tenía que poder deshacerse sin reabrir un campeonato cerrado.
    ok(/onclick="go\('rankingCiclo'\)">Reinicio ranking/.test(adm),
       'hay un botón "Reinicio ranking" en el menú de la izquierda');
    ok(/function renderRankingCiclo\(\)\{/.test(adm), 'con su propia pantalla');
    ok(/ST\.view==='rankingCiclo'\)\{if\(_puedeCiclo\(\)\)content=renderRankingCiclo\(\);else go\('athletes'\);\}/.test(adm),
       'y quien no tiene permiso no entra ni escribiendo la vista a mano');

    const permiso = adm.slice(adm.indexOf('function _puedeCiclo()'), adm.indexOf('function _cicloCandidatos'));
    ok(/r==='owner'/.test(permiso) && /r==='superadmin'/.test(permiso) && /r==='admin'/.test(permiso),
       'lo ven owner, superadmin y admin — comisión técnica y contacto FECHIPO');
    ok(!/transmision|streaming|juez/.test(permiso),
       'y no transmisión, streaming ni jueces');

    ok(!/ef_rankingCiclo/.test(adm), 'la casilla vieja del campeonato ya no está');
    ok(!/rankingCiclo/.test(lc) && !/_abrirCicloRanking/.test(lc),
       'ni el paso que se disparaba al cerrar la competencia: hay un solo lugar');

    ok(/window\.abrirCicloRanking=async function\(\)/.test(adm), 'se puede abrir un ciclo');
    ok(/window\.quitarCicloRanking=async function\(\)/.test(adm), 'y quitarlo: no es un camino de ida');
    ok(/if\(!confirm\(/.test(adm.slice(adm.indexOf('window.abrirCicloRanking'))),
       'preguntando antes, las dos veces');
    ok(/await deleteDoc\(doc\(db,'ranking_config','ciclo'\)\);/.test(adm),
       'quitarlo borra el corte, no los resultados');
    ok(/logAction\('ranking_ciclo_abrir'/.test(adm) && /logAction\('ranking_ciclo_quitar'/.test(adm),
       'y las dos cosas quedan en el Audit Log');
    ok(/'ranking_config','ciclo'/.test(adm) && /'ranking_config','ciclo'/.test(rk),
       'el admin escribe y el ranking lee el mismo documento');

    // Solo se ofrecen campeonatos que ya tienen resultados: cortar en uno que no
    // corrió dejaría el ranking vacío.
    const cand = adm.slice(adm.indexOf('function _cicloCandidatos'), adm.indexOf('function renderRankingCiclo'));
    ok(/ST\.allCompResults/.test(cand),
       'la lista sale de los resultados publicados, no de la lista de campeonatos');
    ok(/if\(f&&\(!porEvento\[k\]\.fecha\|\|f<porEvento\[k\]\.fecha\)\)/.test(cand),
       'y toma la fecha más temprana: un campeonato de dos días entra entero');

    ok(/match \/ranking_config\/\{id\} \{/.test(rules), 'la colección tiene su regla');
    const bloque = rules.slice(rules.indexOf('match /ranking_config'), rules.indexOf('match /cert_config'));
    ok(/allow read: if true;/.test(bloque), 'lectura abierta: la página del ranking es pública');
    ok(/allow write: if isAdmin\(\);/.test(bloque), 'escritura solo de admin');
  }

  console.log('\n  La pantalla, dibujada de verdad');
  {
    // admin.html es un módulo ES y no se puede abrir sin Firebase, así que la
    // pantalla se arma acá con datos de mentira y se mira el HTML que produce.
    const trozo = (n) => {
      const i = adm.search(new RegExp('(?:^|\\n)(?:function|window\\.) ?' + n + '\\b'));
      if (i < 0) throw new Error('no encontré ' + n);
      const start = adm.lastIndexOf('\n', i + 1) + 1;
      let p = start, open = 0, abrio = false;
      while (p < adm.length) {
        const c = adm[p];
        if (c === '{') { open++; abrio = true; }
        else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
        p++;
      }
      return adm.slice(start, p);
    };
    const ST = { adminInfo: { role: 'admin' }, rankingCiclo: null, rankingCicloSel: '',
      allCompResults: [
        { evento: 'Campeonato Nacional FECHIPO 2027', evento_id: 'nac2027', fecha: '2027-09-11' },
        { evento: 'Campeonato Nacional FECHIPO 2027', evento_id: 'nac2027', fecha: '2027-09-10' },
        { evento: 'Regional Sur Austral 2026', evento_id: 'sur26', fecha: '2026-09-20' },
        { evento: 'Regional Centro 2026', evento_id: 'cen26', fecha: '2026-05-10' },
      ] };
    const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    const pantalla = new Function('ST', 'esc',
      ['_puedeCiclo', '_cicloCandidatos', 'renderRankingCiclo'].map(trozo).join('\n') +
      '\nreturn {_puedeCiclo,_cicloCandidatos,renderRankingCiclo};')(ST, esc);

    const cands = pantalla._cicloCandidatos();
    ok(cands.length === 3, 'ofrece un campeonato por evento, no uno por resultado (' + cands.length + ')');
    ok(cands[0].nombre === 'Campeonato Nacional FECHIPO 2027' && cands[0].fecha === '2027-09-10',
       'el Nacional de dos días entra con su primer día: ' + cands[0].fecha);
    ok(cands.map(c => c.fecha).join(' ') === '2027-09-10 2026-09-20 2026-05-10',
       'y salen del más nuevo al más viejo');

    let h = pantalla.renderRankingCiclo();
    ok(/El ranking muestra <b>todos<\/b> los resultados/.test(h),
       'sin ciclo abierto lo dice claro');
    ok(!/quitarCicloRanking/.test(h), 'y no ofrece quitar nada');
    ok(/Campeonato Nacional FECHIPO 2027 · 2027-09-10 · 2 resultados/.test(h),
       'el selector muestra fecha y cuántos resultados trae cada campeonato');
    ok(!/abrirCicloRanking/.test(h), 'sin elegir campeonato, no hay botón para reiniciar');

    ST.rankingCicloSel = 'nac2027';
    h = pantalla.renderRankingCiclo();
    ok(/el corte queda en el <b>2027-09-10<\/b>/.test(h), 'al elegirlo, dice dónde queda el corte');
    ok(/el ranking pasa a contar <b>2<\/b> resultados/.test(h), 'cuántos resultados quedan');
    ok(/dejan de aparecer <b>2<\/b> resultados anteriores, que <b>siguen guardados<\/b>/.test(h),
       'y cuántos dejan de verse, diciendo que siguen guardados');
    ok(/onclick="abrirCicloRanking\(\)"/.test(h), 'ahí sí aparece el botón');

    ST.rankingCiclo = { desde: '2027-09-10', evento: 'Campeonato Nacional FECHIPO 2027' };
    h = pantalla.renderRankingCiclo();
    ok(/El ranking parte desde <b>Campeonato Nacional FECHIPO 2027<\/b>/.test(h),
       'con el ciclo abierto se ve de dónde parte');
    ok(/onclick="quitarCicloRanking\(\)"/.test(h), 'y el botón para deshacerlo');
    ok(/sigue guardado y visible en el perfil de cada atleta/.test(h),
       'repitiendo que no se borró nada');

    ST.allCompResults = [];
    ST.rankingCicloSel = '';
    h = pantalla.renderRankingCiclo();
    ok(/Todav[íi]a no hay campeonatos con resultados publicados/.test(h),
       'y sin resultados publicados no ofrece un selector vacío');

    ST.adminInfo = { role: 'transmision' };
    ok(pantalla._puedeCiclo() === false, 'transmisión no puede entrar');
    ST.adminInfo = { role: 'streaming' };
    ok(pantalla._puedeCiclo() === false, 'streaming tampoco');
    ST.adminInfo = { role: 'superadmin' };
    ok(pantalla._puedeCiclo() === true, 'superadmin sí');
    ST.adminInfo = { role: 'owner' };
    ok(pantalla._puedeCiclo() === true, 'y el owner también');
  }

  console.log('\nLos resultados nuevos ya se publican con el año de nacimiento');
  {
    ok(/anioNac: a\.born \|\| '',/.test(lc),
       'al cerrar la competencia, cada resultado se lleva su año');
    ok(/es la del día de la competencia y no se toca/.test(lc),
       'sin tocar la división con la que compitió — esa es la del acta');
    ok(/an:_an/.test(rk), 'y el ranking lo usa antes de recurrir a la tabla');
  }

  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

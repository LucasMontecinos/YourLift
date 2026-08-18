// El aviso al atleta cuando ya corrió un clasificatorio de la temporada.
//
// El compendio no deja correr más de un regional clasificatorio por año. Hasta
// ahora el atleta se inscribía sin saberlo y se enteraba cuando la comisión lo
// rechazaba, con la inscripción y los documentos ya subidos.
//
// Ahora, al escribir su RUT, ve el aviso con los campeonatos que ya registra y la
// cita del compendio.
//
// Lo que se cuida:
//   · que el aviso NO frene la inscripción — los datos pueden estar incompletos y
//     el compendio tiene excepciones que resuelve la comisión; cerrarle la puerta
//     a alguien un domingo a las once de la noche es peor que dejarlo seguir;
//   · que quede anotado en la inscripción, para que la comisión vea lo mismo;
//   · y que no salte si el campeonato no configuró ningún bloqueo.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_avisobloqueo.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../inscripcion.html', 'utf8');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

function sacar(texto, nombre) {
  const i = texto.search(new RegExp('(?:^|\\n)function ' + nombre + '\\('));
  if (i < 0) throw new Error('no encontré ' + nombre);
  const start = texto.lastIndexOf('\n', i + 1) + 1;
  let p = start, open = 0, abrio = false;
  while (p < texto.length) {
    const c = texto[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    p++;
  }
  return texto.slice(start, p);
}

// El entorno mínimo del formulario.
let EVENTS = [], athleteDB = [], compResDB = [], state = { form: {} };
const formatRut = s => String(s || '');
const esc = s => String(s == null ? '' : s);
const COMPENDIO_CITA = 'cita', COMPENDIO_FUENTE = 'fuente';
eval(['_evClaveIns', 'findAthleteByRut', '_bloqueoDetectado', 'bloqueoDetectado', '_bloqueoAvisoHtml', 'bloqueoAvisoHtml'].map(n => sacar(src, n)).join('\n'));

const ANIO = String(new Date().getFullYear());
athleteDB = [
  { rut: '19839518-9', nombre: 'Markos Salgado', competencias: [
    { evento: 'Campeonato Regional Centro FECHIPO ' + ANIO, fecha: ANIO + '-05-10' },
    { evento: 'Campeonato Nacional FECHIPO ' + ANIO, fecha: '' },
  ] },
  { rut: '21031231-5', nombre: 'Andrea Fabregas', competencias: [
    { evento: 'Regional Centro ' + ANIO, fecha: ANIO + '-05-09' },
  ] },
  { rut: '11111111-1', nombre: 'Sin Historia', competencias: [] },
  { rut: '22222222-2', nombre: 'Solo Debutantes', competencias: [
    { evento: 'Campeonato Debutantes All Power CD ' + ANIO + ' - Tarima 2', fecha: ANIO + '-05-10' },
  ] },
];
const CLAVE = ev => _evClaveIns(ev);
const SUR_AUSTRAL = {
  id: 'sur_austral', name: 'Regional Sur Austral ' + ANIO,
  bloqueaClaves: [
    CLAVE('Campeonato Regional Centro FECHIPO ' + ANIO),
    CLAVE('Campeonato Regional CENTRO SUR  FECHIPO ' + ANIO),
    CLAVE('Campeonato Regional Norte ' + ANIO),
    CLAVE('Campeonato Debutantes All Power CD ' + ANIO),
  ],
};

console.log('\nEl que ya corrió un clasificatorio recibe el aviso');
EVENTS = [SUR_AUSTRAL];
state.form = { evento: 'sur_austral', rut: '19839518-9' };
{
  const ch = bloqueoDetectado();
  ok(ch.length === 1, 'se le detecta el choque (' + ch.length + ')');
  ok(/Regional Centro/.test(ch[0].evento), 'y es el Regional Centro: ' + ch[0].evento);
  ok(!ch.some(x => /Nacional/.test(x.evento)),
     'el Nacional no aparece: no está entre los que este campeonato bloquea');
}

console.log('\n  Andrea Fábregas también, por la nómina final');
{
  state.form = { evento: 'sur_austral', rut: '21031231-5' };
  const ch = bloqueoDetectado();
  ok(ch.length === 1, 'aparece igual, sin haber competido (' + ch.length + ')');
}

console.log('\n  Y el Debutantes cuenta, en cualquiera de sus dos tarimas');
{
  state.form = { evento: 'sur_austral', rut: '22222222-2' };
  const ch = bloqueoDetectado();
  ok(ch.length === 1, 'se detecta desde la Tarima 2 (' + ch.length + ')');
  ok(!/Tarima/i.test(ch[0].evento), 'y se muestra sin la tarima: ' + ch[0].evento);
}

console.log('\nEl que no corrió nada no ve ningún aviso');
{
  state.form = { evento: 'sur_austral', rut: '11111111-1' };
  ok(bloqueoDetectado().length === 0, 'sin historial, sin aviso');
  state.form = { evento: 'sur_austral', rut: '' };
  ok(bloqueoDetectado().length === 0, 'y sin RUT escrito, tampoco');
  state.form = { evento: 'sur_austral', rut: '9.999.999-9' };
  ok(bloqueoDetectado().length === 0, 'ni un RUT que no está en la base');
}

console.log('\nSi el campeonato no configuró bloqueos, no molesta a nadie');
{
  EVENTS = [{ id: 'libre', name: 'Campeonato Libre', bloqueaClaves: [] }];
  state.form = { evento: 'libre', rut: '19839518-9' };
  ok(bloqueoDetectado().length === 0, 'el que corrió tres campeonatos pasa sin aviso');
  EVENTS = [{ id: 'libre2', name: 'Sin el campo' }];
  state.form = { evento: 'libre2', rut: '19839518-9' };
  ok(bloqueoDetectado().length === 0, 'y un campeonato viejo, sin el campo, tampoco rompe');
}

console.log('\nEl aviso NO frena la inscripción');
{
  // Es la decisión de fondo: los datos pueden estar incompletos, un RUT puede
  // venir mal tipeado y el compendio tiene excepciones (salvoconductos,
  // invitados, cambio de residencia) que resuelve la comisión.
  const html = sacar(src, '_bloqueoAvisoHtml');
  ok(/De igual forma podés continuar con la inscripción/.test(html),
     'se lo dice al atleta con todas las letras');
  ok(/queda a revisión y aprobación\s*\n?\s*por parte de la Comisión Técnica/.test(html),
     'y el texto dice "queda a revisión y aprobación", no que será rechazada');
  ok(!/no será aceptada por la Comisión/.test(html), 'no queda rastro de la redacción anterior');
  ok(!/disabled|return false|preventDefault|state\.view=/.test(html),
     'y el aviso no toca el flujo: no deshabilita ni corta nada');
  const enviar = src.indexOf('const publicEntry = {');
  const bloque = src.slice(enviar, src.indexOf('};', enviar));
  ok(/bloqueoAvisado: \(bloqueoDetectado\(\)\|\|\[\]\)/.test(bloque),
     'queda anotado en la inscripción que el atleta vio el aviso');
}

console.log('\n  Con la cita del compendio, para que no sea la palabra del sistema');
{
  ok(/Los atletas podrán competir solo una vez por temporada\/año competitivo en torneos regionales clasificatorios/.test(src),
     'va el texto del compendio');
  ok(/Normas Generales, "De los Atletas", punto F/.test(src),
     'y de dónde sale, para poder ir a verificarlo');
  const html = sacar(src, '_bloqueoAvisoHtml');
  ok(/COMPENDIO_CITA/.test(html) && /COMPENDIO_FUENTE/.test(html), 'las dos cosas se muestran');
}

console.log('\nNo puede romper la inscripción, pase lo que pase');
{
  // Es la condición de fondo: el sistema de inscripciones funciona y un aviso no
  // puede tumbarlo. Las dos funciones corren en cada dibujado y otra vez al
  // enviar; si tiraran una excepción, se caería el formulario entero.
  ok(/function bloqueoDetectado\(\)\{\s*try\{ return _bloqueoDetectado\(\); \}/.test(src),
     'la detección va envuelta en try');
  ok(/function bloqueoAvisoHtml\(\)\{\s*try\{ return _bloqueoAvisoHtml\(\); \}/.test(src),
     'y el dibujado también');
  ok(/catch\(e\)\{ console\.warn\('\[aviso\] no se pudo revisar[\s\S]{0,40}return \[\]; \}/.test(src),
     'si algo falla, devuelve vacío: no hay aviso y el formulario sigue igual');
  // Y se comprueba de verdad, rompiendo a propósito lo que usa.
  const guardado = EVENTS;
  EVENTS = null;                       // como si los eventos no hubieran cargado
  let reventó = false;
  try { bloqueoDetectado(); bloqueoAvisoHtml(); } catch (e) { reventó = true; }
  ok(!reventó, 'con los eventos rotos no revienta');
  EVENTS = guardado;
  state.form = null;                   // como si no hubiera formulario todavía
  reventó = false;
  try { bloqueoDetectado(); bloqueoAvisoHtml(); } catch (e) { reventó = true; }
  ok(!reventó, 'y sin formulario tampoco');
  state.form = { evento: 'sur_austral', rut: '19839518-9' };
}

console.log('\nMira las dos fuentes: data.json y lo cerrado hace poco');
{
  // El data.json que se sirve a los atletas no tenía a NADIE del Regional Centro
  // Sur ni del Norte —143 personas, cerrados esa misma semana—. Con una sola
  // fuente el aviso no le habría saltado a ninguno.
  EVENTS = [SUR_AUSTRAL];
  state.form = { evento: 'sur_austral', rut: '30.303.030-3' };
  ok(bloqueoDetectado().length === 0, 'alguien que no está en data.json no da aviso…');
  compResDB = [{ rut: '30303030-3', evento: 'Campeonato Regional Norte ' + ANIO, fecha: ANIO + '-08-17' }];
  const ch = bloqueoDetectado();
  ok(ch.length === 1, '…pero sí cuando aparece en los resultados recientes (' + ch.length + ')');
  ok(/Norte/.test(ch[0].evento), 'y es el Regional Norte, cerrado ayer: ' + ch[0].evento);
  compResDB = [];
  ok(/async function cargarCompRes\(\)/.test(src), 'se cargan aparte, con su propia caché');
  ok(/_ifsCache\('ins_compres', 10\*60\*1000\)/.test(src), 'cacheados 10 minutos, para no leer de más');
  ok(/rut:x\.rut\|\|'',evento:x\.evento\|\|'',fecha:x\.fecha\|\|''/.test(src),
     'y solo se trae RUT, campeonato y fecha: las marcas no tienen para qué venir a una página pública');
  ok(/const escribiendo=document\.activeElement/.test(src),
     'si llegan mientras el atleta escribe, no se le redibuja el campo encima');
}

console.log('\nUn campeonato de 2025 NO dispara el aviso de 2026');
{
  // Es el riesgo que se levantó: en data.json conviven el Regional Centro de 2025
  // (212 personas), el Centro Sur 2025, el Norte 2025 y el Sur Austral 2025 —el
  // mismo nombre del que abre ahora— junto a los de 2026. Si la clave no
  // distinguiera el año, a 212 personas les saltaría un aviso que no corresponde.
  //
  // Los nombres reales, tal como están en el archivo que se sirve hoy.
  const pares = [
    ['Regional Centro 2025',                          'Regional Centro 2026'],
    ['Regional Centro Sur 2025',                      'Campeonato Regional CENTRO SUR  FECHIPO 2026'],
    ['Regional Norte 2025',                           'Campeonato Regional Norte 2026'],
    ['Regional Sur Austral 2025',                     'Regional Sur Austral 2026'],
    ['Campeonato Nacional FECHIPO 2025',              'Campeonato Nacional FECHIPO 2026'],
  ];
  pares.forEach(([viejo, nuevo]) => {
    ok(_evClaveIns(viejo) !== _evClaveIns(nuevo),
       '"' + viejo + '" ≠ "' + nuevo + '"');
  });

  // Y se comprueba de punta a punta, no solo la clave.
  EVENTS = [SUR_AUSTRAL];
  athleteDB.push({ rut: '40404040-4', nombre: 'Del Año Pasado', competencias: [
    { evento: 'Regional Centro 2025', fecha: '2025-05-10' },
    { evento: 'Regional Norte 2025', fecha: '' },
    { evento: 'Regional Sur Austral 2025', fecha: '2025-09-01' },
  ] });
  state.form = { evento: 'sur_austral', rut: '40404040-4' };
  ok(bloqueoDetectado().length === 0,
     'el que corrió tres regionales en 2025 se inscribe sin aviso: su cupo de 2026 está libre');
  ok(bloqueoAvisoHtml() === '', 'y no se le dibuja nada');
}

console.log('\n  El que no trae año en el nombre queda señalado');
ok(/SIN AÑO<\/span>/.test(adm), 'el selector lo marca');
ok(/const sinAnio=!\/\\b20\\d\\d\\b\/\.test\(x\.nombre\)/.test(adm),
   'porque es el único que se puede confundir entre temporadas');

console.log('\nLa comisión ve lo mismo al revisar');
ok(/Se inscribió con el aviso a la vista/.test(adm), 'la inscripción sale marcada en Revisión inscripciones');
ok(/\(i\.bloqueoAvisado\|\|\[\]\)\.length/.test(adm), 'solo cuando corresponde');

console.log('\nQué bloquea a qué se elige por campeonato');
{
  ok(/const bloqueaClaves = Array\.from\(document\.querySelectorAll\('\.ef-bloq:checked'\)\)/.test(adm),
     'se guarda con la ficha del campeonato');
  ok(/QUIÉNES NO PUEDEN INSCRIBIRSE A ESTE CAMPEONATO/.test(adm), 'con su panel al crear o editar');
  ok(/bloqueaClaves,/.test(adm), 'y viaja en el documento del evento');
  // La clave se calcula igual en los dos lados, si no, nunca calzarían.
  const a = sacar(adm, '_evClave'), b = sacar(src, '_evClaveIns');
  const norm = s => s.replace(/_evClaveIns|_evClave/g, 'F').replace(/\s+/g, ' ').trim();
  ok(norm(a) === norm(b), 'y el admin y el formulario normalizan los nombres igual');
}

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

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
let EVENTS = [], athleteDB = [], state = { form: {} };
const formatRut = s => String(s || '');
const esc = s => String(s == null ? '' : s);
const COMPENDIO_CITA = 'cita', COMPENDIO_FUENTE = 'fuente';
eval(['_evClaveIns', 'findAthleteByRut', 'bloqueoDetectado'].map(n => sacar(src, n)).join('\n'));

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
  const html = sacar(src, 'bloqueoAvisoHtml');
  ok(/De igual forma podés continuar con la inscripción/.test(html),
     'se lo dice al atleta con todas las letras');
  ok(!/disabled|return false|preventDefault|state\.view=/.test(html),
     'y el aviso no toca el flujo: no deshabilita ni corta nada');
  const enviar = src.indexOf('const publicEntry = {');
  const bloque = src.slice(enviar, src.indexOf('};', enviar));
  ok(/bloqueoAvisado: bloqueoDetectado\(\)/.test(bloque),
     'queda anotado en la inscripción que el atleta vio el aviso');
}

console.log('\n  Con la cita del compendio, para que no sea la palabra del sistema');
{
  ok(/Los atletas podrán competir solo una vez por temporada\/año competitivo en torneos regionales clasificatorios/.test(src),
     'va el texto del compendio');
  ok(/Normas Generales, "De los Atletas", punto F/.test(src),
     'y de dónde sale, para poder ir a verificarlo');
  const html = sacar(src, 'bloqueoAvisoHtml');
  ok(/COMPENDIO_CITA/.test(html) && /COMPENDIO_FUENTE/.test(html), 'las dos cosas se muestran');
}

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

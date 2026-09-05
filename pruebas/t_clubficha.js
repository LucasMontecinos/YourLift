// El club viaja de la inscripción a la ficha del atleta.
//
// El club de alguien cambia: se va a otro y se inscribe con el nuevo. Ese dato
// se quedaba SOLO en la inscripción y su ficha seguía diciendo el club viejo.
// Peor: el formulario de inscripción PROPONE el club que dice la ficha, así que
// en la inscripción siguiente volvía a salir el antiguo y había que corregirlo
// otra vez. Lo mismo si el club se corregía a mano en la nómina.
//
// Ahora, aceptar una inscripción —o corregir el club en la nómina, o aprobarle
// al atleta su solicitud de cambio— actualiza también la ficha, que es lo que ve
// la gente en yourlift.cl y lo que propone la próxima inscripción.
//
// Lo delicado es a QUIÉN se le escribe. El cruce es por RUT y nunca por nombre,
// por lo mismo que ya costó caro con la base de entrenadores: escribirle el club
// a la persona equivocada es peor que no actualizar nada. Y si el RUT no está en
// el padrón —un extranjero, alguien que debuta y todavía no tiene código— no se
// toca nada.
//
// admin.html es un módulo y no expone sus funciones internas, así que se
// comprueba leyendo el código y ejercitando las reglas de decisión, que es donde
// están los errores posibles.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_clubficha.js
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
const ins = fs.readFileSync(__dirname + '/../inscripcion.html', 'utf8');

// Las mismas reglas que usa el panel, para poder ejercitarlas acá.
const clubDeInscripcion = i => {
  const c = String((i && i.club) || '').trim();
  return /^otro$/i.test(c) ? String((i && i.clubOtro) || '').trim() : c;
};
const nrmRut = r => String(r || '').replace(/[^0-9kK]/gi, '').toUpperCase();
const clubIgual = (a, b) => {
  const n = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  return n(a) === n(b);
};
// Reproduce la decisión: ¿a qué atleta del padrón, y con qué club?
function decidir(padron, inscripcion) {
  const nuevo = clubDeInscripcion(inscripcion);
  if (!nuevo) return null;
  const rut = nrmRut(inscripcion.rut);
  if (!rut) return null;
  const a = padron.find(x => nrmRut(x.rut) === rut);
  if (!a) return null;
  if (clubIgual(a.club, nuevo)) return null;
  return { codigo: a.codigo, antes: a.club, ahora: nuevo };
}

console.log('\nEl club nuevo llega a la ficha');
{
  const padron = [{ codigo: 'A1', rut: '11111111-1', nombre: 'Uno', club: 'Club Viejo' }];
  const r = decidir(padron, { rut: '11.111.111-1', club: 'Club Nuevo' });
  ok(!!r && r.ahora === 'Club Nuevo', 'se inscribió con otro club → la ficha lo toma');
  ok(r && r.antes === 'Club Viejo', 'y queda registrado cuál era antes, para poder deshacer');
}

console.log('\n  El RUT se compara normalizado, venga como venga');
{
  const padron = [{ codigo: 'A1', rut: '11111111-1', club: 'Viejo' }];
  const formas = ['11.111.111-1', '11111111-1', '11.111.111-K'.replace('K', '1'), '111111111'];
  const enc = formas.filter(f => decidir(padron, { rut: f, club: 'Nuevo' }));
  ok(enc.length === formas.length, formas.length + ' formas de escribir el mismo RUT, todas calzan');
  const conK = decidir([{ codigo: 'B', rut: '16.179.810-K', club: 'X' }],
    { rut: '16179810k', club: 'Y' });
  ok(!!conK, 'y la K del dígito verificador no distingue mayúscula de minúscula');
}

console.log('\n  Si no hay a quién escribirle, no se escribe');
{
  const padron = [{ codigo: 'A1', rut: '11111111-1', club: 'Viejo' }];
  ok(!decidir(padron, { rut: '22222222-2', club: 'Nuevo' }),
     'un RUT que no está en el padrón no toca nada (extranjeros, debutantes)');
  ok(!decidir(padron, { rut: '', club: 'Nuevo' }), 'una inscripción sin RUT tampoco');
  ok(!decidir(padron, { rut: '11111111-1', club: '' }), 'ni una sin club');
  ok(!decidir(padron, { rut: '11111111-1', club: 'Otro', clubOtro: '' }),
     'ni un "Otro" que quedó en blanco');
}

console.log('\n  "Otro" no es un club: el club es lo que la persona escribió');
{
  const padron = [{ codigo: 'A1', rut: '11111111-1', club: 'Viejo' }];
  const r = decidir(padron, { rut: '11111111-1', club: 'Otro', clubOtro: 'Fuerza Ñuñoa' });
  ok(r && r.ahora === 'Fuerza Ñuñoa', 'toma el que escribió, no la palabra "Otro" — ' + (r || {}).ahora);
  ok(/_clubDeInscripcion/.test(adm) && /\^otro\$/i.test(adm), 'y eso está resuelto en el panel, no acá');
}

console.log('\n  No se toca la ficha si el club es el mismo escrito distinto');
{
  const padron = [{ codigo: 'A1', rut: '11111111-1', club: 'Club Deportivo Ñuñoa' }];
  const iguales = ['Club Deportivo Ñuñoa', 'club deportivo nunoa', 'CLUB DEPORTIVO ÑUÑOA',
                   'Club  Deportivo  Ñuñoa'];
  const tocados = iguales.filter(c => decidir(padron, { rut: '11111111-1', club: c }));
  ok(tocados.length === 0,
     'las tildes, las mayúsculas y los espacios de más no cuentan como un cambio'
     + (tocados.length ? ' — se colaron: ' + tocados.join(' | ') : ''));
  ok(!!decidir(padron, { rut: '11111111-1', club: 'Club Deportivo Ñuñoa 2' }),
     'pero un club de verdad distinto sí');
}

console.log('\n  Está enganchado donde el club cambia');
{
  // Aceptar una inscripción es aceptar con qué club compite.
  const st = adm.slice(adm.indexOf('window.setStatus='), adm.indexOf('window.deleteInsc='));
  ok(/_clubAlPadron\(ins\)/.test(st) && /status==='approved'/.test(st),
     'al aceptar una inscripción');
  ok(/_clubAlPadronRevertir\(sync\)/.test(st), 'y el "deshacer" del aviso devuelve las dos cosas');

  const ei = adm.slice(adm.indexOf('window.editInsc='), adm.indexOf('window.editInsc=') + 1400);
  ok(/field==='club'\|\|field==='clubOtro'/.test(ei), 'al corregir el club en la nómina');
  ok(/_clubAlPadronRevertir\(sync\)/.test(ei), 'con su deshacer también');

  const er = adm.slice(adm.indexOf('window.approveEditRequest='),
                       adm.indexOf('window.rejectEditRequest='));
  ok(/_clubAlPadron\(/.test(er), 'y al aprobarle al atleta su solicitud de cambio');
}

console.log('\n  Queda escrito quién lo cambió y desde dónde');
{
  ok(/logAction\('club_desde_inscripcion'/.test(adm),
     'el cambio queda en el registro de auditoría, no pasa en silencio');
  ok(/y su ficha también|club de su ficha/.test(adm),
     'y el aviso en pantalla dice que se tocó la ficha, no solo la inscripción');
}

console.log('\n  La próxima inscripción propone el club nuevo');
{
  // Esta parte ya existía: el formulario lee el overlay de athlete_edits, que es
  // justamente lo que se acaba de escribir. Se comprueba que siga así, porque si
  // se cayera, el círculo se rompe y el club viejo volvería a aparecer.
  ok(/_INS_EDITS_RUT/.test(ins), 'el formulario mira las correcciones guardadas');
  ok(/if \(ed && ed\.club\) f\.club = ed\.club/.test(ins), 'y el club sale de ahí, no del archivo');
  ok(/athlete_edits/.test(adm), 'que es donde el panel las escribe');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

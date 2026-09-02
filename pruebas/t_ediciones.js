// Las correcciones del panel llegan solas a todo el sitio.
//
// Cuando en Admin → Atletas se le corrige el nombre a alguien, se le arregla el
// código o se borra una ficha repetida, eso NO se escribe en data.json: se
// escribe en la colección `athlete_edits` de Firestore y cada página la pega
// encima al cargar. No hace falta exportar el archivo ni volver a publicar el
// sitio.
//
// Se descubrió porque a Tomás Garay le faltaba el segundo nombre. Se corrigió en
// el panel, se exportó data.json, se subió, y la ficha seguía diciendo el nombre
// viejo. La corrección estaba guardada desde el primer momento; lo que fallaba
// era la entrega, por tres motivos distintos:
//
//   · Solo la ficha del atleta hacía caso a las BAJAS. Las otras cuatro páginas
//     ignoraban `deleted`, así que una ficha repetida se borraba desde el panel y
//     seguía apareciendo en el buscador, en el ranking, en inscripciones y en el
//     propio panel al recargar. Se creía haber limpiado duplicados que seguían.
//   · Cada página guardaba su copia con su propio vencimiento: 20 minutos el
//     inicio y la ficha, dos horas el ranking. Una corrección tardaba entre
//     veinte minutos y dos horas en verse, distinto en cada página.
//   · Las bajas se guardaban con un identificador de documento y las ediciones
//     con otro, así que la misma persona podía tener dos documentos que se
//     contradecían y no había regla de cuál mandaba.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_ediciones.js
const fs = require('fs');
const R = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// El módulo, corriendo de verdad. Se le da un localStorage y un fetch de mentira.
const almacen = {};
global.localStorage = {
  getItem: k => (k in almacen ? almacen[k] : null),
  setItem: (k, v) => { almacen[k] = String(v); },
  removeItem: k => { delete almacen[k]; },
};
let versionServida = '100', bajadas = 0, fallaVersion = false;
global.fetch = () => fallaVersion
  ? Promise.reject(new Error('sin red'))
  : Promise.resolve({ ok: true, json: () => Promise.resolve({ fields: { ts: { integerValue: versionServida } } }) });
const win = {};
// eslint-disable-next-line no-eval
eval(R('yl-ediciones.js').replace('})(window);', '})(win);'));
const YL = win.YLEdiciones;

const base = () => ([
  { codigo: '1637TGA-2024', rut: '16377732-0', nombre: 'Tomas Garay Avila', club: 'Potencia Muscular' },
  { codigo: '2215FNP-2024', rut: '11111111-1', nombre: 'Francisca Nuñez Pastore', club: 'A' },
  { codigo: '2127FNS-2025', rut: '22222222-2', nombre: 'Francisca Núñez Salinas', club: 'B' },
  { codigo: '9999XXX-2020', rut: '', nombre: 'Sin RUT', club: 'C' },
]);

(async () => {

console.log('\nUna corrección de nombre llega al sitio');
{
  const DB = base();
  const r = YL.aplicar(DB, [
    { id: 'rut_163777320', rut: '16377732-0', codigo: '1637TGA-2024',
      nombre: 'Tomás Andrés Garay Ávila', club: 'Potencia Muscular', ts: 200 },
  ]);
  ok(DB[0].nombre === 'Tomás Andrés Garay Ávila', 'el nombre queda corregido: ' + DB[0].nombre);
  ok(r.editados === 1 && r.borrados === 0, 'y se cuenta como una edición');
  ok(DB.length === 4, 'sin perder a nadie');
}

console.log('\n  Una baja saca al atleta, en todas partes');
{
  // Era el agujero: solo la ficha del atleta miraba `deleted`. El buscador, el
  // ranking, inscripciones y el propio panel seguían mostrando al borrado.
  const DB = base();
  const r = YL.aplicar(DB, [{ id: '2215FNP-2024', codigo: '2215FNP-2024', deleted: true, nombre: 'Francisca Nuñez Pastore', ts: 300 }]);
  ok(DB.length === 3, 'queda fuera del padrón (' + DB.length + ' de 4)');
  ok(!DB.some(a => a.codigo === '2215FNP-2024'), 'y no es que quede escondido: no está');
  ok(r.borrados === 1, 'y se cuenta como baja');
}

console.log('\n  Con varias bajas juntas, no se lleva a la persona equivocada');
{
  // Se borran de atrás para adelante justamente por esto: sacando por índice de
  // adelante hacia atrás, cada splice corre a los que vienen después.
  const DB = base();
  YL.aplicar(DB, [
    { id: 'a', codigo: '2215FNP-2024', deleted: true, ts: 1 },
    { id: 'b', codigo: '9999XXX-2020', deleted: true, ts: 1 },
  ]);
  ok(DB.length === 2, 'quedan dos');
  ok(DB.map(a => a.codigo).join(',') === '1637TGA-2024,2127FNS-2025',
     'y son los que corresponden: ' + DB.map(a => a.codigo).join(', '));
}

console.log('\nDos documentos de la misma persona: manda el más nuevo');
{
  // Las bajas viejas se guardaron con el código como identificador y las
  // ediciones con el RUT, así que la misma persona tiene dos documentos. Sin una
  // regla clara ganaba el que Firestore devolviera último, que es cualquiera.
  const borradoDespues = base();
  YL.aplicar(borradoDespues, [
    { id: 'rut_163777320', rut: '16377732-0', nombre: 'Tomás Andrés Garay Ávila', ts: 100 },
    { id: '1637TGA-2024', codigo: '1637TGA-2024', deleted: true, ts: 200 },
  ]);
  ok(!borradoDespues.some(a => a.codigo === '1637TGA-2024'),
     'editado y después borrado → se va');

  const editadoDespues = base();
  YL.aplicar(editadoDespues, [
    { id: '1637TGA-2024', codigo: '1637TGA-2024', deleted: true, ts: 100 },
    { id: 'rut_163777320', rut: '16377732-0', nombre: 'Tomás Andrés Garay Ávila', ts: 200 },
  ]);
  const t = editadoDespues.find(a => a.codigo === '1637TGA-2024');
  ok(!!t, 'borrado y después editado → vuelve');
  ok(t && t.nombre === 'Tomás Andrés Garay Ávila', 'con el nombre corregido');
  // Es exactamente lo que hace el botón de deshacer del panel.
  ok(editadoDespues.length === 4, 'y el padrón queda completo');

  // Y el orden en que Firestore los devuelva no puede cambiar el resultado.
  const alReves = base();
  YL.aplicar(alReves, [
    { id: 'rut_163777320', rut: '16377732-0', nombre: 'Tomás Andrés Garay Ávila', ts: 200 },
    { id: '1637TGA-2024', codigo: '1637TGA-2024', deleted: true, ts: 100 },
  ]);
  ok(alReves.length === 4 && alReves.find(a => a.codigo === '1637TGA-2024'),
     'y da lo mismo en qué orden lleguen los documentos');
}

console.log('\n  El marcador de versión no es un atleta');
{
  const DB = base();
  const r = YL.aplicar(DB, [{ id: '__version', ts: 999 }]);
  ok(DB.length === 4 && r.editados === 0 && r.borrados === 0, 'se ignora, no toca nada');
}

console.log('\n  Un vacío no pisa un dato bueno');
{
  // El panel guarda una foto completa del atleta, y los campos que no se llenaron
  // van vacíos. Si un vacío pisara, corregir el club borraría la fecha de
  // nacimiento de alguien.
  const DB = base();
  YL.aplicar(DB, [{ id: 'x', rut: '16377732-0', nombre: '', sexo: '', fechaNac: '', ts: 1 }]);
  ok(DB[0].nombre === 'Tomas Garay Avila', 'el nombre no se borra con un vacío');
  ok(DB[0].sexo === undefined, 'ni se inventan campos vacíos');
}

console.log('\nLa copia se invalida por versión, no por reloj');
{
  const bajar = () => { bajadas++; return Promise.resolve([{ id: 'a', rut: '16377732-0', nombre: 'N' + bajadas, ts: 1 }]); };

  bajadas = 0; almacen['_yl_edits'] = undefined; delete almacen['_yl_edits'];
  const uno = await YL.cargar(bajar);
  ok(bajadas === 1 && uno.length === 1, 'la primera vez se baja la colección');

  const dos = await YL.cargar(bajar);
  ok(bajadas === 1, 'la segunda no: la versión no cambió');
  ok(dos[0].nombre === 'N1', 'y devuelve lo mismo que la primera');

  // El panel guarda algo → sube la versión → la página se entera enseguida.
  versionServida = '101';
  const tres = await YL.cargar(bajar);
  ok(bajadas === 2, 'cambia la versión y se vuelve a bajar, sin esperar ningún vencimiento');
  ok(tres[0].nombre === 'N2', 'con lo nuevo');
}

console.log('\n  Sin red, la copia vieja es mejor que nada');
{
  // Si se cayera la conexión y se devolviera una lista vacía, reaparecerían las
  // fichas dadas de baja y los nombres viejos. Peor que no actualizar.
  fallaVersion = true;
  const antes = bajadas;
  const eds = await YL.cargar(() => Promise.reject(new Error('sin red')));
  ok(eds.length === 1 && eds[0].nombre === 'N2', 'se sigue usando la copia guardada');
  ok(bajadas === antes, 'y no se intentó bajar de nuevo dentro del plazo');
  fallaVersion = false;
}

console.log('\nLa foto se encuentra por RUT, no por código');
{
  // El CÓDIGO CAMBIA. Se calcula con el RUT, las iniciales y el año de debut, así
  // que corregir cualquiera de esas tres cosas lo cambia — y todo lo que colgaba
  // del código viejo queda huérfano. Así se perdieron cuatro fotos de perfil.
  // Los documentos de foto guardan el RUT adentro, así que buscando por ahí se
  // encuentran solas, sin migrar nada.
  const DB = base();

  // Bastián Arévalo: el código se armó con el RUT con puntos y quedó "20.5BAP-2023"
  // en vez de "2056BAP-2023". La foto quedó ahí.
  DB.push({ codigo: '2056BAP-2023', rut: '20.562.405-8', nombre: 'Bastian Arevalo Peña' });
  const foto1 = { id: '20.5BAP-2023', codigo: '20.5BAP-2023', rut: '20.562.405-8',
                  foto_url: 'https://ejemplo.cl/bastian.jpg' };
  const a1 = YL.buscarAtleta(DB, foto1);
  ok(!!a1 && a1.codigo === '2056BAP-2023',
     'la foto guardada en "20.5BAP-2023" llega a ' + (a1 ? a1.nombre : 'nadie'));

  // Camila Álvarez: la inicial llevaba tilde, "2095CÁC-2024" en vez de "2095CAC-2024".
  DB.push({ codigo: '2095CAC-2024', rut: '20953951-9', nombre: 'Camila Fernanda Alvarez Carrasco' });
  const a2 = YL.buscarAtleta(DB, { id: '2095CÁC-2024', codigo: '2095CÁC-2024', rut: '20953951-9' });
  ok(!!a2 && a2.codigo === '2095CAC-2024', 'y la del código con tilde también llega');

  // El RUT manda sobre el código: si los dos apuntan a personas distintas, gana
  // el RUT, porque el código es el que se mueve.
  const a3 = YL.buscarAtleta(DB, { codigo: '2215FNP-2024', rut: '20953951-9' });
  ok(a3 && a3.codigo === '2095CAC-2024', 'con RUT y código en desacuerdo, manda el RUT');

  // Sin RUT se cae al código, que es lo que tienen los documentos viejos.
  const a4 = YL.buscarAtleta(DB, { codigo: '2215FNP-2024' });
  ok(a4 && a4.codigo === '2215FNP-2024', 'y sin RUT, el código sigue sirviendo');
  ok(YL.buscarAtleta(DB, { codigo: 'NO_EXISTE-2020' }) === null, 'lo que no está, no está');
  ok(YL.buscarAtleta([], { rut: '1-9' }) === null, 'y sin padrón no revienta');
}

console.log('\n  El código que se genera no lleva tildes');
{
  // "2095CÁC-2024" no calza con el que se vuelve a generar más tarde, no se puede
  // escribir a mano y rompe el formato que el resto del panel valida.
  const adm = R('admin.html');
  const gen = adm.slice(adm.indexOf('function generarCodigo(a)'),
                        adm.indexOf('function generarCodigo(a)') + 1400);
  ok(/normalize\('NFD'\)/.test(gen), 'se le sacan las tildes a la inicial');
  ok(!/\(partes\[0\]\|\|''\)\[0\]\?\.toUpperCase\(\)/.test(gen),
     'ya no se toma la primera letra tal cual');
}

console.log('\n  Y las páginas buscan la foto así');
{
  ['atleta.html', 'livecast.html', 'admin.html'].forEach(p =>
    ok(/YLEdiciones\.buscarAtleta\(/.test(R(p)), p + ' busca por RUT antes que por código'));
}

console.log('\nTodas las páginas usan el mismo módulo');
{
  const paginas = ['index.html', 'atleta.html', 'ranking.html', 'inscripcion.html', 'livecast.html', 'admin.html'];
  paginas.forEach(p => ok(/<script src="yl-ediciones\.js"><\/script>/.test(R(p)), p + ' lo carga'));
  paginas.forEach(p => ok(/YLEdiciones\.cargar\(/.test(R(p)), p + ' lo usa para traer las ediciones'));

  // Ninguna puede haberse quedado con su caché propia por tiempo: era lo que
  // hacía que una corrección tardara de veinte minutos a dos horas.
  ok(!/_rkEd/.test(R('ranking.html')), 'el ranking ya no tiene su caché de dos horas');
  ok(!/_fsCache\('edits'/.test(R('index.html')), 'el inicio ya no tiene la suya de veinte minutos');
  ok(!/_aC\('edits'/.test(R('atleta.html')), 'la ficha del atleta tampoco');
  ok(!/_ifsCache\('ins_edits'/.test(R('inscripcion.html')), 'inscripción tampoco');
}

console.log('\n  El panel avisa cada vez que guarda');
{
  const adm = R('admin.html');
  ok(/async function _marcarEdicion\(\)/.test(adm), 'hay una función que marca la versión');
  ok(/setDoc\(doc\(db,'athlete_edits','__version'\),\{ts:Date\.now\(\)\}\)/.test(adm),
     'y escribe la hora en el documento que miran las páginas');
  const guarda = adm.slice(adm.indexOf('async function _saveEdit'), adm.indexOf('window.editAthlete'));
  ok(/_marcarEdicion\(\)/.test(guarda), 'guardar una edición la marca');
  const borra = adm.slice(adm.indexOf('window.deleteAthlete'), adm.indexOf('window.deleteAthlete') + 1800);
  ok(/_marcarEdicion\(\)/.test(borra), 'y dar de baja también');
  // La baja tiene que ir al MISMO documento que la edición.
  ok(/const docId=_editDocId\(a\);[\s\S]{0,200}deleted:true/.test(borra),
     'la baja usa el mismo identificador de documento que las ediciones');
  ok(!/Para hacerlo permanente, exporta data\.json/.test(adm),
     'y ya no dice que haya que exportar data.json: es mentira, se guarda solo');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
})();

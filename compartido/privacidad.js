// Qué datos de un atleta son públicos y cuáles no.
//
// El padrón público (data.json, y su copia en Storage) lo puede bajar cualquiera
// desde el sitio. Por eso NO lleva el RUT ni la fecha de nacimiento completa: solo
// el año, que alcanza para la división por edad. El RUT y la fecha completa viven
// en Firestore, en privado/padron (solo lo lee un admin), y el formulario de
// inscripción los consulta RUT por RUT en rut_indice/{rut}, que se puede leer de
// a uno —quien ya sabe su RUT— pero no listar.
//
// Todo lo que el panel publique o exporte pasa por publico(). La prueba
// t_datospublicos.js revisa que los archivos del sitio no traigan RUT ni fechas.
//
// Va sin ?. ni ?? : también la carga el livecast.
(function () {
  // Campos que nunca van al padrón público.
  var PRIVADOS = ['rut', 'fechaNac', 'fechanac', 'fechanacimiento', 'dob', 'email', 'correo',
    'correos', 'telefono', 'fono', 'celular', 'direccion', 'comuna'];

  // "12.345.678-k" → "12345678K": la forma con que se guarda y se busca.
  function norm(rut) { return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase(); }

  // El año de una fecha escrita de cualquier forma ("20/03/1995", "1995-03-20").
  function anio(fecha) {
    var m = String(fecha || '').match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
  }

  // Un enlace a un archivo que no se publica: la carpeta privada de documentos
  // (athlete_files) o una foto vieja guardada con el RUT en el nombre del archivo.
  var RUTA_PRIVADA = /athlete_files(%2F|\/)|athlete_(photos|gifs)(%2F|\/)\d{7,8}[\dkK]_/i;

  // El atleta tal como se publica: sin RUT ni fecha completa, con el año.
  function publico(a) {
    var o = {};
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k) && PRIVADOS.indexOf(k) < 0
      && !(typeof a[k] === 'string' && RUTA_PRIVADA.test(a[k]))) o[k] = a[k];
    if (!o.anioNac) {
      var y = anio(a.fechaNac || a.fechanac || a.fechanacimiento);
      if (y) o.anioNac = y;
    }
    return o;
  }

  // Lo que se guarda aparte, en privado/padron, por código de atleta.
  function privado(a) {
    return { rut: String(a.rut || '').trim(), fechaNac: String(a.fechaNac || a.fechanac || '').trim() };
  }

  // ── Inscripciones ──
  // Las inscripciones se leen sin sesión (nóminas, livecast, perfil del atleta),
  // así que el documento público (inscripciones/) identifica al atleta solo por
  // su código. Lo demás va en inscripciones_private/, que solo lee un admin:
  // RUT, fecha de nacimiento completa, comuna, el nombre de los archivos que
  // subió (puede traer su nombre o su RUT), y lo de siempre (PIN, correo).
  var INSC_PRIVADOS = ['rut', 'fechaNac', 'fechanac', 'fechanacimiento', 'dob', 'comuna',
    'declaraMayorFecha', 'carnetName', 'wadeName', 'correo', 'email', 'telefono', 'fono', 'celular', 'pin'];

  // {pub, priv}: lo que va a cada documento. El público lleva el año de
  // nacimiento, que alcanza para la división por edad.
  function separarInscripcion(o) {
    var pub = {}, priv = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) {
      if (INSC_PRIVADOS.indexOf(k) >= 0) { if (o[k] !== undefined) priv[k] = o[k]; }
      else pub[k] = o[k];
    }
    if (!pub.anioNac) { var y = anio(o.fechaNac || o.fechanac || o.fechanacimiento || o.dob); if (y) pub.anioNac = y; }
    return { pub: pub, priv: priv };
  }

  // El id de una inscripción: campeonato + código de atleta. Antes era el RUT,
  // y los ids se ven al listar la colección.
  function idInscripcion(evento, codigo) {
    var c = String(codigo || '').replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    return c ? String(evento || '') + '_' + c : '';
  }

  // Un registro cualquiera sin los datos personales (para lo que se publica:
  // la nómina del livecast, los resultados). Copia, no toca el original.
  function sinPrivados(o) {
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && INSC_PRIVADOS.indexOf(k) < 0) r[k] = o[k];
    return r;
  }

  // Un archivo subido por el atleta queda guardado por su ubicación en Storage
  // ("storage:athlete_files/…"), no por un enlace: el enlace de descarga solo lo
  // puede pedir un admin (reglas/storage.rules). El panel lo resuelve al abrir.
  var PREFIJO_ARCHIVO = 'storage:';
  function esRutaArchivo(v) { return typeof v === 'string' && v.indexOf(PREFIJO_ARCHIVO) === 0; }
  function rutaArchivo(fullPath) { return PREFIJO_ARCHIVO + fullPath; }
  function rutaDe(v) { return esRutaArchivo(v) ? v.slice(PREFIJO_ARCHIVO.length) : ''; }

  // Las páginas guardan copias en el navegador (localStorage, claves "_yfc_…")
  // para no pedir lo mismo a cada rato. Las que se guardaron antes de sacar el
  // RUT de lo público lo traen, y una clave que ya no se usa no se vuelve a
  // escribir nunca: se borran todas una vez. Se vuelven a armar solas.
  try {
    if (localStorage.getItem('_yfc_v') !== '2') {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf('_yfc_') === 0) localStorage.removeItem(k);
      }
      localStorage.setItem('_yfc_v', '2');
    }
  } catch (e) {}

  window.YLPrivacidad = { CAMPOS: PRIVADOS, norm: norm, anio: anio, publico: publico, privado: privado,
    INSC_PRIVADOS: INSC_PRIVADOS, separarInscripcion: separarInscripcion, idInscripcion: idInscripcion,
    sinPrivados: sinPrivados, esRutaArchivo: esRutaArchivo, rutaArchivo: rutaArchivo, rutaDe: rutaDe };
})();

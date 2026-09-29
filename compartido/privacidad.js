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
  var PRIVADOS = ['rut', 'fechaNac', 'fechanac', 'fechanacimiento', 'email', 'correo',
    'telefono', 'fono', 'celular', 'direccion'];

  // "12.345.678-k" → "12345678K": la forma con que se guarda y se busca.
  function norm(rut) { return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase(); }

  // El año de una fecha escrita de cualquier forma ("20/03/1995", "1995-03-20").
  function anio(fecha) {
    var m = String(fecha || '').match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
  }

  // El atleta tal como se publica: sin RUT ni fecha completa, con el año.
  function publico(a) {
    var o = {};
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k) && PRIVADOS.indexOf(k) < 0) o[k] = a[k];
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

  window.YLPrivacidad = { CAMPOS: PRIVADOS, norm: norm, anio: anio, publico: publico, privado: privado };
})();

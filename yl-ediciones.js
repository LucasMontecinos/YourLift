/* ═══════════════════════════════════════════════════════════════════
   YourLift — Ediciones de atletas
   ═══════════════════════════════════════════════════════════════════

   Cuando en el panel se le corrige el nombre a alguien, se le arregla el
   código o se borra una ficha repetida, ese cambio NO se escribe en
   data.json: data.json es un archivo del repositorio y cambiarlo obliga a
   exportar, subir y volver a publicar el sitio. Lo que se escribe es un
   documento en la colección `athlete_edits` de Firestore, y cada página lo
   pega encima de data.json al cargar. El panel guarda; el sitio obedece.

   Este archivo es esa capa, en un solo lugar. Antes cada página la tenía
   escrita por su cuenta y las cinco copias no decían lo mismo:

     · Solo la ficha del atleta hacía caso a las BAJAS. Las otras cuatro
       ignoraban el campo `deleted`, así que una ficha repetida se borraba
       desde el panel y seguía apareciendo en el buscador, en el ranking, en
       inscripciones y en el propio panel al recargar.
     · Cada una guardaba su propia copia en localStorage, con su propia
       llave y su propio vencimiento: 20 minutos el inicio y la ficha, dos
       horas el ranking. Una corrección tardaba entre veinte minutos y dos
       horas en verse, y en cada página a una hora distinta.
     · Las bajas se guardaban con un identificador de documento (el código) y
       las ediciones con otro (el RUT), así que la misma persona podía tener
       dos documentos que se contradecían y nadie definía cuál mandaba.

   Cómo se resuelve acá:

     · Una sola copia compartida en localStorage, la misma para todas las
       páginas: la primera que carga le ahorra la descarga a las demás.
     · La copia se invalida por VERSIÓN, no por reloj. El panel, cada vez que
       guarda, escribe la hora en `athlete_edits/__version`. Las páginas piden
       ese único documento —una petición chica, sin SDK— y solo se bajan la
       colección entera si cambió. Una corrección se ve en la carga siguiente,
       no en veinte minutos.
     · Los dos identificadores de documento conviven. Para cada persona se
       ordenan sus documentos por fecha y manda el último: si la baja es
       posterior a la edición, la ficha se va; si se editó después de borrarla,
       vuelve. Eso es lo que hace "deshacer" desde el panel.

   Uso desde una página:

     const docs = await YLEdiciones.cargar(bajarColeccion);
     YLEdiciones.aplicar(DB, docs);

   donde `bajarColeccion` es la forma que tenga esa página de leer Firestore
   (cada una arma Firebase distinto). El módulo se encarga del resto.
   ════════════════════════════════════════════════════════════════════ */
(function (window) {
  'use strict';

  var LLAVE = '_yl_edits';          // la copia, compartida por todas las páginas
  var MARCA = '__version';          // el documento que dice cuándo fue el último cambio
  var TTL = 20 * 60 * 1000;         // solo si no se pudo leer la versión
  var ESPERA = 2500;                // lo que se espera por la versión antes de seguir

  // El proyecto y la clave son los mismos que ya viajan en el HTML de cada
  // página: `athlete_edits` es de lectura pública, así que la versión se puede
  // pedir por HTTP pelado y este archivo no depende del SDK de Firebase.
  var URL_MARCA = 'https://firestore.googleapis.com/v1/projects/fechipo-db-13148' +
    '/databases/(default)/documents/athlete_edits/' + MARCA +
    '?key=AIzaSyC3xWxxxLpkkbz_h9HxOSeg7C25wfh9KQ8';

  function rutNorm(s) { return String(s || '').replace(/[^0-9kK]/gi, '').toUpperCase(); }

  function leerCopia() {
    try { return JSON.parse(localStorage.getItem(LLAVE)); } catch (e) { return null; }
  }
  function guardarCopia(v, d) {
    try { localStorage.setItem(LLAVE, JSON.stringify({ v: v, ts: Date.now(), d: d })); } catch (e) {}
  }

  // La hora del último cambio. Si no se puede leer —sin red, Firestore caído—
  // devuelve null y el que llama se las arregla con el vencimiento por reloj.
  function pedirVersion() {
    return new Promise(function (resolve) {
      var listo = false;
      var fin = function (v) { if (!listo) { listo = true; resolve(v); } };
      setTimeout(function () { fin(null); }, ESPERA);
      try {
        fetch(URL_MARCA, { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            var f = j && j.fields && j.fields.ts;
            fin(f ? String(f.integerValue || f.doubleValue || f.stringValue || '') : '0');
          })
          .catch(function () { fin(null); });
      } catch (e) { fin(null); }
    });
  }

  // Trae las ediciones. `bajar` es una función de la página que devuelve la
  // colección entera como arreglo de objetos (con `id`, si lo tiene a mano).
  function cargar(bajar) {
    var copia = leerCopia();
    return pedirVersion().then(function (v) {
      // Se pudo leer la versión y no cambió desde la última vez: se usa la copia.
      if (v !== null && copia && copia.v === v && copia.d) return copia.d;
      // No se pudo leer la versión: la copia sirve mientras esté fresca.
      if (v === null && copia && copia.d && (Date.now() - copia.ts) < TTL) return copia.d;
      return Promise.resolve()
        .then(bajar)
        .then(function (docs) {
          docs = docs || [];
          if (v !== null) guardarCopia(v, docs);
          return docs;
        })
        .catch(function (e) {
          // Si la bajada falla, mejor la copia vieja que ninguna: sin ediciones
          // reaparecen fichas borradas y nombres viejos.
          if (console && console.warn) console.warn('[ediciones] no se pudieron bajar:', e && e.message);
          return (copia && copia.d) || [];
        });
    });
  }

  // Pega las ediciones sobre el arreglo de atletas, EN EL MISMO ARREGLO.
  // Devuelve cuántos se editaron y cuántos se dieron de baja.
  function aplicar(DB, docs) {
    if (!DB || !DB.length || !docs || !docs.length) return { editados: 0, borrados: 0 };

    // Índices por RUT y por código, para no recorrer la base por cada edición:
    // con 1.000 atletas y 360 ediciones eran 360.000 comparaciones en cada carga.
    var porRut = {}, porCod = {};
    for (var i = 0; i < DB.length; i++) {
      var r = rutNorm(DB[i] && DB[i].rut);
      if (r && porRut[r] === undefined) porRut[r] = i;
      var c = DB[i] && DB[i].codigo;
      if (c && porCod[c] === undefined) porCod[c] = i;
    }

    // Cada documento, a la persona que le toca. El RUT manda porque no cambia
    // nunca; el código es el respaldo para las bajas viejas, que se guardaron
    // con el código como identificador.
    var porPersona = {};
    docs.forEach(function (ed) {
      if (!ed || ed.id === MARCA) return;
      var idx = -1;
      if (ed.rut) { var k = rutNorm(ed.rut); if (porRut[k] !== undefined) idx = porRut[k]; }
      if (idx < 0 && ed.codigo && porCod[ed.codigo] !== undefined) idx = porCod[ed.codigo];
      if (idx < 0) return;
      (porPersona[idx] = porPersona[idx] || []).push(ed);
    });

    var CAMPOS = ['nombre', 'club', 'debut', 'rut', 'codigo', 'sexo', 'fechaNac', 'zona', 'comuna'];
    var editados = 0, fuera = {};

    Object.keys(porPersona).forEach(function (k) {
      var idx = +k;
      // Del más viejo al más nuevo: manda el último. Así, si a alguien lo
      // borraron y después lo editaron, vuelve; y si lo editaron y después lo
      // borraron, se va. Es lo que hace el botón de deshacer del panel.
      var lote = porPersona[k].slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      var a = DB[idx], toco = false;
      lote.forEach(function (ed) {
        if (ed.deleted) { fuera[idx] = true; return; }
        delete fuera[idx];
        CAMPOS.forEach(function (c) {
          if (ed[c] === undefined || ed[c] === null) return;
          if (c !== 'club' && c !== 'debut' && ed[c] === '') return;   // vacío no pisa
          if (a[c] === ed[c]) return;
          a[c] = ed[c]; toco = true;
        });
      });
      if (toco) editados++;
    });

    var borrar = Object.keys(fuera).map(Number).sort(function (x, y) { return y - x; });
    borrar.forEach(function (i) { DB.splice(i, 1); });

    return { editados: editados, borrados: borrar.length };
  }

  window.YLEdiciones = {
    MARCA: MARCA,
    cargar: cargar,
    aplicar: aplicar,
    rutNorm: rutNorm,
    // Para el panel, que escribe: invalida la copia local al toque para no
    // quedarse mirando la anterior después de guardar.
    olvidarCopia: function () { try { localStorage.removeItem(LLAVE); } catch (e) {} }
  };
})(window);

/* ════════════════════════════════════════════════════════════════
   La división de edad, calculada por AÑO de nacimiento

   En powerlifting la edad se cuenta por año calendario, no por la fecha
   exacta: el atleta cambia de división el 1 de enero del año en que cumple
   los años, no el día de su cumpleaños.

     el año que cumple 19  → Junior
     el año que cumple 24  → Open
     el año que cumple 40  → Master I
     el año que cumple 50  → Master II
     el año que cumple 60  → Master III
     el año que cumple 70  → Master IV

   Ejemplo: alguien de 2003 es Junior durante todo 2026 y pasa a Open el 1 de
   enero de 2027, sin importar en qué mes cumpla años.

   Por eso el ranking no puede guardar la división escrita a mano: si la
   guarda, el 1 de enero queda desfasado y hay que corregirlo a mano evento
   por evento. Se calcula acá, contra el año en curso, y se actualiza solo.

   Universitario NO es una división de edad —es una categoría aparte— así que
   nunca se toca: eso lo decide quien llama, no esta función.
   ════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  // Los cortes, de mayor a menor. Se leen "desde los N años, esta división".
  var CORTES = [
    [70, 'Master IV'],
    [60, 'Master III'],
    [50, 'Master II'],
    [40, 'Master I'],
    [24, 'Open'],
    [19, 'Junior']
  ];

  // El año de nacimiento, venga como venga la fecha: yyyy-mm-dd (el campo del
  // formulario), dd/mm/yyyy (la base de atletas) o el año pelado.
  function ylAnioNac(fecha) {
    var s = String(fecha == null ? '' : fecha).trim();
    if (!s) return 0;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return parseInt(m[1], 10);
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return parseInt(m[3], 10);
    m = s.match(/\b(?:19|20)\d{2}\b/);
    return m ? parseInt(m[0], 10) : 0;
  }

  // La división que le corresponde a ese año de nacimiento en ese año de
  // competencia. Devuelve '' si no se puede saber, y quien llama se queda con
  // lo que ya tenía: es preferible mostrar el dato viejo que uno inventado.
  function ylDivisionPorAnio(anioNac, anioRef) {
    var nac = ylAnioNac(anioNac) || parseInt(anioNac, 10) || 0;
    var ref = parseInt(anioRef, 10) || new Date().getFullYear();
    if (!nac || nac > ref) return '';
    var edad = ref - nac;
    // En la base hay fechas de relleno —31/12/1900 y parecidas— de cuando no se
    // conocía la fecha real. Tomarlas en serio manda a esa persona a Master IV.
    // Nadie compite con más de 100 años: si sale eso, es que no se sabe.
    if (edad > 100) return '';
    for (var i = 0; i < CORTES.length; i++) {
      if (edad >= CORTES[i][0]) return CORTES[i][1];
    }
    // Por debajo de 19 queda Sub Junior. La IPF la abre a los 14; más abajo no
    // hay división en la que competir, así que no se inventa ninguna.
    return edad >= 14 ? 'Sub Junior' : '';
  }

  // Nombre normalizado, para cruzar contra la tabla de años de nacimiento:
  // sin tildes, sin mayúsculas y sin espacios de más.
  function ylClaveNombre(n) {
    return String(n == null ? '' : n)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // El año de nacimiento de un atleta, mirando primero lo que trae el propio
  // resultado y recién después la tabla. Los resultados publicados desde el
  // livecast guardan el año; los históricos no, y para esos está la tabla.
  function ylAnioDeAtleta(o) {
    if (!o) return 0;
    var directo = ylAnioNac(o.anioNac || o.an || o.born || o.fechaNac || 0);
    if (directo) return directo;
    var tabla = raiz.YL_NAC;
    if (!tabla) return 0;
    return tabla[ylClaveNombre(o.nombre || o.n || o.name || '')] || 0;
  }

  raiz.ylAnioNac = ylAnioNac;
  raiz.ylDivisionPorAnio = ylDivisionPorAnio;
  raiz.ylClaveNombre = ylClaveNombre;
  raiz.ylAnioDeAtleta = ylAnioDeAtleta;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ylAnioNac: ylAnioNac, ylDivisionPorAnio: ylDivisionPorAnio,
                       ylClaveNombre: ylClaveNombre, ylAnioDeAtleta: ylAnioDeAtleta };
  }
})(typeof window !== 'undefined' ? window : globalThis);

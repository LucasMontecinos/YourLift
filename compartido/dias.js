// El orden de los días de un campeonato, como se escriben en el Cronograma.
//
// "Sábado 8" va antes que "Domingo 9" aunque alfabéticamente sea al revés; "Día 1"
// antes que "Día 2"; lo que no tiene día, al final. Antes esta regla estaba
// copiada igual en el cronograma público, el inicio y el panel.
//
// Va sin ?. ni ?? : también la carga el livecast.
(function () {
  var SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  var CORTOS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
  // [grupo, número, texto]: grupo 0 = día de la semana, 1 = con número ("Día 1",
  // "8 de agosto"), 2 = texto suelto (alfabético), 3 = sin día.
  function clave(d) {
    var s = String(d || '').trim();
    if (!s) return [3, Infinity, ''];
    var n = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    var i = -1;
    for (var k = 0; k < SEMANA.length; k++) if (n.indexOf(SEMANA[k]) >= 0) { i = k; break; }
    // Abreviaturas, con borde de palabra para no confundir "mar" con "marzo".
    if (i < 0) { var m = n.match(/\b(lun|mar|mie|jue|vie|sab|dom)\b/); if (m) i = CORTOS.indexOf(m[1]); }
    if (i >= 0) return [0, i, n];
    var num = n.match(/\d+/);
    if (num) return [1, parseInt(num[0], 10), n];
    return [2, 0, n];
  }
  function comparar(a, b) {
    var ka = clave(a), kb = clave(b);
    return (ka[0] - kb[0]) || (ka[1] - kb[1]) || ka[2].localeCompare(kb[2]);
  }
  window.YLDias = { SEMANA: SEMANA, clave: clave, comparar: comparar };
})();

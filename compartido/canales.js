// Canales de un campeonato en Firestore.
//
// Todo lo que se sincroniza en vivo —el estado de la competencia, la pantalla
// de tarima, Control TX, los récords, las luces de los jueces— vive en
// documentos cuyo id sale del NOMBRE del campeonato. Así dos campeonatos que se
// corren a la misma hora, en el mismo recinto o en otro, no se mezclan: cada
// uno escribe y escucha los suyos.
//
// El livecast y el panel de jueces tienen que calcular exactamente el mismo id,
// por eso la regla está acá y no copiada en cada página.
//
// Va sin ?. ni ?? : el livecast también corre en televisores con navegadores viejos.
(function () {
  // "“Primavera Open” Regional Centro Noviembre 2026" → "_Primavera_Open__Regional_Centro_Noviembre_2026"
  // Con dos tarimas, cada una tiene su canal: "…_T1", "…_T2".
  function deEvento(nombre, tarima) {
    var base = String(nombre || 'comp').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 55);
    return tarima ? base + '_T' + tarima : base;
  }
  // Luces de los jueces y señal del cronómetro (judge_decisions, timer_control).
  // Hasta septiembre de 2026 el id era fijo ('current', o 'current_T1' con dos
  // tarimas): dos campeonatos a la vez compartían las luces, y el juez de uno
  // encendía la pantalla del otro. Sin campeonato se sigue usando ese id viejo.
  function jueces(canalEvento, tarima) {
    if (canalEvento) return 'current__' + canalEvento;
    return tarima ? 'current_T' + tarima : 'current';
  }
  // El canal que llega en un link (?canal=…) se acepta solo si tiene la forma de
  // uno de verdad: letras, números y guiones bajos.
  function valido(c) {
    return typeof c === 'string' && /^[A-Za-z0-9_]{1,70}$/.test(c);
  }
  window.YLCanal = { deEvento: deEvento, jueces: jueces, valido: valido };
})();

// La clave de un campeonato para reconocerlo aunque venga escrito distinto.
//
// "Campeonato Debutantes All Power CD 2026 - Tarima 1" y "Debutantes All Power
// 2026 Tarima 2" son el mismo: sin la tarima, sin tildes y sin las palabras de
// relleno (campeonato, fechipo, torneo, de, del, cd). La usan el formulario de
// inscripción y el panel para saber en qué campeonatos ya compitió un atleta;
// antes cada uno tenía su copia y llegaron a no coincidir.
(function () {
  function clave(ev) {
    return String(ev || '')
      .replace(/\s*[-–—:]?\s*tarima\s*\d+\s*$/i, '')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\b(campeonato|fechipo|torneo|de|del|cd)\b/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  window.YLCampeonato = { clave: clave };
})();

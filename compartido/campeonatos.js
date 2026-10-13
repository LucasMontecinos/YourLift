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
  // ¿Este campeonato puede poner récords nacionales? Solo los Nacionales,
  // Sudamericanos, Mundiales y Bolivarianos. Un zonal, un regional o un torneo
  // de debutantes no, aunque en otra parte del nombre diga "Nacional" (El
  // Deshielo es "Torneo Debutantes II y Nacional Olimpiadas Especiales").
  // Se lee del nombre, que es como se los llama siempre; se toleran los errores
  // de tipeo que ya aparecen en la base ("Sudamericaco", "Nacinal").
  function daRecord(nombre) {
    const n = String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/\b(zona|zonal|zonales|regional|regionales|interregional|debutantes?)\b/.test(n)) return false;
    return /\b(nacion|nacinal|sudameric|south americ|mundial|world|bolivarian)/.test(n);
  }
  // Lo mismo para un campeonato con su configuración: en Admin → Campeonatos se
  // puede forzar ('si' / 'no') para las excepciones que el nombre no resuelve.
  // recordsEnabled:false es el interruptor viejo, apagado a mano.
  function daRecordEvento(ev) {
    if (!ev) return false;
    if (ev.recordsNac === 'si') return true;
    if (ev.recordsNac === 'no' || ev.recordsEnabled === false) return false;
    return daRecord(ev.name || ev.nombre);
  }
  window.YLCampeonato = { clave: clave, daRecord: daRecord, daRecordEvento: daRecordEvento };
})();

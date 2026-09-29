// Puntos GL (IPF Good Lift Points 2020): una sola tabla para todo el sitio.
//
//   GL = 100 × total / (a − b × e^(−c × peso corporal))
//
// Antes cada página tenía su copia de los coeficientes —el inicio, el ranking,
// el livecast y el panel— y una llegó a estar corrida (lo clásico tenía los de
// equipado): daba entre 13 y 39 puntos de menos. Ahora están acá una vez.
//
// Cada página sigue redondeando como siempre: la calculadora del inicio con el
// procedimiento oficial de 6 decimales, el resto a 2 decimales (puntos()).
//
// Va sin ?. ni ?? : el livecast también corre en televisores viejos.
(function () {
  var COEF = {
    pl_m:  { a: 1199.72839, b: 1025.18162, c: 0.00921 },   // Powerlifting Classic
    pl_f:  { a: 610.32796,  b: 1045.59282, c: 0.03048 },
    ple_m: { a: 1236.25115, b: 1449.21864, c: 0.01644 },   // Powerlifting Equipado
    ple_f: { a: 758.63878,  b: 949.31382,  c: 0.02435 },
    bo_m:  { a: 320.98041,  b: 281.40258,  c: 0.01008 },   // Only Bench Classic
    bo_f:  { a: 142.40398,  b: 442.52671,  c: 0.04724 },
    boe_m: { a: 381.22073,  b: 733.79378,  c: 0.02398 },   // Only Bench Equipado
    boe_f: { a: 221.82209,  b: 357.00377,  c: 0.02937 }
  };
  // El divisor de la fórmula, o null si no hay coeficientes o no da positivo.
  function divisor(clave, bw) {
    var c = COEF[clave];
    if (!c || !(bw > 0)) return null;
    var d = c.a - c.b * Math.exp(-c.c * bw);
    return d > 0 ? d : null;
  }
  // Puntos redondeados a 2 decimales, o null si no se pueden calcular.
  function puntos(clave, bw, total) {
    var d = divisor(clave, bw);
    if (d === null || !(total > 0)) return null;
    return Math.round(total * 100 / d * 100) / 100;
  }
  window.YLGL = { COEF: COEF, divisor: divisor, puntos: puntos };
})();

// RUT y fechas de nacimiento INVENTADOS para las pruebas.
//
// El padrón publicado (data.json) ya no trae RUT ni fecha completa, y las pruebas
// no deben usar los de personas reales: el repositorio y la carpeta pruebas/ se
// publican. Acá cada atleta recibe un RUT falso, estable (sale de su código) y con
// dígito verificador válido, en el rango 30.000.000–38.999.999, que no se ha
// asignado a nadie. Con esto se arma el padrón privado (privado/padron) que en
// producción lee el panel.
function dv(cuerpo) {
  let s = 0, m = 2;
  String(cuerpo).split('').reverse().forEach(c => { s += (+c) * m; m = m === 7 ? 2 : m + 1; });
  const r = 11 - (s % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}
function rutFalso(codigo) {
  let h = 0;
  for (const ch of String(codigo)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 30000000 + (h % 9000000);
  return n + '-' + dv(n);
}
const fechaFalsa = a => '15/06/' + (a.anioNac || '1995');
// El padrón como lo ve el panel después de leer privado/padron.
const completo = data => data.map(a => Object.assign({}, a, { rut: rutFalso(a.codigo), fechaNac: fechaFalsa(a) }));
// El documento privado/padron para el Firestore falso.
function padronPrivado(data) {
  const atletas = {};
  data.forEach(a => { if (a.codigo) atletas[a.codigo] = { rut: rutFalso(a.codigo), fechaNac: fechaFalsa(a) }; });
  return { id: 'padron', atletas, n: Object.keys(atletas).length };
}
module.exports = { dv, rutFalso, fechaFalsa, completo, padronPrivado };

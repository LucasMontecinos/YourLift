// Arma los diccionarios de la interfaz (compartido/idioma/en.js y pt.js) a
// partir de herramientas/traducciones.tsv: una fila por texto, con el español
// tal como aparece en pantalla y su traducción al inglés y al portugués.
//   node herramientas/armar_idioma.js
// Para traducir un texto nuevo, se agrega la fila al TSV y se vuelve a correr.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const filas = fs.readFileSync(path.join(__dirname, 'traducciones.tsv'), 'utf8').split('\n').slice(1).filter(Boolean);
const norm = s => s.replace(/\s+/g, ' ').trim();
const dic = { en: {}, pt: {} };
let n = 0;
for (const f of filas) {
  const [es, en, pt] = f.split('\t');
  const k = norm(es || '');
  if (!k) continue;
  if (en && norm(en) && norm(en) !== k) dic.en[k] = norm(en);
  if (pt && norm(pt) && norm(pt) !== k) dic.pt[k] = norm(pt);
  n++;
}
// Cada texto también sin los signos de los bordes ("· EN TARIMA AHORA" →
// "EN TARIMA AHORA"), para cuando aparece suelto o dentro de otra etiqueta.
const borde = s => s.replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡0-9]+/, '').replace(/[\s:.,;·—–\-…›»]+$/, '');
for (const l of ['en', 'pt']) {
  for (const [k, v] of Object.entries(dic[l])) {
    const kb = borde(k), vb = borde(v);
    if (kb && kb !== k && vb && !(kb in dic[l]) && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(kb)) dic[l][kb] = vb;
  }
}
fs.mkdirSync(path.join(R, 'compartido', 'idioma'), { recursive: true });
for (const l of ['en', 'pt']) {
  const out = '// Generado por herramientas/armar_idioma.js desde herramientas/traducciones.tsv — no editar a mano.\n'
    + 'window.YL_DIC_' + l.toUpperCase() + '=' + JSON.stringify(dic[l]) + ';\n';
  fs.writeFileSync(path.join(R, 'compartido', 'idioma', l + '.js'), out);
}
// Versión de los diccionarios dentro de idioma.js, para que el navegador no use uno viejo.
const h = require('crypto').createHash('sha1').update(JSON.stringify(dic)).digest('hex').slice(0, 8);
const pj = path.join(R, 'compartido', 'idioma.js');
fs.writeFileSync(pj, fs.readFileSync(pj, 'utf8').replace(/var VDIC='[^']*'/, "var VDIC='" + h + "'"));
console.log(n + ' textos · en ' + Object.keys(dic.en).length + ' · pt ' + Object.keys(dic.pt).length);

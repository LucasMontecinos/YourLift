// El sitio habla en chileno, no en rioplatense.
//
// Se coló varias veces: "Seguí la competencia", "Andá a Atletas y Pesaje",
// "Creá el evento", "Mirá el log". Es voseo argentino y en Chile no se dice así.
// Además de sonar ajeno, la primera de esas frases estaba en la portada pública
// de Competencia en Vivo, que es lo primero que ve el espectador.
//
// Esta prueba busca las formas verbales del voseo en el texto que se le muestra
// a alguien. No es un corrector de estilo: solo mira los imperativos y presentes
// que terminan en tilde y que en chileno se escriben sin ella, más "tenés",
// "podés", "querés" y compañía.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_voseo.js
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Se escriben las formas enteras, no raíz + cualquier vocal tildada. La
// terminación del imperativo depende de la conjugación —-ar da á, -er da é, -ir
// da í— y generarlas todas fabrica palabras que en castellano existen y no son
// voseo: "cambió", "borró", "guardó" son pretéritos de tercera persona y salían
// marcados en cada comentario del código.
const formas = [
  // -ar → á
  'andá', 'creá', 'ingresá', 'buscá', 'agregá', 'cargá', 'revisá', 'completá',
  'anotá', 'apretá', 'tocá', 'cambiá', 'guardá', 'borrá', 'mirá', 'entrá',
  'dejá', 'llamá', 'esperá', 'mandá', 'marcá', 'sacá', 'usá', 'probá', 'armá',
  'descargá', 'seleccioná', 'confirmá', 'avisá', 'fijate', 'acordate',
  'tildá', 'grabá', 'exportá', 'reseteá', 'ajustá', 'filtrá', 'activá',
  'desactivá', 'generá', 'copiá', 'pegá', 'ordená', 'contactá',
  // -er → é
  'poné', 'tené', 'hacé', 'corré', 'volvé', 'leé', 'respondé', 'vendé', 'comé',
  'meté', 'aprendé', 'escogé',
  // -ir → í
  'seguí', 'elegí', 'escribí', 'subí', 'abrí', 'decí', 'salí', 'vení',
  'imprimí', 'añadí', 'compartí', 'definí', 'pedí', 'subila', 'subilo',
  // presente de indicativo
  'tenés', 'podés', 'querés', 'sabés', 'debés', 'hacés', 'decís', 'vivís',
];

// La palabra tiene que ir suelta: "creá" sí, "creación" no; "seguí" sí, "seguía"
// no. El \b de JavaScript no sirve acá: como las vocales con tilde no son \w,
// deja un borde entre la "í" de "seguía" y la "a", y el imperfecto —que es
// castellano de toda la vida— salía marcado como voseo. Van lookarounds con
// clase Unicode de letra.
const RX = new RegExp('(?<!\\p{L})(' + [...new Set(formas)].join('|') + ')(?!\\p{L})', 'giu');

const ARCHIVOS = ['index.html', 'livecast.html', 'admin.html', 'inscripcion.html',
  'atleta.html', 'nomina.html'].filter(f => fs.existsSync(__dirname + '/../' + f));

console.log('\nNadie vosea en pantalla');
let total = 0;
ARCHIVOS.forEach(f => {
  const txt = fs.readFileSync(__dirname + '/../' + f, 'utf8');
  const hits = [];
  txt.split('\n').forEach((ln, i) => {
    let m;
    RX.lastIndex = 0;
    while ((m = RX.exec(ln))) hits.push('línea ' + (i + 1) + ': …' +
      ln.slice(Math.max(0, m.index - 34), m.index + m[0].length + 26).trim() + '…');
  });
  total += hits.length;
  ok(hits.length === 0, f + (hits.length ? ' — ' + hits.length + ':\n      ' +
     hits.slice(0, 5).join('\n      ') : ''));
});

console.log('\n  Y las frases que ya se corrigieron siguen corregidas');
{
  const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  ok(/Sigue la competencia en tiempo real/.test(idx),
     'la portada de Competencia en Vivo dice "Sigue", no "Seguí"');
}

console.log(fallas ? `\n${fallas} FALLA(S) · ${total} caso(s) de voseo` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

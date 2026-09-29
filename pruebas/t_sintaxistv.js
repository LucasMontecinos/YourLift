// El livecast corre también en televisores y navegadores viejos (la pantalla de
// tarima, OBS). Esos no entienden ?. ni ??: una sola aparición y la pantalla
// queda en negro. Esto revisa el código del livecast y el compartido.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_sintaxistv.js
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };
const RAIZ = path.join(__dirname, '..');
const archivos = ['livecast', 'compartido'].flatMap(d =>
  fs.readdirSync(path.join(RAIZ, d)).filter(f => f.endsWith('.js')).map(f => d + '/' + f));
console.log('\nSin ?. ni ?? en lo que corre en la pantalla de tarima');
for (const f of archivos) {
  const src = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  const sc = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, src);
  const malos = []; let t;
  while ((t = sc.scan()) !== ts.SyntaxKind.EndOfFileToken)
    if (t === ts.SyntaxKind.QuestionDotToken || t === ts.SyntaxKind.QuestionQuestionToken)
      malos.push(src.slice(0, sc.getTokenPos()).split('\n').length);
  if (malos.length) ok(false, f + ': línea ' + malos.slice(0, 5).join(', '));
}
ok(fallas === 0, archivos.length + ' archivos revisados');
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

// Toda colección que el código usa tiene que tener su regla escrita.
//
// Esta prueba nace de una falla real y silenciosa. La base de jueces del panel
// (`referees`) nunca tuvo un `match` propio en firestore.rules, así que caía en
// el `allow read, write: if false` del final. Resultado: importar la planilla de
// FECHIPO agregaba CERO jueces y decía "39 fallaron", y la pantalla mostraba
// "Sin jueces cargados todavía" — exactamente lo mismo que se ve cuando la base
// está vacía de verdad. Nada en la interfaz decía que el problema eran las
// reglas. Estaba igual `nomina_cards`, que es la portada de yourlift.cl.
//
// El costo de olvidar una regla es ese: una función que parece andar, que no
// tira ningún error a la vista, y que no guarda nada. Por eso se revisa acá y no
// a mano.
//
// Ojo con lo que esta prueba NO hace: no valida que la regla sea la correcta
// —eso lo decide quien la escribe— ni que esté PUBLICADA en Firebase. El archivo
// del repositorio no se despliega solo; hay que publicarlo en la consola.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_reglas.js
const fs = require('fs');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

const raiz = __dirname + '/..';
const rules = fs.readFileSync(raiz + '/firestore.rules', 'utf8');
const paginas = fs.readdirSync(raiz).filter(f => f.endsWith('.html'));

// Las colecciones que el código toca, sacadas de las llamadas a Firestore.
const usadas = new Map();          // colección → páginas donde aparece
for (const f of paginas) {
  const s = fs.readFileSync(raiz + '/' + f, 'utf8');
  const pats = [
    /collection\((?:db|fbDB|window\.fbDB)\s*,\s*'([^']+)'/g,
    /doc\((?:db|fbDB|window\.fbDB)\s*,\s*'([^']+)'/g,
    /FBQ\.collection\([^,]+,\s*'([^']+)'/g,
    /fb\.collection\([^,]+,\s*'([^']+)'/g,
  ];
  for (const re of pats) {
    let m;
    while ((m = re.exec(s))) {
      const col = m[1].split('/')[0];
      if (!usadas.has(col)) usadas.set(col, new Set());
      usadas.get(col).add(f);
    }
  }
}

// Las que tienen un match escrito.
const conRegla = new Set([...rules.matchAll(/match \/([A-Za-z_][A-Za-z0-9_]*)\//g)].map(m => m[1]));

console.log('\nCada colección que usa el código tiene su regla');
{
  ok(usadas.size > 30, usadas.size + ' colecciones en uso');
  const sin = [...usadas.keys()].filter(c => !conRegla.has(c)).sort();
  ok(sin.length === 0, sin.length
    ? 'quedan sin regla y Firestore las va a rechazar: '
      + sin.map(c => c + ' (' + [...usadas.get(c)].join(', ') + ')').join(' · ')
    : 'ninguna se cae al ' + 'allow read, write: if false' + ' del final');
}

console.log('\n  Las dos que faltaban están');
{
  // La base de jueces del panel: la ficha del atleta muestra su categoría, así
  // que se lee en público, pero solo el admin la escribe.
  ok(/match \/referees\/\{/.test(rules), 'referees tiene su match');
  ok(/match \/nomina_cards\/\{/.test(rules), 'nomina_cards también');
  const trozo = k => {
    const i = rules.indexOf('match /' + k + '/{');
    return rules.slice(i, rules.indexOf('}', rules.indexOf('write', i)));
  };
  ok(/allow read: if true/.test(trozo('referees')), 'la corbata del juez se ve en su perfil público');
  ok(/allow write: if isAdmin\(\)/.test(trozo('referees')), 'y la escribe solo el admin');
  ok(/allow write: if isAdmin\(\)/.test(trozo('nomina_cards')), 'la portada la sube solo el admin');
}

console.log('\n  El panel avisa cuando el rechazo es de las reglas');
{
  // Lo que hacía difícil encontrarlo: fallaba en silencio y se veía igual que
  // una base vacía.
  const adm = fs.readFileSync(raiz + '/admin.html', 'utf8');
  ok(/ST\._refError=e/.test(adm), 'se guarda el error de la lectura en vez de tragárselo');
  ok(/Firestore no deja leer esta base/.test(adm),
     'y la lista lo dice en vez de mostrar “sin jueces cargados”');
  ok(/PERMISSION_DENIED/.test(adm), 'la importación reconoce el rechazo por permisos');
  ok(/Firestore → Reglas → Publicar/.test(adm), 'y dice dónde se arregla');
}

console.log('\n  El candado del final sigue puesto');
{
  // Sin él, cualquier colección nueva quedaría abierta a todo el mundo.
  const i = rules.lastIndexOf('match /{document=**}');
  ok(i > 0, 'está la regla que niega todo lo que no se nombró');
  ok(/allow read, write: if false/.test(rules.slice(i, i + 120)), 'y niega lectura y escritura');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

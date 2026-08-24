// El correo del atleta, a la vista en la nómina.
//
// El correo se pide en la inscripción y se guarda aparte, en
// inscripciones_private: la colección pública de inscripciones no lo lleva,
// justamente para que no quede a la vista de cualquiera que abra la nómina
// publicada. El problema era que tampoco estaba a la vista del panel: para
// sacar un correo había que exportar el Excel entero. Ahora hay una columna
// Correo en Nóminas y se copia de un click.
//
// Lo que se cuida:
//   · que el correo salga del lado privado y no del público — si algún día
//     alguien lo copia a `inscripciones`, esta prueba no lo tapa;
//   · que las filas sin correo muestren un guión y no basura;
//   · que copiar funcione aunque el navegador no tenga portapapeles (pasa en
//     http sin certificado, que es como se abre el panel en la sede);
//   · y que el Excel siga trayendo la columna, que es lo que ya se usaba.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_correonomina.js
const fs = require('fs');
const adm = fs.readFileSync(__dirname + '/../admin.html', 'utf8');
const rules = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Saca una asignación `window.NOMBRE = ...function(...){...}` haciendo balance
// de llaves. El sacar() de las otras pruebas solo entiende `function nombre(`.
function sacarWindow(texto, nombre) {
  const i = texto.indexOf('window.' + nombre + '=');
  if (i < 0) throw new Error('no encontré window.' + nombre);
  let p = i, open = 0, abrio = false;
  while (p < texto.length) {
    const c = texto[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    p++;
  }
  return texto.slice(i, p);
}

const codigoCopiar = sacarWindow(adm, 'copiarCorreo');

// Monta copiarCorreo con un navegador de mentira. `soporte` dice qué tiene ese
// navegador: 'clipboard' (moderno en https), 'execCommand' (http viejo) o nada.
function montar(soporte) {
  const reg = { copiado: [], toasts: [], prompts: [] };
  const window = { isSecureContext: soporte === 'clipboard', prompt: (m, v) => { reg.prompts.push(v); } };
  const navigator = soporte === 'clipboard'
    ? { clipboard: { writeText: async t => { reg.copiado.push(t); } } }
    : {};
  const document = {
    createElement: () => ({ style: { cssText: '' }, value: '', select() {} }),
    body: { appendChild(el) { reg.copiado.push(el.value); }, removeChild() { reg.quitado = true; } },
    execCommand: () => soporte === 'execCommand'
  };
  const showToast = m => reg.toasts.push(m);
  // eslint-disable-next-line no-eval
  eval(codigoCopiar);
  return { copiar: window.copiarCorreo, reg };
}

async function main() {
  console.log('\nLa columna existe y sale del lado privado');
  {
    const iZona = adm.indexOf('<th title="Comuna / Región">Zona</th>');
    ok(iZona > 0, 'la tabla de nóminas sigue teniendo la columna Zona');
    const fila = adm.slice(iZona, iZona + 600);
    ok(/Correo<\/th>/.test(fila), 'hay una columna Correo justo después de Zona');

    const iPriv = adm.indexOf('const priv = editable ? (ST.inscripcionesPrivate');
    ok(iPriv > 0, 'la fila sigue leyendo inscripciones_private');
    const cuerpo = adm.slice(iPriv, iPriv + 4000);
    const celda = cuerpo.slice(cuerpo.indexOf('${priv.correo'), cuerpo.indexOf('${priv.correo') + 700);
    ok(celda.length > 100, 'la celda del correo está en la fila');
    ok(!/\$\{\s*i\.correo/.test(cuerpo), 'en ningún lado se lee el correo de la inscripción pública');
    ok(/copiarCorreo\(/.test(celda), 'el correo es cliqueable para copiarlo');
    ok(/—/.test(celda), 'sin correo se muestra un guión');
    ok(/esc\(priv\.correo\)/.test(celda), 'el correo se escapa antes de inyectarlo en el HTML');
  }

  console.log('\n  Copiar de un click, aunque el navegador no ayude');
  {
    const a = montar('clipboard');
    await a.copiar('lucas@ejemplo.cl');
    ok(a.reg.copiado[0] === 'lucas@ejemplo.cl', 'en https copia con el portapapeles del navegador');
    ok(/lucas@ejemplo\.cl/.test(a.reg.toasts[0] || ''), 'y avisa qué correo copió');
    ok(a.reg.prompts.length === 0, 'sin molestar con ventanas');

    const b = montar('execCommand');
    await b.copiar('sin-https@ejemplo.cl');
    ok(b.reg.copiado[0] === 'sin-https@ejemplo.cl', 'sin portapapeles copia igual, con el textarea de respaldo');
    ok(/sin-https@ejemplo\.cl/.test(b.reg.toasts[0] || ''), 'y avisa lo mismo');
    ok(b.reg.quitado === true, 'y no deja el textarea colgando en la página');

    const c = montar('nada');
    await c.copiar('nada@ejemplo.cl');
    ok(c.reg.prompts[0] === 'nada@ejemplo.cl', 'si nada funciona, muestra el correo para copiarlo a mano');
    ok(c.reg.toasts.length === 0, 'y no dice que copió algo que no copió');

    const d = montar('clipboard');
    await d.copiar('');
    await d.copiar('   ');
    ok(d.reg.toasts.length === 0 && d.reg.prompts.length === 0, 'un correo vacío no dispara nada');

    ok(!/Copiá|Ingresá|Podés|Andá|Tenés/.test(codigoCopiar), 'el mensaje está en chileno, sin voseo');
  }

  console.log('\n  El Excel de la nómina sigue trayendo el correo');
  {
    const xl = adm.slice(adm.indexOf("const ws=wb.addWorksheet('Nómina'"));
    ok(/header:'CORREO'/.test(xl.slice(0, 3000)), 'la exportación tiene la columna CORREO');
    ok(/correo:priv\.correo\|\|''/.test(xl.slice(0, 4000)), 'y la llena desde inscripciones_private');
  }

  console.log('\n  Y el correo sigue siendo solo del panel');
  {
    const i = rules.indexOf('inscripciones_private');
    ok(i > 0, 'las rules siguen nombrando inscripciones_private');
    const bloque = rules.slice(i, i + 400);
    ok(/isAdmin\(\)/.test(bloque), 'inscripciones_private se lee solo con sesión de admin');
    ok(!/allow read: if true/.test(bloque), 'no queda abierta al público');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
}

main().catch(e => { console.log('  ✗ reventó: ' + e.message); process.exit(1); });

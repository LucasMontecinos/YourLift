// Arma livecast/estilo_panda.css a partir de livecast/estilo_lirio.css.
//
// El estilo Panda (Copa Panda) es Lirio con otros colores: las mismas piezas,
// la misma división entre lo que va a la transmisión y la operación (negro) y
// lo que ve el público (blanco), con los colores de un panda y verde bambú en
// vez de vino, crema y verde azulado. En vez de copiar a mano las 300 líneas de
// Lirio —y que se desarmen la primera vez que Lirio cambie— se sacan de ahí:
//   · cada regla pasa a valer solo con data-estilo-var="panda";
//   · cada color de Lirio se cambia por el suyo en Panda (la tabla de abajo);
//   · al final va lo propio de Panda: estilos/panda/extra.css.
// Si Lirio estrena un color que no está en la tabla, esto se detiene y dice
// cuál: hay que decidir a qué color de Panda corresponde.
//
//   node herramientas/estilo_panda.js            → escribe livecast/estilo_panda.css
//   node herramientas/estilo_panda.js --revisar  → solo revisa que esté al día
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const ORIGEN = path.join(RAIZ, 'livecast/estilo_lirio.css');
const EXTRA = path.join(RAIZ, 'estilos/panda/extra.css');
const DESTINO = path.join(RAIZ, 'livecast/estilo_panda.css');

// Lirio → Panda. Vino → negro, crema → blanco hueso, verde azulado → bambú,
// oro → bambú claro.
const COLORES = {
  '#0A463E': '#3F6A1C', '#0B5047': '#4F7F24', '#0E5E50': '#3B7A1E', '#0F5E52': '#5B8E2B', '#1E7A68': '#4F9A2E',
  '#1F000A': '#0B0B0C', '#24000C': '#101012', '#28000D': '#0E0E10', '#2E000F': '#0E0E10', '#320010': '#18181B',
  '#3A9A86': '#6FAE3A', '#3E0112': '#1E1E21', '#4C0116': '#0A0A0B', '#52091F': '#2E2E33', '#5E011B': '#0D0D0F',
  '#66B7A6': '#86BC4A', '#740221': '#141416', '#82062A': '#232326', '#8E0A30': '#2A2A2E', '#9A6B12': '#4F7F24',
  '#9CC9BE': '#A3C95F', '#B5650F': '#B5650F', '#C8323A': '#C8102E', '#D8BE92': '#A9A9A6', '#E05A50': '#E05A50',
  '#E2B866': '#A3C95F', '#E4CF9E': '#E2E0DA', '#E6C88F': '#D9D6CE', '#E6D3A5': '#ECEAE5', '#E7D4A6': '#E9E7E2',
  '#EBD8AA': '#E6E4DE', '#F07A6E': '#F07A6E', '#F0E0B9': '#EFEDE8', '#F1E2BD': '#F7F6F2', '#F3E6C7': '#F1F0EC',
  '#F6EBCF': '#FFFFFF', '#F8EED6': '#FAF9F6', '#FBF4E2': '#FFFFFF', '#FFF': '#FFF',
  'rgba(0,0,0': 'rgba(0,0,0', 'rgba(11,80,71': 'rgba(79,127,36', 'rgba(116,2,33': 'rgba(20,20,22',
  'rgba(226,184,102': 'rgba(163,201,95', 'rgba(241,226,189': 'rgba(247,246,242', 'rgba(36,0,10': 'rgba(0,0,0',
  'rgba(52,0,14': 'rgba(0,0,0', 'rgba(76,1,22': 'rgba(10,10,11',
};

// Separa por comas de primer nivel (no las de adentro de [..] o (..), como en
// [style*="background:rgba(13,31,56"]).
function partes(sel) {
  const out = []; let d = 0, q = null, ini = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '[' || c === '(') d++;
    else if (c === ']' || c === ')') d--;
    else if (c === ',' && d === 0) { out.push(sel.slice(ini, i)); ini = i + 1; }
  }
  out.push(sel.slice(ini));
  return out.map(s => s.trim()).filter(Boolean);
}

function selectorPanda(s) {
  if (s.includes('[data-estilo-var="lirio"]')) return s.split('[data-estilo-var="lirio"]').join('[data-estilo-var="panda"]');
  if (/^html\[/.test(s)) return 'html[data-estilo-var="panda"]' + s.slice(4);
  return 'html[data-estilo-var="panda"] ' + s;
}

const faltan = new Set();
function colores(decl) {
  return decl.replace(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|rgba\(\d+,\d+,\d+/g, m => {
    const k = m[0] === '#' ? m.toUpperCase() : m;
    if (!(k in COLORES)) { faltan.add(m); return m; }
    return COLORES[k];
  });
}

function armar() {
  const css = fs.readFileSync(ORIGEN, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas = [];
  let i = 0;
  while (i < css.length) {
    const a = css.indexOf('{', i); if (a < 0) break;
    const b = css.indexOf('}', a); if (b < 0) throw new Error('llave sin cerrar en estilo_lirio.css');
    const sel = css.slice(i, a).trim(), dec = css.slice(a + 1, b).trim();
    if (sel.startsWith('@')) throw new Error('estilo_lirio.css trae una regla @ (' + sel + '): esta herramienta no la sabe pasar');
    reglas.push(partes(sel).map(selectorPanda).join(',\n') + '{' + colores(dec) + '}');
    i = b + 1;
  }
  if (faltan.size) throw new Error('Colores de Lirio sin su par en Panda (agrégalos a COLORES en herramientas/estilo_panda.js): ' + [...faltan].join(' '));
  return '/* ════════════════════════════════════════════════════════════════════════\n'
    + '   ESTILO "PANDA" (Copa Panda) — GENERADO, no editar a mano.\n'
    + '   Sale de livecast/estilo_lirio.css con los colores de un panda y bambú, más\n'
    + '   estilos/panda/extra.css. Para cambiarlo: node herramientas/estilo_panda.js\n'
    + '   ════════════════════════════════════════════════════════════════════════ */\n'
    + reglas.join('\n') + '\n\n' + fs.readFileSync(EXTRA, 'utf8');
}

const nuevo = armar();
if (process.argv.includes('--revisar')) {
  const ok = fs.existsSync(DESTINO) && fs.readFileSync(DESTINO, 'utf8') === nuevo;
  console.log(ok ? 'estilo_panda.css al día' : 'estilo_panda.css atrasado: correr node herramientas/estilo_panda.js');
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(DESTINO, nuevo);
console.log('escrito livecast/estilo_panda.css (' + nuevo.split('\n').length + ' líneas)');

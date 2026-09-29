// Arma compartido/iconos.css a partir de los trazos de compartido/iconos.js.
//
// Los íconos se dibujan con CSS (una máscara con el trazo SVG, pintada con el
// color del texto), así en el HTML basta con <i class=yl-i-check></i>: no lleva
// comillas, entra igual en cualquier string de JavaScript o en HTML suelto, y si
// la hoja no carga la página no se rompe —solo falta el ícono—.
//
//   node herramientas/build_iconos.js      (desde la raíz del repo)
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
global.window = {};
require(path.join(raiz, 'compartido', 'iconos.js'));
const TRAZOS = window.YL_TRAZOS;

const enc = s => s.replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\s+/g, ' ');
// El color se pinta SOLO si el navegador entiende máscaras y variables CSS. Un
// televisor viejo que no las entiende dibujaría un cuadrado macizo del color del
// texto; así, en cambio, el ícono queda como un hueco del ancho de una letra.
let css = '/* Generado por herramientas/build_iconos.js a partir de compartido/iconos.js — no editar a mano. */\n'
  + '[class^="yl-i-"],[class*=" yl-i-"]{display:inline-block;width:1em;height:1em;vertical-align:-.14em;flex:none}\n'
  + '@supports (--a:0) and ((-webkit-mask-image:none) or (mask-image:none)){'
  + '[class^="yl-i-"],[class*=" yl-i-"]{background-color:currentColor;'
  + '-webkit-mask:var(--yl-i) center/contain no-repeat;mask:var(--yl-i) center/contain no-repeat}}\n';
Object.keys(TRAZOS).forEach(n => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" '
    + 'stroke-linecap="round" stroke-linejoin="round">' + TRAZOS[n].replace(/currentColor/g, 'black') + '</svg>';
  css += '.yl-i-' + n + '{--yl-i:url("data:image/svg+xml,' + enc(svg) + '")}\n';
});
fs.writeFileSync(path.join(raiz, 'compartido', 'iconos.css'), css);
console.log('compartido/iconos.css: ' + Object.keys(TRAZOS).length + ' íconos');

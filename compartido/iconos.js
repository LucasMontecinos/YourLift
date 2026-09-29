/* YourLift — íconos de la interfaz.

   Reemplazan a los emojis. Un emoji se ve distinto en cada teléfono, en cada
   televisor y en cada versión de Windows, trae su propio color y no respeta el
   del texto: en una interfaz de competencia se lee como un adorno ajeno. Estos
   íconos son de línea, toman el color del texto que los rodea (currentColor) y
   miden lo mismo que la letra (1em), así que se alinean solos en un botón, en un
   título o en una celda.

   Uso (en cualquier HTML que se arme como texto):
     ylIcono('check')                      → <svg …>
     ylIcono('alerta', {tam: 18})          → 18 px
     ylIcono('trofeo', {titulo: 'Récord'}) → con texto para lectores de pantalla

   Escrito sin sintaxis moderna (nada de ?. ni ??): lo cargan también las
   pantallas de tarima, que corren en navegadores de televisor viejos. */
(function (raiz) {
  'use strict';

  // Trazos en una grilla de 24 × 24, línea de 2 px, puntas redondeadas.
  var TRAZOS = {
    check:    '<path d="M4.5 12.5l5 5 10-11"/>',
    cruz:     '<path d="M6 6l12 12M18 6L6 18"/>',
    cerrar:   '<path d="M7 7l10 10M17 7L7 17"/>',
    menu:     '<path d="M4 7h16M4 12h16M4 17h16"/>',
    alerta:   '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.6v.1"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
    reloj:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
    espera:   '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    trofeo:   '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5"/>',
    medalla:  '<path d="M8 3l4 6 4-6"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.6v4.8"/>',
    estrella: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    usuario:  '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
    camara:   '<path d="M4 8h3.2l1.6-2.5h6.4L16.8 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
    archivo:  '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    carpeta:  '<path d="M3.5 6.5h6l2 2.3h9v10.7H3.5z"/>',
    adjunto:  '<path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7-7l8.2-8.2a3.4 3.4 0 0 1 4.8 4.8L10 17.1a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1"/>',
    lista:    '<path d="M9 4h6v3H9z"/><path d="M7 5.5H5.5V21h13V5.5H17M8.5 11.5h7M8.5 15.5h7"/>',
    candado:  '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    llave:    '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l2.5 2.5M14 9l2 2"/>',
    subir:    '<path d="M12 16V4M6.5 9.5L12 4l5.5 5.5M4.5 20h15"/>',
    bajar:    '<path d="M12 4v12M6.5 10.5L12 16l5.5-5.5M4.5 20h15"/>',
    pausa:    '<path d="M8.5 5v14M15.5 5v14"/>',
    detener:  '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    reproducir: '<path d="M7.5 5l11 7-11 7z"/>',
    anterior: '<path d="M16.5 5l-11 7 11 7z"/>',
    restablecer: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.5H9"/>',
    pantalla: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8.5 20h7M12 16.5V20"/>',
    capas:    '<path d="M12 3.5l9 4.5-9 4.5-9-4.5z"/><path d="M3 12.5l9 4.5 9-4.5"/><path d="M3 16.5l9 4.5 9-4.5"/>',
    basura:   '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14M10 10.5v6.5M14 10.5v6.5"/>',
    mas:      '<path d="M12 5v14M5 12h14"/>',
    ajustes:  '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    ojo:      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    telefono: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    globo:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
    correo:   '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.5 6.5l8.5 7 8.5-7"/>',
    editar:   '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
    buscar:   '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20.5 20.5"/>',
    enlace:   '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    copiar:   '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.5"/><path d="M15.5 8.5V4H4v11.5h4.5"/>',
    video:    '<rect x="3" y="6" width="13" height="12" rx="1.5"/><path d="M16 10l5-3v10l-5-3"/>',
    pesa:     '<path d="M3 12h18M6 7.5v9M18 7.5v9M3.5 9.5v5M20.5 9.5v5"/>',
    birrete:  '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.6 1.6 3.5 2.3 5.5 2.3s3.9-.7 5.5-2.3V11M21.5 9v5"/>',
    mujer:    '<circle cx="12" cy="9" r="5"/><path d="M12 14v7.5M8.8 18.5h6.4"/>',
    hombre:   '<circle cx="10" cy="14" r="5"/><path d="M13.6 10.4L20 4M14.5 4H20v5.5"/>',
    flecha:   '<path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5"/>',
    punto:    '<circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>'
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function ylIcono(nombre, op) {
    op = op || {};
    var t = TRAZOS[nombre];
    if (!t) return '';
    var tam = op.tam ? op.tam + 'px' : '1em';
    var grosor = op.grosor || 2;
    var accesible = op.titulo
      ? ' role="img" aria-label="' + esc(op.titulo) + '"><title>' + esc(op.titulo) + '</title>'
      : ' aria-hidden="true" focusable="false">';
    return '<svg class="yl-ico yl-ico-' + nombre + '" viewBox="0 0 24 24" width="' + tam + '" height="' + tam + '"'
      + ' fill="none" stroke="currentColor" stroke-width="' + grosor + '" stroke-linecap="round" stroke-linejoin="round"'
      + ' style="display:inline-block;vertical-align:-0.14em;flex:none' + (op.estilo ? ';' + op.estilo : '') + '"'
      + accesible + t + '</svg>';
  }

  raiz.ylIcono = ylIcono;
  raiz.YL_ICONOS = Object.keys(TRAZOS);
  raiz.YL_TRAZOS = TRAZOS;
})(typeof window !== 'undefined' ? window : this);

// ═══════════════════════════════════════════════════════════════
// YourLift — Logos de clubes afiliados FECHIPO
// ═══════════════════════════════════════════════════════════════
// Los logos se sirven desde /clubs/<key>.png (local).
// Si el archivo no existe el helper oculta la imagen sin romper
// el layout (onerror => display:none).
//
// Para agregar un logo nuevo:
//   1) Guardá el PNG en YourLift/clubs/<key>.png (240px de ancho aprox).
//   2) Sumá la entrada al objeto CLUBS_LOGOS más abajo.
//   3) Si querés mapear varias variantes del nombre del club a la
//      misma key, el match es por substring normalizado: "All Power CD",
//      "All Power" y "ALL POWER" todos matchean a 'allpower'.
// ═══════════════════════════════════════════════════════════════

window.CLUBS_LOGOS = {
  'allpower':         'clubs/allpower.png',
  'himalaya':         'clubs/himalaya.png',
  'beersandlifts':    'clubs/beersandlifts.png',
  'ironforces':       'clubs/ironforces.png',
  'jaquesoliger':     'clubs/jaquesoliger.png',
  'lostoros':         'clubs/lostoros.png',
  'potenciamuscular': 'clubs/potenciamuscular.png',
  'kaizen':           'clubs/kaizen.png',
  'rema':             'clubs/rema.png',
  'southside':        'clubs/southside.png',
  'hannya':           'clubs/hannya.png',
  'bushido':          'clubs/bushido.png',
  'atacama':          'clubs/atacama.png'
};

// Normaliza nombre: minúsculas, sin acentos, sin espacios ni símbolos
window.normClub = function(s){
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]/g,'');
};

// Devuelve URL del logo o '' si no hay match
window.clubLogo = function(name){
  if(!name) return '';
  const n = window.normClub(name);
  // Match por substring: 'allpowercd' contiene 'allpower'
  const map = window.CLUBS_LOGOS;
  for(const key in map){
    if(n.indexOf(key) >= 0) return map[key];
  }
  return '';
};

// HTML helper: <img> con onerror para que no rompa el layout si el archivo falta
window.clubLogoImg = function(name, size, extraStyle){
  const url = window.clubLogo(name);
  if(!url) return '';
  const s = size || 24;
  const xs = extraStyle || '';
  return '<img src="'+url+'" alt="" loading="lazy" '
    +'style="width:'+s+'px;height:'+s+'px;object-fit:contain;border-radius:4px;'+xs+'" '
    +'onerror="this.style.display=\'none\'">';
};

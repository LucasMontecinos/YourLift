// ═══════════════════════════════════════════════════════════════
// YourLift — Logos de clubes afiliados FECHIPO
// ═══════════════════════════════════════════════════════════════
// Logos locales (fallback estático). Los logos subidos desde admin
// se guardan en Firestore 'clubs/{slug}' y tienen prioridad via
// window._CLUBS_FS, que cada página carga después de init Firebase.

window.CLUBS_LOGOS = {
  'allpower':         'clubs/AllPower.png',
  'atacama':          'clubs/Atacama.png',
  'beersandlifts':    'clubs/BeersLifts.png',
  'blackbars':        'clubs/Blackbars.jpg',
  'bushido':          'clubs/Bushido.png',
  'hannya':           'clubs/Hannya.png',
  'himalaya':         'clubs/Himalaya.png',
  'ironforces':       'clubs/IronForces.png',
  'jacquesoliger':    'clubs/Jacques.png',
  'jaquesoliger':     'clubs/Jacques.png',
  'kaizen':           'clubs/Kaizen.png',
  'lostoros':         'clubs/Lostoros.png',
  'potenciamuscular': 'clubs/PotenciaMuscular.png',
  'rema':             'clubs/Rema.jpg',
  'southside':        'clubs/SouthSide.png'
};

// Logos subidos desde admin (Firestore 'clubs'). Cada página lo popula
// tras inicializar Firebase. Estructura: { [slug]: { logoUrl, name } }
window._CLUBS_FS = {};

// Normaliza nombre: minúsculas, sin acentos, sin espacios ni símbolos
window.normClub = function(s){
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]/g,'');
};

// Devuelve URL del logo o '' si no hay match.
// Prioridad: Firestore (admin subió logo) → archivo local estático.
window.clubLogo = function(name){
  if(!name) return '';
  const n = window.normClub(name);
  const fs = window._CLUBS_FS || {};
  for(const key in fs){
    if(n.indexOf(key) >= 0 && fs[key].logoUrl) return fs[key].logoUrl;
  }
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

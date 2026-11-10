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
  'blackbars':        'clubs/Blackbars.png',
  'bushido':          'clubs/Bushido.png',
  'hannya':           'clubs/Hannya.png',
  'himalaya':         'clubs/Himalaya.png',
  'ironforces':       'clubs/IronForces.png',
  'jacquesoliger':    'clubs/Jacques.png',
  'jaquesoliger':     'clubs/Jacques.png',
  'kaizen':           'clubs/Kaizen.png',
  'lostoros':         'clubs/Lostoros.png',
  'potenciamuscular': 'clubs/PotenciaMuscular.png',
  'primalstrength':   'clubs/PrimalStrength.png',
  'rema':             'clubs/Rema.jpg',
  'southside':        'clubs/SouthSide.png',
  'wolfstrength':     'clubs/WolfStrength.png'
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

// El fondo de cada logo. Casi todos los logos de club son blancos (Himalaya,
// Kaizen, Beers and Lifts…) y sobre el sitio blanco no se veían; otros tienen
// letras oscuras (Hannya) y no se veían sobre la transmisión negra. Por eso cada
// logo va siempre dentro de su baldosa: oscura por defecto, clara para los de
// letras oscuras. Se cambia por club en Admin → Clubes (campo fondoLogo).
window.CLUBS_FONDO = { 'hannya': 'claro' };
// Estos llevan SIEMPRE la baldosa oscura, aunque en Admin → Clubes diga otra
// cosa: sus logos son blancos (se pidió así).
window.CLUBS_FONDO_FIJO = { 'himalaya': 'oscuro', 'blackbars': 'oscuro' };
window.CLUB_FONDO_COLOR = { oscuro: '#0E1424', claro: '#FFFFFF' };
window.clubFondo = function(name){
  if(!name) return 'oscuro';
  const n = window.normClub(name);
  const fijo = window.CLUBS_FONDO_FIJO || {};
  for(const key in fijo){ if(n.indexOf(key) >= 0) return fijo[key]; }
  const fs = window._CLUBS_FS || {};
  for(const key in fs){
    if(n.indexOf(key) >= 0 && (fs[key].fondoLogo === 'claro' || fs[key].fondoLogo === 'oscuro')) return fs[key].fondoLogo;
  }
  const map = window.CLUBS_FONDO;
  for(const key in map){
    if(n.indexOf(key) >= 0) return map[key];
  }
  return 'oscuro';
};

// HTML helper: el logo dentro de su baldosa (ver clubFondo). Si el archivo
// falta, la baldosa se esconde y no rompe el layout.
window.clubLogoImg = function(name, size, extraStyle){
  const url = window.clubLogo(name);
  if(!url) return '';
  const s = size || 24;
  // El fondo de la baldosa lo decide clubFondo y nada más. Si quien llama manda
  // su propio "background:" se saca: no hacía nada (va antes del de la baldosa),
  // pero los temas día y noche (compartido/dia.css, livecast/tema.css) cambian a
  // la fuerza cualquier elemento que traiga ese azul escrito, y la baldosa
  // oscura de un logo blanco quedaba clara: Himalaya no se veía.
  const xs = String(extraStyle || '').replace(/(^|;)\s*background(-color)?\s*:[^;]*/gi, '$1');
  const f = window.clubFondo(name);
  const bg = window.CLUB_FONDO_COLOR[f] || window.CLUB_FONDO_COLOR.oscuro;
  return '<span class="club-logo club-logo-'+f+'" style="display:inline-grid;place-items:center;width:'+s+'px;height:'+s+'px;'
    +'overflow:hidden;flex-shrink:0;vertical-align:middle;box-sizing:border-box;'+xs+';background:'+bg+';border-radius:22%;'
    +(f==='claro'?'box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);':'')+'">'
    // En la transmisión y las pantallas de tarima (CLUB_LOGO_AL_TIRO) el logo se
    // carga y se pinta de inmediato: con "lazy", cada vez que la pantalla se
    // redibujaba el logo desaparecía un instante. En las listas del sitio sigue
    // en "lazy", que es lo que conviene con muchos logos.
    +'<img src="'+url+'" alt="" '+(window.CLUB_LOGO_AL_TIRO?'decoding="sync"':'loading="lazy"')+' style="width:86%;height:86%;object-fit:contain;display:block" '
    +'onerror="this.parentNode.style.display=\'none\'"></span>';
};

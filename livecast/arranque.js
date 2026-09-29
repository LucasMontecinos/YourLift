// livecast.html — lo que corre al abrir la página, en su orden original: la
// configuración que sale de la dirección (?tx=, ?tarima=, ?evento=…), el
// estado de la competencia (DATA), Firebase, los listeners y el primer dibujo.
//
// Se carga DESPUÉS de todos los demás archivos de livecast/, que solo definen
// funciones. El orden de estas instrucciones importa: no reordenar.

let DATA={phase:'setup',events:[],event:null,athletes:[],lift:'sq',round:0,flight:'A',timer:60,timerOn:false,changeTimers:{},lotsGenerated:false,forcedCurrent:null,compTimer:null};
// ══════════════════════════════════════════════
// TRANSMISSION WIDGETS (?tx=<widget>)
// Standalone widgets for OBS Browser Sources. Read-only.
// ══════════════════════════════════════════════
const TX_URL=new URLSearchParams(location.search);
// ── Entrar por el link (o el QR) de un campeonato ─────────────────────────────
// Cuando la dirección trae ?evento=…, la persona ya eligió: no viene a elegir de
// una lista. Pero los datos tardan —nominas.json y los campeonatos de Firestore—
// y mientras tanto la pantalla dibujaba el selector con "NO HAY COMPETENCIAS EN
// VIVO", y un segundo después entraba sola. Escaneando un QR eso se ve como si
// algo hubiera fallado y después se arreglara solo.
//
// Con esta marca, mientras el evento del link no se resuelve, se muestra una sola
// pantalla quieta que dice que está entrando. Se apaga cuando el evento queda
// resuelto —o cuando se agotó la espera, y ahí sí corresponde mostrar la lista.
window._EV_ESPERANDO=(function(){try{return !!TX_URL.get('evento')}catch(e){return false}})();
const TX_MODE=TX_URL.get('tx')||null;
 // 'profile' | 'scoreboard' | 'leaderboard' | 'lbauto' | 'slam' | 'timer' | 'lights' | 'ceremony' | null
const TARIMA=TX_URL.get('tarima')||null;
 // '1' o '2' para modo 2 tarimas; null = todas
// Pantalla de tarima CLAVADA en un modo (?tx=screen&modo=intentos).
//
// Sin esto, todas las pantallas de tarima comparten el mismo canal: si hay dos
// televisores con el mismo link y el operador cambia lo que muestra uno, se le
// cambia también el otro. Con el modo en el link, cada televisor muestra lo suyo
// y no lo mueve nadie — pero sigue recibiendo el resto del canal (fondo,
// difuminado, tandas, tamaño del nombre), que es lo que el operador sí quiere
// poder ajustar desde el panel.
const SCREEN_FIJO=(()=>{
  const m=(TX_URL.get('modo')||'').toLowerCase();
  return ['profile','barra','intentos','jornada','luces','off'].indexOf(m)>=0?m:null;
})();
// ¿Estamos adentro de una fuente de navegador de OBS? OBS inyecta window.obsstudio
// en cada browser source, y además se anuncia en el user agent. Importa porque su
// navegador interno (CEF) no es Chrome: el canal en tiempo real de Firestore se
// queda colgado ahí — la página carga bien, muestra el estado del momento y ya no
// se entera de nada más. Es lo que pasó en el Regional: el control remoto movía la
// competencia, el mismo link abierto en Chrome respondía, y el de OBS no.
// ?longpoll=1 fuerza el mismo tratamiento en cualquier navegador que se comporte así.
const EN_OBS=(function(){
  try{
    if(window.obsstudio)return true;
    if(/\bOBS\b/i.test(navigator.userAgent||''))return true;
  }catch(e){}
  return false;
})();
const FORZAR_LONGPOLL=EN_OBS||TX_URL.get('longpoll')==='1';
const DEMO_MODE=TX_URL.get('demo')==='1';
 // Modo demo para grabar videos promocionales
// Modo práctica (?practica=1): livecast.html completo (Control en Vivo, Atletas y
// Pesaje, Control TX, todo) pero con una tanda ficticia de atletas inventados, sin
// tocar Firebase para nada — ni lectura ni escritura. Pensado para que los jueces
// se familiaricen con la herramienta sin riesgo de tocar una competencia real.
// Ver _initPracticeMode() más abajo.
const PRACTICE_MODE=TX_URL.get('practica')==='1';
// ?practica=1&espectador=1 → vista de ESPECTADOR de la práctica: lo mismo que ve
// el público (COMPETENCIA EN VIVO, sin controles de admin), leyendo la data de
// práctica compartida por localStorage. Para mandarle el link a la gente que
// quiere ir mirando mientras los jueces practican. Ver _initPracticeMode().
const PRACTICE_VIEWER=PRACTICE_MODE && TX_URL.get('espectador')==='1';
// ?practica=1&real=1 → PRÁCTICA CON NÓMINA REAL: mismas condiciones que un evento
// real (eliges un campeonato y carga sus atletas reales desde Firestore), pero en
// modo práctica: Firebase queda de SOLO LECTURA (un candado bloquea toda escritura,
// ver initFB) y NO se sincroniza el estado en vivo (ver startFBSync), así nunca
// toca la competencia real. La data vive en el localStorage de práctica.
const PRACTICE_REAL=PRACTICE_MODE && TX_URL.get('real')==='1';
// ?remote=1 → al loguearse admin, aterriza directo en el Control Remoto (phone-first).
// Pensado para mandarle el link al teléfono que controla el overlay de OBS.
const WANT_REMOTE=TX_URL.get('remote')==='1';
if(TX_MODE){
  const css=document.createElement('style');
  css.textContent=`
    html,body{background:transparent!important;overflow:hidden!important;margin:0}
    body.tx-opaque{background:linear-gradient(135deg,#0A1628 0%,#0E1F3A 50%,#0A1628 100%)!important}
    #R{display:none!important}
    #txWidget{position:fixed;top:0;right:0;bottom:0;left:0;font-family:'Oswald',sans-serif;color:#fff;z-index:2}
    /* Capa del timer de descanso: cubre toda la pantalla para que el bloque se
       pueda arrastrar a cualquier lado, pero deja pasar los clicks — si no, se
       come la selección de todos los demás bloques que hay debajo. */
    .pi-desc-capa{pointer-events:none}
    .pi-desc-capa .pi-block{pointer-events:auto}
    @keyframes txSlideRight{from{transform:translateX(-40px);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes txSlideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes txSlideDown{from{transform:translateY(-40px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes txFade{from{opacity:0}to{opacity:1}}
    @keyframes txScaleIn{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes txGrowLine{from{transform:scaleY(0);transform-origin:top}to{transform:scaleY(1);transform-origin:top}}
    @keyframes txGrowLineH{from{transform:scaleX(0);transform-origin:left}to{transform:scaleX(1);transform-origin:left}}
    @keyframes txSlamIn{0%{transform:scale(.4) rotate(-8deg);opacity:0;letter-spacing:30px}55%{transform:scale(1.15) rotate(0);opacity:1;letter-spacing:8px}75%{transform:scale(.95)}100%{transform:scale(1);letter-spacing:8px}}
    @keyframes txSlamOut{from{transform:scale(1);opacity:1}to{transform:scale(1.6);opacity:0;filter:blur(8px)}}
    @keyframes txSlamFlash{0%,100%{background:rgba(0,0,0,0)}40%{background:rgba(0,0,0,.45)}}
    @keyframes txLightOn{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes txTimerPulse{0%,100%{opacity:1}50%{opacity:.55}}
    /* ─── IPF-style flag wipe (3 cintas diagonales) ─── */
    @keyframes txStripeFwd{0%{transform:translateX(-160%) skewX(-18deg)}45%{transform:translateX(0) skewX(-18deg)}55%{transform:translateX(0) skewX(-18deg)}100%{transform:translateX(160%) skewX(-18deg)}}
    @keyframes txStripeBack{0%{transform:translateX(160%) skewX(-18deg)}45%{transform:translateX(0) skewX(-18deg)}55%{transform:translateX(0) skewX(-18deg)}100%{transform:translateX(-160%) skewX(-18deg)}}
    @keyframes txContentFadeIn{0%,55%{opacity:0;transform:scale(.96)}65%{opacity:1;transform:scale(1)}100%{opacity:1;transform:scale(1)}}
    @keyframes txContentFadeOut{0%,45%{opacity:1;transform:scale(1)}55%{opacity:0;transform:scale(.96)}100%{opacity:0;transform:scale(.96)}}
    @keyframes txLogoBeat{0%,55%{opacity:0;transform:scale(.5)}45%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.7)}}
    /* ─── Slide-in / build animations para componentes corner ─── */
    @keyframes txSlideInLeft{0%{transform:translateX(-110%);opacity:0}60%{transform:translateX(0);opacity:1}100%{transform:translateX(0);opacity:1}}
    @keyframes txSlideOutLeft{0%{transform:translateX(0);opacity:1}100%{transform:translateX(-110%);opacity:0}}
    @keyframes txSlideInRight{0%{transform:translateX(110%);opacity:0}60%{transform:translateX(0);opacity:1}100%{transform:translateX(0);opacity:1}}
    @keyframes txSlideOutRight{0%{transform:translateX(0);opacity:1}100%{transform:translateX(110%);opacity:0}}
    /* Scoreboard: entra desde abajo (sube hacia su posición) */
    /* Scoreboard slide-in/out: usamos px fijos (no %) porque el wrapper tiene altura 0 (position:fixed inside) */
    @keyframes txSlideInBottom{0%{transform:translateY(260px);opacity:0}55%{transform:translateY(-6px);opacity:1}80%{transform:translateY(2px);opacity:1}100%{transform:translateY(0);opacity:1}}
    @keyframes txSlideOutBottom{0%{transform:translateY(0);opacity:1}100%{transform:translateY(260px);opacity:0}}
    @keyframes txBuildRow{0%{transform:translateX(-30px) scaleY(0);opacity:0;transform-origin:left center}60%{transform:translateX(0) scaleY(1);opacity:1}100%{transform:translateX(0) scaleY(1);opacity:1}}
    @keyframes txSbRowIn{0%{opacity:0;transform:scaleY(0)}60%{opacity:1;transform:scaleY(1.04)}100%{opacity:1;transform:scaleY(1)}}
    /* Logo del campeonato: aparece primero, hace un mini-bounce, queda fijo */
    @keyframes txLogoBuildIn{0%{transform:scale(0) rotate(-20deg);opacity:0;filter:blur(8px)}55%{transform:scale(1.18) rotate(4deg);opacity:1;filter:blur(0)}80%{transform:scale(.95) rotate(-2deg)}100%{transform:scale(1) rotate(0);opacity:1;filter:blur(0)}}
    /* Para el wrapper del scoreboard: comienza colapsado en el ancho del logo y se expande */
    @keyframes txSbRevealFromLogo{0%{clip-path:inset(0 calc(100% - 80px) 0 0);opacity:.9}55%{clip-path:inset(0 0 0 0);opacity:1}100%{clip-path:inset(0 0 0 0);opacity:1}}
    @keyframes txTaRevealFromLogo{0%{clip-path:inset(0 calc(100% - 90px) 0 0);opacity:.9;transform:translateY(20px)}55%{clip-path:inset(0 0 0 0);opacity:1;transform:translateY(0)}100%{clip-path:inset(0 0 0 0);opacity:1;transform:translateY(0)}}
    @keyframes txFadeUpDelay{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
    /* Tabla Actual: explode from logo (top-left header, logo center ~52px,50px del card) */
    @keyframes txTaCardExplode{0%{clip-path:circle(55px at 70px 64px)}100%{clip-path:circle(180% at 70px 64px)}}
    /* Scoreboard: explode from logo (top-left header) */
    @keyframes txSbCardExplode{0%{clip-path:circle(34px at 50px 32px)}100%{clip-path:circle(180% at 50px 32px)}}
    /* Animaciones SOLO cuando el wrapper tiene la clase de entrada.
       Así, si el componente re-renderiza por update de datos, no replay. */
    .ta-wrap-anim .ta-card-explode{animation:txTaCardExplode .95s cubic-bezier(.3,0,.2,1) .15s both}
    .ta-wrap-anim .ta-logo-anim{animation:txLogoBuildIn .7s cubic-bezier(.2,.85,.3,1.05) both}
    .sb-wrap-anim .sb-card-explode{animation:txSbCardExplode .9s cubic-bezier(.3,0,.2,1) .15s both}
    .sb-wrap-anim .sb-logo-anim{animation:txLogoBuildIn .7s cubic-bezier(.2,.85,.3,1.05) both;display:inline-block}
    @keyframes txSbRowOut{0%{opacity:1;transform:scaleY(1)}100%{opacity:0;transform:scaleY(0)}}
    @keyframes txScoreboardCycle{0%{transform:translateY(110%);opacity:0}3%{transform:translateY(0);opacity:1}97%{transform:translateY(0);opacity:1}100%{transform:translateY(110%);opacity:0}}
    /* Barrido izquierda→derecha: el contenido se revela naciendo desde el logo YourLift (fijo a la izquierda) */
    @keyframes txSbWipeFromLogo{0%{clip-path:inset(0 100% 0 0)}100%{clip-path:inset(0 0% 0 0)}}
    .sb-wipe-content{animation:txSbWipeFromLogo .65s cubic-bezier(.16,1,.3,1) both}
    @keyframes txLbCycle{0%{transform:scale(.92);opacity:0}5%{transform:scale(1);opacity:1}95%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0;filter:blur(4px)}}
    @keyframes txRecordSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @keyframes txRecordIn{0%{transform:scale(0) rotate(-180deg);opacity:0}60%{transform:scale(1.15) rotate(20deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
    @keyframes txRecordOut{from{transform:scale(1);opacity:1}to{transform:scale(.6);opacity:0}}
    .txCascade>*{animation:txSlideRight .55s cubic-bezier(.2,.8,.2,1) backwards}
    .txCascade>*:nth-child(1){animation-delay:.15s}
    .txCascade>*:nth-child(2){animation-delay:.32s}
    .txCascade>*:nth-child(3){animation-delay:.49s}
    .txCascade>*:nth-child(4){animation-delay:.66s}
    .txCascade>*:nth-child(5){animation-delay:.83s}
    .txCascade>*:nth-child(6){animation-delay:1.0s}
    .txCascade>*:nth-child(7){animation-delay:1.17s}
    .txCascade>*:nth-child(8){animation-delay:1.34s}
    .txCascade>*:nth-child(9){animation-delay:1.51s}
    .txCascade>*:nth-child(10){animation-delay:1.68s}
    .txCascade>*:nth-child(11){animation-delay:1.85s}
    .txCascade>*:nth-child(12){animation-delay:2.02s}
  `;
  document.head.appendChild(css);
  const ready=()=>{
    if(TX_MODE==='profile'||TX_MODE==='leaderboard'||TX_MODE==='jornada'||TX_MODE==='screen')document.body.classList.add('tx-opaque');
    // Ojo con dejar sordas al puntero las pantallas de transmisión en bloque: NO
    // todas son solo un cartel. La de Intentos y la de Atleta en barra llevan el
    // editor de bloques —se arrastran y se redimensionan con el mouse—, así que
    // apagarles el puntero las deja inservibles. El marcador sí es solo cartel y
    // se apaga en su propio nodo, más abajo.
    const d=document.createElement('div');d.id='txWidget';document.body.appendChild(d);
    // Sin placeholder: queda transparente hasta que llegan los datos.
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
  // Replay de animación cuando la escena de OBS se activa (sin recargar).
  // Funciona con OBS Browser Source y al volver al tab en navegador normal.
  window.txReplay=function(){
    if(typeof _txLastLifter!=='undefined')_txLastLifter=null;
    if(typeof renderTxWidget==='function')renderTxWidget();
    // Re-conectar listener de Firestore por si OBS lo suspendió al cambiar de escena
    if(typeof startFBSync==='function'&&typeof fbReady!=='undefined'&&fbReady&&DATA&&DATA.event)startFBSync();
  };
  window.addEventListener('obsSourceActiveChanged',e=>{if(e&&e.detail&&e.detail.active)window.txReplay()});
  window.addEventListener('obsSourceVisibleChanged',e=>{if(e&&e.detail&&e.detail.visible)window.txReplay()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.txReplay()});
  // Pantalla de tarima: reajustar el escalado de la tabla al cambiar el tamaño.
  let _rsT=null;
  window.addEventListener('resize',()=>{
    if(TX_MODE!=='jornada'&&TX_MODE!=='screen')return;
    clearTimeout(_rsT);_rsT=setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},120);
  });
}
// ══════════════════════════════════════════════
// ADMIN CREDENTIALS — Editar aquí para cambiar accesos
// ══════════════════════════════════════════════
// Admin credentials managed via Firebase Auth (admin.html → Firebase Console)
// ══════════════════════════════════════════════

let isAdmin=false;
// Rol del admin logueado (owner/superadmin/admin = acceso completo; transmision/juez = restringido).
// Se completa al loguear, leyendo el campo "role" del doc admins/{uid} (ver admin.html → Gestión Admin).
window.ADMIN_ROLE=null;
// Páginas del panel bloqueadas para ciertos roles: transmisión no entra a Control en Vivo,
// jueces no entran a Control TX. El resto de roles (owner/superadmin/admin) tiene acceso total.
//
// "streaming" es la cuenta de quien transmite: elige el campeonato como cualquiera,
// pero de ahí en adelante solo ve lo de la transmisión (Control TX, Control Remoto,
// Transmisión, Widgets OBS y Pantalla de Tarima). No entra a Atletas & Pesaje ni a
// Control en Vivo, así que no puede tocar la competencia por accidente.
const _PAGS_STREAMING=['setup','transmision','obsTx','director','remote','screen','results','atletaInfo','liveView'];
window._esStreaming=function(){return window.ADMIN_ROLE==='streaming';};
window._canAccess=function(page){
  const role=window.ADMIN_ROLE;
  if(role==='streaming')return _PAGS_STREAMING.indexOf(page)>=0;
  if(role==='transmision'&&page==='compete')return false;
  if(role==='juez'&&page==='director')return false;
  return true;
};
// ══════════════════════════════════════════════
// FIREBASE REAL-TIME SYNC
// ══════════════════════════════════════════════
const FB_CFG={apiKey:"AIzaSyA21IHMus2bklPLJm7ExRrVJJL9bzLhyp4",authDomain:"fechipo-db-13148.firebaseapp.com",projectId:"fechipo-db-13148",storageBucket:"fechipo-db-13148.firebasestorage.app",messagingSenderId:"551573388751",appId:"1:551573388751:web:5fcc377a8d595378ab26ba"};
let fbDB=null,fbReady=false,fbUnsub=null,_fbSyncing=false,_fbLastWrite=0,fbAuth=null;
// ══════════════════════════════════════════════
// CONTROLLER MODE: solo el PC que tenga ?controller=1 en la URL escribe a Firebase.
// Los demás (productor, viewers) solo leen. Evita conflictos entre admins.
window.IS_CONTROLLER=(new URLSearchParams(location.search).get('controller')==='1')||localStorage.getItem('yl_controller')==='1';
if(window.IS_CONTROLLER){
  console.log('[YL] Modo CONTROLLER activo — esta PC escribe a Firebase');
}else{
  console.log('[YL] Modo LECTURA — solo lee de Firebase. Agrega ?controller=1 a la URL para escribir.');
}
// Id único de este equipo/pestaña — para que en multi-controlador cada PC
// ignore SOLO el eco de su propia escritura, pero aplique las de los demás.
window._WRITER_ID=(()=>{try{let w=sessionStorage.getItem('yl_writer');if(!w){w='w'+Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem('yl_writer',w);}return w;}catch(e){return 'w'+Math.random().toString(36).slice(2);}})();
// ── VISTA LIBRE (navegación propia de esta pantalla) ────────────────
// Los DATOS son siempre de todos: los pesos y las decisiones que carga uno le
// aparecen al resto, a la tarima, a los widgets y al público. Lo que puede ser
// de cada uno es el CURSOR — en qué movimiento, ronda y tanda está mirando esta
// pantalla. Con la vista libre prendida, este equipo se mueve solo: ni le hacen
// caso al cursor de los demás ni arrastra a nadie cuando guarda algo. Apagada
// (lo normal, y como venía siendo) sigue a la tarima.
// Es por navegador, no por cuenta: tres personas con el mismo correo pueden
// tener una siguiendo la tarima y las otras dos mirando otra tanda.
// ── FONDO DEL LIVECAST ──────────────────────────────────────────────
// Preferencia de cada pantalla (no se sincroniza): el operador que trabaja con
// luz encima ve mejor en negro, y en algunas salas el azul se lava en el
// proyector. Solo toca el fondo y los paneles de la interfaz — la Pantalla de
// Tarima y los widgets de OBS tienen sus propios colores en Transmisión, para
// no romper lo que ya está calibrado para la cámara.
const LC_FONDOS={
  azul: {n:'Azul (por defecto)', bg:'#0A1628', card:'#0F1F35', border:'#1D3150', side:'#0C1A2E'},
  negro:{n:'Negro',              bg:'#000000', card:'#0e0e0e', border:'#2b2b2b', side:'#080808'},
  gris: {n:'Gris',               bg:'#1b1e23', card:'#252930', border:'#3b414b', side:'#171a1f'},
};
window.lcFondo=(()=>{try{return LC_FONDOS[localStorage.getItem('yl_lc_fondo')]?localStorage.getItem('yl_lc_fondo'):'azul'}catch(e){return 'azul'}})();
window.aplicarFondoLC=function(k){
  const f=LC_FONDOS[k]||LC_FONDOS.azul;
  const r=document.documentElement.style;
  r.setProperty('--bg',f.bg); r.setProperty('--card',f.card);
  r.setProperty('--border',f.border); r.setProperty('--side',f.side);
};
window.setFondoLC=function(k){
  if(!LC_FONDOS[k])return;
  window.lcFondo=k;
  try{localStorage.setItem('yl_lc_fondo',k)}catch(e){}
  window.aplicarFondoLC(k);
  try{if(typeof R==='function')R();}catch(e){}
};
try{window.aplicarFondoLC(window.lcFondo);}catch(e){}
// Vista libre: esta pantalla se queda en la tanda y el movimiento que está mirando,
// aunque la tarima avance. Lo que NO puede quedarse pegado es un widget de OBS o la
// pantalla de tarima: ahí el cursor tiene que seguir siempre a la competencia, si no
// muestran la ronda vieja y nadie aparece en tarima. Por eso la única condición es
// que no sea un modo de transmisión.
//
// Antes se exigía además ser admin y controlador, o sea que solo el operador podía
// desengancharse. Pero el espectador que sigue la competencia desde su teléfono
// también quiere revisar otra tanda sin que lo devuelvan de un salto cada vez que
// cargan un peso — y como no escribe nada, congelar SU pantalla no le afecta a nadie.
// Al operador se le sigue respetando: cuando guarda en vista libre publica el cursor
// de la tarima, no el suyo (ver syncToFB).
// Arranca SIEMPRE apagada. Antes se recordaba entre sesiones, y esa era la
// trampa: una pantalla quedaba en vista libre de un día para otro, nadie se
// acordaba, y al operar se veía una tanda distinta a la que estaba en tarima.
// Parecía una desincronización y no lo era. Se prende a propósito cuando hace
// falta, que es lo que corresponde para algo que cambia lo que ves.
window._navLibreGuardada=false;
try{localStorage.removeItem('yl_nav_libre')}catch(e){}
Object.defineProperty(window,'NAV_LIBRE',{
  get(){ return !!(window._navLibreGuardada && !TX_MODE); },
  set(v){ window._navLibreGuardada=!!v; },
  configurable:true
});
window._NAV_REMOTA=null;
   // último cursor que publicó la tarima
window.setNavLibre=function(v){
  window.NAV_LIBRE=!!v;
  // No se guarda: dura lo que dura esta pestaña abierta.
  // Al volver a seguir la tarima, saltar de una a donde está ella.
  if(!window.NAV_LIBRE&&window._NAV_REMOTA){
    const n=window._NAV_REMOTA;
    if(n.lift)DATA.lift=n.lift;
    if(typeof n.round==='number')DATA.round=n.round;
    if(n.flight)DATA.flight=n.flight;
    DATA.forcedCurrent=(n.forcedCurrent!==undefined)?n.forcedCurrent:null;
  }
  try{if(typeof R==='function')R();}catch(e){}
};
// Cambiar entre Controlador (escribe+lee, sincronizado con otros) y Espectador
// (solo lee/espeja, ej. PC de OBS o pantalla). Recarga para reiniciar el listener.
window.setSyncMode=function(on){
  try{localStorage.setItem('yl_controller', on?'1':'0')}catch(e){}
  location.reload();
};
let _lastFbUpdate=0;
// Event ID → name mapping (must match inscripcion.html EVENTS)
let LIVE_EVENTS={'regional_centro_2026':'Campeonato Regional Centro FECHIPO 2026','universitario_2026':'Primer Campeonato Nacional Universitario FECHIPO 2026','Campeonato_de_debutantes':'Campeonato de Debutantes'};
let _liveUnsub=null;
let _syncInFlight=false,_syncPending=false,_fbLastOk=0;
setInterval(()=>{try{_syncPintaSemaforo()}catch(e){}},1000);
window._syncFallo=0;
      // ts del último fallo definitivo de escritura
let _reintentoTO=null;
// Sync liviano solo del timer — corre cada 1s mientras el timer está activo,
// así los widgets de OBS ven el countdown segundo a segundo sin reescribir
// el doc completo (athletes incluido).
// Reloj de la tarima: se manda CUÁNDO ARRANCÓ, no el segundo en que va.
// Firestore entrega el documento ENTERO en cada snapshot, así que escribir el
// timer una vez por segundo hacía que cada pantalla, cada widget de OBS y cada
// espectador se bajaran los ~40 KB del estado completo 60 veces por minuto. Con
// la hora de arranque, cada pantalla calcula el descuento sola y solo hace falta
// refrescar de vez en cuando. Es lo que más pesaba en el wifi del gimnasio.
const _TIMER_LATIDO_MS=10000;
let _ultLatidoTimer=0;
// ── Canal rápido (livecast_flash) ───────────────────────────────────────────
//
// El documento de livecast_sync lleva la nómina ENTERA (cientos de KB con el
// Sudamericano) y se escribe con una transacción que primero lo baja completo.
// En el wifi del recinto eso son 5 a 10 segundos entre cargar un peso en la
// planilla y verlo en el control remoto, en la transmisión o en las pantallas
// del público.
//
// Al lado va un documento chico con SOLO lo que cambió: los atletas distintos de
// lo último que quedó en el servidor, más el cursor (movimiento, ronda, tanda) y
// el reloj. Pesa unos pocos KB y llega en menos de un segundo. El documento
// completo se sigue escribiendo igual que siempre y sigue siendo la fuente de
// verdad: si el canal rápido falla o se pierde, todo llega como antes.
window._flashBase=null;
   // id → JSON del atleta tal como está en el servidor
let _flashUltHuella='', fbFlashUnsub=null;
// Lo que llegó por el canal rápido y todavía no consta en un documento completo.
// Por atleta, gana lo último que llegó. Hace falta porque el documento completo
// llega varios segundos atrasado: si al llegar pisara todo, un válido que ya se
// veía desaparecería hasta que llegara el documento siguiente.
window._flashPend={ath:{},cur:null};
// Redibujado que quedó esperando porque el operador estaba escribiendo un peso.
// Se hace apenas suelta el campo: así la pantalla se pone al día con lo que
// llegó mientras tanto, sin haberle borrado lo que estaba tecleando.
window._renderPendiente=false;
document.addEventListener('focusout',()=>setTimeout(_soltoElCampo,0),true);
// Red de seguridad: si el foco se queda pegado en un campo (pasa cuando el
// operador deja el cursor puesto y se va a mirar la tarima), igual hay que
// mostrarle lo que llegó. Se refresca cada 3 s sin tocar el campo que edita.
setInterval(()=>{
  if(!window._renderPendiente)return;
  const f=document.activeElement;
  if(!f||!(f.tagName==='INPUT'||f.tagName==='SELECT'||f.tagName==='TEXTAREA')){_soltoElCampo();return;}
  const id=f.id, val=f.value, ini=f.selectionStart, fin=f.selectionEnd;
  window._renderPendiente=false;
  if(typeof R==='function')R();
  // Devolver el foco y lo tecleado a la misma casilla tras el redibujado.
  try{
    const el=id&&document.getElementById(id);
    if(el){ el.value=val; el.focus(); if(el.setSelectionRange&&ini!=null)el.setSelectionRange(ini,fin); }
  }catch(e){}
},3000);
// Vigilante de la conexión. Una pantalla de público o de OBS queda prendida
// horas sin que nadie la toque: si el listener se corta (wifi, suspensión del
// equipo, Firestore que cierra el stream), se queda mostrando datos viejos para
// siempre y nadie se entera. Cada minuto se revisa cuándo llegó el último dato y,
// si pasaron más de 5, se vuelve a suscribir — eso además trae el estado actual
// de una, así la pantalla se pone al día sola.
let _vigilanteTI=null;
// Al volver a la pestaña (o al despertar el equipo) se revisa enseguida: es
// justo cuando el stream suele haber quedado colgado.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible')return;
  if(PRACTICE_MODE||!fbReady||!DATA.event)return;
  if(Date.now()-(_lastFbUpdate||0)>60000){
    _lastFbUpdate=Date.now();
    try{ startFBSync(); }catch(e){}
  }
});
// Práctica ficticia + espectador: nunca inicia Firebase. Práctica con NÓMINA REAL
// (&real=1): sí inicia Firebase, pero de SOLO LECTURA (el candado de initFB bloquea
// toda escritura). El espectador de práctica lee del localStorage, no necesita FB.
if(!PRACTICE_MODE || (PRACTICE_REAL && !PRACTICE_VIEWER))initFB();
const LIFTS=['sq','bp','dl'],LIFT_N={sq:'SQUAT',bp:'BENCH PRESS',dl:'DEADLIFT'},LIFT_S={sq:'SQ',bp:'BP',dl:'DL'},LIFT_C={sq:'#4A90E2',bp:'#9C7CF4',dl:'#D46BC7'};
// Tandas de la A a la Z. Antes llegaban hasta la F y un Regional con tres tandas
// en la mañana, dos en la tarde y dos al otro día ya se quedaba sin letras.
const FL_LETTERS=Array.from({length:26},(_,i)=>String.fromCharCode(65+i));
// Un color por tanda. Los seis primeros son los de siempre, para no cambiarle la
// referencia a nadie que ya conoce las pantallas; del resto se reparten los tonos
// por la rueda de color (ángulo áureo) para que dos tandas seguidas nunca se
// parezcan. Van en HEX porque en varios lugares se les pega la transparencia
// ('...22') al final, y con hsl() eso no es un color válido.
const FL_C=(function(){
  const c={A:'#3b82f6',B:'#f59e0b',C:'#22c55e',D:'#a855f7',E:'#ec4899',F:'#06b6d4'};
  const dosDig=n=>Math.round(n*255).toString(16).padStart(2,'0');
  const hsl=(h,s,l)=>{
    const a=s*Math.min(l,1-l);
    const f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};
    return '#'+dosDig(f(0))+dosDig(f(8))+dosDig(f(4));
  };
  for(let i=6;i<26;i++)c[FL_LETTERS[i]]=hsl((i*137.508)%360,.68,.60);
  return c;
})();
// ── TX Widget Color System ───────────────────────────────────────────
const _TX_COLOR_DEFAULTS={
  goodLift:    '#22c55e', // good attempt cell & GOOD LIFT slam
  noLift:      '#ef4444', // no lift attempt cell & NO LIFT slam
  puesto:      '#ffffff', // rank/position text (pos 4+)
  curAttempt:  '#2d4169', // current upcoming attempt cell bg
  nameBg:      '#D4A843', // name bar gradient start (scoreboard + profile)
  nameBg2:     '#c19735', // name bar gradient end
  nameText:    '#0A1628', // dark text on name bar
  accent:      '#D4A843', // borders, total cell, LB highlights
  headerBg:    '#1c324a', // scoreboard/LB header background
  gridBg:      '#0b1826', // attempt grid row background
  lbHighlight: '#6b1525', // current lifter row in leaderboard
  cardBg:      '#0d1e38', // leaderboard card background
};
const _TX_COLOR_PALETTES={
  yourlift:{
    label:'YourLift',desc:'Rojo · Dorado · Azul marino',
    preview:['#C41E3A','#D4A843','#0A1628','#22c55e','#ef4444'],
    colors:{goodLift:'#22c55e',noLift:'#ef4444',puesto:'#ffffff',
      curAttempt:'#0f2544',nameBg:'#D4A843',nameBg2:'#b8882e',
      nameText:'#0A1628',accent:'#D4A843',headerBg:'#0A1628',
      gridBg:'#0b1826',lbHighlight:'#C41E3A',cardBg:'#0d1e38'}
  },
  bandera:{
    label:'YourLift Bandera',desc:'Azul · Rojo · Blanco',
    preview:['#0A1628','#C41E3A','#ffffff','#22c55e','#ef4444'],
    colors:{goodLift:'#22c55e',noLift:'#ef4444',puesto:'#ffffff',
      curAttempt:'#122c52',nameBg:'#C41E3A',nameBg2:'#8B1525',
      nameText:'#ffffff',accent:'#ffffff',headerBg:'#0A1628',
      gridBg:'#0b1826',lbHighlight:'#C41E3A',cardBg:'#0d1e38'}
  },
  // Pensado para el Sudamericano en Chile: el fondo se queda en el azul marino de
  // YourLift —es lo que sostiene la identidad— y lo chileno entra donde más se
  // mira: la banda del nombre en el azul de la bandera, con el nombre en blanco.
  //
  // El acento va BLANCO y no rojo a propósito. El rojo de la bandera se parece
  // demasiado al rojo de NO LIFT, y en una transmisión ese color tiene que
  // significar una sola cosa: si además adorna, al marcar un nulo el ojo duda.
  // El rojo queda reservado; lo chileno lo llevan el azul y el blanco.
  suda:{
    label:'Sudamericano Chile',desc:'Azul bandera · Blanco',
    preview:['#0A1628','#0F3E9E','#ffffff','#22c55e','#ef4444'],
    colors:{goodLift:'#22c55e',noLift:'#ef4444',puesto:'#ffffff',
      curAttempt:'#12325f',nameBg:'#0F3E9E',nameBg2:'#092C77',
      nameText:'#ffffff',accent:'#ffffff',headerBg:'#0A1628',
      gridBg:'#081221',lbHighlight:'#0F3E9E',cardBg:'#0d1e38'}
  },
  pizarra:{
    // La que se estaba usando en transmisión: azul pizarra más claro que el marino,
    // el nombre en blanco sobre la misma barra (sin dorado) y el subrayado del
    // intento en curso en azul eléctrico.
    label:'Pizarra',desc:'Azul pizarra · Letras blancas',
    preview:['#2c4260','#1a2b45','#ffffff','#22c55e','#ef4444'],
    colors:{goodLift:'#22c55e',noLift:'#ef4444',puesto:'#ffffff',
      curAttempt:'#16283f',nameBg:'#31496b',nameBg2:'#25395a',
      nameText:'#ffffff',accent:'#2563eb',headerBg:'#1a2b45',
      gridBg:'#101f36',lbHighlight:'#2563eb',cardBg:'#1e3050'}
  },
  rojo:{
    label:'Rojo Intenso',desc:'Fondo rojo oscuro · Dorado',
    preview:['#C41E3A','#8B1525','#D4A843','#22c55e','#ef4444'],
    colors:{goodLift:'#22c55e',noLift:'#ef4444',puesto:'#ffffff',
      curAttempt:'#2d0a10',nameBg:'#C41E3A',nameBg2:'#8B1525',
      nameText:'#ffffff',accent:'#D4A843',headerBg:'#1a0608',
      gridBg:'#0f0306',lbHighlight:'#8B1525',cardBg:'#130408'}
  },
  classic:{
    label:'Clásico',desc:'Azul profundo · Dorado',
    preview:['#1c324a','#2d4169','#D4A843','#22c55e','#ef4444'],
    colors:{goodLift:'#22c55e',noLift:'#ef4444',puesto:'#ffffff',
      curAttempt:'#2d4169',nameBg:'#D4A843',nameBg2:'#c19735',
      nameText:'#0A1628',accent:'#D4A843',headerBg:'#1c324a',
      gridBg:'#0b1826',lbHighlight:'#6b1525',cardBg:'#0d1e38'}
  },
  negro:{
    label:'Negro',desc:'Puro negro · Dorado',
    preview:['#0d0d0d','#1c1c1c','#D4A843','#22c55e','#ef4444'],
    colors:{goodLift:'#22c55e',noLift:'#ef4444',puesto:'#ffffff',
      curAttempt:'#1c1c1c',nameBg:'#1a1a1a',nameBg2:'#111111',
      nameText:'#ffffff',accent:'#D4A843',headerBg:'#0d0d0d',
      gridBg:'#080808',lbHighlight:'#2a2a2a',cardBg:'#101010'}
  },
  azul:{
    label:'Azul',desc:'Azul competición · Dorado',
    preview:['#071428','#0f3a7a','#D4A843','#22c55e','#ef4444'],
    colors:{goodLift:'#22c55e',noLift:'#ef4444',puesto:'#ffffff',
      curAttempt:'#0a1f3d',nameBg:'#0f3a7a',nameBg2:'#0a2a5c',
      nameText:'#ffffff',accent:'#D4A843',headerBg:'#07101f',
      gridBg:'#050e1c',lbHighlight:'#0f3a7a',cardBg:'#071428'}
  },
};
let _txColorsLS={};
(()=>{try{_txColorsLS=JSON.parse(localStorage.getItem('fechipo_tx_colors')||'{}')}catch(e){_txColorsLS={}}})();
let _txProfileMediaType=(()=>{try{return localStorage.getItem('fechipo_tx_prof_media')||'foto'}catch(e){return 'foto'}})();
// Clave separada en modo práctica: así nunca lee ni pisa el estado guardado de
// una competencia real que esté abierta en el mismo navegador/dispositivo.
// Sandbox de práctica separado por tipo: la práctica con NÓMINA REAL usa su propia
// clave, así no se mezcla con la práctica ficticia (ni una pisa a la otra).
const SAVE_KEY=PRACTICE_REAL?'fechipo_lc3_practica_real':PRACTICE_MODE?'fechipo_lc3_practica':'fechipo_lc3';
// En modo práctica NO hay Firebase, así que la sincronización entre pestañas
// (Control en Vivo ↔ Pantalla de Tarima / Control TX) va por localStorage: la
// data por SAVE_KEY y el estado de la pantalla por PRACTICE_SCREEN_KEY. Además
// los links a widgets/pantalla deben arrastrar &practica=1 para no caer al
// evento real de Firestore.
const PRACTICE_SCREEN_KEY=PRACTICE_REAL?'fechipo_lc3_practica_real_screen':'fechipo_lc3_practica_screen';
const PRACTICE_Q=PRACTICE_MODE?'&practica=1':'';
const PLATES=[25,20,15,10,5,2.5,1.25,0.5,0.25];
const PLATE_C={25:'#ef4444',20:'#3b82f6',15:'#EFCB10',10:'#22c55e',5:'#888','2.5':'#ef4444','1.25':'#f59e0b','0.5':'#7c3aed','0.25':'#ec4899'};
const BAR=20,COLLARS=5;
// Del lado de la pantalla: escuchan las de tarima (?tx=…) siempre, y las demás
// solo si no operan. Un segundo operador en el mismo equipo tiene su propio
// estado y su propio camino a Firestore: no se le pisa nada.
(function(){
  const c=_canalLocal(); if(!c)return;
  c.onmessage=function(ev){
    const m=ev&&ev.data;
    if(!m||!m.doc||!DATA.event)return;
    if(!TX_MODE&&isAdmin&&window.IS_CONTROLLER)return;
    if(m.w===window._WRITER_ID)return;
    if(m.doc!==fbDocId())return;                 // otro campeonato u otra tarima
    const firma=()=>JSON.stringify(DATA.athletes||[])+'|'+DATA.lift+'|'+DATA.round+'|'+DATA.flight
      +'|'+(DATA.forcedCurrent==null?'':DATA.forcedCurrent)+'|'+JSON.stringify(DATA.compTimer||null);
    const antes=firma();
    // Se anota qué se aplicó y de quién: un snapshot de Firestore de ESE mismo
    // escritor con datos más viejos que esto no lo tiene que deshacer.
    window._localUlt={t:m.t,w:m.w};
    try{ DATA.athletes=_normExtraAtts(m.athletes||[]); }catch(e){ return; }
    window._NAV_REMOTA={lift:m.lift,round:m.round,flight:m.flight,forcedCurrent:m.forcedCurrent};
    if(!window.NAV_LIBRE){
      DATA.lift=m.lift||DATA.lift;
      DATA.round=(typeof m.round==='number')?m.round:DATA.round;
      DATA.flight=m.flight||DATA.flight;
      DATA.forcedCurrent=m.forcedCurrent||null;
    }
    DATA.changeTimers=m.changeTimers||{};
    DATA.compTimer=m.compTimer||null;
    DATA.lotsGenerated=!!m.lotsGenerated;
    if(firma()===antes)return;
    const f=document.activeElement;
    if(f&&(f.tagName==='INPUT'||f.tagName==='SELECT'||f.tagName==='TEXTAREA')){ window._renderPendiente=true; return; }
    try{ R(); }catch(e){}
  };
})();
let _syncTimer=null;
// ═══════════════════════════════════════════════════════════════════
// DESHACER / REHACER (Ctrl+Z / Ctrl+Y) — pila de estados de la competencia.
// Captura solo el estado "de tarima" (pesos, decisiones válido/nulo, ronda,
// lift, tanda, forzado, extra) — NO los cronómetros, para que el tic del reloj
// no ensucie el historial. Cada acción local que cambia ese estado empuja el
// estado ANTERIOR a la pila de deshacer y limpia la de rehacer.
// ═══════════════════════════════════════════════════════════════════
window._histUndo=[];
 window._histRedo=[];
 window._histCur=null;
window._histApplying=false;
const _HIST_MAX=10;
window.histUndo=function(){
  if(!window._histUndo.length){showToastLC('Nada para deshacer');return;}
  window._histRedo.push(window._histCur);
  const prev=window._histUndo.pop();
  window._histCur=prev;
  _histApply(prev);
  showToastLC('↶ Deshecho ('+window._histUndo.length+' más atrás · '+window._histRedo.length+' adelante)');
};
window.histRedo=function(){
  if(!window._histRedo.length){showToastLC('Nada para rehacer');return;}
  window._histUndo.push(window._histCur);
  const next=window._histRedo.pop();
  window._histCur=next;
  _histApply(next);
  showToastLC('↷ Rehecho ('+window._histUndo.length+' atrás · '+window._histRedo.length+' adelante)');
};
// Atajos de teclado: Ctrl/Cmd+Z = deshacer, Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z = rehacer.
// No dispara si se está escribiendo en un campo de texto.
document.addEventListener('keydown',(e)=>{
  if(typeof isAdmin!=='undefined' && !isAdmin)return;
  if(TX_MODE)return; // los widgets/pantalla no deshacen
  const t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
  const k=(e.key||'').toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'&&!e.shiftKey){e.preventDefault();window.histUndo();}
  else if((e.ctrlKey||e.metaKey)&&(k==='y'||(k==='z'&&e.shiftKey))){e.preventDefault();window.histRedo();}
});
// ═══════════════════════════════════════════════════════════════════
// MULTI-ESCRITOR: merge por-celda para que varios controladores (ej. la
// planilla cargando pesos + tú u otros marcando resultados o cargando pesos
// en otras casillas) NO se pisen. Cada edición local marca su "celda" con
// timestamp; cuando llega un snapshot de OTRO escritor, se absorben todos
// sus cambios EXCEPTO las celdas que toqué en los últimos HOLD ms (esas las
// conservo). Si conservé algo que difería del remoto, reenvío mi versión
// para que Firestore (y por lo tanto Control TX) converja con ambos cambios.
// ═══════════════════════════════════════════════════════════════════
window._recentAtt = window._recentAtt || {};
   // "athId|campo" -> ts
const _MERGE_HOLD_MS = 4000;
// Campos del atleta (todo lo que no son los intentos) que una edición reciente
// conserva frente a lo que llega del servidor. Van también los de identidad
// —nombre, división, categoría, sexo, club— porque una corrección de nómina
// hecha desde una pantalla se perdía sola: el merge partía del remoto y esos
// campos no estaban en la lista, así que el primer snapshot los devolvía.
const _MERGE_META_FIELDS=['bw','rackSQ','rackBP','sqAbat','bpSeg','bpPalm','mod','country',
  'flight','lot','bombed','weighedIn','jornada','name','nombreOrig','div','cat','sex','club','uni',
  // Las banderas de las modalidades combinadas: sin ellas, cambiar a "Classic +
  // Only Bench" o "Classic + Universitario" desde el pesaje no llegaba al resto.
  'plusBench','plusUni'];
// Ediciones locales todavía NO confirmadas en Firebase. A diferencia de
// _recentAtt (ventana de 4s para el merge de LECTURA), estas se conservan hasta
// que una escritura sale bien: así, con varios PCs operando, una edición mía
// nunca se pierde aunque el guardado tarde o haya que reintentar.
window._pendingEdits=new Set();
// Reenvío diferido: si el merge conservó ediciones mías que no estaban en el
// remoto, empujo mi versión para que Firestore quede con AMBOS cambios. Sale
// del handler de snapshot (por eso el setTimeout) y solo si soy controlador.
let _wbTimer=null;
// Discos de UN lado de la barra, de mayor a menor. Del 25 al 1.25 hay los que
// hagan falta; los fraccionarios, que se usan en intentos de récord o en pesos
// que no son múltiplo de 2.5, son los que trae el set: dos pares de 0.5 y un par
// de 0.25. Así, sobre 147.5: 148 lleva un 0.25 por lado, 148.5 un 0.5, 149 un
// 0.5 y un 0.25, y 149.5 los dos 0.5.
const _FRACCIONARIOS=[[0.5,2],[0.25,1]];
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleNav(false)});
// Ctrl+Shift+L abre el inicio de sesi\u00f3n del operador. Va por teclado y no por un
// bot\u00f3n porque el livecast lo proyecta el recinto: un "Iniciar sesi\u00f3n" a la vista
// del p\u00fablico no corresponde. Pero tiene que existir: si la sesi\u00f3n se vence en
// plena competencia, la pantalla deja de guardar sin avisar y hay que poder volver
// a entrar sin recargar ni salirse del sistema.
document.addEventListener('keydown',function(e){
  if(TX_MODE)return;
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(e.key||'').toLowerCase()==='l'){
    e.preventDefault();
    if(typeof openLoginModal==='function')openLoginModal();
  }
});
// ── LOGIN EN EL LIVECAST ──────────────────────────────────────────
// Mismas cuentas del panel admin (Firebase Auth). Evita tener que pasar por
// admin.html: el juez/controlador inicia sesión acá mismo. La verificación de
// rol la hace onAuthStateChanged (lee admins/{uid}) igual que siempre.
window.openLoginModal=function(){
  const ex=document.getElementById('lcLogin'); if(ex)ex.remove();
  const m=document.createElement('div'); m.id='lcLogin';
  m.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(4,10,20,.85);display:flex;align-items:center;justify-content:center;z-index:100001;padding:16px';
  m.innerHTML='<div style="background:#0D1F38;border:2px solid var(--gold);border-radius:14px;padding:24px;width:min(360px,94vw)">'
    +'<div style="font-family:Oswald;font-size:16px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:4px"><i class=yl-i-candado></i> INICIAR SESI\u00d3N</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:14px">Cuenta de administrador / juez (la misma del panel admin).</div>'
    +'<input id="lcLoginEmail" type="email" autocomplete="username" placeholder="Email" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:13px;margin-bottom:8px">'
    +'<input id="lcLoginPass" type="password" autocomplete="current-password" placeholder="Contrase\u00f1a" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:13px;margin-bottom:6px">'
    +'<div id="lcLoginErr" style="color:var(--red);font-size:11px;min-height:14px;margin-bottom:6px"></div>'
    +'<button onclick="doLcLogin()" style="width:100%;padding:11px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer">ENTRAR</button>'
    +'<button onclick="document.getElementById(\'lcLogin\').remove()" style="width:100%;margin-top:8px;padding:9px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:11px;cursor:pointer">Cancelar</button>'
    +'</div>';
  m.onclick=e=>{if(e.target===m)m.remove();};
  m.addEventListener('keydown',e=>{if(e.key==='Enter')doLcLogin();});
  document.body.appendChild(m);
  setTimeout(()=>{const e=document.getElementById('lcLoginEmail');if(e)e.focus();},50);
};
window.doLcLogin=async function(){
  const err=document.getElementById('lcLoginErr');
  const email=((document.getElementById('lcLoginEmail')||{}).value||'').trim();
  const pass=(document.getElementById('lcLoginPass')||{}).value||'';
  if(!email||!pass){if(err)err.textContent='Completa el correo y la contrase\u00f1a';return;}
  if(!fbReady||!window._fbAuth||!window._fbAuth.signInWithEmailAndPassword){if(err)err.textContent='Conectando con el servidor\u2026 prueba de nuevo en unos segundos';return;}
  try{
    if(err)err.textContent='';
    await window._fbAuth.signInWithEmailAndPassword(fbAuth,email,pass);
    const m=document.getElementById('lcLogin'); if(m)m.remove();
    showToastLC('Sesi\u00f3n iniciada');
  }catch(e){
    const code=(e&&e.code)||'';
    if(err)err.textContent=/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)?'Email o contrase\u00f1a incorrectos':'Error: '+(code||e.message);
  }
};
window.ensayoToggleRole=function(){
  if(!window._ensayoFree)return;
  if(isAdmin){isAdmin=false;DATA.phase='liveView';}
  else{isAdmin=true;if(DATA.phase==='liveView')DATA.phase='compete';}
  R();
};
let judgeMode=false,judgeLights={izq:null,central:null,der:null},judgeUnsub=null,_lastTimerSignal=0;
let RECORDS=null;
// ── Países (código IPF de 3 letras → ISO2 para bandera + nombre) ──────────────
// Para campeonatos internacionales (ej. Sudamericano). Default CHI.
const COUNTRY={
  CHI:['cl','Chile'], ARG:['ar','Argentina'], BRA:['br','Brasil'], URU:['uy','Uruguay'],
  PAR:['py','Paraguay'], PER:['pe','Perú'], BOL:['bo','Bolivia'], ECU:['ec','Ecuador'],
  COL:['co','Colombia'], VEN:['ve','Venezuela'], GUY:['gy','Guyana'], SUR:['sr','Surinam'],
  PAN:['pa','Panamá'], CRC:['cr','Costa Rica'], GUA:['gt','Guatemala'], MEX:['mx','México'],
  USA:['us','Estados Unidos'], CAN:['ca','Canadá'], ESP:['es','España'], POR:['pt','Portugal']
};
// Banderas dibujadas acá adentro, no traídas de un servidor externo.
// Antes venían de un servidor externo con tamaños fijos (h20, h40, h120…): el
// medallero pedía alturas que ese servicio no sirve, daba 404 y el país desaparecía
// de la pantalla sin dejar rastro. Son trece países más
// Estados Unidos, más los de FESUPO/IPF que aparecen de visita (Costa Rica, México,
// Panamá, Guatemala, España, Portugal, Canadá). Se dibujan simplificadas, que a 20 o
// 30 píxeles es lo que se lee.
const FLAG_SVG={
  CHI:'<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#D52B1E"/><rect width="10" height="10" fill="#0039A6"/><path d="M5 2.2l.9 2.7h2.9l-2.3 1.7.9 2.7L5 7.6 2.6 9.3l.9-2.7L1.2 4.9h2.9z" fill="#fff"/>',
  ARG:'<rect width="30" height="20" fill="#fff"/><rect width="30" height="6.7" fill="#74ACDF"/><rect y="13.3" width="30" height="6.7" fill="#74ACDF"/><g fill="#F6B40E"><path d="M16.57 9.34L18.1 10L16.57 10.66ZM16.7 9.99L17.86 11.19L16.19 11.21ZM16.58 10.64L17.19 12.19L15.64 11.58ZM16.21 11.19L16.19 12.86L14.99 11.7ZM15.66 11.57L15 13.1L14.34 11.57ZM15.01 11.7L13.81 12.86L13.79 11.19ZM14.36 11.58L12.81 12.19L13.42 10.64ZM13.81 11.21L12.14 11.19L13.3 9.99ZM13.43 10.66L11.9 10L13.43 9.34ZM13.3 10.01L12.14 8.81L13.81 8.79ZM13.42 9.36L12.81 7.81L14.36 8.42ZM13.79 8.81L13.81 7.14L15.01 8.3ZM14.34 8.43L15 6.9L15.66 8.43ZM14.99 8.3L16.19 7.14L16.21 8.81ZM15.64 8.42L17.19 7.81L16.58 9.36ZM16.19 8.79L17.86 8.81L16.7 10.01Z"/><circle cx="15" cy="10" r="1.7"/></g><circle cx="15" cy="10" r="1.7" fill="none" stroke="#C08A1E" stroke-width=".22"/>',
  BRA:'<rect width="30" height="20" fill="#009C3B"/><path d="M15 2.6L27.4 10 15 17.4 2.6 10z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.3" fill="#002776"/><g fill="#fff"><path d="M13.1 6.98L13.2 7.26L13.5 7.27L13.26 7.45L13.35 7.74L13.1 7.57L12.85 7.74L12.94 7.45L12.7 7.27L13 7.26ZM16.6 6.78L16.7 7.06L17 7.07L16.76 7.25L16.85 7.54L16.6 7.37L16.35 7.54L16.44 7.25L16.2 7.07L16.5 7.06ZM17.9 8.68L18 8.96L18.3 8.97L18.06 9.15L18.15 9.44L17.9 9.27L17.65 9.44L17.74 9.15L17.5 8.97L17.8 8.96ZM12.2 8.78L12.3 9.06L12.6 9.07L12.36 9.25L12.45 9.54L12.2 9.37L11.95 9.54L12.04 9.25L11.8 9.07L12.1 9.06ZM15.2 6.18L15.3 6.46L15.6 6.47L15.36 6.65L15.45 6.94L15.2 6.77L14.95 6.94L15.04 6.65L14.8 6.47L15.1 6.46ZM13.8 12.18L13.9 12.46L14.2 12.47L13.96 12.65L14.05 12.94L13.8 12.77L13.55 12.94L13.64 12.65L13.4 12.47L13.7 12.46ZM16.9 11.78L17 12.06L17.3 12.07L17.06 12.25L17.15 12.54L16.9 12.37L16.65 12.54L16.74 12.25L16.5 12.07L16.8 12.06ZM15 13.08L15.1 13.36L15.4 13.37L15.16 13.55L15.25 13.84L15 13.67L14.75 13.84L14.84 13.55L14.6 13.37L14.9 13.36Z"/></g><path d="M10.9 11.9Q15 14.3 19.1 9.6L19.1 8.7Q15 13.4 10.9 11z" fill="#fff"/>',
  URU:'<rect width="30" height="20" fill="#fff"/><g fill="#0038A8"><rect y="2.22" width="30" height="2.22"/><rect y="6.67" width="30" height="2.22"/><rect y="11.11" width="30" height="2.22"/><rect y="15.56" width="30" height="2.22"/></g><rect width="10" height="8.89" fill="#fff"/><g fill="#F6B40E"><path d="M6.8 3.79L8.05 4.3L6.8 4.81ZM6.9 4.29L7.86 5.24L6.51 5.23ZM6.8 4.79L7.33 6.03L6.09 5.5ZM6.53 5.21L6.54 6.56L5.59 5.6ZM6.11 5.5L5.6 6.75L5.09 5.5ZM5.61 5.6L4.66 6.56L4.67 5.21ZM5.11 5.5L3.87 6.03L4.4 4.79ZM4.69 5.23L3.34 5.24L4.3 4.29ZM4.4 4.81L3.15 4.3L4.4 3.79ZM4.3 4.31L3.34 3.36L4.69 3.37ZM4.4 3.81L3.87 2.57L5.11 3.1ZM4.67 3.39L4.66 2.04L5.61 3ZM5.09 3.1L5.6 1.85L6.11 3.1ZM5.59 3L6.54 2.04L6.53 3.39ZM6.09 3.1L7.33 2.57L6.8 3.81ZM6.51 3.37L7.86 3.36L6.9 4.31Z"/><circle cx="5.6" cy="4.3" r="1.3"/></g><circle cx="5.6" cy="4.3" r="1.3" fill="none" stroke="#C08A1E" stroke-width=".2"/>',
  PAR:'<rect width="30" height="6.7" fill="#D52B1E"/><rect y="6.7" width="30" height="6.6" fill="#fff"/><rect y="13.3" width="30" height="6.7" fill="#0038A8"/><circle cx="15" cy="10" r="2.05" fill="#fff" stroke="#0E7B34" stroke-width=".5"/><circle cx="15" cy="10" r="1.45" fill="#fff" stroke="#F5C518" stroke-width=".22"/><path d="M15 8.95L15.25 9.66L16 9.68L15.4 10.13L15.62 10.85L15 10.42L14.38 10.85L14.6 10.13L14 9.68L14.75 9.66Z" fill="#F5C518"/>',
  PER:'<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#D91023"/><rect x="20" width="10" height="20" fill="#D91023"/>',
  BOL:'<rect width="30" height="6.7" fill="#D52B1E"/><rect y="6.7" width="30" height="6.6" fill="#F9E300"/><rect y="13.3" width="30" height="6.7" fill="#007A33"/><g fill="#0E7B34"><ellipse cx="13.15" cy="10.5" rx=".72" ry=".28" transform="rotate(-38 13.15 10.5)"/><ellipse cx="16.85" cy="10.5" rx=".72" ry=".28" transform="rotate(38 16.85 10.5)"/><ellipse cx="13.4" cy="11.35" rx=".62" ry=".25" transform="rotate(-12 13.4 11.35)"/><ellipse cx="16.6" cy="11.35" rx=".62" ry=".25" transform="rotate(12 16.6 11.35)"/></g><path d="M13.35 8.6h3.3v1.6q0 1.75-1.65 2.5-1.65-.75-1.65-2.5z" fill="#EFE6CC" stroke="#6B4F1F" stroke-width=".22"/><circle cx="15" cy="9.5" r=".3" fill="#E8A33D"/><path d="M13.4 11.4q.5-1.3 1.6-1.85 1.1.55 1.6 1.85z" fill="#4E7FA8"/>',
  ECU:'<rect width="30" height="10" fill="#FFDD00"/><rect y="10" width="30" height="5" fill="#0072CE"/><rect y="15" width="30" height="5" fill="#D52B1E"/><path d="M12.25 8.25q1.4-1.5 2.45-.75l.3-.6.3.6q1.05-.75 2.45.75-1.2-.55-2.2-.1l-.55.45h-.4l-.55-.45q-1-.45-2.2.1z" fill="#2E2E2E"/><path d="M13.3 8.85h3.4v1.9q0 2-1.7 2.85-1.7-.85-1.7-2.85z" fill="#BFDCF4" stroke="#8A6A28" stroke-width=".2"/><circle cx="15" cy="9.5" r=".33" fill="#F6B40E"/><path d="M13.3 11.35h3.4q0 1.65-1.7 2.45-1.7-.8-1.7-2.45z" fill="#12539B"/><path d="M13.55 11.35q.35-1.15 1.45-1.75 1.1.6 1.45 1.75z" fill="#8C9BA8"/><path d="M14.35 11.35q.2-.65.65-.95.45.3.65.95z" fill="#fff"/>',
  COL:'<rect width="30" height="10" fill="#FCD116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#CE1126"/>',
  VEN:'<rect width="30" height="6.7" fill="#FFCC00"/><rect y="6.7" width="30" height="6.6" fill="#00247D"/><rect y="13.3" width="30" height="6.7" fill="#CF142B"/><path d="M11.2 9.36L11.37 9.85L11.89 9.86L11.48 10.17L11.63 10.66L11.2 10.37L10.78 10.66L10.93 10.17L10.52 9.86L11.03 9.85ZM12 8.3L12.17 8.79L12.68 8.8L12.27 9.11L12.42 9.6L12 9.31L11.57 9.6L11.72 9.11L11.31 8.8L11.83 8.79ZM13.08 7.53L13.25 8.02L13.76 8.03L13.35 8.34L13.5 8.84L13.08 8.54L12.65 8.84L12.8 8.34L12.39 8.03L12.91 8.02ZM14.34 7.13L14.51 7.62L15.02 7.63L14.61 7.94L14.76 8.43L14.34 8.14L13.91 8.43L14.06 7.94L13.65 7.63L14.17 7.62ZM15.66 7.13L15.83 7.62L16.35 7.63L15.94 7.94L16.09 8.43L15.66 8.14L15.24 8.43L15.39 7.94L14.98 7.63L15.49 7.62ZM16.92 7.53L17.09 8.02L17.61 8.03L17.2 8.34L17.35 8.84L16.92 8.54L16.5 8.84L16.65 8.34L16.24 8.03L16.75 8.02ZM18 8.3L18.17 8.79L18.69 8.8L18.28 9.11L18.43 9.6L18 9.31L17.58 9.6L17.73 9.11L17.32 8.8L17.83 8.79ZM18.8 9.36L18.97 9.85L19.48 9.86L19.07 10.17L19.22 10.66L18.8 10.37L18.37 10.66L18.52 10.17L18.11 9.86L18.63 9.85Z" fill="#fff"/>',
  GUY:'<rect width="30" height="20" fill="#009E49"/><path d="M0 0l22 10L0 20z" fill="#FCD116"/><path d="M0 0l12 10L0 20z" fill="#CE1126"/>',
  SUR:'<rect width="30" height="20" fill="#377E3F"/><rect y="4.4" width="30" height="11.2" fill="#fff"/><rect y="6.7" width="30" height="6.6" fill="#B40A2D"/><path d="M15 7.2l.85 2.6h2.75l-2.2 1.6.83 2.6L15 12.4l-2.23 1.6.83-2.6-2.2-1.6h2.75z" fill="#FCD116"/>',
  CRC:'<rect width="30" height="20" fill="#0033A0"/><rect y="3.33" width="30" height="13.34" fill="#fff"/><rect y="6.67" width="30" height="6.66" fill="#CE1126"/><ellipse cx="11" cy="10" rx="1.5" ry="1.9" fill="#fff" stroke="#0033A0" stroke-width=".22"/><path d="M9.9 11.1l1.1-1.6 1.1 1.6z" fill="#4E7FA8"/>',
  PAN:'<rect width="30" height="20" fill="#fff"/><rect x="15" width="15" height="10" fill="#D21034"/><rect y="10" width="15" height="10" fill="#005293"/><path d="M7.5 2.6l.75 2.3h2.4l-1.95 1.4.75 2.3-1.95-1.4-1.95 1.4.75-2.3L4.35 4.9h2.4z" fill="#005293"/><path d="M22.5 12.6l.75 2.3h2.4l-1.95 1.4.75 2.3-1.95-1.4-1.95 1.4.75-2.3-1.95-1.4h2.4z" fill="#D21034"/>',
  MEX:'<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#006847"/><rect x="20" width="10" height="20" fill="#CE1126"/><g fill="#7B4B1E"><path d="M14.05 9.9q.95-1.6 1.9 0-.95.95-1.9 0z"/><path d="M15 8.55q.6.4.3 1.1-.6-.35-.3-1.1z"/></g><path d="M13.3 11q1.7 1.35 3.4 0" fill="none" stroke="#3E7B31" stroke-width=".4"/><path d="M13.95 10.75q1.05.85 2.1 0" fill="none" stroke="#B03A2E" stroke-width=".28"/>',
  GUA:'<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#4997D0"/><rect x="20" width="10" height="20" fill="#4997D0"/><g fill="none" stroke="#4E7A2A" stroke-width=".38" stroke-linecap="round"><path d="M13.5 11.5q1.5-2.9 3 0"/></g><path d="M13.9 9.6h2.2v.5h-2.2z" fill="#8FA6B2"/><path d="M15 8.5q.5.6 0 1.1-.5-.5 0-1.1z" fill="#4E7A2A"/>',
  ESP:'<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/><g fill="#C8940A"><rect x="7.9" y="7.2" width=".5" height="3.9"/><rect x="11.6" y="7.2" width=".5" height="3.9"/></g><path d="M8.5 7.25h3q.35-1.15-1.5-1.15-1.85 0-1.5 1.15z" fill="#E8B923" stroke="#8A6A28" stroke-width=".18"/><path d="M8.55 7.55h2.9v2.05q0 1.55-1.45 2.15-1.45-.6-1.45-2.15z" fill="#AD1519" stroke="#8A6A28" stroke-width=".2"/><path d="M8.55 9.05h2.9M10 7.55v3.9" stroke="#F1BF00" stroke-width=".28"/>',
  POR:'<rect width="30" height="20" fill="#DA291C"/><rect width="12" height="20" fill="#046A38"/><circle cx="12" cy="10" r="3.3" fill="#FFE900"/><g fill="none" stroke="#C8940A" stroke-width=".28"><circle cx="12" cy="10" r="3.3"/><ellipse cx="12" cy="10" rx="1.5" ry="3.3"/><path d="M8.7 10h6.6"/></g><path d="M10.4 7.9h3.2v2.7q0 1.6-1.6 2.2-1.6-.6-1.6-2.2z" fill="#fff" stroke="#DA291C" stroke-width=".45"/><g fill="#001489"><circle cx="12" cy="9.3" r=".28"/><circle cx="11.2" cy="10.2" r=".28"/><circle cx="12.8" cy="10.2" r=".28"/><circle cx="12" cy="11.1" r=".28"/><circle cx="12" cy="10.2" r=".28"/></g>',
  CAN:'<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#D80621"/><rect x="22.5" width="7.5" height="20" fill="#D80621"/><path d="M15 4.4l1.1 2.6 2.4-1-1.1 2.7 2.3.6-2.1 1.6.6 1.5-2.5-.5.2 2.7h-1.8l.2-2.7-2.5.5.6-1.5-2.1-1.6 2.3-.6L11.5 6l2.4 1z" fill="#D80621"/>',
  USA:'<rect width="30" height="20" fill="#fff"/><g fill="#B22234"><rect width="30" height="1.54"/><rect y="3.08" width="30" height="1.54"/><rect y="6.15" width="30" height="1.54"/><rect y="9.23" width="30" height="1.54"/><rect y="12.31" width="30" height="1.54"/><rect y="15.38" width="30" height="1.54"/><rect y="18.46" width="30" height="1.54"/></g><rect width="12" height="10.77" fill="#3C3B6E"/><path d="M1.9 1.58L2.05 2L2.49 2.01L2.14 2.28L2.26 2.7L1.9 2.45L1.54 2.7L1.66 2.28L1.31 2.01L1.75 2ZM4.65 1.58L4.8 2L5.24 2.01L4.89 2.28L5.01 2.7L4.65 2.45L4.29 2.7L4.41 2.28L4.06 2.01L4.5 2ZM7.4 1.58L7.55 2L7.99 2.01L7.64 2.28L7.76 2.7L7.4 2.45L7.04 2.7L7.16 2.28L6.81 2.01L7.25 2ZM10.15 1.58L10.3 2L10.74 2.01L10.39 2.28L10.51 2.7L10.15 2.45L9.79 2.7L9.91 2.28L9.56 2.01L10 2ZM1.9 4.78L2.05 5.2L2.49 5.21L2.14 5.48L2.26 5.9L1.9 5.65L1.54 5.9L1.66 5.48L1.31 5.21L1.75 5.2ZM4.65 4.78L4.8 5.2L5.24 5.21L4.89 5.48L5.01 5.9L4.65 5.65L4.29 5.9L4.41 5.48L4.06 5.21L4.5 5.2ZM7.4 4.78L7.55 5.2L7.99 5.21L7.64 5.48L7.76 5.9L7.4 5.65L7.04 5.9L7.16 5.48L6.81 5.21L7.25 5.2ZM10.15 4.78L10.3 5.2L10.74 5.21L10.39 5.48L10.51 5.9L10.15 5.65L9.79 5.9L9.91 5.48L9.56 5.21L10 5.2ZM1.9 7.98L2.05 8.4L2.49 8.41L2.14 8.68L2.26 9.1L1.9 8.85L1.54 9.1L1.66 8.68L1.31 8.41L1.75 8.4ZM4.65 7.98L4.8 8.4L5.24 8.41L4.89 8.68L5.01 9.1L4.65 8.85L4.29 9.1L4.41 8.68L4.06 8.41L4.5 8.4ZM7.4 7.98L7.55 8.4L7.99 8.41L7.64 8.68L7.76 9.1L7.4 8.85L7.04 9.1L7.16 8.68L6.81 8.41L7.25 8.4ZM10.15 7.98L10.3 8.4L10.74 8.41L10.39 8.68L10.51 9.1L10.15 8.85L9.79 9.1L9.91 8.68L9.56 8.41L10 8.4Z" fill="#fff"/>',
};
// ── Conteo de atletas por campeonato (lista de elección) ─────────────────
// Ver el comentario donde se llama. El resultado vive en localStorage diez
// minutos: recargar la página, o abrir otra pestaña, no vuelve a contar.
const _CONTEO_TTL=10*60*1000;
// Colores de la bandera de cada país, para el fondo de la Pantalla de Tarima.
// Solo los que compiten en el Sudamericano: fuera de eso el fondo es el azul de
// YourLift. Van dos o tres colores por país, en el orden en que se leen en su
// bandera; se usan muy diluidos, así que no compiten con el texto de encima.
const BANDERA_COLORES={
  CHI:['#0039A6','#D52B1E'], ARG:['#74ACDF','#FFFFFF','#74ACDF'], BRA:['#009C3B','#FFDF00'],
  URU:['#0038A8','#FFFFFF'], PAR:['#D52B1E','#FFFFFF','#0038A8'], PER:['#D91023','#FFFFFF'],
  BOL:['#D52B1E','#F9E300','#007A33'], ECU:['#FFDD00','#0072CE','#D52B1E'],
  COL:['#FCD116','#003893','#CE1126'], VEN:['#FFCC00','#00247D','#CF142B'],
  GUY:['#009E49','#FCD116','#CE1126'], SUR:['#377E3F','#FFFFFF','#B40A2D'],
  USA:['#3C3B6E','#FFFFFF','#B22234'],
};
// ══════════════════════════════════════════════════════════════════
// RÉCORDS SUDAMERICANOS (FESUPO)
// records_suda.json trae los 997 récords oficiales con la clave
//   sexo|equipo|division|categoria|movimiento   (mov: sq bp dl total bpsl)
// 'bpsl' es la banca de Only Bench, que tiene récord propio y distinto del
// press de banca dentro del powerlifting.
//
// Un atleta puede batir el récord de SU división y además el OPEN (criterio IPF:
// el Open está abierto a todas las edades), así que siempre se chequean las dos.
// Los universitarios no tienen récord propio en FESUPO: se comparan solo contra
// el Open. Special Olympics no tiene tabla de récords.
// ══════════════════════════════════════════════════════════════════
let RECSUDA=null;
// Qué categorías se compiten en cada división, sacado de la MISMA tabla de
// récords. No todas existen en todas: la -43 de mujeres y la -53 de hombres
// están solo en Sub-Junior y Junior; el Open arranca en -47 y en -59.
//
// Esto no era un detalle. A una subjunior de -43 se la medía también contra el
// récord Open de -43, que no existe; el sistema lo leía como "categoría sin
// récord cargado" y entonces CUALQUIER peso lo rompía: a González Morena y a
// Peralta les salían los nueve intentos marcados como récord.
//
// Se lee del archivo y no se escribe acá a mano para que, si FESUPO cambia las
// categorías, baste con cambiar el archivo de récords.
let _SR_CLASES=null;
// ── Récords MUNDIALES (IPF) ─────────────────────────────────────────
// Una capa ENCIMA de la sudamericana, que no la toca: records_mundiales.json
// (herramientas/build_records_mundiales.py, desde los PDF de goodlift.info) tiene la misma
// clave que records_suda.json. Solo se mira cuando el intento ya es récord
// sudamericano —una marca mundial siempre lo es— y lo único que cambia es que el
// cartel dice MUNDIAL. Si el archivo no está o no trae la categoría (hoy tiene
// solo hombres classic), todo queda exactamente como antes.
let RECMUNDIAL=null;
// Timer de cambio (60s tras marcar un intento) — APAGADO por defecto.
// El operador lo prende desde Control en Vivo si lo necesita. Con él apagado,
// las celdas no muestran el reloj y se carga el próximo peso directo.
window._CT_ENABLED = localStorage.getItem('yl_ct')==='1';
window.toggleChangeTimers=function(){
  window._CT_ENABLED=!window._CT_ENABLED;
  try{localStorage.setItem('yl_ct', window._CT_ENABLED?'1':'0')}catch(e){}
  if(!window._CT_ENABLED) DATA.changeTimers={}; // limpiar los timers activos al apagar
  if(typeof saveNow==='function')saveNow();
  if(typeof R==='function')R();
};
// Auto-relleno del próximo intento al vencer el tiempo de cambio — switch
// aparte, APAGADO por defecto, solo tiene efecto si el timer de cambio
// (_CT_ENABLED) también está prendido. Nulo → mismo peso. Válido → +2.5kg.
window._CT_AUTOFILL_ENABLED = localStorage.getItem('yl_ct_autofill')==='1';
window.toggleChangeTimerAutofill=function(){
  window._CT_AUTOFILL_ENABLED=!window._CT_AUTOFILL_ENABLED;
  try{localStorage.setItem('yl_ct_autofill', window._CT_AUTOFILL_ENABLED?'1':'0')}catch(e){}
  if(typeof R==='function')R();
};
// Canal en que se está escuchando a los jueces. Si cambia el campeonato cambia
// el canal, y hay que volver a engancharse (ver R()).
let _judgeDoc=null,_timerUnsub=null;
// ── Las luces quedan anotadas en el intento ────────────────
//
// Las luces de los jueces son de paso: el documento guarda solo las de ahora y a
// los cinco segundos se borra. Para poder mostrar después qué luces recibió el
// primer intento cuando el atleta ya va por el segundo, hay que anotarlas en el
// propio intento en el momento en que llegan.
//
// Esto NO da válido ni nulo. El resultado lo sigue dando el operador en Control
// en Vivo o en la planilla: acá solo se guarda lo que marcaron los jueces, igual
// que queda guardado el peso.
//
// El atleta al que se le anotan se fija con la PRIMERA luz, no con la tercera.
// Si no, alcanzaba con que el operador marcara el resultado antes de que votara
// el tercer juez para que las luces terminaran anotadas en el atleta siguiente.
let _lucesHistUnsub=null,_lucesHistDestino=null,_lucesHistUlt='',_lucesHistDoc=null;
// Le dice al teléfono de los jueces quién está en la barra y qué movimiento es.
//
// Antes esto viajaba SOLO dentro de resetJudgeLights(), que corre nada más si el
// modo jueces está encendido. Como no se usa, el dato nunca salía: el panel del
// juez mostraba el bloque de motivos de nulo vacío, que es justo lo que tiene que
// leer antes de apretar rojo.
//
// Va con merge y solo escribe los datos del atleta: no toca los votos ni el
// reset, así que no puede apagarle una luz a nadie a mitad de un intento. Y solo
// escribe cuando de verdad cambió el atleta, el movimiento o el intento — si no,
// sería una escritura por cada dibujado.
let _juezUltAtleta='';
// Update judge info when timer starts


// ── Category BW limits ─────────────────────────────────────
const CAT_LIMITS={"47":47,"52":52,"57":57,"63":63,"69":69,"76":76,"84":84,"53":53,"59":59,"66":66,"74":74,"83":83,"93":93,"105":105,"120":120};
// ── Foto / GIF persistente por atleta (se guarda y se reutiliza si vuelve) ──────
// Clave estable: RUT si tiene; si no, país + nombre normalizado. Se guarda en
// Firestore atleta_fotos/<clave> (reusa colección existente, lectura pública) y
// los archivos en Storage athlete_photos/ y athlete_gifs/ (reusa paths existentes).
window._LC_MEDIA = window._LC_MEDIA || {};
// Fotos subidas desde Admin (inscripción/panel "Fotos Atletas") — quedan en el
// mismo doc atleta_fotos/{codigo} pero con id que NO empieza con 'lc_', y traen
// el RUT del atleta como campo. Se indexan acá por RUT para poder mostrarlas
// en Control TX / Perfil aunque livecast nunca haya subido nada por su cuenta.
window._ADMIN_FOTOS_BY_RUT = window._ADMIN_FOTOS_BY_RUT || {};
// ── Fotos de la nómina del Sudamericano ───────────────────────────
// Se cargaron desde Admin → Fotos Sudamericano a la colección nomina_suda_fotos,
// con el nombre del atleta como clave (los extranjeros no tienen RUT ni código en
// YourLift, así que por ahí no se les encuentra). Acá se leen igual para que el
// perfil y Control TX muestren la foto de cualquiera, chileno o no.
window.NSUDA_FOTOS_LC=window.NSUDA_FOTOS_LC||{};
// ── Marcas nominadas ────────────────────────────────────────────────────────
// A un extranjero no se le puede mostrar historial: no está en el padrón chileno
// y su carrera vive en la federación de su país. Pero la nómina oficial sí trae
// con qué marcas lo inscribieron, y eso es información real y útil —es lo que va
// a intentar— así que la ficha las muestra en vez de quedarse en blanco.
//
// Se rotulan NOMINADAS a propósito: no son marcas hechas en competencia ni
// récords, son lo que declaró su federación al inscribirlo. Confundir una cosa
// con la otra sería peor que no mostrar nada.
//
// La nómina se baja una sola vez y recién cuando hace falta: son 190 KB y a la
// mayoría de las pantallas no le sirven.
window.NSUDA_MARCAS=window.NSUDA_MARCAS||null;
let _nsudaMarcasPidiendo=false;
// Borra el pesaje del atleta: BW, racks y todos los intentos (vuelve a "sin pesar")
window.clearWeighIn = function(id){
  const a = DATA.athletes.find(x=>x.id===id);
  if(!a) return;
  const msg = `¿Borrar el pesaje de ${a.name}?\n\nSe borrarán:\n• Peso corporal (BW)\n• Alturas de rack (SQ y BP)\n• Todos los intentos cargados\n\nEsto NO borra al atleta del evento. Solo le reinicia el pesaje.`;
  if(!confirm(msg)) return;
  a.bw = 0;
  a.rackSQ = '';
  a.rackBP = '';
  a.sqAbat = ''; a.bpSeg = ''; a.bpPalm = '';
  a.weighedIn = false;
  _markAtt(id,'meta');
  // Limpiar intentos del atleta (pesos y resultados). Igual que en el confirmar:
  // sin marcar cada celda, el borrado no viajaba y el primer snapshot del
  // servidor le devolvía los intentos al atleta.
  ['sq','bp','dl'].forEach(l=>{
    if(a.att && a.att[l]){
      a.att[l].forEach((at,r)=>{at.w=0; at.r=null; _markAtt(id,'att_'+l+'_'+r);});
    }
  });
  // Limpiar cualquier change timer activo del atleta
  Object.keys(DATA.changeTimers).forEach(k=>{
    if(k.startsWith(id+'_')) delete DATA.changeTimers[k];
  });
  saveNow();
  const modal = document.getElementById('weighInModal');
  if(modal) modal.remove();
  R();
  showToastLC('Pesaje borrado: '+a.name);
};
// El Cronograma ahora puede traer el DÍA además de la jornada (campeonatos de dos
// o más días, como el Regional Norte). Viajan juntos en la misma etiqueta —
// "Día 1 · AM" — porque `jornada` solo se muestra, no se compara con nada.
const _cronoJor=r=>[r.dia,r.jornada].map(x=>String(x||'').trim()).filter(Boolean).join(' · ');
// Divisiones válidas. Si el Cronograma trae algo que no está en la lista (un error de
// tipeo como "Subunior") NO se pisa lo que ya tiene el atleta: mejor dejarlo como está
// que meterle una división inventada a la nómina.
const _CRONO_DIVS=['Sub-Junior','Junior','Open','Master I','Master II','Master III','Master IV'];
// Suscripción en vivo al Cronograma (además del getDoc puntual de arriba, usado para la
// carga inicial). Un doc, se reescribe poco (solo cuando el admin edita el Cronograma), así
// que el costo extra en Firestore es despreciable — y evita el bug de tandas desactualizadas
// si el Cronograma se sigue ajustando DESPUÉS de abrir el evento en YourLift, sin tener que
// acordarse de tocar "Re-sincronizar nómina" cada vez.
let _cronoFlightUnsub=null;
window.isDQ=isDQ;
window.recargarNomina=async function(){
  if(!isAdmin){alert('Solo un admin puede volver a cargar la n\u00f3mina');return}
  if(!DATA.event){alert('No hay campeonato activo');return}
  if(!fbReady){
    alert('Sin conexi\u00f3n con el servidor.\n\nNo se carg\u00f3 nada: si cambiara la n\u00f3mina solo en esta pantalla, quedar\u00eda distinta del resto.');
    return;
  }
  if(!window.IS_CONTROLLER){
    if(!confirm('Esta pantalla est\u00e1 en modo ESPECTADOR: no puede guardar en el servidor.\n\n\u00bfCambiarla a CONTROLADOR y continuar?'))return;
    setSyncMode(true);
  }
  let ev;
  try{
    const j=await fetch('nominas.json',{cache:'no-cache'}).then(r=>r.json());
    const le=DATA.event;
    ev=(j.events||[]).find(e=>(le.id&&String(e.id)===String(le.id))||(le.name&&e.name===le.name));
  }catch(e){ alert('No se pudo leer la n\u00f3mina: '+(e.message||e)); return; }
  if(!ev||!Array.isArray(ev.athletes)||!ev.athletes.length){
    alert('Este campeonato no tiene su n\u00f3mina en el archivo.\n\nLos que se arman con inscripciones se actualizan solos desde el panel; esto es para los que traen la n\u00f3mina en nominas.json, como el Sudamericano.');
    return;
  }
  const cronoKey='fechipo_crono_'+(ev.name||'').replace(/\s+/g,'_');
  let flightMap=null;
  try{const s=localStorage.getItem(cronoKey);if(s){const dd=JSON.parse(s);if(dd.map)flightMap=dd.map}}catch(e){}
  const nuevos=ev.athletes.map((a,j)=>_evAthlete(a,j,flightMap));

  // El cruce va por nombre: el lote puede haber cambiado, y el id se reparte al
  // leer el archivo, as\u00ed que ninguno de los dos identifica a una persona.
  const viejosPorN={}; (DATA.athletes||[]).forEach(a=>{ viejosPorN[_nnCrono(a.name)]=a; });
  const nuevosN=new Set(nuevos.map(a=>_nnCrono(a.name)));
  const cargado=a=>!!(a.bw||a.bombed||['sq','bp','dl'].some(l=>(a.att&&a.att[l]||[]).some(x=>x&&x.w)));
  const entran=nuevos.filter(a=>!viejosPorN[_nnCrono(a.name)]);
  const salen=(DATA.athletes||[]).filter(a=>!nuevosN.has(_nnCrono(a.name)));
  const salenConDatos=salen.filter(cargado);
  if(!entran.length&&!salen.length){
    if(!confirm('La n\u00f3mina del archivo tiene a los mismos '+nuevos.length+' atletas.\n\nIgual se vuelven a leer tandas y lotes, por si alguno cambi\u00f3. \u00bfContinuar?'))return;
  }else{
    const lista=(t,arr)=>arr.length?('\n'+t+' ('+arr.length+'):\n'+arr.slice(0,12).map(a=>'  \u2022 '+a.name+(a.lot?' \u00b7 lote '+a.lot:'')).join('\n')+(arr.length>12?'\n  \u2026 y '+(arr.length-12)+' m\u00e1s':'')+'\n'):'';
    let msg='VOLVER A CARGAR LA N\u00d3MINA de:\n"'+(ev.name||'')+'"\n'
      +'\nQuedan '+nuevos.length+' atletas (ahora hay '+(DATA.athletes||[]).length+').\n'
      +lista('ENTRAN',entran)+lista('SALEN',salen)
      +'\nSE CONSERVA de los que siguen: peso corporal, racks, intentos y bombed.'
      +'\nSE VUELVE A LEER del archivo: tanda, lote, categor\u00eda, divisi\u00f3n y club.'
      +'\n\nEsto sobreescribe el servidor para todos los dispositivos y widgets.';
    if(salenConDatos.length){
      msg+='\n\nOJO: '+salenConDatos.length+' de los que salen YA TIENEN datos cargados ('
        +salenConDatos.slice(0,5).map(a=>a.name).join(', ')+(salenConDatos.length>5?'\u2026':'')
        +'). Si sacarlos no es lo que quieres, cancela.';
    }
    if(!confirm(msg))return;
  }
  const CONSERVAR=['bw','rackSQ','rackBP','bombed','att'];
  let heredados=0;
  nuevos.forEach(a=>{
    const v=viejosPorN[_nnCrono(a.name)];
    if(!v)return;
    if(cargado(v))heredados++;
    CONSERVAR.forEach(f=>{ if(v[f]!==undefined) a[f]=JSON.parse(JSON.stringify(v[f])); });
  });
  DATA.athletes=nuevos;
  // Los ids se reparten de nuevo, as\u00ed que cualquier marca de "edit\u00e9 esto reci\u00e9n"
  // apuntar\u00eda a otra persona.
  try{ window._recentAtt={}; if(window._pendingEdits)window._pendingEdits.clear(); }catch(e){}
  const flAct=[...new Set(DATA.athletes.map(a=>a.flight))].filter(_inTarima).sort(_cmpFl);
  if(flAct.length&&flAct.indexOf(DATA.flight)<0)DATA.flight=flAct[0];
  // Escritura autoritativa: reemplaza el documento remoto. Con un merge normal,
  // el servidor devolver\u00eda a los que acaban de salir.
  window._forceFullWrite=true;
  saveNow();
  R();
  _confirmarPublicado(
    ()=>alert('N\u00f3mina al d\u00eda: '+DATA.athletes.length+' atletas'
        +(entran.length?' \u00b7 '+entran.length+' entran':'')
        +(salen.length?' \u00b7 '+salen.length+' salen':'')
        +(heredados?'\n\nSe conservaron los datos de tarima de '+heredados+' atleta'+(heredados>1?'s':'')+'.':'')),
    ()=>alert('La n\u00f3mina se carg\u00f3 en ESTA pantalla pero NO se pudo guardar en el servidor.\n\nEl p\u00fablico y los widgets siguen con la anterior. Revisa el indicador SYNC y vuelve a intentar.'));
};
const ctIntervals={};
// Master tick: updates ALL change timers every second, no matter which tab
setInterval(()=>{
  let changed=false;
  let anyActive=false;
  // Solo se fuerza un re-render completo si el auto-relleno cambió un peso (aparecen
  // botones nuevos en la celda que el parche in-place no puede armar solo). Un timer que
  // simplemente vence (sin auto-relleno) NO dispara re-render — su celda y su fila en
  // "timers activos" ya se actualizan en el bloque de abajo sin tocar el resto de la
  // página. Esto es a propósito: con varios timers corriendo a la vez (3, 4, 5...) no
  // puede estar refrescando la pantalla completa cada vez que uno vence.
  let needsRerender=false;
  Object.keys(DATA.changeTimers).forEach(k=>{
    const ct=DATA.changeTimers[k];if(!ct||ct.expired)return;
    // Se recalcula desde startedAt (reloj real) en vez de restar 1 por tick — así el
    // conteo nunca se desincroniza aunque el tab haya estado bloqueado (ej. mientras
    // estaba abierto el prompt() para cargar un peso) o en segundo plano. Con varios
    // timers corriendo a la vez esto tiene que dar siempre el valor correcto.
    if(typeof ct.startedAt!=='number')ct.startedAt=Date.now()-((60-(ct.remaining||60))*1000);
    ct.remaining=Math.max(0,60-Math.floor((Date.now()-ct.startedAt)/1000));
    anyActive=true;
    const justExpired=ct.remaining<=0;
    if(justExpired){ct.expired=true;changed=true;}
    // Update manage tab element
    const el=document.getElementById('ct_'+k);
    if(el){
      if(ct.expired){el.textContent='0s';el.className='inp-sm expired';el.style.borderColor='var(--red)'}
      else{el.textContent=ct.remaining+'s';el.className='inp-sm countdown'}
    }
    // Update compete tab element
    const el2=document.getElementById('cct_'+k);
    if(el2){
      const parts=k.split('_');const aId=parseInt(parts[0]);const lift=parts[1];const rnd=parseInt(parts[2]);
      const a=DATA.athletes.find(x=>x.id===aId);const nm=a?a.name:'';
      if(ct.expired){el2.innerHTML='<i class=yl-i-reloj></i> <strong>'+nm+'</strong> \u2014 '+LIFT_S[lift]+(rnd+1)+' \u2014 TIEMPO';el2.style.color='var(--red)'}
      else{el2.innerHTML='<i class=yl-i-reloj></i> <strong>'+nm+'</strong> \u2014 '+LIFT_S[lift]+(rnd+1)+' \u2014 '+ct.remaining+'s para entregar intento';el2.style.color='var(--orange)'}
    }
    // On expiry: flash alert banner + beep
    if(justExpired){
      const parts=k.split('_');const aId=parseInt(parts[0]);const lift=parts[1];const rnd=parseInt(parts[2]);
      const a=DATA.athletes.find(x=>x.id===aId);
      showChangeExpiredAlert(a?a.name:'Atleta',lift,rnd);
      // Auto-relleno del próximo intento al vencer el tiempo (switch aparte,
      // apagado por defecto). "rnd" es la ronda PENDIENTE de peso (se crea
      // el timer como id_lift_(r+1) al marcar la ronda anterior "r").
      // Nulo → mismo peso. Válido → +2.5kg.
      if(window._CT_AUTOFILL_ENABLED && a && rnd>=1 && rnd<=2){
        const prev=a.att[lift][rnd-1], next=a.att[lift][rnd];
        if(prev && prev.r && prev.w>0 && next && !next.w){
          next.w=prev.r==='n'?prev.w:Math.round((prev.w+2.5)*2)/2;
          changed=true;
          needsRerender=true;
          (showToastLC==null?void 0:showToastLC(''+a.name+' — '+LIFT_S[lift]+(rnd+1)+' auto-rellenado: '+next.w+'kg'));
        }
      }
    }
  });
  if(changed)save();
  // Actualizar las celdas de timer en la tabla de Control en Vivo SIN re-renderizar
  // (evita flicker). Cada celda con timer tiene id="ctcell_KEY".
  Object.keys(DATA.changeTimers).forEach(k=>{
    const ct=DATA.changeTimers[k];
    const cellEl=document.getElementById('ctcell_'+k);
    if(!cellEl)return;
    if(ct&&!ct.expired&&ct.remaining>0){
      cellEl.textContent=''+ct.remaining+'s';
    } else if(ct&&ct.expired){
      // Tiempo expirado → reloj rojo + signo de exclamación
      cellEl.textContent='TIEMPO';
      cellEl.style.background='rgba(239,68,68,.18)';
      cellEl.style.borderColor='var(--red)';
      cellEl.style.color='var(--red)';
      cellEl.style.animation='pulse 1.5s ease-in-out infinite';
      cellEl.title='Tiempo expirado — requiere aprobación del jurado';
    }
  });
  // ── Tiempo compensatorio (4º intento "se sigue a sí mismo") ──────────
  // Solo a la vista, NO bloquea. Se actualiza en Control en Vivo (#compTimerBox)
  // y en la Pantalla de Intentos (#compTimerPant) sin re-render. Puede pasar a
  // negativo (sigue mostrando, en rojo, para que se note que se pasó del tiempo).
  {
    const ci=_compInfo();
    ['compTimerBox','compTimerPant'].forEach(idEl=>{
      const el=document.getElementById(idEl);
      if(el&&ci)el.textContent=ci.mmss;
    });
  }
  // ── Timer de descanso ────────────────────────────────────────────────
  // La cuenta regresiva se parcha en su lugar, sin redibujar la pantalla: el
  // cartel puede estar puesto media hora y no tiene sentido rehacer la tabla de
  // jornada entera 1.800 veces. El redibujado completo se pide una sola vez,
  // cuando el cartel aparece o se va.
  if(TX_MODE==='screen'||TX_MODE==='jornada'){
    const dsc=(typeof _descInfo==='function')?_descInfo():null;
    const rel=document.getElementById('descRel');
    if(dsc&&rel){
      rel.textContent=dsc.mmss;
      rel.style.color=dsc.rem<=10?'#ef4444':dsc.rem<=30?'#f59e0b':'#ffffff';
      const pa=document.getElementById('descPausa');
      if(pa)pa.innerHTML=dsc.pausado?'PAUSADO':'';
    } else if((!!dsc)!==(!!rel)){
      // Apareció sin estar dibujado, o se fue y quedó el cartel: hay que redibujar.
      // Ojo con sacar la condición de arriba: en Control en Vivo no existe el
      // cartel, así que esta rama se cumpliría SIEMPRE y redibujaría la pantalla
      // entera una vez por segundo mientras dure el descanso.
      if(typeof renderTxWidget==='function')renderTxWidget();
    }
  }
  // Re-render completo SOLO si el auto-relleno cambió un peso (ver comentario arriba).
  if(needsRerender && DATA.phase==='compete' && typeof R==='function'){
    setTimeout(R,100);
  }
},1000);
let mainTI=null;
// Toggle manual del reloj de 1:00 (para iniciarlo cuando se va a tirar un intento
// extra, o pausarlo/reanudarlo cuando haga falta). Re-renderiza para actualizar el botón.
window.toggleMainTimer=function(){ if(DATA.timerOn)pauseTimer(); else startTimer(); R(); };
// Fuerza un intento específico como "el actual" en Control en Vivo, saltándose el orden
// automático de la cola — para corregir cuando se pasó por alto a un atleta. Cambia
// también DATA.flight/lift/round para que la tarjeta, Control TX y las luces de jueces
// sigan a este atleta. Se limpia solo apenas se marca GOOD/NO LIFT (ver overrideResult).
// Corregir el nombre de un atleta con la competencia andando.
//
// Llegan mal escritos desde la inscripción —falta un apellido, una letra
// cambiada, todo en mayúsculas— y ese nombre se ve en la tarima, en la
// transmisión y queda en el acta. Hasta ahora había que salir a Admin a
// arreglarlo mientras la competencia seguía.
//
// Corrige el nombre para ESTA competencia: la tarima, el acta, los widgets y el
// público lo ven al toque. No reescribe la inscripción ni la base de atletas —
// eso se sigue haciendo en Admin, con calma, después.
window.renameAthlete=function(id){
  const a=DATA.athletes.find(x=>x.id===id);
  if(!a)return;
  if(!isAdmin){showToastLC('Solo el que opera puede corregir el nombre');return;}
  const v=prompt('Nombre del atleta\n\nSe corrige en la tarima, el acta y la transmisión.\n(La inscripción en Admin no cambia.)',a.name||'');
  if(v===null)return;                       // canceló
  const nuevo=String(v).trim().replace(/\s+/g,' ');
  if(!nuevo){showToastLC('El nombre no puede quedar vacío');return;}
  if(nuevo===a.name)return;
  const antes=a.name;
  // El nombre con el que vino queda guardado: la sincronización reconoce a la
  // persona por su nombre, y sin esto la corrección parecía "otro atleta" y el
  // servidor le devolvía el nombre viejo en la siguiente escritura.
  if(!a.nombreOrig)a.nombreOrig=antes;
  a.name=nuevo;
  if('nombre' in a)a.nombre=nuevo;          // el campo con el que vino de la inscripción
  _markAtt(id,'meta');                      // edición mía: que el merge la respete
  saveNow();R();
  showToastLC('Nombre corregido: '+antes+' → '+nuevo);
};
window.forceCurrentAttempt=function(id,l,r){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  DATA.flight=a.flight;DATA.lift=l;DATA.round=r;DATA.forcedCurrent=id;
  save();R();
  showToastLC('Marcado como actual: '+a.name+' — '+LIFT_S[l]+(r+1));
};
// Añade un 4º intento a un lift de un atleta (índice 3). Se concede cuando el
// jurado otorga un intento compensatorio por un error ajeno (carga, equipo,
// cronómetro, arbitraje) — reglamento IPF. Cuenta para el mejor levantamiento
// igual que los otros (bestOf recorre todos los válidos). Solo un 4º por lift.
//   mode 'self'     → se sigue a sí mismo: el atleta repite enseguida. Se le da
//                     un tiempo compensatorio (0-5 min) que corre a la vista
//                     (NO bloquea el válido/nulo). Queda como "actual" en INT 4.
//   mode 'endround' → el 4º se toma al final de la ronda (uso IPF habitual).
window.add4thAttempt=function(id,l,mode){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(!a.att[l]){showToastLC('Lift inválido');return;}
  if(a.att[l].length>=4){showToastLC(a.name+' ya tiene un intento extra en '+LIFT_S[l]);window._attMenuOpen=null;R();return;}
  window._attMenuOpen=null;
  mode=(mode==='self')?'self':'endround';
  // Ventanita emergente para elegir el tiempo compensatorio a dar.
  _openCompModal(id,l,mode);
};
// Modal de tiempo compensatorio (ventanita emergente) al agregar un 4º intento.
//   'self'     → default 4 min (intento de récord, peso muerto 3ª ronda,
//                only bench 3ª ronda). El descanso compensatorio es completo.
//   'endround' → 4/3/2 min según posición (último/penúltimo/antepenúltimo),
//                porque el minuto normal de descanso ya está considerado.
window._openCompModal=function(id,l,mode){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  const ex=document.getElementById('compModal');if(ex)ex.remove();
  const m=document.createElement('div');m.id='compModal';
  m.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:100000;padding:16px';
  // Nombre según la ronda en que se concede: 3ª ronda = "4º intento"; 1ª/2ª = "intento extra".
  const grNow=(l===DATA.lift)?DATA.round:2;
  const nom=(grNow>=2)?'4º INTENTO':'INTENTO EXTRA';
  const title=mode==='self'?nom+' — SE SIGUE A SÍ MISMO':nom+' — AL FINAL DE LA RONDA';
  const desc=mode==='self'
    ?'Tiempo compensatorio de descanso completo (4 min por defecto).'
    :'El tiempo depende de la posición del atleta en la ronda (el minuto normal de descanso ya está considerado).';
  const opts=(mode==='self')
    ?[{min:4,label:'4 min · por defecto',def:true},{min:3,label:'3 min'},{min:2,label:'2 min'},{min:5,label:'5 min'},{min:0,label:'Sin tiempo compensatorio'}]
    :[{min:4,label:'Último de la ronda · 4 min',def:true},{min:3,label:'Penúltimo · 3 min'},{min:2,label:'Antepenúltimo · 2 min'},{min:0,label:'Sigue la competencia · sin tiempo'}];
  let h='<div style="background:#0D1F38;border:2px solid var(--gold);border-radius:14px;padding:22px 24px;width:min(460px,95vw)">';
  h+='<div style="font-family:Oswald;font-size:17px;font-weight:700;letter-spacing:1px;color:var(--gold)"><i class=yl-i-reloj></i> '+title+'</div>';
  h+='<div style="font-size:12px;color:var(--muted);margin:6px 0 14px;line-height:1.5"><b style="color:var(--text)">'+esc(a.name)+' · '+LIFT_S[l]+' — repite su '+['1er','2do','3er'][grNow]+' intento</b> — '+desc+'</div>';
  h+='<div style="font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-bottom:8px">TIEMPO COMPENSATORIO A DAR:</div>';
  h+='<div style="display:flex;flex-direction:column;gap:8px">';
  opts.forEach(o=>{
    h+='<button onclick="_confirmComp('+id+',\''+l+'\',\''+mode+'\','+o.min+')" style="padding:12px 16px;border-radius:10px;border:2px solid '+(o.def?'var(--gold)':'var(--border)')+';background:'+(o.def?'rgba(212,168,67,.12)':'transparent')+';color:'+(o.def?'var(--gold)':'var(--text)')+';font-family:Oswald;font-size:14px;font-weight:'+(o.def?700:600)+';cursor:pointer;text-align:left">'+o.label+'</button>';
  });
  h+='</div>';
  h+='<button onclick="document.getElementById(\'compModal\').remove()" style="width:100%;margin-top:14px;padding:10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:12px;cursor:pointer">Cancelar</button>';
  h+='</div>';
  m.innerHTML=h;
  m.onclick=function(e){if(e.target===m)m.remove();};
  document.body.appendChild(m);
};
window._confirmComp=function(id,l,mode,compMin){
  const m=document.getElementById('compModal');if(m)m.remove();
  _do4thAttempt(id,l,mode,compMin);
};
// Tiempo compensatorio MANUAL — para casos fuera de las dos opciones del 4º
// (ej. un atleta abre 1º y 2º de sentadilla seguidos → se le dan 4 min). No crea
// un 4º intento, solo arranca el cronómetro compensatorio para el atleta actual.
window.openManualComp=function(){
  const cur=liftQueue()[0];
  const who=cur||DATA.athletes.find(a=>a.flight===DATA.flight&&!a.bombed);
  if(!who){showToastLC('No hay atleta en tarima para asignarle tiempo');return;}
  const ex=document.getElementById('compModal');if(ex)ex.remove();
  const m=document.createElement('div');m.id='compModal';
  m.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:100000;padding:16px';
  let h='<div style="background:#0D1F38;border:2px solid var(--gold);border-radius:14px;padding:22px 24px;width:min(440px,95vw)">';
  h+='<div style="font-family:Oswald;font-size:17px;font-weight:700;letter-spacing:1px;color:var(--gold)"><i class=yl-i-reloj></i> TIEMPO COMPENSATORIO MANUAL</div>';
  h+='<div style="font-size:12px;color:var(--muted);margin:6px 0 14px;line-height:1.5"><b style="color:var(--text)">'+esc(who.name)+'</b> — para cuando le corresponde descanso extra sin ser un 4º intento (ej. abre dos intentos seguidos).</div>';
  h+='<div style="display:flex;flex-direction:column;gap:8px">';
  [{min:4,def:true},{min:3},{min:2},{min:1},{min:5}].forEach(o=>{
    h+='<button onclick="_startManualComp('+who.id+',\''+DATA.lift+'\','+o.min+')" style="padding:12px 16px;border-radius:10px;border:2px solid '+(o.def?'var(--gold)':'var(--border)')+';background:'+(o.def?'rgba(212,168,67,.12)':'transparent')+';color:'+(o.def?'var(--gold)':'var(--text)')+';font-family:Oswald;font-size:14px;font-weight:'+(o.def?700:600)+';cursor:pointer;text-align:left">'+o.min+' min</button>';
  });
  h+='</div>';
  h+='<button onclick="document.getElementById(\'compModal\').remove()" style="width:100%;margin-top:14px;padding:10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:12px;cursor:pointer">Cancelar</button>';
  h+='</div>';
  m.innerHTML=h;
  m.onclick=function(e){if(e.target===m)m.remove();};
  document.body.appendChild(m);
};
window._startManualComp=function(id,l,min){
  const m=document.getElementById('compModal');if(m)m.remove();
  DATA.compTimer={id:id,lift:l,min:Math.max(1,Math.min(5,min)),startedAt:Date.now()};
  saveNow();R();
  const a=DATA.athletes.find(x=>x.id===id);
  showToastLC(min+' min compensatorios para '+(a?a.name:'atleta'));
};
// Elimina el 4º intento de un lift (por si se agregó por error o el jurado lo
// revoca). Solo saca el índice 3, nunca los 3 base. Pide confirmación porque
// borra datos. El 4º vive dentro de su ronda concedida (no hay "INT 4"), así
// que basta con quitarlo del array; la cola deja de mostrarlo automáticamente.
// ── Sacar atletas que no son de este campeonato ────────────────────
// Si por un cruce de pantallas entraron atletas de OTRO evento (pasó entre el
// Sudamericano de prueba y el Regional Centro Sur), acá se sacan sin tener que
// abrir la consola. La referencia es el CRONOGRAMA del evento, que es la lista
// oficial de quién compite. No toca nada de los que sí corresponden: pesos,
// intentos, pesaje y racks quedan igual. Se deshace con Ctrl+Z.
window.limpiarAtletasAjenos=async function(){
  const map=window._cronoFlightMap;
  if(!map||!Object.keys(map).length){
    alert('No hay Cronograma cargado para este campeonato, así que no tengo con qué comparar.\n\n'
      +'Cárgalo en Admin → Cronograma y vuelve a entrar.');
    return;
  }
  const fuera=DATA.athletes.filter(a=>!_cronoLookup(map,a.name));
  if(!fuera.length){ alert('Todo en orden: los '+DATA.athletes.length+' atletas cargados están en el Cronograma.'); return; }
  if(!window.IS_CONTROLLER){
    alert('Esta pantalla está en modo LECTURA, no puede guardar.\n\nCambia a CONTROLADOR desde el menú y vuelve a intentar.');
    return;
  }
  const det=fuera.slice(0,30).map(a=>'• '+a.name+'  ('+(a.div||'')+' '+(a.cat||'')+', tanda '+(a.flight||'')+')').join('\n')
    +(fuera.length>30?'\n… y '+(fuera.length-30)+' más':'');
  if(!confirm('Hay '+fuera.length+' atleta(s) que NO están en el Cronograma de "'+((DATA.event&&DATA.event.name)||'')+'":\n\n'+det
    +'\n\nSe eliminan y quedan '+(DATA.athletes.length-fuera.length)+'.\n¿Confirmas?'))return;
  const ids=new Set(fuera.map(a=>a.id));
  DATA.athletes=DATA.athletes.filter(a=>!ids.has(a.id));
  Object.keys(DATA.changeTimers||{}).forEach(k=>{ if(ids.has(parseInt(k,10)))delete DATA.changeTimers[k]; });
  if(DATA.forcedCurrent!=null&&ids.has(DATA.forcedCurrent))DATA.forcedCurrent=null;
  try{ window._recentAtt={}; if(window._pendingEdits)window._pendingEdits.clear(); }catch(e){}
  R();
  // Escritura AUTORITATIVA + verificación: un borrado tiene que reemplazar el
  // documento, si no el merge devuelve a los que saqué.
  let ok=false;
  for(let i=1;i<=3&&!ok;i++){
    window._forceFullWrite=true;
    try{ await syncToFB(); }catch(e){ console.warn('[limpiar] escritura',e); }
    await new Promise(r=>setTimeout(r,1200));
    try{
      const snap=await window._fb.getDoc(window._fb.doc(fbDB,'livecast_sync',fbDocId()));
      const rem=JSON.parse((snap.data()||{}).athletes||'[]');
      ok=rem.length===DATA.athletes.length&&rem.every(a=>!!_cronoLookup(map,a.name));
    }catch(e){ console.warn('[limpiar] verificación',e); break; }
  }
  alert((ok?'Listo y verificado en el servidor.':'Se aplicó en esta pantalla, pero el servidor no confirmó. Revisa la conexión y vuelve a intentar.')
    +'\n\n'+fuera.length+' eliminado(s)\n'+DATA.athletes.length+' atletas quedan cargados.');
};
window.remove4thAttempt=function(id,l){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(!a.att[l]||a.att[l].length<4){window._attMenuOpen=null;R();return;}
  const at4=a.att[l][3];
  const detalle=at4&&(at4.w||at4.r)?' (tiene '+(at4.w||'—')+'kg'+(at4.r==='g'?' · VÁLIDO':at4.r==='n'?' · NULO':'')+')':'';
  window._attMenuOpen=null;
  if(!confirm('¿Eliminar el 4º intento de '+a.name+' en '+LIFT_S[l]+'?'+detalle+'\n\nSe borra ese intento extra.')){R();return;}
  a.att[l].pop();
  _markAtt(id,'att_'+l+'_3');
  // limpiar cualquier change timer colgado de ese índice
  const ck=id+'_'+l+'_3';if(DATA.changeTimers[ck])delete DATA.changeTimers[ck];
  // limpiar el tiempo compensatorio si era de este 4º
  if(DATA.compTimer&&DATA.compTimer.id===id&&DATA.compTimer.lift===l)DATA.compTimer=null;
  saveNow();R();
  showToastLC('4º intento eliminado: '+a.name+' — '+LIFT_S[l]);
};
// Cierra el tiempo compensatorio a la vista (manual).
window.clearCompTimer=function(){ DATA.compTimer=null; saveNow(); R(); };
// Menú de tres puntitos (⋮) por intento — estado global, se abre/cierra con toggle.
window._attMenuOpen=null;
window.toggleAttMenu=function(id,l,j){
  const key=id+'_'+l+'_'+j;
  window._attMenuOpen=(window._attMenuOpen===key)?null:key;
  R();
};
// Cerrar el menú al hacer click fuera de él (una sola vez).
if(!window._attMenuInit){
  window._attMenuInit=true;
  document.addEventListener('mousedown',function(e){
    if(!window._attMenuOpen)return;
    const t=e.target;
    if(t.closest&&(t.closest('.att-menu')||t.closest('.att-menu-btn')))return;
    window._attMenuOpen=null;
    if(typeof R==='function')R();
  },true);
}
// ═══════════════════════════════════════════════════════════
// PALETA IMPRESIÓN (blanco/negro — sin tinta de color)
// ═══════════════════════════════════════════════════════════
const CP={
  bg:    [255,255,255],  // fondo blanco
  hFill: [30,30,30],     // header negro
  hText: [255,255,255],  // texto header blanco
  sub:   [80,80,80],     // subheader gris oscuro
  subTx: [255,255,255],  // texto subheader blanco
  colH:  [210,210,210],  // fondo encabezados de columna
  colTx: [0,0,0],        // texto encabezados
  row0:  [255,255,255],  // fila par blanca
  row1:  [242,242,242],  // fila impar gris muy claro
  text:  [0,0,0],        // texto negro
  muted: [80,80,80],     // texto secundario
  line:  [160,160,160],  // líneas
  bold:  [0,0,0],        // negrita
  sep:   [200,200,200],  // separador de tanda
  sepTx: [0,0,0],        // texto separador
  uline: [0,0,0],        // subrayado escribible
};
// Los dos logos que van arriba en las hojas de mesa: FECHIPO en blanco —la banda
// del encabezado es azul oscuro, el logo a color se perdería— y YourLift, que
// ya viene con letras blancas. Antes ahí decía "FECHIPO" escrito con la fuente
// del PDF. Se cargan una sola vez y las tres hojas los comparten.
let _PDF_LOGOS_MESA=null;
// ══════════════════════════════════════════════════════════════════
// ACTA FESUPO — PDF de fondo blanco + Excel, como los que publica la
// Federación Sudamericana. Agrupa por modalidad → sexo → categoría, ordena por
// lugar y RESALTA EN AMARILLO todo intento (y el total) que sea récord
// sudamericano, igual que en las planillas oficiales.
// Los intentos nulos van con el peso en negativo, que es como se leen las actas
// de la IPF.
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// ESCRITOR DE .xlsx PROPIO
// La versión libre de SheetJS guarda los datos pero TIRA A LA BASURA el formato:
// negritas, tachados y colores no llegan al archivo (se puede comprobar abriendo
// el .xlsx: styles.xml sale con una sola fuente). El acta los necesita, así que
// el archivo se arma acá. Un .xlsx es un ZIP con cuatro XML; se guarda sin
// comprimir (método "stored"), así no hace falta ninguna librería y se abre
// igual en Excel, LibreOffice y Google Sheets.
//
// Estilos disponibles (el número va en cada celda):
//   0 normal · 1 negrita · 2 nulo (gris + tachado) · 3 récord (amarillo, negrita)
//   4 encabezado (negrita, fondo gris) · 5 título de grupo (negrita, más grande)
// ══════════════════════════════════════════════════════════════════
const XL_NORMAL=0, XL_BOLD=1, XL_NULO=2, XL_REC=3, XL_HEAD=4, XL_TITULO=5;
const _ACTA_MOD_N={classic:'POWERLIFTING CLASSIC',equipped:'POWERLIFTING EQUIPADO',
  ob_classic:'ONLY BENCH CLASSIC',ob_equipped:'ONLY BENCH EQUIPADO',oe:'SPECIAL OLYMPICS',
  invitado:'INVITADOS/AS · FUERA DE COMPETENCIA'};
// Estructura del acta: [{mod, sexo, cat, filas:[…]}] ya ordenada y con lugares.
const _ACTA_DIVORD={'Sub-Junior':0,'Subjunior':0,'Junior':1,'Universitario':2,'Open':3,
  'Master I':4,'Master II':5,'Master III':6,'Master IV':7,'Special Olympics':8};
// ── Actas por día ────────────────────────────────────────────────────────────
// Un campeonato de dos días premia al final de cada día. Para eso el acta tiene
// que salir con los atletas de ESE día, no con todo el campeonato.
//
// El dato ya está: el Cronograma del admin guarda día + sesión, y el livecast lo
// deja en cada atleta como jornada = "Sábado · AM". Acá se separa esa mitad.
const _DIAS_ACTA=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
// Día elegido para el acta. Vacío = el campeonato entero, que es como salía antes.
window._ACTA_DIA='';
window.setActaDia=function(d){
  window._ACTA_DIA=_diasDelEvento().indexOf(d)>=0?d:'';
  R();
};
// ════════════════════════════════════════════════════════════════
// DETALLE DE MEDALLAS
//
// Se premia por movimiento y no solo por total: en cada división y categoría
// van medallas a las tres mejores sentadillas, las tres mejores bancas, los tres
// mejores pesos muertos y los tres mejores totales.
//
// Sale de _actaGrupos(), que ya agrupa por modalidad + sexo + división +
// categoría y ya calcula el puesto de cada atleta en cada movimiento con el
// desempate del reglamento: a igual marca gana el más liviano, y si también
// empatan en peso corporal, el de lote menor. Rehacer esa cuenta acá habría sido
// tener dos versiones de la misma regla, que es como el acta y el medallero de
// pantalla terminan diciendo cosas distintas.
//
// En categorías de menos de tres atletas se premia a los que haya: uno solo se
// lleva el oro y nada más.
// ════════════════════════════════════════════════════════════════
const _MED_LBL={total:'TOTAL',sq:'SENTADILLA',bp:'PRESS DE BANCA',dl:'PESO MUERTO'};
const _MED_MET=['Oro','Plata','Bronce'];
window._MED_POR_TANDA=window._MED_POR_TANDA||false;
window.medPorTanda=function(v){
  window._MED_POR_TANDA=!!v;
  const m=document.getElementById('medModal'); const y=m?m.scrollTop:0;
  if(m)m.remove();
  window.mostrarMedallas();
  const n=document.getElementById('medModal'); if(n)n.scrollTop=y;
};
const _MED_COL={0:'#D4A843',1:'#C0C0C0',2:'#CD7F32'};
window.mostrarMedallas=function(){
  const d=_medallasDetalle();
  if(!d.total){showToastLC('Todavía no hay resultados para repartir medallas');return;}
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let h='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
    +'<div><div class="os" style="font-size:22px;font-weight:700">Detalle de medallas</div>'
    +'<div style="font-size:12px;color:var(--muted)">'+d.grupos.length+' categorías'+esc(_actaSufijoDia())+'</div></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="btn" onclick="exportMedallasXLS()" style="background:rgba(34,197,94,.12);border:1px solid var(--green);color:var(--green);font-weight:700">Excel</button>'
    +'<button class="btn" onclick="exportMedallasPDF()" style="background:#fff;border:1px solid #999;color:#111;font-weight:700">PDF</button>'
    +'<button class="btn" onclick="document.getElementById(\'medModal\').remove()">Cerrar</button></div></div>';

  // Resumen: lo que hay que mandar a hacer.
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">';
  [['Oro',d.oro,0],['Plata',d.plata,1],['Bronce',d.bronce,2],['Total',d.total,null]].forEach(([lbl,n,i])=>{
    h+='<div style="flex:1;min-width:110px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:12px 14px">'
      +'<div class="os" style="font-size:30px;font-weight:800;color:'+(i===null?'var(--text)':_MED_COL[i])+'">'+n+'</div>'
      +'<div style="font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase">'+lbl+'</div></div>';
  });
  h+='</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-bottom:16px">Por modalidad: '
    +Object.entries(d.porMod).sort((a,b)=>b[1].total-a[1].total)
      .map(([m,v])=>esc(_ACTA_MOD_N[m]||m)+' <b style="color:var(--text)">'+v.total+'</b>').join(' · ')+'</div>';

  // Medallero por país o club.
  h+='<div class="os" style="font-size:15px;font-weight:700;margin:18px 0 6px">Medallero por '+(d.porPais?'país':'club')+'</div>';
  h+='<div style="overflow-x:auto"><table class="tbl" style="width:100%"><tr><th style="text-align:left">'+(d.porPais?'País':'Club')+'</th><th>Oro</th><th>Plata</th><th>Bronce</th><th>Total</th></tr>';
  d.tabla.forEach((r,i)=>{
    h+='<tr><td style="text-align:left">'+(i+1)+'. '+(r.cod?_flagImg(r.cod,14,true):'')+esc(r.quien)+'</td>'
      +'<td style="color:'+_MED_COL[0]+';font-weight:700">'+r.oro+'</td>'
      +'<td style="color:'+_MED_COL[1]+';font-weight:700">'+r.plata+'</td>'
      +'<td style="color:'+_MED_COL[2]+';font-weight:700">'+r.bronce+'</td>'
      +'<td style="font-weight:700">'+r.total+'</td></tr>';
  });
  h+='</table></div>';

  // Listado para la premiación: por categoría, o agrupado por tanda (se premia al
  // terminar cada una).
  const _pt=!!window._MED_POR_TANDA;
  const _btn=(on,txt,v)=>'<button onclick="medPorTanda('+v+')" style="padding:5px 12px;border-radius:999px;border:1px solid '+(on?'var(--gold)':'var(--border)')
    +';background:'+(on?'rgba(212,168,67,.16)':'transparent')+';color:'+(on?'var(--gold)':'var(--muted)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer">'+txt+'</button>';
  h+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:22px 0 6px">'
    +'<div class="os" style="font-size:15px;font-weight:700;margin-right:6px">Premiación</div>'
    +_btn(!_pt,'POR CATEGORÍA',0)+_btn(_pt,'POR TANDA',1)+'</div>';
  const _secciones=_pt?_medallasPorTanda(d.grupos):[{tanda:null,grupos:d.grupos}];
  _secciones.forEach(sec=>{
  if(sec.tanda!==null){
    h+='<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:18px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--gold)">'
      +'<span class="os" style="font-size:18px;font-weight:800;color:var(--gold);letter-spacing:1px">TANDA '+esc(sec.tanda)+'</span>'
      +(sec.dia?'<span style="font-size:11px;color:var(--muted)">Día '+esc(sec.dia)+'</span>':'')
      +'<span style="font-size:12px;color:var(--muted)">'+sec.grupos.length+' categorías · '
      +'<b style="color:'+_MED_COL[0]+'">'+sec.oro+' oro</b> · <b style="color:'+_MED_COL[1]+'">'+sec.plata+' plata</b> · <b style="color:'+_MED_COL[2]+'">'+sec.bronce+' bronce</b></span></div>';
  }
  sec.grupos.forEach(gr=>{
    h+='<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px">'
      +'<div class="os" style="font-size:13px;font-weight:700;color:var(--gold);letter-spacing:1px;margin-bottom:8px">'+esc(gr.titulo)
        +(sec.tanda===null?' <span style="color:var(--muted);font-weight:400;font-size:11px">· tanda '+esc(gr.tanda)+'</span>':'')+'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px">';
    gr.podios.forEach(p=>{
      if(!p.top.length)return;
      h+='<div><div style="font-size:10px;letter-spacing:1.5px;color:var(--muted);margin-bottom:4px">'+p.label+'</div>';
      p.top.forEach((x,i)=>{
        h+='<div style="display:flex;align-items:center;gap:7px;font-size:12px;padding:2px 0">'
          +'<span style="width:16px;height:16px;flex-shrink:0;border-radius:50%;background:'+_MED_COL[i]+';color:#0A1628;font-weight:800;font-size:10px;display:flex;align-items:center;justify-content:center">'+(i+1)+'</span>'
          // La bandera va DENTRO del bloque del nombre y no como otro elemento
          // de la fila: si fuera hermana, el hueco entre el número y la bandera
          // y el que queda hasta el nombre saldrían distintos.
          +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
            +(d.porPais?_flagImg(_ctry(x.a),13,true):'')+esc(x.a.name||'')+'</span>'
          +'<b>'+(+x.valor).toFixed(1)+'</b></div>';
      });
      h+='</div>';
    });
    h+='</div></div>';
  });
  });

  const _vieja=document.getElementById('medModal'); if(_vieja)_vieja.remove();
  const m=document.createElement('div');
  m.id='medModal';
  m.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.8);z-index:99999;overflow-y:auto;padding:24px';
  m.innerHTML='<div style="max-width:1000px;margin:0 auto;background:var(--card,#0F1D33);border:1px solid var(--border);border-radius:14px;padding:20px">'+h+'</div>';
  document.body.appendChild(m);
  m.onclick=e=>{if(e.target===m)m.remove();};
};
window.exportMedallasXLS=function(){
  const {filas}=_medallasFilas();
  _xlsxDescargar(_actaNombreArchivo('xlsx').replace(/^Acta_/,'Medallas_'),
                 'Medallas',filas,[9,38,16,8,10,30,18,10]);
  showToastLC('Medallas en Excel');
};
window.exportMedallasPDF=async function(){
  try{
    if(!window.jspdf){
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    }
    if(!window.jspdf.jsPDF.API.autoTable){
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    }
    const {filas,d}=_medallasFilas();
    const doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const PW=doc.internal.pageSize.getWidth();
    doc.setFont('helvetica','bold');doc.setFontSize(13);
    doc.text(_stripAccentsForPdf('DETALLE DE MEDALLAS'+_actaSufijoDia()),PW/2,15,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    doc.text(_stripAccentsForPdf((DATA.event==null?void 0:DATA.event.name)||''),PW/2,21,{align:'center'});
    doc.text('Oro '+d.oro+'  ·  Plata '+d.plata+'  ·  Bronce '+d.bronce+'  ·  Total '+d.total,PW/2,26,{align:'center'});
    const cuerpo=filas.slice(1).map(f=>f.map(c=>_stripAccentsForPdf(String(c&&c.v!==undefined?c.v:''))));
    doc.autoTable({
      startY:31,
      head:[filas[0].map(c=>_stripAccentsForPdf(String(c.v)))],
      body:cuerpo,
      styles:{fontSize:7,cellPadding:1.4},
      headStyles:{fillColor:[26,22,0],textColor:[212,168,67]},
      margin:{left:8,right:8}
    });
    doc.save(_actaNombreArchivo('pdf').replace(/^Acta_/,'Medallas_'));
    showToastLC('Medallas en PDF');
  }catch(e){ console.error('[medallas] pdf',e); showToastLC('No se pudo generar el PDF: '+e.message); }
};
// ════════════════════════════════════════════════════════════════
// OVERALL Y PAÍSES
//
// Para cada DIVISIÓN + MODALIDAD del sexo elegido, dos tablas:
//  · Overall: todos los atletas de esa división y modalidad, de todas las
//    categorías de peso, ordenados por GL Points, del primero al último.
//  · Países: la clasificación por equipos del Reglamento Técnico IPF.
//      - En cada categoría de peso: 12, 9, 8, 7, 6, 5, 4, 3 y 2 puntos del 1° al
//        9°, y 1 punto a cada uno que después haga total.
//      - Cuentan los CINCO mejores de cada país.
//      - Empate: más primeros lugares; si sigue, más segundos, y así.
//    En un campeonato de un solo país la tabla va por club.
//
// Se arma con _actaGrupos(), la misma que usan el acta y las medallas, así los
// lugares por categoría son exactamente los mismos. No lee nada de Firestore:
// trabaja con los atletas que el livecast ya tiene cargados.
// ════════════════════════════════════════════════════════════════
const _OV_PTS=[12,9,8,7,6,5,4,3,2];
const _OV_MODORD=['classic','equipped','ob_classic','ob_equipped','oe'];
window._OV=window._OV||{sexo:'F',divs:null,mods:null};
window.ovSet=function(campo,valor){
  const o=window._OV, op=_ovOpciones();
  if(campo==='sexo')o.sexo=valor;
  else if(campo==='masters'){ o.masters=valor; o.divs=null; }   // las divisiones elegidas cambian de nombre
  else if(campo==='equipos'){ o.equipos=valor; }
  else{
    const todos=campo==='divs'?op.divs:op.mods;
    if(valor==='*')o[campo]=null;
    else{
      let sel=o[campo]?o[campo].slice():todos.slice();
      sel=sel.indexOf(valor)>=0?sel.filter(x=>x!==valor):sel.concat([valor]);
      o[campo]=(sel.length===todos.length||!sel.length)?null:sel;
    }
  }
  window.mostrarOverall();
};
window.mostrarOverall=function(){
  const op=_ovOpciones();
  if(!op.divs.length){showToastLC('Todavía no hay resultados');return;}
  const o=window._OV;
  if(op.sexos.indexOf(o.sexo)<0)o.sexo=op.sexos[0];
  const d=_ovDatos();
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const pill=(on,txt,oc)=>'<button onclick="'+oc+'" style="padding:5px 11px;border-radius:999px;border:1px solid '+(on?'var(--gold)':'var(--border)')
    +';background:'+(on?'rgba(212,168,67,.16)':'transparent')+';color:'+(on?'var(--gold)':'var(--muted)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer">'+txt+'</button>';
  const fila=(lbl,cont)=>'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px;min-width:78px">'+lbl+'</span>'+cont+'</div>';
  let h='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">'
    +'<div><div class="os" style="font-size:22px;font-weight:700">Overall y '+(d.porPais?'países':'clubes')+'</div>'
    +'<div style="font-size:12px;color:var(--muted)">GL Points por división y modalidad · clasificación por '+(d.porPais?'país':'club')+' según el reglamento IPF'+esc(_actaSufijoDia())+'</div></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="btn" onclick="exportOverallXLS()" style="background:rgba(34,197,94,.12);border:1px solid var(--green);color:var(--green);font-weight:700">Excel</button>'
    +'<button class="btn" onclick="exportOverallPDF()" style="background:#fff;border:1px solid #999;color:#111;font-weight:700">PDF</button>'
    +'<button class="btn" onclick="document.getElementById(\'ovModal\').remove()">Cerrar</button></div></div>';
  h+=fila('SEXO',op.sexos.slice().sort().map(sx=>pill(o.sexo===sx,sx==='F'?'MUJERES':'HOMBRES',"ovSet('sexo','"+sx+"')")).join(''));
  h+=fila('DIVISIÓN',pill(!o.divs,'TODAS',"ovSet('divs','*')")+op.divs.map(v=>pill(!!o.divs&&o.divs.indexOf(v)>=0,esc(v).toUpperCase(),"ovSet('divs','"+esc(v)+"')")).join(''));
  h+=fila('EQUIPOS',pill(!d.porPais,'POR CLUB',"ovSet('equipos','club')")+pill(d.porPais,'POR PAÍS',"ovSet('equipos','pais')"));
  h+=fila('MASTERS',pill(o.masters!=='sep','JUNTOS',"ovSet('masters','juntos')")+pill(o.masters==='sep','POR DIVISIÓN',"ovSet('masters','sep')"));
  h+=fila('MODALIDAD',pill(!o.mods,'TODAS',"ovSet('mods','*')")+op.mods.map(v=>pill(!!o.mods&&o.mods.indexOf(v)>=0,esc(_ACTA_MOD_N[v]||v),"ovSet('mods','"+v+"')")).join(''));
  if(!d.bloques.length)h+='<div style="padding:20px;color:var(--muted);text-align:center">No hay resultados con esa selección.</div>';
  d.bloques.forEach(b=>{
    h+='<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin:14px 0">'
      +'<div class="os" style="font-size:14px;font-weight:700;color:var(--gold);letter-spacing:1px;margin-bottom:8px">'+esc(b.titulo)+'</div>'
      +'<div style="display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:14px">';
    // Overall
    h+='<div style="overflow-x:auto"><div style="font-size:10px;letter-spacing:1.5px;color:var(--muted);margin-bottom:4px">OVERALL · GL POINTS</div>'
      +'<table class="tbl" style="width:100%;font-size:12px"><tr><th>#</th><th style="text-align:left">Atleta</th><th>Cat.</th><th>PC</th><th>Total</th><th>GL</th><th title="Puntos por equipo según su lugar en la categoría">Pts</th></tr>';
    b.filas.forEach(f=>{
      h+='<tr><td>'+(f.lugar||'—')+'</td><td style="text-align:left;white-space:nowrap">'+(d.porPais?_flagImg(_ctry(f.a),12,true):'')+esc(f.a.name||'')
        +(d.porPais?'':' <span style="color:var(--muted);font-size:10px">'+esc(f.quien)+'</span>')+'</td>'
        +'<td>'+esc(f.cat)+'</td><td>'+(f.a.bw||'—')+'</td><td style="font-weight:700">'+(f.total>0?f.total:'—')+'</td>'
        +'<td style="color:var(--gold);font-weight:700">'+(f.total>0?(+f.gl).toFixed(2):'—')+'</td><td>'+(f.pts||'')+'</td></tr>';
    });
    h+='</table></div>';
    // Países
    h+='<div style="overflow-x:auto"><div style="font-size:10px;letter-spacing:1.5px;color:var(--muted);margin-bottom:4px">'+(d.porPais?'PAÍSES':'CLUBES')+' · PUNTOS IPF</div>'
      +'<table class="tbl" style="width:100%;font-size:12px"><tr><th>#</th><th style="text-align:left">'+(d.porPais?'País':'Club')+'</th><th>Pts</th><th>1°</th><th>2°</th><th>3°</th><th title="Atletas que suman (máx. 5) / atletas del país">Suman</th></tr>';
    b.equipos.forEach(e=>{
      h+='<tr><td>'+(e.puesto||'—')+'</td><td style="text-align:left;white-space:nowrap">'+(e.cod?_flagImg(e.cod,12,true)+esc(_ctryName(e.cod)):esc(e.quien))+'</td>'
        +'<td style="color:var(--gold);font-weight:800">'+e.puntos+'</td><td>'+e.lugares[0]+'</td><td>'+e.lugares[1]+'</td><td>'+e.lugares[2]+'</td>'
        +'<td>'+e.suman+'/'+e.atletas+'</td></tr>';
    });
    h+='</table></div></div>';
    if(b.unis){
      h+='<div style="overflow-x:auto;margin-top:12px"><div style="font-size:10px;letter-spacing:1.5px;color:var(--muted);margin-bottom:4px">UNIVERSIDADES · PUNTOS IPF</div>'
        +'<table class="tbl" style="width:100%;font-size:12px"><tr><th>#</th><th style="text-align:left">Universidad</th><th>País</th><th>Pts</th><th>1°</th><th>2°</th><th>3°</th><th>Mejor GL</th><th>Suman</th></tr>';
      b.unis.forEach(e=>{
        h+='<tr><td>'+(e.puesto||'—')+'</td><td style="text-align:left">'+esc(e.quien)+'</td><td>'+(e.pais?_flagImg(e.pais,12,true)+esc(e.pais):'')+'</td>'
          +'<td style="color:var(--gold);font-weight:800">'+e.puntos+'</td><td>'+e.lugares[0]+'</td><td>'+e.lugares[1]+'</td><td>'+e.lugares[2]+'</td>'
          +'<td>'+(e.mejorGL?e.mejorGL.toFixed(2):'—')+'</td><td>'+e.suman+'/'+e.atletas+'</td></tr>';
      });
      h+='</table></div>';
    }
    h+='</div>';
  });
  h+='<div style="font-size:10px;color:var(--muted);line-height:1.6;margin-top:6px">Puntos por equipo (Reglamento Técnico IPF): 12, 9, 8, 7, 6, 5, 4, 3 y 2 del 1° al 9° de cada categoría de peso; 1 punto a cada atleta que haga total después del 9°. Cuentan los cinco mejores de cada '+(d.porPais?'país':'club')+'. Empate: más primeros lugares, luego más segundos, y así; si aun así siguen empatados, la mejor marca GL del equipo. En Universitario se clasifica además por universidad.</div>';
  let m=document.getElementById('ovModal');
  const y=m?m.scrollTop:0;
  if(!m){ m=document.createElement('div'); m.id='ovModal';
    m.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.8);z-index:99999;overflow-y:auto;padding:24px';
    m.onclick=e=>{if(e.target===m)m.remove();}; document.body.appendChild(m); }
  m.innerHTML='<div style="max-width:1150px;margin:0 auto;background:var(--card,#0F1D33);border:1px solid var(--border);border-radius:14px;padding:20px">'+h+'</div>';
  m.scrollTop=y;
};
window.exportOverallXLS=function(){
  const {filas,d}=_ovFilas();
  if(!d.bloques.length){showToastLC('No hay resultados con esa selección');return;}
  _xlsxDescargar(_ovNombre('xlsx'),'Overall',filas,[8,34,20,10,8,10,10,11]);
  showToastLC('Overall en Excel');
};
// Fondo blanco y cuadrícula gris, igual que el Acta FESUPO.
const _OV_PDF_EST={styles:{fontSize:7,cellPadding:1.1,textColor:[0,0,0],lineColor:[170,170,170],lineWidth:.15,fillColor:[255,255,255]},
  head:{fillColor:[235,235,235],textColor:[0,0,0],fontStyle:'bold',halign:'center'}};
window.exportOverallPDF=async function(){
  try{
    const {d}=_ovFilas();
    if(!d.bloques.length){showToastLC('No hay resultados con esa selección');return;}
    if(!window.jspdf)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    if(!window.jspdf.jsPDF.API.autoTable)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    const T=x=>_stripAccentsForPdf(String(x==null?'':x));
    const doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const PW=doc.internal.pageSize.getWidth();
    doc.setFont('helvetica','bold');doc.setFontSize(13);
    doc.text(T('OVERALL Y '+(d.porPais?'PAISES':'CLUBES')+' - '+(window._OV.sexo==='F'?'MUJERES':'HOMBRES')+_actaSufijoDia()),PW/2,14,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    doc.text(T((DATA.event&&DATA.event.name)||''),PW/2,20,{align:'center'});
    doc.setTextColor(0);
    let y=26;
    d.bloques.forEach((b,i)=>{
      if(i>0&&y>235){doc.addPage();y=14;}
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(T(b.titulo),8,y);y+=2;
      doc.autoTable({startY:y,margin:{left:8,right:8},theme:'grid',styles:_OV_PDF_EST.styles,headStyles:_OV_PDF_EST.head,bodyStyles:{fillColor:[255,255,255]},alternateRowStyles:{fillColor:[248,248,248]},
        head:[['#','Atleta',d.porPais?'Pais':'Club','Cat.','PC','Total','GL','Pts']],
        body:b.filas.map(f=>[f.lugar||'-',T(f.a.name),T(d.porPais?_ctry(f.a):f.quien),T(f.cat),f.a.bw||'',f.total>0?f.total:'-',f.total>0?(+f.gl).toFixed(2):'-',f.pts||''])});
      y=doc.lastAutoTable.finalY+3;
      doc.autoTable({startY:y,margin:{left:8,right:PW/2},theme:'grid',styles:_OV_PDF_EST.styles,headStyles:_OV_PDF_EST.head,bodyStyles:{fillColor:[255,255,255]},alternateRowStyles:{fillColor:[248,248,248]},
        head:[['#',d.porPais?'Pais':'Club','Pts','1ro','2do','3ro','Suman']],
        body:b.equipos.map(e=>[e.puesto||'-',T(e.cod?_ctryName(e.cod):e.quien),e.puntos,e.lugares[0],e.lugares[1],e.lugares[2],e.suman+'/'+e.atletas])});
      if(b.unis){
        y=doc.lastAutoTable.finalY+3;
        doc.autoTable({startY:y,margin:{left:8,right:8},theme:'grid',styles:_OV_PDF_EST.styles,headStyles:_OV_PDF_EST.head,bodyStyles:{fillColor:[255,255,255]},alternateRowStyles:{fillColor:[248,248,248]},
          head:[['#','Universidad','Pais','Pts','1ro','2do','3ro','Mejor GL','Suman']],
          body:b.unis.map(e=>[e.puesto||'-',T(e.quien),T(e.pais),e.puntos,e.lugares[0],e.lugares[1],e.lugares[2],e.mejorGL?e.mejorGL.toFixed(2):'-',e.suman+'/'+e.atletas])});
      }
      y=doc.lastAutoTable.finalY+9;
    });
    doc.setFontSize(6.5);doc.setTextColor(110);
    doc.text(T('Puntos por equipo (Reglamento Tecnico IPF): 12-9-8-7-6-5-4-3-2 del 1 al 9 de cada categoria; 1 punto a cada atleta con total despues del 9. Cuentan los 5 mejores. Empate: mas primeros lugares, luego segundos, etc.; luego la mejor marca GL. En Universitario tambien por universidad.'),8,Math.min(y,288),{maxWidth:PW-16});
    doc.save(_ovNombre('pdf'));
    showToastLC('Overall en PDF');
  }catch(e){ console.error('[overall] pdf',e); showToastLC('No se pudo generar el PDF: '+e.message); }
};
// ════════════════════════════════════════════════════════════════
// RÉCORDS BATIDOS — lista para descargar
//
// Sirve para cualquier campeonato:
//  · Sudamericanos: si el campeonato usa la tabla FESUPO, cada casillero donde
//    la mejor marca de esta competencia supera a la del archivo (_srHoyCalc, la
//    misma cuenta que marca en amarillo el acta y la tarima).
//  · Nacionales: los chilenos contra la tabla nacional de Chile (_rnDetectar,
//    la misma que usa Cerrar competencia). No aplica en un regional.
// Solo se lee: no escribe nada.
// ════════════════════════════════════════════════════════════════
const _RB_MOV={sq:'Sentadilla',bp:'Press de banca',bpsl:'Press de banca (Only Bench)',dl:'Peso muerto',total:'Total'};
window.mostrarRecordsBatidos=async function(){
  showToastLC('Buscando récords batidos…');
  const suda=_rbSuda(), nac=await _rbNac();
  window._RB={suda,nac};
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const tabla=(titulo,lista,conPais)=>{
    if(lista===null)return '<div class="os" style="font-size:15px;font-weight:700;margin:18px 0 6px">'+titulo+'</div><div style="color:var(--orange);font-size:12px">No se pudo leer la tabla de récords.</div>';
    let h='<div class="os" style="font-size:15px;font-weight:700;margin:18px 0 6px">'+titulo+' <span style="color:var(--gold)">'+lista.length+'</span></div>';
    if(!lista.length)return h+'<div style="color:var(--muted);font-size:12px">Ninguno en este campeonato.</div>';
    h+='<div style="overflow-x:auto"><table class="tbl" style="width:100%;font-size:12px"><tr><th>Sexo</th><th>Modalidad</th><th>División</th><th>Cat.</th><th style="text-align:left">Movimiento</th>'
      +'<th>Nuevo</th><th style="text-align:left">Atleta</th>'+(conPais?'<th>País</th>':'')+'<th>Anterior</th><th style="text-align:left">De</th></tr>';
    lista.forEach(r=>{
      h+='<tr><td>'+r.sexo+'</td><td>'+r.mod+'</td><td>'+esc(r.div)+'</td><td>'+esc(r.cat)+'</td><td style="text-align:left">'+r.mov+'</td>'
        +'<td style="color:#F2C230;font-weight:800">'+r.nuevo+'</td><td style="text-align:left">'+(conPais?_flagImg(r.pais,12,true):'')+esc(r.atleta)+'</td>'
        +(conPais?'<td>'+esc(r.pais)+'</td>':'')
        +'<td>'+(r.antes!=null?r.antes:'—')+'</td><td style="text-align:left;color:var(--muted)">'+(r.antes!=null?esc(r.antesQuien)+(r.antesPais?' · '+esc(r.antesPais):''):(r.antesQuien||'sin récord previo'))
        +(r.guardado===false?' <span style="color:var(--orange);font-size:10px">· falta guardar</span>':'')+'</td></tr>';
    });
    return h+'</table></div>';
  };
  let h='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">'
    +'<div><div class="os" style="font-size:22px;font-weight:700">Récords batidos</div>'
    +'<div style="font-size:12px;color:var(--muted)">'+esc((DATA.event&&DATA.event.name)||'')+' · mejor marca de la competencia en cada casillero</div></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="btn" onclick="exportRecordsBatidosXLS()" style="background:rgba(34,197,94,.12);border:1px solid var(--green);color:var(--green);font-weight:700">Excel</button>'
    +'<button class="btn" onclick="exportRecordsBatidosPDF()" style="background:#fff;border:1px solid #999;color:#111;font-weight:700">PDF</button>'
    +'<button class="btn" onclick="document.getElementById(\'rbModal\').remove()">Cerrar</button></div></div>';
  if(_srOn())h+=tabla('Récords sudamericanos',suda,true);
  h+=tabla('Récords nacionales de Chile (atletas chilenos)',nac,false);
  const v=document.getElementById('rbModal'); if(v)v.remove();
  const m=document.createElement('div'); m.id='rbModal';
  m.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.8);z-index:99999;overflow-y:auto;padding:24px';
  m.innerHTML='<div style="max-width:1150px;margin:0 auto;background:var(--card,#0F1D33);border:1px solid var(--border);border-radius:14px;padding:20px">'+h+'</div>';
  m.onclick=e=>{if(e.target===m)m.remove();};
  document.body.appendChild(m);
};
window.exportRecordsBatidosXLS=function(){
  const filas=[[{v:'RÉCORDS BATIDOS — '+((DATA.event&&DATA.event.name)||''),s:5}],[]];
  _rbSecciones().forEach(sec=>{
    filas.push([{v:sec.titulo+' ('+sec.lista.length+')',s:1}]);
    filas.push(['Sexo','Modalidad','División','Cat.','Movimiento','Nuevo','Atleta'].concat(sec.pais?['País']:[]).concat(['Anterior','De']).map(v=>({v,s:8})));
    sec.lista.forEach(r=>filas.push([r.sexo,r.mod,r.div,r.cat,r.mov,{n:r.nuevo},r.atleta].concat(sec.pais?[r.pais]:[])
      .concat([r.antes!=null?{n:r.antes}:'—',r.antes!=null?(r.antesQuien+(r.antesPais?' · '+r.antesPais:'')):'sin récord previo'])
      .map(x=>x&&x.n!==undefined?{v:x.n,s:7}:{v:x,s:6})));
    filas.push([]);
  });
  _xlsxDescargar(_rbNombre('xlsx'),'Records',filas,[11,12,12,7,26,9,34,8,9,34]);
  showToastLC('Récords en Excel');
};
window.exportRecordsBatidosPDF=async function(){
  try{
    if(!window.jspdf)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    if(!window.jspdf.jsPDF.API.autoTable)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    const T=x=>_stripAccentsForPdf(String(x==null?'':x));
    const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const PW=doc.internal.pageSize.getWidth();
    doc.setTextColor(0);doc.setFont('helvetica','bold');doc.setFontSize(13);
    doc.text(T('RECORDS BATIDOS'),PW/2,14,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(T((DATA.event&&DATA.event.name)||''),PW/2,20,{align:'center'});
    let y=27;
    _rbSecciones().forEach(sec=>{
      if(y>180){doc.addPage();y=14;}
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(T(sec.titulo+' ('+sec.lista.length+')'),8,y);y+=2;
      const head=['Sexo','Modalidad','Division','Cat.','Movimiento','Nuevo','Atleta'].concat(sec.pais?['Pais']:[]).concat(['Anterior','De']);
      const body=sec.lista.length?sec.lista.map(r=>[r.sexo,r.mod,r.div,r.cat,r.mov,r.nuevo,r.atleta].concat(sec.pais?[r.pais]:[])
        .concat([r.antes!=null?r.antes:'-',r.antes!=null?(r.antesQuien+(r.antesPais?' - '+r.antesPais:'')):'sin record previo']).map(T))
        :[[{content:T('Ninguno en este campeonato'),colSpan:head.length}]];
      doc.autoTable({startY:y,margin:{left:8,right:8},theme:'grid',styles:_OV_PDF_EST.styles,headStyles:_OV_PDF_EST.head,
        bodyStyles:{fillColor:[255,255,255]},alternateRowStyles:{fillColor:[248,248,248]},head:[head.map(T)],body,
        didParseCell:d=>{ if(d.section==='body'&&d.column.index===5&&sec.lista.length){d.cell.styles.fillColor=[247,214,58];d.cell.styles.fontStyle='bold';} }});
      y=doc.lastAutoTable.finalY+10;
    });
    doc.save(_rbNombre('pdf'));
    showToastLC('Récords en PDF');
  }catch(e){ console.error('[récords batidos] pdf',e); showToastLC('No se pudo generar el PDF: '+e.message); }
};
window.mostrarRecordsNac=async function(trasCerrar){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  showToastLC('Comparando con la tabla de récords nacionales…');
  let tabla; try{ tabla=await _rnCargarTabla(); }catch(e){ alert('No se pudo leer la tabla de récords: '+e.message); return; }
  const lista=_rnDetectar(tabla);
  window._RN={lista,tabla};
  if(!lista.length){ if(!trasCerrar)alert('Ningún chileno superó un récord nacional en esta competencia.'); return; }
  const TN={classic:'Classic',equipped:'Equipado',universitario:'Universitario'};
  let h='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px">'
    +'<div><div class="os" style="font-size:22px;font-weight:700">Récords nacionales</div>'
    +'<div style="font-size:12px;color:var(--muted);max-width:620px;line-height:1.5">Marcas de atletas chilenos que superan la tabla nacional. Revisa, desmarca lo que no corresponda y guarda. '
    +'Los casilleros sin récord previo vienen desmarcados.</div></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="btn" onclick="guardarRecordsNac()" style="background:rgba(34,197,94,.14);border:1px solid var(--green);color:var(--green);font-weight:700">Guardar en la tabla de récords</button>'
    +'<button class="btn" onclick="document.getElementById(\'rnModal\').remove()">Cerrar</button></div></div>';
  h+='<div style="overflow-x:auto"><table class="tbl" style="width:100%;font-size:12px"><tr><th></th><th style="text-align:left">Modalidad</th><th>Sexo</th><th>División</th><th>Cat.</th><th>Movimiento</th>'
    +'<th style="text-align:left">Récord actual</th><th style="text-align:left">Nuevo récord</th></tr>';
  lista.forEach((r,i)=>{
    h+='<tr><td><input type="checkbox" '+(r.marcado?'checked':'')+' onchange="window._RN.lista['+i+'].marcado=this.checked"></td>'
      +'<td style="text-align:left">'+TN[r.tipo]+'</td><td>'+(r.sexo==='Mujer'?'F':'M')+'</td><td>'+esc(r.div)+'</td><td>'+esc(r.cat)+'</td><td>'+r.lbl+'</td>'
      +'<td style="text-align:left">'+(r.act?'<b>'+r.act.marca+'</b> · '+esc(r.act.nombre||''):'<span style="color:var(--orange)">sin récord previo</span>')+'</td>'
      +'<td style="text-align:left"><b style="color:#F2C230">'+r.w+'</b> · '+esc(r.a.name)+'</td></tr>';
  });
  h+='</table></div>';
  const v=document.getElementById('rnModal'); if(v)v.remove();
  const m=document.createElement('div'); m.id='rnModal';
  m.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.8);z-index:99999;overflow-y:auto;padding:24px';
  m.innerHTML='<div style="max-width:1100px;margin:0 auto;background:var(--card,#0F1D33);border:1px solid var(--border);border-radius:14px;padding:20px">'+h+'</div>';
  m.onclick=e=>{if(e.target===m)m.remove();};
  document.body.appendChild(m);
};
window.guardarRecordsNac=async function(){
  const rn=window._RN; if(!rn)return;
  const elegidos=rn.lista.filter(r=>r.marcado);
  if(!elegidos.length){ alert('No hay ningún récord marcado.'); return; }
  if(!confirm('Se actualizarán '+elegidos.length+' récords nacionales en la tabla que publica yourlift.cl.\n\n¿Confirmar?'))return;
  try{
    const hechos=await _rnAplicar(elegidos);
    alert(hechos.length+' récords nacionales actualizados. Ya se ven en yourlift.cl.');
    const m=document.getElementById('rnModal'); if(m)m.remove();
  }catch(e){ alert('No se pudo guardar: '+(e.code||e.message)); }
};
let _txLastLifter=null;
// ─── LBAUTO (leaderboard que aparece 10s al terminar cada ronda) ─
let _txLbAutoLastKey=null;
let _txLbAutoShownAt=0;
const TX_LBAUTO_DURATION=10000;
// ─── CEREMONY (widget orquestador todo-en-uno) ─────────────────
// Flujo:
//   1) Detecta nuevo levantador → PROFILE fullscreen (profileMs)
//   2) → SCOREBOARD bottom-left + TIMER top-right (scoreboardMs)
//      • SLAM top-left por slamMs cuando llega resultado (no cambia de estado)
//   3) → IDLE (transparente) hasta el próximo levantador
//
// PARA MODIFICAR LOS TIEMPOS, edita la línea de abajo (en milisegundos):
//    profileMs:     duración del perfil fullscreen
//    scoreboardMs:  duración del scoreboard bottom-left ← acá lo subes
//    slamMs:        duración del flash GOOD/NO LIFT en la esquina
const TX_CEREMONY={profileMs:5000,scoreboardMs:30000,slamMs:2000,recordMs:7000};
let _txCerState='idle';
            // idle | profile | scoreboard
let _txCerStateAt=0;
let _txCerLastLifter=null;
let _txCerSeenResults=null;
let _txCerSlamUntil=0;
let _txCerSlamType=null;
let _txCerRecordUntil=0;
let _txCerRecordData=null;
let _txCerRecordUnsub=null;
let _txCerRecordSeenTs=0;
let _txCerLastSig=null;
            // signature p/ saltarse re-renders innecesarios
// Mismo cuidado que el listener del director: el id del doc depende del evento,
// que se resuelve después de Firebase. Si se suscribe antes, queda escuchando el
// id viejo y los avisos de récord no llegan nunca.
let _txCerRecordUnsubDocId=null;
// ─── DIRECTOR direct OBS WS (widget independiente) ─────────────
// Cuando el widget se abre con ?tx=director, escucha eventos de OBS de dos formas:
// 1. obsCustomEvent (API nativa de OBS Browser Source) — sin WebSocket, sin mixed-content.
//    BroadcastCustomEvent → OBS inyecta 'obsCustomEvent' en todos los browser sources.
// 2. WebSocket directo (fallback para pruebas en browser normal con ?obsWs=host:port).
let _widgetObsWs=null;
let _widgetObsNativeListening=false;
// ─── DIRECTOR (control 100% manual desde panel admin) ──────────
// Lee comandos desde Firestore livecast_director/current.
// Cada componente tiene {active, until?} independiente; el panel del
// admin pushea cambios y este widget renderiza lo que esté activo.
const TX_DIR_DEFAULT={profile:{active:false,until:0,scale:1},scoreboard:{active:false,until:0,scale:1},leaderboard:{active:false,until:0,cat:'',scale:1},timer:{active:false,until:0,scale:1},slam:{active:false,until:0,type:'g',scale:1},medals:{active:false,until:0,mod:'',sex:'',div:'',cat:'',tipo:'total',scale:1},breakTimer:{active:false,startedAt:0,durationSec:0,label:'',pausedAt:0,scale:1,videos:[],movement:'',style:{bgColor:'#0A1628',accentColor:'#C41E3A',videoX:0,videoY:5,videoW:40,videoH:80,textX:44,textY:10,titleSize:8,movSize:5,timerSize:12,showLogos:true,blurAmount:24,overlayOpacity:0.65}}};
let _txDirState=null;
// Firma del timer de descanso, para no redibujar las pantallas de tarima por
// cambios del director que no las tocan.
let _txDescSig=null;
let _txDirUnsub=null;
let _txDirUnsubDocId=null;
let _txDirPoll=null;
let _txDirLastSig=null;
// Animaciones de transición — detecta on→off / off→on por componente.
// Cuando hay un cambio, se guarda timestamp y dirección para reproducir
// la animación CSS correcta. Después de la duración, se limpia.
const TX_ANIM_MS={fullscreen:1200,corner:850};
let _txDirAnims={};
let _txDirPrevActive={};
// Overlay del barrido — vive en document.body, independiente del innerHTML del widget.
// Así los re-renders del widget (sync cada 5s) no lo reinician.
let _txBarridoEl=null;
// Video de fondo del break timer — también persiste fuera del innerHTML para no reiniciar.
// ── Break timer video — dos capas: fondo difuminado + clip nítido izq ──
let _btVideoBgEl=null;
   // fondo: full screen, blur
let _btVideoFgEl=null;
   // primer plano: izquierda, aspect ratio natural
let _btVideoIdx=0;
let _btVideoSrcsKey='';
let _btVideoInterval=null;
const BT_CLIP_DURATION=4000;
// Y si el campeonato no tiene logo cargado en su ficha, se busca uno en el repo
// con su mismo nombre: eventos/<id>.png para el del campeonato y
// eventos/<id>_fed.png para el de la federación. Es una red, no un reemplazo —
// el de la ficha manda siempre, y así el logo se cambia desde admin sin tocar
// código.
//
// El archivo se COMPRUEBA antes de darlo por bueno, y solo entonces se guarda
// acá. Devolver la ruta a ciegas parecía inofensivo —cada <img> tiene su
// onerror— pero rompía dos cosas de verdad: la tira de logos dibujaba un
// separador entre logos que no existían, y el fondo "logo" de la pantalla de
// tarima dejaba de caer al azul de YourLift cuando no había ninguno.
window._LOGO_LOCAL={camp:'',fed:''};
// ─── SLAM (GOOD LIFT / NO LIFT flash) ──────────────────────────
let _txSlamSeen=null;
          // Map<key, 'g'|'r'|null>
let _txSlamUntil=0;
            // timestamp until which to show
let _txSlamType=null;
          // 'g' | 'r'
let _txSlamLifterName='';
// ─── LIGHTS (3 luces de jueces) ────────────────────────────────
let _txLightsUnsub=null,_txLightsDoc=null;
let _txLights={izq:null,central:null,der:null};
let _txLightsResetTs=0;
let _txLightsPoll=null;
let _txSbSig=null;
let _txSbShownAt=0;
const TX_SCOREBOARD_DURATION=20000;
// ════════════════════════════════════════════════════════════════
// PANTALLA DE TARIMA (?tx=screen) — canal de control INDEPENDIENTE
// del Control TX. Lee livecast_screen/{evento} y alterna entre el
// PERFIL del atleta en tarima y la TABLA DE JORNADA. Se controla a
// distancia desde el panel "Pantalla Tarima".
// ════════════════════════════════════════════════════════════════
// ─── Panel de control de la Pantalla de Tarima (admin) ──────────
window._SCREEN_LOCAL={mode:'jornada',flights:[],nameScale:1,fondo:'bandera',luces:false,veloBandera:0.55};
window.screenSetMode=function(m){window._SCREEN_LOCAL.mode=m;_screenPush();R();};
// Fondo del modo "Atleta en barra": bandera del país · logo del campeonato · azul.
window.screenSetFondo=function(f){window._SCREEN_LOCAL.fondo=f;_screenPush();R();};
// Difuminado de la bandera de fondo. Sin R(): un re-render en medio del arrastre
// corta el deslizador, igual que pasaba con el del tamaño de los nombres.
window.screenSetVelo=function(v){
  let n=parseFloat(v); if(isNaN(n))n=0.55;
  n=Math.max(0.15,Math.min(0.85,n)); n=Math.round(n*100)/100;
  window._SCREEN_LOCAL.veloBandera=n;
  _screenPush();
  const sl=document.getElementById('scrVeloRange'); if(sl&&parseFloat(sl.value)!==n)sl.value=n;
  const lb=document.getElementById('scrVeloPct'); if(lb)lb.textContent=Math.round(n*100)+'%';
};
// Luces de jueces en la pantalla de tarima. Es un espejo: no da válido ni nulo.
window.screenToggleLuces=function(){
  window._SCREEN_LOCAL.luces=!window._SCREEN_LOCAL.luces;_screenPush();R();
};
window.screenSetNameScale=function(v){
  let n=parseFloat(v)||1; n=Math.max(0.6,Math.min(2.2,n)); n=Math.round(n*100)/100;
  window._SCREEN_LOCAL.nameScale=n; window._JORNADA_NAMESCALE=n;
  _screenPush();
  // Actualizar el panel SIN re-render (para no cortar el arrastre del slider)
  const sl=document.getElementById('scrNameRange'); if(sl&&parseFloat(sl.value)!==n)sl.value=n;
  const lb=document.getElementById('scrNamePct'); if(lb)lb.textContent=Math.round(n*100)+'%';
  const pv=document.getElementById('scrNamePrev'); if(pv)pv.style.fontSize=Math.round(15*n)+'px';
};
window.screenNudgeNameScale=function(d){window.screenSetNameScale((window._SCREEN_LOCAL.nameScale||1)+d);};
window.screenToggleFlight=function(f){
  const arr=window._SCREEN_LOCAL.flights;
  const i=arr.indexOf(f);
  if(i>=0)arr.splice(i,1);else arr.push(f);
  _screenPush();R();
};
window.screenAllFlights=function(){
  const all=[...new Set(DATA.athletes.map(a=>a.flight))].sort(_cmpFl);
  window._SCREEN_LOCAL.flights=all;_screenPush();R();
};
window._SCREEN_STATE={mode:'jornada',flights:null,fondo:'bandera',luces:false};
let _screenUnsub=null, _screenFirstSnap=true;
// ════════════════════════════════════════════════════════════════
// TABLA DE JORNADA (estilo IPF) — pantalla de tarima, todas las
// categorías de las tandas seleccionadas. Filas con país, año nac,
// BW, SQ/BP/DL (3 intentos c/u + subtotal), total y GL.
// Las tandas a mostrar se eligen vía window._JORNADA_FLIGHTS (set
// por el control de pantalla). Año de nacimiento via BIRTH_BY_RUT.
// ════════════════════════════════════════════════════════════════
window.BIRTH_BY_RUT = window.BIRTH_BY_RUT || {};
// ══════════════════════════════════════════════
// TX: MEDALLERO (Top 3) — banda inferior-centro con el podio de una
// categoría específica (modalidad + sexo + división + categoría),
// elegida a mano desde Control TX. No depende del levantador en tarima:
// usa DATA.athletes, que YA está cargado localmente (sin lecturas nuevas
// a Firestore — cero costo adicional).
// ══════════════════════════════════════════════
// ── Medallero: quiénes son el 1°, 2° y 3° ────────────────────────────────────
// Los campeonatos ahora premian por movimiento, no solo por total: las tres
// mejores sentadillas de la -83 Junior, las tres mejores bancas, los tres mejores
// pesos muertos, y aparte los tres mejores totales. Por eso el tipo es un dato
// más del medallero, igual que la categoría o la división.
//
// El orden es el de la IPF y estaba a medias: se ordenaba solo por el número, así
// que dos atletas con 190 kg quedaban en el orden en que aparecían en la lista.
// Ahora desempata como corresponde — a igual marca gana el más liviano, y si
// también empatan en peso corporal, el de lote menor, que pesó antes.
const MEDAL_TIPOS={total:'TOTAL',sq:'SENTADILLA',bp:'PRESS DE BANCA',dl:'PESO MUERTO'};
// ════════════════════════════════════════════════════════════════
// ATLETA EN BARRA — modo de la Pantalla de Tarima al estilo del tablero
// de intentos de la IPF: quién está en tarima, qué movimiento e intento,
// y cuánto pesa la barra. Nada más.
//
// Se sacaron a propósito tres cosas que trae el tablero de la IPF: el nombre
// largo del país (la bandera y el código ya lo dicen), la conversión a libras
// (acá no se usa) y el cronómetro (ese vive en la Pantalla de Intentos, que la
// mira el juez).
//
// El fondo es una cadena: bandera del país del atleta → logo del campeonato →
// azul de YourLift. Se corta en el primero que exista.
// ════════════════════════════════════════════════════════════════
const _LIFT_SIGLA={sq:'SQ',bp:'BP',dl:'DL'};
(function(){
  if(typeof document==='undefined'||document.getElementById('cssBarraParpadeo'))return;
  const st=document.createElement('style'); st.id='cssBarraParpadeo';
  st.textContent='@keyframes barraParpadeo{0%,100%{opacity:1}50%{opacity:.25}}'
    +'@media (prefers-reduced-motion:reduce){.barra-rec{animation:none!important}}';
  document.head.appendChild(st);
})();
// ════════════════════════════════════════════════════════════════
// PANTALLA DE INTENTOS — modo de la "Pantalla de Tarima" (?tx=screen),
// pensada para un monitor/TV en el lugar de la competencia (junto a la
// tarima), calcada de la vista de barra con discos de LiftingCast:
// peso grande, barra con discos IPF a color, altura de rack, nombre,
// sexo/club/categoría, pronóstico de posición y el reloj de 1:00 para
// dar el intento. A diferencia de los widgets de OBS/transmisión, esta
// pantalla NO se transmite al stream — es solo para quienes están en
// el lugar (jueces, atletas, público presencial), así que el reloj
// tiene sentido acá aunque ya no sea público en la transmisión online.
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// LAYOUT EDITABLE de Pantalla de Intentos — cada bloque (peso, barra,
// nombre, etc.) se puede mover y agrandar/achicar a mano, como una foto:
// click para seleccionarlo (ahí aparece el borde + la manija redonda en
// la esquina para redimensionar), arrastrarlo para moverlo, arrastrar la
// manija para agrandar/achicar. Click en el fondo deselecciona — en ese
// estado la pantalla se ve limpia, sin ningún borde ni manija, lista
// para mostrar en la competencia. Se guarda por navegador/pantalla.
// ════════════════════════════════════════════════════════════════
const PI_LAYOUT_KEY='yl_pant_intentos_layout';
const PI_DEFAULT_LAYOUT={
  // El cartel de descanso arranca en el medio, tapando la pantalla: cuando está
  // puesto es lo único que importa. De ahí se corre a donde convenga.
  descanso:{x:50,y:45,scale:100},
  record:{x:50,y:7,scale:100},       // cartel de intento de récord: arriba de todo
  liftLabel:{x:50,y:15,scale:100},
  weight:{x:50,y:22,scale:100},
  barbell:{x:50,y:50,scale:100},
  name:{x:50,y:72,scale:100},
  subtitle:{x:50,y:78,scale:100},
  position:{x:50,y:84,scale:100},
  next:{x:50,y:93,scale:100},
  // Los dos logos de la Pantalla de Intentos: arrancan arriba, en las esquinas,
  // que es donde no estorban a nada de lo que ya había.
  logoFed:{x:8,y:9,scale:100},
  logoCamp:{x:92,y:9,scale:100},
  // "Atleta en barra" usa el mismo editor. Las claves llevan b- adelante para no
  // pisarse con las de arriba: las dos disposiciones conviven en el mismo archivo
  // guardado, y cada pantalla dibuja las suyas.
  // Los valores de fábrica reproducen la pantalla tal como estaba antes de que se
  // pudiera mover nada: quien no toque nada no debería notar el cambio.
  bSigla:{x:9,y:11,scale:100},        // SQ 1 / BP 3
  bPeso:{x:91,y:12,scale:100},        // 92 KG
  bNombre:{x:50,y:45,scale:100},
  bRecord:{x:50,y:60,scale:100},      // INTENTO DE RÉCORD
  bLinea:{x:50,y:68,scale:100},
  bPais:{x:10,y:75,scale:100},        // bandera + ARG
  bDatos:{x:50,y:75,scale:100},       // -63 kg · JR · Classic
  bLogo:{x:90,y:75,scale:100},        // logo del campeonato
  bLogoFed:{x:90,y:88,scale:100},     // logo de la federación
  bLuces:{x:50,y:90,scale:100}        // las luces de los jueces
};
// Cada logo subido es un bloque suyo: bLogoN0, bLogoN1… en "atleta en barra" y
// logoN0, logoN1… en la pantalla de intentos. Como son tantos como logos haya,
// no pueden estar escritos en PI_DEFAULT_LAYOUT: la posición de fábrica se
// calcula. Van en fila para que no salgan uno encima del otro, y de ahí se
// arrastra cada uno a donde corresponda.
const _RX_LOGO_N=/^(b?)[Ll]ogoN(\d+)$/;
window._piLayout=_piLoadLayout();
window._piSelected=null;
window.piResetLayout=function(){
  if(!confirm('¿Restablecer las posiciones y tamaños de la Pantalla de Intentos a los valores por defecto?'))return;
  // Las de "Atleta en barra" son las que empiezan con b y mayúscula (bSigla,
  // bPeso…). 'barbell' es de esta pantalla, por eso se pide la mayúscula.
  _piResetClaves(k=>!/^b[A-Z]/.test(k));
};
window.barraResetLayout=function(){
  if(!confirm('¿Volver a dejar "Atleta en barra" como venía de fábrica?\nSe pierden las posiciones y tamaños que acomodaste en esta pantalla.'))return;
  _piResetClaves(k=>/^b[A-Z]/.test(k));
};
// Ajustes de pantalla: mostrar/ocultar cronómetro y colores personalizados
// (fondo/acento/texto), para adaptarse a la iluminación de cada recinto.
// Se guardan por navegador/pantalla, igual que la disposición de bloques.
const PI_SETTINGS_KEY='yl_pant_intentos_settings';
// showTimer en false: la pantalla de tarima no muestra cronómetro (el reloj del
// minuto lo lleva el control, no la proyección). Se puede prender desde el
// engranaje de esa misma pantalla.
// fondoBandera: la bandera del país del atleta, difuminada, detrás de la
// pantalla de intentos. Viene encendida — es lo que identifica de quién es el
// intento desde el fondo del gimnasio— y se apaga desde el engranaje cuando el
// proyector o la luz de la sala no la acompañan.
const PI_DEFAULT_SETTINGS={showTimer:false,fondoBandera:true,bgColor:'',accentColor:'#D4A843',textColor:'#ffffff'};
window._piSettings=_piLoadSettings();
window._piPanelOpen=false;
window.piSetSetting=function(key,val){
  window._piSettings[key]=val;
  _piSaveSettings();
  if(typeof R==='function')R();
};
window.piToggleSettingsPanel=function(){
  window._piPanelOpen=!window._piPanelOpen;
  if(typeof R==='function')R();
};
window.piResetColors=function(){
  window._piSettings.bgColor=PI_DEFAULT_SETTINGS.bgColor;
  window._piSettings.accentColor=PI_DEFAULT_SETTINGS.accentColor;
  window._piSettings.textColor=PI_DEFAULT_SETTINGS.textColor;
  _piSaveSettings();
  if(typeof R==='function')R();
};
// Handlers globales de click/arrastre/redimensión — se registran una sola vez,
// funcionan sobre cualquier .pi-block presente en el DOM en cada momento.
if(!window._piHandlersInit){
  window._piHandlersInit=true;
  // mousedown solo arranca redimensión o arrastre (necesita capturar la posición
  // inicial en el acto). La selección/deselección vive en 'click' (más abajo):
  // si se hiciera acá, un R() en pleno mousedown reemplaza el DOM antes de que
  // el navegador dispare 'click', y ese click se pierde — por ejemplo al hacer
  // clic en el engranaje de ajustes justo después de tener un bloque seleccionado.
  document.addEventListener('mousedown',function(e){
    // El editor sirve en cualquier pantalla que se marque como lienzo, no solo
    // en la de Intentos: "Atleta en barra" usa el mismo mecanismo.
    const container=e.target.closest&&e.target.closest('.pi-canvas');
    if(!container)return;
    const resizeEl=e.target.closest && e.target.closest('.pi-resize');
    if(resizeEl){
      e.preventDefault();
      const key=resizeEl.getAttribute('data-pi-key');
      window._piResize={key,startY:e.clientY,startScale:_piPos(key).scale||100};
      return;
    }
    const block=e.target.closest && e.target.closest('.pi-block');
    if(!block||block.getAttribute('data-pi-key')!==window._piSelected)return;
    e.preventDefault();
    const key=block.getAttribute('data-pi-key');
    const rect=container.getBoundingClientRect();
    const pos=_piPos(key);
    window._piDrag={key,startX:e.clientX,startY:e.clientY,startPosX:pos.x,startPosY:pos.y,rectW:rect.width,rectH:rect.height};
  });
  document.addEventListener('click',function(e){
    // El editor sirve en cualquier pantalla que se marque como lienzo, no solo
    // en la de Intentos: "Atleta en barra" usa el mismo mecanismo.
    const container=e.target.closest&&e.target.closest('.pi-canvas');
    if(!container)return;
    if(e.target.closest && e.target.closest('.pi-resize'))return;
    const block=e.target.closest && e.target.closest('.pi-block');
    if(!block){
      if(window._piSelected){window._piSelected=null;if(typeof R==='function')R();}
      return;
    }
    const key=block.getAttribute('data-pi-key');
    if(window._piSelected!==key){
      window._piSelected=key;
      if(typeof R==='function')R();
    }
  });
  document.addEventListener('mousemove',function(e){
    if(window._piDrag){
      const d=window._piDrag;
      const pos=_piPos(d.key);
      pos.x=Math.max(2,Math.min(98,d.startPosX+(e.clientX-d.startX)/d.rectW*100));
      pos.y=Math.max(2,Math.min(98,d.startPosY+(e.clientY-d.startY)/d.rectH*100));
      const el=document.querySelector('.pi-block[data-pi-key="'+d.key+'"]');
      if(el){el.style.left=pos.x+'%';el.style.top=pos.y+'%';}
    } else if(window._piResize){
      const r=window._piResize;
      const pos=_piPos(r.key);
      pos.scale=Math.max(20,Math.min(400,r.startScale+(e.clientY-r.startY)/2));
      const el=document.querySelector('.pi-block[data-pi-key="'+r.key+'"] .pi-inner');
      if(el)el.style.transform='scale('+(pos.scale/100)+')';
    }
  });
  document.addEventListener('mouseup',function(){
    if(window._piDrag){_piSaveLayout();window._piDrag=null;}
    if(window._piResize){_piSaveLayout();window._piResize=null;}
  });
  // Touch — mismo criterio, con un solo dedo. La selección/deselección no se
  // toca acá: el tap sintetiza un 'click' propio, que ya cubre eso arriba.
  document.addEventListener('touchstart',function(e){
    const container=e.target.closest&&e.target.closest('.pi-canvas');
    if(!container||!e.touches[0])return;
    const t=e.touches[0];
    const resizeEl=e.target.closest && e.target.closest('.pi-resize');
    if(resizeEl){
      const key=resizeEl.getAttribute('data-pi-key');
      window._piResize={key,startY:t.clientY,startScale:_piPos(key).scale||100};
      return;
    }
    const block=e.target.closest && e.target.closest('.pi-block');
    if(!block||block.getAttribute('data-pi-key')!==window._piSelected)return;
    const key=block.getAttribute('data-pi-key');
    const rect=container.getBoundingClientRect();
    const pos=_piPos(key);
    window._piDrag={key,startX:t.clientX,startY:t.clientY,startPosX:pos.x,startPosY:pos.y,rectW:rect.width,rectH:rect.height};
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!e.touches[0])return;
    const t=e.touches[0];
    if(window._piDrag){
      const d=window._piDrag;
      const pos=_piPos(d.key);
      pos.x=Math.max(2,Math.min(98,d.startPosX+(t.clientX-d.startX)/d.rectW*100));
      pos.y=Math.max(2,Math.min(98,d.startPosY+(t.clientY-d.startY)/d.rectH*100));
      const el=document.querySelector('.pi-block[data-pi-key="'+d.key+'"]');
      if(el){el.style.left=pos.x+'%';el.style.top=pos.y+'%';}
    } else if(window._piResize){
      const r=window._piResize;
      const pos=_piPos(r.key);
      pos.scale=Math.max(20,Math.min(400,r.startScale+(t.clientY-r.startY)/2));
      const el=document.querySelector('.pi-block[data-pi-key="'+r.key+'"] .pi-inner');
      if(el)el.style.transform='scale('+(pos.scale/100)+')';
    }
  },{passive:true});
  document.addEventListener('touchend',function(){
    if(window._piDrag){_piSaveLayout();window._piDrag=null;}
    if(window._piResize){_piSaveLayout();window._piResize=null;}
  });
}
window.descPoner=function(min){
  const seg=Math.round(Number(min)*60);
  if(!(seg>0))return;
  const rot=(document.getElementById('descTexto')||{}).value;
  _descEscribe({active:true,startedAt:Date.now(),durationSec:seg,
    label:(rot||'').trim(),pausedAt:0,videos:[],movement:'',style:_descEstiloPrevio()});
};
window.descPausar=function(){
  const bt=_descBT(); if(!bt)return;
  if(bt.pausedAt){
    // Seguir: se corre el arranque tanto como duró la pausa, así no se pierde
    // el tiempo que estuvo detenido.
    _descEscribe(Object.assign({},bt,{startedAt:bt.startedAt+(Date.now()-bt.pausedAt),pausedAt:0}));
  } else {
    _descEscribe(Object.assign({},bt,{pausedAt:Date.now()}));
  }
};
window.descQuitar=function(){
  _descEscribe({active:false,startedAt:0,durationSec:0,label:'',pausedAt:0,
    videos:[],movement:'',style:_descEstiloPrevio()});
};
// Los minutos que se usan de verdad entre tandas y para arrancar la jornada.
const DESC_MINUTOS=[5,10,15,20,30];
// La Pantalla de Intentos tiene su panel de ajustes completo y ahí el descanso va
// adentro. Atleta en Barra y la Tabla de Jornada no tienen panel —sus ajustes no
// existen— así que llevan un botón propio, con el reloj y nada más. Sin esto, el
// descanso solo se podía poner estando en la Pantalla de Intentos, y el operador
// de la tarima no siempre está en esa.
window._descPanelOpen=false;
window.descTogglePanel=function(){
  window._descPanelOpen=!window._descPanelOpen;
  if(typeof renderTxWidget==='function'&&TX_MODE)renderTxWidget();
  else if(typeof R==='function')R();
};
// Re-sincroniza la nómina con el admin. Trae todos los atletas aprobados/pendientes
// desde Firestore y reconcilia: agrega nuevos, elimina los que ya no están (sin datos)
// y avisa de los borrados que tienen pesos/intentos cargados.
window.resyncFromAdmin=async function(){
  if(!fbReady||!window._fb){alert('Firebase no listo todavía. Espera unos segundos y vuelve a intentar.');return}
  if(!DATA.event){alert('No hay competencia activa');return}
  if(!confirm('Re-sincronizar la nómina con el admin?\n\n• Trae atletas nuevos\n• Borra los que ya no están en admin (si NO tienen pesos/intentos cargados acá)\n• Avisa de los borrados que sí tienen datos para revisarlos a mano\n• Toma tanda, división, categoría y modalidad de la pestaña Cronograma\n\nLotes y pesaje se conservan. La categoría de los que ya están pesados no se toca.'))return;
  const evId=Object.keys(LIVE_EVENTS).find(k=>LIVE_EVENTS[k]===DATA.event.name)||DATA.event.id||DATA.event.name;
  try{
    const q=window._fb.query(
      window._fb.collection(fbDB,'inscripciones'),
      window._fb.where('evento','==',evId),
      window._fb.where('status','in',['approved','pending'])
    );
    const snap=await window._fb.getDocs(q);
    const flightMap=await _loadCronoFlightMap(evId);
    const fbAthletes=snap.docs
      .map(d=>({...d.data(),id:d.id}))
      .sort((a,b)=>((a.timestamp==null?void 0:a.timestamp.seconds)||0)-((b.timestamp==null?void 0:b.timestamp.seconds)||0))
      .map((ins,j)=>_inscToAthlete(ins,j,flightMap));
    if(!fbAthletes.length){alert('No hay inscripciones aprobadas/pendientes en Firestore para este campeonato.');return}
    _mergeFirebaseAthletes(fbAthletes);
    // Forzar nuevo render para que los toasts se ordenen
    showToastLC('Re-sincronización completa: '+fbAthletes.length+' atletas en Firestore');
  }catch(e){alert('Error sincronizando: '+(e.message||e));console.error(e)}
};
// Editar el lote a mano. Si el número nuevo ya lo tenía otro atleta,
// hace un swap (intercambia los lotes entre los dos).
window.setLot=function(id,val){
  const n=parseInt(val,10);
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(!Number.isFinite(n)||n<1){
    showToastLC('Lote inválido — debe ser un número entero ≥ 1');
    R();return;
  }
  if(n===a.lot){R();return}
  const other=DATA.athletes.find(x=>x.lot===n&&x.id!==id);
  if(other){
    // Swap: el otro recibe el lote anterior
    other.lot=a.lot;
    a.lot=n;
  } else {
    a.lot=n;
  }
  _markAtt(id,'meta');
  save();R();
};
// ─── OBS WEBSOCKET (Stream Deck → OBS → Panel) ─────────────────
// Permite controlar el director con cualquier botón de Stream Deck que
// envíe un "Custom Event" a OBS via WebSocket. El panel escucha los
// CustomEvents y los mapea a las funciones dir* existentes.
let _obsWs=null, _obsWsConnected=false, _obsWsError='';
let _obsWsSettings=(()=>{try{return JSON.parse(localStorage.getItem('obs_ws_settings')||'')}catch(e){}return{host:'localhost',port:4455,password:'',autoConnect:false}})();
let _obsWsLog=[];
window.obsWsSaveAndConnect=function(){
  _obsWsSettings={
    host:(__o=>__o==null?void 0:__o.value)(document.getElementById('obsWsHost'))||'localhost',
    port:parseInt((__o=>__o==null?void 0:__o.value)(document.getElementById('obsWsPort')),10)||4455,
    password:(__o=>__o==null?void 0:__o.value)(document.getElementById('obsWsPass'))||'',
    autoConnect:(__o=>__o==null?void 0:__o.checked)(document.getElementById('obsWsAuto'))||false
  };
  try{localStorage.setItem('obs_ws_settings',JSON.stringify(_obsWsSettings))}catch(e){}
  obsWsConnect();
};
window.obsWsToggleConnection=function(){
  if(_obsWsConnected)obsWsDisconnect();else obsWsConnect();
};
// Envía un CustomEvent a través de OBS para verificar el roundtrip.
// OBS lo broadcastea, nuestro listener lo recibe → toggle profile.
window.obsWsTestEvent=async function(){
  if(!_obsWs||!_obsWsConnected){alert('Conecta primero a OBS WebSocket');return}
  try{
    await _obsWs.call('BroadcastCustomEvent',{eventData:{action:'toggle',component:'profile',_test:true}});
    alert('Evento enviado a OBS. Si la conexión está bien, el perfil debería togglearse en pantalla en 1-2s. Mira el log de abajo, "Últimos eventos recibidos".');
  }catch(e){alert('Error enviando evento: '+(e.message||e))}
};
// Auto-conectar al cargar (si está habilitado)
if(_obsWsSettings.autoConnect){
  // Esperar a que la lib esté lista
  let tries=0;const w=setInterval(()=>{tries++;if(window.OBSWebSocket||tries>30){clearInterval(w);if(window.OBSWebSocket)obsWsConnect()}},200);
}
// ─── DIRECTOR PANEL (control manual del widget ?tx=director) ───
let _dirState=null;
let _dirUnsub=null;
let _dirBtDrag=null;
 // drag state para el editor visual del break timer
// ── Video picker: lista dinámica desde Firebase Storage videos/break/ ──
let _dirBtVideoList=null;
 // null=no cargado aún, []=cargado vacío, [{name,url},...]=ok
let _dirBtVideoUploading=false;
window.dirBtLoadVideos=function(){_dirLoadBtVideos();};
window.dirBtUploadVideo=async function(){
  if(_dirBtVideoUploading)return;
  const inp=document.createElement('input');inp.type='file';inp.accept='video/mp4,video/webm,video/mov,.mp4,.webm,.mov';inp.multiple=true;
  inp.onchange=async()=>{
    if(!inp.files||!inp.files.length)return;
    if(!window._fbSt||!window._fbStInst){alert('Storage no disponible');return;}
    _dirBtVideoUploading=true;R();
    const {ref,uploadBytes}=window._fbSt;
    const errs=[];
    for(const f of inp.files){
      try{
        const r=ref(window._fbStInst,'videos/break/'+f.name);
        await uploadBytes(r,f,{contentType:f.type||'video/mp4'});
      }catch(e){errs.push(f.name+': '+e.message);}
    }
    _dirBtVideoUploading=false;
    if(errs.length)alert('Errores:\n'+errs.join('\n'));
    await _dirLoadBtVideos(); // refresh list
  };
  inp.click();
};
// Logo DEL CAMPEONATO (no del break timer): persiste en Firestore eventos/{evId}.logoUrl
// y se muestra en scoreboard, perfil, tabla actual y en el barrido de transición.
window.dirUploadChampionshipLogo=async function(){
  if(!window._fbSt||!window._fbStInst){alert('Storage no disponible todavía');return;}
  if(!DATA.event){alert('Primero elige un evento');return;}
  const evId = DATA.event.id || DATA.event.name;
  const inp=document.createElement('input');inp.type='file';inp.accept='image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp';
  inp.onchange=async()=>{
    const f=inp.files&&inp.files[0];if(!f)return;
    const btn=document.getElementById('dirChampLogoBtn');if(btn)btn.textContent='Subiendo...';
    try{
      // Si el logo trae un fondo liso alrededor —el caso normal cuando llega como
      // JPG— se ofrece sacarlo. Sobre el barrido o el scoreboard, ese cuadrado se
      // ve encima de todo.
      let subir=f, nombre=f.name, tipo=f.type;
      if(!/svg/i.test(f.type)){
        try{
          if(btn)btn.textContent='Revisando…';
          const sin=await _logoSinFondo(f);
          if(sin){
            const pct=Math.round(sin.quitados/sin.total*100);
            const col='rgb('+sin.fondo.r+', '+sin.fondo.g+', '+sin.fondo.b+')';
            if(confirm('Este logo tiene un fondo liso ('+col+') que ocupa el '+pct+'% de la imagen.\n\n'
              +'¿Quitarlo y dejarlo transparente?\n\nSe recomienda: sobre el barrido y el scoreboard, '
              +'ese fondo se ve como un cuadrado encima de la transmisión.')){
              subir=sin.blob; tipo='image/png';
              nombre=f.name.replace(/\.[^.]+$/,'')+'_sinfondo.png';
            }
          }
        }catch(e){ console.warn('[logo] no se pudo revisar el fondo',e); }
      }
      if(btn)btn.textContent='Subiendo...';
      const {ref,uploadBytes,getDownloadURL}=window._fbSt;
      const safeId=evId.replace(/[^a-zA-Z0-9_]/g,'_');
      const r=ref(window._fbStInst,'logos/event/'+safeId+'_'+nombre);
      await uploadBytes(r,subir,{contentType:tipo});
      const url=await getDownloadURL(r);
      // Guardar en el doc del evento
      await window._fb.updateDoc(window._fb.doc(fbDB,'eventos',evId),{logoUrl:url});
      DATA.event.logoUrl=url;
      // Forzar sync inmediato a livecast_sync para que los widgets de OBS lo vean
      try{ if(typeof syncToFB==='function') await syncToFB(); }catch(e){}
      R();
      if(btn)btn.textContent='Subido';
      setTimeout(()=>{if(btn)btn.textContent='Cambiar logo'},2000);
    }catch(e){alert('Error subiendo logo: '+e.message); if(btn)btn.textContent='Cambiar logo';}
  };
  inp.click();
};
window.screenLogosSubir=async function(){
  if(!window._fbSt||!window._fbStInst){alert('Storage no disponible todavía');return;}
  if(!DATA.event){alert('Primero elige un campeonato');return;}
  const inp=document.createElement('input');
  inp.type='file';inp.multiple=true;
  inp.accept='image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp';
  inp.onchange=async()=>{
    const files=[...(inp.files||[])]; if(!files.length)return;
    const btn=document.getElementById('scrLogosBtn');
    const rot=btn?btn.textContent:'';
    try{
      const {ref,uploadBytes,getDownloadURL}=window._fbSt;
      const safeId=_evIdActual().replace(/[^a-zA-Z0-9_]/g,'_');
      const lista=(Array.isArray(DATA.event.logosPantalla)?DATA.event.logosPantalla:[]).slice();
      for(let i=0;i<files.length;i++){
        const f=files[i];
        if(btn)btn.textContent='Subiendo '+(i+1)+'/'+files.length+'…';
        const limpio=f.name.replace(/[^A-Za-z0-9._-]/g,'_');
        const r=ref(window._fbStInst,'logos/pantalla/'+safeId+'_'+Date.now()+'_'+limpio);
        await uploadBytes(r,f,{contentType:f.type||'image/png'});
        lista.push({url:await getDownloadURL(r),nombre:f.name});
      }
      await _guardaLogosPantalla(lista);
      showToastLC(files.length+(files.length>1?' logos agregados':' logo agregado'));
    }catch(e){ alert('Error subiendo: '+(e.message||e)); }
    finally{ if(btn)btn.textContent=rot||'Agregar logos'; }
  };
  inp.click();
};
window.screenLogoBorrar=async function(i){
  const lista=(Array.isArray(DATA.event&&DATA.event.logosPantalla)?DATA.event.logosPantalla:[]).slice();
  const q=lista[i]; if(!q)return;
  if(!confirm('¿Sacar "'+(q.nombre||'este logo')+'" de la pantalla?'))return;
  lista.splice(i,1);
  // El archivo se queda en Storage a propósito: si fue un error, se vuelve a
  // agregar desde el mismo link sin tener que buscarlo de nuevo en el
  // computador. Ocupa unos KB.
  try{ await _guardaLogosPantalla(lista); showToastLC('Logo sacado de la pantalla'); }
  catch(e){ alert('Error: '+(e.message||e)); }
};
window.screenLogoMover=async function(i,paso){
  const lista=(Array.isArray(DATA.event&&DATA.event.logosPantalla)?DATA.event.logosPantalla:[]).slice();
  const j=i+paso;
  if(!lista[i]||j<0||j>=lista.length)return;
  const t=lista[i];lista[i]=lista[j];lista[j]=t;
  try{ await _guardaLogosPantalla(lista); }catch(e){ alert('Error: '+(e.message||e)); }
};
// Qué logo va en el barrido. Se guarda con el campeonato, así que queda elegido
// para la próxima vez sin tener que acordarse.
window.dirSetBarridoLogo=async function(cual){
  if(!DATA.event){alert('Primero elige un evento');return;}
  const val=cual==='campeonato'?'campeonato':'yourlift';
  DATA.event.barridoLogo=val;
  R();
  try{
    const evId=DATA.event.id||DATA.event.name;
    await window._fb.updateDoc(window._fb.doc(fbDB,'eventos',evId),{barridoLogo:val});
    if(typeof syncToFB==='function')await syncToFB();   // que los widgets de OBS lo vean ya
  }catch(e){ console.warn('[barrido] no se pudo guardar la elección',e); }
};
window.dirClearChampionshipLogo=async function(){
  if(!DATA.event)return;
  if(!confirm('¿Quitar el logo del campeonato?'))return;
  const evId = DATA.event.id || DATA.event.name;
  try{
    await window._fb.updateDoc(window._fb.doc(fbDB,'eventos',evId),{logoUrl:''});
    DATA.event.logoUrl='';
    try{ if(typeof syncToFB==='function') await syncToFB(); }catch(e){}
    R();
  }catch(e){alert('Error: '+e.message);}
};
window.dirBtUploadEventLogo=async function(){
  if(!window._fbSt||!window._fbStInst){alert('Storage no disponible todavía');return;}
  const inp=document.createElement('input');inp.type='file';inp.accept='image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp';
  inp.onchange=async()=>{
    const f=inp.files&&inp.files[0];if(!f)return;
    const btn=document.getElementById('dirBtEvLogoBtn');if(btn)btn.textContent='Subiendo...';
    try{
      const {ref,uploadBytes,getDownloadURL}=window._fbSt;
      const r=ref(window._fbStInst,'logos/event/'+f.name);
      await uploadBytes(r,f,{contentType:f.type});
      const url=await getDownloadURL(r);
      // Guardar en el estilo inmediatamente
      if(!_dirState)_dirState={};
      if(!_dirState.breakTimer)_dirState.breakTimer={};
      if(!_dirState.breakTimer.style)_dirState.breakTimer.style={};
      _dirState.breakTimer.style.eventLogoUrl=url;
      await _dirPush();R();
    }catch(e){alert('Error subiendo logo: '+e.message);}
    if(btn)btn.textContent='SUBIR';
  };
  inp.click();
};
window.dirBtClearEventLogo=async function(){
  if(!(_dirState==null?void 0:(_dirState.breakTimer==null?void 0:_dirState.breakTimer.style)))return;
  _dirState.breakTimer.style.eventLogoUrl='';
  await _dirPush();R();
};
window.dirBtDeleteVideo=async function(name){
  if(!confirm('¿Eliminar '+name+'?'))return;
  if(!window._fbSt||!window._fbStInst)return;
  try{
    const {ref,deleteObject}=window._fbSt;
    await deleteObject(ref(window._fbStInst,'videos/break/'+name));
    await _dirLoadBtVideos();
  }catch(e){alert('Error al eliminar: '+e.message);}
};
let _dirUnsubDocId=null;
// Broadcastea datos de competencia vía OBS para el widget (no depende de Firestore).
// El widget en OBS no puede leer Firestore, pero sí recibe obsCustomEvent.
let _obsWsSyncInterval=null;
window.dirShow=async function(comp,seconds,opts){
  if(!_dirState)_dirState={};
  const until=seconds>0?Date.now()+seconds*1000:0;
  // Mutual exclusion entre componentes fullscreen (profile y leaderboard).
  // Si activo uno y el otro está prendido, lo apago automáticamente.
  const FULLSCREEN_EXCLUSIVE = ['profile','leaderboard'];
  if(FULLSCREEN_EXCLUSIVE.includes(comp)){
    FULLSCREEN_EXCLUSIVE.forEach(other=>{
      if(other!==comp){
        const o=_dirState[other];
        if(o && o.active){
          _dirState[other]=Object.assign({},o,{active:false,until:0});
        }
      }
    });
    // Al activar un fullscreen (perfil/leaderboard), apagar tambien la Tabla Actual.
    // Asi cuando se quite el fullscreen la tabla NO reaparece sola; debe re-activarse a mano.
    const ta=_dirState.tablaActual;
    if(ta && ta.active){
      _dirState.tablaActual=Object.assign({},ta,{active:false,until:0});
    }
  }
  // El medallero es una banda de abajo, no un fullscreen, así que quedaba tapado
  // por el Perfil, la Tabla Actual o el Break Timer — y el panel igual mostraba
  // "EN PANTALLA" en verde. Se activa a propósito para premiar, así que ahora
  // apaga lo que lo taparía: apretar MEDALLERO muestra el medallero.
  if(comp==='medals'){
    ['profile','leaderboard','breakTimer'].forEach(otro=>{
      const o=_dirState[otro];
      if(o&&o.active)_dirState[otro]=Object.assign({},o,{active:false,until:0});
    });
  }
  _dirState[comp]=Object.assign({},_dirState[comp]||{},{active:true,until},opts||{});
  await _dirPush();R();
};
window.dirHide=async function(comp){
  if(!_dirState)return;
  _dirState[comp]=Object.assign({},_dirState[comp]||{},{active:false,until:0});
  await _dirPush();R();
};
window.dirHideAll=async function(){
  ['profile','scoreboard','leaderboard','timer','slam','tablaActual','medals','luces'].forEach(k=>{_dirState[k]=Object.assign({},_dirState[k]||{},{active:false,until:0})});
  await _dirPush();R();
};
window.dirShowLb=async function(cat,seconds){
  await window.dirShow('leaderboard',seconds,{cat:cat||''});
};
// ── Medallero: selects en cascada (modalidad → sexo → división → categoría) ──
// Todo sale de DATA.athletes, ya cargado local en memoria — NO dispara ninguna
// lectura nueva a Firestore. Selección local (_mdSel), se re-renderiza el panel
// con R() igual que el resto del Control TX (sin listeners ni docs extra).
window._mdSel={mod:'',sex:'',div:'',cat:'',tipo:'total'};
window.dirMdSet=function(field,val){
  window._mdSel[field]=val;
  if(field==='tipo'){/* el tipo no toca la selección: es la misma categoría, otro premio */}
  else if(field==='mod'){window._mdSel.sex='';window._mdSel.div='';window._mdSel.cat='';}
  else if(field==='sex'){window._mdSel.div='';window._mdSel.cat='';}
  else if(field==='div'){window._mdSel.cat='';}
  R();
};
window.dirToggleMedals=async function(){
  const c=_dirState&&_dirState.medals;
  const isOn=c&&c.active&&(!c.until||c.until>Date.now());
  if(isOn){await window.dirHide('medals');return;}
  const{mod,sex,div,cat,tipo}=window._mdSel;
  if(!mod||!sex||!div||!cat){showToastLC('Elige modalidad, sexo, división y categoría primero');return;}
  await window.dirShow('medals',0,{mod,sex,div,cat,tipo:tipo||'total'});
};
window.dirShowSlam=async function(type){
  await window.dirShow('slam',2,{type});
};
// Toggle ON/OFF (mismo botón / misma tecla = on si está off, off si está on)
window.dirToggle=async function(comp){
  const c=_dirState&&_dirState[comp];
  const isOn=c&&c.active&&(!c.until||c.until>Date.now());
  if(isOn) await window.dirHide(comp);
  else await window.dirShow(comp,0); // permanente
};
window.dirToggleLb=async function(){
  const c=_dirState&&_dirState.leaderboard;
  const isOn=c&&c.active&&(!c.until||c.until>Date.now());
  if(isOn) await window.dirHide('leaderboard');
  else {
    // Usa la categoría seleccionada en el dropdown (vacía = auto = cat del lifter actual)
    const cat=(__o=>__o==null?void 0:__o.value)(document.getElementById('dirLbCat'))||'';
    await window.dirShowLb(cat,0);
  }
};
window.dirSetScale=async function(comp,scale){
  if(!_dirState)_dirState={};
  const s=Math.max(0.5,Math.min(2.0,parseFloat(scale)||1));
  _dirState[comp]=Object.assign({},_dirState[comp]||{},{scale:s});
  await _dirPush();
  // Solo re-render si está activo (cambia visual en pantalla)
  if(DATA.phase==='director')R();
};
window.dirResetScale=async function(comp){await window.dirSetScale(comp,1)};
window.dirSetColor=async function(key,val){
  if(!_dirState)_dirState={};
  if(!_dirState.colors)_dirState.colors={};
  _dirState.colors[key]=val;
  _txColorsLS=Object.assign({},_txColorsLS,{[key]:val});
  try{localStorage.setItem('fechipo_tx_colors',JSON.stringify(_dirState.colors))}catch(e){}
  await _dirPush();
  if(DATA.phase==='director')R();
};
window.dirResetColors=async function(){
  if(!_dirState)return;
  _dirState.colors={};_dirState.palette=null;
  _txColorsLS={};
  try{localStorage.removeItem('fechipo_tx_colors')}catch(e){}
  await _dirPush();
  if(DATA.phase==='director')R();
};
window.setTxProfileMedia=function(type){
  _txProfileMediaType=type;
  try{localStorage.setItem('fechipo_tx_prof_media',type)}catch(e){}
  if(_dirState){_dirState.profileMediaType=type;_dirPush();}
  if(typeof renderTxWidget==='function')renderTxWidget();
  if(typeof R==='function')R();
};
window.dirApplyPalette=async function(name){
  const p=_TX_COLOR_PALETTES[name];if(!p)return;
  if(!_dirState)_dirState={};
  _dirState.colors={...p.colors};
  _dirState.palette=name;
  _txColorsLS={...p.colors};
  try{localStorage.setItem('fechipo_tx_colors',JSON.stringify(_dirState.colors))}catch(e){}
  try{localStorage.setItem('fechipo_tx_palette',name)}catch(e){}
  await _dirPush();
  if(DATA.phase==='director')R();
};
window.dirToggleBreak=async function(){
  const bt=_dirState&&_dirState.breakTimer;
  if(bt&&bt.active){await window.dirBreakHide();return}
  // Si los inputs existen y tienen valor los usa; si no, default 10 min
  const mEl=document.getElementById('dirBreakMin');
  const sEl=document.getElementById('dirBreakSec');
  const m=parseInt((mEl==null?void 0:mEl.value)||'0',10)||10;
  const s=parseInt((sEl==null?void 0:sEl.value)||'0',10)||0;
  if(mEl)mEl.value=m;
  if(sEl)sEl.value=s;
  await window.dirBreakStart();
};
// Atajos de teclado para Stream Deck
window._dirKeyHandler=function(e){
  // Atajos del director (Stream Deck): funcionan desde CUALQUIER vista admin del
  // LiveCast (Control en Vivo, Control TX, etc.) — no solo en la vista Director.
  // Así puedes prender/apagar la Tabla Actual del stream con el Stream Deck mientras
  // operás la competencia. Requiere ser admin y NO tener foco en un input.
  if(!isAdmin)return;
  // Ignorar si hay foco en un input/textarea/select (no pisar la edición de pesos)
  const tag=((document.activeElement==null?void 0:document.activeElement.tagName)||'').toUpperCase();
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  // Solo teclas simples sin modificadores (evita pisar atajos del navegador/SO)
  if(e.ctrlKey||e.altKey||e.metaKey)return;
  const k=(e.key||'').toLowerCase();
  const map={p:'profile',s:'scoreboard',t:'timer'};
  if(map[k]){e.preventDefault();window.dirToggle(map[k]);return}
  if(k==='l'){e.preventDefault();window.dirToggleLb();return}
  if(k==='a'){e.preventDefault();window.dirToggle('tablaActual');return}
  if(k==='u'){e.preventDefault();window.dirToggle('luces');return}
  if(k==='m'){e.preventDefault();window.dirToggleMedals();return}
  if(k==='g'){e.preventDefault();window.dirShowSlam('g');return}
  if(k==='n'){e.preventDefault();window.dirShowSlam('n');return}
  if(k==='b'){e.preventDefault();window.dirToggleBreak();return}
  if(k==='0'||k==='escape'){e.preventDefault();window.dirHideAll();return}
};
if(typeof window!=='undefined'&&!window._dirKeyBound){
  window.addEventListener('keydown',function(e){if(window._dirKeyHandler)window._dirKeyHandler(e)});
  window._dirKeyBound=true;
}
// ── Break timer (descanso configurable) ─────────────────────
window.dirBreakStart=async function(){
  const m=parseInt((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBreakMin'))||'0',10)||0;
  const s=parseInt((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBreakSec'))||'0',10)||0;
  const label=((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBreakLabel'))||'').trim();
  const movement=((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBreakMovement'))||'').trim();
  // Videos seleccionados en la lista dinámica
  const videos=(_dirBtVideoList||[]).filter((_,i)=>(__o=>__o==null?void 0:__o.checked)(document.getElementById('dirBtVid_'+i))).map(v=>v.url);
  const durationSec=m*60+s;
  if(durationSec<=0){alert('Ingresa al menos 1 segundo');return}
  if(!_dirState)_dirState={};
  const currentStyle=(_dirState==null?void 0:(_dirState.breakTimer==null?void 0:_dirState.breakTimer.style))||{};
  _dirState.breakTimer={active:true,startedAt:Date.now(),durationSec,label,pausedAt:0,videos,movement,style:currentStyle};
  await _dirPush();R();
};
window.dirBreakPause=async function(){
  if(!(_dirState==null?void 0:(_dirState.breakTimer==null?void 0:_dirState.breakTimer.active)))return;
  if(_dirState.breakTimer.pausedAt)return; // ya pausado
  _dirState.breakTimer.pausedAt=Date.now();
  await _dirPush();R();
};
window.dirBreakResume=async function(){
  const bt=(_dirState==null?void 0:_dirState.breakTimer);
  if(!(bt==null?void 0:bt.active)||!bt.pausedAt)return;
  // Compensar el tiempo de pausa: empujar startedAt por el tiempo pausado
  bt.startedAt+=Date.now()-bt.pausedAt;
  bt.pausedAt=0;
  await _dirPush();R();
};
window.dirBreakHide=async function(){
  if(!_dirState)return;
  const prevStyle=(_dirState.breakTimer==null?void 0:_dirState.breakTimer.style)||{};
  _dirState.breakTimer={active:false,startedAt:0,durationSec:0,label:'',pausedAt:0,videos:[],movement:'',style:prevStyle};
  await _dirPush();R();
};
// ── Break timer visual editor — drag & drop ─────────────────────────────
window.dirBtDown=function(e,type){
  e.preventDefault();
  const cv=document.getElementById('dirBtCanvas');if(!cv)return;
  const r=cv.getBoundingClientRect();
  const stl=((_dirState==null?void 0:(_dirState.breakTimer==null?void 0:_dirState.breakTimer.style)))||{};
  _dirBtDrag={type,
    mx0:(e.clientX-r.left)/r.width*100,
    my0:(e.clientY-r.top)/r.height*100,
    sv:{
      videoX:stl.videoX!=null?stl.videoX:0,videoY:stl.videoY!=null?stl.videoY:5,
      videoW:stl.videoW!=null?stl.videoW:40,videoH:stl.videoH!=null?stl.videoH:80,
      textX:stl.textX!=null?stl.textX:44,textY:stl.textY!=null?stl.textY:10
    }
  };
  if(e.target&&e.target.style)e.target.style.cursor='grabbing';
};
window.dirBtMove=function(e){
  if(!_dirBtDrag)return;
  const cv=document.getElementById('dirBtCanvas');if(!cv)return;
  const r=cv.getBoundingClientRect();
  const mx=(e.clientX-r.left)/r.width*100;
  const my=(e.clientY-r.top)/r.height*100;
  const dx=mx-_dirBtDrag.mx0,dy=my-_dirBtDrag.my0;
  const sv=_dirBtDrag.sv;
  if(!(_dirState==null?void 0:_dirState.breakTimer))return;
  const s=(_dirState.breakTimer.style=(_dirState.breakTimer.style||{}));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  if(_dirBtDrag.type==='vid'){s.videoX=clamp(sv.videoX+dx,0,80);s.videoY=clamp(sv.videoY+dy,0,80);}
  else if(_dirBtDrag.type==='vid-resize'){s.videoW=clamp(sv.videoW+dx,5,95);s.videoH=clamp(sv.videoH+dy,5,100);}
  else if(_dirBtDrag.type==='vid-w'){s.videoW=clamp(sv.videoW+dx,5,95);}
  else if(_dirBtDrag.type==='vid-h'){s.videoH=clamp(sv.videoH+dy,5,100);}
  else if(_dirBtDrag.type==='txt'){s.textX=clamp(sv.textX+dx,0,92);s.textY=clamp(sv.textY+dy,0,90);}
  // Actualizar preview en tiempo real
  const vid=document.getElementById('dirBtVid');
  const txt=document.getElementById('dirBtTxt');
  if(vid){vid.style.left=s.videoX+'%';vid.style.top=s.videoY+'%';vid.style.width=s.videoW+'%';vid.style.height=s.videoH+'%';}
  if(txt){txt.style.left=s.textX+'%';txt.style.top=s.textY+'%';txt.style.maxWidth=(100-s.textX-1)+'%';}
};
window.dirBtUp=function(){_dirBtDrag=null;};
window.dirBtPreviewBg=function(color){
  const cv=document.getElementById('dirBtCanvas');if(cv)cv.style.background=color;
};
window.dirBtApplyStyle=async function(){
  if(!_dirState)return;
  if(!_dirState.breakTimer)_dirState.breakTimer={};
  const s=_dirState.breakTimer.style||{};
  _dirState.breakTimer.style={
    ...s,
    bgColor:(__o=>__o==null?void 0:__o.value)(document.getElementById('dirBtBgColor'))||s.bgColor||'#0A1628',
    accentColor:(__o=>__o==null?void 0:__o.value)(document.getElementById('dirBtAccent'))||s.accentColor||'#C41E3A',
    titleSize:Number((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBtTS'))||s.titleSize||8),
    movSize:Number((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBtMS'))||s.movSize||5),
    timerSize:Number((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBtTmr'))||s.timerSize||12),
    blurAmount:Number((__n=>__n!=null?__n:(24))((__n=>__n!=null?__n:(s.blurAmount))((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBtBlur'))))),
    overlayOpacity:Number((__n=>__n!=null?__n:(0.65))((__n=>__n!=null?__n:(s.overlayOpacity))((__o=>__o==null?void 0:__o.value)(document.getElementById('dirBtOv'))))),
    showLogos:(__o=>__o==null?void 0:__o.checked)(document.getElementById('dirBtShowLogos'))!==false,
    eventLogoUrl:(__n=>__n!=null?__n:(''))((__n=>__n!=null?__n:(s.eventLogoUrl))((__o=>__o==null?void 0:__o.dataset.url)(document.getElementById('dirBtEvLogo')))),
  };
  await _dirPush();R();
};
window.dirBreakAdd=async function(secs){
  const bt=(_dirState==null?void 0:_dirState.breakTimer);
  if(!(bt==null?void 0:bt.active))return;
  bt.durationSec=Math.max(1,(bt.durationSec||0)+secs);
  await _dirPush();R();
};
// ═══════════════════════════════════════════════════════════════════
// CONTROL REMOTO (phone-first) — alternativa al Stream Deck / OBS WebSocket.
// Grilla de botones grandes que empujan los MISMOS comandos a Firestore
// (livecast_director) que el panel Control TX. Se abre en el teléfono con
// ?remote=1 y controla el overlay de OBS (browser source ?tx=director) sin
// puente, sin WebSocket, sin Stream Deck. Reusa las funciones dir* existentes.
// ═══════════════════════════════════════════════════════════════════
// ── Menús desplegables del Control Remoto ────────────────────────────────────
// El remoto lo usa alguien con una mano, mirando la tarima. Dos botones pedían
// datos que solo existían en el Control TX: el medallero necesita saber QUÉ podio
// mostrar, y el descanso CUÁNTOS minutos. Sin eso, apretarlos no hacía nada útil.
// Ahora abren su menú en el mismo teléfono.
window._remoteMenu='';
window.remoteMenu=function(cual){
  window._remoteMenu = (window._remoteMenu===cual) ? '' : cual;
  R();
  // Los botones ocupan toda la pantalla, así que el menú se abre debajo: se lo
  // trae a la vista para que no parezca que el botón no hizo nada.
  if(window._remoteMenu)setTimeout(function(){
    const p=document.getElementById('rmPanel');
    if(p)p.scrollIntoView({behavior:'smooth',block:'nearest'});
  },60);
};
addEventListener('resize',function(){
  if(DATA.phase!=='remote')return;
  clearTimeout(window._rmResTO);
  window._rmResTO=setTimeout(function(){ try{R();_rmMedir();}catch(e){} },120);
},{passive:true});
window.remoteOrdenar=function(){ window._rmOrdenar=!window._rmOrdenar; window._rmSel=null; window._remoteMenu=''; R(); };
window.remoteOrdenTap=function(id){
  if(!window._rmSel){ window._rmSel=id; R(); return; }
  if(window._rmSel!==id){
    const ids=['profile','scoreboard','tablaActual','luces','leaderboard','timer','medals','descanso','good','nolift','esconder'];
    const o=_rmOrden(ids), i=o.indexOf(window._rmSel), j=o.indexOf(id);
    if(i>=0&&j>=0){ o[i]=id; o[j]=window._rmSel; try{ localStorage.setItem('yl_remoteOrden',JSON.stringify(o)); }catch(e){} }
  }
  window._rmSel=null; R();
};
window.remoteOrdenReset=function(){
  try{ localStorage.removeItem('yl_remoteOrden'); }catch(e){}
  window._rmSel=null; R();
};
// Arranca el descanso con los minutos del remoto, sin depender de los campos del
// Control TX: en el teléfono esos inputs no existen.
window.remoteBreakStart=async function(min){
  let m=min;
  if(!m){ m=parseInt((document.getElementById('remoteBreakMin')||{}).value||'0',10); }
  if(!m||m<1){ showToastLC('Elige cuántos minutos'); return; }
  if(!_dirState)_dirState={};
  const previo=_dirState.breakTimer||{};
  // Se arma igual que en el Control TX, pero conservando lo que ya estaba
  // configurado ahí —el estilo, los videos, el texto— para que el cartel se vea
  // igual se dispare desde donde se dispare.
  _dirState.breakTimer=Object.assign({},previo,{
    active:true, startedAt:Date.now(), durationSec:m*60, pausedAt:0,
  });
  await _dirPush();
  window._remoteMenu='';
  R();
  showToastLC('Descanso de '+m+' min en pantalla');
};
window.remoteToggleBreak=async function(){
  const bt=_dirState&&_dirState.breakTimer;
  if(bt&&bt.active){ await window.dirBreakHide(); window._remoteMenu=''; R(); return; }
  window.remoteMenu('break');
};
// ── Buscar y filtrar en Atletas & Pesaje ────────────────────────────────────
// Con 552 atletas y tandas hasta la Z, la tabla de corrido no sirve: en el cuarto
// día encontrar a alguien es bajar por quinientas filas. Esto filtra SOLO lo que
// se dibuja — los lotes, el orden y todo lo que se calcula siguen viendo la nómina
// completa.
window._MAN_F={q:'',flight:''};
window.manBuscar=function(v){
  window._MAN_F.q=String(v||'');
  R();
  // Devolver el cursor al buscador y al final del texto, que si no hay que
  // volver a hacer clic entre letra y letra.
  const i=document.getElementById('manQ');
  if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}
};
window.manTanda=function(f){ window._MAN_F.flight=(window._MAN_F.flight===f)?'':f; R(); };
window.manLimpiar=function(){ window._MAN_F={q:'',flight:''}; R(); };
// Celda de un intento (peso + botones) para la tabla de "Todas las tandas" de Control en Vivo.
// isCurrentCell = es el intento que se está juzgando ahora mismo (tanda+lift+round activos y atleta en tarima).
// Tamaño de las casillas de intentos en "Todas las tandas" — ajustable por el operador
// (útil en pantallas grandes o para tocar más fácil en touch). Persiste en localStorage.
window._CT_CELL_SCALE=parseFloat(localStorage.getItem('yl_ct_cellscale')||'1')||1;
window.setCtCellScale=function(v){
  window._CT_CELL_SCALE=Math.max(0.7,Math.min(2.2,parseFloat(v)||1));
  try{localStorage.setItem('yl_ct_cellscale',window._CT_CELL_SCALE)}catch(e){}
  R();
};
window.nudgeCtCellScale=function(d){window.setCtCellScale(window._CT_CELL_SCALE+d)};
// Auto-scroll de "TODAS LAS TANDAS" al atleta en tarima (por defecto ENCENDIDO).
window._ctAutoScroll=localStorage.getItem('yl_ct_autoscroll')!=='0';
window.toggleCtAutoScroll=function(){
  window._ctAutoScroll=!window._ctAutoScroll;
  try{localStorage.setItem('yl_ct_autoscroll',window._ctAutoScroll?'1':'0')}catch(e){}
  if(window._ctAutoScroll)window._ctScrollKey=null; // forzar un reacomodo al reactivar
  R();
};
// Orden de divisiones (helper global)
const _DIV_ORDER=function(d){
  const x=(d||'').toLowerCase().replace(/[\s-]/g,'');
  if(x.includes('subjunior'))return 1;
  if(x.includes('junior'))return 2;
  if(x.includes('open'))return 3;
  if(x.includes('masteri')&&!x.includes('masterii')&&!x.includes('masteriii')&&!x.includes('masteriv'))return 4;
  if(x.includes('masterii')&&!x.includes('masteriii'))return 5;
  if(x.includes('masteriii'))return 6;
  if(x.includes('masteriv'))return 7;
  if(x.includes('universitario'))return 8;
  return 99;
};
// ── Filtros de la tabla de Resultados ────────────────────────────────────────
// Género, categoría, división de edad y modalidad. Es una preferencia de ESTA
// pantalla: no se sincroniza con el resto del equipo y no toca las actas, que
// siguen saliendo con el campeonato completo.
window._RES_F={sex:'',cat:'',div:'',mod:''};
window.setResF=function(campo,val){
  const F=window._RES_F||(window._RES_F={sex:'',cat:'',div:'',mod:''});
  if(campo in F)F[campo]=val||'';
  R();
};
window.limpiarResF=function(){ window._RES_F={sex:'',cat:'',div:'',mod:''}; R(); };
// Las cuatro tablas de Resultados, para el filtro de modalidad.
const _RES_MODS=[['classic','Powerlifting Classic'],['equipped','Powerlifting Equipado'],
  ['bench','Only Bench'],['oe','Olimpiadas Especiales']];
let txView='envivo',txChroma='#000000',txScale=100;
// Widget positions/scales — survive R() re-renders
const TX_POS={
  lights:{x:null,y:null,scale:100},
  marc:{x:null,y:null,scale:100}
};
// INIT
// Auto-clean old localStorage keys
try{localStorage.removeItem('fechipo_lc2');localStorage.removeItem('fechipo_livecast')}catch(e){}
const loaded=load();
// Entrando desde el panel (Admin → YourLift) se quiere ELEGIR campeonato, no
// seguir en el último que quedó abierto en ese navegador. Sin esto, el link
// entraba directo al de la última vez y nunca se veía el selector.
try{
  if(new URLSearchParams(location.search).get('operar')==='1'
     && !new URLSearchParams(location.search).get('evento')){
    DATA.phase='setup'; DATA.event=null; DATA.athletes=[];
    window._EV_FILTER=null;
    try{ window._recentAtt={}; if(window._pendingEdits)window._pendingEdits.clear(); }catch(e){}
  }
}catch(e){}
try{_ensayoGrant();}catch(e){}
let DB_FULL=[];
// ══════════════════════════════════════════════
// MODO PRÁCTICA (?practica=1) — roster ficticio + bootstrap
// ══════════════════════════════════════════════
const PRACTICE_EVENT_NAME='PRÁCTICA — Jueces (datos ficticios, no oficial)';
// Rellena los 3 intentos de cada atleta con pesos declarados (sin resultado), para
// practicar en la Pantalla de Tarima / Control en Vivo. Ejecutable desde la consola:
//   fillPracticeWeights()            → 3 intentos por levantamiento
//   fillPracticeWeights({results:true}) → además marca válidos/nulos realistas
window.fillPracticeWeights=function(opts){
  opts=opts||{};
  if(!DATA.athletes||!DATA.athletes.length){showToastLC('No hay atletas cargados');return;}
  const rnd25=v=>Math.round(v/2.5)*2.5;
  const isM=a=>(a.sex==='Hombre'||a.sex==='Masculino'||a.sex==='M');
  DATA.athletes.forEach(a=>{
    // Solo los dígitos de la categoría: con el formato real '-59 kg (Hombre)'
    // parseFloat daba -59 (negativo) y los pesos generados quedaban negativos
    // → la cola de tarima salía vacía.
    const catNum=parseFloat((String(a.cat).match(/\d+(\.\d+)?/)||[])[0])||100;
    const factor=isM(a)?1:0.62;
    const base={
      sq:rnd25((a.att.sq&&a.att.sq[0]&&a.att.sq[0].w)||catNum*0.85*factor),
      bp:rnd25((a.att.bp&&a.att.bp[0]&&a.att.bp[0].w)||catNum*0.55*factor),
      dl:rnd25((a.att.dl&&a.att.dl[0]&&a.att.dl[0].w)||catNum*1.0*factor)
    };
    ['sq','bp','dl'].forEach(l=>{
      const o=base[l], step=(l==='bp')?2.5:5;
      const ws=[o,o+step,o+2*step];
      a.att[l]=ws.map((w,i)=>{
        let r=null;
        if(opts.results){ r=(i<2)?'g':(Math.random()<0.5?'g':'n'); } // 1º y 2º válidos, 3º al azar
        return {w,r};
      });
    });
  });
  DATA.lift='sq';DATA.round=0;
  saveNow();R();
  showToastLC('Pesos de práctica cargados en '+DATA.athletes.length+' atletas'+(opts.results?' (con resultados)':''));
  return 'OK — '+DATA.athletes.length+' atletas con pesos';
};
// Link de la vista de ESPECTADOR de la práctica (lo que ve el público). Se copia
// al portapapeles para mandárselo a la gente que quiere ir mirando.
window.practiceViewerUrl=function(){
  // El espectador debe leer el MISMO sandbox que el admin: si es práctica con
  // nómina real, el link lleva &real=1 (usa la clave de localStorage real).
  return location.origin+location.pathname.replace(/[^/]*$/,'')+'livecast.html?practica=1'+(PRACTICE_REAL?'&real=1':'')+'&espectador=1';
};
window.copyPracticeViewerLink=function(){
  const url=practiceViewerUrl();
  if(navigator.clipboard){navigator.clipboard.writeText(url).then(()=>showToastLC('Link de espectador copiado')).catch(()=>showToastLC(url));}
  else showToastLC(url);
};
if(PRACTICE_MODE){
  _initPracticeMode();
  _initPracticeSync();
  // En práctica + TX (Pantalla de Tarima / widgets) no hay snapshot de Firestore
  // que dispare el primer render una vez que el #txWidget existe en el DOM. Lo
  // forzamos al terminar de cargar el DOM (en modo real lo hace onSnapshot).
  if(TX_MODE){
    const _firstPaint=()=>{try{if(typeof renderTxWidget==='function')renderTxWidget();}catch(e){}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(_firstPaint,60));
    else setTimeout(_firstPaint,60);
  }
} else if(!TX_MODE){
  // Auto-pick event si vino ?evento= en la URL (fallback por si los eventos
  // ya están en DATA.events de nominas.json antes de que el listener Firestore corra)
  setTimeout(()=>{try{if(!window._autoEvtTried){window._autoEvtTried=true;applyEventURLParam()}}catch(e){}},150);
}
// ── Auto-backup every 30 seconds ─────────────────────────────
const BACKUP_KEY=PRACTICE_REAL?'fechipo_lc3_backup_practica_real':PRACTICE_MODE?'fechipo_lc3_backup_practica':'fechipo_lc3_backup';
setInterval(()=>{
  if(DATA.phase==='setup'||!DATA.athletes.length)return;
  try{
    const snap={
      ts:Date.now(),
      tsLabel:new Date().toLocaleTimeString('es-CL'),
      phase:DATA.phase,event:DATA.event,athletes:DATA.athletes,
      lift:DATA.lift,round:DATA.round,flight:DATA.flight,
      changeTimers:DATA.changeTimers,lotsGenerated:DATA.lotsGenerated
    };
    localStorage.setItem(BACKUP_KEY,JSON.stringify(snap));
  }catch(e){}
},30000);
const _STOR='https://firebasestorage.googleapis.com/v0/b/fechipo-db-13148.firebasestorage.app/o/';
fetch(_STOR+'public%2Fdata.json?alt=media',{cache:'no-cache'})
  .then(r=>r.ok?r.json():fetch('data.json').then(r=>r.json()))
  .catch(()=>fetch('data.json').then(r=>r.json()))
  .then(d=>{DB_FULL=d;_aplicarEdicionesDB();
    if(window._fotosUltSnap){_fotosAlPadron(window._fotosUltSnap);if(typeof R==='function')R();}
  }).catch(()=>{});
fetch(_STOR+'public%2Frecords.json?alt=media',{cache:'no-cache'})
  .then(r=>r.ok?r.json():fetch('records.json').then(r=>r.json()))
  .catch(()=>fetch('records.json').then(r=>r.json()))
  .then(d=>{if(!window._RECORDS_FS)RECORDS=d}).catch(()=>console.warn('[FECHIPO] records.json no cargado'));
// Récords sudamericanos (FESUPO) — solo se usan en los eventos que los declaran
// (records:'suda'). Archivo estático: se genera con herramientas/build_records_suda.py.
fetch('records_suda.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null)
  .then(d=>{ if(d&&d.records){RECSUDA=d.records;_SR_CLASES=null;window._SR_FUENTE=d.fuente||'';window.RECSUDA=d.records;if(DATA.phase==='compete'||DATA.phase==='liveView')R();} })
  .catch(()=>console.warn('[FECHIPO] records_suda.json no cargado'));
fetch('records_mundiales.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null)
  .then(d=>{ if(d&&d.records){RECMUNDIAL=d.records;if(DATA.phase==='compete'||DATA.phase==='liveView')R();} })
  .catch(()=>console.warn('[FECHIPO] records_mundiales.json no cargado'));
// DATA.events se construye desde Firestore (LIVE_EVENT_META en renderSetup) MÁS
// los eventos con nómina propia de nominas.json (ej. Sudamericano Día 1..9, que
// no tienen inscripciones en Firestore: su roster viene del archivo). renderSetup
// evita duplicar: si un evento ya está acá por nombre, no lo agrega de Firestore
// — y para esos, loadLiveAthletes igual sincroniza atletas en vivo si existen.
if(!DEMO_MODE&&!(PRACTICE_MODE&&!PRACTICE_REAL)){
  fetch('nominas.json',{cache:'no-cache'}).then(r=>r.json()).then(j=>{
    ((j&&j.events)||[]).forEach(ev=>{
      if(!ev||!ev.name||!Array.isArray(ev.athletes)||!ev.athletes.length)return;
      if(DATA.events.some(e=>e.name===ev.name))return;
      DATA.events.push(ev);
    });
    window._NOMINAS_LISTA=true;
    if(DATA.phase==='setup'&&DATA.events.length)R();
    // por si vino ?evento= apuntando a un evento de nominas.json. Se llama DIRECTO
    // (sin el guard _autoEvtTried): los eventos recién llegaron, y si otro caller
    // temprano ya agotó sus reintentos esperándolos, este es el que resuelve.
    // applyEventURLParam es idempotente (si el evento ya está elegido, no hace nada).
    if(window._EV_URL_PEND&&(window._EV_ESPERANDO||_evUrlPendiente())){
      try{window._autoEvtTried=true;_applyEvtRetries=0;applyEventURLParam();}catch(e){}
    }
  }).catch(e=>{window._NOMINAS_LISTA=true;console.warn('[LC] nominas.json no cargado',e);});
}else window._NOMINAS_LISTA=true;
if(!loaded)R();
// ════════════════════════════════════════════════════════════════
// DEMO MODE — para grabar videos promocionales sin compe real
// URL: livecast.html?demo=1
// ════════════════════════════════════════════════════════════════
if(DEMO_MODE){
  console.log('DEMO MODE activo');
  // Atletas demo con datos realistas
  const DEMO_ATHLETES=[
    {nombre:'Felipe Rieutord',rut:'20540088-5',sexo:'Hombre',categoria:'-83',division:'Universitario',modalidad:'Powerlifting Classic',club:'All Power CD',universidad:'Universidad de Chile',bw:82.5,att:{sq:[{w:240,r:'g'},{w:255,r:'g'},{w:265,r:'g'}],bp:[{w:155,r:'g'},{w:165,r:'g'},{w:170,r:null}],dl:[{w:280,r:'g'},{w:295,r:null},{w:0,r:null}]}},
    {nombre:'Andrés Landon Osorio',rut:'21030894-6',sexo:'Hombre',categoria:'-120',division:'Universitario',modalidad:'Powerlifting Classic',club:'Bushido Lifting',universidad:'UTEM',bw:118.4,att:{sq:[{w:290,r:'g'},{w:310,r:'g'},{w:320,r:null}],bp:[{w:180,r:'g'},{w:195,r:'g'},{w:200,r:null}],dl:[{w:270,r:'g'},{w:285,r:'g'},{w:295,r:null}]}},
    {nombre:'Francisco Pérez Tapia',rut:'22604383-7',sexo:'Hombre',categoria:'-83',division:'Universitario',modalidad:'Powerlifting Classic',club:'South Side Club',universidad:'PUC',bw:82.8,att:{sq:[{w:225,r:'g'},{w:240,r:'g'},{w:250,r:null}],bp:[{w:140,r:'g'},{w:150,r:'g'},{w:0,r:null}],dl:[{w:275,r:'g'},{w:0,r:null},{w:0,r:null}]}},
    {nombre:'Karen Pulecio Girón',rut:'22863335-6',sexo:'Mujer',categoria:'-69',division:'Universitario',modalidad:'Powerlifting Classic',club:'All Power CD',universidad:'USACH',bw:68.5,att:{sq:[{w:157.5,r:'g'},{w:167.5,r:'g'},{w:177.5,r:'g'}],bp:[{w:72.5,r:'g'},{w:78,r:'g'},{w:0,r:null}],dl:[{w:170,r:'g'},{w:185,r:'g'},{w:0,r:null}]}},
    {nombre:'Luna Mora Báez',rut:'20724095-8',sexo:'Mujer',categoria:'-63',division:'Universitario',modalidad:'Powerlifting Classic',club:'Himalaya Powerlifting',universidad:'PUC',bw:62.8,att:{sq:[{w:140,r:'g'},{w:150,r:'g'},{w:160,r:'g'}],bp:[{w:75,r:'g'},{w:82,r:null},{w:0,r:null}],dl:[{w:155,r:'g'},{w:165,r:null},{w:0,r:null}]}},
    {nombre:'Keily Rojas Peraza',rut:'26312215-1',sexo:'Mujer',categoria:'-57',division:'Universitario',modalidad:'Powerlifting Classic',club:'Himalaya Powerlifting',universidad:'UV',bw:55.5,att:{sq:[{w:115,r:'g'},{w:122.5,r:'g'},{w:0,r:null}],bp:[{w:65,r:'g'},{w:72.5,r:'g'},{w:0,r:null}],dl:[{w:155,r:'g'},{w:162.5,r:'g'},{w:0,r:null}]}},
    {nombre:'José Conejera Figueroa',rut:'20758484-3',sexo:'Hombre',categoria:'-74',division:'Universitario',modalidad:'Powerlifting Classic',club:'All Power CD',universidad:'UDP',bw:73.8,att:{sq:[{w:185,r:'g'},{w:200,r:'g'},{w:205,r:'g'}],bp:[{w:125,r:'g'},{w:132.5,r:null},{w:0,r:null}],dl:[{w:215,r:'g'},{w:230,r:'g'},{w:0,r:null}]}},
    {nombre:'Emilio Galvez Ramos',rut:'20870444-3',sexo:'Hombre',categoria:'-93',division:'Universitario',modalidad:'Powerlifting Classic',club:'South Side Club',universidad:'UTEM',bw:91.2,att:{sq:[{w:220,r:'g'},{w:240,r:'g'},{w:0,r:null}],bp:[{w:140,r:'g'},{w:147.5,r:'g'},{w:0,r:null}],dl:[{w:265,r:'g'},{w:280,r:'g'},{w:0,r:null}]}},
  ];
  DEMO_ATHLETES.forEach((a,i)=>{
    a.id=i; a.lot=i+1;
    a.flight='A'; a.mod='universitario'; a.bombed=false;
    a.cat=a.categoria; a.div=a.division; a.sex=a.sexo;
    a.uni=a.universidad; a.name=a.nombre;
    a.rackSQ='14'; a.rackBP='6';
  });
  DATA.event={name:'DEMO — Campeonato Universitario FECHIPO 2026',id:'demo_event',recordsEnabled:true};
  DATA.athletes=DEMO_ATHLETES;
  DATA.phase='compete';
  DATA.lift='sq'; DATA.round=2; DATA.flight='A';
  DATA.timer=60; DATA.timerOn=false;
  DATA.changeTimers={};
  save && save();

  // Panel flotante con botones de demo
  setTimeout(()=>{
    const panel=document.createElement('div');
    panel.id='demoPanel';
    panel.innerHTML=`
      <div style="position:fixed;top:14px;right:14px;z-index:99998;background:rgba(8,16,30,.95);border:2px solid #D4A843;border-radius:12px;padding:14px;backdrop-filter:blur(8px);min-width:280px;font-family:Oswald,sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid rgba(212,168,67,.3);padding-bottom:8px">
          <span style="color:#D4A843;font-size:12px;font-weight:700;letter-spacing:2px">DEMO MODE</span>
          <button onclick="document.getElementById('demoPanel').style.display='none'" style="background:none;border:0;color:#8A9BB2;font-size:18px;cursor:pointer;padding:0 4px">×</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
          <button onclick="demoShow('profile')" style="padding:8px;background:rgba(196,30,58,.2);border:1px solid #C41E3A;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:1px">PERFIL</button>
          <button onclick="demoShow('scoreboard')" style="padding:8px;background:rgba(59,130,246,.2);border:1px solid #3B82F6;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:1px">SCOREBOARD</button>
          <button onclick="demoShow('leaderboard')" style="padding:8px;background:rgba(212,168,67,.2);border:1px solid #D4A843;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:1px">LEADERBOARD</button>
          <button onclick="demoShow('timer')" style="padding:8px;background:rgba(34,197,94,.2);border:1px solid #22c55e;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:1px">TIMER</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
          <button onclick="demoSlam('g')" style="padding:8px;background:#16a34a;border:0;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px"><i class=yl-i-check></i> GOOD LIFT</button>
          <button onclick="demoSlam('r')" style="padding:8px;background:#dc2626;border:0;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px"><i class=yl-i-cruz></i> NO LIFT</button>
        </div>
        <button onclick="demoRecord()" style="width:100%;padding:10px;background:linear-gradient(90deg,#D4A843,#C41E3A);border:0;border-radius:6px;color:#fff;font-family:Oswald;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:2px;margin-bottom:8px">SIMULAR RÉCORD</button>
        <button onclick="demoBreak()" style="width:100%;padding:8px;background:rgba(168,85,247,.2);border:1px solid #a855f7;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:1px;margin-bottom:8px"><i class=yl-i-pausa></i> BREAK TIMER</button>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button onclick="demoPrev()" style="flex:1;padding:6px;background:rgba(122,143,166,.15);border:1px solid #8A9BB2;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;cursor:pointer">← ANTERIOR</button>
          <button onclick="demoNext()" style="flex:1;padding:6px;background:rgba(122,143,166,.15);border:1px solid #8A9BB2;border-radius:6px;color:#fff;font-family:Oswald;font-size:11px;cursor:pointer">SIGUIENTE →</button>
        </div>
        <div id="demoCurrent" style="color:#8A9BB2;font-size:10px;text-align:center;padding-top:8px;border-top:1px solid rgba(122,143,166,.2);letter-spacing:1px"></div>
      </div>
    `;
    document.body.appendChild(panel);
    window._demoIdx=0;
    window.demoUpdate=function(){
      const a=DATA.athletes[window._demoIdx];
      document.getElementById('demoCurrent').textContent=`Atleta: ${a.name} · ${a.cat}kg`;
    };
    window.demoNext=function(){window._demoIdx=(window._demoIdx+1)%DATA.athletes.length;window.demoUpdate();R&&R();};
    window.demoPrev=function(){window._demoIdx=(window._demoIdx-1+DATA.athletes.length)%DATA.athletes.length;window.demoUpdate();R&&R();};
    window.demoShow=function(type){
      const a=DATA.athletes[window._demoIdx];
      if(!_txDirState[type])_txDirState[type]={};
      _txDirState[type].active=true;
      _txDirState[type].until=Date.now()+15000;
      if(type==='leaderboard')_txDirState[type].cat=a.cat;
      R&&R();
      if(typeof renderTxWidget==='function')renderTxWidget();
      showToastLC&&showToastLC('Mostrando '+type);
    };
    window.demoSlam=function(t){
      const a=DATA.athletes[window._demoIdx];
      if(typeof showRecordAlert==='function'){
        // Trigger slam visual
        _txDirState.slam={active:true,type:t,until:Date.now()+2500,scale:1};
        R&&R();
        if(typeof renderTxWidget==='function')renderTxWidget();
        showToastLC&&showToastLC(t==='g'?'GOOD LIFT':'NO LIFT');
      }
    };
    window.demoRecord=function(){
      const a=DATA.athletes[window._demoIdx];
      const att=a.att[DATA.lift][DATA.round]||{w:0};
      const w=att.w||a.att.sq[1].w||220;
      if(typeof showRecordAlert==='function'){
        showRecordAlert(a.name,DATA.lift,DATA.round,w,w-15,'Record Anterior',a.cat,a.div,'universitario');
        if(typeof pushRecordToFB==='function'){
          // No push real, solo trigger local
          _txCerRecordUntil=Date.now()+TX_CEREMONY.recordMs;
          _txCerRecordData={athName:a.name,lift:DATA.lift,round:DATA.round,newMark:w,oldMark:w-15,holder:'Record Anterior',cat:a.cat,div:a.div,mod:'universitario',ts:Date.now()};
        }
        R&&R();
        if(typeof renderTxWidget==='function')renderTxWidget();
      }
    };
    window.demoBreak=function(){
      if(typeof window.dirBreakStart==='function'){
        _dirState.breakTimer={active:true,startedAt:Date.now(),durationSec:300,label:'BREAK ENTRE LIFTS',pausedAt:0,videos:[],movement:'Squat → Bench Press',style:{}};
        R&&R();
        if(typeof renderTxWidget==='function')renderTxWidget();
        showToastLC&&showToastLC('Break activado (5 min)');
      }
    };
    window.demoUpdate();
  },800);
}
// ── Accept ?evento=<id|name> URL param ──
// If the URL asks for a specific event and it differs from the saved session,
// force phase back to 'setup' so the user picks again (or auto-pick if match).
let _applyEvtRetries=0;
// ¿Cuánto esperar al evento del link?
//
// Antes se esperaban unos 8 segundos contados en reintentos, y después se
// mostraba la lista. En el teléfono, con Firestore lento, eso no alcanzaba: la
// persona tocaba "VER EN VIVO" en el sitio y caía en la lista de campeonatos,
// y cuando los datos llegaban ya nadie volvía a buscar el del link. Además cada
// llamada (el temporizador de arranque, nominas.json) abría su propia cadena de
// reintentos sobre el mismo contador, y la espera real era la mitad.
//
// Ahora se espera a lo que puede decir dónde está el evento —nominas.json y la
// primera lista de campeonatos de Firestore—, con un tope de 30 segundos por si
// Firebase no carga nunca. Y si igual se agota, el listener de campeonatos lo
// vuelve a buscar cuando llega (ver _evUrlPendiente).
const _EV_ESPERA_MAX=30000;
let _applyEvtT0=0,_applyEvtTimer=null;
window._EV_URL_PEND=window._EV_ESPERANDO;
// Arranque: resolver el evento desde ?evento= en la URL. Imprescindible para
// los widgets TX (profile/jornada/screen/etc.) abiertos en un navegador fresco
// (OBS, pantalla de tarima) que no tienen sesión en localStorage.
applyEventURLParam();
// ══════════════════════════════════════════════════════════════════
// TRANSMISIÓN EN VIVO (para el público)
//
// El link sale de la ficha del campeonato en el admin. En un campeonato de
// ocho días hay una transmisión por día: se pega el link nuevo ahí y listo —
// acá se detecta solo y el video cambia sin que nadie recargue nada.
//
// El <iframe> se monta UNA vez en #ytBox y no se vuelve a tocar mientras no
// cambie el link. Eso es lo que permite que la transmisión siga corriendo
// mientras la competencia avanza y mientras el espectador se va a Resultados
// y vuelve. Antes el reproductor se dibujaba dentro de la pantalla, y como la
// pantalla se reescribe entera con cada peso que se carga, el video habría
// vuelto a empezar cada pocos segundos.
// ══════════════════════════════════════════════════════════════════
window._ytOculto=false;
window.ytToggle=function(){ window._ytOculto=!window._ytOculto; _ytSync(); };
let _ytMontado='';
// Solo el público y solo donde mirar tiene sentido. En una pantalla de
// operación el video estorba, y el audio se mete en la sala.
const _YT_PANTALLAS=['liveView','results','atletaInfo'];
// ── Vista del espectador: qué tanda mirar y en qué formato ──────────────────
// El espectador puede quedarse mirando una tanda aunque la tarima avance. Se apoya
// en la vista libre que ya usa el operador: con NAV_LIBRE, el lift/ronda/tanda de
// ESTA pantalla no se toca cuando llega un snapshot, así que cargar un peso en la
// tanda que está compitiendo ya no lo devuelve de un salto.
// ── Los días del campeonato y sus tandas ─────────────────────────────────
// El Sudamericano tiene 36 tandas en ocho días. En una tira sola —A, B… Z, AA…
// AJ— no hay forma de encontrar la de uno sin contar letras, así que primero se
// elige el día y quedan a la vista las cuatro o cinco de ese día.
//
// El día sale de la jornada que cada atleta trae anotada ("D3 22/09 · 10:00 · …").
// Los campeonatos de un día no la traen, no hay días que elegir y todo se ve
// igual que siempre.
//
// Elegir un día NO cambia nada de la competencia: filtra qué botones se dibujan.
// La tarima, la tanda activa y la sincronización quedan donde estaban.
window._DIA_SEL = window._DIA_SEL || {};
// Orden de los días escritos a mano, con el mismo criterio que el Cronograma del
// panel: por nombre de día de la semana, si no por el primer número, si no
// alfabético. (Con el nombre suelto, "domingo" quedaba antes que "sábado".)
const _DIAS_SEM_LC=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
window.verDia=function(zona,d){ window._DIA_SEL[zona]=d; try{R();}catch(e){} };
window.liveVerTanda=function(f){
  // AUTOMÁTICO (o IR A LA TARIMA) también vuelve a seguir al que está levantando.
  if(!f){ setNavLibre(false); window._siguiendoTarima=true; window._liveLastKey=null; }
  else { window.setNavLibre(true); DATA.flight=f; }
  try{ R(); }catch(e){}
};
window.liveSeguirTarima=function(){
  window._siguiendoTarima=true; window._liveLastKey=null;
  if(window.NAV_LIBRE){ window.liveVerTanda(null); return; }
  try{ R(); }catch(e){}
};
// Girar el tablet cruza el umbral: se redibuja una sola vez, y solo si de verdad
// cambió de lado. Sin esto la vista se queda con el formato del ancho anterior.
addEventListener('resize',function(){
  const ahora=_anchoDaParaLinea();
  if(window._ultLinea===ahora)return;
  window._ultLinea=ahora;
  clearTimeout(window._tLinea);
  window._tLinea=setTimeout(function(){ try{R();}catch(e){} },180);
},{passive:true});

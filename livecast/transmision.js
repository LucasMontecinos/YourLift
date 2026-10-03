// livecast.html — Transmisión: los widgets de OBS (?tx=…), Control TX, el director, OBS WebSocket y los logos de la transmisión.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

function _txC(key){
  const c=(_dirState&&_dirState.colors)||(_txDirState&&_txDirState.colors)||_txColorsLS;
  return (c&&c[key])||_TX_COLOR_DEFAULTS[key];
}

function renderObsTx(){
  const evId=(DATA.event==null?void 0:DATA.event.id)||(DATA.event==null?void 0:DATA.event.name)||'';
  const base=location.origin+location.pathname.replace(/[^/]+$/,'');
  const enc=encodeURIComponent(evId);
  const widgets=[
    {id:'profile',icon:'',title:'Perfil del atleta',desc:'Pantalla completa con foto placeholder, nombre, club, categoría, edad, años compitiendo y PB. Animación cascada al entrar. Mostrar ~10s antes de la tarima.',obsBg:'Opaca (azul oscuro). Escena fullscreen.',size:'1920×1080'},
    {id:'scoreboard',icon:'',title:'Scoreboard (lower-third)',desc:'Barra inferior con categoría, rank, timer, nombre, club e intentos. Aparece al cambiar levantador / intento / peso, queda 20s en pantalla y se va con animación. Hasta el próximo cambio queda oculto.',obsBg:'Transparente (superpuesto sobre cámara).',size:'1920×320 (parte inferior)'},
    {id:'barbell',icon:'',title:'Barra con discos (lower-third)',desc:'Franja inferior que muestra la barra con discos IPF a color, nombre del atleta, club, categoría, peso del intento en kg/lbs, ronda y pronóstico de posición ("Si es válido pasará del X° al Y° lugar"). Se anima al entrar cuando cambia el levantador.',obsBg:'Transparente (overlay sobre cámara). Fondo se fusiona hacia abajo.',size:'1920×1080 (contenido en el tercio inferior)'},
    {id:'leaderboard',icon:'',title:'Tabla de clasificación (FIJO)',desc:'Ranking completo de la categoría actual. Cascada fila por fila. SIEMPRE visible mientras la escena esté activa — úsalo para escenas de pausa entre rondas que manejas tú manualmente.',obsBg:'Opaca (azul oscuro). Escena fullscreen.',size:'1920×1080'},
    {id:'tablaactual',icon:'',title:'Tabla actual (corner)',desc:'Ranking de la categoría del lifter en pantalla, esquina inferior derecha. Entra deslizando desde abajo, queda fijo. El levantador actual se resalta y muestra una flecha de proyección: posición actual → posición que tendría si el intento es válido (ej. 2→1 si se mueve al primer lugar). Activa/desactiva con el botón "Tabla actual" en Control TX o tecla A.',obsBg:'Transparente (overlay sobre cámara). Solo ocupa el cuadrante inferior derecho.',size:'1920×1080 (overlay)'},
    {id:'lbauto',icon:'',title:'Tabla de clasificación (AUTO)',desc:'Igual al leaderboard fijo, pero APARECE SOLO al detectar fin de ronda (cuando cambia lift/round/flight). Queda 10s en pantalla y se va. Ideal como overlay siempre activo en una escena de cámara.',obsBg:'Transparente (overlay sobre cámara).',size:'1920×1080 (overlay fullscreen)'},
    {id:'slam',icon:'',title:'Slam GOOD LIFT / NO LIFT',desc:'Flash de 2s con texto enorme verde (GOOD LIFT) o rojo (NO LIFT). Activa una sola vez con el botón "slam" del Stream Deck → queda armado y dispara automáticamente cuando marcas válido o nulo en Control en Vivo. Vuelve a apretar el botón para desarmarlo.',obsBg:'Transparente. Sumar como capa encima de la cámara, siempre visible.',size:'1920×1080 (overlay fullscreen)'},
    {id:'lights',icon:'',title:'Luces de jueces',desc:'3 círculos para izq / central / der. Se prenden blanco (good) o rojo (no lift) cuando los jueces votan en su panel. Ideal arriba de la cámara o en pantalla aparte.',obsBg:'Transparente. Funciona solo si activas "Modo Jueces" en Control en Vivo.',size:'1920×1080 (autoescala)'},
    {id:'ceremony',icon:'',title:'Ceremonia (TODO-EN-UNO automático)',desc:'Widget orquestador. Detecta nuevo levantador → PROFILE fullscreen 5s → SCOREBOARD bottom-left (30s) → SLAM top-left flash al marcar resultado → IDLE hasta el próximo. Sin tabla de clasificación: ese ciclo lo manejás aparte con el widget Leaderboard fijo. (El tiempo para dar el intento ya no se muestra acá — es privado, solo lo ve el juez en Control en Vivo.)',obsBg:'Mixto: fullscreen opaco durante PROFILE, transparente sobre cámara durante SCOREBOARD/IDLE. Una sola escena con cámara de fondo + este browser source encima.',size:'1920×1080'},
    {id:'director',icon:'',title:'Director (control 100% MANUAL)',desc:'NO se activa solo. Lee comandos desde Firestore (livecast_director/current) que envías tú desde la barra lateral "Control TX". Cada componente (perfil, marcador, tabla, timer, slam) se muestra/esconde con un botón. Ideal si quieres controlar todo a mano sin tocar OBS.',obsBg:'Mixto. Una sola escena con cámara de fondo + este browser source encima. Tú eliges qué se ve y por cuánto tiempo desde el panel Control TX.',size:'1920×1080'},
  ];
  let h='<div class="fade"><h2 class="os" style="font-size:22px;letter-spacing:1px;margin-bottom:6px">WIDGETS PARA OBS</h2>';
  h+='<p style="color:var(--muted);font-size:12px;margin-bottom:18px">Cada widget es una URL que se agrega como Browser Source en OBS. Actualiza en tiempo real desde Firestore — no necesita login.</p>';
  if(!evId){
    h+='<div class="card" style="background:rgba(239,68,68,.1);border-color:var(--red);color:var(--red);padding:16px">Primero elige un campeonato. Los widgets necesitan saber qué evento mostrar.</div></div>';
    return h;
  }
  h+='<div class="card" style="margin-bottom:14px;padding:12px 16px;background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.3);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
  h+='<div><span style="font-size:10px;color:var(--green);letter-spacing:1px;font-family:Oswald">CAMPEONATO ACTIVO</span><div style="font-family:Oswald;font-size:15px;font-weight:700;margin-top:2px">'+((DATA.event==null?void 0:DATA.event.name)||evId)+'</div></div>';
  h+='</div>';
  // ── Selector de TARIMA: vincula esta página de control y TODOS los links de abajo
  //    a los datos de SU tarima. Sin esto, dos PCs (2 tarimas) leen el mismo doc y se cruzan.
  h+='<div class="card" style="margin-bottom:14px;padding:12px 16px;background:rgba(212,168,67,.08);border-color:rgba(212,168,67,.45)">';
  h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:1px;color:var(--gold);margin-bottom:6px">TARIMA DE ESTE EQUIPO</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.5">Usa Tarima 1/2 SOLO si es <b>una misma competencia</b> dividida en 2 tarimas físicas (mismo evento, flights A1/A2). Si son <b>2 competencias distintas</b> al mismo tiempo, deja <b>"Una sola tarima"</b> y abre el evento que corresponda en cada PC — los datos y el director ya se separan por evento automáticamente.</div>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  [['1','Tarima 1'],['2','Tarima 2'],['','Una sola tarima']].forEach(function(o){
    var t=o[0],l=o[1];
    var u=new URL(location.href); if(t)u.searchParams.set('tarima',t); else u.searchParams.delete('tarima');
    var active=(TARIMA||'')===t;
    h+='<a href="'+u.href+'" class="btn '+(active?'btn-g':'btn-o')+'" style="text-decoration:none;padding:8px 16px">'+(active?'<i class=yl-i-check></i> ':'')+l+'</a>';
  });
  h+='</div>';
  h+=TARIMA
    ? '<div style="margin-top:8px;font-size:11px;color:var(--green)"><i class=yl-i-check></i> Estás en TARIMA '+TARIMA+'. Los links de abajo ya incluyen <b>&tarima='+TARIMA+'</b> — cópialos directo a OBS.</div>'
    : '<div style="margin-top:8px;font-size:11px;color:var(--muted)">Modo "una sola tarima". Si van a transmitir 2 tarimas en paralelo, cada equipo debe elegir Tarima 1 o 2 aquí.</div>';
  h+='</div>';
  {
    // El link lleva el canal del campeonato: con dos campeonatos a la misma hora,
    // cada juez manda sus luces solo al suyo.
    const juezUrl=base+'jueces.html?canal='+encodeURIComponent(fbDocId()||'')+(TARIMA?'&tarima='+TARIMA:'');
    const remoteUrl=base+'livecast.html?evento='+enc+'&remote=1'+(TARIMA?'&tarima='+TARIMA:'')+PRACTICE_Q;
    const linkFila=(titulo,nota,url)=>'<div style="padding:10px 0;border-top:1px solid rgba(29,49,80,.35)">'
      +'<div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px">'+titulo+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin:2px 0 6px;line-height:1.5">'+nota+'</div>'
      +'<div style="display:flex;gap:6px;align-items:center"><input readonly value="'+esc(url)+'" onclick="this.select()" style="flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-family:monospace;font-size:11px">'
      +'<button onclick="navigator.clipboard&&navigator.clipboard.writeText(\''+url.replace(/'/g,"\\'")+'\');showToastLC(\'Link copiado\')" style="padding:8px 12px;border-radius:8px;border:1px solid var(--gold);background:rgba(212,168,67,.12);color:var(--gold);font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">COPIAR</button></div></div>';
    h+='<div class="card" style="padding:14px 18px;margin-bottom:14px">';
    h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold)">LINKS PARA LOS TELÉFONOS</div>';
    h+=linkFila('Panel de jueces','Uno por cada juez. Es de este campeonato'+(TARIMA?' y de la tarima '+TARIMA:'')+': si hay otro corriendo a la misma hora, sus jueces usan el link de ese.',juezUrl);
    h+=linkFila('Control remoto','Para manejar el overlay desde el teléfono.'+(TARIMA?' Con <b>tarima='+TARIMA+'</b>, así controla ESTA tarima y no la otra.':''),remoteUrl);
    h+='</div>';
  }
  h+='<div style="display:grid;gap:14px">';
  widgets.forEach(w=>{
    const url=base+'livecast.html?tx='+w.id+'&evento='+enc+(TARIMA?'&tarima='+TARIMA:'')+PRACTICE_Q;
    h+='<div class="card" style="padding:0;overflow:hidden">';
    h+='<div style="padding:14px 18px;display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">';
    h+='<div style="font-size:28px">'+w.icon+'</div>';
    h+='<div style="flex:1;min-width:240px">';
    h+='<div style="font-family:Oswald;font-size:16px;font-weight:700;letter-spacing:1px">'+w.title+'</div>';
    h+='<div style="color:var(--muted);font-size:12px;margin-top:4px;line-height:1.5">'+w.desc+'</div>';
    h+='<div style="display:flex;gap:14px;margin-top:8px;font-size:10px;color:var(--muted);flex-wrap:wrap">';
    h+='<span>Fondo: <span style="color:var(--text)">'+w.obsBg+'</span></span>';
    h+='<span>Tamaño: <span style="color:var(--text)">'+w.size+'</span></span>';
    h+='</div>';
    h+='</div>';
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
    h+='<a href="'+url+'" target="_blank" class="btn btn-o" style="text-decoration:none;font-size:11px;padding:7px 12px">Preview</a>';
    h+='<button class="btn btn-g" onclick="navigator.clipboard.writeText(\''+url+'\').then(()=>{this.textContent=\'Copiado\';setTimeout(()=>this.textContent=\'Copiar URL\',1500)})" style="font-size:11px;padding:7px 12px">Copiar URL</button>';
    h+='</div>';
    h+='</div>';
    h+='<div style="background:rgba(10,22,40,.6);padding:8px 18px;font-family:monospace;font-size:10px;color:rgba(200,215,240,.6);word-break:break-all;border-top:1px solid var(--border)">'+url+'</div>';
    h+='</div>';
  });
  h+='</div>';
  // OBS setup guide
  h+='<div class="card" style="margin-top:20px;padding:16px 20px">';
  h+='<div class="os" style="font-size:14px;letter-spacing:2px;color:var(--gold);margin-bottom:10px">SETUP EN OBS</div>';
  h+='<ol style="color:var(--muted);font-size:12px;line-height:1.9;padding-left:20px;margin:0">';
  h+='<li>En OBS: <b style="color:var(--text)">Sources → +  → Browser</b> → pega la URL del widget.</li>';
  h+='<li>Width/Height según el widget (Profile y Leaderboard: 1920×1080 · Scoreboard: 1920×1080 también, ya queda posicionado abajo).</li>';
  h+='<li><b style="color:#ff6b6b">DESMARCAR</b> <b style="color:var(--text)">"Refresh browser when scene becomes active"</b>. La animación se reproduce automáticamente cuando OBS activa la escena (vía evento <code>obsSourceActiveChanged</code>), así nunca se ve el flash de carga.</li>';
  h+='<li>Tampoco marqués <b style="color:var(--text)">"Shutdown source when not visible"</b> — mantén el browser source siempre cargado en memoria para que el replay sea instantáneo.</li>';
  h+='<li>Crea <b style="color:var(--text)">escenas separadas</b>: "Cámara + Scoreboard" (cámara de fondo + browser source scoreboard encima), "Profile fullscreen", "Leaderboard fullscreen".</li>';
  h+='<li>Transiciones de OBS (Stinger/Fade/Cut) entre escenas — la animación de entrada la maneja la página al activarse la escena.</li>';
  h+='<li>Los widgets leen el estado en vivo: lifter actual, intento, peso, timer. Cuando marcas válido o nulo en "Control en Vivo", todos los widgets se actualizan en tiempo real.</li>';
  h+='<li>Si una escena no se anima al activarse (versiones viejas de OBS), recarga manualmente el browser source con click derecho → "Refresh".</li>';
  h+='</ol></div>';
  h+='</div>';
  return h;
}

// ══════════════════════════════════════════════
// TRANSMISSION WIDGET RENDERERS
// ══════════════════════════════════════════════
function txLookupFull(a){
  if(!a||!(DB_FULL==null?void 0:DB_FULL.length))return null;
  // El padrón publicado ya no trae RUT: primero se busca por código de atleta.
  if(a.codigo){const c=DB_FULL.find(x=>x.codigo===a.codigo);if(c)return c;}
  const r=(a.rut||'').replace(/[.\s]/g,'');
  if(r)return DB_FULL.find(x=>(x.rut||'').replace(/[.\s]/g,'')===r)||null;
  const nrm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const n=nrm(a.name);
  return DB_FULL.find(x=>nrm(x.nombre)===n)||null;
}

function txAge(dob){
  if(!dob)return null;
  let y,m,d;
  if(/^\d{4}-\d{2}-\d{2}/.test(dob)){[y,m,d]=dob.slice(0,10).split('-').map(Number)}
  else if(/^\d{2}\/\d{2}\/\d{4}/.test(dob)){const p=dob.split('/');d=+p[0];m=+p[1];y=+p[2]}
  else return null;
  const now=new Date();let age=now.getFullYear()-y;
  if(now.getMonth()+1<m||(now.getMonth()+1===m&&now.getDate()<d))age--;
  return age>0&&age<100?age:null;
}

function txYearsCompeting(full){
  if(!(full==null?void 0:(full.competencias==null?void 0:full.competencias.length)))return null;
  const years=full.competencias.map(c=>{
    const f=c.fecha||c.evento||'';
    const m=f.match(/20\d{2}/);return m?+m[0]:null;
  }).filter(Boolean);
  if(!years.length&&full.debut){const m=(full.debut+'').match(/20\d{2}/);if(m)years.push(+m[0])}
  if(!years.length)return null;
  const min=Math.min(...years);const cur=new Date().getFullYear();
  return Math.max(1,cur-min+1);
}

function txPB(full,lift){
  if(!(full==null?void 0:(full.competencias==null?void 0:full.competencias.length)))return null;
  const key=lift==='sq'?'sq':lift==='bp'?'bp':lift==='dl'?'dl':'total';
  let best=0;
  full.competencias.forEach(c=>{const v=+((c.resultado==null?void 0:c.resultado[key])||0);if(v>best)best=v});
  return best||null;
}

// Sigla de la división. Los Master se resuelven del más largo al más corto: antes
// se reemplazaba "Master I" primero, y "Master II" quedaba "M1I" y "Master III"
// "M1II" en la planilla, la tarima y la transmisión.
function txDivShort(div){
  return String(div||'')
    .replace(/Master\s*(IV|4)\b/i,'M4').replace(/Master\s*(III|3)\b/i,'M3')
    .replace(/Master\s*(II|2)\b/i,'M2').replace(/Master\s*(I|1)\b/i,'M1')
    .replace(/Sub[\s-]?Junior/i,'SJR').replace(/Junior/i,'JR').replace(/Open/i,'OPN');
}

function txCatNum(cat){const m=(cat||'').match(/([+\-]?\d+\.?\d*)/);return m?m[1]:''}

// Etiqueta de categoría con el signo CORRECTO: '-120kg' para el límite, '+120kg'
// para superpesados (acepta '+120 kg', '120+ kg' o '-120 kg' como entrada).
function txCatLabel(cat){const n=_normCat(cat);if(!n||!/\d/.test(n))return '';return n.endsWith('+')?('+'+n.slice(0,-1)+'kg'):('-'+n+'kg');}

function renderTxWidget(){
  if(!TX_MODE)return false;
  const c=document.getElementById('txWidget');if(!c)return true;
  // Las pantallas del recinto también escuchan al director: de ahí sale el timer
  // de descanso. Es idempotente — si ya está escuchando el doc correcto, no hace
  // nada.
  if(TX_MODE==='screen'||TX_MODE==='jornada'){try{_txStartDirectorListener()}catch(e){}}
  // Widgets que NO dependen de DATA.athletes
  if(TX_MODE==='timer'){c.innerHTML=renderTxTimer();return true}
  if(TX_MODE==='lights'){c.innerHTML=renderTxLights();return true}
  // Director: no necesita athletes — funciona solo con _txDirState (no requiere Firestore)
  if(TX_MODE==='director'){renderTxDirector(c);return true}
  // Boot gate: el resto de widgets necesitan que llegue el snapshot de Firestore.
  // Hasta entonces, transparente — evita el "pestañeo" (render vacío → render con datos).
  if(!DATA.athletes||DATA.athletes.length===0){c.innerHTML='';return true}
  // Widgets que NO dependen del lifter actual (pero sí de athletes)
  if(TX_MODE==='slam'){c.innerHTML=renderTxSlam();return true}
  if(TX_MODE==='lbauto'){c.innerHTML=renderTxLbAuto();return true}
  if(TX_MODE==='ceremony'){renderTxCeremony(c);return true}
  if(TX_MODE==='jornada'){c.innerHTML=renderTxJornada()+_descCapaHtml()+_descGearHtml();return true}
  if(TX_MODE==='screen'){renderTxScreen(c);return true}
  // Widgets que dependen del lifter actual
  const cur=liftQueue()[0];
  if(!cur&&TX_MODE!=='leaderboard'&&TX_MODE!=='tablaactual'){
    c.innerHTML='';
    return true;
  }
  const lifterChanged=((cur==null?void 0:cur.id)||null)!==_txLastLifter;
  _txLastLifter=(cur==null?void 0:cur.id)||null;
  let html='';
  if(TX_MODE==='profile')html=renderTxProfile(cur);
  else if(TX_MODE==='scoreboard')html=renderTxScoreboard(cur,lifterChanged);
  else if(TX_MODE==='leaderboard')html=renderTxLeaderboard(cur,lifterChanged);
  else if(TX_MODE==='barbell')html=renderTxBarbell(cur,lifterChanged);
  else if(TX_MODE==='tablaactual'){
    const inner=renderTxTablaActual(cur);
    // En modo standalone, animar el slide-in cada vez que cambia el lifter
    const anim=lifterChanged?'animation:txSlideInBottom .75s cubic-bezier(.2,.85,.3,1.05) both':'';
    html=anim?'<div style="'+anim+'">'+inner+'</div>':inner;
  }
  else html='<div style="color:#fff;padding:40px;font-family:Oswald">Widget desconocido: '+TX_MODE+'. Valores: profile | scoreboard | leaderboard | lbauto | slam | timer | lights | barbell | tablaactual</div>';
  c.innerHTML=html;
  // Setup GIF trim loop after DOM insertion
  const _gifVid=c.querySelector('video[data-gif-trim]');
  if(_gifVid){
    const _gs=parseFloat(_gifVid.dataset.gifStart)||0;
    const _ge=_gifVid.dataset.gifEnd!==''?parseFloat(_gifVid.dataset.gifEnd):Infinity;
    _gifVid.currentTime=_gs;
    _gifVid.ontimeupdate=function(){if(this.currentTime>=_ge)this.currentTime=_gs;};
  }
  return true;
}

function renderTxLbAuto(){
  // La ronda cambia cuando se mueve (lift, round, flight). En el primer
  // render solo registramos la clave actual (sin disparar el show).
  const key=DATA.lift+'-'+DATA.round+'-'+DATA.flight;
  if(_txLbAutoLastKey===null){_txLbAutoLastKey=key;return ''}
  if(key!==_txLbAutoLastKey){
    _txLbAutoLastKey=key;
    _txLbAutoShownAt=Date.now();
    setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},TX_LBAUTO_DURATION+400);
  }
  if(Date.now()-_txLbAutoShownAt>TX_LBAUTO_DURATION)return '';
  // Se reusa el render de leaderboard fijo, envolviéndolo en el ciclo de animación.
  const cur=liftQueue()[0];
  const inner=renderTxLeaderboard(cur,false);
  if(!inner)return '';
  return '<div style="position:fixed;top:0;right:0;bottom:0;left:0;animation:txLbCycle '+(TX_LBAUTO_DURATION/1000)+'s ease-in-out forwards">'+inner+'</div>';
}

function _txCerStartRecordListener(){
  if(!fbReady||!window._fb)return;
  const docId=evStateDocId('current');
  if(_txCerRecordUnsub&&_txCerRecordUnsubDocId===docId)return;
  if(_txCerRecordUnsub){try{_txCerRecordUnsub()}catch(e){}_txCerRecordUnsub=null;}
  _txCerRecordUnsubDocId=docId;
  try{
    _txCerRecordUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'livecast_record',docId),(snap)=>{
      if(!snap.exists())return;
      const d=snap.data();if(!d||!d.ts)return;
      if(d.ts===_txCerRecordSeenTs)return;
      _txCerRecordSeenTs=d.ts;
      _txCerRecordUntil=Date.now()+TX_CEREMONY.recordMs;
      _txCerRecordData=d;
      _txCerLastSig=null;
      if(typeof renderTxWidget==='function')renderTxWidget();
      setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},TX_CEREMONY.recordMs+200);
    });
  }catch(e){console.warn('[TX] record listener',e)}
}

function _txCerSetState(s){
  _txCerStateAt=Date.now();_txCerState=s;
  const opaque=(s==='profile');
  document.body.classList.toggle('tx-opaque',opaque);
  _txCerLastSig=null; // forzar re-render al cambiar de estado
}

function _txCerUpdateTimer(){
  const tm=document.getElementById('cerTimer');
  if(!tm)return;
  const t=Math.max(0,DATA.timer||0);
  tm.textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
  tm.style.color=DATA.timerOn&&t<=10?'#ef4444':DATA.timerOn&&t<=30?'#f59e0b':'#fff';
}

function renderTxCeremony(container){
  const c=container||document.getElementById('txWidget');
  if(!c)return;
  _txCerStartRecordListener();
  const cur=liftQueue()[0];

  // ── Detectar nuevo levantador → PROFILE ───────────────────
  if(cur && cur.id!==_txCerLastLifter){
    _txCerLastLifter=cur.id;
    _txCerSetState('profile');
    setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},TX_CEREMONY.profileMs+200);
  }

  // ── Detectar resultado nuevo (transición null → g/n) → SLAM corner ─
  if(_txCerSeenResults===null){
    _txCerSeenResults={};
    DATA.athletes.forEach(a=>LIFTS.forEach(l=>(a.att&&a.att[l]||[]).forEach((att,i)=>{_txCerSeenResults[a.id+'-'+l+'-'+i]=att.r||null;})));
  } else {
    DATA.athletes.forEach(a=>LIFTS.forEach(l=>(a.att&&a.att[l]||[]).forEach((att,i)=>{
      const k=a.id+'-'+l+'-'+i;
      const prev=_txCerSeenResults[k];
      const now=att.r||null;
      if((prev==null)&&(now==='g'||now==='n')){
        _txCerSlamUntil=Date.now()+TX_CEREMONY.slamMs;
        _txCerSlamType=now;
        setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},TX_CEREMONY.slamMs+100);
      }
      _txCerSeenResults[k]=now;
    })));
  }

  // ── Transiciones por tiempo ───────────────────────────────
  const elapsed=Date.now()-_txCerStateAt;
  if(_txCerState==='profile'&&elapsed>TX_CEREMONY.profileMs){
    _txCerSetState('scoreboard');
    setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},TX_CEREMONY.scoreboardMs+200);
  } else if(_txCerState==='scoreboard'&&elapsed>TX_CEREMONY.scoreboardMs){
    _txCerSetState('idle');
  }

  // ── Signature para evitar re-render por timer (anti-flicker) ─
  // El timer se actualiza in-place via #cerTimer, NO disparar re-render por DATA.timer.
  const slamActive=Date.now()<_txCerSlamUntil;
  const recordActive=Date.now()<_txCerRecordUntil&&_txCerRecordData;
  const sig=_txCerState+'|'+(cur?cur.id+'|'+cur.cat+'|'+((cur.att==null?void 0:cur.att[DATA.lift])||[]).map(a=>a.w+'-'+(a.r||'')+'-'+(a.cambios||0)).join(','):'')
    +'|'+DATA.lift+'|'+DATA.round+'|'+DATA.flight
    +'|'+(slamActive?_txCerSlamType+'-'+_txCerSlamUntil:'_')
    +'|'+(recordActive?'rec-'+_txCerRecordUntil:'_');
  if(sig===_txCerLastSig){
    _txCerUpdateTimer(); // solo actualizar el timer si no cambió nada estructural
    return;
  }
  _txCerLastSig=sig;

  // ── Build HTML según estado ───────────────────────────────
  let html='';
  if(_txCerState==='profile'&&cur){
    html+='<div style="position:fixed;top:0;right:0;bottom:0;left:0">'+renderTxProfile(cur)+'</div>';
  } else if(_txCerState==='scoreboard'&&cur){
    html+=_renderTxCerScoreboardBL(cur);
    html+=_renderTxCerTimerCorner();
  }
  // SLAM top-left (overlay encima de todo)
  if(slamActive&&_txCerSlamType){
    html+=_renderTxCerSlamCorner(_txCerSlamType);
  }
  // RECORD NACIONAL badge — top-left, gira mientras dura
  if(recordActive){
    html+=_renderTxCerRecordBadge(_txCerRecordData);
  }
  c.innerHTML=html;
  _txCerUpdateTimer();
}

function _renderTxCerRecordBadge(d){
  const LL={sq:'SQUAT',bp:'BENCH',dl:'DEADLIFT'};
  const liftName=LL[d.lift]||(d.lift||'').toUpperCase();
  // Posición top-left, debajo del slam para que no se pisen.
  // El wrapper externo controla in/out; el círculo interno gira continuamente.
  return '<div style="position:fixed;top:120px;left:24px;z-index:60;animation:txRecordIn .65s cubic-bezier(.2,.9,.2,1) backwards,txRecordOut .45s ease-in '+((TX_CEREMONY.recordMs-450)/1000)+'s forwards">'
    +'<div style="position:relative;width:clamp(160px,16vw,220px);height:clamp(160px,16vw,220px)">'
      +'<div style="position:absolute;top:0;right:0;bottom:0;left:0;animation:txRecordSpin 5s linear infinite">'
        +'<svg viewBox="0 0 200 200" style="width:100%;height:100%;display:block;filter:drop-shadow(0 6px 24px rgba(212,168,67,.6))">'
          +'<defs><path id="txRecCircle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs>'
          +'<circle cx="100" cy="100" r="92" fill="#0A1628" stroke="#D4A843" stroke-width="3"/>'
          +'<circle cx="100" cy="100" r="78" fill="none" stroke="rgba(212,168,67,.35)" stroke-width="1" stroke-dasharray="4 4"/>'
          +'<text fill="#D4A843" font-family="Oswald,sans-serif" font-size="17" font-weight="700" letter-spacing="3">'
            +'<textPath href="#txRecCircle" startOffset="0%">RÉCORD NACIONAL · RÉCORD NACIONAL · </textPath>'
          +'</text>'
        +'</svg>'
      +'</div>'
      +'<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none">'
        +'<div style="font-family:Oswald,sans-serif;font-size:11px;letter-spacing:3px;color:rgba(212,168,67,.85);margin-bottom:2px">'+liftName+'</div>'
        +'<div style="font-family:Oswald,sans-serif;font-size:clamp(34px,3.6vw,52px);font-weight:900;color:#D4A843;line-height:1">'+(d.newMark||'')+'</div>'
        +'<div style="font-family:Oswald,sans-serif;font-size:11px;color:rgba(255,255,255,.6);margin-top:2px">kg</div>'
        +(d.cat?'<div style="font-family:Oswald,sans-serif;font-size:10px;color:rgba(255,255,255,.55);letter-spacing:1px;margin-top:6px">-'+d.cat+'kg · '+(d.div||'')+'</div>':'')
      +'</div>'
    +'</div>'
  +'</div>';
}

// Corner del tiempo para dar el próximo intento, usado en los widgets Ceremony y Director
// (ambos públicos vía OBS). DESACTIVADO a pedido: ese tiempo ahora es privado, solo lo ve
// el juez/operador en Control en Vivo. Se deja la función devolviendo vacío para no romper
// las llamadas existentes (Ceremony / Director siguen funcionando, solo sin este corner).
function _renderTxCerTimerCorner(scale){
  return '';
}

// IPF-style row animation: rows appear/disappear one by one
// rows: 0=header, 1=name, 2=attempts
// Nombre del atleta como se escribe de verdad: "Lucas Andres Montecinos Alarcon".
// Antes el apellido salía en MAYÚSCULAS y quedaba más marcado que el nombre; se pidió
// todo del mismo tamaño y solo la inicial en mayúscula. Las partículas ("de", "la",
// "del", "van") van en minúscula, salvo que abran el nombre, y los apellidos con
// guion o apóstrofo llevan mayúscula en cada parte.
function _nombrePropio(s){
  const chicas=new Set(['de','del','la','las','los','y','da','das','do','dos','van','von','di','della','du','el']);
  return String(s||'').trim().toLowerCase().split(/\s+/).map((p,i)=>{
    if(i>0&&chicas.has(p))return p;
    return p.replace(/(^|[-'\u2019])(\p{Ll})/gu,(m,a,b)=>a+b.toUpperCase());
  }).join(' ');
}

function _sbRowAnim(animDir,row){
  if(!animDir)return '';
  if(animDir==='in'){
    const d=[240,0,140][row]; // name first, attempts 2nd, header last
    const o=['top center','center center','bottom center'][row];
    return `animation:txSbRowIn .35s cubic-bezier(.2,.9,.2,1) ${d}ms both;transform-origin:${o};`;
  }else{
    const d=[0,210,100][row]; // header first, attempts 2nd, name last
    const o=['top center','center center','bottom center'][row];
    return `animation:txSbRowOut .22s ease-in ${d}ms both;transform-origin:${o};`;
  }
}

// El minuto del intento como texto (m:ss) y su color: verde, naranjo en los
// últimos 30 s, rojo en los últimos 10. Lo usan el scoreboard de la
// transmisión y las pantallas de tarima; startTimer() lo actualiza cada segundo
// por id, sin redibujar.
function _relojTxt(){ const t=Math.max(0,DATA.timer||0); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); }
function _relojColor(){ const t=Math.max(0,DATA.timer||0); return !DATA.timerOn?'#ffffff':t<=10?'#ef4444':t<=30?'#f59e0b':'#22c55e'; }
function _relojChip(id,px){
  return '<span id="'+id+'" style="font-family:Oswald;font-size:'+px+'px;font-weight:800;letter-spacing:1px;padding:0 10px;border-radius:4px;'
    +'background:rgba(0,0,0,.35);color:'+_relojColor()+';font-variant-numeric:tabular-nums">'+_relojTxt()+'</span>';
}

function _renderTxCerScoreboardBL(cur,opts){
  opts=opts||{};
  const scale=opts.scale||1;
  const noAnimate=!!opts.noAnimate;
  // Variante compacta del scoreboard, posicionada abajo-izquierda
  const nombreAtleta=_nombrePropio(cur.name);
  const divS=txDivShort(cur.div);
  const catLabel=(cur.cat?txCatLabel(cur.cat)+' ':'')+divS;
  const cw=cur.att[DATA.lift][DATA.round].w;
  // Forecast: posición proyectada en sex+cat+div (reemplaza el timer en la barra superior)
  const _rk=catRankBySub(cur);
  const _newSubBL=DATA.lift==='sq'?Math.max(bestOf(cur,'sq'),cw)
                : DATA.lift==='bp'?bestOf(cur,'sq')+Math.max(bestOf(cur,'bp'),cw)
                : bestOf(cur,'sq')+bestOf(cur,'bp')+Math.max(bestOf(cur,'dl'),cw);
  const _sameCatBL=DATA.athletes.filter(a=>a.cat===cur.cat&&a.div===cur.div&&a.sex===cur.sex&&a.flight===DATA.flight&&!a.bombed);
  const _simBL=_sameCatBL.map(a=>a.id===cur.id?{id:a.id,sub:_newSubBL}:{id:a.id,sub:subTotal(a,DATA.lift)}).filter(x=>x.sub>0).sort((a,b)=>b.sub-a.sub);
  const _simPosBL=_simBL.findIndex(x=>x.id===cur.id)+1;
  const _forecastPos=_simPosBL||_rk.pos||0;
  const _willChangeBL=_rk.pos>0&&_simPosBL>0&&_simPosBL!==_rk.pos;
  let _forecastTxt,_forecastColor;
  if(_forecastPos<=0){_forecastTxt='—';_forecastColor=_txC('puesto');}
  else if(_willChangeBL){
    _forecastTxt='Puesto '+_rk.pos+' → '+_simPosBL;
    _forecastColor=_simPosBL===1?_txC('goodLift'):_simPosBL<=3?_txC('accent'):_txC('puesto');
  }else{
    _forecastTxt='Posición '+_forecastPos;
    _forecastColor=_forecastPos===1?_txC('goodLift'):_forecastPos<=3?_txC('accent'):_txC('puesto');
  }
  const logo=window.clubLogoImg?window.clubLogoImg(cur.club,_variosPaises()?28:34,'background:rgba(10,22,40,.85);padding:2px;flex-shrink:0;'):'';
  // animOrTx → animación de ciclo automatico (modo widget standalone) o transform de scale
  // extraStyle → animación in/out cuando se enciende/apaga desde control TX (slide vertical)
  const animDir=opts.animDir||null; // 'in' | 'out' | null
  const animOrTx=noAnimate
    ? (scale!==1?'transform:scale('+scale+');transform-origin:bottom left;':'')
    : 'animation:txScoreboardCycle '+(TX_CEREMONY.scoreboardMs/1000)+'s ease-in-out forwards;';
  const champLogo=(DATA.event==null?void 0:DATA.event.logoUrl)||'';
  const champLogoHtml=champLogo?'<img src="'+champLogo+'" alt="" class="sb-logo-anim" style="height:46px;width:46px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7))" onerror="this.style.display=\'none\'">':'';
  return '<div class="sb-card-explode" style="position:fixed;bottom:24px;left:24px;width:min(640px,55vw);'+animOrTx+'border-radius:8px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.6)">'
    +'<div style="'+_sbRowAnim(animDir,0)+'display:flex;justify-content:space-between;align-items:center;background:'+_txC('headerBg')+';border-top:2px solid '+_txC('accent')+';padding:6px 14px;gap:12px">'
      +'<div style="display:flex;align-items:center;gap:12px;font-family:Oswald;font-size:12px;color:rgba(200,215,240,.85);letter-spacing:1px">'+champLogoHtml
        // La categoría se pidió más grande (dos veces): a 12 px no se leía en la transmisión.
        +'<span style="font-size:26px;font-weight:700;color:#fff;letter-spacing:1.5px;white-space:nowrap;line-height:1.1">'+catLabel+'</span>'
        // Si el peso que va a levantar supera el récord de su división (o el Open),
        // se canta acá al lado de la categoría, en blanco para que resalte.
        +(function(){
          // En peso muerto también canta el récord de TOTAL que dejaría el intento.
          const w=(cur.att[DATA.lift][DATA.round]||{}).w;
          const x=(typeof _srIntento==='function')?_srIntento(_realAth(cur),DATA.lift,w):{hay:false};
          return x.hay?'<span class="sr-parpadea" style="background:#F2C230;color:#fff;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:800;letter-spacing:1.5px;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.55);box-shadow:0 0 14px rgba(242,194,48,.6)">'+_srIntentoTexto(x)+'</span>':'';
        })()
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:14px">'
        // El minuto del intento: solo si lo inició la Planilla (panel de jueces).
        +(DATA.relojVisible?_relojChip('sbRelojTx',22):'')
        +'<div style="font-family:Oswald;font-size:18px;font-weight:800;color:'+_forecastColor+';letter-spacing:2px">'+_forecastTxt+'</div>'
      +'</div>'
    +'</div>'
    +'<div style="'+_sbRowAnim(animDir,1)+'background:linear-gradient(90deg,'+_txC('nameBg')+','+_txC('nameBg2')+');padding:5px 14px;display:flex;align-items:center;gap:10px">'
      // Bandera + código del país DEL ATLETA. Antes acá decía "CHI" escrito a mano,
      // así que a un ecuatoriano le salía Chile.
      // En un campeonato de un solo país la bandera no va (serían todas iguales):
      // en su lugar va el logo del club, que entonces ya no se repite a la derecha.
      +(_variosPaises()?'<div style="display:flex;align-items:center;gap:6px;background:rgba(10,22,40,.9);padding:3px 9px;border-radius:3px;flex-shrink:0">'
        +_flagImg(_ctry(cur),14)
        +'<span style="color:'+_txC('nameBg')+';font-family:Oswald;font-size:10px;letter-spacing:2px;font-weight:700">'+_ctry(cur)+'</span>'
      +'</div>':logo)
      +'<div style="flex:1;font-family:Oswald;color:'+_txC('nameText')+';letter-spacing:1px;overflow:hidden">'
        +'<div style="font-size:24px;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+nombreAtleta+'</div>'
      +'</div>'
      +(_variosPaises()?logo:'')
    +'</div>'
    +'<div style="'+_sbRowAnim(animDir,2)+'display:grid;grid-template-columns:repeat(3,1fr) 100px;background:'+_txC('gridBg')+'">'
      +cur.att[DATA.lift].map((at,j)=>{
        let bg,clr,td='none';
        if(at.r==='g'){bg=_txC('goodLift');clr=_txC('nameText')}
        else if(at.r==='n'){bg=_txC('noLift');clr='#fff';td='line-through'}
        else if(j===DATA.round&&at.w>0){bg=_txC('curAttempt');clr='#fff'}
        else{bg='rgba(30,48,78,.3)';clr='rgba(140,160,190,.45)'}
        const isCur=j===DATA.round&&at.r===null&&at.w>0;
        return '<div style="padding:1px 6px;line-height:1.2;text-align:center;background:'+bg+';border-right:1px solid rgba(255,255,255,.08);font-family:Oswald;font-size:28px;font-weight:700;color:'+clr+';text-decoration:'+td+';'+(isCur?'box-shadow:inset 0 -3px 0 '+LIFT_C[DATA.lift]+';':'')+'">'+(at.w||'—')+'</div>';
      }).join('')
      // El subtotal va sobre el MISMO fondo que los intentos: usaba el color de
      // acento de fondo y en las paletas claras salía un cuadro blanco al final
      // de la fila, como si faltara algo. El acento pasa al número, que es lo
      // que tiene que resaltar. El DQ sigue en rojo, que ahí sí es un aviso.
      +'<div style="padding:1px 6px;line-height:1.2;text-align:center;background:'+(isDQ(cur)?_txC('noLift'):_txC('gridBg'))+';color:'+(isDQ(cur)?'#fff':_txC('accent'))+';font-family:Oswald;font-size:28px;font-weight:700;letter-spacing:1px">'+(isDQ(cur)?'DQ':(subTotal(cur,DATA.lift)||0).toFixed(1))+'</div>'
    +'</div>'
  +'</div>';
}

function _renderTxCerSlamCorner(type,scale){
  const isGood=type==='g';
  const text=isGood?'GOOD LIFT':'NO LIFT';
  const color=isGood?_txC('goodLift'):_txC('noLift');
  const glow=isGood?'rgba(92,179,127,.75)':'rgba(204,102,102,.75)';
  const s=scale||1;
  const wrapStart=s!==1?'<div style="position:fixed;top:24px;left:24px;transform:scale('+s+');transform-origin:top left">':'';
  const wrapEnd=s!==1?'</div>':'';
  const innerPos=s!==1?'':'position:fixed;top:24px;left:24px;';
  return wrapStart+'<div style="'+innerPos+'animation:txSlamIn .45s cubic-bezier(.2,.9,.2,1) backwards,txSlamOut .35s ease-in 1.55s forwards">'
    +'<div style="font-family:Oswald,sans-serif;font-size:clamp(40px,5vw,68px);font-weight:900;letter-spacing:4px;color:'+color+';text-shadow:0 0 30px '+glow+',0 4px 20px rgba(0,0,0,.85);-webkit-text-stroke:2px rgba(0,0,0,.4);background:rgba(10,22,40,.55);padding:10px 22px;border-radius:8px;border:2px solid '+color+'">'
      +text
    +'</div>'
  +'</div>'+wrapEnd;
}

function _widgetStartDirectObsListener(){
  if(TX_MODE!=='director')return;
  // Método 1: API nativa OBS (funciona siempre dentro de OBS Browser Source)
  if(!_widgetObsNativeListening){
    _widgetObsNativeListening=true;
    window.addEventListener('obsCustomEvent',e=>{
      _widgetHandleDirectObsEvent(e.detail);
    });
    console.log('[Widget] obsCustomEvent listener activo');
  }
  // Método 2: WebSocket directo (solo si se pasa ?obsWs= y aún no conectado)
  if(_widgetObsWs)return;
  if(!window.OBSWebSocket)return;
  const obsWsParam=TX_URL.get('obsWs');
  if(!obsWsParam)return;
  const obsPwd=TX_URL.get('obsPwd')||'';
  const url='ws://'+obsWsParam;
  _widgetObsWs=new window.OBSWebSocket();
  _widgetObsWs.connect(url,obsPwd).then(()=>{
    console.log('[Widget] OBS WS connected directly:',url);
  }).catch(e=>{
    console.warn('[Widget] OBS WS fallback failed (normal en OBS Browser Source):',e.message||e);
    _widgetObsWs=null;
  });
  _widgetObsWs.on('CustomEvent',d=>{
    _widgetHandleDirectObsEvent(d);
  });
  _widgetObsWs.on('ConnectionClosed',()=>{
    _widgetObsWs=null;
    setTimeout(_widgetStartDirectObsListener,5000);
  });
}

function _widgetHandleDirectObsEvent(d){
  if(!d)return;
  if(!_txDirState)_txDirState={...TX_DIR_DEFAULT};
  const action=d.action;
  // Sync de datos de competencia desde el admin panel (no necesita Firestore)
  if(action==='competitionSync'){
    if(d.lift)DATA.lift=d.lift;
    if(typeof d.round==='number')DATA.round=d.round;
    if(d.flight)DATA.flight=d.flight;
    if(Array.isArray(d.athletes)&&d.athletes.length)DATA.athletes=_normExtraAtts(d.athletes);
    if(d.event)DATA.event=d.event;
    // No forzar re-render si hay un barrido activo — evita que se reinicie la animación
    const fsAnimRunning=Object.values(_txDirAnims).some(a=>a&&Date.now()-a.startedAt<(a.dur||TX_ANIM_MS.fullscreen));
    const fsShowing=_txDirState&&(_txDirActive('profile')||_txDirActive('leaderboard')||_txDirActive('breakTimer'));
    if(!fsAnimRunning&&!fsShowing){_txDirLastSig=null;if(typeof renderTxWidget==='function')renderTxWidget();}
    return;
  }
  const mark=()=>{ _txDirLastSig=null; if(typeof renderTxWidget==='function')renderTxWidget(); };
  if(action==='toggle'&&d.component){
    const c=_txDirState[d.component]||{};
    const isOn=c.active&&(!c.until||c.until>Date.now());
    const willActivate=!isOn;
    // Mutual exclusion: profile y leaderboard no pueden estar prendidos juntos
    const FULLSCREEN_EXCLUSIVE=['profile','leaderboard'];
    if(willActivate && FULLSCREEN_EXCLUSIVE.includes(d.component)){
      FULLSCREEN_EXCLUSIVE.forEach(other=>{
        if(other!==d.component){
          const o=_txDirState[other];
          if(o && o.active){
            _txDirState[other]=Object.assign({},o,{active:false,until:0});
          }
        }
      });
      // Apagar tambien Tabla Actual al activar fullscreen — no reaparece sola
      const ta=_txDirState.tablaActual;
      if(ta && ta.active){
        _txDirState.tablaActual=Object.assign({},ta,{active:false,until:0});
      }
    }
    _txDirState[d.component]=Object.assign({},c,{active:willActivate,until:0});
    mark();return;
  }
  if(action==='slam'&&d.type){
    _txDirState.slam={active:true,until:Date.now()+2000,type:d.type};
    mark();return;
  }
  if(action==='hideAll'){
    ['profile','scoreboard','leaderboard','timer','slam'].forEach(k=>{
      _txDirState[k]=Object.assign({},_txDirState[k]||{},{active:false,until:0});
    });
    if(_txDirState.breakTimer)_txDirState.breakTimer={active:false,startedAt:0,durationSec:0,label:'',pausedAt:0,videos:[]};
    mark();return;
  }
  if(action==='showLb'&&d.cat){
    // Apagar profile (mutual exclusion fullscreen)
    if(_txDirState.profile && _txDirState.profile.active){
      _txDirState.profile=Object.assign({},_txDirState.profile,{active:false,until:0});
    }
    _txDirState.leaderboard={active:true,until:0,cat:d.cat};
    mark();return;
  }
  if(action==='breakStart'){
    const m=d.minutes||10, s=d.seconds||0;
    const durationSec=m*60+s;
    if(durationSec<=0)return;
    _txDirState.breakTimer={active:true,startedAt:Date.now(),durationSec,label:d.label||'',pausedAt:0,videos:d.videos||[],movement:d.movement||'',style:d.style||(_txDirState.breakTimer==null?void 0:_txDirState.breakTimer.style)||{}};
    mark();return;
  }
  if(action==='breakStop'){
    _txDirState.breakTimer={active:false,startedAt:0,durationSec:0,label:'',pausedAt:0,videos:[],movement:''};
    mark();return;
  }
  if(action==='breakAdd'&&typeof d.seconds==='number'){
    const bt=_txDirState.breakTimer;
    if(!bt||!bt.active)return;
    bt.durationSec=Math.max(1,(bt.durationSec||0)+d.seconds);
    mark();return;
  }
}

// El widget escucha el doc del director. Ese doc se llama 'current__<Evento>',
// así que su nombre depende de que el evento YA esté resuelto — y el evento se
// resuelve DESPUÉS de que Firebase queda listo, con nominas.json de por medio.
//
// Antes esta función se suscribía a lo primero que hubiera y no volvía a mirar
// ('if(_txDirUnsub)return'). Si Firebase ganaba la carrera, el widget quedaba
// escuchando 'current' —el id viejo de compatibilidad— para siempre, mientras
// el Control TX y el control remoto escribían en 'current__<Evento>'. El
// resultado en competencia: se aprieta perfil, marcador o medallero, el panel
// lo marca en verde, Firestore recibe el comando, y en pantalla no pasa nada.
// Nunca. Ni recargando el navegador, porque la carrera se vuelve a perder igual.
//
// Pasa más seguido dentro de OBS: el browser source arranca en frío, sin caché,
// y cada cambio de escena que reinicia la fuente vuelve a tirar los dados.
//
// Ahora se compara el id contra el que ya se está escuchando y, si cambió, se
// re-suscribe. Es el mismo arreglo que ya tenía el lado del control (_dirListen).
function _txStartDirectorListener(){
  if(!_txDirState)_txDirState={...TX_DIR_DEFAULT};
  if(!fbReady||!window._fb){
    if(!_txDirPoll)_txDirPoll=setInterval(_txStartDirectorListener,300);
    return;
  }
  const docId=evStateDocId('current');
  if(_txDirUnsub&&_txDirUnsubDocId===docId){
    // Ya está escuchando el doc correcto. Pero si el evento todavía no se
    // resuelve, este id puede seguir cambiando: hay que seguir vigilando.
    if(!fbDocId()&&!_txDirPoll)_txDirPoll=setInterval(_txStartDirectorListener,300);
    return;
  }
  if(_txDirUnsub){try{_txDirUnsub()}catch(e){}_txDirUnsub=null;}
  _txDirUnsubDocId=docId;
  // Con el evento ya resuelto el id no cambia más: se puede soltar la vigilancia.
  if(fbDocId()&&_txDirPoll){clearInterval(_txDirPoll);_txDirPoll=null;}
  console.log('[TX] director escuchando '+docId);
  try{
    _txDirUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'livecast_director',docId),(snap)=>{
      if(snap.exists()){
        const d=snap.data();
        _txDirState=Object.assign({},TX_DIR_DEFAULT,d.show||{});
      } else {
        _txDirState={...TX_DIR_DEFAULT};
      }
      _txDirLastSig=null;
      // Las pantallas del recinto miran del director UNA sola cosa: el timer de
      // descanso. Si se redibujaran con cualquier cambio suyo, cada vez que la
      // transmisión prende o apaga un componente la tabla de jornada se rehace
      // entera — un parpadeo en la pantalla del gimnasio por algo que no la toca.
      if(TX_MODE==='screen'||TX_MODE==='jornada'){
        const bt=_txDirState.breakTimer||{};
        const sig=[!!bt.active,bt.startedAt||0,bt.durationSec||0,bt.pausedAt||0,
                   bt.label||'',bt.movement||''].join('|');
        if(sig===_txDescSig)return;
        _txDescSig=sig;
      }
      if(typeof renderTxWidget==='function')renderTxWidget();
    });
  }catch(e){console.warn('[TX] director listen',e)}
}

function _txDirActive(comp){
  const c=_txDirState&&_txDirState[comp];
  if(!c||!c.active)return false;
  if(c.until>0&&Date.now()>=c.until)return false;
  return true;
}

 // ms por clip

function _btVideoSetup(videos){
  if(!videos||!videos.length){_btVideoTeardown();return;}
  const key=JSON.stringify(videos);
  if(!_btVideoBgEl){
    _btVideoBgEl=document.createElement('video');
    _btVideoBgEl.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;pointer-events:none;filter:blur(24px) brightness(.28);transform:scale(1.12)';
    _btVideoBgEl.muted=true;_btVideoBgEl.playsInline=true;
    document.body.appendChild(_btVideoBgEl);
  }
  if(!_btVideoFgEl){
    _btVideoFgEl=document.createElement('video');
    _btVideoFgEl.style.cssText='position:fixed;left:0;top:5%;width:40%;height:80%;object-fit:cover;z-index:3;pointer-events:none;-webkit-mask-image:linear-gradient(to right,#000 56%,transparent 93%),linear-gradient(to bottom,transparent 0%,#000 18%,#000 82%,transparent 100%);-webkit-mask-composite:source-in;mask-image:linear-gradient(to right,#000 56%,transparent 93%),linear-gradient(to bottom,transparent 0%,#000 18%,#000 82%,transparent 100%);mask-composite:intersect';
    _btVideoFgEl.muted=true;_btVideoFgEl.playsInline=true;
    document.body.appendChild(_btVideoFgEl);
  }
  if(_btVideoSrcsKey!==key){
    _btVideoSrcsKey=key;_btVideoIdx=0;
    if(_btVideoInterval){clearInterval(_btVideoInterval);_btVideoInterval=null;}
    _btPlayVideos(videos,0);
  }
}

function _btPlayVideos(videos,idx){
  const src=videos[idx%videos.length];
  const single=videos.length===1;
  [_btVideoBgEl,_btVideoFgEl].forEach(el=>{
    if(!el)return;
    el.loop=single;
    el.onended=null;
    el.src=src;
    el.load();
    el.play().catch(()=>{});
  });
  // Si hay varios videos, encadenar con el evento ended del bg
  if(!single&&_btVideoBgEl){
    _btVideoBgEl.onended=()=>{
      _btVideoIdx=(_btVideoIdx+1)%videos.length;
      _btPlayVideos(videos,_btVideoIdx);
    };
  }
}

function _btVideoTeardown(){
  if(_btVideoInterval){clearInterval(_btVideoInterval);_btVideoInterval=null;}
  [_btVideoBgEl,_btVideoFgEl].forEach(el=>{
    if(el){el.pause();el.src='';if(el.parentNode)el.parentNode.removeChild(el);}
  });
  _btVideoBgEl=null;_btVideoFgEl=null;
  _btVideoIdx=0;_btVideoSrcsKey='';
}

// El logo que aparece en el barrido de transición.
//
// Por defecto va el de YourLift. El del campeonato se usa solo si alguien lo
// pidió a propósito, con el interruptor que está junto al logo en Control TX:
// así un campeonato que subió su logo para el scoreboard no se lleva por delante
// la marca del barrido sin que nadie lo haya decidido.
//
// Se usa el archivo grande de YourLift porque este barrido es a pantalla
// completa y en OBS se escala todavía más: el chico se veía con los bordes rotos.
// Y si el logo del campeonato no carga —un enlace vencido en medio de la
// transmisión— cae al de YourLift en vez de dejar el barrido pelado.
// ── Los tres logos de la transmisión ─────────────────────────────────────────
// Son tres cosas distintas y cada pantalla muestra las que le corresponden:
//
//   · FEDERACIÓN — quién manda el campeonato. FESUPO en el Sudamericano, FECHIPO
//     en los nacionales. Se sube por campeonato en el panel, así que cambiarlo
//     no es tocar código.
//   · CAMPEONATO — el logo del evento en sí.
//   · YOURLIFT   — la marca del sistema.
//
//   pantalla        federación  campeonato  yourlift
//   transición          no       sí, grande     no      ← se ve sola, tiene que dominar
//   scoreboard          sí          sí          no
//   tabla actual        no          sí          no      ← es una tarjeta chica
//   perfil              sí          sí          sí
//
// En el scoreboard y en la tabla no va el de YourLift a propósito: son las
// pantallas que están al aire todo el rato y lo que tiene que leerse ahí es de
// quién es el campeonato. Y en la tabla actual va solo el del campeonato: es una
// tarjeta chica en una esquina y con dos logos el título quedaba apretado.
// De dónde salen los logos, y por qué no basta con DATA.event.
//
// DATA.event NO es un objeto estable: se lo pisa entero cada vez que llega un
// snapshot de sincronización (`DATA.event=d.event||DATA.event`) y también cuando
// un widget arranca desde la lista de eventos. Cualquiera de esas copias que no
// traiga el campo deja el logo en blanco, y desde afuera parece que el logo
// "se borró" cuando en realidad nunca se guardó en esa copia.
//
// Por eso se busca en dos lados: primero en DATA.event —que es lo más fresco si
// está— y si no, en LIVE_EVENT_META, que lo llena el listener de `eventos`
// directamente desde el campeonato y no lo toca la sincronización.
function _metaEvento(){
  const m=window.LIVE_EVENT_META||{}, ev=DATA.event||{};
  return m[ev.id]||m[ev.name]||{};
}

function _probarLogosLocales(){
  window._LOGO_LOCAL={camp:'',fed:''};
  const id=String((DATA.event&&DATA.event.id)||'').trim();
  if(!id)return;
  const probar=(clave,src)=>{
    const i=new Image();
    i.onload=()=>{ window._LOGO_LOCAL[clave]=src; if(typeof R==='function')R(); };
    i.src=src;
  };
  probar('camp','eventos/'+id+'.png');
  probar('fed','eventos/'+id+'_fed.png');
}

// Los logos que se ven en la Pantalla de Tarima. Es una lista: se suben los que
// se quieran —el del campeonato, el de la federación, los auspiciadores— y salen
// todos, en todas las escenas. Mientras no se suba ninguno se sigue usando el
// par de siempre (federación + campeonato), así la pantalla nunca queda pelada.
function _logosPantallaSubidos(){
  const ev=DATA.event||{};
  const l=Array.isArray(ev.logosPantalla)&&ev.logosPantalla.length
    ? ev.logosPantalla : (_metaEvento().logosPantalla||[]);
  return (l||[]).map(x=>(x&&x.url)||'').filter(Boolean);
}

// La tira de logos de la pantalla. Si no hay ninguno subido, cae en la tira de
// siempre con los logos que pida cada escena.
function _tiraLogosPantalla(cuales,alto,gap){
  const subidos=_logosPantallaSubidos();
  if(!subidos.length)return _tiraLogos(cuales,alto,gap);
  // El alto manda y el ancho sale solo, para que un logo apaisado no quede
  // aplastado. Si son muchos, la tira baja a una segunda fila en vez de salirse
  // de la pantalla.
  const sombra='filter:drop-shadow(0 2px 6px rgba(0,0,0,.55));';
  return '<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;'
    +'max-width:92vw;gap:'+(gap||'12px')+'">'
    +subidos.map(u=>'<img src="'+u+'" alt="" style="height:'+alto+';width:auto;max-width:22vw;'
      +'object-fit:contain;'+sombra+'" onerror="this.style.display=\'none\'">').join('')
    +'</div>';
}

function _logoCamp(){ return (DATA.event&&DATA.event.logoUrl)||_metaEvento().logoUrl||(window._LOGO_LOCAL||{}).camp||''; }

function _logoFed(){ return (DATA.event&&DATA.event.logoFedUrl)||_metaEvento().logoFedUrl||(window._LOGO_LOCAL||{}).fed||''; }

// Arma la tira de logos. `alto` es la altura en CSS (puede venir con clamp()).
// Los que no estén cargados simplemente no se dibujan, y si no hay ninguno
// devuelve '' para que quien lo llame no deje una caja vacía en pantalla.
function _tiraLogos(cuales,alto,gap){
  const sombra='filter:drop-shadow(0 2px 8px rgba(0,0,0,.6))';
  const sep='<div style="width:1px;height:60%;background:rgba(212,168,67,.35);flex-shrink:0"></div>';
  const piezas=[];
  if(cuales.indexOf('fed')>=0&&_logoFed())
    piezas.push('<img src="'+_logoFed()+'" alt="" style="height:'+alto+';width:auto;max-width:2.6em;object-fit:contain;'+sombra+'" onerror="this.style.display=\'none\'">');
  if(cuales.indexOf('camp')>=0&&_logoCamp())
    piezas.push('<img src="'+_logoCamp()+'" alt="" style="height:'+alto+';width:auto;max-width:3.2em;object-fit:contain;'+sombra+'" onerror="this.style.display=\'none\'">');
  if(cuales.indexOf('yl')>=0)
    piezas.push('<img src="YourLift_logo.png" alt="" style="height:'+alto+';width:auto;object-fit:contain;'+sombra+'" onerror="this.style.display=\'none\'">');
  if(!piezas.length)return '';
  return '<div style="display:flex;align-items:center;gap:'+(gap||'14px')+';font-size:'+alto+'">'
    +piezas.join(sep)+'</div>';
}

function _barridoLogoImg(){
  const sombra='filter:drop-shadow(0 8px 24px rgba(0,0,0,.6))';
  const ev=DATA.event||{};
  // En la transición va SOLO el logo del campeonato, y grande: es el único
  // momento en que la pantalla es suya y a media cascada tiene que notarse.
  // Antes venía al revés —por defecto el de YourLift, y el del campeonato había
  // que pedirlo con el interruptor— y quedaba chico y sin notarse. Ahora manda
  // el del campeonato; el interruptor sigue sirviendo para forzar el de
  // YourLift en un campeonato que lo prefiera así.
  const propio=(ev.barridoLogo==='yourlift')?'':_logoCamp();
  if(propio){
    // Más ancho que alto: los logos de campeonato suelen ser apaisados, y
    // encajonarlos en un cuadrado los dejaba diminutos.
    return '<img src="'+propio+'" alt="" style="max-width:min(72vw,1000px);max-height:min(52vh,520px);object-fit:contain;'+sombra+'"'
      +' onerror="this.onerror=null;this.src=\'yourlift_logo_hd.png\'">';
  }
  // Sin logo de campeonato el barrido no puede quedar pelado: va el de YourLift.
  return '<img src="yourlift_logo_hd.png" alt="" style="max-width:min(52vw,560px);max-height:min(38vh,320px);object-fit:contain;'+sombra+'"'
    +' onerror="this.onerror=null;this.src=\'YourLift_logo.png\'">';
}

function _startBarrido(dir){
  if(_txBarridoEl&&_txBarridoEl.parentNode)_txBarridoEl.parentNode.removeChild(_txBarridoEl);
  _txBarridoEl=document.createElement('div');
  _txBarridoEl.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:200;overflow:hidden';
  const fwd=dir!=='out';
  const ks=fwd?'txStripeFwd':'txStripeBack';
  const dur=(TX_ANIM_MS.fullscreen/1000).toFixed(2);
  _txBarridoEl.innerHTML=
    '<div style="position:absolute;top:-30%;left:-30%;width:80%;height:160%;background:#c41e3a;animation:'+ks+' '+dur+'s cubic-bezier(.7,0,.3,1) forwards"></div>'
    +'<div style="position:absolute;top:-30%;left:-30%;width:80%;height:160%;background:#ffffff;animation:'+ks+' '+dur+'s cubic-bezier(.7,0,.3,1) .08s forwards;transform:translateX(-160%) skewX(-18deg)"></div>'
    +'<div style="position:absolute;top:-30%;left:-30%;width:80%;height:160%;background:#0a1f44;animation:'+ks+' '+dur+'s cubic-bezier(.7,0,.3,1) .16s forwards;transform:translateX(-160%) skewX(-18deg)"></div>'
    +'<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;animation:txLogoBeat '+dur+'s ease-out forwards;opacity:0">'
      +_barridoLogoImg()
    +'</div>';
  document.body.appendChild(_txBarridoEl);
  setTimeout(()=>{if(_txBarridoEl&&_txBarridoEl.parentNode){_txBarridoEl.parentNode.removeChild(_txBarridoEl);_txBarridoEl=null;}},TX_ANIM_MS.fullscreen+200);
}

function _txDetectTransitions(){
  const comps=['profile','scoreboard','leaderboard','timer','breakTimer','tablaActual','medals','luces'];
  const fullscreen=new Set(['profile','leaderboard','breakTimer']);
  const fsJustActivated=[...fullscreen].some(c=>!_txDirPrevActive[c]&&_txDirActive(c));
  const fsCurrentlyExiting=Object.keys(_txDirAnims).some(c=>fullscreen.has(c)&&_txDirAnims[c].dir==='out');
  const fsJustDeactivated=[...fullscreen].some(c=>!!_txDirPrevActive[c]&&!_txDirActive(c));
  const fsVisible=_txDirActive('profile')||_txDirActive('leaderboard')||_txDirActive('breakTimer')||fsCurrentlyExiting||fsJustDeactivated;
  const effectiveActive=(c)=>{
    if(c==='scoreboard'||c==='timer'||c==='medals')return _txDirActive(c)&&!fsVisible;
    return _txDirActive(c);
  };
  comps.forEach(c=>{
    const prev=!!_txDirPrevActive[c];
    const now=effectiveActive(c);
    if(prev!==now){
      const dur=fullscreen.has(c)?TX_ANIM_MS.fullscreen:TX_ANIM_MS.corner;
      if(fullscreen.has(c)){
        // Guard: si ya hay una animación en curso para este componente, no la retriggereamos.
        // Evita que renders rápidos en sucesión (sync, Firestore, etc.) lancen el barrido 2 veces.
        if(!_txDirAnims[c]){
        _txDirAnims[c]={dir:now?'in':'out',startedAt:Date.now(),dur};
        _startBarrido(now?'in':'out');
        setTimeout(()=>{
          if(_txDirAnims[c]&&Date.now()-_txDirAnims[c].startedAt>=dur-50){
            delete _txDirAnims[c];
            _txDirLastSig=null;
            if(typeof renderTxWidget==='function')renderTxWidget();
          }
        },dur+50);
        }
      } else {
        // Corner (scoreboard/timer): desaparece SIN animación cuando activa un fullscreen
        if(!now&&fsJustActivated){
          delete _txDirAnims[c]; // hide instantáneo, sin animación de salida
        } else {
          _txDirAnims[c]={dir:now?'in':'out',startedAt:Date.now(),dur};
          const _animDirCur=now?'in':'out';
          setTimeout(()=>{
            if(_txDirAnims[c]&&Date.now()-_txDirAnims[c].startedAt>=dur-50){
              delete _txDirAnims[c];
              // Para entradas IN de scoreboard/tablaActual: NO forzar re-render.
              // El wrapper-anim class se quita en el próximo render natural (sin replay
              // de animaciones internas como ta-logo-anim que están gateadas en .ta-wrap-anim).
              if(_animDirCur==='in' && (c==='scoreboard'||c==='tablaActual')){
                _txDirLastSig=null; // marca para que el próximo render compute la nueva sig
                return;
              }
              _txDirLastSig=null;
              if(typeof renderTxWidget==='function')renderTxWidget();
            }
          },dur+50);
        }
      }
    }
    _txDirPrevActive[c]=now;
  });
}

function _txAnimActive(comp){
  const a=_txDirAnims[comp];
  if(!a)return null;
  if(Date.now()-a.startedAt>=a.dur){delete _txDirAnims[comp];return null}
  return a;
}

function _txDirScheduleHide(){
  // Re-render automático cuando el componente con menor `until` expire
  if(!_txDirState)return;
  const now=Date.now();
  let next=Infinity;
  Object.values(_txDirState).forEach(c=>{
    if(c&&c.active&&c.until>0&&c.until>now&&c.until<next)next=c.until;
  });
  if(next!==Infinity){setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},next-now+50);}
}

function renderTxDirector(container){
  const c=container||document.getElementById('txWidget');
  if(!c)return;
  _txStartDirectorListener();
  _widgetStartDirectObsListener();
  if(!_txDirState){c.innerHTML='';return}
  const cur=liftQueue()[0];
  const showProf=_txDirActive('profile');
  const showLb=_txDirActive('leaderboard');
  const showSlam=_txDirActive('slam');
  // Break timer: activo si tiene `active=true` y aún hay tiempo (o pausado)
  const bt=_txDirState.breakTimer||{};
  const showBreak=!!bt.active&&bt.startedAt>0&&bt.durationSec>0;
  // Scoreboard y Timer (corners) se OCULTAN cuando hay un fullscreen tapando
  // O cuando uno está en animación de salida — para que el scoreboard no entre
  // encima del perfil/leaderboard mientras todavía está saliendo.
  const _fsExiting=['profile','leaderboard','breakTimer'].some(c=>{const a=_txDirAnims[c];return a&&a.dir==='out'&&Date.now()-a.startedAt<(a.dur||TX_ANIM_MS.fullscreen);});
  const _fsVisible=showProf||showLb||showBreak||_fsExiting;
  const showSb=_txDirActive('scoreboard')&&!_fsVisible;
  const showTm=_txDirActive('timer')&&!_fsVisible;
  const showMedals=_txDirActive('medals')&&!_fsVisible;
  // Detectar transiciones (cambios on↔off) para reproducir animaciones
  _txDetectTransitions();
  // Signature p/ evitar flicker por timer cada 1s
  const md=_txDirState.medals||{};
  const sig=[showProf,showSb,showLb,showTm,showSlam,showBreak,_txDirActive('tablaActual'),showMedals,_txDirActive('luces')].join('|')
    +'|luz-'+(_txLights.izq||'')+(_txLights.central||'')+(_txLights.der||'')
    +'|'+(cur?cur.id+'|'+((cur.att==null?void 0:cur.att[DATA.lift])||[]).map(a=>a.w+'-'+(a.r||'')+'-'+(a.cambios||0)).join(','):'')
    +'|'+DATA.lift+'|'+DATA.round+'|'+DATA.flight
    +'|'+((_txDirState.leaderboard==null?void 0:_txDirState.leaderboard.cat)||'')+'|'+((_txDirState.slam==null?void 0:_txDirState.slam.type)||'')
    +'|md-'+(md.mod||'')+'-'+(md.sex||'')+'-'+(md.div||'')+'-'+(md.cat||'')+'-'+(md.tipo||'')+'-'+(md.until||0)
    +'|'+((_txDirState.profile==null?void 0:_txDirState.profile.until)||0)+'|'+((_txDirState.scoreboard==null?void 0:_txDirState.scoreboard.until)||0)+'|'+((_txDirState.leaderboard==null?void 0:_txDirState.leaderboard.until)||0)+'|'+((_txDirState.slam==null?void 0:_txDirState.slam.until)||0)
    +'|bt-'+(bt.startedAt||0)+'-'+(bt.durationSec||0)+'-'+(bt.pausedAt||0)+'-'+(bt.label||'')+'-'+(bt.videos||[]).length+'-'+(bt.movement||'')+'-'+JSON.stringify(bt.style||{})
    +'|sc-'+((_txDirState.profile==null?void 0:_txDirState.profile.scale)||1)+'-'+((_txDirState.scoreboard==null?void 0:_txDirState.scoreboard.scale)||1)+'-'+((_txDirState.leaderboard==null?void 0:_txDirState.leaderboard.scale)||1)+'-'+((_txDirState.timer==null?void 0:_txDirState.timer.scale)||1)+'-'+((_txDirState.slam==null?void 0:_txDirState.slam.scale)||1)+'-'+((_txDirState.breakTimer==null?void 0:_txDirState.breakTimer.scale)||1)+'-'+((_txDirState.tablaActual==null?void 0:_txDirState.tablaActual.scale)||1)+'-'+((_txDirState.medals==null?void 0:_txDirState.medals.scale)||1)+'-'+((_txDirState.luces==null?void 0:_txDirState.luces.scale)||1)
    +'|col-'+JSON.stringify(_txDirState.colors||{})
    +'|rv-'+(DATA.relojVisible?1:0)
    +'|jur-'+(_txDirActive('jurado')?1:0)+'-'+((_txJurado&&Date.now()<_txJuradoHasta)?_txJuradoTs:0)+'-'+((_txDirState.jurado==null?void 0:_txDirState.jurado.scale)||1);
  if(sig===_txDirLastSig){
    // Updates in-place sin re-render para evitar flicker
    const tm=document.getElementById('cerTimer');
    if(tm){
      const t=Math.max(0,DATA.timer||0);
      tm.textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
      tm.style.color=DATA.timerOn&&t<=10?'#ef4444':DATA.timerOn&&t<=30?'#f59e0b':'#fff';
    }
    // Break timer: actualizar el conteo cada segundo sin tocar innerHTML
    const btEl=document.getElementById('dirBreakDisplay');
    if(btEl&&showBreak){
      const elapsed=bt.pausedAt?(bt.pausedAt-bt.startedAt):(Date.now()-bt.startedAt);
      const rem=Math.max(0,Math.ceil((bt.durationSec*1000-elapsed)/1000));
      const m=Math.floor(rem/60),s=rem%60;
      btEl.textContent=m+':'+(s<10?'0':'')+s;
      btEl.style.color=rem<=10?'#ef4444':rem<=30?'#f59e0b':'#fff';
      // Si terminó, forzar re-render para que se vacíe (fin de break)
      if(rem<=0){_txDirLastSig=null;renderTxDirector(c);return}
    }
    // Re-tick: si el break está activo y NO pausado, agendar próxima
    // actualización en 1s (el setTimeout del fin del re-render solo
    // dispara una vez; sin esto el contador se queda pegado).
    if(showBreak&&!bt.pausedAt){
      setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},1000);
    }
    return;
  }
  _txDirLastSig=sig;
  // Stack: leaderboard tiene prioridad fullscreen, profile fullscreen, scoreboard/timer corners
  // Break timer también es fullscreen — gana sobre todo si está activo
  // Las animaciones de salida ('out') mantienen el componente visible durante la animación
  const animProf=_txAnimActive('profile');
  const animSb=_txAnimActive('scoreboard');
  const animLb=_txAnimActive('leaderboard');
  const animTm=_txAnimActive('timer');
  const animBt=_txAnimActive('breakTimer');
  // Mantener body opaco mientras un fullscreen esté activo O en transición
  document.body.classList.toggle('tx-opaque', showLb||showProf||showBreak||(animProf&&animProf.dir==='out')||(animLb&&animLb.dir==='out')||(animBt&&animBt.dir==='out'));
  // Video de fondo del break timer (persiste independiente del innerHTML)
  if(showBreak){
    const bvids=bt.videos||[];
    if(bvids.length){
      _btVideoSetup(bvids);
      // Sincronizar posición/tamaño/blur desde style params
      const _bts=bt.style||{};
      if(_btVideoFgEl){
        _btVideoFgEl.style.left=(_bts.videoX!=null?_bts.videoX:0)+'%';
        _btVideoFgEl.style.top=(_bts.videoY!=null?_bts.videoY:5)+'%';
        _btVideoFgEl.style.width=(_bts.videoW!=null?_bts.videoW:40)+'%';
        _btVideoFgEl.style.height=(_bts.videoH!=null?_bts.videoH:80)+'%';
        _btVideoFgEl.style.transform='none';
        _btVideoFgEl.style.borderRadius='0';
        _btVideoFgEl.style.clipPath='none';
        _btVideoFgEl.style.objectFit='cover';
        _btVideoFgEl.style.zIndex='3';
      }
      if(_btVideoBgEl){
        const blur=_bts.blurAmount!=null?Number(_bts.blurAmount):24;
        _btVideoBgEl.style.filter='blur('+blur+'px) brightness(.28)';
      }
    } else _btVideoTeardown();
  } else if(!(animBt&&animBt.dir==='out')){
    // Solo limpiar cuando la animación de salida ya terminó también
    _btVideoTeardown();
  }
  let html='';
  // (el barrido/curtain vive en document.body como overlay independiente — ver _startBarrido)
  // Break timer (fullscreen, prioridad alta)
  if(showBreak||(animBt&&animBt.dir==='out')){
    const fade=animBt?(animBt.dir==='in'?'animation:txContentFadeIn 1.2s ease forwards;':'animation:txContentFadeOut 1.2s ease forwards;'):'';
    html+='<div style="position:fixed;top:0;right:0;bottom:0;left:0;'+fade+'">'+_renderTxBreakTimer(bt,(_txDirState.breakTimer==null?void 0:_txDirState.breakTimer.scale)||1)+'</div>';
  } else if(showLb||(animLb&&animLb.dir==='out')){
    const cat=_txDirState.leaderboard.cat;
    const ref=cat?DATA.athletes.find(a=>a.cat===cat&&!a.bombed):cur;
    const lbScale=(_txDirState.leaderboard==null?void 0:_txDirState.leaderboard.scale)||1;
    if(ref){
      const fade=animLb?(animLb.dir==='in'?'animation:txContentFadeIn 1.2s ease forwards;':'animation:txContentFadeOut 1.2s ease forwards;'):'';
      html+='<div style="position:fixed;top:0;right:0;bottom:0;left:0;'+(lbScale!==1?'transform:scale('+lbScale+');transform-origin:center center;':'')+fade+'">'+renderTxLeaderboard(ref,false,{allFlights:true})+'</div>';
    }
  } else if(showProf||(animProf&&animProf.dir==='out')){
    const fade=animProf?(animProf.dir==='in'?'animation:txContentFadeIn 1.2s ease forwards;':'animation:txContentFadeOut 1.2s ease forwards;'):'';
    if(cur){
      const pfScale=(_txDirState.profile==null?void 0:_txDirState.profile.scale)||1;
      html+='<div style="position:fixed;top:0;right:0;bottom:0;left:0;'+(pfScale!==1?'transform:scale('+pfScale+');transform-origin:center center;':'')+fade+'">'+renderTxProfile(cur)+'</div>';
    } else if(showProf){
      html+='<div style="position:fixed;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;font-family:Oswald,sans-serif;'+fade+'">'
        +'<div style="font-size:clamp(28px,3vw,42px);color:#D4A843;letter-spacing:4px;margin-bottom:16px">SIN LEVANTADOR ACTUAL</div>'
        +'<div style="font-size:clamp(14px,1.4vw,18px);color:rgba(220,230,245,.7);max-width:600px;line-height:1.6">El widget no encontró un atleta con peso cargado en el intento actual del flight '+(DATA.flight||'?')+'. Anda a Atletas &amp; Pesaje en YourLift y carga pesos de apertura para que aparezca.</div>'
      +'</div>';
    }
  }
  // Scoreboard (corner) — anim "explode from logo" si HAY logo, cascade original si no.
  if((showSb||(animSb&&animSb.dir==='out'))&&cur){
    const hasLogoSb = !!((DATA.event==null?void 0:DATA.event.logoUrl));
    const sbHtml=_renderTxCerScoreboardBL(cur,{noAnimate:true,scale:(_txDirState.scoreboard==null?void 0:_txDirState.scoreboard.scale)||1,animDir:(animSb==null?void 0:animSb.dir)||null});
    const isSbEnter = animSb && animSb.dir==='in';
    // Sin logo: usar el HTML directo (la cascada _sbRowAnim ya viene del render con animDir)
    // Con logo: envolvemos para gatear logo zoom + explode, sin replay en updates
    html += (hasLogoSb && isSbEnter) ? '<div class="sb-wrap-anim">'+sbHtml+'</div>' : sbHtml;
  }
  // Timer (corner) — slide-in/out desde la derecha
  if(showTm||(animTm&&animTm.dir==='out')){
    const tmAnim=animTm?(animTm.dir==='in'?'animation:txSlideInRight .65s cubic-bezier(.2,.85,.3,1) forwards;':'animation:txSlideOutRight .55s cubic-bezier(.5,0,.7,.5) forwards;'):'';
    const tmHtml=_renderTxCerTimerCorner((_txDirState.timer==null?void 0:_txDirState.timer.scale)||1);
    html+=tmAnim?'<div style="'+tmAnim+'">'+tmHtml+'</div>':tmHtml;
  }
  // Tabla Actual (corner inferior derecha) — anim "explode from logo" si HAY logo, slide-up si no.
  const showTabla=_txDirActive('tablaActual');
  const animTabla=_txAnimActive('tablaActual');
  if((showTabla||(animTabla&&animTabla.dir==='out'))&&cur){
    const hasLogo = !!((DATA.event==null?void 0:DATA.event.logoUrl));
    const isEntering = animTabla && animTabla.dir==='in';
    const isExiting  = animTabla && animTabla.dir==='out';
    let wrapClass = '';
    let taAnim = '';
    if(hasLogo){
      wrapClass = isEntering ? 'ta-wrap-anim' : '';
      taAnim = isExiting ? 'animation:txSlideOutBottom .55s cubic-bezier(.5,0,.7,.5) forwards;' : '';
    } else {
      // Sin logo: animación original slide-up desde abajo
      taAnim = isEntering
        ? 'animation:txSlideInBottom .75s cubic-bezier(.2,.85,.3,1.05) forwards;'
        : (isExiting ? 'animation:txSlideOutBottom .55s cubic-bezier(.5,0,.7,.5) forwards;' : '');
    }
    const taScale=(_txDirState.tablaActual==null?void 0:_txDirState.tablaActual.scale)||1;
    const taHtml=renderTxTablaActual(cur);
    // La escala va en una capa APARTE de la animación. Iban las dos en el mismo
    // elemento, y como los fotogramas animan transform y terminan con
    // "forwards", el último fotograma pisaba la escala: cambiar el tamaño no
    // hacía nada. Separadas, cada transform es de una capa distinta.
    const wrap='<div class="'+wrapClass+'" style="position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;'+taAnim+'">'
      +(taScale!==1?'<div style="position:absolute;top:0;right:0;bottom:0;left:0;transform:scale('+taScale+');transform-origin:bottom right">'+taHtml+'</div>':taHtml)
      +'</div>';
    html+=wrap;
  }
  // Luces de jueces — banda inferior-centro, entra/sale deslizando desde abajo.
  //
  // Se deja prendido toda la competencia: mientras no hay decisión no dibuja
  // nada, y aparece solo cuando los jueces marcan. Al apagarse las luces en el
  // panel de jueces, desaparece de la misma forma.
  //
  // Es un espejo. El válido o el nulo se sigue dando en Control en Vivo o en la
  // planilla; esto no decide nada.
  {
    const showLuces=_txDirActive('luces');
    const animLuces=_txAnimActive('luces');
    if(showLuces||(animLuces&&animLuces.dir==='out')){
      _txStartLightsListener();
      const lzHtml=renderTxLucesBanda();
      if(lzHtml){
        const lzAnim=animLuces
          ?(animLuces.dir==='in'?'animation:txSlideInBottom .75s cubic-bezier(.2,.85,.3,1.05) forwards;'
                                :'animation:txSlideOutBottom .55s cubic-bezier(.5,0,.7,.5) forwards;')
          :'';
        // La escala, en su propia capa: si va en el mismo elemento que la
        // animación, el transform de los fotogramas la pisa y no cambia nada.
        const lzScale=(_txDirState.luces==null?void 0:_txDirState.luces.scale)||1;
        html+='<div style="position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;'+lzAnim+'">'
          +(lzScale!==1?'<div style="position:absolute;top:0;right:0;bottom:0;left:0;transform:scale('+lzScale+');transform-origin:bottom left">'+lzHtml+'</div>':lzHtml)
          +'</div>';
      }
    }
  }
  // Decisión del jurado — esquina superior izquierda. Igual que las luces, se
  // deja prendido: no se ve nada hasta que el jurado revierte un intento desde
  // el panel de jueces, y ahí aparece unos segundos.
  if(_txDirActive('jurado')){
    _txStartLightsListener();
    if(_txJurado&&Date.now()<_txJuradoHasta){
      const jsc=(_txDirState.jurado==null?void 0:_txDirState.jurado.scale)||1;
      html+='<div style="position:fixed;top:0;left:0;pointer-events:none;'+(jsc!==1?'transform:scale('+jsc+');transform-origin:top left;':'')+'">'
        +renderTxJurado(_txJurado)+'</div>';
    }
  }
  // Medallero (Top 3) — banda inferior-centro, entra/sale deslizando desde abajo
  const animMedals=_txAnimActive('medals');
  if(showMedals||(animMedals&&animMedals.dir==='out')){
    const mdAnim=animMedals?(animMedals.dir==='in'?'animation:txSlideInBottom .75s cubic-bezier(.2,.85,.3,1.05) forwards;':'animation:txSlideOutBottom .55s cubic-bezier(.5,0,.7,.5) forwards;'):'';
    const mdScale=md.scale||1;
    const mdHtml=renderTxMedals(md);
    // Misma separación que en la Tabla Actual: la animación en una capa, la
    // escala en otra, si no el transform de los fotogramas pisa el de la escala.
    if(mdHtml)html+='<div style="position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;'+mdAnim+'">'
      +(mdScale!==1?'<div style="position:absolute;top:0;right:0;bottom:0;left:0;transform:scale('+mdScale+');transform-origin:bottom center">'+mdHtml+'</div>':mdHtml)
      +'</div>';
  }
  if(showSlam){
    // Slam armado: cuando el operador marca ✓/✗ en Control en Vivo,
    // _txSlamScan detecta la nueva transición y setea _txSlamType/_txSlamUntil.
    // El corner se muestra solo durante la ventana del flash.
    // Si el botón fue disparado con type explícito (legacy), respetamos eso también.
    _txSlamScan();
    let slamType=null, slamUntil=0;
    if((_txDirState.slam==null?void 0:_txDirState.slam.type)&&((_txDirState.slam==null?void 0:_txDirState.slam.until)||0)>Date.now()){
      // Modo manual legacy (action:slam type:g/n)
      slamType=_txDirState.slam.type;
      slamUntil=_txDirState.slam.until;
    } else if(_txSlamType&&Date.now()<_txSlamUntil){
      // Modo auto (toggle slam armado, dispara cuando hay decisión)
      slamType=_txSlamType;
      slamUntil=_txSlamUntil;
    }
    if(slamType){
      html+=_renderTxCerSlamCorner(slamType,(_txDirState.slam==null?void 0:_txDirState.slam.scale)||1);
      setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},Math.max(50,slamUntil-Date.now()+50));
    }
  }
  // Cambio de intento (3er peso muerto, o banca de quien compite solo en banca):
  // cartel amarillo abajo a la derecha, sin el nombre — el nombre ya está en el
  // marcador. Si la Tabla Actual ocupa esa esquina, sube arriba a la derecha.
  // Se apaga solo cuando el intento se juzga.
  if(cur&&!_fsVisible&&_cambiosIntentoActual(cur)){
    html+='<div style="position:fixed;'+(_txDirActive('tablaActual')?'top:24px':'bottom:24px')+';right:24px;pointer-events:none;animation:txSlideInBottom .45s ease-out">'
      +_cartelCambioHtml('26px')+'</div>';
  }
  c.innerHTML=html;
  _txDirScheduleHide();
  // Programar tick cada 1s para el break timer (re-update via signature skip)
  if(showBreak){
    setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},1000);
  }
}

function _renderTxBreakTimer(bt,scale){
  const elapsed=bt.pausedAt?(bt.pausedAt-bt.startedAt):(Date.now()-bt.startedAt);
  const rem=Math.max(0,Math.ceil((bt.durationSec*1000-elapsed)/1000));
  const m=Math.floor(rem/60),s=rem%60;
  const txt=m+':'+(s<10?'0':'')+s;
  const timerColor=rem<=10?'#ef4444':rem<=30?'#f59e0b':'#ffffff';
  const movement=(bt.movement||'').toUpperCase();
  const pausedBadge=bt.pausedAt?'<div style="margin-top:10px;display:inline-block;padding:5px 16px;background:rgba(245,158,11,.18);border:2px solid #f59e0b;border-radius:6px;font-family:Oswald;font-size:15px;letter-spacing:5px;color:#f59e0b"><i class=yl-i-pausa></i> PAUSADO</div>':'';
  const sc=scale||1;
  const hasVideo=(bt.videos||[]).length>0;
  const evObj=DATA&&DATA.event;
  const evName=evObj?(evObj.nombre||evObj.name||''):'';
  // ── Parámetros de estilo editables ────────────────────────────────────
  const stl=bt.style||{};
  const bgColor=stl.bgColor||'#0A1628';
  const accentColor=stl.accentColor||'#C41E3A';
  const videoX=stl.videoX!=null?Number(stl.videoX):0;
  const videoY=stl.videoY!=null?Number(stl.videoY):5;
  const videoW=stl.videoW!=null?Number(stl.videoW):40;
  const videoH=stl.videoH!=null?Number(stl.videoH):80;
  const textX=stl.textX!=null?Number(stl.textX):44;
  const textY=stl.textY!=null?Number(stl.textY):10;
  const titleSize=stl.titleSize!=null?Number(stl.titleSize):8;
  const movSize=stl.movSize!=null?Number(stl.movSize):5;
  const timerSz=stl.timerSize!=null?Number(stl.timerSize):12;
  const showLogos=false;
  const barH=showLogos?'clamp(52px,7vh,84px)':'0px';
  const titleTop=stl.titleTop!=null?Number(stl.titleTop):10;
  const overlayOp=stl.overlayOpacity!=null?Number(stl.overlayOpacity):0.65;
  // hex → rgba para el overlay semi-transparente sobre el video de fondo
  const _h2r=(hex,a)=>{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';};
  const overlayRgba=_h2r(bgColor,overlayOp);
  // NEO logo — N con diagonal correcta (top-left → bottom-right) + barra derecha
  const neoSvg='<svg viewBox="0 0 290 90" xmlns="http://www.w3.org/2000/svg" style="height:clamp(36px,5.5vh,66px);width:auto;display:block;fill:white">'
    +'<polygon fill-rule="evenodd" points="0,0 20,0 70,90 90,90 90,0 70,0 20,90 0,90"/>'
    +'<rect x="103" y="0" width="87" height="24"/>'
    +'<rect x="103" y="33" width="87" height="24"/>'
    +'<rect x="103" y="66" width="87" height="24"/>'
    +'<path fill-rule="evenodd" d="M203,0 L290,0 L290,90 L203,90 Z M226,22 L267,22 L267,68 L226,68 Z"/>'
  +'</svg>';
  const sponsorBar=showLogos
    ?'<div style="position:absolute;bottom:0;left:0;right:0;height:'+barH+';background:rgba(0,0,0,.85);border-top:2px solid '+accentColor+';display:flex;align-items:center;justify-content:center;gap:clamp(18px,3.5vw,55px);padding:0 4vw;z-index:6">'
      +'<img src="YourLift_logo.png" style="height:clamp(22px,3.2vh,40px);width:auto;object-fit:contain;filter:brightness(1.1)" onerror="this.style.display=\'none\'">'
      +(stl.eventLogoUrl?'<div style="width:1px;height:36%;background:rgba(255,255,255,.2)"></div><img src="'+stl.eventLogoUrl+'" style="height:clamp(22px,3.2vh,40px);width:auto;max-width:clamp(80px,12vw,180px);object-fit:contain;filter:brightness(0) invert(1)" onerror="this.style.display=\'none\'">':'')
      +'<div style="width:1px;height:36%;background:rgba(255,255,255,.2)"></div>'
      +neoSvg+'</div>'
    :'';
  const scStyle=sc!==1?'transform:scale('+sc+');transform-origin:center center;':'';

  if(hasVideo){
    // fades que cubren los bordes del video (z:3, encima del _btVideoFgEl en z:2)
    const vl=videoX,vt=videoY,vw=videoW,vh=videoH;
    const colorOv='<div style="position:absolute;top:0;right:0;bottom:0;left:0;background:'+overlayRgba+';pointer-events:none"></div>';
    const fadeR='<div style="position:absolute;left:'+vl+'%;top:'+vt+'%;width:'+vw+'%;height:'+vh+'%;pointer-events:none;background:linear-gradient(to right,transparent 52%,'+overlayRgba+' 94%)"></div>';
    const fadeT='<div style="position:absolute;left:'+vl+'%;top:'+vt+'%;width:'+vw+'%;height:22%;pointer-events:none;background:linear-gradient(to bottom,'+overlayRgba+' 0%,transparent 100%)"></div>';
    const fadeB='<div style="position:absolute;left:'+vl+'%;top:'+(vt+vh-22)+'%;width:'+vw+'%;height:22%;pointer-events:none;background:linear-gradient(to top,'+overlayRgba+' 0%,transparent 100%)"></div>';
    return '<div style="position:fixed;top:0;right:0;bottom:0;left:0;z-index:3;overflow:hidden;background:transparent;'+scStyle+'">'
      +colorOv+fadeR+fadeT+fadeB
      // Bloque de texto — posicionado absolutamente
      +'<div style="position:absolute;left:'+textX+'%;top:'+textY+'%;z-index:5;display:flex;flex-direction:column;align-items:flex-start;max-width:'+(100-textX-2)+'%">'
        +'<div style="font-family:Oswald,Impact,sans-serif;font-size:'+titleSize+'vw;font-weight:900;color:#ffffff;line-height:.88;letter-spacing:2px;text-transform:uppercase;text-shadow:0 4px 24px rgba(0,0,0,.9);white-space:nowrap">YA VOLVEMOS</div>'
        +'<div style="width:clamp(50px,6vw,110px);height:3px;background:'+accentColor+';margin:clamp(8px,1.2vh,18px) 0;box-shadow:0 0 10px '+accentColor+'99"></div>'
        +(movement?'<div style="font-family:Oswald,Impact,sans-serif;font-size:'+movSize+'vw;font-weight:700;color:#ffffff;line-height:1;letter-spacing:2px;margin-bottom:clamp(6px,1vh,16px);white-space:nowrap">'+movement+'</div>':'')
        +'<div id="dirBreakDisplay" style="font-family:Oswald,Impact,sans-serif;font-size:'+timerSz+'vw;font-weight:900;color:'+timerColor+';line-height:.9;letter-spacing:2px;text-shadow:0 4px 22px rgba(0,0,0,.85)">'+txt+'</div>'
        +pausedBadge
        +(evName?'<div style="font-family:Oswald;font-size:clamp(9px,1vw,15px);letter-spacing:5px;color:rgba(255,255,255,.38);text-transform:uppercase;margin-top:clamp(6px,1vh,14px)">'+String(evName).toUpperCase()+'</div>':'')
      +'</div>'
      +sponsorBar
    +'</div>';
  }

  return '<div style="position:fixed;top:0;right:0;bottom:0;left:0;z-index:3;overflow:hidden;background:'+bgColor+';'+scStyle+'">'
    +'<div style="position:absolute;top:0;right:0;bottom:0;left:0;bottom:'+barH+';display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;padding:'+titleTop+'vh 4vw 3vh">'
      +''
      +'<div style="font-family:Oswald,Impact,sans-serif;font-size:'+titleSize+'vw;font-weight:900;color:#ffffff;line-height:.88;letter-spacing:2px;text-transform:uppercase;text-shadow:0 4px 24px rgba(0,0,0,.9)">YA VOLVEMOS</div>'
      +'<div style="width:clamp(50px,6vw,110px);height:3px;background:'+accentColor+';margin:clamp(8px,1.2vh,18px) auto;box-shadow:0 0 10px '+accentColor+'99"></div>'
      +(movement?'<div style="font-family:Oswald,Impact,sans-serif;font-size:'+movSize+'vw;font-weight:700;color:#ffffff;line-height:1;letter-spacing:2px;margin-bottom:clamp(6px,1vh,14px)">'+movement+'</div>':'')
      +'<div id="dirBreakDisplay" style="font-family:Oswald,Impact,sans-serif;font-size:'+timerSz+'vw;font-weight:900;color:'+timerColor+';line-height:.9;letter-spacing:3px;text-shadow:0 6px 28px rgba(0,0,0,.85)">'+txt+'</div>'
      +pausedBadge
      +(evName?'<div style="font-family:Oswald;font-size:clamp(10px,1.1vw,16px);letter-spacing:5px;color:rgba(255,255,255,.38);margin-top:clamp(8px,1.2vh,16px)">'+String(evName).toUpperCase()+'</div>':'')
    +'</div>'
    +sponsorBar
  +'</div>';
}

function _txSlamScan(){
  // Detecta nueva transición null → g/r en cualquier intento.
  // Primera pasada: solo poblar el set, no disparar nada.
  const isFirst=(_txSlamSeen===null);
  if(isFirst)_txSlamSeen={};
  let fired=null;
  DATA.athletes.forEach(a=>{
    LIFTS.forEach(l=>{
      (a.att&&a.att[l]||[]).forEach((att,i)=>{
        const k=a.id+'-'+l+'-'+i;
        const prev=_txSlamSeen[k];
        const now=att.r||null;
        if(!isFirst&&(prev==null||prev===undefined)&&(now==='g'||now==='r')){
          fired={type:now,name:a.name||'',lift:l,round:i};
        }
        _txSlamSeen[k]=now;
      });
    });
  });
  if(fired){
    _txSlamUntil=Date.now()+2200;
    _txSlamType=fired.type;
    _txSlamLifterName=fired.name;
    setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},2300);
  }
}

function renderTxSlam(){
  _txSlamScan();
  if(!_txSlamType||Date.now()>=_txSlamUntil){
    return '';
  }
  const isGood=_txSlamType==='g';
  const text=isGood?'GOOD LIFT':'NO LIFT';
  const color=isGood?'#22c55e':'#ef4444';
  const glow=isGood?'rgba(34,197,94,.85)':'rgba(239,68,68,.85)';
  return '<div style="position:fixed;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:txSlamFlash 2.1s ease-in-out forwards">'
    +'<div style="font-family:Oswald,sans-serif;font-size:clamp(80px,14vw,200px);font-weight:900;letter-spacing:8px;color:'+color+';text-shadow:0 0 60px '+glow+',0 0 120px '+glow+',0 8px 30px rgba(0,0,0,.9);animation:txSlamIn .55s cubic-bezier(.2,.9,.2,1) backwards,txSlamOut .35s ease-in 1.75s forwards;-webkit-text-stroke:3px rgba(0,0,0,.4)">'+text+'</div>'
    +(_txSlamLifterName?'<div style="margin-top:18px;font-family:Oswald,sans-serif;font-size:clamp(18px,2vw,28px);letter-spacing:6px;color:#fff;text-shadow:0 4px 16px rgba(0,0,0,.9);animation:txFade .8s ease .35s backwards">'+_txSlamLifterName.toUpperCase()+'</div>':'')
    +'</div>';
}

// ─── TIMER (1:00 → 0:00 standalone) ────────────────────────────
// Widget "Timer independiente" (?tx=timer) DESACTIVADO a pedido: el tiempo para dar el
// próximo intento ahora es privado, solo lo ve el juez/operador en Control en Vivo. Se
// deja la función devolviendo vacío (en vez de borrar el widget) para no romper escenas
// de OBS que ya tengan esta fuente agregada — simplemente queda transparente/sin contenido.
function renderTxTimer(){
  return '';
}

function _txStartLightsListener(){
  // El widget arranca antes de saber de qué campeonato es (el link se resuelve
  // después): si el canal cambió, se suelta el que tenía y se toma el bueno.
  if(_txLightsUnsub&&_txLightsDoc===juezDocId())return;
  if(_txLightsUnsub){try{_txLightsUnsub()}catch(e){} _txLightsUnsub=null;}
  if(!fbReady||!window._fb){
    if(!_txLightsPoll){
      _txLightsPoll=setInterval(()=>{
        if(fbReady&&window._fb){clearInterval(_txLightsPoll);_txLightsPoll=null;_txStartLightsListener()}
      },300);
    }
    return;
  }
  try{
    _txLightsDoc=juezDocId();
    _txLightsUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'judge_decisions',_txLightsDoc),(snap)=>{
      if(!snap.exists())return;
      const d=snap.data();
      _txLights={izq:d.izq||null,central:d.central||null,der:d.der||null};
      _txLightsResetTs=d.reset_ts||0;
      // Decisión del jurado: se muestra JURADO_MS desde que llega. La que ya
      // estaba en el documento al abrir la transmisión es vieja y no sale.
      { const j=d.jurado, ts=(j&&j.ts)||0;
        if(_txJuradoTs===null)_txJuradoTs=ts;
        else if(ts&&ts!==_txJuradoTs){
          _txJuradoTs=ts; _txJurado=j; _txJuradoHasta=Date.now()+JURADO_MS;
          setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},JURADO_MS+80);
        } }
      if(typeof renderTxWidget==='function')renderTxWidget();
    });
  }catch(e){console.warn('[TX] lights subscribe fail',e)}
}

// Cuánto queda en pantalla la decisión del jurado.
const JURADO_MS=12000;

// "JURY HAS OVERRULED · Decisión del jurado", con la luz como la de los jueces:
// blanca si quedó válido, roja con el punto de la tarjeta debajo si quedó nulo.
// Con los colores del scoreboard (fondo de su encabezado y color de acento), así
// combina con lo que se elija en Control TX.
function renderTxJurado(j){
  const v=j.res==='g'?'white':(j.card||'red');
  const e=_luzEstilo(v);
  const a=(DATA.athletes||[]).find(x=>x.id===j.id);
  const nombre=(a&&a.name)||j.name||'';
  const intento=(LIFT_S[j.lift]||'')+' '+((j.round|0)+1);
  return '<div style="margin:clamp(18px,2.4vw,40px);display:flex;align-items:center;gap:clamp(14px,1.6vw,26px);'
    +'padding:clamp(12px,1.3vw,20px) clamp(16px,1.8vw,30px);background:'+_txC('headerBg')+';border-left:6px solid '+_txC('accent')+';border-radius:10px;'
    +'box-shadow:0 10px 40px rgba(0,0,0,.55);animation:txSlideInLeft .6s cubic-bezier(.2,.85,.3,1) both;font-family:Oswald,sans-serif">'
    +'<div style="display:flex;flex-direction:column;align-items:center;gap:8px">'
      +'<div style="width:clamp(46px,4.2vw,72px);height:clamp(46px,4.2vw,72px);border-radius:50%;background:'+e.bg+';border:4px solid '+e.bd+';box-shadow:'+e.glow+'"></div>'
      +(e.chip?'<div style="width:clamp(16px,1.4vw,24px);height:clamp(16px,1.4vw,24px);border-radius:50%;background:'+e.chip+';box-shadow:0 0 14px '+e.chip+'"></div>'
              :'<div style="height:clamp(16px,1.4vw,24px)"></div>')
    +'</div>'
    +'<div>'
      +'<div style="font-size:clamp(22px,2.4vw,40px);font-weight:700;letter-spacing:2px;color:#fff;line-height:1">JURY HAS OVERRULED</div>'
      +'<div style="font-size:clamp(12px,1.05vw,17px);letter-spacing:4px;color:'+_txC('accent')+';margin-top:6px">DECISIÓN DEL JURADO · '+(j.res==='g'?'GOOD LIFT':'NO LIFT')+'</div>'
      +(nombre?'<div style="font-size:clamp(13px,1.1vw,18px);color:rgba(220,230,245,.85);margin-top:8px;letter-spacing:1px">'+nombre+' · '+intento+'</div>':'')
    +'</div>'
  +'</div>';
}

// Cómo se ve una luz. El juez marca cuatro cosas, no dos: blanco (válido) y tres
// nulos que se diferencian por la tarjeta — rojo, azul o amarillo.
//
// Antes acá solo se miraba 'white' y 'red': un juez que apretaba AZUL o AMARILLO
// salía en la pantalla como si no hubiera votado todavía. Ahora los tres nulos
// encienden la luz roja, y debajo va un punto chico con el color de la tarjeta,
// que es lo que le dice al atleta POR QUÉ le dieron nulo. El blanco no lleva
// punto: en un intento válido no hay nada que explicar.
function _luzEstilo(v){
  const nulo=(v==='red'||v==='blue'||v==='yellow');
  const CHIP={red:'#ef4444',blue:'#3b82f6',yellow:'#f59e0b'};
  return {
    on:(v==='white'||nulo),
    bg:v==='white'?'#fff':(nulo?'#ef4444':'rgba(255,255,255,.07)'),
    bd:v==='white'?'#fff':(nulo?'#ef4444':'rgba(255,255,255,.22)'),
    glow:v==='white'?'0 0 26px rgba(255,255,255,.8)':(nulo?'0 0 26px rgba(239,68,68,.8)':'none'),
    chip:nulo?CHIP[v]:'',   // el color de la tarjeta; vacío en blanco y sin voto
  };
}

// La banda de luces del control remoto: los tres círculos abajo al centro, con
// el nombre del atleta y el intento.
//
// Devuelve '' mientras no haya ninguna luz marcada. Es a propósito: el
// componente se deja prendido toda la competencia y aparece solo cuando los
// jueces deciden, sin que nadie tenga que apretar nada en el momento.
function renderTxLucesBanda(){
  const L=_txLights||{};
  if(!L.izq&&!L.central&&!L.der)return '';
  const cur=liftQueue()[0]||null;
  const orden=['izq','central','der'];
  const luz=(j,i)=>{
    const v=L[j];
    const e=_luzEstilo(v);
    const glow=v==='white'?'0 0 34px rgba(255,255,255,.75)':(e.chip?'0 0 34px rgba(239,68,68,.75)':'none');
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:7px">'
      +'<div style="width:76px;height:76px;border-radius:50%;background:'+e.bg+';border:5px solid '+e.bd+';box-shadow:'+glow+',inset 0 0 18px rgba(0,0,0,'+(e.on?'.15':'.5')+');'
      +(e.on?'animation:txLightOn .35s cubic-bezier(.2,.9,.2,1) backwards;animation-delay:'+(i*0.08)+'s':'')+'"></div>'
      +'<div style="width:20px;height:20px;border-radius:50%;background:'+(e.chip||'rgba(255,255,255,.08)')+';border:2px solid rgba(255,255,255,.25)"></div>'
      +'</div>';
  };
  const cab=cur
    ?'<div style="text-align:center;margin-bottom:12px;font-family:Oswald;color:#fff">'
      +'<div style="font-size:22px;font-weight:800;letter-spacing:.04em;line-height:1.1">'+esc(cur.name||'')+'</div>'
      +'<div style="font-size:14px;font-weight:600;letter-spacing:.12em;color:#D4A843;margin-top:3px">'
        +(LIFT_S[DATA.lift]||'')+' '+(DATA.round+1)
        +(((cur.att==null?void 0:(__o=>__o==null?void 0:(__o=>__o==null?void 0:__o.w)(__o[DATA.round]))(cur.att[DATA.lift])))?' · '+cur.att[DATA.lift][DATA.round].w+' KG':'')+'</div></div>'
    :'';
  // Abajo a la IZQUIERDA: es la esquina que queda libre — el scoreboard ocupa el
  // ancho de abajo, la tabla actual va a la derecha y el medallero al centro.
  // La escala NO se pone acá: va en una capa aparte, porque si comparte elemento
  // con la animación de entrada, el transform de los fotogramas la pisa.
  return '<div style="position:fixed;left:34px;bottom:48px;transform-origin:bottom left;'
    +'background:linear-gradient(180deg,rgba(10,22,40,.93),rgba(6,13,26,.96));border:1px solid rgba(212,168,67,.4);border-top:3px solid #D4A843;'
    +'border-radius:14px;padding:18px 42px 20px;box-shadow:0 12px 40px rgba(0,0,0,.55)">'
    +cab
    +'<div style="display:flex;gap:34px;align-items:flex-start;justify-content:center">'+orden.map(luz).join('')+'</div>'
    +'</div>';
}

function renderTxLights(){
  if(TX_MODE==='lights')_txStartLightsListener();
  const order=['izq','central','der'];
  let h='<div style="position:fixed;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;gap:clamp(20px,3vw,60px)">';
  order.forEach((j,i)=>{
    const v=_txLights[j];
    const e=_luzEstilo(v);
    const lit=e.on;
    const glow=v==='white'?'0 0 60px rgba(255,255,255,.85),0 0 120px rgba(255,255,255,.45)'
              :(e.chip?'0 0 60px rgba(239,68,68,.85),0 0 120px rgba(239,68,68,.45)':'none');
    h+='<div style="display:flex;flex-direction:column;align-items:center;gap:clamp(8px,1vw,18px)">';
    h+='<div style="width:clamp(120px,14vw,220px);height:clamp(120px,14vw,220px);border-radius:50%;background:'+e.bg+';border:6px solid '+e.bd+';box-shadow:'+glow+',inset 0 0 30px rgba(0,0,0,'+(lit?'.15':'.5')+');'+(lit?'animation:txLightOn .35s cubic-bezier(.2,.9,.2,1) backwards;animation-delay:'+(i*0.08)+'s':'')+'"></div>';
    // El punto de la tarjeta, abajo de la luz. Solo en los nulos.
    h+='<div style="width:clamp(26px,3vw,46px);height:clamp(26px,3vw,46px);border-radius:50%;'
      +(e.chip?'background:'+e.chip+';box-shadow:0 0 22px '+e.chip:'background:transparent')+'"></div>';
    h+='</div>';
  });
  h+='</div>';
  return h;
}

// Las tres luces, en chico, para meterlas dentro de una pantalla de tarima.
// Es SOLO un espejo de lo que marcan los jueces: esta pantalla no decide nada.
// El válido/nulo se sigue dando en Control en Vivo o en la planilla, como
// siempre — acá no se toca ese camino ni se enciende el modo jueces.
// enBloque: las luces van adentro de un bloque movible (pantalla "Atleta en
// barra"), así que ahí NO se posicionan solas ni bloquean el click — si no,
// no habría cómo agarrarlas para moverlas.
function renderLucesTarima(enBloque){
  _txStartLightsListener();
  const orden=['izq','central','der'];
  // bottom:4vh — antes 2.5vh, pero con el punto de la tarjeta abajo la columna
  // creció y el punto quedaba pegado al borde de la pantalla.
  let h='<div style="'+(enBloque?''
      :'position:absolute;left:50%;bottom:4vh;transform:translateX(-50%);pointer-events:none;')
    +'display:flex;gap:clamp(10px,1.6vw,26px);z-index:5">';
  orden.forEach((j,i)=>{
    const e=_luzEstilo(_txLights[j]);
    h+='<div style="display:flex;flex-direction:column;align-items:center;gap:clamp(4px,.6vw,10px)">';
    h+='<div style="width:clamp(42px,5.2vw,84px);height:clamp(42px,5.2vw,84px);border-radius:50%;'
      +'background:'+e.bg+';border:4px solid '+e.bd+';box-shadow:'+e.glow+',inset 0 0 14px rgba(0,0,0,'+(e.on?'.15':'.45')+');'
      +(e.on?'animation:txLightOn .35s cubic-bezier(.2,.9,.2,1) backwards;animation-delay:'+(i*0.07)+'s':'')+'"></div>';
    // Punto chico con el color de la tarjeta: le dice al atleta por qué fue nulo.
    h+='<div style="width:clamp(11px,1.35vw,22px);height:clamp(11px,1.35vw,22px);border-radius:50%;'
      +(e.chip?'background:'+e.chip+';box-shadow:0 0 12px '+e.chip:'background:transparent')+'"></div>';
    h+='</div>';
  });
  h+='</div>';
  return h;
}

// Pantalla de tarima dedicada SOLO a las luces: las tres grandes al centro y
// arriba de quién es el intento que se está juzgando. Sirve para el monitor que
// mira el público cuando no se quiere mostrar nada más.
// Igual que las chicas: es un espejo, acá no se decide nada.
function renderScreenLuces(a){
  _txStartLightsListener();
  const orden=['izq','central','der'];
  let luces='<div style="display:flex;gap:clamp(24px,4vw,90px);align-items:center;justify-content:center">';
  orden.forEach((j,i)=>{
    const v=_txLights[j];
    const e=_luzEstilo(v);
    const glow=v==='white'?'0 0 70px rgba(255,255,255,.85),0 0 140px rgba(255,255,255,.4)'
              :(e.chip?'0 0 70px rgba(239,68,68,.85),0 0 140px rgba(239,68,68,.4)':'none');
    luces+='<div style="display:flex;flex-direction:column;align-items:center;gap:clamp(10px,1.4vh,26px)">';
    luces+='<div style="width:clamp(110px,17vw,280px);height:clamp(110px,17vw,280px);border-radius:50%;'
      +'background:'+e.bg+';border:7px solid '+e.bd+';box-shadow:'+glow+',inset 0 0 34px rgba(0,0,0,'+(e.on?'.15':'.5')+');'
      +(e.on?'animation:txLightOn .35s cubic-bezier(.2,.9,.2,1) backwards;animation-delay:'+(i*0.07)+'s':'')+'"></div>';
    luces+='<div style="width:clamp(28px,4.2vw,68px);height:clamp(28px,4.2vw,68px);border-radius:50%;'
      +(e.chip?'background:'+e.chip+';box-shadow:0 0 28px '+e.chip:'background:transparent')+'"></div>';
    luces+='</div>';
  });
  luces+='</div>';

  // Encabezado con el atleta: sin esto, tres luces solas no dicen de quién son.
  let cab='';
  if(a){
    const l=DATA.lift, r=(typeof curAtt==='function')?curAtt(a):DATA.round;
    const at=(a.att&&a.att[l])?a.att[l][r]:null;
    const kg=(at&&at.w)||0;
    cab='<div style="text-align:center;margin-bottom:clamp(18px,4vh,52px)">'
      +'<div style="font-size:clamp(20px,3.4vw,52px);font-weight:700;letter-spacing:.04em;color:#fff;line-height:1.1">'
      +esc(a.name||'')+'</div>'
      +'<div style="margin-top:.5em;font-size:clamp(15px,2.4vw,34px);font-weight:600;letter-spacing:.12em;color:#D4A843">'
      +(_LIFT_SIGLA[l]||'')+' '+(r+1)+(kg?' · '+kg.toFixed(1).replace(/\.0$/,'')+' KG':'')+'</div></div>';
  }
  // Los logos, abajo, como en el resto de las escenas de la pantalla: esta era
  // la única que no los mostraba.
  const tira=_tiraLogosPantalla(['fed','camp'],'clamp(38px,6vh,92px)','clamp(14px,2vw,32px)');
  return '<div style="position:absolute;top:0;right:0;bottom:0;left:0;background:linear-gradient(160deg,#0d2141,#0A1628 55%,#060d1a);'
    +'display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Oswald,sans-serif">'
    +cab+luces
    +(tira?'<div style="position:absolute;left:0;right:0;bottom:clamp(14px,3vh,40px);display:flex;justify-content:center">'+tira+'</div>':'')
    +'</div>';
}

// ¿Se muestran las luces en la pantalla de tarima? Arranca apagado: se prende
// desde el panel cuando el campeonato las usa.
function _lucesEnTarima(){
  const st=window._SCREEN_STATE||{};
  return !!st.luces;
}

function renderTxProfile(cur){
  _pedirFotos();
  const full=txLookupFull(cur);
  // Media efectiva: foto/gif subida en el livecast (persistente) tiene prioridad
  // sobre la de la base de Chile. Permite fotos de atletas internacionales.
  const _lm=_lcMediaFor(cur);
  const media=Object.assign({},full||{});
  if(_lm){ if(_lm.foto_url)media.foto_url=_lm.foto_url; if(_lm.gif_url)media.gif_url=_lm.gif_url; ['gif_blend','gif_zoom','gif_offset_x','gif_offset_y','gif_start','gif_end'].forEach(k=>{if(_lm[k]!==undefined)media[k]=_lm[k];}); }
  const parts=(cur.name||'').trim().split(/\s+/);
  // Nombre y apellido con la MISMA tipografía, tamaño y mayúsculas. Antes el
  // nombre iba en fina y el apellido en negrita, y se leían como dos cosas
  // distintas en la pantalla de perfil.
  // Con DOS palabras —"Ojeda Emilse", que es como viene media nómina de FESUPO—
  // slice(0,-2) daba vacío y el respaldo repetía parts[0]: en pantalla se leía
  // "OJEDA OJEDA EMILSE". Se parte igual que en el resto de las pantallas: dos
  // apellidos solo cuando hay más de dos palabras.
  const firstName=(parts.length>2?parts.slice(0,-2):parts.slice(0,-1)).join(' ').toUpperCase();
  const lastName=(parts.length>2?parts.slice(-2):parts.slice(-1)).join(' ').toUpperCase();
  const club=cur.club||(full==null?void 0:full.club)||'';
  const cat=txCatLabel(cur.cat)||(txCatNum(cur.cat)+'kg');
  const divS=txDivShort(cur.div);
  const age=txAge((full==null?void 0:full.fechaNac));
  const years=txYearsCompeting(full);
  const liftKey=DATA.lift;
  const pb=txPB(full,liftKey);
  const pbLabel={sq:'MEJOR MARCA SENTADILLA',bp:'MEJOR MARCA PRESS BANCA',dl:'MEJOR MARCA PESO MUERTO'}[liftKey]||'MEJOR MARCA';
  const clubLogoHtml=(window.clubLogoImg?window.clubLogoImg(club,52,'background:rgba(10,22,40,.6);padding:3px;margin-right:18px;vertical-align:middle;'):'');
  const chipClub=(window.clubLogoImg&&club)?window.clubLogoImg(club,48,'display:block;background:rgba(10,22,40,.35);padding:2px;'):'';
  const clubCell=clubLogoHtml?('<span style="display:inline-flex;align-items:center;gap:0;justify-content:flex-end">'+clubLogoHtml+'<span>'+(club||'—')+'</span></span>'):(club||'—');
  // En un internacional lo que se muestra es el PAÍS (con su bandera), no el club:
  // en la nómina de FESUPO el "club" es el país escrito a mano, y la fila decía
  // "CLUB · Ecuador". En un nacional sigue el club con su logo.
  const rows=[
    ['CATEGORÍA',cat+' '+divS],
    _variosPaises()
      ?['PAÍS','<span style="display:inline-flex;align-items:center;justify-content:flex-end">'+_flagImg(_ctry(cur),34,true)+'<span>'+_ctryName(_ctry(cur))+'</span></span>']
      :['CLUB',clubCell],
  ];
  if(age!==null)rows.push(['EDAD',age+'']);
  if(years!==null)rows.push(['AÑOS COMPITIENDO',years+'']);
  if(pb)rows.push([pbLabel,pb.toFixed(1)]);
  // Al lado del nombre: la bandera y el código del país. En un campeonato de un
  // solo país serían iguales para todos, así que va el logo del club (sin logo,
  // nada).
  const chipNombre=_variosPaises()
    ?`<div style="background:rgba(0,0,0,.2);padding:clamp(6px,0.7vw,10px) clamp(10px,1.2vw,16px);border-radius:5px;display:flex;align-items:center;gap:clamp(8px,0.9vw,14px)">
              <div style="width:clamp(44px,5vw,72px);height:clamp(30px,3.3vw,48px);position:relative;overflow:hidden;border-radius:2px;flex-shrink:0;box-shadow:0 1px 8px rgba(0,0,0,.5);background:#0a1628">
                ${FLAG_SVG[_ctry(cur)]?`<svg viewBox="0 0 30 20" preserveAspectRatio="none" role="img" aria-label="${_ctry(cur)}" style="position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%">${FLAG_SVG[_ctry(cur)]}</svg>`:''}
              </div>
              <span style="font-family:Oswald;font-weight:700;font-size:clamp(13px,1.4vw,22px);color:${_txC('nameText')};letter-spacing:2px">${_ctry(cur)}</span>
            </div>`
    :(chipClub?`<div style="background:rgba(0,0,0,.2);padding:clamp(4px,0.5vw,8px);border-radius:5px;display:flex;align-items:center">${chipClub}</div>`:'');
  const initials=parts.map(p=>p[0]||'').slice(0,2).join('').toUpperCase();
  const useGif=_txProfileMediaType==='gif'&&!!media.gif_url;
  const gifIsImg=useGif&&String(media.gif_url||'').toLowerCase().split('?')[0].endsWith('.gif');
  const gifBlend=useGif?(media.gif_blend||'screen'):'normal';
  const mediaBg=useGif?'#000':(media.foto_url?'#fff':'linear-gradient(135deg,#1a2e4f,#0e1f3a)');
  return `
    <div style="position:absolute;top:0;right:0;bottom:0;left:0">
    <div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;pointer-events:none;overflow:hidden">
      <img src="YourLift_logo.png" alt="" style="width:52%;opacity:0.07;filter:blur(18px);transform:scale(1.15);user-select:none" onerror="this.style.display='none'">
    </div>
    <div style="position:absolute;top:0;right:0;bottom:0;left:0;padding:clamp(40px,5vw,80px);display:flex;flex-direction:column">
      <div class="txCascade" style="display:flex;flex-direction:column;gap:clamp(8px,1.5vh,22px);max-width:1400px;width:100%;margin:auto">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:clamp(6px,1vh,16px)">
          <div style="background:${_txC('nameBg')};padding:clamp(10px,1.6vw,18px) clamp(18px,2.2vw,28px);border-radius:6px;display:flex;align-items:center;gap:clamp(10px,1.5vw,18px);box-shadow:0 4px 20px rgba(212,168,67,.35)">
            ${chipNombre}
            <div style="font-family:Oswald;font-size:clamp(26px,3.2vw,44px);font-weight:700;letter-spacing:2px;color:${_txC('nameText')}">
              ${firstName?firstName+' ':''}${lastName}
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:clamp(30px,4vw,70px);align-items:center;margin-top:clamp(10px,2vh,30px)">
          <div style="width:clamp(180px,18vw,280px);aspect-ratio:3/4;background:${mediaBg};border:3px solid ${_txC('accent')};border-radius:4px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(0,0,0,.5);position:relative;overflow:hidden">
            ${useGif
              ? (gifIsImg
                  ? `<img src="${media.gif_url}" alt="${cur.name||''}" style="position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:${gifBlend};transform:scale(${media.gif_zoom||1}) translate(${media.gif_offset_x||0}%,${media.gif_offset_y||0}%);transform-origin:center center">`
                  : `<video src="${media.gif_url}" autoplay loop muted playsinline data-gif-trim="1" data-gif-start="${media.gif_start||0}" data-gif-end="${(media.gif_end!=null?media.gif_end:(''))}" style="position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:${gifBlend};transform:scale(${media.gif_zoom||1}) translate(${media.gif_offset_x||0}%,${media.gif_offset_y||0}%);transform-origin:center center"></video>`)
              : media.foto_url
                ? `<img src="${media.foto_url}" alt="${cur.name||''}" style="width:100%;height:100%;object-fit:cover" onerror="this.outerHTML='<span style=\\'font-family:Oswald;font-size:clamp(60px,8vw,120px);font-weight:700;color:rgba(212,168,67,.55);letter-spacing:2px\\'>${initials}</span>'">`
                : `<span style="font-family:Oswald;font-size:clamp(60px,8vw,120px);font-weight:700;color:rgba(212,168,67,.55);letter-spacing:2px">${initials}</span>`
            }
          </div>
          <div class="txCascade" style="display:flex;flex-direction:column;gap:clamp(10px,1.8vh,24px)">
            ${rows.map(r=>`
              <div style="display:grid;grid-template-columns:auto 1fr;gap:40px;align-items:center;border-bottom:1px solid rgba(212,168,67,.2);padding-bottom:clamp(8px,1.2vh,14px)">
                <div style="font-family:Oswald;font-size:clamp(22px,2.4vw,36px);font-weight:600;color:rgba(220,230,245,.92);letter-spacing:3px">${r[0]}</div>
                <div style="font-family:Oswald;font-size:clamp(24px,2.6vw,40px);font-weight:700;color:${_txC('accent')};letter-spacing:1px;text-align:right">${r[1]}</div>
              </div>`).join('')}
          </div>
        </div>
        <div style="position:absolute;top:clamp(20px,2.5vw,40px);right:clamp(20px,2.5vw,40px);display:flex;align-items:center;gap:12px;padding:8px 14px;background:rgba(10,22,40,.55);border:2px solid rgba(212,168,67,.4);border-radius:8px">
          ${_tiraLogosPantalla(['fed','camp','yl'],'clamp(34px,3.6vw,56px)','14px')}
        </div>
      </div>
    </div>
    </div>`;
}

 // 20s visible
function renderTxScoreboard(cur,lifterChanged){
  if(!cur)return '';
  // Atleta real + índice del intento actual (3 si es un 4º). Las estadísticas y la
  // fila de intentos se calculan sobre el atleta real; el clon del 4º solo sirve
  // para saber cuál es el intento en curso (curAtt).
  const ra=_realAth(cur), ci=curAtt(cur);
  // Auto-hide: el marcador aparece al cambiar levantador / intento / peso / lift,
  // queda 20s en pantalla y se va con animación. Hasta el próximo cambio: oculto.
  // En modo widget (?tx=scoreboard), el render que importa es éste.
  if(TX_MODE==='scoreboard'){
    const sig=cur.id+'-'+DATA.lift+'-'+ci+'-'+((ra.att[DATA.lift][ci]&&ra.att[DATA.lift][ci].w)||0);
    if(sig!==_txSbSig){
      _txSbSig=sig;
      _txSbShownAt=Date.now();
      setTimeout(()=>{if(typeof renderTxWidget==='function')renderTxWidget()},TX_SCOREBOARD_DURATION+400);
    }
    if(Date.now()-_txSbShownAt>TX_SCOREBOARD_DURATION)return '';
  }
  const nombreAtleta=_nombrePropio(cur.name);
  const divS=txDivShort(cur.div);
  const catLabel=(cur.cat?txCatLabel(cur.cat)+' ':'')+divS;
  const rk=catRankBySub(ra);
  const st=subTotal(ra,DATA.lift);
  const cw=(ra.att[DATA.lift][ci]&&ra.att[DATA.lift][ci].w)||0;
  const simBest=Math.max(bestOf(ra,DATA.lift),cw);
  const _pool=_sbPool(ra);
  let newSub;
  if(_pool.solo)newSub=(DATA.lift==='bp')?simBest:bestOf(ra,'bp');       // Only Bench: solo cuenta la banca
  else if(DATA.lift==='sq')newSub=simBest;
  else if(DATA.lift==='bp')newSub=bestOf(ra,'sq')+simBest;
  else newSub=bestOf(ra,'sq')+bestOf(ra,'bp')+simBest;
  // Mismo sexo + cat + div (separar divisiones de edad) y misma competencia
  const simRanked=_pool.peers.map(a=>{
    if(a.id===ra.id)return{id:a.id,sub:newSub};
    return{id:a.id,sub:_pool.val(a)};
  }).filter(x=>x.sub>0).sort((a,b)=>b.sub-a.sub);
  const simPos=simRanked.findIndex(x=>x.id===ra.id)+1;
  const totalAth=simRanked.length;
  // Forecast mejorado: muestra cambio de posición si corresponde
  const forecastPos=simPos||rk.pos||0;
  const willChange=rk.pos>0&&simPos>0&&simPos!==rk.pos;
  let forecastTxt,forecastColor;
  if(forecastPos<=0){forecastTxt='—';forecastColor=_txC('puesto');}
  else if(willChange){
    forecastTxt='Puesto '+rk.pos+' → '+simPos;
    forecastColor=simPos===1?_txC('goodLift'):simPos<=3?_txC('accent'):_txC('puesto');
  }else{
    forecastTxt='Posición '+forecastPos;
    forecastColor=forecastPos===1?_txC('goodLift'):forecastPos<=3?_txC('accent'):_txC('puesto');
  }
  const _animDir=TX_MODE==='scoreboard'?null:(lifterChanged?'in':null);
  // ── Colores: el marcador sigue la paleta elegida en Control TX ──
  // Antes estaban fijos acá y la paleta no le hacía nada. El contorno negro del
  // texto NO entra en la paleta, a propósito: es lo que lo mantiene legible.
  const YL_NAVY=_txC('headerBg'), YL_GOLD=_txC('accent'), YL_TXT=_txC('nameText');
  const WHITE='#ffffff', WHITE_DIM='rgba(255,255,255,.55)', GREEN='#22c55e', RED='#ef4444';
  // ── SQUAT / BENCH PRESS / DEADLIFT / TOTAL — mejor marca válida de cada uno + estado ──
  const sqB=bestOf(ra,'sq'), bpB=bestOf(ra,'bp'), dlB=bestOf(ra,'dl');
  const dq=isDQ(ra);
  const _liftFailed=l=>ra.att[l].every(x=>x.r==='n')&&ra.att[l].some(x=>x.w>0);
  const _liftCell=(l,label,best)=>{
    let val,clr;
    if(best>0){val=best;clr=GREEN}
    else if(_liftFailed(l)){val='—';clr=RED}
    else{val='—';clr=WHITE_DIM}
    return `<div style="padding:8px 6px;text-align:center;border-right:1px solid rgba(255,255,255,.08)">
      <div style="font-family:Oswald;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.4);margin-bottom:2px">${label}</div>
      <div style="font-family:Oswald;font-size:20px;font-weight:800;color:${clr}">${val}</div>
    </div>`;
  };
  const totB=sqB+bpB+dlB;
  let totVal,totClr;
  if(dq){totVal='DQ';totClr=RED}
  else if(sqB>0&&bpB>0&&dlB>0){totVal=totB.toFixed(1);totClr=GREEN}
  else if(totB>0){totVal=totB.toFixed(1);totClr=WHITE}
  else{totVal='—';totClr=WHITE_DIM}
  const flagHtml=_variosPaises()?_flagImg(_ctry(cur),22):_logoClub(cur,34,'margin-right:0;');
  return `
    <!-- pointer-events:none — el marcador es un cartel, no una interfaz, y va al
         aire. Si el mouse queda quieto encima (queda: es la ventana que captura
         OBS) el navegador saca su globo gris y sale en la transmisión. Acá se
         puede apagar el puntero sin romper nada porque este marcador no tiene
         editor de bloques, a diferencia de Intentos y Atleta en barra. -->
    <div class="sb-card-explode" style="pointer-events:none;position:absolute;bottom:0;left:0;right:0;display:flex;align-items:stretch;${TX_MODE==='scoreboard'?'animation:txScoreboardCycle '+(TX_SCOREBOARD_DURATION/1000)+'s ease-in-out forwards':''}">
      <!-- Federación y campeonato. El de YourLift no va acá: esta pantalla está
           al aire todo el rato y lo que tiene que leerse es de quién es el
           campeonato. Si no hay ninguno cargado, el bloque no se dibuja y la
           tarjeta usa todo el ancho en vez de dejar un hueco azul. -->
      ${(()=>{const t=_tiraLogos(['fed','camp'],'76px','16px');
        return t?`<div style="flex-shrink:0;padding:0 20px;background:${YL_NAVY};border-top:3px solid ${YL_GOLD};display:flex;align-items:center;justify-content:center">${t}</div>`:'';})()}
      <div class="sb-wipe-content" style="flex:1;overflow:hidden">
        <div style="${_sbRowAnim(_animDir,0)}display:flex;justify-content:space-between;align-items:center;background:${YL_NAVY};border-top:3px solid ${YL_GOLD};padding:6px 22px">
          <div style="font-family:Oswald;font-size:13px;letter-spacing:1px;color:rgba(255,255,255,.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:38%">${cur.club||''}</div>
          <div style="font-family:Oswald;font-size:13px;letter-spacing:1px;color:rgba(255,255,255,.6)">${(rk.pos&&totalAth?rk.pos+'/'+totalAth+' en categoría':'')}</div>
          <!-- Sin title: es un globo del navegador —recuadro gris con texto— y si
               el mouse queda quieto encima del marcador, sale AL AIRE tapando el
               nombre del atleta. Pasó en el Sudamericano con Olguín Karen. -->
          <div style="font-family:Oswald;font-size:${willChange?'15px':'18px'};font-weight:800;color:${forecastColor};letter-spacing:${willChange?'1px':'2px'};white-space:nowrap">${forecastTxt}</div>
        </div>
        <div style="${_sbRowAnim(_animDir,1)}background:linear-gradient(90deg,${_txC('nameBg')},${_txC('nameBg2')});padding:7px 22px;display:flex;align-items:center;gap:12px">
          ${flagHtml}
          <div style="flex:1;font-family:Oswald;color:${YL_TXT};letter-spacing:1px;overflow:hidden">
            <div style="font-size:28px;font-weight:800;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nombreAtleta}</div>
          </div>
          <div style="background:rgba(10,22,40,.9);color:${YL_GOLD};padding:5px 14px;border-radius:4px;font-family:Oswald;font-size:16px;letter-spacing:1px;font-weight:700;white-space:nowrap">${catLabel}</div>
        </div>
        <div style="${_sbRowAnim(_animDir,2)}display:grid;grid-template-columns:repeat(${ra.att[DATA.lift].length},1fr) repeat(4,1fr);background:${_txC('gridBg')}">
          ${ra.att[DATA.lift].map((at,j)=>{
            let clr,td='none',boxSh='';
            const is4=j===3&&at.extra;
            const x4lbl=((at.grantedRound||0)>=2)?'4º':'EXT';
            if(at.r==='g'){clr=GREEN}
            else if(at.r==='n'){clr=RED;td='line-through'}
            else if(j===ci&&at.w>0){clr=WHITE;boxSh='box-shadow:inset 0 -3px 0 '+LIFT_C[DATA.lift]+';'}
            else{clr=WHITE_DIM}
            // Debajo del peso, las luces que le dieron a ESE intento. Si de ese
            // intento no hay luces guardadas, no va nada: en un campeonato sin
            // luces el scoreboard queda igual que siempre.
            const lucesAt=_lucesDeIntento(at,9);
            return '<div style="padding:'+(lucesAt?'6px 6px 4px':'8px 6px')+';text-align:center;border-right:1px solid rgba(255,255,255,.08);font-family:Oswald;font-size:22px;font-weight:700;color:'+clr+';text-decoration:'+td+';'+boxSh+'"'+(is4?' title="Intento extra / 4º"':'')+'>'+(at.w||'—')+(is4?'<sup style="font-size:10px;color:'+YL_GOLD+'">'+x4lbl+'</sup>':'')+(lucesAt?'<div style="margin-top:3px;text-decoration:none">'+lucesAt+'</div>':'')+'</div>';
          }).join('')}
          ${_liftCell('sq','SQUAT',sqB)}
          ${_liftCell('bp','BENCH PRESS',bpB)}
          ${_liftCell('dl','DEADLIFT',dlB)}
          <div style="padding:8px 6px;text-align:center">
            <div style="font-family:Oswald;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.4);margin-bottom:2px">TOTAL</div>
            <div style="font-family:Oswald;font-size:20px;font-weight:800;color:${totClr}">${totVal}</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderTxLeaderboard(cur,lifterChanged,opts){
  opts=opts||{};
  // Determine category to show: current lifter's, or first athlete of current flight if none
  const ref=cur||DATA.athletes.find(a=>a.flight===DATA.flight&&!a.bombed);
  if(!ref)return '';
  // allFlights: ranking de TODA la categoría (cubre todos los vuelos), usado en cycle de fin de lift
  // Mismo sexo + cat + div (separar divisiones de edad en el leaderboard)
  const sameCat=DATA.athletes.filter(a=>a.cat===ref.cat&&a.div===ref.div&&a.sex===ref.sex
    &&_lineaComp(a)===_lineaComp(ref)&&(opts.allFlights||a.flight===DATA.flight)&&!a.bombed);
  const ranked=sameCat.map(a=>({...a,total:totalOf(a),fTotal:forecastTotal(a),fPlace:0}));
  ranked.sort((a,b)=>b.fTotal-a.fTotal);
  ranked.forEach((a,i)=>a.fPlace=i+1);
  const divS=txDivShort(ref.div);
  const sexLabel=(ref.sex==='Femenino'||ref.sex==='Mujer'||ref.sex==='F')?'Mujer':'Hombre';
  const curBest={sq:bestOf(ref,'sq'),bp:bestOf(ref,'bp'),dl:bestOf(ref,'dl')};
  return `
    <div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;padding:clamp(30px,5vh,80px)">
      <div class="txCascade" style="width:min(1100px,95%);background:${_txC('cardBg')};backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);border:1px solid rgba(212,168,67,.4);border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45)">
        <div style="padding:clamp(14px,2vh,22px) clamp(20px,2.5vw,32px);background:${_txC('headerBg')};border-bottom:2px solid ${_txC('accent')};display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-family:Oswald;font-size:clamp(11px,1.1vw,14px);color:rgba(220,230,245,.75);letter-spacing:3px">LEADERBOARD</div>
            <div style="font-family:Oswald;font-size:clamp(20px,2.2vw,30px);font-weight:700;color:#fff;letter-spacing:2px;margin-top:2px;text-shadow:0 2px 6px rgba(0,0,0,.6)">${divS} • ${ref.cat} (${sexLabel}) <span style="font-size:.7em;opacity:.8">· ${_lineaLbl(ref)}</span></div>
          </div>
          ${_tiraLogos(['camp'],'clamp(26px,2.6vw,38px)','10px')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 120px 120px 80px;padding:10px clamp(20px,2.5vw,32px);background:rgba(10,22,40,.35);border-bottom:1px solid rgba(212,168,67,.25);font-family:Oswald;font-size:clamp(10px,1vw,13px);color:rgba(220,230,245,.7);letter-spacing:2px">
          <div>NOMBRE</div><div style="text-align:center">TOTAL</div><div style="text-align:center">F.TOT</div><div style="text-align:center">POS</div>
        </div>
        ${ranked.map(a=>{
          const isCur=a.id===ref.id;
          const logo=window.clubLogoImg?window.clubLogoImg(a.club,28,'background:rgba(10,22,40,.6);padding:2px;flex-shrink:0;'):'';
          return `<div style="display:grid;grid-template-columns:1fr 120px 120px 80px;padding:clamp(10px,1.6vh,18px) clamp(20px,2.5vw,32px);background:${isCur?_txC('lbHighlight'):'transparent'};border-bottom:1px solid rgba(212,168,67,.12);align-items:center">
            <div style="display:flex;align-items:center;gap:10px;overflow:hidden">
              ${logo||'<div style="width:28px;height:28px;flex-shrink:0"></div>'}
              <span style="font-family:Oswald;font-size:clamp(14px,1.5vw,20px);font-weight:${isCur?'700':'500'};color:${isCur?'#fff':'rgba(240,245,255,.92)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.5)">${a.name}</span>
            </div>
            <div style="font-family:Oswald;font-size:clamp(14px,1.5vw,20px);text-align:center;color:rgba(220,230,245,.75);text-shadow:0 1px 3px rgba(0,0,0,.5)">${(a.total||0).toFixed(1)}</div>
            <div style="font-family:Oswald;font-size:clamp(15px,1.6vw,22px);text-align:center;font-weight:700;color:${isCur?_txC('accent'):'rgba(240,245,255,.95)'};text-shadow:0 1px 3px rgba(0,0,0,.5)">${a.fTotal||'—'}</div>
            <div style="font-family:Oswald;font-size:clamp(16px,1.7vw,24px);text-align:center;font-weight:700;color:${isCur?_txC('accent'):'rgba(220,230,245,.8)'};text-shadow:0 1px 3px rgba(0,0,0,.5)">${a.fPlace}</div>
          </div>`;
        }).join('')}
        <div style="padding:clamp(10px,1.5vh,16px) clamp(20px,2.5vw,32px);background:rgba(196,30,58,.22);display:flex;gap:clamp(18px,2.5vw,40px);justify-content:center;align-items:center">
          ${['sq','bp','dl'].map(l=>{
            const b=curBest[l];
            return '<div style="display:flex;gap:8px;align-items:center"><span style="font-family:Oswald;font-size:clamp(11px,1.1vw,14px);color:rgba(220,230,245,.7);letter-spacing:2px">'+LIFT_S[l]+'</span><span style="font-family:Oswald;font-size:clamp(16px,1.8vw,24px);font-weight:700;color:'+(b?LIFT_C[l]:'rgba(180,200,220,.4)')+';text-shadow:0 1px 3px rgba(0,0,0,.5)">'+(b?b.toFixed(1):'—')+'</span></div>';
          }).join('')}
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════
// TX: TABLA ACTUAL — ranking de la cat actual en esquina inferior derecha
// Slide-in desde abajo. Resalta al lifter actual con flecha de posición proyectada.
// ══════════════════════════════════════════════
function renderTxTablaActual(cur,opts){
  opts=opts||{};
  const ref=cur||DATA.athletes.find(a=>a.flight===DATA.flight&&!a.bombed);
  if(!ref)return '';
  const sameCat=DATA.athletes.filter(a=>a.cat===ref.cat&&a.div===ref.div&&a.sex===ref.sex
    &&_lineaComp(a)===_lineaComp(ref)&&!a.bombed);
  // 1) Ranking ACTUAL: por total ya levantado (solo lifts válidos)
  const curRank=sameCat.map(a=>({id:a.id,total:totalOf(a)})).sort((a,b)=>b.total-a.total);
  const curPosOf={}; curRank.forEach((a,i)=>curPosOf[a.id]=i+1);
  // 2) Ranking PROYECTADO: si el intento pendiente del lifter actual resulta válido
  const fcRank=sameCat.map(a=>({id:a.id,total:a.id===ref.id?forecastTotal(a):totalOf(a)})).sort((a,b)=>b.total-a.total);
  const fcPosOf={}; fcRank.forEach((a,i)=>fcPosOf[a.id]=i+1);
  // Tabla ordenada por proyección
  const ranked=fcRank.map(r=>{
    const ath=sameCat.find(a=>a.id===r.id);
    return {...ath,total:totalOf(ath),fTotal:r.total,curPos:curPosOf[r.id],fPos:fcPosOf[r.id]};
  });
  const divS=txDivShort(ref.div);
  const sexLabel=(ref.sex==='Femenino'||ref.sex==='Mujer'||ref.sex==='F')?'Mujer':'Hombre';
  const curRow=ranked.find(a=>a.id===ref.id);
  const curPos=curRow?curRow.curPos:0;
  const fcPos=curRow?curRow.fPos:0;
  const arrow=curPos===fcPos?'=':(fcPos<curPos?'▲':'▼');
  const arrowColor=fcPos<curPos?'#22c55e':(fcPos>curPos?'#ef4444':'#D4A843');
  const pendingW=((ref.att==null?void 0:(__o=>__o==null?void 0:(__o=>__o==null?void 0:__o.w)(__o[DATA.round]))(ref.att[DATA.lift])))||0;
  const liftN=LIFT_N[DATA.lift]||DATA.lift;
  return `
    <div style="position:fixed;bottom:30px;right:30px;width:min(520px,38vw);z-index:50;font-family:'Inter',sans-serif">
      <div class="ta-card-explode" style="background:linear-gradient(180deg,rgba(10,22,40,.96) 0%,rgba(4,12,26,.96) 100%);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:2px solid #D4A843;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.7),0 0 30px rgba(212,168,67,.25)">
        <!-- Header -->
        <div data-ta-header style="padding:14px 20px;background:linear-gradient(90deg,#C41E3A 0%,#8B1525 100%);display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:2px solid #D4A843;overflow:hidden">
          <div style="display:flex;align-items:center;gap:16px;flex:1;min-width:0">
            ${(()=>{const t=_tiraLogos(['camp'],'92px','12px');
              return t?`<div class="ta-logo-anim" style="flex-shrink:0">${t}</div>`:'';})()}
            <div data-ta-title style="min-width:0">
              <div style="font-family:Oswald;font-size:10px;letter-spacing:3px;color:rgba(255,255,255,.75);font-weight:600">TABLA ACTUAL · ${liftN} · R${(DATA.round||0)+1}</div>
              <div style="font-family:Oswald;font-size:18px;letter-spacing:1.5px;color:#fff;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,.4);margin-top:2px">${divS} • ${ref.cat} ${sexLabel==='Mujer'?'F':'M'} <span style="font-size:.72em;opacity:.8">· ${_lineaLbl(ref)}</span></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:Oswald;font-size:9px;letter-spacing:2px;color:rgba(255,255,255,.65)">PROYECCIÓN</div>
            <div style="font-family:Oswald;font-size:24px;font-weight:700;color:#fff;letter-spacing:1px;line-height:1">
              <span style="color:rgba(255,255,255,.7)">${curPos||'—'}</span>
              <span style="color:${arrowColor};margin:0 6px;font-size:22px">${arrow}</span>
              <span style="color:#D4A843;text-shadow:0 0 12px rgba(212,168,67,.6)">${fcPos||'—'}</span>
            </div>
          </div>
        </div>
        <!-- Column header -->
        <div style="display:grid;grid-template-columns:30px 1fr 90px 70px;gap:14px;padding:6px 18px;background:rgba(10,22,40,.7);font-family:Oswald;font-size:9px;letter-spacing:2px;color:rgba(220,230,245,.5);border-bottom:1px solid rgba(212,168,67,.15)">
          <div>#</div><div>NOMBRE</div><div style="text-align:right">TOTAL</div><div style="text-align:center">POS</div>
        </div>
        <!-- Rows -->
        <div>
        ${ranked.map((a,idx)=>{
          const isCur=a.id===ref.id;
          const rowBg=isCur?'background:linear-gradient(90deg,rgba(212,168,67,.32) 0%,rgba(212,168,67,.18) 100%);border-left:4px solid #D4A843':'background:'+(idx%2===0?'rgba(10,22,40,.4)':'transparent');
          const nameC=isCur?'#fff':'rgba(240,245,255,.85)';
          const fS=isCur?'15px':'13px';
          const fW=isCur?'700':'500';
          const totalShown=isCur?a.fTotal:a.total;
          const posShown=isCur?a.fPos:a.curPos;
          const posColor=isCur?'#D4A843':'rgba(220,230,245,.7)';
          const extra=isCur?'<div style="font-family:Oswald;font-size:9px;color:#D4A843;letter-spacing:2px;margin-top:2px;font-weight:600">EN TARIMA · '+(pendingW||'—')+' kg</div>':'';
          return `<div style="display:grid;grid-template-columns:30px 1fr 90px 70px;gap:14px;padding:${isCur?'14px 18px':'8px 18px'};${rowBg};border-bottom:1px solid rgba(212,168,67,.08);align-items:center">
            <div style="font-family:Oswald;font-size:${isCur?'18px':'13px'};font-weight:700;color:${isCur?'#D4A843':'rgba(220,230,245,.5)'};text-shadow:${isCur?'0 0 8px rgba(212,168,67,.5)':'none'}">${posShown}</div>
            <div style="overflow:hidden">
              <div style="font-family:Oswald;font-size:${fS};font-weight:${fW};color:${nameC};letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.5);display:flex;align-items:center">${_insignia(a,15)}<span style="overflow:hidden;text-overflow:ellipsis">${a.name}</span></div>
              ${extra}
            </div>
            <div style="font-family:Oswald;font-size:${isCur?'17px':'13px'};font-weight:${fW};text-align:right;color:${isCur?'#D4A843':'rgba(220,230,245,.75)'};text-shadow:${isCur?'0 0 8px rgba(212,168,67,.4)':'none'}">${(totalShown||0).toFixed(1)}</div>
            <div style="font-family:Oswald;font-size:${isCur?'18px':'13px'};font-weight:700;text-align:center;color:${posColor}">${isCur?(a.curPos+'→'+a.fPos):''}</div>
          </div>`;
        }).join('')}
        </div>
        <!-- Footer mini-strip -->
        <div style="padding:6px 18px;background:rgba(10,22,40,.7);font-family:Oswald;font-size:9px;letter-spacing:2px;color:rgba(220,230,245,.5);text-align:center;border-top:1px solid rgba(212,168,67,.15)">YOURLIFT · LIVE</div>
      </div>
    </div>`;
}

function _medalValor(a,tipo){
  return (tipo==='sq'||tipo==='bp'||tipo==='dl') ? bestOf(a,tipo) : totalOf(a);
}

function _medalTop3(md){
  md=md||{};
  if(!md.mod||!md.sex||!md.div||!md.cat)return [];
  const tipo=md.tipo||'total';
  const pool=DATA.athletes.filter(a=>a.mod===md.mod&&a.sex===md.sex&&a.div===md.div&&a.cat===md.cat&&!isDQ(a)&&!a.__is4);
  return pool.map(a=>({a,valor:_medalValor(a,tipo)}))
    .filter(x=>x.valor>0)
    .sort((x,y)=>
      (y.valor-x.valor) ||                                  // más kilos primero
      ((x.a.bw||0)-(y.a.bw||0)) ||                          // a igual marca, el más liviano
      ((x.a.lot||9999)-(y.a.lot||9999)))                    // y si también empatan, el lote menor
    .slice(0,3);
}

function renderTxMedals(md){
  md=md||{};
  if(!md.mod||!md.sex||!md.div||!md.cat)return '';
  const tipo=md.tipo||'total';
  const ranked=_medalTop3(md);
  if(!ranked.length)return '';
  const divS=txDivShort(md.div);
  const sexLabel=(md.sex==='Femenino'||md.sex==='Mujer'||md.sex==='F')?'F':'M';
  const RANK_BG={1:'#D4A843',2:'#C0C0C0',3:'#CD7F32'};
  const row=(r,x)=>{
    if(!x)return '';
    const big=r===1;
    // La bandera va entre el nombre y el total: en un sudamericano es lo que se
    // busca de un vistazo, y ahí no compite con el número de puesto.
    const flag=_variosPaises()?_flagImg(_ctry(x.a),big?26:22):_logoClub(x.a,big?34:28,'margin-right:0;');
    // El fondo sale de la paleta elegida en Control TX, como el resto de las
    // pantallas. El ORO, la PLATA y el BRONCE no: son el color de la medalla y
    // no cambian por tema — un primer lugar plateado no se entiende.
    return `<div style="display:flex;align-items:center;gap:12px;background:linear-gradient(90deg,${_txC('cardBg')},${_txC('headerBg')});border-left:6px solid ${RANK_BG[r]};border-radius:8px;padding:${big?'12px 20px':'9px 18px'};box-shadow:0 8px 20px rgba(0,0,0,.5)">
      <div style="width:${big?'40px':'32px'};height:${big?'40px':'32px'};flex-shrink:0;border-radius:50%;background:${RANK_BG[r]};display:flex;align-items:center;justify-content:center;font-family:Oswald;font-weight:800;font-size:${big?'20px':'16px'};color:#0A1628">${r}</div>
      <div style="flex:1;font-family:Oswald;font-weight:700;font-size:${big?'24px':'18px'};color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.5)">${x.a.name||''}</div>
      ${flag}
      <div style="font-family:Oswald;font-weight:800;font-size:${big?'24px':'18px'};color:${RANK_BG[r]}">${x.valor.toFixed(1)}</div>
    </div>`;
  };
  return `
    <div style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);width:min(760px,60vw);pointer-events:none">
      <div style="text-align:center;margin-bottom:10px;font-family:Oswald;font-size:14px;letter-spacing:3px;color:${_txC('accent')};text-shadow:0 2px 6px rgba(0,0,0,.6)">MEDALLERO ${MEDAL_TIPOS[tipo]||'TOTAL'} · ${divS} ${txCatLabel(md.cat)||md.cat} ${sexLabel} · ${_txModLabel(md.mod)}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${row(1,ranked[0])}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>${row(2,ranked[1])}</div>
          <div>${row(3,ranked[2])}</div>
        </div>
      </div>
    </div>`;
}

function _txModLabel(mod){
  return {classic:'Classic',equipped:'Equipado',oe_classic:'Olimpiadas Especiales',universitario:'Universitario',onlybench:'Only Bench',classic_bench:'Classic + Bench',equipped_bench:'Equipado + Bench'}[mod]||mod||'';
}

// ══════════════════════════════════════════════
// TX: BARBELL WIDGET
// ══════════════════════════════════════════════
function renderTxBarbell(cur,lifterChanged){
  if(!cur)return'';
  const att=cur.att[DATA.lift][DATA.round];
  const weight=(att==null?void 0:att.w)||0;
  if(!weight)return'';
  const isMale=cur.sex==='Hombre'||cur.sex==='M'||cur.sex==='Masculino';
  const barKg=20; // barra de 20kg para todos (según la foto de referencia de LiftingCast, incluso en Women's)
  const collarsKg=5; // 2 collares × 2.5kg — se muestran aparte de los discos, pero SÍ pesan
  const barW=barKg+collarsKg; // 25kg fijo antes de los discos
  const sideKg=Math.max(0,(weight-barW)/2);
  const plates=_discosPorLado(sideKg);
  // Visual props per plate weight. Anchos a la mitad: los discos calibrados de
  // powerlifting son finos, y con el canto grueso la barra parecía cargada con
  // bumpers de halterofilia.
  function pp(kg){
    if(kg>=25) return{h:88,w:12,fill:'#B91C1C',stroke:'#7F1D1D'};
    if(kg>=20) return{h:80,w:11,fill:'#1E40AF',stroke:'#1E3A8A'};
    if(kg>=15) return{h:72,w:10,fill:'#EFCB10',stroke:'#7A6300'};
    if(kg>=10) return{h:62,w:9, fill:'#15803D',stroke:'#14532D'};
    if(kg>=5)  return{h:50,w:8, fill:'#D1D5DB',stroke:'#9CA3AF'};
    if(kg>=2.5)return{h:38,w:7, fill:'#EF4444',stroke:'#991B1B'};
    if(kg>=1.25)return{h:28,w:6, fill:'#9CA3AF',stroke:'#6B7280'};
    if(kg>=0.75)return{h:22,w:5, fill:'#9CA3AF',stroke:'#6B7280'};
    if(kg>=0.5) return{h:20,w:5, fill:'#6B7280',stroke:'#374151'};
                return{h:16,w:4, fill:'#4B5563',stroke:'#1F2937'};
  }
  // Position forecast
  const peers=DATA.athletes.filter(a=>a.sex===cur.sex&&a.cat===cur.cat&&a.div===cur.div&&a.mod===cur.mod);
  const curGL=calcGL(totalOf(cur),cur.bw,cur.sex,_glMod(cur));
  const hypBest=Math.max(bestOf(cur,DATA.lift),weight);
  const sqH=DATA.lift==='sq'?hypBest:bestOf(cur,'sq');
  const bpH=DATA.lift==='bp'?hypBest:bestOf(cur,'bp');
  const dlH=DATA.lift==='dl'?hypBest:bestOf(cur,'dl');
  const hypTotal=(sqH&&bpH&&dlH)?sqH+bpH+dlH:0;
  const hypGL=hypTotal>0?calcGL(hypTotal,cur.bw,cur.sex,_glMod(cur)):0;
  const othersGL=peers.filter(a=>a.id!==cur.id).map(a=>calcGL(totalOf(a),a.bw,a.sex,_glMod(a))).filter(g=>g>0).sort((a,b)=>b-a);
  const curRank=curGL>0?othersGL.filter(g=>g>curGL).length+1:null;
  const newRank=hypGL>0?othersGL.filter(g=>g>hypGL).length+1:null;
  let posHtml='';
  if(newRank!==null){
    const pc=newRank===1?'#22c55e':newRank<=3?'#D4A843':'#8A9BB2';
    if(curRank!==null&&curRank!==newRank)posHtml=`<div style="font-family:Oswald;font-size:17px;letter-spacing:1px;color:${pc};text-align:right">Si es válido pasará del <b>${curRank}°</b> al <b style="font-size:22px">${newRank}° lugar</b></div>`;
    else if(curRank!==null)posHtml=`<div style="font-family:Oswald;font-size:17px;letter-spacing:1px;color:${pc};text-align:right">Mantiene el <b style="font-size:22px">${newRank}° lugar</b> si es válido</div>`;
    else posHtml=`<div style="font-family:Oswald;font-size:17px;letter-spacing:1px;color:${pc};text-align:right">Si es válido: <b style="font-size:22px">${newRank}° lugar</b></div>`;
  }
  const liftName={sq:'SENTADILLA',bp:'PRESS DE BANCA',dl:'PESO MUERTO'}[DATA.lift]||DATA.lift.toUpperCase();
  const roundLabel=['1er INTENTO','2do INTENTO','3er INTENTO'][DATA.round]||`INTENTO ${DATA.round+1}`;
  const weightLbs=(weight*2.20462).toFixed(1);
  // SVG barbell (1920×140)
  const VW=1920,VH=140,cy=VH/2;
  const shaftHalf=120,shaftCX=VW/2,shaftThick=10,sleeveThick=16,collarH=30,collarW=18;
  const barL=40,barR=VW-40;
  const rightColX=shaftCX+shaftHalf;
  const leftColX=shaftCX-shaftHalf-collarW;
  let s=[];
  // Sleeves
  // Las mangas llegan hasta el eje: ahí ya no hay collar, solo el tope fijo.
  s.push(`<rect x="${barL+8}" y="${cy-sleeveThick/2}" width="${leftColX+collarW-barL-8}" height="${sleeveThick}" fill="#71717A" rx="2"/>`);
  s.push(`<rect x="${rightColX}" y="${cy-sleeveThick/2}" width="${barR-8-rightColX}" height="${sleeveThick}" fill="#71717A" rx="2"/>`);
  // Central shaft
  s.push(`<rect x="${shaftCX-shaftHalf}" y="${cy-shaftThick/2}" width="${shaftHalf*2}" height="${shaftThick}" fill="#D4D4D8" rx="2"/>`);
  // Knurling
  for(let xi=shaftCX-shaftHalf+12;xi<shaftCX+shaftHalf-8;xi+=13)s.push(`<line x1="${xi}" y1="${cy-shaftThick/2-1}" x2="${xi}" y2="${cy+shaftThick/2+1}" stroke="#A1A1AA" stroke-width="1.5" opacity="0.5"/>`);
  // End caps
  s.push(`<rect x="${barL}" y="${cy-collarH/2}" width="10" height="${collarH}" fill="#27272A" rx="2"/>`);
  s.push(`<rect x="${barR-10}" y="${cy-collarH/2}" width="10" height="${collarH}" fill="#27272A" rx="2"/>`);
  // Topes fijos de las mangas, pegados al eje. Los collares van al final, por
  // fuera del último disco (se dibujan después de los discos).
  s.push(`<rect x="${leftColX+collarW-6}" y="${cy-collarH/2+4}" width="6" height="${collarH-8}" fill="#3F3F46" rx="2"/>`);
  s.push(`<rect x="${rightColX}" y="${cy-collarH/2+4}" width="6" height="${collarH-8}" fill="#3F3F46" rx="2"/>`);
  // Plates
  let rxR=rightColX+8,rxL=leftColX+collarW-8;
  plates.forEach(kg=>{
    const p=pp(kg);const py=cy-p.h/2;
    s.push(`<rect x="${rxR}" y="${py}" width="${p.w}" height="${p.h}" fill="${p.fill}" rx="2" stroke="${p.stroke}" stroke-width="1.5"/>`);
    const brillo=Math.max(1.5,p.w*0.22);
    s.push(`<rect x="${rxR+1}" y="${py+2}" width="${brillo}" height="${p.h-4}" fill="rgba(255,255,255,0.2)" rx="1"/>`);
    s.push(`<rect x="${rxL-p.w}" y="${py}" width="${p.w}" height="${p.h}" fill="${p.fill}" rx="2" stroke="${p.stroke}" stroke-width="1.5"/>`);
    // El brillo va del lado de adentro (hacia la barra) en los dos lados, para que
    // la carga se vea simétrica. El disco izquierdo ocupa [rxL-p.w, rxL].
    s.push(`<rect x="${rxL-brillo-1}" y="${py+2}" width="${brillo}" height="${p.h-4}" fill="rgba(255,255,255,0.2)" rx="1"/>`);
    rxR+=p.w+1;rxL-=p.w+1;
  });
  // Collars, por fuera del disco más chico de cada lado.
  s.push(`<rect x="${rxR+1}" y="${cy-collarH/2}" width="${collarW}" height="${collarH}" fill="#52525B" rx="2"/>`);
  s.push(`<rect x="${rxL-1-collarW}" y="${cy-collarH/2}" width="${collarW}" height="${collarH}" fill="#52525B" rx="2"/>`);
  const bbSvg=`<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:${VH}px;display:block">${s.join('')}</svg>`;
  const anim=lifterChanged?'animation:txSlideInBottom .7s cubic-bezier(.2,.8,.2,1) both':'';
  const rackH=DATA.lift==='sq'?cur.rackSQ:DATA.lift==='bp'?cur.rackBP:'';
  const sexLbl=isMale?'HOMBRES':'MUJERES';
  return`<div style="position:fixed;bottom:0;left:0;right:0;${anim};background:linear-gradient(180deg,rgba(10,22,40,0) 0%,rgba(10,22,40,.9) 16%,rgba(10,22,40,.97) 38%,rgba(10,22,40,1) 100%);padding:22px 70px 28px">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
      <div style="font-family:Oswald;font-size:15px;letter-spacing:3px;color:rgba(212,225,245,.5)">${liftName} <span style="opacity:.7">·</span> ${roundLabel}${rackH?` <span style="opacity:.7">·</span> RACK ${rackH}`:''}</div>
      <div style="font-family:Oswald;font-size:44px;font-weight:700;color:#fff;line-height:1;letter-spacing:1px">${weight}<span style="font-size:22px;color:rgba(212,225,245,.55);margin-left:6px">KG</span><span style="font-size:16px;color:rgba(212,225,245,.3);margin-left:14px">/ ${weightLbs} LBS</span></div>
    </div>
    <div>${bbSvg}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
      <div>
        <div style="font-family:Oswald;font-size:34px;font-weight:700;letter-spacing:1px;color:#fff;line-height:1">${cur.name||''}</div>
        <div style="font-family:Oswald;font-size:12px;letter-spacing:2.5px;color:rgba(212,225,245,.45);margin-top:5px">${[sexLbl,cur.club,cur.cat,cur.div,_modTarima(cur)].filter(Boolean).map(x=>(x+'').toUpperCase()).join(' · ')}</div>
      </div>
      ${posHtml}
    </div>
  </div>`;
}

 // últimos eventos recibidos para debug (max 10)
async function obsWsConnect(){
  if(!window.OBSWebSocket){_obsWsError='Librería obs-websocket-js no cargó (revisa la conexión a internet)';if(DATA.phase==='director')R();return}
  if(_obsWs){try{await _obsWs.disconnect()}catch(e){}_obsWs=null}
  _obsWsError='';
  _obsWs=new window.OBSWebSocket();
  try{
    const url='ws://'+(_obsWsSettings.host||'localhost')+':'+(_obsWsSettings.port||4455);
    await _obsWs.connect(url,_obsWsSettings.password||'');
    _obsWsConnected=true;
    _obsWs.on('CustomEvent',(d)=>{
      _obsWsLog.unshift({ts:Date.now(),data:d});
      if(_obsWsLog.length>10)_obsWsLog.pop();
      handleObsCustomEvent(d);
      // competitionSync se rebota cada 5s desde nosotros mismos → no re-renderizar el panel
      if(DATA.phase==='director'&&d.action!=='competitionSync')R();
    });
    _obsWs.on('ConnectionClosed',()=>{
      _obsWsConnected=false;
      if(_obsWsSyncInterval){clearInterval(_obsWsSyncInterval);_obsWsSyncInterval=null;}
      if(DATA.phase==='director')R();
    });
    // Sync periódico: manda athletes+estado cada 5s para que el widget OBS siempre tenga datos
    if(_obsWsSyncInterval)clearInterval(_obsWsSyncInterval);
    _obsWsSyncInterval=setInterval(_obsWsBroadcastSync,5000);
    _obsWsBroadcastSync(); // sync inmediato al conectar
    if(DATA.phase==='director')R();
  }catch(e){
    _obsWsError=e.message||String(e);
    _obsWs=null;_obsWsConnected=false;
    if(DATA.phase==='director')R();
  }
}

async function obsWsDisconnect(){
  if(_obsWs){try{await _obsWs.disconnect()}catch(e){}_obsWs=null}
  _obsWsConnected=false;
  if(DATA.phase==='director')R();
}

function handleObsCustomEvent(data){
  if(!data)return;
  const action=data.action||'';
  if(action==='toggle'){
    if(data.component==='leaderboard')return window.dirToggleLb();
    if(data.component==='breakTimer')return window.dirToggleBreak();
    if(data.component)return window.dirToggle(data.component);
  }
  if(action==='slam'&&data.type)return window.dirShowSlam(data.type);
  if(action==='hideAll')return window.dirHideAll();
  if(action==='breakStart')return window.dirBreakStart();
  if(action==='breakStop')return window.dirBreakHide();
  if(action==='breakAdd'&&typeof data.seconds==='number')return window.dirBreakAdd(data.seconds);
  if(action==='showLb'&&data.cat)return window.dirShowLb(data.cat,0);
}

async function _dirLoadBtVideos(){
  if(!window._fbSt||!window._fbStInst){alert('Storage no disponible todavía, espera un momento');return;}
  try{
    const {ref,listAll,getDownloadURL}=window._fbSt;
    const r=ref(window._fbStInst,'videos/break');
    const res=await listAll(r);
    const items=await Promise.all(res.items.map(item=>getDownloadURL(item).then(url=>({name:item.name,url}))));
    _dirBtVideoList=items.sort((a,b)=>a.name.localeCompare(b.name));
    R();
  }catch(e){console.error('listAll error',e);alert('Error listando videos: '+e.message);}
}

function _dirEnsureListener(){
  if(!fbReady||!window._fb)return;
  const docId=evStateDocId('current');
  // Re-suscribir si el doc cambió (ej. el evento se resolvió DESPUÉS de la 1ª
  // suscripción → antes escuchábamos 'current' y ahora 'current__<Evento>').
  if(_dirUnsub && _dirUnsubDocId===docId)return;
  if(_dirUnsub){try{_dirUnsub()}catch(e){}_dirUnsub=null;}
  _dirUnsubDocId=docId;
  try{
    _dirUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'livecast_director',docId),(snap)=>{
      const DEFAULT={profile:{active:false,until:0,scale:1},scoreboard:{active:false,until:0,scale:1},leaderboard:{active:false,until:0,cat:'',scale:1},timer:{active:false,until:0,scale:1},slam:{active:false,until:0,type:'g',scale:1},medals:{active:false,until:0,mod:'',sex:'',div:'',cat:'',tipo:'total',scale:1},breakTimer:{active:false,startedAt:0,durationSec:0,label:'',pausedAt:0,scale:1,videos:[]}};
      if(snap.exists()){
        const d=snap.data();
        _dirState=Object.assign({},DEFAULT,d.show||{});
      } else {
        _dirState={...DEFAULT};
      }
      if(DATA.phase==='director'||DATA.phase==='remote')R();
    });
  }catch(e){console.warn('[DIR] listen',e)}
}

async function _dirPush(){
  // Feedback claro en vez de no-op silencioso (era la causa de "aprieto y no pasa nada").
  if(!fbReady||!window._fb){showToastLC('Conectando a Firebase… espera unos segundos y vuelve a intentar');return;}
  if(!isAdmin){showToastLC('Solo un admin logueado puede controlar la transmisión');return;}
  if(!fbDocId()){showToastLC('Cargando el evento… espera a que el campeonato aparezca arriba y vuelve a intentar');if(DATA.phase==='remote'||DATA.phase==='director')R();return;}
  try{
    await window._fb.setDoc(window._fb.doc(fbDB,'livecast_director',evStateDocId('current')),{show:_dirState,ts:Date.now()});
  }catch(e){showToastLC('Error al enviar comando: '+(e.message||e))}
  _obsWsBroadcastSync();
}

function _obsWsBroadcastSync(){
  if(!_obsWsConnected||!_obsWs)return;
  try{
    _obsWs.call('BroadcastCustomEvent',{eventData:{
      action:'competitionSync',
      lift:DATA.lift, round:DATA.round, flight:DATA.flight,
      athletes:DATA.athletes,
      event:DATA.event
    }});
  }catch(e){}
}

function renderDirector(){
  // Escaper local (independiente del helper global por si el browser cachea la vieja versión)
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  _dirEnsureListener();
  if(!_dirState){_dirState={profile:{active:false,until:0},scoreboard:{active:false,until:0},leaderboard:{active:false,until:0,cat:''},timer:{active:false,until:0},slam:{active:false,until:0,type:'g'}};}
  const cur=liftQueue()[0];
  const cats=[...new Set(DATA.athletes.filter(a=>!a.bombed).map(a=>a.cat))].filter(Boolean).sort((a,b)=>(parseFloat(a)||999)-(parseFloat(b)||999));
  const fmtTime=t=>{if(!t||t<=Date.now())return '';const s=Math.ceil((t-Date.now())/1000);return s+'s restantes'};
  const _wsParam=_obsWsConnected&&(_obsWsSettings==null?void 0:_obsWsSettings.host)
    ?'&obsWs='+encodeURIComponent(_obsWsSettings.host+':'+(_obsWsSettings.port||4455))
      +(_obsWsSettings.password?'&obsPwd='+encodeURIComponent(_obsWsSettings.password):'')
    :'';
  const widgetUrl=location.origin+location.pathname.replace(/[^/]+$/,'')+'livecast.html?tx=director&evento='+encodeURIComponent((DATA.event==null?void 0:DATA.event.id)||(DATA.event==null?void 0:DATA.event.name)||'')+(TARIMA?'&tarima='+TARIMA:'')+_wsParam;
  const kbd=(k)=>'<kbd style="display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 10px;background:#0a1628;border:2px solid #D4A843;border-radius:6px;font-family:Oswald;font-size:16px;font-weight:700;color:#D4A843;letter-spacing:1px;box-shadow:0 2px 0 #D4A84355">'+k+'</kbd>';
  const scaleSlider=(key)=>{
    const c=_dirState[key]||{};
    const sc=c.scale||1;
    return '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      +'<span style="font-size:10px;color:var(--muted);letter-spacing:1px;font-family:Oswald;min-width:60px">TAMAÑO</span>'
      +'<input type="range" min="0.5" max="2.0" step="0.05" value="'+sc+'" oninput="dirSetScale(\''+key+'\',this.value);this.nextElementSibling.textContent=parseFloat(this.value).toFixed(2)+\'x\'" style="flex:1;min-width:140px;cursor:pointer;accent-color:var(--gold)">'
      +'<span style="font-family:Oswald;font-size:13px;color:var(--gold);font-weight:700;min-width:48px;text-align:right">'+sc.toFixed(2)+'x</span>'
      +'<button onclick="dirResetScale(\''+key+'\')" title="Reset a 1.00x" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:10px;cursor:pointer;font-family:Oswald;letter-spacing:1px">RESET</button>'
      +'</div>';
  };
  const compToggle=(key,icon,title,desc,shortcut,onClick)=>{
    const c=_dirState[key]||{};
    const isOn=c.active&&(!c.until||c.until>Date.now());
    return '<div class="card" style="padding:14px 18px;border-left:4px solid '+(isOn?'var(--green)':'var(--border)')+';background:'+(isOn?'rgba(34,197,94,.04)':'transparent')+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:200px">'
        +'<div style="display:flex;align-items:center;gap:10px"><div style="font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:1px">'+(icon?icon+' ':'')+title+'</div>'+kbd(shortcut)+'</div>'
        +'<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5">'+desc+'</div>'
        +(isOn?'<div style="font-size:10px;color:var(--green);margin-top:4px;font-family:Oswald;letter-spacing:1px">EN PANTALLA</div>':'')
      +'</div>'
      +'<button class="btn '+(isOn?'btn-r':'btn-g')+'" onclick="'+onClick+'" style="padding:14px 28px;font-size:14px;font-family:Oswald;font-weight:700;letter-spacing:2px;min-width:160px">'+(isOn?'<i class=yl-i-pausa></i> DESACTIVAR':'<i class=yl-i-reproducir></i> ACTIVAR')+'</button>'
      +'</div>'
      +scaleSlider(key)
      +'</div>';
  };
  let h='<div class="fade">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;flex-wrap:wrap;gap:12px">';
  h+='<div><h2 class="os" style="font-size:22px;letter-spacing:1px">CONTROL DE TRANSMISIÓN</h2><p style="color:var(--muted);font-size:12px">Toggle on/off por componente. Compatible con Stream Deck — cada acción tiene una tecla asignada.</p></div>';
  h+='<div style="display:flex;gap:6px;align-items:center"><button class="btn btn-r" onclick="dirHideAll()" style="padding:12px 20px;font-size:13px;font-family:Oswald;font-weight:700;letter-spacing:2px">ESCONDER TODO</button>'
    +'<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><kbd style="display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:28px;padding:0 8px;background:#0a1628;border:2px solid #ef4444;border-radius:6px;font-family:Oswald;font-size:14px;font-weight:700;color:#ef4444;letter-spacing:1px">0</kbd><span style="font-size:9px;color:var(--muted)">o ESC</span></div></div>';
  h+='</div>';
  // OBS WebSocket card — status + settings
  const wsStatus=_obsWsConnected?{c:'var(--green)',label:'CONECTADO',icon:''}:(_obsWsError?{c:'var(--red)',label:'ERROR',icon:''}:{c:'var(--muted)',label:'DESCONECTADO',icon:''});
  h+='<div class="card" style="margin-bottom:14px;padding:14px 18px;border-color:'+wsStatus.c+';background:rgba(34,197,94,'+(_obsWsConnected?'.06':'.0')+')">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">';
  h+='<div><div style="font-family:Oswald;font-size:11px;color:var(--gold);letter-spacing:2px">OBS WEBSOCKET (STREAM DECK)</div>';
  h+='<div style="font-size:13px;font-family:Oswald;margin-top:2px;color:'+wsStatus.c+'">'+wsStatus.icon+' '+wsStatus.label+(_obsWsError?' · <span style="color:var(--muted);font-size:11px">'+esc(_obsWsError)+'</span>':'')+'</div></div>';
  h+='<button class="btn '+(_obsWsConnected?'btn-r':'btn-g')+'" onclick="obsWsToggleConnection()" style="padding:8px 16px;font-size:12px">'+(_obsWsConnected?'Desconectar':'<i class=yl-i-reproducir></i> Conectar')+'</button>';
  h+='</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 90px 1fr auto;gap:8px;align-items:end;font-size:11px">';
  h+='<div><label style="color:var(--muted);display:block;margin-bottom:3px">Host</label><input id="obsWsHost" value="'+esc(_obsWsSettings.host||'localhost')+'" style="width:100%;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px"></div>';
  h+='<div><label style="color:var(--muted);display:block;margin-bottom:3px">Puerto</label><input id="obsWsPort" type="number" value="'+(_obsWsSettings.port||4455)+'" style="width:100%;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px"></div>';
  h+='<div><label style="color:var(--muted);display:block;margin-bottom:3px">Password</label><input id="obsWsPass" type="password" value="'+esc(_obsWsSettings.password||'')+'" placeholder="(opcional)" style="width:100%;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px"></div>';
  h+='<button class="btn btn-o" onclick="obsWsSaveAndConnect()" style="padding:6px 14px;font-size:11px">Guardar y conectar</button>';
  h+='</div>';
  h+='<div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap">';
  h+='<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);cursor:pointer"><input id="obsWsAuto" type="checkbox" '+(_obsWsSettings.autoConnect?'checked':'')+'> Conectar automáticamente al abrir el panel</label>';
  if(_obsWsConnected){
    h+='<button class="btn" onclick="obsWsTestEvent()" style="padding:6px 14px;font-size:11px;background:transparent;border:1px solid var(--gold);color:var(--gold)">Probar evento (toggle perfil)</button>';
  }
  h+='</div>';
  // Log de eventos recibidos (debug)
  if(_obsWsLog.length){
    h+='<details style="margin-top:10px"><summary style="cursor:pointer;font-size:11px;color:var(--muted)">Últimos eventos recibidos ('+_obsWsLog.length+')</summary>';
    h+='<div style="margin-top:6px;max-height:120px;overflow-y:auto;font-family:monospace;font-size:10px;background:rgba(10,22,40,.6);padding:8px;border-radius:6px">';
    _obsWsLog.forEach(e=>{const t=new Date(e.ts).toLocaleTimeString();h+='<div style="padding:2px 0">['+t+'] '+esc(JSON.stringify(e.data))+'</div>'});
    h+='</div></details>';
  }
  // Setup help
  h+='<details style="margin-top:10px"><summary style="cursor:pointer;font-size:11px;color:var(--gold);font-family:Oswald;letter-spacing:1px">CÓMO CONFIGURAR (CLICK PARA EXPANDIR)</summary>';
  h+='<div style="margin-top:8px;font-size:11px;line-height:1.7;color:var(--muted)">';
  h+='<b style="color:var(--text)">1. Habilitar WebSocket en OBS</b> (una sola vez):<br>OBS → menú <code>Tools → WebSocket Server Settings</code> → activa <b>Enable WebSocket Server</b> → pon un password → Apply.<br><br>';
  h+='<b style="color:var(--text)">2. Pega host (<code>localhost</code> si OBS corre en la misma PC), puerto y password arriba</b> → click "Guardar y conectar". Debería ponerse CONECTADO.<br><br>';
  h+='<b style="color:var(--text)">3. Configurar Stream Deck</b> (Elgato Stream Deck app):<br>';
  h+='• Si tienes el plugin <i>"OBS Studio"</i> instalado: agrega un botón con acción <code>OBS Studio → Send Custom Event</code>.<br>';
  h+='• Event name: <code>tx</code> (cualquiera, lo importante es el JSON del payload).<br>';
  h+='• Event data (JSON): según qué quieras hacer, mira la tabla abajo.<br><br>';
  h+='<b style="color:var(--text)">Payloads JSON aceptados:</b>';
  h+='<div style="margin-top:6px;background:rgba(10,22,40,.6);padding:10px;border-radius:6px;font-family:monospace;font-size:10px;color:rgba(200,215,240,.85)">';
  h+='<div>{"action":"toggle","component":"profile"}</div>';
  h+='<div>{"action":"toggle","component":"scoreboard"}</div>';
  h+='<div>{"action":"toggle","component":"leaderboard"}</div>';
  h+='<div>{"action":"toggle","component":"timer"}</div>';
  h+='<div>{"action":"toggle","component":"breakTimer"}</div>';
  h+='<div>{"action":"toggle","component":"slam"}     ← arma SLAM (GOOD/NO LIFT automático al marcar válido o nulo)</div>';
  h+='<div>{"action":"slam","type":"g"}        ← GOOD LIFT manual (legacy)</div>';
  h+='<div>{"action":"slam","type":"n"}        ← NO LIFT manual (legacy)</div>';
  h+='<div>{"action":"showLb","cat":"-83 kg (Hombre)"}  ← cat específica</div>';
  h+='<div>{"action":"hideAll"}</div>';
  h+='<div>{"action":"breakStart"}             ← arranca con valores actuales</div>';
  h+='<div>{"action":"breakStop"}</div>';
  h+='<div>{"action":"breakAdd","seconds":60} ← +1 min</div>';
  h+='</div>';
  h+='<br><b style="color:var(--orange,#f59e0b)">Nota:</b> esto reemplaza los hotkeys. Una vez conectado a OBS WS, no hace falta tener el panel en foco — los eventos llegan por WebSocket.';
  h+='</div></details>';
  h+='</div>';

  // Setup widget URL card
  h+='<div class="card" style="margin-bottom:14px;padding:12px 16px;background:rgba(212,168,67,.06);border-color:rgba(212,168,67,.3)">';
  h+='<div style="font-family:Oswald;font-size:11px;color:var(--gold);letter-spacing:2px;margin-bottom:6px">URL DEL WIDGET PARA OBS (UNA SOLA VEZ)</div>';
  h+='<div style="font-size:12px;color:var(--muted);line-height:1.6">En OBS: Sources → + → Browser → pega esta URL → 1920×1080 → DESMARCAR "Refresh on activate" y "Shutdown when not visible".</div>';
  h+='<div style="display:flex;gap:8px;align-items:center;margin-top:8px"><code style="flex:1;background:rgba(10,22,40,.6);padding:8px 12px;border-radius:6px;font-size:10px;color:rgba(200,215,240,.8);word-break:break-all">'+widgetUrl+'</code>';
  h+='<button class="btn btn-g" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent=\'Copiado\';setTimeout(()=>this.textContent=\'Copiar\',1500)})" style="padding:7px 14px;font-size:11px;flex-shrink:0">Copiar</button></div>';
  h+='</div>';
  // Status del lifter actual
  if(cur){
    h+='<div class="card" style="margin-bottom:14px;padding:10px 14px;background:rgba(34,197,94,.05);border-color:rgba(34,197,94,.3);font-size:12px">';
    h+='<b>Levantador actual:</b> <span style="color:var(--gold);font-family:Oswald">'+cur.name+'</span> · '+cur.cat+' · '+cur.div+' · Vuelo '+cur.flight+' · '+LIFT_S[DATA.lift]+(DATA.round+1);
    h+='</div>';
  }
  // ── Logo del campeonato (se muestra en perfil/scoreboard/tabla actual)
  {
    const champLogo=(DATA.event==null?void 0:DATA.event.logoUrl)||'';
    h+='<div class="card" style="padding:14px 18px;border-left:4px solid var(--gold);background:rgba(212,168,67,.06);margin-bottom:12px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">';
    h+='<div style="flex:1;min-width:200px;display:flex;align-items:center;gap:14px">';
    h+='<div style="width:64px;height:64px;background:rgba(10,22,40,.5);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">'
      +(champLogo?'<img src="'+champLogo+'" style="max-width:100%;max-height:100%;object-fit:contain">':'<span style="font-size:9px;color:var(--muted);font-family:Oswald;letter-spacing:1px;text-align:center;line-height:1.2">SIN<br>LOGO</span>')
      +'</div>';
    h+='<div><div style="font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:1px">Logo del campeonato</div>';
    h+='<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5">Aparece en el Perfil, el Scoreboard y la Tabla Actual. Recomendado: PNG con fondo transparente, 512×512 o más.</div></div>';
    h+='</div>';
    h+='<div style="display:flex;gap:6px">';
    h+='<button id="dirChampLogoBtn" class="btn btn-o" onclick="dirUploadChampionshipLogo()" style="padding:10px 16px;font-size:12px;font-family:Oswald;letter-spacing:1.5px"><i class=yl-i-subir></i> '+(champLogo?'Cambiar logo':'Subir logo')+'</button>';
    if(champLogo) h+='<button class="btn" onclick="dirClearChampionshipLogo()" style="padding:10px 14px;font-size:12px;background:transparent;border:1px solid var(--red);color:var(--red);font-family:Oswald;letter-spacing:1.5px"><i class=yl-i-cerrar></i> Quitar</button>';
    h+='</div></div>';
    // Qué logo va en el barrido de transición. Por defecto el del campeonato:
    // el barrido es el único momento en que la pantalla es suya. El botón de
    // YourLift queda para un campeonato que prefiera esa marca.
    {
      const usaCamp=!(DATA.event&&DATA.event.barridoLogo==='yourlift');
      h+='<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(212,168,67,.25)">';
      h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:1px;color:var(--muted);margin-bottom:8px">LOGO EN EL BARRIDO DE TRANSICIÓN</div>';
      h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
      const bot=(val,txt,activo)=>'<button onclick="dirSetBarridoLogo(\''+val+'\')" style="padding:8px 16px;border-radius:8px;border:2px solid '
        +(activo?'var(--gold)':'var(--border)')+';background:'+(activo?'rgba(212,168,67,.15)':'transparent')+';color:'
        +(activo?'var(--gold)':'var(--muted)')+';font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer">'+txt+'</button>';
      h+=bot('yourlift','YOURLIFT',!usaCamp);
      h+=bot('campeonato','ESTE CAMPEONATO',usaCamp);
      h+='</div>';
      h+='<div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5">'
        +(usaCamp
          ? (champLogo?'En el barrido va el logo de este campeonato, a pantalla completa. Es lo que viene por defecto. Si no cargara, sale el de YourLift.'
                      :'<b style="color:var(--red)">No hay logo de campeonato subido</b>, así que en el barrido sale el de YourLift.')
          : 'Elegiste el logo de YourLift para el barrido. Por defecto va el del campeonato.')
        +' En el barrido se ve a pantalla completa: conviene un archivo grande.</div>';
      h+='</div>';
    }
    h+='</div>';
  }
  // Componentes — TOGGLES (1 botón / 1 tecla por componente, listo para Stream Deck)
  h+='<div style="display:grid;gap:12px">';
  h+=compToggle('profile','','Perfil del atleta','Pantalla completa con nombre, categoría, club, edad, PB del atleta actual.','P','dirToggle(\'profile\')');
  // Selector Foto / GIF
  const _isGif=_txProfileMediaType==='gif';
  h+='<div style="margin-top:-8px;margin-bottom:4px;padding:8px 18px;display:flex;align-items:center;gap:10px;background:rgba(10,22,40,.4);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;flex-wrap:wrap">';
  h+='<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px;flex-shrink:0">MEDIA EN PERFIL:</span>';
  h+='<button onclick="setTxProfileMedia(\'foto\')" style="padding:5px 16px;border-radius:6px;border:2px solid '+(!_isGif?'var(--gold)':'var(--border)')+';background:'+(!_isGif?'rgba(212,168,67,.15)':'transparent')+';color:'+(!_isGif?'var(--gold)':'var(--muted)')+';font-family:Oswald;font-size:11px;cursor:pointer;font-weight:700;letter-spacing:1px;transition:all .15s">FOTO</button>';
  h+='<button onclick="setTxProfileMedia(\'gif\')" style="padding:5px 16px;border-radius:6px;border:2px solid '+(_isGif?'#a78bfa':'var(--border)')+';background:'+(_isGif?'rgba(139,92,246,.15)':'transparent')+';color:'+(_isGif?'#a78bfa':'var(--muted)')+';font-family:Oswald;font-size:11px;cursor:pointer;font-weight:700;letter-spacing:1px;transition:all .15s">GIF</button>';
  if(_isGif){
    const _curFull=liftQueue()[0]?txLookupFull(liftQueue()[0]):null;
    if((_curFull==null?void 0:_curFull.gif_url)){
      h+='<span style="font-size:10px;color:#a78bfa;font-family:Oswald"><i class=yl-i-check></i> GIF disponible para este atleta</span>';
    } else {
      h+='<span style="font-size:10px;color:var(--red);font-family:Oswald">Sin GIF — se mostrará foto/iniciales</span>';
    }
  }
  h+='</div>';
  h+=compToggle('scoreboard','','Marcador (lower-third)','Barra inferior izquierda con nombre, categoría e intentos cargados.','S','dirToggle(\'scoreboard\')');
  // Leaderboard: selector de cat + toggle
  const curCat=(_dirState.leaderboard==null?void 0:_dirState.leaderboard.cat)||'';
  const lbActive=(_dirState.leaderboard==null?void 0:_dirState.leaderboard.active)&&(!(_dirState.leaderboard==null?void 0:_dirState.leaderboard.until)||_dirState.leaderboard.until>Date.now());
  h+='<div class="card" style="padding:14px 18px;border-left:4px solid '+(lbActive?'var(--green)':'var(--border)')+';background:'+(lbActive?'rgba(34,197,94,.04)':'transparent')+'">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">';
  h+='<div style="flex:1;min-width:200px">';
  h+='<div style="display:flex;align-items:center;gap:10px"><div style="font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:1px">Tabla de clasificación</div>'+kbd('L')+'</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5">Ranking de la categoría seleccionada abajo. Si "Auto", usa la del lifter actual.</div>';
  h+='<div style="margin-top:8px"><select id="dirLbCat" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;min-width:240px"><option value="">— Auto (cat del lifter actual) —</option>';
  cats.forEach(c=>{h+='<option value="'+c+'" '+(c===curCat?'selected':'')+'>'+c+'</option>'});
  h+='</select></div>';
  h+=(lbActive?'<div style="font-size:10px;color:var(--green);margin-top:6px;font-family:Oswald;letter-spacing:1px">EN PANTALLA</div>':'');
  h+='</div>';
  h+='<button class="btn '+(lbActive?'btn-r':'btn-g')+'" onclick="dirToggleLb()" style="padding:14px 28px;font-size:14px;font-family:Oswald;font-weight:700;letter-spacing:2px;min-width:160px">'+(lbActive?'<i class=yl-i-pausa></i> DESACTIVAR':'<i class=yl-i-reproducir></i> ACTIVAR')+'</button>';
  h+='</div>'+scaleSlider('leaderboard')+'</div>';
  h+=compToggle('luces','','Luces de jueces','Los tres círculos abajo a la izquierda, con el nombre del atleta y el intento. El tamaño se ajusta acá abajo. Se deja prendido toda la competencia: mientras no hay decisión no se ve nada, y aparece solo cuando los jueces marcan. Es un espejo — el válido o el nulo se sigue dando en Control en Vivo o en la planilla.','U','dirToggle(\'luces\')');
  h+=compToggle('jurado','','Decisión del jurado (esquina superior izquierda)','"JURY HAS OVERRULED · Decisión del jurado" con la luz blanca o roja y el color de la tarjeta debajo. Se deja prendido: no se ve nada hasta que el jurado revierte un intento desde el panel de jueces (posición JURY), y ahí aparece '+(JURADO_MS/1000)+' segundos.','','dirToggle(\'jurado\')');
  h+=compToggle('tablaActual','','Tabla actual (corner)','Ranking de la categoría del lifter actual, esquina inferior derecha. Entra desde abajo, queda fijo. El levantador en pantalla se resalta y muestra la flecha de proyección (pos actual → pos si lo levanta).','A','dirToggle(\'tablaActual\')');
  // Medallero (Top 3) — selects en cascada: modalidad → sexo → división → categoría.
  // Todo se calcula desde DATA.athletes (ya cargado local): cero lecturas nuevas a Firestore.
  {
    const mdActive=(_dirState.medals==null?void 0:_dirState.medals.active)&&(!(_dirState.medals==null?void 0:_dirState.medals.until)||_dirState.medals.until>Date.now());
    const MOD_LABEL={classic:'Classic',equipped:'Equipado',oe_classic:'Olimpiadas Especiales',universitario:'Universitario',onlybench:'Only Bench',classic_bench:'Classic + Bench',equipped_bench:'Equipado + Bench'};
    const sel=window._mdSel||{mod:'',sex:'',div:'',cat:'',tipo:'total'};
    const byMod=DATA.athletes.filter(a=>!sel.mod||a.mod===sel.mod);
    const modOpts=[...new Set(DATA.athletes.map(a=>a.mod))].filter(Boolean);
    const sexOpts=[...new Set(byMod.map(a=>a.sex))].filter(Boolean).sort();
    const byModSex=byMod.filter(a=>!sel.sex||a.sex===sel.sex);
    const divOpts=[...new Set(byModSex.map(a=>a.div))].filter(Boolean).sort();
    const byModSexDiv=byModSex.filter(a=>!sel.div||a.div===sel.div);
    const catOpts=[...new Set(byModSexDiv.map(a=>a.cat))].filter(Boolean).sort((a,b)=>(parseFloat(a)||999)-(parseFloat(b)||999));
    const selStyle='padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;min-width:170px';
    h+='<div class="card" style="padding:14px 18px;border-left:4px solid '+(mdActive?'var(--green)':'var(--border)')+';background:'+(mdActive?'rgba(34,197,94,.04)':'transparent')+'">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">';
    h+='<div style="flex:1;min-width:280px">';
    h+='<div style="display:flex;align-items:center;gap:10px"><div style="font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:1px">Medallero (Top 3)</div>'+kbd('M')+'</div>';
    h+='<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5">Podio de una categoría específica. Elige en orden: modalidad → sexo → división → categoría. Y qué premio: el total o cada movimiento por separado.</div>';
    // Qué se premia. Cambiarlo no borra la categoría elegida: es el mismo grupo,
    // otro premio, y en la ceremonia se pasan los cuatro seguidos.
    h+='<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">';
    Object.keys(MEDAL_TIPOS).forEach(t=>{
      const act=(sel.tipo||'total')===t;
      h+='<button onclick="dirMdSet(\''+'tipo'+'\',\''+t+'\')" style="padding:7px 14px;border-radius:8px;border:2px solid '
        +(act?'var(--gold)':'var(--border)')+';background:'+(act?'rgba(212,168,67,.14)':'transparent')
        +';color:'+(act?'var(--gold)':'var(--muted)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer">'
        +MEDAL_TIPOS[t]+'</button>';
    });
    h+='</div>';
    h+='<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">';
    h+='<select style="'+selStyle+'" onchange="dirMdSet(\'mod\',this.value)"><option value="">1° Modalidad —</option>';
    modOpts.forEach(m=>{h+='<option value="'+m+'"'+(m===sel.mod?' selected':'')+'>'+(MOD_LABEL[m]||m)+'</option>'});
    h+='</select>';
    h+='<select style="'+selStyle+'" '+(sel.mod?'':'disabled')+' onchange="dirMdSet(\'sex\',this.value)"><option value="">2° Sexo —</option>';
    sexOpts.forEach(s=>{h+='<option value="'+s+'"'+(s===sel.sex?' selected':'')+'>'+((s==='Mujer'||s==='Femenino'||s==='F')?'Mujer':'Hombre')+'</option>'});
    h+='</select>';
    h+='<select style="'+selStyle+'" '+(sel.sex?'':'disabled')+' onchange="dirMdSet(\'div\',this.value)"><option value="">3° División —</option>';
    divOpts.forEach(d=>{h+='<option value="'+d+'"'+(d===sel.div?' selected':'')+'>'+d+'</option>'});
    h+='</select>';
    h+='<select style="'+selStyle+'" '+(sel.div?'':'disabled')+' onchange="dirMdSet(\'cat\',this.value)"><option value="">4° Categoría —</option>';
    catOpts.forEach(c=>{h+='<option value="'+c+'"'+(c===sel.cat?' selected':'')+'>'+c+' kg</option>'});
    h+='</select>';
    h+='</div>';
    h+=(mdActive?'<div style="font-size:10px;color:var(--green);margin-top:6px;font-family:Oswald;letter-spacing:1px">EN PANTALLA</div>':'');
    h+='</div>';
    h+='<button class="btn '+(mdActive?'btn-r':'btn-g')+'" onclick="dirToggleMedals()" style="padding:14px 28px;font-size:14px;font-family:Oswald;font-weight:700;letter-spacing:2px;min-width:160px">'+(mdActive?'<i class=yl-i-pausa></i> DESACTIVAR':'<i class=yl-i-reproducir></i> ACTIVAR')+'</button>';
    h+='</div>'+scaleSlider('medals')+'</div>';
  }
  // "Timer grande" (corner de tiempo para dar el intento) se sacó del stream a pedido:
  // ese tiempo ahora es privado, solo lo ve el juez/operador en Control en Vivo.
  // Slam — dos botones momentáneos (GOOD / NO LIFT, no toggle)
  h+='<div class="card" style="padding:14px 18px;border-left:4px solid var(--border)">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">';
  h+='<div style="flex:1;min-width:200px">';
  h+='<div style="font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:1px">Slam GOOD / NO LIFT</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5">Flash de 2s en la esquina superior izquierda. Dispáralo tú cuando los jueces dictaminen.</div>';
  h+='</div>';
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
  h+='<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><button class="btn btn-g" onclick="dirShowSlam(\'g\')" style="padding:14px 22px;font-size:13px;background:#22c55e;border-color:#22c55e;font-family:Oswald;font-weight:700;letter-spacing:2px;min-width:140px"><i class=yl-i-check></i> GOOD LIFT</button>'+kbd('G')+'</div>';
  h+='<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><button class="btn btn-r" onclick="dirShowSlam(\'n\')" style="padding:14px 22px;font-size:13px;font-family:Oswald;font-weight:700;letter-spacing:2px;min-width:140px"><i class=yl-i-cruz></i> NO LIFT</button>'+kbd('N')+'</div>';
  h+='</div></div>'+scaleSlider('slam')+'</div>';
  // Break timer — sección con inputs propios
  const bt=_dirState.breakTimer||{active:false};
  let btStatus='';
  if(bt.active){
    const elapsed=bt.pausedAt?(bt.pausedAt-bt.startedAt):(Date.now()-bt.startedAt);
    const rem=Math.max(0,Math.ceil((bt.durationSec*1000-elapsed)/1000));
    const m=Math.floor(rem/60),s=rem%60;
    btStatus='<div style="font-size:11px;color:'+(bt.pausedAt?'var(--orange,#f59e0b)':'var(--green)')+';margin-top:6px;font-family:Oswald;letter-spacing:1px">'
      +(bt.pausedAt?'<i class=yl-i-pausa></i> PAUSADO':'EN PANTALLA')+' · '+m+':'+(s<10?'0':'')+s+(bt.label?' · '+bt.label:'')+'</div>';
  }
  h+='<div class="card" style="padding:14px 18px;border-left:4px solid '+(bt.active?'var(--green)':'var(--border)')+'">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">';
  h+='<div style="flex:1;min-width:240px">';
  h+='<div style="font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:1px">Timer de descanso</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.5">Reloj configurable para break entre lifts/vuelos/almuerzo. Aparece en grande al centro de la pantalla con cuenta regresiva.</div>';
  h+=btStatus;
  h+='</div>';
  h+='<div style="display:flex;flex-direction:column;align-items:center;gap:4px">';
  h+='<button class="btn '+(bt.active?'btn-r':'btn-g')+'" onclick="dirToggleBreak()" style="padding:14px 28px;font-size:14px;font-family:Oswald;font-weight:700;letter-spacing:2px;min-width:160px">'+(bt.active?'<i class=yl-i-detener></i> DETENER':'<i class=yl-i-reproducir></i> INICIAR')+'</button>';
  h+=kbd('B');
  h+='</div>';
  h+='</div>';
  // Inputs duración + label
  h+='<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
  h+='<div><label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">MIN</label><input id="dirBreakMin" type="number" min="0" max="60" value="'+(bt.active?Math.floor((bt.durationSec||0)/60):10)+'" style="width:70px;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:Oswald;font-size:18px;text-align:center"></div>';
  h+='<div><label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">SEG</label><input id="dirBreakSec" type="number" min="0" max="59" value="'+(bt.active?(bt.durationSec||0)%60:0)+'" style="width:70px;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:Oswald;font-size:18px;text-align:center"></div>';
  h+='<div style="flex:1;min-width:160px"><label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">LABEL (opcional)</label><input id="dirBreakLabel" type="text" placeholder="ej. DESCANSO, ALMUERZO, CAMBIO BARRA" value="'+(bt.label||'').replace(/"/g,'&quot;')+'" style="width:100%;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px"></div>';
  h+='</div>';
  // Selector próximo movimiento
  const curMov=(bt.movement||'').toUpperCase();
  h+='<div style="margin-top:10px">';
  h+='<label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:5px">PRÓXIMO MOVIMIENTO</label>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
  ['','SQUAT','BENCH PRESS','DEADLIFT'].forEach(mv=>{
    const active=curMov===(mv.toUpperCase());
    h+='<button onclick="document.getElementById(\'dirBreakMovement\').value=\''+mv+'\'" style="padding:6px 14px;font-family:Oswald;font-size:12px;letter-spacing:1px;border:1px solid '+(active?'#C41E3A':'var(--border)')+';background:'+(active?'rgba(196,30,58,.2)':'transparent')+';color:'+(active?'#fff':'var(--muted)')+';border-radius:4px;cursor:pointer">'+(mv||'— Ninguno —')+'</button>';
  });
  h+='</div>';
  h+='<input type="hidden" id="dirBreakMovement" value="'+(bt.movement||'')+'">';
  h+='</div>';
  // ── Selector de videos dinámico ──────────────────────────────
  h+='<div style="margin-top:10px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  h+='<div style="padding:8px 12px;background:var(--card);display:flex;align-items:center;justify-content:space-between;gap:8px">';
  h+='<span style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text)">VIDEOS DE FONDO</span>';
  h+='<div style="display:flex;gap:6px">';
  if(_dirBtVideoUploading){
    h+='<span style="font-size:10px;color:var(--muted);padding:4px 10px">Subiendo...</span>';
  } else {
    h+='<button onclick="window.dirBtUploadVideo()" style="padding:4px 10px;border-radius:5px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:10px;font-family:Oswald;letter-spacing:1px;cursor:pointer"><i class=yl-i-subir></i> SUBIR</button>';
  }
  h+='<button onclick="window.dirBtLoadVideos()" style="padding:4px 10px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px;cursor:pointer">CARGAR</button>';
  h+='</div></div>';
  if(_dirBtVideoList===null){
    h+='<div style="padding:10px 12px;font-size:11px;color:var(--muted)">Haz clic en CARGAR para ver los videos disponibles.</div>';
  } else if(_dirBtVideoList.length===0){
    h+='<div style="padding:10px 12px;font-size:11px;color:var(--muted)">No hay videos en storage. Sube uno con <i class=yl-i-subir></i> SUBIR.</div>';
  } else {
    h+='<div style="padding:8px 12px;display:flex;flex-direction:column;gap:6px">';
    const activeUrls=new Set(bt.videos||[]);
    _dirBtVideoList.forEach((v,i)=>{
      const checked=activeUrls.has(v.url)||(!bt.active&&i===0&&_dirBtVideoList.length>0);
      const fname=v.name.replace(/\.[^.]+$/,''); // sin extensión
      h+='<div style="display:flex;align-items:center;gap:8px">';
      h+='<input type="checkbox" id="dirBtVid_'+i+'" '+(checked?'checked':'')+' style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;flex-shrink:0">';
      h+='<label for="dirBtVid_'+i+'" style="font-size:11px;color:var(--text);cursor:pointer;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+v.name+'">'+fname+'</label>';
      h+='<button onclick="window.dirBtDeleteVideo(\''+v.name.replace(/'/g,"\\'")+'\')" title="Eliminar" style="padding:2px 7px;border-radius:4px;border:1px solid rgba(239,68,68,.4);background:transparent;color:#ef4444;font-size:10px;cursor:pointer;flex-shrink:0">Eliminar</button>';
      h+='</div>';
    });
    h+='</div>';
  }
  h+='</div>';
  // ── Editor visual de layout ──────────────────────────────────────────────
  const stl=bt.style||{};
  const _vx=stl.videoX!=null?stl.videoX:0,_vy=stl.videoY!=null?stl.videoY:5;
  const _vw=stl.videoW!=null?stl.videoW:40,_vh=stl.videoH!=null?stl.videoH:80;
  const _tx=stl.textX!=null?stl.textX:44,_ty=stl.textY!=null?stl.textY:10;
  const _bg=stl.bgColor||'#0A1628',_ac=stl.accentColor||'#C41E3A';
  const _ts=stl.titleSize!=null?stl.titleSize:8,_ms=stl.movSize!=null?stl.movSize:5,_tmr=stl.timerSize!=null?stl.timerSize:12;
  const _blur=stl.blurAmount!=null?stl.blurAmount:24,_ov=stl.overlayOpacity!=null?stl.overlayOpacity:0.65;
  h+='<details style="margin-top:10px;border:1px solid var(--border);border-radius:8px;overflow:hidden" open>';
  h+='<summary style="padding:9px 14px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text);background:var(--card);list-style:none;display:flex;align-items:center;justify-content:space-between">EDITOR DE LAYOUT <span style="font-size:9px;color:var(--muted);font-weight:400">arrastra los bloques para mover</span></summary>';
  h+='<div style="background:#07111e">';
  // ── Canvas 16:9 ─────────────────────────────────────────────────────────
  h+='<div id="dirBtCanvas" style="position:relative;width:100%;aspect-ratio:16/9;background:'+_bg+';overflow:hidden;cursor:default;user-select:none;touch-action:none"'
    +' onmousemove="window.dirBtMove(event)" onmouseup="window.dirBtUp(event)" onmouseleave="window.dirBtUp(event)">';
  // Bloque VIDEO (arrastrable + redimensionable)
  h+='<div id="dirBtVid" style="position:absolute;left:'+_vx+'%;top:'+_vy+'%;width:'+_vw+'%;height:'+_vh+'%;background:rgba(30,90,180,.25);border:2px solid rgba(80,150,255,.6);box-sizing:border-box;cursor:grab"'
    +' onmousedown="window.dirBtDown(event,\'vid\')">'
    +'<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;font-family:Oswald;font-size:10px;color:rgba(255,255,255,.5);pointer-events:none;text-align:center"><br>VIDEO<br><span style="font-size:8px;opacity:.6">arrastra</span></div>'
    // Handle resize esquina inferior-derecha
    +'<div style="position:absolute;right:-1px;bottom:-1px;width:14px;height:14px;background:rgba(80,150,255,.8);cursor:se-resize;border-radius:2px 0 0 0" onmousedown="window.dirBtDown(event,\'vid-resize\');event.stopPropagation()"></div>'
    // Handle resize borde derecho (ancho)
    +'<div style="position:absolute;right:-1px;top:50%;transform:translateY(-50%);width:10px;height:28px;background:rgba(80,150,255,.6);cursor:ew-resize;border-radius:3px 0 0 3px" onmousedown="window.dirBtDown(event,\'vid-w\');event.stopPropagation()"></div>'
    // Handle resize borde inferior (altura)
    +'<div style="position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);width:28px;height:10px;background:rgba(80,150,255,.6);cursor:ns-resize;border-radius:3px 3px 0 0" onmousedown="window.dirBtDown(event,\'vid-h\');event.stopPropagation()"></div>'
  +'</div>';
  // Bloque TEXTO (arrastrable)
  const movPreview=((bt.movement||'').toUpperCase()||'DEADLIFT');
  h+='<div id="dirBtTxt" style="position:absolute;left:'+_tx+'%;top:'+_ty+'%;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.35);padding:4% 3%;cursor:grab;min-width:8%;max-width:'+(100-_tx-1)+'%"'
    +' onmousedown="window.dirBtDown(event,\'txt\')">'
    +'<div style="font-family:Oswald;font-size:clamp(6px,2.2vw,16px);font-weight:900;color:#fff;white-space:nowrap;pointer-events:none;line-height:1">YA VOLVEMOS</div>'
    +'<div style="width:60%;height:2px;background:'+_ac+';margin:4px 0;pointer-events:none"></div>'
    +'<div style="font-family:Oswald;font-size:clamp(4px,1.4vw,10px);font-weight:700;color:#fff;pointer-events:none;line-height:1">'+movPreview+'</div>'
    +'<div style="font-family:Oswald;font-size:clamp(8px,3vw,20px);font-weight:900;color:#fff;pointer-events:none;line-height:1;margin-top:2px">10:00</div>'
    +'<div style="font-size:7px;color:rgba(255,255,255,.4);pointer-events:none;margin-top:3px">arrastra</div>'
  +'</div>';
  h+='</div>'; // fin canvas
  // ── Controles de estilo debajo del canvas ───────────────────────────────
  h+='<div style="padding:10px 12px;display:grid;gap:8px;border-top:1px solid var(--border)">';
  // Row colores
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">';
  h+='<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)">Fondo <input type="color" id="dirBtBgColor" value="'+_bg+'" onchange="window.dirBtPreviewBg(this.value)" style="width:36px;height:24px;border:1px solid var(--border);border-radius:3px;background:none;cursor:pointer;padding:1px"></div>';
  h+='<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)">Acento <input type="color" id="dirBtAccent" value="'+_ac+'" style="width:36px;height:24px;border:1px solid var(--border);border-radius:3px;background:none;cursor:pointer;padding:1px"></div>';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);cursor:pointer"><input type="checkbox" id="dirBtShowLogos" '+(stl.showLogos!==false?'checked':'')+' style="accent-color:var(--accent)"> Logos</label>';
  h+='</div>';
  // Logo del evento
  const _evLogo=stl.eventLogoUrl||'';
  h+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px solid rgba(29,49,80,.3);margin-top:4px">';
  h+='<span style="font-size:10px;color:var(--muted);white-space:nowrap">Logo evento</span>';
  if(_evLogo){
    h+='<img src="'+_evLogo+'" id="dirBtEvLogo" data-url="'+_evLogo+'" style="height:28px;width:auto;max-width:80px;object-fit:contain;background:rgba(255,255,255,.05);border-radius:4px;border:1px solid var(--border);padding:2px" onerror="this.style.opacity=.3">';
    h+='<button onclick="window.dirBtClearEventLogo()" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(239,68,68,.4);background:transparent;color:#ef4444;font-size:10px;cursor:pointer"><i class=yl-i-cerrar></i> Quitar</button>';
  } else {
    h+='<span id="dirBtEvLogo" data-url="" style="font-size:10px;color:var(--muted);font-style:italic">Sin logo</span>';
  }
  h+='<button id="dirBtEvLogoBtn" onclick="window.dirBtUploadEventLogo()" style="padding:4px 10px;border-radius:5px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:10px;font-family:Oswald;letter-spacing:1px;cursor:pointer"><i class=yl-i-subir></i> SUBIR</button>';
  h+='</div>';
  // Tamaños de fuente
  const sl2=(id,lbl,min,max,val)=>'<div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--muted);white-space:nowrap;min-width:90px">'+lbl+'</span><input type="range" id="'+id+'" min="'+min+'" max="'+max+'" value="'+val+'" style="flex:1;accent-color:var(--accent)" oninput="document.getElementById(\''+id+'V\').textContent=this.value"><span id="'+id+'V" style="font-size:10px;color:var(--muted);min-width:18px">'+val+'</span></div>';
  h+=sl2('dirBtTS','YA VOLVEMOS (vw)',3,14,_ts);
  h+=sl2('dirBtMS','Movimiento (vw)',2,10,_ms);
  h+=sl2('dirBtTmr','Timer (vw)',5,22,_tmr);
  h+=sl2('dirBtBlur','Desenfoque fondo',0,48,_blur);
  h+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--muted);white-space:nowrap;min-width:90px">Opacidad overlay</span><input type="range" id="dirBtOv" min="0" max="1" step="0.05" value="'+_ov+'" style="flex:1;accent-color:var(--accent)" oninput="document.getElementById(\'dirBtOvV\').textContent=parseFloat(this.value).toFixed(2)"><span id="dirBtOvV" style="font-size:10px;color:var(--muted);min-width:28px">'+_ov.toFixed(2)+'</span></div>';
  // Botón guardar
  h+='<button onclick="window.dirBtApplyStyle()" style="padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:6px;font-family:Oswald;font-size:13px;letter-spacing:2px;cursor:pointer;width:100%;margin-top:2px">GUARDAR Y APLICAR</button>';
  h+='</div></div></details>';
  // Botones
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">';
  if(!bt.active){
    h+='<button class="btn btn-g" onclick="dirBreakStart()" style="padding:9px 18px;font-size:12px"><i class=yl-i-reproducir></i> INICIAR</button>';
    // Presets rápidos
    h+='<button class="btn" onclick="document.getElementById(\'dirBreakMin\').value=5;document.getElementById(\'dirBreakSec\').value=0;dirBreakStart()" style="padding:9px 14px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted)">5 min</button>';
    h+='<button class="btn" onclick="document.getElementById(\'dirBreakMin\').value=10;document.getElementById(\'dirBreakSec\').value=0;dirBreakStart()" style="padding:9px 14px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted)">10 min</button>';
    h+='<button class="btn" onclick="document.getElementById(\'dirBreakMin\').value=15;document.getElementById(\'dirBreakSec\').value=0;dirBreakStart()" style="padding:9px 14px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted)">15 min</button>';
    h+='<button class="btn" onclick="document.getElementById(\'dirBreakMin\').value=20;document.getElementById(\'dirBreakSec\').value=0;dirBreakStart()" style="padding:9px 14px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted)">20 min</button>';
  } else {
    if(bt.pausedAt){
      h+='<button class="btn btn-g" onclick="dirBreakResume()" style="padding:9px 18px;font-size:12px"><i class=yl-i-reproducir></i> REANUDAR</button>';
    } else {
      h+='<button class="btn btn-o" onclick="dirBreakPause()" style="padding:9px 18px;font-size:12px"><i class=yl-i-pausa></i> PAUSAR</button>';
    }
    h+='<button class="btn" onclick="dirBreakAdd(60)" style="padding:9px 14px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted)">+1 min</button>';
    h+='<button class="btn" onclick="dirBreakAdd(-60)" style="padding:9px 14px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted)">−1 min</button>';
    h+='<button class="btn btn-r" onclick="dirBreakHide()" style="padding:9px 18px;font-size:12px"><i class=yl-i-detener></i> DETENER</button>';
  }
  h+='</div>'+scaleSlider('breakTimer');
  h+='</div>';

  // Color picker panel
  const curColors=(_dirState&&_dirState.colors)||{};
  const colorGroups=[
    {title:'INTENTOS',items:[
      {key:'goodLift',   label:'Good Lift',     desc:'Intento bueno y banner GOOD LIFT'},
      {key:'noLift',     label:'No Lift',        desc:'Intento fallido, banner NO LIFT y DQ'},
      {key:'curAttempt', label:'Intento actual',   desc:'Fondo del intento en curso'},
    ]},
    {title:'NOMBRE / BARRA',items:[
      {key:'nameBg',     label:'Fondo nombre',     desc:'Color principal de la barra del nombre'},
      {key:'nameBg2',    label:'Fondo nombre 2',   desc:'Color derecho del gradiente de la barra'},
      {key:'nameText',   label:'Texto nombre',     desc:'Texto sobre la barra del nombre'},
    ]},
    {title:'POSICIÓN',items:[
      {key:'puesto',     label:'# Posición',       desc:'Texto del puesto en marcador (pos 4+)'},
      {key:'accent',     label:'Acento / Podio',   desc:'Bordes, total, pos 2-3, highlights'},
    ]},
    {title:'ESTRUCTURA',items:[
      {key:'headerBg',   label:'Header',           desc:'Fondo del encabezado del marcador/LB'},
      {key:'gridBg',     label:'Grid intentos',    desc:'Fondo de la fila de intentos'},
    ]},
    {title:'LEADERBOARD Y MEDALLERO',items:[
      {key:'cardBg',     label:'Fondo tarjeta',    desc:'Tarjeta del leaderboard y filas del medallero'},
      {key:'lbHighlight',label:'Fila actual',      desc:'Color de la fila del atleta actual'},
    ]},
  ];
  // Nota para quien venga a agregar colores: el oro, la plata y el bronce del
  // medallero NO están acá a propósito. Son el color de la medalla, no del tema:
  // un primer lugar plateado no se entiende en ninguna paleta.
  // ── Paletas rápidas ──────────────────────────────────────────
  const activePal=(_dirState&&_dirState.palette)||null;
  h+='<div style="margin-top:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 18px">';
  h+='<div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:12px">PALETA DE COLORES</div>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px">';
  Object.entries(_TX_COLOR_PALETTES).forEach(([key,pal])=>{
    const active=activePal===key;
    h+='<button onclick="dirApplyPalette(\''+key+'\')" style="'
      +'display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:10px 14px;'
      +'border-radius:10px;border:2px solid '+(active?'#D4A843':'rgba(100,140,200,.25)')+';'
      +'background:'+(active?'rgba(212,168,67,.1)':'rgba(10,22,40,.5)')+';'
      +'cursor:pointer;transition:all .15s;min-width:110px">';
    // Swatches
    h+='<div style="display:flex;gap:3px">';
    pal.preview.forEach(c=>{h+='<div style="width:14px;height:14px;border-radius:3px;background:'+c+';box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>';});
    h+='</div>';
    h+='<div style="font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:.5px;color:'+(active?'#D4A843':'var(--text)')+'">'+pal.label+'</div>';
    h+='<div style="font-size:9px;color:var(--muted);line-height:1.3">'+pal.desc+'</div>';
    h+='</button>';
  });
  h+='</div>';
  // ── Ajuste fino (individual) ─────────────────────────────────
  h+='<details style="margin-top:12px"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:8px 0;font-family:Oswald;font-size:10px;letter-spacing:2px;color:var(--muted)">▸ AJUSTE FINO (colores individuales)</summary>';
  h+='<div style="margin-top:12px">';
  colorGroups.forEach(({title,items})=>{
    h+='<div style="margin-bottom:14px">';
    h+='<div style="font-family:Oswald;font-size:10px;letter-spacing:2px;color:var(--gold);margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,168,67,.2)">'+title+'</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">';
    items.forEach(({key,label,desc})=>{
      const _raw=curColors[key]||_TX_COLOR_DEFAULTS[key]||'#ffffff';
      const val=/^#[0-9a-fA-F]{6}$/.test(_raw)?_raw:(_TX_COLOR_DEFAULTS[key]||'#ffffff');
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(10,22,40,.4);border:1px solid var(--border);border-radius:8px">';
      h+='<input type="color" value="'+val+'" onchange="dirSetColor(\''+key+'\',this.value)" style="width:36px;height:36px;border:none;border-radius:5px;cursor:pointer;background:transparent;flex-shrink:0">';
      h+='<div style="min-width:0"><div style="font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px;color:var(--text)">'+label+'</div>';
      h+='<div style="font-size:10px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+desc+'</div>';
      h+='<div style="font-size:9px;color:var(--muted);font-family:monospace;margin-top:1px">'+val+'</div></div>';
      h+='</div>';
    });
    h+='</div></div>';
  });
  h+='<div style="margin-top:8px;display:flex;justify-content:flex-end"><button class="btn btn-o" onclick="dirResetColors()" style="padding:7px 16px;font-size:11px;font-family:Oswald;letter-spacing:1px">↺ RESTAURAR DEFAULTS</button></div>';
  h+='</div></details>';
  h+='</div>';

  h+='</div>';
  return h;
}

function txScaleLightsDown(){txScaleWidget('lights',-10);}

function txScaleLightsUp(){txScaleWidget('lights',10);}

function txScaleMarcDown(){txScaleWidget('marc',-10);}

function txScaleMarcUp(){txScaleWidget('marc',10);}

function txScaleWidget(id,delta){
  const pos=TX_POS[id];
  pos.scale=Math.max(40,Math.min(200,pos.scale+delta));
  const el=document.getElementById(id==='lights'?'txLightsWidget':'txMarcWidget');
  if(el)el.style.transform='scale('+pos.scale/100+')';
}

function initTxWidgets(){
  const ids=['txLightsWidget','txMarcWidget'];
  const keys=['lights','marc'];
  // Default positions if first time
  const defaults={
    txLightsWidget:{x:20,y:null,bottom:80},
    txMarcWidget:{x:null,right:20,y:null,bottom:20}
  };
  ids.forEach((wId,i)=>{
    const el=document.getElementById(wId);
    if(!el)return;
    const pos=TX_POS[keys[i]];
    // Set initial position if not yet set
    if(pos.x===null){
      const def=defaults[wId];
      if(def.right!=null){
        el.style.right=def.right+'px';el.style.left='auto';
        pos.x=window.innerWidth-el.offsetWidth-def.right;
      }else{el.style.left=def.x+'px';pos.x=def.x;}
      if(def.bottom!=null){
        el.style.bottom=def.bottom+'px';el.style.top='auto';
        pos.y=window.innerHeight-el.offsetHeight-def.bottom;
      }else{el.style.top=def.y+'px';pos.y=def.y;}
    }else{
      el.style.left=pos.x+'px';el.style.top=pos.y+'px';
      el.style.right='auto';el.style.bottom='auto';
    }
    el.style.transform='scale('+pos.scale/100+')';
    el.style.transformOrigin='top left';
    // Attach drag to handle
    const handle=el.querySelector('.tx-handle');
    if(!handle)return;
    handle.addEventListener('mousedown',function(e){
      if(e.target.tagName==='BUTTON')return;
      e.preventDefault();
      const startX=e.clientX-pos.x,startY=e.clientY-pos.y;
      // Normalize to top/left
      const rect=el.getBoundingClientRect();
      const ox=rect.left,oy=rect.top;
      el.style.left=ox+'px';el.style.top=oy+'px';
      el.style.right='auto';el.style.bottom='auto';
      pos.x=ox;pos.y=oy;
      const sc=pos.scale/100;
      const mx=e.clientX,my=e.clientY;
      const bx=ox,by=oy;
      function onMove(ev){
        pos.x=bx+(ev.clientX-mx);
        pos.y=by+(ev.clientY-my);
        el.style.left=pos.x+'px';el.style.top=pos.y+'px';
      }
      function onUp(){
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
        handle.style.cursor='grab';
      }
      handle.style.cursor='grabbing';
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
    // Touch support
    handle.addEventListener('touchstart',function(e){
      if(e.target.tagName==='BUTTON')return;
      e.preventDefault();
      const t=e.touches[0];
      const rect=el.getBoundingClientRect();
      el.style.left=rect.left+'px';el.style.top=rect.top+'px';
      el.style.right='auto';el.style.bottom='auto';
      pos.x=rect.left;pos.y=rect.top;
      const mx=t.clientX,my=t.clientY,bx=pos.x,by=pos.y;
      function onTMove(ev){
        const tt=ev.touches[0];
        pos.x=bx+(tt.clientX-mx);pos.y=by+(tt.clientY-my);
        el.style.left=pos.x+'px';el.style.top=pos.y+'px';
      }
      function onTEnd(){
        el.removeEventListener('touchmove',onTMove);
        el.removeEventListener('touchend',onTEnd);
      }
      el.addEventListener('touchmove',onTMove,{passive:false});
      el.addEventListener('touchend',onTEnd);
    },{passive:false});
  });
}

function renderTransmision(){
  const queue=liftQueue(),cur=queue[0];
  const evName=(DATA.event==null?void 0:DATA.event.name)||(DATA.event==null?void 0:DATA.event.short)||'Campeonato';
  let h=`<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:${txChroma};display:flex;flex-direction:column;z-index:999">`;
  // Controls bar
  h+='<div style="position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;align-items:center;z-index:1000;flex-wrap:wrap;gap:6px">';
  h+='<div style="display:flex;gap:4px;align-items:center">';
  [['envivo','En Vivo'],['premiacion','Premiación']].forEach(([v,l])=>{
    const isActive=v==='envivo'?txView!=='premiacion':txView==='premiacion';
    h+='<button onclick="txView=\''+v+'\';R()" style="background:'+(isActive?'var(--accent)':'rgba(30,50,80,.85)')+';border:1px solid '+(isActive?'var(--accent)':'rgba(100,140,200,.3)')+';color:'+(isActive?'#fff':'#aac')+';padding:5px 10px;border-radius:5px;cursor:pointer;font-family:Oswald;font-size:10px;letter-spacing:1px">'+l+'</button>';
  });
  h+='</div>';
  h+='<div style="display:flex;gap:8px;align-items:center">';
  h+='<label style="font-size:9px;color:rgba(160,180,210,.5);font-family:Oswald">FONDO</label>';
  h+=`<input type="color" value="${txChroma}" oninput="txChroma=this.value;document.querySelector('[data-tx-bg]').style.background=this.value" style="width:28px;height:22px;border:1px solid rgba(100,140,200,.3);border-radius:4px;cursor:pointer;padding:0">`;
  ['#000000','#00FF00','#0000FF','#FF00FF'].forEach(c=>{
    h+='<button onclick="txChroma=\''+c+'\';document.querySelector(\'[data-tx-bg]\').style.background=\''+c+'\'" style="width:18px;height:18px;background:'+c+';border:1px solid '+(txChroma===c?'#fff':'rgba(100,140,200,.3)')+';border-radius:3px;cursor:pointer"></button>';
  });
  h+='<label style="font-size:9px;color:rgba(160,180,210,.5);font-family:Oswald;margin-left:8px">ESCALA</label>';
  h+=`<input type="range" min="50" max="150" value="${txScale}" oninput="txScale=parseInt(this.value);document.getElementById('txContent').style.transform='scale('+txScale/100+')';this.nextElementSibling.textContent=txScale+'%'" style="width:80px;cursor:pointer">`;
  h+=`<span style="font-size:10px;color:rgba(160,180,210,.5);font-family:Oswald;min-width:30px">${txScale}%</span>`;
  h+='<button onclick="go(\'compete\')" style="background:rgba(30,50,80,.85);border:1px solid rgba(100,140,200,.3);color:#aac;padding:5px 10px;border-radius:5px;cursor:pointer;font-family:Oswald;font-size:10px;letter-spacing:1px;margin-left:6px">BACK</button>';
  h+='</div></div>';
  h+=`<div id="txContent" data-tx-bg style="flex:1;display:flex;flex-direction:column;transform:scale(${txScale/100});transform-origin:center center">`;
  if(txView==='premiacion')h+=txPremiacion(evName);
  else h+=txEnVivo(cur,evName);
  h+='</div></div>';
  return h;
}

function txEnVivo(cur,evName){
  if(!cur)return '<div style="flex:1;display:flex;align-items:center;justify-content:center"><div style="font-family:Oswald;font-size:26px;font-weight:700;color:#d4a843;letter-spacing:3px">RONDA COMPLETADA</div></div>';
  // Background: leaderboard + si levanta
  let h='<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0;padding:50px 20px 20px;pointer-events:none">';
  h+='<div style="overflow-y:auto;padding:0 10px">'+txLeaderboardCompact(cur,evName)+'</div>';
  h+='<div style="overflow-y:auto;padding:0 10px">'+txSiLevantaCompact(cur,evName)+'</div>';
  h+='</div>';

  // ── LIGHTS + TIMER WIDGET ────────────────────────────────
  const jcSm={white:'#f0f0f0',red:'#ef4444',yellow:'#f59e0b',blue:'#3b82f6'};
  const timerTx=DATA.timerOn||DATA.timer<60?String(Math.floor(DATA.timer/60)).padStart(2,'0')+':'+String(DATA.timer%60).padStart(2,'0'):'--:--';
  const timerColor=DATA.timer<=10&&DATA.timerOn?'#ef4444':DATA.timer<=30&&DATA.timerOn?'#f59e0b':'#ffffff';
  h+='<div id="txLightsWidget" style="position:absolute;z-index:300;cursor:default;user-select:none">';
  // Drag handle
  h+='<div class="tx-handle" style="background:rgba(30,50,90,.7);border-radius:8px 8px 0 0;padding:3px 8px;display:flex;justify-content:space-between;align-items:center;cursor:grab">';
  h+='<span style="font-family:Oswald;font-size:9px;color:rgba(160,180,210,.5);letter-spacing:1px">&#9776; LUCES</span>';
  h+='<div style="display:flex;gap:4px">';
  h+='<button onmousedown="event.stopPropagation()" onclick="txScaleLightsDown()" style="width:18px;height:18px;border-radius:3px;border:1px solid rgba(100,140,200,.3);background:transparent;color:rgba(160,180,210,.6);font-size:10px;font-weight:700;cursor:pointer;padding:0">-</button>';
  h+='<button onmousedown="event.stopPropagation()" onclick="txScaleLightsUp()" style="width:18px;height:18px;border-radius:3px;border:1px solid rgba(100,140,200,.3);background:transparent;color:rgba(160,180,210,.6);font-size:10px;font-weight:700;cursor:pointer;padding:0">+</button>';
  h+='</div></div>';
  // Content
  h+='<div style="background:rgba(8,18,36,.88);border:1px solid rgba(80,120,180,.35);border-top:none;border-radius:0 0 12px 12px;padding:12px 18px;display:flex;flex-direction:column;align-items:center;gap:8px">';
  h+='<div style="display:flex;gap:16px;align-items:flex-end">';
  const jlNames={izq:'IZQ',central:'CTR',der:'DER'};
  ['izq','central','der'].forEach(j=>{
    // build inline — need to emit string
  });
  // Emit lights as literal string concatenation
  h+='</div></div></div>';
  // Patch: rebuild lights inline properly
  let lightsInner='';
  ['izq','central','der'].forEach(function(j){
    const v=judgeLights[j];
    const bigCol=v?(v==='white'?'#f0f0f0':'#ef4444'):'rgba(30,55,100,.6)';
    const bigGlow=v?(v==='white'?'0 0 28px rgba(240,240,240,.6),0 0 56px rgba(240,240,240,.22)':'0 0 28px rgba(239,68,68,.6),0 0 56px rgba(239,68,68,.22)'):'none';
    const smallCol=v?jcSm[v]:'rgba(30,55,100,.6)';
    lightsInner+='<div style="text-align:center">'
      +'<div style="width:52px;height:52px;border-radius:50%;background:'+bigCol+';border:3px solid '+(v?'rgba(255,255,255,.25)':'rgba(80,120,180,.3)')+';box-shadow:'+bigGlow+';transition:all .25s;margin:0 auto 6px"></div>'
      +'<div style="width:16px;height:16px;border-radius:50%;background:'+smallCol+';border:2px solid '+(v?'rgba(255,255,255,.25)':'rgba(80,120,180,.3)')+';margin:0 auto 4px;box-shadow:'+(v?'0 0 8px '+smallCol:'none')+'"></div>'
      +'<div style="font-family:Oswald;font-size:9px;color:'+(v?'rgba(255,255,255,.6)':'rgba(100,140,200,.4)')+';letter-spacing:1px">'+jlNames[j]+'</div>'
      +'</div>';
  });
  // inject into the lights row placeholder
  h=h.replace('<div style="display:flex;gap:16px;align-items:flex-end"></div>',
              '<div style="display:flex;gap:16px;align-items:flex-end">'+lightsInner+'</div>');

  // ── MARCADOR WIDGET ──────────────────────────────────────
  h+='<div id="txMarcWidget" style="position:absolute;z-index:300;cursor:default;user-select:none">';
  h+='<div class="tx-handle" style="background:rgba(30,50,90,.7);border-radius:8px 8px 0 0;padding:3px 8px;display:flex;justify-content:space-between;align-items:center;cursor:grab">';
  h+='<span style="font-family:Oswald;font-size:9px;color:rgba(160,180,210,.5);letter-spacing:1px">&#9776; MARCADOR</span>';
  h+='<div style="display:flex;gap:4px">';
  h+='<button onmousedown="event.stopPropagation()" onclick="txScaleMarcDown()" style="width:18px;height:18px;border-radius:3px;border:1px solid rgba(100,140,200,.3);background:transparent;color:rgba(160,180,210,.6);font-size:10px;font-weight:700;cursor:pointer;padding:0">-</button>';
  h+='<button onmousedown="event.stopPropagation()" onclick="txScaleMarcUp()" style="width:18px;height:18px;border-radius:3px;border:1px solid rgba(100,140,200,.3);background:transparent;color:rgba(160,180,210,.6);font-size:10px;font-weight:700;cursor:pointer;padding:0">+</button>';
  h+='</div></div>';
  h+=txMarcadorIPF(cur,evName);
  h+='</div>';

  return h;
}

function txMarcadorIPF(cur,evName){
  const rk=catRankBySub(cur);const st=subTotal(cur,DATA.lift);const cw=cur.att[DATA.lift][DATA.round].w;
  let simPos=rk.pos;
  if(cw){const simBest=Math.max(bestOf(cur,DATA.lift),cw);let newSub;if(DATA.lift==='sq')newSub=simBest;else if(DATA.lift==='bp')newSub=bestOf(cur,'sq')+simBest;else newSub=bestOf(cur,'sq')+bestOf(cur,'bp')+simBest;
    const sameCat=DATA.athletes.filter(a=>a.cat===cur.cat&&a.flight===DATA.flight&&!a.bombed);
    const simRanked=sameCat.map(a=>{if(a.id===cur.id)return{id:a.id,sub:newSub};return{id:a.id,sub:subTotal(a,DATA.lift)}}).filter(x=>x.sub>0).sort((a,b)=>b.sub-a.sub);
    simPos=simRanked.findIndex(x=>x.id===cur.id)+1;}
  const parts=cur.name.split(' ');const lastName=parts.length>2?parts.slice(-2).join(' '):parts[parts.length-1];const firstName=parts.length>2?parts.slice(0,-2).join(' '):parts.slice(0,-1).join(' ');
  const divShort=txDivShort(cur.div);
  const catDiv=(cur.cat?'-'+cur.cat+'kg ':'')+divShort;
  const rankStr=rk.pos?(simPos&&simPos!==rk.pos?rk.pos+' to '+simPos:'to '+rk.pos):'-';
  let h='<div style="max-width:100%">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 18px;background:linear-gradient(90deg,rgba(45,65,100,.92),rgba(50,72,110,.88));border-radius:5px 5px 0 0">';
  h+='<div style="font-family:Oswald;font-size:13px;color:rgba(200,215,240,.7);letter-spacing:1px">'+catDiv+'</div>';
  h+='<div style="font-family:Oswald;font-size:16px;color:#fff;letter-spacing:2px">RANK <span style="font-weight:700;color:#d4a843">'+rankStr+'</span></div>';
  h+='</div>';
  h+='<div style="display:flex;align-items:center;padding:6px 18px;background:linear-gradient(90deg,rgba(25,42,72,.95),rgba(30,48,80,.95));gap:12px">';
  h+='<div style="background:linear-gradient(135deg,rgba(50,75,120,.9),rgba(40,62,100,.9));padding:4px 10px;border-radius:4px;border:1px solid rgba(80,120,180,.3);min-width:70px;text-align:center"><div style="font-family:Oswald;font-size:10px;font-weight:700;color:rgba(200,215,240,.8);letter-spacing:.5px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(cur.club||'—')+'</div></div>';
  h+='<div style="flex:1">';
  if(firstName)h+='<div style="font-size:10px;color:rgba(200,215,240,.55);line-height:1;margin-bottom:1px">'+firstName+'</div>';
  h+='<div style="font-family:Oswald;font-size:clamp(18px,3.5vw,28px);font-weight:700;color:#fff;letter-spacing:1px;line-height:1.1;text-transform:uppercase">'+lastName+'</div></div></div>';
  h+='<div style="display:flex;align-items:stretch;background:linear-gradient(90deg,rgba(18,32,55,.95),rgba(22,36,60,.95))"><div style="display:flex;flex:1">';
  cur.att[DATA.lift].forEach((at,j)=>{
    let bg,clr,td='none';
    if(at.r==='g'){bg='linear-gradient(180deg,rgba(34,197,94,.3),rgba(34,197,94,.15))';clr='#22c55e'}else if(at.r==='n'){bg='linear-gradient(180deg,rgba(239,68,68,.25),rgba(239,68,68,.1))';clr='#ef4444';td='line-through'}else if(at.w>0){bg='rgba(45,65,105,.5)';clr='#fff'}else{bg='rgba(30,48,78,.3)';clr='rgba(90,120,160,.3)'}
    const isCur=j===DATA.round&&at.r===null;
    h+='<div style="flex:1;padding:8px 12px;text-align:center;background:'+bg+';border-right:1px solid rgba(55,85,130,.15);'+(isCur?'box-shadow:inset 0 -3px 0 '+LIFT_C[DATA.lift]+';':'')+'"><div style="font-family:Oswald;font-size:20px;font-weight:700;color:'+clr+';text-decoration:'+td+'">'+(at.w||'\u2014')+'</div></div>';
  });
  h+='</div>';
  if(st>0)h+='<div style="padding:8px 18px;text-align:center;background:linear-gradient(180deg,rgba(212,168,67,.25),rgba(212,168,67,.1));border-left:2px solid #d4a843;min-width:90px;display:flex;align-items:center;justify-content:center"><div style="font-family:Oswald;font-size:22px;font-weight:700;color:#d4a843">'+st.toFixed(1)+'</div></div>';
  h+='</div>';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 18px;background:linear-gradient(90deg,rgba(12,22,42,.9),rgba(16,26,46,.9));border-radius:0 0 5px 5px">';
  h+='<div style="display:flex;align-items:center;gap:6px"><img src="YourLift_logo.png" alt="YourLift" style="height:18px;opacity:.7" onerror="this.remove()"><span style="font-family:Oswald;font-size:10px;color:rgba(160,180,210,.45);letter-spacing:1px">YourLift</span></div>';
  h+='<div style="font-family:Oswald;font-size:10px;color:rgba(160,180,210,.45);letter-spacing:1px;text-transform:uppercase">'+evName+'</div></div></div>';
  return h;
}

function txLeaderboardCompact(cur,evName){
  const sameCat=DATA.athletes.filter(a=>a.cat===cur.cat&&a.flight===DATA.flight&&!a.bombed);
  const ranked=sameCat.map(a=>({...a,total:totalOf(a),fTotal:forecastTotal(a),fPlace:0}));
  ranked.sort((a,b)=>b.fTotal-a.fTotal);
  ranked.forEach((a,i)=>a.fPlace=i+1);
  const divShort=txDivShort(cur.div);
  let h='<div style="background:linear-gradient(135deg,rgba(20,35,62,.96),rgba(26,42,72,.96));border:1px solid rgba(60,90,140,.3);border-radius:10px;overflow:hidden">';
  h+='<div style="padding:8px 14px;background:rgba(25,42,72,.96);border-bottom:1px solid rgba(60,90,140,.3);display:flex;justify-content:space-between;align-items:center">';
  h+='<div><div style="font-family:Oswald;font-size:9px;color:rgba(160,180,210,.5);letter-spacing:1px">LEADERBOARD</div><div style="font-family:Oswald;font-size:13px;color:#fff;letter-spacing:1px">'+divShort+' • '+cur.cat+'</div></div></div>';
  // Header row
  h+='<div style="display:grid;grid-template-columns:2fr 55px 65px 40px;padding:4px 12px;border-bottom:1px solid rgba(50,75,110,.3)">';
  h+='<div style="font-family:Oswald;font-size:9px;color:rgba(160,180,210,.4);letter-spacing:1px">NOMBRE</div>';
  h+='<div style="font-family:Oswald;font-size:9px;color:rgba(160,180,210,.4);text-align:center;letter-spacing:1px">TOTAL</div>';
  h+='<div style="font-family:Oswald;font-size:9px;color:rgba(160,180,210,.4);text-align:center;letter-spacing:1px">F.TOT</div>';
  h+='<div style="font-family:Oswald;font-size:9px;color:rgba(160,180,210,.4);text-align:center;letter-spacing:1px">POS</div></div>';
  ranked.forEach(a=>{
    const isCur=a.id===cur.id;
    h+='<div style="display:grid;grid-template-columns:2fr 55px 65px 40px;padding:5px 12px;background:'+(isCur?'rgba(196,30,58,.2)':'transparent')+';border-bottom:1px solid rgba(40,60,95,.25)">';
    h+='<div style="font-family:Oswald;font-size:12px;font-weight:'+(isCur?'700':'400')+';color:'+(isCur?'#fff':'rgba(200,215,240,.7)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+a.name+'</div>';
    h+='<div style="font-family:Oswald;font-size:12px;text-align:center;color:rgba(200,215,240,.5)">'+(a.total||'0')+'</div>';
    h+='<div style="font-family:Oswald;font-size:12px;text-align:center;font-weight:700;color:'+(isCur?'#d4a843':'rgba(200,215,240,.7)')+'">'+a.fTotal+'</div>';
    h+='<div style="font-family:Oswald;font-size:12px;text-align:center;font-weight:700;color:'+(isCur?'#d4a843':'rgba(200,215,240,.5)')+'">'+a.fPlace+'</div></div>';
  });
  // Best lifts bar
  h+='<div style="padding:6px 12px;background:rgba(196,30,58,.15);display:flex;gap:14px">';
  ['sq','bp','dl'].forEach(l=>{
    const b=bestOf(cur,l);
    h+='<div style="display:flex;gap:4px;align-items:center"><span style="font-family:Oswald;font-size:9px;color:rgba(160,180,210,.4)">'+LIFT_S[l]+'</span><span style="font-family:Oswald;font-size:13px;font-weight:700;color:'+(b?LIFT_C[l]:'rgba(100,130,160,.3)')+'">'+(b||'-')+'</span></div>';
  });
  h+='</div></div>';
  return h;
}

function txSiLevantaCompact(cur,evName){
  const cw=cur.att[DATA.lift][DATA.round].w;
  if(!cw)return '<div style="background:linear-gradient(135deg,rgba(20,35,62,.96),rgba(26,42,72,.96));border:1px solid rgba(60,90,140,.3);border-radius:10px;padding:30px;text-align:center"><div style="font-family:Oswald;font-size:14px;color:rgba(160,180,210,.4)">Sin peso cargado</div></div>';
  const curRk=catRankBySub(cur);
  const simBest=Math.max(bestOf(cur,DATA.lift),cw);
  let newSub;
  if(DATA.lift==='sq')newSub=simBest;
  else if(DATA.lift==='bp')newSub=bestOf(cur,'sq')+simBest;
  else newSub=bestOf(cur,'sq')+bestOf(cur,'bp')+simBest;
  // Mismo sexo + cat + div (separar divisiones de edad)
  const sameCat=DATA.athletes.filter(a=>a.cat===cur.cat&&a.div===cur.div&&a.sex===cur.sex&&a.flight===DATA.flight&&!a.bombed);
  const simRanked=sameCat.map(a=>{
    if(a.id===cur.id)return{id:a.id,sub:newSub};
    return{id:a.id,sub:subTotal(a,DATA.lift)};
  }).filter(x=>x.sub>0).sort((a,b)=>b.sub-a.sub);
  const simPos=simRanked.findIndex(x=>x.id===cur.id)+1;
  const st=subTotal(cur,DATA.lift);
  const parts=cur.name.split(' ');
  const lastName=parts.length>2?parts.slice(-2).join(' '):parts[parts.length-1];

  let h='<div style="background:linear-gradient(135deg,rgba(20,35,62,.96),rgba(26,42,72,.96));border:1px solid rgba(60,90,140,.3);border-radius:10px;overflow:hidden">';
  h+='<div style="padding:10px 16px;text-align:center;background:rgba(196,30,58,.15);border-bottom:1px solid rgba(80,120,180,.2)"><div style="font-family:Oswald;font-size:clamp(18px,3vw,26px);font-weight:700;color:#fff;letter-spacing:3px">SI LO LEVANTA</div></div>';
  h+='<div style="padding:10px 16px;border-bottom:1px solid rgba(50,80,120,.3);text-align:center"><div style="font-family:Oswald;font-size:clamp(16px,2.5vw,22px);font-weight:700;color:#fff;text-transform:uppercase">'+lastName+'</div><div style="font-size:10px;color:rgba(180,200,230,.5)">'+cur.cat+' · '+(cur.div||'')+'</div></div>';
  // Rank
  h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 22px;border-bottom:1px solid rgba(50,80,120,.25)">';
  h+='<div style="font-family:Oswald;font-size:12px;color:rgba(180,200,230,.5);letter-spacing:1px">POSICIÓN</div>';
  h+='<div style="display:flex;align-items:center;gap:10px"><span style="font-family:Oswald;font-size:26px;font-weight:700;color:rgba(200,215,240,.45)">'+(curRk.pos||'—')+'°</span><span style="font-family:Oswald;font-size:22px;color:#d4a843">▸</span><span style="font-family:Oswald;font-size:26px;font-weight:700;color:#d4a843">'+simPos+'°</span></div></div>';
  // Subtotal
  h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 22px">';
  h+='<div style="font-family:Oswald;font-size:12px;color:rgba(180,200,230,.5);letter-spacing:1px">SUBTOTAL</div>';
  h+='<div style="display:flex;align-items:center;gap:10px"><span style="font-family:Oswald;font-size:22px;font-weight:700;color:rgba(200,215,240,.45)">'+(st||'—')+' kg</span><span style="font-family:Oswald;font-size:22px;color:#d4a843">▸</span><span style="font-family:Oswald;font-size:22px;font-weight:700;color:#d4a843">'+newSub.toFixed(1)+' kg</span></div></div>';
  h+='</div>';
  return h;
}

function txFooter(evName){
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 18px;background:linear-gradient(90deg,rgba(12,22,42,.92),rgba(16,26,46,.92));border-radius:0 0 7px 7px"><div style="font-family:Oswald;font-size:11px;color:rgba(160,180,210,.45);letter-spacing:1px">YourLift</div><div style="font-family:Oswald;font-size:11px;color:rgba(160,180,210,.45);letter-spacing:1px;text-transform:uppercase">'+evName+'</div></div>';
}

// ── PREMIACIÓN ──
function txPremiacion(evName){
  const all=DATA.athletes.filter(a=>!a.bombed).map(a=>({...a,total:totalOf(a)})).filter(a=>a.total>0);
  const groups={};
  all.forEach(a=>{const k=(a.div||'Sin Div')+' · '+a.cat;if(!groups[k])groups[k]=[];groups[k].push(a)});
  Object.values(groups).forEach(arr=>arr.sort((a,b)=>b.total-a.total));
  const keys=Object.keys(groups).sort();
  let h='<div style="flex:1;overflow-y:auto;padding:60px 30px 30px">';
  h+='<div style="text-align:center;margin-bottom:24px"><div style="font-family:Oswald;font-size:clamp(24px,4vw,36px);font-weight:700;color:#d4a843;letter-spacing:3px">PREMIACIÓN</div><div style="font-family:Oswald;font-size:13px;color:rgba(160,180,210,.5);letter-spacing:1px;margin-top:4px">'+evName+'</div></div>';
  if(!keys.length){h+='<div style="text-align:center;color:rgba(160,180,210,.5);font-size:14px;padding:40px">Sin resultados todavía</div></div>';return h}
  keys.forEach(k=>{
    const top3=groups[k].slice(0,3);
    const medals=['1°','2°','3°'];
    const colors=['#d4a843','#94a3b8','#b45309'];
    h+='<div style="background:linear-gradient(135deg,rgba(20,35,62,.96),rgba(26,42,72,.96));border:1px solid rgba(60,90,140,.3);border-radius:12px;margin-bottom:16px;overflow:hidden">';
    h+='<div style="padding:10px 20px;background:rgba(196,30,58,.15);border-bottom:1px solid rgba(80,120,180,.2)"><div style="font-family:Oswald;font-size:15px;font-weight:700;color:#fff;letter-spacing:1px">'+k+'</div></div>';
    // Podium
    h+='<div style="display:flex;justify-content:center;align-items:flex-end;gap:12px;padding:24px 20px 16px">';
    const order=[1,0,2];
    const heights=[90,120,70];
    order.forEach(idx=>{
      const a=top3[idx];
      if(!a){h+='<div style="flex:1;max-width:200px"></div>';return}
      const pts2=a.name.split(' ');
      const ln=pts2.length>2?pts2.slice(-2).join(' '):pts2[pts2.length-1];
      const fn=pts2.length>2?pts2.slice(0,-2).join(' '):'';
      h+='<div style="flex:1;max-width:200px;text-align:center">';
      if(fn)h+='<div style="font-size:10px;color:rgba(180,200,230,.5);margin-bottom:2px">'+fn+'</div>';
      h+='<div style="font-family:Oswald;font-size:clamp(14px,2vw,18px);font-weight:700;color:#fff;text-transform:uppercase;margin-bottom:4px">'+ln+'</div>';
      h+='<div style="font-family:Oswald;font-size:20px;font-weight:700;color:'+colors[idx]+'">'+a.total+' kg</div>';
      h+='<div style="background:'+colors[idx]+'22;border:2px solid '+colors[idx]+';border-radius:8px 8px 0 0;height:'+heights[idx]+'px;display:flex;align-items:center;justify-content:center;margin-top:8px"><span style="font-size:32px">'+medals[idx]+'</span></div>';
      h+='</div>';
    });
    h+='</div>';
    h+=txFooter(evName)+'</div>';
  });
  h+='</div>';
  return h;
}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

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
  ['profile','scoreboard','leaderboard','timer','slam','tablaActual','medals','luces','jurado'].forEach(k=>{_dirState[k]=Object.assign({},_dirState[k]||{},{active:false,until:0})});
  await _dirPush();R();
};

window.dirShowLb=async function(cat,seconds){
  await window.dirShow('leaderboard',seconds,{cat:cat||''});
};

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

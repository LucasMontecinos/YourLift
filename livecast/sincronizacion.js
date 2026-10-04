// livecast.html — Firebase y la sincronización en vivo: el documento de la competencia, el canal rápido, el guardado local, deshacer/rehacer, el ensayo y los respaldos.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

 // Firestore listener for current event athletes

async function initFB(){
  try{
    const{initializeApp}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const fb=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const authMod=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const storageMod=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
    const app=initializeApp(FB_CFG);
    try{
      // experimentalAutoDetectLongPolling: en el wifi de un gimnasio (portal
      // cautivo, proxy, router que corta conexiones largas) el canal en tiempo
      // real de Firestore a veces queda a medias y los cambios llegan tarde o de
      // a montones. Con esto el SDK lo detecta y se pasa solo a long polling.
      // Si la red está bien, no cambia nada.
      //
      // Adentro de OBS no alcanza con detectarlo: en su navegador interno la
      // detección da por bueno un canal que después nunca entrega nada, y la
      // fuente se queda congelada en el estado que había al abrirla. Ahí se fuerza
      // el long polling de entrada. Y se usa caché en memoria en vez de
      // IndexedDB, que en OBS es inestable y no aporta nada a una pantalla que
      // solo muestra.
      let _cfgFS;
      if(FORZAR_LONGPOLL){
        _cfgFS={experimentalForceLongPolling:true};
        if(fb.memoryLocalCache)_cfgFS.localCache=fb.memoryLocalCache();
      }else{
        _cfgFS={localCache:fb.persistentLocalCache({tabManager:fb.persistentMultipleTabManager()}),
                experimentalAutoDetectLongPolling:true};
      }
      fbDB=fb.initializeFirestore(app,_cfgFS);
      if(FORZAR_LONGPOLL)console.log('[FB] long polling forzado'+(EN_OBS?' (fuente de navegador de OBS)':''));
    }catch(e){
      fbDB=fb.getFirestore(app); // fallback si ya fue inicializado
    }
    fbAuth=authMod.getAuth(app);
    // ── CANDADO DE PRÁCTICA ──────────────────────────────────────────────
    // En modo práctica (incluida la práctica con nómina real) Firebase queda de
    // SOLO LECTURA: reemplazamos toda función de ESCRITURA del SDK por un no-op.
    // Así, pase lo que pase en el código, la práctica JAMÁS escribe en la base y
    // no puede tocar una competencia real. Las lecturas (getDoc/getDocs/onSnapshot/
    // query/where/collection/doc) siguen intactas.
    if(PRACTICE_MODE){
      const _noWrite=async()=>({id:'practice-noop',_practice:true});
      const _fakeBatch=()=>({set(){return this},update(){return this},delete(){return this},commit:_noWrite});
      window._fb=Object.assign({},fb,{setDoc:_noWrite,updateDoc:_noWrite,addDoc:_noWrite,deleteDoc:_noWrite,setDocs:_noWrite,writeBatch:_fakeBatch,runTransaction:_noWrite});
      const _stNoop=async()=>({ref:{},metadata:{},_practice:true});
      window._fbSt=Object.assign({},storageMod,{uploadBytes:_stNoop,uploadBytesResumable:_stNoop,uploadString:_stNoop,deleteObject:_noWrite});
      console.log('[Práctica] Firebase en SOLO LECTURA — escrituras bloqueadas');
    }else{
      window._fb=fb;
      window._fbSt=storageMod;
    }
    window._fbAuth=authMod;fbReady=true;
    window._fbStInst=storageMod.getStorage(app);
    if(typeof _aplicarEdicionesDB==='function')_aplicarEdicionesDB();  // ediciones del panel sobre el padrón
    if(typeof _setupLcMediaListener==='function')_setupLcMediaListener(); // logos de clubes subidos en el panel
    if(typeof _fotosArrancar==='function')_fotosArrancar();               // fotos: solo si alguna pantalla ya las pidió
    // Récords nacionales vigentes: records/data (lo que guardó el último cierre y
    // lo que edita el panel). La copia de Storage/records.json puede estar atrasada
    // —después del Sudamericano 2026 seguía con la tabla de antes— y el aviso de
    // récord comparaba contra marcas que ya no eran récord.
    if(!TX_MODE)fb.getDoc(fb.doc(fbDB,'records','data')).then(s=>{const r=s.exists()?s.data():null;
      if(r&&(r.classic||r.equipped)){RECORDS=r;window._RECORDS_FS=true;}}).catch(()=>{});
    // Keep LIVE_EVENTS in sync with Firestore eventos
    fb.onSnapshot(fb.collection(fbDB,'eventos'),async (snap)=>{
      const evs={};
      window.LIVE_EVENT_META=window.LIVE_EVENT_META||{};
      window.LIVE_EVENT_HIDDEN=new Set();
      window.LIVE_EVENT_HIDDEN_NAMES=new Set();
      // Competencias habilitadas para el público (admin → YourLift Público). El
      // espectador solo ve estas: nunca la lista completa de lo que hay cargado.
      window.LIVE_EVENT_PUB=new Set();
      const activeIds=[];
      snap.docs.forEach(d=>{
        const e=d.data();
        // "Visible para el público" y "visible en el livecast" son dos interruptores
        // distintos: el primero es lo que ve la gente en Competencia en Vivo, el
        // segundo es si aparece en la lista del operador. Se lee ANTES de la salida
        // por archivado, porque si no un campeonato archivado pero publicado (el
        // Sudamericano es justo eso) dejaba al público sin nada que ver.
        if(e.publicoVisible===true){window.LIVE_EVENT_PUB.add(d.id);if(e.name)window.LIVE_EVENT_PUB.add(e.name);}
        const _oculto=(e.status==='archived'||e.livecastVisible===false);
        if(_oculto){
          window.LIVE_EVENT_HIDDEN.add(d.id);
          if(e.name){
            window.LIVE_EVENT_HIDDEN_NAMES.add(e.name);
            // Un campeonato que se corrió en dos tarimas quedó en Firestore como
            // "<nombre> - Tarima 1" y "- Tarima 2", pero en nominas.json sigue con
            // el nombre solo. Sin esto ese nombre suelto no calzaba con nada y
            // aparecía en la lista como si estuviera activo (le pasó al de
            // Debutantes, ya archivado).
            const _base=String(e.name).replace(/\s*[—–-]\s*Tarima\s*\d+\s*$/i,'');
            if(_base&&_base!==e.name)window.LIVE_EVENT_HIDDEN_NAMES.add(_base);
          }
        }
        // Archivado = fuera de la lista del operador y de los conteos.
        if(!_oculto){ evs[d.id]=e.name; activeIds.push(d.id); }
        const recordsEnabled=(typeof e.recordsEnabled==='boolean')
          ? e.recordsEnabled
          : !/universitar/i.test(e.name||'');
        // Pero archivado Y publicado para el público es un caso real —el
        // Sudamericano es justo eso— y sus datos SÍ se registran acá.
        //
        // Antes salía de esta función antes de llegar a este punto, y por eso un
        // link ?evento=<id> a un campeonato archivado solo se podía resolver si
        // nominas.json llegaba a tiempo: si el teléfono andaba lento, se acababa
        // la espera y la persona terminaba en la lista —donde tampoco aparece,
        // por archivado— viendo "NO HAY COMPETENCIAS EN VIVO" con el campeonato
        // a tres días de correrse. De acá salen además los logos de la pantalla
        // de tarima y el detector de récords, que por lo mismo tampoco le
        // llegaban.
        if(!_oculto||e.publicoVisible===true){
          window.LIVE_EVENT_META[d.id]={name:e.name,recordsEnabled,youtubeUrl:e.youtubeUrl||'',athleteCount:0,logoUrl:e.logoUrl||'',logoFedUrl:e.logoFedUrl||'',logosPantalla:Array.isArray(e.logosPantalla)?e.logosPantalla:[]};
        }
        if((!_oculto||e.publicoVisible===true)&&DATA.event&&(DATA.event.id===d.id||DATA.event.name===e.name)){
          DATA.event.recordsEnabled=recordsEnabled;
          // El logo se BORRA solo si viene del documento exacto de este
          // campeonato. Por nombre pueden calzar dos documentos —el del
          // campeonato y alguna copia con el mismo nombre—, y el que llegara
          // último con el campo vacío dejaba a DATA.event sin logo: por eso
          // había que volver a subirlo cada vez que se entraba a Control TX.
          const _mismoDoc=(DATA.event.id===d.id);
          if(e.logoUrl||_mismoDoc)DATA.event.logoUrl=e.logoUrl||'';
          if(e.logoFedUrl||_mismoDoc)DATA.event.logoFedUrl=e.logoFedUrl||'';
          if(Array.isArray(e.logosPantalla)||_mismoDoc)DATA.event.logosPantalla=Array.isArray(e.logosPantalla)?e.logosPantalla:[];
          // Qué logo va en el barrido de transición. Por defecto, el del
          // campeonato: es su momento en pantalla. Solo si alguien eligió a
          // propósito el de YourLift se usa ese.
          DATA.event.barridoLogo=e.barridoLogo==='yourlift'?'yourlift':'campeonato';
        }
      });
      if(Object.keys(evs).length)LIVE_EVENTS=evs;
      // Si cambió el link de la transmisión del campeonato que se está mirando,
      // se refleja al toque y sin recargar: son ocho días con una transmisión
      // por día, y pegar el link en el admin tiene que ser todo el trabajo.
      try{
        const _yt=_ytLinkActual();
        if(_yt!==window._ytUltLink){ window._ytUltLink=_yt; R(); }
      }catch(e){}
      window._EVENTOS_LISTA=true;
      if(DATA.phase==='setup'&&DATA.events.length>0)R();
      // El link (?evento=…) se resuelve apenas llega la lista de campeonatos,
      // también si ya se había dado por perdido: en un teléfono lento Firestore
      // puede tardar más que la espera, y la persona quedaba en la lista.
      if(!window._autoEvtTried||(window._EV_URL_PEND&&(window._EV_ESPERANDO||_evUrlPendiente()))){
        window._autoEvtTried=true;_applyEvtRetries=0;
        try{applyEventURLParam()}catch(e){console.warn('[LC] auto-pick',e)}
      }
      // Cuántos atletas tiene cada campeonato, para la lista de elección.
      //
      // Antes se bajaban TODAS las inscripciones de cada campeonato activo —cientos
      // de documentos— en cada apertura del livecast, también en cada televisor y
      // en cada widget de OBS, y de nuevo con cada cambio en cualquier campeonato
      // (pegar el link de YouTube del día bastaba). Era una de las mayores fuentes
      // de lecturas de Firestore. Ahora: solo donde la lista se puede ver (no en
      // los widgets), solo el número (Firestore cobra una lectura por cada mil
      // inscripciones contadas) y como mucho una vez cada diez minutos por
      // campeonato, guardado en el equipo.
      if(!TX_MODE)_contarAtletasEventos(fb,activeIds);
    });
    // Check if already logged in (session persists)
    // _AUTH_LISTO: ya se sabe si quien abrió la página es admin o público. El
    // link de un campeonato (?evento=…) espera a saberlo antes de entrar: si no,
    // el admin entraba como espectador (ver applyEventURLParam).
    authMod.onAuthStateChanged(fbAuth,(u)=>{
      if(u){
        // Verify this user is an admin in Firestore
        fb.getDoc(fb.doc(fbDB,'admins',u.uid)).then(snap=>{
          window._AUTH_LISTO=true;
          if(snap.exists()){
            isAdmin=true;
            try{_padronPrivadoLC();}catch(e){}   // RUT del padrón, que el público no ve
            window.ADMIN_ROLE=(__o=>__o==null?void 0:__o.role)(snap.data())||'admin';
            // Auto-controller SOLO la primera vez (sin preferencia guardada). Si el
            // usuario eligió "Espectador" (yl_controller='0'), se respeta — así un 2º
            // PC puede ser solo lectura y espejar al controlador.
            if(localStorage.getItem('yl_controller')===null){
              window.IS_CONTROLLER=true;
              try{localStorage.setItem('yl_controller','1')}catch(e){}
              console.log('[LiveCast] Admin · Modo CONTROLADOR activado (primera vez)');
            } else {
              console.log('[LiveCast] Admin · Modo',window.IS_CONTROLLER?'CONTROLADOR':'ESPECTADOR');
            }
            // ?remote=1: aterrizar en el Control Remoto (para el teléfono)
            if(WANT_REMOTE && window._canAccess('remote') && DATA.phase!=='remote'){DATA.phase='remote';}
          } else if(window._ensayoFree){
            // ENSAYO abierto: el usuario anónimo no es admin en Firestore, pero
            // el ensayo se opera sin sesión — se mantiene el rol local.
            console.log('[LiveCast] Ensayo abierto · usuario anónimo');
          } else {
            isAdmin=false;
            console.log('[LiveCast] Logged in but not admin:',u.email);
          }
          R();
        }).catch((err)=>{
          // Este respaldo existe para que una caída de red en pleno campeonato no
          // deje al controlador sin poder operar. Pero "permiso denegado" no es una
          // caída de red: es el servidor diciendo que NO es admin. Las reglas solo
          // dejan leer admins/{uid} a un admin, así que una cuenta de juez rebotaba
          // acá y salía con acceso completo — al revés de lo que se buscaba.
          const negado=err&&(err.code==='permission-denied'||/permission/i.test(err.message||''));
          window._AUTH_LISTO=true;
          if(negado){
            isAdmin=false; window.ADMIN_ROLE=null;
            console.log('[LiveCast] Sesión sin permisos de admin (¿cuenta de juez?)');
            R(); return;
          }
          isAdmin=true;window.ADMIN_ROLE='admin';
          if(localStorage.getItem('yl_controller')===null){window.IS_CONTROLLER=true;try{localStorage.setItem('yl_controller','1')}catch(e){}}
          R();
        });
      } else {
        window._AUTH_LISTO=true;
        if(isAdmin&&!window._ensayoFree){isAdmin=false;DATA.phase='liveView';R();}
      }
    });
    console.log('[FB] Firebase ready');
    _ensayoGrant(); // por si la sesión restaurada ya es el ensayo (login anónimo)
    if(DATA.event)startFBSync();
    // If redirected back from admin.html after login
    if(sessionStorage.getItem('livecast_return')){
      sessionStorage.removeItem('livecast_return');
    }
  }catch(e){
    console.warn('[FB] Init failed',e);
    // Sin Firebase no va a llegar la lista de campeonatos ni la sesión: el link
    // (?evento=…) no tiene nada más que esperar y se resuelve con lo que haya.
    window._EVENTOS_LISTA=true; window._AUTH_LISTO=true;
  }
}

function fbDocId(){
  if(!DATA.event)return null;
  // Sale del nombre del campeonato (compartido/canales.js): dos campeonatos a la
  // misma hora escriben documentos distintos. Si está en modo 2 tarimas
  // (?tarima=1 o ?tarima=2), cada tarima usa además su propio doc.
  return YLCanal.deEvento(DATA.event.name,TARIMA);
}

// Sufijo para docs auxiliares (record alerts, director scene) cuando hay 2 tarimas
// → cada tarima maneja sus widgets sin pisar a la otra.
function txDocId(base){return TARIMA?`${base}_T${TARIMA}`:base;}

// Las luces de los jueces y la señal del cronómetro. Antes el id era FIJO
// ('current', o 'current_T1' con dos tarimas): dos campeonatos corriendo a la
// misma hora compartían las luces, y el juez de uno encendía la pantalla del
// otro. Ahora va por campeonato (y por tarima), igual que el director y los
// récords: 'current__<campeonato>'. El link de los jueces lleva ese canal.
function juezDocId(){return YLCanal.jueces(fbDocId(),TARIMA);}

// Id de los docs de ESTADO de transmisión (director, record) — separado POR EVENTO
// (y por tarima si aplica). Así dos competencias DISTINTAS y simultáneas no se pisan:
// cada evento tiene su propio director/record. Control y widget calculan el mismo id
// porque ambos usan fbDocId() (basado en el nombre del evento). Si no hay evento, cae
// al id viejo (compatibilidad).
function evStateDocId(base){const ev=fbDocId();return ev?(base+'__'+ev):txDocId(base);}

// Firma liviana de la competencia (cuántas decisiones y suma de pesos). Sirve
// para detectar si esta pantalla EDITÓ algo que no se está guardando.
function _dataSig(){
  let n=0,s=0;
  (DATA.athletes||[]).forEach(a=>{['sq','bp','dl'].forEach(l=>{
    ((a.att&&a.att[l])||[]).forEach(x=>{ if(x){ s+=(x.w||0); if(x.r)n++; } });
  })});
  return n+'|'+Math.round(s*10);
}

// Aviso cuando se editan datos estando en modo ESPECTADOR (no escribe nada).
function _spectatorEditAlert(){
  let el=document.getElementById('spectModeBanner');
  if(!el){
    el=document.createElement('div'); el.id='spectModeBanner';
    el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:100000;background:#b45309;color:#fff;padding:9px 14px;font-family:Oswald,sans-serif;font-size:13px;letter-spacing:.5px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.5)';
    document.body.appendChild(el);
  }
  el.innerHTML='EST\u00c1S EN MODO ESPECTADOR \u2014 lo que cargas NO se guarda ni lo ve nadie. '
    +'<button onclick="setSyncMode(true)" style="margin-left:8px;padding:4px 14px;border-radius:6px;border:none;background:#fff;color:#b45309;font-family:Oswald;font-size:12px;font-weight:700;cursor:pointer">CAMBIAR A CONTROLADOR</button>';
}

function _spectatorEditOk(){ const el=document.getElementById('spectModeBanner'); if(el)el.remove(); }

// Banner rojo fijo cuando las escrituras a Firebase fallan: sin esto el operador
// sigue cargando pesos creyendo que todo va bien mientras el espectador ve datos
// viejos. Se quita solo en cuanto una escritura vuelve a salir bien.
function _syncWriteAlert(e){
  const code=(e&&e.code)||'';
  const perm=/permission|PERMISSION/i.test(code+' '+((e&&e.message)||''));
  let el=document.getElementById('syncErrBanner');
  if(!el){
    el=document.createElement('div'); el.id='syncErrBanner';
    el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:100000;background:#C41E3A;color:#fff;padding:8px 14px;font-family:Oswald,sans-serif;font-size:13px;letter-spacing:.5px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.5)';
    document.body.appendChild(el);
  }
  el.innerHTML='LOS CAMBIOS NO SE ESTÁN GUARDANDO — el espectador y OBS no ven lo que cargas.'
    +(perm?' <b>Inicia sesión con tu cuenta de administrador.</b>':' Revisa la conexión a internet.')
    +' <span style="opacity:.85;font-size:11px">(se reintenta solo)</span>';
}

function _syncWriteOk(){ const el=document.getElementById('syncErrBanner'); if(el)el.remove(); window._syncFallo=0; window._syncFalloMsg=''; }

// ── El semáforo: se ve que está en verde ─────────────────────────────────────
//
// Los dos avisos de arriba son carteles que aparecen cuando algo se rompe, y
// eso deja al operador sin forma de comprobar que va bien: no ver el cartel rojo
// puede significar que todo se está guardando, o que el aviso tampoco funciona.
// Quien opere el Sudamericano no va a conocer el sistema, y necesita algo que
// mirar y saber, sin preguntarle a nadie, que lo que carga está llegando.
//
// Por eso este es un semáforo permanente y no un aviso: está siempre puesto, y
// el "hace N segundos" que va subiendo es la prueba de que sigue vivo. Un cartel
// que no aparece no prueba nada; un número que corre, sí.
//
// Va solo en las pantallas donde alguien opera. En los televisores y en los
// widgets de OBS no pinta nada: ahí nadie puede arreglar lo que diga.
// Verde quiere decir UNA cosa: lo que hay en esta pantalla es lo que está
// viendo el público. No que la escritura salió — eso solo dice que Firestore la
// aceptó— sino que el documento ya volvió publicado desde el servidor, que es el
// mismo que leen la web pública, los televisores y OBS.
function _syncEstado(){
  if(!window.IS_CONTROLLER) return {c:'#8A9BB2',t:'SOLO MIRAS',d:'lo que cargues acá no se guarda'};
  if(window._syncFallo)     return {c:'#C41E3A',t:'NO SE ESTÁ GUARDANDO',d:'reintentando solo'};
  let pend=false;
  try{ pend=_syncInFlight||_syncPending||(_dataSig()!==window._lastSyncedSig); }catch(e){}
  if(pend)                  return {c:'#D4A843',t:'GUARDANDO…',d:''};
  // Escrito pero todavía sin volver: durante un par de segundos es lo normal.
  // Si se queda pegado acá, es que la escritura salió pero no está llegando de
  // vuelta, y entonces el público está viendo algo más viejo que esta pantalla.
  if(window._pubPendiente){
    const e=Math.round((Date.now()-(_fbLastOk||Date.now()))/1000);
    return e>8
      ? {c:'#C41E3A',t:'EL PÚBLICO VE ALGO VIEJO',d:'guardado, pero sin confirmar hace '+e+' s'}
      : {c:'#D4A843',t:'PUBLICANDO…',d:''};
  }
  if(!_fbLastOk)            return {c:'#8A9BB2',t:'SIN CAMBIOS TODAVÍA',d:'apenas cargues algo se publica'};
  // Que hayan pasado minutos sin escribir NO es un problema: es que nadie tocó
  // nada. Lo que importa es que no quede nada sin publicar, y eso ya se comprobó.
  const s=Math.round((Date.now()-(window._pubUltimo||_fbLastOk))/1000);
  return {c:'#22c55e',t:'EL PÚBLICO LO VE',d:'al día · hace '+(s<60?s+' s':Math.round(s/60)+' min')};
}

function _syncPintaSemaforo(){
  // Ni en los televisores ni en OBS: ahí nadie puede hacer nada con esto.
  if(TX_MODE||PRACTICE_MODE||!isAdmin){
    const v=document.getElementById('syncPill'); if(v)v.remove();
    return;
  }
  let el=document.getElementById('syncPill');
  if(!el){
    el=document.createElement('div'); el.id='syncPill';
    el.title='Estado de la sincronización con el servidor';
    el.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99998;display:flex;align-items:center;gap:9px;'
      +'background:rgba(8,16,30,.93);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:8px 15px 8px 12px;'
      +'font-family:Oswald,sans-serif;font-size:12px;letter-spacing:1px;color:#E8EEF6;'
      +'box-shadow:0 3px 14px rgba(0,0,0,.5);pointer-events:none;backdrop-filter:blur(6px)';
    el.innerHTML='<span id="syncPillDot" style="width:9px;height:9px;border-radius:50%;flex:none"></span>'
      +'<span><span id="syncPillTxt" style="font-weight:700"></span>'
      +'<span id="syncPillSub" style="opacity:.6;font-weight:400;letter-spacing:.3px"></span></span>';
    document.body.appendChild(el);
  }
  const e=_syncEstado();
  const dot=document.getElementById('syncPillDot');
  const txt=document.getElementById('syncPillTxt');
  const sub=document.getElementById('syncPillSub');
  if(dot){ dot.style.background=e.c; dot.style.boxShadow='0 0 8px '+e.c; }
  if(txt){ txt.textContent=e.t; txt.style.color=e.c; }
  if(sub) sub.textContent=e.d?' · '+e.d:'';
}

// Tras un fallo definitivo se vuelve a intentar solo. Antes se quedaba esperando
// a que el operador tocara algo: con una caída corta de wifi, el cartel rojo se
// quedaba puesto aunque la conexión ya hubiera vuelto.
function _reintentarSync(){
  if(_reintentoTO)return;
  _reintentoTO=setTimeout(()=>{ _reintentoTO=null; try{ syncToFB(); }catch(e){} },4000);
}

async function syncToFB(){
  if(!fbReady||!window._fb||!fbDB||!isAdmin||_fbSyncing)return;
  if(!window.IS_CONTROLLER){
    // Modo ESPECTADOR: esta pantalla no escribe. Si además se están EDITANDO datos
    // (pesos/decisiones cambiaron respecto de lo último sincronizado), se avisa —
    // antes fallaba en silencio y el operador cargaba pesos que no llegaban a
    // nadie. Una pantalla espectadora que solo mira nunca dispara el aviso.
    try{ if(isAdmin && _dataSig()!==window._lastSyncedSig) _spectatorEditAlert(); }catch(e){}
    return;
  }
  // Si ya hay una escritura en curso, NO se descarta este cambio: se marca como
  // pendiente y se vuelve a escribir al terminar. (Antes se hacía `return` y el
  // cambio se perdía para siempre — cargando pesos rápido, o con la red lenta,
  // el espectador se quedaba sin ver lo último.) El payload se arma de cero en
  // cada intento, así una sola escritura final ya lleva todo el estado al día.
  // Canal rápido: sale YA, aunque la escritura completa anterior siga viajando.
  _flashEscribir();
  if(_syncInFlight){_syncPending=true;return;}
  const id=fbDocId();if(!id)return;
  _fbLastWrite=Date.now();
  // Reintenta con backoff ante fallos transitorios (ej. contención con varios
  // controladores o cortes de red). Reconstruye el payload en cada intento para no
  // escribir datos viejos. Nunca lanza: un fallo de escritura no debe caer la app.
  _syncInFlight=true;
  try{
    const ref=window._fb.doc(fbDB,'livecast_sync',id);
    // 5 intentos con espera creciente (0.3s → 4.8s). En un gimnasio el wifi se
    // cae de a ratos y con 3 intentos cortos la escritura se daba por perdida
    // enseguida; así aguanta un bache de varios segundos sin molestar a nadie.
    for(let attempt=0;attempt<5;attempt++){
      try{
        // Con VISTA LIBRE esta pantalla no publica su cursor: manda el último que
        // vio de la tarima. Si no, al guardar un peso arrastraría a la tarima, a
        // los widgets y al público hasta donde está mirando ella.
        const _nv=(window.NAV_LIBRE&&window._NAV_REMOTA)||null;
        const _mkPayload=(ath)=>({event:DATA.event,athletes:_jsonAth(ath||DATA.athletes),
          lift:(_nv&&_nv.lift)||DATA.lift,
          round:(_nv&&typeof _nv.round==='number')?_nv.round:DATA.round,
          flight:(_nv&&_nv.flight)||DATA.flight,
          changeTimers:JSON.stringify(DATA.changeTimers),lotsGenerated:DATA.lotsGenerated||false,
          timer:DATA.timer,timerOn:DATA.timerOn,timerStartedAt:DATA.timerStartedAt||0,relojVisible:!!DATA.relojVisible,
          forcedCurrent:_nv?(_nv.forcedCurrent||null):(DATA.forcedCurrent||null),
          compTimer:DATA.compTimer||null,ts:Date.now(),tsAth:Date.now(),writer:window._WRITER_ID});
        // Huella de lo que se va a escribir, sin la hora ni el firmante: si es
        // idéntica a la última confirmada, no se escribe. Cada escritura le
        // reparte el documento ENTERO a todas las pantallas, así que repetir una
        // igual es puro gasto de red — y contención al pedo.
        //
        // Cuánto pesa ese documento depende de cuántos atletas tenga cargados el
        // evento: son ~600 bytes por atleta. Un regional de 74 son ~45 KB; el
        // Sudamericano abierto entero, con sus 431, son ~260 KB. Firestore corta
        // en 1 MiB, así que ninguno se acerca — pero esos 260 KB viajan a CADA
        // pantalla en CADA escritura, y por eso conviene abrir la jornada del día
        // y no el evento completo cuando el campeonato se corre por sesiones.
        // `timerStartedAt` SÍ entra: reiniciar el reloj para el atleta siguiente
        // no cambia nada más, y si se saltea esa escritura las otras pantallas
        // siguen descontando desde el arranque viejo.
        const _huella=(p)=>{const {ts,tsAth,writer,timer,...r}=p;return JSON.stringify(r);};
        // Ediciones que estoy por confirmar (se limpian solo si la escritura sale bien)
        const sent=[...(window._pendingEdits||[])];
        // Y en qué versión estaba cada una. Si se vuelve a tocar mientras esta
        // escritura viaja (válido y enseguida nulo), al terminar NO se da por
        // guardada: lo que se mandó era la versión anterior. Antes se borraba la
        // marca igual, la corrección quedaba como "ya escrita", la siguiente
        // escritura tomaba la casilla del servidor —el válido— y el público y las
        // demás pantallas se quedaban con el válido mientras la mesa veía nulo.
        const _verEsta={}; sent.forEach(k=>{ _verEsta[k]=(window._pendVer||{})[k]; });
        const _soltar=()=>sent.forEach(k=>{ try{ if((window._pendVer||{})[k]===_verEsta[k]) window._pendingEdits.delete(k); }catch(_){} });
        // Lo que se va a mandar, CONGELADO acá.
        //
        // Esto arregla la pérdida de pesos que se veía cargando rápido: "pongo
        // tres y queda uno". Antes, al terminar el `await`, se daba por escrita
        // la huella de _mkPayload() llamado DE NUEVO — o sea, del estado en ese
        // instante, que ya incluía lo que el operador había cargado mientras la
        // escritura viajaba. Eso marcaba como guardado algo que nunca se mandó, y
        // el reintento pendiente comparaba huellas, las encontraba iguales y no
        // escribía. El peso se perdía sin un solo error por pantalla.
        //
        // Congelando el payload, lo que se da por escrito es exactamente lo que
        // se escribió, y cualquier cambio posterior tiene una huella distinta:
        // el reintento lo ve y lo manda.
        const _pay=_mkPayload();
        let _athJson=_pay.athletes;   // lo que queda en el servidor, para el canal rápido
        const _huellaEsta=_huella(_pay);
        const _sigEsta=_dataSig();
        // Operaciones AUTORITATIVAS (reiniciar datos, borrar atletas, regenerar
        // lotes): el estado local MANDA y debe reemplazar al remoto. Si se mergeara,
        // el remoto (que todavía tiene los datos viejos) los devolvería y el reinicio
        // nunca llegaría al público.
        if(window._forceFullWrite){
          // Cada casilla sale con la hora de ahora: lo que todavía ande viajando
          // de antes del reinicio (de otra mesa, del canal rápido) es más viejo y
          // ya no le puede ganar a esto en ninguna pantalla.
          try{ const T=Date.now(); (DATA.athletes||[]).forEach(a=>['sq','bp','dl'].forEach(l=>((a&&a.att&&a.att[l])||[]).forEach(at=>{
            if(!at)return; at.t=Math.max(T,(at.t||0)+1); at.tw=at.tr=at.t; at._pw=at.w; at._pr=at.r==null?null:at.r; }))); }catch(_){}
          Object.assign(_pay,_mkPayload());
          _athJson=_pay.athletes;
          _pay.autoritativo=window._ultAutoritativo=window._WRITER_ID+':'+Date.now();
          await window._fb.setDoc(ref,_pay);
          window._forceFullWrite=false;
        }else if(_huellaEsta===window._ultHuella){
          // Nada cambió desde la última escritura confirmada: no se escribe.
          // Pero lo pendiente igual se suelta: si quedaba una marca de algo que
          // no viaja en el payload, se quedaba ahí para siempre y esta pantalla
          // no volvía a dar por guardado nada.
          _soltar();
          window._lastSyncedSig=_sigEsta;
          _fbLastOk=Date.now(); _syncWriteOk();
          return;
        }else if(window._fb.runTransaction && !PRACTICE_MODE){
          // TRANSACCIÓN: lee el estado actual, le aplica MIS cambios y escribe, todo
          // atómico. Con varios controladores esto elimina el "lost update" clásico
          // (dos PCs escribiendo el documento completo y el último pisando al otro).
          await window._fb.runTransaction(fbDB, async (tx)=>{
            const snap=await tx.get(ref);
            let ath=DATA.athletes;
            if(snap.exists()){
              try{ ath=_mergeForWrite(DATA.athletes, JSON.parse(snap.data().athletes||'[]')); }catch(_){}
            }
            // Los atletas van mergeados con lo remoto, pero el resto del payload
            // es el congelado: el cursor y el reloj que se mandan son los del
            // momento en que se decidió escribir.
            _athJson=_jsonAth(ath);
            tx.set(ref,Object.assign({},_pay,{athletes:_athJson}));
          });
        }else{
          await window._fb.setDoc(ref,_pay);
        }
        _soltar();
        window._lastSyncedSig=_sigEsta;
        window._ultHuella=_huellaEsta;
        try{ _flashFijarBase(JSON.parse(_athJson)); }catch(_){}
        _fbLastOk=Date.now();
        // Escrito y aceptado, pero todavía no consta que haya salido publicado:
        // eso lo dice el eco cuando el servidor devuelve este mismo documento.
        // Hasta entonces el semáforo no da verde.
        window._pubPendiente=true;
        _syncWriteOk(); _spectatorEditOk();
        return;
      }catch(e){
        if(attempt===4){
          console.warn('[FB] Sync write error (tras reintentos)',e);
          // Aviso VISIBLE: que el operador se entere de que lo que carga NO está
          // llegando al espectador/OBS, en vez de descubrirlo tarde.
          window._syncFallo=Date.now();
          // El mensaje del servidor decide qué se le dice al operador: permisos y
          // conexión se arreglan de maneras distintas.
          window._syncFalloMsg=String((e&&(e.code||e.message))||'');
          _syncWriteAlert(e);
          _reintentarSync();          // y se sigue intentando solo
          return;
        }
        await new Promise(r=>setTimeout(r,300*Math.pow(2,attempt)));
      }
    }
  }finally{
    _syncInFlight=false;
    // Si mientras se escribía quedó algo sin mandar, se vuelve a escribir.
    //
    // La marca `_syncPending` la pone quien intentó sincronizar durante el await,
    // y cubre el caso normal. La comparación de firmas es la red debajo: si algún
    // camino cambia un peso o una decisión sin pasar por syncToFB, el cambio se
    // detecta igual y no se queda sin publicar. Cuesta una comparación de texto y
    // evita que un dato se pierda sin que nadie se entere, que es lo caro.
    let quedaAlgo=_syncPending;
    if(!quedaAlgo){ try{ quedaAlgo=(_dataSig()!==window._lastSyncedSig); }catch(e){} }
    if(quedaAlgo){_syncPending=false;setTimeout(()=>{try{syncToFB()}catch(e){}},60);}
  }
}

// Reloj de referencia corregido: cada snapshot trae el `ts` de quien escribió,
// así se mide la diferencia de hora entre esta máquina y la de tarima. Sin esto,
// un equipo con la hora corrida mostraría el descuento adelantado o atrasado.
function _ahora(){ return Date.now()-(window._skewMs||0); }

async function syncTimerOnlyToFB(forzar){
  if(!fbReady||!window._fb||!fbDB||!isAdmin)return;
  if(!window.IS_CONTROLLER)return; // Solo el controller escribe
  if(!window._iOwnTimer)return;    // Solo QUIEN inició el reloj lo refresca.
  // Los demás controladores lo muestran localmente (startTimer(false)) sin escribir
  // → evita 5 escrituras/seg sobre el mismo doc (contención Firestore).
  // El latido cada 10 s ya no se escribe. Cada escritura, aunque cambie solo el
  // reloj, le baja el documento ENTERO de la competencia a cada pantalla abierta
  // —con los 429 atletas del Sudamericano son cientos de KB— y el cronómetro corre
  // casi toda la jornada: era la mayor parte de lo que se pagaba en Firebase.
  // No hace falta: al iniciar, pausar, reiniciar o llegar a cero se escribe con
  // el estado completo (syncToFB), y cada pantalla descuenta sola desde
  // timerStartedAt. Queda solo el camino forzado, por si algún día se necesita.
  if(!forzar)return;
  _ultLatidoTimer=Date.now();
  const id=fbDocId();if(!id)return;
  _fbLastWrite=Date.now();
  try{
    const ref=window._fb.doc(fbDB,'livecast_sync',id);
    await window._fb.updateDoc(ref,{timer:DATA.timer,timerOn:DATA.timerOn,
      timerStartedAt:DATA.timerStartedAt||0,ts:Date.now(),writer:window._WRITER_ID});
  }catch(e){/* silencioso: si el doc no existe el setDoc completo lo crea */}
}

// Los atletas como texto para mandar: sin _pw/_pr, que son anotaciones locales
// de cada pantalla (ver _sellarCeldas) y cada una las rearma al recibir.
function _jsonAth(x){ return JSON.stringify(x,(k,v)=>(k==='_pw'||k==='_pr')?undefined:v); }

function _flashFijarBase(arr){
  const b={}; (arr||[]).forEach(a=>{ if(a&&a.id!=null) b[a.id]=_jsonAth(a); });
  window._flashBase=b;
}

function _flashEscribir(){
  try{
    if(PRACTICE_MODE||!fbReady||!window._fb||!fbDB||!isAdmin||!window.IS_CONTROLLER||_fbSyncing||!DATA.event)return;
    const id=fbDocId(); if(!id)return;
    const base=window._flashBase, lista=DATA.athletes||[];
    let cambios=base?lista.filter(a=>a&&base[a.id]!==_jsonAth(a)):null;
    // Sin base todavía, o demasiados cambios juntos (ej. se regeneró la nómina):
    // se manda la tanda en tarima, que es lo que está mirando todo el mundo.
    if(!cambios||cambios.length>60){
      const nv0=window.NAV_LIBRE&&window._NAV_REMOTA;
      const fl=(nv0&&nv0.flight)||DATA.flight;
      cambios=lista.filter(a=>a&&a.flight===fl);
      if(cambios.length>80)return;
    }
    const nv=(window.NAV_LIBRE&&window._NAV_REMOTA)||null;
    const p={ev:{id:String(DATA.event.id||''),name:String(DATA.event.name||'')},
      ath:_jsonAth(cambios),
      lift:(nv&&nv.lift)||DATA.lift||null,
      round:(nv&&typeof nv.round==='number')?nv.round:(typeof DATA.round==='number'?DATA.round:0),
      flight:(nv&&nv.flight)||DATA.flight||null,
      forcedCurrent:nv?(nv.forcedCurrent||null):(DATA.forcedCurrent||null),
      changeTimers:JSON.stringify(DATA.changeTimers||{}),compTimer:DATA.compTimer||null,
      timer:typeof DATA.timer==='number'?DATA.timer:0,timerOn:!!DATA.timerOn,timerStartedAt:DATA.timerStartedAt||0,relojVisible:!!DATA.relojVisible,
      lotsGenerated:!!DATA.lotsGenerated};
    const h=JSON.stringify(p);
    if(h===_flashUltHuella)return;       // igual a lo último mandado: no se repite
    _flashUltHuella=h;
    p.ts=Date.now(); p.writer=window._WRITER_ID;
    window._fb.setDoc(window._fb.doc(fbDB,'livecast_flash',id),p)
      .catch(e=>{ _flashUltHuella=''; console.warn('[flash] escritura',e&&e.code); });
  }catch(e){ console.warn('[flash]',e); }
}

// Pone lo que trae el canal rápido sobre lo que hay. No dibuja.
function _flashAplicarDatos(d,sinCursor){
  let patch; try{ patch=Array.isArray(d.ath)?d.ath:_normExtraAtts(JSON.parse(d.ath||'[]')); }catch(e){ return; }
  const pm={}, vistos={};
  patch.forEach(a=>{ if(a&&a.id!=null) pm[a.id]=a; });
  const remoto=(DATA.athletes||[]).map(a=>{ if(a&&pm[a.id]){ vistos[a.id]=1; return pm[a.id]; } return a; });
  patch.forEach(a=>{ if(a&&a.id!=null&&!vistos[a.id]) remoto.push(a); });
  // Quien opera conserva las casillas que acaba de tocar (mismo merge que el
  // documento completo); el resto de las pantallas toma lo que llega.
  // Todas las pantallas juntan casilla por casilla (gana lo más nuevo de cada
  // campo). Antes el público reemplazaba el atleta entero con lo que traía el
  // canal rápido, y un parche atrasado de otra mesa le devolvía una decisión ya
  // corregida.
  try{ DATA.athletes=_mergeAthletes(DATA.athletes,remoto); }catch(e){ DATA.athletes=remoto; }
  if(sinCursor)return;
  window._NAV_REMOTA={lift:d.lift||null,round:(typeof d.round==='number')?d.round:null,
    flight:d.flight||null,forcedCurrent:(typeof d.forcedCurrent!=='undefined')?d.forcedCurrent:null};
  const localFresh=(Date.now()-(window._lastLocalAction||0))<2500;
  if(!localFresh){
    try{ DATA.changeTimers=JSON.parse(d.changeTimers||'{}'); }catch(e){}
    DATA.compTimer=typeof d.compTimer!=='undefined'?d.compTimer:null;
    if(!window.NAV_LIBRE){
      DATA.lift=d.lift||DATA.lift;
      DATA.round=typeof d.round==='number'?d.round:DATA.round;
      DATA.flight=d.flight||DATA.flight;
      DATA.forcedCurrent=typeof d.forcedCurrent!=='undefined'?d.forcedCurrent:null;
    }
  }
  DATA.lotsGenerated=!!d.lotsGenerated;
  if(typeof d.timer==='number'){
    DATA.timerOn=d.timerOn||false;
    DATA.relojVisible=!!d.relojVisible;
    if(DATA.timerOn&&d.timerStartedAt){
      DATA.timerStartedAt=d.timerStartedAt;
      DATA.timer=Math.max(0,60-Math.floor((_ahora()-DATA.timerStartedAt)/1000));
    }else DATA.timer=d.timer;
    if(DATA.timerOn&&!mainTI)startTimer(false);
    if(!DATA.timerOn&&mainTI){clearInterval(mainTI);mainTI=null}
  }
}

function _flashAnotar(d,patch){
  const now=Date.now(), P=window._flashPend;
  patch.forEach(a=>{ if(a&&a.id!=null) P.ath[a.id]={a:a,w:d.writer,ts:d.ts,llego:now}; });
  P.cur={d:d,w:d.writer,ts:d.ts,llego:now};
}

// Tras aplicar un documento completo de `w` escrito en `t`: se olvida lo que ese
// documento ya trae y se vuelve a poner encima lo que es más nuevo que él.
function _flashReaplicar(w,t){
  const P=window._flashPend, now=Date.now();
  const vale=e=>e.w===w ? e.ts>t : (now-e.llego)<30000;
  const lista=[];
  Object.keys(P.ath).forEach(k=>{ const e=P.ath[k]; if(vale(e))lista.push(e.a); else delete P.ath[k]; });
  const cur=P.cur&&vale(P.cur)?P.cur.d:null; if(!cur)P.cur=null;
  if(!lista.length&&!cur)return;
  if(cur)_flashAplicarDatos(Object.assign({},cur,{ath:lista}));
  else _flashAplicarDatos({ath:lista},true);
}

function _flashEscuchar(id){
  if(fbFlashUnsub){ try{fbFlashUnsub()}catch(_){} fbFlashUnsub=null; }
  window._flashUlt=null; window._fullUlt=null; window._flashPend={ath:{},cur:null};
  let primero=true;
  fbFlashUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'livecast_flash',id),(snap)=>{
    // El primer envío es lo que quedó guardado de antes (puede ser de hace
    // horas): no se usa. Solo lo que llega en vivo.
    if(primero){ primero=false; return; }
    if(!snap.exists())return;
    const d=snap.data();
    if(!d||!d.writer||d.writer===window._WRITER_ID||typeof d.ts!=='number')return;
    // Hasta que no llegue el documento completo no hay sobre qué aplicarlo.
    const uf=window._fullUlt; if(!uf)return;
    const re=d.ev||{}, le=DATA.event||{};
    const mismo=(re.id&&String(re.id)===String(le.id||''))||(re.name&&String(re.name)===String(le.name||''));
    if(!mismo)return;
    // Ya llegó algo más nuevo del mismo equipo (documento completo o canal local).
    if(uf.w===d.writer&&d.ts<=uf.t)return;
    const lu=window._localUlt; if(lu&&lu.w===d.writer&&d.ts<lu.t)return;
    window._flashUlt=d;
    const firma=()=>JSON.stringify(DATA.athletes||[])+'|'+DATA.lift+'|'+DATA.round+'|'+DATA.flight
      +'|'+(DATA.forcedCurrent==null?'':DATA.forcedCurrent)+'|'+JSON.stringify(DATA.compTimer||null)
      +'|'+(DATA.relojVisible?1:0);
    _fbSyncing=true;
    try{
      const antes=firma();
      let patch; try{ patch=_normExtraAtts(JSON.parse(d.ath||'[]')); }catch(e){ patch=null; }
      if(patch){ _flashAnotar(d,patch); _flashAplicarDatos(Object.assign({},d,{ath:patch})); }
      // Lo que llegó no es una edición de esta pantalla: que no la dé por pendiente.
      try{
        const limpio=!_syncInFlight&&!_syncPending&&!(window._pendingEdits&&window._pendingEdits.size);
        if(limpio)window._lastSyncedSig=_dataSig();
      }catch(e){}
      if(firma()!==antes){
        const f=document.activeElement;
        if(f&&(f.tagName==='INPUT'||f.tagName==='SELECT'||f.tagName==='TEXTAREA')) window._renderPendiente=true;
        else R();
      }
    }catch(e){ console.warn('[flash] lectura',e); }
    _fbSyncing=false;
  },(err)=>{ console.warn('[flash] listener',err&&err.code); fbFlashUnsub=null; });
}

function _soltoElCampo(){
  if(!window._renderPendiente)return;
  const f=document.activeElement;
  if(f&&(f.tagName==='INPUT'||f.tagName==='SELECT'||f.tagName==='TEXTAREA'))return; // sigue editando
  window._renderPendiente=false;
  if(typeof R==='function')R();
}

function startFBSync(){
  if(PRACTICE_MODE)return; // práctica: aislada, NO se suscribe al estado en vivo real
  if(!fbReady)return;
  if(fbUnsub){fbUnsub();fbUnsub=null}
  const id=fbDocId();if(!id)return;
  const ref=window._fb.doc(fbDB,'livecast_sync',id);
  try{ _flashEscuchar(id); }catch(e){ console.warn('[flash]',e); }
  fbUnsub=window._fb.onSnapshot(ref,(snap)=>{
    if(!snap.exists())return;
    _lastFbUpdate=Date.now();
    window._fbSyncRetries=0; // llegó un snapshot OK → reset del backoff de recuperación
    const d=snap.data();
    // Diferencia de hora entre esta máquina y la que escribió. Se usa para el
    // descuento del reloj, que ahora se calcula acá con la hora de arranque.
    if(typeof d.ts==='number'&&d.writer&&d.writer!==window._WRITER_ID){
      const s=Date.now()-d.ts;
      // Solo cuenta un documento recién escrito. El primero que llega al abrir la
      // pantalla es el que quedó guardado —puede tener horas o días—, y tomar esa
      // antigüedad como diferencia de reloj dejaba la hora "común" de esta
      // pantalla días atrás: sus correcciones perdían contra cualquier cambio
      // viejo y los relojes de 60 s salían corridos. Dos relojes de verdad no se
      // separan dos minutos; una muestra así es un documento viejo y se descarta.
      if(Math.abs(s)<=120000)
        window._skewMs=(typeof window._skewMs==='number')?Math.round(window._skewMs*0.7+s*0.3):s;
    }
    // Multi-controlador: ignorar SOLO el eco de mi propia escritura (evita parpadeo),
    // pero SÍ aplicar lo que escribieron los demás controladores → todos sincronizados.
    if(d.writer && d.writer===window._WRITER_ID){
      // Este es mi propia escritura volviendo del servidor. No se aplica —
      // parpadearía— pero vale por sí sola: es el MISMO documento que están
      // leyendo el público, los televisores y OBS. Que haya vuelto prueba que lo
      // que cargué no se quedó en esta pantalla.
      //
      // Sin esto, dar por bueno el `await` de la escritura solo decía que
      // Firestore la aceptó. Esto dice que ya salió publicada.
      window._pubPendiente=false;
      window._pubUltimo=Date.now();
      return;
    }
    // Si hay un campo enfocado, el operador está escribiendo un peso: NO se
    // re-dibuja la pantalla (le borraría lo que está tecleando). Pero los datos
    // sí se aplican igual. Antes acá se descartaba el snapshot COMPLETO, y como
    // Firestore manda cada cambio una sola vez, todo lo que pasara mientras el
    // cursor estaba en una casilla se perdía para siempre en esa pantalla: los
    // válidos y nulos del control remoto, el movimiento, la ronda, la tanda. El
    // dibujo se hace apenas suelta el campo (_soltoElCampo).
    // Llegó algo escrito por OTRO equipo: el servidor ya no tiene lo último que
    // escribí yo, así que "es igual a lo que ya mandé" deja de querer decir "no
    // hace falta escribir". Sin esto, si la otra mesa corregía a nulo y acá se
    // volvía a poner válido —lo mismo que esta mesa había escrito antes—, la
    // escritura se salteaba y el público se quedaba con el nulo.
    window._ultHuella=null; try{ _flashUltHuella=''; }catch(_){}
    const focused=document.activeElement;
    const editando=!!(focused&&(focused.tagName==='INPUT'||focused.tagName==='SELECT'||focused.tagName==='TEXTAREA'));
    _fbSyncing=true;
    try{
      // Detectar si SOLO cambió el timer (eso pasa cada segundo y no debe causar re-render
      // en la vista pública "Competencia en Vivo")
      // La firma decide si vale la pena redibujar. Tiene que incluir TODO lo que
      // cambia lo que se ve, no solo los atletas y el cursor: `forcedCurrent` (marcar
      // a mano el intento actual) y `compTimer` mueven al atleta de tarima sin tocar
      // movimiento, ronda ni tanda, así que sin ellos la firma quedaba igual, no se
      // redibujaba y el Control TX, el perfil y el marcador seguían mostrando al
      // atleta anterior.
      const _firma=()=>JSON.stringify(DATA.athletes||[])+'|'+DATA.lift+'|'+DATA.round+'|'+DATA.flight
        +'|'+(DATA.forcedCurrent==null?'':DATA.forcedCurrent)+'|'+JSON.stringify(DATA.compTimer||null)
        // El reloj de la Planilla aparece y desaparece en las pantallas.
        +'|'+(DATA.relojVisible?1:0);
      const prevSig = _firma();
      DATA.event=d.event||DATA.event;
      // NO pisar lo que acabo de editar localmente si la acción local fue hace <2.5s.
      // Esto cubre: pesos/intentos (DATA.athletes), navegación (lift/round/flight) y
      // change timers. Sin esto, un snapshot entrante de OTRO controlador (p.ej. su tick
      // de timer, que viaja con su copia de athletes) borra el peso recién ingresado
      // ("pongo el número y no sale nada") o me devuelve a SQ / Intento 1 / Tanda A.
      const _localFresh = (Date.now()-(window._lastLocalAction||0))<2500;
      // ¿Esto ya llegó antes, y más nuevo, por el canal local? Pasa en la pantalla
      // de tarima que sale del mismo computador de la planilla: el válido le llega
      // al instante por el canal, y segundos después Firestore le devuelve una
      // escritura ANTERIOR de esa misma planilla. Aplicarla haría ir y volver la
      // pantalla. Se compara contra la hora de los atletas (tsAth), no contra `ts`,
      // porque el latido del reloj actualiza `ts` sin tocar a los atletas.
      // Solo cuenta si es del mismo escritor: mismo reloj, orden garantizado.
      const _lu=window._localUlt;
      const _viejoLocal=!!(_lu&&d.writer&&d.writer===_lu.w&&typeof d.tsAth==='number'&&d.tsAth<_lu.t);
      // Los ATLETAS siempre se mergean por-celda: absorbo los cambios del otro
      // escritor (pesos/resultados en otras casillas) pero conservo las celdas que
      // yo toqué hace <4s. Así varios controladores pueden cargar a la vez sin
      // pisarse. La NAVEGACIÓN (lift/ronda/tanda/changeTimers) sigue con el guard
      // grueso de 2.5s (normalmente la maneja un solo operador de tarima).
      const _remoteAth = _normExtraAtts(JSON.parse(d.athletes||'[]'));
      // ¿El roster que tengo cargado es de ESTE campeonato? Si no, no se mezcla
      // nada: se toma el del servidor tal cual. El merge va por id de atleta, y
      // dos campeonatos distintos usan los mismos ids — mezclarlos metía gente
      // de un evento en el otro (y después la reenviaba al servidor).
      const _mismoEv=(()=>{
        try{
          const re=d.event||{}; const le=DATA.event||{};
          if(!re.name&&!re.id)return true;                 // doc viejo sin evento: como antes
          return String(re.id||'')===String(le.id||'') || String(re.name||'')===String(le.name||'');
        }catch(e){ return true; }
      })();
      if(_mismoEv){
        // Lo que hay en el servidor: el canal rápido manda lo que difiere de esto.
        try{ _flashFijarBase(_remoteAth); }catch(_){}
        window._fullUlt={w:d.writer||'',t:(typeof d.tsAth==='number'?d.tsAth:(d.ts||0))};
      }
      if(_viejoLocal){
        // Nada: ya tiene algo más nuevo de este mismo escritor.
      }else if(d.autoritativo&&d.autoritativo!==window._ultAutoritativo){
        // Reinicio de datos, borrado de atletas, re-sorteo: lo del servidor
        // reemplaza todo lo que haya acá, sin mezclar.
        window._ultAutoritativo=d.autoritativo;
        DATA.athletes=_remoteAth;
        try{ window._flashPend={ath:{},cur:null}; }catch(_){}
        try{ window._recentAtt={}; if(window._pendingEdits)window._pendingEdits.clear(); }catch(_){}
      }else if(!_mismoEv){
        console.warn('[FB] El roster local es de otro campeonato — se toma el del servidor sin mezclar');
        DATA.athletes=_remoteAth;
        try{ window._recentAtt={}; if(window._pendingEdits)window._pendingEdits.clear(); }catch(_){}
      }else{
        try{
          DATA.athletes = _mergeAthletes(DATA.athletes, _remoteAth);
          // Si conservé ediciones mías que no estaban en el remoto, reenvío mi versión
          // para que Firestore (→ Control TX) quede con AMBOS cambios.
          if(window.__mergeOverrode) _scheduleWriteback();
        }catch(e){
          // Ante cualquier problema, fallback al comportamiento anterior (no perder datos)
          if(!_localFresh) DATA.athletes=_remoteAth;
        }
      }
      // El cursor de la tarima se anota SIEMPRE — aunque esta pantalla ande por su
      // cuenta — para poder volver a él y para no pisarlo al escribir.
      if(!_viejoLocal)window._NAV_REMOTA={lift:d.lift||null,
        round:(typeof d.round==='number')?d.round:null,
        flight:d.flight||null,
        forcedCurrent:(typeof d.forcedCurrent!=='undefined')?d.forcedCurrent:null};
      if(!_localFresh&&!_viejoLocal){
        DATA.changeTimers=JSON.parse(d.changeTimers||'{}');
        DATA.compTimer=typeof d.compTimer!=='undefined'?d.compTimer:null;
        // Con vista libre, el movimiento/ronda/tanda de esta pantalla no se toca.
        if(!window.NAV_LIBRE){
          DATA.lift=d.lift||DATA.lift;
          DATA.round=typeof d.round==='number'?d.round:DATA.round;
          DATA.flight=d.flight||DATA.flight;
          DATA.forcedCurrent=typeof d.forcedCurrent!=='undefined'?d.forcedCurrent:null;
        }
      }
      DATA.lotsGenerated=d.lotsGenerated||false;
      // Alinear la firma con lo que acaba de llegar: así el aviso de "modo
      // espectador" solo aparece si ESTA pantalla editó algo por su cuenta.
      // Solo si esta pantalla no tiene nada propio sin mandar: alinear la firma
      // con lo que llega mientras hay ediciones pendientes las daba por guardadas
      // y la pastilla se ponía VERDE con cambios que no habían salido de acá.
      try{
        const _limpio=!_syncInFlight&&!_syncPending
          &&!(window._pendingEdits&&window._pendingEdits.size);
        if(_limpio)window._lastSyncedSig=_dataSig();
      }catch(e){}
      if(typeof d.timer==='number'){
        DATA.timerOn=d.timerOn||false;
        // El reloj del intento en la transmisión y en las pantallas de tarima:
        // solo si lo inició la Planilla (panel de jueces).
        DATA.relojVisible=!!d.relojVisible;
        // Con la hora de arranque, esta pantalla descuenta sola: no necesita que
        // le manden el segundo. Si el documento es viejo y no la trae, se cae al
        // comportamiento anterior (tomar el valor tal cual).
        if(DATA.timerOn&&d.timerStartedAt){
          DATA.timerStartedAt=d.timerStartedAt;
          DATA.timer=Math.max(0,60-Math.floor((_ahora()-DATA.timerStartedAt)/1000));
        }else{
          DATA.timer=d.timer;
        }
        if(DATA.timerOn&&!mainTI)startTimer(false);
        if(!DATA.timerOn&&mainTI){clearInterval(mainTI);mainTI=null}
      }
      // Si el canal rápido ya trajo algo MÁS NUEVO de este mismo equipo, este
      // documento completo viene atrasado: se vuelve a poner lo rápido encima para
      // que la pantalla no vaya y vuelva.
      try{
        if(!_viejoLocal&&_mismoEv) _flashReaplicar(d.writer||'',window._fullUlt.t);
      }catch(_){}
      const newSig = _firma();
      const structuralChange = prevSig !== newSig;
      // Solo re-renderizar si hubo cambio estructural (no solo timer) — evita flicker en vista pública
      if(structuralChange){
        if(editando){ window._renderPendiente=true; }   // se dibuja al soltar el campo
        else R();
      } else {
        // Actualizar solo el timer en pantalla sin re-render
        const tmEls = [];
        const mm = Math.floor(DATA.timer/60), ss = DATA.timer%60;
        const txt = String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0');
        tmEls.forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=txt;});
      }
    }catch(e){console.warn('[FB] Sync read error',e)}
    _fbSyncing=false;
  },(err)=>{
    // El listener se cortó (error terminal). Re-suscribir con backoff para
    // recuperar la conexión sin ciclar ante errores permanentes (permisos).
    console.warn('[FB] Sync listener error',err&&err.code,err&&err.message);
    _fbSyncing=false;
    if(fbUnsub){try{fbUnsub()}catch(_){}}
    fbUnsub=null;
    window._fbSyncRetries=(window._fbSyncRetries||0)+1;
    if(window._fbSyncRetries<=8){
      const delay=Math.min(15000,1500*window._fbSyncRetries);
      setTimeout(()=>{ if(!PRACTICE_MODE && fbReady && DATA.event && !fbUnsub) startFBSync(); },delay);
    }else{
      console.warn('[FB] Sync listener: demasiados reintentos, se detiene la re-suscripción automática');
    }
  });
  console.log('[FB] Listener started for',id);
  _armarVigilante();
}

function _armarVigilante(){
  if(_vigilanteTI)return;
  _vigilanteTI=setInterval(()=>{
    if(PRACTICE_MODE||!fbReady||!DATA.event)return;
    // Pestaña en segundo plano: no gastar. Pero una fuente de OBS se declara
    // "hidden" aunque esté al aire, así que ahí el vigilante tiene que seguir
    // corriendo — es justo la pantalla que nadie mira de cerca para darse cuenta
    // de que se quedó pegada.
    if(!EN_OBS&&document.visibilityState==='hidden')return;
    const silencio=Date.now()-(_lastFbUpdate||0);
    if(silencio>5*60*1000){
      console.warn('[FB] '+Math.round(silencio/1000)+'s sin datos — reconectando');
      _lastFbUpdate=Date.now();                          // no reintentar en bucle
      window._fbSyncRetries=0;
      try{ startFBSync(); }catch(e){ console.warn('[FB] reconexión',e); }
    }
  },60000);
}

// ── Pantallas en el MISMO computador ─────────────────────────────────────
// La pantalla de tarima (?tx=screen) suele salir del mismo computador de la
// planilla, por cable al televisor. Hasta ahora igual esperaba el viaje completo
// a Firestore: escribir el documento con la nómina entera, confirmarlo, y bajarlo
// de vuelta — cinco o seis segundos entre marcar un válido y verlo en la tele.
//
// Entre ventanas del mismo navegador no hace falta ir a ningún lado: la planilla
// avisa cada cambio por un BroadcastChannel y las otras ventanas lo aplican al
// instante. Firestore sigue siendo la fuente de verdad y sigue llegando igual;
// esto solo llega antes. Las pantallas de otros equipos no se enteran de este
// canal y funcionan exactamente como siempre.
function _canalLocal(){
  if(window._ylCanal===undefined){
    try{ window._ylCanal=(!PRACTICE_MODE&&typeof BroadcastChannel==='function')?new BroadcastChannel('yl_livecast_local'):null; }
    catch(e){ window._ylCanal=null; }
  }
  return window._ylCanal;
}

function _avisoLocal(){
  const c=_canalLocal();
  // Una pantalla de tarima nunca avisa: solo escucha. Ojo que en el computador
  // de la planilla también se cree controladora —la marca vive en localStorage,
  // que comparten todas las pestañas—, así que no alcanza con mirar esa marca.
  if(!c||TX_MODE||!isAdmin||!window.IS_CONTROLLER||!DATA.event)return;
  // Mismo cursor que se manda a Firestore: con vista libre, el de la tarima y
  // no el de lo que esta pantalla está mirando.
  const nv=(window.NAV_LIBRE&&window._NAV_REMOTA)||null;
  try{
    c.postMessage({t:Date.now(),w:window._WRITER_ID,doc:fbDocId(),
      athletes:DATA.athletes,
      lift:(nv&&nv.lift)||DATA.lift,
      round:(nv&&typeof nv.round==='number')?nv.round:DATA.round,
      flight:(nv&&nv.flight)||DATA.flight,
      forcedCurrent:nv?(nv.forcedCurrent||null):(DATA.forcedCurrent||null),
      changeTimers:DATA.changeTimers||{},compTimer:DATA.compTimer||null,
      lotsGenerated:!!DATA.lotsGenerated});
  }catch(e){ console.warn('[local] aviso',e); }
}

function save(){if(PRACTICE_VIEWER)return;if(!_fbSyncing)window._lastLocalAction=Date.now();try{localStorage.setItem(SAVE_KEY,JSON.stringify({phase:DATA.phase,event:DATA.event,athletes:DATA.athletes,lift:DATA.lift,round:DATA.round,flight:DATA.flight,changeTimers:DATA.changeTimers,lotsGenerated:DATA.lotsGenerated,forcedCurrent:DATA.forcedCurrent||null,compTimer:DATA.compTimer||null}))}catch(e){}try{_histCommit()}catch(e){}if(!_fbSyncing)_avisoLocal();if(!_fbSyncing)debouncedSync()}

// 800 ms era mucho: en competencia cada cambio esperaba casi un segundo antes de
// salir del equipo, y recién ahí viajaba a la tarima y al público. Se baja a 150,
// que sigue juntando ráfagas de cambios en una sola escritura (el guard de
// _syncInFlight/_syncPending ya impide que se pisen) pero deja de notarse.
function debouncedSync(){if(_syncTimer)clearTimeout(_syncTimer);_syncTimer=setTimeout(()=>{syncToFB();_syncTimer=null},150)}

function saveNow(){if(PRACTICE_VIEWER)return;if(!_fbSyncing)window._lastLocalAction=Date.now();try{localStorage.setItem(SAVE_KEY,JSON.stringify({phase:DATA.phase,event:DATA.event,athletes:DATA.athletes,lift:DATA.lift,round:DATA.round,flight:DATA.flight,changeTimers:DATA.changeTimers,lotsGenerated:DATA.lotsGenerated,forcedCurrent:DATA.forcedCurrent||null,compTimer:DATA.compTimer||null}))}catch(e){}try{_histCommit()}catch(e){}if(!_fbSyncing)_avisoLocal();syncToFB()}

// Si la dirección nombra un campeonato (?evento=…), esta pantalla arranca
// LIMPIA: no se restaura lo que quedó guardado de una visita anterior.
//
// Es el caso del QR del público. Antes se restauraba primero y se resolvía el
// link después, y de esa carrera salían todas las formas de terminar en el
// campeonato equivocado: verlo un rato y que cambiara, quedarse en él si el
// link tardaba, o terminar en una lista que no llevaba a ninguna parte. Y para
// decidir si lo guardado era "el mismo campeonato" había que comparar nombres
// contra ids, que es justo lo que no se puede hacer bien.
//
// Arrancando limpia no hay nada que comparar: manda el link. No se pierde
// trabajo, porque lo que está cargado en una competencia vive en el servidor y
// vuelve solo al entrar —es lo mismo que pasa hoy al cambiar de campeonato
// desde la lista—. Sin ?evento= todo sigue igual que siempre.
function _linkPideCampeonato(){
  try{ return !!TX_URL.get('evento'); }catch(e){ return false; }
}

function load(){
  if(_linkPideCampeonato()&&!TX_MODE)return false;
  try{const s=localStorage.getItem(SAVE_KEY);if(s){const d=JSON.parse(s);if(d.phase&&d.phase!=='setup'){d.timerOn=false;d.timer=60;Object.assign(DATA,d);_normExtraAtts(DATA.athletes);return true}}}catch(e){}return false}

// Un 4º intento puede llegar SIN la marca `extra`: lo guardó una versión anterior,
// o entró desde otro control. Sin esa marca la fila del intento extra no se dibujaba
// en Control en Vivo, así que el intento quedaba colgado — se veía en Resultados
// (columna BP4*) y no había desde dónde borrarlo. Se marca al entrar, y de ahí en
// más todo lo trata igual que a un 4º intento normal (incluido el 🗑 del menú ⋮).
function _normExtraAtts(list){
  (list||[]).forEach(a=>{
    ['sq','bp','dl'].forEach(l=>{
      const arr=a&&a.att&&a.att[l];
      if(Array.isArray(arr)&&arr.length>=4&&arr[3]&&!arr[3].extra)arr[3].extra=true;
    });
  });
  _sellarCeldas(list);
  return list;
}

// Anota en cada casilla el peso y la decisión que tiene ahora (_pw, _pr), sin
// ponerle hora. Así, al editarla, _markAtt sabe QUÉ cambió —el peso, la
// decisión o los dos— y le pone hora solo a eso. Sin el sello, la primera
// decisión de una casilla le ponía hora también al peso, y ese peso viejo le
// ganaba a un cambio de peso hecho en otro equipo un segundo antes.
function _sellarCeldas(list){
  (list||[]).forEach(a=>{ if(!a||!a.att)return; ['sq','bp','dl'].forEach(l=>{ (a.att[l]||[]).forEach(at=>{
    if(!at)return; if(!('_pw' in at))at._pw=at.w; if(!('_pr' in at))at._pr=at.r==null?null:at.r; }); }); });
}

 // guardar solo las últimas 10 acciones (liviano para la mesa de control)
function _histSnapshot(){
  return JSON.stringify({
    a:DATA.athletes, l:DATA.lift, r:DATA.round, f:DATA.flight,
    fc:DATA.forcedCurrent||null, ct:DATA.compTimer||null
  });
}

// Se llama tras guardar en una acción local. Empuja el estado previo si cambió.
function _histCommit(){
  if(window._histApplying)return;
  if(typeof _fbSyncing!=='undefined' && _fbSyncing)return; // cambios remotos no entran al historial local
  const snap=_histSnapshot();
  if(window._histCur===null){window._histCur=snap;return;} // baseline inicial
  if(snap===window._histCur)return; // nada cambió (ej. tic de reloj)
  window._histUndo.push(window._histCur);
  if(window._histUndo.length>_HIST_MAX)window._histUndo.shift();
  window._histRedo.length=0; // una acción nueva invalida el "rehacer"
  window._histCur=snap;
  _histUpdateButtons();
}

function _histApply(snap){
  const d=JSON.parse(snap);
  // Las casillas que el deshacer cambia cuentan como editadas recién: llevan la
  // hora de ahora y quedan pendientes de escribir. Si no, la escritura partía del
  // servidor (que tenía el valor deshecho) y el deshacer nunca salía de esta
  // pantalla; o volvía solo con el siguiente documento que llegaba.
  const antes={}; (DATA.athletes||[]).forEach(a=>{ if(a&&a.id!=null)antes[a.id]=a; });
  DATA.athletes=d.a;
  try{
    const limpia=c=>{ if(!c)return ''; const {t,tw,tr,_pw,_pr,...r}=c; return JSON.stringify(r); };
    (DATA.athletes||[]).forEach(a=>{
      const v=antes[a.id]; if(!v)return;
      ['sq','bp','dl'].forEach(l=>{
        const n=Math.max(((a.att||{})[l]||[]).length,((v.att||{})[l]||[]).length);
        for(let r=0;r<n;r++){ const c=(a.att[l]||[])[r];
          if(limpia(c)!==limpia(((v.att||{})[l]||[])[r])){ if(c){ delete c._pw; delete c._pr; } _markAtt(a.id,'att_'+l+'_'+r); } }
      });
      if(_MERGE_META_FIELDS.some(f=>JSON.stringify(a[f])!==JSON.stringify(v[f])))_markAtt(a.id,'meta');
    });
  }catch(e){}
  DATA.lift=d.l; DATA.round=d.r; DATA.flight=d.f;
  DATA.forcedCurrent=d.fc||null; DATA.compTimer=d.ct||null;
  window._histApplying=true;
  try{ saveNow(); R(); }
  finally{ window._histApplying=false; }
  _histUpdateButtons();
}

// Actualiza los botones ↶/↷ sin re-render completo (para que no molesten al foco).
function _histUpdateButtons(){
  const bu=document.getElementById('histUndoBtn'), br=document.getElementById('histRedoBtn');
  if(bu){bu.disabled=!window._histUndo.length; bu.style.opacity=window._histUndo.length?'1':'.4'; bu.title='Deshacer (Ctrl+Z) — '+window._histUndo.length+' paso(s)';}
  if(br){br.disabled=!window._histRedo.length; br.style.opacity=window._histRedo.length?'1':'.4'; br.title='Rehacer (Ctrl+Y) — '+window._histRedo.length+' paso(s)';}
}

function _markAtt(id, field){
  try{ window._recentAtt[id+'|'+field]=Date.now(); window._pendingEdits.add(id+'|'+field);
    // Cuántas veces se tocó esta casilla: una escritura solo la da por guardada si
    // nadie la volvió a tocar mientras viajaba (ver syncToFB).
    const V=window._pendVer||(window._pendVer={}); V[id+'|'+field]=(V[id+'|'+field]||0)+1; }catch(e){}
  // Cada intento lleva la hora (del equipo) de su último cambio.
  // Es lo que decide entre dos equipos que tocaron la misma casilla: gana el
  // cambio más nuevo. Sin esto ganaba el que tenía la edición PENDIENTE: un
  // equipo con la red caída guardaba su decisión vieja como pendiente, ignoraba
  // la corrección que llegaba de la mesa y, al recuperar la red minutos después,
  // la volvía a escribir encima. Así se "des-revertían" las decisiones.
  try{
    const m=/^att_(sq|bp|dl)_(\d)$/.exec(field||'');
    if(m){ const a=(DATA.athletes||[]).find(x=>x&&x.id===id); const at=a&&a.att&&a.att[m[1]]&&a.att[m[1]][+m[2]];
      // Siempre hacia adelante: si la diferencia de hora estimada cambió entre un
      // cambio y el siguiente, el segundo igual tiene que ganarle al primero.
      if(at){
        // Con la hora del equipo, no con _ahora(): la diferencia de reloj que
        // estima _ahora arrastra la demora de la red (uno o dos segundos en un
        // recinto), bastante más que lo que se separan dos relojes de verdad,
        // que se ponen en hora solos. Con _ahora, una corrección hecha un
        // segundo después en otra mesa podía quedar "antes" y perder.
        at.t=Math.max(Date.now(),(at.t||0)+1);
        // Y la hora de cada campo que cambió desde la última vez (ver _fusionCelda).
        // Sin sello (casilla que nunca pasó por _sellarCeldas) no se sabe qué
        // cambió: se le pone hora a los dos, como antes.
        const sinSello=!('_pw' in at);
        if(sinSello||at.w!==at._pw){ at.tw=at.t; at._pw=at.w; }
        if(sinSello||(at.r==null?null:at.r)!==(at._pr==null?null:at._pr)){ at.tr=at.t; at._pr=at.r==null?null:at.r; }
      } }
  }catch(e){}
}

// ¿La casilla de este equipo le gana a la que llegó del servidor? Solo si no es
// más vieja. Las que no traen hora (datos de antes de este cambio) cuentan como 0.
function _celdaMiaGana(lc,rc){
  if(!lc)return true;
  if(!rc)return true;
  return (lc.t||0)>=(rc.t||0);
}

// Junta dos versiones de la misma casilla campo por campo. El peso y la decisión
// llevan cada uno su hora (tw, tr; ver _markAtt): si un equipo cambió el peso
// —un cambio de intento— y otro, con la casilla todavía vieja, marcó válido, se
// quedan las dos cosas. Antes ganaba la casilla entera más nueva y el peso
// nuevo se perdía. Lo demás (luces, jurado, cambios…) va con la más nueva.
function _fusionCelda(a,b){
  if(!a)return b; if(!b)return a;
  // a = lo de esta pantalla, b = lo que llegó. Si empatan (o ninguna tiene
  // hora) manda lo que llegó, como siempre.
  const ta=a.t||0, tb=b.t||0;
  const nuevo=ta>tb?a:b, viejo=nuevo===a?b:a;
  // Lo que trae solo la versión vieja (por ejemplo las luces de los jueces) se
  // conserva; lo que traen las dos, manda la nueva.
  const out=Object.assign({},viejo,nuevo);
  [['w','tw','_pw'],['r','tr','_pr']].forEach(([f,tf,pf])=>{
    // Sin hora de ese campo no hay con qué discutir: queda el de la más nueva.
    const tn=nuevo[tf], tv=viejo[tf];
    if(tv!=null&&(tn==null||tv>tn)&&viejo[f]!==nuevo[f]){ out[f]=viejo[f]; out[tf]=viejo[tf]; out[pf]=viejo[f]; if(f==='w'&&viejo.cambios!=null)out.cambios=viejo.cambios; }
  });
  return out;
}

// Merge para ESCRITURA: parte del estado REMOTO (lo que hicieron los otros
// controladores) y encima aplica solo MIS ediciones pendientes. Así dos PCs que
// tocan atletas distintos no se pisan nunca — antes, cada escritura mandaba el
// documento completo y la última en llegar borraba lo del otro.
// ¿Es la misma persona? El guardia contra mezclar campeonatos compara nombres,
// pero un nombre corregido en vivo tiene que seguir siendo la misma persona:
// se acepta el nombre actual o el original de cualquiera de los dos lados, o
// una edición mía todavía sin confirmar.
function _mismaPersona(la,ra,pend){
  if(!la||!ra)return false;
  if(pend&&pend.has&&pend.has(ra.id+'|meta'))return true;
  const n=x=>_nnCrono(x||'');
  const A=[n(la.name),n(la.nombreOrig)].filter(Boolean), B=[n(ra.name),n(ra.nombreOrig)].filter(Boolean);
  return A.some(x=>B.indexOf(x)>=0);
}

function _mergeForWrite(localArr, remoteArr){
  if(!remoteArr||!remoteArr.length)return localArr;
  const pend=window._pendingEdits||new Set();
  const META=_MERGE_META_FIELDS;
  const byId={}; (localArr||[]).forEach(a=>{ if(a&&a.id!=null) byId[a.id]=a; });
  const out=(remoteArr||[]).map(ra=>{
    const la=byId[ra.id];
    // Mismo id pero otra persona → roster de otro campeonato: manda el remoto.
    if(!la || !_mismaPersona(la,ra,pend))return ra;
    const m=JSON.parse(JSON.stringify(ra));
    if(pend.has(ra.id+'|meta'))META.forEach(f=>{ if(la[f]!==undefined)m[f]=la[f]; });
    ['sq','bp','dl'].forEach(l=>{
      const lL=(la.att&&la.att[l])||[], lR=(m.att&&m.att[l])||[];
      const n=Math.max(lL.length,lR.length), arr=[];
      for(let r=0;r<n;r++){
        const kp=ra.id+'|att_'+l+'_'+r;
        // Mío (incluye borrar el 4º) — salvo que el servidor ya traiga un cambio
        // MÁS NUEVO de esa casilla, hecho en otro equipo: ese manda y mi edición
        // pendiente se descarta.
        // (La marca de pendiente NO se borra acá: esto corre dentro de una
        // transacción que Firestore puede repetir si otro equipo escribió en el
        // medio, y en la repetición la edición tiene que seguir contando. Se
        // suelta recién cuando la escritura sale bien.)
        if(pend.has(kp)&&!_celdaMiaGana(lL[r],lR[r])){ arr[r]=_fusionCelda(lL[r],lR[r]); }
        else if(pend.has(kp)){ if(lL[r])arr[r]=lR[r]?_fusionCelda(lL[r],lR[r]):lL[r]; }
        else if(lR[r]!==undefined)arr[r]=lR[r];
        // Sin la condición de arriba, un intento extra que otro control ya borró
        // volvía a subir desde acá y le revivía a todo el equipo. Lo que tengo
        // local y no está ni en el servidor ni entre mis ediciones pendientes es
        // data vieja: no se reenvía.
      }
      while(arr.length&&arr[arr.length-1]===undefined)arr.pop();
      if(!m.att)m.att={};
      m.att[l]=arr;
    });
    return m;
  });
  // Atletas que están acá y no en el servidor. Se suben solo si son un alta MÍA
  // sin confirmar; si no, es nómina vieja de esta pantalla y no tiene por qué
  // volver a subir. Sin esta condición, un equipo que quedó con la nómina revuelta
  // se la mandaba entera al servidor en cuanto lograba guardar, y el desorden se
  // le contagiaba a todos los demás.
  const rids=new Set((remoteArr||[]).map(a=>a&&a.id));
  (localArr||[]).forEach(a=>{ if(a&&!rids.has(a.id)&&pend.has(a.id+'|meta'))out.push(a); });
  return out;
}

function _mergeAthletes(localArr, remoteArr){
  const now=Date.now();
  const pend=window._pendingEdits||new Set();
  const held={};
  for(const k in window._recentAtt){ if(now-window._recentAtt[k]<_MERGE_HOLD_MS) held[k]=true; else delete window._recentAtt[k]; }
  const localById={}; (localArr||[]).forEach(a=>{ if(a&&a.id!=null) localById[a.id]=a; });
  let overrode=false;
  const out=(remoteArr||[]).map(ra=>{
    const la=localById[ra.id];
    // Mismo id pero OTRA persona = rosters de campeonatos distintos. No se
    // mezcla nada: manda el del servidor. Los ids se reparten por evento, así
    // que sin este control las ediciones de un campeonato le caían encima a
    // otro atleta en el otro.
    if(!la || !_mismaPersona(la,ra,held[ra.id+'|meta']?{has:()=>true}:pend)) return ra;
    const m=JSON.parse(JSON.stringify(ra));
    if(held[ra.id+'|meta']){
      _MERGE_META_FIELDS.forEach(f=>{ if(la[f]!==undefined) m[f]=la[f]; });
      overrode=true;
    }
    ['sq','bp','dl'].forEach(l=>{
      const lLocal=(la.att&&la.att[l])||[];
      const lRemote=(m.att&&m.att[l])||[];
      const maxLen=Math.max(lLocal.length,lRemote.length);
      const arr=[];
      for(let r=0;r<maxLen;r++){
        const kCel=ra.id+'|att_'+l+'_'+r;
        // Mi versión manda en dos casos:
        //
        //   1. La acabo de tocar (held: ventana de 4 s).
        //   2. Todavía NO me consta que el servidor haya aceptado esa edición
        //      (pend: se limpia recién cuando la escritura sale bien).
        //
        // El caso 2 faltaba acá y ahí estaba la pérdida de pesos. Se consultaba
        // solo más abajo, para cuando el remoto venía más corto; si la casilla
        // existía en el remoto —lo normal: está creada con el peso viejo o
        // vacía— lo único que protegía al peso recién escrito eran esos 4
        // segundos. El documento del Sudamericano pesa cerca de un mega con sus
        // 429 atletas: en la red del recinto la escritura tarda más que eso, y
        // cualquier eco que llegara con el estado anterior borraba el peso. El
        // operador lo volvía a escribir y a veces se perdía otra vez, hasta que
        // una escritura ganaba la carrera.
        let heldR=held[kCel]||pend.has(kCel);
        // Lo del servidor es más nuevo que lo mío (otro equipo corrigió después):
        // manda el servidor, y mi edición deja de estar pendiente.
        // (Si lo del servidor es más nuevo, igual se junta campo por campo con
        // _fusionCelda: lo que yo cambié en el otro campo sigue pendiente y sale
        // en la próxima escritura. Antes acá se soltaba la marca y ese cambio
        // podía no llegar nunca al servidor.)
        if(heldR){
          // Yo toqué esta celda hace poco → mi versión manda. Si la BORRÉ (ej.
          // eliminé el 4º intento: lLocal[r] ya no existe) NO la re-agrego desde el
          // remoto — así la eliminación no "revive" por un snapshot de otro control.
          if(lLocal[r]){ arr[r]=lRemote[r]?_fusionCelda(lLocal[r],lRemote[r]):Object.assign({},lLocal[r]); }
          overrode=true;
        }
        // Lo que tengo acá es un cambio MÁS NUEVO que lo que trae este documento
        // (lleva una hora posterior): el documento viene atrasado —otro equipo lo
        // escribió antes de recibir mi cambio— y llegó tarde. Se conserva lo mío;
        // el servidor ya lo tiene, porque mi escritura salió. Sin esto, el equipo
        // que cargó un peso se quedaba con la casilla vacía para siempre: su propio
        // eco se ignora, así que nada le devolvía el peso.
        else if(lLocal[r]&&lRemote[r]){ arr[r]=_fusionCelda(lLocal[r],lRemote[r]); }
        else if(lRemote[r]!==undefined){ arr[r]=lRemote[r]; }
        // El remoto viene más corto que lo que tengo acá: o alguien borró ese
        // intento extra, o yo lo acabo de agregar y todavía no salió de este
        // equipo. Solo se conserva en el segundo caso — o sea, si es una edición
        // MÍA sin confirmar. Sin esa condición, una pantalla de espectador se
        // quedaba con el 4º intento para siempre: el servidor ya no lo traía, pero
        // acá seguía en memoria y ganaba en cada snapshot. Por eso, al borrar el
        // extra o reiniciar los datos en vivo, el público lo seguía viendo.
        else if(lLocal[r]!==undefined && pend.has(ra.id+'|att_'+l+'_'+r)){
          arr[r]=Object.assign({},lLocal[r]); overrode=true;
        }
      }
      // Sacar huecos finales (ej. borré el último índice estando held).
      while(arr.length && arr[arr.length-1]===undefined) arr.pop();
      if(!m.att) m.att={};
      m.att[l]=arr;
    });
    return m;
  });
  // Atletas que tengo local y no vinieron en el remoto, con edición reciente →
  // conservarlos (ej. acabo de agregar uno y todavía no llegó al servidor).
  // PERO solo si los dos rosters son del MISMO campeonato: se compara cuántos
  // nombres comparten. Si no comparten casi ninguno, lo que tengo cargado es el
  // roster de otro evento y meterlo acá cruza las nóminas — fue exactamente lo
  // que pasó entre el Sudamericano de prueba y el Regional Centro Sur.
  const remoteIds=new Set((remoteArr||[]).map(a=>a&&a.id));
  const remoteNames=new Set((remoteArr||[]).map(a=>_nnCrono(a&&a.name||'')));
  const comunes=(localArr||[]).filter(a=>remoteNames.has(_nnCrono(a&&a.name||''))).length;
  const mismoRoster=!(localArr||[]).length||!(remoteArr||[]).length
    ||comunes>=Math.ceil(Math.min((localArr||[]).length,(remoteArr||[]).length)*0.5);
  if(mismoRoster){
    (localArr||[]).forEach(a=>{
      if(a && !remoteIds.has(a.id) && !remoteNames.has(_nnCrono(a.name||'')) && held[a.id+'|meta']){
        out.push(a); overrode=true;
      }
    });
  }else{
    console.warn('[FB] El roster local no coincide con el del servidor — no se agregan atletas locales');
  }
  window.__mergeOverrode=overrode;
  return out;
}

function _scheduleWriteback(){
  if(!window.IS_CONTROLLER)return;
  if(_wbTimer)return;
  _wbTimer=setTimeout(()=>{ _wbTimer=null; try{ if(typeof syncToFB==='function') syncToFB(); }catch(e){} }, 450);
}

async function tryLoadFromFB(){
  if(!fbReady||!DATA.event)return false;
  const id=fbDocId();if(!id)return false;
  try{
    const ref=window._fb.doc(fbDB,'livecast_sync',id);
    const snap=await window._fb.getDoc(ref);
    if(!snap.exists())return false;
    const d=snap.data();
    DATA.athletes=_normExtraAtts(JSON.parse(d.athletes||'[]'));
    try{ _flashFijarBase(JSON.parse(d.athletes||'[]')); }catch(_){}
    if((Date.now()-(window._lastLocalAction||0))>=2500){
      DATA.lift=d.lift||DATA.lift;
      DATA.round=typeof d.round==='number'?d.round:DATA.round;
      DATA.flight=d.flight||DATA.flight;
    }
    DATA.changeTimers=JSON.parse(d.changeTimers||'{}');
    DATA.lotsGenerated=d.lotsGenerated||false;
    DATA.forcedCurrent=typeof d.forcedCurrent!=='undefined'?d.forcedCurrent:null;
    DATA.compTimer=typeof d.compTimer!=='undefined'?d.compTimer:null;
    if(typeof d.timer==='number')DATA.timer=d.timer;
    DATA.timerOn=false;
    console.log('[FB] Loaded state from Firebase:',DATA.athletes.length,'athletes');
    return true;
  }catch(e){console.warn('[FB] Load failed',e);return false}
}

// ── ENSAYO ABIERTO ────────────────────────────────────────────────
// El evento de ensayo (id suda2026_ensayo / nombre "ENSAYO …") se opera SIN
// iniciar sesión: al cargarlo cualquiera queda como admin-controlador, con un
// botón en la hamburguesa para alternar admin ↔ espectador. Para que lo que
// juzguen se sincronice a otros dispositivos, Firebase necesita el proveedor
// "Anónimo" habilitado (Console → Authentication → Sign-in method): acá se
// intenta signInAnonymously(); si no está habilitado, el ensayo funciona igual
// pero solo-local en esa pantalla.
// Evento de prueba: marcado como ensayo, con "ensayo" en el id o con el nombre
// empezando por ENSAYO. Los del Sudamericano ya se sacaron de nominas.json.
function _isEnsayo(ev){ev=ev||DATA.event;return !!(ev&&(ev.ensayo||/ensayo/i.test(String(ev.id||''))||/^\s*ENSAYO\b/i.test(String(ev.name||''))));}

function _ensayoGrant(){
  // El permiso del ensayo es EXCLUSIVO del ensayo. Al cambiar a un evento real
  // hay que revocarlo: si no, el operador queda "admin" localmente pero SIN
  // sesión válida en Firebase, y las escrituras se rechazan en silencio (el
  // espectador nunca ve los pesos). También se oculta el botón de cambio de rol.
  if(!_isEnsayo()){
    if(window._ensayoFree){
      window._ensayoFree=false;
      if(window.ADMIN_ROLE==='ensayo'){          // admin dado por el ensayo, no real
        isAdmin=false; window.ADMIN_ROLE=null;
        if(DATA.phase!=='setup')DATA.phase='liveView';
        try{showToastLC('Este es un evento OFICIAL: inicia sesión para operarlo');}catch(e){}
      }
    }
    return;
  }
  window._ensayoFree=true;
  if(!isAdmin){isAdmin=true;window.ADMIN_ROLE=window.ADMIN_ROLE||'ensayo';}
  window.IS_CONTROLLER=true;
  try{
    if(fbReady&&window._fbAuth&&fbAuth&&!fbAuth.currentUser&&window._fbAuth.signInAnonymously){
      window._fbAuth.signInAnonymously(fbAuth).catch(e=>console.warn('[ensayo] login anónimo:',e.code||e.message));
    }
  }catch(e){}
}

function recoverBackup(){
  try{
    const bk=localStorage.getItem('fechipo_lc3_backup');
    if(!bk)return;
    const d=JSON.parse(bk);
    if(!d.athletes||!d.athletes.length){showToastLC('El respaldo está vacío');return;}
    d.timerOn=false;d.timer=60;
    Object.assign(DATA,d);
    save();
    showToastLC('Sesión recuperada: '+d.athletes.length+' atletas, '+(DATA.event==null?void 0:DATA.event.name));
    R();
  }catch(e){showToastLC('Error al recuperar: '+e.message);}
}

function resetLiveData(){
  if(!isAdmin){alert('Solo admin puede reiniciar');return}
  if(!DATA.event){alert('No hay competencia activa');return}
  const ev=DATA.event;
  const msg='REINICIAR datos en vivo de:\n"'+ev.name+'"\n\nSE BORRAN:\n• Intentos (squat / bench / deadlift)\n• Pesos cargados y resultados\n• Timer y cursores (lift, ronda)\n• Bombed (atletas eliminados)\n\nSE CONSERVAN:\n• Tandas, vuelos, lots\n• Pesaje (BW), racks\n• Listado de atletas\n\nEsto sobreescribe Firestore para TODOS los dispositivos y widgets de OBS.';
  // ANTES de borrar nada: comprobar que ESTA pantalla puede escribir en el servidor.
  // Si no puede (modo espectador, sin sesión admin o Firebase caído), el borrado
  // local dejaba el equipo desincronizado: vacío acá y con todo cargado en el
  // servidor y en el público. Mejor no tocar nada y explicar por qué.
  if(!fbReady){
    alert('Sin conexión con el servidor.\n\nNo se reinició nada: si borrara solo en esta pantalla, quedaría distinta del resto. Revisa tu conexión y vuelve a intentar.');
    return;
  }
  if(!isAdmin){
    alert('Necesitas iniciar sesión como administrador para reiniciar los datos.\n\nNo se borró nada.');
    return;
  }
  if(!window.IS_CONTROLLER){
    if(confirm('Esta pantalla está en modo ESPECTADOR: no puede guardar en el servidor.\n\nSi reiniciara ahora, se borraría solo acá y el público seguiría viendo todo.\n\n¿Cambiar esta pantalla a CONTROLADOR y continuar?')){
      setSyncMode(true);
    }else{
      return;   // no se toca nada
    }
  }
  if(!confirm(msg))return;
  if(!confirm('¿CONFIRMAS el reinicio? Esta acción no se puede deshacer.'))return;
  // Reset por atleta: solo intentos y bombed
  DATA.athletes.forEach(a=>{
    a.att={sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]};
    a.bombed=false;
  });
  // Reset cursores y timer
  DATA.lift='sq';
  DATA.round=0;
  DATA.changeTimers={};
  DATA.timer=60;
  DATA.timerOn=false;
  if(typeof mainTI!=='undefined'&&mainTI){clearInterval(mainTI);mainTI=null}
  const tEl=document.getElementById('mainTimer');if(tEl){tEl.style.color='var(--green)';tEl.textContent='1:00';tEl.style.animation='none'}
  // Persistir local + push inmediato a Firestore. Va como escritura AUTORITATIVA:
  // reemplaza el documento remoto en vez de mergear (si no, el remoto devolvía los
  // intentos borrados y el público seguía viendo todo marcado).
  window._forceFullWrite=true;
  window._pendingEdits=new Set();   // el reinicio invalida cualquier edición pendiente
  saveNow();
  R();
  // Confirmar que realmente se propagó (si no escribe, el público no se entera)
  _confirmarPublicado(
    ()=>alert('Datos en vivo reiniciados y propagados a todos los dispositivos y widgets.'),
    ()=>alert('El reinicio se aplic\u00f3 en ESTA pantalla pero NO se pudo guardar en el servidor'
        +(window.IS_CONTROLLER?'.':' porque est\u00e1 en modo ESPECTADOR.')
        +'\n\nEl p\u00fablico sigue viendo los datos anteriores. Revisa el indicador SYNC y vuelve a intentar.'));
}

function exportBackupJSON(){
  const snap=DATA;
  const data={
    exportedAt:new Date().toISOString(),
    phase:DATA.phase,event:DATA.event,athletes:DATA.athletes,
    lift:DATA.lift,round:DATA.round,flight:DATA.flight,
    changeTimers:DATA.changeTimers,lotsGenerated:DATA.lotsGenerated
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=u;a.download='backup_livecast_'+((DATA.event==null?void 0:DATA.event.short)||'compe').replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,16).replace(/:/g,'-')+'.json';
  a.click();
}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

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

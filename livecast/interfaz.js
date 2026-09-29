// livecast.html — La pantalla: el dibujo general (R), el menú, la lista de campeonatos, entrar a uno (pickEvent y el link ?evento=) y el acceso de admin.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

async function doLogout(){
  isAdmin=false;DATA.phase='liveView';save();
  // Sign out from Firebase so admin.html also reflects the logout
  try{
    const authMod=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await authMod.signOut(fbAuth);
  }catch(e){console.warn('Logout error',e)}
  try{if(fbAuth)await window._fbAuth.signOut(fbAuth)}catch(e){}
  R();
}

function go(p){DATA.phase=p;save();toggleNav(false);R()}

function toggleNav(force){
  const open=(typeof force==='boolean')?force:!document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open',open);
}

// Convierte un atleta de la nómina (archivo o Firestore) al formato del livecast.
// Se usa al abrir un evento y también para sembrar los widgets TX antes del sync.
function _evAthlete(a,j,flightMap){
    j=j||0;
    const name=a.nombre||'';
    const fl=flightMap&&flightMap[name]?flightMap[name]:'A';
    const rawMod=(a.modalidad||a.mod||'').toLowerCase();
    // Mapear todas las modalidades soportadas
    let mod;
    const isOE=rawMod.includes('special olympics')||rawMod.includes('olimpiadas')||rawMod.includes(' oe')||rawMod.endsWith('oe');
    const isEq=rawMod.includes('equipado')||rawMod.includes('equipped');
    const isBench=rawMod.includes('only bench')||rawMod.includes('onlybench')||rawMod.includes('only_bench');
    const isCombined=rawMod.includes('+');
    // OE solo soporta Powerlifting Classic — no hay Only Bench OE
    if(isOE) mod='oe_classic';
    else if(isCombined&&isEq) mod='equipped_bench';
    else if(isCombined) mod='classic_bench';
    else if(isBench&&isEq) mod='equipped_bench'; // edge case raro
    else if(isBench) mod='onlybench';
    else if(isEq) mod='equipped';
    else mod='classic';
    const _rawSex=(a.sexo||a.sex||'').trim();
    const _normSex=(_rawSex==='Femenino'||_rawSex==='F'||_rawSex==='Mujer')?'Mujer':(_rawSex==='Masculino'||_rawSex==='M'||_rawSex==='Hombre')?'Hombre':_rawSex;
    const _countryCode=String(a.pais||a.country||a.pais3||'CHI').toUpperCase();
    // Los eventos de ENSAYO vienen con intentos y peso corporal ya cargados en el
    // archivo, para poder practicar sobre una competencia a medio correr. Un evento
    // normal no trae nada de esto y arranca en cero, como siempre.
    const _att=l=>{
      const src=(a.att&&a.att[l])||null;
      const base=[0,1,2].map(j=>{
        const x=src&&src[j];
        return {w:(x&&+x.w)||0, r:(x&&(x.r==='g'||x.r==='n'))?x.r:null};
      });
      if(src&&src[3]&&+src[3].w)base.push({w:+src[3].w,r:(src[3].r==='g'||src[3].r==='n')?src[3].r:null,extra:true});
      return base;
    };
    return{id:j,lot:a.lot||j+1,name,rut:a.rut||'',sex:_normSex,cat:a.categoria||'',div:a.division||'',club:a.club||'',uni:a.universidad||'',mod,plusBench:isCombined,country:_countryCode,bw:(+a.bw)||0,flight:a.flight||fl,jornada:a.jornada||'',born:String(a.born||'').slice(0,4)||(String(a.dob||'').match(/\d{4}/)||[''])[0],rackSQ:a.rackSQ||'',rackBP:a.rackBP||'',bombed:false,
    att:{sq:_att('sq'),bp:_att('bp'),dl:_att('dl')}};
}

function pickEvent(i){
  const ev=DATA.events[i];
  // Cambiar de campeonato borra las marcas de "edité esto recién". Si no, las
  // que quedaban del evento anterior hacían que el merge metiera atletas de ESE
  // evento en el documento del nuevo, y después los reenviaba: así se cruzaron
  // los atletas del Sudamericano de prueba con los del Regional Centro Sur.
  try{ window._recentAtt={}; if(window._pendingEdits)window._pendingEdits.clear(); }catch(e){}
  window._SR_HOY=null;
  window._VARIOS_PAISES=undefined;
  // Los filtros de Resultados son de un campeonato: si quedaran puestos al cambiar
  // de evento, la tabla del nuevo abriría vacía sin motivo aparente.
  window._RES_F={sex:'',cat:'',div:'',mod:''};
  window._ACTA_DIA='';
  DATA.event=ev;
  // Los logos viven en la ficha del campeonato en Firestore, pero el objeto que
  // se elige acá sale de nominas.json —el Sudamericano y sus ensayos no tienen
  // inscripciones en Firestore, su nómina es un archivo— y ese objeto no los
  // trae. Sin esto, elegir el campeonato PISABA los logos ya subidos con un
  // objeto que no los tiene: se subían, se veían, y al volver a entrar no
  // estaban. Se recuperan de lo que ya leyó el listener de eventos.
  (function(){
    const m=(window.LIVE_EVENT_META||{})[ev.id]||(window.LIVE_EVENT_META||{})[ev.name];
    if(!m)return;
    if(!ev.logoUrl&&m.logoUrl)ev.logoUrl=m.logoUrl;
    if(!ev.logoFedUrl&&m.logoFedUrl)ev.logoFedUrl=m.logoFedUrl;
    if(!Array.isArray(ev.logosPantalla)&&Array.isArray(m.logosPantalla))ev.logosPantalla=m.logosPantalla;
  })();
  _ensayoGrant();
  // ¿Tiene este campeonato sus logos en el repo? Se pregunta una vez por
  // campeonato, y solo se usan si la ficha no trae los suyos.
  try{ _probarLogosLocales(); }catch(e){}
  // Load saved flight assignments from cronograma
  const cronoKey='fechipo_crono_'+(ev.name||'').replace(/\s+/g,'_');
  let flightMap=null;
  try{const saved=localStorage.getItem(cronoKey);if(saved){const d=JSON.parse(saved);if(d.map)flightMap=d.map}}catch(e){}
  
  DATA.athletes=ev.athletes.map((a,j)=>_evAthlete(a,j,flightMap));
  const allFlights=flightMap?[...new Set(Object.values(flightMap))].filter(_inTarima).sort(_cmpFl):[];
  // La tanda activa arranca en la PRIMERA QUE EXISTE entre los atletas. Antes caía
  // siempre en 'A' aunque nadie estuviera en la A (los días del Sudamericano
  // arrancan todos sin tanda, con un guion), y el control quedaba apuntando a una
  // tanda vacía.
  const _flAth=[...new Set(DATA.athletes.map(a=>a.flight))].filter(_inTarima).sort(_cmpFl);
  const firstFlight=allFlights[0]||_flAth[0]||(TARIMA?'A'+TARIMA:'A');
  // Un evento puede decir en qué movimiento/ronda arranca (los ENSAYOS vienen a
  // mitad de competencia, así que abrir en sentadilla-1 mostraría todo terminado
  // y los widgets de tarima en blanco). Los eventos normales arrancan en SQ1.
  DATA.lift=(ev.startLift==='bp'||ev.startLift==='dl')?ev.startLift:'sq';
  DATA.round=[0,1,2].includes(+ev.startRound)?+ev.startRound:0;
  DATA.flight=firstFlight;DATA.changeTimers={};
  // Load athletes from Firestore in real time (overrides nominas.json when available)
  if(fbReady)loadLiveAthletes(ev);

  // Non-admin: try to load state from Firebase first
  if(!isAdmin&&fbReady){
    tryLoadFromFB().then(ok=>{
      if(ok)console.log('[FB] Using Firebase state');
      DATA.phase='liveView';save();R();startFBSync();
    });
  }else{
    // ?remote=1 → aterrizar en el Control Remoto (pensado para el teléfono).
    // Vale también para los ENSAYOS, que se operan sin iniciar sesión.
    if(WANT_REMOTE&&isAdmin&&window._canAccess('remote')){DATA.phase='remote';save();R();startFBSync();}
    // La cuenta de streaming no tiene Atletas & Pesaje: aterriza en Control TX.
    else{go(isAdmin?(window._canAccess('manage')?'manage':'director'):'liveView');startFBSync();}
  }
}

function _conteoGuardado(evId){
  try{
    const o=JSON.parse(localStorage.getItem('yl_conteo_'+evId)||'null');
    if(o&&Date.now()-o.ts<_CONTEO_TTL)return o.n;
  }catch(e){}
  return null;
}

async function _contarAtletasEventos(fb,ids){
  window._conteoEnCurso=window._conteoEnCurso||{};
  for(const evId of ids){
    const meta=window.LIVE_EVENT_META&&window.LIVE_EVENT_META[evId];
    if(!meta)continue;
    const g=_conteoGuardado(evId);
    if(g!==null){ meta.athleteCount=g; continue; }
    if(window._conteoEnCurso[evId])continue;
    window._conteoEnCurso[evId]=true;
    try{
      const q=fb.query(fb.collection(fbDB,'inscripciones'),fb.where('evento','==',evId),fb.where('status','in',['approved','pending']));
      let n;
      if(typeof fb.getCountFromServer==='function'){
        const c=await fb.getCountFromServer(q);
        n=c.data().count;
      }else{
        n=(await fb.getDocs(q)).size;
      }
      meta.athleteCount=n;
      try{localStorage.setItem('yl_conteo_'+evId,JSON.stringify({ts:Date.now(),n:n}));}catch(e){}
    }catch(e){/* silencioso: el número es solo informativo */}
    finally{ window._conteoEnCurso[evId]=false; }
  }
  if(DATA.phase==='setup')R();
}

function showToastLC(msg){
  const t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--green);color:var(--text);padding:12px 20px;border-radius:10px;z-index:9999;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.4)';
  t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3500);
}

function R(){
  // Los récords logrados hoy se recalculan una vez por dibujado: los consulta cada
  // casilla de la tabla, pero tienen que reflejar lo último (incluido lo que
  // acaba de llegar de otro controlador).
  window._SR_HOY=null;
  // Paracaídas de render: un error al dibujar NUNCA debe dejar la pantalla en
  // blanco/congelada (crítico con mucha gente operando en vivo). Para los widgets
  // de OBS/pantalla, si falla se conserva lo anterior. Para el admin, se muestra un
  // panel de recuperación (los datos quedan intactos: reintentar / deshacer / recargar).
  if(TX_MODE){ try{renderTxWidget();}catch(e){console.error('[TX] render error',e);} return; }
  // Quién está en la barra, para el panel de los jueces. Va acá porque es el
  // único punto por el que pasan todos los cambios; adentro se corta solo si no
  // cambió nada, así que no escribe de más. Solo desde el puesto que opera.
  if(isAdmin&&DATA.phase==='compete'){
    try{_avisarAtletaAJueces();}catch(e){}
    // Y se anotan las luces en cada intento, para poder mostrarlas después.
    try{_escucharLucesHistorial();}catch(e){}
  }
  // Con el modo jueces encendido y otro campeonato elegido, el canal cambió.
  if(judgeMode&&judgeUnsub&&_judgeDoc!==juezDocId()){try{startJudgeListener();}catch(e){}}
  try{
    const el=document.getElementById('R');if(!el)return;
    // El Scoreboard salió del menú: si alguien tenía esa pantalla guardada de antes,
    // se lo lleva a Resultados en vez de dejarlo en una pantalla sin salida.
    if(DATA.phase==='scoreboard'){DATA.phase='results';}
    // La transmisión, que vive afuera de #R. Se decide acá porque este es el
    // único punto por el que pasan todos los cambios de pantalla; adentro se
    // corta sola si no cambió nada, así que el video no se toca.
    try{ _ytSync(); }catch(e){ console.warn('[yt]',e); }
    // El link pide un campeonato y todavía no se resolvió cuál es.
    //
    // Acá quedaba en pantalla el que este equipo tuviera guardado de una visita
    // anterior: alguien que había mirado el Regional Norte escaneaba el QR del
    // Sudamericano y veía el Regional Norte. Después se corregía solo, pero
    // quien miraba la pantalla en ese momento ya se había llevado la idea de
    // que el QR estaba malo — y si la resolución fallaba, no se corregía nunca.
    //
    // No se borra nada: solo no se dibuja el campeonato viejo mientras se
    // resuelve el del link. De la decisión se encarga applyEventURLParam, que
    // es el único que sabe si son el mismo o no.
    //
    // Vale también para el admin. Antes se lo saltaba —"puede estar operando"—
    // pero el resultado era peor: en un teléfono con sesión de admin el QR
    // dejaba el campeonato viejo en pantalla y ahí se quedaba. Si el link pide
    // el mismo que ya tiene cargado, esto dura lo que tarda en resolverse.
    if(window._EV_ESPERANDO&&DATA.phase!=='setup'){
      el.innerHTML='<div style="max-width:620px;margin:60px auto;padding:0 16px">'
        +'<div class="card" style="padding:34px 22px;text-align:center">'
        +'<div class="os" style="font-size:15px;letter-spacing:2px;color:var(--gold);margin-bottom:8px">ENTRANDO A LA COMPETENCIA</div>'
        +'<div style="color:var(--muted);font-size:13px">Un segundo…</div></div></div>';
      return;
    }
    if(DATA.phase==='transmision'){el.innerHTML=renderTransmision();setTimeout(initTxWidgets,0);return}
    if(DATA.phase==='setup'){
      // El selector se vuelve a dibujar varias veces mientras cargan los datos
      // (nóminas, campeonatos de Firestore, el conteo de atletas de cada uno).
      // Como el contenedor lleva la animación de aparecer, cada reescritura la
      // dispara de nuevo y la pantalla PESTAÑEA. Si lo que hay que dibujar es
      // igual a lo que ya está, no se toca.
      const _nuevo=renderSetup();
      if(el.innerHTML!==_nuevo)el.innerHTML=_nuevo;
      return;
    }
    // Solo se anima al llegar a una pantalla distinta. Y si lo que hay que
    // dibujar es igual a lo que ya está, no se toca: reescribir de gusto pierde
    // el scroll y el foco de la casilla que se está tecleando.
    const _pant=DATA.phase+'|'+(TARIMA||'');
    const _mismaPant=(window._ultPantalla===_pant);
    el.classList.toggle('sin-anim', _mismaPant);
    window._ultPantalla=_pant;
    const _nuevo=renderShell();
    if(el.innerHTML!==_nuevo){
      // Rehacer la pantalla de golpe la tira al principio: mientras el navegador
      // reconstruye el contenido el documento mide menos, y el scroll se recorta
      // a lo que queda. Al espectador se le iba la vista para arriba cada vez que
      // en la mesa cargaban un peso. Se anota dónde estaba y se lo devuelve ahí.
      //
      // Entre las dos líneas no cabe un gesto del usuario —asignar innerHTML es
      // síncrono—, así que cualquier diferencia la puso el navegador, no él.
      const _sy=_mismaPant?(window.scrollY||window.pageYOffset||0):0;
      el.innerHTML=_nuevo;
      if(_sy&&(window.scrollY||window.pageYOffset||0)!==_sy)window.scrollTo(0,_sy);
    }
  }catch(e){ console.error('[R] render error',e); _renderRecovery(e); }
}

function _renderRecovery(e){
  try{
    const el=document.getElementById('R');if(!el)return;
    const msg=(e&&e.message)?String(e.message):'error';
    el.innerHTML='<div style="max-width:560px;margin:60px auto;padding:24px;border:2px solid var(--red);border-radius:14px;background:rgba(239,68,68,.06);text-align:center;font-family:Inter,sans-serif">'
      +'<div style="font-family:Oswald;font-size:20px;font-weight:700;color:var(--red);letter-spacing:1px"><i class=yl-i-alerta></i> ERROR AL DIBUJAR LA PANTALLA</div>'
      +'<div style="font-size:12px;color:var(--muted);margin:10px 0 16px;line-height:1.5">La aplicación sigue funcionando y los datos están a salvo. Reintenta, deshaz el último cambio o recarga la página.</div>'
      +'<div style="font-size:10px;color:var(--muted);font-family:monospace;background:rgba(0,0,0,.25);padding:8px;border-radius:6px;margin-bottom:16px;word-break:break-word">'+msg.replace(/[<>&]/g,'')+'</div>'
      +'<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
      +'<button onclick="R()" style="padding:9px 18px;border-radius:8px;border:1px solid var(--gold);background:rgba(212,168,67,.12);color:var(--gold);font-family:Oswald;font-weight:700;cursor:pointer">↻ Reintentar</button>'
      +((window._histUndo&&window._histUndo.length)?'<button onclick="histUndo()" style="padding:9px 18px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-family:Oswald;font-weight:700;cursor:pointer">↶ Deshacer</button>':'')
      +'<button onclick="location.reload()" style="padding:9px 18px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-family:Oswald;font-weight:700;cursor:pointer">⟳ Recargar</button>'
      +'</div></div>';
  }catch(_){}
}

function renderSetup(){
  // Check for backup
  let backupInfo='';
  try{
    const bk=localStorage.getItem('fechipo_lc3_backup');
    if(bk){
      const d=JSON.parse(bk);
      if(d.ts&&d.athletes&&d.athletes.length){
        const elapsed=Math.round((Date.now()-d.ts)/60000);
        backupInfo='<div style="background:rgba(212,168,67,.1);border:1px solid var(--gold);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">'
          +'<div><div style="font-family:Oswald;font-size:13px;color:var(--gold);letter-spacing:1px">RESPALDO AUTOMÁTICO DISPONIBLE</div>'
          +'<div style="font-size:11px;color:var(--muted);margin-top:3px">'+((d.event==null?void 0:d.event.name)||'Competencia')+' · '+d.athletes.length+' atletas · hace '+elapsed+'m ('+d.tsLabel+')</div></div>'
          +'<button onclick="recoverBackup()" style="padding:8px 18px;border-radius:8px;border:2px solid var(--gold);background:rgba(212,168,67,.1);color:var(--gold);font-family:Oswald;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:1px">RECUPERAR →</button>'
          +'</div>';
      }
    }
  }catch(e){}
  let h='<div style="max-width:700px;margin:60px auto;padding:0 20px" class="fade">'+backupInfo+'<div style="text-align:center;margin-bottom:40px"><img src="YourLift_logo.png" style="height:clamp(70px,11vw,120px);width:auto;max-width:90%;margin-bottom:6px" alt="YourLift" onerror="this.remove()"><p style="color:var(--muted);font-size:14px;margin-top:6px">Sistema de Gesti\u00f3n de Competencia</p><div style="width:60px;height:3px;background:linear-gradient(90deg,var(--accent),var(--gold));margin:12px auto;border-radius:2px"></div><a href="index.html" style="display:inline-block;margin-top:10px;color:var(--muted);font-size:12px;text-decoration:none;padding:6px 16px;border:1px solid var(--border);border-radius:6px;transition:all .15s" onmouseenter="this.style.borderColor=\'var(--accent)\';this.style.color=\'var(--text)\'" onmouseleave="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--muted)\'">← YourLift</a></div>';
  // Merge: agregar eventos creados desde admin (Firestore) que no est\u00e9n en nominas.json
  if(window.LIVE_EVENT_META){
    Object.entries(window.LIVE_EVENT_META).forEach(function(entry){
      var id=entry[0],meta=entry[1];
      var exists=DATA.events.some(function(e){return e.id===id||e.name===meta.name});
      if(!exists){
        DATA.events.push({id:id,name:meta.name,organizer:meta.org||'',location:meta.location||'',athletes:[],_fromFirestore:true});
      }
    });
  }
  const _hidden=window.LIVE_EVENT_HIDDEN,_hiddenN=window.LIVE_EVENT_HIDDEN_NAMES;
  // Fecha legible + sesiones del cronograma oficial (los eventos por día del
  // Sudamericano traen `sesiones`): así se ve de un vistazo qué se levanta ese día
  // y a qué hora, sin tener que entrar al evento.
  const _fechaEv=f=>{ if(!f)return ''; const m=String(f).match(/^(\d{4})-(\d{2})-(\d{2})/); if(!m)return String(f);
    const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return (+m[3])+' '+MES[(+m[2])-1]+' '+m[1]; };
  const _sesEv=ev=>{ const ss=Array.isArray(ev.sesiones)?ev.sesiones:null; if(!ss||!ss.length)return '';
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">'+ss.map(x=>
      '<span style="font-size:10px;color:var(--muted);background:rgba(29,49,80,.35);border:1px solid var(--border);border-radius:6px;padding:2px 7px;white-space:nowrap">'
      +'<b style="color:var(--gold);font-family:Oswald">'+(x.inicio||'')+'</b> '+(x.nombre||'')+(x.atletas?' <span style="opacity:.6">('+x.atletas+')</span>':'')+'</span>').join('')+'</div>'; };
  // Si se entró a un campeonato de varios días (?evento=Sudamericano_2026), acá se
  // muestran SOLO sus días para elegir cuál operar/mirar, no la lista entera.
  const _flt=window._EV_FILTER;
  // El ESPECTADOR solo ve lo que el admin habilitó en YourLift Público (y, si ese
  // evento se corre en varios días, sus jornadas). Nunca la lista completa: lo que
  // está cargado pero no publicado no se le muestra a nadie.
  // El admin que da un ENSAYO es prestado (para poder operar la prueba sin iniciar
  // sesión). NO habilita a ver el resto de las competencias: para la lista sigue
  // contando como público. Solo el admin de verdad ve todo.
  const _adminReal=isAdmin&&window.ADMIN_ROLE!=='ensayo';
  const _soloPub=!_adminReal;
  const _pub=window.LIVE_EVENT_PUB;
  // Entrada desde el panel (Admin → YourLift): la lista corta con la que se
  // trabaja — lo que está publicado para el público, más los ensayos de prueba.
  // Es además la ÚNICA puerta a los ensayos: en la lista del público no salen.
  const _OPERAR=(()=>{try{return new URLSearchParams(location.search).get('operar')==='1'}catch(e){return false}})();
  // Si entró por el link de un campeonato (?evento=…), sus jornadas se le muestran
  // igual: ese link ES el permiso. El filtro está para que nadie curiosee la lista
  // completa de lo que hay cargado, no para bloquear el link que le pasaron.
  const _esPub=ev=>!!((_flt&&ev.parent===_flt.parent)||(_pub&&(_pub.has(ev.id)||_pub.has(ev.name)||(ev.parent&&_pub.has(ev.parent)))));
  // Qué se dibuja. El encabezado y la lista salen de esta misma función, si no
  // pueden decir cosas distintas ("son 9 jornadas" y abajo ninguna).
  const _verEv=ev=>{
    // Modo operar: solo lo publicado, sin la lista completa de todo lo que hay
    // cargado (que para el día a día es ruido). Los ensayos ya no salen: los del
    // Sudamericano se eliminaron, y uno nuevo se abre con su link (?evento=…).
    if(_OPERAR&&!_flt){
      return !!(_pub&&(_pub.has(ev.id)||_pub.has(ev.name)||(ev.parent&&_pub.has(ev.parent))));
    }
    // Adentro de un campeonato (?evento=…) NO se aplica el ocultar-de-la-lista:
    // "archivado" y "no visible en el livecast" están para que la lista general no
    // se llene de cosas viejas, no para esconder las jornadas del campeonato al
    // que se entró a propósito. Si no, marcar un día como oculto (para que no
    // apareciera en Nóminas, por ejemplo) lo borraba también de acá.
    // "Archivado" es para que la lista del OPERADOR no se llene de cosas viejas.
    // Al público no le aplica si además está publicado: un campeonato archivado
    // en su ficha pero habilitado en YourLift Público es el caso del
    // Sudamericano, y esconderlo dejaba a la gente con "NO HAY COMPETENCIAS EN
    // VIVO" tres días antes de que se corriera.
    if(!_flt&&_hidden&&(_hidden.has(ev.id)||(_hiddenN==null?void 0:_hiddenN.has(ev.name)))&&!(_soloPub&&_esPub(ev)))return false;
    if(_flt&&ev.parent!==_flt.parent)return false;
    if(_soloPub&&!_esPub(ev))return false;
    return true;
  };
  // Vino por el link de un campeonato y todavía no se resuelve: no se le muestra
  // la lista ni el "no hay competencias", que es mentira mientras carga.
  if(window._EV_ESPERANDO&&!_flt){
    h+='<div class="card" style="padding:34px 22px;text-align:center">'
      +'<div class="os" style="font-size:15px;letter-spacing:2px;color:var(--gold);margin-bottom:8px">ENTRANDO A LA COMPETENCIA</div>'
      +'<div style="color:var(--muted);font-size:13px">Un segundo…</div></div></div>';
    return h;
  }
  if(_soloPub&&!_pub&&!_flt){
    h+='<div class="card" style="padding:26px;text-align:center;color:var(--muted);font-size:13px">Cargando competencias…</div></div>';
    return h;
  }
  if(_flt){
    const nD=DATA.events.filter(_verEv).length;
    h+='<div class="card" style="margin-bottom:18px;padding:14px 18px;border:1px solid rgba(212,168,67,.45);background:rgba(212,168,67,.07);display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:200px"><div class="os" style="font-size:15px;letter-spacing:1px;color:var(--gold)">'+esc(_flt.name)+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:2px">Elige el día que quieres '+(_adminReal?'operar':'seguir')+' — son '+nD+' jornadas.</div></div>'
      // Salir del campeonato es una acción de operador: al espectador no se le
      // ofrece, porque no tiene por qué ver el resto de lo que hay cargado.
      +(_adminReal?'<button onclick="window._EV_FILTER=null;R()" style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer">Cambiar de competencia</button>':'')
    +'</div>';
  }
  let _vistos=0;
  DATA.events.forEach((ev,i)=>{
    if(!_verEv(ev))return;
    _vistos++;
    // Conteo de atletas: usa el de Firestore (LIVE_EVENT_META) si el local es 0
    const fbCount = (window.LIVE_EVENT_META && window.LIVE_EVENT_META[ev.id] && window.LIVE_EVENT_META[ev.id].athleteCount) || 0;
    const athCount = ev.athletes.length || fbCount;
    h+='<div class="card" style="cursor:pointer;transition:all .2s" onclick="pickEvent('+i+')" onmouseenter="this.style.borderColor=\'var(--accent)\'" onmouseleave="this.style.borderColor=\'var(--border)\'"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="os" style="font-size:18px;font-weight:700">'+ev.name+'</div><p style="color:var(--muted);font-size:12px;margin-top:4px">'+(ev.organizer||'')+' \u00b7 '+(ev.location||'')+(ev._fromFirestore?' \u00b7 <span style="color:var(--gold)">creado en admin</span>':'')+(ev.date?' \u00b7 <span style="color:var(--gold)">'+_fechaEv(ev.date)+'</span>':'')+'</p>'+_sesEv(ev)+'</div><div style="text-align:right"><div style="background:var(--accent);color:#fff;padding:4px 14px;border-radius:20px;font-size:14px;font-weight:700;font-family:Oswald">'+athCount+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">atletas</div></div></div></div>'});
  if(_soloPub&&!_vistos){
    h+='<div class="card" style="padding:30px 22px;text-align:center">'
      +'<div class="os" style="font-size:15px;letter-spacing:1px;color:var(--gold);margin-bottom:6px">NO HAY COMPETENCIAS EN VIVO</div>'
      +'<div style="color:var(--muted);font-size:13px;line-height:1.5">Cuando haya una transmitiéndose, aparece acá.</div></div>';
  }
  h+='</div>';return h;
}

function renderShell(){
  const flights=[...new Set(DATA.athletes.map(a=>a.flight))].filter(_inTarima).sort(_cmpFl);
  // Si el rol no puede abrir esta página (el juez en Control TX, la cuenta de
  // streaming en Atletas & Pesaje…) se lo manda a la primera que sí tenga. Va
  // ANTES de dibujar el menú para que quede marcada la que realmente se abre.
  if(isAdmin&&!window._canAccess(DATA.phase))DATA.phase=window._canAccess('manage')?'manage':'director';
  const p=DATA.phase;
  // El botón "Volver a YourLift" sobre el logo (estilo unificado)
  let h='<button class="hamb" onclick="toggleNav()" aria-label="Menú"><i class=yl-i-menu></i></button>';
  h+='<div class="nav-backdrop" onclick="toggleNav(false)"></div>';
  h+='<div class="shell"><div class="side">';
  h+='<button class="nav-close" onclick="toggleNav(false)" aria-label="Cerrar menú"><i class=yl-i-cerrar></i></button>';
  h+='<a href="index.html" class="side-back-yl" style="display:flex;align-items:center;gap:6px;padding:8px 12px;margin-bottom:12px;margin-right:42px;background:rgba(10,22,40,.6);border:1px solid rgba(212,168,67,.4);border-radius:8px;color:rgba(220,230,245,.85);font-family:Oswald,sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;text-decoration:none;cursor:pointer;transition:all .15s;flex-shrink:0;white-space:nowrap" onmouseenter="this.style.borderColor=\'#D4A843\';this.style.color=\'#D4A843\'" onmouseleave="this.style.borderColor=\'rgba(212,168,67,.4)\';this.style.color=\'rgba(220,230,245,.85)\'">← YourLift</a>';
  h+='<div class="logo"><img src="YourLift_logo.png" style="height:28px" onerror="this.remove()"> YourLift</div><div class="event-name-side" style="font-size:11px;color:var(--muted);margin-bottom:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+((DATA.event==null?void 0:DATA.event.short)||(DATA.event==null?void 0:DATA.event.name)||'')+'</div>';
  if(isAdmin){
  if(window._canAccess('manage'))h+='<div class="side-label">Gesti\u00f3n</div><button class="side-btn '+(p==='manage'?'active':'')+'" onclick="go(\'manage\')"><span class="icon"><i class=yl-i-lista></i></span>Atletas & Pesaje</button>';
  // Todo lo que se imprime para la mesa. Sali\u00f3 de Atletas & Pesaje, donde eran
  // cinco botones apretados en la barra de arriba y ya no cab\u00EDan.
  if(window._canAccess('docs'))h+='<button class="side-btn '+(p==='docs'?'active':'')+'" onclick="go(\'docs\')"><span class="icon"><i class=yl-i-archivo></i></span>Documentos</button>';
  h+='<div class="side-label">'+(window._esStreaming()?'Transmisi\u00f3n':'Competencia')+'</div>';
  if(window._canAccess('compete'))h+='<button class="side-btn '+(p==='compete'?'active':'')+'" onclick="go(\'compete\')"><span class="icon"><i class=yl-i-pesa></i></span>Control en Vivo</button>';
  // "Scoreboard" se sacó del menú: era una pantalla vieja de proyección que quedó
  // reemplazada por Pantalla de Tarima. Las descargas del acta NO estaban ahí, están
  // en Resultados, así que no se pierde nada.
  if(window._canAccess('transmision'))h+='<button class="side-btn '+(p==='transmision'?'active':'')+'" onclick="go(\'transmision\')"><span class="icon"><i class=yl-i-video></i></span>Transmisi\u00f3n</button>';
  if(window._canAccess('obsTx'))h+='<button class="side-btn '+(p==='obsTx'?'active':'')+'" onclick="go(\'obsTx\')"><span class="icon"><i class=yl-i-capas></i></span>Widgets OBS</button>';
  if(window._canAccess('director'))h+='<button class="side-btn '+(p==='director'?'active':'')+'" onclick="go(\'director\')"><span class="icon"><i class=yl-i-ajustes></i></span>Control TX</button>';
  if(window._canAccess('remote'))h+='<button class="side-btn '+(p==='remote'?'active':'')+'" onclick="go(\'remote\')"><span class="icon"><i class=yl-i-telefono></i></span>Control Remoto</button>';
  if(window._canAccess('screen'))h+='<button class="side-btn '+(p==='screen'?'active':'')+'" onclick="go(\'screen\')"><span class="icon"><i class=yl-i-pantalla></i></span>Pantalla Tarima</button>';
  }
  h+='<div class="side-label">P\u00fablico</div>';
  // "Competencia en Vivo": para el espectador (no admin) es su vista principal, as\u00ed
  // puede volver a ella despu\u00e9s de ir a Resultados/Atletas. Para el admin se mantiene
  // oculta (tiene su propio "Control en Vivo"), como se pidi\u00f3.
  if(!isAdmin)h+='<button class="side-btn '+(p==='liveView'?'active':'')+'" onclick="go(\'liveView\')"><span class="icon"><i class=yl-i-video></i></span>Competencia en Vivo</button>';
  h+='<button class="side-btn '+(p==='results'?'active':'')+'" onclick="go(\'results\')"><span class="icon"><i class=yl-i-trofeo></i></span>Resultados</button>';
  h+='<button class="side-btn '+(p==='atletaInfo'?'active':'')+'" onclick="go(\'atletaInfo\')"><span class="icon"><i class=yl-i-usuario></i></span>Atletas</button>';
  if(window._ensayoFree)h+='<button class="side-btn" onclick="ensayoToggleRole()" style="border:1px solid rgba(96,165,250,.5);color:#60a5fa;margin-top:4px"><span class="icon">'+(isAdmin?'<i class=yl-i-ojo></i>':'<i class=yl-i-ajustes></i>')+'</span>'+(isAdmin?'Cambiar a modo espectador':'Cambiar a modo admin')+'</button>';
  // Vuelo activo, primero por día. Con 36 tandas —A hasta AJ, ocho días— la tira
  // completa era una pared de botones donde encontrar el propio era contar
  // letras. Se elige el día y quedan las cuatro o cinco de ese día, igual que en
  // Control en Vivo, Competencia en Vivo y Atletas & Pesaje: misma fila, misma
  // forma de óvalo, y cada pantalla se acuerda del día que estaba mirando.
  //
  // Elegir el día NO mueve la tarima: solo filtra los botones. Mover la tarima
  // sigue siendo apretar una tanda, como siempre.
  const _fdLat=_filaDias('lateral',flights,_diaDeTanda(DATA.flight));
  h+='<div class="side-label">Vuelo Activo</div>';
  h+=_fdLat.html;
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';
  _fdLat.tandas.forEach(f=>{const n=DATA.athletes.filter(a=>a.flight===f&&!a.bombed).length;h+='<button onclick="DATA.flight=\''+f+'\';saveNow();R()" style="flex:1;min-width:36px;padding:6px 0;border-radius:6px;border:2px solid '+(DATA.flight===f?FL_C[f]||'var(--muted)':'var(--border)')+';background:'+(DATA.flight===f?(FL_C[f]||'#666')+'22':'transparent')+';color:'+(DATA.flight===f?FL_C[f]||'#fff':'var(--muted)')+';font-family:Oswald;font-size:12px;font-weight:700;cursor:pointer">'+f+'<span style="font-size:9px;opacity:.6;display:block">'+n+'</span></button>'});
  h+='</div>';
  // Fondo de la interfaz \u2014 preferencia de esta pantalla, no se sincroniza.
  h+='<div class="side-label" style="margin-top:14px">Fondo</div><div style="display:flex;gap:4px">';
  Object.keys(LC_FONDOS).forEach(k=>{const f=LC_FONDOS[k],on=window.lcFondo===k;
    h+='<button onclick="setFondoLC(\''+k+'\')" title="'+f.n+'" style="flex:1;padding:7px 0;border-radius:6px;border:2px solid '+(on?'var(--gold)':'var(--border)')+';background:'+f.bg+';color:'+(on?'var(--gold)':'var(--muted)')+';font-family:Oswald;font-size:10px;font-weight:700;letter-spacing:.5px;cursor:pointer">'+f.n.split(' ')[0].toUpperCase()+'</button>';});
  h+='</div>';
  if(isAdmin){
  h+='<div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--border)">';
  h+='<button class="side-btn" onclick="go(\'setup\')"><span class="icon"><i class=yl-i-trofeo></i></span>Selecci\u00F3n de Campeonato</button>';
  // En PRÁCTICA no hay sincronización (Firebase deshabilitado o en solo-lectura),
  // así que el estado de sync y el selector Controlador/Espectador no aplican:
  // se ocultan para no confundir a quien está entrenando.
  if(!PRACTICE_MODE){
  h+='<div style="font-size:10px;color:var(--green);margin-bottom:6px;padding:0 8px"><i class=yl-i-candado></i> Admin</div>';
  h+='<div style="font-size:9px;color:'+(fbReady?'var(--green)':'var(--muted)')+';padding:0 8px;margin-bottom:6px">'+(fbReady?'<i class=yl-i-video></i> Sync activo':'<i class=yl-i-espera></i> Conectando...')+'</div>';
  // \u2500\u2500 Modo de sincronizaci\u00F3n: Controlador (escribe) vs Espectador (lee/espeja) \u2500\u2500
  {const ctrl=!!window.IS_CONTROLLER;
   h+='<div style="margin:4px 8px 10px;padding:8px 10px;border-radius:8px;border:1px solid '+(ctrl?'rgba(34,197,94,.4)':'rgba(59,130,246,.4)')+';background:'+(ctrl?'rgba(34,197,94,.08)':'rgba(59,130,246,.08)')+'">'
     +'<div style="font-size:11px;font-weight:700;font-family:Oswald;letter-spacing:1px;color:'+(ctrl?'var(--green)':'#60a5fa')+'">'+(ctrl?'<i class=yl-i-ajustes></i> CONTROLADOR':'<i class=yl-i-ojo></i> ESPECTADOR')+'</div>'
     +'<div style="font-size:9px;color:var(--muted);margin:3px 0 7px;line-height:1.3">'+(ctrl?'Carga datos y se <b>sincroniza</b> con los dem\u00E1s controladores.':'Solo mira (no escribe). Ej.: pantalla u OBS.')+'</div>'
     +'<button onclick="setSyncMode('+(ctrl?'false':'true')+')" style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);font-family:Oswald;font-size:10px;letter-spacing:.5px;cursor:pointer">Cambiar a '+(ctrl?'<i class=yl-i-ojo></i> Espectador':'<i class=yl-i-ajustes></i> Controlador')+'</button>'
   +'</div>';}
  }
  // La cuenta de streaming no administra la competencia: no se le ofrece el backup
  // ni nada que borre datos. Solo entra, transmite y se va.
  if(!window._esStreaming()){
  h+='<button class="side-btn" onclick="exportBackupJSON()"><span class="icon"><i class=yl-i-bajar></i></span>Exportar Backup</button>';
  // Solo se ofrece si hay Cronograma cargado (es la lista contra la que compara)
  // y si de verdad hay alguien de m\u00E1s: si no, es un bot\u00F3n peligroso al pedo.
  {let _aj=0;
   try{ const m=window._cronoFlightMap;
     if(m&&Object.keys(m).length)_aj=DATA.athletes.filter(a=>!_cronoLookup(m,a.name)).length; }catch(e){}
   if(_aj)h+='<button class="side-btn" onclick="limpiarAtletasAjenos()" style="color:#f59e0b;border:1px solid rgba(245,158,11,.5)" title="Saca a los atletas que no figuran en el Cronograma de este campeonato"><span class="icon"><i class=yl-i-alerta></i></span>'+_aj+' atleta'+(_aj>1?'s':'')+' de otro campeonato</button>';}
  if(_nomAplica())h+='<button class="side-btn" onclick="recargarNomina()" title="Vuelve a leer la nómina del archivo: entran los que se agregaron, salen los que se dieron de baja y se corrigen tandas y lotes. Conserva pesaje e intentos de los que siguen."><span class="icon">↻</span>Volver a cargar la nómina</button>';
  h+='<button class="side-btn" onclick="resetLiveData()" style="color:#ff8a8a"><span class="icon"></span>Reiniciar datos en vivo</button>';
  }
  h+='<button class="side-btn" onclick="doLogout()"><span class="icon"><i class=yl-i-candado></i></span>Cerrar sesi\u00f3n</button>';
  h+='</div>';
  }else{
  h+='<div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--border)">';
  h+='<div style="font-size:9px;color:'+(fbReady?'var(--green)':'var(--muted)')+';padding:0 8px;margin-bottom:6px">'+(fbReady?'<i class=yl-i-video></i> Datos en vivo':'<i class=yl-i-espera></i> Conectando...')+'</div>';
  h+='<button class="side-btn" onclick="go(\'setup\')"><span class="icon"><i class=yl-i-trofeo></i></span>Selecci\u00f3n de Campeonato</button>';
  // El bot\u00f3n de iniciar sesi\u00f3n sali\u00f3 de la barra: esta pantalla la mira el
  // p\u00fablico y no corresponde ofrecerle entrar. Pero la raz\u00f3n por la que estaba
  // sigue en pie: si al operador se le vence la sesi\u00f3n EN MEDIO de la competencia,
  // el livecast deja de guardar en silencio y sin una puerta habr\u00eda que salirse del
  // sistema para volver. Esa puerta ahora es Ctrl+Shift+L (ver m\u00e1s arriba): no se
  // ve, nadie la encuentra de casualidad, y el operador la tiene siempre.
  h+='</div>';
  }
  h+='</div><div class="main">';
  if(p==='manage'&&isAdmin)h+=renderManage();else if(p==='docs'&&isAdmin)h+=renderDocs();else if(p==='compete'&&isAdmin)h+=renderCompete();else if(p==='obsTx'&&isAdmin)h+=renderObsTx();else if(p==='director'&&isAdmin)h+=renderDirector();else if(p==='remote'&&isAdmin)h+=renderRemote();else if(p==='screen'&&isAdmin)h+=renderScreenControl();else if(p==='results')h+=renderResults();else if(p==='liveView')h+=renderLiveView();else if(p==='atletaInfo')h+=renderAtletaInfo();else if(!isAdmin&&(p==='manage'||p==='docs'||p==='compete'||p==='transmision'||p==='obsTx'||p==='director'||p==='remote'||p==='screen')){DATA.phase='liveView';h+=renderLiveView();}
  h+='</div></div>';return h;
}

// Helper para escapar HTML en strings interpolados (usado en renderDirector)
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function _evUrlListo(){ window._EV_ESPERANDO=false; window._EV_URL_PEND=false; }

// El link todavía no llevó a ninguna parte y la persona sigue en la lista sin
// haber elegido nada: todavía vale entrar al campeonato del link.
function _evUrlPendiente(){ return !!window._EV_URL_PEND&&DATA.phase==='setup'&&!DATA.event; }

// Nombre lindo del campeonato padre: el que tenga Firestore, si no el nombre de
// los días sin el " — Día N".
function _evParentName(id,hijos){
  const m=(window.LIVE_EVENT_META||{})[id];
  if(m&&m.name)return m.name;
  const n=String((hijos[0]||{}).name||id);
  return n.replace(/\s*[—-]\s*D[íi]a\s*\d+.*$/i,'').trim()||id;
}

function applyEventURLParam(){
  // Una sola espera a la vez: quien llame corta la que estaba en curso.
  clearTimeout(_applyEvtTimer);_applyEvtTimer=null;
  try{
    const p=new URLSearchParams(location.search).get('evento');
    if(!p){_evUrlListo();return;}
    if(!_applyEvtT0)_applyEvtT0=Date.now();
    const want=decodeURIComponent(p);
    // NOTA: acá ANTES había un atajo que, para widgets TX, armaba DATA.event usando
    // el slug crudo de la URL (ej. "regionalcentrosur") como name, sin buscar el
    // nombre real del evento en Firestore. El problema: fbDocId() arma el id del doc
    // de livecast_sync a partir de DATA.event.name — así que ese atajo hacía que el
    // widget (Control TX, Pantalla de Tarima, etc.) leyera/escribiera un documento
    // DISTINTO al que usa el resto de la app (que sí resuelve el nombre real más
    // abajo), y quedaba pegado en un estado viejo para siempre — ni un hard refresh
    // lo arregla, porque no es un problema de caché, es que apunta a otro documento.
    // Ahora los widgets TX pasan por la misma resolución de nombre real que el resto
    // (pasos 1-2 de abajo) antes de arrancar.
    // 0) ¿Es un CAMPEONATO de varios días? Los días traen parent=<id del campeonato>
    // en nominas.json, así que esto se resuelve sin depender de Firestore: se muestra
    // el selector con sus jornadas en vez de meter a la gente en un día cualquiera.
    if(!TX_MODE){
      const hijos0=(DATA.events||[]).filter(e=>e.parent===want);
      if(hijos0.length){
        const yaAdentro=DATA.event&&DATA.event.parent===want;
        if(!yaAdentro&&!(DATA.phase!=='setup'&&DATA.athletes&&DATA.athletes.length)){
          window._EV_FILTER={parent:want,name:(hijos0[0].parentName||_evParentName(want,hijos0))};
          // Elegir la jornada SÍ es lo que corresponde mostrar: el campeonato de
          // varios días no tiene atletas propios.
          _evUrlListo();
          _applyEvtRetries=0; DATA.phase='setup'; DATA.event=null; R(); return;
        }
      }
    }
    // 1) Buscar en DATA.events (ya populado desde Firestore via LIVE_EVENT_META)
    let i=(DATA.events||[]).findIndex(e=>e.id===want||e.name===want);
    let wanted=i>=0?DATA.events[i]:null;
    // 2) Si no está aún (Firestore todavía cargando), buscar directamente en LIVE_EVENT_META.
    if(!wanted&&window.LIVE_EVENT_META){
      const fbEntry=Object.entries(window.LIVE_EVENT_META).find(function(e){return e[0]===want||e[1].name===want});
      if(fbEntry){
        const id=fbEntry[0],meta=fbEntry[1];
        wanted={id:id,name:meta.name,organizer:meta.org||'',location:meta.location||'',athletes:[],_fromFirestore:true};
        if(!DATA.events)DATA.events=[];
        DATA.events.push(wanted);
        i=DATA.events.length-1;
        console.log('[LC] Evento resuelto desde Firestore: id='+id+' name='+meta.name);
      }
    }
    // 2.5) Resolver por SLUG: los links viejos de OBS traen el nombre "aplastado"
    // (ej. ?evento=regionalcentrosur). Sin esto, el widget no encontraba el evento
    // y caía al fallback de abajo usando el slug como NOMBRE → fbDocId() apuntaba a
    // otro documento (uno viejo) y la Pantalla de Tarima / Control TX mostraban
    // datos que no coincidían con lo que cargaba el control. Comparando sin
    // acentos/espacios/símbolos, el slug resuelve al evento real.
    if(!wanted){
      const _slg=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
      const ws=_slg(want);
      if(ws){
        const cands=[];
        (DATA.events||[]).forEach((e,idx)=>cands.push({e:e,i:idx,s:_slg(e.name),id:_slg(e.id)}));
        if(window.LIVE_EVENT_META)Object.entries(window.LIVE_EVENT_META).forEach(function(en){
          if(!(DATA.events||[]).some(e=>e.name===en[1].name))
            cands.push({e:{id:en[0],name:en[1].name,organizer:en[1].org||'',location:en[1].location||'',athletes:[],_fromFirestore:true},i:-1,s:_slg(en[1].name),id:_slg(en[0])});
        });
        // El match por "contiene" solo vale si es ÚNICO. Si no, agarraba cualquiera:
        // ?evento=Sudamericano_2026 entraba derecho al Día 1 porque su nombre
        // contiene el del campeonato. Con varios candidatos se espera al paso 3,
        // que resuelve el id exacto contra Firestore.
        const parciales=cands.filter(c=>c.s.includes(ws)&&ws.length>=8);
        let hit=cands.find(c=>c.s===ws||c.id===ws) || (parciales.length===1?parciales[0]:null);
        if(hit){
          wanted=hit.e;
          if(hit.i>=0)i=hit.i;
          else{if(!DATA.events)DATA.events=[];DATA.events.push(wanted);i=DATA.events.length-1;}
          console.log('[LC] Evento resuelto por slug "'+want+'" → '+wanted.name);
        }
      }
    }
    // 3) Si todavía no se encontró, se espera a que lleguen nominas.json y la
    //    lista de campeonatos de Firestore (ver _EV_ESPERA_MAX).
    if(!wanted){
      _applyEvtRetries++;
      const _todoLlego=!!(window._NOMINAS_LISTA&&window._EVENTOS_LISTA);
      if(!_todoLlego&&(Date.now()-_applyEvtT0)<_EV_ESPERA_MAX){
        // Los primeros intentos van seguidos: con buena conexión los datos llegan
        // en menos de medio segundo, y esperar 500 ms igual era medio segundo de
        // pantalla quieta que se podía ahorrar.
        _applyEvtTimer=setTimeout(applyEventURLParam,_applyEvtRetries<=6?150:500);
        if(_applyEvtRetries===1)console.log('[LC] Esperando que Firestore cargue el evento "'+want+'"...');
        return;
      }
      console.warn('[LC] No pude encontrar evento "'+want+'"'+(_todoLlego?'':' (Firestore no respondió)')+'. Verifica nombre/id.');
      // Se acabó la espera: ahora sí corresponde mostrar la lista, porque el link
      // no llevaba a ninguna parte. Y si en pantalla quedó la competencia de una
      // visita anterior, se saca: dejarla puesta es peor que mostrar la lista,
      // porque la persona cree que el QR la llevó ahí.
      //
      // _EV_URL_PEND queda encendido: si Firestore aparece más tarde con el
      // campeonato, el listener lo encuentra y entra (mientras la persona siga
      // en la lista sin haber elegido otro).
      window._EV_ESPERANDO=false;
      if(!TX_MODE&&!isAdmin&&DATA.phase!=='setup'&&(DATA.athletes==null?void 0:DATA.athletes.length)){
        DATA.phase='setup';DATA.event=null;DATA.athletes=[];DATA.changeTimers={};
        try{localStorage.removeItem(SAVE_KEY)}catch(e){}
      }
      if(!TX_MODE){R();return;}
      // Último recurso, SOLO para widgets TX de un evento que realmente no está en la
      // lista (ej. una sub-tarima generada sin doc propio en "eventos"): usar el slug
      // crudo como nombre, para no dejar el widget sin mostrar nada. Si el evento SÍ
      // existe con nombre real, el paso 1/2 de arriba ya lo habrá encontrado antes de
      // llegar hasta acá.
      wanted={id:want,name:want,athletes:[],_fromUrl:true};
    }
    // El campeonato apareció, pero todavía no se sabe si quien entra es admin:
    // Firebase contesta la sesión un momento después de la lista de campeonatos.
    // Entrar ya lo metía como público, y el admin que abría el link de su
    // campeonato caía en la vista del espectador. Se espera esa respuesta (con
    // el mismo tope de siempre, por si nunca llega).
    if(!TX_MODE&&fbReady&&!window._AUTH_LISTO&&(Date.now()-_applyEvtT0)<_EV_ESPERA_MAX){
      _applyEvtTimer=setTimeout(applyEventURLParam,150);
      return;
    }
    _applyEvtRetries=0;
    _evUrlListo();                   // el evento del link quedó resuelto
    // TX widget mode: read-only. Just set DATA.event y suscribir a livecast_sync.
    if(TX_MODE){
      DATA.event=wanted;
      // Los eventos que viven en nominas.json (los días del Sudamericano, los
      // ensayos) traen su nómina en el archivo. Si el widget arranca antes de que
      // algún control haya escrito en Firestore, se siembra desde ahí para que
      // Control TX y la Pantalla de Tarima muestren algo en vez de quedar en
      // blanco. Cuando llega el estado real por sync, lo reemplaza.
      if(!(DATA.athletes||[]).length&&Array.isArray(wanted.athletes)&&wanted.athletes.length){
        try{ DATA.athletes=wanted.athletes.map(_evAthlete);
             DATA.flight=[...new Set(DATA.athletes.map(a=>a.flight))].filter(_inTarima).sort(_cmpFl)[0]||DATA.flight;
             if(wanted.startLift==='bp'||wanted.startLift==='dl')DATA.lift=wanted.startLift;
             if([0,1,2].includes(+wanted.startRound))DATA.round=+wanted.startRound;
        }catch(e){console.warn('[TX] no pude sembrar la nómina',e);}
      }
      const tryStart=()=>{if(!fbReady){setTimeout(tryStart,300);return}startFBSync();
        // jornada/screen: el año de nacimiento se pide solo si falta (ver _yob2)
        if(TX_MODE==='screen'||TX_MODE==='jornada'){subscribeScreenChannel();}
        R();};
      tryStart();
      return;
    }
    // If already on this event with an active session, keep it.
    if(DATA.event&&(DATA.event.id===wanted.id||DATA.event.name===wanted.name)){_ensayoGrant();R();return}
    // Quedó cargado OTRO campeonato y el link pide este.
    //
    // Manda el link: quien escanea el QR del Sudamericano quiere el
    // Sudamericano. Antes esto borraba lo guardado y dejaba a la persona en la
    // LISTA de campeonatos —no entraba nunca al del link—, así que el QR
    // parecía roto. Ahora se descarta lo viejo y se entra al que pide.
    //
    // Sin preguntar, tampoco al admin. Se probó preguntarle —por si estaba
    // operando— y salía peor: en un teléfono con sesión de admin, con el
    // diálogo descartado o sin contestar, el QR dejaba a la persona en el
    // campeonato viejo. Además no se pierde nada: lo de este equipo está
    // guardado en el servidor y vuelve al elegir ese campeonato de nuevo, que
    // es exactamente lo que ya pasa al cambiar de competencia desde la lista.
    if(DATA.phase!=='setup'&&(DATA.athletes==null?void 0:DATA.athletes.length)){
      DATA.phase='setup';DATA.event=null;DATA.athletes=[];DATA.changeTimers={};
      try{localStorage.removeItem(SAVE_KEY)}catch(e){}
      try{ window._recentAtt={}; if(window._pendingEdits)window._pendingEdits.clear(); }catch(e){}
    }
    // Un campeonato que se corre en varios días (ej. el Sudamericano) no tiene
    // atletas propios: sus nueve días son eventos aparte con parent=<id>. Entrar
    // ahí no significa nada, así que se muestra el SELECTOR con esos días.
    const hijos=(DATA.events||[]).filter(e=>e.parent&&(e.parent===wanted.id||e.parent===wanted.name));
    if(hijos.length&&!(wanted.athletes||[]).length){
      window._EV_FILTER={parent:wanted.id||wanted.name,name:wanted.name||wanted.id};
      DATA.phase='setup';DATA.event=null;R();return;
    }
    // Fresh state: pick requested event directly.
    pickEvent(i);
  }catch(e){window._EV_ESPERANDO=false;console.warn('[LC] preselect err',e)}
}

function showLogin(){
  // Redirect to admin.html — admin login is centralized there
  if(confirm('Para acceder al modo Admin de YourLift debes iniciar sesión en el panel de administración.\n\n¿Ir a admin.html?')){
    sessionStorage.setItem('livecast_return','1');
    window.location.href='admin.html';
  }
}

async function doLogin(){showLogin();}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

window._esStreaming=function(){return window.ADMIN_ROLE==='streaming';};

window._canAccess=function(page){
  const role=window.ADMIN_ROLE;
  if(role==='streaming')return _PAGS_STREAMING.indexOf(page)>=0;
  if(role==='transmision'&&page==='compete')return false;
  if(role==='juez'&&page==='director')return false;
  return true;
};

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

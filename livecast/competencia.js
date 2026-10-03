// livecast.html — Control en Vivo: cargar pesos, dar resultados, avanzar la barra, cronómetros, cuarto intento y la planilla de competencia.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// Normaliza coma → punto para que 72,5 y 72.5 sean lo mismo
function parseWeight(v){return parseFloat(String(v==null?'':v).replace(',','.'))||0;}

function setAtt(id,l,r,val){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  const w=parseWeight(val);
  // Warn if change timer expired but still allow entry
  const key=id+'_'+l+'_'+r;
  const ct=DATA.changeTimers[key];
  // A tiempo es lo que se EMPEZÓ a escribir antes de que venciera: el peso se
  // guarda al salir de la casilla, y quien lo tecleó con 2 s restantes lo
  // terminaba de cargar ya vencido y le salía el aviso.
  const empezo=(window._ctEmpezoEn||{})[key];
  const aTiempo=ct&&typeof ct.startedAt==='number'&&empezo&&empezo<=ct.startedAt+60000;
  if(ct&&ct.expired&&!aTiempo){
    showToastLC('Timer expirado — peso ingresado igual');
  }
  if(window._ctEmpezoEn)delete window._ctEmpezoEn[key];
  if(w>0){
    // Rule: each attempt must be ≥ all previous attempts (successful or not)
    for(let prev=r-1;prev>=0;prev--){
      const p=a.att[l][prev];
      if(p.w>0&&w<p.w){
        showToastLC(a.name+': intento '+(r+1)+' ('+w+'kg) menor al intento '+(prev+1)+' ('+p.w+'kg) — bloqueado');
        const el=document.getElementById('ct_'+key);
        if(el)el.value=a.att[l][r].w||'';
        return;
      }
    }
    // Warn if weight seems unusually small vs category (< 50% of cat number)
    const catKg=parseFloat((a.cat||'').replace(/[^0-9.]/g,''))||0;
    if(catKg>0&&w<catKg*0.3){
      if(!confirm('El peso '+w+'kg parece muy bajo para la categoría '+a.cat+'. ¿Confirmar igualmente?')){
        const el=document.getElementById('ct_'+key);
        if(el)el.value=a.att[l][r].w||'';
        return;
      }
    }
  }
  a.att[l][r].w=w;
  _markAtt(id,'att_'+l+'_'+r);
  if(DATA.changeTimers[key])delete DATA.changeTimers[key];
  // El peso sale YA, sin esperar el debounce: es el dato que la pantalla de tarima
  // necesita para cargar la barra. Además setAtt corre en 'change' (una vez, al
  // salir de la casilla), así que acá no hay ráfaga de tecleo que juntar.
  saveNow();
  // Refrescar la UI para que la celda muestre el peso (no el countdown viejo)
  if(typeof R==='function')R();
}

// Cuándo se empezó a escribir el peso de un intento con minuto corriendo (la
// primera tecla). setAtt lo usa para no dar por tarde un peso que se empezó a
// cargar a tiempo.
function _ctEmpezo(key){
  const ct=DATA.changeTimers[key]; if(!ct||ct.expired)return;
  window._ctEmpezoEn=window._ctEmpezoEn||{};
  if(!window._ctEmpezoEn[key])window._ctEmpezoEn[key]=_ahora();
}

// ¿Este atleta tiene un intento EXTRA todavía sin levantar en este movimiento?
function _extraPendienteDe(a,l){ const at=(a&&a.att&&a.att[l]||[])[3]; return !!(at&&at.extra&&at.r===null); }

// Arranca (o cancela) el minuto para declarar el intento siguiente.
// No corre si el atleta tiene un intento EXTRA sin levantar: recién después de
// ese intento sabe con cuánto seguir, así que pedirle el peso antes —y hacerle
// sonar la alarma a los 60s— no tiene sentido. Cuando el extra se juzga, el
// minuto arranca ahí.
// Tampoco corre si el peso del siguiente ya estaba cargado.
//
// Una CORRECCIÓN de una decisión ya tomada (corrige=true) no toca el minuto: ni
// lo reinicia ni lo borra. Antes lo volvía a arrancar desde 60 —se pensó que el
// atleta podía querer cambiar su peso—, pero en la mesa eso le regalaba un
// minuto entero a quien ya venía con el reloj corriendo, y descuadraba la
// entrega del intento siguiente. Pedido así por la mesa.
function _armarChangeTimer(a,l,rSig,corrige){
  if(!a||!(rSig>=0)||rSig>2)return;
  if(corrige)return;
  const key=a.id+'_'+l+'_'+rSig;
  const yaTienePeso=a.att[l][rSig]&&a.att[l][rSig].w;
  if(window._CT_ENABLED && !yaTienePeso && !_extraPendienteDe(a,l)){
    DATA.changeTimers[key]={remaining:60,expired:false,startedAt:_ahora()};
    startCT(key);
  } else if(DATA.changeTimers[key]){
    delete DATA.changeTimers[key];
  }
}

function setResult(id,l,r,res){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  // Foto de los récords ANTES de esta decisión: si la marca los mueve, hay que
  // saber contra qué estaban tirando los demás para reacomodar sus declarados.
  const _hoyAntes=(res==='g'&&_srOn())?_srHoyCalc():null;
  const _corrige=(a.att[l][r].r==='g'||a.att[l][r].r==='n')&&a.att[l][r].r!==res;
  a.att[l][r].r=res;
  _markAtt(id,'att_'+l+'_'+r);
  if(_hoyAntes)_srAvisarSubidas(_srSubirDeclarados(_hoyAntes));
  _clearCompIfJudged(id,l,r);
  // Al juzgar el EXTRA, el minuto del intento siguiente arranca recién ahora.
  // Corregir una decisión —de válido a nulo, o al revés— no lo toca (ver
  // _armarChangeTimer).
  if(r===3) _armarChangeTimer(a,l,((__n=>__n!=null?__n:(DATA.round))((a.att[l][3]||{}).grantedRound))+1,_corrige);
  else if(r<2) _armarChangeTimer(a,l,r+1,_corrige);
  // NOTA: si falla los 3 intentos de un lift, queda DQ para el total
  // pero NO bombed (sigue compitiendo en los lifts siguientes).
  // bombed solo si falla los 9 intentos del meet completo.
  if(a.att.sq.every(x=>x.r==='n')&&a.att.bp.every(x=>x.r==='n')&&a.att.dl.every(x=>x.r==='n'))a.bombed=true;
  // Reset timer y arrancar automáticamente para el próximo atleta
  // Record alert: check if this good lift breaks a national record
  if(res==='g')checkRecord(a,l,r);
  // Reset judge lights for next athlete
  if(judgeMode)resetJudgeLights();
  // El reloj que mostró la Planilla era de este intento: con la decisión se va.
  if(!_corrige)DATA.relojVisible=false;
  saveNow();R();
  // Auto-advance: if liftQueue is now empty, round is done
  const snapLift=DATA.lift,snapRound=DATA.round;
  if(liftQueue().length===0){
    // 1,5 s: alcanza para ver el aviso y corregir un toque equivocado. Antes eran
    // 3, y la mesa los sentía en cada cambio de ronda.
    showToastLC('Ronda completada — avanzando…');
    setTimeout(()=>{if(DATA.lift===snapLift&&DATA.round===snapRound)advanceLift();},1500);
  }
}

// Confirmación antes de tocar una decisión YA tomada (pedido del operador):
// - misma decisión otra vez (✓ sobre ✓ / ✗ sobre ✗) → anula → "¿seguro de ANULAR?"
// - decisión contraria → revierte → "¿seguro de REVERTIR?"
// Primera decisión de un intento sin juzgar: sin confirmación (flujo normal rápido).
function _confirmDecisionChange(a,l,r,res){
  const prev=a.att[l][r].r;
  if(prev!=='g'&&prev!=='n')return true;
  const lbl=prev==='g'?'VÁLIDO':'NULO';
  const att=LIFT_S[l]+(r+1);
  if(res===prev){
    return confirm('¿Estás seguro de ANULAR la decisión?\n\n'+a.name+' — '+att+' está marcado como '+lbl+'.\nEl intento quedará SIN decisión (pendiente de nuevo).');
  }
  const newLbl=res==='g'?'VÁLIDO':'NULO';
  return confirm('¿Estás seguro de REVERTIR la decisión?\n\n'+a.name+' — '+att+': pasa de '+lbl+' a '+newLbl+'.');
}

function overrideResult(id,l,r,res){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(!_confirmDecisionChange(a,l,r,res))return;
  // Toggle: clicking same result clears it
  const wasSame=(a.att[l][r].r===res);
  // ¿Es una corrección de una decisión ya tomada, o la primera decisión del intento?
  // De eso depende que el minuto vuelva a arrancar aunque el peso siguiente ya esté.
  const _corrige=!wasSame&&(a.att[l][r].r==='g'||a.att[l][r].r==='n');
  const _hoyAntes=(!wasSame&&res==='g'&&_srOn())?_srHoyCalc():null;
  a.att[l][r].r=wasSame?null:res;
  _markAtt(id,'att_'+l+'_'+r);
  if(_hoyAntes)_srAvisarSubidas(_srSubirDeclarados(_hoyAntes));
  // Si este intento era el forzado como "actual" a mano, se juzgó → volver al orden
  // automático normal (queue).
  if(!wasSame && res && DATA.forcedCurrent===id)DATA.forcedCurrent=null;
  if(!wasSame && res)_clearCompIfJudged(id,l,r);
  // bombed = TODOS los 9 intentos fallidos (atleta totalmente fuera).
  // Si solo falla los 3 de un lift → queda DQ pero sigue compitiendo en los otros.
  a.bombed=a.att.sq.every(x=>x.r==='n')&&a.att.bp.every(x=>x.r==='n')&&a.att.dl.every(x=>x.r==='n');
  // Si MARCAMOS un resultado (no limpiamos), arrancar timer para el siguiente atleta.
  // Si era el current lifter en current round, también activar change timer para el próximo intento.
  // Si MARCAMOS la primera decisión del intento, arranca el reloj del atleta
  // siguiente. Una CORRECCIÓN no toca ningún reloj: ni el de tarima ni el minuto
  // de entrega del intento siguiente (antes los dos volvían a 60).
  if(!wasSame && res && !_corrige){
    // Igual que en setResult: al juzgar el EXTRA arranca el minuto del siguiente,
    // y mientras el extra siga pendiente no arranca ninguno.
    if(r===3) _armarChangeTimer(a,l,((__n=>__n!=null?__n:(DATA.round))((a.att[l][3]||{}).grantedRound))+1,false);
    else if(l===DATA.lift && r===DATA.round && r<2) _armarChangeTimer(a,l,r+1,false);
    DATA.timer=60;DATA.timerOn=false;clearInterval(mainTI);mainTI=null;
    setTimeout(()=>{if(typeof startTimer==='function')startTimer();},150);
    // Si los jueces también estaban votando, sus luces se apagan para el siguiente.
    if(judgeMode)resetJudgeLights();
    // El reloj que mostró la Planilla era de este intento: con la decisión se va.
    DATA.relojVisible=false;
  }
  saveNow();R();
  // Auto-advance: si la cola de levantamientos quedó vacía, avanzar de ronda automáticamente
  if(!wasSame && res){
    const snapLift=DATA.lift, snapRound=DATA.round;
    if(liftQueue().length===0){
      // 1,5 s: alcanza para ver el aviso y corregir un toque equivocado. Antes
      // eran 3, y la mesa los sentía en cada cambio de ronda. La pantalla de
      // barra ya no espera este avance: muestra la barra que viene apenas se
      // cierra la ronda (ver _conCursorQueViene).
      showToastLC('Ronda completada — avanzando…');
      setTimeout(()=>{
        if(DATA.lift===snapLift && DATA.round===snapRound) advanceLift();
      }, 1500);
    }
  }
}

// Cambiar / revocar la decisión de un intento YA juzgado (corrección del jurado),
// SIN efectos colaterales: no reinicia el cronómetro de tarima, no arranca change
// timers ni auto-avanza la ronda. Alterna: tocar la misma decisión la borra.
function changeResult(id,l,r,res){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(!_confirmDecisionChange(a,l,r,res))return;
  const wasSame=(a.att[l][r].r===res);
  a.att[l][r].r=wasSame?null:res;
  _markAtt(id,'att_'+l+'_'+r);
  if(!wasSame && res)_clearCompIfJudged(id,l,r);
  a.bombed=a.att.sq.every(x=>x.r==='n')&&a.att.bp.every(x=>x.r==='n')&&a.att.dl.every(x=>x.r==='n');
  saveNow();R();
  showToastLC(wasSame?'↺ '+a.name+' — '+LIFT_S[l]+(r+1)+': decisión revocada'
    :(res==='g'?a.name+' — '+LIFT_S[l]+(r+1)+': cambiado a VÁLIDO'
                :a.name+' — '+LIFT_S[l]+(r+1)+': cambiado a NULO'));
}

function updA(id,k,v){const a=DATA.athletes.find(x=>x.id===id);if(!a)return;if(k==='bw')a.bw=parseFloat(v)||0;else a[k]=v;_markAtt(id,'meta');save()}

// ¿Salió de verdad la escritura al servidor?
//
// Esto se miraba UNA vez, 1,2 segundos después de mandar. El documento del
// Sudamericano pesa un mega —cuatrocientos y tantos atletas con sus nueve
// intentos cada uno—, así que desde un iPad tarda bastante más que eso en
// subir: el aviso de "NO se pudo guardar" salía mientras la escritura iba en
// camino, y era mentira. En el peor momento posible, además, porque manda a
// repetir una operación que ya estaba hecha.
//
// Ahora se espera a que confirme —hasta veinte segundos— y recién ahí se avisa.
function _confirmarPublicado(ok, falla){
  const okAntes=_fbLastOk, t0=Date.now();
  (function mirar(){
    if(_fbLastOk!==okAntes){ ok(); return; }
    if(Date.now()-t0>20000){ falla(); return; }
    setTimeout(mirar,400);
  })();
}

function startCT(key){/* just mark it active, master tick handles updates */}

// Info del tiempo compensatorio activo (o null). remaining puede ser negativo.
function _compInfo(){
  const c=DATA.compTimer;
  if(!c||!c.startedAt)return null;
  const a=DATA.athletes.find(x=>x.id===c.id);
  if(!a)return null;
  const remaining=(c.min*60)-Math.floor((_ahora()-c.startedAt)/1000);
  const neg=remaining<0;const abs=Math.abs(remaining);
  const mmss=(neg?'-':'')+Math.floor(abs/60)+':'+String(abs%60).padStart(2,'0');
  return {a,lift:c.lift,min:c.min,remaining,mmss,neg};
}

function showChangeExpiredAlert(name,lift,rnd){
  // Banner rojo + pitido DESACTIVADOS (se veian en transmision).
  // El estado de expirado sigue marcado en la tabla (icono reloj) y bloquea
  // cambios de intento, pero ya no hay alerta visual/sonora global.
  document.querySelectorAll('.ct-expired-banner').forEach(e=>e.remove());
  return;
  // (codigo original abajo: deshabilitado)
  const div=document.createElement('div');
  div.className='ct-expired-banner';
  div.style.cssText='position:fixed;top:0;left:0;right:0;background:#C41E3A;color:#fff;padding:10px 20px;z-index:9998;display:flex;justify-content:space-between;align-items:center;font-family:Oswald;font-size:14px;letter-spacing:1px;animation:pulseRed 1s infinite';
  div.innerHTML='<i class=yl-i-reloj></i> TIEMPO EXPIRADO — '+name.toUpperCase()+' · '+LIFT_S[lift]+(rnd+1)+' — <span style="font-size:11px;opacity:.8">El cambio de intento ya no es válido</span><button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:3px 12px;border-radius:4px;cursor:pointer;font-family:Oswald;font-size:11px;margin-left:12px"><i class=yl-i-cerrar></i></button>';
  document.body.appendChild(div);
  // Beep via AudioContext
  try{const ac=new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator();const g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type='square';o.frequency.setValueAtTime(880,ac.currentTime);g.gain.setValueAtTime(0.3,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);o.start(ac.currentTime);o.stop(ac.currentTime+0.4);}catch(e){}
  setTimeout(()=>{if(div.parentElement)div.remove();},8000);
}

// Arrancar dos veces no deja dos relojes corriendo: el segundo intervalo quedaba
// suelto, seguía descontando aunque se pausara y el reloj parecía pegado.
function startTimer(isLocal){if(mainTI){clearInterval(mainTI);mainTI=null;}window._iOwnTimer=(isLocal!==false);DATA.timerOn=true;if(window._iOwnTimer)DATA.timerStartedAt=_ahora()-((60-(DATA.timer||60))*1000);if(!DATA.timerStartedAt)DATA.timerStartedAt=_ahora();if(window._iOwnTimer){_ultLatidoTimer=0;syncToFB();}mainTI=setInterval(()=>{DATA.timer=Math.max(0,60-Math.floor((_ahora()-DATA.timerStartedAt)/1000));const el=document.getElementById('mainTimer');if(el){const c=DATA.timer<=10?'var(--red)':DATA.timer<=30?'var(--orange)':'var(--green)';el.style.color=c;el.textContent=Math.floor(DATA.timer/60)+':'+String(DATA.timer%60).padStart(2,'0');el.style.animation=DATA.timer<=10?'pulse 1s infinite':'none'}const sb=document.getElementById('sbTimer');if(sb){sb.textContent=Math.floor(DATA.timer/60)+':'+String(DATA.timer%60).padStart(2,'0');sb.style.color=DATA.timer<=10?'var(--red)':DATA.timer<=30?'var(--orange)':'var(--green)'}const tx=document.getElementById('txTimer');if(tx){tx.textContent=String(Math.floor(DATA.timer/60)).padStart(2,'0')+':'+String(DATA.timer%60).padStart(2,'0');tx.style.color=DATA.timer<=10?'#ef4444':'#fff'}const txp=document.getElementById('txTimerPanel');if(txp){txp.textContent=String(Math.floor(DATA.timer/60)).padStart(2,'0')+':'+String(DATA.timer%60).padStart(2,'0');txp.style.color=DATA.timer<=10?'#ef4444':DATA.timer<=30?'#f59e0b':'#ffffff'}const pit=document.getElementById('pantIntentosTimer');if(pit){pit.textContent=Math.floor(DATA.timer/60)+':'+String(DATA.timer%60).padStart(2,'0');pit.style.color=DATA.timerOn&&DATA.timer<=10?'#ef4444':DATA.timerOn&&DATA.timer<=30?'#f59e0b':'#22c55e'}['sbRelojTx','pantBarraTimer','pantIntRelojPlan'].forEach(id=>{const r=document.getElementById(id);if(r){r.textContent=_relojTxt();r.style.color=_relojColor();}});if(window._iOwnTimer)syncTimerOnlyToFB();if(DATA.timer<=0){DATA.timerOn=false;clearInterval(mainTI);mainTI=null;if(window._iOwnTimer)syncToFB()}},1000)}

function pauseTimer(){DATA.timerOn=false;clearInterval(mainTI);mainTI=null;syncToFB()}

function resetTimer(){DATA.timer=60;DATA.timerOn=false;clearInterval(mainTI);mainTI=null;const el=document.getElementById('mainTimer');if(el){el.style.color='var(--green)';el.textContent='1:00';el.style.animation='none'}syncToFB()}

function _flightDoneWithLift(fl,lift){
  const athletes=DATA.athletes.filter(a=>a.flight===fl&&!a.bombed);
  if(!athletes.length)return true;
  return athletes.every(a=>[0,1,2].every(r=>{const at=a.att[lift][r];return at.r!==null||at.w===0;}));
}

// Avanza al siguiente intento/tanda/lift cuando la tanda activa termina su ronda actual.
// Flujo: dentro de la misma tanda, ronda 1→2→3 del lift activo. Al terminar la ronda 3,
// si QUEDAN otras tandas sin terminar ese lift, salta a la siguiente (alfabético, cíclico) —
// así primero se hace sentadilla en A, B y C antes de pasar a banca. Cuando TODAS las
// tandas terminan el lift activo, pasa al siguiente lift arrancando en la primera tanda
// con trabajo pendiente ahí (normalmente vuelve a la A). Con una sola tanda, este mismo
// código simplemente avanza de lift sin saltar de tanda (no hay a dónde saltar).
// Intentos extra de este lift, en esta tanda, que todavía no se levantaron.
// Incluye los que aún no tienen el peso declarado: son justamente los que se
// perdían: sin peso no entran en la cola, la ronda parecía terminada y al
// avanzar el intento quedaba colgado sin que nadie se diera cuenta.
function _extrasPendientes(l){
  l=l||DATA.lift;
  return DATA.athletes.filter(a=>a.flight===DATA.flight&&!a.bombed&&(()=>{
    const at=(a.att[l]||[])[3]; return at&&at.extra&&at.r===null;
  })());
}

function advanceLift(){
  // El extra "al final de la ronda" se toma al cerrar SU ronda: no se puede
  // pasar de largo sin avisar.
  {const pend=_extrasPendientes(DATA.lift);
   if(pend.length){
     const det=pend.map(a=>{const at=a.att[DATA.lift][3];
       return '• '+a.name+(at.w>0?(' — '+at.w+' kg'):' — sin peso declarado')
              +(at.mode==='self'?' (se sigue a sí mismo)':' (al final de la ronda)');}).join('\n');
     if(!confirm('Queda intento extra sin levantar en '+(LIFT_N[DATA.lift]||DATA.lift)+', tanda '+DATA.flight+':\n\n'+det
       +'\n\nSe toma al final de la ronda, antes de seguir.\n\n¿Avanzar igual?'))return;
   }}
  const c=_cursorSiguiente();
  if(!c){go('results');return;}
  DATA.flight=c.flight;DATA.lift=c.lift;DATA.round=c.round;
  saveNow();R();
  if(c.jornada!==undefined){
    const _ses=_sesionEtiqueta(c.flight)||c.jornada||'la sesión siguiente';
    const _fls=_flightsDeJornada(c.flight);
    showToastLC('Empieza '+_ses+' — tanda'+(_fls.length>1?'s '+_fls.join(' y '):' '+c.flight));
  }
}

// A dónde avanza la competencia cuando se cierra la ronda actual, SIN moverla.
// Es la única regla de avance: la usa advanceLift() para avanzar y la pantalla
// de barra para mostrar, mientras tanto, la barra que viene. Por eso las dos no
// pueden discrepar. Devuelve {flight,lift,round} (+ jornada si cambia de sesión)
// o null si ya no queda nada: terminó el campeonato.
function _cursorSiguiente(){
  // Solo las tandas de ESTA sesión: la mañana no salta a la tarde a mitad de un
  // movimiento. Con jornadas cargadas queda sentadilla A-B-C, banca A-B-C, peso
  // muerto A-B-C, y recién ahí empieza la tarde con la D y la E.
  const flights=_flightsDeJornada(DATA.flight);
  const li=LIFTS.indexOf(DATA.lift);
  if(DATA.round<2)return {flight:DATA.flight,lift:DATA.lift,round:DATA.round+1};
  const pending=flights.filter(fl=>fl!==DATA.flight&&!_flightDoneWithLift(fl,DATA.lift));
  if(pending.length){
    const idx=flights.indexOf(DATA.flight);
    const rotated=[...flights.slice(idx+1),...flights.slice(0,idx)];
    return {flight:rotated.find(fl=>pending.includes(fl))||pending[0],lift:DATA.lift,round:0};
  }
  if(li<2){
    const nextLift=LIFTS[li+1];
    return {flight:flights.find(fl=>!_flightDoneWithLift(fl,nextLift))||flights[0]||DATA.flight,lift:nextLift,round:0};
  }
  // Terminó el peso muerto de toda la sesión → arranca la sesión siguiente
  // (la tarde) por su primera tanda y de nuevo en sentadilla, intento 1.
  const js=_jornadasEnOrden(), jAct=_jornadaDeFlight(DATA.flight);
  const sig=js[js.indexOf(jAct)+1];
  if(sig!==undefined){
    const fs=_allFlightsSorted().filter(f=>_jornadaDeFlight(f)===sig)
      .filter(f=>LIFTS.some(l=>!_flightDoneWithLift(f,l)));
    if(fs.length)return {flight:fs[0],lift:'sq',round:0,jornada:sig};
  }
  return null;
}

// ¿La ronda que se está corriendo ya terminó y la competencia está por avanzar?
// Cola vacía no alcanza: al arrancar una tanda la cola también está vacía, porque
// nadie declaró todavía. Tiene que haber al menos un intento juzgado en la ronda,
// y ningún extra pendiente (esos se levantan antes de avanzar).
function _rondaCerrada(){
  if(liftQueue().length)return false;
  if(_extrasPendientes(DATA.lift).length)return false;
  return DATA.athletes.some(a=>{
    if(a.flight!==DATA.flight||a.bombed)return false;
    const t=(a.att[DATA.lift]||[])[DATA.round];
    return !!(t&&t.r!==null);
  });
}

// Dibuja con el cursor de lo que viene si la ronda está cerrada; si no, con el de
// siempre. Es para las pantallas de tarima: entre que se juzga el último intento
// de la ronda y que la competencia avanza, la cola queda vacía y la pantalla de
// barra caía a "el primer atleta de la tanda" —cualquiera, con el peso de la
// ronda que ya terminó—. Los cargadores armaban esa barra y después había que
// desarmarla: diez, quince segundos perdidos en cada cambio de ronda. Ahora
// muestra de una la barra del que abre la ronda siguiente.
function _conCursorQueViene(fn){
  let c=null;
  try{ if(_rondaCerrada())c=_cursorSiguiente(); }catch(e){ c=null; }
  if(!c)return fn();
  const g={flight:DATA.flight,lift:DATA.lift,round:DATA.round,fc:DATA.forcedCurrent};
  DATA.flight=c.flight;DATA.lift=c.lift;DATA.round=c.round;DATA.forcedCurrent=null;
  try{ return fn(); }
  finally{ DATA.flight=g.flight;DATA.lift=g.lift;DATA.round=g.round;DATA.forcedCurrent=g.fc; }
}

function _do4thAttempt(id,l,mode,compMin){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(a.att[l].length>=4)return;
  compMin=Math.max(0,Math.min(5,parseInt(compMin,10)||0));
  // El 4º pertenece a la RONDA ACTUAL (no crea una "INT 4"). Arranca con el mismo
  // peso del intento de esa ronda (se sigue a sí mismo = repite ese intento).
  const gr=(l===DATA.lift)?DATA.round:2; // si se agrega desde otro lift, asume 3ª ronda
  const prevW=(a.att[l][gr]&&a.att[l][gr].w)||(a.att[l][2]&&a.att[l][2].w)||0;
  a.att[l].push({w:prevW,r:null,extra:true,mode:mode,compMin:compMin,grantedRound:gr});
  _markAtt(id,'att_'+l+'_3');
  // El minuto para declarar el intento siguiente se cancela SIEMPRE, no solo con
  // "se sigue a sí mismo": mientras el extra no se levante, el atleta no sabe con
  // cuánto seguir. Vuelve a arrancar solo cuando el extra se da por válido o nulo
  // (ver _armarChangeTimer). Antes, con "al final de la ronda", el reloj le seguía
  // corriendo y le sonaba la alarma sin haber levantado todavía.
  {const nk=id+'_'+l+'_'+(gr+1);
   if(DATA.changeTimers[nk])delete DATA.changeTimers[nk];}
  // El reloj de 1:00 del "próximo intento" NO debe correr al conceder el extra: el
  // atleta primero espera / tiene su tiempo compensatorio. Se detiene y resetea a
  // 1:00; el operador lo inicia (botón ▶) cuando el extra se va a TIRAR.
  DATA.timer=60; DATA.timerOn=false; if(mainTI){clearInterval(mainTI);mainTI=null;}
  // Tiempo compensatorio a la vista (Control en Vivo + Pantalla de Tarima). No bloquea.
  DATA.compTimer=compMin>0?{id:id,lift:l,min:compMin,startedAt:_ahora()}:null;
  // Nos aseguramos de estar viendo la tanda/lift/ronda donde aparece el extra.
  DATA.flight=a.flight;DATA.lift=l;DATA.round=gr;DATA.forcedCurrent=null;
  saveNow();R();
  const nombreExtra=(gr>=2)?'4º intento':'Intento extra';
  showToastLC(nombreExtra+' ('+(mode==='self'?'se sigue a sí mismo':'final de ronda')+'): '+a.name+' — repite su '+['1er','2do','3er'][gr]+' intento en '+LIFT_S[l]+(compMin?' · '+compMin+' min compensatorio':''));
}

// Si se juzgó (válido/nulo) el 4º intento que tenía tiempo compensatorio, se cierra.
function _clearCompIfJudged(id,l,r){
  if(r===3 && DATA.compTimer && DATA.compTimer.id===id && DATA.compTimer.lift===l){
    DATA.compTimer=null;
  }
}

function editAtt(id,l,r){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  const v=prompt(a.name+' \u2014 '+LIFT_S[l]+' Int '+(r+1)+'\nPeso actual: '+(a.att[l][r].w||'\u2014')+'\nNuevo peso (kg):',a.att[l][r].w||'');
  if(v!==null){
    a.att[l][r].w=parseFloat(v)||0;
    _markAtt(id,'att_'+l+'_'+r);
    // Si hab\u00eda un change timer corriendo para este intento, cancelarlo
    const key=id+'_'+l+'_'+r;
    if(DATA.changeTimers[key])delete DATA.changeTimers[key];
    // Dejar en blanco (o en 0) el 4\u00ba intento es borrarlo: la casilla sale del
    // atleta y la columna SQ4/BP4/DL4 deja de aparecer en resultados y en el acta.
    // Si ya fue juzgado se conserva \u2014 para eso est\u00e1 el \ud83d\uddd1 del men\u00fa \u22ee, que avisa.
    if(r===3&&a.att[l].length===4&&!a.att[l][3].w&&a.att[l][3].r===null){
      a.att[l].pop();
      if(DATA.compTimer&&DATA.compTimer.id===id&&DATA.compTimer.lift===l)DATA.compTimer=null;
      showToastLC('4\u00ba intento eliminado: '+a.name+' \u2014 '+LIFT_S[l]);
    }
    saveNow();R();
  }
}

// ── Cambio de intento (reglamento IPF) ──────────────────────────────────────
// El 3er intento de peso muerto —y el 3er de banca de quien compite solo en
// banca— se puede cambiar hasta dos veces después de declarado. Se lleva la
// cuenta en la casilla (`cambios`) y SOLO suma con la opción "Cambio de intento":
// tocar la casilla para corregir o volver a mandar el peso no cuenta, porque eso
// es arreglar un dato y no un cambio pedido por el atleta.
const CAMBIOS_MAX=2;
function _soloBancaCambio(a){
  const m=String(a&&a.mod||'');
  if(m==='onlybench'||m==='oe_bench')return true;
  return m==='equipped_bench'&&!(typeof _isPlusBench==='function'&&_isPlusBench(a));
}
function _admiteCambio(a,l,j){
  if(j!==2)return false;
  return l==='dl'||(l==='bp'&&_soloBancaCambio(a));
}
function cambioIntento(id,l,j){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  const at=a.att[l]&&a.att[l][j];
  window._attMenuOpen=null;
  if(!at||!_admiteCambio(a,l,j)){R();return;}
  if(at.r!=null){showToastLC('Ese intento ya fue juzgado: ya no se puede cambiar');R();return;}
  if(!(at.w>0)){showToastLC('Primero se declara el peso: el cambio es sobre un peso ya declarado');R();return;}
  const n=at.cambios||0;
  if(n>=CAMBIOS_MAX){showToastLC(a.name+' ya usó sus '+CAMBIOS_MAX+' cambios de intento');R();return;}
  const v=prompt(a.name+' — '+LIFT_S[l]+' Int '+(j+1)+'\nCAMBIO DE INTENTO '+(n+1)+' de '+CAMBIOS_MAX+'\nPeso actual: '+at.w+'\nNuevo peso (kg):',at.w);
  if(v===null){R();return;}
  const w=parseFloat(String(v).replace(',','.'));
  if(!(w>0)){showToastLC('Peso inválido');R();return;}
  if(w===at.w){showToastLC('Es el mismo peso: no cuenta como cambio');R();return;}
  const prev=(a.att[l][j-1]&&a.att[l][j-1].w)||0;
  if(prev&&w<prev&&!confirm(w+' kg es menos que el intento anterior ('+prev+' kg). ¿Confirmar igual?')){R();return;}
  at.w=w; at.cambios=n+1; at.cambioTs=_ahora();
  _markAtt(id,'att_'+l+'_'+j);
  const key=id+'_'+l+'_'+j;
  if(DATA.changeTimers[key])delete DATA.changeTimers[key];
  saveNow();R();
  showToastLC('Cambio de intento '+(n+1)+'/'+CAMBIOS_MAX+': '+a.name+' → '+w+' kg');
}
// Cuántos cambios lleva el intento que está por levantar `c` (el atleta en
// tarima, o el clon de su 4º). 0 si no hubo o si ya se juzgó: el cartel de
// CAMBIO DE INTENTO de la pantalla y la transmisión se apaga con la decisión.
function _cambiosIntentoActual(c){
  try{
    if(!c)return 0;
    const ra=(typeof _realAth==='function')?_realAth(c):c;
    const r=(typeof curAtt==='function')?curAtt(c):DATA.round;
    const at=ra.att[DATA.lift][r];
    return (at&&at.r==null&&at.w>0)?(at.cambios||0):0;
  }catch(e){ return 0; }
}

// El cartel amarillo de CAMBIO DE INTENTO, el mismo en la pantalla de tarima y
// en la transmisión (como el "ATTEMPT CHANGE" de las transmisiones de la IPF).
function _cartelCambioHtml(px){
  return '<span class="cambio-int" style="display:inline-flex;align-items:center;gap:.35em;background:#F2C230;color:#111;'
    +'font-family:Oswald,sans-serif;font-weight:800;letter-spacing:.06em;line-height:1.05;padding:.28em .6em;border-radius:4px;'
    +'font-size:'+px+';white-space:nowrap;box-shadow:0 0 18px rgba(242,194,48,.5)">⟳ CAMBIO DE INTENTO</span>';
}

function _attCellCompete(a,l,j,isCurrentCell){
  const sc=window._CT_CELL_SCALE||1;
  const at=a.att[l][j];
  const c = at.r==='g'?'att-g':at.r==='n'?'att-n':at.w>0?'att-p':'att-e';
  const gActive = at.r==='g', nActive = at.r==='n';
  const ctKey = a.id+'_'+l+'_'+j;
  const ct = DATA.changeTimers[ctKey];
  const ctRem = (ct && !ct.expired && ct.remaining>0) ? ct.remaining : null;
  const ctExpired = ct && ct.expired;
  let cell='<td style="padding:'+Math.round(3*sc)+'px;vertical-align:top">';
  // Cambio de intento: botón amarillo arriba de la casilla del 3er peso muerto
  // (o banca de Only Bench) mientras haya un peso declarado sin juzgar.
  if(_admiteCambio(a,l,j)&&at.w>0&&at.r==null){
    const nc=at.cambios||0, lleno=nc>=CAMBIOS_MAX;
    cell+='<button class="att-cambio" onclick="event.stopPropagation();cambioIntento('+a.id+',\''+l+'\','+j+')"'
      +' title="'+(lleno?'Ya usó los '+CAMBIOS_MAX+' cambios':'Cambio de intento ('+nc+' de '+CAMBIOS_MAX+' usados)')+'"'
      +' style="width:100%;margin-bottom:2px;padding:'+Math.round(2*sc)+'px 0;border-radius:4px;border:1px solid #F2C230;'
      +'background:'+(nc?'rgba(242,194,48,.22)':'transparent')+';color:#F2C230;font-family:Oswald;font-size:'+Math.round(9*sc)+'px;font-weight:700;letter-spacing:.5px;cursor:pointer;'
      +(lleno?'opacity:.5;':'')+'line-height:1.2">⟳ CAMBIO '+nc+'/'+CAMBIOS_MAX+'</button>';
  }
  if(ctRem!==null){
    cell+='<div id="ctcell_'+ctKey+'" class="att att-p" onclick="editAtt('+a.id+',\''+l+'\','+j+')" style="font-size:'+Math.round(14*sc)+'px;font-weight:700;padding:'+Math.round(8*sc)+'px 4px;background:rgba(245,158,11,.15);border:2px solid var(--orange);color:var(--orange);text-align:center" title="Tiene '+ctRem+'s para declarar el peso">'+ctRem+'s</div>';
  } else if(ctExpired && !at.w){
    cell+='<div id="ctcell_'+ctKey+'" class="att att-n" onclick="editAtt('+a.id+',\''+l+'\','+j+')" style="font-size:'+Math.round(15*sc)+'px;font-weight:800;padding:'+Math.round(8*sc)+'px 4px;background:rgba(239,68,68,.18);border:2px solid var(--red);color:var(--red);text-align:center;animation:pulse 1.5s ease-in-out infinite" title="Tiempo expirado — requiere aprobación del jurado">TIEMPO</div>';
  } else {
    // Récord sudamericano: si el peso declarado supera el récord de su división
    // (o del Open), la celda se marca en amarillo — igual que en las planillas de
    // FESUPO. Se pone más fuerte cuando el intento ya se dio por válido.
    const srR=_srRompe(a,l,at.w);
    // Y en peso muerto, el récord de TOTAL que deja (o dejó) este intento.
    const srT=_srTotalCelda(a,l,at);
    const srAny=srR.length||srT.length, srHecho=srAny&&at.r==='g';
    const srTxt=(srR.length&&srT.length)?'RÉC+TOTAL':srT.length?'RÉC. TOTAL':'RÉCORD';
    // El relleno es SIEMPRE el del intento: verde si fue válido, rojo tachado si
    // fue nulo. Lo que marca el récord es el borde rojo que late, y sigue latiendo
    // después de conseguido — es el momento que hay que mirar, no uno que ya pasó.
    // Pintarlo dorado entero, como estaba, tapaba justo el dato que importa:
    // si el levantamiento valió o no.
    const srCss='';
    // Letra blanca y la misma tipografía de los nombres de la tabla (la del
    // cuerpo, DM Sans): la palabra tiene que leerse como parte de la planilla,
    // no como un cartel pegado encima. El rojo queda en el borde, no en el texto.
    if(srAny)cell+='<div class="rec-caja"><div class="'+(srHecho?'':'rec-tag')+'" style="font-size:'
      +Math.round(9*sc)+'px;font-weight:800;letter-spacing:.6px;line-height:1;margin-bottom:2px;white-space:nowrap;'
      +'text-align:center;color:#fff">'+(srHecho?'<i class=yl-i-estrella></i> ':'')+srTxt+'</div>';
    const srTit=[srR.length?_srBadge(srR)+' — supera '+srR.map(function(x){return x.div+' '+(x.vacio?'(sin récord)':x.kg+'kg')}).join(', '):'',
      srT.length?'RÉCORD DE TOTAL '+srT[0].total+' kg — supera '+srT.map(function(x){return x.div+' '+(x.vacio?'(sin récord)':x.kg+'kg')}).join(', '):''].filter(Boolean).join(' · ');
    cell+='<div class="'+c+' att'+(srAny?' rec-borde':'')+'" onclick="editAtt('+a.id+',\''+l+'\','+j+')"'+(srAny?' title="'+srTit.replace(/"/g,'&quot;')+'"':'')+' style="font-size:'+Math.round((isCurrentCell?15:12)*sc)+'px;font-weight:700;padding:'+Math.round((isCurrentCell?10:8)*sc)+'px 4px;'+srCss+(isCurrentCell?'box-shadow:inset 0 0 0 3px '+LIFT_C[l]+';':'')+'">'+(at.w||'—')+'</div>'+(srR.length?'</div>':'');
  }
  if(isCurrentCell){
    cell+='<div style="display:flex;gap:2px;margin-top:3px">'
      +'<button onclick="event.stopPropagation();overrideResult('+a.id+',\''+l+'\','+j+',\'g\')" title="GOOD LIFT" style="flex:1;padding:'+Math.round(7*sc)+'px 0;border-radius:5px;border:2px solid '+(gActive?'#5cb37f':'rgba(92,179,127,.5)')+';background:'+(gActive?'rgba(92,179,127,.45)':'rgba(92,179,127,.1)')+';color:'+(gActive?'#fff':'#5cb37f')+';font-size:'+Math.round(14*sc)+'px;font-weight:800;cursor:pointer;line-height:1"><i class=yl-i-check></i></button>'
      +'<button onclick="event.stopPropagation();overrideResult('+a.id+',\''+l+'\','+j+',\'n\')" title="NO LIFT" style="flex:1;padding:'+Math.round(7*sc)+'px 0;border-radius:5px;border:2px solid '+(nActive?'#cc6666':'rgba(204,102,102,.5)')+';background:'+(nActive?'rgba(204,102,102,.45)':'rgba(204,102,102,.1)')+';color:'+(nActive?'#fff':'#cc6666')+';font-size:'+Math.round(14*sc)+'px;font-weight:800;cursor:pointer;line-height:1"><i class=yl-i-cruz></i></button>'
    +'</div>';
  } else if(at.w>0){
    cell+='<div style="display:flex;gap:2px;margin-top:3px" title="Cambiar o revocar la decisión de este intento">'
      +'<button onclick="event.stopPropagation();changeResult('+a.id+',\''+l+'\','+j+',\'g\')" title="Cambiar a VÁLIDO (volver a tocar = revocar)" style="flex:1;padding:'+Math.round(3*sc)+'px 0;border-radius:4px;border:1px solid '+(gActive?'var(--green)':'rgba(34,197,94,.35)')+';background:'+(gActive?'rgba(34,197,94,.25)':'transparent')+';color:'+(gActive?'var(--green)':'rgba(34,197,94,.6)')+';font-size:'+Math.round(11*sc)+'px;font-weight:700;cursor:pointer;line-height:1"><i class=yl-i-check></i></button>'
      +'<button onclick="event.stopPropagation();changeResult('+a.id+',\''+l+'\','+j+',\'n\')" title="Cambiar a NULO (volver a tocar = revocar)" style="flex:1;padding:'+Math.round(3*sc)+'px 0;border-radius:4px;border:1px solid '+(nActive?'var(--red)':'rgba(239,68,68,.35)')+';background:'+(nActive?'rgba(239,68,68,.25)':'transparent')+';color:'+(nActive?'var(--red)':'rgba(239,68,68,.6)')+';font-size:'+Math.round(11*sc)+'px;font-weight:700;cursor:pointer;line-height:1"><i class=yl-i-cruz></i></button>'
    +'</div>';
    if(at.r===null){
      cell+='<button onclick="event.stopPropagation();forceCurrentAttempt('+a.id+',\''+l+'\','+j+')" title="Marcar este intento como el actual (por si se saltó al atleta)" style="width:100%;margin-top:2px;padding:'+Math.round(2*sc)+'px 0;border-radius:4px;border:1px dashed rgba(212,168,67,.5);background:transparent;color:var(--gold);font-size:'+Math.round(9*sc)+'px;font-weight:700;cursor:pointer;letter-spacing:.5px">ACTUAL</button>';
    }
  }
  cell+=_attMenuHtml(a,l,j,sc);
  cell+='</td>';
  return cell;
}

// Menú de tres puntitos (⋮) para un intento — consolida las acciones sueltas en un
// solo lugar y queda disponible en TODOS los intentos (activo o no), pedido del
// operador. El ✓/✗ grande y la reversión rápida siguen igual arriba; esto es un
// atajo extra. Se mantiene fijo intento a intento porque se dibuja en cada celda.
function _attMenuHtml(a,l,j,sc){
  const key=a.id+'_'+l+'_'+j;
  const open=window._attMenuOpen===key;
  const at=a.att[l][j]; if(!at)return'';
  const has4th=a.att[l].length>=4;
  let h='<div style="position:relative;margin-top:3px">';
  h+='<button class="att-menu-btn" onclick="event.stopPropagation();toggleAttMenu('+a.id+',\''+l+'\','+j+')" title="Más opciones de este intento" style="width:100%;padding:'+Math.round(1*sc)+'px 0;border-radius:4px;border:1px solid '+(open?'var(--gold)':'var(--border)')+';background:'+(open?'rgba(212,168,67,.15)':'transparent')+';color:'+(open?'var(--gold)':'var(--muted)')+';font-size:'+Math.round(13*sc)+'px;font-weight:700;cursor:pointer;line-height:1;letter-spacing:1px">⋮</button>';
  if(open){
    const item=(oc,ico,txt,col,tip)=>'<button class="att-menu-item" onclick="event.stopPropagation();'+oc+'"'+(tip?' title="'+tip.replace(/"/g,'&quot;')+'"':'')+' style="display:flex;align-items:center;gap:7px;width:100%;padding:8px 10px;border:none;border-bottom:1px solid rgba(29,49,80,.25);background:transparent;color:'+(col||'var(--text)')+';font-family:Oswald;font-size:12px;font-weight:600;cursor:pointer;text-align:left;white-space:nowrap"><span style="font-size:13px;width:14px;text-align:center;flex-shrink:0">'+ico+'</span>'+txt+'</button>';
    // El intento extra se concede para la RONDA ACTUAL. Si se agrega en la 3ª
    // ronda (o desde otro lift, que asume 3ª) se llama "4º intento"; en 1ª/2ª
    // ronda es "intento extra" (se retoma el mismo intento por un error ajeno).
    const grAdd=(l===DATA.lift)?DATA.round:2;
    const is4th=grAdd>=2;
    const LBL=is4th?'4º intento':'Intento extra';
    // Torpedos (tooltips) basados en el criterio IPF de intento compensatorio.
    const TIP_SELF=(is4th?'4º intento — ':'Intento extra — ')+'el atleta se sigue a sí mismo (repite ENSEGUIDA el mismo intento). Se usa en: intento de récord, peso muerto (deadlift) en 3ª ronda, only bench en 3ª ronda, o cuando se le concede retomar por un error ajeno. Se le da un tiempo compensatorio de descanso (por defecto 4 min) que corre a la vista, sin bloquear el válido/nulo (criterio IPF).';
    const TIP_ENDROUND=(is4th?'4º intento — ':'Intento extra — ')+'el atleta lo toma AL FINAL de la ronda en curso — forma habitual IPF de conceder el intento por un error ajeno: espera al final de la ronda para repetir. Tiempo compensatorio opcional.';
    const TIP_REMOVE='Quita el intento extra / 4º (si se agregó por error o el jurado lo revoca). Solo borra el intento extra; los 3 base quedan intactos.';
    h+='<div class="att-menu" onclick="event.stopPropagation()" style="position:absolute;z-index:60;top:calc(100% + 3px);left:0;min-width:210px;background:var(--card);border:1px solid var(--gold);border-radius:8px;box-shadow:0 8px 26px rgba(0,0,0,.6);overflow:hidden">';
    h+='<div style="padding:6px 10px;font-family:Oswald;font-size:10px;letter-spacing:1px;color:var(--muted);border-bottom:1px solid rgba(29,49,80,.4);background:rgba(29,49,80,.25)">'+a.name+' · '+LIFT_S[l]+(j+1)+'</div>';
    if(_admiteCambio(a,l,j)&&at.w>0&&at.r==null){
      const nc=at.cambios||0;
      h+=nc>=CAMBIOS_MAX
        ?'<div style="padding:8px 10px;font-family:Oswald;font-size:12px;color:rgba(242,194,48,.55);border-bottom:1px solid rgba(29,49,80,.25)">⟳ Cambio de intento · sin cambios ('+nc+'/'+CAMBIOS_MAX+')</div>'
        :item('cambioIntento('+a.id+',\''+l+'\','+j+')','⟳','Cambio de intento ('+nc+'/'+CAMBIOS_MAX+')','#F2C230','El atleta cambia el peso declarado. En el 3er intento de peso muerto (y de banca en Only Bench) se puede hasta '+CAMBIOS_MAX+' veces. Corregir el peso tocando la casilla no cuenta como cambio.');
    }
    if(at.r===null)
      h+=item('window._attMenuOpen=null;forceCurrentAttempt('+a.id+',\''+l+'\','+j+')','<i class=yl-i-reproducir></i>','Marcar como actual','var(--gold)','Salta la cola y pone este intento como el que está en tarima ahora (por si se pasó por alto al atleta).');
    if(!has4th){
      h+=item('add4thAttempt('+a.id+',\''+l+'\',\'self\')','<i class=yl-i-mas></i>',LBL+' — se sigue a sí mismo','#60a5fa',TIP_SELF);
      h+=item('add4thAttempt('+a.id+',\''+l+'\',\'endround\')','<i class=yl-i-mas></i>',LBL+' — al final de la ronda','#60a5fa',TIP_ENDROUND);
    }else{
      const gr3=((a.att[l][3]&&a.att[l][3].grantedRound)||0)>=2;
      h+=item('remove4thAttempt('+a.id+',\''+l+'\')','<i class=yl-i-basura></i>','Eliminar '+(gr3?'4º intento':'intento extra'),'#f59e0b',TIP_REMOVE);
    }
    h+=item('window._attMenuOpen=null;changeResult('+a.id+',\''+l+'\','+j+',\'g\')','<i class=yl-i-check></i>','Marcar intento válido','var(--green)','Fija este intento como VÁLIDO (corrección manual, sin efectos de tarima).');
    h+=item('window._attMenuOpen=null;changeResult('+a.id+',\''+l+'\','+j+',\'n\')','<i class=yl-i-cruz></i>','Marcar intento nulo','var(--red)','Fija este intento como NULO (corrección manual, sin efectos de tarima).');
    h+='</div>';
  }
  h+='</div>';
  return h;
}

function renderCompete(){
  // "cur" (el próximo/actual) sale de liftQueue(), que ya pone primero al atleta forzado
  // manualmente con forceCurrentAttempt() si corresponde — así Control en Vivo, Control TX
  // y los widgets de OBS quedan todos consistentes.
  const queue=liftQueue(),cur=queue[0],nxt=queue[1],rk=rankings();
  const rack=cur?(DATA.lift==='sq'?cur.rackSQ:DATA.lift==='bp'?cur.rackBP:''):'';
  const cw=cur?cur.att[DATA.lift][DATA.round].w:0;
  // Enunciado del chip cuando el actual es un intento extra: "4º INTENTO" si se
  // concedió en la 3ª ronda, "INTENTO EXTRA" si fue en la 1ª/2ª ronda.
  const cur4lbl=(cur&&cur.__is4)?((((cur.att[DATA.lift][3]||{}).grantedRound)||0)>=2?'4º INTENTO':'INTENTO EXTRA'):'';
  let h='<div class="fade">';
  h+='<div style="display:flex;align-items:center;gap:4px;margin-bottom:10px;flex-wrap:wrap">';
  h+='<span style="font-size:9px;color:var(--muted);letter-spacing:1px;margin-right:2px">JUZGANDO AHORA</span>';
  h+=LIFTS.map(l=>'<button onclick="DATA.lift=\''+l+'\';DATA.round=0;saveNow();R()" class="os" style="padding:5px 12px;border-radius:6px;border:2px solid '+(DATA.lift===l?LIFT_C[l]:'var(--border)')+';background:'+(DATA.lift===l?LIFT_C[l]+'20':'transparent')+';color:'+(DATA.lift===l?LIFT_C[l]:'var(--muted)')+';font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer">'+LIFT_S[l]+'</button>').join('');
  h+='<span style="width:6px"></span>';
  h+=[0,1,2].map(r=>'<button onclick="DATA.round='+r+';saveNow();R()" class="os" style="padding:5px 10px;border-radius:6px;border:1px solid '+(DATA.round===r?'var(--gold)':'var(--border)')+';background:'+(DATA.round===r?'rgba(212,168,67,.15)':'transparent')+';color:'+(DATA.round===r?'var(--gold)':'var(--muted)')+';font-size:11px;font-weight:600;cursor:pointer">INT '+(r+1)+'</button>').join('');
  // Sin botón "INT 4": el 4º intento vive dentro de su ronda (INT 1/2/3) y el
  // atleta reaparece en la cola. No hay una ronda separada para el 4º.
  // Deshacer / Rehacer (Ctrl+Z / Ctrl+Y) — para volver atrás cualquier acción.
  h+='<span style="flex:1"></span>';
  // Indicador de SINCRONIZACIÓN: con varios PCs operando, el operador tiene que ver
  // de un vistazo si sus cambios están llegando. Verde = guardado recién; ámbar =
  // hace rato; rojo = no está guardando (o es una pantalla espectadora).
  if(!PRACTICE_MODE){
    // El indicador mide si hay algo SIN GUARDAR, no cuánto hace que se guardó.
    // Antes se ponía rojo con "HACE 3min" cuando simplemente nadie había tocado
    // nada en 3 minutos (entre tandas, en un descanso): una alarma falsa que
    // termina enseñando a ignorar el indicador, justo el que tiene que avisar en
    // serio cuando los cambios NO están llegando al público y a OBS.
    const ctrl=!!window.IS_CONTROLLER;
    const secs=_fbLastOk?Math.round((Date.now()-_fbLastOk)/1000):null;
    const ultimo=secs===null?'todavía no se guardó nada desde esta pantalla'
      :(secs<60?'último guardado hace '+secs+'s':'último guardado hace '+Math.round(secs/60)+'min');
    // ¿Lo que tengo en pantalla es distinto de lo último confirmado por el servidor?
    let desinc=false;
    try{ desinc=(_dataSig()!==window._lastSyncedSig); }catch(e){}
    const enVuelo=_syncInFlight||_syncPending;
    const pendiente=desinc||enVuelo;
    if(pendiente){ if(!window._desincDesde)window._desincDesde=Date.now(); }
    else window._desincDesde=0;
    const esperando=window._desincDesde?Math.round((Date.now()-window._desincDesde)/1000):0;
    let col,txt,tip;
    // Una pantalla en modo ESPECTADOR no está fallando: está haciendo lo suyo,
    // mirar. Antes salía en ROJO igual que una escritura caída, así que el PC de
    // OBS y cualquier pantalla de apoyo mostraban una alarma permanente. Un rojo
    // que está siempre encendido deja de avisar, que es justo lo que no puede
    // pasar con el que sí importa.
    if(!ctrl){
      col='var(--muted)';txt='SOLO LECTURA';
      tip='Esta pantalla mira, no escribe. Está bien así: es lo que corresponde en '
        +'el PC de OBS o en una pantalla de apoyo. Para que escriba, cámbiala a Controlador.';
    }
    // El rojo dice QUÉ pasa. "No se guarda" a secas obliga a adivinar entre
    // internet, sesión y permisos, que se arreglan de maneras distintas.
    else if(!fbReady){col='var(--red)';txt='SIN CONEXIÓN';tip='No hay conexión con el servidor. Se reintenta solo — revisa el internet del lugar.';}
    else if(!fbUnsub){col='var(--red)';txt='SIN CAMPEONATO';tip='Hay conexión, pero esta pantalla no está escuchando ningún campeonato. Vuelve a elegirlo.';}
    else if(window._syncFallo){
      col='var(--red)';txt='NO SE GUARDA';
      const m=String(window._syncFalloMsg||'');
      tip=(/permission|insufficient/i.test(m)
            ? 'El servidor rechazó la escritura por permisos: la sesión pudo haber caducado. Vuelve a entrar.'
            : /offline|network|unavailable|deadline/i.test(m)
            ? 'No se pudo llegar al servidor: es la conexión. Se sigue reintentando solo.'
            : 'La última escritura falló y se sigue reintentando solo.')
          +' '+ultimo+(m?' ('+m.slice(0,90)+')':'');
    }
    else if(pendiente&&esperando>=12){col='var(--red)';txt='NO SE GUARDA';tip='Hace '+esperando+'s que hay cambios sin confirmar. La conexión está lenta o cortada — se sigue intentando.';}
    else if(pendiente){col='var(--orange)';txt='GUARDANDO…';tip='Mandando los últimos cambios al servidor.';}
    else {col='var(--green)';txt='EN LÍNEA';tip='Todo guardado — '+ultimo+'.';}
    h+='<span id="syncPill" title="'+tip+'" style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1px solid '+col+';color:'+col+';font-family:Oswald;font-size:10px;font-weight:700;letter-spacing:.5px"><span style="width:7px;height:7px;border-radius:50%;background:'+col+'"></span>SYNC '+txt+'</span>';
  }
  // En práctica: link de la vista de espectador (lo que ve el público) para compartir.
  if(PRACTICE_MODE){
    h+='<button onclick="copyPracticeViewerLink()" title="Copiar el link de la vista de espectador (lo que ve el público) para compartir" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(96,165,250,.5);background:rgba(96,165,250,.08);color:#60a5fa;font-size:12px;font-weight:700;cursor:pointer"><i class=yl-i-ojo></i> Link espectador</button>';
  }
  h+='<button id="histUndoBtn" onclick="histUndo()"'+(window._histUndo&&window._histUndo.length?'':' disabled')+' title="Deshacer (Ctrl+Z)" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:13px;font-weight:700;cursor:pointer;opacity:'+(window._histUndo&&window._histUndo.length?'1':'.4')+'">↶ Deshacer</button>';
  h+='<button id="histRedoBtn" onclick="histRedo()"'+(window._histRedo&&window._histRedo.length?'':' disabled')+' title="Rehacer (Ctrl+Y)" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:13px;font-weight:700;cursor:pointer;opacity:'+(window._histRedo&&window._histRedo.length?'1':'.4')+'">↷ Rehacer</button>';
  h+='</div>';
  // ── Vista libre ─────────────────────────────────────────────────
  // Con varias personas operando (aunque sea con el mismo correo), cada pantalla
  // puede mirar donde quiera sin arrastrar a las demás. Los pesos y las decisiones
  // siguen siendo de todos: eso NO cambia, se comparte igual.
  {const libre=!!window.NAV_LIBRE, nv=window._NAV_REMOTA;
   const donde=nv?((LIFT_S[nv.lift]||'—')+' · Int '+((typeof nv.round==='number'?nv.round:0)+1)+' · Tanda '+(nv.flight||'—')):'—';
   if(libre){
     h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;padding:8px 12px;border-radius:8px;border:2px solid #60a5fa;background:rgba(96,165,250,.10)">'
       +'<div><span class="os" style="font-size:12px;font-weight:700;letter-spacing:1px;color:#60a5fa"><i class=yl-i-ojo></i> VISTA LIBRE</span>'
       +'<div style="font-size:10px;color:var(--muted);margin-top:2px">Te mueves por tu cuenta y no arrastras a nadie. Lo que cargues lo siguen viendo todos. La tarima está en <b style="color:var(--gold)">'+donde+'</b></div></div>'
       +'<button onclick="setNavLibre(false)" style="padding:6px 14px;border-radius:6px;border:1px solid #60a5fa;background:transparent;color:#60a5fa;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;white-space:nowrap">VOLVER A LA TARIMA</button>'
     +'</div>';
   }else{
     h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;padding:6px 12px;border-radius:8px;border:1px solid var(--border)">'
       +'<span style="font-size:11px;color:var(--muted)">Esta pantalla sigue a la tarima: el movimiento, la ronda y la tanda te los mueve quien opera</span>'
       +'<button onclick="setNavLibre(true)" title="Mirar otra tanda u otro movimiento sin mover a los demás. Los pesos y las decisiones se siguen compartiendo." style="padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;white-space:nowrap"><i class=yl-i-ojo></i> VISTA LIBRE</button>'
     +'</div>';
   }}
  // Selector de tanda activa — lo mismo que "Vuelo Activo" del menú hamburguesa, pero acá
  // directo, sin tener que abrir la sidebar. Define qué tanda ve Control TX ahora mismo.
  {const flightsCE=_allFlightsSorted();
   if(flightsCE.length){
     // El día se elige aparte y solo filtra los botones: la tanda en tarima la
     // sigue moviendo el operador con estos mismos botones, como siempre.
     const _fdCE=_filaDias('control',flightsCE,_diaDeTanda(DATA.flight));
     h+=_fdCE.html;
     h+='<div style="display:flex;align-items:center;gap:4px;margin-bottom:10px;flex-wrap:wrap">';
     h+='<span style="font-size:9px;color:var(--muted);letter-spacing:1px;margin-right:2px">'+(window.NAV_LIBRE?'TANDA QUE ESTÁS MIRANDO (solo para ti)':'TANDA EN TARIMA (Control TX)')+'</span>';
     h+=_fdCE.tandas.map(f=>{
       const n=DATA.athletes.filter(a=>a.flight===f&&!a.bombed).length;
       const on=DATA.flight===f;
       return '<button onclick="DATA.flight=\''+f+'\';saveNow();R()" class="os" style="padding:5px 12px;border-radius:6px;border:2px solid '+(on?(FL_C[f]||'var(--gold)'):'var(--border)')+';background:'+(on?(FL_C[f]||'#666')+'22':'transparent')+';color:'+(on?(FL_C[f]||'#fff'):'var(--muted)')+';font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer">'+f+'<span style="font-size:9px;opacity:.7;margin-left:4px">('+n+')</span></button>';
     }).join('');
     h+='</div>';
   }
  }
  // Toggle: timer de cambio (60s tras válido/nulo). Apagado por defecto.
  {const cton=!!window._CT_ENABLED;
   h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;padding:7px 12px;border-radius:8px;border:1px solid '+(cton?'rgba(245,158,11,.4)':'var(--border)')+';background:'+(cton?'rgba(245,158,11,.08)':'transparent')+'">'
     +'<span style="font-size:11px;color:var(--muted)">Timer de cambio (60s entre intentos) <b style="color:'+(cton?'var(--orange)':'var(--muted)')+'">'+(cton?'ACTIVADO':'APAGADO')+'</b></span>'
     +'<button onclick="toggleChangeTimers()" style="padding:5px 14px;border-radius:6px;border:1px solid '+(cton?'var(--orange)':'var(--border)')+';background:transparent;color:'+(cton?'var(--orange)':'var(--muted)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer">'+(cton?'APAGAR':'ACTIVAR')+'</button>'
   +'</div>';
   const afon=!!window._CT_AUTOFILL_ENABLED;
   h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;padding:7px 12px;border-radius:8px;border:1px solid '+(afon?'rgba(59,130,246,.4)':'var(--border)')+';background:'+(afon?'rgba(59,130,246,.08)':'transparent')+'">'
     +'<span style="font-size:11px;color:var(--muted)">Auto-rellenar intento al vencer el timer (nulo=mismo peso, válido=+2.5kg) <b style="color:'+(afon?'#3b82f6':'var(--muted)')+'">'+(afon?'ACTIVADO':'APAGADO')+'</b></span>'
     +'<button onclick="toggleChangeTimerAutofill()" style="padding:5px 14px;border-radius:6px;border:1px solid '+(afon?'#3b82f6':'var(--border)')+';background:transparent;color:'+(afon?'#3b82f6':'var(--muted)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer">'+(afon?'APAGAR':'ACTIVAR')+'</button>'
   +'</div>';}
  h+='<div>';
  // Tiempo compensatorio (4º "se sigue a sí mismo") — se muestra siempre que esté
  // activo, aunque todavía no haya un atleta "actual" con peso cargado. Solo a la
  // vista, NO bloquea el válido/nulo.
  {const ci=_compInfo();
   if(ci){
     const cc=ci.neg?'var(--red)':ci.remaining<=15?'var(--orange)':'#60a5fa';
     h+='<div class="card" style="margin-bottom:10px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border:2px solid #60a5fa;background:rgba(96,165,250,.08)">'
       +'<div><span style="font-size:12px;font-weight:700;color:#60a5fa"><i class=yl-i-reloj></i> TIEMPO COMPENSATORIO</span>'
         +'<div style="font-size:10px;color:var(--muted);margin-top:2px">'+esc(ci.a.name)+' · '+LIFT_S[ci.lift]+'4 · '+ci.min+' min · <span style="opacity:.8">no bloquea: puedes dar válido/nulo cuando quieras</span></div></div>'
       +'<div style="display:flex;align-items:center;gap:8px">'
         +'<span id="compTimerBox" class="os" style="font-size:26px;font-weight:800;color:'+cc+'">'+ci.mmss+'</span>'
         +'<button onclick="clearCompTimer()" title="Cerrar el tiempo compensatorio" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:10px;cursor:pointer"><i class=yl-i-cerrar></i></button>'
       +'</div></div>';
   }}
  if(cur){
    // Info compacta del atleta actual (sin botones grandes - los GOOD/NO LIFT estan en la tabla)
    h+='<div class="card" style="border-left:4px solid '+LIFT_C[DATA.lift]+';margin-bottom:10px;padding:10px 14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:0"><div class="os" style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+cur.name+'</div><div style="font-size:10px;color:var(--muted)">'+cur.club+' \u00b7 '+cur.bw+'kg \u00b7 '+cur.div+' \u00b7 '+cur.cat+' \u00b7 pr\u00f3ximo: <strong style="color:'+LIFT_C[DATA.lift]+'">'+(cw||'\u2014')+'kg</strong></div></div><div style="display:flex;gap:6px;align-items:center">'+(function(){const _s=_rackSetup(_realAth(cur),DATA.lift)||(rack?'RACK '+rack:'');return _s?'<span style="background:var(--bg);border:1px solid var(--border);padding:3px 8px;border-radius:5px;font-size:10px"><i class=yl-i-ajustes></i> '+_s+'</span>':'';})()+'<span class="flight-badge" style="background:'+(FL_C[cur.flight]||'#666')+'">'+cur.flight+'</span>'+(cur.__is4?'<span title="Intento extra compensatorio — repite este intento" style="background:#60a5fa;color:#fff;padding:3px 8px;border-radius:5px;font-family:Oswald;font-weight:700;font-size:11px;letter-spacing:.5px">'+cur4lbl+'</span>':'')+'<span style="background:'+LIFT_C[DATA.lift]+';color:#fff;padding:3px 10px;border-radius:5px;font-family:Oswald;font-weight:700;font-size:12px">'+LIFT_S[DATA.lift]+(DATA.round+1)+'</span></div></div></div>';
    // Reloj de 1:00 para dar el pr\u00f3ximo intento \u2014 PRIVADO: solo visible ac\u00e1, en Control en
    // Vivo (isAdmin). No se transmite al p\u00fablico ni a OBS (el widget "Timer independiente"
    // se desactiv\u00f3 a pedido). id="mainTimer" \u2014 lo actualiza startTimer() cada segundo.
    {const _mt=Math.max(0,DATA.timer||0);
     const _mtColor=_mt<=10?'var(--red)':_mt<=30?'var(--orange)':'var(--green)';
     const _mtTxt=Math.floor(_mt/60)+':'+String(_mt%60).padStart(2,'0');
     h+='<div class="card" style="margin-bottom:10px;padding:8px 14px;display:flex;align-items:center;justify-content:space-between">'
       +'<span style="font-size:11px;color:var(--muted)"><i class=yl-i-reloj></i> Tiempo para el pr\u00f3ximo intento <span style="opacity:.6">(solo lo ves tú ac\u00e1 \u2014 no es p\u00fablico)</span></span>'
       +'<span style="display:flex;align-items:center;gap:10px">'
         +'<button onclick="openManualComp()" title="Asignar un tiempo compensatorio a mano (ej. el atleta abre dos intentos seguidos)" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(96,165,250,.5);background:rgba(96,165,250,.08);color:#60a5fa;font-family:Oswald;font-size:10px;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap"><i class=yl-i-reloj></i> COMPENSATORIO MANUAL</button>'
         +'<button onclick="toggleMainTimer()" title="'+(DATA.timerOn?'Pausar el reloj':'Iniciar el reloj (ej. cuando se va a tirar el intento extra)')+'" style="padding:5px 12px;border-radius:6px;border:1px solid '+(DATA.timerOn?'var(--orange)':'var(--green)')+';background:'+(DATA.timerOn?'rgba(245,158,11,.12)':'rgba(34,197,94,.12)')+';color:'+(DATA.timerOn?'var(--orange)':'var(--green)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap">'+(DATA.timerOn?'<i class=yl-i-pausa></i> Pausar':'<i class=yl-i-reproducir></i> Iniciar')+'</button>'
         +'<button onclick="resetTimer();R()" title="Volver el reloj a 1:00" style="padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer">\u21BA</button>'
         +'<span id="mainTimer" class="os" style="font-size:20px;font-weight:700;color:'+_mtColor+'">'+_mtTxt+'</span>'
       +'</span>'
     +'</div>';}
    // (Modo Jueces y el bot\u00F3n "Se permite r\u00E9cord nacional" se quitaron a pedido:
    //  las decisiones se marcan a mano con \u2713/\u2717 y los r\u00E9cords se cargan en admin.)
  }else{
    // Si queda un extra sin peso declarado, la ronda PARECE terminada (sin peso no
    // entra en la cola). Se avisa ac\u00e1 para que no se pase de largo.
    {const pend=_extrasPendientes(DATA.lift);
     let aviso='';
     if(pend.length){
       aviso='<div style="margin:0 0 12px;padding:9px 12px;border-radius:8px;border:2px solid #60a5fa;background:rgba(96,165,250,.10);text-align:left">'
         +'<div style="font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px;color:#60a5fa">FALTA UN INTENTO EXTRA</div>'
         +pend.map(a=>{const at=a.att[DATA.lift][3];
            return '<div style="font-size:11px;color:var(--muted);margin-top:3px">'+esc(a.name)+' \u2014 '
              +(at.w>0?(at.w+' kg'):'<b style="color:var(--orange)">sin peso declarado</b>')
              +(at.mode==='self'?' \u00b7 se sigue a s\u00ed mismo':' \u00b7 al final de la ronda')+'</div>';}).join('')
         +'</div>';
     }
     h+='<div class="card" style="text-align:center;padding:20px">'+aviso
       +'<p class="os" style="font-size:15px;color:var(--gold);margin-bottom:10px">RONDA COMPLETADA</p>'
       +'<button class="btn btn-r" onclick="advanceLift()">Siguiente \u2192</button></div>';}
  }
  // Los récords van DEBAJO del atleta en tarima / del aviso de ronda completada:
  // arriba tiene que estar lo que se juzga ahora.
  h+=_srPanel();
  // Active change timers
  const activeCTs=Object.keys(DATA.changeTimers).filter(k=>{const ct=DATA.changeTimers[k];return ct&&!ct.expired&&ct.remaining>0});
  if(activeCTs.length){
    h+='<div class="card" style="padding:10px;border-left:4px solid var(--orange);margin-bottom:10px">';
    activeCTs.forEach(k=>{
      const parts=k.split('_');const aId=parseInt(parts[0]);const lift=parts[1];const rnd=parseInt(parts[2]);
      const a=DATA.athletes.find(x=>x.id===aId);const ct=DATA.changeTimers[k];
      if(a)h+='<div id="cct_'+k+'" style="font-size:13px;color:var(--orange);padding:3px 0"><i class=yl-i-reloj></i> <strong>'+a.name+'</strong> \u2014 '+LIFT_S[lift]+(rnd+1)+' \u2014 '+ct.remaining+'s para entregar intento</div>';
    });
    h+='</div>';
  }
  // TODAS LAS TANDAS \u2014 SQ/BP/DL en la misma fila por atleta, todas las tandas apiladas.
  // Permite editar openers de cualquier tanda/lift sin cambiar de pesta\u00f1a. Los botones grandes
  // GOOD/NO LIFT solo aparecen en la celda que coincide con tanda+lift+intento activos arriba.
  const allFlights = _flightsFromCurrent([...new Set(DATA.athletes.map(a=>a.flight))].sort(_cmpFl));
  h+='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px"><h3 class="os" style="font-size:13px;letter-spacing:1px;color:var(--gold);margin:0">TODAS LAS TANDAS</h3>';
  // Toggle de auto-scroll al atleta en tarima (estilo LiftingCast).
  {const on=window._ctAutoScroll!==false;
   h+='<button onclick="toggleCtAutoScroll()" title="Acomoda la tabla autom\u00e1ticamente al atleta en tarima (como LiftingCast)" style="padding:5px 10px;border-radius:6px;border:1px solid '+(on?'var(--green)':'var(--border)')+';background:'+(on?'rgba(34,197,94,.12)':'transparent')+';color:'+(on?'var(--green)':'var(--muted)')+';font-family:Oswald;font-size:10px;font-weight:700;letter-spacing:.5px;cursor:pointer">\u2913 Auto-scroll '+(on?'ON':'OFF')+'</button>';}
  h+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--muted)">TAMA\u00d1O (casillas, nombres, lote)</span>'
    +'<button onclick="nudgeCtCellScale(-0.1)" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:15px;font-weight:700;cursor:pointer;line-height:1">\u2212</button>'
    +'<span style="font-family:Oswald;font-size:12px;font-weight:700;color:var(--gold);min-width:38px;text-align:center">'+Math.round((window._CT_CELL_SCALE||1)*100)+'%</span>'
    +'<button onclick="nudgeCtCellScale(0.1)" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:15px;font-weight:700;cursor:pointer;line-height:1">+</button>'
    +'<button onclick="setCtCellScale(1)" style="padding:5px 10px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:6px;font-family:Oswald;font-size:10px;font-weight:700;cursor:pointer">100%</button>'
  +'</div></div>';
  h+='<p style="font-size:10px;color:var(--muted);margin-bottom:10px">Click en cualquier casillero para editar el peso del intento. Los botones GOOD / NO LIFT grandes aparecen solo en la tanda e intento que se est\u00e1 juzgando ahora (arriba).</p>';
  if(!allFlights.length)h+='<p style="color:var(--muted);font-size:12px;text-align:center;padding:14px">Sin atletas cargados</p>';
  allFlights.forEach(fl=>{
    // Orden real de tarima para el lift+intento activo: menor a mayor peso declarado,
    // y en caso de empate, lote menor primero (mismo criterio que liftQueue()). Los que
    // todavía no tienen peso declarado para esta ronda (0) quedan al final, por lote.
    const rows = DATA.athletes.filter(a=>a.flight===fl&&!a.bombed).sort((a,b)=>{
      // (att puede ser undefined si la ronda activa es "INT 4" y el atleta no tiene 4º)
      const aa=a.att[DATA.lift][DATA.round],ab=b.att[DATA.lift][DATA.round];
      const wa=(aa&&aa.w)||0,wb=(ab&&ab.w)||0;
      const ka=wa>0?wa:Infinity,kb=wb>0?wb:Infinity;
      return ka!==kb?ka-kb:a.lot-b.lot;
    });
    if(!rows.length)return;
    h+='<div style="margin-bottom:18px">';
    h+='<div class="os" style="font-size:12px;font-weight:700;letter-spacing:1px;color:'+(FL_C[fl]||'#999')+';padding:5px 2px;border-bottom:2px solid '+(FL_C[fl]||'#999')+'44;margin-bottom:6px">TANDA '+fl+(_sesionEtiqueta(fl)?' \u00b7 '+_sesionEtiqueta(fl):'')+(fl===DATA.flight?' \u00b7 EN TARIMA AHORA':'')+'</div>';
    // La fila principal SIEMPRE tiene 3 intentos por lift. El intento extra/4º NO
    // ensancha la tabla (no agrega columna a la derecha): el atleta aparece
    // DUPLICADO en una fila abajo (mismo nombre y tanda) con solo la casilla del
    // extra. Si tiene extra en más de un lift, esa fila muestra una casilla por lift.
    h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:640px"><thead><tr style="border-bottom:1px solid var(--border)">';
    h+='<th style="text-align:center;padding:5px 4px;color:#fff;font-size:14px;font-weight:700;width:44px;line-height:1.1;border-right:1px solid var(--border);">N°<br>LOTE</th>';
    h+='<th style="text-align:left;padding:5px 8px;color:#fff;font-size:14px;font-weight:700">ATLETA</th>';
    LIFTS.forEach(l=>{for(let r=1;r<=3;r++){h+='<th style="text-align:center;padding:5px 3px;color:'+LIFT_C[l]+';font-size:10px;font-weight:700;width:58px">'+LIFT_S[l]+r+'</th>'}});
    h+='<th style="text-align:center;padding:5px 4px;color:var(--gold);font-size:9px;width:56px">TOTAL</th>';
    h+='<th style="text-align:center;padding:5px 4px;color:#60a5fa;font-size:9px;width:70px" title="Posición actual → posición si el intento es válido">POSICIÓN</th></tr></thead><tbody>';
    // Los intentos extra "al final de la ronda" se toman recién cuando la ronda
    // termina, así que sus filas NO van pegadas al atleta: se juntan acá y se
    // dibujan al final de la tanda, en el lugar en que van a subir a tarima. El
    // "se sigue a sí mismo" repite enseguida, así que ese sí queda pegado abajo.
    const _filasAlFinal=[];
    // Peso corporal y chips a la derecha del nombre, como en la vista del público,
    // cuando la pantalla da el ancho. En una pantalla angosta siguen debajo.
    const _ctLinea=_anchoDaParaLinea();
    rows.forEach(a=>{
      const isCurrentAthlete = fl===DATA.flight && cur && a.id===cur.id;
      const curOnExtra = isCurrentAthlete && curAtt(cur)===3; // el actual está en su intento extra
      const hiMain = isCurrentAthlete && !curOnExtra;
      const tot = totalOf(a);
      const rsc=window._CT_CELL_SCALE||1;
      // Fila principal (1º/2º/3º). Marca de auto-scroll cuando es el actual (en intento normal).
      h+='<tr '+(hiMain?'id="ctCurrentLifter" ':'')+'style="border-bottom:1px solid rgba(29,49,80,.18);'+(hiMain?'background:linear-gradient(90deg,'+LIFT_C[DATA.lift]+'30,'+LIFT_C[DATA.lift]+'10);box-shadow:inset 3px 0 0 '+LIFT_C[DATA.lift]+';':'')+'">';
      // El lote en blanco y 50% más grande, igual que en la vista del público.
      h+='<td style="text-align:center;padding:6px 4px;border-right:1px solid var(--border);"><span class="os" style="color:#fff;font-weight:700;font-size:'+Math.round(18*rsc)+'px">'+(a.lot||'·')+'</span></td>';
      if(_ctLinea){
        h+='<td style="padding:6px 8px;cursor:pointer" onclick="openWeighIn('+a.id+')" title="Click para editar BW + alturas de rack"><div style="display:flex;align-items:center;gap:7px;white-space:nowrap">'
          +(hiMain?'<span style="background:'+LIFT_C[DATA.lift]+';color:#fff;padding:1px 6px;border-radius:4px;font-size:9px;font-family:Oswald;letter-spacing:1px;flex-shrink:0"><i class=yl-i-reproducir></i></span>':'')
          +'<span style="font-size:'+Math.round(12*rsc)+'px;font-weight:'+(hiMain?800:500)+';color:'+(hiMain?'#fff':'var(--text)')+'">'+a.name+'</span>'
          +'<span style="font-size:'+Math.round(9*rsc)+'px;color:var(--muted);flex-shrink:0">'+(a.bw>0?a.bw+'kg':'sin BW')+'</span>'
          +_nomChips(a,rsc,true)
          +'</div></td>';
      }else{
        h+='<td style="padding:6px 8px;cursor:pointer" onclick="openWeighIn('+a.id+')" title="Click para editar BW + alturas de rack"><div style="font-size:'+Math.round(12*rsc)+'px;font-weight:'+(hiMain?800:500)+';color:'+(hiMain?'#fff':'var(--text)')+';display:flex;align-items:center;gap:5px">'+(hiMain?'<span style="background:'+LIFT_C[DATA.lift]+';color:#fff;padding:1px 6px;border-radius:4px;font-size:9px;font-family:Oswald;letter-spacing:1px"><i class=yl-i-reproducir></i></span>':'')+'<span>'+a.name+'</span></div><div style="font-size:'+Math.round(8*rsc)+'px;color:var(--muted)">'+(a.bw>0?a.bw+'kg':'sin BW')+'</div>'+_nomChips(a,rsc)+'</td>';
      }
      LIFTS.forEach(l=>{
        for(let j=0;j<3;j++){
          const isCurrentCell = hiMain && l===DATA.lift && j===DATA.round;
          h+=_attCellCompete(a,l,j,isCurrentCell);
        }
      });
      // El TOTAL también tiene récord sudamericano: si el total logrado lo supera,
      // la casilla se pinta igual que la de un intento de récord.
      {const srT=(tot>0&&!_srSoloBanca(a))?_srRompe(a,'total',tot):[];
       const cssT=srT.length?'background:#F2C230;color:#1a1200;':'color:var(--gold);';
       h+='<td'+(srT.length?' title="'+_srBadge(srT).replace(/"/g,'&quot;')+'"':'')+' style="text-align:center;padding:6px 4px;font-weight:700;font-family:Oswald;'+cssT+'font-size:13px">'
         +(srT.length?'<span style="display:block;font-size:8.5px;font-weight:800;letter-spacing:.6px;line-height:1.1"><i class=yl-i-estrella></i> RÉCORD</span>':'')+(tot||'—')+'</td>';}
      h+=_posCellHtml(isCurrentAthlete?cur:a,{fs:Math.round(11*rsc)});
      h+='</tr>';
      // Fila del/los intento(s) EXTRA (duplicado abajo, solo si tiene)
      // No se exige la marca `extra`: si hay un 4º intento se muestra igual, para
      // que siempre haya de dónde borrarlo (ver _normExtraAtts).
      const extraLifts = LIFTS.filter(l=>(a.att[l]||[]).length>=4 && a.att[l][3]);
      if(extraLifts.length){
        const gr0=((a.att[extraLifts[0]][3]||{}).grantedRound)||0;
        const exLbl=gr0>=2?'4º INTENTO':'INTENTO EXTRA';
        // ¿va al final de la ronda o lo repite enseguida?
        const _alFinal=extraLifts.every(l=>(((a.att[l][3]||{}).mode)||'endround')!=='self');
        let h0=h; h='';
        h+='<tr '+(curOnExtra?'id="ctCurrentLifter" ':'')+'style="border-bottom:1px solid rgba(29,49,80,.18);'+(curOnExtra?'background:linear-gradient(90deg,#60a5fa33,#60a5fa12);box-shadow:inset 3px 0 0 #60a5fa;':'background:rgba(96,165,250,.05)')+'">';
        h+='<td style="text-align:center;padding:6px 4px;color:'+(curOnExtra?'#fff':'#60a5fa')+';font-size:'+Math.round(13*rsc)+'px">↳</td>';
        h+='<td style="padding:6px 8px"><div style="font-size:'+Math.round(11*rsc)+'px;font-weight:'+(curOnExtra?800:500)+';color:'+(curOnExtra?'#fff':'var(--text)')+';display:flex;align-items:center;gap:5px;flex-wrap:wrap">'+(curOnExtra?'<span style="background:#60a5fa;color:#fff;padding:1px 6px;border-radius:4px;font-size:9px;font-family:Oswald;letter-spacing:1px"><i class=yl-i-reproducir></i></span>':'')+'<span>'+a.name+'</span><span style="background:#60a5fa;color:#fff;padding:1px 6px;border-radius:4px;font-size:8px;font-family:Oswald;letter-spacing:1px">'+exLbl+'</span></div></td>';
        LIFTS.forEach(l=>{
          if((a.att[l]||[]).length>=4 && a.att[l][3]){
            const isCurrentCell = curOnExtra && l===DATA.lift;
            h+=_attCellCompete(a,l,3,isCurrentCell); // la casilla del extra
            h+='<td></td><td></td>'; // 2 vacías para mantener la grilla de 3 por lift
          }else{
            h+='<td></td><td></td><td></td>';
          }
        });
        h+='<td></td><td></td>';
        h+='</tr>';
        const _fila=h; h=h0;
        if(_alFinal)_filasAlFinal.push(_fila); else h+=_fila;
      }
      // ── Fila ESPEJO de Only Bench (estilo LiftingCast) ──────────────────
      // Si el atleta compite en PL + Only Bench, en BANCA sale una segunda vez
      // debajo con su MISMO intento: sube a tarima una sola vez y esa banca
      // cuenta para los dos rankings. Es un reflejo de solo lectura del mismo
      // dato — al marcar válido/nulo arriba, acá queda automático (imposible
      // que se desincronicen). Sentadilla y peso muerto son solo del PL.
      if(DATA.lift==='bp' && _isPlusBench(a)){
        const eqB=String(a.mod)==='equipped_bench';
        h+='<tr style="border-bottom:1px solid rgba(29,49,80,.18);background:rgba(167,139,250,.06)">';
        h+='<td style="text-align:center;padding:6px 4px;color:#a78bfa;font-size:'+Math.round(13*rsc)+'px">\u21B3</td>';
        h+='<td style="padding:6px 8px"><div style="font-size:'+Math.round(11*rsc)+'px;font-weight:500;color:var(--text);display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span>'+a.name+'</span>'
          +'<span style="background:#a78bfa;color:#0A1628;padding:1px 6px;border-radius:4px;font-size:8px;font-family:Oswald;font-weight:700;letter-spacing:1px">ONLY BENCH'+(eqB?' EQ':'')+'</span>'
          +'<span style="font-size:8px;color:var(--muted)">mismo intento \u2014 se marca solo</span></div></td>';
        LIFTS.forEach(l=>{
          for(let j=0;j<3;j++){
            if(l!=='bp'){h+='<td></td>';continue;}
            const at=a.att.bp[j]||{w:0,r:null};
            const cls=at.r==='g'?'att-g':at.r==='n'?'att-n':at.w>0?'att-p':'att-e';
            h+='<td style="padding:'+Math.round(3*rsc)+'px;vertical-align:top"><div class="'+cls+' att" title="Reflejo del intento de banca (no se edita ac\u00e1)" style="font-size:'+Math.round(12*rsc)+'px;font-weight:700;padding:'+Math.round(8*rsc)+'px 4px;opacity:.92;cursor:default">'+(at.w||'\u2014')+'</div></td>';
          }
        });
        h+='<td style="text-align:center;padding:6px 4px;font-weight:700;font-family:Oswald;color:#a78bfa;font-size:12px">'+(bestOf(a,'bp')||'\u2014')+'</td>';
        h+='<td></td>';
        h+='</tr>';
      }
    });
    h+=_filasAlFinal.join('');
    h+='</tbody></table></div></div>';
  });
  h+='</div>';
  h+='</div>';
  // Ranking GL \u2014 ahora abajo, a todo el ancho (antes era una barra lateral de 300px
  // que le quitaba ancho a "Todas las tandas").
  h+='<div class="card"><h3 class="os" style="font-size:12px;letter-spacing:1px;margin-bottom:8px;color:var(--gold)">RANKING GL</h3>';
  if(!rk.length)h+='<p style="color:var(--muted);font-size:11px;text-align:center;padding:14px">Sin totales</p>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px 14px">';
  rk.forEach((a,i)=>{h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 5px;border-bottom:1px solid rgba(29,49,80,.2)"><div style="display:flex;align-items:center;gap:6px"><span class="os" style="color:'+(i<3?'var(--gold)':'var(--muted)')+';font-weight:700;font-size:15px;width:20px">'+(i+1)+'</span><div><div style="font-weight:600;font-size:11px">'+a.name+'</div><div style="font-size:9px;color:var(--muted)">SQ '+bestOf(a,'sq')+' \u00b7 BP '+bestOf(a,'bp')+' \u00b7 DL '+bestOf(a,'dl')+'</div></div></div><div style="text-align:right"><div class="os" style="font-size:16px;font-weight:700;color:var(--gold)">'+a.gl+'</div><div style="font-size:9px;color:var(--muted)">'+a.total+'kg</div></div></div>'});
  h+='</div></div>';
  h+='</div>';
  // ── Auto-scroll estilo LiftingCast ──────────────────────────────────────
  // Acomoda la tabla al atleta EN TARIMA. Solo se mueve cuando CAMBIA el
  // levantador/intento (no molesta mientras editas ni si haces scroll a mano), y
  // respeta el foco en un input. Se puede apagar con el botón "⤓ Auto-scroll".
  {const _ck=cur?(DATA.flight+'_'+DATA.lift+'_'+DATA.round+'_'+cur.id+'_'+curAtt(cur)):'';
   if(window._ctAutoScroll!==false && _ck && _ck!==window._ctScrollKey){
     setTimeout(()=>{
       const f=document.activeElement;
       if(f&&(f.tagName==='INPUT'||f.tagName==='SELECT'||f.tagName==='TEXTAREA'))return;
       const el=document.getElementById('ctCurrentLifter');
       if(el){window._ctScrollKey=_ck;el.scrollIntoView({behavior:'smooth',block:'center'});}
     },160);
   }}
  return h;
}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

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
  DATA.compTimer={id:id,lift:l,min:Math.max(1,Math.min(5,min)),startedAt:_ahora()};
  saveNow();R();
  const a=DATA.athletes.find(x=>x.id===id);
  showToastLC(min+' min compensatorios para '+(a?a.name:'atleta'));
};

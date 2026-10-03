// livecast.html — Las luces de los jueces: escucharlas, anotarlas en cada intento y avisarles quién está en la barra.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// Judge mode functions
async function toggleJudgeMode(){
  judgeMode=!judgeMode;
  if(judgeMode){
    if(!fbReady){
      showToastLC('Firebase no conectado — esperando conexión para activar panel de jueces');
      // Retry when fbReady becomes true (poll every 500ms, max 20s)
      let attempts=0;
      const waitFB=setInterval(()=>{
        attempts++;
        if(fbReady){clearInterval(waitFB);startJudgeListener();showToastLC('Modo Jueces ACTIVADO — Firebase conectado');}
        else if(attempts>=40){clearInterval(waitFB);judgeMode=false;showToastLC('Firebase no disponible — usa modo manual');R();}
      },500);
    }else{
      startJudgeListener();
      showToastLC('Modo Jueces ACTIVADO — las decisiones vienen del panel de jueces');
    }
  }else{
    if(judgeUnsub){judgeUnsub();judgeUnsub=null}
    if(_timerUnsub){try{_timerUnsub()}catch(e){} _timerUnsub=null;}
    showToastLC('Modo Jueces DESACTIVADO — decisiones manuales');
  }
  R();
}

function startJudgeListener(){
  if(!fbReady)return;
  if(judgeUnsub){judgeUnsub();judgeUnsub=null}
  // Antes el oyente del cronómetro no se soltaba nunca: cada vez que se
  // encendía el modo jueces se sumaba otro, y quedaban escuchando el canal viejo.
  if(_timerUnsub){try{_timerUnsub()}catch(e){} _timerUnsub=null;}
  _judgeDoc=juezDocId();
  // Las órdenes de reloj (INICIAR TIMER del juez central, y la Planilla) ya no
  // dependen del modo jueces: las escucha siempre _escucharTimerControl().
  // Cada votación se aplica UNA vez, y al intento que estaba en barra cuando
  // llegó la primera luz. Antes se aplicaba en CADA cambio del documento con las
  // tres luces puestas —y el documento cambia solo, por ejemplo cuando la mesa
  // le avisa a los jueces quién está en barra—: si se revertía una decisión, al
  // rato volvía la original, o le caía a quien estuviera primero en la cola.
  let _juezPrimera=true;
  judgeUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'judge_decisions',_judgeDoc),(snap)=>{
    if(!snap.exists())return;
    const d=snap.data();
    judgeLights={izq:d.izq||null,central:d.central||null,der:d.der||null};
    const votos=[judgeLights.izq,judgeLights.central,judgeLights.der];
    const cuantas=votos.filter(Boolean).length;
    const ronda=String(d.reset_ts||'');
    // Al encender el modo jueces, lo que ya estaba en el documento es viejo.
    if(_juezPrimera){ _juezPrimera=false; if(cuantas===3)_juezAplicada=ronda+'|'+votos.join(','); R(); return; }
    if(cuantas===0){ _juezDestino=null; R(); return; }
    if(!_juezDestino||_juezDestino.ronda!==ronda){
      const cur=liftQueue()[0];
      _juezDestino=cur?{ronda,id:cur.id,lift:DATA.lift,round:DATA.round,r4:!!cur.__is4}:null;
    }
    if(cuantas===3&&_juezDestino){
      const firma=ronda+'|'+votos.join(',');
      if(firma!==_juezAplicada){
        _juezAplicada=firma;
        const goods=votos.filter(v=>v==='white').length;
        const result=goods>=2?'g':'n';
        const dst=_juezDestino;
        setTimeout(()=>{   // 2 s para que se vean las luces antes de avanzar
          const a=DATA.athletes.find(x=>x.id===dst.id);
          const rr=dst.r4?3:dst.round;
          const at=a&&a.att[dst.lift]&&a.att[dst.lift][rr];
          // Si la mesa ya lo juzgó a mano, o lo corrigió, manda la mesa.
          if(!at||at.r!==null)return;
          setResult(dst.id,dst.lift,rr,result);
        },2000);
      }
    }
    R();
  });
}

function _escucharLucesHistorial(){
  if(!fbReady||!window._fb||!fbDB)return;
  // Ya escuchando el canal de este campeonato: nada que hacer. Si se cambió de
  // campeonato, se suelta el canal del anterior.
  if(_lucesHistUnsub&&_lucesHistDoc===juezDocId())return;
  if(_lucesHistUnsub){try{_lucesHistUnsub()}catch(e){} _lucesHistUnsub=null;_lucesHistDestino=null;}
  _lucesHistDoc=juezDocId();
  try{
    _lucesHistUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'judge_decisions',_lucesHistDoc),(snap)=>{
      if(!snap.exists())return;
      const d=snap.data();
      // La decisión del jurado (panel de jueces → JURY). Se aplica una vez por
      // su hora; la que ya estaba en el documento al abrir esta pantalla es vieja.
      { const j=d.jurado;
        if(_juradoVisto===null)_juradoVisto=(j&&j.ts)||0;
        else if(j&&j.ts&&j.ts>_juradoVisto){ _juradoVisto=j.ts; _aplicarJurado(j); } }
      const L={izq:d.izq||null,central:d.central||null,der:d.der||null};
      const cuantas=[L.izq,L.central,L.der].filter(Boolean).length;
      if(cuantas===0){_lucesHistDestino=null;return;}      // se apagaron: listo para el próximo
      if(!_lucesHistDestino){
        const cur=liftQueue()[0];
        if(!cur)return;
        _lucesHistDestino={id:cur.id,lift:DATA.lift,round:DATA.round};
      }
      if(cuantas<3)return;                                  // todavía falta algún juez
      const dst=_lucesHistDestino;
      const firma=dst.id+'|'+dst.lift+'|'+dst.round+'|'+L.izq+L.central+L.der;
      if(firma===_lucesHistUlt)return;
      _lucesHistUlt=firma;
      const a=DATA.athletes.find(x=>x.id===dst.id);
      const at=a&&a.att[dst.lift]&&a.att[dst.lift][dst.round];
      if(!at)return;
      at.luces=L;
      saveNow();R();
    },(e)=>console.warn('[luces] no se pudieron anotar:',e.message));
  }catch(e){console.warn('[luces] no se pudo escuchar',e);}
}

// Los tres circulitos de un intento ya juzgado. Devuelve '' si de ese intento no
// hay luces: en un campeonato sin luces, o en el que se cargó a mano, no tiene
// que aparecer nada.
function _lucesDeIntento(at,px){
  const L=at&&at.luces;
  if(!L||!L.izq||!L.central||!L.der)return '';
  const d=px||9;
  const pt=(v)=>{
    const e=_luzEstilo(v);
    return '<span style="display:inline-flex;flex-direction:column;align-items:center;gap:1px">'
      +'<span style="width:'+d+'px;height:'+d+'px;border-radius:50%;background:'+e.bg+';border:1px solid '+e.bd+';display:block"></span>'
      +(e.chip&&v!=='red'
        ? '<span style="width:'+Math.max(3,Math.round(d*.42))+'px;height:'+Math.max(3,Math.round(d*.42))+'px;border-radius:50%;background:'+e.chip+';display:block"></span>'
        : '<span style="height:'+Math.max(3,Math.round(d*.42))+'px;display:block"></span>')
      +'</span>';
  };
  return '<span style="display:inline-flex;gap:'+Math.max(2,Math.round(d*.34))+'px;align-items:flex-start;justify-content:center;line-height:1">'
    +pt(L.izq)+pt(L.central)+pt(L.der)+'</span>';
}

// El último intento juzgado en la tanda: el que el jurado puede revertir. Se
// sabe por la hora que cada intento guarda en su último cambio (at.t).
function _ultimoJuzgado(){
  let best=null;
  (DATA.athletes||[]).forEach(a=>{
    if(!a||a.flight!==DATA.flight)return;
    ['sq','bp','dl'].forEach(l=>((a.att&&a.att[l])||[]).forEach((at,r)=>{
      if(!at||(at.r!=='g'&&at.r!=='n')||!at.t)return;
      if(!best||at.t>best.ts)best={id:a.id,name:a.name||'',lift:l,round:r,r:at.r,w:at.w||0,ts:at.t};
    }));
  });
  return best;
}

async function _avisarAtletaAJueces(){
  if(!fbReady||!fbDB||!window._fb)return;
  try{
    const cur=liftQueue()[0];
    const lift=LIFT_S[DATA.lift]||'';
    const ult=_ultimoJuzgado();
    const firma=juezDocId()+'|'+(cur?cur.name:'')+'|'+lift+'|'+DATA.round
      +'|'+(ult?ult.id+'-'+ult.lift+'-'+ult.round+'-'+ult.r:'');
    if(firma===_juezUltAtleta)return;
    _juezUltAtleta=firma;
    const campos={
      // El panel de los jueces muestra de qué campeonato es: con dos a la misma
      // hora, el juez ve que abrió el link correcto.
      evento:(DATA.event&&DATA.event.name)||'',
      athlete_name:cur?cur.name:'',
      athlete_weight:cur?(cur.att[DATA.lift][DATA.round]||{}).w||0:0,
      athlete_lift:lift,
      athlete_round:DATA.round
    };
    if(ult)campos.ultimo=ult;
    await window._fb.setDoc(window._fb.doc(fbDB,'judge_decisions',juezDocId()),campos,{merge:true});
  }catch(e){console.warn('[jueces] no se pudo avisar el atleta en barra',e);}
}

async function resetJudgeLights(){
  judgeLights={izq:null,central:null,der:null};
  if(!fbReady)return;
  try{
    // Send current athlete info + reset
    const queue=liftQueue();
    const cur=queue[0];
    await window._fb.setDoc(window._fb.doc(fbDB,'judge_decisions',juezDocId()),{
      izq:null,central:null,der:null,
      reset_ts:Date.now(),
      evento:(DATA.event&&DATA.event.name)||'',
      athlete_name:cur?cur.name:'',
      athlete_weight:cur?cur.att[DATA.lift][DATA.round].w:0,
      athlete_lift:LIFT_S[DATA.lift]||'',
      athlete_round:DATA.round
    });
  }catch(e){console.warn('Reset judge lights error',e)}
}

// El jurado revierte un intento ya juzgado. Manda el jurado: no se pregunta, no
// se mueve ningún reloj (como cualquier corrección) y queda anotado en el
// intento con su tarjeta, para el acta y la transmisión. Si dos equipos de la
// mesa lo reciben, los dos escriben lo mismo.
let _juradoVisto=null;
function _aplicarJurado(j){
  const a=DATA.athletes.find(x=>x.id===j.id);
  const at=a&&a.att&&a.att[j.lift]&&a.att[j.lift][j.round];
  if(!at||(j.res!=='g'&&j.res!=='n'))return;
  const antes=at.r;
  at.r=j.res;
  at.jurado={res:j.res,card:j.card||null,ts:j.ts};
  _markAtt(a.id,'att_'+j.lift+'_'+j.round);
  a.bombed=a.att.sq.every(x=>x.r==='n')&&a.att.bp.every(x=>x.r==='n')&&a.att.dl.every(x=>x.r==='n');
  if(j.res==='g'&&antes!=='g'){ try{checkRecord(a,j.lift,j.round);}catch(e){} }
  if((antes==='g'||antes==='n')&&antes!==j.res)_reiniciarEntregaTrasCorreccion(a,j.lift,j.round);
  saveNow();R();
  showToastLC('Decisión del jurado: '+a.name+' — '+(LIFT_S[j.lift]||j.lift)+(j.round+1)+' → '+(j.res==='g'?'VÁLIDO':'NULO'));
}

// ── Órdenes de reloj desde el panel de jueces ────────────────
// El juez central (INICIAR TIMER) y la Planilla mandan órdenes al documento
// timer_control del canal. Antes se escuchaban solo con el modo jueces
// encendido —que no se usa—, así que el botón no hacía nada. Ahora el puesto que
// opera las escucha siempre:
//   start     → el minuto del intento desde 60, y se muestra en la transmisión
//               y en las pantallas de tarima (relojVisible)
//   stop      → se detiene donde va (el atleta empezó)
//   hide      → deja de mostrarse
//   break     → el "Ya volvemos" con esos minutos (el mismo de Control TX)
//   breakOff  → se quita el "Ya volvemos"
// La orden que ya estaba en el documento al abrir esta pantalla es vieja.
let _tcUnsub=null,_tcDoc=null,_tcVisto=null;
function _escucharTimerControl(){
  if(!fbReady||!window._fb||!fbDB)return;
  if(_tcUnsub&&_tcDoc===juezDocId())return;
  if(_tcUnsub){try{_tcUnsub()}catch(e){} _tcUnsub=null;}
  _tcDoc=juezDocId(); _tcVisto=null;
  try{
    _tcUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'timer_control',_tcDoc),(snap)=>{
      const d=snap.exists()?snap.data():{};
      if(_tcVisto===null){ _tcVisto=d.ts||0; return; }
      if(!d.ts||d.ts<=_tcVisto)return;
      _tcVisto=d.ts;
      _ordenReloj(d);
    },(e)=>console.warn('[reloj] no se pudo escuchar',e.message));
  }catch(e){console.warn('[reloj] no se pudo escuchar',e);}
}

function _ordenReloj(d){
  const a=d.action;
  if(a==='start'){
    DATA.relojVisible=true;
    if(mainTI){clearInterval(mainTI);mainTI=null;}
    DATA.timer=60; DATA.timerOn=false; DATA.timerStartedAt=0;
    startTimer();
    showToastLC('Reloj del intento iniciado'+(d.by==='planilla'?' (planilla)':''));
  }else if(a==='stop'){
    if(DATA.timerOn)pauseTimer(); else syncToFB();
    showToastLC('Reloj del intento detenido');
  }else if(a==='hide'){
    DATA.relojVisible=false; syncToFB(); R();
  }else if(a==='break'){
    const min=Math.max(1,Math.min(120,parseInt(d.min,10)||0));
    if(!min)return;
    const prev=(typeof _descBT==='function'&&_descBT())||{};
    _descEscribe({active:true,startedAt:Date.now(),durationSec:min*60,label:prev.label||'',pausedAt:0,
      videos:prev.videos||[],movement:prev.movement||'',style:_descEstiloPrevio()});
    showToastLC('Ya volvemos: '+min+' min (planilla)');
  }else if(a==='breakOff'){
    _descEscribe({active:false,startedAt:0,durationSec:0,label:'',pausedAt:0,videos:[],movement:'',style:_descEstiloPrevio()});
  }
}

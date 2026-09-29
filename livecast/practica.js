// livecast.html — Modo práctica (?practica=1) para entrenar jueces con datos ficticios.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

function _genPracticeRoster(){
  const firstM=['Bruno','Diego','Franco','Hugo','Jorge','Lucas','Nico','Pablo','Simón','Tomás','Iván','Mateo','Andrés','Felipe','Gonzalo','Rodrigo','Sergio','Vicente'];
  const firstF=['Ana','Carla','Elena','Gabriela','Iris','Karen','Marta','Olivia','Renata','Rocío','Sofía','Valentina','Antonia','Josefa','Camila','Fernanda','Paula','Trinidad'];
  const last=['Pérez','Soto','Muñoz','Rojas','Vidal','Contreras','Silva','Reyes','Torres','Bravo','Fuentes','Araya','Cortés','Navarro','Herrera','Castro','Vega','Pizarro'];
  // Categorías oficiales IPF (2 atletas por cada una, hombres y mujeres).
  const catsM=[53,59,66,74,83,93,105,120,'120+'];
  const catsF=[43,47,52,57,63,69,76,84,'84+'];
  const rnd25=v=>Math.round(v/2.5)*2.5;
  const athletes=[];
  let id=0, mi=0, fi=0;
  const push=(sex,catStr)=>{
    const catNum=parseFloat(String(catStr))||120;
    const plus=String(catStr).includes('+');
    const pool=sex==='Hombre'?firstM:firstF;
    const idx=sex==='Hombre'?mi++:fi++;
    const name=pool[idx%pool.length]+' '+last[(id*3+idx)%last.length]+' (Práctica)';
    // Peso corporal dentro de la categoría (para "+", un poco por encima del límite).
    const bw=plus?Math.round((catNum+(3+Math.random()*10))*10)/10:Math.round((catNum-(0.3+Math.random()*2.2))*10)/10;
    const factor=sex==='Hombre'?1:0.62; // mujeres levantan proporcionalmente menos
    const sqOpen=rnd25(catNum*0.85*factor*(0.9+Math.random()*0.3));
    const bpOpen=rnd25(catNum*0.55*factor*(0.9+Math.random()*0.3));
    const dlOpen=rnd25(catNum*1.0*factor*(0.9+Math.random()*0.3));
    athletes.push({
      id,lot:id+1,name,rut:'',sex,cat:String(catStr),div:'Open',
      club:'Club Práctica FECHIPO',uni:'',mod:'classic',country:'CHI',
      bw,flight:'A',jornada:'',rackSQ:String(3+Math.floor(Math.random()*8)),rackBP:String(2+Math.floor(Math.random()*6)),
      bombed:false,weighedIn:true,
      att:{
        sq:[{w:sqOpen,r:null},{w:0,r:null},{w:0,r:null}],
        bp:[{w:bpOpen,r:null},{w:0,r:null},{w:0,r:null}],
        dl:[{w:dlOpen,r:null},{w:0,r:null},{w:0,r:null}]
      }
    });
    id++;
  };
  // Mujeres primero, luego hombres; 2 por categoría.
  catsF.forEach(c=>{push('Mujer',c);push('Mujer',c);});
  catsM.forEach(c=>{push('Hombre',c);push('Hombre',c);});
  // Repartir en tandas de a 10 para no tener una sola tanda gigante (A, B, C, D…).
  athletes.forEach((a,k)=>{a.flight=String.fromCharCode(65+Math.floor(k/10));});
  return athletes;
}

function _initPracticeMode(){
  // Vista de ESPECTADOR de la práctica (?practica=1&espectador=1): sin admin, ve
  // COMPETENCIA EN VIVO como el público, leyendo la data compartida por
  // localStorage y siguiéndola en vivo (via _initPracticeSync). No genera roster:
  // usa el que cargó el Control en Vivo.
  if(PRACTICE_VIEWER){
    isAdmin=false; window.ADMIN_ROLE=null;
    if(!DATA.event)DATA.event={id:'practica_jueces',name:PRACTICE_EVENT_NAME,short:'PRÁCTICA (no oficial)',recordsEnabled:false};
    DATA.phase='liveView';
    const chip=document.createElement('div');
    chip.textContent='PRÁCTICA · ESPECTADOR'+(PRACTICE_REAL?' · NÓMINA REAL':'');
    chip.title='Vista de espectador de la práctica (no oficial).';
    chip.style.cssText='position:fixed;bottom:8px;right:8px;z-index:99999;background:rgba(212,168,67,.85);color:#0A1628;font-family:Oswald,sans-serif;font-weight:700;font-size:10px;letter-spacing:1px;padding:3px 9px;border-radius:10px;opacity:.75';
    document.body.appendChild(chip);
    R();
    return;
  }
  isAdmin=true;
  window.ADMIN_ROLE='owner';
  // Estado de la pantalla de tarima guardado (modo/tandas/tamaño) — para que la
  // pestaña ?tx=screen&practica=1 arranque mostrando lo que eligió el operador.
  try{
    const sc=JSON.parse(localStorage.getItem(PRACTICE_SCREEN_KEY)||'null');
    if(sc){
      window._SCREEN_STATE={mode:sc.mode||'jornada',flights:Array.isArray(sc.flights)?sc.flights:null,nameScale:typeof sc.nameScale==='number'?sc.nameScale:1,
        fondo:sc.fondo||'bandera',luces:!!sc.luces,
        veloBandera:typeof sc.veloBandera==='number'?sc.veloBandera:0.55};
      window._JORNADA_FLIGHTS=window._SCREEN_STATE.flights;
      window._JORNADA_NAMESCALE=window._SCREEN_STATE.nameScale;
      if(window._SCREEN_LOCAL){window._SCREEN_LOCAL.mode=window._SCREEN_STATE.mode;if(Array.isArray(sc.flights))window._SCREEN_LOCAL.flights=sc.flights;window._SCREEN_LOCAL.nameScale=window._SCREEN_STATE.nameScale;}
    }
  }catch(e){}
  // La pestaña de la PANTALLA / widgets (?tx=…) NO debe generar su propio roster:
  // usa el que ya guardó el Control en Vivo. Solo la pestaña principal lo genera.
  if(!DATA.athletes||!DATA.athletes.length){
    if(TX_MODE){R();return;} // sin data aún: quedará transparente hasta que el control guarde
    if(PRACTICE_REAL){
      // Práctica con nómina real: no se genera roster ficticio. Se muestra el
      // selector de campeonato (setup) y al elegir uno, pickEvent/loadLiveAthletes
      // carga los atletas REALES desde Firestore (solo lectura). Si vino &evento=
      // en la URL, applyEventURLParam lo elige solo cuando llega el snapshot.
      DATA.phase='setup';
    }else{
      DATA.event={id:'practica_jueces',name:PRACTICE_EVENT_NAME,short:'PRÁCTICA (no oficial)',recordsEnabled:false};
      DATA.athletes=_genPracticeRoster();
      DATA.lift='sq';DATA.round=0;DATA.flight='A';DATA.changeTimers={};DATA.lotsGenerated=true;DATA.forcedCurrent=null;
      DATA.phase='manage';
      save();
    }
  }
  // Chip discreto abajo a la derecha (antes era una barra amarilla arriba que
  // molestaba visualmente). Sigue avisando que es práctica, sin tapar la UI ni la
  // transmisión. Se puede ocultar con un click. En la pantalla/proyección (?tx=…)
  // NO se muestra para no ensuciar la imagen.
  if(!TX_MODE){
    const banner=document.createElement('div');
    banner.textContent='PRÁCTICA'+(PRACTICE_REAL?' · NÓMINA REAL (solo lectura)':'');
    banner.title=PRACTICE_REAL
      ?'Práctica con nómina real — Firebase en solo lectura, no toca la competencia real. Click para ocultar.'
      :'Modo práctica — atletas ficticios, nada se guarda en el servidor. Click para ocultar.';
    banner.onclick=function(){banner.style.display='none';};
    banner.style.cssText='position:fixed;bottom:8px;right:8px;z-index:99999;background:rgba(212,168,67,.85);color:#0A1628;font-family:Oswald,sans-serif;font-weight:700;font-size:10px;letter-spacing:1px;padding:3px 9px;border-radius:10px;cursor:pointer;opacity:.75';
    document.body.appendChild(banner);
  }
  R();
}

// Sincronización entre pestañas en modo práctica (sin Firebase). El evento
// 'storage' se dispara en las OTRAS pestañas del mismo navegador cuando el
// Control en Vivo guarda: recargamos la data (o el estado de pantalla) y
// re-renderizamos, así la Pantalla de Tarima sigue al control en vivo.
function _initPracticeSync(){
  window.addEventListener('storage',(e)=>{
    if(!e)return;
    if(e.key===SAVE_KEY && e.newValue){
      try{const d=JSON.parse(e.newValue);if(d&&d.phase){
        d.timerOn=false;
        // El espectador / pantalla NO debe cambiar de vista por lo que hace el
        // control (ej. que el admin pase a "manage" o "compete"): conserva su fase.
        const keepPhase=(PRACTICE_VIEWER||TX_MODE)?DATA.phase:null;
        Object.assign(DATA,d);
        if(keepPhase)DATA.phase=keepPhase;
      }}catch(_){}
    } else if(e.key===PRACTICE_SCREEN_KEY && e.newValue){
      try{const d=JSON.parse(e.newValue);
        window._SCREEN_STATE={mode:d.mode||'jornada',flights:Array.isArray(d.flights)?d.flights:null,nameScale:typeof d.nameScale==='number'?d.nameScale:1,
          fondo:d.fondo||'bandera',luces:!!d.luces,
        veloBandera:typeof d.veloBandera==='number'?d.veloBandera:0.55};
        window._JORNADA_FLIGHTS=window._SCREEN_STATE.flights;
        window._JORNADA_NAMESCALE=window._SCREEN_STATE.nameScale;
        if(window._SCREEN_LOCAL){window._SCREEN_LOCAL.mode=window._SCREEN_STATE.mode;if(Array.isArray(d.flights))window._SCREEN_LOCAL.flights=d.flights;window._SCREEN_LOCAL.nameScale=window._SCREEN_STATE.nameScale;
          window._SCREEN_LOCAL.fondo=window._SCREEN_STATE.fondo;window._SCREEN_LOCAL.luces=window._SCREEN_STATE.luces;
          window._SCREEN_LOCAL.veloBandera=window._SCREEN_STATE.veloBandera;}
      }catch(_){}
    } else return;
    if(TX_MODE){if(typeof _txLastLifter!=='undefined')_txLastLifter=null;}
    R();
  });
}

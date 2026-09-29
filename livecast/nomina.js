// livecast.html — La nómina en vivo desde Firestore y las tandas del Cronograma.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// ── REAL-TIME ATHLETE LOADING FROM FIRESTORE ────────────────
// Trae el flight/jornada asignado en la pestaña Cronograma del admin
// (doc Firestore cronograma/{eventId}), matcheando por nombre normalizado.
// Es un getDoc puntual (no listener en vivo) — se llama solo cuando se
// carga o resincroniza la nómina, no en cada cambio, para no sumar
// lecturas de Firestore de más.
function _nnCrono(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();}

// Busca la tanda de un atleta en el mapa del Cronograma. Primero intenta match exacto
// (nombre normalizado); si no hay, intenta un match flexible por subconjunto de palabras.
// Motivo: el Cronograma a veces trae el nombre completo con segundo nombre (ej. "Andres
// SIMÓN Neira Acevedo") mientras que la inscripción solo tiene "Andres Neira Acevedo" — con
// match exacto esos casos quedaban sin tanda asignada. Requiere que TODAS las palabras del
// nombre más corto estén contenidas en el más largo, así nunca cruza por coincidencia
// parcial de un solo apellido suelto entre dos personas distintas.
function _cronoLookup(map,name){
  if(!map)return null;
  const key=_nnCrono(name);
  if(map[key])return map[key];
  const qTokens=key.split(' ').filter(Boolean);
  if(qTokens.length<2)return null;
  const qSet=new Set(qTokens);
  for(const k in map){
    const kTokens=k.split(' ').filter(Boolean);
    if(kTokens.length<2)continue;
    const kSet=new Set(kTokens);
    const small=qSet.size<=kSet.size?qSet:kSet, big=qSet.size<=kSet.size?kSet:qSet;
    let subset=true;
    for(const t of small){if(!big.has(t)){subset=false;break;}}
    if(subset)return map[k];
  }
  return null;
}

// El Cronograma manda también en división de edad, categoría y modalidad, no solo
// en la tanda: es la planilla que la federación revisa y firma, mientras que la
// inscripción la llenó el atleta y suele venir con la división vieja o sin marcar
// Olimpiadas Especiales. Estos tres helpers traducen lo que trae el Cronograma al
// formato que guarda el livecast.
function _modDesdeTexto(txt){
  const t=String(txt||'').toLowerCase();
  const eq=t.includes('equipado')||t.includes('equipped');
  const bench=t.includes('only bench')||t.includes('onlybench')||t.includes('only_bench');
  const comb=t.includes('+');
  const oe=t.includes('special olympics')||t.includes('olimpiadas')||t.includes(' oe')||t.trim().endsWith('oe');
  let mod;
  if(oe) mod=bench?'oe_bench':'oe_classic';
  else if(comb&&eq) mod='equipped_bench';
  else if(comb) mod='classic_bench';
  else if(bench&&eq) mod='equipped_bench';
  else if(bench) mod='onlybench';
  else if(eq) mod='equipped';
  else mod='classic';
  return {mod,plusBench:comb};
}

// "-83 kg" -> "83", "+120 kg" -> "120+", "84+" -> "84+"
function _cronoCat(txt){
  const m=String(txt||'').match(/(\d+)\s*\+|\+\s*(\d+)|(\d+)/);
  if(!m)return '';
  return m[1]?m[1]+'+':(m[2]?m[2]+'+':m[3]);
}

function _cronoDiv(txt){
  const t=_nnCrono(txt).replace(/[^a-z0-9]/g,'');
  return _CRONO_DIVS.find(d=>_nnCrono(d).replace(/[^a-z0-9]/g,'')===t)||'';
}

function _cronoMapDeRows(rows){
  const map={};
  (rows||[]).forEach(r=>{
    if(!r.nombre)return;
    const e={flight:r.flight||'',jornada:_cronoJor(r),div:_cronoDiv(r.division),cat:_cronoCat(r.categoria)};
    if(String(r.modalidad||'').trim()){const m=_modDesdeTexto(r.modalidad);e.mod=m.mod;e.plusBench=m.plusBench;}
    map[_nnCrono(r.nombre)]=e;
  });
  return map;
}

async function _loadCronoFlightMap(evId){
  if(!fbReady||!window._fb||!evId)return null;
  try{
    const snap=await window._fb.getDoc(window._fb.doc(fbDB,'cronograma',evId));
    if(!snap.exists())return null;
    const rows=snap.data().rows;
    if(!Array.isArray(rows)||!rows.length)return null;
    return _cronoMapDeRows(rows);
  }catch(e){console.warn('[crono] flightMap',e.message);return null;}
}

function _subscribeCronoFlightMap(evId){
  if(!fbReady||!window._fb||!evId)return;
  if(_cronoFlightUnsub){_cronoFlightUnsub();_cronoFlightUnsub=null;}
  try{
    _cronoFlightUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'cronograma',evId),(snap)=>{
      if(!snap.exists())return;
      const rows=snap.data().rows;
      if(!Array.isArray(rows))return;
      const map=_cronoMapDeRows(rows);
      window._cronoFlightMap=map;
      _applyCronoFlightsToAthletes(map);
    });
  }catch(e){console.warn('[crono] subscribe',e.message);}
}

// Reaplica flight/jornada del Cronograma a los atletas ya cargados (por si cambiaron
// DESPUÉS de la carga inicial). Solo toca lo que vino del Cronograma — no inventa nada
// si un atleta no está ahí.
// El número de lote LLEVA la tanda adentro: se sortean como base de tanda + posición
// (A → 100, 101…; B → 200, 201…). Así que si un atleta cambia de tanda, su lote queda
// de la tanda vieja: aparece un 104 en la tanda E y el orden de salida se desordena.
// Acá se le da el primer lote libre de su tanda nueva. NO se toca el de nadie más:
// re-sortear todo cambiaría el orden de salida de los 62.
// La base sale del NÚMERO de la tanda contando en letras (A=1 … Z=26, AA=27),
// no del primer carácter: con `charCodeAt(0)` la tanda AA daba la misma base que
// la A y los lotes de las dos se pisaban. Las tandas del Sudamericano llegan
// hasta la AJ.
function _baseTanda(fl){
  const t=String(fl||'').toUpperCase().replace(/[^A-Z]/g,'');
  if(!t)return 0;
  let n=0;
  for(const c of t)n=n*26+(c.charCodeAt(0)-64);
  return n*100;
}

function _reubicarLote(a){
  if(!DATA.lotsGenerated||!a||!a.flight)return false;
  const base=_baseTanda(a.flight);
  if(!(base>0))return false;
  if(a.lot>=base&&a.lot<base+100)return false;      // ya está en el rango de su tanda
  const usados=new Set(DATA.athletes.filter(x=>x!==a).map(x=>x.lot));
  let n=base;
  while(usados.has(n))n++;
  a.lot=n;
  return true;
}

function _applyCronoFlightsToAthletes(map){
  if(!map||!DATA.athletes||!DATA.athletes.length)return;
  let tandas=0,datos=0;
  const armando=(DATA.phase==='setup'||DATA.phase==='manage');
  DATA.athletes.forEach(a=>{
    const entry=_cronoLookup(map,a.name)||(a.nombreOrig?_cronoLookup(map,a.nombreOrig):null);
    if(!entry)return;
    if(entry.flight && a.flight!==entry.flight){a.flight=entry.flight;tandas++;if(_reubicarLote(a))tandas++;}
    if(typeof entry.jornada==='string' && a.jornada!==entry.jornada){a.jornada=entry.jornada;tandas++;}
    // División, categoría y modalidad: manda el Cronograma. Solo se pisa cuando el
    // Cronograma trae el dato y es distinto — nunca se borra lo que ya tiene el atleta.
    // Y solo mientras se arma la nómina: con la competencia andando manda el operador,
    // porque un atleta que se pasa de peso cambia de categoría en el pesaje y el
    // Cronograma no se entera. La categoría además se respeta apenas está pesado.
    if(!armando)return;
    if(entry.div && a.div!==entry.div){a.div=entry.div;datos++;}
    if(entry.cat && String(a.cat)!==entry.cat && !a.weighedIn && !(+a.bw>0)){a.cat=entry.cat;datos++;}
    // Un invitado/a lo marca el operador en el pesaje, por algo que el Cronograma
    // no puede saber (no dio el peso). No se le devuelve la modalidad de nómina.
    if(_esInvitado(a))return;
    if(entry.mod && (a.mod!==entry.mod||!!a.plusBench!==!!entry.plusBench)){
      a.mod=entry.mod;a.plusBench=entry.plusBench;datos++;
    }
  });
  if(tandas||datos){
    save();R();
    showToastLC(datos?'Nómina actualizada desde el Cronograma (división, categoría y modalidad)'
                     :'Tandas actualizadas desde el Cronograma');
  }
}

function _inscToAthlete(ins, j, flightMap){
  const name=ins.nombre||'';
  const cronoEntry=_cronoLookup(flightMap,name);
  const fl=cronoEntry?cronoEntry.flight:(ins.flight||'A');
  // Modalidad, división y categoría: si el Cronograma las trae, manda el Cronograma;
  // la inscripción queda de respaldo para los atletas que no figuren ahí.
  // (Special Olympics vive acá: sin esto los OE de eventos EN VIVO quedaban como
  // 'classic' y competían en el ranking general en vez del suyo.)
  const insMod=_modDesdeTexto(ins.modalidad||'');
  const mod=(cronoEntry&&cronoEntry.mod)||insMod.mod;
  const isCombined=(cronoEntry&&cronoEntry.mod)?!!cronoEntry.plusBench:insMod.plusBench;
  const catNum=(cronoEntry&&cronoEntry.cat)||_cronoCat(ins.categoria)||(ins.categoria||'');
  const div=(cronoEntry&&cronoEntry.div)||ins.division||'';
  return{
    id:j,lot:j+1,name,rut:ins.rut||'',sex:ins.sexo||'',
    cat:catNum,div,club:ins.club==='Otro'?ins.clubOtro:ins.club||'',
    uni:ins.universidad||'',mod,plusBench:isCombined,bw:0,flight:fl,jornada:cronoEntry?cronoEntry.jornada:(ins.jornada||''),born:(String(ins.fechaNac||ins.dob||ins.born||'').match(/\d{4}/)||[''])[0],rackSQ:'',rackBP:'',
    bombed:false,weighedIn:false,
    att:{sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
         bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],
         dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]}
  };
}

function _mergeFirebaseAthletes(fbAthletes){
  // Merge: update existing athletes by name/rut, add new ones, remove deleted
  let changed=false;
  // Matchea atleta local con uno de Firestore: RUT primero; si no, nombre. El nombre
  // se compara igual que en el Cronograma (sin tildes, y aceptando que a uno le falte
  // el segundo nombre). Con la comparación exacta anterior, un "José Salamanca Ormeño"
  // contra "José Tomás Salamanca Ormeño" NO matcheaba: el atleta entraba como nuevo,
  // el viejo se borraba por sobrante, y de paso perdía su número de lote.
  const _r=s=>String(s||'').replace(/[^0-9kK]/g,'');
  const _mismoNombre=(x,y)=>{
    const a=_nnCrono(x||'').split(' ').filter(Boolean), b=_nnCrono(y||'').split(' ').filter(Boolean);
    if(!a.length||!b.length)return false;
    if(a.join(' ')===b.join(' '))return true;
    const A=new Set(a), B=new Set(b);
    const chico=A.size<=B.size?A:B, grande=A.size<=B.size?B:A;
    if(chico.size<2)return false;
    for(const t of chico){ if(!grande.has(t))return false; }
    return true;
  };
  const matches=(local,fa)=>(_r(fa.rut)&&_r(local.rut)&&_r(local.rut)===_r(fa.rut))||_mismoNombre(local.name,fa.name)
    ||(!!local.nombreOrig&&_mismoNombre(local.nombreOrig,fa.name));   // nombre corregido en vivo

  fbAthletes.forEach((fa,j)=>{
    const existing=DATA.athletes.find(a=>matches(a,fa));
    if(!existing){
      // New athlete — only add if competition not started
      if(DATA.phase==='manage'||DATA.phase==='setup'){
        const newId=DATA.athletes.length?Math.max(...DATA.athletes.map(a=>a.id))+1:0;
        const nuevo={...fa,id:newId,lot:newId+1};
        DATA.athletes.push(nuevo);
        // Con los lotes ya sorteados, el que entra toma el primer lote libre de SU
        // tanda (A→100…, B→200…) en vez de un correlativo suelto que rompe el orden.
        _reubicarLote(nuevo);
        changed=true;
      }
    }else{
      // Update flight if changed in Firestore
      if(fa.flight&&fa.flight!==existing.flight){
        existing.flight=fa.flight;changed=true;
        _reubicarLote(existing);   // el lote lleva la tanda adentro (A→100, B→200…)
      }
      // División, categoría y modalidad vienen del Cronograma (ver _inscToAthlete),
      // que es lo que manda. Sin esto la re-sincronización solo arreglaba la tanda y
      // dejaba, por ejemplo, a los de Olimpiadas Especiales corriendo como Classic.
      // La categoría no se toca si el atleta ya está pesado: ahí manda la balanza.
      if(fa.div&&fa.div!==existing.div){existing.div=fa.div;changed=true;}
      if(fa.cat&&String(fa.cat)!==String(existing.cat)&&!existing.weighedIn&&!(+existing.bw>0)){
        existing.cat=fa.cat;changed=true;
      }
      if(fa.mod&&(fa.mod!==existing.mod||!!fa.plusBench!==!!existing.plusBench)){
        existing.mod=fa.mod;existing.plusBench=fa.plusBench;changed=true;
      }
    }
  });

  // ── DETECCIÓN DE BORRADOS ─────────────────────────────────────
  // Atletas locales que ya no existen en Firestore (admin los eliminó)
  const stale=DATA.athletes.filter(local=>!fbAthletes.some(fa=>matches(local,fa)));
  if(stale.length){
    // Atletas con datos ya cargados (peso, intentos, resultados) — no auto-borrar
    const hasData=a=>a.bw>0||['sq','bp','dl'].some(l=>((a.att==null?void 0:a.att[l])||[]).some(x=>x.w>0||x.r));
    const safeToRemove=stale.filter(a=>!hasData(a));
    const withData=stale.filter(hasData);
    // Borrado automático de los que no tienen datos
    if(safeToRemove.length){
      const ids=new Set(safeToRemove.map(a=>a.id));
      DATA.athletes=DATA.athletes.filter(a=>!ids.has(a.id));
      // Un borrado debe REEMPLAZAR el remoto: el merge conserva los atletas que
      // están en el servidor y no en local, así que sin esto no se propagaría.
      window._forceFullWrite=true;
      changed=true;
      showToastLC(''+safeToRemove.length+' atleta'+(safeToRemove.length>1?'s':'')+' eliminado'+(safeToRemove.length>1?'s':'')+' (borrados desde admin)');
    }
    // Aviso sobre los que tienen datos — el operador decide manualmente
    if(withData.length){
      console.warn('[LC] Atletas con datos pero borrados del admin:',withData.map(a=>a.name));
      showToastLC(''+withData.length+' atleta'+(withData.length>1?'s':'')+' borrado'+(withData.length>1?'s':'')+' del admin pero con datos cargados acá. Revisa Atletas y Pesaje y bórralo'+(withData.length>1?'s':'')+' a mano si corresponde.');
    }
  }
  if(changed){save();R();}
}

async function loadLiveAthletes(ev){
  // Stop previous listener
  if(_liveUnsub){_liveUnsub();_liveUnsub=null;}
  // Find event ID from name
  const evId=Object.keys(LIVE_EVENTS).find(k=>LIVE_EVENTS[k]===ev.name)||null;
  if(!evId){
    console.warn('[LiveCast] No Firestore ID for event:',ev.name);
    return;
  }
  // Flight/jornada asignados en la pestaña Cronograma del admin. Se carga una vez acá
  // y de ahí en más se mantiene al día vía _subscribeCronoFlightMap (onSnapshot) en
  // window._cronoFlightMap — el onSnapshot de acá abajo SIEMPRE lee window._cronoFlightMap
  // (no una copia local vieja), porque si usara una variable capturada en este momento,
  // cualquier cambio posterior en inscripciones (aunque no tenga nada que ver con el
  // Cronograma) volvería a aplicar el mapa viejo y pisaría la tanda ya corregida.
  window._cronoFlightMap=await _loadCronoFlightMap(evId);
  _subscribeCronoFlightMap(evId); // mantiene window._cronoFlightMap al día si el Cronograma se sigue editando

  const q=window._fb.query(
    window._fb.collection(fbDB,'inscripciones'),
    window._fb.where('evento','==',evId),
    window._fb.where('status','in',['approved','pending'])
  );

  _liveUnsub=window._fb.onSnapshot(q,(snap)=>{
    const fbAthletes=snap.docs
      .map(d=>({...d.data(),id:d.id}))
      .sort((a,b)=>(a.lot||9999)-(b.lot||9999))
      .map((ins,j)=>_inscToAthlete(ins,j,window._cronoFlightMap));

    if(!fbAthletes.length)return; // no Firestore data — keep nominas.json data

    if(DATA.phase==='setup'){
      // Full replace: Firestore is source of truth during setup
      DATA.athletes=fbAthletes.map((a,j)=>({...a,id:j,lot:a.lot||j+1}));
      const firstFlight=[...new Set(DATA.athletes.map(a=>a.flight))].filter(_inTarima).sort(_cmpFl)[0]||(TARIMA?'A'+TARIMA:'A');
      DATA.flight=firstFlight;
      save();R();
      showToastLC('Nómina en vivo: '+fbAthletes.length+' atletas desde Firestore');
    }else{
      // During competition: only merge new approvals, don't touch existing
      _mergeFirebaseAthletes(fbAthletes);
    }
  });
}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

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

window.toggleAttMenu=function(id,l,j){
  const key=id+'_'+l+'_'+j;
  window._attMenuOpen=(window._attMenuOpen===key)?null:key;
  R();
};

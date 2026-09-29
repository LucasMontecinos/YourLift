// admin.html — Cargar los datos: data.json, los listeners de Firestore y el importador.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// ═══════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════
async function loadAll(){
  // ¿La nómina del Sudamericano sigue publicada? Mientras lo esté, el panel la
  // ofrece en Nóminas, Tarjetas y Medallero; cuando se despublica, desaparece.
  fetch('nomina_sudamericano.json').then(r=>r.json()).then(j=>{ST.sudaPublicada=j.publicada!==false;if(ST.sudaPublicada&&typeof render==='function')render();}).catch(()=>{});
  // Load data.json — non-blocking, dashboard degrades gracefully if missing
  try{
    const dRes=await fetch('data.json').then(r=>r.json()).catch(()=>[]);
    ST.data=Array.isArray(dRes)?dRes:[];
    PEERS=_peersBuild(ST.data);
    window._HIST_ANIO=null;   // el cruce de participación ya puede usar data.json
    cargarCupoCfg();          // qué campeonatos cuentan (si se eligieron a mano)
  }catch(e){
    console.warn('[loadAll] JSON fetch failed:',e.message);
    ST.data=ST.data||[];
  }

  // Load atletas_pending (debutants who inscribed but aren't in data.json yet)
  try{
    const pendSnap=await getDocs(collection(db,'atletas_pending'));
    const rutNorm=(s)=>String(s||'').replace(/[^0-9kK]/g,'').toUpperCase();
    pendSnap.forEach(d=>{
      const pd=d.data();
      const alreadyIn=(ST.data||[]).find(a=>rutNorm(a.rut)===rutNorm(pd.rut));
      if(!alreadyIn && pd.nombre && pd.codigo){
        ST.data.push({...pd, _isPending:true});
      }
    });
  }catch(e){console.warn('[loadAll] atletas_pending:',e.message);}

  // Ediciones y BAJAS del panel, con el mismo criterio que el sitio (compartido/ediciones.js).
  // El panel tenía su propia copia de esta lógica y se le había quedado sin la
  // parte de las bajas: una ficha repetida se borraba, desaparecía de la pantalla
  // y al recargar el panel volvía a estar. Así se creía haber limpiado
  // duplicados que seguían ahí.
  try{
    const docs=await window.YLEdiciones.cargar(async()=>{
      const snap=await getDocs(collection(db,'athlete_edits'));
      return snap.docs.map(d=>({...d.data(),id:d.id}));
    });
    const r=window.YLEdiciones.aplicar(ST.data,docs);
    if(r.editados||r.borrados)console.log('[edits] '+r.editados+' editados, '+r.borrados+' dados de baja');
  }catch(e){console.warn('[loadAll] athlete_edits:',e.message);}

  // Inscripciones (533 documentos, la consulta más pesada del panel).
  // Lo pobla el listener de más abajo, que en el primer aviso entrega la
  // colección completa y además redibuja. Pedirla acá antes era pagarla dos
  // veces por cada carga del panel.


  // Datos privados de la inscripción (pin, carnet, WADA), solo admin.
  // Lo pobla el listener de más abajo, que en el primer aviso entrega la
  // colección completa y además redibuja. Pedirla acá antes era pagarla dos
  // veces por cada carga del panel.


  // Load atleta_fotos (foto_url por código + status). Lectura pública.
  // - status:'approved' (default si tiene foto_url) → mergea en ST.data para verse
  // - status:'rejected' → no aparece como pendiente, no se muestra
  ST.fotosByCodigo = {};
  ST.fotosByRut = {};
  ST.fotosDesdeCache = false;
  try{
    const fotosSnap=await getDocs(collection(db,'atleta_fotos'));
    // Firestore guarda una copia en el navegador y, si no logra hablar con el
    // servidor, la devuelve SIN avisar: ni error ni nada. La pantalla queda
    // mostrando lo de la última vez, así que una foto ya confirmada vuelve a
    // aparecer como pendiente y uno la confirma de nuevo sobre lo mismo. Pasó
    // el 1 y el 2 de septiembre con ocho atletas. Si vino de la copia, se dice.
    ST.fotosDesdeCache = !!fotosSnap.metadata?.fromCache;
    fotosSnap.forEach(d=>{
      const data=d.data();
      const codigo=data.codigo||d.id;
      ST.fotosByCodigo[codigo] = data;
      // Y también por RUT. El código cambia —se calcula con RUT, iniciales y año
      // de debut—, así que buscar la foto por código solo es una apuesta: si no
      // acierta, el panel cree que nunca se decidió nada sobre ese atleta y lo
      // devuelve a la lista de pendientes aunque su foto esté publicada.
      const rf=String(data.rut||'').replace(/[^0-9kK]/gi,'').toLowerCase();
      if(rf) ST.fotosByRut[rf] = data;
      // Por RUT primero: el código cambia cuando se corrige un nombre o un RUT, y
      // la foto quedaba colgando del viejo sin que la encontrara nadie.
      const ath=window.YLEdiciones.buscarAtleta(ST.data,Object.assign({id:d.id},data));
      // 'rejected' habla de la foto que se rechazó, no de la que está publicada.
      // Si al atleta ya se le había aprobado una y después se le rechaza la que
      // mandó al inscribirse, el doc queda con la foto vieja Y con status
      // 'rejected': el sitio público la seguía mostrando y el panel la escondía,
      // así que el atleta figuraba sin foto y volvía a la lista de pendientes
      // aunque su foto estuviera publicada. Solo se esconde si lo rechazado es
      // justamente lo que el doc tiene publicado.
      const rechazadaLaPublicada = data.status==='rejected' && (!data.foto_url || data.foto_url===data.rejected_url);
      if(ath && data.foto_url && !rechazadaLaPublicada) ath.foto_url = data.foto_url;
      // Y se deja anotada bajo el código VIGENTE del atleta, para que el panel la
      // muestre como cargada y no ofrezca subirla de nuevo.
      if(ath && ath.codigo && ath.codigo!==codigo) ST.fotosByCodigo[ath.codigo] = data;
    });
  }catch(e){console.warn('[loadAll] atleta_fotos:',e.message);}

  // Load atleta_achievements (logros/medallas). Un doc por atleta (ID = codigo).
  ST.achievementsByCodigo = {};
  try{
    const achSnap=await getDocs(collection(db,'atleta_achievements'));
    achSnap.forEach(d=>{
      const data=d.data();
      const codigo=data.codigo||d.id;
      ST.achievementsByCodigo[codigo]=data.achievements||[];
      const ath=(ST.data||[]).find(a=>a.codigo===codigo);
      if(ath) ath.achievements=data.achievements||[];
    });
  }catch(e){console.warn('[loadAll] atleta_achievements:',e.message);}

  // Solicitudes de edición de los atletas.
  // Lo pobla el listener de más abajo, que en el primer aviso entrega la
  // colección completa y además redibuja. Pedirla acá antes era pagarla dos
  // veces por cada carga del panel.


  // Real-time listeners (non-blocking, set up once)
  if(!window._inscListener){
    try{
      window._inscListener=onSnapshot(collection(db,'inscripciones'),(snap)=>{
        ST.inscripciones=snap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.timestamp?.seconds||0)-(a.timestamp?.seconds||0));
        // El índice de participación del año usa las inscripciones vigentes, así
        // que se rehace cuando cambian: si no, aprobar o rechazar una no movía
        // la columna hasta recargar la página.
        window._HIST_ANIO=null;
        if(ST.view==='nominas'||ST.view==='dashboard'||ST.view==='approvals'||ST.view==='athletes'||ST.view==='stats')render();
      },(e)=>console.warn('[listener] inscripciones:',e.message));
    }catch(e){console.warn('[loadAll] insc listener:',e.message);}
  }
  if(!window._privListener){
    try{
      window._privListener=onSnapshot(collection(db,'inscripciones_private'),(snap)=>{
        ST.inscripcionesPrivate={};
        snap.forEach(d=>{ST.inscripcionesPrivate[d.id]=d.data();});
      },(e)=>console.warn('[listener] inscripciones_private:',e.message));
    }catch(e){console.warn('[loadAll] priv listener:',e.message);}
  }
  if(!window._editReqListener){
    try{
      window._editReqListener=onSnapshot(collection(db,'edit_requests'),(snap)=>{
        ST.editRequests=snap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.ts?.seconds||0)-(a.ts?.seconds||0));
        if(ST.view==='editRequests'||ST.view==='dashboard')render();
      },(e)=>console.warn('[listener] edit_requests:',e.message));
    }catch(e){console.warn('[loadAll] edit_req listener:',e.message);}
  }
  if(!window._entListener){
    try{
      window._entListener=onSnapshot(collection(db,'entrenadores'),(snap)=>{
        ST.entrenadores=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
        if(ST.view==='entrenadoresDB')render();
      },(e)=>console.warn('[listener] entrenadores:',e.message));
    }catch(e){console.warn('[loadAll] ent listener:',e.message);}
  }
  // Los FORMULARIOS de entrenador. No cuelgan de un campeonato a propósito: el
  // mismo mecanismo sirve para la inscripción a un campeonato y para una
  // convocatoria de acreditación, que no tiene campeonato ninguno.
  if(!window._formEntListener){
    try{
      window._formEntListener=onSnapshot(collection(db,'formularios_entrenador'),(snap)=>{
        ST.formEnt=snap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>String(b.updatedAtISO||'').localeCompare(String(a.updatedAtISO||'')));
        if(ST.view==='formEnt'||ST.view==='entInsc')render();
      },(e)=>console.warn('[listener] formularios_entrenador:',e.message));
    }catch(e){console.warn('[loadAll] formEnt listener:',e.message);}
  }
  // Inscripciones de ENTRENADORES. Van en su propia colección porque son otro
  // período y otra ficha: el entrenador no compite, declara a qué atletas lleva.
  if(!window._entInscListener){
    try{
      window._entInscListener=onSnapshot(collection(db,'inscripciones_entrenador'),(snap)=>{
        ST.entInsc=snap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
        if(ST.view==='entInsc')render();
      },(e)=>console.warn('[listener] inscripciones_entrenador:',e.message));
      window._entInscPrivListener=onSnapshot(collection(db,'inscripciones_entrenador_priv'),(snap)=>{
        ST.entInscPriv={}; snap.docs.forEach(d=>{ ST.entInscPriv[d.id]=d.data(); });
        if(ST.view==='entInsc')render();
      },(e)=>console.warn('[listener] inscripciones_entrenador_priv:',e.message));
    }catch(e){console.warn('[loadAll] entInsc listener:',e.message);}
  }
  if(!window._allCompResListener){
    try{
      window._allCompResListener=onSnapshot(collection(db,'competition_results'),(snap)=>{
        // Sin los resultados de eventos de prueba (ensayo), por si alguno se publicó.
        ST.allCompResults=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!(/ensayo/i.test(String(x.evento_id||''))||/ensayo/i.test(String(x.id||''))||/^\s*ensayo\b/i.test(String(x.evento||''))));
        window._HIST_ANIO=null;   // el índice del año se rehace con los datos nuevos
        // Estadísticas también: la pestaña de afiliaciones se arma con estos
        // resultados, y sin esto quedaba mostrando solo lo de data.json hasta
        // que alguien cambiara de pantalla y volviera.
        if(ST.view==='athleteProfile'||ST.view==='approvals'||ST.view==='nominas'||ST.view==='rankingCiclo'||ST.view==='stats')render();
      },(e)=>console.warn('[listener] competition_results:',e.message));
    }catch(e){console.warn('[loadAll] allCompRes listener:',e.message);}
  }
  if(!window._clubsListener){
    try{
      window._clubsListener=onSnapshot(collection(db,'clubs'),(snap)=>{
        ST.clubs=snap.docs.map(d=>({id:d.id,...d.data()}));
        window._CLUBS_FS={};
        ST.clubs.forEach(c=>{if(c.slug&&c.logoUrl)window._CLUBS_FS[c.slug]=c;});
        if(ST.view==='clubs')render();
      },(e)=>console.warn('[listener] clubs:',e.message));
    }catch(e){console.warn('[loadAll] clubs listener:',e.message);}
  }
  if(!window._eventosListener){
    try{
      window._eventosListener=onSnapshot(collection(db,'eventos'),(snap)=>{
        ST.eventos=snap.docs.map(d=>{
          const e={...d.data(),id:d.id};
          // Default: récords activos. En "Universitario" arrancan apagados.
          if(typeof e.recordsEnabled!=='boolean'){
            e.recordsEnabled=!/universitar/i.test(e.name||'');
          }
          return e;
        }).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
        // Tarjetas de Nóminas arma su lista con ST.eventos, así que también se
        // redibuja: si no, un campeonato recién publicado no aparece hasta recargar.
        if(ST.view==='campeonatos'||ST.view==='dashboard'||ST.view==='athletes'||ST.view==='nomcards')render();
      },(e)=>console.warn('[listener] eventos:',e.message));
    }catch(e){console.warn('[loadAll] eventos listener:',e.message);}
  }
  // El corte del ranking. Es un solo documento y se escucha para que, si otra
  // persona lo abre o lo quita, el panel lo muestre sin recargar.
  if(!window._cicloListener){
    try{
      window._cicloListener=onSnapshot(doc(db,'ranking_config','ciclo'),(s)=>{
        ST.rankingCiclo=s.exists()?s.data():null;
        render();
      },(e)=>console.warn('[listener] ranking_config:',e.message));
    }catch(e){console.warn('[loadAll] ciclo listener:',e.message);}
  }
  // Actas de competencias pasadas (para saber cuáles ya tienen documento subido).
  if(!window._pasadasListener){
    try{
      window._pasadasListener=onSnapshot(collection(db,'competencias_pasadas'),(snap)=>{
        const m={}; snap.docs.forEach(d=>{ m[d.id]={...d.data(),id:d.id}; });
        ST.pasadas=m;
        if(ST.view==='pasadas')render();
      },(e)=>console.warn('[listener] competencias_pasadas:',e.message));
    }catch(e){console.warn('[loadAll] pasadas listener:',e.message);}
  }
  if(!window._resultsListener){
    try{
      window._resultsListener=onSnapshot(
        query(collection(db,'competition_results'),where('status','==','pending_merge')),
        (snap)=>{
          ST.pendingResults=snap.size;
          ST.competitionResults=snap.docs.map(d=>({id:d.id,...d.data()}));
          if(ST.pendingResults>0||ST.view==='mergeResults')render();
        },(e)=>console.warn('[listener] results:',e.message)
      );
    }catch(e){console.warn('[loadAll] results listener:',e.message);}
  }

  // Los eventos también los pobla su listener. Acá además se pagaban dos veces
  // para dejar una versión PEOR: esta copia no ponía el valor por defecto de
  // recordsEnabled, así que entre esta lectura y el primer aviso del listener
  // los récords quedaban indefinidos.

  // Audit log — las últimas 100, ordenadas por el SERVIDOR.
  //
  // Antes se traía la colección entera y se cortaba en cien acá. El log crece
  // para siempre —un documento por cada acción de admin— así que la cuenta la
  // pagaba completa cada vez que alguien abría el panel, para mostrar cien
  // líneas. Era, de lejos, la lectura más cara del sitio.
  //
  // El comentario que estaba acá decía que no se ordenaba para no tener que
  // crear un índice. Eso vale para los índices COMPUESTOS: ordenar por un solo
  // campo no necesita crear nada, Firestore lo tiene solo.
  try{
    const logSnap=await getDocs(query(collection(db,'audit_log'),orderBy('ts','desc'),limit(100)));
    ST.auditLog=logSnap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){console.warn('[loadAll] audit_log:',e.message);ST.auditLog=[];}

  // Auto-close overdue nominations (non-blocking)
  setTimeout(()=>{try{autoCloseOverdueEventos();}catch(e){}},3000);

  // Render ahora que tenemos datos
  render();
}

function renderImportar(){
  const evs = (ST.eventos||[]).filter(e=>e.status!=='archived');
  let h = '<div class="h1">Importar desde LiftingCast</div>';
  h += '<p class="subtitle">Sube el CSV exportado desde LiftingCast (Meet Director → Export). Detecta automáticamente columnas comunes (Lifter, Team, Division, BWClass, Squat1Kg, Bench1Kg, Deadlift1Kg, etc.) y crea inscripciones aprobadas en el campeonato que elijas.</p>';

  // Step 1: evento destino
  h += '<div class="card" style="margin-bottom:14px"><div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;align-items:center">';
  h += '<div><div style="font-family:Oswald;font-size:11px;color:var(--gold);letter-spacing:2px">1 · CAMPEONATO DESTINO</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Las inscripciones se asocian a este evento.</div></div>';
  h += '<select class="inp" onchange="impSelectEvento(this)"><option value="">-- elige un campeonato --</option>';
  evs.forEach(e=>{ h += '<option value="'+esc(e.name)+'" '+(e.name===_impState.evento?'selected':'')+'>'+esc(e.name)+'</option>'; });
  h += '</select></div></div>';

  // Step 2: cargar CSV
  h += '<div class="card" style="margin-bottom:14px"><div style="margin-bottom:10px"><span style="font-family:Oswald;font-size:11px;color:var(--gold);letter-spacing:2px">2 · CARGAR CSV</span></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  h += '<div><label style="font-size:11px;color:var(--muted);margin-bottom:5px;display:block">Subir archivo (.csv)</label><input type="file" accept=".csv,text/csv" onchange="impLoadFile(this)" style="font-size:12px"></div>';
  h += '<div><label style="font-size:11px;color:var(--muted);margin-bottom:5px;display:block">…o pegar acá</label><textarea oninput="impLoadPaste(this)" placeholder="Lifter,Sex,Team,BWClass,Division,Squat1Kg,...\nJohn Doe,M,My Club,83,Open,180,..." style="width:100%;min-height:100px;font-family:monospace;font-size:11px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text)"></textarea></div>';
  h += '</div></div>';

  // Step 3: preview
  if(_impState.parsed){
    const items = _impState.parsed.items;
    const m = _impState.parsed.mapping;
    const headers = _impState.parsed.parsed.headers;
    const mappedCount = Object.values(m).filter(v=>v>=0).length;
    const totalFields = Object.keys(m).length;
    h += '<div class="card" style="margin-bottom:14px"><div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
    h += '<span style="font-family:Oswald;font-size:11px;color:var(--gold);letter-spacing:2px">3 · PREVIEW</span>';
    h += '<span style="font-size:11px;color:var(--muted)">'+items.length+' atletas detectados · '+mappedCount+'/'+totalFields+' columnas mapeadas · '+headers.length+' columnas en CSV</span></div>';
    if(!items.length){
      h += '<div style="padding:18px;text-align:center;color:var(--red);font-size:12px">No se detectó ninguna fila válida. Revisa que la primera línea del CSV sean los encabezados (Lifter, Team, etc.) y que cada atleta tenga al menos el nombre.</div>';
    } else {
      h += '<div style="overflow-x:auto;max-height:380px;overflow-y:auto"><table class="tbl" style="font-size:10px">';
      h += '<tr><th>#</th><th>Nombre</th><th>Sexo</th><th>Categoría</th><th>División</th><th>Mod.</th><th>Club</th><th>Vuelo</th><th>Lot</th><th>BW</th><th>SQ1·2·3</th><th>BP1·2·3</th><th>DL1·2·3</th></tr>';
      items.slice(0,30).forEach((a,i)=>{
        const att = (l)=> a.att[l].map(x=>x.w||'—').join(' · ');
        h += '<tr><td>'+(i+1)+'</td><td>'+esc(a.nombre)+'</td><td>'+esc(a.sexo||'?')+'</td><td>'+esc(a.categoria||'?')+'</td><td>'+esc(a.division||'?')+'</td><td>'+(a.modalidad==='Powerlifting Equipped'?'EQ':'CL')+'</td><td>'+esc(a.club)+'</td><td>'+esc(a.flight)+'</td><td>'+(a.lot||'—')+'</td><td>'+(a.bw||'—')+'</td><td>'+att('sq')+'</td><td>'+att('bp')+'</td><td>'+att('dl')+'</td></tr>';
      });
      h += '</table></div>';
      if(items.length>30) h += '<div style="font-size:10px;color:var(--muted);margin-top:6px;text-align:right">…mostrando primeros 30 de '+items.length+'</div>';
      // Diagnóstico de campos no mapeados
      const missing = Object.entries(m).filter(([k,v])=>v<0).map(([k])=>k);
      if(missing.length){
        h += '<div style="margin-top:12px;padding:10px 12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:6px;font-size:11px;color:var(--muted)">Columnas no encontradas: <code>'+missing.join(', ')+'</code>. Esos campos quedan vacíos. Si el CSV las tiene con otro nombre, renombra los encabezados a mano o avísame y le agrego el alias.</div>';
      }
    }
    h += '</div>';
  }

  // Step 4: import
  if(_impState.parsed && _impState.parsed.items.length){
    h += '<div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">';
    h += '<div style="font-size:12px;color:var(--muted)">'+(_impState.evento?'Listo para importar a <b style="color:var(--gold)">'+esc(_impState.evento)+'</b>':'Falta elegir el campeonato destino arriba')+'</div>';
    h += '<button class="btn btn-g" onclick="impDoImport(this)" '+(!_impState.evento?'disabled style="opacity:.4;cursor:not-allowed"':'')+'>Importar a Firestore</button>';
    h += '</div>';
  }

  h += '<div class="card" style="margin-top:14px;padding:12px 16px;background:rgba(29,49,80,.3);font-size:11px;color:var(--muted);line-height:1.7">';
  h += '<div style="color:var(--text);font-weight:600;margin-bottom:6px">Cómo exportar desde LiftingCast</div>';
  h += '1. Ingresa a tu meet en liftingcast.com como Meet Director.<br>';
  h += '2. Settings () → Export → "Roster CSV" o "Full Export".<br>';
  h += '3. Descarga el .csv y súbelo acá.<br><br>';
  h += '<div style="color:var(--text);font-weight:600;margin-bottom:6px">Columnas que reconoce</div>';
  h += '• Identidad: <code>Lifter, Team, Sex, Age, MemberID</code><br>';
  h += '• Categoría: <code>BWClass, Division, Equipment</code><br>';
  h += '• Logística: <code>Flight/Session, Lot, BW</code><br>';
  h += '• Intentos: <code>Squat1Kg/2Kg/3Kg, Bench1Kg/2Kg/3Kg, Deadlift1Kg/2Kg/3Kg</code><br>';
  h += '</div>';

  return h;
}

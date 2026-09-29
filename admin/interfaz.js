// admin.html — El panel en sí: el dibujo de cada vista (render), el menú, los avisos con deshacer, el editor universal y el registro de auditoría.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// ═══════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════
async function logAction(action,target,oldValue,newValue,extra={}){
  try{
    await addDoc(collection(db,'audit_log'),{
      user:ST.user.email,
      uid:ST.user.uid,
      action,target,
      oldValue:oldValue==null?null:String(oldValue).substring(0,200),
      newValue:newValue==null?null:String(newValue).substring(0,200),
      ts:Date.now(),
      ...extra
    });
  }catch(e){console.warn('Audit log failed',e)}
}

function showToast(msg,undoFn=null,isError=false){
  if(toastTimer)clearTimeout(toastTimer);
  document.getElementById('toast')?.remove();
  const t=document.createElement('div');
  t.id='toast';t.className='toast'+(isError?' err':'');
  t.innerHTML=`<span>${isError?'':'<i class=yl-i-check></i>'} ${msg}</span>`;
  if(undoFn){
    pendingUndo=undoFn;
    const b=document.createElement('button');b.textContent='DESHACER';b.onclick=()=>{pendingUndo();document.getElementById('toast')?.remove();pendingUndo=null};
    t.appendChild(b);
  }
  document.body.appendChild(t);
  toastTimer=setTimeout(()=>{t.remove();pendingUndo=null},5500);
}

window.showToast=showToast;

window.openEditModal=function(title,field,currentValue,onSave){
  const opts=FIELD_OPTS[field];
  const m=document.createElement('div');m.className='modal';
  let inner=`<div class="modal-c"><h3>${title}</h3><div class="field"><label>${field}</label>`;
  if(field==='club'){
    const allClubs=[...new Set((ST.data||[]).map(a=>a.club).filter(Boolean))].sort();
    inner+=`<input type="text" id="emInp" list="emClubList" value="${(currentValue||'').replace(/"/g,'&quot;')}" placeholder="Escribe o selecciona un club" autocomplete="off" style="width:100%">
    <datalist id="emClubList">${allClubs.map(c=>`<option value="${c.replace(/"/g,'&quot;')}">`).join('')}</datalist>`;
  } else if(opts){
    inner+=`<select id="emInp">${opts.map(o=>`<option value="${o}" ${o===currentValue?'selected':''}>${o}</option>`).join('')}</select>`;
  }else{
    inner+=`<input type="text" id="emInp" value="${(currentValue||'').replace(/"/g,'&quot;')}">`;
  }
  inner+=`</div><div class="modal-btns"><button class="btn btn-d" onclick="this.closest('.modal').remove()">CANCELAR</button><button class="btn btn-p" id="emSave">GUARDAR</button></div></div>`;
  m.innerHTML=inner;
  document.body.appendChild(m);
  setTimeout(()=>document.getElementById('emInp').focus(),50);
  document.getElementById('emSave').onclick=async()=>{
    const v=document.getElementById('emInp').value;
    if(v===currentValue){m.remove();return}
    m.remove();
    await onSave(v);
  };
  m.onclick=(e)=>{if(e.target===m)m.remove()};
}

window.editInsc=async function(insId,field){
  const ins=ST.inscripciones.find(x=>x.id===insId);if(!ins)return;
  const cur=ins[field]||'';
  openEditModal(`Editar ${field} de ${ins.nombre}`,field,cur,async(nv)=>{
    if(nv===cur)return;
    const old=cur;
    try{
      await updateDoc(doc(db,'inscripciones',insId),{[field]:nv});
      await logAction('edit_inscripcion',`${insId}.${field}`,old,nv,{nombre:ins.nombre});
      ins[field]=nv;
      // Corregir el club en la nómina lo corrige también en su ficha, que es lo
      // que ve la gente y lo que propone la próxima inscripción.
      const sync=(field==='club'||field==='clubOtro')?await _clubAlPadron(ins):null;
      showToast(`${field} actualizado: ${ins.nombre}`+(sync?' · y su ficha también':''),async()=>{
        await updateDoc(doc(db,'inscripciones',insId),{[field]:old});
        ins[field]=old;
        await _clubAlPadronRevertir(sync);
        await logAction('undo_edit_inscripcion',`${insId}.${field}`,nv,old,{nombre:ins.nombre});
        showToast('Cambio revertido');
      });
    }catch(e){console.error(e);showToast('Error: '+e.message,null,true)}
  });
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
window.admNav=function(open){document.body.classList.toggle('nav-open',!!open);};

function renderStreamingShell(){
  const cfg=_SHELL_ROL[ST.adminInfo?.role]||_SHELL_ROL.streaming;
  const nombre=ST.adminInfo?.name||ST.adminInfo?.nombre||ST.user.email;
  const logo=`<img src="YourLift_logo.png" style="height:24px" onerror="this.outerHTML='<span style=color:var(--accent)>YOUR</span>LIFT'">`;
  return `<div class="shell"><div class="nav-backdrop" onclick="admNav(false)"></div>
    <div class="side">
      <div class="logo">${logo} ADMIN</div>
      <div class="user">${nombre}<br><span style="opacity:.7;font-size:9px">${cfg.rol}</span></div>
      <div class="side-label">Sistema</div>
      <a href="livecast.html?operar=1" target="_blank" class="side-btn" style="text-decoration:none" title="Abre el livecast para transmitir">YourLift <span style="opacity:.55;font-size:11px">(LiftingCast)</span></a>
      <div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--border)">
        <a href="index.html" class="side-btn" style="text-decoration:none"><span class="icon">←</span>Volver al sitio</a>
        <button class="side-btn" onclick="doLogout()" style="color:var(--red)">Cerrar sesión</button>
      </div>
    </div>
    <div class="corner-stack"><img src="YourLift_logo.png" alt="YourLift" class="corner-logo" onclick="location.href='index.html'" title="Volver al sitio" onerror="this.style.display='none'"></div><div class="main"><button class="adm-burger" onclick="admNav(true)"><i class=yl-i-menu></i> Menú</button>
      <div class="h1">${cfg.titulo}</div>
      <p class="subtitle">${cfg.bajada}</p>
      <div class="card" style="max-width:560px">
        <div class="h2">YourLift (LiftingCast)</div>
        <p style="color:var(--muted);font-size:13px;line-height:1.6;margin:6px 0 14px">
          ${cfg.dentro}
        </p>
        <a href="livecast.html?operar=1" target="_blank" class="btn btn-g" style="text-decoration:none;display:inline-block;padding:10px 18px">Abrir YourLift</a>
      </div>
    </div></div>`;
}

window.go=function(view){ST.view=view;document.body.classList.remove('nav-open');if(view==='admins')loadAdminsList().then(()=>render());else render();}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════
function render(){
  const app=document.getElementById('app');
  if(!ST.user){
    app.innerHTML=`
      <div class="login"><div class="login-c">
        <h1><img src="YourLift_logo.png" style="height:24px" onerror="this.outerHTML='<span style=color:var(--accent)>YOUR</span>LIFT'"> ADMIN</h1>
        <p>Panel de administración</p>
        <div class="field"><label>Email</label><input type="email" id="lEm" placeholder="admin@ejemplo.cl" onkeydown="if(event.key==='Enter')document.getElementById('lPw').focus()"></div>
        <div class="field"><label>Contraseña</label><input type="password" id="lPw" placeholder="••••••" onkeydown="if(event.key==='Enter')doLogin()"></div>
        <div id="loginErr" style="color:#ef4444;font-size:12px;text-align:center;margin-bottom:8px;display:none"></div>
        <button class="btn btn-p" style="width:100%;padding:12px" onclick="
          if(typeof window.doLogin==='function'){doLogin();}
          else{document.getElementById('loginErr').style.display='block';document.getElementById('loginErr').textContent='El módulo no cargó. Haz Ctrl+Shift+R para recargar sin caché.';}
        ">INGRESAR</button>
        <p style="margin-top:18px;font-size:11px"><a href="index.html" style="color:var(--muted);text-decoration:none">← Volver al sitio</a></p>
      </div></div>`;
    return;
  }
  // La cuenta de streaming no espera la base de datos: no la usa.
  if(ST.adminInfo?.role==='streaming'||ST.adminInfo?.role==='mesa'){ app.innerHTML=renderStreamingShell(); return; }
  if(!ST.data){
    app.innerHTML='<div class="login"><div class="login-c"><div class="spinner"></div><p style="text-align:center;margin-top:12px">Cargando datos...</p></div></div>';
    return;
  }

  const sidebar=`
    <div class="side">
      <div class="logo"><img src="YourLift_logo.png" style="height:24px" onerror="this.outerHTML='<span style=color:var(--accent)>YOUR</span>LIFT'"> ADMIN</div>
      ${(()=>{
        const isOwner=ST.adminInfo?.role==='owner';
        const nameHtml=(ST.adminInfo?.name||ST.user.email)+(isOwner
          ?` <img src="YourLift_logo.png" style="height:13px;object-fit:contain;vertical-align:middle;margin-left:4px;filter:drop-shadow(0 0 4px rgba(196,30,58,.9)) brightness(1.2)" title="YourLift Owner" onerror="this.outerHTML='<span style=color:var(--accent);font-family:Oswald;font-size:10px;margin-left:3px>YL</span>'">`
          :'');
        const roleHtml=isOwner
          ?`<span style="font-size:9px;font-family:Oswald;letter-spacing:1px;background:linear-gradient(90deg,#C41E3A,#D4A843);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700"><i class=yl-i-estrella></i> OWNER · YOURLIFT</span>`
          :`<span style="opacity:.7;font-size:9px">${ST.adminInfo?.role||'admin'}</span>`;
        const borderStyle=isOwner?'border:1px solid rgba(196,30,58,.45);background:linear-gradient(135deg,rgba(196,30,58,.08),rgba(212,168,67,.08))':'';
        return `<div class="user" style="${borderStyle}">${nameHtml}<br>${roleHtml}</div>`;
      })()}
      <div class="side-label">Datos</div>
      <button class="side-btn ${ST.view==='athletes'?'active':''}" onclick="go('athletes')">Atletas (DB)</button>
      <button class="side-btn ${ST.view==='nominas'?'active':''}" onclick="go('nominas')">Nóminas</button>
      <button class="side-btn ${ST.view==='medallero'?'active':''}" onclick="go('medallero')">Medallero</button>
      ${_statsPuede()?`<button class="side-btn ${ST.view==='stats'?'active':''}" onclick="go('stats')">Estadísticas</button>`:''}
      ${(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap)?`<button class="side-btn ${ST.view==='publisher'?'active':''}" onclick="go('publisher')">Editor publicaciones</button>`:''}
      ${(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap)?`<button class="side-btn ${ST.view==='sponsors'?'active':''}" onclick="go('sponsors')">Auspiciadores</button>`:''}
      <button class="side-btn ${ST.view==='approvals'?'active':''}" onclick="go('approvals')">Revisión inscripciones</button>
      <button class="side-btn ${ST.view==='editRequests'?'active':''}" onclick="go('editRequests')">Solicitudes edit${ST.editRequests.length?` <span style="background:var(--accent);color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">${ST.editRequests.length}</span>`:''}</button>
      <button class="side-btn ${ST.view==='entrenadoresDB'?'active':''}" onclick="go('entrenadoresDB')">Base Entrenadores</button>
      <button class="side-btn ${ST.view==='formEnt'?'active':''}" onclick="go('formEnt')">Formularios Entrenadores</button>
      <button class="side-btn ${ST.view==='entInsc'?'active':''}" onclick="go('entInsc')">Inscripción Entrenadores${(()=>{const n=(ST.entInsc||[]).filter(x=>x.status==='pending').length;return n?` <span style="background:var(--gold);color:#000;border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">${n}</span>`:'';})()}</button>
      <button class="side-btn ${ST.view==='referees'?'active':''}" onclick="go('referees')">Jueces</button>
      <button class="side-btn ${ST.view==='clubs'?'active':''}" onclick="go('clubs')">Clubes</button>
      <button class="side-btn ${ST.view==='fotos'?'active':''}" onclick="go('fotos')">Fotos Atletas</button>
      <button class="side-btn ${ST.view==='records'?'active':''}" onclick="go('records')">Récords</button>
      <button class="side-btn ${ST.view==='cronograma'?'active':''}" onclick="go('cronograma')">Cronograma</button>
      <div class="side-label">Sistema</div>
      <!-- Abre el selector de campeonatos con la lista de trabajo: lo publicado
           para el público más los ensayos de prueba. Es la única puerta a los
           ensayos — en la lista del público no aparecen. -->
      <a href="livecast.html?operar=1" target="_blank" class="side-btn" style="text-decoration:none" title="Abre el livecast: campeonatos publicados y los de prueba">YourLift <span style="opacity:.55;font-size:11px">(LiftingCast)</span></a>
      <button class="side-btn ${ST.view==='campeonatos'?'active':''}" onclick="go('campeonatos')">Campeonatos</button>
      <button class="side-btn ${ST.view==='publico'?'active':''}" onclick="go('publico')">YourLift Público</button>
      ${(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap)?`<button class="side-btn ${ST.view==='nomcards'?'active':''}" onclick="go('nomcards')">Tarjetas de Nóminas</button>`:''}
      <button class="side-btn ${ST.view==='pasadas'?'active':''}" onclick="go('pasadas')">Competencias pasadas</button>
      ${_puedeCiclo()?`<button class="side-btn ${ST.view==='rankingCiclo'?'active':''}" onclick="go('rankingCiclo')">Reinicio ranking${ST.rankingCiclo?.desde?` <span style="background:var(--gold);color:#000;border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">activo</span>`:''}</button>`:''}
      <button class="side-btn ${ST.view==='exports'?'active':''}" onclick="go('exports')">Exports</button>
      <button class="side-btn ${ST.view==='audit'?'active':''}" onclick="go('audit')">Audit Log</button>
      ${ST.pendingResults?`<button class="side-btn ${ST.view==='mergeResults'?'active':''}" onclick="go('mergeResults')" style="border-color:var(--green);color:var(--green)">Resultados Pendientes <span style="background:var(--green);color:#000;border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">${ST.pendingResults}</span></button>`:''}
      ${(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap)?`<button class="side-btn ${ST.view==='certificados'?'active':''}" onclick="go('certificados')">Certificados YourLift</button>`:''}
      ${(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap)?`<button class="side-btn ${ST.view==='admins'?'active':''}" onclick="go('admins')">Gestión Admin</button>`:''}
      <div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--border)">
        <a href="index.html" class="side-btn" style="text-decoration:none"><span class="icon">←</span>Volver al sitio</a>
        <button class="side-btn" onclick="doLogout()" style="color:var(--red)">Cerrar sesión</button>
      </div>
    </div>`;
  
  let content='';
  if(ST.view==='athletes')content=renderAthletes();
  else if(ST.view==='nominas')content=renderNominas();
  else if(ST.view==='medallero')content=renderMedallero();
  else if(ST.view==='nomcards')content=renderNomCards();
  // El botón se dibujaba con _statsPuede() pero acá se exigía owner, así que a
  // la comisión técnica le aparecía Estadísticas y al apretarlo la devolvía a
  // Atletas. Las dos puertas tienen que preguntar lo mismo; qué pestañas ve
  // cada uno lo sigue decidiendo renderStats().
  else if(ST.view==='stats'){if(_statsPuede())content=renderStats();else go('athletes');}
  else if(ST.view==='sponsors'){if(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap)content=renderSponsors();else go('athletes');}
  else if(ST.view==='publisher'){if(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap)content=renderPublisher();else go('athletes');}
  else if(ST.view==='approvals')content=renderApprovals();
  else if(ST.view==='editRequests')content=renderEditRequests();
  else if(ST.view==='entrenadores')content=renderEntrenadores();
  else if(ST.view==='entrenadoresDB')content=renderEntrenadoresDB();
  else if(ST.view==='formEnt'){content=renderFormEnt(); if(ST.feForm)setTimeout(()=>{try{efDocPinta('e')}catch(e){}},0);}
  else if(ST.view==='entInsc')content=renderEntInsc();
  else if(ST.view==='referees'){if(!ST.adminInfo||_ROLES_SIN_PANEL.includes(ST.adminInfo?.role))go('athletes');else content=renderReferees();}
  else if(ST.view==='clubs')content=renderClubs();
  else if(ST.view==='fotos')content=renderFotos();
  // Fotos Sudamericano ya no está en el menú: se sacó a pedido. La pantalla se
  // deja porque sirve para subir en lote —convierte a WebP en el navegador y las
  // empareja con la nómina por el nombre del archivo— y reponer el botón es una
  // línea. Mientras tanto se llega poniendo ST.view='sudaFotos' en la consola.
  else if(ST.view==='sudaFotos')content=renderSudaFotos();
  else if(ST.view==='records')content=renderRecordsEditor();
  else if(ST.view==='importar')content=renderImportar();
  else if(ST.view==='cronograma')content=renderCronoEditor();
  else if(ST.view==='campeonatos')content=renderCampeonatos();
  else if(ST.view==='publico')content=renderPublico();
  else if(ST.view==='pasadas')content=renderCompetenciasPasadas();
  else if(ST.view==='rankingCiclo'){if(_puedeCiclo())content=renderRankingCiclo();else go('athletes');}
  else if(ST.view==='exports')content=renderExports();
  else if(ST.view==='audit')content=renderAudit();
  else if(ST.view==='certificados'){if(_esOwnerAdm())content=renderCertificados();else go('athletes');}
  else if(ST.view==='admins'){if(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap)content=renderAdmins();else go('athletes');}
  else if(ST.view==='mergeResults')content=renderMergeResults();
  else if(ST.view==='athleteProfile')content=renderAthleteProfile();
  
  app.innerHTML=`<div class="shell"><div class="nav-backdrop" onclick="admNav(false)"></div>${sidebar}<div class="corner-stack"><img src="YourLift_logo.png" alt="YourLift" class="corner-logo" onclick="location.href='index.html'" title="Volver al sitio" onerror="this.style.display='none'"></div><div class="main"><button class="adm-burger" onclick="admNav(true)"><i class=yl-i-menu></i> Menú</button>${content}</div></div>`;
  if(ST.view==='sponsors'&&!ST._sponsorsLoaded)setTimeout(loadSponsors,0);
  if(ST.view==='stats'){
    const _st=ST.statsTab||'deporte';
    if(_st==='web') setTimeout(loadWebAnalytics,0);
    else if(_st==='demografia') setTimeout(initDemoCharts,0);
    else if(_st==='corte') {}   // es una tabla, no tiene gráficos que montar
    // Deporte lleva los GL points adentro, así que monta los dos juegos.
    else setTimeout(()=>{initStatsCharts();initGLCharts();},0);
  }
  if(ST.view==='publisher')setTimeout(()=>{try{pubUpdatePreview()}catch(e){}},50);
  if(ST.view==='publisher')setTimeout(pubUpdatePreview,0);
}

function escapeHtml(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function escapeJsAttr(s){return (s||'').replace(/['"\\]/g,'\\$&')}

// Pide un archivo .json del computador y lo devuelve ya leído (null si se
// cancela). Para los importadores: las bases con datos personales no se
// publican en el sitio, así que no se pueden bajar de ahí.
function _pedirArchivoJSON(){
  return new Promise((ok,mal)=>{
    const i=document.createElement('input'); i.type='file'; i.accept='.json,application/json';
    i.onchange=()=>{ const f=i.files&&i.files[0]; if(!f)return ok(null);
      const r=new FileReader(); r.onload=()=>{ try{ok(JSON.parse(r.result));}catch(e){mal(e);} };
      r.onerror=()=>mal(r.error); r.readAsText(f); };
    i.click();
  });
}

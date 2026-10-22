// admin.html — Protección de datos (Ley 21.719): solicitudes de los titulares,
// dónde están los datos de una persona, conservación a 5 años, registro de
// incidentes y la migración de los datos guardados antes de la ley.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.
//
// FECHIPO es la responsable de los datos; YourLift SpA opera la plataforma por
// encargo. Lo que se le promete al público está en la política de privacidad
// (sitio/interfaz.js, renderTerminos) y el detalle de cómo se trabaja, en
// documentos/PROTECCION_DE_DATOS.md. Si se cambia algo acá, se cambia allá.

const PD_PLAZO_DIAS=30;            // para responder una solicitud (días corridos)
const PD_CONSERVACION_ANIOS=5;     // documentos: desde la última competencia
const PD_TIPOS={acceso:'Acceso',rectificacion:'Rectificación',supresion:'Supresión',
  oposicion:'Oposición',portabilidad:'Portabilidad',bloqueo:'Bloqueo'};
const PD_ESTADOS={recibida:'Recibida',en_curso:'En curso',respondida:'Respondida',rechazada:'Rechazada'};

// Ven esta pantalla quienes administran de verdad (no la transmisión ni la mesa).
const _pdPuede=()=>_esOwnerAdm()||ST.adminInfo?.role==='superadmin';

const _pdDia=86400000;
// Fecha de cualquier forma (Timestamp, ms, "2024-05-03", "03/05/2024") → ms.
function _pdMs(v){
  if(!v)return 0;
  if(typeof v==='number')return v;
  if(v.seconds)return v.seconds*1000;
  const s=String(v);
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m)return Date.UTC(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if(m)return Date.UTC(+m[3],+m[2]-1,+m[1]);
  const t=Date.parse(s); return isNaN(t)?0:t;
}
const _pdFecha=ms=>ms?new Date(ms).toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';

// La ruta en Storage de un archivo guardado ("storage:…" o un enlace de descarga).
function _pdRutaArchivo(v){
  if(YLPrivacidad.esRutaArchivo(v))return YLPrivacidad.rutaDe(v);
  const m=String(v||'').match(/\/o\/([^?]+)/); return m?decodeURIComponent(m[1]):'';
}
// Los archivos (documentos) que cuelgan de una inscripción privada.
function _pdArchivosDe(p){
  const out=[];
  Object.keys(p||{}).forEach(k=>{ if(/URL$/.test(k)&&p[k])out.push({campo:k,v:p[k]}); });
  if(p&&p.docs&&typeof p.docs==='object')Object.keys(p.docs).forEach(k=>{ if(p.docs[k])out.push({campo:'docs.'+k,v:p.docs[k]}); });
  return out;
}

// ═══════════ Carga ═══════════
async function pdCargar(){
  ST._pdCargado='cargando';
  const [sol,inc]=await Promise.all([
    getDocs(collection(db,'solicitudes_datos')).then(s=>s.docs.map(d=>({id:d.id,...d.data()}))).catch(e=>{ST._pdErr=e;return [];}),
    getDocs(collection(db,'incidentes')).then(s=>s.docs.map(d=>({id:d.id,...d.data()}))).catch(e=>{ST._pdErr=e;return [];}),
  ]);
  ST.pdSol=sol.sort((a,b)=>_pdMs(b.ts)-_pdMs(a.ts));
  ST.pdInc=inc.sort((a,b)=>_pdMs(b.detectado)-_pdMs(a.detectado));
  ST._pdCargado=true;
  if(ST.view==='proteccion')render();
}
window.pdTab=function(t){ST.pdTab=t;render();};

// ═══════════ Solicitudes de los titulares ═══════════
const _pdVence=s=>_pdMs(s.ts)+PD_PLAZO_DIAS*_pdDia;
window.pdSolEstado=async function(id,estado){
  const s=(ST.pdSol||[]).find(x=>x.id===id); if(!s)return;
  let nota='';
  if(estado==='respondida'||estado==='rechazada'){
    nota=prompt(estado==='rechazada'
      ?'¿Por qué se rechaza? (queda en el registro y hay que decírselo al titular, con la posibilidad de reclamar ante la Agencia de Protección de Datos Personales)'
      :'¿Qué se le respondió? (resumen: queda en el registro)','');
    if(nota===null)return;
  }
  try{
    const upd={status:estado,[estado+'En']:Date.now(),...(nota?{nota}:{})};
    await updateDoc(doc(db,'solicitudes_datos',id),upd);
    Object.assign(s,upd);
    await logAction('solicitud_datos_'+estado,id,null,PD_TIPOS[s.tipo]||s.tipo);
    showToast('Solicitud: '+PD_ESTADOS[estado]); render();
  }catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};
window.pdSolTitular=function(id){
  const s=(ST.pdSol||[]).find(x=>x.id===id); if(!s)return;
  ST.pdTab='titular'; ST.pdRut=s.rut; render(); pdBuscarTitular(s.rut);
};

// ═══════════ Dónde están los datos de una persona ═══════════
// Para responder una solicitud de acceso o portabilidad, o para suprimir: se
// busca a la persona por su RUT en todo lo que guarda la plataforma.
window.pdBuscarTitular=async function(rutIn){
  const rut=rutIn||document.getElementById('pd_rut')?.value||'';
  const r=YLPrivacidad.norm(rut);
  if(r.length<5){showToast('Escribe un RUT',null,true);return;}
  ST.pdRut=rut; ST.pdTitular={cargando:true}; render();
  const mismo=x=>YLPrivacidad.norm(x)===r;
  const T={rut:r,secciones:[],archivos:[],datos:{}};
  const sec=(titulo,donde,items)=>{ if(items&&items.length){T.secciones.push({titulo,donde,n:items.length,items});T.datos[titulo]=items;} };
  const atl=(ST.data||[]).find(a=>mismo(a.rut));
  const cod=atl?.codigo||'';
  if(atl)sec('Padrón de atletas','data.json (público, sin RUT ni fecha) + privado/padron (RUT y fecha)',
    [{codigo:atl.codigo,nombre:atl.nombre,club:atl.club||'',sexo:atl.sexo||'',fechaNac:atl.fechaNac||'',competencias:(atl.competencias||[]).length}]);
  const ins=(ST.inscripciones||[]).filter(i=>mismo(i.rut)||(cod&&i.codigo===cod));
  sec('Inscripciones','inscripciones (público, sin datos personales) + inscripciones_private (solo el panel)',
    ins.map(i=>{const p=(ST.inscripcionesPrivate||{})[i.id]||{};
      return {id:i.id,evento:i.evento,estado:i.status,nombre:i.nombre,categoria:i.categoria||'',division:i.division||'',
        rut:i.rut||'',fechaNac:i.fechaNac||'',comuna:i.comuna||'',correo:p.correo||'',
        documentos:_pdArchivosDe(p).map(x=>x.campo)};}));
  const q1=async(col,campo,val)=>val?(await getDocs(query(collection(db,col),where(campo,'==',val)))).docs.map(d=>({id:d.id,...d.data()})):[];
  const todos=async col=>(await getDocs(collection(db,col))).docs.map(d=>({id:d.id,...d.data()}));
  const intentar=async(fn)=>{try{return await fn();}catch(e){console.warn('[titular]',e.message);return [];}};
  const [res,fotos,pend,ents,refs,certs,eds]=await Promise.all([
    intentar(()=>q1('competition_results','codigo',cod)),
    intentar(async()=>{ if(!cod)return []; const d=await getDoc(doc(db,'atleta_fotos',cod)); return d.exists()?[{id:d.id,...d.data()}]:[]; }),
    intentar(async()=>(await todos('atletas_pending_priv')).filter(x=>mismo(x.rut))),
    intentar(async()=>(ST.entrenadores||await todos('entrenadores')).filter(x=>mismo(x.rut)||mismo(x.id))),
    intentar(async()=>(await todos('referees')).filter(x=>mismo(x.rut)||mismo(x.id))),
    intentar(async()=>(await todos('cert_requests')).filter(x=>mismo(x.rut))),
    intentar(async()=>{ const id=(ST._edDocPorRut||{})[r]; if(!id)return [];
      const [a,b]=await Promise.all([getDoc(doc(db,'athlete_edits',id)),getDoc(doc(db,'athlete_edits_priv',id))]);
      return [{id,...(a.exists()?a.data():{}),...(b.exists()?b.data():{})}]; }),
  ]);
  sec('Resultados publicados','competition_results (público, por código)',res.map(x=>({evento:x.evento,modalidad:x.modalidad,total:x.resultado?.total})));
  sec('Foto de perfil','atleta_fotos (público, por código) + Storage athlete_photos/',fotos.map(x=>({codigo:x.id,foto:x.foto_url?'sí':'no',estado:x.status||''})));
  sec('Ediciones del padrón','athlete_edits (público) + athlete_edits_priv (solo el panel)',eds);
  sec('Atleta nuevo pendiente','atletas_pending (público, por código) + atletas_pending_priv',pend);
  sec('Base de entrenadores','entrenadores (solo el panel) + copia pública sin RUT ni correos',ents.map(({acreditaciones,...x})=>({...x,acreditaciones:(acreditaciones||[]).length})));
  sec('Base de jueces','referees (solo el panel) + copia pública por código',refs);
  sec('Solicitudes de edición','edit_requests (solo el panel)',(ST.editRequests||[]).filter(x=>mismo(x.rut)).map(({pin,...x})=>x));
  sec('Solicitudes de certificado','cert_requests (solo el panel)',certs);
  sec('Solicitudes sobre sus datos','solicitudes_datos (solo el panel)',(ST.pdSol||[]).filter(x=>mismo(x.rut)));
  // Los archivos en Storage: la carpeta de documentos lleva el RUT.
  try{
    const l=await listAll(storageRef(getStorage(app),'athlete_files/'+r));
    T.archivos=l.items.map(i=>i.fullPath);
  }catch(e){console.warn('[titular] archivos',e.message);}
  ST.pdTitular=T; render();
};

// Sus datos en un archivo, para responder una solicitud de acceso o
// portabilidad (formato legible por máquina). No van enlaces a los documentos:
// se nombran; si los pide, se le envían aparte.
window.pdDescargarTitular=function(){
  const T=ST.pdTitular; if(!T||!T.rut)return;
  const out={generado:new Date().toISOString(),responsable:'Federación Chilena de Powerlifting (FECHIPO)',
    plataforma:'YourLift (YourLift SpA, encargado)',titular:{rut:T.rut},datos:T.datos,documentos_guardados:T.archivos.map(p=>p.split('/').pop())};
  const b=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='datos_'+T.rut+'.json'; a.click();
  logAction('titular_exportar',T.rut.slice(0,4)+'…',null,'datos exportados');
};

// Borra los documentos de identidad de una persona (supresión): los archivos de
// Storage y los enlaces en sus inscripciones privadas. Lo deportivo (nombre,
// resultados, récords) no se borra acá: es el historial oficial de la
// federación; si lo pide, se evalúa y se anonimiza a mano.
window.pdBorrarDocsTitular=async function(){
  const T=ST.pdTitular; if(!T||!T.rut)return;
  if(!_esOwnerAdm()){showToast('Solo el Owner puede borrar documentos',null,true);return;}
  const ins=(ST.inscripciones||[]).filter(i=>YLPrivacidad.norm(i.rut)===T.rut);
  if(!confirm('Se borran los documentos de identidad de este RUT: '+T.archivos.length+' archivo(s) en Storage y los enlaces en '+ins.length+' inscripción(es).\n\nNo se puede deshacer. ¿Seguir?'))return;
  const n=await _pdBorrarDocumentos(ins.map(i=>i.id),T.archivos);
  await logAction('titular_borrar_documentos',T.rut.slice(0,4)+'…',null,n.archivos+' archivos, '+n.inscripciones+' inscripciones');
  showToast('Documentos borrados: '+n.archivos+' archivo(s)'); pdBuscarTitular(T.rut);
};

// Borra los archivos y los campos de documentos (y el correo, la comuna y el
// PIN) de las inscripciones privadas indicadas. Devuelve cuántos.
async function _pdBorrarDocumentos(insIds,rutasExtra){
  const st=getStorage(app); const rutas=new Set(rutasExtra||[]); let ninsc=0;
  for(const id of insIds){
    const p=(ST.inscripcionesPrivate||{})[id]; if(!p)continue;
    const arch=_pdArchivosDe(p);
    arch.forEach(x=>{const r=_pdRutaArchivo(x.v); if(r)rutas.add(r);});
    const upd={documentosEliminados:new Date().toISOString().slice(0,10)};
    Object.keys(p).forEach(k=>{ if(/URL$/.test(k)||['docs','correo','comuna','pin','declaraMayorFecha','carnetName','wadeName'].includes(k))upd[k]=deleteField(); });
    try{ await updateDoc(doc(db,'inscripciones_private',id),upd); ninsc++; }catch(e){console.warn('[docs] privado',id,e.message);}
  }
  let narch=0;
  for(const r of rutas){ if(!/^athlete_files\//.test(r))continue;
    try{ await deleteObject(storageRef(st,r)); narch++; }
    catch(e){ if(e.code==='storage/object-not-found')narch++; else console.warn('[docs] archivo',e.code||e.message); } }
  return {archivos:narch,inscripciones:ninsc};
}

// ═══════════ Conservación: 5 años desde la última competencia ═══════════
// Por persona (RUT): la fecha más nueva entre los campeonatos en que se inscribió
// y los resultados del padrón. Si pasaron 5 años, sus documentos se borran.
function pdConservacion(){
  const lim=Date.now()-PD_CONSERVACION_ANIOS*365.25*_pdDia;
  const fechaEv={}; (ST.eventos||[]).forEach(e=>{ const f=_pdMs(e.date||e.fecha); if(f){fechaEv[e.id]=f; if(e.name)fechaEv[e.name]=f;} });
  const ultima={};
  const sube=(r,f)=>{ if(r&&f&&(!ultima[r]||f>ultima[r]))ultima[r]=f; };
  (ST.data||[]).forEach(a=>{ const r=YLPrivacidad.norm(a.rut); if(!r)return;
    (a.competencias||[]).forEach(c=>sube(r,_pdMs(c.fecha))); });
  (ST.inscripciones||[]).forEach(i=>{ const r=YLPrivacidad.norm(i.rut); if(!r)return;
    sube(r,fechaEv[i.evento]||_pdMs(i.timestamp)); });
  const vencidas=[];
  (ST.inscripciones||[]).forEach(i=>{
    const p=(ST.inscripcionesPrivate||{})[i.id]; if(!p)return;
    const docs=_pdArchivosDe(p); if(!docs.length&&!p.correo)return;
    const r=YLPrivacidad.norm(i.rut);
    const u=(r&&ultima[r])||fechaEv[i.evento]||_pdMs(i.timestamp);
    if(u&&u<lim)vencidas.push({id:i.id,nombre:i.nombre,evento:i.evento,ultima:u,docs:docs.length});
  });
  // Entrenadores: sus documentos y contactos, desde el campeonato (o la
  // convocatoria) de esa inscripción.
  const entVencidas=[];
  (ST.entInsc||[]).forEach(e=>{
    const p=(ST.entInscPriv||{})[e.id]; if(!p)return;
    if(!_pdArchivosDe(p).length&&!p.correo&&!p.telefono)return;
    const u=fechaEv[e.evento]||_pdMs(e.timestamp)||_pdMs(p.ts);
    if(u&&u<lim)entVencidas.push({id:e.id,nombre:e.nombre,ultima:u});
  });
  return {vencidas:vencidas.sort((a,b)=>a.ultima-b.ultima),entVencidas,limite:lim,fechaEv};
}
window.pdPurgarVencidos=async function(){
  if(!_esOwnerAdm()){showToast('Solo el Owner',null,true);return;}
  const {vencidas,entVencidas,limite,fechaEv}=pdConservacion();
  if(!confirm('Se borran los documentos (y el correo, comuna y PIN) de '+vencidas.length+' inscripción(es) de atletas y '+entVencidas.length+' de entrenadores que no compiten hace más de '+PD_CONSERVACION_ANIOS+' años, y los correos de handlers de los campeonatos de esa época.\n\nNo se puede deshacer. ¿Seguir?'))return;
  const n=await _pdBorrarDocumentos(vencidas.map(v=>v.id),[]);
  // Entrenadores: archivos y contactos de su inscripción privada.
  const st=getStorage(app); let nEnt=0;
  for(const e of entVencidas){
    const p=(ST.entInscPriv||{})[e.id]||{};
    for(const x of _pdArchivosDe(p)){ const r=_pdRutaArchivo(x.v); if(/^athlete_files\//.test(r))try{await deleteObject(storageRef(st,r));n.archivos++;}catch(err){} }
    try{ await updateDoc(doc(db,'inscripciones_entrenador_priv',e.id),{docs:deleteField(),correo:deleteField(),telefono:deleteField(),pin:deleteField(),documentosEliminados:new Date().toISOString().slice(0,10)}); nEnt++; }catch(err){console.warn('[conservación] entrenador',e.id,err.message);}
  }
  // Correos de handlers de campeonatos viejos (el id empieza con el del campeonato).
  let nH=0;
  for(const col of ['cronograma_priv','handlers_priv']){
    try{ (await getDocs(collection(db,col))).forEach(d=>{ const ev=d.id.split('__')[0]; const f=fechaEv[ev];
      if(f&&f<limite){ deleteDoc(doc(db,col,d.id)).catch(()=>{}); nH++; } }); }catch(err){console.warn('[conservación]',col,err.message);}
  }
  await logAction('conservacion_purga',null,null,n.inscripciones+' inscripciones, '+nEnt+' entrenadores, '+n.archivos+' archivos, '+nH+' handlers');
  showToast('Listo: '+n.inscripciones+' inscripciones, '+nEnt+' entrenadores, '+n.archivos+' archivos'); render();
};

// ═══════════ Incidentes de seguridad ═══════════
// Lo que pide la ley para reportar una vulneración: qué pasó, qué datos, a
// cuántos afectó, qué se hizo, y cuándo se avisó a la Agencia y a los titulares.
// El procedimiento está en documentos/PROTECCION_DE_DATOS.md.
window.pdIncNuevo=function(){ST.pdIncForm={detectado:new Date().toISOString().slice(0,10),descripcion:'',datos:'',afectados:'',medidas:'',riesgo:'alto',agencia:'',titulares:'',estado:'abierto'};render();};
window.pdIncEditar=function(id){const x=(ST.pdInc||[]).find(i=>i.id===id); if(x){ST.pdIncForm={...x};render();}};
window.pdIncCerrarForm=function(){ST.pdIncForm=null;render();};
window.pdIncGuardar=async function(){
  const f=ST.pdIncForm; if(!f)return;
  const v=id=>(document.getElementById(id)?.value||'').trim();
  Object.assign(f,{detectado:v('pi_det'),descripcion:v('pi_desc'),datos:v('pi_datos'),afectados:v('pi_af'),medidas:v('pi_med'),
    riesgo:v('pi_riesgo'),agencia:v('pi_ag'),titulares:v('pi_tit'),estado:v('pi_est')});
  if(!f.descripcion){showToast('Falta describir qué pasó',null,true);return;}
  const id=f.id||('inc_'+Date.now().toString(36));
  const {id:_x,...datos}=f;
  try{
    await setDoc(doc(db,'incidentes',id),{...datos,actualizado:Date.now(),por:ST.user?.uid||''});
    await logAction('incidente_'+(f.id?'editado':'registrado'),id,null,f.riesgo+' · '+f.estado);
    ST.pdIncForm=null; showToast('Incidente guardado'); pdCargar();
  }catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

// ═══════════ Migración: los datos guardados antes de la ley ═══════════
// El código nuevo ya escribe todo separado. Esto arregla lo que quedó guardado
// antes: saca el RUT, la fecha, la comuna y los correos de lo que se lee sin
// sesión, renombra los documentos que tenían el RUT en el id, mueve las fotos
// cuyo nombre de archivo llevaba el RUT y rehace el índice por RUT (solo el
// código). Se puede correr más de una vez: lo que ya está bien no se toca.
const _PD_RUT_ID=/_(\d{7,8}[0-9K])$/i;
// Una foto pública que hay que mover: el nombre del archivo lleva el RUT, o es
// un enlace a la carpeta privada de documentos (fotos tomadas de la inscripción).
const _PD_RUTA_RUT=/athlete_files(%2F|\/)|(athlete_photos|athlete_gifs)(%2F|\/)(\d{7,8}[0-9kK])_/i;
const _pdSinPers=o=>{const r={};Object.keys(o||{}).forEach(k=>{if(!YLPrivacidad.INSC_PRIVADOS.includes(k)&&k!=='correos')r[k]=o[k];});return r;};
const _pdPers=o=>{const r={};YLPrivacidad.INSC_PRIVADOS.concat(['correos']).forEach(k=>{if(o&&o[k]!==undefined&&o[k]!=='')r[k]=o[k];});return r;};
const _pdBorrar=o=>{const r={};YLPrivacidad.INSC_PRIVADOS.concat(['correos']).forEach(k=>{if(o&&o[k]!==undefined)r[k]=deleteField();});return r;};
const _pdTieneCorreo=v=>typeof v==='string'&&/@/.test(v);
const _pdNuevoId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

async function _pdLote(ops){
  for(let i=0;i<ops.length;i+=400){
    const b=writeBatch(db);
    ops.slice(i,i+400).forEach(o=>{
      if(o.t==='set')b.set(o.ref,o.d,o.merge?{merge:true}:{});
      else if(o.t==='update')b.update(o.ref,o.d);
      else b.delete(o.ref);
    });
    await b.commit();
  }
}

// Arma el plan (qué se escribe) sin escribir nada. Devuelve {ops, fotos, resumen}.
async function pdMigracionPlan(){
  const R={}; const sum=(k,n)=>{R[k]=(R[k]||0)+(n==null?1:n);};
  const ops=[], fotos=[];
  const set=(col,id,d,merge)=>ops.push({t:'set',ref:doc(db,col,id),d,merge});
  const upd=(col,id,d)=>{ if(Object.keys(d).length)ops.push({t:'update',ref:doc(db,col,id),d}); };
  const del=(col,id)=>ops.push({t:'del',ref:doc(db,col,id)});
  const leer=async col=>(await getDocs(collection(db,col))).docs.map(d=>({id:d.id,x:d.data()||{}}));
  const codDeRut={}; (ST.data||[]).forEach(a=>{const r=YLPrivacidad.norm(a.rut); if(r&&a.codigo)codDeRut[r]=a.codigo;});
  const indice={};   // rut → código (el índice nuevo)
  Object.entries(codDeRut).forEach(([r,c])=>{indice[r]=c;});

  // 1. Inscripciones
  const [pub,priv,reqs]=await Promise.all([leer('inscripciones'),leer('inscripciones_private'),leer('edit_requests')]);
  const P={}; priv.forEach(d=>{P[d.id]=d.x;});
  const ids=new Set(pub.map(d=>d.id));
  pub.forEach(({id,x})=>{
    const pers=_pdPers(x); const r=YLPrivacidad.norm(x.rut||P[id]?.rut);
    const cod=x.codigo||codDeRut[r]||'';
    const extra={};
    if(!x.codigo&&cod)extra.codigo=cod;
    if(!x.anioNac){const y=YLPrivacidad.anio(x.fechaNac||x.fechanac||x.fechanacimiento||x.dob||P[id]?.fechaNac); if(y)extra.anioNac=y;}
    if(r&&cod&&!indice[r])indice[r]=cod;
    const nuevo=(_PD_RUT_ID.test(id)&&cod)?YLPrivacidad.idInscripcion(x.evento,cod):id;
    if(nuevo!==id&&!ids.has(nuevo)){
      ids.add(nuevo);
      set('inscripciones',nuevo,{..._pdSinPers(x),...extra});
      set('inscripciones_private',nuevo,{...(P[id]||{}),...pers},true);
      del('inscripciones',id); if(P[id])del('inscripciones_private',id);
      reqs.filter(q=>q.x.inscripcionId===id).forEach(q=>upd('edit_requests',q.id,{inscripcionId:nuevo}));
      sum('Inscripciones con el RUT en el id (se renombran)');
    }else{
      if(nuevo!==id)sum('Inscripciones que no se pudieron renombrar (ya existe otra con ese código)');
      if(Object.keys(pers).length){ set('inscripciones_private',id,pers,true); sum('Inscripciones con datos personales a la vista'); }
      upd('inscripciones',id,{..._pdBorrar(x),...extra});
    }
  });

  // 2. Debutantes (atletas_pending): por código, lo privado aparte
  (await leer('atletas_pending')).forEach(({id,x})=>{
    const pers=_pdPers(x); const cod=x.codigo||'';
    if(!Object.keys(pers).length&&id===cod)return;
    const r=YLPrivacidad.norm(x.rut);
    if(r&&cod&&!indice[r])indice[r]=cod;
    if(x.incorporated||!cod){ del('atletas_pending',id); sum('Debutantes ya incorporados o sin código (se borra el registro con RUT)'); return; }
    set('atletas_pending',cod,{nombre:x.nombre||'',codigo:cod,sexo:x.sexo||'',anioNac:YLPrivacidad.anio(x.fechaNac)||x.anioNac||'',
      club:x.club||'',zona:x.zona||'',debut:true,inscripcion_evento:x.inscripcion_evento||'',...(x.ts?{ts:x.ts}:{})});
    set('atletas_pending_priv',cod,{rut:x.rut||'',fechaNac:x.fechaNac||''});
    if(id!==cod)del('atletas_pending',id);
    sum('Debutantes con RUT y fecha a la vista');
  });

  // 3. Ediciones del padrón
  (await leer('athlete_edits')).forEach(({id,x})=>{
    if(id===window.YLEdiciones.MARCA)return;
    const pers=_pdPers(x); const conRutId=/^rut_/i.test(id);
    if(!Object.keys(pers).length&&!conRutId)return;
    const extra={}; if(!x.anioNac){const y=YLPrivacidad.anio(x.fechaNac||x.fechanac); if(y)extra.anioNac=y;}
    const nuevo=conRutId?_pdNuevoId('ed_'):id;
    if(nuevo!==id){ set('athlete_edits',nuevo,{..._pdSinPers(x),...extra}); del('athlete_edits',id); sum('Ediciones con el RUT en el id (se renombran)'); }
    else{ upd('athlete_edits',id,{..._pdBorrar(x),...extra}); sum('Ediciones con RUT o fecha a la vista'); }
    if(Object.keys(pers).length)set('athlete_edits_priv',nuevo,pers,true);
  });

  // 4. Fotos de perfil
  (await leer('atleta_fotos')).forEach(({id,x})=>{
    const u={..._pdBorrar(x)};
    if(_pdTieneCorreo(x.approved_by))u.approved_by='';
    if(_pdTieneCorreo(x.rejected_by))u.rejected_by='';
    if(x.source_url){u.source_ref=_huellaFoto(x.source_url);u.source_url=deleteField();}
    if(x.rejected_url){u.rejected_ref=_huellaFoto(x.rejected_url);u.rejected_url=deleteField();}
    ['foto_url','gif_url'].forEach(k=>{ if(_PD_RUTA_RUT.test(String(x[k]||'')))fotos.push({id,campo:k,url:x[k],codigo:x.codigo||id}); });
    if(/^lc_rut_/i.test(id)){
      const cod=codDeRut[YLPrivacidad.norm(id.slice(7))];
      const nuevo=cod?'lc_cod_'+cod:_pdNuevoId('lc_x_');
      const {rut:_r,approved_by:_a,rejected_by:_b,source_url:_s,rejected_url:_q,...resto}=x;
      set('atleta_fotos',nuevo,{...resto,codigo:nuevo}); del('atleta_fotos',id);
      sum('Fotos del livecast con el RUT en el id'); return;
    }
    if(Object.keys(u).length){ upd('atleta_fotos',id,u); sum('Fotos con RUT, correos o enlaces a documentos'); }
  });
  if(fotos.length)sum('Fotos con el RUT en el nombre o tomadas de la carpeta de documentos (se copian con el código)',fotos.length);

  // 5. Resultados publicados
  (await leer('competition_results')).forEach(({id,x})=>{
    const u=_pdBorrar(x);
    ['addedBy','processedBy'].forEach(k=>{ if(_pdTieneCorreo(x[k]))u[k]=''; });
    if(Object.keys(u).length){ upd('competition_results',id,u); sum('Resultados con RUT o correos'); }
  });

  // 6. Livecast: la nómina en vivo
  const limpiaJson=s=>{try{return JSON.stringify(JSON.parse(s||'[]'),(k,v)=>({rut:1,dob:1,fechaNac:1,fechanac:1,correo:1,email:1,telefono:1}[k]?undefined:v));}catch(e){return s;}};
  (await leer('livecast_sync')).forEach(({id,x})=>{
    const u={};
    if(typeof x.athletes==='string'){const n=limpiaJson(x.athletes); if(n!==x.athletes)u.athletes=n;}
    if(x.event&&Array.isArray(x.event.athletes)){const n=JSON.parse(limpiaJson(JSON.stringify(x.event.athletes)));
      if(JSON.stringify(n)!==JSON.stringify(x.event.athletes))u['event.athletes']=n;}
    if(Object.keys(u).length){ upd('livecast_sync',id,u); sum('Nóminas del livecast con RUT o fecha'); }
  });
  (await leer('livecast_flash')).forEach(({id,x})=>{
    if(typeof x.ath!=='string')return; const n=limpiaJson(x.ath);
    if(n!==x.ath){ upd('livecast_flash',id,{ath:n}); sum('Canal rápido del livecast con RUT o fecha'); }
  });

  // 7. Cronograma y handlers: sin RUT ni correos a la vista
  (await leer('cronograma')).forEach(({id,x})=>{
    const rows=Array.isArray(x.rows)?x.rows:[];
    const hay=rows.some(r=>r.rut||(r.handler1||{}).correo||(r.handler2||{}).correo);
    if(!hay)return;
    const correos=rows.map(r=>({h1c:(r.handler1||{}).correo||'',h2c:(r.handler2||{}).correo||''}));
    const limpias=rows.map(({rut,...r})=>({...r,codigo:r.codigo||codDeRut[YLPrivacidad.norm(rut)]||'',
      handler1:{nombre:(r.handler1||{}).nombre||''},handler2:{nombre:(r.handler2||{}).nombre||''}}));
    set('cronograma_priv',id,{correos});
    upd('cronograma',id,{rows:limpias}); sum('Cronogramas con RUT o correos');
  });
  (await leer('handlers')).forEach(({id,x})=>{
    const hs=Array.isArray(x.handlers)?x.handlers:[];
    if(!hs.some(h=>h&&h.correo))return;
    set('handlers_priv',id,{correos:hs.map(h=>h.correo||''),by:x.by||''});
    upd('handlers',id,{handlers:hs.map(h=>({nombre:(h&&h.nombre)||''}))}); sum('Handlers con correo a la vista');
  });

  // 8. Inscripciones de entrenador: sin RUT en lo público
  (await leer('inscripciones_entrenador')).forEach(({id,x})=>{
    const u={};
    if(x.rut!==undefined){u.rut=deleteField(); set('inscripciones_entrenador_priv',id,{rut:x.rut},true);}
    if(Array.isArray(x.atletas)&&x.atletas.some(a=>a&&a.rut))
      u.atletas=x.atletas.map(({rut,...a})=>({...a,codigo:a.codigo||codDeRut[YLPrivacidad.norm(rut)]||''}));
    if(Object.keys(u).length){ upd('inscripciones_entrenador',id,u); sum('Inscripciones de entrenador con RUT'); }
  });

  // 9. Correos de admins en documentos públicos sueltos
  for(const [col,id,campo] of [['nomina_suda_edits','main','by'],['ranking_config','ciclo','por']]){
    try{ const d=await getDoc(doc(db,col,id)); if(d.exists()&&_pdTieneCorreo(d.data()[campo])){ upd(col,id,{[campo]:''}); sum('Correos de admins a la vista'); } }catch(e){}
  }

  // 10. El índice por RUT: solo el código (antes llevaba la fecha de nacimiento)
  const indiceOps=Object.entries(indice).map(([r,c])=>({t:'set',ref:doc(db,'rut_indice',r),d:{codigo:c}}));
  sum('Índice por RUT (se reescribe con solo el código)',indiceOps.length);

  // 11. Los documentos guardados con enlace de descarga (ver _pdRotarDocumentos)
  const docs=await _pdDocsConEnlace();
  if(docs.length)sum('Documentos con enlace de descarga (se renuevan: los enlaces viejos dejan de servir)',new Set(docs.map(d=>d.ruta)).size);
  return {ops,indiceOps,fotos,resumen:R};
}

window.pdMigracionRevisar=async function(){
  if(!_esOwnerAdm()){showToast('Solo el Owner',null,true);return;}
  ST.pdMig={cargando:true}; render();
  try{ const p=await pdMigracionPlan(); ST.pdMig={plan:p}; }
  catch(e){ ST.pdMig={error:e.code||e.message}; }
  render();
};

// Los enlaces de descarga llevan su propia llave y siguen sirviendo aunque
// cambien las reglas de Storage. Hubo enlaces a documentos a la vista (fotos de
// perfil tomadas de la inscripción, versiones viejas de data.json en el
// repositorio). Para que ninguno sirva más, cada documento se copia a un archivo
// nuevo, la inscripción privada apunta a la copia por su ubicación
// ("storage:…", sin llave) y el archivo viejo se borra.
async function _pdDocsConEnlace(){
  const out=[];
  for(const col of ['inscripciones_private','inscripciones_entrenador_priv']){
    (await getDocs(collection(db,col))).forEach(d=>{
      _pdArchivosDe(d.data()||{}).forEach(x=>{
        if(typeof x.v!=='string'||!/^https?:/i.test(x.v))return;
        const r=_pdRutaArchivo(x.v); if(/^athlete_files\//.test(r))out.push({col,id:d.id,campo:x.campo,url:x.v,ruta:r});
      });
    });
  }
  return out;
}
async function _pdRotarDocumentos(paso){
  const st=getStorage(app), lista=await _pdDocsConEnlace();
  const nueva={}, mal=new Set(); let n=0;
  for(const d of lista){
    n++; if(n%5===1)paso('Renovando documentos ('+n+'/'+lista.length+')…');
    try{
      if(!nueva[d.ruta]&&!mal.has(d.ruta)){
        const resp=await fetch(d.url); if(!resp.ok)throw new Error('HTTP '+resp.status);
        const blob=await resp.blob();
        const ruta=d.ruta.replace(/(\.[a-z0-9]+)?$/i,'_r'+Date.now().toString(36)+'$1');
        await uploadBytes(storageRef(st,ruta),blob,{contentType:blob.type||'application/octet-stream'});
        nueva[d.ruta]=ruta;
      }
      if(nueva[d.ruta])await updateDoc(doc(db,d.col,d.id),{[d.campo]:YLPrivacidad.rutaArchivo(nueva[d.ruta])});
    }catch(e){ mal.add(d.ruta); console.warn('[migración] documento',d.ruta,e.message); }
  }
  let borrados=0;
  for(const r of Object.keys(nueva)){ try{ await deleteObject(storageRef(st,r)); borrados++; }catch(e){ if(e.code==='storage/object-not-found')borrados++; } }
  return {renovados:Object.keys(nueva).length,conError:mal.size,borrados};
}

// Copia una foto con el RUT en el nombre (o tomada de la carpeta de documentos)
// a una por código. La vieja se borra si era una foto; si era un documento de
// la inscripción, se deja (lo renueva _pdRotarDocumentos).
async function _pdMoverFoto(f){
  const st=getStorage(app);
  const vieja=_pdRutaArchivo(f.url);
  const blob=await (await fetch(f.url)).blob();
  const ext=(vieja.match(/\.([a-z0-9]+)$/i)||[])[1]||'jpg';
  const carpeta=f.campo==='gif_url'?'athlete_gifs':'athlete_photos';
  const ruta=carpeta+'/'+String(f.codigo).replace(/[^0-9a-zA-Z-]/g,'_')+'_'+Date.now()+'.'+ext;
  const ref=storageRef(st,ruta);
  await uploadBytes(ref,blob,{contentType:blob.type||'application/octet-stream'});
  const url=await getDownloadURL(ref);
  await updateDoc(doc(db,'atleta_fotos',f.id),{[f.campo]:url,...(f.campo==='foto_url'?{storage_path:ruta}:{})});
  if(vieja&&/^athlete_(photos|gifs)\//.test(vieja))try{await deleteObject(storageRef(st,vieja));}catch(e){}
  return url;
}

window.pdMigracionAplicar=async function(){
  if(!_esOwnerAdm()){showToast('Solo el Owner',null,true);return;}
  const p=ST.pdMig&&ST.pdMig.plan; if(!p)return;
  if(!confirm('Se aplican los cambios de la revisión: '+p.ops.length+' escrituras, '+p.fotos.length+' fotos y el índice por RUT.\n\nAntes tienen que estar publicadas las reglas nuevas de Firestore y de Storage.\n\nNo cierres la página hasta que termine. ¿Seguir?'))return;
  const paso=t=>{ST.pdMig.paso=t;render();};
  try{
    paso('Anotando el código de atleta donde faltaba…');
    await _enlazarPorCodigo();
    paso('Separando los datos personales ('+p.ops.length+' escrituras)…');
    await _pdLote(p.ops);
    paso('Reescribiendo el índice por RUT…');
    await _pdLote(p.indiceOps);
    let fOk=0,fMal=0;
    for(const f of p.fotos){ paso('Moviendo fotos ('+(fOk+fMal+1)+'/'+p.fotos.length+')…');
      try{ await _pdMoverFoto(f); fOk++; }catch(e){ fMal++; console.warn('[migración] foto',f.id,e.message); } }
    // Después de mover las fotos (algunas eran documentos de la inscripción).
    const rot=await _pdRotarDocumentos(paso);
    paso('Publicando las copias públicas de entrenadores y jueces…');
    const [ents,refs]=await Promise.all([getDocs(collection(db,'entrenadores')),getDocs(collection(db,'referees'))]);
    await publicarEntrenadores(ents.docs.map(d=>({id:d.id,...d.data()})));
    await publicarJueces(refs.docs.map(d=>({id:d.id,...d.data()})));
    await publicarNominaEntrenadores(ST.entInsc||[]);
    paso('Volviendo a publicar data.json sin datos personales…');
    await _uploadToStorage((ST.data||[]).map(({_isPending,_pendId,...a})=>a),null);
    await _marcarEdicion();
    await setDoc(doc(db,'config','ley21719'),{migrado:Date.now(),por:ST.user?.uid||'',resumen:p.resumen,fotosMovidas:fOk,fotosConError:fMal,
      documentosRenovados:rot.renovados,documentosConError:rot.conError});
    await logAction('ley_21719_migracion',null,null,p.ops.length+' escrituras, '+fOk+' fotos'+(fMal?' ('+fMal+' con error)':'')+', '+rot.renovados+' documentos renovados'+(rot.conError?' ('+rot.conError+' con error)':''));
    ST.pdMig={hecho:true,fOk,fMal,rot};
    showToast('Migración terminada'+(fMal||rot.conError?' · revisar errores':''),null,!!(fMal||rot.conError));
  }catch(e){
    ST.pdMig={...ST.pdMig,error:(e.code||'')+' '+(e.message||'')};
    showToast('Se detuvo: '+(e.code||e.message)+'. Se puede volver a revisar y aplicar: lo hecho no se repite.',null,true);
  }
  render();
};

// ═══════════ Pantalla ═══════════
function renderProteccion(){
  if(!_pdPuede())return '<div class="h1">Protección de datos</div><p class="subtitle">Solo el Owner y los superadmin.</p>';
  if(ST._pdCargado!==true){ if(!ST._pdCargado)setTimeout(pdCargar,0); return '<div class="h1">Protección de datos</div><p class="subtitle">Cargando…</p>'; }
  const tab=ST.pdTab||'resumen';
  const caja='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin:14px 0';
  const th='padding:8px 10px;font-family:Oswald;font-size:10px;letter-spacing:1px;color:var(--muted);text-align:left;border-bottom:1px solid var(--border)';
  const td='padding:8px 10px;font-size:12px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top';
  const chip=(t,c)=>`<span style="font-family:Oswald;font-size:10px;letter-spacing:1px;border:1px solid ${c};color:${c};border-radius:10px;padding:2px 8px;white-space:nowrap">${esc(t)}</span>`;
  const ahora=Date.now();
  const abiertas=(ST.pdSol||[]).filter(s=>s.status==='recibida'||s.status==='en_curso');
  const atrasadas=abiertas.filter(s=>_pdVence(s)<ahora);
  const cons=pdConservacion();
  const incAb=(ST.pdInc||[]).filter(i=>i.estado!=='cerrado');
  const tabs=[['resumen','Resumen'],['solicitudes','Solicitudes'+(abiertas.length?' ('+abiertas.length+')':'')],['titular','Buscar persona'],
    ['conservacion','Conservación'],['incidentes','Incidentes'],['migracion','Migración']];
  let h=`<div class="h1">Protección de datos</div>
    <p class="subtitle">Ley 21.719. FECHIPO es la responsable de los datos; YourLift SpA opera la plataforma por encargo. Lo que se publica de cada atleta es su nombre, club, categoría, resultados y su código; el RUT, la fecha de nacimiento, los documentos y los contactos solo los ve el panel.</p>
    ${ST._pdErr?`<div style="margin:12px 0;padding:10px 14px;border:1px solid var(--red);border-radius:8px;color:var(--red);font-size:12px">No se pudo leer todo: ${esc(ST._pdErr.message||'')}. Revisa que estén publicadas las reglas de Firestore.</div>`:''}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0">${tabs.map(([k,t])=>`<button class="btn" style="${tab===k?'background:var(--accent);color:#fff;border-color:var(--accent)':''};font-size:11px;padding:7px 12px" onclick="pdTab('${k}')">${t}</button>`).join('')}</div>`;

  if(tab==='resumen'){
    const tarjeta=(t,v,s,c)=>`<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
      <div style="font-family:Oswald;font-size:11px;letter-spacing:1px;color:var(--muted)">${t}</div>
      <div style="font-family:Oswald;font-size:24px;font-weight:700;color:${c||'var(--text)'};margin-top:4px">${v}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${s}</div></div>`;
    h+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px">
      ${tarjeta('SOLICITUDES ABIERTAS',abiertas.length,atrasadas.length?atrasadas.length+' fuera de plazo':'plazo: '+PD_PLAZO_DIAS+' días corridos',atrasadas.length?'var(--red)':abiertas.length?'var(--gold)':'')}
      ${tarjeta('DOCUMENTOS VENCIDOS',cons.vencidas.length,'inscripciones de +'+PD_CONSERVACION_ANIOS+' años sin competir',cons.vencidas.length?'var(--gold)':'')}
      ${tarjeta('INCIDENTES ABIERTOS',incAb.length,(ST.pdInc||[]).length+' registrados',incAb.length?'var(--red)':'')}
    </div>
    <div style="${caja}">
      <div style="font-family:Oswald;font-size:14px;letter-spacing:1px;margin-bottom:8px">SI HAY UN INCIDENTE (filtración, acceso indebido, pérdida de datos)</div>
      <ol style="font-size:13px;line-height:1.8;padding-left:18px;margin:0">
        <li>Contener: cambiar claves, desactivar cuentas comprometidas (Gestión Admin), revisar las reglas de Firebase.</li>
        <li>Registrarlo acá (pestaña Incidentes): qué pasó, qué datos, a cuántas personas, qué se hizo.</li>
        <li>Si hay riesgo para las personas: avisar a FECHIPO (responsable) y reportar a la Agencia de Protección de Datos Personales sin demora.</li>
        <li>Si se vieron datos sensibles (salud, discapacidad), de menores o financieros: avisar también a cada persona afectada.</li>
        <li>Si fue un ataque: denuncia en la PDI (Cibercrimen) o la Fiscalía.</li>
      </ol>
      <div style="font-size:11px;color:var(--muted);margin-top:8px">El detalle está en documentos/PROTECCION_DE_DATOS.md del repositorio.</div>
    </div>`;
  }

  if(tab==='solicitudes'){
    const filas=(ST.pdSol||[]).map(s=>{
      const v=_pdVence(s), abierta=s.status==='recibida'||s.status==='en_curso';
      const c=s.status==='respondida'?'var(--green)':s.status==='rechazada'?'var(--muted)':(abierta&&v<ahora?'var(--red)':'var(--gold)');
      return `<tr>
        <td style="${td};white-space:nowrap">${_pdFecha(_pdMs(s.ts))}</td>
        <td style="${td}"><b>${esc(PD_TIPOS[s.tipo]||s.tipo)}</b><div style="color:var(--muted);font-size:11px;max-width:320px">${esc(s.detalle||'')}</div></td>
        <td style="${td}">${esc(s.nombre||'')}<div style="color:var(--muted);font-size:11px">${esc(s.rut||'')} · ${esc(s.correo||'')}</div></td>
        <td style="${td};white-space:nowrap">${abierta?(v<ahora?'<b style="color:var(--red)">Vencida</b> ':'')+_pdFecha(v):'—'}</td>
        <td style="${td}">${chip(PD_ESTADOS[s.status]||s.status,c)}${s.nota?`<div style="font-size:11px;color:var(--muted);margin-top:4px">${esc(s.nota)}</div>`:''}</td>
        <td style="${td};white-space:nowrap;text-align:right">
          <button class="btn" style="font-size:11px;padding:5px 9px" onclick="pdSolTitular('${s.id}')">Ver sus datos</button>
          ${abierta?`${s.status==='recibida'?`<button class="btn" style="font-size:11px;padding:5px 9px" onclick="pdSolEstado('${s.id}','en_curso')">En curso</button>`:''}
          <button class="btn btn-g" style="font-size:11px;padding:5px 9px" onclick="pdSolEstado('${s.id}','respondida')">Respondida</button>
          <button class="btn" style="font-size:11px;padding:5px 9px" onclick="pdSolEstado('${s.id}','rechazada')">Rechazar</button>`:''}
        </td></tr>`;}).join('');
    h+=`<div style="${caja}">
      <div style="font-family:Oswald;font-size:14px;letter-spacing:1px">SOLICITUDES DE LOS TITULARES</div>
      <p style="font-size:12px;color:var(--muted);margin:6px 0 12px">Llegan desde la página de privacidad de yourlift.cl (o se anotan acá si llegan por correo). Hay ${PD_PLAZO_DIAS} días corridos para responder. Antes de entregar datos, confirma que quien pide es el titular (o su representante): responde al correo con que escribió y, si hay dudas, pide una copia de su carnet.</p>
      ${filas?`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tr><th style="${th}">RECIBIDA</th><th style="${th}">QUÉ PIDE</th><th style="${th}">TITULAR</th><th style="${th}">VENCE</th><th style="${th}">ESTADO</th><th style="${th}"></th></tr>${filas}</table></div>`
        :'<div style="font-size:13px;color:var(--muted)">No hay solicitudes.</div>'}
    </div>`;
  }

  if(tab==='titular'){
    const T=ST.pdTitular;
    h+=`<div style="${caja}">
      <div style="font-family:Oswald;font-size:14px;letter-spacing:1px">DÓNDE ESTÁN LOS DATOS DE UNA PERSONA</div>
      <p style="font-size:12px;color:var(--muted);margin:6px 0 12px">Para responder una solicitud de acceso, portabilidad o supresión. Se busca por RUT en todo lo que guarda la plataforma.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="pd_rut" class="inp" placeholder="RUT" value="${esc(ST.pdRut||'')}" style="max-width:200px" onkeydown="if(event.key==='Enter')pdBuscarTitular()">
        <button class="btn btn-b" onclick="pdBuscarTitular()">Buscar</button></div>
      ${T&&T.cargando?'<p style="font-size:13px;color:var(--muted);margin-top:12px">Buscando…</p>':''}
      ${T&&!T.cargando?`<div style="margin-top:14px">
        ${T.secciones.length||T.archivos.length?T.secciones.map(s=>`<div style="border-top:1px solid var(--border);padding:10px 0">
          <div style="font-weight:600">${esc(s.titulo)} <span style="color:var(--muted);font-weight:400">· ${s.n}</span></div>
          <div style="font-size:11px;color:var(--muted)">${esc(s.donde)}</div></div>`).join('')
          +(T.archivos.length?`<div style="border-top:1px solid var(--border);padding:10px 0"><div style="font-weight:600">Documentos en Storage <span style="color:var(--muted);font-weight:400">· ${T.archivos.length}</span></div>
            <div style="font-size:11px;color:var(--muted)">athlete_files/${esc(T.rut)}/ (solo el panel)</div></div>`:'')
          :'<p style="font-size:13px;color:var(--muted)">No hay datos de ese RUT.</p>'}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn" onclick="pdDescargarTitular()">Descargar sus datos (JSON)</button>
          ${_esOwnerAdm()&&T.archivos.length?`<button class="btn btn-r" onclick="pdBorrarDocsTitular()">Borrar sus documentos de identidad</button>`:''}
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:10px">Los resultados deportivos son el historial oficial de la federación: si la persona pide borrarlos, se evalúa con FECHIPO y se anonimiza a mano.</p>
      </div>`:''}
    </div>`;
  }

  if(tab==='conservacion'){
    const filas=cons.vencidas.slice(0,200).map(v=>`<tr><td style="${td}">${esc(v.nombre||'')}</td><td style="${td}">${esc(v.evento||'')}</td><td style="${td}">${_pdFecha(v.ultima)}</td><td style="${td};text-align:right">${v.docs}</td></tr>`).join('');
    h+=`<div style="${caja}">
      <div style="font-family:Oswald;font-size:14px;letter-spacing:1px">CONSERVACIÓN: ${PD_CONSERVACION_ANIOS} AÑOS DESDE LA ÚLTIMA COMPETENCIA</div>
      <p style="font-size:12px;color:var(--muted);margin:6px 0 12px">A los ${PD_CONSERVACION_ANIOS} años de la última competencia de una persona se borran sus documentos (carnet, pasaporte, certificados, consentimientos) y su correo, comuna y PIN. Quedan su nombre, sus resultados y, en privado, su RUT y fecha de nacimiento, que identifican su historial deportivo. Se revisa al abrir esta pantalla; conviene borrar una vez al año.</p>
      ${filas?`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tr><th style="${th}">ATLETA</th><th style="${th}">INSCRIPCIÓN</th><th style="${th}">ÚLTIMA COMPETENCIA</th><th style="${th};text-align:right">DOCUMENTOS</th></tr>${filas}</table></div>
        `:`<div style="font-size:13px;color:var(--muted)">No hay documentos de atletas vencidos (de personas que no compiten desde antes del ${_pdFecha(cons.limite)}).</div>`}
      ${cons.entVencidas.length?`<div style="font-size:13px;margin-top:10px">Entrenadores con documentos vencidos: <b>${cons.entVencidas.length}</b></div>`:''}
      ${_esOwnerAdm()?`<button class="btn btn-r" style="margin-top:12px" onclick="pdPurgarVencidos()">Borrar lo vencido (${cons.vencidas.length+cons.entVencidas.length})</button>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">También borra los correos de handlers de los campeonatos de hace más de ${PD_CONSERVACION_ANIOS} años.</div>`:''}
    </div>`;
  }

  if(tab==='incidentes'){
    const f=ST.pdIncForm;
    const campo=(t,id,v,tipo)=>`<label style="display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px">${t}<input id="${id}" class="inp" type="${tipo||'text'}" value="${esc(v||'')}"></label>`;
    const area=(t,id,v,ph)=>`<label style="display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px;grid-column:1/-1">${t}<textarea id="${id}" class="inp" rows="3" placeholder="${esc(ph||'')}">${esc(v||'')}</textarea></label>`;
    h+=f?`<div style="${caja};border-color:var(--red)">
      <div style="font-family:Oswald;font-size:14px;letter-spacing:1px;margin-bottom:12px">${f.id?'EDITAR':'REGISTRAR'} INCIDENTE</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        ${campo('DETECTADO','pi_det',f.detectado,'date')}
        ${campo('PERSONAS AFECTADAS (APROX.)','pi_af',f.afectados)}
        <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px">RIESGO PARA LAS PERSONAS<select id="pi_riesgo" class="inp">${['alto','bajo'].map(x=>`<option ${f.riesgo===x?'selected':''}>${x}</option>`).join('')}</select></label>
        <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px">ESTADO<select id="pi_est" class="inp">${['abierto','cerrado'].map(x=>`<option ${f.estado===x?'selected':''}>${x}</option>`).join('')}</select></label>
        ${area('QUÉ PASÓ','pi_desc',f.descripcion,'Cómo se detectó, desde cuándo, quién pudo acceder')}
        ${area('QUÉ DATOS','pi_datos',f.datos,'RUT, fechas, documentos, correos… ¿hay de menores, de salud o financieros?')}
        ${area('QUÉ SE HIZO','pi_med',f.medidas,'Contención, cambios de clave, reglas, aviso a FECHIPO')}
        ${campo('REPORTADO A LA AGENCIA (FECHA)','pi_ag',f.agencia,'date')}
        ${campo('AVISADO A LOS AFECTADOS (FECHA)','pi_tit',f.titulares,'date')}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-b" onclick="pdIncGuardar()">Guardar</button><button class="btn" onclick="pdIncCerrarForm()">Cerrar</button></div>
    </div>`:'';
    const filas=(ST.pdInc||[]).map(i=>`<tr><td style="${td};white-space:nowrap">${_pdFecha(_pdMs(i.detectado))}</td><td style="${td}">${esc(i.descripcion||'')}</td>
      <td style="${td}">${esc(i.afectados||'')}</td><td style="${td}">${i.agencia?_pdFecha(_pdMs(i.agencia)):'—'}</td>
      <td style="${td}">${chip(i.estado||'',i.estado==='cerrado'?'var(--muted)':'var(--red)')}</td>
      <td style="${td};text-align:right"><button class="btn" style="font-size:11px;padding:5px 9px" onclick="pdIncEditar('${i.id}')">Editar</button></td></tr>`).join('');
    h+=`<div style="${caja}">
      <div style="display:flex;align-items:center;gap:12px"><div style="font-family:Oswald;font-size:14px;letter-spacing:1px">REGISTRO DE INCIDENTES</div>
        ${f?'':'<button class="btn btn-r" style="font-size:12px;padding:6px 12px" onclick="pdIncNuevo()">+ Registrar incidente</button>'}</div>
      <p style="font-size:12px;color:var(--muted);margin:6px 0 12px">Todo incidente se anota, aunque al final no haya que reportarlo: el registro es lo que demuestra que se actuó a tiempo.</p>
      ${filas?`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tr><th style="${th}">DETECTADO</th><th style="${th}">QUÉ PASÓ</th><th style="${th}">AFECTADOS</th><th style="${th}">AGENCIA</th><th style="${th}">ESTADO</th><th style="${th}"></th></tr>${filas}</table></div>`
        :'<div style="font-size:13px;color:var(--muted)">Sin incidentes registrados.</div>'}
    </div>`;
  }

  if(tab==='migracion'){
    const M=ST.pdMig||{};
    h+=`<div style="${caja}">
      <div style="font-family:Oswald;font-size:14px;letter-spacing:1px">MIGRACIÓN DE LOS DATOS GUARDADOS ANTES</div>
      <p style="font-size:12px;color:var(--muted);margin:6px 0 12px">Lo nuevo ya se guarda separado. Esto arregla lo de antes: saca el RUT, las fechas de nacimiento, la comuna y los correos de lo que se lee sin sesión; renombra lo que tenía el RUT en el identificador; mueve las fotos cuyo nombre de archivo llevaba el RUT; deja el índice por RUT con solo el código; y publica las copias públicas de entrenadores y jueces. Primero hay que publicar las reglas nuevas de Firestore y de Storage. Se puede correr más de una vez.</p>
      ${!_esOwnerAdm()?'<p style="font-size:13px">Solo el Owner puede correrla.</p>'
        :M.cargando?'<p style="font-size:13px;color:var(--muted)">Revisando…</p>'
        :M.paso&&!M.hecho&&!M.error?`<p style="font-size:13px;color:var(--gold)">${esc(M.paso)}</p>`
        :M.hecho?`<p style="font-size:13px;color:var(--green)">Listo. ${M.fOk} fotos movidas, ${M.rot?M.rot.renovados:0} documentos renovados.${M.fMal||(M.rot&&M.rot.conError)?` <span style="color:var(--red)">${M.fMal||0} fotos y ${(M.rot&&M.rot.conError)||0} documentos no se pudieron copiar (ver la consola del navegador); se puede volver a correr.</span>`:''}</p><button class="btn" onclick="pdMigracionRevisar()">Revisar de nuevo</button>`
        :M.plan?`<table style="width:100%;border-collapse:collapse;margin-bottom:12px">${Object.entries(M.plan.resumen).map(([k,v])=>`<tr><td style="${td}">${esc(k)}</td><td style="${td};text-align:right;font-family:Oswald">${v}</td></tr>`).join('')||`<tr><td style="${td}">No hay nada que arreglar.</td></tr>`}</table>
            <button class="btn btn-r" onclick="pdMigracionAplicar()">Aplicar</button> <button class="btn" onclick="pdMigracionRevisar()">Revisar de nuevo</button>`
        :`${M.error?`<p style="font-size:13px;color:var(--red)">${esc(M.error)}</p>`:''}<button class="btn btn-b" onclick="pdMigracionRevisar()">Revisar qué hay que cambiar</button>`}
    </div>`;
  }
  return h;
}

// admin.html — Atletas: la comparativa por categoría, editar fichas, logros, solicitudes de edición y el perfil con sus competencias.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// Mejor total del atleta DENTRO de la categoría y modalidad del grupo. No se filtra
// por división: si un Junior hizo su mejor total compitiendo en Open en la misma
// categoría, ese es el que vale para compararse.
function _peerMejor(a,key){
  const p=String(key).split('|'), cat=p[1], modal=p[3];
  let total=0, glp=0;
  (a.competencias||[]).forEach(c=>{
    const r=c.resultado||{};
    if(!(r.total>0))return;
    const m=String(c.modalidad||'').toLowerCase().includes('equip')?'equipped':'classic';
    if(m!==modal)return;
    if(String(c.categoria||'').trim()!==cat)return;
    if(r.total>total){total=r.total;glp=+(r.glp||r.gl||0)||0;}
  });
  return {total,glp};
}

function _peersBuild(db){
  const grupos={};
  (db||[]).forEach(a=>{
    const key=(typeof getPeerKey==='function'?getPeerKey:_getPeerKey)(a);
    if(!key)return;
    const m=_peerMejor(a,key);
    if(!(m.total>0))return;
    (grupos[key]=grupos[key]||[]).push({codigo:a.codigo,nombre:a.nombre,total:m.total,glp:m.glp});
  });
  const out={};
  Object.keys(grupos).forEach(k=>{
    const ms=grupos[k].sort((x,y)=>y.total-x.total||String(x.nombre).localeCompare(String(y.nombre)));
    const tot=ms.map(m=>m.total), gl=ms.map(m=>m.glp).filter(x=>x>0);
    const pct=p=>tot[Math.min(tot.length-1,Math.max(0,Math.round((1-p)*(tot.length-1))))];
    const prom=l=>l.length?l.reduce((s,x)=>s+x,0)/l.length:0;
    out[k]={n:ms.length,
      avg:+prom(tot).toFixed(1), top:tot[0], p75:pct(.75), p50:pct(.5), p25:pct(.25),
      glp_avg:+prom(gl).toFixed(2), glp_top:gl.length?Math.max.apply(null,gl):0,
      members:ms.slice(0,10)};
  });
  return out;
}

// ── Peer helpers ──
function _getPeerKey(a){
  const comps=[...(a.competencias||[])].filter(c=>c.sexo&&c.categoria&&c.resultado&&c.resultado.total>0).sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||''));
  if(!comps.length)return null;
  const l=comps[0];
  const sex=(l.sexo||'').match(/mujer|fem/i)?'F':'M';
  const modal=(l.modalidad||'').toLowerCase().includes('equip')?'equipped':'classic';
  return sex+'|'+(l.categoria||'').trim()+'|'+(l.division||'Open').trim()+'|'+modal;
}

function _peerPerc(myTotal,key){const g=PEERS[key];if(!g)return null;const all=[...g.members.map(m=>m.total),myTotal].sort((a,b)=>b-a);const rank=all.indexOf(myTotal)+1;return{rank,n:all.length,pct:Math.round((1-rank/all.length)*100),g};}

// HTML-escape helper — defensa contra XSS al inyectar datos en innerHTML
function esc(s){
  if(s==null)return'';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

window.esc=esc;

// ═══════════════════════════════════════════
// EDIT ATHLETES (data.json)
// ═══════════════════════════════════════════
// Los athlete_edits se indexan por RUT (que nunca cambia) en vez de código,
// así editar el código no rompe el matching ni revierte al recargar.
function _editDocId(a){
  const rut=String(a.rut||'').replace(/[^0-9kK]/gi,'').toUpperCase();
  if(rut) return 'rut_'+rut;
  // fallback: si no hay rut, usar código (atletas viejos sin rut)
  return 'cod_'+String(a.codigo||'').replace(/[^a-zA-Z0-9_-]/g,'_');
}

// La hora del último cambio, en un documento aparte de la misma colección.
// Las páginas piden SOLO ese documento —una petición chica— y recién se bajan
// las ediciones enteras si cambió. Sin esto cada página se guardaba su copia con
// un vencimiento propio (20 minutos el inicio, dos horas el ranking) y una
// corrección tardaba entre veinte minutos y dos horas en verse. Ahora se ve en
// la carga siguiente.
async function _marcarEdicion(){
  try{
    await setDoc(doc(db,'athlete_edits','__version'),{ts:Date.now()});
    if(window.YLEdiciones)window.YLEdiciones.olvidarCopia();
  }catch(e){console.warn('[edits] no se pudo marcar la versión:',e.message);}
}

// Guarda el overlay completo del atleta en athlete_edits (snapshot de campos editables)
async function _saveEdit(a){
  const docId=_editDocId(a);
  await setDoc(doc(db,'athlete_edits',docId),{
    rut:a.rut||'', codigo:a.codigo||'', nombre:a.nombre||'',
    club:a.club||'', debut:a.debut||'', sexo:a.sexo||'',
    fechaNac:a.fechaNac||a.fecha_nac||'', zona:a.zona||'', comuna:a.comuna||'',
    deleted:false,
    ts:Date.now()
  },{merge:true});
  await _marcarEdicion();
}

// ── El club viaja de la inscripción a la ficha del atleta ────────────────────
// El club de alguien cambia: se va a otro y se inscribe con el nuevo. Ese dato
// se quedaba SOLO en la inscripción y la ficha seguía diciendo el club viejo.
// Peor: el formulario de inscripción PROPONE el club que dice la ficha, así que
// en la inscripción siguiente volvía a salir el antiguo y había que corregirlo
// otra vez. Lo mismo si el club se corrige a mano en la nómina.
//
// El cruce es por RUT y nunca por nombre, por lo mismo de siempre: el nombre de
// la inscripción lo escribe la persona y el del padrón viene de la federación, y
// no coinciden en tildes ni en el orden de los apellidos.
//
// No inventa fichas. Si el RUT no está en el padrón —un extranjero, alguien que
// compite por primera vez y todavía no tiene código— no toca nada: escribirle el
// club a quien no corresponde es peor que dejarlo sin actualizar.
function _clubDeInscripcion(ins){
  const c=String((ins&&ins.club)||'').trim();
  return /^otro$/i.test(c) ? String((ins&&ins.clubOtro)||'').trim() : c;
}

// Devuelve {nombre, antes, ahora, atleta} si la ficha cambió, o null si no había
// nada que hacer. El que llama decide qué avisar y cómo deshacerlo.
async function _clubAlPadron(ins){
  try{
    const nuevo=_clubDeInscripcion(ins);
    if(!nuevo)return null;
    const rut=String((ins&&ins.rut)||'').replace(/[^0-9kK]/gi,'').toUpperCase();
    if(!rut)return null;
    const a=(ST.data||[]).find(x=>String(x.rut||'').replace(/[^0-9kK]/gi,'').toUpperCase()===rut);
    if(!a)return null;
    if(_clubIgual(a.club,nuevo))return null;
    const antes=a.club||'';
    a.club=nuevo;
    await _saveEdit(a);
    await logAction('club_desde_inscripcion',a.codigo||rut,antes,nuevo,
      {nombre:a.nombre||'',evento:(ins&&ins.evento)||''});
    return {nombre:a.nombre||ins.nombre||'',antes,ahora:nuevo,atleta:a};
  }catch(e){ console.warn('[club→ficha]',e.message); return null; }
}

// Deshacer lo anterior, para que el "revertir" de un toast devuelva las dos cosas.
async function _clubAlPadronRevertir(sync){
  if(!sync||!sync.atleta)return;
  try{ sync.atleta.club=sync.antes; await _saveEdit(sync.atleta); }
  catch(e){ console.warn('[club→ficha] revertir',e.message); }
}

window.editAthlete=async function(cod,field){
  const a=ST.data.find(x=>x.codigo===cod);if(!a)return;
  const cur=a[field]||'';
  openEditModal(`Editar ${field} de ${a.nombre}`,field,cur,async(nv)=>{
    if(nv===cur)return;
    const old=cur;
    a[field]=nv;
    try{
      // El código también se puede corregir a mano desde acá, no solo con el
      // botón de arreglar código. La foto tiene que irse con él igual.
      if(field==='codigo')await _mudarFoto(old,nv);
      await _saveEdit(a);   // guarda snapshot completo indexado por RUT
      await logAction('edit_athlete',`${a.codigo}.${field}`,old,nv,{nombre:a.nombre});
      render();
      showToast(`${field} actualizado: ${a.nombre}`,async()=>{
        a[field]=old;
        await _saveEdit(a);
        await logAction('undo_edit_athlete',`${a.codigo}.${field}`,nv,old,{nombre:a.nombre});
        render();showToast('Cambio revertido');
      });
    }catch(e){console.error(e);a[field]=old;render();showToast('Error: '+e.message,null,true)}
  });
}

function generarCodigo(a){
  const rut=String(a.rut||'').replace(/[^0-9]/g,'');
  const nombre=String(a.nombre||'').trim();
  const debut=String(a.debut||'').match(/\d{4}/)?.[0]||'';
  if(!rut||!nombre||!debut)return null;
  const digits=rut.slice(0,4).padEnd(4,'0');
  const partes=nombre.split(/\s+/).filter(Boolean);
  // La inicial va SIN tilde. Camila Fernanda Álvarez Carrasco daba "2095CÁC-2024",
  // con la Á adentro: un código con tilde no calza con el que se vuelve a generar
  // en otro momento, no se puede escribir a mano y rompe el formato que el resto
  // del panel valida. Su foto de perfil quedó colgando de ese código y no la
  // encontraba nadie. Pasa con Álvarez, Ávila, Óscar, Íñiguez, Ñuñez.
  const sinTilde=c=>String(c||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const inicial=p=>sinTilde((p||'')[0])||'X';
  const ini0=inicial(partes[0]);
  // Apellidos = últimas 2 palabras
  const ini1=inicial(partes.length>=2?partes[partes.length-2]:partes[0]);
  const ini2=inicial(partes[partes.length-1]);
  return `${digits}${ini0}${ini1}${ini2}-${debut}`;
}

// La foto de perfil se guarda en atleta_fotos con el CÓDIGO como identificador
// del documento. Si al atleta se le corrige el código, la foto se queda apuntando
// al viejo y no la encuentra nadie nunca más: hay 35 fotos así, subidas y
// perdidas. Acá la foto se muda junto con el código.
async function _mudarFoto(oldCod,newCod){
  if(!oldCod||!newCod||oldCod===newCod)return;
  try{
    const vieja=await getDoc(doc(db,'atleta_fotos',oldCod));
    if(!vieja.exists())return;
    const d=vieja.data();
    await setDoc(doc(db,'atleta_fotos',newCod),{...d,codigo:newCod},{merge:true});
    await deleteDoc(doc(db,'atleta_fotos',oldCod));
    await logAction('mover_foto',oldCod,oldCod,newCod);
  }catch(e){console.warn('[foto] no se pudo mudar:',e.message);}
}

async function _applyCodigoFix(a,oldCod,newCod,newRut){
  try{
    // Si el RUT cambia, el docId (basado en RUT) también cambia → borrar el viejo
    const oldDocId=_editDocId(a);
    a.codigo=newCod;
    if(newRut)a.rut=newRut;
    const newDocId=_editDocId(a);
    if(oldDocId!==newDocId){try{await deleteDoc(doc(db,'athlete_edits',oldDocId))}catch(_){}}
    await _mudarFoto(oldCod,newCod);
    await _saveEdit(a);   // snapshot completo indexado por RUT
    await logAction('fix_codigo',oldCod,oldCod,newCod,{nombre:a.nombre,rut:a.rut||''});
    render();
    showToast('Código corregido: '+newCod);
  }catch(e){a.codigo=oldCod;showToast('Error: '+e.message,null,true);}
}

window.fixCodigoAuto=async function(cod){
  const a=ST.data.find(x=>x.codigo===cod);if(!a)return;
  if(!a.rut){
    openEditModal('RUT de '+a.nombre+' (sin puntos ni guión, ej: 123456787)','rut','',async(newRut)=>{
      if(!newRut)return;
      a.rut=newRut;
      const newCod=generarCodigo(a);
      if(!newCod){showToast('No se pudo generar — falta nombre o debut',null,true);return;}
      if(!confirm('Cambiar código de:\n"'+cod+'"\na:\n"'+newCod+'"'))return;
      await _applyCodigoFix(a,cod,newCod,newRut);
    });
  }else{
    const newCod=generarCodigo(a);
    if(!newCod){showToast('No se pudo generar — falta RUT, nombre o debut',null,true);return;}
    if(!confirm('Cambiar código de:\n"'+cod+'"\na:\n"'+newCod+'"'))return;
    await _applyCodigoFix(a,cod,newCod,null);
  }
};

window.deleteAthlete=async function(cod){
  const a=ST.data.find(x=>x.codigo===cod);if(!a)return;
  // La baja se guarda en Firestore y el sitio la respeta solo. No hay que
  // exportar ni volver a publicar data.json — el cartel decía lo contrario y era
  // mentira: quien exportaba y subía el archivo estaba haciendo trabajo de más.
  if(!confirm(`¿Eliminar a ${a.nombre} (${cod})?\n\nSe da de baja en el sitio: deja de aparecer en el buscador, el ranking, las inscripciones y la ficha de atleta.\nSe puede deshacer.`))return;
  const idx=ST.data.indexOf(a);
  ST.data.splice(idx,1);
  try{
    // El MISMO identificador que usan las ediciones. Antes la baja iba al
    // código pelado y la edición al RUT, así que la misma persona terminaba con
    // dos documentos que se contradecían y ninguno mandaba sobre el otro.
    const docId=_editDocId(a);
    await setDoc(doc(db,'athlete_edits',docId),
      {rut:a.rut||'',codigo:cod,deleted:true,nombre:a.nombre,ts:Date.now()},{merge:true});
    await _marcarEdicion();
    await logAction('delete_athlete',cod,a.nombre,'deleted',{club:a.club||''});
  }catch(e){console.warn('Delete log failed',e)}
  render();
  showToast(`${a.nombre} dado de baja`,async()=>{
    ST.data.splice(idx,0,a);
    try{
      await _saveEdit(a);   // vuelve con fecha más nueva: el sitio lo restituye
      await logAction('undo_delete_athlete',cod,'deleted',a.nombre);
    }catch(e){}
    render();showToast('Restaurado');
  });
}

// ═══════════════════════════════════════════
// LOGROS / MEDALLAS DE ATLETAS
// ═══════════════════════════════════════════
window.addAchievement=async function(codigo){
  if(!['superadmin','owner'].includes(ST.adminInfo?.role)){showToast('Solo superadmin puede agregar logros',null,true);return;}
  const label=(document.getElementById('achLabel')?.value||'').trim();
  const evento=(document.getElementById('achEvento')?.value||'').trim();
  const logo_url=(document.getElementById('achLogoUrl')?.value||'').trim();
  const anio=parseInt(document.getElementById('achAnio')?.value||'0',10)||null;
  const color=document.getElementById('achColor')?.value||'#D4A843';
  const display=document.getElementById('achDisplay')?.value||'medal';
  if(!label){showToast('Ingresa una etiqueta para el logro',null,true);return;}
  const existing=ST.achievementsByCodigo?.[codigo]||[];
  const updated=[...existing,{label,evento,logo_url,anio,color,display}];
  try{
    await setDoc(doc(db,'atleta_achievements',codigo),{codigo,achievements:updated});
    ST.achievementsByCodigo=ST.achievementsByCodigo||{};
    ST.achievementsByCodigo[codigo]=updated;
    const ath=(ST.data||[]).find(a=>a.codigo===codigo);
    if(ath)ath.achievements=updated;
    showToast('Logro guardado para '+codigo);
    render();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

window.removeAchievement=async function(codigo,idx){
  if(!['superadmin','owner'].includes(ST.adminInfo?.role)){showToast('Solo superadmin puede eliminar logros',null,true);return;}
  if(!confirm('¿Eliminar este logro?'))return;
  const existing=ST.achievementsByCodigo?.[codigo]||[];
  const updated=existing.filter((_,i)=>i!==idx);
  try{
    await setDoc(doc(db,'atleta_achievements',codigo),{codigo,achievements:updated});
    ST.achievementsByCodigo=ST.achievementsByCodigo||{};
    ST.achievementsByCodigo[codigo]=updated;
    const ath=(ST.data||[]).find(a=>a.codigo===codigo);
    if(ath)ath.achievements=updated;
    showToast('Logro eliminado');
    render();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

// ═══════════════════════════════════════════
// EDIT REQUESTS (solicitudes de edición de atletas)
// ═══════════════════════════════════════════
// El atleta crea un doc en edit_requests con RUT+PIN+cambios. Acá el admin
// valida el PIN contra inscripciones_private y aplica los cambios.
window.approveEditRequest=async function(reqId){
  reqId=decodeURIComponent(reqId);
  const req=ST.editRequests.find(r=>r.id===reqId);if(!req)return;
  const priv=ST.inscripcionesPrivate[req.inscripcionId];
  if(!priv){
    if(!confirm(`No encontramos el doc privado para ${req.inscripcionId}. ¿Aplicar los cambios SIN validar el PIN? (úsalo solo si verificaste la identidad por otro medio)`))return;
  }else if(priv.pin!==req.pin){
    if(!confirm(`El PIN enviado (${req.pin}) NO coincide con el registrado. ¿Aplicar igual los cambios? (úsalo solo si verificaste la identidad por otro medio)`))return;
  }
  try{
    // Aplicar cambios al doc público (solo campos permitidos).
    const allowed=['nombre','codigo','sexo','fechaNac','division','categoria','modalidad','club','clubOtro','comuna','universidad'];
    const updates={};
    for(const k of allowed){if(req.changes&&req.changes[k]!==undefined)updates[k]=req.changes[k];}
    if(Object.keys(updates).length){
      await updateDoc(doc(db,'inscripciones',req.inscripcionId),updates);
    }
    await deleteDoc(doc(db,'edit_requests',reqId));
    await logAction('approve_edit_request',req.inscripcionId,JSON.stringify(updates).substring(0,200),'applied',{rut:req.rut});
    // Si el atleta pidió corregir su club, la ficha se corrige con él.
    let sync=null;
    if(updates.club!==undefined||updates.clubOtro!==undefined){
      const ins=(ST.inscripciones||[]).find(x=>x.id===req.inscripcionId)||{rut:req.rut};
      sync=await _clubAlPadron({...ins,...updates});
    }
    showToast('Solicitud aplicada'+(sync?' · y su ficha también':''));
  }catch(e){showToast('Error: '+e.message,null,true)}
}

window.rejectEditRequest=async function(reqId){
  reqId=decodeURIComponent(reqId);
  const req=ST.editRequests.find(r=>r.id===reqId);if(!req)return;
  if(!confirm(`¿Rechazar la solicitud de edición de ${req.rut}?`))return;
  try{
    await deleteDoc(doc(db,'edit_requests',reqId));
    await logAction('reject_edit_request',req.inscripcionId,req.rut,'rejected');
    showToast('Solicitud rechazada');
  }catch(e){showToast('Error: '+e.message,null,true)}
}

// Helper de migración one-shot: copia pin/carnetURL/wadeURL de inscripciones
// viejas a inscripciones_private y limpia el doc público. Correr UNA VEZ
// desde consola tras deploy de reglas nuevas:
//   await migrateToPrivateCollection()
window.migrateToPrivateCollection=async function(){
  if(!ST.user) throw new Error('Debes estar autenticado como admin.');
  let migrated=0,skipped=0,errors=0;
  for(const ins of ST.inscripciones){
    const priv={};
    if(ins.pin)priv.pin=String(ins.pin);
    if(ins.carnetURL)priv.carnetURL=ins.carnetURL;
    if(ins.wadeURL)priv.wadeURL=ins.wadeURL;
    if(!Object.keys(priv).length){skipped++;continue;}
    priv.ts=serverTimestamp();
    try{
      // Escribir doc privado (merge para no pisar si ya existe).
      await setDoc(doc(db,'inscripciones_private',ins.id),priv,{merge:true});
      // Limpiar campos sensibles del doc público.
      const cleanup={};
      if(ins.pin!==undefined)cleanup.pin=deleteField();
      if(ins.carnetURL!==undefined)cleanup.carnetURL=deleteField();
      if(ins.wadeURL!==undefined)cleanup.wadeURL=deleteField();
      await updateDoc(doc(db,'inscripciones',ins.id),cleanup);
      migrated++;
    }catch(e){errors++;console.warn('migrate fail',ins.id,e.message);}
  }
  await logAction('migrate_private',null,null,`migrated=${migrated} skipped=${skipped} errors=${errors}`);
  console.log(`Migración: ${migrated} movidos, ${skipped} omitidos (sin campos sensibles), ${errors} errores.`);
  return {migrated,skipped,errors};
}

// ═══════════════════════════════════════════════════════════
// PERFIL ATLETA (admin — incluye RUT + análisis avanzado)
// ═══════════════════════════════════════════════════════════

window.openAthleteProfile = function(codigo){
  ST.athleteProfile = codigo;
  go('athleteProfile');
};

// ═══════════════════════════════════════════
// AGREGAR / ELIMINAR COMPETENCIAS A ATLETAS (owner) — guardado en vivo
// ═══════════════════════════════════════════
// Un solo cálculo de GL en todo el panel. Antes esta función solo miraba
// classic/equipado y NUNCA la banca sola: a un Only Bench —classic o equipado—
// le aplicaba los coeficientes de powerlifting completo, que son otra escala.
function _glPoints(total,bw,sex,modalidad){
  return _calcGL(total,bw,modalidad,sex);
}

function _dotsPoints(total,bw,sex){
  if(!total||!bw)return 0;
  const fem=/muj|fem/i.test(sex||'');
  const c=fem?[-57.96288,13.6175032,-0.1126655495,0.0005158568,-0.0000010706]
             :[-307.75076,24.0900756,-0.1918759221,0.0007391293,-0.000001093];
  const den=c[0]+c[1]*bw+c[2]*bw*bw+c[3]*bw**3+c[4]*bw**4;
  if(!den)return 0;
  return +(total*500/den).toFixed(2);
}

function _bestLift(pfx){
  let best=0;
  for(let i=1;i<=3;i++){
    const el=document.getElementById('cm_'+pfx+i); const ev=document.getElementById('cm_'+pfx+i+'v');
    if(!el)continue; const w=parseFloat(el.value)||0; const v=ev?ev.checked:true;
    if(v&&w>best)best=w;
  }
  return best;
}

window.compRecalc=function(){
  const sq=_bestLift('sq'),bp=_bestLift('bp'),dl=_bestLift('dl'),total=sq+bp+dl;
  const bw=parseFloat(document.getElementById('cm_bw').value)||0;
  const sex=document.getElementById('cm_sex').value, mod=document.getElementById('cm_mod').value;
  const dq=document.getElementById('cm_dq')?.checked;
  const gl=dq?0:_glPoints(total,bw,sex,mod), dots=dq?0:_dotsPoints(total,bw,sex);
  const out=document.getElementById('cm_out');
  if(out)out.innerHTML='SQ <b>'+(sq||'-')+'</b> · BP <b>'+(bp||'-')+'</b> · DL <b>'+(dl||'-')+'</b> &nbsp;|&nbsp; '
    +(dq
      ? 'Total oficial <b style="color:var(--red)">DQ</b> <span style="color:var(--muted);font-size:11px">('+(total||0)+' kg levantados)</span>'
      : 'Total <b style="color:var(--gold)">'+(total||'-')+'</b> kg &nbsp;|&nbsp; GL <b style="color:var(--gold)">'+(gl||'-')+'</b> &nbsp;|&nbsp; DOTS <b>'+(dots||'-')+'</b>');
};

window.compAthPick=function(v){
  const m=(ST.data||[]).find(a=>a.nombre===v)||(ST.data||[]).find(a=>(a.nombre||'').toLowerCase()===(v||'').toLowerCase());
  document.getElementById('cm_codigo').value=m?m.codigo||'':'';
  document.getElementById('cm_rut').value=m?m.rut||'':'';
  if(m){const sx=(m.competencias||[]).map(c=>c.sexo).find(Boolean);if(sx)document.getElementById('cm_sex').value=/muj|fem/i.test(sx)?'Mujer':'Hombre';}
};

window.openCompModal=function(codigo){
  const a=codigo?(ST.data||[]).find(x=>x.codigo===codigo):null;
  const dlist=(ST.data||[]).map(x=>`<option value="${esc(x.nombre)}">`).join('');
  const lift=(pfx,label)=>`<div style="margin-bottom:8px"><div style="font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-bottom:3px">${label}</div><div style="display:flex;gap:6px">`+
    [1,2,3].map(i=>`<div style="flex:1;display:flex;align-items:center;gap:4px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:4px 6px"><input id="cm_${pfx}${i}" type="number" step="0.5" placeholder="${i}°" oninput="compRecalc()" style="width:100%;background:transparent;border:none;color:var(--text);font-size:13px;outline:none"><input id="cm_${pfx}${i}v" type="checkbox" checked onchange="compRecalc()" title="válido"></div>`).join('')+`</div></div>`;
  const ov=document.createElement('div'); ov.id='compModal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto';
  ov.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;max-width:540px;width:100%;padding:22px">
    <div style="font-family:Oswald;font-size:19px;font-weight:700;margin-bottom:4px">Agregar competencia</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:14px">Elige un atleta cargado o escribe un nombre manual. Marca el check de cada intento válido.</div>
    <input list="cm_athDL" id="cm_ath" value="${esc(a?a.nombre:'')}" oninput="compAthPick(this.value)" placeholder="Atleta" class="inp" style="width:100%;margin-bottom:8px">
    <datalist id="cm_athDL">${dlist}</datalist>
    <input id="cm_codigo" type="hidden" value="${esc(a?a.codigo:'')}"><input id="cm_rut" type="hidden" value="${esc(a?a.rut:'')}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <input id="cm_evento" placeholder="Campeonato" class="inp">
      <input id="cm_fecha" type="date" class="inp">
      <select id="cm_mod" class="inp" onchange="compRecalc()"><option>Powerlifting Classic</option><option>Powerlifting Equipado</option><option>Only Bench</option></select>
      <select id="cm_sex" class="inp" onchange="compRecalc()"><option>Hombre</option><option>Mujer</option></select>
      <input id="cm_div" placeholder="División (ej: Open)" class="inp">
      <input id="cm_cat" placeholder="Categoría (ej: 83)" class="inp">
      <input id="cm_bw" type="number" step="0.1" placeholder="Peso corporal (kg)" oninput="compRecalc()" class="inp" style="grid-column:span 2">
      <input id="cm_pos" type="number" step="1" min="1" placeholder="Posición obtenida (1°, 2°, 3°...) — opcional" class="inp" style="grid-column:span 2">
      <label style="grid-column:span 2;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--red);cursor:pointer;padding:8px 10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px">
        <input id="cm_dq" type="checkbox" onchange="compRecalc()"> Descalificado (DQ) — 3 fallos en algún lift. El total oficial queda en 0, pero se guarda lo que sí levantó.
      </label>
    </div>
    ${lift('sq','SENTADILLA')}${lift('bp','BANCA')}${lift('dl','PESO MUERTO')}
    <div id="cm_out" style="margin:10px 0;font-size:13px;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px">—</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button onclick="closeCompModal()" class="btn" style="background:transparent;border:1px solid var(--border);color:var(--muted)">Cancelar</button>
      <button onclick="saveCompResult()" class="btn btn-g">Guardar</button>
    </div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)closeCompModal();});
  document.body.appendChild(ov);
  if(a){const sx=(a.competencias||[]).map(c=>c.sexo).find(Boolean);if(sx&&/muj|fem/i.test(sx))document.getElementById('cm_sex').value='Mujer';}
  compRecalc();
};

window.closeCompModal=function(){const m=document.getElementById('compModal');if(m)m.remove();};

window.saveCompResult=async function(){
  const g=id=>document.getElementById(id);
  const nombre=(g('cm_ath').value||'').trim();
  if(!nombre){showToast('Falta el atleta',null,true);return;}
  const evento=(g('cm_evento').value||'').trim();
  if(!evento){showToast('Falta el campeonato',null,true);return;}
  const codigo=(g('cm_codigo').value||'').trim(), rut=(g('cm_rut').value||'').trim();
  const fecha=g('cm_fecha').value||'', division=(g('cm_div').value||'').trim(), categoria=(g('cm_cat').value||'').trim();
  const modalidad=g('cm_mod').value, sexo=g('cm_sex').value, bw=parseFloat(g('cm_bw').value)||0;
  const posicion=parseInt(g('cm_pos').value,10)||null; // posición fijada a mano (prioriza sobre la calculada)
  const dq=g('cm_dq')?.checked||false;
  const sq=_bestLift('sq'),bp=_bestLift('bp'),dl=_bestLift('dl'),liftedTotal=sq+bp+dl;
  const total=dq?0:liftedTotal; // igual que livecast: el total oficial queda en 0 si DQ
  const glp=dq?0:_glPoints(total,bw,sexo,modalidad), dots=dq?0:_dotsPoints(total,bw,sexo);
  const att=pfx=>{const arr=[];for(let i=1;i<=3;i++){const w=parseFloat(g('cm_'+pfx+i).value)||0;const v=g('cm_'+pfx+i+'v').checked;if(w)arr.push({w,r:v?'g':'n'});}return arr;};
  const slug=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,40);
  const docId=(codigo||('m_'+slug(nombre)))+'__'+slug(evento)+'__'+slug(modalidad||'cl');
  try{
    await setDoc(doc(db,'competition_results',docId),{
      codigo,rut,nombre,evento,fecha,sexo,division,categoria,modalidad,
      posicion: posicion!=null ? posicion : deleteField(),
      resultado:{sq,bp,dl,total,bw,pesoCorporal:bw,glp,dots,status:dq?'DQ':'OK',intentos:{sq:att('sq'),bp:att('bp'),dl:att('dl')}},
      source:'manual', addedBy:(ST.user?.email||'admin'), updatedAt:serverTimestamp()
    },{merge:true});
    await logAction('add_comp_result',docId,null,evento+' · '+(dq?'DQ ('+liftedTotal+'kg levantados)':total+'kg')+(dq?'':' · GL '+glp),{nombre});
    showToast(dq?('Competencia guardada: '+nombre+' · DQ'):('Competencia guardada: '+nombre+' · '+total+'kg'));
    closeCompModal();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

window.deleteCompResult=async function(id){
  if(!confirm('¿Eliminar esta competencia del atleta?\n(Quita solo lo agregado en vivo, no afecta data.json)'))return;
  try{ await deleteDoc(doc(db,'competition_results',id)); await logAction('delete_comp_result',id,null,'deleted'); showToast('Competencia eliminada'); }
  catch(e){showToast('Error: '+e.message,null,true);}
};

// Corrige la categoría o la división de un resultado ya guardado.
//
// Antes solo se podía editar la posición: si la categoría se escribía mal al
// cargar la competencia, la única salida era volver a agregarla entera —con los
// nueve intentos— o entrar a Firestore a mano. Pasó con el Mundial de Josefa Soto
// Arcos, que quedó en 67 siendo 57.
//
// No toca los GL Points: dependen del peso corporal y del total, no de la
// categoría, así que corregirla no invalida nada de lo que ya está calculado.
window.setCompCampo=async function(id,campo,val){
  if(campo!=='categoria'&&campo!=='division')return;
  const v=String(val||'').trim();
  try{
    await updateDoc(doc(db,'competition_results',id), {[campo]:v, updatedAt:serverTimestamp()});
    await logAction('set_comp_'+campo,id,null,campo+'='+v);
    showToast((campo==='categoria'?'Categoría':'División')+' corregida: '+(v||'(vacía)'));
  }catch(e){showToast('Error: '+e.message,null,true);}
};

// Fija/edita la posición de una competencia ya agregada. Vacío = se borra y vuelve a calcularse sola.
window.setCompPos=async function(id,val){
  const p=parseInt(val,10);
  try{
    await updateDoc(doc(db,'competition_results',id), {posicion: (p>0? p : deleteField()), updatedAt:serverTimestamp()});
    await logAction('set_comp_pos',id,null,'pos='+(p>0?p:'(auto)'));
    showToast(p>0?('Posición fijada: '+p+'°'):'Posición vuelta a automática');
  }catch(e){showToast('Error: '+e.message,null,true);}
};

window.setHistPos=async function(codigo,evento,modalidad,val){
  const p=parseInt(val,10);
  const docId=codigo+'__'+_histSlug(evento)+(modalidad?'__'+_histSlug(modalidad):'');
  try{
    await setDoc(doc(db,'comp_pos_overrides',docId),{codigo,evento,modalidad:modalidad||'',posicion:p>0?p:deleteField(),updatedAt:serverTimestamp()},{merge:true});
    showToast(p>0?('Posición fijada: '+p+'°'):'Posición eliminada');
  }catch(e){showToast('Error: '+e.message,null,true);}
};

function renderAthleteProfile(){
  const a = ST.data?.find(x=>x.codigo===ST.athleteProfile);
  if(!a) return '<div class="h1">Atleta no encontrado</div>';

  const bl = a.bestLifts||{};
  const allComps = a.competencias||[];
  const withResults = allComps.filter(c=>c.resultado&&c.resultado.total>0);
  const sorted = [...withResults].sort((x,y)=>(y.fecha||y.evento||'').localeCompare(x.fecha||x.evento||''));

  // Sex
  const sexRaw = [...allComps].sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||'')).find(c=>c.sexo)?.sexo||'';
  const isFem = sexRaw.match(/mujer|fem/i);

  // Churn
  const lastFecha = allComps.filter(c=>c.fecha).sort((x,y)=>y.fecha.localeCompare(x.fecha))[0]?.fecha||null;
  const monthsSince = lastFecha?Math.floor((Date.now()-new Date(lastFecha))/(1000*60*60*24*30.4)):null;
  const churnRisk = monthsSince&&monthsSince>14;

  // GL history
  const lastModal=(sorted[0]?.modalidad||'').toLowerCase().includes('equip')?'equipped':'classic';
  const glHistory = [...withResults]
    .filter(c=>{
      const m=(c.modalidad||'').toLowerCase().includes('equip')?'equipped':'classic';
      return m===lastModal&&(c.resultado?.glp||c.resultado?.gl);
    })
    .sort((x,y)=>(x.fecha||x.evento||'').localeCompare(y.fecha||y.evento||''));

  // Peer comparison
  const peerKey = _getPeerKey(a);
  const peer = peerKey&&bl.total?_peerPerc(bl.total,peerKey):null;
  const pg = peer?.g;

  // Active inscriptions
  const activeInsc = ST.inscripciones.filter(i=>{
    if(i.status==='rejected')return false;
    return (i.nombre||'').toLowerCase().trim()===(a.nombre||'').toLowerCase().trim()||(i.codigo&&i.codigo===a.codigo);
  });

  const initials = a.nombre.split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase();

  let h = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
    <button onclick="ST.athleteProfile=null;go('athletes')" style="background:transparent;border:none;color:var(--muted);font-size:13px;cursor:pointer;padding:0;font-family:DM Sans">← Atletas</button>
    <span style="color:var(--border)">|</span>
    <span style="font-size:12px;color:var(--muted)">${a.codigo}</span>
  </div>`;

  // ── Header card ──────────────────────────────────────────
  h+=`<div class="card" style="border-left:4px solid var(--accent);margin-bottom:14px">
    <div style="display:flex;gap:14px;align-items:flex-start">
      <div style="width:64px;height:64px;border-radius:12px;background:var(--bg);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span class="os" style="font-size:24px;font-weight:700;color:var(--muted)">${initials}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div class="os" style="font-size:22px;font-weight:700;letter-spacing:1px">${a.nombre}</div>
        <div style="font-size:13px;color:var(--gold);font-family:Oswald">${a.codigo}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">
          RUT: <strong style="color:var(--text)">${a.rut||'—'}</strong>
          &nbsp;·&nbsp; Club: <strong style="color:var(--text)">${a.club||'—'}</strong>
          &nbsp;·&nbsp; Debut: <strong style="color:var(--text)">${a.debut||'—'}</strong>
        </div>
        ${churnRisk?`<div style="margin-top:8px;padding:7px 11px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:7px;font-size:11px;color:var(--gold)">Sin competir ${monthsSince} meses — posible churn</div>`:''}
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          ${sexRaw?`<span class="tag ${isFem?'b-r':'b-b'}">${isFem?'Mujer':'Hombre'}</span>`:''}
          <span class="tag b-y">${allComps.length} competencia${allComps.length!==1?'s':''}</span>
          ${withResults.length?`<span class="tag b-g">${withResults.length} resultado${withResults.length!==1?'s':''}</span>`:''}
          ${activeInsc.length?`<span class="tag b-b">${activeInsc.length} inscripción${activeInsc.length!==1?'es':''} activa${activeInsc.length!==1?'s':''}</span>`:''}
        </div>
      </div>
      <button onclick="editAthlete('${a.codigo.replace(/'/g,"\\'")}','nombre')" style="padding:6px 12px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer;flex-shrink:0">Editar</button>
    </div>
  </div>`;

  // ── Competencias en vivo (agregar / eliminar) — solo owner ───
  const _canComp=['owner','superadmin'].includes(ST.adminInfo?.role)||ST.adminInfo?.bootstrap;
  if(_canComp){
    const rnorm=s=>String(s||'').replace(/[^0-9kK]/g,'').toLowerCase();
    const mine=(ST.allCompResults||[]).filter(r=>
      (a.codigo&&r.codigo===a.codigo) ||
      (a.rut&&r.rut&&rnorm(r.rut)===rnorm(a.rut)) ||
      (r.nombre&&(r.nombre||'').toLowerCase().trim()===(a.nombre||'').toLowerCase().trim())
    );
    h+=`<div class="card" style="margin-bottom:14px;border-left:4px solid var(--green)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-family:Oswald;font-size:14px;font-weight:700;letter-spacing:1px;color:var(--green)">COMPETENCIAS (en vivo)</div>
        <button onclick="openCompModal('${a.codigo.replace(/'/g,"\\'")}')" class="btn btn-g" style="padding:6px 12px;font-size:11px">+ Agregar competencia</button>
      </div>
      ${mine.length?`<table class="tbl"><tr><th>Campeonato</th><th>Cat/Div</th><th>Total</th><th>GL</th><th title="Posición obtenida — déjalo vacío para que se calcule sola">Pos</th><th></th></tr>
        ${mine.map(r=>`<tr>
          <td>${esc(r.evento||'')}<br><span style="font-size:9px;color:var(--muted)">${esc(r.fecha||'')} · ${esc(r.modalidad||'')}${r.source==='manual'?' · manual':''}</span></td>
          <td style="font-size:11px;white-space:nowrap">
            <input value="${esc(r.categoria||'')}" onchange="setCompCampo('${(r.id||'').replace(/'/g,"\\'")}','categoria',this.value)" title="Categoría de peso" style="width:46px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:3px 5px;font-size:11px;text-align:center">
            <input value="${esc(r.division||'')}" onchange="setCompCampo('${(r.id||'').replace(/'/g,"\\'")}','division',this.value)" title="División" style="width:78px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:3px 5px;font-size:11px">
          </td>
          <td style="font-weight:700">${r.resultado?.total||'-'}</td>
          <td>${r.resultado?.glp||r.resultado?.gl||'-'}</td>
          <td><input type="number" min="1" value="${r.posicion!=null?r.posicion:''}" placeholder="auto" onchange="setCompPos('${(r.id||'').replace(/'/g,"\\'")}',this.value)" title="Posición obtenida (1°, 2°...). Vacío = calculada automáticamente." style="width:52px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:3px 5px;font-size:11px;text-align:center"></td>
          <td><button onclick="deleteCompResult('${(r.id||'').replace(/'/g,"\\'")}')" style="background:transparent;border:1px solid rgba(239,68,68,.4);color:var(--red);padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer">Eliminar</button></td>
        </tr>`).join('')}
      </table>`:'<div style="font-size:12px;color:var(--muted)">Sin competencias agregadas en vivo. Usa “+ Agregar competencia”.</div>'}
      <div style="font-size:10px;color:var(--muted);margin-top:8px">Se guardan en vivo y aparecen al instante en el perfil público (yourlift.cl/atleta). El total, GL e IPF/DOTS se calculan solos desde los intentos válidos y el peso corporal. La columna <strong>Pos</strong> fija la posición a mano (vacío = se calcula sola). Eliminar quita solo lo agregado aquí.</div>
    </div>`;

  // ── Posiciones históricas (data.json) ──
  const _mineEvts=new Set(mine.map(r=>(r.evento||'')+'|'+(r.modalidad||'')));
  const _hist=(a.competencias||[]).filter(c=>(c.resultado?.total||0)>0&&c.resultado?.intentos&&!_mineEvts.has((c.evento||'')+'|'+(c.modalidad||'')));
  if(_hist.length){
    const _iStyle='width:52px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:3px 5px;font-size:11px;text-align:center';
    h+=`<div class="card" style="margin-bottom:14px;border-left:4px solid #6366f1">
      <div style="font-family:Oswald;font-size:14px;font-weight:700;letter-spacing:1px;color:#6366f1;margin-bottom:10px">POSICIONES HISTÓRICAS</div>
      <table class="tbl"><tr><th>Campeonato</th><th>Total</th><th>GL</th><th title="Posición en categoría">Pos. Cat.</th></tr>
      ${_hist.map(c=>`<tr>
        <td>${esc(c.evento||'')}<br><span style="font-size:9px;color:var(--muted)">${esc(c.fecha||'')} · ${esc(c.modalidad||'')} · ${esc(c.division||'')} ${esc(c.categoria||'')}</span></td>
        <td style="font-weight:700">${c.resultado?.total||'—'}</td>
        <td>${c.resultado?.glp||'—'}</td>
        <td><input type="number" min="1" value="${c.posicion!=null?c.posicion:(c.place||c.resultado?.rank||'')}" placeholder="—" onchange="setHistPos('${esc(a.codigo)}','${esc(c.evento||'')}','${esc(c.modalidad||'')}',this.value)" title="Posición en categoría" style="${_iStyle}"></td>
      </tr>`).join('')}
      </table>
      <div style="font-size:10px;color:var(--muted);margin-top:8px">Historial del atleta en data.json. Fija la posición o pos. GL y aparecerá al instante en el perfil público.</div>
    </div>`;
  }
  }

  // ── Logros / Medallas ────────────────────────────────────
  const _canAch=['superadmin','owner'].includes(ST.adminInfo?.role);
  const achList=ST.achievementsByCodigo?.[a.codigo]||[];
  h+=`<div class="card" style="margin-bottom:14px;border-left:4px solid #D4A843">
    <div style="font-family:Oswald;font-size:14px;font-weight:700;letter-spacing:1px;color:#D4A843;margin-bottom:12px">LOGROS Y MEDALLAS</div>
    ${achList.length===0?'<div style="font-size:12px;color:var(--muted);margin-bottom:12px">Sin logros registrados</div>':''}
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${achList.map((ach,i)=>{
        const col=ach.color||'#D4A843';
        return `<div style="position:relative;background:var(--bg);border:1px solid ${col}55;border-radius:10px;padding:10px 12px;display:flex;gap:10px;align-items:center;min-width:220px">
          ${ach.logo_url?`<img src="${ach.logo_url}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid ${col}" onerror="this.style.display='none'">`:'<div style="width:48px;height:48px;border-radius:50%;background:rgba(212,168,67,.15);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0"></div>'}
          <div style="flex:1;min-width:0">
            <div style="font-family:Oswald;font-size:12px;color:${col};letter-spacing:.5px">${ach.label||'—'}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px">${ach.evento||''} ${ach.anio?'· '+ach.anio:''}</div>
            <div style="font-size:9px;color:var(--muted);margin-top:2px;opacity:.7">${ach.display==='verified'?'<i class=yl-i-check></i> Badge verificado':'Medalla'}</div>
          </div>
          ${_canAch?`<button onclick="removeAchievement('${a.codigo}',${i})" style="background:transparent;border:none;color:var(--red);font-size:14px;cursor:pointer;padding:2px 4px;flex-shrink:0" title="Eliminar logro"><i class=yl-i-cerrar></i></button>`:''}
        </div>`;
      }).join('')}
    </div>
    ${_canAch
      ? `<details style="border:1px solid var(--border);border-radius:8px;padding:12px">
          <summary style="cursor:pointer;font-size:12px;font-family:Oswald;letter-spacing:1px;color:var(--muted)">AGREGAR LOGRO / MEDALLA</summary>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <div style="flex:1;min-width:180px">
                <label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">ETIQUETA (aparece debajo de la medalla)</label>
                <input id="achLabel" type="text" placeholder="1ª Campeona Mundial Chile" class="inp" style="font-size:12px">
              </div>
              <div style="flex:1;min-width:180px">
                <label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">EVENTO</label>
                <input id="achEvento" type="text" placeholder="IPF Sub-Junior & Junior Worlds 2025" class="inp" style="font-size:12px">
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <div style="flex:2;min-width:260px">
                <label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">URL DEL LOGO (Firebase Storage, CDN, etc.)</label>
                <input id="achLogoUrl" type="text" placeholder="https://firebasestorage.googleapis.com/..." class="inp" style="font-size:12px">
              </div>
              <div style="flex:0 0 auto">
                <label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">AÑO</label>
                <input id="achAnio" type="number" placeholder="2025" class="inp" style="width:80px;font-size:12px">
              </div>
              <div style="flex:0 0 auto">
                <label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">COLOR</label>
                <input id="achColor" type="color" value="#D4A843" style="width:48px;height:36px;padding:2px;border-radius:6px;border:1px solid var(--border);background:var(--bg);cursor:pointer">
              </div>
              <div style="flex:1;min-width:180px">
                <label style="font-size:10px;color:var(--muted);letter-spacing:1px;display:block;margin-bottom:3px">TIPO DE VISUALIZACIÓN</label>
                <select id="achDisplay" class="inp" style="font-size:12px">
                  <option value="medal">Medalla (colgante a la derecha)</option>
                  <option value="verified">Badge verificado (junto al nombre)</option>
                </select>
              </div>
            </div>
            <button onclick="addAchievement('${a.codigo}')" class="btn btn-g" style="align-self:flex-start;padding:8px 20px;font-size:12px">Guardar logro</button>
          </div>
        </details>`
      : `<div style="font-size:11px;color:var(--muted);padding:8px 10px;background:rgba(29,49,80,.12);border-radius:6px;border:1px solid var(--border)">Solo owner/superadmin puede agregar o eliminar logros.</div>`
    }
  </div>`;

  // ── PRs ──────────────────────────────────────────────────
  if(bl.sq||bl.bp||bl.dl||bl.total){
    h+=`<div class="card" style="margin-bottom:14px"><div class="h2">Mejores marcas personales</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">`;
    [['SQ',bl.sq,'rgba(59,130,246,.2)','var(--blue)'],['BP',bl.bp,'rgba(245,158,11,.2)','var(--orange)'],['DL',bl.dl,'rgba(34,197,94,.2)','var(--green)'],['TOTAL',bl.total,'rgba(212,168,67,.25)','var(--gold)'],['GL',bl.glp||bl.glp,'rgba(196,30,58,.2)','var(--accent)']].forEach(([lbl,val,bg,col])=>{
      if(!val)return;
      h+=`<div style="flex:1;min-width:60px;text-align:center;padding:10px 6px;background:var(--bg);border:1px solid ${bg};border-radius:10px">
        <div style="font-size:9px;color:${col};font-family:Oswald;letter-spacing:1px">${lbl}</div>
        <div class="os" style="font-size:${lbl==='TOTAL'?'24':'18'}px;font-weight:700;color:${col};margin-top:2px">${val}</div>
        <div style="font-size:9px;color:var(--muted)">${lbl==='GL'?'pts':'kg'}</div>
      </div>`;
    });
    h+=`</div></div>`;
  }

  // ── GL evolution chart ────────────────────────────────────
  if(glHistory.length>1){
    const W=460,H=90,PX=8,PY=8;
    const gls=glHistory.map(c=>c.resultado.glp||c.resultado.gl||0);
    const maxG=Math.max(...gls),minG=Math.min(...gls.filter(v=>v>0));
    const catPalette=['#D4A843','#3B82F6','#22C55E','#F59E0B','#C41E3A','#A78BFA','#F472B6'];
    const uniqueCats=[...new Set(glHistory.map(c=>(c.categoria||'').trim()).filter(Boolean))];
    const catColor=c=>{const i=uniqueCats.indexOf((c||'').trim());return i>=0?catPalette[i%catPalette.length]:'#D4A843'};
    const pts=glHistory.map((c,i)=>{
      const x=PX+i*(W-PX*2)/(glHistory.length-1);
      const y=PY+(H-PY*2)*(1-(gls[i]-minG)/Math.max(maxG-minG,1));
      return{x,y,v:gls[i],ev:c.evento||'',fecha:c.fecha||'',cat:(c.categoria||'').trim()};
    });
    const poly=pts.map(p=>p.x+','+p.y).join(' ');
    const area=PX+','+H+' '+poly+' '+pts[pts.length-1].x+','+H;
    h+=`<div class="card" style="margin-bottom:14px"><div class="h2">Evolución GL Points</div>
      <svg viewBox="0 0 ${W} ${H+22}" style="width:100%;max-width:${W}px">
        <defs><linearGradient id="gg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#D4A843" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#D4A843" stop-opacity="0.02"/>
        </linearGradient></defs>
        <polygon points="${area}" fill="url(#gg2)"/>
        <polyline points="${poly}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${catColor(p.cat)}" stroke="var(--card)" stroke-width="2"/>
          <text x="${p.x}" y="${p.y-8}" text-anchor="middle" font-size="9" fill="rgba(212,168,67,.9)" font-family="Oswald" font-weight="700">${p.v}</text>
          <text x="${p.x}" y="${H+16}" text-anchor="middle" font-size="8" fill="rgba(120,143,166,.7)">${(p.ev.match(/20\d\d/)||[''])[0]}</text>`).join('')}
      </svg>
      ${uniqueCats.length>1?`<div style="display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:center;font-size:10px;color:var(--muted);margin-top:6px;padding-top:8px;border-top:1px solid rgba(29,49,80,.3)">
        ${uniqueCats.map(cat=>`<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:${catColor(cat)};display:inline-block"></span>${cat}</span>`).join('')}
      </div>`:''}
    </div>`;
  }

  // ── Peer comparison ───────────────────────────────────────
  if(peer&&pg){
    const pctColor=peer.pct>=75?'var(--green)':peer.pct>=50?'var(--gold)':'var(--accent)';
    const keyParts=peerKey.split('|');
    const peerLabel=(keyParts[0]==='F'?'Mujer':'Hombre')+' · '+keyParts[1]+' kg · '+keyParts[2];
    const maxT=pg.members[0]?.total||1;
    h+=`<div class="card" style="margin-bottom:14px"><div class="h2">Comparativa en categoría</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:12px">${peerLabel} · ${pg.n} atletas en el grupo</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
            <span style="color:var(--muted)">Posición</span>
            <span style="font-weight:700;color:${pctColor}">Top ${100-peer.pct}% · #${peer.rank} de ${peer.n}</span>
          </div>
          <div style="background:rgba(29,49,80,.4);border-radius:6px;height:10px;overflow:hidden">
            <div style="background:${pctColor};height:100%;width:${Math.max(peer.pct,4)}%;border-radius:6px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:3px">
            <span>Mín</span><span>Prom ${pg.avg}</span><span>Top ${pg.top}</span>
          </div>
        </div>
        <div style="text-align:center;min-width:54px">
          <div class="os" style="font-size:28px;font-weight:700;color:${pctColor}">${peer.pct}°</div>
          <div style="font-size:9px;color:var(--muted)">PERCENTIL</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
        ${[['Promedio',pg.avg,'var(--muted)'],['Mediana',pg.p50,'var(--text)'],['Top 1',pg.top,'var(--gold)']].map(([lbl,val,col])=>`
          <div style="background:var(--bg);border-radius:8px;padding:8px;text-align:center">
            <div style="font-size:9px;color:var(--muted);margin-bottom:2px">${lbl}</div>
            <div class="os" style="font-size:17px;font-weight:700;color:${col}">${val}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-family:Oswald;letter-spacing:1px">TOP DE LA CATEGORÍA</div>
      ${pg.members.map((m,i)=>{
        const isMe=m.codigo===a.codigo;
        const pct=Math.round(m.total/maxT*100);
        const col=isMe?'var(--accent)':i===0?'var(--gold)':'var(--blue)';
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span style="font-size:10px;font-family:Oswald;color:${isMe?'var(--accent)':'var(--muted)'};min-width:14px">${i+1}</span>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">
              <span style="font-weight:${isMe?700:400};color:${isMe?'var(--accent)':'var(--text)'}">${m.nombre}${isMe?' ← este atleta':''}</span>
              <span class="os" style="font-size:12px">${m.total} kg</span>
            </div>
            <div style="background:rgba(29,49,80,.3);border-radius:3px;height:5px;overflow:hidden">
              <div style="background:${col};height:100%;width:${pct}%;border-radius:3px"></div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Active inscriptions ───────────────────────────────────
  if(activeInsc.length){
    h+=`<div class="card" style="margin-bottom:14px"><div class="h2">Inscripciones activas</div>`;
    activeInsc.forEach(i=>{
      const ev=ST.eventos.find(e=>e.id===i.evento);
      const evName=ev?.name||i.evento;
      const ok=i.status==='approved';
      h+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(29,49,80,.3)">
        <div>
          <div style="font-weight:600;font-size:13px">${evName}</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);margin-top:2px"><span>${i.division||'—'} · ${i.categoria||'—'} · ${i.modalidad||'—'} · </span>${window.clubLogoImg?window.clubLogoImg(i.club,16,'background:var(--bg);padding:1px;'):''}<span>${i.club||'—'}</span></div>
        </div>
        <span class="badge ${ok?'b-g':'b-y'}" style="flex-shrink:0;margin-left:12px">${ok?'<i class=yl-i-check></i> Confirmado':'<i class=yl-i-espera></i> Pendiente'}</span>
      </div>`;
    });
    h+=`</div>`;
  }

  // ── Competition history ───────────────────────────────────
  // Aparte, dentro de su propio try: si algo acá se cae, se cae SOLO el
  // historial y la ficha se sigue viendo. Sin esto, una función que faltaba en
  // el módulo compartido tiró la excepción en pleno render y la ficha del
  // atleta no se abría — no había forma de entrar a nada, ni de saber por qué.
  try{ h+=_histCompetencias(sorted); }
  catch(e){
    console.error('[ficha] historial:',e);
    h+=`<div class="card"><div class="h2">Historial de competencias</div>
      <p style="color:var(--red);font-size:12px;margin-top:8px">No se pudo dibujar el historial: ${escapeHtml(e.message||'error')}</p>
      <p style="color:var(--muted);font-size:11px;margin-top:4px">Prueba recargar la página. El resto de la ficha está arriba.</p></div>`;
  }

  return h;
}

function _histCompetencias(sorted){
  let h='';
  if(sorted.length){
    h+=`<div class="card"><div class="h2">Historial de competencias (${sorted.length})</div>`;
    sorted.forEach((c,ci)=>{
      const r=c.resultado||{};
      const prevTotal=sorted[ci+1]?.resultado?.total||0;
      const delta=prevTotal?r.total-prevTotal:null;
      const glVal=r.glp||r.gl||null;
      h+=`<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(29,49,80,.3)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.evento}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.division||'—'} · ${c.categoria||'—'}${c.modalidad?' · '+c.modalidad:''}</div>
          ${c.fecha?`<div style="font-size:10px;color:var(--muted)">${c.fecha}</div>`:''}
          <div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px">
            ${r.sq?`<span style="font-size:9px;background:rgba(59,130,246,.1);color:var(--blue);padding:1px 5px;border-radius:3px">SQ ${r.sq}</span>`:''}
            ${r.bp?`<span style="font-size:9px;background:rgba(245,158,11,.1);color:var(--orange);padding:1px 5px;border-radius:3px">BP ${r.bp}</span>`:''}
            ${r.dl?`<span style="font-size:9px;background:rgba(34,197,94,.1);color:var(--green);padding:1px 5px;border-radius:3px">DL ${r.dl}</span>`:''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:12px">
          <div class="os" style="font-size:19px;font-weight:700;color:var(--gold)">${r.total} kg</div>
          ${delta!==null?`<div style="font-size:11px;font-weight:700;color:${delta>0?'var(--green)':delta<0?'var(--red)':'var(--muted)'}">${delta>0?'+':''}${delta} kg</div>`:''}
          ${glVal?`<div style="font-size:10px;color:var(--muted)">GL ${glVal}${r.pos?' · #'+r.pos:''}</div>`:''}
          <button onclick="abrirEdicionResultado('${escapeJsAttr(_claveRes(c))}')" style="margin-top:6px;background:transparent;border:1px solid var(--border);color:var(--muted);font-size:10px;cursor:pointer;padding:3px 9px;border-radius:5px">Corregir</button>
        </div>
      </div>`;
    });
    h+=`</div>`;
  }

  return h;
}

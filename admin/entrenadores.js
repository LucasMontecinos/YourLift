// admin.html — Entrenadores: sus formularios, su inscripción y la base de acreditaciones.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

function _feVacio(){
  return {id:'', nombre:'', tipo:'campeonato', evento:'', abierto:true, cierra:'', texto:'', documentos:[]};
}

window.feNuevo=function(){
  ST.feForm=_feVacio(); ST.feModo='crear'; window._efDocsE=[];
  setTimeout(()=>{try{efDocPinta('e')}catch(e){}},0); render();
};

// Atajo desde la ficha del campeonato: abre el constructor con el campeonato ya
// elegido y un nombre propuesto. La configuración sigue viviendo en su pestaña;
// esto solo ahorra el camino.
window.feNuevoPara=function(eventoId){
  const ev=(ST.eventos||[]).find(e=>e.id===eventoId)||{};
  ST.feForm={..._feVacio(), tipo:'campeonato', evento:eventoId,
             nombre:'Entrenadores · '+(ev.name||eventoId)};
  ST.feModo='crear'; window._efDocsE=[];
  go('formEnt');
};

window.feEditar=function(id){
  const f=(ST.formEnt||[]).find(x=>x.id===id); if(!f)return;
  ST.feForm={..._feVacio(), ...f};
  ST.feModo='editar';
  window._efDocsE=(Array.isArray(f.documentos)?f.documentos:[]).map(d=>Object.assign({},d));
  setTimeout(()=>{try{efDocPinta('e')}catch(e){}},0); render();
};

window.feCerrarForm=function(){ ST.feForm=null; window._efDocsE=[]; render(); };

window.feCampo=function(k,v){ if(ST.feForm){ ST.feForm[k]=v; render();
  setTimeout(()=>{try{efDocPinta('e')}catch(e){}},0); } };

window.feGuardar=async function(){
  const f=ST.feForm; if(!f)return;
  const nombre=(document.getElementById('fe_nombre')?.value||'').trim();
  const tipo=document.getElementById('fe_tipo')?.value||'campeonato';
  const evento=tipo==='campeonato'?(document.getElementById('fe_evento')?.value||''):'';
  const cierra=(document.getElementById('fe_cierra')?.value||'').trim();
  const texto=(document.getElementById('fe_texto')?.value||'').trim();
  const abierto=!!document.getElementById('fe_abierto')?.checked;
  if(!nombre){ showToast('Ponle un nombre al formulario',null,true); return; }
  if(tipo==='campeonato'&&!evento){ showToast('Elige de qué campeonato es',null,true); return; }
  const id=f.id||('fe_'+Date.now().toString(36));
  const data={id,nombre,tipo,evento,abierto,cierra,texto,
              documentos:efDocLeer('e'), updatedAtISO:new Date().toISOString(),
              updatedAt:serverTimestamp()};
  try{
    await setDoc(doc(db,'formularios_entrenador',id),data,{merge:true});
    await logAction(f.id?'form_ent_edit':'form_ent_create',id,null,nombre);
    showToast('Formulario guardado');
    ST.feForm=null; window._efDocsE=[]; render();
  }catch(e){ showToast('Error: '+e.message,null,true); }
};

window.feBorrar=async function(id){
  const f=(ST.formEnt||[]).find(x=>x.id===id); if(!f)return;
  const n=(ST.entInsc||[]).filter(x=>x.formulario===id).length;
  if(!confirm(`¿Borrar "${f.nombre}"?`+(n?`\n\nHay ${n} inscripción(es) hechas con él. No se borran, pero quedan sin formulario.`:'')))return;
  try{
    await deleteDoc(doc(db,'formularios_entrenador',id));
    await logAction('form_ent_delete',id,f.nombre,'deleted');
    showToast('Formulario borrado');
  }catch(e){ showToast('Error: '+e.message,null,true); }
};

window.feAbrirCerrar=async function(id,abierto){
  try{
    await updateDoc(doc(db,'formularios_entrenador',id),{abierto,updatedAtISO:new Date().toISOString()});
    showToast(abierto?'Formulario abierto':'Formulario cerrado');
  }catch(e){ showToast('Error: '+e.message,null,true); }
};

// Los campeonatos que quedaron con la configuración vieja, de cuando esto vivía
// adentro de su ficha. Se traen de una vez y el campeonato queda limpio.
function _feHeredables(){
  return (ST.eventos||[]).filter(e=>e&&(e.entrenadoresOpen||(e.docsEntrenador||[]).length));
}

window.feMigrar=async function(){
  const evs=_feHeredables(); if(!evs.length)return;
  if(!confirm(`Traer ${evs.length} configuración(es) de campeonato a formularios propios?`))return;
  try{
    for(const e of evs){
      const id='fe_ev_'+String(e.id).replace(/[^a-zA-Z0-9_]/g,'_');
      await setDoc(doc(db,'formularios_entrenador',id),{
        id, nombre:'Entrenadores · '+(e.name||e.id), tipo:'campeonato', evento:e.id,
        abierto:!!e.entrenadoresOpen, cierra:e.entrenadoresCloseAt||'', texto:e.entrenadoresTexto||'',
        documentos:Array.isArray(e.docsEntrenador)?e.docsEntrenador:[],
        updatedAtISO:new Date().toISOString(), updatedAt:serverTimestamp()},{merge:true});
      await updateDoc(doc(db,'eventos',e.id),{entrenadoresOpen:false});
    }
    await logAction('form_ent_migrar','eventos',null,evs.length+' migrados');
    showToast('Traídos '+evs.length);
  }catch(err){ showToast('Error: '+err.message,null,true); }
};

function renderFormEnt(){
  const f=ST.feForm;
  if(f) return _feEditorHtml(f);
  const list=ST.formEnt||[];
  const hered=_feHeredables();
  const hoy=new Date().toISOString().slice(0,10);
  const filas=list.map(x=>{
    const insc=(ST.entInsc||[]).filter(y=>y.formulario===x.id).length;
    const venc=x.cierra&&x.cierra<hoy;
    const vivo=x.abierto&&!venc;
    const ev=x.tipo==='campeonato'?((ST.eventos||[]).find(e=>e.id===x.evento)||{}).name||x.evento:'—';
    return `<tr>
      <td><div style="font-weight:600">${esc(x.nombre||'')}</div>
          <div style="font-size:10px;color:var(--muted)">${esc(window.FE_TIPOS[x.tipo]||x.tipo)}</div></td>
      <td style="font-size:11px">${esc(ev)}</td>
      <td style="font-size:11px">${(x.documentos||[]).length}</td>
      <td style="font-size:11px">${x.cierra?esc(x.cierra):'<span style="color:var(--muted)">sin fecha</span>'}</td>
      <td>${vivo?'<span class="badge b-g">Abierto</span>':venc?'<span class="badge b-r">Vencido</span>':'<span class="badge b-y">Cerrado</span>'}</td>
      <td style="font-size:11px">${insc||'<span style="color:var(--muted)">0</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn" style="padding:4px 9px;font-size:11px" onclick="feEditar('${esc(x.id)}')">Editar</button>
        <button class="btn" style="padding:4px 9px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted);margin-left:4px" onclick="feAbrirCerrar('${esc(x.id)}',${x.abierto?'false':'true'})">${x.abierto?'Cerrar':'Abrir'}</button>
        <button class="btn" style="padding:4px 9px;font-size:11px;background:transparent;border:1px solid var(--red);color:var(--red);margin-left:4px" onclick="feBorrar('${esc(x.id)}')">Borrar</button>
      </td></tr>`;
  }).join('');
  return `
  <div class="h1">Formularios de Entrenadores</div>
  <p class="subtitle">Los formularios que llena el entrenador · sirven para inscribirse a un campeonato y para las convocatorias de acreditación</p>
  ${hered.length?`<div class="card" style="border-color:rgba(212,168,67,.5);background:rgba(212,168,67,.06)">
    <div style="font-weight:600;color:var(--gold);margin-bottom:4px">Hay configuración vieja en ${hered.length} campeonato(s)</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.55;margin-bottom:10px">
      Esto antes se configuraba adentro de la ficha del campeonato. Se trae acá tal cual
      —nombre, fecha, texto y documentos— y el campeonato queda limpio.
    </div>
    <button class="btn" onclick="feMigrar()" style="padding:7px 16px;font-size:12px">Traerlos</button>
  </div>`:''}
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <div style="font-size:12px;color:var(--muted)">
        El formulario vive en <b>inscripcion_entrenador.html</b>. Ahí salen todos los que estén abiertos.
      </div>
      <button class="btn" onclick="feNuevo()" style="padding:8px 16px;font-size:12px">+ Nuevo formulario</button>
    </div>
    ${!list.length?`<div style="color:var(--muted);font-size:13px;line-height:1.6;padding:8px 0">
      Todavía no hay ninguno.<br><br>
      Uno de tipo <b>campeonato</b> le pide al entrenador que elija a los atletas que lleva, de los que
      ya están inscritos ahí. Uno de <b>acreditación</b> no pide atletas: postula él y sube sus papeles.
      En los dos casos, los documentos los define usted.
    </div>`:`<div style="overflow-x:auto"><table class="tbl"><thead><tr>
      <th>Formulario</th><th>Campeonato</th><th>Docs</th><th>Cierra</th><th>Estado</th><th>Inscritos</th><th></th>
    </tr></thead><tbody>${filas}</tbody></table></div>`}
  </div>`;
}

function _feEditorHtml(f){
  const evs=(ST.eventos||[]).filter(e=>e.status!=='archived');
  return `
  <div class="h1">${ST.feModo==='crear'?'Nuevo formulario de entrenador':'Editar formulario'}</div>
  <p class="subtitle">Lo que va a ver y llenar el entrenador</p>
  <div class="card" style="max-width:680px">
    <div class="field"><label>Nombre del formulario</label>
      <input class="inp" id="fe_nombre" value="${esc(f.nombre||'')}" placeholder="ej. Entrenadores · Nacional Olimpiadas Especiales">
      <div style="font-size:11px;color:var(--muted);margin-top:3px">Es lo que el entrenador ve en la lista al entrar.</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="field"><label>Tipo</label>
        <select class="inp" id="fe_tipo" onchange="feCampo('tipo',this.value)">
          ${Object.entries(window.FE_TIPOS).map(([k,v])=>`<option value="${k}" ${f.tipo===k?'selected':''}>${esc(v)}</option>`).join('')}
        </select>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">
          ${f.tipo==='campeonato'
            ?'Le pide al entrenador que elija a los atletas que lleva.'
            :'No pide atletas: postula él y sube sus papeles.'}
        </div>
      </div>
      <div class="field"><label>Cierra el</label>
        <input class="inp" type="date" id="fe_cierra" value="${esc(f.cierra||'')}">
        <div style="font-size:11px;color:var(--muted);margin-top:3px">Vacío = sin fecha de cierre.</div>
      </div>
    </div>
    ${f.tipo==='campeonato'?`<div class="field"><label>Campeonato</label>
      <select class="inp" id="fe_evento">
        <option value="">— Elegir —</option>
        ${evs.map(e=>`<option value="${esc(e.id)}" ${f.evento===e.id?'selected':''}>${esc(e.name||e.id)}</option>`).join('')}
      </select>
      <div style="font-size:11px;color:var(--muted);margin-top:3px">De ahí salen los atletas que puede elegir.</div>
    </div>`:''}
    <div class="field"><label>Texto que ve el entrenador al empezar</label>
      <textarea class="inp" id="fe_texto" rows="3" placeholder="Instrucciones, plazos, a quién escribir…">${esc(f.texto||'')}</textarea>
    </div>
    <label class="field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="fe_abierto" ${f.abierto?'checked':''} style="width:18px;height:18px;cursor:pointer">
      <span style="margin:0">Abierto — se puede llenar ahora</span>
    </label>
    <div style="border-top:1px solid rgba(212,168,67,.25);margin-top:6px;padding-top:12px">
      <div style="font-weight:600;color:var(--gold);margin-bottom:4px">Documentos que se le piden</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5">
        Nombre, el PDF en blanco que descarga y el link si el papel se saca en otra página.
        <b>Se piden todos</b> los que agregues.
      </div>
      <div id="fe_docs"></div>
      <button type="button" class="btn" onclick="efDocAgregar('e')" style="margin-top:8px;padding:6px 14px;font-size:12px">+ Agregar documento</button>
    </div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="btn" onclick="feGuardar()">Guardar</button>
      <button class="btn" style="background:transparent;border:1px solid var(--border);color:var(--muted)" onclick="feCerrarForm()">Cancelar</button>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// INSCRIPCIÓN DE ENTRENADORES — revisión
// ═══════════════════════════════════════════════════════════
// Llegan de inscripcion_entrenador.html: el entrenador se inscribe él, dice a
// qué atletas lleva y sube sus documentos. Acá se revisan y se aprueban.
//
// La acreditación NO tranca la inscripción a propósito —hay organizaciones que
// no son FECHIPO, como Olimpiadas Especiales— así que lo que llega puede venir
// sin ella. Por eso la columna de acreditación es lo primero que se ve: es
// justo lo que hay que mirar al revisar.
window.entInscFiltro=function(k,v){ ST['entIns_'+k]=v; render(); };

window.entInscEstado=async function(id,status){
  id=decodeURIComponent(id);
  const e=(ST.entInsc||[]).find(x=>x.id===id); if(!e)return;
  const antes=e.status;
  try{
    await updateDoc(doc(db,'inscripciones_entrenador',id),{status});
    await logAction('ent_insc_status',id,antes,status,{nombre:e.nombre});
    showToast(`${e.nombre}: ${status}`,async()=>{
      await updateDoc(doc(db,'inscripciones_entrenador',id),{status:antes});
      await logAction('undo_ent_insc_status',id,status,antes,{nombre:e.nombre});
      showToast('Estado revertido');
    });
  }catch(err){ showToast('Error: '+err.message,null,true); }
};

window.entInscBorrar=async function(id){
  id=decodeURIComponent(id);
  const e=(ST.entInsc||[]).find(x=>x.id===id); if(!e)return;
  if(!confirm(`¿Eliminar la inscripción de ${e.nombre}?\n\nSe borra también su PIN y sus documentos.`))return;
  try{
    await deleteDoc(doc(db,'inscripciones_entrenador',id));
    try{ await deleteDoc(doc(db,'inscripciones_entrenador_priv',id)); }catch(_){}
    await logAction('delete_ent_insc',id,e.nombre,'deleted',{evento:e.evento});
    showToast(`${e.nombre} eliminado`);
  }catch(err){ showToast('Error: '+err.message,null,true); }
};

window.entInscExportar=function(){
  const list=_entInscFiltrada();
  if(!list.length){ showToast('Nada que exportar',null,true); return; }
  const filas=[['Campeonato','Entrenador','RUT','Club','Acreditación','Vence','Estado','Atletas','Correo','Teléfono']];
  list.forEach(e=>{
    const pv=(ST.entInscPriv||{})[e.id]||{};
    filas.push([
      (ST.eventos.find(x=>x.id===e.evento)||{}).name||e.evento,
      e.nombre||'', e.rut||'', e.club||'',
      e.acreditado?'Vigente':(e.enBase?'Vencida':'No está en la base'),
      e.acreditadoHasta||'', e.status||'',
      (e.atletas||[]).map(a=>a.nombre).join(' | '),
      pv.correo||'', pv.telefono||''
    ]);
  });
  const csv='﻿'+filas.map(f=>f.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(';')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='entrenadores_inscritos.csv'; a.click();
};

function _entInscFiltrada(){
  let l=(ST.entInsc||[]).slice();
  const ev=ST.entIns_evento||'', st=ST.entIns_status||'', q=(ST.entIns_q||'').toLowerCase().trim();
  if(ev)l=l.filter(x=>x.evento===ev);
  if(st)l=l.filter(x=>(x.status||'pending')===st);
  if(q)l=l.filter(x=>((x.nombre||'')+' '+(x.rut||'')+' '+(x.club||'')).toLowerCase().includes(q));
  return l;
}

function renderEntInsc(){
  const list=_entInscFiltrada();
  const todos=ST.entInsc||[];
  const evs=[...new Set(todos.map(x=>x.evento))];
  const pend=todos.filter(x=>(x.status||'pending')==='pending').length;
  const sinAcred=todos.filter(x=>!x.acreditado).length;
  const filas=list.map(e=>{
    const pv=(ST.entInscPriv||{})[e.id]||{};
    const docs=Object.entries(pv.docs||{});
    const evObj=ST.eventos.find(x=>x.id===e.evento)||{};
    const nomDoc=k=>{
      const fo=(ST.formEnt||[]).find(x=>x.id===e.formulario)||{};
      const d=(fo.documentos||[]).find(x=>'e_'+x.key===k);
      return d?d.label:k;
    };
    const st=e.status||'pending';
    const badge=st==='approved'?'<span class="badge b-g">Aprobado</span>'
      :st==='rejected'?'<span class="badge b-r">Rechazado</span>'
      :'<span class="badge b-y">Pendiente</span>';
    const acred=e.acreditado
      ? `<span class="badge b-g">Vigente</span>${e.acreditadoHasta?`<br><span style="font-size:9px;color:var(--muted)">hasta ${esc(e.acreditadoHasta)}</span>`:''}`
      : e.enBase
        ? `<span class="badge b-r">Vencida</span>`
        : `<span class="badge b-r">No está en la base</span>`;
    return `<tr>
      <td><div style="font-weight:600">${esc(e.nombre||'')}</div>
          <div style="font-size:10px;color:var(--muted)">${esc(e.rut||'')} · ${esc(e.club||'sin club')}</div>
          ${pv.correo?`<div style="font-size:10px;color:var(--muted)">${esc(pv.correo)}${pv.telefono?' · '+esc(pv.telefono):''}</div>`:''}</td>
      <td style="font-size:11px">${esc(evObj.name||e.evento)}</td>
      <td>${acred}</td>
      <td style="font-size:11px;max-width:260px">
        <b>${(e.atletas||[]).length}</b>
        <div style="color:var(--muted);line-height:1.5">${(e.atletas||[]).map(a=>esc(a.nombre)).join('<br>')}</div>
      </td>
      <td style="font-size:11px">${docs.length
        ? docs.map(([k,u])=>`<a href="${esc(u)}" target="_blank" style="color:var(--gold);display:block">${esc(nomDoc(k))}</a>`).join('')
        : '<span style="color:var(--muted)">—</span>'}</td>
      <td>${badge}</td>
      <td style="white-space:nowrap">
        ${st!=='approved'?`<button class="btn" style="padding:4px 9px;font-size:11px;background:var(--green);color:#04210f" onclick="entInscEstado('${encodeURIComponent(e.id)}','approved')">Aprobar</button>`:''}
        ${st!=='rejected'?`<button class="btn" style="padding:4px 9px;font-size:11px;background:transparent;border:1px solid var(--red);color:var(--red);margin-left:4px" onclick="entInscEstado('${encodeURIComponent(e.id)}','rejected')">Rechazar</button>`:''}
        <button class="btn" style="padding:4px 9px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted);margin-left:4px" onclick="entInscBorrar('${encodeURIComponent(e.id)}')">Borrar</button>
      </td>
    </tr>`;
  }).join('');
  return `
  <div class="h1">Inscripción de Entrenadores</div>
  <p class="subtitle">El período de los entrenadores, aparte del de los atletas · ${todos.length} inscritos${pend?` · ${pend} por revisar`:''}${sinAcred?` · ${sinAcred} sin acreditación vigente`:''}</p>
  ${!todos.length?`<div class="card" style="color:var(--muted);font-size:13px;line-height:1.6">
      Todavía no hay ninguna inscripción de entrenador.<br><br>
      Se abre desde <b>Campeonatos → editar → Abrir inscripción de entrenadores</b>, y el
      formulario queda en <b>inscripcion_entrenador.html</b>. Ahí el entrenador entra con su
      RUT, elige a los atletas que lleva de los que ya están inscritos, y sube los documentos
      que le pidas.
    </div>`:`
  <div class="card">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <input class="inp" placeholder="Buscar por nombre, RUT o club…" value="${esc(ST.entIns_q||'')}"
        oninput="entInscFiltro('q',this.value)" style="flex:1;min-width:200px">
      <select class="inp" onchange="entInscFiltro('evento',this.value)" style="width:auto">
        <option value="">Todos los campeonatos</option>
        ${evs.map(id=>`<option value="${esc(id)}" ${ST.entIns_evento===id?'selected':''}>${esc((ST.eventos.find(x=>x.id===id)||{}).name||id)}</option>`).join('')}
      </select>
      <select class="inp" onchange="entInscFiltro('status',this.value)" style="width:auto">
        <option value="">Todos</option>
        ${['pending','approved','rejected'].map(s=>`<option value="${s}" ${ST.entIns_status===s?'selected':''}>${s==='pending'?'Pendientes':s==='approved'?'Aprobados':'Rechazados'}</option>`).join('')}
      </select>
      <button class="btn" style="padding:7px 14px;font-size:12px" onclick="entInscExportar()">Exportar CSV</button>
    </div>
    <div style="overflow-x:auto">
    <table class="tbl"><thead><tr>
      <th>Entrenador</th><th>Campeonato</th><th>Acreditación</th><th>Atletas</th><th>Documentos</th><th>Estado</th><th></th>
    </tr></thead><tbody>${filas||'<tr><td colspan="7" style="color:var(--muted)">Nada calza con ese filtro.</td></tr>'}</tbody></table>
    </div>
  </div>`}`;
}

// ═══════════════════════════════════════════
// BASE DE ENTRENADORES (acreditaciones, vigencia 1 año, categoría) — Firestore
// ═══════════════════════════════════════════
function _entRutId(r){return String(r||'').replace(/[^0-9kK]/g,'').toUpperCase();}

// La ficha se guarda con el RUT como identificador, porque es lo que permite
// cruzarla con el padrón y ponerle la insignia de entrenador al atleta.
//
// Pero hay once entrenadores que no compiten y cuyo RUT en la planilla resultó
// ser el de otra persona: se les dejó en blanco a propósito, porque un RUT
// equivocado no es un dato incompleto sino la insignia de un entrenador colgada
// en la ficha de alguien que no lo es. Esos quedan con un identificador armado
// desde el nombre, aparecen en la lista marcados y se les puede escribir el RUT
// cuando la federación lo confirme.
function _entSlug(n){return String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);}

function _entDocId(c){ return _entRutId(c&&c.rut)||(c&&c.id)||('sr-'+_entSlug(c&&c.nombre)); }

function _entVence(fecha){ if(!fecha)return ''; const p=String(fecha).split('-'); if(p.length<2)return ''; return (parseInt(p[0])+1)+'-'+p[1]; }

function _entVigente(c){ const m=new Date().toISOString().slice(0,7); return (c.acreditaciones||[]).some(a=>a.vence&&a.vence>=m); }

// ── Cuentas de acceso de los entrenadores ────────────────────────────────────
//
// Para inscribirse a un campeonato el entrenador entra con una cuenta suya, y no
// escribiendo su nombre a mano: así el que se inscribe como coach es el que la
// federación acreditó, y no cualquiera que sepa escribir un RUT.
//
// La cuenta se crea ACÁ y no se puede pedir sola. Es a propósito: la clave
// inicial es el RUT, que no es un secreto —está en cada nómina—, así que si el
// registro estuviera abierto, el primero que llegue con un correo y un RUT se
// queda con la cuenta de otro. Creándolas desde el panel, un correo sin cuenta
// simplemente no entra.
//
// Al primer ingreso el entrenador tiene que cambiarla: `debeCambiarClave` es lo
// que se lo exige.
function _entCorreo(c){ return String(((c&&c.correos)||[])[0]||'').trim().toLowerCase(); }

// Puede entrar quien tenga acreditación vigente, correo y RUT. Los once sin RUT
// no quedan fuera por castigo: la clave inicial ES el RUT, así que sin él no hay
// con qué entrar. Se les carga en "Editar" y aparecen acá solos.
function _entPuedeCuenta(c){ return _entVigente(c) && !!_entCorreo(c) && _entRutId(c.rut).length>=8; }

function _entTieneCuenta(c){
  const mails=window._COACH_MAILS;
  if(!mails)return false;
  return mails.has(_entCorreo(c));
}

// Los correos que ya tienen cuenta. Se piden una vez y quedan cacheados, porque
// esto se dibuja en cada render de la lista.
async function _entCargarCuentas(){
  if(window._COACH_MAILS)return;
  window._COACH_MAILS=new Set();
  try{
    const snap=await getDocs(collection(db,'coaches'));
    snap.forEach(d=>{ const m=String((d.data()||{}).email||'').toLowerCase(); if(m)window._COACH_MAILS.add(m); });
  }catch(e){ console.warn('[coaches]',e.message); }
  if(ST.view==='entrenadoresDB')render();
}

window.entCrearCuentas=async function(){
  const list=(ST.entrenadores||[]);
  await _entCargarCuentas();
  const faltan=list.filter(c=>_entPuedeCuenta(c)&&!_entTieneCuenta(c));
  const sinRut=list.filter(c=>_entVigente(c)&&_entRutId(c.rut).length<8).length;
  const sinMail=list.filter(c=>_entVigente(c)&&!_entCorreo(c)).length;
  if(!faltan.length){
    showToast(sinRut?`No hay cuentas que crear. Quedan ${sinRut} sin RUT: cárgaselo en Editar y vuelve.`:'Todos los entrenadores vigentes ya tienen cuenta.');
    return;
  }
  const detalle=[`Se van a crear ${faltan.length} cuenta(s).`,'',
    'Entra con su correo y, de clave, su RUT sin puntos ni guion.',
    'Al primer ingreso tiene que cambiarla.',''];
  if(sinRut)detalle.push(`Quedan fuera ${sinRut} sin RUT en la base (la clave es el RUT).`);
  if(sinMail)detalle.push(`Y ${sinMail} sin correo.`);
  if(!confirm(detalle.join('\n')))return;
  const btn=document.getElementById('entCuentasBtn');
  const rot=btn?btn.textContent:'';
  let ok=0; const malas=[];
  for(let i=0;i<faltan.length;i++){
    const c=faltan[i];
    if(btn)btn.textContent=`Creando ${i+1}/${faltan.length}…`;
    const mail=_entCorreo(c), clave=_entRutId(c.rut);
    try{
      await window.createCoach(mail,clave,c.nombre||'',c.categoria||'',c.rut||'',{
        debeCambiarClave:true,
        entrenadorId:c.id||'',
        origen:'base_entrenadores'
      });
      window._COACH_MAILS.add(mail); ok++;
    }catch(e){
      // El correo ya existe en Auth aunque no tenga doc en coaches/: pasa si la
      // cuenta se creó antes por otra vía. No es un error que haya que arreglar.
      const cod=e&&e.code||'';
      if(cod==='auth/email-already-in-use'){ window._COACH_MAILS.add(mail); continue; }
      malas.push((c.nombre||mail)+': '+(e.message||cod||e));
    }
  }
  if(btn)btn.textContent=rot||'Crear cuentas';
  await logAction('coach_alta_masiva','entrenadores',null,`${ok} creadas, ${malas.length} con error`);
  render();
  if(malas.length)alert(`Se crearon ${ok}.\n\nNo se pudo con ${malas.length}:\n`+malas.slice(0,12).join('\n'));
  else showToast(`${ok} cuenta(s) creada(s). La clave de cada uno es su RUT sin puntos ni guion.`);
};

window.openEntModal=function(rut){
  const src=rut?(ST.entrenadores||[]).find(x=>x.id===rut):null;
  _entWork=src?JSON.parse(JSON.stringify(src)):{nombre:'',rut:'',club:'',correos:[],categoria:'',acreditaciones:[]};
  if(!_entWork.acreditaciones)_entWork.acreditaciones=[];
  const ov=document.createElement('div'); ov.id='entModal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto';
  ov.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;max-width:600px;width:100%;padding:22px">
    <div style="font-family:Oswald;font-size:19px;font-weight:700;margin-bottom:14px">${rut?'Editar entrenador':'Nuevo entrenador'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <input id="ent_nom" class="inp" placeholder="Nombre completo" value="${esc(_entWork.nombre||'')}">
      <input id="ent_rut" class="inp" placeholder="RUT" value="${esc(_entWork.rut||'')}">
      <input id="ent_club" class="inp" placeholder="Club" value="${esc(_entWork.club||'')}">
      <select id="ent_sexo" class="inp"><option value="" ${!_entWork.sexo?'selected':''}>Sexo…</option><option ${/^h|hombre|masc/i.test(_entWork.sexo||'')?'selected':''}>Hombre</option><option ${/muj|fem/i.test(_entWork.sexo||'')?'selected':''}>Mujer</option></select>
      <input id="ent_cat" class="inp" placeholder="Categoría actual (ej: Cat. 1)" value="${esc(_entWork.categoria||'')}">
      <input id="ent_mails" class="inp" placeholder="Correos (separados por coma)" value="${esc((_entWork.correos||[]).join(', '))}">
    </div>
    <div style="font-family:Oswald;font-size:12px;letter-spacing:1px;color:var(--gold);margin:10px 0 6px">ACREDITACIONES (cada una vence al año)</div>
    <div id="ent_acreds"></div>
    <button onclick="entAddAcred()" class="btn" style="margin-top:6px;font-size:11px;padding:5px 10px">+ Agregar acreditación</button>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button onclick="closeEntModal()" class="btn" style="background:transparent;border:1px solid var(--border);color:var(--muted)">Cancelar</button>
      <button onclick="saveEnt()" class="btn btn-g">Guardar</button>
    </div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)closeEntModal();});
  document.body.appendChild(ov);
  entRenderAcreds();
};

window.closeEntModal=function(){const m=document.getElementById('entModal');if(m)m.remove();_entWork=null;};

function entRenderAcreds(){
  const box=document.getElementById('ent_acreds'); if(!box)return;
  const A=_entWork.acreditaciones;
  box.innerHTML=A.map((a,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
    <input id="ea_proc_${i}" class="inp" type="number" min="1" placeholder="N°" value="${a.proceso||''}" style="width:58px" title="Proceso (1,2,3,4...)">
    <label style="font-size:9px;color:var(--muted)">Inicio<input id="ea_fecha_${i}" class="inp" type="month" value="${esc(a.fecha||'')}" oninput="entSuggestVence(${i})" style="width:140px;display:block" title="Fecha de inicio"></label>
    <label style="font-size:9px;color:var(--muted)">Término<input id="ea_vence_${i}" class="inp" type="month" value="${esc(a.vence||'')}" style="width:140px;display:block" title="Fecha de término / vencimiento"></label>
    <input id="ea_cat_${i}" class="inp" placeholder="Categoría" value="${esc(a.categoria||'')}" style="width:100px">
    <select id="ea_cumple_${i}" class="inp" style="width:84px"><option ${/^si/i.test(a.cumple||'')?'selected':''}>SI</option><option ${!/^si/i.test(a.cumple||'')?'selected':''}>NO</option></select>
    <button onclick="entDelAcred(${i})" style="background:transparent;border:1px solid rgba(239,68,68,.4);color:var(--red);padding:3px 7px;border-radius:5px;font-size:10px;cursor:pointer"><i class=yl-i-cerrar></i></button>
  </div>`).join('')||'<div style="font-size:11px;color:var(--muted)">Sin acreditaciones.</div>';
}

window.entSuggestVence=function(i){
  const f=document.getElementById('ea_fecha_'+i), v=document.getElementById('ea_vence_'+i);
  if(f&&v&&!v.value) v.value=_entVence(f.value);
};

function entSyncAcredsFromDOM(){
  _entWork.acreditaciones.forEach((a,i)=>{
    const p=document.getElementById('ea_proc_'+i),f=document.getElementById('ea_fecha_'+i),v=document.getElementById('ea_vence_'+i),c=document.getElementById('ea_cat_'+i),cu=document.getElementById('ea_cumple_'+i);
    if(p)a.proceso=parseInt(p.value)||'';
    if(f)a.fecha=f.value;
    if(v)a.vence=v.value;
    if(c)a.categoria=c.value.trim();
    if(cu)a.cumple=cu.value;
  });
}

window.entAddAcred=function(){entSyncAcredsFromDOM();_entWork.acreditaciones.push({proceso:(_entWork.acreditaciones.length+1),fecha:'',categoria:_entWork.categoria||'',cumple:'SI'});entRenderAcreds();};

window.entDelAcred=function(i){entSyncAcredsFromDOM();_entWork.acreditaciones.splice(i,1);entRenderAcreds();};

window.saveEnt=async function(){
  const g=id=>document.getElementById(id);
  const nombre=(g('ent_nom').value||'').trim(), rut=(g('ent_rut').value||'').trim();
  if(!nombre){showToast('Falta el nombre',null,true);return;}
  // Sin RUT se puede guardar, pero conviene saber lo que se pierde: es el único
  // dato que enlaza al entrenador con su ficha de atleta.
  if(!rut&&!confirm('Sin RUT la ficha se guarda igual, pero no se puede enlazar '
    +'con el padrón: a esta persona no le va a salir la insignia de entrenador '
    +'en su perfil.\n\n¿Guardar así?'))return;
  entSyncAcredsFromDOM();
  const data={
    nombre, rut, club:(g('ent_club').value||'').trim(),
    sexo:(g('ent_sexo').value||'').trim(),
    categoria:(g('ent_cat').value||'').trim(),
    correos:(g('ent_mails').value||'').split(',').map(s=>s.trim()).filter(Boolean),
    acreditaciones:_entWork.acreditaciones.map(a=>({proceso:a.proceso||'',fecha:a.fecha||'',vence:a.vence||_entVence(a.fecha),categoria:a.categoria||'',cumple:a.cumple||''})),
    updatedAt:serverTimestamp()
  };
  if(_entWork&&_entWork.rut_planilla)data.rut_planilla=_entWork.rut_planilla;
  // Escribirle el RUT a una ficha que no lo tenía —o corregirle uno equivocado—
  // le cambia el identificador. Hay que mover la ficha, no dejar las dos: si la
  // vieja se queda, sigue enlazada al atleta que no corresponde.
  const idViejo=(_entWork&&_entWork.id)||'';
  const idNuevo=_entRutId(rut)||idViejo||('sr-'+_entSlug(nombre));
  try{
    await setDoc(doc(db,'entrenadores',idNuevo),data,{merge:true});
    if(idViejo&&idViejo!==idNuevo)await deleteDoc(doc(db,'entrenadores',idViejo));
    await logAction('ent_save',idNuevo,null,nombre+(idViejo&&idViejo!==idNuevo?' (movido desde '+idViejo+')':''));
    showToast('Entrenador guardado'); closeEntModal();
  }
  catch(e){ showToast('Error: '+e.message,null,true); }
};

window.delEnt=async function(rut){
  const c=(ST.entrenadores||[]).find(x=>x.id===rut);
  if(!confirm('¿Eliminar a '+(c?c.nombre:'este entrenador')+' de la base?'))return;
  try{ await deleteDoc(doc(db,'entrenadores',rut)); await logAction('ent_delete',rut,null,'deleted'); showToast('Entrenador eliminado'); }
  catch(e){ showToast('Error: '+e.message,null,true); }
};

window.entExportXlsx=function(){
  const list=ST.entrenadores||[]; if(!list.length){showToast('Nada que exportar',null,true);return;}
  const head=['Nombre','RUT','Sexo','Club','Categoría','Correos','Procesos','Vigente hasta','Vigente'];
  const aoa=[head];
  list.forEach(c=>{
    const acs=(c.acreditaciones||[]);
    const procs=acs.map(a=>'P'+(a.proceso||'?')+': '+(a.fecha||'')+'→'+(a.vence||'')+(a.categoria?(' ('+a.categoria+')'):'')).join(' | ');
    const ult=acs.reduce((m,a)=>(a.vence&&(!m||a.vence>m)?a.vence:m),'');
    aoa.push([c.nombre||'',c.rut||'',c.sexo||'',c.club||'',c.categoria||'',(c.correos||[]).join(', '),procs,ult,_entVigente(c)?'Sí':'No']);
  });
  _xlsxDownload(aoa,'Entrenadores','Entrenadores.xlsx');
};

// Importar la base. Reemplaza lo que hay, no lo suma.
//
// Cuidado con las fichas que sobran. En la planilla que llegó de la federación
// la columna del RUT venía corrida: cuarenta y tres entrenadores tenían el RUT
// de otra persona, y como el RUT es el identificador de la ficha, esas fichas
// quedaron guardadas con el número equivocado. Corregir el archivo no basta: la
// ficha vieja sigue en Firestore con el RUT ajeno y le sigue poniendo la
// insignia de entrenador al atleta al que ese RUT sí pertenece. Por eso la
// importación ofrece borrar las que ya no están en la base.
window.importEntrenadores=async function(){
  // El archivo se elige desde el computador: entrenadores_db.json ya no se
  // publica en el sitio porque trae el RUT de cada entrenador.
  if(!confirm('¿Importar una base de entrenadores (archivo .json) a Firestore?\nLos que ya existan se actualizan. Elige el archivo a continuación.'))return;
  try{
    const arr=await _pedirArchivoJSON();
    if(!arr)return;
    showToast('Importando…');
    const ids=new Set(); let n=0;
    for(const c of arr){
      const id=_entDocId(c); if(!id||id==='sr-')continue;
      ids.add(id);
      await setDoc(doc(db,'entrenadores',id),{...c,updatedAt:serverTimestamp()},{merge:true}); n++;
    }
    const sobran=(ST.entrenadores||[]).filter(c=>!ids.has(c.id));
    let borrados=0;
    if(sobran.length){
      const txt=sobran.slice(0,20).map(c=>'· '+(c.nombre||c.id)+'  ('+(c.rut||c.id)+')').join('\n');
      if(confirm('Quedan '+sobran.length+' ficha(s) que ya no están en la base:\n\n'+txt
        +(sobran.length>20?'\n…':'')
        +'\n\nSon las que estaban guardadas con el RUT de otra persona. Si no se borran, '
        +'la insignia de entrenador le sigue saliendo al atleta equivocado.\n\n¿Borrarlas?')){
        for(const c of sobran){ await deleteDoc(doc(db,'entrenadores',c.id)); borrados++; }
      }
    }
    await logAction('ent_import','entrenadores',null,n+' registros'+(borrados?', '+borrados+' borrados':''));
    showToast('Importados '+n+' entrenadores'+(borrados?' · '+borrados+' borrados':''));
  }catch(e){ showToast('Error importando: '+e.message,null,true); }
};

window.entFilter=function(v){ST.entSearch=v;const el=document.getElementById('entList');if(el)el.innerHTML=entListHtml();};

window.entSetFilter=function(k,v){ST.entFilters=ST.entFilters||{};ST.entFilters[k]=v;const el=document.getElementById('entList');if(el)el.innerHTML=entListHtml();};

function entListHtml(){
  const q=(ST.entSearch||'').toLowerCase().trim();
  const f=ST.entFilters||{};
  const catDig=s=>((/cat\.?\s*(\d)/i.exec(s||'')||[])[1]||'');
  const minProc=c=>{const ps=(c.acreditaciones||[]).map(a=>parseInt(a.proceso)).filter(n=>n);return ps.length?Math.min(...ps):99;};
  let list=(ST.entrenadores||[]).slice();
  if(q)list=list.filter(c=>((c.nombre||'')+' '+(c.rut||'')+' '+(c.club||'')+' '+(c.categoria||'')+' '+(c.correos||[]).join(' ')).toLowerCase().includes(q));
  if(f.proceso)list=list.filter(c=>(c.acreditaciones||[]).some(a=>String(a.proceso)===String(f.proceso)));
  if(f.sexo)list=list.filter(c=>{const s=(c.sexo||'').toLowerCase();return f.sexo==='H'?/^h|hombre|masc/.test(s):/muj|fem/.test(s);});
  if(f.cat)list=list.filter(c=>catDig(c.categoria)===f.cat);
  if(f.club)list=list.filter(c=>(c.club||'')===f.club);
  list.sort((a,b)=>(minProc(a)-minProc(b))||(a.nombre||'').localeCompare(b.nombre||''));
  const rows=list.map(c=>{
    const vig=_entVigente(c);
    const procs=(c.acreditaciones||[]).map(a=>a.proceso).filter(Boolean).sort((a,b)=>a-b).join(', ');
    const ult=(c.acreditaciones||[]).reduce((m,a)=>(a.vence&&(!m||a.vence>m.vence)?a:m),null);
    const rutTxt=c.rut
      ? esc(c.rut)+(c.rut_planilla?` <span title="En la planilla venía ${esc(c.rut_planilla)}, que es el RUT de otra persona" style="color:var(--gold)">·corregido</span>`:'')
      : `<span style="color:var(--red)">sin RUT — no se enlaza con el padrón</span>`;
    return `<tr>
      <td>${esc(c.nombre||'')}<br><span style="font-size:9px;color:var(--muted)">${rutTxt}${c.club?' · '+esc(c.club):''}</span></td>
      <td style="font-size:11px">${esc((c.correos||[]).join(', ')||'—')}</td>
      <td><span class="badge b-y">${esc(c.categoria||'?')}</span></td>
      <td style="font-size:11px">P: ${procs||'—'}</td>
      <td>${vig?`<span class="badge b-g">Vigente</span>`:`<span class="badge b-r">Vencida</span>`}<br><span style="font-size:9px;color:var(--muted)">${ult?('hasta '+esc(ult.vence)):''}</span></td>
      <td style="white-space:nowrap">
        <button onclick="openEntModal('${esc(c.id)}')" class="btn" style="padding:3px 9px;font-size:10px">Editar</button>
        <button onclick="delEnt('${esc(c.id)}')" class="btn btn-r" style="padding:3px 9px;font-size:10px">Eliminar</button>
      </td>
    </tr>`;
  }).join('');
  return `<table class="tbl"><tr><th>Nombre / RUT</th><th>Correos</th><th>Cat.</th><th>Procesos</th><th>Vigencia</th><th></th></tr>${rows}</table>
    ${list.length===0?`<div class="empty">${q?'Sin resultados':'Base vacía — usa “Importar base”.'}</div>`:''}`;
}

function renderEntrenadoresDB(){
  const list=ST.entrenadores||[];
  _entCargarCuentas();   // perezoso: la primera vez vuelve a dibujar cuando llegan
  const total=list.length, vig=list.filter(_entVigente).length;
  const conCuenta=window._COACH_MAILS?list.filter(_entTieneCuenta).length:null;
  const puedenCuenta=list.filter(c=>_entPuedeCuenta(c)&&!_entTieneCuenta(c)).length;
  const c1=list.filter(c=>/cat\.?\s*1/i.test(c.categoria||'')).length;
  const c2=list.filter(c=>/cat\.?\s*2/i.test(c.categoria||'')).length;
  const sinRut=list.filter(c=>!_entRutId(c.rut)).length;
  const ks='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 20px;text-align:center';
  return `<div class="h1">Base de Entrenadores</div>
    <p class="subtitle">Acreditaciones por proceso · cada una vigente 1 año · categoría · editable</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:14px 0 16px">
      <div style="${ks}"><div style="font-family:Oswald;font-size:28px;font-weight:700;color:var(--gold)">${total}</div><div style="color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px">ENTRENADORES</div></div>
      <div style="${ks}"><div style="font-family:Oswald;font-size:28px;font-weight:700;color:#22c55e">${vig}</div><div style="color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px">VIGENTES</div></div>
      <div style="${ks}"><div style="font-family:Oswald;font-size:28px;font-weight:700;color:#3b82f6">${c1}</div><div style="color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px">CAT. 1</div></div>
      <div style="${ks}"><div style="font-family:Oswald;font-size:28px;font-weight:700;color:#ec4899">${c2}</div><div style="color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px">CAT. 2</div></div>
      ${sinRut?`<div style="${ks};border-color:rgba(239,68,68,.45)"><div style="font-family:Oswald;font-size:28px;font-weight:700;color:var(--red)">${sinRut}</div><div style="color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px">SIN RUT</div></div>`:''}
      <div style="${ks}"><div style="font-family:Oswald;font-size:28px;font-weight:700;color:#a78bfa">${conCuenta===null?'…':conCuenta}</div><div style="color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px">CON CUENTA</div></div>
    </div>
    ${puedenCuenta?`<div style="background:rgba(167,139,250,.09);border:1px solid rgba(167,139,250,.32);border-radius:10px;padding:11px 14px;margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:240px;font-size:12px;line-height:1.5">
        <b>${puedenCuenta} entrenador(es) vigentes sin cuenta.</b> Sin cuenta no pueden inscribirse a un campeonato como coach.
        Se crean con el correo de la base y, de clave, su RUT sin puntos ni guion; al primer ingreso tienen que cambiarla.
      </div>
      <button id="entCuentasBtn" onclick="entCrearCuentas()" class="btn" style="padding:8px 14px;background:rgba(167,139,250,.16);border:1px solid #a78bfa;color:#a78bfa">Crear ${puedenCuenta} cuenta(s)</button>
    </div>`:''}
    ${sinRut?`<div style="background:rgba(239,68,68,.09);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;line-height:1.5">
      <b>${sinRut} entrenador(es) sin RUT.</b> En la planilla traían el RUT de otra persona, así que se les dejó en blanco:
      un RUT equivocado no es un dato que falta, es la insignia de entrenador colgada en la ficha de alguien que no lo es.
      Escribiéndoles el RUT correcto en “Editar”, la insignia les aparece sola en su perfil.
    </div>`:''}
    ${(()=>{
      const f=ST.entFilters||{};
      const selS='background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:12px;font-family:DM Sans';
      const allProcs=[...new Set(list.flatMap(c=>(c.acreditaciones||[]).map(a=>parseInt(a.proceso)).filter(n=>n)))].sort((a,b)=>a-b);
      const allClubs=[...new Set(list.map(c=>c.club).filter(Boolean))].sort();
      return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        <input type="text" value="${esc(ST.entSearch||'')}" oninput="entFilter(this.value)" placeholder="Buscar nombre, RUT, correo…" style="flex:1;min-width:180px;${selS}">
        <select onchange="entSetFilter('proceso',this.value)" style="${selS}"><option value="">Proceso · todos</option>${allProcs.map(p=>`<option value="${p}" ${String(f.proceso)===String(p)?'selected':''}>Proceso ${p}</option>`).join('')}</select>
        <select onchange="entSetFilter('sexo',this.value)" style="${selS}"><option value="">Sexo · todos</option><option value="H" ${f.sexo==='H'?'selected':''}>Hombres</option><option value="M" ${f.sexo==='M'?'selected':''}>Mujeres</option></select>
        <select onchange="entSetFilter('cat',this.value)" style="${selS}"><option value="">Cat. · todas</option><option value="1" ${f.cat==='1'?'selected':''}>Cat. 1</option><option value="2" ${f.cat==='2'?'selected':''}>Cat. 2</option><option value="3" ${f.cat==='3'?'selected':''}>Cat. 3</option></select>
        <select onchange="entSetFilter('club',this.value)" style="${selS};max-width:170px"><option value="">Club · todos</option>${allClubs.map(cl=>`<option value="${esc(cl)}" ${f.club===cl?'selected':''}>${esc(cl)}</option>`).join('')}</select>
        <button onclick="openEntModal('')" class="btn btn-g" style="padding:8px 14px">+ Agregar</button>
        <button onclick="importEntrenadores()" class="btn" style="padding:8px 14px">Importar base</button>
        <button onclick="entExportXlsx()" class="btn" style="padding:8px 14px">Exportar Excel</button>
      </div>`;
    })()}
    <div class="card" style="padding:0;overflow-x:auto" id="entList">${entListHtml()}</div>`;
}

async function loadEntrenadoresData(){
  if(_entrenadoresData||_entrenadoresLoading) return _entrenadoresData;
  _entrenadoresLoading = true;
  _entrenadoresError = null;
  try {
    const url = 'entrenadores_centro_2026.json?v='+Date.now();
    const r = await fetch(url);
    if(!r.ok) throw new Error('HTTP '+r.status+' al pedir '+url+' (¿lo subiste a hosting?)');
    _entrenadoresData = await r.json();
  } catch(e){
    _entrenadoresError = e.message || String(e);
    console.error('[Entrenadores] error:', e);
  }
  _entrenadoresLoading = false;
  return _entrenadoresData;
}

function genTempPassword(nombre){
  // Slug + 4 dígitos. Ejemplo: "Andrea Garcés" → "andrea2026!4827"
  const slug = (nombre||'coach').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z]/g,'').slice(0,12) || 'coach';
  const n = Math.floor(1000 + Math.random()*9000);
  return slug + '2026!' + n;
}

window.coachExists = async function(email){
  if(!email) return false;
  try {
    const q = window.FB.query(window.FB.collection(db,'coaches'), window.FB.where('email','==',email.toLowerCase()));
    const snap = await window.FB.getDocs(q);
    return !snap.empty;
  } catch(e){ return false; }
};

window.importCoach = async function(idx, btn){
  if(!_entrenadoresData) return;
  const c = _entrenadoresData.entrenadores[idx];
  if(!c) return;
  const email = (c.emails[0]||'').trim().toLowerCase();
  if(!email){ alert('Sin email — no se puede crear cuenta. Pedile el email primero.'); return; }
  if(await window.coachExists(email)){ alert('Ya existe un coach con este email: '+email); if(btn){btn.textContent='Ya existe'; btn.disabled=true;} return; }
  const pwd = genTempPassword(c.nombre);
  const grado = c.roles.includes('head_coach')?'Head Coach':(c.roles.includes('head_coach_suplente')?'Head Coach Suplente':'Handler');
  if(!confirm('Crear cuenta para "'+c.nombre+'"?\n\nEmail: '+email+'\nClave temporal: '+pwd+'\nGrado: '+grado+'\nClubs: '+c.clubs.join(', ')+'\n\nGuardá la clave antes de aceptar — solo se muestra una vez.')) return;
  if(btn){btn.disabled=true; btn.textContent='Creando...';}
  try {
    await window.createCoach(email, pwd, c.nombre, grado, '');
    if(btn){btn.textContent='Creado'; btn.style.color='var(--green)';}
    alert('Cuenta creada.\n\nCredenciales para entregar al entrenador:\nEmail: '+email+'\nClave: '+pwd+'\n\n(Recuérdale que la cambie en su primer inicio de sesión.)');
  } catch(e){
    if(btn){btn.disabled=false; btn.textContent='Reintentar';}
    alert('Error: '+(e.message||e));
  }
};

function renderEntrenadores(){
  // Solo disparar el fetch en la PRIMERA llamada — sin esto el .then re-renderiza
  // y entra en loop infinito (page-not-responding).
  if(!_entrenadoresData && !_entrenadoresLoading && !_entrenadoresError){
    loadEntrenadoresData().then(()=>{ if(ST.view==='entrenadores') render(); });
  }
  let h='<div class="h1">Entrenadores</div>';
  h+='<p class="subtitle">Lista importada desde <code>entrenadores_centro_2026.json</code>. Crea cuentas Firebase para los que tienen email — se les enviará una clave temporal que deben cambiar en su primer login.</p>';
  if(!_entrenadoresData){
    if(_entrenadoresError){
      h+='<div class="card" style="padding:24px;background:rgba(239,68,68,.08);border-color:var(--red);color:var(--red)">';
      h+='<div style="font-weight:600;margin-bottom:6px">No pude cargar <code>entrenadores_centro_2026.json</code></div>';
      h+='<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Detalle: '+esc(_entrenadoresError)+'</div>';
      h+='<div style="font-size:12px;color:var(--text);line-height:1.6"><b>Causas comunes:</b><br>';
      h+='• El archivo está en <code>YourLift/entrenadores_centro_2026.json</code> en local pero NO se subió al hosting (Firebase / Vercel / etc).<br>';
      h+='• El URL del admin está en otro path y el fetch relativo apunta mal.<br>';
      h+='• Bloqueo CORS por servir desde otro dominio.</div>';
      h+='<button class="btn btn-g" onclick="_entrenadoresData=null;_entrenadoresError=null;render()" style="margin-top:12px">↻ Reintentar</button>';
      h+='</div>';
      return h;
    }
    h+='<div class="card" style="padding:30px;text-align:center;color:var(--muted)">Cargando lista de entrenadores...</div>';
    return h;
  }
  const list = _entrenadoresData.entrenadores;
  const conEmail = list.filter(c=>c.emails.length).length;
  const sinEmail = list.length - conEmail;
  h+='<div class="card" style="margin-bottom:14px;padding:14px 18px;display:flex;gap:24px;flex-wrap:wrap;align-items:center">';
  h+='<div><span style="font-size:11px;color:var(--muted);letter-spacing:1px;font-family:Oswald">EVENTO</span><div style="font-family:Oswald;font-size:15px;font-weight:700">'+_entrenadoresData.evento+'</div></div>';
  h+='<div><span style="font-size:11px;color:var(--muted);letter-spacing:1px;font-family:Oswald">TOTAL</span><div style="font-family:Oswald;font-size:18px;font-weight:700;color:var(--gold)">'+list.length+'</div></div>';
  h+='<div><span style="font-size:11px;color:var(--green);letter-spacing:1px;font-family:Oswald">CON EMAIL</span><div style="font-family:Oswald;font-size:18px;font-weight:700;color:var(--green)">'+conEmail+'</div></div>';
  h+='<div><span style="font-size:11px;color:var(--orange,#f59e0b);letter-spacing:1px;font-family:Oswald">SIN EMAIL</span><div style="font-family:Oswald;font-size:18px;font-weight:700;color:var(--orange,#f59e0b)">'+sinEmail+'</div></div>';
  h+='</div>';
  h+='<div class="card" style="padding:0;overflow-x:auto"><table class="tbl"><tr><th>Nombre</th><th>Email</th><th>Roles</th><th>Clubs</th><th>Atletas</th><th>Acción</th></tr>';
  list.forEach((c,i)=>{
    const hasEmail = c.emails.length>0;
    const rolesPretty = c.roles.map(r=>({entrenador_acreditado:'Acreditado',handler_1:'Handler 1',handler_2:'Handler 2',head_coach:'Head Coach',head_coach_suplente:'HC Suplente'}[r]||r)).join(', ');
    h+='<tr>';
    h+='<td><div style="font-weight:600">'+c.nombre+'</div></td>';
    h+='<td style="font-size:11px">'+(c.emails.join('<br>')||'<span style="color:var(--muted)">—</span>')+'</td>';
    h+='<td style="font-size:11px">'+rolesPretty+'</td>';
    h+='<td style="font-size:11px">'+(c.clubs.join(', ')||'<span style="color:var(--muted)">—</span>')+'</td>';
    h+='<td style="font-size:11px;color:var(--muted)">'+(c.atletas.length?c.atletas.length+' atleta'+(c.atletas.length!==1?'s':''):'—')+'</td>';
    h+='<td>'+(hasEmail
      ? '<button onclick="importCoach('+i+',this)" style="padding:5px 12px;border-radius:6px;border:1px solid var(--green);background:rgba(34,197,94,.1);color:var(--green);cursor:pointer;font-size:11px;font-family:Oswald;font-weight:700">Crear cuenta</button>'
      : '<span style="font-size:10px;color:var(--muted)">Sin email</span>'
    )+'</td>';
    h+='</tr>';
  });
  h+='</table></div>';
  h+='<div class="card" style="margin-top:14px;padding:14px 18px;background:rgba(245,158,11,.06);border-color:rgba(245,158,11,.3);font-size:12px;color:var(--muted)">';
  h+='<b style="color:var(--text)">Tip</b>: Para los <b>'+sinEmail+' entrenadores sin email</b>, puedes contactar al club o pedir el dato directo. Una vez que tengas el email, edita <code>entrenadores_centro_2026.json</code> a mano y recarga esta vista.';
  h+='</div>';
  return h;
}

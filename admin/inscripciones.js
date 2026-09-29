// admin.html — Inscripciones a campeonatos: aprobar y rechazar, la nómina, inscribir a mano, documentos, exportar y "ya compitió este año".
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// ═══════════════════════════════════════════
// APPROVE / REJECT INSCRIPCIONES
// ═══════════════════════════════════════════
window.setStatus=async function(insId,status){
  insId=decodeURIComponent(insId);
  const ins=ST.inscripciones.find(x=>x.id===insId);if(!ins)return;
  const old=ins.status;
  try{
    await updateDoc(doc(db,'inscripciones',insId),{status});
    await logAction('change_status',insId,old,status,{nombre:ins.nombre});
    // Aceptar una inscripción es aceptar también con qué club compite. Si se
    // inscribió con uno distinto al de su ficha, se cambió de club: la ficha se
    // pone al día sola.
    const sync=(status==='approved')?await _clubAlPadron(ins):null;
    showToast(`${ins.nombre}: ${status}`+(sync?` · club de su ficha: ${sync.antes||'—'} → ${sync.ahora}`:''),async()=>{
      await updateDoc(doc(db,'inscripciones',insId),{status:old});
      await _clubAlPadronRevertir(sync);
      await logAction('undo_status',insId,status,old,{nombre:ins.nombre});
      showToast('Estado revertido');
    });
  }catch(e){showToast('Error: '+e.message,null,true)}
}

window.deleteInsc=async function(insId){
  insId=decodeURIComponent(insId);
  const ins=ST.inscripciones.find(x=>x.id===insId);if(!ins)return;
  if(!confirm(`¿Eliminar a ${ins.nombre} de la nómina?`))return;
  try{
    await deleteDoc(doc(db,'inscripciones',insId));
    // Borrar también el doc privado asociado (pin, carnetURL, wadeURL).
    // No falla si no existe.
    try{await deleteDoc(doc(db,'inscripciones_private',insId));}catch(_){}
    await logAction('delete_inscripcion',insId,ins.nombre,'deleted',{evento:ins.evento,club:ins.club||''});
    showToast(`${ins.nombre} eliminado de nómina`);
  }catch(e){showToast('Error: '+e.message,null,true)}
}

// ═══════════════════════════════════════════
// SORT NOMINA
// ═══════════════════════════════════════════
window.sortNominaByEvent=async function(eventoId){
  const list=ST.inscripciones.filter(i=>i.evento===eventoId&&i.status!=='rejected');
  if(!list.length){showToast('No hay atletas',null,true);return}
  if(!confirm('Esto reordenará la nómina (hombres por categoría, luego mujeres). ¿Continuar?'))return;
  const wt=a=>parseFloat(String(a.categoria||'999').replace(/[^0-9.]/g,''))||999;
  const isM=a=>a.sexo==='Hombre'||a.sexo==='Masculino'||a.sexo==='M';
  list.sort((a,b)=>{
    const ma=isM(a),mb=isM(b);
    if(ma!==mb)return ma?-1:1;
    return wt(a)-wt(b);
  });
  // Update sortOrder field for each
  let order=1;
  for(const ins of list){
    try{
      await updateDoc(doc(db,'inscripciones',ins.id),{sortOrder:order});
      order++;
    }catch(e){console.warn('sort update fail',e)}
  }
  await logAction('sort_nomina',eventoId,null,`${list.length} athletes`);
  showToast(`Nómina ordenada: ${list.length} atletas`);
}

// ═══════════════════════════════════════════
// INSCRIBIR ATLETA MANUALMENTE
// ═══════════════════════════════════════════
window.openInscribirModal=function(){
  const evObj=(ST.eventos||[]).find(e=>e.name===ST.filterEv||e.id===ST.filterEv);
  const tieneUniversidad=(evObj?.extraCols||[]).includes('universidad');
  const el=document.createElement('div');
  el.id='inscribirModal';
  el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9990;display:flex;align-items:center;justify-content:center;padding:20px';
  el.innerHTML=`
  <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:28px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto">
    <div style="font-family:Oswald;font-size:18px;font-weight:700;letter-spacing:1px;margin-bottom:6px">Inscribir atleta manualmente</div>
    <p style="color:var(--muted);font-size:12px;margin-bottom:20px">Evento: <b style="color:var(--gold)">${ST.filterEv||'—'}</b></p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <label class="field" style="grid-column:span 2">
        <span>Buscar atleta (nombre o código)</span>
        <input id="im_search" class="inp" placeholder="ej: Karen Pulecio" oninput="inscribirSearch(this.value)" autocomplete="off">
        <div id="im_results" style="margin-top:4px;max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;display:none"></div>
      </label>
      <label class="field" style="grid-column:span 2">
        <span>Nombre completo</span>
        <input id="im_nombre" class="inp" placeholder="Karen Daniela Pulecio Giron">
      </label>
      <label class="field">
        <span>RUT</span>
        <input id="im_rut" class="inp" placeholder="22863335-6">
      </label>
      <label class="field">
        <span>Fecha de nacimiento</span>
        <input id="im_fechaNac" class="inp" placeholder="17/11/2002">
      </label>
      <label class="field">
        <span>Sexo</span>
        <select id="im_sexo" class="inp">
          <option value="Femenino">Femenino</option>
          <option value="Masculino">Masculino</option>
        </select>
      </label>
      <label class="field">
        <span>División</span>
        <select id="im_division" class="inp">
          <option value="Open">Open</option>
          <option value="Junior">Junior</option>
          <option value="Sub-junior">Sub-junior</option>
          <option value="Universitario">Universitario</option>
          <option value="Master I">Master I</option>
          <option value="Master II">Master II</option>
          <option value="Master III">Master III</option>
          <option value="Master IV">Master IV</option>
        </select>
      </label>
      <label class="field">
        <span>Categoría (kg)</span>
        <input id="im_categoria" class="inp" placeholder="ej: 69 o -69">
      </label>
      <label class="field">
        <span>Modalidad</span>
        <select id="im_modalidad" class="inp">
          <option value="">— Sin modalidad —</option>
          <option value="Powerlifting Classic">Powerlifting Classic</option>
          <option value="Powerlifting Equipado">Powerlifting Equipado</option>
          <option value="Powerlifting Classic + Only Bench Classic">Powerlifting Classic + Only Bench Classic</option>
          <option value="Powerlifting Equipado + Only Bench Equipado">Powerlifting Equipado + Only Bench Equipado</option>
          <option value="Powerlifting Universitario">Powerlifting Universitario</option>
          <option value="Only Bench Classic">Only Bench Classic</option>
          <option value="Only Bench Equipado">Only Bench Equipado</option>
          <option value="Olimpiadas Especiales">Olimpiadas Especiales</option>
        </select>
      </label>
      <label class="field">
        <span>Club</span>
        <input id="im_club" class="inp" placeholder="All Power CD">
      </label>
      ${tieneUniversidad?`
      <label class="field" style="grid-column:span 2">
        <span>Universidad</span>
        <input id="im_universidad" class="inp" placeholder="ej: Universidad de Chile">
      </label>`:`
      <label class="field" style="grid-column:span 2">
        <span>Universidad <span style="color:var(--muted)">(opcional)</span></span>
        <input id="im_universidad" class="inp" placeholder="ej: Universidad de Chile">
      </label>`}
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
      <button class="btn" onclick="document.getElementById('inscribirModal').remove()" style="background:transparent;border:1px solid var(--border)">Cancelar</button>
      <button class="btn btn-g" onclick="submitInscripcionManual()" style="padding:10px 24px;font-family:Oswald;font-size:14px;font-weight:700;letter-spacing:1px"><i class=yl-i-check></i> INSCRIBIR</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  el.addEventListener('click',e=>{if(e.target===el)el.remove()});
};

window.inscribirSearch=function(q){
  const res=document.getElementById('im_results');
  if(!q||q.length<2){res.style.display='none';return}
  const lower=q.toLowerCase();
  window._inscMatches=(ST.data||[]).filter(a=>(a.nombre||'').toLowerCase().includes(lower)||(a.codigo||'').toLowerCase().includes(lower)).slice(0,8);
  if(!window._inscMatches.length){res.style.display='none';return}
  res.style.display='block';
  res.innerHTML=window._inscMatches.map((a,i)=>`
    <div onclick="inscribirFill(${i})"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12px;display:flex;flex-direction:column;gap:2px"
      onmouseover="this.style.background='rgba(59,130,246,.12)'" onmouseout="this.style.background=''">
      <span style="font-weight:600;color:var(--text)">${a.nombre||''}</span>
      <span style="color:var(--muted)">${a.codigo||''} · ${a.club||''}</span>
    </div>`).join('');
};

window.inscribirFill=function(idx){
  const a=window._inscMatches[idx];
  if(!a)return;
  document.getElementById('im_search').value=a.nombre||'';
  document.getElementById('im_results').style.display='none';
  document.getElementById('im_nombre').value=a.nombre||'';
  document.getElementById('im_rut').value=a.rut||'';
  document.getElementById('im_fechaNac').value=a.fechaNac||'';
  document.getElementById('im_club').value=a.club||'';
  // Inferir sexo desde competencias
  const comps=a.competencias||[];
  const sexoComp=(comps.find(c=>c.sexo)||{}).sexo||'';
  const esFem=sexoComp.toLowerCase().includes('f')||sexoComp.toLowerCase().includes('mujer');
  document.getElementById('im_sexo').value=esFem?'Femenino':'Masculino';
  // Inferir categoría y división desde la competencia más reciente con datos
  const conCat=comps.filter(c=>c.categoria).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  if(conCat.length){
    const cat=String(conCat[0].categoria).replace(/[^0-9+]/g,'');
    document.getElementById('im_categoria').value=cat;
    const div=conCat[0].division||'';
    const divEl=document.getElementById('im_division');
    const opts=[...divEl.options].map(o=>o.value);
    const match=opts.find(o=>div.toLowerCase().includes(o.toLowerCase()));
    if(match)divEl.value=match;
  }
};

window.submitInscripcionManual=async function(){
  const nombre=document.getElementById('im_nombre').value.trim();
  const rut=document.getElementById('im_rut').value.trim();
  if(!nombre){showToast('Falta el nombre',null,true);return}
  if(!ST.filterEv){showToast('Selecciona un evento primero',null,true);return}
  const dup=ST.inscripciones.find(i=>i.evento===ST.filterEv&&i.nombre.toLowerCase()===nombre.toLowerCase());
  if(dup&&!confirm(`Ya existe una inscripción de "${nombre}" en este evento. ¿Agregar igual?`))return;
  const data={
    nombre,
    rut,
    sexo:document.getElementById('im_sexo').value,
    fechaNac:document.getElementById('im_fechaNac').value.trim(),
    division:document.getElementById('im_division').value,
    categoria:document.getElementById('im_categoria').value.trim(),
    modalidad:document.getElementById('im_modalidad').value,
    club:document.getElementById('im_club').value.trim(),
    universidad:document.getElementById('im_universidad').value.trim(),
    evento:ST.filterEv,
    status:'approved',
    timestamp:Date.now(),
    _manualAdmin:true
  };
  try{
    await addDoc(collection(db,'inscripciones'),data);
    await logAction('manual_inscripcion',ST.filterEv,null,nombre);
    showToast(`${nombre} inscrito/a en ${ST.filterEv}`);
    document.getElementById('inscribirModal').remove();
  }catch(e){
    showToast('Error: '+(e.message||e),null,true);
  }
};

// ═══════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════
window.exportData=function(){
  if(ST.adminInfo?.role!=='owner'&&!ST.adminInfo?.bootstrap){showToast('Solo el Owner puede descargar data.json',null,true);return;}
  const clean=ST.data.map(({_isPending,...a})=>a);
  const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob);
  const l=document.createElement('a');l.href=u;l.download='data.json';l.click();
  URL.revokeObjectURL(u);
  logAction('export','data.json',null,`${clean.length} athletes`);
}

// Sube data.json y opcionalmente records.json a Firebase Storage (public/data.json)
// para que el sitio los sirva automáticamente sin pasar por GitHub.
async function _uploadToStorage(dataArr, recObj){
  const _stg=getStorage(app);
  await uploadBytes(storageRef(_stg,'public/data.json'),
    new Blob([JSON.stringify(dataArr,null,2)],{type:'application/json'}),
    {contentType:'application/json',cacheControl:'public,max-age=60'});
  if(recObj){
    await uploadBytes(storageRef(_stg,'public/records.json'),
      new Blob([JSON.stringify(recObj,null,2)],{type:'application/json'}),
      {contentType:'application/json',cacheControl:'public,max-age=60'});
  }
}

window.syncDataJsonToStorage=async function(){
  if(ST.adminInfo?.role!=='owner'&&!ST.adminInfo?.bootstrap){showToast('Solo el Owner puede sincronizar',null,true);return;}
  if(!ST.data?.length){showToast('No hay datos cargados',null,true);return;}
  const btn=document.getElementById('btnSyncStorage');
  if(btn){btn.disabled=true;btn.textContent='Subiendo...';}
  try{
    const clean=ST.data.map(({_isPending,...a})=>a);
    await _uploadToStorage(clean,null);
    showToast(`data.json publicado en Storage (${clean.length} atletas). El sitio lo sirve automáticamente.`);
    await logAction('sync_storage','data.json',null,`${clean.length} athletes`);
  }catch(e){
    showToast('Error al subir a Storage: '+e.message,null,true);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Publicar data.json al sitio';}
  }
}

// ════════════════════════════════════════════════════════════════
// Ver TODOS los documentos subidos por un atleta (modal con previews)
// ════════════════════════════════════════════════════════════════
window.viewInsDocs = function(sid){
  const insId = decodeURIComponent(sid);
  const i = ST.inscripciones.find(x=>x.id===insId);
  if(!i) { showToast('Inscripción no encontrada', null, true); return; }
  const priv = ST.inscripcionesPrivate?.[insId] || {};

  // Mapeo de campos legacy → metadata del catálogo
  const LEGACY_MAP = {
    carnetURL:         { label: 'Carnet de Identidad', icon: '' },
    wadeURL:           { label: 'ADEL/WADA', icon: '' },
    carnetPhotoURL:    { label: 'Foto fondo blanco', icon: '' },
    consentimientoURL: { label: 'Consentimiento Menor', icon: '' },
    passportURL:       { label: 'Pasaporte', icon: '' },
    ipfConsentURL:     { label: 'Consentimiento IPF', icon: '' },
    notasURL:          { label: 'Concentración de Notas', icon: '' }
  };
  const NEW_MAP = (window.DOC_TYPES_CATALOG||{});
  // Los documentos propios del campeonato no están en el catálogo fijo: su
  // nombre vive en el evento. Sin esto, la tarjeta se titularía "x_med1".
  const _evDoc = (ST.eventos||[]).find(e=>e.id===i.evento) || {};
  const XTRA = {};
  (_evDoc.docsExtra||[]).forEach(d=>{ if(d&&d.key) XTRA['x_'+d.key]={label:d.label||d.key,icon:'',desc:d.desc||''}; });

  // Construir lista unificada de docs (sin duplicar)
  const docs = [];
  // 1) Primero del campo `docs` (nuevo sistema)
  if(priv.docs && typeof priv.docs==='object'){
    Object.entries(priv.docs).forEach(([k, url])=>{
      if(!url) return; // clave presente pero sin URL real → no mostrar tarjeta rota
      const meta = NEW_MAP[k] || XTRA[k] || { label: k, icon: '', desc: '' };
      docs.push({ key: k, url, label: meta.label, icon: meta.icon, source: 'docs' });
    });
  }
  // 2) Después los campos legacy que no estén ya cubiertos
  Object.entries(LEGACY_MAP).forEach(([field, meta])=>{
    const url = priv[field];
    if(!url) return;
    if(docs.some(d=>d.url===url)) return; // ya incluido
    docs.push({ key: field, url, label: meta.label, icon: meta.icon, source: 'legacy' });
  });

  const isImg = url => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);

  // Para agregar un documento que falta (o todos, en una inscripción hecha a
  // mano desde el panel): los tipos del catálogo, los de Olimpiadas Especiales y
  // los propios de este campeonato.
  const _tipos = Object.assign({}, NEW_MAP, window.DOCS_OE_ATLETA||{}, XTRA);
  const agregar = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-family:Oswald;font-size:11px;letter-spacing:2px;color:var(--gold)">AGREGAR DOCUMENTO</span>
      <select id="docAddTipo" class="inp" style="flex:1;min-width:220px">${Object.entries(_tipos).map(([k,v])=>`<option value="${esc(k)}">${esc(v.label||k)}</option>`).join('')}</select>
      <button onclick="replaceInsDocFile('${sid}',document.getElementById('docAddTipo').value)" style="padding:8px 14px;background:rgba(34,197,94,.15);border:1px solid var(--green);color:var(--green);border-radius:6px;cursor:pointer;font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px"><i class=yl-i-subir></i> SUBIR ARCHIVO</button>
    </div>`;
  let body = agregar;
  if(docs.length===0){
    body += `<div style="padding:40px;text-align:center;color:var(--muted)">Este atleta no tiene documentos subidos.</div>`;
  } else {
    body += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:18px">
      ${docs.map(d => `
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <div style="aspect-ratio:4/5;background:#0a1628;display:flex;align-items:center;justify-content:center;position:relative">
            ${isImg(d.url)
              ? `<img src="${esc(d.url)}" style="width:100%;height:100%;object-fit:cover" onerror="this.outerHTML='<div style=&quot;font-size:48px&quot;>${d.icon}</div>'">`
              : `<div style="font-size:64px">${d.icon}</div><div style="position:absolute;bottom:12px;font-family:Oswald;font-size:11px;color:var(--muted);letter-spacing:2px">PDF</div>`}
          </div>
          <div style="padding:10px 12px">
            <div style="font-family:Oswald;font-size:11px;letter-spacing:2px;color:var(--gold);font-weight:600">${d.icon} ${esc(d.label)}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <a href="${esc(d.url)}" target="_blank" rel="noopener" style="flex:1;padding:6px 10px;background:rgba(34,197,94,.15);border:1px solid var(--green);color:var(--green);border-radius:5px;text-align:center;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;text-decoration:none">↗ ABRIR</a>
              <a href="${esc(d.url)}" download style="padding:6px 10px;background:rgba(59,130,246,.15);border:1px solid var(--blue);color:var(--blue);border-radius:5px;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;text-decoration:none"></a>
            </div>
            <button onclick="replaceInsDocFile('${sid}','${d.key}')" style="width:100%;margin-top:6px;padding:6px 10px;background:rgba(212,168,67,.12);border:1px solid var(--gold);color:var(--gold);border-radius:5px;cursor:pointer;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px">REEMPLAZAR</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  // Modal overlay
  const ex = document.getElementById('docsModal'); if(ex) ex.remove();
  const m = document.createElement('div');
  m.id = 'docsModal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:40px';
  m.onclick = (e) => { if(e.target===m) m.remove(); };
  m.innerHTML = `<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;max-width:1100px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.5)">
    <div style="padding:18px 22px;background:linear-gradient(90deg,#0a1628,#152849);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-family:Oswald;font-size:11px;letter-spacing:3px;color:var(--gold)">DOCUMENTOS DE INSCRIPCIÓN</div>
        <div style="font-family:Oswald;font-size:20px;font-weight:700;color:var(--text);margin-top:4px">${esc(i.nombre)} <span style="color:var(--muted);font-weight:400">· ${esc(i.rut||'')}</span></div>
      </div>
      <button onclick="document.getElementById('docsModal').remove()" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:8px 14px;border-radius:6px;cursor:pointer;font-family:Oswald;font-size:12px"><i class=yl-i-cerrar></i> CERRAR</button>
    </div>
    <div style="overflow:auto">${body}</div>
  </div>`;
  document.body.appendChild(m);
};

window.replaceInsDocFile = function(sid, docKey){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='image/*,.pdf';
  inp.onchange=async()=>{
    const file=inp.files&&inp.files[0]; if(!file) return;
    const insId=decodeURIComponent(sid);
    const i=ST.inscripciones.find(x=>x.id===insId);
    if(!i){showToast('Inscripción no encontrada',null,true);return;}
    // Los documentos propios del campeonato y los de Olimpiadas Especiales (x_…)
    // no tienen campo viejo: van solo al mapa docs.
    const map=DOC_STORAGE_MAP[docKey]||(/^x_/.test(docKey)?{legacy:null,path:docKey}:null);
    if(!map){showToast('Tipo de documento desconocido: '+docKey,null,true);return;}
    const rutClean=String(i.rut||'').replace(/[^0-9kK]/g,'').toUpperCase();
    if(!rutClean){showToast('Esta inscripción no tiene RUT',null,true);return;}
    showToast('Subiendo archivo nuevo…');
    try{
      const storage=getStorage(app);
      const ts=Date.now();
      const MIME_EXT={'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','application/pdf':'pdf'};
      const ext=MIME_EXT[file.type]||(file.name.match(/\.([a-zA-Z0-9]+)$/)||[])[1]||'';
      const sref=storageRef(storage,`athlete_files/${rutClean}/${map.path}_${ts}${ext?'.'+ext:''}`);
      await uploadBytes(sref,file,{contentType:file.type||'application/octet-stream'});
      const url=await getDownloadURL(sref);
      // Actualizar AMBOS: campo legacy y el mapa docs (nuevo sistema)
      const update={};
      if(map.legacy)update[map.legacy]=url;
      const newKey=map.newKey||docKey;
      // si DOC_TYPES_CATALOG tiene newKey, escribir también en docs.{newKey}
      update['docs.'+newKey]=url;
      try{
        await updateDoc(doc(db,'inscripciones_private',insId),update);
      }catch(err){
        // Una inscripción agregada a mano desde el panel no tiene registro privado
        // (no pasó por el formulario). Se crea acá, con la forma que exigen las
        // reglas: un PIN de 4 dígitos, el RUT y los documentos.
        if(!(err&&(err.code==='not-found'||/No document to update/i.test(err.message||''))))throw err;
        const nuevo={pin:String(Math.floor(1000+Math.random()*9000)),rut:String(i.rut||''),ts:Date.now(),docs:{[newKey]:url}};
        if(map.legacy)nuevo[map.legacy]=url;
        await setDoc(doc(db,'inscripciones_private',insId),nuevo);
      }
      // refrescar estado local
      if(!ST.inscripcionesPrivate[insId])ST.inscripcionesPrivate[insId]={};
      if(map.legacy)ST.inscripcionesPrivate[insId][map.legacy]=url;
      if(!ST.inscripcionesPrivate[insId].docs)ST.inscripcionesPrivate[insId].docs={};
      ST.inscripcionesPrivate[insId].docs[newKey]=url;
      await logAction('replace_doc',insId,docKey,'(nuevo archivo)',{nombre:i.nombre});
      showToast('Documento guardado');
      // re-abrir el modal con los datos frescos
      document.getElementById('docsModal')?.remove();
      viewInsDocs(sid);
    }catch(e){
      console.error(e);
      showToast('Error: '+e.message,null,true);
    }
  };
  inp.click();
};

window.crearPerfilDebutante=async function(sid){
  const insId=decodeURIComponent(sid);
  const i=ST.inscripciones.find(x=>x.id===insId);
  if(!i){showToast('Inscripción no encontrada',null,true);return;}
  const priv=ST.inscripcionesPrivate?.[insId]||{};
  const rutRaw=i.rut||priv.rut||'';
  const rutClean=rutRaw.replace(/[^0-9kK]/g,'').toUpperCase();
  if(!rutClean){showToast('Esta inscripción no tiene RUT — no se puede crear el perfil',null,true);return;}
  // Verificar de nuevo que no existe
  const rutNorm=s=>String(s||'').replace(/[^0-9kK]/g,'').toUpperCase();
  const yaExiste=(ST.data||[]).find(a=>rutNorm(a.rut)===rutClean);
  if(yaExiste){showToast('Ya existe un perfil para este RUT: '+yaExiste.nombre,null,true);return;}
  // Generar código único
  const codigo=i.codigo||('FCP-'+new Date().getFullYear()+'-'+Math.random().toString(36).slice(2,6).toUpperCase());
  const fechaNac=i.fechaNac||priv.fechaNac||'';
  const pendDoc={
    nombre:i.nombre||'',
    rut:rutRaw,
    codigo,
    sexo:i.sexo||'',
    fechaNac,
    club:i.club||'',
    zona:i.comuna||'',
    debut:true,
    inscripcion_evento:i.evento||'',
    ts:serverTimestamp(),
  };
  try{
    await setDoc(doc(db,'atletas_pending',rutClean),pendDoc);
    // Agregar en memoria para que aparezca el banner y en búsquedas
    ST.data.push({...pendDoc,_isPending:true});
    await logAction('crear_perfil_debutante',rutClean,null,i.nombre);
    showToast('Perfil creado para '+i.nombre+' — ya visible en atleta.html');
    render();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

window.publicarDataJson=async function(){
  if(ST.adminInfo?.role!=='owner'&&!ST.adminInfo?.bootstrap){showToast('Solo el Owner puede publicar data.json',null,true);return;}
  const pendientes=(ST.data||[]).filter(a=>a._isPending);
  if(!pendientes.length){showToast('No hay debutantes pendientes',null,true);return;}
  if(!confirm(`¿Incorporar ${pendientes.length} debutante(s) al data.json?\n\n${pendientes.map(a=>a.nombre).join('\n')}\n\nSe publicará automáticamente en el sitio.`))return;

  // Build clean data.json: all athletes without internal flags
  const clean=ST.data.map(({_isPending,...a})=>{
    // Convert fechaNac yyyy-mm-dd → dd/mm/yyyy if needed (debutants come in HTML date format)
    if(a.debut&&a.fechaNac&&/^\d{4}-\d{2}-\d{2}$/.test(a.fechaNac)){
      const [y,m,d]=a.fechaNac.split('-');
      a.fechaNac=`${d}/${m}/${y}`;
    }
    // Ensure debut year is set
    if(!a.debut&&a.fechaNac){
      const m=a.fechaNac.match(/(\d{4})/);
      if(m)a.debut=m[1];
    }
    // Ensure required fields exist
    if(!a.competencias)a.competencias=[];
    if(!a.bestLifts)a.bestLifts={sq:0,bp:0,dl:0,total:0,glp:0,dots:0};
    return a;
  });

  // Auto-upload to Firebase Storage (publish without GitHub)
  let _uploaded=false;
  try{
    await _uploadToStorage(clean,null);
    _uploaded=true;
  }catch(e){
    console.warn('[publicar] Storage upload failed:',e.message);
    // Fallback: download locally
    const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='data.json';link.click();
    URL.revokeObjectURL(url);
  }

  // Mark as incorporated in Firestore
  const rutNorm=s=>String(s||'').replace(/[^0-9kK]/g,'').toUpperCase();
  let marcados=0;
  for(const a of pendientes){
    try{
      const rut=rutNorm(a.rut);
      if(!rut)continue;
      await setDoc(doc(db,'atletas_pending',rut),{incorporated:true,incorporatedAt:serverTimestamp()},{merge:true});
      marcados++;
    }catch(e){console.warn('[publicarDataJson] mark:',e.message);}
  }

  // Remove _isPending flag from local state so banner disappears
  ST.data.forEach(a=>delete a._isPending);

  await logAction('publicar_data_json',`${clean.length} atletas`,null,`${pendientes.length} debutantes`);
  showToast(_uploaded?`Publicado automáticamente (${clean.length} atletas). ${marcados} debutante(s) incorporados.`:`Descargado (${clean.length} atletas). ${marcados} debutante(s) incorporados. Sube el archivo al servidor.`);
  render();
}

// ── OPL Export ──────────────────────────────────────────────
window.exportOPL=function(eventoId){
  const list=ST.inscripciones.filter(i=>
    (!eventoId||i.evento===eventoId)&&i.status==='approved'
  );
  if(!list.length){showToast('Sin inscripciones aprobadas para exportar',null,true);return;}
  // OPL CSV format: Name,Sex,Event,Equipment,Age,AgeClass,BirthYearClass,Division,
  // BodyweightKg,WeightClassKg,Squat1Kg,...,TotalKg,Place,Federation,Date,MeetCountry,MeetState,MeetTown,MeetName
  const today=new Date().toISOString().slice(0,10);
  const evName=eventoId?(ST.eventos.find(e=>e.id===eventoId)?.name||eventoId):'FECHIPO 2026';
  const header='Name,Sex,Event,Equipment,Age,AgeClass,BirthYearClass,Division,BodyweightKg,WeightClassKg,Squat1Kg,Squat2Kg,Squat3Kg,Bench1Kg,Bench2Kg,Bench3Kg,Deadlift1Kg,Deadlift2Kg,Deadlift3Kg,TotalKg,Place,Federation,Date,MeetCountry,MeetState,MeetTown,MeetName';
  const rows=list.map(i=>{
    const sex=i.sexo==='Hombre'||i.sexo==='Masculino'||i.sexo==='M'?'M':'F';
    const modal=(i.modalidad||'').toLowerCase();
    const event=modal.includes('bench')?'B':'SBD';
    const equip=modal.includes('equip')?'Single-ply':'Raw';
    const catKg=parseFloat((i.categoria||'').replace(/[^0-9.+]/g,''))||'';
    let age='';
    if(i.fechaNac){try{const b=new Date(i.fechaNac);age=Math.floor((new Date()-b)/365.25/86400000);}catch(e){}}
    // Una sola traducción por división, los Master del más largo al más corto:
    // encadenando replace, "Master II" salía "Masters 1I" y "Sub-Junior"
    // "Sub-Juniorss" (el replace de "Junior" volvía a pegarle).
    const _d=String(i.division||'Open');
    const div=/master\s*(iv|4)\b/i.test(_d)?'Masters 4':/master\s*(iii|3)\b/i.test(_d)?'Masters 3'
      :/master\s*(ii|2)\b/i.test(_d)?'Masters 2':/master/i.test(_d)?'Masters 1'
      :/sub[\s-]?junior/i.test(_d)?'Sub-Juniors':/junior/i.test(_d)?'Juniors':_d;
    return [i.nombre,'',sex,event,equip,age||'','','',div,'',catKg,'','','','','','','','','','','','','CHL','RM','',evName].join(',');
  });
  const csv=[header,...rows].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='OPL_'+((eventoId||'fechipo').replace(/[^a-zA-Z0-9]/g,'_'))+'_'+today+'.csv';
  a.click();
  showToast('CSV OPL exportado — '+list.length+' atletas');
};

window.exportNominas=function(){
  const blob=new Blob([JSON.stringify(ST.nominas,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob);
  const l=document.createElement('a');l.href=u;l.download='nominas.json';l.click();
  URL.revokeObjectURL(u);
  logAction('export','nominas.json',null,`${ST.nominas.events?.length||0} events`);
}

window.exportInscripciones=function(){
  const blob=new Blob([JSON.stringify(ST.inscripciones,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob);
  const l=document.createElement('a');l.href=u;l.download='inscripciones.json';l.click();
  URL.revokeObjectURL(u);
  logAction('export','inscripciones',null,`${ST.inscripciones.length} entries`);
}

// Copiar al portapapeles el correo del atleta desde la nómina. navigator.clipboard
// no existe en contextos sin HTTPS ni en navegadores viejos, así que si falla se
// cae al textarea + execCommand, y si eso tampoco anda al menos se muestra el
// correo en un prompt para poder seleccionarlo a mano.
window.copiarCorreo=async function(mail){
  const txt=String(mail||'').trim();
  if(!txt)return;
  try{
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(txt);
      showToast('Correo copiado: '+txt);
      return;
    }
  }catch(e){/* sigue al plan B */}
  try{
    const ta=document.createElement('textarea');
    ta.value=txt;
    ta.style.cssText='position:fixed;top:-1000px;left:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok=document.execCommand('copy');
    document.body.removeChild(ta);
    if(ok){showToast('Correo copiado: '+txt);return;}
  }catch(e){/* sigue al plan C */}
  window.prompt('Copia el correo con Ctrl+C:',txt);
};

// ═══════════════════════════════════════════════════════════════
// ¿YA COMPITIÓ ESTE AÑO?  —  columna de la revisión de inscripciones
// ═══════════════════════════════════════════════════════════════
// Un atleta puede correr UN SOLO regional por año. Hasta ahora eso se controlaba
// de memoria, o abriendo el perfil de cada uno: con dos regionales abriendo
// inscripciones al mismo tiempo, es cuestión de tiempo que se cuele alguien.
//
// El dato ya lo tenemos: cada campeonato cerrado desde el livecast deja sus
// resultados en competition_results, con RUT. Así que la columna no inventa nada,
// solo mira lo que ya está guardado.
//
// Se cruza por RUT. Si el RUT no calza —o la inscripción vino sin RUT— se prueba
// por nombre normalizado, que es peor pero mejor que no avisar.
function _hRut(s){return String(s||'').replace(/[^0-9kK]/g,'').toUpperCase();}

function _hNom(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();}

// Al principio esto separaba los regionales del resto, dando por hecho que el
// Debutantes no gastaba cupo. No es así: también lo gasta. Así que la marca es
// una sola —compitió o no compitió— y en qué compitió se ve abriendo el ✓, que es
// donde la comisión tiene el detalle para decidir.
function _esRegional(ev){return /regional/i.test(String(ev||''));}

// Clave para saber si dos líneas son el MISMO campeonato escrito distinto. En los
// datos conviven "Regional Centro 2026" y "Campeonato Regional Centro FECHIPO
// 2026": son el mismo torneo, y sin esto el atleta aparecería compitiendo dos
// veces. Se sacan las palabras de relleno y las tarimas, y queda lo que identifica
// al campeonato. "Regional Centro" y "Regional Centro Sur" siguen siendo distintos.
// El separador antes de la tarima es opcional: cuando el resultado lo sube el
// atleta y no el livecast, el campeonato llega escrito a mano y el guión puede
// no venir. "Debutantes - Tarima 1" y "Debutantes Tarima 2" son el mismo.
function _evClave(ev){ return YLCampeonato.clave(ev); }   // compartido/campeonatos.js

// ── Qué campeonatos cuentan ──────────────────────────────────────────────────
// Al principio esto era "los de este año", calculado del calendario. Sirve para
// arrancar, pero el sistema va a estar corriendo muchos años y el circuito no
// siempre calza con el año calendario: hay campeonatos que no gastan cupo, otros
// que sí, y temporadas que cruzan diciembre. Así que la lista se puede elegir a
// mano desde el panel y queda guardada.
//
// Sin nada elegido se sigue comportando como antes —los del año en curso— para
// que funcione sin configurar nada. Los campeonatos que aparezcan DESPUÉS de
// guardar salen marcados como nuevos, para que no se cuelen sin que nadie decida.
function _cupoCfg(){ return ST.cupoCfg||null; }

function _cuentaEvento(evento,anioEv,anioActual){
  const cfg=_cupoCfg();
  if(cfg&&Array.isArray(cfg.seleccionados))return cfg.seleccionados.indexOf(_evClave(evento))>=0;
  return anioEv===anioActual;
}

async function cargarCupoCfg(){
  try{
    const s=await getDoc(doc(db,'config','participacion'));
    ST.cupoCfg=s.exists()?s.data():null;
  }catch(e){ ST.cupoCfg=null; }
  window._HIST_ANIO=null;
}

window.cupoToggle=function(clave){
  const H=_histAnio();
  const actuales=(_cupoCfg()&&_cupoCfg().seleccionados)||H.delAnio;
  const s=new Set(actuales);
  if(s.has(clave))s.delete(clave); else s.add(clave);
  ST.cupoCfg=Object.assign({},ST.cupoCfg||{},{seleccionados:[...s]});
  window._HIST_ANIO=null;
  render();
};

window.cupoGuardar=async function(){
  const H=_histAnio();
  const sel=(_cupoCfg()&&_cupoCfg().seleccionados)||H.delAnio;
  try{
    await setDoc(doc(db,'config','participacion'),
      {seleccionados:sel,vistos:H.todos.map(x=>x.clave),ts:new Date().toISOString(),por:ST.user?.email||''});
    ST.cupoCfg={seleccionados:sel,vistos:H.todos.map(x=>x.clave)};
    window._HIST_ANIO=null;
    showToast('Campeonatos guardados: '+sel.length+' cuentan para el control');
    render();
  }catch(e){ showToast('No se pudo guardar: '+e.message,null,true); }
};

window.cupoVolverAlAnio=function(){
  ST.cupoCfg=null; window._HIST_ANIO=null;
  setDoc(doc(db,'config','participacion'),{seleccionados:null,ts:new Date().toISOString()}).catch(()=>{});
  render();
};

window.cupoPanel=function(){ ST.cupoPanelOpen=!ST.cupoPanelOpen; render(); };

function _histAnio(){
  if(window._HIST_ANIO)return window._HIST_ANIO;
  const anio=String(new Date().getFullYear());
  const porRut={}, porNom={};
  const meter=(rut,nombre,it)=>{
    const k=_hRut(rut); if(k)(porRut[k]=porRut[k]||[]).push(it);
    const n=_hNom(nombre); if(n)(porNom[n]=porNom[n]||[]).push(it);
  };
  // Catálogo de TODO lo que aparece, para poder ofrecerlo en el selector.
  const catalogo={};
  const anioDe=(evento,fecha)=>
    String(fecha||'').slice(0,4)||(String(evento||'').match(/\b(20\d\d)\b/)||[])[1]||'';
  const cuenta=(evento,fecha)=>{
    const a=anioDe(evento,fecha);
    const clave=_evClave(evento);
    const c=catalogo[clave]||(catalogo[clave]={clave,nombre:evento||'',anio:a,n:0,conRes:false});
    c.n++;
    if((evento||'').length>c.nombre.length)c.nombre=evento;
    if(!c.anio&&a)c.anio=a;
    return _cuentaEvento(evento,a,anio);
  };
  // `compitio` separa al que estuvo en la tarima del que solo quedó anotado.
  // Inscribirse y después bajarse deja un registro sin resultado, y eso no es
  // haber competido: el cupo de la temporada no se gasta con la inscripción.
  const compitioDe=(r)=>{
    if(!r)return false;
    if(String(r.status||'').toUpperCase()==='DQ')return true;
    return (r.total||0)>0||(r.sq||0)>0||(r.bp||0)>0||(r.dl||0)>0;
  };
  const arma=(evento,fecha,categoria,division,modalidad,r,forzado)=>({
    evento:evento||'',fecha:String(fecha||''),regional:_esRegional(evento),
    categoria:categoria||'',division:division||'',modalidad:modalidad||'',
    compitio:forzado===true||compitioDe(r),
    total:(r||{}).total||0,estado:(r||{}).status||''});

  // 1) Lo cerrado desde el livecast.
  (ST.allCompResults||[]).forEach(d=>{
    if(!cuenta(d.evento,d.fecha))return;
    // Lo que sale del livecast al cerrar la competencia es, por definición, gente
    // que estuvo en la tarima: solo se publica a quien tiene total o quedó DQ.
    meter(d.rut,d.nombre,arma(d.evento,d.fecha,d.categoria,d.division,d.modalidad,d.resultado,true));
  });
  // 2) Y el histórico publicado (data.json). Sin esto faltaba el Campeonato
  //    Nacional 2026 de San Vicente, que nunca pasó por competition_results: los
  //    214 atletas que compitieron ahí salían con una ✗ como si no hubieran
  //    competido en todo el año.
  (ST.data||[]).forEach(a=>{
    (a.competencias||[]).forEach(c=>{
      if(!cuenta(c.evento,c.fecha))return;
      meter(a.rut,a.nombre,arma(c.evento,c.fecha,c.categoria,c.division,c.modalidad,c.resultado));
    });
  });
  // De qué campeonatos hay constancia de que alguien compitió. Sirve para saber
  // si de un campeonato tenemos resultados o solo la nómina: si solo hay nómina,
  // no se puede distinguir al que se bajó y no conviene dar a nadie por ausente.
  Object.keys(porRut).forEach(k=>porRut[k].forEach(it=>{
    const c=catalogo[_evClave(it.evento)];
    if(c&&it.compitio)c.conRes=true;
  }));
  // 3) Las inscripciones que siguen en pie. Es lo que separa al que participó del
  //    que se anotó y después se bajó: en data.json los dos quedan igual —una
  //    línea del campeonato sin resultado— y solo el que participó conserva su
  //    inscripción. Es lo que el perfil del atleta muestra como "inscripciones
  //    activas". Una rechazada no cuenta.
  (ST.inscripciones||[]).forEach(i=>{
    if(i.status==='rejected')return;
    const ev=(ST.eventos||[]).find(e=>e.id===i.evento);
    const nombre=(ev&&ev.name)||i.evento||'';
    if(!cuenta(nombre,''))return;
    meter(i.rut,i.nombre,arma(nombre,'',i.categoria,i.division,i.modalidad,null,true));
  });
  const todos=Object.values(catalogo).sort((a,b)=>
    String(b.anio).localeCompare(String(a.anio))||a.nombre.localeCompare(b.nombre));
  const delAnio=todos.filter(x=>x.anio===anio).map(x=>x.clave);
  return (window._HIST_ANIO={anio,porRut,porNom,todos,delAnio});
}

// Devuelve los campeonatos de este año de una persona, sin repetir. El Debutantes
// vino partido en "Tarima 1" y "Tarima 2": es un solo campeonato en dos tarimas,
// así que se junta para no mostrarlo dos veces.
function _histDe(rut,nombre){
  const H=_histAnio();
  let arr=H.porRut[_hRut(rut)];
  if(!arr||!arr.length)arr=H.porNom[_hNom(nombre)];
  if(!arr)return [];
  // Un campeonato por línea. Se junta el Debutantes, que vino partido en dos
  // tarimas, y las dos escrituras del mismo torneo entre las dos fuentes. De cada
  // grupo se muestra el nombre más completo y la fecha que exista.
  const porClave={};
  arr.forEach(it=>{
    const base=it.evento.replace(/\s*[-–—:]?\s*tarima\s*\d+\s*$/i,'').trim();
    const k=_evClave(it.evento);
    const y=porClave[k];
    if(!y){porClave[k]=Object.assign({},it,{evento:base});return;}
    if(it.compitio)y.compitio=true;
    if(base.length>y.evento.length)y.evento=base;
    if(!y.fecha&&it.fecha)y.fecha=it.fecha;
    if(!y.total&&it.total)y.total=it.total;
    if(!y.categoria&&it.categoria)y.categoria=it.categoria;
    if(!y.division&&it.division)y.division=it.division;
    if(!y.modalidad&&it.modalidad)y.modalidad=it.modalidad;
  });
  // Si del campeonato solo tenemos la nómina, no hay con qué distinguir: se deja
  // como participación, igual que antes. La duda se resuelve cuando se cargan sus
  // resultados.
  Object.keys(porClave).forEach(k=>{
    const cat=(H.todos||[]).find(c=>c.clave===k);
    if(cat&&!cat.conRes)porClave[k].compitio=true;
  });
  return Object.values(porClave).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
}

function _prioridadHtml(){
  return `<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(212,168,67,.28)">
    <div style="font-family:Oswald;font-size:10px;letter-spacing:1.5px;color:var(--gold);margin-bottom:3px">ORDEN DE PRIORIDAD SI FALTAN CUPOS · ANEXO 3</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:6px;line-height:1.5">Texto literal del Compendio de Normas de Clasificación FECHIPO 2026. <b>No dice en qué punto cae este atleta</b> — eso lo define la comisión técnica.</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px;line-height:1.5;padding:6px 9px;background:rgba(10,22,40,.5);border-radius:6px">${esc(PRIORIDAD_CUPOS_TOPE)}</div>
    <ol style="margin:0;padding-left:20px;font-size:11px;line-height:1.55;color:var(--text)">
      ${PRIORIDAD_CUPOS.map(t=>`<li style="padding:2px 0">${esc(t)}</li>`).join('')}
    </ol>
    <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.5;font-style:italic">${esc(PRIORIDAD_NOTA)}</div>
  </div>`;
}

// La marca de la columna: un ✓ si compitió este año, una ✗ si no. Sin colores ni
// etiquetas — todos los campeonatos del año gastan cupo, así que no hay nada que
// distinguir a simple vista. El ✓ se abre y ahí está el detalle.
// El detalle que se abre bajo el ✓: en qué compitió este año y, debajo, el
// recordatorio del orden de prioridad. Lo usan las dos pantallas —revisión de
// inscripciones y nóminas— así que vive en un solo lugar.
function _detalleHist(hist,anio){
  const nComp=hist.filter(x=>x.compitio).length;
  const nSolo=hist.length-nComp;
  return `<div style="font-family:Oswald;font-size:10px;letter-spacing:1.5px;color:var(--gold);margin-bottom:7px">
      COMPITIÓ EN ${anio} — ${nComp} campeonato${nComp===1?'':'s'}${nSolo?` <span style="color:var(--muted);letter-spacing:1px">· ${nSolo} inscripción${nSolo===1?'':'es'} sin competir</span>`:''}</div>
    ${hist.map(x=>`<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;padding:3px 0;border-top:1px solid rgba(29,49,80,.35)">
      <span style="font-size:10px;color:var(--muted);min-width:74px;font-family:Oswald">${esc(x.fecha||'—')}</span>
      <span style="font-size:12px;color:var(--text)">${esc(x.evento)}</span>
      <span style="font-size:10px;color:var(--muted)">${esc(x.categoria||'')}${x.division?' · '+esc(x.division):''}${x.modalidad?' · '+esc(x.modalidad):''}${x.total?' · '+x.total+' kg':''}${x.estado&&x.estado!=='OK'?' · '+esc(x.estado):''}</span>
      ${x.compitio?'':'<span style="font-size:10px;color:var(--muted);border:1px solid var(--border);border-radius:5px;padding:1px 6px">solo inscrito — sin resultado</span>'}
    </div>`).join('')}
    <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.5">
      Sale de los resultados ya cargados en YourLift. Un campeonato que no se cerró desde acá no aparece.</div>
    ${_prioridadHtml()}`;
}

// El selector de campeonatos. Va arriba de la tabla, plegado: se abre cuando hay
// que decidir y no estorba el resto del tiempo.
function _cupoSelectorHtml(){
  const H=_histAnio();
  const cfg=_cupoCfg();
  const sel=new Set((cfg&&cfg.seleccionados)||H.delAnio);
  const vistos=new Set((cfg&&cfg.vistos)||[]);
  const aMano=!!(cfg&&Array.isArray(cfg.seleccionados));
  const nuevos=aMano?H.todos.filter(x=>!vistos.has(x.clave)):[];
  let h='<div style="padding:8px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);display:flex;gap:10px;align-items:center;flex-wrap:wrap">';
  h+=`<span>Contando <b style="color:var(--gold)">${sel.size}</b> campeonato${sel.size===1?'':'s'} `
    +(aMano?'elegidos a mano':`de ${H.anio}`)+'.</span>';
  h+=`<button onclick="cupoPanel()" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:Oswald">${ST.cupoPanelOpen?'Cerrar':'Elegir cuáles'}</button>`;
  if(nuevos.length)h+=`<span style="color:var(--orange)"><i class=yl-i-alerta></i> ${nuevos.length} campeonato${nuevos.length===1?'':'s'} nuevo${nuevos.length===1?'':'s'} sin decidir</span>`;
  h+='</div>';
  if(!ST.cupoPanelOpen)return h;

  h+='<div style="padding:12px 14px;border-bottom:1px solid var(--border);background:rgba(10,22,40,.4)">';
  h+='<div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.55">Marca los campeonatos que gastan cupo. Sirve para cuando el circuito no calza con el año calendario, o cuando algún torneo no debe contar. Si no se guarda nada, se usan los del año en curso.</div>';
  let anioAct='';
  H.todos.forEach(x=>{
    if(x.anio!==anioAct){anioAct=x.anio;h+=`<div style="font-family:Oswald;font-size:10px;letter-spacing:1.5px;color:var(--gold);margin:10px 0 5px">${esc(anioAct||'sin año')}</div>`;}
    const on=sel.has(x.clave), nuevo=aMano&&!vistos.has(x.clave);
    h+=`<label style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;cursor:pointer;color:${on?'var(--text)':'var(--muted)'}">
      <input type="checkbox" ${on?'checked':''} onchange="cupoToggle('${esc(x.clave)}')" style="cursor:pointer">
      <span>${esc(x.nombre)}</span>
      <span style="font-size:10px;color:var(--muted)">· ${x.n} registro${x.n===1?'':'s'}</span>
      ${nuevo?'<span style="font-size:9px;font-family:Oswald;letter-spacing:1px;background:rgba(245,158,11,.18);color:var(--orange);padding:1px 6px;border-radius:8px">NUEVO</span>':''}
    </label>`;
  });
  h+='<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">';
  h+='<button class="btn btn-g" onclick="cupoGuardar()" style="padding:6px 14px;font-size:11px">Guardar</button>';
  h+='<button onclick="cupoVolverAlAnio()" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 14px;border-radius:6px;font-size:11px;cursor:pointer;font-family:Oswald">Volver a "los del año en curso"</button>';
  h+='</div></div>';
  return h;
}

// El Campeonato Nacional se distingue: quien viene de ahí entra en la lista de
// priorización por los puntos 5 y 6 del Anexo 3 (último registro en el Nacional
// hasta el segundo lugar, y campeones de categoría). No es lo mismo que haber
// corrido un regional, y la comisión lo trata distinto.
// El Nacional Universitario NO cuenta acá: es otra línea competitiva.
function _esNacional(ev){
  const s=String(ev||'');
  return /nacional/i.test(s)&&!/universitari/i.test(s);
}

function _marcaCompitio(hist,id,cargando,abierto){
  if(cargando)return '<span style="color:var(--muted);font-size:11px">…</span>';
  // La ✓ es de haber COMPETIDO. El que se inscribió y después se bajó queda en la
  // nómina sin resultado: eso no gasta el cupo de la temporada y no puede salir
  // marcado como si hubiera competido.
  const compitio=hist.filter(x=>x.compitio);
  if(!compitio.length){
    const soloInscrito=hist.length>0;
    return `<span title="${soloInscrito?'Se inscribió pero no hay resultado suyo: no compitió':'Sin competencias registradas este año'}" style="color:var(--muted);font-family:Oswald;font-size:14px;font-weight:700"><i class=yl-i-cruz></i>${soloInscrito?'<span style="font-size:9px;letter-spacing:.5px;opacity:.8"> solo inscrito</span>':''}</span>`;
  }
  hist=compitio;
  const nac=hist.some(x=>_esNacional(x.evento));
  const col=nac?'var(--gold)':'var(--text)';
  return `<button onclick="apprToggleHist('${esc(id||'')}')" title="${nac?'Compitió en el Campeonato Nacional — entra en la lista de priorización':'Ver en qué compitió'}"
    style="cursor:pointer;background:transparent;border:1px solid ${nac?'var(--gold)':'var(--border)'};border-radius:7px;
    padding:3px 10px;color:${col};font-family:Oswald;font-size:14px;font-weight:700">
    <i class=yl-i-check></i> <span style="opacity:.5;font-size:9px">${abierto?'▴':'▾'}</span></button>`;
}

function _hCargando(){return !(ST.allCompResults||[]).length;}

window.apprToggleHist=function(id){
  ST.apprHist=ST.apprHist||{};
  ST.apprHist[id]=!ST.apprHist[id];
  // En Revisión inscripciones se redibuja solo la tabla, para no perder el texto
  // del buscador. En Nóminas no hay una tabla aparte que redibujar.
  const el=document.getElementById('apprList');
  if(el&&ST.view==='approvals')el.innerHTML=apprListHtml();
  else render();
};

function apprListHtml(){
  const tab=ST.apprTab||'pending';
  const q=(ST.apprSearch||'').toLowerCase().trim();
  let list=ST.inscripciones.filter(i=>((i.status||'approved')===tab));
  if(q) list=list.filter(i=>((i.nombre||'')+' '+(i.club||'')+' '+(i.evento||'')+' '+(i.rut||'')).toLowerCase().includes(q));
  list.sort((a,b)=>((b.timestamp&&b.timestamp.seconds||0)-(a.timestamp&&a.timestamp.seconds||0)));
  const acceptBtn=sid=>`<button class="btn btn-g" style="padding:5px 10px;font-size:10px;margin:2px 3px 0 0" onclick="setStatus('${sid}','approved')"><i class=yl-i-check></i> Aceptar</button>`;
  const rejectBtn=(sid,lbl)=>`<button class="btn btn-r" style="padding:5px 10px;font-size:10px;margin:2px 3px 0 0" onclick="setStatus('${sid}','rejected')"><i class=yl-i-cruz></i> ${lbl}</button>`;
  const reviewBtn=sid=>`<button onclick="setStatus('${sid}','pending')" style="background:rgba(212,168,67,.15);border:1px solid var(--gold);color:var(--gold);padding:5px 10px;font-size:10px;border-radius:6px;cursor:pointer;font-family:Oswald;margin:2px 3px 0 0">↺ A revisión</button>`;
  const acts=(sid,s)=>{
    if(s==='pending')  return acceptBtn(sid)+rejectBtn(sid,'Rechazar');
    if(s==='approved') return reviewBtn(sid)+rejectBtn(sid,'Cancelar');
    return acceptBtn(sid)+reviewBtn(sid); // rejected
  };
  const H=_histAnio();
  const cargando=!(ST.allCompResults||[]).length;
  const rows=list.map(i=>{
    const d=i.timestamp?new Date(i.timestamp.seconds?i.timestamp.seconds*1000:i.timestamp):null;
    const sid=encodeURIComponent(i.id||'');
    const hist=cargando?[]:_histDe(i.rut,i.nombre);
    const abierto=(ST.apprHist||{})[i.id];
    const marca=_marcaCompitio(hist,i.id,cargando,abierto);
    let fila=`<tr>
      <td style="font-size:10px;color:var(--muted)">${d?d.toLocaleDateString('es-CL'):'—'}</td>
      <td>${esc(i.nombre)}<br><span style="font-size:9px;color:var(--muted)">${esc(i.rut||'')} · ${esc(i.sexo||'')} · ${esc(i.division||'')}</span>
        ${(i.bloqueoAvisado||[]).length?`<div style="margin-top:3px;font-size:10px;color:var(--red);line-height:1.4"><i class=yl-i-alerta></i> Se inscribió con el aviso a la vista: ya tenía ${esc((i.bloqueoAvisado||[]).join(' · '))}</div>`:''}
        ${i.declaraMayorEdad?`<div style="margin-top:3px;font-size:10px;color:#60a5fa;line-height:1.4"><i class=yl-i-alerta></i> Declaró ser mayor de edad y no subió el consentimiento del tutor — la fecha que teníamos era ${esc(i.declaraMayorFecha||'(sin fecha)')}. Confirmar con el carnet.</div>`:''}</td>
      <td style="font-size:10px">${esc(i.evento||'')}</td>
      <td><span class="badge b-y">${esc(i.categoria||'?')}</span></td>
      <td style="font-size:11px"><span style="display:inline-flex;align-items:center;gap:5px">${window.clubLogoImg?window.clubLogoImg(i.club,18,'background:var(--bg);padding:1px;'):''}${esc(i.club||'—')}</span></td>
      <td style="text-align:center;white-space:nowrap">${marca}</td>
      <td style="white-space:nowrap">${acts(sid,tab)}</td>
    </tr>`;
    if(abierto&&hist.length){
      fila+=`<tr><td colspan="7" style="background:rgba(10,22,40,.55);padding:10px 14px">${_detalleHist(hist,H.anio)}</td></tr>`;
    }
    return fila;
  }).join('');
  const nCon=cargando?0:list.filter(i=>_histDe(i.rut,i.nombre).length).length;
  return `${_cupoSelectorHtml()}${nCon?`<div style="padding:9px 14px;background:rgba(212,168,67,.08);border-bottom:1px solid rgba(212,168,67,.25);font-size:12px;color:var(--muted)">
      <b style="color:var(--gold)">${nCon}</b> de estas inscripciones ${nCon===1?'es de un atleta que ya compitió':'son de atletas que ya compitieron'} en ${H.anio}. Toca el <i class=yl-i-check></i> para ver dónde.</div>`:''}
    <table class="tbl">
      <tr><th>Fecha</th><th>Nombre</th><th>Evento</th><th>Cat.</th><th>Club</th><th title="Si ya compitió este año, según los resultados cargados en YourLift">Compitió ${H.anio}</th><th>Acción</th></tr>
      ${rows}
    </table>
    ${list.length===0?`<div class="empty">${q?'Sin resultados para la búsqueda':'No hay inscripciones en este estado'}</div>`:''}`;
}

window.apprFilter=function(v){ST.apprSearch=v;const el=document.getElementById('apprList');if(el)el.innerHTML=apprListHtml();};

window.openInsModal=function(){
  _insWork={evento:ST.filterEv||'',codigo:'',modalidad:'Powerlifting Classic',
            division:'Open',categoria:'',q:''};
  const ov=document.createElement('div'); ov.id='insModal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
  document.body.appendChild(ov);
  window.renderInsModal();
};

window.renderInsModal=function(){
  const ov=document.getElementById('insModal'); if(!ov)return;
  const campo='width:100%;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box';
  const evs=[...new Set([...(ST.eventos||[]).map(e=>e.name||e.id),
                         ...(ST.inscripciones||[]).map(i=>i.evento)])].filter(Boolean).sort();
  const q=(_insWork.q||'').toLowerCase().trim();
  const hits=q?(ST.data||[]).filter(a=>((a.nombre||'')+' '+(a.rut||'')+' '+(a.codigo||'')).toLowerCase().includes(q)).slice(0,8):[];
  const sel=(ST.data||[]).find(a=>a.codigo===_insWork.codigo);
  ov.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px;max-width:460px;width:100%;max-height:90vh;overflow:auto">
    <div style="font-family:Oswald;font-size:19px;font-weight:700;letter-spacing:1px;margin-bottom:4px">AGREGAR INSCRIPCIÓN</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:14px">Para un atleta que compite pero no alcanzó a inscribirse. Queda aceptada.</div>
    <div style="display:grid;gap:9px">
      <select id="ins_ev" style="${campo}" onchange="insSet('evento',this.value)">
        <option value="">Campeonato…</option>
        ${evs.map(e=>`<option value="${esc(e)}"${_insWork.evento===e?' selected':''}>${esc(e)}</option>`).join('')}
      </select>
      ${sel
        ? `<div style="display:flex;gap:10px;align-items:center;background:var(--bg);border:1px solid var(--green);border-radius:8px;padding:9px 11px">
             <div style="flex:1"><div style="font-weight:600;font-size:13px">${esc(sel.nombre)}</div>
             <div style="font-size:11px;color:var(--muted)">${esc(sel.rut||'')} · ${esc(sel.codigo||'')}${sel.club?' · '+esc(sel.club):''}</div></div>
             <button class="btn btn-o" style="padding:5px 10px;font-size:11px" onclick="insSet('codigo','',1)">Cambiar</button></div>`
        : `<input id="ins_q" style="${campo}" placeholder="Buscar atleta por nombre, RUT o código…" value="${esc(_insWork.q||'')}" oninput="insBuscar(this)">
           ${hits.map(a=>`<div onclick="insSet('codigo','${esc(a.codigo)}',1)" style="padding:7px 11px;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px">
             ${esc(a.nombre)} <span style="color:var(--muted)">· ${esc(a.rut||'')}</span></div>`).join('')}
           ${q&&!hits.length?'<div style="font-size:12px;color:var(--muted);padding:4px 2px">Sin resultados en el padrón.</div>':''}`}
      <select id="ins_mod" style="${campo}" onchange="insSet('modalidad',this.value)">
        ${['Powerlifting Classic','Powerlifting Equipado','Powerlifting Classic + Only Bench Classic','Powerlifting Equipado + Only Bench Equipado','Only Bench Classic','Only Bench Equipado','Powerlifting Universitario','Olimpiadas Especiales']
          .map(m=>`<option${_insWork.modalidad===m?' selected':''}>${m}</option>`).join('')}
      </select>
      <div style="display:flex;gap:9px">
        <select id="ins_div" style="${campo}" onchange="insSet('division',this.value)">
          ${['Sub-Junior','Junior','Open','Master I','Master II','Master III','Master IV','Universitario']
            .map(d=>`<option${_insWork.division===d?' selected':''}>${d}</option>`).join('')}
        </select>
        <input id="ins_cat" style="${campo}" placeholder="Categoría (-69 kg)" value="${esc(_insWork.categoria||'')}" oninput="insSet('categoria',this.value)">
      </div>
    </div>
    <div style="display:flex;gap:9px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-o" onclick="document.getElementById('insModal').remove()">Cancelar</button>
      <button class="btn btn-g" onclick="insGuardar()"${(!_insWork.evento||!_insWork.codigo)?' disabled':''}>Agregar</button>
    </div>
  </div>`;
}

// Los campos del modal se cambian por acá y no escribiendo en _insWork desde el
// HTML: un manejador en línea se evalúa en el ámbito global y no ve las variables
// del módulo, así que `oninput="_insWork.q=this.value"` no hacía nada. El buscador
// no buscaba y el modal quedaba muerto.
window.insSet=function(campo,valor,redibujar){
  if(!_insWork)return;
  _insWork[campo]=valor;
  if(redibujar)window.renderInsModal();
};

window.insBuscar=function(el){
  if(!_insWork)return;
  _insWork.q=el.value;
  window.renderInsModal();
  // Redibujar la lista se lleva el foco: hay que devolverlo con el cursor al
  // final, si no se escribe una letra y hay que volver a hacer clic.
  const n=document.getElementById('ins_q');
  if(n){ n.focus(); n.setSelectionRange(n.value.length,n.value.length); }
};

window.insGuardar=async function(){
  const a=(ST.data||[]).find(x=>x.codigo===_insWork.codigo);
  if(!a||!_insWork.evento){ showToast('Falta el campeonato o el atleta',null,true); return; }
  const rutLimpio=String(a.rut||'').replace(/[^0-9kK]/g,'');
  if(!rutLimpio){ showToast('Ese atleta no tiene RUT en el padrón',null,true); return; }
  // El id se arma igual que en el formulario público: {evento}_{rut sin puntos}.
  // Si ya existe una inscripción de esa persona en ese campeonato, es la misma
  // y hay que avisar en vez de pisarla.
  const id=`${_insWork.evento}_${rutLimpio}`;
  if((ST.inscripciones||[]).some(i=>i.id===id)){
    showToast(a.nombre+' ya tiene inscripción en ese campeonato',null,true); return;
  }
  const cat=String(_insWork.categoria||'').trim();
  try{
    await setDoc(doc(db,'inscripciones',id),{
      evento:_insWork.evento, nombre:a.nombre, rut:a.rut, codigo:a.codigo,
      sexo:a.sexo||'', club:a.club||'', fechaNac:a.fechaNac||'',
      modalidad:_insWork.modalidad, division:_insWork.division,
      categoria:cat&&!/kg/i.test(cat)?cat+' kg':cat,
      status:'approved', timestamp:serverTimestamp(),
      // Queda anotado que no vino del formulario: no tiene PIN ni documentos, y
      // el que la revise después tiene que poder saber por qué.
      origen:'panel', creadaPor:ST.user?.email||'admin',
    });
    // Registro privado, para poder subirle documentos desde el panel. Con la
    // forma que piden las reglas (PIN de 4 dígitos); si falla, no se pierde la
    // inscripción: se crea solo al subir el primer documento.
    try{ await setDoc(doc(db,'inscripciones_private',id),{pin:String(Math.floor(1000+Math.random()*9000)),rut:String(a.rut||''),ts:Date.now(),docs:{}}); }
    catch(e){ console.warn('[insGuardar] registro privado',e); }
    await logAction('crear_inscripcion',id,null,'aceptada',{nombre:a.nombre,evento:_insWork.evento});
    showToast(a.nombre+' agregado a '+_insWork.evento);
    const ov=document.getElementById('insModal'); if(ov)ov.remove();
  }catch(e){ showToast('Error: '+e.message,null,true); }
};

function renderApprovals(){
  const tab=ST.apprTab||'pending';
  const c=s=>ST.inscripciones.filter(i=>((i.status||'approved')===s)).length;
  const tabBtn=(id,label,n)=>`<button onclick="ST.apprTab='${id}';render()" style="padding:9px 18px;border-radius:9px;border:1px solid ${tab===id?'var(--gold)':'var(--border)'};background:${tab===id?'rgba(212,168,67,.12)':'transparent'};color:${tab===id?'var(--gold)':'var(--muted)'};font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer">${label} (${n})</button>`;
  return `
    <div class="h1">Revisión inscripciones</div>
    <p class="subtitle">Aceptar · dejar en revisión · rechazar (puedes mover una en cualquier dirección)</p>
    <div style="display:flex;gap:10px;margin:12px 0 14px;flex-wrap:wrap">
      ${tabBtn('pending','En revisión',c('pending'))}
      ${tabBtn('approved','Aceptadas',c('approved'))}
      ${tabBtn('rejected','Rechazadas',c('rejected'))}
      <button class="btn btn-g" onclick="openInsModal()" style="padding:9px 16px;font-size:12px">+ Agregar inscripción</button>
    </div>
    <input type="text" value="${esc(ST.apprSearch||'')}" oninput="apprFilter(this.value)" placeholder="Buscar por nombre, RUT, club o evento…" style="width:100%;max-width:380px;margin-bottom:12px;background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:13px;font-family:DM Sans">
    <div class="card" style="padding:0;overflow-x:auto" id="apprList">${apprListHtml()}</div>`;
}

function renderEditRequests(){
  const reqs=ST.editRequests||[];
  const rows=reqs.map(r=>{
    const ins=ST.inscripciones.find(x=>x.id===r.inscripcionId);
    const priv=ST.inscripcionesPrivate[r.inscripcionId];
    const rid=encodeURIComponent(r.id);
    const pinOK=priv?(priv.pin===r.pin):null;
    const pinBadge=pinOK===true
      ?`<span style="background:rgba(34,197,94,.15);color:#22c55e;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">PIN <i class=yl-i-check></i></span>`
      :pinOK===false
        ?`<span style="background:rgba(239,68,68,.15);color:#ef4444;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">PIN <i class=yl-i-cruz></i></span>`
        :`<span style="background:rgba(160,160,160,.15);color:var(--muted);padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">sin privado</span>`;
    const d=r.ts?new Date(r.ts.seconds?r.ts.seconds*1000:r.ts):null;
    const changes=r.changes||{};
    const changesHtml=Object.keys(changes).map(k=>{
      const cur=ins?ins[k]:undefined;
      const nv=changes[k];
      const same=String(cur||'')===String(nv||'');
      return `<div style="padding:2px 0;${same?'opacity:.5':''}"><span style="color:var(--muted);font-size:10px">${esc(k)}:</span> <span style="text-decoration:${same?'none':'line-through'};color:var(--muted);font-size:11px">${esc(String(cur||'—'))}</span> → <span style="color:${same?'var(--muted)':'var(--gold)'};font-size:11px;font-weight:600">${esc(String(nv||'—'))}</span></div>`;
    }).join('');
    return `<tr>
      <td style="font-size:10px;color:var(--muted)">${d?d.toLocaleString('es-CL'):'—'}</td>
      <td>${esc(ins?ins.nombre:'(?)')}<br><span style="font-size:9px;color:var(--muted)">${esc(r.rut||'')}</span></td>
      <td style="font-size:10px">${esc(ins?ins.evento:r.inscripcionId)}</td>
      <td>${pinBadge}<div style="font-size:10px;color:var(--muted);margin-top:2px">enviado: ${esc(r.pin||'')}</div></td>
      <td style="font-size:11px;max-width:340px">${changesHtml||'<span style="color:var(--muted);font-size:10px">sin cambios</span>'}</td>
      <td>
        <button class="btn btn-g" style="padding:5px 10px;font-size:10px" onclick="approveEditRequest('${rid}')"><i class=yl-i-check></i> APROBAR</button>
        <button class="btn btn-r" style="padding:5px 10px;font-size:10px;margin-top:4px" onclick="rejectEditRequest('${rid}')"><i class=yl-i-cruz></i> RECHAZAR</button>
      </td>
    </tr>`;
  }).join('');
  return `
    <div class="h1">Solicitudes de edición</div>
    <p class="subtitle">${reqs.length} solicitudes pendientes · el PIN se valida contra inscripciones_private</p>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="tbl">
        <tr><th>Fecha</th><th>Atleta</th><th>Evento</th><th>PIN</th><th>Cambios propuestos</th><th>Acción</th></tr>
        ${rows}
      </table>
      ${reqs.length===0?'<div class="empty">No hay solicitudes pendientes </div>':''}
    </div>`;
}

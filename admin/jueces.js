// admin.html — La base de jueces (referees) y la planilla de FECHIPO.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

function refClave(r){
  const cat=/1/.test(String(r&&r.categoria||''))?'1':'2';
  const amb=/interna/i.test(String(r&&r.ambito||''))?'internacional':'nacional';
  return amb+'|'+cat;
}

async function refEnsureLoaded(){
  if(ST._refLoaded)return;
  ST._refLoaded='loading';
  try{
    const snap=await getDocs(collection(db,'referees'));
    ST.referees=snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||'')));
    ST._refError=null;
  // Si Firestore rechaza la lectura hay que decirlo. Antes se tragaba el error y
  // la pantalla quedaba igual que una base recién creada —"Sin jueces cargados
  // todavía", todos los contadores en cero—, que es exactamente lo que se ve
  // cuando falta la regla de la colección. Son dos problemas distintos y desde
  // afuera se veían iguales.
  }catch(e){ console.warn('[referees]',e.message); ST.referees=[]; ST._refError=e; }
  ST._refLoaded=true; render();
}

window.openRefModal=function(id){
  const src=id?(ST.referees||[]).find(x=>x.id===id):null;
  _refWork=src?JSON.parse(JSON.stringify(src)):{nombre:'',rut:'',categoria:'Cat. 2',ambito:'nacional',fotoUrl:''};
  const ov=document.createElement('div'); ov.id='refModal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  const campo='width:100%;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px';
  ov.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px;max-width:460px;width:100%;max-height:90vh;overflow:auto">
    <div style="font-family:Oswald;font-size:19px;font-weight:700;letter-spacing:1px;margin-bottom:14px">${id?'EDITAR JUEZ':'NUEVO JUEZ'}</div>
    <div style="display:grid;gap:9px">
      <input id="ref_nom" style="${campo}" placeholder="Nombre completo" value="${esc(_refWork.nombre||'')}">
      <input id="ref_rut" style="${campo}" placeholder="RUT (con o sin puntos)" value="${esc(_refWork.rut||'')}"${id?' disabled title="El RUT identifica al juez: para cambiarlo hay que crearlo de nuevo"':''}>
      <select id="ref_amb" style="${campo}" onchange="refPreview()">
        <option value="nacional"${_refWork.ambito!=='internacional'?' selected':''}>Nacional (FECHIPO)</option>
        <option value="internacional"${_refWork.ambito==='internacional'?' selected':''}>Internacional (IPF)</option>
      </select>
      <select id="ref_cat" style="${campo}" onchange="refPreview()">
        <option value="Cat. 1"${/1/.test(_refWork.categoria||'')?' selected':''}>Categoría 1</option>
        <option value="Cat. 2"${!/1/.test(_refWork.categoria||'')?' selected':''}>Categoría 2</option>
      </select>
      <div style="display:flex;gap:12px;align-items:center;margin-top:2px">
        <div id="ref_fotoBox" style="width:64px;height:64px;border-radius:10px;overflow:hidden;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${_refWork.fotoUrl?`<img src="${esc(_refWork.fotoUrl)}" style="width:100%;height:100%;object-fit:cover">`:'<span style="font-size:10px;color:var(--muted)">sin foto</span>'}
        </div>
        <div style="flex:1">
          <label class="btn" style="display:inline-block;padding:7px 13px;font-size:11px;cursor:pointer">Subir foto de uniforme
            <input type="file" accept="image/*" onchange="refFoto(this)" style="display:none"></label>
          <div id="ref_fotoSt" style="font-size:10px;color:var(--muted);margin-top:5px">Se convierte a WebP antes de subir</div>
        </div>
      </div>
      <div id="ref_prev" style="margin-top:4px"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      ${id?`<button onclick="refDel('${esc(id)}')" class="btn btn-r" style="margin-right:auto">Eliminar</button>`:''}
      <button onclick="closeRefModal()" class="btn btn-d">Cancelar</button>
      <button onclick="refSave()" class="btn btn-g">Guardar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  refPreview();
};

window.closeRefModal=function(){const o=document.getElementById('refModal');if(o)o.remove();_refWork=null;};

// La insignia se ve ANTES de guardar: es lo que va a salir en la ficha del atleta.
window.refPreview=function(){
  const c=document.getElementById('ref_prev'); if(!c)return;
  const amb=document.getElementById('ref_amb')?.value||'nacional';
  const cat=document.getElementById('ref_cat')?.value||'Cat. 2';
  const k=REF_CORBATA[refClave({ambito:amb,categoria:cat})];
  c.innerHTML=`<div style="font-size:10px;color:var(--muted);margin-bottom:5px">Así se va a ver en su ficha:</div>`+refInsignia(k);
};

function refInsignia(k){
  if(!k)return '';
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid var(--border);font-family:Oswald;font-size:11px;letter-spacing:1px">`
    +`<span title="Corbata ${k.col}" style="width:9px;height:15px;background:${k.col};clip-path:polygon(50% 0,100% 22%,72% 100%,28% 100%,0 22%);border:1px solid rgba(255,255,255,.6)"></span>`
    +esc(k.txt)+`</span>`;
}

window.refFoto=async function(inp){
  const f=inp.files&&inp.files[0]; if(!f||!_refWork)return;
  const rut=refRutId(document.getElementById('ref_rut')?.value||_refWork.rut);
  if(!rut){showToast('Primero pon el RUT: la foto se guarda con ese nombre',null,true);return;}
  const st=document.getElementById('ref_fotoSt'); if(st)st.textContent='Convirtiendo y subiendo…';
  try{
    const webp=await compressImg(f,900,0.85);
    const sref=storageRef(getStorage(app),'public/referees/'+rut+'.webp');
    await uploadBytes(sref,webp,{contentType:'image/webp'});
    _refWork.fotoUrl=await getDownloadURL(sref);
    const box=document.getElementById('ref_fotoBox');
    if(box)box.innerHTML=`<img src="${esc(_refWork.fotoUrl)}" style="width:100%;height:100%;object-fit:cover">`;
    if(st){st.textContent='Foto subida'; st.style.color='var(--green)';}
  }catch(e){ if(st){st.textContent='Error: '+e.message; st.style.color='var(--red)';} }
};

window.refSave=async function(){
  const g=id=>document.getElementById(id);
  const nombre=(g('ref_nom').value||'').trim();
  const rut=(g('ref_rut').value||'').trim();
  const id=refRutId(rut);
  if(!nombre||!id){showToast('Falta el nombre o el RUT',null,true);return;}
  try{
    await setDoc(doc(db,'referees',id),{
      nombre, rut, categoria:g('ref_cat').value, ambito:g('ref_amb').value,
      fotoUrl:_refWork?.fotoUrl||'', updatedAt:serverTimestamp()
    },{merge:true});
    await logAction('referee_guardado',id,null,nombre+' · '+g('ref_amb').value+' '+g('ref_cat').value);
    showToast('Juez guardado: '+nombre);
    closeRefModal(); ST._refLoaded=false; refEnsureLoaded();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

// ── Importar la planilla de FECHIPO ─────────────────────────────────────────
// La planilla llega con nombre, club y categoría, pero SIN RUT — y esta base se
// guarda por RUT, porque es lo único que no cambia. El RUT sale de cruzar contra
// el padrón.
//
// Ese cruce NO se aplica solo. Los nombres de la planilla vienen cortos
// ("Felipe Romero") y el padrón los tiene completos ("Felipe Antonio Romero
// Díaz"): ninguno calza exacto, así que hay que buscar por palabras, y eso puede
// equivocarse. Ya pasó una vez, con una atleta peruana que quedó pegada a la
// ficha de una chilena. Por eso acá se PROPONE y la persona confirma: se muestra
// a quién se va a vincular cada juez y recién ahí se guarda.
//
// Los que tienen dos candidatas o ninguna se listan aparte, para agregarlos a
// mano con su RUT.
window.refImportarBase=async function(){
  const nrm=x=>String(x==null?'':x).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().split(/\s+/).filter(Boolean).join(' ');
  let base;
  try{ base=await (await fetch('jueces_base.json?v='+Date.now())).json(); }
  catch(e){ showToast('No se pudo leer jueces_base.json: '+e.message,null,true); return; }
  const jueces=(base&&base.jueces)||[];
  if(!jueces.length){ showToast('La planilla vino vacía',null,true); return; }
  await refEnsureLoaded();
  // Quién ya está, comparado por RUT y no por nombre: acá se guarda el nombre
  // COMPLETO del padrón ("Felipe Antonio Romero Díaz") y la planilla trae el
  // corto ("Felipe Romero"), así que compararlos por nombre no calza nunca y
  // volvía a reimportar a todos en cada pasada.
  const yaEstan=new Set((ST.referees||[]).map(r=>refRutId(r.rut||r.id)));

  const listos=[], dudosos=[];
  jueces.forEach(j=>{
    const pal=nrm(j.nombre).split(' ');
    const cand=(ST.data||[]).filter(a=>{
      const d=nrm(a.nombre).split(' ');
      return pal.length>=2 && pal.every(x=>d.includes(x));
    });
    const item={juez:j, cand};
    if(cand.length===1) listos.push(item); else dudosos.push(item);
  });
  const nuevos=listos.filter(x=>!yaEstan.has(refRutId(x.cand[0].rut)));

  const resumen='Importar la planilla de FECHIPO\n\n'
    +jueces.length+' jueces en la planilla.\n'
    +nuevos.length+' se pueden vincular con el padrón y se van a agregar.\n'
    +(listos.length-nuevos.length)+' ya estaban en la base.\n'
    +dudosos.length+' quedan fuera: no se encontró a quién vincularlos o hay más de uno con ese nombre.\n\n'
    +'A los que entran se les toma el RUT de su ficha del padrón.\n\n¿Seguir?';
  if(!nuevos.length){ alert(resumen.replace('¿Seguir?','No hay nada nuevo que agregar.')); return; }
  if(!confirm(resumen))return;

  // Segunda pasada: se muestra a quién se vincula cada uno, para poder frenar.
  const muestra=nuevos.slice(0,12).map(x=>'  '+x.juez.nombre+'  →  '+x.cand[0].nombre).join('\n');
  if(!confirm('Se van a vincular así'+(nuevos.length>12?' (los primeros 12 de '+nuevos.length+')':'')+':\n\n'
    +muestra+'\n\nSi alguno está mal, cancela y lo agregas a mano.\n\n¿Confirmas?'))return;

  let ok=0; const fallaron=[]; let permisos=false;
  for(const {juez,cand} of nuevos){
    const a=cand[0];
    const id=refRutId(a.rut);
    if(!id){ fallaron.push(juez.nombre+' (su ficha no tiene RUT)'); continue; }
    try{
      await setDoc(doc(db,'referees',id),{
        nombre:a.nombre,               // el nombre completo del padrón, no el corto
        rut:a.rut,
        categoria:/1/.test(juez.categoria)?'1':'2',
        ambito:juez.certificacion==='IPF'?'internacional':'nacional',
        club:juez.club||'', codigo:a.codigo||'',
        olimpiadasEspeciales:!!juez.olimpiadasEspeciales,
        parapowerlifting:!!juez.parapowerlifting,
        origen:'planilla FECHIPO', updatedAt:serverTimestamp()
      },{merge:true});
      ok++;
    }catch(e){
      fallaron.push(juez.nombre+': '+e.message);
      if(/permission|insufficient|PERMISSION_DENIED/i.test(e.message||''))permisos=true;
    }
  }
  await logAction('jueces_importados','planilla FECHIPO',null,ok+' de '+nuevos.length);
  ST._refLoaded=false; await refEnsureLoaded(); render();
  let msg='Se agregaron '+ok+' jueces';
  if(fallaron.length)msg+=' · '+fallaron.length+' fallaron';
  showToast(msg,null,!!fallaron.length);
  // Un contador de fallas no sirve para arreglar nada: hay que decir POR QUÉ.
  // Cuando fallan todas por permisos no es un problema de los datos sino de las
  // reglas de Firestore, y eso se arregla en otra parte —en la consola, no acá—,
  // así que el aviso lo dice con todas sus letras en vez de dejar buscando.
  if(fallaron.length){
    alert(permisos&&!ok
      ? 'No se agregó ninguno: Firestore rechazó las '+fallaron.length+' escrituras por permisos.\n\n'
        +'La colección `referees` necesita su regla publicada. Está escrita en reglas/firestore.rules '
        +'del repositorio; hay que publicarla en la consola de Firebase '
        +'(Firestore → Reglas → Publicar) y volver a importar.\n\n'
        +'Error tal cual: '+(fallaron[0]||'').split(': ').slice(1).join(': ')
      : 'No se pudieron agregar '+fallaron.length+':\n\n'+fallaron.slice(0,15).join('\n')
        +(fallaron.length>15?'\n…':''));
  }
  if(dudosos.length){
    const det=dudosos.map(x=>'  '+x.juez.nombre+' — '
      +(x.cand.length?x.cand.length+' personas con ese nombre':'no está en el padrón')).join('\n');
    alert('Estos '+dudosos.length+' hay que agregarlos a mano, con su RUT:\n\n'+det);
  }
};

window.refDel=async function(id){
  const r=(ST.referees||[]).find(x=>x.id===id);
  if(!confirm('¿Eliminar a '+(r?.nombre||id)+' de la base de jueces?\n\nSu ficha de atleta, si la tiene, no se toca.'))return;
  try{
    await deleteDoc(doc(db,'referees',id));
    await logAction('referee_eliminado',id,r?.nombre||null,'deleted');
    showToast('Juez eliminado'); closeRefModal(); ST._refLoaded=false; refEnsureLoaded();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

window.refBuscar=function(v){
  ST.refSearch=v;
  const c=document.getElementById('refList'); if(c)c.innerHTML=refListHtml(); else render();
};

function refListHtml(){
  const q=String(ST.refSearch||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const list=(ST.referees||[]).filter(r=>{
    if(!q)return true;
    const t=(String(r.nombre||'')+' '+String(r.rut||'')).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    return t.includes(q);
  });
  if(!list.length){
    // Base vacía y lectura rechazada se veían igual, y no son lo mismo: en el
    // segundo caso puede haber jueces guardados y no estarse viendo ninguno.
    if(ST._refError)return '<div style="padding:26px;text-align:center;color:var(--red);font-size:13px;line-height:1.6">'
      +'<b>Firestore no deja leer esta base.</b><br>'
      +'La colección <code>referees</code> necesita su regla publicada: está en '
      +'<code>reglas/firestore.rules</code> del repositorio y hay que publicarla en la consola de Firebase '
      +'(Firestore → Reglas → Publicar).<br>'
      +'<span style="color:var(--muted);font-size:11px">'+esc(ST._refError.message||'')+'</span></div>';
    return '<div style="padding:26px;text-align:center;color:var(--muted);font-size:13px">Sin jueces cargados todavía.</div>';
  }
  return `<table class="tbl"><tr><th></th><th>Nombre</th><th>RUT</th><th>Insignia</th><th></th></tr>`
    +list.map(r=>{
      const k=REF_CORBATA[refClave(r)];
      return `<tr>
        <td style="width:44px"><div style="width:36px;height:36px;border-radius:8px;overflow:hidden;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center">
          ${r.fotoUrl?`<img src="${esc(r.fotoUrl)}" style="width:100%;height:100%;object-fit:cover">`:'<span style="font-size:14px;opacity:.4"><i class=yl-i-usuario></i></span>'}</div></td>
        <td>${esc(r.nombre||'')}</td>
        <td style="font-size:11px;color:var(--muted)">${esc(r.rut||'')}</td>
        <td>${refInsignia(k)}</td>
        <td><button onclick="openRefModal('${esc(r.id)}')" class="btn" style="padding:3px 9px;font-size:10px">Editar</button></td>
      </tr>`;
    }).join('')+`</table>`;
}

function renderReferees(){
  if(ST._refLoaded!==true){ setTimeout(refEnsureLoaded,0); return '<div class="h1">Jueces</div><p class="subtitle">Cargando…</p>'; }
  const list=ST.referees||[];
  const n=k=>list.filter(r=>refClave(r)===k).length;
  const ks='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;text-align:center';
  const caja=(v,l,c)=>`<div style="${ks}"><div style="font-family:Oswald;font-size:26px;font-weight:700;color:${c}">${v}</div><div style="color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px">${l}</div></div>`;
  return `<div class="h1">Jueces</div>
    <p class="subtitle">Base propia, aparte de las cuentas que marcan las luces · la corbata dice la categoría · la foto es la de uniforme, no la de competencia</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:14px 0 16px">
      ${caja(list.length,'TOTAL','var(--gold)')}
      ${caja(n('nacional|1'),'NAC. CAT I','#E8E8E8')}
      ${caja(n('nacional|2'),'NAC. CAT II','#9AA5B1')}
      ${caja(n('internacional|1'),'INT. CAT I','#C41E3A')}
      ${caja(n('internacional|2'),'INT. CAT II','#1E5BA8')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <input value="${esc(ST.refSearch||'')}" oninput="refBuscar(this.value)" placeholder="Buscar nombre o RUT…" style="flex:1;min-width:200px;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px">
      <button onclick="openRefModal('')" class="btn btn-g" style="padding:9px 15px">+ Agregar juez</button>
      <button onclick="refImportarBase()" class="btn btn-b" style="padding:9px 15px" title="Lee la planilla de FECHIPO y propone a los que faltan">↓ Importar planilla FECHIPO</button>
    </div>
    <div class="card" style="padding:0;overflow-x:auto" id="refList">${refListHtml()}</div>`;
}

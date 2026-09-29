// admin.html — Fotos de atletas: subirlas, quitarles el fondo, las pendientes y el editor de GIF.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// Re-renderiza el canvas de preview aplicando el transform actual
function _redrawFotoPreview(){
  const F = window._fotosState;
  if(!F.bgRemovedImg) return;
  const W=600, H=800;
  const c = document.createElement('canvas');
  c.width=W; c.height=H;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#FFFFFF';
  ctx.fillRect(0,0,W,H);
  ctx.save();
  ctx.translate(W/2 + F.transform.offsetX, H/2 + F.transform.offsetY);
  ctx.rotate(F.transform.rotation * Math.PI / 180);
  const img = F.bgRemovedImg;
  const baseScale = Math.min(W/img.width, H/img.height);
  const s = baseScale * F.transform.zoom;
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
  ctx.restore();
  F.preview = c.toDataURL('image/jpeg', 0.92);
  // Actualizar ambos previews en vivo (sin re-render completo)
  const previewEl = document.getElementById('fotoPreviewImg');
  if(previewEl) previewEl.src = F.preview;
  const previewObs = document.getElementById('fotoPreviewObs');
  if(previewObs) previewObs.src = F.preview;
}

window.editorFotoZoom = function(delta){
  const F = window._fotosState;
  F.transform.zoom = Math.max(0.3, Math.min(3, F.transform.zoom + delta));
  _redrawFotoPreview();
};

window.editorFotoMove = function(dx,dy){
  const F = window._fotosState;
  F.transform.offsetX += dx;
  F.transform.offsetY += dy;
  _redrawFotoPreview();
};

window.editorFotoRotate = function(deg){
  const F = window._fotosState;
  F.transform.rotation = (F.transform.rotation + deg) % 360;
  _redrawFotoPreview();
};

window.editorFotoReset = function(){
  const F = window._fotosState;
  F.transform = {zoom:1.0, offsetX:0, offsetY:0, rotation:0};
  _redrawFotoPreview();
};

window.editorFotoSetZoom = function(v){
  window._fotosState.transform.zoom = parseFloat(v);
  _redrawFotoPreview();
};

// ── Clubes ────────────────────────────────────────────────────────────────────
// ── Eliminar un club que ya no está en FECHIPO ─────────────────────
// La lista de clubes NO es una lista: se arma de los atletas. Un club figura
// mientras alguien lo tenga puesto, así que "eliminarlo" es vaciarle el club a
// sus atletas — ahí desaparece solo. Los atletas y TODO su historial de
// competencias quedan intactos: solo pierden la referencia al club.
window.clubEliminar=async function(club){
  // Lo puede hacer cualquiera que entre al panel: mantener la lista de clubes es
  // trabajo de la comisión técnica, no del owner. Las cuentas que no operan el
  // panel siguen fuera.
  if(!ST.adminInfo||_ROLES_SIN_PANEL.includes(ST.adminInfo?.role)){
    showToast('Tu cuenta no puede editar clubes',null,true); return;
  }
  const atletas=(ST.data||[]).filter(a=>a.club===club);
  // Los entrenadores también llevan club, y muchos son además atletas. Si se
  // vacía solo por el lado de los atletas, el club sigue vivo en la base de
  // entrenadores y reaparece.
  const entren=(ST.entrenadores||[]).filter(e=>e.club===club);
  if(!confirm('Eliminar el club "'+club+'"\n\n'
    +'Se le va a VACIAR el club a '+atletas.length+' atleta(s)'
    +(entren.length?' y a '+entren.length+' entrenador(es)':'')+'.\n'
    +'Sus perfiles, resultados y récords NO se tocan: siguen igual, solo quedan sin club.\n\n'
    +'El club desaparece de la lista porque ya no lo tiene nadie.\n\n¿Seguir?'))return;
  if(!confirm('Confirma de nuevo.\n\n'+atletas.length+' atleta(s) van a quedar sin club.\n'
    +'Para revertirlo hay que volver a asignárselo uno por uno.'))return;
  let ok=0,fallaron=[];
  for(const a of atletas){
    try{ a.club=''; await _saveEdit(a); ok++; }
    catch(e){ fallaron.push(a.nombre||a.codigo); console.warn('[clubEliminar]',a.codigo,e); }
  }
  // Y por el lado de los entrenadores
  for(const e of entren){
    try{ await updateDoc(doc(db,'entrenadores',e.id),{club:''}); ok++; }
    catch(x){ fallaron.push(e.nombre||e.id); console.warn('[clubEliminar] entrenador',e.id,x); }
  }
  // El logo guardado del club ya no tiene a quién representar
  try{ const slug=window.normClub(club); if((window._CLUBS_FS||{})[slug]) await deleteDoc(doc(db,'clubs',slug)); }catch(e){}
  await logAction('club_eliminado',club,atletas.length+' atletas, '+entren.length+' entrenadores',null,{atletas:atletas.map(a=>a.codigo).slice(0,80)});
  render();
  if(fallaron.length) showToast('Club eliminado en '+ok+' atleta(s), fallaron '+fallaron.length+': '+fallaron.slice(0,3).join(', '),null,true);
  else showToast('Club "'+club+'" eliminado — '+ok+' atleta(s) quedaron sin club');
};

// ── Corregir el nombre de un club ──────────────────────────────────
// Mismo razonamiento que eliminar: como la lista se arma de los atletas,
// renombrar el club es cambiarle el nombre a todos los que lo tienen puesto. Si
// se cambiara en un solo lado quedarían dos clubes donde hay uno, y el
// desplegable de inscripción —que sale del mismo padrón— mostraría los dos.
window.clubRenombrar=async function(club){
  if(!ST.adminInfo||_ROLES_SIN_PANEL.includes(ST.adminInfo?.role)){
    showToast('Tu cuenta no puede editar clubes',null,true); return;
  }
  const nuevo=(prompt('Nombre del club\n\nSe le cambia a todos sus atletas y entrenadores.',club)||'').trim();
  if(!nuevo||nuevo===club)return;
  const atletas=(ST.data||[]).filter(a=>a.club===club);
  const entren=(ST.entrenadores||[]).filter(e=>e.club===club);
  // Si ya existe otro club con ese nombre, esto los junta en uno. Es una decisión
  // distinta a corregir un nombre y hay que decirla, no dejar que pase sola.
  const yaExiste=[...new Set((ST.data||[]).map(a=>a.club).filter(Boolean))]
    .some(c=>c!==club&&c===nuevo);
  if(!confirm((yaExiste
      ?'CUIDADO: ya hay un club llamado "'+nuevo+'".\nLos dos van a quedar como uno solo.\n\n'
      :'')
    +'Renombrar "'+club+'"\na "'+nuevo+'"\n\n'
    +'Se le cambia el club a '+atletas.length+' atleta(s)'
    +(entren.length?' y a '+entren.length+' entrenador(es)':'')+'.\n'
    +'Perfiles, resultados y récords quedan igual.\n\n¿Seguir?'))return;
  let ok=0,fallaron=[];
  for(const a of atletas){
    try{ a.club=nuevo; await _saveEdit(a); ok++; }
    catch(e){ a.club=club; fallaron.push(a.nombre||a.codigo); console.warn('[clubRenombrar]',a.codigo,e); }
  }
  for(const e of entren){
    try{ await updateDoc(doc(db,'entrenadores',e.id),{club:nuevo}); e.club=nuevo; ok++; }
    catch(x){ fallaron.push(e.nombre||e.id); console.warn('[clubRenombrar] entrenador',e.id,x); }
  }
  // El logo se va con el nombre: si no, el club renombrado aparece sin logo y el
  // viejo queda ocupando su lugar en la colección.
  try{
    const slugV=window.normClub(club), slugN=window.normClub(nuevo);
    const fs=(window._CLUBS_FS||{})[slugV];
    if(slugN!==slugV&&fs&&fs.logoUrl){
      await setDoc(doc(db,'clubs',slugN),{name:nuevo,slug:slugN,logoUrl:fs.logoUrl,updatedAt:serverTimestamp()},{merge:true});
      await deleteDoc(doc(db,'clubs',slugV));
    }else if(fs){
      await setDoc(doc(db,'clubs',slugV),{name:nuevo},{merge:true});
    }
  }catch(e){console.warn('[clubRenombrar] logo',e);}
  await logAction('club_renombrado',club,club,nuevo,{atletas:atletas.length,entrenadores:entren.length});
  render();
  if(fallaron.length) showToast('Renombrado en '+ok+', fallaron '+fallaron.length+': '+fallaron.slice(0,3).join(', '),null,true);
  else showToast('Ahora es "'+nuevo+'" — '+ok+' ficha(s) actualizada(s)');
};

function renderClubs(){
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const allClubs=[...new Set((ST.data||[]).map(a=>a.club).filter(Boolean))].sort();
  const athletesByClub={};
  (ST.data||[]).forEach(a=>{if(a.club)(athletesByClub[a.club]=athletesByClub[a.club]||[]).push(a);});
  const expanded=ST._clubExpanded||null;
  const esOwner=!!ST.adminInfo&&!_ROLES_SIN_PANEL.includes(ST.adminInfo?.role);
  let h=`<div style="font-family:Oswald;font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:6px">CLUBES</div>`;
  h+=`<div style="font-size:12px;color:var(--muted);margin-bottom:18px">${allClubs.length} clubes · la lista sale de los atletas: un club figura mientras alguien lo tenga puesto${esOwner?'. <b>Eliminar</b> le vacía el club a sus atletas — perfiles y resultados quedan intactos':''}</div>`;
  h+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">`;
  for(const club of allClubs){
    const slug=window.normClub(club);
    const fsData=(window._CLUBS_FS||{})[slug];
    const logoUrl=fsData?.logoUrl||window.clubLogo(club)||'';
    const athletes=athletesByClub[club]||[];
    const isOpen=expanded===club;
    h+=`<div class="card" style="padding:14px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="width:52px;height:52px;background:var(--bg);border:1px solid var(--border);border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${logoUrl?`<img src="${esc(logoUrl)}" style="width:100%;height:100%;object-fit:contain" onerror="this.parentElement.innerHTML='<span style=font-size:22px><i class=yl-i-pesa></i></span>'">`:'<span style="font-size:22px"><i class=yl-i-pesa></i></span>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(club)}">${esc(club)}</div>
          <div style="font-size:11px;color:var(--muted)">${athletes.length} atleta${athletes.length!==1?'s':''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <label class="btn btn-b" style="padding:5px 10px;font-size:11px;cursor:pointer" title="Subir o reemplazar logo">
          <input type="file" accept="image/*" style="display:none" onchange="uploadClubLogo('${esc(club)}','${esc(slug)}',this)">
          ${logoUrl?'Cambiar logo':'+ Logo'}
        </label>
        <button class="btn btn-b" style="padding:5px 10px;font-size:11px" onclick="ST._clubExpanded=ST._clubExpanded==='${esc(club)}'?null:'${esc(club)}';render()">
          ${isOpen?'Ocultar':'Ver atletas'}
        </button>
        <button class="btn btn-b" style="padding:5px 10px;font-size:11px" onclick="clubRenombrar('${esc(club).replace(/'/g,"\\'")}')" title="Le cambia el nombre del club a sus ${athletes.length} atleta(s). El logo se va con el nombre.">Renombrar</button>
        ${esOwner?`<button class="btn" style="padding:5px 10px;font-size:11px;border-color:var(--red);color:var(--red)" onclick="clubEliminar('${esc(club).replace(/'/g,"\\'")}')" title="Le vacía el club a sus ${athletes.length} atleta(s). Perfiles y resultados quedan intactos.">Eliminar</button>`:''}
      </div>
      ${isOpen?`<div style="margin-top:10px;max-height:220px;overflow-y:auto;border-top:1px solid var(--border);padding-top:8px">
        ${athletes.sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).map(a=>`
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer" onclick="go('athleteProfile');ST.athleteProfile='${a.codigo.replace(/'/g,"\\'")}';render()">
            ${a.foto_url?`<img src="${esc(a.foto_url)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`:
              `<div style="width:28px;height:28px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:var(--muted)">${(a.nombre||'?')[0].toUpperCase()}</div>`}
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.nombre||'')}</div>
              <div style="font-size:10px;color:var(--muted)">${esc(a.division||'')} · ${esc(a.codigo||'')}</div>
            </div>
          </div>`).join('')}
      </div>`:''}
    </div>`;
  }
  h+=`</div>`;
  return h;
}

// Comprime imágenes en el navegador antes de subir a Storage

// ══════════════════════════════════════════════════════════════════
// FOTOS SUDAMERICANO — carga masiva desde una carpeta del PC.
// Evita el ZIP/Drive: los archivos van DIRECTO del PC a Firebase Storage.
// Cada foto se convierte a WebP en el navegador ANTES de subir (pesa ~80%
// menos que el PNG/JPEG original), y se emparejan con la nómina por el
// nombre del archivo. Los chilenos con perfil además reciben la foto en su
// perfil (atleta_fotos); el resto queda solo en su FICHA de la nómina.
// ══════════════════════════════════════════════════════════════════
function _sfNrm(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[ﬁ]/g,'fi').replace(/[ﬂ]/g,'fl')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function _sfSlug(s){ return _sfNrm(s).replace(/\s+/g,'-').slice(0,80); }

function _sfToks(s){ return new Set(_sfNrm(s).split(' ').filter(t=>t.length>1)); }

// Empareja el nombre de archivo con un atleta de la nómina.
// Acepta "Apellido Nombre.jpg", "nombre_apellido.png", con números/prefijos.
function _sfMatch(fileName, pool){
  const base=String(fileName).replace(/\.[^.]+$/,'').replace(/^\d+[\s._-]*/,'');
  const t=_sfToks(base);
  if(!t.size) return {status:'sin-nombre'};
  // Puntaje por CONTENCIÓN: tolera que el archivo traiga apellidos/nombres de más
  // (ej. "Perez Gomez Ana Maria.jpg" para "Perez Gomez Ana"). Exige al menos 2
  // tokens en común (salvo nombres de un solo token) para no casar por el apellido solo.
  let best=null,bestC=0,bestJ=0,tie=false;
  for(const a of pool){
    const inter=[...t].filter(x=>a._toks.has(x)).length;
    if(!inter) continue;
    if(inter<2 && Math.min(t.size,a._toks.size)>1) continue;
    const cont=inter/Math.min(t.size,a._toks.size);
    const jac=inter/Math.max(t.size,a._toks.size);
    if(cont>bestC||(cont===bestC&&jac>bestJ)){best=a;bestC=cont;bestJ=jac;tie=false;}
    else if(cont===bestC&&jac===bestJ&&best&&a.n!==best.n) tie=true;
  }
  if(!best||bestC<0.8) return {status:'sin-match'};
  if(tie) return {status:'ambiguo', a:best, score:bestJ};
  return {status:bestJ>=0.99?'exacto':'probable', a:best, score:bestJ};
}

window.sfPick=async function(inp){
  const files=[...(inp.files||[])].filter(f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp)$/i.test(f.name));
  if(!files.length){showToast('No se encontraron imágenes en la selección',null,true);return;}
  // Nómina: una entrada por atleta (no por inscripción)
  if(!ST.sudaNom){
    try{ ST.sudaNom=await (await fetch('nomina_sudamericano.json?'+Date.now())).json(); }
    catch(e){ showToast('No se pudo leer nomina_sudamericano.json',null,true); return; }
  }
  const byName={};
  (ST.sudaNom.atletas||[]).forEach(a=>{
    const k=_sfNrm(a.n);
    if(!byName[k]) byName[k]={n:a.n,pais:a.pais,cod:a.cod||null,listas:[],_toks:_sfToks(a.n)};
    byName[k].listas.push(a.lista);
  });
  const pool=Object.values(byName);
  ST.sfPool=pool;
  ST.sfItems=files.map(f=>{ const m=_sfMatch(f.name,pool); return {file:f,name:f.name,size:f.size,...m,done:false}; });
  ST.view='sudaFotos'; render();
};

window.sfClear=function(){ ST.sfItems=null; render(); };

// Reasignar a mano un archivo que no matcheó (o quedó ambiguo)
window.sfAssign=function(i,val){
  const it=ST.sfItems[i]; if(!it)return;
  if(!val){ it.a=null; it.status='sin-match'; }
  else { const a=(ST.sfPool||[]).find(x=>x.n===val); if(a){ it.a=a; it.status='manual'; } }
  render();
};

window.sfSkip=function(i){ const it=ST.sfItems[i]; if(it){it.skip=!it.skip;render();} };

window.sfUpload=async function(){
  const items=(ST.sfItems||[]).filter(x=>x.a && !x.skip && !x.done);
  if(!items.length){showToast('No hay fotos emparejadas para subir',null,true);return;}
  if(!confirm('Se van a convertir a WebP y subir '+items.length+' foto(s).\n\nLas chilenas con perfil también se cargan en su perfil.\n\n¿Continuar?'))return;
  ST.sfBusy=true; ST.sfProg={done:0,total:items.length,err:0}; render();
  const storage=getStorage(app);
  for(const it of items){
    try{
      const webp=await compressImg(it.file,900,0.82);   // ← conversión a WebP
      const slug=_sfSlug(it.a.n);
      // Se sube bajo public/: es la ruta que las reglas de Storage ya permiten
      // (lectura pública + escritura de admin). Fuera de public/ la subida era
      // rechazada por permisos — de ahí el error de autenticación.
      const sref=storageRef(storage,'public/nomina_suda/'+slug+'.webp');
      await uploadBytes(sref,webp,{contentType:'image/webp'});
      const url=await getDownloadURL(sref);
      it.url=url; it.outSize=webp.size;
      // Ficha de la nómina (todos los países)
      await setDoc(doc(db,'nomina_suda_fotos',slug),
        {nombre:it.a.n,pais:it.a.pais,foto_url:url,codigo:it.a.cod||null,ts:Date.now()},{merge:true});
      // Chilenos con perfil → también a su perfil YourLift
      if(it.a.cod){
        await setDoc(doc(db,'atleta_fotos',it.a.cod),
          {codigo:it.a.cod,name:it.a.n,foto_url:url,status:'approved',source:'sudamericano_2026',ts:Date.now()},{merge:true});
      }
      it.done=true;
    }catch(e){
      const c=String(e&&e.code||''), m=String(e&&e.message||e);
      it.err=/unauthoriz|permission|denied|unauthenticated/i.test(c+' '+m)
        ? 'Sin permiso — inicia sesión como admin y reintenta'
        : m;
      ST.sfProg.err++;
    }
    ST.sfProg.done++;
    if(ST.sfProg.done%3===0)render();
  }
  ST.sfBusy=false; render();
  showToast('Listo: '+(ST.sfProg.total-ST.sfProg.err)+' foto(s) subidas'+(ST.sfProg.err?' · '+ST.sfProg.err+' con error':''));
};

function renderSudaFotos(){
  const items=ST.sfItems||[];
  const pool=ST.sfPool||[];
  const kb=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.round(n/1024)+' KB';
  let h=`<div style="margin-bottom:18px"><h2 style="font-family:Oswald;font-size:22px;letter-spacing:1px">FOTOS SUDAMERICANO 2026</h2>
    <p style="color:var(--muted);font-size:12px;margin-top:4px">Elige la carpeta con las fotos. Se convierten a <b style="color:var(--gold)">WebP</b> en tu navegador antes de subir (pesan ~80% menos) y se emparejan solas con la nómina por el nombre del archivo. No hace falta ZIP ni Drive: van directo de tu PC a Firebase.</p></div>`;
  h+=`<div class="card" style="padding:18px;margin-bottom:16px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <label class="btn" style="padding:10px 18px;cursor:pointer"><i class=yl-i-carpeta></i> Elegir carpeta
        <input type="file" webkitdirectory directory multiple accept="image/*" onchange="sfPick(this)" style="display:none"></label>
      <label class="btn" style="padding:10px 18px;cursor:pointer;background:transparent;border:1px solid var(--border)"><i class=yl-i-camara></i> Elegir archivos
        <input type="file" multiple accept="image/*" onchange="sfPick(this)" style="display:none"></label>
      ${items.length?`<button class="btn" onclick="sfClear()" style="padding:10px 16px;background:transparent;border:1px solid var(--border)">Limpiar</button>`:''}
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:10px">Ideal: que el archivo se llame como el atleta (ej. <code>Navarro Medel Javiera.jpg</code>). Acepta acentos, guiones bajos y números al inicio.</p>
  </div>`;
  if(!items.length) return h;
  const g=s=>items.filter(x=>x.status===s).length;
  const ok=items.filter(x=>x.a&&!x.skip).length;
  h+=`<div class="card" style="padding:14px;margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap;align-items:center">
    <span style="font-family:Oswald;font-size:13px">${items.length} archivo(s)</span>
    <span style="color:var(--green);font-size:12px"><i class=yl-i-check></i> ${g('exacto')} exactos · ${g('probable')} probables${g('manual')?' · '+g('manual')+' manuales':''}</span>
    ${g('ambiguo')?`<span style="color:var(--gold);font-size:12px"><i class=yl-i-alerta></i> ${g('ambiguo')} ambiguos</span>`:''}
    ${g('sin-match')?`<span style="color:var(--accent);font-size:12px"><i class=yl-i-cerrar></i> ${g('sin-match')} sin match</span>`:''}
    <span style="flex:1"></span>
    ${ST.sfBusy
      ? `<span style="font-family:Oswald;color:var(--gold)">Subiendo ${ST.sfProg.done}/${ST.sfProg.total}…</span>`
      : `<button class="btn" onclick="sfUpload()" ${ok?'':'disabled'} style="padding:10px 20px;${ok?'':'opacity:.5'}">Convertir a WebP y subir (${ok})</button>`}
  </div>`;
  const opts=pool.map(a=>a.n).sort();
  h+=`<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
    <tr style="background:var(--blue)">${['Archivo','Peso','Atleta de la nómina','País','Estado',''].map(t=>`<th style="padding:8px;color:#fff;text-align:left;font-family:Oswald">${t}</th>`).join('')}</tr>`;
  items.forEach((it,i)=>{
    const st=it.done?['subida','var(--green)']
      :it.err?[it.err,'var(--accent)']
      :it.skip?['omitida','var(--muted)']
      :it.status==='exacto'?['exacto','var(--green)']
      :it.status==='probable'?['probable '+Math.round(it.score*100)+'%','var(--gold)']
      :it.status==='manual'?['manual','var(--blue2,#60a5fa)']
      :it.status==='ambiguo'?['ambiguo — revisa','var(--gold)']
      :['sin match','var(--accent)'];
    h+=`<tr style="border-bottom:1px solid var(--border);${it.skip?'opacity:.45':''}">
      <td style="padding:7px 8px;word-break:break-all">${esc(it.name)}</td>
      <td style="padding:7px 8px;color:var(--muted);white-space:nowrap">${kb(it.size)}${it.outSize?` → <b style="color:var(--green)">${kb(it.outSize)}</b>`:''}</td>
      <td style="padding:7px 8px">
        <select onchange="sfAssign(${i},this.value)" style="max-width:260px;padding:5px;border-radius:6px;border:1px solid ${it.a?'var(--border)':'var(--accent)'};background:var(--card);color:var(--text);font-size:12px">
          <option value="">— sin asignar —</option>
          ${opts.map(n=>`<option value="${esc(n)}"${it.a&&it.a.n===n?' selected':''}>${esc(n)}</option>`).join('')}
        </select>
        ${it.a&&it.a.cod?`<div style="font-size:10px;color:var(--gold);margin-top:2px">perfil ${esc(it.a.cod)} — también se carga ahí</div>`:''}
      </td>
      <td style="padding:7px 8px;color:var(--muted)">${it.a?esc(it.a.pais):'—'}</td>
      <td style="padding:7px 8px;color:${st[1]};white-space:nowrap">${st[0]}</td>
      <td style="padding:7px 8px">${it.done?'':`<button onclick="sfSkip(${i})" style="padding:3px 9px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">${it.skip?'incluir':'omitir'}</button>`}</td>
    </tr>`;
  });
  h+=`</table></div>`;
  return h;
}

async function compressImg(file,maxPx=900,quality=0.80){
  return new Promise(res=>{
    if(!file||!file.type.startsWith('image/')){res(file);return;}
    const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(u);
      let w=img.width,h=img.height;
      if(w>maxPx||h>maxPx){if(w>h){h=Math.round(h*maxPx/w);w=maxPx;}else{w=Math.round(w*maxPx/h);h=maxPx;}}
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(b=>res(b||file),'image/webp',quality);
    };
    img.onerror=()=>{URL.revokeObjectURL(u);res(file);};
    img.src=u;
  });
}

window.migrarFotosWebP = async function(btn){
  const colecciones=[
    {col:'atleta_fotos', campo:'foto_url', maxPx:900, q:0.82, label:'fotos de atletas'},
    {col:'clubs',        campo:'logoUrl',  maxPx:400, q:0.85, label:'logos de clubes'},
    {col:'eventos',      campo:'logoUrl',  maxPx:500, q:0.85, label:'logos de campeonatos'},
  ];
  if(!confirm('¿Convertir a WebP las fotos/logos ya subidos a Firebase Storage?\n\nSe procesarán:\n• Fotos de atletas\n• Logos de clubes\n• Logos de campeonatos\n\nNo cierres la página. Puede tardar varios minutos.'))return;
  if(btn){btn.disabled=true;btn.textContent='Iniciando…';}
  const storage=getStorage(app);
  let totalConv=0,totalSkip=0,totalErr=0;
  for(const {col,campo,maxPx,q,label} of colecciones){
    const snap=await getDocs(collection(db,col));
    const docs=snap.docs.filter(d=>{const url=d.data()[campo];return url&&url.includes('firebasestorage')&&!url.toLowerCase().includes('.webp');});
    if(!docs.length)continue;
    if(btn)btn.textContent=`Convirtiendo ${label} (0/${docs.length})…`;
    let i=0;
    for(const d of docs){
      const url=d.data()[campo];
      try{
        // Extraer path del Storage desde la URL
        const m=url.match(/\/o\/(.+?)(\?|$)/);
        if(!m){totalSkip++;i++;continue;}
        const oldPath=decodeURIComponent(m[1]);
        // Fetch imagen
        const resp=await fetch(url);
        if(!resp.ok){totalSkip++;i++;continue;}
        const blob=await resp.blob();
        // Convertir a WebP
        const tmpFile=new File([blob],'tmp',{type:blob.type||'image/jpeg'});
        const webpBlob=await compressImg(tmpFile,maxPx,q);
        if(!webpBlob||webpBlob===tmpFile){totalSkip++;i++;continue;}
        // Nueva ruta: reemplaza extensión por .webp o agrega .webp
        const newPath=oldPath.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i,'')+'.webp';
        // Subir
        const newRef=storageRef(storage,newPath);
        await uploadBytes(newRef,webpBlob,{contentType:'image/webp'});
        const newUrl=await getDownloadURL(newRef);
        // Actualizar Firestore
        await updateDoc(doc(db,col,d.id),{[campo]:newUrl});
        // Borrar archivo viejo (solo si el path cambió)
        if(oldPath!==newPath){try{await deleteObject(storageRef(storage,oldPath));}catch(_){}}
        totalConv++;
      }catch(e){console.error('[migrarWebP]',col,d.id,e.message);totalErr++;}
      i++;
      if(btn)btn.textContent=`Convirtiendo ${label} (${i}/${docs.length})…`;
    }
  }
  const msg=`Conversión completada: ${totalConv} convertidas, ${totalSkip} omitidas, ${totalErr} errores`;
  showToast(msg);
  if(btn){btn.disabled=false;btn.textContent='Convertir fotos de atletas a WebP (reduce peso hasta 70%)';}
  await logAction('migrar_fotos_webp',`${totalConv} convertidas`,null,`${totalErr} errores`);
};

window.migrarDocsInscripcionWebP = async function(btn){
  if(!confirm('¿Convertir a WebP las fotos de documentos de inscripciones (carnet, foto fondo blanco, etc.)?\n\nLos PDFs se omiten automáticamente. Puede tardar varios minutos.\nNo cierres la página.'))return;
  if(btn){btn.disabled=true;btn.textContent='Cargando inscripciones…';}
  const storage=getStorage(app);
  const snap=await getDocs(collection(db,'inscripciones_private'));
  let totalConv=0,totalSkip=0,totalErr=0,processed=0;
  // Intenta convertir un blob a WebP cargándolo como imagen en el navegador.
  // Retorna null si el archivo no es una imagen (ej: PDF).
  const tryConvert=(blob)=>new Promise(res=>{
    const u=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(u);
      let w=img.width,h=img.height;const MAX=1400;
      if(w>MAX||h>MAX){const r=Math.min(MAX/w,MAX/h);w=Math.round(w*r);h=Math.round(h*r);}
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(b=>res(b||null),'image/webp',0.82);
    };
    img.onerror=()=>{URL.revokeObjectURL(u);res(null);}; // PDF u otro no-imagen
    img.src=u;
  });
  for(const d of snap.docs){
    const data=d.data();
    const docsMap=data.docs||{};
    const updates={};
    for(const [key,url] of Object.entries(docsMap)){
      if(!url||typeof url!=='string'||!url.includes('firebasestorage'))continue;
      // Saltar los que ya son webp
      const m=url.match(/\/o\/(.+?)(\?|$)/);
      if(!m){totalSkip++;continue;}
      const oldPath=decodeURIComponent(m[1]);
      if(oldPath.endsWith('.webp')){totalSkip++;continue;}
      try{
        // Descargar el archivo
        const resp=await fetch(url);
        if(!resp.ok){totalErr++;continue;}
        const blob=await resp.blob();
        // Intentar convertir — retorna null si es PDF u otro formato no-imagen
        const webp=await tryConvert(blob);
        if(!webp){totalSkip++;continue;}
        // Re-subir como .webp
        const newPath=oldPath.replace(/(\.[a-z0-9]{1,6})?$/i,'.webp');
        const newRef=storageRef(storage,newPath);
        await uploadBytes(newRef,webp,{contentType:'image/webp'});
        const newUrl=await getDownloadURL(newRef);
        updates[`docs.${key}`]=newUrl;
        if(oldPath!==newPath){try{await deleteObject(storageRef(storage,oldPath));}catch(_){}}
        totalConv++;
      }catch(e){console.error('[migrarDocs]',d.id,key,e.message);totalErr++;}
    }
    if(Object.keys(updates).length){
      try{await updateDoc(doc(db,'inscripciones_private',d.id),updates);}catch(e){console.error(e);}
    }
    processed++;
    if(btn)btn.textContent=`Procesando… (${processed}/${snap.docs.length}) — ${totalConv} convertidas`;
  }
  const msg=`Documentos: ${totalConv} convertidos, ${totalSkip} omitidos (PDF/ya webp), ${totalErr} errores`;
  showToast(msg);
  await logAction('migrar_docs_webp',`${totalConv} convertidos`,null,`${totalErr} errores`);
  if(btn){btn.disabled=false;btn.textContent='Convertir documentos de inscripciones a WebP';}
};

function renderFotos(){
  const F = window._fotosState;
  const all = ST.data || [];

  // Buscar atletas
  const q = (F.search||'').toLowerCase().trim();
  const matches = q ? all.filter(a=>{
    const n=(a.nombre||'').toLowerCase();
    const r=(a.rut||'').toLowerCase();
    const c=(a.codigo||'').toLowerCase();
    return n.includes(q)||r.includes(q)||c.includes(q);
  }).slice(0,20) : [];

  let h = '<div class="h1">Fotos de Atletas</div>';
  h += '<p style="color:var(--muted);font-size:13px;margin-bottom:18px">Sube fotos de atletas. Puedes <b>quitar el fondo</b> (estilo IPF fondo blanco) o subir la foto <b>tal cual, con su fondo</b> (la que mandó el atleta). Las fotos se ven en perfiles públicos y en la transmisión OBS.</p>';

  // Atletas con foto pendiente de inscripción (sin foto_url todavía)
  // Match: cada atleta con RUT que tenga carnetPhotoURL en alguna inscripción privada
  const {lista: pendientes, url: urlPend, nueva: nuevaPend} = _fotosPendientes();

  if(ST.fotosDesdeCache){
    h += '<div class="card" style="margin-bottom:14px;background:rgba(196,30,58,.08);border-color:var(--accent)">'
      + '<div style="font-size:13px;font-weight:700;color:var(--accent)">Esta lista puede estar desactualizada</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:4px">Las fotos se leyeron de la copia guardada en este navegador, no del servidor: '
      + 'puede aparecer como pendiente alguna que ya confirmaste. Recarga la página antes de confirmar.</div>'
      + '<button onclick="location.reload()" style="margin-top:8px;padding:7px 14px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700">Recargar</button>'
      + '</div>';
  }

  if(pendientes.length>0){
    const bulkCount = Object.keys(F.bulkSel||{}).filter(k=>F.bulkSel[k] && pendientes.some(a=>a.codigo===k)).length;
    const allSelected = pendientes.length>0 && pendientes.every(a=>F.bulkSel && F.bulkSel[a.codigo]);
    h += '<div class="card" style="margin-bottom:14px;background:rgba(212,168,67,.05);border-color:rgba(212,168,67,.4)">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px;flex-wrap:wrap">';
    const nNuevas = pendientes.filter(a=>nuevaPend[a.codigo]).length;
    h += '<div><div style="font-size:14px;font-weight:700;color:var(--gold)">'+pendientes.length+' atleta(s) con foto pendiente de inscripción</div>';
    h += '<div style="font-size:11px;color:var(--muted);margin-top:2px">Estas fotos las subieron los atletas al inscribirse. Marca las que quieres confirmar y usa el botón, o haz click en una para procesarla individualmente (quitar fondo, recortar, etc).'
      + (nNuevas ? ' <b style="color:var(--gold)">'+nNuevas+'</b> ya tenían foto publicada y mandaron otra: van marcadas <b style="color:var(--gold)">NUEVA</b> y, si las confirmás, reemplazan a la que tienen.' : '')
      + '</div></div>';
    h += '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0">';
    h += '<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);cursor:pointer"><input type="checkbox" '+(allSelected?'checked':'')+' onchange="toggleFotoBulkSelAll(this.checked)"> Seleccionar todas</label>';
    h += '<button onclick="confirmarFotosBulk()" '+(bulkCount===0||F.bulkProcessing?'disabled':'')+' style="padding:9px 16px;background:'+(bulkCount>0?'var(--green)':'var(--border)')+';color:#000;border:none;border-radius:6px;cursor:'+(bulkCount>0?'pointer':'default')+';font-size:12px;font-weight:700;white-space:nowrap">'+(F.bulkProcessing?(F.bulkProgress||'Confirmando...'):'<i class=yl-i-check></i> Confirmar seleccionadas ('+bulkCount+')')+'</button>';
    h += '</div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:var(--muted);margin-bottom:8px">La confirmación masiva publica la foto tal cual la mandó el atleta (sin quitar el fondo). Para procesar con fondo blanco IPF, hazlo una por una haciendo click en la tarjeta.</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;max-height:400px;overflow-y:auto">';
    pendientes.forEach(a=>{
      const photoUrl = urlPend[a.codigo];
      const checked = !!(F.bulkSel && F.bulkSel[a.codigo]);
      h += '<div style="background:var(--bg);padding:8px;border-radius:6px;border:1px solid '+(checked?'var(--green)':'var(--border)')+';display:flex;gap:8px;align-items:center;position:relative">';
      h += '<input type="checkbox" '+(checked?'checked':'')+' onclick="event.stopPropagation();toggleFotoBulkSel(\''+escapeJsAttr(a.codigo)+'\')" style="flex-shrink:0;width:16px;height:16px;cursor:pointer">';
      h += '<div onclick="seleccionarAtletaFoto(\''+escapeJsAttr(a.codigo)+'\')" style="flex:1;min-width:0;display:flex;gap:8px;align-items:center;cursor:pointer" title="Click para procesar individualmente">';
      h += '<img src="'+escapeHtml(photoUrl)+'" style="width:36px;height:48px;object-fit:cover;border-radius:3px;flex-shrink:0">';
      h += '<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(a.nombre||'')+'</div>';
      h += '<div style="font-size:9px;color:var(--muted)">'+escapeHtml(a.rut||'')+'</div>';
      if(nuevaPend[a.codigo]) h += '<div style="font-size:9px;color:var(--gold);font-weight:700;margin-top:2px" title="Ya tiene foto publicada; esta la reemplaza">NUEVA · reemplaza</div>';
      if(a._isPending) h += '<div style="font-size:9px;color:var(--gold);font-weight:700;margin-top:2px"><i class=yl-i-estrella></i> DEBUT</div>';
      h += '</div>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div></div>';
  }

  // Buscador
  h += '<div class="card" style="margin-bottom:14px">';
  h += '<div style="display:flex;gap:8px;align-items:center">';
  h += '<input type="text" id="fotoSearchInput" placeholder="Buscar por nombre, RUT o código..." value="'+escapeHtml(F.search)+'" oninput="onFotoSearchInput(this)" style="flex:1;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:14px">';
  h += '</div>';

  if(q && matches.length===0){
    h += '<p style="color:var(--muted);text-align:center;margin-top:14px;font-size:12px">Sin resultados para "'+escapeHtml(q)+'"</p>';
  } else if(matches.length>0){
    h += '<div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;max-height:400px;overflow-y:auto">';
    matches.forEach(a=>{
      const sel = F.selected && F.selected.codigo===a.codigo;
      const hasPhoto = !!a.foto_url;
      h += '<div onclick="seleccionarAtletaFoto(\''+escapeJsAttr(a.codigo)+'\')" style="padding:10px;border-radius:8px;border:2px solid '+(sel?'var(--accent)':'var(--border)')+';background:'+(sel?'rgba(196,30,58,.08)':'var(--bg)')+';cursor:pointer;display:flex;gap:10px;align-items:center" title="Click para seleccionar">';
      h += '<div style="width:48px;height:48px;border-radius:50%;background:'+(hasPhoto?'#fff':'var(--card)')+';border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">';
      if(hasPhoto){
        h += '<img src="'+escapeHtml(a.foto_url)+'" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">';
      } else {
        h += '<span style="font-size:18px;color:var(--muted)"></span>';
      }
      h += '</div>';
      h += '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(a.nombre||'(sin nombre)')+(a._isPending?' <span style="background:var(--gold);color:#000;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700">DEBUT</span>':'')+'</div>';
      h += '<div style="font-size:10px;color:var(--muted)">'+escapeHtml(a.rut||a.codigo||'')+' · '+escapeHtml(a.club||'')+'</div></div>';
      if(hasPhoto) h+='<span style="background:var(--green);color:#000;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700"><i class=yl-i-check></i></span>';
      h += '</div>';
    });
    h += '</div>';
  } else {
    h += '<p style="color:var(--muted);text-align:center;margin-top:14px;font-size:12px">Escribe algo arriba para buscar atletas (mín. 1 letra)</p>';
  }
  h += '</div>';

  // Panel de subida (cuando hay atleta seleccionado)
  if(F.selected){
    const a = F.selected;
    h += '<div class="card">';
    h += '<h3 style="margin-bottom:14px">Atleta: '+escapeHtml(a.nombre||'')+' <small style="color:var(--muted);font-size:12px">('+escapeHtml(a.rut||a.codigo||'')+')</small></h3>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">';

    // Columna izquierda: foto actual
    h += '<div><div style="font-size:11px;color:var(--muted);margin-bottom:6px;letter-spacing:1px">FOTO ACTUAL</div>';
    if(a.foto_url){
      h += '<img src="'+escapeHtml(a.foto_url)+'" style="width:100%;max-width:300px;aspect-ratio:3/4;object-fit:cover;background:#fff;border-radius:8px;border:2px solid var(--border)">';
      h += '<button onclick="borrarFotoAtleta()" style="margin-top:10px;padding:8px 16px;background:transparent;border:1px solid var(--red);color:var(--red);border-radius:6px;cursor:pointer;font-size:12px">Borrar foto</button>';
    } else {
      h += '<div style="width:100%;max-width:300px;aspect-ratio:3/4;background:var(--card);border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px">Sin foto cargada</div>';
    }
    h += '</div>';

    // Columna derecha: subida + preview
    h += '<div><div style="font-size:11px;color:var(--muted);margin-bottom:6px;letter-spacing:1px">SUBIR NUEVA FOTO</div>';
    // Si hay foto pendiente de inscripcion, mostrar opcion de importarla
    if(F.pendingPhotoUrl){
      const esReemplazo = !!a.foto_url;
      h += '<div style="background:rgba(212,168,67,.1);border:1px dashed var(--gold);padding:12px;border-radius:8px;margin-bottom:12px">';
      h += '<div style="font-size:11px;color:var(--gold);font-weight:700;margin-bottom:8px">'+(esReemplazo?'FOTO NUEVA PENDIENTE DE REVISIÓN':'FOTO PENDIENTE DE REVISIÓN')+'</div>';
      h += '<div style="display:flex;gap:10px;align-items:flex-start">';
      h += '<img src="'+escapeHtml(F.pendingPhotoUrl)+'" style="width:120px;height:160px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">';
      h += '<div style="flex:1"><div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:8px">'+(esReemplazo?'El atleta volvió a subir foto al inscribirse. <b>Si la aceptás, reemplaza a la que tiene publicada</b> (la de la izquierda).':'El atleta subió esta foto al inscribirse. <b>NO está publicada todavía</b>.')+' Revísala y decide:</div>';
      h += '<div style="display:flex;flex-direction:column;gap:6px">';
      h += '<button onclick="importarFotoInscripcion()" '+(F.processing?'disabled':'')+' style="padding:10px;background:var(--gold);color:#000;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700">Importar y quitar fondo</button>';
      h += '<button onclick="importarFotoInscripcionSinFondo()" '+(F.processing?'disabled':'')+' title="Sube la foto del atleta tal cual, sin quitarle el fondo" style="padding:10px;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">Importar tal cual (con fondo)</button>';
      h += '<button onclick="rechazarFotoInscripcion()" '+(F.processing?'disabled':'')+' style="padding:8px;background:transparent;color:var(--red);border:1px solid var(--red);border-radius:6px;cursor:pointer;font-size:11px"><i class=yl-i-cruz></i> Rechazar foto</button>';
      h += '</div></div></div>';
      h += '</div>';
    }
    h += '<input type="file" id="fotoInput" accept="image/*" onchange="cargarFotoAtleta(this)" style="display:none">';
    h += '<input type="file" id="fotoInputRaw" accept="image/*" onchange="cargarFotoAtletaSinFondo(this)" style="display:none">';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    h += '<button onclick="document.getElementById(\'fotoInput\').click()" style="flex:1;padding:12px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">Elegir foto (quitar fondo)</button>';
    h += '<button onclick="document.getElementById(\'fotoInputRaw\').click()" style="flex:1;padding:12px 16px;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;font-weight:600" title="Sube la foto tal cual, sin modificar. Ideal para fotos con fondo negro o diseño propio.">Sin procesar (tal cual)</button>';
    h += '</div>';
    if(F.preview){
      h += '<div style="margin-top:12px"><div style="font-size:10px;color:var(--muted);margin-bottom:4px">PREVIEW (con fondo blanco — ajusta si hace falta)</div>';
      h += '<img id="fotoPreviewImg" src="'+F.preview+'" style="width:100%;max-width:300px;aspect-ratio:3/4;object-fit:cover;background:#fff;border-radius:8px;border:2px solid var(--green)"></div>';

      // Preview real estilo OBS Profile Widget (cómo se verá en transmisión)
      h += '<div style="margin-top:14px"><div style="font-size:10px;color:var(--muted);margin-bottom:4px;letter-spacing:1px">VISTA PREVIA EN TRANSMISIÓN</div>';
      h += '<div style="display:flex;gap:14px;align-items:flex-start;background:linear-gradient(135deg,#0a1628,#0F1F35);padding:14px;border-radius:8px">';
      // Imitamos el estilo del widget renderTxProfile (líneas ~2266-2280 en livecast)
      h += '<div style="width:160px;aspect-ratio:3/4;background:#fff;border:3px solid #D4A843;border-radius:4px;overflow:hidden;flex-shrink:0;box-shadow:0 8px 30px rgba(0,0,0,.5)">';
      h += '<img id="fotoPreviewObs" src="'+F.preview+'" style="width:100%;height:100%;object-fit:cover">';
      h += '</div>';
      h += '<div style="flex:1;font-size:11px;color:rgba(220,230,245,.7);line-height:1.6">';
      h += '<div style="background:#D4A843;padding:6px 10px;border-radius:4px;color:#0A1628;display:inline-block;margin-bottom:8px;font-family:Oswald;font-weight:700;font-size:11px">'+escapeHtml((a.nombre||'').toUpperCase().split(/\s+/).slice(0,3).join(' '))+'</div>';
      h += '<div style="font-family:Oswald;font-size:10px;color:rgba(220,230,245,.55);letter-spacing:2px;margin-top:4px">CLUB</div>';
      h += '<div style="font-family:Oswald;font-size:14px;color:#D4A843;font-weight:700">'+escapeHtml(a.club||'—')+'</div>';
      h += '</div></div>';
      h += '<div style="font-size:10px;color:var(--muted);margin-top:6px">↑ Aprox cómo se verá durante la transmisión OBS. Si la cabeza queda muy abajo o se ve mucho cuerpo, usa los controles de Zoom/Mover de arriba.</div>';
      h += '</div>';

      // Editor de imagen
      h += '<div style="margin-top:12px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">';
      h += '<div style="font-size:10px;color:var(--muted);margin-bottom:8px;letter-spacing:1px;font-weight:700">AJUSTAR IMAGEN</div>';

      // Zoom
      h += '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--muted)">Zoom</span><span style="color:var(--gold)">'+F.transform.zoom.toFixed(2)+'x</span></div>';
      h += '<input type="range" min="0.3" max="3" step="0.05" value="'+F.transform.zoom+'" oninput="editorFotoSetZoom(this.value)" style="width:100%">';
      h += '<div style="display:flex;gap:6px;margin-top:4px"><button onclick="editorFotoZoom(-0.1)" style="flex:1;padding:6px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer;font-size:11px">- Zoom</button><button onclick="editorFotoZoom(0.1)" style="flex:1;padding:6px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer;font-size:11px">+ Zoom</button></div></div>';

      // Posición (D-pad)
      h += '<div style="margin-bottom:10px"><div style="font-size:11px;color:var(--muted);margin-bottom:6px">Mover</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-width:160px;margin:0 auto">';
      h += '<div></div><button onclick="editorFotoMove(0,-20)" style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">↑</button><div></div>';
      h += '<button onclick="editorFotoMove(-20,0)" style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">←</button>';
      h += '<button onclick="editorFotoReset()" style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--gold);border-radius:4px;cursor:pointer;font-size:10px"><i class=yl-i-restablecer></i></button>';
      h += '<button onclick="editorFotoMove(20,0)" style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">→</button>';
      h += '<div></div><button onclick="editorFotoMove(0,20)" style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">↓</button><div></div>';
      h += '</div></div>';

      // Rotación
      h += '<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Rotación: '+F.transform.rotation+'°</div>';
      h += '<div style="display:flex;gap:6px"><button onclick="editorFotoRotate(-90)" style="flex:1;padding:6px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer;font-size:11px">↺ -90°</button><button onclick="editorFotoRotate(90)" style="flex:1;padding:6px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer;font-size:11px">↻ +90°</button></div></div>';

      h += '</div>';

      h += '<div style="display:flex;gap:8px;margin-top:10px">';
      h += '<button onclick="cancelarFotoAtleta()" '+(F.processing?'disabled':'')+' style="flex:1;padding:12px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px"><i class=yl-i-cruz></i> Cancelar</button>';
      h += '<button onclick="guardarFotoAtleta()" '+(F.processing?'disabled':'')+' style="flex:2;padding:12px 20px;background:var(--green);color:#000;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700">'+(F.processing?'<i class=yl-i-espera></i> Procesando...':'<i class=yl-i-check></i> Aceptar y publicar')+'</button>';
      h += '</div>';
    }
    if(F.status){
      h += '<div style="margin-top:10px;padding:10px;background:rgba(34,197,94,.1);border-left:3px solid var(--green);font-size:12px;color:var(--green)">'+escapeHtml(F.status)+'</div>';
    }
    if(F.error){
      h += '<div style="margin-top:10px;padding:10px;background:rgba(239,68,68,.1);border-left:3px solid var(--red);font-size:12px;color:var(--red)">'+escapeHtml(F.error)+'</div>';
    }
    h += '</div></div></div>';

    // ── GIF / Video para transmisión ──────────────────────────────
    const _gifDoc2 = (ST.fotosByCodigo||{})[a.codigo];
    const _gifUrl  = _gifDoc2?.gif_url || null;
    const _gifBlend = F.gifBlend || _gifDoc2?.gif_blend || 'screen';
    h += '<div class="card" style="margin-top:14px;border-color:rgba(139,92,246,.4);background:rgba(139,92,246,.04)">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">';
    h += '<div><div style="font-family:Oswald;font-size:14px;font-weight:700;letter-spacing:1px;color:#a78bfa">GIF / VIDEO DE PERFIL TX</div>';
    h += '<div style="font-size:11px;color:var(--muted);margin-top:2px">Video corto (~3s) que aparece en el perfil durante la transmisión OBS. Se puede usar en lugar de la foto.</div></div>';
    if(_gifUrl){
      h += '<span style="background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.3);padding:3px 10px;border-radius:6px;font-size:10px;font-family:Oswald;font-weight:700;letter-spacing:1px"><i class=yl-i-check></i> CARGADO</span>';
    }
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">';
    // Columna izquierda: preview actual
    h += '<div>';
    h += '<div style="font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:6px">PREVIEW ACTUAL</div>';
    if(_gifUrl){
      h += '<div style="position:relative;width:100%;max-width:220px;aspect-ratio:3/4;border-radius:6px;overflow:hidden;border:2px solid rgba(139,92,246,.5);background:#000">';
      h += '<video src="'+escapeHtml(_gifUrl)+'" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;mix-blend-mode:'+_gifBlend+'"></video>';
      h += '</div>';
      h += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">';
      h += '<button onclick="borrarGifAtleta()" '+(F.gifUploading?'disabled':'')+' style="padding:7px 14px;background:transparent;border:1px solid var(--red);color:var(--red);border-radius:6px;cursor:pointer;font-size:11px">Borrar GIF</button>';
      h += '</div>';
    } else {
      h += '<div style="width:100%;max-width:220px;aspect-ratio:3/4;background:rgba(10,22,40,.6);border:2px dashed rgba(139,92,246,.4);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--muted)">';
      h += '<span style="font-size:30px"></span>';
      h += '<span style="font-size:11px">Sin GIF cargado</span>';
      h += '</div>';
    }
    h += '</div>';
    // Columna derecha: subida + config
    h += '<div>';
    h += '<div style="font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:6px">SUBIR NUEVO</div>';
    h += '<input type="file" id="gifInput" accept="video/*,image/gif" onchange="subirGifAtleta(this)" style="display:none">';
    h += '<button onclick="document.getElementById(\'gifInput\').click()" '+(F.gifUploading?'disabled':'')+' style="padding:11px 18px;background:rgba(139,92,246,.85);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;width:100%;margin-bottom:10px">'+(F.gifUploading?'<i class=yl-i-espera></i> Subiendo...':'Elegir GIF / Video')+'</button>';
    // Blend mode
    h += '<div style="margin-bottom:10px"><div style="font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:5px">MEZCLA DE FONDO</div>';
    h += '<select id="gifBlendSel" onchange="gifSetBlend(this.value)" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">';
    h += '<option value="screen" '+(_gifBlend==='screen'?'selected':'')+'>Screen — fondo negro se vuelve transparente</option>';
    h += '<option value="normal" '+(_gifBlend==='normal'?'selected':'')+'>Normal — sin mezcla (WebM con alpha)</option>';
    h += '<option value="multiply" '+(_gifBlend==='multiply'?'selected':'')+'>Multiply — fondo blanco se vuelve transparente</option>';
    h += '</select></div>';
    // Tip técnico
    h += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:10px;font-size:10px;color:rgba(245,158,11,.9);line-height:1.6">';
    h += '<b>Para que el fondo desaparezca:</b><br>';
    h += '• <b>Opción 1 (fácil)</b>: Graba frente a un <b>fondo negro</b> → usa "Screen".<br>';
    h += '• <b>Opción 2 (pro)</b>: Exporta desde Premiere/DaVinci como <b>WebM con canal Alpha</b> → usa "Normal".<br>';
    h += '• GIF, MP4 y WebM aceptados. Máx ~50 MB.';
    h += '</div>';
    if(F.gifStatus){h += '<div style="margin-top:8px;padding:8px;background:rgba(34,197,94,.1);border-left:3px solid var(--green);font-size:11px;color:var(--green)">'+escapeHtml(F.gifStatus)+'</div>';}
    if(F.gifError){h += '<div style="margin-top:8px;padding:8px;background:rgba(239,68,68,.1);border-left:3px solid var(--red);font-size:11px;color:var(--red)">'+escapeHtml(F.gifError)+'</div>';}
    h += '</div>'; // right col
    h += '</div>'; // grid 2 cols

    // ── Editor de GIF (zoom / posición / recorte) ─────────────────
    if(_gifUrl){
      const E = F.gifEditor || {zoom:1.0,offsetX:0,offsetY:0,startTime:0,endTime:null};
      const tx = 'scale('+E.zoom+') translate('+E.offsetX+'%,'+E.offsetY+'%)';
      h += '<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(139,92,246,.3)">';
      h += '<div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:#a78bfa;margin-bottom:12px">AJUSTAR GIF — ZOOM · POSICIÓN · RECORTE</div>';
      h += '<div style="display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:start">';
      // Preview
      h += '<div>';
      h += '<div style="font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:5px">VISTA PREVIA</div>';
      h += '<div style="position:relative;width:200px;height:267px;background:#000;border-radius:6px;overflow:hidden;border:2px solid rgba(139,92,246,.5)">';
      h += '<video id="gifPreviewVid" src="'+escapeHtml(_gifUrl)+'" autoplay loop muted playsinline '
        +'ontimeupdate="gifTrimLoop(this)" onloadedmetadata="gifEditorOnMeta(this)" '
        +'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:'+_gifBlend+';transform:'+tx+';transform-origin:center center"></video>';
      h += '</div>';
      h += '<div id="gifDuration" style="font-size:10px;color:var(--muted);margin-top:5px;font-family:Oswald;letter-spacing:1px"><i class=yl-i-espera></i> Cargando duración...</div>';
      h += '</div>';
      // Controls
      h += '<div style="display:flex;flex-direction:column;gap:12px">';
      // Zoom
      h += '<div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--muted)">Zoom</span><span id="gifZoomVal" style="color:#a78bfa;font-family:Oswald;font-weight:700">'+E.zoom.toFixed(2)+'x</span></div>';
      h += '<input type="range" min="0.5" max="3" step="0.05" value="'+E.zoom+'" oninput="gifEditorSetZoom(this.value)" style="width:100%;accent-color:#a78bfa">';
      h += '<div style="display:flex;gap:5px;margin-top:5px">';
      h += '<button onclick="gifEditorZoom(-0.1)" style="flex:1;padding:6px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer;font-size:12px">− Zoom</button>';
      h += '<button onclick="gifEditorZoom(0.1)"  style="flex:1;padding:6px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer;font-size:12px">+ Zoom</button>';
      h += '</div></div>';
      // D-pad
      h += '<div>';
      h += '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Mover</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(3,36px);gap:3px">';
      h += '<div></div>';
      h += '<button onclick="gifEditorMove(0,-5)" style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">↑</button>';
      h += '<div></div>';
      h += '<button onclick="gifEditorMove(-5,0)" style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">←</button>';
      h += '<button onclick="gifEditorReset()"    style="padding:8px;background:var(--card);border:1px solid var(--border);color:#a78bfa;border-radius:4px;cursor:pointer;font-size:10px"><i class=yl-i-restablecer></i></button>';
      h += '<button onclick="gifEditorMove(5,0)"  style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">→</button>';
      h += '<div></div>';
      h += '<button onclick="gifEditorMove(0,5)"  style="padding:8px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer">↓</button>';
      h += '<div></div>';
      h += '</div></div>';
      // ── Timeline Trimmer ─────────────────────────────────
      h += '<div>';
      h += '<div style="font-size:11px;color:var(--muted);margin-bottom:10px;font-weight:700;letter-spacing:1px">RECORTE</div>';
      h += '<div id="gifTimeline" style="position:relative;height:52px;margin:0 10px;cursor:pointer;touch-action:none">';
      // track fondo
      h += '<div style="position:absolute;top:50%;left:0;right:0;height:12px;transform:translateY(-50%);background:rgba(255,255,255,.07);border-radius:6px"></div>';
      // región seleccionada
      h += '<div id="gifTrimRegion" style="position:absolute;top:50%;height:12px;transform:translateY(-50%);background:rgba(212,168,67,.35);border:2px solid #D4A843;border-radius:4px;pointer-events:none;box-sizing:border-box"></div>';
      // playhead
      h += '<div id="gifPlayhead" style="position:absolute;top:6px;bottom:6px;width:2px;background:rgba(255,255,255,.85);border-radius:1px;pointer-events:none;transform:translateX(-50%)"></div>';
      // handle izquierdo
      h += '<div id="gifTrimLeft" style="position:absolute;top:50%;width:20px;height:44px;transform:translate(-50%,-50%);background:#D4A843;border-radius:5px;cursor:ew-resize;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.6);z-index:3;touch-action:none">';
      h += '<span style="color:#000;font-size:8px;font-weight:900;letter-spacing:-2px">|||</span></div>';
      // handle derecho
      h += '<div id="gifTrimRight" style="position:absolute;top:50%;width:20px;height:44px;transform:translate(-50%,-50%);background:#D4A843;border-radius:5px;cursor:ew-resize;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.6);z-index:3;touch-action:none">';
      h += '<span style="color:#000;font-size:8px;font-weight:900;letter-spacing:-2px">|||</span></div>';
      h += '</div>'; // timeline
      h += '<div id="gifTrimLabels" style="font-size:10px;text-align:center;margin-top:8px;font-family:Oswald;letter-spacing:1px;color:var(--muted)">cargando...</div>';
      h += '</div>'; // trim section
      h += '<button onclick="guardarAjustesGif()" style="padding:11px;background:rgba(139,92,246,.9);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;font-family:Oswald;letter-spacing:1px;width:100%">GUARDAR AJUSTES</button>';
      h += '</div>'; // controls
      h += '</div>'; // grid editor
      h += '</div>'; // editor section
    }
    h += '</div>'; // card GIF

    // Tip de uso
    h += '<div class="card" style="margin-top:14px;background:rgba(59,130,246,.05);border-color:rgba(59,130,246,.3)">';
    h += '<div style="font-size:11px;color:#3b82f6;font-weight:700;margin-bottom:6px">RECOMENDACIONES PARA LA FOTO</div>';
    h += '<ul style="font-size:12px;color:var(--muted);margin:0;padding-left:18px;line-height:1.7">';
    h += '<li>Foto de cara o medio cuerpo, mirando al frente</li>';
    h += '<li>Buena iluminación, sin sombras fuertes</li>';
    h += '<li>Cualquier fondo (el sistema lo quita automáticamente)</li>';
    h += '<li>Idealmente vertical (formato 3:4) o cuadrada</li>';
    h += '<li>El procesamiento toma ~10-30 segundos según el tamaño</li>';
    h += '</ul></div>';
  }

  return h;
}

// El instante en que el atleta subió la foto. Viene en el propio nombre del
// archivo (carnetPhoto_1787878495703.webp), que lo pone el formulario al subir.
function _fotoSubidaMs(url){
  const m = String(url||'').match(/carnetPhoto_(\d{10,})/);
  return m ? +m[1] : 0;
}

// La foto que mandó el atleta al inscribirse. UNA sola forma de encontrarla.
//
// Antes había dos: la tarjeta armaba su propio índice y el botón de confirmar
// buscaba por su cuenta, y desempataban al revés —una se quedaba con la primera
// que encontraba y la otra con la última—. Con más de una inscripción con foto y
// las dos sin `ts`, se veía una foto en la tarjeta y se publicaba la otra.
//
// El desempate ya no depende del orden en que Firestore devuelva los documentos:
// primero el instante de la subida, que está en el nombre del archivo, y recién
// después el `ts` de la inscripción.
function _fotosInscripcionIndex(){
  const idx = {};
  Object.entries(ST.inscripcionesPrivate||{}).forEach(([docId, priv])=>{
    if(!priv || !priv.carnetPhotoURL) return;
    // El docId es {evento}_{rutClean}; el doc además trae el rut adentro. Se
    // indexa por los dos, porque no siempre coinciden.
    const docRut = docId.includes('_') ? docId.split('_').slice(1).join('_') : '';
    const cand = {
      url: priv.carnetPhotoURL,
      subida: _fotoSubidaMs(priv.carnetPhotoURL),
      ts: priv.ts?.seconds || priv.ts?.toMillis?.() || 0,
    };
    [...new Set([_rutFoto(priv.rut), _rutFoto(docRut)].filter(Boolean))].forEach(k=>{
      const ant = idx[k];
      if(!ant || cand.subida>ant.subida || (cand.subida===ant.subida && cand.ts>ant.ts)) idx[k]=cand;
    });
  });
  return idx;
}

function _findInscriptionPhotoByRut(rut, idx){
  const k = _rutFoto(rut);
  if(!k) return null;
  const e = (idx || _fotosInscripcionIndex())[k];
  return e ? e.url : null;
}

// Deja anotado lo que se acaba de guardar en las dos entradas —código y RUT—,
// para que la fila se vaya de la lista sin esperar a recargar.
function _recordarFoto(codigo, rut, datos){
  if(!ST.fotosByCodigo) ST.fotosByCodigo = {};
  if(!ST.fotosByRut) ST.fotosByRut = {};
  const prev = ST.fotosByCodigo[codigo] || {};
  const fd = Object.assign({}, prev, datos);
  ST.fotosByCodigo[codigo] = fd;
  const k = _rutFoto(rut);
  if(k) ST.fotosByRut[k] = fd;
  return fd;
}

// Cuándo se decidió por última vez sobre la foto de este atleta. Sirve para las
// fotos viejas, de antes de que se guardara `source_url`: si la decisión es
// posterior a la subida, ya se miró esa foto.
function _fotoDecisionMs(fd){
  if(!fd) return 0;
  const ts = fd.ts && fd.ts.seconds ? fd.ts.seconds*1000 : (+fd.ts||0);
  return Math.max(+fd.updated||0, +fd.rejected_at||0, ts);
}

// La foto de inscripción de este atleta sobre la que TODAVÍA no se decidió nada,
// o null si ya se resolvió. Antes la pregunta era "¿tiene foto publicada?", y
// eso fallaba por los dos lados:
//
//   · Si la foto publicada no llegaba a pegarse sobre el padrón —el doc quedó
//     colgando de un código viejo, o el status decía 'rejected' por una foto
//     posterior— el atleta volvía a la lista aunque su foto ya estuviera al aire.
//   · Y al revés: el que YA tenía foto y mandaba otra nueva al inscribirse no
//     aparecía nunca, porque bastaba tener una publicada para quedar fuera. Esa
//     foto nueva no la veía nadie.
//
// Ahora se compara contra la foto puntual: se resolvió si se publicó tal cual,
// si la publicada salió de ella (`source_url`), o si se rechazó.
function _fotoPendienteDe(a, idx){
  const e = (idx || _fotosInscripcionIndex())[_rutFoto(a.rut)];
  if(!e || !e.url) return null;
  const u = e.url;
  const fd = (ST.fotosByCodigo||{})[a.codigo] || (ST.fotosByRut||{})[_rutFoto(a.rut)];
  if(fd && (fd.foto_url===u || fd.source_url===u || fd.rejected_url===u)) return null;
  if(a.foto_url){
    // Ya tiene una publicada: esta solo es "nueva" si la mandó DESPUÉS de que se
    // decidió la que tiene. Sin fecha de decisión —fotos de data.json, docs
    // viejos— no hay con qué comparar y se deja quieta, para no llenar la lista
    // de fotos que nadie pidió revisar.
    const dec = _fotoDecisionMs(fd);
    if(!dec || !e.subida || dec >= e.subida) return null;
  }
  return u;
}

// Quiénes tienen foto de inscripción esperando revisión. Una sola vez, porque
// esto se preguntaba en TRES lugares —la tarjeta, "seleccionar todas" y el
// contador— cada uno con su propia copia de la regla, y bastaba que una se
// quedara atrás para que el botón dijera una cosa y la lista mostrara otra.
// Devuelve la lista, la foto exacta que se va a publicar, y si reemplaza a una
// que el atleta ya tenía.
function _fotosPendientes(){
  const idx = _fotosInscripcionIndex();
  const url = {}, nueva = {};
  const lista = (ST.data||[]).filter(a=>{
    const u = _fotoPendienteDe(a, idx);
    if(!u) return false;
    url[a.codigo] = u;
    nueva[a.codigo] = !!a.foto_url;   // ya tiene foto: esta la reemplaza
    return true;
  });
  return {lista, url, nueva};
}

// Manejo del input de búsqueda: actualiza estado, re-renderiza, y
// restaura foco + posición del cursor al final (sino se sale al escribir)
window.onFotoSearchInput = function(el){
  window._fotosState.search = el.value;
  const cursorPos = el.selectionStart;
  render();
  // Después del re-render, recuperamos foco y cursor en el nuevo elemento
  requestAnimationFrame(()=>{
    const newEl = document.getElementById('fotoSearchInput');
    if(newEl){
      newEl.focus();
      try{ newEl.setSelectionRange(cursorPos, cursorPos); }catch(e){}
    }
  });
};

window.seleccionarAtletaFoto = function(codigo){
  const a = (ST.data||[]).find(x=>x.codigo===codigo);
  if(!a){alert('Atleta no encontrado'); return;}
  window._fotosState.selected = a;
  window._fotosState.file = null;
  window._fotosState.preview = null;
  window._fotosState.status = '';
  window._fotosState.error = '';
  window._fotosState.bgRemovedImg = null;
  window._fotosState.transform = {zoom:1.0, offsetX:0, offsetY:0, rotation:0};
  // GIF state reset
  window._fotosState.gifUploading = false;
  window._fotosState.gifStatus = '';
  window._fotosState.gifError = '';
  const _gifDoc = (ST.fotosByCodigo||{})[a.codigo];
  window._fotosState.gifBlend = _gifDoc?.gif_blend || 'screen';
  window._fotosState.gifEditor = {
    zoom:     _gifDoc?.gif_zoom      || 1.0,
    offsetX:  _gifDoc?.gif_offset_x  || 0,
    offsetY:  _gifDoc?.gif_offset_y  || 0,
    startTime:_gifDoc?.gif_start     || 0,
    endTime:  _gifDoc?.gif_end       ?? null,
    duration: null,
  };
  // Detectar foto pendiente de la inscripcion. Solo la que falta revisar: si se
  // mostrara siempre la última que mandó, el que ya tiene su foto aprobada vería
  // un "pendiente de revisión" con la misma foto que ya está publicada.
  window._fotosState.pendingPhotoUrl = _fotoPendienteDe(a);
  window._fotosState.importedFrom = null;
  render();
};

// ── Selección múltiple: confirmar varias fotos pendientes de golpe ──
// Publica la foto TAL CUAL la mandó el atleta (sin quitar fondo) — el
// mismo resultado que "Importar tal cual (con fondo)" pero sin re-subir
// el archivo a Storage: referencia directo la URL ya subida en la
// inscripción, así que es instantáneo y no depende de CORS/canvas.
window.toggleFotoBulkSel = function(codigo){
  const F = window._fotosState;
  F.bulkSel = F.bulkSel || {};
  if(F.bulkSel[codigo]) delete F.bulkSel[codigo];
  else F.bulkSel[codigo] = true;
  render();
};

window.toggleFotoBulkSelAll = function(checkAll){
  const F = window._fotosState;
  const {lista: pendientes} = _fotosPendientes();
  F.bulkSel = {};
  if(checkAll) pendientes.forEach(a=>{ F.bulkSel[a.codigo] = true; });
  render();
};

window.confirmarFotosBulk = async function(){
  const F = window._fotosState;
  const codigos = Object.keys(F.bulkSel||{}).filter(k=>F.bulkSel[k]);
  if(!codigos.length) return;
  if(!confirm('¿Confirmar '+codigos.length+' foto(s) tal cual las mandaron los atletas (sin quitar fondo)?\n\nSe publican al instante en sus perfiles.')) return;
  F.bulkProcessing = true;
  let done=0, errors=0;
  // Los que fallan se guardan CON NOMBRE Y MOTIVO. Antes solo se contaban, así
  // que el aviso decía "3 con error" sin decir quiénes: quedaban seleccionados
  // entre los demás y no había forma de saber a cuáles volver.
  const fallaron = [];
  const idx = _fotosInscripcionIndex();
  render();
  for(const codigo of codigos){
    F.bulkProgress = 'Confirmando '+(done+errors+1)+'/'+codigos.length+'...';
    render();
    const a = (ST.data||[]).find(x=>x.codigo===codigo);
    if(!a){ errors++; fallaron.push(codigo+': no está en el padrón'); continue; }
    const url = _findInscriptionPhotoByRut(a.rut, idx);
    if(!url){ errors++; fallaron.push((a.nombre||codigo)+': no se encontró la foto de su inscripción'); continue; }
    try{
      const docRef = doc(db, 'atleta_fotos', codigo);
      // `source_url` deja anotado de QUÉ foto de inscripción salió esta. Sin eso
      // no hay forma de distinguir "ya la revisé" de "mandó otra después", y el
      // atleta volvía a la lista de pendientes en cada carga.
      const datos = {
        codigo, rut: a.rut||'', nombre: a.nombre||'',
        foto_url: url, source_url: url, status: 'approved',
        approved_by: ST.user?.email || 'admin',
        source: 'bulk_import_inscripcion',
        rejected_url: null,
        updated: Date.now()
      };
      await setDoc(docRef, datos, {merge:true});
      // La copia local se guardaba recortada (solo codigo/foto_url/status) y
      // perdía justo la fecha y el origen, así que la fila reaparecía sola.
      _recordarFoto(codigo, a.rut, datos);
      a.foto_url = url;
      delete F.bulkSel[codigo];
      done++;
    }catch(e){
      console.error('[Fotos] bulk confirm error:', codigo, e);
      errors++;
      fallaron.push((a.nombre||codigo)+': '+(e.message||'error al guardar'));
    }
  }
  F.bulkProcessing = false;
  F.bulkProgress = '';
  F.bulkFallaron = fallaron;
  try{ await logAction('bulk_confirm_fotos','atleta_fotos',null,done+' confirmadas, '+errors+' errores'); }catch(_){}
  showToast(errors>0 ? (done+' confirmadas — '+errors+' con error') : (done+' fotos confirmadas'));
  render();
  if(errors>0) alert('No se pudieron confirmar '+errors+':\n\n'+fallaron.join('\n'));
};

// Cancela el procesamiento actual sin guardar nada (descartar preview)
window.cancelarFotoAtleta = function(){
  const F = window._fotosState;
  F.preview = null;
  F.file = null;
  F.bgRemovedImg = null;
  F.transform = {zoom:1.0, offsetX:0, offsetY:0, rotation:0};
  F.status = '';
  F.error = '';
  render();
};

// Rechaza la foto de inscripción (no la publica). Marca el doc en
// atleta_fotos con status:'rejected' para que no aparezca como pendiente.
window.rechazarFotoInscripcion = async function(){
  const F = window._fotosState;
  if(!F.selected || !F.pendingPhotoUrl) return;
  if(F.processing) return;
  if(!confirm('¿Rechazar la foto de '+F.selected.nombre+'?\n\nLa foto no se publicará. El atleta podrá subir otra.')) return;
  F.processing = true;
  F.status = 'Rechazando foto...';
  render();
  try{
    const docRef = doc(db, 'atleta_fotos', F.selected.codigo);
    const datos = {
      codigo: F.selected.codigo,
      rut: F.selected.rut||'',
      nombre: F.selected.nombre||'',
      status: 'rejected',
      rejected_url: F.pendingPhotoUrl,
      rejected_at: Date.now(),
      updated: Date.now(),
      rejected_by: ST.user?.email || 'admin'
    };
    await setDoc(docRef, datos, {merge:true});
    _recordarFoto(F.selected.codigo, F.selected.rut, datos);
    F.pendingPhotoUrl = null;
    F.importedFrom = null;
    F.status = 'Foto rechazada (no se publicó)';
    F.processing = false;
    render();
  } catch(e){
    F.error = 'Error rechazando: ' + e.message;
    F.processing = false;
    F.status = '';
    render();
  }
};

// Importa la foto de inscripcion al flujo de procesamiento
window.importarFotoInscripcion = async function(){
  const F = window._fotosState;
  if(!F.pendingPhotoUrl){F.error='No hay foto de inscripción pendiente'; render(); return;}
  F.processing = true;
  F.status = 'Descargando foto de inscripción...';
  F.error = '';
  render();
  try{
    // Firebase Storage bloquea fetch() directo por CORS desde yourlift.cl.
    // Workaround: cargar como <img>, dibujar en canvas, exportar a Blob.
    // Los <img> tags NO tienen restricción de CORS para cargar la imagen,
    // pero canvas.toBlob() puede fallar si la imagen NO está crossorigin'd.
    // Por eso intentamos primero con crossOrigin='anonymous' (funciona con
    // Firebase Storage cuando el bucket tiene CORS público o el download
    // token está presente).
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(new Error('No se pudo cargar la imagen (revisar CORS o URL)'));
      i.src = F.pendingPhotoUrl;
    });
    // Dibujar en canvas para extraer Blob
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo convertir la imagen')), 'image/jpeg', 0.95);
    });
    const file = new File([blob], 'inscripcion_photo.jpg', {type: 'image/jpeg'});
    const fakeInput = {files:[file]};
    const origen = F.pendingPhotoUrl;
    F.processing = false;
    await window.cargarFotoAtleta(fakeInput);
    F.importedFrom = origen;   // después: cargarFotoAtleta lo limpia al empezar
  } catch(e){
    console.error('[Fotos] importar inscripcion error:', e);
    F.error = 'Error importando: '+e.message+' — alternativa: descarga la foto manualmente del enlace Ver en Nóminas y súbela con "Elegir otra foto".';
    F.processing = false;
    F.status = '';
    render();
  }
};

// Importa la foto que mandó el atleta TAL CUAL — sin quitarle el fondo.
window.importarFotoInscripcionSinFondo = async function(){
  const F = window._fotosState;
  if(!F.pendingPhotoUrl){F.error='No hay foto de inscripción pendiente'; render(); return;}
  F.processing = true;
  F.status = 'Descargando foto del atleta...';
  F.error = '';
  F.bgRemovedImg = null;
  render();
  try{
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo cargar la imagen (revisar CORS o URL)'));
      i.src = F.pendingPhotoUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    F.preview = canvas.toDataURL('image/jpeg', 0.95);   // tal cual, con su fondo
    F.importedFrom = F.pendingPhotoUrl;
    F.status = 'Lista para subir (foto del atleta, sin modificar).';
    F.processing = false;
    render();
  } catch(e){
    console.error('[Fotos] importar sin fondo error:', e);
    F.error = 'Error importando: '+e.message+' — alternativa: descarga la foto del enlace Ver en Nóminas y súbela con "Sin procesar (tal cual)".';
    F.processing = false;
    F.status = '';
    render();
  }
};

window.cargarFotoAtleta = async function(input){
  const file = input.files && input.files[0];
  if(!file) return;
  const F = window._fotosState;
  F.file = file;
  F.importedFrom = null;   // archivo elegido a mano: no viene de una inscripción
  F.status = 'Procesando foto (quitando fondo)... esto puede tomar 10-30s';
  F.error = '';
  F.preview = null;
  F.processing = true;
  render();
  try{
    // Lazy-load de imgly background-removal (solo cuando se necesita)
    if(!window.imglyRemoveBackground){
      F.status = 'Cargando módulo de procesamiento (~30 MB la primera vez)...';
      render();
      await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm').then(m=>{
        window.imglyRemoveBackground = m.removeBackground;
      });
    }
    F.status = 'Quitando fondo...';
    render();
    const blob = await window.imglyRemoveBackground(file, {
      output:{format:'image/png', quality:0.95}
    });
    // Cargar imagen sin fondo y guardarla para el editor
    const url = URL.createObjectURL(blob);
    const img = await new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url;});
    F.bgRemovedImg = img;
    F.transform = {zoom:1.0, offsetX:0, offsetY:0, rotation:0};
    _redrawFotoPreview();  // genera el preview inicial centrado
    URL.revokeObjectURL(url);
    F.status = 'Lista. Ajusta la posición/zoom si hace falta y guarda.';
    F.processing = false;
    render();
  } catch(e){
    console.error('[Fotos] error:', e);
    F.error = 'Error procesando: ' + e.message + '. Prueba con otra foto o más chica (<5MB).';
    F.processing = false;
    F.status = '';
    render();
  }
};

// Sube la foto sin ningún procesamiento — tal cual, sin quitar fondo ni canvas blanco
window.cargarFotoAtletaSinFondo = async function(input){
  const file = input.files && input.files[0];
  if(!file) return;
  const F = window._fotosState;
  F.file = file;
  F.importedFrom = null;   // archivo elegido a mano: no viene de una inscripción
  F.status = 'Cargando imagen...';
  F.error = '';
  F.preview = null;
  F.bgRemovedImg = null;
  F.processing = true;
  render();
  try{
    // Leer como data URL directamente — sin canvas, sin fondo blanco, sin imgly
    const dataUrl = await new Promise((res,rej)=>{
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    F.preview = dataUrl;
    F.status = 'Lista para subir (foto sin modificar).';
    F.processing = false;
    render();
  }catch(e){
    F.error = 'Error cargando imagen: '+e.message;
    F.processing = false;
    F.status = '';
    render();
  }
};

window.guardarFotoAtleta = async function(){
  const F = window._fotosState;
  if(!F.preview || !F.selected) return;
  if(F.processing){console.log('[Fotos] ya procesando, ignorando click duplicado'); return;}  // ← anti-doble-click
  F.processing = true;
  F.status = 'Subiendo a Storage...';
  F.error = '';
  render();
  try{
    const dataUrl = F.preview;
    const blob = await (await fetch(dataUrl)).blob();
    const rutKey = (F.selected.rut||F.selected.codigo||'unknown').replace(/[^0-9a-zA-Z]/g,'_');
    const ts = Date.now();
    const path = 'athlete_photos/'+rutKey+'_'+ts+'.jpg';
    const storage = getStorage(app);
    const ref = storageRef(storage, path);
    await uploadBytes(ref, blob, {contentType:'image/jpeg'});
    const url = await getDownloadURL(ref);
    // Guardamos la foto en la colección atleta_fotos (separada de data.json)
    const docRef = doc(db, 'atleta_fotos', F.selected.codigo);
    const datos = {
      codigo: F.selected.codigo,
      rut: F.selected.rut||'',
      nombre: F.selected.nombre||'',
      foto_url: url,
      // De cuál foto de inscripción salió, si salió de una: es lo que después
      // distingue "ya la revisé" de "el atleta mandó otra".
      source_url: F.importedFrom || null,
      storage_path: path,
      status: 'approved',
      rejected_url: null,
      approved_by: ST.user?.email || 'admin',
      updated: ts
    };
    await setDoc(docRef, datos, {merge:true});
    // Update local cache
    _recordarFoto(F.selected.codigo, F.selected.rut, datos);
    F.pendingPhotoUrl = null;
    F.importedFrom = null;
    // Update local state
    F.selected.foto_url = url;
    const localAth = (ST.data||[]).find(a=>a.codigo===F.selected.codigo);
    if(localAth) localAth.foto_url = url;
    F.status = 'Foto guardada y publicada';
    F.preview = null;
    F.file = null;
    F.bgRemovedImg = null;
    F.transform = {zoom:1.0, offsetX:0, offsetY:0, rotation:0};
    F.processing = false;
    render();
  } catch(e){
    console.error('[Fotos] save error:', e);
    F.error = 'Error guardando: ' + e.message + '. Si dice "permissions" → desplegar reglas/firestore.rules.';
    F.processing = false;
    F.status = '';
    render();
  }
};

window.borrarFotoAtleta = async function(){
  const F = window._fotosState;
  if(!F.selected || !F.selected.foto_url) return;
  if(F.processing) return;
  if(!confirm('¿Borrar la foto de '+F.selected.nombre+'?')) return;
  F.processing = true;
  render();
  try{
    const docRef = doc(db, 'atleta_fotos', F.selected.codigo);
    await deleteDoc(docRef);
    delete F.selected.foto_url;
    if(ST.fotosByCodigo) delete ST.fotosByCodigo[F.selected.codigo];
    if(ST.fotosByRut) delete ST.fotosByRut[_rutFoto(F.selected.rut)];
    const localAth = (ST.data||[]).find(a=>a.codigo===F.selected.codigo);
    if(localAth) delete localAth.foto_url;
    F.pendingPhotoUrl = _fotoPendienteDe(F.selected);   // vuelve a quedar por revisar
    F.status = 'Foto borrada';
    F.processing = false;
    render();
  } catch(e){
    F.error = 'Error: '+e.message;
    F.processing = false;
    render();
  }
};

window.gifSetBlend = function(v){
  window._fotosState.gifBlend = v;
  ['gifPreviewVid'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.mixBlendMode=v;});
};

// ── GIF Editor — funciones de ajuste ──────────────────────────────
function _gifEditorApply(){
  const F = window._fotosState;
  const E = F.gifEditor;
  const vid = document.getElementById('gifPreviewVid');
  if(vid){
    vid.style.transform = 'scale('+E.zoom+') translate('+E.offsetX+'%,'+E.offsetY+'%)';
  }
  const zv = document.getElementById('gifZoomVal');
  if(zv) zv.textContent = E.zoom.toFixed(2)+'x';
}

window.gifEditorSetZoom = function(v){
  window._fotosState.gifEditor.zoom = Math.max(0.5, Math.min(3, parseFloat(v)||1));
  _gifEditorApply();
};

window.gifEditorZoom = function(delta){
  const E = window._fotosState.gifEditor;
  gifEditorSetZoom(E.zoom + delta);
};

window.gifEditorMove = function(dx, dy){
  const E = window._fotosState.gifEditor;
  E.offsetX = Math.max(-50, Math.min(50, E.offsetX + dx));
  E.offsetY = Math.max(-50, Math.min(50, E.offsetY + dy));
  _gifEditorApply();
};

window.gifEditorReset = function(){
  window._fotosState.gifEditor = {zoom:1.0,offsetX:0,offsetY:0,
    startTime:window._fotosState.gifEditor.startTime||0,
    endTime:window._fotosState.gifEditor.endTime,
    duration:window._fotosState.gifEditor.duration};
  _gifEditorApply();
  const sl = document.querySelector('input[oninput*="gifEditorSetZoom"]');
  if(sl) sl.value = 1.0;
};

window.gifTrimLoop = function(vid){
  const E = window._fotosState?.gifEditor;
  if(!E) return;
  const end = E.endTime != null ? E.endTime : Infinity;
  if(vid.currentTime >= end) vid.currentTime = E.startTime || 0;
};

window.gifEditorOnMeta = function(vid){
  const dur = vid.duration;
  const F = window._fotosState;
  if(F.gifEditor) F.gifEditor.duration = dur;
  const el = document.getElementById('gifDuration');
  if(el) el.textContent = 'Duración: '+dur.toFixed(2)+'s';
  vid.currentTime = F.gifEditor?.startTime || 0;
  _setupGifTimeline();
};

function _setupGifTimeline(){
  if(_gifTimelineCleanup){ _gifTimelineCleanup(); _gifTimelineCleanup=null; }
  const tl   = document.getElementById('gifTimeline');
  const lh   = document.getElementById('gifTrimLeft');
  const rh   = document.getElementById('gifTrimRight');
  const vid  = document.getElementById('gifPreviewVid');
  if(!tl || !lh || !rh || !vid) return;

  function E(){ return window._fotosState?.gifEditor; }
  function dur(){ return E()?.duration || vid.duration || 1; }

  function pctFromClientX(cx){
    const r = tl.getBoundingClientRect();
    return Math.max(0, Math.min(1, (cx - r.left) / r.width));
  }

  function refreshUI(){
    const e=E(); if(!e) return;
    const d=dur();
    const s=e.startTime||0;
    const en=e.endTime!=null?e.endTime:d;
    const lp=(s/d*100).toFixed(3)+'%';
    const rp=(en/d*100).toFixed(3)+'%';
    lh.style.left=lp; rh.style.left=rp;
    const reg=document.getElementById('gifTrimRegion');
    if(reg){ reg.style.left=lp; reg.style.width=((en-s)/d*100).toFixed(3)+'%'; }
    const lbl=document.getElementById('gifTrimLabels');
    if(lbl){
      const len=(en-s).toFixed(2);
      lbl.innerHTML='<span style="color:#D4A843">'+s.toFixed(2)+'s</span>'
        +' <span style="color:var(--muted)">→</span> '
        +'<span style="color:#D4A843">'+en.toFixed(2)+'s</span>'
        +' <span style="color:var(--muted);font-size:9px">('+len+'s seleccionados)</span>';
    }
  }

  // Playhead mientras reproduce
  vid.ontimeupdate=function(){
    const d=dur();
    const ph=document.getElementById('gifPlayhead');
    if(ph) ph.style.left=(vid.currentTime/d*100).toFixed(3)+'%';
    const e=E();
    if(e){ const end=e.endTime!=null?e.endTime:Infinity; if(vid.currentTime>=end) vid.currentTime=e.startTime||0; }
  };

  // Click en la barra para saltar
  tl.addEventListener('click', function(ev){
    if(window._gifTlDrag) return;
    vid.currentTime = pctFromClientX(ev.clientX) * dur();
  });

  // Drag con Pointer Events (mouse + touch)
  function startDrag(which, ev){
    ev.preventDefault(); ev.stopPropagation();
    window._gifTlDrag = which;
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }
  function onMove(ev){
    if(!window._gifTlDrag) return;
    const t = pctFromClientX(ev.clientX) * dur();
    const e = E(); if(!e) return;
    const d = dur();
    if(window._gifTlDrag==='left'){
      e.startTime = Math.max(0, Math.min(t, (e.endTime!=null?e.endTime:d)-0.05));
      vid.currentTime = e.startTime;
    } else {
      e.endTime = Math.min(d, Math.max(t, (e.startTime||0)+0.05));
    }
    refreshUI();
  }
  function endDrag(){ window._gifTlDrag=null; }

  lh.addEventListener('pointerdown', ev=>startDrag('left',ev));
  rh.addEventListener('pointerdown', ev=>startDrag('right',ev));
  lh.addEventListener('pointermove', onMove);
  rh.addEventListener('pointermove', onMove);
  lh.addEventListener('pointerup', endDrag);
  rh.addEventListener('pointerup', endDrag);

  refreshUI();
  _gifTimelineCleanup = ()=>{ window._gifTlDrag=null; };
}

window.quitarFondoGif = async function(){
  const F = window._fotosState;
  if(!F.selected) return;
  const gifDoc = (ST.fotosByCodigo||{})[F.selected.codigo];
  const gifUrl = gifDoc?.gif_url;
  if(!gifUrl){ alert('Sube el GIF primero antes de procesar.'); return; }

  function setAIStatus(msg, pct){
    const el=document.getElementById('gifAIStatus');
    const pb=document.getElementById('gifAIProgress');
    const bar=document.getElementById('gifAIProgressBar');
    const btn=document.getElementById('gifAIBtn');
    if(el){ el.style.display=msg?'block':'none'; el.textContent=msg||''; }
    if(pb){ pb.style.display=pct!=null?'block':'none'; }
    if(bar&&pct!=null){ bar.style.width=pct+'%'; }
    if(btn){ btn.disabled=!!msg; btn.style.opacity=msg?.5:1; }
  }

  setAIStatus('Cargando módulo IA (~30 MB la primera vez)...', 0);
  try{
    // 1. Cargar imgly si no está
    if(!window.imglyRemoveBackground){
      await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm')
        .then(m=>{ window.imglyRemoveBackground=m.removeBackground; });
    }

    // 2. Cargar el video original
    setAIStatus('Cargando video...', 2);
    const video=document.createElement('video');
    video.crossOrigin='anonymous'; video.muted=true; video.src=gifUrl;
    await new Promise((res,rej)=>{ video.onloadedmetadata=res; video.onerror=rej; video.load(); });
    const W=video.videoWidth, H=video.videoHeight;
    const dur=video.duration;
    const fps=Math.min(12, Math.max(8, Math.round(1/(dur/Math.round(dur*10)))||10));
    const totalFrames=Math.max(1,Math.round(dur*fps));
    const frameDurMs=1000/fps;

    // 3. Extraer y procesar cada frame
    const frameCanvas=document.createElement('canvas');
    frameCanvas.width=W; frameCanvas.height=H;
    const ctx=frameCanvas.getContext('2d');
    const processedBitmaps=[];

    for(let i=0;i<totalFrames;i++){
      const t=Math.min(i/fps, dur-0.05);
      video.currentTime=t;
      await new Promise(res=>{ video.onseeked=()=>res(); setTimeout(res,500); });
      ctx.drawImage(video,0,0,W,H);
      const frameBlob=await new Promise(res=>frameCanvas.toBlob(res,'image/png',0.92));
      const pct=Math.round((i/totalFrames)*80);
      setAIStatus(`Quitando fondo: frame ${i+1} / ${totalFrames}...`, pct);
      const processed=await window.imglyRemoveBackground(frameBlob,{
        output:{format:'image/png',quality:0.92}
      });
      processedBitmaps.push(await createImageBitmap(processed));
    }

    // 4. Re-ensamblar como WebM con alpha (VP9)
    setAIStatus('Ensamblando video transparente...', 82);
    const outCanvas=document.createElement('canvas');
    outCanvas.width=W; outCanvas.height=H;
    const outCtx=outCanvas.getContext('2d');
    const mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ?'video/webm;codecs=vp9':'video/webm';
    const stream=outCanvas.captureStream(fps);
    const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:6000000});
    const chunks=[];
    recorder.ondataavailable=e=>{ if(e.data.size)chunks.push(e.data); };
    recorder.start();
    await new Promise(res=>{
      let fi=0;
      function next(){
        if(fi>=processedBitmaps.length){ setTimeout(()=>{ recorder.stop(); res(); },300); return; }
        outCtx.clearRect(0,0,W,H);
        outCtx.drawImage(processedBitmaps[fi],0,0);
        fi++;
        setTimeout(next,frameDurMs);
      }
      next();
    });
    await new Promise(res=>{ recorder.onstop=res; });

    // 5. Subir WebM procesado
    setAIStatus('Subiendo video procesado...', 90);
    const webmBlob=new Blob(chunks,{type:mimeType});
    const rutKey=(F.selected.rut||F.selected.codigo||'x').replace(/[^0-9a-zA-Z]/g,'_');
    const ts=Date.now();
    const path='athlete_gifs/'+rutKey+'_'+ts+'_nobg.webm';
    const storage=getStorage(app);
    const sRef=storageRef(storage,path);
    await uploadBytes(sRef,webmBlob,{contentType:'video/webm'});
    const url=await getDownloadURL(sRef);

    // 6. Guardar en Firestore
    setAIStatus('Guardando...', 97);
    const docRef=doc(db,'atleta_fotos',F.selected.codigo);
    const newData={gif_url:url,gif_blend:'normal',gif_storage_path:path,gif_updated:ts};
    await setDoc(docRef,newData,{merge:true});

    // 7. Actualizar cache local
    if(!ST.fotosByCodigo) ST.fotosByCodigo={};
    Object.assign(ST.fotosByCodigo[F.selected.codigo]||{}, newData);
    if(!ST.fotosByCodigo[F.selected.codigo]) ST.fotosByCodigo[F.selected.codigo]=newData;
    else Object.assign(ST.fotosByCodigo[F.selected.codigo], newData);
    F.gifBlend='normal';
    F.selected.gif_url=url;
    const la=(ST.data||[]).find(a=>a.codigo===F.selected.codigo);
    if(la){la.gif_url=url;la.gif_blend='normal';}

    setAIStatus(null);
    F.gifStatus='Fondo eliminado y guardado. Blend cambiado a Normal (alpha).';
    render();
  }catch(e){
    console.error('[quitarFondoGif]',e);
    setAIStatus(null);
    F.gifError='Error: '+e.message;
    render();
  }
};

window.guardarAjustesGif = async function(){
  const F = window._fotosState;
  if(!F.selected || !F.gifEditor) return;
  const E = F.gifEditor;
  const gifDoc = (ST.fotosByCodigo||{})[F.selected.codigo];
  if(!gifDoc?.gif_url){alert('No hay GIF cargado para este atleta.'); return;}
  try{
    const docRef = doc(db, 'atleta_fotos', F.selected.codigo);
    const data = {
      gif_zoom:     E.zoom,
      gif_offset_x: E.offsetX,
      gif_offset_y: E.offsetY,
      gif_start:    E.startTime,
      gif_end:      E.endTime,
      gif_blend:    F.gifBlend,
    };
    await setDoc(docRef, data, {merge:true});
    Object.assign(ST.fotosByCodigo[F.selected.codigo], data);
    F.gifStatus = 'Ajustes guardados';
    F.gifError  = '';
    render();
  }catch(e){
    F.gifError = 'Error guardando ajustes: '+e.message;
    render();
  }
};

window.subirGifAtleta = async function(input){
  const file = input.files && input.files[0];
  if(!file) return;
  const F = window._fotosState;
  if(!F.selected) return;
  F.gifUploading = true; F.gifStatus = 'Subiendo GIF...'; F.gifError = '';
  render();
  try{
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const rutKey = (F.selected.rut || F.selected.codigo || 'unknown').replace(/[^0-9a-zA-Z]/g,'_');
    const ts = Date.now();
    const path = 'athlete_gifs/'+rutKey+'_'+ts+'.'+ext;
    const storage = getStorage(app);
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file, {contentType: file.type || 'video/mp4'});
    const url = await getDownloadURL(sRef);
    const docRef = doc(db, 'atleta_fotos', F.selected.codigo);
    await setDoc(docRef, {
      codigo: F.selected.codigo,
      gif_url: url,
      gif_blend: F.gifBlend,
      gif_storage_path: path,
      gif_updated: ts,
    }, {merge:true});
    // Actualizar cache local
    if(!ST.fotosByCodigo) ST.fotosByCodigo = {};
    if(!ST.fotosByCodigo[F.selected.codigo]) ST.fotosByCodigo[F.selected.codigo] = {};
    ST.fotosByCodigo[F.selected.codigo].gif_url = url;
    ST.fotosByCodigo[F.selected.codigo].gif_blend = F.gifBlend;
    ST.fotosByCodigo[F.selected.codigo].gif_storage_path = path;
    F.selected.gif_url = url;
    const localAth = (ST.data||[]).find(a=>a.codigo===F.selected.codigo);
    if(localAth) { localAth.gif_url = url; localAth.gif_blend = F.gifBlend; }
    F.gifUploading = false;
    F.gifStatus = 'GIF guardado y publicado';
    render();
  }catch(e){
    console.error('[GIF] upload error:',e);
    F.gifError = 'Error: '+e.message;
    F.gifUploading = false;
    render();
  }
};

window.borrarGifAtleta = async function(){
  const F = window._fotosState;
  if(!F.selected) return;
  if(!confirm('¿Borrar el GIF de '+F.selected.nombre+'?')) return;
  F.gifUploading = true; F.gifStatus = 'Borrando...'; F.gifError = '';
  render();
  try{
    const gifDoc = (ST.fotosByCodigo||{})[F.selected.codigo];
    if(gifDoc?.gif_storage_path){
      try{
        await deleteObject(storageRef(getStorage(app), gifDoc.gif_storage_path));
      }catch(e){console.warn('[GIF] storage delete:',e);}
    }
    const docRef = doc(db, 'atleta_fotos', F.selected.codigo);
    await setDoc(docRef, {gif_url:null, gif_blend:null, gif_storage_path:null}, {merge:true});
    if(ST.fotosByCodigo?.[F.selected.codigo]){
      delete ST.fotosByCodigo[F.selected.codigo].gif_url;
      delete ST.fotosByCodigo[F.selected.codigo].gif_blend;
      delete ST.fotosByCodigo[F.selected.codigo].gif_storage_path;
    }
    delete F.selected.gif_url;
    const localAth = (ST.data||[]).find(a=>a.codigo===F.selected.codigo);
    if(localAth) { delete localAth.gif_url; delete localAth.gif_blend; }
    F.gifUploading = false;
    F.gifStatus = 'GIF eliminado';
    render();
  }catch(e){
    F.gifError = 'Error: '+e.message;
    F.gifUploading = false;
    render();
  }
};

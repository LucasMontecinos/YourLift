// admin.html — Nóminas: las tarjetas de cada campeonato y la nómina del Sudamericano.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// ══════════════════════════════════════════════════════════════════
// TARJETAS DE NÓMINAS — foto/fecha/organizador/lugar de cada campeonato que
// aparece en la pestaña Nóminas de yourlift.cl. Se guarda en Firestore
// nomina_cards/{slug-del-nombre}. La foto se convierte a WebP antes de subir.
// ══════════════════════════════════════════════════════════════════
function _ncSlug(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,'-').slice(0,80);
}

// Los campeonatos que tienen tarjeta son los MISMOS que salen en la pestaña
// Nóminas de yourlift.cl: los de la colección `eventos` que no están archivados
// ni en borrador, más el Sudamericano (que vive en nomina_sudamericano.json).
//
// Antes esta lista se armaba con nominas.json, que es un archivo estático con
// ocho eventos escritos adentro —tres campeonatos ya corridos y los cuatro
// ensayos—. O sea: los campeonatos con inscripciones abiertas o cerradas no
// aparecían nunca acá, y sí aparecían archivados. La lista tiene que salir de
// Firestore, que es de donde sale la del sitio.
//
// El id de cada tarjeta es el slug del NOMBRE, no el id del evento: así lo busca
// yourlift.cl (_nsudaSlug(ev.name)), y tiene que coincidir o la tarjeta guardada
// no se encuentra.
function _ncEventos(){
  const list=[];
  if(ST.ncSuda)list.push({id:'suda2026',name:ST.ncSuda});
  (ST.eventos||[])
    .filter(e=>e&&e.name&&e.status!=='archived'&&e.status!=='draft'&&!e.parent)
    .forEach(e=>list.push({id:_ncSlug(e.name),name:e.name,status:e.status||''}));
  const seen=new Set();
  return list.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});
}

window._ncEventos=_ncEventos;

   // admin.html es un módulo: sin esto la prueba no lo ve
window.ncLoad=async function(){
  if(ST.ncData)return;
  ST.ncData={};
  try{
    const j=await (await fetch('nomina_sudamericano.json?'+Date.now())).json();
    ST.sudaPublicada=j.publicada!==false;
    if(ST.sudaPublicada)ST.ncSuda=j.eventoCorto||'Sudamericano 2026';
  }catch(e){}
  // cargar lo guardado
  try{
    const snap=await getDocs(collection(db,'nomina_cards'));
    snap.docs.forEach(d=>{ST.ncData[d.id]=d.data();});
  }catch(e){}
  render();
};

window.ncSet=function(id,k,v){ST.ncData[id]=ST.ncData[id]||{};ST.ncData[id][k]=v;};

window.ncSave=async function(id){
  const st=document.getElementById('nc_st_'+id);ncEstado(st,'Guardando…');
  try{
    await setDoc(doc(db,'nomina_cards',id),{...(ST.ncData[id]||{}),updatedAt:Date.now()},{merge:true});
    ncEstado(st,'Guardado','ok');
    setTimeout(()=>ncEstado(st,''),2500);
  }catch(e){ncEstado(st,'Error: '+e.message,'error');}
};

window.ncFoto=async function(id,inp){
  const f=inp.files&&inp.files[0];if(!f)return;
  const st=document.getElementById('nc_st_'+id);ncEstado(st,'Convirtiendo a WebP y subiendo…');
  try{
    const storage=getStorage(app);
    const webp=await compressImg(f,1400,0.82);
    const sref=storageRef(storage,'nomina_cards/'+id+'.webp');
    await uploadBytes(sref,webp,{contentType:'image/webp'});
    const url=await getDownloadURL(sref);
    ncSet(id,'fotoUrl',url);
    await ncSave(id);
    render();
  }catch(e){ncEstado(st,'Error: '+e.message,'error');}
};

// El aviso estaba pintado de verde siempre, así que un error de permisos se leía
// como si hubiera guardado bien. Ahora el color dice qué pasó.
function ncEstado(el,txt,tipo){
  if(!el)return;
  el.textContent=txt;
  el.style.color = tipo==='error' ? 'var(--red)'
                 : tipo==='ok'    ? 'var(--green)'
                 : 'var(--muted)';
}

function renderNomCards(){
  if(!ST.ncData){ncLoad();return `<div style="padding:30px;text-align:center;color:var(--muted)">Cargando nóminas…</div>`;}
  const lista=_ncEventos();
  let h=`<div style="font-family:Oswald;font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:18px">TARJETAS DE NÓMINAS</div>`;
  h+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:18px">
    <div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:4px">CÓMO SE VE CADA CAMPEONATO EN yourlift.cl</div>
    <p style="font-size:11px;color:var(--muted);margin-bottom:14px">La foto, fecha, organizador y lugar que se ven en la tarjeta de cada campeonato en la pestaña Nóminas del sitio. Salen los campeonatos con inscripciones abiertas o cerradas — los archivados no. La foto se convierte a WebP automáticamente.</p>`;
  if(!lista.length)h+=`<p style="font-size:12px;color:var(--muted);padding:10px 0">No hay campeonatos con inscripciones abiertas o cerradas. Cuando publiques uno en Campeonatos, aparece acá.</p>`;
  lista.forEach(ev=>{
    const d=ST.ncData[ev.id]||{};
    h+=`<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">`;
    h+=`<div style="width:150px;flex-shrink:0"><div style="width:150px;height:64px;border-radius:8px;overflow:hidden;background:#0a1628;border:1px solid var(--border);display:flex;align-items:center;justify-content:center">${d.fotoUrl?`<img src="${esc(d.fotoUrl)}" style="width:100%;height:100%;object-fit:cover">`:'<span style="font-size:10px;color:var(--muted)">sin foto</span>'}</div>
      <label class="btn" style="display:block;text-align:center;margin-top:6px;padding:5px;font-size:11px;cursor:pointer"><i class=yl-i-camara></i> Subir foto<input type="file" accept="image/*" onchange="ncFoto('${ev.id}',this)" style="display:none"></label></div>`;
    h+=`<div style="flex:1;min-width:230px">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">${esc(ev.name)}${ev.status?` <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;vertical-align:1px;background:${ev.status==='open'?'rgba(34,197,94,.15)':'rgba(212,168,67,.12)'};color:${ev.status==='open'?'var(--green)':'var(--gold)'};border:1px solid ${ev.status==='open'?'rgba(34,197,94,.3)':'rgba(212,168,67,.3)'}">${ev.status==='open'?'Inscripciones abiertas':'Inscripciones cerradas'}</span>`:''}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
        <input placeholder="Fecha (ej. 20-27 sep 2026)" value="${esc(d.fecha||'')}" oninput="ncSet('${ev.id}','fecha',this.value)" style="padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px">
        <input placeholder="Organizador" value="${esc(d.organizador||'')}" oninput="ncSet('${ev.id}','organizador',this.value)" style="padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px">
        <input placeholder="Lugar" value="${esc(d.lugar||'')}" oninput="ncSet('${ev.id}','lugar',this.value)" style="padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px">
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px">
        <button class="btn" onclick="ncSave('${ev.id}')" style="padding:6px 16px;font-size:12px">Guardar</button>
        <span id="nc_st_${ev.id}" style="font-size:11px;color:var(--muted)"></span>
      </div>
    </div></div>`;
  });
  h+=`</div>`;
  return h;
}

function renderNominas(){
  // Events from Firebase inscriptions only (Firestore is the source of truth)
  const fbEvents=[...new Set(ST.inscripciones.map(i=>i.evento))].filter(Boolean);
  const allEvents=[...new Set([...fbEvents])];
  if(!ST.filterEv&&allEvents.length)ST.filterEv=allEvents[0];
  // La nómina del Sudamericano llega de FESUPO en un archivo, no por inscripciones:
  // tiene su propia tabla (mismo selector de evento).
  if(ST.filterEv===NS_EV) return renderNomSuda(allEvents);

  const inFirebase=fbEvents.includes(ST.filterEv);
  const hasEventoDoc=ST.eventos.some(e=>e.id===ST.filterEv||e.name===ST.filterEv);
  const needsMetaSync=inFirebase && !hasEventoDoc;

  let filtered;
  if(inFirebase){
    filtered=ST.inscripciones.filter(i=>i.evento===ST.filterEv&&i.status!=='rejected');
    filtered.sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));
  }else{
    filtered=[];
  }
  // Mostrar columna "Nacional 2026" (modalidad/lugar + marcas SQ/BP/DL) solo si el evento la pide.
  const _posNacCol = !!(ST.eventos||[]).find(e=>e.id===ST.filterEv)?.posNac2026;
  // Clasificación Sudamericano: 1° = clasificado, 2°/3° = lista de espera
  const _clasifSud = i => { const p=parseInt(i.posNacLugar)||0; return p===1?'clasificado':p===2||p===3?'espera':p>0?'sin':'sin'; };
  if(_posNacCol && ST.filterClasif) filtered=filtered.filter(i=>_clasifSud(i)===ST.filterClasif);
  // Columna "Universidad": si el evento la configuró (extraCols) o si algún inscrito trae universidad (modalidad Universitario).
  const _uniEvObj = (ST.eventos||[]).find(e=>e.id===ST.filterEv||e.name===ST.filterEv);
  const _esUni = x => /universitar/i.test(String((x&&x.division)||'')+' '+String((x&&x.modalidad)||''));
  // Universidad por RUT/nombre desde CUALQUIER inscripción que la tenga (ej. nómina del Nacional Universitario),
  // para rellenar automáticamente a los del Sudamericano (división Universitario) que no la traen.
  const _uNN=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
  const _uNR=s=>String(s||'').replace(/[^0-9kK]/g,'').toLowerCase();
  const _uByRut={}, _uByName={};
  (ST.inscripciones||[]).forEach(x=>{ if(!x.universidad)return; if(x.rut)_uByRut[_uNR(x.rut)]=x.universidad; if(x.nombre)_uByName[_uNN(x.nombre)]=x.universidad; });
  const _resolveUni=i=> i.universidad || _uByRut[_uNR(i.rut)] || _uByName[_uNN(i.nombre)] || '';
  const _uniCol = (_uniEvObj?.extraCols||[]).includes('universidad') || filtered.some(i=>_resolveUni(i)) || filtered.some(_esUni);

  return `
    <div class="h1">Nóminas</div>
    <p class="subtitle">Edita inscripciones · ${filtered.length} atletas en evento seleccionado</p>
    <div class="search-box">
      <select class="inp" onchange="ST.filterEv=this.value;ST.filterClasif='';render()">
        ${allEvents.map(e=>`<option value="${e}" ${ST.filterEv===e?'selected':''}>${e}</option>`).join('')}
        ${ST.sudaPublicada?`<option value="${NS_EV}">Sudamericano 2026 — nómina FESUPO</option>`:''}
      </select>
      ${_posNacCol?`<select class="inp" style="max-width:190px" onchange="ST.filterClasif=this.value;render()">
        <option value="">Todos</option>
        <option value="clasificado" ${ST.filterClasif==='clasificado'?'selected':''}>Clasificados</option>
        <option value="espera" ${ST.filterClasif==='espera'?'selected':''}>Lista de espera</option>
        <option value="sin" ${ST.filterClasif==='sin'?'selected':''}>— Sin clasificar</option>
      </select>`:''}
      ${inFirebase?`<button class="btn btn-b" onclick="sortNominaByEvent('${ST.filterEv}')">⇅ ORDENAR</button>`:''}
      <button class="btn btn-g" onclick="openInscribirModal()" style="padding:8px 16px;font-size:12px">Inscribir atleta</button>
      <button id="btnExportNomina" class="btn btn-b" onclick="exportNominaExcel()" style="padding:8px 16px;font-size:12px">Exportar Excel</button>
      <button id="btnExportDocs" class="btn btn-b" onclick="exportNominaDocsZip()" style="padding:8px 16px;font-size:12px" title="ZIP con una carpeta por atleta (con su nombre) y adentro sus documentos subidos">Descargar Docs (ZIP)</button>
      <button id="btnExportFotos" class="btn btn-b" onclick="exportNominaFotosZip()" style="padding:8px 16px;font-size:12px" title="ZIP con las fotos de perfil de todos los atletas inscritos, convertidas a JPG (formato que piden IPF/goodlift)">Descargar Fotos (ZIP · JPG)</button>
      <button id="btnExportPaquete" class="btn btn-b" onclick="exportPaqueteInternacionalZip()" style="padding:8px 16px;font-size:12px;background:rgba(212,168,67,.12);border-color:#D4A843;color:#D4A843" title="ZIP con una carpeta por atleta: foto fondo blanco (JPEG, garantizada) + Consentimiento IPF (PDF) + WADA (PDF). Para envíos a la federación internacional (ej. Sudamericano). Al final avisa qué atletas están incompletos.">Paquete Internacional (ZIP)</button>
    </div>
    ${needsMetaSync?'<div class="card" style="background:rgba(212,168,67,.08);border-color:rgba(212,168,67,.3);padding:12px 16px;margin-bottom:12px"><span style="color:var(--gold);font-size:12px">Las inscripciones están en Firebase pero falta el doc de evento en <code>eventos/</code>. Sin eso no puedes editar fecha/cierre/ubicación desde <b>Campeonatos</b>. Crea el evento desde el panel de Campeonatos.</span></div>':''}
    <div class="card" style="padding:0;overflow-x:auto">
      ${_cupoSelectorHtml()}
      <table class="tbl">
        <tr><th>#</th><th>Nombre</th><th>Sexo</th><th>División</th><th>Cat.</th><th>Modalidad</th><th>Club</th><th title="Comuna / Región">Zona</th><th title="Correo que dejó el atleta al inscribirse. Solo lo ve el panel: no está en la lista pública.">Correo</th>${_uniCol?'<th title="Universidad del atleta (modalidad Universitario)">Universidad</th>':''}${_posNacCol?'<th title="Posición y marcas del Nacional 2026">Nacional 2026</th>':''}${_posNacCol?'<th title="Clasificación Sudamericano">Clasif. Sud.</th>':''}<th title="Si ya compitió este año, según los resultados cargados en YourLift">Compitió</th><th title="Documentos subidos">Docs</th><th>Estado</th><th></th></tr>
        ${filtered.map((i,idx)=>{
          const editable=!i._json;
          const click=(f)=>editable?`onclick="editInsc('${i.id}','${f}')"`:'';
          const cls=editable?'editable':'';
          const sid=encodeURIComponent(i.id||'');
          // Datos privados (carnet + WADA): solo si la inscripción es de Firebase
          const priv = editable ? (ST.inscripcionesPrivate?.[i.id]||{}) : {};
          // Detectar si tiene perfil en data.json o en atletas_pending
          const rutNormRow=s=>String(s||'').replace(/[^0-9kK]/g,'').toUpperCase();
          const tienePerfilRow=!!(ST.data||[]).find(a=>rutNormRow(a.rut)===rutNormRow(i.rut));
          const sinPerfilBtn=editable&&!tienePerfilRow?`<button onclick="crearPerfilDebutante('${sid}')" style="background:transparent;border:1px solid rgba(212,168,67,.5);color:var(--gold);padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:Oswald;white-space:nowrap" title="Crear perfil de debutante"><i class=yl-i-estrella></i> Perfil</button>`:'';
          // Contar docs subidos (mapa nuevo `docs` + URLs legacy)
          const docKeys = ['carnetURL','wadeURL','carnetPhotoURL','consentimientoURL','passportURL','ipfConsentURL','notasURL'];
          let docCount = 0;
          docKeys.forEach(k=>{if(priv[k])docCount++});
          if(priv.docs && typeof priv.docs==='object'){
            // Contar los del map que no estén ya contados via legacy
            const docsMapCount = Object.keys(priv.docs).length;
            docCount = Math.max(docCount, docsMapCount);
          }
          const docsCell = docCount>0
            ? `<button onclick="viewInsDocs('${sid}')" title="Ver todos los documentos subidos" style="display:inline-block;padding:4px 10px;background:rgba(34,197,94,.12);border:1px solid var(--green);color:var(--green);border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;font-family:Oswald">Ver (${docCount})</button>`
            : (editable
              ? `<button onclick="viewInsDocs('${sid}')" title="Agregar documentos" style="display:inline-block;padding:4px 10px;background:transparent;border:1px dashed var(--border);color:var(--muted);border-radius:5px;cursor:pointer;font-family:Oswald;font-size:11px">+ Agregar</button>`
              : `<span style="color:var(--muted);font-size:11px;opacity:.5">—</span>`);
          return `<tr>
            <td style="color:var(--muted);font-family:Oswald">${idx+1}</td>
            <td>${esc(i.nombre)}<br><span style="font-size:9px;color:var(--muted)">${esc(i.rut||'')}</span></td>
            <td><span class="${cls}" ${click('sexo')}>${esc(i.sexo||'?')}</span></td>
            <td><span class="${cls}" ${click('division')}>${esc(i.division||'—')}</span></td>
            <td><span class="${cls}" ${click('categoria')}>${esc(i.categoria||'—')}</span></td>
            <td><span class="${cls}" ${click('modalidad')}>${esc(i.modalidad||'—')}</span></td>
            ${(()=>{
              // Si el atleta eligió "Otro" en el formulario, el nombre real del
              // club quedó en clubOtro (p.ej. "Wolf Strength"). Mostrar ese y
              // editar ese campo, no la etiqueta "Otro".
              const isOtro=i.club==='Otro';
              const eclub=isOtro?(i.clubOtro||'Otro'):(i.club||'');
              const fld=isOtro?'clubOtro':'club';
              return `<td><span class="${cls}" ${click(fld)} style="display:inline-flex;align-items:center;gap:5px">${window.clubLogoImg?window.clubLogoImg(eclub,18,'background:var(--bg);padding:1px;'):''}${esc(eclub||'—')}</span></td>`;
            })()}
            <td style="font-size:11px;color:var(--muted);max-width:160px"><span class="${cls}" ${click('comuna')} title="${esc(i.comuna||'')}">${esc(i.comuna||'—')}</span></td>
            ${/* El correo vive en inscripciones_private, que solo lee un admin:
                  la colección pública no lo tiene, justamente para que no quede
                  a la vista de cualquiera. Se muestra acá y se puede copiar de
                  un click, que es para lo que se necesita. */''}
            <td style="font-size:11px;max-width:190px">${priv.correo
              ? `<span onclick="copiarCorreo('${esc(priv.correo)}')" title="Click para copiar — ${esc(priv.correo)}" style="cursor:pointer;color:var(--blue);border-bottom:1px dashed rgba(96,165,250,.5);display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom">${esc(priv.correo)}</span>`
              : '<span style="color:var(--muted)">—</span>'}</td>
            ${_uniCol?('<td style="font-size:11px"><span class="'+cls+'" '+click('universidad')+'>'+esc(_resolveUni(i)||'—')+'</span></td>'):''}
            ${_posNacCol?('<td style="font-size:11px;white-space:nowrap">'
              +(i.posNacLugar?('<b style="color:var(--gold)">'+esc(i.posNacMod||'')+' '+esc(i.posNacLugar)+'°</b>'):'<span style="color:var(--muted);opacity:.5">—</span>')
              +((i.posNacSQ||i.posNacBP||i.posNacDL)?('<br><span style="color:var(--muted)">SQ '+esc(i.posNacSQ||'-')+' · BP '+esc(i.posNacBP||'-')+' · DL '+esc(i.posNacDL||'-')+' · <b style="color:var(--text)">T '+esc(i.posNacTotal||(((parseFloat(i.posNacSQ)||0)+(parseFloat(i.posNacBP)||0)+(parseFloat(i.posNacDL)||0))||'-'))+'</b></span>'):'')
              +'</td>'):''}
            ${_posNacCol?(()=>{const cl=_clasifSud(i);return cl==='clasificado'?'<td style="white-space:nowrap"><span style="color:var(--green);font-weight:700;font-size:11px"><i class=yl-i-check></i> CLASIFICADO</span></td>':cl==='espera'?'<td style="white-space:nowrap"><span style="color:var(--orange);font-size:11px;font-weight:600"><i class=yl-i-espera></i> Lista espera</span></td>':'<td><span style="color:var(--muted);font-size:11px;opacity:.4">—</span></td>';})():''}
            <td style="text-align:center">${_marcaCompitio(_hCargando()?[]:_histDe(i.rut,i.nombre),'nom_'+i.id,_hCargando(),(ST.apprHist||{})['nom_'+i.id])}</td>
            <td style="text-align:center">${docsCell}</td>
            <td><span class="badge ${i.status==='approved'?'b-g':i.status==='pending'?'b-y':'b-r'}">${esc(i.status||'approved')}</span></td>
            <td style="white-space:nowrap">${sinPerfilBtn}${editable?`<button onclick="deleteInsc('${sid}')" style="background:transparent;border:1px solid rgba(239,68,68,.3);color:var(--red);padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:Oswald;margin-left:4px" title="Eliminar"><i class=yl-i-cerrar></i></button>`:''}</td>
          </tr>${(()=>{
            const _h=_hCargando()?[]:_histDe(i.rut,i.nombre);
            if(!_h.length||!(ST.apprHist||{})['nom_'+i.id])return '';
            return `<tr><td colspan="20" style="background:rgba(10,22,40,.55);padding:10px 14px">${_detalleHist(_h,_histAnio().anio)}</td></tr>`;
          })()}`;
        }).join('')}
      </table>
      ${filtered.length===0?'<div class="empty">Sin atletas en este evento</div>':''}
    </div>`;
}

function nsKey(a){ return _sfSlug(a.n)+'~'+_sfSlug(a._lista0||a.lista); }

async function nsLoad(){
  if(ST.nsLoading)return; ST.nsLoading=true;
  try{
    if(!ST.sudaNom) ST.sudaNom=await (await fetch('nomina_sudamericano.json?'+Date.now())).json();
    if(!ST.nsEdits){
      try{ const s=await getDoc(doc(db,'nomina_suda_edits','main')); ST.nsEdits=(s.exists()&&s.data().items)||{}; }
      catch(e){ ST.nsEdits={}; }
    }
    ST.nsDirty=false;
  }catch(e){ ST.nsErr=e.message; }
  ST.nsLoading=false; render();
}

// Valor vigente de un campo (corrección si la hay, si no lo del archivo)
function nsVal(a,f){ const e=(ST.nsEdits||{})[nsKey(a)]; return (e&&e[f]!==undefined&&e[f]!=='')?e[f]:(a[f]||''); }

function nsDel(a){ const e=(ST.nsEdits||{})[nsKey(a)]; return !!(e&&e.del); }

function nsHasEdit(a){ const e=(ST.nsEdits||{})[nsKey(a)]; return !!(e&&Object.keys(e).length); }

window.nsSet=function(k,f,v){
  const ed=ST.nsEdits||(ST.nsEdits={});
  const a=(ST.sudaNom.atletas||[]).find(x=>nsKey(x)===k); if(!a)return;
  const e=ed[k]||(ed[k]={});
  if(String(v).trim()===String(a[f]||'').trim()) delete e[f];        // volvió al original
  else e[f]=String(v).trim();
  if(!Object.keys(e).length) delete ed[k];
  ST.nsDirty=true; render();
};

window.nsToggleDel=function(k){
  const ed=ST.nsEdits||(ST.nsEdits={});
  const e=ed[k]||(ed[k]={});
  if(e.del) delete e.del; else e.del=true;
  if(!Object.keys(e).length) delete ed[k];
  ST.nsDirty=true; render();
};

window.nsReset=function(k){ if(ST.nsEdits) delete ST.nsEdits[k]; ST.nsDirty=true; render(); };

window.nsResetAll=function(){
  const n=Object.keys(ST.nsEdits||{}).length;
  if(!n){showToast('No hay correcciones para deshacer');return;}
  if(!confirm('¿Descartar las '+n+' corrección(es) y dejar la nómina tal cual la mandó FESUPO?\n\nSe guarda al tocar Guardar.'))return;
  ST.nsEdits={}; ST.nsDirty=true; render();
};

window.nsSave=async function(){
  ST.nsBusy=true; render();
  try{
    await setDoc(doc(db,'nomina_suda_edits','main'),{items:ST.nsEdits||{},ts:Date.now(),by:(ST.adminInfo?.email||'')},{merge:false});
    ST.nsDirty=false;
    showToast('Nómina actualizada — se ve en yourlift.cl en unos minutos');
  }catch(e){ showToast('No se pudo guardar: '+e.message,null,true); }
  ST.nsBusy=false; render();
};

window.nsFilter=function(f,v){
  ST.nsF=Object.assign({},ST.nsF||{},{[f]:v});
  // La tabla son 633 filas con selects: redibujar en cada tecla se siente
  // pesado, así que el buscador espera a que dejes de escribir. Después del
  // render hay que devolverle el foco al input, que se rehizo.
  if(f==='q'){
    if(_nsQT)clearTimeout(_nsQT);
    _nsQT=setTimeout(()=>{ render();
      const i=document.getElementById('nsQ'); if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}
    },280);
    return;
  }
  render();
};

window.nsVerTodas=function(){ ST.nsAll=true; render(); };

// Selector de evento (el mismo de Nóminas) para poder volver a las otras nóminas
function nsEvSelect(allEvents){
  return `<select class="inp" onchange="ST.filterEv=this.value;ST.filterClasif='';render()">
    ${(allEvents||[]).map(e=>`<option value="${esc(e)}">${esc(e)}</option>`).join('')}
    <option value="${NS_EV}" selected>Sudamericano 2026 — nómina FESUPO</option>
  </select>`;
}

function renderNomSuda(allEvents){
  if(!ST.sudaNom||!ST.nsEdits){ nsLoad(); return `<div class="h1">Nóminas</div>
    <div class="search-box">${nsEvSelect(allEvents)}</div>
    <div style="padding:30px;text-align:center;color:var(--muted)">Cargando la nómina del Sudamericano…${ST.nsErr?'<br><span style="color:var(--red)">'+esc(ST.nsErr)+'</span>':''}</div>`; }
  const all=ST.sudaNom.atletas||[];
  const F=ST.nsF||{};
  const uniq=f=>[...new Set(all.map(a=>String(a[f]||'')).filter(Boolean))].sort();
  const listas=uniq('lista'), divs=uniq('div'), mods=uniq('mod'), cats=uniq('cat');
  const nrm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  let rows=all;
  if(F.lista) rows=rows.filter(a=>nsVal(a,'lista')===F.lista);
  if(F.q){ const q=nrm(F.q); rows=rows.filter(a=>nrm(a.n).includes(q)||nrm(a.pais).includes(q)); }
  if(F.solo==='edit') rows=rows.filter(nsHasEdit);
  if(F.solo==='baja') rows=rows.filter(nsDel);
  const nEd=Object.keys(ST.nsEdits||{}).length;
  const nBaja=all.filter(nsDel).length;
  const vivos=all.length-nBaja;
  const personas=new Set(all.filter(a=>!nsDel(a)).map(a=>nrm(a.n)+'|'+a.sexo)).size;

  const sel=(a,f,opts)=>{
    const k=nsKey(a), v=nsVal(a,f), ch=v!==String(a[f]||'');
    const list=opts.includes(v)?opts:[v,...opts];
    return `<select onchange="nsSet('${k}','${f}',this.value)" style="max-width:170px;padding:4px 6px;border-radius:6px;border:1px solid ${ch?'var(--gold)':'var(--border)'};background:${ch?'rgba(212,168,67,.10)':'#0a1628'};color:${ch?'var(--gold)':'var(--text)'};font-size:11px">
      ${list.map(o=>`<option value="${esc(o)}"${o===v?' selected':''}>${esc(o)}</option>`).join('')}</select>`;
  };

  let h=`<div class="h1">Nóminas</div>
  <p class="subtitle">Nómina oficial del Sudamericano (FESUPO) · ${vivos} inscripciones · ${personas} atletas</p>
  <div class="card" style="padding:14px 16px;margin-bottom:14px;background:rgba(212,168,67,.06);border-color:rgba(212,168,67,.28)">
    <div style="font-size:12px;color:var(--muted);line-height:1.55">Esta nómina no son inscripciones de YourLift: la manda FESUPO. Acá corregís <b style="color:var(--gold)">categoría, división, modalidad y lista</b>, o das de baja a alguien, sin tocar el archivo original. Los cambios se publican en yourlift.cl al tocar <b>Guardar</b>. Siempre puedes volver un dato a como venía.</div>
  </div>`;

  h+=`<div class="search-box">
    ${nsEvSelect(allEvents)}
    <select class="inp" onchange="nsFilter('lista',this.value)">
      <option value="">Todas las listas (${all.length})</option>
      ${listas.map(l=>`<option value="${esc(l)}"${F.lista===l?' selected':''}>${esc(l)} (${all.filter(a=>nsVal(a,'lista')===l).length})</option>`).join('')}
    </select>
    <select class="inp" style="max-width:190px" onchange="nsFilter('solo',this.value)">
      <option value="">Todos</option>
      <option value="edit"${F.solo==='edit'?' selected':''}>Solo corregidos (${nEd})</option>
      <option value="baja"${F.solo==='baja'?' selected':''}>Solo dados de baja (${nBaja})</option>
    </select>
    <input id="nsQ" class="inp" placeholder="Buscar por nombre o país…" value="${esc(F.q||'')}" oninput="nsFilter('q',this.value)" style="max-width:260px">
    <button class="btn ${ST.nsDirty?'btn-g':'btn-b'}" onclick="nsSave()" ${ST.nsBusy||!ST.nsDirty?'disabled':''} style="padding:8px 18px;font-size:12px;${ST.nsBusy||!ST.nsDirty?'opacity:.5':''}">${ST.nsBusy?'Guardando…':'Guardar cambios'}</button>
    ${nEd?`<button class="btn btn-r" onclick="nsResetAll()" style="padding:8px 14px;font-size:12px">Descartar todo</button>`:''}
  </div>`;

  if(ST.nsDirty)h+=`<div class="card" style="padding:10px 14px;margin-bottom:12px;background:rgba(212,168,67,.10);border-color:var(--gold)"><span style="color:var(--gold);font-size:12px">Hay cambios sin guardar. Toca <b>Guardar cambios</b> para que se vean en el sitio.</span></div>`;

  // Tope de filas: 633 filas con selects tardan en dibujarse. Con filtro o
  // búsqueda casi nunca se llega al tope; si igual lo quieres todo, está el botón.
  const TOPE=200, recortado=!ST.nsAll&&rows.length>TOPE;
  if(recortado){
    h+=`<div class="card" style="padding:10px 14px;margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--muted)">Mostrando ${TOPE} de ${rows.length}. Filtra por lista o busca el nombre para llegar más rápido.</span>
      <button class="btn btn-b" onclick="nsVerTodas()" style="padding:6px 14px;font-size:11px">Ver las ${rows.length}</button></div>`;
    rows=rows.slice(0,TOPE);
  }
  h+=`<div class="card" style="padding:0;overflow-x:auto"><table class="tbl">
    <tr><th>#</th><th>Atleta</th><th>País</th><th>Cat.</th><th>División</th><th>Modalidad</th><th>Lista</th><th title="Marcas nominadas">SQ / BP / DL</th><th></th></tr>`;
  rows.forEach((a,idx)=>{
    const k=nsKey(a), baja=nsDel(a), ed=nsHasEdit(a);
    h+=`<tr style="${baja?'opacity:.42':''}">
      <td style="color:var(--muted);font-family:Oswald">${idx+1}</td>
      <td style="min-width:190px">${esc(a.n)}${baja?' <span style="color:var(--red);font-size:10px;font-family:Oswald">DE BAJA</span>':''}
        <br><span style="font-size:9px;color:var(--muted)">${a.born||''}${a.cod?' · '+esc(a.cod):''}</span></td>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap">${esc(a.pais||'')}</td>
      <td><input value="${esc(nsVal(a,'cat'))}" onchange="nsSet('${k}','cat',this.value)" list="nsCats" style="width:72px;padding:4px 6px;border-radius:6px;border:1px solid ${nsVal(a,'cat')!==(a.cat||'')?'var(--gold)':'var(--border)'};background:${nsVal(a,'cat')!==(a.cat||'')?'rgba(212,168,67,.10)':'#0a1628'};color:${nsVal(a,'cat')!==(a.cat||'')?'var(--gold)':'var(--text)'};font-size:11px"></td>
      <td>${sel(a,'div',divs)}</td>
      <td>${sel(a,'mod',mods)}</td>
      <td>${sel(a,'lista',listas)}</td>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap">${a.sq||'-'} / ${a.bp||'-'} / ${a.dl||'-'}</td>
      <td style="white-space:nowrap">
        ${ed?`<button onclick="nsReset('${k}')" title="Volver a como lo mandó FESUPO" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:Oswald">↺</button> `:''}
        <button onclick="nsToggleDel('${k}')" title="${baja?'Volver a la nómina':'Sacar de la nómina'}" style="background:transparent;border:1px solid ${baja?'var(--green)':'rgba(239,68,68,.35)'};color:${baja?'var(--green)':'var(--red)'};padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:Oswald">${baja?'Reponer':'<i class=yl-i-cerrar></i>'}</button>
      </td></tr>`;
  });
  h+=`</table>${rows.length?'':'<div class="empty">Sin resultados con esos filtros</div>'}</div>
  <datalist id="nsCats">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`;
  return h;
}

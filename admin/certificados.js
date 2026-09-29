// admin.html — Certificados YourLift (solo owner).
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

function _certNuevoForm(){
  return {nombre:'',rut:'',correo:'',rol:'juez',comp:CERT_ROLES.juez.comp.slice(),
    curso:'Capacitación de Jueces '+new Date().getFullYear(),fecha:_certHoy(),
    lugar:'Santiago',firma:ST.adminInfo?.name||ST.adminInfo?.nombre||''};
}

async function certCargar(){
  ST._certLoaded='loading';
  try{ const s=await getDoc(doc(db,...CERT_DOC)); ST.certs=(s.exists()&&Array.isArray(s.data().items))?s.data().items:[]; ST._certErr=null; }
  catch(e){ ST.certs=[]; ST._certErr=e; }
  ST._certLoaded=true; if(ST.view==='certificados')render();
}

async function certGuardarLista(){
  await setDoc(doc(db,...CERT_DOC),{items:ST.certs,actualizado:Date.now(),por:ST.user?.email||''});
}

// Lo que está escrito en el formulario (se lee de los campos para no perder lo
// tecleado al redibujar).
function _certLeerForm(){
  const f=ST.certForm||(ST.certForm=_certNuevoForm());
  const v=id=>{const el=document.getElementById(id);return el?el.value.trim():null;};
  [['nombre','cf_nombre'],['rut','cf_rut'],['correo','cf_correo'],['curso','cf_curso'],['fecha','cf_fecha'],['lugar','cf_lugar'],['firma','cf_firma']]
    .forEach(([k,id])=>{const x=v(id);if(x!==null)f[k]=x;});
  const comp=CERT_COMP.map(c=>c[0]).filter(k=>{const el=document.getElementById('cf_c_'+k);return el?el.checked:f.comp.includes(k);});
  f.comp=comp;
  return f;
}

window.certRol=function(r){const f=_certLeerForm();f.rol=r;f.comp=(CERT_ROLES[r]||CERT_ROLES.juez).comp.slice();render();};

window.certDesdeJuez=function(id){
  const f=_certLeerForm(); const r=(ST.referees||[]).find(x=>x.id===id); if(!r)return;
  f.nombre=r.nombre||''; f.rut=r.rut||''; f.correo=r.correo||r.email||''; f.rol='juez'; f.comp=CERT_ROLES.juez.comp.slice(); render();
};

window.certLimpiar=function(){ST.certForm=_certNuevoForm();render();};

// ── El PDF ──
function _certCargarJsPDF(){
  if(window.jspdf&&window.jspdf.jsPDF)return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((ok,mal)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload=()=>ok(window.jspdf.jsPDF); s.onerror=()=>mal(new Error('No se pudo cargar el generador de PDF'));
    document.head.appendChild(s);
  });
}

function _certImagen(src){
  return new Promise(ok=>{
    const im=new Image(); im.onload=()=>{try{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);ok({url:c.toDataURL('image/png'),w:im.naturalWidth,h:im.naturalHeight});}catch(e){ok(null);}};
    im.onerror=()=>ok(null); im.src=src;
  });
}

async function certPDF(c){
  const jsPDF=await _certCargarJsPDF();
  const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  // jsPDF no descuenta el espaciado entre letras al centrar: se centra a mano.
  const centro=(t,y,cs)=>{const w=pdf.getTextWidth(t)+cs*(t.length-1);pdf.text(t,(W-w)/2,y,{charSpace:cs});};
  const W=297,H=210, NAVY=[10,22,40], ROJO=[196,30,58], AZUL=[0,82,164], ORO=[176,138,46], TXT=[30,36,48], GRIS=[110,118,130];
  // Marco
  pdf.setDrawColor(...NAVY); pdf.setLineWidth(1.2); pdf.rect(8,8,W-16,H-16);
  pdf.setDrawColor(...ORO); pdf.setLineWidth(0.4); pdf.rect(11,11,W-22,H-22);
  // Franja superior oscura con el logo (el logo tiene letras blancas)
  pdf.setFillColor(...NAVY); pdf.rect(11,11,W-22,34,'F');
  pdf.setFillColor(...ROJO); pdf.rect(11,45,(W-22)/2,1.6,'F');
  pdf.setFillColor(...AZUL); pdf.rect(11+(W-22)/2,45,(W-22)/2,1.6,'F');
  const logo=await _certImagen('yourlift_logo_hd.png');
  if(logo){const lh=24,lw=lh*logo.w/logo.h;pdf.addImage(logo.url,'PNG',(W-lw)/2,16,lw,lh);}
  else{pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(26);pdf.text('YOURLIFT',W/2,32,{align:'center'});}
  // Título
  pdf.setTextColor(...NAVY); pdf.setFont('helvetica','bold'); pdf.setFontSize(24);
  centro('CERTIFICADO DE ACREDITACIÓN',62,1);
  pdf.setFont('helvetica','normal'); pdf.setFontSize(11); pdf.setTextColor(...GRIS);
  centro('USO DE LA PLATAFORMA YOURLIFT',69,1.5);
  // Persona
  pdf.setTextColor(...TXT); pdf.setFontSize(13);
  pdf.text('YourLift certifica que',W/2,82,{align:'center'});
  pdf.setFont('helvetica','bold'); pdf.setFontSize(26); pdf.setTextColor(...NAVY);
  pdf.text(String(c.nombre||'').toUpperCase(),W/2,95,{align:'center'});
  pdf.setDrawColor(...ORO); pdf.setLineWidth(0.5); pdf.line(W/2-80,99,W/2+80,99);
  let y=105;
  if(c.rut){pdf.setFont('helvetica','normal');pdf.setFontSize(11);pdf.setTextColor(...GRIS);pdf.text('RUT '+c.rut,W/2,y,{align:'center'});y+=7;} else y+=3;
  pdf.setFont('helvetica','normal'); pdf.setFontSize(13); pdf.setTextColor(...TXT);
  const rol=(CERT_ROLES[c.rol]||{}).t||c.rol||'';
  pdf.text('aprobó la acreditación en el uso de la plataforma YourLift como',W/2,y+2,{align:'center'});
  pdf.setFont('helvetica','bold'); pdf.setFontSize(16); pdf.setTextColor(...ROJO);
  centro(rol.toUpperCase(),y+11,0.6);
  y+=19;
  // Lo que sabe usar
  const comps=CERT_COMP.filter(k=>(c.comp||[]).includes(k[0])).map(k=>k[1]);
  if(comps.length){
    pdf.setFont('helvetica','normal'); pdf.setFontSize(10.5); pdf.setTextColor(...TXT);
    pdf.text('Acreditación para operar: '+comps.join(' · '),W/2,y,{align:'center',maxWidth:W-60});
    y+=comps.join(' · ').length>110?12:7;
  }
  if(c.curso){pdf.setFontSize(10.5);pdf.setTextColor(...GRIS);pdf.text('Instancia de acreditación: '+c.curso,W/2,y,{align:'center'});}
  // Pie: lugar y fecha, firma, código
  const yb=172;
  pdf.setFont('helvetica','normal'); pdf.setFontSize(10.5); pdf.setTextColor(...TXT);
  pdf.text((c.lugar?c.lugar+', ':'')+_certFechaLarga(c.fecha),40,yb,{align:'left'});
  pdf.setDrawColor(...NAVY); pdf.setLineWidth(0.4); pdf.line(W-110,yb-2,W-40,yb-2);
  pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(...NAVY);
  pdf.text(c.firma||'YourLift',W-75,yb+4,{align:'center'});
  pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(...GRIS);
  pdf.text('YourLift · yourlift.cl',W-75,yb+9,{align:'center'});
  pdf.setFontSize(8.5); pdf.text('Código de certificado: '+c.codigo,W/2,H-15,{align:'center'});
  return pdf;
}

function _certMensaje(c){
  const rol=(CERT_ROLES[c.rol]||{}).t||c.rol||'';
  return 'Hola '+String(c.nombre||'').split(' ')[0]+',\n\nTe adjuntamos tu certificado de acreditación en el uso de la plataforma YourLift como '+rol+' (código '+c.codigo+').\n\nSaludos,\n'+(c.firma||'YourLift');
}

function _certSiguienteCodigo(fecha){
  const y=String(fecha||_certHoy()).slice(0,4);
  const n=(ST.certs||[]).filter(x=>String(x.codigo||'').startsWith('YL-'+y+'-')).map(x=>parseInt(String(x.codigo).split('-')[2],10)||0);
  return 'YL-'+y+'-'+String((n.length?Math.max(...n):0)+1).padStart(3,'0');
}

window.certEmitir=async function(){
  if(!_esOwnerAdm()){showToast('Solo el Owner puede emitir certificados',null,true);return;}
  const f=_certLeerForm();
  if(!f.nombre||f.nombre.length<3){showToast('Escribe el nombre completo',null,true);return;}
  if(!f.comp.length){showToast('Marca al menos una cosa que sabe usar',null,true);return;}
  const c=Object.assign({},f,{codigo:_certSiguienteCodigo(f.fecha),creado:Date.now(),por:ST.user?.email||''});
  try{
    const pdf=await certPDF(c);
    ST.certs=(ST.certs||[]).concat([c]);
    await certGuardarLista();
    pdf.save(_certArchivo(c));
    try{ await logAction('cert_plataforma',c.codigo+' · '+c.nombre,null,'emitido',{rol:c.rol}); }catch(_){}
    ST.certForm=_certNuevoForm(); render();
    showToast('Certificado '+c.codigo+' emitido y descargado');
  }catch(e){ console.warn('[cert]',e); showToast('No se pudo emitir: '+(e.message||e),null,true); }
};

window.certDescargar=async function(i){
  const c=(ST.certs||[])[i]; if(!c)return;
  try{ (await certPDF(c)).save(_certArchivo(c)); }catch(e){ showToast('No se pudo generar el PDF: '+e.message,null,true); }
};

// Enviar: con el menú de compartir del equipo si deja adjuntar archivos (teléfono,
// Windows, Mac); si no, se descarga el PDF y se abre el correo ya escrito para
// adjuntarlo.
window.certEnviar=async function(i){
  const c=(ST.certs||[])[i]; if(!c)return;
  try{
    const pdf=await certPDF(c);
    const file=new File([pdf.output('blob')],_certArchivo(c),{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file],title:'Certificado YourLift',text:_certMensaje(c)}); return; }
      catch(e){ if(e&&e.name==='AbortError')return; }
    }
    pdf.save(_certArchivo(c));
    const url='mailto:'+encodeURIComponent(c.correo||'')+'?subject='+encodeURIComponent('Certificado de acreditación YourLift — '+c.codigo)+'&body='+encodeURIComponent(_certMensaje(c));
    window.location.href=url;
    showToast('PDF descargado: adjúntalo al correo que se abrió');
  }catch(e){ showToast('No se pudo enviar: '+e.message,null,true); }
};

window.certBorrar=async function(i){
  const c=(ST.certs||[])[i]; if(!c)return;
  if(!confirm('¿Anular el certificado '+c.codigo+' de '+c.nombre+'? Deja de figurar en la lista de acreditados.'))return;
  const antes=ST.certs.slice(); ST.certs.splice(i,1);
  try{ await certGuardarLista(); render(); try{ await logAction('cert_plataforma',c.codigo+' · '+c.nombre,'emitido','anulado',{}); }catch(_){} }
  catch(e){ ST.certs=antes; showToast('No se pudo anular: '+e.message,null,true); }
};

function renderCertificados(){
  if(ST._certLoaded!==true){ if(!ST._certLoaded)setTimeout(certCargar,0); return '<div class="h1">Certificados YourLift</div><p class="subtitle">Cargando…</p>'; }
  if(ST._refLoaded!==true&&ST._refLoaded!=='loading')setTimeout(refEnsureLoaded,0);
  const f=ST.certForm||(ST.certForm=_certNuevoForm());
  const lbl='display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px';
  const campo=(t,id,val,extra)=>`<label style="${lbl}">${t}<input id="${id}" class="inp" value="${esc(val||'')}" ${extra||''}></label>`;
  const jueces=(ST.referees||[]).filter(r=>r.nombre);
  const roles=Object.entries(CERT_ROLES).map(([k,r])=>`<button type="button" onclick="certRol('${k}')" class="btn" style="font-size:12px;padding:6px 12px;${f.rol===k?'background:var(--gold);color:#000;border-color:var(--gold)':''}">${r.t}</button>`).join('');
  const comps=CERT_COMP.map(([k,t])=>`<label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="cf_c_${k}" ${f.comp.includes(k)?'checked':''}> ${t}</label>`).join('');
  const lista=(ST.certs||[]).map((c,i)=>({c,i})).sort((a,b)=>(b.c.creado||0)-(a.c.creado||0));
  const filas=lista.map(({c,i})=>{
    const rol=(CERT_ROLES[c.rol]||{}).t||c.rol||'';
    return `<tr>
      <td style="padding:8px 10px;font-family:Oswald;color:var(--gold);white-space:nowrap">${esc(c.codigo)}</td>
      <td style="padding:8px 10px"><div style="font-weight:600">${esc(c.nombre)}</div><div style="font-size:11px;color:var(--muted)">${esc(c.rut||'')}${c.correo?' · '+esc(c.correo):''}</div></td>
      <td style="padding:8px 10px;font-size:12px">${esc(rol)}<div style="font-size:10.5px;color:var(--muted)">${CERT_COMP.filter(k=>(c.comp||[]).includes(k[0])).map(k=>k[1]).join(' · ')}</div></td>
      <td style="padding:8px 10px;font-size:12px;white-space:nowrap">${esc(c.fecha||'')}</td>
      <td style="padding:8px 10px;white-space:nowrap;text-align:right">
        <button class="btn" style="font-size:11px;padding:5px 10px" onclick="certDescargar(${i})">PDF</button>
        <button class="btn" style="font-size:11px;padding:5px 10px" onclick="certEnviar(${i})">Enviar</button>
        <button class="btn btn-r" style="font-size:11px;padding:5px 10px" onclick="certBorrar(${i})">Anular</button>
      </td></tr>`;
  }).join('');
  return `<div class="h1">Certificados YourLift</div>
    <p class="subtitle">Acredita a quien ya sabe usar la plataforma —jueces, mesa de control, transmisión— para saber a quién llamar en cada campeonato. El PDF se descarga al emitirlo y se puede volver a bajar o enviar desde la lista.</p>
    ${ST._certErr?`<div style="margin:12px 0;padding:10px 14px;border:1px solid var(--red);border-radius:8px;color:var(--red);font-size:12px">No se pudo leer la lista de certificados: ${esc(ST._certErr.message||'')}</div>`:''}
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin:14px 0 22px">
      <div style="font-family:Oswald;font-size:15px;letter-spacing:1px;margin-bottom:12px">NUEVO CERTIFICADO</div>
      ${jueces.length?`<label style="${lbl};margin-bottom:12px">TOMAR DATOS DE LA BASE DE JUECES
        <select class="inp" onchange="if(this.value)certDesdeJuez(this.value)"><option value="">— Elegir juez (opcional) —</option>${jueces.map(r=>`<option value="${esc(r.id)}">${esc(r.nombre)}${r.rut?' · '+esc(r.rut):''}</option>`).join('')}</select></label>`:''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        ${campo('NOMBRE COMPLETO *','cf_nombre',f.nombre,'placeholder="Nombre y apellidos"')}
        ${campo('RUT','cf_rut',f.rut,'placeholder="12.345.678-9"')}
        ${campo('CORREO (para enviarlo)','cf_correo',f.correo,'type="email" placeholder="correo@ejemplo.cl"')}
      </div>
      <div style="${lbl};margin:14px 0 6px">ACREDITADO COMO</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${roles}</div>
      <div style="${lbl};margin-bottom:6px">SABE USAR</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;margin-bottom:14px">${comps}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${campo('INSTANCIA / CURSO','cf_curso',f.curso)}
        ${campo('FECHA DE EMISIÓN','cf_fecha',f.fecha,'type="date"')}
        ${campo('LUGAR','cf_lugar',f.lugar)}
        ${campo('FIRMA (nombre)','cf_firma',f.firma)}
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button class="btn" style="background:var(--green);color:#000;border-color:var(--green);font-weight:700" onclick="certEmitir()">Emitir y descargar PDF</button>
        <button class="btn" onclick="certLimpiar()">Limpiar</button>
      </div>
    </div>
    <div style="font-family:Oswald;font-size:15px;letter-spacing:1px;margin-bottom:8px">ACREDITADOS (${(ST.certs||[]).length})</div>
    ${filas?`<div style="overflow-x:auto;background:var(--card);border:1px solid var(--border);border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:var(--muted);font-family:Oswald;font-size:11px;letter-spacing:1px"><th style="padding:8px 10px">CÓDIGO</th><th style="padding:8px 10px">PERSONA</th><th style="padding:8px 10px">ACREDITADO COMO</th><th style="padding:8px 10px">FECHA</th><th></th></tr></thead>
      <tbody>${filas}</tbody></table></div>`:'<div style="color:var(--muted);font-size:13px">Todavía no hay certificados emitidos.</div>'}`;
}

function renderSponsors(){
  const list=ST.sponsors||[];
  const rows=list.map((s,i)=>`<div style="display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;flex-wrap:wrap">
    <div style="width:120px;height:60px;border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;background:#0a1628;overflow:hidden;flex-shrink:0">
      ${s.logoUrl?`<img src="${esc(s.logoUrl)}" style="max-width:100%;max-height:100%;object-fit:contain">`:'<span style="font-size:10px;color:var(--muted)">sin logo</span>'}
    </div>
    <div style="flex:1;min-width:260px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <input id="sp_nom_${i}" class="inp" placeholder="Nombre" value="${esc(s.nombre||'')}" onchange="spSet(${i},'nombre',this.value)">
      <input id="sp_ig_${i}" class="inp" placeholder="@instagram" value="${esc(s.ig||'')}" onchange="spSet(${i},'ig',this.value)">
      <input id="sp_link_${i}" class="inp" placeholder="Web (opcional)" value="${esc(s.link||'')}" onchange="spSet(${i},'link',this.value)">
    </div>
    <label class="btn" style="font-size:11px;cursor:pointer;padding:6px 10px">Subir logo<input type="file" accept="image/*" onchange="spUploadLogo(${i},this)" style="display:none"></label>
    <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)"><input id="sp_act_${i}" type="checkbox" ${s.activo!==false?'checked':''} onchange="spSet(${i},'activo',this.checked)"> Activo</label>
    <button onclick="spDel(${i})" class="btn btn-r" style="padding:5px 9px;font-size:11px">Eliminar</button>
    <span id="sp_status_${i}" style="font-size:10px;color:var(--muted)"></span>
  </div>`).join('');
  return `<div class="h1">Auspiciadores</div>
    <p class="subtitle">Logos que avanzan en el carrusel del Inicio de yourlift.cl. Sube el logo, pon el link y actívalo.</p>
    <div style="margin:14px 0">${rows||'<div style="color:var(--muted);font-size:13px">Sin auspiciadores aún. Usa “+ Agregar”.</div>'}</div>
    <div style="display:flex;gap:10px">
      <button onclick="spAdd()" class="btn">+ Agregar auspiciador</button>
      <button onclick="spSave()" class="btn btn-g">Guardar</button>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:12px">Tras guardar, el carrusel aparece en el Inicio. Logos PNG con fondo transparente se ven mejor.</p>`;
}

function renderStats(){
  if(!_statsPuede())
    return '<div class="h1">Sin acceso</div><p class="subtitle">Las estadísticas son solo para el owner.</p>';
  // La pestaña vive en el navegador, así que se vuelve a comprobar acá: que no
  // se dibuje el botón no basta para dar por cerrada una puerta.
  if((ST.statsTab==='demografia'||ST.statsTab==='web')&&!_statsOwner())ST.statsTab='deporte';
  const tab=ST.statsTab||'deporte';
  const tabBtn=(id,label)=>`<button onclick="ST.statsTab='${id}';render()" style="padding:10px 20px;border-radius:9px;border:1px solid ${tab===id?'var(--gold)':'var(--border)'};background:${tab===id?'rgba(212,168,67,.12)':'transparent'};color:${tab===id?'var(--gold)':'var(--muted)'};font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer">${label}</button>`;
  return `<div class="h1">Estadísticas</div>
    <div style="display:flex;gap:10px;margin:14px 0 20px;flex-wrap:wrap">
      ${tabBtn('deporte','DEPORTE')}
      ${tabBtn('2026','AFILIACIONES '+new Date().getFullYear())}
      ${tabBtn('corte','CORTE NACIONAL')}
      ${_statsOwner()?tabBtn('demografia','DEMOGRAFÍA'):''}
      ${_statsOwner()?tabBtn('web','TRÁFICO WEB'):''}
    </div>
    ${tab==='web'
      ? `<div id="statsWebContent"><div style="padding:40px;text-align:center;color:var(--muted)">Cargando analytics…</div></div>`
      : tab==='2026'
      ? `<p class="subtitle">Cuántas afiliaciones aportó cada campeonato del año · cada persona cuenta una sola vez, en el primero que corre</p><div id="statsContent">${render2026Stats()}</div>`
      : tab==='corte'
      ? `<p class="subtitle">Simulador de mínimos para clasificar · se prueba un corte y se ve a cuántos deja dentro, antes de fijarlo</p><div id="statsContent">${renderCorte()}</div>`
      : tab==='demografia'
      ? `<p class="subtitle">Base completa de atletas · calculado en vivo desde data.json</p><div id="statsContent">${renderDemografia()}</div>`
      : `<p class="subtitle">Dashboard interactivo · Filtros globales · Export para Power BI</p><div id="statsContent">${renderStatsContent()}</div>`}`;
}

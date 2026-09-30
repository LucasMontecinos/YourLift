// admin.html — Lo que se ve en yourlift.cl: auspiciadores, qué competencias son públicas, sus QR y los logos de clubes.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// ── Auspiciadores (carrusel del inicio) — guardado en site_backgrounds/sponsors ──
async function loadSponsors(){
  try{ const s=await getDoc(doc(db,'site_backgrounds','sponsors')); ST.sponsors=(s.exists()&&Array.isArray(s.data().items))?s.data().items:[]; }
  catch(e){ ST.sponsors=[]; }
  ST._sponsorsLoaded=true; if(ST.view==='sponsors')render();
}

window.spAdd=function(){ST.sponsors=ST.sponsors||[];ST.sponsors.push({nombre:'',link:'',logoUrl:'',activo:true});render();};

window.spDel=function(i){if(!confirm('¿Eliminar este auspiciador?'))return;ST.sponsors.splice(i,1);render();};

window.spSet=function(i,k,v){if(ST.sponsors&&ST.sponsors[i])ST.sponsors[i][k]=v;};

window.spUploadLogo=async function(i,inp){
  const f=inp.files&&inp.files[0];if(!f)return;
  const st=document.getElementById('sp_status_'+i);if(st)st.textContent='Subiendo…';
  try{
    const storage=getStorage(app);
    const fc=await compressImg(f,400,0.85);
    const sref=storageRef(storage,'logos/sponsors/'+Date.now()+'_'+i+'.webp');
    await uploadBytes(sref,fc,{contentType:'image/webp'});
    ST.sponsors[i].logoUrl=await getDownloadURL(sref); render();
  }catch(e){ if(st)st.textContent='Error: '+e.message; }
};

window.spSave=async function(){
  (ST.sponsors||[]).forEach((s,i)=>{const n=document.getElementById('sp_nom_'+i),g=document.getElementById('sp_ig_'+i),l=document.getElementById('sp_link_'+i),a=document.getElementById('sp_act_'+i);if(n)s.nombre=n.value;if(g)s.ig=g.value;if(l)s.link=l.value;if(a)s.activo=a.checked;});
  // Los auspiciadores son un compromiso comercial: los define el owner. La regla
  // de Firestore es la que de verdad lo impide; esto es para que quien no
  // corresponda vea un mensaje claro en vez de un error de permisos.
  if(ST.adminInfo?.role!=='owner'&&!ST.adminInfo?.bootstrap){
    showToast('Solo el Owner puede modificar los auspiciadores',null,true); return;
  }
  try{ await setDoc(doc(db,'site_backgrounds','sponsors'),{items:ST.sponsors||[],updatedAt:serverTimestamp()},{merge:true}); showToast('Auspiciadores guardados'); }
  catch(e){ showToast('Error: '+e.message,null,true); }
};

// ══════════════════════════════════════════════════════════════════
// YOURLIFT PÚBLICO — qué competencias ve la gente en "Competencia en Vivo"
// (index.html → hamburguesa → Competencia en Vivo). Es INDEPENDIENTE de lo que
// ves tú en el livecast: acá puedes tener muchas competencias cargadas y
// mostrarle al público solo la que se está transmitiendo hoy.
// Marca el campo publicoVisible en eventos/{id}.
// ══════════════════════════════════════════════════════════════════
window.pubToggle=async function(id,on){
  const ev=_pubEvs().find(e=>e.id===id); if(!ev)return;
  const prev=ev.publicoVisible===true;
  ev.publicoVisible=!!on; render();                    // respuesta inmediata
  try{
    // Los días del Sudamericano no son eventos de Firestore (su nómina viene del
    // archivo), así que al mostrarlos se crea el doc con lo mínimo para que la
    // tarjeta del público tenga nombre, fecha y lugar.
    const extra=ev._deArchivo?{name:ev.name||id,fecha:ev.fecha||'',lugar:ev.location||'',desdeNomina:true}:{};
    await setDoc(doc(db,'eventos',id),{publicoVisible:!!on,...extra},{merge:true});
    if(ev._deArchivo){ const f=(ST.eventos||[]).find(e=>e.id===id); if(f)f.publicoVisible=!!on; else (ST.eventos=ST.eventos||[]).push({...ev,_deArchivo:undefined}); }
    showToast(on?('"'+(ev.name||id)+'" ya se ve en Competencia en Vivo')
                :('Oculto del público: "'+(ev.name||id)+'"'));
  }catch(e){
    ev.publicoVisible=prev; render();                  // revertir si falló
    showToast('No se pudo guardar: '+e.message,null,true);
  }
};

window.pubHideAll=async function(){
  const on=_pubEvs().filter(e=>e.publicoVisible===true);
  if(!on.length){showToast('No hay competencias visibles para el público');return;}
  if(!confirm('¿Ocultar del público las '+on.length+' competencia(s) visibles?\n\nLa pestaña "Competencia en Vivo" va a quedar vacía.'))return;
  for(const e of on){ try{ await setDoc(doc(db,'eventos',e.id),{publicoVisible:false},{merge:true}); e.publicoVisible=false;
    const f=(ST.eventos||[]).find(x=>x.id===e.id); if(f)f.publicoVisible=false; }catch(_){} }
  render(); showToast('Listo: no se muestra ninguna competencia al público');
};

// Deja visibles SOLO los días del Sudamericano y apaga todo lo demás. Es lo que
// se pide durante el campeonato: que la gente entre y vea los nueve días, nada más.
window.pubSoloSuda=async function(){
  const evs=_pubEvs();
  const suda=evs.filter(e=>/^suda2026_d\d+$/.test(e.id));
  if(!suda.length){showToast('No encontré los días del Sudamericano',null,true);return;}
  const apagar=evs.filter(e=>e.publicoVisible===true&&!/^suda2026_d\d+$/.test(e.id));
  if(!confirm('Van a quedar visibles los '+suda.length+' días del Sudamericano'
    +(apagar.length?(' y se ocultan '+apagar.length+' competencia(s): '+apagar.map(e=>e.name||e.id).join(', ')):'')+'.\n\n¿Seguimos?'))return;
  for(const e of suda){ await window.pubToggle(e.id,true); }
  for(const e of apagar){ await window.pubToggle(e.id,false); }
  showToast('Listo: en Competencia en Vivo se ven solo los días del Sudamericano');
};

// Eventos que se le pueden mostrar al público: los de Firestore MÁS los que solo
// viven en nominas.json (los nueve días del Sudamericano y el ensayo).
function _pubEvs(){
  const out=(ST.eventos||[]).slice();
  (ST.nomFileEvents||[]).forEach(fe=>{
    if(!fe.id)return;
    if(out.some(e=>e.id===fe.id))return;
    out.push({id:fe.id,name:fe.name,fecha:fe.date||'',location:fe.location||'',
              logoUrl:'',status:'',publicoVisible:false,_deArchivo:true,_n:fe.n});
  });
  return out;
}

async function _pubLoadFile(){
  if(ST.nomFileEvents)return;
  ST.nomFileEvents=[];
  try{
    const j=await (await fetch('nominas.json?'+Date.now())).json();
    ST.nomFileEvents=((j&&j.events)||[]).filter(e=>e.id&&(e.athletes||[]).length)
      .map(e=>({id:e.id,name:e.name,date:e.date||'',location:e.location||'',n:e.athletes.length}));
  }catch(_){}
  render();
}

// El QR del seguimiento en vivo de un campeonato, para proyectarlo en la
// pantalla del recinto, imprimirlo o mandarlo. Lleva al MISMO link de
// "Competencia en Vivo" de yourlift.cl, así que si el campeonato todavía no
// está marcado como visible, el QR se lee pero la gente no ve nada: por eso el
// aviso.
// ── Mostrarle (o no) el QR al público ────────────────────────────────────────
// El QR funciona siempre: desde acá se genera y se imprime cuando haga falta.
// Lo que se enciende con esto es si la gente VE el botón en la tarjeta de
// Competencia en Vivo. Va por campeonato y no de una sola vez, porque el QR de
// un campeonato que todavía no empieza no le sirve a nadie.
//
// Lo decide el owner: es una decisión de cómo se muestra YourLift hacia afuera,
// igual que los auspiciadores.
window.pubQRToggle=async function(id,on){
  if(ST.adminInfo?.role!=='owner'&&!ST.adminInfo?.bootstrap){
    showToast('Solo el Owner decide si el QR se le muestra al público',null,true); return;
  }
  const ev=_pubEvs().find(x=>x.id===id); if(!ev)return;
  const antes=ev.qrPublico===true;
  ev.qrPublico=!!on; render();
  try{
    await setDoc(doc(db,'eventos',id),{qrPublico:!!on},{merge:true});
    const f=(ST.eventos||[]).find(x=>x.id===id); if(f)f.qrPublico=!!on;
    await logAction('qr_publico',id,String(antes),String(!!on),{nombre:ev.name||''});
    showToast(on?'El público ya ve el QR de '+(ev.name||id):'QR oculto para el público');
  }catch(e){ ev.qrPublico=antes; render(); showToast('Error: '+e.message,null,true); }
};

window.pubQR=function(id){
  if(!window.YLQR){showToast('No se pudo cargar el generador de QR',null,true);return;}
  const e=_pubEvs().find(x=>x.id===id)||{};
  if(e.publicoVisible!==true&&!confirm('Este campeonato todavía no está visible para el público.\n\n'
    +'El QR se va a generar igual, pero quien lo escanee no va a ver la competencia '
    +'hasta que le des "MOSTRAR".\n\n¿Generarlo igual?'))return;
  YLQR.panel({url:YLQR.urlEvento(id), titulo:e.name||id,
    archivo:'qr-'+String(id).replace(/[^A-Za-z0-9_-]+/g,'-')});
};

function renderPublico(){
  _pubLoadFile();
  const evs=_pubEvs().sort((a,b)=>{
    const av=a.publicoVisible===true?0:1, bv=b.publicoVisible===true?0:1;
    if(av!==bv)return av-bv;                            // primero las visibles
    return String(a.fecha||'').localeCompare(String(b.fecha||''))
        || String(a.name||'').localeCompare(String(b.name||''));
  });
  const nOn=evs.filter(e=>e.publicoVisible===true).length;
  let h=`<div class="h1">YourLift Público</div>
  <p class="subtitle">Elige qué competencias ve la gente en <b>Competencia en Vivo</b> (yourlift.cl → menú <i class=yl-i-menu></i>). El público entra siempre como <b>espectador</b>: puede mirar, nunca operar. Lo que no marques acá sigue disponible para ti en el livecast, pero no se le muestra a nadie.<br>
  El botón <b>QR</b> de acá genera el código para proyectar o imprimir, siempre. <b>QR OCULTO / QR PÚBLICO</b> decide si la gente ve ese botón en la tarjeta — por defecto no lo ve.</p>`;
  h+=`<div class="card" style="padding:14px 16px;margin-bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
    <span style="font-family:Oswald;font-size:13px">${nOn} de ${evs.length} visibles para el público</span>
    <span style="flex:1"></span>
    <a href="index.html#envivo" target="_blank" class="btn" style="padding:8px 14px;font-size:12px;background:transparent;border:1px solid var(--border);text-decoration:none">Ver como público ↗</a>
    <button class="btn" onclick="pubSoloSuda()" style="padding:8px 14px;font-size:12px;background:rgba(212,168,67,.12);border:1px solid var(--gold);color:var(--gold)" title="Deja visibles los nueve días del Sudamericano y oculta todo lo demás">Solo los 9 días del Sudamericano</button>
    ${nOn?`<button class="btn" onclick="pubHideAll()" style="padding:8px 14px;font-size:12px;background:transparent;border:1px solid var(--red);color:var(--red)">Ocultar todas</button>`:''}
  </div>`;
  if(!evs.length)return h+`<div class="card" style="padding:24px;text-align:center;color:var(--muted)">No hay campeonatos cargados todavía.</div>`;
  h+=`<div class="card" style="padding:0;overflow:hidden">`;
  evs.forEach(e=>{
    const on=e.publicoVisible===true;
    h+=`<div style="display:flex;align-items:center;gap:14px;padding:13px 16px;border-bottom:1px solid var(--border);${on?'background:rgba(34,197,94,.06)':''}">
      <div style="width:52px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${e.logoUrl?'#fff':'transparent'};border-radius:6px;border:1px solid var(--border)">
        ${e.logoUrl?`<img src="${esc(e.logoUrl)}" style="max-width:100%;max-height:100%;object-fit:contain">`:'<span style="font-size:9px;color:var(--muted)">sin logo</span>'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis">${esc(e.name||e.id)}</div>
        <div style="font-size:10px;color:var(--muted)">${esc(e.id)}${e.fecha?' · '+esc(e.fecha):''}${e.status?' · '+esc(e.status):''}${e._deArchivo?` · <span style="color:var(--gold)">nómina de archivo${e._n?' · '+e._n+' atletas':''}</span>`:''}</div>
      </div>
      ${on?`<span style="font-family:Oswald;font-size:10px;letter-spacing:1px;color:var(--green);white-space:nowrap">● EN VIVO PARA EL PÚBLICO</span>`:''}
      <button onclick="pubQR('${esc(e.id)}')" title="Código QR del seguimiento en vivo, para proyectar o imprimir" style="padding:7px 12px;border-radius:8px;border:1px solid var(--gold);background:transparent;color:var(--gold);font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer">QR</button>
      ${_statsOwner()?`<button onclick="pubQRToggle('${esc(e.id)}',${e.qrPublico===true?'false':'true'})" title="${e.qrPublico===true?'El público ve el botón QR en la tarjeta de esta competencia':'El público NO ve el QR de esta competencia'}" style="padding:7px 10px;border-radius:8px;border:1px solid ${e.qrPublico===true?'var(--green)':'var(--border)'};background:transparent;color:${e.qrPublico===true?'var(--green)':'var(--muted)'};font-family:Oswald;font-size:10px;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap">${e.qrPublico===true?'QR PÚBLICO ●':'QR OCULTO'}</button>`:''}
      <button onclick="pubToggle('${esc(e.id)}',${on?'false':'true'})" style="padding:7px 14px;border-radius:8px;border:1px solid ${on?'var(--red)':'var(--green)'};background:transparent;color:${on?'var(--red)':'var(--green)'};font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap">${on?'OCULTAR':'MOSTRAR'}</button>
    </div>`;
  });
  h+=`</div>`;
  return h;
}

window.uploadClubLogo=async function(club,slug,input){
  const file=input.files?.[0]; if(!file)return;
  const btn=input.closest('label'); if(btn)btn.textContent='Subiendo...';
  try{
    const compressed=await compressImg(file,400,0.85);
    // Faltaba tomar la instancia de Storage: `storage` no existía en esta función
    // y subir un logo moría con "Can't find variable: storage". El resto de las
    // subidas la piden así, cada una en su propio ámbito.
    const storage=getStorage(app);
    const sref=storageRef(storage,`logos/clubs/${slug}.webp`);
    await uploadBytes(sref,compressed,{contentType:'image/webp'});
    const url=await getDownloadURL(sref);
    await setDoc(doc(db,'clubs',slug),{name:club,slug,logoUrl:url,updatedAt:serverTimestamp()},{merge:true});
    showToast('Logo de '+club+' actualizado');
  }catch(e){showToast('Error: '+e.message,null,true);}
  finally{if(btn){btn.innerHTML='<input type="file" accept="image/*" style="display:none" onchange="uploadClubLogo(\''+club.replace(/'/g,"\\'")+'\',\''+slug+'\',this)">Cambiar logo';}}
};

// ══════════════════════════════════════════════════════════════════
// PORTADA — la foto de la portada de yourlift.cl y su encuadre.
// Se guarda en site_backgrounds/portada: {foto, pc:{x,y}, movil:{x,y}}. El sitio
// la lee junto con el resto de los fondos (con caché de 24 h), así que no suma
// lecturas. En computador la foto va a la derecha del texto; en teléfono y
// tablet, arriba. Por eso el encuadre se elige por separado para cada uno.
// ══════════════════════════════════════════════════════════════════
const _PORTADA_DEF={foto:'',pc:{x:30,y:0},movil:{x:50,y:50}};
async function loadPortada(){
  try{ const s=await getDoc(doc(db,'site_backgrounds','portada')); const d=s.exists()?s.data():{};
    ST.portada={foto:d.foto||'',pc:{..._PORTADA_DEF.pc,...(d.pc||{})},movil:{..._PORTADA_DEF.movil,...(d.movil||{})}}; }
  catch(e){ ST.portada=JSON.parse(JSON.stringify(_PORTADA_DEF)); }
  ST._portadaLoaded=true; if(ST.view==='portada')render();
}
// Mueve la vista previa en vivo, sin volver a dibujar la pantalla (el control
// deslizante perdería el foco a cada paso).
window.ptMover=function(cual,eje,v){
  if(!ST.portada)return; ST.portada[cual][eje]=+v;
  const img=document.getElementById('pt_img_'+cual); if(img)img.style.objectPosition=ST.portada[cual].x+'% '+ST.portada[cual].y+'%';
  const n=document.getElementById('pt_val_'+cual+'_'+eje); if(n)n.textContent=v+'%';
};
window.ptSubir=async function(inp){
  const f=inp.files&&inp.files[0]; if(!f)return;
  const st=document.getElementById('pt_status'); if(st)st.textContent='Subiendo…';
  try{
    const storage=getStorage(app);
    const fc=await compressImg(f,1800,0.82);
    const sref=storageRef(storage,'logos/portada/'+Date.now()+'.webp');
    await uploadBytes(sref,fc,{contentType:'image/webp'});
    ST.portada.foto=await getDownloadURL(sref); render();
    showToast('Foto subida. Ajusta el encuadre y aprieta Guardar.');
  }catch(e){ if(st)st.textContent='Error: '+e.message; }
};
window.ptOriginal=function(){ if(!ST.portada)return; ST.portada.foto=''; render(); };
window.ptSave=async function(){
  if(ST.adminInfo?.role!=='owner'&&!ST.adminInfo?.bootstrap){ showToast('Solo el Owner puede cambiar la portada',null,true); return; }
  try{
    const p=ST.portada;
    await setDoc(doc(db,'site_backgrounds','portada'),{foto:p.foto||'',pc:{x:+p.pc.x,y:+p.pc.y},movil:{x:+p.movil.x,y:+p.movil.y},updatedAt:serverTimestamp()},{merge:true});
    // El sitio guarda la configuración 24 h en este navegador: se borra acá para
    // que el owner vea el cambio al tiro. El resto la ve cuando se le venza.
    try{ localStorage.removeItem('_yfc_bgSettings'); }catch(_){}
    showToast('Portada guardada');
  }catch(e){ showToast('Error: '+e.message,null,true); }
};
function renderPortada(){
  const p=ST.portada; if(!p)return '<div class="h1">Portada</div><p class="subtitle">Cargando…</p>';
  const foto=p.foto||'portada/portada.jpg';
  const fotoMv=p.foto||'portada/portada_movil.jpg';
  const ctl=(cual,eje,lbl)=>`<label style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted)">
      <span style="width:92px">${lbl}</span>
      <input type="range" min="0" max="100" step="1" value="${p[cual][eje]}" oninput="ptMover('${cual}','${eje}',this.value)" style="flex:1">
      <b id="pt_val_${cual}_${eje}" style="width:40px;text-align:right;color:var(--text)">${p[cual][eje]}%</b></label>`;
  // Las vistas previas reproducen el recorte real: en computador la foto ocupa la
  // derecha de una franja ancha y el texto tapa la izquierda; en teléfono va arriba.
  return `<div class="h1">Portada</div>
    <p class="subtitle">La foto de la portada de yourlift.cl. Muévela para que no se corte la cara: en computador va a la derecha del texto y en el teléfono arriba.</p>
    <div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:20px;margin:16px 0;align-items:start">
      <div>
        <div style="font-family:Oswald;font-size:13px;letter-spacing:2px;color:var(--gold);margin-bottom:8px">COMPUTADOR</div>
        <div style="position:relative;aspect-ratio:1.9;background:#070B14;border:1px solid var(--border);border-radius:8px;overflow:hidden">
          <img id="pt_img_pc" src="${esc(foto)}" style="position:absolute;right:0;top:0;width:60%;height:100%;object-fit:cover;object-position:${p.pc.x}% ${p.pc.y}%;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 32%);mask-image:linear-gradient(90deg,transparent 0%,#000 32%)">
          <div style="position:absolute;left:5%;bottom:14%;font-family:Oswald;font-weight:700;color:#fff;font-size:clamp(18px,3vw,34px);line-height:.95">CADA KILO<br><span style="color:#E62832">CUENTA.</span></div>
        </div>
        <div style="display:grid;gap:6px;margin-top:10px">${ctl('pc','x','Horizontal')}${ctl('pc','y','Vertical')}</div>
      </div>
      <div>
        <div style="font-family:Oswald;font-size:13px;letter-spacing:2px;color:var(--gold);margin-bottom:8px">TELÉFONO Y TABLET</div>
        <div style="position:relative;aspect-ratio:1.42;background:#070B14;border:1px solid var(--border);border-radius:8px;overflow:hidden">
          <img id="pt_img_movil" src="${esc(fotoMv)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${p.movil.x}% ${p.movil.y}%">
        </div>
        <div style="display:grid;gap:6px;margin-top:10px">${ctl('movil','x','Horizontal')}${ctl('movil','y','Vertical')}</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <label class="btn" style="cursor:pointer">Subir otra foto<input type="file" accept="image/*" onchange="ptSubir(this)" style="display:none"></label>
      ${p.foto?'<button class="btn" onclick="ptOriginal()">Volver a la foto original</button>':''}
      <button class="btn btn-g" onclick="ptSave()">Guardar</button>
      <span id="pt_status" style="font-size:11px;color:var(--muted)"></span>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:12px">Tú lo ves al tiro. Los visitantes lo ven cuando se les renueva la configuración del sitio (hasta 24 horas), así la portada no suma lecturas.</p>`;
}

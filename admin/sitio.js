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
const _PT_FOTO=()=>({url:'',pc:{x:30,y:0},movil:{x:50,y:50}});
async function loadPortada(){
  let d={};
  try{ const s=await getDoc(doc(db,'site_backgrounds','portada')); d=s.exists()?s.data():{}; }catch(e){}
  // Formato viejo (una sola foto: {foto,pc,movil}) → lista de una.
  let fotos=Array.isArray(d.fotos)?d.fotos:((d.foto||d.pc||d.movil)?[{url:d.foto||'',pc:d.pc,movil:d.movil}]:[]);
  if(!fotos.length)fotos=[_PT_FOTO()];
  ST.portada={intervalo:+d.intervalo||6,fotos:fotos.map(f=>({url:f.url||'',pc:{..._PT_FOTO().pc,...(f.pc||{})},movil:{..._PT_FOTO().movil,...(f.movil||{})}})),
    secciones:{..._PT_SEC_DEF,...(d.secciones||{})},
    publico:Array.isArray(d.publico)?d.publico.filter(x=>x&&x.id).map(x=>({id:x.id,nombre:x.nombre||'',fecha:x.fecha||'',personas:+x.personas||0})):[],
    medido:null};
  ST._portadaLoaded=true; if(ST.view==='portada')render();
  ptCargarMedido();
}

// ── Los bloques de abajo del inicio (sitio/inicio.js) ──
// Se guardan en el mismo documento: secciones {clave: sí/no} y, para "Personas
// que siguieron la competencia", la lista que el owner decide publicar.
const _PT_SEC_DEF={proximos:true,campeonatos:true,totales:true,records:false,publico:false};
const _PT_SECS=[
  ['proximos','Próximos campeonatos','Las competencias que vienen, con su estado.'],
  ['publico','Personas que siguieron la competencia','Cuántas personas siguieron en vivo los campeonatos que elijas abajo.'],
  ['campeonatos','Campeonatos','Lo último: los 3 campeonatos más recientes, con la mejor marca (GL) de cada uno.'],
  ['records','Récords','Los 3 récords nacionales más recientes (los que tienen fecha).'],
  ['totales','Totales','Top 5 GL del año: los mejores totales en Classic y Equipado, hombres y mujeres.'],
];
// Lo medido por el livecast: analytics_daily/{día}.lc_u.{campeonato} = equipos
// distintos que abrieron la Competencia en Vivo ese día (cada equipo cuenta una
// sola vez por campeonato). Se suman los días. Es solo para el owner.
async function ptCargarMedido(){
  try{
    const desde=new Date(Date.now()-400*864e5).toISOString().slice(0,10);
    const snap=await getDocs(query(collection(db,'analytics_daily'),where('date','>=',desde)));
    const M={};
    snap.forEach(dd=>{ const v=dd.data()||{};
      Object.entries(v.lc_u||{}).forEach(([id,n])=>{ const m=M[id]||(M[id]={personas:0,aperturas:0}); m.personas+=(+n||0); });
      Object.entries(v.lc||{}).forEach(([id,n])=>{ const m=M[id]||(M[id]={personas:0,aperturas:0}); m.aperturas+=(+n||0); });
    });
    if(ST.portada)ST.portada.medido=M;
  }catch(e){ if(ST.portada)ST.portada.medido={}; console.warn('[portada] personas:',e.message); }
  if(ST.view==='portada')render();
}
window.ptSec=function(k,on){ ST.portada.secciones[k]=!!on; if(k==='publico')render(); };
window.ptPubSel=function(id,on){
  const L=ST.portada.publico, i=L.findIndex(x=>x.id===id);
  if(on&&i<0&&L.length>=3){ showToast('Se muestran hasta 3: saca uno antes de marcar otro',null,true); render(); return; }
  if(on&&i<0){
    const ev=(ST.eventos||[]).find(e=>e.id===id)||{}, m=(ST.portada.medido||{})[id]||{};
    L.push({id,nombre:ev.name||id,fecha:ev.date||'',personas:+m.personas||0});
  }else if(!on&&i>=0)L.splice(i,1);
  render();
};
window.ptPubNum=function(id,v){ const x=ST.portada.publico.find(x=>x.id===id); if(x)x.personas=Math.max(0,Math.round(+v||0)); };
function _ptSeccionesHtml(p){
  const S=p.secciones;
  let h=`<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin:18px 0">
    <b style="font-family:Oswald;letter-spacing:2px;color:var(--gold)">QUÉ SE VE EN EL INICIO</b>
    <p style="font-size:12px;color:var(--muted);margin:6px 0 12px">Marca los bloques que van abajo de la foto. Salen en este orden; la franja de colaboradores va siempre después de los próximos campeonatos.</p>
    <div style="display:grid;gap:8px">`;
  _PT_SECS.forEach(([k,t,dsc])=>{
    h+=`<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;padding:8px 10px;border:1px solid var(--border);border-radius:8px">
      <input type="checkbox" ${S[k]?'checked':''} onchange="ptSec('${k}',this.checked)" style="margin-top:3px">
      <span><b style="font-size:13px">${t}</b><br><span style="font-size:12px;color:var(--muted)">${dsc}</span></span></label>`;
  });
  h+=`</div>`;
  if(S.publico){
    const M=p.medido;
    const hoy=new Date().toISOString().slice(0,10);
    const ids=new Set(Object.keys(M||{}));
    p.publico.forEach(x=>ids.add(x.id));
    const evs=(ST.eventos||[]).filter(e=>e&&e.id&&(ids.has(e.id)||(e.date&&e.date<=hoy))&&e.status!=='archived');
    p.publico.forEach(x=>{ if(!evs.some(e=>e.id===x.id))evs.push({id:x.id,name:x.nombre,date:x.fecha}); });
    evs.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    h+=`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
      <b style="font-size:13px">Personas que siguieron la competencia</b>
      <p style="font-size:12px;color:var(--muted);margin:4px 0 10px">El livecast cuenta a cada persona (cada teléfono o computador) una vez por campeonato, sin guardar nada de ella. Se mide desde noviembre de 2026; para los anteriores puedes escribir la cifra a mano (por ejemplo, las vistas de YouTube). Marca los que quieres mostrar (hasta 3).</p>`;
    if(M===null)h+=`<div style="font-size:12px;color:var(--muted)">Cargando lo medido…</div>`;
    h+=`<div style="display:grid;gap:6px">`;
    evs.slice(0,12).forEach(e=>{
      const sel=p.publico.find(x=>x.id===e.id), m=(M||{})[e.id];
      const idq=esc(e.id).replace(/'/g,"\\'");
      h+=`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 10px;border:1px solid var(--border);border-radius:8px;${sel?'background:rgba(34,197,94,.06)':''}">
        <input type="checkbox" ${sel?'checked':''} onchange="ptPubSel('${idq}',this.checked)">
        <span style="flex:1;min-width:200px;font-size:13px">${esc(e.name||e.id)}<span style="color:var(--muted);font-size:11px"> · ${esc(e.date||'')}</span></span>
        <span style="font-size:11px;color:var(--muted)">${m?('medido: '+m.personas+' personas'):'sin medición'}</span>
        ${sel?`<label style="font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center">Mostrar <input class="inp" type="number" min="0" value="${sel.personas}" oninput="ptPubNum('${idq}',this.value)" style="width:90px"> personas</label>`:''}
      </div>`;
    });
    if(!evs.length)h+=`<div style="font-size:12px;color:var(--muted)">Todavía no hay campeonatos.</div>`;
    h+=`</div></div>`;
  }
  return h+`</div>`;
}
// Mueve la vista previa en vivo, sin volver a dibujar la pantalla (el control
// deslizante perdería el foco a cada paso).
window.ptMover=function(i,cual,eje,v){
  const f=ST.portada&&ST.portada.fotos[i]; if(!f)return; f[cual][eje]=+v;
  const img=document.getElementById('pt_img_'+i+'_'+cual); if(img)img.style.objectPosition=f[cual].x+'% '+f[cual].y+'%';
  const n=document.getElementById('pt_val_'+i+'_'+cual+'_'+eje); if(n)n.textContent=v+'%';
};
window.ptSubir=async function(inp){
  const archivos=[...(inp.files||[])]; if(!archivos.length)return;
  const st=document.getElementById('pt_status');
  try{
    const storage=getStorage(app);
    for(let k=0;k<archivos.length;k++){
      if(st)st.textContent='Subiendo '+(k+1)+' de '+archivos.length+'…';
      const fc=await compressImg(archivos[k],1800,0.82);
      const sref=storageRef(storage,'logos/portada/'+Date.now()+'_'+k+'.webp');
      await uploadBytes(sref,fc,{contentType:'image/webp'});
      ST.portada.fotos.push({..._PT_FOTO(),url:await getDownloadURL(sref)});
    }
    render(); showToast('Listo. Ajusta el encuadre de cada foto y aprieta Guardar.');
  }catch(e){ if(st)st.textContent='Error: '+e.message; }
};
window.ptQuitar=function(i){
  if(ST.portada.fotos.length<2){showToast('Tiene que quedar al menos una foto',null,true);return;}
  if(!confirm('¿Sacar esta foto de la portada?'))return;
  ST.portada.fotos.splice(i,1); render();
};
window.ptMoverOrden=function(i,d){
  const L=ST.portada.fotos,j=i+d; if(j<0||j>=L.length)return;
  [L[i],L[j]]=[L[j],L[i]]; render();
};
window.ptOriginal=function(){ if(ST.portada.fotos.some(f=>!f.url))return; ST.portada.fotos.unshift(_PT_FOTO()); render(); };
window.ptSave=async function(){
  if(ST.adminInfo?.role!=='owner'&&!ST.adminInfo?.bootstrap){ showToast('Solo el Owner puede cambiar la portada',null,true); return; }
  try{
    const p=ST.portada, iv=document.getElementById('pt_int'); if(iv)p.intervalo=Math.max(3,Math.min(60,+iv.value||6));
    await setDoc(doc(db,'site_backgrounds','portada'),{
      fotos:p.fotos.map(f=>({url:f.url||'',pc:{x:+f.pc.x,y:+f.pc.y},movil:{x:+f.movil.x,y:+f.movil.y}})),
      intervalo:p.intervalo,foto:null,pc:null,movil:null,
      secciones:{..._PT_SEC_DEF,...(p.secciones||{})},
      publico:(p.publico||[]).slice(0,3).map(x=>({id:x.id,nombre:x.nombre||'',fecha:x.fecha||'',personas:Math.max(0,Math.round(+x.personas||0))})),
      updatedAt:serverTimestamp()},{merge:true});
    // El sitio guarda la configuración 24 h en este navegador: se borra acá para
    // que el owner vea el cambio al tiro. El resto la ve cuando se le venza.
    try{ localStorage.removeItem('_yfc_bgSettings'); }catch(_){}
    showToast('Portada guardada');
  }catch(e){ showToast('Error: '+e.message,null,true); }
};
function renderPortada(){
  const p=ST.portada; if(!p)return '<div class="h1">Portada</div><p class="subtitle">Cargando…</p>';
  const n=p.fotos.length;
  const ctl=(i,f,cual,eje,lbl)=>`<label style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted)">
      <span style="width:80px">${lbl}</span>
      <input type="range" min="0" max="100" step="1" value="${f[cual][eje]}" oninput="ptMover(${i},'${cual}','${eje}',this.value)" style="flex:1">
      <b id="pt_val_${i}_${cual}_${eje}" style="width:40px;text-align:right;color:var(--text)">${f[cual][eje]}%</b></label>`;
  // Las vistas previas reproducen el recorte real: en computador la foto ocupa la
  // derecha y se funde con el fondo; en teléfono y tablet va arriba.
  const tarjeta=(f,i)=>{
    const u=f.url||'portada/portada.jpg', um=f.url||'portada/portada_movil.jpg';
    return `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <b style="font-family:Oswald;letter-spacing:2px;color:var(--gold)">FOTO ${i+1}${f.url?'':' · ORIGINAL'}</b>
        <span style="flex:1"></span>
        <button class="btn" style="padding:5px 10px" ${i?'':'disabled'} onclick="ptMoverOrden(${i},-1)" title="Subir">↑</button>
        <button class="btn" style="padding:5px 10px" ${i<n-1?'':'disabled'} onclick="ptMoverOrden(${i},1)" title="Bajar">↓</button>
        <button class="btn btn-r" style="padding:5px 10px" onclick="ptQuitar(${i})">Sacar</button>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:18px;align-items:start">
        <div>
          <div style="font-size:11px;letter-spacing:2px;color:var(--muted);margin-bottom:6px">COMPUTADOR</div>
          <div style="position:relative;aspect-ratio:1.9;background:#070B14;border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <img id="pt_img_${i}_pc" src="${esc(u)}" style="position:absolute;right:0;top:0;width:60%;height:100%;object-fit:cover;object-position:${f.pc.x}% ${f.pc.y}%;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 32%);mask-image:linear-gradient(90deg,transparent 0%,#000 32%)">
            <div style="position:absolute;left:5%;bottom:14%;font-family:Oswald;font-weight:700;color:#fff;font-size:clamp(16px,2.6vw,30px);line-height:.95">CADA KILO<br><span style="color:#E62832">CUENTA.</span></div>
          </div>
          <div style="display:grid;gap:6px;margin-top:8px">${ctl(i,f,'pc','x','Horizontal')}${ctl(i,f,'pc','y','Vertical')}</div>
        </div>
        <div>
          <div style="font-size:11px;letter-spacing:2px;color:var(--muted);margin-bottom:6px">TELÉFONO Y TABLET</div>
          <div style="position:relative;aspect-ratio:1.42;background:#070B14;border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <img id="pt_img_${i}_movil" src="${esc(um)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${f.movil.x}% ${f.movil.y}%">
          </div>
          <div style="display:grid;gap:6px;margin-top:8px">${ctl(i,f,'movil','x','Horizontal')}${ctl(i,f,'movil','y','Vertical')}</div>
        </div>
      </div></div>`;
  };
  return `<div class="h1">Portada</div>
    <p class="subtitle">Las fotos de la portada de yourlift.cl y qué bloques van abajo. Con más de una foto, van pasando solas. Muévelas para que no se corte la cara: en computador van a la derecha del texto y en el teléfono arriba.</p>
    <div style="margin:16px 0">${p.fotos.map(tarjeta).join('')}</div>
    ${_ptSeccionesHtml(p)}
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <label class="btn" style="cursor:pointer">+ Agregar fotos<input type="file" accept="image/*" multiple onchange="ptSubir(this)" style="display:none"></label>
      ${p.fotos.some(f=>!f.url)?'':'<button class="btn" onclick="ptOriginal()">Agregar la foto original</button>'}
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)">Cambiar cada <input id="pt_int" class="inp" type="number" min="3" max="60" value="${p.intervalo}" style="width:64px"> segundos</label>
      <button class="btn btn-g" onclick="ptSave()">Guardar</button>
      <span id="pt_status" style="font-size:11px;color:var(--muted)"></span>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:12px">Tú lo ves al tiro. Los visitantes lo ven cuando se les renueva la configuración del sitio (hasta 24 horas), así la portada no suma lecturas.</p>`;
}

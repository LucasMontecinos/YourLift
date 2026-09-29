// admin.html — El editor de publicaciones para redes (solo owner).
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

window.pubSetTemplate = function(t){
  PUB_STATE.template = t;
  document.getElementById('pubEditorRoot').innerHTML = renderPublisherInner();
  setTimeout(pubUpdatePreview, 50);
};

window.pubSetField = function(key, value){
  PUB_STATE.data[key] = value;
  pubUpdatePreview();
};

window.pubLoadFromEvent = function(evId){
  if(!evId) return;
  const ev = (ST.eventos||[]).find(e=>e.id===evId);
  if(!ev) return;
  PUB_STATE.data.eventName = ev.short || ev.name || '';
  PUB_STATE.data.eventSubtitle = ev.name || '';
  PUB_STATE.data.organizer = ev.organizer || ev.org || '';
  PUB_STATE.data.location = ev.location || '';
  // Fecha bonita
  if(ev.date){
    try{
      const d = new Date(ev.date+'T00:00:00');
      const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      PUB_STATE.data.date = `${d.getDate()} DE ${months[d.getMonth()]} · ${d.getFullYear()}`;
    }catch(e){PUB_STATE.data.date = ev.date}
  }
  if(ev.logoUrl) PUB_STATE.data.customLogoUrl = ev.logoUrl;
  // Repintar form + preview
  document.getElementById('pubEditorRoot').innerHTML = renderPublisherInner();
  setTimeout(pubUpdatePreview, 50);
};

window.pubUploadLogo = function(inp){
  const f = inp.files && inp.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    PUB_STATE.data.customLogoUrl = e.target.result;
    pubUpdatePreview();
  };
  reader.readAsDataURL(f);
};

window.pubClearLogo = function(){
  PUB_STATE.data.customLogoUrl = '';
  document.getElementById('pubEditorRoot').innerHTML = renderPublisherInner();
  setTimeout(pubUpdatePreview, 50);
};

// ── Carta de Atleta: cargar marcas/categoría desde la base de datos ──
window.pubFmtCat = function(cat){
  const s=String(cat||'');
  const num=(s.match(/\d+\.?\d*/)||[''])[0];
  if(!num) return s.toUpperCase();
  return '−'+num+(s.includes('+')?'+':'')+' KG';
};

window.pubLoadAthleteCard = function(name){
  if(!name) return;
  const data=ST.data||[];
  const a=data.find(x=>x.nombre===name)||data.find(x=>(x.nombre||'').toLowerCase()===String(name).toLowerCase());
  if(!a){ showToast('Atleta no encontrado en la base',null,true); return; }
  const bl=a.bestLifts||{};
  PUB_STATE.data.cardName=a.nombre||'';
  PUB_STATE.data.cardSquat=bl.sq||'';
  PUB_STATE.data.cardBench=bl.bp||'';
  PUB_STATE.data.cardDeadlift=bl.dl||'';
  PUB_STATE.data.cardTotal=bl.total||'';
  PUB_STATE.data.cardGLP=bl.glp||'';
  // Categoría/evento: tomar la competencia cuyo total coincide con bestLifts.total;
  // si no, la de mayor total.
  const comps=a.competencias||[]; let best=null;
  comps.forEach(c=>{ const r=c.resultado||{}; if(r.total&&Math.abs((+r.total)-(+bl.total))<0.01) best=c; });
  if(!best) comps.forEach(c=>{ const r=c.resultado||{}; if(r.total&&(!best||(+r.total)>(+((best.resultado||{}).total)||0))) best=c; });
  if(best){ const r=best.resultado||{}; PUB_STATE.data.cardCategory=pubFmtCat(best.categoria||r.categoria||''); if(best.evento) PUB_STATE.data.cardEvent=String(best.evento).toUpperCase(); }
  PUB_STATE.data.cardFlag=PUB_STATE.data.cardFlag||'CL';
  // ── Para el template "Atletas más fuertes": club, sexo (título) y foto del sistema ──
  PUB_STATE.data.cardClub = (a.club==='Otro'?(a.clubOtro||''):(a.club||''));
  const _fem=/^(f|m|muj|w)/i.test(String(a.sexo||a.sex||''));
  PUB_STATE.data.cardOverall = (_fem?'CAMPEONA':'CAMPEÓN')+' OVERALL';
  if(PUB_STATE.template==='atletaFuerte'){
    if(a.foto_url){
      PUB_STATE.data.cardPhoto=a.foto_url; PUB_STATE.data.cardPhotoBlur='';
      pubMakeBlur(a.foto_url,function(b){ PUB_STATE.data.cardPhotoBlur=b; pubUpdatePreview(); });
    } else { PUB_STATE.data.cardPhoto=''; }
  }
  document.getElementById('pubEditorRoot').innerHTML=renderPublisherInner();
  setTimeout(pubUpdatePreview,50);
};

// Genera una versión difuminada (en canvas, porque html2canvas no soporta filter:blur).
window.pubMakeBlur = function(src, cb){
  try{
    const img=new Image();
    img.onload=function(){
      const w=560, h=Math.max(1,Math.round(w*img.height/img.width));
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const ctx=c.getContext('2d');
      try{ ctx.filter='blur(22px)'; }catch(_){}
      // dibujar un poco más grande para evitar bordes claros del blur
      ctx.drawImage(img,-30,-30,w+60,h+60);
      try{ cb(c.toDataURL('image/jpeg',0.82)); }catch(_){ cb(src); }
    };
    img.onerror=function(){ cb(src); };
    img.src=src;
  }catch(_){ cb(src); }
};

window.pubUploadCardPhoto = function(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=e=>{
    PUB_STATE.data.cardPhoto=e.target.result;
    PUB_STATE.data.cardPhotoBlur='';
    PUB_STATE.data.cardPhotoOX=0; PUB_STATE.data.cardPhotoOY=0;
    pubMakeBlur(e.target.result,function(burl){ PUB_STATE.data.cardPhotoBlur=burl; pubUpdatePreview(); });
    document.getElementById('pubEditorRoot').innerHTML=renderPublisherInner();
    setTimeout(pubUpdatePreview,50);
  };
  r.readAsDataURL(f);
};

window.pubClearCardPhoto = function(){
  PUB_STATE.data.cardPhoto=''; PUB_STATE.data.cardPhotoBlur='';
  document.getElementById('pubEditorRoot').innerHTML=renderPublisherInner();
  setTimeout(pubUpdatePreview,50);
};

window.pubPhotoDragStart = function(ev){
  ev.preventDefault();
  const d=PUB_STATE.data;
  window._pubPhotoDrag={sx:ev.clientX, sy:ev.clientY, ox:+(d.cardPhotoOX||0), oy:+(d.cardPhotoOY||0)};
  document.addEventListener('mousemove',pubPhotoDragMove);
  document.addEventListener('mouseup',pubPhotoDragEnd);
};

window.pubPhotoDragMove = function(ev){
  const g=window._pubPhotoDrag; if(!g) return;
  const k=3.5, d=PUB_STATE.data;
  const ox=Math.round(g.ox+(ev.clientX-g.sx)*k);
  const oy=Math.round(g.oy+(ev.clientY-g.sy)*k);
  d.cardPhotoOX=ox; d.cardPhotoOY=oy;
  const img=document.querySelector('#pubCanvas img');
  if(img){ img.style.transform='translate(-50%,-50%) translate('+ox+'px,'+oy+'px) scale('+((+d.cardPhotoZoom||100)/100)+')'; }
  else pubUpdatePreview();
};

window.pubPhotoDragEnd = function(){
  window._pubPhotoDrag=null;
  document.removeEventListener('mousemove',pubPhotoDragMove);
  document.removeEventListener('mouseup',pubPhotoDragEnd);
  pubUpdatePreview();
};

window.pubNameDragStart = function(ev){
  ev.preventDefault(); ev.stopPropagation();
  const d=PUB_STATE.data;
  window._pubNameDrag={sx:ev.clientX, sy:ev.clientY, nx:+(d.cardNameX||0), ny:+(d.cardNameY||720)};
  document.addEventListener('mousemove',pubNameDragMove);
  document.addEventListener('mouseup',pubNameDragEnd);
};

window.pubNameDragMove = function(ev){
  const g=window._pubNameDrag; if(!g) return;
  const k=3.5, d=PUB_STATE.data;
  const nx=Math.round(g.nx+(ev.clientX-g.sx)*k);
  const ny=Math.round(g.ny+(ev.clientY-g.sy)*k);
  d.cardNameX=nx; d.cardNameY=ny;
  const el=document.querySelector('#pubCanvas [data-cardname]');
  if(el){ el.style.left=(56+nx)+'px'; el.style.top=ny+'px'; }
  else pubUpdatePreview();
};

window.pubNameDragEnd = function(){
  window._pubNameDrag=null;
  document.removeEventListener('mousemove',pubNameDragMove);
  document.removeEventListener('mouseup',pubNameDragEnd);
  pubUpdatePreview();
};

window.pubDownload = async function(){
  if(!window.html2canvas){ showToast('html2canvas no cargado', null, true); return; }
  const btn = document.getElementById('pubDownloadBtn');
  if(btn){btn.textContent='Generando...';btn.disabled=true;}
  // Renderizar una copia a TAMAÑO REAL fuera de pantalla (sin el escalado del preview),
  // si no html2canvas captura el lienzo escalado y el texto sale encimado.
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;top:0;left:-10000px;width:1080px;height:1350px;overflow:hidden;z-index:-1';
  let html = pubRenderTemplate(PUB_STATE.template, PUB_STATE.data);
  html = pubApplyStyle(html, PUB_STATE.data);
  holder.innerHTML = html;
  document.body.appendChild(holder);
  try{
    const target = holder.firstElementChild || holder;
    const canvas = await window.html2canvas(target, {
      backgroundColor: null, scale: 2, useCORS: true, allowTaint: true, logging: false,
      width: 1080, height: 1350, windowWidth: 1080, windowHeight: 1350
    });
    await new Promise(res => canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const tplName = PUB_TEMPLATES[PUB_STATE.template]?.label.replace(/[^a-zA-Z0-9]+/g,'_') || 'post';
      a.href = url;
      a.download = `YL_${tplName}_${Date.now()}.png`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
      res();
    }, 'image/png'));
    showToast('Imagen descargada');
  } catch(e){
    console.error(e);
    showToast('Error generando PNG: '+e.message, null, true);
  } finally {
    holder.remove();
    if(btn){btn.textContent='Descargar PNG';btn.disabled=false;}
  }
};

window.pubUpdatePreview = function(){
  const c = document.getElementById('pubCanvas');
  if(!c) return;
  const tpl = PUB_STATE.template;
  const d = PUB_STATE.data;
  let html = pubRenderTemplate(tpl, d);
  html = pubApplyStyle(html, d);
  c.innerHTML = html;
};

// Aplica tipo de letra (títulos/texto) y escala de tamaño a todo el lienzo
window.pubApplyStyle = function(html, d){
  const HEAD = d.fontHead || 'Oswald';
  const BODY = d.fontBody || "'DM Sans'";
  html = html.replace(/font-family:'DM Sans',sans-serif/g, "font-family:"+BODY+",sans-serif")
             .replace(/font-family:Oswald/g, "font-family:"+HEAD)
             .replace(/font-family:'DM Sans'/g, "font-family:"+BODY);
  const fs = parseFloat(d.fontScale)||1;
  if(fs!==1) html = html.replace(/font-size:(\d+)px/g, (m,n)=>'font-size:'+Math.round(+n*fs)+'px');
  return html;
};

window.pubUploadBg = function(inp){
  const f = inp.files && inp.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = e => { PUB_STATE.data.bgImageUrl = e.target.result; PUB_STATE.data.bgColor=''; document.getElementById('pubEditorRoot').innerHTML=renderPublisherInner(); setTimeout(pubUpdatePreview,50); };
  r.readAsDataURL(f);
};

window.pubClearBg = function(){ PUB_STATE.data.bgImageUrl=''; PUB_STATE.data.bgColor=''; document.getElementById('pubEditorRoot').innerHTML=renderPublisherInner(); setTimeout(pubUpdatePreview,50); };

window.pubSetBgPreset = function(v){ PUB_STATE.data.bgPreset=v; PUB_STATE.data.bgImageUrl=''; PUB_STATE.data.bgColor=''; document.getElementById('pubEditorRoot').innerHTML=renderPublisherInner(); setTimeout(pubUpdatePreview,50); };

window.pubSetBgColor = function(v){ PUB_STATE.data.bgColor=v; PUB_STATE.data.bgImageUrl=''; pubUpdatePreview(); };

// Estrella dibujada en SVG. Las tarjetas las saca html2canvas, que no dibuja
// emojis ni los íconos con máscara CSS del resto del sitio, pero sí un <svg>
// en línea. El color va explícito: currentColor no llega a la imagen.
function _pubEstrella(px,color){
  return '<svg viewBox="0 0 24 24" width="'+px+'" height="'+px+'" style="display:inline-block;vertical-align:-0.1em" aria-hidden="true">'
    +'<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="'+(color||'#fff')+'"/></svg>';
}

// ─── Bandera (CSS, sin emojis — html2canvas no renderiza emojis) ──
window.pubFlagHtml = function(code){
  if(code==='CL') return `<div style="width:104px;height:70px;border:2px solid rgba(255,255,255,.55);border-radius:6px;overflow:hidden;position:relative;box-shadow:0 4px 14px rgba(0,0,0,.5)">
    <div style="position:absolute;top:0;left:0;width:100%;height:50%;background:#ffffff"></div>
    <div style="position:absolute;bottom:0;left:0;width:100%;height:50%;background:#D52B1E"></div>
    <div style="position:absolute;top:0;left:0;width:34%;height:50%;background:#0039A6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;line-height:1">${_pubEstrella(26,'#fff')}</div>
  </div>`;
  return '';
};

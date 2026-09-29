// index.html — galería y transmisiones.
//
// Parte del código de index.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

function loadGallery(){
  if(!window.FBQ||!fbDB)return setTimeout(loadGallery,500);
  if(GALLERY._loading)return;
  GALLERY._loading=true;
  const cached=_fsCache('gallery',30*60*1000); // 30 min
  if(cached){GALLERY=cached;if(ST.v==='gall')renderFondo();return;}
  window.FBQ.getDocs(window.FBQ.collection(fbDB,'gallery_photos')).then(snap=>{
    GALLERY=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.ts?.seconds||0)-(a.ts?.seconds||0));
    _fsSetCache('gallery',GALLERY);
    if(ST.v==='gall')renderFondo();
  });
}

function gall(){
  if(!GALLERY.length&&!GALLERY._loading)loadGallery();
  const events=[...new Set(GALLERY.map(p=>p.eventoName).filter(Boolean))];
  const filtered=GALLERY_FILTER?GALLERY.filter(p=>p.eventoName===GALLERY_FILTER):GALLERY;
  let h=`<div class="cd2"><div class="ct"><h2 style="color:var(--gold)">Galería</h2><span class="bg" style="background:var(--gold);color:var(--bg)">${filtered.length}</span></div>`;
  h+=`<p style="font-size:12px;color:var(--muted);margin-bottom:14px">Fotos de los eventos · Click para ver al fotógrafo</p>`;
  if(events.length>1){
    h+=`<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap"><button class="sb ${!GALLERY_FILTER?'a':''}" onclick="setGalleryFilter('')">Todos</button>`;
    events.forEach(e=>{h+=`<button class="sb ${GALLERY_FILTER===e?'a':''}" onclick="setGalleryFilter(${JSON.stringify(e).replace(/"/g,'&quot;')})">${e}</button>`});
    h+=`</div>`;
  }
  if(!filtered.length){h+=`<div class="emp" style="padding:30px;text-align:center;color:var(--muted)">No hay fotos aún</div></div>`;return h;}
  h+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">`;
  filtered.forEach(p=>{
    const ig=(p.instagram||'').replace(/^@/,'');
    const igUrl=ig?`https://instagram.com/${encodeURIComponent(ig)}`:'';
    h+=`<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:transform .15s,border-color .15s" onmouseover="this.style.transform='translateY(-2px)';this.style.borderColor='var(--gold)'" onmouseout="this.style.transform='';this.style.borderColor='var(--border)'">`;
    h+=`<a href="${p.url}" target="_blank" style="display:block;aspect-ratio:1/1;background:#000;overflow:hidden"><img src="${p.url}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"></a>`;
    h+=`<div style="padding:10px"><div style="font-family:Oswald;font-size:11px;color:var(--gold);letter-spacing:1px;margin-bottom:4px;text-transform:uppercase">${p.eventoName||''}</div>`;
    if(p.photographer||ig){
      h+=`<div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;flex-wrap:wrap">Cortesía de:`;
      if(ig)h+=` <a href="${igUrl}" target="_blank" style="color:#E1306C;text-decoration:none;font-weight:600">@${ig}</a>`;
      else if(p.photographer)h+=` ${p.photographer}`;
      h+=`</div>`;
    }
    h+=`</div></div>`;
  });
  h+=`</div></div>`;
  return h;
}

function setGalleryFilter(e){GALLERY_FILTER=e;render()}

// Una tarjeta por TRANSMISIÓN, no por campeonato. En uno de varios días el link
// se cambia cada mañana y los de los días anteriores quedan en youtubeDias (los
// guarda el admin). Cada tarjeta lleva el campeonato y, si tiene fecha, el día.
function _transPorDia(ev){
  const vid=u=>{const m=String(u||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);return m?m[1]:String(u||'').trim();};
  const lista=[].concat(Array.isArray(ev.youtubeDias)?ev.youtubeDias:[]);
  if(ev.youtubeUrl)lista.push({url:ev.youtubeUrl,fecha:ev.youtubeDesde||''});
  const vistos=new Set(), out=[];
  lista.forEach(d=>{
    if(!d||!d.url)return;
    const k=vid(d.url); if(vistos.has(k))return; vistos.add(k);
    out.push({url:d.url,fecha:d.fecha||''});
  });
  if(out.length<2)return out.map(d=>Object.assign({},ev,{youtubeUrl:d.url,_orden:ev.date||''}));
  // El día se cuenta desde el inicio del campeonato. Si no tiene fecha cargada
  // (el Sudamericano no la tiene), desde el día más temprano de la lista.
  const _fechas=out.map(d=>d.fecha).filter(Boolean).sort();
  const _base=ev.date||_fechas[0]||'';
  const ini=_base?new Date(_base+'T00:00:00'):null;
  return out.map(d=>{
    let etiqueta='';
    if(d.fecha){
      const f=new Date(d.fecha+'T00:00:00');
      const n=(ini&&!isNaN(ini)&&!isNaN(f))?Math.round((f-ini)/864e5)+1:0;
      etiqueta=(n>=1?'Día '+n+' · ':'')+d.fecha.slice(8,10)+'/'+d.fecha.slice(5,7);
    }
    return Object.assign({},ev,{youtubeUrl:d.url,_dia:etiqueta,_orden:d.fecha||ev.date||''});
  });
}

function trans(){
  // Lista de transmisiones YouTube — incluye archivados, una por día
  const all=[];
  (window.ALL_EVENTS||NM.events||[]).filter(ev=>ev.youtubeUrl||(Array.isArray(ev.youtubeDias)&&ev.youtubeDias.length))
    .forEach(ev=>_transPorDia(ev).forEach(t=>all.push(t)));
  // Ordenar por fecha descendente (más reciente primero)
  const sorted=all.slice().sort((a,b)=>(b._orden||'').localeCompare(a._orden||''));
  let h=liveEmbed();
  h+=`<div class="cd2"><div class="ct"><h2 style="color:var(--gold)">Transmisiones pasadas</h2><span class="bg" style="background:var(--gold);color:var(--bg)">${sorted.length}</span></div>`;
  h+=`<p style="font-size:12px;color:var(--muted);margin-bottom:16px">Archivo de transmisiones desde la implementación de YourLift en FECHIPO</p>`;
  if(!sorted.length){h+=`<div class="emp" style="padding:30px;text-align:center;color:var(--muted)">No hay transmisiones registradas</div></div>`;return h;}
  h+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">`;
  sorted.forEach(ev=>{
    const ytM=(ev.youtubeUrl||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([A-Za-z0-9_-]{11})/);
    h+=`<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:transform .15s,border-color .15s" onmouseover="this.style.transform='translateY(-2px)';this.style.borderColor='var(--gold)'" onmouseout="this.style.transform='';this.style.borderColor='var(--border)'">`;
    if(ytM){
      h+=`<div style="aspect-ratio:16/9;background:#000;position:relative">`;
      h+=`<img src="https://i.ytimg.com/vi/${ytM[1]}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`;
      h+=`<a href="${ev.youtubeUrl}" target="_blank" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);text-decoration:none">`;
      h+=`<div style="width:60px;height:60px;border-radius:50%;background:rgba(196,30,58,.95);display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;box-shadow:0 4px 12px rgba(0,0,0,.5)"><i class=yl-i-reproducir></i></div>`;
      h+=`</a>`;
      if(ev.streamLogoUrl)h+=`<div style="position:absolute;right:8px;bottom:8px;width:58px;height:58px;display:flex;align-items:center;justify-content:center;pointer-events:none"><img src="${ev.streamLogoUrl}" style="max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7))"></div>`;
      h+=`</div>`;
    }
    h+=`<div style="padding:14px"><div style="font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:.5px;color:var(--text);margin-bottom:6px;text-transform:uppercase">${ev.name}${ev._dia?` <span style="color:var(--gold)">· ${ev._dia}</span>`:''}</div>`;
    h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${ev.organizer||ev.org||'FECHIPO'} · ${ev.location||''} · ${ev.days||ev.date||''}</div>`;
    h+=`<a href="${ev.youtubeUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#FF0000;color:#fff;padding:6px 12px;border-radius:6px;font-family:Oswald;font-size:11px;font-weight:600;letter-spacing:1px;text-decoration:none"><i class=yl-i-reproducir></i> VER EN YOUTUBE</a>`;
    const igRaw=(ev.streamInstagram||ev.instagram||'').trim();
    if(igRaw){
      const isUrl=/^https?:\/\//i.test(igRaw);
      const handle=igRaw.replace(/^@/,'').replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/\/+$/,'');
      const href=isUrl?igRaw:('https://instagram.com/'+handle);
      h+=`<a href="${href}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;margin-left:8px;background:linear-gradient(45deg,#f09433,#dc2743,#bc1888);color:#fff;padding:6px 12px;border-radius:6px;font-family:Oswald;font-size:11px;font-weight:600;letter-spacing:1px;text-decoration:none">@${handle}</a>`;
    }
    h+=`</div></div>`;
  });
  h+=`</div></div>`;
  return h;
}

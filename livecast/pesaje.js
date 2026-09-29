// livecast.html — Atletas & Pesaje: el padrón del campeonato, pesaje, agregar atletas, fotos, marcas nominadas y lotes.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// ── Agregar atleta manualmente (atletas internacionales / altas de último momento) ──
function openAddAthlete(){
  const ex=document.getElementById('addAthModal');if(ex)ex.remove();
  const flights=TARIMA?FL_LETTERS.map(L=>L+TARIMA):FL_LETTERS.slice();
  const inp='padding:9px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:14px';
  const lbl='display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)';
  const m=document.createElement('div');m.id='addAthModal';
  m.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999';
  m.innerHTML=`
  <div style="background:#0D1F38;border:2px solid var(--border);border-radius:16px;padding:24px 28px;width:min(620px,94vw);max-height:92vh;overflow-y:auto">
    <div style="font-family:Oswald;font-size:18px;font-weight:700;letter-spacing:2px;margin-bottom:4px">AGREGAR ATLETA</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:18px">Para altas manuales (ej. atletas de otros países en un internacional). No toca la nómina pública.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <label style="${lbl};grid-column:1 / -1">NOMBRE COMPLETO<input id="aa_name" type="text" placeholder="Nombre y apellidos" style="${inp}"></label>
      <label style="${lbl}">PAÍS<select id="aa_country" style="${inp}">${_countryOptions('CHI')}</select></label>
      <label style="${lbl}">SEXO<select id="aa_sex" style="${inp}"><option value="Hombre">Hombre</option><option value="Mujer">Mujer</option></select></label>
      <label style="${lbl}">CATEGORÍA (kg)<input id="aa_cat" type="text" placeholder="ej: 83 o +120" style="${inp}"></label>
      <label style="${lbl}">DIVISIÓN<select id="aa_div" style="${inp}">
        <option>Open</option><option>Sub-Junior</option><option>Junior</option>
        <option>Master I</option><option>Master II</option><option>Master III</option><option>Master IV</option></select></label>
      <label style="${lbl}">MODALIDAD<select id="aa_mod" style="${inp}">
        <option value="classic">Classic (Raw)</option><option value="equipped">Equipado</option>
        <option value="oe_classic">Olimpiadas Especiales (OE)</option><option value="universitario">Universitario</option>
        <option value="classic_uni">Classic + Universitario</option>
        <option value="onlybench">Only Bench</option><option value="classic_bench">Classic + Only Bench</option>
        <option value="equipped_bench">Equipado + Only Bench</option></select></label>
      <label style="${lbl}">CLUB / EQUIPO<input id="aa_club" type="text" placeholder="Club" style="${inp}"></label>
      <label style="${lbl}">TANDA / VUELO<select id="aa_flight" style="${inp}">${flights.map(f=>'<option>'+f+'</option>').join('')}</select></label>
    </div>
    <div id="aa_alert" style="display:none;background:rgba(196,30,58,.15);border:1px solid var(--accent);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--accent);font-family:Oswald"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button onclick="document.getElementById('addAthModal').remove()" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;cursor:pointer">CANCELAR</button>
      <button onclick="confirmAddAthlete()" style="padding:10px 24px;border-radius:8px;border:none;background:var(--green);color:#000;font-family:Oswald;font-size:13px;font-weight:700;cursor:pointer"><i class=yl-i-check></i> AGREGAR</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  setTimeout(()=>{const el=document.getElementById('aa_name');if(el)el.focus();},50);
}

function confirmAddAthlete(){
  const g=id=>document.getElementById(id);
  const name=(g('aa_name').value||'').trim();
  const alertEl=g('aa_alert');
  if(name.length<3){alertEl.style.display='block';alertEl.textContent='Ingresa el nombre del atleta';return;}
  const country=(g('aa_country').value||'CHI');
  const newId=DATA.athletes.length?Math.max(...DATA.athletes.map(a=>a.id))+1:0;
  const newLot=DATA.athletes.length?Math.max(...DATA.athletes.map(a=>a.lot||0))+1:1;
  DATA.athletes.push({
    id:newId, lot:newLot, name, rut:'', sex:g('aa_sex').value,
    cat:(g('aa_cat').value||'').trim(), div:g('aa_div').value, club:(g('aa_club').value||'').trim(),
    uni:'', mod:g('aa_mod').value, country,
    bw:0, flight:g('aa_flight').value, rackSQ:'', rackBP:'', bombed:false,
    att:{sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]}
  });
  _aplicarModalidad(DATA.athletes[DATA.athletes.length-1],g('aa_mod').value);
  saveNow();
  document.getElementById('addAthModal').remove();
  showToastLC(name+' agregado · '+_ctryName(country));
  R();
}

function _rutKey(r){ return String(r||'').replace(/[^0-9kK]/gi,'').toUpperCase(); }

function _adminFotoFor(a){ const r=_rutKey(a&&a.rut); return (r&&window._ADMIN_FOTOS_BY_RUT[r])||null; }

function _nsudaSlugLC(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,'-').slice(0,80);
}

function _fotoSudaFor(a){
  // Son fotos de extranjeros: en un campeonato de un solo país no hace falta
  // bajarlas (son 544 documentos). Se piden la primera vez que se buscan.
  if(!window._nsudaFotosLC){ if(!_variosPaises())return null; _cargarFotosSuda(); }
  const u=window.NSUDA_FOTOS_LC[_nsudaSlugLC(a&&a.name)];
  return u?{foto_url:u}:null;
}

function _cargarMarcasSuda(){
  if(window.NSUDA_MARCAS||_nsudaMarcasPidiendo)return;
  _nsudaMarcasPidiendo=true;
  fetch('nomina_sudamericano.json?v='+Date.now()).then(r=>r.json()).then(d=>{
    const m={};
    (d&&d.atletas||[]).forEach(a=>{
      const k=_nsudaSlugLC(a.nDisp||a.n);
      if(!k)return;
      // Un atleta puede estar en dos modalidades; se guarda la de mayor total,
      // que es la que la gente reconoce como "su" marca.
      if(!m[k]||(a.total||0)>(m[k].total||0))
        m[k]={sq:_marcaSana(a.sq,a.total),bp:_marcaSana(a.bp,a.total),
              dl:_marcaSana(a.dl,a.total),total:a.total||0,mod:a.mod||'',pais:a.pais||''};
    });
    window.NSUDA_MARCAS=m;
    if(typeof R==='function')R();
  }).catch(e=>{window.NSUDA_MARCAS={};console.warn('[livecast] marcas de la nómina:',e.message);});
}

// Una marca nominada NO puede ser mayor que el total declarado: el total es la
// suma de los tres levantamientos, así que ninguno solo puede pasarlo. Cuando
// pasa es un dedo de más al tipear.
//
// Salió de la nómina de FESUPO: José Manuel Conejera venía con 1125.5 en banca
// —son 112.5— y con eso se publicó una lámina del día 4 antes de que alguien lo
// notara. La suma NO sirve de control: las marcas nominadas son la mejor
// sentadilla, la mejor banca y el mejor peso muerto de su carrera, y el mejor
// total de una competencia, así que casi nunca cuadran entre sí —hay veinte
// atletas con diferencias de medio kilo a cincuenta, y todas son legítimas—.
// Lo que sí es imposible es que un solo movimiento pase al total.
function _marcaSana(v,total){
  v=+v||0; total=+total||0;
  return (total>0&&v>total)?0:v;
}

function _marcasSudaFor(a){
  if(!window.NSUDA_MARCAS)return null;
  const m=window.NSUDA_MARCAS[_nsudaSlugLC(a&&a.name)];
  return (m&&(m.sq||m.bp||m.dl||m.total))?m:null;
}

function _cargarFotosSuda(){
  if(!fbReady||!window._fb||!fbDB||window._nsudaFotosLC)return;
  window._nsudaFotosLC=true;
  try{
    window._fb.getDocs(window._fb.collection(fbDB,'nomina_suda_fotos')).then(snap=>{
      snap.docs.forEach(d=>{const v=d.data();if(v&&v.foto_url)window.NSUDA_FOTOS_LC[d.id]=v.foto_url;});
      const n=Object.keys(window.NSUDA_FOTOS_LC).length;
      if(n){console.log('[livecast] fotos del Sudamericano:',n);
        if(typeof renderTxWidget==='function')renderTxWidget();
        if(typeof R==='function')R();}
    }).catch(e=>console.warn('[livecast] nomina_suda_fotos:',e.message));
  }catch(e){console.warn('[livecast] nomina_suda_fotos:',e.message);}
}

function _mediaKey(a){
  const rut=String((a&&a.rut)||'').replace(/[^0-9kK]/gi,'').toUpperCase();
  if(rut) return 'lc_rut_'+rut;
  const nm=String((a&&a.name)||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  return 'lc_'+_ctry(a).toLowerCase()+'_'+nm;
}

// Foto/GIF efectivos de un atleta: base = foto de inscripción aprobada en Admin
// (si existe), y encima se superpone lo que se haya subido puntualmente desde
// livecast (foto o GIF distinto para la transmisión), si lo hay.
function _lcMediaFor(a){
  const own=(a&&window._LC_MEDIA[_mediaKey(a)])||null;
  // Orden: lo que se subió puntualmente desde livecast > la foto del perfil (por
  // RUT) > la foto de la nómina del Sudamericano (por nombre).
  const admin=_adminFotoFor(a)||_fotoSudaFor(a);
  if(!own&&!admin)return null;
  const merged=Object.assign({},admin?{foto_url:admin.foto_url}:{},own||{});
  if(!merged.foto_url&&admin&&admin.foto_url)merged.foto_url=admin.foto_url;
  return merged;
}

function _setupLcMediaListener(){
  if(!fbReady||!window._fb||!fbDB||window._lcMediaUnsub)return;
  // Logos de clubes desde admin
  try{
    if(!window._lcClubsUnsub){
      window._lcClubsUnsub=window._fb.onSnapshot(window._fb.collection(fbDB,'clubs'),snap=>{
        window._CLUBS_FS={};
        snap.docs.forEach(d=>{const v=d.data();if(v.slug&&v.logoUrl)window._CLUBS_FS[v.slug]=v;});
      });
    }
  }catch(e){}
  window._lcMediaUnsub=true;
}

// La foto o GIF propio del livecast (docs lc_*) y la foto aprobada en el panel,
// por RUT. Sale del mismo oyente de atleta_fotos que las fotos del padrón.
function _fotosAlLivecast(snap){
  snap.docs.forEach(d=>{
    const data=d.data();
    if(String(d.id).indexOf('lc_')===0){ window._LC_MEDIA[d.id]=data; return; }
    const r=_rutKey(data.rut);
    if(r&&data.foto_url&&data.status!=='rejected')window._ADMIN_FOTOS_BY_RUT[r]={foto_url:data.foto_url};
  });
}

function openAthleteMedia(id){
  _pedirFotos();
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  const m0=_lcMediaFor(a)||{};
  const ex=document.getElementById('athMediaModal');if(ex)ex.remove();
  const m=document.createElement('div');m.id='athMediaModal';
  m.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;z-index:9999';
  const prev=(u,isVid)=>u?(isVid?'<video src="'+u+'" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover"></video>':'<img src="'+u+'" style="width:100%;height:100%;object-fit:cover">'):'<span style="color:var(--muted);font-size:11px;font-family:Oswald">sin imagen</span>';
  m.innerHTML=`
  <div style="background:#0D1F38;border:2px solid var(--border);border-radius:16px;padding:24px 28px;width:min(560px,94vw);max-height:92vh;overflow-y:auto">
    <div style="font-family:Oswald;font-size:18px;font-weight:700;letter-spacing:2px;margin-bottom:4px">FOTO / GIF</div>
    <div style="font-size:12px;color:var(--gold);font-family:Oswald;margin-bottom:4px">${_insignia(a,16)}${a.name}</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:16px">Se guarda y se reutiliza automáticamente si el atleta vuelve a competir.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:10px;color:var(--gold);font-family:Oswald;letter-spacing:1px;margin-bottom:6px">FOTO (imagen)</div>
        <div id="amPrevFoto" style="aspect-ratio:3/4;background:#0a1628;border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px">${prev(m0.foto_url,false)}</div>
        <input id="amFoto" type="file" accept="image/*" onchange="uploadAthleteMedia(${id},'foto',this.files[0])" style="font-size:11px;color:var(--muted);width:100%">
      </div>
      <div>
        <div style="font-size:10px;color:var(--gold);font-family:Oswald;letter-spacing:1px;margin-bottom:6px">GIF / VIDEO (animado)</div>
        <div id="amPrevGif" style="aspect-ratio:3/4;background:#000;border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px">${prev(m0.gif_url,!(String(m0.gif_url||'').toLowerCase().endsWith('.gif')))}</div>
        <input id="amGif" type="file" accept="video/*,image/gif" onchange="uploadAthleteMedia(${id},'gif',this.files[0])" style="font-size:11px;color:var(--muted);width:100%">
      </div>
    </div>
    <div id="amStatus" style="font-size:11px;color:var(--muted);font-family:Oswald;margin-top:12px;min-height:16px"></div>
    <div style="display:flex;gap:10px;justify-content:space-between;margin-top:12px">
      <button onclick="removeAthleteMedia(${id})" style="padding:8px 14px;border-radius:8px;border:1px solid var(--red);background:transparent;color:var(--red);font-family:Oswald;font-size:11px;cursor:pointer">Quitar todo</button>
      <button onclick="document.getElementById('athMediaModal').remove()" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-family:Oswald;cursor:pointer">CERRAR</button>
    </div>
  </div>`;
  document.body.appendChild(m);
}

async function uploadAthleteMedia(id,kind,file){
  if(!file)return;
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(!window._fbSt||!window._fbStInst){alert('Storage no disponible todavía, espera un momento');return;}
  if(!isAdmin){alert('Solo admin puede subir fotos');return;}
  const st=document.getElementById('amStatus');if(st)st.textContent='Subiendo…';
  try{
    const {ref,uploadBytes,getDownloadURL}=window._fbSt;
    const key=_mediaKey(a);
    const dot=file.name.lastIndexOf('.');const ext=(dot>=0?file.name.slice(dot+1):'').toLowerCase()||(kind==='foto'?'jpg':'mp4');
    const folder=kind==='foto'?'athlete_photos/':'athlete_gifs/';
    const path=folder+key+'_'+Date.now()+'.'+ext;
    const r=ref(window._fbStInst,path);
    await uploadBytes(r,file,{contentType:file.type||(kind==='foto'?'image/jpeg':'video/mp4')});
    const url=await getDownloadURL(r);
    const patch=kind==='foto'?{foto_url:url}:{gif_url:url};
    await window._fb.setDoc(window._fb.doc(fbDB,'atleta_fotos',key),Object.assign({codigo:key,name:a.name,country:_ctry(a),ts:Date.now()},patch),{merge:true});
    window._LC_MEDIA[key]=Object.assign({},window._LC_MEDIA[key]||{},patch);
    if(st)st.textContent='Guardado';
    // refrescar preview
    const isVid=kind==='gif'&&!String(url).toLowerCase().endsWith('.gif');
    const pv=document.getElementById(kind==='foto'?'amPrevFoto':'amPrevGif');
    if(pv)pv.innerHTML=isVid?'<video src="'+url+'" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover"></video>':'<img src="'+url+'" style="width:100%;height:100%;object-fit:cover">';
    R();
  }catch(e){if(st)st.textContent=''+e.message; console.warn('[lc-media] upload',e);}
}

async function removeAthleteMedia(id){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(!confirm('¿Quitar la foto/gif de '+a.name+'?'))return;
  try{
    const key=_mediaKey(a);
    await window._fb.setDoc(window._fb.doc(fbDB,'atleta_fotos',key),{foto_url:'',gif_url:'',ts:Date.now()},{merge:true});
    delete window._LC_MEDIA[key];
    (__o=>__o==null?void 0:__o.remove())(document.getElementById('athMediaModal'));
    showToastLC('Foto/gif quitada de '+a.name);R();
  }catch(e){alert('Error: '+e.message);}
}

function openWeighIn(id){
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  const catKg=parseFloat((a.cat||'').replace(/[^0-9.]/g,''))||0;
  // Categorías "+120", "120+", "+84" → SIN límite superior (atleta debe pesar MÁS que el número)
  const isPlusCat=(a.cat||'').includes('+');
  const limit=isPlusCat?null:(CAT_LIMITS[String(catKg)]||catKg||null);
  // Remove any existing modal
  const ex=document.getElementById('weighInModal');if(ex)ex.remove();
  const m=document.createElement('div');m.id='weighInModal';
  m.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999';
  const sq1 = (a.att==null?void 0:(a.att.sq==null?void 0:(a.att.sq[0]==null?void 0:a.att.sq[0].w))) || '';
  const bp1 = (a.att==null?void 0:(a.att.bp==null?void 0:(a.att.bp[0]==null?void 0:a.att.bp[0].w))) || '';
  const dl1 = (a.att==null?void 0:(a.att.dl==null?void 0:(a.att.dl[0]==null?void 0:a.att.dl[0].w))) || '';
  m.innerHTML=`
  <div style="background:#0D1F38;border:2px solid var(--border);border-radius:16px;padding:24px 28px;width:min(560px,94vw);max-height:92vh;overflow-y:auto">
    <div style="font-family:Oswald;font-size:18px;font-weight:700;letter-spacing:2px;margin-bottom:4px">PESAJE</div>
    <div style="font-size:13px;color:var(--gold);font-family:Oswald;margin-bottom:18px">${a.name} · ${a.cat} · ${a.div}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)">
        PESO CORPORAL (kg)
        <input id="wi_bw" type="text" inputmode="decimal" value="${a.bw||''}" placeholder="0.00" data-wi-next="wi_rackSQ" oninput="this.value=this.value.replace(',','.')"
          style="padding:10px;border-radius:8px;border:2px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:18px;font-weight:700;text-align:center">
        ${limit?`<span id="wi_bw_status" style="font-size:10px;color:var(--muted)">Límite categoría: ${limit} kg</span>`:(isPlusCat&&catKg?`<span id="wi_bw_status" style="font-size:10px;color:var(--muted)">Categoría +${catKg} kg (debe pesar más de ${catKg} kg)</span>`:'')}
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)">
        EQUIPO / MODALIDAD
        <select id="wi_mod" style="padding:9px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:13px">
          <option value="classic" ${a.mod==='classic'&&!_isPlusUni(a)&&!/univ/i.test(a.div||'')?'selected':''}>Classic (Raw)</option>
          <option value="classic_uni" ${_isPlusUni(a)?'selected':''}>Classic + Universitario</option>
          <option value="equipped" ${a.mod==='equipped'?'selected':''}>Equipado</option>
          <option value="oe_classic" ${a.mod==='oe_classic'?'selected':''}>Olimpiadas Especiales (OE)</option>
          <option value="universitario" ${a.mod==='universitario'||(a.mod==='classic'&&/univ/i.test(a.div||''))?'selected':''}>Universitario</option>
          <option value="onlybench" ${a.mod==='onlybench'?'selected':''}>Only Bench</option>
          <option value="classic_bench" ${a.mod==='classic_bench'?'selected':''}>Classic + Only Bench</option>
          <option value="equipped_bench" ${a.mod==='equipped_bench'?'selected':''}>Equipado + Only Bench</option>
          <option value="invitado" ${a.mod==='invitado'?'selected':''}>Invitado/a (fuera de competencia)</option>
        </select>
        ${a.mod==='invitado'?'<span style="font-size:10px;color:var(--gold)">Levanta igual, pero no entra al ranking de su categoría.</span>':''}
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)">
        PAÍS
        <select id="wi_country" style="padding:9px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:13px">${_countryOptions(_ctry(a))}</select>
      </label>
    </div>
    <div style="font-size:10px;color:var(--gold);letter-spacing:1.5px;margin-bottom:6px;font-family:Oswald;font-weight:700">SENTADILLA</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)">
        ALTURA RACK
        <input id="wi_rackSQ" type="text" value="${a.rackSQ||''}" placeholder="ej: 14" data-wi-next="wi_rackBP"
          style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:14px;text-align:center">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)">
        ABATIBLE (soportes)
        <select id="wi_sqAbat" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:13px">
          ${[['','No'],['izq','Izquierdo'],['der','Derecho'],['ambos','Ambos']].map(o=>`<option value="${o[0]}"${(a.sqAbat||'')===o[0]?' selected':''}>${o[1]}</option>`).join('')}
        </select>
      </label>
    </div>
    <div style="font-size:10px;color:var(--gold);letter-spacing:1.5px;margin-bottom:6px;font-family:Oswald;font-weight:700">PRESS DE BANCA</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)">
        ALTURA RACK
        <input id="wi_rackBP" type="text" value="${a.rackBP||''}" placeholder="ej: 7" data-wi-next="wi_bpSeg"
          style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:14px;text-align:center">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)">
        ALT. SEGUROS
        <input id="wi_bpSeg" type="text" value="${a.bpSeg||''}" placeholder="—" data-wi-next="wi_bpPalm"
          style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:14px;text-align:center">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)">
        PALMETAS
        <input id="wi_bpPalm" type="text" inputmode="numeric" value="${a.bpPalm||''}" placeholder="0" data-wi-next="wi_sq1"
          style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:14px;text-align:center">
      </label>
    </div>
    <div style="font-size:10px;color:var(--gold);letter-spacing:1.5px;margin-bottom:6px;font-family:Oswald;font-weight:700">PRIMEROS INTENTOS (apertura)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:${LIFT_C['sq']}">
        SQ 1 (kg)
        <input id="wi_sq1" type="text" inputmode="decimal" value="${sq1||''}" placeholder="—" data-wi-next="wi_bp1" oninput="this.value=this.value.replace(',','.')"
          style="padding:9px;border-radius:6px;border:1px solid ${LIFT_C['sq']};background:var(--bg);color:var(--text);font-family:Oswald;font-size:15px;font-weight:700;text-align:center">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:${LIFT_C['bp']}">
        BP 1 (kg)
        <input id="wi_bp1" type="text" inputmode="decimal" value="${bp1||''}" placeholder="—" data-wi-next="wi_dl1" oninput="this.value=this.value.replace(',','.')"
          style="padding:9px;border-radius:6px;border:1px solid ${LIFT_C['bp']};background:var(--bg);color:var(--text);font-family:Oswald;font-size:15px;font-weight:700;text-align:center">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:${LIFT_C['dl']}">
        DL 1 (kg)
        <input id="wi_dl1" type="text" inputmode="decimal" value="${dl1||''}" placeholder="—" data-wi-next="wi_confirm_btn" oninput="this.value=this.value.replace(',','.')"
          style="padding:9px;border-radius:6px;border:1px solid ${LIFT_C['dl']};background:var(--bg);color:var(--text);font-family:Oswald;font-size:15px;font-weight:700;text-align:center">
      </label>
    </div>
    <div id="wi_alert" style="display:none;background:rgba(196,30,58,.15);border:1px solid var(--accent);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--accent);font-family:Oswald;letter-spacing:1px"></div>
    <div style="display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap">
      ${a.weighedIn||a.bw>0?`<button onclick="clearWeighIn(${id})" style="padding:8px 14px;border-radius:8px;border:1px solid var(--red);background:transparent;color:var(--red);font-family:Oswald;font-size:11px;cursor:pointer" title="Borrar BW + racks + intentos">BORRAR PESAJE</button>`:'<span></span>'}
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('weighInModal').remove()" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;cursor:pointer">CANCELAR</button>
        <button id="wi_confirm_btn" onclick="confirmWeighIn(${id},${catKg},${limit||0})" style="padding:10px 24px;border-radius:8px;border:none;background:var(--green);color:#000;font-family:Oswald;font-size:13px;font-weight:700;cursor:pointer"><i class=yl-i-check></i> CONFIRMAR PESAJE</button>
      </div>
    </div>
    <div style="text-align:center;margin-top:10px;font-size:10px;color:var(--muted)">Usa <kbd style="background:var(--bg);padding:1px 6px;border-radius:3px;border:1px solid var(--border);font-family:monospace">Enter</kbd> para avanzar al siguiente campo</div>
  </div>`;
  document.body.appendChild(m);
  // Auto-focus en BW
  setTimeout(()=>{const el=document.getElementById('wi_bw');if(el){el.focus();el.select();}},50);
  // Enter avanza al siguiente campo (data-wi-next)
  m.querySelectorAll('[data-wi-next]').forEach(el=>{
    el.addEventListener('keydown',function(ev){
      if(ev.key!=='Enter')return;
      ev.preventDefault();
      const next=document.getElementById(this.dataset.wiNext);
      if(!next)return;
      if(next.tagName==='BUTTON'){next.focus();next.click();}
      else{next.focus();if(next.select)next.select();}
    });
  });
  // Live BW check
  document.getElementById('wi_bw').addEventListener('input',function(){
    this.value=this.value.replace(',','.');
    const v=parseWeight(this.value);
    const st=document.getElementById('wi_bw_status');
    if(!st)return;
    if(limit){
      // Categoría normal: máximo permitido = limit
      if(v>limit){st.textContent=''+v+'kg EXCEDE el límite de '+limit+'kg';st.style.color='var(--red)';}
      else if(v>0){st.textContent=v+'kg dentro del límite ('+limit+'kg)';st.style.color='var(--green)';}
      else{st.textContent='Límite categoría: '+limit+' kg';st.style.color='var(--muted)';}
    } else if(isPlusCat && catKg){
      // Categoría "+X": el atleta DEBE pesar más que X
      if(v>0 && v<=catKg){st.textContent=''+v+'kg NO califica para +'+catKg+'kg (debe pesar más de '+catKg+'kg)';st.style.color='var(--red)';}
      else if(v>catKg){st.textContent=v+'kg califica para +'+catKg+'kg';st.style.color='var(--green)';}
      else{st.textContent='Categoría +'+catKg+' kg (debe pesar más de '+catKg+' kg)';st.style.color='var(--muted)';}
    }
  });
}

function confirmWeighIn(id,catKg,limit){
  const bw=parseWeight(document.getElementById('wi_bw').value);
  const rSQ=(document.getElementById('wi_rackSQ').value||'').trim();
  const rBP=(document.getElementById('wi_rackBP').value||'').trim();
  const _v=id=>{const e=document.getElementById(id);return e?(e.value||'').trim():'';};
  const sqAbat=_v('wi_sqAbat');                       // '' | izq | der | ambos
  const bpSeg=_v('wi_bpSeg');                         // altura de los seguros de banca
  const bpPalm=(parseInt(_v('wi_bpPalm'),10)||0)||''; // 0 → vacío (no se muestra)
  const mod=document.getElementById('wi_mod').value;
  const country=((__o=>__o==null?void 0:__o.value)(document.getElementById('wi_country'))||'CHI');
  const sq1=parseWeight((__o=>__o==null?void 0:__o.value)(document.getElementById('wi_sq1')));
  const bp1=parseWeight((__o=>__o==null?void 0:__o.value)(document.getElementById('wi_bp1')));
  const dl1=parseWeight((__o=>__o==null?void 0:__o.value)(document.getElementById('wi_dl1')));
  const alertEl=document.getElementById('wi_alert');
  // Validate BW > 0
  if(!bw){alertEl.style.display='block';alertEl.textContent='Ingresa el peso corporal';return;}
  // Re-derivar si es categoría "+" (sin límite superior)
  const _a=DATA.athletes.find(x=>x.id===id);
  const _isPlusCat=_a&&(_a.cat||'').includes('+');
  // Warn según el tipo de categoría
  if(_isPlusCat && catKg>0 && bw<=catKg){
    if(!confirm('El peso '+bw+'kg NO califica para la categoría +'+catKg+'kg (debe pesar más de '+catKg+'kg).\n¿Confirmar igualmente?'))return;
  } else if(!_isPlusCat && limit>0 && bw>limit){
    if(!confirm('El peso '+bw+'kg EXCEDE el límite de la categoría ('+limit+'kg).\n¿El atleta compite fuera de categoría o el jurado aprobó? Confirmar igualmente.'))return;
  }
  // Save
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  a.bw=bw;a.rackSQ=rSQ;a.rackBP=rBP;a.sqAbat=sqAbat;a.bpSeg=bpSeg;a.bpPalm=bpPalm;a.country=country;
  _aplicarModalidad(a,mod);
  _markAtt(id,'meta');
  a.weighedIn=true;
  // Guardar primeros intentos (apertura) si vinieron en el modal.
  // Cada celda que se toca hay que MARCARLA: el merge de escritura parte del
  // estado remoto y solo le pega encima las celdas marcadas. Sin la marca, la
  // apertura cargada acá se perdía — el BW y las alturas de rack sí subían
  // (van en 'meta'), pero los primeros intentos no llegaban ni al público ni a
  // la pantalla de tarima, y al recargar la página desaparecían.
  if(a.att){
    if(sq1>0 && a.att.sq && a.att.sq[0] && a.att.sq[0].r===null){ a.att.sq[0].w = sq1; _markAtt(id,'att_sq_0'); }
    if(bp1>0 && a.att.bp && a.att.bp[0] && a.att.bp[0].r===null){ a.att.bp[0].w = bp1; _markAtt(id,'att_bp_0'); }
    if(dl1>0 && a.att.dl && a.att.dl[0] && a.att.dl[0].r===null){ a.att.dl[0].w = dl1; _markAtt(id,'att_dl_0'); }
  }
  saveNow();
  document.getElementById('weighInModal').remove();
  R();
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// VOLVER A CARGAR LA N\u00d3MINA
//
// Una n\u00f3mina cambia despu\u00e9s de cargada: una federaci\u00f3n manda su lista final y
// entra uno, salen cuatro, a otro le corrigen el lote. Hasta ac\u00e1 eso no ten\u00eda
// arreglo: la n\u00f3mina se lee de nominas.json UNA sola vez, al elegir el
// campeonato, y de ah\u00ed en adelante manda el documento de Firestore. Volver a
// elegir el campeonato tampoco serv\u00eda \u2014 el primer snapshot del servidor rearma
// el roster con el viejo, porque el merge se construye sobre el remoto.
// Quedaba editar a mano, de a uno, sobre cuatrocientos atletas.
//
// Esto vuelve a leer el archivo y reemplaza el roster, pero NO pisa lo que ya
// se hizo en tarima: a quien sigue en la n\u00f3mina se le conservan el peso
// corporal, los racks, los intentos y el bombed. La tanda y el lote s\u00ed salen
// del archivo, que es justamente lo que se viene a corregir.
//
// Se avisa qui\u00e9n entra y qui\u00e9n sale ANTES de tocar nada, y si alguno de los que
// salen ya tiene algo cargado se dice aparte: sacar a alguien que ya compiti\u00f3
// casi siempre es un error de quien manda la lista, y conviene mirarlo dos veces.
function _nomAplica(){
  return !!(DATA.event && (DATA.event.id || DATA.event.name));
}

function generateLots(){
  const msg=DATA.lotsGenerated
    ? 'Los lotes YA fueron sorteados.\n\n¿Re-sortear y reemplazar todos los números actuales?\n\nLas ediciones manuales se perderán.'
    : '¿Generar números de lote aleatorios?\n\nTanda A → 100, 101, 102…\nTanda B → 200, 201, 202…\netc.';
  if(!confirm(msg))return;
  // Shuffle within each flight, assign lot = flightIndex*100 + position (Tanda A: 100-1XX, B: 200-2XX...)
  const flights=[...new Set(DATA.athletes.map(a=>a.flight))].filter(_inTarima).sort(_cmpFl);
  flights.forEach((fl,fi)=>{
    const flightNum=fl.charCodeAt(0)-64; // A=1, B=2, C=3…
    const base=flightNum*100;
    const group=DATA.athletes.filter(a=>a.flight===fl);
    // Fisher-Yates shuffle
    for(let i=group.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[group[i]._rnd,group[j]._rnd]=[group[j]._rnd||Math.random(),group[i]._rnd||Math.random()]}
    group.sort((a,b)=>(a._rnd||0)-(b._rnd||0));
    group.forEach((a,pos)=>{a.lot=base+pos;delete a._rnd});
  });
  DATA.lotsGenerated=true;
  window._forceFullWrite=true;   // el re-sorteo reemplaza los lots de todos
  saveNow();R();
}

function _manNorm(x){ return String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

// Busca por nombre, club, país, categoría o lote. Todas las palabras tienen que
// aparecer en algún lado, así "juan 83" encuentra al Juan de la -83.
function _manCoincide(a,q){
  if(!q)return true;
  const heno=_manNorm([a.name,a.club,_ctry(a),a.cat,a.div,a.lot].join(' '));
  return _manNorm(q).split(/\s+/).filter(Boolean).every(w=>heno.indexOf(w)>=0);
}

function renderManage(){
  _pedirFotos();
  // Filtrar por tarima si está activo (modo 2 tarimas)
  const ath=TARIMA?DATA.athletes.filter(a=>_inTarima(a.flight)):DATA.athletes;
  let h='<div class="fade"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px"><div><h2 class="os" style="font-size:22px;letter-spacing:1px">ATLETAS & PESAJE'+(TARIMA?' · TARIMA '+TARIMA:'')+'</h2><p style="color:var(--muted);font-size:12px">'+ath.filter(a=>a.bw>0).length+'/'+ath.length+' pesados'+(function(){const n=ath.filter(_isPlusBench).length;return n?' \u00b7 '+n+' compiten tambi\u00e9n en Only Bench':'';})()+'</p></div><div style="display:flex;gap:6px;flex-wrap:wrap">'+(DATA.lotsGenerated?'<button class="btn btn-o" onclick="generateLots()" title="Re-sortear todos los lotes al azar (reemplaza los actuales)">Re-sortear lotes</button>':'<button class="btn btn-r" onclick="generateLots()">Generar Lotes</button>')+'<button class="btn btn-o" onclick="resyncFromAdmin()" title="Re-sincronizar nómina con admin: trae cambios, borra eliminados sin datos y toma tanda, división, categoría y modalidad del Cronograma">Re-sincronizar con admin</button><button class="btn" onclick="openAddAthlete()" title="Agregar un atleta manualmente (ej. atletas internacionales)" style="background:rgba(34,197,94,.15);border-color:var(--green);color:var(--green)">Agregar atleta</button><button class="btn btn-o" onclick="sortByLot()">Ordenar por Lote ↑</button><button class="btn btn-o" onclick="sortByFlight()">Ordenar por Tanda ↑</button><button class="btn btn-o" onclick="sortByCat()">Ordenar por Categoría ↑</button><button class="btn btn-o" onclick="go(\'docs\')" title="Hoja de pesaje, altura de rack, revisión de equipo y papeletas" style="border-color:rgba(212,168,67,.55);color:var(--gold)"><i class=yl-i-archivo></i> Documentos</button><button class="btn btn-g" onclick="go(\'compete\')">Iniciar Competencia →</button></div></div>';
    // ── Barra de búsqueda y tandas ────────────────────────────────────────────
  {
    const _mf0=window._MAN_F||{q:'',flight:''};
    const _tandas=[...new Set(ath.map(a=>a.flight))].filter(Boolean).sort(_cmpFl);
    const _vis=ath.filter(a=>(!_mf0.flight||a.flight===_mf0.flight)&&_manCoincide(a,_mf0.q)).length;
    const _activo=!!(_mf0.q||_mf0.flight);
    h+='<div class="card" style="padding:12px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">';
    h+='<input id="manQ" type="text" value="'+esc(_mf0.q)+'" oninput="manBuscar(this.value)" placeholder="Buscar por nombre, club, país, categoría o lote…" '
      +'style="flex:1;min-width:240px;padding:9px 12px;border-radius:8px;border:1px solid '+(_mf0.q?'var(--gold)':'var(--border)')+';background:var(--bg);color:var(--text);font-size:13px">';
    const _fdMan=_filaDias('pesaje',_tandas,_diaDeTanda(DATA.flight));
    if(_tandas.length>1){
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;width:100%">'+_fdMan.html+'</div>';
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">';
      h+='<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-right:2px">TANDA</span>';
      _fdMan.tandas.forEach(f=>{
        const on=_mf0.flight===f, col=FL_C[f]||'var(--muted)';
        const n=ath.filter(a=>a.flight===f).length;
        h+='<button onclick="manTanda(\''+f+'\')" title="'+n+' atletas" style="min-width:34px;padding:6px 7px;border-radius:6px;border:2px solid '
          +(on?col:'var(--border)')+';background:'+(on?col+'22':'transparent')+';color:'+(on?col:'var(--muted)')
          +';font-family:Oswald;font-size:12px;font-weight:700;cursor:pointer">'+f+'</button>';
      });
      h+='</div>';
    }
    if(_activo)h+='<button onclick="manLimpiar()" style="padding:8px 13px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-family:Oswald;font-size:11px;letter-spacing:.5px;cursor:pointer">Limpiar</button>';
    h+='<span style="font-size:11px;color:'+(_activo?'var(--gold)':'var(--muted)')+';margin-left:auto;white-space:nowrap">'
      +(_activo?('mostrando '+_vis+' de '+ath.length):(ath.length+' atletas'))+'</span>';
    h+='</div>';
  }
h+='<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:2px solid var(--border)">';
  h+='<th class="os" style="padding:8px 4px;text-align:center;color:var(--muted);font-size:9px;width:28px">#</th><th style="padding:8px 4px;text-align:left;color:var(--muted);font-size:9px">ATLETA</th><th style="padding:8px 3px;text-align:center;color:var(--muted);font-size:9px;width:38px">VLO</th><th style="padding:8px 3px;text-align:center;color:var(--muted);font-size:9px;width:80px">BW + 1ros</th>';
  ['sq','bp','dl'].forEach(l=>{[1,2,3].forEach(r=>{h+='<th style="padding:8px 2px;text-align:center;color:'+LIFT_C[l]+';font-size:9px;width:62px">'+LIFT_S[l]+r+'</th>'})});
  h+='</tr></thead><tbody>';
  const _mf=window._MAN_F||{q:'',flight:''};
  const _visibles=ath.filter(a=>(!_mf.flight||a.flight===_mf.flight)&&_manCoincide(a,_mf.q));
  if(!_visibles.length){
    h+='<tr><td colspan="30" style="padding:26px;text-align:center;color:var(--muted);font-size:13px">'
      +'Ningún atleta con esa búsqueda. <button onclick="manLimpiar()" style="margin-left:8px;padding:4px 12px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-family:Oswald;font-size:11px;cursor:pointer">Limpiar</button></td></tr>';
  }
  _visibles.forEach(a=>{
    h+='<tr style="border-bottom:1px solid rgba(29,49,80,.3);'+(a.bombed?'opacity:.4':'')+'">';
    h+='<td style="padding:3px 2px;text-align:center"><input type="number" min="1" value="'+a.lot+'" onchange="setLot('+a.id+',this.value)" title="Edita el número de lote — si ya existe se hace swap" style="width:42px;padding:3px 2px;font-family:Oswald;font-weight:700;color:var(--gold);background:transparent;border:1px solid var(--border);border-radius:4px;text-align:center;font-size:13px"></td>';
    {
      // Con varios países, la bandera junto al nombre y el país en la línea de
      // abajo. Con uno solo, la bandera no informa: en su lugar, antes del nombre,
      // va el logo del club (más grande que la bandera), y abajo ya no se repite
      // ni el logo chico ni el país.
      const _nomA='<span onclick="renameAthlete('+a.id+')" title="Click para corregir el nombre — se cambia en la tarima, el acta y la transmisión" style="cursor:text;border-bottom:1px dashed rgba(212,168,67,.45)">'+esc(a.name)+'</span>';
      if(_variosPaises()){
        h+='<td style="padding:6px 4px"><div style="font-weight:600;font-size:12px;white-space:nowrap">'+_flagImg(_ctry(a),13)+_nomA+'</div><div style="display:flex;align-items:center;gap:4px;font-size:9px;color:var(--muted)">'+(window.clubLogoImg?window.clubLogoImg(a.club,14,'background:rgba(10,22,40,.4);padding:1px;'):'')+'<span>'+_ctry(a)+' \u00b7 '+a.club+' \u00b7 '+a.div+' \u00b7 '+a.cat+'</span></div></td>';
      }else{
        h+='<td style="padding:6px 4px"><div style="font-weight:600;font-size:12px;white-space:nowrap;display:flex;align-items:center">'+_logoClub(a,24)+_nomA+'</div>'
          +'<div style="font-size:9px;color:var(--muted);white-space:nowrap">'+esc(a.club||'')+' \u00b7 '+a.div+' \u00b7 '+a.cat+'</div></td>';
      }
    }
    {
      // Opciones del dropdown de vuelo: si hay tarima, suffix con 1/2; si no, letras simples.
      const _flOpts = TARIMA ? FL_LETTERS.map(L=>L+TARIMA) : FL_LETTERS.slice();
      h+='<td style="padding:3px 2px"><select class="inp-sm" onchange="updA('+a.id+',\'flight\',this.value);R()" style="width:42px;padding:4px 1px;font-size:11px">'+_flOpts.map(f=>'<option value="'+f+'" '+(a.flight===f?'selected':'')+'>'+f+'</option>').join('')+'</select></td>';
    }
    h+='<td style="padding:3px 2px;text-align:center">';
    if(a.weighedIn){
      h+='<button onclick="openWeighIn('+a.id+')" style="padding:2px 6px;border-radius:4px;border:1px solid var(--green);background:rgba(34,197,94,.1);color:var(--green);font-family:Oswald;font-size:9px;cursor:pointer;white-space:nowrap">'+a.bw+'kg <i class=yl-i-check></i></button>';
    }else{
      h+='<button onclick="openWeighIn('+a.id+')" style="padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:9px;cursor:pointer">Pesar</button>';
    }
    {const _hasMedia=!!_lcMediaFor(a);h+='<button onclick="openAthleteMedia('+a.id+')" title="Subir foto/GIF del atleta" style="display:block;margin:3px auto 0;padding:2px 8px;border-radius:4px;border:1px solid '+(_hasMedia?'var(--gold)':'var(--border)')+';background:'+(_hasMedia?'rgba(212,168,67,.12)':'transparent')+';color:'+(_hasMedia?'var(--gold)':'var(--muted)')+';font-family:Oswald;font-size:9px;cursor:pointer;white-space:nowrap">'+(_hasMedia?'Foto <i class=yl-i-check></i>':'Foto')+'</button>';}
    h+='</td>';
    // La tabla de pesaje muestra siempre 3 intentos (el 4º extra se gestiona en
    // Control en Vivo). slice(0,3) evita filas con más columnas que el encabezado.
    ['sq','bp','dl'].forEach(l=>{a.att[l].slice(0,3).forEach((at,r)=>{
      const ctKey=a.id+'_'+l+'_'+r;const ct=DATA.changeTimers[ctKey];
      let cls='inp-sm',ph='\u2014';
      if(ct&&!ct.expired&&ct.remaining>0){cls='inp-sm countdown';ph=ct.remaining+'s'}
      else if(ct&&ct.expired&&!at.w){cls='inp-sm expired';ph='0s'}
      const bc=at.r==='g'?'var(--green)':at.r==='n'?'var(--red)':at.w>0?LIFT_C[l]:'var(--border)';
      const gActive=at.r==='g';const nActive=at.r==='n';
      h+='<td style="padding:2px">'
        +'<input type="text" inputmode="decimal" class="'+cls+'" id="ct_'+ctKey+'" value="'+(at.w||'')+'" placeholder="'+ph+'" oninput="this.value=this.value.replace(\',\',\'.\')" onchange="setAtt('+a.id+',\''+l+'\','+r+',this.value)" style="border-color:'+bc+';'+(at.r==='n'?'text-decoration:line-through':'')+';width:100%;margin-bottom:2px">'
        +'<div style="display:flex;gap:2px">'
        +'<button onclick="overrideResult('+a.id+',\''+l+'\','+r+',\'g\')" title="Marcar v\u00e1lido" style="flex:1;padding:2px 0;border-radius:3px;border:1px solid '+(gActive?'var(--green)':'rgba(34,197,94,.3)')+';background:'+(gActive?'rgba(34,197,94,.2)':'transparent')+';color:'+(gActive?'var(--green)':'rgba(34,197,94,.5)')+';font-size:9px;font-weight:700;cursor:pointer;line-height:1"><i class=yl-i-check></i></button>'
        +'<button onclick="overrideResult('+a.id+',\''+l+'\','+r+',\'n\')" title="Marcar nulo" style="flex:1;padding:2px 0;border-radius:3px;border:1px solid '+(nActive?'var(--red)':'rgba(239,68,68,.3)')+';background:'+(nActive?'rgba(239,68,68,.2)':'transparent')+';color:'+(nActive?'var(--red)':'rgba(239,68,68,.5)')+';font-size:9px;font-weight:700;cursor:pointer;line-height:1"><i class=yl-i-cruz></i></button>'
        +'</div>'
        +'</td>';
    })});
    h+='</tr>';
    // ── Segunda línea del MISMO atleta: su Only Bench ────────────────────
    // El que compite en PL + Only Bench sube a tarima una sola vez. Su banca
    // cuenta para los dos rankings, así que acá no va como otro atleta: va como
    // una línea más abajo del suyo, bajo las columnas de banca, reflejando el
    // mismo intento. Se marca sola cuando arriba se da válido o nulo.
    if(_isPlusBench(a)){
      const eqB=String(a.mod)==='equipped_bench';
      h+='<tr style="border-bottom:1px solid rgba(29,49,80,.3);background:rgba(167,139,250,.06);'+(a.bombed?'opacity:.4':'')+'">';
      h+='<td style="padding:3px 2px;text-align:center;color:#a78bfa;font-size:13px">\u21B3</td>';
      h+='<td style="padding:4px 4px"><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span style="font-size:11px">'+a.name+'</span>'
        +'<span style="background:#a78bfa;color:#0A1628;padding:1px 6px;border-radius:4px;font-size:8px;font-family:Oswald;font-weight:700;letter-spacing:1px">ONLY BENCH'+(eqB?' EQ':'')+'</span>'
        +'<span style="font-size:9px;color:var(--muted)">mismo intento de banca \u2014 se marca solo</span></div></td>';
      h+='<td></td><td></td>';
      ['sq','bp','dl'].forEach(l=>{ for(let r=0;r<3;r++){
        if(l!=='bp'){h+='<td></td>';continue;}
        const at=a.att.bp[r]||{w:0,r:null};
        const bc=at.r==='g'?'var(--green)':at.r==='n'?'var(--red)':at.w>0?LIFT_C.bp:'var(--border)';
        h+='<td style="padding:2px"><div title="Reflejo del intento de banca (no se edita ac\u00e1)" style="border:1px solid '+bc+';border-radius:6px;padding:5px 2px;text-align:center;font-size:12px;font-weight:700;opacity:.9;'+(at.r==='n'?'text-decoration:line-through':'')+'">'+(at.w||'\u2014')+'</div></td>';
      }});
      h+='</tr>';
    }
  });
  h+='</tbody></table></div></div>';return h;
}

// ── Chips de nominación para la planilla (pedido de la organización) ──
// Muestran a QUÉ se nominó el atleta, para quien carga o revisa:
//   DIVISIÓN (OE / UNI destacados) · CATEGORÍA de peso · LÍNEA (Classic/Equipado)
//   · MODALIDAD (PL / Only Bench; "PL+BP" si compite en ambas).
// Texto de MONTAJE de tarima para el lift en curso: altura de rack + los extras
// que pidió el atleta en el pesaje. Se omite lo que no pidió (palmetas 0 → no
// sale, seguros vacíos → no sale). Sentadilla: abatible izq/der/ambos.
// Banca: altura de seguros y cantidad de palmetas. Lo ve quien monta la barra.
// ¿El atleta compite en Powerlifting Y en Only Bench de la misma línea?
// (una sola banca en tarima que cuenta para los dos rankings)
// La bandera la pone la conversión cuando la modalidad trae "+" (PL + Only Bench).
// Antes se deducía del mod, pero 'equipped_bench' también le toca al Only Bench
// Equipado PURO, así que a esos les salía una fila espejo que no correspondía.
// Lo que elige el selector de modalidad (pesaje y alta de atleta), traducido a
// los campos de verdad. Así un cambio de modalidad deja al atleta exactamente
// como si se hubiera inscrito así: en sus tablas, sus chips, su acta y su ranking.
//   classic_uni   → classic + plusUni, en su división de edad
//   universitario → classic en la división Universitario (solo universitario)
//   classic_bench / equipped_bench → combinado con Only Bench (plusBench)
// Salir de Universitario devuelve al atleta a su división de edad.
function _aplicarModalidad(a,v){
  const divEdad=()=>_divPorEdad(a)||'Open';
  const eraUni=/univ/i.test(String(a.div||''));
  if(v==='classic_uni'){ a.mod='classic'; a.plusUni=true; a.plusBench=false; if(eraUni)a.div=divEdad(); }
  else if(v==='universitario'){ a.mod='classic'; a.plusUni=false; a.plusBench=false; a.div='Universitario'; }
  else{
    a.mod=v; a.plusUni=false;
    a.plusBench=(v==='classic_bench'||v==='equipped_bench');
    if(eraUni&&v!=='invitado')a.div=divEdad();
  }
}

// CLASSIC + UNIVERSITARIO: un solo atleta, que levanta una vez, y compite en dos
// clasificaciones: classic en su división de edad y Universitario. Es el mismo
// modelo que PL+BP. Antes se cargaba dos veces —una fila por división, con los
// mismos intentos— y había que llevar las dos a mano.
function _isPlusUni(a){ return !!(a&&a.plusUni&&!/univ/i.test(String(a.div||''))); }

// Para armar tablas: cada atleta Classic + Universitario aparece además como
// Universitario. Es una vista: comparte los intentos con el atleta real (no se
// copian) y no entra a DATA.athletes, así que la tarima lo llama una sola vez.
function _conUni(list){
  const out=[];
  (list||[]).forEach(a=>{
    out.push(a);
    if(_isPlusUni(a))out.push(Object.assign({},a,{div:'Universitario',plusUni:false,id:'U'+a.id,__uniDe:a.id}));
  });
  return out;
}

function _isPlusBench(a){
  if(a&&a.plusBench!==undefined)return !!a.plusBench;
  const m=String(a&&a.mod||'');return m==='classic_bench'||m==='equipped_bench';   // estado viejo
}

function _rackSetup(a,lift){
  if(!a)return '';
  const out=[];
  if(lift==='sq'){
    if(a.rackSQ)out.push('RACK '+a.rackSQ);
    const ab=String(a.sqAbat||'');
    if(ab)out.push('ABATIBLE '+({izq:'IZQ',der:'DER',ambos:'AMBOS'}[ab]||ab.toUpperCase()));
  }else if(lift==='bp'){
    if(a.rackBP)out.push('RACK '+a.rackBP);
    if(a.bpSeg)out.push('SEGUROS '+a.bpSeg);
    const p=parseInt(a.bpPalm,10)||0;
    if(p>0)out.push('PALMETAS '+p);
  }
  return out.join(' \u00b7 ');
}

function _nomDivShort(a){
  const mod=String(a.mod||'');
  if(mod.startsWith('oe'))return 'OE';                      // Special Olympics
  const d=String(a.div||'');
  if(/universitar/i.test(d))return 'UNI';
  return txDivShort(d)||'—';
}

// [línea de equipamiento, modalidad competitiva]
function _nomLineMod(a){
  const mod=String(a.mod||'').toLowerCase();
  if(mod==='invitado')return ['INVITADO/A','FUERA DE COMP.'];
  const linea=(mod==='equipped'||mod==='equipped_bench')?'EQUIPADO':'CLASSIC';
  // 'equipped_bench' le toca al combinado equipado Y al Only Bench Equipado puro,
  // así que quién compite en las dos lo dice la bandera, no el código.
  if(_isPlusBench(a)&&_isPlusUni(a))return [linea,'PL+BP+UNI'];
  if(_isPlusUni(a))return [linea,'PL+UNI'];
  if(_isPlusBench(a))return [linea,'PL+BP'];
  if(mod==='onlybench'||mod==='oe_bench'||mod==='equipped_bench')return [linea,'ONLY BENCH'];
  return [linea,'PL'];                                       // classic, equipped y oe_classic
}

// `linea` dibuja los chips al lado del nombre en vez de debajo: mismo contenido,
// pero sin abrir un renglón nuevo ni partirse en dos. Lo usa la tabla del público,
// donde cada renglón de más es un atleta menos que entra en el televisor.
function _nomChips(a,sc,enLinea){
  sc=sc||1;
  const fs=Math.max(7,Math.round(8.5*sc));
  const chip=(txt,col,bg,bd,title)=>'<span'+(title?' title="'+title+'"':'')+' style="display:inline-block;padding:0 '+Math.round(5*sc)+'px;border-radius:4px;font-family:Oswald;font-size:'+fs+'px;font-weight:700;letter-spacing:.4px;line-height:'+Math.round(14*sc)+'px;color:'+col+';background:'+bg+';border:1px solid '+bd+'">'+txt+'</span>';
  const dv=_nomDivShort(a);
  const esp=(dv==='OE'||dv==='UNI');
  const [linea,modal]=_nomLineMod(a);
  const eq=(linea==='EQUIPADO');
  const bench=/BENCH/.test(modal);
  let h=enLinea
    ? '<span style="display:inline-flex;flex-wrap:nowrap;gap:'+Math.round(3*sc)+'px;flex-shrink:0">'
    : '<div style="display:flex;flex-wrap:wrap;gap:'+Math.round(3*sc)+'px;margin-top:'+Math.round(2*sc)+'px">';
  const cierra=enLinea?'</span>':'</div>';
  // Invitado/a: un solo chip, para que se lea de una que no está compitiendo por
  // el lugar. Su división y categoría ya no significan nada en el ranking.
  if(_esInvitado(a)){
    h+=chip('INVITADO/A','#0A1628','#f59e0b','#f59e0b','Fuera de competencia: levanta pero no entra al ranking');
    h+=chip(txCatLabel(a.cat)||'—','var(--muted)','rgba(29,49,80,.55)','var(--border)','Categoría de peso');
    return h+cierra;
  }
  h+=chip(dv, esp?'#0A1628':'var(--muted)', esp?'var(--gold)':'rgba(29,49,80,.55)', esp?'var(--gold)':'var(--border)', 'División: '+(a.div||'—'));
  h+=chip(txCatLabel(a.cat)||'—','var(--gold)','rgba(212,168,67,.12)','rgba(212,168,67,.35)','Categoría de peso');
  h+=chip(linea, eq?'#f59e0b':'#60a5fa', eq?'rgba(245,158,11,.12)':'rgba(96,165,250,.12)', eq?'rgba(245,158,11,.4)':'rgba(96,165,250,.4)','Línea competitiva');
  h+=chip(modal, bench?'#a78bfa':'var(--green)', bench?'rgba(167,139,250,.12)':'rgba(34,197,94,.12)', bench?'rgba(167,139,250,.4)':'rgba(34,197,94,.4)','Modalidad');
  return h+cierra;
}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

// Borra el pesaje del atleta: BW, racks y todos los intentos (vuelve a "sin pesar")
window.clearWeighIn = function(id){
  const a = DATA.athletes.find(x=>x.id===id);
  if(!a) return;
  const msg = `¿Borrar el pesaje de ${a.name}?\n\nSe borrarán:\n• Peso corporal (BW)\n• Alturas de rack (SQ y BP)\n• Todos los intentos cargados\n\nEsto NO borra al atleta del evento. Solo le reinicia el pesaje.`;
  if(!confirm(msg)) return;
  a.bw = 0;
  a.rackSQ = '';
  a.rackBP = '';
  a.sqAbat = ''; a.bpSeg = ''; a.bpPalm = '';
  a.weighedIn = false;
  _markAtt(id,'meta');
  // Limpiar intentos del atleta (pesos y resultados). Igual que en el confirmar:
  // sin marcar cada celda, el borrado no viajaba y el primer snapshot del
  // servidor le devolvía los intentos al atleta.
  ['sq','bp','dl'].forEach(l=>{
    if(a.att && a.att[l]){
      a.att[l].forEach((at,r)=>{at.w=0; at.r=null; _markAtt(id,'att_'+l+'_'+r);});
    }
  });
  // Limpiar cualquier change timer activo del atleta
  Object.keys(DATA.changeTimers).forEach(k=>{
    if(k.startsWith(id+'_')) delete DATA.changeTimers[k];
  });
  saveNow();
  const modal = document.getElementById('weighInModal');
  if(modal) modal.remove();
  R();
  showToastLC('Pesaje borrado: '+a.name);
};

window.manBuscar=function(v){
  window._MAN_F.q=String(v||'');
  R();
  // Devolver el cursor al buscador y al final del texto, que si no hay que
  // volver a hacer clic entre letra y letra.
  const i=document.getElementById('manQ');
  if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}
};

window.manTanda=function(f){ window._MAN_F.flight=(window._MAN_F.flight===f)?'':f; R(); };

window.manLimpiar=function(){ window._MAN_F={q:'',flight:''}; R(); };

window.setCtCellScale=function(v){
  window._CT_CELL_SCALE=Math.max(0.7,Math.min(2.2,parseFloat(v)||1));
  try{localStorage.setItem('yl_ct_cellscale',window._CT_CELL_SCALE)}catch(e){}
  R();
};

window.nudgeCtCellScale=function(d){window.setCtCellScale(window._CT_CELL_SCALE+d)};

window.toggleCtAutoScroll=function(){
  window._ctAutoScroll=!window._ctAutoScroll;
  try{localStorage.setItem('yl_ct_autoscroll',window._ctAutoScroll?'1':'0')}catch(e){}
  if(window._ctAutoScroll)window._ctScrollKey=null; // forzar un reacomodo al reactivar
  R();
};

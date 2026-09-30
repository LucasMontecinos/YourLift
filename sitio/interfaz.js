// index.html — el sitio en sí: el dibujo de cada pestaña (render), el menú, los cachés y la conexión con Firebase.
//
// Parte del código de index.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

// ── Cache localStorage para reducir lecturas Firestore ──────────────────
function _fsCache(k,ttl){try{const v=localStorage.getItem('_yfc_'+k);if(!v)return null;const o=JSON.parse(v);if(Date.now()-o.ts<ttl)return o.d;}catch(e){}return null;}

function _fsSetCache(k,d){try{localStorage.setItem('_yfc_'+k,JSON.stringify({ts:Date.now(),d}));}catch(e){}}

function _usandoAlgo(){
  const f=document.activeElement;
  return !!(f&&(f.tagName==='INPUT'||f.tagName==='SELECT'||f.tagName==='TEXTAREA'));
}

function renderFondo(){
  if(_usandoAlgo()){window._renderPendiente=true;return;}
  render();
}

function _applyEventos(docs){
  const allEvs=docs.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  window.ALL_EVENTS=allEvs;
  const evs=allEvs.filter(e=>e.status!=='archived');
  // Antes acá se llamaba a loadFBNominas(), que se baja las 533 inscripciones.
  // Eso pasaba en CADA carga del sitio, aunque nadie abriera Nóminas: la portada
  // no las usa —arma su carrusel con nominas.json y con los eventos— y son 923 KB.
  // Ahora se piden al abrir la pestaña, en cargarParaVista().
  if(evs.length)NOM_EVENTS=evs;
  // Llegó la lista de campeonatos: el oyente de Nóminas ya puede filtrar por ella.
  // Si estaba escuchando otra lista (cambió un campeonato), se rearma.
  window._eventosFS=true;
  if(window._nomEspera){clearTimeout(window._nomEspera);window._nomEspera=null;if(typeof _nominasEscuchar==='function')_nominasEscuchar();}
  else if(window._nomOyente&&window._nomOyente.clave!==_nominasClaves().join('|')){_nominasSoltar();_nominasEscuchar();}
  if(ST.v==='trans')renderFondo();
}

async function initFB(){
  try{
    const{initializeApp}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const fb=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const app=initializeApp(FB_CFG);fbDB=fb.getFirestore(app);
    window.FBQ={collection:fb.collection,getDocs:fb.getDocs,query:fb.query,orderBy:fb.orderBy,where:fb.where,doc:fb.doc,setDoc:fb.setDoc,getDoc:fb.getDoc,onSnapshot:fb.onSnapshot,updateDoc:fb.updateDoc,increment:fb.increment,serverTimestamp:fb.serverTimestamp};
    fbReady=true;
    // ── Analytics propio ──
    try{ trackVisit(fb); }catch(e){}
    // ── Todo esto se pide A LA VEZ ──────────────────────────────────────
    //
    // Antes iba en fila india: cada `await` esperaba a que terminara el anterior,
    // así que la espera era la SUMA de todas. Son cerca de 1.350 documentos y
    // 1,7 MB, y ninguna de estas consultas necesita el resultado de la de al
    // lado. Pidiéndolas juntas, la espera pasa a ser la de la más lenta.
    //
    // Lo único que sí lleva orden es lo de abajo: las nóminas se arman con los
    // eventos y con las ediciones de atletas, así que esas tres van encadenadas
    // entre sí —pero en paralelo con el resto.
    const _sueltas=[
      (async()=>{
      // ── Récords: getDocs + caché 1h ──
      try{
        const cr=_fsCache('records',60*60*1000);
        if(cr){if(cr.classic||cr.equipped){R=sinRetiradas(cr);if(ST.v==='records')renderFondo();}}
        else{const rs=await window.FBQ.getDoc(window.FBQ.doc(fbDB,'records','data'));if(rs.exists()){const r=rs.data();if(r&&(r.classic||r.equipped)){R=sinRetiradas(r);_fsSetCache('records',r);if(ST.v==='records')renderFondo();}}}
      }catch(e){console.warn('[records]',e);}
      })(),
      (async()=>{
      // ── Tarjetas de nóminas (foto/fecha/organizador por campeonato, editable en admin): caché 10min ──
      try{
        const cn=_fsCache('nomcards',10*60*1000);
        if(cn){window.NOMCARDS=cn;if(ST.v==='nominas')renderFondo();}
        else{
          const ns=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'nomina_cards'));
          const map={};ns.docs.forEach(d=>{map[d.id]=d.data();});
          window.NOMCARDS=map;_fsSetCache('nomcards',map);if(ST.v==='nominas')renderFondo();
        }
      }catch(e){console.warn('[nomcards]',e);}
      })(),
      (async()=>{
      // ── Correcciones de la nómina Sudamericano hechas desde el admin: 1 solo
      // doc, caché 10min (hay que ver los arreglos rápido, pero sin leer en cada carga) ──
      try{
        const ce=_fsCache('nsudaedits',10*60*1000);
        if(ce!==null&&ce!==undefined){window.NSUDA_EDITS=ce;}
        else{
          const es=await window.FBQ.getDoc(window.FBQ.doc(fbDB,'nomina_suda_edits','main'));
          window.NSUDA_EDITS=(es.exists()&&es.data().items)||{};
          _fsSetCache('nsudaedits',window.NSUDA_EDITS);
        }
        _nsudaApplyEdits(); if(ST.v==='nominas')renderFondo();
      }catch(e){console.warn('[nsudaedits]',e);}
      })(),
      (async()=>{
      // ── Cert config: getDocs + caché 1h ──
      try{
        const cc=_fsCache('certcfg',60*60*1000);
        if(cc){CERTCFG=cc;if(ST.v==='cert')renderFondo();}
        else{const cs=await window.FBQ.getDoc(window.FBQ.doc(fbDB,'cert_config','main'));CERTCFG=cs.exists()?cs.data():{champs:[]};_fsSetCache('certcfg',CERTCFG);if(ST.v==='cert')renderFondo();}
      }catch(e){console.warn('[cert]',e);}
      })(),
      (async()=>{
      // ── Clubes: getDocs + caché 24h ──
      try{
        const cl=_fsCache('clubs',24*60*60*1000);
        const docs=cl||(await window.FBQ.getDocs(window.FBQ.collection(fbDB,'clubs'))).docs.map(d=>d.data());
        if(!cl)_fsSetCache('clubs',docs);
        window._CLUBS_FS={};docs.forEach(v=>{if(v.slug&&v.logoUrl)window._CLUBS_FS[v.slug]=v;});
      }catch(e){}
      })()
    ];
    const _encadenadas=(async()=>{
      // ── Eventos: getDocs + caché 10min ──
      try{
        const ce=_fsCache('eventos',10*60*1000);
        if(ce){_applyEventos(ce);}
        else{const es=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'eventos'));const docs=es.docs.map(d=>({...d.data(),id:d.id}));_fsSetCache('eventos',docs);_applyEventos(docs);}
        // Logos de evento (subidos desde admin → Campeonatos) para las tarjetas de nómina
        try{const _ev=_fsCache('eventos',10*60*1000)||[];const lg={};_ev.forEach(e=>{if(e&&e.id&&e.logoUrl)lg[e.id]=e.logoUrl;});window.NOMEVENT_LOGOS=lg;if(ST.v==='nominas')renderFondo();}catch(_){}
        // Competencias habilitadas para el PÚBLICO (admin → YourLift Público).
        // Solo las marcadas con publicoVisible salen en "Competencia en Vivo".
        try{
          const _ev=_fsCache('eventos',10*60*1000)||[];
          window.EVENTOS_PUB=_ev.filter(e=>e&&e.publicoVisible===true)
            .map(e=>({id:e.id,name:e.name||e.id,logoUrl:e.logoUrl||'',fecha:e.fecha||e.fechas||'',
                      lugar:e.lugar||e.location||'',qrPublico:e.qrPublico===true}));
          if(ST.v==='envivo')renderFondo();
        }catch(_){ window.EVENTOS_PUB=window.EVENTOS_PUB||[]; }
        // Actas de competencias pasadas (admin → Competencias pasadas). Solo las
        // que el admin marcó como visibles.
        try{
          const cp=_fsCache('pasadas',10*60*1000);
          if(cp){window.COMPES_PASADAS=cp;if(ST.v==='pasadas')renderFondo();}
          else{
            const ps=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'competencias_pasadas'));
            const list=ps.docs.map(d=>({...d.data(),id:d.id}))
              .filter(e=>e.publicado&&(e.docs||[]).length);
            _fsSetCache('pasadas',list);
            window.COMPES_PASADAS=list;
            if(ST.v==='pasadas')renderFondo();
          }
        }catch(e){ console.warn('[pasadas]',e); window.COMPES_PASADAS=window.COMPES_PASADAS||[]; }
      }catch(e){console.warn('[eventos]',e);}
      // Las ediciones se cargan siempre: las usa el buscador de atletas, el
      // ranking y la nómina. Las inscripciones NO: son 533 documentos que solo
      // hacen falta en la pestaña Nóminas, y se piden allá.
      await loadEdits();
    })();
    // Si una falla, que no se lleve a las demás por delante.
    await Promise.allSettled([..._sueltas,_encadenadas]);
    // Y lo que necesite la pestaña en la que se entró. Si alguien abre el
    // sitio directo en Nóminas, nadie pasó por sv() y sin esto se quedaría
    // sin las fotos para siempre.
    try{ await cargarParaVista(ST.v); }catch(e){}
  }catch(e){console.warn('Firebase not available, using nominas.json',e)}
}

function I(n){return n.split(" ").map(w=>w[0]).filter(Boolean).slice(0,2).join("").toUpperCase()}

function cls(){return[...new Set(D.map(a=>a.club).filter(Boolean))].sort()}

function nrm(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}

function flt(){const s=nrm(ST.s);return D.filter(a=>{if(ST.fl&&!a.nombre.toUpperCase().startsWith(ST.fl))return false;if(s){const n=nrm(a.nombre);const words=s.split(/\s+/).filter(w=>w);const match=words.every(w=>n.includes(w));if(!match&&!a.codigo.toLowerCase().includes(s))return false}if(ST.fc&&a.club!==ST.fc)return false;if(ST.fk&&!a.competencias.some(c=>c.evento===ST.fk))return false;return true}).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'))}

function tg(e){const c=CC[e]||{bg:"#f1f5f9",b:"#94a3b8",t:"#334155",n:e};return`<span class="tg" style="background:${c.bg};border:1.5px solid ${c.b};color:${c.t}">${c.n}</span>`}

function render(){const app=document.getElementById("app");
  let h='';
  if(ST.sel)h+=prof(ST.sel);
  else{
    if(ST.v==="home")h+=home();
    else if(ST.v==="records")h+=rec();
    else if(ST.v==="trans")h+=trans();
    else if(ST.v==="crono")h+=crono();
    else if(ST.v==="atletas")h+=embedded('atleta.html');
    else if(ST.v==="cert")h+=certForm();
    else if(ST.v==="insc")h+=_avisoEntrenadores()+embedded('inscripcion.html');
    else if(ST.v==="rank")h+=embedded('ranking.html');
    else if(ST.v==="glcalc")h+=glcalc();
    else if(ST.v==="entrenadores")h+=renderEntrenadoresPub();
    else if(ST.v==="terminos")h+=renderTerminos();
    else if(ST.v==="envivo")h+=renderEnVivoPub();
    else if(ST.v==="pasadas")h+=renderPasadasPub();
    else h+=nom();
    // La franja de auspiciadores va SOLO en el inicio, dibujada dentro de home()
    // en su lugar del medio. Estuvo un tiempo también arriba de ranking,
    // inscripción, ficha del atleta y cronograma; se sacó de esas cuatro.
    //
    // Ojo con la propuesta de auspicio: ofrece la marca en cinco pantallas. Con
    // esto se ofrece una. Si se vuelve a vender por pantalla, hay que reponer la
    // franja en las otras cuatro —iba arriba del todo, fuera del recuadro,
    // porque esas vistas son otra página metida adentro y no entra ahí.
    if(typeof buildMenu==='function')buildMenu();
  }
// El QR de una competencia. Es el mismo link de "VER EN VIVO": se escanea con
// la cámara del teléfono y se entra directo al seguimiento, sin buscar nada.
// Sirve proyectado en la pantalla del recinto o impreso en la entrada.
//
// Al público NO se le muestra por defecto: el botón aparece solo en los
// campeonatos donde el owner lo encendió (admin → YourLift Público). El QR
// sigue funcionando igual —desde el panel se genera y se imprime cuando haga
// falta—; lo que se controla es si la gente lo ve en la tarjeta o no.
window.qrEnVivo=function(id,nombre){
  if(!window.YLQR){alert('No se pudo cargar el generador de QR.');return;}
  const el=document.createElement('div'); el.innerHTML=nombre||'';
  YLQR.panel({url:YLQR.urlEvento(id), titulo:el.textContent||id,
    archivo:'qr-'+String(id).replace(/[^A-Za-z0-9_-]+/g,'-')});
};
// ── COMPETENCIA EN VIVO (público) ─────────────────────────────────
// Lista SOLO los eventos que se habilitaron para el público desde
// admin → YourLift Público (campo publicoVisible en eventos/{id}). Abre el
// livecast en modo ESPECTADOR: sin sesión no se puede operar nada.
function renderEnVivoPub(){
  // Orden por fecha: durante el Sudamericano son los nueve días seguidos y tienen
  // que salir Día 1, 2, 3… no alfabético.
  const evs=(window.EVENTOS_PUB||[]).slice().sort((a,b)=>
    String(a.fecha||'zzz').localeCompare(String(b.fecha||'zzz'))
    ||String(a.name||'').localeCompare(String(b.name||'')));
  const _fpub=f=>{const m=String(f||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return f||'';
    const M=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return (+m[3])+' '+M[(+m[2])-1]+' '+m[1];};
  let h=`<div style="max-width:900px;margin:0 auto;padding:0 4px">`;
  h+=`<h2 style="font-family:Oswald;font-size:clamp(20px,5vw,28px);letter-spacing:2px;text-transform:uppercase;margin:0 0 4px">Competencia en Vivo</h2>`;
  h+=`<p style="color:var(--muted);font-size:13px;margin-bottom:18px">Sigue la competencia en tiempo real: atleta en tarima, intentos y resultados.</p>`;
  if(!window.EVENTOS_PUB){
    h+=`<div class="cd2" style="padding:26px;text-align:center;color:var(--muted);font-size:13px">Cargando competencias…</div></div>`;
    return h;
  }
  if(!evs.length){
    h+=`<div class="cd2" style="padding:30px 22px;text-align:center">
      <div style="font-family:Oswald;font-size:16px;letter-spacing:1px;color:var(--gold);margin-bottom:6px">NO HAY COMPETENCIAS EN VIVO</div>
      <div style="color:var(--muted);font-size:13px;line-height:1.5">Cuando haya una competencia transmitiéndose, aparece acá.</div>
    </div></div>`;
    return h;
  }
  h+=`<div style="display:grid;gap:12px">`;
  evs.forEach(e=>{
    const url='livecast.html?evento='+encodeURIComponent(e.id);
    h+=`<a href="${url}" style="text-decoration:none;color:inherit">
      <div class="cd2 envivo-card">
        ${e.logoUrl?`<div class="envivo-logo"><img src="${e.logoUrl}" alt="" onerror="this.parentElement.remove()"></div>`:''}
        <div class="envivo-info">
          <div class="envivo-nom">${e.name||e.id}</div>
          <div class="envivo-meta">${[_fpub(e.fecha),e.lugar].filter(Boolean).join(' · ')||'&nbsp;'}</div>
        </div>
        <div class="envivo-cta">
          <span>VER EN VIVO</span>
          ${e.qrPublico?`<button class="envivo-qr" title="Mostrar el código QR de esta competencia"
            onclick="event.preventDefault();event.stopPropagation();qrEnVivo('${String(e.id).replace(/'/g,"\\'")}','${_escH(String(e.name||e.id)).replace(/'/g,"&#39;")}')">QR</button>`:''}
        </div>
      </div></a>`;
  });
  h+=`</div></div>`;
  return h;
}
// ── COMPETENCIAS PASADAS (público) ────────────────────────────────
// Las actas que el admin subió en admin → Competencias pasadas. Se lista un
// campeonato por tarjeta, con sus documentos para bajar. Solo salen los que el
// admin marcó como visibles y que tienen al menos un archivo.
function renderPasadasPub(){
  const _fp=f=>{const m=String(f||'').match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return f||'';
    const M=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return (+m[3])+' '+M[(+m[2])-1]+' '+m[1];};
  const _peso=b=>{const n=+b||0;return !n?'':(n<1024*1024?Math.max(1,Math.round(n/1024))+' KB':(n/1024/1024).toFixed(1)+' MB');};
  const _ext=d=>{const m=String(d.archivo||d.nombre||'').match(/\.([A-Za-z0-9]{2,5})$/);return m?m[1].toUpperCase():'ARCHIVO';};
  // Para lo que va DENTRO de un atributo hay que escapar también las comillas:
  // _escH solo cubre & < >, y estas URLs y nombres los escribe el admin.
  const _at=v=>_escH(v).replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const evs=(window.COMPES_PASADAS||[]).slice()
    .sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))
              ||String(a.name||'').localeCompare(String(b.name||'')));

  let h=`<div style="max-width:900px;margin:0 auto;padding:0 4px">`;
  h+=`<h2 style="font-family:Oswald;font-size:clamp(20px,5vw,28px);letter-spacing:2px;text-transform:uppercase;margin:0 0 4px">Competencias pasadas</h2>`;
  h+=`<p style="color:var(--muted);font-size:13px;margin-bottom:18px">Actas oficiales de los campeonatos ya disputados, para descargar.</p>`;

  if(!window.COMPES_PASADAS){
    h+=`<div class="cd2" style="padding:26px;text-align:center;color:var(--muted);font-size:13px">Cargando actas…</div></div>`;
    return h;
  }
  if(!evs.length){
    h+=`<div class="cd2" style="padding:30px 22px;text-align:center">
      <div style="font-family:Oswald;font-size:16px;letter-spacing:1px;color:var(--gold);margin-bottom:6px">TODAVÍA NO HAY ACTAS PUBLICADAS</div>
      <div style="color:var(--muted);font-size:13px;line-height:1.5">Cuando termine un campeonato y se publique su acta, aparece acá para descargar.</div>
    </div></div>`;
    return h;
  }

  evs.forEach(e=>{
    const meta=[_fp(e.fecha),e.lugar].filter(Boolean).join(' · ');
    h+=`<div class="cd2" style="padding:0;overflow:hidden;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:0">
        ${e.logoUrl?`<div class="envivo-logo" style="align-self:stretch"><img src="${_at(e.logoUrl)}" alt="" onerror="this.parentElement.remove()"></div>`:''}
        <div class="envivo-info">
          <div class="envivo-nom">${_escH(e.name||e.id)}</div>
          <div class="envivo-meta">${_escH(meta)||'&nbsp;'}</div>
        </div>
      </div>
      <div style="padding:0 16px 14px;display:flex;flex-wrap:wrap;gap:8px">`;
    (e.docs||[]).forEach(d=>{
      if(!d||!d.url)return;
      const tam=_peso(d.tamano);
      h+=`<a href="${_at(d.url)}" target="_blank" rel="noopener" download
        style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:9px 13px;color:var(--text);font-size:13px">
        <span style="font-family:Oswald;font-size:10px;letter-spacing:1px;background:var(--gold);color:var(--bg);border-radius:4px;padding:2px 6px">${_escH(_ext(d))}</span>
        <span>${_escH(d.nombre||d.archivo||'Acta')}</span>
        ${tam?`<span style="color:var(--muted);font-size:11px">${_escH(tam)}</span>`:''}
      </a>`;
    });
    h+=`</div></div>`;
  });
  h+=`</div>`;
  return h;
}
// Ranking, atletas e inscripción son páginas propias que el inicio muestra
// adentro. Antes el recuadro tenía un alto fijo y su propia barra de scroll:
// se veía como una pestaña metida en la página. Ahora crece al alto de lo que
// muestra (misma dirección, así que se puede medir), y se desplaza con el
// inicio como una sección más.
function embedded(url){return `<iframe src="${url}?embedded=1" scrolling="no" onload="_ajustarEmbebido(this)" style="width:100%;height:calc(100vh - 110px);min-height:600px;border:0;background:transparent;display:block;overflow:hidden"></iframe>`}
function _ajustarEmbebido(f){
  try{
    const d=f.contentDocument; if(!d||!d.body) return;
    const medir=()=>{ const h=Math.max(d.body.scrollHeight,d.documentElement.scrollHeight); if(h>0) f.style.height=(h+8)+'px'; };
    medir();
    if(f._ro) f._ro.disconnect();
    f._ro=new ResizeObserver(medir); f._ro.observe(d.body);
  }catch(e){}
}
// El onload del iframe corre en el ámbito global: esta función vive adentro de
// otra, así que se deja a mano en window.
window._ajustarEmbebido=_ajustarEmbebido;

// ── Solicitud de certificado (público, moderado) ──
function _certNorm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
function _certRut(s){return String(s||'').replace(/[^0-9kK]/g,'').toUpperCase();}
function _certSelectedOk(a,champ){const list=(champ&&champ.seleccionados)||[];if(!list.length)return false;const ar=_certRut(a&&a.rut);return list.some(x=>(ar&&_certRut(x)===ar)||(a&&a.codigo&&x===a.codigo));}   // por RUT o por código de atleta
function _certLugar(p){const n=parseInt(p);return ({1:'Primer',2:'Segundo',3:'Tercer',4:'Cuarto',5:'Quinto',6:'Sexto'})[n]||(p?(p+'°'):'');}
function _certResultsHtml(){
  const q=_certNorm(CERTF.q).trim(); if(q.length<2) return '';
  const ws=q.split(/\s+/), qn=q.replace(/[^0-9k]/g,'');
  const list=(D||[]).filter(a=>{const n=_certNorm(a.nombre);return ws.every(w=>n.includes(w));}/* solo por nombre: buscar por RUT dejaba ver el de cualquiera */).slice(0,8);
  if(!list.length) return '<div style="color:var(--muted);font-size:12px;padding:6px">Sin resultados</div>';
  return list.map(a=>`<div onclick="certSel('${a.codigo.replace(/'/g,"\\'")}')" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:4px;cursor:pointer;display:flex;justify-content:space-between"><span>${_escH(a.nombre)}</span><span style="color:var(--muted);font-size:11px">${_escH(a.codigo)}</span></div>`).join('');
}
window.certSetQ=function(v){CERTF.q=v;const b=document.getElementById('certResults');if(b)b.innerHTML=_certResultsHtml();};
window.certSel=function(cod){const a=(D||[]).find(x=>x.codigo===cod);if(!a)return;CERTF.athlete=a;CERTF.q=a.nombre;CERTF.champId='';CERTF.err='';render();};
window.certSetChamp=function(id){CERTF.champId=id;certAutofill();render();};
function certAutofill(){
  const a=CERTF.athlete;if(!a)return;
  const champ=((CERTCFG&&CERTCFG.champs)||[]).find(c=>c.id===CERTF.champId);
  CERTF.ciudad=champ?champ.ciudad:'';CERTF.fechas=champ?champ.fechas:'';
  let comp=null;
  if(champ){const cn=_certNorm(champ.name);comp=(a.competencias||[]).find(c=>{const en=_certNorm(c.evento);return en&&(en.includes(cn)||cn.includes(en));});}
  const r=(comp&&comp.resultado)||{};
  CERTF.marcas={sq:r.sq||'',bp:r.bp||'',dl:r.dl||'',total:r.total||''};
  CERTF.lugar=comp&&comp.place?_certLugar(comp.place):'';
  CERTF.categoria=(comp&&comp.categoria)||r.categoria||'';
  CERTF.division=(comp&&comp.division)||r.division||'';
  CERTF.modalidad=(comp&&comp.modalidad)||'';
}
window.certSetMotivo=function(v){CERTF.motivo=v;CERTF.err='';render();};
window.certSetDestino=function(id){CERTF.destinoId=id;CERTF.err='';render();};
window.certSetF=function(k,v){CERTF[k]=v;};
window.certSetMarca=function(k,v){CERTF.marcas[k]=v;};
window.certSubmit=async function(){
  CERTF.err='';
  if(!CERTF.athlete){CERTF.err='Busca y selecciona tu nombre.';render();return;}
  if(!CERTF.champId){CERTF.err='Selecciona el campeonato.';render();return;}
  const champs=(CERTCFG&&CERTCFG.champs)||[];
  const champ=champs.find(c=>c.id===CERTF.champId)||{};
  let dest={};
  if(CERTF.motivo==='clasificacion'){
    dest=champs.find(c=>c.id===CERTF.destinoId)||{};
    if(!dest.id){CERTF.err='Selecciona el campeonato al que clasificaste.';render();return;}
    if(!_certSelectedOk(CERTF.athlete,dest)){CERTF.err='No figuras como seleccionado para ese campeonato, así que no puedes solicitar este certificado. Si crees que es un error, contacta a FECHIPO.';render();return;}
  }
  if(!CERTF.contacto.trim()){CERTF.err='Deja un correo o teléfono para enviarte el certificado.';render();return;}
  if(!window.FBQ||!fbDB){CERTF.err='Conexión no lista, intenta de nuevo.';render();return;}
  const a=CERTF.athlete;
  const payload={
    nombre:a.nombre||'',rut:a.rut||'',codigo:a.codigo||'',club:a.club||'',sexo:a.sexo||'',
    origenId:CERTF.champId,origenName:champ.name||'',ciudad:CERTF.ciudad||champ.ciudad||'',fechas:CERTF.fechas||champ.fechas||'',
    modalidad:CERTF.modalidad||'',categoria:CERTF.categoria||'',division:CERTF.division||'',lugar:CERTF.lugar||'',
    marcas:{sq:CERTF.marcas.sq||'',bp:CERTF.marcas.bp||'',dl:CERTF.marcas.dl||'',total:CERTF.marcas.total||''},
    motivo:CERTF.motivo,
    destinoId:dest.id||'',destinoName:dest.name||'',destinoCiudad:dest.ciudad||'',destinoFechas:dest.fechas||'',destinoPais:dest.pais||'',destinoNivel:dest.nivel||'',
    contacto:CERTF.contacto||'',status:'pending',ts:Date.now()
  };
  try{
    const id='cert_'+String(a.rut||a.codigo||'x').replace(/[^0-9a-zA-Z]/g,'')+'_'+Date.now();
    await window.FBQ.setDoc(window.FBQ.doc(fbDB,'cert_requests',id),payload);
    CERTF.sent=true;render();
  }catch(e){CERTF.err='No se pudo enviar: '+e.message;render();}
};
function certForm(){
  if(!(CERTCFG&&CERTCFG.enabled)){
    return `<div class="cd2" style="max-width:600px;margin:0 auto;text-align:center;padding:30px"><h2>Certificados</h2><p style="color:var(--muted);line-height:1.6">La solicitud de certificados no está habilitada por ahora. Vuelve más tarde o consulta con FECHIPO.</p></div>`;
  }
  if(CERTF.sent){
    return `<div class="cd2" style="max-width:640px;margin:0 auto;text-align:center;padding:30px"><h2><i class=yl-i-check></i> Solicitud enviada</h2><p style="color:var(--muted);line-height:1.6">Tu solicitud fue enviada a FECHIPO. Te harán llegar el certificado al contacto que dejaste, una vez revisado.</p><button class="tab" onclick="CERTF.sent=false;CERTF.athlete=null;CERTF.q='';CERTF.champId='';render()" style="margin-top:14px">Nueva solicitud</button></div>`;
  }
  const champs=(CERTCFG&&CERTCFG.champs)||[];
  const inp=(label,val,fn,ph)=>`<div style="margin-bottom:10px"><div style="font-size:11px;color:var(--muted);margin-bottom:3px">${label}</div><input value="${_escH(val||'')}" placeholder="${ph||''}" oninput="${fn}" style="width:100%;padding:9px 11px;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px"></div>`;
  let h=`<div class="cd2" style="max-width:680px;margin:0 auto"><div class="ct"><h2>Solicitud de certificado</h2></div>
   <p style="color:var(--muted);font-size:13px;line-height:1.6;margin-bottom:16px">Solicita tu certificado oficial FECHIPO. Búscate, elige el campeonato y el motivo. Lo revisamos y te lo enviamos.</p>
   <div style="margin-bottom:12px"><div style="font-size:11px;color:var(--muted);margin-bottom:3px">1 · Tu nombre</div>
     <input value="${_escH(CERTF.q)}" oninput="certSetQ(this.value)" placeholder="Escribe tu nombre..." style="width:100%;padding:9px 11px;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px">
     ${CERTF.athlete?`<div style="margin-top:6px;color:var(--green);font-size:12px"><i class=yl-i-check></i> ${_escH(CERTF.athlete.nombre)} ${CERTF.athlete.club?('· '+_escH(CERTF.athlete.club)):''} <a onclick="CERTF.athlete=null;CERTF.q='';render()" style="color:var(--accent);cursor:pointer;margin-left:6px">cambiar</a></div>`:`<div id="certResults" style="margin-top:6px">${_certResultsHtml()}</div>`}</div>`;
  if(CERTF.athlete){
    h+=`<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--muted);margin-bottom:3px">2 · Campeonato donde competiste</div>
      <select onchange="certSetChamp(this.value)" style="width:100%;padding:9px 11px;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px">
        <option value="">Selecciona un campeonato...</option>
        ${champs.map(c=>`<option value="${_escH(c.id)}" ${CERTF.champId===c.id?'selected':''}>${_escH(c.name)}${c.ciudad?(' — '+_escH(c.ciudad)):''}</option>`).join('')}
      </select>${!champs.length?'<div style="color:var(--muted);font-size:11px;margin-top:4px">Aún no hay campeonatos disponibles.</div>':''}</div>`;
    if(CERTF.champId){
      h+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--gold);margin-bottom:8px;font-family:Oswald;letter-spacing:1px">TUS MARCAS Y RESULTADO ${CERTF.marcas.total?'(autocompletadas — revísalas)':'(complétalas)'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
          ${inp('Sentadilla',CERTF.marcas.sq,"certSetMarca('sq',this.value)")}${inp('Banca',CERTF.marcas.bp,"certSetMarca('bp',this.value)")}${inp('Peso muerto',CERTF.marcas.dl,"certSetMarca('dl',this.value)")}${inp('Total',CERTF.marcas.total,"certSetMarca('total',this.value)")}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${inp('Lugar',CERTF.lugar,"certSetF('lugar',this.value)",'Primer')}${inp('Categoría',CERTF.categoria,"certSetF('categoria',this.value)")}${inp('División',CERTF.division,"certSetF('division',this.value)")}
        </div></div>`;
      h+=`<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--muted);margin-bottom:6px">3 · ¿Para qué lo necesitas?</div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;cursor:pointer"><input type="radio" name="cm" ${CERTF.motivo==='fines'?'checked':''} onchange="certSetMotivo('fines')"> Para los fines que estime conveniente</label>
        <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="radio" name="cm" ${CERTF.motivo==='clasificacion'?'checked':''} onchange="certSetMotivo('clasificacion')"> Certificar que clasifiqué a un campeonato</label>`;
      if(CERTF.motivo==='clasificacion'){
        const dchamp=champs.find(c=>c.id===CERTF.destinoId);
        const ok=dchamp?_certSelectedOk(CERTF.athlete,dchamp):true;
        h+=`<select onchange="certSetDestino(this.value)" style="width:100%;margin-top:8px;padding:9px 11px;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px">
          <option value="">Campeonato al que clasificaste...</option>
          ${champs.map(c=>`<option value="${_escH(c.id)}" ${CERTF.destinoId===c.id?'selected':''}>${_escH(c.name)}${c.nivel?(' ('+_escH(c.nivel)+')'):''}</option>`).join('')}
        </select>`;
        if(dchamp&&!ok){h+=`<div style="color:var(--accent);font-size:12px;margin-top:6px;line-height:1.5">No figuras como seleccionado para este campeonato, así que no puedes solicitar este certificado. Si crees que es un error, contacta a FECHIPO.</div>`;}
      }
      h+=`</div>`;
      h+=inp('4 · Tu correo o teléfono (para enviarte el certificado)',CERTF.contacto,"certSetF('contacto',this.value)",'correo@ejemplo.cl');
      const blocked=CERTF.motivo==='clasificacion'&&CERTF.destinoId&&!_certSelectedOk(CERTF.athlete,champs.find(c=>c.id===CERTF.destinoId));
      h+=`${CERTF.err?`<div style="color:var(--accent);font-size:12px;margin-bottom:8px;line-height:1.5">${_escH(CERTF.err)}</div>`:''}<button class="tab" onclick="certSubmit()" ${blocked?'disabled style="opacity:.5;cursor:not-allowed;width:100%;padding:12px"':'style="width:100%;border-color:var(--gold);color:var(--gold);padding:12px;font-weight:700"'}>Enviar solicitud</button>`;
    }
  }
  h+=`</div>`;
  return h;
}

// ── Cronograma público (lee colección cronograma + overlay de handlers) ──
function _escH(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
window.cronoSel=function(ev){ST.cronoEv=ev;render();};
// El Sudamericano no vive en la colección `cronograma` como los demás: su
// cronograma sale de la propia nómina, que ya trae la sesión de cada inscripción.
// Se le da una opción propia en el selector.
// El id del Sudamericano en el selector va como literal y no como constante.
// Esta parte del archivo no corre en el ámbito global —las funciones de acá no
// quedan colgando de window—, así que una constante declarada al lado se queda
// sin asignar y vale undefined cuando se la lee. Con eso, la comparación de
// abajo daba siempre distinto y la sección se reseteaba sola a "sin campeonato".
function _cronoHaySuda(){
  const j=window.NOMSUDA;
  return !!(j&&j.publicada!==false&&j.cronogramaPublico&&(j.jornadas||[]).length);
}
window.cronoDia=function(f){ST.cronoDia=f;render();};
function crono(){
  const evs=(window.ALL_EVENTS||[]).filter(e=>e.status!=='archived' && e.cronogramaPublic!==false).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const suda=_cronoHaySuda();
  let opts=evs.map(e=>`<option value="${_escH(e.id)}" ${ST.cronoEv===e.id?'selected':''}>${_escH(e.name||e.id)}</option>`).join('');
  if(suda)opts=`<option value="__suda" ${ST.cronoEv==='__suda'?'selected':''}>${_escH(window.NOMSUDA.eventoCorto||'Sudamericano 2026')}</option>`+opts;
  if(ST.cronoEv && ST.cronoEv!=='__suda' && !evs.some(e=>e.id===ST.cronoEv)) ST.cronoEv='';
  if(ST.cronoEv && ST.cronoEv!=='__suda') setTimeout(()=>loadCronoSection(ST.cronoEv),30);
  const cuerpo=ST.cronoEv==='__suda'
    ? cronoSuda()
    : (ST.cronoEv?'<div style="color:var(--muted);padding:14px">Cargando…</div>':'<div style="color:var(--muted);padding:14px">Selecciona un campeonato.</div>');
  return `<div class="cd2"><div class="ct"><h2 style="color:var(--gold)"><i class=yl-i-lista></i> Cronograma</h2></div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:14px">${ST.cronoEv==='__suda'
      ? 'Días, sesiones y rondas · hora de pesaje, hora de competencia y número de lote'
      : 'Start list por tarima y flight · entrenador y handlers'}</p>
    <select onchange="cronoSel(this.value)" style="width:100%;max-width:420px;box-sizing:border-box;background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:14px;margin-bottom:8px">
      <option value="">Selecciona campeonato</option>${opts}
    </select>
    ${(evs.length||suda)?'':'<div style="color:var(--muted);padding:6px 0;font-size:13px">No hay cronogramas publicados por el momento.</div>'}
    <div id="cronoMount">${cuerpo}</div>
  </div>`;
}

// ── Cronograma del Sudamericano: día → sesión → ronda → categoría ──
// Es una VISTA de la nómina, no una copia: los atletas salen de NOMSUDA.atletas y
// la sesión de NOMSUDA.jornadas, los dos del Excel final de FESUPO. Si mañana se
// corrige una inscripción, el cronograma cambia con ella y no hay dos listas que
// puedan terminar diciendo cosas distintas.
function _cronoFechaLarga(f){
  // Los nombres van adentro y no en una constante al lado: las declaraciones de
  // esta zona del archivo no llegan a ejecutarse, así que una constante de acá
  // vale undefined al leerla y la sección se cae entera.
  const DIAS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],
        MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(f||''); if(!m)return f||'';
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return `${DIAS[d.getUTCDay()]} ${+m[3]} de ${MESES[+m[2]-1]}`;
}
function cronoSuda(){
  const J=window.NOMSUDA||{}, jor=(J.jornadas||[]).slice(), ats=J.atletas||[];
  if(!jor.length)return '<div style="color:var(--muted);padding:14px">Todavía no hay cronograma publicado.</div>';
  const fechas=[...new Set(jor.map(j=>j.fecha))].sort();
  if(!ST.cronoDia||!fechas.includes(ST.cronoDia))ST.cronoDia=fechas[0];
  // Los días, como botones: es lo que se pidió — apretar el 20 y ver el 20.
  const chips=fechas.map((f,i)=>{
    const on=f===ST.cronoDia;
    return `<button onclick="cronoDia('${f}')" style="padding:8px 13px;border-radius:9px;cursor:pointer;font-family:Oswald;font-size:13px;letter-spacing:1px;border:1px solid ${on?'var(--gold)':'var(--border)'};background:${on?'rgba(212,168,67,.18)':'rgba(10,22,40,.6)'};color:${on?'var(--gold)':'var(--muted)'}">
      DÍA ${i+1}<span style="display:block;font-size:10px;letter-spacing:0;opacity:.8">${+f.slice(8,10)} sep</span></button>`;
  }).join('');

  const delDia=jor.filter(j=>j.fecha===ST.cronoDia)
                  .sort((a,b)=>String(a.inicio).localeCompare(String(b.inicio)));
  let h=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 16px">${chips}</div>`;
  h+=`<h3 style="font-family:Oswald;font-size:15px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:0 0 12px">${_escH(_cronoFechaLarga(ST.cronoDia))}</h3>`;

  delDia.forEach((j,si)=>{
    const mios=ats.filter(a=>a.jornada===j.id);
    const rondas=[...new Set(mios.map(a=>a.ronda||1))].sort((a,b)=>a-b);
    const azul=si%2===0, bd=azul?'#3b82f6':'#c41e3a', bg=azul?'rgba(59,130,246,.08)':'rgba(196,30,58,.08)', hd=azul?'rgba(59,130,246,.20)':'rgba(196,30,58,.20)';
    h+=`<div style="background:${bg};border:1px solid ${bd}55;border-left:5px solid ${bd};border-radius:12px;margin-bottom:16px;overflow:hidden">`;
    h+=`<div style="background:${hd};padding:11px 14px">
      <div style="font-family:Oswald;font-weight:700;letter-spacing:1px;font-size:14px">${_escH(j.nombre||j.campeonato||'')}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">Pesaje ${_escH(j.pesaje||'—')} · Competencia ${_escH(j.inicio||'—')} · ${mios.length} inscripción(es)</div></div>`;
    if(!mios.length){
      h+=`<div style="padding:12px 14px;color:var(--muted);font-size:13px">Sin inscripciones.</div></div>`; return;
    }
    rondas.forEach(r=>{
      const enR=mios.filter(a=>(a.ronda||1)===r);
      // La TANDA es la letra que corre por todo el campeonato: la primera ronda
      // del 20 es la A y la última del 27 la AJ. Es lo que se canta en el pesaje
      // y lo que el operador selecciona en el control en vivo, así que va acá
      // arriba y no en una columna: dentro de una ronda es siempre la misma.
      const tanda=(enR.find(a=>a.tanda)||{}).tanda||'';
      h+=`<div style="padding:9px 14px 3px;font-family:Oswald;font-size:11px;letter-spacing:2px;color:var(--gold);text-transform:uppercase">Ronda ${r}${tanda?' · Tanda '+_escH(tanda):''} · ${enR.length} inscripción(es)</div>`;
      const cats=[...new Set(enR.map(a=>a.cat))].sort((x,y)=>_nsudaCatKey(x)-_nsudaCatKey(y));
      cats.forEach(c=>{
        // Quien compite en Clásico y además en Only Bench tiene DOS inscripciones,
        // pero sube a la tarima una sola vez y con el mismo número de lote. En el
        // cronograma va en una fila, con las dos modalidades juntas: verlo dos
        // veces seguidas se lee como un duplicado de la lista.
        const uno={}, enC=[];
        enR.filter(a=>a.cat===c).forEach(a=>{
          const k=_nsudaNombre(a)+'|'+(a.lote||'');
          if(uno[k]){ if(!uno[k].mods.includes(a.mod))uno[k].mods.push(a.mod); return; }
          uno[k]={...a, mods:[a.mod]}; enC.push(uno[k]);
        });
        enC.sort((x,y)=>(+x.lote||999)-(+y.lote||999)||String(x.n).localeCompare(String(y.n)));
        h+=`<div style="padding:8px 14px 2px;font-family:Oswald;font-size:12px;letter-spacing:1px;color:var(--text)">${_escH(c)} kg</div>`;
        // Ancho fijo: cada categoría es su propia tabla y, sin esto, las columnas
        // se corren de un bloque al siguiente según lo largo que sea un nombre.
        h+=`<div style="overflow-x:auto"><table style="width:100%;min-width:600px;table-layout:fixed;border-collapse:collapse;font-size:13px">
          <colgroup><col style="width:56px"><col style="width:30%"><col style="width:16%"><col style="width:18%"><col></colgroup>
          <tr style="text-align:left;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px;text-transform:uppercase">
            <th style="padding:5px 10px">Lote</th><th style="padding:5px 10px">Atleta</th>
            <th style="padding:5px 10px">País</th><th style="padding:5px 10px">División</th><th style="padding:5px 10px">Modalidad</th></tr>`;
        h+=enC.map(a=>`<tr style="border-top:1px solid ${bd}22">
          <td style="padding:5px 10px;font-family:Oswald;color:var(--gold)">${_escH(a.lote||'—')}</td>
          <td style="padding:5px 10px;font-weight:600">${_escH(_nsudaNombre(a))}</td>
          <td style="padding:5px 10px;color:var(--muted)">${_escH(a.pais||'')}</td>
          <td style="padding:5px 10px;color:var(--muted)">${_escH(a.div||'')}</td>
          <td style="padding:5px 10px;color:var(--muted)">${_escH((a.mods||[a.mod]).join(' + '))}</td></tr>`).join('');
        h+='</table></div>';
      });
    });
    h+='</div>';
  });
  h+=`<p style="font-size:11px;color:var(--muted);margin-top:4px">Días, horarios, tandas y números de lote según la nominación final de FESUPO. El pesaje abre a la hora indicada y cierra 90 minutos después. El número de lote se sortea por sesión: se repite entre sesiones distintas, nunca dentro de la misma.</p>`;
  return h;
}
async function loadCronoSection(ev){
  const mount=document.getElementById('cronoMount'); if(!mount)return;
  try{
    const d=await window.FBQ.getDoc(window.FBQ.doc(fbDB,'cronograma',ev));
    const rows=(d&&d.exists&&d.exists()&&Array.isArray(d.data().rows))?d.data().rows:[];
    const hide=(d&&d.exists&&d.exists()&&d.data().hideCoaches)||false;
    const HMAP={};
    if(!hide){ try{ const hs=await window.FBQ.getDocs(window.FBQ.query(window.FBQ.collection(fbDB,'handlers'),window.FBQ.where('evento','==',ev))); hs.forEach(x=>{HMAP[x.id]=x.data();}); }catch(e){} }
    const el=document.getElementById('cronoMount'); if(el) el.innerHTML=cronoRender(ev,rows,HMAP,hide);
  }catch(e){ const el=document.getElementById('cronoMount'); if(el) el.innerHTML='<div style="color:var(--muted);padding:14px">Este campeonato no tiene cronograma publicado.</div>'; }
}
// Orden de los días del cronograma. El día se escribe a mano ("Día 1", "Sábado 8",
// "sábado"…), así que hay que entender las tres formas. Con el nombre del día suelto
// el orden alfabético dejaba el domingo ANTES del sábado, que es justo al revés de
// como se corre un fin de semana.
const _DIAS_SEMANA=YLDias.SEMANA;
function _cronoDiaKey(d){ return YLDias.clave(d); }   // compartido/dias.js
function _cronoCmpDia(a,b){ return YLDias.comparar(a,b); }
function cronoRender(ev,rows,HMAP,hide){
  if(!rows.length) return '<div style="color:var(--muted);padding:14px">Sin atletas en este cronograma.</div>';
  const _nn=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
  const _slug=s=>_nn(s).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,50);
  const hNames=r=>{const k=ev+'__'+_slug(r.entrenador||'')+'__'+((r.jornada||'1').toString().trim()||'1');const sub=HMAP[k];if(sub&&Array.isArray(sub.handlers)&&sub.handlers.length)return sub.handlers.map(h=>h.nombre).filter(Boolean);const a=[];if((r.handler1||{}).nombre)a.push(r.handler1.nombre);if((r.handler2||{}).nombre)a.push(r.handler2.nombre);return a;};
  const jr=x=>x==='AM'?0:x==='PM'?1:2;
  // El día manda: primero todas las tandas del sábado y después las del domingo.
  // Si el cronograma no tiene días cargados, queda igual que antes.
  const groups={}; rows.forEach(r=>{const k=(r.dia||'')+'||'+(r.tarima||'?')+'||'+(r.jornada||'')+'||'+(r.flight||'?');(groups[k]=groups[k]||[]).push(r);});
  const keys=Object.keys(groups).sort((a,b)=>{const x=a.split('||'),y=b.split('||');
    return _cronoCmpDia(x[0],y[0])||String(x[1]).localeCompare(String(y[1]))||(jr(x[2])-jr(y[2]))||String(x[3]).localeCompare(String(y[3]));});
  let diaPrev=null;
  return keys.map((k,gi)=>{
    const p=k.split('||'),dia=p[0],tar=p[1],jor=p[2],fl=p[3],aths=groups[k];
    const jorTxt=(jor==='AM'||jor==='PM')?(' · '+_escH(jor)):'';
    // Encabezado de día, solo si el cronograma los trae cargados.
    let diaHdr='';
    if(dia&&dia!==diaPrev)diaHdr=`<h3 style="font-family:Oswald;font-size:14px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:${diaPrev===null?'4px':'22px'} 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(212,168,67,.35)">${_escH(dia)}</h3>`;
    diaPrev=dia;
    const blue=gi%2===0, bg=blue?'rgba(59,130,246,.10)':'rgba(196,30,58,.10)', hd=blue?'rgba(59,130,246,.22)':'rgba(196,30,58,.22)', bd=blue?'#3b82f6':'#c41e3a';
    const tr=aths.map((r,i)=>{const hs=hNames(r);return `<tr style="border-top:1px solid ${bd}22">
      <td style="padding:6px 10px;color:var(--muted)">${i+1}</td>
      <td style="padding:6px 10px;font-weight:600">${_escH(r.nombre||'')}</td>
      <td style="padding:6px 10px;color:var(--muted)">${_escH(r.division||'')} ${_escH(r.categoria||'')}</td>
      <td style="padding:6px 10px;color:var(--muted)">${_escH(r.club||'')}</td>
      <td style="padding:6px 10px">${_escH(r.modalidad||'')}</td>
      ${hide?'':`<td style="padding:6px 10px">${_escH(r.entrenador||'—')}</td><td style="padding:6px 10px">${hs.length?hs.map(_escH).join('<br>'):'<span style="color:var(--muted)">—</span>'}</td>`}</tr>`;}).join('');
    return `${diaHdr}<div style="background:${bg};border:1px solid ${bd}55;border-left:5px solid ${bd};border-radius:12px;margin-bottom:14px;overflow:hidden">
      <div style="background:${hd};padding:10px 14px;font-family:Oswald;font-weight:700;letter-spacing:1px">Flight ${_escH(fl)}${jorTxt} <span style="color:var(--muted);font-weight:400;font-size:12px">· ${aths.length} atleta(s)${dia?' · '+_escH(dia):''}</span></div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="text-align:left;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px;text-transform:uppercase"><th style="padding:6px 10px">#</th><th style="padding:6px 10px">Atleta</th><th style="padding:6px 10px">Div/Cat</th><th style="padding:6px 10px">Club</th><th style="padding:6px 10px">Modalidad</th>${hide?'':'<th style="padding:6px 10px">Entrenador</th><th style="padding:6px 10px">Handlers</th>'}</tr>
        ${tr}
      </table></div></div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// CALCULADORA GL POINTS (IPF Good Lift Points 2020)
// Fórmula oficial: GL = 100 × Total / (a - b × e^(-c × BW))
// ═══════════════════════════════════════════════════════════════
// Los coeficientes están en compartido/gl.js (una sola tabla para todo el sitio).
const GL_COEFS = YLGL.COEF;

function calcGL(bw, total, coefKey){
  if(!bw||!total||bw<=0||total<=0)return null;
  // Procedimiento oficial IPF GL: coef redondeado a 6 decimales, luego × total, redondeo a 6 dec.
  const denomRaw=YLGL.divisor(coefKey,bw);
  if(denomRaw===null)return null;
  const coef=Math.round(100/denomRaw*1e6)/1e6;
  return Math.round(coef*total*1e6)/1e6;
}
// Estado local del calculador
if(!window.GLC)window.GLC={sex:'m',eq:'pl',mode:'lifts'};

// Carga los datos del ranking (una vez) para mostrar top 3 de la categoría.
// Extrae la variable D[] de ranking.html.
window._RANK_DATA=null;
async function glcLoadRanking(){
  if(window._RANK_DATA)return window._RANK_DATA;
  try{
    const txt=await fetch('ranking.html').then(r=>r.text());
    const m=txt.match(/var D=(\[[\s\S]*?\]);/);
    if(m){window._RANK_DATA=JSON.parse(m[1]);return window._RANK_DATA;}
  }catch(e){console.warn('[glc] no se pudo cargar ranking',e);}
  window._RANK_DATA=[];
  return window._RANK_DATA;
}
// Mapea modalidad+sexo de la calc al 'tab' del ranking
function glcTab(eq,sex){
  const s=sex==='f'?'f':'m';
  if(eq==='pl')return'cl_'+s;
  if(eq==='ple')return'eq_'+s;
  if(eq==='bo')return'bench_cl_'+s;
  if(eq==='boe')return'bench_eq_'+s;
  return'cl_'+s;
}
// Convierte categoría de peso de la calc ("-83 kg"/"+120 kg") al formato del ranking ("83"/"120+")
function glcCatKey(wcat){
  if(!wcat)return null;
  const plus=wcat.indexOf('+')>=0;
  const num=(wcat.match(/(\d+)/)||[])[1];
  if(!num)return null;
  return num+(plus?'+':'');
}
// Renderiza el top 3 de la categoría detectada
window.glcRenderTop3=async function(eq,sex,wcat){
  const el=document.getElementById('glc_top3');
  if(!el)return;
  const catKey=glcCatKey(wcat);
  if(!catKey){el.innerHTML='';return;}
  const tab=glcTab(eq,sex);
  el.innerHTML='<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px">Cargando ranking…</div>';
  const data=await glcLoadRanking();
  // Filtrar por tab + categoría de peso, ordenar por GL (dt) desc, sin duplicar atleta (mejor GL)
  const seen={};
  const rows=data
    .filter(r=>r.tab===tab && r.c===catKey && (r.dt||0)>0)
    .sort((a,b)=>(b.dt||0)-(a.dt||0))
    .filter(r=>{const k=r.n.toLowerCase();if(seen[k])return false;seen[k]=1;return true;})
    .slice(0,3);
  if(!rows.length){
    el.innerHTML=`<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px">Sin datos de ranking para ${wcat} en esta modalidad</div>`;
    return;
  }
  const medals=['','',''];
  el.innerHTML=`
    <div style="font-family:Oswald;font-size:11px;letter-spacing:3px;color:var(--gold);margin-bottom:12px">TOP 3 · ${wcat} · ${sex==='f'?'MUJERES':'HOMBRES'}</div>
    ${rows.map((r,i)=>`
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:rgba(29,49,80,.2);border-radius:8px;margin-bottom:6px;border-left:3px solid ${i===0?'var(--gold)':i===1?'#c0c0c0':'#cd7f32'}">
        <span style="font-size:20px">${medals[i]}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.n}</div>
          <div style="font-size:10px;color:var(--muted)">${r.t||''} · ${r.tt||0} kg total</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:Oswald;font-size:20px;font-weight:700;color:var(--gold)">${(r.dt||0).toFixed(2)}</div>
          <div style="font-size:9px;color:var(--muted);letter-spacing:1px">GL</div>
        </div>
      </div>`).join('')}`;
};

// Categoría de peso IPF según peso corporal y sexo.
// Incluye -53(M)/-43(F) que solo existen en Sub-Junior/Junior.
function glcWeightCat(bw, sex){
  if(!bw||bw<=0)return null;
  if(sex==='f'){
    if(bw<=43)return'-43 kg';
    if(bw<=47)return'-47 kg';
    if(bw<=52)return'-52 kg';
    if(bw<=57)return'-57 kg';
    if(bw<=63)return'-63 kg';
    if(bw<=69)return'-69 kg';
    if(bw<=76)return'-76 kg';
    if(bw<=84)return'-84 kg';
    return'+84 kg';
  }
  // masculino
  if(bw<=53)return'-53 kg';
  if(bw<=59)return'-59 kg';
  if(bw<=66)return'-66 kg';
  if(bw<=74)return'-74 kg';
  if(bw<=83)return'-83 kg';
  if(bw<=93)return'-93 kg';
  if(bw<=105)return'-105 kg';
  if(bw<=120)return'-120 kg';
  return'+120 kg';
}

// Categorías de peso IPF
const IPF_CATS={
  m:[{max:53,label:'-53 kg'},{max:59,label:'-59 kg'},{max:66,label:'-66 kg'},{max:74,label:'-74 kg'},
     {max:83,label:'-83 kg'},{max:93,label:'-93 kg'},{max:105,label:'-105 kg'},{max:120,label:'-120 kg'},
     {max:Infinity,label:'+120 kg'}],
  f:[{max:44,label:'-44 kg'},{max:48,label:'-48 kg'},{max:52,label:'-52 kg'},{max:57,label:'-57 kg'},
     {max:63,label:'-63 kg'},{max:69,label:'-69 kg'},{max:76,label:'-76 kg'},{max:84,label:'-84 kg'},
     {max:Infinity,label:'+84 kg'}]
};

window.glcSetMode=function(m){
  window.GLC.mode=m;
  const lRow=document.getElementById('glc_lifts_row');
  const tRow=document.getElementById('glc_total_row');
  const btnL=document.getElementById('glc_btn_lifts');
  const btnT=document.getElementById('glc_btn_total');
  if(lRow)lRow.style.display=m==='lifts'?'grid':'none';
  if(tRow)tRow.style.display=m==='total'?'block':'none';
  if(btnL){btnL.style.background=m==='lifts'?'var(--accent)':'rgba(10,22,40,.5)';btnL.style.borderColor=m==='lifts'?'var(--accent)':'var(--border)';btnL.style.color='#fff';}
  if(btnT){btnT.style.background=m==='total'?'var(--blue)':'rgba(10,22,40,.5)';btnT.style.borderColor=m==='total'?'var(--blue)':'var(--border)';btnT.style.color='#fff';}
  window.glcUpdate();
};

window.glcUpdate=function(){
  const bw=parseFloat(document.getElementById('glc_bw')?.value)||0;
  const eq=document.getElementById('glc_eq')?.value||'pl';
  const sex=document.getElementById('glc_sex')?.value||'m';
  const isBO=eq==='bo'||eq==='boe';
  const mode=window.GLC.mode||'lifts';
  let total=0;
  if(mode==='total'){
    total=parseFloat(document.getElementById('glc_tot_inp')?.value)||0;
  }else{
    const sq=isBO?0:(parseFloat(document.getElementById('glc_sq')?.value)||0);
    const bp=parseFloat(document.getElementById('glc_bp')?.value)||0;
    const dl=isBO?0:(parseFloat(document.getElementById('glc_dl')?.value)||0);
    total=sq+bp+dl;
    const sumEl=document.getElementById('glc_sum');
    if(sumEl)sumEl.textContent=total>0?total.toFixed(1):''
  }
  const gl=calcGL(bw,total,eq+'_'+sex);
  // Categoría de peso (se muestra apenas hay peso corporal, aunque falte el total)
  const wcat=glcWeightCat(bw,sex);
  const wcatEl=document.getElementById('glc_wcat');
  if(wcatEl){
    wcatEl.innerHTML = wcat
      ? `<span style="font-family:Oswald;font-size:11px;letter-spacing:2px;color:var(--muted)">CATEGORÍA</span> <span style="font-family:Oswald;font-size:18px;font-weight:700;color:var(--blue);letter-spacing:1px;margin-left:6px">${wcat}</span>`
      : '';
  }
  // Top 3 de la categoría (debounce para no spamear al tipear)
  if(wcat){
    clearTimeout(window._glcTop3T);
    window._glcTop3T=setTimeout(()=>glcRenderTop3(eq,sex,wcat),400);
  }else{
    const t3=document.getElementById('glc_top3');if(t3)t3.innerHTML='';
  }
  const res=document.getElementById('glc_result');
  if(res){
    if(gl!==null){
      let cat='',catColor='var(--gold)';
      if(gl>=100){cat='Elite Internacional';catColor='#f59e0b';}
      else if(gl>=90){cat='Élite Nacional';catColor='#ef4444';}
      else if(gl>=80){cat='Alto Rendimiento';catColor='#f97316';}
      else if(gl>=70){cat='Avanzado';catColor='#eab308';}
      else if(gl>=60){cat='Intermedio';catColor='#3b82f6';}
      else{cat='Principiante';catColor='var(--muted)';}
      res.innerHTML=`<div style="font-family:Oswald;font-size:76px;font-weight:700;color:${catColor};line-height:1;text-shadow:0 0 40px ${catColor}55">${gl.toFixed(2)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${gl.toFixed(6)}</div>
        <div style="font-family:Oswald;font-size:13px;letter-spacing:4px;color:rgba(212,168,67,.8);margin-top:8px">GL POINTS</div>
        <div style="margin-top:14px;font-family:Oswald;font-size:20px;letter-spacing:2px;color:${catColor}">${cat}</div>
        ${wcat?`<div style="margin-top:10px;font-family:Oswald;font-size:14px;letter-spacing:2px;color:var(--blue)">Categoría: ${wcat}</div>`:''}`;
    }else{
      res.innerHTML=`<div style="font-family:Oswald;font-size:48px;color:var(--muted);line-height:1">—</div><div style="font-size:12px;color:var(--muted);margin-top:10px">Completa los campos</div>${wcat?`<div style="margin-top:14px;font-family:Oswald;font-size:16px;letter-spacing:2px;color:var(--blue)">Categoría: ${wcat}</div>`:''}`;
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// PÁGINA DE INICIO (landing)
// ═══════════════════════════════════════════════════════════════
// Organizadores de un evento (soporta lista nueva o campo único viejo)
function _evOrganizers(ev){
  if(ev&&Array.isArray(ev.organizers)&&ev.organizers.length) return ev.organizers.filter(o=>o&&(o.name||o.instagram));
  const nm=(ev&&(ev.organizer||ev.org))||''; const ig=(ev&&ev.instagram)||'';
  return (nm||ig)?[{name:nm,instagram:ig}]:[];
}
// Botón Instagram estilo YourLift (pill oscuro, ícono SVG, hover borde rosa)
function _igPill(handle,small){
  const h=String(handle||'').replace(/^@/,'').trim(); if(!h)return '';
  const url='https://instagram.com/'+encodeURIComponent(h);
  const pad=small?'7px 13px':'9px 16px', fs=small?'11px':'13px', ic=small?15:17;
  return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:7px;color:rgba(235,242,250,.9);text-decoration:none;font-family:Oswald;font-size:${fs};letter-spacing:1px;padding:${pad};border:1px solid rgba(255,255,255,.22);border-radius:30px;background:rgba(255,255,255,.06);backdrop-filter:blur(6px);transition:all .15s;white-space:nowrap" onmouseover="this.style.borderColor='#E1306C';this.style.color='#fff'" onmouseout="this.style.borderColor='rgba(255,255,255,.22)';this.style.color='rgba(235,242,250,.9)'"><svg width="${ic}" height="${ic}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>@${h}</a>`;
}
// Los campeonatos de la portada salen de DOS lados: los que el panel guarda en
// Firestore (window.ALL_EVENTS) y los que viajan en nominas.json (window.NM).
//
// Que estén los dos importa por dos razones. La primera es la velocidad:
// nominas.json es un archivo estático que llega junto con la página, mientras
// que Firestore necesita bajar el SDK antes de poder preguntar nada. Antes la
// portada se pintaba con una lista de tres campeonatos escrita a mano en el
// código —de mayo, ya corridos— y recién después se corregía sola. Ese era el
// parpadeo. La segunda es que hay campeonatos, como los nueve días del
// Sudamericano, que viven solo en nominas.json y por eso no aparecían nunca.
function _homeEvs(){
  // NM._static es la lista tal como vino en nominas.json. Hay que usar esa y no
  // NM.events, porque a NM.events se le pisa el contenido con los eventos de
  // Firestore apenas llegan (y más adelante se filtra a los que vienen de ahí),
  // así que los campeonatos que solo existen en el archivo desaparecerían.
  const nm=(typeof NM!=='undefined'&&NM&&(NM._static||NM.events))||[];
  const fs=(window.ALL_EVENTS||[]);
  const esEnsayo=e=>!!(e&&(e.ensayo||/^\s*ensayo\b/i.test(String(e.name||''))));
  const crudos=[...fs,...nm].filter(e=>
    e && e.date && e.status!=='archived' && !esEnsayo(e)
    && !isNaN(new Date(e.date+'T00:00:00')));

  // Un campeonato de varios días viaja como un evento por jornada, cada uno con
  // parent=<id del campeonato>. En la portada es UN campeonato, no nueve: se
  // juntan en una sola entrada con la fecha del primer día.
  const porParent={}, sueltos=[];
  crudos.forEach(e=>{
    if(!e.parent){sueltos.push(e);return}
    const p=porParent[e.parent];
    if(!p||String(e.date)<String(p.date))porParent[e.parent]={...e,id:e.parent,
      name:String(e.name||'').replace(/\s*[—–-]\s*d[ií]a\s*\d+\s*$/i,'').trim()};
  });

  // Si el mismo campeonato está en los dos lados, manda el de Firestore: es el
  // que se edita desde el panel y por lo tanto el que está al día.
  const vistos={}, fuera=[];
  const clave=e=>String(e.id||'')||String(e.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'')+'|'+e.date;
  [...sueltos,...Object.values(porParent)].forEach(e=>{
    const k=clave(e); if(vistos[k])return; vistos[k]=1; fuera.push(e);
  });
  return fuera.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function home(){
  const months=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const baseName=n=>String(n||'').replace(/\s*[-–]\s*tarima\s*\d+/i,'').trim();
  const evs=_homeEvs();
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const proximos=evs.filter(e=>{const d=new Date(e.date+'T00:00:00');return !isNaN(d)&&d>=today;});
  // Solo campeonatos que TODAVÍA no ocurren. Antes, si no había ninguno futuro,
  // se mostraba el último de la lista: o sea un campeonato ya corrido anunciado
  // como "Próximo campeonato". Con la semilla vieja eso era el de Debutantes, con
  // fecha "2026-XX-XX", y por eso salía con la fecha en "--" hasta que Firebase
  // terminaba de cargar y lo reemplazaba. Mejor no mostrar ninguno.
  let next=(proximos.length?proximos[0]:null);
  if(next) next={...next, name: baseName(next.name)};
  const insOpen=[];const seenBase={};
  evs.forEach(e=>{
    if(e.status!=='open') return;
    if(e.preNominaCloseAt){const c=new Date(e.preNominaCloseAt);if(!isNaN(c)&&now>c) return;}
    const bn=baseName(e.name);
    if(seenBase[bn]) return; seenBase[bn]=1;
    insOpen.push({...e,name:bn});
  });
  // Próximos campeonatos con inscripciones YA cerradas (status:'closed', o 'open' pero
  // con preNominaCloseAt vencido) que todavía no se han corrido — para que se sigan
  // viendo en el home aunque ya no acepten inscripciones.
  const insClosed=[];const seenBaseC={};
  evs.forEach(e=>{
    const d=new Date((e.date||'')+'T00:00:00');
    if(isNaN(d)||d<today) return; // solo próximos (fecha futura o de hoy)
    const preNomPassed=e.preNominaCloseAt&&(()=>{const c=new Date(e.preNominaCloseAt);return !isNaN(c)&&now>c;})();
    const isClosed=e.status==='closed'||(e.status==='open'&&preNomPassed);
    if(!isClosed) return;
    const bn=baseName(e.name);
    if(seenBaseC[bn]) return; seenBaseC[bn]=1;
    insClosed.push({...e,name:bn});
  });

  // Portada: una foto real de tarima a todo el ancho, con el mismo texto,
  // los mismos botones y el Instagram de siempre. En el teléfono la foto va
  // arriba y el texto debajo (ver .yl-hero en index.html).
  let h=`
  <div class="yl-plates" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  <header class="yl-hero">
    <picture><source media="(max-width:640px)" srcset="portada/portada_movil.jpg"><img src="portada/portada.jpg" alt="Atleta en sentadilla en el Sudamericano 2026" fetchpriority="high"></picture>
    <div class="yl-hero-c">
      <img class="yl-hero-logo" src="yourlift_logo_hd.png" alt="YourLift">
      <div class="yl-kick">El powerlifting de Chile</div>
      <h1 class="yl-h1">Cada kilo<br><span>cuenta.</span></h1>
      <p class="yl-hero-p">La tecnología del powerlifting chileno: inscripciones, nóminas, ranking nacional, récords y transmisión en vivo, todo en un solo lugar.</p>
      <div class="yl-cta">
        <button class="yl-btn yl-b-g" onclick="sv('insc')">Inscribirme</button>
        <button class="yl-btn yl-b-o" onclick="sv('nominas')">Ver nóminas</button>
        <button class="yl-btn yl-b-y" onclick="sv('rank')">Ranking</button>
      </div>
      <a href="https://instagram.com/yourlift_oficial" target="_blank" rel="noopener" class="yl-ig" onmouseover="this.style.borderColor='#E1306C';this.style.color='#fff'" onmouseout="this.style.borderColor='rgba(255,255,255,.25)';this.style.color='rgba(235,242,250,.9)'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
        @yourlift_oficial
      </a>
    </div>
  </header>

  ${sponsorStrip()}
  ${liveEmbed()}
  <div style="margin-bottom:34px">
    <h2 class="yl-h2" style="margin-bottom:18px">Próximo Campeonato</h2>`;
  if(!next){
    h+=`<div style="background:rgba(17,34,59,.4);border:1px solid var(--border);border-radius:12px;padding:30px;text-align:center;color:var(--muted)">No hay campeonatos programados por el momento.</div>`;
  }else{
    const d=new Date((next.date||'')+'T00:00:00');
    const dd=isNaN(d)?'--':d.getDate();const mm=isNaN(d)?'':months[d.getMonth()];const yy=isNaN(d)?'':d.getFullYear();
    const nOrgs=_evOrganizers(next);
    const nOrgNames=nOrgs.map(o=>o.name).filter(Boolean).join(' · ');
    const nIgHtml=nOrgs.map(o=>_igPill(o.instagram,false)).join('');
    const nLogo=next.logoUrl||'';
    const cd=cdStr(next.date);
    const cdHtml=cd&&!cd.done&&!cd.unknown
      ?`<div style="display:flex;gap:16px;margin-top:18px">
          <div style="text-align:center"><div style="font-family:Oswald;font-size:38px;font-weight:700;color:var(--gold);line-height:1">${cd.d}</div><div style="font-size:10px;color:var(--muted);letter-spacing:1px">DÍAS</div></div>
          <div style="text-align:center"><div style="font-family:Oswald;font-size:38px;font-weight:700;color:var(--gold);line-height:1">${cd.h}</div><div style="font-size:10px;color:var(--muted);letter-spacing:1px">HRS</div></div>
          <div style="text-align:center"><div style="font-family:Oswald;font-size:38px;font-weight:700;color:var(--gold);line-height:1">${cd.m}</div><div style="font-size:10px;color:var(--muted);letter-spacing:1px">MIN</div></div>
        </div>`
      :(cd&&cd.done?`<div style="margin-top:16px;display:inline-block;background:rgba(196,30,58,.15);border:1px solid var(--accent);color:var(--accent);padding:6px 16px;border-radius:8px;font-family:Oswald;font-size:13px;letter-spacing:2px">EN CURSO / FINALIZADO</div>`:'');
    h+=`<div style="display:flex;flex-wrap:wrap;align-items:center;gap:24px;background:rgba(17,34,59,.6);backdrop-filter:blur(10px);border:1px solid var(--border);border-left:5px solid var(--accent);border-radius:16px;padding:28px 30px">
      <div style="flex-shrink:0;text-align:center;background:rgba(196,30,58,.14);border:1px solid rgba(196,30,58,.4);border-radius:14px;padding:16px 22px;min-width:100px">
        <div style="font-family:Oswald;font-size:48px;font-weight:700;color:var(--accent);line-height:1">${dd}</div>
        <div style="font-family:Oswald;font-size:15px;letter-spacing:2px;color:var(--gold);margin-top:2px">${mm}</div>
        <div style="font-size:11px;color:var(--muted)">${yy}</div>
      </div>
      <div style="flex:1;min-width:240px">
        <div style="font-family:Oswald;font-size:clamp(20px,3vw,28px);font-weight:700;letter-spacing:1px;color:var(--text);text-transform:uppercase;line-height:1.1">${next.name||''}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:8px">${nOrgNames}${next.location?' · '+next.location:''}</div>
        ${cdHtml}
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;align-items:center">
          <button onclick="sv('nominas')" style="padding:11px 22px;background:var(--accent);color:#fff;border:none;border-radius:9px;font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer">VER NÓMINA</button>
          ${nIgHtml}
        </div>
      </div>
      ${nLogo?`<div style="flex-shrink:0;width:clamp(84px,11vw,124px);height:clamp(84px,11vw,124px);background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:10px"><img src="${nLogo}" alt="Logo ${next.name||''}" style="max-width:100%;max-height:100%;object-fit:contain" onerror="this.parentElement.style.display='none'"></div>`:''}
    </div>`;
  }
  h+=`</div>`;

  if(insOpen.length){
    h+=`<div style="margin-bottom:30px">
      <h2 class="yl-h2" style="margin-bottom:6px">Inscripciones Abiertas</h2>
      <p style="font-size:12px;color:var(--muted);margin-bottom:18px">Campeonatos con inscripciones disponibles ahora</p>
      <div style="display:flex;flex-direction:column;gap:10px">`;
    insOpen.forEach(ev=>{
      const d=new Date((ev.date||'')+'T00:00:00');
      const dd=isNaN(d)?'--':d.getDate();const mm=isNaN(d)?'':months[d.getMonth()];const yy=isNaN(d)?'':d.getFullYear();
      let cierreTxt='';
      if(ev.preNominaCloseAt){const c=new Date(ev.preNominaCloseAt);if(!isNaN(c)){const diff=c-now;const dias=Math.floor(diff/864e5);cierreTxt=dias>0?`cierra en ${dias} día${dias!==1?'s':''}`:'cierra hoy';}}
      const eOrgs=_evOrganizers(ev);
      const eOrgNames=eOrgs.map(o=>o.name).filter(Boolean).join(' · ');
      const eIgHtml=eOrgs.map(o=>_igPill(o.instagram,true)).join('');
      h+=`<div style="display:flex;align-items:center;gap:16px;background:rgba(17,34,59,.55);backdrop-filter:blur(8px);border:1px solid var(--border);border-left:4px solid var(--green);border-radius:12px;padding:14px 18px;flex-wrap:wrap">
        <div style="flex-shrink:0;text-align:center;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:8px 14px;min-width:60px">
          <div style="font-family:Oswald;font-size:24px;font-weight:700;color:var(--green);line-height:1">${dd}</div>
          <div style="font-family:Oswald;font-size:10px;letter-spacing:1px;color:rgba(34,197,94,.8)">${mm}</div>
          <div style="font-size:9px;color:var(--muted)">${yy}</div>
        </div>
        ${ev.logoUrl?`<div style="flex-shrink:0;width:48px;height:48px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4px"><img src="${ev.logoUrl}" alt="" style="max-width:100%;max-height:100%;object-fit:contain" onerror="this.parentElement.style.display='none'"></div>`:''}
        <div style="flex:1;min-width:160px">
          <div style="font-family:Oswald;font-size:15px;font-weight:600;letter-spacing:1px;color:var(--text);text-transform:uppercase;line-height:1.15">${ev.name||''}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">${eOrgNames}${ev.location?' · '+ev.location:''}${cierreTxt?` · <span style="color:var(--gold)">${cierreTxt}</span>`:''}</div>
        </div>
        ${eIgHtml}
        <button onclick="sv('insc')" style="flex-shrink:0;padding:10px 20px;background:var(--green);color:#fff;border:none;border-radius:8px;font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer">INSCRIBIRME</button>
      </div>`;
    });
    h+=`</div></div>`;
  }

  if(insClosed.length){
    h+=`<div style="margin-bottom:30px">
      <h2 class="yl-h2" style="margin-bottom:6px">Próximos Campeonatos</h2>
      <p style="font-size:12px;color:var(--muted);margin-bottom:18px">Con inscripciones cerradas — ya en preparación</p>
      <div style="display:flex;flex-direction:column;gap:10px">`;
    insClosed.forEach(ev=>{
      const d=new Date((ev.date||'')+'T00:00:00');
      const dd=isNaN(d)?'--':d.getDate();const mm=isNaN(d)?'':months[d.getMonth()];const yy=isNaN(d)?'':d.getFullYear();
      const eOrgs=_evOrganizers(ev);
      const eOrgNames=eOrgs.map(o=>o.name).filter(Boolean).join(' · ');
      const eIgHtml=eOrgs.map(o=>_igPill(o.instagram,true)).join('');
      h+=`<div style="display:flex;align-items:center;gap:16px;background:rgba(17,34,59,.45);backdrop-filter:blur(8px);border:1px solid var(--border);border-left:4px solid var(--muted);border-radius:12px;padding:14px 18px;flex-wrap:wrap;opacity:.9">
        <div style="flex-shrink:0;text-align:center;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:10px;padding:8px 14px;min-width:60px">
          <div style="font-family:Oswald;font-size:24px;font-weight:700;color:var(--text);line-height:1">${dd}</div>
          <div style="font-family:Oswald;font-size:10px;letter-spacing:1px;color:var(--muted)">${mm}</div>
          <div style="font-size:9px;color:var(--muted)">${yy}</div>
        </div>
        ${ev.logoUrl?`<div style="flex-shrink:0;width:48px;height:48px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4px"><img src="${ev.logoUrl}" alt="" style="max-width:100%;max-height:100%;object-fit:contain" onerror="this.parentElement.style.display='none'"></div>`:''}
        <div style="flex:1;min-width:160px">
          <div style="font-family:Oswald;font-size:15px;font-weight:600;letter-spacing:1px;color:var(--text);text-transform:uppercase;line-height:1.15">${ev.name||''}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">${eOrgNames}${ev.location?' · '+ev.location:''} · <span style="color:var(--muted)">Inscripciones cerradas</span></div>
        </div>
        ${eIgHtml}
        <button onclick="sv('nominas')" style="flex-shrink:0;padding:10px 20px;background:transparent;border:1px solid var(--border);color:var(--text);border-radius:8px;font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer">VER NÓMINA</button>
      </div>`;
    });
    h+=`</div></div>`;
  }
  h+=`<section class="yl-lid" id="ylLideres">${typeof _lideresHtml==='function'?_lideresHtml():''}</section>`;
  return h;
}

function renderEntrenadoresPub(){
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const list=window._ENTRENADORES_PUB||[];
  if(!list.length){
    return `<div style="padding:40px 20px;text-align:center">
      <div style="font-family:Oswald;font-size:20px;letter-spacing:2px;color:var(--gold);margin-bottom:8px">ENTRENADORES ACREDITADOS</div>
      <div style="color:var(--muted);font-size:13px">Cargando…</div>
    </div>`;
  }
  const clubs=[...new Set(list.map(e=>e.club).filter(Boolean))].sort();
  let h=`<div style="font-family:Oswald;font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:6px">ENTRENADORES <span style="color:var(--gold)">ACREDITADOS</span></div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:20px">${list.length} entrenador${list.length!==1?'es':''} · FECHIPO</div>`;
  // Ésta es la pantalla donde mira quien anda buscando algo de entrenadores, así
  // que acá tiene que estar el formulario abierto. Antes solo salía en la pestaña
  // de inscripción, que es la del atleta.
  h+=_avisoEntrenadores();
  for(const club of clubs){
    const members=list.filter(e=>e.club===club);
    const lg=window.clubLogoImg?window.clubLogoImg(club,22,'background:rgba(10,22,40,.4);padding:1px;vertical-align:middle;margin-right:6px;'):'';
    h+=`<div style="margin-bottom:20px">
      <div style="font-family:Oswald;font-size:13px;letter-spacing:1.5px;color:var(--gold);border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:8px;display:flex;align-items:center;gap:6px">${lg}${esc(club)}</div>
      ${members.map(e=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <div style="font-size:14px">${esc(e.nombre||'')}</div>
        ${e.categoria?`<div style="font-size:11px;color:var(--muted);background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.2);border-radius:6px;padding:2px 8px">${esc(e.categoria)}</div>`:''}
      </div>`).join('')}
    </div>`;
  }
  const sinClub=list.filter(e=>!e.club);
  if(sinClub.length){
    h+=`<div style="margin-bottom:20px">
      <div style="font-family:Oswald;font-size:13px;letter-spacing:1.5px;color:var(--muted);border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:8px">SIN CLUB</div>
      ${sinClub.map(e=>`<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:14px">${esc(e.nombre||'')}</div>`).join('')}
    </div>`;
  }
  return h;
}

function renderTerminos(){
  const sec=(title,body)=>`
    <div style="margin-bottom:28px">
      <div style="font-family:Oswald;font-size:14px;font-weight:700;letter-spacing:2px;color:var(--gold);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(212,168,67,.2)">${title}</div>
      <div style="font-size:13px;color:rgba(180,200,230,.8);line-height:1.85">${body}</div>
    </div>`;
  return `
  <div style="max-width:820px;margin:0 auto;padding:8px 0 40px">
    <div style="font-family:Oswald;font-size:24px;font-weight:700;letter-spacing:3px;margin-bottom:4px">POLÍTICA DE <span style="color:var(--gold)">PRIVACIDAD</span></div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:32px">Última actualización: ${new Date().getFullYear()} · Ley N° 19.628 y Ley N° 21.719 sobre Protección de Datos Personales</div>

    ${sec('1. RESPONSABLE DEL TRATAMIENTO',`
      <b style="color:#fff">Federación Chilena de Powerlifting (FECHIPO)</b> es la entidad responsable del tratamiento de los datos personales
      recopilados a través de la plataforma YourLift.<br><br>
      Contacto: <a href="mailto:fechipocontacto@gmail.com" style="color:var(--gold)">fechipocontacto@gmail.com</a>
    `)}

    ${sec('2. DATOS QUE RECOPILAMOS',`
      Para el desarrollo de las actividades deportivas y la gestión de competencias, FECHIPO recopila los siguientes datos personales:<br><br>
      <ul style="padding-left:18px;margin:0;display:flex;flex-direction:column;gap:6px">
        <li><b style="color:#ccc">Identificación:</b> nombre completo, RUT (número de identificación nacional), fecha de nacimiento, sexo.</li>
        <li><b style="color:#ccc">Deportivos:</b> club de pertenencia, categoría de peso, modalidad, resultados de competencias (pesos levantados, total, puntos GL), récords y logros.</li>
        <li><b style="color:#ccc">Documentos de acreditación:</b> fotografía de carnet, carnet de identidad (anverso y reverso), certificado de antidopaje (WADE), formulario de consentimiento IPF, pasaporte (cuando corresponda).</li>
        <li><b style="color:#ccc">Contacto:</b> correo electrónico (voluntario, solo para notificaciones).</li>
      </ul>
    `)}

    ${sec('3. FINALIDAD Y BASE LEGAL',`
      Los datos son tratados exclusivamente para:<br><br>
      <ul style="padding-left:18px;margin:0;display:flex;flex-direction:column;gap:6px">
        <li>Gestionar inscripciones y acreditaciones en competencias oficiales de powerlifting.</li>
        <li>Publicar resultados deportivos, ranking nacional y récords nacionales.</li>
        <li>Cumplir obligaciones ante organismos internacionales afiliados (IPF, FESUPO).</li>
        <li>Emitir certificados de participación y logros deportivos.</li>
        <li>Llevar el historial deportivo del atleta.</li>
      </ul><br>
      La base legal del tratamiento es el <b style="color:#ccc">consentimiento del titular</b> al momento de inscribirse en una competencia, y el <b style="color:#ccc">interés legítimo</b> de la federación para el desarrollo de la actividad deportiva, conforme a los artículos 4° y 5° de la Ley N° 19.628.
    `)}

    ${sec('4. PUBLICIDAD DE LOS DATOS',`
      Los resultados deportivos (nombre, club, categoría, pesos levantados, total, posición) son de carácter público, en concordancia con la naturaleza de las competencias oficiales y los estándares internacionales del deporte de fuerza.<br><br>
      Los documentos de acreditación (carnet, WADE, etc.) son de acceso <b style="color:#ccc">estrictamente restringido</b> al personal autorizado de FECHIPO y no son publicados ni compartidos con terceros.
    `)}

    ${sec('5. DERECHOS DEL TITULAR',`
      De conformidad con la Ley N° 19.628 y la Ley N° 21.719, todo atleta tiene derecho a:<br><br>
      <ul style="padding-left:18px;margin:0;display:flex;flex-direction:column;gap:6px">
        <li><b style="color:#ccc">Acceso:</b> conocer qué datos personales suyos están almacenados en nuestros sistemas.</li>
        <li><b style="color:#ccc">Rectificación:</b> corregir datos inexactos o desactualizados.</li>
        <li><b style="color:#ccc">Cancelación / Eliminación:</b> solicitar la eliminación de sus datos cuando ya no sean necesarios para los fines para los que fueron recopilados, o cuando retire su consentimiento.</li>
        <li><b style="color:#ccc">Oposición:</b> oponerse al tratamiento de sus datos en circunstancias justificadas.</li>
        <li><b style="color:#ccc">Portabilidad:</b> recibir sus datos en formato legible cuando corresponda.</li>
      </ul><br>
      <b style="color:var(--gold)">Para ejercer cualquiera de estos derechos</b>, envía un correo a
      <a href="mailto:fechipocontacto@gmail.com" style="color:var(--gold)">fechipocontacto@gmail.com</a>
      indicando tu nombre completo, RUT y la solicitud específica. FECHIPO responderá en un plazo máximo de 30 días hábiles.
    `)}

    ${sec('6. PLAZO DE CONSERVACIÓN',`
      Los datos deportivos (resultados, records, historial) se conservan de forma indefinida en tanto formen parte del historial oficial de competencias de FECHIPO.<br><br>
      Los documentos de acreditación se conservan por el período mínimo necesario para cumplir con los requisitos de la competencia y las obligaciones ante organismos internacionales, y son eliminados o anonimizados transcurridos 5 años desde la última competencia del atleta, salvo solicitud de eliminación anticipada.
    `)}

    ${sec('7. SEGURIDAD',`
      FECHIPO implementa medidas técnicas y organizativas para proteger los datos personales contra accesos no autorizados, pérdida, destrucción o divulgación, incluyendo control de acceso por roles, autenticación segura y almacenamiento cifrado en servicios de nube certificados (Google Firebase).
    `)}

    ${sec('8. TRANSFERENCIA INTERNACIONAL',`
      En el marco de las competencias internacionales, ciertos datos identificativos (nombre, categoría, resultados) pueden ser compartidos con la International Powerlifting Federation (IPF) y la Federación Sudamericana de Powerlifting (FESUPO), organizaciones que cuentan con sus propias políticas de protección de datos.
    `)}

    ${sec('9. COOKIES Y ANALÍTICA',`
      YourLift puede utilizar datos de navegación anónimos para mejorar la experiencia del usuario. No se utilizan cookies de rastreo comercial ni se comparten datos de navegación con terceros.
    `)}

    ${sec('10. MODIFICACIONES',`
      FECHIPO se reserva el derecho de actualizar esta política para adaptarla a cambios normativos o funcionales de la plataforma. La fecha de última actualización siempre estará visible al inicio de este documento.
    `)}

    <div style="margin-top:32px;padding:16px 20px;background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.2);border-radius:10px;font-size:12px;color:rgba(180,200,230,.7);line-height:1.7">
      ¿Tienes preguntas sobre el uso de tus datos? Escríbenos a
      <a href="mailto:fechipocontacto@gmail.com" style="color:var(--gold)">fechipocontacto@gmail.com</a>
      o usa el formulario de contacto al pie de esta página.
    </div>
  </div>`;
}

function glcalc(){
  const g=window.GLC;
  const selStyle='background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:12px 16px;font-size:15px;font-family:Oswald;outline:none;cursor:pointer;width:100%';
  const inpStyle='background:rgba(10,22,40,.6);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:14px 16px;font-size:22px;font-family:Oswald;font-weight:700;outline:none;width:100%;text-align:center;transition:border-color .15s';
  const lbl=(t)=>`<div style="font-family:Oswald;font-size:10px;letter-spacing:3px;color:var(--muted);margin-bottom:8px">${t}</div>`;
  const isBO=g.eq==='bo'||g.eq==='boe';
  return `
  <div class="cd2" style="max-width:1000px;margin:0 auto">
    <h2 style="font-family:Oswald;font-size:22px;letter-spacing:3px;margin-bottom:4px"><i class=yl-i-lista></i> CALCULADORA GL POINTS</h2>
    <p style="font-size:11px;color:var(--muted);margin-bottom:22px">Fórmula oficial IPF · Solo kilogramos</p>

    <div class="glc-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">

      <!-- ===== IZQUIERDA: RESULTADO + TOP3 ===== -->
      <div>
        <div style="background:linear-gradient(135deg,rgba(212,168,67,.07),rgba(212,168,67,.02));border:2px solid rgba(212,168,67,.35);border-radius:18px;padding:40px 24px;text-align:center;margin-bottom:18px;position:sticky;top:10px">
          <div id="glc_result">
            <div style="font-family:Oswald;font-size:56px;color:var(--muted);line-height:1">—</div>
            <div style="font-size:12px;color:var(--muted);margin-top:10px">Completa los campos</div>
          </div>
        </div>
        <div id="glc_top3" style="background:rgba(10,22,40,.4);border:1px solid var(--border);border-radius:12px;padding:14px;min-height:20px"></div>
      </div>

      <!-- ===== DERECHA: FORMULARIO ===== -->
      <div>
        <!-- MODO -->
        <div style="display:flex;gap:10px;margin-bottom:18px">
          <button id="glc_btn_lifts" onclick="glcSetMode('lifts')" style="flex:1;padding:12px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:#fff;font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:2px;cursor:pointer">SQ + BP + DL</button>
          <button id="glc_btn_total" onclick="glcSetMode('total')" style="flex:1;padding:12px;border-radius:10px;border:1px solid var(--border);background:rgba(10,22,40,.5);color:#fff;font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:2px;cursor:pointer">TOTAL DIRECTO</button>
        </div>

        <!-- SQ BP DL -->
        <div id="glc_lifts_row" style="display:grid;grid-template-columns:${isBO?'1fr':'1fr 1fr 1fr'};gap:10px;margin-bottom:14px">
          ${!isBO?`<div>${lbl('SQUAT (kg)')}<input id="glc_sq" type="number" min="0" step="0.5" placeholder="0" oninput="glcUpdate()" style="${inpStyle}" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></div>`:''}
          <div>${lbl('BENCH (kg)')}<input id="glc_bp" type="number" min="0" step="0.5" placeholder="0" oninput="glcUpdate()" style="${inpStyle}" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></div>
          ${!isBO?`<div>${lbl('DEADLIFT (kg)')}<input id="glc_dl" type="number" min="0" step="0.5" placeholder="0" oninput="glcUpdate()" style="${inpStyle}" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></div>`:''}
        </div>
        <div id="glc_sum_row" style="text-align:center;margin-bottom:14px;font-family:Oswald;font-size:13px;letter-spacing:2px;color:var(--muted)">TOTAL: <span id="glc_sum" style="color:var(--gold)"></span></div>

        <!-- TOTAL DIRECTO -->
        <div id="glc_total_row" style="display:none;margin-bottom:14px">
          ${lbl('TOTAL (kg)')}
          <input id="glc_tot_inp" type="number" min="0" step="0.5" placeholder="0" oninput="glcUpdate()" style="${inpStyle}" onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'">
        </div>

        <!-- BW -->
        <div style="margin-bottom:14px">
          ${lbl('PESO CORPORAL (kg)')}
          <input id="glc_bw" type="number" min="0" step="0.1" placeholder="0.0" oninput="glcUpdate()" style="${inpStyle}" onfocus="this.style.borderColor='var(--green)'" onblur="this.style.borderColor='var(--border)'">
        </div>

        <!-- MODALIDAD + SEXO -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            ${lbl('MODALIDAD')}
            <select id="glc_eq" onchange="window.GLC.eq=this.value;render()" style="${selStyle}">
              <option value="pl"  ${g.eq==='pl' ?'selected':''}>Classic PL</option>
              <option value="ple" ${g.eq==='ple'?'selected':''}>Equipado PL</option>
              <option value="bo"  ${g.eq==='bo' ?'selected':''}>Classic Bench</option>
              <option value="boe" ${g.eq==='boe'?'selected':''}>Equip. Bench</option>
            </select>
          </div>
          <div>
            ${lbl('SEXO')}
            <select id="glc_sex" onchange="glcUpdate()" style="${selStyle}">
              <option value="m" ${g.sex==='m'?'selected':''}>Hombre</option>
              <option value="f" ${g.sex==='f'?'selected':''}>Mujer</option>
            </select>
          </div>
        </div>
      </div>

    </div>
  </div>`;
}
  const _igSvg='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>';
  h+=`<div style="width:100vw;position:relative;left:50%;transform:translateX(-50%);margin-top:60px;border-top:1px solid rgba(212,168,67,.15);background:#040912;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)">
    <div style="max-width:1100px;margin:0 auto;padding:48px 24px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:40px">

      <!-- Col 1: FECHIPO -->
      <div>
        <img src="YourLift_logo.png" alt="YourLift" style="height:64px;width:auto;object-fit:contain;margin-bottom:18px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5))" onerror="this.style.display='none'">
        <div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:2px;color:#fff;margin-bottom:8px">FEDERACIÓN CHILENA DE POWERLIFTING</div>
        <div style="font-size:12px;color:rgba(180,200,230,.6);line-height:1.7;margin-bottom:16px">Promoviendo la excelencia en el powerlifting y el desarrollo integral de atletas de fuerza en Chile.</div>
        <div style="font-size:11px;color:rgba(212,168,67,.8);font-family:Oswald;letter-spacing:1px;margin-bottom:8px">AFILIADOS A</div>
        <div style="font-size:12px;color:rgba(180,200,230,.6);line-height:1.9">
          <a href="https://www.powerlifting.sport" target="_blank" rel="noopener" style="color:rgba(180,200,230,.7);text-decoration:none;display:flex;align-items:center;gap:6px;margin-bottom:2px"><i class=yl-i-globo></i> IPF — International Powerlifting Federation</a>
          <a href="https://fesupo.org" target="_blank" rel="noopener" style="color:rgba(180,200,230,.7);text-decoration:none;display:flex;align-items:center;gap:6px"><i class=yl-i-globo></i> FESUPO — Federación Sudamericana de Powerlifting</a>
        </div>
        <div style="margin-top:16px">
          <a href="https://www.instagram.com/yourlift_oficial" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;text-decoration:none;color:#fff" title="Instagram @yourlift_oficial">${_igSvg}</a>
        </div>
      </div>

      <!-- Col 2: Links YourLift -->
      <div>
        <div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:2px;color:#fff;margin-bottom:16px">YOURLIFT</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <span onclick="sv('nominas');closeMenu()" style="font-size:13px;color:rgba(180,200,230,.7);cursor:pointer;transition:color .2s" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">Nóminas</span>
          <span onclick="sv('rank');closeMenu()" style="font-size:13px;color:rgba(180,200,230,.7);cursor:pointer;transition:color .2s" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">Ranking Nacional</span>
          <span onclick="sv('records');closeMenu()" style="font-size:13px;color:rgba(180,200,230,.7);cursor:pointer;transition:color .2s" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">Récords Nacionales</span>
          <span onclick="sv('atletas');closeMenu()" style="font-size:13px;color:rgba(180,200,230,.7);cursor:pointer;transition:color .2s" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">Atletas</span>
          <span onclick="sv('entrenadores');closeMenu()" style="font-size:13px;color:rgba(180,200,230,.7);cursor:pointer;transition:color .2s" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">Entrenadores</span>
          <span onclick="sv('insc');closeMenu()" style="font-size:13px;color:rgba(180,200,230,.7);cursor:pointer;transition:color .2s" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">Inscripciones</span>
          <span onclick="sv('crono');closeMenu()" style="font-size:13px;color:rgba(180,200,230,.7);cursor:pointer;transition:color .2s" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">Cronograma</span>
        </div>
      </div>

      <!-- Col 3: Contacto -->
      <div>
        <div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:2px;color:#fff;margin-bottom:16px">CONTACTO</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <a href="mailto:fechipocontacto@gmail.com" style="display:flex;align-items:center;gap:10px;font-size:12px;color:rgba(180,200,230,.7);text-decoration:none" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">
            <span style="font-size:16px"><i class=yl-i-correo></i></span> fechipocontacto@gmail.com
          </a>
          <a href="https://www.instagram.com/yourlift_oficial" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;font-size:12px;color:rgba(180,200,230,.7);text-decoration:none" onmouseover="this.style.color='#D4A843'" onmouseout="this.style.color='rgba(180,200,230,.7)'">
            <span style="display:flex;align-items:center;color:rgba(180,200,230,.7)">${_igSvg}</span> @yourlift_oficial
          </a>
          <button onclick="document.getElementById('modalSugerencia').style.display='flex'" style="margin-top:8px;padding:10px 18px;background:rgba(212,168,67,.15);border:1px solid rgba(212,168,67,.4);border-radius:8px;color:#D4A843;font-family:Oswald;font-size:13px;letter-spacing:1px;cursor:pointer;text-align:left;width:fit-content"><i class=yl-i-correo></i> Envíanos un mensaje</button>
        </div>
      </div>
    </div>

    <!-- Bottom bar -->
    <div style="border-top:1px solid rgba(255,255,255,.06);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;max-width:1100px;margin:0 auto">
      <div style="font-size:11px;color:rgba(180,200,230,.4);font-family:Oswald;letter-spacing:1px">© ${new Date().getFullYear()} FECHIPO · Federación Chilena de Powerlifting · Todos los derechos reservados</div>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <span onclick="sv('terminos');closeMenu()" style="font-size:11px;color:rgba(180,200,230,.35);cursor:pointer;text-decoration:underline;text-decoration-color:rgba(180,200,230,.2)" onmouseover="this.style.color='rgba(212,168,67,.7)'" onmouseout="this.style.color='rgba(180,200,230,.35)'">Política de Privacidad</span>
        <div style="font-size:11px;color:rgba(180,200,230,.4)">Resultados vía <a href="https://www.openpowerlifting.org" target="_blank" rel="noopener" style="color:rgba(212,168,67,.6);text-decoration:none">OpenPowerlifting.org</a></div>
      </div>
    </div>
  </div>

  <!-- Modal Sugerencias -->
  <div id="modalSugerencia" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;align-items:center;justify-content:center;padding:20px">
    <div style="background:#0d1526;border:1px solid rgba(212,168,67,.25);border-radius:14px;padding:32px;width:100%;max-width:460px;position:relative">
      <button onclick="document.getElementById('modalSugerencia').style.display='none'" style="position:absolute;top:14px;right:14px;background:none;border:none;color:rgba(180,200,230,.5);font-size:20px;cursor:pointer;line-height:1">×</button>
      <div style="font-family:Oswald;font-size:16px;font-weight:700;letter-spacing:2px;color:#fff;margin-bottom:20px">ENVÍANOS UN MENSAJE</div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <input id="sgNombre" type="text" placeholder="Tu nombre" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 14px;color:#fff;font-size:13px;outline:none">
        <input id="sgCorreo" type="email" placeholder="Tu correo electrónico" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 14px;color:#fff;font-size:13px;outline:none">
        <textarea id="sgMensaje" placeholder="Tu mensaje..." rows="4" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 14px;color:#fff;font-size:13px;outline:none;resize:vertical"></textarea>
        <div id="sgStatus" style="font-size:12px;color:rgba(180,200,230,.6);min-height:18px"></div>
        <button onclick="enviarSugerencia()" style="padding:12px;background:#D4A843;border:none;border-radius:8px;color:#040912;font-family:Oswald;font-size:14px;font-weight:700;letter-spacing:1px;cursor:pointer">ENVIAR</button>
      </div>
    </div>
  </div>`;
  app.innerHTML=h;if(!ST.sel&&ST.v==="list"){const i=app.querySelector('.fl input');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}}
  const cs=document.querySelector('.corner-stack');
  if(cs)cs.style.display='flex';
  const clogo=document.querySelector('.corner-stack .corner-logo');
  if(clogo)clogo.style.display='block';
  // Reaplicar el video de fondo + ocultar el fondo opaco del hero (el render
  // reconstruye el DOM, así que hay que volver a aplicarlo en cada render).
  if(typeof setBgForSection==='function')setBgForSection(ST.v);
}

async function cargarParaVista(v){
  if(!fbReady)return;
  const una=(k,fn)=>{ if(window._yaPedido[k])return null; window._yaPedido[k]=true; return fn(); };
  const tareas=[];
  if(v==='nominas'){
    // Las inscripciones se vuelven a pedir cada vez que se entra: a diferencia de
    // las fotos, cambian solas —alguien se inscribe, el admin aprueba— y la
    // pestaña ya tiene su propio refresco cada tres minutos mientras se mira.
    tareas.push(loadFBNominas());
    tareas.push(loadFBEntrenadores());
    tareas.push(loadFBFormsEnt());
    tareas.push(una('nsudafotos',async()=>{

  // ── Fotos de la nómina Sudamericano (para las fichas): caché 1h ──
  try{
    const cf=_fsCache('nsudafotos',60*60*1000);
    if(cf){window.NSUDA_FOTOS=cf;if(ST.v==='nominas')renderFondo();}
    else{
      const fs=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'nomina_suda_fotos'));
      const map={};fs.docs.forEach(d=>{const x=d.data();if(x.foto_url)map[d.id]=x.foto_url;});
      window.NSUDA_FOTOS=map;_fsSetCache('nsudafotos',map);if(ST.v==='nominas')renderFondo();
    }
  }catch(e){console.warn('[nsudafotos]',e);}
  
    }));
    tareas.push(una('atlfotos',async()=>{

  // ── Fotos de PERFIL por código (atleta_fotos) — para que los chilenos que ya
  // tienen foto se vean en la nómina sin volver a subirlas ──
  try{
    const cp=_fsCache('atlfotos',60*60*1000);
    if(cp){window.ATL_FOTOS=cp;if(ST.v==='nominas')renderFondo();}
    else{
      const ps=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'atleta_fotos'));
      const map={};ps.docs.forEach(d=>{const x=d.data();if(x.foto_url&&x.status!=='rejected')map[d.id]=x.foto_url;});
      window.ATL_FOTOS=map;_fsSetCache('atlfotos',map);if(ST.v==='nominas')renderFondo();
    }
  }catch(e){console.warn('[atlfotos]',e);}
  
    }));
  }
  if(v==='entrenadores'){
    tareas.push(loadFBFormsEnt());
    tareas.push(una('entrenadores',async()=>{
// ── Entrenadores: getDocs + caché 2h ──
  try{
    const et=_fsCache('entrenadores',2*60*60*1000);
    if(et){window._ENTRENADORES_PUB=et;if(ST.v==='entrenadores')renderFondo();}
    else{const es=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'entrenadores'));const list=es.docs.map(d=>d.data()).filter(e=>e.nombre).sort((a,b)=>(a.club||'').localeCompare(b.club||'')||(a.nombre||'').localeCompare(b.nombre||''));_fsSetCache('entrenadores',list);window._ENTRENADORES_PUB=list;if(ST.v==='entrenadores')renderFondo();}
  }catch(e){}
    }));
  }
  await Promise.allSettled(tareas.filter(Boolean));
}

function sv(v){ST.v=v;ST.sel=null;ST.p=0;render();scrollTo(0,0);cargarParaVista(v);if(typeof setBgForSection==='function')setBgForSection(v);if(typeof trackPage==='function')trackPage(v)}

// Solo la lista, nunca el campo. Antes esto llamaba a render() y devolvía el
// foco por programa: el campo moría y volvía a nacer en cada letra, y en el
// teléfono eso cierra el teclado. Sin tocar el campo no hay foco que devolver.
function _pintarLista(){const c=document.getElementById('atlLista');if(c)c.innerHTML=lstResultados();else render();}

function ss(v){ST.s=v;ST.p=0;if(_ssTimer)clearTimeout(_ssTimer);_ssTimer=setTimeout(_pintarLista,250)}

function sl(c){ST.sel=D.find(a=>a.codigo===c);render();scrollTo(0,0)}

function bk(){ST.sel=null;render()}

function mp(){ST.p++;_pintarLista()}

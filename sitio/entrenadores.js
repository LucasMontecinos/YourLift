// index.html — entrenadores: su nómina y su página pública.
//
// Parte del código de index.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

   // eventoId -> [entrenadores aprobados]
function _aplicaEntrenadores(todos){
  const m={};
  (todos||[]).forEach(e=>{
    if(!e||e.status!=='approved')return;
    (m[e.evento]=m[e.evento]||[]).push(e);
  });
  Object.values(m).forEach(l=>l.sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es')));
  window.ENTRE_NOM=m;
}

// El entrenador no tiene cómo saber que su formulario existe si no se lo dicen
// justo donde va a buscarlo, que es la pestaña de inscripción. Solo aparece
// cuando hay algún campeonato con ese período abierto.
function _fechaHoyISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

async function loadFBFormsEnt(force){
  if(!fbReady)return;
  try{
    if(!force){
      const c=_fsCache('formularios_entrenador',5*60*1000);
      if(c){window.FORMS_ENT=c;return;}
    }
    const snap=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'formularios_entrenador'));
    const all=[];snap.forEach(d=>all.push({id:d.id,...d.data()}));
    _fsSetCache('formularios_entrenador',all);
    window.FORMS_ENT=all;
  }catch(e){console.warn('Error loading formularios_entrenador',e)}
}

function _conEntrenadoresAbierto(){
  return (window.FORMS_ENT||[]).filter(f=>{
    if(!f||!f.abierto)return false;
    const c=String(f.cierra||'').trim();
    return !c||_fechaHoyISO()<=c;
  });
}

function _avisoEntrenadores(){
  const l=_conEntrenadoresAbierto();
  if(!l.length)return '';
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<div style="background:rgba(30,91,168,.1);border:1px solid rgba(30,91,168,.4);border-radius:12px;padding:16px 18px;margin-bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
    <div style="flex:1;min-width:220px">
      <div style="font-family:Oswald;font-size:14px;letter-spacing:1px;color:#8ab4e8">¿ERES ENTRENADOR?</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.55">
        ${l.length===1?'Está abierto <b>'+esc(l[0].nombre||'')+'</b>':'Hay '+l.length+' formularios abiertos'}.
        Es aparte del de los atletas: llenas tus datos y subes tus documentos.
      </div>
    </div>
    <a href="inscripcion_entrenador.html" style="padding:11px 20px;border-radius:8px;background:var(--blue,#1E5BA8);color:#fff;font-family:Oswald;font-size:12px;letter-spacing:1px;text-decoration:none;white-space:nowrap">INSCRIBIRME COMO ENTRENADOR</a>
  </div>`;
}

async function loadFBEntrenadores(force){
  if(!fbReady)return;
  try{
    if(!force){
      const c=_fsCache('inscripciones_entrenador',5*60*1000);
      if(c){_aplicaEntrenadores(c);return;}
    }
    const snap=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'inscripciones_entrenador'));
    const all=[];snap.forEach(d=>all.push({id:d.id,...d.data()}));
    _fsSetCache('inscripciones_entrenador',all);
    _aplicaEntrenadores(all);
  }catch(e){console.warn('Error loading entrenadores',e)}
}

// El bloque que se dibuja dentro de la tarjeta del campeonato. Si ese campeonato
// no tiene entrenadores inscritos, no sale nada: no todos los campeonatos abren
// este período y una sección vacía solo estorba.
function _nomEntrenadores(ev){
  const l=(window.ENTRE_NOM||{})[ev.id]||(window.ENTRE_NOM||{})[ev.name]||[];
  if(!l.length)return '';
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">
    <div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:10px">
      ENTRENADORES · ${l.length}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:9px">
      ${l.map(e=>`<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
        <div style="font-weight:600;font-size:13px">${esc(e.nombre||'')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${esc(e.club||'Sin club')}</div>
        ${(e.atletas||[]).length?`<div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.6">
          ${e.atletas.map(a=>esc(a.nombre)).join('<br>')}</div>`:''}
      </div>`).join('')}
    </div>
  </div>`;
}

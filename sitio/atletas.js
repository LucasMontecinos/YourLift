// index.html — atletas: la ficha, los cumpleaños y las correcciones del panel sobre la base.
//
// Parte del código de index.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

function _indexEdit(ed){
  // El marcador de versión no es una edición, y una baja tampoco: la baja saca al
  // atleta del padrón, pero no tiene por qué reescribirle el nombre a una fila de
  // inscripción que ya está hecha.
  if(!ed||ed.id===(window.YLEdiciones&&window.YLEdiciones.MARCA)||ed.deleted)return;
  // Si hay dos documentos para la misma persona, manda el más nuevo.
  const gana=(vieja)=>!vieja||(ed.ts||0)>=(vieja.ts||0);
  if(ed.rut){const k=_rutNormE(ed.rut);if(k&&gana(window.EDITS_BY_RUT[k]))window.EDITS_BY_RUT[k]=ed;}
  if(ed.codigo&&gana(window.EDITS_BY_COD[ed.codigo]))window.EDITS_BY_COD[ed.codigo]=ed;
}

// Aplica el overlay de edits a un objeto cualquiera que tenga rut y/o codigo.
// Devuelve el objeto modificado (muta in-place). Campos: nombre, club, etc.
function applyEditOverlay(obj){
  if(!obj)return obj;
  let ed=null;
  if(obj.rut){ed=window.EDITS_BY_RUT[_rutNormE(obj.rut)];}
  if(!ed&&obj.codigo){ed=window.EDITS_BY_COD[obj.codigo];}
  if(!ed)return obj;
  if(ed.nombre)obj.nombre=ed.nombre;
  if(ed.club!==undefined&&ed.club!=='')obj.club=ed.club;
  if(ed.codigo)obj.codigo=ed.codigo;
  if(ed.sexo)obj.sexo=ed.sexo;
  if(ed.fechaNac)obj.fechaNac=ed.fechaNac;
  if(ed.zona)obj.zona=ed.zona;
  if(ed.comuna)obj.comuna=ed.comuna;
  return obj;
}

async function loadEdits(){
  if(!fbReady)return;
  let eds;
  try{
    eds=await window.YLEdiciones.cargar(async()=>{
      const snap=await window.FBQ.getDocs(window.FBQ.collection(fbDB,'athlete_edits'));
      const out=[];snap.forEach(d=>out.push({...d.data(),id:d.id}));
      return out;
    });
  }catch(e){console.warn('Error loading edits',e);return;}
  if(!eds)return;
  // El padrón: ediciones y BAJAS. El buscador seguía mostrando fichas repetidas
  // que ya se habían borrado desde el panel, porque acá no se miraba `deleted`.
  const r=window.YLEdiciones.aplicar(D,eds);
  // Y el índice por RUT/código, que usan las filas de inscripción.
  eds.forEach(_indexEdit);
  if(r.editados||r.borrados)console.log('[FB] '+r.editados+' ediciones, '+r.borrados+' bajas');
  if(window._lastNominasRaw)_applyNominas(window._lastNominasRaw); else renderFondo();
}

function isBirthday(dob){if(!dob)return false;const today=new Date();const parts=dob.split(/[-\/]/);let m,d;if(parts[0].length===4){m=parseInt(parts[1]);d=parseInt(parts[2])}else{d=parseInt(parts[0]);m=parseInt(parts[1])}return today.getMonth()+1===m&&today.getDate()===d}

function balloons(){const c=document.getElementById('balloons');if(!c)return;c.innerHTML='';const colors=['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4'];for(let i=0;i<30;i++){const b=document.createElement('div');const x=Math.random()*100;const delay=Math.random()*3;const dur=3+Math.random()*4;const size=20+Math.random()*20;const color=colors[Math.floor(Math.random()*colors.length)];b.style.cssText=`position:fixed;bottom:-60px;left:${x}%;width:${size}px;height:${size*1.2}px;background:${color};border-radius:50% 50% 50% 50% / 40% 40% 60% 60%;opacity:0.85;z-index:9999;animation:balloonUp ${dur}s ${delay}s ease-in forwards;pointer-events:none`;c.appendChild(b)}setTimeout(()=>{if(c)c.innerHTML=''},8000)}

function prof(a){
  const bday=isBirthday(a.fechaNac);
  const lgInline=window.clubLogoImg?window.clubLogoImg(a.club,18,'background:rgba(10,22,40,.4);padding:1px;vertical-align:middle;margin-right:6px;'):'';
  const lgBadge=window.clubLogoImg?window.clubLogoImg(a.club,38,'background:#0E1F3A;padding:2px;border:2px solid var(--bg);position:absolute;bottom:-4px;right:-4px;border-radius:50%;'):'';
  const clubVal=lgInline+(a.club||"—");
  const F=[["Club",clubVal],["Debut",a.debut||"—"]];
  let h=bday?'<div id="balloons"></div>':'';
  h+=`<button class="bb" onclick="bk()">← Volver</button>`;
  h+=`<div class="pc"><div style="display:flex;align-items:center;gap:16px;margin-bottom:20px"><div style="position:relative;flex-shrink:0"><div class="pa">${I(a.nombre)}</div>${lgBadge}</div><div><div class="pn">${a.nombre}${bday?' ':''}</div><div class="pk">${a.codigo}</div></div></div><div class="pg">${F.map(([l,v])=>`<div class="fd"><div class="lb">${l}</div><div class="vl">${v||"—"}</div></div>`).join("")}</div></div>`;
  if(bday)setTimeout(balloons,300);
  if(a.bestLifts&&Object.keys(a.bestLifts).length){const b=a.bestLifts,L={sq:'Squat',bp:'Bench',dl:'Deadlift',total:'Total',glp:'GL Pts'},U={sq:'kg',bp:'kg',dl:'kg',total:'kg',glp:'pts'};
    h+=`<div class="cd2"><div class="ct"><h2>Mejores Levantamientos (PR)</h2></div><div class="bx">${Object.entries(L).map(([k,l])=>b[k]?`<div class="bi"><div class="bv">${b[k]}<span class="bu"> ${U[k]}</span></div><div class="bl">${l}</div></div>`:'').join('')}</div></div>`}
  h+=`<div class="cd2"><div class="ct"><h2>Historial Competitivo</h2><span class="bg" style="background:var(--accent);color:#fff">${a.competencias.length}</span></div>`;
  if(!a.competencias.length)h+=`<div class="emp">Sin competencias registradas</div>`;
  else a.competencias.forEach(c=>{const cl=(CC[c.evento]||{}).b||"#64748b",r=c.resultado;
    h+=`<div class="ce" style="border-left-color:${cl}">${tg(c.evento)}<div class="cm"><div><span class="ll">División: </span><span class="vv">${c.division||"—"}</span></div><div><span class="ll">Categoría: </span><span class="vv">${c.categoria||"—"}</span></div><div><span class="ll">Modalidad: </span><span class="vv">${c.modalidad||"—"}</span></div></div>`;
    if(r){h+=`<div class="rb">`;if(r.bw)h+=`<div class="rp"><div class="rv">${r.bw}</div><div class="rl">BW</div></div>`;if(r.sq)h+=`<div class="rp"><div class="rv">${r.sq}</div><div class="rl">SQ</div></div>`;if(r.bp)h+=`<div class="rp"><div class="rv">${r.bp}</div><div class="rl">BP</div></div>`;if(r.dl)h+=`<div class="rp"><div class="rv">${r.dl}</div><div class="rl">DL</div></div>`;if(r.total)h+=`<div class="rp"><div class="rv">${r.total}</div><div class="rl">Total</div></div>`;if(r.glp)h+=`<div class="rp"><div class="rv">${r.glp}</div><div class="rl">GL</div></div>`;h+=`</div>`;if(r.rank)h+=`<div class="rk">#${r.rank}</div>`}
    h+=`</div>`});
  return h+`</div>`}

function sfl(l){ST.fl=l;ST.p=0;_pintarLista()}

// La lista de atletas, aparte del buscador. Está separada a propósito: escribir
// en el buscador redibujaba la pantalla entera —el campo de texto incluido—, y
// en el teléfono eso cierra y abre el teclado con cada letra. Ahora el campo se
// dibuja una vez y solo se rehace la lista, así que el cursor no se mueve.
function lstResultados(){const f=flt(),P=50,sh=f.slice(0,(ST.p+1)*P);
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let h=`<div class="cnt">${f.length} atletas encontrados</div>`;
  h+=`<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap"><button onclick="sfl('')" style="padding:3px 8px;border-radius:6px;border:1px solid ${!ST.fl?'var(--accent)':'var(--border)'};background:${!ST.fl?'var(--accent)':'transparent'};color:${!ST.fl?'#fff':'var(--muted)'};font-family:Oswald;font-size:10px;font-weight:700;cursor:pointer">TODOS</button>${letters.map(l=>`<button onclick="sfl('${l}')" style="padding:3px 7px;border-radius:6px;border:1px solid ${ST.fl===l?'var(--accent)':'var(--border)'};background:${ST.fl===l?'var(--accent)':'transparent'};color:${ST.fl===l?'#fff':'var(--muted)'};font-family:Oswald;font-size:10px;font-weight:700;cursor:pointer;min-width:24px">${l}</button>`).join('')}</div>`;
  sh.forEach(a=>{const lg=window.clubLogoImg?window.clubLogoImg(a.club,18,'background:rgba(10,22,40,.4);padding:1px;vertical-align:middle;margin-right:4px;'):'';h+=`<div class="ar" onclick="sl('${a.codigo.replace(/'/g,"\\'")}')"><div style="display:flex;align-items:center;gap:12px;overflow:hidden"><div class="av ${a.competencias.length?'ac':'in'}">${I(a.nombre)}</div><div style="overflow:hidden"><div class="an">${a.nombre}</div><div class="am"><span class="cd">${a.codigo}</span>${a.club?' · '+lg+a.club:''}</div></div></div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0">${a.bestLifts&&a.bestLifts.total?`<span style="font-size:11px;color:var(--gold);font-weight:600">${a.bestLifts.total}kg</span>`:''} ${a.competencias.length?`<span class="cc">${a.competencias.length}</span>`:''}<span style="color:#3a5577;font-size:18px">›</span></div></div>`});
  if(f.length>sh.length)h+=`<div style="text-align:center;padding:20px"><button class="tab" onclick="mp()" style="border-color:var(--accent);color:var(--accent)">Cargar más (${f.length-sh.length})</button></div>`;
  return h}

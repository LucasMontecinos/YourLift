// index.html — nóminas: las tarjetas de cada campeonato y la nómina del Sudamericano.
//
// Parte del código de index.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

function _applyNominas(all){
  window._lastNominasRaw=all; // guardar raw para re-aplicar overlay cuando lleguen edits
  const visible=all.filter(i=>i.status==='approved'||i.status==='pending');
  const byEvent={};
  visible.forEach(i=>{if(!byEvent[i.evento])byEvent[i.evento]=[];byEvent[i.evento].push(i)});
  // Las JORNADAS de un campeonato (los 9 días del Sudamericano) tienen su doc en
  // `eventos` para poder publicarlas en Competencia en Vivo, pero NO son nóminas:
  // su gente está toda en la nómina grande del campeonato. Sin sacarlas, en la
  // pestaña Nóminas salían nueve tarjetas "Día N — 0 inscritos".
  const _jornadas=new Set();
  ((NM&&NM._static)||[]).forEach(e=>{ if(e&&e.parent){ if(e.id)_jornadas.add(e.id); if(e.name)_jornadas.add(e.name); } });
  // Build events from NOM_EVENTS (loaded from Firestore eventos collection)
  // Show ALL non-archived events, even if they have 0 inscriptions
  const fbEvents=NOM_EVENTS
    .filter(ev=>ev.status!=='archived'&&ev.status!=='draft'&&!_jornadas.has(ev.id)&&!_jornadas.has(ev.name))
    .map(ev=>{
      const fbAths=(byEvent[ev.id]||byEvent[ev.name]||[])
        .sort((a,b)=>(a.timestamp?.seconds||0)-(b.timestamp?.seconds||0))
        .map((i,idx)=>{
          const inscClub=i.club==='Otro'?i.clubOtro:i.club||'';
          const base={
            id:i.id,nombre:i.nombre,rut:i.rut||'',sexo:i.sexo||'',codigo:i.codigo||'',
            dob:i.fechaNac||'',fechaNac:i.fechaNac||'',division:i.division||'',categoria:i.categoria||'',
            modalidad:i.modalidad||'',club:inscClub,
            universidad:i.universidad||'',status:i.status,
            sortOrder:idx+1,flight:i.flight||''
          };
          // Overlay: aplicar ediciones del admin (nombre, código, etc.) por RUT.
          const out=applyEditOverlay(base);
          // El club de la INSCRIPCIÓN manda en la nómina: si el atleta se cambió
          // de club para este evento, no dejar que el overlay del perfil lo pise.
          if(inscClub)out.club=inscClub;
          return out;
        });
      const athletes=fbAths;
      const approved=fbAths.filter(a=>a.status==='approved').length;
      const pending=fbAths.filter(a=>a.status==='pending').length;
      return{...ev,athletes,fromFirebase:true,liveCount:{total:athletes.length,approved,pending}};
    });
  NM.events=fbEvents;
  window._nominasCargadas=true;
  renderFondo();
}

async function loadFBNominas(force){
  if(!fbReady)return;
  try{
    // Caché 5min: esta colección se leía completa y sin caché en CADA carga de
    // página (home, records, etc, no solo la pestaña Nóminas) — era el mayor
    // driver de lecturas Firestore del sitio público.
    if(!force){
      const cn=_fsCache('inscripciones',5*60*1000);
      if(cn)_applyNominas(cn);
    }
    // Mientras se mira la pestaña, las nóminas llegan por un oyente: se cobra la
    // primera lectura y después solo lo que cambia. Antes se volvía a bajar todo
    // cada tres minutos mientras la pestaña estuviera abierta.
    _nominasEscuchar();
  }catch(e){console.warn('Error loading Firebase nominas',e)}
}

// Solo las inscripciones de los campeonatos que la pestaña muestra: los no
// archivados (ver _applyNominas). Las de campeonatos cerrados eran más de la
// mitad de la colección y la pestaña las descartaba al llegar.
function _nominasClaves(){
  if(window._eventosFS!==true)return [];                   // sin la lista de campeonatos: todo
  const evs=(NOM_EVENTS||[]).filter(ev=>ev&&ev.status!=='archived'&&ev.status!=='draft');
  return [...new Set(evs.flatMap(ev=>[ev.id,ev.name]).filter(Boolean))].sort();
}

function _nominasConsultas(claves){
  const Q=window.FBQ, col=Q.collection(fbDB,'inscripciones');
  if(!claves.length||!Q.where||!Q.query)return [col];
  const out=[];
  for(let i=0;i<claves.length;i+=30)out.push(Q.query(col,Q.where('evento','in',claves.slice(i,i+30))));
  return out;
}

function _nominasEscuchar(){
  if(!fbReady||window._nomOyente)return;
  // La lista de campeonatos (eventos) llega por su lado. Mientras no llegue,
  // NOM_EVENTS es la lista fija de respaldo y filtrar por ella dejaría fuera a
  // los campeonatos de verdad: se espera, y si en 4 s no llega, se escucha todo.
  if(!window._eventosFS){
    if(!window._nomEspera)window._nomEspera=setTimeout(()=>{
      window._nomEspera=null;
      if(!window._eventosFS)window._eventosFS='sin-lista';
      _nominasEscuchar();
    },4000);
    return;
  }
  const claves=_nominasClaves();
  const consultas=_nominasConsultas(claves);
  const partes=consultas.map(()=>null);
  const unsubs=consultas.map((q,i)=>window.FBQ.onSnapshot(q,snap=>{
    partes[i]=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(partes.some(p=>p===null))return;          // falta que llegue alguna parte
    const all=[].concat(...partes);
    _fsSetCache('inscripciones',all);
    _applyNominas(all);
  },e=>console.warn('[nominas] oyente',e)));
  window._nomOyente={unsubs,clave:claves.join('|'),desde:Date.now(),fuera:0};
}

function _nominasSoltar(){
  if(!window._nomOyente)return;
  window._nomOyente.unsubs.forEach(u=>{try{u()}catch(e){}});
  window._nomOyente=null;
}

// ── Nómina Sudamericano 2026 (goodlift.info) ─────────────────────────────
// Cada inscripción es una fila por lista (un atleta en Clásico + Only Bench
// aparece en ambas, a pedido). Chilenos linkeados a su perfil (campo cod).
function _nsudaVisible(){
  const j=window.NOMSUDA;
  if(!j)return false;
  if(j.publicada)return true;
  try{return new URLSearchParams(location.search).get('nominasuda')==='1'}catch(e){return false}
}

// Slug del atleta — el MISMO formato que usa el cargador de fotos del admin
// (nomina_suda_fotos/{slug}), así la ficha encuentra su foto.
// Foto de un atleta de la nómina: primero la de su PERFIL (chilenos que ya la
// tienen cargada, atleta_fotos por código), si no la subida para la nómina.
function _nsudaFoto(a,slug){
  if(a&&a.cod){const f=(window.ATL_FOTOS||{})[a.cod];if(f)return f;}
  return (window.NSUDA_FOTOS||{})[slug||_nsudaSlug(a&&a.n)]||'';
}

function _nsudaSlug(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,'-').slice(0,80);
}

// El nombre que se MUESTRA. La nómina de FESUPO viene "Apellidos Nombres"; la
// gente se llama al revés, así que cuando se conoce el nombre real viaja en
// `nDisp` y es el que se ve. `n` se queda como está y sigue siendo la llave:
// las fotos de la nómina y las correcciones del admin están guardadas en
// Firestore con el slug de `n`, y darlo vuelta las dejaría a todas huérfanas.
function _nsudaNombre(a){ return (a&&a.nDisp)||(a&&a.n)||''; }

// Una marca nominada NO puede ser mayor que el total declarado: el total es la
// suma de los tres levantamientos, así que ninguno solo puede pasarlo. Cuando
// pasa es un dedo de más al tipear la planilla —José Manuel Conejera venía con
// 1125.5 en banca, que son 112.5—. Mejor no mostrar nada que mostrar un número
// imposible al lado de su nombre.
//
// Ojo: la SUMA no sirve de control. Las marcas nominadas son la mejor sentadilla,
// la mejor banca y el mejor peso muerto de su carrera, y el mejor total de una
// competencia: casi nunca cuadran entre sí, y eso es normal.
function _marcaSana(v,total){
  v=+v||0; total=+total||0;
  return (total>0&&v>total)?0:v;
}

function _nsudaCatKey(c){const plus=(c||'').includes('+');return (parseFloat(String(c).replace(/[^0-9.]/g,''))||999)+(plus?0.5:0)}

// ── Día en que compite cada inscripción del Sudamericano ──────────
// Con la nómina FINAL de FESUPO cada inscripción trae anotada su sesión, así que
// el día ya no se deduce: se lee. Antes se resolvía por regla (sexo + categoría +
// modalidad + división) porque solo teníamos las nominaciones, y las reglas
// acertaban el grupo pero no siempre la sesión: Special Olympics, por ejemplo,
// quedaba al cierre del 27 y en el cronograma real va el 20.
//
// La regla se conserva de respaldo para una inscripción que se cargue después a
// mano y todavía no tenga jornada.
function _nsudaJornada(a){
  const js=(window.NOMSUDA&&window.NOMSUDA.jornadas)||[];
  if(a&&a.jornada!=null){
    const j=js.find(x=>x.id===a.jornada);
    if(j)return j;
  }
  return js.find(j=>{
    const r=j.regla||{};
    if(!j.regla)return false;
    if(r.sexo&&a.sexo!==r.sexo)return false;
    if(r.cats&&!r.cats.includes(a.cat))return false;
    if(r.mods&&!r.mods.includes(a.mod))return false;
    if(r.divs&&!r.divs.includes(a.div))return false;
    return true;
  })||null;
}

function _nsudaFechaCorta(f){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(f||''); if(!m)return '';
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return `${_NSUDA_DIAS[d.getUTCDay()]} ${+m[3]} ${_NSUDA_MESES[+m[2]-1]}`;
}

function _nsudaDiaLbl(j){
  if(!j)return '';
  return `Día ${j.dia} · ${_nsudaFechaCorta(j.fecha)}${j.inicio?' · '+j.inicio+' hrs':''}`;
}

// ── FICHA del atleta de la nómina (modal). No es un perfil: junta las
// inscripciones del atleta (puede estar en varias listas), su foto si fue
// subida, país, año y marcas nominadas. Cierra con ✕, click afuera o Esc.
function nsudaFicha(slug){
  const j=window.NOMSUDA; if(!j)return;
  const rows=j.atletas.filter(a=>_nsudaSlug(a.n)===slug);
  if(!rows.length)return;
  const a=rows[0];
  const foto=_nsudaFoto(a,slug);
  const ex=document.getElementById('nsudaFichaModal'); if(ex)ex.remove();
  const m=document.createElement('div'); m.id='nsudaFichaModal';
  m.style.cssText='position:fixed;inset:0;background:rgba(4,10,20,.82);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;backdrop-filter:blur(3px)';
  const ini=_nsudaNombre(a).split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  let h=`<div style="background:linear-gradient(160deg,#0D1F38,#0a1628);border:2px solid rgba(212,168,67,.5);border-radius:16px;width:min(420px,94vw);max-height:90vh;overflow-y:auto;position:relative">`;
  h+=`<button onclick="document.getElementById('nsudaFichaModal').remove()" style="position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;border:1px solid var(--border);background:rgba(10,22,40,.8);color:var(--muted);font-size:15px;cursor:pointer;z-index:2"><i class=yl-i-cerrar></i></button>`;
  h+=`<div style="display:flex;flex-direction:column;align-items:center;padding:26px 22px 10px">`;
  h+=`<div style="width:110px;height:110px;border-radius:50%;overflow:hidden;border:3px solid var(--gold);background:rgba(29,49,80,.5);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(0,0,0,.5)">${foto?`<img src="${foto}" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-family:Oswald;font-size:34px;color:var(--muted)">${ini}</span>`}</div>`;
  h+=`<div style="font-family:Oswald;font-size:19px;font-weight:700;letter-spacing:.5px;margin-top:12px;text-align:center">${_nsudaNombre(a)}</div>`;
  h+=`<div style="font-size:12px;color:var(--muted);margin-top:3px">${a.pais}${a.born?' · '+a.born:''}${a.uni?'<div style="margin-top:2px">'+a.uni+'</div>':''}</div>`;
  if(a.cod)h+=`<a href="atleta.html?codigo=${encodeURIComponent(a.cod)}" style="margin-top:8px;font-size:11px;color:var(--gold);border:1px solid rgba(212,168,67,.45);padding:4px 12px;border-radius:12px;text-decoration:none;font-family:Oswald;letter-spacing:.5px">VER PERFIL YOURLIFT →</a>`;
  h+=`</div>`;
  h+=`<div style="padding:8px 22px 24px">`;
  rows.forEach(r=>{
    h+=`<div style="background:rgba(10,22,40,.55);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-top:10px">`;
    h+=`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">`;
    h+=`<span style="font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:.5px;color:var(--gold)">${r.lista}</span>`;
    h+=`<span style="background:rgba(212,168,67,.12);color:var(--gold);padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600">${r.cat} kg</span>`;
    h+=`<span style="font-size:11px;color:var(--muted)">${r.div}</span>`;
    if(r.res)h+=`<span title="Reserva" style="background:rgba(212,168,67,.15);color:var(--gold);border:1px solid rgba(212,168,67,.4);padding:0 6px;border-radius:8px;font-size:10px;font-weight:700">R</span>`;
    h+=`</div>`;
    const isBench=/Only Bench/i.test(r.lista);
    const cells=isBench?[['BP',r.bp]]:[['SQ',r.sq],['BP',r.bp],['DL',r.dl],['Total',r.total]];
    h+=`<div style="display:grid;grid-template-columns:repeat(${cells.length},1fr);gap:6px;text-align:center">`;
    cells.forEach(([k,v])=>{h+=`<div style="background:rgba(29,49,80,.35);border-radius:8px;padding:7px 2px"><div style="font-size:9px;color:var(--muted);font-family:Oswald;letter-spacing:1px">${k}</div><div style="font-family:Oswald;font-size:16px;font-weight:700;color:${k==='Total'?'var(--gold)':'var(--text)'}">${v!=null?v:'—'}</div></div>`});
    h+=`</div></div>`;
  });
  h+=`<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:12px">Marcas nominadas · Sudamericano 2026 · Santiago de Chile</div>`;
  h+=`</div></div>`;
  m.innerHTML=h;
  m.onclick=e=>{if(e.target===m)m.remove();};
  document.body.appendChild(m);
  const esc=e=>{if(e.key==='Escape'){m.remove();document.removeEventListener('keydown',esc);}};
  document.addEventListener('keydown',esc);
}

function _nomFlag(p){const c=_NOM_ISO[p];return c?`<img src="https://flagcdn.com/h20/${c}.png" alt="" style="height:12px;border-radius:2px;vertical-align:-1px;margin-right:5px" onerror="this.remove()">`:'';}

function _nomDiv(d){return _NOM_DIVN[String(d||'').trim().toLowerCase()]||String(d||'').trim()||'Sin división';}

// Normaliza categoría a 'N' o 'N+' (acepta '+120', '120+', '-59 kg (Hombre)')
function _nomCatN(c){const t=String(c||'');const m=t.match(/([+]?)(\d+\.?\d*)(\+?)/);if(!m)return '';return m[2]+((m[1]==='+'||m[3]==='+')?'+':'');}

function _nomCatKey(n){return (parseFloat(n)||999)+(String(n).endsWith('+')?0.5:0);}

function _nomCatLbl(n){if(!n)return '—';return String(n).endsWith('+')?('+'+String(n).slice(0,-1)+'kg'):('-'+n+'kg');}

function _nomDobYear(a){if(a.born)return a.born;const m=String(a.dob||'').match(/(\d{4})/);return m?m[1]:'';}

// ── Estado de la vista ──
function nomToggle(id){ST.nomOpen=(ST.nomOpen===id)?'':id;ST.nomF={};ST.nomQ='';render();if(ST.nomOpen){setTimeout(()=>{const el=document.getElementById('nomcard_'+id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},60);}}

function nomFSet(k,v){ST.nomF=ST.nomF||{};ST.nomF[k]=v;render();}

function nomFClear(){ST.nomF={};ST.nomQ='';render();}

function nomQ(v){ST.nomQ=v;if(_nomQT)clearTimeout(_nomQT);_nomQT=setTimeout(()=>{
  // Solo la lista. El campo de texto vive en #nomFiltros, que no se toca: el
  // cursor se queda donde está y el teclado no se cierra.
  const c=document.getElementById('nomLista');
  if(c&&window._nomInner){
    const todo=window._nomInner(), k=todo.indexOf(NOM_CORTE);
    c.innerHTML=k<0?todo:todo.slice(k+NOM_CORTE.length);
  } else render();
},250);}

// ── Fila normalizada para el renderer goodlift ──
//  {n, year, teamHtml, sexo:'F'|'M', cat:'59'|'120+', div, mod, sq,bp,dl,total,
//   res, nameHtml, estadoHtml, hasMarks}
function _nomGLTable(rows,opts){
  opts=opts||{};
  const F=ST.nomF||{}, q=(ST.nomQ||'').toLowerCase();
  let list=rows.slice();
  if(F.sex)list=list.filter(r=>r.sexo===F.sex);
  if(F.cat)list=list.filter(r=>r.cat===F.cat);
  if(F.div)list=list.filter(r=>_nomDiv(r.div)===F.div);
  if(F.team)list=list.filter(r=>r.team===F.team);
  if(F.mod)list=list.filter(r=>r.mod===F.mod);
  if(q)list=list.filter(r=>r.n.toLowerCase().includes(q)||(r.team||'').toLowerCase().includes(q)||(r.uni||'').toLowerCase().includes(q));
  if(!list.length)return `<div style="padding:26px;text-align:center;color:var(--muted);font-size:12px">Sin atletas con esos filtros</div>`;
  const marks=opts.marks&&list.some(r=>r.total!=null||r.sq!=null||r.bp!=null||r.dl!=null);
  // Agrupar: división → (sexo, categoría)
  const byDiv={};
  list.forEach(r=>{const d=_nomDiv(r.div);(byDiv[d]=byDiv[d]||[]).push(r);});
  const divs=Object.keys(byDiv).sort((a,b)=>(_NOM_DIVORD[a]??50)-(_NOM_DIVORD[b]??50));
  const nCols=3+(marks?4:0)+(opts.club?1:0)+(opts.estado?1:0)+(opts.mod?1:0);
  let h='';
  divs.forEach(d=>{
    // Banda de división (estilo goodlift)
    h+=`<div style="background:linear-gradient(90deg,var(--accent),rgba(196,30,58,.55));border-radius:8px 8px 0 0;padding:8px 14px;margin-top:16px"><span style="font-family:Oswald;font-size:14px;font-weight:700;letter-spacing:1px;color:#fff">División «${d}»</span></div>`;
    h+=`<div class="nomwrap" style="overflow-x:auto;border:1px solid rgba(29,49,80,.5);border-top:none;border-radius:0 0 8px 8px"><table class="nomtbl" style="width:100%;border-collapse:collapse;font-size:12px;min-width:${marks?680:520}px">`;
    h+=`<tr style="background:rgba(29,49,80,.45)">`;
    h+=`<th style="padding:6px;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:.5px;width:42px;text-align:center">Pos</th>`;
    h+=`<th style="padding:6px 8px;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:.5px;text-align:left">Atleta</th>`;
    h+=`<th style="padding:6px;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:.5px;width:52px;text-align:center">Año</th>`;
    h+=`<th style="padding:6px 8px;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:.5px;text-align:left">${opts.teamLabel||'Equipo'}</th>`;
    if(opts.mod)h+=`<th style="padding:6px 8px;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:.5px;text-align:left">Modalidad</th>`;
    if(marks)['SQ','BP','DL','Total'].forEach(k=>h+=`<th style="padding:6px;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:.5px;width:58px;text-align:center">${k}</th>`);
    if(opts.estado)h+=`<th style="padding:6px;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:.5px;width:70px;text-align:center">Estado</th>`;
    h+=`</tr>`;
    // Subgrupos: mujeres primero, categoría ascendente
    const sub={};
    byDiv[d].forEach(r=>{const k=(r.sexo==='F'?'0':'1')+'|'+r.cat;(sub[k]=sub[k]||[]).push(r);});
    const both=new Set(byDiv[d].map(r=>r.sexo)).size>1;
    Object.keys(sub).sort((a,b)=>{const[sa,ca]=a.split('|'),[sb,cb]=b.split('|');if(sa!==sb)return sa<sb?-1:1;return _nomCatKey(ca)-_nomCatKey(cb);}).forEach(k=>{
      const [sx,cat]=k.split('|');
      const lbl=(both?(sx==='0'?'Mujeres ':'Hombres '):'')+_nomCatLbl(cat);
      const g=sub[k];
      // Día de competencia de la categoría (solo el Sudamericano lo trae). Casi
      // siempre es uno; si la categoría se parte en dos sesiones van los dos.
      const dias=[...new Set(g.map(r=>r.diaLbl).filter(Boolean))];
      const diaHtml=dias.length
        ?`<span title="${g.find(r=>r.diaLbl)?.diaSes||''}" style="font-family:Oswald;font-size:10px;font-weight:600;letter-spacing:.5px;color:var(--gold);background:rgba(212,168,67,.14);border:1px solid rgba(212,168,67,.35);border-radius:9px;padding:2px 9px;white-space:nowrap">${dias.join(' · ')}</span>`
        :'';
      h+=`<tr><td colspan="${nCols}" style="padding:6px 12px;background:rgba(212,168,67,.10);border-top:1px solid rgba(29,49,80,.45)"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:.5px;color:var(--gold)">${lbl}</span>${diaHtml}</div></td></tr>`;
      if(marks)g.sort((a,b)=>(b.total||0)-(a.total||0)||(b.bp||0)-(a.bp||0)||a.n.localeCompare(b.n));
      else g.sort((a,b)=>a.n.localeCompare(b.n));
      g.forEach((r,i)=>{
        h+=`<tr style="background:${i%2?'rgba(29,49,80,.12)':'transparent'};border-top:1px solid rgba(29,49,80,.22)">`;
        h+=`<td style="padding:6px;text-align:center;color:var(--muted)">${r.res?'<span title="Reserva" style="color:var(--gold);font-weight:700;font-size:10px;margin-right:2px">R</span>':''}${i+1}.</td>`;
        h+=`<td style="padding:6px 8px">${r.nameHtml||r.n}${r.uni?`<div style="font-size:10px;color:var(--muted)">${r.uni}</div>`:''}</td>`;
        h+=`<td style="padding:6px;text-align:center;color:var(--muted);font-size:11px">${r.year||'—'}</td>`;
        h+=`<td style="padding:6px 8px;font-size:11px;white-space:nowrap">${r.teamHtml||r.team||'—'}</td>`;
        if(opts.mod)h+=`<td style="padding:6px 8px;font-size:11px;color:var(--muted)">${r.mod||'—'}</td>`;
        if(marks)['sq','bp','dl','total'].forEach(kk=>{const v=r[kk];h+=`<td style="padding:6px;text-align:center;font-size:11px;${kk==='total'?'font-weight:700;color:var(--gold)':''}">${v!=null?v:'—'}</td>`});
        if(opts.estado)h+=`<td style="padding:6px;text-align:center">${r.estadoHtml||''}</td>`;
        h+=`</tr>`;
      });
    });
    h+=`</table></div>`;
  });
  return h;
}

function _nomFilters(rows,opts){
  const F=ST.nomF||{};
  const uniq=(fn,cmp)=>[...new Set(rows.map(fn).filter(Boolean))].sort(cmp);
  const sel=(key,label,val,items,fmt)=>{
    let s=`<label style="display:flex;flex-direction:column;gap:3px;font-size:9px;color:var(--muted);font-family:Oswald;letter-spacing:.5px;text-transform:uppercase">${label}<select onchange="nomFSet('${key}',this.value)" style="padding:6px 9px;border-radius:8px;border:1px solid ${val?'var(--gold)':'var(--border)'};background:var(--bg2,#0d1f38);color:${val?'var(--gold)':'var(--text)'};font-size:12px;min-width:110px;cursor:pointer"><option value="">Todas</option>`;
    items.forEach(o=>{s+=`<option value="${String(o).replace(/"/g,'&quot;')}"${val===String(o)?' selected':''}>${fmt?fmt(o):o}</option>`});
    return s+`</select></label>`;
  };
  let h=`<div style="display:flex;flex-wrap:wrap;gap:9px;margin:12px 0;align-items:flex-end">`;
  h+=sel('sex','Género',F.sex||'',['F','M'],v=>v==='F'?'Mujeres':'Hombres');
  h+=sel('cat','Categoría',F.cat||'',uniq(r=>r.cat,(a,b)=>_nomCatKey(a)-_nomCatKey(b)),v=>_nomCatLbl(v));
  h+=sel('div','División',F.div||'',uniq(r=>_nomDiv(r.div),(a,b)=>(_NOM_DIVORD[a]??50)-(_NOM_DIVORD[b]??50)));
  h+=sel('team',opts.teamLabel||'Equipo',F.team||'',uniq(r=>r.team,(a,b)=>a.localeCompare(b)));
  if(opts.mod)h+=sel('mod','Modalidad',F.mod||'',uniq(r=>r.mod,(a,b)=>a.localeCompare(b)));
  if(F.sex||F.cat||F.div||F.team||F.mod||ST.nomQ)h+=`<button onclick="nomFClear()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--accent);background:rgba(196,30,58,.12);color:var(--accent);font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer"><i class=yl-i-cerrar></i> Limpiar</button>`;
  h+=`</div>`;
  h+=`<div class="fl nomq" style="margin-bottom:4px"><input type="text" placeholder="Buscar atleta, equipo o universidad..." value="${ST.nomQ||''}" oninput="nomQ(this.value)" autocomplete="off"></div>`;
  // Marca de corte: de acá para abajo va la lista, que es lo único que se
  // repinta al escribir. El buscador queda de este lado y no se toca nunca —si
  // se redibujara, en el teléfono el teclado se cerraría con cada letra.
  h+=NOM_CORTE;
  return h;
}

// ── Tarjeta (colapsada / expandida) ──
function _nomCardShell(id,info,innerFn){
  const cfg=(window.NOMCARDS||{})[id]||{};
  const foto=cfg.fotoUrl||'';
  const open=ST.nomOpen===id;
  const fecha=cfg.fecha||info.fecha||'';
  const org=cfg.organizador||info.org||'';
  const lugar=cfg.lugar||info.lugar||'';
  let h=`<div id="nomcard_${id}" class="cd2" style="margin-bottom:18px;padding:0;overflow:hidden;border:1px solid ${open?'rgba(212,168,67,.55)':'var(--border)'}">`;
  // Cabecera clickeable, a lo ancho, con la foto del evento de fondo
  h+=`<div class="nomcard-head" onclick="nomToggle('${id}')" style="cursor:pointer;position:relative;min-height:96px;display:flex;align-items:center;background:${foto?`linear-gradient(90deg,rgba(7,16,32,.93) 30%,rgba(7,16,32,.55)),url('${foto}') center/cover`:'linear-gradient(120deg,#0D1F38,#0a1628)'}">`;
  h+=`<div class="nomcard-info" style="padding:18px 20px;flex:1 1 260px;min-width:0">`;
  h+=`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h2 style="font-family:Oswald;font-size:clamp(15px,3.2vw,20px);letter-spacing:1px;text-transform:uppercase;margin:0">${info.name}</h2>${info.badges||''}</div>`;
  // Fecha · organizador · lugar (con link a Google Maps si el evento lo trae) · cierre de nómina
  const lugarHtml=info.maps
    ? `<a href="${info.maps}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:var(--gold);text-decoration:none;border-bottom:1px dashed rgba(212,168,67,.5)" title="Ver en Google Maps">${lugar} ↗</a>`
    : lugar;
  h+=`<p style="font-size:12px;color:var(--muted);margin-top:4px">${[fecha,org,lugarHtml].filter(Boolean).join(' · ')||'&nbsp;'}</p>`;
  if(info.cierre)h+=`<p style="font-size:11px;color:var(--accent);margin-top:2px">Cierre de nómina: ${info.cierre}</p>`;
  h+=`</div>`;
  // Logo oficial del evento: primero el subido desde admin → Campeonatos
  // (eventos/{id}.logoUrl en Firebase Storage), si no el del JSON. Si no hay
  // ninguno o la imagen falla, el bloque se quita solo.
  const logoUrl=cfg.logoUrl||(window.NOMEVENT_LOGOS||{})[info.eventoId]||info.logo||'';
  if(logoUrl)h+=`<div class="nomcard-logo" style="padding:0 4px 0 12px;flex-shrink:0;display:flex;align-items:center"><img src="${logoUrl}" alt="" style="height:74px;width:auto;max-width:150px;object-fit:contain;background:#fff;border-radius:8px;padding:5px" onerror="this.parentElement.remove()"></div>`;
  h+=`<div class="nomcard-meta" style="padding:0 20px;display:flex;align-items:center;gap:10px;flex-shrink:0">`;
  h+=`<span class="bg" style="background:var(--accent);color:#fff;font-size:13px;padding:5px 12px;white-space:nowrap">${info.countLabel||(info.count+' inscritos')}</span>`;
  h+=`<span style="font-family:Oswald;font-size:11px;color:${open?'var(--gold)':'var(--muted)'};letter-spacing:.5px;white-space:nowrap">${open?'▲ CERRAR':'▼ VER NÓMINA'}</span>`;
  h+=`</div></div>`;
  // El contenido de la tarjeta abierta va en su propio contenedor para poder
  // repintarlo solo a él cuando se escribe en el buscador: redibujar la página
  // entera destruye el campo de texto y en el teléfono cierra el teclado.
  if(open){
    window._nomInner=innerFn;
    const todo=innerFn(), k=todo.indexOf(NOM_CORTE);
    const arriba=k<0?'':todo.slice(0,k), lista=k<0?todo:todo.slice(k+NOM_CORTE.length);
    h+=`<div style="padding:14px 16px 20px"><div id="nomFiltros">${arriba}</div><div id="nomLista">${lista}</div></div>`;
  }
  h+=`</div>`;
  return h;
}

// ── Sudamericano: filas normalizadas ──
function _nomSudaRows(){
  const j=window.NOMSUDA;
  return (j.atletas||[]).map(a=>{
    const slug=_nsudaSlug(a.n);
    const foto=_nsudaFoto(a,slug);
    const av=`<span onclick="event.stopPropagation();nsudaFicha('${slug}')" title="Ver ficha" style="display:inline-flex;width:24px;height:24px;border-radius:50%;overflow:hidden;background:rgba(29,49,80,.5);border:1px solid ${foto?'rgba(212,168,67,.5)':'var(--border)'};cursor:pointer;vertical-align:middle;margin-right:7px;align-items:center;justify-content:center;flex-shrink:0">${foto?`<img src="${foto}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-size:9px;color:var(--muted);font-family:Oswald">${_nsudaNombre(a).split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>`}</span>`;
    const nm=a.cod
      ?`<a href="atleta.html?codigo=${encodeURIComponent(a.cod)}" style="color:var(--text);text-decoration:none;border-bottom:1px dashed rgba(212,168,67,.5);font-weight:600" onmouseover="this.style.color='var(--gold)'" onmouseout="this.style.color='var(--text)'">${_nsudaNombre(a)}</a>`
      :`<span onclick="nsudaFicha('${slug}')" style="cursor:pointer">${_nsudaNombre(a)}</span>`;
    const jo=_nsudaJornada(a);
    return {n:a.n,year:a.born||'',sexo:a.sexo,cat:_nomCatN(a.cat),div:a.div,mod:a.mod,
      team:a.pais,teamHtml:_nomFlag(a.pais)+a.pais,uni:a.uni||'',res:!!a.res,
      sq:_marcaSana(a.sq,a.total),bp:_marcaSana(a.bp,a.total),dl:_marcaSana(a.dl,a.total),
      total:a.total,nameHtml:av+nm,
      diaLbl:_nsudaDiaLbl(jo),diaSes:jo?`${jo.nombre} · pesaje ${jo.pesaje}`:''};
  });
}

// Desglose del Sudamericano: inscripciones (una por lista/división) vs PERSONAS
// (atletas únicos — muchos compiten en 2+ disciplinas). Pedido de la organización:
// que se vea al abrir el evento.
function _nomSudaStats(j){
  const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const per=new Map();
  (j.atletas||[]).forEach(a=>{
    const k=norm(a.n)+'|'+a.sexo;
    if(!per.has(k))per.set(k,{sexo:a.sexo,pais:a.pais,n:0});
    per.get(k).n++;
  });
  const ps=[...per.values()];
  return {ins:j.atletas.length, personas:ps.length,
    h:ps.filter(p=>p.sexo==='M').length, m:ps.filter(p=>p.sexo==='F').length,
    multi:ps.filter(p=>p.n>1).length, paises:new Set(ps.map(p=>p.pais)).size};
}

// Clave de una inscripción del Sudamericano (nombre + lista original). Se
// verificó que es única para las 633 inscripciones. Tiene que ser IDÉNTICA a la
// que usa el editor del admin.
function _nsudaKey(a){ return _nsudaSlug(a&&a.n)+'~'+_nsudaSlug(a&&(a._lista0||a.lista)); }

function _nsudaApplyEdits(){
  const j=window.NOMSUDA; if(!j||!j._raw)return;
  const ed=window.NSUDA_EDITS||{};
  j.atletas=j._raw.map(a=>{
    const k=_nsudaKey(a), e=ed[k];
    if(!e)return a;
    if(e.del)return null;
    const out={...a,_lista0:a.lista};
    ['cat','div','mod','lista','pais','sexo'].forEach(f=>{ if(e[f]!==undefined&&e[f]!=='')out[f]=e[f]; });
    return out;
  }).filter(Boolean);
}

function _nomSudaCard(){
  const j=window.NOMSUDA;
  const id='suda2026';
  const st=_nomSudaStats(j);
  return _nomCardShell(id,{
    name:j.eventoCorto||'Sudamericano 2026',
    fecha:j.fechas,org:'FESUPO',lugar:j.lugar,
    maps:j.maps||'', cierre:j.cierreNomina||'', logo:j.logo||'', eventoId:j.eventoId||'Sudamericano_2026',
    count:j.atletas.length,
    countLabel:`${st.ins} inscripciones · ${st.personas} atletas`,
    badges:`<span style="font-size:10px;background:rgba(212,168,67,.2);color:var(--gold);padding:2px 8px;border-radius:10px;border:1px solid rgba(212,168,67,.4)">NÓMINA OFICIAL</span>${j.publicada?'':'<span style="font-size:10px;background:rgba(239,68,68,.15);color:#ef4444;padding:2px 8px;border-radius:10px;border:1px solid rgba(239,68,68,.4)">VISTA PREVIA</span>'}`
  },()=>{
    const rows=_nomSudaRows();
    const F=ST.nomF||{};
    // Desglose visible al abrir el evento (pedido de la organización)
    let h=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:10px">`;
    [[st.ins,'Inscripciones'],[st.personas,'Atletas'],[st.h,'Hombres'],[st.m,'Mujeres'],[st.multi,'En 2+ disciplinas'],[st.paises,'Países']].forEach(([v,l])=>{
      h+=`<div style="background:rgba(29,49,80,.28);border:1px solid var(--border);border-radius:10px;padding:9px 6px;text-align:center"><div style="font-family:Oswald;font-size:20px;font-weight:700;color:var(--gold)">${v}</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">${l}</div></div>`;
    });
    h+=`</div>`;
    h+=`<div style="font-size:11px;color:var(--muted)">${j.evento} · ${j.fuente}${(j.atletas||[]).some(a=>a.res)?' · <span style="color:var(--gold)">R = Reserva</span>':''} · Los chilenos tienen link a su perfil; el resto abre su ficha · Una inscripción por lista y división: por eso hay más inscripciones que atletas</div>`;
    // Pestañas de MODALIDAD (obligatorias): con +600 inscripciones no se muestra
    // la nómina completa — primero se elige la modalidad y recién ahí sale la
    // tabla ordenada estilo goodlift (división → categoría).
    const MODORD=['Clásico','Equipado','Universitario','Only Bench Clásico','Only Bench Equipado','Olimpiadas Especiales'];
    const mods=[...new Set(rows.map(r=>r.mod))].sort((a,b)=>(MODORD.indexOf(a)+1||99)-(MODORD.indexOf(b)+1||99));
    h+=`<div style="display:flex;flex-wrap:wrap;gap:7px;margin:14px 0 4px">`;
    mods.forEach(m=>{
      const n=rows.filter(r=>r.mod===m).length, on=F.mod===m;
      h+=`<button onclick="nomFSet('mod','${m.replace(/'/g,"\\'")}')" style="padding:9px 16px;border-radius:18px;border:1px solid ${on?'var(--gold)':'var(--border)'};background:${on?'rgba(212,168,67,.18)':'transparent'};color:${on?'var(--gold)':'var(--muted)'};font-family:Oswald;font-size:12px;font-weight:${on?700:400};letter-spacing:.5px;cursor:pointer">${m} <span style="opacity:.65">(${n})</span></button>`;
    });
    h+=`</div>`;
    if(!F.mod){
      h+=`<div style="padding:34px 16px;text-align:center;border:1px dashed rgba(212,168,67,.35);border-radius:12px;margin-top:10px"><div style="font-family:Oswald;font-size:15px;color:var(--gold);letter-spacing:1px">ELIGE UNA MODALIDAD</div><div style="font-size:12px;color:var(--muted);margin-top:6px">Selecciona arriba la modalidad para ver su nómina ordenada por división y categoría.</div></div>`;
      return h;
    }
    h+=_nomFilters(rows.filter(r=>r.mod===F.mod),{teamLabel:'País'});
    h+=_nomGLTable(rows,{marks:true,teamLabel:'País'});
    return h;
  });
}

function _nomRutK(r){return String(r||'').replace(/[^0-9kK]/g,'').toUpperCase()}

function _nomNomK(n){return String(n||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

function _nomIdx(){
  const src=(typeof D!=='undefined'&&D)||[];
  if(_NOMIDX&&_NOMIDX_N===src.length)return _NOMIDX;
  const byRut={},byNom={};
  src.forEach(a=>{
    const r=_nomRutK(a.rut); if(r&&!byRut[r])byRut[r]=a;
    const n=_nomNomK(a.nombre); if(n){ byNom[n]=byNom[n]===undefined?a:null; } // null = nombre repetido, no sirve
  });
  _NOMIDX={byRut,byNom}; _NOMIDX_N=src.length; return _NOMIDX;
}

// Código YourLift del atleta de una nómina (por código propio, RUT o nombre exacto)
function _nomCodDe(codigo,rut,nombre){
  if(codigo)return codigo;
  const ix=_nomIdx();
  const m=(rut&&ix.byRut[_nomRutK(rut)])||(nombre&&ix.byNom[_nomNomK(nombre)])||null;
  return m&&m.codigo?m.codigo:'';
}

function _nomFotoDe(codigo,rut,nombre){
  const cod=_nomCodDe(codigo,rut,nombre);
  return (cod&&(window.ATL_FOTOS||{})[cod])||'';
}

function _nomAvatar(nombre,codigo,rut){
  const foto=_nomFotoDe(codigo,rut,nombre);
  const ini=String(nombre||'').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
  return `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;overflow:hidden;background:rgba(29,49,80,.5);border:1px solid ${foto?'rgba(212,168,67,.5)':'var(--border)'};vertical-align:middle;margin-right:7px;align-items:center;justify-content:center;flex-shrink:0">`
    +(foto?`<img src="${foto}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
          :`<span style="font-size:9px;color:var(--muted);font-family:Oswald">${ini}</span>`)+`</span>`;
}

function _nomEvKey(ev,a){
  return encodeURIComponent((ev.id||ev.name||'')+'|'+(a.nombre||'')).replace(/'/g,'%27');
}

// Ficha (mini perfil) de un atleta de una nómina de campeonato
window.nomFichaEv=function(key){
  const [evk,nombre]=decodeURIComponent(key).split('|');
  const ev=(NM&&NM.events||[]).find(e=>(e.id||e.name)===evk);
  const a=ev&&(ev.athletes||[]).find(x=>x.nombre===nombre);
  if(!a)return;
  const cod=_nomCodDe(a.codigo||a.cod||'',a.rut||'',a.nombre||''), foto=_nomFotoDe(cod,'','');
  const ex=document.getElementById('nomFichaEvModal'); if(ex)ex.remove();
  const m=document.createElement('div'); m.id='nomFichaEvModal';
  m.style.cssText='position:fixed;inset:0;background:rgba(4,10,20,.82);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;backdrop-filter:blur(3px)';
  const dato=(l,v)=>v?`<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid rgba(29,49,80,.35)"><span style="color:var(--muted);font-size:11px">${l}</span><span style="font-size:12px;font-weight:600;text-align:right">${v}</span></div>`:'';
  m.innerHTML=`<div style="background:#0D1F38;border:2px solid var(--gold);border-radius:14px;padding:20px;width:min(420px,95vw);max-height:88vh;overflow:auto">
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">
      <div style="width:64px;height:64px;border-radius:12px;overflow:hidden;background:rgba(29,49,80,.5);border:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center">
        ${foto?`<img src="${foto}" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-family:Oswald;font-size:20px;color:var(--muted)">${String(a.nombre||'').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()}</span>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-family:Oswald;font-size:16px;letter-spacing:.5px;line-height:1.2">${a.nombre||''}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${ev.name||''}</div>
      </div>
    </div>
    ${dato('Categoría',a.categoria)}${dato('División',a.division)}${dato('Modalidad',a.modalidad)}
    ${dato('Club',a.club)}${dato('Universidad',a.universidad)}${dato('Año nac.',_nomDobYear(a))}
    <div style="display:flex;gap:8px;margin-top:14px">
      ${cod?`<a href="atleta.html?codigo=${encodeURIComponent(cod)}" style="flex:1;text-align:center;padding:10px;border-radius:8px;background:var(--accent);color:#fff;font-family:Oswald;font-size:12px;text-decoration:none">VER PERFIL COMPLETO</a>`:''}
      <button onclick="document.getElementById('nomFichaEvModal').remove()" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:12px;cursor:pointer">Cerrar</button>
    </div></div>`;
  m.onclick=e=>{if(e.target===m)m.remove()};
  document.body.appendChild(m);
};

// ── Campeonatos (Firestore/nominas.json): filas normalizadas ──
function _nomEvRows(ev){
  return (ev.athletes||[]).map(a=>{
    const male=(a.sexo==='Hombre'||a.sexo==='Masculino'||a.sexo==='M');
    const isPend=ev.fromFirebase&&a.status==='pending';
    return {n:a.nombre,year:_nomDobYear(a),sexo:male?'M':'F',cat:_nomCatN(a.categoria),div:a.division,
      mod:a.modalidad||'',team:a.club||'—',teamHtml:a.club||'—',uni:a.universidad||'',
      _codigo:a.codigo||a.cod||'',_rut:a.rut||'',
      // Avatar + nombre clickeable: misma experiencia que la nómina del Sudamericano
      nameHtml:_nomAvatar(a.nombre,a.codigo||a.cod||'',a.rut||'')
        +`<span onclick="nomFichaEv('${_nomEvKey(ev,a)}')" style="font-weight:${isPend?400:600};${isPend?'opacity:.75':''};cursor:pointer;border-bottom:1px dashed rgba(212,168,67,.4)" title="Ver ficha">${a.nombre}</span>`,
      estadoHtml:ev.fromFirebase?(a.status==='approved'
        ?`<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.3)"><i class=yl-i-check></i> OK</span>`
        :`<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:rgba(212,168,67,.12);color:var(--gold);border:1px solid rgba(212,168,67,.3)"><i class=yl-i-espera></i></span>`):''};
  });
}

function _nomEvCard(ev,ei){
  const id=_nsudaSlug(ev.name);
  const lc=ev.liveCount||{};
  const badges=(ev.fromFirebase?'<span style="font-size:10px;background:var(--green);color:#fff;padding:2px 8px;border-radius:10px;animation:pulse 2s infinite">EN VIVO</span>':'')
    +(ev.hasJsonFallback?' <span style="font-size:10px;background:rgba(212,168,67,.2);color:var(--gold);padding:2px 8px;border-radius:10px;border:1px solid rgba(212,168,67,.4)">Nómina manual</span>':'');
  return _nomCardShell(id,{
    name:ev.name,fecha:'',org:ev.organizer||ev.org||'',lugar:ev.location||'',
    count:ev.athletes.length,badges
  },()=>{
    const cd=cdStr(ev.date),cc=cdStr(ev.closeDate),cp=cdStrDT(ev.preNominaCloseAt);
    let h='';
    if(ev.fromFirebase&&lc.pending>0)h+=`<p style="font-size:11px;color:var(--gold);margin-bottom:8px"><i class=yl-i-espera></i> ${lc.pending} inscripción${lc.pending!==1?'es':''} pendiente${lc.pending!==1?'s':''} de aprobación${lc.approved?` · <span style="color:var(--green)"><i class=yl-i-check></i> ${lc.approved} confirmados</span>`:''}</p>`;
    // Countdowns (igual que antes, compactos)
    const hasCp=ev.preNominaCloseAt&&!cp.unknown;
    const cdBox=(t,c,color)=>`<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${t}</div>${c.done?`<div style="font-size:13px;font-weight:700;color:${color};font-family:Oswald">${t==='Competencia'?'ACTIVA':'CERRADA'}</div>`:c.unknown?`<div style="font-size:11px;color:var(--muted)">Por confirmar</div>`:`<div style="font-family:Oswald;font-size:17px;font-weight:700;color:${color}">${c.d}d ${c.h}h ${c.m}m</div>`}</div>`;
    h+=`<div style="display:grid;grid-template-columns:repeat(${hasCp?3:2},1fr);gap:9px;margin-bottom:8px">`;
    h+=cdBox('Competencia',cd,'var(--gold)')+cdBox('Cierre de Nómina',cc,'var(--accent)');
    if(hasCp)h+=cdBox('Cierre Inscripciones',cp,'var(--green)');
    h+=`</div>`;
    const rows=_nomEvRows(ev);
    h+=_nomFilters(rows,{teamLabel:'Club',mod:true});
    h+=_nomGLTable(rows,{marks:false,teamLabel:'Club',mod:!(ST.nomF&&ST.nomF.mod),estado:ev.fromFirebase});
    h+=_nomEntrenadores(ev);
    return h;
  });
}

// El campeonato que ya tiene su tarjeta de nómina publicada.
//
// El Sudamericano existe en DOS lados a la vez y es correcto que así sea: la
// nómina oficial, que llega en nomina_sudamericano.json con sus 414 atletas, y
// el evento del panel —id suda2026— que hace falta para la transmisión y el
// cronograma. Pero en la pestaña Nóminas son el MISMO campeonato, y salían dos
// tarjetas: la buena con los 414, y otra vacía, porque las inscripciones no
// cuelgan de ese id.
//
// Es el mismo caso de las jornadas y se resuelve igual: la gente ya está en la
// nómina grande, así que la tarjeta del evento sobra.
function _nsudaMismoEvento(){
  const j=window.NOMSUDA||{};
  const norm=x=>String(x==null?'':x).trim().toLowerCase();
  return new Set([j.eventoId,j.evento,j.eventoCorto].filter(Boolean).map(norm));
}

function nom(){
  let h='';
  const _haySuda=_nsudaVisible();
  if(_haySuda)h+=_nomSudaCard();
  let visibleEvs=(NM.events||[]).filter(ev=>ev.fromFirebase);
  if(_haySuda){
    const mismos=_nsudaMismoEvento();
    const norm=x=>String(x==null?'':x).trim().toLowerCase();
    visibleEvs=visibleEvs.filter(ev=>{
      if(!mismos.has(norm(ev.id))&&!mismos.has(norm(ev.name)))return true;
      // Se saca solo si está vacío. Si alguna vez tuviera inscripciones propias
      // se deja ver: esconder una tarjeta con gente adentro sería peor que
      // mostrar dos.
      return ((ev.athletes||[]).length>0);
    });
  }
  // Las inscripciones se piden al abrir esta pestaña, así que hay un momento en
  // que todavía no llegaron. Decir "no hay campeonatos activos" ahí es mentira y
  // asusta: se avisa que está cargando hasta que se sepa.
  if(!visibleEvs.length&&!h&&!window._nominasCargadas)
    return '<div class="emp" style="padding:40px;text-align:center;color:var(--muted)">Cargando campeonatos…</div>';
  if(!visibleEvs.length&&!h)return '<div class="emp" style="padding:40px;text-align:center;color:var(--muted)">No hay campeonatos activos. El administrador los publicará pronto.</div>';
  NM.events=visibleEvs;
  NM.events.forEach((ev,ei)=>{h+=_nomEvCard(ev,ei);});
  return h;
}

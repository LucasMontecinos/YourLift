// admin.html — El medallero: qué medallas hay que preparar para una nómina.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// La línea que va grabada atrás de una medalla.
//   Primer Lugar · Powerlifting Classic · -76 · Junior
// Para el movimiento, cuando no es el total, se dice cuál: una medalla de mejor
// sentadilla que solo diga "Primer Lugar -76 Junior" es indistinguible de la del
// total, y en la premiación se entregan las dos a personas distintas.
function _medGrabado(g,premio,i){
  const p=[MED_PUESTO[i],_medModGrab(g.mod)];
  if(premio&&premio!=='total'&&premio!=='bp_solo')p.push(MED_MOVN[premio]);
  p.push(g.cat,g.div);
  return p.filter(Boolean).join(' ');
}

// La división va SOLO en los overall que son de una división. En el absoluto no
// se nombra ninguna a propósito: compiten todas las edades juntas, y poner una
// haría pensar que la medalla es de esa.
function _medGrabadoOvr(o,i){
  return [MED_PUESTO[i],'Overall',
          o.sexo==='F'?'Femenino':'Masculino',
          _medModGrab(o.mod),
          o.tipo==='div'?o.div:''
         ].filter(Boolean).join(' ');
}

// Todas las medallas, una por línea, en el orden en que se entregan.
function _medGrabadoLista(P){
  const out=[];
  P.grupos.forEach(g=>g.premios.forEach(pr=>{
    for(let i=0;i<g.cuantos;i++)
      out.push({texto:_medGrabado(g,g.premios.length>1?pr:null,i),
                metal:['Oro','Plata','Bronce'][i]});
  }));
  P.ovr.forEach(o=>{
    for(let i=0;i<o.cuantos;i++)
      out.push({texto:_medGrabadoOvr(o,i),metal:['Oro','Plata','Bronce'][i]});
  });
  return out;
}

// Los atletas de una nómina, sean del archivo del Sudamericano o de las
// inscripciones de Firestore, en una sola forma.
function _medAtletas(ev){
  if(ev===NS_EV){
    return ((ST.sudaNom&&ST.sudaNom.atletas)||[]).map(a=>({
      nombre:a.nDisp||a.n||'', sexo:_medSexo(a.sexo), div:a.div||'', cat:a.cat||'',
      mod:a.mod||'', quien:a.pais||''}));
  }
  return (ST.inscripciones||[]).filter(i=>i.evento===ev&&i.status!=='rejected').map(i=>({
    nombre:i.nombre||'', sexo:_medSexo(i.sexo), div:i.division||'', cat:i.categoria||'',
    mod:i.modalidad||'', quien:i.club||''}));
}

function _medEstado(){
  ST.medallero=ST.medallero||{ev:'',preset:'full',mods:null,divs:null,sexos:null,ovr:null};
  return ST.medallero;
}

// El plan: cada grupo con sus premios, más los overall elegidos.
function _medPlan(){
  const M=_medEstado();
  const ats=_medAtletas(M.ev);
  const on=(set,k)=>!set||set[k]!==false;          // sin configurar = todo marcado
  const usados=ats.filter(a=>on(M.mods,a.mod)&&on(M.divs,a.div)&&on(M.sexos,a.sexo));
  const P=MED_PRESETS[M.preset]||MED_PRESETS.full;

  const g=new Map();
  usados.forEach(a=>{
    const k=[a.mod,a.sexo,a.div,a.cat].join('|');
    if(!g.has(k))g.set(k,[]);
    g.get(k).push(a);
  });
  const grupos=[];
  g.forEach((arr,k)=>{
    const [mod,sexo,div,cat]=k.split('|');
    // En banca sola el total ES la banca: una sola premiación, no dos medallas
    // por el mismo levantamiento.
    const premios=_medBanca(mod)?['bp']:(P.movs?['total','sq','bp','dl']:['total']);
    const cuantos=Math.min(3,arr.length);        // en categorías chicas, las que alcancen
    grupos.push({mod,sexo,div,cat,n:arr.length,premios,cuantos,med:cuantos*premios.length});
  });
  grupos.sort((x,y)=>
    (x.mod<y.mod?-1:x.mod>y.mod?1:0)||(x.sexo===y.sexo?0:x.sexo==='F'?-1:1)
    ||((MED_DIVORD[x.div]??9)-(MED_DIVORD[y.div]??9))||_medCatN(x.cat)-_medCatN(y.cat));

  // Overall, de dos alcances:
  //
  //   · POR DIVISIÓN — mejor Junior varón de Classic, mejor Open dama de
  //     Equipado. Cruza las categorías de peso pero no las edades.
  //   · ABSOLUTO — mejor varón y mejor dama de cada disciplina, cruzando
  //     TAMBIÉN las divisiones: entran sub-junior, junior, open y los master
  //     juntos. Es el "mejor levantador del campeonato" de cada modalidad.
  //
  // Los dos se eligen por separado: hay campeonatos que premian uno, otros los
  // dos, y otros ninguno.
  const ovrTodos=[];
  if(P.ovr){
    const porDiv=new Map(), porAbs=new Map();
    usados.forEach(a=>{
      porDiv.set([a.mod,a.sexo,a.div].join('|'),(porDiv.get([a.mod,a.sexo,a.div].join('|'))||0)+1);
      porAbs.set([a.mod,a.sexo].join('|'),(porAbs.get([a.mod,a.sexo].join('|'))||0)+1);
    });
    porAbs.forEach((n,k)=>{
      const [mod,sexo]=k.split('|');
      ovrTodos.push({tipo:'abs',mod,sexo,div:'',n,cuantos:Math.min(3,n),id:'abs|'+k,
                     etiqueta:(sexo==='F'?'Mejor Mujer':'Mejor Hombre')+' · '+mod});
    });
    porDiv.forEach((n,k)=>{
      const [mod,sexo,div]=k.split('|');
      ovrTodos.push({tipo:'div',mod,sexo,div,n,cuantos:Math.min(3,n),id:'div|'+k,
                     etiqueta:mod+' · '+(sexo==='F'?'Damas':'Varones')+' · '+div});
    });
    ovrTodos.sort((x,y)=>
      (x.tipo===y.tipo?0:x.tipo==='abs'?-1:1)
      ||(x.mod<y.mod?-1:x.mod>y.mod?1:0)||(x.sexo===y.sexo?0:x.sexo==='F'?-1:1)
      ||((MED_DIVORD[x.div]??9)-(MED_DIVORD[y.div]??9)));
  }
  const ovr=ovrTodos.filter(o=>on(M.ovr,o.id));

  let oro=0,plata=0,bronce=0; const porMod={};
  const sumar=(mod,cuantos,premios)=>{
    porMod[mod]=(porMod[mod]||0)+cuantos*premios;
    if(cuantos>=1)oro+=premios;
    if(cuantos>=2)plata+=premios;
    if(cuantos>=3)bronce+=premios;
  };
  grupos.forEach(gr=>sumar(gr.mod,gr.cuantos,gr.premios.length));
  ovr.forEach(o=>sumar(o.mod,o.cuantos,1));
  return {grupos,ovr,ovrTodos,porMod,oro,plata,bronce,
          total:oro+plata+bronce,atletas:usados.length,preset:P,
          opciones:{mods:[...new Set(ats.map(a=>a.mod))].filter(Boolean).sort(),
                    divs:[...new Set(ats.map(a=>a.div))].filter(Boolean)
                          .sort((x,y)=>(MED_DIVORD[x]??9)-(MED_DIVORD[y]??9)),
                    sexos:[...new Set(ats.map(a=>a.sexo))].sort()}};
}

window.medSet=function(campo,valor){
  const M=_medEstado();
  if(campo==='ev'){M.ev=valor;M.mods=M.divs=M.sexos=M.ovr=null;}
  else if(campo==='preset')M.preset=valor;
  render();
};

window.medTog=function(grupo,clave){
  const M=_medEstado();
  M[grupo]=M[grupo]||{};
  M[grupo][clave]=M[grupo][clave]===false;
  render();
};

window.medTodos=function(grupo,encender){
  const M=_medEstado();
  const P=_medPlan();
  const lista=grupo==='ovr'?P.ovrTodos.map(o=>o.id):P.opciones[grupo];
  M[grupo]={}; lista.forEach(k=>{M[grupo][k]=encender?true:false;});
  render();
};

function renderMedallero(){
  const M=_medEstado();
  const evs=[...new Set((ST.inscripciones||[]).map(i=>i.evento))].filter(Boolean);
  if(!M.ev) M.ev=evs[0]||(ST.sudaPublicada?NS_EV:'');
  const P=_medPlan();
  const on=(set,k)=>!set||set[k]!==false;
  const chip=(grupo,k,lbl,activo)=>`<button onclick="medTog('${escapeJsAttr(grupo)}','${escapeJsAttr(k)}')" style="padding:5px 11px;border-radius:14px;cursor:pointer;font-size:11px;border:1px solid ${activo?'var(--gold)':'var(--border)'};background:${activo?'rgba(212,168,67,.15)':'transparent'};color:${activo?'var(--gold)':'var(--muted)'}">${escapeHtml(lbl)}</button>`;

  let h='<div class="h1">Medallero</div>';
  h+='<p style="color:var(--muted);font-size:13px;margin-bottom:16px">Qué medallas hay que preparar para una nómina: cuántas, de qué metal y a qué podio corresponde cada una. Se calcula sobre los inscritos, así que sirve para encargarlas y grabarlas antes del campeonato.</p>';

  // Nómina
  h+='<div class="card" style="margin-bottom:12px"><div style="font-size:11px;color:var(--muted);letter-spacing:1px;margin-bottom:6px">NÓMINA</div>';
  h+='<select onchange="medSet(\'ev\',this.value)" style="width:100%;max-width:520px;padding:9px 11px;background:var(--bg);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:13px">';
  if(ST.sudaPublicada)h+=`<option value="${NS_EV}" ${M.ev===NS_EV?'selected':''}>Sudamericano 2026 (nómina FESUPO)</option>`;
  evs.forEach(e=>{h+=`<option value="${escapeHtml(e)}" ${M.ev===e?'selected':''}>${escapeHtml(e)}</option>`;});
  h+='</select></div>';

  // Qué documento
  h+='<div class="card" style="margin-bottom:12px"><div style="font-size:11px;color:var(--muted);letter-spacing:1px;margin-bottom:8px">QUÉ SE PREMIA</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px">';
  Object.entries(MED_PRESETS).forEach(([k,v])=>{
    const sel=M.preset===k;
    h+=`<div onclick="medSet('preset','${k}')" style="cursor:pointer;padding:11px 13px;border-radius:9px;border:1.5px solid ${sel?'var(--gold)':'var(--border)'};background:${sel?'rgba(212,168,67,.08)':'var(--bg)'}">
      <div style="font-weight:700;font-size:12.5px;color:${sel?'var(--gold)':'var(--text)'}">${v.n}</div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.45">${v.d}</div></div>`;
  });
  h+='</div></div>';

  // Filtros
  const bloque=(titulo,grupo,lista,lbl)=>{
    let b='<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +`<div style="font-size:11px;color:var(--muted);letter-spacing:1px">${titulo}</div>`
      +`<div style="display:flex;gap:6px"><button onclick="medTodos('${grupo}',true)" style="background:transparent;border:none;color:var(--muted);font-size:10px;cursor:pointer;text-decoration:underline">todos</button>`
      +`<button onclick="medTodos('${grupo}',false)" style="background:transparent;border:none;color:var(--muted);font-size:10px;cursor:pointer;text-decoration:underline">ninguno</button></div></div>`
      +'<div style="display:flex;gap:6px;flex-wrap:wrap">';
    lista.forEach(k=>{b+=chip(grupo,k,lbl?lbl(k):k,on(M[grupo],k));});
    return b+'</div></div>';
  };
  h+='<div class="card" style="margin-bottom:12px">';
  h+=bloque('MODALIDAD','mods',P.opciones.mods);
  h+=bloque('DIVISIÓN','divs',P.opciones.divs);
  h+=bloque('SEXO','sexos',P.opciones.sexos,k=>k==='F'?'Damas':'Varones');
  if(P.preset.ovr&&P.ovrTodos.length){
    h+=bloque('OVERALL · cuáles agregar','ovr',P.ovrTodos.map(o=>o.id),
      k=>{const o=P.ovrTodos.find(x=>x.id===k);return o.etiqueta;});
    h+='<div style="font-size:10.5px;color:var(--muted);line-height:1.5;margin-top:-4px">El overall se ordena por GL points, y el GL necesita el peso corporal, que existe recién después del pesaje. Acá va como cupo: tres medallas por cada overall marcado. Quiénes las ganan sale de livecast el día de la competencia.</div>';
  }
  h+='</div>';

  // Resumen
  h+='<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;flex-wrap:wrap">';
  [['Medallas',P.total,'var(--text)'],['Oro',P.oro,'#D4A843'],['Plata',P.plata,'#C0C0C0'],
   ['Bronce',P.bronce,'#CD7F32'],['Categorías',P.grupos.length,'var(--text)'],
   ['Overall',P.ovr.length,'var(--text)'],['Atletas',P.atletas,'var(--text)']].forEach(([l,n,c])=>{
    h+=`<div style="flex:1;min-width:96px;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
      <div class="os" style="font-size:26px;font-weight:700;color:${c}">${n}</div>
      <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase">${l}</div></div>`;
  });
  h+='</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-top:10px">Por modalidad: '
    +Object.entries(P.porMod).sort((a,b)=>b[1]-a[1]).map(([m,n])=>escapeHtml(m)+' <b style="color:var(--text)">'+n+'</b>').join(' · ')+'</div>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">'
    +'<button onclick="medDoc()" style="padding:10px 18px;background:var(--gold);color:#1a1205;border:none;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700">Generar documento (PDF)</button>'
    +'<button onclick="medCSV()" style="padding:10px 18px;background:transparent;border:1px solid var(--green);color:var(--green);border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700">Descargar planilla</button>'
    +'<button onclick="medGrabadoTxt()" title="Solo las líneas del grabado, una por medalla, para pegar en el correo de la cotización" style="padding:10px 18px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700">Texto de grabado</button></div>';
  h+='</div>';
  return h;
}

// La hoja que se le manda al grabador: una línea por medalla, con el texto
// exacto que va atrás. En página aparte a propósito — se imprime y se manda
// sola, sin el resto del informe.
function _medHojaGrabado(P){
  const e=escapeHtml;
  const L=_medGrabadoLista(P);
  if(!L.length)return '';
  let h='<div class="hoja"><div class="cab" style="margin-bottom:10px"><div><h1>Texto para grabado</h1>'
    +'<div class="sub">'+e(_medNombreEv())+'<br>'+L.length+' medallas · una línea por medalla</div></div></div>';
  h+='<div class="nota">Cada línea es lo que va grabado al reverso de una medalla. El orden es el de entrega: '
    +'dentro de cada categoría van primero, segundo y tercero. Las de movimiento dicen cuál es '
    +'—una de mejor sentadilla y una de total se entregan a personas distintas y no pueden decir lo mismo.</div>';
  // En dos columnas: son cientos de líneas y así entran en menos hojas.
  h+='<div style="column-count:2;column-gap:14mm;margin-top:8px">';
  h+='<table class="grab">';
  L.forEach((x,i)=>{
    h+='<tr><td class="i">'+(i+1)+'</td><td class="m">'+x.metal+'</td><td class="t">'+e(x.texto)+'</td></tr>';
  });
  h+='</table></div></div>';
  return h;
}

function _medNombreEv(){
  const M=_medEstado();
  return M.ev===NS_EV?((ST.sudaNom&&ST.sudaNom.evento)||'Sudamericano 2026'):M.ev;
}

// El documento se arma como HTML y se manda a imprimir: el navegador lo guarda
// como PDF. Sin librería de por medio, y sale en el papel igual que en pantalla.
window.medDoc=function(){
  const P=_medPlan();
  if(!P.total){showToast('Esa nómina no tiene atletas con los filtros puestos',null,true);return;}
  const e=escapeHtml;
  const sx=s=>s==='F'?'Damas':'Varones';
  let t=`<table><tr><th>Modalidad</th><th>Sexo</th><th>División</th><th>Cat.</th><th class="c">Atletas</th><th>Premios</th><th class="c">Por premio</th><th class="r">Medallas</th></tr>`;
  P.grupos.forEach(g=>{
    t+=`<tr><td>${e(g.mod)}</td><td>${sx(g.sexo)}</td><td>${e(g.div)}</td><td>${e(g.cat)}</td><td class="c">${g.n}</td><td>${g.premios.map(p=>MED_MOVN[p]).join(', ')}</td><td class="c">${g.cuantos}</td><td class="r">${g.med}</td></tr>`;
  });
  t+=`<tr class="tot"><td colspan="7">TOTAL · ${P.grupos.length} categorías</td><td class="r">${P.grupos.reduce((n,g)=>n+g.med,0)}</td></tr></table>`;
  let ov='';
  if(P.ovr.length){
    ov='<h2>Overall</h2><table><tr><th>Alcance</th><th>Modalidad</th><th>Sexo</th><th>División</th><th class="c">Atletas</th><th class="r">Medallas</th></tr>';
    P.ovr.forEach(o=>{ov+=`<tr><td>${o.tipo==='abs'?(o.sexo==='F'?'Mejor Mujer':'Mejor Hombre'):'Por división'}</td><td>${e(o.mod)}</td><td>${sx(o.sexo)}</td><td>${e(o.div)||'todas'}</td><td class="c">${o.n}</td><td class="r">${o.cuantos}</td></tr>`;});
    ov+=`<tr class="tot"><td colspan="5">TOTAL · ${P.ovr.length} overall</td><td class="r">${P.ovr.reduce((n,o)=>n+o.cuantos,0)}</td></tr></table>`;
    ov+='<div class="nota">El overall se ordena por GL points, que necesita el peso corporal del pesaje. Acá va el cupo de medallas; los ganadores salen de livecast.</div>';
  }
  const tiles=[[P.total,'Medallas en total'],[P.oro,'Oro'],[P.plata,'Plata'],[P.bronce,'Bronce'],
               [P.grupos.length,'Categorías'],[P.atletas,'Atletas']]
    .map(([n,l])=>`<div class="t"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
  const doc=`<!doctype html><html><head><meta charset="utf-8"><title>Medallero · ${e(_medNombreEv())}</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:14mm 12mm}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',Helvetica,sans-serif;color:#16202E;font-size:9.5pt}
h1{font-family:Oswald,sans-serif;font-size:22pt;line-height:1.05}
h2{font-family:Oswald,sans-serif;font-size:12pt;letter-spacing:1.5px;text-transform:uppercase;color:#8A6A18;margin:16px 0 6px;border-bottom:1.5px solid #D4A843;padding-bottom:3px}
.sub{color:#61707F;font-size:9pt;margin-top:3px}
.cab{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #16202E;padding-bottom:8px}
.marca{background:#0A1628;border-radius:6px;padding:7px 12px;display:inline-block}
.marca img{height:26px;width:auto;display:block}
.tiles{display:flex;gap:8px;margin:12px 0 4px}
.t{flex:1;border:1px solid #DCE3EB;border-radius:7px;padding:9px 11px}
.t .n{font-family:Oswald,sans-serif;font-size:21pt;font-weight:700;line-height:1}
.t .l{font-size:7.5pt;letter-spacing:1.2px;text-transform:uppercase;color:#61707F;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:4px}
th{text-align:left;font-size:7.5pt;letter-spacing:1px;text-transform:uppercase;color:#61707F;border-bottom:1px solid #C9D3DE;padding:4px 5px;font-weight:600}
td{padding:3.5px 5px;border-bottom:1px solid #EDF1F5}
tr:nth-child(even) td{background:#F7F9FB}
.r{text-align:right}.c{text-align:center}
.tot td{border-top:2px solid #16202E;border-bottom:none;font-weight:700;background:#fff!important;font-family:Oswald,sans-serif;font-size:10pt;padding-top:6px}
.nota{font-size:7.5pt;color:#61707F;line-height:1.5;margin-top:8px}
.pie{margin-top:14px;border-top:1px solid #C9D3DE;padding-top:6px;font-size:7.5pt;color:#8A97A5;display:flex;justify-content:space-between}
@media print{.noprint{display:none}}
.hoja{page-break-before:always;break-before:page}
.grab{width:100%;border-collapse:collapse;font-size:9pt}
.grab td{padding:3px 6px;border-bottom:1px solid #EDF1F5}
.grab td.m{width:52px;color:#61707F;font-size:7.5pt;text-transform:uppercase;letter-spacing:.5px}
.grab td.t{font-weight:600}
.grab td.i{width:34px;color:#8A97A5;text-align:right;font-size:7.5pt}</style></head><body>
<div class="cab"><div><h1>Medallero</h1><div class="sub">${e(_medNombreEv())}<br>${e(P.preset.n)}</div></div>
<div style="text-align:right"><div class="marca"><img src="${location.origin}/yourlift_logo_hd.png"></div><div class="sub">yourlift.cl</div></div></div>
<div class="tiles">${tiles}</div>
<div class="nota">${e(P.preset.d)} En <b>banca sola</b> el total es la misma marca que la banca, así que va una sola premiación. En categorías de menos de tres atletas se premia a los que haya. El conteo es sobre <b>inscritos</b>: es el techo, porque quien no marque un total válido no sube al podio.</div>
<h2>Categoría por categoría</h2>${t}${ov}
${_medHojaGrabado(P)}
<div class="pie"><span>YourLift SpA · yourlift.cl</span><span>Generado ${new Date().toLocaleDateString('es-CL')}</span></div>
<div class="noprint" style="margin-top:18px;text-align:center"><button onclick="window.print()" style="padding:10px 22px;font-size:13px;cursor:pointer">Guardar como PDF</button></div>
</body></html>`;
  const w=window.open('','_blank');
  if(!w){showToast('El navegador bloqueó la ventana. Permití las ventanas emergentes.',null,true);return;}
  w.document.write(doc); w.document.close();
  setTimeout(()=>{try{w.print();}catch(_){}} ,700);
  try{ logAction('medallero_doc',_medNombreEv(),null,P.total+' medallas'); }catch(_){}
};

// Solo las líneas, en texto pelado: es lo que se pega en el correo al grabador.
window.medGrabadoTxt=function(){
  const P=_medPlan();
  const L=_medGrabadoLista(P);
  if(!L.length){showToast('No hay medallas con los filtros puestos',null,true);return;}
  const txt=[_medNombreEv(),L.length+' medallas',''].concat(L.map(x=>x.texto)).join('\r\n');
  const blob=new Blob(['\ufeff'+txt],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='Grabado_'+String(_medNombreEv()).replace(/[^A-Za-z0-9]+/g,'_')+'.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  showToast('Texto de grabado · '+L.length+' medallas');
};

window.medCSV=function(){
  const P=_medPlan();
  const q=s=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"';
  const sx=s=>s==='F'?'Damas':'Varones';
  const L=[['Tipo','Modalidad','Sexo','Division','Categoria','Atletas','Premio','Puesto','Medalla','Texto para grabado'].map(q).join(',')];
  const MET=['Oro','Plata','Bronce'];
  P.grupos.forEach(g=>g.premios.forEach(p=>{
    for(let i=0;i<g.cuantos;i++)
      L.push(['Categoria',g.mod,sx(g.sexo),g.div,g.cat,g.n,MED_MOVN[p],i+1,MET[i],
              _medGrabado(g,g.premios.length>1?p:null,i)].map(q).join(','));
  }));
  P.ovr.forEach(o=>{
    for(let i=0;i<o.cuantos;i++)
      L.push(['Overall',o.mod,sx(o.sexo),o.div||'todas','—',o.n,
              o.tipo==='abs'?(o.sexo==='F'?'Mejor Mujer':'Mejor Hombre'):'Overall',
              i+1,MET[i],_medGrabadoOvr(o,i)].map(q).join(','));
  });
  // BOM para que Excel abra los acentos bien.
  const blob=new Blob(['﻿'+L.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='Medallero_'+String(_medNombreEv()).replace(/[^A-Za-z0-9]+/g,'_')+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  showToast('Planilla descargada · '+(L.length-1)+' medallas');
};

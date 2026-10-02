// livecast.html — El Control Remoto (?remote=1), pensado para el teléfono.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// ── Grilla del Control Remoto: columnas, alto y orden ─────────────────────
function _rmColumnas(){ return (window.innerWidth||0)>=700?4:2; }

// Alto de la grilla: lo que queda de pantalla debajo de su borde de arriba. Se
// guarda la medida del dibujo anterior, así cada redibujado sale ya del alto
// justo y no pega un salto. Con piso (botón que se pueda tocar) y techo (que en
// una pantalla grande no queden botones gigantes).
function _rmAltoGrilla(filas){
  const gap=8, piso=filas*54+(filas-1)*gap, techo=filas*130+(filas-1)*gap;
  const arriba=(typeof window._rmTop==='number')?window._rmTop:130;
  const abajo=(typeof window._rmAbajo==='number')?window._rmAbajo:16;
  const disp=(window.innerHeight||700)-arriba-abajo;
  return Math.round(Math.max(piso,Math.min(techo,disp)));
}

function _rmMedir(){
  const g=document.getElementById('rmGrid'); if(!g)return;
  const r=g.getBoundingClientRect();
  const top=Math.round(r.top+(window.scrollY||window.pageYOffset||0));
  // La pastilla "EL PÚBLICO LO VE" vive fija abajo a la derecha: si cae encima
  // de la grilla, se le deja lugar para que no tape ESCONDER TODO.
  let abajo=16;
  const pill=document.getElementById('syncPill');
  if(pill){ const pr=pill.getBoundingClientRect();
    if(pr.width&&pr.left<r.right&&pr.right>r.left)abajo=Math.round((window.innerHeight||0)-pr.top+8); }
  if(top!==window._rmTop||abajo!==window._rmAbajo){
    window._rmTop=top; window._rmAbajo=abajo;
    g.style.height=_rmAltoGrilla(+g.dataset.filas||6)+'px';
  }
}

// Orden de los botones, guardado en el equipo. Un id que ya no existe se
// descarta y uno nuevo se agrega al final: así sumar un botón no rompe nada.
function _rmOrden(ids){
  let g=null; try{ g=JSON.parse(localStorage.getItem('yl_remoteOrden')||'null'); }catch(e){}
  const out=Array.isArray(g)?g.filter(x=>ids.indexOf(x)>=0):[];
  ids.forEach(x=>{ if(out.indexOf(x)<0)out.push(x); });
  return out;
}

function _remoteSelStyle(){
  return 'width:100%;padding:12px;border-radius:10px;border:2px solid var(--border);background:#0a1628;color:var(--text);font-family:Oswald;font-size:15px;margin-top:8px';
}

function remoteMedalsPanel(){
  if(window._remoteMenu!=='medals')return '';
  const sel=window._mdSel||{mod:'',sex:'',div:'',cat:'',tipo:'total'};
  const MOD_LABEL={classic:'Classic',equipped:'Equipado',oe_classic:'Olimpiadas Especiales',universitario:'Universitario',onlybench:'Only Bench',classic_bench:'Classic + Bench',equipped_bench:'Equipado + Bench'};
  const vivos=DATA.athletes.filter(a=>!a.__is4);
  const byMod=vivos.filter(a=>!sel.mod||a.mod===sel.mod);
  const byModSex=byMod.filter(a=>!sel.sex||a.sex===sel.sex);
  const byModSexDiv=byModSex.filter(a=>!sel.div||a.div===sel.div);
  const uniq=(arr,f)=>[...new Set(arr.map(f))].filter(Boolean);
  const listo=sel.mod&&sel.sex&&sel.div&&sel.cat;
  const cuantos=listo?_medalTop3(sel).length:0;

  let h='<div id="rmPanel" style="margin-top:10px;padding:14px;border-radius:14px;border:2px solid var(--gold);background:rgba(212,168,67,.06)">';
  h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold)">QUÉ MEDALLERO MOSTRAR</div>';

  // Qué se premia — botones grandes, que es lo que más se cambia en la ceremonia.
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">';
  Object.keys(MEDAL_TIPOS).forEach(t=>{
    const act=(sel.tipo||'total')===t;
    h+='<button onclick="dirMdSet(\'tipo\',\''+t+'\')" style="min-height:52px;border-radius:10px;border:2px solid '
      +(act?'var(--gold)':'var(--border)')+';background:'+(act?'rgba(212,168,67,.18)':'rgba(10,22,40,.55)')
      +';color:'+(act?'var(--gold)':'var(--text)')+';font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer;-webkit-tap-highlight-color:transparent">'
      +MEDAL_TIPOS[t]+'</button>';
  });
  h+='</div>';

  const opt=(v,txt,cur)=>'<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(txt)+'</option>';
  h+='<select style="'+_remoteSelStyle()+'" onchange="dirMdSet(\'mod\',this.value)"><option value="">Modalidad —</option>';
  uniq(vivos,a=>a.mod).forEach(m=>{h+=opt(m,MOD_LABEL[m]||m,sel.mod)});
  h+='</select>';
  h+='<select style="'+_remoteSelStyle()+'" '+(sel.mod?'':'disabled')+' onchange="dirMdSet(\'sex\',this.value)"><option value="">Sexo —</option>';
  uniq(byMod,a=>a.sex).sort().forEach(s=>{h+=opt(s,(s==='Mujer'||s==='Femenino'||s==='F')?'Mujer':'Hombre',sel.sex)});
  h+='</select>';
  h+='<select style="'+_remoteSelStyle()+'" '+(sel.sex?'':'disabled')+' onchange="dirMdSet(\'div\',this.value)"><option value="">División —</option>';
  uniq(byModSex,a=>a.div).sort().forEach(d=>{h+=opt(d,d,sel.div)});
  h+='</select>';
  h+='<select style="'+_remoteSelStyle()+'" '+(sel.div?'':'disabled')+' onchange="dirMdSet(\'cat\',this.value)"><option value="">Categoría —</option>';
  uniq(byModSexDiv,a=>a.cat).sort((a,b)=>(parseFloat(a)||999)-(parseFloat(b)||999)).forEach(c=>{h+=opt(c,c+' kg',sel.cat)});
  h+='</select>';

  h+='<div style="font-size:11px;color:'+(listo&&!cuantos?'var(--orange)':'var(--muted)')+';margin-top:10px;line-height:1.5">'
    +(!listo?'Elige los cuatro para poder mostrarlo.'
      :(cuantos?('Listo: '+cuantos+' en el podio.')
               :'Con esa combinación todavía no hay nadie con marca válida.'))
    +'</div>';
  h+='<button onclick="dirToggleMedals()" '+(listo&&cuantos?'':'disabled')
    +' style="width:100%;margin-top:10px;min-height:58px;border-radius:12px;border:2px solid '
    +(listo&&cuantos?'var(--green)':'var(--border)')+';background:'+(listo&&cuantos?'rgba(34,197,94,.16)':'transparent')
    +';color:'+(listo&&cuantos?'#4ade80':'var(--muted)')+';font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:2px;cursor:'
    +(listo&&cuantos?'pointer':'not-allowed')+';-webkit-tap-highlight-color:transparent"><i class=yl-i-reproducir></i> MOSTRAR EN PANTALLA</button>';
  h+='</div>';
  return h;
}

function remoteBreakPanel(){
  if(window._remoteMenu!=='break')return '';
  const MIN=[5,10,15,20,30,45];
  let h='<div id="rmPanel" style="margin-top:10px;padding:14px;border-radius:14px;border:2px solid var(--gold);background:rgba(212,168,67,.06)">';
  h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold)">¿CUÁNTOS MINUTOS?</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">';
  MIN.forEach(m=>{
    h+='<button onclick="remoteBreakStart('+m+')" style="min-height:64px;border-radius:12px;border:2px solid var(--border);background:rgba(10,22,40,.55);color:var(--text);font-family:Oswald;font-size:20px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent">'
      +m+'<span style="font-size:10px;font-weight:600;color:var(--muted);display:block">min</span></button>';
  });
  h+='</div>';
  h+='<div style="display:flex;gap:8px;margin-top:10px;align-items:center">';
  h+='<input id="remoteBreakMin" type="number" min="1" max="120" placeholder="otro" style="flex:1;padding:12px;border-radius:10px;border:2px solid var(--border);background:#0a1628;color:var(--text);font-family:Oswald;font-size:15px">';
  h+='<button onclick="remoteBreakStart()" style="padding:12px 18px;border-radius:10px;border:2px solid var(--gold);background:rgba(212,168,67,.12);color:var(--gold);font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer">USAR</button>';
  h+='</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5">El cartel de descanso sale en pantalla con la cuenta regresiva. Para sacarlo antes de tiempo, vuelve a apretar YA VOLVEMOS.</div>';
  h+='</div>';
  return h;
}

function renderRemote(){
  _dirEnsureListener();
  if(!_dirState){_dirState={profile:{active:false,until:0},scoreboard:{active:false,until:0},leaderboard:{active:false,until:0,cat:''},tablaActual:{active:false,until:0},timer:{active:false,until:0},slam:{active:false,until:0,type:'g'}};}
  const on=(k)=>{const c=_dirState[k]||{};return c.active&&(!c.until||c.until>Date.now());};
  const cur=liftQueue()[0];
  const evName=(DATA.event==null?void 0:DATA.event.short)||(DATA.event==null?void 0:DATA.event.name)||'—';
  // Botón grande touch. col: cuántas columnas ocupa (por defecto 1).
  const bigBtn=(label,sub,active,onClick,col)=>{
    const bg=active?'linear-gradient(180deg,rgba(34,197,94,.28),rgba(34,197,94,.12))':'rgba(10,22,40,.55)';
    const bd=active?'#22c55e':'var(--border)';
    const col2=active?'#4ade80':'var(--text)';
    return '<button onclick="'+onClick+'" style="grid-column:span '+(col||1)+';min-height:0;height:100%;border-radius:14px;border:2px solid '+bd+';background:'+bg+';color:'+col2+';font-family:Oswald;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px 10px;-webkit-tap-highlight-color:transparent;transition:transform .08s" ontouchstart="this.style.transform=\'scale(.96)\'" ontouchend="this.style.transform=\'scale(1)\'">'
      +'<span style="font-size:16px;font-weight:700;letter-spacing:1px;text-align:center;line-height:1.1">'+label+'</span>'
      +(sub?'<span style="font-size:10px;font-weight:600;letter-spacing:1px;color:'+(active?'#86efac':'var(--muted)')+'">'+sub+'</span>':'')
      +'</button>';
  };
  // Cuatro columnas si hay ancho (computador, tablet echada), dos en el teléfono.
  const _rmCols=_rmColumnas();
  let h='<div class="fade" style="max-width:'+(_rmCols===4?960:560)+'px;margin:0 auto">';
  // Encabezado compacto
  h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap">';
  h+='<div><h2 class="os" style="font-size:20px;letter-spacing:1px;margin:0"><i class=yl-i-telefono></i> CONTROL REMOTO</h2>'
    +'<div style="font-size:11px;color:var(--muted)">'+evName+(cur?' · en tarima: <b style="color:var(--gold)">'+esc(cur.name)+'</b>':'')+'</div></div>';
  // Estado real: necesita Firebase listo Y el evento resuelto (si no, empujaría al
  // doc equivocado y el overlay de OBS no vería nada → "aprieto y no pasa nada").
  const _evtReady=!!fbDocId();
  const _connCol=(fbReady&&_evtReady)?'var(--green)':(fbReady?'var(--orange)':'var(--red)');
  const _connTxt=(fbReady&&_evtReady)?'CONECTADO':(fbReady?'CARGANDO EVENTO…':'CONECTANDO…');
  const _ord=!!window._rmOrdenar;
  h+='<div style="display:flex;align-items:center;gap:12px">'
    +'<span style="display:flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:50%;background:'+_connCol+';display:inline-block"></span>'
    +'<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px">'+_connTxt+'</span></span>'
    +'<button onclick="remoteOrdenar()" title="Cambiar los botones de lugar" style="padding:6px 12px;border-radius:8px;border:1px solid '+(_ord?'var(--gold)':'var(--border)')+';background:'+(_ord?'rgba(212,168,67,.18)':'transparent')+';color:'+(_ord?'var(--gold)':'var(--muted)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer">'+(_ord?'<i class=yl-i-check></i> LISTO':'↕ ORDENAR')+'</button>'
    +'</div>';
  h+='</div>';
  if(_ord){
    h+='<div style="margin:0 0 10px;padding:9px 12px;border-radius:10px;background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.4);color:var(--gold);font-size:12px;line-height:1.5;display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between">'
      +'<span>'+(window._rmSel?'Ahora toca el botón con el que lo quieres cambiar.':'Toca un botón y después otro: se cambian de lugar. Queda guardado en este equipo.')+'</span>'
      +'<button onclick="remoteOrdenReset()" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px;cursor:pointer">RESTABLECER</button></div>';
  }
  if(!(fbReady&&_evtReady)){
    h+='<div style="margin:0 0 12px;padding:10px 14px;border-radius:10px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.4);color:#f59e0b;font-size:12px;line-height:1.5">'
      +(fbReady?'Esperando que cargue el evento. Asegúrate de abrir el link con <b>?evento=TU_EVENTO&remote=1</b> y estar logueado como admin.':'Conectando a Firebase… Si no conecta, revisa tu internet y que estés logueado como admin.')
      +'</div>';
    // Re-chequear en 1s hasta que esté listo (evita quedar en "conectando" para siempre).
    if(!window._remotePoll){window._remotePoll=setTimeout(()=>{window._remotePoll=null;if(DATA.phase==='remote'){_dirEnsureListener();R();}},1000);}
  }
  // Todos los botones en UNA grilla que ocupa el alto de la pantalla, para que al
  // entrar se vean todos sin tener que bajar. Antes eran once botones de 88 px
  // apilados de a dos: en un notebook GOOD LIFT y NO LIFT quedaban cortados, y
  // YA VOLVEMOS y ESCONDER TODO ni aparecían. El orden lo elige la mesa (ORDENAR).
  const bt=_dirState&&_dirState.breakTimer, _descanso=!!(bt&&bt.active);
  const _slam=(t)=>{
    const g=t==='g';
    return '<button onclick="dirShowSlam(\''+t+'\')" style="min-height:0;height:100%;border-radius:14px;border:2px solid '+(g?'#22c55e':'#ef4444')
      +';background:linear-gradient(180deg,'+(g?'rgba(34,197,94,.25),rgba(34,197,94,.08)':'rgba(239,68,68,.25),rgba(239,68,68,.08)')
      +');color:'+(g?'#4ade80':'#f87171')+';font-family:Oswald;font-size:17px;font-weight:800;letter-spacing:1px;cursor:pointer;-webkit-tap-highlight-color:transparent">'
      +(g?'<i class=yl-i-check></i> GOOD LIFT':'<i class=yl-i-cruz></i> NO LIFT')+'</button>';
  };
  const BOTONES={
    profile:    oc=>bigBtn('PERFIL', on('profile')?'EN PANTALLA':'atleta actual', on('profile'), oc||"dirToggle('profile')"),
    scoreboard: oc=>bigBtn('MARCADOR', on('scoreboard')?'EN PANTALLA':'lower-third', on('scoreboard'), oc||"dirToggle('scoreboard')"),
    tablaActual:oc=>bigBtn('TABLA ACTUAL', on('tablaActual')?'EN PANTALLA':'ranking corner', on('tablaActual'), oc||"dirToggle('tablaActual')"),
    // Las luces se dejan prendidas toda la competencia: mientras no hay decisión
    // no se ve nada, y aparecen solas cuando los jueces marcan.
    luces:      oc=>bigBtn('LUCES', on('luces')?'ARMADO · aparece al decidir':'luces de jueces', on('luces'), oc||"dirToggle('luces')"),
    jurado:     oc=>bigBtn('JURADO', on('jurado')?'ARMADO · aparece al revertir':'decisión del jurado', on('jurado'), oc||"dirToggle('jurado')"),
    leaderboard:oc=>bigBtn('CLASIFICACIÓN', on('leaderboard')?'EN PANTALLA':'ranking cat.', on('leaderboard'), oc||"dirToggleLb()"),
    timer:      oc=>bigBtn('TIMER', on('timer')?'EN PANTALLA':'cronómetro', on('timer'), oc||"dirToggle('timer')"),
    // MEDALLERO abre el menú en vez de disparar: sin categoría elegida no hay
    // podio que mostrar, y se apretaba el botón y en pantalla no salía nada.
    medals:     oc=>bigBtn('MEDALLERO', on('medals')?'EN PANTALLA':(window._remoteMenu==='medals'?'elige abajo ▾':'elegir podio'), on('medals'), oc||"remoteMenu('medals')"),
    // Descanso ("ya volvemos"): abre el menú de minutos en vez de pedir que
    // alguien vaya al computador del Control TX a escribirlos.
    descanso:   oc=>bigBtn(_descanso?'QUITAR DESCANSO':'YA VOLVEMOS', _descanso?'en pantalla':(window._remoteMenu==='break'?'elige los minutos ▾':'cartel de descanso'), _descanso, oc||"remoteToggleBreak()"),
    good:       oc=>oc?bigBtn('GOOD LIFT','',false,oc):_slam('g'),
    nolift:     oc=>oc?bigBtn('NO LIFT','',false,oc):_slam('n'),
    esconder:   oc=>oc?bigBtn('⨯ ESCONDER TODO','',false,oc,2)
      :'<button onclick="dirHideAll()" style="grid-column:span 2;min-height:0;height:100%;border-radius:14px;border:2px solid var(--red);background:rgba(239,68,68,.1);color:#f87171;font-family:Oswald;font-size:16px;font-weight:700;letter-spacing:2px;cursor:pointer;-webkit-tap-highlight-color:transparent">⨯ ESCONDER TODO</button>',
  };
  const orden=_rmOrden(Object.keys(BOTONES));
  // Once botones, ESCONDER TODO ocupa dos lugares: doce casillas justas.
  const filas=Math.ceil(12/_rmCols);
  h+='<div id="rmGrid" data-filas="'+filas+'" style="display:grid;grid-template-columns:repeat('+_rmCols+',1fr);grid-template-rows:repeat('+filas+',1fr);grid-auto-flow:dense;gap:8px;height:'+_rmAltoGrilla(filas)+'px">';
  orden.forEach(id=>{
    if(!_ord){ h+=BOTONES[id](); return; }
    // Modo ordenar: el botón no dispara nada, se elige para cambiarlo de lugar.
    const sel=window._rmSel===id;
    const html=BOTONES[id]("remoteOrdenTap('"+id+"')");
    h+=sel?html.replace('border-radius:14px;','border-radius:14px;outline:3px solid var(--gold);outline-offset:2px;'):html;
  });
  h+='</div>';
  h+=remoteMedalsPanel();
  h+=remoteBreakPanel();
  // Ayuda / enlace del browser source para OBS
  const widgetUrl=location.origin+location.pathname.replace(/[^/]+$/,'')+'livecast.html?tx=director&evento='+encodeURIComponent((DATA.event==null?void 0:DATA.event.id)||(DATA.event==null?void 0:DATA.event.name)||'')+(TARIMA?'&tarima='+TARIMA:'');
  h+='<div style="margin-top:18px;padding:12px 14px;background:rgba(10,22,40,.4);border:1px solid var(--border);border-radius:10px">'
    +'<div style="font-size:11px;color:var(--muted);line-height:1.6">En OBS agrega <b style="color:var(--text)">un solo Browser Source</b> con esta URL (cámara de fondo + este overlay encima). No hace falta OBS WebSocket ni Stream Deck — este control empuja todo por internet.</div>'
    +'<div style="display:flex;gap:6px;align-items:center;margin-top:8px"><input readonly value="'+esc(widgetUrl)+'" onclick="this.select()" style="flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-family:monospace;font-size:11px"><button onclick="navigator.clipboard&&navigator.clipboard.writeText(\''+widgetUrl.replace(/'/g,"\\'")+'\');showToastLC(\'URL del overlay copiada\')" style="padding:8px 12px;border-radius:8px;border:1px solid var(--gold);background:rgba(212,168,67,.12);color:var(--gold);font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">COPIAR</button></div>'
    +'</div>';
  h+='</div>';
  // Medir ya dibujado: dónde quedó la grilla y si la pastilla de abajo la pisa.
  setTimeout(_rmMedir,0);
  return h;
}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

window.remoteMenu=function(cual){
  window._remoteMenu = (window._remoteMenu===cual) ? '' : cual;
  R();
  // Los botones ocupan toda la pantalla, así que el menú se abre debajo: se lo
  // trae a la vista para que no parezca que el botón no hizo nada.
  if(window._remoteMenu)setTimeout(function(){
    const p=document.getElementById('rmPanel');
    if(p)p.scrollIntoView({behavior:'smooth',block:'nearest'});
  },60);
};

window.remoteOrdenar=function(){ window._rmOrdenar=!window._rmOrdenar; window._rmSel=null; window._remoteMenu=''; R(); };

window.remoteOrdenTap=function(id){
  if(!window._rmSel){ window._rmSel=id; R(); return; }
  if(window._rmSel!==id){
    const ids=['profile','scoreboard','tablaActual','luces','jurado','leaderboard','timer','medals','descanso','good','nolift','esconder'];
    const o=_rmOrden(ids), i=o.indexOf(window._rmSel), j=o.indexOf(id);
    if(i>=0&&j>=0){ o[i]=id; o[j]=window._rmSel; try{ localStorage.setItem('yl_remoteOrden',JSON.stringify(o)); }catch(e){} }
  }
  window._rmSel=null; R();
};

window.remoteOrdenReset=function(){
  try{ localStorage.removeItem('yl_remoteOrden'); }catch(e){}
  window._rmSel=null; R();
};

// Arranca el descanso con los minutos del remoto, sin depender de los campos del
// Control TX: en el teléfono esos inputs no existen.
window.remoteBreakStart=async function(min){
  let m=min;
  if(!m){ m=parseInt((document.getElementById('remoteBreakMin')||{}).value||'0',10); }
  if(!m||m<1){ showToastLC('Elige cuántos minutos'); return; }
  if(!_dirState)_dirState={};
  const previo=_dirState.breakTimer||{};
  // Se arma igual que en el Control TX, pero conservando lo que ya estaba
  // configurado ahí —el estilo, los videos, el texto— para que el cartel se vea
  // igual se dispare desde donde se dispare.
  _dirState.breakTimer=Object.assign({},previo,{
    active:true, startedAt:Date.now(), durationSec:m*60, pausedAt:0,
  });
  await _dirPush();
  window._remoteMenu='';
  R();
  showToastLC('Descanso de '+m+' min en pantalla');
};

window.remoteToggleBreak=async function(){
  const bt=_dirState&&_dirState.breakTimer;
  if(bt&&bt.active){ await window.dirBreakHide(); window._remoteMenu=''; R(); return; }
  window.remoteMenu('break');
};

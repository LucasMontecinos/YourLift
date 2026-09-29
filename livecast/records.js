// livecast.html — Récords: sudamericanos, mundiales y nacionales durante la competencia, el panel de la tanda y el aviso de récord.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

function _srOn(){
  if(!RECSUDA||!DATA.event)return false;
  return DATA.event.records==='suda'||/^suda2026/.test(String(DATA.event.id||''));
}

function _srSexo(a){ return /^(f|muj|dam|fem)/i.test(String(a&&a.sex||''))?'F':'M'; }

function _srEquip(a){
  const m=String(a&&a.mod||'');
  if(m.indexOf('oe_')===0)return null;                       // Special Olympics: sin récords
  if(m==='invitado')return null;                             // fuera de competencia: no marca récord
  return (m==='equipped'||m==='equipped_bench')?'equipped':'classic';
}

function _srSoloBanca(a){ const m=String(a&&a.mod||''); return m==='onlybench'||m==='equipped_bench'; }

// "-83 kg (Hombre)", "83", "120+" → "-83" / "+120"
function _srCat(a){
  const s=String(a&&a.cat||'');
  const m=s.match(/([+-]?)\s*(\d+(?:[.,]\d+)?)/);
  if(!m)return '';
  const antes=s.slice(0,s.search(/\d/));
  const plus=m[1]==='+'||antes.indexOf('+')>=0||/^\s*\d+(?:[.,]\d+)?\s*\+/.test(s);
  return (plus?'+':'-')+String(parseFloat(String(m[2]).replace(',','.')));
}

function _srClases(){
  if(_SR_CLASES)return _SR_CLASES;
  const s=new Set();
  Object.keys(RECSUDA||{}).forEach(k=>{
    const p=k.split('|');                 // sexo|equip|division|categoria|movimiento
    if(p.length>=4)s.add(p.slice(0,4).join('|'));
  });
  return (_SR_CLASES=s);
}

function _srClaseExiste(sx,eq,dv,cat){
  const s=_srClases();
  return s.size?s.has([sx,eq,dv,cat].join('|')):true;   // sin tabla cargada no se filtra nada
}

function _srDivs(a){
  const d=_normDiv(String(a&&a.div||''));
  const ok=['Sub-Junior','Junior','Open','Master I','Master II','Master III','Master IV'];
  const out=[];
  if(ok.indexOf(d)>=0)out.push(d);
  if(out.indexOf('Open')<0)out.push('Open');
  // Y la de su edad, si es otra (un Junior inscrito en Open).
  const de=_divPorEdad(a);
  if(de&&out.indexOf(de)<0)out.push(de);
  const eq=_srEquip(a), cat=_srCat(a), sx=_srSexo(a);
  if(!eq||!cat)return out;
  const hay=out.filter(dv=>_srClaseExiste(sx,eq,dv,cat));
  // Si la tabla no conoce NINGUNA división de este atleta, se deja como estaba:
  // puede ser una categoría que todavía no está en el archivo, y callarle todos
  // los récords sería peor que marcarle de más.
  return hay.length?hay:out;
}

function _srLiftKey(a,l){ return (l==='bp'&&_srSoloBanca(a))?'bpsl':l; }

// Récords vigentes de un atleta para un movimiento: [{div,kg,quien,pais,fecha,lugar}]
// Si una división no tiene récord cargado, va con kg:0 (cualquier marca válida lo abre).
function _srRecords(a,l){
  if(!_srOn())return [];
  const eq=_srEquip(a); if(!eq)return [];
  const cat=_srCat(a); if(!cat)return [];
  if(l==='total'&&_srSoloBanca(a))return [];                 // Only Bench no hace total
  const key=_srLiftKey(a,l), sx=_srSexo(a);
  return _srDivs(a).map(dv=>{
    const r=_srVigente([sx,eq,dv,cat,key].join('|'));
    return {div:dv,cat:cat,kg:r.kg,quien:r.quien,pais:r.pais,
            fecha:r.fecha,lugar:r.lugar,vacio:r.vacio,hoy:r.hoy,hoyId:r.hoyId};
  });
}

// ── Récords logrados EN ESTA competencia ───────────────────────────
// El panel y los avisos tienen que mostrar el récord VIGENTE: si alguien lo
// rompe, el que viene atrás ya no compite contra la marca del archivo sino
// contra la nueva. No se guarda nada: se recalcula de los intentos válidos, así
// deshacer, corregir un peso o anular una decisión lo dejan al día solo.
// Se cachea por render (_SR_HOY) porque lo consulta cada casilla de la tabla.
function _srHoyCalc(){
  const out={};
  if(!_srOn())return out;
  const poner=(k,kg,a)=>{ if(!out[k]||kg>out[k].kg)out[k]={kg:kg,quien:a.name,id:a.id}; };
  (DATA.athletes||[]).forEach(a=>{
    const eq=_srEquip(a); if(!eq)return;
    const cat=_srCat(a); if(!cat)return;
    const sx=_srSexo(a), divs=_srDivs(a);
    LIFTS.forEach(l=>{
      let b=0;(a.att[l]||[]).forEach(x=>{ if(x&&x.r==='g'&&x.w>b)b=x.w; });
      if(b<=0)return;
      const lk=_srLiftKey(a,l);
      divs.forEach(dv=>poner([sx,eq,dv,cat,lk].join('|'),b,a));
    });
    if(!_srSoloBanca(a)){ const t=_srTotal(a);
      if(t>0)divs.forEach(dv=>poner([sx,eq,dv,cat,'total'].join('|'),t,a)); }
  });
  return out;
}

function _srHoyMap(){ if(!window._SR_HOY)window._SR_HOY=_srHoyCalc(); return window._SR_HOY; }

// Récord vigente de una clave: el del archivo, o el de hoy si ya lo superaron.
function _srVigente(k,hoy){
  const base=RECSUDA&&RECSUDA[k], h=(hoy||_srHoyMap())[k];
  if(h&&(!base||h.kg>base.kg))
    return {kg:h.kg,quien:h.quien,pais:'',fecha:'',lugar:'',vacio:false,hoy:true,hoyId:h.id};
  if(base)return {kg:base.kg,quien:base.quien,pais:base.pais,fecha:base.fecha,lugar:base.lugar,vacio:false,hoy:false};
  return {kg:0,quien:'',pais:'',fecha:'',lugar:'',vacio:true,hoy:false};
}

// ¿Este peso sería récord? Devuelve las divisiones que rompería (vacío = no).
// El propio atleta que acaba de poner el récord sigue viendo su casilla marcada
// (si no, al darle válido la marca "RÉCORD" desaparecía justo al conseguirlo).
function _srRompe(a,l,w){
  w=parseFloat(w)||0; if(w<=0)return [];
  return _srRecords(a,l).filter(r=>w>r.kg||(r.hoy&&r.hoyId===a.id&&w>=r.kg));
}

// ¿Este intento de peso muerto, si es válido, deja un TOTAL de récord?
// El total que cuenta es el que quedaría: mejor sentadilla + mejor banca + este
// peso muerto. Solo si el intento SUBE el total (supera su mejor peso muerto
// hasta ahora) y ya tiene sentadilla y banca válidas: sin eso no hay total.
// Antes la pantalla solo cantaba el récord del movimiento, y un tercer peso
// muerto que batía el récord de total salía a la tarima sin aviso.
function _srRompeTotal(a,w){
  w=parseFloat(w)||0; if(w<=0||!a||_srSoloBanca(a))return [];
  const mejor=l=>{ let b=0; ((a.att||{})[l]||[]).forEach(x=>{ if(x&&x.r==='g'&&x.w>b)b=x.w; }); return b; };
  const sq=mejor('sq'), bp=mejor('bp'), dl=mejor('dl');
  if(!sq||!bp||w<=dl)return [];
  const tot=Math.round((sq+bp+w)*100)/100;
  return _srRecords(a,'total').filter(r=>tot>r.kg).map(r=>Object.assign({},r,{total:tot}));
}

// Todo lo que rompería un intento: el récord del movimiento y, en peso muerto,
// también el de total. {mov:[…], tot:[…], total:kg, hay:bool}
// Récord de TOTAL que marca una casilla de peso muerto de la planilla. Si todavía
// no se levanta: el que dejaría si sale válido (_srRompeTotal). Si ya fue
// válido y es su mejor peso muerto: el que dejó — y se sigue viendo, igual que
// la marca del movimiento, que sigue a la vista después de conseguida.
function _srTotalCelda(a,l,at){
  if(l!=='dl'||!at||!(+at.w>0)||at.r==='n')return [];
  if(at.r===null)return _srRompeTotal(a,at.w);
  if(_srSoloBanca(a))return [];
  const sq=bestOf(a,'sq'), bp=bestOf(a,'bp'), dl=bestOf(a,'dl');
  if(!sq||!bp||+at.w!==dl)return [];
  const tot=Math.round((sq+bp+dl)*100)/100;
  return _srRecords(a,'total').filter(r=>tot>r.kg||(r.hoy&&r.hoyId===a.id&&tot>=r.kg)).map(r=>Object.assign({},r,{total:tot}));
}

function _srIntento(a,l,w){
  const mov=_srRompe(a,l,w);
  const tot=(l==='dl')?_srRompeTotal(a,w):[];
  const x={mov:mov,tot:tot,total:tot.length?tot[0].total:0,hay:!!(mov.length||tot.length)};
  x.mundial=_wrIntento(a,l,w,x);
  return x;
}

function _wrRecords(a,l){
  if(!RECMUNDIAL)return [];
  const eq=_srEquip(a), cat=_srCat(a); if(!eq||!cat)return [];
  const key=_srLiftKey(a,l), sx=_srSexo(a);
  return _srDivs(a).map(dv=>{
    const r=RECMUNDIAL[[sx,eq,dv,cat,key].join('|')];
    return r?{div:dv,cat:cat,kg:r.kg,quien:r.quien,pais:r.pais}:null;
  }).filter(Boolean);
}

function _wrIntento(a,l,w,x){
  const nada={mov:[],tot:[],hay:false};
  try{
    if(!RECMUNDIAL||!x||!x.hay)return nada;
    w=parseFloat(w)||0;
    const mov=x.mov.length?_wrRecords(a,l).filter(r=>w>r.kg):[];
    const tot=x.tot.length?_wrRecords(a,'total').filter(r=>x.total>r.kg):[];
    return {mov:mov,tot:tot,hay:!!(mov.length||tot.length)};
  }catch(e){ return nada; }
}

// El cartel. Se nombra el total cuando está en juego, para que la tarima, el
// público y la transmisión sepan que lo que se persigue es el récord de total.
function _srIntentoTexto(x){
  if(!x||!x.hay)return '';
  const wr=x.mundial;
  if(wr&&wr.hay){
    if(wr.mov.length&&wr.tot.length)return 'INTENTO DE RÉCORD MUNDIAL + TOTAL';
    if(wr.tot.length)return 'INTENTO DE RÉCORD MUNDIAL DE TOTAL';
    return 'INTENTO DE RÉCORD MUNDIAL';
  }
  if(x.mov.length&&x.tot.length)return 'INTENTO DE RÉCORD SUDAMERICANO + TOTAL';
  if(x.tot.length)return 'INTENTO DE RÉCORD SUDAMERICANO DE TOTAL';
  return 'INTENTO DE RÉCORD SUDAMERICANO';
}

// ── Al romperse un récord, subir a los que quedaron cortos ─────────
// Récord en 102.5, uno tira 103 y queda en 103: el que venía atrás con 103
// declarado YA NO rompe nada (hay que superarlo, no igualarlo). Se le sube al
// múltiplo de 2.5 siguiente por encima del récord nuevo — 105.
// Solo se toca a quien todavía NO levantó ese intento, y solo si su peso ERA de
// récord contra la marca anterior: a quien no iba por el récord no se le mueve
// nada. El cambio entra en el historial, así que Ctrl+Z lo revierte.
function _srMinRec(b,l,hoy){
  const eq=_srEquip(b); if(!eq)return null;
  const cat=_srCat(b); if(!cat)return null;
  if(l==='total'&&_srSoloBanca(b))return null;
  const sx=_srSexo(b), lk=_srLiftKey(b,l);
  let min=Infinity;
  _srDivs(b).forEach(dv=>{ const r=_srVigente([sx,eq,dv,cat,lk].join('|'),hoy); if(r.kg<min)min=r.kg; });
  return min===Infinity?null:min;
}

// Múltiplo de 2.5 más chico que SUPERE el peso dado (105 para un récord de 103).
function _srProxMultiplo(kg){ return Math.ceil((kg+0.0001)/2.5)*2.5; }

function _srSubirDeclarados(hoyAntes){
  if(!_srOn()||!hoyAntes)return [];
  window._SR_HOY=null;                       // recalcular ya con la marca nueva
  const cambios=[];
  (DATA.athletes||[]).forEach(b=>{
    if(b.bombed)return;
    LIFTS.forEach(l=>{
      const antes=_srMinRec(b,l,hoyAntes), ahora=_srMinRec(b,l,null);
      if(antes===null||ahora===null||ahora<=antes)return;   // este récord no se movió
      (b.att[l]||[]).forEach((at,j)=>{
        if(!at||at.r!==null||!(at.w>0))return;               // ya levantado o sin declarar
        if(at.w>ahora)return;                                // sigue siendo récord
        if(!(at.w>antes))return;                             // no iba por el récord
        const nuevo=_srProxMultiplo(ahora);
        if(!(nuevo>at.w))return;
        cambios.push({n:b.name,l:l,j:j,de:at.w,a:nuevo});
        at.w=nuevo;
        _markAtt(b.id,'att_'+l+'_'+j);
        const ck=b.id+'_'+l+'_'+j; if(DATA.changeTimers[ck])delete DATA.changeTimers[ck];
      });
    });
  });
  if(cambios.length)window._SR_HOY=null;
  return cambios;
}

function _srAvisarSubidas(cs){
  if(!cs||!cs.length)return;
  showToastLC('Récord nuevo — '+cs.map(c=>c.n+' '+LIFT_S[c.l]+(c.j+1)+': '+c.de+' → '+c.a+' kg').join(' · ')
    +'  (con el peso anterior ya no era récord)');
}

// Etiqueta corta para el badge: "SUD" o "SUD OPEN+JR"
function _srBadge(rs){
  if(!rs.length)return '';
  const S={'Sub-Junior':'SJR','Junior':'JR','Open':'OPEN','Master I':'M1','Master II':'M2','Master III':'M3','Master IV':'M4'};
  return 'RÉCORD SUD · '+rs.map(r=>S[r.div]||r.div).join(' + ');
}

// Total actual del atleta (los tres mejores válidos). Sirve para el récord de total.
function _srTotal(a){
  if(_srSoloBanca(a))return 0;
  let t=0;
  for(const l of LIFTS){
    let b=0; (a.att[l]||[]).forEach(x=>{ if(x&&x.r==='g'&&x.w>b)b=x.w; });
    if(!b)return 0;                                          // sin los tres, no hay total
    t+=b;
  }
  return t;
}

// ── Panel de récords de la tanda ──────────────────────────────────
// Lo pidió FESUPO: durante la tanda hay que tener a la vista los récords de las
// categorías que están levantando, del movimiento en curso. Se arma solo con los
// atletas de la tanda activa, agrupado por categoría + división.
// El panel de récords. Se usa igual en el Control en Vivo y en la vista del
// público: no depende de tener sesión, porque solo lee, y arranca ABIERTO en
// las dos. Los récords tienen que estar a la vista —pedido de FESUPO para la
// mesa, y de la misma mesa para el público—, no escondidos detrás de un click.
function _srPanel(){
  if(!_srOn())return '';
  const pool=DATA.athletes.filter(a=>a.flight===DATA.flight&&!a.bombed&&_inTarima(a.flight));
  const base=pool.length?pool:DATA.athletes.filter(a=>!a.bombed&&_inTarima(a.flight));
  if(!base.length)return '';
  // Una fila por categoría + división + línea que esté en la tanda, con los cuatro
  // récords: sentadilla, banca, peso muerto y TOTAL. El Only Bench solo tiene el de
  // banca (bench press single lift, que es un récord aparte del de powerlifting).
  const MOVS=['sq','bp','dl','total'];
  const filas=new Map();
  base.forEach(a=>{
    const eq=_srEquip(a); if(!eq)return;
    const solo=_srSoloBanca(a)&&!_isPlusBench(a);
    _srDivs(a).forEach(dv=>{
      const k=[_srSexo(a),eq,dv,_srCat(a),solo?'ob':'pl'].join('|');
      if(!filas.has(k)){
        const f={sexo:_srSexo(a),eq,div:dv,cat:_srCat(a),solo,n:0,r:{}};
        MOVS.forEach(l=>{
          if(solo&&l!=='bp'){f.r[l]=null;return;}
          const key=[f.sexo,eq,dv,f.cat,(l==='bp'&&solo)?'bpsl':l].join('|');
          const rec=_srVigente(key);
          f.r[l]=rec.vacio?{kg:0,vacio:true}:{kg:rec.kg,quien:rec.quien,pais:rec.pais,hoy:rec.hoy};
        });
        filas.set(k,f);
      }
      filas.get(k).n++;
    });
  });
  if(!filas.size)return '';
  const CATN=c=>(parseFloat(String(c).replace(/[^0-9.]/g,''))||999)+(c[0]==='+'?0.5:0);
  const DVO={'Sub-Junior':0,'Junior':1,'Open':2,'Master I':3,'Master II':4,'Master III':5,'Master IV':6};
  const rows=[...filas.values()].sort((x,y)=>
    (x.sexo===y.sexo?0:x.sexo==='F'?-1:1)||(x.eq===y.eq?0:x.eq==='classic'?-1:1)
    ||CATN(x.cat)-CATN(y.cat)||(DVO[x.div]-DVO[y.div])||(x.solo?1:0)-(y.solo?1:0));
  if(window._SR_PANEL_OPEN===undefined)window._SR_PANEL_OPEN=true;
  const ab=!!window._SR_PANEL_OPEN;
  // Cuántas marcas de esta tanda ya se batieron hoy. Va en el título para que,
  // aunque el panel esté plegado, se vea que pasó algo.
  let nuevos=0;
  rows.forEach(r=>MOVS.forEach(l=>{ if(r.r[l]&&r.r[l].hoy)nuevos++; }));
  const celda=r=>{
    if(!r)return '<td style="padding:4px 6px;text-align:center;color:rgba(150,170,200,.25)">—</td>';
    if(r.vacio)return '<td style="padding:4px 6px;text-align:center;color:var(--muted);font-size:10px">sin récord</td>';
    // Récord puesto HOY: se marca, para que se vea de dónde salió el número nuevo.
    if(r.hoy)return '<td title="'+esc('NUEVO — '+(r.quien||'')+', en esta competencia')+'" style="padding:4px 6px;text-align:center;font-family:Oswald;font-weight:800;color:#0f1a10;background:#F2C230;white-space:nowrap">'+r.kg+' <span style="font-size:8px;letter-spacing:.5px">NUEVO</span></td>';
    return '<td title="'+esc((r.quien||'')+(r.pais?' · '+r.pais:''))+'" style="padding:4px 6px;text-align:center;font-family:Oswald;font-weight:700;color:#F2C230;white-space:nowrap">'+r.kg+'</td>';
  };
  let h='<div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;border:1px solid rgba(242,194,48,.45)">';
  h+='<button onclick="window._SR_PANEL_OPEN=!window._SR_PANEL_OPEN;R()" style="width:100%;display:flex;align-items:center;gap:8px;padding:9px 13px;border:none;background:rgba(242,194,48,.10);color:#F2C230;font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;text-align:left">'
    +'<span><i class=yl-i-trofeo></i> RÉCORDS SUDAMERICANOS</span>'
    +(nuevos?'<span style="background:#F2C230;color:#0f1a10;font-size:10px;font-weight:800;letter-spacing:.5px;padding:2px 7px;border-radius:4px;white-space:nowrap">'
        +nuevos+(nuevos>1?' NUEVOS':' NUEVO')+'</span>':'')
    +'<span style="font-size:10px;color:var(--muted);font-weight:400;letter-spacing:0">sentadilla · banca · peso muerto · total, de las categorías que están en la tanda '+(DATA.flight||'—')+'</span>'
    +'<span style="flex:1"></span><span style="font-size:13px">'+(ab?'▾':'▸')+'</span></button>';
  if(ab){
    h+='<div style="max-height:300px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
    h+='<tr style="position:sticky;top:0;background:#0D1F38">'
      +['Cat.','División','Modalidad'].map(t=>'<th style="padding:5px 9px;text-align:left;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px;border-bottom:1px solid var(--border);white-space:nowrap">'+t+'</th>').join('')
      +[['SQ',LIFT_C.sq],['BP',LIFT_C.bp],['DL',LIFT_C.dl],['TOTAL','#F2C230']].map(t=>'<th style="padding:5px 9px;text-align:center;color:'+t[1]+';font-family:Oswald;font-size:10px;letter-spacing:1px;border-bottom:1px solid var(--border)">'+t[0]+'</th>').join('')
      +'<th style="border-bottom:1px solid var(--border)"></th></tr>';
    rows.forEach(r=>{
      h+='<tr style="border-bottom:1px solid rgba(29,49,80,.3)">'
        +'<td style="padding:4px 9px;white-space:nowrap"><b>'+r.cat+'</b> <span style="color:var(--muted)">'+(r.sexo==='F'?'F':'M')+'</span></td>'
        +'<td style="padding:4px 9px;white-space:nowrap">'+r.div+'</td>'
        +'<td style="padding:4px 9px;color:var(--muted);white-space:nowrap">'+(r.eq==='classic'?'Classic':'Equipado')+(r.solo?' · Only Bench':'')+'</td>'
        +MOVS.map(l=>celda(r.r[l])).join('')
        +'<td style="padding:4px 9px;color:var(--muted);white-space:nowrap;font-size:10px">'+(r.n>1?r.n+' atletas':'')+'</td>'
      +'</tr>';
    });
    h+='</table></div>';
    // El "pasá el mouse" se decía como si todos estuvieran en un computador, y
    // esto ahora lo ve el público desde el teléfono, donde no hay mouse ni sale
    // el globito. Se dice dónde funciona en vez de prometerlo a todos.
    h+='<div style="padding:6px 13px;font-size:10px;color:var(--muted);border-top:1px solid var(--border)">'
      +'Cada atleta se mide contra su división y contra el Open. '
      +'<span style="color:#F2C230">NUEVO</span> = récord batido en esta competencia. '
      +'Desde un computador, pasando el mouse por una marca se ve quién la tiene. '
      +(window._SR_FUENTE?esc(window._SR_FUENTE):'')+'</div>';
  }
  h+='</div>';
  return h;
}

function checkRecord(athlete,lift,round){
  if(!RECORDS)return;
  if(DATA.event && DATA.event.recordsEnabled===false)return;
  const weight=athlete.att[lift][round].w;if(!weight)return;
  const mod=athlete.mod||'classic';
  const cat=_normCat(athlete.cat||'');
  const div=_normDiv(athlete.div||'');
  // Competencia universitaria → todo buen intento es primer récord (modalidad nueva)
  const isUniv=((DATA.event==null?void 0:DATA.event.name)||'').toLowerCase().includes('universitario');
  if(isUniv){
    showRecordAlert(athlete.name,lift,round,weight,0,'Sin récord previo',cat,div,'universitario');
    pushRecordToFB({athName:athlete.name,lift,round,newMark:weight,oldMark:0,holder:'Sin récord previo',cat,div,mod:'universitario',ts:Date.now()});
    return;
  }
  const recs=(RECORDS[mod]&&RECORDS[mod][lift])||[];
  const match=recs.find(rec=>rec.categoria===cat&&_normDiv(rec.division)===div);
  if(match&&weight>match.marca){
    showRecordAlert(athlete.name,lift,round,weight,match.marca,match.nombre,cat,div,mod);
    // Push al doc livecast_record/current para que los widgets OBS muestren el badge
    pushRecordToFB({
      athName:athlete.name,lift,round,
      newMark:weight,oldMark:match.marca,holder:match.nombre,
      cat,div,mod,ts:Date.now()
    });
  }
}

async function pushRecordToFB(rec){
  if(!fbReady||!isAdmin||!window._fb)return;
  try{
    await window._fb.setDoc(window._fb.doc(fbDB,'livecast_record',evStateDocId('current')),rec);
  }catch(e){console.warn('[FB] pushRecord',e)}
}

function closeRecAlert(){const e=document.getElementById('recAlert');if(e)e.remove();}

function showRecordAlert(athName,lift,round,newMark,oldMark,holder,cat,div,mod){
  const ex=document.getElementById('recAlert');if(ex)ex.remove();
  const LL={sq:'SQUAT',bp:'BENCH PRESS',dl:'DEADLIFT'};
  const el=document.createElement('div');el.id='recAlert';
  el.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:99999';
  el.innerHTML='<div style="background:#0D1F38;border:3px solid #C41E3A;border-radius:20px;padding:36px 44px;max-width:540px;width:90%;text-align:center;box-shadow:0 0 80px rgba(196,30,58,.45)">'
    +'<div style="font-size:48px;margin-bottom:6px">&#127942;</div>'
    +'<div style="font-family:Oswald;font-size:13px;letter-spacing:4px;color:#C41E3A;margin-bottom:10px">'+(mod==='universitario'?'RÉCORD UNIVERSITARIO':'POSIBLE RÉCORD NACIONAL')+'</div>'
    +'<div style="font-family:Oswald;font-size:28px;font-weight:700;color:#fff;margin-bottom:4px">'+athName+'</div>'
    +'<div style="font-family:Oswald;font-size:16px;color:#D4A843;margin-bottom:20px">'+LL[lift]+' &middot; -'+cat+'kg &middot; '+div+' &middot; '+(mod==='universitario'?'Universitario':mod==='equipped'?'Equipado':'Classic')+'</div>'
    +'<div style="display:flex;justify-content:center;gap:28px;align-items:center;margin-bottom:24px">'
    +'<div><div style="font-size:10px;color:#8A9BB2;letter-spacing:2px;margin-bottom:4px">NUEVA MARCA</div>'
    +'<div style="font-family:Oswald;font-size:52px;font-weight:700;color:#22c55e">'+newMark+'<span style="font-size:22px"> kg</span></div></div>'
    +(oldMark>0?'<div style="font-size:28px;color:#8A9BB2">&rarr;</div>'
    +'<div><div style="font-size:10px;color:#8A9BB2;letter-spacing:2px;margin-bottom:4px">RÉCORD ANTERIOR</div>'
    +'<div style="font-family:Oswald;font-size:38px;font-weight:700;color:#8A9BB2">'+oldMark+' kg</div>'
    +'<div style="font-size:10px;color:#8A9BB2;margin-top:2px">'+holder+'</div></div>':'')
    +'</div>'
    +'<button onclick="closeRecAlert()" style="padding:10px 30px;border-radius:10px;border:2px solid #C41E3A;background:transparent;color:#fff;font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:2px;cursor:pointer">CONFIRMAR &amp; CERRAR</button>'
    +'<div style="font-size:10px;color:#8A9BB2;margin-top:10px">&#9888;&#65039; Sujeto a confirmación del intento por los jueces &mdash; se cierra en 15s</div>'
    +'</div>';
  document.body.appendChild(el);
  setTimeout(()=>{const e=document.getElementById('recAlert');if(e)e.remove();},15000);
}

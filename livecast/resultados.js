// livecast.html — La tabla de Resultados: posiciones, proyecciones y el virtual.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// Renderiza UNA tabla de resultados filtrando por modalidad/vista
function _renderResultsTable(opts){
  const view=opts.view||'meet';
  const isBench=view==='bench';
  const all=opts.athletes.map(a=>({...a,total:totalOf(a,view),gl:calcGL(totalOf(a,view),a.bw,a.sex,_glMod(a),view),
    proy:_proyTotal(a,view), pendiente:_quedaPorLevantar(a,view)}));
  if(!all.length)return '';
  // Cuántas casillas de intento mostrar por lift: 3 normalmente, 4 si algún atleta
  // de la tabla tuvo un 4º intento en ese lift (solo esos lo ven). Header y filas
  // se ajustan a esto para no quedar descuadradas.
  const maxAtts={};(isBench?['bp']:['sq','bp','dl']).forEach(l=>{maxAtts[l]=Math.max(3,...all.map(a=>(a.att[l]||[]).length));});
  const SEP='|';
  const catGroups={};
  all.forEach(a=>{const k=_catGroupKey(a);if(!catGroups[k])catGroups[k]=[];catGroups[k].push(a);});
  // Orden dentro de cada cat+div+sex por el total PROYECTADO: mientras la categoría
  // esté compitiendo, eso es la posición virtual con lo que cada uno tiene declarado
  // —al principio, sus aperturas—; cuando ya se juzgó todo, el proyectado es el
  // total real y el puesto queda firme. Antes se ordenaba por el total ya levantado,
  // así que hasta el primer válido la tabla salía toda en blanco y sin orden.
  // A igual marca gana el más liviano, como manda la IPF.
  Object.values(catGroups).forEach(arr=>arr.sort((a,b)=>{
    const aDQ = view==='meet' && isDQ(a);
    const bDQ = view==='meet' && isDQ(b);
    if(aDQ!==bDQ) return aDQ?1:-1;  // no-DQ primero
    return (b.proy-a.proy)||(b.total-a.total)||((a.bw||999)-(b.bw||999));
  }));
  const catPos={};
  Object.values(catGroups).forEach(arr=>{
    let p=1;
    arr.forEach(a=>{
      const dq = view==='meet' && isDQ(a);
      if(a.proy>0 && !dq){catPos[a.id]=p;p++;}
    });
  });
  // Una categoría está cerrada cuando a nadie le queda un intento por levantar.
  const catCerrada={};
  Object.entries(catGroups).forEach(([k,arr])=>{ catCerrada[k]=!arr.some(a=>a.pendiente); });
  const sorted=[];
  const catKeys=Object.keys(catGroups).sort((a,b)=>{
    const [sa,ca,da]=a.split(SEP);
    const [sb,cb,db]=b.split(SEP);
    const isMa=sa==='Hombre'||sa==='Masculino'||sa==='M'?1:0;
    const isMb=sb==='Hombre'||sb==='Masculino'||sb==='M'?1:0;
    if(isMa!==isMb)return isMa-isMb;
    const na=parseFloat(ca.replace(/[^0-9.]/g,''))||999;
    const nb=parseFloat(cb.replace(/[^0-9.]/g,''))||999;
    if(na!==nb)return na-nb;
    return _DIV_ORDER(da)-_DIV_ORDER(db);
  });
  catKeys.forEach(k=>catGroups[k].forEach(a=>sorted.push(a)));
  const withTotal=all.filter(a=>a.total>0).length;
  // Pos,Atleta,BW,Div,Cat (5) + intentos + subtotales + Virtual,Total,GL (3).
  const colspanTotal=isBench
    ? 5+maxAtts.bp+1+3
    : 5+maxAtts.sq+maxAtts.bp+maxAtts.dl+3+3;
  let h='<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px">';
  h+='<div style="padding:10px 16px;background:linear-gradient(90deg,'+opts.color+'22,transparent);border-bottom:2px solid '+opts.color+';display:flex;justify-content:space-between;align-items:center">';
  h+='<div class="os" style="font-size:15px;font-weight:700;letter-spacing:2px;color:'+opts.color+'">'+opts.icon+' '+opts.title+'</div>';
  h+='<div style="font-size:10px;color:var(--muted);letter-spacing:1px">'+withTotal+' / '+all.length+' clasificados</div>';
  h+='</div>';
  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:2px solid var(--border)">';
  h+='<th class="os" style="padding:8px 4px;text-align:center;color:var(--muted);font-size:9px;width:28px">Pos</th>';
  h+='<th style="padding:8px 4px;text-align:left;color:var(--muted);font-size:9px">Atleta</th>';
  h+='<th style="padding:8px 3px;text-align:center;color:var(--muted);font-size:9px;width:44px">BW</th>';
  h+='<th style="padding:8px 3px;text-align:center;color:var(--muted);font-size:9px">Div</th>';
  h+='<th style="padding:8px 3px;text-align:center;color:var(--muted);font-size:9px">Cat</th>';
  if(isBench){
    for(let r=1;r<=maxAtts.bp;r++){const is4=r===4;h+='<th style="padding:8px 2px;text-align:center;color:'+(is4?'#60a5fa':LIFT_C['bp'])+';font-size:9px;width:60px"'+(is4?' title="4º intento"':'')+'>BP'+r+(is4?'*':'')+'</th>'}
    h+='<th style="padding:8px 2px;text-align:center;color:'+LIFT_C['bp']+';font-size:9px;width:60px;font-weight:800">Best BP</th>';
  } else {
    ['sq','bp','dl'].forEach(l=>{for(let r=1;r<=maxAtts[l];r++){const is4=r===4;h+='<th style="padding:8px 2px;text-align:center;color:'+(is4?'#60a5fa':LIFT_C[l])+';font-size:9px;width:46px"'+(is4?' title="4º intento"':'')+'>'+LIFT_S[l]+r+(is4?'*':'')+'</th>'}h+='<th style="padding:8px 2px;text-align:center;color:'+LIFT_C[l]+';font-size:9px;width:48px;font-weight:800">Sub</th>'});
  }
  h+='<th class="os" title="Suma los intentos que tiene puestos como si fueran válidos, junto con lo que ya validó" style="padding:8px 4px;text-align:center;color:#f59e0b;font-size:10px;width:46px">Virtual</th>';
  h+='<th class="os" title="Solo lo que ya validó" style="padding:8px 4px;text-align:center;color:var(--text);font-size:10px;width:46px">Total</th>';
  h+='<th class="os" style="padding:8px 4px;text-align:center;color:var(--gold);font-size:10px;width:48px">GL</th>';
  h+='</tr></thead><tbody>';
  let prevCat='';
  sorted.forEach(a=>{
    const catKey=_catGroupKey(a);
    if(catKey!==prevCat){
      const symb=(_normSex(a.sex)==='F'?'F':'M');
      const cerrada=catCerrada[catKey];
      const sello=cerrada
        ? '<span style="background:rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.5);color:var(--green);font-size:9px;letter-spacing:1px;padding:1px 7px;border-radius:4px;margin-left:8px">POSICIÓN FINAL</span>'
        : '<span style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.45);color:#f59e0b;font-size:9px;letter-spacing:1px;padding:1px 7px;border-radius:4px;margin-left:8px" title="Todavía quedan intentos por levantar en esta categoría">POSICIÓN VIRTUAL</span>';
      h+='<tr><td colspan="'+colspanTotal+'" style="padding:7px 8px;background:rgba(196,30,58,.1);border-bottom:2px solid var(--accent);font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px;color:var(--accent)">'+symb+' '+_normCat(a.cat||'?')+' — '+_normDiv(a.div||'Sin Div')
        +' <span style="opacity:.7;font-size:10px;letter-spacing:1px">· '+_lineaLbl(a)+'</span>'+sello+'</td></tr>';
      prevCat=catKey;
    }
    const dq = view==='meet' && isDQ(a);
    const pos = dq ? 'DQ' : (catPos[a.id]||'—');
    h+='<tr style="border-bottom:1px solid rgba(29,49,80,.25);'+(a.bombed?'opacity:.4':dq?'opacity:.7':'')+'">';
    const virtual=!dq&&typeof pos==='number'&&!catCerrada[catKey];
    h+='<td class="os" title="'+(dq?'Descalificado':virtual?'Posición virtual: todavía quedan intentos':'Posición final')+'" style="padding:6px 4px;text-align:center;color:'+(dq?'var(--red)':typeof pos==="number"&&pos<=3?'var(--gold)':'var(--muted)')+';font-weight:700;font-size:14px;'+(virtual?'opacity:.85':'')+'">'+pos+(virtual?'<span style="font-size:9px;color:#f59e0b;margin-left:1px">~</span>':'')+'</td>';
    if(_variosPaises()){
      h+='<td style="padding:6px 4px"><div style="font-weight:600;font-size:12px;white-space:nowrap;display:flex;align-items:center">'+_flagImg(_ctry(a),12,true)+'<span>'+a.name+'</span></div><div style="display:flex;align-items:center;gap:4px;font-size:9px;color:var(--muted)">'+(window.clubLogoImg?window.clubLogoImg(a.club,14,'background:rgba(10,22,40,.4);padding:1px;'):'')+'<span>'+a.club+'</span></div></td>';
    }else{
      // Un solo país: el logo del club donde iba la bandera, y abajo el club en texto.
      h+='<td style="padding:6px 4px"><div style="font-weight:600;font-size:12px;white-space:nowrap;display:flex;align-items:center">'+_logoClub(a,22)+'<span>'+a.name+'</span></div>'
        +'<div style="font-size:9px;color:var(--muted);white-space:nowrap">'+(a.club||'')+'</div></td>';
    }
    h+='<td style="padding:6px 3px;text-align:center;font-size:11px">'+(a.bw||'—')+'</td>';
    h+='<td style="padding:6px 3px;text-align:center;font-size:10px">'+(a.div||'—')+'</td>';
    h+='<td style="padding:6px 3px;text-align:center;font-size:10px">'+(a.cat||'—')+'</td>';
    const _attTd=(at)=>{
      if(!at)return '<td style="padding:4px 2px;text-align:center;color:var(--border);font-family:Oswald;font-size:11px">·</td>';
      let st='',tx=at.w||'—';
      if(at.r==='g')st='background:rgba(34,197,94,.12);color:var(--green);font-weight:700';
      else if(at.r==='n')st='background:rgba(239,68,68,.1);color:var(--red);text-decoration:line-through';
      else if(at.w>0)st='color:var(--text)';else st='color:var(--border)';
      return '<td style="padding:4px 2px;text-align:center;'+st+';font-family:Oswald;font-size:11px">'+tx+'</td>';
    };
    if(isBench){
      for(let j=0;j<maxAtts.bp;j++)h+=_attTd(a.att.bp[j]);
      const bestBP=bestOf(a,'bp');
      h+='<td style="padding:4px 2px;text-align:center;font-weight:700;font-family:Oswald;color:#d4a843;font-size:12px;background:rgba(212,168,67,.08)">'+(bestBP||'—')+'</td>';
    } else {
      ['sq','bp','dl'].forEach(l=>{
        for(let j=0;j<maxAtts[l];j++)h+=_attTd(a.att[l][j]);
        const sub=l==='sq'?bestOf(a,'sq'):l==='bp'?bestOf(a,'sq')+bestOf(a,'bp'):bestOf(a,'sq')+bestOf(a,'bp')+bestOf(a,'dl');
        h+='<td style="padding:4px 2px;text-align:center;font-weight:700;font-family:Oswald;color:#d4a843;font-size:12px;background:rgba(212,168,67,.08)">'+(sub||'—')+'</td>';
      });
    }
    if(dq){
      h+='<td class="os" style="padding:6px 4px;text-align:center;font-weight:700;font-size:13px;color:var(--red);background:rgba(239,68,68,.12)">DQ</td>';
      h+='<td class="os" style="padding:6px 4px;text-align:center;font-weight:700;font-size:13px;color:var(--red);background:rgba(239,68,68,.12)">DQ</td>';
      h+='<td class="os" style="padding:6px 4px;text-align:center;font-weight:700;font-size:13px;color:var(--red);background:rgba(239,68,68,.06)">DQ</td></tr>';
    } else {
      // El virtual solo se destaca mientras le quede algo por levantar: si ya está
      // todo juzgado es el mismo número que el total y no tiene nada que aportar.
      const vDist=a.proy>0&&a.proy!==a.total;
      h+='<td class="os" title="'+(vDist?'Si levanta lo que tiene declarado':'Ya no le queda nada por levantar')+'" style="padding:6px 4px;text-align:center;font-weight:700;font-size:14px;color:'+(vDist?'#f59e0b':'rgba(120,143,166,.6)')+';background:'+(vDist?'rgba(245,158,11,.08)':'transparent')+'">'+(a.proy||'—')+'</td>';
      h+='<td class="os" style="padding:6px 4px;text-align:center;font-weight:700;font-size:14px">'+(a.total||'—')+'</td><td class="os" style="padding:6px 4px;text-align:center;font-weight:700;font-size:14px;color:var(--gold)">'+(a.gl||'—')+'</td></tr>';
    }
  });
  h+='</tbody></table></div></div>';
  return h;
}

function _resModTest(k){
  return k==='classic'?isMeetClassic:k==='equipped'?isMeetEquipped
        :k==='bench'?inBenchRanking:isOEClassic;
}

function renderResults(){
  // Todas las tandas, no solo la que está en tarima. Una categoría se reparte entre
  // varias tandas, así que filtrando por la tanda nunca se veía cómo va la categoría
  // completa — que es justamente lo que se viene a mirar acá.
  const flightAth=_conUni(DATA.athletes.filter(a=>!a.__is4));
  // Filtros de la vista. Género, categoría y división son justo las tres cosas por
  // las que ya se agrupa la tabla, así que filtrar saca GRUPOS ENTEROS: la posición
  // de los que quedan no se mueve ni un lugar. La modalidad elige qué tabla se
  // dibuja, que es como se ve en pantalla.
  const F=window._RES_F||(window._RES_F={sex:'',cat:'',div:'',mod:''});
  const visibles=flightAth.filter(a=>
    (!F.sex||_normSex(a.sex)===F.sex)
    &&(!F.cat||_normCat(a.cat||'?')===F.cat)
    &&(!F.div||_normDiv(a.div||'Sin Div')===F.div));
  const _modOn=k=>!F.mod||F.mod===k;
  const classicAthletes=_modOn('classic')?visibles.filter(a=>isMeetClassic(a)):[];
  const equippedAthletes=_modOn('equipped')?visibles.filter(a=>isMeetEquipped(a)):[];
  const benchAthletes=_modOn('bench')?visibles.filter(a=>inBenchRanking(a)):[];
  const oeClassicAthletes=_modOn('oe')?visibles.filter(a=>isOEClassic(a)):[];

  // Top 3 GL por división combinando todas las modalidades
  const allEntries=[
    ...classicAthletes.map(a=>({a,view:'meet'})),
    ...equippedAthletes.map(a=>({a,view:'meet'})),
    ...benchAthletes.map(a=>({a,view:'bench'}))
  ];
  // SEPARADO POR SEXO, no solo por división. Los puntos GL se calculan con
  // coeficientes distintos para damas y caballeros —esa es toda la gracia de la
  // fórmula: comparar dentro de un sexo, no entre los dos—, así que poner un
  // número contra el otro no dice nada. Agrupando solo por división, el Top 3
  // del Open mezclaba a unas y otros y mostraba un podio que no existe. El mejor
  // levantador se premia igual que acá: uno por sexo.
  // …y POR MODALIDAD. Classic, Equipado y Only Bench son rankings distintos: un
  // equipado levanta más por el traje, y la banca sola no se compara contra un
  // total de tres movimientos. Mezclados en una sola lista el podio no
  // significaba nada. Universitario y Olimpiadas Especiales ya quedaban aparte
  // porque son divisiones, no modalidades.
  //
  // La modalidad sale de la LÍNEA (Classic / Equipado) más si la entrada es de
  // banca sola. Se mira `view` y no la modalidad del atleta a propósito: el que
  // compite en powerlifting Y en Only Bench entra dos veces —una por cada
  // ranking, que es lo correcto— y así cada una cae en su tarjeta en vez de
  // ocuparle dos lugares al mismo podio.
  const divGroups={}, divLbl={};
  allEntries.forEach(e=>{
    const t=totalOf(e.a,e.view);if(t<=0)return;
    const linea=_nomLineMod(e.a)[0];               // CLASSIC | EQUIPADO
    const soloBanca=e.view==='bench';
    const k=_normSex(e.a.sex)+'|'+(e.a.div||'Sin División')+'|'+linea+'|'+(soloBanca?'BP':'PL');
    if(!divGroups[k]){divGroups[k]=[];divLbl[k]=linea+(soloBanca?' · ONLY BENCH':'');}
    divGroups[k].push({...e.a,total:t,gl:calcGL(t,e.a.bw,e.a.sex,_glMod(e.a),e.view),_view:e.view});
  });
  Object.values(divGroups).forEach(arr=>arr.sort((a,b)=>b.gl-a.gl));

  // Los botones admin (Exportar, Cerrar, PDF) solo se muestran si está logueado como admin
  let adminButtons = '';
  if(isAdmin){
    adminButtons = '<button class="btn btn-g" onclick="exportJSON()">Exportar</button>'
      // Cerrar la competencia publica los resultados en los perfiles y en el ranking:
      // es del que dirige, no de quien transmite.
      +(window._esStreaming()?'':'<button class="btn" onclick="cerrarCompetenciaConfirm()" style="background:rgba(168,85,247,.15);border:1px solid #a855f7;color:#a855f7;font-weight:700" title="Publica todos los resultados a Firestore — visibles inmediatamente en perfiles + ranking">Cerrar competencia</button>')
      +'<button id="btnActaPDF" class="btn btn-r" onclick="generateActaPDF()" style="background:rgba(196,30,58,.15);border-color:var(--accent)">Generar Acta PDF</button>'
      // Acta en el formato que publica FESUPO: fondo blanco y los récords en amarillo.
      +'<button id="btnActaFesupo" class="btn" onclick="exportActaFesupoPDF()" style="background:#fff;border:1px solid #999;color:#111;font-weight:700" title="PDF de fondo blanco, agrupado por modalidad y categoría, con los récords sudamericanos resaltados en amarillo">Acta FESUPO (PDF)</button>'
      +'<button id="btnActaXls" class="btn" onclick="exportActaFesupoXLS()" style="background:rgba(34,197,94,.12);border:1px solid var(--green);color:var(--green);font-weight:700" title="La misma acta en Excel, con los récords marcados">Excel</button>'
      // Quiénes suben al podio en cada categoría, contando los cuatro premios:
      // total, sentadilla, banca y peso muerto.
      +'<button id="btnMedallas" class="btn" onclick="mostrarMedallas()" style="background:rgba(212,168,67,.15);border:1px solid var(--gold);color:var(--gold);font-weight:700" title="Podios de todas las categorías (total, sentadilla, banca y peso muerto), cuántas medallas hay que entregar y el medallero por país o club">Medallas</button>'
      // Ranking por GL de cada división y modalidad, y la clasificación por
      // equipos con los puntos del reglamento IPF: por club en un campeonato
      // nacional, por país en uno internacional.
      +(()=>{ let pp=false; try{ pp=_ovPorPais(); }catch(e){}
        return '<button id="btnOverall" class="btn" onclick="mostrarOverall()" style="background:rgba(96,165,250,.12);border:1px solid #60a5fa;color:#60a5fa;font-weight:700" title="Overall por GL Points de cada división y modalidad, y la clasificación por '+(pp?'países':'clubes')+' según el reglamento IPF">Overall y '+(pp?'países':'clubes')+'</button>'; })()
      // Qué récords nacionales rompieron los chilenos, para revisar y guardar.
      +(window._esStreaming()?'':'<button class="btn" onclick="mostrarRecordsNac()" style="background:rgba(242,194,48,.12);border:1px solid #F2C230;color:#F2C230;font-weight:700" title="Marcas de atletas chilenos que superan la tabla de récords nacionales: revisar y guardar">Récords nacionales</button>');
      // Lista de récords batidos en el campeonato (sudamericanos y/o nacionales), para descargar.
      adminButtons+='<button class="btn" onclick="mostrarRecordsBatidos()" style="background:#fff;border:1px solid #999;color:#111;font-weight:700" title="Lista de récords batidos en este campeonato, en Excel y PDF">Récords batidos</button>';
  }
  // ── Actas por día ─────────────────────────────────────────────────────────
  // En un campeonato de dos días la premiación es al final de cada uno, así que
  // el acta tiene que salir con los atletas de ESE día. Los días los pone el
  // Cronograma; si el campeonato es de un día, este selector no aparece.
  const _diasActa=isAdmin?_diasDelEvento():[];
  let avisoDia='';
  if(_diasActa.length>1){
    const _dSel=window._ACTA_DIA||'';
    const _nDia=d=>DATA.athletes.filter(a=>!a.__is4&&_diaDeAtleta(a)===d).length;
    adminButtons='<select onchange="setActaDia(this.value)" title="Con qué atletas se generan las actas de abajo" '
      +'style="padding:7px 10px;border-radius:8px;border:1px solid '+(_dSel?'var(--gold)':'var(--border)')+';background:'+(_dSel?'rgba(212,168,67,.12)':'transparent')+';color:'+(_dSel?'var(--gold)':'var(--text)')+';font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:.5px;cursor:pointer">'
      +'<option value=""'+(_dSel?'':' selected')+'>Acta: todo el campeonato ('+DATA.athletes.filter(a=>!a.__is4).length+')</option>'
      +_diasActa.map(d=>'<option value="'+esc(d)+'"'+(_dSel===d?' selected':'')+'>Acta: solo '+esc(d)+' ('+_nDia(d)+')</option>').join('')
      +'</select>'+adminButtons;
    if(_dSel){
      // Si una categoría se reparte entre los dos días, el podio del acta de hoy
      // sale a medias. Mejor avisarlo antes de premiar que descubrirlo después.
      const partidas=_catsPartidas();
      avisoDia='<div style="margin-bottom:14px;padding:10px 14px;border-radius:8px;border:1px solid '
        +(partidas.length?'rgba(245,158,11,.5);background:rgba(245,158,11,.08);color:#f59e0b':'rgba(212,168,67,.45);background:rgba(212,168,67,.07);color:var(--gold)')
        +';font-size:12px;line-height:1.5">'
        +(partidas.length
          ?'<b>Ojo:</b> las actas van a salir solo con <b>'+esc(_dSel)+'</b>, pero '+partidas.length+' categoría'+(partidas.length>1?'s se reparten':' se reparte')
            +' entre los dos días, así que ese podio queda incompleto: '+esc(partidas.slice(0,6).join(' · '))+(partidas.length>6?' …':'')
          :'Las actas se van a generar solo con los atletas de <b>'+esc(_dSel)+'</b>. Ninguna categoría queda partida entre días.')
        +'</div>';
    }
  }
  let h='<div class="fade"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px"><div><h2 class="os" style="font-size:24px;letter-spacing:2px">RESULTADOS</h2><p style="color:var(--muted);font-size:12px">'+((DATA.event==null?void 0:DATA.event.name)||'')+' · '+flightAth.length+' atletas · todas las tandas</p></div>'+adminButtons+'</div>'+avisoDia;

  // ── Barra de filtros ──────────────────────────────────────────────────────
  // Las opciones se arman con lo que hay EN ESTE campeonato, así que no aparecen
  // categorías ni divisiones vacías. La lista se saca de la nómina completa, no de
  // lo ya filtrado: si no, al elegir una opción se borrarían las demás.
  {
    const SS='padding:6px 9px;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:Oswald;font-size:11px;letter-spacing:.5px;cursor:pointer';
    const SSon=SS+';border-color:var(--gold);color:var(--gold);background:rgba(212,168,67,.12)';
    const uniq=(f)=>[...new Set(flightAth.map(f).filter(Boolean))];
    const sexos=uniq(a=>_normSex(a.sex)).sort();
    const cats=uniq(a=>_normCat(a.cat||'')).sort((x,y)=>_actaCatN(x)-_actaCatN(y));
    const divs=uniq(a=>_normDiv(a.div||'')).sort((x,y)=>_DIV_ORDER(x)-_DIV_ORDER(y));
    const mods=_RES_MODS.filter(([k])=>flightAth.some(a=>_resModTest(k)(a)));
    const sel=(campo,todos,lista)=>{
      const v=F[campo]||'';
      return '<select onchange="setResF(\''+campo+'\',this.value)" style="'+(v?SSon:SS)+'">'
        +'<option value="">'+todos+'</option>'
        +lista.map(([val,lbl])=>'<option value="'+esc(val)+'"'+(v===val?' selected':'')+'>'+esc(lbl)+'</option>').join('')
        +'</select>';
    };
    const activo=!!(F.sex||F.cat||F.div||F.mod);
    let fh='<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px">'
      +'<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px">FILTRAR</span>';
    if(sexos.length>1)fh+=sel('sex','Todos los géneros',sexos.map(x=>[x,x==='F'?'Damas':x==='M'?'Caballeros':x]));
    if(cats.length>1) fh+=sel('cat','Todas las categorías',cats.map(x=>[x,x+' kg']));
    if(divs.length>1) fh+=sel('div','Todas las divisiones',divs.map(x=>[x,x]));
    if(mods.length>1) fh+=sel('mod','Todas las modalidades',mods);
    if(activo)fh+='<button onclick="limpiarResF()" style="padding:6px 11px;border-radius:7px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-family:Oswald;font-size:11px;letter-spacing:.5px;cursor:pointer">Limpiar</button>';
    fh+='<span style="margin-left:auto;font-size:11px;color:'+(activo?'var(--gold)':'var(--muted)')+'">'
      +(activo?visibles.length+' de '+flightAth.length+' atletas':flightAth.length+' atletas')+'</span>'
      +'</div>';
    // Con una sola categoría y una sola división no hay nada que filtrar.
    if(sexos.length>1||cats.length>1||divs.length>1||mods.length>1)h+=fh;
  }

  // Stats
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">';
  [
    [visibles.length,'Total atletas','var(--blue)'],
    [classicAthletes.length,'Classic','var(--green)'],
    [equippedAthletes.length,'Equipado','var(--orange)'],
    [benchAthletes.length,'Only Bench','var(--gold)']
  ].forEach(([v,l,c])=>{h+='<div class="card" style="text-align:center;padding:12px"><div class="os" style="font-size:24px;font-weight:700;color:'+c+'">'+v+'</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-top:3px">'+l+'</div></div>'});
  h+='</div>';

  // Top 3 GL by Division
  // Damas primero y las divisiones en su orden de competencia (Sub-Junior,
  // Junior, Open, Master I…), no por orden alfabético, que las dejaba en
  // Junior · Master · Open · Sub-Junior.
  const divKeys=Object.keys(divGroups).sort((x,y)=>{
    const [sx,dx,lx,bx]=x.split('|'), [sy,dy,ly,by]=y.split('|');
    if(sx!==sy)return sx==='F'?-1:sy==='F'?1:sx.localeCompare(sy);
    if(lx!==ly)return lx==='CLASSIC'?-1:ly==='CLASSIC'?1:lx.localeCompare(ly);
    if(bx!==by)return bx==='PL'?-1:1;               // el powerlifting antes que la banca sola
    return (_DIV_ORDER(dx)-_DIV_ORDER(dy))||dx.localeCompare(dy);
  });
  if(divKeys.length>0){
    // Plegable y cerrado por defecto, como el panel de día y tanda: empujaba las
    // tablas de resultados muy abajo. Si alguien lo abre, queda abierto en ese equipo.
    if(window._TOP3GL_OPEN===undefined){
      let g=null; try{g=localStorage.getItem('yl_top3gl');}catch(e){}
      window._TOP3GL_OPEN=(g==='1');
    }
    const _t3=!!window._TOP3GL_OPEN;
    h+='<div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">'
      +'<button onclick="window._TOP3GL_OPEN=!window._TOP3GL_OPEN;try{localStorage.setItem(\'yl_top3gl\',window._TOP3GL_OPEN?\'1\':\'0\')}catch(e){};R()" '
      +'style="width:100%;display:flex;align-items:center;gap:9px;padding:11px 14px;border:none;background:transparent;cursor:pointer;text-align:left">'
      +'<span class="os" style="font-size:14px;letter-spacing:1px;color:var(--gold);font-weight:700">TOP 3 GL POINTS POR MODALIDAD, DIVISIÓN Y SEXO</span>'
      +'<span style="flex:1"></span><span style="font-size:13px;color:var(--gold)">'+(_t3?'▾':'▸')+'</span></button>';
    if(_t3){
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:0 14px 14px">';
    divKeys.forEach(d=>{
      const top3=divGroups[d].slice(0,3);
      const _sx=d.split('|')[0], _dv=d.split('|')[1];
      const _sxL=_sx==='F'?'DAMAS':_sx==='M'?'CABALLEROS':_sx;
      h+='<div style="background:var(--bg);border-radius:8px;padding:12px;border:1px solid var(--border)">'
        +'<div class="os" style="font-size:13px;letter-spacing:1px;color:var(--accent);margin-bottom:8px">'+_dv
        +' <span style="color:var(--muted);font-size:11px">· '+_sxL+'</span>'
        +'<div style="font-size:10px;letter-spacing:.8px;color:var(--muted);margin-top:2px">'+divLbl[d]+'</div></div>';
      const medals=['1°','2°','3°'];
      top3.forEach((a,i)=>{
        // El cartelito BENCH por fila ya no hace falta: la tarjeta entera es de
        // banca sola y lo dice en el título.
        const tag='';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;'+(i<2?'border-bottom:1px solid rgba(29,49,80,.2)':'')+'"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:14px">'+medals[i]+'</span><div><span style="font-weight:600;font-size:12px">'+a.name+'</span>'+tag+'<span style="font-size:9px;color:var(--muted);margin-left:4px">'+_normCat(a.cat)+' kg</span></div></div><div style="text-align:right"><span class="os" style="font-size:15px;font-weight:700;color:var(--gold)">'+a.gl+'</span><span style="font-size:9px;color:var(--muted);margin-left:4px">'+a.total+'kg</span></div></div>';
      });
      h+='</div>';
    });
    h+='</div>';
    }
    h+='</div>';
  }

  h+='<div style="font-size:11px;color:var(--muted);margin-bottom:12px;line-height:1.5">'
    +'<b style="color:#f59e0b">Virtual</b>: suma los intentos que tiene puestos como si fueran válidos, junto con lo que ya validó. '
    +'<b style="color:var(--text)">Total</b>: solo lo válido. '
    +'La posición sale del virtual — mientras la categoría siga compitiendo va marcada con <b style="color:#f59e0b">~</b>, '
    +'y cuando se juzgan los nueve intentos de todos pasa a ser la <b style="color:var(--green)">posición final</b>.</div>';

  // 3 tablas separadas por modalidad
  h+=_renderResultsTable({title:'POWERLIFTING CLASSIC',icon:'',color:'#22c55e',athletes:classicAthletes,view:'meet'});
  h+=_renderResultsTable({title:'POWERLIFTING EQUIPADO',icon:'',color:'#f59e0b',athletes:equippedAthletes,view:'meet'});
  h+=_renderResultsTable({title:'ONLY BENCH',icon:'',color:'#D4A843',athletes:benchAthletes,view:'bench'});
  h+=_renderResultsTable({title:'POWERLIFTING — OLIMPIADAS ESPECIALES (OE)',icon:'',color:'#a855f7',athletes:oeClassicAthletes,view:'meet'});
  // Un filtro puede dejar la pantalla sin ninguna tabla (ej. "Equipado" en un
  // campeonato donde nadie compite equipado). Se dice, en vez de dejar el vacío.
  if(!classicAthletes.length&&!equippedAthletes.length&&!benchAthletes.length&&!oeClassicAthletes.length){
    h+='<div class="card" style="padding:28px;text-align:center">'
      +'<div class="os" style="font-size:14px;letter-spacing:1px;color:var(--gold);margin-bottom:6px">NO HAY ATLETAS CON ESOS FILTROS</div>'
      +'<div style="color:var(--muted);font-size:13px;margin-bottom:14px">Prueba con otra combinación.</div>'
      +'<button onclick="limpiarResF()" style="padding:8px 16px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-family:Oswald;font-size:12px;letter-spacing:.5px;cursor:pointer">Limpiar filtros</button>'
    +'</div>';
  }

  h+='</div>';
  return h;
}

function subTotal(a,lift){
  const s=bestOf(a,'sq');
  if(lift==='sq')return s;
  const b=bestOf(a,'bp');
  if(lift==='bp')return s+b;
  return s+b+bestOf(a,'dl');
}

// Posición ACTUAL y posición si el intento en curso es válido (forecast), dentro
// del mismo sexo + categoría + división + modalidad. Es el mismo criterio que usa
// el widget de OBS, para que Control en Vivo, espectador y transmisión coincidan.
function _posForecast(a,lift,round){
  if(!a)return null;
  const ra=(typeof _realAth==='function')?_realAth(a):a;
  if(_esInvitado(ra))return null;   // fuera de competencia: no ocupa lugar
  const l=lift||DATA.lift;
  const at=(ra.att&&ra.att[l])?ra.att[l][(typeof curAtt==='function')?curAtt(a):round||0]:null;
  const w=(at&&at.w)||0;
  const peers=DATA.athletes.filter(x=>x.cat===ra.cat&&x.div===ra.div&&x.sex===ra.sex&&x.mod===ra.mod&&!x.bombed);
  const sub=x=>subTotal(x,l);
  // actual
  const cur=peers.map(x=>({id:x.id,s:sub(x)})).filter(x=>x.s>0).sort((p,q)=>q.s-p.s);
  const posNow=cur.findIndex(x=>x.id===ra.id)+1;
  // simulado: si este intento sale válido
  let posIf=0;
  if(w>0){
    const best=Math.max(bestOf(ra,l),w);
    const sim=peers.map(x=>{
      if(x.id===ra.id){
        const o=(l==='sq')?best:(l==='bp')?bestOf(ra,'sq')+best:bestOf(ra,'sq')+bestOf(ra,'bp')+best;
        return{id:x.id,s:o};
      }
      return{id:x.id,s:sub(x)};
    }).filter(x=>x.s>0).sort((p,q)=>q.s-p.s);
    posIf=sim.findIndex(x=>x.id===ra.id)+1;
  }
  return {now:posNow||0, ifOk:posIf||0, of:cur.length};
}

// Celda compacta "actual → si es válido" para las tablas.
function _posCellHtml(a,opts){
  opts=opts||{};
  const f=_posForecast(a);
  if(!f)return '<td></td>';
  const fs=opts.fs||11;
  const col=p=>p===1?'var(--gold)':p<=3?'#60a5fa':'var(--muted)';
  if(!f.now&&!f.ifOk)return '<td style="text-align:center;padding:4px 3px;color:var(--border);font-size:'+fs+'px">—</td>';
  let h='<td style="text-align:center;padding:4px 3px;white-space:nowrap;font-family:Oswald;font-size:'+fs+'px">';
  h+='<span title="Posición actual" style="font-weight:700;color:'+col(f.now)+'">'+(f.now?f.now+'°':'—')+'</span>';
  if(f.ifOk&&f.ifOk!==f.now)h+='<span style="color:var(--muted);margin:0 2px">→</span><span title="Posición si el intento es válido" style="font-weight:800;color:'+col(f.ifOk)+'">'+f.ifOk+'°</span>';
  h+='</td>';
  return h;
}

// ── EL VIRTUAL, EN LA VISTA DEL PÚBLICO ────────────────────────────────────
// El puesto que tiene cada uno con lo que lleva levantado MÁS lo que tiene
// declarado y todavía no levanta. Es el número que el entrenador necesita entre
// intento e intento: si pide 180, ¿en qué lugar queda?
//
// Ya existía, pero en dos lugares donde no se alcanzaba a mirar durante la
// competencia: en Resultados —a dos toques de distancia— y en la última columna
// de esta misma tabla, que en un teléfono queda fuera de pantalla y hay que
// arrastrar pasando los nueve intentos para llegar a ella. Acá se pone al lado
// del nombre, que es lo único que siempre se ve sin arrastrar nada.
//
// LA CUENTA NO SE REESCRIBE: sale de _proyTotal y se ordena con el mismo criterio
// que _renderResultsTable —proyectado, después total, y a igual marca el más
// liviano, como manda la IPF—. Tener dos versiones de la misma regla es como la
// tabla y el acta terminan diciendo cosas distintas.
//
// Sin memoria intermedia a propósito: son cuatro cuentas por atleta y esta tabla
// se redibuja con cada peso que se carga. Guardar el resultado obligaría a
// acertar cuándo invalidarlo, y equivocarse ahí significa mostrarle al
// entrenador un puesto viejo, que es peor que no mostrarle ninguno.
function _virtualPuestos(){
  const grupos={};
  DATA.athletes.forEach(a=>{
    if(a.__is4||a.bombed||_esInvitado(a))return;
    // El que hace banca sola se mide contra su banca; el resto, contra el total.
    const view=a.mod==='onlybench'?'bench':'meet';
    const k=_catGroupKey(a);
    (grupos[k]||(grupos[k]=[])).push({
      id:a.id, proy:_proyTotal(a,view), total:totalOf(a,view),
      bw:a.bw||999, dq:view==='meet'&&isDQ(a),
    });
  });
  const out={};
  Object.values(grupos).forEach(arr=>{
    arr.sort((x,y)=>(x.dq===y.dq?0:(x.dq?1:-1))||(y.proy-x.proy)||(y.total-x.total)||(x.bw-y.bw));
    let p=0, previo=null;
    const delGrupo=[];
    arr.forEach(x=>{
      if(!(x.proy>0)||x.dq)return;
      p++;
      // Cuánto le falta para alcanzar al de arriba: el número que el entrenador
      // saca a mano entre intento e intento. Solo si es mayor que cero —
      // empatados en proyectado el puesto lo decide el peso corporal, y decir
      // "te falta 0" confundiría más de lo que ayuda.
      const falta=previo?(previo.proy-x.proy):0;
      out[x.id]={pos:p, proy:x.proy, faltan:falta>0?falta:0};
      delGrupo.push(x.id);
      previo=x;
    });
    delGrupo.forEach(id=>{ out[id].of=p; });
  });
  return out;
}

// La línea que se dibuja al lado del nombre.
function _virtualHtml(v,linea){
  if(!v)return '';
  const col=v.pos===1?'var(--gold)':v.pos<=3?'#60a5fa':'rgba(255,255,255,.75)';
  // El peso proyectado sin decimales de relleno: 512.5 queda 512.5, 510 queda 510.
  const kg=Math.round(v.proy*10)/10;
  // Todo en UNA línea que no se parte. En un teléfono la columna del atleta mide
  // unos 300 px: con el recuadro flexible, "de 8" y "+3.5 al 1°" se cortaban por
  // la mitad y quedaban tres renglones de pedazos sueltos.
  const deN=(v.of&&v.of>1)?'<span style="color:rgba(255,255,255,.5)">/'+v.of+'</span>':'';
  let h='<span style="'+(linea?'flex-shrink:0;':'margin-top:3px;')+'font-family:Oswald;font-size:9.5px;letter-spacing:.4px;'
    +'display:inline-block;white-space:nowrap;padding:2px 7px;border-radius:5px;'
    +'background:rgba(212,168,67,.10);border:1px solid rgba(212,168,67,.35)">'
    +'<span style="color:rgba(212,168,67,.85)">VIRTUAL</span>&nbsp;'
    +'<b style="color:'+col+';font-size:11.5px">'+v.pos+'°</b>'+deN
    +'<span style="color:rgba(255,255,255,.3)">&nbsp;·&nbsp;</span>'
    +'<span style="color:rgba(255,255,255,.8)">'+kg+'</span>';
  if(v.faltan)h+='<span style="color:rgba(255,255,255,.3)">&nbsp;·&nbsp;</span>'
    +'<span style="color:#60a5fa" title="Lo que le falta al total proyectado para alcanzar al de arriba">+'
    +(Math.round(v.faltan*10)/10)+'&nbsp;al&nbsp;'+(v.pos-1)+'°</span>';
  return h+'</span>';
}

// ── Con quién compite en el marcador ─────────────────────────────────
// El Only Bench puro compite en banca contra los otros Only Bench (y contra los
// PL+BP, que también están en esa competencia) por su mejor banca. Antes entraba
// a la tabla del powerlifting con el subtotal —cero de sentadilla más su banca—
// y el marcador lo ponía último entre los classic. Tampoco se mezclan classic y
// equipado: son competencias distintas.
function _sbSoloBanca(a){
  const m=String(a&&a.mod||'');
  return (m==='onlybench'||m==='oe_bench'||m==='equipped_bench')&&!_isPlusBench(a);
}

function _sbEquipo(a){ const m=String(a&&a.mod||''); return (m==='equipped'||m==='equipped_bench')?'eq':'cl'; }

function _sbPool(ath){
  const solo=_sbSoloBanca(ath), eq=_sbEquipo(ath);
  const peers=DATA.athletes.filter(a=>a.cat===ath.cat&&a.div===ath.div&&a.sex===ath.sex&&a.flight===DATA.flight
    &&!a.bombed&&!_esInvitado(a)&&_sbEquipo(a)===eq
    &&(solo?(_sbSoloBanca(a)||_isPlusBench(a)):!_sbSoloBanca(a)));
  const val=solo?(a=>DATA.lift==='sq'?0:bestOf(a,'bp')):(a=>subTotal(a,DATA.lift));
  return {peers:peers,val:val,solo:solo};
}

// La modalidad en que compite, para las pantallas de tarima: CLASSIC, EQUIPADO,
// ONLY BENCH o la mezcla (CLASSIC + ONLY BENCH, CLASSIC + UNIVERSITARIO…). Si la
// misma persona está inscrita dos veces, una en classic y otra en equipado, se
// dicen las dos: CLASSIC + EQUIPADO.
function _modTarima(a){
  const r=(typeof _realAth==='function')?_realAth(a):a;
  const m=String(r&&r.mod||'');
  if(m==='invitado')return 'INVITADO';
  if(m.indexOf('oe_')===0)return 'OLIMPIADAS ESPECIALES';
  const eq=_sbEquipo(r)==='eq'?'EQUIPADO':'CLASSIC';
  if(_sbSoloBanca(r))return eq==='EQUIPADO'?'ONLY BENCH EQUIPADO':'ONLY BENCH';
  const nn=_nnCrono(r.name);
  const otro=(DATA.athletes||[]).some(x=>x&&x.id!==r.id&&!x.__is4&&_nnCrono(x.name)===nn
    &&String(x.mod||'')!=='invitado'&&_sbEquipo(x)!==_sbEquipo(r));
  const partes=otro?['CLASSIC','EQUIPADO']:[eq];     // siempre en el mismo orden
  if(_isPlusBench(r))partes.push('ONLY BENCH');
  if(typeof _isPlusUni==='function'&&_isPlusUni(r))partes.push('UNIVERSITARIO');
  return partes.join(' + ');
}

function catRankBySub(athlete){
  // Ranking dentro del mismo sexo + categoría + división (no mezcla divisiones de
  // edad) y de la misma competencia: powerlifting o Only Bench, classic o equipado.
  if(_esInvitado(athlete))return{pos:0,of:0};
  const pool=_sbPool(athlete);
  const withSub=pool.peers.map(a=>({id:a.id,sub:pool.val(a)})).filter(x=>x.sub>0).sort((a,b)=>b.sub-a.sub);
  const idx=withSub.findIndex(x=>x.id===athlete.id);
  return{pos:idx>=0?idx+1:0,of:withSub.length};
}

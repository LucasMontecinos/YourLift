// admin.html — Ranking: puntos GL, el ranking sin repetir atleta, el corte para el Nacional y el reinicio del ciclo.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

function _glRows(){ return applyStatsFilters(buildStatsRows()).filter(r=>r.glp>0); }

function _glProm(arr){ return arr.length ? arr.reduce((s,r)=>s+r.glp,0)/arr.length : 0; }

// El cuartil por interpolación lineal, que es el mismo criterio que usan Excel
// (QUARTILE.INC) y las planillas: así los números de acá calzan con los de
// cualquiera que los rehaga por su cuenta.
function _glCuartil(ordenados,q){
  const n=ordenados.length;
  if(!n)return 0;
  if(n===1)return ordenados[0];
  const pos=(n-1)*q, base=Math.floor(pos), resto=pos-base;
  return ordenados[base+1]!==undefined
    ? ordenados[base]+resto*(ordenados[base+1]-ordenados[base])
    : ordenados[base];
}

// Todo lo que hace falta para describir un grupo, de una sola pasada.
//
// El promedio solo no alcanza: dos divisiones pueden promediar 76 y ser cosas
// distintas, una con todos apretados ahí y otra con la mitad en 60 y la otra
// mitad en 92. La desviación y el rango intercuartil son los que dicen eso.
//
// El mínimo y el máximo se dan dos veces: el del grupo entero, y el del grupo
// sin las marcas que se salen de la norma —las que quedan más allá de una vez y
// media el rango intercuartil, el criterio de Tukey—. Las dos cifras importan:
// una dice hasta dónde llegó alguien, la otra hasta dónde llega el grupo. Las
// que se salen se cuentan aparte y no se descartan: son marcas reales, y casi
// siempre son las de los mejores.
function _glResumen(arr){
  const v=arr.map(r=>r.glp).sort((a,b)=>a-b), n=v.length;
  if(!n)return null;
  const prom=v.reduce((s,x)=>s+x,0)/n;
  // Desviación muestral (n-1): estos son una muestra de los que compiten, no
  // todos los que existen. Con un solo dato no hay dispersión que medir.
  const desv=n>1?Math.sqrt(v.reduce((s,x)=>s+(x-prom)*(x-prom),0)/(n-1)):0;
  const q1=_glCuartil(v,.25), med=_glCuartil(v,.5), q3=_glCuartil(v,.75);
  const ric=q3-q1;
  const tope=q3+1.5*ric, piso=q1-1.5*ric;
  const dentro=v.filter(x=>x>=piso&&x<=tope);
  return {n,prom,desv,q1,med,q3,ric,
    min:dentro.length?dentro[0]:v[0],
    max:dentro.length?dentro[dentro.length-1]:v[n-1],
    real:{min:v[0],max:v[n-1]},
    fuera:v.filter(x=>x<piso||x>tope)};
}

function renderGL(){
  const rows=_glRows();
  const todas=applyStatsFilters(buildStatsRows());
  const sinGl=todas.length-rows.length;
  const ks='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;text-align:center';
  const card=(t,id,h='300px',sub='')=>`<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px">
    <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:${sub?'4':'14'}px">${t}</div>
    ${sub?`<div style="font-size:10px;color:var(--muted);margin-bottom:12px;opacity:.8">${sub}</div>`:''}
    <div style="position:relative;height:${h}"><canvas id="${id}"></canvas></div></div>`;

  if(!rows.length){
    return `<div style="${ks};padding:40px">Ningún resultado con GL points en este filtro.
      ${sinGl?`<div style="font-size:12px;color:var(--muted);margin-top:8px">Hay ${sinGl.toLocaleString()} participaciones, pero ninguna trae GL cargado.</div>`:''}</div>`;
  }

  const mejor=rows.reduce((a,b)=>b.glp>a.glp?b:a);
  const R=_glResumen(rows);
  const kpi=(v,l,c,extra='')=>`<div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:${c}">${v}</div>
    <div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">${l}</div>${extra}</div>`;

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:20px">
    ${kpi(rows.length.toLocaleString(),'RESULTADOS CON GL','var(--gold)',
      sinGl?`<div style="color:var(--muted);font-size:9px;margin-top:2px">${sinGl.toLocaleString()} sin GL cargado, quedan fuera</div>`:'')}
    ${kpi(R.prom.toFixed(1),'GL PROMEDIO','#3b82f6')}
    ${kpi(R.med.toFixed(1),'GL MEDIANA','#a78bfa',
      '<div style="color:var(--muted);font-size:9px;margin-top:2px">la mitad está por encima</div>')}
    ${kpi('±'+R.desv.toFixed(1),'DESVIACIÓN ESTÁNDAR','#f59e0b',
      `<div style="color:var(--muted);font-size:9px;margin-top:2px">dos de cada tres, entre ${(R.prom-R.desv).toFixed(1)} y ${(R.prom+R.desv).toFixed(1)}</div>`)}
    ${kpi(R.ric.toFixed(1),'RANGO INTERCUARTIL','#06b6d4',
      `<div style="color:var(--muted);font-size:9px;margin-top:2px">la mitad del medio, de ${R.q1.toFixed(1)} a ${R.q3.toFixed(1)}</div>`)}
    ${kpi(mejor.glp.toFixed(1),'MEJOR GL','#22c55e',
      `<div style="color:var(--muted);font-size:9px;margin-top:2px">${esc(mejor.nombre||mejor.codigo||'')} · ${esc(mejor.year)}</div>`)}
  </div>

  <div id="glRankBox">${renderGLRanking()}</div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${card('GL PROMEDIO POR AÑO — HOMBRES vs MUJERES','glAnioSexo','300px',
      'Los kilos no se pueden comparar entre sexos; el GL sí. Acá se ve si la brecha se abre o se cierra.')}
    ${card('CÓMO SE REPARTEN LOS GL','glDist','300px',
      'Cuánta gente hay en cada tramo de 10 puntos, apilando hombres y mujeres.')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${card('GL PROMEDIO POR DIVISIÓN DE EDAD','glDiv','320px',
      'Sub-Junior, Junior, Open y los Master, cada uno con hombres y mujeres por separado.')}
    ${card('GL PROMEDIO POR MODALIDAD','glMod','320px',
      'Classic, Equipado y Only Bench. Ojo con los promedios de modalidades con pocos resultados: la tabla de más abajo dice cuántos hay detrás de cada uno.')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${card('LAS DIVISIONES, AÑO A AÑO','glDivAnio','320px',
      'Sirve para ver si una división está subiendo de nivel o si fue un año suelto.')}
    ${card('MODALIDAD POR DIVISIÓN','glModDiv','320px',
      'Cruce de las dos: en qué división se nota más la diferencia entre modalidades.')}
  </div>

  <div style="display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:24px">
    ${card('LOS 20 MEJORES GL DEL FILTRO','glTop','520px',
      'Cada atleta aparece una sola vez, con su mejor marca.')}
  </div>
  ${_glTablaHtml(rows)}
  ${_glDispersionHtml('LA DISPERSIÓN, POR DIVISIÓN DE EDAD',
    GL_ORDEN_DIV.filter(d=>rows.some(r=>r.div===d)).map(d=>({label:d,arr:rows.filter(r=>r.div===d)})))}
  ${_glDispersionHtml('LA DISPERSIÓN, POR MODALIDAD',
    [...new Set(rows.map(r=>r.mod))].sort().map(m=>({label:m,arr:rows.filter(r=>r.mod===m)})))}
  ${_glDispersionHtml('LA DISPERSIÓN, POR SEXO',
    [['M','Hombres'],['F','Mujeres']].filter(([s])=>rows.some(r=>r.sexo===s))
      .map(([s,l])=>({label:l,arr:rows.filter(r=>r.sexo===s)})))}`;
}

// La tabla con los números atrás de los gráficos: un gráfico se mira, pero para
// llevar un dato a una reunión hace falta el número escrito.
function _glTablaHtml(rows){
  const divs=GL_ORDEN_DIV.filter(d=>rows.some(r=>r.div===d));
  const cel='padding:7px 10px;border-bottom:1px solid var(--border);font-size:12px';
  const fila=(d)=>{
    const enDiv=rows.filter(r=>r.div===d);
    const m=enDiv.filter(r=>r.sexo==='M'), f=enDiv.filter(r=>r.sexo==='F');
    const dif=(m.length&&f.length)?(_glProm(m)-_glProm(f)):null;
    return `<tr>
      <td style="${cel};color:var(--text);font-family:Oswald;letter-spacing:1px">${esc(d)}</td>
      <td style="${cel};text-align:right">${enDiv.length}</td>
      <td style="${cel};text-align:right;color:#3b82f6">${m.length?_glProm(m).toFixed(1):'—'}<span style="color:var(--muted);font-size:10px"> (${m.length})</span></td>
      <td style="${cel};text-align:right;color:#ec4899">${f.length?_glProm(f).toFixed(1):'—'}<span style="color:var(--muted);font-size:10px"> (${f.length})</span></td>
      <td style="${cel};text-align:right;color:var(--muted)">${dif===null?'—':(dif>0?'+':'')+dif.toFixed(1)}</td>
      <td style="${cel};text-align:right;color:#22c55e">${enDiv.length?Math.max(...enDiv.map(r=>r.glp)).toFixed(1):'—'}</td>
    </tr>`;
  };
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:24px">
    <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:4px">LOS NÚMEROS, POR DIVISIÓN</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:12px;opacity:.8">Entre paréntesis, cuántos resultados hay detrás de cada promedio: con tres o cuatro, el promedio no dice mucho.</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${cel};text-align:left;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">DIVISIÓN</th>
        <th style="${cel};text-align:right;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">RESULTADOS</th>
        <th style="${cel};text-align:right;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">GL HOMBRES</th>
        <th style="${cel};text-align:right;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">GL MUJERES</th>
        <th style="${cel};text-align:right;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">DIFERENCIA</th>
        <th style="${cel};text-align:right;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">MEJOR</th>
      </tr></thead>
      <tbody>${divs.map(fila).join('')}</tbody>
    </table></div>
    ${(()=>{
      // Hay resultados sin el sexo cargado. Entran en la columna de resultados
      // pero no pueden entrar en las de hombres y mujeres, así que las tres no
      // suman igual. Mejor decirlo que dejar al que lee sacando la cuenta.
      const sinSexo=rows.filter(r=>r.sexo!=='M'&&r.sexo!=='F').length;
      return sinSexo?`<div style="font-size:10px;color:var(--muted);margin-top:10px;line-height:1.5">
        <b style="color:var(--text)">${sinSexo.toLocaleString()} resultados no tienen el sexo cargado.</b>
        Cuentan en la columna de resultados y en el GL general, pero quedan fuera de las columnas de hombres y mujeres
        y de todas las comparativas por sexo — por eso las dos columnas no suman el total.</div>`:'';
    })()}
  </div>`;
}

   // lo que se dibuja; el CSV se lleva todos

// El ranking tiene su PROPIO rango de años, y manda por sobre el de los filtros
// de arriba. Así se puede mirar una temporada acá sin mover el resto del panel:
// los gráficos siguen mostrando lo que estaban mostrando.
// El resto de los filtros —división, modalidad, sexo, club— sí se respetan.
function _glRowsRank(){
  const f=ST.statsFilters||{};
  const r=ST.glRankAnios||{};
  if(!r.desde&&!r.hasta)return _glRows();
  const antes={desde:f.yearFrom,hasta:f.yearTo};
  try{
    f.yearFrom=r.desde||''; f.yearTo=r.hasta||'';
    return _glRows();
  } finally {
    f.yearFrom=antes.desde; f.yearTo=antes.hasta;
  }
}

function _glRankingAtletas(){
  const mejor={};
  _glRowsRank().forEach(r=>{
    const quien=r.codigo||_hNom(r.nombre);
    if(!quien)return;
    if(!mejor[quien]||r.glp>mejor[quien].glp)mejor[quien]=r;
  });
  return Object.values(mejor).sort((a,b)=>b.glp-a.glp||(b.total||0)-(a.total||0));
}

function renderGLRanking(){
  const min=+(ST.glMin||0);
  const todos=_glRankingAtletas();
  const lista=todos.filter(r=>r.glp>=min);
  const f=ST.statsFilters||{};
  const ra=ST.glRankAnios||{};
  const anios=[...new Set(_glRowsRank().map(r=>r.year))].sort();
  const periodo=anios.length?(anios.length===1?anios[0]:anios[0]+'–'+anios[anios.length-1]):'—';
  // Todos los años que existen, no solo los del filtro actual: si no, al elegir
  // 2026 desaparecerían del selector los demás y no habría cómo volver.
  const todosAnios=[...new Set(buildStatsRows().map(r=>r.year))].filter(Boolean).sort();
  const sel='background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;font-family:DM Sans';
  const opt=(v,l,cur)=>`<option value="${v}" ${String(cur||'')===String(v)?'selected':''}>${l}</option>`;
  const cel='padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px';
  const th=(t,al='right')=>`<th style="${cel};text-align:${al};color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">${t}</th>`;
  const filtroTxt=[f.div?'división '+f.div:'',f.mod?'modalidad '+f.mod:'',
    f.sex?(f.sex==='F'?'mujeres':'hombres'):'',f.club?'club '+f.club:''].filter(Boolean).join(' · ');

  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:24px">
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:6px">
      <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:var(--gold)">RANKING SIN REPETIR ATLETA</div>
      <div style="display:flex;gap:8px;align-items:center;margin-left:auto;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--muted)">Años</span>
        <select style="${sel}" onchange="updGlRankAnio('desde',this.value)">
          ${opt('','Desde…',ra.desde)}${todosAnios.map(y=>opt(y,y,ra.desde)).join('')}
        </select>
        <select style="${sel}" onchange="updGlRankAnio('hasta',this.value)">
          ${opt('','Hasta…',ra.hasta)}${todosAnios.map(y=>opt(y,y,ra.hasta)).join('')}
        </select>
        ${(ra.desde||ra.hasta)?`<button onclick="updGlRankAnio('limpiar','')" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer">Todos los años</button>`:''}
        <span style="font-size:12px;color:var(--muted);margin-left:6px">GL mínimo</span>
        <input type="number" min="0" max="150" step="0.5" value="${min}" style="${sel};width:90px"
          oninput="updGlMin(this.value)" onchange="updGlMin(this.value)">
        ${min>0?`<button onclick="updGlMin(0)" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer">Ver todos</button>`:''}
        <button onclick="exportGlRankingCSV()" style="background:rgba(34,197,94,.15);border:1px solid var(--green);color:var(--green);padding:6px 12px;border-radius:6px;font-family:Oswald;font-size:11px;letter-spacing:1px;cursor:pointer;font-weight:700">CSV</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text);line-height:1.6;margin-bottom:12px">
      ${min>0
        ? `<b style="color:var(--gold);font-size:15px">${lista.length.toLocaleString()}</b> atleta${lista.length===1?'':'s'} con <b>${min}</b> GL o más`
        : `<b style="color:var(--gold);font-size:15px">${lista.length.toLocaleString()}</b> atleta${lista.length===1?'':'s'}`}
      en <b>${periodo}</b>${filtroTxt?' · '+esc(filtroTxt):''}.
      <span style="color:var(--muted)">Cada uno una sola vez, con su mejor marca del período${min>0?` — de ${todos.length.toLocaleString()} en total`:''}.</span>
    </div>
    ${!lista.length?`<div style="color:var(--muted);font-size:12px;padding:20px 0">Ninguno llega a ese mínimo con los filtros puestos.</div>`:`
    <div style="overflow-x:auto;max-height:520px;overflow-y:auto"><table style="width:100%;border-collapse:collapse">
      <thead style="position:sticky;top:0;background:var(--card)"><tr>
        ${th('#','left')}${th('ATLETA','left')}${th('CLUB','left')}${th('GL')}${th('TOTAL')}${th('CAT.')}${th('DIVISIÓN','left')}${th('MODALIDAD','left')}${th('AÑO')}
      </tr></thead>
      <tbody>${lista.slice(0,GL_RANK_TOPE).map((r,i)=>`<tr>
        <td style="${cel};color:var(--muted);font-family:Oswald">${i+1}</td>
        <td style="${cel};color:var(--text)">${esc(r.nombre||r.codigo||'—')}</td>
        <td style="${cel};color:var(--muted);font-size:11px">${esc(r.club||'—')}</td>
        <td style="${cel};text-align:right;color:var(--gold);font-family:Oswald;font-size:13px">${r.glp.toFixed(1)}</td>
        <td style="${cel};text-align:right">${r.total?r.total+' kg':'—'}</td>
        <td style="${cel};text-align:right">${esc(r.cat)}</td>
        <td style="${cel};color:var(--muted);font-size:11px">${esc(r.div)}</td>
        <td style="${cel};color:var(--muted);font-size:11px">${esc(r.mod)}</td>
        <td style="${cel};text-align:right;color:var(--muted)">${esc(r.year)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${lista.length>GL_RANK_TOPE?`<div style="font-size:11px;color:var(--muted);margin-top:10px">
      Se muestran los primeros ${GL_RANK_TOPE}. Los ${lista.length.toLocaleString()} van completos en el CSV.</div>`:''}`}
  </div>`;
}

window.updGlRankAnio=function(cual,val){
  ST.glRankAnios=ST.glRankAnios||{desde:'',hasta:''};
  if(cual==='limpiar'){ST.glRankAnios={desde:'',hasta:''};}
  else{
    ST.glRankAnios[cual]=val||'';
    // Si quedan al revés, se acomodan solos en vez de mostrar una lista vacía.
    const d=ST.glRankAnios.desde,h=ST.glRankAnios.hasta;
    if(d&&h&&d>h){ if(cual==='desde')ST.glRankAnios.hasta=d; else ST.glRankAnios.desde=h; }
  }
  const cont=document.getElementById('glRankBox');
  if(cont)cont.innerHTML=renderGLRanking();
};

window.updGlMin=function(v){
  ST.glMin=Math.max(0,parseFloat(v)||0);
  const cont=document.getElementById('glRankBox');
  if(cont)cont.innerHTML=renderGLRanking();
};

window.exportGlRankingCSV=function(){
  const min=+(ST.glMin||0);
  const lista=_glRankingAtletas().filter(r=>r.glp>=min);
  if(!lista.length){showToast('No hay atletas para exportar',null,true);return;}
  const q=s=>`"${String(s==null?'':s).replace(/"/g,'""')}"`;
  const filas=['posicion,nombre,codigo,club,gl_points,total_kg,categoria,division,modalidad,anio'];
  lista.forEach((r,i)=>filas.push([i+1,q(r.nombre),q(r.codigo),q(r.club),
    r.glp.toFixed(2),r.total||'',q(r.cat),q(r.div),q(r.mod),r.year].join(',')));
  const blob=new Blob([filas.join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='yourlift_ranking_gl_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Exportados '+lista.length+' atletas');
};

// ═══════════════════════════════════════════
// CORTE PARA EL NACIONAL
//
// La pregunta es: ¿qué mínimo de GL points hay que pedir para que queden unos
// diez por categoría? No tiene una sola respuesta —depende de cuántos se quieran
// y de cómo se agrupe— así que esto es un simulador: se mueve el objetivo y se
// ve al toque a cuántos deja dentro, categoría por categoría, antes de fijar
// nada. No escribe en ninguna parte.
//
// Dos cosas que cambian el resultado y conviene tener claras:
//
// Se cuenta ATLETAS, no resultados. Alguien que corrió tres veces en el período
// entra una vez, con su mejor GL: si no, el que compite más aparecería tres
// veces y correría el corte hacia arriba sin haber levantado más.
//
// El período sale de los filtros de arriba. Sin filtrar, el corte se calcula
// sobre todo el historial, que no es lo que se quiere para clasificar a una
// temporada: por eso la pantalla dice siempre sobre qué años está trabajando.
// ═══════════════════════════════════════════
// Qué temporada se está cortando.
//
// Por defecto, la del año en curso: un mínimo para clasificar al Nacional se
// saca de lo que se corrió ESTE año, no de todo el historial. Si el operador
// eligió un rango arriba, manda lo que eligió.
//
// Si de la temporada en curso todavía no hay nada cargado —en enero, por
// ejemplo— se usa la última que sí tenga, y la pantalla lo dice: es mejor eso
// que una tabla vacía sin explicación.
function _corteTemporada(){
  const f=ST.statsFilters||{};
  if(f.yearFrom||f.yearTo)return {anio:null,fuente:'filtro'};
  const enCurso=String(new Date().getFullYear());
  const anios=[...new Set(_glRows().map(r=>r.year))].sort();
  if(anios.indexOf(enCurso)>=0)return {anio:enCurso,fuente:'curso'};
  const ultima=anios[anios.length-1]||null;
  return {anio:ultima,fuente:ultima?'ultima':'vacio'};
}

function _corteFilas(){
  const t=_corteTemporada();
  const rows=_glRows();
  return t.anio ? rows.filter(r=>r.year===t.anio) : rows;
}

function _corteGrupos(){
  const rows=_corteFilas();
  const modo=(ST.corte&&ST.corte.agrupar)||'cat_div_mod';
  const sexLbl=s=>s==='F'?'F':s==='M'?'M':'—';
  const clave=r=>{
    if(modo==='cat')return sexLbl(r.sexo)+' '+r.cat+' kg';
    if(modo==='div')return sexLbl(r.sexo)+' '+r.div;
    if(modo==='mod')return sexLbl(r.sexo)+' '+r.mod;
    return sexLbl(r.sexo)+' '+r.cat+' kg · '+r.div+' · '+r.mod;
  };
  // Un atleta, una vez, con su mejor GL del período.
  const g={};
  rows.forEach(r=>{
    const k=clave(r);
    const quien=r.codigo||r.nombre;
    if(!quien)return;
    if(!g[k])g[k]={label:k,mejores:{}};
    const ant=g[k].mejores[quien];
    if(!ant||r.glp>ant.glp)g[k].mejores[quien]=r;
  });
  return Object.values(g).map(x=>{
    const atl=Object.values(x.mejores).sort((a,b)=>b.glp-a.glp);
    return {label:x.label,atletas:atl,n:atl.length};
  }).sort((a,b)=>b.n-a.n);
}

// El corte de un grupo según lo que se pidió: o los N mejores, o el X% mejor.
function _corteDe(grupo){
  const c=ST.corte||{};
  const n=grupo.n;
  let cupo;
  if(c.modo==='porcentaje') cupo=Math.max(1,Math.ceil(n*(+c.valor||10)/100));
  else cupo=Math.max(1,Math.round(+c.valor||10));
  cupo=Math.min(cupo,n);
  const min=grupo.atletas[cupo-1].glp;
  // Con empates en el GL exacto puede clasificar alguno más: el corte es un
  // mínimo, no un cupo cerrado. Se muestra el número real.
  const dentro=grupo.atletas.filter(a=>a.glp>=min).length;
  return {min,dentro,pct:n?dentro/n*100:0,cupo};
}

// Y si en vez de un mínimo por categoría se quisiera UNO SOLO para todos, ¿cuál
// sería y cómo repartiría? Sirve para ver el precio de simplificar: un número
// único es más fácil de comunicar, pero deja categorías con veinte y otras con
// ninguno.
function _corteUnico(grupos,totalObjetivo){
  const todos=[];
  grupos.forEach(g=>g.atletas.forEach(a=>todos.push(a.glp)));
  todos.sort((a,b)=>b-a);
  if(!todos.length)return null;
  const k=Math.min(todos.length,Math.max(1,totalObjetivo));
  const min=todos[k-1];
  const porGrupo=grupos.map(g=>({label:g.label,n:g.n,dentro:g.atletas.filter(a=>a.glp>=min).length}));
  return {min,total:todos.filter(v=>v>=min).length,
    vacios:porGrupo.filter(x=>x.dentro===0).length,
    maximo:Math.max(...porGrupo.map(x=>x.dentro)),
    minimo:Math.min(...porGrupo.map(x=>x.dentro)),porGrupo};
}

function renderCorte(){
  const c=ST.corte||{modo:'cantidad',valor:10,agrupar:'cat_div_mod'};
  const grupos=_corteGrupos();
  const rows=_corteFilas();
  const temp=_corteTemporada();
  const ks='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;text-align:center';
  const sel='background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;font-family:DM Sans';
  const anios=[...new Set(rows.map(r=>r.year))].sort();
  const periodo=anios.length?(anios.length===1?anios[0]:anios[0]+'–'+anios[anios.length-1]):'—';

  const controles=`<div style="background:rgba(8,16,30,.65);border:1px solid var(--border);border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;flex-wrap:wrap;gap:14px;align-items:center">
    <div style="font-family:Oswald;font-size:11px;letter-spacing:3px;color:var(--gold);font-weight:700">CORTE</div>
    <select style="${sel}" onchange="updCorte('modo',this.value)">
      <option value="cantidad" ${c.modo==='cantidad'?'selected':''}>Dejar los N mejores</option>
      <option value="porcentaje" ${c.modo==='porcentaje'?'selected':''}>Dejar el mejor N%</option>
    </select>
    <input type="number" min="1" max="${c.modo==='porcentaje'?100:60}" value="${c.valor}"
      style="${sel};width:80px" onchange="updCorte('valor',this.value)">
    <span style="font-size:12px;color:var(--muted)">${c.modo==='porcentaje'?'% por grupo':'atletas por grupo'}</span>
    <select style="${sel};min-width:230px" onchange="updCorte('agrupar',this.value)">
      <option value="cat_div_mod" ${c.agrupar==='cat_div_mod'?'selected':''}>Agrupar por categoría + división + modalidad</option>
      <option value="cat" ${c.agrupar==='cat'?'selected':''}>Agrupar solo por categoría de peso</option>
      <option value="div" ${c.agrupar==='div'?'selected':''}>Agrupar solo por división de edad</option>
      <option value="mod" ${c.agrupar==='mod'?'selected':''}>Agrupar solo por modalidad</option>
    </select>
    <div style="margin-left:auto"><button onclick="exportCorteCSV()" style="background:rgba(34,197,94,.15);border:1px solid var(--green);color:var(--green);padding:6px 12px;border-radius:6px;font-family:Oswald;font-size:11px;letter-spacing:1px;cursor:pointer;font-weight:700">CSV</button></div>
  </div>`;

  if(!grupos.length){
    return controles+`<div style="${ks};padding:40px">No hay resultados con GL points en este filtro.</div>`;
  }

  const cortes=grupos.map(g=>({g,c:_corteDe(g)}));
  const totalAtl=grupos.reduce((s,g)=>s+g.n,0);
  const totalDentro=cortes.reduce((s,x)=>s+x.c.dentro,0);
  const mins=cortes.map(x=>x.c.min);
  const unico=_corteUnico(grupos,totalDentro);
  const kpi=(v,l,col,extra='')=>`<div style="${ks}"><div style="font-family:Oswald;font-size:32px;font-weight:700;color:${col}">${v}</div>
    <div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">${l}</div>${extra}</div>`;

  const cel='padding:7px 10px;border-bottom:1px solid var(--border);font-size:12px';
  const th=(t,al='right')=>`<th style="${cel};text-align:${al};color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">${t}</th>`;

  return controles+`
  <div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.3);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:12px;color:var(--text);line-height:1.6">
    Calculado sobre la temporada <b>${periodo}</b>${temp.fuente==='curso'?' <span style="color:var(--muted)">(el año en curso)</span>':''}
    · ${totalAtl.toLocaleString()} atletas distintos en ${grupos.length} grupos.
    Cada atleta cuenta una vez, con su mejor GL de la temporada.
    ${temp.fuente==='ultima'?`<br><b style="color:#f59e0b">De ${new Date().getFullYear()} todavía no hay resultados cargados</b>, así que se está usando ${temp.anio}, la última temporada con datos.`:''}
    ${temp.fuente==='filtro'?`<br><b style="color:#f59e0b">Estás usando el filtro de años de arriba.</b> Por defecto el corte es de la temporada en curso; para volver a eso, deja los años en blanco.${anios.length>1?` Ahora hay ${anios.length} temporadas juntas, y un corte así no sirve para clasificar.`:''}`:''}
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:20px">
    ${kpi(totalDentro.toLocaleString(),'CLASIFICARÍAN','var(--gold)',
      `<div style="color:var(--muted);font-size:9px;margin-top:2px">de ${totalAtl.toLocaleString()} · ${Math.round(totalDentro/totalAtl*100)}%</div>`)}
    ${kpi(grupos.length,'GRUPOS','#a78bfa')}
    ${kpi(Math.min(...mins).toFixed(1)+'–'+Math.max(...mins).toFixed(1),'RANGO DE MÍNIMOS','#06b6d4',
      '<div style="color:var(--muted);font-size:9px;margin-top:2px">del grupo más flojo al más fuerte</div>')}
    ${unico?kpi(unico.min.toFixed(1),'SI FUERA UNO SOLO','#f59e0b',
      `<div style="color:var(--muted);font-size:9px;margin-top:2px">mismo total, pero ${unico.vacios} grupo${unico.vacios===1?'':'s'} sin nadie</div>`):''}
  </div>

  ${unico&&unico.vacios>0?`<div style="background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.35);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:12px;color:var(--text);line-height:1.6">
    <b style="color:#f59e0b">Un solo mínimo para todos sería ${unico.min.toFixed(1)} GL.</b>
    Deja pasar a los mismos ${unico.total} en total, pero repartidos muy distinto: el grupo más numeroso quedaría con ${unico.maximo}
    y ${unico.vacios} grupo${unico.vacios===1?' quedaría':'s quedarían'} sin ningún clasificado.
    Es el precio de tener un número único: más fácil de comunicar, más desparejo en la tarima.
  </div>`:''}

  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:24px">
    <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:4px">EL MÍNIMO DE CADA GRUPO</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:12px;opacity:.8">
      <b style="color:var(--text)">MÍNIMO GL</b> es lo que habría que pedir en ese grupo para llegar al objetivo.
      <b style="color:var(--text)">CLASIFICAN</b> puede pasarse del objetivo si hay empate exacto de GL en el borde: un mínimo no es un cupo cerrado.
      Los grupos con pocos atletas clasifican casi enteros — ahí el corte no filtra nada.
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr>${th('GRUPO','left')}${th('ATLETAS')}${th('MÍNIMO GL')}${th('CLASIFICAN')}${th('% DEL GRUPO')}${th('MEJOR')}${th('PEOR QUE ENTRA')}</tr></thead>
      <tbody>${cortes.map(({g,c:x})=>{
        const flojo=g.n<=x.dentro;
        return `<tr${flojo?' style="opacity:.6"':''}>
        <td style="${cel};color:var(--text)">${esc(g.label)}</td>
        <td style="${cel};text-align:right">${g.n}</td>
        <td style="${cel};text-align:right;color:var(--gold);font-family:Oswald;font-size:13px">${x.min.toFixed(1)}</td>
        <td style="${cel};text-align:right;color:#22c55e">${x.dentro}${flojo?'<span style="color:var(--muted);font-size:10px"> (todos)</span>':''}</td>
        <td style="${cel};text-align:right;color:#06b6d4">${Math.round(x.pct)}%</td>
        <td style="${cel};text-align:right;color:var(--muted)">${g.atletas[0].glp.toFixed(1)}</td>
        <td style="${cel};text-align:right;color:var(--muted);font-size:11px">${esc(g.atletas[x.dentro-1].nombre||'')}</td>
      </tr>`;}).join('')}</tbody>
    </table></div>
  </div>`;
}

window.updCorte=function(key,val){
  ST.corte=ST.corte||{modo:'cantidad',valor:10,agrupar:'cat_div_mod'};
  ST.corte[key]=key==='valor'?Math.max(1,parseInt(val)||1):val;
  const cont=document.getElementById('statsContent');
  if(cont)cont.innerHTML=renderCorte();
};

window.exportCorteCSV=function(){
  const grupos=_corteGrupos();
  if(!grupos.length){showToast('No hay datos para exportar',null,true);return;}
  const filas=['grupo,atletas,minimo_gl,clasifican,pct_del_grupo,mejor_gl,ultimo_que_entra'];
  grupos.forEach(g=>{
    const x=_corteDe(g);
    filas.push([`"${g.label.replace(/"/g,'""')}"`,g.n,x.min.toFixed(2),x.dentro,
      Math.round(x.pct),g.atletas[0].glp.toFixed(2),
      `"${String(g.atletas[x.dentro-1].nombre||'').replace(/"/g,'""')}"`].join(','));
  });
  const blob=new Blob([filas.join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  const t=_corteTemporada();
  a.download='yourlift_corte_'+(t.anio||'filtro')+'_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Corte exportado: '+grupos.length+' grupos');
};

// La dispersión de un grupo, escrita. Antes esto acompañaba a un diagrama de
// caja y bigote; el diagrama se sacó y quedaron los números, que son los que
// se copian a un informe.
function _glDispersionHtml(titulo,grupos){
  const con=grupos.filter(g=>g.arr.length);
  if(!con.length)return '';
  const cel='padding:7px 10px;border-bottom:1px solid var(--border);font-size:12px';
  const th=t=>`<th style="${cel};text-align:right;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">${t}</th>`;
  const num=(v,c)=>`<td style="${cel};text-align:right${c?';color:'+c:''}">${v}</td>`;
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:24px">
    <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:4px">${titulo}</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:12px;opacity:.8">
      <b style="color:var(--text)">DESV.</b> es cuánto se aleja del promedio la gente de ese grupo: mientras más chica, más parejo está el nivel.
      <b style="color:var(--text)">RIC</b> es el rango intercuartil, lo que ocupa la mitad del medio (de Q1 a Q3) — no lo mueven las marcas sueltas, ni arriba ni abajo.
      Con menos de una decena de resultados, ninguno de los dos dice gran cosa.
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${cel};text-align:left;color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">GRUPO</th>
        ${th('N')}${th('PROMEDIO')}${th('DESV.')}${th('MÍN')}${th('Q1')}${th('MEDIANA')}${th('Q3')}${th('RIC')}${th('MÁX')}${th('ATÍPICOS')}
      </tr></thead>
      <tbody>${con.map(g=>{
        const s=_glResumen(g.arr);
        return `<tr>
          <td style="${cel};color:var(--text);font-family:Oswald;letter-spacing:1px">${esc(g.label)}</td>
          ${num(s.n)}${num(s.prom.toFixed(1),'#3b82f6')}${num('±'+s.desv.toFixed(1),'#f59e0b')}
          ${num(s.real.min.toFixed(1),'var(--muted)')}${num(s.q1.toFixed(1))}${num(s.med.toFixed(1),'#a78bfa')}${num(s.q3.toFixed(1))}
          ${num(s.ric.toFixed(1),'#06b6d4')}${num(s.real.max.toFixed(1),'#22c55e')}${num(s.fuera.length||'—','var(--muted)')}
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;
}

function initGLCharts(){
  Object.values(_glc).forEach(c=>{try{c.destroy()}catch(e){}});_glc={};
  const rows=_glRows();
  if(!rows.length)return;
  const base={color:'#E8EEF6',
    plugins:{legend:{labels:{color:'#E8EEF6',font:{family:'Oswald',size:11}}}},
    scales:{x:{ticks:{color:'#8A9BB2',font:{family:'Oswald',size:10}},grid:{color:'rgba(29,49,80,.5)'}},
            y:{ticks:{color:'#8A9BB2',font:{family:'Oswald',size:10}},grid:{color:'rgba(29,49,80,.5)'}}}};
  const mk=(id,type,data,extra={},comple)=>{
    const el=document.getElementById(id);if(!el)return null;
    const c=new Chart(el,{type,data,plugins:comple||[],
      options:{responsive:true,maintainAspectRatio:false,...base,...extra,
      plugins:{...base.plugins,...(extra.plugins||{})},scales:{...base.scales,...(extra.scales||{})}}});
    _glc[id]=c;
    return c;
  };

  const resumenDe=f=>e=>{const a=rows.filter(r=>f(r,e));return a.length?_glResumen(a):null;};
  const AZUL='#3b82f6', ROSA='#ec4899';
  const years=[...new Set(rows.map(r=>r.year))].sort();

  // 1) GL promedio por año, hombres contra mujeres.
  const promSexo=(y,s)=>{const a=rows.filter(r=>r.year===y&&r.sexo===s);return a.length?+_glProm(a).toFixed(1):null;};
  mk('glAnioSexo','line',{labels:years,datasets:[
    {label:'Hombres',data:years.map(y=>promSexo(y,'M')),borderColor:AZUL,backgroundColor:'rgba(59,130,246,.15)',tension:.3,fill:true,spanGaps:true,pointBackgroundColor:AZUL},
    {label:'Mujeres',data:years.map(y=>promSexo(y,'F')),borderColor:ROSA,backgroundColor:'rgba(236,72,153,.15)',tension:.3,fill:true,spanGaps:true,pointBackgroundColor:ROSA}]});

  // 2) Cómo se reparten, en tramos de 10 puntos.
  const tramo=g=>Math.floor(g/10)*10;
  const tramos=[...new Set(rows.map(r=>tramo(r.glp)))].sort((a,b)=>a-b);
  const et=tramos.map(t=>t+'–'+(t+9));
  mk('glDist','bar',{labels:et,datasets:[
    {label:'Hombres',data:tramos.map(t=>rows.filter(r=>r.sexo==='M'&&tramo(r.glp)===t).length),backgroundColor:'rgba(59,130,246,.8)',borderRadius:3},
    {label:'Mujeres',data:tramos.map(t=>rows.filter(r=>r.sexo==='F'&&tramo(r.glp)===t).length),backgroundColor:'rgba(236,72,153,.8)',borderRadius:3}]},
    {scales:{...base.scales,x:{...base.scales.x,stacked:true},y:{...base.scales.y,stacked:true}}});

  // 3) Por división de edad. Es la comparativa Junior contra Sub-Junior que se pidió.
  const divs=GL_ORDEN_DIV.filter(d=>rows.some(r=>r.div===d));
  const promDe=(f)=>{const a=rows.filter(f);return a.length?+_glProm(a).toFixed(1):null;};
  mk('glDiv','bar',{labels:divs,datasets:[
    {label:'Hombres',data:divs.map(d=>promDe(r=>r.div===d&&r.sexo==='M')),backgroundColor:'rgba(59,130,246,.8)',borderRadius:4},
    {label:'Mujeres',data:divs.map(d=>promDe(r=>r.div===d&&r.sexo==='F')),backgroundColor:'rgba(236,72,153,.8)',borderRadius:4}]});

  // 4) Por modalidad.
  const mods=[...new Set(rows.map(r=>r.mod))].sort();
  mk('glMod','bar',{labels:mods,datasets:[
    {label:'Hombres',data:mods.map(m=>promDe(r=>r.mod===m&&r.sexo==='M')),backgroundColor:'rgba(59,130,246,.8)',borderRadius:4},
    {label:'Mujeres',data:mods.map(m=>promDe(r=>r.mod===m&&r.sexo==='F')),backgroundColor:'rgba(236,72,153,.8)',borderRadius:4}]});

  // 5) Cada división a lo largo de los años.
  const COL=['#ec4899','#f59e0b','#3b82f6','#22c55e','#a78bfa','#06b6d4','#f43f5e','#84cc16'];
  mk('glDivAnio','line',{labels:years,datasets:divs.map((d,i)=>({
    label:d,data:years.map(y=>promDe(r=>r.div===d&&r.year===y)),
    borderColor:COL[i%COL.length],backgroundColor:'transparent',tension:.3,spanGaps:true,
    pointBackgroundColor:COL[i%COL.length]}))});

  // 6) Modalidad cruzada con división.
  mk('glModDiv','bar',{labels:divs,datasets:mods.map((m,i)=>({
    label:m,data:divs.map(d=>promDe(r=>r.div===d&&r.mod===m)),
    backgroundColor:COL[i%COL.length],borderRadius:4}))});

  // 7) Los 20 mejores, un atleta una vez.
  const porAtleta={};
  rows.forEach(r=>{
    const k=r.codigo||r.nombre;
    if(!k)return;
    if(!porAtleta[k]||r.glp>porAtleta[k].glp)porAtleta[k]=r;
  });
  const top=Object.values(porAtleta).sort((a,b)=>b.glp-a.glp).slice(0,20);
  mk('glTop','bar',{labels:top.map(r=>(r.nombre||r.codigo)+' · '+r.year),
    datasets:[{label:'GL points',data:top.map(r=>+r.glp.toFixed(1)),
      backgroundColor:top.map(r=>r.sexo==='F'?'rgba(236,72,153,.85)':'rgba(59,130,246,.85)'),borderRadius:4}]},
    {indexAxis:'y',plugins:{legend:{display:false}}});
}

function initStatsCharts(){
  Object.values(_sc).forEach(c=>{try{c.destroy()}catch(e){}});_sc={};
  // Aplicar filtros del usuario para que todos los charts se actualicen juntos
  const rows = applyStatsFilters(buildStatsRows());
  const years=[...new Set(rows.map(r=>r.year))].sort();
  const base={color:'#E8EEF6',
    plugins:{legend:{labels:{color:'#E8EEF6',font:{family:'Oswald',size:11}}}},
    scales:{x:{ticks:{color:'#8A9BB2',font:{family:'Oswald',size:10}},grid:{color:'rgba(29,49,80,.5)'}},
            y:{ticks:{color:'#8A9BB2',font:{family:'Oswald',size:10}},grid:{color:'rgba(29,49,80,.5)'}}}};
  function mk(id,type,data,extra={}){
    const el=document.getElementById(id);if(!el)return;
    const opts={responsive:true,maintainAspectRatio:false,...base,...extra,
      plugins:{...base.plugins,...(extra.plugins||{})},
      scales:{...base.scales,...(extra.scales||{})}};
    _sc[id]=new Chart(el,{type,data,options:opts});
  }
  // 1 Únicos H/M
  const uM=years.map(y=>[...new Set(rows.filter(r=>r.year===y&&r.sexo==='M').map(r=>r.codigo))].length);
  const uF=years.map(y=>[...new Set(rows.filter(r=>r.year===y&&r.sexo==='F').map(r=>r.codigo))].length);
  mk('chartUnicos','line',{labels:years,datasets:[
    {label:'Hombres',data:uM,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.15)',fill:true,tension:.3,pointBackgroundColor:'#3b82f6'},
    {label:'Mujeres',data:uF,borderColor:'#ec4899',backgroundColor:'rgba(236,72,153,.15)',fill:true,tension:.3,pointBackgroundColor:'#ec4899'}]});
  // 2 Participaciones
  const pM=years.map(y=>rows.filter(r=>r.year===y&&r.sexo==='M').length);
  const pF=years.map(y=>rows.filter(r=>r.year===y&&r.sexo==='F').length);
  mk('chartPartic','bar',{labels:years,datasets:[
    {label:'Hombres',data:pM,backgroundColor:'rgba(59,130,246,.8)',borderRadius:4},
    {label:'Mujeres',data:pF,backgroundColor:'rgba(236,72,153,.8)',borderRadius:4}]});
  // 3&5 Categorías F y M
  const CF=['#ec4899','#f43f5e','#fb923c','#fbbf24','#a78bfa','#60a5fa','#34d399','#f472b6','#e879f9'];
  const CM=['#3b82f6','#6366f1','#0ea5e9','#06b6d4','#10b981','#84cc16','#f59e0b','#ef4444','#8b5cf6'];
  ['F','M'].forEach((sex,si)=>{
    const id=sex==='F'?'chartCatF':'chartCatM';
    const colors=sex==='F'?CF:CM;
    const rs=rows.filter(r=>r.sexo===sex);
    const allCats=[...new Set(rs.map(r=>r.cat))].filter(c=>c&&c!=='?').sort((a,b)=>parseFloat(a)-parseFloat(b));
    // pick top 9 by total count
    const cats=allCats.sort((a,b)=>rs.filter(r=>r.cat===b).length-rs.filter(r=>r.cat===a).length).slice(0,9).sort((a,b)=>parseFloat(a)-parseFloat(b));
    mk(id,'bar',{labels:years,datasets:cats.map((cat,i)=>({
      label:(cat.endsWith('+')?'+'+cat.slice(0,-1):'-'+cat)+' kg',data:years.map(y=>rs.filter(r=>r.year===y&&r.cat===cat).length),
      backgroundColor:colors[i%colors.length],borderRadius:2}))},
      {scales:{x:{...base.scales.x,stacked:true},y:{...base.scales.y,stacked:true}}});
  });
  // 4 Top clubs
  const cc={};rows.forEach(r=>{if(r.club)cc[r.club]=(cc[r.club]||0)+1;});
  const top=Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,10);
  mk('chartClubs','bar',{labels:top.map(([c])=>c.length>20?c.slice(0,19)+'…':c),
    datasets:[{label:'Participaciones',data:top.map(([,v])=>v),backgroundColor:'rgba(212,168,67,.85)',borderRadius:4}]},
    {indexAxis:'y',scales:{x:{...base.scales.x},y:{...base.scales.y,ticks:{color:'#8A9BB2',font:{size:9,family:'DM Sans'}}}}});
  // 6 División
  const DIVS=['Open','Junior','Sub-Junior','Universitario','Master I','Master II','Master III','Master IV'];
  const DC=['#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f43f5e','#84cc16'];
  mk('chartDiv','doughnut',{labels:DIVS,datasets:[{data:DIVS.map(d=>rows.filter(r=>r.div===d).length),
    backgroundColor:DC,borderColor:'#0A1628',borderWidth:2}]},
    {scales:{},plugins:{legend:{position:'right',labels:{color:'#E8EEF6',font:{family:'Oswald',size:10},boxWidth:12}}}});
  // 7 Edad promedio
  const avg=arr=>arr.length?Math.round(arr.reduce((s,v)=>s+v,0)/arr.length*10)/10:null;
  const eM=years.map(y=>avg(rows.filter(r=>r.year===y&&r.sexo==='M'&&r.age>10&&r.age<80).map(r=>r.age)));
  const eF=years.map(y=>avg(rows.filter(r=>r.year===y&&r.sexo==='F'&&r.age>10&&r.age<80).map(r=>r.age)));
  mk('chartEdad','line',{labels:years,datasets:[
    {label:'Hombres',data:eM,borderColor:'#3b82f6',fill:false,tension:.3,pointBackgroundColor:'#3b82f6'},
    {label:'Mujeres',data:eF,borderColor:'#ec4899',fill:false,tension:.3,pointBackgroundColor:'#ec4899'}]});
  // 8 Modalidad
  const MODS=['Classic','Equipado','Only Bench'];
  const MC=['#22c55e','#f59e0b','#3b82f6'];
  mk('chartMod','bar',{labels:years,datasets:MODS.map((mod,i)=>({
    label:mod,data:years.map(y=>rows.filter(r=>r.year===y&&r.mod===mod).length),
    backgroundColor:MC[i],borderRadius:2}))},
    {scales:{x:{...base.scales.x,stacked:true},y:{...base.scales.y,stacked:true}}});

  // 9 Crecimiento YoY
  const uniqSz=years.map(y=>new Set(rows.filter(r=>r.year===y).map(r=>r.codigo)).size);
  const deltaAbs=years.map((y,i)=>i===0?0:uniqSz[i]-uniqSz[i-1]);
  const deltaPct=years.map((y,i)=>i===0?null:(uniqSz[i-1]>0?Math.round((uniqSz[i]-uniqSz[i-1])/uniqSz[i-1]*1000)/10:null));
  mk('chartCrecimiento','bar',{labels:years,datasets:[
    {label:'Δ atletas únicos',data:deltaAbs,backgroundColor:deltaAbs.map(v=>v>=0?'rgba(34,197,94,.8)':'rgba(239,68,68,.8)'),borderRadius:4,yAxisID:'y'},
    {label:'% cambio',data:deltaPct,type:'line',borderColor:'#f59e0b',backgroundColor:'transparent',pointBackgroundColor:'#f59e0b',tension:.3,yAxisID:'y1'}]},
    {scales:{
      x:{...base.scales.x},
      y:{...base.scales.y,title:{display:true,text:'Δ atletas',color:'#8A9BB2',font:{size:9}}},
      y1:{position:'right',ticks:{color:'#f59e0b',font:{family:'Oswald',size:10},callback:v=>v+'%'},grid:{drawOnChartArea:false}}}});

  // 10 Predicción (regresión lineal + forecast 3 años)
  const nY=years.length,xsR=years.map((_,i)=>i);
  const sxR=xsR.reduce((s,v)=>s+v,0),syR=uniqSz.reduce((s,v)=>s+v,0);
  const sxyR=xsR.reduce((s,x,i)=>s+x*uniqSz[i],0),sxxR=xsR.reduce((s,x)=>s+x*x,0);
  const slp=(nY*sxyR-sxR*syR)/(nY*sxxR-sxR*sxR||1);
  const icp=(syR-slp*sxR)/nY;
  const trendLine=years.map((_,i)=>Math.max(0,Math.round(icp+slp*i)));
  const lastYr=parseInt(years[years.length-1])||2025;
  const fcYears=[lastYr+1,lastYr+2,lastYr+3].map(String);
  const fcVals=fcYears.map((_,i)=>Math.max(0,Math.round(icp+slp*(nY+i))));
  const allLabels=[...years,...fcYears];
  const histData=[...uniqSz,...fcYears.map(()=>null)];
  const trendData=[...trendLine,...fcVals];
  mk('chartPrediccion','line',{labels:allLabels,datasets:[
    {label:'Histórico',data:histData,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.15)',fill:true,tension:.3,pointBackgroundColor:'#3b82f6'},
    {label:'Tendencia + forecast',data:trendData,borderColor:'#a78bfa',backgroundColor:'transparent',
      borderDash:[6,4],tension:.3,pointBackgroundColor:allLabels.map((_,i)=>i>=nY?'#a78bfa':'transparent'),
      pointRadius:allLabels.map((_,i)=>i>=nY?5:0)}]});

  // 11 Retención
  const retLabels=years.slice(1);
  const retData=retLabels.map((y,i)=>{
    const py=years[i];
    const pc=new Set(rows.filter(r=>r.year===py).map(r=>r.codigo));
    const cc=new Set(rows.filter(r=>r.year===y).map(r=>r.codigo));
    return pc.size>0?Math.round([...pc].filter(c=>cc.has(c)).length/pc.size*100):0;
  });
  mk('chartRetencion','line',{labels:retLabels,datasets:[
    {label:'% retención',data:retData,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,.15)',fill:true,
      tension:.3,pointBackgroundColor:'#f59e0b',pointRadius:5}]},
    {scales:{x:{...base.scales.x},y:{...base.scales.y,min:0,max:100,ticks:{...base.scales.y.ticks,callback:v=>v+'%'}}}});

  // 12 Distribución por n° de competencias
  const cc2={};rows.forEach(r=>{cc2[r.codigo]=(cc2[r.codigo]||0)+1;});
  const buckets={'1 comp':0,'2 comp':0,'3 comp':0,'4 comp':0,'5–9 comp':0,'10+ comp':0};
  Object.values(cc2).forEach(n=>{
    if(n===1)buckets['1 comp']++;
    else if(n===2)buckets['2 comp']++;
    else if(n===3)buckets['3 comp']++;
    else if(n===4)buckets['4 comp']++;
    else if(n<10)buckets['5–9 comp']++;
    else buckets['10+ comp']++;
  });
  mk('chartDistComp','bar',{labels:Object.keys(buckets),datasets:[{
    label:'Atletas',data:Object.values(buckets),
    backgroundColor:['#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899'],borderRadius:4}]},
    {plugins:{legend:{display:false}}});

  // 13 Top 20 atletas
  const nameMap={};(ST.data||[]).forEach(a=>{nameMap[a.codigo]=a.nombre||a.codigo;});
  const top20=Object.entries(cc2).sort((a,b)=>b[1]-a[1]).slice(0,20);
  const t20Labels=top20.map(([cod])=>{const n=nameMap[cod]||cod;return n.length>28?n.slice(0,27)+'…':n;});
  mk('chartTopAtletas','bar',{labels:t20Labels,datasets:[{
    label:'Competencias',data:top20.map(([,v])=>v),
    backgroundColor:'rgba(212,168,67,.85)',borderRadius:4}]},
    {indexAxis:'y',
     scales:{x:{...base.scales.x},y:{...base.scales.y,ticks:{color:'#E8EEF6',font:{size:10,family:'DM Sans'}}}},
     plugins:{legend:{display:false}}});
}

// La tabla de atletas, aparte del resto de la pantalla.
//
// Está separada a propósito. Escribiendo en el buscador se redibujaba la
// pantalla ENTERA en cada letra, y eso destruye y vuelve a crear el campo de
// texto: en el teléfono el teclado se cierra y se abre a cada letra, y escribir
// un nombre se hace imposible. Se devolvía el foco por programa, pero eso no
// evita el parpadeo — el campo ya murió.
//
// Ahora el buscador se dibuja una sola vez y lo único que se rehace es esta
// tabla. El campo de texto no se toca nunca, así que el cursor y el teclado se
// quedan donde están.
function _atletasTablaHtml(){
  const sRaw=(ST.search||'').trim();
  const sNorm=nrmName(sRaw);
  const words=sNorm.split(' ').filter(Boolean);
  const fl=ST.filterLetter;
  let sorted=[...ST.data].sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
  let list=sorted.filter(a=>{
    if(fl&&!String(a.nombre||'').toUpperCase().startsWith(fl))return false;
    if(words.length){
      const nName=nrmName(a.nombre);
      const nClub=nrmName(a.club||'');
      const nCod=(a.codigo||'').toLowerCase();
      const nRut=(a.rut||'').replace(/[^0-9kK]/gi,'').toLowerCase();
      const sClean=sNorm.replace(/\s+/g,'');
      const qRut=sRaw.replace(/[^0-9kK]/gi,'').toLowerCase();
      // match si: todas las palabras están en el nombre, O el query está en club/código/rut.
      // OJO: qRut/sClean pueden quedar vacíos al buscar un nombre puro — sin el guard,
      // `incluye('')` es siempre true y dejaría pasar a TODOS (no filtraría nada).
      const byName=words.every(w=>nName.includes(w));
      const byOther=nClub.includes(sNorm)||(sClean&&nCod.includes(sClean))||(qRut&&nRut.includes(qRut));
      if(!byName&&!byOther)return false;
    }
    return true;
  }).slice(0,100);
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return `
    <div style="display:flex;gap:12px">
      <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">
        <button onclick="atlLetra('')" style="padding:4px 8px;border-radius:4px;border:1px solid ${!fl?'var(--accent)':'var(--border)'};background:${!fl?'var(--accent)':'transparent'};color:${!fl?'#fff':'var(--muted)'};font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer">ALL</button>
        ${letters.map(l=>`<button onclick="atlLetra('${l}')" style="padding:3px 8px;border-radius:4px;border:1px solid ${fl===l?'var(--accent)':'var(--border)'};background:${fl===l?'var(--accent)':'transparent'};color:${fl===l?'#fff':'var(--muted)'};font-family:Oswald;font-size:10px;font-weight:700;cursor:pointer;min-width:30px">${l}</button>`).join('')}
      </div>
      <div class="card" style="padding:0;overflow-x:auto;flex:1">
        <table class="tbl">
          <tr><th>Código</th><th>RUT</th><th>Nombre</th><th>Club</th><th>Debut</th><th>Comp.</th><th></th></tr>
          ${list.map(a=>{
            const esc=a.codigo.replace(/'/g,"\\'");
            const badCodigo=!/^\d{4}[A-Z]{2,3}-\d{4}$/.test(a.codigo);
            return `<tr${badCodigo?' style="background:rgba(239,68,68,.06)"':''}>
            <td><span class="editable" onclick="editAthlete('${esc}','codigo')" style="font-size:10px;font-family:Oswald;color:${badCodigo?'var(--red)':'var(--accent)'}" title="${badCodigo?'Código inválido — click para corregir':''}">${a.codigo}</span></td>
            <td><span class="editable" onclick="editAthlete('${esc}','rut')" style="font-size:10px;color:${a.rut?'var(--muted)':'var(--red)'}" title="Click para editar RUT">${a.rut||'sin RUT'}</span></td>
            <td><span class="editable" onclick="editAthlete('${esc}','nombre')">${a.nombre}</span></td>
            <td><span class="editable" onclick="editAthlete('${esc}','club')">${a.club||'—'}</span></td>
            <td><span class="editable" onclick="editAthlete('${esc}','debut')">${a.debut||'—'}</span></td>
            <td style="text-align:center"><span class="badge b-y">${a.competencias?.length||0}</span></td>
            <td style="display:flex;gap:4px;flex-wrap:wrap">
              ${badCodigo?`<button onclick="fixCodigoAuto('${esc}')" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);color:var(--red);padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:Oswald;font-weight:700" title="Generar código correcto desde RUT + nombre + debut">Fix</button>`:''}
              <button onclick="openAthleteProfile('${esc}')" style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);color:var(--blue);padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:Oswald" title="Ver perfil"></button>
              <button onclick="deleteAthlete('${esc}')" style="background:transparent;border:1px solid rgba(239,68,68,.3);color:var(--red);padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:Oswald" title="Eliminar"><i class=yl-i-cerrar></i></button>
            </td>
          </tr>`;}).join('')}
        </table>
      </div>
    </div>
    ${list.length===100?'<p style="text-align:center;color:var(--muted);font-size:12px;padding:14px">Mostrando primeros 100 — refina tu búsqueda</p>':''}`;
}

function renderAthletes(){
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="h1" style="margin:0">Atletas (Base de Datos)</div>
      ${(['owner','superadmin'].includes(ST.adminInfo?.role)||ST.adminInfo?.bootstrap)?`<button onclick="openCompModal('')" class="btn btn-g" style="padding:8px 14px;font-size:12px">+ Agregar competencia</button>`:''}
    </div>
    <p class="subtitle">${ST.data.length} atletas · Ordenados A-Z · Click en cualquier campo para editar</p>
    <div class="search-box">
      <input id="atlBuscar" class="inp" placeholder="Buscar nombre, club, código o RUT..." value="${esc(ST.search||'')}" oninput="searchDebounced(this.value)" autocomplete="off">
    </div>
    <div id="atlTabla">${_atletasTablaHtml()}</div>`;
}

// ════════════════════════════════════════════════════════════════
// REINICIO DEL RANKING
//
// El ranking arranca de cero con cada Campeonato Nacional: lo que se corrió
// antes deja de contar. Antes esto era editar el archivo del ranking a mano.
//
// Lo que se guarda es una FECHA DE CORTE en ranking_config/ciclo. El ranking
// público muestra solo los resultados publicados desde esa fecha. No se borra
// nada: los resultados siguen enteros en Firestore, se siguen viendo en el
// perfil de cada atleta y en las actas, y quitando el corte vuelve el ranking
// completo. Por eso la pantalla insiste en que es reversible: si alguien lo
// aprieta por error un día de campeonato, se deshace en dos clics.
//
// Va acá y no dentro de la ficha del campeonato porque es una decisión de la
// comisión técnica, no una propiedad del evento, y porque tiene que poder
// deshacerse sin volver a abrir un campeonato ya cerrado.
// ════════════════════════════════════════════════════════════════
function _puedeCiclo(){
  const r=ST.adminInfo?.role;
  return r==='owner'||r==='superadmin'||r==='admin'||!!ST.adminInfo?.bootstrap;
}

// Los campeonatos que pueden abrir un ciclo: los que ya tienen resultados
// publicados. No tiene sentido cortar el ranking en un campeonato que todavía
// no corrió — dejaría el ranking vacío.
function _cicloCandidatos(){
  const porEvento={};
  (ST.allCompResults||[]).forEach(r=>{
    const nombre=r.evento||''; if(!nombre) return;
    const f=r.fecha||'';
    const k=r.evento_id||nombre;
    if(!porEvento[k])porEvento[k]={id:r.evento_id||'',nombre,fecha:f,n:0};
    porEvento[k].n++;
    // Se usa la fecha más TEMPRANA del campeonato: si duró dos días, el corte
    // tiene que dejar dentro también el primero.
    if(f&&(!porEvento[k].fecha||f<porEvento[k].fecha))porEvento[k].fecha=f;
  });
  return Object.values(porEvento).filter(e=>e.fecha).sort((a,b)=>b.fecha.localeCompare(a.fecha));
}

function renderRankingCiclo(){
  const c=ST.rankingCiclo;
  const cands=_cicloCandidatos();
  const sel=ST.rankingCicloSel||'';
  const elegido=cands.find(x=>(x.id||x.nombre)===sel)||null;
  const activo=!!(c&&c.desde);
  let h=`<div class="hdr"><h1>Reinicio ranking</h1></div>`;

  h+=`<div class="card" style="border-color:${activo?'var(--gold)':'var(--border)'}">
    <div style="font-family:Oswald;font-size:13px;letter-spacing:1px;color:${activo?'var(--gold)':'var(--muted)'};margin-bottom:8px">ESTADO ACTUAL</div>`;
  if(activo){
    h+=`<div style="font-size:15px;color:var(--text);margin-bottom:6px">El ranking parte desde <b>${esc(c.evento||'—')}</b></div>
      <div style="font-size:12px;color:var(--muted)">Cuentan los resultados publicados desde el <b>${esc(c.desde)}</b>. Lo anterior no aparece en el ranking, pero sigue guardado y visible en el perfil de cada atleta.</div>
      <button class="btn" style="margin-top:14px;background:transparent;border:1px solid var(--red);color:var(--red)" onclick="quitarCicloRanking()">Quitar el corte y volver al ranking completo</button>`;
  }else{
    h+=`<div style="font-size:15px;color:var(--text);margin-bottom:6px">El ranking muestra <b>todos</b> los resultados</div>
      <div style="font-size:12px;color:var(--muted)">No hay ningún ciclo abierto. Es lo normal hasta que se corra el próximo Nacional.</div>`;
  }
  h+=`</div>`;

  h+=`<div class="card">
    <div style="font-family:Oswald;font-size:13px;letter-spacing:1px;color:var(--text);margin-bottom:4px">ABRIR UN CICLO NUEVO</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:14px">
      Se elige el campeonato que abre el ciclo —normalmente el Nacional recién cerrado— y desde ese momento el ranking cuenta solo ese campeonato en adelante.
      <b style="color:var(--text)">No se borra ningún resultado:</b> quedan guardados en la base, se siguen viendo en el perfil de cada atleta y en las actas, y este mismo corte se puede quitar cuando se quiera.
    </div>`;
  if(!cands.length){
    h+=`<div style="font-size:12px;color:var(--muted)">Todavía no hay campeonatos con resultados publicados. Un campeonato aparece acá después de cerrarlo desde el control en vivo.</div>`;
  }else{
    h+=`<label class="field" style="max-width:560px"><span>Campeonato que abre el ciclo</span>
      <select class="inp" onchange="ST.rankingCicloSel=this.value;render()">
        <option value="">— Elegir campeonato —</option>
        ${cands.map(e=>`<option value="${esc(e.id||e.nombre)}" ${sel===(e.id||e.nombre)?'selected':''}>${esc(e.nombre)} · ${esc(e.fecha)} · ${e.n} resultados</option>`).join('')}
      </select></label>`;
    if(elegido){
      const quedan=(ST.allCompResults||[]).filter(r=>(r.fecha||'')>=elegido.fecha).length;
      const fuera=(ST.allCompResults||[]).length-quedan;
      h+=`<div style="margin-top:12px;padding:12px 14px;background:rgba(212,168,67,.07);border:1px solid rgba(212,168,67,.3);border-radius:8px;font-size:12px;color:var(--text);line-height:1.7">
        Si abres el ciclo en <b>${esc(elegido.nombre)}</b>:<br>
        · el corte queda en el <b>${esc(elegido.fecha)}</b>;<br>
        · el ranking pasa a contar <b>${quedan}</b> resultados;<br>
        · dejan de aparecer <b>${fuera}</b> resultados anteriores, que <b>siguen guardados</b>.
      </div>
      <button class="btn btn-g" style="margin-top:14px" onclick="abrirCicloRanking()">Reiniciar el ranking desde ${esc(elegido.nombre)}</button>`;
    }
  }
  h+=`</div>`;
  return h;
}

window.abrirCicloRanking=async function(){
  const sel=ST.rankingCicloSel||'';
  const e=_cicloCandidatos().find(x=>(x.id||x.nombre)===sel);
  if(!e){ showToast('Elige primero el campeonato', null, true); return; }
  if(!confirm(`REINICIAR EL RANKING\n\nEl ranking pasará a mostrar solo los resultados desde el ${e.fecha} — "${e.nombre}" en adelante.\n\nNo se borra nada: los resultados anteriores quedan guardados y se siguen viendo en el perfil de cada atleta. Este corte se puede quitar cuando quieras.\n\n¿Confirmar?`)) return;
  try{
    await setDoc(doc(db,'ranking_config','ciclo'),
      {desde:e.fecha, evento:e.nombre, evento_id:e.id||'', ts:serverTimestamp(), por:ST.user?.email||''});
    await logAction('ranking_ciclo_abrir', e.id||e.nombre, null, e.fecha);
    ST.rankingCiclo={desde:e.fecha,evento:e.nombre,evento_id:e.id||''};
    showToast('Ranking reiniciado desde '+e.nombre);
    render();
  }catch(err){ showToast('Error: '+err.message, null, true); console.error(err); }
};

window.quitarCicloRanking=async function(){
  if(!confirm('QUITAR EL CORTE\n\nEl ranking vuelve a mostrar todos los resultados, como antes del reinicio.\n\n¿Confirmar?')) return;
  try{
    await deleteDoc(doc(db,'ranking_config','ciclo'));
    await logAction('ranking_ciclo_quitar', 'ciclo', null, '');
    ST.rankingCiclo=null;
    showToast('Corte quitado — el ranking vuelve a estar completo');
    render();
  }catch(err){ showToast('Error: '+err.message, null, true); console.error(err); }
};

function renderCompetenciasPasadas(){
  const evs=cpPasados();
  const sel=ST.cpSel&&evs.find(e=>e.id===ST.cpSel)?ST.cpSel:'';
  let h='<div class="h1">Competencias pasadas</div>';
  h+='<p class="subtitle">Sube el acta que bajaste del livecast y queda para descargar en yourlift.cl → Competencias pasadas. Se listan los campeonatos archivados y los que ya tienen fecha cumplida.</p>';

  if(!evs.length){
    h+='<div class="card" style="text-align:center;color:var(--muted);font-size:13px;padding:30px">Todavía no hay campeonatos terminados.</div>';
    return h;
  }

  h+='<div class="card"><label style="font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px">CAMPEONATO</label>';
  h+='<select class="inp" style="margin-top:6px" onchange="cpElegir(this.value)">';
  h+='<option value="">— Elige un campeonato —</option>';
  evs.forEach(e=>{
    const f=cpFicha(e.id);
    const n=f&&f.docs?f.docs.length:0;
    h+=`<option value="${esc(e.id)}" ${sel===e.id?'selected':''}>${esc(e.name||e.id)}${e.date?' · '+esc(e.date):''}${n?` · ${n} documento(s)`:''}</option>`;
  });
  h+='</select></div>';

  if(!sel){
    // Resumen: qué campeonatos ya tienen acta publicada y cuáles no.
    h+='<div class="card"><div style="font-family:Oswald;letter-spacing:1px;font-size:13px;margin-bottom:10px">ESTADO</div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:13px">';
    h+='<tr style="color:var(--muted);font-size:11px;text-align:left"><th style="padding:6px 4px">Campeonato</th><th style="padding:6px 4px">Fecha</th><th style="padding:6px 4px">Documentos</th><th style="padding:6px 4px">En el sitio</th></tr>';
    evs.forEach(e=>{
      const f=cpFicha(e.id); const n=f&&f.docs?f.docs.length:0;
      const pub=!!(f&&f.publicado&&n);
      h+=`<tr style="border-top:1px solid var(--border)">
        <td style="padding:7px 4px"><a href="#" onclick="cpElegir('${esc(e.id)}');return false" style="color:var(--text)">${esc(e.name||e.id)}</a></td>
        <td style="padding:7px 4px;color:var(--muted)">${esc(e.date||'—')}</td>
        <td style="padding:7px 4px;color:${n?'var(--text)':'var(--muted)'}">${n||'—'}</td>
        <td style="padding:7px 4px;color:${pub?'var(--green)':'var(--muted)'}">${pub?'Publicado':'No'}</td>
      </tr>`;
    });
    h+='</table></div>';
    return h;
  }

  const ev=evs.find(e=>e.id===sel);
  const f=cpFicha(sel)||{};
  const docs=f.docs||[];
  h+='<div class="card">';
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <div><div style="font-family:Oswald;font-size:17px;letter-spacing:1px">${esc(ev.name||ev.id)}</div>
        <div style="color:var(--muted);font-size:12px">${esc(cpFecha(ev.date))}${ev.location?' · '+esc(ev.location):''}</div></div>
        <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer">
          <input type="checkbox" ${f.publicado?'checked':''} onchange="cpPublicar('${esc(sel)}',this.checked)"> Visible en yourlift.cl
        </label>
      </div>`;

  h+=`<label class="btn btn-g" style="display:inline-block">
        <input type="file" accept="${CP_TIPOS}" multiple style="display:none" onchange="cpSubir('${esc(sel)}',this)">
        + Subir acta
      </label>
      <span style="color:var(--muted);font-size:12px;margin-left:10px">PDF o Excel, hasta ${CP_MAX_MB} MB. Puedes subir varios de una.</span>`;

  if(!docs.length){
    h+='<div style="color:var(--muted);font-size:13px;margin-top:16px">Todavía no subiste ningún documento de este campeonato.</div>';
  }else{
    h+='<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">';
    h+='<tr style="color:var(--muted);font-size:11px;text-align:left"><th style="padding:6px 4px">Nombre que se ve en el sitio</th><th style="padding:6px 4px">Archivo</th><th style="padding:6px 4px"></th></tr>';
    docs.forEach((d,i)=>{
      h+=`<tr style="border-top:1px solid var(--border)">
        <td style="padding:7px 4px"><input class="inp" style="padding:6px 8px;font-size:12px" value="${esc(d.nombre||'')}" onchange="cpRenombrar('${esc(sel)}',${i},this.value)"></td>
        <td style="padding:7px 4px;color:var(--muted);white-space:nowrap">${esc((d.archivo||'').slice(-34))} · ${esc(cpPeso(d.tamano))}</td>
        <td style="padding:7px 4px;white-space:nowrap;text-align:right">
          <a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener" style="background:var(--border);color:var(--text);text-decoration:none">Ver</a>
          <button class="btn" onclick="cpBorrar('${esc(sel)}',${i})" style="background:transparent;border:1px solid var(--red);color:var(--red);margin-left:5px">Borrar</button>
        </td>
      </tr>`;
    });
    h+='</table>';
  }
  h+='</div>';
  return h;
}

window.cpElegir=function(id){ ST.cpSel=id||''; render(); };

// Guarda la ficha entera del campeonato. Se manda completa (no merge parcial) para
// que borrar un documento borre de verdad la entrada de la lista.
async function cpGuardar(id, ficha){
  const ev=(ST.eventos||[]).find(e=>e.id===id)||{};
  const dato={
    evento:id,
    name:ev.name||id,
    fecha:ev.date||'',
    lugar:ev.location||'',
    logoUrl:ev.logoUrl||'',
    publicado:!!ficha.publicado,
    docs:ficha.docs||[],
    updatedAt:serverTimestamp()
  };
  await setDoc(doc(db,'competencias_pasadas',id),dato);
  ST.pasadas=ST.pasadas||{};
  ST.pasadas[id]={...dato};
  render();
}

window.cpSubir=async function(id,input){
  const files=[...(input.files||[])];
  input.value='';
  if(!files.length)return;
  const btn=input.closest('label');
  const original=btn?btn.textContent:'';
  try{
    const storage=getStorage(app);
    const ficha=cpFicha(id)||{docs:[],publicado:false};
    const docs=(ficha.docs||[]).slice();
    for(let i=0;i<files.length;i++){
      const file=files[i];
      if(file.size>CP_MAX_MB*1024*1024){ showToast(file.name+' pesa más de '+CP_MAX_MB+' MB',null,true); continue; }
      if(btn)btn.textContent=`Subiendo ${i+1}/${files.length}…`;
      // El nombre del archivo se limpia, pero el que se ve en el sitio es editable.
      const limpio=file.name.replace(/[^A-Za-z0-9._-]+/g,'_').slice(-70);
      const ruta=`actas/${id}/${Date.now()}_${limpio}`;
      const sref=storageRef(storage,ruta);
      await uploadBytes(sref,file,{contentType:file.type||'application/octet-stream'});
      docs.push({
        nombre:file.name.replace(/\.[^.]+$/,''),
        archivo:file.name,
        url:await getDownloadURL(sref),
        ruta,
        tamano:file.size,
        subidoEn:new Date().toISOString()
      });
    }
    await cpGuardar(id,{...ficha,docs});
    showToast(files.length>1?files.length+' documentos subidos':'Acta subida');
  }catch(e){ showToast('Error: '+e.message,null,true); }
  finally{ if(btn)btn.textContent=original; render(); }
};

window.cpRenombrar=async function(id,i,valor){
  const ficha=cpFicha(id); if(!ficha||!ficha.docs||!ficha.docs[i])return;
  const docs=ficha.docs.slice();
  docs[i]={...docs[i],nombre:String(valor||'').trim()||docs[i].archivo};
  try{ await cpGuardar(id,{...ficha,docs}); showToast('Nombre actualizado'); }
  catch(e){ showToast('Error: '+e.message,null,true); }
};

window.cpBorrar=async function(id,i){
  const ficha=cpFicha(id); if(!ficha||!ficha.docs||!ficha.docs[i])return;
  const d=ficha.docs[i];
  if(!confirm('¿Borrar "'+(d.nombre||d.archivo)+'"?\n\nDeja de estar disponible para descargar en el sitio.'))return;
  try{
    // Primero la ficha: si el archivo de Storage ya no está, igual queremos que
    // deje de aparecer en el sitio en vez de quedar con un enlace roto.
    const docs=ficha.docs.filter((_,k)=>k!==i);
    await cpGuardar(id,{...ficha,docs});
    if(d.ruta){ try{ await deleteObject(storageRef(getStorage(app),d.ruta)); }catch(e){ console.warn('[actas] borrar archivo',e.message); } }
    showToast('Documento borrado');
  }catch(e){ showToast('Error: '+e.message,null,true); }
};

window.cpPublicar=async function(id,on){
  const ficha=cpFicha(id)||{docs:[]};
  if(on&&!(ficha.docs||[]).length){ showToast('Sube al menos un documento antes de publicarlo',null,true); render(); return; }
  try{ await cpGuardar(id,{...ficha,publicado:!!on}); showToast(on?'Publicado en yourlift.cl':'Sacado del sitio'); }
  catch(e){ showToast('Error: '+e.message,null,true); }
};

function renderExports(){
  const isOwner=ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap;
  return `
    <div class="h1">Exports / Backups</div>
    <p class="subtitle">Descargar respaldos de los datos</p>
    <div class="card">
      <div class="h2">Descargas disponibles</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${isOwner
          ?`<button class="btn btn-b" onclick="exportData()" style="text-align:left;padding:14px">data.json para el sitio (${ST.data.length} atletas, sin RUT ni fechas) — Descargar</button>
            <button class="btn" onclick="exportData(true)" style="text-align:left;padding:14px;background:transparent;border:1px solid var(--border)">Respaldo completo, con RUT y fechas — solo para guardar, no subir al sitio</button>
            <button id="btnSyncStorage" class="btn btn-g" onclick="syncDataJsonToStorage()" style="text-align:left;padding:14px">Publicar data.json al sitio (sin GitHub)</button>
            <div style="margin-top:6px;border:1px solid ${ST.padronPrivado?'var(--green)':'var(--orange)'};border-radius:8px;padding:12px 14px">
              <div style="font-family:Oswald;font-size:12px;letter-spacing:1px;color:${ST.padronPrivado?'var(--green)':'var(--orange)'}">DATOS PERSONALES</div>
              <div style="font-size:12px;color:var(--muted);margin:4px 0 8px;line-height:1.5">${ST.padronPrivado
                ?'El RUT y la fecha de nacimiento de '+ST.padronPrivado+' atletas están guardados en privado. El data.json que se publica va sin ellos.'
                :'El RUT y la fecha de nacimiento todavía están en el data.json público. Primero publica las reglas nuevas de Firestore; después apreta este botón una vez.'}</div>
              <button id="btnProteger" class="btn ${ST.padronPrivado?'':'btn-r'}" onclick="protegerDatosPersonales()" style="padding:10px 14px">Proteger datos personales</button>
            </div>`
          :`<div style="padding:12px 14px;border:1px solid var(--border);border-radius:8px;color:var(--muted);font-size:12px"><strong>data.json</strong> — Solo el Owner puede descargar la base de datos raw</div>`
        }
        <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-family:Oswald;letter-spacing:1px">OPL FORMAT (OPENPOWERLIFTING)</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn-g" onclick="exportOPL()" style="text-align:left;padding:12px">OPL CSV — todos los aprobados</button>
            ${ST.eventos.filter(e=>e.status!=='archived').map(ev=>`<button class='btn' onclick='exportOPL("${ev.id}")' style='text-align:left;padding:10px;font-size:12px;background:transparent;border:1px solid var(--border)'>OPL — ${ev.name}</button>`).join('')}
          </div>
        </div>
        ${isOwner?`<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-family:Oswald;letter-spacing:1px">RANKING</div>
          <button class="btn btn-w" id="btnExportRanking" onclick="exportRankingExcel(this)" style="text-align:left;padding:14px;width:100%">Descargar el ranking en Excel</button>
          <p style="font-size:10px;color:var(--muted);margin-top:6px">Una hoja por pestaña del ranking (Classic Masculino, Classic Femenino, Bench…) y adentro cada categoría de peso y división por separado, igual que en el sitio. Con nombre, club, año de nacimiento, marcas y el campeonato donde las hizo.</p>
        </div>`:''}
        ${isOwner?`<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-family:Oswald;letter-spacing:1px">RESULTADOS DE CAMPEONATOS</div>
          <button class="btn btn-w" id="btnExportResultados" onclick="exportResultadosExcel(this)" style="text-align:left;padding:14px;width:100%">Descargar los resultados en Excel (${_expResEventos().length} campeonatos)</button>
          <p style="font-size:10px;color:var(--muted);margin-top:6px">Una pestaña por campeonato cerrado en YourLift (${_expResEventos().map(e=>e.corto).join(' · ')||'cargando…'}). Adentro, cada modalidad, categoría y división por separado, con lugar, atleta, club, año de nacimiento, marcas, total y GL.</p>
        </div>`:''}
        <button class="btn btn-b" onclick="exportInscripciones()" style="text-align:left;padding:14px">inscripciones.json (${ST.inscripciones.length} entradas)</button>
        <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-family:Oswald;letter-spacing:1px">BASE DE DATOS HISTÓRICA</div>
          <button class="btn btn-w" id="btnExportExcel" onclick="exportDataExcel()" style="text-align:left;padding:14px;width:100%">Descargar data.json como Excel (${ST.data.length} atletas)</button>
          <p style="font-size:10px;color:var(--muted);margin-top:6px">Incluye: base de atletas · histórico de competencias · records por categoría</p>
        </div>
        <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-family:Oswald;letter-spacing:1px">MANTENIMIENTO DE STORAGE</div>
          <button id="btnMigrarWebP" class="btn" onclick="migrarFotosWebP(this)" style="text-align:left;padding:14px;width:100%;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.4);color:#c084fc">Convertir fotos de atletas a WebP (reduce peso hasta 70%)</button>
          <p style="font-size:10px;color:var(--muted);margin-top:6px">Convierte las fotos ya subidas en Firebase Storage al formato WebP (atleta_fotos, logos). No cierre la página mientras se ejecuta.</p>
          <button id="btnMigrarDocsWebP" class="btn" onclick="migrarDocsInscripcionWebP(this)" style="text-align:left;padding:14px;width:100%;margin-top:8px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.3);color:#c084fc">Convertir documentos de inscripciones a WebP</button>
          <p style="font-size:10px;color:var(--muted);margin-top:6px">Convierte las fotos de carnet, foto fondo blanco, etc. ya subidas por atletas. PDFs se omiten. Puede tardar varios minutos.</p>
        </div>
      </div>
      <p style="color:var(--muted);font-size:11px;margin-top:14px">Los archivos descargados incluyen las ediciones de admin aplicadas.</p>
    </div>`;
}

function renderAudit(){
  return `
    <div class="h1">Audit Log</div>
    <p class="subtitle">Historial inmutable de acciones (últimas 100)</p>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="tbl">
        <tr><th>Hora</th><th>Usuario</th><th>Acción</th><th>Target</th><th>Cambio</th></tr>
        ${ST.auditLog.map(l=>{
          const d=new Date(l.ts);
          return `<tr>
            <td style="font-size:10px;color:var(--muted);white-space:nowrap">${d.toLocaleString('es-CL')}</td>
            <td style="font-size:11px">${l.user||''}</td>
            <td><span class="tag b-b">${l.action}</span></td>
            <td style="font-size:11px">${l.target||''}<br><span style="color:var(--muted);font-size:10px">${l.nombre||''}</span></td>
            <td style="font-size:10px"><span style="color:var(--red)">${l.oldValue||''}</span> → <span style="color:var(--green)">${l.newValue||''}</span></td>
          </tr>`;
        }).join('')}
      </table>
      ${ST.auditLog.length===0?'<div class="empty">Sin registros</div>':''}
    </div>`;
}

window.searchDebounced=function(val){
  ST.search=val;
  if(_searchTimer)clearTimeout(_searchTimer);
  _searchTimer=setTimeout(()=>{
    // SOLO la tabla. Antes acá se llamaba a render(), que rehace la pantalla
    // entera —el buscador incluido—: en el teléfono el teclado se cerraba y se
    // abría con cada letra. Devolver el foco por programa no alcanzaba, porque
    // el campo ya había sido destruido. No tocando el campo, no hay nada que
    // devolver.
    const cont=document.getElementById('atlTabla');
    if(cont)cont.innerHTML=_atletasTablaHtml();
    else render();   // por si se llama desde otra pantalla
  },250);
}

// Las letras del costado filtran la misma tabla, así que tampoco necesitan
// redibujar la pantalla entera.
window.atlLetra=function(l){
  ST.filterLetter=l;
  const cont=document.getElementById('atlTabla');
  if(cont)cont.innerHTML=_atletasTablaHtml(); else render();
}

// ── Exportar Nómina del evento seleccionado como Excel filtrable y con estilo ──
// Columnas: Nombre, Modalidad, División, Categoría, Club. Disponible para
// CUALQUIER rol admin (la vista Nóminas no está restringida a owner).
// Estilo (pedido por el owner): negrita + tamaño 12, bordes finos en todas las
// celdas, header azul-gris (#D6DCE4), datos gris claro (#EDEDED), header
// congelado y AutoFilter. Usamos ExcelJS porque SheetJS community NO escribe
// estilos (colores/bordes/negrita).
window.exportNominaExcel = async function(){
  const btn=document.getElementById('btnExportNomina');
  const ev=ST.filterEv;
  if(!ev){ showToast('Selecciona un campeonato primero',null,true); return; }
  if(btn){ btn.textContent='Generando...'; btn.disabled=true; }
  try{
    if(!window.ExcelJS){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
    }
    const ExcelJS=window.ExcelJS;
    // Mismos datos que muestra la nómina del evento seleccionado.
    let list=(ST.inscripciones||[]).filter(i=>i.evento===ev&&i.status!=='rejected');
    // Columna "Pos. Nacional 2026" solo si el evento activó esa pregunta (Sudamericano).
    const posNacOn = !!(ST.eventos||[]).find(e=>e.id===ev)?.posNac2026;

    // ── GL lookup desde competition_results ──────────────────────────────────
    const _normRutXL=s=>String(s||'').replace(/[^0-9kK]/g,'').toUpperCase();
    const _normNmXL=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
    // Identificar eventos Nacional y Universitario por nombre (para priorizar, no para filtrar)
    const _xlEvNat=new Set((ST.eventos||[]).filter(e=>/nacional/i.test(e.name||'')&&!/universitario/i.test(e.name||'')).map(e=>e.id));
    const _xlEvUni=new Set((ST.eventos||[]).filter(e=>/universitario/i.test(e.name||'')).map(e=>e.id));
    // Clasificar el tipo de cada resultado según modalidad/división/view
    const _xlTabType=r=>{const m=String(r.modalidad||'').toLowerCase();const isOE=/olimpiadas|\boe\b/.test(m);const isEq=/equipado|equipped/.test(m);const isBench=/only.?bench/.test(m)||r.view==='bench';const isUni=/universitario/.test(String(r.division||'').toLowerCase())||/universitario/.test(m);if(isUni&&!isBench&&!isOE)return'uni';if(isOE)return'oe';if(isBench)return isEq?'bench_eq':'bench_cl';return isEq?'eq':'cl';};
    const _xlTabFor={classic:['cl','bench_cl'],equipado:['eq','bench_eq'],oe:['oe'],universitario:['uni']};
    // Construir mapa RUT/nombre/codigo → [{gl, tab, evId, isNat, isUni}] — TODOS los eventos
    const _xlByRut={},_xlByNm={},_xlByCod={};
    (ST.allCompResults||[]).forEach(r=>{
      const gl=parseFloat(r.resultado?.glp||r.resultado?.gl||0);if(gl<=0)return;
      const evId=r.evento_id||r.evento||''; // evento_id es el ID; evento es el nombre
      const e={gl,tab:_xlTabType(r),evId,isNat:_xlEvNat.has(evId),isUni:_xlEvUni.has(evId)};
      const rut=_normRutXL(r.rut||'');const nm=_normNmXL(r.nombre||'');const cod=String(r.codigo||'').trim();
      if(rut){if(!_xlByRut[rut])_xlByRut[rut]=[];_xlByRut[rut].push(e);}
      if(nm){if(!_xlByNm[nm])_xlByNm[nm]=[];_xlByNm[nm].push(e);}
      if(cod){if(!_xlByCod[cod])_xlByCod[cod]=[];_xlByCod[cod].push(e);}
    });
    // Mapa RUT→codigo desde ST.data (perfiles de atletas)
    const _xlRutToCod={};
    (ST.data||[]).forEach(a=>{const rut=_normRutXL(a.rut||'');const cod=String(a.codigo||'').trim();if(rut&&cod)_xlRutToCod[rut]=cod;});
    // Fallback: GL desde data.json (competencias del Nacional FECHIPO 2026)
    const _xlTabFromModal=m=>{const ml=String(m||'').toLowerCase();const isUni=/universitario/.test(ml);const isEq=/equipado|equipped/.test(ml);const isBench=/only.?bench/.test(ml);const isOE=/olimp|special olympic|\boe\b/.test(ml);if(isUni)return'uni';if(isOE)return'oe';if(isBench)return isEq?'bench_eq':'bench_cl';if(isEq)return'eq';return'cl';};
    const _xlDataByCod={},_xlDataByRut={};
    (ST.data||[]).forEach(a=>{
      const cod=String(a.codigo||'').trim();const rut=_normRutXL(a.rut||'');
      (a.competencias||[]).forEach(c=>{
        const gl=parseFloat(c.resultado?.glp||0);if(gl<=0)return;
        const ev=String(c.evento||'');
        const isNat=/nacional.*fechipo.*2026|campeonato nacional fechipo 2026/i.test(ev)&&!/universitario/i.test(ev);
        const isUni=/universitario/i.test(ev)&&/2026/i.test(ev);
        if(!isNat&&!isUni)return;
        const e={gl,tab:_xlTabFromModal(c.modalidad),isNat,isUni};
        if(cod){if(!_xlDataByCod[cod])_xlDataByCod[cod]=[];_xlDataByCod[cod].push(e);}
        if(rut){if(!_xlDataByRut[rut])_xlDataByRut[rut]=[];_xlDataByRut[rut].push(e);}
      });
    });
    const _getGLXL=i=>{
      const isUniDiv=/universitario/i.test(String(i.division||''));
      const mKey=String(i.posNacMod||'').toLowerCase().trim();
      const tabs=_xlTabFor[mKey]||(isUniDiv?['uni']:['cl']);
      const rut=_normRutXL(i.rut||'');const nm=_normNmXL(i.nombre||'');
      const cod=String(i.codigo||'').trim()||_xlRutToCod[rut]||'';
      // 1° intento: competition_results (Firestore) — RUT → nombre → codigo
      const pool=(rut&&_xlByRut[rut])||(nm&&_xlByNm[nm])||(cod&&_xlByCod[cod])||[];
      const natF=r=>isUniDiv?r.isUni:r.isNat;
      if(pool.length){
        for(const tab of tabs){const h=pool.filter(r=>natF(r)&&r.tab===tab);if(h.length)return Math.max(...h.map(r=>r.gl)).toFixed(2);}
        const p2=pool.filter(r=>natF(r));if(p2.length)return Math.max(...p2.map(r=>r.gl)).toFixed(2);
        for(const tab of tabs){const h=pool.filter(r=>r.tab===tab);if(h.length)return Math.max(...h.map(r=>r.gl)).toFixed(2);}
        return Math.max(...pool.map(r=>r.gl)).toFixed(2);
      }
      // 2° intento: data.json competencias Nacional 2026 — codigo → RUT
      const pool2=(cod&&_xlDataByCod[cod])||(rut&&_xlDataByRut[rut])||[];
      if(!pool2.length)return'';
      for(const tab of tabs){const h=pool2.filter(r=>natF(r)&&r.tab===tab);if(h.length)return Math.max(...h.map(r=>r.gl)).toFixed(2);}
      const p3=pool2.filter(r=>natF(r));if(p3.length)return Math.max(...p3.map(r=>r.gl)).toFixed(2);
      return'';
    };

    // ── Ordenar: Mujer→Hombre, Sub Junior→Junior→Open→Master 1→Master 2→Universitario, cat asc ──
    const _xlDivOrd={'sub junior':0,'sub-junior':0,'junior':1,'open':2,'master i':3,'master 1':3,'master ii':4,'master 2':4,'master iii':5,'master 3':5,'universitario':6,'universitaria':6};
    const _xlGetDiv=s=>{const sl=String(s||'').toLowerCase().trim();for(const[k,v]of Object.entries(_xlDivOrd))if(sl===k||sl.startsWith(k))return v;return 7;};
    const _xlGetCat=s=>{const n=parseFloat(String(s||'').replace(/[^0-9.]/g,''));return isNaN(n)?999:(String(s||'').includes('+')?n+0.5:n);};
    const _xlGetSex=s=>/mujer|femeni/i.test(String(s||''))?0:1;
    list.sort((a,b)=>{const sx=_xlGetSex(a.sexo)-_xlGetSex(b.sexo);if(sx!==0)return sx;const dv=_xlGetDiv(a.division)-_xlGetDiv(b.division);if(dv!==0)return dv;return _xlGetCat(a.categoria)-_xlGetCat(b.categoria);});
    // Universidad cruzada por RUT/nombre desde cualquier inscripción que la tenga (ej. nómina del Nacional Universitario).
    const _xNN=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
    const _xNR=s=>String(s||'').replace(/[^0-9kK]/g,'').toLowerCase();
    const _xByRut={}, _xByName={};
    (ST.inscripciones||[]).forEach(x=>{ if(!x.universidad)return; if(x.rut)_xByRut[_xNR(x.rut)]=x.universidad; if(x.nombre)_xByName[_xNN(x.nombre)]=x.universidad; });
    const _xResolveUni=i=> i.universidad || _xByRut[_xNR(i.rut)] || _xByName[_xNN(i.nombre)] || '';
    // Columna "Universidad": si el evento la configuró, si algún inscrito la trae (directa o cruzada), o si hay división Universitario.
    const uniOn = (((ST.eventos||[]).find(e=>e.id===ev||e.name===ev)?.extraCols)||[]).includes('universidad') || list.some(i=>_xResolveUni(i)) || list.some(i=>/universitar/i.test(String(i.division||'')+' '+String(i.modalidad||'')));

    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('Nómina',{views:[{state:'frozen',ySplit:1}]});
    ws.columns=[
      {header:'NOMBRE',    key:'nombre',    width:34.8},
      {header:'SEXO',      key:'sexo',      width:10},
      {header:'MODALIDAD', key:'modalidad', width:34.5},
      {header:'DIVISIÓN',  key:'division',  width:16.8},
      {header:'CATEGORÍA', key:'categoria', width:12.8},
      {header:'CLUB',      key:'club',      width:26.8},
      {header:'RUT',       key:'rut',       width:15},
      {header:'FECHA DE NACIMIENTO', key:'fechaNac', width:20},
      {header:'CORREO', key:'correo', width:30},
      ...(uniOn ? [{header:'UNIVERSIDAD', key:'universidad', width:30}] : []),
      ...(posNacOn ? [
        {header:'POS. NACIONAL 2026', key:'posNac', width:22},
        {header:'SQ NAC.', key:'posNacSQ', width:10},
        {header:'BP NAC.', key:'posNacBP', width:10},
        {header:'DL NAC.', key:'posNacDL', width:10},
        {header:'TOTAL NAC.', key:'posNacTotal', width:12},
        {header:'GL POINTS NAC.', key:'glNac', width:14},
        {header:'CLASIFICACIÓN SUDAMERICANO', key:'clasifSud', width:26}
      ] : [])
    ];
    // fechaNac llega como ISO (AAAA-MM-DD); se muestra DD/MM/AAAA (formato chileno).
    const fmtFN=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?`${m[3]}/${m[2]}/${m[1]}`:(s||'');};
    list.forEach(i=>{
      // Si eligió "Otro", el nombre real del club está en clubOtro.
      const club=i.club==='Otro'?(i.clubOtro||'Otro'):(i.club||'');
      const priv=(ST.inscripcionesPrivate||{})[i.id]||{};
      const posNacVal = i.posNacLugar ? (i.posNacMod ? i.posNacMod+' · '+i.posNacLugar+'°' : i.posNacLugar+'°') : '';
      ws.addRow({nombre:i.nombre||'',sexo:i.sexo||'',modalidad:i.modalidad||'',division:i.division||'',categoria:i.categoria||'',club,
        rut:i.rut||'',fechaNac:fmtFN(i.fechaNac||i.fechanac),correo:priv.correo||'',universidad:_xResolveUni(i),
        ...(posNacOn ? {posNac:posNacVal,posNacSQ:i.posNacSQ||'',posNacBP:i.posNacBP||'',posNacDL:i.posNacDL||'',posNacTotal:(i.posNacTotal||(((parseFloat(i.posNacSQ)||0)+(parseFloat(i.posNacBP)||0)+(parseFloat(i.posNacDL)||0))||'')),glNac:(()=>{const p=parseInt(i.posNacLugar)||0;return(p===2||p===3)?_getGLXL(i):'';})(),clasifSud:(parseInt(i.posNacLugar)||0)===1?'CLASIFICADO':(parseInt(i.posNacLugar)||0)===2||(parseInt(i.posNacLugar)||0)===3?'LISTA DE ESPERA':''} : {})});
    });

    const thin={style:'thin',color:{argb:'FF000000'}};
    const allBorders={top:thin,left:thin,bottom:thin,right:thin};
    const headerFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD6DCE4'}};
    const dataFill  ={type:'pattern',pattern:'solid',fgColor:{argb:'FFEDEDED'}};
    ws.eachRow({includeEmpty:false},(row,rn)=>{
      row.eachCell({includeEmpty:true},cell=>{
        cell.font={name:'Calibri',size:12,bold:true,color:{argb:'FF000000'}};
        cell.border=allBorders;
        cell.fill=(rn===1)?headerFill:dataFill;
        cell.alignment={vertical:'middle'};
      });
    });
    ws.autoFilter='A1:'+String.fromCharCode(64+ws.columns.length)+ws.rowCount;   // filtros en todas las columnas

    const buf=await wb.xlsx.writeBuffer();
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const safe=String(ev).replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,60).trim()||'evento';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`Nomina_${safe}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
    showToast(`Excel exportado: ${list.length} atletas`);
  }catch(e){ console.error(e); showToast('Error al exportar: '+e.message,null,true); }
  finally{ if(btn){ btn.textContent='Exportar Excel'; btn.disabled=false; } }
};

// ── Descargar todos los documentos del evento como ZIP ────────────────────────
// Una carpeta por atleta (con su nombre) y adentro sus documentos subidos.
window.exportNominaDocsZip = async function(){
  const btn=document.getElementById('btnExportDocs');
  const ev=ST.filterEv;
  if(!ev){ showToast('Selecciona un campeonato primero',null,true); return; }
  const list=(ST.inscripciones||[]).filter(i=>i.evento===ev && i.status!=='rejected');
  if(!list.length){ showToast('No hay inscripciones en este campeonato',null,true); return; }
  if(btn){ btn.textContent='Preparando...'; btn.disabled=true; }
  try{
    if(!window.JSZip){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
    }
    const LEGACY_MAP={carnetURL:'Carnet de Identidad',wadeURL:'ADEL-WADA',carnetPhotoURL:'Foto fondo blanco',consentimientoURL:'Consentimiento Menor',passportURL:'Pasaporte',ipfConsentURL:'Consentimiento IPF',notasURL:'Concentracion de Notas'};
    const NEW_MAP=window.DOC_TYPES_CATALOG||{};
    const MIME_EXT={'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','application/pdf':'pdf'};
    const safe=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'atleta';
    // Recolectar docs por atleta (mismo criterio que viewInsDocs: nuevos + legacy)
    const tasks=[];
    list.forEach(i=>{
      const priv=ST.inscripcionesPrivate?.[i.id]||{};
      const docs=[];
      if(priv.docs && typeof priv.docs==='object') Object.entries(priv.docs).forEach(([k,url])=>{ if(url) docs.push({label:(NEW_MAP[k]?.label||k), url}); });
      Object.entries(LEGACY_MAP).forEach(([field,label])=>{ const url=priv[field]; if(url && !docs.some(d=>d.url===url)) docs.push({label, url}); });
      if(docs.length) tasks.push({nombre:i.nombre||i.rut||i.id, docs});
    });
    const totDocs=tasks.reduce((n,t)=>n+t.docs.length,0);
    if(!totDocs){ showToast('No hay documentos subidos en este campeonato',null,true); if(btn){btn.textContent='Descargar Docs (ZIP)';btn.disabled=false;} return; }
    const zip=new JSZip();
    let ok=0, fail=0, done=0;
    for(const t of tasks){
      const folder=zip.folder(safe(t.nombre));
      const used={};
      for(const d of t.docs){
        try{
          const resp=await fetch(d.url); if(!resp.ok) throw new Error('HTTP '+resp.status);
          const blob=await resp.blob();
          const ext=MIME_EXT[blob.type] || (String(blob.type||'').split('/')[1]||'bin');
          let base=safe(d.label); used[base]=(used[base]||0)+1; if(used[base]>1) base+=' '+used[base];
          folder.file(base+'.'+ext, blob); ok++;
        }catch(e){ fail++; console.warn('[docs zip]',t.nombre,d.label,e.message); }
        done++; if(btn) btn.textContent='Descargando '+done+'/'+totDocs;
      }
    }
    if(!ok){ showToast('No se pudo descargar ningún documento (revisa permisos/CORS)',null,true); return; }
    if(btn) btn.textContent='Comprimiendo...';
    const content=await zip.generateAsync({type:'blob'});
    const safeEv=String(ev).replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,60).trim()||'evento';
    const a=document.createElement('a'); a.href=URL.createObjectURL(content); a.download='Documentos_'+safeEv+'.zip';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
    showToast('ZIP listo: '+ok+' documentos'+(fail?' · '+fail+' fallaron':''));
  }catch(e){ console.error(e); showToast('Error: '+e.message,null,true); }
  finally{ if(btn){ btn.textContent='Descargar Docs (ZIP)'; btn.disabled=false; } }
};

// Convierte cualquier imagen (WebP/PNG/GIF/JPEG) a JPG de alta calidad, con
// fondo blanco (JPEG no soporta transparencia). Mantiene la resolución original.
// Se usa en la descarga de fotos: las plataformas externas (IPF/goodlift) piden
// JPG y nuestras fotos se guardan en WebP para ahorrar espacio.
async function _blobToJpg(blob){
  return new Promise((res)=>{
    if(blob.type==='image/jpeg'||blob.type==='image/jpg'){res(blob);return;}
    const img=new Image(), u=URL.createObjectURL(blob);
    img.onload=()=>{
      URL.revokeObjectURL(u);
      try{
        const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
        const ctx=c.getContext('2d');
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,c.width,c.height); // fondo blanco
        ctx.drawImage(img,0,0);
        c.toBlob(b=>res(b||blob),'image/jpeg',0.95);
      }catch(e){res(blob);}
    };
    img.onerror=()=>{URL.revokeObjectURL(u);res(blob);};
    img.src=u;
  });
}

// ── Descargar fotos de atletas de una nómina en ZIP (siempre en JPG) ──────────
window.exportNominaFotosZip = async function(){
  const btn=document.getElementById('btnExportFotos');
  const ev=ST.filterEv;
  if(!ev){ showToast('Selecciona un campeonato primero',null,true); return; }
  const list=(ST.inscripciones||[]).filter(i=>i.evento===ev&&i.status!=='rejected');
  if(!list.length){ showToast('No hay inscripciones en este campeonato',null,true); return; }
  if(btn){ btn.textContent='Preparando...'; btn.disabled=true; }
  try{
    if(!window.JSZip){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
    }
    const rutNorm=s=>String(s||'').replace(/[^0-9kK]/gi,'').toUpperCase();
    const safe=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'atleta';
    const MIME_EXT={'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};

    // Construir lista de atletas con foto_url: primero busca en fotosByCodigo,
    // luego en ST.data por RUT como fallback.
    const tasks=[];
    const seen=new Set();
    for(const i of list){
      if(seen.has(i.id)) continue; seen.add(i.id);
      // Buscar atleta en ST.data por RUT o por codigo
      const rutI=rutNorm(i.rut);
      const ath=(ST.data||[]).find(a=>(i.codigo&&a.codigo===i.codigo)||(rutI&&rutNorm(a.rut)===rutI));
      const codigo=ath?.codigo||i.codigo||null;
      const fotoDoc=codigo?(ST.fotosByCodigo||{})[codigo]:null;
      const fotoUrl=fotoDoc?.foto_url||(ath?.foto_url||null);
      tasks.push({nombre:i.nombre||i.rut||i.id, fotoUrl});
    }

    const conFoto=tasks.filter(t=>t.fotoUrl);
    const sinFoto=tasks.filter(t=>!t.fotoUrl);
    if(!conFoto.length){
      showToast('Ningún atleta de esta nómina tiene foto subida',null,true);
      if(btn){ btn.textContent='Descargar Fotos (ZIP)'; btn.disabled=false; }
      return;
    }

    const zip=new JSZip();
    let ok=0, fail=0, done=0;
    for(const t of conFoto){
      try{
        const resp=await fetch(t.fotoUrl); if(!resp.ok) throw new Error('HTTP '+resp.status);
        const blob=await resp.blob();
        // Entregar SIEMPRE en JPG (lo piden las plataformas externas); si la
        // conversión falla, cae al formato original para no perder la foto.
        const jpg=await _blobToJpg(blob);
        const isJpg=jpg&&(jpg.type==='image/jpeg'||jpg.type==='image/jpg');
        const ext=isJpg?'jpg':(MIME_EXT[blob.type]||'png');
        zip.file(safe(t.nombre)+'.'+ext, isJpg?jpg:blob); ok++;
      }catch(e){ fail++; console.warn('[fotos zip]',t.nombre,e.message); }
      done++; if(btn) btn.textContent='Descargando '+done+'/'+conFoto.length;
    }

    if(!ok){ showToast('No se pudo descargar ninguna foto (revisa permisos/CORS)',null,true); return; }
    if(btn) btn.textContent='Comprimiendo...';
    const content=await zip.generateAsync({type:'blob'});
    const safeEv=String(ev).replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,60).trim()||'evento';
    const a=document.createElement('a'); a.href=URL.createObjectURL(content); a.download='Fotos_'+safeEv+'.zip';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
    const msg='ZIP listo: '+ok+' fotos'+(fail?' · '+fail+' fallaron':'')+(sinFoto.length?' · '+sinFoto.length+' sin foto':'');
    showToast(msg);
  }catch(e){ console.error(e); showToast('Error: '+e.message,null,true); }
  finally{ if(btn){ btn.textContent='Descargar Fotos (ZIP)'; btn.disabled=false; } }
};

// ── Paquete Internacional (ZIP) ────────────────────────────────────────────────
// Para envíos a la federación internacional (ej. Sudamericano): una carpeta por
// atleta con EXACTAMENTE 3 archivos — foto fondo blanco (JPEG garantizado, se
// convierte si hace falta), Consentimiento IPF (PDF) y WADA (PDF). No incluye
// carnet/pasaporte/notas/etc. (para eso está "Descargar Docs (ZIP)").
//
// La foto SOLO se toma si pasó por el procesamiento real de fondo blanco (tarjeta
// "Fotos Atletas" → guardarFotoAtleta). Si se confirmó "tal cual" desde el bulk
// (source:'bulk_import_inscripcion'), NO se considera fondo blanco válido — se
// marca como faltante para que el admin la procese antes de enviar el paquete.
//
// Al terminar, si falta algo, se agrega un _INCOMPLETOS.txt dentro del ZIP
// listando exactamente qué le falta a cada atleta.
async function _toJpegBlob(blob){
  if(blob.type==='image/jpeg'||blob.type==='image/jpg')return blob;
  return new Promise(res=>{
    const img=new Image(), u=URL.createObjectURL(blob);
    img.onload=()=>{
      URL.revokeObjectURL(u);
      const maxPx=2000;
      let w=img.width,h=img.height;
      if(w>maxPx||h>maxPx){ if(w>h){h=Math.round(h*maxPx/w);w=maxPx;} else {w=Math.round(w*maxPx/h);h=maxPx;} }
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); // por si el original tenía transparencia (PNG)
      ctx.drawImage(img,0,0,w,h);
      c.toBlob(b=>res(b||blob),'image/jpeg',0.92);
    };
    img.onerror=()=>res(blob);
    img.src=u;
  });
}

window.exportPaqueteInternacionalZip = async function(){
  const btn=document.getElementById('btnExportPaquete');
  const ev=ST.filterEv;
  if(!ev){ showToast('Selecciona un campeonato primero',null,true); return; }
  const list=(ST.inscripciones||[]).filter(i=>i.evento===ev && i.status!=='rejected');
  if(!list.length){ showToast('No hay inscripciones en este campeonato',null,true); return; }
  if(btn){ btn.textContent='Preparando...'; btn.disabled=true; }
  try{
    if(!window.JSZip){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
    }
    const rutNorm=s=>String(s||'').replace(/[^0-9kK]/gi,'').toUpperCase();
    const safe=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'atleta';
    const zip=new JSZip();
    const incompletos=[];
    let done=0;
    for(const i of list){
      done++;
      if(btn)btn.textContent='Armando '+done+'/'+list.length;
      const priv=ST.inscripcionesPrivate?.[i.id]||{};
      const rutI=rutNorm(i.rut);
      const ath=(ST.data||[]).find(a=>(i.codigo&&a.codigo===i.codigo)||(rutI&&rutNorm(a.rut)===rutI));
      const codigo=ath?.codigo||i.codigo||null;
      const fotoDoc=codigo?(ST.fotosByCodigo||{})[codigo]:null;
      const nombre=i.nombre||i.rut||i.id;
      const folder=zip.folder(safe(nombre));
      const missing=[];

      // 1) Foto fondo blanco — solo si pasó por procesamiento real (no "tal cual")
      const fotoOk=fotoDoc && fotoDoc.foto_url && fotoDoc.source!=='bulk_import_inscripcion';
      if(fotoOk){
        try{
          const resp=await fetch(fotoDoc.foto_url); if(!resp.ok)throw new Error('HTTP '+resp.status);
          const blob=await _toJpegBlob(await resp.blob());
          folder.file('Foto_fondo_blanco.jpg', blob);
        }catch(e){ missing.push('foto (error al descargar: '+e.message+')'); }
      } else if(fotoDoc && fotoDoc.foto_url){
        missing.push('foto fondo blanco (está subida "tal cual" — procesarla en Fotos Atletas)');
      } else {
        missing.push('foto fondo blanco (no subida/publicada)');
      }

      // 2) Consentimiento IPF (PDF)
      const ipfUrl=priv.docs?.ipfConsent || priv.ipfConsentURL || null;
      if(ipfUrl){
        try{
          const resp=await fetch(ipfUrl); if(!resp.ok)throw new Error('HTTP '+resp.status);
          folder.file('Consentimiento_IPF.pdf', await resp.blob());
        }catch(e){ missing.push('Consentimiento IPF (error al descargar: '+e.message+')'); }
      } else {
        missing.push('Consentimiento IPF');
      }

      // 3) WADA (PDF)
      const wadaUrl=priv.docs?.wadaIntl || priv.wadeURL || null;
      if(wadaUrl){
        try{
          const resp=await fetch(wadaUrl); if(!resp.ok)throw new Error('HTTP '+resp.status);
          folder.file('WADA.pdf', await resp.blob());
        }catch(e){ missing.push('WADA (error al descargar: '+e.message+')'); }
      } else {
        missing.push('WADA');
      }

      if(missing.length) incompletos.push(nombre+': falta '+missing.join('; '));
    }

    if(incompletos.length){
      zip.file('_INCOMPLETOS.txt', 'Atletas con documentos faltantes para el paquete internacional:\n\n'+incompletos.join('\n'));
    }

    if(btn)btn.textContent='Comprimiendo...';
    const content=await zip.generateAsync({type:'blob'});
    const safeEv=String(ev).replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,60).trim()||'evento';
    const a=document.createElement('a'); a.href=URL.createObjectURL(content); a.download='Paquete_Internacional_'+safeEv+'.zip';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
    const completos=list.length-incompletos.length;
    showToast(incompletos.length
      ? (completos+'/'+list.length+' atletas completos — revisa _INCOMPLETOS.txt dentro del ZIP')
      : ('Paquete completo: '+list.length+' atletas con foto + IPF + WADA'));
  }catch(e){ console.error(e); showToast('Error: '+e.message,null,true); }
  finally{ if(btn){ btn.textContent='Paquete Internacional (ZIP)'; btn.disabled=false; } }
};

// ── Exportar data.json como Excel ─────────────────────────────────────────────
window.exportDataExcel = async function(){
  const btn = document.getElementById('btnExportExcel');
  if(btn){ btn.textContent='Generando Excel...'; btn.disabled=true; }
  try{
    // Load SheetJS dynamically
    if(!window.XLSX){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        s.onload=res; s.onerror=rej;
        document.head.appendChild(s);
      });
    }
    const XLSX=window.XLSX;
    const data=ST.data||[];
    const wb=XLSX.utils.book_new();

    // ── Hoja 1: Base de Atletas ───────────────────────────────────────────────
    const athRows=[['CÓDIGO','RUT','NOMBRE COMPLETO','FECHA NAC.','CLUB','AÑO DEBUT',
      'MEJOR SQ','MEJOR BP','MEJOR DL','TOTAL','GLP','DOTS','Nº COMPETENCIAS']];
    [...data].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).forEach(a=>{
      const bl=a.bestLifts||{};
      athRows.push([a.codigo||'',a.rut||'',a.nombre||'',a.fechaNac||'',a.club||'',a.debut||'',
        bl.sq||'',bl.bp||'',bl.dl||'',bl.total||'',bl.glp||'',bl.dots||'',
        (a.competencias||[]).length]);
    });
    const wsAth=XLSX.utils.aoa_to_sheet(athRows);
    wsAth['!cols']=[{wch:16},{wch:13},{wch:32},{wch:12},{wch:24},{wch:11},{wch:10},{wch:10},{wch:10},{wch:8},{wch:8},{wch:8},{wch:14}];
    XLSX.utils.book_append_sheet(wb,wsAth,'Base Atletas');

    // ── Hoja 2: Histórico Competencias ────────────────────────────────────────
    const histRows=[['NOMBRE','RUT','CLUB','EVENTO','AÑO','FECHA','LUGAR','SEXO','CATEGORÍA','DIVISIÓN','MODALIDAD','BW','SQ','BP','DL','TOTAL','GLP','FUENTE']];
    data.forEach(a=>{
      (a.competencias||[]).forEach(c=>{
        const r=c.resultado||{};
        histRows.push([a.nombre||'',a.rut||'',a.club||'',
          c.evento||'',c.año||'',c.fecha||'',c.lugar||'',
          c.sexo||'',c.categoria||'',c.division||'',c.modalidad||'',
          r.bw||'',r.sq||'',r.bp||'',r.dl||'',r.total||'',r.glp||'',
          c.source||'']);
      });
    });
    const wsHist=XLSX.utils.aoa_to_sheet(histRows);
    wsHist['!cols']=[{wch:30},{wch:13},{wch:22},{wch:52},{wch:6},{wch:12},{wch:22},{wch:7},{wch:10},{wch:14},{wch:12},{wch:7},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:16}];
    XLSX.utils.book_append_sheet(wb,wsHist,'Histórico');

    // ── Hoja 3: Resumen por Evento ────────────────────────────────────────────
    const evMap={};
    data.forEach(a=>(a.competencias||[]).forEach(c=>{
      const k=c.evento||'Sin nombre';
      if(!evMap[k])evMap[k]={año:c.año,count:0};
      evMap[k].count++;
    }));
    const evRows=[['EVENTO','AÑO','N° PARTICIPACIONES']];
    Object.entries(evMap).sort((a,b)=>(a[1].año||0)-(b[1].año||0))
      .forEach(([ev,v])=>evRows.push([ev,v.año||'',v.count]));
    const wsEv=XLSX.utils.aoa_to_sheet(evRows);
    wsEv['!cols']=[{wch:55},{wch:6},{wch:18}];
    XLSX.utils.book_append_sheet(wb,wsEv,'Eventos');

    // ── Hoja 4: Records por Categoría ─────────────────────────────────────────
    const recMap={};
    data.forEach(a=>{
      (a.competencias||[]).forEach(c=>{
        const r=c.resultado||{};
        if(!r.total||r.total<=0)return;
        const key=`${c.sexo}||${c.categoria}||${c.modalidad}`;
        if(!recMap[key]||r.total>recMap[key].total)
          recMap[key]={sexo:c.sexo,cat:c.categoria,mod:c.modalidad,nombre:a.nombre,club:a.club,
            sq:r.sq||0,bp:r.bp||0,dl:r.dl||0,total:r.total,bw:r.bw||0,glp:r.glp||0,evento:c.evento,fecha:c.fecha};
      });
    });
    const recRows=[['SEXO','CATEGORÍA','MODALIDAD','ATLETA','CLUB','SQ','BP','DL','TOTAL','BW','GLP','EVENTO','FECHA']];
    Object.values(recMap).sort((a,b)=>(a.sexo||'').localeCompare(b.sexo||'')||(parseFloat(a.cat)||999)-(parseFloat(b.cat)||999))
      .forEach(r=>recRows.push([r.sexo,r.cat,r.mod,r.nombre,r.club,r.sq||'',r.bp||'',r.dl||'',r.total,r.bw||'',r.glp||'',r.evento,r.fecha||'']));
    const wsRec=XLSX.utils.aoa_to_sheet(recRows);
    wsRec['!cols']=[{wch:8},{wch:10},{wch:20},{wch:30},{wch:22},{wch:7},{wch:7},{wch:7},{wch:8},{wch:7},{wch:7},{wch:52},{wch:12}];
    XLSX.utils.book_append_sheet(wb,wsRec,'Records por Categoría');

    // ── Descargar ─────────────────────────────────────────────────────────────
    const today=new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb,`FECHIPO_base_datos_${today}.xlsx`);
  }catch(e){
    alert('Error generando Excel: '+e.message);
    console.error(e);
  }finally{
    if(btn){ btn.textContent=`Descargar data.json como Excel (${ST.data.length} atletas)`; btn.disabled=false; }
  }
};

window.render=render;

// ── Ranking en Excel ─────────────────────────────────────────────────────────
// Sale de ranking.html, abierto por dentro en un marco oculto, con su propio
// cálculo (rkGrupos): alias de nombres, división del año, banca contada como
// banca, resultados recién publicados y un atleta por grupo. Si el Excel se
// armara acá con otra cuenta, tarde o temprano no calzaría con lo publicado.
function _rkAbrirRanking(){
  return new Promise((res,rej)=>{
    const f=document.createElement('iframe');
    f.style.cssText='position:fixed;left:-9999px;top:0;width:1200px;height:800px;border:0;visibility:hidden';
    f.src='ranking.html?exportar=1';
    let listo=false;
    const fin=(ok,err)=>{ if(listo)return; listo=true; clearInterval(t); ok?res(f):(f.remove(),rej(err)); };
    const desde=Date.now();
    // Espera a que estén los resultados de Firestore (hasta 25 s).
    const t=setInterval(()=>{
      try{
        const w=f.contentWindow;
        if(!w||typeof w.rkGrupos!=='function'||!w.D)return;
        if(w._rkResultados||Date.now()-desde>25000)fin(true);
      }catch(e){ fin(false,e); }
    },300);
    setTimeout(()=>fin(false,new Error('El ranking no cargó')),40000);
    document.body.appendChild(f);
  });
}

window.exportRankingExcel=async function(btn){
  const isOwner=ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap;
  if(!isOwner){ showToast('Solo el Owner puede exportar el ranking',null,true); return; }
  const txt=btn?btn.textContent:'';
  if(btn){ btn.textContent='Generando...'; btn.disabled=true; }
  let marco=null;
  try{
    if(!window.ExcelJS){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
    }
    marco=await _rkAbrirRanking();
    const w=marco.contentWindow;
    // Sin los resultados publicados el Excel saldría con el ranking a medias
    // (solo lo del archivo): mejor no bajar nada y decirlo.
    if(w._rkResultados!=='ok')throw new Error('no cargaron los resultados publicados de los campeonatos. Revisa la conexión y vuelve a intentar.');
    const anio=((w.document.getElementById('rkAnio')||{}).textContent||String(new Date().getFullYear())).trim();
    const wb=new window.ExcelJS.Workbook();
    wb.creator='YourLift';

    const thin={style:'thin',color:{argb:'FFBFBFBF'}};
    const borde={top:thin,left:thin,bottom:thin,right:thin};
    const relleno=c=>({type:'pattern',pattern:'solid',fgColor:{argb:c}});
    const PODIO={1:'FFFFE699',2:'FFE7E6E6',3:'FFF8CBAD'};
    const hoy=new Date().toLocaleDateString('es-CL');
    const resumen=[];
    // La hoja de inicio va primero; se llena al final, con lo que trae el archivo.
    const ri=wb.addWorksheet('Resumen');

    // De dónde salió cada marca y el año de nacimiento. Los resultados
    // publicados desde el livecast traen el campeonato (_ev); los del archivo
    // del ranking no, y se buscan en la base de atletas por nombre y marca.
    const _nn=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
    const _evIdx={}, _anIdx={};
    (ST.data||[]).forEach(a=>{
      const k=_nn(a.nombre);
      const an=parseInt(String(a.anioNac||a.fechaNac||'').match(/(19|20)\d{2}/)?.[0]||0,10);
      if(an&&!_anIdx[k])_anIdx[k]=an;
      (a.competencias||[]).forEach(c=>{
        const r=c.resultado||{}, f=String(c.fecha||'');
        const pon=(clave)=>{ const prev=_evIdx[clave]; if(!prev||f>prev.f)_evIdx[clave]={ev:c.evento||'',f}; };
        if(parseFloat(r.total)>0)pon(k+'|t|'+parseFloat(r.total));
        if(parseFloat(r.bp)>0)pon(k+'|bp|'+parseFloat(r.bp));
      });
    });
    // Si el nombre no calza exacto ("Yohan Pérez Coñuñir" / "Yohan Alejandro
    // Pérez Coñuñir"), el mismo criterio del ranking: todas las palabras del más
    // corto (al menos dos) están en el más largo, y apunta a UNA persona.
    const _nombres=Object.keys(_anIdx).concat(Object.keys(_evIdx).map(k=>k.split('|')[0]))
      .filter((x,i,arr)=>arr.indexOf(x)===i).map(x=>({k:x,t:x.split(' ')}));
    const _cacheNom={};
    const _nombreBase=n=>{
      const k=_nn(n); if(k in _cacheNom)return _cacheNom[k];
      const t=k.split(' ');
      const c=_nombres.filter(o=>{ const ch=o.t.length<=t.length?o.t:t, gr=o.t.length<=t.length?t:o.t;
        return ch.length>=2&&ch.every(p=>gr.indexOf(p)>=0); });
      return (_cacheNom[k]=c.length===1?c[0].k:k);
    };
    const campeonatoDe=(e,bench)=>{
      if(e._ev)return String(e._ev).replace(/\s*-\s*Tarima\s*\d+\s*$/i,'');
      const marca=bench?'|bp|'+parseFloat(e.bp):'|t|'+parseFloat(e.tt);
      const x=_evIdx[_nn(e.n)+marca]||_evIdx[_nombreBase(e.n)+marca];
      return x?x.ev:'';
    };
    const anioDe=e=>e.an||(typeof w._anioPorNombre==='function'?w._anioPorNombre(e.n):0)||_anIdx[_nn(e.n)]||_anIdx[_nombreBase(e.n)]||'';

    w.TABS.forEach(t=>{
      const rg=w.rkGrupos(t.id,'');
      if(!rg.grupos.length)return;
      const cols=rg.bench
        ?[['#',5],['ATLETA',36],['CLUB',28],['AÑO NAC.',10],['PESO CORP.',12],['BP',10],['GL POINTS',12],['CAMPEONATO',44]]
        :[['#',5],['ATLETA',36],['CLUB',28],['AÑO NAC.',10],['PESO CORP.',12],['SQ',10],['BP',10],['DL',10],['TOTAL',11],['GL POINTS',12],['CAMPEONATO',44]];
      // Los nombres de hoja de Excel: hasta 31 caracteres y sin / \ ? * [ ]
      const ws=wb.addWorksheet(t.lb.replace(/[\/\\?*\[\]:]/g,'').slice(0,31),{views:[{state:'frozen',ySplit:2}]});
      ws.columns=cols.map(c=>({width:c[1]}));
      const n=cols.length;
      const fila1=ws.addRow(['RANKING '+anio+' · '+t.lb.toUpperCase()]);
      ws.mergeCells(1,1,1,n);
      fila1.getCell(1).font={name:'Calibri',size:14,bold:true};
      const fila2=ws.addRow(['Ranking FECHIPO · yourlift.cl · descargado el '+hoy]);
      ws.mergeCells(2,1,2,n);
      fila2.getCell(1).font={name:'Calibri',size:10,italic:true,color:{argb:'FF7F7F7F'}};
      let atletas=0;
      rg.grupos.forEach(g=>{
        ws.addRow([]);
        const tit=ws.addRow([g.cat+(/^\d/.test(g.cat)?' kg':'')+' — '+g.div+'  ('+g.filas.length+')']);
        ws.mergeCells(tit.number,1,tit.number,n);
        tit.getCell(1).font={name:'Calibri',size:12,bold:true,color:{argb:'FFFFFFFF'}};
        tit.getCell(1).fill=relleno('FF0A1628');
        const cab=ws.addRow(cols.map(c=>c[0]));
        cab.eachCell(c=>{ c.font={name:'Calibri',size:10,bold:true}; c.fill=relleno('FFD6DCE4'); c.border=borde;
          c.alignment={horizontal:(c.col<=3||c.col===n)?'left':'center'}; });
        g.filas.forEach(e=>{
          const pos=e._pos||e.p;
          const an=anioDe(e), camp=campeonatoDe(e,rg.bench);
          const v=rg.bench
            ?[pos,e.n,e.t||'',an,e.bw||'',e.bp||0,+((e.dt||0).toFixed(2)),camp]
            :[pos,e.n,e.t||'',an,e.bw||'',e.sq||0,e.bp||0,e.dl||0,e.tt||0,+((e.dt||0).toFixed(2)),camp];
          const r=ws.addRow(v);
          // Total (o la banca en Bench) en negrita: es la marca que ordena.
          const colMarca=rg.bench?6:9;
          r.eachCell({includeEmpty:true},c=>{ c.border=borde; c.font={name:'Calibri',size:11,bold:c.col===2||c.col===colMarca};
            c.alignment={horizontal:(c.col===2||c.col===3||c.col===n)?'left':'center'};
            if(PODIO[pos])c.fill=relleno(PODIO[pos]); });
          atletas++;
        });
      });
      resumen.push([t.lb,rg.grupos.length,atletas]);
    });

    if(!resumen.length)throw new Error('El ranking no tiene resultados');
    ri.columns=[{width:32},{width:14},{width:12}];
    ri.addRow(['RANKING FECHIPO '+anio]).getCell(1).font={name:'Calibri',size:14,bold:true};
    ri.addRow(['Descargado el '+hoy+' desde el panel de YourLift']).getCell(1).font={italic:true,color:{argb:'FF7F7F7F'}};
    ri.addRow([]);
    const hc=ri.addRow(['PESTAÑA','CATEGORÍAS','ATLETAS']);
    hc.eachCell(c=>{ c.font={bold:true}; c.fill=relleno('FFD6DCE4'); c.border=borde; });
    resumen.forEach(x=>ri.addRow(x).eachCell(c=>{ c.border=borde; }));

    const buf=await wb.xlsx.writeBuffer();
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='Ranking_FECHIPO_'+anio+'.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
    const tot=resumen.reduce((s,x)=>s+x[2],0);
    showToast('Ranking exportado: '+resumen.length+' pestañas, '+tot+' atletas');
    await logAction('export_ranking','ranking_'+anio,'',resumen.length+' hojas');
  }catch(e){ console.error(e); showToast('Error al exportar el ranking: '+e.message,null,true); }
  finally{ if(marco)marco.remove(); if(btn){ btn.textContent=txt; btn.disabled=false; } }
};

// ── Resultados de los campeonatos en Excel ──────────────────────────────────
// Lo que cerró el livecast (competition_results), una pestaña por campeonato.
// Quedan fuera los resultados subidos a mano de campeonatos del extranjero (los
// mundiales): no son un campeonato corrido acá, son un dato suelto del atleta.
const _ER_NN=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
// Las dos tarimas del mismo campeonato son un solo campeonato.
const _erNombre=ev=>String(ev||'').replace(/\s*-\s*Tarima\s*\d+\s*$/i,'').replace(/\s+/g,' ').trim();
// Un nombre de pestaña de Excel: hasta 31 caracteres y sin / \ ? * [ ] :
function _erCorto(nombre){
  let n=_erNombre(nombre).replace(/\bPrimer\b/i,'1er').replace(/\bCampeonato\b/ig,'').replace(/\bFECHIPO\b/ig,'')
    .replace(/[\/\\?*\[\]:]/g,'').replace(/\s+/g,' ').trim();
  n=n.split(' ').map(w=>w.length>3&&w===w.toUpperCase()?w[0]+w.slice(1).toLowerCase():w).join(' ');
  return n.slice(0,31).trim();
}
function _erDocs(){
  const todos=(ST.allCompResults||[]).filter(d=>d&&d.evento_id&&d.source!=='manual');
  // Un cierre publicado dos veces dejó {id} y {id}_uni con el mismo resultado:
  // vale el _uni (ver t_cierredoble.js).
  const ids=new Set(todos.map(d=>d.id));
  return todos.filter(d=>!ids.has(String(d.id)+'_uni'));
}
function _expResEventos(){
  const m={};
  _erDocs().forEach(d=>{
    const k=_erNombre(d.evento);
    if(!m[k])m[k]={nombre:k,corto:_erCorto(k),fecha:d.fecha||'',docs:[]};
    m[k].docs.push(d);
    if(d.fecha&&(!m[k].fecha||d.fecha<m[k].fecha))m[k].fecha=d.fecha;
  });
  // La fecha de un resultado es la del cierre (el Sudamericano cerró el 29);
  // si el campeonato está en la lista del panel, vale su fecha.
  Object.values(m).forEach(e=>{
    const id=(e.docs[0]||{}).evento_id;
    const cfg=(ST.eventos||[]).find(x=>x.id===id||_erNombre(x.name)===e.nombre);
    if(cfg&&/^\d{4}-\d{2}-\d{2}/.test(String(cfg.date||'')))e.fecha=String(cfg.date).slice(0,10);
  });
  return Object.values(m).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
}

window.exportResultadosExcel=async function(btn){
  const isOwner=ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap;
  if(!isOwner){ showToast('Solo el Owner puede exportar los resultados',null,true); return; }
  const eventos=_expResEventos();
  if(!eventos.length){ showToast('Todavía no cargan los resultados. Prueba en unos segundos.',null,true); return; }
  const txt=btn?btn.textContent:'';
  if(btn){ btn.textContent='Generando...'; btn.disabled=true; }
  try{
    if(!window.ExcelJS){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
    }
    // Año de nacimiento y universidad: del resultado, de la base de atletas o
    // de la inscripción (por código, RUT o nombre).
    const porCod={}, porNom={};
    (ST.data||[]).forEach(a=>{ if(a.codigo)porCod[a.codigo]=a; porNom[_ER_NN(a.nombre)]=a; });
    const uniIns={};
    (ST.inscripciones||[]).forEach(i=>{ if(!i.universidad)return;
      if(i.rut)uniIns['r'+String(i.rut).replace(/[^0-9kK]/g,'').toUpperCase()]=i.universidad;
      if(i.nombre)uniIns['n'+_ER_NN(i.nombre)]=i.universidad; });
    const ficha=d=>(d.codigo&&porCod[d.codigo])||porNom[_ER_NN(d.nombre)]||null;
    const anioDe=d=>{ const f=ficha(d);
      const v=String(d.anioNac||(f&&(f.anioNac||f.fechaNac))||'').match(/(19|20)\d{2}/); return v?parseInt(v[0],10):''; };
    const uniDe=d=>{ const f=ficha(d);
      return uniIns['r'+String(d.rut||'').replace(/[^0-9kK]/g,'').toUpperCase()]||uniIns['n'+_ER_NN(d.nombre)]
        ||(f&&f.universidad)||(/univ/i.test(String(d.club||''))?d.club:''); };

    const num=x=>{ const n=parseFloat(x); return isNaN(n)?0:n; };
    const catDe=d=>{ const c=String(d.categoria||'').replace(/\s*\(.*\)/,'').replace(/kg/i,'').replace(/^-/,'').trim();
      const n=num(c); const f=/^(f|muj|w)/i.test(String(d.sexo||''));
      if(c.indexOf('+')>=0)return c.replace(/\s+/g,'');
      if(n===84&&f&&num((d.resultado||{}).bw)>84)return '84+';
      if(n===120&&!f&&num((d.resultado||{}).bw)>120)return '120+';
      return c; };
    const ORD_MOD=m=>/special|olimp/i.test(m)?4:/bench/i.test(m)?(/equip/i.test(m)?6:5):/universitari/i.test(m)?2:/equip/i.test(m)?3:1;
    const ORD_DIV={'sub junior':0,'sub-junior':0,'junior':1,'open':2,'master i':3,'master ii':4,'master iii':5,'master iv':6,'universitario':7};
    const ordDiv=x=>{ const k=String(x||'').toLowerCase().trim(); return k in ORD_DIV?ORD_DIV[k]:8; };
    const catNum=c=>num(c)+(String(c).indexOf('+')>=0?.5:0);

    const wb=new window.ExcelJS.Workbook();
    wb.creator='YourLift';
    const thin={style:'thin',color:{argb:'FFBFBFBF'}};
    const borde={top:thin,left:thin,bottom:thin,right:thin};
    const relleno=c=>({type:'pattern',pattern:'solid',fgColor:{argb:c}});
    const PODIO={1:'FFFFE699',2:'FFE7E6E6',3:'FFF8CBAD'};
    const hoy=new Date().toLocaleDateString('es-CL');
    const ri=wb.addWorksheet('Resumen');
    const resumen=[], usados={};

    eventos.forEach(ev=>{
      // Grupos: modalidad · sexo · categoría · división, como el acta.
      const G={};
      ev.docs.forEach(d=>{
        const mod=String(d.modalidad||'')||(d.view==='bench'?'Only Bench Classic':'Powerlifting Classic');
        const k=[mod,d.sexo||'',catDe(d),d.division||''].join('|');
        (G[k]=G[k]||[]).push(d);
      });
      const claves=Object.keys(G).sort((a,b)=>{ const x=a.split('|'), y=b.split('|');
        return (ORD_MOD(x[0])-ORD_MOD(y[0]))||((/^(f|muj)/i.test(y[1])?1:0)-(/^(f|muj)/i.test(x[1])?1:0))
          ||(catNum(x[2])-catNum(y[2]))||(ordDiv(x[3])-ordDiv(y[3])); });
      let nom=ev.corto||'Campeonato', i=2; while(usados[nom])nom=ev.corto.slice(0,28)+' '+(i++); usados[nom]=1;
      const ws=wb.addWorksheet(nom,{views:[{state:'frozen',ySplit:2}]});
      const hayUni=ev.docs.some(d=>/univ/i.test(String(d.division||'')+' '+String(d.modalidad||'')));
      const colsPL=[['LUGAR',7],['ATLETA',36],['CLUB',28],...(hayUni?[['UNIVERSIDAD',30]]:[]),['AÑO NAC.',10],['PESO CORP.',12],['SQ',9],['BP',9],['DL',9],['TOTAL',10],['GL POINTS',11]];
      ws.columns=colsPL.map(c=>({width:c[1]}));
      const n=colsPL.length;
      const t1=ws.addRow([ev.nombre.toUpperCase()]); ws.mergeCells(1,1,1,n);
      t1.getCell(1).font={name:'Calibri',size:14,bold:true};
      const t2=ws.addRow(['Resultados oficiales · '+(ev.fecha?ev.fecha.split('-').reverse().join('-'):'')+' · yourlift.cl · descargado el '+hoy]); ws.mergeCells(2,1,2,n);
      t2.getCell(1).font={name:'Calibri',size:10,italic:true,color:{argb:'FF7F7F7F'}};
      let atletas=0;
      claves.forEach(k=>{
        const [mod,sexo,cat,div]=k.split('|');
        const bench=/bench/i.test(mod);
        const filas=G[k].slice().sort((a,b)=>{ const ra=a.resultado||{}, rb=b.resultado||{};
          const da=ra.status==='DQ'||!(num(ra.total)>0), db=rb.status==='DQ'||!(num(rb.total)>0);
          if(da!==db)return da?1:-1;
          const pa=num(a.posicion), pb=num(b.posicion);
          if(pa&&pb&&pa!==pb)return pa-pb;
          return (num(rb.total)-num(ra.total))||(num(ra.bw)-num(rb.bw)); });
        ws.addRow([]);
        const tit=ws.addRow([mod+' · '+(/^(f|muj)/i.test(sexo)?'Mujeres':'Hombres')+' · '+cat+(/^\d/.test(cat)?' kg':'')+(div?' · '+div:'')+'  ('+filas.length+')']);
        ws.mergeCells(tit.number,1,tit.number,n);
        tit.getCell(1).font={name:'Calibri',size:12,bold:true,color:{argb:'FFFFFFFF'}};
        tit.getCell(1).fill=relleno('FF0A1628');
        const cab=ws.addRow(colsPL.map(c=>c[0]));
        cab.eachCell(c=>{ c.font={name:'Calibri',size:10,bold:true}; c.fill=relleno('FFD6DCE4'); c.border=borde;
          c.alignment={horizontal:c.col>=2&&c.col<=(hayUni?4:3)?'left':'center'}; });
        let lugar=0;
        filas.forEach(d=>{
          const r=d.resultado||{};
          const dq=r.status==='DQ'||!(num(r.total)>0);
          lugar++;
          const pos=dq?'DQ':(num(d.posicion)||lugar);
          const v=[pos,d.nombre||'',d.club||'',...(hayUni?[uniDe(d)]:[]),anioDe(d),num(r.bw)||'',
            bench?'':num(r.sq),num(r.bp),bench?'':num(r.dl),dq?0:num(r.total),dq?'':+num(r.glp).toFixed(2)];
          const row=ws.addRow(v);
          const colTotal=n-1;
          row.eachCell({includeEmpty:true},c=>{ c.border=borde;
            c.font={name:'Calibri',size:11,bold:c.col===2||c.col===colTotal,color:dq?{argb:'FF9C0006'}:undefined};
            c.alignment={horizontal:c.col>=2&&c.col<=(hayUni?4:3)?'left':'center'};
            if(!dq&&PODIO[pos])c.fill=relleno(PODIO[pos]); });
          atletas++;
        });
      });
      resumen.push([ev.nombre,ev.fecha?ev.fecha.split('-').reverse().join('-'):'',claves.length,atletas]);
    });

    ri.columns=[{width:52},{width:12},{width:14},{width:12}];
    ri.addRow(['RESULTADOS DE CAMPEONATOS']).getCell(1).font={name:'Calibri',size:14,bold:true};
    ri.addRow(['Descargado el '+hoy+' desde el panel de YourLift. Solo los atletas con resultado publicado (en el Sudamericano, los chilenos).']).getCell(1).font={italic:true,color:{argb:'FF7F7F7F'}};
    ri.addRow([]);
    const hc=ri.addRow(['CAMPEONATO','FECHA','CATEGORÍAS','RESULTADOS']);
    hc.eachCell(c=>{ c.font={bold:true}; c.fill=relleno('FFD6DCE4'); c.border=borde; });
    resumen.forEach(x=>ri.addRow(x).eachCell(c=>{ c.border=borde; }));

    const buf=await wb.xlsx.writeBuffer();
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='Resultados_Campeonatos_'+new Date().getFullYear()+'.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
    showToast('Resultados exportados: '+resumen.length+' campeonatos');
    await logAction('export_resultados','competition_results','',resumen.length+' campeonatos');
  }catch(e){ console.error(e); showToast('Error al exportar los resultados: '+e.message,null,true); }
  finally{ if(btn){ btn.textContent=txt; btn.disabled=false; } }
};

// admin.html — Estadísticas: participación, tráfico del sitio, afiliaciones y demografía.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// ═══════════════════════════════════════════
// ESTADÍSTICAS
// ═══════════════════════════════════════════
function buildStatsRows(){
  const rows=[];const yearRe=/20\d{2}/;

  // Normalize category: extract number + detect open (plus) category
  const normCat=raw=>{
    const s=String(raw||'');
    const num=(s.match(/\d+/)||[''])[0];
    if(!num)return'?';
    return s.includes('+')?num+'+':num;
  };

  // Normalize division to canonical labels
  const normDiv=raw=>{
    const d=(raw||'').toLowerCase().replace(/[-_]/g,' ').trim();
    if(/sub\s*jun/.test(d)||d==='subjunior')return'Sub-Junior';
    if(/\bjunior\b/.test(d))return'Junior';
    if(/master/.test(d)){
      if(/iv|4/.test(d))return'Master IV';
      if(/iii|3/.test(d))return'Master III';
      if(/ii|2/.test(d))return'Master II';
      return'Master I';
    }
    if(/universitari/.test(d))return'Universitario';
    return'Open';
  };

  // Normalize modalidad → returns array of mods (combined events produce 2)
  const normMods=raw=>{
    const m=(raw||'').toLowerCase();
    if(m.includes('equip')&&(m.includes('bench')||m.includes('only')))return['Equipado','Only Bench'];
    if(m.includes('equip'))return['Equipado'];
    const hasBench=m.includes('bench')||m.includes('only')||m.includes('onlybench');
    const hasClassic=m.includes('powerlifting')||m.includes('classic')||m.includes('raw')||!hasBench;
    if(hasBench&&hasClassic)return['Classic','Only Bench'];
    if(hasBench)return['Only Bench'];
    return['Classic'];
  };

  (ST.data||[]).forEach(a=>{
    // Birth year — supports DD/MM/YYYY and YYYY/MM/DD
    const fp=(a.fechaNac||'').split('/');
    let by=0;
    if(fp.length===3){
      const y0=parseInt(fp[0]),y2=parseInt(fp[2]);
      if(y2>1920&&y2<2015)by=y2;       // DD/MM/YYYY
      else if(y0>1920&&y0<2015)by=y0;  // YYYY/MM/DD
    }
    (a.competencias||[]).forEach(c=>{
      let year='';
      if(c.fecha)year=String(c.fecha).substring(0,4);
      else{const m=yearRe.exec(c.evento||'');if(m)year=m[0];}
      const yn=parseInt(year);
      if(!year||yn<2016||yn>2030)return;
      const sr=(c.sexo||'').toLowerCase();
      const sexo=sr.includes('mujer')||sr.includes('f')?'F':sr.includes('hombre')||sr.includes('m')?'M':'';
      // Los GL points vienen del resultado. Se guardan aparte del total porque
      // son la única medida que permite comparar entre sexos, divisiones de edad y
      // modalidades: los kilos crudos no se pueden comparar entre categorías.
      const base={codigo:a.codigo,nombre:a.nombre||'',club:a.club||'',year,yn,sexo,
        cat:normCat(c.categoria),div:normDiv(c.division),
        age:by>0?yn-by:null,total:parseFloat(c.resultado?.total)||0,
        glp:parseFloat(c.resultado?.glp)||0};
      normMods(c.modalidad).forEach(mod=>rows.push({...base,mod}));
    });
  });
  return rows;
}

// ── Cuántos atletas hay DE VERDAD ─────────────────────────────────────────
//
// El panel decía "1.051 atletas" y ese número no es el de la federación: es
// todo el que alguna vez compitió, desde 2016. Adentro están los que compitieron
// una sola vez en 2019 y no volvieron nunca.
//
// Así que la base se parte en dos, y las dos se muestran:
//   · la HISTÓRICA, todos los que alguna vez pisaron una tarima;
//   · la ACTUAL, los que compitieron en la temporada en curso o en la anterior.
//     Esa es la gente que hoy compite, la que sirve para proyectar un campeonato
//     o para decirle a un auspiciador a cuánta gente se llega.
//
// El corte va por temporada y no por fecha fija. Lo correcto sería de Nacional a
// Nacional —así se cuenta el circuito deportivo—, pero el Nacional que viene
// todavía no tiene fecha cargada, así que por ahora la temporada es el año
// calendario. Cuando esa fecha exista, se cambia acá y nada más.
//
// No mira los filtros de arriba a propósito: es el tamaño de la base, no del
// recorte que uno esté mirando.
function buildBaseAtletas(){
  const porAnio={};
  buildStatsRows().forEach(r=>{
    if(!r.codigo)return;
    (porAnio[r.yn]=porAnio[r.yn]||new Set()).add(r.codigo);
  });
  const anios=Object.keys(porAnio).map(Number).sort((a,b)=>a-b);
  const actual=anios[anios.length-1], previo=anios[anios.length-2];
  const hoy=porAnio[actual]||new Set(), ayer=porAnio[previo]||new Set();
  const historica=new Set();
  anios.forEach(y=>porAnio[y].forEach(c=>historica.add(c)));
  const siguen=[...ayer].filter(c=>hoy.has(c));
  // Y todavía hay un tercer número. En el archivo hay fichas con código asignado
  // y CERO competencias: gente inscrita que nunca llegó a subir a una tarima.
  // Esas fichas inflaban el "atletas totales" del panel sin haber competido
  // nunca. Se cuentan aparte, que es lo único honesto.
  const registrados=(ST.data||[]).length;
  return {
    anios, anioActual:actual, anioPrevio:previo,
    historica:historica.size,
    registrados, sinCompetir:Math.max(0,registrados-historica.size),
    activos:new Set([...ayer,...hoy]).size,   // la base actual
    hoy:hoy.size, ayer:ayer.size,
    siguen:siguen.length,
    seFueron:ayer.size-siguen.length,
    nuevos:hoy.size-siguen.length,
    retencion:ayer.size?Math.round(siguen.length/ayer.size*100):0,
    porAnio:anios.map(y=>({anio:y,n:porAnio[y].size})),
  };
}

// Aplica filtros globales a las filas de stats
function applyStatsFilters(rows){
  const f = ST.statsFilters || {};
  return rows.filter(r => {
    if(f.yearFrom && r.year < f.yearFrom) return false;
    if(f.yearTo && r.year > f.yearTo) return false;
    if(f.sex && r.sexo !== f.sex) return false;
    if(f.mod && r.mod !== f.mod) return false;
    if(f.div && r.div !== f.div) return false;
    if(f.club && r.club !== f.club) return false;
    return true;
  });
}

window.updStatsFilter = function(key, value){
  ST.statsFilters[key] = value;
  // Re-render solo los charts/KPIs (no toda la página, para no perder scroll).
  // Y se redibuja LA PESTAÑA EN LA QUE SE ESTÁ: antes siempre volvía a dibujar la
  // de Deporte, así que tocar un filtro parado en otra pestaña te sacaba de ella.
  const container = document.getElementById('statsContent');
  if(!container)return;
  const tab=ST.statsTab||'deporte';
  if(tab==='corte'){ container.innerHTML=renderCorte(); }
  else if(tab==='demografia'){ container.innerHTML=renderDemografia(); setTimeout(initDemoCharts,0); }
  else { container.innerHTML=renderStatsContent(); setTimeout(()=>{initStatsCharts();initGLCharts();},0); }
};

window.clearStatsFilters = function(){
  ST.statsFilters = {yearFrom:'',yearTo:'',sex:'',mod:'',div:'',club:''};
  const container = document.getElementById('statsContent');
  if(container){
    // Refrescar los selects también
    render();
  }
};

window.exportStatsCSV = function(){
  const rows = applyStatsFilters(buildStatsRows());
  const headers = ['codigo','nombre','club','year','sexo','categoria','division','modalidad','edad','total_kg','gl_points'];
  const csv = [headers.join(',')];
  rows.forEach(r=>{
    csv.push([
      r.codigo, `"${(r.nombre||'').replace(/"/g,'""')}"`, `"${(r.club||'').replace(/"/g,'""')}"`, r.year, r.sexo,
      r.cat, r.div, r.mod, r.age||'', r.total||'', r.glp||''
    ].join(','));
  });
  const blob = new Blob([csv.join('\n')], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'yourlift_stats_' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  showToast('CSV exportado: ' + rows.length + ' filas');
};

window.exportStatsJSON = function(){
  const rows = applyStatsFilters(buildStatsRows());
  // Power BI Desktop puede consumir esto desde "Get Data → JSON"
  const blob = new Blob([JSON.stringify(rows, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'yourlift_stats_' + new Date().toISOString().slice(0,10) + '.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  showToast('JSON exportado: ' + rows.length + ' filas');
};

function renderGAFoto(){
  const G=GA_FOTO;
  const ses=G.periodos.reduce((s,x)=>s+x.ses,0);
  const nue=G.periodos.reduce((s,x)=>s+x.nue,0);
  const ks='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;text-align:center';
  const kpi=(v,l,c)=>`<div style="${ks}"><div style="font-family:Oswald;font-size:30px;font-weight:700;color:${c}">${v.toLocaleString('es-CL')}</div><div style="color:var(--muted);font-size:10px;margin-top:4px;font-family:Oswald;letter-spacing:1px">${l}</div></div>`;
  const barra=(filas,color)=>{
    const max=Math.max(...filas.map(f=>f[1]))||1;
    return filas.map(([k,v])=>`<div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>${esc(k)}</span><span style="font-family:Oswald;color:var(--muted)">${v.toLocaleString('es-CL')}</span></div>
      <div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(v/max*100)}%;background:${color};border-radius:3px"></div></div></div>`).join('');
  };
  return `
  <div style="margin-top:34px;border-top:1px solid var(--border);padding-top:26px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:6px">
      <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--muted)">GOOGLE ANALYTICS · HISTÓRICO</div>
      <div style="font-size:11px;color:var(--muted)">Desde ${G.desde} hasta ${G.hasta}</div>
    </div>
    <div style="font-size:11px;color:var(--gold);margin-bottom:16px">
      Foto tomada el ${G.tomada}. No se actualiza sola — el contador de arriba sí.
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:20px">
      ${kpi(ses,'SESIONES','var(--gold)')}
      ${kpi(nue,'PERSONAS DISTINTAS','#22c55e')}
      ${kpi(G.peak.ses,'PEAK EN UN DÍA','#ef4444')}
    </div>
    <div style="overflow-x:auto;margin-bottom:20px">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1.5px">
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">PERÍODO</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">SESIONES</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">USUARIOS</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">NUEVOS</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">VISTAS</th>
        </tr></thead>
        <tbody>${G.periodos.map(x=>`<tr>
          <td style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.05)">${esc(x.p)}${x.nota?` <span style="color:var(--muted);font-size:11px">· ${esc(x.nota)}</span>`:''}</td>
          <td style="text-align:right;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-family:Oswald">${x.ses.toLocaleString('es-CL')}</td>
          <td style="text-align:right;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-family:Oswald">${x.us.toLocaleString('es-CL')}</td>
          <td style="text-align:right;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-family:Oswald">${x.nue.toLocaleString('es-CL')}</td>
          <td style="text-align:right;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-family:Oswald;color:${x.vis?'var(--text)':'var(--muted)'}">${x.vis?x.vis.toLocaleString('es-CL'):'—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div style="background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.35);border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:12.5px;line-height:1.6">
      <b style="color:var(--gold)">El tráfico lo mueven las competencias.</b>
      Julio, sin ninguna fecha en el calendario, cerró con ${G.periodos[2].nue} usuarios nuevos.
      Agosto, con dos regionales, subió a ${G.periodos[3].nue.toLocaleString('es-CL')}.
      El ${G.peak.dia}, día del ${G.peak.evento}, el sitio hizo <b>${G.peak.ses} sesiones en una sola jornada</b> —
      Google lo marcó como anomalía porque su previsión era de entre ${G.peak.prevMin} y ${G.peak.prevMax}.
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">
      <div><div style="font-family:Oswald;font-size:10px;letter-spacing:2px;color:var(--muted);margin-bottom:10px">DE DÓNDE LLEGA (TOTAL)</div>${barra(G.canales,'var(--gold)')}</div>
      <div><div style="font-family:Oswald;font-size:10px;letter-spacing:2px;color:var(--muted);margin-bottom:10px">PAÍSES · ÚLTIMO MES</div>${barra(G.paisesUltimoMes,'#3b82f6')}</div>
      <div><div style="font-family:Oswald;font-size:10px;letter-spacing:2px;color:var(--muted);margin-bottom:10px">CIUDADES · ÚLTIMO MES</div>${barra(G.ciudadesUltimoMes,'#22c55e')}</div>
    </div>
    <div style="margin-top:22px">
      <div style="font-family:Oswald;font-size:10px;letter-spacing:2px;color:var(--muted);margin-bottom:10px">SANTIAGO vs REGIONES · PERÍODO A PERÍODO</div>
      ${G.regiones.map(x=>{
        const stgo=(x.r.find(y=>y[0]==='Santiago')||['',0])[1];
        const reg=x.cl-stgo, pct=Math.round(reg/x.cl*100);
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span>${esc(x.p)}</span>
            <span style="color:var(--muted)">Santiago <b style="color:var(--text);font-family:Oswald">${stgo.toLocaleString('es-CL')}</b> · regiones <b style="color:var(--gold);font-family:Oswald">${reg.toLocaleString('es-CL')}</b> (${pct} %)</span>
          </div>
          <div style="height:7px;display:flex;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.06)">
            <div style="width:${100-pct}%;background:#3b82f6"></div><div style="width:${pct}%;background:var(--gold)"></div>
          </div></div>`;
      }).join('')}
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Un tercio del público está fuera de Santiago: Concepción, Antofagasta, Temuco y Viña son las que más pesan.</div>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:16px;line-height:1.6">
      ${G.fuente}. La publicidad pagada en Instagram trajo ${G.igPagado} sesiones, un
      ${(G.igPagado/ses*100).toFixed(1)} % del total: el resto llega solo.
      El día más alto del período fueron ${G.peak.ses.toLocaleString('es-CL')} sesiones (${G.peak.dia}, ${G.peak.evento});
      un día cualquiera sin campeonato se mueve entre ${G.peak.prevMin} y ${G.peak.prevMax}.
      Los campeonatos son los que mueven la aguja.
    </div>
  </div>`;
}

async function loadWebAnalytics(){
  const cont=document.getElementById('statsWebContent');
  if(!cont)return;
  // El tráfico del sitio es del negocio, no del deporte: solo el owner.
  if(!_statsOwner()){cont.innerHTML='<div class="h1">Sin acceso</div><p class="subtitle">El tráfico web es solo para el owner.</p>';return;}
  try{
    const snap=await getDocs(collection(db,'analytics_daily'));
    const days=[];
    snap.forEach(d=>{const x=d.data();days.push({date:d.id,total:x.total||0,unique:x.unique||0,pages:x.pages||{},refs:x.refs||{}})});
    days.sort((a,b)=>a.date.localeCompare(b.date));
    window._WEB_DAYS=days;
    cont.innerHTML=renderWebAnalytics(days);
    setTimeout(()=>initWebCharts(days),0);
  }catch(e){
    cont.innerHTML='<div style="padding:30px;text-align:center;color:var(--red)">Error cargando analytics: '+e.message+'</div>';
  }
}

function _webRango(){
  const r=ST.webRango||{k:'30'};
  const hoy=new Date();
  if(r.k==='libre'&&r.desde&&r.hasta)return {desde:r.desde,hasta:r.hasta,libre:true};
  if(r.k==='todo')return {desde:'0000-01-01',hasta:_ymd(hoy)};
  if(r.k==='mes'){
    return {desde:_ymd(new Date(hoy.getFullYear(),hoy.getMonth(),1)),hasta:_ymd(hoy)};
  }
  if(r.k==='ant'){
    const p=new Date(hoy.getFullYear(),hoy.getMonth()-1,1);
    return {desde:_ymd(p),hasta:_ymd(new Date(hoy.getFullYear(),hoy.getMonth(),0))};
  }
  const n=parseInt(r.k,10)||30;
  const d=new Date(hoy); d.setDate(hoy.getDate()-(n-1));
  return {desde:_ymd(d),hasta:_ymd(hoy)};
}

// El mismo largo de rango, corrido hacia atrás: sirve para decir si subió o bajó
// respecto del período anterior, que es la pregunta que uno se hace de verdad.
function _webAnterior(days,r){
  const dd=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000)+1;
  const n=dd(r.desde,r.hasta);
  if(!isFinite(n)||n<=0||r.desde==='0000-01-01')return null;
  const fin=new Date(r.desde+'T00:00:00'); fin.setDate(fin.getDate()-1);
  const ini=new Date(fin); ini.setDate(fin.getDate()-(n-1));
  return _webEnRango(days,{desde:_ymd(ini),hasta:_ymd(fin)});
}

window.webSetRango=function(k){
  ST.webRango={k:k};
  const d=window._WEB_DAYS||[];
  const c=document.getElementById('statsWebContent');
  if(c){c.innerHTML=renderWebAnalytics(d);setTimeout(()=>initWebCharts(d),0);}
};

window.webSetFecha=function(cual,v){
  const r=_webRango();
  ST.webRango={k:'libre',desde:cual==='desde'?v:r.desde,hasta:cual==='hasta'?v:r.hasta};
  const d=window._WEB_DAYS||[];
  const c=document.getElementById('statsWebContent');
  if(c){c.innerHTML=renderWebAnalytics(d);setTimeout(()=>initWebCharts(d),0);}
};

function renderWebAnalytics(days){
  // La foto de Google Analytics se muestra igual aunque el contador propio esté
  // vacío: es justamente el período que el contador no alcanzó a medir.
  if(!days.length) return '<div style="padding:40px;text-align:center;color:var(--muted)">El contador propio todavía no tiene datos. Se registran a medida que la gente entra a yourlift.cl.</div>'+renderGAFoto();
  const today=new Date();
  const ymd=_ymd;
  const todayStr=ymd(today);
  const R=_webRango();
  const enR=_webEnRango(days,R);
  const prev=_webAnterior(days,R);
  const sum=l=>({t:(l||[]).reduce((s,d)=>s+d.total,0),u:(l||[]).reduce((s,d)=>s+d.unique,0)});
  const act=sum(enR), ant=prev?sum(prev):null;
  const todayRow=days.find(d=>d.date===todayStr)||{total:0,unique:0};
  const totalAll=days.reduce((s,d)=>s+d.total,0);
  // Cuánto cambió respecto del período anterior del mismo largo. Sin base no se
  // inventa un porcentaje: "+100%" saliendo de cero no dice nada.
  const _delta=(a,b)=>{
    if(b===null||b===undefined||!b)return '';
    const p=Math.round((a-b)/b*100);
    const c=p>0?'#22c55e':(p<0?'#ef4444':'var(--muted)');
    return `<div style="font-size:10px;color:${c};margin-top:3px;font-family:Oswald;letter-spacing:.5px">${p>0?'▲ +':(p<0?'▼ ':'')}${p}% vs período anterior</div>`;
  };
  // Páginas y orígenes: SOLO del rango elegido, si no el gráfico dice una cosa y
  // las cifras de arriba otra.
  const pageAgg={};
  enR.forEach(d=>Object.entries(d.pages||{}).forEach(([k,v])=>{pageAgg[k]=(pageAgg[k]||0)+v}));
  const pageTop=Object.entries(pageAgg).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const refAgg={};
  enR.forEach(d=>Object.entries(d.refs||{}).forEach(([k,v])=>{refAgg[k]=(refAgg[k]||0)+v}));
  const refTop=Object.entries(refAgg).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const _fL=f=>{const m=String(f||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return f||'';
    const M=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return (+m[3])+' '+M[(+m[2])-1]+(m[1]!==String(today.getFullYear())?' '+m[1]:'');};
  const rk=(ST.webRango||{k:'30'}).k;
  const btnR=r=>`<button onclick="webSetRango('${r.k}')" style="padding:6px 12px;border-radius:8px;cursor:pointer;font-family:Oswald;font-size:11px;letter-spacing:1px;font-weight:700;border:1px solid ${rk===r.k?'var(--gold)':'var(--border)'};background:${rk===r.k?'rgba(212,168,67,.16)':'transparent'};color:${rk===r.k?'var(--gold)':'var(--muted)'}">${r.l}</button>`;
  const selector=`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
    ${_WEB_RANGOS.map(btnR).join('')}
    <span style="flex:1"></span>
    <label style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px">DESDE
      <input type="date" value="${R.desde==='0000-01-01'?(days[0]||{}).date||'':R.desde}" max="${todayStr}" onchange="webSetFecha('desde',this.value)" style="background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:7px;padding:5px 8px;color:var(--text);font-size:11px;margin-left:5px"></label>
    <label style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px">HASTA
      <input type="date" value="${R.hasta}" max="${todayStr}" onchange="webSetFecha('hasta',this.value)" style="background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:7px;padding:5px 8px;color:var(--text);font-size:11px;margin-left:5px"></label>
  </div>
  <div style="font-size:11px;color:var(--muted);margin-bottom:14px">
    ${_fL(R.desde==='0000-01-01'?((days[0]||{}).date||''):R.desde)} — ${_fL(R.hasta)} · ${enR.length} día${enR.length===1?'':'s'} con registro
  </div>`;
  const PAGE_LABEL={home:'Inicio',nominas:'Nóminas',stats:'Estadísticas',records:'Records',trans:'Transmisiones',atletas:'Atletas',insc:'Inscripción',rank:'Ranking',glcalc:'Calc. GL'};
  const ks='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;text-align:center';
  const kpi=(val,lbl,col,extra)=>`<div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:${col}">${val.toLocaleString('es-CL')}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">${lbl}</div>${extra||''}</div>`;
  const card=(t,id,h='300px')=>`<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px"><div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:14px">${t}</div><div style="position:relative;height:${h}"><canvas id="${id}"></canvas></div></div>`;
  return `
  <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
    <button onclick="exportWebCSV()" style="background:rgba(34,197,94,.15);border:1px solid var(--green);color:var(--green);padding:8px 14px;border-radius:8px;font-family:Oswald;font-size:11px;letter-spacing:1px;cursor:pointer;font-weight:700">EXPORTAR CSV</button>
  </div>
  ${selector}
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:24px">
    ${kpi(act.t,'VISITAS EN EL RANGO','var(--gold)',ant?_delta(act.t,ant.t):'')}
    ${kpi(act.u,'VISITANTES ÚNICOS','#f59e0b',ant?_delta(act.u,ant.u):'')}
    ${kpi(enR.length?Math.round(act.t/enR.length):0,'PROMEDIO POR DÍA','#3b82f6')}
    ${kpi(todayRow.total,'VISITAS HOY','#22c55e')}
    ${kpi(totalAll,'VISITAS TOTALES','#a78bfa')}
  </div>
  <div style="margin-bottom:12px;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--muted)">EVOLUCIÓN DE VISITAS</div>
  <div style="margin-bottom:16px">${card('VISITAS POR DÍA (TOTAL vs ÚNICOS)','webDaily','320px')}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${card('PÁGINAS MÁS VISITADAS','webPages','320px')}
    ${card('ORIGEN DEL TRÁFICO','webRefs','320px')}
  </div>
  <div style="font-size:11px;color:var(--muted);text-align:center;margin-top:16px">Datos propios de YourLift · Actualizado en tiempo real · Visitante único = 1 por persona por día</div>
  ${renderGAFoto()}`;
}

function initWebCharts(days){
  Object.values(_webCharts).forEach(c=>{try{c.destroy()}catch(e){}});_webCharts={};
  const base={color:'#E8EEF6',plugins:{legend:{labels:{color:'#E8EEF6',font:{family:'Oswald',size:11}}}},
    scales:{x:{ticks:{color:'#8A9BB2',font:{family:'Oswald',size:10}},grid:{color:'rgba(29,49,80,.5)'}},y:{ticks:{color:'#8A9BB2',font:{family:'Oswald',size:10}},grid:{color:'rgba(29,49,80,.5)'},beginAtZero:true}}};
  const mk=(id,type,data,extra={})=>{const el=document.getElementById(id);if(!el)return;_webCharts[id]=new Chart(el,{type,data,options:{responsive:true,maintainAspectRatio:false,...base,...extra,plugins:{...base.plugins,...(extra.plugins||{})}}})};
  // El mismo rango que muestran las cifras de arriba. Antes el gráfico estaba
  // clavado en los últimos 30 días y podía contradecir a los números.
  const R=_webRango();
  const last=_webEnRango(days,R);
  const labels=last.map(d=>d.date.slice(5));
  mk('webDaily','line',{labels,datasets:[
    {label:'Total',data:last.map(d=>d.total),borderColor:'#D4A843',backgroundColor:'rgba(212,168,67,.15)',fill:true,tension:.3},
    {label:'Únicos',data:last.map(d=>d.unique),borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.1)',fill:true,tension:.3}
  ]});
  // Páginas
  const pageAgg={};last.forEach(d=>Object.entries(d.pages||{}).forEach(([k,v])=>{pageAgg[k]=(pageAgg[k]||0)+v}));
  const PAGE_LABEL={home:'Inicio',nominas:'Nóminas',stats:'Estadísticas',records:'Records',trans:'Transmisiones',atletas:'Atletas',insc:'Inscripción',rank:'Ranking',glcalc:'Calc. GL'};
  const pe=Object.entries(pageAgg).sort((a,b)=>b[1]-a[1]).slice(0,8);
  mk('webPages','bar',{labels:pe.map(([k])=>PAGE_LABEL[k]||k),datasets:[{label:'Vistas',data:pe.map(([,v])=>v),backgroundColor:'#22c55e'}]},{indexAxis:'y'});
  // Refs
  const refAgg={};last.forEach(d=>Object.entries(d.refs||{}).forEach(([k,v])=>{refAgg[k]=(refAgg[k]||0)+v}));
  const re=Object.entries(refAgg).sort((a,b)=>b[1]-a[1]).slice(0,8);
  mk('webRefs','doughnut',{labels:re.map(([k])=>k),datasets:[{data:re.map(([,v])=>v),backgroundColor:['#D4A843','#3b82f6','#22c55e','#ef4444','#a78bfa','#f59e0b','#ec4899','#06b6d4']}]},{scales:{}});
}

window.exportWebCSV=function(){
  // Se baja lo que se está mirando, no todo: si uno filtró un mes y el archivo
  // trae el año entero, hay que volver a filtrar en la planilla.
  const R=_webRango();
  const days=_webEnRango(window._WEB_DAYS||[],R);
  const csv=['fecha,total,unicos'];
  days.forEach(d=>csv.push(`${d.date},${d.total},${d.unique}`));
  const blob=new Blob([csv.join('\n')],{type:'text/csv'});
  const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;
  a.download='yourlift_trafico_'+(R.desde==='0000-01-01'?'todo':R.desde)+'_a_'+R.hasta+'.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
};

// ── Afiliaciones del año ─────────────────────────────────────────────────────
// Una afiliación es una persona que compitió al menos una vez en el año: se paga
// una sola vez, del 1 de enero al 31 de diciembre, y no se vuelve a pagar aunque
// después corra tres campeonatos más. Así que lo que hay que contar por
// campeonato no es cuánta gente hubo, sino cuánta gente DEBUTÓ en el año ahí.
//
// El dato no está en un solo lugar y por eso esto mira las tres fuentes:
//   · competition_results — lo que cierra el livecast y lo que suben los atletas.
//     Es la única fuente del Regional Norte y del Centro Sur, y de campeonatos
//     como el Debutantes, que corrió con una sola tarima y no pasó por el
//     livecast: ahí los resultados los cargó cada atleta.
//   · data.json — el histórico publicado. Trae el Nacional, que nunca pasó por
//     competition_results.
//   · inscripciones — lo que está entrando ahora. No suma afiliaciones todavía:
//     va aparte, porque la nómina no ha cerrado y esa gente aún puede bajarse.
//
// Un mismo campeonato viene escrito de varias formas ("Regional Centro 2026" y
// "Campeonato Regional Centro FECHIPO 2026" son el mismo torneo, y el Debutantes
// vino partido en dos tarimas), así que se agrupa por _evClave y no por el
// nombre, que es lo mismo que hace la columna de participación.
function buildAnioStats(anio){
  const A = String(anio || new Date().getFullYear());
  const hoy = new Date().toISOString().slice(0,10);
  const anioDe = (evento,fecha) =>
    String(fecha||'').slice(0,4) || (String(evento||'').match(/\b(20\d\d)\b/)||[])[1] || '';
  // Mismo criterio que la columna de participación: DQ es haber competido —estuvo
  // en la tarima—, pero una línea sin ningún kilo es solo una inscripción.
  const compitioDe = (r) => {
    if(!r) return false;
    if(String(r.status||'').toUpperCase()==='DQ') return true;
    return (r.total||0)>0 || (r.sq||0)>0 || (r.bp||0)>0 || (r.dl||0)>0;
  };
  const esEnsayo = (ev) => /\bensayo\b/i.test(String(ev||''));

  const evs = {};      // clave → {nombre, fecha, compiten:Set, inscritos:Set, enCurso}
  const gente = {};    // id → {nombre, sexo, club}

  const meter = (rut,nombre,evento,fecha,compitio,sexo,club,enCurso) => {
    if(!evento || esEnsayo(evento)) return;
    if(anioDe(evento,fecha) !== A) return;
    const k = _evClave(evento); if(!k) return;
    const id = _hRut(rut) || (_hNom(nombre) ? 'n:'+_hNom(nombre) : '');
    if(!id) return;
    const e = evs[k] || (evs[k] = {clave:k, nombre:evento, fecha:fecha||'', compiten:new Set(), inscritos:new Set(), enCurso:false});
    // De los varios nombres del mismo torneo se conserva el más completo.
    if(String(evento).length > e.nombre.length) e.nombre = evento;
    if(fecha && (!e.fecha || fecha < e.fecha)) e.fecha = fecha;
    if(enCurso) e.enCurso = true;
    (compitio ? e.compiten : e.inscritos).add(id);
    const p = gente[id] || (gente[id] = {nombre:'', sexo:'', club:''});
    if(nombre && !p.nombre) p.nombre = nombre;
    if(sexo && !p.sexo) p.sexo = sexo;
    if(club && !p.club) p.club = club;
  };

  (ST.allCompResults||[]).forEach(d => {
    // Lo que sale del livecast o lo sube un atleta es, por definición, gente que
    // estuvo en la tarima.
    meter(d.rut, d.nombre, d.evento, d.fecha, true, d.sexo, d.club, false);
  });
  (ST.data||[]).forEach(o => {
    (o.competencias||[]).forEach(c => {
      meter(o.rut, o.nombre, c.evento, c.fecha, compitioDe(c.resultado), c.sexo||o.sexo, o.club, false);
    });
  });
  (ST.inscripciones||[]).forEach(i => {
    if(i.status==='rejected') return;
    const ev = (ST.eventos||[]).find(e => e.id===i.evento);
    const nombre = (ev&&ev.name) || i.evento || '';
    const fecha  = (ev&&(ev.date||ev.fecha)) || '';
    meter(i.rut, i.nombre, nombre, fecha, false, i.sexo, i.club, true);
  });

  // Un campeonato ya disputado cuenta afiliaciones; uno que todavía no corre va
  // aparte. Si no hay ni un resultado y la fecha no llegó, está en curso.
  const lista = Object.values(evs).map(e => {
    const disputado = e.compiten.size>0 || (!!e.fecha && e.fecha < hoy);
    // Con resultados cargados manda la tarima. Sin ninguno, lo único que hay es
    // la nómina, y se usa marcando que es la nómina y no lo que pasó.
    const cuentan = e.compiten.size>0 ? e.compiten : e.inscritos;
    return {
      clave:e.clave, nombre:e.nombre, fecha:e.fecha,
      compiten:e.compiten.size, inscritos:e.inscritos.size,
      participantes:new Set([...e.compiten, ...e.inscritos]).size,
      cuentan, disputado,
      fuente: e.compiten.size>0 ? 'resultados' : 'nomina'
    };
  });
  const disputados = lista.filter(e => e.disputado).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  const enCurso    = lista.filter(e => !e.disputado).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));

  // La primera vez del año de cada persona: ahí es donde se paga la afiliación.
  // Se recorre en orden de fecha, así que el primer campeonato que la nombra es
  // el que se la lleva.
  const yaVisto = new Set();
  disputados.forEach(e => {
    e.nuevas = 0; e.recomp = 0;
    e.cuentan.forEach(id => {
      if(yaVisto.has(id)) e.recomp++;
      else { yaVisto.add(id); e.nuevas++; }
    });
  });
  // Los que están entrando ahora y todavía no compitieron este año: si la nómina
  // cierra y corren, son afiliaciones nuevas.
  enCurso.forEach(e => {
    e.nuevas = 0; e.recomp = 0;
    e.cuentan.forEach(id => { if(yaVisto.has(id)) e.recomp++; else e.nuevas++; });
  });

  const sexoDe = (s) => {
    s = String(s||'').toLowerCase().trim();
    if(/^f|muj|dama|femen/.test(s)) return 'F';
    if(/^m|^v|hom|masc|varon/.test(s)) return 'M';
    return 'N/D';
  };
  const sexoCount = {M:0, F:0, 'N/D':0};
  const clubCount = {};
  yaVisto.forEach(id => {
    const p = gente[id] || {};
    sexoCount[sexoDe(p.sexo)]++;
    const c = p.club || 'Sin club';
    clubCount[c] = (clubCount[c]||0)+1;
  });

  return {
    anio:A,
    afiliaciones: yaVisto.size,
    disputados, enCurso,
    sexoCount,
    topClubs: Object.entries(clubCount).sort((a,b)=>b[1]-a[1]).slice(0,10),
    enCursoNuevas: enCurso.reduce((s,e)=>s+e.nuevas,0)
  };
}

function render2026Stats(){
  const S = buildAnioStats(new Date().getFullYear());
  const ks = 'background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;text-align:center';
  const card = (t,sub,content) => `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px">
    <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:${sub?'4px':'14px'}">${t}</div>
    ${sub?`<div style="font-size:10px;color:var(--muted);margin-bottom:12px;line-height:1.4">${sub}</div>`:''}
    ${content}</div>`;
  const th = (t,align,color) => `<th style="padding:8px;text-align:${align||'right'};color:${color||'var(--muted)'};font-size:10px;text-transform:uppercase;letter-spacing:1px;font-family:Oswald">${t}</th>`;

  const totF = S.sexoCount.F, totM = S.sexoCount.M;
  const pctF = S.afiliaciones ? Math.round(totF/S.afiliaciones*100) : 0;

  // Un campeonato del que solo tenemos la nómina se marca: el número es de
  // inscritos, no de gente que pisó la tarima, y conviene que se note.
  const filaEv = (e) => {
    const soloNom = e.fuente==='nomina';
    return `<tr>
      <td style="padding:8px;text-align:left;color:var(--text);font-size:13px">${esc(e.nombre)}
        ${soloNom?`<span title="Sin resultados cargados: la cifra sale de la nómina de inscritos" style="color:var(--orange);font-size:10px;margin-left:5px"><i class=yl-i-alerta></i> s/resultados</span>`:''}
        <div style="color:var(--muted);font-size:10px">${esc(e.fecha||'sin fecha')}</div></td>
      <td style="padding:8px;text-align:right;font-weight:700;color:var(--text);font-size:13px">${e.cuentan.size}</td>
      <td style="padding:8px;text-align:right;font-weight:700;color:var(--green);font-size:14px">${e.nuevas}</td>
      <td style="padding:8px;text-align:right;color:var(--muted);font-size:12px">${e.recomp}</td>
    </tr>`;
  };

  const tablaDisputados = S.disputados.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:2px solid var(--border)">
          ${th('Campeonato','left')}${th('Compitieron')}${th('Nuevas','right','var(--green)')}${th('Ya afiliado')}
        </tr></thead><tbody>${S.disputados.map(filaEv).join('')}</tbody>
        <tfoot><tr style="border-top:2px solid var(--border)">
          <td style="padding:9px 8px;text-align:left;font-family:Oswald;letter-spacing:1px;font-size:11px;color:var(--gold)">TOTAL AFILIACIONES ${S.anio}</td>
          <td></td>
          <td style="padding:9px 8px;text-align:right;font-family:Oswald;font-size:16px;font-weight:700;color:var(--green)">${S.afiliaciones}</td>
          <td></td>
        </tr></tfoot></table>`
    : `<div style="color:var(--muted);font-size:12px;padding:10px 0">Todavía no hay campeonatos disputados en ${S.anio}.</div>`;

  const tablaCurso = S.enCurso.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:2px solid var(--border)">
          ${th('Campeonato','left')}${th('Inscritos')}${th('Serían nuevas','right','var(--gold)')}${th('Ya afiliado')}
        </tr></thead><tbody>${S.enCurso.map(e=>`<tr>
          <td style="padding:8px;text-align:left;color:var(--text);font-size:13px">${esc(e.nombre)}
            <div style="color:var(--muted);font-size:10px">${esc(e.fecha||'sin fecha')} · inscripción abierta</div></td>
          <td style="padding:8px;text-align:right;font-weight:700;color:var(--text);font-size:13px">${e.cuentan.size}</td>
          <td style="padding:8px;text-align:right;font-weight:700;color:var(--gold);font-size:14px">${e.nuevas}</td>
          <td style="padding:8px;text-align:right;color:var(--muted);font-size:12px">${e.recomp}</td>
        </tr>`).join('')}</tbody></table>`
    : `<div style="color:var(--muted);font-size:12px;padding:10px 0">No hay inscripciones abiertas para ${S.anio}.</div>`;

  const clubsTable = S.topClubs.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:2px solid var(--border)">${th('Club','left')}${th('Atletas')}${th('%')}</tr></thead>
        <tbody>${S.topClubs.map(([club,cnt])=>`<tr>
          <td style="padding:8px;text-align:left;color:var(--text);font-size:13px">${esc(club)}</td>
          <td style="padding:8px;text-align:right;font-weight:700;color:var(--text);font-size:13px">${cnt}</td>
          <td style="padding:8px;text-align:right;color:var(--muted);font-size:12px">${S.afiliaciones?Math.round(cnt/S.afiliaciones*100):0}%</td>
        </tr>`).join('')}</tbody></table>`
    : '<div style="color:var(--muted);font-size:12px">Sin datos de club.</div>';

  const kpi = (val,label,color,sub) => `<div style="${ks}">
    <div style="font-family:Oswald;font-size:42px;font-weight:700;color:${color}">${val}</div>
    <div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">${label}</div>
    ${sub?`<div style="color:var(--muted);font-size:9px;margin-top:2px">${sub}</div>`:''}</div>`;

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px">
    ${kpi(S.afiliaciones.toLocaleString(),'AFILIACIONES '+S.anio,'var(--green)','personas distintas que ya compitieron')}
    ${kpi(S.disputados.length,'CAMPEONATOS','#3b82f6','disputados este año')}
    ${kpi(S.enCursoNuevas.toLocaleString(),'EN CAMINO','var(--gold)','inscritos que aún no se afilian')}
    ${kpi(totF.toLocaleString(),'MUJERES','#ec4899',pctF+'% del total')}
    ${kpi(totM.toLocaleString(),'HOMBRES','#f59e0b','')}
  </div>

  <div style="margin-bottom:16px">
    ${card('AFILIACIONES POR CAMPEONATO','Cada persona se cuenta una sola vez en el año: paga en el primero que corre y en los siguientes ya está afiliada.',tablaDisputados)}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${card('INSCRIPCIONES EN CURSO','Nóminas todavía abiertas. No suman hasta que el campeonato se corra.',tablaCurso)}
    ${card('TOP 10 CLUBES','Sobre las '+S.afiliaciones+' personas afiliadas este año.',clubsTable)}
  </div>

  <p style="color:var(--muted);font-size:11px;margin-top:14px;line-height:1.55">
    <strong>Afiliación</strong> = persona que compitió al menos una vez en el año (1 ene–31 dic). Se paga una sola vez, así que cada persona
    suma en el primer campeonato que corre y en los siguientes aparece como <strong>ya afiliado</strong>: la columna
    <strong>Nuevas</strong> es lo que ese campeonato aportó de afiliaciones, y la suma de esa columna es el total del año.
    Los datos se cruzan por RUT entre los resultados del livecast, los que suben los atletas y el histórico publicado, así que un
    campeonato escrito de dos formas —o partido en dos tarimas— cuenta una sola vez.
    Un campeonato marcado <span style="color:var(--orange)"><i class=yl-i-alerta></i> s/resultados</span> todavía no tiene resultados cargados y la cifra sale de su
    nómina de inscritos: va a ajustarse sola cuando se carguen.
  </p>`;
}

// ── Demografía: total, rangos de edad, zona y sexo (auto desde data.json) ──
function buildDemoStats(){
  const today=new Date();
  const ageOf=fn=>{
    if(!fn)return null;
    const p=String(fn).split('/');if(p.length!==3)return null;
    let dd,mm,yy;
    const a0=parseInt(p[0]),a2=parseInt(p[2]);
    if(a2>1920&&a2<2015){dd=a0;mm=parseInt(p[1]);yy=a2;}        // DD/MM/YYYY
    else if(a0>1920&&a0<2015){yy=a0;mm=parseInt(p[1]);dd=parseInt(p[2]);} // YYYY/MM/DD
    else return null;
    if(!yy)return null;
    let age=today.getFullYear()-yy;
    const bm=mm-1,bd=dd;
    if(today.getMonth()<bm||(today.getMonth()===bm&&today.getDate()<bd))age--;
    return age;
  };
  const zoneOf=ev=>{
    const e=(ev||'').toLowerCase();
    if(e.includes('sur austral'))return'Sur Austral';
    if(e.includes('centro norte'))return'Centro Norte';
    if(e.includes('centro sur'))return'Centro Sur';
    if(e.includes('zona norte')||e.includes('regional norte')||e.includes('atacama'))return'Norte';
    if(e.includes('zona sur')||e.includes('osorno'))return'Sur';
    if(e.includes('zona centro')||e.includes('regional centro'))return'Centro';
    return null;
  };
  const sexOf=s=>{
    if(!s)return null;s=String(s).toLowerCase().trim();
    if(s.includes('muj')||s.includes('fem')||s.includes('dama')||s==='f')return'F';
    if(s.includes('hombre')||s.includes('masc')||s==='m'||s==='varon')return'M';
    return null;
  };
  const rngOf=a=>{
    if(a===null)return'Sin fecha';
    if(a<14)return'Menor de 14';if(a<=18)return'14-18';if(a<=23)return'19-23';
    if(a<=39)return'24-39';if(a<=49)return'40-49';if(a<=59)return'50-59';
    if(a<=69)return'60-69';return'70+';
  };
  const detail=[];
  (ST.data||[]).forEach(o=>{
    const a=ageOf(o.fechaNac);
    const votes={};(o.competencias||[]).forEach(c=>{const z=zoneOf(c.evento);if(z)votes[z]=(votes[z]||0)+1;});
    let best=null,bn=0;Object.keys(votes).forEach(z=>{if(votes[z]>bn){bn=votes[z];best=z;}});
    if(!best)best='No determinada';
    let sx=sexOf(o.sexo);
    if(!sx)(o.competencias||[]).some(c=>{const s=sexOf(c.sexo);if(s){sx=s;return true;}return false;});
    detail.push({codigo:o.codigo||'',edad:a===null?'':a,rango:rngOf(a),zona:best,sexo:sx||'N/D',club:o.club||'',debut:(o.debut===true?'':(o.debut||''))});
  });
  const tally=k=>{const t={};detail.forEach(r=>{t[r[k]]=(t[r[k]]||0)+1;});return t;};
  return {total:detail.length,porEdad:tally('rango'),porZona:tally('zona'),porSexo:tally('sexo'),detail};
}

function renderDemografia(){
  if(!_statsOwner())return '<div class="h1">Sin acceso</div><p class="subtitle">La demografía del padrón es solo para el owner.</p>';
  const D=buildDemoStats();
  const N=D.total||1;
  const card='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px';
  const tableBlock=(title,items,color)=>{
    const max=Math.max(1,...items.map(i=>i[1]));
    let rows='';
    items.forEach(([label,cnt])=>{
      const pct=(cnt/N*100);
      rows+=`<tr>
        <td style="padding:7px 10px;font-size:13px;color:var(--text)">${label}</td>
        <td style="padding:7px 10px;width:42%">
          <div style="background:rgba(255,255,255,.06);border-radius:5px;height:16px;position:relative">
            <div style="background:${color};height:16px;border-radius:5px;width:${(cnt/max*100).toFixed(1)}%;min-width:2px"></div>
          </div>
        </td>
        <td style="padding:7px 10px;text-align:right;font-weight:700;font-size:13px;color:var(--text)">${cnt.toLocaleString()}</td>
        <td style="padding:7px 10px;text-align:right;font-size:12px;color:var(--muted)">${pct.toFixed(1)}%</td>
      </tr>`;
    });
    return `<div style="${card}">
      <div style="font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:12px">${title}</div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`;
  };
  const order=(obj,keys)=>keys.filter(k=>obj[k]>0).map(k=>[k,obj[k]]);
  const edad=order(D.porEdad,['Menor de 14','14-18','19-23','24-39','40-49','50-59','60-69','70+','Sin fecha']);
  const zona=order(D.porZona,['Centro','Centro Norte','Centro Sur','Norte','Sur','Sur Austral','No determinada']);
  const sexoLbl={M:'Hombres',F:'Mujeres','N/D':'Sin dato'};
  const sexo=order(D.porSexo,['M','F','N/D']).map(([k,v])=>[sexoLbl[k]||k,v]);
  const ks='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;text-align:center';
  const A=buildAfilStats();
  const lastY=A.years[A.years.length-1];                 // año en curso (parcial)
  const yMax=Math.max(1,...A.years.map(y=>A.afilCount[y]),A.proj[2026],A.proj[2027]);
  const grow=(cur,prev)=>{
    if(prev===0)return cur===0?'—':'n/a';
    const p=(cur-prev)/prev*100;return (p>=0?'+':'')+p.toFixed(0)+'%';
  };
  const afilRow=(label,c,grw,color,proj)=>`<tr style="${proj?'background:rgba(212,168,67,.06)':''}">
      <td style="padding:6px 10px;font-size:13px;color:${proj?'var(--gold)':'var(--text)'}">${label}</td>
      <td style="padding:6px 10px;width:48%"><div style="background:rgba(255,255,255,.06);border-radius:5px;height:15px"><div style="background:${color};height:15px;border-radius:5px;width:${(c/yMax*100).toFixed(1)}%;min-width:2px${proj?';opacity:.6':''}"></div></div></td>
      <td style="padding:6px 10px;text-align:right;font-weight:700;font-size:13px;color:${proj?'var(--gold)':'var(--text)'}">${c.toLocaleString()}</td>
      <td style="padding:6px 10px;text-align:right;font-size:11px;color:var(--muted)">${grw}</td>
    </tr>`;
  let afilRows=A.years.map((y,i)=>{
    const c=A.afilCount[y];
    if(y===lastY) return afilRow(y+' <span style="color:var(--muted);font-size:10px">(a la fecha)</span>',c,'parcial','#d4a843',false);
    return afilRow(y,c,i===0?'—':grow(c,A.afilCount[A.years[i-1]]),'#d4a843',false);
  }).join('');
  afilRows+=afilRow('2026 <span style="color:var(--muted);font-size:10px">(cierre est.)</span>',A.proj[2026],grow(A.proj[2026],A.afilCount[2025]),'#d4a843',true);
  afilRows+=afilRow('2027 <span style="color:var(--muted);font-size:10px">(proyección)</span>',A.proj[2027],grow(A.proj[2027],A.proj[2026]),'#d4a843',true);
  const chartCard=(t,id,h='300px')=>`<div style="${card}"><div style="font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:12px">${t}</div><div style="position:relative;height:${h}"><canvas id="${id}"></canvas></div></div>`;
  return `
  <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
    <button onclick="exportDemoCSV()" title="Descargar resumen + por año + detalle (CSV, abre en Excel)" style="background:rgba(34,197,94,.15);border:1px solid var(--green);color:var(--green);padding:8px 14px;border-radius:8px;font-family:Oswald;font-size:11px;letter-spacing:1px;cursor:pointer;font-weight:700">EXPORTAR (CSV / Excel)</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:22px">
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:var(--gold)">${A.totalUnicos.toLocaleString()}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">PERSONAS ÚNICAS ${A.years[0]}–${A.years[A.years.length-1]}</div></div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:#3b82f6">${A.totalAfiliaciones.toLocaleString()}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">TOTAL AFILIACIONES</div></div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:var(--muted)">${D.total.toLocaleString()}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">ATLETAS EN DB</div></div>
  </div>

  <div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:2px;color:var(--gold);margin:6px 0 12px">AFILIADOS POR AÑO <span style="color:var(--muted);font-weight:400;letter-spacing:0">· personas únicas que compitieron al menos 1 vez en el año</span></div>
  <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:16px;align-items:start">
    <div style="${card}"><table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:4px 10px;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px">AÑO</td><td></td><td style="padding:4px 10px;text-align:right;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px">AFILIADOS</td><td style="padding:4px 10px;text-align:right;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px">CREC.</td></tr>
      ${afilRows}
    </table></div>
    ${chartCard('AFILIADOS POR AÑO','dcAfil','300px')}
  </div>

  <div style="margin-top:16px">${chartCard('ZONA POR AÑO (apilado)','dcZonaY','320px')}</div>
  <div style="margin-top:16px">${chartCard('RANGOS DE EDAD POR AÑO (apilado)','dcEdadY','320px')}</div>

  <div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:2px;color:var(--gold);margin:24px 0 12px">RESUMEN TOTAL <span style="color:var(--muted);font-weight:400;letter-spacing:0">· base completa, cada atleta contado una vez</span></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    ${tableBlock('RANGOS DE EDAD',edad,'#d4a843')}
    ${tableBlock('SEXO',sexo,'#ec4899')}
  </div>
  <div style="margin-top:16px">
    ${tableBlock('ZONA (según campeonato regional)',zona,'#3b82f6')}
  </div>
  <p style="color:var(--muted);font-size:11px;margin-top:14px;line-height:1.5">
    <strong>Afiliado</strong> = persona que compitió al menos 1 vez ese año (1 ene–31 dic). 2020 = 0 (sin competencias por pandemia); el año en curso es parcial. Las filas <strong>2026 (cierre est.)</strong> y <strong>2027 (proyección)</strong> son estimaciones (según inscritos esperados de los regionales que faltan: Centro oct, Sur Austral, Centro Sur, Norte, Universitario), no datos cerrados. <strong>Personas únicas</strong> cuenta a cada atleta una sola vez en todo el período; <strong>Total afiliaciones</strong> suma los afiliados de cada año (mide recurrencia). La <strong>zona</strong> se deriva del campeonato regional/zonal; <strong>"No determinada"</strong> = solo nacionales/internacionales. La edad por año es la edad cumplida ese año; en el resumen total es la edad actual. No corresponde necesariamente a la región administrativa de residencia.
  </p>`;
}

// ── Afiliados por año: persona única que compitió ≥1 vez en el año (auto desde data.json) ──
function buildAfilStats(){
  const Y0=2017, Y1=new Date().getFullYear();
  const years=[]; for(let y=Y0;y<=Y1;y++) years.push(y);
  const zOrder=['Centro','Centro Norte','Centro Sur','Norte','Sur','Sur Austral','No determinada'];
  const aOrder=['Menor de 14','14-18','19-23','24-39','40-49','50-59','60-69','70+','Sin fecha'];
  const byOf=fn=>{if(!fn)return null;const p=String(fn).split('/');if(p.length!==3)return null;const a0=+p[0],a2=+p[2];if(a2>1920&&a2<2016)return a2;if(a0>1920&&a0<2016)return a0;return null;};
  const cy=c=>{if(c.fecha){const s=String(c.fecha).slice(0,4);if(/^\d{4}$/.test(s))return +s;}const m=/20\d{2}/.exec(c.evento||'');return m?+m[0]:null;};
  const zoneOf=ev=>{const e=(ev||'').toLowerCase();if(e.includes('sur austral'))return'Sur Austral';if(e.includes('centro norte'))return'Centro Norte';if(e.includes('centro sur'))return'Centro Sur';if(e.includes('zona norte')||e.includes('regional norte')||e.includes('atacama'))return'Norte';if(e.includes('zona sur')||e.includes('osorno'))return'Sur';if(e.includes('zona centro')||e.includes('regional centro'))return'Centro';return null;};
  const rngOf=a=>{if(a===null||a===undefined||isNaN(a))return'Sin fecha';if(a<14)return'Menor de 14';if(a<=18)return'14-18';if(a<=23)return'19-23';if(a<=39)return'24-39';if(a<=49)return'40-49';if(a<=59)return'50-59';if(a<=69)return'60-69';return'70+';};
  const afil={},zoneYear={},ageYear={};
  years.forEach(y=>{afil[y]=new Set();zoneYear[y]={};ageYear[y]={};zOrder.forEach(z=>zoneYear[y][z]=new Set());aOrder.forEach(a=>ageYear[y][a]=new Set());});
  const uniqAll=new Set();
  (ST.data||[]).forEach((o,idx)=>{
    const aid=o.rut||o.codigo||('x'+idx);
    const by=byOf(o.fechaNac);
    const peryear={};
    (o.competencias||[]).forEach(c=>{
      const y=cy(c); if(!y||y<Y0||y>Y1)return;
      afil[y].add(aid); uniqAll.add(aid);
      const z=zoneOf(c.evento);
      if(!peryear[y])peryear[y]={};
      if(z)peryear[y][z]=(peryear[y][z]||0)+1;
      ageYear[y][rngOf(by?(y-by):null)].add(aid);
    });
    Object.keys(peryear).forEach(y=>{
      const v=peryear[y];let best=null,bn=0;Object.keys(v).forEach(z=>{if(v[z]>bn){bn=v[z];best=z;}});
      if(!best)best='No determinada';
      zoneYear[y][best].add(aid);
    });
  });
  const afilCount={};let totalAfil=0;years.forEach(y=>{afilCount[y]=afil[y].size;totalAfil+=afil[y].size;});
  const zoneYearC={},ageYearC={};
  years.forEach(y=>{zoneYearC[y]={};zOrder.forEach(z=>zoneYearC[y][z]=zoneYear[y][z].size);ageYearC[y]={};aOrder.forEach(a=>ageYearC[y][a]=ageYear[y][a].size);});
  // Proyección (estimación manual basada en inscritos esperados de los regionales que faltan).
  // El cierre 2026 nunca baja del real ya cargado; 2027 mantiene la misma tasa 2025→cierre2026.
  const proj={};
  proj[2026]=Math.max(690, afilCount[2026]||0);
  const g26=afilCount[2025]?proj[2026]/afilCount[2025]:1.06;
  proj[2027]=Math.round(proj[2026]*g26);
  return {years,zOrder,aOrder,afilCount,totalAfiliaciones:totalAfil,totalUnicos:uniqAll.size,zoneYear:zoneYearC,ageYear:ageYearC,proj};
}

function initDemoCharts(){
  if(typeof Chart==='undefined')return;
  Object.values(_demoCharts).forEach(c=>{try{c.destroy()}catch(e){}});_demoCharts={};
  const A=buildAfilStats();
  const base={color:'#E8EEF6',plugins:{legend:{labels:{color:'#E8EEF6',font:{family:'Oswald',size:10},boxWidth:12}}},
    scales:{x:{ticks:{color:'#8A9BB2',font:{family:'Oswald',size:10}},grid:{color:'rgba(29,49,80,.5)'}},
            y:{ticks:{color:'#8A9BB2',font:{family:'Oswald',size:10}},grid:{color:'rgba(29,49,80,.5)'}}}};
  const mk=(id,type,data,extra={})=>{const el=document.getElementById(id);if(!el)return;
    const opts={responsive:true,maintainAspectRatio:false,...base,...extra,
      plugins:{...base.plugins,...(extra.plugins||{})},scales:{...base.scales,...(extra.scales||{})}};
    _demoCharts[id]=new Chart(el,{type,data,options:opts});};
  const lastY=A.years[A.years.length-1];
  const ay=A.years.filter(y=>y<lastY);
  const afLabels=[...ay.map(String),'2026 (est)','2027 (proy)'];
  const afVals=[...ay.map(y=>A.afilCount[y]),A.proj[2026],A.proj[2027]];
  const afCols=[...ay.map(()=>'rgba(212,168,67,.85)'),'rgba(212,168,67,.4)','rgba(212,168,67,.4)'];
  mk('dcAfil','bar',{labels:afLabels,datasets:[{label:'Afiliados',data:afVals,backgroundColor:afCols,borderRadius:4}]},{plugins:{legend:{display:false}}});
  const ZC=['#3b82f6','#6366f1','#06b6d4','#f59e0b','#22c55e','#a855f7','#64748b'];
  mk('dcZonaY','bar',{labels:A.years,datasets:A.zOrder.map((z,i)=>({label:z,data:A.years.map(y=>A.zoneYear[y][z]),backgroundColor:ZC[i%ZC.length],borderRadius:2}))},
    {scales:{x:{...base.scales.x,stacked:true},y:{...base.scales.y,stacked:true}}});
  const AC=['#94a3b8','#22c55e','#3b82f6','#d4a843','#f59e0b','#ec4899','#a855f7','#ef4444','#64748b'];
  mk('dcEdadY','bar',{labels:A.years,datasets:A.aOrder.map((a,i)=>({label:a,data:A.years.map(y=>A.ageYear[y][a]),backgroundColor:AC[i%AC.length],borderRadius:2}))},
    {scales:{x:{...base.scales.x,stacked:true},y:{...base.scales.y,stacked:true}}});
}

window.exportDemoCSV=function(){
  const D=buildDemoStats();const N=D.total||1;
  const lines=[];
  lines.push('YourLift - Demografia de atletas');
  lines.push('Corte,'+new Date().toISOString().slice(0,10));
  lines.push('Total atletas,'+D.total);
  lines.push('');
  const sec=(title,obj,ord,lbl)=>{
    lines.push(title);lines.push('Categoria,Atletas,%');
    ord.filter(k=>obj[k]>0).forEach(k=>{
      const c=obj[k];lines.push((lbl&&lbl[k]||k)+','+c+','+(c/N*100).toFixed(1)+'%');
    });
    lines.push('');
  };
  sec('RANGOS DE EDAD',D.porEdad,['Menor de 14','14-18','19-23','24-39','40-49','50-59','60-69','70+','Sin fecha']);
  sec('ZONA',D.porZona,['Centro','Centro Norte','Centro Sur','Norte','Sur','Sur Austral','No determinada']);
  sec('SEXO',D.porSexo,['M','F','N/D'],{M:'Hombres',F:'Mujeres','N/D':'Sin dato'});
  // ── Secciones por año ──
  const A=buildAfilStats();
  const yh=A.years.join(',');
  lines.push('AFILIADOS POR AÑO (personas únicas)');
  lines.push('Año,'+yh+',Total afiliaciones,Personas únicas');
  lines.push('Afiliados,'+A.years.map(y=>A.afilCount[y]).join(',')+','+A.totalAfiliaciones+','+A.totalUnicos);
  lines.push('Cierre 2026 (estimado),'+A.proj[2026]);
  lines.push('Proyección 2027,'+A.proj[2027]);
  lines.push('');
  lines.push('ZONA POR AÑO');
  lines.push('Zona,'+yh);
  A.zOrder.forEach(z=>lines.push(z+','+A.years.map(y=>A.zoneYear[y][z]).join(',')));
  lines.push('Total afiliados,'+A.years.map(y=>A.afilCount[y]).join(','));
  lines.push('');
  lines.push('RANGOS DE EDAD POR AÑO');
  lines.push('Rango,'+yh);
  A.aOrder.forEach(a=>lines.push(a+','+A.years.map(y=>A.ageYear[y][a]).join(',')));
  lines.push('Total afiliados,'+A.years.map(y=>A.afilCount[y]).join(','));
  lines.push('');
  lines.push('DETALLE');
  lines.push('codigo,edad,rango,zona,sexo,club,debut');
  D.detail.forEach(r=>{
    lines.push([r.codigo,r.edad,r.rango,r.zona,r.sexo,'"'+String(r.club).replace(/"/g,'""')+'"',r.debut].join(','));
  });
  const blob=new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const u=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=u;a.download='YourLift_Demografia_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  if(typeof showToast==='function')showToast('Demografía exportada — '+D.total+' atletas');
};

// El tamaño real de la base, y qué pasó entre la temporada pasada y esta.
function _baseAtletasHtml(){
  const B=buildBaseAtletas();
  if(!B.anios.length)return '';
  const caja='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px';
  const dato=(v,l,c,sub='')=>`<div style="${caja};text-align:center">
    <div style="font-family:Oswald;font-size:34px;font-weight:700;color:${c}">${v}</div>
    <div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">${l}</div>
    ${sub?`<div style="color:var(--muted);font-size:9px;margin-top:3px;line-height:1.4">${sub}</div>`:''}</div>`;
  const pct=B.historica?Math.round(B.activos/B.historica*100):0;
  return `
  <div style="background:rgba(212,168,67,.06);border:1px solid rgba(212,168,67,.35);border-radius:14px;padding:16px 18px;margin-bottom:20px">
    <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--gold);margin-bottom:4px">LA BASE DE ATLETAS</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.5">
      Estos números <b style="color:var(--text)">no dependen de los filtros</b>: son el tamaño de la base, no del recorte.
      La <b style="color:var(--text)">base actual</b> son los que compitieron en ${B.anioPrevio||B.anioActual} o en ${B.anioActual} — la gente que hoy compite.
      La <b style="color:var(--text)">histórica</b> es todo el que alguna vez pisó una tarima, desde ${B.anios[0]}.
      ${B.sinCompetir?`Y hay <b style="color:var(--text)">${B.sinCompetir.toLocaleString()} fichas con código y ninguna competencia</b>: inscritos que nunca subieron a tarima. No son atletas activos y no se cuentan como tales.`:''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
      ${dato(B.activos.toLocaleString(),'BASE ACTUAL','var(--gold)',
        `compitieron en ${B.anioPrevio||B.anioActual} o ${B.anioActual} · ${pct}% de la histórica`)}
      ${dato(B.historica.toLocaleString(),'BASE HISTÓRICA','#8A9BB2',
        `desde ${B.anios[0]} · incluye a los que no volvieron`)}
      ${dato(B.hoy.toLocaleString(),'ACTIVOS EN '+B.anioActual,'#22c55e',
        'lo que va de la temporada')}
      ${dato(B.ayer.toLocaleString(),'COMPITIERON EN '+(B.anioPrevio||'—'),'#3b82f6')}
      ${B.sinCompetir?dato(B.sinCompetir.toLocaleString(),'INSCRITOS SIN COMPETIR','#8A9BB2',
        `de ${B.registrados.toLocaleString()} fichas en el archivo`):''}
    </div>
    <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--muted);margin:18px 0 10px">ATLETAS ÚNICOS POR AÑO</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5">
      Cada persona cuenta <b style="color:var(--text)">una sola vez por año</b>, compita una o cinco veces. Es el número de gente distinta que pisó una tarima ese año — no el de participaciones.
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        ${['AÑO','ATLETAS','CAMBIO','vs. AÑO ANTERIOR'].map((t,i)=>`<th style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:${i?'right':'left'};color:var(--muted);font-family:Oswald;font-size:10px;letter-spacing:1px">${t}</th>`).join('')}
      </tr></thead>
      <tbody>${B.porAnio.map((p,i)=>{
        const ant=i?B.porAnio[i-1].n:null;
        const d=ant!=null?p.n-ant:null;
        const pc=(ant)?Math.round(d/ant*100):null;
        const col=d==null?'var(--muted)':(d>0?'#22c55e':(d<0?'#ef4444':'var(--muted)'));
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);font-family:Oswald;letter-spacing:1px;color:var(--text)">${p.anio}</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;color:var(--gold)">${p.n.toLocaleString()}</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;color:${col}">${d==null?'—':(d>0?'+':'')+d}</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;color:${col}">${pc==null?'—':(pc>0?'+':'')+pc+'%'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.5">
      ${B.anioActual} está en curso, así que su cifra todavía va a subir: compararla con el año cerrado anterior recién tiene sentido en diciembre.
    </div>

    ${B.anioPrevio?`
    <div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--muted);margin:18px 0 10px">DE ${B.anioPrevio} A ${B.anioActual}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
      ${dato(B.siguen.toLocaleString(),'SIGUEN COMPITIENDO','#22c55e',
        `${B.retencion}% de los de ${B.anioPrevio} volvió`)}
      ${dato(B.seFueron.toLocaleString(),'NO HAN VUELTO','#ef4444',
        `compitieron en ${B.anioPrevio} y todavía no en ${B.anioActual}`)}
      ${dato(B.nuevos.toLocaleString(),'CARAS NUEVAS','#a78bfa',
        `compiten en ${B.anioActual} y no lo hicieron en ${B.anioPrevio}`)}
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:12px;line-height:1.5">
      La temporada ${B.anioActual} está en curso: los que "no han vuelto" pueden volver, y las cifras suben con cada campeonato que se carga.
      El corte va por año calendario; lo correcto sería de Nacional a Nacional, y se cambia en cuanto el próximo Nacional tenga fecha.
    </div>`:''}
  </div>`;
}

function renderStatsContent(){
  const rowsAll = buildStatsRows();
  const rows = applyStatsFilters(rowsAll);
  const f = ST.statsFilters || {};
  const allYears = [...new Set(rowsAll.map(r=>r.year))].sort();
  const allClubs = [...new Set(rowsAll.map(r=>r.club).filter(Boolean))].sort();
  const allDivs  = [...new Set(rowsAll.map(r=>r.div))].sort();
  const allMods  = [...new Set(rowsAll.map(r=>r.mod))].sort();

  // KPIs sobre el conjunto filtrado
  const years = [...new Set(rows.map(r=>r.year))].sort();
  const totalAtletas = new Set(rows.map(r=>r.codigo)).size;   // únicos en el filtro
  const totalAtletasDb = (ST.data||[]).length;
  const totalPartic=rows.length;
  const totalF=rows.filter(r=>r.sexo==='F').length;
  const pctF=totalPartic?Math.round(totalF/totalPartic*100):0;
  const uniq={};
  rows.forEach(r=>{if(!uniq[r.year])uniq[r.year]=new Set();uniq[r.year].add(r.codigo);});
  // Clubes activos en el conjunto filtrado
  const clubsActivos = new Set(rows.map(r=>r.club).filter(Boolean)).size;
  // Total kg movidos (suma de totales de competencia)
  const totalKg = rows.reduce((s,r)=>s+(r.total||0),0);
  let maxGY='',maxG=-Infinity;
  years.slice(1).forEach(y=>{
    const prev=years[years.indexOf(y)-1];
    const g=(uniq[y]?.size||0)-(uniq[prev]?.size||0);
    if(g>maxG){maxG=g;maxGY=y;}
  });
  // Retención promedio
  const retRates=years.slice(1).map((y,i)=>{
    const py=years[i];
    const pc=new Set(rows.filter(r=>r.year===py).map(r=>r.codigo));
    const cc=new Set(rows.filter(r=>r.year===y).map(r=>r.codigo));
    return pc.size>0?Math.round([...pc].filter(c=>cc.has(c)).length/pc.size*100):null;
  }).filter(v=>v!==null);
  const avgRet=retRates.length?Math.round(retRates.reduce((s,v)=>s+v,0)/retRates.length):0;
  // Predicción próximo año (regresión lineal sobre únicos)
  const uyVals=years.map(y=>uniq[y]?.size||0);
  const n=years.length,xs=years.map((_,i)=>i);
  const sx=xs.reduce((s,v)=>s+v,0),sy=uyVals.reduce((s,v)=>s+v,0);
  const sxy=xs.reduce((s,x,i)=>s+x*uyVals[i],0),sxx=xs.reduce((s,x)=>s+x*x,0);
  const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx||1);
  const intercept=(sy-slope*sx)/n;
  const pred1=Math.max(0,Math.round(intercept+slope*n));
  const ks='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;text-align:center';
  const card=(t,id,h='300px')=>`<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px"><div style="font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:2px;color:var(--muted);margin-bottom:14px">${t}</div><div style="position:relative;height:${h}"><canvas id="${id}"></canvas></div></div>`;
  const lastYear=years[years.length-1]||'';
  const nextYear=lastYear?String(parseInt(lastYear)+1):'';
  const filterActive = !!(f.yearFrom||f.yearTo||f.sex||f.mod||f.div||f.club);
  // Estilos compartidos para los selects de filtro
  const selStyle='background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;font-family:DM Sans;min-width:110px';
  const selOpt = (v,label,cur)=>`<option value="${v}" ${cur===v?'selected':''}>${label}</option>`;
  return `
  <!-- ═══ Barra de filtros globales (tipo Power BI) ═══ -->
  <div style="background:rgba(8,16,30,.65);backdrop-filter:blur(8px);border:1px solid var(--border);border-radius:14px;padding:14px 18px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;position:sticky;top:0;z-index:50">
    <div style="font-family:Oswald;font-size:11px;letter-spacing:3px;color:var(--gold);font-weight:700">FILTROS</div>
    <select style="${selStyle}" onchange="updStatsFilter('yearFrom',this.value)">
      ${selOpt('','Año desde',f.yearFrom)}
      ${allYears.map(y=>selOpt(y,y,f.yearFrom)).join('')}
    </select>
    <select style="${selStyle}" onchange="updStatsFilter('yearTo',this.value)">
      ${selOpt('','Año hasta',f.yearTo)}
      ${allYears.map(y=>selOpt(y,y,f.yearTo)).join('')}
    </select>
    <select style="${selStyle}" onchange="updStatsFilter('sex',this.value)">
      ${selOpt('','Sexo · todos',f.sex)}
      ${selOpt('M','Hombres',f.sex)}
      ${selOpt('F','Mujeres',f.sex)}
    </select>
    <select style="${selStyle}" onchange="updStatsFilter('mod',this.value)">
      ${selOpt('','Modalidad · todas',f.mod)}
      ${allMods.map(m=>selOpt(m,m,f.mod)).join('')}
    </select>
    <select style="${selStyle}" onchange="updStatsFilter('div',this.value)">
      ${selOpt('','División · todas',f.div)}
      ${allDivs.map(d=>selOpt(d,d,f.div)).join('')}
    </select>
    <select style="${selStyle};min-width:170px" onchange="updStatsFilter('club',this.value)">
      ${selOpt('','Club · todos',f.club)}
      ${allClubs.map(c=>selOpt(c,c,f.club)).join('')}
    </select>
    ${filterActive?`<button onclick="clearStatsFilters()" style="background:rgba(239,68,68,.15);border:1px solid var(--red);color:var(--red);padding:6px 12px;border-radius:6px;font-family:Oswald;font-size:11px;letter-spacing:1px;cursor:pointer;font-weight:700"><i class=yl-i-cerrar></i> LIMPIAR</button>`:''}
    <div style="margin-left:auto;display:flex;gap:6px">
      <button onclick="exportStatsCSV()" title="Exportar datos filtrados a CSV (Excel / Power BI)" style="background:rgba(34,197,94,.15);border:1px solid var(--green);color:var(--green);padding:6px 12px;border-radius:6px;font-family:Oswald;font-size:11px;letter-spacing:1px;cursor:pointer;font-weight:700">CSV</button>
      <button onclick="exportStatsJSON()" title="Exportar a JSON (consumible por Power BI Desktop)" style="background:rgba(59,130,246,.15);border:1px solid var(--blue);color:var(--blue);padding:6px 12px;border-radius:6px;font-family:Oswald;font-size:11px;letter-spacing:1px;cursor:pointer;font-weight:700">JSON</button>
    </div>
  </div>

  ${_baseAtletasHtml()}

  <!-- ═══ KPIs ═══ -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px">
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:var(--gold)">${totalAtletas.toLocaleString()}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">ATLETAS ${filterActive?'(filtro)':'ÚNICOS'}</div>${filterActive?`<div style="color:var(--muted);font-size:9px;margin-top:2px">de ${totalAtletasDb.toLocaleString()} en la base histórica</div>`:''}</div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:#3b82f6">${totalPartic.toLocaleString()}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">PARTICIPACIONES</div></div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:#ec4899">${pctF}%</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">PARTICIPACIÓN FEMENINA</div></div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:#a78bfa">${clubsActivos}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">CLUBES ACTIVOS</div></div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:#f59e0b">${Math.round(totalKg).toLocaleString()}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">KG TOTALES MOVIDOS</div></div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:var(--green)">${maxGY||'—'}${maxG>0?' (+'+maxG+')':''}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">MAYOR CRECIMIENTO</div></div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:#06b6d4">${avgRet}%</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">RETENCIÓN PROMEDIO</div></div>
    <div style="${ks}"><div style="font-family:Oswald;font-size:34px;font-weight:700;color:#a78bfa">~${pred1}</div><div style="color:var(--muted);font-size:11px;margin-top:4px;font-family:Oswald;letter-spacing:1px">PROYECCIÓN ${nextYear}</div></div>
  </div>
  <div style="margin-bottom:12px;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--muted);padding-left:4px">EVOLUCIÓN Y PARTICIPACIÓN</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${card('ATLETAS ÚNICOS POR AÑO','chartUnicos')}
    ${card('PARTICIPACIONES TOTALES POR AÑO','chartPartic')}
  </div>
  <div style="margin-bottom:12px;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--muted);padding-left:4px">CRECIMIENTO Y PROYECCIÓN</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${card('CRECIMIENTO AÑO A AÑO (Δ únicos)','chartCrecimiento')}
    ${card('PROYECCIÓN DE CRECIMIENTO','chartPrediccion')}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${card('RETENCIÓN DE ATLETAS (% que vuelve)','chartRetencion')}
    ${card('DISTRIBUCIÓN POR N° COMPETENCIAS','chartDistComp')}
  </div>
  <div style="margin-bottom:12px;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--muted);padding-left:4px">RANKING DE ATLETAS</div>
  <div style="margin-bottom:16px">
    ${card('TOP 20 — MÁS PARTICIPACIONES','chartTopAtletas','380px')}
  </div>
  <div style="margin-bottom:12px;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--muted);padding-left:4px">DEMOGRAFÍA Y MODALIDADES</div>
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
    ${card('CATEGORÍAS DE PESO — MUJERES','chartCatF','340px')}
    ${card('TOP 10 CLUBES','chartClubs','340px')}
  </div>
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
    ${card('CATEGORÍAS DE PESO — HOMBRES','chartCatM','340px')}
    ${card('DISTRIBUCIÓN POR DIVISIÓN','chartDiv','340px')}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    ${card('EDAD PROMEDIO POR AÑO','chartEdad')}
    ${card('MODALIDAD POR AÑO','chartMod')}
  </div>

  <div style="border-top:1px solid var(--border);margin:8px 0 20px"></div>
  <div style="margin-bottom:4px;font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:3px;color:var(--gold);padding-left:4px">GL POINTS</div>
  <p class="subtitle" style="margin:0 0 16px;padding-left:4px">Lo único que se puede comparar entre sexos, divisiones de edad y modalidades · usa los mismos filtros de arriba</p>
  ${renderGL()}`;
}

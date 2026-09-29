// admin.html — Resultados: corregir uno a mano y procesar los de una competencia.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// ═══════════════════════════════════════════════════════════
// CORREGIR UN RESULTADO A MANO
//
// Para los errores que llegan en el dato de origen: campeonatos viejos, previos
// a YourLift, que entraron desde planillas, y también los que cierra livecast.
//
// No se toca el dato original. La corrección se guarda como una CAPA encima, en
// el mismo athlete_edits que ya usa el panel, y la aplica compartido/ediciones.js al
// cargar cualquier página. Tiene que ser así por dos motivos: los resultados
// históricos viven en data.json, que es un archivo del repositorio y no se puede
// reescribir desde el navegador; y los de livecast son la base del acta oficial,
// que no se toca. Además, hecho así, la corrección se deshace sola borrándola.
// ═══════════════════════════════════════════════════════════
// Igual que en la ficha: si el módulo que cargó es uno viejo del caché del
// service worker, no se cae la pantalla entera por una función que no está.
function _claveRes(c){
  const YL=window.YLEdiciones;
  if(YL&&YL.claveResultado)return YL.claveResultado(c);
  const n=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  return c&&c.id?String(c.id):'ev:'+n(c&&c.evento)+'|'+n(c&&c.modalidad);
}

function _aplicarComps(a){
  const YL=window.YLEdiciones;
  if(YL&&YL.aplicarCompetencias)YL.aplicarCompetencias(a);
}

function _compDeClave(a,clave){
  return (a.competencias||[]).find(c=>_claveRes(c)===clave);
}

// La corrección guardada para este resultado, si ya hay una.
function _ovrDeClave(a,clave){
  const eds=a._competencias_edits||[];
  return eds.find(e=>e && (e.key ? e.key===clave : _claveRes({evento:e.evento})===clave)) || null;
}

window.abrirEdicionResultado=function(clave){
  const a=ST.data?.find(x=>x.codigo===ST.athleteProfile);
  if(!a)return;
  const c=_compDeClave(a,clave);
  if(!c){showToast('No se encontró ese resultado',null,true);return;}
  const r=c.resultado||{};
  const ovr=_ovrDeClave(a,clave);
  const campo=(id,lbl,val,tipo)=>`<div><label style="display:block;font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:3px">${lbl}</label>`
    +`<input id="${id}" type="${tipo||'text'}" ${tipo==='number'?'step="0.5"':''} value="${escapeHtml(val==null?'':String(val))}" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"></div>`;
  const m=document.createElement('div');
  m.id='ovrModal';
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
  m.innerHTML=`<div class="card" style="max-width:640px;width:100%;max-height:90vh;overflow-y:auto;margin:0">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:4px">
      <div><div class="h2" style="margin:0">Corregir resultado</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHtml(a.nombre||'')} · ${escapeHtml(c.evento||'')}</div></div>
      <button onclick="document.getElementById('ovrModal').remove()" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:4px 11px;border-radius:6px;cursor:pointer"><i class=yl-i-cerrar></i></button>
    </div>
    <p style="font-size:11px;color:var(--muted);margin:8px 0 14px;line-height:1.5">Lo que escribas reemplaza al dato original solo para mostrarlo. El resultado de origen y el acta quedan intactos, y borrando la corrección vuelve a como estaba. Deja un campo vacío para no tocarlo.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      ${campo('ovr_evento','CAMPEONATO',ovr?.evento??c.evento)}
      ${campo('ovr_fecha','FECHA',ovr?.fecha??c.fecha)}
      ${campo('ovr_division','DIVISIÓN',ovr?.division??c.division)}
      ${campo('ovr_categoria','CATEGORÍA',ovr?.categoria??c.categoria)}
      ${campo('ovr_modalidad','MODALIDAD',ovr?.modalidad??c.modalidad)}
      ${campo('ovr_posicion','POSICIÓN',ovr?.posicion??(c.posicion||r.pos),'number')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      ${campo('ovr_sq','SENTADILLA',ovr?.sq??r.sq,'number')}
      ${campo('ovr_bp','PRESS BANCA',ovr?.bp??r.bp,'number')}
      ${campo('ovr_dl','PESO MUERTO',ovr?.dl??r.dl,'number')}
      ${campo('ovr_total','TOTAL',ovr?.total??r.total,'number')}
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;cursor:pointer">
      <input type="checkbox" id="ovr_sumar" checked style="width:16px;height:16px;cursor:pointer"> Recalcular el total sumando los tres movimientos
    </label>
    <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;cursor:pointer">
      <input type="checkbox" id="ovr_invitado" ${(ovr?.invitado||c.invitado)?'checked':''} style="width:16px;height:16px;cursor:pointer"> Marcar como Invitado (no puntúa)
    </label>
    <div id="ovr_msg" style="font-size:12px;min-height:16px;margin-top:12px"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      <button onclick="guardarEdicionResultado('${escapeJsAttr(clave)}')" style="padding:9px 18px;background:var(--green);color:#000;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700">Guardar corrección</button>
      ${ovr?`<button onclick="borrarEdicionResultado('${escapeJsAttr(clave)}')" style="padding:9px 16px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:7px;cursor:pointer;font-size:12px">Quitar corrección</button>`:''}
      <button onclick="excluirResultadoAdmin('${escapeJsAttr(clave)}')" style="padding:9px 16px;background:transparent;border:1px solid var(--red);color:var(--red);border-radius:7px;cursor:pointer;font-size:12px;margin-left:auto">Este resultado no es suyo</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.onclick=e=>{if(e.target===m)m.remove();};
};

// Escribe la capa de correcciones del atleta y avisa que cambió.
async function _guardarCapa(a,mut,accion,detalle){
  const eds=(a._competencias_edits||[]).map(e=>({...e}));
  const fuera=[...(a._excluded_results||[])];
  mut(eds,fuera);
  await setDoc(doc(db,'athlete_edits',_editDocId(a)),{
    rut:a.rut||'', codigo:a.codigo||'', nombre:a.nombre||'',
    competencias_edits:eds, excluded_results:fuera, ts:Date.now()
  },{merge:true});
  await _marcarEdicion();
  a._competencias_edits=eds;
  a._excluded_results=fuera;
  try{ await logAction(accion,a.codigo||a.rut||'',null,detalle); }catch(_){}
}

window.guardarEdicionResultado=async function(clave){
  const a=ST.data?.find(x=>x.codigo===ST.athleteProfile);
  if(!a)return;
  const g=id=>document.getElementById(id);
  const txt=id=>(g(id)?.value||'').trim();
  const num=id=>{const v=txt(id);return v===''?'':(isNaN(+v)?'':+v);};
  const msg=g('ovr_msg');
  const ovr={key:clave};
  ['evento','fecha','division','categoria','modalidad'].forEach(k=>{const v=txt('ovr_'+k);if(v)ovr[k]=v;});
  ['sq','bp','dl','posicion'].forEach(k=>{const v=num('ovr_'+k);if(v!=='')ovr[k]=v;});
  // El total: sumado de los tres, o el que se escriba a mano si el acta dice
  // otra cosa (una banca sola no tiene tres movimientos que sumar).
  const suma=['sq','bp','dl'].reduce((t,k)=>t+(typeof ovr[k]==='number'?ovr[k]:0),0);
  if(g('ovr_sumar')?.checked && suma>0) ovr.total=suma;
  else { const v=num('ovr_total'); if(v!=='') ovr.total=v; }
  if(g('ovr_invitado')?.checked) ovr.invitado=true;
  if(Object.keys(ovr).length<2){msg.style.color='var(--red)';msg.textContent='No hay nada que corregir.';return;}
  msg.style.color='var(--muted)';msg.textContent='Guardando…';
  try{
    await _guardarCapa(a,(eds)=>{
      const i=eds.findIndex(e=>e&&e.key===clave);
      if(i>=0)eds[i]=ovr; else eds.push(ovr);
    },'corregir_resultado',(ovr.evento||clave));
    _aplicarComps(a);
    document.getElementById('ovrModal')?.remove();
    showToast('Corrección guardada');
    render();
  }catch(e){msg.style.color='var(--red)';msg.textContent='Error: '+e.message;}
};

window.borrarEdicionResultado=async function(clave){
  const a=ST.data?.find(x=>x.codigo===ST.athleteProfile);
  if(!a)return;
  if(!confirm('¿Quitar la corrección y dejar el resultado como estaba?'))return;
  try{
    await _guardarCapa(a,(eds)=>{
      const i=eds.findIndex(e=>e&&e.key===clave);
      if(i>=0)eds.splice(i,1);
    },'quitar_correccion_resultado',clave);
    document.getElementById('ovrModal')?.remove();
    showToast('Corrección quitada — recarga para ver el dato original');
    render();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

window.excluirResultadoAdmin=async function(clave){
  const a=ST.data?.find(x=>x.codigo===ST.athleteProfile);
  if(!a)return;
  if(!confirm('¿Sacar este resultado de la ficha de '+(a.nombre||'')+'?\n\nSe usa cuando el resultado es de otra persona y se le asignó por coincidencia de nombre. No se borra de ningún lado: deja de aparecer en esta ficha.'))return;
  try{
    await _guardarCapa(a,(eds,fuera)=>{ if(!fuera.includes(clave))fuera.push(clave); },
                       'excluir_resultado',clave);
    _aplicarComps(a);
    document.getElementById('ovrModal')?.remove();
    showToast('Resultado sacado de la ficha');
    render();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

function _glKey(m,s){const eq=(m||'').toLowerCase().includes('equip');const bench=(m||'').toLowerCase().includes('bench')&&!(m||'').toLowerCase().includes('powerlifting');const sex=(s||'').match(/mujer|fem|f/i)?'F':'M';return(bench?(eq?'bench_eq_':'bench_cl_'):(eq?'eq_':'cl_'))+sex;}

function _calcGL(total,bw,m,s){if(!total||!bw)return 0;const c=_GL_COEFS[_glKey(m,s)];if(!c)return 0;const d=c[0]-c[1]*Math.exp(-c[2]*bw);return d>0?Math.round(total*100/d*100)/100:0;}

function nrmName(s){return(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');}

function findAthleteInDB(nombre,rut){
  const nn=nrmName(nombre);
  const rutClean=(rut||'').replace(/[^0-9kK]/gi,'').toUpperCase();
  // Match by RUT first (most reliable)
  if(rutClean.length>3){
    const byRut=ST.data.find(a=>(a.rut||'').replace(/[^0-9kK]/gi,'').toUpperCase()===rutClean);
    if(byRut)return byRut;
  }
  // Match by normalized name
  return ST.data.find(a=>nrmName(a.nombre)===nn)
    ||ST.data.find(a=>{
      const parts=nn.split(' ').filter(p=>p.length>2);
      return parts.length>=2&&parts.every(p=>nrmName(a.nombre).includes(p));
    });
}

function checkRecord(total,bw,categoria,division,modalidad,sexo,lift){
  if(!total||!lift)return null;
  const mod=(modalidad||'').toLowerCase().includes('equip')?'equipped':'classic';
  const sex=(sexo||'').match(/mujer|fem|f/i)?'F':'M';
  // Find matching record entry
  const matches=(RECORDS_DATA.records||[]).filter(r=>{
    return r.categoria===categoria&&r.division===division&&
      (r.modalidad||'').toLowerCase().includes(mod==='equipped'?'equip':'classic')&&
      r.sexo===sexo&&r.levantamiento===lift;
  });
  if(!matches.length)return null;
  const rec=matches[0];
  if(total>rec.marca)return{...rec,newMarca:total};
  return null;
}

// Parser de CSV con soporte para campos entre comillas y delimitador auto
function _impParseCsv(text){
  if(!text) return {headers:[], rows:[]};
  text = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
  // Auto-detectar delimitador: , o ; o tab
  const firstLine = text.split('\n')[0];
  const delim = (firstLine.split('\t').length > firstLine.split(',').length && firstLine.split('\t').length > firstLine.split(';').length) ? '\t'
              : (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const lines = text.split('\n').filter(l=>l.trim());
  const parseLine = (line) => {
    const out = []; let cur = ''; let q = false;
    for(let i=0;i<line.length;i++){
      const c = line[i];
      if(c === '"'){
        if(q && line[i+1] === '"'){ cur += '"'; i++; }
        else q = !q;
      } else if(c === delim && !q){
        out.push(cur); cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out.map(s=>s.trim());
  };
  const headers = parseLine(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,''));
  const rows = lines.slice(1).map(parseLine);
  return {headers, rows, delim};
}

// Mapeo de columnas LiftingCast (acepta varias variantes) → campos LiveCast
function _impMap(headers){
  const find = (...cands)=>{
    for(const c of cands){
      const norm = c.toLowerCase().replace(/[^a-z0-9]/g,'');
      const idx = headers.indexOf(norm);
      if(idx>=0) return idx;
    }
    return -1;
  };
  return {
    nombre: find('lifter','liftername','name','nombre','fullname'),
    rut:    find('rut','memberid','memberno','lifterid','usapl','member','license'),
    sexo:   find('sex','gender','sexo','gen'),
    edad:   find('age','edad'),
    bw:     find('bwkg','bw','bodyweight','bodyweightkg','weight','bweight'),
    cat:    find('bwclass','weightclass','class','wtclass','categoria','category','divisionclass'),
    div:    find('division','agedivision','agedivisn','divname','divisn'),
    mod:    find('equipment','eq','equip','modalidad','modality','rawequiped','tested'),
    club:   find('team','club','gym','equipo'),
    flight: find('flight','vuelo','session','sessionletter','platform','day'),
    lot:    find('lot','lotnumber','lotno','platformorder','order','sessionorder'),
    s1: find('squat1kg','s1','squat1','sq1','squatopener'),
    s2: find('squat2kg','s2','squat2','sq2'),
    s3: find('squat3kg','s3','squat3','sq3'),
    b1: find('bench1kg','b1','bench1','bp1','benchopener'),
    b2: find('bench2kg','b2','bench2','bp2'),
    b3: find('bench3kg','b3','bench3','bp3'),
    d1: find('deadlift1kg','d1','dead1','deadlift1','dl1','deadliftopener'),
    d2: find('deadlift2kg','d2','dead2','deadlift2','dl2'),
    d3: find('deadlift3kg','d3','dead3','deadlift3','dl3'),
  };
}

function _impNormalize(row, m){
  const get = i => i>=0 && i<row.length ? (row[i]||'').trim() : '';
  const nombre = get(m.nombre);
  if(!nombre) return null;
  // Sexo
  let sexo = get(m.sexo).toUpperCase();
  if(sexo==='M'||sexo==='MALE'||sexo==='MAN'||sexo==='HOMBRE') sexo='Hombre';
  else if(sexo==='F'||sexo==='FEMALE'||sexo==='WOMAN'||sexo==='MUJER') sexo='Mujer';
  else sexo='';
  // Modalidad
  const modRaw = get(m.mod).toLowerCase();
  let modalidad = 'Powerlifting Classic';
  if(modRaw.includes('eq')||modRaw.includes('single')||modRaw.includes('multi')||modRaw.includes('equipped')||modRaw.includes('equipado')){
    modalidad = 'Powerlifting Equipped';
  }
  // Categoría: extraer el número y formatear "-83 kg (Hombre)"
  let catRaw = get(m.cat);
  let categoria = catRaw;
  const catMatch = catRaw.match(/([+\-]?\d+\.?\d*)/);
  if(catMatch && sexo){
    const num = catMatch[1];
    const isPlus = catRaw.includes('+') || /\d+\+/.test(catRaw);
    categoria = (isPlus?'':'-') + num + (isPlus?'+':'') + ' kg ('+sexo+')';
  }
  // División: normalizar a Open/Junior/Subjunior/Master I-IV
  const divRaw = get(m.div).toLowerCase();
  let division = get(m.div);
  if(divRaw.includes('open')) division='Open';
  else if(divRaw.includes('subjun')||divRaw.includes('sub-jun')||divRaw.includes('sub jun')||divRaw.includes('teen')) division='Sub Junior';
  else if(divRaw.includes('jun')) division='Junior';
  else if(divRaw.includes('master 4')||divRaw.includes('master iv')||divRaw.includes('m4')) division='Master IV';
  else if(divRaw.includes('master 3')||divRaw.includes('master iii')||divRaw.includes('m3')) division='Master III';
  else if(divRaw.includes('master 2')||divRaw.includes('master ii')||divRaw.includes('m2')) division='Master II';
  else if(divRaw.includes('master')||divRaw.includes('m1')) division='Master I';
  // Flight: tomar la primera letra A-F si existe
  let flight = get(m.flight).toUpperCase().match(/^[A-F]/)?.[0] || 'A';
  // Lot
  const lotRaw = get(m.lot);
  const lot = parseInt(lotRaw,10) || 0;
  // BW
  const bw = parseFloat(get(m.bw)) || 0;
  // Pesos de intentos (si vienen)
  const num = i => { const v = parseFloat(get(i)); return Number.isFinite(v)&&v>0 ? v : 0; };
  const att = {
    sq:[{w:num(m.s1),r:null},{w:num(m.s2),r:null},{w:num(m.s3),r:null}],
    bp:[{w:num(m.b1),r:null},{w:num(m.b2),r:null},{w:num(m.b3),r:null}],
    dl:[{w:num(m.d1),r:null},{w:num(m.d2),r:null},{w:num(m.d3),r:null}],
  };
  return {
    nombre,
    rut: get(m.rut),
    sexo, division, categoria, modalidad,
    club: get(m.club),
    flight, lot, bw,
    edad: parseInt(get(m.edad),10)||null,
    att,
  };
}

window.impLoadFile = function(input){
  const f = input.files && input.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = (e)=>{
    _impState.csvText = String(e.target.result||'');
    _impParseAndPreview();
  };
  r.readAsText(f, 'utf-8');
};

window.impLoadPaste = function(textarea){
  _impState.csvText = textarea.value || '';
  _impParseAndPreview();
};

window.impSelectEvento = function(sel){
  _impState.evento = sel.value;
  render();
};

function _impParseAndPreview(){
  const parsed = _impParseCsv(_impState.csvText);
  if(!parsed.rows.length){ _impState.parsed=null; _impState.preview=null; render(); return; }
  const m = _impMap(parsed.headers);
  const items = parsed.rows.map(r=>_impNormalize(r,m)).filter(Boolean);
  _impState.parsed = {parsed, mapping:m, items};
  render();
}

window.impDoImport = async function(btn){
  if(!_impState.parsed || !_impState.evento){
    alert('Faltan datos: carga un CSV y elige un campeonato destino.');
    return;
  }
  const items = _impState.parsed.items;
  if(!items.length){ alert('No hay filas para importar.'); return; }
  if(!confirm('Importar '+items.length+' atletas al campeonato "'+_impState.evento+'"?\n\nSe crearán como inscripciones APROBADAS (status:approved). Si quieres revisarlas, puedes editarlas después en Nóminas.')) return;
  if(btn){btn.disabled=true; btn.textContent='Importando...';}
  let ok=0, err=0;
  for(const a of items){
    try{
      const id = 'lc_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      const data = {
        evento: _impState.evento,
        nombre: a.nombre,
        rut: a.rut || '',
        sexo: a.sexo || '',
        division: a.division || '',
        categoria: a.categoria || '',
        modalidad: a.modalidad || 'Powerlifting Classic',
        club: a.club || '',
        status: 'approved',
        timestamp: Date.now(),
        importedFromLiftingCast: true,
        sortOrder: a.lot || 0,
      };
      // Si vienen attempts pre-cargados, los guardamos para que LiveCast los levante
      const hasAttempts = ['sq','bp','dl'].some(k => a.att[k].some(x=>x.w>0));
      if(hasAttempts) data.attempts = a.att;
      if(a.flight) data.flight = a.flight;
      if(a.bw>0) data.bw = a.bw;
      await setDoc(doc(db,'inscripciones',id), data);
      ok++;
    }catch(e){ console.error('Import row failed:', a.nombre, e); err++; }
  }
  if(btn){btn.disabled=false; btn.textContent='Importar a Firestore';}
  alert('Importación terminada.\nImportados: '+ok+'\nErrores: '+err+(err?'\n\nRevisa la consola (F12) para detalles.':''));
  _impState = {evento:_impState.evento, csvText:'', parsed:null, status:'', preview:null};
  render();
};

function renderMergeResults(){
  const pending=ST.competitionResults;
  if(!pending.length){
    return `<div class="h1">Resultados de Competencia</div>
      <p class="subtitle">No hay competencias pendientes de procesar.</p>
      <div class="card" style="text-align:center;padding:40px;color:var(--muted)">
        Cuando finalices una competencia desde YourLift aparecerá aquí para procesar.
      </div>`;
  }

  let h=`<div class="h1">Resultados de Competencia</div>
    <p class="subtitle">Procesa los resultados directamente al sistema — actualiza data.json, records.json y los perfiles de atletas</p>`;

  pending.forEach(comp=>{
    const results=comp.results||[];
    const withTotal=results.filter(r=>r.resultado?.total>0);
    const bombed=results.filter(r=>!r.resultado?.total||r.resultado?.total===0);

    // Pre-check records
    const newRecords=[];
    withTotal.forEach(r=>{
      const res=r.resultado;
      ['sq','bp','dl','total'].forEach(lift=>{
        const val=lift==='total'?res.total:res[lift];
        const rec=checkRecord(val,res.bw,res.categoria||r.categoria,res.division||r.division,r.modalidad,r.sexo,lift);
        if(rec)newRecords.push({atleta:r.nombre,lift,val,prev:rec.marca,...rec});
      });
    });

    // Check which athletes are already in DB
    const matched=withTotal.filter(r=>findAthleteInDB(r.nombre,r.rut));
    const notFound=withTotal.filter(r=>!findAthleteInDB(r.nombre,r.rut));

    h+=`<div class="card" style="border-left:4px solid var(--green);margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <div>
          <div class="os" style="font-size:18px;font-weight:700">${comp.eventoName}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">${comp.fecha} · Guardado por ${comp.savedBy||'—'}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <div style="text-align:center;background:var(--bg);padding:8px 14px;border-radius:8px">
            <div class="os" style="font-size:20px;color:var(--green)">${withTotal.length}</div>
            <div style="font-size:9px;color:var(--muted)">Con total</div>
          </div>
          <div style="text-align:center;background:var(--bg);padding:8px 14px;border-radius:8px">
            <div class="os" style="font-size:20px;color:var(--red)">${bombed.length}</div>
            <div style="font-size:9px;color:var(--muted)">Bomb-out</div>
          </div>
          <div style="text-align:center;background:var(--bg);padding:8px 14px;border-radius:8px">
            <div class="os" style="font-size:20px;color:${newRecords.length?'var(--gold)':'var(--muted)'}">${newRecords.length}</div>
            <div style="font-size:9px;color:var(--muted)">Records</div>
          </div>
        </div>
      </div>

      ${newRecords.length?`<div style="background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.3);border-radius:8px;padding:12px;margin-bottom:14px">
        <div style="font-family:Oswald;font-size:11px;letter-spacing:1px;color:var(--gold);margin-bottom:8px">NUEVOS RECORDS NACIONALES</div>
        ${newRecords.map(r=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px solid rgba(212,168,67,.1)">
          <strong>${r.atleta}</strong> — ${r.lift.toUpperCase()} ${r.val} kg 
          <span style="color:var(--muted)">(anterior: ${r.prev} kg)</span>
          <span style="font-size:10px;color:var(--muted)"> · ${r.categoria} ${r.division}</span>
        </div>`).join('')}
      </div>`:''}

      ${notFound.length?`<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--gold)">
        ${notFound.length} atletas no encontrados en data.json — se agregarán como nuevos:<br>
        ${notFound.map(r=>r.nombre).join(', ')}
      </div>`:''}

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-g" onclick="procesarMerge('${comp.id}')" style="font-size:12px">
          Procesar y descargar data.json + records.json
        </button>
        <button class="btn" onclick="verDetalleComp('${comp.id}')" 
          style="font-size:12px;background:transparent;border:1px solid var(--border);color:var(--muted)">
          Ver detalle
        </button>
        <button class="btn" onclick="descartarResultados('${comp.id}')"
          style="font-size:12px;background:transparent;border:1px solid rgba(239,68,68,.3);color:var(--red)">
          Descartar
        </button>
      </div>
    </div>`;
  });
  return h;
}

window.procesarMerge = async function(compId){
  const comp=ST.competitionResults.find(c=>c.id===compId);
  if(!comp){showToast('Competencia no encontrada',null,true);return;}

  const btn=document.querySelector(`[onclick="procesarMerge('${compId}')"]`);
  if(btn){btn.disabled=true;btn.textContent='Procesando...';}

  const results=comp.results||[];
  const withTotal=results.filter(r=>r.resultado?.total>0);
  
  // Deep copy data to avoid mutating ST.data in place yet
  const newData=JSON.parse(JSON.stringify(ST.data));
  const newRecords=JSON.parse(JSON.stringify(RECORDS_DATA));
  let added=0,updated=0,recordsUpdated=0;

  withTotal.forEach(r=>{
    const res=r.resultado;
    // Recalculate GL with correct formula
    const glp=_calcGL(res.total,res.bw,r.modalidad,r.sexo);
    res.glp=glp;

    let athlete=findAthleteInDB(r.nombre,r.rut);

    if(!athlete){
      // Create new athlete
      const newCodigo='FCP-NEW-'+Date.now()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
      athlete={
        nombre:r.nombre,rut:r.rut||'',codigo:newCodigo,
        club:r.club||'',debut:comp.fecha?.slice(0,4)||'',
        competencias:[],bestLifts:{}
      };
      newData.push(athlete);
      added++;
    }else{
      // Ensure we modify the copy
      athlete=newData.find(a=>a.codigo===athlete.codigo);
      updated++;
    }

    // Remove duplicate entry for same event
    athlete.competencias=(athlete.competencias||[]).filter(c=>c.evento!==r.evento);

    // Add competition result
    const compEntry={
      evento:r.evento,fecha:comp.fecha||r.fecha,
      division:r.division||res.division||'',
      categoria:r.categoria||res.categoria||'',
      modalidad:r.modalidad||'',
      sexo:r.sexo||'',
      resultado:{
        bw:res.bw,sq:res.sq||0,bp:res.bp||0,dl:res.dl||0,
        total:res.total,glp,
        intentos:res.intentos||{},
        pesoCorporal:res.bw,
        categoria:res.categoria||r.categoria,
        division:res.division||r.division
      }
    };
    athlete.competencias.push(compEntry);

    // Update bestLifts (only if same modality or better)
    const bl=athlete.bestLifts||{};
    const mod=(r.modalidad||'').toLowerCase().includes('equip')?'eq':'cl';
    if(res.sq&&res.sq>(bl.sq||0))bl.sq=res.sq;
    if(res.bp&&res.bp>(bl.bp||0))bl.bp=res.bp;
    if(res.dl&&res.dl>(bl.dl||0))bl.dl=res.dl;
    if(res.total&&res.total>(bl.total||0)){bl.total=res.total;bl.glp=glp;}
    athlete.bestLifts=bl;

    // Check and update records
    ['sq','bp','dl','total'].forEach(lift=>{
      const val=lift==='total'?res.total:res[lift];
      if(!val)return;
      const rec=checkRecord(val,res.bw,res.categoria||r.categoria,res.division||r.division,r.modalidad,r.sexo,lift);
      if(rec){
        const idx=(newRecords.records||[]).findIndex(x=>x.categoria===rec.categoria&&x.division===rec.division&&x.sexo===rec.sexo&&x.levantamiento===lift);
        if(idx>=0){
          newRecords.records[idx]={...newRecords.records[idx],marca:val,atleta:r.nombre,fecha:comp.fecha,evento:comp.eventoName};
          recordsUpdated++;
        }
      }
    });
  });

  // Auto-upload to Firebase Storage (publish without GitHub)
  let _mergeUploaded=false;
  try{
    await _uploadToStorage(newData, recordsUpdated>0 ? newRecords : null);
    _mergeUploaded=true;
  }catch(e){
    console.warn('[merge] Storage upload failed:',e.message);
    // Fallback: download locally
    const dataBlob=new Blob([JSON.stringify(newData,null,2)],{type:'application/json'});
    const dataUrl=URL.createObjectURL(dataBlob);
    const a1=document.createElement('a');a1.href=dataUrl;a1.download='data.json';a1.click();
    if(recordsUpdated>0){
      setTimeout(()=>{
        const recBlob=new Blob([JSON.stringify(newRecords,null,2)],{type:'application/json'});
        const recUrl=URL.createObjectURL(recBlob);
        const a2=document.createElement('a');a2.href=recUrl;a2.download='records.json';a2.click();
      },500);
    }
  }

  // Mark as processed in Firestore
  try{
    await setDoc(doc(db,'competition_results',compId),
      {status:'processed',processedAt:new Date().toISOString(),processedBy:ST.user.email,
       summary:{added,updated,recordsUpdated}},
      {merge:true}
    );
    await logAction('merge_results',comp.eventoName,null,`${added} new, ${updated} updated, ${recordsUpdated} records`);
  }catch(e){console.warn('Mark processed error',e);}

  // Update local ST.data for immediate effect
  ST.data=newData;
  RECORDS_DATA=newRecords;

  showToast(_mergeUploaded?`Publicado automáticamente: ${added} nuevos, ${updated} actualizados${recordsUpdated>0?`, ${recordsUpdated} records`:''}.`:`Procesado: ${added} nuevos, ${updated} actualizados. Descarga y sube a GitHub.`);
  if(btn){btn.disabled=false;btn.textContent=_mergeUploaded?'Publicado':'Descargado — sube a GitHub';}
};

window.descartarResultados = async function(compId){
  if(!confirm('¿Descartar estos resultados? No se aplicará ningún cambio al sistema.'))return;
  try{
    await setDoc(doc(db,'competition_results',compId),{status:'discarded'},{merge:true});
    showToast('Resultados descartados');
  }catch(e){showToast('Error: '+e.message,null,true);}
};

window.verDetalleComp = function(compId){
  const comp=ST.competitionResults.find(c=>c.id===compId);
  if(!comp)return;
  const r=comp.results||[];
  const rows=r.map(x=>`<tr><td>${x.nombre}</td><td style="text-align:center">${x.resultado?.sq||0}</td><td style="text-align:center">${x.resultado?.bp||0}</td><td style="text-align:center">${x.resultado?.dl||0}</td><td style="font-family:Oswald;font-weight:700;color:var(--gold);text-align:center">${x.resultado?.total||'—'}</td><td style="color:var(--green);text-align:center">${x.resultado?.glp||'—'}</td></tr>`).join('');
  const m=document.createElement('div');
  m.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:9999;overflow-y:auto;padding:20px';
  m.innerHTML=`<div style="max-width:800px;margin:0 auto;background:#0f1e35;border:1px solid #1D3150;border-radius:14px;padding:24px">
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <div class="os" style="font-size:18px">${comp.eventoName}</div>
      <button onclick="this.closest('[style]').remove()" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:4px 12px;border-radius:6px;cursor:pointer"><i class=yl-i-cerrar></i></button>
    </div>
    <div style="overflow-x:auto"><table class="tbl"><tr><th>Atleta</th><th>SQ</th><th>BP</th><th>DL</th><th>Total</th><th>GL Pts</th></tr>${rows}</table></div>
  </div>`;
  document.body.appendChild(m);
  m.onclick=e=>{if(e.target===m)m.remove();};
};

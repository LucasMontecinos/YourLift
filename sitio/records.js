// index.html — récords nacionales: el buscador.
//
// Parte del código de index.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

// Además de sacar las categorías retiradas, deja UN SOLO récord por casillero
// —modalidad, movimiento, división y categoría—, que es la definición misma de un
// récord: no puede haber dos. Había dos repetidos exactos, la misma persona con
// la misma marca cargada dos veces, y se veían como dos filas seguidas iguales.
//
// Se queda el de marca más alta y, a igual marca, el primero: el récord es de
// quien lo puso antes. Esto también es la red de seguridad para cuando los
// récords se actualicen solos al cerrar una competencia — si alguna vez se
// agregara en vez de reemplazar, acá se nota y no se publica el viejo.
function sinRetiradas(rec){
  if(!rec || typeof rec!=='object') return rec;
  const fuera = c => CATS_RETIRADAS.includes(String(c==null?'':c).replace('+',''));
  const out = {};
  for(const tipo in rec){
    const mov = rec[tipo];
    if(!mov || typeof mov!=='object'){ out[tipo]=mov; continue; }
    out[tipo] = {};
    for(const m in mov){
      if(!Array.isArray(mov[m])){ out[tipo][m]=mov[m]; continue; }
      const mejor = new Map();
      mov[m].forEach(x=>{
        if(!x || fuera(x.categoria)) return;
        const k = String(x.division||'')+'|'+String(x.categoria||'');
        const y = mejor.get(k);
        if(!y || (parseFloat(x.marca)||0) > (parseFloat(y.marca)||0)) mejor.set(k,x);
      });
      out[tipo][m] = [...mejor.values()];
    }
  }
  return out;
}

function sexoDeRecord(r){
  if(r&&r.sexo)return /^m/i.test(r.sexo)&&!/^muj/i.test(r.sexo)?'M':'F';   // 'Mujer' vs 'Masculino'
  const c=String(r&&r.categoria||'').replace('+','');
  if(CAT_F.some(x=>x.replace('+','')===c))return 'F';
  if(CAT_M.some(x=>x.replace('+','')===c))return 'M';
  return '';
}

// Orden por peso: las categorías "+" van al final de su tabla.
function recPeso(c){const s=String(c||'');const n=parseFloat(s.replace(/[^0-9.]/g,''))||999;return s.includes('+')?1000+n:n;}

function recNorm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}

// Los filtros no se pierden al cambiar de pestaña, pero sí se limpian los que
// dejan de tener sentido: una división de clásico no existe en universitario.
window.recFiltro=function(k,v){
  ST['r'+k]=v;
  if(k==='s'||k==='t'){ST.rd='';ST.rc='';}
  render();
};

// Solo la lista, nunca el campo: si se rehace el input, el teclado del teléfono
// se cierra en cada letra. Es la misma lección de la búsqueda de atletas.
window.recBuscar=function(v){
  ST.rq=v;
  if(_recTimer)clearTimeout(_recTimer);
  _recTimer=setTimeout(()=>{
    const c=document.getElementById('recLista');
    if(c)c.innerHTML=recLista();else render();
  },220);
};

function recFilas(){
  const arr=(R[ST.rt]&&R[ST.rt][ST.rl])||[];
  const q=recNorm(ST.rq||'');
  return arr
    .filter(r=>sexoDeRecord(r)===(ST.rs||'F'))
    .filter(r=>!ST.rd||r.division===ST.rd)
    .filter(r=>!ST.rc||String(r.categoria)===ST.rc)
    .filter(r=>!q||recNorm(r.nombre).includes(q))
    .sort((a,b)=>recPeso(a.categoria)-recPeso(b.categoria)
                 ||String(a.division||'').localeCompare(String(b.division||'')));
}

function recLista(){
  const d=recFilas();
  if(!d.length)return `<div class="emp">No hay récords con estos filtros</div>`;
  let h=`<div class="rr rh"><div>#</div><div>Atleta</div><div>División</div><div>Cat.</div><div>Campeonato</div><div>Marca</div></div>`;
  d.forEach((rRaw,i)=>{
    const r=applyEditOverlay({...rRaw});   // overlay: nombre actualizado por RUT/código
    const evTxt=(r.campeonato||r.evento||'').substring(0,35);
    const nameLink=`<a href="atleta.html?q=${encodeURIComponent(r.nombre||'')}" style="color:var(--text);text-decoration:none;border-bottom:1px dashed rgba(212,168,67,.4);transition:color .15s" onmouseover="this.style.color='var(--gold)'" onmouseout="this.style.color='var(--text)'">${r.nombre}</a>`;
    h+=`<div class="rr"><div class="rpos">${i+1}</div><div>${nameLink}</div><div>${r.division}</div><div>${r.categoria}</div><div style="font-size:11px;color:var(--muted)">${evTxt}</div><div class="rmk">${r.marca} kg</div></div>`;
  });
  return h;
}

function rec(){
  const ts=[["classic","Clásico"],["equipped","Equipado"],["universitario","Universitario"]];
  const ls=[["sq","Sentadilla"],["bp","Press Banca"],["dl","Peso Muerto"],["total","Total"]];
  const sx=[["F","Mujeres"],["M","Hombres"]];
  if(!ST.rs)ST.rs='F';
  // Las opciones de los desplegables salen de lo que HAY en esta pestaña, no de
  // una lista fija: así no se ofrece una categoría que no tiene ningún récord.
  const enPantalla=((R[ST.rt]&&R[ST.rt][ST.rl])||[]).filter(r=>sexoDeRecord(r)===ST.rs);
  const divs=[...new Set(enPantalla.map(r=>r.division).filter(Boolean))].sort();
  const cats=[...new Set(enPantalla.map(r=>String(r.categoria)).filter(Boolean))].sort((a,b)=>recPeso(a)-recPeso(b));
  const opt=(v,l,sel)=>`<option value="${v}"${sel===v?' selected':''}>${l}</option>`;
  const selCss="padding:7px 11px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:12px;font-family:'DM Sans',sans-serif";

  let h=`<div class="st">${sx.map(([k,l])=>`<button class="sb ${ST.rs===k?'a':''}" onclick="recFiltro('s','${k}')">${l}</button>`).join('')}</div>`;
  h+=`<div class="st">${ts.map(([k,l])=>`<button class="sb ${ST.rt===k?'a':''}" onclick="recFiltro('t','${k}')">${l}</button>`).join('')}</div>`;
  h+=`<div class="st" style="margin-bottom:14px">${ls.map(([k,l])=>`<button class="sb ${ST.rl===k?'a':''}" onclick="recFiltro('l','${k}')">${l}</button>`).join('')}</div>`;
  h+=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
    <select style="${selCss}" onchange="recFiltro('d',this.value)">
      ${opt('','Todas las divisiones',ST.rd||'')}${divs.map(v=>opt(v,v,ST.rd||'')).join('')}
    </select>
    <select style="${selCss}" onchange="recFiltro('c',this.value)">
      ${opt('','Todas las categorías',ST.rc||'')}${cats.map(v=>opt(v,v+' kg',ST.rc||'')).join('')}
    </select>
    <input id="recQ" value="${(ST.rq||'').replace(/"/g,'&quot;')}" oninput="recBuscar(this.value)"
      placeholder="Buscar atleta…" style="${selCss};flex:1;min-width:170px">
    ${(ST.rd||ST.rc||ST.rq)?`<button class="sb" onclick="ST.rd='';ST.rc='';ST.rq='';render()">Limpiar</button>`:''}
  </div>`;

  const n=recFilas().length;
  const ln=ls.find(l=>l[0]===ST.rl)?.[1]||'', tn=ts.find(t=>t[0]===ST.rt)?.[1]||'';
  const sn=sx.find(s=>s[0]===ST.rs)?.[1]||'';
  h+=`<div class="cd2"><div class="ct"><h2>Récords ${ln} ${tn} · ${sn}</h2><span class="bg" style="background:var(--gold);color:var(--bg)">${n}</span></div>`;
  h+=`<div id="recLista">${recLista()}</div>`;
  return h+`</div>`;
}

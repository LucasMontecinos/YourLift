// admin.html — El editor de récords nacionales (records/data).
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// Saca las categorías retiradas y deja UN SOLO récord por casillero —división y
// categoría—, que es la definición de un récord. Se queda el de marca más alta
// y, a igual marca, el primero: es de quien lo puso antes.
function recSinRetiradas(rec){
  if(!rec||typeof rec!=='object')return rec;
  const fuera=c=>CATS_RETIRADAS.includes(String(c==null?'':c).replace('+',''));
  const out={};
  for(const t in rec){
    const mv=rec[t];
    if(!mv||typeof mv!=='object'){out[t]=mv;continue;}
    out[t]={};
    for(const m in mv){
      if(!Array.isArray(mv[m])){out[t][m]=mv[m];continue;}
      const mejor=new Map();
      mv[m].forEach(x=>{
        if(!x||fuera(x.categoria))return;
        const k=String(x.division||'')+'|'+String(x.categoria||'');
        const y=mejor.get(k);
        if(!y||(parseFloat(x.marca)||0)>(parseFloat(y.marca)||0))mejor.set(k,x);
      });
      out[t][m]=[...mejor.values()];
    }
  }
  return out;
}

async function recEnsureLoaded(){
  if(ST._recLoaded) return;
  ST._recLoaded='loading';
  try{
    const snap=await getDoc(doc(db,'records','data'));
    if(snap.exists() && (snap.data().classic||snap.data().equipped)){
      ST.recR=recSinRetiradas(snap.data());
    }else{
      ST.recR=recSinRetiradas(await fetch('records.json',{cache:'no-store'}).then(x=>x.json()).catch(()=>JSON.parse(JSON.stringify(REC_EMPTY))));
    }
  }catch(e){ console.warn('[records] load',e); ST.recR=ST.recR||JSON.parse(JSON.stringify(REC_EMPTY)); }
  ST._recLoaded=true; render();
}

window.recReloadJson=async function(){
  if(!confirm('Recargar desde records.json descartará cambios no guardados. ¿Continuar?')) return;
  const r=await fetch('records.json',{cache:'no-store'}).then(x=>x.json()).catch(()=>null);
  if(!r){ showToast('No se pudo leer records.json',null,true); return; }
  ST.recR=r; ST.recDirty=true; render(); showToast('Cargado desde records.json — recuerda Guardar');
};

window.recSetTipo=function(v){ ST.recTipo=v; render(); };

window.recSetLift=function(v){ ST.recLift=v; render(); };

window.recField=function(tipo,lift,idx,field,value){
  const arr=ST.recR&&ST.recR[tipo]&&ST.recR[tipo][lift]; if(!arr||!arr[idx]) return;
  arr[idx][field]=(field==='marca')?(parseFloat(value)||0):value;
  ST.recDirty=true;
  const ind=document.getElementById('recDirtyInd'); if(ind) ind.style.display='inline';
};

window.recAdd=function(tipo,lift){
  if(!ST.recR) ST.recR=JSON.parse(JSON.stringify(REC_EMPTY));
  ST.recR[tipo]=ST.recR[tipo]||{}; ST.recR[tipo][lift]=ST.recR[tipo][lift]||[];
  ST.recR[tipo][lift].unshift({nombre:'',division:'Open',categoria:'',campeonato:'',marca:0});
  ST.recDirty=true; render();
};

window.recDelete=function(tipo,lift,idx){
  const arr=ST.recR&&ST.recR[tipo]&&ST.recR[tipo][lift]; if(!arr) return;
  if(!confirm('¿Eliminar este récord?')) return;
  arr.splice(idx,1); ST.recDirty=true; render();
};

window.recSave=async function(){
  if(!ST.recR){ return; }
  const btn=document.getElementById('recSaveBtn'); if(btn){btn.textContent='Guardando...';btn.disabled=true;}
  try{
    await setDoc(doc(db,'records','data'), ST.recR);
    ST.recDirty=false;
    try{ await logAction('save_records','records/data','','',{}); }catch(_){}
    showToast('Récords guardados — ya se ven en la web');
  }catch(e){ console.error(e); showToast('Error al guardar: '+e.message,null,true); }
  finally{ if(btn){btn.textContent='Guardar en la web';btn.disabled=false;} render(); }
};

function renderRecordsEditor(){
  if(ST._recLoaded!==true){ setTimeout(recEnsureLoaded,0); return '<div class="h1">Récords nacionales</div><p class="subtitle">Cargando récords…</p>'; }
  const tipo=ST.recTipo||'classic', lift=ST.recLift||'sq';
  const TIPOS=[['classic','Classic'],['equipped','Equipado'],['universitario','Universitario']];
  const LIFTS=[['sq','Sentadilla'],['bp','Press Banca'],['dl','Peso Muerto'],['total','Total']];
  const DIVS=['Open','Sub-Junior','Junior','Master I','Master II','Master III','Master IV'];
  const arr=(ST.recR&&ST.recR[tipo]&&ST.recR[tipo][lift])||[];
  const catW=c=>{const s=String(c||'');if(s.includes('+'))return 1000+(parseFloat(s.replace(/[^0-9.]/g,''))||0);return parseFloat(s.replace(/[^0-9.]/g,''))||999;};
  const rows=arr.map((r,idx)=>({r,idx})).sort((a,b)=>catW(a.r.categoria)-catW(b.r.categoria)||String(a.r.division||'').localeCompare(String(b.r.division||'')));
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div class="h1" style="margin:0">Récords nacionales</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span id="recDirtyInd" style="display:${ST.recDirty?'inline':'none'};color:var(--gold);font-size:12px;font-family:Oswald">● cambios sin guardar</span>
      <button onclick="recReloadJson()" class="btn btn-b" style="padding:8px 12px;font-size:12px">Recargar de records.json</button>
      <button id="recSaveBtn" onclick="recSave()" class="btn btn-g" style="padding:8px 14px;font-size:12px">Guardar en la web</button>
    </div>
  </div>
  <p class="subtitle">Edita en vivo. Al guardar, los récords se publican al instante en yourlift.cl. Cualquier admin puede editar.</p>
  <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:12px">
    <div><div style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-bottom:4px">TIPO</div>
      <div style="display:flex;gap:4px">${TIPOS.map(([k,l])=>`<button onclick="recSetTipo('${k}')" class="btn ${tipo===k?'btn-g':'btn-b'}" style="padding:6px 12px;font-size:12px">${l}</button>`).join('')}</div></div>
    <div><div style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-bottom:4px">MOVIMIENTO</div>
      <div style="display:flex;gap:4px">${LIFTS.map(([k,l])=>`<button onclick="recSetLift('${k}')" class="btn ${lift===k?'btn-g':'btn-b'}" style="padding:6px 12px;font-size:12px">${l}</button>`).join('')}</div></div>
  </div>
  <button onclick="recAdd('${tipo}','${lift}')" class="btn btn-b" style="padding:6px 12px;font-size:12px;margin-bottom:10px">+ Agregar récord</button>
  <div class="card" style="padding:0;overflow-x:auto">
    <table class="tbl">
      <tr><th>Atleta</th><th>División</th><th>Cat.</th><th>Campeonato</th><th>Marca (kg)</th><th></th></tr>
      ${rows.map(({r,idx})=>`<tr>
        <td><input class="inp" style="min-width:180px;font-size:12px" value="${esc(r.nombre||'')}" oninput="recField('${tipo}','${lift}',${idx},'nombre',this.value)"></td>
        <td><select class="inp" style="font-size:12px" onchange="recField('${tipo}','${lift}',${idx},'division',this.value)">${DIVS.includes(r.division)?'':`<option selected>${esc(r.division||'')}</option>`}${DIVS.map(dv=>`<option ${r.division===dv?'selected':''}>${dv}</option>`).join('')}</select></td>
        <td><input class="inp" style="width:64px;font-size:12px" value="${esc(r.categoria||'')}" oninput="recField('${tipo}','${lift}',${idx},'categoria',this.value)"></td>
        <td><input class="inp" style="min-width:220px;font-size:11px" value="${esc(r.campeonato||r.evento||'')}" oninput="recField('${tipo}','${lift}',${idx},'campeonato',this.value)"></td>
        <td><input class="inp" style="width:84px;font-size:13px;font-weight:700" value="${esc(r.marca!=null?r.marca:'')}" oninput="recField('${tipo}','${lift}',${idx},'marca',this.value)"></td>
        <td><button onclick="recDelete('${tipo}','${lift}',${idx})" style="background:transparent;border:1px solid rgba(239,68,68,.3);color:var(--red);padding:4px 8px;border-radius:5px;font-size:11px;cursor:pointer" title="Quitar"><i class=yl-i-cerrar></i></button></td>
      </tr>`).join('')}
    </table>
    ${rows.length===0?'<div class="empty">Sin récords en esta categoría. Usa "+ Agregar récord".</div>':''}
  </div>`;
}

window.pubHexToRgb = function(hex){
  hex=String(hex||'').replace('#','');
  if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  return [parseInt(hex.slice(0,2),16)||0, parseInt(hex.slice(2,4),16)||0, parseInt(hex.slice(4,6),16)||0];
};

// ─── Carta de Atleta (estilo coleccionable / FUT) ──────────
// Lienzo 1080×1350. Solo CSS soportado por html2canvas: linear/radial-gradient,
// border-radius, box-shadow, background-image. Sin clip-path, sin background-clip:text.
// El color de fondo se controla con el selector "Fondo" de ESTILO (d.bgPreset / d.bgColor).
window.pubCardHtml = function(d){
  const e=window.esc||(s=>String(s==null?'':s));
  const BG_CARD={
    azul:   {top:'#16263f', mid:'#0b1628', bot:'#050b16'},
    negro:  {top:'#24262b', mid:'#0d0e11', bot:'#020203'},
    rojo:   {top:'#3a141c', mid:'#19070c', bot:'#080205'},
    dorado: {top:'#3a2e10', mid:'#191305', bot:'#070500'},
    violeta:{top:'#281c44', mid:'#120b26', bot:'#06040f'},
    verde:  {top:'#103a2a', mid:'#071a13', bot:'#020a07'}
  };
  // Color elegido (control "Fondo") → BRILLOS/glows + fondo de respaldo si no hay foto.
  const glowHex=d.bgColor||(BG_CARD[d.bgPreset]||BG_CARD.azul).top;
  const G=pubHexToRgb(glowHex), gl=a=>`rgba(${G[0]},${G[1]},${G[2]},${a})`;
  let innerBg;
  if(d.bgColor){ const b=pubHexToRgb(d.bgColor); const sh=f=>'rgb('+b.map(v=>Math.round(v*(1-f))).join(',')+')'; innerBg=`radial-gradient(ellipse at 50% 0%,${d.bgColor} 0%,${sh(.5)} 52%,${sh(.8)} 100%)`; }
  else { const p=BG_CARD[d.bgPreset]||BG_CARD.azul; innerBg=`radial-gradient(ellipse at 50% 0%,${p.top} 0%,${p.mid} 52%,${p.bot} 100%)`; }
  const parts=String(d.cardName||'').trim().split(/\s+/);
  const lastName=(parts.pop()||'').toUpperCase();
  const firstName=parts.join(' ');
  // Insignia (estrella + texto). Se puede ocultar con cardShowBadge=false.
  const badgeSub=String(d.cardBadge||'').trim();
  const badgeHtml = (d.cardShowBadge!==false) ? `
    <div style="position:absolute;top:42px;left:42px;width:150px;height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(160deg,rgba(20,30,52,.9),rgba(10,18,34,.9));border:3px solid #e8c573;border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,.55)">
      <div style="color:#ffd86b;font-size:${badgeSub?54:78}px;line-height:1">${_pubEstrella(badgeSub?54:78,'#ffd86b')}</div>
      ${badgeSub?`<div style="font-family:Oswald;font-weight:700;letter-spacing:2px;color:#fff;font-size:15px;text-align:center;line-height:1.15;margin-top:8px;padding:0 8px">${e(badgeSub)}</div>`:''}
    </div>` : '';
  // Foto: base difuminada (cubre toda la carta) + foto nítida arrastrable (offset px + zoom).
  const ox=+d.cardPhotoOX||0, oy=+d.cardPhotoOY||0, pz=(+d.cardPhotoZoom||100)/100;
  const blurSrc=d.cardPhotoBlur||d.cardPhoto;
  const baseLayer = d.cardPhoto
    ? `<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-image:url(${blurSrc});background-size:cover;background-position:center center;background-repeat:no-repeat"></div>`
    : '';
  const focal = d.cardPhoto
    ? `<div onmousedown="pubPhotoDragStart(event)" style="position:absolute;top:0;left:0;right:0;height:1015px;overflow:hidden;cursor:grab">
         <img src="${d.cardPhoto}" alt="" draggable="false" onmousedown="pubPhotoDragStart(event)" style="position:absolute;left:50%;top:46%;width:1036px;height:auto;transform:translate(-50%,-50%) translate(${ox}px,${oy}px) scale(${pz});cursor:grab;user-select:none"></div>`
    : `<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-family:Oswald;letter-spacing:4px;color:rgba(255,255,255,.4);font-size:34px">SUBE LA FOTO</div>`;
  // Brillos del color elegido (sobre la foto) — pointer-events:none para no bloquear el arrastre.
  const glowLayer = `<div style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;background:radial-gradient(circle 620px at 120px 120px,${gl(.34)},${gl(0)}),radial-gradient(circle 680px at 940px 1180px,${gl(.30)},${gl(0)}),radial-gradient(circle 780px at 540px 1430px,${gl(.20)},${gl(0)})"></div>`;
  // Oscurecido suave solo para legibilidad (no es un fondo sólido; la foto sigue visible).
  const shade = `<div style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;background:linear-gradient(to bottom,rgba(4,9,18,.36) 0%,rgba(4,9,18,0) 15%,rgba(4,9,18,0) 48%,rgba(4,9,18,.40) 72%,rgba(4,9,18,.70) 100%)"></div>`;
  const ny=+d.cardNameY||720;
  const nx=+d.cardNameX||0;
  const ns=(+d.cardNameScale||100)/100;
  const F1=Math.round(46*ns), F2=Math.round(118*ns), F3=Math.round(30*ns);
  const stats=[['SQUAT',d.cardSquat],['BENCH',d.cardBench],['DEADLIFT',d.cardDeadlift],['TOTAL',d.cardTotal]];
  const logoYL=`<img src="yourlift_logo_hd.png" alt="YourLift" style="height:66px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,.55))" onerror="this.onerror=null;this.src='YourLift_logo.png'">`;
  return `
  <div style="width:1080px;height:1350px;position:relative;font-family:'DM Sans',sans-serif;background:linear-gradient(135deg,#9fe9ff 0%,#c3a3ff 17%,#ffb0e0 34%,#b8ffd2 52%,#ffe6a8 70%,#a9ecff 88%,#c3a3ff 100%);border-radius:54px;overflow:hidden">
    <div style="position:absolute;top:22px;left:22px;right:22px;bottom:22px;border-radius:42px;overflow:hidden;background:${innerBg}">
      ${baseLayer}
      ${focal}
      ${glowLayer}
      ${shade}
      ${badgeHtml}
      <div style="position:absolute;top:46px;right:46px;display:flex;flex-direction:column;align-items:flex-end;gap:14px">
        <div style="text-align:right">
          <div style="font-family:Oswald;font-weight:700;letter-spacing:4px;color:#ffd86b;font-size:26px;line-height:1">GLP</div>
          <div style="font-family:Oswald;font-weight:700;color:#fff;font-size:66px;line-height:.9;text-shadow:0 2px 12px rgba(0,0,0,.8)">${e(d.cardGLP)}</div>
        </div>
        ${d.cardCategory?`<div style="font-family:Oswald;font-weight:700;letter-spacing:2px;color:#fff;font-size:30px;background:rgba(8,16,30,.62);border:2px solid #e8c573;border-radius:12px;padding:6px 16px">${e(d.cardCategory)}</div>`:''}
        ${pubFlagHtml(d.cardFlag)}
      </div>
      <div data-cardname="1" onmousedown="pubNameDragStart(event)" style="position:absolute;left:${56+nx}px;top:${ny}px;cursor:grab;user-select:none">
        ${firstName?`<div style="font-family:'DM Sans';font-style:italic;font-weight:500;color:#d7e6ff;font-size:${F1}px;line-height:1;margin:0 0 10px;white-space:nowrap;text-shadow:0 2px 12px rgba(0,0,0,.85)">${e(firstName)}</div>`:''}
        <div style="font-family:Oswald;font-weight:700;color:#ffffff;font-size:${F2}px;letter-spacing:3px;line-height:1;white-space:nowrap;text-shadow:0 3px 20px rgba(0,0,0,.9)">${e(lastName)}</div>
        ${d.cardNick?`<div style="font-family:Oswald;font-weight:700;letter-spacing:3px;color:#ffd86b;font-size:${F3}px;margin-top:12px;line-height:1;white-space:nowrap;text-shadow:0 2px 10px rgba(0,0,0,.7)">${e(d.cardNick)}</div>`:''}
      </div>
      <div style="position:absolute;left:0;right:0;bottom:300px;text-align:center;color:#ffd86b;font-size:30px">${_pubEstrella(30,'#ffd86b')}</div>
      <div style="position:absolute;left:40px;right:40px;bottom:150px;background:linear-gradient(180deg,rgba(10,20,36,.86),rgba(6,12,22,.92));border:1px solid rgba(232,197,115,.5);border-radius:18px;padding:22px 8px;display:flex;box-shadow:0 8px 30px rgba(0,0,0,.45)">
        ${stats.map((s,i)=>`<div style="flex:1;text-align:center;${i>0?'border-left:1px solid rgba(255,255,255,.12)':''}">
          <div style="font-family:Oswald;font-style:italic;font-weight:700;letter-spacing:1px;color:#ffd86b;font-size:24px">${s[0]}</div>
          <div style="font-family:Oswald;font-weight:700;color:#fff;font-size:62px;line-height:1.1">${e(s[1])||'—'}</div>
          <div style="font-family:Oswald;letter-spacing:2px;color:rgba(220,230,245,.6);font-size:18px">kg</div>
        </div>`).join('')}
      </div>
      <div style="position:absolute;left:0;right:0;bottom:46px;text-align:center">${logoYL}</div>
    </div>
    <div style="position:absolute;top:22px;left:22px;right:22px;bottom:22px;border-radius:42px;border:2px solid rgba(255,255,255,.18);pointer-events:none"></div>
  </div>`;
};

// ─── Renderer de templates ─────────────────────────────────
// ─── Atletas más fuertes (campeón overall: foto del sistema + marcas + GL) ───
window.pubFuerteHtml = function(d){
  const e=window.esc||(s=>String(s==null?'':s));
  const BG_CARD={azul:{top:'#16263f',mid:'#0b1628',bot:'#050b16'},negro:{top:'#24262b',mid:'#0d0e11',bot:'#020203'},rojo:{top:'#3a141c',mid:'#19070c',bot:'#080205'},dorado:{top:'#3a2e10',mid:'#191305',bot:'#070500'},violeta:{top:'#281c44',mid:'#120b26',bot:'#06040f'},verde:{top:'#103a2a',mid:'#071a13',bot:'#020a07'}};
  const glowHex=d.bgColor||(BG_CARD[d.bgPreset]||BG_CARD.azul).top;
  const G=pubHexToRgb(glowHex), gl=a=>`rgba(${G[0]},${G[1]},${G[2]},${a})`;
  let bg;
  if(d.bgColor){const b=pubHexToRgb(d.bgColor);const sh=f=>'rgb('+b.map(v=>Math.round(v*(1-f))).join(',')+')';bg=`radial-gradient(ellipse at 50% 0%,${d.bgColor} 0%,${sh(.55)} 55%,${sh(.85)} 100%)`;}
  else {const p=BG_CARD[d.bgPreset]||BG_CARD.azul;bg=`radial-gradient(ellipse at 50% 0%,${p.top} 0%,${p.mid} 55%,${p.bot} 100%)`;}
  const parts=String(d.cardName||'').trim().split(/\s+/);
  const first=(parts.shift()||'').toUpperCase();
  const rest=parts.join(' ').toUpperCase();
  const photo = d.cardPhoto
    ? `<img src="${e(d.cardPhoto)}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover">`
    : `<div style="width:100%;height:100%;background:#2a3c56;position:relative;overflow:hidden">
         <div style="position:absolute;left:50%;top:66px;transform:translateX(-50%);width:130px;height:130px;border-radius:50%;background:#8aa0bd"></div>
         <div style="position:absolute;left:50%;bottom:-28px;transform:translateX(-50%);width:230px;height:180px;border-radius:115px 115px 0 0;background:#8aa0bd"></div>
       </div>`;
  const stat=(lbl,val)=>`<div style="flex:1;background:rgba(10,22,40,.7);border:1px solid rgba(212,168,67,.45);border-radius:14px;padding:16px 6px">
      <div style="font-family:Oswald;font-weight:700;font-size:54px;line-height:1;color:#D4A843">${e(val)||'—'}<span style="font-size:22px;color:rgba(212,168,67,.7)">kg</span></div>
      <div style="font-family:Oswald;letter-spacing:3px;font-size:17px;color:rgba(200,214,230,.8);margin-top:6px">${lbl}</div>
    </div>`;
  const logoYL=`<img src="yourlift_logo_hd.png" alt="YourLift" crossorigin="anonymous" style="height:60px;object-fit:contain" onerror="this.onerror=null;this.src='YourLift_logo.png'">`;
  return `
  <div style="width:1080px;height:1350px;position:relative;font-family:'DM Sans',sans-serif;color:#fff;background:${bg};overflow:hidden">
    <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle 620px at 120px 120px,${gl(.26)},${gl(0)}),radial-gradient(circle 680px at 960px 1180px,${gl(.22)},${gl(0)})"></div>
    <div style="position:relative;z-index:2;height:100%;display:flex;flex-direction:column">
      <div style="background:linear-gradient(90deg,#caa23e,#e9c766,#caa23e);text-align:center;padding:24px 0;font-family:Oswald;font-weight:700;font-size:34px;letter-spacing:7px;color:#241803">${_pubEstrella(28,'#241803')} ${e(d.cardOverall||'CAMPEÓN OVERALL')} ${_pubEstrella(28,'#241803')}</div>
      <div style="height:6px;background:#D4A843"></div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 60px">
        <div style="width:360px;height:360px;border-radius:50%;overflow:hidden;border:8px solid #D4A843;box-shadow:0 0 0 10px rgba(212,168,67,.14),0 20px 50px rgba(0,0,0,.5);background:#0a1628">${photo}</div>
        <div style="margin-top:28px">
          ${first?`<div style="font-family:Oswald;font-weight:700;font-size:52px;line-height:1;color:#fff">${e(first)}</div>`:''}
          <div style="font-family:Oswald;font-weight:700;font-size:80px;line-height:1.02;color:#fff;letter-spacing:1px">${e(rest)}</div>
        </div>
        <div style="margin-top:14px;font-family:Oswald;font-size:32px;letter-spacing:3px;color:#D4A843">${e(d.cardClub||'')}</div>
        ${d.cardCategory?`<div style="margin-top:14px;display:inline-block;border:2px solid rgba(212,168,67,.7);color:#ffd86b;border-radius:40px;padding:8px 26px;font-family:Oswald;font-size:24px;letter-spacing:4px">${e(d.cardCategory)}</div>`:''}
        <div style="display:flex;gap:14px;margin-top:24px;width:100%;max-width:860px">
          ${stat('SENTADILLA',d.cardSquat)}${stat('BANCA',d.cardBench)}${stat('PESO MUERTO',d.cardDeadlift)}
        </div>
        <div style="display:flex;gap:14px;margin-top:14px">
          <div style="background:rgba(8,16,30,.85);border:2px solid #D4A843;border-radius:14px;padding:14px 38px;min-width:280px">
            <div style="font-family:Oswald;font-weight:700;font-size:60px;line-height:1;color:#fff">${e(d.cardTotal)||'—'}<span style="font-size:24px;color:rgba(235,240,250,.7)">kg</span></div>
            <div style="font-family:Oswald;letter-spacing:4px;font-size:17px;color:rgba(200,214,230,.8);margin-top:4px">TOTAL</div>
          </div>
          <div style="background:rgba(212,168,67,.12);border:2px solid #D4A843;border-radius:14px;padding:14px 38px;min-width:280px">
            <div style="font-family:Oswald;font-weight:700;font-size:60px;line-height:1;color:#ffd86b">${e(d.cardGLP)||'—'}</div>
            <div style="font-family:Oswald;letter-spacing:4px;font-size:17px;color:rgba(200,214,230,.8);margin-top:4px">GL POINTS</div>
          </div>
        </div>
      </div>
      <div style="padding:0 0 40px;text-align:center">${logoYL}</div>
    </div>
  </div>`;
};

window.pubRenderTemplate = function(tpl, d){
  const BG_PRESETS = {
    azul:    'radial-gradient(ellipse at top left,#0F2444 0%,#06101F 50%,#040912 100%)',
    negro:   'radial-gradient(ellipse at top,#1c1c1c 0%,#000 100%)',
    rojo:    'radial-gradient(ellipse at top left,#3a0d14 0%,#160407 100%)',
    dorado:  'radial-gradient(ellipse at top left,#3a2e0d 0%,#161203 100%)',
    violeta: 'radial-gradient(ellipse at top left,#241a44 0%,#0a0614 100%)',
    verde:   'radial-gradient(ellipse at top left,#0d3a24 0%,#04140c 100%)'
  };
  let bg;
  if(d.bgImageUrl) bg = `background:#06101F;background-image:url(${d.bgImageUrl});background-size:cover;background-position:center`;
  else if(d.bgColor) bg = `background:${d.bgColor}`;
  else bg = `background:${BG_PRESETS[d.bgPreset]||BG_PRESETS.azul}`;
  const overlay = `background:
    radial-gradient(circle at 18% 22%,rgba(196,30,58,.22) 0%,transparent 38%),
    radial-gradient(circle at 82% 78%,rgba(212,168,67,.16) 0%,transparent 42%),
    radial-gradient(circle at 70% 18%,rgba(30,91,168,.12) 0%,transparent 38%)`;
  const logoYL = `<div style="font-family:Oswald;font-weight:700;letter-spacing:5px;color:#fff;font-size:34px"><span style="color:#C41E3A">YOUR</span>LIFT</div>`;
  const logo = d.customLogoUrl
    ? `<img src="${d.customLogoUrl}" crossorigin="anonymous" style="max-width:88%;max-height:560px;object-fit:contain;filter:drop-shadow(0 12px 30px rgba(0,0,0,.5))" onerror="this.style.display='none'">`
    : `<div style="padding:60px 80px;background:#2A1414;border:3px solid #D4A843;border-radius:24px;font-family:Oswald;color:#fff;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)">
        <div style="font-size:22px;letter-spacing:6px;color:#D4A843;margin-bottom:10px">${_pubEstrella(18,'#D4A843')} ${d.eventSubtitle||'EDICIÓN'} ${_pubEstrella(18,'#D4A843')}</div>
        <div style="font-size:96px;font-weight:700;letter-spacing:6px;line-height:.95;color:#E8E8E8;text-shadow:0 4px 14px rgba(0,0,0,.5)">${(d.eventName||'EVENTO').toUpperCase()}</div>
        <div style="font-size:18px;letter-spacing:5px;color:#D4A843;margin-top:14px">${(d.organizer||'').toUpperCase()}</div>
       </div>`;
  const common = (header, content, footer)=>`
    <div style="width:1080px;height:1350px;${bg};color:#fff;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;${overlay}"></div>
      <div style="position:relative;z-index:2;height:100%;display:flex;flex-direction:column">
        ${header}
        ${content}
        ${footer}
      </div>
    </div>`;
  const banda = (txt, color)=>`<div style="background:${color||'#C41E3A'};padding:18px 0;text-align:center;font-family:Oswald;font-size:24px;letter-spacing:6px;color:#fff;font-weight:700">${txt}</div>
    <div style="height:4px;background:#D4A843"></div>`;
  const credYL = `<div style="margin-top:auto;padding:36px 60px 40px">
    <div style="background:rgba(10,22,40,.9);border:2px solid #D4A843;border-radius:14px;padding:18px 26px;display:flex;align-items:center;gap:18px">
      <div style="flex-shrink:0">${logoYL}</div>
      <div>
        <div style="font-family:Oswald;font-size:12px;letter-spacing:3px;color:#D4A843">TRANSMISIÓN EN VIVO POR</div>
        <div style="font-family:Oswald;font-size:30px;font-weight:700;letter-spacing:4px;color:#fff;margin-top:2px">${d.liveBy||'YOURLIFT.CL'}</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:14px;font-family:Oswald;font-size:13px;letter-spacing:2px;color:rgba(180,200,220,.7)">${d.igHandles||'@yourlift_oficial'}</div>
  </div>`;

  if(tpl === 'cartaAtleta') return pubCardHtml(d);
  if(tpl === 'atletaFuerte') return pubFuerteHtml(d);

  if(tpl === 'estaremosPresentes'){
    return common(
      banda(_pubEstrella(20)+'  ESTAREMOS PRESENTES  '+_pubEstrella(20)),
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 50px">
        ${logo}
        <div style="margin-top:50px;text-align:center">
          <div style="font-family:Oswald;font-size:18px;letter-spacing:6px;color:#D4A843">CAMPEONATO</div>
          <div style="font-family:Oswald;font-size:64px;font-weight:700;letter-spacing:4px;color:#fff;margin-top:8px">${d.date||''}</div>
          <div style="font-family:Oswald;font-size:22px;letter-spacing:4px;color:rgba(220,230,245,.9);margin-top:14px">${d.location||''}</div>
        </div>
      </div>`,
      credYL
    );
  }
  if(tpl === 'inscripcionesAbiertas'){
    return common(
      banda(_pubEstrella(20)+'  INSCRIPCIONES ABIERTAS  '+_pubEstrella(20)),
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 50px">
        ${logo}
        <div style="margin-top:40px;text-align:center;max-width:880px">
          <div style="font-family:Oswald;font-size:50px;font-weight:700;letter-spacing:3px;color:#fff;line-height:1.05">${d.date||''}</div>
          <div style="font-family:Oswald;font-size:20px;letter-spacing:4px;color:rgba(220,230,245,.85);margin-top:12px">${d.location||''}</div>
          ${d.docsList?`<div style="margin-top:30px;background:rgba(10,22,40,.7);border:1px solid rgba(212,168,67,.5);border-radius:14px;padding:20px 28px">
            <div style="font-family:Oswald;font-size:15px;letter-spacing:3px;color:#D4A843;margin-bottom:8px">DOCUMENTACIÓN REQUERIDA</div>
            <div style="font-family:Oswald;font-size:22px;letter-spacing:2px;color:#fff;line-height:1.4">${d.docsList}</div>
          </div>`:''}
          <div style="margin-top:30px;font-family:Oswald;font-size:18px;letter-spacing:4px;color:#D4A843">INSCRÍBETE EN YOURLIFT.CL</div>
        </div>
      </div>`,
      credYL
    );
  }
  if(tpl === 'proximoTorneo'){
    return common(
      banda(_pubEstrella(20)+'  PRÓXIMO CAMPEONATO  '+_pubEstrella(20)),
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 50px">
        ${logo}
        <div style="margin-top:40px;text-align:center">
          <div style="font-family:Oswald;font-size:80px;font-weight:700;letter-spacing:4px;color:#fff;line-height:1">${d.date||''}</div>
          <div style="font-family:Oswald;font-size:24px;letter-spacing:5px;color:#D4A843;margin-top:18px">${d.location||''}</div>
          <div style="font-family:Oswald;font-size:20px;letter-spacing:5px;color:rgba(220,230,245,.85);margin-top:14px">ORGANIZA: ${d.organizer||''}</div>
        </div>
      </div>`,
      credYL
    );
  }
  if(tpl === 'resultadosPodio'){
    const podio = [
      {pos:'1°', name:d.athlete1, total:d.athlete1Total, club:d.athlete1Club, color:'#D4A843'},
      {pos:'2°', name:d.athlete2, total:d.athlete2Total, club:d.athlete2Club, color:'#c0c0c0'},
      {pos:'3°', name:d.athlete3, total:d.athlete3Total, club:d.athlete3Club, color:'#cd7f32'}
    ];
    return common(
      banda(' PODIO OFICIAL  '),
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:40px 50px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-family:Oswald;font-size:18px;letter-spacing:5px;color:#D4A843">${d.eventName||''}</div>
          <div style="font-family:Oswald;font-size:38px;font-weight:700;letter-spacing:3px;color:#fff;margin-top:6px">${d.category||''}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:18px;width:100%;max-width:840px">
          ${podio.map(p=>`<div style="display:flex;align-items:center;gap:24px;background:linear-gradient(90deg,rgba(10,22,40,.95),rgba(17,34,59,.85));border:2px solid ${p.color};border-radius:14px;padding:20px 28px;box-shadow:0 8px 30px rgba(0,0,0,.4)">
            <div style="font-family:Oswald;font-size:48px;font-weight:700;color:${p.color};min-width:120px">${p.pos}</div>
            <div style="flex:1">
              <div style="font-family:Oswald;font-size:32px;font-weight:700;color:#fff;letter-spacing:1px">${p.name||''}</div>
              <div style="font-family:Oswald;font-size:16px;color:rgba(220,230,245,.6);letter-spacing:2px;margin-top:3px">${p.club||''}</div>
            </div>
            <div style="text-align:right">
              <div style="font-family:Oswald;font-size:42px;font-weight:700;color:${p.color}">${p.total||''}</div>
              <div style="font-family:Oswald;font-size:11px;letter-spacing:3px;color:rgba(220,230,245,.6)">KG TOTAL</div>
            </div>
          </div>`).join('')}
        </div>
      </div>`,
      credYL
    );
  }
  if(tpl === 'recordNuevo'){
    return common(
      banda(' NUEVO RÉCORD NACIONAL  ', '#0d4a26'),
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 50px">
        <div style="font-family:Oswald;font-size:30px;letter-spacing:8px;color:#D4A843;margin-bottom:20px">RÉCORD ${d.recordType||'SQUAT'}</div>
        <div style="background:linear-gradient(180deg,rgba(34,197,94,.25),rgba(8,16,30,.85));border:4px solid #22c55e;border-radius:24px;padding:50px 80px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 80px rgba(34,197,94,.2)">
          <div style="font-family:Oswald;font-size:200px;font-weight:700;color:#22c55e;line-height:1;text-shadow:0 0 40px rgba(34,197,94,.5)">${d.recordMark||''}<span style="font-size:60px;color:rgba(34,197,94,.7);margin-left:10px">kg</span></div>
          <div style="font-family:Oswald;font-size:42px;font-weight:700;color:#fff;letter-spacing:3px;margin-top:14px">${d.recordAthlete||''}</div>
          <div style="font-family:Oswald;font-size:20px;letter-spacing:4px;color:rgba(220,230,245,.85);margin-top:8px">${d.category||''}</div>
        </div>
        <div style="margin-top:30px;font-family:Oswald;font-size:18px;letter-spacing:4px;color:#D4A843">${d.eventName||''} · ${d.date||''}</div>
      </div>`,
      credYL
    );
  }
  if(tpl === 'anuncioGenerico'){
    return common(
      banda(' ANUNCIO  '),
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 60px;text-align:center">
        ${d.title?`<div style="font-family:Oswald;font-size:72px;font-weight:700;letter-spacing:4px;color:#fff;line-height:1.05;margin-bottom:30px">${d.title}</div>`:''}
        ${d.subtitle?`<div style="font-family:Oswald;font-size:32px;letter-spacing:4px;color:#D4A843;margin-bottom:30px">${d.subtitle}</div>`:''}
        ${d.body?`<div style="font-family:'DM Sans';font-size:24px;line-height:1.55;color:rgba(240,245,255,.92);max-width:920px">${d.body.replace(/\n/g,'<br>')}</div>`:''}
      </div>`,
      credYL
    );
  }
  const SEC = {
    inicio:       {banda:'YOURLIFT.CL',            accent:'#C41E3A', tagline:'LA TECNOLOGÍA DEL POWERLIFTING CHILENO'},
    nomina:       {banda:'NÓMINA OFICIAL',         accent:'#3b82f6', tagline:'REVISA TU CATEGORÍA Y TU VUELO'},
    transmisiones:{banda:'TRANSMISIÓN EN VIVO',    accent:'#C41E3A', tagline:'SÍGUELO POR YOUTUBE'},
    atletas:      {banda:'PERFILES DE ATLETAS',    accent:'#D4A843', tagline:'BUSCA TU PERFIL Y TU EVOLUCIÓN'},
    records:      {banda:'RÉCORDS NACIONALES',     accent:'#22c55e', tagline:'LAS MEJORES MARCAS DEL PAÍS'},
    ranking:      {banda:'RANKING NACIONAL GL',    accent:'#D4A843', tagline:'EL TOP DEL POWERLIFTING CHILENO'},
    calculadora:  {banda:'CALCULADORA GL / IPF',   accent:'#3b82f6', tagline:'CALCULA TUS PUNTOS GL'}
  };
  if(SEC[tpl]){
    const s = SEC[tpl];
    return common(
      banda(_pubEstrella(20)+'  '+s.banda+'  '+_pubEstrella(20), s.accent),
      `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 60px;text-align:center">
        ${d.customLogoUrl?logo:''}
        <div style="font-family:Oswald;font-size:20px;letter-spacing:6px;color:#D4A843;margin-bottom:10px;${d.customLogoUrl?'margin-top:40px':''}">${s.tagline}</div>
        ${d.secTitle?`<div style="font-family:Oswald;font-size:76px;font-weight:700;letter-spacing:3px;color:#fff;line-height:1.05;margin-bottom:24px">${d.secTitle}</div>`:''}
        ${d.secText?`<div style="font-family:'DM Sans';font-size:26px;line-height:1.5;color:rgba(240,245,255,.92);max-width:880px;margin-bottom:28px">${d.secText.replace(/\n/g,'<br>')}</div>`:''}
        <div style="font-family:Oswald;font-size:30px;font-weight:700;letter-spacing:4px;color:${s.accent};background:rgba(10,22,40,.7);border:2px solid ${s.accent};border-radius:14px;padding:16px 32px">${d.secUrl||'yourlift.cl'}</div>
      </div>`,
      credYL
    );
  }
  return '<div style="padding:40px;color:#fff">Template no encontrado</div>';
};

function renderPublisher(){
  if(!(ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap))
    return '<div class="h1">Sin acceso</div><p class="subtitle">Solo el owner puede usar el editor.</p>';
  return `<div class="h1">Editor de publicaciones</div>
    <p class="subtitle">Genera imágenes para Instagram con templates predefinidos · Solo Owner</p>
    <div id="pubEditorRoot">${renderPublisherInner()}</div>`;
}

function renderPublisherInner(){
  const tpl = PUB_STATE.template;
  const d = PUB_STATE.data;
  const t = PUB_TEMPLATES[tpl];
  // Selector de templates
  const tplCards = Object.entries(PUB_TEMPLATES).map(([k,m])=>`
    <div onclick="pubSetTemplate('${k}')" style="padding:12px 14px;border-radius:10px;border:2px solid ${tpl===k?'var(--gold)':'var(--border)'};background:${tpl===k?'rgba(212,168,67,.1)':'rgba(10,22,40,.5)'};cursor:pointer;transition:all .15s">
      <div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;color:${tpl===k?'var(--gold)':'var(--text)'}">${m.icon} ${m.label}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${m.desc}</div>
    </div>`).join('');

  // Form fields dinámicos según template
  const inp = (key, label, value, multi=false) => multi
    ? `<div class="field"><label>${label}</label><textarea oninput="pubSetField('${key}',this.value)" style="min-height:80px">${esc(value||'')}</textarea></div>`
    : `<div class="field"><label>${label}</label><input class="inp" value="${esc(value||'')}" oninput="pubSetField('${key}',this.value)"></div>`;
  let fields = '';
  // Selector evento para autocompletar (siempre visible)
  const evOpts = (ST.eventos||[]).filter(e=>e.status!=='archived').map(e=>`<option value="${esc(e.id)}">${esc(e.name||e.id)}</option>`).join('');
  fields += `<div class="field"><label>Auto-llenar desde evento</label>
    <select class="inp" onchange="pubLoadFromEvent(this.value)">
      <option value="">— Elegir evento (carga nombre, fecha, ubicación, logo) —</option>
      ${evOpts}
    </select></div>`;
  // Logo upload (común)
  fields += `<div class="field"><label>Logo del evento</label>
    ${d.customLogoUrl
      ? `<div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(34,197,94,.08);border:1px solid var(--green);border-radius:8px"><img src="${d.customLogoUrl}" style="height:60px;object-fit:contain"><div style="flex:1"><div style="font-size:11px;color:var(--green);font-family:Oswald"><i class=yl-i-check></i> Logo cargado</div></div><button onclick="pubClearLogo()" style="background:transparent;border:1px solid var(--red);color:var(--red);padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer"><i class=yl-i-cerrar></i> Quitar</button></div>`
      : `<input type="file" accept="image/*" onchange="pubUploadLogo(this)" style="padding:8px;border:1px dashed var(--border);border-radius:6px;background:rgba(10,22,40,.4);color:var(--muted);width:100%">`}
    </div>`;
  // ── Estilo (tipo de letra, tamaño, fondo, instagrams) ──
  const FONTS=[['Oswald','Oswald'],["'DM Sans'",'DM Sans'],['Arial','Arial'],['"Arial Black"','Arial Black'],['Georgia','Georgia'],['Impact','Impact'],['"Times New Roman"','Times New Roman'],['"Courier New"','Courier New'],['Verdana','Verdana'],['"Trebuchet MS"','Trebuchet MS']];
  const fontOpts=(cur)=>FONTS.map(([v,l])=>`<option value='${v}' ${cur===v?'selected':''}>${l}</option>`).join('');
  const BGP=[['azul','Azul'],['negro','Negro'],['rojo','Rojo'],['dorado','Dorado'],['violeta','Violeta'],['verde','Verde']];
  fields += `<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px;background:rgba(10,22,40,.4)">
    <div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:10px">ESTILO</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Letra títulos</label><select class="inp" onchange="pubSetField('fontHead',this.value)">${fontOpts(d.fontHead)}</select></div>
      <div class="field"><label>Letra texto</label><select class="inp" onchange="pubSetField('fontBody',this.value)">${fontOpts(d.fontBody)}</select></div>
    </div>
    <div class="field"><label>Tamaño de letra (${Math.round((d.fontScale||1)*100)}%)</label><input type="range" min="0.7" max="1.4" step="0.05" value="${d.fontScale||1}" oninput="pubSetField('fontScale',this.value);this.previousElementSibling.textContent='Tamaño de letra ('+Math.round(this.value*100)+'%)'"></div>
    <div class="field"><label>Fondo</label>
      <select class="inp" onchange="pubSetBgPreset(this.value)">${BGP.map(([v,l])=>`<option value="${v}" ${(!d.bgImageUrl&&!d.bgColor&&d.bgPreset===v)?'selected':''}>${l}</option>`).join('')}</select>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
        <input type="color" value="${d.bgColor||'#06101f'}" oninput="pubSetBgColor(this.value)" title="Color sólido" style="width:42px;height:32px;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer">
        <label class="btn" style="font-size:11px;cursor:pointer;padding:6px 10px">Imagen<input type="file" accept="image/*" onchange="pubUploadBg(this)" style="display:none"></label>
        ${(d.bgImageUrl||d.bgColor)?`<button onclick="pubClearBg()" style="background:transparent;border:1px solid var(--red);color:var(--red);padding:5px 9px;border-radius:6px;font-size:11px;cursor:pointer">Quitar fondo</button>`:''}
      </div>
    </div>
    <div class="field"><label>Instagrams (línea de crédito)</label><input class="inp" value="${esc(d.igHandles||'')}" oninput="pubSetField('igHandles',this.value)"></div>
    <div class="field"><label>"En vivo por"</label><input class="inp" value="${esc(d.liveBy||'')}" oninput="pubSetField('liveBy',this.value)"></div>
  </div>`;

  // Campos específicos por template
  if(tpl==='cartaAtleta'){
    const athOpts=(ST.data||[]).slice().sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).map(a=>`<option value="${esc(a.nombre||'')}">`).join('');
    fields += `<div class="field"><label>Cargar atleta desde la base (autocompleta marcas, GLP y categoría)</label>
      <input class="inp" list="pubAthCard" placeholder="Escribe el nombre y elígelo de la lista..." onchange="pubLoadAthleteCard(this.value)">
      <datalist id="pubAthCard">${athOpts}</datalist></div>`;
    fields += `<div class="field"><label>Foto del atleta (ideal: recortada / fondo transparente)</label>
      ${d.cardPhoto
        ? `<div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(34,197,94,.08);border:1px solid var(--green);border-radius:8px"><img src="${d.cardPhoto}" style="height:64px;border-radius:6px;object-fit:cover"><div style="flex:1;font-size:11px;color:var(--green);font-family:Oswald"><i class=yl-i-check></i> Foto cargada</div><button onclick="pubClearCardPhoto()" style="background:transparent;border:1px solid var(--red);color:var(--red);padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer"><i class=yl-i-cerrar></i> Quitar</button></div>`
        : `<input type="file" accept="image/*" onchange="pubUploadCardPhoto(this)" style="padding:8px;border:1px dashed var(--border);border-radius:6px;background:rgba(10,22,40,.4);color:var(--muted);width:100%">`}
    </div>`;
    fields += inp('cardName','Nombre (la última palabra va grande, ej: "María Paz Sáez")',d.cardName);
    fields += inp('cardNick','Sobrenombre / IG (ej: @paaaxi)',d.cardNick);
    fields += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${inp('cardSquat','Sentadilla (kg)',d.cardSquat)}
      ${inp('cardBench','Banca (kg)',d.cardBench)}
      ${inp('cardDeadlift','Peso muerto (kg)',d.cardDeadlift)}
      ${inp('cardTotal','Total (kg)',d.cardTotal)}
    </div>`;
    fields += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${inp('cardGLP','GLP',d.cardGLP)}
      ${inp('cardCategory','Categoría (ej: −57 KG)',d.cardCategory)}
    </div>`;
    fields += `<div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" ${d.cardShowBadge!==false?'checked':''} onchange="pubSetField('cardShowBadge',this.checked)"> Mostrar insignia (estrella + texto)</label></div>`;
    fields += inp('cardBadge','Texto de la insignia (ej: WORLD CHAMPION). Vacío = solo la estrella',d.cardBadge);
    const FLAGS=[['CL','Chile'],['none','Sin bandera']];
    fields += `<div class="field"><label>Bandera</label><select class="inp" onchange="pubSetField('cardFlag',this.value)">${FLAGS.map(([v,l])=>`<option value="${v}" ${d.cardFlag===v?'selected':''}>${l}</option>`).join('')}</select></div>`;
    // Sliders de ajuste fino (la foto también se arrastra con el mouse en el preview)
    const sl=(key,label,min,max,step,val,unit)=>`<div class="field"><label>${label} (${val}${unit||''})</label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="pubSetField('${key}',this.value);this.previousElementSibling.textContent='${label} ('+this.value+'${unit||''}')'"></div>`;
    fields += `<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px;background:rgba(10,22,40,.4)">
      <div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:6px">POSICIÓN Y TAMAÑO</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Arrastra la <b style="color:var(--text)">foto</b> y el <b style="color:var(--text)">nombre</b> con el mouse directamente en el preview. Los sliders son para ajuste fino.</div>
      ${sl('cardPhotoOX','Foto · horizontal',-500,500,5,(d.cardPhotoOX||0),'px')}
      ${sl('cardPhotoOY','Foto · vertical',-500,500,5,(d.cardPhotoOY||0),'px')}
      ${sl('cardPhotoZoom','Foto · zoom',50,250,1,(d.cardPhotoZoom||100),'%')}
      ${sl('cardNameX','Nombre · horizontal',-400,400,5,(d.cardNameX||0),'px')}
      ${sl('cardNameY','Nombre · altura',560,1010,2,(d.cardNameY||720),'px')}
      ${sl('cardNameScale','Nombre · tamaño',60,140,1,(d.cardNameScale||100),'%')}
    </div>`;
  }
  if(tpl==='atletaFuerte'){
    const athOpts=(ST.data||[]).slice().sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).map(a=>`<option value="${esc(a.nombre||'')}">`).join('');
    fields += `<div class="field"><label>Cargar atleta desde la base (trae foto del sistema, club, marcas y categoría)</label>
      <input class="inp" list="pubAthFuerte" placeholder="Escribe el nombre y elígelo de la lista..." onchange="pubLoadAthleteCard(this.value)">
      <datalist id="pubAthFuerte">${athOpts}</datalist></div>`;
    fields += `<div class="field"><label>Foto del atleta — se carga sola del sistema. Si quieres, súbela manual:</label>
      ${d.cardPhoto
        ? `<div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(34,197,94,.08);border:1px solid var(--green);border-radius:8px"><img src="${d.cardPhoto}" crossorigin="anonymous" style="height:64px;border-radius:6px;object-fit:cover"><div style="flex:1;font-size:11px;color:var(--green);font-family:Oswald"><i class=yl-i-check></i> Foto cargada</div><button onclick="pubClearCardPhoto()" style="background:transparent;border:1px solid var(--red);color:var(--red);padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer"><i class=yl-i-cerrar></i> Quitar</button></div>`
        : `<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Este atleta no tiene foto en el sistema → saldrá el placeholder de perfil.</div><input type="file" accept="image/*" onchange="pubUploadCardPhoto(this)" style="padding:8px;border:1px dashed var(--border);border-radius:6px;background:rgba(10,22,40,.4);color:var(--muted);width:100%">`}
    </div>`;
    fields += inp('cardOverall','Título (banda dorada, ej: CAMPEONA OVERALL JUNIOR)',d.cardOverall);
    fields += inp('cardName','Nombre completo',d.cardName);
    fields += inp('cardClub','Club',d.cardClub);
    fields += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${inp('cardSquat','Sentadilla (kg)',d.cardSquat)}
      ${inp('cardBench','Banca (kg)',d.cardBench)}
      ${inp('cardDeadlift','Peso muerto (kg)',d.cardDeadlift)}
      ${inp('cardTotal','Total (kg)',d.cardTotal)}
    </div>`;
    fields += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${inp('cardGLP','GL points',d.cardGLP)}
      ${inp('cardCategory','Categoría de peso (ej: −83 KG, opcional)',d.cardCategory)}
    </div>`;
  }
  if(/^(inicio|nomina|transmisiones|atletas|records|ranking|calculadora)$/.test(tpl)){
    fields += inp('secTitle','Título grande',d.secTitle);
    fields += inp('secText','Texto (multilínea)',d.secText,true);
    fields += inp('secUrl','URL / llamado (ej: yourlift.cl/ranking)',d.secUrl);
  }
  if(tpl==='estaremosPresentes' || tpl==='inscripcionesAbiertas' || tpl==='proximoTorneo'){
    fields += inp('eventName','Nombre evento (grande, si NO subes logo)',d.eventName);
    fields += inp('eventSubtitle','Subtítulo (ej. "1° Edición")',d.eventSubtitle);
    fields += inp('date','Fecha',d.date);
    fields += inp('location','Ubicación',d.location);
    fields += inp('organizer','Organizador',d.organizer);
    if(tpl==='inscripcionesAbiertas') fields += inp('docsList','Documentación (separar por · )',d.docsList);
  }
  if(tpl==='resultadosPodio'){
    fields += inp('eventName','Nombre evento',d.eventName);
    fields += inp('category','Categoría',d.category);
    fields += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">`;
    [1,2,3].forEach(i=>{
      fields += `<div>
        <div style="font-family:Oswald;font-size:11px;letter-spacing:2px;color:var(--gold);margin:8px 0 4px">${i}° PUESTO</div>
        ${inp('athlete'+i,'Nombre',d['athlete'+i])}
        ${inp('athlete'+i+'Total','Total kg',d['athlete'+i+'Total'])}
        ${inp('athlete'+i+'Club','Club',d['athlete'+i+'Club'])}
      </div>`;
    });
    fields += `</div>`;
  }
  if(tpl==='recordNuevo'){
    fields += inp('eventName','Nombre evento',d.eventName);
    fields += inp('date','Fecha',d.date);
    fields += inp('category','Categoría',d.category);
    fields += inp('recordType','Movimiento (SQUAT/BENCH/DEADLIFT)',d.recordType);
    fields += inp('recordMark','Marca (kg)',d.recordMark);
    fields += inp('recordAthlete','Atleta',d.recordAthlete);
  }
  if(tpl==='anuncioGenerico'){
    fields += inp('title','Título grande',d.title);
    fields += inp('subtitle','Subtítulo',d.subtitle);
    fields += inp('body','Texto del anuncio (multilínea)',d.body,true);
  }

  return `
  <div style="display:grid;grid-template-columns:280px 1fr 1fr;gap:18px;align-items:start;margin-top:18px">
    <!-- Selector templates -->
    <div style="display:flex;flex-direction:column;gap:8px;position:sticky;top:18px">
      <div style="font-family:Oswald;font-size:11px;letter-spacing:3px;color:var(--gold);font-weight:700;padding:0 4px 4px">TEMPLATES</div>
      ${tplCards}
    </div>
    <!-- Form -->
    <div class="card" style="padding:16px 18px;max-height:80vh;overflow-y:auto">
      <div style="font-family:Oswald;font-size:14px;letter-spacing:2px;color:var(--gold);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        ${t.icon} ${t.label.toUpperCase()}
      </div>
      ${fields}
      <button id="pubDownloadBtn" onclick="pubDownload()" class="btn btn-g" style="width:100%;padding:14px;margin-top:14px;font-size:14px;font-family:Oswald;letter-spacing:2px">Descargar PNG</button>
    </div>
    <!-- Preview -->
    <div style="position:sticky;top:18px">
      <div style="font-family:Oswald;font-size:11px;letter-spacing:3px;color:var(--gold);margin-bottom:8px">PREVIEW · 1080×1350</div>
      <div style="background:#000;border:1px solid var(--border);border-radius:12px;padding:8px;overflow:hidden">
        <div style="position:relative;width:100%;padding-top:125%;overflow:hidden;border-radius:6px">
          <div style="position:absolute;inset:0;transform:scale(calc(1/3.5));transform-origin:top left;width:1080px;height:1350px">
            <div id="pubCanvas"></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

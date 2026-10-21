// admin.html — Cobros YourLift (solo owner).
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.
//
// Lo que hay que boletear por el uso de la plataforma: a cada organizador por
// su campeonato (atletas inscritos y aprobados × tarifa) y a FECHIPO por la
// mensualidad, si la contrata. La boleta se emite en el SII —el sitio no puede
// hacerlo: hace falta la clave del contribuyente—, así que acá se calcula el
// monto, se arma el detalle en PDF para mandarlo junto con la boleta y queda el
// registro: número de boleta, emitida, pagada.
//
// Todo va en un documento, cobros/yourlift, que solo el owner lee y escribe
// (reglas/firestore.rules): son montos y datos de clientes.

const COBROS_DOC=['cobros','yourlift'];
// La retención de las boletas de honorarios sube cada año hasta 2028 (15,25% en
// 2026, 16% en 2027, 17% en 2028): por eso se guarda y se puede cambiar.
const COBRO_CFG_DEF={tarifa:0,documento:'honorarios',retencion:15.25,iva:19,mensualidad:0};
const COBRO_ESTADOS={pendiente:'Por boletear',emitida:'Boleta emitida',pagada:'Pagada'};

const _clp=n=>'$'+String(Math.round(+n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const _cobroHoy=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const _cobroMes=m=>{const x=/^(\d{4})-(\d{2})$/.exec(m||'');return x?(_MESES[+x[2]-1]||'')+' '+x[1]:(m||'');};

async function cobrosCargar(){
  ST._cobrosLoaded='loading';
  try{
    const s=await getDoc(doc(db,...COBROS_DOC)); const d=s.exists()?s.data():{};
    ST.cobrosCfg={...COBRO_CFG_DEF,...(d.config||{})};
    ST.cobros=Array.isArray(d.items)?d.items:[]; ST._cobrosErr=null;
  }catch(e){ ST.cobrosCfg={...COBRO_CFG_DEF}; ST.cobros=[]; ST._cobrosErr=e; }
  ST._cobrosLoaded=true; if(ST.view==='cobros')render();
}

async function cobrosGuardar(){
  await setDoc(doc(db,...COBROS_DOC),{config:ST.cobrosCfg,items:ST.cobros,actualizado:Date.now(),por:ST.user?.email||''});
}

// Montos según el documento. Honorarios: lo cobrado es el bruto; si el cliente
// es persona jurídica retiene el porcentaje y deposita el líquido. Con IVA: la
// tarifa es el neto y el IVA va encima.
function cobroMontos(monto,documento,cfg){
  cfg=cfg||ST.cobrosCfg||COBRO_CFG_DEF; monto=Math.round(+monto||0);
  if(documento==='iva'){ const iva=Math.round(monto*(+cfg.iva||0)/100); return {base:monto,imp:iva,total:monto+iva,liquido:monto+iva}; }
  const ret=Math.round(monto*(+cfg.retencion||0)/100);
  return {base:monto,imp:ret,total:monto,liquido:monto-ret};
}

// Atletas que se cobran en un campeonato: inscripciones aprobadas, una por
// persona (quien hace powerlifting y banca sola tiene dos inscripciones).
function cobroAtletas(ev){
  const vistos=new Map();
  (ST.inscripciones||[]).forEach(i=>{
    if(i.status!=='approved'||(i.evento!==ev.id&&i.evento!==ev.name))return;
    const k=String(i.rut||'').replace(/[^0-9kK]/g,'').toUpperCase()||String(i.nombre||'').trim().toLowerCase();
    if(k&&!vistos.has(k))vistos.set(k,i.nombre||'');
  });
  return [...vistos.values()].sort((a,b)=>a.localeCompare(b,'es'));
}

const _cobroDeEvento=id=>(ST.cobros||[]).find(c=>c.tipo==='campeonato'&&c.eventoId===id);

function _cobroGlosa(f){
  return f.tipo==='mensualidad'
    ?'Mensualidad plataforma YourLift – '+_cobroMes(f.mes)
    :'Servicio plataforma YourLift – '+(f.titulo||'')+' ('+(f.atletas||0)+' atletas)';
}

// ── Formulario: preparar una boleta ──
window.cobroPreparar=function(eventoId){
  const ev=(ST.eventos||[]).find(e=>e.id===eventoId); if(!ev)return;
  const ya=_cobroDeEvento(eventoId), cfg=ST.cobrosCfg;
  const n=cobroAtletas(ev).length;
  ST.cobroForm=ya?{...ya}:{tipo:'campeonato',eventoId,titulo:ev.name||ev.id,fechaEvento:ev.date||'',cliente:ev.org||'',clienteRut:'',
    atletas:n,tarifa:cfg.tarifa,documento:cfg.documento,boleta:'',fecha:_cobroHoy()};
  render(); setTimeout(()=>{const el=document.getElementById('cobro_form');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},0);
};

window.cobroMensualidad=function(){
  const cfg=ST.cobrosCfg, d=new Date();
  ST.cobroForm={tipo:'mensualidad',mes:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),titulo:'Mensualidad',cliente:'FECHIPO',clienteRut:'',
    atletas:1,tarifa:cfg.mensualidad,documento:cfg.documento,boleta:'',fecha:_cobroHoy()};
  render();
};

window.cobroCerrarForm=function(){ST.cobroForm=null;render();};

// Lee lo escrito en el formulario (para no perderlo al redibujar).
function _cobroLeerForm(){
  const f=ST.cobroForm; if(!f)return null;
  const v=id=>{const el=document.getElementById(id);return el?el.value.trim():null;};
  [['cliente','cb_cliente'],['clienteRut','cb_rut'],['boleta','cb_boleta'],['fecha','cb_fecha'],['mes','cb_mes'],['documento','cb_doc']]
    .forEach(([k,id])=>{const x=v(id);if(x!==null)f[k]=x;});
  [['atletas','cb_atletas'],['tarifa','cb_tarifa']].forEach(([k,id])=>{const x=v(id);if(x!==null)f[k]=Math.max(0,Math.round(+x.replace(/[^0-9]/g,'')||0));});
  f.monto=(+f.atletas||0)*(+f.tarifa||0);
  f.glosa=_cobroGlosa(f);
  return f;
}
window.cobroRecalcular=function(){_cobroLeerForm();render();};

window.cobroCopiar=async function(){
  const f=_cobroLeerForm(); if(!f)return;
  const m=cobroMontos(f.monto,f.documento);
  const txt=f.glosa+'\n'+(f.documento==='iva'?'Neto: '+_clp(m.base)+' · IVA: '+_clp(m.imp)+' · Total: '+_clp(m.total):'Monto bruto: '+_clp(m.base));
  try{await navigator.clipboard.writeText(txt);showToast('Glosa y monto copiados');}
  catch(e){window.prompt('Copia esto:',txt);}
};

window.cobroGuardar=async function(){
  const f=_cobroLeerForm(); if(!f)return;
  if(!f.cliente){showToast('Falta el cliente',null,true);return;}
  if(!(f.monto>0)){showToast('El monto es 0: revisa la tarifa y los atletas',null,true);return;}
  const m=cobroMontos(f.monto,f.documento);
  const item={...f,...{bruto:m.base,impuesto:m.imp,total:m.total,liquido:m.liquido,
    tasa:f.documento==='iva'?ST.cobrosCfg.iva:ST.cobrosCfg.retencion}};
  item.estado=item.estado==='pagada'?'pagada':(item.boleta?'emitida':'pendiente');
  if(!item.id)item.id='c'+Date.now().toString(36);
  const i=(ST.cobros||[]).findIndex(c=>c.id===item.id);
  if(i>=0)ST.cobros[i]=item; else (ST.cobros=ST.cobros||[]).push(item);
  try{await cobrosGuardar();ST.cobroForm=null;showToast(item.boleta?'Boleta N° '+item.boleta+' registrada':'Guardado — falta el número de boleta');render();}
  catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

window.cobroPagado=async function(id,pagado){
  const c=(ST.cobros||[]).find(x=>x.id===id); if(!c)return;
  c.estado=pagado?'pagada':(c.boleta?'emitida':'pendiente'); c.fechaPago=pagado?_cobroHoy():'';
  try{await cobrosGuardar();render();}catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

window.cobroBorrar=async function(id){
  const c=(ST.cobros||[]).find(x=>x.id===id); if(!c)return;
  if(!confirm('¿Borrar el registro de "'+(c.glosa||c.titulo)+'"?\n\nSolo se borra de esta lista; la boleta del SII no se anula.'))return;
  ST.cobros=ST.cobros.filter(x=>x.id!==id);
  try{await cobrosGuardar();render();}catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

window.cobroEditar=function(id){
  const c=(ST.cobros||[]).find(x=>x.id===id); if(!c)return;
  ST.cobroForm={...c}; render();
};

window.cobroCfgGuardar=async function(){
  const v=id=>{const el=document.getElementById(id);return el?el.value:'';};
  const num=s=>Math.max(0,+String(s).replace(/[^0-9.,]/g,'').replace(',','.')||0);
  ST.cobrosCfg={...ST.cobrosCfg,tarifa:Math.round(num(v('cc_tarifa'))),mensualidad:Math.round(num(v('cc_mensual'))),
    retencion:num(v('cc_ret')),documento:v('cc_doc')==='iva'?'iva':'honorarios'};
  try{await cobrosGuardar();showToast('Tarifas guardadas');render();}catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

// ── El detalle en PDF (no es la boleta: va junto con ella) ──
window.cobroPDF=async function(id){
  const f=id?(ST.cobros||[]).find(x=>x.id===id):_cobroLeerForm(); if(!f)return;
  const jsPDF=await _certCargarJsPDF();
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  const W=210, NAVY=[10,22,40], ROJO=[196,30,58], AZUL=[0,82,164], TXT=[30,36,48], GRIS=[110,118,130];
  const cfg=ST.cobrosCfg, m=cobroMontos(f.monto,f.documento);
  pdf.setFillColor(...NAVY); pdf.rect(0,0,W,34,'F');
  pdf.setFillColor(...ROJO); pdf.rect(0,34,W/2,1.4,'F'); pdf.setFillColor(...AZUL); pdf.rect(W/2,34,W/2,1.4,'F');
  const logo=await _certImagen('yourlift_logo_hd.png');
  if(logo){const lh=20,lw=lh*logo.w/logo.h;pdf.addImage(logo.url,'PNG',14,7,lw,lh);}
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(15);
  pdf.text('DETALLE DE COBRO',W-14,17,{align:'right'});
  pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5); pdf.text('Servicio plataforma YourLift · yourlift.cl',W-14,24,{align:'right'});
  let y=50;
  const fila=(et,val)=>{pdf.setTextColor(...GRIS);pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.text(et,14,y);
    pdf.setTextColor(...TXT);pdf.setFont('helvetica','bold');pdf.setFontSize(10.5);pdf.text(String(val||'—'),58,y);y+=7;};
  fila('CLIENTE',f.cliente); fila('RUT',f.clienteRut);
  fila('CONCEPTO',f.tipo==='mensualidad'?'Mensualidad plataforma – '+_cobroMes(f.mes):f.titulo);
  if(f.tipo!=='mensualidad'&&f.fechaEvento)fila('FECHA DEL CAMPEONATO',_certFechaLarga(f.fechaEvento));
  fila('FECHA',_certFechaLarga(f.fecha)); if(f.boleta)fila('BOLETA SII N°',f.boleta);
  // Tabla
  y+=4; pdf.setFillColor(238,241,246); pdf.rect(14,y,W-28,9,'F');
  pdf.setTextColor(...NAVY); pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
  pdf.text('DESCRIPCIÓN',17,y+6); pdf.text('CANT.',120,y+6,{align:'right'}); pdf.text('VALOR UNIT.',155,y+6,{align:'right'}); pdf.text('TOTAL',W-17,y+6,{align:'right'});
  y+=16; pdf.setTextColor(...TXT); pdf.setFont('helvetica','normal'); pdf.setFontSize(10);
  const desc=f.tipo==='mensualidad'?'Mensualidad '+_cobroMes(f.mes):'Atletas inscritos (aprobados)';
  pdf.text(desc,17,y); pdf.text(String(f.atletas),120,y,{align:'right'}); pdf.text(_clp(f.tarifa),155,y,{align:'right'}); pdf.text(_clp(f.monto),W-17,y,{align:'right'});
  y+=6; pdf.setDrawColor(210,214,222); pdf.line(14,y,W-14,y); y+=9;
  const tot=(et,val,fuerte)=>{pdf.setFont('helvetica',fuerte?'bold':'normal');pdf.setFontSize(fuerte?12:10);pdf.setTextColor(...(fuerte?NAVY:TXT));
    pdf.text(et,155,y,{align:'right'});pdf.text(val,W-17,y,{align:'right'});y+=fuerte?9:7;};
  const pct=s=>String(s).replace('.',',')+'%';
  if(f.documento==='iva'){ tot('Neto',_clp(m.base)); tot('IVA '+pct(cfg.iva),_clp(m.imp)); tot('TOTAL',_clp(m.total),true); }
  else{ tot('Monto bruto',_clp(m.base),true); tot('Retención '+pct(cfg.retencion),'– '+_clp(m.imp)); tot('Líquido',_clp(m.liquido)); }
  y+=4; pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); pdf.setTextColor(...GRIS);
  const nota=f.documento==='iva'
    ?'Este documento detalla el cobro. El documento tributario es la factura o boleta electrónica emitida en el SII.'
    :'Este documento detalla el cobro. El documento tributario es la boleta de honorarios electrónica emitida en el SII. '
     +'Si el cliente es persona jurídica, retiene el '+pct(cfg.retencion)+' y lo entera en el SII; deposita el líquido.';
  pdf.text(pdf.splitTextToSize(nota,W-28),14,y);
  // Anexo: la lista de atletas que se cobró, para que el organizador la revise.
  if(f.tipo!=='mensualidad'){
    const ev=(ST.eventos||[]).find(e=>e.id===f.eventoId);
    const nombres=ev?cobroAtletas(ev):[];
    if(nombres.length){
      pdf.addPage(); y=20;
      pdf.setTextColor(...NAVY); pdf.setFont('helvetica','bold'); pdf.setFontSize(13);
      pdf.text('Atletas considerados ('+nombres.length+')',14,y); y+=5;
      pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(...GRIS);
      pdf.text(f.titulo||'',14,y+4); y+=12; pdf.setTextColor(...TXT);
      // Dos columnas; si no caben, sigue en otra página.
      const alto=5.2, filas=Math.floor((283-y)/alto), porPag=filas*2;
      nombres.forEach((nm,k)=>{
        if(k&&k%porPag===0)pdf.addPage();
        const kk=k%porPag, col=Math.floor(kk/filas), fil=kk%filas;
        pdf.text((k+1)+'. '+nm,14+col*92,y+fil*alto);
      });
    }
  }
  pdf.setFontSize(8); pdf.setTextColor(...GRIS);
  const n=pdf.getNumberOfPages(); for(let p=1;p<=n;p++){pdf.setPage(p);pdf.text('yourlift.cl',W/2,292,{align:'center'});}
  const limpio=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'');
  pdf.save('Cobro_YourLift_'+limpio(f.tipo==='mensualidad'?'Mensualidad_'+f.mes:f.titulo)+'.pdf');
};

// ── Pantalla ──
function renderCobros(){
  if(ST._cobrosLoaded!==true){ if(!ST._cobrosLoaded)setTimeout(cobrosCargar,0); return '<div class="h1">Cobros YourLift</div><p class="subtitle">Cargando…</p>'; }
  const cfg=ST.cobrosCfg, f=ST.cobroForm;
  const lbl='display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px';
  const caja='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin:14px 0 22px';
  const chip=e=>{const c=e==='pagada'?'var(--green)':e==='emitida'?'var(--gold)':'var(--muted)';
    return `<span style="font-family:Oswald;font-size:10px;letter-spacing:1px;border:1px solid ${c};color:${c};border-radius:10px;padding:2px 8px;white-space:nowrap">${(COBRO_ESTADOS[e]||e).toUpperCase()}</span>`;};
  const docSel=(id,val)=>`<select id="${id}" class="inp"><option value="honorarios" ${val!=='iva'?'selected':''}>Boleta de honorarios (retención)</option><option value="iva" ${val==='iva'?'selected':''}>Boleta / factura con IVA</option></select>`;

  // Totales
  const items=ST.cobros||[];
  const suma=(fn)=>items.filter(fn).reduce((s,c)=>s+(+c.total||0),0);
  const emitido=suma(c=>c.estado!=='pendiente'), pagado=suma(c=>c.estado==='pagada'), porCobrar=suma(c=>c.estado==='emitida');
  const eventos=(ST.eventos||[]).map(ev=>({ev,n:cobroAtletas(ev).length})).filter(x=>x.n>0)
    .sort((a,b)=>String(b.ev.date||'').localeCompare(String(a.ev.date||'')));
  const sinBoleta=eventos.filter(x=>!_cobroDeEvento(x.ev.id));
  const estimado=sinBoleta.reduce((s,x)=>s+cobroMontos(x.n*cfg.tarifa,cfg.documento).total,0);
  const tarjeta=(t,v,sub,color)=>`<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
    <div style="font-family:Oswald;font-size:11px;letter-spacing:1px;color:var(--muted)">${t}</div>
    <div style="font-family:Oswald;font-size:24px;font-weight:700;color:${color||'var(--text)'};margin-top:4px">${v}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px">${sub}</div></div>`;

  // Formulario abierto
  let form='';
  if(f){
    f.monto=(+f.atletas||0)*(+f.tarifa||0); f.glosa=_cobroGlosa(f);
    const m=cobroMontos(f.monto,f.documento);
    const campo=(t,id,val,extra)=>`<label style="${lbl}">${t}<input id="${id}" class="inp" value="${esc(val==null?'':val)}" ${extra||''}></label>`;
    form=`<div id="cobro_form" style="${caja};border-color:var(--gold)">
      <div style="font-family:Oswald;font-size:15px;letter-spacing:1px;margin-bottom:4px">${f.tipo==='mensualidad'?'MENSUALIDAD':'BOLETA DEL CAMPEONATO'}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">${esc(f.tipo==='mensualidad'?'Mensualidad de la plataforma':f.titulo)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        ${campo('CLIENTE *','cb_cliente',f.cliente,'placeholder="Club u organización que paga"')}
        ${campo('RUT DEL CLIENTE','cb_rut',f.clienteRut,'placeholder="76.123.456-7"')}
        ${f.tipo==='mensualidad'?campo('MES','cb_mes',f.mes,'type="month" onchange="cobroRecalcular()"'):campo('ATLETAS','cb_atletas',f.atletas,'inputmode="numeric" onchange="cobroRecalcular()"')}
        ${campo(f.tipo==='mensualidad'?'MONTO MENSUAL':'TARIFA POR ATLETA','cb_tarifa',f.tarifa,'inputmode="numeric" onchange="cobroRecalcular()"')}
        <label style="${lbl}">DOCUMENTO${docSel('cb_doc',f.documento).replace('<select','<select onchange="cobroRecalcular()"')}</label>
      </div>
      <div style="margin:16px 0;padding:12px 14px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;font-size:13px;line-height:1.8">
        <div><span style="color:var(--muted)">Glosa:</span> <b>${esc(f.glosa)}</b></div>
        ${f.documento==='iva'
          ?`<div><span style="color:var(--muted)">Neto</span> ${_clp(m.base)} · <span style="color:var(--muted)">IVA ${String(cfg.iva).replace('.',',')}%</span> ${_clp(m.imp)} · <b style="color:var(--gold)">Total ${_clp(m.total)}</b></div>`
          :`<div><b style="color:var(--gold)">Bruto ${_clp(m.base)}</b> · <span style="color:var(--muted)">retención ${String(cfg.retencion).replace('.',',')}%</span> ${_clp(m.imp)} · <span style="color:var(--muted)">líquido</span> ${_clp(m.liquido)}</div>`}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <button class="btn" onclick="cobroCopiar()">Copiar glosa y monto</button>
        <button class="btn" onclick="window.open('https://www.sii.cl','_blank','noopener')" title="Servicios online → Boletas de honorarios electrónicas → Emitir boleta (o Factura electrónica)">Abrir SII ↗</button>
        <button class="btn" onclick="cobroPDF()">Detalle PDF</button>
        <span style="flex:1"></span>
        ${campo('N° BOLETA SII','cb_boleta',f.boleta,'placeholder="Al emitirla" style="width:130px"')}
        ${campo('FECHA','cb_fecha',f.fecha,'type="date"')}
        <button class="btn btn-b" onclick="cobroGuardar()">Guardar</button>
        <button class="btn" onclick="cobroCerrarForm()" style="background:transparent;border:1px solid var(--border);color:var(--muted)">Cerrar</button>
      </div>
    </div>`;
  }

  const filasEv=eventos.map(({ev,n})=>{
    const c=_cobroDeEvento(ev.id);
    const m=c?{total:c.total}:cobroMontos(n*cfg.tarifa,cfg.documento);
    return `<tr>
      <td style="padding:9px 10px;font-size:12px;white-space:nowrap;color:var(--muted)">${esc(ev.date||'')}</td>
      <td style="padding:9px 10px"><div style="font-weight:600">${esc(ev.name||ev.id)}</div><div style="font-size:11px;color:var(--muted)">${esc((c&&c.cliente)||ev.org||'—')}</div></td>
      <td style="padding:9px 10px;text-align:right;font-family:Oswald">${c?c.atletas:n}${c&&+c.atletas!==n?`<div style="font-size:10px;color:var(--muted)" title="Inscritos aprobados hoy">hoy ${n}</div>`:''}</td>
      <td style="padding:9px 10px;text-align:right;font-family:Oswald;white-space:nowrap">${_clp(m.total)}</td>
      <td style="padding:9px 10px">${chip(c?c.estado:'pendiente')}${c&&c.boleta?`<div style="font-size:11px;color:var(--muted);margin-top:3px">N° ${esc(c.boleta)}</div>`:''}</td>
      <td style="padding:9px 10px;text-align:right;white-space:nowrap">
        ${c?`<button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroPDF('${c.id}')">PDF</button>
             ${c.estado==='pagada'?`<button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroPagado('${c.id}',false)">Desmarcar pago</button>`
               :`<button class="btn" style="font-size:11px;padding:5px 10px;border-color:var(--green);color:var(--green)" onclick="cobroPagado('${c.id}',true)">Marcar pagada</button>`}
             <button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroEditar('${c.id}')">Editar</button>`
          :`<button class="btn btn-b" style="font-size:11px;padding:5px 10px" onclick="cobroPreparar('${esc(ev.id)}')">Preparar boleta</button>`}
      </td></tr>`;
  }).join('');

  const mensual=items.filter(c=>c.tipo==='mensualidad').sort((a,b)=>String(b.mes).localeCompare(String(a.mes)));
  const filasMes=mensual.map(c=>`<tr>
      <td style="padding:9px 10px;font-family:Oswald">${esc(_cobroMes(c.mes))}</td>
      <td style="padding:9px 10px">${esc(c.cliente||'')}</td>
      <td style="padding:9px 10px;text-align:right;font-family:Oswald">${_clp(c.total)}</td>
      <td style="padding:9px 10px">${chip(c.estado)}${c.boleta?`<div style="font-size:11px;color:var(--muted);margin-top:3px">N° ${esc(c.boleta)}</div>`:''}</td>
      <td style="padding:9px 10px;text-align:right;white-space:nowrap">
        <button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroPDF('${c.id}')">PDF</button>
        ${c.estado==='pagada'?`<button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroPagado('${c.id}',false)">Desmarcar pago</button>`
          :`<button class="btn" style="font-size:11px;padding:5px 10px;border-color:var(--green);color:var(--green)" onclick="cobroPagado('${c.id}',true)">Marcar pagada</button>`}
        <button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroEditar('${c.id}')">Editar</button>
        <button class="btn btn-r" style="font-size:11px;padding:5px 10px" onclick="cobroBorrar('${c.id}')">Borrar</button>
      </td></tr>`).join('');

  const th='padding:8px 10px;font-family:Oswald;font-size:10px;letter-spacing:1px;color:var(--muted);text-align:left;border-bottom:1px solid var(--border)';
  return `<div class="h1">Cobros YourLift</div>
    <p class="subtitle">Lo que hay que boletear por el uso de la plataforma: a cada organizador por su campeonato y a FECHIPO por la mensualidad. La boleta se emite en el SII; acá se calcula el monto, se baja el detalle en PDF para mandarlo junto con ella y queda el registro. Solo lo ve el owner.</p>
    ${ST._cobrosErr?`<div style="margin:12px 0;padding:10px 14px;border:1px solid var(--red);border-radius:8px;color:var(--red);font-size:12px">No se pudo leer el registro de cobros: ${esc(ST._cobrosErr.message||'')}. Revisa que las reglas de Firestore estén publicadas.</div>`:''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:14px 0">
      ${tarjeta('BOLETEADO',_clp(emitido),items.filter(c=>c.estado!=='pendiente').length+' documentos')}
      ${tarjeta('PAGADO',_clp(pagado),items.filter(c=>c.estado==='pagada').length+' pagados','var(--green)')}
      ${tarjeta('POR COBRAR',_clp(porCobrar),'boletas emitidas sin pago','var(--gold)')}
      ${tarjeta('SIN BOLETEAR',_clp(estimado),sinBoleta.length+' campeonatos'+(cfg.tarifa?'':' · falta la tarifa'))}
    </div>
    ${form}
    <div style="${caja}">
      <div style="font-family:Oswald;font-size:15px;letter-spacing:1px;margin-bottom:12px">TARIFAS</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;align-items:end">
        <label style="${lbl}">TARIFA POR ATLETA (CLP)<input id="cc_tarifa" class="inp" inputmode="numeric" value="${cfg.tarifa||''}" placeholder="Ej: 3000"></label>
        <label style="${lbl}">MENSUALIDAD FECHIPO (CLP)<input id="cc_mensual" class="inp" inputmode="numeric" value="${cfg.mensualidad||''}"></label>
        <label style="${lbl}">DOCUMENTO${docSel('cc_doc',cfg.documento)}</label>
        <label style="${lbl}">RETENCIÓN HONORARIOS (%)<input id="cc_ret" class="inp" value="${String(cfg.retencion).replace('.',',')}" title="15,25% en 2026 · 16% en 2027 · 17% en 2028"></label>
        <button class="btn btn-b" onclick="cobroCfgGuardar()">Guardar tarifas</button>
      </div>
    </div>
    <div style="font-family:Oswald;font-size:15px;letter-spacing:1px;margin:6px 0 10px">CAMPEONATOS</div>
    <div class="card" style="padding:0;overflow-x:auto;margin-bottom:22px">
      ${eventos.length?`<table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><th style="${th}">FECHA</th><th style="${th}">CAMPEONATO · CLIENTE</th><th style="${th};text-align:right">ATLETAS</th><th style="${th};text-align:right">TOTAL</th><th style="${th}">ESTADO</th><th style="${th}"></th></tr>
        ${filasEv}</table>`:`<div style="padding:18px;color:var(--muted);font-size:13px">Todavía no hay campeonatos con inscritos aprobados.</div>`}
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin:6px 0 10px">
      <div style="font-family:Oswald;font-size:15px;letter-spacing:1px">MENSUALIDADES</div>
      <button class="btn btn-b" style="font-size:12px;padding:6px 12px" onclick="cobroMensualidad()">+ Mensualidad</button>
    </div>
    <div class="card" style="padding:0;overflow-x:auto">
      ${mensual.length?`<table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><th style="${th}">MES</th><th style="${th}">CLIENTE</th><th style="${th};text-align:right">TOTAL</th><th style="${th}">ESTADO</th><th style="${th}"></th></tr>
        ${filasMes}</table>`:`<div style="padding:18px;color:var(--muted);font-size:13px">Sin mensualidades registradas.</div>`}
    </div>`;
}

// admin.html — Cobros YourLift (solo owner).
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.
//
// Lo que YourLift SpA le cobra a cada organizador por su campeonato (atletas
// inscritos y aprobados × tarifa) y a FECHIPO por la mensualidad. El documento
// tributario (factura o boleta electrónica, con IVA) se emite en el SII: el
// sitio no puede, hace falta la clave de la empresa. Acá se calcula el monto,
// se copian los datos para llenar el formulario del SII, se baja el cobro en PDF
// para mandárselo al cliente —con los datos de la empresa y de la cuenta donde
// transferir— y queda el registro: N° de documento, emitido, pagado. Con eso
// sale también el resumen del mes para el F29 (ventas netas e IVA débito).
//
// Todo va en un documento, cobros/yourlift, que solo el owner lee y escribe
// (reglas/firestore.rules): son montos y datos de clientes.

const COBROS_DOC=['cobros','yourlift'];
const COBRO_DOCS={
  factura:{t:'Factura electrónica',iva:true},
  boleta:{t:'Boleta electrónica',iva:true},
  // Para persona natural. Queda por si se cobra algo fuera de la SpA.
  honorarios:{t:'Boleta de honorarios',iva:false},
};
// La retención de honorarios sube cada año hasta 2028 (15,25% en 2026, 16% en
// 2027, 17% en 2028): por eso se guarda y se puede cambiar.
const COBRO_CFG_DEF={tarifa:0,documento:'factura',retencion:15.25,iva:19,mensualidad:0,ppm:0,
  emisor:{razon:'YourLift SpA',rut:'',giro:'',direccion:'',correo:''},
  banco:{banco:'',tipo:'Cuenta corriente',numero:'',titular:'YourLift SpA',rut:'',correo:''}};
const COBRO_ESTADOS={pendiente:'Por emitir',emitida:'Emitido',pagada:'Pagado'};

const _clp=n=>'$'+String(Math.round(+n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const _cobroHoy=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const _cobroMes=m=>{const x=/^(\d{4})-(\d{2})$/.exec(m||'');return x?(_MESES[+x[2]-1]||'')+' '+x[1]:(m||'');};
const _cobroPct=s=>String(s).replace('.',',')+'%';
// Lo guardado antes como 'iva' es una factura.
const _cobroDoc=d=>COBRO_DOCS[d]?d:'factura';

async function cobrosCargar(){
  ST._cobrosLoaded='loading';
  try{
    const s=await getDoc(doc(db,...COBROS_DOC)); const d=s.exists()?s.data():{}; const c=d.config||{};
    ST.cobrosCfg={...COBRO_CFG_DEF,...c,documento:_cobroDoc(c.documento||COBRO_CFG_DEF.documento),
      emisor:{...COBRO_CFG_DEF.emisor,...(c.emisor||{})},banco:{...COBRO_CFG_DEF.banco,...(c.banco||{})}};
    ST.cobros=Array.isArray(d.items)?d.items:[]; ST._cobrosErr=null;
  }catch(e){ ST.cobrosCfg=JSON.parse(JSON.stringify(COBRO_CFG_DEF)); ST.cobros=[]; ST._cobrosErr=e; }
  ST._cobrosLoaded=true; if(ST.view==='cobros')render();
}

async function cobrosGuardar(){
  await setDoc(doc(db,...COBROS_DOC),{config:ST.cobrosCfg,items:ST.cobros,actualizado:Date.now(),por:ST.user?.email||''});
}

// Montos según el documento. Factura y boleta: la tarifa es el neto y el IVA va
// encima. Honorarios: lo cobrado es el bruto; si el cliente es persona jurídica
// retiene el porcentaje y deposita el líquido.
function cobroMontos(monto,documento,cfg){
  cfg=cfg||ST.cobrosCfg||COBRO_CFG_DEF; monto=Math.round(+monto||0);
  if(COBRO_DOCS[_cobroDoc(documento)].iva){ const iva=Math.round(monto*(+cfg.iva||0)/100); return {base:monto,imp:iva,total:monto+iva,liquido:monto+iva}; }
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

// Datos del cliente que pide la factura. Los del último cobro al mismo cliente
// se reusan, para no escribirlos cada vez.
function _cobroDatosCliente(nombre){
  const n=String(nombre||'').trim().toLowerCase(); if(!n)return {};
  const prev=[...(ST.cobros||[])].reverse().find(c=>String(c.cliente||'').trim().toLowerCase()===n);
  return prev?{clienteRut:prev.clienteRut||'',clienteGiro:prev.clienteGiro||'',clienteDireccion:prev.clienteDireccion||'',clienteCorreo:prev.clienteCorreo||''}:{};
}

// ── Formulario: preparar un cobro ──
window.cobroPreparar=function(eventoId){
  const ev=(ST.eventos||[]).find(e=>e.id===eventoId); if(!ev)return;
  const ya=_cobroDeEvento(eventoId), cfg=ST.cobrosCfg;
  ST.cobroForm=ya?{...ya,documento:_cobroDoc(ya.documento)}:{tipo:'campeonato',eventoId,titulo:ev.name||ev.id,fechaEvento:ev.date||'',
    cliente:ev.org||'',clienteRut:'',clienteGiro:'',clienteDireccion:'',clienteCorreo:'',..._cobroDatosCliente(ev.org),
    atletas:cobroAtletas(ev).length,tarifa:cfg.tarifa,documento:cfg.documento,boleta:'',fecha:_cobroHoy()};
  render(); setTimeout(()=>{const el=document.getElementById('cobro_form');if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'});},0);
};

window.cobroMensualidad=function(){
  const cfg=ST.cobrosCfg, d=new Date();
  ST.cobroForm={tipo:'mensualidad',mes:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),titulo:'Mensualidad',
    cliente:'FECHIPO',clienteRut:'',clienteGiro:'',clienteDireccion:'',clienteCorreo:'',..._cobroDatosCliente('FECHIPO'),
    atletas:1,tarifa:cfg.mensualidad,documento:cfg.documento,boleta:'',fecha:_cobroHoy()};
  render();
};

window.cobroCerrarForm=function(){ST.cobroForm=null;render();};

// Lee lo escrito en el formulario (para no perderlo al redibujar).
function _cobroLeerForm(){
  const f=ST.cobroForm; if(!f)return null;
  const v=id=>{const el=document.getElementById(id);return el?el.value.trim():null;};
  [['cliente','cb_cliente'],['clienteRut','cb_rut'],['clienteGiro','cb_giro'],['clienteDireccion','cb_dir'],['clienteCorreo','cb_correo'],
   ['boleta','cb_boleta'],['fecha','cb_fecha'],['mes','cb_mes'],['documento','cb_doc']]
    .forEach(([k,id])=>{const x=v(id);if(x!==null)f[k]=x;});
  [['atletas','cb_atletas'],['tarifa','cb_tarifa']].forEach(([k,id])=>{const x=v(id);if(x!==null)f[k]=Math.max(0,Math.round(+x.replace(/[^0-9]/g,'')||0));});
  f.documento=_cobroDoc(f.documento);
  f.monto=(+f.atletas||0)*(+f.tarifa||0);
  f.glosa=_cobroGlosa(f);
  return f;
}
window.cobroRecalcular=function(){_cobroLeerForm();render();};

// Todo lo que pide el formulario del SII, en el orden en que lo pide.
window.cobroCopiar=async function(){
  const f=_cobroLeerForm(); if(!f)return;
  const m=cobroMontos(f.monto,f.documento), info=COBRO_DOCS[f.documento];
  const cant=f.tipo==='mensualidad'?1:f.atletas, unit=f.tipo==='mensualidad'?f.monto:f.tarifa;
  const lineas=[
    'Documento: '+info.t,
    'RUT receptor: '+(f.clienteRut||''),
    'Razón social: '+(f.cliente||''),
    f.clienteGiro?'Giro: '+f.clienteGiro:'',
    f.clienteDireccion?'Dirección: '+f.clienteDireccion:'',
    'Detalle: '+f.glosa,
    'Cantidad: '+cant+'   Precio unitario'+(info.iva?' (neto)':'')+': '+_clp(unit),
    info.iva?'Neto: '+_clp(m.base)+'   IVA '+_cobroPct(ST.cobrosCfg.iva)+': '+_clp(m.imp)+'   Total: '+_clp(m.total)
            :'Monto bruto: '+_clp(m.base)+'   Retención '+_cobroPct(ST.cobrosCfg.retencion)+': '+_clp(m.imp)+'   Líquido: '+_clp(m.liquido),
  ].filter(Boolean);
  const txt=lineas.join('\n');
  try{await navigator.clipboard.writeText(txt);showToast('Datos copiados para el SII');}
  catch(e){window.prompt('Copia esto:',txt);}
};

window.cobroGuardar=async function(){
  const f=_cobroLeerForm(); if(!f)return;
  if(!f.cliente){showToast('Falta el cliente',null,true);return;}
  if(!(f.monto>0)){showToast('El monto es 0: revisa la tarifa y los atletas',null,true);return;}
  const m=cobroMontos(f.monto,f.documento);
  const item={...f,bruto:m.base,impuesto:m.imp,total:m.total,liquido:m.liquido,
    tasa:COBRO_DOCS[f.documento].iva?ST.cobrosCfg.iva:ST.cobrosCfg.retencion};
  item.estado=item.estado==='pagada'?'pagada':(item.boleta?'emitida':'pendiente');
  if(!item.id)item.id='c'+Date.now().toString(36);
  const i=(ST.cobros||[]).findIndex(c=>c.id===item.id);
  if(i>=0)ST.cobros[i]=item; else (ST.cobros=ST.cobros||[]).push(item);
  try{await cobrosGuardar();ST.cobroForm=null;showToast(item.boleta?COBRO_DOCS[item.documento].t+' N° '+item.boleta+' registrada':'Guardado — falta el N° del documento');render();}
  catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

window.cobroPagado=async function(id,pagado){
  const c=(ST.cobros||[]).find(x=>x.id===id); if(!c)return;
  c.estado=pagado?'pagada':(c.boleta?'emitida':'pendiente'); c.fechaPago=pagado?_cobroHoy():'';
  try{await cobrosGuardar();render();}catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

window.cobroBorrar=async function(id){
  const c=(ST.cobros||[]).find(x=>x.id===id); if(!c)return;
  if(!confirm('¿Borrar el registro de "'+(c.glosa||c.titulo)+'"?\n\nSolo se borra de esta lista; el documento del SII no se anula.'))return;
  ST.cobros=ST.cobros.filter(x=>x.id!==id);
  try{await cobrosGuardar();render();}catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

window.cobroEditar=function(id){
  const c=(ST.cobros||[]).find(x=>x.id===id); if(!c)return;
  ST.cobroForm={...c,documento:_cobroDoc(c.documento)}; render();
};

window.cobroCfgGuardar=async function(){
  const v=id=>{const el=document.getElementById(id);return el?el.value.trim():null;};
  const num=s=>Math.max(0,+String(s||'').replace(/[^0-9.,]/g,'').replace(',','.')||0);
  const c=ST.cobrosCfg;
  const set=(obj,k,id,fn)=>{const x=v(id);if(x!==null)obj[k]=fn?fn(x):x;};
  set(c,'tarifa','cc_tarifa',x=>Math.round(num(x))); set(c,'mensualidad','cc_mensual',x=>Math.round(num(x)));
  set(c,'retencion','cc_ret',num); set(c,'ppm','cc_ppm',num); set(c,'documento','cc_doc',_cobroDoc);
  [['razon','ce_razon'],['rut','ce_rut'],['giro','ce_giro'],['direccion','ce_dir'],['correo','ce_correo']].forEach(([k,id])=>set(c.emisor,k,id));
  [['banco','cbk_banco'],['tipo','cbk_tipo'],['numero','cbk_num'],['titular','cbk_titular'],['rut','cbk_rut'],['correo','cbk_correo']].forEach(([k,id])=>set(c.banco,k,id));
  try{await cobrosGuardar();showToast('Datos guardados');render();}catch(e){showToast('No se pudo guardar: '+e.message,null,true);}
};

window.cobroF29Mes=function(m){ST.cobroF29=m;render();};

// Resumen de un mes para el F29: lo emitido con IVA, por tipo de documento.
function cobroF29(mes){
  const docs=(ST.cobros||[]).filter(c=>c.estado!=='pendiente'&&String(c.fecha||'').slice(0,7)===mes&&COBRO_DOCS[_cobroDoc(c.documento)].iva);
  const de=t=>{const l=docs.filter(c=>_cobroDoc(c.documento)===t);return {n:l.length,neto:l.reduce((s,c)=>s+(+c.bruto||0),0),iva:l.reduce((s,c)=>s+(+c.impuesto||0),0)};};
  const fa=de('factura'), bo=de('boleta');
  return {facturas:fa,boletas:bo,neto:fa.neto+bo.neto,iva:fa.iva+bo.iva,docs};
}

// ── El cobro en PDF, para mandárselo al cliente (no es el documento del SII) ──
window.cobroPDF=async function(id){
  const f=id?(ST.cobros||[]).find(x=>x.id===id):_cobroLeerForm(); if(!f)return;
  const jsPDF=await _certCargarJsPDF();
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  const W=210, NAVY=[10,22,40], ROJO=[196,30,58], AZUL=[0,82,164], TXT=[30,36,48], GRIS=[110,118,130];
  const cfg=ST.cobrosCfg, em=cfg.emisor||{}, bk=cfg.banco||{}, dc=_cobroDoc(f.documento), info=COBRO_DOCS[dc], m=cobroMontos(f.monto,dc);
  pdf.setFillColor(...NAVY); pdf.rect(0,0,W,38,'F');
  pdf.setFillColor(...ROJO); pdf.rect(0,38,W/2,1.4,'F'); pdf.setFillColor(...AZUL); pdf.rect(W/2,38,W/2,1.4,'F');
  const logo=await _certImagen('yourlift_logo_hd.png');
  if(logo){const lh=20,lw=lh*logo.w/logo.h;pdf.addImage(logo.url,'PNG',14,9,lw,lh);}
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(15);
  pdf.text('COBRO',W-14,14,{align:'right'});
  pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5);
  [em.razon||'YourLift SpA',em.rut?'RUT '+em.rut:'',em.giro,em.direccion,em.correo||'yourlift.cl'].filter(Boolean)
    .forEach((t,k)=>pdf.text(t,W-14,20+k*4.2,{align:'right'}));
  let y=52;
  const fila=(et,val)=>{if(!val)return;pdf.setTextColor(...GRIS);pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.text(et,14,y);
    pdf.setTextColor(...TXT);pdf.setFont('helvetica','bold');pdf.setFontSize(10.5);pdf.text(String(val),58,y);y+=6.6;};
  fila('CLIENTE',f.cliente); fila('RUT',f.clienteRut); fila('GIRO',f.clienteGiro); fila('DIRECCIÓN',f.clienteDireccion);
  y+=2;
  fila('CONCEPTO',f.tipo==='mensualidad'?'Mensualidad plataforma – '+_cobroMes(f.mes):f.titulo);
  if(f.tipo!=='mensualidad'&&f.fechaEvento)fila('FECHA DEL CAMPEONATO',_certFechaLarga(f.fechaEvento));
  fila('FECHA',_certFechaLarga(f.fecha));
  fila('DOCUMENTO',info.t+(f.boleta?' N° '+f.boleta:' (se emite en el SII)'));
  // Tabla
  y+=4; pdf.setFillColor(238,241,246); pdf.rect(14,y,W-28,9,'F');
  pdf.setTextColor(...NAVY); pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
  pdf.text('DESCRIPCIÓN',17,y+6); pdf.text('CANT.',120,y+6,{align:'right'}); pdf.text(info.iva?'P. UNIT. NETO':'VALOR UNIT.',155,y+6,{align:'right'}); pdf.text(info.iva?'NETO':'TOTAL',W-17,y+6,{align:'right'});
  y+=16; pdf.setTextColor(...TXT); pdf.setFont('helvetica','normal'); pdf.setFontSize(10);
  const desc=f.tipo==='mensualidad'?'Mensualidad '+_cobroMes(f.mes):'Atletas inscritos (aprobados)';
  pdf.text(desc,17,y); pdf.text(String(f.atletas),120,y,{align:'right'}); pdf.text(_clp(f.tarifa),155,y,{align:'right'}); pdf.text(_clp(f.monto),W-17,y,{align:'right'});
  y+=6; pdf.setDrawColor(210,214,222); pdf.line(14,y,W-14,y); y+=9;
  const tot=(et,val,fuerte)=>{pdf.setFont('helvetica',fuerte?'bold':'normal');pdf.setFontSize(fuerte?12:10);pdf.setTextColor(...(fuerte?NAVY:TXT));
    pdf.text(et,155,y,{align:'right'});pdf.text(val,W-17,y,{align:'right'});y+=fuerte?9:7;};
  if(info.iva){ tot('Neto',_clp(m.base)); tot('IVA '+_cobroPct(cfg.iva),_clp(m.imp)); tot('TOTAL A PAGAR',_clp(m.total),true); }
  else{ tot('Monto bruto',_clp(m.base),true); tot('Retención '+_cobroPct(cfg.retencion),'– '+_clp(m.imp)); tot('Líquido',_clp(m.liquido)); }
  // Dónde pagar
  if(bk.numero){
    y+=6; pdf.setFillColor(246,248,251); pdf.rect(14,y,W-28,40,'F');
    pdf.setTextColor(...NAVY); pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.text('DATOS PARA TRANSFERENCIA',19,y+8);
    let yy=y+15;
    [['Titular',bk.titular||em.razon],['RUT',bk.rut||em.rut],['Banco',bk.banco],['Tipo de cuenta',bk.tipo],['N° de cuenta',bk.numero],['Comprobante a',bk.correo||em.correo]]
      .filter(x=>x[1]).forEach(([a,b],k)=>{const col=k%2,row=Math.floor(k/2);
        pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);pdf.setTextColor(...GRIS);pdf.text(a,19+col*90,yy+row*8);
        pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.setTextColor(...TXT);pdf.text(String(b),50+col*90,yy+row*8);});
    y+=46;
  }
  y+=4; pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); pdf.setTextColor(...GRIS);
  const nota=info.iva
    ?'Este documento es el detalle del cobro. El documento tributario es la '+info.t.toLowerCase()+(f.boleta?' N° '+f.boleta:'')+' emitida por '+(em.razon||'YourLift SpA')+' en el SII.'
    :'Este documento es el detalle del cobro. El documento tributario es la boleta de honorarios electrónica emitida en el SII. '
     +'Si el cliente es persona jurídica, retiene el '+_cobroPct(cfg.retencion)+' y lo entera en el SII; deposita el líquido.';
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
  const n=pdf.getNumberOfPages(); for(let p=1;p<=n;p++){pdf.setPage(p);pdf.text((em.razon||'YourLift SpA')+' · yourlift.cl',W/2,292,{align:'center'});}
  const limpio=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'');
  pdf.save('Cobro_YourLift_'+limpio(f.tipo==='mensualidad'?'Mensualidad_'+f.mes:f.titulo)+'.pdf');
};

// ── Pantalla ──
// La guía paso a paso: qué documento emitir, cómo se emite en el SII y cómo se
// declara el IVA. Va en la misma pantalla porque se usa una vez al mes y en el
// intertanto se olvida. Los montos de ejemplo salen de la tarifa guardada.
function _cobroGuia(cfg,abierta){
  const t=+cfg.tarifa||3000, n=100, pct=+cfg.iva||19, f=1+pct/100;
  const netoA=t*n, ivaA=Math.round(netoA*pct/100);
  const totB=t*n, netoB=Math.round(totB/f), ivaB=totB-netoB, tNeta=Math.round(t/f);
  const h3=x=>`<div style="font-family:Oswald;font-size:13px;letter-spacing:1px;color:var(--gold);margin:18px 0 8px">${x}</div>`;
  const ol=a=>`<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:7px">${a.map(x=>`<li>${x}</li>`).join('')}</ol>`;
  const ul=a=>`<ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px">${a.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  const td='padding:7px 10px;border-bottom:1px solid var(--border)', tdn=td+';text-align:right;font-family:Oswald';
  const b=x=>`<b style="color:var(--text)">${x}</b>`;
  return `<details id="cobro_guia" ${abierta?'open':''} ontoggle="ST.cobroGuia=this.open" style="background:var(--card);border:1px solid rgba(212,168,67,.45);border-radius:12px;padding:14px 18px;margin:14px 0 22px">
    <summary style="cursor:pointer;font-family:Oswald;font-size:15px;letter-spacing:1px">GUÍA: CÓMO FACTURAR Y PAGAR EL IVA</summary>
    <div style="font-size:13px;color:var(--muted);line-height:1.65;max-width:860px">
      ${h3('1. QUÉ DOCUMENTO SE EMITE')}
      ${ul([
        `A un club, una corporación o FECHIPO (tienen RUT y giro): ${b('factura electrónica del SII')}, con IVA. Es lo normal.`,
        `A una persona sin RUT de empresa: ${b('boleta electrónica')}, también con IVA.`,
        `${b('No va boleta de honorarios')}: esa es para personas naturales y ${esc(cfg.emisor&&cfg.emisor.razon||'YourLift SpA')} es una empresa.`,
        `El ${b('cobro en PDF')} de esta pantalla no es el documento tributario: es el detalle (cuántos atletas, sus nombres y los montos). Se manda ${b('junto con')} la factura del SII.`])}
      ${h3('2. ¿LA TARIFA ES CON O SIN IVA?')}
      <p style="margin:0 0 8px">Acá la tarifa se toma como ${b('neto')} y el IVA se suma encima. Con ${_clp(t)} por atleta y ${n} atletas:</p>
      <div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px;min-width:460px">
        <tr><th style="${td};text-align:left">ACUERDO</th><th style="${td};text-align:right">NETO</th><th style="${td};text-align:right">IVA ${_cobroPct(pct)}</th><th style="${td};text-align:right">TE PAGA</th></tr>
        <tr><td style="${td}">${_clp(t)} + IVA</td><td style="${tdn}">${_clp(netoA)}</td><td style="${tdn}">${_clp(ivaA)}</td><td style="${tdn}">${_clp(netoA+ivaA)}</td></tr>
        <tr><td style="${td}">${_clp(t)} con IVA incluido</td><td style="${tdn}">${_clp(netoB)}</td><td style="${tdn}">${_clp(ivaB)}</td><td style="${tdn}">${_clp(totB)}</td></tr>
      </table></div>
      <p style="margin:8px 0 0">Si acordaron que el atleta paga ${_clp(t)} en total, guarda como tarifa el neto: ${b(_clp(tNeta))}. Conviene dejarlo escrito con el organizador antes del campeonato.</p>
      ${h3('3. EMITIR LA FACTURA')}
      ${ol([
        `Acá, en la fila del campeonato: ${b('Preparar cobro')}. Revisa la cantidad de atletas y los datos del cliente (RUT, razón social, giro, dirección) y aprieta ${b('Copiar datos para el SII')}.`,
        `En ${b('sii.cl → Servicios online → Factura electrónica → Sistema de facturación gratuito del SII → Emitir documento → Factura electrónica')}. Necesitas el ${b('certificado digital')} (firma electrónica) del representante de la empresa.`,
        `Pega los datos del cliente. En el detalle, por ejemplo: «Servicio plataforma YourLift: inscripciones y transmisión, Regional Centro 2026». Cantidad: los atletas; precio unitario: el ${b('neto')}. ${b('Firma y envía')}.`,
        `Vuelve acá, anota el ${b('N° de la factura')} y aprieta ${b('Guardar')}. Baja el ${b('Cobro PDF')} y mándale al cliente la factura del SII y el PDF.`,
        `Cuando te paguen: ${b('Marcar pagado')}.`])}
      ${h3('4. PAGAR EL IVA (F29)')}
      ${ul([
        `${b('Cuándo')}: el mes siguiente al de la factura, hasta el ${b('día 20')} (una factura de noviembre se declara hasta el 20 de diciembre). Se paga ${b('aunque el cliente todavía no te haya pagado')}.`,
        `${b('Dónde')}: ${b('sii.cl → Servicios online → Impuestos mensuales → Declarar IVA (F29)')} → el mes. El SII muestra una ${b('propuesta')} con tus facturas (del Registro de Compras y Ventas).`,
        `${b('Qué revisar')}: que calce con el ${b('Resumen para el F29')} de abajo (eliges el mes): código ${b('503')} = cantidad de facturas y código ${b('502')} = IVA débito. Las boletas van en 110 y 111.`,
        `${b('Crédito fiscal')}: el IVA de lo que compraste con factura a nombre de la empresa (hosting, equipos…) se ${b('resta')}. La propuesta lo trae.`,
        `${b('PPM')}: pago provisional sobre las ventas netas (código 563). La tasa te la da el contador; se guarda abajo, en Datos de cobro.`,
        `Un mes ${b('sin ventas')} igual se presenta el F29, ${b('sin movimiento')}.`])}
      <p style="margin:16px 0 0;font-size:12px">Revisa el primer F29 con tu contador. Los menús del SII pueden cambiar de nombre.</p>
    </div>
  </details>`;
}

function renderCobros(){
  if(ST._cobrosLoaded!==true){ if(!ST._cobrosLoaded)setTimeout(cobrosCargar,0); return '<div class="h1">Cobros YourLift</div><p class="subtitle">Cargando…</p>'; }
  const cfg=ST.cobrosCfg, f=ST.cobroForm, em=cfg.emisor, bk=cfg.banco;
  const lbl='display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted);font-family:Oswald;letter-spacing:1px';
  const caja='background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin:14px 0 22px';
  const sub='font-family:Oswald;font-size:12px;letter-spacing:1px;color:var(--gold);margin:16px 0 10px';
  const grid='display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px';
  const campo=(t,id,val,extra)=>`<label style="${lbl}">${t}<input id="${id}" class="inp" value="${esc(val==null?'':val)}" ${extra||''}></label>`;
  const chip=e=>{const c=e==='pagada'?'var(--green)':e==='emitida'?'var(--gold)':'var(--muted)';
    return `<span style="font-family:Oswald;font-size:10px;letter-spacing:1px;border:1px solid ${c};color:${c};border-radius:10px;padding:2px 8px;white-space:nowrap">${(COBRO_ESTADOS[e]||e).toUpperCase()}</span>`;};
  const docSel=(id,val,extra)=>`<select id="${id}" class="inp" ${extra||''}>${Object.entries(COBRO_DOCS).map(([k,d])=>
    `<option value="${k}" ${_cobroDoc(val)===k?'selected':''}>${d.t}${d.iva?' (con IVA)':' (retención)'}</option>`).join('')}</select>`;
  const numDoc=c=>c.boleta?`<div style="font-size:11px;color:var(--muted);margin-top:3px">${esc(COBRO_DOCS[_cobroDoc(c.documento)].t)} N° ${esc(c.boleta)}</div>`:'';

  // Totales
  const items=ST.cobros||[];
  const suma=(fn)=>items.filter(fn).reduce((s,c)=>s+(+c.total||0),0);
  const emitido=suma(c=>c.estado!=='pendiente'), pagado=suma(c=>c.estado==='pagada'), porCobrar=suma(c=>c.estado==='emitida');
  const eventos=(ST.eventos||[]).map(ev=>({ev,n:cobroAtletas(ev).length})).filter(x=>x.n>0)
    .sort((a,b)=>String(b.ev.date||'').localeCompare(String(a.ev.date||'')));
  const sinDoc=eventos.filter(x=>!_cobroDeEvento(x.ev.id));
  const estimado=sinDoc.reduce((s,x)=>s+cobroMontos(x.n*cfg.tarifa,cfg.documento).total,0);
  const tarjeta=(t,v,s,color)=>`<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
    <div style="font-family:Oswald;font-size:11px;letter-spacing:1px;color:var(--muted)">${t}</div>
    <div style="font-family:Oswald;font-size:24px;font-weight:700;color:${color||'var(--text)'};margin-top:4px">${v}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px">${s}</div></div>`;

  // Formulario abierto
  let form='';
  if(f){
    f.documento=_cobroDoc(f.documento); f.monto=(+f.atletas||0)*(+f.tarifa||0); f.glosa=_cobroGlosa(f);
    const m=cobroMontos(f.monto,f.documento), info=COBRO_DOCS[f.documento];
    form=`<div id="cobro_form" style="${caja};border-color:var(--gold)">
      <div style="font-family:Oswald;font-size:15px;letter-spacing:1px;margin-bottom:4px">${f.tipo==='mensualidad'?'COBRO DE MENSUALIDAD':'COBRO DEL CAMPEONATO'}</div>
      <div style="font-size:12px;color:var(--muted)">${esc(f.tipo==='mensualidad'?'Mensualidad de la plataforma':f.titulo)}</div>
      <div style="${sub}">CLIENTE</div>
      <div style="${grid}">
        ${campo('RAZÓN SOCIAL / NOMBRE *','cb_cliente',f.cliente,'placeholder="Club u organización que paga"')}
        ${campo('RUT','cb_rut',f.clienteRut,'placeholder="65.123.456-7"')}
        ${campo('GIRO','cb_giro',f.clienteGiro,'placeholder="Club deportivo"')}
        ${campo('DIRECCIÓN','cb_dir',f.clienteDireccion,'placeholder="Calle 123, Comuna"')}
        ${campo('CORREO (para mandarle el cobro)','cb_correo',f.clienteCorreo,'type="email"')}
      </div>
      <div style="${sub}">COBRO</div>
      <div style="${grid}">
        ${f.tipo==='mensualidad'?campo('MES','cb_mes',f.mes,'type="month" onchange="cobroRecalcular()"'):campo('ATLETAS','cb_atletas',f.atletas,'inputmode="numeric" onchange="cobroRecalcular()"')}
        ${campo(f.tipo==='mensualidad'?'MONTO MENSUAL'+(info.iva?' (NETO)':''):'TARIFA POR ATLETA'+(info.iva?' (NETO)':''),'cb_tarifa',f.tarifa,'inputmode="numeric" onchange="cobroRecalcular()"')}
        <label style="${lbl}">DOCUMENTO${docSel('cb_doc',f.documento,'onchange="cobroRecalcular()"')}</label>
      </div>
      <div style="margin:16px 0;padding:12px 14px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;font-size:13px;line-height:1.8">
        <div><span style="color:var(--muted)">Detalle:</span> <b>${esc(f.glosa)}</b></div>
        ${info.iva
          ?`<div><span style="color:var(--muted)">Neto</span> ${_clp(m.base)} · <span style="color:var(--muted)">IVA ${_cobroPct(cfg.iva)}</span> ${_clp(m.imp)} · <b style="color:var(--gold)">Total ${_clp(m.total)}</b></div>`
          :`<div><b style="color:var(--gold)">Bruto ${_clp(m.base)}</b> · <span style="color:var(--muted)">retención ${_cobroPct(cfg.retencion)}</span> ${_clp(m.imp)} · <span style="color:var(--muted)">líquido</span> ${_clp(m.liquido)}</div>`}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <button class="btn" onclick="cobroCopiar()" title="RUT, razón social, giro, dirección, detalle y montos, para pegarlos en el formulario del SII">Copiar datos para el SII</button>
        <button class="btn" onclick="window.open('https://www.sii.cl','_blank','noopener')" title="Servicios online → Factura electrónica → Sistema de facturación gratuito del SII → Emitir documento">Abrir SII ↗</button>
        <button class="btn" onclick="cobroPDF()" title="El cobro para mandarle al cliente: datos de la empresa, montos y dónde transferir">Cobro PDF</button>
        <span style="flex:1"></span>
        ${campo('N° '+(info.t.split(' ')[0]).toUpperCase()+' SII','cb_boleta',f.boleta,'placeholder="Al emitirla" style="width:130px"')}
        ${campo('FECHA DE EMISIÓN','cb_fecha',f.fecha,'type="date"')}
        <button class="btn btn-b" onclick="cobroGuardar()">Guardar</button>
        <button class="btn" onclick="cobroCerrarForm()" style="background:transparent;border:1px solid var(--border);color:var(--muted)">Cerrar</button>
      </div>
    </div>`;
  }

  const acciones=c=>`<button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroPDF('${c.id}')">PDF</button>
    ${c.estado==='pagada'?`<button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroPagado('${c.id}',false)">Desmarcar pago</button>`
      :`<button class="btn" style="font-size:11px;padding:5px 10px;border-color:var(--green);color:var(--green)" onclick="cobroPagado('${c.id}',true)">Marcar pagado</button>`}
    <button class="btn" style="font-size:11px;padding:5px 10px" onclick="cobroEditar('${c.id}')">Editar</button>`;
  const filasEv=eventos.map(({ev,n})=>{
    const c=_cobroDeEvento(ev.id);
    const m=c?{total:c.total}:cobroMontos(n*cfg.tarifa,cfg.documento);
    return `<tr>
      <td style="padding:9px 10px;font-size:12px;white-space:nowrap;color:var(--muted)">${esc(ev.date||'')}</td>
      <td style="padding:9px 10px"><div style="font-weight:600">${esc(ev.name||ev.id)}</div><div style="font-size:11px;color:var(--muted)">${esc((c&&c.cliente)||ev.org||'—')}</div></td>
      <td style="padding:9px 10px;text-align:right;font-family:Oswald">${c?c.atletas:n}${c&&+c.atletas!==n?`<div style="font-size:10px;color:var(--muted)" title="Inscritos aprobados hoy">hoy ${n}</div>`:''}</td>
      <td style="padding:9px 10px;text-align:right;font-family:Oswald;white-space:nowrap">${_clp(m.total)}</td>
      <td style="padding:9px 10px">${chip(c?c.estado:'pendiente')}${c?numDoc(c):''}</td>
      <td style="padding:9px 10px;text-align:right;white-space:nowrap">
        ${c?acciones(c):`<button class="btn btn-b" style="font-size:11px;padding:5px 10px" onclick="cobroPreparar('${esc(ev.id)}')">Preparar cobro</button>`}
      </td></tr>`;
  }).join('');

  const mensual=items.filter(c=>c.tipo==='mensualidad').sort((a,b)=>String(b.mes).localeCompare(String(a.mes)));
  const filasMes=mensual.map(c=>`<tr>
      <td style="padding:9px 10px;font-family:Oswald">${esc(_cobroMes(c.mes))}</td>
      <td style="padding:9px 10px">${esc(c.cliente||'')}</td>
      <td style="padding:9px 10px;text-align:right;font-family:Oswald">${_clp(c.total)}</td>
      <td style="padding:9px 10px">${chip(c.estado)}${numDoc(c)}</td>
      <td style="padding:9px 10px;text-align:right;white-space:nowrap">${acciones(c)}
        <button class="btn btn-r" style="font-size:11px;padding:5px 10px" onclick="cobroBorrar('${c.id}')">Borrar</button></td></tr>`).join('');

  // F29
  const mesF29=ST.cobroF29||_cobroHoy().slice(0,7), r=cobroF29(mesF29);
  const lf=(t,a,b,c,fuerte)=>`<tr${fuerte?' style="font-weight:700"':''}><td style="padding:7px 10px">${t}</td><td style="padding:7px 10px;text-align:right;font-family:Oswald">${a}</td>
    <td style="padding:7px 10px;text-align:right;font-family:Oswald">${b}</td><td style="padding:7px 10px;text-align:right;font-family:Oswald;${fuerte?'color:var(--gold)':''}">${c}</td></tr>`;
  const ppm=cfg.ppm>0?Math.round(r.neto*cfg.ppm/100):null;

  const th='padding:8px 10px;font-family:Oswald;font-size:10px;letter-spacing:1px;color:var(--muted);text-align:left;border-bottom:1px solid var(--border)';
  return `<div class="h1">Cobros YourLift</div>
    <p class="subtitle">Lo que ${esc(em.razon||'YourLift SpA')} le cobra a cada organizador por su campeonato y a FECHIPO por la mensualidad. El documento (factura o boleta) se emite en el SII; acá se calcula, se copian los datos para el formulario del SII, se baja el cobro en PDF para el cliente y queda el registro para el F29. Solo lo ve el owner.</p>
    ${ST._cobrosErr?`<div style="margin:12px 0;padding:10px 14px;border:1px solid var(--red);border-radius:8px;color:var(--red);font-size:12px">No se pudo leer el registro de cobros: ${esc(ST._cobrosErr.message||'')}. Revisa que las reglas de Firestore estén publicadas.</div>`:''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:14px 0">
      ${tarjeta('EMITIDO',_clp(emitido),items.filter(c=>c.estado!=='pendiente').length+' documentos')}
      ${tarjeta('PAGADO',_clp(pagado),items.filter(c=>c.estado==='pagada').length+' pagados','var(--green)')}
      ${tarjeta('POR COBRAR',_clp(porCobrar),'emitidos sin pago','var(--gold)')}
      ${tarjeta('SIN EMITIR',_clp(estimado),sinDoc.length+' campeonatos'+(cfg.tarifa?'':' · falta la tarifa'))}
    </div>
    ${_cobroGuia(cfg,ST.cobroGuia!==undefined?ST.cobroGuia:!items.some(c=>c.estado!=='pendiente'))}
    ${form}
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
    <div class="card" style="padding:0;overflow-x:auto;margin-bottom:22px">
      ${mensual.length?`<table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><th style="${th}">MES</th><th style="${th}">CLIENTE</th><th style="${th};text-align:right">TOTAL</th><th style="${th}">ESTADO</th><th style="${th}"></th></tr>
        ${filasMes}</table>`:`<div style="padding:18px;color:var(--muted);font-size:13px">Sin mensualidades registradas.</div>`}
    </div>
    <div id="cobro_f29" style="${caja}">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="font-family:Oswald;font-size:15px;letter-spacing:1px">RESUMEN PARA EL F29</div>
        <input type="month" class="inp" value="${esc(mesF29)}" onchange="cobroF29Mes(this.value)" style="width:170px">
      </div>
      <p style="font-size:12px;color:var(--muted);margin:8px 0 12px">Lo emitido con IVA en ${esc(_cobroMes(mesF29))}, según la fecha de emisión. El F29 de un mes se declara al mes siguiente. Al IVA débito se le resta el IVA de tus compras con factura (crédito fiscal): el SII lo propone con el Registro de Compras y Ventas. Revísalo con tu contador.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><th style="${th}"></th><th style="${th};text-align:right">DOCUMENTOS</th><th style="${th};text-align:right">NETO</th><th style="${th};text-align:right">IVA DÉBITO</th></tr>
        ${lf('Facturas emitidas <span style="font-size:11px;color:var(--muted)">· cód. 503 y 502</span>',r.facturas.n,_clp(r.facturas.neto),_clp(r.facturas.iva))}
        ${lf('Boletas emitidas <span style="font-size:11px;color:var(--muted)">· cód. 110 y 111</span>',r.boletas.n,_clp(r.boletas.neto),_clp(r.boletas.iva))}
        ${lf('Total del mes',r.facturas.n+r.boletas.n,_clp(r.neto),_clp(r.iva),true)}
      </table>
      <div style="font-size:11px;color:var(--muted);margin-top:8px">En el F29 van la cantidad de documentos y el IVA débito (facturas: códigos 503 y 502; boletas: 110 y 111). Las ventas netas son la base del PPM (código 563).</div>
      ${ppm!==null?`<div style="font-size:13px;margin-top:10px">PPM (${_cobroPct(cfg.ppm)} de las ventas netas): <b>${_clp(ppm)}</b></div>`:''}
    </div>
    <div style="${caja}">
      <div style="font-family:Oswald;font-size:15px;letter-spacing:1px">DATOS DE COBRO</div>
      <div style="${sub}">TARIFAS</div>
      <div style="${grid}">
        ${campo('TARIFA POR ATLETA (NETO, CLP)','cc_tarifa',cfg.tarifa||'','inputmode="numeric" placeholder="Ej: 3000"')}
        ${campo('MENSUALIDAD FECHIPO (NETO, CLP)','cc_mensual',cfg.mensualidad||'','inputmode="numeric"')}
        <label style="${lbl}">DOCUMENTO POR DEFECTO${docSel('cc_doc',cfg.documento)}</label>
        ${campo('TASA PPM (%) · opcional','cc_ppm',cfg.ppm?String(cfg.ppm).replace('.',','):'','placeholder="La que te indique el contador"')}
        ${campo('RETENCIÓN HONORARIOS (%)','cc_ret',String(cfg.retencion).replace('.',','),'title="Solo para boleta de honorarios: 15,25% en 2026 · 16% en 2027 · 17% en 2028"')}
      </div>
      <div style="${sub}">EMPRESA (SALE EN EL COBRO)</div>
      <div style="${grid}">
        ${campo('RAZÓN SOCIAL','ce_razon',em.razon)}
        ${campo('RUT','ce_rut',em.rut,'placeholder="77.123.456-7"')}
        ${campo('GIRO','ce_giro',em.giro,'placeholder="Servicios de software"')}
        ${campo('DIRECCIÓN','ce_dir',em.direccion)}
        ${campo('CORREO','ce_correo',em.correo,'type="email"')}
      </div>
      <div style="${sub}">DATOS PARA TRANSFERENCIA (SALEN EN EL COBRO)</div>
      <div style="${grid}">
        ${campo('BANCO','cbk_banco',bk.banco)}
        ${campo('TIPO DE CUENTA','cbk_tipo',bk.tipo)}
        ${campo('N° DE CUENTA','cbk_num',bk.numero)}
        ${campo('TITULAR','cbk_titular',bk.titular)}
        ${campo('RUT TITULAR','cbk_rut',bk.rut)}
        ${campo('CORREO PARA EL COMPROBANTE','cbk_correo',bk.correo,'type="email"')}
      </div>
      <div style="margin-top:16px"><button class="btn btn-b" onclick="cobroCfgGuardar()">Guardar datos</button></div>
    </div>`;
}

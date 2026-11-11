// admin.html — campeonatos abiertos: los que no son de la federación.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.
//
// Un campeonato abierto (la Copa Panda, por ejemplo) lo organiza alguien de
// afuera y se inscribe cualquiera. Por eso tiene su propio formulario
// (inscripcion_abierta.html?ev=<id>), que no pide RUT ni código de atleta, y
// lo que llega NO entra a la base de atletas, al ranking ni a los récords: va a
// su propia colección, que nada de eso lee.
//
//   inscripciones_abiertas/{id}       nombre, club, género, año de nacimiento,
//                                     división, categoría, modalidad y estado.
//                                     Pública: la nómina del sitio y el livecast.
//   inscripciones_abiertas_priv/{id}  correo, teléfono, fecha de nacimiento,
//                                     polera, talla, monto, foto y comprobante.
//                                     Solo quien ve datos personales.
//
// La foto del atleta es privada. Sale en la nómina del sitio y en la
// transmisión solo si el atleta lo autorizó (fotoAutoriza: la casilla opcional
// del formulario, o se lo dijo a la organización) Y el admin la revisó y la
// aceptó en Nóminas. Al aceptarla se copia a athlete_photos/ y el enlace queda
// en inscripciones_abiertas/{id}.fotoUrl; al rechazarla o quitarla se borra la
// copia.
//
// La configuración (precios, polera, datos de transferencia) va en el mismo
// documento del campeonato: eventos/{id}.abierto y eventos/{id}.ab.

const AB_DEFECTO={reglamento:'IPF',precio:35000,polera:true,precioPolera:43000,
  tallas:['S','M','L','XL','XXL','XXXL'],mods:['Classic','Equipado'],
  pago:{titular:'',rut:'',banco:'',tipo:'',numero:'',correo:''},nota:''};
// Los datos personales de un campeonato abierto se borran a más tardar a los
// 12 meses del campeonato (política de privacidad, punto de campeonatos abiertos).
const AB_MESES_CONSERVA=12;

function _abConf(ev){
  const a=(ev&&ev.ab)||{};
  return {...AB_DEFECTO,...a,pago:{...AB_DEFECTO.pago,...(a.pago||{})},
    tallas:(Array.isArray(a.tallas)&&a.tallas.length)?a.tallas:AB_DEFECTO.tallas,
    mods:(Array.isArray(a.mods)&&a.mods.length)?a.mods:AB_DEFECTO.mods};
}
function _abPesos(n){ return '$'+Math.round(+n||0).toLocaleString('es-CL'); }
function _abEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _abLink(id){ return location.origin+location.pathname.replace(/[^/]*$/,'')+'inscripcion_abierta.html?ev='+encodeURIComponent(id); }
function _abClub(i){ return i.club==='Otro'?(i.clubOtro||'Otro'):(i.club||''); }

// ── En el formulario del campeonato ─────────────────────────
function _abFormHtml(ed,isNew){
  const on=ed.abierto===true, c=_abConf(ed), p=c.pago;
  const inp=(id,v,ph,t)=>`<input class="inp" id="${id}"${t?` type="${t}"`:''} value="${_abEsc(v)}" placeholder="${_abEsc(ph||'')}">`;
  const campo=(t,html)=>`<label class="field" style="margin:0"><span>${t}</span>${html}</label>`;
  return `<div class="field" style="grid-column:span 2;padding:12px 14px;background:rgba(212,168,67,.06);border:1px solid rgba(212,168,67,.4);border-radius:10px">
    <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;text-transform:none;letter-spacing:0;margin:0">
      <input type="checkbox" id="ef_abierto" ${on?'checked':''} onchange="document.getElementById('ef_abBox').style.display=this.checked?'':'none'" style="width:18px;height:18px;flex:none;margin-top:2px">
      <span><span style="font-weight:600;color:var(--text);font-size:13px">Campeonato abierto</span>
      <span style="display:block;font-size:11px;color:var(--muted);margin-top:2px;line-height:1.5">Para un campeonato que no es de la federación. Tiene su propio formulario: <b>no pide RUT ni código de atleta</b>, cobra la inscripción (y la polera, si la ofreces) y pide el comprobante de transferencia. Lo que llega <b>no entra a la base de atletas, al ranking ni a los récords</b>.</span></span>
    </label>
    <div id="ef_abBox" style="${on?'':'display:none;'}margin-top:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${campo('Reglamento',inp('ef_abReg',c.reglamento,'IPF'))}
        ${campo('Modalidades (separadas por coma)',inp('ef_abMods',c.mods.join(', '),'Classic, Equipado'))}
        ${campo('Valor de la inscripción ($)',inp('ef_abPrecio',c.precio,'35000','number'))}
        ${campo('Valor inscripción + polera ($)',inp('ef_abPrecioPolera',c.precioPolera,'43000','number'))}
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);cursor:pointer;text-transform:none;letter-spacing:0;margin:0">
          <input type="checkbox" id="ef_abPolera" ${c.polera?'checked':''} style="width:16px;height:16px;flex:none;margin:0"> Ofrecer polera (el atleta elige si la quiere)</label>
        ${campo('Tallas de polera (separadas por coma)',inp('ef_abTallas',c.tallas.join(', '),'S, M, L, XL, XXL, XXXL'))}
      </div>
      <div style="font-family:Oswald;font-size:12px;letter-spacing:1px;color:var(--gold);margin:16px 0 2px">DATOS DE TRANSFERENCIA</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Salen en el formulario, al lado del espacio para subir el comprobante.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${campo('Nombre del titular',inp('ef_abTitular',p.titular))}
        ${campo('RUT del titular',inp('ef_abRut',p.rut))}
        ${campo('Banco',inp('ef_abBanco',p.banco))}
        ${campo('Tipo de cuenta',inp('ef_abTipo',p.tipo,'Cuenta Vista'))}
        ${campo('Número de cuenta',inp('ef_abNumero',p.numero))}
        ${campo('Correo',inp('ef_abCorreo',p.correo))}
      </div>
      <label class="field" style="margin:12px 0 0"><span>Texto para los atletas (opcional)</span>
        <textarea id="ef_abNota" rows="3" placeholder="Horarios de pesaje, dirección del recinto, contacto…" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;font-family:inherit">${_abEsc(c.nota)}</textarea></label>
      <div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.6">
        Las inscripciones se cierran con el <b>Cierre PRE-NÓMINA</b> de arriba (o al pasar el campeonato a Cerrado).
        ${isNew?'El link del formulario aparece al guardar.':`Link del formulario: <code style="color:var(--text)">${_abEsc(_abLink(ed.id))}</code>
          <button type="button" class="btn" style="padding:3px 10px;font-size:11px;margin-left:4px" onclick="navigator.clipboard.writeText('${_abEsc(_abLink(ed.id))}').then(()=>showToast('Link copiado'))">Copiar</button>`}
      </div>
    </div>
  </div>`;
}

// Lo que se guarda en eventos/{id}. Devuelve {abierto, ab} o {error}.
function _abLeerForm(){
  const v=id=>((document.getElementById(id)||{}).value||'').trim();
  const lista=s=>[...new Set(String(s).split(',').map(x=>x.trim()).filter(Boolean))];
  const num=s=>Math.round(+String(s).replace(/[^\d]/g,'')||0);
  const abierto=!!(document.getElementById('ef_abierto')||{}).checked;
  const mods=lista(v('ef_abMods')), tallas=lista(v('ef_abTallas').toUpperCase());
  const ab={
    reglamento:v('ef_abReg')||'IPF',
    mods:mods.length?mods:AB_DEFECTO.mods.slice(),
    precio:num(v('ef_abPrecio')),
    polera:!!(document.getElementById('ef_abPolera')||{}).checked,
    precioPolera:num(v('ef_abPrecioPolera')),
    tallas:tallas.length?tallas:AB_DEFECTO.tallas.slice(),
    pago:{titular:v('ef_abTitular'),rut:v('ef_abRut'),banco:v('ef_abBanco'),tipo:v('ef_abTipo'),numero:v('ef_abNumero'),correo:v('ef_abCorreo')},
    nota:v('ef_abNota')
  };
  if(abierto){
    if(!ab.precio)return {error:'Falta el valor de la inscripción del campeonato abierto'};
    if(ab.polera&&!ab.precioPolera)return {error:'Falta el valor de la inscripción con polera'};
    if(!ab.pago.titular||!ab.pago.numero)return {error:'Faltan los datos de transferencia (titular y número de cuenta)'};
  }
  return {abierto,ab};
}

// ── Las inscripciones de un campeonato abierto ──────────────
// Se leen al abrir la lista, no quedan escuchando: son pocas y solo se miran acá.
async function _abLeer(evId){
  const qs=await getDocs(query(collection(db,'inscripciones_abiertas'),where('evento','==',evId)));
  const priv={}; let sinPriv=false;
  try{
    const ps=await getDocs(query(collection(db,'inscripciones_abiertas_priv'),where('evento','==',evId)));
    ps.forEach(d=>{priv[d.id]=d.data();});
  }catch(e){ sinPriv=true; }
  const ts=x=>(x&&x.seconds)||(x&&x.toMillis&&x.toMillis()/1000)||0;
  const lista=qs.docs.map(d=>{
    const p=priv[d.id]||{};
    // Las rutas originales de los archivos: al abrirlos se cambian por el enlace.
    return {id:d.id,...d.data(),_p:{...p,docs:{...(p.docs||{})}},_rutas:{...(p.docs||{})}};
  }).sort((a,b)=>ts(a.timestamp)-ts(b.timestamp));
  return {lista,sinPriv};
}

// Para el cronograma: las aprobadas, con la forma de una inscripción de siempre.
async function _abAprobadas(evId){
  const {lista}=await _abLeer(evId);
  return lista.filter(i=>i.status==='approved').map(i=>({...i,club:_abClub(i),codigo:''}));
}

window.abVer=async function(evId){
  ST.abVer=evId; ST.eventoForm=null;
  await _abCargar(evId);
};
// La lista de inscritos de un campeonato, compartida por "Ver inscritos"
// (Campeonatos) y Nóminas: las acciones (aprobar, eliminar) la tocan a ella.
async function _abCargar(evId){
  ST.abListaEv=evId; ST.abLista=null; render();
  try{
    const r=await _abLeer(evId);
    if(ST.abListaEv!==evId)return;           // mientras tanto se eligió otro
    ST.abLista=r.lista; ST.abSinPriv=r.sinPriv;
  }catch(e){ ST.abLista=[]; showToast('No se pudieron leer las inscripciones: '+(e.code||e.message),null,true); }
  render();
  // Las fotos (privadas) se piden aparte, para verlas en miniatura al revisarlas.
  if(ST.abLista&&ST.abLista.length&&!ST.abSinPriv){
    const l=ST.abLista;
    await Promise.all(l.filter(i=>i._rutas.fotoAtleta).map(async i=>{
      const t={x:{docs:{fotoAtleta:i._rutas.fotoAtleta}}};
      try{ await _resolverArchivos(t); }catch(e){}
      const u=t.x.docs.fotoAtleta;
      if(u&&!YLPrivacidad.esRutaArchivo(u))i._fotoVer=u;
    }));
    if(ST.abLista===l)render();
  }
}

// ── La foto en la nómina: revisarla y aceptarla ─────────────
// 'publicada' (aceptada, sale en la nómina), 'rechazada', 'autorizo' (marcó la
// casilla, falta revisarla), 'sinautorizar' (subió foto, no marcó la casilla) o
// 'sinfoto'.
function _abFotoEstado(i){
  if(i.fotoUrl)return 'publicada';
  if(i.fotoEstado==='rechazada')return 'rechazada';
  if(!i._rutas||!i._rutas.fotoAtleta)return i.fotoAutoriza?'autorizo':'sinfoto';
  return i.fotoAutoriza?'autorizo':'sinautorizar';
}
function _abFotosPorRevisar(l){ return (l||[]).filter(i=>i.status!=='rejected'&&_abFotoEstado(i)==='autorizo'&&i._rutas&&i._rutas.fotoAtleta).length; }
async function _abBorrarFotoPublica(i){
  if(!i.fotoRuta)return;
  try{ await deleteObject(storageRef(getStorage(app),i.fotoRuta)); }
  catch(e){ if(e.code!=='storage/object-not-found')console.warn('[abierto] foto pública',i.fotoRuta,e.code||e.message); }
}
// La celda de la foto, en Nóminas y en Ver inscritos.
function _abFotoCelda(i){
  const est=_abFotoEstado(i);
  const b=(t,f,col)=>`<button onclick="${f}" style="font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid ${col};background:transparent;color:${col};cursor:pointer;font-family:inherit">${t}</button>`;
  const src=est==='publicada'?i.fotoUrl:i._fotoVer;
  const borde=est==='publicada'?'2px solid var(--green)':est==='autorizo'?'2px solid var(--gold)':'1px solid var(--border)';
  const mini=src?`<img src="${_abEsc(src)}" alt="" onclick="${est==='publicada'?`window.open('${_abEsc(i.fotoUrl)}','_blank')`:`abAbrir('${i.id}','fotoAtleta')`}" title="Ver grande"
      style="width:46px;height:46px;border-radius:8px;object-fit:cover;border:${borde};cursor:zoom-in;flex:none;${est==='rechazada'?'opacity:.45;filter:grayscale(1)':''}">`
    :`<div style="width:46px;height:46px;border-radius:8px;border:1px dashed var(--border);flex:none;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--muted)">${est==='sinfoto'?'sin foto':'…'}</div>`;
  const txt={publicada:['En la nómina','var(--green)'],rechazada:['Rechazada','var(--red)'],autorizo:['Autorizó · por revisar','var(--gold)'],
    sinautorizar:['No marcó que se publique','var(--muted)'],sinfoto:['Sin foto','var(--muted)']}[est];
  const hayFoto=!!(i._rutas&&i._rutas.fotoAtleta);
  let acc='';
  if(ST.abSinPriv&&est!=='publicada')acc='';
  else if(est==='publicada')acc=b('Quitar foto',`abFotoQuitar('${i.id}')`,'var(--red)');
  else if(hayFoto)acc=b('Aceptar foto',`abFotoAceptar('${i.id}')`,'var(--green)')+(est==='rechazada'?'':' '+b('Rechazar foto',`abFotoQuitar('${i.id}')`,'var(--red)'));
  return `<div style="display:flex;align-items:center;gap:8px;min-width:230px">${mini}<div>
    <div style="font-size:10px;font-weight:700;color:${txt[1]};margin-bottom:4px">${txt[0]}</div>${acc}</div></div>`;
}

window.abFotoAceptar=async function(id){
  const i=(ST.abLista||[]).find(x=>x.id===id); if(!i||!i._rutas.fotoAtleta)return;
  if(!i.fotoAutoriza&&!confirm((i.nombre||'Este atleta')+' no marcó en el formulario que su foto puede salir en la nómina.\n\n¿Te autorizó a publicarla (por WhatsApp, correo o en persona)? Queda registrado que la organización tiene su autorización.\n\nAl aceptar, su foto se ve en la nómina del sitio y en la transmisión.'))return;
  showToast('Publicando la foto…');
  try{
    await _resolverArchivos({x:i._p});
    const u=i._p.docs.fotoAtleta;
    if(!u||YLPrivacidad.esRutaArchivo(u))throw new Error('no se pudo abrir la foto');
    const blob=await (await fetch(u)).blob();
    const tipo=/^image\//.test(blob.type)?blob.type:'image/jpeg';
    const ext=/webp/.test(tipo)?'webp':/png/.test(tipo)?'png':'jpg';
    // El nombre del archivo no lleva el nombre de la persona: campeonato e id.
    const ruta='athlete_photos/abierto_'+String(i.evento||ST.abListaEv).replace(/[^A-Za-z0-9_-]/g,'_')+'_'+id+'_'+Date.now()+'.'+ext;
    const ref=storageRef(getStorage(app),ruta);
    await uploadBytes(ref,blob,{contentType:tipo});
    const url=await getDownloadURL(ref);
    const upd={fotoUrl:url,fotoRuta:ruta,fotoEstado:'aceptada',fotoRevisadaTs:new Date().toISOString()};
    if(!i.fotoAutoriza){ upd.fotoAutoriza=true; upd.fotoAutorizaTs=new Date().toISOString(); upd.fotoAutorizaVia='organizacion'; }
    await _abBorrarFotoPublica(i);            // si había una copia anterior
    await updateDoc(doc(db,'inscripciones_abiertas',id),upd);
    Object.assign(i,upd);
    await logAction('abierta_foto_aceptar',id,null,i.nombre||'');
    showToast('Foto publicada: ya sale en la nómina');
    render();
  }catch(e){ showToast('No se pudo publicar la foto: '+(e.code||e.message),null,true); }
};

// Rechazarla (sin publicar) o quitarla de la nómina (ya publicada): se borra la
// copia pública. La foto privada sigue donde estaba, para la organización.
window.abFotoQuitar=async function(id){
  const i=(ST.abLista||[]).find(x=>x.id===id); if(!i)return;
  if(i.fotoUrl&&!confirm('¿Quitar la foto de '+(i.nombre||'')+' de la nómina y la transmisión?'))return;
  try{
    await _abBorrarFotoPublica(i);
    await updateDoc(doc(db,'inscripciones_abiertas',id),{fotoEstado:'rechazada',fotoUrl:deleteField(),fotoRuta:deleteField(),fotoRevisadaTs:new Date().toISOString()});
    delete i.fotoUrl; delete i.fotoRuta; i.fotoEstado='rechazada';
    await logAction('abierta_foto_quitar',id,null,i.nombre||'');
    render();
  }catch(e){ showToast('No se pudo cambiar la foto: '+(e.code||e.message),null,true); }
};
// La lista se queda: la usa también Nóminas.
window.abCerrar=function(){ ST.abVer=null; render(); };

window.abEstado=async function(id,status){
  const i=(ST.abLista||[]).find(x=>x.id===id); if(!i)return;
  try{
    await updateDoc(doc(db,'inscripciones_abiertas',id),{status});
    i.status=status;
    await logAction('abierta_'+status,id,null,i.nombre||'');
    render();
  }catch(e){ showToast('No se pudo cambiar: '+(e.code||e.message),null,true); }
};

window.abAbrir=async function(id,k){
  const i=(ST.abLista||[]).find(x=>x.id===id); if(!i||!i._p.docs[k])return;
  const w=window.open('','_blank');
  await _resolverArchivos({x:i._p});
  const u=i._p.docs[k];
  if(YLPrivacidad.esRutaArchivo(u)){ if(w)w.close(); showToast('No se pudo abrir el archivo',null,true); return; }
  if(w)w.location=u; else window.open(u,'_blank');
};

async function _abBorrarArchivos(i){
  for(const v of Object.values(i._rutas||{})){
    const ruta=YLPrivacidad.rutaDe(v); if(!ruta)continue;
    try{ await deleteObject(storageRef(getStorage(app),ruta)); }
    catch(e){ if(e.code!=='storage/object-not-found')console.warn('[abierto] archivo',ruta,e.code||e.message); }
  }
}

window.abEliminar=async function(id){
  const i=(ST.abLista||[]).find(x=>x.id===id); if(!i)return;
  if(!confirm('¿Eliminar la inscripción de '+(i.nombre||'')+'?\n\nSe borran también su foto y su comprobante. No se puede deshacer.'))return;
  try{
    await _abBorrarArchivos(i);
    await _abBorrarFotoPublica(i);
    await deleteDoc(doc(db,'inscripciones_abiertas_priv',id)).catch(()=>{});
    await deleteDoc(doc(db,'inscripciones_abiertas',id));
    await logAction('abierta_eliminar',id,i.nombre||'',null);
    ST.abLista=ST.abLista.filter(x=>x.id!==id);
    render();
  }catch(e){ showToast('No se pudo eliminar: '+(e.code||e.message),null,true); }
};

// Terminado el campeonato, lo personal ya no hace falta: se borran correo,
// teléfono, fecha de nacimiento, foto y comprobante. Quedan el nombre, el club
// y la categoría (la nómina y el acta del campeonato).
window.abBorrarPersonales=async function(){
  const evId=ST.abVer, l=(ST.abLista||[]).filter(i=>Object.keys(i._p||{}).length>1||Object.keys(i._rutas||{}).length||i.fotoUrl);
  if(!l.length){ showToast('No quedan datos personales en este campeonato'); return; }
  if(!confirm('Se borran el correo, teléfono, fecha de nacimiento, foto (también la publicada en la nómina) y comprobante de '+l.length+' inscripción(es).\n\nQuedan el nombre, club, categoría y estado. Hazlo cuando ya no necesites revisar pagos ni contactar a nadie.\n\nNo se puede deshacer. ¿Seguir?'))return;
  let n=0;
  for(const i of l){
    try{
      await _abBorrarArchivos(i);
      if(i.fotoUrl||i.fotoRuta){
        await _abBorrarFotoPublica(i);
        await updateDoc(doc(db,'inscripciones_abiertas',i.id),{fotoUrl:deleteField(),fotoRuta:deleteField()});
        delete i.fotoUrl; delete i.fotoRuta;
      }
      await deleteDoc(doc(db,'inscripciones_abiertas_priv',i.id));
      i._p={docs:{}}; i._rutas={}; i._fotoVer=''; n++;
    }catch(e){ console.warn('[abierto] borrar',i.id,e.code||e.message); }
  }
  await logAction('abierta_borrar_personales',evId,null,String(n));
  showToast('Datos personales borrados de '+n+' inscripción(es)');
  render();
};

window.abExcel=function(){
  const ev=(ST.eventos||[]).find(e=>e.id===ST.abListaEv)||{};
  const est={pending:'Por revisar',approved:'Aprobada',rejected:'Rechazada'};
  const aoa=[['N°','Nombre','Género','Fecha de nacimiento','División','Categoría','Modalidad','Club','Correo','Teléfono','Polera','Talla','Monto','Estado']];
  (ST.abLista||[]).forEach((i,k)=>aoa.push([k+1,i.nombre||'',i.sexo||'',i._p.fechaNac||i.anioNac||'',i.division||'',i.categoria||'',i.modalidad||'',
    _abClub(i),i._p.correo||'',i._p.telefono||'',i._p.polera?'Sí':'No',i._p.talla||'',i._p.monto||'',est[i.status]||i.status||'']));
  _xlsxDownload(aoa,'Inscritos','inscritos_'+String(ev.id||ST.abListaEv).replace(/[^a-z0-9_-]/gi,'_')+'.xlsx');
};

function renderAbInscritos(){
  const ev=(ST.eventos||[]).find(e=>e.id===ST.abVer)||{id:ST.abVer,name:ST.abVer};
  const c=_abConf(ev);
  const volver=`<button class="btn" style="background:transparent;border:1px solid var(--border);color:var(--muted)" onclick="abCerrar()">← Campeonatos</button>`;
  // Se vuelve acá con la lista de otro campeonato (la dejó Nóminas): se pide la suya.
  if(ST.abListaEv!==ST.abVer)setTimeout(()=>{ if(ST.abVer&&ST.abListaEv!==ST.abVer)_abCargar(ST.abVer); },0);
  if(ST.abLista===null||ST.abListaEv!==ST.abVer)return `<div class="h1">${_abEsc(ev.name)}</div>${volver}<div class="card" style="margin-top:14px;color:var(--muted)">Cargando inscripciones…</div>`;
  const l=ST.abLista, vivas=l.filter(i=>i.status!=='rejected');
  const cuenta=s=>l.filter(i=>i.status===s).length;
  const tallas={}; vivas.forEach(i=>{ if(i._p.polera&&i._p.talla)tallas[i._p.talla]=(tallas[i._p.talla]||0)+1; });
  const monto=arr=>arr.reduce((s,i)=>s+(+i._p.monto||0),0);
  const fin=ev.date?new Date(ev.date+'T00:00:00'):null;
  const vencido=fin&&!isNaN(fin)&&(Date.now()-fin.getTime())>AB_MESES_CONSERVA*30.44*864e5;
  const quedan=l.some(i=>Object.keys(i._rutas||{}).length||i._p.correo||i._p.telefono);
  const tarjeta=(t,v,col)=>`<div style="background:rgba(10,22,40,.4);border:1px solid var(--border);border-radius:10px;padding:10px 14px;min-width:110px">
    <div style="font-family:Oswald;font-size:22px;font-weight:700;${col?'color:'+col:''}">${v}</div><div style="font-size:10px;color:var(--muted);letter-spacing:.5px">${t}</div></div>`;
  const pill=s=>s==='approved'?'<span style="color:var(--green);font-weight:700">Aprobada</span>'
    :s==='rejected'?'<span style="color:var(--red);font-weight:700">Rechazada</span>':'<span style="color:var(--gold);font-weight:700">Por revisar</span>';
  const btn=(t,f,col)=>`<button onclick="${f}" style="font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid ${col};background:transparent;color:${col};cursor:pointer;font-family:inherit">${t}</button>`;
  return `<div class="h1">${_abEsc(ev.name)}</div>
  <p class="subtitle">Campeonato abierto · ${_abEsc([ev.location,ev.days||ev.date].filter(Boolean).join(' · '))} · Reglamento ${_abEsc(c.reglamento)} · ${_abPesos(c.precio)}${c.polera?' / '+_abPesos(c.precioPolera)+' con polera':''}</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
    ${volver}
    <button class="btn btn-b" onclick="abVer('${_abEsc(ev.id)}')">Actualizar</button>
    <button class="btn btn-g" onclick="abExcel()" ${l.length?'':'disabled'}>Descargar Excel</button>
    <button class="btn" onclick="navigator.clipboard.writeText('${_abEsc(_abLink(ev.id))}').then(()=>showToast('Link copiado'))">Copiar link del formulario</button>
    ${_esOwnerAdm()&&quedan?`<button class="btn" style="margin-left:auto;background:transparent;border:1px solid rgba(239,68,68,.5);color:var(--red)" onclick="abBorrarPersonales()">Borrar datos personales</button>`:''}
  </div>
  ${vencido&&quedan?`<div class="card" style="border-left-color:var(--gold);color:var(--gold);font-size:12px">Pasaron más de ${AB_MESES_CONSERVA} meses desde el campeonato: corresponde borrar los datos personales (botón de arriba).</div>`:''}
  ${ST.abSinPriv?`<div class="card" style="font-size:12px;color:var(--muted)">Esta cuenta no ve datos personales: no se muestran correo, teléfono, pagos ni archivos.</div>`:''}
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
    ${tarjeta('INSCRITOS',l.length)}${tarjeta('POR REVISAR',cuenta('pending'),'var(--gold)')}${tarjeta('APROBADAS',cuenta('approved'),'var(--green)')}${tarjeta('RECHAZADAS',cuenta('rejected'),'var(--red)')}
    ${ST.abSinPriv?'':tarjeta('RECAUDADO (APROBADAS)',_abPesos(monto(l.filter(i=>i.status==='approved'))),'var(--green)')}
    ${ST.abSinPriv||!c.polera?'':tarjeta('POLERAS',Object.keys(tallas).length?c.tallas.filter(t=>tallas[t]).map(t=>t+': '+tallas[t]).join(' · '):'0')}
  </div>
  <div class="card" style="padding:0;overflow-x:auto">
    ${!l.length?'<div style="padding:30px;text-align:center;color:var(--muted)">Todavía no hay inscripciones.</div>':`
    <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:1160px">
      <thead><tr style="text-align:left;color:var(--muted);font-size:10px;letter-spacing:.5px;text-transform:uppercase">
        ${['#','Atleta','División · categoría','Modalidad','Club','Contacto','Polera','Pago','Foto en la nómina','Comprobante','Estado',''].map(t=>`<th style="padding:10px 8px;border-bottom:1px solid var(--border)">${t}</th>`).join('')}
      </tr></thead>
      <tbody>${l.map((i,k)=>`<tr style="border-bottom:1px solid rgba(29,49,80,.4);${i.status==='rejected'?'opacity:.55':''}">
        <td style="padding:8px">${k+1}</td>
        <td style="padding:8px"><div style="font-weight:600">${_abEd(i,'nombre',_abEsc(i.nombre))}</div><div style="color:var(--muted);font-size:11px">${_abEd(i,'sexo',_abEsc(i.sexo||'?'))}${i._p.fechaNac?' · '+_abEsc(i._p.fechaNac):i.anioNac?' · '+_abEsc(i.anioNac):''}</div></td>
        <td style="padding:8px">${_abEd(i,'division',_abEsc(i.division||'—'))}<br><span style="color:var(--muted)">${_abEd(i,'categoria',_abEsc(i.categoria||'—'))}</span></td>
        <td style="padding:8px">${_abEd(i,'modalidad',_abEsc(i.modalidad||'—'))}</td>
        <td style="padding:8px">${_abEd(i,'club',_abEsc(_abClub(i)||'—'))}</td>
        <td style="padding:8px;font-size:11px">${_abEsc(i._p.correo||'')}<br><span style="color:var(--muted)">${_abEsc(i._p.telefono||'')}</span></td>
        <td style="padding:8px">${i._p.polera?'Sí · '+_abEsc(i._p.talla||'?'):'<span style="color:var(--muted)">No</span>'}</td>
        <td style="padding:8px">${i._p.monto?_abPesos(i._p.monto):''}</td>
        <td style="padding:8px">${_abFotoCelda(i)}</td>
        <td style="padding:8px;white-space:nowrap">${i._p.docs.comprobante?btn('Comprobante',`abAbrir('${i.id}','comprobante')`,'var(--gold)'):''}</td>
        <td style="padding:8px">${pill(i.status)}</td>
        <td style="padding:8px;white-space:nowrap">
          ${i.status!=='approved'?btn('Aprobar',`abEstado('${i.id}','approved')`,'var(--green)'):''}
          ${i.status!=='rejected'?btn('Rechazar',`abEstado('${i.id}','rejected')`,'var(--red)'):''}
          ${btn('Eliminar',`abEliminar('${i.id}')`,'var(--muted)')}
        </td>
      </tr>`).join('')}</tbody>
    </table>`}
  </div>
  <p style="font-size:11px;color:var(--muted);line-height:1.6;max-width:760px">Aprobar = el pago está revisado. La nómina del sitio y el livecast muestran a las aprobadas y a las por revisar, igual que en un campeonato de la federación; las rechazadas no. Nada de esto pasa a la base de atletas, al ranking ni a los récords.</p>`;
}

// ── Corregir lo que llenó el atleta ─────────────────────────
// Nombre, género, división, categoría, modalidad y club se corrigen con un
// click, igual que en la nómina de la federación (antes no se podía: solo
// aprobar o rechazar). Las opciones son las del formulario abierto, no las de la
// federación. El club se escribe o se elige; "Independiente" es para quien no
// tiene club. Lo personal (correo, teléfono, fecha) no se toca acá.
const AB_DIVS=['Sub-Junior','Junior','Open','Master I','Master II','Master III','Master IV'];
const AB_CATS={Masculino:['-53 kg','-59 kg','-66 kg','-74 kg','-83 kg','-93 kg','-105 kg','-120 kg','+120 kg'],
               Femenino:['-43 kg','-47 kg','-52 kg','-57 kg','-63 kg','-69 kg','-76 kg','-84 kg','+84 kg']};
const AB_EDITABLES={nombre:'nombre',sexo:'género',division:'división',categoria:'categoría',modalidad:'modalidad',club:'club'};
function _abEd(i,campo,html){
  return `<span class="editable" onclick="abEditar('${i.id}','${campo}')" title="Click para corregir">${html}</span>`;
}
window.abEditar=function(id,campo){
  const i=(ST.abLista||[]).find(x=>x.id===id); if(!i||!AB_EDITABLES[campo])return;
  const ev=(ST.eventos||[]).find(e=>e.id===(i.evento||ST.abListaEv))||{}, c=_abConf(ev);
  const actual=campo==='club'?_abClub(i):(i[campo]||'');
  const opciones={sexo:['Femenino','Masculino'],division:AB_DIVS,
    categoria:AB_CATS[i.sexo]||AB_CATS.Femenino.concat(AB_CATS.Masculino),modalidad:c.mods}[campo];
  const clubs=['Independiente'].concat((ST.abLista||[]).map(_abClub));
  openEditModal(`Corregir ${AB_EDITABLES[campo]} de ${_abEsc(i.nombre||'')}`,campo,actual,async nv=>{
    nv=String(nv||'').trim().replace(/\s+/g,' ');
    if(!nv){ showToast('No puede quedar vacío',null,true); return; }
    if(campo==='nombre'&&(nv.length<3||nv.length>120)){ showToast('El nombre tiene que tener entre 3 y 120 letras',null,true); return; }
    if(nv===actual)return;
    // El club escrito a mano iba en clubOtro (club: 'Otro'): al corregirlo queda
    // como club, sin el "Otro".
    const upd=campo==='club'?{club:nv,clubOtro:''}:{[campo]:nv};
    const antes=campo==='club'?{club:i.club||'',clubOtro:i.clubOtro||''}:{[campo]:i[campo]||''};
    try{
      await updateDoc(doc(db,'inscripciones_abiertas',id),upd);
      Object.assign(i,upd);
      await logAction('abierta_editar',id+'.'+campo,actual,nv,{nombre:i.nombre||''});
      render();
      const aviso=campo==='sexo'&&i.categoria&&(AB_CATS[nv]||[]).indexOf(i.categoria)<0?' · revisa la categoría':'';
      showToast(`${AB_EDITABLES[campo][0].toUpperCase()+AB_EDITABLES[campo].slice(1)} corregido: ${i.nombre||''}${aviso}`,async()=>{
        await updateDoc(doc(db,'inscripciones_abiertas',id),antes);
        Object.assign(i,antes);
        await logAction('abierta_editar_deshacer',id+'.'+campo,nv,actual,{nombre:i.nombre||''});
        render(); showToast('Cambio revertido');
      });
    }catch(e){ showToast('No se pudo corregir: '+(e.code||e.message),null,true); }
  },{opciones,clubs});
};

// ── En Nóminas ───────────────────────────────────────────────
// El campeonato abierto sale en el mismo selector que los de la federación, con
// su nómina: lo que llenó cada atleta en el formulario, y su foto para revisarla
// y aceptarla (sale en la nómina del sitio solo si el atleta lo autorizó y el
// admin la acepta). Pagos y comprobantes están en Campeonatos → Ver inscritos.
function _abNominaOpciones(){
  return (ST.eventos||[]).filter(e=>e.abierto===true&&e.status!=='archived');
}
function renderNomAbierta(ev,selectHtml){
  if(ST.abListaEv!==ev.id)setTimeout(()=>{ if(ST.abListaEv!==ev.id)_abCargar(ev.id); },0);
  const cargando=ST.abListaEv!==ev.id||ST.abLista===null;
  const l=cargando?[]:ST.abLista.filter(i=>i.status!=='rejected');
  const c=_abConf(ev);
  const btn=(t,f,col)=>`<button onclick="${f}" style="font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid ${col};background:transparent;color:${col};cursor:pointer;font-family:Oswald">${t}</button>`;
  return `
    <div class="h1">Nóminas</div>
    <p class="subtitle">Campeonato abierto · ${cargando?'cargando…':l.length+' atletas'} · no entra al padrón, al ranking ni a los récords</p>
    ${!cargando&&_abFotosPorRevisar(l)?`<div class="card" style="border-left:3px solid var(--gold);font-size:12px;padding:10px 14px"><b style="color:var(--gold)">${_abFotosPorRevisar(l)} foto(s) por revisar.</b> Los atletas autorizaron que su foto salga en la nómina: revísala y acéptala (o recházala) en la columna Foto. Hasta que la aceptes no se publica. Tócala para verla grande.</div>`:''}
    <div class="search-box">
      ${selectHtml}
      <button class="btn btn-b" onclick="abExcel()" style="padding:8px 16px;font-size:12px" ${l.length?'':'disabled'}>Exportar Excel</button>
      <button class="btn" onclick="go('campeonatos');abVer('${_abEsc(ev.id)}')" style="padding:8px 16px;font-size:12px;background:rgba(212,168,67,.12);border:1px solid #D4A843;color:#D4A843">Pagos, fotos y comprobantes</button>
    </div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="tbl">
        <tr><th>#</th><th>Foto</th><th>Nombre</th><th>Sexo</th><th>División</th><th>Cat.</th><th>Modalidad</th><th>Club</th><th>Correo</th><th>Teléfono</th>${c.polera?'<th>Polera</th>':''}<th>Estado</th><th></th></tr>
        ${l.map((i,k)=>`<tr>
          <td style="color:var(--muted);font-family:Oswald">${k+1}</td>
          <td>${_abFotoCelda(i)}</td>
          <td>${_abEd(i,'nombre',_abEsc(i.nombre))}<br><span style="font-size:9px;color:var(--muted)">${_abEsc(i._p.fechaNac||i.anioNac||'')}</span></td>
          <td>${_abEd(i,'sexo',_abEsc(i.sexo||'?'))}</td>
          <td>${_abEd(i,'division',_abEsc(i.division||'—'))}</td>
          <td>${_abEd(i,'categoria',_abEsc(i.categoria||'—'))}</td>
          <td>${_abEd(i,'modalidad',_abEsc(i.modalidad||'—'))}</td>
          <td>${_abEd(i,'club',`${window.clubLogoImg?window.clubLogoImg(_abClub(i),18,'background:var(--bg);padding:1px;'):''} ${_abEsc(_abClub(i)||'—')}`)}</td>
          <td style="font-size:11px">${i._p.correo?`<span onclick="copiarCorreo('${_abEsc(i._p.correo)}')" title="Click para copiar" style="cursor:pointer;color:var(--blue);border-bottom:1px dashed rgba(96,165,250,.5)">${_abEsc(i._p.correo)}</span>`:'<span style="color:var(--muted)">—</span>'}</td>
          <td style="font-size:11px">${_abEsc(i._p.telefono||'—')}</td>
          ${c.polera?`<td style="font-size:11px">${i._p.polera?_abEsc(i._p.talla||'Sí'):'<span style="color:var(--muted)">No</span>'}</td>`:''}
          <td><span class="badge ${i.status==='approved'?'b-g':'b-y'}">${i.status==='approved'?'approved':'pending'}</span></td>
          <td style="white-space:nowrap">${i.status!=='approved'?btn('Aprobar',`abEstado('${i.id}','approved')`,'var(--green)'):''} ${btn('Rechazar',`abEstado('${i.id}','rejected')`,'var(--red)')}</td>
        </tr>`).join('')}
      </table>
      ${cargando?'<div class="empty">Cargando inscripciones…</div>':l.length===0?'<div class="empty">Sin atletas en este campeonato</div>':''}
    </div>`;
}

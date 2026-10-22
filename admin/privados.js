// admin.html — los datos personales de las inscripciones: dónde va cada campo.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.
//
// Las inscripciones (inscripciones/) se leen sin sesión: de ahí salen las
// nóminas, el livecast y el perfil del atleta. Por eso el documento público
// identifica al atleta solo por su código, y el RUT, la fecha de nacimiento, la
// comuna y los nombres de archivo viven en inscripciones_private/ (mismo id),
// que solo lee un admin. La lista de qué es privado está en
// compartido/privacidad.js (YLPrivacidad.INSC_PRIVADOS).
//
// El panel sí necesita todo junto —para cruzar con el padrón, revisar edades,
// los certificados—, así que al cargar mezcla lo privado en ST.inscripciones
// (_insMezclar). Y al guardar lo vuelve a repartir (inscGuardar / inscCrear):
// nada de lo privado se escribe en el documento público. Las reglas de
// Firestore lo exigen igual, también al admin, por si algún camino se olvida.

// ST.inscripciones = lo público + lo privado de cada una. El PIN no se mezcla:
// se sigue mirando en ST.inscripcionesPrivate, que es donde lo busca quien lo usa.
function _insMezclar(){
  const P=ST.inscripcionesPrivate||{};
  const campos=YLPrivacidad.INSC_PRIVADOS.filter(k=>k!=='pin');
  ST.inscripciones=(ST._insPub||[]).map(i=>{
    const p=P[i.id]; if(!p)return i;
    const o={...i};
    campos.forEach(k=>{ if(p[k]!==undefined&&p[k]!==''&&(o[k]===undefined||o[k]===''))o[k]=p[k]; });
    return o;
  });
}

// Guarda cambios de una inscripción que ya existe: cada campo a su documento.
async function inscGuardar(id,cambios){
  const {pub,priv}=YLPrivacidad.separarInscripcion(cambios);
  if(Object.keys(pub).length)await updateDoc(doc(db,'inscripciones',id),pub);
  if(Object.keys(priv).length)await setDoc(doc(db,'inscripciones_private',id),priv,{merge:true});
}

// Crea una inscripción desde el panel. El id es el de siempre (campeonato +
// código de atleta) si se sabe el código; si no, uno al azar. Devuelve el id.
async function inscCrear(id,datos,privExtra){
  const {pub,priv}=YLPrivacidad.separarInscripcion(datos);
  if(!id&&pub.codigo)id=YLPrivacidad.idInscripcion(pub.evento,pub.codigo);
  if(id)await setDoc(doc(db,'inscripciones',id),pub);
  else id=(await addDoc(collection(db,'inscripciones'),pub)).id;
  const p={...priv,...(privExtra||{})};
  if(Object.keys(p).length)await setDoc(doc(db,'inscripciones_private',id),{...p,ts:serverTimestamp()},{merge:true});
  return id;
}

// Los documentos que suben atletas y entrenadores quedan guardados por su
// ubicación ("storage:athlete_files/…"), porque el enlace de descarga solo lo
// puede pedir un admin. Acá se cambian por el enlace, en memoria, para que las
// pantallas del panel los abran como siempre. Lo ya resuelto no se vuelve a pedir.
const _URL_ARCHIVO={};
async function _resolverArchivos(docs){
  const pend=[];
  const ver=(obj,k)=>{
    const v=obj&&obj[k];
    if(!YLPrivacidad.esRutaArchivo(v))return;
    const ruta=YLPrivacidad.rutaDe(v);
    if(_URL_ARCHIVO[ruta]){obj[k]=_URL_ARCHIVO[ruta];return;}
    pend.push(getDownloadURL(storageRef(getStorage(app),ruta))
      .then(u=>{_URL_ARCHIVO[ruta]=u;obj[k]=u;})
      .catch(e=>console.warn('[archivo] no se pudo abrir',ruta,e.code||e.message)));
  };
  Object.values(docs||{}).forEach(p=>{
    if(!p)return;
    Object.keys(p).forEach(k=>{ if(/URL$/.test(k))ver(p,k); });
    if(p.docs&&typeof p.docs==='object')Object.keys(p.docs).forEach(k=>ver(p.docs,k));
  });
  if(pend.length)await Promise.all(pend);
}

// Un debutante: inscrito por primera vez, todavía no está en data.json. El
// sitio lo muestra desde atletas_pending/{código} (nombre, club, año), y el RUT
// y la fecha completa quedan en atletas_pending_priv/{código}, que solo lee un
// admin. Los de antes estaban guardados por RUT; la migración los pasa.
async function pendienteGuardar(p){
  const cod=String(p.codigo||'');
  if(!cod)throw new Error('Falta el código de atleta');
  await setDoc(doc(db,'atletas_pending',cod),{
    nombre:p.nombre||'', codigo:cod, sexo:p.sexo||'',
    anioNac:p.anioNac||YLPrivacidad.anio(p.fechaNac)||'', club:p.club||'', zona:p.zona||'',
    debut:true, inscripcion_evento:p.inscripcion_evento||'', ts:serverTimestamp(),
  });
  await setDoc(doc(db,'atletas_pending_priv',cod),{rut:p.rut||'',fechaNac:p.fechaNac||'',ts:serverTimestamp()});
  return cod;
}

// ── Copias públicas de las bases del panel ──
// Las bases de entrenadores (entrenadores/) y de jueces (referees/) están
// guardadas por RUT y traen correos: solo las lee un admin. Lo que el sitio
// muestra de ellas va en publico/{entrenadores, jueces, entrenadores_nomina},
// sin RUT ni correos, y el formulario de entrenador reconoce a quien escribe SU
// RUT en entrenadores_indice/{rut} (se lee de a uno, no se lista). El panel las
// rehace cuando cambia la base; solo escribe si algo cambió de verdad.
async function _publicarCopia(id,datos){
  const firma=JSON.stringify(datos);
  try{ const s=await getDoc(doc(db,'publico',id)); if(s.exists()&&(s.data()||{}).firma===firma)return false; }catch(e){}
  await setDoc(doc(db,'publico',id),{...datos,firma,ts:Date.now()});
  return true;
}

async function publicarJueces(refs){
  const lista=(refs||[]).filter(r=>r&&(r.codigoAtleta||r.codigo))
    .map(r=>({codigoAtleta:r.codigoAtleta||r.codigo,categoria:r.categoria||'',ambito:r.ambito||'nacional'}))
    .sort((a,b)=>a.codigoAtleta.localeCompare(b.codigoAtleta));
  return _publicarCopia('jueces',{lista});
}

async function publicarEntrenadores(ents){
  const base=(ents||[]).filter(e=>e&&e.nombre);
  const lista=base.map(e=>({nombre:e.nombre||'',club:e.club||'',categoria:e.categoria||'',codigoAtleta:e.codigoAtleta||''}))
    .sort((a,b)=>(a.club||'').localeCompare(b.club||'')||a.nombre.localeCompare(b.nombre));
  // El índice por RUT: lo justo para reconocerlo y saber si su acreditación
  // está vigente (inscripcion_entrenador.html).
  const indice={};
  base.forEach(e=>{ const r=YLPrivacidad.norm(e.rut||e.id); if(r.length<5)return;
    indice[r]={nombre:e.nombre||'',club:e.club||'',categoria:e.categoria||'',
      acreditaciones:(e.acreditaciones||[]).map(a=>({vence:a.vence||''})).filter(a=>a.vence)}; });
  const cambio=await _publicarCopia('entrenadores',{lista,nIndice:Object.keys(indice).length,
    firmaIndice:JSON.stringify(Object.keys(indice).sort().map(r=>[r,indice[r]]))});
  if(!cambio)return false;
  const viejos=new Set();
  try{ (await getDocs(collection(db,'entrenadores_indice'))).forEach(d=>viejos.add(d.id)); }catch(e){}
  const ops=[...Object.entries(indice).map(([r,v])=>['set',r,v]),
    ...[...viejos].filter(r=>!indice[r]).map(r=>['del',r])];
  for(let i=0;i<ops.length;i+=450){
    const b=writeBatch(db);
    ops.slice(i,i+450).forEach(([op,r,v])=>op==='set'?b.set(doc(db,'entrenadores_indice',r),v):b.delete(doc(db,'entrenadores_indice',r)));
    await b.commit();
  }
  return true;
}

// La nómina de entrenadores de cada campeonato (los aprobados), para la tarjeta
// del campeonato en yourlift.cl: nombre, club y a qué atletas lleva.
async function publicarNominaEntrenadores(insc){
  const porEvento={};
  (insc||[]).forEach(e=>{
    if(!e||e.status!=='approved'||!e.evento)return;
    (porEvento[e.evento]=porEvento[e.evento]||[]).push({nombre:e.nombre||'',club:e.club||'',
      atletas:(e.atletas||[]).map(a=>({nombre:a.nombre||''}))});
  });
  Object.values(porEvento).forEach(l=>l.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')));
  return _publicarCopia('entrenadores_nomina',{porEvento});
}

// Se rehacen un rato después del último cambio, no en cada uno.
const _pubTimers={};
function _programarPublicacion(clave,fn){
  clearTimeout(_pubTimers[clave]);
  _pubTimers[clave]=setTimeout(()=>{ fn().catch(e=>console.warn('[publico] '+clave+':',e.code||e.message)); },2500);
}

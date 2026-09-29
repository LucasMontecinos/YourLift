// livecast.html — El padrón de atletas (data.json), sus ediciones y las fotos.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

function nrm(s){return(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}

// ¿Es de Chile? Sin país anotado se asume que sí: en un campeonato nacional
// nadie carga el país y todos son chilenos.
function _esDeChile(a){
  const c=String((a&&(a.country||a.pais||a.pais3))||'').trim().toUpperCase();
  return !c||c==='CHI'||c==='CHILE'||c==='CL';
}

// Cruce con el padrón de la federación (data.json).
//
// OJO CON EL NOMBRE: el padrón es CHILENO. Un extranjero no está ahí, y si igual
// se lo busca por nombre termina pegado a la ficha de otra persona — le salen su
// foto, su código, sus mejores marcas y su historial de competencias, todo bajo
// el nombre del extranjero. No es un detalle estético: es mostrar en público los
// datos de alguien que no tiene nada que ver.
//
// Pasó en el Sudamericano: la peruana "Alvarez Fernanda" quedó cruzada con la
// chilena "Camila Fernanda Álvarez Carrasco" (código 2095CAC-2024), porque el
// cruce flojo pedía que cada palabra buscada estuviera DENTRO del nombre del
// padrón, y "alvarez" y "fernanda" están las dos.
//
// Reglas, de la más confiable a la menos:
//   1. el RUT manda y vale para cualquiera;
//   2. sin RUT solo se cruza por nombre a quien es de Chile;
//   3. y el cruce flojo, además, exige palabras completas y UNA sola candidata:
//      si hay dos que calzan no se elige ninguna, porque elegir mal es peor que
//      no mostrar el historial.
function findInDB(name,rut,ath){
  if(rut){const rc=rut.replace(/[^0-9kK]/g,'').toUpperCase();const m=DB_FULL.find(a=>{const dr=(a.rut||'').replace(/[^0-9kK]/g,'').toUpperCase();return dr&&dr===rc});if(m)return m}
  const nn=nrm(name); if(!nn)return null;
  if(ath&&!_esDeChile(ath))return null;
  const exacto=DB_FULL.find(a=>nrm(a.nombre)===nn);
  if(exacto)return exacto;
  const parts=nn.split(/\s+/);
  if(parts.length<2)return null;
  const cand=DB_FULL.filter(a=>{
    const pal=nrm(a.nombre).split(/\s+/);
    return parts.every(p=>pal.includes(p));
  });
  return cand.length===1?cand[0]:null;
}

// ── Fotos de los atletas: se cargan solo si alguna pantalla las muestra ─────
// atleta_fotos tiene una foto por atleta (unas quinientas). Antes cada apertura
// del livecast —cada espectador, cada televisor, cada widget de OBS— la leía
// entera DOS veces (había dos oyentes sobre la misma colección) y además bajaba
// la nómina de fotos del Sudamericano, aunque en esa pantalla no se viera
// ninguna foto. Ahora hay un solo oyente y arranca recién cuando una pantalla
// que muestra fotos lo pide: el perfil de la transmisión, la vista Atletas y el
// panel del operador (Atletas y Pesaje, subir foto/GIF).
function _pedirFotos(){
  if(window._fotosQueridas)return;
  window._fotosQueridas=true;
  _fotosArrancar();
}

function _fotosArrancar(){
  if(!window._fotosQueridas||window._fotosUnsub||!fbReady||!window._fb||!fbDB)return;
  try{
    window._fotosUnsub=window._fb.onSnapshot(window._fb.collection(fbDB,'atleta_fotos'),snap=>{
      window._fotosUltSnap=snap;
      _fotosAlPadron(snap);
      _fotosAlLivecast(snap);
      if(typeof renderTxWidget==='function')renderTxWidget();
      if(typeof R==='function')R();
    });
  }catch(e){console.warn('[livecast] atleta_fotos:',e.message);}
}

// Las fotos sobre el padrón (data.json). Si el padrón llega después que las
// fotos, se vuelven a pegar sobre el padrón nuevo con la última lectura.
function _fotosAlPadron(snap){
  if(!snap||!DB_FULL||!DB_FULL.length)return;
  snap.docs.forEach(doc=>{
    const d2=doc.data();
    // Por RUT primero: el código cambia al corregir un nombre o un RUT y la
    // foto quedaba apuntando al viejo.
    const ath=(window.YLEdiciones&&window.YLEdiciones.buscarAtleta(DB_FULL,Object.assign({id:doc.id},d2)))
              ||DB_FULL.find(a=>a.codigo===(d2.codigo||doc.id));
    if(ath){
      if(d2.foto_url)ath.foto_url=d2.foto_url;
      if(d2.gif_url!==undefined)ath.gif_url=d2.gif_url||null;
      if(d2.gif_blend)ath.gif_blend=d2.gif_blend;
      if(d2.gif_zoom!=null)ath.gif_zoom=d2.gif_zoom;
      if(d2.gif_offset_x!=null)ath.gif_offset_x=d2.gif_offset_x;
      if(d2.gif_offset_y!=null)ath.gif_offset_y=d2.gif_offset_y;
      if(d2.gif_start!=null)ath.gif_start=d2.gif_start;
      ath.gif_end=(d2.gif_end!=null?d2.gif_end:(null));
    }
  });
}

// El padrón que usa el livecast para buscar a un atleta por RUT o por nombre
// —su historial, su foto, su ficha— es data.json, y data.json no se entera de
// las correcciones que se hacen en el panel. Era la única pantalla que no las
// aplicaba: se le corregía el nombre a alguien y en competencia seguía saliendo
// el viejo, o se borraba una ficha repetida y el livecast la seguía encontrando.
// Las ediciones no tocan a los atletas del meet —esos vienen de la nómina—, solo
// al padrón contra el que se los busca.
function _aplicarEdicionesDB(){
  // Se llama dos veces —cuando llega el padrón y cuando Firebase queda listo—
  // porque no se sabe cuál de las dos gana la carrera. Se hace una sola vez.
  // La marca vive en window y no en un `let` de acá abajo: la función se llama
  // desde el arranque de Firebase, mucho antes en el archivo, y un `let` todavía
  // sin inicializar habría reventado la carga entera del livecast.
  if(window._lcEdicionesHechas||!window.YLEdiciones||!DB_FULL||!DB_FULL.length)return;
  if(!fbReady||!window._fb||!fbDB)return;
  window._lcEdicionesHechas=true;
  window.YLEdiciones.cargar(()=>
    window._fb.getDocs(window._fb.collection(fbDB,'athlete_edits'))
      .then(s=>s.docs.map(d=>Object.assign({},d.data(),{id:d.id})))
  ).then(eds=>{
    const r=window.YLEdiciones.aplicar(DB_FULL,eds);
    if(r.editados||r.borrados)console.log('[LC] padrón: '+r.editados+' ediciones, '+r.borrados+' bajas');
  }).catch(e=>console.warn('[LC] athlete_edits:',e&&e.message));
}

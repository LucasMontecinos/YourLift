// index.html — lo que corre al abrir la página, en su orden original.
// Se carga DESPUÉS de los demás archivos de sitio/, que solo definen
// funciones. El orden de estas instrucciones importa: no reordenar.

// Firebase config (same as inscripcion.html)
const FB_CFG={apiKey:"AIzaSyA21IHMus2bklPLJm7ExRrVJJL9bzLhyp4",authDomain:"fechipo-db-13148.firebaseapp.com",projectId:"fechipo-db-13148",storageBucket:"fechipo-db-13148.firebasestorage.app",messagingSenderId:"551573388751",appId:"1:551573388751:web:5fcc377a8d595378ab26ba"};
let NOM_EVENTS=[
  {id:"regional_centro_2026",name:"Campeonato Regional Centro FECHIPO 2026",date:"2026-05-09",closeDate:"2026-04-09",location:"Santiago, RM",org:"Athor Powerlifting",days:"09 y 10 de Mayo",extraCols:["modalidad"]},
  {id:"universitario_2026",name:"Primer Campeonato Nacional Universitario FECHIPO 2026",date:"2026-05-23",closeDate:"2026-04-23",location:"Talca",org:"Club Bushido Lifting",days:"23 de Mayo",extraCols:["universidad"]},
];
let fbDB=null,fbReady=false;
// ── Dibujar sin pisarle la mano al que está usando la página ──────────────
//
// Al abrir el sitio salen a buscarse una docena de cosas a Firestore, y cada una,
// al llegar, llamaba a render(), que rehace la pantalla entera. Como llegan
// escalonadas durante los primeros segundos, la página se redibujaba una docena
// de veces seguidas: eso es el pestañeo. Y si en el intermedio uno había elegido
// algo en un desplegable o escrito en un campo —inscripción, sobre todo—, el
// redibujado lo borraba. De ahí lo de "a la tercera funciona": había que
// apurarse a hacer clic entre dos redibujados.
//
// Un dibujado que NACE de una carga de fondo no puede pisar lo que la persona
// está haciendo. Si hay un campo enfocado, se anota que quedó pendiente y se
// hace apenas lo suelta. Los dibujados que nacen de un clic siguen siendo
// inmediatos: ahí el que manda es el usuario.
window._renderPendiente=false;
document.addEventListener('focusout',()=>setTimeout(()=>{
  if(!window._renderPendiente||_usandoAlgo())return;
  window._renderPendiente=false;
  render();
},0),true);
const _rutNormE=s=>String(s||'').replace(/[^0-9kK]/gi,'').toUpperCase();
// Mapa global de edits indexado por RUT (también por código como fallback).
// Permite aplicar las ediciones del admin a CUALQUIER colección (nóminas,
// ranking, etc.), no solo a data.json.
window.EDITS_BY_RUT={};
window.EDITS_BY_COD={};
window.applyEditOverlay=applyEditOverlay;
// ── Nómina de entrenadores ────────────────────────────────────────────────
// Hay campeonatos que tienen período de inscripción de entrenadores aparte del
// de los atletas, y su nómina también es aparte: el entrenador no compite, va
// con sus atletas.
//
// Solo se publican los APROBADOS. Uno pendiente todavía lo está revisando la
// organización, y publicarlo sería anunciar algo que no está decidido.
window.ENTRE_NOM={};
// Los formularios de entrenador abiertos. Salen de su propia colección: no
// cuelgan de un campeonato, porque el mismo mecanismo sirve para una
// convocatoria de acreditación, que no tiene campeonato ninguno.
window.FORMS_ENT=[];
window._nomOyente=window._nomOyente||null;
// El oyente se suelta cuando nadie mira la pestaña hace dos minutos (se fue a
// otra sección o dejó el teléfono): así una ida y vuelta rápida no vuelve a
// cobrar la primera lectura, y una pestaña olvidada no queda escuchando.
setInterval(()=>{
  const o=window._nomOyente; if(!o)return;
  const mirando=(ST.v==='nominas'&&document.visibilityState==='visible');
  if(mirando){o.fuera=0;return;}
  if(!o.fuera)o.fuera=Date.now();
  else if(Date.now()-o.fuera>2*60*1000)_nominasSoltar();
},10000);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&ST.v==='nominas'&&!window._nomOyente&&fbReady)_nominasEscuchar();
});
const CC={"Campeonato Nacional FECHIPO 2026":{bg:"#fef3c7",b:"#f59e0b",t:"#92400e",n:"Nacional 2026"},"Campeonato Nacional FECHIPO 2025":{bg:"#dbeafe",b:"#3b82f6",t:"#1e40af",n:"Nacional 2025"},"Regional Centro Norte 2025":{bg:"#dcfce7",b:"#22c55e",t:"#166534",n:"Reg. Centro Norte 2025"},"Regional Sur Austral 2025":{bg:"#f3e8ff",b:"#a855f7",t:"#6b21a8",n:"Reg. Sur Austral 2025"},"Zonal Centro Clausura 2024":{bg:"#ffe4e6",b:"#f43f5e",t:"#9f1239",n:"Zonal Centro 2024"},"Campeonato Nacional 2025":{bg:"#fef9c3",b:"#eab308",t:"#713f12",n:"Nacional 2025 "},"Campeonato Nacional 2023":{bg:"#e0f2fe",b:"#0ea5e9",t:"#0c4a6e",n:"Nacional 2023 "},"Zonal Sur Los Toros 2025":{bg:"#ecfdf5",b:"#10b981",t:"#064e3b",n:"Zonal Sur 2025 "},"Regional Centro 2025":{bg:"#fdf4ff",b:"#c084fc",t:"#581c87",n:"Reg. Centro 2025 "}};
// Categorías retiradas: no se muestran aunque vengan en los datos.
//
// La -72 era la categoría femenina antigua de la IPF y se pidió sacarla. Se borró
// de records.json, pero los récords que se ven salen de Firestore cuando existen
// —el panel los guarda ahí— y esa copia todavía los trae. Filtrando al cargar
// desaparecen al tiro para todo el mundo, venga de donde venga el dato; y como el
// panel filtra igual, la primera vez que alguien guarde desde Récords quedan
// borrados también allá.
const CATS_RETIRADAS = ['72'];
let D=[],R={},NM={events:[]},ST={v:"home",s:"",fc:"",fk:"",fl:"",sel:null,p:0,rt:"classic",rl:"sq",ne:0,ns:""};
let CERTCFG=null,CERTF={q:'',athlete:null,champId:'',motivo:'fines',destinoId:'',marcas:{sq:'',bp:'',dl:'',total:''},lugar:'',categoria:'',division:'',modalidad:'',ciudad:'',fechas:'',contacto:'',sent:false,err:''};
// ═══════════════════════════════════════════════════════════════
// RÉCORDS NACIONALES — buscador
// ═══════════════════════════════════════════════════════════════
// Antes era una tabla plana: elegías modalidad y movimiento, y salían los 400
// récords mezclados, hombres y mujeres juntos. Para buscar el de una categoría
// había que recorrerla con el dedo.
//
// Ahora se filtra como corresponde: primero hombres o mujeres, y después por
// división, por categoría o por nombre.
//
// EL SEXO NO ESTÁ EN LOS DATOS. Los récords de clásico y equipado guardan
// nombre, división, categoría, campeonato y marca, y nada más; solo los
// universitarios traen el sexo. Pero se puede deducir sin ambigüedad, porque las
// categorías de peso de la IPF no se repiten entre los dos: las de mujeres son
// 43/47/52/57/63/69/76/84/+84 y las de hombres 53/59/66/74/83/93/105/120/+120.
// Se comprobó contra los 399 récords cargados: ninguna categoría cae en las dos.
// La -72 es de la tabla femenina antigua y se deja mapeada aunque esté retirada,
// por si vuelve a aparecer en un dato viejo.
const CAT_F=['43','47','52','57','63','69','72','76','84','84+','+84'];
const CAT_M=['53','59','66','74','83','93','105','120','120+','+120'];
let _recTimer=null;
// Galería: cache de fotos
let GALLERY=[];
let GALLERY_FILTER='';
const _NSUDA_DIVORD={'Sub-Junior':0,'Junior':1,'Universitario':2,'Open':3,'Master I':4,'Master II':5,'Master III':6,'Master IV':7};
const _NSUDA_DIAS=['dom','lun','mar','mié','jue','vie','sáb'],
      _NSUDA_MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
// ══════════════════════════════════════════════════════════════════
// NÓMINAS — tarjetas por campeonato + vista tipo goodlift.
// Cada campeonato es una TARJETA a lo ancho (foto del evento, nombre, fecha,
// organizador — editable desde admin en "Tarjetas de Nóminas" → Firestore
// nomina_cards/{slug}). Al tocarla se despliega la nómina completa, agrupada
// por División (banda) y dentro por categoría de peso (subencabezado), estilo
// goodlift. Filtros (género/categoría/división/país·club/modalidad + buscador)
// para TODAS las nóminas.
// ══════════════════════════════════════════════════════════════════
const _NOM_ISO={'Chile':'cl','Argentina':'ar','Brasil':'br','Brazil':'br','Uruguay':'uy','Paraguay':'py','Perú':'pe','Peru':'pe','Bolivia':'bo','Ecuador':'ec','Colombia':'co','Venezuela':'ve','Guyana':'gy','Surinam':'sr','Suriname':'sr','Costa Rica':'cr','Panamá':'pa','México':'mx'};
const _NOM_DIVN={'subjunior':'Sub-Junior','sub-junior':'Sub-Junior','sub junior':'Sub-Junior','junior':'Junior','juniors':'Junior','universitario':'Universitario','univ':'Universitario','open':'Open','master i':'Master I','master 1':'Master I','master ii':'Master II','master 2':'Master II','master iii':'Master III','master 3':'Master III','master iv':'Master IV','master 4':'Master IV','special olympics':'Special Olympics','olimpiadas especiales':'Special Olympics'};
const _NOM_DIVORD={'Sub-Junior':0,'Junior':1,'Universitario':2,'Open':3,'Master I':4,'Master II':5,'Master III':6,'Master IV':7,'Special Olympics':8};
let _nomQT=null;
// ── Barra de filtros (común a todas las nóminas) ──
const NOM_CORTE='<!--LISTA-->';
// ── Avatar + ficha para las nóminas de campeonatos ────────────────
// Misma experiencia que la nómina del Sudamericano: foto a la izquierda del
// nombre y, al tocarlo, una ficha con sus datos. La foto sale del perfil del
// atleta (atleta_fotos por código); si no tiene, quedan sus iniciales.
// Las nóminas de campeonato traen RUT (no código), así que hay que pasar por
// el padrón (data.json) para llegar al código y de ahí a la foto de perfil.
// Se arma un índice una sola vez: si no, serían 100 atletas × 2000 del padrón
// en cada render.
let _NOMIDX=null,_NOMIDX_N=-1;
let _nssTimer=null;
// ── Lo que solo hace falta cuando abres esa pestaña ───────────────────────
//
// Las fotos de la nómina (329 documentos) y los entrenadores (101) no se usan en
// ninguna otra parte del sitio, y sin embargo se bajaban en CADA carga, incluso
// para alguien que entra al inicio, mira el próximo campeonato y se va. Eso es
// casi la mitad de las lecturas de Firestore de una visita típica, pagadas sin
// que nadie las mire.
//
// Ahora se piden la primera vez que se abre la pestaña que las necesita. Se
// piden una sola vez por sesión: `_yaPedido` evita que volver a la pestaña las
// vuelva a bajar.
// La marca vive en window y no en un const de acá: esta función se llama
// desde el arranque de Firebase, mucho antes en el archivo, y un const
// todavía sin inicializar reventaría la carga entera.
window._yaPedido=window._yaPedido||{};
let _ssTimer=null;
// Nómina oficial del Sudamericano 2026 (goodlift) — archivo estático versionado.
// Se muestra en la pestaña Nóminas solo cuando NOMSUDA.publicada===true en el JSON,
// o para previsualizar con ?nominasuda=1 en la URL antes de publicarla.
// Encima del archivo se aplican las CORRECCIONES hechas desde el admin
// (Nóminas → Sudamericano 2026): cambios de categoría/división/modalidad/lista
// y bajas. Viven en un único doc de Firestore (nomina_suda_edits/main) para no
// tener que regenerar el archivo por cada arreglo.
fetch('nomina_sudamericano.json').then(r=>r.ok?r.json():null).then(j=>{
  if(j)j._raw=(j.atletas||[]).slice();
  // El cronograma del Sudamericano también sale de acá, así que hay que
  // redibujarlo cuando llega: si no, quien entró directo a Cronograma se queda
  // con el selector sin la opción, porque se dibujó antes que el archivo.
  window.NOMSUDA=j; _nsudaApplyEdits(); if(ST.v==='nominas'||ST.v==='crono')renderFondo();
}).catch(()=>{});
Promise.all([fetch("data.json").then(r=>r.json()),fetch("records.json").then(r=>r.json()).catch(()=>({})),fetch("nominas.json").then(r=>r.json()).catch(()=>({events:[]}))]).then(([d,r,n])=>{D=d;R=sinRetiradas(r);NM=n;NM._static=[...(n.events||[])];render();initFB();
  // Las nóminas ya no se refrescan cada 3 minutos: mientras la pestaña está a
  // la vista las mantiene al día un oyente (ver _nominasEscuchar).
}).catch(e=>{document.getElementById("app").innerHTML=`<div class="ld"><p style="color:var(--accent);font-weight:600">Error cargando datos</p><p style="color:var(--muted);font-size:13px">${e.message}</p></div>`});

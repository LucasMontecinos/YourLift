// admin.html — lo que corre al abrir el panel, en su orden original: los
// import de Firebase, la conexión, el estado (ST) y lo que se prepara al cargar.
//
// Fuente del panel (ver armar_panel.js). El orden de estas instrucciones
// importa: no reordenar.

import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged,createUserWithEmailAndPassword} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {initializeApp as initSecondaryApp} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,getFirestore,collection,getDocs,getDoc,doc,setDoc,updateDoc,deleteDoc,deleteField,addDoc,query,where,orderBy,limit,onSnapshot,serverTimestamp,writeBatch} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {getStorage,ref as storageRef,uploadBytes,getDownloadURL,deleteObject,listAll} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
const FB_CFG={apiKey:"AIzaSyA21IHMus2bklPLJm7ExRrVJJL9bzLhyp4",authDomain:"fechipo-db-13148.firebaseapp.com",projectId:"fechipo-db-13148",storageBucket:"fechipo-db-13148.firebasestorage.app",messagingSenderId:"551573388751",appId:"1:551573388751:web:5fcc377a8d595378ab26ba"};
const app=initializeApp(FB_CFG);
const auth=getAuth(app);
const fbFunctions=getFunctions(app,'us-central1');
let db;
try{
  db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
}catch(e){
  db=getFirestore(app); // fallback si ya fue inicializado
}
// Estado global
// Comparativa en categoría. Antes esto era una constante gigante generada a mano y
// pegada acá, así que envejecía: mostraba el total que el atleta tenía el día que se
// generó, no el de hoy. Ahora se arma en el momento desde el padrón que la página ya
// carga (`_peersBuild`), así que un resultado nuevo aparece apenas se publica.
let PEERS={};
const ST={user:null,adminInfo:null,view:'athletes',data:null,nominas:null,inscripciones:[],auditLog:[],events:[],eventos:[],filterEv:'',filterClasif:'',search:'',filterLetter:'',eventoForm:null,eventoFormMode:'create',athleteProfile:null,pendingResults:0,competitionResults:[],editRequests:[],inscripcionesPrivate:{},achievementsByCodigo:{},fotosByCodigo:{},pasadas:{},cpSel:'',rankingCiclo:null,rankingCicloSel:'',
  // Filtros globales del dashboard de estadísticas (tipo Power BI)
  statsFilters:{ yearFrom:'', yearTo:'', sex:'', mod:'', div:'', club:'' },
  // Simulador del corte para el Nacional (Estadísticas → Corte Nacional)
  corte:{ modo:'cantidad', valor:10, agrupar:'cat_div_mod' },
  // Rango de años propio del ranking sin repetir (manda sobre el filtro global)
  glRankAnios:{ desde:'', hasta:'' },
  // Ranking de GL sin repetir atleta (Estadísticas → GL Points)
  glMin:0};
window.ST=ST;
// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════

// Safety net — always show something after 5s
setTimeout(()=>{
  const app=document.getElementById('app');
  if(app&&(app.innerHTML.includes('Cargando')||app.innerHTML.trim()===''))
    {ST.user=null;render();}
},5000);
onAuthStateChanged(auth,async(u)=>{window._authFired=true;
  if(!u){ST.user=null;ST.adminInfo=null;render();return}
  try{
    // La lectura va en su propio try: las reglas solo dejan leer admins/{uid} a un
    // admin, así que para una cuenta de juez esto NO devuelve "no existe", tira
    // permiso denegado. Sin esto se iba al catch de abajo y el juez veía un error
    // de sistema en vez de saber que su cuenta es solo para /jueces.
    let adminDoc=null;
    try{ adminDoc=await getDoc(doc(db,'admins',u.uid)); }catch(e){ adminDoc=null; }
    if(!adminDoc||!adminDoc.exists()){
      // Una cuenta de juez no entra acá, y es a propósito: sirve SOLO para marcar
      // luces en yourlift.cl/jueces. Se le dice con esas palabras, porque si no el
      // juez lee "Acceso denegado" y cree que su cuenta está mala.
      let esJuez=false;
      try{ esJuez=(await getDoc(doc(db,'jueces',u.uid))).exists(); }catch(e){}
      await signOut(auth);
      ST.user=null;ST.adminInfo=null;
      alert(esJuez
        ? 'Esta es una cuenta de juez: sirve solamente para marcar las luces en yourlift.cl/jueces.\n\nNo entra al panel de administración ni al control en vivo.'
        : 'Acceso denegado.\nUID: '+u.uid+'\n\nAgrega este UID a Firestore → admins/'+u.uid+' con campo role:"superadmin"');
      render();return;
    }
    ST.user=u;
    ST.adminInfo=adminDoc.data();
    sessionStorage.setItem('fechipo_admin_session','1');
    // ── bootstrap one-time: logro YourLift Owner para Lucas ──────────────
    (async()=>{
      try{
        const _achRef=doc(db,'atleta_achievements','2145LMA-2024');
        const _achSnap=await getDoc(_achRef);
        if(!_achSnap.exists()||!(_achSnap.data()?.achievements?.length)){
          await setDoc(_achRef,{
            codigo:'2145LMA-2024',
            achievements:[{label:'YourLift Owner',evento:'yourlift.cl',logo_url:'YourLift_logo.png',anio:null,color:'#C41E3A',display:'verified'}]
          });
          console.log('Bootstrap: logro de Lucas escrito en Firestore');
        }
      }catch(e){console.warn('Bootstrap achievement skip:',e.message);}
    })();
    // ─────────────────────────────────────────────────────────────────────
    // Las cuentas de transmisión y de mesa técnica no ven el panel, solo la
    // puerta al livecast (renderStreamingShell). Cargarles la base —inscripciones,
    // datos privados, resultados, fotos— eran miles de lecturas de Firestore en
    // cada entrada, para nada.
    if(ST.adminInfo?.role==='streaming'||ST.adminInfo?.role==='mesa'){ render(); }
    else loadAll(); // intentional: no await — render() called inside
  }catch(e){
    console.error('Auth error',e);
    ST.user=null;
    render();
  }
});
// ═══════════════════════════════════════════
// TOAST WITH UNDO
// ═══════════════════════════════════════════
let toastTimer=null,pendingUndo=null;
// ═══════════════════════════════════════════
// EDIT MODAL (universal)
// ═══════════════════════════════════════════
const FIELD_OPTS={
  sexo:['Hombre','Mujer'],
  division:['Sub Junior','Junior','Open','Master I','Master II','Master III','Master IV','Universitario','Debutantes'],
  modalidad:['Powerlifting Classic','Powerlifting Equipado','Powerlifting Classic + Only Bench Classic','Powerlifting Equipado + Only Bench Equipado','Powerlifting Universitario','Only Bench Classic','Only Bench Equipado','Olimpiadas Especiales'],
  status:['pending','approved','rejected']
};
const _clubIgual=(a,b)=>{
  const n=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  return n(a)===n(b);
};
// ═══════════════════════════════════════════════════════════
// FORMULARIOS DE ENTRENADOR
// ═══════════════════════════════════════════════════════════
// Un formulario de entrenador NO cuelga de un campeonato. Empezó ahí —dentro de
// la ficha del campeonato, junto a los documentos del atleta— y se sacó: el
// mismo mecanismo tiene que servir para las convocatorias de acreditación, que
// no tienen campeonato ninguno. Metido adentro del campeonato, cada convocatoria
// habría necesitado tocar el código.
//
// Hay dos tipos y la única diferencia real es si se eligen atletas:
//   · campeonato  → el entrenador dice a qué atletas lleva, de los inscritos ahí.
//   · acreditación → no hay atletas; postula él y sube sus papeles.
//
// Lo demás —quién puede, qué documentos, qué texto, hasta cuándo— es igual en
// los dos, y por eso es un solo constructor.
window.FE_TIPOS={campeonato:'Inscripción a un campeonato', acreditacion:'Convocatoria de acreditación'};
window._inscMatches=[];
// ════════════════════════════════════════════════════════════════
// Reemplazar un documento de inscripción: sube el archivo nuevo a
// Storage y ACTUALIZA la URL en inscripciones_private. No hay que
// tocar Storage manualmente — esto evita el problema de URLs viejas.
// docKey: clave nueva ('carnetIdFront'...) o legacy ('carnetURL'...)
// ════════════════════════════════════════════════════════════════
// Mapa docKey nuevo → campo legacy + storagePath
const DOC_STORAGE_MAP = {
  carnetIdFront:{legacy:'carnetURL',path:'carnet'},
  carnetIdReverso:{legacy:'carnetBackURL',path:'carnetBack'},
  fotoBlanco:{legacy:'carnetPhotoURL',path:'carnetPhoto'},
  pasaporte:{legacy:'passportURL',path:'passport'},
  wadaIntl:{legacy:'wadeURL',path:'wada'},
  ipfConsent:{legacy:'ipfConsentURL',path:'ipfConsent'},
  menorConsent:{legacy:'consentimientoURL',path:'consentimiento'},
  notas:{legacy:'notasURL',path:'notas'},
  // legacy keys (cuando el doc viene del sistema viejo)
  carnetURL:{legacy:'carnetURL',path:'carnet',newKey:'carnetIdFront'},
  wadeURL:{legacy:'wadeURL',path:'wada',newKey:'wadaIntl'},
  carnetPhotoURL:{legacy:'carnetPhotoURL',path:'carnetPhoto',newKey:'fotoBlanco'},
  consentimientoURL:{legacy:'consentimientoURL',path:'consentimiento',newKey:'menorConsent'},
  passportURL:{legacy:'passportURL',path:'passport',newKey:'pasaporte'},
  ipfConsentURL:{legacy:'ipfConsentURL',path:'ipfConsent',newKey:'ipfConsent'},
  notasURL:{legacy:'notasURL',path:'notas',newKey:'notas'}
};
// ═══════════════════════════════════════════
// PANEL DE LA CUENTA DE STREAMING
// ═══════════════════════════════════════════
// La cuenta de quien transmite entra al panel por una sola puerta: YourLift
// (LiftingCast). No ve la base de atletas, ni nóminas, ni inscripciones — nada de
// lo que se administra acá. Adentro del livecast elige el campeonato como todos, y
// de ahí solo tiene las pantallas de transmisión (ver _canAccess en livecast.html).
// La pantalla de los roles que NO administran: no ven el panel, solo la puerta
// a livecast. La comparten streaming y mesa técnica, que entran al mismo lugar
// pero a hacer cosas distintas, así que cambia lo que dice y no cómo se ve.
const _SHELL_ROL={
  streaming:{
    rol:'streaming', titulo:'Transmisión',
    bajada:'Esta cuenta es para transmitir. Abre YourLift, elige el campeonato y vas a tener las pantallas de la transmisión.',
    dentro:'Adentro vas a encontrar <b>Control TX</b>, <b>Control Remoto</b>, <b>Transmisión</b>, <b>Widgets OBS</b> y <b>Pantalla de Tarima</b>.'
  },
  mesa:{
    rol:'mesa técnica', titulo:'Mesa técnica',
    bajada:'Esta cuenta es para correr la competencia. Abre YourLift, elige el campeonato y vas a tener la mesa completa.',
    dentro:'Adentro vas a encontrar <b>Atletas y Pesaje</b>, <b>Control en Vivo</b>, <b>Documentos</b>, <b>Resultados</b> y las actas — lo mismo que un admin. Lo que no tienes es el resto del panel: nóminas, base de atletas y configuración quedan fuera.'
  }
};
// ════════════════════════════════════════════════════════════════
// TRÁFICO WEB (analytics propio) — lee analytics_daily de Firestore
// ════════════════════════════════════════════════════════════════
let _webCharts={};
// ── Google Analytics: foto del histórico ──────────────────────────────────
// El contador propio (analytics_daily) empezó a correr después que el sitio, así
// que no tiene los primeros meses. Esto es lo que midió Google Analytics desde
// que yourlift.cl se abrió al público, tomado a mano de los informes.
//
// NO se actualiza solo: no hay conexión con la API de Analytics. Es una foto con
// fecha, y por eso se muestra diciendo hasta cuándo llega. Para refrescarla hay
// que editar esta tabla con los informes nuevos.
// Foto del tráfico web, sacada de Google Analytics (propiedad fechipo-db).
//
// Antes estos números se copiaban a mano de las capturas del teléfono, con lo
// que eso tiene de frágil. Ahora salen de la API de Analytics; se actualizan
// pidiéndolo y quedan escritos acá porque el sitio no puede consultar Analytics
// por su cuenta: la clave que haría falta no puede viajar en una página pública.
//
// Los meses son meses calendario, no los períodos de treinta días que mostraba
// la aplicación del teléfono. Por eso los números no calzan uno a uno con los de
// antes: son la misma realidad, cortada distinto.
const GA_FOTO={
  desde:'1 de mayo de 2026',
  hasta:'2 de septiembre de 2026',
  tomada:'2 de septiembre de 2026',
  fuente:'Google Analytics · propiedad fechipo-db',
  periodos:[
    {p:'mayo 2026',      ses:3107, us:1150, nue:1157, vis:7880,  nota:''},
    {p:'junio 2026',     ses:7232, us:2244, nue:1949, vis:16745, nota:''},
    {p:'julio 2026',     ses:2219, us:699,  nue:397,  vis:5553,  nota:'sin campeonatos'},
    {p:'agosto 2026',    ses:9336, us:2449, nue:2038, vis:27293, nota:'dos regionales'},
  ],
  // Sesiones por canal, marzo a septiembre de 2026. "Directo" es quien llega
  // escribiendo la dirección o desde un link guardado; búsqueda es Google y Bing.
  canales:[['Directo',9540],['Búsqueda (Google/Bing)',8394],['Instagram y redes',2887],
           ['Instagram pagado',751],['Sin clasificar',200],['YouTube',108],['Otros',30]],
  paisesUltimoMes:[['Chile',2125],['Brasil',71],['Ecuador',64],['Colombia',50],['Estados Unidos',34]],
  // Usuarios de Chile por ciudad. No se suman entre meses: alguien que vuelve al
  // mes siguiente cuenta en los dos.
  regiones:[
    {p:'agosto 2026', cl:2125, r:[['Santiago',1390],['Concepción',321],['Antofagasta',278],['Temuco',168],['Viña del Mar',158]]},
  ],
  ciudadesUltimoMes:[['Santiago',1390],['Concepción',321],['Antofagasta',278],['Temuco',168],['Viña del Mar',158]],
  // El día más alto de agosto y con qué coincidió. Los días sin campeonato se
  // mueven entre 100 y 260 sesiones: la diferencia la hace la competencia, no la
  // publicidad.
  peak:{ses:1177, dia:'8 de agosto', evento:'Regional Centro Sur', prevMin:57, prevMax:383},
  igPagado:751,
  // Las páginas más vistas, marzo a septiembre. Sirve para saber qué se usa de
  // verdad antes de rediseñar nada.
  paginas:[['Inicio',20509],['Ranking',7337],['Inscripción',4874],
           ['Competencia en vivo — Regional Norte',2518],['Ficha de atleta',2514],
           ['Competencia en vivo — Centro Sur',1846],['Cronograma',232]],
};
// ── El rango que se está mirando ─────────────────────────────────────────────
// El contador propio guarda un documento POR DÍA, así que puede responder
// cualquier rango: no hay nada que pedirle a nadie. Antes mostraba tres cifras
// fijas —hoy, 7 días, 30 días— y para comparar un mes contra otro había que
// bajar el CSV y abrirlo en una planilla.
//
// Ojo con lo que este panel NO es: no es Google Analytics. Analytics mide con
// otra vara (sesiones, no visitas) y trae el histórico anterior a este contador.
// Por eso su foto sigue abajo, aparte y fechada, en vez de mezclar dos formas de
// contar en el mismo número.
const _WEB_RANGOS=[
  {k:'7',   l:'7 DÍAS',    d:7},
  {k:'30',  l:'30 DÍAS',   d:30},
  {k:'60',  l:'60 DÍAS',   d:60},
  {k:'90',  l:'90 DÍAS',   d:90},
  {k:'mes', l:'ESTE MES'},
  {k:'ant', l:'MES PASADO'},
  {k:'todo',l:'TODO'},
];
const _ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const _webEnRango=(days,r)=>days.filter(d=>d.date>=r.desde&&d.date<=r.hasta);
let _entWork=null;
// ═══════════════════════════════════════════
// BASE DE JUECES (referees) — Firestore: referees/{rutNormalizado}
// ═══════════════════════════════════════════
// Es una base APARTE de `jueces`. Esa otra son las cuentas con las que un juez
// marca las luces desde el teléfono: no todos los jueces tienen una, y las que
// hay no dicen quién es la persona ni en qué campeonatos trabajó.
//
// La foto también es aparte de la del atleta, y a propósito: muchos jueces
// compiten, y en la ficha de juez corresponde la foto de uniforme, no la de
// competencia. Va a public/referees/, que las reglas de Storage ya dejan escribir
// al admin y leer a cualquiera.
//
// La corbata dice la categoría, que es como se distinguen en la tarima:
//   FECHIPO Cat. 2 → gris     ·  FECHIPO Cat. 1 → negra
//   Internacional  → roja o azul según el rango
const REF_CORBATA={
  'nacional|2':{col:'#9AA5B1',txt:'JUEZ NACIONAL CAT II'},
  'nacional|1':{col:'#2B303B',txt:'JUEZ NACIONAL CAT I'},
  'internacional|2':{col:'#1E5BA8',txt:'JUEZ INTERNACIONAL CAT II'},
  'internacional|1':{col:'#C41E3A',txt:'JUEZ INTERNACIONAL CAT I'},
};
const refRutId=r=>String(r||'').replace(/[^0-9kK]/g,'').toUpperCase();
let _refWork=null;
// ── Certificados YourLift (solo owner) ───────────────────────────────────────
//
// Acredita que una persona sabe usar la plataforma: un juez que marca las luces
// desde el teléfono, quien opera la mesa de control, quien lleva la transmisión.
// Sirve para saber, antes de armar el equipo de un campeonato, quién ya está
// capacitado. El registro va en config/certificados_plataforma: esa colección la
// lee y la escribe solo un admin, así que el RUT y el correo no quedan públicos.
const CERT_DOC=['config','certificados_plataforma'];
const CERT_COMP=[
  ['luces','Luces de juez desde el teléfono'],
  ['crono','Cronómetro de tarima'],
  ['control','Control en Vivo (planilla de competencia)'],
  ['pesaje','Atletas y pesaje'],
  ['tx','Control TX y pantallas de transmisión'],
];
const CERT_ROLES={
  juez:{t:'Juez',comp:['luces','crono']},
  mesa:{t:'Mesa de control',comp:['control','pesaje','crono']},
  tx:{t:'Operador de transmisión',comp:['tx']},
  completo:{t:'Uso completo de la plataforma',comp:['luces','crono','control','pesaje','tx']},
};
const _esOwnerAdm=()=>ST.adminInfo?.role==='owner'||!!ST.adminInfo?.bootstrap;
const _certHoy=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const _MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const _certFechaLarga=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?(+m[3])+' de '+_MESES[+m[2]-1]+' de '+m[1]:(s||'');};
const _certArchivo=c=>'Certificado_YourLift_'+String(c.nombre||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')+'_'+c.codigo+'.pdf';
// Estadísticas es del owner y de nadie más.
//
// Antes lo deportivo —atletas, GL points, corte para el Nacional— lo veía
// cualquiera que estuviera en admins/, y solo la demografía y el tráfico web
// quedaban reservados. Pero la pantalla completa dice cuánta gente compite, de
// qué clubes, cuánto crece el padrón y cuántas afiliaciones deja cada
// campeonato: es la información con la que se negocia, no una herramienta de
// trabajo del día a día. Así que la puerta es una sola y la abre el owner.
const _statsOwner=()=>ST.adminInfo?.role==='owner'||!!ST.adminInfo?.bootstrap;
const _statsPuede=_statsOwner;
// Las cuentas que tienen su propia pantalla y no pintan nada en el panel. Ya no
// decide quién ve Estadísticas —eso es del owner— pero sí el resto de pantallas
// que la usan, como la de jueces.
const _ROLES_SIN_PANEL=['juez','streaming','transmision','mesa'];
let _demoCharts={};
// ═══════════════════════════════════════════
// GL POINTS
//
// Los kilos crudos no se pueden comparar entre una mujer de -52 y un hombre de
// -120, ni entre un Sub-Junior y un Master. Los GL points sí: es el coeficiente
// que la IPF usa justo para eso. Por eso todas las comparativas de acá van en GL
// y no en kilos.
//
// Solo entran los resultados que traen GL. Un resultado sin GL no es un cero: es
// un dato que no tenemos, y meterlo como cero hundiría los promedios.
// ═══════════════════════════════════════════
const GL_ORDEN_DIV=['Sub-Junior','Junior','Open','Master I','Master II','Master III','Master IV','Universitario'];
// ═══════════════════════════════════════════
// RANKING DE GL SIN REPETIR ATLETA
//
// La pregunta de siempre: "¿cuántos hay en Open con 80 GL o más, y quiénes
// son?". El ranking corriente no sirve para eso porque el que corrió tres veces
// aparece tres veces, y contar filas da un número inflado.
//
// Acá cada atleta sale UNA vez, con su mejor marca del período elegido. El
// período, la división, la modalidad y todo lo demás salen de los filtros de
// arriba; el mínimo de GL se pone acá al lado.
// ═══════════════════════════════════════════
const GL_RANK_TOPE=300;
let _glc={};
let _sc={};
// ══════════════════════════════════════════════════════════════════
// NÓMINA SUDAMERICANO 2026 — editor
// La nómina la manda FESUPO en un Excel y vive en un archivo estático
// (nomina_sudamericano.json), no en `inscripciones`. Cuando llega un dato mal
// (categoría equivocada, división, modalidad, alguien que se bajó), en vez de
// regenerar el archivo se guarda una CORRECCIÓN en Firestore
// (nomina_suda_edits/main → items) y yourlift.cl la aplica encima del archivo.
// Así el archivo original sigue siendo el espejo fiel de lo que mandó FESUPO.
// Clave de cada inscripción: slug(nombre)~slug(lista original) — verificado
// único para las 633. Es la MISMA que usa index.html.
// ══════════════════════════════════════════════════════════════════
const NS_EV='__nomina_sudamericano__';
let _nsQT=null;
// ── Orden de prioridad cuando hay menos cupos que inscritos ──────────────────
// Es el reglamento, no un cálculo: va como recordatorio para la comisión técnica
// y NO dice en qué punto cae cada atleta. Eso lo resuelve la comisión mirando el
// caso; el sistema no tiene cómo saber, por ejemplo, si alguien quiere bajar de
// categoría o de qué organización viene.
// Si el reglamento cambia, se edita acá y cambia en todas partes.
// Texto LITERAL del Anexo 3 del Compendio de Normas de Clasificación FECHIPO
// 2026. Se copia tal cual a propósito: es normativa, y una paráfrasis por bien
// intencionada que sea puede cambiarle el sentido a un punto. Ya pasó — el punto
// 2 estaba escrito al revés ("se consideran" en vez de "no considera"), que es
// justo el error capaz de dejar entrar a quien no correspondía.
const PRIORIDAD_CUPOS=[
  'Atletas debutantes sin registro de participación de ninguna organización diferente a la IPF y reconocidas por la WADA como federación firmante.',
  'Atletas que ya han competido pero que no tienen registro en el actual circuito competitivo (ranking). Este punto no considera a los atletas que compitieron y fueron descalificados en alguna competencia durante el año.',
  'Atletas debutantes que han cumplido su período de restricción de participación según el Anexo 2, por ingreso desde organización de Powerlifting o fuera del reconocimiento de la WADA.',
  'Atletas que durante el año compitieron y fueron descalificados en modalidad powerlifting u only bench classic o equipado según corresponda.',
  'Atletas cuyo último registro competitivo fue el Campeonato Nacional (hasta el Segundo lugar).',
  'Atletas campeones de su categoría en el último Campeonato Nacional.',
  'Atletas cuyo último registro competitivo fue en un evento internacional y competirán en la misma categoría de peso.',
  'Atletas que compitieron y desean bajar de categoría de peso corporal respecto a la de su última competencia en Campeonato nacional o internacional.',
  'Atletas que compitieron y desean subir de categoría de peso corporal respecto a la de su última competencia en Campeonato nacional o internacional, pero sin convalidar el total registrado a una nueva categoría de peso corporal.',
];
const PRIORIDAD_NOTA='De lo anterior en el punto 7, 8 y 9, quedará a criterio de la Comisión Técnica y del organizador del evento deportivo, considerando la disposición de cupos totales para el evento, volumen de inscritos según prioridad y factibilidad de tiempo/costos.';
// Los cupos son la razón por la que existe la priorización, así que van al lado.
const PRIORIDAD_CUPOS_TOPE='Máximo por torneo: 65 atletas de Powerlifting / Powerlifting+Only Bench por día, en dos grupos AM/PM de 32 a 33, con un máximo de 14 por tanda · 6 a 10 de Only Bench por día, en la tanda de banca de su categoría · 71 en total, que puede variar hasta un 15% según el cronograma que la organización presente a la Comisión Técnica.';
// ── Agregar una inscripción a mano ───────────────────────────────────────
//
// Las inscripciones entran por el formulario público, y hasta acá no había forma
// de crear una desde el panel. Hace falta: un atleta puede estar en la nómina de
// FESUPO y no haberse inscrito nunca en el sitio —le pasó a Carolina Andrea Ramos
// Donoso, que compite el día 3 del Sudamericano—, y entonces aparece en la nómina
// pública y en el livecast pero no en las listas de inscritos, que es de donde
// salen la acreditación y el control de cupos.
//
// El atleta se elige del PADRÓN, no se escribe a mano: así el RUT, el código y el
// club salen de una sola fuente y la inscripción queda cruzable con su ficha.
let _insWork=null;
// ═══════════════════════════════════════════
// CRONOGRAMA EDITABLE (start list por campeonato, en vivo) — Fase 1
// ═══════════════════════════════════════════
// Una sola tarima: flights son letras simples (A, B, C...), AM/PM es un campo
// aparte y opcional (columna Jornada), no va pegado al código del flight.
// De la A a la Z: un Regional con tres tandas en la mañana, dos en la tarde y dos
// al día siguiente ya pasaba de la H.
const CRONO_FLIGHTS=Array.from({length:26},(_,i)=>String.fromCharCode(65+i));
// Orden de los días. Se escriben a mano ("Día 1", "Sábado 8", "8 de agosto"…),
// así que se ordena por el primer número que aparezca y, si no hay, alfabético.
// Los que todavía no tienen día quedan al final.
// Orden de los días del cronograma. El día se escribe a mano ("Día 1", "Sábado 8",
// "sábado"…), así que hay que entender las tres formas. Con el nombre del día suelto
// el orden alfabético dejaba el domingo ANTES del sábado, que es justo al revés de
// como se corre un fin de semana.
const _DIAS_SEMANA=YLDias.SEMANA;
// ── El entrenador de cada atleta, según lo que declararon ellos mismos ──
//
// La columna Entrenador del cronograma se escribía a mano, fila por fila, y es
// justo el dato que el entrenador ya declaró al inscribirse: dijo a qué atletas
// lleva. Acá se cruza por RUT.
//
// Solo cuentan las inscripciones de entrenador APROBADAS. Una pendiente todavía
// la está revisando la organización, y dejarla escribir el cronograma sería
// darle por buena antes de tiempo.
const _rutN=r=>String(r||'').replace(/[^0-9kK]/g,'').toUpperCase();
// ═══════════════════════════════════════════
// COMPETENCIAS PASADAS — actas para descargar desde yourlift.cl
// ═══════════════════════════════════════════
// El acta se genera en el livecast (PDF o Excel) y se baja al computador. Acá se
// sube y queda publicada en la sección "Competencias pasadas" del sitio, para que
// cualquiera la descargue sin tener que pedirla.
//
// Se guarda el archivo en Storage (actas/{evento}/…) y la ficha en Firestore
// (competencias_pasadas/{evento}), con la lista de documentos de ese campeonato.
// Un campeonato puede tener varios: acta oficial, acta en Excel, resultados por
// tanda, lo que haga falta.
const CP_TIPOS='.pdf,.xlsx,.xls,.csv';
const CP_MAX_MB=20;
let _searchTimer=null;
render();
// ═══════════════════════════════════════════════════════════
// CAMPEONATOS — CRUD COMPLETO
// ═══════════════════════════════════════════════════════════

const STATUS_LABELS = {open:'Inscripciones abiertas', closed:'Nómina cerrada', draft:'Borrador', archived:'Archivado'};
const STATUS_COLORS = {open:'var(--green)', closed:'var(--accent)', draft:'var(--gold)', archived:'var(--muted)'};
// ─── Catálogo de tipos de documento (espejo de inscripcion.html) ───
window.DOC_TYPES_CATALOG = {
  carnetIdFront: { label: 'Carnet de Identidad (frente)', icon: '', desc: 'Cara frontal del carnet' },
  carnetIdReverso:{ label: 'Carnet de Identidad (reverso)', icon: '', desc: 'Cara trasera del carnet' },
  fotoBlanco:    { label: 'Foto fondo blanco',  icon: '', desc: 'Tipo carnet, sin accesorios' },
  pasaporte:     { label: 'Pasaporte',          icon: '', desc: 'Página de datos' },
  wadaIntl:      { label: 'ADEL/WADA Internacional', icon: '', desc: 'Vigente' },
  ipfConsent:    { label: 'Consentimiento IPF', icon: '', desc: 'Firmado · PDF descargable' },
  menorConsent:  { label: 'Consentimiento Menor', icon: '', desc: 'Tutor firma · PDF descargable' },
  notas:         { label: 'Concentración de Notas', icon: '', desc: 'Certificado académico' }
};
// Los antecedentes de Olimpiadas Especiales. No se marcan por campeonato: el
// formulario se los pide solo a quien elige esa modalidad, en toda fecha. Están
// acá para que la revisión y el ZIP de documentos los muestren con su nombre y
// no con la clave cruda, y para poder avisarlo en la lista de más abajo.
window.DOCS_OE_ATLETA = {
  // porDefecto:false → apagado salvo que el campeonato lo active (ver inscripcion/arranque.js).
  x_oe_ficha:       { label: 'Ficha médica · Olimpiadas Especiales', icon: '', desc: 'Formulario de OE, completado y firmado', porDefecto: false },
  x_oe_exoneracion: { label: 'Exoneración · Olimpiadas Especiales', icon: '', desc: 'Atleta y compañeros unificados · uso de imagen' },
  x_oe_di:          { label: 'Certificado de DI o acreditación', icon: '', desc: 'Discapacidad intelectual o documento de acreditación' }
};
// Y los cinco del entrenador que declara a un atleta de Olimpiadas Especiales.
window.DOCS_OE_ENTRENADOR = {
  e_oe_salvaguarda: { label: 'Certificado Entrenamiento de Operación Salvaguarda', icon: '', desc: 'Certificado del curso' },
  e_oe_lvl1:        { label: 'Certificado Curso Coaching – Level 1 Sport Assistant', icon: '', desc: 'Certificado del curso' },
  e_oe_lvl2:        { label: 'Certificado Curso Coaching – Level 2 Coaching Assistant', icon: '', desc: 'Certificado del curso' },
  e_oe_lvl3:        { label: 'Certificado Curso Coaching – Level 3 Coach Online Module', icon: '', desc: 'Certificado del curso' },
  e_oe_unified:     { label: 'Certificado Curso Coaching – Unified Sports Coaching Course', icon: '', desc: 'Certificado del curso' }
};
Object.assign(window.DOC_TYPES_CATALOG, window.DOCS_OE_ATLETA, window.DOCS_OE_ENTRENADOR);
// Las modalidades y divisiones de la federación (espejo de inscripcion.html).
// Sirven para elegir a quién se le pide cada documento.
window.MODALIDADES_BASE = ['Powerlifting Classic','Only Bench Classic',
  'Powerlifting Classic + Only Bench Classic','Powerlifting Equipado','Only Bench Equipado',
  'Powerlifting Equipado + Only Bench Equipado','Olimpiadas Especiales','Powerlifting Universitario'];
window.DIVISIONES_BASE = ['Sub-Junior','Junior','Open','Master I','Master II','Master III','Master IV','Universitario'];
// A quién se le pide cada documento: {docKey:{mods:[],divs:[]}}. Vacío = a todos.
window._efDocsCond = {};
// ── Documentos propios de un campeonato ────────────────────────────────────
//
// El catálogo fijo —carnet, pasaporte, WADA, los consentimientos— cubre lo que
// pide la federación. Pero cada organización tiene lo suyo: Olimpiadas
// Especiales trae antecedentes que no están en esa lista, y esperar a que
// alguien toque el código para abrir una inscripción no sirve.
//
// Acá se agregan a mano: nombre, descripción, el PDF que el atleta descarga y,
// si el documento se saca en otra página, el link. Se guardan en el propio
// campeonato y el formulario de inscripción los dibuja como uno más.
//
// La CLAVE se genera una vez y no se vuelve a tocar: es la que queda escrita en
// la inscripción del atleta y en la ruta de su archivo. Si cambiara al renombrar
// el documento, los que ya se inscribieron quedarían apuntando a una clave que
// no existe.
// Hay DOS listas de documentos propios: los del atleta y los del entrenador.
// Son lo mismo por dentro, así que el editor es uno solo y recibe de cuál se
// trata: 'x' para el atleta, 'e' para el entrenador. Duplicarlo habría sido
// garantía de arreglar un lado y olvidar el otro.
window._efDocsX = [];
   // documentos propios que se le piden al ATLETA
window._efDocsE = [];
   // documentos del FORMULARIO de entrenador que se esté editando
const DOCED = {
  x: {cont:'ef_docsx', pref:'x_', lista:()=>window._efDocsX, quien:'el atleta'},
  e: {cont:'fe_docs', pref:'e_', lista:()=>window._efDocsE, quien:'el entrenador'}
};
// ═══════════════════════════════════════════════════════════
// GESTIÓN DE ADMINISTRADORES
// ═══════════════════════════════════════════════════════════

let _adminsList = [];
const _histSlug=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,40);
// ═══════════════════════════════════════════════════════════
// MEDALLERO — qué medallas hay que preparar para una nómina
//
// Se arma sobre la NÓMINA, no sobre resultados: sirve para encargar y grabar las
// medallas antes del campeonato. Por eso dice cuántas van y a qué podio
// corresponde cada una, y no quién se las lleva — eso no se puede saber todavía.
//
// Los overall van como CUPO, por el mismo motivo: el overall se ordena por GL
// points y el GL necesita el peso corporal, que recién existe después del
// pesaje. Los ganadores de verdad salen de livecast, que sí tiene los pesos y
// los resultados.
// ═══════════════════════════════════════════════════════════
const MED_PRESETS={
  total:   {n:'Podio de total',            movs:false, ovr:false, d:'Solo el podio de total de cada división y categoría.'},
  totalOvr:{n:'Podio de total + overall',  movs:false, ovr:true,  d:'Lo anterior, más un podio overall por cada división.'},
  full:    {n:'Detalle completo',          movs:true,  ovr:false, d:'Total, sentadilla, press de banca y peso muerto en cada categoría.'},
  fullOvr: {n:'Detalle completo + overall',movs:true,  ovr:true,  d:'Todo lo anterior, más los overall que elijas.'}
};
const MED_DIVORD={'Sub-Junior':0,'Subjunior':0,'Junior':1,'Universitario':2,'Open':3,
  'Master I':4,'Master II':5,'Master III':6,'Master IV':7,'Special Olympics':8};
const MED_MOVN={total:'Total',sq:'Sentadilla',bp:'Press de banca',dl:'Peso muerto'};
const MED_PUESTO=['Primer Lugar','Segundo Lugar','Tercer Lugar'];
// Cómo se nombra la modalidad EN LA MEDALLA. En la nómina viene abreviada
// —"Clásico", "Only Bench Equipado"— y grabado así no se entiende: la medalla la
// lee alguien que no conoce el sistema. Si el grabador la quiere de otra forma,
// se cambia acá y cambia en todo el documento.
const MED_MODGRAB={
  'Clásico':'Powerlifting Classic',
  'Equipado':'Powerlifting Equipado',
  'Only Bench Clásico':'Press Banca Classic',
  'Only Bench Equipado':'Press Banca Equipado',
  'Universitario':'Powerlifting Universitario',
  'Olimpiadas Especiales':'Olimpiadas Especiales'
};
const _medModGrab=m=>MED_MODGRAB[m]||m;
const _medBanca=m=>/only bench|banca/i.test(String(m||''));
const _medSexo=s=>/^(f|muj|dam)/i.test(String(s||''))?'F':'M';
const _medCatN=c=>{const s=String(c||'');const n=parseFloat(s.replace(/[^0-9.]/g,''))||999;return n+(s.indexOf('+')>=0?.5:0);};
// ═══════════════════════════════════════════════════════════
// MERGE RESULTADOS — Procesar competencia → data.json + records.json
// ═══════════════════════════════════════════════════════════

// IPF GL coefficients (same as livecast)
// Coeficientes oficiales IPF GL. La tabla anterior estaba CORRIDA: lo que
// figuraba como classic eran los valores de equipado, y las demás series no
// correspondían a ninguna oficial. Daba entre 13 y 39 puntos de menos según el
// caso, en ranking, perfiles y resultados guardados.
// Son los mismos ocho juegos que ya usaban livecast.html e index.html.
// Mismo formato de siempre ([a,b,c] por clave del panel), tomado de la tabla
// única de compartido/gl.js.
const _GL_COEFS = (()=>{const C=window.YLGL.COEF,t=k=>[C[k].a,C[k].b,C[k].c];
  return {'cl_M':t('pl_m'),'cl_F':t('pl_f'),'eq_M':t('ple_m'),'eq_F':t('ple_f'),
          'bench_cl_M':t('bo_m'),'bench_cl_F':t('bo_f'),'bench_eq_M':t('boe_m'),'bench_eq_F':t('boe_f')};})();
let RECORDS_DATA={"classic":{"sq":[{"nombre":"Valentina Marin Puelles","division":"Open","categoria":"47","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":133.0},{"nombre":"Antonella Pérez","division":"Sub-Junior","categoria":"47","campeonato":"IX FESUPO Cameponato Sudamericano 2022","marca":103.0},{"nombre":"Francisca Molina Briones","division":"Junior","categoria":"47","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":105.0},{"nombre":"Keily Rojas Peraza","division":"Junior","categoria":"52","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":125.0},{"nombre":"Valeria Quiroz Valenzuela","division":"Open","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":145.0},{"nombre":"Sofia Olave Vega","division":"Sub-Junior","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":112.5},{"nombre":"Alfredo Cortes Piñones","division":"Junior","categoria":"53","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":135.5},{"nombre":"Lucas Vidal Calisto","division":"Sub-Junior","categoria":"53","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2018","marca":85.0},{"nombre":"Josefa Soto Arcos","division":"Junior","categoria":"57","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":170.5},{"nombre":"Josefa Soto Arcos","division":"Open","categoria":"57","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":170.5},{"nombre":"Josefa Ignacia Soto Arcos","division":"Sub-Junior","categoria":"57","campeonato":"IX FESUPO Cameponato Sudamericano 2022","marca":122.5},{"nombre":"Fabiola Alejandra Aldana Obreque","division":"Master I","categoria":"57","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":100.0},{"nombre":"Felix Soto Monares","division":"Junior","categoria":"59","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":190.0},{"nombre":"Valentín Froilán Endo Domínguez","division":"Open","categoria":"59","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":183.0},{"nombre":"Martín Gangas Pavez","division":"Sub-Junior","categoria":"59","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":160.0},{"nombre":"Yassmin Arias Navarrete","division":"Open","categoria":"63","campeonato":"XI Campeonato Sudamericano de Powerlifting 2024","marca":183.5},{"nombre":"Rocio Ramírez Martínez","division":"Junior","categoria":"63","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":158.0},{"nombre":"Francisca Nuñez Pastore","division":"Sub-Junior","categoria":"63","campeonato":"XI Campeonato Sudamericaco de Powerlifting Classic 2024","marca":132.5},{"nombre":"Nataly Martínez Rosas","division":"Master I","categoria":"63","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":155.0},{"nombre":"Lukas Valdés Palazuelos","division":"Junior","categoria":"66","campeonato":"XII Campeonato Sudamericano 2025","marca":222.5},{"nombre":"José Merino Herrera","division":"Open","categoria":"66","campeonato":"Juegos Bolivarianos del Bicentenario Ayacucho 2024","marca":230.0},{"nombre":"Joaquín Cocio Loaiza","division":"Sub-Junior","categoria":"66","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":208.5},{"nombre":"Cristobal Mena Aballay","division":"Master I","categoria":"66","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":165.0},{"nombre":"Cristaleen Castillo Sepúlveda","division":"Junior","categoria":"69","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":175.0},{"nombre":"Cristaleen Castillo Sepúlveda","division":"Open","categoria":"69","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":175.0},{"nombre":"Constanza Araya Valdés","division":"Sub-Junior","categoria":"69","campeonato":"Campeonato Sudamericano de Powerlifting Classic 2023","marca":135.0},{"nombre":"Gloria Vera Tapia","division":"Master I","categoria":"69","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":157.5},{"nombre":"Sicely Valetto","division":"Junior","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":122.5},{"nombre":"Paulina Contreras Cuevas","division":"Open","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":122.5},{"nombre":"Francisca Perez Nadeau","division":"Sub-Junior","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":95.0},{"nombre":"Hernán Elías Gómez Rivera","division":"Junior","categoria":"74","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":250.0},{"nombre":"Pablo Perez Anderson","division":"Open","categoria":"74","campeonato":"X Campeonato Sudamericano de Powerlifting Classic 2023","marca":260.0},{"nombre":"Sebastian Villa Alvarez","division":"Sub-Junior","categoria":"74","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":226.0},{"nombre":"Andrea Santana Navarrete","division":"Open","categoria":"76","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":177.5},{"nombre":"Josefa Isabella Basáez Lagos","division":"Junior","categoria":"76","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":170.0},{"nombre":"Bárbara Valenzuela Muñoz","division":"Master I","categoria":"76","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":157.5},{"nombre":"Bárbara Muñoz Inzunza","division":"Sub-Junior","categoria":"76","campeonato":"XII Campeonato Sudamericano 2025","marca":170.0},{"nombre":"Francia Rivero Hurtado","division":"Master II","categoria":"76","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":125.5},{"nombre":"José Matías Figueroa Contreras","division":"Open","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":300.0},{"nombre":"Jose Manuel Garrido Salazar","division":"Junior","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":260.5},{"nombre":"Martin Gamboa Contreras","division":"Sub-Junior","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":255.0},{"nombre":"Arnaldo Salinas Sepúlveda","division":"Master I","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":230.0},{"nombre":"Juan Carlos Contreras Vega","division":"Master II","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":183.0},{"nombre":"Romy Echeverría Ortega","division":"Junior","categoria":"84","campeonato":"XII Campeonato Sudamericano 2025","marca":170.0},{"nombre":"Paula Castro Muñoz","division":"Open","categoria":"84","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":185.0},{"nombre":"Martina Ahumada","division":"Sub-Junior","categoria":"84","campeonato":"VI Campeonato Nacional Fechipo 2022","marca":95.0},{"nombre":"Francia Rivero Hurtado","division":"Master I","categoria":"84","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":135.5},{"nombre":"Francia Rivero Hurtado","division":"Master II","categoria":"84","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":135.5},{"nombre":"Benjamín Osses Contreras","division":"Junior","categoria":"93","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":275.0},{"nombre":"Oscar Celis","division":"Master I","categoria":"93","campeonato":"VI Campeonato Nacional Fechipo 2022","marca":230.0},{"nombre":"Benjamin Osses Contreras","division":"Open","categoria":"93","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":285.0},{"nombre":"Alonzo Parraguez Rivas","division":"Sub-Junior","categoria":"93","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":235.0},{"nombre":"Ricardo Carrillo Castro","division":"Master II","categoria":"93","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":157.5},{"nombre":"Bastian Arevalo Peña","division":"Junior","categoria":"105","campeonato":"XII Campeonato Sudamericano 2025","marca":305.0},{"nombre":"Moisés Contreras","division":"Master II","categoria":"105","campeonato":"Campeonato Panamericano de Powerlifting Classic 2019","marca":245.0},{"nombre":"Bernardo Ibañez Pawathon","division":"Open","categoria":"105","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":315.0},{"nombre":"Nicolás Figueroa","division":"Sub-Junior","categoria":"105","campeonato":"Campeonato Zona Centro SBC 2019","marca":230.0},{"nombre":"Moisés Contreras","division":"Master I","categoria":"105","campeonato":"Campeonato Panamericano de Powerlifting Classic 2019","marca":245.0},{"nombre":"Jesús Navarrete Saavedra","division":"Junior","categoria":"120","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":310.0},{"nombre":"Manuel Alejandro Fuentes","division":"Master I","categoria":"120","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":250.0},{"nombre":"Hector Vasquez Ramirez","division":"Open","categoria":"120","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":320.0},{"nombre":"Álvaro Nicanor Araya Peñaloza","division":"Sub-Junior","categoria":"120","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":215.5},{"nombre":"Sergio Mardones Meza","division":"Open","categoria":"120+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":375.0},{"nombre":"Benjamín Meza Aguilar","division":"Junior","categoria":"120+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":300.0},{"nombre":"Francisco Martínez Soto","division":"Sub-Junior","categoria":"120+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":165.0},{"nombre":"Ricardo Guzmán","division":"Master I","categoria":"120+","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":260.0},{"nombre":"Marcela De La Barra Zelaya","division":"Open","categoria":"84+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":190.5},{"nombre":"Stefania Sandoval Carrillo","division":"Junior","categoria":"84+","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":150.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master I","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":95.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master II","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":95.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master III","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":95.0}],"bp":[{"nombre":"Valentina Marín Puelles","division":"Open","categoria":"47","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":66.0},{"nombre":"Francisca Molina Briones","division":"Junior","categoria":"47","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":65.0},{"nombre":"Sofía Olave Vega","division":"Sub Junior","categoria":"47","campeonato":"XII Campeonato Sudamericano 2025","marca":55.0},{"nombre":"Francisca Yañez Salgado","division":"Open","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":70.0},{"nombre":"Francisca Yañez Salgado","division":"Junior","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":70.0},{"nombre":"Sofia Olave Vega","division":"Sub-Junior","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":65.0},{"nombre":"Alfredo Cortes Piñones","division":"Junior","categoria":"53","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":90.5},{"nombre":"Lucas Vidal Calisto","division":"Sub-Junior","categoria":"53","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2018","marca":50.0},{"nombre":"María Paz Sáez Soto","division":"Junior","categoria":"57","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":92.5},{"nombre":"María Paz Sáez Soto","division":"Junior","categoria":"57","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":92.5},{"nombre":"Josefa Soto","division":"Sub-Junior","categoria":"57","campeonato":"IX FESUPO Cameponato Sudamericano 2022","marca":66.0},{"nombre":"Fabiola Alejandra Aldana Obreque","division":"Master I","categoria":"57","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":53.0},{"nombre":"Valentin Endo","division":"Open","categoria":"59","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":120.0},{"nombre":"Martín Gangas Pavez","division":"Junior","categoria":"59","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":120.0},{"nombre":"Martín Gangas Pavez","division":"Sub-Junior","categoria":"59","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":120.0},{"nombre":"Yasmin Arias Navarrete","division":"Open","categoria":"63","campeonato":"XII Campeonato Sudamericano 2025","marca":95.0},{"nombre":"Angela Vega Plaza","division":"Junior","categoria":"63","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":92.5},{"nombre":"Leticia Oviedo Castro","division":"Sub-Junior","categoria":"63","campeonato":"Sudamericano de Powerlifting Classic 2017","marca":80.0},{"nombre":"Nataly Martínez Rosas","division":"Master I","categoria":"63","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":65.0},{"nombre":"Joaquín Arce Pinilla","division":"Junior","categoria":"66","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":145.5},{"nombre":"Joaquín Arce Pinilla","division":"Open","categoria":"66","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":145.5},{"nombre":"Cristobal Muñoz Droguett","division":"Sub Junior","categoria":"66","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":115.0},{"nombre":"Cristobal Mena Aballay","division":"Master I","categoria":"66","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":130.0},{"nombre":"Antonia Madrid Toro","division":"Open","categoria":"69","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":96.5},{"nombre":"May-ling Gallardo Pivet","division":"Junior","categoria":"69","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":93.0},{"nombre":"Ema Gallardo Haverbeck","division":"Sub-Junior","categoria":"69","campeonato":"XI Campeonato Sudamericaco de Powerlifting Classic 2024","marca":84.0},{"nombre":"Gloria Vera Tapia","division":"Master I","categoria":"69","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":68.0},{"nombre":"Jeniffer Fre","division":"Open","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":77.5},{"nombre":"Sicely Valetto","division":"Junior","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":52.5},{"nombre":"Francisca Perez Nadeau","division":"Sub-Junior","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":50.0},{"nombre":"Anderson Perez Pablo Roberto","division":"Open","categoria":"74","campeonato":"IPF World Men's Classic Open Powerlifting Championships 2024","marca":175.0},{"nombre":"David Sanchez","division":"Junior","categoria":"74","campeonato":"VI Campeonato Nacional Fechipo 2022","marca":161.0},{"nombre":"Martín Aguilera Perez","division":"Sub Junior","categoria":"74","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":138.5},{"nombre":"Guillermo Cisternas Aguilar","division":"Master I","categoria":"74","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":120.0},{"nombre":"Andrea Santana Navarrete","division":"Open","categoria":"76","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":97.5},{"nombre":"Javiera Orellana","division":"Junior","categoria":"76","campeonato":"II Campeonato Oficial Zona Centro 2022","marca":90.0},{"nombre":"Bárbara Muñoz Inzunza","division":"Sub Junior","categoria":"76","campeonato":"XII Campeonato Sudamericano 2025","marca":90.0},{"nombre":"Bárbara Valenzuela Muñoz","division":"Master I","categoria":"76","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":80.5},{"nombre":"Francia Rivero Hurtado","division":"Master II","categoria":"76","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":60.0},{"nombre":"José Matías Figueroa Contreras","division":"Open","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":200.5},{"nombre":"Jose Manuel Garrido Salazar","division":"Junior","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":176.0},{"nombre":"Arturo Godoy Cerda","division":"Sub-Junior","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":144.0},{"nombre":"Luis Alarcón Ramírez","division":"Master I","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":140.0},{"nombre":"Juan Carlos Contreras Vega","division":"Master II","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":113.0},{"nombre":"Paula Castro Muñoz","division":"Open","categoria":"84","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":100.5},{"nombre":"Andrea Fabregas Schliewe","division":"Junior","categoria":"84","campeonato":"VIII Campeonato Nacional FECHIPO 2024","marca":82.5},{"nombre":"Francia Rivero Hurtado","division":"Master I","categoria":"84","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":78.0},{"nombre":"Francia Rivero Hurtado","division":"Master II","categoria":"84","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":78.0},{"nombre":"Martina Ahumada","division":"Sub-Junior","categoria":"84","campeonato":"VI Campeonato Nacional Fechipo 2022","marca":60.0},{"nombre":"Bernardo Joaquín Ibañez Pawalthon","division":"Open","categoria":"93","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":186.0},{"nombre":"Benjamín Osses Contreras","division":"Junior","categoria":"93","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":175.0},{"nombre":"German Quintanilla","division":"Sub-Junior","categoria":"93","campeonato":"X Campeonato Sudamericano de Powerlifting Classic 2023","marca":145.0},{"nombre":"Gustavo Tapia Hidalgo","division":"Master I","categoria":"93","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":133.0},{"nombre":"Ricardo Carrillo Castro","division":"Master II","categoria":"93","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":92.5},{"nombre":"Yohan Perez Coñiñir","division":"Open","categoria":"105","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":200.5},{"nombre":"Yohan Perez Coñiñir","division":"Junior","categoria":"105","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":200.5},{"nombre":"Moisés Contreras","division":"Master I","categoria":"105","campeonato":"Campeonato Panamericano de Powerlifting Classic 2019","marca":135.0},{"nombre":"Moisés Contreras","division":"Master II","categoria":"105","campeonato":"Campeonato Panamericano de Powerlifting Classic 2019","marca":135.0},{"nombre":"Nicolás Figueroa","division":"Sub-Junior","categoria":"105","campeonato":"Campeonato Zona Centro SBC 2019","marca":120.0},{"nombre":"Manuel Alejandro Fuentes","division":"Open","categoria":"120","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":205.5},{"nombre":"Manuel Alejandro Fuentes","division":"Master I","categoria":"120","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":205.5},{"nombre":"Jesús Navarrete Saavedra","division":"Junior","categoria":"120","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":184.0},{"nombre":"Benjamin Ramirez","division":"Sub-Junior","categoria":"120","campeonato":"IX Campeonato Sudamericano FESUPO 2022","marca":137.5},{"nombre":"Sergio Mardones Meza","division":"Open","categoria":"120+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":225.0},{"nombre":"Ricardo Guzman Alvarado","division":"Master I","categoria":"120+","campeonato":"VIII Campeonato Nacional FECHIPO 2024","marca":180.0},{"nombre":"Benjamin Meza Aguilar","division":"Junior","categoria":"120+","campeonato":"XII Campeonato Sudamericano 2025","marca":150.0},{"nombre":"Francisco Martínez Soto","division":"Sub-Junior","categoria":"120+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":100.0},{"nombre":"Marcela De La Barra Zelaya","division":"Open","categoria":"84+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":101.0},{"nombre":"Stefania Sandoval Carrillo","division":"Junior","categoria":"84+","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":70.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master I","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":65.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master II","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":65.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master III","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":65.0}],"dl":[{"nombre":"Valentina Marin Puelles","division":"Open","categoria":"47","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":150.0},{"nombre":"Francisca Molina Briones","division":"Junior","categoria":"47","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":145.0},{"nombre":"Sofía Olave Vega","division":"Sub-Junior","categoria":"47","campeonato":"XII Campeonato Sudamericano 2025","marca":135.0},{"nombre":"Keily Rojas Peraza","division":"Junior","categoria":"52","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":155.0},{"nombre":"Criss Contreras Calderón","division":"Open","categoria":"52","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":155.0},{"nombre":"Sofia Olave Vega","division":"Sub-Junior","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":145.0},{"nombre":"Lucas Vidal Calisto","division":"Sub-Junior","categoria":"53","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2018","marca":120.0},{"nombre":"Alfredo Cortes Piñones","division":"Junior","categoria":"53","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":173.0},{"nombre":"Tais Gomez Sanzana","division":"Open","categoria":"57","campeonato":"XII Campeonato Sudamericano 2025","marca":197.5},{"nombre":"María Paz Sáez Soto","division":"Junior","categoria":"57","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":190.0},{"nombre":"Antonia Moraga Muñoz","division":"Sub-Junior","categoria":"57","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":144.0},{"nombre":"Fabiola Alejandra Aldana Obreque","division":"Master I","categoria":"57","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":142.0},{"nombre":"Felix Soto Monares","division":"Open","categoria":"59","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":240.0},{"nombre":"Felix Soto Monares","division":"Junior","categoria":"59","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":240.0},{"nombre":"Martín Gangas Pavez","division":"Sub-Junior","categoria":"59","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":235.0},{"nombre":"Angela Vega Plaza","division":"Open","categoria":"63","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":185.0},{"nombre":"Angela Vega Plaza","division":"Junior","categoria":"63","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":185.0},{"nombre":"Montserrat Vera Arrano","division":"Sub-Junior","categoria":"63","campeonato":"XII Campeonato Sudamericano 2025","marca":170.0},{"nombre":"Nataly Martínez Rosas","division":"Master I","categoria":"63","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":160.0},{"nombre":"Diego Duran Araya","division":"Open","categoria":"66","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":260.5},{"nombre":"Maximiliano Chamorro Arenas","division":"Junior","categoria":"66","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":250.5},{"nombre":"Felipe Sotomayor Sanhueza","division":"Sub-Junior","categoria":"66","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":237.5},{"nombre":"Cristobal Mena Aballay","division":"Master I","categoria":"66","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":205.0},{"nombre":"Antonia Madrid Toro","division":"Junior","categoria":"69","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":187.5},{"nombre":"Paola Fuentes Ulloa","division":"Open","categoria":"69","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":202.5},{"nombre":"Ema Gallardo Haverbeck","division":"Sub-Junior","categoria":"69","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":160.0},{"nombre":"Gloria Vera Tapia","division":"Master I","categoria":"69","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":160.0},{"nombre":"Paulina Contreras Cuevas","division":"Open","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":150.0},{"nombre":"Sicely Valetto","division":"Junior","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":132.5},{"nombre":"Francisca Perez Nadeau","division":"Sub-Junior","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":95.0},{"nombre":"Felipe Rieutord Lira","division":"Open","categoria":"74","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":315.0},{"nombre":"Felipe Rieutord Lira","division":"Junior","categoria":"74","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":315.0},{"nombre":"Felipe Rieutord Lira","division":"Sub-Junior","categoria":"74","campeonato":"Campeonato Panamericano de Powerlifting Classic 2019","marca":261.5},{"nombre":"Guillermo Cisternas Aguilar","division":"Master I","categoria":"74","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":200.0},{"nombre":"Javiera Orellana","division":"Open","categoria":"76","campeonato":"IX FESUPO Cameponato Sudamericano 2022","marca":205.0},{"nombre":"Javiera Orellana","division":"Junior","categoria":"76","campeonato":"IX FESUPO Cameponato Sudamericano 2022","marca":205.0},{"nombre":"Bárbara Muñoz Inzunza","division":"Sub-Junior","categoria":"76","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":183.0},{"nombre":"Francia Rivero Hurtado","division":"Master II","categoria":"76","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":142.0},{"nombre":"Bárbara Valenzuela Muñoz","division":"Master I","categoria":"76","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":170.5},{"nombre":"Pablo Anderson","division":"Open","categoria":"83","campeonato":"Juegos Bolivarianos del Bicentenario Ayacucho 2024","marca":320.0},{"nombre":"Jose Manuel Garrido Salazar","division":"Junior","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":300.0},{"nombre":"Vicente Palacios Passicot","division":"Sub-Junior","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":260.0},{"nombre":"Arnaldo Salinas Sepúlveda","division":"Master I","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":245.0},{"nombre":"Juan Carlos Contreras Vega","division":"Master II","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":206.0},{"nombre":"Paula Castro Muñoz","division":"Open","categoria":"84","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":200.0},{"nombre":"Romy Echeverría Ortega","division":"Junior","categoria":"84","campeonato":"XII Campeonato Sudamericano 2025","marca":177.5},{"nombre":"Francia Rivero Hurtado","division":"Master I","categoria":"84","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":157.5},{"nombre":"Francia Rivero Hurtado","division":"Master II","categoria":"84","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":157.5},{"nombre":"Martina Ahumada","division":"Sub-Junior","categoria":"84","campeonato":"VI Campeonato Nacional Fechipo 2022","marca":117.5},{"nombre":"Esteban Sebastian Navarro Escobar","division":"Open","categoria":"93","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":305.0},{"nombre":"Oscar Celis","division":"Master I","categoria":"93","campeonato":"VI Campeonato Nacional Fechipo 2022","marca":300.0},{"nombre":"Esteban Sebastian Navarro Escobar","division":"Junior","categoria":"93","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":305.0},{"nombre":"Cristian Farfán Aldana","division":"Sub-Junior","categoria":"93","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":275.5},{"nombre":"Ricardo Carrillo Castro","division":"Master II","categoria":"93","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":165.0},{"nombre":"Bastian Arevalo Peña","division":"Open","categoria":"105","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":335.0},{"nombre":"Bastian Arevalo Peña","division":"Junior","categoria":"105","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":335.0},{"nombre":"Mauricio Henriquez Tobar","division":"Master I","categoria":"105","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":250.5},{"nombre":"Moisés Contreras","division":"Master II","categoria":"105","campeonato":"Campeonato Panamericano de Powerlifting Classic 2019","marca":250.0},{"nombre":"Nicolás Figueroa","division":"Sub-Junior","categoria":"105","campeonato":"IV Campeonato Nacional Classic Fechipo 2019","marca":252.5},{"nombre":"Fabian Valencia Cofre","division":"Open","categoria":"120","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":325.0},{"nombre":"Lucas Ayala Medina","division":"Junior","categoria":"120","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":310.5},{"nombre":"Manuel Alejandro Fuentes","division":"Master I","categoria":"120","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":250.0},{"nombre":"Álvaro Nicanor Araya Peñaloza","division":"Sub-Junior","categoria":"120","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":230.0},{"nombre":"Jean Gutierrez Nahuelpan","division":"Open","categoria":"120+","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":295.5},{"nombre":"Ricardo Guzman Alvarado","division":"Master I","categoria":"120+","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":270.0},{"nombre":"Lucas Iñaki Ortiz Farias","division":"Sub-Junior","categoria":"120+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":180.0},{"nombre":"Benjamín Meza Aguilar","division":"Junior","categoria":"120+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":250.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master I","categoria":"84+","campeonato":"XII Campeonato Sudamericano 2025","marca":127.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master II","categoria":"84+","campeonato":"XII Campeonato Sudamericano 2025","marca":127.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master III","categoria":"84+","campeonato":"XII Campeonato Sudamericano 2025","marca":127.0},{"nombre":"Sorena González Gil","division":"Open","categoria":"84+","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":192.5},{"nombre":"Stefania Sandoval Carrillo","division":"Junior","categoria":"84+","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":142.5}],"total":[{"nombre":"Valentina Marin Puelles","division":"Open","categoria":"47","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":344.0},{"nombre":"Francisca Molina Briones","division":"Junior","categoria":"47","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":315.0},{"nombre":"Sofia Olave Vega","division":"Sub-Junior","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":322.5},{"nombre":"Keily Rojas Peraza","division":"Junior","categoria":"52","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":348.0},{"nombre":"Valeria Quiroz","division":"Open","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":360.0},{"nombre":"Sofia Olave Vega","division":"Sub-Junior","categoria":"52","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":322.5},{"nombre":"Alfredo Cortes Piñones","division":"Junior","categoria":"53","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":399.0},{"nombre":"Lucas Vidal Calisto","division":"Sub-Junior","categoria":"53","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2018","marca":255.0},{"nombre":"Javiera Contador González","division":"Open","categoria":"57","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":405.0},{"nombre":"María Paz Sáez Soto","division":"Junior","categoria":"57","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":452.5},{"nombre":"Antonia Moraga Muñoz","division":"Sub-Junior","categoria":"57","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":314.0},{"nombre":"Fabiola Alejandra Aldana Obreque","division":"Master I","categoria":"57","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":295.0},{"nombre":"Felix Soto Monares","division":"Open","categoria":"59","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":537.5},{"nombre":"Felix Soto Monares","division":"Junior","categoria":"59","campeonato":"Campeonato Mundial Junior y Sub-junior Classic 2025","marca":537.5},{"nombre":"Martín Gangas","division":"Sub-Junior","categoria":"59","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":512.5},{"nombre":"Angela Vega Plaza","division":"Junior","categoria":"63","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":435.0},{"nombre":"Yassmin Arias Navarrete","division":"Open","categoria":"63","campeonato":"XI Campeonato Sudamericano de Powerlifting 2024","marca":446.0},{"nombre":"Francisca Nuñez Pastore","division":"Sub-Junior","categoria":"63","campeonato":"XI Campeonato Sudamericaco de Powerlifting Classic 2024","marca":368.5},{"nombre":"Nataly Martínez Rosas","division":"Master I","categoria":"63","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":375.0},{"nombre":"José Merino Herrera","division":"Open","categoria":"66","campeonato":"Juegos Bolivarianos del Bicentenario Ayacucho 2024","marca":615.0},{"nombre":"Javier Cornejo Salfate","division":"Junior","categoria":"66","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":593.0},{"nombre":"Joaquín Cocio Loaiza","division":"Sub-Junior","categoria":"66","campeonato":"XII Campeonato Sudamericano 2025","marca":542.5},{"nombre":"Cristobal Mena Aballay","division":"Master I","categoria":"66","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":500.0},{"nombre":"Cristaleen Castillo Sepúlveda","division":"Junior","categoria":"69","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":447.5},{"nombre":"Paola Fuentes Ulloa","division":"Open","categoria":"69","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":455.0},{"nombre":"Ema Gallardo Haverbeck","division":"Sub-Junior","categoria":"69","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":362.5},{"nombre":"Gloria Vera Tapia","division":"Master I","categoria":"69","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":385.5},{"nombre":"Paulina Contreras Cuevas","division":"Open","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":340.0},{"nombre":"Sicely Valetto","division":"Junior","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":307.5},{"nombre":"Francisca Perez Nadeau","division":"Sub-Junior","categoria":"72","campeonato":"Campeonato Zona Centro SBC 2019","marca":240.0},{"nombre":"Anderson Perez Pablo Roberto","division":"Open","categoria":"74","campeonato":"IPF World Men's Classic Open Powerlifting Championships 2024","marca":740.0},{"nombre":"Felipe Rieutord Lira","division":"Junior","categoria":"74","campeonato":"Campeonato Sudamericano de Powerlifting Classic 2023","marca":683.5},{"nombre":"Benjamin Alvarado","division":"Sub-Junior","categoria":"74","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":572.5},{"nombre":"Guillermo Cisternas Aguilar","division":"Master I","categoria":"74","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":521.0},{"nombre":"Javiera Orellana","division":"Junior","categoria":"76","campeonato":"IX FESUPO Cameponato Sudamericano 2022","marca":452.5},{"nombre":"Emily Skogen Aguilera","division":"Open","categoria":"76","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":460.0},{"nombre":"Bárbara Muñoz Inzunza","division":"Sub-Junior","categoria":"76","campeonato":"XII Campeonato Sudamericano 2025","marca":440.5},{"nombre":"Bárbara Valenzuela Muñoz","division":"Master I","categoria":"76","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":407.0},{"nombre":"Francia Rivero Hurtado","division":"Master II","categoria":"76","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":327.5},{"nombre":"José Matías Figueroa Contreras","division":"Open","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":785.0},{"nombre":"Jose Manuel Garrido Salazar","division":"Junior","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":736.5},{"nombre":"Martin Gamboa Contreras","division":"Sub-Junior","categoria":"83","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":632.5},{"nombre":"Arnaldo Salinas Sepúlveda","division":"Master I","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":612.5},{"nombre":"Juan Carlos Contreras Vega","division":"Master II","categoria":"83","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":502.0},{"nombre":"Paula Castro Muñoz","division":"Open","categoria":"84","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":470.5},{"nombre":"Romy Echeverría Ortega","division":"Junior","categoria":"84","campeonato":"XII Campeonato Sudamericano 2025","marca":417.5},{"nombre":"Francia Rivero Hurtado","division":"Master I","categoria":"84","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":371.0},{"nombre":"Francia Rivero Hurtado","division":"Master II","categoria":"84","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":371.0},{"nombre":"Martina Ahumada","division":"Sub-Junior","categoria":"84","campeonato":"VI Campeonato Nacional Fechipo 2022","marca":272.5},{"nombre":"Bernardo Joaquín Ibañez Pawalthon","division":"Open","categoria":"93","campeonato":"VII Campeonato Nacional Fechipo 2023","marca":754.5},{"nombre":"Benjamín Osses Contreras","division":"Junior","categoria":"93","campeonato":"XII Campeonato Sudamericano 2025","marca":737.5},{"nombre":"Oscar Celis","division":"Master I","categoria":"93","campeonato":"VI Campeonato Nacional Fechipo 2022","marca":660.0},{"nombre":"German Cristobal Quintanilla Pardo","division":"Sub-Junior","categoria":"93","campeonato":"Campeonato Sudamericano de Powerlifting Classic 2023","marca":645.0},{"nombre":"Ricardo Carrillo Castro","division":"Master II","categoria":"93","campeonato":"VII Campeonato Nacional FECHIPO 2024","marca":415.0},{"nombre":"Bastian Arevalo Peña","division":"Open","categoria":"105","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":822.5},{"nombre":"Bastian Arevalo Peña","division":"Junior","categoria":"105","campeonato":"XII Campeonato Sudamericano 2025","marca":813.0},{"nombre":"Moisés Contreras","division":"Master I","categoria":"105","campeonato":"Campeonato Panamericano de Powerlifting Classic 2019","marca":630.0},{"nombre":"Moisés Contreras","division":"Master II","categoria":"105","campeonato":"Campeonato Panamericano de Powerlifting Classic 2019","marca":630.0},{"nombre":"Nicolás Figueroa","division":"Sub-Junior","categoria":"105","campeonato":"Campeonato Zona Centro SBC 2019","marca":590.0},{"nombre":"Jesús Navarrete Saavedra","division":"Open","categoria":"120","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":801.5},{"nombre":"Manuel Alejandro Fuentes","division":"Master I","categoria":"120","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":705.5},{"nombre":"Jesús Navarrete Saavedra","division":"Junior","categoria":"120","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":801.5},{"nombre":"Álvaro Nicanor Araya Peñaloza","division":"Sub-Junior","categoria":"120","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":550.5},{"nombre":"Sergio Mardones Meza","division":"Open","categoria":"120+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":860.0},{"nombre":"Ricardo Guzmán","division":"Master I","categoria":"120+","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":702.5},{"nombre":"Benjamín Meza Aguilar","division":"Junior","categoria":"120+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":690.0},{"nombre":"Francisco Martínez Soto","division":"Sub-Junior","categoria":"120+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":430.0},{"nombre":"Marcela De La Barra Zelaya","division":"Open","categoria":"84+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":471.5},{"nombre":"Florencia Mora Salas","division":"Junior","categoria":"84+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":357.5},{"nombre":"Mónica Fuentes Arredondo","division":"Master I","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":285.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master II","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":285.0},{"nombre":"Mónica Fuentes Arredondo","division":"Master III","categoria":"84+","campeonato":"IX Campeonato Nacional FECHIPO 2025","marca":285.0}]},"equipped":{"sq":[{"nombre":"Constanza Muñoz Muñoz","division":"Open","categoria":"47","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":120.0},{"nombre":"Constanza Muñoz Muñoz","division":"Junior","categoria":"47","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":120.0},{"nombre":"Alejandra Gonzalez","division":"Open","categoria":"52","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2016","marca":105.0},{"nombre":"María Luisa Carmona Rauque","division":"Open","categoria":"57","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":105.0},{"nombre":"Rocío Jesús Aghemio Nuñez","division":"Open","categoria":"63","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":142.5},{"nombre":"Francisca Javiera Altamirano Paredes","division":"Open","categoria":"84+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":112.5},{"nombre":"Jonathan Esteban Vargas Filun","division":"Open","categoria":"66","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":180.0},{"nombre":"Nelson San Martin Leiva","division":"Open","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":210.0},{"nombre":"Jaime Nicolás oporto Alarcón","division":"SubJunior","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":155.0},{"nombre":"Jaime Nicolás oporto Alarcón","division":"Junior","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":155.0},{"nombre":"Alvaro Andres Quevedo","division":"Open","categoria":"83","campeonato":"XXXV Campeonato Sudamericano","marca":285.0},{"nombre":"Jhonny Joel Martínez Rosas","division":"Master 1","categoria":"83","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":185.0},{"nombre":"Alejandro Ignacio Diaz Salamanca","division":"Junior","categoria":"83","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":180.0},{"nombre":"Lucas Andrés Montecinos Alarcón","division":"Junior","categoria":"93","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":280.0},{"nombre":"Lucas Andrés Montecinos Alarcón","division":"Open","categoria":"93","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":280.0},{"nombre":"Oscar Celis","division":"Master 1","categoria":"93","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":265.0},{"nombre":"Felipe Rios Sotomayor","division":"Open","categoria":"105","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":315.0},{"nombre":"Nehemias Rivera","division":"Open","categoria":"120","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2016","marca":280.0},{"nombre":"Ronald Tejeda Soto","division":"Open","categoria":"120+","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":215.0}],"bp":[{"nombre":"Constanza Muñoz Muñoz","division":"Junior","categoria":"47","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":50.0},{"nombre":"Constanza Muñoz Muñoz","division":"Open","categoria":"47","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":50.0},{"nombre":"Alejandra Gonzalez","division":"Open","categoria":"52","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2016","marca":55.0},{"nombre":"Dayani Michelle Garcés Pérez","division":"Open","categoria":"57","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":60.0},{"nombre":"Rocío Jesús Aghemio Núñez","division":"Open","categoria":"63","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":95.0},{"nombre":"Francisca Javiera Altamirano Paredes","division":"Open","categoria":"84+","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":62.5},{"nombre":"Jonathan Esteban Vargas Filun","division":"Open","categoria":"66","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":125.0},{"nombre":"Martin Andrés Nuñez Rodríguez","division":"Open","categoria":"74","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":145.0},{"nombre":"Guillermo Molina Araneda","division":"Junior","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":90.0},{"nombre":"Jaime Nicolás oporto Alarcón","division":"SubJunior","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":72.5},{"nombre":"Alvaro Andres Quevedo","division":"Open","categoria":"83","campeonato":"XXXV Campeonato Sudamericano","marca":170.0},{"nombre":"Jhonny Joel Martínez Rosas","division":"Master 1","categoria":"83","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":117.5},{"nombre":"Alejandro Ignacio Diaz Salamanca","division":"Junior","categoria":"83","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":90.0},{"nombre":"Lucas Andrés Montecinos Alarcón","division":"Junior","categoria":"93","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":127.5},{"nombre":"FELIPE PIZARRO ARROYO","division":"Open","categoria":"93","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":182.5},{"nombre":"Patricio Palma Lafourcade","division":"Master 1","categoria":"93","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":150.0},{"nombre":"Felipe Pizarro","division":"Open","categoria":"105","campeonato":"Campeonato Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":200.0},{"nombre":"Nehemias Rivera","division":"Open","categoria":"120","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2016","marca":202.5},{"nombre":"Ronald Tejeda Soto","division":"Open","categoria":"120+","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":120.0}],"dl":[{"nombre":"Constanza Muñoz Muñoz","division":"Junior","categoria":"47","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":120.0},{"nombre":"Constanza Muñoz Muñoz","division":"Open","categoria":"47","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":120.0},{"nombre":"Loreto Andrea Muñoz Muñoz","division":"Open","categoria":"52","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":110.0},{"nombre":"Franchesca Andrea Perez Lobos","division":"Open","categoria":"57","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":125.0},{"nombre":"Rocío Jesús Aghemio Núñez","division":"Open","categoria":"63","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":160.0},{"nombre":"Francisca Javiera Alramirano Paredes","division":"Open","categoria":"84+","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":140.0},{"nombre":"Guillermo Arturo Briones Basoalto","division":"Open","categoria":"66","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":205.0},{"nombre":"Martín Andrés Núñez Rodríguez","division":"Open","categoria":"74","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":235.0},{"nombre":"Guillermo Molina Araneda","division":"Junior","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":200.0},{"nombre":"Jaime Nicolás oporto Alarcón","division":"SubJunior","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":180.0},{"nombre":"Guillermo Arturo Briones Basoalto","division":"Open","categoria":"83","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":277.5},{"nombre":"Jhonny Joel Martínez Rosas","division":"Master 1","categoria":"83","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":200.0},{"nombre":"Abraham Ricardo González Riquelme","division":"Junior","categoria":"83","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":190.0},{"nombre":"Lucas Andrés Montecinos Alarcón","division":"Junior","categoria":"93","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":270.0},{"nombre":"Oscar Celis","division":"Open","categoria":"93","campeonato":"Campeonato Oficial Zona Sur y Nacinal Equipado Osorno 2022","marca":300.0},{"nombre":"Oscar Celis","division":"Master 1","categoria":"93","campeonato":"Campeonato Oficial Zona Sur y Nacinal Equipado Osorno 2022","marca":300.0},{"nombre":"Felipe Pizarro","division":"Open","categoria":"105","campeonato":"Campeonato Sudamericano de Powerlifting y Bench Press 2023","marca":280.0},{"nombre":"Patricio Waldemar Palma Lafourcade","division":"Open","categoria":"120","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":285.0},{"nombre":"Ronald Tejeda Soto","division":"Open","categoria":"120+","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":230.0}],"total":[{"nombre":"Constanza Muñoz Muñoz","division":"Junior","categoria":"47","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":290.0},{"nombre":"Constanza Muñoz Muñoz","division":"Open","categoria":"47","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":290.0},{"nombre":"Alejandra Gonzalez","division":"Open","categoria":"52","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2016","marca":250.0},{"nombre":"Franchesca Andrea Perez Lobos","division":"Open","categoria":"57","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":280.0},{"nombre":"Rocío Jesús Aghemio Núñez","division":"Open","categoria":"63","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":397.5},{"nombre":"Francisca Jaciera Altamirano Paredes","division":"Open","categoria":"84+","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":315.0},{"nombre":"Jonathan Esteban Vargas Filun","division":"Open","categoria":"66","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":505.0},{"nombre":"Martín Andrés Núñez Rodríguez","division":"Open","categoria":"74","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":580.0},{"nombre":"Guillermo Molina Araneda","division":"Junior","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":425.0},{"nombre":"Jaime Nicolás oporto Alarcón","division":"SubJunior","categoria":"74","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":407.5},{"nombre":"Alvaro Andres Quevedo","division":"Open","categoria":"83","campeonato":"XXXV Campeonato Sudamericano","marca":695.0},{"nombre":"Jhonny Joel Martínez Rosas","division":"Master 1","categoria":"83","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":502.5},{"nombre":"Alejandro Ignacio Diaz Salamanca","division":"Junior","categoria":"83","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2017","marca":450.0},{"nombre":"Lucas Andrés Montecinos Alarcón","division":"Junior","categoria":"93","campeonato":"Campeonaro Nacional Powelifting Raw, Equipado y OE San Vicente 2026","marca":677.5},{"nombre":"Oscar Celis","division":"Open","categoria":"93","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":712.5},{"nombre":"Oscar Celis","division":"Master 1","categoria":"93","campeonato":"Campeonato Oficial Zona Sur y Nacional Equipado Osorno 2022","marca":712.5},{"nombre":"Felipe Pizarro","division":"Open","categoria":"105","campeonato":"Campeonato Sudamericano de Powerlifting y Bench Press 2023","marca":772.5},{"nombre":"Nehemias Rivera","division":"Open","categoria":"120","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2016","marca":702.5},{"nombre":"Ronald Tejeda Soto","division":"Open","categoria":"120+","campeonato":"Campeonato Powerlifting Raw y Equipado Osorno 2019","marca":565.0}]}};
// ─── IMPORTADOR LiftingCast (CSV → inscripciones) ─────────────
let _impState = {evento:'', csvText:'', parsed:null, status:'', preview:null};
// ═══════════════════════════════════════════════════════════════
// FOTOS DE ATLETAS — sube foto, le quita el fondo y la deja
// con fondo blanco estilo IPF, lista para perfiles y transmisión.
// ═══════════════════════════════════════════════════════════════
window._fotosState = window._fotosState || {
  search:'', selected:null, file:null, preview:null,
  processing:false, status:'', error:'',
  // Editor de imagen
  bgRemovedImg:null,        // Image object con fondo ya quitado (transparente)
  transform:{zoom:1.0, offsetX:0, offsetY:0, rotation:0},
  // GIF / video de perfil TX
  gifUploading:false, gifStatus:'', gifError:'',
  gifBlend:'screen',  // 'screen' | 'normal' | 'multiply'
  // Selección múltiple para confirmar fotos pendientes "de golpe"
  bulkSel:{}, bulkProcessing:false, bulkProgress:'',
};
// Helper: busca foto pendiente de la inscripcion (carnetPhotoURL) matcheada por RUT
const _rutFoto = (s)=>String(s||'').replace(/[^0-9kK]/g,'').toLowerCase();
// ── Timeline trimmer estilo reels ────────────────────────────────
let _gifTimelineCleanup = null;
// ─── Entrenadores: importación desde entrenadores_<evento>.json ─
let _entrenadoresData = null;
let _entrenadoresLoading = false;
let _entrenadoresError = null;
// ════════════════════════════════════════════════════════════════
// EDITOR DE PUBLICACIONES (solo owner)
// 6 templates · form + preview en vivo · descarga PNG 1080×1350
// Autocompleta desde Firestore (eventos/) y usa logoUrl del evento si existe
// ════════════════════════════════════════════════════════════════
window.PUB_TEMPLATES = {
  cartaAtleta: {
    label: 'Carta de Atleta',
    icon: '<i class=yl-i-estrella></i>',
    desc: 'Carta coleccionable (estilo FUT) con marcas, bandera y foto'
  },
  atletaFuerte: {
    label: 'Atletas más fuertes',
    icon: '<i class=yl-i-estrella></i>',
    desc: 'Campeón/a overall: foto del sistema, club, marcas y GL'
  },
  estaremosPresentes: {
    label: 'Estaremos presentes',
    icon: '',
    desc: 'Anuncio de presencia en un campeonato'
  },
  inscripcionesAbiertas: {
    label: 'Inscripciones abiertas',
    icon: '',
    desc: 'Convocatoria a inscribirse'
  },
  proximoTorneo: {
    label: 'Próximo torneo',
    icon: '<i class=yl-i-reloj></i>',
    desc: 'Countdown al próximo campeonato'
  },
  resultadosPodio: {
    label: 'Resultados / Podio',
    icon: '',
    desc: 'Top 3 con stats'
  },
  recordNuevo: {
    label: 'Nuevo récord',
    icon: '',
    desc: 'Anuncio de récord nacional'
  },
  anuncioGenerico: {
    label: 'Anuncio genérico',
    icon: '',
    desc: 'Mensaje libre con título y texto'
  },
  inicio:       { label: 'Sección · Inicio',        icon: '', desc: 'Anuncio general del sitio' },
  nomina:       { label: 'Sección · Nómina',        icon: '', desc: 'Nómina / start list publicada' },
  transmisiones:{ label: 'Sección · Transmisiones', icon: '', desc: 'Aviso de transmisión' },
  atletas:      { label: 'Sección · Atletas',       icon: '', desc: 'Perfiles de atletas' },
  records:      { label: 'Sección · Récords',       icon: '', desc: 'Récords nacionales' },
  ranking:      { label: 'Sección · Ranking',       icon: '', desc: 'Ranking nacional GL' },
  calculadora:  { label: 'Sección · Calculadora',   icon: '', desc: 'Calculadora GL / IPF' }
};
// Estado del editor (persistente durante la sesión)
window.PUB_STATE = window.PUB_STATE || {
  template: 'estaremosPresentes',
  data: {
    eventName: 'SANGRE NUEVA',
    eventSubtitle: '1° Edición · Debutantes Powerlifting 2026',
    date: '13 DE JUNIO · 2026',
    location: 'Santiago · Chile',
    organizer: 'ALL POWER CD',
    title: '',
    subtitle: '',
    body: '',
    athlete1: 'Felipe Rieutord',
    athlete1Total: '708.0',
    athlete1Club: 'RIVA POWER',
    athlete2: 'Andrés Landon',
    athlete2Total: '692.5',
    athlete2Club: 'ALL POWER',
    athlete3: 'Francisco Pérez',
    athlete3Total: '670.0',
    athlete3Club: 'HIMALAYA',
    category: 'OPEN · -83 kg M',
    recordType: 'SQUAT',
    recordMark: '262.5',
    recordAthlete: 'Felipe Rieutord',
    docsList: 'Carnet · WADA · Foto',
    // ── Estilo global (controlable) ──
    fontHead: 'Oswald',
    fontBody: "'DM Sans'",
    fontScale: 1,
    bgPreset: 'azul',
    bgColor: '',
    bgImageUrl: '',
    igHandles: '@all_power_cd · @fechipo_oficial · @yourlift_oficial',
    liveBy: 'YOURLIFT.CL',
    // ── Anuncios por sección ──
    secTitle: '',
    secText: '',
    secUrl: 'yourlift.cl',
    customLogoUrl: '',   // si el user sube un logo, se almacena aquí
    // ── Carta de Atleta (estilo FUT) ──
    cardName: 'María Paz Sáez',
    cardNick: '@paaaxi',
    cardPhoto: '',
    cardSquat: '170',
    cardBench: '92.5',
    cardDeadlift: '190',
    cardTotal: '452.5',
    cardGLP: '106.32',
    cardCategory: '−57 KG',
    cardBadge: 'WORLD CHAMPION',
    cardShowBadge: true,
    cardFlag: 'CL',
    cardPhotoBlur: '',
    cardPhotoOX: 0,
    cardPhotoOY: 0,
    cardPhotoZoom: 100,
    cardNameX: 0,
    cardNameY: 720,
    cardNameScale: 100
  }
};
// Arrastrar la foto con el mouse sobre el preview (el preview está a escala 1/3.5).
window._pubPhotoDrag=null;
// Arrastrar el NOMBRE con el mouse (offset X/Y en px de la carta).
window._pubNameDrag=null;
// ═══════════════════════════════════════════
// EDITOR DE RÉCORDS NACIONALES (Firestore: records/data) — cualquier admin
// El sitio público lee records/data de Firestore si existe; si no, records.json.
// ═══════════════════════════════════════════
// Categorías retiradas: se sacan al cargar, así la primera vez que se guarde
// desde esta pantalla quedan borradas también en Firestore. La -72 era la
// categoría femenina antigua de la IPF y se pidió sacarla.
const CATS_RETIRADAS=['72'];
const REC_EMPTY={classic:{sq:[],bp:[],dl:[],total:[]},equipped:{sq:[],bp:[],dl:[],total:[]},universitario:{sq:[],bp:[],dl:[],total:[]}};

// inscripcion.html — lo que corre al abrir la página, en su orden original.
// Se carga DESPUÉS de los demás archivos de inscripcion/, que solo definen
// funciones. El orden de estas instrucciones importa: no reordenar.

// ══════════════════════════════════════════════
// FIREBASE CONFIG — REEMPLAZA CON TUS DATOS
// ══════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA21IHMus2bklPLJm7ExRrVJJL9bzLhyp4",
  authDomain: "fechipo-db-13148.firebaseapp.com",
  databaseURL: "https://fechipo-db-13148-default-rtdb.firebaseio.com",
  projectId: "fechipo-db-13148",
  storageBucket: "fechipo-db-13148.firebasestorage.app",
  messagingSenderId: "551573388751",
  appId: "1:551573388751:web:5fcc377a8d595378ab26ba",
  measurementId: "G-W231Z8TEES"
};
// ══════════════════════════════════════════════
// FIREBASE SDK LOADING
// ══════════════════════════════════════════════
let db = null, storage = null, firebaseReady = false;
let authInstance = null;
// ══════════════════════════════════════════════
// DEMO MODE (localStorage fallback)
// ══════════════════════════════════════════════
const DEMO_KEY = 'fechipo_inscripciones';
// ══════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════
// Los clubes de FECHIPO son los que salen en la sección Clubes del panel, y esa
// sección los saca de los atletas del padrón: un club figura mientras alguien lo
// tenga puesto. Acá se arma la lista igual, del mismo padrón, para que las dos
// no se puedan separar — antes esta era una lista escrita a mano y se fue
// quedando atrás: ofrecía un club que ya no existe y le faltaba uno que sí.
//
// El respaldo es solo para cuando el padrón no alcanzó a llegar (sin conexión, o
// en modo demo); si se usara, el desplegable quedaría vacío.
const CLUBS_RESPALDO = [
  "All Power CD","Powerlifting Atacama","Athor Powerlifting","Beers and Lifts","Black Bars",
  "Club Bushido Lifting","Club Deportivo Jaques Oliger","Hannya Strength",
  "Himalaya Powerlifting","Iron Forces Powerlifting","Kaizen","Los Toros",
  "Potencia Muscular","Primal Strength","REMA","Shoganai Strength","South Side Club",
  "Wolf Strength"
];
// EVENTS loaded exclusively from Firestore eventos collection
// Created and managed only through admin.html — no hardcoded events
let EVENTS = [];
// ════════════════════════════════════════════════════════════════
// CATÁLOGO ESTANDARIZADO DE TIPOS DE DOCUMENTO
// El admin elige cuáles activar por evento (campo `requiredDocs` en eventos/).
// Si el evento NO tiene requiredDocs definido → fallback a lógica vieja
// (IPF World auto-detección, isMinor → consentimiento menor, requiereFoto → carnetPhoto).
// ════════════════════════════════════════════════════════════════
const DOC_TYPES = {
  carnetIdFront: {
    label: 'Carnet de Identidad (frente)',
    icon: '<i class=yl-i-camara></i>',
    desc: 'Cara frontal del carnet de identidad',
    accept: 'image/*,.pdf',
    stateKey: 'carnetFile', nameKey: 'carnetName', urlKey: 'carnetURL',
    storagePath: 'carnet'
  },
  carnetIdReverso: {
    label: 'Carnet de Identidad (reverso)',
    icon: '<i class=yl-i-camara></i>',
    desc: 'Cara trasera del carnet de identidad',
    accept: 'image/*,.pdf',
    stateKey: 'carnetBackFile', nameKey: 'carnetBackName', urlKey: 'carnetBackURL',
    storagePath: 'carnetBack'
  },
  fotoBlanco: {
    label: 'Foto fondo blanco',
    icon: '<i class=yl-i-camara></i>',
    desc: 'Foto tipo carnet con fondo blanco, sin accesorios',
    accept: 'image/*',
    stateKey: 'carnetPhotoFile', nameKey: 'carnetPhotoName', urlKey: 'carnetPhotoURL',
    storagePath: 'carnetPhoto'
  },
  pasaporte: {
    label: 'Pasaporte',
    icon: '<i class=yl-i-usuario></i>',
    desc: 'Foto/escaneo de la página de datos del pasaporte vigente',
    accept: 'image/*,.pdf',
    stateKey: 'passportFile', nameKey: 'passportName', urlKey: 'passportURL',
    storagePath: 'passport'
  },
  wadaIntl: {
    label: 'ADEL/WADA Internacional',
    icon: '<i class=yl-i-archivo></i>',
    desc: 'Certificación WADA internacional vigente',
    accept: 'image/*,.pdf',
    stateKey: 'wadeFile', nameKey: 'wadeName', urlKey: 'wadeURL',
    storagePath: 'wada'
  },
  ipfConsent: {
    label: 'Consentimiento IPF',
    icon: '<i class=yl-i-lista></i>',
    desc: 'Formulario de consentimiento IPF firmado',
    accept: 'image/*,.pdf',
    stateKey: 'ipfConsentFile', nameKey: 'ipfConsentName', urlKey: 'ipfConsentURL',
    storagePath: 'ipfConsent',
    defaultPdfUrl: 'IPF%20Consentimiento.pdf'   // fallback si el evento no sube uno custom
  },
  menorConsent: {
    label: 'Consentimiento Menor',
    icon: '<i class=yl-i-alerta></i>',
    desc: 'Formulario de consentimiento del tutor legal firmado',
    accept: 'image/*,.pdf',
    stateKey: 'consentimientoFile', nameKey: 'consentimientoName', urlKey: 'consentimientoURL',
    storagePath: 'consentimiento',
    defaultPdfUrl: 'consentimiento_menores.pdf'
  },
  notas: {
    label: 'Concentración de Notas',
    icon: '<i class=yl-i-archivo></i>',
    desc: 'Certificado académico oficial',
    accept: 'image/*,.pdf',
    stateKey: 'notasFile', nameKey: 'notasName', urlKey: 'notasURL',
    storagePath: 'notas'
  }
};
window.DOC_TYPES = DOC_TYPES;
// ── Lo que Olimpiadas Especiales le exige a cada atleta suyo ──────────────
//
// Estos cuatro antecedentes no los pide el campeonato: los pide Olimpiadas
// Especiales, y son los mismos en toda fecha donde compitan. Por eso no viven
// en la configuración del evento —donde habría que volver a escribirlos en cada
// campeonato, y basta que alguien se olvide una vez para que un atleta llegue
// sin papeles— sino acá, y se suman solos a lo que el campeonato ya pida en
// cuanto la modalidad elegida es Olimpiadas Especiales.
//
// La cédula de identidad de su lista es el carnet que el formulario ya pide
// siempre, así que no se duplica.
const DOCS_OE_DEF = [
  // porDefecto:false → no se pide salvo que el campeonato lo active en Admin →
  // Campeonatos (se pidió sacarla de las inscripciones, pero poder volver a
  // pedirla en un campeonato puntual).
  { key:'oe_ficha', oe:true, porDefecto:false, icon:'<i class=yl-i-archivo></i>',
    label:'Ficha médica · Olimpiadas Especiales',
    desc:'Formulario de ficha médica de Olimpiadas Especiales, completado y firmado',
    linkUrl:'https://docs.google.com/forms/d/e/1FAIpQLSdOhb4H-1WeYmK19dQlPNewQFlQYa98Gv-B4NafjmD2QfOHbQ/viewform',
    linkTexto:'La ficha médica se completa en el formulario de Olimpiadas Especiales. Al terminarlo, sube acá el comprobante o la copia de la ficha.' },
  { key:'oe_exoneracion', oe:true, icon:'<i class=yl-i-lista></i>',
    label:'Exoneración · Olimpiadas Especiales',
    desc:'Exoneración de atleta y compañeros unificados y uso de imagen, firmada',
    plantillaUrl:'exoneracion_olimpiadas_especiales_2026.pdf' },
  { key:'oe_di', oe:true, icon:'<i class=yl-i-archivo></i>',
    label:'Certificado de DI o documento de acreditación',
    desc:'Copia del certificado de discapacidad intelectual o del documento de acreditación' }
];
const DOCS_OE_KEYS = DOCS_OE_DEF.map(d => 'x_' + d.key);
// ¿Este campeonato le pide este papel de Olimpiadas Especiales? Lo decide la
// ficha del campeonato (oeDocs: {x_oe_ficha:true, …}); si no dice nada, vale
// lo de siempre de cada papel (porDefecto).
function _oePide(evObj, k) {
  const o = evObj && evObj.oeDocs;
  if (o && typeof o[k] === 'boolean') return o[k];
  const d = DOCS_OE_DEF.find(x => 'x_' + x.key === k);
  return !d || d.porDefecto !== false;
}
const CATEGORIES_M = ["-53 kg","-59 kg","-66 kg","-74 kg","-83 kg","-93 kg","-105 kg","-120 kg","+120 kg"];
const CATEGORIES_F = ["-43 kg","-47 kg","-52 kg","-57 kg","-63 kg","-69 kg","-76 kg","-84 kg","+84 kg"];
const DIVISIONS = ["Sub-Junior","Junior","Open","Master I","Master II","Master III","Master IV","Universitario"];
const MODALITIES = [
  "Powerlifting Classic",
  "Only Bench Classic",
  "Powerlifting Classic + Only Bench Classic",
  "Powerlifting Equipado",
  "Only Bench Equipado",
  "Powerlifting Equipado + Only Bench Equipado",
  "Olimpiadas Especiales",
  "Powerlifting Universitario"
];
const ZONAS = ["Zona Norte","Zona Centro","Zona Sur","Internacional"];
// Lo que se lee en la lista de divisiones: los Master llevan su rango de edad
// (se cuenta por el año en que se cumplen, ver compartido/divisiones.js). El valor que
// se guarda sigue siendo el nombre solo.
const _RANGO_MASTER={"Master I":"40 a 49 años","Master II":"50 a 59 años","Master III":"60 a 69 años","Master IV":"70 años o más"};
// ══════════════════════════════════════════════
// ATHLETE DB & AUTO-CODE
// ══════════════════════════════════════════════
let athleteDB = [];
const _STOR='https://firebasestorage.googleapis.com/v0/b/fechipo-db-13148.firebasestorage.app/o/';
fetch(_STOR+'public%2Fdata.json?alt=media',{cache:'no-cache'})
  .then(r=>r.ok?r.json():fetch('data.json?v='+Date.now()).then(r=>r.json()))
  .catch(()=>fetch('data.json?v='+Date.now()).then(r=>r.json()))
  .then(d=>{
    athleteDB=d;
    _insAplicarEdits();
    // El desplegable de clubes sale del padrón, así que hay que redibujar: si no,
    // quien abrió el formulario antes de que llegara se queda con el respaldo.
    if(typeof render==='function'){
      try{render();}catch(e){console.warn('[clubs] render error',e);}
    }
  }).catch(e=>{console.warn('[data.json] load failed',e);});
// El padrón y las ediciones llegan por su cuenta y no se sabe cuál gana la
// carrera, así que las ediciones se guardan y se pegan cuando ya están las dos.
// Sin esto, si las ediciones llegaban primero se aplicaban sobre un arreglo
// vacío y se perdían: seguía ofreciéndose para inscribir una ficha dada de baja.
window._INS_EDITS_DOCS=null;
// ══ Aviso de participación previa ══════════════════════════════════════════
// El compendio no deja correr más de un regional clasificatorio por temporada.
// Cuáles bloquean a cuál se configura en la ficha de cada campeonato (Admin →
// Campeonatos), porque cambia con el calendario de cada año.
//
// El aviso NO frena la inscripción, y es a propósito: los datos pueden estar
// incompletos, un RUT puede venir mal tipeado, y el compendio tiene excepciones
// que resuelve la comisión (salvoconductos, invitados, cambios de residencia).
// Cerrarle la puerta a alguien un domingo a las once de la noche, sin nadie a
// quien apelar, es peor que dejarlo seguir con el aviso a la vista. La comisión
// lo ve marcado al revisar, que es donde se decide de verdad.
const COMPENDIO_CITA='Los atletas podrán competir solo una vez por temporada/año competitivo en torneos regionales clasificatorios, ya sea en disciplina powerlifting, only bench o simultánea, modalidad Classic o equipado y diferentes en líneas competitivas de Universitarios, OE o IPF, limitados a la zona de residencia declarado con total obtenido o competencia completa.';
const COMPENDIO_FUENTE='Compendio de Normas de Clasificación FECHIPO 2026 — Normas Generales, "De los Atletas", punto F';
// Los campeonatos de los que el archivo trae resultados, no solo la nómina. Se
// rehace si cambió la base (llega después de dibujar la primera vez).
let _cvesResCache=null,_cvesResRef=null,_cvesResN=-1;
// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let state = {
  view: 'form', // form, confirm, admin, edit_lookup, edit, admin_eventos, admin_evento_form
  step: 0,
  form: {evento:'',nombre:'',rut:'',codigo:'',sexo:'',fechaNac:'',division:'',categoria:'',modalidad:'',club:'',clubOtro:'',zona:'',comuna:'',correo:'',posNacMod:'',posNacLugar:'',posNacSQ:'',posNacBP:'',posNacDL:'',posNacTotal:'',pin:'',universidad:''},
  carnetFile: null, carnetName: '',
  carnetBackFile: null, carnetBackName: '',
  wadeFile: null, wadeName: '',
  carnetPhotoFile: null, carnetPhotoName: '',
  consentimientoFile: null, consentimientoName: '',
  passportFile: null, passportName: '',          // pasaporte (eventos IPF Worlds)
  ipfConsentFile: null, ipfConsentName: '',      // IPF consentimiento firmado
  notasFile: null, notasName: '',                // concentración de notas (IPF Worlds)
  privacyConsent: false,
  submitting: false,
  storageWarning: false,
  adminAuth: false,
  inscripciones: [],
  adminFilter: 'all',
  adminEvent: '',
  adminTab: 'inscripciones', // inscripciones | eventos
  error: '',
  success: '',
  editDoc: null,
  editId: null,
  eventoForm: null, // {id,name,date,closeDate,location,org,days,extraCols,status} for create/edit
  eventoFormMode: 'create', // create | edit
};
// ── Resultados recientes (lo que aún no está en data.json) ───────────────────
// Solo se guarda RUT, campeonato y fecha: es lo único que el aviso necesita, y no
// hace falta traerse las marcas de nadie a una página pública.
let compResDB = [];
let insActDB = [];
let _rutConDatos='';
const MSG_EV_CERRADO = 'Este campeonato ya está archivado: sus resultados están publicados '
  + 'y las inscripciones no se pueden seguir editando.\n\nSi hay algo que corregir, contacta al organizador.';
window._numCL = _numCL;
window.nacTotal = nacTotal;
// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
initFirebase().then(() => render());

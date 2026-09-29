// inscripcion.html — Firebase y los datos: campeonatos abiertos, resultados recientes y lo guardado del atleta.
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

async function initFirebase() {
  try {
    const {initializeApp} = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const {getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, query, orderBy, where, serverTimestamp, onSnapshot, runTransaction} = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const {getStorage, ref, uploadBytes, getDownloadURL} = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
    const {getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged} = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');

    if (FIREBASE_CONFIG.apiKey === "TU_API_KEY_AQUI") {
      console.warn("Firebase no configurado. Usando modo demo.");
      return false;
    }

    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    storage = getStorage(app);
    authInstance = getAuth(app);

    // Expose functions globally
    window.FB = {collection, addDoc, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, query, orderBy, where, serverTimestamp, onSnapshot, runTransaction, ref, uploadBytes, getDownloadURL, signInWithEmailAndPassword, signOut, onAuthStateChanged};
    firebaseReady = true;
    loadEventos();

    // React to auth changes — only users in `admins/{uid}` unlock the panel
    onAuthStateChanged(authInstance, async (user) => {
      if (!user) { state.adminAuth = false; if (state.view === 'admin') render(); return; }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        state.adminAuth = adminDoc.exists();
        if (!adminDoc.exists()) {
          await signOut(authInstance);
          alert('Acceso denegado: tu cuenta no está registrada como admin.');
        } else {
          loadInscripciones();
        }
      } catch(e) { console.error('[auth check]', e); state.adminAuth = false; }
      if (state.view === 'admin') render();
    });

    return true;
  } catch(e) {
    console.error("Firebase init error:", e);
    return false;
  }
}

function demoSave(entry) {
  const all = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
  entry.id = 'demo_' + Date.now();
  entry.timestamp = new Date().toISOString();
  entry.status = 'pending';
  all.push(entry);
  localStorage.setItem(DEMO_KEY, JSON.stringify(all));
  return entry.id;
}

function demoGetAll() {
  return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
}

function demoUpdate(id, updates) {
  const all = demoGetAll();
  const idx = all.findIndex(e => e.id === id);
  if (idx >= 0) { Object.assign(all[idx], updates); localStorage.setItem(DEMO_KEY, JSON.stringify(all)); }
}

// ── Cache helpers para reducir lecturas Firestore ──────────────────────
function _ifsCache(k,ttl){try{const v=localStorage.getItem('_yfc_'+k);if(!v)return null;const o=JSON.parse(v);if(Date.now()-o.ts<ttl)return o.d;}catch(e){}return null;}

function _ifsSetCache(k,d){try{localStorage.setItem('_yfc_'+k,JSON.stringify({ts:Date.now(),d}));}catch(e){}}

   // inscripciones vigentes (no rechazadas)
async function cargarCompRes(){
  try{
    const c=_ifsCache('ins_compres', 10*60*1000);
    if(c){ compResDB=c; return; }
    if(!firebaseReady||!window.FB)return;
    const snap=await window.FB.getDocs(window.FB.collection(db,'competition_results'));
    // Sin los resultados de eventos de prueba (ensayo).
    compResDB=snap.docs.map(d=>({...d.data(),id:d.id})).filter(x=>!(/ensayo/i.test(String(x.evento_id||''))||/ensayo/i.test(String(x.id||''))||/^\s*ensayo\b/i.test(String(x.evento||''))))
      .map(x=>({rut:x.rut||'',evento:x.evento||'',fecha:x.fecha||''}));
    _ifsSetCache('ins_compres', compResDB);
    _redibujarPorAviso();
  }catch(e){ console.warn('[aviso] no se pudieron cargar los resultados recientes',e); }
}

// Las inscripciones que siguen en pie. Es lo que distingue al que participó del
// que se anotó y después se bajó: en el archivo los dos quedan igual —una línea
// del campeonato sin resultado— pero solo el que participó conserva su
// inscripción. Es lo mismo que muestra el perfil del atleta como "inscripciones
// activas". Una inscripción rechazada no cuenta.
//
// Solo importan las del RUT que se está inscribiendo, así que se piden esas,
// recién cuando el RUT está completo. Antes cada visita al formulario bajaba las
// 712 inscripciones y las ~500 fotos de todos.
// Las formas de escribir un RUT que se encuentran guardadas: 12345678-9 casi
// siempre, pero hay alguna con puntos o sin guion.
function _formasRutIns(r){
  const n=String(r||'').replace(/[^0-9kK]/g,'').toUpperCase();
  if(n.length<2)return [];
  const c=n.slice(0,-1), dv=n.slice(-1), p=c.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return [...new Set([c+'-'+dv, p+'-'+dv, n, c+'-'+dv.toLowerCase(), p+'-'+dv.toLowerCase(), n.toLowerCase()])];
}

async function cargarDatosDeRut(rut){
  const n=String(rut||'').replace(/[^0-9kK]/g,'').toUpperCase();
  if(n.length<7||n===_rutConDatos||!firebaseReady||!window.FB||!window.FB.where)return;
  if(typeof validateRut==='function'&&!validateRut(formatRut(n)).valid)return;
  _rutConDatos=n;
  const F=window.FB, formas=_formasRutIns(n);
  const q=col=>F.getDocs(F.query(F.collection(db,col),F.where('rut','in',formas))).catch(()=>null);
  // El padrón público ya no trae el RUT (compartido/privacidad.js): quién es
  // este RUT se pregunta a rut_indice/{rut}, que se lee de a uno y no se lista.
  const qi=F.getDoc(F.doc(db,'rut_indice',n)).catch(()=>null);
  try{
    const [si,sf,ri]=await Promise.all([q('inscripciones'),q('atleta_fotos'),qi]);
    if(_rutConDatos!==n)return;                     // escribió otro RUT mientras tanto
    if(ri&&ri.exists&&ri.exists()){
      window._RUT_IDX=window._RUT_IDX||{};
      window._RUT_IDX[n]=ri.data()||{};
      // Si el formulario todavía no lo reconoció, ahora puede autocompletarlo.
      try{ if(state&&state.form&&!state.form.codigo&&typeof autoFillCode==='function')autoFillCode(); }catch(e){}
    }
    if(si)insActDB=si.docs.map(d=>{const x=d.data();
      return {rut:x.rut||'',evento:x.evento||'',status:x.status||''};})
      .filter(x=>x.status!=='rejected');
    window.FOTOS_BY_RUT=window.FOTOS_BY_RUT||{};
    if(sf)sf.docs.forEach(d=>{const x=d.data();
      if(x.foto_url&&x.status!=='rejected')window.FOTOS_BY_RUT[n.toLowerCase()]=x.foto_url;});
    _redibujarPorAviso();
  }catch(e){ console.warn('[aviso] no se pudieron cargar los datos del RUT',e); }
}

// Si el atleta ya había escrito su RUT antes de que esto llegara, se vuelve a
// dibujar para que vea el aviso. No se toca la pantalla si está escribiendo: un
// re-dibujado en medio de un campo le come lo tipeado.
function _redibujarPorAviso(){
  const escribiendo=document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if(!escribiendo&&bloqueoDetectado().length)render();
}

// ── Firestore eventos ────────────────────────────────────────
async function loadEventos() {
  if (!firebaseReady) {
    EVENTS = [];
    render();
    return;
  }
  try {
    // Eventos: getDocs + caché 5min (evita onSnapshot en página pública)
    const ce = _ifsCache('ins_eventos', 5*60*1000);
    if (ce) { EVENTS = ce; render(); }
    else {
      const snap = await window.FB.getDocs(window.FB.collection(db, 'eventos'));
      EVENTS = snap.docs.map(d => ({...d.data(), id: d.id}))
        .sort((a,b) => (a.date||'').localeCompare(b.date||''));
      _ifsSetCache('ins_eventos', EVENTS);
      render();
    }
    cargarCompRes();   // lo cerrado hace poco, que todavía no está en data.json
    // Las inscripciones vigentes y la foto del atleta se piden por su RUT, apenas
    // lo escribe entero (cargarDatosDeRut). Si ya venía escrito, de una vez.
    window.FOTOS_BY_RUT = window.FOTOS_BY_RUT || {};
    try{ if(state&&state.form&&state.form.rut)cargarDatosDeRut(state.form.rut); }catch(e){}
    // Edits de atletas: getDocs una vez para pre-llenar club actualizado
    window._INS_EDITS_RUT = window._INS_EDITS_RUT || {};
    window._INS_EDITS_COD = window._INS_EDITS_COD || {};
    // Copia compartida e invalidada por versión (compartido/ediciones.js): una corrección
    // hecha en el panel se ve en la carga siguiente, no veinte minutos después.
    window.YLEdiciones.cargar(() =>
      window.FB.getDocs(window.FB.collection(db, 'athlete_edits'))
        .then(snap => snap.docs.map(d => ({ ...d.data(), id: d.id })))
    ).then(eds => {
      // De la misma persona puede haber más de un documento: manda el más nuevo.
      const gana = (vieja, e) => (!vieja || (e.ts || 0) >= (vieja.ts || 0)) ? e : vieja;
      eds.forEach(e => {
        if (!e || e.id === window.YLEdiciones.MARCA) return;
        if (e.rut) { const k = String(e.rut).replace(/[^0-9kK]/g,'').toLowerCase();
          window._INS_EDITS_RUT[k] = gana(window._INS_EDITS_RUT[k], e); }
        if (e.codigo) window._INS_EDITS_COD[e.codigo] = gana(window._INS_EDITS_COD[e.codigo], e);
      });
      // Y el padrón que usa el buscador de inscripción: si una ficha se dio de
      // baja, no puede seguir ofreciéndose para inscribir.
      window._INS_EDITS_DOCS = eds;
      _insAplicarEdits();
    }).catch(e => console.warn('edits', e));
  } catch(e) {
    console.warn('Eventos load error', e);
    EVENTS = [];
    render();
  }
}

// Helper: ¿el atleta del RUT ya tiene una foto aprobada?
window.atletaTieneFoto = function(rut){
  if(!rut) return false;
  const key = String(rut).replace(/[^0-9kK]/g,'').toLowerCase();
  return !!(window.FOTOS_BY_RUT && window.FOTOS_BY_RUT[key]);
};

function openEventsFromFirebase() {
  // Solo eventos abiertos Y cuya pre-nómina aún no haya cerrado.
  const now = new Date();
  return EVENTS.filter(e => {
    if (e.status !== 'open') return false;
    // Si tiene preNominaCloseAt (datetime-local: 'YYYY-MM-DDTHH:MM'), validar que aún no pasó.
    if (e.preNominaCloseAt) {
      const close = new Date(e.preNominaCloseAt);
      if (!isNaN(close) && now > close) return false;
    }
    return true;
  });
}

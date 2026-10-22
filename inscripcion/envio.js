// inscripcion.html — enviar la inscripción.
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

async function submitForm() {
  state.submitting = true;
  state.error = '';
  render();

  try {
    const f = state.form;

    // ── Validación RUT (módulo 11) ──────────────────────
    const rutCheck = validateRut(f.rut);
    if(!rutCheck.valid){
      state.error = 'RUT inválido: ' + rutCheck.msg + '. Revisa el dígito verificador antes de enviar.';
      state.submitting = false; render(); return;
    }

    // ── Carnet obligatorio (File object debe estar presente) ─────
    if (!state.carnetFile) {
      state.error = 'Debes adjuntar el Carnet de identidad (frontal). Si lo subiste antes y no aparece, vuelve a seleccionarlo.';
      state.submitting = false; render();
      document.getElementById('carnetZone')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    // ── Certificado ADEL/WADA obligatorio ───────────────
    if (!state.wadeFile) {
      state.error = 'Debes adjuntar el Certificado ADEL/WADA o Carnet SENADIS. Si lo subiste antes y no aparece, vuelve a seleccionarlo.';
      state.submitting = false; render();
      document.getElementById('wadeZone')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    // ── Los antecedentes de Olimpiadas Especiales ───────
    // El botón ya viene desactivado sin ellos, pero se comprueba igual: si un
    // atleta de OE se enviara sin estos papeles, la nómina llegaría incompleta
    // a Olimpiadas Especiales y el que tiene que perseguirlo es el organizador.
    {
      const _evOE = EVENTS.find(e => e.id === f.evento);
      const _faltanOE = _oeDocsAparte(_evOE).filter(d => !state[d.meta.stateKey]);
      if (_faltanOE.length) {
        state.error = 'Para competir en Olimpiadas Especiales falta adjuntar: '
          + _faltanOE.map(d => d.meta.label).join(', ') + '.';
        state.submitting = false; render();
        document.getElementById('zone_' + _faltanOE[0].key)?.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
    }

    // ── Código de atleta ────────────────────────────────
    // La inscripción pública identifica al atleta por su código, no por su RUT.
    // El código sale del padrón (o del índice por RUT) o se genera para el atleta
    // nuevo; si todavía no está, se intenta una vez más antes de rendirse.
    if (!f.codigo) { try { autoFillCode(); } catch (e) {} }
    if (!f.codigo) {
      state.error = 'Falta tu código de atleta: revisa tu RUT y escribe tu nombre completo para generarlo.';
      state.submitting = false; render(); return;
    }

    // ── Duplicate check ─────────────────────────────────
    if (firebaseReady) {
      const nameNorm = f.nombre.trim().toLowerCase().replace(/\s+/g,' ');
      const existing = (state.inscripciones || []).filter(i => 
        i.evento === f.evento && i.status !== 'rejected'
      );
      const dupCod = existing.find(i => i.codigo && i.codigo === f.codigo);
      const dupName = existing.find(i => 
        i.nombre && i.nombre.trim().toLowerCase().replace(/\s+/g,' ') === nameNorm
      );
      if (dupCod) {
        state.error = `Ya existe una inscripción tuya para este campeonato. Si necesitas modificarla, usa la opción "Editar mi inscripción".`;
        state.submitting = false; render(); return;
      }
      if (dupName) {
        state.error = `Ya existe una inscripción con ese nombre para este campeonato. Si es un error, contacta al organizador.`;
        state.submitting = false; render(); return;
      }
    }
    // ────────────────────────────────────────────────────
    
    // La inscripción completa; abajo se separa lo público de lo privado
    // (compartido/privacidad.js): RUT, fecha de nacimiento, comuna y nombres de
    // archivo van solo a inscripciones_private.
    const entrada = {
      evento: f.evento,
      nombre: sanitizeInput(f.nombre),
      // El atleta corrigió el nombre que la federación tenía para su RUT. Viaja
      // con la inscripción para que el panel pueda ofrecer arreglar la ficha:
      // si no, la corrección vale solo para este campeonato y el nombre corto
      // vuelve a salir en el siguiente.
      ...(f._nombreCorregido && f._nombreBase
          ? { nombreAnterior: sanitizeInput(f._nombreBase) } : {}),
      rut: sanitizeInput(f.rut),
      codigo: sanitizeInput(f.codigo),
      sexo: f.sexo,
      fechaNac: f.fechaNac,
      division: f.division,
      categoria: f.categoria,
      modalidad: f.modalidad,
      club: sanitizeInput(f.club),
      clubOtro: sanitizeInput(f.clubOtro),
      zona: f.zona,
      comuna: sanitizeInput(f.comuna),
      universidad: sanitizeInput(f.universidad || ''),
      posNacMod: sanitizeInput(f.posNacMod || ''),
      posNacLugar: sanitizeInput(f.posNacLugar || ''),
      posNacSQ: String(_numCL(f.posNacSQ) || ''),
      posNacBP: String(_numCL(f.posNacBP) || ''),
      posNacDL: String(_numCL(f.posNacDL) || ''),
      posNacTotal: String((_numCL(f.posNacSQ)+_numCL(f.posNacBP)+_numCL(f.posNacDL))||''),
      carnetName: state.carnetName,
      wadeName: state.wadeName,
      privacyConsent: true,
      privacyConsentTs: new Date().toISOString(),
      status: 'pending',
      // Si al inscribirse ya registraba una participación que choca con este
      // campeonato, queda anotado. El atleta vio el aviso y siguió igual; la
      // comisión tiene que ver lo mismo al revisar, sin depender de acordarse.
      bloqueoAvisado: (bloqueoDetectado()||[]).map(x=>x.evento),
      // Si se saltó el consentimiento del tutor declarando ser mayor de edad,
      // queda dicho acá con la fecha que el sistema tenía. La comisión lo
      // contrasta con el carnet: es la única forma de que la salida no se use
      // para colar a un menor sin autorización.
      declaraMayorEdad: !!state.declaraMayor,
      declaraMayorFecha: state.declaraMayor ? (f.fechaNac || '') : '',
    };

    // Datos PÚBLICOS (inscripciones): legibles por cualquiera en la nómina live.
    // Datos PRIVADOS (inscripciones_private): solo admin.
    const _sep = YLPrivacidad.separarInscripcion(entrada);
    const publicEntry = _sep.pub;
    const privateEntry = Object.assign(_sep.priv, {
      pin: f.pin,
      correo: sanitizeInput(f.correo || ''),
    });

    // storageWarning se declara aquí (fuera del bloque if) para que sea accesible
    // en el bloque de renderizado del confirm al final de la función.
    let storageWarning = false;

    if (firebaseReady) {
      // Upload files to Firebase Storage
      const ts = Date.now();
      const rutClean = f.rut.replace(/[^0-9kK]/g, '').toUpperCase();

      // Comprime imágenes a WebP antes de subir (PDFs se suben sin cambios)
      const compressImage = (file) => new Promise(resolve => {
        if (!file.type.startsWith('image/')) { resolve(file); return; }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = document.createElement('canvas');
          const MAX = 1400;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => resolve(blob || file), 'image/webp', 0.82);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
      });

      // Subir archivos — comprime imágenes a WebP, PDFs se suben tal cual
      async function uploadOne(file, name) {
        const compressed = await compressImage(file);
        const MIME_EXT = {'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','application/pdf':'pdf'};
        const ext = MIME_EXT[compressed.type] || (String(file.name||'').match(/\.([a-zA-Z0-9]+)$/)||[])[1] || '';
        const r = window.FB.ref(storage, `athlete_files/${rutClean}/${name}_${ts}${ext?'.'+ext:''}`);
        console.log('[upload]', name, 'starting...', compressed.size, 'bytes', compressed.type);
        await window.FB.uploadBytes(r, compressed, {contentType: compressed.type});
        console.log('[upload]', name, 'uploaded OK');
        // Se guarda dónde quedó, no un enlace: el enlace de descarga solo lo
        // puede pedir un admin (los documentos de identidad no son públicos).
        return YLPrivacidad.rutaArchivo(r.fullPath || `athlete_files/${rutClean}/${name}_${ts}${ext?'.'+ext:''}`);
      }
      if (state.carnetFile) {
        privateEntry.carnetURL = await uploadOne(state.carnetFile, 'carnet');
      }
      if (state.carnetBackFile) {
        privateEntry.carnetBackURL = await uploadOne(state.carnetBackFile, 'carnetBack');
      }
      if (state.wadeFile) {
        privateEntry.wadeURL = await uploadOne(state.wadeFile, 'wada');
      }
      if (state.carnetPhotoFile) {
        privateEntry.carnetPhotoURL = await uploadOne(state.carnetPhotoFile, 'carnetPhoto');
      }
      if (state.consentimientoFile) {
        privateEntry.consentimientoURL = await uploadOne(state.consentimientoFile, 'consentimiento');
      }
      if (state.ipfConsentFile) {
        privateEntry.ipfConsentURL = await uploadOne(state.ipfConsentFile, 'ipfConsent');
      }
      if (state.passportFile) {
        privateEntry.passportURL = await uploadOne(state.passportFile, 'passport');
      }
      if (state.notasFile) {
        privateEntry.notasURL = await uploadOne(state.notasFile, 'notas');
      }
      // Los documentos propios del campeonato van en un barrido, no uno a uno:
      // no se sabe cuántos son ni cómo se llaman hasta que se abre el evento.
      //
      // Y NO quedan como campo suelto de la inscripción privada. Las reglas de
      // Firestore aceptan una lista cerrada de campos (hasOnly): un `xu_loquesea`
      // que no esté en esa lista bota la inscripción ENTERA con "Missing or
      // insufficient permissions", justo al final, después de subir todo. Por eso
      // las URLs se juntan acá y terminan dentro del mapa `docs`, que sí está
      // permitido y es de donde el panel las lee.
      const _urlsPropias = {};
      const _CATSUB = docsDelEvento(EVENTS.find(e=>e.id===f.evento));
      for (const meta of Object.values(_CATSUB)) {
        if (!meta.propio) continue;
        if (state[meta.stateKey])
          _urlsPropias[meta.urlKey] = await uploadOne(state[meta.stateKey], meta.storagePath);
      }
      // Construir el mapa `docs` estandarizado (nuevo sistema): para cada docKey
      // del catálogo cuyo stateKey tenga archivo, guarda la URL bajo docKey.
      const _docsMap = {};
      const _evObj2 = EVENTS.find(e=>e.id===f.evento);
      const _useNewSys = (Array.isArray(_evObj2?.requiredDocs) && _evObj2.requiredDocs.length>0)
                      || Object.keys(_urlsPropias).length>0;
      if (_useNewSys) {
        Object.entries(docsDelEvento(_evObj2)).forEach(([dk, meta])=>{
          const url = privateEntry[meta.urlKey] || _urlsPropias[meta.urlKey];
          if (url) _docsMap[dk] = url;
        });
        if (Object.keys(_docsMap).length) privateEntry.docs = _docsMap;
      }
      // Validar URLs presentes ANTES de guardar inscripción
      if (_useNewSys) {
        // Nuevo sistema: validar que todos los docs requeridos del evento están subidos
        // Mismo criterio que el formulario: al adulto no se le exige el
        // consentimiento del tutor, así que tampoco se le reclama acá.
        const missing = docsRequeridos(_evObj2, f.fechaNac).filter(dk => !_docsMap[dk]);
        if (missing.length) {
          console.error('[upload] docs faltantes:', missing);
          throw new Error('No se pudieron guardar los documentos: ' + missing.join(', ') + '. Revisa tu conexión y vuelve a intentar.');
        }
      } else {
        // Sistema viejo: carnet + wade obligatorios
        if (!privateEntry.carnetURL || !privateEntry.wadeURL) {
          console.error('[upload] URLs faltantes:', privateEntry);
          throw new Error('No se pudieron guardar los documentos. Revisa tu conexión y vuelve a intentar.');
        }
      }
      console.log('[upload] Todas las URLs OK, guardando inscripción...');

      publicEntry.timestamp = window.FB.serverTimestamp();
      privateEntry.ts = window.FB.serverTimestamp();

      // Transacción atómica: escribe ambos docs o ninguno. ID determinístico
      // `${evento}_${codigo}` para pairear public/private y evitar duplicados.
      // (Antes era el RUT, que quedaba a la vista al listar la colección.)
      const docId = YLPrivacidad.idInscripcion(f.evento, f.codigo);
      const inscRef = window.FB.doc(db, 'inscripciones', docId);
      const privRef = window.FB.doc(db, 'inscripciones_private', docId);
      try {
        await window.FB.runTransaction(db, async (tx) => {
          const existing = await tx.get(inscRef);
          if (existing.exists() && existing.data().status !== 'rejected') {
            throw new Error('DUPLICATE_RUT');
          }
          tx.set(inscRef, publicEntry);
          tx.set(privRef, privateEntry);
        });
      } catch(txErr) {
        if (txErr.message === 'DUPLICATE_RUT') {
          state.error = `Ya existe una inscripción con tu código de atleta (${f.codigo}) para este campeonato. Usa "Editar mi inscripción" si necesitas modificarla. Si no te inscribiste tú, avisa al organizador.`;
          state.submitting = false; render(); return;
        }
        throw txErr;
      }

      // Si es atleta NUEVO (no estaba en data.json), registrarlo en Firestore
      // para que el admin pueda subirle la foto aunque no esté en data.json aún.
      // Lo público va por código (atletas_pending/{codigo}: nombre, club, año);
      // el RUT y la fecha, aparte y solo para el admin (atletas_pending_priv).
      // Y el índice rut_indice/{rut} → código, para reconocerlo la próxima vez
      // que escriba su RUT: se crea una sola vez y no se puede pisar.
      if (f._codigoSource === 'new' && f.codigo) {
        const cod = sanitizeInput(f.codigo);
        const escribir = (col, id, datos) => window.FB.setDoc(window.FB.doc(db, col, id), datos)
          .catch(e2 => console.warn('[' + col + ']', e2.message));
        await escribir('atletas_pending', cod, {
          nombre: sanitizeInput(f.nombre), codigo: cod, sexo: f.sexo,
          anioNac: YLPrivacidad.anio(f.fechaNac), club: sanitizeInput(f.club), zona: f.zona,
          debut: true, inscripcion_evento: f.evento, ts: window.FB.serverTimestamp(),
        });
        await escribir('atletas_pending_priv', cod, {
          rut: sanitizeInput(f.rut), fechaNac: f.fechaNac, ts: window.FB.serverTimestamp(),
        });
        await escribir('rut_indice', YLPrivacidad.norm(f.rut), { codigo: cod, nuevo: true });
      }
    } else {
      // Demo mode: aplana en un solo objeto para localStorage.
      demoSave({...publicEntry, ...privateEntry});
    }

    state.view = 'confirm';
    state.submitting = false;
    state.storageWarning = storageWarning || false;
    render();
    window.scrollTo(0, 0);
  } catch(e) {
    state.error = 'Error al enviar: ' + e.message;
    state.submitting = false;
    render();
  }
}

function resetForm() {
  state = {...state, view:'form', step:0, form:{evento:'',nombre:'',rut:'',codigo:'',sexo:'',fechaNac:'',division:'',categoria:'',modalidad:'',club:'',clubOtro:'',zona:'',comuna:'',correo:'',posNacMod:'',posNacLugar:'',posNacSQ:'',posNacBP:'',posNacDL:'',posNacTotal:'',pin:'',universidad:''}, carnetFile:null, carnetName:'', carnetBackFile:null, carnetBackName:'', wadeFile:null, wadeName:'', carnetPhotoFile:null, carnetPhotoName:'', consentimientoFile:null, consentimientoName:'', submitting:false, storageWarning:false, error:'', success:'', editDoc:null, editId:null};
  render();
}

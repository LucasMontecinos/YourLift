// inscripcion.html — pedir la corrección de una inscripción ya enviada.
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

// ══════════════════════════════════════════════
// EDIT LOOKUP VIEW
// ══════════════════════════════════════════════
function renderEditLookup() {
  return `<div class="fade" style="max-width:440px;margin:60px auto;text-align:center">
    <h2 class="os" style="font-size:22px;letter-spacing:2px;margin-bottom:20px"><i class=yl-i-editar></i> EDITAR INSCRIPCIÓN</h2>
    <p style="color:var(--muted);font-size:13px;margin-bottom:20px">Ingresa tu RUT y el PIN de 4 dígitos que creaste al inscribirte</p>
    ${state.error?`<div class="alert alert-error"><i class=yl-i-alerta></i> ${state.error}</div>`:''}
    <div class="field">
      <label>RUT</label>
      <input class="input" type="text" id="editRut" placeholder="12345678-9" style="text-align:center" onblur="this.value=formatRut(this.value)">
    </div>
    <div class="field">
      <label>PIN de 4 dígitos</label>
      <input class="input" type="password" inputmode="numeric" maxlength="4" id="editPin" placeholder="••••" style="text-align:center;font-size:20px;letter-spacing:8px;max-width:200px;margin:0 auto" onkeydown="if(event.key==='Enter')lookupEdit()">
    </div>
    <button class="btn btn-accent" onclick="lookupEdit()" style="margin-top:8px">Buscar inscripción</button>
    <div style="margin-top:16px"><button class="btn btn-o" onclick="state.view='form';state.error='';render()" style="font-size:11px">← Volver</button></div>
  </div>`;
}

function renderEdit() {
  const f = state.form;
  const cats = f.sexo === 'Femenino' ? CATEGORIES_F : CATEGORIES_M;
  const ev = EVENTS.find(e => e.id === f.evento);
  const isUni = (ev?.extraCols||[]).includes('universidad');
  
  let h = `<div class="fade" style="max-width:600px;margin:30px auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 class="os" style="font-size:22px;letter-spacing:1px"><i class=yl-i-editar></i> EDITANDO INSCRIPCIÓN</h2>
      <button class="btn btn-o" onclick="state.view='form';state.error='';render()" style="font-size:11px">← Cancelar</button>
    </div>
    ${state.error?`<div class="alert alert-error"><i class=yl-i-alerta></i> ${state.error}</div>`:''}
    ${state.success?`<div class="alert alert-success"><i class=yl-i-check></i> ${state.success}</div>`:''}
    <div class="card" style="margin-bottom:12px;padding:12px 16px;border-left:3px solid var(--gold)">
      <span style="font-size:12px;color:var(--gold);font-family:Oswald;letter-spacing:1px">${ev?ev.name:'Evento'}</span>
    </div>
    <div class="card">
      <div class="field">
        <label>Nombre Completo</label>
        <input class="input" type="text" value="${f.nombre}" oninput="upd('nombre',this.value)" onblur="upd('nombre',formatName(this.value));this.value=state.form.nombre">
      </div>
      <div class="row">
        <div class="field">
          <label>RUT</label>
          <input class="input" type="text" value="${f.rut}" disabled style="opacity:.6">
        </div>
        <div class="field">
          <label>Código FECHIPO</label>
          <input class="input" type="text" value="${f.codigo}" readonly style="background:rgba(212,168,67,.06);cursor:default;${f.codigo?'border-color:var(--gold)':''}">
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>Sexo</label>
          <select class="input" onchange="updR('sexo',this.value)">
            <option value="">Seleccionar...</option>
            <option ${f.sexo==='Masculino'?'selected':''}>Masculino</option>
            <option ${f.sexo==='Femenino'?'selected':''}>Femenino</option>
          </select>
        </div>
        <div class="field">
          <label>Fecha de Nacimiento</label>
          <input class="input" type="date" value="${f.fechaNac}" oninput="upd('fechaNac',this.value)" onblur="render()">
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>División</label>
          <select class="input" onchange="updR('division',this.value)">
            <option value="">Seleccionar...</option>
            ${divisionesDe(_evActual()).map(d => `<option value="${d}" ${f.division===d?'selected':''}>${_divEtiqueta(d)}</option>`).join('')}
            ${isUni?`<option ${f.division==='Universitario'?'selected':''}>Universitario</option>`:''}
          </select>
        </div>
        <div class="field">
          <label>Categoría de Peso</label>
          <select class="input" onchange="updR('categoria',this.value)">
            <option value="">Seleccionar...</option>
            ${cats.map(c => `<option ${f.categoria===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>Modalidad</label>
          <select class="input" onchange="updR('modalidad',this.value)">
            <option value="">Seleccionar...</option>
            ${modalidadesDe(_evActual()).map(m => `<option ${f.modalidad===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Club</label>
          <select class="input" onchange="updR('club',this.value)">
            <option value="">Seleccionar club...</option>
            ${clubsParaElegir(f.club).map(c => `<option ${f.club===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      ${isUni?`<div class="field">
        <label>Universidad</label>
        <input class="input" type="text" value="${f.universidad||''}" oninput="upd('universidad',this.value)">
      </div>`:''}
      <div class="field">
        <label>Ciudad y Región <span class="req">*</span></label>
        <input class="input ${f.comuna?'ok':''}" type="text" placeholder="ej: Talca, Región del Maule" value="${f.comuna}" oninput="upd('comuna',this.value)">
      </div>
    </div>
    <div style="text-align:right;margin-top:12px">
      <button class="btn btn-g" onclick="saveEdit()" ${state.submitting||state.success?'disabled':''}>
        ${state.submitting?'Enviando solicitud...':(state.success?'Solicitud enviada':'Enviar solicitud de edición')}
      </button>
    </div>
  </div>`;
  return h;
}

// ══════════════════════════════════════════════
// EDIT HANDLERS
// ══════════════════════════════════════════════
// La edición ya no es directa — el atleta envía una solicitud a
// `edit_requests` y el admin la revisa (valida el PIN contra
// `inscripciones_private`). Esto evita exponer el PIN en la colección
// pública de inscripciones.
// Editar una inscripción solo tiene sentido mientras el campeonato sigue vivo:
// con la inscripción abierta, o cerrada y todavía por correrse. Uno archivado ya
// se compitió y sus resultados están publicados, así que un cambio de categoría
// ahí no arregla nada —llega tarde— y solo deja una solicitud en la bandeja del
// organizador por un campeonato que ya nadie está mirando. Un borrador tampoco:
// todavía no existe para el público.
//
// Un campeonato sin `status` no se bloquea: los hay antiguos que nunca lo
// tuvieron, y quedarían sin poder editarse por un campo que nadie llenó.
function _evPermiteEditar(ev){
  if(!ev) return true;
  const s = String(ev.status || '').toLowerCase();
  return !s || s === 'open' || s === 'closed';
}

async function lookupEdit() {
  const rut = formatRut(document.getElementById('editRut')?.value || '');
  const pin = document.getElementById('editPin')?.value || '';
  if (!rut || !pin) { state.error = 'Ingresa RUT y PIN'; render(); return; }
  const rutCheck = validateRut(rut);
  if (!rutCheck.valid) { state.error = 'RUT inválido: ' + rutCheck.msg; render(); return; }
  if (!/^\d{4}$/.test(pin)) { state.error = 'El PIN debe ser de 4 dígitos'; render(); return; }

  state.error = '';
  try {
    // Busca por RUT en la colección pública. El PIN ya no vive acá, así
    // que no validamos aquí — el admin lo verifica al aprobar.
    let candidates = [];
    if (firebaseReady) {
      const q = window.FB.query(window.FB.collection(db, 'inscripciones'), window.FB.where('rut', '==', rut));
      const snap = await window.FB.getDocs(q);
      snap.forEach(d => candidates.push({id: d.id, ...d.data()}));
    } else {
      candidates = demoGetAll().filter(i => formatRut(i.rut) === rut);
    }
    // Solo inscripciones activas (no rechazadas).
    candidates = candidates.filter(c => c.status !== 'rejected');
    if (!candidates.length) { state.error = 'No se encontró inscripción activa con ese RUT'; render(); return; }
    // Si hay varias, elegimos la más reciente por timestamp.
    candidates.sort((a,b) => (b.timestamp?.seconds||0) - (a.timestamp?.seconds||0));
    const found = candidates[0];

    // VERIFICAR cierre de pre-nómina: si ya pasó, NO se puede editar
    // (solo el admin puede modificar inscripciones post-cierre)
    const ev = EVENTS.find(e => e.id === found.evento);
    if (!_evPermiteEditar(ev)) {
      state.error = MSG_EV_CERRADO;
      render();
      return;
    }
    if (ev?.preNominaCloseAt) {
      const close = new Date(ev.preNominaCloseAt);
      if (!isNaN(close) && new Date() > close) {
        const fechaCierre = close.toLocaleString('es-CL', {dateStyle:'short', timeStyle:'short'});
        state.error = 'La pre-nómina cerró el ' + fechaCierre + '. Ya no puedes editar tu inscripción.\n\nPara cambios de categoría o bajas, contacta al admin del evento.';
        render();
        return;
      }
    }

    state.editId = found.id;
    state.editDoc = found;
    state.form = {
      evento: found.evento || '',
      nombre: found.nombre || '',
      rut: found.rut || '',
      codigo: found.codigo || '',
      sexo: found.sexo || '',
      fechaNac: found.fechaNac || '',
      division: found.division || '',
      categoria: found.categoria || '',
      modalidad: found.modalidad || '',
      club: found.club || '',
      clubOtro: found.clubOtro || '',
      zona: found.zona || '',
      comuna: found.comuna || '',
      pin: pin, // del input, se usará al enviar la solicitud
      universidad: found.universidad || '',
    };
    state.view = 'edit';
    state.error = '';
    state.success = '';
    render();
  } catch(e) {
    state.error = 'Error buscando: ' + e.message;
    render();
  }
}

async function saveEdit() {
  state.submitting = true;
  state.error = '';
  state.success = '';
  render();

  try {
    const f = state.form;
    // Re-validar el cierre de pre-nómina al momento de enviar
    // (el atleta pudo abrir el form ANTES del cierre y enviar DESPUÉS)
    const ev = EVENTS.find(e => e.id === f.evento);
    // Igual que con la pre-nómina: el campeonato pudo archivarse entre que abrió
    // el formulario y apretó guardar.
    if (!_evPermiteEditar(ev)) {
      state.submitting = false;
      state.error = MSG_EV_CERRADO;
      render();
      return;
    }
    if (ev?.preNominaCloseAt) {
      const close = new Date(ev.preNominaCloseAt);
      if (!isNaN(close) && new Date() > close) {
        state.submitting = false;
        state.error = 'La pre-nómina cerró mientras editabas. Tu solicitud no se envió. Contacta al admin del evento.';
        render();
        return;
      }
    }
    // Solo campos editables por el atleta. NO evento, status, flight,
    // sortOrder, rut, carnetURL, wadeURL, pin.
    //
    // Y SOLO LOS QUE DE VERDAD CAMBIARON. Antes se mandaban los doce campos
    // siempre, así que entrar a mirar la inscripción y apretar guardar le dejaba
    // al organizador una solicitud que no pedía nada. Con un campeonato grande eso
    // es una bandeja llena de avisos vacíos, y entre medio se pierde el que sí
    // importa. Ahora, si no cambió nada, no se manda nada.
    //
    // Cada campo se compara con la MISMA limpieza que se le aplica al enviarlo: si
    // no, un club que quedó guardado con un espacio de más se vería como un cambio
    // cada vez que alguien abre el formulario.
    const LIMPIEZA = {
      nombre: v => sanitizeInput(String(v || '').trim()),
      codigo: v => sanitizeInput(String(v || '').trim()),
      club: v => sanitizeInput(String(v || '')),
      clubOtro: v => sanitizeInput(String(v || '')),
      comuna: v => sanitizeInput(String(v || '')),
      universidad: v => sanitizeInput(String(v || '')),
    };
    const CAMPOS = ['nombre','codigo','sexo','fechaNac','division','categoria',
                    'modalidad','club','clubOtro','zona','comuna','universidad'];
    const limpiar = (k, v) => LIMPIEZA[k] ? LIMPIEZA[k](v) : String(v == null ? '' : v);

    const antes = state.editDoc || {};
    const changes = {};
    for (const k of CAMPOS) {
      const nuevo = limpiar(k, f[k]);
      if (nuevo !== limpiar(k, antes[k])) changes[k] = nuevo;
    }

    if (!Object.keys(changes).length) {
      state.submitting = false;
      state.error = 'No hay nada que cambiar: tu inscripción quedó igual, '
                  + 'así que no se envió ninguna solicitud.';
      render();
      return;
    }

    if (firebaseReady) {
      // Crea una solicitud de edición. El admin la revisa y aplica.
      await window.FB.addDoc(window.FB.collection(db, 'edit_requests'), {
        inscripcionId: state.editId,
        rut: f.rut,
        pin: f.pin,
        changes: changes,
        status: 'pending',
        ts: window.FB.serverTimestamp(),
      });
    } else {
      demoUpdate(state.editId, changes);
    }

    state.submitting = false;
    const n = Object.keys(changes).length;
    state.success = 'Tu solicitud de edición fue enviada con '
      + (n === 1 ? '1 cambio' : n + ' cambios')
      + '. El organizador la revisará y se aplicarán si el PIN es correcto.';
    render();
  } catch(e) {
    state.error = 'Error al enviar solicitud: ' + e.message;
    state.submitting = false;
    render();
  }
}

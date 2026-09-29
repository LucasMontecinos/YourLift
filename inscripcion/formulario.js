// inscripcion.html — el formulario de inscripción, la confirmación y las reglas por edad (menores, consentimiento).
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

function renderForm() {
  const f = state.form;
  const steps = ['Evento','Datos Personales','Competencia','Documentos'];
  const s = state.step;
  const cats = f.sexo === 'Femenino' ? CATEGORIES_F : CATEGORIES_M;
  const ev = EVENTS.find(e => e.id === f.evento);
  const isUni = (ev?.extraCols||[]).includes('universidad');
  const closed = ev && new Date() > new Date(ev.closeDate + 'T23:59:59');

  let h = `<div class="fade" style="margin-top:20px">`;
  
  // Title
  h += `<div style="text-align:center;margin-bottom:24px">
    <h1 class="os" style="font-size:clamp(22px,4vw,30px);letter-spacing:2px"><span style="color:var(--accent)">INSCRIPCIÓN</span> A CAMPEONATO</h1>
    <p style="color:var(--muted);font-size:13px;margin-top:4px">Completa el formulario para inscribirte</p>
    <div style="width:60px;height:3px;background:linear-gradient(90deg,var(--accent),var(--gold));margin:10px auto;border-radius:2px"></div>
    <button class="btn btn-o" onclick="state.view='edit_lookup';state.error='';render()" style="margin-top:12px;font-size:11px;padding:8px 16px"><i class=yl-i-editar></i> Editar mi inscripción</button>
  </div>`;

  // Firebase status
  if (!firebaseReady) {
    h += `<div class="alert alert-info"><i class=yl-i-info></i> Modo demostración — Los datos se guardan localmente. Configura Firebase para inscripciones reales.</div>`;
  }

  // Step bar
  h += `<div class="step-bar">${steps.map((st,i) => `<div class="step-dot ${i<s?'done':i===s?'active':''}"></div>`).join('')}</div>`;
  h += `<p style="font-size:12px;color:var(--muted);margin-bottom:16px">Paso ${s+1} de ${steps.length}: <strong style="color:var(--text)">${steps[s]}</strong></p>`;

  if (state.error) h += `<div class="alert alert-error"><i class=yl-i-alerta></i> ${state.error}</div>`;
  h += bloqueoAvisoHtml();

  // STEP 0: Event selection
  if (s === 0) {
    h += `<div class="card"><h3 class="os" style="font-size:16px;letter-spacing:1px;margin-bottom:16px">Selecciona la Competencia</h3>`;
    const openEvs = openEventsFromFirebase();
    if (!openEvs.length) {
      h += `<div style="text-align:center;padding:40px;color:var(--muted)">
        <div style="font-size:32px;margin-bottom:12px"><i class=yl-i-pesa></i></div>
        <div style="font-family:Oswald;font-size:16px;letter-spacing:1px;margin-bottom:8px">No hay campeonatos abiertos</div>
        <div style="font-size:13px">Las inscripciones serán habilitadas por la federación próximamente.</div>
      </div>`;
    }
    openEvs.forEach(ev => {
      const sel = f.evento === ev.id;
      const isClosed = ev.status==='closed' || (ev.closeDate && new Date() > new Date(ev.closeDate + 'T23:59:59'));
      h += `<div onclick="${isClosed?'':`selectEvent('${ev.id}')`}" style="padding:16px;border-radius:10px;border:2px solid ${sel?'var(--accent)':isClosed?'var(--border)':'var(--border)'};background:${sel?'rgba(196,30,58,.08)':'transparent'};margin-bottom:10px;cursor:${isClosed?'not-allowed':'pointer'};transition:all .2s;opacity:${isClosed?'.5':'1'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="os" style="font-size:15px;font-weight:700">${ev.name}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px">${ev.org} · ${ev.location} · ${ev.date}</div>
          </div>
          ${isClosed ? '<span class="tag" style="background:rgba(239,68,68,.15);color:var(--red)">Cerrado</span>' : sel ? '<span style="color:var(--accent);font-size:20px"><i class=yl-i-check></i></span>' : ''}
        </div>
      </div>`;
    });
    h += `<div style="text-align:right;margin-top:16px">
      <button class="btn btn-accent" onclick="nextStep()" ${!f.evento?'disabled':''}>Siguiente →</button>
    </div></div>`;
  }

  // STEP 1: Personal data
  if (s === 1) {
    h += `<div class="card"><h3 class="os" style="font-size:16px;letter-spacing:1px;margin-bottom:16px">Datos del Atleta</h3>
    <div class="field">
      <label>Nombre Completo <span class="req">*</span></label>
      ${/* La gente escribe un solo nombre y un solo apellido, y después hay que
            perseguirla para completar la ficha. Diciéndole exactamente qué va en
            cada lugar se corrige en el momento, que es cuando cuesta menos. */''}
      <input class="input ${f.nombre?'ok':''}" type="text" placeholder="Nombre Nombre Apellido Apellido" value="${f.nombre}" oninput="upd('nombre',this.value)" onblur="upd('nombre',formatName(this.value));revisarNombre();this.value=state.form.nombre">
      <div style="font-size:11px;color:var(--muted);margin-top:5px;line-height:1.6">
        Nombre <span style="opacity:.75">(primer nombre)</span> ·
        Nombre <span style="opacity:.75">(segundo nombre)</span> ·
        Apellido <span style="opacity:.75">(primer apellido)</span> ·
        Apellido <span style="opacity:.75">(segundo apellido)</span>
      </div>
    </div>
    <div class="row">
      <div class="field">
        <label>RUT <span class="req">*</span></label>
        <input class="input ${f.rut?(validateRut(f.rut).valid?'ok':'err'):''}" type="text" placeholder="12345678-9" value="${f.rut}" oninput="upd('rut',this.value)" onblur="upd('rut',formatRut(this.value));autoFillCode();autoFillContact();this.value=state.form.rut">
        ${f.rut&&!validateRut(f.rut).valid?`<div style="font-size:10px;color:var(--red,#ef4444);margin-top:3px"><i class=yl-i-alerta></i> ${validateRut(f.rut).msg}</div>`:''}
      </div>
      <div class="field">
        <label>Código de Atleta FECHIPO <span style="font-size:9px;color:var(--muted);text-transform:none;letter-spacing:0">(auto)</span></label>
        <input class="input ${f.codigo?'ok':''}" type="text" id="codigoInput" value="${f.codigo}" readonly style="background:rgba(212,168,67,.06);cursor:default;${f.codigo?'border-color:var(--gold)':''}">
        <div id="codigoLabel" style="font-size:10px;margin-top:4px;min-height:14px;color:${f._codigoSource==='db'?'var(--green)':'var(--orange, #f59e0b)'}">${f._codigoSource==='db'?'<i class=yl-i-check></i> Atleta encontrado en base de datos':f._codigoSource==='new'?'Nuevo atleta — código generado':''}</div>
      </div>
    </div>
    <div class="row">
      <div class="field">
        <label>Sexo <span class="req">*</span></label>
        <select class="input ${f.sexo?'ok':''}" onchange="updR('sexo',this.value)">
          <option value="">Seleccionar...</option>
          <option ${f.sexo==='Masculino'?'selected':''}>Masculino</option>
          <option ${f.sexo==='Femenino'?'selected':''}>Femenino</option>
        </select>
      </div>
      <div class="field">
        <label>Fecha de Nacimiento <span class="req">*</span></label>
        <input class="input ${f.fechaNac?'ok':''}" type="date" value="${f.fechaNac}" oninput="upd('fechaNac',this.value)" onblur="render()">
      </div>
    </div>
    <div class="row">
      <div class="field">
        <label>Club <span class="req">*</span></label>
        <select class="input ${f.club?'ok':''}" onchange="updR('club',this.value)">
          <option value="">Seleccionar club...</option>
          ${clubsParaElegir(f.club).map(c => `<option ${f.club===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Ciudad y Región <span class="req">*</span></label>
        <input class="input ${f.comuna?'ok':''}" type="text" placeholder="ej: Talca, Región del Maule" value="${f.comuna}" oninput="upd('comuna',this.value)">
      </div>
    </div>
    ${f.club==='Otro'?`<div class="field">
      <label>Nombre del Club</label>
      <input class="input" type="text" placeholder="Nombre de tu club" value="${f.clubOtro}" oninput="upd('clubOtro',this.value)">
    </div>`:''}
    <div class="field">
      <label>Correo de Contacto <span class="req">*</span></label>
      <input class="input ${f.correo&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.correo)?'ok':''}" type="email" inputmode="email" placeholder="tucorreo@ejemplo.com" value="${f.correo||''}" oninput="upd('correo',this.value.trim())">
      <div style="font-size:10px;color:var(--muted);margin-top:3px">Lo usa FECHIPO para contactarte. No se muestra públicamente.</div>
    </div>
    <div class="field" style="margin-top:8px;padding-top:12px;border-top:1px solid var(--border)">
      <label>PIN de Edición (4 dígitos) <span class="req">*</span> — <span style="color:var(--muted);font-size:10px;text-transform:none;letter-spacing:0">Guarda este PIN para modificar tu inscripción después</span></label>
      <input class="input ${f.pin&&f.pin.length===4?'ok':''}" type="password" inputmode="numeric" maxlength="4" placeholder="Crea un PIN de 4 dígitos" value="${f.pin}" oninput="upd('pin',this.value.replace(/[^0-9]/g,'').slice(0,4))" style="max-width:200px;text-align:center;font-size:20px;letter-spacing:8px">
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:16px">
      <button class="btn btn-outline" onclick="prevStep()">← Atrás</button>
      <button id="step1NextBtn" class="btn btn-accent" onclick="nextStep()" ${!(f.nombre&&f.rut&&f.sexo&&f.fechaNac&&f.club&&f.comuna&&f.correo&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.correo)&&f.pin&&f.pin.length===4)?'disabled':''}>Siguiente →</button>
    </div></div>`;
  }

  // STEP 2: Competition details
  if (s === 2) {
    // Pregunta "Posición en el Nacional 2026" (solo si el evento la activa). Se arma
    // por concatenación (sin template literals anidados) para no romper el render.
    const _posNacOn = !!(EVENTS.find(e=>e.id===f.evento)||{}).posNac2026;
    let _posNacBlock = '';
    if (_posNacOn) {
      const _mo = ['Classic','Equipado','OE','Universitario']
        .map(m => '<option '+(f.posNacMod===m?'selected':'')+'>'+m+'</option>').join('');
      const _lo = [1,2,3]
        .map(n => '<option value="'+n+'" '+(String(f.posNacLugar)===String(n)?'selected':'')+'>'+n+'° lugar</option>').join('');
      const _np = (k)=> '<input class="input" type="text" inputmode="decimal" placeholder="kg" value="'+(f[k]||'')+'" oninput="upd(\''+k+'\',this.value);nacTotal()">';
      const _sumT = _numCL(f.posNacSQ)+_numCL(f.posNacBP)+_numCL(f.posNacDL);
      _posNacBlock =
        '<div class="field" style="margin-top:8px;padding-top:12px;border-top:1px solid var(--border)">'
        + '<label>Posición en el Nacional 2026 <span class="req">*</span></label>'
        + '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Clasificación al Sudamericano. Indica tu modalidad, lugar y las marcas que levantaste en esa competencia.</div>'
        + '<div class="row"><div class="field">'
        +   '<label style="font-size:11px;text-transform:none;letter-spacing:0">Modalidad</label>'
        +   '<select class="input '+(f.posNacMod?'ok':'')+'" onchange="updR(\'posNacMod\',this.value)"><option value="">Seleccionar...</option>'+_mo+'</select>'
        + '</div><div class="field">'
        +   '<label style="font-size:11px;text-transform:none;letter-spacing:0">Lugar</label>'
        +   '<select class="input '+(f.posNacLugar?'ok':'')+'" onchange="updR(\'posNacLugar\',this.value)"><option value="">Seleccionar...</option>'+_lo+'</select>'
        + '</div></div>'
        + '<div style="font-size:11px;color:var(--muted);margin:10px 0 6px">Marcas levantadas en el Nacional 2026 (kg):</div>'
        + '<div class="row"><div class="field">'
        +   '<label style="font-size:11px;text-transform:none;letter-spacing:0">Sentadilla</label>'+_np('posNacSQ')
        + '</div><div class="field">'
        +   '<label style="font-size:11px;text-transform:none;letter-spacing:0">Banca</label>'+_np('posNacBP')
        + '</div><div class="field">'
        +   '<label style="font-size:11px;text-transform:none;letter-spacing:0">Peso muerto</label>'+_np('posNacDL')
        + '</div></div>'
        + '<div class="field" style="margin-top:8px">'
        +   '<label style="font-size:11px;text-transform:none;letter-spacing:0">Total (suma automática)</label>'
        +   '<input id="nacTotalField" class="input" readonly style="max-width:220px;background:rgba(212,168,67,.10);border-color:rgba(212,168,67,.4);font-weight:700" value="'+(_sumT>0?_sumT:'')+'">'
        + '</div></div>';
    }
    h += `<div class="card"><h3 class="os" style="font-size:16px;letter-spacing:1px;margin-bottom:16px">Datos de Competencia</h3>
    <div class="row">
      <div class="field">
        <label>División de Edad <span class="req">*</span></label>
        <select class="input ${f.division?'ok':''}" onchange="updR('division',this.value)">
          <option value="">Seleccionar...</option>
          ${divisionesDe(_evActual()).map(d => `<option value="${d}" ${f.division===d?'selected':''}>${_divEtiqueta(d)}</option>`).join('')}
          ${isUni?'<option '+(f.division==='Universitario'?'selected':'')+'>Universitario</option>':''}
        </select>
      </div>
      <div class="field">
        <label>Categoría de Peso <span class="req">*</span></label>
        <select class="input ${f.categoria?'ok':''}" onchange="updR('categoria',this.value)" ${!f.sexo?'disabled':''}>
          <option value="">Seleccionar...</option>
          ${cats.map(c => `<option ${f.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field">
      <label>Modalidad <span class="req">*</span></label>
      <select class="input ${f.modalidad?'ok':''}" onchange="updR('modalidad',this.value)">
        <option value="">Seleccionar...</option>
        ${modalidadesDe(_evActual()).map(m => `<option ${f.modalidad===m?'selected':''}>${m}</option>`).join('')}
      </select>
    </div>
    ${isUni ? `<div class="field">
      <label>Universidad <span class="req">*</span></label>
      <input class="input ${f.universidad?'ok':''}" type="text" placeholder="Nombre completo de tu universidad" value="${f.universidad||''}" oninput="upd('universidad',this.value)">
    </div>` : ''}
    ${_posNacBlock}
    <div style="display:flex;justify-content:space-between;margin-top:16px">
      <button class="btn btn-outline" onclick="prevStep()">← Atrás</button>
      <button class="btn btn-accent" onclick="nextStep()" ${!(f.division&&f.categoria&&f.modalidad && (!_posNacOn || (f.posNacMod&&f.posNacLugar)))?'disabled':''}>Siguiente →</button>
    </div></div>`;
  }

  // STEP 3: Documents
  if (s === 3) {
    const _evObj = EVENTS.find(e=>e.id===f.evento);
    const _evName = _evObj?.name || '';
    // Si el evento tiene requiredDocs definido → usar el nuevo sistema dinámico.
    // Si no → usar la lógica vieja (backward compat: IPF auto-detección, isMinor, requiereFoto).
    const _hasNewDocs = Array.isArray(_evObj?.requiredDocs) && _evObj.requiredDocs.length>0;
    // Lo que le toca subir a ESTE atleta. Es la lista del evento menos el
    // consentimiento del tutor cuando no es menor por año de nacimiento.
    const _docsPedidos = docsRequeridos(_evObj, f.fechaNac);
    const _docTemplates = _evObj?.docTemplates || {};
    const _CAT = docsDelEvento(_evObj);
    const isIPFWorld = !_hasNewDocs && (/IPF\s*World/i.test(_evName) || _evObj?.tipo==='ipf_world');

    h += `<div class="card"><h3 class="os" style="font-size:16px;letter-spacing:1px;margin-bottom:16px">Documentos${isIPFWorld?' · <i class=yl-i-globo></i> IPF WORLD':''}${_hasNewDocs?' · '+(_evObj.docsLabel||_evName):''}</h3>`;

    // ─── SISTEMA NUEVO: requiredDocs explícito en el evento ───
    if (_hasNewDocs) {
      _docsPedidos.forEach(docKey => {
        h += _docCampoHtml(docKey, _CAT[docKey], _docTemplates[docKey]);
      });
      // Si ya declaró ser mayor, el consentimiento salió de la lista y con él se
      // iría la casilla: hay que dejarla a la vista para poder desmarcarla.
      if (_evObj.requiredDocs.indexOf('menorConsent')>=0
          && _docsPedidos.indexOf('menorConsent')<0
          && isMinor(f.fechaNac)) {
        h += `<div class="field">${_declaraMayorHtml()}</div>`;
      }
      // Summary + botones + cierre card
      const allDocsCheck = _docsPedidos.map(k=>{
        const m=_CAT[k]; if(!m) return '';
        const ok = !!state[m.nameKey];
        return `<div><span style="color:var(--muted)">${m.icon} ${m.label}:</span> ${ok?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>`;
      }).join('');
      const allDocsDisabled = (()=>{
        for(const k of _docsPedidos){
          const m=_CAT[k]; if(!m) continue;
          if(!state[m.nameKey]) return 'disabled';
        }
        if(state.submitting) return 'disabled';
        return '';
      })();
      h += `<div style="background:var(--bg);border-radius:10px;padding:16px;margin-top:16px;border:1px solid var(--border)">
        <h4 class="os" style="font-size:13px;letter-spacing:1px;color:var(--gold);margin-bottom:10px">RESUMEN DE INSCRIPCIÓN</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
          <div><span style="color:var(--muted)">Evento:</span> <strong>${_evName}</strong></div>
          <div><span style="color:var(--muted)">Atleta:</span> <strong>${f.nombre}</strong></div>
          <div><span style="color:var(--muted)">RUT:</span> ${f.rut}</div>
          <div><span style="color:var(--muted)">Club:</span> ${f.club==='Otro'?f.clubOtro:f.club}</div>
          <div><span style="color:var(--muted)">División:</span> ${f.division}</div>
          <div><span style="color:var(--muted)">Categoría:</span> ${f.categoria}</div>
          ${allDocsCheck}
        </div>
      </div>
      <label style="display:flex;align-items:flex-start;gap:10px;margin-top:18px;cursor:pointer;padding:12px;background:rgba(212,168,67,.06);border:1px solid rgba(212,168,67,.2);border-radius:8px">
        <input type="checkbox" id="privacyChkNew" onchange="state.privacyConsent=this.checked;render()" ${state.privacyConsent?'checked':''} style="margin-top:2px;width:16px;height:16px;accent-color:#D4A843;flex-shrink:0">
        <span style="font-size:12px;color:rgba(180,200,230,.8);line-height:1.6">He leído y acepto la <span onclick="event.preventDefault();(window.parent&&window.parent.sv?window.parent.sv('terminos'):window.open('./'))" style="color:#D4A843;cursor:pointer;text-decoration:underline">Política de Privacidad</span> de FECHIPO. Autorizo el tratamiento de mis datos personales para la gestión de competencias de powerlifting, conforme a la Ley N° 19.628 y Ley N° 21.719.</span>
      </label>
      <div style="display:flex;justify-content:space-between;margin-top:14px">
        <button class="btn btn-outline" onclick="prevStep()">← Atrás</button>
        <button class="btn btn-green" onclick="submitForm()" ${allDocsDisabled||!state.privacyConsent?'disabled':''}>${state.submitting?'<span class="sp"></span> Enviando...':'<i class=yl-i-check></i> Enviar Inscripción'}</button>
      </div></div>`;
    } else {
    // ─── SISTEMA VIEJO (backward compat) — el bloque IPF/menor/foto sigue como estaba ───
    h += `${isIPFWorld?`
    <div style="background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.4);border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:4px"><i class=yl-i-globo></i> Campeonato Internacional IPF World</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5">Este campeonato requiere documentación internacional: pasaporte vigente, certificación WADA internacional, foto oficial con fondo blanco y el formulario de consentimiento IPF firmado.</div>
    </div>` : ''}
    <div class="field">
      <label>${isIPFWorld?'Pasaporte (página de datos)':'Carnet de Identidad (cara frontal)'} <span class="req">*</span></label>
      <div class="upload-zone ${state.carnetName?'done':''}" id="carnetZone">
        <input type="file" accept="image/*,.pdf" onchange="handleFile(this,'carnet')">
        ${state.carnetName ? `<div class="icon"><i class=yl-i-check></i></div><div class="fname">${state.carnetName}</div><div class="txt">Click para cambiar</div>` : `<div class="icon"><i class=yl-i-camara></i></div><div class="txt">${isIPFWorld?'Foto/escaneo del pasaporte vigente':'Arrastra o haz click para subir imagen del carnet'}</div><div style="font-size:10px;color:var(--muted);margin-top:4px">JPG, PNG o PDF · Máx 10MB</div>`}
      </div>
    </div>
    <div class="field">
      <label>${isIPFWorld?'Certificación WADA Internacional <span style="color:#ef4444;font-weight:700">*</span>':'Certificado ADEL/WADA <span style="color:#ef4444;font-weight:700">*</span> <span style="font-size:10px;color:var(--muted);text-transform:none;letter-spacing:0;font-weight:400">(atletas internacionales) / Carnet SENADIS (atletas OE)</span>'}</label>
      <div class="upload-zone ${state.wadeName?'done':''}" id="wadeZone">
        <input type="file" accept="image/*,.pdf" onchange="handleFile(this,'wade')">
        ${state.wadeName ? `<div class="icon"><i class=yl-i-check></i></div><div class="fname">${state.wadeName}</div><div class="txt">Click para cambiar</div>` : `<div class="icon"><i class=yl-i-archivo></i></div><div class="txt">${isIPFWorld?'Certificación WADA internacional vigente':'Certificado ADEL/WADA (internacional) · Carnet SENADIS (OE)'}</div><div style="font-size:10px;color:var(--muted);margin-top:4px">JPG, PNG o PDF · Máx 10MB</div>`}
      </div>
    </div>
    ${_oeBloqueHtml(_evObj)}
    ${isIPFWorld?`
    <div class="field">
      <label>Foto oficial — fondo blanco, sin accesorios <span class="req">*</span></label>
      <div class="upload-zone ${state.carnetPhotoName?'done':''}" id="carnetPhotoZone">
        <input type="file" accept="image/*" onchange="handleFile(this,'carnetPhoto')">
        ${state.carnetPhotoName ? `<div class="icon"><i class=yl-i-check></i></div><div class="fname">${state.carnetPhotoName}</div><div class="txt">Click para cambiar</div>` : `<div class="icon"><i class=yl-i-camara></i></div><div class="txt">Foto de rostro con fondo blanco, sin accesorios (gorra, lentes, joyas)</div><div style="font-size:10px;color:var(--muted);margin-top:4px">JPG, PNG · Máx 10MB</div>`}
      </div>
    </div>
    <div class="field">
      <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.4);border-radius:10px;padding:14px 16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:#60a5fa;margin-bottom:4px"><i class=yl-i-lista></i> Consentimiento IPF</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Descarga el formulario IPF, complétalo y fírmalo. Luego sube el documento firmado.</div>
        <a href="IPF%20Consentimiento.pdf" download="IPF Consentimiento.pdf" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:8px 14px;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.5);border-radius:6px;color:#60a5fa;font-size:12px;font-weight:600;text-decoration:none;font-family:Oswald,sans-serif;letter-spacing:1px">
          DESCARGAR IPF CONSENTIMIENTO
        </a>
      </div>
      <label>IPF Consentimiento firmado <span class="req">*</span></label>
      <div class="upload-zone ${state.ipfConsentName?'done':''}" id="ipfConsentZone">
        <input type="file" accept="image/*,.pdf" onchange="handleFile(this,'ipfConsent')">
        ${state.ipfConsentName
          ? `<div class="icon"><i class=yl-i-check></i></div><div class="fname">${state.ipfConsentName}</div><div class="txt">Click para cambiar</div>`
          : `<div class="icon"><i class=yl-i-lista></i></div><div class="txt">Sube el formulario IPF completado y firmado</div><div style="font-size:10px;color:var(--muted);margin-top:4px">PDF o imagen · Máx 10MB</div>`}
      </div>
    </div>
    <div class="field">
      <label>Concentración de notas <span class="req">*</span></label>
      <div class="upload-zone ${state.notasName?'done':''}" id="notasZone">
        <input type="file" accept="image/*,.pdf" onchange="handleFile(this,'notas')">
        ${state.notasName
          ? `<div class="icon"><i class=yl-i-check></i></div><div class="fname">${state.notasName}</div><div class="txt">Click para cambiar</div>`
          : `<div class="icon"><i class=yl-i-archivo></i></div><div class="txt">Documento oficial de notas / certificado académico</div><div style="font-size:10px;color:var(--muted);margin-top:4px">PDF o imagen · Máx 10MB</div>`}
      </div>
    </div>
    ` : ''}
    ${/* El bloque aparece por la FECHA, no por si ya declaró: si desapareciera al
          marcar la casilla, no habría forma de desmarcarla y volver atrás. */''}
    ${!isIPFWorld && isMinor(f.fechaNac) ? `
    <div class="field">
      ${requiereConsentimientoMenor(f.fechaNac) ? `
      <div style="background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.35);border-radius:10px;padding:14px 16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:4px"><i class=yl-i-alerta></i> Atleta menor de edad</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">El padre, madre o tutor legal debe completar y firmar el formulario de consentimiento de responsabilidad.</div>
        <a href="consentimiento_menores.pdf" download style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:8px 14px;background:rgba(212,168,67,.15);border:1px solid rgba(212,168,67,.5);border-radius:6px;color:var(--gold);font-size:12px;font-weight:600;text-decoration:none;font-family:Oswald,sans-serif;letter-spacing:1px">
          DESCARGAR FORMULARIO PDF
        </a>
      </div>
      <label>Consentimiento de Responsabilidad (firmado) <span class="req">*</span></label>
      <div class="upload-zone ${state.consentimientoName?'done':''}" id="consentimientoZone">
        <input type="file" accept="image/*,.pdf" onchange="handleFile(this,'consentimiento')">
        ${state.consentimientoName
          ? `<div class="icon"><i class=yl-i-check></i></div><div class="fname">${state.consentimientoName}</div><div class="txt">Click para cambiar</div>`
          : `<div class="icon"><i class=yl-i-lista></i></div><div class="txt">Sube el formulario completado y firmado</div><div style="font-size:10px;color:var(--muted);margin-top:4px">Foto o PDF del documento firmado · Máx 10MB</div>`}
      </div>` : ''}
      ${_declaraMayorHtml()}
    </div>` : ''}
    ${(()=>{
      // En IPF Worlds la foto blanca ya se pidió arriba, no duplicar
      if(isIPFWorld) return '';
      const ev = EVENTS.find(e=>e.id===f.evento);
      const requiere = ev?.requiereFoto;
      const yaTiene = window.atletaTieneFoto && window.atletaTieneFoto(f.rut);
      if(!requiere) return '';
      if(yaTiene){
        // Ya tiene foto aprobada → mostramos confirmación, no se pide otra
        return `
        <div class="field">
          <label>Foto tipo Carnet</label>
          <div style="display:flex;align-items:center;gap:10px;padding:14px;background:rgba(34,197,94,.08);border:1px solid var(--green);border-radius:8px">
            <span style="font-size:22px"><i class=yl-i-check></i></span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:var(--green)">Foto ya cargada</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">El sistema usará la foto que tienes en tu perfil. No necesitas subir otra. Si quieres cambiarla, contacta al admin.</div>
            </div>
          </div>
        </div>`;
      }
      // No tiene foto → pedir la foto normalmente
      return `
      <div class="field">
        <label>Foto tipo Carnet (fondo blanco) <span class="req">*</span></label>
        <div class="upload-zone ${state.carnetPhotoName?'done':''}" id="carnetPhotoZone">
          <input type="file" accept="image/*" onchange="handleFile(this,'carnetPhoto')">
          ${state.carnetPhotoName ? `<div class="icon"><i class=yl-i-check></i></div><div class="fname">${state.carnetPhotoName}</div><div class="txt">Click para cambiar</div>` : `<div class="icon"><i class=yl-i-camara></i></div><div class="txt">Foto de rostro con fondo blanco (tipo carnet)</div><div style="font-size:10px;color:var(--muted);margin-top:4px">JPG, PNG · Máx 10MB</div>`}
        </div>
      </div>`;
    })()}
    
    <!-- Summary -->
    <div style="background:var(--bg);border-radius:10px;padding:16px;margin-top:16px;border:1px solid var(--border)">
      <h4 class="os" style="font-size:13px;letter-spacing:1px;color:var(--gold);margin-bottom:10px">RESUMEN DE INSCRIPCIÓN</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <div><span style="color:var(--muted)">Evento:</span> <strong>${EVENTS.find(e=>e.id===f.evento)?.name||''}</strong></div>
        <div><span style="color:var(--muted)">Atleta:</span> <strong>${f.nombre}</strong></div>
        <div><span style="color:var(--muted)">RUT:</span> ${f.rut}</div>
        <div><span style="color:var(--muted)">Club:</span> ${f.club==='Otro'?f.clubOtro:f.club}</div>
        <div><span style="color:var(--muted)">División:</span> ${f.division}</div>
        <div><span style="color:var(--muted)">Categoría:</span> ${f.categoria}</div>
        <div><span style="color:var(--muted)">Modalidad:</span> ${f.modalidad}</div>
        <div><span style="color:var(--muted)">${isIPFWorld?'Pasaporte':'Carnet'}:</span> ${state.carnetName?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>
        <div><span style="color:var(--muted)">${isIPFWorld?'WADA Internacional':'WADA/ADEL'}:</span> ${state.wadeName?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>
        ${_oeDocsAparte(_evObj).map(d=>`<div><span style="color:var(--muted)">${d.meta.label}:</span> ${state[d.meta.nameKey]?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>`).join('')}
        ${isIPFWorld?`
          <div><span style="color:var(--muted)">Foto fondo blanco:</span> ${state.carnetPhotoName?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>
          <div><span style="color:var(--muted)">IPF Consentimiento:</span> ${state.ipfConsentName?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>
          <div><span style="color:var(--muted)">Concentración de notas:</span> ${state.notasName?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>
        `:''}
        ${!isIPFWorld && requiereConsentimientoMenor(f.fechaNac)?`<div><span style="color:var(--muted)">Consentimiento:</span> ${state.consentimientoName?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>`:''}

        ${(()=>{
          if(isIPFWorld) return ''; // ya cubierto arriba
          const requiere = EVENTS.find(e=>e.id===f.evento)?.requiereFoto;
          if(!requiere) return '';
          const yaTiene = window.atletaTieneFoto && window.atletaTieneFoto(f.rut);
          if(yaTiene) return '<div><span style="color:var(--muted)">Foto carnet:</span> <i class=yl-i-check></i> (perfil)</div>';
          return `<div><span style="color:var(--muted)">Foto carnet:</span> ${state.carnetPhotoName?'<i class=yl-i-check></i>':'<i class=yl-i-cruz></i> Falta'}</div>`;
        })()}
      </div>
    </div>

    <label style="display:flex;align-items:flex-start;gap:10px;margin-top:18px;cursor:pointer;padding:12px;background:rgba(212,168,67,.06);border:1px solid rgba(212,168,67,.2);border-radius:8px">
      <input type="checkbox" id="privacyChkLeg" onchange="state.privacyConsent=this.checked;render()" ${state.privacyConsent?'checked':''} style="margin-top:2px;width:16px;height:16px;accent-color:#D4A843;flex-shrink:0">
      <span style="font-size:12px;color:rgba(180,200,230,.8);line-height:1.6">He leído y acepto la <span onclick="event.preventDefault();(window.parent&&window.parent.sv?window.parent.sv('terminos'):window.open('./'))" style="color:#D4A843;cursor:pointer;text-decoration:underline">Política de Privacidad</span> de FECHIPO. Autorizo el tratamiento de mis datos personales para la gestión de competencias de powerlifting, conforme a la Ley N° 19.628 y Ley N° 21.719.</span>
    </label>
    <div style="display:flex;justify-content:space-between;margin-top:14px">
      <button class="btn btn-outline" onclick="prevStep()">← Atrás</button>
      <button class="btn btn-green" onclick="submitForm()" ${(()=>{
        if(!state.privacyConsent) return 'disabled';
        if(!state.carnetName) return 'disabled';
        if(!state.wadeName) return 'disabled';
        if(state.submitting) return 'disabled';
        if(_oeFaltan(_evObj).length) return 'disabled';
        if(isIPFWorld){
          if(!state.carnetPhotoName) return 'disabled';
          if(!state.ipfConsentName) return 'disabled';
          if(!state.notasName) return 'disabled';
        } else {
          if(requiereConsentimientoMenor(f.fechaNac) && !state.consentimientoName) return 'disabled';
          const requiere = EVENTS.find(e=>e.id===f.evento)?.requiereFoto;
          if(requiere){
            const yaTiene = window.atletaTieneFoto && window.atletaTieneFoto(f.rut);
            if(!yaTiene && !state.carnetPhotoName) return 'disabled';
          }
        }
        return '';
      })()}>${state.submitting?'<span class="sp"></span> Enviando...':'<i class=yl-i-check></i> Enviar Inscripción'}</button>
    </div></div>`;
    } // cierre else (legacy docs)
  }

  h += `</div>`;
  return h;
}

function renderConfirm() {
  return `<div class="fade" style="max-width:500px;margin:60px auto;text-align:center">
    <div style="font-size:64px;margin-bottom:16px"><i class=yl-i-check></i></div>
    <h2 class="os" style="font-size:28px;letter-spacing:2px;color:var(--green)">INSCRIPCIÓN ENVIADA</h2>
    <p style="color:var(--muted);margin-top:12px;font-size:14px;line-height:1.6">
      Tu inscripción ha sido recibida exitosamente.<br>
      Será revisada por el equipo de FECHIPO y aparecerá en la nómina oficial una vez aprobada.
    </p>
    ${state.storageWarning ? `<div class="alert" style="margin-top:16px;text-align:left;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#f59e0b">
      <i class=yl-i-alerta></i> <strong>Documentos pendientes</strong><br>
      <span style="font-size:12px">Tu inscripción quedó registrada pero los archivos no pudieron subirse. Envía tu carnet y certificado ADEL/WADA por WhatsApp o correo a FECHIPO para completar el proceso.</span>
    </div>` : ''}
    <div class="alert alert-info" style="margin-top:16px;text-align:left">
      <i class=yl-i-llave></i> <strong>Tu PIN de edición es: ${state.form.pin}</strong><br>
      <span style="font-size:12px">Guárdalo para poder modificar tu inscripción después. Lo necesitarás junto con tu RUT.</span>
    </div>
    <div class="card" style="margin-top:16px;text-align:left">
      <div style="font-size:12px;display:grid;gap:8px">
        <div><span style="color:var(--muted)">Atleta:</span> <strong>${state.form.nombre}</strong></div>
        <div><span style="color:var(--muted)">Evento:</span> ${EVENTS.find(e=>e.id===state.form.evento)?.name}</div>
        <div><span style="color:var(--muted)">Categoría:</span> ${state.form.categoria} · ${state.form.division}</div>
      </div>
    </div>
    <div style="margin-top:24px;display:flex;gap:10px;justify-content:center">
      <button class="btn btn-accent" onclick="resetForm()">Nueva Inscripción</button>
      <a href="index.html" class="btn btn-outline" style="text-decoration:none">Ver Base de Datos</a>
    </div>
  </div>`;
}

// ¿Le corresponde el consentimiento del tutor?
//
// Acá se mira la EDAD REAL al día en que se inscribe, no el año de nacimiento.
// Es un papel legal: lo firma el tutor de quien todavía no cumple 18. El que ya
// los cumplió firma por sí mismo, aunque haya nacido el mismo año que un menor.
//
// Ojo con no confundirlo con la división de edad, que sí va por año calendario
// (ver compartido/divisiones.js): alguien nacido en 2008 puede ser Sub Junior durante
// todo 2026 y, desde el día que cumple 18, ya no necesitar este consentimiento.
// Son dos cuentas distintas a propósito.
//
// Se cuenta contra la fecha de hoy, así que un mismo atleta deja de verlo solo,
// el día de su cumpleaños, sin que nadie toque nada.
function isMinor(fechaNac) {
  const edad = _edadHoy(fechaNac);
  if (edad === null) return false;   // sin fecha no se puede saber; el campo es obligatorio antes de este paso
  return edad < 18;
}

// ¿Hay que pedirle el consentimiento, de verdad?
//
// La cuenta de arriba depende de una fecha, y la fecha puede estar mal: se
// autocompleta desde la base de atletas y ahí hay datos viejos, cargados a mano
// y hasta fechas de relleno. Cuando eso pasa, a un adulto se le pide un papel
// que no existe y su inscripción queda trabada un domingo a las once de la
// noche, sin nadie a quien preguntarle.
//
// Por eso hay una salida: el atleta declara que ya es mayor de edad y sigue. La
// declaración queda anotada en la inscripción y la Comisión Técnica la revisa
// contra el carnet, que es quien tiene que decidirlo. Vale más eso que dejar a
// alguien fuera por un dato mal escrito.
function requiereConsentimientoMenor(fechaNac) {
  if (typeof state !== 'undefined' && state && state.declaraMayor) return false;
  return isMinor(fechaNac);
}

// El bloque con la salida. Se muestra pegado al documento, que es donde la
// persona se está trabando.
function _declaraMayorHtml() {
  const f = (state && state.form) || {};
  const p = _partesFecha(f.fechaNac);
  const legible = p ? `${String(p.dia).padStart(2,'0')}/${String(p.mes).padStart(2,'0')}/${p.anio}` : '';
  // Ojo con el estilo: dentro de .field, la hoja de estilos pone las etiquetas en
  // mayúsculas y en Oswald chico. Sirve para "CARNET DE IDENTIDAD", pero acá hay
  // un párrafo entero y quedaba ilegible, así que se vuelve al texto normal.
  return `<label style="display:flex;align-items:flex-start;gap:10px;margin-top:10px;cursor:pointer;padding:12px 14px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.3);border-radius:8px;text-transform:none;letter-spacing:0;font-family:'Source Sans 3',sans-serif;font-size:12px;margin-bottom:0">
    <input type="checkbox" ${state.declaraMayor?'checked':''} onchange="state.declaraMayor=this.checked;render()" style="margin-top:2px;width:16px;height:16px;accent-color:#60a5fa;flex-shrink:0">
    <span style="font-size:12px;color:rgba(180,200,230,.85);line-height:1.6">
      <b style="color:#60a5fa">¿Ya eres mayor de edad?</b>
      ${legible?`Nos figura que naciste el <b>${legible}</b>, y por eso te pedimos este documento.`:''}
      Si esa fecha está equivocada, marca esta casilla y continúa sin subirlo:
      declaras que ya cumpliste 18 años. Queda registrado en tu inscripción y la
      Comisión Técnica lo revisa con tu carnet. Corrige igual tu fecha en el paso
      de datos personales si puedes.
    </span>
  </label>`;
}

// La edad cumplida hoy. Devuelve null si la fecha no se entiende.
// Acepta yyyy-mm-dd (el input de fecha) y dd/mm/yyyy (como viene de la base).
function _edadHoy(fechaNac) {
  const p = _partesFecha(fechaNac);
  if (!p) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - p.anio;
  // Si todavía no llega su cumpleaños este año, le falta un año por cumplir.
  const mesHoy = hoy.getMonth() + 1, diaHoy = hoy.getDate();
  if (mesHoy < p.mes || (mesHoy === p.mes && diaHoy < p.dia)) edad--;
  return edad;
}

function _partesFecha(fechaNac) {
  const s = String(fechaNac || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { anio: +m[1], mes: +m[2], dia: +m[3] };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { anio: +m[3], mes: +m[2], dia: +m[1] };
  return null;
}

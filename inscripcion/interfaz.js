// inscripcion.html — el formulario en pantalla: el dibujo (render), los pasos y los cambios de cada campo.
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

// ══════════════════════════════════════════════
// HTML escape helper — defensa contra XSS en innerHTML
// ══════════════════════════════════════════════
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Sanitiza un string para guardar en DB: elimina caracteres HTML peligrosos
// y colapsa espacios. No reemplaza a esc() al renderizar; es defensa en capas.
function sanitizeInput(s) {
  if (s == null) return '';
  return String(s).replace(/[<>"'`]/g,'').replace(/\s+/g,' ').trim();
}

// Admin auth: handled by Firebase Auth + admins/{uid} doc (see initFirebase)

// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════
function render() {
  const app = document.getElementById('app');
  if (state.view === 'admin') { app.innerHTML = renderAdmin(); return; }
  if (state.view === 'confirm') { app.innerHTML = renderConfirm(); return; }
  if (state.view === 'edit_lookup') { app.innerHTML = renderEditLookup(); return; }
  if (state.view === 'edit') { app.innerHTML = renderEdit(); return; }
  app.innerHTML = renderForm();
}

// ══════════════════════════════════════════════
// HANDLERS
// ══════════════════════════════════════════════
function upd(key, val) {
  state.form[key] = val;
  if (key === 'rut') cargarDatosDeRut(val);
  // Actualiza el botón Siguiente sin re-renderizar (evita perder foco)
  _refreshStep1Btn();
}

function _refreshStep1Btn() {
  if (state.step !== 1) return;
  const btn = document.getElementById('step1NextBtn');
  if (!btn) return;
  const f = state.form;
  btn.disabled = !(f.nombre && f.rut && f.sexo && f.fechaNac && f.club && f.comuna && f.pin && f.pin.length === 4);
}

function updR(key, val) { state.form[key] = val; render(); _refreshStep1Btn(); }

// Parsea números con coma O punto decimal (locale chileno usa coma). Evita que "270,5" se lea como 0.
function _numCL(v) { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }

// Suma automática del total del Nacional (SQ+BP+DL) sin re-renderizar (no pierde foco).
function nacTotal() {
  const f = state.form;
  const t = _numCL(f.posNacSQ)+_numCL(f.posNacBP)+_numCL(f.posNacDL);
  f.posNacTotal = t>0 ? String(t) : '';
  const el = document.getElementById('nacTotalField');
  if (el) el.value = f.posNacTotal;
}

function selectEvent(id) { state.form.evento = id; render(); }

function nextStep() {
  state.error = '';
  // Validate current step
  const f = state.form;
  if (state.step === 0 && !f.evento) { state.error = 'Selecciona un evento'; render(); return; }
  if (state.step === 1) {
    if (!f.nombre || !f.rut || !f.sexo || !f.fechaNac || !f.club || !f.comuna || !f.pin || f.pin.length !== 4) { state.error = 'Completa todos los campos obligatorios (incluye ciudad/región y PIN de 4 dígitos)'; render(); return; }
    if (!validateRut(f.rut).valid) { state.error = 'RUT inválido: ' + validateRut(f.rut).msg; render(); return; }
  }
  if (state.step === 2) {
    if (!f.division || !f.categoria || !f.modalidad) { state.error = 'Completa todos los campos obligatorios'; render(); return; }
  }
  state.step = Math.min(state.step + 1, 3);
  render();
  window.scrollTo(0, 0);
}

function prevStep() { state.step = Math.max(state.step - 1, 0); render(); window.scrollTo(0, 0); }

// inscripcion.html — la vista de administración dentro del formulario.
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

function renderAdmin() {
  if (!state.adminAuth) {
    return `<div class="fade" style="max-width:400px;margin:80px auto;text-align:center">
      <h2 class="os" style="font-size:22px;letter-spacing:2px;margin-bottom:20px"><i class=yl-i-candado></i> PANEL ADMIN</h2>
      <div class="field"><label>Email</label>
        <input class="input" type="email" id="adminEmail" placeholder="admin@yourlift.cl" autocomplete="email">
      </div>
      <div class="field"><label>Contraseña</label>
        <input class="input" type="password" id="adminPass" autocomplete="current-password" onkeydown="if(event.key==='Enter')authAdmin()">
      </div>
      ${state.error ? `<div class="alert alert-error" style="margin:8px 0">${state.error}</div>` : ''}
      <button class="btn btn-accent" onclick="authAdmin()">Acceder</button>
      <div style="margin-top:12px"><button class="btn btn-outline" onclick="state.view='form';state.error='';render()" style="font-size:11px">← Volver al formulario</button></div>
    </div>`;
  }

  const ins = state.inscripciones;
  const filtered = ins.filter(i => {
    if (state.adminFilter !== 'all' && i.status !== state.adminFilter) return false;
    if (state.adminEvent && i.evento !== state.adminEvent) return false;
    return true;
  });
  const pending = ins.filter(i=>i.status==='pending').length;
  const approved = ins.filter(i=>i.status==='approved').length;

  let h = `<div class="fade" style="margin-top:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <h2 class="os" style="font-size:22px;letter-spacing:1px">PANEL DE INSCRIPCIONES</h2>
        <p style="font-size:12px;color:var(--muted)">${ins.length} total · ${pending} pendientes · ${approved} aprobados</p>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-green" onclick="exportNominas()" style="padding:8px 14px;font-size:11px"><i class=yl-i-bajar></i> Exportar Nóminas</button>
        <span id="adminLiveStatus" style="font-size:10px;padding:4px 10px;border-radius:6px;border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.08);color:var(--green);"><i class=yl-i-punto></i> EN VIVO</span><button class="btn btn-green" onclick="approveAllPending()" style="padding:8px 14px;font-size:11px"><i class=yl-i-check></i> Aprobar pendientes</button>
      </div>
    </div>`;

  // Stats cards
  h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
    ${[['Pendientes',pending,'var(--gold)'],['Aprobados',approved,'var(--green)'],['Total',ins.length,'var(--blue)']].map(([l,v,c]) => 
      `<div class="card" style="text-align:center;padding:14px"><div class="os" style="font-size:24px;color:${c};font-weight:700">${v}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-top:2px">${l}</div></div>`
    ).join('')}
  </div>`;

  // Filters
  h += `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
    ${[['all','Todos'],['pending','Pendientes'],['approved','Aprobados'],['rejected','Rechazados']].map(([k,l]) => 
      `<button class="btn ${state.adminFilter===k?'btn-accent':'btn-outline'}" onclick="state.adminFilter='${k}';render()" style="padding:6px 12px;font-size:11px">${l}</button>`
    ).join('')}
    <select class="input" style="width:auto;padding:6px 10px;font-size:11px" onchange="state.adminEvent=this.value;render()">
      <option value="">Todos los eventos</option>
      ${EVENTS.map(e => `<option value="${e.id}" ${state.adminEvent===e.id?'selected':''}>${e.name}</option>`).join('')}
    </select>
  </div>`;

  // Table
  if (filtered.length === 0) {
    h += `<div class="card" style="text-align:center;padding:40px;color:var(--muted)">No hay inscripciones ${state.adminFilter!=='all'?state.adminFilter:''}</div>`;
  } else {
    h += `<div class="card" style="padding:0;overflow-x:auto"><table class="tbl">
      <thead><tr><th>#</th><th>Atleta</th><th>RUT</th><th>Evento</th><th>Cat.</th><th>Club</th><th>Docs</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>`;
    filtered.forEach((i, idx) => {
      const evName = EVENTS.find(e=>e.id===i.evento)?.name || i.evento;
      const safeId = encodeURIComponent(i.id);
      h += `<tr>
        <td style="color:var(--muted)">${idx+1}</td>
        <td style="font-weight:600;white-space:nowrap">${esc(i.nombre)}</td>
        <td style="font-size:11px">${esc(i.rut)}</td>
        <td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(evName)}</td>
        <td><span class="tag" style="background:rgba(212,168,67,.12);color:var(--gold)">${esc(i.categoria)}</span></td>
        <td style="font-size:11px">${esc(i.club==='Otro'?i.clubOtro:i.club)}</td>
        <td>${i.carnetName?'<i class=yl-i-camara></i>':'<i class=yl-i-cruz></i>'} ${i.wadeName?'<i class=yl-i-archivo></i>':''}</td>
        <td><span class="status-${esc(i.status)}" style="font-weight:700;font-size:11px;text-transform:uppercase">${i.status==='pending'?'<i class=yl-i-espera></i> Pendiente':i.status==='approved'?'<i class=yl-i-check></i> Aprobado':'<i class=yl-i-cruz></i> Rechazado'}</span></td>
        <td style="white-space:nowrap">
          ${i.status!=='approved'?`<button class="btn btn-green" style="padding:4px 8px;font-size:10px" onclick="updateStatus('${safeId}','approved')"><i class=yl-i-check></i></button>`:''}
          ${i.status!=='rejected'?`<button class="btn" style="padding:4px 8px;font-size:10px;background:var(--red);color:#fff" onclick="updateStatus('${safeId}','rejected')"><i class=yl-i-cruz></i></button>`:''}
          ${i.status!=='pending'?`<button class="btn btn-outline" style="padding:4px 8px;font-size:10px" onclick="updateStatus('${safeId}','pending')">↺</button>`:''}
        </td>
      </tr>`;
    });
    h += `</tbody></table></div>`;
  }
  
  h += `</div>`;
  return h;
}

async function authAdmin() {
  const email = (document.getElementById('adminEmail')?.value || '').trim();
  const pass = document.getElementById('adminPass')?.value || '';
  state.error = '';
  if (!email || !pass) { state.error = 'Completa email y contraseña'; render(); return; }
  if (!firebaseReady || !authInstance) { state.error = 'Firebase no disponible'; render(); return; }
  try {
    await window.FB.signInWithEmailAndPassword(authInstance, email, pass);
    // onAuthStateChanged handler verifies admins/{uid} and sets state.adminAuth
  } catch(e) {
    let msg = 'Error: ' + e.message;
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') msg = 'Email o contraseña incorrectos';
    else if (e.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Espera unos minutos.';
    state.error = msg;
    render();
  }
}

async function loadInscripciones() {
  if (firebaseReady) {
    try {
      // Start real-time listener if not already running
      if (!window._adminListener) {
        const q = window.FB.query(window.FB.collection(db, 'inscripciones'), window.FB.orderBy('timestamp', 'desc'));
        window._adminListener = window.FB.onSnapshot(q, (snap) => {
          state.inscripciones = snap.docs.map(d => ({id: d.id, ...d.data()}));
          // Only re-render if admin panel is visible
          if (state.view === 'admin') render();
        });
      }
      // Also do an immediate fetch for first load
      const q = window.FB.query(window.FB.collection(db, 'inscripciones'), window.FB.orderBy('timestamp', 'desc'));
      const snap = await window.FB.getDocs(q);
      state.inscripciones = snap.docs.map(d => ({id: d.id, ...d.data()}));
    } catch(e) { console.error(e); }
  } else {
    state.inscripciones = demoGetAll().reverse();
  }
  render();
}

async function approveAllPending() {
  const pending = state.inscripciones.filter(i => i.status === 'pending');
  if (!pending.length) { alert('No hay inscripciones pendientes'); return; }
  if (!confirm(`¿Aprobar ${pending.length} inscripción${pending.length !== 1 ? 'es' : ''} pendiente${pending.length !== 1 ? 's' : ''}?`)) return;
  if (firebaseReady) {
    try {
      await Promise.all(pending.map(i =>
        window.FB.updateDoc(window.FB.doc(db, 'inscripciones', i.id), {status: 'approved'})
      ));
      // listener will auto-update state.inscripciones
    } catch(e) { console.error(e); alert('Error: ' + e.message); }
  } else {
    pending.forEach(i => demoUpdate(i.id, {status: 'approved'}));
    state.inscripciones = demoGetAll().reverse();
    render();
  }
}

async function updateStatus(id, newStatus) {
  const realId = decodeURIComponent(id);
  if (firebaseReady) {
    try {
      await window.FB.updateDoc(window.FB.doc(db, 'inscripciones', realId), {status: newStatus});
    } catch(e) { console.error(e); }
  } else {
    demoUpdate(realId, {status: newStatus});
  }
  await loadInscripciones();
}

function exportNominas() {
  const approved = state.inscripciones.filter(i => i.status === 'approved');
  const byEvent = {};
  approved.forEach(i => {
    if (!byEvent[i.evento]) byEvent[i.evento] = [];
    byEvent[i.evento].push({
      nombre: i.nombre,
      rut: i.rut,
      sexo: i.sexo,
      dob: i.fechaNac,
      division: i.division,
      categoria: i.categoria,
      modalidad: i.modalidad,
      club: i.club === 'Otro' ? i.clubOtro : i.club,
      universidad: i.universidad || '',
    });
  });

  // Generate nominas.json format
  const nominas = { events: EVENTS.map(ev => ({
    name: ev.name,
    short: ev.name.replace('Campeonato ','').replace('Primer ',''),
    date: ev.date,
    closeDate: ev.closeDate,
    location: ev.location,
    organizer: ev.org,
    days: ev.date.split('-').reverse().join(' de '),
    athletes: byEvent[ev.id] || byEvent[ev.name] || [],
    extraCols: ev.id.includes('universitario') ? ['universidad'] : ['modalidad'],
  }))};

  const blob = new Blob([JSON.stringify(nominas, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nominas.json';
  link.click();
  URL.revokeObjectURL(url);
}

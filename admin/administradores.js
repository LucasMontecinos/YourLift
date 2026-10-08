// admin.html — Las cuentas de administración.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

 // cache

async function loadAdminsList(){
  try{
    // Las cuentas viven en dos colecciones: admins/ y jueces/. La lista las
    // muestra juntas, pero cada una lleva de dónde salió para poder revocarla
    // en la colección correcta.
    const [snap,snapJ] = await Promise.all([
      getDocs(collection(db,'admins')),
      getDocs(collection(db,'jueces')).catch(()=>({docs:[]})),
    ]);
    _adminsList = snap.docs.map(d=>({uid:d.id,col:'admins',...d.data()}))
      .concat(snapJ.docs.map(d=>({uid:d.id,col:'jueces',...d.data(),role:'juez'})));
  }catch(e){console.warn('loadAdminsList error',e);}
}

function renderAdmins(){
  const isSuperAdmin = ST.adminInfo?.role==='superadmin'||ST.adminInfo?.role==='owner'||ST.adminInfo?.bootstrap;
  if(!isSuperAdmin) return '<div class="h1">Sin acceso</div><p class="subtitle">Solo el owner puede gestionar cuentas.</p>';

  const form = ST.adminForm||{};

  return `
  <div class="h1">Gestión de Administradores</div>
  <p class="subtitle">Crea y gestiona las cuentas que pueden acceder a este panel. <b>Desactivar</b> le cierra el acceso sin borrar la cuenta: se vuelve a activar con el mismo rol. <b>Revocar</b> la saca de la lista.</p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">

    <!-- Create new admin -->
    <div class="card">
      <div class="h2">Nuevo administrador</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
        <label style="font-size:11px;color:var(--muted)">Nombre completo
          <input class="inp" id="naNombre" placeholder="Nombre Apellido" value="${form.nombre||''}" style="margin-top:4px">
        </label>
        <label style="font-size:11px;color:var(--muted)">Correo electrónico
          <input class="inp" id="naEmail" type="email" placeholder="correo@ejemplo.cl" value="${form.email||''}" style="margin-top:4px">
        </label>
        <label style="font-size:11px;color:var(--muted)">Contraseña (mín. 6 caracteres)
          <input class="inp" id="naPass" type="password" placeholder="Contraseña segura" style="margin-top:4px">
        </label>
        <label style="font-size:11px;color:var(--muted)">Rol
          <select class="inp" id="naRole" style="margin-top:4px">
            <option value="admin">Admin — acceso completo al panel</option>
            <option value="superadmin">Superadmin — acceso completo al panel</option>
            <option value="mesa">Mesa técnica — solo YourLift, con la competencia completa</option>
            <option value="streaming">Streaming — solo YourLift, únicamente pantallas de transmisión</option>
            <option value="transmision">Transmisión — en YourLift no entra a Control en Vivo</option>
            <option value="juez">Luces jueces — SOLO yourlift.cl/jueces, no entra a ningún panel</option>
          </select>
          <div style="font-size:10px;color:var(--muted);margin-top:3px"><b>Juez</b> es la única cuenta realmente cerrada: no se guarda entre los admins, así que este panel y el control en vivo la rechazan. Lo único que puede hacer es marcar su luz en <b>yourlift.cl/jueces</b> y arrancar el cronómetro. Es la que va en los teléfonos de los jueces — si queda una sesión abierta, no da acceso a nada más.<br><b>Mesa técnica</b>: la que corre el campeonato. En este panel solo ve el acceso a YourLift, y adentro tiene lo mismo que un admin — Atletas y Pesaje, Control en Vivo, Documentos, Resultados y actas. Lo que no ve es el resto del panel: nóminas, base de atletas y configuración.<br><b>Streaming</b>: en este panel solo ve el acceso a YourLift, y adentro solo Control TX, Control Remoto, Transmisión, Widgets OBS y Pantalla de Tarima.<br>Transmisión es un rol solo de YourLift — en este panel tiene el mismo acceso que "Admin".<br><b>Ojo con las tres de arriba:</b> se guardan entre los admins, así que el rol esconde botones pero no cierra la base de datos. En un computador compartido, cierra la sesión al terminar.</div>
        </label>
        <div id="naError" style="color:var(--red);font-size:12px;display:none"></div>
        <button class="btn btn-g" onclick="createAdmin()" style="margin-top:4px">Crear cuenta</button>
      </div>
    </div>

    <!-- Existing admins -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div class="h2">Cuentas</div>
          ${_adminsList.length?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${_adminsList.filter(a=>!a.disabled).length} activas${_adminsList.some(a=>a.disabled)?' · '+_adminsList.filter(a=>a.disabled).length+' desactivadas':''}</div>`:''}
        </div>
        <button class="btn" onclick="refreshAdmins()" style="padding:6px 12px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--muted)">↻ Recargar</button>
      </div>
      ${_adminsList.length===0
        ? '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Cargando...</div>'
        : _adminsList.map(a=>`
          <div class="adm-cuenta${a.disabled?' adm-off':''}" data-uid="${a.uid}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(29,49,80,.3)">
            <div style="${a.disabled?'opacity:.55':''}">
              <div style="font-weight:600;font-size:13px">${a.nombre||a.email||a.uid}${a.disabled?' <span class="adm-estado" style="font-size:10px;font-weight:700;letter-spacing:.5px;padding:2px 7px;border-radius:4px;background:rgba(239,68,68,.15);color:var(--red);vertical-align:middle">DESACTIVADA</span>':''}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${a.email||'—'}</div>
              <span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${a.role==='superadmin'?'rgba(196,30,58,.15)':(a.col==='jueces'?'rgba(34,197,94,.15)':'rgba(59,130,246,.15)')};color:${a.role==='superadmin'?'var(--accent)':(a.col==='jueces'?'var(--green)':'var(--blue)')}">${a.role||'admin'}${a.col==='jueces'?' · solo luces':''}${a.bootstrap?' ':''}</span>
              ${a.col!=='jueces'&&a.role==='juez'
                ? `<div style="font-size:10px;color:var(--red);margin-top:4px;line-height:1.4"><i class=yl-i-alerta></i> Cuenta de juez guardada entre los admins: para Firestore tiene acceso completo. Revocala y creala de nuevo como "Juez" para que quede cerrada.</div>`
                : ''}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              ${a.uid!==ST.user?.uid
                ? `<button class="adm-activar" onclick="toggleAdminActivo('${a.uid}','${a.col||'admins'}',${a.disabled?'true':'false'})" style="padding:4px 10px;border-radius:6px;border:1px solid ${a.disabled?'rgba(34,197,94,.45)':'rgba(212,168,67,.45)'};background:transparent;color:${a.disabled?'var(--green)':'var(--gold)'};font-size:11px;cursor:pointer">${a.disabled?'Activar':'Desactivar'}</button>
                   <button onclick="revokeAdmin('${a.uid}','${(a.nombre||a.email||'').replace(/'/g,"\\'")}','${a.col||'admins'}')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:transparent;color:var(--red);font-size:11px;cursor:pointer">Revocar</button>`
                : '<span style="font-size:10px;color:var(--muted);padding:4px 8px">(tú)</span>'}
            </div>
          </div>`).join('')}
    </div>
  </div>

  <div class="card" style="background:rgba(212,168,67,.05);border-color:rgba(212,168,67,.3)">
    <div style="font-size:12px;color:var(--gold);font-family:Oswald;letter-spacing:1px;margin-bottom:6px">UID DEL SUPERADMIN ACTUAL</div>
    <div style="font-size:12px;color:var(--muted)">Tu UID: <code style="background:var(--bg);padding:2px 8px;border-radius:4px;color:var(--text)">${ST.user?.uid||'—'}</code></div>
    <div style="font-size:11px;color:var(--muted);margin-top:6px">Este UID también está en Firestore → colección <code>admins</code>. Si necesitas agregar otro admin manualmente, crea un documento con su UID como ID.</div>
  </div>`;
}

window.createAdmin = async function(){
  const nombre = document.getElementById('naNombre').value.trim();
  const email  = document.getElementById('naEmail').value.trim().toLowerCase();
  const pass   = document.getElementById('naPass').value;
  const role   = document.getElementById('naRole').value;
  const errEl  = document.getElementById('naError');
  errEl.style.display = 'none';

  if(!nombre||!email||!pass){ errEl.style.display='block'; errEl.textContent='Completa todos los campos'; return; }
  if(pass.length < 6){ errEl.style.display='block'; errEl.textContent='La contraseña debe tener al menos 6 caracteres'; return; }

  const btn = document.querySelector('#naError + button')||document.querySelector('[onclick="createAdmin()"]');
  if(btn){ btn.disabled=true; btn.textContent='Creando...'; }

  try{
    // Use secondary app instance so we don't log out the current superadmin
    const secondaryApp = initSecondaryApp(FB_CFG, 'admin_creator_'+Date.now());
    const {getAuth:getSecAuth, createUserWithEmailAndPassword:createSecUser} = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const secondaryAuth = getSecAuth(secondaryApp);

    const cred = await createSecUser(secondaryAuth, email, pass);
    const newUID = cred.user.uid;

    // Sign out from secondary immediately
    const {signOut:signOutSec,deleteUser} = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await signOutSec(secondaryAuth);

    // Los jueces NO van a admins/. Estar en admins/ es, para las reglas de
    // Firestore, acceso total: el rol solo esconde botones. Una cuenta de juez en
    // el teléfono de otra persona, o una sesión que quedó abierta después del
    // campeonato, sería un admin suelto. En jueces/ solo puede marcar su luz y
    // arrancar el cronómetro, y el panel de administración la rechaza solo.
    const esJuez = role==='juez';
    await setDoc(doc(db, esJuez?'jueces':'admins', newUID),{
      uid: newUID,
      email,
      nombre,
      role,
      createdBy: ST.user.email,
      createdAt: new Date().toISOString()
    });

    await logAction(esJuez?'create_juez':'create_admin', email, null, role, {nombre, createdBy:ST.user.email});
    showToast(esJuez
      ? 'Juez creado: '+nombre+' — solo puede marcar luces, no entra al panel'
      : 'Admin creado: '+nombre+' ('+email+')');

    // Clear form
    ST.adminForm = {};
    await refreshAdmins();

  }catch(e){
    errEl.style.display='block';
    if(e.code==='auth/email-already-in-use'){
      errEl.textContent = 'Ese correo ya tiene una cuenta en Firebase. Puedes agregarlo manualmente a Firestore con su UID.';
    } else {
      errEl.textContent = 'Error: '+e.message;
    }
    console.error('createAdmin error', e);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Crear cuenta'; }
  }
};

window.revokeAdmin = async function(uid, nombre, col){
  col = col==='jueces' ? 'jueces' : 'admins';
  const q = col==='jueces'
    ? '¿Revocar a '+nombre+' como juez?\nSu cuenta de Firebase se mantiene, pero sus luces dejan de llegar a la tarima.'
    : '¿Revocar acceso de admin a '+nombre+'?\nSu cuenta de Firebase se mantiene pero ya no podrá entrar al panel.';
  if(!confirm(q)) return;
  try{
    await deleteDoc(doc(db,col,uid));
    await logAction('revoke_admin', uid, nombre, 'revoked', {by:ST.user.email});
    showToast('Acceso revocado: '+nombre);
    await refreshAdmins();
  }catch(e){ showToast('Error: '+e.message, null, true); }
};

// Desactivar no borra nada: deja disabled:true en la ficha y las reglas de
// Firestore dejan de tratarla como admin (o como juez). Activar la devuelve tal
// cual estaba, con su rol. Si la persona tiene el panel abierto, la saca al
// instante (ver _vigilarCuentaPropia en arranque.js).
window.toggleAdminActivo = async function(uid, col, estabaDesactivada){
  col = col==='jueces' ? 'jueces' : 'admins';
  if(uid===ST.user?.uid){ showToast('No puedes desactivar tu propia cuenta', null, true); return; }
  const a = _adminsList.find(x=>x.uid===uid&&x.col===col) || {};
  const nombre = a.nombre||a.email||uid;
  const activar = !!estabaDesactivada;
  if(!activar && !confirm('¿Desactivar la cuenta de '+nombre+'?\n'
      +(col==='jueces'
        ? 'Sus luces dejan de llegar a la tarima hasta que la vuelvas a activar.'
        : 'No podrá entrar al panel ni al control en vivo hasta que la vuelvas a activar. Si lo tiene abierto, se le cierra.'))) return;
  try{
    await updateDoc(doc(db,col,uid), activar
      ? {disabled:false, enabledAt:new Date().toISOString(), enabledBy:ST.user.email}
      : {disabled:true, disabledAt:new Date().toISOString(), disabledBy:ST.user.email});
    await logAction(activar?'enable_admin':'disable_admin', uid, nombre, activar?'activa':'desactivada', {by:ST.user.email, col});
    showToast((activar?'Cuenta activada: ':'Cuenta desactivada: ')+nombre);
    await refreshAdmins();
  }catch(e){
    const negado = e && (e.code==='permission-denied' || /permission/i.test(e.message||''));
    showToast(negado ? 'Sin permiso: solo el owner puede activar o desactivar cuentas' : 'Error: '+e.message, null, true);
  }
};

window.refreshAdmins = async function(){
  await loadAdminsList();
  if(ST.view==='admins') render();
};

// admin.html — Entrar al panel: la sesión, el rol de cada cuenta y lo que puede ver.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

window.doLogin=async function(){
  const em=document.getElementById('lEm').value.trim();
  const pw=document.getElementById('lPw').value;
  const errEl=document.getElementById('loginErr');
  if(errEl){errEl.style.display='none';}
  if(!em||!pw){
    if(errEl){errEl.style.display='block';errEl.textContent='Completa email y contraseña';}
    return;
  }
  const btn=document.querySelector('[onclick*="doLogin"]');
  if(btn){btn.textContent='Ingresando...';btn.disabled=true;}
  try{
    await signInWithEmailAndPassword(auth,em,pw);
  }catch(e){
    console.error('[doLogin]',e.code,e.message);
    let msg='Error: '+e.message;
    if(e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'||e.code==='auth/user-not-found')msg='Email o contraseña incorrectos';
    else if(e.code==='auth/too-many-requests')msg='Demasiados intentos. Espera unos minutos.';
    else if(e.code==='auth/network-request-failed')msg='Sin conexión a internet';
    if(errEl){errEl.style.display='block';errEl.textContent=msg;}
  }finally{
    if(btn){btn.textContent='INGRESAR';btn.disabled=false;}
  }
}

window.doLogout=async function(){
  if(!confirm('¿Cerrar sesión?'))return;
  await signOut(auth);
  sessionStorage.removeItem('fechipo_admin_session');
  ST.user=null;ST.adminInfo=null;render();
}

// Crea una cuenta de entrenador: Firebase Auth user + doc coaches/{uid}.
// Usa una "secondary app" para no cerrar la sesión del admin actual.
// Uso desde la consola del navegador (tras login admin):
//   await createCoach('coach@yourlift.cl', 'Passw0rd!', 'Nombre Apellido', 'Nacional', '12345678')
window.createCoach=async function(email,password,nombre,grado,rut,extra){
  if(!ST.user) throw new Error('Debes estar autenticado como admin.');
  if(!email||!password||!nombre) throw new Error('email, password y nombre son obligatorios.');
  if(password.length<8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  const secondary=initSecondaryApp(FB_CFG,'coachCreate_'+Date.now());
  const secondaryAuth=getAuth(secondary);
  try{
    const cred=await createUserWithEmailAndPassword(secondaryAuth,email,password);
    const uid=cred.user.uid;
    await setDoc(doc(db,'coaches',uid),Object.assign({
      email:email.toLowerCase(),
      nombre,
      grado:grado||'',
      rut:rut||'',
      createdAt:serverTimestamp(),
      createdBy:ST.user.email
    },extra||{}));
    try{await signOut(secondaryAuth);}catch(_){}
    await logAction('coach_create','coaches/'+uid,null,{email,nombre,grado,rut});
    console.log('Coach creado:',email,'UID:',uid);
    return uid;
  }catch(e){
    console.error('createCoach falló:',e.code||'',e.message);
    throw e;
  }
}

// index.html — la página de inicio: próximos campeonatos, cuentas regresivas, términos y sugerencias.
//
// Parte del código de index.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

function cdStr(target){if(!target||target.includes("X"))return{d:null,h:null,m:null,done:false,unknown:true};const now=new Date(),t=new Date(target+"T00:00:00"),diff=t-now;if(isNaN(diff))return{d:null,h:null,m:null,done:false,unknown:true};if(diff<=0)return{d:0,h:0,m:0,done:true};const d=Math.floor(diff/864e5),h=Math.floor((diff%864e5)/36e5),m=Math.floor((diff%36e5)/6e4);return{d,h,m,done:false}}

// cdStrDT: igual pero acepta datetime-local 'YYYY-MM-DDTHH:MM' (para preNominaCloseAt)
function cdStrDT(target){if(!target)return{d:null,h:null,m:null,done:false,unknown:true};const now=new Date(),t=new Date(target);if(isNaN(t))return{d:null,h:null,m:null,done:false,unknown:true};const diff=t-now;if(diff<=0)return{d:0,h:0,m:0,done:true};const d=Math.floor(diff/864e5),h=Math.floor((diff%864e5)/36e5),m=Math.floor((diff%36e5)/6e4);return{d,h,m,done:false}}

async function enviarSugerencia(){
  const nombre=(document.getElementById('sgNombre')?.value||'').trim();
  const correo=(document.getElementById('sgCorreo')?.value||'').trim();
  const mensaje=(document.getElementById('sgMensaje')?.value||'').trim();
  const st=document.getElementById('sgStatus');
  if(!nombre||!correo||!mensaje){if(st)st.textContent='Por favor completa todos los campos.';return;}
  if(!window.FBQ||!fbDB){if(st)st.textContent='Error de conexión, intenta de nuevo.';return;}
  if(st)st.textContent='Enviando...';
  try{
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    await window.FBQ.setDoc(window.FBQ.doc(fbDB,'sugerencias',id),{nombre,correo,mensaje,fecha:window.FBQ.serverTimestamp()});
    if(st)st.innerHTML='<span style="color:#4caf50">¡Mensaje enviado! Gracias por escribirnos.</span>';
    document.getElementById('sgNombre').value='';
    document.getElementById('sgCorreo').value='';
    document.getElementById('sgMensaje').value='';
    setTimeout(()=>{document.getElementById('modalSugerencia').style.display='none';if(st)st.textContent='';},2200);
  }catch(e){if(st)st.textContent='Error al enviar: '+e.message;}
}

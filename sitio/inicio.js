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

// ── Líderes del ranking en la portada ─────────────────────────────────────
// El 1.º de cada categoría (división Open), uno tras otro: avanza solo cada
// 5 segundos, se puede elegir tocando la categoría y se detiene con el mouse
// encima. Los datos salen del mismo ranking publicado (ranking.html trae la
// tabla completa), así la portada no suma lecturas a Firestore.
//
// La portada se vuelve a dibujar seguido (cada dato que llega de Firebase), así
// que el estado vive acá afuera y _lideresHtml() lo pinta de nuevo tal cual.
var _LID={lista:null,i:0,t0:0,pausa:false,pedido:false};
var _LID_MS=5000;
var _LID_TABS={cl_f:'Classic Femenino',cl_m:'Classic Masculino',eq_f:'Equipado Femenino',eq_m:'Equipado Masculino',
  bench_cl_f:'Bench Classic Femenino',bench_cl_m:'Bench Classic Masculino',bench_eq_f:'Bench Equipado Femenino',bench_eq_m:'Bench Equipado Masculino'};
function _lideresCargar(){
  if(_LID.pedido)return; _LID.pedido=true;
  fetch('ranking.html').then(function(r){return r.text();}).then(function(t){
    var i=t.indexOf('var D='); if(i<0)return;
    var j=t.indexOf(';\n',i); var D=JSON.parse(t.slice(i+6,j));
    var mejor={};
    D.forEach(function(e){
      if(!_LID_TABS[e.tab]||!(e.tt>0)||e.d!=='Open'||e._baja)return;
      var k=e.tab+'|'+e.c;
      if(!mejor[k]||e.tt>mejor[k].tt)mejor[k]=e;
    });
    var orden=Object.keys(_LID_TABS);
    var cn=function(c){return parseFloat(String(c).replace('+',''))+(String(c).indexOf('+')>=0?.5:0);};
    _LID.lista=Object.keys(mejor).map(function(k){return mejor[k];}).sort(function(a,b){
      return (orden.indexOf(a.tab)-orden.indexOf(b.tab))||(cn(a.c)-cn(b.c));
    });
    _LID.i=0;_LID.t0=Date.now();_lideresPintar();
  }).catch(function(){});
}
function _lideresHtml(){
  if(!_LID.lista){_lideresCargar();return '';}
  if(!_LID.lista.length)return '';
  var L=_LID.lista,e=L[_LID.i],ib=e.tab.indexOf('bench')===0;
  var esc=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');};
  var cat=(String(e.c).indexOf('+')>=0?'':'-')+e.c;
  // Los chips son de la modalidad que se está mostrando, para que no sean 60.
  var chips='';
  L.forEach(function(x,k){ if(x.tab!==e.tab)return;
    chips+='<button class="'+(k===_LID.i?'on':'')+'" onclick="_lideresIr('+k+')">'+(String(x.c).indexOf('+')>=0?'':'-')+esc(x.c)+'</button>'; });
  var mods='';
  Object.keys(_LID_TABS).forEach(function(tb){
    var k=L.findIndex(function(x){return x.tab===tb;}); if(k<0)return;
    mods+='<button class="'+(e.tab===tb?'on':'')+'" onclick="_lideresIr('+k+')">'+_LID_TABS[tb]+'</button>';
  });
  return '<div class="yl-lid-h"><h2 class="yl-h2">Líderes del ranking</h2><a onclick="sv(\'rank\')">Ver ranking →</a></div>'
    +'<div class="yl-lid-w" onmouseenter="_LID.pausa=true" onmouseleave="_LID.pausa=false;_LID.t0=Date.now()">'
    +'<article class="yl-ld"><div class="yl-ld-k">'+_LID_TABS[e.tab]+' · '+cat+' kg · Open</div>'
    +'<a class="yl-ld-n" href="atleta.html?q='+encodeURIComponent(e.n)+'">'+esc(e.n)+'</a><div class="yl-ld-t">'+esc(e.t)+'</div>'
    +(ib?'':'<div class="yl-ld-l"><span><em>SQ</em>'+e.sq+'</span><span><em>BP</em>'+e.bp+'</span><span><em>DL</em>'+e.dl+'</span></div>')
    +'<div class="yl-ld-tt">'+e.tt+'<small>kg</small></div><div class="yl-ld-gl">'+(e.dt?(+e.dt).toFixed(2)+' GL':'')+'</div>'
    +'<div class="yl-ld-bar"><i id="ylLidBar"></i></div></article>'
    +'<div class="yl-ld-nav"><div class="yl-ld-mods">'+mods+'</div><div class="yl-ld-chips">'+chips+'</div>'
    +'<p>El 1.º de cada categoría, uno tras otro. Cambia solo cada 5 segundos, o toca una categoría.</p></div></div>';
}
function _lideresPintar(){ var el=document.getElementById('ylLideres'); if(el)el.innerHTML=_lideresHtml(); }
function _lideresIr(k){ if(!_LID.lista)return; _LID.i=(k+_LID.lista.length)%_LID.lista.length; _LID.t0=Date.now(); _lideresPintar(); }
setInterval(function(){
  if(!_LID.lista||!_LID.lista.length||!document.getElementById('ylLideres'))return;
  if(_LID.pausa||document.hidden){return;}
  var p=(Date.now()-_LID.t0)/_LID_MS;
  if(p>=1){_lideresIr(_LID.i+1);return;}
  var b=document.getElementById('ylLidBar'); if(b)b.style.width=(p*100)+'%';
},100);

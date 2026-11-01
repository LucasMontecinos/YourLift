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
// Qué coeficientes GL usa cada pestaña (el mismo GL_TAB de ranking.html).
var _LID_GL={cl_m:'pl_m',cl_f:'pl_f',eq_m:'ple_m',eq_f:'ple_f',bench_cl_m:'bo_m',bench_cl_f:'bo_f',bench_eq_m:'boe_m',bench_eq_f:'boe_f'};
var _LID_TABS={cl_f:'Classic Femenino',cl_m:'Classic Masculino',eq_f:'Equipado Femenino',eq_m:'Equipado Masculino',
  bench_cl_f:'Bench Classic Femenino',bench_cl_m:'Bench Classic Masculino',bench_eq_f:'Bench Equipado Femenino',bench_eq_m:'Bench Equipado Masculino'};
// La tabla que trae ranking.html es la base, pero no es todo el ranking: la
// página le suma al abrirse los resultados del año que están en data.json y no
// pasaron por el livecast —los internacionales—. Sin esa suma la portada ponía
// a Sergio Mardones con 860 del Nacional y no con 952,5 del Mundial.
//
// Acá se hace la misma suma, con las mismas reglas que ranking.html
// (_normCat, _normDiv, _getTab, rkNoDioPeso y la banca de _applyCompRes). Como
// la portada solo muestra al primero de cada categoría, alcanza con poner las
// filas al lado y quedarse con la mejor.
function _lidCat(cat,bw,hombre){
  var s=String(cat||'').trim(), m=s.match(/(\d+(?:\.\d+)?)/);
  if(!m)return '';
  var c=m[1]+(s.indexOf('+')>=0?'+':'');
  if(c==='84'&&!hombre&&bw>84)c='84+';
  if(c==='120'&&hombre&&bw>120)c='120+';
  return c;
}
function _lidDiv(d){
  var s=String(d||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[-_.]/g,' ').replace(/\s+/g,' ').trim();
  if(s.indexOf('sub')===0)return 'Sub Junior';
  if(s.indexOf('junior')===0||s==='jr')return 'Junior';
  if(s.indexOf('open')===0||!s)return 'Open';
  return String(d).trim();
}
function _lidTab(sexo,mod,div,ev){
  var s=(sexo==='Hombre'||sexo==='Masculino'||sexo==='M')?'m':'f';
  mod=String(mod||'');
  if(/universitario|universidad/i.test(div+' '+ev)||/universitario/i.test(mod))return 'uni_'+s;
  if(/special olympics|olimpiadas|\bOE\b/i.test(mod))return 'oe_'+s;
  var eq=/(equipado|equipped)/i.test(mod);
  if(/only ?bench/i.test(mod))return (eq?'bench_eq_':'bench_cl_')+s;
  return (eq?'eq_':'cl_')+s;
}
function _lidDelAnio(base){
  var desde=new Date().getFullYear()+'-01-01', out=[];
  (base||[]).forEach(function(a){
    (a.competencias||[]).forEach(function(c){
      var r=c.resultado||{}, f=String(c.fecha||'');
      if(!f||f<desde||!((r.total||0)>0)||String(r.status||'')==='DQ'||!c.sexo)return;
      var bw=+(r.bw||r.pesoCorporal||0), hombre=(c.sexo==='Hombre'||c.sexo==='Masculino'||c.sexo==='M');
      var cat=_lidCat(c.categoria,bw,hombre);
      if(!cat)return;
      if(bw&&cat.indexOf('+')<0&&bw>parseFloat(cat))return;      // no dio el peso de su categoría
      var tab=_lidTab(c.sexo,c.modalidad,c.division||'',c.evento||'');
      var banca=tab.indexOf('bench')===0, combinado=banca&&((r.sq||0)>0||(r.dl||0)>0);
      // En banca el total es la banca, y el GL guardado (de powerlifting) no sirve.
      var tt=banca?((r.bp||0)||(combinado?0:(r.total||0))):(r.total||0);
      if(!(tt>0))return;
      out.push({n:a.nombre||'',t:a.club||'',c:cat,d:_lidDiv(c.division),bw:bw,
        sq:banca?0:(r.sq||0),bp:r.bp||0,dl:banca?0:(r.dl||0),tt:tt,dt:combinado?0:(r.glp||r.gl||0),tab:tab});
    });
  });
  return out;
}
function _lideresCargar(){
  if(_LID.pedido)return; _LID.pedido=true;
  Promise.all([
    fetch('ranking.html').then(function(r){return r.text();}),
    fetch('data.json').then(function(r){return r.ok?r.json():[];}).catch(function(){return [];})
  ]).then(function(res){
    var t=res[0], i=t.indexOf('var D='); if(i<0)return;
    var j=t.indexOf(';\n',i); var D=JSON.parse(t.slice(i+6,j)).concat(_lidDelAnio(res[1]));
    // El GL con los coeficientes de cada modalidad, igual que glNormalizar() en
    // ranking.html: el guardado en una banca combinada es el de powerlifting.
    D.forEach(function(e){ var v=window.YLGL?YLGL.puntos(_LID_GL[e.tab],e.bw,e.tt):null; if(v!==null)e.dt=v; });
    var mejor={};
    D.forEach(function(e){
      if(!_LID_TABS[e.tab]||!(e.tt>0)||e.d!=='Open'||e._baja)return;
      var k=e.tab+'|'+e.c;
      // A igual total se queda la fila de la tabla (va primero): suele ser la
      // misma persona escrita de otra forma en data.json.
      if(!mejor[k]||e.tt>mejor[k].tt)mejor[k]=e;
    });
    var orden=Object.keys(_LID_TABS);
    var cn=function(c){return parseFloat(String(c).replace('+',''))+(String(c).indexOf('+')>=0?.5:0);};
    _LID.lista=Object.keys(mejor).map(function(k){return mejor[k];}).sort(function(a,b){
      return (orden.indexOf(a.tab)-orden.indexOf(b.tab))||(cn(a.c)-cn(b.c));
    });
    // Top 5 GL del año en Classic y Equipado (todas las divisiones), una fila por persona.
    var norm=function(n){return String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();};
    _LID.top={};
    ['cl_m','cl_f','eq_m','eq_f'].forEach(function(tb){
      var por={};
      D.forEach(function(e){ if(e.tab!==tb||e._baja||!(e.tt>0)||!(e.dt>0))return; var k=norm(e.n); if(!por[k]||e.dt>por[k].dt)por[k]=e; });
      _LID.top[tb]=Object.keys(por).map(function(k){return por[k];}).sort(function(a,b){return b.dt-a.dt;}).slice(0,5);
    });
    // Lo último: los tres campeonatos más recientes de data.json, con la mejor marca (GL) de cada uno.
    var evs={};
    (res[1]||[]).forEach(function(a){ (a.competencias||[]).forEach(function(c){
      var r=c.resultado||{}; var g=+r.glp||0; if(!c.evento||!(g>0)||!(r.total>0))return;
      var ev=evs[c.evento]||(evs[c.evento]={evento:c.evento,fecha:c.fecha||'',mejor:null});
      if(String(c.fecha||'')>ev.fecha)ev.fecha=String(c.fecha||'');
      if(!ev.mejor||g>ev.mejor.g)ev.mejor={g:g,n:a.nombre,club:a.club,r:r,cat:c.categoria,div:c.division};
    }); });
    _LID.ult=Object.keys(evs).map(function(k){return evs[k];}).sort(function(a,b){return b.fecha.localeCompare(a.fecha);}).slice(0,3);
    _LID.i=0;_LID.t0=Date.now();_lideresPintar();
  }).catch(function(){});
}
var _esc=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');};
var _kg=function(v){v=+v||0;return (Math.round(v*10)/10).toString().replace('.',',');};
var _tc=function(n){return String(n||'').toLowerCase().replace(/(^|\s)(\S)/g,function(m,a,b){return a+b.toUpperCase();});};
var _corto=function(n){var p=_tc(n).split(/\s+/).filter(Boolean);return p.length>=4?p[0]+' '+p[p.length-2]:p.slice(0,2).join(' ');};
var _catTxt=function(c){c=String(c||'');return (c.indexOf('+')>=0?c:'−'+c)+' kg';};
// Top 5 GL del año: Classic y Equipado, hombres y mujeres.
function _lideresHtml(){
  if(!_LID.top){_lideresCargar();return '';}
  var anio=new Date().getFullYear();
  var cols=[['cl_m','Classic masculino'],['cl_f','Classic femenino'],['eq_m','Equipado masculino'],['eq_f','Equipado femenino']];
  var h='<div class="yl-sec-h"><h2 class="yl-d">Top 5 GL '+anio+'</h2><a onclick="sv(\'rank\')">Ranking completo →</a></div><div class="yl-top">';
  cols.forEach(function(c){
    var L=_LID.top[c[0]]||[];
    h+='<div><h3>'+c[1]+'</h3>';
    L.forEach(function(e,i){
      h+='<a class="yl-top-r" href="atleta.html?q='+encodeURIComponent(e.n)+'"><span class="yl-med'+(i<3?' m'+(i+1):'')+'">'+(i+1)+'</span>'
        +'<span><b>'+_esc(_corto(e.n))+'</b><small>'+_esc(e.t||'')+'<br>'+_catTxt(e.c)+' · '+_esc(e.d||'')+' · '+_kg(e.tt)+' kg</small></span>'
        +'<strong class="yl-d">'+(+e.dt).toFixed(2).replace('.',',')+'</strong></a>';
    });
    if(!L.length)h+='<p class="yl-top-v">Sin marcas este año.</p>';
    else if(L.length<5)h+='<p class="yl-top-v">'+['','Solo una','Solo dos','Solo tres','Solo cuatro'][L.length]+' con marca este año.</p>';
    h+='</div>';
  });
  return h+'</div>';
}
// Lo último: los tres campeonatos más recientes y la mejor marca de cada uno.
function _ultimoHtml(){
  if(!_LID.ult||!_LID.ult.length)return '';
  var M=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var fx=function(f){var m=String(f||'').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);if(!m)return '';return (m[3]?(+m[3])+' ':'')+M[(+m[2])-1]+' '+m[1];};
  var h='<div class="yl-sec-h"><h2 class="yl-d">Lo último</h2><a onclick="sv(\'pasadas\')">Todos los resultados →</a></div><div class="yl-res">';
  _LID.ult.forEach(function(ev){
    var b=ev.mejor,r=b.r||{};
    var nom=String(ev.evento).replace(/\s*FECHIPO\s*/gi,' ').replace(/\s+/g,' ').trim();
    h+='<article class="yl-resc"><span class="e">'+_esc(nom)+(ev.fecha?' · '+fx(ev.fecha):'')+'</span>'
      +'<h3>'+_esc(_corto(b.n))+', la mejor marca del campeonato</h3>'
      +'<strong class="yl-d">'+_kg(r.total)+'<small>kg</small></strong>'
      +'<p>'+(r.sq?_kg(r.sq)+' · '+_kg(r.bp)+' · '+_kg(r.dl)+' · ':'')+b.g.toFixed(2).replace('.',',')+' GL'+(b.cat?' · '+_catTxt(b.cat):'')+'</p></article>';
  });
  return h+'</div>';
}
function _lideresPintar(){
  var el=document.getElementById('ylLideres'); if(el)el.innerHTML=_lideresHtml();
  var u=document.getElementById('ylUltimo'); if(u)u.innerHTML=_ultimoHtml();
}
function _lideresIr(k){ if(!_LID.lista)return; _LID.i=(k+_LID.lista.length)%_LID.lista.length; _lideresPintar(); }

// ── Fotos de la portada: las que eligió el owner en el panel ──────────────
// site_backgrounds/portada: {fotos:[{url,pc:{x,y},movil:{x,y}}], intervalo}.
// `url` vacía es la foto original del sitio. Cada foto trae su encuadre para
// computador (--hpc-*) y para teléfono (--hm-*). Con más de una, van pasando con
// un fundido. Llega con el resto de la configuración de fondos (con caché), así
// que no suma lecturas. Acepta también el formato viejo {foto,pc,movil}.
var _PORT={i:0,t0:0};
function _portadaFotos(){
  var c=((window._BG_SETTINGS||{}).portada)||{};
  if(Array.isArray(c.fotos)&&c.fotos.length)return c.fotos;
  if(c.foto||c.pc||c.movil)return [{url:c.foto||'',pc:c.pc,movil:c.movil}];
  return null;
}
function _aplicarPortada(){
  var F=_portadaFotos(); var pic=document.querySelector('.yl-hero picture'); if(!F||!pic)return;
  var base=pic.getAttribute('data-orig')||(pic.querySelector('img')&&pic.querySelector('img').getAttribute('src'))||'portada/portada.jpg';
  pic.setAttribute('data-orig',base);
  if(_PORT.i>=F.length)_PORT.i=0;
  var h='';
  F.forEach(function(f,k){
    var pc=f.pc||{},mv=f.movil||{};
    var st='--hpc-x:'+(pc.x!=null?pc.x:30)+'%;--hpc-y:'+(pc.y!=null?pc.y:0)+'%;--hm-x:'+(mv.x!=null?mv.x:50)+'%;--hm-y:'+(mv.y!=null?mv.y:50)+'%';
    h+='<img class="yl-sl'+(k===_PORT.i?' on':'')+'" src="'+String(f.url||base).replace(/"/g,'&quot;')+'" alt="" style="'+st+'"'+(k?' loading="lazy"':' fetchpriority="high"')+'>';
  });
  // La primera vez se reemplaza la foto fija; después se respeta lo que hay para
  // no recargar las imágenes cada vez que la portada se vuelve a dibujar.
  var firma=JSON.stringify(F);
  if(pic.getAttribute('data-firma')!==firma){pic.innerHTML=h;pic.setAttribute('data-firma',firma);}
  var c=((window._BG_SETTINGS||{}).portada)||{};
  _PORT.ms=Math.max(3,+c.intervalo||6)*1000;
  if(!_PORT.t0)_PORT.t0=Date.now();
}
setInterval(function(){
  var sl=document.querySelectorAll('.yl-hero .yl-sl'); if(sl.length<2||document.hidden)return;
  if(Date.now()-_PORT.t0<(_PORT.ms||6000))return;
  _PORT.t0=Date.now(); _PORT.i=(_PORT.i+1)%sl.length;
  sl.forEach(function(x,k){x.classList.toggle('on',k===_PORT.i);});
},500);

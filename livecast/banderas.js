// livecast.html — Banderas, logos de club e insignias de país.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

function _ctry(a){const c=(a&&(a.country||a.pais||a.pais3));return (c&&String(c).toUpperCase())||'CHI';}

function _ctryName(code){const c=COUNTRY[code];return c?c[1]:code;}

// ── Qué se muestra junto al nombre: bandera o logo del club ────────────────
// En un sudamericano la bandera es el dato: identifica a quién representa cada
// uno. En un campeonato chileno son todos CHI y la bandera no dice nada — ahí lo
// que se busca es de qué club viene. Se decide solo, mirando cuántos países hay
// en el campeonato, igual que el acta elige entre columna "País" y columna "Club".
// Así nadie tiene que configurar nada y siempre se ve lo que informa.
function _variosPaises(){
  // Se vuelve a contar si cambia la cantidad de atletas: si se preguntara antes
  // de que llegue la nómina (cero atletas, cero países) quedaría "un solo país"
  // pegado, y un campeonato internacional se vería sin banderas.
  const ath=DATA.athletes||[];
  if(window._VARIOS_PAISES===undefined||window._VARIOS_PAISES_N!==ath.length){
    const p=new Set(ath.filter(a=>!a.__is4).map(a=>_ctry(a)).filter(Boolean));
    window._VARIOS_PAISES=p.size>1;
    window._VARIOS_PAISES_N=ath.length;
  }
  return window._VARIOS_PAISES;
}

function _insignia(a,alto){
  alto=alto||14;
  if(_variosPaises())return _flagImg(_ctry(a),alto,true);
  return _logoClub(a,alto);
}

// El logo del club del atleta, o nada. En un campeonato de un solo país la
// bandera ya no vuelve de relleno cuando el club no tiene logo: serían todas la
// misma y no dicen nada (se pidió así después del Sudamericano).
function _logoClub(a,px,extra){
  if(!window.clubLogoImg||!a||!a.club)return '';
  return window.clubLogoImg(a.club,px,'background:rgba(10,22,40,.4);padding:1px;margin-right:6px;vertical-align:middle;flex-shrink:0;'+(extra||''));
}

// La misma bandera, como imagen, para usarla de fondo.
function _flagDataUri(code){
  const svg=FLAG_SVG[code];
  if(!svg)return '';
  // encodeURIComponent deja pasar ' ( ) ! * — y esos cuatro rompen un url() de CSS
  // sin comillas. Se codifican acá para poder escribirlo SIN comillas: el fondo
  // viaja dentro de un atributo style="…" del HTML, y una comilla doble ahí corta
  // el atributo en seco. Eso hacía que el navegador recibiera url("") y la pantalla
  // de "Atleta en barra" saliera azul lisa por más que se eligiera la bandera.
  const uri=encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">'+svg+'</svg>')
    .replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/!/g,'%21').replace(/\*/g,'%2A');
  return 'data:image/svg+xml;utf8,'+uri;
}

// Bandera del país. Si no está en la tabla, queda el código de tres letras.
// `sinChip` para las pantallas donde el código ya se escribe al lado.
function _flagImg(code,h,sinChip){
  h=Math.round(h||18);
  const svg=FLAG_SVG[code];
  if(!svg){
    if(sinChip)return '';
    return '<span class="flag-code" style="display:inline-block;padding:1px 5px;border-radius:3px;background:rgba(212,168,67,.9);color:#0A1628;'
      +'font-family:Oswald,sans-serif;font-weight:700;font-size:'+Math.round(h*0.62)+'px;letter-spacing:.5px;'
      +'vertical-align:middle;margin-right:6px">'+(code||'')+'</span>';
  }
  return '<svg class="flag-img" viewBox="0 0 30 20" role="img" aria-label="'+(code||'')+'" '
    +'style="height:'+h+'px;width:'+Math.round(h*1.5)+'px;border-radius:2px;vertical-align:middle;margin-right:6px;'
    +'box-shadow:0 0 2px rgba(0,0,0,.5);flex-shrink:0">'+svg+'</svg>';
}

// Fondo del modo "Atleta en barra": bandera del país → logo del campeonato →
// azul YourLift. La cadena se corta en el primero que exista.
// Cuán difuminada va la bandera de fondo. 0 = la bandera tal cual; 1 = tapada.
// Se elige desde el panel de Pantalla de Tarima y viaja con el resto del estado.
function _veloBandera(){
  const st=window._SCREEN_STATE||{};
  const v=typeof st.veloBandera==='number'?st.veloBandera:0.55;
  return Math.max(0.05,Math.min(0.92,v));
}

// `base` deja poner otro color de fondo debajo de la bandera: la pantalla de
// intentos tiene su propio color elegible en el engranaje, y si no se respetara,
// prender la bandera le borraría ese color al operador.
function _fondoBarra(a,modo,base){
  // Negro de fondo: en el televisor del gimnasio el azul se veía lavado y el
  // negro hace resaltar el nombre, el peso y los discos.
  const AZUL=base?_hexRgba(base,1):'linear-gradient(160deg,#141414,#000 55%,#000)';
  // En un campeonato de un solo país (nacional, regional, clasificatorio) la
  // bandera sería la misma para todos y no identifica a nadie: va de fondo el
  // logo del club del atleta. Sin logo de club, el del campeonato o el azul.
  if(modo==='bandera'&&!_variosPaises()){
    const club=(a&&a.club&&window.clubLogo)?window.clubLogo(a.club):'';
    if(club){
      // Más tapado que la bandera: un logo tiene letras y dibujo propios que
      // compiten con el nombre del atleta escrito encima.
      const v=Math.min(.9,_veloBandera()+.25);
      return 'linear-gradient(rgba(0,0,0,'+v+'),rgba(0,0,0,'+v+')),url(\''+String(club).replace(/'/g,'%27')+'\') center/auto 72% no-repeat,'+AZUL;
    }
    modo='logo';
  }
  if(modo==='bandera'){
    // La bandera ENTERA de fondo, centrada y estirada hasta las esquinas. Antes se
    // dibujaban franjas diagonales con sus colores, y así Chile perdía la estrella y
    // el blanco, Uruguay sus rayas y Argentina su sol: quedaban dos diagonales que
    // no identificaban a nadie. Solo Colombia, que es tres franjas, se salvaba.
    // El velo no es parejo. Con uno parejo pasaba una de dos: o la bandera no se
    // veía, o el sol de Argentina y la estrella de Chile quedaban como una mancha
    // justo detrás del nombre. Va más claro arriba y abajo —donde se reconoce el
    // país, que es para lo que está— y más oscuro en la franja del medio, que es
    // donde va el nombre y tiene que leerse desde el fondo del gimnasio.
    // (Lo que la hacía invisible no era el velo sino un url() roto: ver _flagDataUri.)
    // Cuánto se difumina lo decide el operador desde el panel: cada gimnasio tiene
    // su luz y su proyector, y lo que acá se ve bien allá puede quedar lavado.
    const uri=_flagDataUri(_ctry(a));
    const v=_veloBandera();
    const medio=Math.min(.97,v+.33);
    const velo='linear-gradient(rgba(0,0,0,'+v+'),rgba(0,0,0,'+medio+') 34%,rgba(0,0,0,'+medio+') 66%,rgba(0,0,0,'+v+'))';
    if(uri)return velo+',url('+uri+') center/cover no-repeat,'+AZUL;
    return AZUL;
  }
  // El azul YourLift sigue disponible si el operador lo elige a mano.
  if(modo==='yourlift'&&!base)return 'linear-gradient(160deg,#0d2141,#0A1628 55%,#060d1a)';
  if(modo==='logo'&&_logoCamp()){
    return 'linear-gradient(0deg,rgba(0,0,0,.86),rgba(0,0,0,.86)),url('+_logoCamp()+') center/contain no-repeat,'+AZUL;
  }
  return AZUL;
}

function _hexRgba(hex,a){
  const h=String(hex).replace('#','');
  const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

// <option>s para selects de país (CHI primero)
function _countryOptions(sel){
  const keys=Object.keys(COUNTRY).sort((a,b)=>a==='CHI'?-1:b==='CHI'?1:_ctryName(a).localeCompare(_ctryName(b)));
  return keys.map(k=>'<option value="'+k+'" '+((sel||'CHI')===k?'selected':'')+'>'+k+' — '+_ctryName(k)+'</option>').join('');
}

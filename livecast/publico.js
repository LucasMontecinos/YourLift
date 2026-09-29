// livecast.html — La vista del público: Competencia en Vivo, la transmisión de YouTube y la ficha del atleta.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// ═══════════════════════════════════════════════════════════════
// COMPETENCIA EN VIVO (público): muestra todos los vuelos en orden
// con el atleta en tarima destacado. Sin botones GOOD/NO LIFT.
// Auto-scroll al atleta actual cuando se carga.
// ═══════════════════════════════════════════════════════════════
function _ytId(url){if(!url)return'';const m=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([A-Za-z0-9_-]{11})/);return m?m[1]:'';}

function _ytLinkActual(){
  if(!DATA.event)return '';
  const meta=(window.LIVE_EVENT_META||{})[DATA.event.id]||{};
  return meta.youtubeUrl||DATA.event.youtubeUrl||'';
}

function _ytSync(){
  const cont=document.getElementById('ytLive');
  if(!cont)return;
  const mostrar = !TX_MODE && !isAdmin && !window._EV_ESPERANDO
                  && _YT_PANTALLAS.indexOf(DATA.phase)>=0;
  const vid = mostrar ? _ytId(_ytLinkActual()) : '';
  if(!vid){
    // Se desmonta al salir: un iframe escondido sigue bajando video, y el
    // espectador lo paga en datos sin estar mirando nada.
    if(_ytMontado){ document.getElementById('ytBox').innerHTML=''; _ytMontado=''; }
    cont.classList.remove('on');
    document.body.classList.remove('yt-on');
    return;
  }
  cont.classList.add('on');
  document.body.classList.add('yt-on');
  cont.classList.toggle('oculto',!!window._ytOculto);
  // El iframe se rehace SOLO si cambió el video: una vez por día.
  if(vid!==_ytMontado){
    // Arranca en silencio porque es la única forma de que el navegador lo deje
    // partir solo: con sonido queda en pausa y hay que tocarlo igual. Así lo
    // primero que se ve al entrar es la competencia moviéndose.
    document.getElementById('ytBox').innerHTML=
      '<iframe src="https://www.youtube.com/embed/'+vid+'?autoplay=1&mute=1&playsinline=1&rel=0"'
      +' allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"'
      +' allowfullscreen title="Transmisión en vivo"></iframe>';
    _ytMontado=vid;
  }
  document.getElementById('ytBar').innerHTML=
    '<button class="'+(window._ytOculto?'off':'')+'" onclick="ytToggle()">'
    +(window._ytOculto?'<i class=yl-i-reproducir></i> MOSTRAR TRANSMISIÓN':'<i class=yl-i-cerrar></i> OCULTAR TRANSMISIÓN')+'</button>'
    +(window._ytOculto?'':'<div class="pista">Toca el video para activar el sonido</div>');
}

// Seguir a la tarima. La vista del público acompaña sola al atleta que está
// levantando —es lo que necesita un televisor que nadie toca— hasta que el que
// mira mueve la pantalla. Desde ese momento queda LIBRE: cargar un peso o dar un
// válido ya no la mueve, se puede subir y bajar a gusto. Vuelve a seguir cuando
// toca AUTOMÁTICO o el botón "AL QUE ESTÁ EN TARIMA".
//
// Antes se soltaba solo 20 segundos: si uno llevaba más rato leyendo y en la mesa
// cargaban un peso, la pantalla igual lo subía al de tarima.
//
// Solo cuentan gestos de la persona (rueda, dedo, teclas, barra de scroll). El
// evento 'scroll' no sirve para esto: también lo disparan los desplazamientos que
// hace la propia página.
function _seguirTarima(){
  if(!window._scrollWatch){
    window._scrollWatch=true;
    if(window._siguiendoTarima===undefined)window._siguiendoTarima=true;
    const soltar=function(){
      if(DATA.phase!=='liveView'||window._siguiendoTarima===false)return;
      window._siguiendoTarima=false;
      const b=document.getElementById('btnSeguirTarima');
      if(b&&!window.NAV_LIBRE)b.style.display='';
    };
    addEventListener('wheel',soltar,{passive:true});
    addEventListener('touchmove',soltar,{passive:true});
    addEventListener('keydown',function(e){ if(/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key||''))soltar(); });
    // Arrastrar la barra de scroll: ese clic cae en el <html>, fuera del contenido.
    addEventListener('pointerdown',function(e){ if(e.target===document.documentElement)soltar(); });
  }
  return window._siguiendoTarima!==false;
}

// La ficha del atleta en una sola línea pide unos 1400 px de tabla. Por encima de
// este ancho —televisores de tarima, monitores de 25-26", cualquier computador—
// conviene a lo largo: la tanda entra completa. Por debajo —teléfono, tablet de
// pie— conviene apilada, que es donde sobra alto y falta ancho.
// El número va adentro de la función y no en una constante suelta: esta se
// declara muy abajo en el archivo, y una pantalla que se dibuja durante la carga
// la leería antes de que exista.
function _anchoDaParaLinea(){ return (window.innerWidth||1400) >= 1280; }

function renderLiveView(){
  const _enLinea = _anchoDaParaLinea();
  window._ultLinea = _enLinea;
  const currentFlight = DATA.flight;
  const liftColor = LIFT_C[DATA.lift];
  // Vista libre: el espectador eligió una tanda y la pantalla se queda ahí aunque
  // la tarima avance. _NAV_REMOTA guarda el último cursor que publicó la tarima.
  const libre = !!window.NAV_LIBRE;
  const _tandaEnTarima = (libre && window._NAV_REMOTA && window._NAV_REMOTA.flight) || (libre?null:currentFlight);

  // La transmisión ya no se dibuja acá: la monta _ytSync() en #ytLive, arriba
  // de todo y fuera de esta pantalla, para que no se reinicie en cada intento.

  let h = '<div class="fade">';

  // ── Header ──────────────────────────────────────────────────
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">';
  h += '<div><h2 class="os" style="font-size:22px;letter-spacing:2px">COMPETENCIA EN VIVO</h2>';
  h += '<p style="color:var(--muted);font-size:12px">'+((DATA.event==null?void 0:DATA.event.name)||'')+'</p></div>';
  h += '<div style="display:flex;gap:6px;align-items:center">';
  h += '<span style="font-size:11px;color:var(--muted)">'+(libre?'Estás mirando:':'Tanda activa:')+'</span>';
  h += '<span style="background:'+(FL_C[currentFlight]||'#666')+';color:#fff;padding:4px 12px;border-radius:6px;font-family:Oswald;font-weight:700">'+(currentFlight||'—')+'</span>';
  h += '</div></div>';

  // ── Elegir qué tanda mirar ───────────────────────────────────
  // AUTOMÁTICO sigue a la tarima, como siempre. Si el espectador elige una tanda,
  // se queda ahí: cargar un peso en la tanda que está compitiendo ya no lo devuelve
  // de un salto. Es la misma vista libre que usa el operador, expuesta acá.
  const tandas=[...new Set(DATA.athletes.map(a=>a.flight).filter(Boolean))].sort(_cmpFl);
  const _fd=_filaDias('publico',tandas,_tandaEnTarima?_diaDeTanda(_tandaEnTarima):null);
  const tandasVer=_fd.tandas;
  {
    // Día y tanda se pliegan, como el panel de récords. En los televisores de
    // atrás de tarima nadie toca la pantalla: esas dos filas de botones son alto
    // gastado que se le quita a los atletas. La elección queda guardada en el
    // equipo, así que el televisor no vuelve a abrirlas solo al recargar.
    if(window._NAV_PANEL_OPEN===undefined){
      let g=null; try{g=localStorage.getItem('yl_navPanel');}catch(e){}
      window._NAV_PANEL_OPEN=(g!=='0');
    }
    const abN=!!window._NAV_PANEL_OPEN;
    const diaSel=window._DIA_SEL?window._DIA_SEL['publico']:null;
    const hayTandas=tandas.length>1;
    if(_fd.html||hayTandas){
      h += '<div class="card" style="margin-bottom:10px;padding:0;overflow:hidden">';
      h += '<button onclick="window._NAV_PANEL_OPEN=!window._NAV_PANEL_OPEN;try{localStorage.setItem(\'yl_navPanel\',window._NAV_PANEL_OPEN?\'1\':\'0\')}catch(e){};R()" '
        +'style="width:100%;display:flex;align-items:center;gap:9px;padding:7px 12px;border:none;background:rgba(29,49,80,.35);'
        +'color:var(--muted);font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;text-align:left">'
        +'<span>VER DÍA Y TANDA</span>'
        +'<span style="color:var(--gold);letter-spacing:.5px">'
          +(diaSel?'DÍA '+diaSel:'')+(diaSel&&currentFlight?' · ':'')+(currentFlight?'TANDA '+currentFlight:'')+'</span>'
        +'<span style="flex:1"></span><span style="font-size:13px">'+(abN?'▾':'▸')+'</span></button>';
      if(abN){
        h += '<div style="padding:10px 12px 3px">';
        h += _fd.html;
        if(hayTandas){
          h += '<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:7px">';
          h += '<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-right:2px">VER TANDA</span>';
          h += '<button onclick="liveVerTanda(null)" style="padding:5px 12px;border-radius:6px;border:2px solid '
            +(libre?'var(--border)':'var(--green)')+';background:'+(libre?'transparent':'rgba(34,197,94,.12)')
            +';color:'+(libre?'var(--muted)':'var(--green)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer" '
            +'title="Sigue sola a la tanda que está en tarima">AUTOMÁTICO</button>';
          tandasVer.forEach(f=>{
            const on=libre&&f===currentFlight, enTarima=f===_tandaEnTarima;
            const n=DATA.athletes.filter(a=>a.flight===f&&!a.bombed).length;
            h += '<button onclick="liveVerTanda(\''+f+'\')" style="padding:5px 12px;border-radius:6px;border:2px solid '
              +(on?(FL_C[f]||'var(--gold)'):'var(--border)')+';background:'+(on?(FL_C[f]||'#666')+'22':'transparent')
              +';color:'+(on?(FL_C[f]||'#fff'):'var(--muted)')+';font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer">'
              +f+'<span style="font-size:9px;opacity:.65;margin-left:4px">'+n+'</span>'
              +(enTarima?'<span style="font-size:8px;color:var(--green);margin-left:5px">EN TARIMA</span>':'')+'</button>';
          });
          h += '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    }
    // El aviso de "estás mirando otra tanda" queda FUERA del panel: es lo único
    // de acá que hay que ver sí o sí, aunque los botones estén plegados.
    if(libre&&_tandaEnTarima&&_tandaEnTarima!==currentFlight){
      h += '<div style="background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.45);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#9dc4f5;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">'
        +'<span>Estás mirando la tanda '+currentFlight+'. En tarima está compitiendo la '+_tandaEnTarima+'.</span>'
        +'<button onclick="liveVerTanda(null)" style="padding:5px 12px;border-radius:6px;border:1px solid #60a5fa;background:transparent;color:#60a5fa;font-family:Oswald;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;white-space:nowrap">IR A LA TARIMA</button>'
        +'</div>';
    }
  }

  // ── Orden de levantamiento ────────────────────────────────────
  const flQueue = liftQueue();
  const queueIds = new Set(flQueue.map(a=>a.id));
  const curFlightAll  = DATA.athletes.filter(a=>a.flight===currentFlight);
  // Las otras tandas que se listan debajo son las DEL DÍA ELEGIDO arriba, no las
  // del campeonato entero. Antes la tabla dibujaba los 429 atletas del
  // Sudamericano en cada intento: el selector de día movía los botones pero no la
  // tabla, y rehacer ocho mil casillas a cada peso es lo que hacía pestañear la
  // pantalla. Si el campeonato es de un solo día, el conjunto son todas y no
  // cambia nada.
  const _delDia = new Set(tandasVer||tandas);
  const otherAthletes = DATA.athletes.filter(a=>a.flight!==currentFlight&&_delDia.has(a.flight));

  const sortedAthletes = [
    // Primero los que todavía deben el intento de la ronda: esos ya vienen de
    // menor a mayor peso (y a igual peso, por lote) desde liftQueue().
    ...flQueue,
    // Y detrás los que ya levantaron. Antes iban por lote, así que un 2º intento
    // recién declarado quedaba al final y la lista solo se acomodaba al terminar
    // la ronda. Ahora se ordenan entre ellos por el peso que acaban de declarar,
    // de menor a mayor, con el lote como desempate.
    ...curFlightAll.filter(a=>!queueIds.has(a.id)&&!a.bombed).sort(_cmpProx),
    ...curFlightAll.filter(a=>a.bombed),
    // Las tandas que no están en tarima siguen el mismo círculo que el control:
    // después de la actual va la siguiente, y al llegar al final vuelve a la primera.
    ...(function(){
      const orden=_flightsFromCurrent([...new Set(DATA.athletes.map(a=>a.flight))].sort(_cmpFl));
      const pos=f=>{const i=orden.indexOf(f);return i<0?999:i;};
      return otherAthletes.sort((a,b)=>pos(a.flight)-pos(b.flight)||a.lot-b.lot);
    })(),
  ];
  // Cuántas casillas por lift: 3, o 4 si algún atleta tuvo un intento extra/4º en
  // ese lift. Se calcula sobre los atletas REALES (el clon del 4º redirige su
  // att, así que para la tabla usamos siempre _realAth).
  const _liveReal=sortedAthletes.map(_realAth);
  // La columna EXTRA aparece solo si alguien tiene un 4º intento DE VERDAD (con
  // peso declarado o ya juzgado). Antes bastaba con que quedara la casilla vacía
  // —de un extra borrado, o de datos viejos— para que la columna le saliera a
  // todos, que es lo que se veía en la pantalla del público.
  const _tieneExtra=(a,l)=>{const x=(a.att[l]||[])[3];return !!(x&&(x.w>0||x.r));};
  const maxAtts={};['sq','bp','dl'].forEach(l=>{maxAtts[l]=_liveReal.some(a=>_tieneExtra(a,l))?4:3;});
  // Peso muerto sin columna de subtotal: al final van los tres totales (actual,
  // proyectado y final). +1 GL, +1 POSICIÓN.
  const totalCols=2+(maxAtts.sq+1)+(maxAtts.bp+1)+maxAtts.dl+3+1+1;

  // Los récords de las categorías que están en la tanda, con los que ya se
  // batieron hoy marcados. Es el mismo panel del Control en Vivo, abierto: se
  // probó plegado para no empujar la tabla hacia abajo, y desde la mesa
  // pidieron verlo sin tener que abrirlo.
  h += _srPanel();

  // ── Tabla completa de resultados ─────────────────────────────
  // El puesto virtual de cada uno, calculado una vez para toda la tabla.
  const VIRT = _virtualPuestos();
  // Qué significa ese número, dicho una vez. Un entrenador que lo ve por primera
  // vez no tiene por qué adivinar si es el puesto de ahora o el proyectado.
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;'
    +'font-size:11px;color:var(--muted);line-height:1.5">'
    +'<span style="font-family:Oswald;font-size:9px;letter-spacing:.5px;padding:2px 7px;border-radius:5px;'
    +'background:rgba(212,168,67,.10);border:1px solid rgba(212,168,67,.35);color:rgba(212,168,67,.85)">VIRTUAL</span>'
    +'<span>El puesto de cada uno <b style="color:var(--text)">si todos levantan lo que tienen declarado</b>, '
    +'dentro de su categoría y división. Al lado va el total proyectado y cuánto falta para el puesto de arriba.</span>'
    +'</div>';
  h += '<div class="card" style="padding:0;overflow-x:auto">';
  // lv-solido: los intentos se pintan como en la pantalla de tarima (válido
  // verde lleno, nulo rojo lleno y tachado), que desde la galería se lee de un
  // vistazo. El resto de la fila (lote, puesto virtual, categoría) no cambia.
  h += '<table class="lv-solido" style="width:100%;border-collapse:collapse;font-size:11px;min-width:780px">';

  // Fila de grupos (SQ / BP / DL)
  h += '<thead>';
  h += '<tr style="border-bottom:1px solid rgba(29,49,80,.4)">';
  h += '<th colspan="2" style="padding:6px 8px;border-right:1px solid var(--border)"></th>';
  ['sq','bp','dl'].forEach(l=>{
    const isCur = l===DATA.lift;
    const c = LIFT_C[l];
    h += '<th colspan="'+(maxAtts[l]+(l==='dl'?0:1))+'" style="padding:6px 4px;text-align:center;font-family:Oswald;font-size:12px;letter-spacing:2px;color:'+c+';border-right:1px solid var(--border);background:'+(isCur?c+'18':'transparent')+'">'+LIFT_N[l]+(isCur?' <i class=yl-i-reproducir></i>':'')+'</th>';
  });
  h += '<th colspan="3" style="padding:6px 4px;text-align:center;font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);border-right:1px solid var(--border)">TOTALES</th>';
  h += '<th style="padding:6px 4px;text-align:center;font-family:Oswald;font-size:10px;color:var(--gold)">GLP</th>';
  h += '</tr>';

  // Fila de columnas
  h += '<tr style="background:rgba(29,49,80,.35);border-bottom:2px solid var(--border)">';
  h += '<th style="padding:5px 3px;text-align:center;color:#fff;font-size:14px;font-weight:700;width:48px;line-height:1.1;border-right:1px solid var(--border);">N°<br>LOTE</th>';
  h += '<th style="padding:5px 8px;text-align:left;color:#fff;font-size:14px;font-weight:700;border-right:1px solid var(--border)">ATLETA</th>';
  ['sq','bp','dl'].forEach(l=>{
    const isCur = l===DATA.lift;
    const bg = isCur ? LIFT_C[l]+'12' : 'transparent';
    for(let r=1;r<=maxAtts[l];r++){
      const is4=r===4;
      h += '<th style="padding:5px 2px;text-align:center;color:'+(is4?'#60a5fa':LIFT_C[l])+';font-size:9px;width:56px;background:'+bg+'"'+(is4?' title="Intento extra / 4º"':'')+'>'+(is4?'EXTRA':'INT '+r)+'</th>';
    }
    if(l!=='dl')h += '<th style="padding:5px 3px;text-align:center;color:var(--gold);font-size:8px;width:54px;border-right:1px solid var(--border)">SUB-TOTAL</th>';
  });
  // Los tres totales. Actual: lo válido hasta ahora, aunque falten movimientos.
  // Proyectado: lo válido más los intentos declarados que todavía no tienen
  // decisión. Final: el total de verdad, cuando ya hay válidos en los tres.
  h += '<th style="padding:5px 3px;text-align:center;color:#e5e7eb;font-size:8px;width:54px" title="Suma de lo válido hasta ahora">ACTUAL</th>';
  h += '<th style="padding:5px 3px;text-align:center;color:#f59e0b;font-size:8px;width:54px" title="Lo válido más los intentos declarados que todavía no tienen decisión">PROYECT.</th>';
  h += '<th style="padding:5px 3px;text-align:center;color:var(--gold);font-size:8px;width:54px;border-right:1px solid var(--border)" title="Total oficial: válidos en los tres movimientos">FINAL</th>';
  h += '<th style="padding:5px 4px;text-align:center;color:var(--gold);font-size:9px;width:52px">GL PTS</th>';
  h += '<th style="padding:5px 4px;text-align:center;color:#60a5fa;font-size:9px;width:74px" title="Posición actual → posición si el intento es válido">POSICIÓN</th>';
  h += '</tr></thead><tbody>';

  // Quién acaba de salir a tarima, para marcarlo bajo su intento.
  const ultimo = _ultimoEnTarima();

  let lastFlight = currentFlight;
  sortedAthletes.forEach(a=>{
    // Separador de tanda
    if(a.flight !== lastFlight){
      lastFlight = a.flight;
      const flC = FL_C[a.flight]||'#666';
      h += '<tr style="background:rgba(29,49,80,.5)"><td colspan="'+totalCols+'" style="padding:5px 12px">';
      h += '<span style="background:'+flC+';color:#fff;padding:2px 10px;border-radius:4px;font-family:Oswald;font-size:10px;letter-spacing:2px">TANDA '+(a.flight||'—')+'</span>';
      h += '</td></tr>';
    }

    const inQueue     = queueIds.has(a.id);
    const queuePos    = inQueue ? flQueue.findIndex(q=>q.id===a.id) : -1;
    const isOnPlatform = inQueue && queuePos===0;

    let rowStyle = 'border-bottom:1px solid rgba(29,49,80,.2);';
    if(isOnPlatform)         rowStyle += 'background:linear-gradient(90deg,'+liftColor+'35,'+liftColor+'12);box-shadow:inset 4px 0 0 '+liftColor+';';
    else if(inQueue&&queuePos<=2) rowStyle += 'background:'+liftColor+'09;';
    else if(a.bombed)         rowStyle += 'opacity:.4;';

    const rowId = isOnPlatform ? 'id="liveCurrentLifter"' : '';
    h += '<tr '+rowId+' style="'+rowStyle+'">';

    // # / posición cola + lote
    h += '<td style="padding:6px 3px;text-align:center;border-right:1px solid var(--border);">';
    // El lote, en blanco y 50% más grande: en gris a 8-9 px no se leía desde las
    // teles ni en el teléfono.
    if(isOnPlatform){
      h += '<span style="color:'+liftColor+';font-family:Oswald;font-weight:700;font-size:14px"><i class=yl-i-reproducir></i></span>';
      h += '<div style="color:#fff;font-family:Oswald;font-weight:600;font-size:12px;margin-top:1px">'+a.lot+'</div>';
    } else if(inQueue){
      h += '<span style="color:var(--gold);font-family:Oswald;font-weight:700;font-size:11px">'+(queuePos+1)+'°</span>';
      h += '<div style="color:#fff;font-family:Oswald;font-weight:600;font-size:12px;margin-top:1px">'+a.lot+'</div>';
    } else {
      h += '<span style="color:#fff;font-size:14px;font-weight:600;font-family:Oswald">'+a.lot+'</span>';
    }
    h += '</td>';

    // Atleta — TODO a lo largo, en un solo renglón, cuando la pantalla da el ancho.
    //
    // Antes iba el nombre y debajo, uno bajo otro, el club, el peso corporal, el
    // puesto virtual y los chips de nominación: cinco renglones por atleta. En los
    // televisores de atrás de tarima —que muestran esta misma vista del público—
    // una tanda de doce no entraba ni a la mitad. Puesto a lo largo, la fila mide
    // un tercio y la tanda entra completa.
    //
    // En un teléfono o un tablet de pie no: todo en fila pide unos 1400 px, y
    // debajo de eso el que mira tendría que arrastrar la tabla a lo ancho para
    // llegar al peso muerto. Ahí se queda apilado, que es lo que conviene cuando
    // lo que sobra es alto y lo que falta es ancho.
    h += '<td style="padding:'+(_enLinea?'3px':'5px')+' 8px;border-right:1px solid var(--border)">';
    if(_enLinea) h += '<div style="display:flex;align-items:center;gap:6px;white-space:nowrap">';
    if(isOnPlatform) h += '<span style="background:'+liftColor+';color:#fff;padding:1px 6px;border-radius:3px;font-size:8px;font-family:Oswald;letter-spacing:1px;'+(_enLinea?'flex-shrink:0':'display:inline-block;margin-bottom:2px')+'"><i class=yl-i-reproducir></i> EN TARIMA</span>'+(_enLinea?'':'<br>');
    // La bandera del país, al lado del nombre, como en las tablas de Resultados
    // y en el medallero. Solo si el campeonato tiene más de un país: en un
    // nacional serían cuatrocientas banderas chilenas iguales, que no informan
    // nada y le quitan lugar al nombre. Es la misma condición que usa Resultados.
    // En un nacional va el logo del club, que es lo que distingue a cada uno.
    if(_variosPaises()) h += _flagImg(_ctry(a),isOnPlatform?15:12,true);
    else h += _logoClub(a,_enLinea?(isOnPlatform?30:26):(isOnPlatform?34:30));
    // Nombre y peso corporal en la letra del lote (Oswald, blanco), como en la
    // tabla de la pantalla de tarima.
    h += '<span style="font-family:Oswald,sans-serif;font-weight:'+(isOnPlatform?600:500)+';letter-spacing:.3px;font-size:'+(isOnPlatform?15:13)+'px;color:#fff">'+a.name+'</span>';
    // Club/país + peso corporal. El club se omite cuando repite lo que ya dice la
    // bandera: en un sudamericano, "Brasil" al lado de la bandera brasileña gasta
    // ancho sin agregar nada. En un nacional el club sí dice algo y se muestra.
    {
      const _cl=String(a.club||'').trim();
      const _pn=String(_ctryName(_ctry(a))||'').trim();
      const _clV=(_cl&&_variosPaises()&&_cl.toLowerCase()===_pn.toLowerCase())?'':(_cl?_cl+' · ':'');
      h += _enLinea
        ? '<span style="font-family:Oswald,sans-serif;font-size:12px;font-weight:500;color:rgba(220,230,245,.9);flex-shrink:0">'+_clV+(a.bw?(+a.bw).toFixed(1)+' kg':'—')+'</span>'
        : '<div style="font-family:Oswald,sans-serif;font-size:12px;font-weight:500;color:rgba(220,230,245,.9);margin-top:1px">'+_clV+(a.bw?(+a.bw).toFixed(1)+' kg':'—')+'</div>';
    }
    // El puesto virtual, pegado al nombre. Va acá y no en una columna porque la
    // columna quedaría a la derecha del todo, fuera de la pantalla del teléfono.
    // El clon del 4º intento no tiene puesto propio: se busca el del atleta real.
    h += _virtualHtml(VIRT[_realAth(a).id],_enLinea);
    h += _nomChips(a,_enLinea?.92:1,_enLinea);
    h += (_enLinea?'</div>':'')+'</td>';

    // Atleta REAL detrás de la entrada (el clon del 4º redirige su att) + índice
    // del intento actual (3 si está en su intento extra, si no la ronda activa).
    const ra=_realAth(a), ci=curAtt(a);
    // SQ / BP / DL con subtotales
    ['sq','bp','dl'].forEach(l=>{
      const isCurLift = l===DATA.lift;
      const bg = isCurLift ? LIFT_C[l]+'0b' : 'transparent';
      // intentos (3, o 4 si hubo extra en la tabla)
      for(let j=0;j<maxAtts[l];j++){
        const at=ra.att[l][j];
        if(!at){ h += '<td style="padding:2px;background:'+bg+'"><div class="att att-e" style="font-size:11px;padding:6px 3px;min-width:46px;text-align:center;color:var(--border)">·</div></td>'; continue; }
        const isCurAtt = isCurLift && isOnPlatform && j===ci;
        const cls = at.r==='g'?'att-g':at.r==='n'?'att-n':at.w>0?'att-p':'att-e';
        // La casilla entera toma el color del resultado, de borde a borde, como
        // en la tabla de la pantalla de tarima (lv-solido en livecast.html).
        // Récord sudamericano: el público ve la misma marca amarilla que el control.
        // Con lv-rec el borde amarillo va por el contorno de la casilla completa,
        // con el cartel RÉCORD adentro, en vez de una cajita encima del color.
        const srR2=_srRompe(ra,l,at.w), srOk2=srR2.length&&at.r==='g';
        h += '<td class="lv-att lv-'+cls.slice(4)+(srR2.length?' lv-rec':'')+'" style="padding:2px;background:'+bg+'">';
        const srCss2='';   // el color de adentro es el del intento, como en el control
        if(srR2.length)h+='<div class="rec-caja"><div class="'+(srOk2?'':'rec-tag')+'" style="font-size:8.5px;'
          +'font-weight:800;letter-spacing:.5px;line-height:1;margin-bottom:2px;text-align:center;color:#fff">'
          +(srOk2?'<i class=yl-i-estrella></i> RÉCORD':'RÉCORD')+'</div>';
        h += '<div class="'+cls+' att'+(srR2.length?' rec-borde':'')+'"'+(srR2.length?' title="'+_srBadge(srR2).replace(/"/g,'&quot;')+'"':'')+' style="font-size:'+(isCurAtt?18:15)+'px;font-weight:700;padding:'+(isCurAtt?'10px 3px':'6px 3px')+';cursor:default;'+srCss2+(isCurAtt?'box-shadow:inset 0 0 0 2px '+LIFT_C[l]+';':'')+'min-width:46px;text-align:center">'+(at.w?(+at.w).toFixed(1):'—')+'</div>'+(srR2.length?'</div>':'');
        // El que acaba de salir a tarima: cartelito chico bajo su intento, para
        // no perder de vista por dónde va la tanda cuando la lista se reordena.
        if(ultimo && !a.__is4 && ra.id===ultimo.id && l===ultimo.lift && j===ultimo.round)
          h += '<div style="font-family:Oswald;font-size:7px;letter-spacing:.5px;color:var(--muted);text-align:center;line-height:1.2;margin-top:1px">RECIÉN SALIÓ</div>';
        h += '</td>';
      }
      // Subtotal / Total
      let sub = null;
      const bSQ=bestOf(ra,'sq')||0, bBP=bestOf(ra,'bp')||0, bDL=bestOf(ra,'dl')||0;
      if(l==='sq')      sub = bSQ||null;
      else if(l==='bp') sub = (bSQ||bBP) ? (bSQ+bBP)||null : null;
      else              return;               // el peso muerto no lleva subtotal: van los tres totales
      // El subtotal con el color de su movimiento, como la columna de mejor
      // intento de la pantalla de tarima.
      h += '<td class="lv-sub lv-sub-'+l+'" style="text-align:center;padding:3px;border-right:1px solid var(--border)">';
      h += '<span style="font-family:Oswald;font-size:'+(sub?14:10)+'px;font-weight:700;color:'+(sub?(l==='sq'?'#7fb6ff':'var(--gold)'):'rgba(100,120,150,.5)')+';">'+(sub?(+sub).toFixed(1):'—')+'</span>';
      h += '</td>';
    });

    // Los tres totales
    {
      const bSQ=bestOf(ra,'sq')||0, bBP=bestOf(ra,'bp')||0, bDL=bestOf(ra,'dl')||0;
      const actual=bSQ+bBP+bDL;
      const dq=isDQ(ra);
      const proy=dq?0:(_proyLift(ra,'sq')||0)+(_proyLift(ra,'bp')||0)+(_proyLift(ra,'dl')||0);
      const fin=(bSQ&&bBP&&bDL)?actual:0;
      const celda=(v,col,grande,borde)=>'<td style="text-align:center;padding:3px;'+(borde?'border-right:1px solid var(--border)':'')+'">'
        +'<span style="font-family:Oswald;font-size:'+(v?(grande?14:13):10)+'px;font-weight:700;color:'+(v?col:'rgba(100,120,150,.5)')+'">'+(v?(Math.round(v*10)/10):'—')+'</span></td>';
      h += celda(actual,'#e5e7eb',false,false);
      h += celda(proy,'#f59e0b',false,false);
      h += celda(fin,'var(--gold)',true,true);
    }

    // GLP
    const tot = totalOf(ra);
    const glp = tot ? calcGL(tot,ra.bw,ra.sex,_glMod(ra)) : null;
    h += '<td style="text-align:center;padding:3px 5px">';
    h += '<span style="font-family:Oswald;font-size:'+(glp?12:9)+'px;font-weight:700;color:'+(glp?'var(--gold)':'rgba(100,120,150,.5)')+';">'+(glp||'—')+'</span>';
    h += '</td>';
    h += _posCellHtml(a,{fs:11});
    h += '</tr>';
  });

  h += '</tbody></table></div>';
  // Para volver a seguir a la tarima después de haberse movido. Aparece solo
  // cuando la pantalla quedó libre; con una tanda elegida a mano ya está el
  // aviso de arriba con su propio botón.
  _seguirTarima();
  h += '<button id="btnSeguirTarima" onclick="liveSeguirTarima()" style="'
    +((window._siguiendoTarima===false&&!libre)?'':'display:none;')
    +'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom, 0px));z-index:60;'
    +'padding:9px 16px;border-radius:999px;border:1px solid rgba(34,197,94,.6);background:rgba(10,22,40,.92);color:#4ade80;'
    +'font-family:Oswald;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.45);white-space:nowrap">'
    +'↓ AL QUE ESTÁ EN TARIMA</button>';
  h += '</div>';

  // Auto-scroll al atleta actual solo cuando cambia
  setTimeout(()=>{
    const el = document.getElementById('liveCurrentLifter');
    if(!el) return;
    // Con una tanda elegida a mano no se mueve la pantalla sola: el espectador
    // está mirando ahí a propósito.
    if(window.NAV_LIBRE) return;
    const flQ = liftQueue();
    const curId = (flQ[0]==null?void 0:flQ[0].id);
    const key = currentFlight+'_'+DATA.lift+'_'+DATA.round+'_'+(curId||'');
    if(window._liveLastKey !== key){
      window._liveLastKey = key;
      // Si el espectador movió la pantalla, está mirando otra cosa a propósito:
      // ni un peso nuevo ni un válido se la pueden arrebatar (ver _seguirTarima).
      if(!_seguirTarima()) return;
      el.scrollIntoView({behavior:'smooth',block:'center'});
    }
  }, 200);
  return h;
}

function renderAtletaInfo(){
  _pedirFotos();
  const ath=DATA.athletes;
  // Si hay alguien de afuera, se baja la nómina para poder mostrarle sus marcas
  // nominadas. Si son todos chilenos no hace falta y no se pide.
  if(ath.some(a=>!_esDeChile(a)))_cargarMarcasSuda();
  let h='<div class="fade"><h2 class="os" style="font-size:22px;letter-spacing:1px;margin-bottom:16px">ATLETAS DEL CAMPEONATO</h2>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">';
  ath.forEach(a=>{
    // Cross-reference with data.json
    const db=findInDB(a.name,a.rut,a);
    const bl=(db==null?void 0:db.bestLifts)||{};
    const comps=(db==null?void 0:db.competencias)||[];
    const debut=(db==null?void 0:db.debut)||'';
    const codigo=(db==null?void 0:db.codigo)||'';
    const compCount=comps.length;
    const compWithResults=comps.filter(c=>c.resultado).length;
    
    // Current competition lifts
    const curSq=bestOf(a,'sq'),curBp=bestOf(a,'bp'),curDl=bestOf(a,'dl');
    const curTotal=totalOf(a);const curGL=calcGL(curTotal,a.bw,a.sex,_glMod(a));
    
    // Career PRs from DB
    const prSq=bl.sq||0,prBp=bl.bp||0,prDl=bl.dl||0,prTotal=bl.total||0;
    
    const initials=(a.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const matched=!!db;
    
    h+='<div class="card" style="padding:16px">';
    
    // Header: photo + name
    h+='<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">';
    // Los extranjeros no están en el padrón de la federación, así que `db` es
    // nulo y quedaban con las iniciales aunque su foto estuviera cargada: vive en
    // la nómina del Sudamericano, que se busca por nombre. De los 416 atletas,
    // 231 tienen foto ahí.
    const fotoUrl=(db==null?void 0:db.foto_url)||(_fotoSudaFor(a)||{}).foto_url||'';
    h+='<div style="width:64px;height:64px;border-radius:12px;background:var(--bg);border:2px solid '+(fotoUrl?'rgba(212,168,67,.5)':'var(--border)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;overflow:hidden">';
    h+='<span style="font-family:Oswald;font-size:22px;font-weight:700;color:var(--border);position:absolute">'+initials+'</span>';
    if(fotoUrl){
      h+='<img src="'+fotoUrl+'" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;right:0;bottom:0;left:0" onerror="this.remove()">';
    }
    h+='</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center">'+_insignia(a,13)+'<span style="overflow:hidden;text-overflow:ellipsis">'+a.name+'</span></div>';
    if(codigo)h+='<div style="font-size:10px;color:var(--gold);font-family:Oswald;letter-spacing:.5px">'+codigo+'</div>';
    h+='<div style="font-size:11px;color:var(--muted);margin-top:2px">'+a.div+' · '+a.cat+'</div>';
    h+='<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted)">'+(window.clubLogoImg?window.clubLogoImg(a.club,16,'background:rgba(10,22,40,.4);padding:1px;'):'')+'<span>'+a.club+(debut?' · Debut '+debut:'')+'</span></div>';
    h+='<span class="flight-badge" style="background:'+(FL_C[a.flight]||'#666')+';margin-top:4px;display:inline-block">Vuelo '+a.flight+'</span>';
    h+='</div></div>';
    
    // Career PR section (from DB)
    if(prSq||prBp||prDl){
      h+='<div style="margin-bottom:8px"><div style="font-size:9px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-bottom:4px">MEJORES MARCAS (CARRERA)</div>';
      h+='<div style="display:flex;gap:6px">';
      if(prSq)h+='<div style="flex:1;text-align:center;padding:5px 4px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:6px"><div style="font-size:8px;color:#3b82f6;font-family:Oswald">SQ</div><div class="os" style="font-size:15px;font-weight:700">'+prSq+'</div></div>';
      if(prBp)h+='<div style="flex:1;text-align:center;padding:5px 4px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:6px"><div style="font-size:8px;color:#f59e0b;font-family:Oswald">BP</div><div class="os" style="font-size:15px;font-weight:700">'+prBp+'</div></div>';
      if(prDl)h+='<div style="flex:1;text-align:center;padding:5px 4px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:6px"><div style="font-size:8px;color:#ef4444;font-family:Oswald">DL</div><div class="os" style="font-size:15px;font-weight:700">'+prDl+'</div></div>';
      if(prTotal)h+='<div style="flex:1;text-align:center;padding:5px 4px;background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.2);border-radius:6px"><div style="font-size:8px;color:var(--gold);font-family:Oswald">TOTAL</div><div class="os" style="font-size:15px;font-weight:700">'+prTotal+'</div></div>';
      h+='</div></div>';
    }
    
    // Current competition lifts
    if(curSq||curBp||curDl){
      h+='<div style="margin-bottom:8px"><div style="font-size:9px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-bottom:4px">HOY</div>';
      h+='<div style="display:flex;gap:6px">';
      if(curSq){const isPR=prSq&&curSq>=prSq;h+='<div style="flex:1;text-align:center;padding:5px 4px;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.4);border-radius:6px"><div style="font-size:8px;color:#3b82f6;font-family:Oswald">SQ'+(isPR?' PR':'')+'</div><div class="os" style="font-size:15px;font-weight:700">'+curSq+'</div></div>';}
      if(curBp){const isPR=prBp&&curBp>=prBp;h+='<div style="flex:1;text-align:center;padding:5px 4px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);border-radius:6px"><div style="font-size:8px;color:#f59e0b;font-family:Oswald">BP'+(isPR?' PR':'')+'</div><div class="os" style="font-size:15px;font-weight:700">'+curBp+'</div></div>';}
      if(curDl){const isPR=prDl&&curDl>=prDl;h+='<div style="flex:1;text-align:center;padding:5px 4px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);border-radius:6px"><div style="font-size:8px;color:#ef4444;font-family:Oswald">DL'+(isPR?' PR':'')+'</div><div class="os" style="font-size:15px;font-weight:700">'+curDl+'</div></div>';}
      if(curTotal)h+='<div style="flex:1;text-align:center;padding:5px 4px;background:rgba(212,168,67,.15);border:1px solid rgba(212,168,67,.4);border-radius:6px"><div style="font-size:8px;color:var(--gold);font-family:Oswald">TOTAL</div><div class="os" style="font-size:15px;font-weight:700">'+curTotal+'</div></div>';
      h+='</div></div>';
    }
    
    // Competition history from DB
    if(compCount>0){
      h+='<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px">';
      h+='<div style="font-size:9px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-bottom:4px">HISTORIAL · '+compCount+' competencias</div>';
      const recent=comps.filter(c=>c.resultado).slice(-4).reverse();
      recent.forEach(c=>{
        const r=c.resultado||{};
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:10px">';
        h+='<span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+(c.internacional?'[INT] ':'')+c.evento+'</span>';
        h+='<span class="os" style="color:var(--gold);font-weight:700;margin-left:8px;flex-shrink:0">'+(r.total?r.total+'kg':'—')+'</span>';
        h+='</div>';
      });
      if(compWithResults>4)h+='<div style="font-size:9px;color:var(--muted);text-align:center;margin-top:2px">+'+(compWithResults-4)+' más</div>';
      h+='</div>';
    }else if(!matched){
      // Al extranjero, en vez de un hueco, lo que sí se sabe de él: las marcas con
      // las que su federación lo nominó. Van rotuladas NOMINADAS porque no son
      // marcas hechas en competencia.
      const mn=_esDeChile(a)?null:_marcasSudaFor(a);
      if(mn){
        const kg=v=>v>0?String(v).replace(/\.0$/,''):'—';
        h+='<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px">';
        h+='<div style="font-size:9px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-bottom:4px">MARCAS NOMINADAS'+(mn.mod?' · '+mn.mod:'')+'</div>';
        h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center">';
        [['SQ',mn.sq,'#3b82f6'],['BP',mn.bp,'#f59e0b'],['DL',mn.dl,'#ef4444'],['TOTAL',mn.total,'var(--gold)']].forEach(([l,v,c])=>{
          h+='<div style="background:rgba(10,22,40,.5);border-radius:6px;padding:5px 2px">'
            +'<div style="font-size:8px;color:var(--muted);font-family:Oswald;letter-spacing:1px">'+l+'</div>'
            +'<div style="font-family:Oswald;font-size:14px;font-weight:700;color:'+c+'">'+kg(v)+'</div></div>';
        });
        h+='</div>';
        h+='<div style="font-size:9px;color:var(--muted);font-style:italic;margin-top:5px;text-align:center">Lo declarado por su federación al inscribirlo, no marcas de competencia</div>';
        h+='</div>';
      }else{
        // "Atleta nuevo" solo vale para un chileno que compite por primera vez. Un
        // extranjero no es nuevo: tiene su carrera, pero en el padrón de SU
        // federación, y este padrón es el chileno. Decirle nuevo es falso y encima
        // invita a buscarle un historial que acá nunca va a estar.
        h+='<div style="text-align:center;padding:8px;color:var(--muted);font-size:10px;font-style:italic;border-top:1px solid var(--border);margin-top:4px">'
          +(_esDeChile(a)?'Atleta nuevo — sin historial':'Atleta extranjero — su historial no está en el padrón chileno')
          +'</div>';
      }
    }
    
    h+='</div>';
  });
  h+='</div></div>';
  return h;
}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

window.ytToggle=function(){ window._ytOculto=!window._ytOculto; _ytSync(); };

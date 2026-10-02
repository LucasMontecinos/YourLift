// livecast.html — La pantalla de tarima (?tx=screen): su control, la tabla de jornada, atleta en barra, intentos, descanso y logos.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

async function _screenPush(){
  // Modo práctica: sin Firebase. El estado de la pantalla (modo/tandas/tamaño) va
  // por localStorage; la otra pestaña (?tx=screen&practica=1) lo lee por 'storage'.
  if(PRACTICE_MODE){
    try{localStorage.setItem(PRACTICE_SCREEN_KEY,JSON.stringify({
      mode:window._SCREEN_LOCAL.mode,
      flights:window._SCREEN_LOCAL.flights,
      nameScale:window._SCREEN_LOCAL.nameScale||1,
      fondo:window._SCREEN_LOCAL.fondo||'bandera',
      veloBandera:typeof window._SCREEN_LOCAL.veloBandera==='number'?window._SCREEN_LOCAL.veloBandera:0.55,
      tamLogoClub:typeof window._SCREEN_LOCAL.tamLogoClub==='number'?window._SCREEN_LOCAL.tamLogoClub:72,
      luces:!!window._SCREEN_LOCAL.luces,
      ts:Date.now()
    }));}catch(e){}
    return;
  }
  if(!fbReady||!DATA.event){showToastLC('Sin evento activo');return;}
  const id=_screenDocId();
  try{
    await window._fb.setDoc(window._fb.doc(fbDB,'livecast_screen',id),{
      mode:window._SCREEN_LOCAL.mode,
      flights:window._SCREEN_LOCAL.flights,
      nameScale:window._SCREEN_LOCAL.nameScale||1,
      fondo:window._SCREEN_LOCAL.fondo||'bandera',
      veloBandera:typeof window._SCREEN_LOCAL.veloBandera==='number'?window._SCREEN_LOCAL.veloBandera:0.55,
      tamLogoClub:typeof window._SCREEN_LOCAL.tamLogoClub==='number'?window._SCREEN_LOCAL.tamLogoClub:72,
      luces:!!window._SCREEN_LOCAL.luces,
      ts:Date.now()
    });
  }catch(e){showToastLC('Error: '+e.message);}
}

function renderScreenControl(){
  if(fbReady&&!_screenUnsub)subscribeScreenChannel(); // cargar estado guardado (modo/tandas/tamaño)
  const flights=[...new Set(DATA.athletes.map(a=>a.flight))].sort(_cmpFl);
  const sel=window._SCREEN_LOCAL.flights;
  const mode=window._SCREEN_LOCAL.mode;
  const base=location.origin+location.pathname.replace(/[^/]*$/,'');
  const enc=encodeURIComponent((DATA.event==null?void 0:DATA.event.name)||'');
  const screenUrl=base+'livecast.html?tx=screen&evento='+enc+PRACTICE_Q;
  const jornadaUrl=base+'livecast.html?tx=jornada&evento='+enc+PRACTICE_Q;
  let h='<div style="max-width:920px">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px">';
  h+='<div><h2 class="os" style="font-size:22px;letter-spacing:1px">PANTALLA DE TARIMA</h2><p style="color:var(--muted);font-size:12px">Control independiente del Control TX. Alterna entre el perfil del atleta, la barra con discos (estilo LiftingCast) y la tabla de la jornada. Se actualiza en vivo en la pantalla. Pensada para un monitor en el lugar de la competencia — no se transmite al stream online.</p></div>';
  h+='</div>';

  // URL de la pantalla
  h+='<div class="card" style="margin-bottom:16px"><div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:8px">URL PARA LA PANTALLA (ábrela en el navegador de la pantalla / OBS)</div>';
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
  h+='<input readonly value="'+screenUrl+'" onclick="this.select()" style="flex:1;min-width:280px;padding:10px 12px;background:rgba(10,22,40,.6);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;font-family:monospace">';
  h+='<button onclick="navigator.clipboard.writeText(\''+screenUrl+'\');showToastLC(\'Copiado\')" style="padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-family:Oswald;font-size:12px;font-weight:700;cursor:pointer">COPIAR</button>';
  h+='<a href="'+screenUrl+'" target="_blank" style="padding:10px 16px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:8px;font-family:Oswald;font-size:12px;font-weight:700;text-decoration:none">ABRIR ↗</a>';
  h+='</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-top:8px">Esta pantalla obedece los botones de abajo en tiempo real: sirve para el televisor que va cambiando durante la competencia. Si tienes más de una pantalla y cada una tiene que mostrar algo distinto, usa los links de abajo.</div>';
  h+='</div>';

  // ── LOGOS DE LA PANTALLA ──────────────────────────────────
  //
  // Se suben una vez y quedan guardados con el campeonato: no hay que volver a
  // ponerlos cada vez que se entra. Salen en TODAS las escenas de la pantalla.
  {
    const subidos=Array.isArray(DATA.event&&DATA.event.logosPantalla)?DATA.event.logosPantalla:[];
    h+='<div class="card" style="margin-bottom:16px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">';
    h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold)">LOGOS DE LA PANTALLA</div>';
    h+='<button id="scrLogosBtn" onclick="screenLogosSubir()" style="padding:8px 14px;background:rgba(34,197,94,.15);border:1px solid var(--green);color:var(--green);border-radius:8px;font-family:Oswald;font-size:12px;font-weight:700;cursor:pointer"><i class=yl-i-subir></i> Agregar logos</button>';
    h+='</div>';
    h+='<div style="font-size:11px;color:var(--muted);line-height:1.55;margin-bottom:10px">Los que se suban acá salen en <b>todas</b> las escenas de la pantalla: perfil, atleta en barra, intentos, luces y tabla de la jornada. Puedes poner los que quieras —campeonato, federación, auspiciadores— y quedan guardados con el campeonato, así que no hay que volver a subirlos.</div>';
    if(!subidos.length){
      h+='<div style="font-size:11px;color:var(--muted);padding:12px 14px;border:1px dashed rgba(212,225,245,.25);border-radius:8px;line-height:1.5">'
        +'Todavía no hay ninguno. Mientras tanto la pantalla muestra el logo de la <b>federación</b> y el del <b>campeonato</b>, los que estén cargados en la ficha. '
        +'Al subir el primero, esta lista reemplaza a esos dos.</div>';
    }else{
      h+='<div style="display:flex;gap:10px;flex-wrap:wrap">';
      subidos.forEach((lg,i)=>{
        h+='<div style="width:132px;border:1px solid var(--border);border-radius:9px;padding:8px;background:rgba(10,22,40,.5)">'
          +'<div style="height:56px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border-radius:6px;overflow:hidden">'
          +'<img src="'+esc(lg.url||'')+'" alt="" style="max-height:52px;max-width:118px;object-fit:contain" onerror="this.style.display=\'none\'"></div>'
          +'<div style="font-size:9.5px;color:var(--muted);margin:5px 0 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(lg.nombre||'')+'">'+esc(lg.nombre||('Logo '+(i+1)))+'</div>'
          +'<div style="display:flex;gap:4px">'
          +'<button onclick="screenLogoMover('+i+',-1)"'+(i===0?' disabled':'')+' title="Mover a la izquierda" style="flex:1;padding:4px;border-radius:5px;border:1px solid var(--border);background:transparent;color:'+(i===0?'rgba(220,230,245,.25)':'var(--text)')+';cursor:'+(i===0?'default':'pointer')+';font-size:11px">←</button>'
          +'<button onclick="screenLogoMover('+i+',1)"'+(i===subidos.length-1?' disabled':'')+' title="Mover a la derecha" style="flex:1;padding:4px;border-radius:5px;border:1px solid var(--border);background:transparent;color:'+(i===subidos.length-1?'rgba(220,230,245,.25)':'var(--text)')+';cursor:'+(i===subidos.length-1?'default':'pointer')+';font-size:11px">→</button>'
          +'<button onclick="screenLogoBorrar('+i+')" title="Sacar de la pantalla" style="flex:1;padding:4px;border-radius:5px;border:1px solid rgba(239,68,68,.5);background:transparent;color:#ef4444;cursor:pointer;font-size:11px"><i class=yl-i-cerrar></i></button>'
          +'</div></div>';
      });
      h+='</div>';
      h+='<div style="font-size:10.5px;color:var(--muted);margin-top:9px">Salen en ese orden, de izquierda a derecha. En las pantallas de <b>atleta en barra</b> e <b>intentos</b> van juntos en un bloque que se puede mover y agrandar como los demás.</div>';
    }
    h+='</div>';
  }

  // ── UN LINK POR PANTALLA ──────────────────────────────────
  //
  // El link de arriba obedece al panel, y ese es el problema cuando hay dos
  // televisores: al cambiar lo que muestra uno se le cambia también el otro.
  // Estos links llevan el modo adentro, así que cada pantalla queda clavada en
  // lo suyo y no la mueve nadie. El fondo, el difuminado y el resto se siguen
  // ajustando desde el panel para todas.
  {
    const fijo=(m)=>screenUrl+'&modo='+m;
    const fila=(m,lbl,col,nota)=>{
      const u=fijo(m);
      return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:9px 0;border-top:1px solid rgba(29,49,80,.4)">'
        +'<div style="min-width:190px;flex:0 0 auto"><div style="font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;color:'+col+'">'+lbl+'</div>'
        +'<div style="font-size:10px;color:var(--muted);line-height:1.4">'+nota+'</div></div>'
        +'<input readonly value="'+u+'" onclick="this.select()" style="flex:1;min-width:220px;padding:7px 10px;background:rgba(10,22,40,.6);border:1px solid var(--border);border-radius:7px;color:var(--muted);font-size:11px;font-family:monospace">'
        +'<button onclick="navigator.clipboard.writeText(\''+u+'\');showToastLC(\'Copiado\')" style="padding:7px 13px;background:var(--accent);color:#fff;border:none;border-radius:7px;font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer">COPIAR</button>'
        +'<a href="'+u+'" target="_blank" style="padding:7px 13px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:7px;font-family:Oswald;font-size:11px;font-weight:700;text-decoration:none">ABRIR ↗</a>'
        +'</div>';
    };
    h+='<div class="card" style="margin-bottom:16px">';
    h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:4px">UN LINK POR PANTALLA</div>';
    h+='<div style="font-size:11px;color:var(--muted);line-height:1.55;margin-bottom:6px">Cada uno abre SOLO lo que dice y no cambia aunque se toquen los botones de abajo. Son para los televisores que muestran siempre lo mismo: uno con los intentos, otro con las luces, otro con el perfil.</div>';
    h+=fila('intentos','PANTALLA DE INTENTOS','#22c55e','La tabla de intentos del atleta en barra');
    h+=fila('luces','LUCES JUECES','#f0f0f0','Las tres luces a pantalla completa');
    h+=fila('barra','ATLETA EN BARRA','#a855f7','Nombre, peso y discos');
    h+=fila('profile','PERFIL ATLETA','#3b82f6','Foto y datos del atleta');
    h+=fila('jornada','TABLA JORNADA','#D4A843','La tabla de toda la jornada');
    h+='</div>';
  }

  // Modo
  const mb=(m,lbl,ic,col)=>'<button onclick="screenSetMode(\''+m+'\')" style="flex:1;min-width:160px;padding:18px;border-radius:12px;border:2px solid '+(mode===m?col:'var(--border)')+';background:'+(mode===m?col+'22':'transparent')+';color:'+(mode===m?col:'var(--text)')+';font-family:Oswald;font-size:16px;font-weight:700;letter-spacing:1px;cursor:pointer">'+(ic?ic+' ':'')+lbl+(mode===m?' ●':'')+'</button>';
  h+='<div class="card" style="margin-bottom:16px"><div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:12px">QUÉ MOSTRAR EN LA PANTALLA</div>';
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap">';
  h+=mb('profile','PERFIL ATLETA','','#3b82f6');
  h+=mb('barra','ATLETA EN BARRA','','#a855f7');
  h+=mb('intentos','PANTALLA DE INTENTOS','','#22c55e');
  h+=mb('jornada','TABLA JORNADA','','#D4A843');
  h+=mb('luces','LUCES JUECES','','#f0f0f0');
  h+=mb('off','APAGAR','','#ef4444');
  h+='</div></div>';
  if(mode==='luces'){
    h+='<div class="card" style="padding:12px 18px;margin-bottom:16px;font-size:11px;color:var(--muted);line-height:1.55">'
      +'Pantalla completa con las tres luces y el nombre del atleta arriba. Sigue en vivo lo que marcan los jueces desde <span style="color:var(--gold);font-family:monospace">yourlift.cl/jueces</span>. '
      +'Es un espejo: el válido o nulo se sigue dando en Control en Vivo o en la planilla.</div>';
  }

  // Luces de jueces: solo aplica a las dos pantallas que muestran al atleta.
  if(mode==='barra'||mode==='intentos'){
    const on=!!window._SCREEN_LOCAL.luces;
    h+='<div class="card" style="padding:14px 18px;margin-bottom:16px;border-left:4px solid '+(on?'var(--green)':'var(--border)')+'">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">';
    h+='<div style="flex:1;min-width:260px"><div style="font-family:Oswald;font-size:15px;font-weight:700;letter-spacing:1px">Luces de jueces en pantalla</div>';
    h+='<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5">Muestra las tres luces abajo, sincronizadas con las de los jueces. Es solo un espejo: el válido o nulo se sigue dando en Control en Vivo o en la planilla, esta pantalla no decide nada. Si el campeonato no usa luces, se apaga y desaparece.</div></div>';
    h+='<button class="btn '+(on?'btn-r':'btn-g')+'" onclick="screenToggleLuces()" style="padding:12px 24px;font-family:Oswald;font-weight:700;letter-spacing:1px;min-width:150px">'+(on?'QUITAR':'MOSTRAR')+'</button>';
    h+='</div></div>';
  }

  // Fondo del modo "Atleta en barra". La cadena se corta en el primero que exista:
  // si se elige el logo y el campeonato no tiene uno cargado, queda el azul.
  if(mode==='barra'){
    const fondo=window._SCREEN_LOCAL.fondo||'bandera';
    const hayLogo=!!(DATA.event&&DATA.event.logoUrl);
    const fb2=(f,lbl,nota)=>'<button onclick="screenSetFondo(\''+f+'\')" style="flex:1;min-width:190px;padding:13px;border-radius:10px;border:2px solid '
      +(fondo===f?'#a855f7':'var(--border)')+';background:'+(fondo===f?'rgba(168,85,247,.13)':'transparent')
      +';color:'+(fondo===f?'#a855f7':'var(--text)')+';font-family:Oswald;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer;text-align:left">'
      +lbl+(fondo===f?' ●':'')+'<div style="font-size:10px;font-weight:400;letter-spacing:0;opacity:.75;margin-top:3px">'+nota+'</div></button>';
    h+='<div class="card" style="margin-bottom:16px"><div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:12px">FONDO DE LA PANTALLA</div>';
    h+='<div style="display:flex;gap:10px;flex-wrap:wrap">';
    // Con un solo país esa misma opción pone el logo del club del atleta.
    h+=_variosPaises()?fb2('bandera','BANDERA DEL PAÍS','Los colores del país del atleta, muy diluidos')
      :fb2('bandera','LOGO DEL CLUB','Un solo país: el logo del club de cada atleta');
    h+=fb2('logo','LOGO DEL CAMPEONATO',hayLogo?'El logo que subiste en Campeonatos':'Este campeonato no tiene logo cargado → queda azul');
    h+=fb2('yourlift','AZUL YOURLIFT','El fondo de siempre');
    h+='</div>';
    if(!hayLogo)h+='<div style="font-size:11px;color:var(--muted);margin-top:10px">El logo se carga en Admin → Campeonatos, en la ficha del campeonato.</div>';
    // Cuánto se difumina la bandera. Depende de la luz del lugar y del proyector:
    // lo que en un gimnasio se lee perfecto, en otro queda lavado.
    if(fondo==='bandera'){
      const vb=typeof window._SCREEN_LOCAL.veloBandera==='number'?window._SCREEN_LOCAL.veloBandera:0.55;
      h+='<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">';
      h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:6px">'+(_variosPaises()?'QUÉ TAN DIFUMINADA VA LA BANDERA':'QUÉ TAN DIFUMINADO VA EL LOGO DEL CLUB')+'</div>';
      h+='<p style="font-size:11px;color:var(--muted);margin-bottom:12px">A la izquierda la bandera se ve más; a la derecha queda más tapada y el nombre resalta más. Se aplica en vivo — muévelo mirando la pantalla.</p>';
      h+='<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
      h+='<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px">'+(_variosPaises()?'BANDERA':'LOGO')+'</span>';
      h+='<input id="scrVeloRange" type="range" min="0.15" max="0.85" step="0.05" value="'+vb+'" oninput="screenSetVelo(this.value)" style="flex:1;min-width:200px;accent-color:#a855f7;cursor:pointer">';
      h+='<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px">NOMBRE</span>';
      h+='<span id="scrVeloPct" style="font-family:Oswald;font-size:16px;font-weight:700;color:#a855f7;min-width:56px;text-align:center">'+Math.round(vb*100)+'%</span>';
      h+='<button onclick="screenSetVelo(0.55)" style="padding:8px 14px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:8px;font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer">NORMAL</button>';
      h+='</div></div>';
    }
    // Con un solo país el fondo es el logo del club del atleta: se puede agrandar.
    if(fondo==='bandera'&&!_variosPaises()){
      const tl=typeof window._SCREEN_LOCAL.tamLogoClub==='number'?window._SCREEN_LOCAL.tamLogoClub:72;
      h+='<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">';
      h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:6px">TAMAÑO DEL LOGO DEL CLUB</div>';
      h+='<p style="font-size:11px;color:var(--muted);margin-bottom:12px">Campeonato de un solo país: detrás de "Atleta en barra" y de la pantalla de intento va el logo del club de cada atleta. Agrándalo o achícalo mirando la pantalla.</p>';
      h+='<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
      h+='<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px">CHICO</span>';
      h+='<input id="scrTamLogoRange" type="range" min="30" max="130" step="2" value="'+tl+'" oninput="screenSetTamLogo(this.value)" style="flex:1;min-width:200px;accent-color:#a855f7;cursor:pointer">';
      h+='<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px">GRANDE</span>';
      h+='<span id="scrTamLogoPct" style="font-family:Oswald;font-size:16px;font-weight:700;color:#a855f7;min-width:56px;text-align:center">'+tl+'%</span>';
      h+='<button onclick="screenSetTamLogo(72)" style="padding:8px 14px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:8px;font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer">NORMAL</button>';
      h+='</div></div>';
    }
    h+='</div>';
  }

  // Tamaño de los nombres en la tabla
  const nscale=window._SCREEN_LOCAL.nameScale||1;
  h+='<div class="card" style="margin-bottom:16px"><div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:6px">TAMAÑO DE LOS NOMBRES EN LA TABLA</div>';
  h+='<p style="font-size:11px;color:var(--muted);margin-bottom:12px">Ajusta qué tan grandes se ven los nombres de los atletas en la pantalla. Se aplica en vivo.</p>';
  h+='<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
  h+='<button onclick="screenNudgeNameScale(-0.1)" style="width:42px;height:42px;border-radius:10px;border:2px solid var(--border);background:transparent;color:var(--text);font-size:22px;font-weight:700;cursor:pointer;line-height:1">−</button>';
  h+='<input id="scrNameRange" type="range" min="0.6" max="2.2" step="0.05" value="'+nscale+'" oninput="screenSetNameScale(this.value)" style="flex:1;min-width:200px;accent-color:#D4A843;cursor:pointer">';
  h+='<button onclick="screenNudgeNameScale(0.1)" style="width:42px;height:42px;border-radius:10px;border:2px solid var(--border);background:transparent;color:var(--text);font-size:22px;font-weight:700;cursor:pointer;line-height:1">+</button>';
  h+='<span id="scrNamePct" style="font-family:Oswald;font-size:18px;font-weight:700;color:#D4A843;min-width:60px;text-align:center">'+Math.round(nscale*100)+'%</span>';
  h+='<button onclick="screenSetNameScale(1)" style="padding:8px 14px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:8px;font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer">100%</button>';
  h+='</div>';
  h+='<div style="margin-top:12px;padding:10px 14px;background:rgba(10,22,40,.5);border:1px solid var(--border);border-radius:8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"><span style="color:var(--muted);font-size:10px;font-family:Oswald;letter-spacing:1px">VISTA PREVIA:&nbsp;</span><span id="scrNamePrev" style="font-family:Inter,sans-serif;font-weight:600;color:#fff;font-size:'+Math.round(15*nscale)+'px">Catalina Ignacia Gomez Rearte</span></div>';
  h+='</div>';

  // Selector de tandas
  h+='<div class="card"><div style="font-family:Oswald;font-size:12px;letter-spacing:2px;color:var(--gold);margin-bottom:6px">TANDAS EN LA TABLA (la "jornada")</div>';
  h+='<p style="font-size:11px;color:var(--muted);margin-bottom:12px">Elige qué tandas entran en la tabla. Marca las de la sesión AM o PM. Si no marcas ninguna, muestra la tanda activa actual.</p>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  flights.forEach(f=>{
    const on=sel.includes(f);
    const n=DATA.athletes.filter(a=>a.flight===f&&!a.bombed).length;
    h+='<button onclick="screenToggleFlight(\''+f+'\')" style="padding:12px 18px;border-radius:10px;border:2px solid '+(on?'var(--green)':'var(--border)')+';background:'+(on?'rgba(34,197,94,.12)':'transparent')+';color:'+(on?'var(--green)':'var(--text)')+';font-family:Oswald;font-size:15px;font-weight:700;cursor:pointer">'+(on?'<i class=yl-i-check></i> ':'')+'Tanda '+f+'<span style="font-size:10px;opacity:.7;display:block">'+n+' atletas</span></button>';
  });
  h+='</div>';
  h+='<button onclick="screenAllFlights()" style="padding:8px 16px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:8px;font-family:Oswald;font-size:12px;font-weight:700;cursor:pointer">SELECCIONAR TODAS</button>';
  h+='<span style="margin-left:12px;font-size:12px;color:var(--muted)">'+(sel.length?sel.length+' tanda(s): '+sel.join(', '):'ninguna (usa tanda activa)')+'</span>';
  h+='</div>';

  h+='</div>';
  return h;
}

 // mode: 'profile' | 'jornada' | 'barra' | 'intentos' | 'off'
async function loadBirthYears(){
  if(!fbReady||!DATA.event)return;
  try{
    // Las inscripciones se buscan por RUT sin filtrar por evento: traemos TODAS
    // y cruzamos por RUT. Así funciona para sub-tarimas y cualquier evento.
    // Es la colección entera (unas setecientas), así que se guarda en el equipo
    // doce horas: un televisor que se recarga no la vuelve a pedir.
    const snap=await window._fb.getDocs(window._fb.collection(fbDB,'inscripciones'));
    const m={};
    snap.docs.forEach(d=>{
      const x=d.data();
      const k=String(x.rut||'').replace(/[^0-9kK]/gi,'').toUpperCase();
      if(k&&x.fechaNac){ const y=String(x.fechaNac).match(/(\d{4})/); if(y)m[k]=y[1]; }
    });
    Object.assign(window.BIRTH_BY_RUT,m);
    try{localStorage.setItem('yl_nac_rut',JSON.stringify({ts:Date.now(),m:m}));}catch(e){}
    console.log('[screen] fechaNac cargadas:',Object.keys(window.BIRTH_BY_RUT).length);
    if(TX_MODE==='jornada'||TX_MODE==='screen')R();
  }catch(e){console.warn('[screen] loadBirthYears',e.message);}
}

// El año de nacimiento se pide recién cuando la tabla lo necesita y no lo tiene:
// la mayoría de los atletas ya lo trae en la nómina (a.born). Primero se mira lo
// guardado en el equipo; solo si igual falta se va a Firestore, una vez.
function _pedirNacimiento(k){
  if(!window._nacCacheMirada){
    window._nacCacheMirada=true;
    try{
      const o=JSON.parse(localStorage.getItem('yl_nac_rut')||'null');
      if(o&&o.m&&Date.now()-o.ts<12*60*60*1000){
        Object.assign(window.BIRTH_BY_RUT,o.m);
        if(window.BIRTH_BY_RUT[k]){ setTimeout(()=>{if(typeof R==='function')R();},0); return; }
      }
    }catch(e){}
  }
  if(window._nacPedidos||!fbReady||!DATA.event)return;
  window._nacPedidos=true;
  loadBirthYears();
}

function _screenDocId(){
  if(!DATA.event)return null;
  // Con dos tarimas, cada una maneja SU pantalla: si compartieran el canal,
  // cambiar el modo en una le cambiaría la pantalla a la otra en el acto.
  // Es el mismo canal del campeonato (fbDocId). Antes el control escribía en
  // uno armado aparte —60 letras y sin la tarima— y la pantalla escuchaba este:
  // con dos tarimas, o con un nombre largo, el modo elegido no le llegaba.
  return fbDocId();
}

function subscribeScreenChannel(){
  if(!fbReady)return;
  const id=_screenDocId();if(!id)return;
  if(_screenUnsub)return; // evitar suscripciones duplicadas
  try{
    _screenUnsub=window._fb.onSnapshot(window._fb.doc(fbDB,'livecast_screen',id),(snap)=>{
      const d=snap.data()||{};
      // OJO: acá hay que copiar TODO lo que manda el panel. Faltaban `fondo` y
      // `luces`: el panel los guardaba bien en Firestore, pero la pantalla los
      // tiraba al rearmar el estado, así que quedaban en undefined. Por eso las
      // luces no aparecían aunque estuvieran prendidas, y "Atleta en barra" salía
      // siempre azul aunque el fondo estuviera en bandera.
      window._SCREEN_STATE={mode:d.mode||'jornada',flights:Array.isArray(d.flights)?d.flights:null,nameScale:typeof d.nameScale==='number'?d.nameScale:1,
        fondo:d.fondo||'bandera',luces:!!d.luces,
        veloBandera:typeof d.veloBandera==='number'?d.veloBandera:0.55,tamLogoClub:typeof d.tamLogoClub==='number'?d.tamLogoClub:72};
      window._JORNADA_FLIGHTS=window._SCREEN_STATE.flights;
      window._JORNADA_NAMESCALE=window._SCREEN_STATE.nameScale;
      if(window._SCREEN_LOCAL){
        window._SCREEN_LOCAL.nameScale=window._SCREEN_STATE.nameScale;
        if(window._SCREEN_STATE.mode)window._SCREEN_LOCAL.mode=window._SCREEN_STATE.mode;
        if(window._SCREEN_STATE.fondo)window._SCREEN_LOCAL.fondo=window._SCREEN_STATE.fondo;
        window._SCREEN_LOCAL.luces=!!window._SCREEN_STATE.luces;
        window._SCREEN_LOCAL.veloBandera=window._SCREEN_STATE.veloBandera;window._SCREEN_LOCAL.tamLogoClub=window._SCREEN_STATE.tamLogoClub;
        if(Array.isArray(window._SCREEN_STATE.flights))window._SCREEN_LOCAL.flights=window._SCREEN_STATE.flights;
      }
      if(TX_MODE==='screen'||TX_MODE==='jornada')R();
      else if(!TX_MODE&&DATA.phase==='screen'&&_screenFirstSnap)R(); // cargar estado guardado una vez
      _screenFirstSnap=false;
    });
  }catch(e){console.warn('[screen] subscribe',e.message);}
}

// El widget screen: alterna perfil / jornada según el canal de control
function renderTxScreen(c){
  const canal=window._SCREEN_STATE||{mode:'jornada'};
  // Si el link trae el modo, manda el link: esta pantalla muestra siempre lo
  // mismo y no la mueve el panel. Todo lo demás del canal se sigue obedeciendo.
  const st=SCREEN_FIJO?Object.assign({},canal,{mode:SCREEN_FIJO}):canal;
  window._JORNADA_FLIGHTS=st.flights;
  window._JORNADA_NAMESCALE=typeof st.nameScale==='number'?st.nameScale:1;
  if(st.mode==='off'){c.innerHTML='';return;}
  // Perfil, barra e intentos muestran al que está por levantar. Con la ronda
  // recién cerrada, ese es el que abre la siguiente — no el que ya terminó.
  if(st.mode==='profile'||st.mode==='barra'||st.mode==='intentos'){
    return _conCursorQueViene(()=>_renderTxAtletaEnBarra(c,st));
  }
  if(st.mode==='luces'){
    const cur=liftQueue()[0]||DATA.athletes.find(a=>a.flight===DATA.flight&&!a.bombed);
    document.body.classList.add('tx-opaque');
    c.innerHTML=renderScreenLuces(cur||null)+_descCapaHtml()+_descGearHtml();
    return;
  }
  // jornada (default)
  document.body.classList.add('tx-opaque');
  c.innerHTML=renderTxJornada()+_descCapaHtml()+_descGearHtml();
}

function _renderTxAtletaEnBarra(c,st){
  if(st.mode==='profile'){
    const cur=liftQueue()[0]||DATA.athletes.find(a=>a.flight===DATA.flight&&!a.bombed);
    document.body.classList.add('tx-opaque');
    c.innerHTML=(cur?renderTxProfile(cur):'<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;color:rgba(220,230,245,.5);font-family:Oswald;font-size:22px">Sin atleta en tarima</div>')+_descCapaHtml()+_descGearHtml();
    return;
  }
  if(st.mode==='barra'){
    const cur=liftQueue()[0]||DATA.athletes.find(a=>a.flight===DATA.flight&&!a.bombed);
    document.body.classList.add('tx-opaque');
    // Las luces van adentro de renderScreenBarra, como un bloque más que se puede
    // mover; por eso acá no se agregan aparte.
    c.innerHTML=(cur?renderScreenBarra(cur):'<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;color:rgba(220,230,245,.5);font-family:Oswald;font-size:22px">Sin atleta en tarima</div>')+_descCapaHtml()+_descGearHtml();
    return;
  }
  if(st.mode==='intentos'){
    const _piQ=liftQueue();
    const cur=_piQ[0]||DATA.athletes.find(a=>a.flight===DATA.flight&&!a.bombed);
    const nxt=_piQ[1]||null;
    document.body.classList.add('tx-opaque');
    c.innerHTML=(cur?renderScreenIntentos(cur,nxt):'<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;color:rgba(220,230,245,.5);font-family:Oswald;font-size:22px">Sin atleta en tarima</div>')
      +(_lucesEnTarima()?renderLucesTarima():'')+_descCapaHtml();
    return;
  }
}

function _rutN(s){return String(s||'').replace(/[^0-9kK]/gi,'').toUpperCase();}

function _yob2(a){
  // 2 dígitos del año de nacimiento: el de la nómina si viene; si no, por RUT
  // en BIRTH_BY_RUT (que se carga recién la primera vez que falta uno).
  const b=String(a.born||'').match(/(\d{4})/);
  if(b) return b[1].slice(2);
  const k=_rutN(a.rut);
  let fn=k&&window.BIRTH_BY_RUT[k];
  if(!fn){ if(k)_pedirNacimiento(k); return ''; }
  const m=String(fn).match(/(\d{4})/);
  if(!m) return '';
  return m[1].slice(2);
}

// Celda de intento para la PANTALLA DE TARIMA: marca el resultado con COLOR DE FONDO
// (válido = verde, nulo = rojo), legible a distancia en una proyección grande.
function _attTd(at, base){
  if(!at || (!at.w && at.r===null)) return '<td style="'+base+';color:rgba(150,170,200,.30)">—</td>';
  const w=at.w||0; const val=w?w.toFixed(1):'—';
  if(at.r==='g') return '<td style="'+base+';background:rgba(34,197,94,.88);color:#06210f;font-weight:800">'+val+'</td>';
  if(at.r==='n') return '<td style="'+base+';background:rgba(225,40,40,.85);color:#fff;font-weight:800;text-decoration:line-through;text-decoration-thickness:2px">'+val+'</td>';
  // peso declarado, sin juzgar todavía
  return '<td style="'+base+';color:#fff;font-weight:700">'+val+'</td>';
}

function renderTxJornada(){
  // Determinar qué tandas mostrar: las seleccionadas, o la actual si no hay set.
  let flights=window._JORNADA_FLIGHTS;
  if(!flights||!flights.length) flights=[DATA.flight];
  const pool=_conUni(DATA.athletes.filter(a=>flights.includes(a.flight)&&!a.bombed&&!a.__is4));
  if(!pool.length) return '<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;font-family:Oswald;color:rgba(220,230,245,.6);font-size:24px;letter-spacing:3px">SIN ATLETAS EN LAS TANDAS SELECCIONADAS</div>';
  // Agrupar por categoría (sexo|cat|div)
  const groups={};
  pool.forEach(a=>{const k=_catGroupKey(a);(groups[k]=groups[k]||[]).push(a);});
  // Orden de grupos: sexo (M antes F), luego peso asc, luego división
  const DIVO={'Sub Junior':0,'Sub-Junior':0,'Subjunior':0,'Junior':1,'Open':2,'Master I':3,'Master II':4,'Master III':5,'Master IV':6};
  const catNum=c=>{const s=String(c||'');return s.includes('+')?1000+(parseFloat(s)||0):(parseFloat(s)||999);};
  const sexO=s=>(s==='Femenino'||s==='Mujer'||s==='F')?1:0;
  const keys=Object.keys(groups).sort((A,B)=>{
    const a=A.split('|'),b=B.split('|');
    if(sexO(a[0])!==sexO(b[0]))return sexO(a[0])-sexO(b[0]);
    if(catNum(a[1])!==catNum(b[1]))return catNum(a[1])-catNum(b[1]);
    return ((__n=>__n!=null?__n:(9))(DIVO[a[2]]))-((__n=>__n!=null?__n:(9))(DIVO[b[2]]));
  });

  // ── Escalado dinámico: la tabla SIEMPRE llena toda la pantalla ──
  // Calculamos el alto de cada fila según cuántos atletas/categorías hay,
  // de modo que ocupen exactamente el alto disponible (sin sobra ni overflow).
  const VH=(window.innerHeight||1080);
  const topBarH=Math.round(VH*0.075);            // barra de título
  const theadH=Math.round(VH*0.032);             // fila de encabezados de columna
  const availH=Math.max(120,VH-topBarH-theadH-2);
  const peso=ks=>ks.reduce((n,k)=>n+groups[k].length+1.32,0);   // las cabeceras pesan +

  // ── Que entre completa Y se lea de lejos ──────────────────────────────────
  // Antes esto se resolvía achicando la letra sin piso: con varias tandas
  // elegidas la tabla terminaba más alta que la pantalla y, como el contenedor
  // recorta, las últimas filas desaparecían sin avisar. Nadie se entera de que
  // faltan atletas hasta que alguien los busca.
  //
  // Ahora hay un piso de alto de fila —debajo de eso no se lee ni de cerca— y si
  // no entra, se reparte en páginas que van rotando solas. Se pierde el ver todo
  // de un vistazo, pero no se pierde información y lo que se ve se lee.
  const UNIT_MIN=Math.max(14,VH*0.016);
  let paginas=[keys];
  if(availH/peso(keys)<UNIT_MIN){
    const maxPeso=availH/UNIT_MIN;
    paginas=[]; let act=[], w=0;
    keys.forEach(k=>{
      const pk=groups[k].length+1.32;
      // Una categoría no se parte entre dos páginas: se lee como bloque.
      if(act.length&&w+pk>maxPeso){paginas.push(act);act=[];w=0;}
      act.push(k); w+=pk;
    });
    if(act.length)paginas.push(act);
  }
  const nPag=paginas.length;
  if(nPag>1){
    if(!window._jornPagTimer){
      window._jornPagTimer=setInterval(function(){
        window._JORN_PAG=(window._JORN_PAG||0)+1;
        if(typeof R==='function')R();
      },14000);
    }
  }else if(window._jornPagTimer){
    clearInterval(window._jornPagTimer); window._jornPagTimer=null; window._JORN_PAG=0;
  }
  const iPag=nPag>1?((window._JORN_PAG||0)%nPag):0;
  const keysPag=paginas[iPag]||keys;

  const numCats=keysPag.length;
  const numAth=keysPag.reduce((n,k)=>n+groups[k].length,0);
  const weight=numAth*1.0+numCats*1.32;
  const unit=availH/weight;                       // alto de una fila de atleta (px)
  const hdrH=unit*1.32;                            // alto de fila de categoría (px)
  const s=Math.max(.6,Math.min(2.1,unit/26));     // factor de escala de fuente (más grande para proyección)
  const fs=b=>Math.max(8,Math.round(b*s));        // tamaño de fuente escalado
  // Escala extra solo para el NOMBRE, controlable a distancia desde el panel
  const nameScale=(typeof window._JORNADA_NAMESCALE==='number')?window._JORNADA_NAMESCALE:1;

  const H=(t)=>'<th style="padding:0 4px;font-family:Oswald;font-size:'+fs(12)+'px;letter-spacing:1px;color:rgba(220,230,245,.65);font-weight:600">'+t+'</th>';
  let rows='';
  keysPag.forEach(k=>{
    const parts=k.split('|');
    const sexLabel=sexO(parts[0])? 'F':'M';
    const divS=txDivShort(parts[2]);
    // ranking dentro del grupo por total (luego GL)
    const list=groups[k].map(a=>{
      const tot=totalOf(a);
      return {a,tot,gl:calcGL(tot,a.bw,a.sex,_glMod(a))};
    }).sort((x,y)=>(y.tot-x.tot)||(y.gl-x.gl));
    // header de categoría
    rows+='<tr style="height:'+hdrH.toFixed(2)+'px"><td colspan="16" style="padding:0 12px;background:linear-gradient(90deg,rgba(196,30,58,.32),rgba(196,30,58,.05));border-left:'+Math.max(3,Math.round(4*s))+'px solid #C41E3A;vertical-align:middle">'
      +'<span style="font-family:Oswald;font-size:'+fs(16)+'px;font-weight:700;letter-spacing:2px;color:#fff">'+sexLabel+' '+parts[1]+' kg · '+divS+'</span>'
      +'<span style="font-family:Oswald;font-size:'+fs(12)+'px;color:rgba(220,230,245,.6);margin-left:10px;letter-spacing:1px">'+(parts[3]||'').replace('/PL','').replace('/BP',' · ONLY BENCH')+'</span>'
      +'<span style="font-family:Oswald;font-size:'+fs(12)+'px;color:rgba(212,168,67,.85);margin-left:10px">'+list.length+' atletas</span></td></tr>';
    list.forEach((row,i)=>{
      const a=row.a;
      const sub=l=>{const b=bestOf(a,l);return b?b.toFixed(1):'—';};
      const td='vertical-align:middle;text-align:center;font-family:Oswald;font-size:'+fs(14)+'px';
      rows+='<tr style="height:'+unit.toFixed(2)+'px;border-bottom:1px solid rgba(212,168,67,.12);background:'+(i%2?'rgba(255,255,255,.035)':'transparent')+'">'
        +'<td style="'+td+';font-weight:700;color:#D4A843;padding:0 4px">'+(row.tot>0?(i+1):'—')+'</td>'
        // El nombre se corta con puntos suspensivos si no cabe. El text-overflow
        // en la celda no alcanza: una celda de tabla se estira con su contenido,
        // así que el nombre largo se salía encima de la columna del país y
        // quedaba pisando la bandera. El recorte tiene que ir en un bloque de
        // ancho fijo adentro de la celda.
        +'<td style="vertical-align:middle;padding:0 10px;font-family:Inter,sans-serif;font-weight:600;color:#fff;font-size:'+Math.round(fs(15)*nameScale)+'px;max-width:'+Math.round(430*nameScale)+'px"><span style="display:flex;align-items:center;max-width:'+Math.round(420*nameScale)+'px"><span style="flex-shrink:0;display:inline-flex">'+(_variosPaises()?_insignia(a,fs(13)):'')+'</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+a.name+'</span></span></td>'
        // En un nacional la columna es CLUB: el logo grande, y el nombre queda solo.
        +'<td style="'+td+';color:rgba(220,230,245,.85);white-space:nowrap">'+(_variosPaises()?_flagImg(_ctry(a),fs(14),true)+_ctry(a)
          :_logoClub(a,fs(24),'margin-right:0;'))+'</td>'
        +'<td style="'+td+';color:rgba(220,230,245,.65)">'+(_yob2(a)||'—')+'</td>'
        +'<td style="'+td+';color:rgba(220,230,245,.9)">'+(a.bw?a.bw.toFixed(1):'—')+'</td>'
        // SQ 3 intentos + subtotal
        +_attTd(a.att.sq[0],td)
        +_attTd(a.att.sq[1],td)
        +_attTd(a.att.sq[2],td)
        +'<td style="'+td+';font-weight:700;color:#7fb2ff;background:rgba(59,130,246,.16)">'+sub('sq')+'</td>'
        // BP 3 intentos + subtotal
        +_attTd(a.att.bp[0],td)
        +_attTd(a.att.bp[1],td)
        +_attTd(a.att.bp[2],td)
        +'<td style="'+td+';font-weight:700;color:#ffc861;background:rgba(245,158,11,.16)">'+sub('bp')+'</td>'
        // DL 3 intentos + total
        +_attTd(a.att.dl[0],td)
        +_attTd(a.att.dl[1],td)
        +_attTd(a.att.dl[2],td)
        // total + GL
        +'<td style="'+td+';font-size:'+fs(19)+'px;font-weight:800;color:'+(row.tot>0?'#fff':'rgba(150,170,200,.4)')+';background:rgba(212,168,67,.16)">'+(row.tot>0?row.tot.toFixed(1):'—')+'</td>'
        +'<td style="'+td+';font-size:'+fs(16)+'px;font-weight:800;color:#F0C04A">'+(row.gl>0?row.gl.toFixed(2):'—')+'</td>'
        +'</tr>';
    });
  });

  const evName=(DATA.event&&DATA.event.name)||'';
  const flLabel=flights.join(' · ');
  return '<div style="position:absolute;top:0;right:0;bottom:0;left:0;background:linear-gradient(135deg,#0A1628 0%,#0E1F3A 55%,#0A1628 100%);display:flex;flex-direction:column;overflow:hidden">'
    +'<div style="height:'+topBarH+'px;box-sizing:border-box;padding:0 26px;background:rgba(10,22,40,.6);border-bottom:2px solid #D4A843;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">'
      +'<div><div style="font-family:Oswald;font-size:'+Math.round(VH*0.013)+'px;letter-spacing:4px;color:rgba(212,168,67,.85)">TABLA DE CLASIFICACIÓN · JORNADA</div>'
      +'<div style="font-family:Oswald;font-size:'+Math.round(VH*0.024)+'px;font-weight:700;letter-spacing:1px;color:#fff;margin-top:2px">'+evName+' <span style="font-size:'+Math.round(VH*0.015)+'px;color:rgba(212,168,67,.8);margin-left:8px">Tandas: '+flLabel+(nPag>1?'  ·  Página '+(iPag+1)+' de '+nPag:'')+'</span></div></div>'
      // Los tres logos: federación, campeonato y YourLift. Van en la barra de
      // título, que ya escala con el alto de la pantalla, así que crecen junto
      // con el resto cuando esto se proyecta en grande.
      +'<div style="display:flex;align-items:center;gap:'+Math.round(VH*0.016)+'px;flex-shrink:0">'
        +_tiraLogosPantalla(['fed','camp'],Math.round(VH*0.05)+'px',Math.round(VH*0.014)+'px')
        +'<img src="yourlift_logo_hd.png" alt="YourLift" style="height:'+Math.round(VH*0.04)+'px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))" onerror="this.outerHTML=\'<span style=&quot;font-family:Oswald;color:#D4A843;letter-spacing:2px&quot;>YourLift</span>\'">'
      +'</div>'
    +'</div>'
    +'<div style="flex:1;overflow:hidden;padding:0 14px;box-sizing:border-box">'
      +'<table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed">'
      // Anchos explícitos: ATLETA bien ancha para que el nombre completo entre
      +'<colgroup>'
        +'<col style="width:3%"><col style="width:21.8%"><col style="width:5.6%"><col style="width:3.4%"><col style="width:4.4%">'
        +'<col style="width:4.6%"><col style="width:4.6%"><col style="width:4.6%"><col style="width:4.8%">'
        +'<col style="width:4.6%"><col style="width:4.6%"><col style="width:4.6%"><col style="width:4.8%">'
        +'<col style="width:4.6%"><col style="width:4.6%"><col style="width:4.6%">'
        +'<col style="width:5.6%"><col style="width:4.6%">'
      +'</colgroup>'
      +'<thead><tr style="height:'+theadH+'px;background:rgba(10,22,40,.5)">'
        +H('#')+H('ATLETA')+H(_variosPaises()?'PAÍS':'CLUB')+H('AÑO')+H('BW')
        +'<th colspan="4" style="padding:0;font-family:Oswald;font-size:'+fs(12)+'px;letter-spacing:1px;color:#3b82f6;border-bottom:1px solid rgba(59,130,246,.3)">SQUAT</th>'
        +'<th colspan="4" style="padding:0;font-family:Oswald;font-size:'+fs(12)+'px;letter-spacing:1px;color:#f59e0b;border-bottom:1px solid rgba(245,158,11,.3)">BENCH</th>'
        +'<th colspan="3" style="padding:0;font-family:Oswald;font-size:'+fs(12)+'px;letter-spacing:1px;color:#ef4444;border-bottom:1px solid rgba(239,68,68,.3)">DEADLIFT</th>'
        +H('TOTAL')+H('GL')
      +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'</div></div>';
}

// Qué tabla de récords rige este campeonato. Hoy solo está cargada la
// sudamericana; cuando se cargue la nacional, el evento dirá records:'nacional'
// y el cartel cambia solo, sin tocar esta pantalla.
function _recordEtiqueta(a){
  const r=String((DATA.event&&DATA.event.records)||'');
  if(r==='nacional')return 'INTENTO DE RÉCORD NACIONAL';
  if(_srOn()){ const x=a?_srIntentoDe(a):null; return (x&&x.hay)?_srIntentoTexto(x):'INTENTO DE RÉCORD SUDAMERICANO'; }
  return '';
}

// Lo que rompería el intento que va a levantar: movimiento y, en peso muerto,
// total. Usa la misma detección que la tabla.
function _srIntentoDe(a){
  if(!a||typeof _srIntento!=='function')return null;
  try{
    const l=DATA.lift, r=(typeof curAtt==='function')?curAtt(a):DATA.round;
    const at=(a.att&&a.att[l])?a.att[l][r]:null;
    const w=(at&&at.w)||0;
    if(!(w>0)||at.r)return null;               // ya juzgado: no es "intento"
    return _srIntento(a,l,w);
  }catch(e){ return null; }
}

function _esIntentoRecord(a){ const x=_srIntentoDe(a); return !!(x&&x.hay); }

function renderScreenBarra(a){
  if(!a)return '';
  const l=DATA.lift, r=(typeof curAtt==='function')?curAtt(a):DATA.round;
  const at=(a.att&&a.att[l])?a.att[l][r]:null;
  const kg=(at&&at.w)||0;
  const modo=(window._SCREEN_STATE&&window._SCREEN_STATE.fondo)||'bandera';
  const fondo=_fondoBarra(a,modo);
  const logo=_logoCamp();
  const logoFed=_logoFed();
  const partes=String(a.name||'').trim().split(/\s+/);
  const apellidos=partes.slice(-2).join(' ');
  const nombres=partes.slice(0,-2).join(' ');
  const cat=(a.cat||'').replace(/\s*\(.*\)/,'');
  const divS=(typeof txDivShort==='function')?txDivShort(a.div):(a.div||'');
  const modS=(typeof _txModLabel==='function')?_txModLabel(a.mod):'';
  const esRec=_esIntentoRecord(a);
  const etiqRec=_recordEtiqueta(a);
  // Cada cosa es un bloque que se puede mover y agrandar: click para elegirlo,
  // arrastrar para moverlo, la manija de la esquina para el tamaño. Click en el
  // fondo deselecciona y la pantalla queda limpia para la competencia.
  const B=_piBlock;
  return `<div class="pi-canvas" style="position:absolute;top:0;right:0;bottom:0;left:0;background:${fondo};font-family:Oswald,sans-serif;color:#fff;overflow:hidden">
    ${B('bSigla',`<div style="font-size:clamp(28px,5.4vw,86px);font-weight:700;letter-spacing:.06em;color:#D4A843;line-height:1;white-space:nowrap">${_LIFT_SIGLA[l]||''} ${r+1}</div>`)}

    ${B('bPeso',`<div style="line-height:1;white-space:nowrap;font-size:clamp(46px,10vw,150px);font-weight:800;letter-spacing:-.01em">
      ${kg?kg.toFixed(1).replace(/\.0$/,''):'—'}<span style="font-size:.34em;font-weight:600;margin-left:.15em;opacity:.75">KG</span>
    </div>`)}

    ${B('bNombre',`<div style="text-align:center;white-space:nowrap">
      ${nombres?`<div style="font-size:clamp(18px,3.2vw,46px);font-weight:400;letter-spacing:.08em;opacity:.8">${esc(nombres)}</div>`:''}
      <div style="font-size:clamp(30px,6.6vw,104px);font-weight:800;letter-spacing:.02em;line-height:1.05;text-shadow:0 3px 14px rgba(0,0,0,.55)">${esc(apellidos||a.name||'')}</div>
    </div>`)}

    ${esRec&&etiqRec?B('bRecord',`<span style="display:inline-block;white-space:nowrap;padding:.5vh 2.2vw;border:3px solid #D4A843;border-radius:8px;
      font-size:clamp(14px,2.2vw,32px);font-weight:700;letter-spacing:.22em;color:#D4A843;
      animation:barraParpadeo 1.05s ease-in-out infinite" class="barra-rec">${etiqRec}</span>`):''}

    ${DATA.relojVisible?`<div id="pantBarraTimer" style="position:fixed;top:2.6vh;left:50%;transform:translateX(-50%);font-size:clamp(34px,6.2vw,96px);font-weight:800;letter-spacing:.04em;line-height:1;color:${_relojColor()};font-variant-numeric:tabular-nums;text-shadow:0 3px 14px rgba(0,0,0,.6)">${_relojTxt()}</div>`:''}

    ${B('bLinea',`<div style="width:90vw;height:2px;background:rgba(255,255,255,.22)"></div>`)}

    ${B('bPais',`<div style="display:flex;align-items:center;gap:1.1vw;white-space:nowrap;font-size:clamp(16px,2.6vw,40px);font-weight:700;letter-spacing:.06em">
      ${_variosPaises()?`${_flagImg(_ctry(a),34,true)}<span>${esc(_ctry(a))}</span>`
        :`${modo==='bandera'?'':_logoClub(a,56,'margin-right:0;background:rgba(10,22,40,.25);padding:3px;border-radius:8px;')}<span>${esc(a.club||'')}</span>`}
    </div>`,!_variosPaises())}

    ${B('bDatos',`<div style="white-space:nowrap;font-size:clamp(15px,2.4vw,36px);font-weight:600;letter-spacing:.1em;opacity:.9;text-align:center">
      ${esc(cat)} <span style="opacity:.6">·</span> ${esc(divS)}${modS?` <span style="opacity:.6">·</span> ${esc(modS)}`:''}
    </div>`)}

    ${_logosPantallaSubidos().length
      ? _logosPantallaSubidos().map((u,i)=>B('bLogoN'+i,`<img src="${u}" alt="" style="max-height:10vh;max-width:14vw;object-fit:contain;display:block" onerror="this.style.display='none'">`)).join('')
      : (logo?B('bLogo',`<img src="${logo}" alt="" style="max-height:11vh;max-width:14vw;object-fit:contain;display:block" onerror="this.style.display='none'">`):'')
        +(logoFed?B('bLogoFed',`<img src="${logoFed}" alt="" style="max-height:9vh;max-width:12vw;object-fit:contain;display:block" onerror="this.style.display='none'">`):'')}

    ${_lucesEnTarima()?B('bLuces',renderLucesTarima(true)):''}

    <button onclick="barraResetLayout()" title="Volver a dejar la pantalla como venía"
      style="position:absolute;right:10px;bottom:8px;z-index:9;width:26px;height:26px;border-radius:50%;
      border:1px solid rgba(212,225,245,.15);background:rgba(10,22,40,.15);color:rgba(255,255,255,.2);
      font-size:13px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center">⟲</button>
  </div>`;
}

function _piDefLogoN(key){
  const m=_RX_LOGO_N.exec(key||'');
  if(!m)return null;
  const i=+m[2];
  // Separados 15% para que no se tapen —cada logo ocupa cerca de 14% de ancho—
  // y saltando de fila cada seis, que es lo que entra a lo ancho.
  const col=i%6, fila=Math.floor(i/6);
  return m[1]==='b'
    ? {x:88-col*15,y:Math.max(60,90-fila*11),scale:100}   // atleta en barra: abajo, de derecha a izquierda
    : {x:8+col*15,y:Math.min(40,6+fila*11),scale:100};    // intentos: arriba, de izquierda a derecha
}

function _piDefBloque(key){
  return PI_DEFAULT_LAYOUT[key]||_piDefLogoN(key)||{x:50,y:50,scale:100};
}

// La posición de un bloque, creándola si todavía no existe.
//
// Los logos que se suben no están en PI_DEFAULT_LAYOUT —son tantos como logos
// haya— y su posición de fábrica se calcula. Mientras nadie los hubiera movido
// la clave no existía en _piLayout, y arrastrar o redimensionar leía esa clave
// inexistente: reventaba en la primera línea y el logo recién subido no había
// forma de moverlo ni de agrandarlo. Pedir la posición por acá la deja creada.
function _piPos(key){
  return window._piLayout[key]||(window._piLayout[key]=Object.assign({},_piDefBloque(key)));
}

function _piLoadLayout(){
  try{
    const raw=localStorage.getItem(PI_LAYOUT_KEY);
    if(raw){
      const saved=JSON.parse(raw);const merged={};
      Object.keys(PI_DEFAULT_LAYOUT).forEach(k=>{merged[k]=Object.assign({},PI_DEFAULT_LAYOUT[k],saved[k]||{});});
      Object.keys(saved).forEach(k=>{ if(!merged[k]&&_RX_LOGO_N.test(k))merged[k]=Object.assign({},_piDefLogoN(k),saved[k]); });
      return merged;
    }
  }catch(e){}
  return JSON.parse(JSON.stringify(PI_DEFAULT_LAYOUT));
}

function _piSaveLayout(){try{localStorage.setItem(PI_LAYOUT_KEY,JSON.stringify(window._piLayout))}catch(e){}}

// Restablece solo las claves de una pantalla: las dos disposiciones viven en el
// mismo archivo guardado, y acomodar una no tiene por qué deshacer la otra.
function _piResetClaves(pred){
  Object.keys(PI_DEFAULT_LAYOUT).forEach(k=>{
    if(pred(k))window._piLayout[k]=Object.assign({},PI_DEFAULT_LAYOUT[k]);
  });
  // Los logos sueltos no están en la lista de fábrica: se les vuelve a poner
  // la posición calculada, o si no, 'Restablecer posiciones' los dejaba donde
  // estaban y el botón parecía no hacer nada.
  Object.keys(window._piLayout).forEach(k=>{
    if(_RX_LOGO_N.test(k)&&pred(k))window._piLayout[k]=Object.assign({},_piDefLogoN(k));
  });
  _piSaveLayout();
  window._piSelected=null;
  if(typeof R==='function')R();
}

function _piLoadSettings(){
  try{
    const raw=localStorage.getItem(PI_SETTINGS_KEY);
    if(raw){
      const g=JSON.parse(raw);
      // El cronómetro se sacó de la pantalla de tarima: si venía prendido de antes
      // (era el default viejo) se apaga, salvo que se haya tocado el interruptor.
      if(g.showTimer===true&&!g._timerElegido)delete g.showTimer;
      return Object.assign({},PI_DEFAULT_SETTINGS,g);
    }
  }catch(e){}
  return Object.assign({},PI_DEFAULT_SETTINGS);
}

function _piSaveSettings(){try{localStorage.setItem(PI_SETTINGS_KEY,JSON.stringify(window._piSettings))}catch(e){}}

// Un bloque movible/redimensionable. isBarbell=true le agrega overflow visible
// (la barra es más ancha que su contenedor centrado).
// Un logo como bloque movible. Si no hay logo cargado no se dibuja nada: un
// bloque vacío igual se puede seleccionar y arrastrar, y confunde.
function _piLogoBloque(key,url,maxAlto,maxAncho){
  if(!url)return '';
  return _piBlock(key,'<img src="'+url+'" alt="" style="max-height:'+maxAlto+';max-width:'+maxAncho
    +';object-fit:contain;display:block" onerror="this.style.display=\'none\'">');
}

// `izq`: el bloque crece hacia la derecha desde su borde izquierdo en vez de
// hacia los dos lados. Lo usa el nombre del club en "Atleta en barra": centrado
// en el 10 % de la pantalla, un nombre largo se salía por la izquierda.
function _piBlock(key,innerHtml,izq){
  const pos=_piPos(key);
  const selected=window._piSelected===key;
  const left=izq?Math.max(0,pos.x-5):pos.x;
  let h='<div class="pi-block" data-pi-key="'+key+'" style="position:absolute;left:'+left+'%;top:'+pos.y+'%;transform:translate('+(izq?'0':'-50%')+',-50%);padding:10px;border-radius:8px;'+(selected?'outline:2px dashed #D4A843;background:rgba(212,168,67,.08);':'')+'cursor:'+(selected?'move':'pointer')+'">';
  h+='<div class="pi-inner" style="transform:scale('+((pos.scale||100)/100)+');transform-origin:'+(izq?'left':'center')+' center">'+innerHtml+'</div>';
  if(selected){
    h+='<div class="pi-resize" data-pi-key="'+key+'" title="Arrastra para agrandar o achicar" style="position:absolute;right:-15px;bottom:-15px;width:26px;height:26px;background:#D4A843;border:3px solid #0A1628;border-radius:50%;cursor:nwse-resize;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>';
  }
  h+='</div>';
  return h;
}

// ══════════════════════════════════════════════════════════════════
// TIMER DE DESCANSO EN LAS PANTALLAS DE TARIMA
//
// "Cuánto falta para que empiece": el cartel con la cuenta regresiva que hasta
// ahora solo existía para la transmisión (Control TX → Descanso) también se ve
// en las pantallas del recinto: Pantalla de Intentos, Atleta en Barra y Tabla
// de Jornada.
//
// Es EL MISMO timer, no otro. Vive en livecast_director/{evento}, así que
// ponerlo desde acá lo pone también en la transmisión, y pausarlo desde el
// Control TX lo pausa acá. Un solo descanso, un solo reloj: dos relojes de
// descanso distintos marcando cosas distintas en la misma sala sería peor que
// no tener ninguno.
//
// Se maneja desde el engranaje de abajo a la izquierda, que es donde está el
// operador de la tarima, sin tener que ir hasta el Control TX.
// ══════════════════════════════════════════════════════════════════
// El estado llega por dos caminos según dónde se esté: en una pantalla, por el
// listener del director (_txDirState); en el panel de control, por el suyo
// (_dirState). Se mira el que exista.
function _descBT(){
  const a=(typeof _txDirState!=='undefined'&&_txDirState)?_txDirState.breakTimer:null;
  if(a&&a.active)return a;
  const b=(typeof _dirState!=='undefined'&&_dirState)?_dirState.breakTimer:null;
  if(b&&b.active)return b;
  return null;
}

// Cuánto falta, en limpio. Devuelve null cuando no hay descanso puesto.
function _descInfo(){
  const bt=_descBT(); if(!bt)return null;
  const dur=(bt.durationSec||0)*1000;
  // Pausado: el reloj se congela en lo que quedaba al pausar.
  const corrido=bt.pausedAt?(bt.pausedAt-bt.startedAt):(Date.now()-bt.startedAt);
  const rem=Math.max(0,Math.ceil((dur-corrido)/1000));
  // Llegado a cero se queda medio minuto en 0:00 —para que se vea que se acabó—
  // y después se saca solo. Si no, una pantalla con "DESCANSO 0:00" se queda así
  // el resto de la competencia porque nadie se acordó de quitarla.
  if(rem<=0 && !bt.pausedAt && corrido>dur+30000) return null;
  return {rem, mmss:Math.floor(rem/60)+':'+String(rem%60).padStart(2,'0'),
          pausado:!!bt.pausedAt, texto:(bt.label||'').trim()||'DESCANSO',
          mov:(bt.movement||'').trim()};
}

// El cartel, como un bloque más del editor: se arrastra y se agranda igual que
// el nombre o el peso. Va en su propia capa que cubre la pantalla —así se puede
// llevar a cualquier esquina— pero que deja pasar los clicks a lo de abajo.
function _descCapaHtml(){
  const d=_descInfo(); if(!d)return '';
  const col=d.rem<=10?'#ef4444':d.rem<=30?'#f59e0b':'#ffffff';
  const inner='<div style="text-align:center;font-family:Oswald,sans-serif;white-space:nowrap;'
    +'background:rgba(10,22,40,.88);border:2px solid rgba(212,168,67,.55);border-radius:14px;'
    +'padding:2.2vh 3.2vw;box-shadow:0 10px 40px rgba(0,0,0,.6)">'
    +'<div style="font-size:clamp(13px,1.9vw,30px);letter-spacing:.35em;color:#D4A843">'+esc(d.texto)+'</div>'
    +(d.mov?'<div style="font-size:clamp(12px,1.5vw,24px);letter-spacing:.2em;color:rgba(235,242,250,.75);margin-top:.4vh">'+esc(d.mov)+'</div>':'')
    +'<div id="descRel" style="font-size:clamp(46px,9vw,150px);font-weight:900;line-height:1.05;color:'+col+'">'+d.mmss+'</div>'
    +'<div id="descPausa" style="font-size:clamp(11px,1.3vw,20px);letter-spacing:.3em;color:#f59e0b;height:1.2em">'+(d.pausado?'&#9208; PAUSADO':'')+'</div>'
    +'</div>';
  return '<div class="pi-canvas pi-desc-capa" style="position:fixed;top:0;right:0;bottom:0;left:0;z-index:40">'
    +_piBlock('descanso',inner)+'</div>';
}

// ── Ponerlo, pausarlo, sacarlo ────────────────────────────────────────────
// Se escribe con merge: el documento del director lleva TODOS los componentes de
// la transmisión, y esta pantalla solo sabe del descanso. Sin merge le borraría
// al Control TX lo que tenga puesto.
function _descPuede(){ return !!(isAdmin||window._ensayoFree); }

async function _descEscribe(bt){
  if(typeof _txDirState!=='undefined'&&_txDirState)_txDirState.breakTimer=bt;   // que se vea al toque
  if(typeof _dirState!=='undefined'&&_dirState)_dirState.breakTimer=bt;
  if(typeof R==='function')R();
  if(!fbReady||!window._fb||!fbDB){showToastLC('Sin conexión: el descanso se ve acá pero no llega a las otras pantallas');return;}
  if(!fbDocId()){showToastLC('Todavía se está cargando el campeonato — espera unos segundos');return;}
  try{
    await window._fb.setDoc(window._fb.doc(fbDB,'livecast_director',evStateDocId('current')),
      {show:{breakTimer:bt},ts:Date.now()},{merge:true});
  }catch(e){showToastLC('No se pudo enviar el descanso: '+(e.message||e));}
}

function _descEstiloPrevio(){
  const bt=(typeof _txDirState!=='undefined'&&_txDirState&&_txDirState.breakTimer)
        || (typeof _dirState!=='undefined'&&_dirState&&_dirState.breakTimer) || {};
  return bt.style||{};
}

function _descGearHtml(){
  const open=!!window._descPanelOpen;
  let h='<div style="position:fixed;bottom:18px;left:18px;z-index:51;display:flex;flex-direction:column;align-items:flex-start;gap:10px">';
  if(open){
    h+='<div style="background:rgba(10,22,40,.94);border:1px solid rgba(212,225,245,.25);border-radius:10px;'
      +'padding:14px 16px;min-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.5)">'+_descPanelHtml(true)+'</div>';
  }
  // Sin `title`: en una pantalla que se proyecta, el globo gris del navegador
  // aparece AL AIRE si el mouse queda quieto encima. Pasó en el Sudamericano.
  h+='<button onclick="descTogglePanel()" style="width:28px;height:28px;border-radius:50%;'
    +'border:1px solid rgba(212,225,245,'+(open?'.35':'.15')+');background:rgba(10,22,40,'+(open?'.85':'.15')+');'
    +'color:rgba(255,255,255,'+(open?'.9':'.2')+');font-size:13px;line-height:1;cursor:pointer;display:flex;'
    +'align-items:center;justify-content:center;transition:all .15s"><i class=yl-i-reloj></i></button>';
  h+='</div>';
  return h;
}

function _descPanelHtml(solo){
  const d=_descInfo();
  const puede=_descPuede();
  const bot=(txt,fn,color)=>'<button onclick="'+fn+'" style="flex:1;min-width:38px;padding:6px 4px;border-radius:6px;border:1px solid '
    +(color||'rgba(212,225,245,.3)')+';background:rgba(255,255,255,.05);color:'+(color||'#fff')
    +';font-family:Oswald;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px">'+txt+'</button>';
  let h='<div style="'+(solo?'':'border-top:1px solid rgba(212,225,245,.15);padding-top:10px;')
    +'display:flex;flex-direction:column;gap:8px">';
  h+='<div style="font-family:Oswald;font-size:11px;letter-spacing:2px;color:rgba(212,225,245,.5)">DESCANSO</div>';
  if(!puede){
    h+='<div style="font-family:Oswald;font-size:10px;color:rgba(212,225,245,.45);letter-spacing:.5px;max-width:210px;line-height:1.5">'
      +'Esta pantalla no tiene sesión de admin: el descanso se pone desde el control y acá se ve solo.</div>';
    if(d)h+='<div style="font-family:Oswald;font-size:13px;color:#D4A843">'+esc(d.texto)+' · '+d.mmss+(d.pausado?' (pausado)':'')+'</div>';
    return h+'</div>';
  }
  h+='<input id="descTexto" placeholder="Rótulo (ej. COMENZAMOS EN)" value="'+esc(d?d.texto:'')+'"'
    +' style="padding:6px 8px;border-radius:6px;border:1px solid rgba(212,225,245,.25);background:rgba(255,255,255,.06);color:#fff;font-family:Oswald;font-size:11px;letter-spacing:1px;width:100%;box-sizing:border-box">';
  h+='<div style="display:flex;gap:5px">'+DESC_MINUTOS.map(m=>bot(m+"'",'descPoner('+m+')')).join('')+'</div>';
  h+='<div style="display:flex;gap:5px;align-items:center">'
    +'<input id="descMin" type="number" min="1" max="180" placeholder="min"'
    +' style="width:58px;padding:6px 8px;border-radius:6px;border:1px solid rgba(212,225,245,.25);background:rgba(255,255,255,.06);color:#fff;font-family:Oswald;font-size:11px">'
    +bot('PONER','descPoner((document.getElementById(\'descMin\')||{}).value)','#22c55e')+'</div>';
  if(d){
    h+='<div style="font-family:Oswald;font-size:13px;color:#D4A843;letter-spacing:1px">En pantalla · '+d.mmss+(d.pausado?' · pausado':'')+'</div>';
    h+='<div style="display:flex;gap:5px">'
      +bot(d.pausado?'SEGUIR':'PAUSAR','descPausar()','#f59e0b')
      +bot('QUITAR','descQuitar()','#ef4444')+'</div>';
  }
  h+='</div>';
  return h;
}

// Engranaje discreto (esquina inferior izquierda) + panel de ajustes. Cerrado
// por defecto para que la transmisión se vea limpia; el engranaje queda casi
// invisible (baja opacidad) pero siempre clickeable para volver a entrar.
function _piSettingsPanelHtml(){
  const piSet=window._piSettings||(window._piSettings=_piLoadSettings());
  const open=!!window._piPanelOpen;
  let h='<div style="position:fixed;bottom:18px;left:18px;z-index:50;display:flex;flex-direction:column;align-items:flex-start;gap:10px">';
  if(open){
    h+=`<div style="background:rgba(10,22,40,.94);border:1px solid rgba(212,225,245,.25);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.5)">
      <div style="font-family:Oswald;font-size:11px;letter-spacing:2px;color:rgba(212,225,245,.5)">AJUSTES DE PANTALLA</div>
      <label style="display:flex;align-items:center;gap:8px;font-family:Oswald;font-size:12px;color:#fff;cursor:pointer">
        <input type="checkbox" ${piSet.fondoBandera!==false?'checked':''} onchange="piSetSetting('fondoBandera',this.checked)"> Bandera de fondo
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-family:Oswald;font-size:12px;color:#fff;cursor:pointer">
        <input type="checkbox" ${piSet.showTimer===true?'checked':''} onchange="piSetSetting('_timerElegido',true);piSetSetting('showTimer',this.checked)"> Mostrar cronómetro
      </label>
      <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:Oswald;font-size:12px;color:#fff">
        Fondo <input type="color" value="${piSet.bgColor||'#000000'}" onchange="piSetSetting('bgColor',this.value)" style="width:36px;height:24px;padding:0;border:1px solid rgba(212,225,245,.3);border-radius:4px;background:none;cursor:pointer">
      </label>
      <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:Oswald;font-size:12px;color:#fff">
        Acento <input type="color" value="${piSet.accentColor||'#D4A843'}" onchange="piSetSetting('accentColor',this.value)" style="width:36px;height:24px;padding:0;border:1px solid rgba(212,225,245,.3);border-radius:4px;background:none;cursor:pointer">
      </label>
      <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:Oswald;font-size:12px;color:#fff">
        Texto <input type="color" value="${piSet.textColor||'#ffffff'}" onchange="piSetSetting('textColor',this.value)" style="width:36px;height:24px;padding:0;border:1px solid rgba(212,225,245,.3);border-radius:4px;background:none;cursor:pointer">
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="piResetColors()" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(212,225,245,.3);background:rgba(255,255,255,.05);color:#fff;font-family:Oswald;font-size:10px;cursor:pointer;letter-spacing:1px">RESTABLECER COLORES</button>
        <button onclick="piResetLayout()" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(212,225,245,.3);background:rgba(255,255,255,.05);color:#fff;font-family:Oswald;font-size:10px;cursor:pointer;letter-spacing:1px">RESTABLECER POSICIONES</button>
      </div>
      <div style="font-family:Oswald;font-size:9px;color:rgba(212,225,245,.35);letter-spacing:.5px;max-width:210px">Click en un bloque de la pantalla para moverlo o agrandarlo.</div>
      ${_descPanelHtml()}
    </div>`;
  }
  h+=`<button onclick="piToggleSettingsPanel()" title="Ajustes de pantalla" style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(212,225,245,${open?'.35':'.15'});background:rgba(10,22,40,${open?'.85':'.15'});color:rgba(255,255,255,${open?'.9':'.2'});font-size:13px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s"><i class=yl-i-ajustes></i></button>`;
  h+='</div>';
  return h;
}

// Quién levanta después del actual. Primero el que sigue en la cola de esta
// ronda; si el actual es el último, se mira la ronda siguiente de la misma tanda
// y, si tampoco hay, la primera tanda que quede pendiente en este movimiento.
// Devuelve {a, w, lift, nota} — `nota` explica de dónde sale ("INT 1", "TANDA B").
function _piQuienSigue(nxt){
  if(nxt)return {a:nxt,w:(nxt.att[DATA.lift][curAtt(nxt)]||{}).w,lift:DATA.lift,nota:''};
  const pend=(list,l,r)=>list.filter(a=>{const at=(a.att[l]||[])[r];return at&&at.r===null&&at.w>0;})
    .sort((a,b)=>{const wa=a.att[l][r].w,wb=b.att[l][r].w;return wa!==wb?wa-wb:(a.lot||0)-(b.lot||0);});
  // 1) rondas siguientes de la misma tanda
  const mismaTanda=DATA.athletes.filter(a=>a.flight===DATA.flight&&!a.bombed);
  for(let r=DATA.round+1;r<=2;r++){
    const q=pend(mismaTanda,DATA.lift,r);
    if(q.length)return {a:q[0],w:q[0].att[DATA.lift][r].w,lift:DATA.lift,nota:'INT '+(r+1)};
  }
  // 2) las otras tandas, en el orden en que van a subir
  const fls=(typeof _allFlightsSorted==='function')?_allFlightsSorted():[];
  const i=fls.indexOf(DATA.flight);
  const rot=i>=0?[...fls.slice(i+1),...fls.slice(0,i)]:fls;
  for(const fl of rot){
    if(fl===DATA.flight)continue;
    const list=DATA.athletes.filter(a=>a.flight===fl&&!a.bombed);
    for(let r=0;r<=2;r++){
      const q=pend(list,DATA.lift,r);
      if(q.length)return {a:q[0],w:q[0].att[DATA.lift][r].w,lift:DATA.lift,nota:'TANDA '+fl};
    }
  }
  return null;
}

function renderScreenIntentos(cur,nxt){
  const att=cur.att[DATA.lift][DATA.round];
  const weight=(att==null?void 0:att.w)||0;
  const isMale=cur.sex==='Hombre'||cur.sex==='M'||cur.sex==='Masculino';
  const barKg=20; // barra de 20kg para todos (según la foto de referencia de LiftingCast, incluso en Women's)
  const collarsKg=5; // 2 collares × 2.5kg
  const barW=barKg+collarsKg;
  const sideKg=Math.max(0,(weight-barW)/2);
  const plates=_discosPorLado(sideKg);
  // Props visuales por disco — todos son rectángulos (vista de canto de un disco real),
  // el 1.25 antes se dibujaba como círculo y parecía una pelota.
  //
  // Los anchos son la MITAD de los que había: así de gruesos parecían bumpers de
  // halterofilia y no discos calibrados de powerlifting, que son mucho más finos
  // (un 25 kg de competencia mide 45 cm de diámetro por unos 3 cm de canto).
  function pp(kg){
    if(kg>=25) return{h:280,w:32,fill:'#DC2626',stroke:'#7F1D1D',round:false};
    if(kg>=20) return{h:250,w:29,fill:'#2563EB',stroke:'#1E3A8A',round:false};
    if(kg>=15) return{h:222,w:26,fill:'#EFCB10',stroke:'#7A6300',round:false};   // amarillo Eleiko
    if(kg>=10) return{h:190,w:23,fill:'#16A34A',stroke:'#14532D',round:false};
    if(kg>=5)  return{h:150,w:19,fill:'#E5E7EB',stroke:'#9CA3AF',round:false};
    if(kg>=2.5)return{h:112,w:17,fill:'#111827',stroke:'#000000',round:false};   // 2.5 negro
    if(kg>=1.25)return{h:86, w:13,fill:'#2563EB',stroke:'#1E3A8A',round:false};  // 1.25 azul
    if(kg>=0.75)return{h:64, w:9, fill:'#9CA3AF',stroke:'#6B7280',round:false};
    // Fraccionarios de récord: cromados, con el ancho justo para que el número
    // se lea desde la platea.
    if(kg>=0.5) return{h:70, w:15,fill:'#D4D4D8',stroke:'#71717A',round:false};
    if(kg>=0.25)return{h:60, w:15,fill:'#A1A1AA',stroke:'#52525B',round:false};
                return{h:38, w:8, fill:'#374151',stroke:'#111827',round:false};
  }
  // Solo LA MITAD de la barra (un lado), en el orden en que se carga de verdad:
  // un tramo de eje (el resto de la barra, fuera de pantalla), el tope fijo de la
  // manga, los discos de mayor a menor saliendo hacia afuera, y AL FINAL el collar
  // que los aprieta, con el peso fijo "barra+collares". Antes el collar iba pegado
  // al eje, antes de los discos: la mesa lo marcó, porque así no se carga.
  const VH=440,cy=VH/2,shaftThick=26,sleeveThick=36,collarH=90,collarW=34,stubW=90,topeW=12,topeH=60,puntaW=28;
  let x=20,s=[];
  s.push(`<rect x="0" y="${cy-shaftThick/2}" width="${x+stubW}" height="${shaftThick}" fill="#71717A" rx="3"/>`);
  x+=stubW;
  for(let xi=20;xi<x-6;xi+=16)s.push(`<line x1="${xi}" y1="${cy-shaftThick/2-3}" x2="${xi}" y2="${cy+shaftThick/2+3}" stroke="#A1A1AA" stroke-width="2" opacity="0.5"/>`);
  // La manga va detrás de todo: se dibuja cuando ya se sabe dónde termina.
  const _mangaIdx=s.length; s.push('');
  const _mangaX=x;
  // Tope fijo de la manga (parte de la barra, no pesa aparte).
  s.push(`<rect x="${x}" y="${cy-topeH/2}" width="${topeW}" height="${topeH}" fill="#3F3F46" rx="3" stroke="#27272A" stroke-width="2"/>`);
  x+=topeW+5;
  plates.forEach(kg=>{
    const p=pp(kg);const py=cy-p.h/2;
    const label=(kg%1===0)?String(kg):String(kg);
    if(p.round){
      const r=p.w/2;
      s.push(`<circle cx="${x+r}" cy="${cy}" r="${r}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="3"/>`);
      s.push(`<text x="${x+r}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="#111827" font-family="Oswald" font-weight="800" font-size="${Math.max(13,r*0.4)}">${label}</text>`);
    } else {
      const rx=Math.min(4,p.w*0.25);
      const stripeW=Math.max(2,Math.min(4,p.w*0.22));
      s.push(`<rect x="${x}" y="${py}" width="${p.w}" height="${p.h}" fill="${p.fill}" rx="${rx}" stroke="${p.stroke}" stroke-width="2"/>`);
      s.push(`<rect x="${x+3}" y="${py+6}" width="${stripeW}" height="${p.h-12}" fill="rgba(255,255,255,0.22)" rx="2"/>`);
      // El número del disco se tiene que leer desde la platea: letra grande y un
      // contorno oscuro (paint-order:stroke) para que no se pierda contra el color
      // del disco. Con los discos finos el número va rotado en TODOS: de canto no
      // entra a lo ancho, y a lo largo del disco sobra espacio.
      const claro=(kg>=5&&kg<10)||kg<1;                 // el de 5kg es blanco; los fraccionarios, cromados
      const textColor=claro?'#111827':'#fff';
      const halo=claro?'rgba(255,255,255,.85)':'rgba(0,0,0,.75)';
      const fs=Math.max(13,Math.min(30,p.w*0.86));
      const rot=` transform="rotate(-90 ${x+p.w/2} ${cy})"`;
      s.push(`<text x="${x+p.w/2}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${textColor}" stroke="${halo}" stroke-width="${Math.max(1.6,fs*0.11)}" paint-order="stroke" stroke-linejoin="round" font-family="Oswald" font-weight="800" font-size="${fs}" letter-spacing="0.5"${rot}>${label}</text>`);
    }
    x+=p.w+5;
  });
  // El collar, por fuera del disco más chico.
  s.push(`<rect x="${x}" y="${cy-collarH/2}" width="${collarW}" height="${collarH}" fill="#52525B" rx="4" stroke="#27272A" stroke-width="2"/>`);
  s.push(`<text x="${x+collarW/2}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="#F4F4F5" stroke="rgba(0,0,0,.7)" stroke-width="2" paint-order="stroke" stroke-linejoin="round" font-family="Oswald" font-weight="700" font-size="16" transform="rotate(-90 ${x+collarW/2} ${cy})">BAR+COL ${barW}</text>`);
  x+=collarW;
  // Y la punta de la manga que asoma después del collar.
  s[_mangaIdx]=`<rect x="${_mangaX}" y="${cy-sleeveThick/2}" width="${x+puntaW-_mangaX}" height="${sleeveThick}" fill="#8A8A93" rx="4"/>`;
  x+=puntaW;
  const VW=x+20;
  const bbSvg=`<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" style="height:${Math.round(VH*0.85)}px;width:auto;max-width:none;display:block">${s.join('')}</svg>`;
  // Pronóstico de posición (idéntico criterio al del widget de OBS)
  const peers=DATA.athletes.filter(a=>a.sex===cur.sex&&a.cat===cur.cat&&a.div===cur.div&&a.mod===cur.mod);
  const curGL=calcGL(totalOf(cur),cur.bw,cur.sex,_glMod(cur));
  const hypBest=Math.max(bestOf(cur,DATA.lift),weight);
  const sqH=DATA.lift==='sq'?hypBest:bestOf(cur,'sq');
  const bpH=DATA.lift==='bp'?hypBest:bestOf(cur,'bp');
  const dlH=DATA.lift==='dl'?hypBest:bestOf(cur,'dl');
  const hypTotal=(sqH&&bpH&&dlH)?sqH+bpH+dlH:0;
  const hypGL=hypTotal>0?calcGL(hypTotal,cur.bw,cur.sex,_glMod(cur)):0;
  const othersGL=peers.filter(a=>a.id!==cur.id).map(a=>calcGL(totalOf(a),a.bw,a.sex,_glMod(a))).filter(g=>g>0).sort((a,b)=>b-a);
  const curRank=curGL>0?othersGL.filter(g=>g>curGL).length+1:null;
  const newRank=hypGL>0?othersGL.filter(g=>g>hypGL).length+1:null;
  let posTxt='';
  if(newRank!==null){
    if(curRank!==null&&curRank!==newRank)posTxt=`Si es válido pasará del <b>${curRank}°</b> al <b>${newRank}° lugar</b>`;
    else if(curRank!==null)posTxt=`Mantiene el <b>${newRank}° lugar</b> si es válido`;
    else posTxt=`Si es válido: <b>${newRank}° lugar</b>`;
  }
  const liftName={sq:'SENTADILLA',bp:'PRESS DE BANCA',dl:'PESO MUERTO'}[DATA.lift]||DATA.lift.toUpperCase();
  let roundLabel=['1er INTENTO','2do INTENTO','3er INTENTO'][DATA.round]||`INTENTO ${DATA.round+1}`;
  // Enunciado del intento extra en la proyección: "4º INTENTO" si se concedió en
  // la 3ª ronda, "INTENTO EXTRA" en la 1ª/2ª. Se suma al intento normal en curso.
  if(cur.__is4){roundLabel+=((((cur.att[DATA.lift][3]||{}).grantedRound)||0)>=2)?' · 4º INTENTO':' · INTENTO EXTRA';}
  const rackH=DATA.lift==='sq'?cur.rackSQ:DATA.lift==='bp'?cur.rackBP:'';
  const _setup=_rackSetup(_realAth(cur),DATA.lift);
  const sexLbl=isMale?'HOMBRES':'MUJERES';
  const t=Math.max(0,DATA.timer||0);
  const tTxt=Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
  const tColor=DATA.timerOn&&t<=10?'#ef4444':DATA.timerOn&&t<=30?'#f59e0b':'#22c55e';
  const piSet=window._piSettings||(window._piSettings=_piLoadSettings());
  const accentColor=piSet.accentColor||PI_DEFAULT_SETTINGS.accentColor;
  const textColor=piSet.textColor||PI_DEFAULT_SETTINGS.textColor;
  // Las letras chicas de esta pantalla van en BLANCO, no en el gris claro de
  // antes: la mesa pidió que se lean de lejos (encabezado, categoría, SIGUIENTE).
  // La jerarquía la dan el tamaño y el peso de la letra, no el color.
  const liftLabelHtml=`<div style="font-family:Oswald;font-size:22px;letter-spacing:4px;color:#fff;white-space:nowrap">${liftName} · ${roundLabel}${_setup?` · ${_setup}`:''}</div>`;
  // ── INTENTO DE RÉCORD SUDAMERICANO ──────────────────────────────
  // Si el peso cargado supera el récord vigente de su división (o del Open), la
  // pantalla de tarima lo canta: es lo que mira el público y la mesa técnica.
  // Y en peso muerto, también el récord de TOTAL que dejaría este intento.
  const _srX=(typeof _srIntento==='function')?_srIntento(_realAth(cur),DATA.lift,weight):{hay:false,mov:[],tot:[]};
  const _srDet=r=>(r.div+' '+r.cat+' · '+(r.vacio?'SIN RÉCORD PREVIO':'ACTUAL '+r.kg+' KG')).toUpperCase();
  const _srLineas=[];
  // Si además es récord mundial, primero la marca mundial que se persigue.
  const _wr=_srX.mundial;
  if(_wr&&_wr.hay){
    const d=r=>('MUNDIAL '+r.div+' '+r.cat+' · ACTUAL '+r.kg+' KG').toUpperCase();
    if(_wr.mov.length)_srLineas.push((_wr.tot.length?liftName+' · ':'')+_wr.mov.map(d).join('   ·   '));
    if(_wr.tot.length)_srLineas.push('TOTAL '+_srX.total+' KG · '+_wr.tot.map(d).join('   ·   '));
  }
  // Con los dos en juego, cada línea dice de cuál habla.
  if(_srX.mov.length)_srLineas.push((_srX.tot.length?liftName+' · ':'')+_srX.mov.map(_srDet).join('   ·   '));
  if(_srX.tot.length)_srLineas.push('TOTAL '+_srX.total+' KG · '+_srX.tot.map(_srDet).join('   ·   '));
  const recordHtml=_srX.hay?`<div class="sr-parpadea" style="font-family:Oswald;white-space:nowrap;text-align:center">
      <div style="display:inline-block;background:#F2C230;color:#1a1200;padding:8px 26px;border-radius:10px;font-size:30px;font-weight:900;letter-spacing:4px;box-shadow:0 0 34px rgba(242,194,48,.55)">${_srIntentoTexto(_srX)}</div>
      ${_srLineas.map(t=>`<div style="font-size:17px;letter-spacing:2px;color:#F2C230;margin-top:6px">${t}</div>`).join('')}
    </div>`:'';
  const weightHtml=`<div style="font-family:Oswald;font-size:120px;font-weight:900;color:${textColor};line-height:1;letter-spacing:2px;white-space:nowrap">${weight}<span style="font-size:0.32em;color:#fff;margin-left:10px">KG</span></div>`;
  const nameHtml=`<div style="font-family:Oswald;font-size:56px;font-weight:700;letter-spacing:1px;color:${textColor};line-height:1.15;white-space:nowrap">${cur.name||''}</div>`;
  const subtitleHtml=`<div style="font-family:Oswald;font-size:16px;letter-spacing:3px;color:#fff;white-space:nowrap">${[sexLbl,cur.club,cur.cat,cur.div,_modTarima(cur)].filter(Boolean).map(x=>(x+'').toUpperCase()).join(' · ')}</div>`;
  const positionHtml=posTxt?`<div style="font-family:Oswald;font-size:22px;letter-spacing:1px;color:${accentColor};white-space:nowrap">${posTxt}</div>`:'';
  // Quién viene después — para que los cargadores/spotters se vayan preparando.
  // Si el actual es el último de su ronda, el de al lado NO es null: se sigue
  // buscando en la ronda siguiente y después en las otras tandas. Antes el cartel
  // desaparecía justo cuando más se necesita (el último de la tanda es cuando hay
  // que ir preparando la barra del que abre la que viene).
  const _sig=_piQuienSigue(nxt);
  let nextHtml='';
  if(_sig&&_sig.a){
    const s=_sig;
    // En blanco, como el encabezado: los cargadores la leen desde la tarima y en
    // gris claro no se distinguía. No le compite al nombre de arriba porque va a
    // la mitad de tamaño. Lleva su altura de rack y, según el movimiento, si el
    // rack va abatible (sentadilla) o cuántas palmetas y seguros usa (banca) —
    // es lo que necesitan los cargadores para ir armando.
    const gris='#fff';
    const ns=_rackSetup(_realAth(s.a),s.lift||DATA.lift);
    nextHtml=`<div style="font-family:Oswald;font-size:22px;letter-spacing:3px;color:${gris};white-space:nowrap">`
      +`SIGUIENTE${s.nota?' · '+s.nota:''} · `
      +`<span style="font-weight:700">${s.a.name||''}</span>`
      +(s.w?` · <span style="font-weight:700">${s.w} KG</span>`:'')
      +(ns?` · ${ns}`:'')
    +`</div>`;
  }
  // Tiempo compensatorio (4º "se sigue a sí mismo") — se ve arriba a la izquierda
  // en la pantalla de tarima. Solo informativo.
  const _ci=(typeof _compInfo==='function')?_compInfo():null;
  const compHtml=_ci?`<div style="position:fixed;top:36px;left:48px;font-family:Oswald,sans-serif;color:#60a5fa;text-shadow:0 4px 20px rgba(0,0,0,.7)">
      <div style="font-size:16px;letter-spacing:3px;opacity:.8">TIEMPO COMPENSATORIO</div>
      <div id="compTimerPant" style="font-size:56px;font-weight:900;color:${_ci.neg?'#ef4444':'#60a5fa'};line-height:1">${_ci.mmss}</div>
    </div>`:'';
  // La bandera del país, difuminada, detrás de todo — la misma que usa el modo
  // "Atleta en barra", para que las dos pantallas se vean como una sola cosa.
  // Se apaga desde el engranaje de abajo a la izquierda.
  const _fondoPant=(piSet.fondoBandera!==false)
    ? _fondoBarra(cur,'bandera',piSet.bgColor||'')
    : (piSet.bgColor||'#000');
  return `<div class="pi-canvas" style="position:fixed;top:0;right:0;bottom:0;left:0;overflow:hidden${_fondoPant?';background:'+_fondoPant:''}" id="pantIntentosBox">
    ${compHtml}
    ${(piSet.showTimer===true||DATA.relojVisible)?`<div id="pantIntentosTimer" style="position:fixed;top:36px;right:48px;font-family:Oswald,sans-serif;font-size:64px;font-weight:900;color:${tColor};letter-spacing:2px;text-shadow:0 4px 20px rgba(0,0,0,.7)">${tTxt}</div>`:''}
    ${_piBlock('liftLabel',liftLabelHtml)}
    ${recordHtml?_piBlock('record',recordHtml):''}
    ${_piBlock('weight',weightHtml)}
    ${_piBlock('barbell',bbSvg)}
    ${_piBlock('name',nameHtml)}
    ${_piBlock('subtitle',subtitleHtml)}
    ${positionHtml?_piBlock('position',positionHtml):''}
    ${nextHtml?_piBlock('next',nextHtml):''}
    ${_logosPantallaSubidos().length
      ? _logosPantallaSubidos().map((u,i)=>_piLogoBloque('logoN'+i,u,'9vh','13vw')).join('')
      : _piLogoBloque('logoFed',_logoFed(),'9vh','12vw')+_piLogoBloque('logoCamp',_logoCamp(),'11vh','15vw')}
    ${_piSettingsPanelHtml()}
  </div>`;
}

// ── LOGOS DE LA PANTALLA DE TARIMA ────────────────────────────────
//
// Una lista, no dos casillas fijas: se suben los que se quieran —el del
// campeonato, el de la federación, los auspiciadores— y salen todos, en todas
// las escenas de la pantalla. Se guarda en eventos/{evId}.logosPantalla, así que
// queda puesta para siempre y no hay que volver a subirla cada vez que se entra.
//
// Mientras la lista esté vacía, la pantalla sigue mostrando el par de siempre
// (federación + campeonato): nadie se queda sin logos por no haber entrado acá.
function _evIdActual(){ return (DATA.event&&(DATA.event.id||DATA.event.name))||''; }

async function _guardaLogosPantalla(lista){
  const evId=_evIdActual();
  if(!evId)throw new Error('No hay campeonato elegido');
  // setDoc con merge y no updateDoc: updateDoc revienta si el campeonato
  // todavía no tiene ficha en Firestore, que es justo el caso del Sudamericano
  // y sus ensayos —su nómina viene de un archivo y nunca pasaron por
  // inscripciones—. Con merge la ficha se crea si falta y no se pisa nada de lo
  // que ya tenga.
  await window._fb.setDoc(window._fb.doc(fbDB,'eventos',evId),{logosPantalla:lista},{merge:true});
  DATA.event.logosPantalla=lista;
  const m=(window.LIVE_EVENT_META||{})[evId]; if(m)m.logosPantalla=lista;
  try{ if(typeof syncToFB==='function') await syncToFB(); }catch(e){}
  R();
}

// ── Quitar el fondo de un logo ─────────────────────────────
//
// Los logos de campeonato llegan casi siempre como un JPG con fondo liso —negro
// o blanco— alrededor del dibujo. Puesto sobre el barrido o sobre el scoreboard,
// ese cuadrado se ve encima de todo y arruina la transmisión.
//
// Se rellena desde los bordes hacia adentro mientras el color se parezca al del
// fondo, y esos pixeles quedan transparentes. Es a propósito un relleno desde el
// borde y no "borrar todo lo que sea negro": así los contornos negros de adentro
// del dibujo —que en estos logos son casi todos— no se tocan.
function _fondoUniforme(datos,w,h){
  const px=(x,y)=>{const i=(y*w+x)*4;return [datos[i],datos[i+1],datos[i+2],datos[i+3]];};
  const esquinas=[px(0,0),px(w-1,0),px(0,h-1),px(w-1,h-1)];
  if(esquinas.some(c=>c[3]<250))return null;          // ya tiene transparencia
  const [r,g,b]=esquinas[0];
  const parecidas=esquinas.every(c=>Math.abs(c[0]-r)+Math.abs(c[1]-g)+Math.abs(c[2]-b)<40);
  return parecidas?{r,g,b}:null;
}

function _quitarFondo(datos,w,h,fondo,tol){
  const dentro=new Uint8Array(w*h);
  const pila=[];
  const cerca=i=>Math.abs(datos[i]-fondo.r)+Math.abs(datos[i+1]-fondo.g)+Math.abs(datos[i+2]-fondo.b)<=tol;
  const meter=(x,y)=>{
    if(x<0||y<0||x>=w||y>=h)return;
    const p=y*w+x;
    if(dentro[p])return;
    if(!cerca(p*4))return;
    dentro[p]=1;pila.push(p);
  };
  for(let x=0;x<w;x++){meter(x,0);meter(x,h-1);}
  for(let y=0;y<h;y++){meter(0,y);meter(w-1,y);}
  while(pila.length){
    const p=pila.pop(), x=p%w, y=(p-x)/w;
    meter(x+1,y);meter(x-1,y);meter(x,y+1);meter(x,y-1);
  }
  let quitados=0;
  for(let p=0;p<w*h;p++)if(dentro[p]){datos[p*4+3]=0;quitados++;}
  return quitados;
}

// Devuelve un PNG sin el fondo, o null si no había un fondo liso que quitar.
async function _logoSinFondo(file){
  const bmp=await createImageBitmap(file);
  const c=document.createElement('canvas');
  c.width=bmp.width;c.height=bmp.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bmp,0,0);
  const img=ctx.getImageData(0,0,c.width,c.height);
  const fondo=_fondoUniforme(img.data,c.width,c.height);
  if(!fondo)return null;
  const quitados=_quitarFondo(img.data,c.width,c.height,fondo,60);
  // Si casi no sacó nada, no era un fondo; y si se llevó casi todo, algo salió
  // mal y es mejor dejar el original que subir una imagen en blanco.
  const total=c.width*c.height;
  if(quitados<total*0.02||quitados>total*0.97)return null;
  ctx.putImageData(img,0,0);
  const blob=await new Promise(res=>c.toBlob(res,'image/png'));
  return blob?{blob,fondo,quitados,total}:null;
}

// ── Acciones de los botones (window.…) ──────────────────────────────────────
// Las llaman los onclick de la pantalla. Asignarlas acá, antes de arranque.js,
// solo las deja listas un poco antes: ninguna se ejecuta al cargar.

window.screenSetMode=function(m){window._SCREEN_LOCAL.mode=m;_screenPush();R();};

// Fondo del modo "Atleta en barra": bandera del país · logo del campeonato · azul.
window.screenSetFondo=function(f){window._SCREEN_LOCAL.fondo=f;_screenPush();R();};

// Difuminado de la bandera de fondo. Sin R(): un re-render en medio del arrastre
// corta el deslizador, igual que pasaba con el del tamaño de los nombres.
window.screenSetVelo=function(v){
  let n=parseFloat(v); if(isNaN(n))n=0.55;
  n=Math.max(0.15,Math.min(0.85,n)); n=Math.round(n*100)/100;
  window._SCREEN_LOCAL.veloBandera=n;
  _screenPush();
  const sl=document.getElementById('scrVeloRange'); if(sl&&parseFloat(sl.value)!==n)sl.value=n;
  const lb=document.getElementById('scrVeloPct'); if(lb)lb.textContent=Math.round(n*100)+'%';
};

// Tamaño del logo del club de fondo. Sin R(), como el del difuminado.
window.screenSetTamLogo=function(v){
  let n=parseInt(v,10); if(isNaN(n))n=72;
  n=Math.max(30,Math.min(130,n));
  window._SCREEN_LOCAL.tamLogoClub=n;
  _screenPush();
  const sl=document.getElementById('scrTamLogoRange'); if(sl&&parseInt(sl.value,10)!==n)sl.value=n;
  const lb=document.getElementById('scrTamLogoPct'); if(lb)lb.textContent=n+'%';
};

// Luces de jueces en la pantalla de tarima. Es un espejo: no da válido ni nulo.
window.screenToggleLuces=function(){
  window._SCREEN_LOCAL.luces=!window._SCREEN_LOCAL.luces;_screenPush();R();
};

window.screenSetNameScale=function(v){
  let n=parseFloat(v)||1; n=Math.max(0.6,Math.min(2.2,n)); n=Math.round(n*100)/100;
  window._SCREEN_LOCAL.nameScale=n; window._JORNADA_NAMESCALE=n;
  _screenPush();
  // Actualizar el panel SIN re-render (para no cortar el arrastre del slider)
  const sl=document.getElementById('scrNameRange'); if(sl&&parseFloat(sl.value)!==n)sl.value=n;
  const lb=document.getElementById('scrNamePct'); if(lb)lb.textContent=Math.round(n*100)+'%';
  const pv=document.getElementById('scrNamePrev'); if(pv)pv.style.fontSize=Math.round(15*n)+'px';
};

window.screenNudgeNameScale=function(d){window.screenSetNameScale((window._SCREEN_LOCAL.nameScale||1)+d);};

window.screenToggleFlight=function(f){
  const arr=window._SCREEN_LOCAL.flights;
  const i=arr.indexOf(f);
  if(i>=0)arr.splice(i,1);else arr.push(f);
  _screenPush();R();
};

window.screenAllFlights=function(){
  const all=[...new Set(DATA.athletes.map(a=>a.flight))].sort(_cmpFl);
  window._SCREEN_LOCAL.flights=all;_screenPush();R();
};

window.piResetLayout=function(){
  if(!confirm('¿Restablecer las posiciones y tamaños de la Pantalla de Intentos a los valores por defecto?'))return;
  // Las de "Atleta en barra" son las que empiezan con b y mayúscula (bSigla,
  // bPeso…). 'barbell' es de esta pantalla, por eso se pide la mayúscula.
  _piResetClaves(k=>!/^b[A-Z]/.test(k));
};

window.barraResetLayout=function(){
  if(!confirm('¿Volver a dejar "Atleta en barra" como venía de fábrica?\nSe pierden las posiciones y tamaños que acomodaste en esta pantalla.'))return;
  _piResetClaves(k=>/^b[A-Z]/.test(k));
};

window.piSetSetting=function(key,val){
  window._piSettings[key]=val;
  _piSaveSettings();
  if(typeof R==='function')R();
};

window.piToggleSettingsPanel=function(){
  window._piPanelOpen=!window._piPanelOpen;
  if(typeof R==='function')R();
};

window.piResetColors=function(){
  window._piSettings.bgColor=PI_DEFAULT_SETTINGS.bgColor;
  window._piSettings.accentColor=PI_DEFAULT_SETTINGS.accentColor;
  window._piSettings.textColor=PI_DEFAULT_SETTINGS.textColor;
  _piSaveSettings();
  if(typeof R==='function')R();
};

window.descPoner=function(min){
  const seg=Math.round(Number(min)*60);
  if(!(seg>0))return;
  const rot=(document.getElementById('descTexto')||{}).value;
  _descEscribe({active:true,startedAt:Date.now(),durationSec:seg,
    label:(rot||'').trim(),pausedAt:0,videos:[],movement:'',style:_descEstiloPrevio()});
};

window.descPausar=function(){
  const bt=_descBT(); if(!bt)return;
  if(bt.pausedAt){
    // Seguir: se corre el arranque tanto como duró la pausa, así no se pierde
    // el tiempo que estuvo detenido.
    _descEscribe(Object.assign({},bt,{startedAt:bt.startedAt+(Date.now()-bt.pausedAt),pausedAt:0}));
  } else {
    _descEscribe(Object.assign({},bt,{pausedAt:Date.now()}));
  }
};

window.descQuitar=function(){
  _descEscribe({active:false,startedAt:0,durationSec:0,label:'',pausedAt:0,
    videos:[],movement:'',style:_descEstiloPrevio()});
};

window.descTogglePanel=function(){
  window._descPanelOpen=!window._descPanelOpen;
  if(typeof renderTxWidget==='function'&&TX_MODE)renderTxWidget();
  else if(typeof R==='function')R();
};

// Re-sincroniza la nómina con el admin. Trae todos los atletas aprobados/pendientes
// desde Firestore y reconcilia: agrega nuevos, elimina los que ya no están (sin datos)
// y avisa de los borrados que tienen pesos/intentos cargados.
window.resyncFromAdmin=async function(){
  if(!fbReady||!window._fb){alert('Firebase no listo todavía. Espera unos segundos y vuelve a intentar.');return}
  if(!DATA.event){alert('No hay competencia activa');return}
  if(!confirm('Re-sincronizar la nómina con el admin?\n\n• Trae atletas nuevos\n• Borra los que ya no están en admin (si NO tienen pesos/intentos cargados acá)\n• Avisa de los borrados que sí tienen datos para revisarlos a mano\n• Toma tanda, división, categoría y modalidad de la pestaña Cronograma\n\nLotes y pesaje se conservan. La categoría de los que ya están pesados no se toca.'))return;
  const evId=Object.keys(LIVE_EVENTS).find(k=>LIVE_EVENTS[k]===DATA.event.name)||DATA.event.id||DATA.event.name;
  try{
    const q=window._fb.query(
      window._fb.collection(fbDB,'inscripciones'),
      window._fb.where('evento','==',evId),
      window._fb.where('status','in',['approved','pending'])
    );
    const snap=await window._fb.getDocs(q);
    const flightMap=await _loadCronoFlightMap(evId);
    const fbAthletes=snap.docs
      .map(d=>({...d.data(),id:d.id}))
      .sort((a,b)=>((a.timestamp==null?void 0:a.timestamp.seconds)||0)-((b.timestamp==null?void 0:b.timestamp.seconds)||0))
      .map((ins,j)=>_inscToAthlete(ins,j,flightMap));
    if(!fbAthletes.length){alert('No hay inscripciones aprobadas/pendientes en Firestore para este campeonato.');return}
    _mergeFirebaseAthletes(fbAthletes);
    // Forzar nuevo render para que los toasts se ordenen
    showToastLC('Re-sincronización completa: '+fbAthletes.length+' atletas en Firestore');
  }catch(e){alert('Error sincronizando: '+(e.message||e));console.error(e)}
};

// Editar el lote a mano. Si el número nuevo ya lo tenía otro atleta,
// hace un swap (intercambia los lotes entre los dos).
window.setLot=function(id,val){
  const n=parseInt(val,10);
  const a=DATA.athletes.find(x=>x.id===id);if(!a)return;
  if(!Number.isFinite(n)||n<1){
    showToastLC('Lote inválido — debe ser un número entero ≥ 1');
    R();return;
  }
  if(n===a.lot){R();return}
  const other=DATA.athletes.find(x=>x.lot===n&&x.id!==id);
  if(other){
    // Swap: el otro recibe el lote anterior
    other.lot=a.lot;
    a.lot=n;
  } else {
    a.lot=n;
  }
  _markAtt(id,'meta');
  save();R();
};

window.obsWsSaveAndConnect=function(){
  _obsWsSettings={
    host:(__o=>__o==null?void 0:__o.value)(document.getElementById('obsWsHost'))||'localhost',
    port:parseInt((__o=>__o==null?void 0:__o.value)(document.getElementById('obsWsPort')),10)||4455,
    password:(__o=>__o==null?void 0:__o.value)(document.getElementById('obsWsPass'))||'',
    autoConnect:(__o=>__o==null?void 0:__o.checked)(document.getElementById('obsWsAuto'))||false
  };
  try{localStorage.setItem('obs_ws_settings',JSON.stringify(_obsWsSettings))}catch(e){}
  obsWsConnect();
};

window.obsWsToggleConnection=function(){
  if(_obsWsConnected)obsWsDisconnect();else obsWsConnect();
};

// Envía un CustomEvent a través de OBS para verificar el roundtrip.
// OBS lo broadcastea, nuestro listener lo recibe → toggle profile.
window.obsWsTestEvent=async function(){
  if(!_obsWs||!_obsWsConnected){alert('Conecta primero a OBS WebSocket');return}
  try{
    await _obsWs.call('BroadcastCustomEvent',{eventData:{action:'toggle',component:'profile',_test:true}});
    alert('Evento enviado a OBS. Si la conexión está bien, el perfil debería togglearse en pantalla en 1-2s. Mira el log de abajo, "Últimos eventos recibidos".');
  }catch(e){alert('Error enviando evento: '+(e.message||e))}
};

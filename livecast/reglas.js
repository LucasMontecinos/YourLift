// livecast.html — Reglas del deporte: GL, mejores intentos y totales, quién compite con quién, orden de la barra, categorías y divisiones.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// ── Orden de las tandas ──────────────────────────────────────────────────
// Ordenar tandas como texto pone «AA» ANTES de «B», porque compara letra por
// letra. Con las tandas de una sola letra nunca se notó; el Sudamericano tiene
// 36 rondas y llega hasta la AJ, y ahí el orden de salida quedaba A, AA, AB…
// AJ, B, C. La tanda es un número escrito en letras: primero cuántas letras
// tiene y después el alfabeto, que es como se cuenta A…Z, AA, AB.
//
// Vale para cualquier tanda: también para las que llevan el número de tarima
// pegado ('A1', 'B2'), donde el largo es el mismo y decide el alfabeto.
function _cmpFl(a,b){
  const x=String(a==null?'':a), y=String(b==null?'':b);
  return x.length-y.length || x.localeCompare(y);
}

// El filtro de ?tarima=1|2 sirve cuando el campeonato reparte sus tandas entre
// dos plataformas y se las nombra con el número pegado: 'A1' va a la tarima 1,
// 'A2' a la 2.
//
// Una tanda SIN número pegado —'A', 'AA', las 36 del Sudamericano— no es de una
// tarima ni de la otra: es de un campeonato que no está partido. Filtrarla
// contra un '1' la dejaba afuera siempre, y como esto decide qué atletas se
// cargan, un ?tarima= puesto de más en el link no vaciaba una pantalla: vaciaba
// la competencia entera, sin decir por qué. Esas tandas pasan.
function _inTarima(flightLetter){
  if(!TARIMA)return true;
  const f=String(flightLetter||'');
  if(!/\d$/.test(f))return true;
  return f.endsWith(TARIMA);
}

// IPF GL Points oficial — coeficientes según sexo + modalidad + vista
// Fuente: https://www.ipfpointscalculator.com/  ·  IPF GL Coefficients (2020+)
//
// Modalidades base:
//   'classic'         → Powerlifting Classic Raw (SQ+BP+DL)
//   'equipped'        → Powerlifting Equipped (SQ+BP+DL)
//   'onlybench'       → Bench-only Classic (solo BP)
// Modalidades combinadas (atleta participa en dos rankings):
//   'classic_bench'   → Classic (full meet) + Only Bench (Classic)
//   'equipped_bench'  → Equipped (full meet) + Only Bench (Equipped)
//
// Parámetro `view` indica para qué tabla calcular:
//   'meet'  → ranking de Powerlifting completo (default)
//   'bench' → ranking de Bench-only
// Modalidad sin ambigüedad para el GL. 'equipped_bench' lo usan DOS casos: el
// equipado que además compite en Only Bench, y el Only Bench Equipado puro. Al
// puro hay que darle los coeficientes de banca sola; al combinado, los de
// powerlifting completo cuando se lo mide por su total.
// Invitado/a: el atleta que no dio el peso (o entra fuera de nómina) y compite
// igual. Sale a tarima, se le cargan y juzgan los intentos y se ve en pantalla,
// pero NO entra al ranking de su categoría ni al acta como competidor: va aparte,
// en el cuadro de fuera de competencia. Antes había que dejarlo en su modalidad
// —y entonces le ganaba el lugar a quien sí dio el peso— o inventarle una
// división, que ensuciaba el acta.
function _esInvitado(a){ return String(a&&a.mod||'')==='invitado'; }

function _glMod(a){
  if(!a)return '';
  if(a.mod==='equipped_bench'&&typeof _isPlusBench==='function'&&!_isPlusBench(a))return 'onlybench_eq';
  return a.mod;
}

function calcGL(t,bw,sex,mod,view){
  if(!t||!bw||t<=0)return 0;
  const isMale=(sex==='Hombre'||sex==='M'||sex==='Masculino');
  view=view||'meet';

  // Detectar la modalidad efectiva según la tabla a la que pertenece este cálculo.
  // 'onlybench_eq' lo pone _glMod() para el Only Bench Equipado PURO: comparte el
  // código 'equipped_bench' con el equipado que además hace banca, y sin
  // distinguirlos al puro se le aplicaban los coeficientes de powerlifting
  // completo sobre un total que es solo su banca.
  const isOnlyBenchPure=(mod==='onlybench'||mod==='oe_bench'||mod==='onlybench_eq');
  const isClassicBench=(mod==='classic_bench');
  const isEquippedBench=(mod==='equipped_bench');
  const isEquippedMeet=(mod==='equipped'||mod==='Equipado'||mod==='SP');
  // Special Olympics: usa los MISMOS coeficientes Classic IPF GL
  // (la modalidad solo separa el ranking, no cambia la fórmula)
  // const isOE=(mod==='oe_classic'||mod==='oe_bench');

  // Qué tabla de coeficientes le toca (compartido/gl.js).
  let clave;
  if(view==='bench' || isOnlyBenchPure){
    // Bench Equipped, o Bench Classic (default para onlybench y classic_bench cuando view=bench)
    clave=(isEquippedBench||mod==='onlybench_eq')?'boe':'bo';
  } else if(isEquippedMeet||isEquippedBench){
    clave='ple';   // Powerlifting Equipped (full meet)
  } else {
    clave='pl';    // Powerlifting Classic / Raw (full meet) — default
  }
  const v=YLGL.puntos(clave+(isMale?'_m':'_f'),bw,t);
  return v===null?0:v;
}

function inBenchRanking(a){
  return a&&(a.mod==='onlybench'||a.mod==='classic_bench'||a.mod==='equipped_bench');
}

function isOEClassic(a){return a&&a.mod==='oe_classic';}

function isOEBench(a){return false;}

  // OE no tiene bench-only
// A la tabla de POWERLIFTING solo entran los que hacen los tres movimientos: el
// que compite en PL y además en Only Bench (mod combinado) sí, el Only Bench puro
// no. 'equipped_bench' vale para los dos casos, por eso se mira la bandera.
function isMeetClassic(a){
  return a&&(a.mod==='classic'||(a.mod==='classic_bench'&&_isPlusBench(a)));
}

function isMeetEquipped(a){
  return a&&(a.mod==='equipped'||(a.mod==='equipped_bench'&&_isPlusBench(a)));
}

// Siempre en número. Hay pesos que llegan como texto ("305", desde la planilla o
// la nómina) y así se comparaban como texto: "97.5" le ganaba a "102.5", y el
// Sudamericano 2026 se publicó con marcas y totales en texto.
function bestOf(a,l){let b=0;a.att[l].forEach(x=>{const w=+(x&&x.w)||0;if(x.r==='g'&&w>b)b=w});return b}

function totalOf(a,view){
  // view: 'meet' (default) → suma SQ+BP+DL para Powerlifting completo
  //       'bench' → solo mejor BP (para tabla Only Bench)
  if(!a)return 0;
  view=view||'meet';
  // Only Bench puro (incluido OE bench): siempre devuelve BP
  if(a.mod==='onlybench'||a.mod==='oe_bench')return bestOf(a,'bp')||0;
  // Combinadas: si view=bench, devolver mejor BP
  if(view==='bench'&&(a.mod==='classic_bench'||a.mod==='equipped_bench')){
    return bestOf(a,'bp')||0;
  }
  // Para Powerlifting completo: si está DQ (3 fails en algún lift) → total inválido
  if(isDQ(a))return 0;
  // Default: full meet (Classic/Equipped/OE Classic/combinadas en view=meet)
  const s=bestOf(a,'sq'),b=bestOf(a,'bp'),d=bestOf(a,'dl');
  return(s&&b&&d)?s+b+d:0;
}

function rankings(){return DATA.athletes.filter(a=>!_esInvitado(a)).map(a=>({...a,total:totalOf(a),gl:calcGL(totalOf(a),a.bw,a.sex,_glMod(a))})).filter(a=>a.total>0).sort((a,b)=>b.gl-a.gl)}

// Índice del intento "actual" de una entrada de la cola. Para un 4º intento la
// entrada es un clon con __ai=3; para el resto es la ronda activa (DATA.round).
function curAtt(c){ return (c && c.__ai!=null) ? c.__ai : DATA.round; }

// Atleta REAL detrás de una entrada de la cola. El clon del 4º tiene su att[lift]
// con el índice de la ronda "redirigido" al 4º (bien para mostrar el intento en
// curso, pero rompe una fila completa de intentos). Para tablas/scoreboard que
// listan los 3 (o 4) intentos, usar el atleta real y curAtt(c) para el resaltado.
function _realAth(c){ return (c && c.__is4) ? (DATA.athletes.find(x=>x.id===c.id)||c) : c; }

// Clon superficial de un atleta cuyo "intento actual" (att[lift][DATA.round])
// APUNTA a su 4º intento. Así TODOS los consumidores de display (Control TX,
// pantalla, barra, scoreboard) muestran el 4º sin cambios. __ai=3 marca el índice
// real para que el JUZGADO (✓/✗) apunte al 4º y no a la ronda normal.
function _mk4clone(a){
  const l=DATA.lift;
  const arr=a.att[l].slice();
  arr[DATA.round]=a.att[l][3];
  const attCopy=Object.assign({},a.att);attCopy[l]=arr;
  return Object.assign({},a,{att:attCopy,__ai:3,__is4:true});
}

// Cola de tarima de la ronda activa. Incluye los 4º intentos concedidos EN ESTA
// ronda: los "se sigue a sí mismo" van ADELANTE (el atleta repite enseguida) y los
// "al final de la ronda" van al FINAL. La ronda NO cambia (sigue INT 1/2/3): el 4º
// aparece como el mismo atleta de nuevo dentro de su ronda.
function liftQueue(){
  const flightAth=DATA.athletes.filter(a=>a.flight===DATA.flight&&!a.bombed);
  const normal=flightAth.filter(a=>{const at=a.att[DATA.lift][DATA.round];return at&&at.r===null&&at.w>0})
    .sort((a,b)=>{const wa=a.att[DATA.lift][DATA.round].w,wb=b.att[DATA.lift][DATA.round].w;return wa!==wb?wa-wb:a.lot-b.lot});
  // El 4º sale en la cola desde la ronda en que se concedió y NO se pierde si la
  // ronda avanzó sin haberlo levantado: sigue apareciendo al final hasta que se
  // juzgue. Antes se exigía la ronda exacta, así que un extra al que todavía no
  // le habían declarado el peso desaparecía en cuanto se pasaba de ronda.
  const has4=a=>{const at=a.att[DATA.lift][3];return at&&at.extra&&(at.grantedRound||0)<=DATA.round&&at.r===null&&at.w>0;};
  const self4=flightAth.filter(a=>has4(a)&&a.att[DATA.lift][3].mode==='self').sort((a,b)=>a.lot-b.lot).map(_mk4clone);
  const end4=flightAth.filter(a=>has4(a)&&a.att[DATA.lift][3].mode!=='self').sort((a,b)=>{const wa=a.att[DATA.lift][3].w,wb=b.att[DATA.lift][3].w;return wa!==wb?wa-wb:a.lot-b.lot}).map(_mk4clone);
  let q=[...self4,...normal,...end4];
  // forceCurrentAttempt: mover al frente (solo la entrada normal, no un clon 4º).
  if(DATA.forcedCurrent){
    const idx=q.findIndex(a=>a.id===DATA.forcedCurrent && !a.__is4);
    if(idx>0){const [f]=q.splice(idx,1);q.unshift(f);}
  }
  return q;
}

// Peso del próximo intento DECLARADO y todavía sin juzgar del atleta, en el lift
// activo. Sirve para ordenar en la vista del público a los que ya levantaron el
// intento de la ronda: apenas declaran el siguiente se acomodan entre ellos de
// menor a mayor, en vez de quedar todos amontonados al final hasta que cambie la
// ronda. Devuelve 0 si todavía no declararon nada.
function _proxPeso(a){
  const arr=(a&&a.att&&a.att[DATA.lift])||[];
  for(let r=0;r<3;r++){ const t=arr[r]; if(t&&t.r===null&&+t.w>0) return +t.w; }
  return 0;
}

// Orden de menor a mayor por el próximo intento declarado; a igual peso manda el
// lote más chico, como en la tarima. Los que todavía no declararon van al final.
function _cmpProx(a,b){
  const wa=_proxPeso(a), wb=_proxPeso(b);
  if(!wa&&!wb)return a.lot-b.lot;
  if(!wa)return 1;
  if(!wb)return -1;
  return wa!==wb?wa-wb:a.lot-b.lot;
}

// Último atleta que salió a tarima en el lift activo. Los intentos no guardan
// hora, pero la tanda sale de menor a mayor: dentro de la ronda que se corre, el
// último en salir es el intento YA JUZGADO más pesado (a igual peso, el de lote
// mayor). Si la ronda recién empezó y nadie levantó todavía, se mira la anterior.
function _ultimoEnTarima(){
  const l=DATA.lift;
  for(let r=DATA.round;r>=0;r--){
    let mejor=null;
    DATA.athletes.forEach(a=>{
      if(a.flight!==DATA.flight)return;
      const t=(a.att&&a.att[l]||[])[r];
      if(!t||t.r===null||!(+t.w>0))return;
      if(!mejor||+t.w>mejor.w||(+t.w===mejor.w&&a.lot>mejor.lot))mejor={id:a.id,w:+t.w,lot:a.lot,lift:l,round:r};
    });
    if(mejor)return mejor;
  }
  return null;
}

function _discosPorLado(ladoKg){
  const r=[]; let rem=Math.round((+ladoKg||0)*100)/100;
  if(rem<=0)return r;
  for(const p of [25,20,15,10,5,2.5,1.25]){ while(rem>=p-0.001){ r.push(p); rem=Math.round((rem-p)*100)/100; } }
  for(const [p,n] of _FRACCIONARIOS){ for(let i=0;i<n&&rem>=p-0.001;i++){ r.push(p); rem=Math.round((rem-p)*100)/100; } }
  return r;
}

// Normaliza la categoría a "N" o "N+" — acepta el signo antes O después del
// número ('+120 kg', '120+ kg', '-120 kg' → '120+', '120+', '120'). Antes el +
// adelante se perdía y los superpesados salían como si fueran -120.
function _normCat(s){const t=String(s||'');const m=t.match(/([+]?)(\d+\.?\d*)(\+?)/);if(!m)return s;const plus=(m[1]==='+'||m[3]==='+');return m[2]+(plus?'+':'');}

function _normDiv(d){
  const v=(d||'').toLowerCase().replace(/[\s\-_]/g,'');
  if(v.startsWith('sub'))return 'Sub-Junior';
  if(v.startsWith('junior'))return 'Junior';
  if(v.startsWith('open'))return 'Open';
  if(v.includes('master4')||v.includes('masteriv'))return 'Master IV';
  if(v.includes('master3')||v.includes('masteriii'))return 'Master III';
  if(v.includes('master2')||(v.includes('masterii')&&!v.includes('iii')))return 'Master II';
  if(v.includes('master1')||(v.includes('masteri')&&!v.includes('ii')))return 'Master I';
  return d;
}

// Normaliza el sexo a 'M' / 'F' (acepta M, Masculino, Hombre, Varón / F, Femenino, Mujer, Dama).
// Sirve para agrupar categorías: evita que "M" y "Masculino" caigan en grupos distintos.
function _normSex(s){
  const v=(s||'').toString().trim().toLowerCase();
  if(v.startsWith('f')||v.startsWith('muj')||v.startsWith('dam')||v.startsWith('w'))return 'F';
  if(v.startsWith('m')||v.startsWith('h')||v.startsWith('v'))return 'M';
  return v?v.toUpperCase():'?';
}

// Clave única de categoría (sexo|cat|div) normalizada — agrupa correctamente aunque
// los valores vengan con espacios, mayúsculas o sinónimos distintos.
// ¿Contra quién compite este atleta? El sexo, la categoría y la división no
// alcanzan: un EQUIPADO no compite contra un classic, y el only bench es otra
// competencia que la del total. Comparar sus marcas es comparar dos cosas que no
// se juegan en la misma cancha — un equipado sale con más kilos porque lleva
// traje, no porque levante más.
//
// La línea y la modalidad salen de _nomLineMod, que ya resuelve el caso
// enredado: 'equipped_bench' le toca tanto al combinado equipado como al Only
// Bench Equipado puro, y quién compite en las dos lo dice la bandera plusBench,
// no el código. PL y PL+BP compiten los dos por el total, así que van juntos; el
// ONLY BENCH va aparte. El invitado, que no entra al ranking de su categoría,
// queda en su propio grupo.
function _lineaComp(a){
  const [linea,modal]=_nomLineMod(a);
  return linea+'/'+(modal==='ONLY BENCH'?'BP':'PL');
}

// Etiqueta corta para los encabezados: sin esto, dos grupos que ahora se separan
// se verían con el mismo título y parecería que la tabla salió repetida.
function _lineaLbl(a){
  const [linea,modal]=_nomLineMod(a);
  return linea+(modal==='ONLY BENCH'?' · ONLY BENCH':'');
}

function _catGroupKey(a){return _normSex(a&&a.sex)+'|'+_normCat((a&&a.cat)||'?')+'|'+_normDiv((a&&a.div)||'Sin Div')+'|'+_lineaComp(a);}

// Divisiones contra las que se mide este atleta: la suya y el Open — descartando
// aquellas en las que su categoría no se compite.
// La división que le corresponde por EDAD, sacada del año de nacimiento con la
// regla de compartido/divisiones.js (se cuenta por año calendario): 14-18 Sub-Junior,
// 19-23 Junior, 40 Master I, 50 Master II, 60 Master III, 70 Master IV. Entre 24
// y 39 no hay división de edad: es Open. '' si no se sabe.
//
// Sirve para los récords: un atleta en edad Junior que se inscribe en Open
// compite en Open, pero la marca que hace también es suya como Junior, y si
// supera ese récord, lo rompe. Pasó con Cedeno Diego (2007) en el Sudamericano.
function _divPorEdad(a){
  const m=String((a&&(a.born||a.anioNac))||'').match(/(19|20)\d{2}/);
  const nac=m?parseInt(m[0],10):0;
  if(!nac)return '';
  const ref=parseInt(String((DATA.event&&DATA.event.date)||'').slice(0,4),10)||new Date().getFullYear();
  const e=ref-nac;
  if(e<14||e>100)return '';
  if(e<=18)return 'Sub-Junior';
  if(e<=23)return 'Junior';
  if(e<40)return '';
  if(e<50)return 'Master I';
  if(e<60)return 'Master II';
  if(e<70)return 'Master III';
  return 'Master IV';
}

// Helper: ¿el atleta quedó descalificado del TOTAL?
// Sí → cuando falló los 3 intentos de algún lift (squat / bench / deadlift).
// Sigue pudiendo competir en los lifts siguientes pero no tiene total válido.
function isDQ(a){
  if(!a||!a.att)return false;
  return a.att.sq.every(x=>x.r==='n')||a.att.bp.every(x=>x.r==='n')||a.att.dl.every(x=>x.r==='n');
}

function sortByCat(){DATA.athletes.sort((a,b)=>{const na=parseFloat(a.cat.replace(/[^0-9.]/g,''))||999;const nb=parseFloat(b.cat.replace(/[^0-9.]/g,''))||999;return na-nb});save();R()}

function sortByFlight(){DATA.athletes.sort((a,b)=>{if(a.flight!==b.flight)return _cmpFl(a.flight,b.flight);const na=parseFloat(a.cat.replace(/[^0-9.]/g,''))||999;const nb=parseFloat(b.cat.replace(/[^0-9.]/g,''))||999;return na-nb});save();R()}

function sortByLot(){DATA.athletes.sort((a,b)=>a.lot-b.lot);save();R()}

// Mejor marca PROYECTADA de un movimiento: lo mejor que ya validó o, si todavía
// no valida nada, lo que tiene declarado y sin juzgar. Al empezar la competencia
// eso es su apertura.
function _proyLift(a,l){
  const arr=(a.att&&a.att[l])||[];
  let decl=0;
  for(let r=0;r<3;r++){ const t=arr[r]; if(t&&t.r===null&&+t.w>0){ decl=+t.w; break; } }
  return Math.max(bestOf(a,l)||0, decl);
}

// Total proyectado: dónde quedaría el atleta si levanta todo lo que tiene pedido.
// Cuando ya se juzgaron los nueve intentos coincide con el total real, así que la
// misma cuenta sirve durante la competencia y al final.
function _proyTotal(a,view){
  if(view==='bench')return _proyLift(a,'bp');
  if(isDQ(a))return 0;                       // tres nulos en un movimiento: sin total
  const s=_proyLift(a,'sq'), b=_proyLift(a,'bp'), d=_proyLift(a,'dl');
  return (s&&b&&d)?s+b+d:0;
}

// ¿A este atleta le queda algo por levantar? Si a nadie del grupo le queda, el
// puesto que muestra la tabla ya es el definitivo.
function _quedaPorLevantar(a,view){
  const lifts=view==='bench'?['bp']:['sq','bp','dl'];
  return lifts.some(l=>((a.att&&a.att[l])||[]).some(t=>t&&t.r===null&&+t.w>0));
}

function forecastTotal(a){
  const s=bestOf(a,'sq'),b=bestOf(a,'bp'),d=bestOf(a,'dl');
  // For current lift, add the attempt weight if not yet judged
  let fs=s,fb=b,fd=d;
  if(!s){const best=a.att.sq.reduce((m,x)=>x.w>m?x.w:m,0);fs=best}
  if(!b){const best=a.att.bp.reduce((m,x)=>x.w>m?x.w:m,0);fb=best}
  if(!d){const best=a.att.dl.reduce((m,x)=>x.w>m?x.w:m,0);fd=best}
  return fs+fb+fd;
}

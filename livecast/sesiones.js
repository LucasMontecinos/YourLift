// livecast.html — Días y turnos del campeonato: qué tandas van juntas en cada sesión.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// Tandas existentes (con atletas activos), orden alfabético — A, B, C...
function _allFlightsSorted(){return [...new Set(DATA.athletes.filter(a=>!a.bombed).map(a=>a.flight))].sort(_cmpFl);}

// Orden de tandas ARRANCANDO POR LA ACTIVA y siguiendo en círculo: si están A B C D
// y en tarima está la C, se ven C D A B. Así la tanda que está levantando queda
// siempre arriba (y con ella sus récords), en vez de quedar enterrada abajo.
// Es el mismo círculo que usa advanceLift() para pasar de tanda al terminar un lift.
function _flightsFromCurrent(list){
  const fl=(list||[]).slice();
  const i=fl.indexOf(DATA.flight);
  return i>0?fl.slice(i).concat(fl.slice(0,i)):fl;
}

// ¿La tanda "fl" ya terminó todos sus intentos de "lift" (los 3, o los que haya declarado)?
// ── Sesiones (jornadas) ────────────────────────────────────────────
// La jornada sale del Cronograma (AM/PM, o "Día 1 · AM" en campeonatos de
// varios días) y define qué tandas van juntas. Sirve para que la competencia
// avance DENTRO de la sesión: sentadilla A, B y C; después banca A, B y C;
// después peso muerto A, B y C. Recién cuando la mañana termina entera se pasa
// a la tarde con la D y la E. Si el evento no tiene jornadas cargadas, todas las
// tandas son una sola sesión y el comportamiento es el de siempre.
function _jornadaDeFlight(fl){
  const a=DATA.athletes.find(x=>x.flight===fl&&!x.bombed&&String(x.jornada||'').trim());
  return a?String(a.jornada).trim():'';
}

function _flightsDeJornada(fl){
  const todas=_allFlightsSorted();
  const j=_jornadaDeFlight(fl);
  if(!j)return todas;
  const mismas=todas.filter(f=>_jornadaDeFlight(f)===j);
  return mismas.length?mismas:todas;
}

// Las sesiones en el orden en que van a competir: por día, después por hora o
// turno (la mañana antes que la tarde) y, si nada de eso lo dice, por la letra de
// su primera tanda, que es como se ordenaba antes.
function _jornadasEnOrden(){
  const out=[], primera={};
  _allFlightsSorted().forEach((f,i)=>{const j=_jornadaDeFlight(f);if(out.indexOf(j)<0){out.push(j);primera[j]=i;}});
  const clave=j=>{
    if(!j)return {dia:null,t:null};
    const p=_jornadaPartes(j);
    return {dia:_diaDeJornada(j), t:p.hora!=null?p.hora:(p.turno==='AM'?9*60:p.turno==='PM'?15*60:null)};
  };
  return out.slice().sort((a,b)=>{
    const ka=clave(a), kb=clave(b);
    if(ka.dia!=null&&kb.dia!=null&&ka.dia!==kb.dia)return ka.dia-kb.dia;
    if(ka.t!=null&&kb.t!=null&&ka.t!==kb.t)return ka.t-kb.t;
    return primera[a]-primera[b];
  });
}

// ── Día y turno de cada tanda ─────────────────────────────────────────────
// La jornada de un atleta llega en dos formatos:
//   · la nómina del Sudamericano: "D1 20/09 · 09:00 · Sesión A";
//   · el Cronograma del panel (regionales y campeonatos creados): el día como se
//     escribió ("Día 1", "Sábado 8", "8 de agosto") y el turno AM/PM, unidos:
//     "Día 1 · AM". Un campeonato de un solo día trae solo "AM" o "PM".
// Antes solo se entendía el primero, así que en un regional de dos días no había
// fila de días ni orden de sesiones por día.
function _turnoDe(p){
  const n=_nnCrono(p).replace(/\./g,'');
  if(n==='am'||n==='manana')return 'AM';
  if(n==='pm'||n==='tarde')return 'PM';
  return '';
}

function _jornadaPartes(j){
  j=String(j||'').trim();
  const out={dia:'',turno:'',hora:null,fecha:'',num:null};
  if(!j)return out;
  const h=/\b(\d{1,2}):(\d{2})\b/.exec(j);
  if(h)out.hora=(+h[1])*60+(+h[2]);
  const m=/^D(\d+)\b\s*([\d/]*)/.exec(j);
  if(m){out.dia='D'+m[1];out.num=+m[1];out.fecha=m[2]||'';return out;}
  j.split('\u00b7').map(x=>x.trim()).filter(Boolean).forEach(p=>{
    const t=_turnoDe(p);
    if(t){ if(!out.turno)out.turno=t; }
    else if(!out.dia&&!/^\d{1,2}:\d{2}$/.test(p))out.dia=p;
  });
  return out;
}

function _diaClave(d){
  const n=_nnCrono(d);
  if(!n)return [3,Infinity,''];
  let i=_DIAS_SEM_LC.findIndex(x=>n.indexOf(x)>=0);
  if(i<0){const m=n.match(/\b(lun|mar|mie|jue|vie|sab|dom)\b/); if(m)i=['lun','mar','mie','jue','vie','sab','dom'].indexOf(m[1]);}
  if(i>=0)return [0,i,n];
  const num=n.match(/\d+/);
  if(num)return [1,parseInt(num[0],10),n];
  return [2,0,n];
}

function _cmpDia(a,b){const ka=_diaClave(a),kb=_diaClave(b);return (ka[0]-kb[0])||(ka[1]-kb[1])||ka[2].localeCompare(kb[2]);}

// Los días del Cronograma de este campeonato, en orden.
function _diasDelCampeonato(){
  const s=new Set();
  (DATA.athletes||[]).forEach(a=>{
    if(!a.jornada)return;
    const p=_jornadaPartes(a.jornada);
    if(p.dia&&p.num==null)s.add(p.dia);
  });
  return [...s].sort(_cmpDia);
}

function _diaDeJornada(j){
  const p=_jornadaPartes(j);
  if(p.num!=null)return p.num;
  if(!p.dia)return null;
  const i=_diasDelCampeonato().indexOf(p.dia);
  return i>=0?i+1:null;
}

function _diaDeTanda(f){
  const a=DATA.athletes.find(x=>x.flight===f&&x.jornada);
  return a?_diaDeJornada(a.jornada):null;
}

function _fechaDeTanda(f){
  const a=DATA.athletes.find(x=>x.flight===f&&x.jornada);
  if(!a)return '';
  const p=_jornadaPartes(a.jornada);
  if(p.num!=null)return p.fecha;
  // Del Cronograma: si el día no es "Día N", se muestra como se escribió.
  return /^d[ií]a\s*\d+$/i.test(p.dia)?'':p.dia;
}

// La sesión de una tanda, para mostrarle al operador qué tandas van juntas:
// "DÍA 1 · MAÑANA". Vacío si el campeonato no tiene días ni turnos.
function _sesionEtiqueta(f){
  const j=_jornadaDeFlight(f);
  if(!j)return '';
  const p=_jornadaPartes(j);
  const hhmm=p.hora!=null?(String(Math.floor(p.hora/60)).padStart(2,'0')+':'+String(p.hora%60).padStart(2,'0')):'';
  const turno=p.turno==='AM'?'MAÑANA':p.turno==='PM'?'TARDE':'';
  const dia=p.num!=null?'DÍA '+p.num:(p.dia||'').toUpperCase();
  return [dia,turno||hhmm].filter(Boolean).join(' \u00b7 ');
}

function _tandasPorDia(tandas){
  const porDia={};
  tandas.forEach(f=>{ const d=_diaDeTanda(f); if(d)(porDia[d]=porDia[d]||[]).push(f); });
  return porDia;
}

// Dibuja la fila de días y devuelve las tandas del día elegido. `zona` separa la
// elección de cada pantalla: el operador puede estar mirando el día 2 en Control
// en Vivo y el 3 en Atletas & Pesaje sin que una mueva a la otra.
function _filaDias(zona, tandas, diaEnTarima){
  const porDia=_tandasPorDia(tandas);
  const dias=Object.keys(porDia).map(Number).sort((a,b)=>a-b);
  if(dias.length<2) return {html:'', tandas};
  if(window._DIA_SEL[zona]==null||!porDia[window._DIA_SEL[zona]])
    window._DIA_SEL[zona]=diaEnTarima||dias[0];
  const sel=window._DIA_SEL[zona];
  let h='<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:8px">';
  h+='<span style="font-size:10px;color:var(--muted);font-family:Oswald;letter-spacing:1px;margin-right:2px">VER DÍA</span>';
  dias.forEach(d=>{
    const on=d===sel, hoy=d===diaEnTarima;
    h+='<button onclick="verDia(\''+zona+'\','+d+')" class="os" style="padding:5px 14px;border-radius:999px;border:2px solid '
      +(on?'var(--gold)':'var(--border)')+';background:'+(on?'rgba(212,168,67,.14)':'transparent')
      +';color:'+(on?'var(--gold)':'var(--muted)')+';font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer">'
      +'DÍA '+d+'<span style="font-size:9px;opacity:.65;margin-left:5px">'+_fechaDeTanda(porDia[d][0])+'</span>'
      +(hoy?'<span style="font-size:8px;color:var(--green);margin-left:5px">EN TARIMA</span>':'')+'</button>';
  });
  h+='</div>';
  return {html:h, tandas:porDia[sel]};
}

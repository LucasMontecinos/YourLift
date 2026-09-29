// inscripcion.html — reconocer al atleta: su código, sus datos y en qué campeonatos ya compitió (el bloqueo por regional).
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

function _insAplicarEdits(){
  if(!window._INS_EDITS_DOCS||!athleteDB.length||!window.YLEdiciones)return;
  window.YLEdiciones.aplicar(athleteDB,window._INS_EDITS_DOCS);
}

function _evClaveIns(ev){ return YLCampeonato.clave(ev); }

   // compartido/campeonatos.js
// Devuelve los campeonatos que chocan con el que se está inscribiendo.
//
// TODO va dentro de un try. Esta función se llama en cada dibujado del formulario
// y otra vez al enviar: si llegara a tirar una excepción —un dato raro, un campo
// que no vino— rompería la inscripción entera. El sistema de inscripciones
// funciona y no se puede estropear por un aviso. Si algo sale mal, no hay aviso y
// el formulario sigue exactamente como antes.
function bloqueoDetectado(){
  try{ return _bloqueoDetectado(); }
  catch(e){ console.warn('[aviso] no se pudo revisar la participación previa',e); return []; }
}

// ¿Esta persona compitió de verdad en ese campeonato, o solo estaba anotada?
// Un registro de competencia sin resultado es una nómina: se inscribió y no
// levantó. Los que sí estuvieron traen marcas, o quedaron DQ habiéndolas
// intentado — esos también compitieron.
function _compitioEn(c){
  const r=c&&c.resultado;
  if(!r)return false;
  if(String(r.status||'').toUpperCase()==='DQ')return true;
  return (r.total||0)>0||(r.sq||0)>0||(r.bp||0)>0||(r.dl||0)>0;
}

function _clavesConResultado(){
  const db=athleteDB||[];
  if(_cvesResCache&&_cvesResRef===db&&_cvesResN===db.length)return _cvesResCache;
  const s={};
  db.forEach(a=>(a.competencias||[]).forEach(c=>{
    if(_compitioEn(c))s[_evClaveIns(c.evento)]=1;
  }));
  _cvesResRef=db; _cvesResN=db.length;
  return (_cvesResCache=s);
}

// La inscripción guarda el id del campeonato; los registros del archivo guardan
// el nombre. Se traduce para poder compararlos. Si el campeonato ya no está en
// la lista, se devuelve el id: normalizado da la misma clave que el nombre.
function _nombreDeEvento(ev){
  const e=(EVENTS||[]).find(x=>x.id===ev);
  return (e&&e.name)||ev||'';
}

function _bloqueoDetectado(){
  const f=(state&&state.form)||{};
  const ev=EVENTS.find(e=>e.id===f.evento);
  const claves=(ev&&ev.bloqueaClaves)||[];
  if(!claves.length||!f.rut)return [];
  const rutN=String(formatRut(f.rut)).replace(/[^0-9kK]/g,'').toUpperCase();
  if(rutN.length<5)return [];

  // Se miran las DOS fuentes. data.json se publica cada tanto: cuando se probó
  // esto, el archivo que se sirve a los atletas no tenía a NADIE del Regional
  // Centro Sur ni del Norte —143 personas entre los dos, cerrados esa misma
  // semana— y el aviso no le habría saltado a ninguna. Lo recién cerrado está en
  // competition_results, así que se lee de ahí también.
  const previas=[];
  const a=findAthleteByRut(formatRut(f.rut));
  // Inscribirse no es competir. Quien se anotó y después se bajó queda en la
  // nómina sin resultado, y el cupo de la temporada no se le gasta: el compendio
  // habla de competir, no de inscribirse. Con el Regional Centro 2026 eran 38
  // personas de 67 recibiendo un aviso que no les correspondía.
  //
  // La prueba es haber estado en la tarima: un resultado. Pero solo se puede
  // exigir cuando de ese campeonato hay resultados cargados — si del campeonato
  // solo tenemos la nómina, no hay con qué distinguir a los que compitieron, y
  // ahí se prefiere el aviso de más antes que dejar de avisar.
  const conRes=_clavesConResultado();
  if(a)(a.competencias||[]).forEach(c=>{
    if(conRes[_evClaveIns(c.evento)] && !_compitioEn(c))return;
    previas.push({evento:c.evento,fecha:c.fecha});
  });
  (compResDB||[]).forEach(r=>{
    if(String(r.rut||'').replace(/[^0-9kK]/g,'').toUpperCase()===rutN)
      previas.push({evento:r.evento,fecha:r.fecha});
  });
  // Y las inscripciones que siguen en pie. Acá está la diferencia entre los dos
  // casos que en el archivo se ven idénticos: el que participó conserva su
  // inscripción al campeonato; el que se bajó, no.
  (insActDB||[]).forEach(i=>{
    // Se filtra al cargar, pero se vuelve a mirar acá: la lista queda cacheada y
    // no conviene que el criterio dependa de cuándo se guardó esa caché.
    if(String(i.status||'')==='rejected')return;
    if(String(i.rut||'').replace(/[^0-9kK]/g,'').toUpperCase()!==rutN)return;
    previas.push({evento:_nombreDeEvento(i.evento),fecha:''});
  });

  const vistos={},out=[];
  previas.forEach(c=>{
    const k=_evClaveIns(c.evento);
    if(claves.indexOf(k)<0||vistos[k])return;
    vistos[k]=1;
    out.push({evento:String(c.evento||'').replace(/\s*[-–]\s*Tarima\s*\d+\s*$/i,'').trim(),fecha:c.fecha||''});
  });
  return out;
}

function bloqueoAvisoHtml(){
  try{ return _bloqueoAvisoHtml(); }
  catch(e){ console.warn('[aviso] no se pudo dibujar',e); return ''; }
}

function _bloqueoAvisoHtml(){
  const ch=bloqueoDetectado();
  if(!ch.length)return '';
  const ev=EVENTS.find(e=>e.id===((state&&state.form)||{}).evento);
  // display:block: la clase .alert es flex y pondría cada párrafo en su propia
  // columna. Acá el aviso es un texto largo que se lee de arriba a abajo.
  return `<div class="alert" style="display:block;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.45);color:var(--text);text-align:left;line-height:1.6">
    <div style="font-family:Oswald;font-size:14px;letter-spacing:1px;color:#ef4444;margin-bottom:8px"><i class=yl-i-alerta></i> YA REGISTRAS UNA PARTICIPACIÓN ESTE AÑO</div>
    <div style="font-size:13px;margin-bottom:10px">
      Según el Compendio ${new Date().getFullYear()}, tu inscripción a <b>${(ev&&ev.name)||'este campeonato'}</b> queda a revisión y aprobación
      por parte de la Comisión Técnica, porque ya participaste en un campeonato clasificatorio de esta temporada:
    </div>
    <ul style="margin:0 0 10px 18px;font-size:13px">
      ${ch.map(x=>`<li style="padding:2px 0"><b>${x.evento}</b>${x.fecha?` <span style="color:var(--muted);font-size:11px">· ${x.fecha}</span>`:''}</li>`).join('')}
    </ul>
    <div style="font-size:12px;color:var(--muted);font-style:italic;border-left:2px solid rgba(239,68,68,.4);padding-left:10px;margin-bottom:10px">
      “${COMPENDIO_CITA}”<br>
      <span style="font-style:normal;font-size:11px">${COMPENDIO_FUENTE}</span>
    </div>
    <div style="font-size:12px;color:var(--muted)">
      De igual forma puedes continuar con la inscripción: la Comisión Técnica revisa cada caso y aplica las excepciones que correspondan.
      Si crees que esto es un error, continúa y avisa a la Comisión.
    </div>
  </div>`;
}

function findAthleteByRut(rut) {
  if (!rut) return null;
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 5) return null;
  return athleteDB.find(a => {
    const dbRut = (a.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
    return dbRut && dbRut === clean;
  }) || null;
}

function generateCode(rut, nombre) {
  if (!rut || !nombre) return '';
  const rutDigits = rut.replace(/[^0-9]/g, '');
  if (rutDigits.length < 4) return '';
  const prefix = rutDigits.slice(0, 4);
  const parts = nombre.trim().split(/\s+/).filter(w => w.length > 0);
  // First name + apellidos (skip second name if 4+ words)
  let initials = '';
  if (parts.length >= 3) {
    initials = parts[0].charAt(0) + parts[parts.length - 2].charAt(0) + parts[parts.length - 1].charAt(0);
  } else if (parts.length === 2) {
    initials = parts[0].charAt(0) + parts[1].charAt(0);
  } else {
    initials = parts[0].charAt(0);
  }
  initials = initials.toUpperCase();
  const year = new Date().getFullYear();
  return prefix + initials + '-' + year;
}

// El atleta cambió el nombre que la federación tiene para su RUT.
//
// La base arrastra muchos nombres incompletos —falta el segundo nombre, falta
// un apellido— y al completarlos pasaba esto: el atleta escribía, salía del
// campo, la pantalla parpadeaba y volvía el nombre corto. Sin explicación y sin
// forma de insistir.
//
// Ahora se le pregunta una vez. Si confirma, su nombre queda: es el que va a la
// inscripción y el que sale en la nómina. Si no, vuelve el de la base.
function revisarNombre() {
  const f = state.form;
  const base = (f._nombreBase || '').trim();
  const ahora = (f.nombre || '').trim();
  // Atleta nuevo, campo vacío o sin cambios: el flujo de siempre.
  if (!base || !ahora || ahora === base) { autoFillCode(); return; }
  // Ya lo confirmó y no lo volvió a tocar: no se le pregunta en cada salida del campo.
  if (f._nombreCorregido && ahora === f._nombreCorregidoA) { autoFillCode(); return; }
  const ok = confirm(
    'La federación te tiene registrado como:\n\n    ' + base +
    '\n\nY tú escribiste:\n\n    ' + ahora +
    '\n\n¿Es este tu nombre completo?\n\n' +
    'Si aceptas, se usa el tuyo en la inscripción y en la nómina, y le queda avisado ' +
    'a la federación para que corrija tu ficha.');
  if (ok) {
    f._nombreCorregido = true;
    f._nombreCorregidoA = ahora;
  } else {
    f.nombre = base;
    f._nombreCorregido = false;
    f._nombreCorregidoA = '';
  }
  render();
}

function autoFillCode() {
  const f = state.form;
  const rut = formatRut(f.rut);
  if (!rut) return;

  // Buscar por RUT en base de datos
  const found = findAthleteByRut(rut);
  if (found && found.codigo) {
    // ATLETA EXISTENTE → autocompletar nombre completo, sexo, fecha de nacimiento
    f.codigo = found.codigo;
    f._codigoSource = 'db';
    // El nombre que tiene la federación para este RUT. Se guarda aparte para
    // poder distinguir "todavía no lo ha tocado" de "lo corrigió a propósito".
    const nombreBase = (found.nombre || '').trim();
    const tipeado = (f.nombre || '').trim();
    if (nombreBase) {
      f._nombreBase = nombreBase;
      // El nombre de la base rellena el campo vacío y corrige lo que el atleta
      // haya tipeado ANTES de que se lo reconociéramos. Lo que NO hace es pisar
      // una corrección hecha a conciencia: la base tiene muchos nombres
      // incompletos —falta el segundo nombre, falta un apellido— y el atleta los
      // completaba, salía del campo y se le volvía atrás, sin explicación.
      if (!f._nombreCorregido) {
        if (!tipeado || tipeado !== nombreBase) {
          const avisar = !!tipeado && tipeado !== nombreBase;
          f.nombre = nombreBase;
          if (avisar) {
            state.success = 'Atleta encontrado — autocompletamos tu nombre completo, fecha y sexo';
            setTimeout(() => { if (state.success.includes('autocompletamos')) { state.success = ''; render(); } }, 4000);
          }
        }
      }
    }
    // Fecha de nacimiento (formato: yyyy-mm-dd para input[type=date])
    if (found.fechaNac && !f.fechaNac) {
      // Convertir dd/mm/yyyy → yyyy-mm-dd si hace falta
      let fn = found.fechaNac.trim();
      const m = fn.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) fn = `${m[3]}-${m[2]}-${m[1]}`;
      f.fechaNac = fn;
    }
    // Club — aplicar override de athlete_edits si existe
    {
      const rk = String(found.rut||'').replace(/[^0-9kK]/g,'').toLowerCase();
      const ed = (window._INS_EDITS_RUT&&rk&&window._INS_EDITS_RUT[rk])
               || (window._INS_EDITS_COD&&found.codigo&&window._INS_EDITS_COD[found.codigo]);
      if (ed && ed.club) f.club = ed.club;
      else if (!f.club && found.club) f.club = found.club;
    }
    // Sexo y ciudad: el atleta los completa manualmente
    // Re-renderizar para reflejar los datos autocompletados
    render();
    return;
  }

  // ATLETA NUEVO → necesita el nombre tipeado para generar código
  const nombre = formatName(f.nombre);
  if (!nombre) return;
  const code = generateCode(rut, nombre);
  if (code) {
    f.codigo = code;
    f._codigoSource = 'new';
  }
  // Update DOM directly (no rerender, evita perder foco del input)
  const el = document.getElementById('codigoInput');
  const lb = document.getElementById('codigoLabel');
  if (el) {
    el.value = f.codigo;
    el.style.borderColor = f.codigo ? 'var(--gold)' : 'var(--border)';
  }
  if (lb) {
    lb.textContent = f._codigoSource === 'new' ? 'Nuevo atleta — código generado automáticamente' : '';
    lb.style.color = 'var(--orange, #f59e0b)';
  }
}

// Autorellena ciudad/región (comuna, zona) desde la última inscripción del atleta.
// El correo NO se autorrellena (es privado). No sobreescribe lo que el atleta ya escribió.
async function autoFillContact() {
  const f = state.form;
  const rut = formatRut(f.rut);
  if (!rut || !firebaseReady) return;
  if (f.comuna && f.zona) return; // ya tiene ambos, no consultar
  try {
    const q = window.FB.query(window.FB.collection(db, 'inscripciones'), window.FB.where('rut', '==', rut));
    const snap = await window.FB.getDocs(q);
    let cands = [];
    snap.forEach(d => cands.push(d.data()));
    cands = cands.filter(c => c.status !== 'rejected' && (c.comuna || c.zona));
    if (!cands.length) return;
    cands.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    const last = cands[0];
    let changed = false;
    if (!f.comuna && last.comuna) { f.comuna = last.comuna; changed = true; }
    if (!f.zona && last.zona) { f.zona = last.zona; changed = true; }
    if (changed) render();
  } catch (e) { /* silencioso: si falla, el atleta llena a mano */ }
}

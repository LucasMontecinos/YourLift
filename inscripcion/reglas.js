// inscripcion.html — catálogos y validaciones: clubes, modalidades, divisiones, nombre y RUT.
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

// Las opciones del desplegable, en orden. `actual` es el club que ya tiene la
// persona: si su club dejó de figurar igual se incluye, porque si no el <select>
// se dibujaría en blanco y al guardar la inscripción perdería el club en silencio.
function clubsParaElegir(actual){
  const delPadron = [...new Set((athleteDB || [])
    .filter(a => a && a.club)
    .map(a => (a.club || '').trim())
    .filter(c => c && c !== 'Otro'))];
  const base = (athleteDB && athleteDB.length && delPadron.length) ? delPadron : CLUBS_RESPALDO;
  const out = base.slice().sort((a, b) => a.localeCompare(b, 'es'));
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (actual && actual !== 'Otro' && !out.some(c => norm(c) === norm(actual))) out.push(actual);
  if (!out.includes('Otro')) out.push('Otro');
  return out;
}

function esModalidadOE(m){
  return /olimpiada/i.test(String(m == null ? '' : m).normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

// La modalidad que el formulario está usando ahora. Se lee en un solo lugar
// para que el catálogo, la lista de requeridos y la subida vean lo mismo.
function _modalidadActual(mod){
  if (mod !== undefined) return mod;
  try { return state.form.modalidad; } catch (e) { return ''; }
}

// Las modalidades y divisiones de ESTE campeonato.
//
// Las listas de arriba son las de la federación. Pero un campeonato puede correr
// con las suyas —Olimpiadas Especiales tiene sus propias líneas— y esperar a que
// alguien toque el código para abrir una inscripción no sirve. Desde
// Admin → Campeonatos se agregan; con "solo estas" REEMPLAZAN a la lista en vez
// de sumarse, porque a quien se inscribe en una copa de Olimpiadas Especiales no
// le sirve que le ofrezcan "Powerlifting Equipado + Only Bench".
// Recorta y saca las vacías. El panel ya lo hace al guardar, pero una línea con
// solo espacios llegaba igual desde un documento viejo y creaba una modalidad
// fantasma en el desplegable: una opción en blanco que se podía elegir.
function _limpiaLista(a){
  return Array.isArray(a) ? a.map(x=>String(x==null?'':x).trim()).filter(Boolean) : [];
}

function modalidadesDe(evObj){
  const x = _limpiaLista(evObj && evObj.modsExtra);
  if (!x.length) return MODALITIES.slice();
  return (evObj && evObj.modsSolo) ? x.slice() : MODALITIES.concat(x);
}

function divisionesDe(evObj){
  const x = _limpiaLista(evObj && evObj.divsExtra);
  if (!x.length) return DIVISIONS.slice();
  return (evObj && evObj.divsSolo) ? x.slice() : DIVISIONS.concat(x);
}

function _divEtiqueta(d){ return _RANGO_MASTER[d] ? d+' ('+_RANGO_MASTER[d]+')' : d; }

// El campeonato que se está inscribiendo, para las dos de arriba.
function _evActual(){ try{ return EVENTS.find(e=>e.id===state.form.evento)||null; }catch(e){ return null; } }

// ══════════════════════════════════════════════
// FORMATTING HELPERS
// ══════════════════════════════════════════════
function formatName(val) {
  if (!val) return '';
  return val.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function formatRut(val) {
  if (!val) return '';
  let r = val.replace(/[^0-9kK]/g, '').toUpperCase();
  if (r.length > 1 && !r.includes('-')) {
    r = r.slice(0, -1) + '-' + r.slice(-1);
  }
  return r;
}

// ── Validador RUT chileno (módulo 11) ──────────────────────────
// Devuelve {valid, dv, expected, msg}. Si valid=false, msg dice por qué.
function validateRut(val){
  if(!val) return {valid:false, msg:'RUT vacío'};
  const clean = val.replace(/[^0-9kK]/g,'').toUpperCase();
  if(clean.length < 2) return {valid:false, msg:'RUT muy corto'};
  if(clean.length > 9) return {valid:false, msg:'RUT muy largo'};
  const body = clean.slice(0,-1);
  const dv = clean.slice(-1);
  if(!/^\d+$/.test(body)) return {valid:false, msg:'Solo dígitos antes del DV'};
  // Cálculo módulo 11
  let sum = 0, mul = 2;
  for(let i = body.length - 1; i >= 0; i--){
    sum += parseInt(body[i],10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  const expected = r === 11 ? '0' : (r === 10 ? 'K' : String(r));
  if(dv !== expected) return {valid:false, dv, expected, msg:'Dígito verificador incorrecto (esperado: '+expected+')'};
  return {valid:true, dv, expected};
}

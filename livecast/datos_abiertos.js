// ══ DATOS ABIERTOS ══════════════════════════════════════════════════════════
// Una copia pública, de solo lectura, de la competencia en vivo, con un formato
// fijo y documentado, para que otras apps (un asistente para entrenadores,
// estadísticas, pantallas propias) la lean sin depender del formato interno del
// livecast, que cambia cada vez que se ajusta algo. Es lo mismo que hace
// LiftingCast con su base "_readonly" por competencia.
//
// Dónde queda: livecast_sync/abierto__{id del campeonato}, y con dos tarimas
// abierto__{id}__t1 y __t2. Va en la misma colección que la competencia para
// usar sus mismas reglas —cualquiera lee, solo la mesa escribe—: no hay reglas
// nuevas que publicar.
//
// Quién la escribe: la mesa (el controlador), después de cada escritura
// confirmada de la competencia, y además cada tanto por si algo cambió sin
// pasar por ahí. Solo escribe si el contenido cambió. Si falla, avisa en la
// consola y nada más: la competencia no depende de esto.
//
// Qué lleva: exactamente lo que ya se ve en la Competencia en Vivo. Nombre,
// club, sexo, división, categoría, modalidad, peso corporal, día, tanda, lote,
// cada intento (peso y válido/nulo), la tanda activa y quién está en tarima y
// quién sigue. NO lleva RUT, fecha ni año de nacimiento, código de atleta,
// contactos, fotos ni nada de la operación (racks, cambios de intento, reloj).
//
// El formato se llama "yourlift-vivo/1". Si alguna vez hay que cambiarlo de una
// forma que rompa a quien lo lee, sube el número; agregar un campo no lo sube.
const DA_FORMATO = 'yourlift-vivo/1';
const DA_COLECCION = 'livecast_sync';

function _daId() {
  const ev = (typeof DATA !== 'undefined' && DATA && DATA.event) || null;
  if (!ev) return null;
  let base = ev.id || '';
  if (!base) { try { base = fbDocId() || ''; } catch (e) { base = ''; } }
  base = String(base).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) return null;
  return 'abierto__' + base + (TARIMA ? '__t' + TARIMA : '');
}

function _daUrl(id) {
  return 'https://firestore.googleapis.com/v1/projects/' + FB_CFG.projectId + '/databases/(default)/documents/'
    + DA_COLECCION + '/' + encodeURIComponent(id) + '?key=' + FB_CFG.apiKey;
}

function _daIntento(t) {
  const w = +(t && t.w) || 0;
  const r = t && t.r;
  return { peso: w > 0 ? w : null, resultado: r === 'g' ? 'valido' : (r === 'n' ? 'nulo' : null) };
}

function _daAtleta(a, diaDe) {
  const intentos = {};
  ['sq', 'bp', 'dl'].forEach(l => {
    const arr = (a.att && a.att[l]) || [];
    const v = [0, 1, 2].map(i => _daIntento(arr[i]));
    // 4º intento (récord), solo si se concedió
    const c = arr[3];
    if (c && c.extra && (+c.w > 0 || c.r)) v.push(Object.assign(_daIntento(c), { cuarto: true }));
    intentos[l] = v;
  });
  const lote = (a.lot === undefined || a.lot === null || a.lot === '') ? null : +a.lot;
  return {
    id: a.id,
    nombre: a.name || '',
    club: a.club || '',
    sexo: _normSex(a.sex),
    division: _normDiv(a.div || '') || '',
    categoria: _normCat(a.cat || '') || '',
    modalidad: a.mod || '',
    peso_corporal: +a.bw > 0 ? +a.bw : null,
    dia: diaDe(a.flight),
    tanda: a.flight || '',
    lote: isNaN(lote) ? null : lote,
    intentos,
  };
}

// La tanda activa y quién está en tarima, con el cursor de la TARIMA (si esta
// pantalla está en vista libre mirando otra cosa, no cuenta lo que mira).
function _daTarima(diaDe) {
  const run = (typeof _conCursorDeTarima === 'function') ? _conCursorDeTarima : (fn => fn());
  return run(() => {
    let q = [];
    try { q = liftQueue(); } catch (e) { q = []; }
    const ent = c => {
      if (!c) return null;
      const i = curAtt(c);
      const t = ((c.att && c.att[DATA.lift]) || [])[i] || {};
      return { atleta_id: c.id, nombre: c.name || '', movimiento: DATA.lift || '', intento: i + 1, peso: +t.w > 0 ? +t.w : null };
    };
    return {
      tanda_activa: { tanda: DATA.flight || '', dia: diaDe(DATA.flight), movimiento: DATA.lift || '', ronda: (DATA.round | 0) + 1 },
      en_tarima: ent(q[0]),
      siguiente: ent(q[1]),
    };
  });
}

function _daArmar() {
  const ev = DATA.event || {};
  // El día de cada tanda, calculado una vez por tanda
  const dias = {};
  const diaDe = f => {
    if (!f) return null;
    if (!(f in dias)) { let d = null; try { d = _diaDeTanda(f); } catch (e) { d = null; } dias[f] = (d === undefined ? null : d); }
    return dias[f];
  };
  const t = _daTarima(diaDe);
  return {
    formato: DA_FORMATO,
    campeonato: { id: ev.id || '', nombre: ev.name || '', fecha: ev.date || '', lugar: ev.location || '', tarima: TARIMA ? (+TARIMA || TARIMA) : null },
    tanda_activa: t.tanda_activa,
    en_tarima: t.en_tarima,
    siguiente: t.siguiente,
    atletas: (DATA.athletes || []).map(a => _daAtleta(a, diaDe)),
  };
}

// ── Escritura (solo la mesa) ──
let _daUlt = null, _daUltId = null, _daEnCurso = false, _daPend = false, _daTimer = null;
function _daPuedeEscribir() {
  return !PRACTICE_MODE && fbReady && window._fb && fbDB && isAdmin && window.IS_CONTROLLER && DATA && DATA.event
    && (typeof _srvAdoptado !== 'function' || _srvAdoptado());
}
function _daProgramar() {
  if (!_daPuedeEscribir()) return;
  clearTimeout(_daTimer);
  _daTimer = setTimeout(_daEscribir, 350);
}
async function _daEscribir() {
  if (!_daPuedeEscribir()) return;
  if (_daEnCurso) { _daPend = true; return; }
  const id = _daId();
  if (!id) return;
  let cuerpo;
  try { cuerpo = JSON.stringify(_daArmar()); } catch (e) { console.warn('[datos abiertos] no se pudo armar', e && e.message); return; }
  if (cuerpo === _daUlt && id === _daUltId) return;
  _daEnCurso = true;
  try {
    const ahora = Date.now();
    const datos = '{"actualizado":"' + new Date(ahora).toISOString() + '",' + cuerpo.slice(1);
    await window._fb.setDoc(window._fb.doc(fbDB, DA_COLECCION, id), { formato: DA_FORMATO, actualizado: ahora, datos });
    _daUlt = cuerpo; _daUltId = id;
  } catch (e) {
    console.warn('[datos abiertos] no se pudo publicar', e && (e.code || e.message));
  } finally {
    _daEnCurso = false;
    if (_daPend) { _daPend = false; _daProgramar(); }
  }
}
// Por si algo cambió sin pasar por la escritura de la competencia (o al abrir,
// cuando no hay nada nuevo que escribir): revisa cada 15 s. Si no cambió nada,
// no escribe.
setInterval(() => { try { _daEscribir(); } catch (e) {} }, 15000);

// ── Pestaña "Datos abiertos" (vista del público) ──
function _daCopiar(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const txt = el.textContent;
  const listo = () => showToastLC('Copiado');
  try {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(txt).then(listo, () => _daCopiarViejo(txt, listo)); return; }
  } catch (e) {}
  _daCopiarViejo(txt, listo);
}
function _daCopiarViejo(txt, listo) {
  const t = document.createElement('textarea');
  t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); listo(); } catch (e) { showToastLC('No se pudo copiar: selecciónalo a mano'); }
  t.remove();
}

async function _daEstado(url) {
  const el = document.getElementById('daEstado');
  if (!el) return;
  try {
    const r = await fetch(url + '&mask.fieldPaths=actualizado', { cache: 'no-store' });
    if (r.status === 404) { el.textContent = 'Todavía sin datos: aparecen cuando la mesa empieza a cargar la competencia.'; return; }
    const j = await r.json();
    const ms = +(j && j.fields && j.fields.actualizado && (j.fields.actualizado.integerValue || j.fields.actualizado.doubleValue));
    el.textContent = ms ? 'Última actualización: ' + new Date(ms).toLocaleString('es-CL') : 'Publicado.';
  } catch (e) {
    el.textContent = '';
  }
}

function renderDatosAbiertos() {
  const id = _daId();
  if (!id) return '<div class="fade"><h2 class="os" style="font-size:22px;letter-spacing:1px;margin-bottom:12px">DATOS ABIERTOS</h2><div class="card">Elige un campeonato para ver su enlace.</div></div>';
  const url = _daUrl(id);
  setTimeout(() => _daEstado(url), 0);
  const code = 'display:block;white-space:pre;overflow-x:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;padding:12px 14px;border-radius:8px;background:var(--card2);border:1px solid var(--border);color:var(--text)';
  const tit = t => '<div class="os" style="font-size:13px;letter-spacing:1.5px;color:var(--muted);margin-bottom:10px">' + t + '</div>';
  const btn = (txt, on) => '<button onclick="' + on + '" style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-family:Oswald;font-size:12px;letter-spacing:.5px;cursor:pointer">' + txt + '</button>';
  const p = (t, extra) => '<p style="font-size:14px;line-height:1.6;color:var(--text);margin:0 0 10px;max-width:72ch' + (extra || '') + '">' + t + '</p>';
  const ejJs =
    "import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';\n" +
    "import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';\n\n" +
    "const app = initializeApp({ apiKey: '" + FB_CFG.apiKey + "', projectId: '" + FB_CFG.projectId + "' });\n" +
    "const db = getFirestore(app);\n\n" +
    // (comillas dobles en el ejemplo: así el revisor de reglas —pruebas/t_reglas—
    // no lo confunde con una colección que usa el livecast)
    'onSnapshot(doc(db, "' + DA_COLECCION + '", "' + id + '"), (s) => {\n' +
    "  if (!s.exists()) return;                 // todavía sin datos\n" +
    "  const vivo = JSON.parse(s.data().datos);\n" +
    "  console.log(vivo.en_tarima, vivo.atletas.length);\n" +
    "});";
  const ejRest =
    'GET ' + url + '\n\n' +
    '// La respuesta es un documento de Firestore. Lo que importa está en:\n' +
    'const vivo = JSON.parse(respuesta.fields.datos.stringValue);';
  const campos = [
    ['formato', '"yourlift-vivo/1". Si alguna vez cambia de una forma que rompa a quien lo lee, sube el número.'],
    ['actualizado', 'Fecha y hora de la última actualización (ISO 8601, UTC).'],
    ['campeonato', 'id, nombre, fecha, lugar y tarima (1 o 2 si hay dos tarimas; si no, null).'],
    ['tanda_activa', 'tanda, dia, movimiento ("sq" sentadilla, "bp" banca, "dl" peso muerto) y ronda (1, 2 o 3).'],
    ['en_tarima', 'Quién está levantando: atleta_id, nombre, movimiento, intento (1 a 3; 4 si es un cuarto intento) y peso. null entre rondas.'],
    ['siguiente', 'Quién viene después, con los mismos campos. null si no hay nadie más en la ronda.'],
    ['atletas[]', 'id, nombre, club, sexo ("M"/"F"), division, categoria, modalidad, peso_corporal (kg; null antes del pesaje), dia, tanda, lote e intentos.'],
    ['intentos', 'Uno por movimiento: sq, bp y dl, cada uno con sus 3 intentos { peso, resultado }. peso es null si todavía no se pide; resultado es "valido", "nulo" o null (sin juzgar). Un cuarto intento concedido va al final con "cuarto": true.'],
    ['modalidad', '"classic", "equipped", "onlybench" (solo banca), "classic_bench" o "equipped_bench" (compite en las dos), "oe_classic" (Olimpiadas Especiales) o "invitado" (compite fuera de ranking).'],
  ];
  let h = '<div class="fade" style="max-width:920px">';
  h += '<h2 class="os" style="font-size:22px;letter-spacing:1px;margin-bottom:8px">DATOS ABIERTOS</h2>';
  h += p('Una copia de solo lectura de este campeonato en vivo, para apps de entrenadores, estadísticas o pantallas propias. Trae lo mismo que se ve en la Competencia en Vivo y se actualiza con cada intento que carga la mesa.', ';color:var(--muted)');
  h += '<div class="card">' + tit('ENLACE DE ESTE CAMPEONATO');
  h += '<code id="daUrl" style="' + code + ';white-space:normal;word-break:break-all">' + esc(url) + '</code>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">' + btn('<i class=yl-i-copiar></i> Copiar', "_daCopiar('daUrl')")
    + '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);color:var(--text);font-family:Oswald;font-size:12px;letter-spacing:.5px;text-decoration:none"><i class=yl-i-enlace></i> Abrir</a>'
    + '<span id="daEstado" style="font-size:12px;color:var(--muted)"></span></div>';
  h += '<div style="font-size:12px;color:var(--muted);margin-top:10px;line-height:1.5">Se lee sin cuenta, con un GET. El contenido va en el campo <b>datos</b>, como texto JSON.'
    + (TARIMA ? ' Este campeonato usa dos tarimas: cada una tiene su enlace (termina en __t1 o __t2).' : '') + '</div>';
  h += '</div>';
  h += '<div class="card">' + tit('EN TIEMPO REAL');
  h += p('Para enterarse de cada cambio apenas pasa, sin consultar a cada rato, se escucha el documento con el SDK de Firebase (web, Flutter, Android o iOS). En JavaScript:');
  h += '<code id="daJs" style="' + code + '">' + esc(ejJs) + '</code>';
  h += '<div style="margin-top:10px">' + btn('<i class=yl-i-copiar></i> Copiar', "_daCopiar('daJs')") + '</div>';
  h += '<div style="font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5">Sin SDK también sirve leer el enlace cada algunos segundos (con uno cada 2 a 5 segundos basta):</div>';
  h += '<code id="daRest" style="' + code + ';margin-top:8px;white-space:pre-wrap;word-break:break-all">' + esc(ejRest) + '</code>';
  h += '</div>';
  h += '<div class="card">' + tit('QUÉ TRAE');
  h += '<div style="display:grid;grid-template-columns:minmax(110px,auto) 1fr;gap:8px 16px;font-size:13px;line-height:1.5">';
  campos.forEach(([k, v]) => { h += '<code style="font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--text);font-size:12px;align-self:start">' + esc(k) + '</code><div style="color:var(--muted)">' + esc(v) + '</div>'; });
  h += '</div></div>';
  h += '<div class="card">' + tit('USO RESPONSABLE');
  h += '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:var(--muted)">'
    + '<li>Son datos de personas. Úsalos para seguir la competencia; no los vendas ni los uses para publicidad.</li>'
    + '<li>No trae RUT, fecha de nacimiento, contactos ni fotos: lo mismo que ya es público en la página en vivo.</li>'
    + '<li>Si un dato está mal, lo corrige la mesa y se actualiza solo.</li>'
    + '</ul></div>';
  h += '</div>';
  return h;
}

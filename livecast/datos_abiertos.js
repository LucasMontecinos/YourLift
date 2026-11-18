// ══ DATOS ABIERTOS ══════════════════════════════════════════════════════════
// La pestaña "Datos abiertos" de la vista del público: el enlace de solo lectura
// al documento en vivo de este campeonato (livecast_sync/{canal}), el mismo que
// leen esta página, la transmisión y las pantallas. Sirve para que otras apps
// (por ejemplo, un asistente para entrenadores) sigan la competencia.
//
// Solo el enlace. Hubo una versión en la que la mesa escribía además una copia
// aparte con formato fijo, pero era una escritura más por la misma vía que la
// competencia: con wifi malo podía restarle a lo que importa, y no se tomó el
// riesgo. Este documento ya lo escribe la mesa igual; leerlo no le agrega nada.
// Lleva lo mismo que la página en vivo y nada privado (sin RUT, fecha de
// nacimiento completa ni contactos: ver _PRIV_LC en sincronizacion.js). Su
// formato es el interno del livecast y puede cambiar.

function _daId() {
  try { return fbDocId() || null; } catch (e) { return null; }
}

function _daUrl(id) {
  return 'https://firestore.googleapis.com/v1/projects/' + FB_CFG.projectId + '/databases/(default)/documents/livecast_sync/'
    + encodeURIComponent(id) + '?key=' + FB_CFG.apiKey;
}

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

function renderDatosAbiertos() {
  const tit = '<h2 class="os" style="font-size:22px;letter-spacing:1px;margin-bottom:8px">DATOS ABIERTOS</h2>';
  const id = _daId();
  if (!id) return '<div class="fade">' + tit + '<div class="card">Elige un campeonato para ver su enlace.</div></div>';
  const url = _daUrl(id);
  const btn = 'padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-family:Oswald;font-size:12px;letter-spacing:.5px;cursor:pointer;text-decoration:none';
  let h = '<div class="fade" style="max-width:920px">' + tit;
  h += '<p style="font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 12px;max-width:72ch">El enlace de solo lectura a los datos en vivo de este campeonato, para apps de entrenadores, estadísticas o pantallas propias. Son los mismos datos que usa esta página y se actualizan con cada intento.</p>';
  h += '<div class="card">';
  h += '<code id="daUrl" style="display:block;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;padding:12px 14px;border-radius:8px;background:var(--card2);border:1px solid var(--border);color:var(--text);word-break:break-all">' + esc(url) + '</code>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
    + '<button onclick="_daCopiar(\'daUrl\')" style="' + btn + '"><i class=yl-i-copiar></i> Copiar</button>'
    + '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="' + btn + '"><i class=yl-i-enlace></i> Abrir</a></div>';
  h += '</div></div>';
  return h;
}

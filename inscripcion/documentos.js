// inscripcion.html — los documentos que pide cada campeonato y la subida de archivos.
//
// Parte del código de inscripcion.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

 // exponer para admin.html

// Los documentos PROPIOS de un campeonato, cargados desde el panel.
//
// El catálogo de arriba es fijo: carnet, pasaporte, WADA, los consentimientos.
// Pero cada organización pide lo suyo —Olimpiadas Especiales tiene sus propios
// antecedentes— y no puede depender de que alguien toque el código cada vez.
// Desde Admin → Campeonatos se agregan con su nombre, su descripción, el PDF que
// el atleta tiene que descargar y, si hace falta, un link a otra página.
//
// Se les arma la misma forma que a los fijos para que TODO lo de abajo —dibujar
// la casilla, guardar el archivo, exigirlo antes de enviar— siga siendo un solo
// camino. Un documento propio no es un caso especial: es una entrada más del
// catálogo, con la clave prefijada para no chocar nunca con las fijas.
function _montaDocPropio(out, d){
  const k = String(d && d.key || '').trim();
  if (!k) return;
  out['x_' + k] = {
    label: d.label || 'Documento',
    icon: d.icon || '<i class=yl-i-adjunto></i>',
    desc: d.desc || 'Sube el documento',
    accept: d.accept || 'image/*,.pdf',
    stateKey: 'xf_' + k, nameKey: 'xn_' + k, urlKey: 'xu_' + k,
    storagePath: 'x_' + k,
    plantillaUrl: d.plantillaUrl || '',
    linkUrl: d.linkUrl || '', linkTexto: d.linkTexto || '',
    propio: true,
    oe: !!d.oe
  };
}

function docsDelEvento(evObj, modalidad){
  const extra = (evObj && Array.isArray(evObj.docsExtra)) ? evObj.docsExtra : [];
  const out = Object.assign({}, DOC_TYPES);
  extra.forEach(d => _montaDocPropio(out, d));
  if (esModalidadOE(_modalidadActual(modalidad))) DOCS_OE_DEF.forEach(d => _montaDocPropio(out, d));
  return out;
}

// Los documentos que este atleta tiene que subir de verdad.
//
// El evento pide una lista fija, pero el consentimiento del tutor solo aplica a
// quien todavía no cumple 18. Sin este filtro se le exigía a todo el mundo: un
// adulto no podía enviar su inscripción porque le faltaba un papel que no le
// corresponde.
// Se calcula en UN solo lugar y lo usan el formulario, el resumen, el botón de
// enviar y la validación final — si se separaran, volvería a pasar lo mismo.
// Un documento puede estar limitado a ciertas modalidades o divisiones.
//
// No todo el campeonato compite en lo mismo. Olimpiadas Especiales pide sus
// antecedentes solo a los suyos, y pedírselos a todos los que se inscriben en
// las otras modalidades del mismo campeonato es papeleo que no corresponde.
//
// La condición vive en evObj.docsCond[docKey] = {mods:[…], divs:[…]}. Una lista
// vacía o ausente significa "a todos": es el caso normal y no hay que declararlo.
function _docAplica(evObj, docKey, modalidad, division) {
  const c = evObj && evObj.docsCond && evObj.docsCond[docKey];
  if (!c) return true;
  const mods = _limpiaLista(c.mods), divs = _limpiaLista(c.divs);
  if (mods.length && mods.indexOf(String(modalidad || '').trim()) < 0) return false;
  if (divs.length && divs.indexOf(String(division || '').trim()) < 0) return false;
  return true;
}

// Los papeles de Olimpiadas Especiales para el camino ANTIGUO del paso de
// documentos, el que tiene el carnet y el WADA escritos a mano. El camino nuevo
// los recibe en su lista —docsRequeridos ya se los suma— y no pasa por acá.
function _oeDocsAparte(evObj){
  if (!esModalidadOE(_modalidadActual())) return [];
  const cat = docsDelEvento(evObj);
  const tmpl = (evObj && evObj.docTemplates) || {};
  return DOCS_OE_KEYS.filter(k => _oePide(evObj, k)).map(k => ({ key:k, meta:cat[k], tmpl:tmpl[k] })).filter(x => x.meta);
}

function _oeBloqueHtml(evObj){
  const docs = _oeDocsAparte(evObj);
  if (!docs.length) return '';
  return `<div style="background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.4);border-radius:10px;padding:14px 16px;margin:20px 0 12px">
      <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:4px">Olimpiadas Especiales</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5">Estos antecedentes los exige Olimpiadas Especiales a todos sus atletas. Van además de los documentos que pide el campeonato.</div>
    </div>` + docs.map(d => _docCampoHtml(d.key, d.meta, d.tmpl)).join('');
}

function _oeFaltan(evObj){
  return _oeDocsAparte(evObj).filter(d => !state[d.meta.nameKey]).map(d => d.meta.label);
}

// La tarjeta de UN documento: el recuadro azul con el formulario para descargar
// o el link a otra página, y debajo la zona para subir el archivo.
//
// La dibujan los dos caminos del paso de documentos —el del campeonato que trae
// su lista configurada y el antiguo, que tiene el carnet y el WADA escritos a
// mano— porque los papeles de Olimpiadas Especiales salen en los dos. Con el
// molde repetido, una de las dos quedaba sin el botón de descargar o sin el link.
function _docCampoHtml(docKey, meta, plantillaEvento){
  if (!meta) return '';
  const stName = state[meta.nameKey] || '';
  let h = '';
  const dlUrl = plantillaEvento || meta.plantillaUrl || meta.defaultPdfUrl || null;
    h += `<div class="field">`;
    // El formulario para descargar y el link a otra página van en UNA sola
    // tarjeta, con el nombre del documento arriba. Separados, el link quedaba
    // suelto y no se entendía a cuál de los documentos correspondía.
    if (dlUrl || meta.linkUrl) {
      h += `<div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.4);border-radius:10px;padding:14px 16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:#60a5fa;margin-bottom:4px">${meta.icon} ${meta.label}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">${meta.desc}${dlUrl?'. Descarga el formulario, complétalo y sube el documento firmado':''}.</div>
        ${meta.linkUrl?`<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-top:6px">${meta.linkTexto||'Este documento se obtiene en otra página.'}</div>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          ${dlUrl?`<a href="${dlUrl}" download style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.5);border-radius:6px;color:#60a5fa;font-size:12px;font-weight:600;text-decoration:none;font-family:Oswald,sans-serif;letter-spacing:1px"><i class=yl-i-bajar></i> DESCARGAR FORMULARIO</a>`:''}
          ${meta.linkUrl?`<a href="${meta.linkUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(212,168,67,.15);border:1px solid rgba(212,168,67,.5);border-radius:6px;color:var(--gold);font-size:12px;font-weight:600;text-decoration:none;font-family:Oswald,sans-serif;letter-spacing:1px">\u2197 IR A LA PÁGINA</a>`:''}
        </div>
      </div>`;
    }
    h += `<label>${meta.icon} ${meta.label} <span class="req">*</span></label>
    <div class="upload-zone ${stName?'done':''}" id="zone_${docKey}">
      <input type="file" accept="${meta.accept}" onchange="handleFile(this,'${meta.storagePath}')">
      ${stName
        ? `<div class="icon"><i class=yl-i-check></i></div><div class="fname">${stName}</div><div class="txt">Click para cambiar</div>`
        : `<div class="icon">${meta.icon}</div><div class="txt">${meta.desc}</div><div style="font-size:10px;color:var(--muted);margin-top:4px">Máx 10MB</div>`}
    </div>
    ${docKey==='menorConsent' ? _declaraMayorHtml() : ''}
    </div>`;
  return h;
}

function docsRequeridos(evObj, fechaNac, modalidad, division) {
  const lista = (evObj && Array.isArray(evObj.requiredDocs)) ? evObj.requiredDocs : [];
  // Sin modalidad explícita se usa la que está eligiendo el formulario. Así las
  // cuatro llamadas —el formulario, el resumen, el botón de enviar y la
  // validación final— ven siempre lo mismo sin tener que pasarla cada una.
  let mod = _modalidadActual(modalidad), div = division;
  if (div === undefined) { try { div = state.form.division; } catch (e) { div = ''; } }
  let porModalidad = lista.filter(k => _docAplica(evObj, k, mod, div));
  // Los de Olimpiadas Especiales se suman SIEMPRE, y sin repetir si el
  // campeonato además los tenía marcados a mano.
  if (esModalidadOE(mod)) {
    porModalidad = porModalidad.concat(DOCS_OE_KEYS.filter(k => porModalidad.indexOf(k) < 0 && _oePide(evObj, k)));
  }
  if (requiereConsentimientoMenor(fechaNac)) return porModalidad;
  return porModalidad.filter(k => k !== 'menorConsent');
}

function handleFile(input, type) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { state.error = 'Archivo demasiado grande (máx 10MB)'; render(); return; }
  state.error = '';
  // Genérico: ubica el documento por su storagePath en el catálogo (sirve para
  // wada, carnetBack y cualquier doc nuevo, sin tener que agregar un caso a mano).
  const _ev = EVENTS.find(e=>e.id===state.form.evento);
  const meta = Object.values(docsDelEvento(_ev)).find(m => m.storagePath === type);
  if (meta) { state[meta.stateKey] = file; state[meta.nameKey] = file.name; }
  // Compatibilidad con llamadas legacy (nombres viejos del sistema anterior).
  else if (type === 'carnet') { state.carnetFile = file; state.carnetName = file.name; }
  else if (type === 'wade' || type === 'wada') { state.wadeFile = file; state.wadeName = file.name; }
  else if (type === 'carnetPhoto') { state.carnetPhotoFile = file; state.carnetPhotoName = file.name; }
  else if (type === 'consentimiento') { state.consentimientoFile = file; state.consentimientoName = file.name; }
  else if (type === 'ipfConsent') { state.ipfConsentFile = file; state.ipfConsentName = file.name; }
  else if (type === 'passport') { state.passportFile = file; state.passportName = file.name; }
  else if (type === 'notas') { state.notasFile = file; state.notasName = file.name; }
  render();
}

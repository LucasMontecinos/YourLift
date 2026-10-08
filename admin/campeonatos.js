// admin.html — Campeonatos: crear y editar, y las actas de competencias pasadas.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

// Un campeonato es "pasado" si está archivado o si su fecha ya quedó atrás.
function cpEsPasado(e){
  if(!e)return false;
  if(e.status==='archived')return true;
  const f=String(e.date||e.fecha||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f))return false;
  return f < new Date().toISOString().slice(0,10);
}

function cpPasados(){
  return (ST.eventos||[]).filter(cpEsPasado)
    .slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}

function cpFicha(id){ return (ST.pasadas||{})[id]||null; }

function cpFecha(f){
  const m=String(f||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m)return f||'—';
  const M=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return (+m[3])+' de '+M[(+m[2])-1]+' de '+m[1];
}

function cpPeso(b){
  const n=+b||0;
  return n<1024*1024 ? Math.max(1,Math.round(n/1024))+' KB' : (n/1024/1024).toFixed(1)+' MB';
}

function renderCampeonatos(){
  const evs = ST.eventos;
  const editing = ST.eventoForm;
  // Al cerrar el formulario se suelta la lista de documentos propios: si no,
  // volver a abrir el MISMO campeonato mostraba lo que se había tecleado y
  // cancelado, en vez de lo que está guardado.
  if(!editing) ST._efDocsXPara = null;

  if(editing){
    const isNew = ST.eventoFormMode === 'create';
    const inscCount = ST.inscripciones.filter(i=>i.evento===editing.id).length;
    // Los documentos propios se editan en una lista viva, no en el HTML: se
    // copian del campeonato al abrir y se pintan cuando el formulario ya está
    // en pantalla. Se copian —no se apunta al mismo arreglo— para que cancelar
    // no deje tocado lo que está guardado.
    if(ST._efDocsXPara !== (editing.id||'__nuevo__')){
      ST._efDocsXPara = editing.id||'__nuevo__';
      window._efDocsX = (Array.isArray(editing.docsExtra)?editing.docsExtra:[]).map(d=>Object.assign({},d));
      // Y a quién se le pide cada documento, por la misma razón: copiado, no apuntado.
      window._efDocsCond = {};
      // Qué papeles de Olimpiadas Especiales pide este campeonato.
      window._efOeDocs = Object.assign({}, editing.oeDocs||{});
      Object.entries(editing.docsCond||{}).forEach(([k,c])=>{
        window._efDocsCond[k] = {mods:(c&&c.mods||[]).slice(), divs:(c&&c.divs||[]).slice()};
      });
    }
    setTimeout(()=>{ try{efDocPinta('x')}catch(e){} try{window.renderDocsChecklist()}catch(e){} },0);
    return `
    <div class="h1">${isNew?'Nuevo Campeonato':'Editar Campeonato'}</div>
    <p class="subtitle">${isNew?'Se publicará inmediatamente en inscripciones y nómina':'Cambios se propagan en tiempo real a todos los archivos'}</p>
    <div class="card" style="max-width:680px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <label class="field" style="grid-column:span 2">
          <span>Nombre del campeonato</span>
          <input class="inp" id="ef_name" value="${editing.name||''}" placeholder="ej: Campeonato Regional Centro 2027">
        </label>
        <label class="field">
          <span>ID (slug único, sin espacios)</span>
          <input class="inp" id="ef_id" value="${editing.id||''}" placeholder="ej: regional_centro_2027" ${!isNew?'disabled style="opacity:.5"':''}>
          ${!isNew?'<span style="font-size:10px;color:var(--muted)">El ID no se puede cambiar</span>':''}
        </label>
        <label class="field">
          <span>Estado</span>
          <select class="inp" id="ef_status">
            ${['open','closed','draft','archived'].map(s=>`<option value="${s}" ${(editing.status||'open')===s?'selected':''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Fecha de competencia</span>
          <input class="inp" type="date" id="ef_date" value="${editing.date||''}" onchange="refrescarBloqueo()">
        </label>
        <label class="field">
          <span>Cierre PRE-NÓMINA (inscripciones)</span>
          <input class="inp" type="datetime-local" id="ef_preNominaCloseAt" value="${editing.preNominaCloseAt||''}" title="Fecha y hora límite para inscribirse al evento">
          <span style="font-size:10px;color:var(--muted);margin-top:2px">Después de esta fecha NO se aceptan nuevas inscripciones</span>
        </label>
        <label class="field">
          <span>Cierre NÓMINA (cambios)</span>
          <input class="inp" type="datetime-local" id="ef_nominaCloseAt" value="${editing.nominaCloseAt||editing.closeDate||''}" title="Fecha y hora límite para cambios de categoría o bajas">
          <span style="font-size:10px;color:var(--muted);margin-top:2px">Después: no se permiten cambios de cat ni bajas</span>
        </label>
        <label class="field">
          <span>Ubicación</span>
          <input class="inp" id="ef_location" value="${editing.location||''}" placeholder="ej: Santiago, RM">
        </label>
        <label class="field" style="grid-column:span 2">
          <span>Logo del campeonato <span style="font-weight:400;color:var(--muted)">(opcional · se sube una imagen)</span></span>
          <div style="display:flex;align-items:center;gap:12px;margin-top:4px;flex-wrap:wrap">
            <div style="width:64px;height:64px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
              <img id="ef_logoPreview" src="${editing.logoUrl||''}" style="max-width:100%;max-height:100%;object-fit:contain;${editing.logoUrl?'':'display:none'}" onerror="this.style.display='none'">
            </div>
            <input type="hidden" id="ef_logoUrl" value="${editing.logoUrl||''}">
            <input type="file" id="ef_logoFile" accept="image/*" style="display:none" onchange="uploadEventLogo(this.files[0])">
            <button type="button" class="btn" onclick="document.getElementById('ef_logoFile').click()" style="background:rgba(59,130,246,.15);border:1px solid #3b82f6;color:#3b82f6">Subir logo</button>
            <button type="button" class="btn" onclick="document.getElementById('ef_logoUrl').value='';var p=document.getElementById('ef_logoPreview');p.src='';p.style.display='none'" style="background:transparent;border:1px solid var(--border);color:var(--muted)">Quitar</button>
            <span id="ef_logoStatus" style="font-size:11px;color:var(--muted)"></span>
          </div>
        </label>
        <!-- El de la federación va aparte del campeonato porque cambia según quién
             organiza: FESUPO en el Sudamericano, FECHIPO en los nacionales. En las
             pantallas de transmisión se muestran juntos. -->
        <label class="field" style="grid-column:span 2">
          <span>Logo de la federación <span style="font-weight:400;color:var(--muted)">(opcional · FESUPO, FECHIPO… sale en el scoreboard, la tabla y el perfil)</span></span>
          <div style="display:flex;align-items:center;gap:12px;margin-top:4px;flex-wrap:wrap">
            <div style="width:64px;height:64px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
              <img id="ef_logoFedPreview" src="${editing.logoFedUrl||''}" style="max-width:100%;max-height:100%;object-fit:contain;${editing.logoFedUrl?'':'display:none'}" onerror="this.style.display='none'">
            </div>
            <input type="hidden" id="ef_logoFedUrl" value="${editing.logoFedUrl||''}">
            <input type="file" id="ef_logoFedFile" accept="image/*" style="display:none" onchange="uploadEventLogo(this.files[0],'fed')">
            <button type="button" class="btn" onclick="document.getElementById('ef_logoFedFile').click()" style="background:rgba(59,130,246,.15);border:1px solid #3b82f6;color:#3b82f6">Subir logo</button>
            <button type="button" class="btn" onclick="document.getElementById('ef_logoFedUrl').value='';var p=document.getElementById('ef_logoFedPreview');p.src='';p.style.display='none'" style="background:transparent;border:1px solid var(--border);color:var(--muted)">Quitar</button>
            <span id="ef_logoFedStatus" style="font-size:11px;color:var(--muted)"></span>
          </div>
        </label>
        <label class="field" style="grid-column:span 2">
          <span>Organizadores <span style="font-weight:400;color:var(--muted)">(puedes agregar más de uno · cada uno con su Instagram opcional)</span></span>
          <div id="ef_organizers" style="display:flex;flex-direction:column;gap:6px;margin-top:4px">${(()=>{
            let orgs = (Array.isArray(editing.organizers)&&editing.organizers.length)
              ? editing.organizers
              : [{name:(editing.org||editing.organizer||''), instagram:(editing.instagram||'')}];
            return orgs.map(o=>orgRowHtml(o.name,o.instagram)).join('');
          })()}</div>
          <button type="button" class="btn" onclick="addOrganizerRow()" style="background:transparent;border:1px dashed var(--border);color:var(--muted);margin-top:6px;align-self:flex-start">+ Agregar organizador</button>
        </label>
        <label class="field">
          <span>Días (texto visible)</span>
          <input class="inp" id="ef_days" value="${editing.days||''}" placeholder="ej: 09 y 10 de Mayo">
        </label>
        <label class="field">
          <span>Columna extra en nómina</span>
          <select class="inp" id="ef_extra">
            <option value="modalidad" ${!(editing.extraCols||[]).includes('universidad')?'selected':''}>Modalidad</option>
            <option value="universidad" ${(editing.extraCols||[]).includes('universidad')?'selected':''}>Universidad</option>
          </select>
        </label>
        <label class="field" style="grid-column:span 2;display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px 12px;background:rgba(212,168,67,.05);border:1px solid rgba(212,168,67,.3);border-radius:8px">
          <input type="checkbox" id="ef_recordsEnabled" ${(editing.recordsEnabled!==false)?'checked':''} style="width:18px;height:18px;cursor:pointer">
          <div>
            <div style="font-weight:600;color:var(--text)">Detectar récords nacionales</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Si está activo, en cada good lift se compara contra <code>records.json</code> y se muestra alerta + badge giratorio en OBS. <b>Desactiva para Universitario u otros torneos sin récords oficiales.</b></div>
          </div>
        </label>
        <label class="field" style="grid-column:span 2;display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px 12px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.3);border-radius:8px">
          <input type="checkbox" id="ef_cronogramaPublic" ${(editing.cronogramaPublic!==false)?'checked':''} style="width:18px;height:18px;cursor:pointer">
          <div>
            <div style="font-weight:600;color:var(--text)">Mostrar en cronograma público</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Si está activo, el evento aparece en <code>cronograma.html</code>. <b>Desactiva para ocultarlo (ej. mientras armás los vuelos del Debutantes).</b></div>
          </div>
        </label>
        <label class="field" style="grid-column:span 2;display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px 12px;background:rgba(168,85,247,.06);border:1px solid rgba(168,85,247,.3);border-radius:8px">
          <input type="checkbox" id="ef_requiereFoto" ${(editing.requiereFoto===true)?'checked':''} style="width:18px;height:18px;cursor:pointer">
          <div>
            <div style="font-weight:600;color:var(--text)">Requerir foto tipo carnet en inscripción</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Si está activo, el atleta debe subir una foto de rostro al inscribirse. Esa foto luego se procesa con fondo blanco IPF en <b>Fotos Atletas</b> para usarla en perfiles y transmisión.</div>
          </div>
        </label>
        <label class="field" style="grid-column:span 2;display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px 12px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.3);border-radius:8px">
          <input type="checkbox" id="ef_livecastVisible" ${(editing.livecastVisible!==false)?'checked':''} style="width:18px;height:18px;cursor:pointer">
          <div>
            <div style="font-weight:600;color:var(--text)">Visible en YourLift</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Si está activo, el campeonato aparece en el selector de eventos de <b>livecast.html</b>. <b>Desactiva para ocultarlo de YourLift</b> (ej. campeonatos ya terminados que no quieres mostrar).</div>
          </div>
        </label>
        <label class="field" style="grid-column:span 2;display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px 12px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.3);border-radius:8px">
          <input type="checkbox" id="ef_posNac2026" ${(editing.posNac2026===true)?'checked':''} style="width:18px;height:18px;cursor:pointer">
          <div>
            <div style="font-weight:600;color:var(--text)">Pedir posición en el Nacional 2026 (clasificación Sudamericano)</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Si está activo, al inscribirse el atleta indica su <b>modalidad</b> (Classic/Equipado/OE/Universitario) y <b>lugar</b> (1° a 5°) obtenido en el Nacional 2026. Útil para el proceso del Sudamericano.</div>
          </div>
        </label>
        <!-- Sección NUEVA: Documentos requeridos en inscripción ──────────────────── -->
        <div class="field" style="grid-column:span 2">
          <div style="background:rgba(212,168,67,.06);border:1px solid rgba(212,168,67,.35);border-radius:10px;padding:14px 16px">
            <div style="font-weight:600;color:var(--gold);margin-bottom:6px">Documentos requeridos en inscripción</div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.5">
              Marca qué documentos pedir al atleta cuando se inscriba. Cada uno se le pide a todos, pero
              puedes <b>limitarlo a ciertas modalidades o divisiones</b>: así los antecedentes de una
              organización se le piden solo a los suyos y no a todo el campeonato.
              Si dejas todo desmarcado, se usa la <b>lógica vieja</b> (carnet + WADA por default, IPF World detección por nombre, consentimiento menor si fechaNac &lt; 18, foto si "requiere foto" está activo arriba).
            </div>
            <!-- Lo dibuja renderDocsChecklist(). Antes esta misma lista se armaba
                 también acá, y como el hook de render vuelve a pintar el
                 contenedor con SOLO el catálogo fijo, los documentos propios del
                 campeonato desaparecían de la lista apenas se redibujaba la
                 pantalla. Un solo lugar que la dibuje. -->
            <div id="ef_docs_container" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
            <div style="border-top:1px solid rgba(212,168,67,.25);margin-top:14px;padding-top:12px">
              <div style="font-weight:600;color:var(--gold);margin-bottom:4px">Documentos propios de este campeonato</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5">
                Para lo que pide cada organización y no está en la lista de arriba. Le pones nombre, el
                PDF que el atleta tiene que descargar y, si el documento se saca en otra página, el link.
                Al guardar aparecen arriba para marcarlos, y salen en el formulario de inscripción con
                su espacio para subir.
              </div>
              <div id="ef_docsx"></div>
              <button type="button" class="btn" onclick="efDocAgregar('x')" style="margin-top:8px;padding:6px 14px;font-size:12px">+ Agregar documento</button>
            </div>
            <div style="border-top:1px solid rgba(212,168,67,.25);margin-top:14px;padding-top:12px">
              <div style="font-weight:600;color:var(--gold);margin-bottom:4px">Modalidades y divisiones propias</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5">
                Una por línea. Si dejas esto vacío se usan las de siempre. Marcando
                <b>solo estas</b> reemplazan a la lista completa en vez de sumarse — es lo que
                conviene en un campeonato que corre con sus propias líneas.
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div>
                  <div style="font-size:11px;color:var(--muted);margin-bottom:3px">Modalidades</div>
                  <textarea id="ef_modsx" rows="4" placeholder="Juegos Especiales&#10;Otra modalidad"
                    style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:6px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px;font-family:inherit">${(editing.modsExtra||[]).join('\n')}</textarea>
                  <label style="display:flex;align-items:center;justify-content:flex-start;gap:8px;font-size:12px;color:var(--text);margin-top:6px;cursor:pointer;text-transform:none;letter-spacing:0">
                    <input type="checkbox" id="ef_modsSolo" ${editing.modsSolo?'checked':''} style="width:16px;height:16px;flex:none;margin:0"> Usar solo estas modalidades (ocultar las de siempre)
                  </label>
                </div>
                <div>
                  <div style="font-size:11px;color:var(--muted);margin-bottom:3px">Divisiones</div>
                  <textarea id="ef_divsx" rows="4" placeholder="Nivel 1&#10;Nivel 2"
                    style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:6px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px;font-family:inherit">${(editing.divsExtra||[]).join('\n')}</textarea>
                  <label style="display:flex;align-items:center;justify-content:flex-start;gap:8px;font-size:12px;color:var(--text);margin-top:6px;cursor:pointer;text-transform:none;letter-spacing:0">
                    <input type="checkbox" id="ef_divsSolo" ${editing.divsSolo?'checked':''} style="width:16px;height:16px;flex:none;margin:0"> Usar solo estas divisiones (ocultar las de siempre)
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- ──────────────────────────────────────────────────────────────────────── -->
        <label class="field" style="grid-column:span 2">
          <span><i class=yl-i-reproducir></i> URL YouTube en vivo <span style="font-weight:400;color:var(--muted)">(opcional)</span></span>
          <input class="inp" id="ef_youtubeUrl" value="${editing.youtubeUrl||''}" data-orig="${editing.youtubeUrl||''}" onchange="efYtCambio(this)" placeholder="ej: https://www.youtube.com/live/abc123xyz">
          <span style="font-size:10px;color:var(--muted);margin-top:2px">Cuando hay URL, se muestra un reproductor embebido en el livecast público y en la página principal — las visitas desde YourLift se suman al contador de YouTube.</span>
        </label>
        <!-- Transmisiones de cada día. En un campeonato de varios días el link de
             arriba se cambia cada mañana; sin esto, el del día anterior se perdía y
             en "Transmisiones pasadas" quedaba solo el último. -->
        <div style="grid-column:span 2;border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:rgba(10,22,40,.35)">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-family:Oswald;font-size:12px;letter-spacing:1px;color:var(--gold)">TRANSMISIONES DE CADA DÍA</span>
            <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)">Fecha del link de arriba
              <input type="date" id="ef_youtubeDesde" value="${editing.youtubeDesde||''}" style="padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px"></label>
          </div>
          <div id="ef_ytDias">${(editing.youtubeDias||[]).map(efYtFila).join('')}</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px">
            <button type="button" class="btn" onclick="efYtAgregar()">+ Agregar día</button>
            <span style="font-size:10px;color:var(--muted);line-height:1.5;flex:1;min-width:220px">Cada día queda como una tarjeta en yourlift.cl → Transmisiones pasadas. Al cambiar el link de arriba, el anterior baja solo a esta lista con su fecha: revísala antes de guardar. Los días cuyo link ya se reemplazó se agregan a mano con + Agregar día.</span>
          </div>
        </div>
        <div style="grid-column:span 2;border-top:1px solid var(--border);padding-top:12px;margin-top:2px">
          <div style="font-family:Oswald;font-size:12px;letter-spacing:1px;color:var(--gold);margin-bottom:8px">EXTRAS DE TRANSMISIÓN <span style="font-weight:400;color:var(--muted);letter-spacing:0">(se muestran en la tarjeta de Transmisiones del sitio)</span></div>
          <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">
            <div>
              <span style="font-size:11px;color:var(--muted)">Logo en la transmisión (productora)</span>
              <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                <div style="width:64px;height:64px;border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;background:#0a1628;overflow:hidden">
                  <img id="ef_streamLogoPreview" src="${editing.streamLogoUrl||''}" style="max-width:100%;max-height:100%;object-fit:contain;${editing.streamLogoUrl?'':'display:none'}" onerror="this.style.display='none'">
                </div>
                <input type="hidden" id="ef_streamLogoUrl" value="${editing.streamLogoUrl||''}">
                <input type="file" id="ef_streamLogoFile" accept="image/*" style="display:none" onchange="uploadStreamLogo(this.files[0])">
                <div style="display:flex;flex-direction:column;gap:4px">
                  <button type="button" class="btn" onclick="document.getElementById('ef_streamLogoFile').click()">Subir logo</button>
                  <button type="button" class="btn" onclick="document.getElementById('ef_streamLogoUrl').value='';var p=document.getElementById('ef_streamLogoPreview');p.src='';p.style.display='none'" style="background:transparent;border:1px solid var(--border);color:var(--muted)">Quitar</button>
                  <span id="ef_streamLogoStatus" style="font-size:10px;color:var(--muted)"></span>
                </div>
              </div>
            </div>
            <label class="field" style="flex:1;min-width:200px">
              <span>Instagram de la transmisión</span>
              <input class="inp" id="ef_streamIg" value="${editing.streamInstagram||''}" placeholder="@productora">
            </label>
          </div>
        </div>
      </div>
      ${_bloqueoFormHtml(editing)}
      ${!isNew?`<div style="margin-top:14px;padding:10px 14px;background:rgba(29,49,80,.3);border-radius:8px;font-size:12px;color:var(--muted)">
        <span style="color:var(--text)">Estado actual:</span>
        ${inscCount} inscripciones · ${ST.inscripciones.filter(i=>i.evento===editing.id&&i.status==='approved').length} aprobadas
      </div>`:''}
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
        <button class="btn btn-g" onclick="saveEvento()">${isNew?'Crear campeonato':'Guardar cambios'}</button>
        <button class="btn" style="background:transparent;border:1px solid var(--border);color:var(--muted)" onclick="ST.eventoForm=null;render()">Cancelar</button>
        ${!isNew&&editing.status!=='closed'?`<button class="btn btn-r" onclick="closeNomina('${editing.id}')" style="margin-left:auto">Cerrar nómina ahora</button>`:''}
        ${!isNew&&editing.status!=='archived'?`<button class="btn" style="background:transparent;border:1px solid var(--muted);color:var(--muted);margin-left:${editing.status==='closed'?'auto':'0'}" onclick="archiveEvento('${editing.id}')">Archivar</button>`:''}
      </div>
    </div>`;
  }

  const archivedWithInsc = (ST.eventos||[]).filter(e=>e.status==='archived'&&ST.inscripciones.some(i=>i.evento===e.id));
  const purgableCount = ST.inscripciones.filter(i=>{const ev=(ST.eventos||[]).find(e=>e.id===i.evento);return ev&&ev.status==='archived';}).length;
  return `
  <div class="h1">Campeonatos</div>
  <p class="subtitle">Gestiona los campeonatos — los cambios se propagan en tiempo real a inscripciones, nómina y cronograma</p>
  <div style="display:flex;justify-content:flex-end;margin-bottom:16px;gap:10px;flex-wrap:wrap">
    ${purgableCount>0?`<button class="btn" onclick="purgarInscripcionesArchivadas()" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);color:var(--red);font-size:11px" title="Libera espacio en Firestore eliminando inscripciones de campeonatos ya archivados. Los resultados permanecen en el perfil de cada atleta.">Purgar inscripciones archivadas (${purgableCount})</button>`:''}
    <button class="btn btn-g" onclick="newEvento()">+ Nuevo campeonato</button>
  </div>
  <div style="display:grid;gap:12px">
    ${!evs.length?'<div class="card" style="text-align:center;padding:40px;color:var(--muted)">No hay campeonatos. Crea el primero.</div>':''}
    ${evs.map(ev=>{
      const insc = ST.inscripciones.filter(i=>i.evento===ev.id);
      const approved = insc.filter(i=>i.status==='approved').length;
      const pending  = insc.filter(i=>i.status==='pending').length;
      const today = new Date().toISOString().slice(0,10);
      const autoClose = ev.closeDate && ev.closeDate < today && ev.status==='open';
      return `<div class="card" style="border-left:4px solid ${STATUS_COLORS[ev.status]||'var(--border)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
          <div style="flex:1;min-width:200px">
            <div style="font-family:Oswald;font-size:16px;font-weight:700">${ev.name}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${ev.location||'—'} · ${ev.days||ev.date||'—'} · ${ev.org||'—'}</div>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
              <span style="font-size:11px;font-weight:700;color:${STATUS_COLORS[ev.status]||'var(--muted)'}">${STATUS_LABELS[ev.status]||ev.status}</span>
              ${autoClose?'<span style="font-size:10px;background:rgba(239,68,68,.15);color:var(--red);padding:2px 8px;border-radius:4px">Nómina vencida — cierra automáticamente</span>':''}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <div style="text-align:center;min-width:44px">
              <div style="font-family:Oswald;font-size:20px;font-weight:700;color:var(--green)">${approved}</div>
              <div style="font-size:9px;color:var(--muted)">Aprobados</div>
            </div>
            <div style="text-align:center;min-width:44px">
              <div style="font-family:Oswald;font-size:20px;font-weight:700;color:var(--gold)">${pending}</div>
              <div style="font-size:9px;color:var(--muted)">Pendientes</div>
            </div>
            <div style="text-align:center;min-width:44px">
              <div style="font-family:Oswald;font-size:20px;font-weight:700">${insc.length}</div>
              <div style="font-size:9px;color:var(--muted)">Total</div>
            </div>
            <button class="btn btn-b" onclick="editEvento('${ev.id}')" style="padding:6px 14px;font-size:11px">Editar</button>
            ${ev.status==='open'?`<button class="btn btn-r" onclick="closeNomina('${ev.id}')" style="padding:6px 14px;font-size:11px">Cerrar nómina</button>`:''}
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center">
          <a href="inscripcion.html" target="_blank" style="font-size:10px;color:var(--blue);text-decoration:none;padding:3px 8px;border:1px solid rgba(59,130,246,.3);border-radius:4px">Formulario público</a>
          <a href="cronograma.html?evento=${encodeURIComponent(ev.id)}" target="_blank" style="font-size:10px;color:var(--muted);text-decoration:none;padding:3px 8px;border:1px solid var(--border);border-radius:4px">Cronograma</a>
          ${(()=>{
            // Atajo, no configuración: el formulario del entrenador se arma en su
            // propia pestaña. Acá solo se dice si este campeonato ya tiene uno y
            // se salta para allá con el campeonato puesto.
            const fe=(ST.formEnt||[]).find(f=>f.tipo!=='acreditacion'&&f.evento===ev.id);
            return fe
              ? `<button onclick="feEditar('${esc(fe.id)}');go('formEnt')" style="font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid ${fe.abierto?'rgba(34,197,94,.4)':'var(--border)'};background:transparent;color:${fe.abierto?'var(--green)':'var(--muted)'};cursor:pointer;font-family:inherit">Entrenadores: ${fe.abierto?'abierto':'cerrado'}</button>`
              : `<button onclick="feNuevoPara('${ev.id}')" style="font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid rgba(30,91,168,.45);background:transparent;color:#8ab4e8;cursor:pointer;font-family:inherit">+ Inscripción de entrenadores</button>`;
          })()}
          <a href="livecast.html?evento=${encodeURIComponent(ev.id)}" target="_blank" style="font-size:10px;color:var(--muted);text-decoration:none;padding:3px 8px;border:1px solid var(--border);border-radius:4px">YourLift (operador)</a>
          <button onclick="copyPublicLink('${ev.id}',this)" style="font-size:10px;color:var(--gold);background:transparent;text-decoration:none;padding:3px 8px;border:1px solid rgba(212,168,67,.4);border-radius:4px;cursor:pointer;font-family:inherit">Link público en vivo</button>
          <button onclick="toggleLivecastVisible('${ev.id}',${ev.livecastVisible!==false})" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid ${ev.livecastVisible!==false?'rgba(34,197,94,.4)':'rgba(239,68,68,.4)'};background:${ev.livecastVisible!==false?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)'};color:${ev.livecastVisible!==false?'var(--green)':'var(--red)'};cursor:pointer;font-family:inherit;font-weight:700" title="Visible en el selector de eventos de YourLift">${ev.livecastVisible!==false?'YourLift: ON':'YourLift: OFF'}</button>
          <button onclick="purgarDocsNomina('${ev.id}','${escapeHtml(ev.name).replace(/'/g,"\\'")}',this)" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid rgba(168,85,247,.4);background:rgba(168,85,247,.06);color:#c084fc;cursor:pointer;font-family:inherit;font-weight:700" title="Elimina carnet, WADA, consentimientos de Storage. Deja fotos de perfil intactas.">Purgar documentos</button>
          <button onclick="deleteEvento('${ev.id}','${escapeHtml(ev.name).replace(/'/g,"\\'")}',this)" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.06);color:var(--red);cursor:pointer;font-family:inherit;font-weight:700;margin-left:auto" title="Eliminar campeonato">Eliminar</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── CRUD helpers ────────────────────────────────────────────
window.newEvento = function(){
  ST.eventoForm = {id:'',name:'',date:'',closeDate:'',preNominaCloseAt:'',nominaCloseAt:'',location:'',org:'',days:'',status:'open',extraCols:['modalidad'],recordsEnabled:true,cronogramaPublic:true,requiereFoto:false,livecastVisible:true,posNac2026:false,youtubeUrl:''};
  ST.eventoFormMode = 'create';
  render();
};

window.editEvento = function(id){
  const ev = ST.eventos.find(e=>e.id===id);
  if(!ev)return;
  ST.eventoForm = {...ev};
  ST.eventoFormMode = 'edit';
  render();
};

// Las listas que le van a salir a quien se inscriba en ESTE campeonato. Se leen
// de los cuadros de texto, no de lo guardado: si el admin acaba de escribir una
// modalidad propia, tiene que poder condicionarle un documento sin guardar antes.
function _efListasVivas(){
  const lin = id => (document.getElementById(id)?.value||'').split('\n')
    .map(s=>s.trim()).filter(Boolean);
  const mx = lin('ef_modsx'), dx = lin('ef_divsx');
  const soloM = !!document.getElementById('ef_modsSolo')?.checked;
  const soloD = !!document.getElementById('ef_divsSolo')?.checked;
  return {
    mods: mx.length ? (soloM ? mx : window.MODALIDADES_BASE.concat(mx)) : window.MODALIDADES_BASE.slice(),
    divs: dx.length ? (soloD ? dx : window.DIVISIONES_BASE.concat(dx)) : window.DIVISIONES_BASE.slice()
  };
}

window.efCondToggle = function(k, tipo, valor){
  const c = window._efDocsCond[k] || (window._efDocsCond[k] = {mods:[],divs:[]});
  const arr = c[tipo] || (c[tipo] = []);
  const i = arr.indexOf(valor);
  if(i<0) arr.push(valor); else arr.splice(i,1);
  window.renderDocsChecklist();
};

window.efCondLimpiar = function(k){ delete window._efDocsCond[k]; window.renderDocsChecklist(); };

window.efCondAbrir = function(k){
  window._efDocsCond[k] = window._efDocsCond[k] || {mods:[],divs:[]};
  window._efDocsCond[k]._abierto = true;
  window.renderDocsChecklist();
};

// Renderiza el container de checkboxes de docs cuando el form de evento está visible.
// Es el ÚNICO lugar que lo dibuja, y lleva tanto el catálogo fijo como los
// documentos propios del campeonato, que se marcan igual que los demás.
window.renderDocsChecklist = function(){
  const cont = document.getElementById('ef_docs_container');
  if(!cont || !ST.eventoForm) return;
  const current = Array.isArray(ST.eventoForm.requiredDocs) ? ST.eventoForm.requiredDocs : [];
  // Los de Olimpiadas Especiales no se marcan acá: el formulario se los pide
  // solo a quien elige esa modalidad, en cualquier campeonato. Salen abajo como
  // aviso, para que no se agreguen otra vez a mano y terminen pidiéndose doble.
  const TIPOS = Object.assign({}, window.DOC_TYPES_CATALOG);
  Object.keys(window.DOCS_OE_ATLETA||{}).forEach(k=>{ delete TIPOS[k]; });
  Object.keys(window.DOCS_OE_ENTRENADOR||{}).forEach(k=>{ delete TIPOS[k]; });
  (window._efDocsX||[]).forEach(d=>{
    if(d && d.key) TIPOS['x_'+d.key] = {label:d.label||'(documento sin nombre)', icon:'',
      desc:(d.desc||'')+' · propio de este campeonato'};
  });
  const listas = _efListasVivas();
  const chip = (k,tipo,v,on)=>`<button type="button" onclick="efCondToggle('${k}','${tipo}',${JSON.stringify(v).replace(/"/g,'&quot;')})"
    style="padding:2px 8px;border-radius:20px;font-size:10px;cursor:pointer;margin:2px 3px 0 0;
    border:1px solid ${on?'rgba(34,197,94,.6)':'var(--border)'};
    background:${on?'rgba(34,197,94,.18)':'transparent'};color:${on?'#4ade80':'var(--muted)'}">${esc(v)}</button>`;

  let h = '';
  Object.entries(TIPOS).forEach(([k, meta])=>{
    const checked = current.includes(k);
    const c = window._efDocsCond[k] || null;
    const mods = (c && c.mods) || [], divs = (c && c.divs) || [];
    const limitado = mods.length || divs.length;
    let cond = '';
    if(checked){
      if(!limitado && !(c && c._abierto)){
        cond = `<div style="margin-top:5px"><span style="font-size:10px;color:var(--muted)">Se lo piden a todos · </span>
          <a href="#" onclick="event.preventDefault();event.stopPropagation();efCondAbrir('${k}')"
             style="font-size:10px;color:var(--gold)">limitar a ciertas modalidades</a></div>`;
      }else{
        cond = `<div onclick="event.preventDefault();event.stopPropagation()" style="margin-top:6px;padding:6px 8px;border:1px dashed var(--border);border-radius:6px">
          <div style="font-size:9px;color:var(--muted);letter-spacing:1px">SOLO A ESTAS MODALIDADES</div>
          <div>${listas.mods.map(m=>chip(k,'mods',m,mods.indexOf(m)>=0)).join('')}</div>
          <div style="font-size:9px;color:var(--muted);letter-spacing:1px;margin-top:6px">Y SOLO A ESTAS DIVISIONES</div>
          <div>${listas.divs.map(d=>chip(k,'divs',d,divs.indexOf(d)>=0)).join('')}</div>
          <div style="font-size:9px;color:var(--muted);margin-top:6px;line-height:1.4">
            ${limitado?'Sin marcar nada en una fila, esa fila no filtra.':'No has marcado nada: se lo piden a todos.'}
            <a href="#" onclick="event.preventDefault();event.stopPropagation();efCondLimpiar('${k}')" style="color:var(--gold)">pedírselo a todos</a>
          </div>
        </div>`;
      }
    }
    h += `<label style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:${checked?'rgba(34,197,94,.08)':'transparent'};border:1px solid ${checked?'rgba(34,197,94,.4)':'var(--border)'};border-radius:6px;cursor:pointer;transition:all .15s">
      <input type="checkbox" data-doc-key="${k}" ${checked?'checked':''} onchange="efDocMarcado(this,'${k}')" style="width:16px;height:16px;cursor:pointer;margin-top:2px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--text)">${meta.icon} ${meta.label}${limitado?' <span style="font-size:9px;color:#4ade80;border:1px solid rgba(34,197,94,.5);border-radius:10px;padding:1px 6px;vertical-align:middle">limitado</span>':''}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">${meta.desc}</div>
        ${cond}
      </div>
    </label>`;
  });
  // El aviso va al final, y sin casilla: no hay nada que decidir acá.
  // Olimpiadas Especiales: el formulario se los pide solo a quien elige esa
  // modalidad. Cada uno se puede apagar o prender para este campeonato; la ficha
  // médica viene apagada (se pidió sacarla de las inscripciones).
  const _oePideAdm = k => { const o=window._efOeDocs||{}; if(typeof o[k]==='boolean')return o[k];
    return ((window.DOCS_OE_ATLETA||{})[k]||{}).porDefecto!==false; };
  const _oeE = Object.values(window.DOCS_OE_ENTRENADOR||{}).map(m=>m.label);
  const _oeKeys = Object.keys(window.DOCS_OE_ATLETA||{});
  if(_oeKeys.length){
    h += `<div style="padding:10px 12px;border:1px dashed rgba(212,168,67,.5);border-radius:6px;background:rgba(212,168,67,.06)">
      <div style="font-weight:600;font-size:13px;color:var(--gold)">Olimpiadas Especiales</div>
      <div style="font-size:10px;color:var(--muted);margin-top:3px;line-height:1.5">
        Se le piden <b>solo</b> a quien elige la modalidad <b>Olimpiadas Especiales</b>, además de lo que pida este campeonato.
        Marca cuáles pedir en este campeonato. La cédula de identidad de su lista es el carnet que ya se pide.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        ${_oeKeys.map(k=>{ const m=window.DOCS_OE_ATLETA[k];
          return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px">
            <input type="checkbox" class="ef-oedoc" data-oe-doc="${k}" ${_oePideAdm(k)?'checked':''} onchange="efOeDocMarcado(this,'${k}')" style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
            <span><b>${esc(m.label)}</b> <span style="color:var(--muted)">· ${esc(m.desc||'')}</span></span></label>`; }).join('')}
      </div>
      ${_oeE.length?`<div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.5"><b>Al entrenador</b> que declare a uno de ellos: ${_oeE.map(esc).join(' · ')}.</div>`:''}
    </div>`;
  }
  cont.innerHTML = h;
};

window.efOeDocMarcado = function(inp, k){
  window._efOeDocs = window._efOeDocs || {};
  window._efOeDocs[k] = !!inp.checked;
};

// Marcar o desmarcar tiene que quedar en ST antes de volver a dibujar: el
// contenedor se repinta entero y, si no, el visto se perdería al toque.
window.efDocMarcado = function(inp, k){
  const cur = Array.isArray(ST.eventoForm.requiredDocs) ? ST.eventoForm.requiredDocs.slice() : [];
  const i = cur.indexOf(k);
  if(inp.checked && i<0) cur.push(k);
  if(!inp.checked && i>=0) cur.splice(i,1);
  ST.eventoForm.requiredDocs = cur;
  window.renderDocsChecklist();
};

// Antes esto se colgaba de window.render con un hook. No servía: el panel es un
// módulo, y adentro `render()` es la función local, no la de window. El hook solo
// corría cuando lo llamaba un onclick del HTML, así que la lista se dibujaba unas
// veces sí y otras no. Ahora la llama renderCampeonatos(), que es quien dibuja el
// formulario y sabe cuándo el contenedor existe.

// Fila de organizador (nombre + IG) para el editor de evento
function orgRowHtml(name,ig){
  const esc=s=>String(s||'').replace(/"/g,'&quot;');
  return `<div class="org-row" style="display:flex;gap:8px;align-items:center">
    <input class="inp org-name" value="${esc(name)}" placeholder="Nombre del organizador" style="flex:2">
    <input class="inp org-ig" value="${esc(ig)}" placeholder="@instagram (opcional)" style="flex:1.3">
    <button type="button" onclick="this.closest('.org-row').remove()" title="Quitar organizador" style="flex-shrink:0;width:36px;height:36px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:14px"><i class=yl-i-cerrar></i></button>
  </div>`;
}

window.addOrganizerRow = function(){
  const c=document.getElementById('ef_organizers'); if(!c)return;
  const tmp=document.createElement('div'); tmp.innerHTML=orgRowHtml('','');
  c.appendChild(tmp.firstElementChild);
};

// Sube el logo del campeonato o el de la federación —la misma rutina, cambia
// dónde deja la URL. `cual` vacío = campeonato; 'fed' = federación.
window.uploadEventLogo = async function(file,cual){
  if(!file)return;
  const f = cual==='fed';
  const idUrl = f?'ef_logoFedUrl':'ef_logoUrl';
  const idPv  = f?'ef_logoFedPreview':'ef_logoPreview';
  const st=document.getElementById(f?'ef_logoFedStatus':'ef_logoStatus'); if(st)st.textContent='Subiendo…';
  try{
    const storage=getStorage(app);
    const baseId=(document.getElementById('ef_id')?.value||ST.eventoForm?.id||'event').replace(/[^a-zA-Z0-9_]/g,'_').slice(0,50);
    // El de la federación se guarda más grande: en el scoreboard y en el barrido
    // se ve a buen tamaño y a 500px se notaba pixelado.
    const compressed=await compressImg(file,f?700:500,0.9);
    const sref=storageRef(storage,`logos/event/${baseId}_${f?'fed_':''}${Date.now()}.webp`);
    await uploadBytes(sref,compressed,{contentType:'image/webp'});
    const url=await getDownloadURL(sref);
    document.getElementById(idUrl).value=url;
    const pv=document.getElementById(idPv); if(pv){pv.src=url;pv.style.display='';}
    if(st)st.textContent='Logo subido';
  }catch(e){ if(st)st.textContent=''+e.message; console.warn('[logo]',e); }
};

window.uploadStreamLogo = async function(file){
  if(!file)return;
  const st=document.getElementById('ef_streamLogoStatus'); if(st)st.textContent='Subiendo…';
  try{
    const storage=getStorage(app);
    const baseId=(document.getElementById('ef_id')?.value||ST.eventoForm?.id||'event').replace(/[^a-zA-Z0-9_]/g,'_').slice(0,50);
    const compressed=await compressImg(file,500,0.85);
    const sref=storageRef(storage,`logos/stream/${baseId}_${Date.now()}.webp`);
    await uploadBytes(sref,compressed,{contentType:'image/webp'});
    const url=await getDownloadURL(sref);
    document.getElementById('ef_streamLogoUrl').value=url;
    const pv=document.getElementById('ef_streamLogoPreview'); if(pv){pv.src=url;pv.style.display='';}
    if(st)st.textContent='Logo subido';
  }catch(e){ if(st)st.textContent=''+e.message; console.warn('[streamlogo]',e); }
};

// ── Campeonatos que impiden inscribirse a este ───────────────────────────────
// El compendio dice que no se puede correr más de un regional al año, pero cuáles
// bloquean a cuál no es algo fijo: depende del calendario de cada temporada. Así
// que se elige por campeonato, al crearlo o editarlo, y queda guardado en su ficha
// —no en una lista aparte que después nadie recuerda actualizar.
// El año del campeonato que se está creando o editando. Sale de su propia fecha
// —la del formulario si ya se escribió, si no la guardada—, después del nombre, y
// como último recurso el año en curso.
function _anioEvento(editing){
  const dom=(document.getElementById('ef_date')||{}).value||'';
  const cierre=(document.getElementById('ef_nominaCloseAt')||{}).value||'';
  const cand=[dom,editing.date,cierre,editing.nominaCloseAt,editing.closeDate]
    .map(x=>String(x||'').slice(0,4)).find(x=>/^20\d\d$/.test(x));
  if(cand)return cand;
  const n=(String(editing.name||'').match(/\b(20\d\d)\b/)||[])[1];
  return n||String(new Date().getFullYear());
}

window.refrescarBloqueo=function(){
  const caja=document.getElementById('ef_bloq_box');
  if(!caja||!ST.eventoForm)return;
  // Lo que ya estaba marcado se guarda antes de redibujar: si no, cambiar la fecha
  // le borraría al operador todo lo que acababa de marcar.
  ST.eventoForm.bloqueaClaves=Array.from(document.querySelectorAll('.ef-bloq:checked'))
    .map(cb=>cb.getAttribute('data-clave'));
  caja.outerHTML=_bloqueoFormHtml(ST.eventoForm);
};

function _bloqueoFormHtml(editing){
  const H=_histAnio();
  const sel=new Set(editing.bloqueaClaves||[]);
  // Solo los campeonatos de la MISMA temporada que este. Un regional de 2026 no
  // se bloquea con uno de 2025, y mostrarlos todos era pedirle a alguien que no
  // se equivocara entre "Regional Sur Austral 2025" y "Regional Sur Austral 2026",
  // que se llaman igual salvo por el año. El año siguiente esto se acomoda solo.
  const anioEv=_anioEvento(editing);
  let lista=H.todos.filter(x=>x.anio===anioEv);
  // Si de ese año todavía no hay nada cargado, se muestra todo antes que una
  // lista vacía que no se entiende.
  const filtrado=lista.length>0;
  if(!filtrado)lista=H.todos;
  let h='<div id="ef_bloq_box" style="margin-top:18px;padding:14px;border:1px solid rgba(239,68,68,.28);border-radius:10px;background:rgba(239,68,68,.05)">';
  h+='<div style="font-family:Oswald;font-size:12px;letter-spacing:1.5px;color:var(--red);margin-bottom:5px">QUIÉNES NO PUEDEN INSCRIBIRSE A ESTE CAMPEONATO</div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.55">Marca los campeonatos que dejan a un atleta fuera de este. Al escribir su RUT en el formulario, el atleta ve el aviso en el momento — y la inscripción queda marcada para la comisión. Si no marcas ninguno, no se avisa nada.</div>';
  h+=`<div style="font-size:11px;margin-bottom:8px;color:${filtrado?'var(--gold)':'var(--orange)'}">`
    +(filtrado?`Mostrando los campeonatos de <b>${esc(anioEv)}</b>, la temporada de este campeonato.`
              :`Todavía no hay campeonatos de ${esc(anioEv)} con registros — se muestran todos. Fíjate en el año antes de marcar.`)
    +'</div>';
  if(!lista.length)h+='<div style="font-size:11px;color:var(--muted)">Todavía no hay campeonatos con registros para ofrecer.</div>';
  let anio='';
  lista.forEach(x=>{
    if(x.anio!==anio){anio=x.anio;h+=`<div style="font-family:Oswald;font-size:10px;letter-spacing:1.5px;color:var(--gold);margin:9px 0 4px">${esc(anio||'sin año')}</div>`;}
    // Un campeonato sin año en el NOMBRE es el único que puede confundirse con el
    // de otra temporada: la clave se arma con el nombre, así que "Regional Norte"
    // a secas de 2025 y de 2026 darían lo mismo. Hoy no pasa —todos lo traen— pero
    // si alguien crea uno así, tiene que verlo antes de marcarlo.
    const sinAnio=!/\b20\d\d\b/.test(x.nombre);
    h+=`<label style="display:flex;align-items:center;gap:8px;padding:2px 0;font-size:12px;cursor:pointer;color:${sel.has(x.clave)?'var(--text)':'var(--muted)'}">
      <input type="checkbox" class="ef-bloq" data-clave="${esc(x.clave)}" ${sel.has(x.clave)?'checked':''} style="cursor:pointer">
      <span>${esc(x.nombre)}</span><span style="font-size:10px;color:var(--muted)">· ${x.n}</span>
      ${sinAnio?'<span title="Sin año en el nombre: se puede confundir con el mismo campeonato de otra temporada" style="font-size:9px;font-family:Oswald;letter-spacing:1px;background:rgba(245,158,11,.18);color:var(--orange);padding:1px 6px;border-radius:8px">SIN AÑO</span>':''}</label>`;
  });
  h+='</div>';
  return h;
}

// Las modalidades que de verdad hay en el campeonato de este formulario. Se
// ofrecen para copiar porque la condición se compara contra lo que dice la
// inscripción del atleta: escrita a mano y con una letra distinta, el documento
// no se le pide a nadie y nadie se entera hasta que es tarde.
function _feMods(){
  const ev=(ST.feForm&&ST.feForm.evento)||(document.getElementById('fe_evento')||{}).value||'';
  if(!ev)return [];
  return [...new Set((ST.inscripciones||[])
    .filter(i=>i.evento===ev&&i.status!=='rejected')
    .map(i=>String(i.modalidad||'').trim()).filter(Boolean))].sort();
}

function efDocPinta(w){
  const cfg=DOCED[w]; if(!cfg)return;
  const c=document.getElementById(cfg.cont); if(!c)return;
  const L=cfg.lista();
  if(!L.length){
    c.innerHTML='<div style="font-size:11px;color:var(--muted);padding:4px 0">Ninguno todavía.</div>';
    return;
  }
  c.innerHTML=L.map((d,i)=>`
    <div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:rgba(10,22,40,.35)">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input value="${esc(d.label||'')}" placeholder="Nombre del documento (ej. Certificado médico)"
          oninput="efDocSet('${w}',${i},'label',this.value)" style="flex:1;padding:6px 9px;border-radius:6px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px">
        <button type="button" onclick="efDocBorrar('${w}',${i})" title="Quitar"
          style="padding:5px 10px;border-radius:6px;border:1px solid rgba(239,68,68,.5);background:transparent;color:var(--red);font-size:11px;cursor:pointer">Quitar</button>
      </div>
      <input value="${esc(d.desc||'')}" placeholder="Descripción corta que ve ${cfg.quien}"
        oninput="efDocSet('${w}',${i},'desc',this.value)" style="width:100%;box-sizing:border-box;padding:6px 9px;border-radius:6px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px;margin-bottom:8px">
      ${w==='e'?`<div style="margin-bottom:8px">
        <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Pedirlo solo si lleva atletas de estas modalidades — vacío = a todos</div>
        <input value="${esc((d.mods||[]).join(', '))}" list="fe_mods_list" placeholder="Ej. Olimpiadas Especiales"
          oninput="efDocSet('e',${i},'mods',this.value)" style="width:100%;box-sizing:border-box;padding:6px 9px;border-radius:6px;border:1px solid ${(d.mods||[]).length?'var(--gold)':'var(--border)'};background:#0a1628;color:var(--text);font-size:12px">
        ${_feMods().length?`<div style="font-size:10px;color:var(--muted);margin-top:3px">En este campeonato hay: ${_feMods().map(m=>`<button type="button" onclick="efDocMods(${i},${JSON.stringify(m).replace(/"/g,'&quot;')})" style="background:transparent;border:none;color:var(--gold);cursor:pointer;font-size:10px;text-decoration:underline;padding:0 2px">${esc(m)}</button>`).join(' · ')}</div>`:''}
      </div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Formulario para descargar (PDF)</div>
          ${d.plantillaUrl
            ? `<div style="display:flex;gap:6px;align-items:center"><a href="${esc(d.plantillaUrl)}" target="_blank" style="font-size:11px;color:var(--gold);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">ver el PDF cargado</a>
               <button type="button" onclick="efDocSet('${w}',${i},'plantillaUrl','')" style="padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:10px;cursor:pointer">quitar</button></div>`
            : `<label class="btn" style="display:block;text-align:center;padding:5px;font-size:11px;cursor:pointer">Subir PDF<input type="file" accept="application/pdf,image/*" onchange="efDocPdf('${w}',${i},this)" style="display:none"></label>`}
          <div id="efdoc_st_${w}_${i}" style="font-size:10px;color:var(--muted);margin-top:3px"></div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Link a otra página (opcional)</div>
          <input value="${esc(d.linkUrl||'')}" placeholder="https://…"
            oninput="efDocSet('${w}',${i},'linkUrl',this.value)" style="width:100%;box-sizing:border-box;padding:6px 9px;border-radius:6px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:11px">
          <input value="${esc(d.linkTexto||'')}" placeholder="Qué decirle del link"
            oninput="efDocSet('${w}',${i},'linkTexto',this.value)" style="width:100%;box-sizing:border-box;padding:6px 9px;border-radius:6px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:11px;margin-top:5px">
        </div>
      </div>
    </div>`).join('');
}

window.efDocAgregar=function(w){
  // Clave estable y sin acentos ni espacios: es parte de la ruta del archivo.
  const key='d'+Date.now().toString(36);
  DOCED[w].lista().push({key,label:'',desc:'',plantillaUrl:'',linkUrl:'',linkTexto:'',mods:[]});
  // El del atleta se marca solo como requerido: quien agrega un documento lo
  // agrega para pedirlo. Los del entrenador se piden todos, así que no hay lista.
  if(w==='x'){
    const cur=Array.isArray(ST.eventoForm.requiredDocs)?ST.eventoForm.requiredDocs.slice():[];
    cur.push('x_'+key); ST.eventoForm.requiredDocs=cur;
  }
  efDocPinta(w); if(w==='x'){try{window.renderDocsChecklist()}catch(e){}}
};

window.efDocSet=function(w,i,k,v){
  const L=DOCED[w].lista(); if(!L[i])return;
  // Las modalidades se escriben separadas por coma y se guardan como lista.
  // No se repinta: esto corre en cada tecla y volver a dibujar el editor le
  // saca el foco al campo en mitad de una palabra.
  if(k==='mods'){
    L[i].mods=String(v||'').split(',').map(s=>s.trim()).filter(Boolean);
    return;
  }
  L[i][k]=v;
  if(k==='plantillaUrl')efDocPinta(w);
  // El nombre se ve también en la lista de arriba, donde se marca y se limita.
  if(k==='label'&&w==='x'){ try{window.renderDocsChecklist()}catch(e){} }
};

// Los atajos de modalidad sí repintan: hay que ver qué quedó puesto.
window.efDocMods=function(i,valor){
  const L=DOCED.e.lista(); if(!L[i])return;
  const ya=(L[i].mods||[]).map(String);
  // Tocar la misma dos veces la saca: sirve de interruptor.
  L[i].mods = ya.indexOf(valor)>=0 ? ya.filter(x=>x!==valor) : ya.concat([valor]);
  efDocPinta('e');
};

window.efDocBorrar=function(w,i){
  const L=DOCED[w].lista(); const d=L[i]; if(!d)return;
  if(d.label&&!confirm('¿Quitar "'+d.label+'"?\n\nA quien ya se inscribió no se le borra lo que subió.'))return;
  if(w==='x'){
    const k='x_'+d.key;
    ST.eventoForm.requiredDocs=(Array.isArray(ST.eventoForm.requiredDocs)?ST.eventoForm.requiredDocs:[]).filter(x=>x!==k);
    delete window._efDocsCond[k];
  }
  L.splice(i,1); efDocPinta(w); if(w==='x'){try{window.renderDocsChecklist()}catch(e){}}
};

window.efDocPdf=async function(w,i,inp){
  const f=inp.files&&inp.files[0]; if(!f)return;
  const st=document.getElementById('efdoc_st_'+w+'_'+i); if(st)st.textContent='Subiendo…';
  try{
    const ev=(ST.eventoForm&&ST.eventoForm.id)||'evento';
    const L=DOCED[w].lista();
    const nom=DOCED[w].pref+((L[i]||{}).key||'doc');
    const ext=(String(f.name||'').match(/\.([a-zA-Z0-9]+)$/)||[])[1]||'pdf';
    const sref=storageRef(getStorage(app),'evento_docs/'+ev+'/'+nom+'.'+ext);
    await uploadBytes(sref,f,{contentType:f.type||'application/pdf'});
    const url=await getDownloadURL(sref);
    L[i].plantillaUrl=url;
    if(st)st.textContent='';
    efDocPinta(w);
  }catch(e){ if(st){st.textContent='Error: '+e.message; st.style.color='var(--red)';} }
};

function efDocLeer(w){
  // Solo los que tienen nombre: una fila vacía que quedó del botón no se guarda.
  return (DOCED[w].lista()||[]).filter(d=>d&&d.key&&String(d.label||'').trim())
    .map(d=>({key:d.key,label:String(d.label).trim(),desc:String(d.desc||'').trim(),
              plantillaUrl:d.plantillaUrl||'',linkUrl:String(d.linkUrl||'').trim(),
              linkTexto:String(d.linkTexto||'').trim()}));
}

window.efDocLeer=efDocLeer;

// ── Transmisiones de cada día ─────────────────────────────────────────────
function efYtFila(d){
  d=d||{};
  const q=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  return '<div class="ef-yt-fila" style="display:flex;gap:6px;align-items:center;margin-top:5px;flex-wrap:wrap">'
    +'<input type="date" class="ef-yt-fecha" value="'+q(d.fecha)+'" style="padding:6px;border-radius:6px;border:1px solid var(--border);background:#0a1628;color:var(--text);font-size:12px">'
    +'<input class="inp ef-yt-url" value="'+q(d.url)+'" placeholder="https://www.youtube.com/live/…" style="flex:1;min-width:220px">'
    +'<button type="button" onclick="this.parentNode.remove()" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">Quitar</button></div>';
}

window.efYtFila=efYtFila;

function _efHoy(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

function _efYtId(u){ const m=String(u||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([A-Za-z0-9_-]{11})/); return m?m[1]:String(u||'').trim(); }

function efYtLeer(){
  const out=[], vistos=new Set();
  document.querySelectorAll('#ef_ytDias .ef-yt-fila').forEach(r=>{
    const url=(r.querySelector('.ef-yt-url').value||'').trim();
    const fecha=(r.querySelector('.ef-yt-fecha').value||'').trim();
    if(!url)return;
    const k=_efYtId(url); if(vistos.has(k))return; vistos.add(k);
    out.push({url,fecha});
  });
  return out;
}

window.efYtAgregar=function(d){
  const box=document.getElementById('ef_ytDias'); if(!box)return;
  box.insertAdjacentHTML('beforeend',efYtFila(d||{}));
};

// Se cambió el link de arriba: el anterior baja a la lista con la fecha que
// tenía, y la fecha de arriba pasa a ser hoy. Queda a la vista para corregirla.
window.efYtCambio=function(inp){
  const antes=(inp.dataset.orig||'').trim(), ahora=(inp.value||'').trim();
  if(!antes||_efYtId(antes)===_efYtId(ahora))return;
  const ya=efYtLeer().some(d=>_efYtId(d.url)===_efYtId(antes));
  const fd=document.getElementById('ef_youtubeDesde');
  if(!ya)window.efYtAgregar({url:antes,fecha:(fd&&fd.value)||''});
  if(fd)fd.value=_efHoy();
  inp.dataset.orig=ahora;
  showToast(ya?'Link cambiado':'El link anterior pasó a "Transmisiones de cada día" — revisa su fecha');
};

window.saveEvento = async function(){
  const isNew = ST.eventoFormMode === 'create';
  const id  = isNew ? (document.getElementById('ef_id').value||'').trim().replace(/\s+/g,'_') : ST.eventoForm.id;
  const name = (document.getElementById('ef_name').value||'').trim();
  const status = document.getElementById('ef_status').value;
  const date   = document.getElementById('ef_date').value;
  // Nuevos campos: cierre de pre-nómina (inscripciones) + cierre de nómina (cambios)
  const preNominaCloseAt = document.getElementById('ef_preNominaCloseAt')?.value || '';
  const nominaCloseAt = document.getElementById('ef_nominaCloseAt')?.value || '';
  // Compat: closeDate es la fecha (sin hora) del cierre de nómina, para mantener
  // funcionando el auto-close existente que solo lee fechas.
  const closeDate = nominaCloseAt ? nominaCloseAt.slice(0,10) : '';
  const location  = document.getElementById('ef_location').value.trim();
  // Organizadores: lista (cada uno con su IG). org = nombres unidos (compat).
  const organizers = Array.from(document.querySelectorAll('#ef_organizers .org-row')).map(r=>({
    name:(r.querySelector('.org-name')?.value||'').trim(),
    instagram:(r.querySelector('.org-ig')?.value||'').trim().replace(/^@/,'')
  })).filter(o=>o.name);
  const org       = organizers.map(o=>o.name).join(' · ');
  const days      = document.getElementById('ef_days').value.trim();
  const extra     = document.getElementById('ef_extra').value;
  const recordsEnabled = document.getElementById('ef_recordsEnabled').checked;
  const cronogramaPublic = document.getElementById('ef_cronogramaPublic')?.checked !== false;
  const requiereFoto = !!document.getElementById('ef_requiereFoto')?.checked;
  const livecastVisible = document.getElementById('ef_livecastVisible')?.checked !== false;
  const posNac2026 = !!document.getElementById('ef_posNac2026')?.checked;
  const youtubeUrl = (document.getElementById('ef_youtubeUrl')?.value||'').trim();
  let youtubeDesde = (document.getElementById('ef_youtubeDesde')?.value||'').trim();
  const youtubeDias = efYtLeer();
  // Red de seguridad: si el link cambió y el anterior no quedó en la lista (por
  // ejemplo, se guardó sin salir del campo), se agrega igual. No se pierde nunca.
  {
    const prev=((ST.eventoForm&&ST.eventoForm.youtubeUrl)||'').trim();
    if(prev&&_efYtId(prev)!==_efYtId(youtubeUrl)&&!youtubeDias.some(d=>_efYtId(d.url)===_efYtId(prev))){
      youtubeDias.push({url:prev,fecha:((ST.eventoForm&&ST.eventoForm.youtubeDesde)||'')});
      if(!youtubeDesde||youtubeDesde===((ST.eventoForm&&ST.eventoForm.youtubeDesde)||''))youtubeDesde=_efHoy();
    }
  }
  // El link de arriba no se repite en la lista de días anteriores.
  const _ytAct=_efYtId(youtubeUrl);
  const youtubeDiasOk=youtubeDias.filter(d=>_efYtId(d.url)!==_ytAct).sort((x,y)=>String(x.fecha).localeCompare(String(y.fecha)));
  const logoUrl = (document.getElementById('ef_logoUrl')?.value||'').trim();
  const logoFedUrl = (document.getElementById('ef_logoFedUrl')?.value||'').trim();
  const instagram = organizers[0]?.instagram || '';   // compat: IG del primer organizador
  const streamLogoUrl = (document.getElementById('ef_streamLogoUrl')?.value||'').trim();
  const streamInstagram = (document.getElementById('ef_streamIg')?.value||'').trim().replace(/^@/,'');
  // NUEVO: leer los checkboxes de documentos requeridos
  // Solo las casillas de documentos (data-doc-key): las de Olimpiadas
  // Especiales van aparte, en oeDocs.
  const requiredDocs = Array.from(document.querySelectorAll('#ef_docs_container input[data-doc-key]:checked'))
    .map(cb => cb.getAttribute('data-doc-key'));
  const docsExtra = efDocLeer('x');
  // Una por línea, sin vacías ni repetidas.
  const _lineas = id => [...new Set(String((document.getElementById(id)||{}).value||'')
    .split('\n').map(x=>x.trim()).filter(Boolean))];
  const modsExtra = _lineas('ef_modsx'), divsExtra = _lineas('ef_divsx');
  const modsSolo = !!document.getElementById('ef_modsSolo')?.checked;
  const divsSolo = !!document.getElementById('ef_divsSolo')?.checked;
  // A quién se le pide cada documento. Se guarda solo lo que de verdad limita:
  // una condición vacía es "a todos", y guardarla no aportaría nada.
  const docsCond = {};
  Object.entries(window._efDocsCond||{}).forEach(([k,c])=>{
    if(requiredDocs.indexOf(k)<0) return;      // no se guarda la condición de un doc que no se pide
    const mods=(c&&c.mods||[]).filter(Boolean), divs=(c&&c.divs||[]).filter(Boolean);
    if(mods.length||divs.length) docsCond[k]={mods,divs};
  });

  if(!id || !name){ showToast('ID y nombre son obligatorios', null, true); return; }
  if(isNew && ST.eventos.find(e=>e.id===id)){ showToast('Ya existe un campeonato con ese ID', null, true); return; }

  // Campeonatos que dejan a un atleta fuera de este.
  const bloqueaClaves = Array.from(document.querySelectorAll('.ef-bloq:checked'))
    .map(cb=>cb.getAttribute('data-clave'));
  const data = {id, name, date, closeDate, preNominaCloseAt, nominaCloseAt, location, org, days, status, bloqueaClaves,
    extraCols: [extra], recordsEnabled, cronogramaPublic, requiereFoto, livecastVisible, posNac2026, youtubeUrl,
    youtubeDesde, youtubeDias: youtubeDiasOk,   // fecha del link actual + los de los días anteriores
    organizers, logoUrl, logoFedUrl, instagram,    // organizadores (con IG) + logo del campeonato y de la federación
    streamLogoUrl, streamInstagram,    // logo de productora + IG para la tarjeta de Transmisiones
    requiredDocs,    // array de docKeys requeridos
    docsCond,        // a qué modalidades/divisiones se le pide cada uno (vacío = a todas)
    docsExtra,       // documentos propios del campeonato (nombre, PDF y link)
    oeDocs: Object.assign({}, window._efOeDocs||{}),   // papeles de Olimpiadas Especiales que pide (los no marcados usan su valor de siempre)
    modsExtra, modsSolo, divsExtra, divsSolo,   // modalidades y divisiones propias
    updatedAt: serverTimestamp()};
  if(isNew) data.createdAt = serverTimestamp();

  try{
    await setDoc(doc(db,'eventos',id), data, {merge:true});
    await logAction(isNew?'create_evento':'update_evento', id, null, name);
    showToast(isNew?'Campeonato creado — ya visible en inscripciones y nómina':'Cambios guardados');
    ST.eventoForm = null;
    render();
  }catch(e){ showToast('Error: '+e.message, null, true); console.error(e); }
};

window.toggleLivecastVisible = async function(id, currentlyVisible){
  const next = !currentlyVisible;
  try{
    await setDoc(doc(db,'eventos',id), {livecastVisible: next, updatedAt: serverTimestamp()}, {merge:true});
    await logAction('toggle_livecast_visible', id, null, next ? 'ON' : 'OFF');
    showToast(next ? 'Campeonato visible en YourLift' : 'Campeonato oculto de YourLift');
  }catch(e){ showToast('Error: '+e.message, null, true); }
};

window.deleteEvento = async function(id, name, btn){
  if(!confirm(`¿Eliminar el campeonato "${name}"?\n\nSe borrará solo la configuración del evento. Las inscripciones y resultados asociados NO se eliminan automáticamente.`))return;
  if(!confirm(`Última confirmación: ¿eliminar "${name}"?`))return;
  try{
    btn.disabled=true; btn.textContent='Eliminando...';
    await deleteDoc(doc(db,'eventos',id));
    await logAction('delete_evento',id,null,name);
    showToast(`Campeonato "${name}" eliminado`);
    render();
  }catch(e){ showToast('Error: '+e.message,null,true); btn.disabled=false; btn.textContent='Eliminar'; }
};

window.copyPublicLink = function(id, btn){
  const base = location.origin + location.pathname.replace(/[^/]+$/, '');
  const url = base + 'livecast.html?evento=' + encodeURIComponent(id);
  const ok = ()=>{
    if(btn){
      const t=btn.textContent;
      btn.textContent='Copiado — pégalo en WhatsApp';
      btn.style.color='var(--green)';
      btn.style.borderColor='var(--green)';
      setTimeout(()=>{btn.textContent=t;btn.style.color='var(--gold)';btn.style.borderColor='rgba(212,168,67,.4)'},2200);
    }
  };
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(ok).catch(()=>prompt('Copia este link:',url));
  } else {
    prompt('Copia este link:',url);
  }
};

window.closeNomina = async function(id){
  const ev = ST.eventos.find(e=>e.id===id);
  if(!ev) return;
  const insc = ST.inscripciones.filter(i=>i.evento===id);
  const pending = insc.filter(i=>i.status==='pending').length;
  const msg = pending > 0
    ? `Hay ${pending} inscripción${pending!==1?'es':''} pendiente${pending!==1?'s':''}. Al cerrar la nómina quedarán como rechazadas.\n\n¿Cerrar igualmente?`
    : `¿Cerrar la nómina de "${ev.name}"?\nNo se aceptarán nuevas inscripciones.`;
  if(!confirm(msg)) return;
  try{
    await setDoc(doc(db,'eventos',id),{status:'closed',closedAt:serverTimestamp()},{merge:true});
    if(pending > 0){
      await Promise.all(insc.filter(i=>i.status==='pending').map(i=>
        updateDoc(doc(db,'inscripciones',i.id),{status:'rejected'})
      ));
    }
    await logAction('close_nomina', id, 'open', 'closed');
    showToast('Nómina cerrada — '+ev.name);
    ST.eventoForm = null;
    render();
  }catch(e){ showToast('Error: '+e.message, null, true); }
};

window.purgarInscripcionesArchivadas = async function(){
  const archivedIds=new Set((ST.eventos||[]).filter(e=>e.status==='archived').map(e=>e.id));
  const toDelete=ST.inscripciones.filter(i=>archivedIds.has(i.evento));
  if(!toDelete.length){showToast('No hay inscripciones de campeonatos archivados');return;}
  const evNames=[...archivedIds].map(id=>{const ev=(ST.eventos||[]).find(e=>e.id===id);return ev?.name||id;}).filter(Boolean).join(', ');
  if(!confirm(`¿Purgar ${toDelete.length} inscripciones de campeonato(s) archivado(s)?\n\n${evNames}\n\nLos resultados ya están en el perfil de cada atleta (competition_results). Esta acción no se puede deshacer.`))return;
  showToast(`Purgando ${toDelete.length} inscripciones…`);
  try{
    const CHUNK=400;
    for(let i=0;i<toDelete.length;i+=CHUNK){
      const batch=writeBatch(db);
      toDelete.slice(i,i+CHUNK).forEach(ins=>{
        batch.delete(doc(db,'inscripciones',ins.id));
        try{batch.delete(doc(db,'inscripciones_private',ins.id));}catch(_){}
      });
      await batch.commit();
    }
    await logAction('purge_inscripciones_archivadas',`${toDelete.length} docs`,null,evNames);
    ST.inscripciones=ST.inscripciones.filter(i=>!archivedIds.has(i.evento));
    showToast(`${toDelete.length} inscripciones purgadas`);
    render();
  }catch(e){showToast('Error: '+e.message,null,true);}
};

window.purgarDocsNomina = async function(eventoId, eventoName, btn){
  const insc = ST.inscripciones.filter(i => i.evento === eventoId);
  if(!insc.length){ showToast('No hay inscripciones para este evento'); return; }
  const LEGACY = ['carnetURL','carnetBackURL','wadeURL','carnetPhotoURL','consentimientoURL','ipfConsentURL','passportURL','notasURL'];
  let docsCount = 0;
  insc.forEach(ins => {
    const priv = ST.inscripcionesPrivate[ins.id] || {};
    const map = priv.docs || {};
    if(Object.values(map).some(v=>v&&typeof v==='string') || LEGACY.some(f=>priv[f])) docsCount++;
  });
  if(!docsCount){ showToast('No hay documentos que purgar para este evento'); return; }
  if(!confirm(`¿Purgar documentos de ${insc.length} atletas inscriptos en "${eventoName}"?\n\n• Se eliminan de Storage: carnets, WADA, consentimientos y fotos de documentos.\n• Las fotos de perfil de atleta NO se tocan.\n\nEsta acción no se puede deshacer.`)) return;
  if(btn){ btn.disabled=true; btn.textContent='Purgando…'; }
  const stor=getStorage(app);
  let deleted=0, errors=0, processed=0;
  try{
    for(const ins of insc){
      const priv = ST.inscripcionesPrivate[ins.id] || {};
      const map = priv.docs || {};
      const urls=[];
      Object.values(map).forEach(u=>{ if(u&&typeof u==='string'&&u.includes('firebasestorage'))urls.push(u); });
      LEGACY.forEach(f=>{ if(priv[f]&&typeof priv[f]==='string'&&priv[f].includes('firebasestorage'))urls.push(priv[f]); });
      for(const url of urls){
        const m=url.match(/\/o\/(.+?)(\?|$)/);
        if(!m)continue;
        const path=decodeURIComponent(m[1]);
        try{ await deleteObject(storageRef(stor,path)); deleted++; }catch(e){ if(e.code!=='storage/object-not-found')errors++; }
      }
      const upd={};
      Object.keys(map).forEach(k=>{ upd[`docs.${k}`]=deleteField(); });
      LEGACY.forEach(f=>{ if(priv[f]!==undefined) upd[f]=deleteField(); });
      if(Object.keys(upd).length){
        try{
          await updateDoc(doc(db,'inscripciones_private',ins.id),upd);
          if(ST.inscripcionesPrivate[ins.id]){
            delete ST.inscripcionesPrivate[ins.id].docs;
            LEGACY.forEach(f=>delete ST.inscripcionesPrivate[ins.id][f]);
          }
        }catch(e){ errors++; }
      }
      processed++;
      if(btn) btn.textContent=`Purgando… (${processed}/${insc.length})`;
    }
    await logAction('purgar_docs_nomina',eventoId,null,`${deleted} archivos`,{evento:eventoName});
    showToast(`Documentos purgados: ${deleted} archivos eliminados${errors?`, ${errors} errores`:''}`);
    render();
  }catch(e){ showToast('Error: '+e.message,null,true); }
  finally{ if(btn){ btn.disabled=false; btn.textContent='Purgar documentos'; } }
};

window.archiveEvento = async function(id){
  if(!confirm('¿Archivar este campeonato? Seguirá visible en el historial pero no en inscripciones.')) return;
  try{
    await setDoc(doc(db,'eventos',id),{status:'archived',updatedAt:serverTimestamp()},{merge:true});
    await logAction('archive_evento', id, null, 'archived');
    showToast('Campeonato archivado');
    ST.eventoForm = null;
    render();
  }catch(e){ showToast('Error: '+e.message, null, true); }
};

// Auto-close overdue nominations (runs on loadAll)
async function autoCloseOverdueEventos(){
  const today = new Date().toISOString().slice(0,10);
  const overdue = ST.eventos.filter(ev => ev.status==='open' && ev.closeDate && ev.closeDate < today);
  for(const ev of overdue){
    try{
      await setDoc(doc(db,'eventos',ev.id),{status:'closed',closedAt:serverTimestamp(),autoClosedAt:today},{merge:true});
      await logAction('auto_close_nomina', ev.id, 'open', 'closed', {reason:'closeDate passed'});
      console.log('[Admin] Auto-closed:', ev.name);
    }catch(e){ console.warn('Auto-close failed for', ev.id, e); }
  }
}

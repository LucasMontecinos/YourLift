// livecast.html — Cerrar la competencia: publicar resultados y guardar los récords nacionales.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// Exporta los resultados en el formato que usa data.json (competencias por atleta).
// El JSON descargado se puede mergear directo a data.json para que aparezca
// en los perfiles públicos de cada atleta (atleta.html).
// ═══════════════════════════════════════════════════════════════
// CERRAR COMPETENCIA — sube todos los resultados a Firestore.
// Los atletas los ven en sus perfiles y aparecen en el ranking
// global sin necesidad de re-deployar.
// ═══════════════════════════════════════════════════════════════
// Quiénes se publican al cerrar: solo los chilenos. El ranking nacional y los
// perfiles de yourlift.cl muestran todo lo que llega a competition_results, sin
// mirar el país, así que cerrar un internacional (el Sudamericano) metía a los
// extranjeros en el ranking de Chile. Un atleta sin país cargado cuenta como
// chileno (_ctry devuelve CHI), que es lo que son en un campeonato nacional.
function _cierreAtletas(){ return _conUni((DATA.athletes||[]).filter(a=>!a.__is4&&_ctry(a)==='CHI')); }

// La ficha del atleta en la base (data.json), para publicar el resultado con su
// código y su RUT. La nómina del Sudamericano viene de FESUPO sin RUT ni código:
// sin esto el perfil se busca por nombre exacto, y si la base lo tiene escrito
// con una letra distinta ("Ecobar" / "Escobar") se le creaba un perfil nuevo.
// Primero findInDB (RUT, nombre exacto, todas las palabras); si no, se acepta que
// UNA palabra difiera en UNA letra, siempre que haya un solo candidato.
function _cierreFicha(a){
  let f=null;
  try{ f=findInDB(a.name,a.rut,a); }catch(e){}
  if(f||typeof DB_FULL==='undefined'||!DB_FULL)return f;
  const pal=nrm(a.name).split(/\s+/).filter(Boolean);
  if(pal.length<2)return null;
  const unaLetra=(x,y)=>{
    if(x===y)return true;
    if(Math.abs(x.length-y.length)>1)return false;
    let i=0,j=0,dif=0;
    while(i<x.length&&j<y.length){
      if(x[i]===y[j]){i++;j++;continue;}
      if(++dif>1)return false;
      if(x.length>y.length)i++; else if(y.length>x.length)j++; else{i++;j++;}
    }
    return dif+(x.length-i)+(y.length-j)<=1;
  };
  const cand=DB_FULL.filter(d=>{
    const q=nrm(d.nombre).split(/\s+/).filter(Boolean);
    if(q.length!==pal.length)return false;
    let malas=0;
    for(let k=0;k<q.length;k++){ if(q[k]!==pal[k]){ if(!unaLetra(q[k],pal[k]))return false; if(++malas>1)return false; } }
    return true;
  });
  return cand.length===1?cand[0]:null;
}

async function cerrarCompetenciaConfirm(){
  const evName = (DATA.event==null?void 0:DATA.event.name) || '';
  const evId   = (DATA.event==null?void 0:DATA.event.id) || (window.LIVE_EVENTS ? Object.keys(window.LIVE_EVENTS).find(k=>window.LIVE_EVENTS[k]===evName) : '') || evName.replace(/[^a-zA-Z0-9]+/g,'_').toLowerCase();
  if(!evName){ alert('No hay evento cargado.'); return; }
  // Un evento de prueba nunca publica: sus marcas irían al ranking y a los
  // perfiles de atletas reales como si fueran de verdad.
  if(_isEnsayo()){ alert('Este es un evento de PRUEBA (ensayo).\n\nSus resultados no se publican en el ranking ni en los perfiles.'); return; }
  const ath = _cierreAtletas();
  const fuera = (DATA.athletes||[]).filter(a=>!a.__is4).length - ath.filter(a=>!a.__is4).length;
  const counts = {meet:0, bench:0, dq:0};
  ath.forEach(a=>{
    if(isMeetClassic(a)||isMeetEquipped(a)){
      if(isDQ(a)) counts.dq++;
      else if(totalOf(a,'meet')>0) counts.meet++;
    }
    if(inBenchRanking(a) && bestOf(a,'bp')>0) counts.bench++;
  });
  const msg = `CERRAR COMPETENCIA\n\nEvento: ${evName}\n\nSe publicarán los resultados en Firestore:\n  • ${counts.meet} con total válido\n  • ${counts.dq} marcados como DQ\n  • ${counts.bench} en ranking Only Bench\n`
    +(fuera>0?`\nSolo se publican los CHILENOS: ${fuera} atletas de otros países quedan fuera (no van al ranking nacional).\n`:'')
    +`\nApareceran inmediatamente en los perfiles de cada atleta y en el ranking general.\n\n¿Confirmar?`;
  // Récords nacionales que rompieron los chilenos: se dicen ANTES de confirmar,
  // porque al cerrar se actualizan solos. En un regional no se rompen récords.
  let rompen=[];
  if(!/regional/i.test(evName)){
    try{ rompen=_rnDetectar(await _rnCargarTabla()).filter(r=>r.act); }catch(e){ console.warn('[récords nac]',e); }
  }
  window._RN_CIERRE=rompen;
  if(!confirm(msg.replace('\n\n¿Confirmar?',
      (rompen.length?`\n\nRÉCORDS NACIONALES: se actualizarán ${rompen.length} récords rotos por chilenos.`:'')+'\n\n¿Confirmar?'))) return;
  await cerrarCompetencia(evId, evName);
}

async function cerrarCompetencia(evId, evName){
  const fb = window._fb;
  if(!fb || !fbDB){ alert('Firebase no está listo. Vuelve a intentar en 5 segundos.'); return; }
  const today = new Date().toISOString().slice(0,10);
  const ath = _cierreAtletas();

  // Puesto de cada uno en el CAMPEONATO, contra todos los países: el acta lo
  // calcula así (modalidad + sexo + división + categoría, desempate por peso
  // corporal). Se sube con el resultado porque el perfil, si no lo trae, lo saca
  // comparando solo lo publicado — y como se publican solo los chilenos, un
  // segundo detrás de un extranjero aparecía primero (Martín Gamboa, Sub-Junior -83).
  const _lugares={};
  { const diaAntes=window._ACTA_DIA; window._ACTA_DIA='';     // el campeonato entero, no el día elegido
    try{
      _actaGrupos().forEach(gr=>{ if(gr.mod==='invitado')return;
        gr.filas.forEach(f=>{ if(f.lugar>0)_lugares[f.a.id+'|'+(gr.view==='bench'?'bench':'meet')]=f.lugar; }); });
    }finally{ window._ACTA_DIA=diaAntes; } }

  // Toast de progreso
  showToastLC('Publicando resultados...');
  let written = 0;
  let errors = 0;

  for(const a of ath){
    // Generar entradas por vista (meet/bench si compite en combinada)
    const views = [];
    if(isMeetClassic(a)||isMeetEquipped(a)||isOEClassic(a)) views.push('meet');
    if(inBenchRanking(a) && bestOf(a,'bp')>0) views.push('bench');

    for(const view of views){
      const dq = view==='meet' && isDQ(a);
      const t = totalOf(a, view);
      // Saltar si no hay total ni DQ ni intentos
      if(t<=0 && !dq) continue;
      const gl = dq ? 0 : calcGL(t, a.bw, a.sex, _glMod(a), view);
      const isEq = isMeetEquipped(a);
      const isOE = isOEClassic(a);
      let modLabel;
      if(isOE) modLabel = 'Powerlifting Classic Special Olympics';
      else if(view==='bench') modLabel = isEq ? 'Only Bench Equipado' : 'Only Bench Classic';
      else modLabel = isEq ? 'Powerlifting Equipado' : 'Powerlifting Classic';
      // Universitario va como modalidad propia: el perfil junta por evento +
      // modalidad, y con el mismo rótulo el resultado de su división de edad y el
      // universitario se pisaban (quedaba uno solo).
      const esUni=/univ/i.test(String(a.div||''));
      if(esUni&&view==='meet'&&!isOE) modLabel = 'Powerlifting Classic Universitario';

      // Código y RUT: los del atleta, o los de su ficha en la base si no los trae.
      const ficha = (a.codigo&&a.rut) ? null : _cierreFicha(a);
      const codigo = a.codigo || (ficha&&ficha.codigo) || '';
      const rut = a.rut || (ficha&&ficha.rut) || '';
      // Doc ID determinístico: {eventoId}_{codigo o rut}_{view}
      const codeKey = (codigo || rut || a.id || 'unknown').toString().replace(/[^a-zA-Z0-9_-]/g,'_');
      const docId = `${evId}_${codeKey}_${view}${esUni?'_uni':''}`;

      const payload = {
        evento: evName,
        evento_id: evId,
        fecha: today,
        codigo: codigo,
        rut: rut,
        nombre: a.name || '',
        club: a.club || '',
        sexo: a.sex || '',
        division: a.div || '',
        // El año de nacimiento viaja con el resultado para que el ranking pueda
        // recalcular la división de edad cada 1 de enero. La división de arriba
        // es la del día de la competencia y no se toca: es la del acta.
        anioNac: a.born || '',
        categoria: a.cat || '',
        modalidad: modLabel,
        view: view,
        resultado: {
          bw: a.bw || 0,
          sq: view==='bench' ? 0 : bestOf(a,'sq'),
          bp: bestOf(a,'bp'),
          dl: view==='bench' ? 0 : bestOf(a,'dl'),
          total: dq ? 0 : t,
          glp: dq ? 0 : gl,
          status: dq ? 'DQ' : 'OK'
        },
        published_at: fb.serverTimestamp(),
        source: 'yourlift_livecast'
      };
      if(_lugares[a.id+'|'+view])payload.posicion=_lugares[a.id+'|'+view];
      try{
        await fb.setDoc(fb.doc(fbDB, 'competition_results', docId), payload);
        written++;
      } catch(e){
        console.error('[cerrar] error:', a.name, view, e);
        errors++;
      }
    }
  }

  if(errors===0){
    showToastLC(`Competencia cerrada: ${written} resultados publicados`);
    alert(`Competencia "${evName}" cerrada.\n\n${written} resultados publicados.\n\nYa son visibles en yourlift.cl/atleta y en el ranking.`);
    // Récords nacionales rotos por chilenos: se actualizan solos (los mismos que
    // se anunciaron en la confirmación).
    const rompen=window._RN_CIERRE||[]; window._RN_CIERRE=null;
    if(rompen.length){
      try{
        const hechos=await _rnAplicar(rompen);
        alert(hechos.length+' récords nacionales actualizados:\n\n'+_rnResumen(hechos)+'\n\nYa se ven en yourlift.cl → Récords.');
      }catch(e){ alert('Los resultados se publicaron, pero NO se pudieron actualizar los récords nacionales: '+(e.code||e.message)+'\n\nPuedes hacerlo con el botón "Récords nacionales".'); }
    }
  } else {
    showToastLC(`Publicados ${written}, errores ${errors}`);
    alert(`Se publicaron ${written} resultados.\n${errors} fallaron — revisa la consola (F12).`);
  }
}

// ═══════════════════════════════════════════════════════════════
// RÉCORDS NACIONALES — detección al cerrar (ver documentos/RECORDS_NACIONALES.md)
//
// Solo los CHILENOS. Cada uno se compara contra la tabla nacional de su
// modalidad: classic contra classic, equipado contra equipado, universitario
// contra universitario. Compite por el récord de su división y, si no es Open,
// también por el Open (un Junior que supera el Open se lleva los dos).
// Pueden romper récord los campeonatos nacionales e internacionales.
//
// No escribe nada por su cuenta: arma la lista, se revisa, y recién con
// "Guardar en la tabla de récords" se escribe records/data —el mismo documento
// que edita Admin → Récords y que lee el sitio—. Un casillero sin récord previo
// viene desmarcado: la tabla puede no tener esa categoría a propósito.
// Only Bench no se compara: la tabla nacional no tiene récords de banca sola.
// ═══════════════════════════════════════════════════════════════
function _rnTipo(a){
  const m=String(a.mod||'');
  if(m.indexOf('oe_')===0||m==='invitado'||m==='onlybench'||m==='classic_bench'&&!_isPlusBench(a))return null;
  if(/univ/i.test(String(a.div||'')))return 'universitario';
  if(m==='equipped'||m==='equipped_bench')return 'equipped';
  return 'classic';
}

function _rnCat(a){ const c=_srCat(a); if(!c)return ''; return c[0]==='+'?c.slice(1)+'+':c.slice(1); }

async function _rnCargarTabla(){
  try{
    const snap=await window._fb.getDoc(window._fb.doc(fbDB,'records','data'));
    if(snap.exists()&&(snap.data().classic||snap.data().equipped))return JSON.parse(JSON.stringify(snap.data()));
  }catch(e){ console.warn('[récords nac] firestore',e); }
  return fetch('records.json',{cache:'no-store'}).then(r=>r.json());
}

function _rnDetectar(tabla){
  const LBL={sq:'SENTADILLA',bp:'PRESS DE BANCA',dl:'PESO MUERTO',total:'TOTAL'};
  const mejor=new Map();       // un casillero, un récord: el más alto de esta competencia
  _cierreAtletas().filter(a=>!a.__is4).forEach(a=>{
    const tipo=_rnTipo(a); if(!tipo)return;
    const cat=_rnCat(a); if(!cat)return;
    const sx=_srSexo(a)==='F'?'Mujer':'Hombre';
    const divPropia=tipo==='universitario'?'Universitario':_normDiv(a.div||'');
    const divs=tipo==='universitario'?['Universitario']:[divPropia].concat(divPropia==='Open'?[]:['Open']);
    // La división de su edad también: un Junior inscrito en Open rompe el Junior.
    { const de=_divPorEdad(a); if(tipo!=='universitario'&&de&&divs.indexOf(de)<0)divs.push(de); }
    const marcas={sq:bestOf(a,'sq'),bp:bestOf(a,'bp'),dl:bestOf(a,'dl'),total:totalOf(a,'meet')};
    Object.keys(marcas).forEach(l=>{
      const w=+marcas[l]||0; if(w<=0)return;
      divs.forEach(dv=>{
        const lista=((tabla[tipo]||{})[l])||[];
        const act=lista.filter(x=>_normDiv(String(x.division||''))===dv&&String(x.categoria)===cat
          &&(!x.sexo||x.sexo===sx)).sort((x,y)=>(+y.marca||0)-(+x.marca||0))[0]||null;
        if(act&&!(w>(+act.marca||0)))return;
        const k=[tipo,l,dv,cat].join('|');
        const prev=mejor.get(k);
        if(prev&&prev.w>=w)return;
        mejor.set(k,{k,tipo,l,lbl:LBL[l],div:dv,cat,sexo:sx,w,a,act,marcado:!!act});
      });
    });
  });
  const ORD={classic:0,equipped:1,universitario:2}, LO={sq:0,bp:1,dl:2,total:3};
  return [...mejor.values()].sort((x,y)=>(ORD[x.tipo]-ORD[y.tipo])||(x.sexo<y.sexo?-1:x.sexo>y.sexo?1:0)
    ||(_actaCatN(x.cat)-_actaCatN(y.cat))||String(x.div).localeCompare(String(y.div))||(LO[x.l]-LO[y.l]));
}

// Escribe en records/data los récords elegidos. Relee la tabla justo antes: si
// alguien la editó desde el admin mientras tanto, no se le pisa el cambio.
// Devuelve la lista de los que de verdad se actualizaron.
async function _rnAplicar(elegidos){
  const tabla=await _rnCargarTabla();
  const ev=(DATA.event&&DATA.event.name)||'';
  const hoy=new Date().toISOString().slice(0,10);
  const hechos=[];
  elegidos.forEach(r=>{
    tabla[r.tipo]=tabla[r.tipo]||{}; const lista=tabla[r.tipo][r.l]=tabla[r.tipo][r.l]||[];
    const mismo=x=>_normDiv(String(x.division||''))===r.div&&String(x.categoria)===r.cat&&(!x.sexo||x.sexo===r.sexo);
    const act=lista.filter(mismo).sort((x,y)=>(+y.marca||0)-(+x.marca||0))[0];
    if(act&&!(r.w>(+act.marca||0)))return;          // ya estaba igual o más alto
    const nuevo={nombre:r.a.name,division:r.div,categoria:r.cat,campeonato:ev,marca:r.w,fecha:hoy};
    if(r.tipo==='universitario'){nuevo.sexo=r.sexo;nuevo.evento=ev;}
    // La marca que se reemplaza queda anotada, para poder decir después "antes
    // era X de Fulano". Si el récord ya lo había subido este mismo campeonato,
    // se conserva el anterior de ANTES del campeonato, no el intermedio.
    if(act){
      nuevo.anterior=(act.campeonato===ev&&act.anterior)?act.anterior
        :{marca:+act.marca||0,nombre:act.nombre||'',campeonato:act.campeonato||act.evento||''};
    }
    tabla[r.tipo][r.l]=lista.filter(x=>!mismo(x)).concat([nuevo]);
    hechos.push(r);
  });
  if(hechos.length)await window._fb.setDoc(window._fb.doc(fbDB,'records','data'),tabla);
  return hechos;
}

function _rnResumen(hechos){
  const TN={classic:'Classic',equipped:'Equipado',universitario:'Universitario'};
  return hechos.map(r=>'• '+TN[r.tipo]+' '+(r.sexo==='Mujer'?'F':'M')+' '+r.div+' '+r.cat+' '+r.lbl+': '+r.w+' — '+r.a.name
    +(r.act?' (antes '+r.act.marca+')':'')).join('\n');
}

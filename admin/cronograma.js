// admin.html — El Cronograma editable: tandas, días y turnos de cada campeonato.
//
// Fuente del panel. El navegador no carga este archivo: carga admin/panel.js,
// que se arma juntando estas fuentes (node herramientas/armar_panel.js).
// Solo define funciones; lo que corre al abrir el panel está en arranque.js.

window.cronoPickEvent=function(ev){
  ST.cronoEv=ev; ST.cronoRows=null;
  if(window._cronoUnsub){try{window._cronoUnsub()}catch(e){}window._cronoUnsub=null;}
  if(ev){
    window._cronoUnsub=onSnapshot(doc(db,'cronograma',ev),(d)=>{
      ST.cronoRows=(d.exists()&&Array.isArray(d.data().rows))?d.data().rows:[];
      ST.cronoHideCoaches=(d.exists()&&d.data().hideCoaches)||false;
      if(ST.view==='cronograma')render();
    },(e)=>{console.warn('[crono]',e.message);ST.cronoRows=[];if(ST.view==='cronograma')render();});
  }
  render();
};

async function cronoSaveDoc(){
  if(!ST.cronoEv)return;
  try{ await setDoc(doc(db,'cronograma',ST.cronoEv),{rows:ST.cronoRows||[],hideCoaches:!!ST.cronoHideCoaches,updatedAt:serverTimestamp()},{merge:true}); }
  catch(e){ showToast('Error guardando: '+e.message,null,true); }
}

window.cronoSet=function(i,field,val){
  const r=(ST.cronoRows||[])[i]; if(!r)return;
  if(field==='h1n'){r.handler1={...(r.handler1||{}),nombre:val};}
  else if(field==='h1c'){r.handler1={...(r.handler1||{}),correo:val};}
  else if(field==='h2n'){r.handler2={...(r.handler2||{}),nombre:val};}
  else if(field==='h2c'){r.handler2={...(r.handler2||{}),correo:val};}
  else r[field]=val;
  cronoSaveDoc();
  if(field==='tarima'||field==='flight'||field==='jornada'||field==='dia')setTimeout(()=>{if(ST.view==='cronograma')render();},50);
};

function _cronoDiaKey(d){ return YLDias.clave(d); }   // compartido/dias.js

function _cronoCmpDia(a,b){ return YLDias.comparar(a,b); }

// Poner el mismo día a todo un flight de una — es como se arma en la práctica:
// el día se decide por tanda, no atleta por atleta.
window.cronoSetFlightDia=function(t,f,actual){
  const d=prompt('Día en que compite el Flight '+f+' (Tarima '+t+')\n\n'
    +'Escríbelo como quieras: "Día 1", "Sábado 8", "8 de agosto"…\nVacío = sin día.', actual||'');
  if(d===null)return;
  let n=0;(ST.cronoRows||[]).forEach(r=>{if(String(r.tarima)===String(t)&&String(r.flight)===String(f)){r.dia=d.trim();n++;}});
  if(n){cronoSaveDoc();showToast(n+' atletas del Flight '+f+' → '+(d.trim()||'sin día'));render();}
};

// Marca AM/PM a TODOS los atletas de un flight (misma tarima + flight) de una vez
window.cronoToggleCoaches=function(v){ ST.cronoHideCoaches=!!v; cronoSaveDoc(); showToast(v?'Entrenador/handlers OCULTOS en el público':'Entrenador/handlers visibles en el público'); };

window.cronoSetFlightJornada=function(t,f,j){
  let n=0;(ST.cronoRows||[]).forEach(r=>{if(String(r.tarima)===String(t)&&String(r.flight)===String(f)){r.jornada=j;n++;}});
  if(n){cronoSaveDoc();showToast(n+' atletas del Flight '+f+' (Tarima '+t+') → '+j);render();}
};

window.cronoClear=async function(){
  if(!ST.cronoEv)return;
  const n=ST.cronoRows?ST.cronoRows.length:0;
  if(!confirm('¿Vaciar TODO el cronograma de este campeonato?\n('+n+' atletas · no afecta inscripciones)'))return;
  if(!confirm('Confirma de nuevo: se borrarán los '+n+' atletas del cronograma.\nEsta acción NO se puede deshacer.'))return;
  ST.cronoRows=[]; await cronoSaveDoc(); showToast('Cronograma vaciado'); render();
};

// Reglas: cada categoría+división JUNTA en un flight · máx 14 por flight · una sola tarima
window.cronoAutoDistribute=async function(){
  const rows=ST.cronoRows||[]; if(!rows.length){showToast('No hay atletas',null,true);return;}
  if(!confirm('Auto-distribuir '+rows.length+' atletas?\n\nReglas del reglamento:\n· Hombres y mujeres en tandas separadas — salvo la de apertura, y solo si no hay otra forma de que ninguna quede bajo 8\n· Una categoría de peso + división de edad NO se parte: va entera en una tanda\n· 8 mínimo, 14 máximo de powerlifting por tanda\n· Only Bench no cuenta para el 14 y puede llevar la tanda hasta 17\n\nUna sola tarima, tandas A, B, C… la primera mitad en AM y la segunda en PM.'))return;
  // Los tres números del reglamento, juntos y con nombre.
  const MIN_PL=8;      // mínimo de powerlifting por tanda
  const MAX_PL=14;     // máximo de powerlifting por tanda
  const MAX_TOT=17;    // tope con los Only Bench encima
  const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  // H=hombre, M=mujer (como en la nómina). Si no hay sexo, se infiere de la categoría (IPF).
  const sexOf=r=>{
    const s=String(r.sexo||'').trim().toLowerCase();
    if(s==='h'||/hom|masc|varon/.test(s))return'H';
    if(s==='m'||/muj|fem/.test(s))return'M';
    const c=parseFloat(String(r.categoria||'').replace(/[^0-9.]/g,''));
    const MUJ=[43,47,52,57,63,69,76,84], HOM=[53,59,66,74,83,93,105,120];
    if(MUJ.includes(c))return'M'; if(HOM.includes(c))return'H'; return '?';
  };
  // Only Bench puro = menciona bench/banca y NO es powerlifting. Sube a tarima
  // una sola vez y por eso no ocupa lugar en el cupo de 14.
  const isBench=m=>{m=(m||'').toLowerCase();return (/bench|banca/.test(m))&&!/powerlifting/.test(m);};
  const nPL=g=>g.filter(r=>!isBench(r.modalidad)).length;
  // Las mujeres abren. Así salió el Regional Centro Sur —tanda A de mujeres,
  // B a E de hombres— y así se levanta en IPF. El código las dejaba al final.
  const srank={M:0,H:1,'?':2};

  // ── Grupos indivisibles ────────────────────────────────────────────────
  // Misma categoría de peso + misma división de edad = un grupo, y un grupo NO
  // se parte. Antes, un grupo de más de 14 se cortaba en pedazos de 14: eso
  // reparte una misma premiación en dos tandas distintas, que es justo lo que
  // hubo que deshacer a mano en el Regional Norte.
  const groups={};
  rows.forEach(r=>{const k=sexOf(r)+'|'+(r.division||'?')+'|'+(r.categoria||'?');(groups[k]=groups[k]||[]).push(r);});
  // De la más liviana a la más pesada, y dentro de cada peso de la más joven a
  // la más vieja: así están armados los cronogramas de la federación. El orden
  // salía al revés porque se comparaba parseFloat('-83 kg'), que da −83: las
  // categorías quedaban de mayor a menor y la competencia arrancaba por los
  // +120. El signo se saca antes de comparar, y el '+120' va después del '-120'.
  const kilos=c=>{const n=parseFloat(String(c||'').replace(/[^0-9.]/g,''));return isNaN(n)?999:(/\+/.test(c)?n+0.5:n);};
  const DIVS=['sub-junior','junior','open','master i','master ii','master iii','master iv'];
  const drank=d=>{const i=DIVS.indexOf(String(d||'').trim().toLowerCase());return i<0?9:i;};
  const keys=Object.keys(groups).sort((a,b)=>{const A=a.split('|'),B=b.split('|');
    return (srank[A[0]]-srank[B[0]])||(kilos(A[2])-kilos(B[2]))||(drank(A[1])-drank(B[1]))||A[1].localeCompare(B[1]);});

  // ── Armado ─────────────────────────────────────────────────────────────
  // Se arma sexo por sexo, y son dos decisiones: CUÁNTAS tandas y CÓMO se
  // reparten. Las dos salen del mismo cálculo, y las dos importan: una tanda de
  // más es cerca de una hora más de competencia, y tandas desparejas hacen
  // jornadas desparejas.
  //
  // Lo que se puede mover y lo que no. El orden de PESO no se toca: la
  // competencia va de la categoría más liviana a la más pesada. Pero dentro de
  // un mismo peso, las divisiones de edad sí se pueden reordenar, y ese permiso
  // es el que hace la diferencia. En el Regional Centro Sur la federación dejó
  // los -93 Open en la tanda D y los -93 Junior en la E; si hubiera respetado
  // el orden de edad, D quedaba en 15 —pasada del tope— y había que abrir una
  // quinta tanda de hombres. Con el movimiento, cuatro tandas de 12·12·13·13.
  //
  // El reparto se busca entero, no tanda a tanda. Cerrar cada tanda al llegar
  // al promedio deja un resto en cada una, y los restos se acumulan al final:
  // así salían tandas de 14 al lado de una de 2. Acá se arma un grafo de
  // CORTES —un corte es "ya están puestos los pesos anteriores y estas
  // divisiones del peso actual"—, de cada corte salen las tandas posibles hacia
  // el siguiente, y se recorre guardando el mejor reparto para cada cantidad de
  // tandas. Después se toma la menor cantidad que alcanza y, entre los repartos
  // de esa cantidad, el más parejo.
  //
  // "Parejo" se mide sumando el cuadrado de cada tanda. Con el total y la
  // cantidad de tandas ya fijos, minimizar esa suma es lo mismo que minimizar
  // lo que cada tanda se aleja del promedio, y tiene la ventaja de no depender
  // de cuántas tandas sean: se calcula una sola vez y sirve para todas.
  const fl=[];   // {sex, rows, grandes:[categorías que solas pasan de 14]}
  const porSexo={};
  keys.forEach(k=>{(porSexo[k.split('|')[0]]=porSexo[k.split('|')[0]]||[]).push(k)});
  for(const sex of Object.keys(porSexo).sort((a,b)=>srank[a]-srank[b])){
    const gs=porSexo[sex];
    // Los grupos, juntados por categoría de peso. Vienen ya ordenados, así que
    // los de un mismo peso quedan seguidos. El tope de 10 divisiones por peso
    // es para que las combinaciones de más abajo no se disparen; con las
    // divisiones que existen (Sub-Junior a Master IV) nunca se llega.
    const pesos=[];
    gs.forEach(k=>{
      const cat=k.split('|')[2], u=pesos[pesos.length-1];
      if(u&&u.cat===cat&&u.ks.length<10)u.ks.push(k); else pesos.push({cat,ks:[k]});
    });
    const W=pesos.length;
    // Cuánta gente suma cada combinación de divisiones dentro de un peso.
    const plM=[],totM=[],cntM=[];
    pesos.forEach(p=>{
      const d=p.ks.length,P=[],T=[],C=[];
      for(let m=0;m<(1<<d);m++){
        let a=0,b=0,c=0;
        for(let i=0;i<d;i++)if(m&(1<<i)){a+=nPL(groups[p.ks[i]]);b+=groups[p.ks[i]].length;c++;}
        P.push(a);T.push(b);C.push(c);
      }
      plM.push(P);totM.push(T);cntM.push(C);
    });
    // Los cortes. Uno por cada (peso, combinación de divisiones ya puestas),
    // más el corte final. La combinación completa de un peso no es un corte
    // propio: es el corte de arranque del peso siguiente.
    const base=[],bw=[],bm=[];
    let nb=0;
    for(let w=0;w<W;w++){
      base.push(nb);
      const lleno=(1<<pesos[w].ks.length)-1;
      for(let m=0;m<lleno;m++){bw.push(w);bm.push(m);}
      nb+=lleno;
    }
    base.push(nb); bw.push(W); bm.push(0); nb++;
    const idC=(w,m)=>{
      while(w<W&&m===(1<<pesos[w].ks.length)-1){w++;m=0;}
      return w>=W?base[W]:base[w]+m;
    };
    // Qué grupos quedan entre dos cortes.
    const entre=(w1,m1,w2,m2)=>{
      const out=[];
      if(w2===w1){const s=m2&~m1;pesos[w1].ks.forEach((k,i)=>{if(s&(1<<i))out.push(k);});return out;}
      pesos[w1].ks.forEach((k,i)=>{if(!(m1&(1<<i)))out.push(k);});
      for(let w=w1+1;w<w2;w++)pesos[w].ks.forEach(k=>out.push(k));
      if(w2<W)pesos[w2].ks.forEach((k,i)=>{if(m2&(1<<i))out.push(k);});
      return out;
    };
    const KMAX=gs.length;
    const costo=[],deW=[],deM=[];
    for(let b=0;b<nb;b++){costo.push(new Array(KMAX+1).fill(Infinity));deW.push(new Array(KMAX+1).fill(-1));deM.push(new Array(KMAX+1).fill(0));}
    costo[idC(0,0)][0]=0;
    for(let b=0;b<nb-1;b++){
      const w=bw[b],mask=bm[b],resto=((1<<pesos[w].ks.length)-1)&~mask;
      for(let k=0;k<KMAX;k++){
        const c0=costo[b][k]; if(c0===Infinity)continue;
        const poner=(b2,p,q,c)=>{
          // Un grupo solo SIEMPRE puede formar tanda: si por sí mismo pasa de
          // 14 no hay dónde partirlo. Los topes rigen de dos grupos en adelante.
          if(c>1&&(p>MAX_PL||q>MAX_TOT))return;
          // Quedar bajo el mínimo de 8 se castiga fuerte: se prefiere cualquier
          // reparto legal antes que ese.
          const cc=c0+p*p+(p>0&&p<MIN_PL?100:0);
          if(cc<costo[b2][k+1]){costo[b2][k+1]=cc;deW[b2][k+1]=w;deM[b2][k+1]=mask;}
        };
        // La tanda se cierra dentro del mismo peso.
        for(let S=resto;S;S=(S-1)&resto)poner(idC(w,mask|S),plM[w][S],totM[w][S],cntM[w][S]);
        // O sigue hacia pesos más altos, llevándose lo que queda de este.
        let aP=plM[w][resto],aQ=totM[w][resto],aC=cntM[w][resto];
        for(let w2=w+1;w2<W;w2++){
          const F=(1<<pesos[w2].ks.length)-1;
          for(let S=F;;S=(S-1)&F){
            poner(idC(w2,S),aP+plM[w2][S],aQ+totM[w2][S],aC+cntM[w2][S]);
            if(!S)break;
          }
          aP+=plM[w2][F];aQ+=totM[w2][F];aC+=cntM[w2][F];
          if(aP>MAX_PL||aQ>MAX_TOT)break;   // más allá ya no cabe nada
        }
      }
    }
    // La menor cantidad de tandas que alcanza, y de esas la más pareja.
    let tandasMinimas=-1;
    for(let k=1;k<=KMAX;k++)if(costo[nb-1][k]<Infinity){tandasMinimas=k;break;}
    const tandas=[];
    if(tandasMinimas>0){
      let b=nb-1,k=tandasMinimas;
      while(k>0){
        const w1=deW[b][k],m1=deM[b][k];
        tandas.unshift(entre(w1,m1,bw[b],bm[b]));
        b=idC(w1,m1); k--;
      }
    }else{
      // No debería pasar: cada grupo suelto es una tanda válida, así que
      // siempre hay reparto. Si igual pasara, mejor eso que un cronograma vacío.
      gs.forEach(k=>tandas.push([k]));
    }
    tandas.forEach(ks=>{
      const f={sex,rows:[],grandes:[]};
      ks.forEach(k=>{
        f.rows=f.rows.concat(groups[k]);
        // Un grupo que POR SÍ SOLO pasa de 14 no se puede partir sin romper la
        // regla, así que queda entero y se avisa: es decisión de la comisión
        // técnica dividir la categoría o correr una tanda más grande.
        if(nPL(groups[k])>MAX_PL)f.grandes.push(k.split('|')[2]+' '+k.split('|')[1]);
      });
      fl.push(f);
    });
  }

  // ── Mínimo de 8 ────────────────────────────────────────────────────────
  // Una tanda de dos personas no se corre. Si quedó corta, se junta con la
  // vecina del MISMO sexo mientras el resultado siga cabiendo en los topes.
  for(let i=0;i<fl.length;i++){
    if(nPL(fl[i].rows)>=MIN_PL)continue;
    // Una tanda de puro Only Bench no se mide contra el mínimo de powerlifting:
    // son los que compiten solo en banca y no ocupan ese cupo.
    if(nPL(fl[i].rows)===0)continue;
    for(const j of [i+1,i-1]){
      const o=fl[j]; if(!o||o.sex!==fl[i].sex)continue;
      if(nPL(fl[i].rows)+nPL(o.rows)>MAX_PL)continue;
      if(fl[i].rows.length+o.rows.length>MAX_TOT)continue;
      o.rows=(j>i?fl[i].rows.concat(o.rows):o.rows.concat(fl[i].rows));
      o.grandes=o.grandes.concat(fl[i].grandes);
      fl.splice(i,1); i--; break;
    }
  }

  // ── Último recurso: la tanda de apertura mixta ─────────────────────────
  // Quince mujeres no se parten: en una tanda son 15 y pasan del tope, en dos
  // son 8+7 y una queda corta. Pasó en el Regional Norte y en el Regional Sur
  // Austral, con quince en los dos.
  //
  // En el Norte la comisión técnica lo resolvió así: a las siete mujeres de la
  // primera tanda les sumó los dos hombres de las categorías más livianas
  // —-59 Sub-Junior y -66 Sub-Junior— y armó una tanda de nueve. Es la ÚNICA
  // tanda mixta de los tres cronogramas que ya se corrieron, y aparece
  // exactamente en este caso: cuando no hay reparto legal de otra forma.
  //
  // Así que acá se hace lo mismo, y solo acá: si una tanda quedó bajo el
  // mínimo, se le pasan grupos enteros de las categorías más livianas del otro
  // sexo, mientras el que los presta no quede corto él. Si no alcanza para
  // llegar a ocho, se deshace y queda como estaba.
  const grpKey=r=>sexOf(r)+'|'+(r.division||'?')+'|'+(r.categoria||'?');
  for(let i=0;i<fl.length;i++){
    const corta=fl[i];
    if(nPL(corta.rows)===0||nPL(corta.rows)>=MIN_PL)continue;
    // Quien presta: la tanda del OTRO sexo con las categorías más livianas.
    const cand=fl.filter(f=>f!==corta&&f.sex!==corta.sex&&nPL(f.rows)>MIN_PL)
      .sort((a,b)=>Math.min(...a.rows.map(r=>kilos(r.categoria)))-Math.min(...b.rows.map(r=>kilos(r.categoria))));
    const don=cand[0]; if(!don)continue;
    // Sus grupos, del más liviano al más pesado: se prestan enteros.
    const porG={};
    don.rows.forEach(r=>{(porG[grpKey(r)]=porG[grpKey(r)]||[]).push(r);});
    const gs=Object.keys(porG).sort((a,b)=>kilos(a.split('|')[2])-kilos(b.split('|')[2]));
    const movidos=[];
    for(const g of gs){
      if(nPL(corta.rows)>=MIN_PL)break;
      const grupo=porG[g];
      if(nPL(don.rows)-nPL(grupo)<MIN_PL)continue;          // el que presta no puede quedar corto
      if(nPL(corta.rows)+nPL(grupo)>MAX_PL)continue;
      if(corta.rows.length+grupo.length>MAX_TOT)continue;
      corta.rows=corta.rows.concat(grupo);
      don.rows=don.rows.filter(r=>grupo.indexOf(r)<0);
      movidos.push(grupo);
    }
    if(nPL(corta.rows)<MIN_PL){
      // No alcanzó: se deshace, mejor una tanda corta que dos tandas tocadas.
      movidos.forEach(grupo=>{
        corta.rows=corta.rows.filter(r=>grupo.indexOf(r)<0);
        don.rows=don.rows.concat(grupo);
      });
    }else if(movidos.length){
      // Mixta: se ordena por peso, sin importar el sexo. Es como quedó la del
      // Norte —-47, -57, -59, -63, -63, -66— y es el orden en que se levanta.
      corta.rows.sort((a,b)=>kilos(a.categoria)-kilos(b.categoria)||drank(a.division)-drank(b.division));
      corta.mixta=true;
      don.rows.sort((a,b)=>kilos(a.categoria)-kilos(b.categoria)||drank(a.division)-drank(b.division));
    }
  }

  // ── Asignar tarima, letra y jornada ────────────────────────────────────
  const half=Math.ceil(fl.length/2);
  fl.forEach((f,idx)=>{
    const jor=idx<half?'AM':'PM', let_=LETTERS[idx%LETTERS.length];
    f.rows.forEach(r=>{r.tarima='1';r.flight=let_;r.jornada=jor;});
  });
  ST.cronoRows=fl.reduce((a,f)=>a.concat(f.rows),[]);
  await cronoSaveDoc();

  // ── Qué salió, y qué hay que mirar ─────────────────────────────────────
  const cortas=fl.filter(f=>nPL(f.rows)>0&&nPL(f.rows)<MIN_PL);
  const largas=fl.filter(f=>nPL(f.rows)>MAX_PL);
  let msg=fl.length+' tandas · '+half+' AM / '+(fl.length-half)+' PM';
  const avisos=[];
  const mixtas=fl.filter(f=>f.mixta);
  if(mixtas.length)avisos.push(mixtas.length+' mixta ('+mixtas.map(f=>LETTERS[fl.indexOf(f)]).join(', ')
    +'): las categorías más livianas del otro sexo, para que ninguna quedara bajo '+MIN_PL);
  if(largas.length)avisos.push(largas.length+' pasan de '+MAX_PL+' ('+largas.map(f=>LETTERS[fl.indexOf(f)]+': '+nPL(f.rows)).join(', ')+') porque una categoría no se puede partir');
  if(cortas.length)avisos.push(cortas.length+' quedan bajo '+MIN_PL+' ('+cortas.map(f=>LETTERS[fl.indexOf(f)]+': '+nPL(f.rows)).join(', ')+') y no se pudieron juntar sin pasarse del tope');
  showToast(msg+(avisos.length?' — revisar: '+avisos.join(' · '):''), null, avisos.length>0);
  if(avisos.length)console.warn('[crono] '+avisos.join('\n'));
  render();
};

window._entrenadorPorRut=_entrenadorPorRut;

function _entrenadorPorRut(eventoId){
  const m={};
  (ST.entInsc||[]).forEach(e=>{
    if(e.evento!==eventoId) return;
    if((e.status||'pending')!=='approved') return;
    (e.atletas||[]).forEach(a=>{ const r=_rutN(a.rut); if(r) m[r]=e.nombre||''; });
  });
  return m;
}

// Rellena la columna en un cronograma que YA está armado, sin rehacerlo: el
// trabajo de acomodar tandas y jornadas no se puede perder por traer un dato.
// Y no pisa lo que ya está escrito — si alguien escribió otro nombre a mano,
// manda esa persona; solo se avisa cuántos no calzan.
window.cronoTraerEntrenadores=async function(){
  if(!ST.cronoEv){showToast('Elige un campeonato primero',null,true);return;}
  const mapa=_entrenadorPorRut(ST.cronoEv);
  const cuantos=Object.keys(mapa).length;
  if(!cuantos){
    showToast('No hay inscripciones de entrenador aprobadas en este campeonato',null,true);
    return {hay:false, puestos:0, distintos:0, sinRut:0};
  }
  let puestos=0, distintos=0, sinRut=0;
  (ST.cronoRows||[]).forEach(r=>{
    const k=_rutN(r.rut);
    if(!k){ if(!r.entrenador)sinRut++; return; }
    const q=mapa[k]; if(!q) return;
    if(!String(r.entrenador||'').trim()){ r.entrenador=q; puestos++; }
    else if(String(r.entrenador).trim()!==q) distintos++;
  });
  if(!puestos&&!distintos){ showToast('No había ninguno que completar'); return {hay:true,puestos,distintos,sinRut}; }
  await cronoSaveDoc(); render();
  showToast(`Entrenador puesto en ${puestos} atleta(s)`
    +(distintos?` · ${distintos} ya tenían otro nombre escrito y se dejaron como estaban`:'')
    +(sinRut?` · ${sinRut} sin RUT en el cronograma, no se pueden cruzar`:''));
  return {hay:true,puestos,distintos,sinRut};
};

window.cronoLoadFromNomina=async function(){
  if(!ST.cronoEv){showToast('Elige un campeonato primero',null,true);return;}
  const evObj=(ST.eventos||[]).find(e=>e.id===ST.cronoEv);
  const evName=evObj?evObj.name:'';
  const list=(ST.inscripciones||[]).filter(i=>(i.evento===evName||i.evento===ST.cronoEv)&&i.status==='approved');
  if(!list.length){showToast('No hay inscripciones aprobadas en este campeonato',null,true);return;}
  if(!confirm('Cargar '+list.length+' atletas desde la nómina (inscripciones aprobadas)?\nReemplaza el cronograma actual de este evento.\nLuego ajustas tarima/flight/jornada y handlers.'))return;
  // OJO: NO usar solo la primera letra de i.sexo — las inscripciones guardan
  // "Masculino"/"Femenino" (a veces "Hombre"/"Mujer"), y "Masculino"[0] es
  // "M", igual que Mujer → todos terminaban marcados "M". Hay que reconocer
  // ambas formas explícitamente.
  const _sexoHM=s=>{s=String(s||'').trim().toLowerCase();return /^(hombre|masculino|m(a|á)sc)/.test(s)?'H':/^(mujer|femenino|fem)/.test(s)?'M':'';};
  // El entrenador viene de lo que ellos mismos declararon al inscribirse. Si en
  // este campeonato no hubo inscripción de entrenadores, queda vacío como antes
  // y se escribe a mano.
  const _entPorRut=_entrenadorPorRut(ST.cronoEv);
  ST.cronoRows=list.map(i=>({
    nombre:i.nombre||'', rut:i.rut||'', division:i.division||'', categoria:i.categoria||'', sexo:_sexoHM(i.sexo),
    club:i.club||'', modalidad:i.modalidad||'', tarima:'1', flight:(i.flight||'A'), jornada:'',
    entrenador:_entPorRut[_rutN(i.rut)]||'', handler1:{nombre:'',correo:''}, handler2:{nombre:'',correo:''}
  })).sort((a,b)=>String(a.flight).localeCompare(String(b.flight))||(a.nombre||'').localeCompare(b.nombre||''));
  await cronoSaveDoc();
  showToast('Cargados '+ST.cronoRows.length+' atletas desde la nómina');
};

// Suma a los atletas aprobados que todavía NO están en el cronograma (por
// nombre), sin tocar a los que ya están — a diferencia de "Cargar desde
// nómina" (que reemplaza todo), esto no pierde el trabajo de acomodar
// flights/handlers ya hecho. Los nuevos entran en flight "A" sin jornada,
// para ubicarlos a mano.
window.cronoAddMissingFromNomina=async function(){
  if(!ST.cronoEv){showToast('Elige un campeonato primero',null,true);return;}
  const evObj=(ST.eventos||[]).find(e=>e.id===ST.cronoEv);
  const evName=evObj?evObj.name:'';
  const list=(ST.inscripciones||[]).filter(i=>(i.evento===evName||i.evento===ST.cronoEv)&&i.status==='approved');
  if(!list.length){showToast('No hay inscripciones aprobadas en este campeonato',null,true);return;}
  const _nn=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
  const _sexoHM=s=>{s=String(s||'').trim().toLowerCase();return /^(hombre|masculino|m(a|á)sc)/.test(s)?'H':/^(mujer|femenino|fem)/.test(s)?'M':'';};
  const yaEsta=new Set((ST.cronoRows||[]).map(r=>_nn(r.nombre)));
  const nuevos=list.filter(i=>!yaEsta.has(_nn(i.nombre)));
  if(!nuevos.length){showToast('No hay atletas nuevos — el cronograma ya tiene a todos los aprobados');return;}
  if(!confirm('Agregar '+nuevos.length+' atleta(s) nuevo(s) al cronograma?\n\n'+nuevos.map(i=>'• '+i.nombre).join('\n')+'\n\nEntran en flight "A" sin jornada — los mueves a mano después. No toca a los que ya están ubicados.'))return;
  const _entPorRut=_entrenadorPorRut(ST.cronoEv);
  ST.cronoRows=(ST.cronoRows||[]).concat(nuevos.map(i=>({
    nombre:i.nombre||'', rut:i.rut||'', division:i.division||'', categoria:i.categoria||'', sexo:_sexoHM(i.sexo),
    club:i.club||'', modalidad:i.modalidad||'', tarima:'1', flight:'A', jornada:'',
    entrenador:_entPorRut[_rutN(i.rut)]||'', handler1:{nombre:'',correo:''}, handler2:{nombre:'',correo:''}
  })));
  await cronoSaveDoc();
  showToast('Agregados '+nuevos.length+' atleta(s) nuevo(s) al cronograma');
};

function _xlsxDownload(aoa, sheetName, filename){
  if(typeof XLSX==='undefined'){ showToast('Excel no cargó (revisa internet)',null,true); return; }
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,(sheetName||'Hoja').slice(0,28));
  XLSX.writeFile(wb, filename);
}

window.cronoExportXlsx=function(){
  const rows=ST.cronoRows||[]; if(!rows.length){showToast('Nada que exportar',null,true);return;}
  const _jr=x=>x==='AM'?0:x==='PM'?1:2;
  const order=rows.map((r,i)=>i).sort((a,b)=>_cronoCmpDia(rows[a].dia,rows[b].dia)||(_jr(rows[a].jornada)-_jr(rows[b].jornada))||String(rows[a].flight).localeCompare(String(rows[b].flight)));
  const head=['Nombre','División','Categoría','Sexo','Club','Modalidad','Día','Flight','Jornada','Entrenador','Handler 1','Correo handler 1','Handler 2','Correo handler 2'];
  const aoa=[head];
  order.forEach(i=>{const r=rows[i];aoa.push([r.nombre||'',r.division||'',r.categoria||'',r.sexo||'',r.club||'',r.modalidad||'',r.dia||'',r.flight||'',r.jornada||'',r.entrenador||'',(r.handler1||{}).nombre||'',(r.handler1||{}).correo||'',(r.handler2||{}).nombre||'',(r.handler2||{}).correo||'']);});
  _xlsxDownload(aoa,'Cronograma','Cronograma_'+(ST.cronoEv||'evento')+'.xlsx');
};

// Importa un cronograma armado en Excel (mismas columnas que exporta cronoExportXlsx,
// detectadas por nombre de encabezado — no importa el orden exacto). Reemplaza el
// cronograma actual del evento seleccionado.
window.cronoImportXlsx=function(){
  if(!ST.cronoEv){showToast('Elige un campeonato primero',null,true);return;}
  if(typeof XLSX==='undefined'){showToast('Excel no cargó (revisa internet)',null,true);return;}
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.xlsx,.xls';
  inp.onchange=async()=>{
    const file=inp.files&&inp.files[0]; if(!file)return;
    try{
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(!aoa.length){showToast('Archivo vacío',null,true);return;}
      const headers=aoa[0].map(h=>String(h||'').trim().toLowerCase());
      const idx=name=>headers.findIndex(h=>h.includes(name));
      const iNombre=idx('nombre'), iDiv=idx('divisi'), iCat=idx('categor'), iSexo=idx('sexo'),
        iClub=idx('club'), iMod=idx('modalidad'), iFlight=idx('flight'), iJor=idx('jornada'),
        iEnt=idx('entrenador'),
        // Ojo: "dia" a secas también matchea "modalidad", así que la columna del
        // día se busca exacta (con o sin tilde).
        iDia=headers.findIndex(h=>/^d[ií]as?$/.test(h)),
        iH1n=headers.findIndex(h=>h.includes('handler 1')&&!h.includes('correo')),
        iH1c=headers.findIndex(h=>h.includes('correo')&&h.includes('1')),
        iH2n=headers.findIndex(h=>h.includes('handler 2')&&!h.includes('correo')),
        iH2c=headers.findIndex(h=>h.includes('correo')&&h.includes('2'));
      if(iNombre<0){showToast('No encontré la columna "Nombre" en el Excel',null,true);return;}
      const rows=aoa.slice(1).filter(r=>r[iNombre]).map(r=>({
        nombre:String(r[iNombre]||'').trim(), division:iDiv>=0?String(r[iDiv]??'').trim():'',
        categoria:iCat>=0?String(r[iCat]??'').trim():'', sexo:iSexo>=0?String(r[iSexo]??'').trim():'',
        club:iClub>=0?String(r[iClub]??'').trim():'', modalidad:iMod>=0?String(r[iMod]??'').trim():'',
        tarima:'1', flight:iFlight>=0?String(r[iFlight]??'').trim()||'A':'A',
        jornada:iJor>=0?String(r[iJor]??'').trim():'',
        dia:iDia>=0?String(r[iDia]??'').trim():'',
        entrenador:iEnt>=0?String(r[iEnt]??'').trim():'',
        handler1:{nombre:iH1n>=0?String(r[iH1n]??'').trim():'',correo:iH1c>=0?String(r[iH1c]??'').trim():''},
        handler2:{nombre:iH2n>=0?String(r[iH2n]??'').trim():'',correo:iH2c>=0?String(r[iH2c]??'').trim():''}
      }));
      if(!rows.length){showToast('No se encontraron filas de atletas en el Excel',null,true);return;}
      if(!confirm('Importar '+rows.length+' atletas desde "'+file.name+'"?\nReemplaza el cronograma actual de este evento.'))return;
      ST.cronoRows=rows;
      await cronoSaveDoc();
      showToast('Importados '+rows.length+' atletas desde Excel');
    }catch(e){console.error(e);showToast('Error leyendo el Excel: '+e.message,null,true);}
  };
  inp.click();
};

window.cronoAddRow=function(){
  ST.cronoRows=ST.cronoRows||[];
  ST.cronoRows.push({nombre:'',division:'',categoria:'',club:'',modalidad:'',tarima:'1',flight:'A',jornada:'',entrenador:'',handler1:{nombre:'',correo:''},handler2:{nombre:'',correo:''}});
  cronoSaveDoc(); render();
};

window.cronoDelRow=function(i){ if(!confirm('Eliminar a este atleta del cronograma?'))return; ST.cronoRows.splice(i,1); cronoSaveDoc(); render(); };

function renderCronoEditor(){
  const evs=(ST.eventos||[]).filter(e=>e.status!=='archived');
  const evOpts=evs.map(e=>`<option value="${esc(e.id)}" ${ST.cronoEv===e.id?'selected':''}>${esc(e.name||e.id)}</option>`).join('');
  let h=`<div class="h1">Cronograma</div>
    <p class="subtitle">Start list editable por campeonato · mueve atletas de tarima/flight y se guarda en vivo</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0">
      <select onchange="cronoPickEvent(this.value)" style="background:rgba(10,22,40,.7);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;min-width:240px">
        <option value="">— Elegir campeonato —</option>${evOpts}
      </select>
      ${ST.cronoEv?`<button onclick="cronoLoadFromNomina()" class="btn btn-g" title="Reemplaza TODO el cronograma actual">Cargar desde nómina</button><button onclick="cronoAddMissingFromNomina()" class="btn btn-g" title="Suma solo los aprobados que todavía no están — no toca a los ya ubicados">+ Nuevos de nómina</button><button onclick="cronoAutoDistribute()" class="btn">Auto-distribuir flights</button><button onclick="cronoTraerEntrenadores()" class="btn" title="Llena la columna Entrenador con lo que los propios entrenadores declararon al inscribirse. No pisa lo que ya está escrito.">Traer entrenadores</button><button onclick="cronoImportXlsx()" class="btn" title="Sube un Excel con las columnas Nombre/División/Categoría/Sexo/Club/Modalidad/Flight/Jornada/Entrenador/Handlers">Importar Excel</button><button onclick="cronoAddRow()" class="btn">+ Atleta</button><button onclick="cronoExportXlsx()" class="btn">Exportar Excel</button><button onclick="cronoClear()" class="btn" style="border-color:var(--red);color:var(--red)">Vaciar</button><label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);cursor:pointer;margin-left:4px"><input type="checkbox" ${ST.cronoHideCoaches?'checked':''} onchange="cronoToggleCoaches(this.checked)"> Ocultar entrenador/handlers en el público</label>`:''}
    </div>`;
  if(!ST.cronoEv) return h+`<div class="card" style="color:var(--muted)">Elige un campeonato para ver y editar su cronograma.</div>`;
  if(ST.cronoRows===null) return h+`<div class="card" style="color:var(--muted)">Cargando…</div>`;
  if(!ST.cronoRows.length) return h+`<div class="card" style="color:var(--muted)">Este campeonato no tiene cronograma. Usa <b>“Cargar desde nómina”</b> (inscripciones aprobadas), <b>“Importar debutantes”</b> (solo debutantes) o <b>“+ Atleta”</b>.</div>`;
  // orden de visualización: jornada (AM/PM), flight
  const _jr=x=>x==='AM'?0:x==='PM'?1:2;
  // Día primero: un campeonato de dos días se lee por día, y adentro por
  // jornada (AM/PM) y flight.
  const order=ST.cronoRows.map((r,i)=>i).sort((a,b)=>{
    const ra=ST.cronoRows[a],rb=ST.cronoRows[b];
    return _cronoCmpDia(ra.dia,rb.dia)||(_jr(ra.jornada)-_jr(rb.jornada))||String(ra.flight).localeCompare(String(rb.flight))||0;
  });
  const flOpts=(cur)=>CRONO_FLIGHTS.concat(CRONO_FLIGHTS.includes(cur)?[]:[cur].filter(Boolean)).map(f=>`<option ${f===cur?'selected':''}>${f}</option>`).join('');
  const inp=(i,f,v,w)=>`<input value="${esc(v||'')}" onchange="cronoSet(${i},'${f}',this.value)" style="width:${w||90}px;background:transparent;border:1px solid var(--border);border-radius:5px;padding:3px 5px;color:var(--text);font-size:11px">`;
  const sSel='background:rgba(10,22,40,.6);border:1px solid var(--border);border-radius:5px;padding:3px;color:var(--text);font-size:11px';
  let _prevFk=null,_colIdx=-1;
  const rows=order.map(i=>{const r=ST.cronoRows[i];
    const _fk=String(r.dia||'')+'|'+String(r.jornada)+'|'+String(r.flight); let _first=false; if(_fk!==_prevFk){_colIdx++;_prevFk=_fk;_first=true;}
    const _blue=_colIdx%2===0; const _bg=_blue?'rgba(59,130,246,.12)':'rgba(196,30,58,.12)'; const _bd=_first?('border-top:3px solid '+(_blue?'rgba(59,130,246,.65)':'rgba(196,30,58,.65)')+';'):'';
    let _hdr='';
    if(_first){
      const _hbg=_blue?'rgba(59,130,246,.30)':'rgba(196,30,58,.30)';
      const _jl=(r.jornada==='AM'||r.jornada==='PM')?(' · '+r.jornada):'';
      const _dl=r.dia?`<span style="color:var(--gold)"> · ${esc(r.dia)}</span>`:'';
      _hdr=`<tr><td colspan="13" style="background:${_hbg};padding:6px 10px;font-family:Oswald;font-weight:700;letter-spacing:1px;font-size:12px">Flight ${esc(r.flight)}${_jl}${_dl} <span style="margin-left:8px;font-weight:400;color:var(--muted)">marcar todo el flight:</span> <button onclick="cronoSetFlightJornada('${esc(r.tarima)}','${esc(r.flight)}','AM')" style="padding:2px 10px;font-size:10px;border-radius:5px;border:1px solid var(--border);background:rgba(59,130,246,.25);color:var(--text);cursor:pointer;font-family:Oswald">AM</button> <button onclick="cronoSetFlightJornada('${esc(r.tarima)}','${esc(r.flight)}','PM')" style="padding:2px 10px;font-size:10px;border-radius:5px;border:1px solid var(--border);background:rgba(196,30,58,.25);color:var(--text);cursor:pointer;font-family:Oswald">PM</button> <button onclick="cronoSetFlightDia('${esc(r.tarima)}','${esc(r.flight)}','${esc(r.dia||'')}')" title="Poner el día a todo este flight" style="padding:2px 10px;font-size:10px;border-radius:5px;border:1px solid rgba(212,168,67,.5);background:rgba(212,168,67,.2);color:var(--text);cursor:pointer;font-family:Oswald">DÍA…</button></td></tr>`;
    }
    return `${_hdr}<tr style="background:${_bg};${_bd}">
    <td>${inp(i,'nombre',r.nombre,128)}</td>
    <td>${inp(i,'division',r.division,64)}</td>
    <td>${inp(i,'categoria',r.categoria,40)}</td>
    <td><select onchange="cronoSet(${i},'sexo',this.value)" style="${sSel}"><option ${!r.sexo?'selected':''}></option><option ${r.sexo==='H'?'selected':''}>H</option><option ${r.sexo==='M'?'selected':''}>M</option></select></td>
    <td>${inp(i,'club',r.club,98)}</td>
    <td>${inp(i,'modalidad',r.modalidad,108)}</td>
    <td>${inp(i,'dia',r.dia,84)}</td>
    <td><select onchange="cronoSet(${i},'flight',this.value)" style="${sSel}">${flOpts(r.flight)}</select></td>
    <td><select onchange="cronoSet(${i},'jornada',this.value)" style="${sSel}"><option value="" ${(r.jornada!=='AM'&&r.jornada!=='PM')?'selected':''}>—</option><option ${r.jornada==='AM'?'selected':''}>AM</option><option ${r.jornada==='PM'?'selected':''}>PM</option></select></td>
    <td>${inp(i,'entrenador',r.entrenador,104)}</td>
    <td>${inp(i,'h1n',(r.handler1||{}).nombre,98)}<br>${inp(i,'h1c',(r.handler1||{}).correo,124)}</td>
    <td>${inp(i,'h2n',(r.handler2||{}).nombre,98)}<br>${inp(i,'h2c',(r.handler2||{}).correo,124)}</td>
    <td><button onclick="cronoDelRow(${i})" style="background:transparent;border:1px solid rgba(239,68,68,.4);color:var(--red);padding:3px 7px;border-radius:5px;font-size:10px;cursor:pointer"><i class=yl-i-cerrar></i></button></td>
  </tr>`;}).join('');
  h+=`<div style="font-size:12px;color:var(--muted);margin-bottom:8px">${ST.cronoRows.length} atletas · cambiar Tarima/Flight mueve al atleta · todo se guarda al instante</div>
    <div class="card" style="padding:0;overflow-x:auto"><table class="tbl" style="white-space:nowrap">
      <tr><th>Nombre</th><th>División</th><th>Cat.</th><th>Sexo</th><th>Club</th><th>Modalidad</th><th>Día</th><th>Flight</th><th>Jornada</th><th>Entrenador</th><th>Handler 1 (nombre / correo)</th><th>Handler 2 (nombre / correo)</th><th></th></tr>
      ${rows}
    </table></div>`;
  return h;
}

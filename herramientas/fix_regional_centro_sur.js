// ═══════════════════════════════════════════════════════════════════
// Regional Centro Sur 2026 — dejar el livecast igual al CRONOGRAMA
// ═══════════════════════════════════════════════════════════════════
// Manda el cronograma: nombre, division, categoria, sexo, club, modalidad,
// tanda y jornada salen de ahi. Al que no este en el cronograma se lo saca.
// Los pesos, intentos y alturas de rack ya cargados NO se tocan.
//
// Se pega en Control en Vivo del Regional Centro Sur, con sesion de admin y
// la pantalla en modo CONTROLADOR. Si algo sale mal: Ctrl+Z deshace.
(async function(){
// nombre | division | categoria | sexo | club | modalidad | tanda | jornada
const F = [
  ["Constanza Estefanía Contreras Roa","Junior","57","Femenino","Himalaya Powerlifting","classic","A","AM"],
  ["Angui Paula Puro Cortez","Junior","63","Femenino","Black Bars","classic","A","AM"],
  ["Cinthya Camila Herrera Aravena","Junior","63","Femenino","Primal Strength","classic","A","AM"],
  ["Constanza Alejandra Quintero Romero","Open","63","Femenino","Wolf Strength","onlybench","A","AM"],
  ["Xaviera del Pilar Navarro Medel","Open","63","Femenino","Athor Powerlifting","classic_bench","A","AM"],
  ["Antonia Isidora Arteaga Reyes","Open","69","Femenino","South Side Club","classic","A","AM"],
  ["Constanza Belén Quezada Pino","Open","69","Femenino","Primal Strength","classic_bench","A","AM"],
  ["Catalina Isidora Valverde Medina","Junior","76","Femenino","Hannya Strength","classic","A","AM"],
  ["Fernanda Valentina López Burgos","Open","76","Femenino","Club Bushido Lifting","classic","A","AM"],
  ["Javiera Catalina Burgos Figueroa","Open","76","Femenino","Los Toros","classic","A","AM"],
  ["Camila Belen Silva Castro","Open","84","Femenino","Primal Strength","classic","A","AM"],
  ["Romy Catalina Echeverría Ortega","Open","84","Femenino","Potencia Muscular CD","classic_bench","A","AM"],
  ["Andres Simón Neira Acevedo","Sub-Junior","66","Masculino","Primal Strength","classic","B","AM"],
  ["Ander Andres Jara Arévalo","Junior","66","Masculino","South Side Club","onlybench","B","AM"],
  ["Joaquin Javier Quintana Valenzuela","Junior","66","Masculino","Primal Strength","classic","B","AM"],
  ["Anthony Lopez Santamaria","Junior","66","Masculino","All Power CD","classic","B","AM"],
  ["Dylan Maximiliano Contreras Mella","Junior","66","Masculino","Primal Strength","classic","B","AM"],
  ["Cristóbal Alonso Astorga González","Open","66","Masculino","South Side Club","classic","B","AM"],
  ["Javier Ignacio López Araya","Open","66","Masculino","Athor Powerlifting","classic","B","AM"],
  ["Sebastian Alejandro Jesús Maldonado Carrillo","Open","66","Masculino","South Side Club","classic_bench","B","AM"],
  ["Sergio Andrés Contreras Martínez","Open","66","Masculino","Primal Strength","classic","B","AM"],
  ["Christian Esteban Sánchez Pardo","Sub-Junior","74","Masculino","Primal Strength","classic","B","AM"],
  ["José Salamanca Ormeño","Sub-Junior","74","Masculino","Himalaya Powerlifting","classic","B","AM"],
  ["Luis Alberto Rivas Vergara","Sub-Junior","74","Masculino","South Side Club","classic","B","AM"],
  ["Cristóbal Ugarte Oviedo","Junior","74","Masculino","Primal Strength","classic","C","AM"],
  ["Eric Martin Meza Antilef","Junior","74","Masculino","South Side Club","classic","C","AM"],
  ["Marco Antonio Quezada Rodríguez","Junior","74","Masculino","Primal Strength","classic","C","AM"],
  ["Maximiliano Chamorro Arenas","Junior","74","Masculino","Primal Strength","classic","C","AM"],
  ["Tomás Ignacio Romero Santillana","Junior","74","Masculino","Primal Strength","classic","C","AM"],
  ["Cristian Antonio Garcia Jimenez","Open","74","Masculino","Club Bushido Lifting","classic","C","AM"],
  ["Nicolas Robert Manuel Barra Troncoso","Open","74","Masculino","Wolf Strength","classic","C","AM"],
  ["Nicolas Matias Quintana Valenzuela","Open","74","Masculino","Primal Strength","classic","C","AM"],
  ["Ronald Rafael Alvarez Palma","Open","74","Masculino","Athor Powerlifting","classic","C","AM"],
  ["Sergio Sylvester Vásquez Balladares","Open","74","Masculino","Himalaya Powerlifting","classic_bench","C","AM"],
  ["Agustin Santiago Olave Cabezas","Sub-Junior","83","Masculino","South Side Club","classic","C","AM"],
  ["Jorge Amaro Orellana Esparza","Sub-Junior","83","Masculino","South Side Club","classic","C","AM"],
  ["Benjamin Adriano Peña González","Junior","83","Masculino","Primal Strength","classic","D","PM"],
  ["Matias Eduardo Vejar Fernández","Junior","83","Masculino","Primal Strength","classic","D","PM"],
  ["Oscar Armando Troncoso Chávez","Junior","83","Masculino","Primal Strength","classic","D","PM"],
  ["Richard Eduardo Yáñez López","Junior","83","Masculino","South Side Club","classic","D","PM"],
  ["David Enrique Rojas Rodríguez","Junior","83","Masculino","Club Bushido Lifting","classic","D","PM"],
  ["Diego Hernan Medina Pozo","Junior","83","Masculino","Wolf Strength","classic","D","PM"],
  ["Ignacio Eduardo Gutierrez Ferrada","Junior","83","Masculino","Himalaya Powerlifting","classic","D","PM"],
  ["Iñigo Maximiliano Jiménez Opazo","Junior","83","Masculino","Club Bushido Lifting","classic","D","PM"],
  ["Ignacio Alonso Navarro Hidalgo","Open","83","Masculino","Himalaya Powerlifting","classic","D","PM"],
  ["José Manuel Pereira Cavieres","Open","83","Masculino","Black Bars","classic","D","PM"],
  ["Arlik Iván Villanueva Pérez","Open","83","Masculino","Athor Powerlifting","classic_bench","D","PM"],
  ["Mario Andrés Lepicheo Garrido","Open","93","Masculino","South Side Club","classic","D","PM"],
  ["Steven Fabrizzio Capurro Palacios","Open","93","Masculino","All Power CD","oe_classic","D","PM"],
  ["Mateo Andrés Cuevas Cisterna","Sub-Junior","120","Masculino","Athor Powerlifting","classic","E","PM"],
  ["Benjamin Ignacio García Pino","Junior","93","Masculino","Hannya Strength","classic","E","PM"],
  ["Marcelo Ismael San Juan Franco","Junior","93","Masculino","Primal Strength","classic","E","PM"],
  ["Bruno Sebastian Sanchez Pardo","Junior","93","Masculino","Primal Strength","classic","E","PM"],
  ["Vicente Mauricio Téllez Leiva","Junior","93","Masculino","Himalaya Powerlifting","classic_bench","E","PM"],
  ["Jonathan Jesus Rodriguez Rodriguez","Junior","105","Masculino","All Power CD","oe_classic","E","PM"],
  ["Sebastian Andres Monje Zuñiga","Open","105","Masculino","South Side Club","classic_bench","E","PM"],
  ["Christopher Matías Martes Carrillo","Open","105","Masculino","South Side Club","classic","E","PM"],
  ["Ariel Emanuel Gutiérrez Carbajal","Open","120","Masculino","All Power CD","oe_classic","E","PM"],
  ["Ignacio andres Bustos Lizana","Open","120","Masculino","All Power CD","classic","E","PM"],
  ["Jorge Andres Pinto Muñoz","Open","120","Masculino","Himalaya Powerlifting","classic_bench","E","PM"],
  ["Sebastian Manuel Flores Jadue","Open","120","Masculino","Potencia Muscular CD","classic","E","PM"],
  ["José Eduardo Gaete Duarte","Master I","120","Masculino","All Power CD","classic","E","PM"],
];
const CRONO = F.map(r=>({n:r[0],div:r[1],cat:r[2],sex:r[3],club:r[4],mod:r[5],fl:r[6],jor:r[7]}));

  const nrm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const pal = s => new Set(nrm(s).split(' ').filter(Boolean));

  if(typeof DATA==='undefined' || !DATA.athletes || !DATA.athletes.length)
    return alert('Abri primero Control en Vivo del Regional Centro Sur.');
  // Una pantalla en modo LECTURA no escribe en Firebase: los cambios se verian
  // en este navegador y al rato el servidor los devolveria como estaban.
  if(typeof isAdmin==='undefined' || !isAdmin || !window.IS_CONTROLLER)
    return alert('Esta pantalla esta en modo LECTURA, no puede guardar.\n\n'
      +'Agregale ?controller=1 a la URL (o toca "CAMBIAR A CONTROLADOR" en el aviso de arriba), '
      +'recarga y volve a pegar el script.');
  const ev = (DATA.event&&(DATA.event.name||DATA.event.id))||'';
  if(!/centro\s*sur/i.test(ev) && !confirm('El evento abierto es "'+ev+'", no parece el Regional Centro Sur.\n\nSeguir igual?')) return;

  // Emparejar 1 a 1 por palabras del nombre en comun (en el livecast varios
  // estan con el nombre abreviado, por eso no alcanza con comparar el texto).
  const libres = DATA.athletes.map((a,i)=>i), par = {};
  CRONO.forEach((x,i)=>{
    const wx = pal(x.n); let best=null, bs=0;
    libres.forEach(j=>{
      let s=0; pal(DATA.athletes[j].name).forEach(w=>{ if(wx.has(w)) s++; });
      if(s>bs){ best=j; bs=s; }
    });
    if(best!==null && bs>=2){ par[i]=best; libres.splice(libres.indexOf(best),1); }
  });

  const cambios=[], sinPareja=[], borrados=[];
  CRONO.forEach((x,i)=>{
    if(par[i]===undefined){ sinPareja.push(x.n); return; }
    const a = DATA.athletes[par[i]], d=[];
    const set=(campo,valor,etq)=>{ if(String(a[campo]||'')!==String(valor)){ d.push(etq+': "'+(a[campo]||'')+'" -> "'+valor+'"'); a[campo]=valor; } };
    set('name',x.n,'nombre'); set('div',x.div,'division'); set('cat',x.cat,'categoria');
    set('mod',x.mod,'modalidad'); set('flight',x.fl,'tanda'); set('jornada',x.jor,'jornada');
    set('sex',x.sex,'sexo'); set('club',x.club,'club');
    // Marcar la edicion para que un snapshot que llegue justo ahora no la pise.
    if(d.length){ cambios.push(x.n+' — '+d.join(' · ')); _markAtt(a.id,'meta'); }
  });
  libres.slice().sort((a,b)=>b-a).forEach(j=>{
    borrados.push(DATA.athletes[j].name+' ('+DATA.athletes[j].div+' '+DATA.athletes[j].cat+'kg, tanda '+DATA.athletes[j].flight+')');
    DATA.athletes.splice(j,1);
  });

  console.log('%c'+cambios.length+' atletas corregidos','font-weight:bold');
  cambios.forEach(c=>console.log('  '+c));
  if(borrados.length){ console.log('%c'+borrados.length+' eliminados (no estan en el cronograma)','font-weight:bold;color:#c00');
    borrados.forEach(c=>console.log('  '+c)); }
  if(sinPareja.length){ console.log('%cEstan en el cronograma y NO en el livecast — hay que agregarlos a mano:','font-weight:bold;color:#c60');
    sinPareja.forEach(c=>console.log('  '+c)); }

  // Escritura AUTORITATIVA: reemplaza el documento en vez de mergearlo. Sin esto
  // el borrado no viaja — el merge conserva a los que estan en el servidor y no
  // en local, asi que el eliminado volvia con el primer snapshot.
  R();
  let ok=false;
  for(let intento=1; intento<=3 && !ok; intento++){
    window._forceFullWrite = true;
    try{ await syncToFB(); }catch(e){ console.warn('escritura fallida', e); }
    await new Promise(r=>setTimeout(r,1200));
    try{
      const snap = await window._fb.getDoc(window._fb.doc(fbDB,'livecast_sync',fbDocId()));
      const rem = JSON.parse((snap.data()||{}).athletes||'[]');
      ok = rem.length===CRONO.length && CRONO.every(x=>rem.some(a=>a.name===x.n && a.div===x.div
              && String(a.cat)===x.cat && a.mod===x.mod && a.flight===x.fl));
      console.log('verificacion '+intento+': el servidor tiene '+rem.length+' atletas · '+(ok?'COINCIDE con el cronograma':'todavia NO coincide'));
    }catch(e){ console.warn('no se pudo verificar', e); break; }
  }

  alert((ok?'Listo y verificado en el servidor.':'OJO: se aplico local pero el servidor no confirmo. Mira la consola.')
        +'\n\n'+cambios.length+' corregidos\n'+borrados.length+' eliminados\n'
        +sinPareja.length+' del cronograma sin atleta en el livecast\n'
        +DATA.athletes.length+' atletas quedan cargados.\n\nEl detalle esta en la consola (F12).');
})();

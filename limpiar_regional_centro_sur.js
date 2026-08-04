// ═══════════════════════════════════════════════════════════════════
// Regional Centro Sur — sacar a los atletas que NO son de este campeonato
// ═══════════════════════════════════════════════════════════════════
// Se cruzaron rosters: al documento del Regional entraron 24 atletas del
// Sudamericano de prueba. Este script deja SOLO a los 62 del cronograma y no
// toca nada de ellos (pesos, intentos, pesaje, racks quedan como están).
//
// Se pega en Control en Vivo del Regional Centro Sur, con sesion de admin y la
// pantalla en modo CONTROLADOR. Si algo sale mal: Ctrl+Z deshace.
(async function(){
const DEL_CRONOGRAMA = [
  "Constanza Estefanía Contreras Roa",
  "Angui Paula Puro Cortez",
  "Cinthya Camila Herrera Aravena",
  "Constanza Alejandra Quintero Romero",
  "Xaviera del Pilar Navarro Medel",
  "Antonia Isidora Arteaga Reyes",
  "Constanza Belén Quezada Pino",
  "Catalina Isidora Valverde Medina",
  "Fernanda Valentina López Burgos",
  "Javiera Catalina Burgos Figueroa",
  "Camila Belen Silva Castro",
  "Romy Catalina Echeverría Ortega",
  "Andres Simón Neira Acevedo",
  "Ander Andres Jara Arévalo",
  "Joaquin Javier Quintana Valenzuela",
  "Anthony Lopez Santamaria",
  "Dylan Maximiliano Contreras Mella",
  "Cristóbal Alonso Astorga González",
  "Javier Ignacio López Araya",
  "Sebastian Alejandro Jesús Maldonado Carrillo",
  "Sergio Andrés Contreras Martínez",
  "Christian Esteban Sánchez Pardo",
  "José Salamanca Ormeño",
  "Luis Alberto Rivas Vergara",
  "Cristóbal Ugarte Oviedo",
  "Eric Martin Meza Antilef",
  "Marco Antonio Quezada Rodríguez",
  "Maximiliano Chamorro Arenas",
  "Tomás Ignacio Romero Santillana",
  "Cristian Antonio Garcia Jimenez",
  "Nicolas Robert Manuel Barra Troncoso",
  "Nicolas Matias Quintana Valenzuela",
  "Ronald Rafael Alvarez Palma",
  "Sergio Sylvester Vásquez Balladares",
  "Agustin Santiago Olave Cabezas",
  "Jorge Amaro Orellana Esparza",
  "Benjamin Adriano Peña González",
  "Matias Eduardo Vejar Fernández",
  "Oscar Armando Troncoso Chávez",
  "Richard Eduardo Yáñez López",
  "David Enrique Rojas Rodríguez",
  "Diego Hernan Medina Pozo",
  "Ignacio Eduardo Gutierrez Ferrada",
  "Iñigo Maximiliano Jiménez Opazo",
  "Ignacio Alonso Navarro Hidalgo",
  "José Manuel Pereira Cavieres",
  "Arlik Iván Villanueva Pérez",
  "Mario Andrés Lepicheo Garrido",
  "Steven Fabrizzio Capurro Palacios",
  "Mateo Andrés Cuevas Cisterna",
  "Benjamin Ignacio García Pino",
  "Marcelo Ismael San Juan Franco",
  "Bruno Sebastian Sanchez Pardo",
  "Vicente Mauricio Téllez Leiva",
  "Jonathan Jesus Rodriguez Rodriguez",
  "Sebastian Andres Monje Zuñiga",
  "Christopher Matías Martes Carrillo",
  "Ariel Emanuel Gutiérrez Carbajal",
  "Ignacio andres Bustos Lizana",
  "Jorge Andres Pinto Muñoz",
  "Sebastian Manuel Flores Jadue",
  "José Eduardo Gaete Duarte",
];
  const nrm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const pal = s => new Set(nrm(s).split(' ').filter(Boolean));

  if(typeof DATA==='undefined' || !DATA.athletes || !DATA.athletes.length)
    return alert('Abri primero Control en Vivo del Regional Centro Sur.');
  if(typeof isAdmin==='undefined' || !isAdmin || !window.IS_CONTROLLER)
    return alert('Esta pantalla esta en modo LECTURA, no puede guardar.\n\n'
      +'Agregale ?controller=1 a la URL, recarga y volve a pegar el script.');
  const ev = (DATA.event&&(DATA.event.name||DATA.event.id))||'';
  if(!/centro\s*sur/i.test(ev) && !confirm('El evento abierto es "'+ev+'".\nNo parece el Regional Centro Sur. Seguir igual?')) return;

  // Un atleta es del cronograma si comparte 2+ palabras del nombre con alguno
  // de la lista (en el livecast varios estan con el nombre abreviado).
  const esDelCrono = nom => {
    const w = pal(nom);
    return DEL_CRONOGRAMA.some(n => {
      let s=0; pal(n).forEach(x=>{ if(w.has(x)) s++; });
      return s>=2;
    });
  };

  const fuera = DATA.athletes.filter(a=>!esDelCrono(a.name));
  if(!fuera.length){ return alert('No hay atletas de mas: los '+DATA.athletes.length+' son del cronograma.'); }
  const det = fuera.map(a=>'• '+a.name+'  ('+(a.div||'')+' '+(a.cat||'')+', tanda '+(a.flight||'')+')').join('\n');
  if(!confirm('Se van a ELIMINAR '+fuera.length+' atletas que no estan en el cronograma:\n\n'+det
    +'\n\nQuedan '+(DATA.athletes.length-fuera.length)+'. ¿Confirmas?')) return;

  const ids=new Set(fuera.map(a=>a.id));
  DATA.athletes = DATA.athletes.filter(a=>!ids.has(a.id));
  // Limpiar timers colgados de los que se van
  Object.keys(DATA.changeTimers||{}).forEach(k=>{ if(ids.has(parseInt(k,10))) delete DATA.changeTimers[k]; });
  if(DATA.forcedCurrent!=null && ids.has(DATA.forcedCurrent)) DATA.forcedCurrent=null;
  // Y las marcas de edicion reciente, que son las que causaron el cruce
  try{ window._recentAtt={}; if(window._pendingEdits)window._pendingEdits.clear(); }catch(e){}

  console.log('%cEliminados '+fuera.length,'font-weight:bold;color:#c00');
  fuera.forEach(a=>console.log('  '+a.name));

  R();
  let ok=false;
  for(let intento=1; intento<=3 && !ok; intento++){
    window._forceFullWrite = true;                 // reemplaza el documento, no lo mergea
    try{ await syncToFB(); }catch(e){ console.warn('escritura fallida', e); }
    await new Promise(r=>setTimeout(r,1200));
    try{
      const snap = await window._fb.getDoc(window._fb.doc(fbDB,'livecast_sync',fbDocId()));
      const rem = JSON.parse((snap.data()||{}).athletes||'[]');
      ok = rem.length===DATA.athletes.length && rem.every(a=>esDelCrono(a.name));
      console.log('verificacion '+intento+': el servidor tiene '+rem.length+' atletas · '+(ok?'TODOS del cronograma':'todavia NO'));
    }catch(e){ console.warn('no se pudo verificar', e); break; }
  }
  alert((ok?'Listo y verificado en el servidor.':'OJO: se aplico local pero el servidor no confirmo. Mira la consola.')
        +'\n\n'+fuera.length+' eliminados\n'+DATA.athletes.length+' atletas quedan cargados.');
})();

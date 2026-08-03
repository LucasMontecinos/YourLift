// ══════════════════════════════════════════════════════════════════
// Regional Centro Sur 2026 — dejar el livecast igual al CRONOGRAMA
// ══════════════════════════════════════════════════════════════════
// Manda el cronograma: nombre, division, categoria, modalidad, tanda,
// jornada, sexo y club salen de ahi. Al que no este en el cronograma se
// lo saca. Los pesos, intentos y alturas de rack ya cargados NO se tocan.
//
// Se pega en Control en Vivo del Regional Centro Sur, con sesion de admin
// y la pantalla en modo CONTROLADOR. Si algo sale mal: Ctrl+Z deshace.
(async function(){
  const CRONO = [
 {
  "n": "Constanza Estefanía Contreras Roa",
  "div": "Junior",
  "cat": "57",
  "sex": "Femenino",
  "club": "Himalaya Powerlifting",
  "mod": "classic",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Angui Paula Puro Cortez",
  "div": "Junior",
  "cat": "63",
  "sex": "Femenino",
  "club": "Black Bars",
  "mod": "classic",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Cinthya Camila Herrera Aravena",
  "div": "Junior",
  "cat": "63",
  "sex": "Femenino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Constanza Alejandra Quintero Romero",
  "div": "Open",
  "cat": "63",
  "sex": "Femenino",
  "club": "Wolf Strength",
  "mod": "onlybench",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Xaviera del Pilar Navarro Medel",
  "div": "Open",
  "cat": "63",
  "sex": "Femenino",
  "club": "Athor Powerlifting",
  "mod": "classic_bench",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Antonia Isidora Arteaga Reyes",
  "div": "Open",
  "cat": "69",
  "sex": "Femenino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Constanza Belén Quezada Pino",
  "div": "Open",
  "cat": "69",
  "sex": "Femenino",
  "club": "Primal Strength",
  "mod": "classic_bench",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Catalina Isidora Valverde Medina",
  "div": "Junior",
  "cat": "76",
  "sex": "Femenino",
  "club": "Hannya Strength",
  "mod": "classic",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Fernanda Valentina López Burgos",
  "div": "Open",
  "cat": "76",
  "sex": "Femenino",
  "club": "Club Bushido Lifting",
  "mod": "classic",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Javiera Catalina Burgos Figueroa",
  "div": "Open",
  "cat": "76",
  "sex": "Femenino",
  "club": "Los Toros",
  "mod": "classic",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Camila Belen Silva Castro",
  "div": "Open",
  "cat": "84",
  "sex": "Femenino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Romy Catalina Echeverría Ortega",
  "div": "Open",
  "cat": "84",
  "sex": "Femenino",
  "club": "Potencia Muscular CD",
  "mod": "classic_bench",
  "fl": "A",
  "jor": "AM"
 },
 {
  "n": "Andres Simón Neira Acevedo",
  "div": "Sub-Junior",
  "cat": "66",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Ander Andres Jara Arévalo",
  "div": "Junior",
  "cat": "66",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "onlybench",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Joaquin Javier Quintana Valenzuela",
  "div": "Junior",
  "cat": "66",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Anthony Lopez Santamaria",
  "div": "Junior",
  "cat": "66",
  "sex": "Masculino",
  "club": "All Power CD",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Dylan Maximiliano Contreras Mella",
  "div": "Junior",
  "cat": "66",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Cristóbal Alonso Astorga González",
  "div": "Open",
  "cat": "66",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Javier Ignacio López Araya",
  "div": "Open",
  "cat": "66",
  "sex": "Masculino",
  "club": "Athor Powerlifting",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Sebastian Alejandro Jesús Maldonado Carrillo",
  "div": "Open",
  "cat": "66",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic_bench",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Sergio Andrés Contreras Martínez",
  "div": "Open",
  "cat": "66",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Christian Esteban Sánchez Pardo",
  "div": "Sub-Junior",
  "cat": "74",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "José Salamanca Ormeño",
  "div": "Sub-Junior",
  "cat": "74",
  "sex": "Masculino",
  "club": "Himalaya Powerlifting",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Luis Alberto Rivas Vergara",
  "div": "Sub-Junior",
  "cat": "74",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "B",
  "jor": "AM"
 },
 {
  "n": "Cristóbal Ugarte Oviedo",
  "div": "Junior",
  "cat": "74",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Eric Martin Meza Antilef",
  "div": "Junior",
  "cat": "74",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Marco Antonio Quezada Rodríguez",
  "div": "Junior",
  "cat": "74",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Maximiliano Chamorro Arenas",
  "div": "Junior",
  "cat": "74",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Tomás Ignacio Romero Santillana",
  "div": "Junior",
  "cat": "74",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Cristian Antonio Garcia Jimenez",
  "div": "Open",
  "cat": "74",
  "sex": "Masculino",
  "club": "Club Bushido Lifting",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Nicolas Robert Manuel Barra Troncoso",
  "div": "Open",
  "cat": "74",
  "sex": "Masculino",
  "club": "Wolf Strength",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Nicolas Matias Quintana Valenzuela",
  "div": "Open",
  "cat": "74",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Ronald Rafael Alvarez Palma",
  "div": "Open",
  "cat": "74",
  "sex": "Masculino",
  "club": "Athor Powerlifting",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Sergio Sylvester Vásquez Balladares",
  "div": "Open",
  "cat": "74",
  "sex": "Masculino",
  "club": "Himalaya Powerlifting",
  "mod": "classic_bench",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Agustin Santiago Olave Cabezas",
  "div": "Sub-Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Jorge Amaro Orellana Esparza",
  "div": "Sub-Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "C",
  "jor": "AM"
 },
 {
  "n": "Benjamin Adriano Peña González",
  "div": "Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Matias Eduardo Vejar Fernández",
  "div": "Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Oscar Armando Troncoso Chávez",
  "div": "Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Richard Eduardo Yáñez López",
  "div": "Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "David Enrique Rojas Rodríguez",
  "div": "Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "Club Bushido Lifting",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Diego Hernan Medina Pozo",
  "div": "Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "Wolf Strength",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Ignacio Eduardo Gutierrez Ferrada",
  "div": "Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "Himalaya Powerlifting",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Iñigo Maximiliano Jiménez Opazo",
  "div": "Junior",
  "cat": "83",
  "sex": "Masculino",
  "club": "Club Bushido Lifting",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Ignacio Alonso Navarro Hidalgo",
  "div": "Open",
  "cat": "83",
  "sex": "Masculino",
  "club": "Himalaya Powerlifting",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "José Manuel Pereira Cavieres",
  "div": "Open",
  "cat": "83",
  "sex": "Masculino",
  "club": "Black Bars",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Arlik Iván Villanueva Pérez",
  "div": "Open",
  "cat": "83",
  "sex": "Masculino",
  "club": "Athor Powerlifting",
  "mod": "classic_bench",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Mario Andrés Lepicheo Garrido",
  "div": "Open",
  "cat": "93",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Steven Fabrizzio Capurro Palacios",
  "div": "Open",
  "cat": "93",
  "sex": "Masculino",
  "club": "All Power CD",
  "mod": "oe_classic",
  "fl": "D",
  "jor": "PM"
 },
 {
  "n": "Mateo Andrés Cuevas Cisterna",
  "div": "Sub-Junior",
  "cat": "120",
  "sex": "Masculino",
  "club": "Athor Powerlifting",
  "mod": "classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Benjamin Ignacio García Pino",
  "div": "Junior",
  "cat": "93",
  "sex": "Masculino",
  "club": "Hannya Strength",
  "mod": "classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Marcelo Ismael San Juan Franco",
  "div": "Junior",
  "cat": "93",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Bruno Sebastian Sanchez Pardo",
  "div": "Junior",
  "cat": "93",
  "sex": "Masculino",
  "club": "Primal Strength",
  "mod": "classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Vicente Mauricio Téllez Leiva",
  "div": "Junior",
  "cat": "93",
  "sex": "Masculino",
  "club": "Himalaya Powerlifting",
  "mod": "classic_bench",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Jonathan Jesus Rodriguez Rodriguez",
  "div": "Junior",
  "cat": "105",
  "sex": "Masculino",
  "club": "All Power CD",
  "mod": "oe_classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Sebastian Andres Monje Zuñiga",
  "div": "Open",
  "cat": "105",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic_bench",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Christopher Matías Martes Carrillo",
  "div": "Open",
  "cat": "105",
  "sex": "Masculino",
  "club": "South Side Club",
  "mod": "classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Ariel Emanuel Gutiérrez Carbajal",
  "div": "Open",
  "cat": "120",
  "sex": "Masculino",
  "club": "All Power CD",
  "mod": "oe_classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Ignacio andres Bustos Lizana",
  "div": "Open",
  "cat": "120",
  "sex": "Masculino",
  "club": "All Power CD",
  "mod": "classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Jorge Andres Pinto Muñoz",
  "div": "Open",
  "cat": "120",
  "sex": "Masculino",
  "club": "Himalaya Powerlifting",
  "mod": "classic_bench",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "Sebastian Manuel Flores Jadue",
  "div": "Open",
  "cat": "120",
  "sex": "Masculino",
  "club": "Potencia Muscular CD",
  "mod": "classic",
  "fl": "E",
  "jor": "PM"
 },
 {
  "n": "José Eduardo Gaete Duarte",
  "div": "Master I",
  "cat": "120",
  "sex": "Masculino",
  "club": "All Power CD",
  "mod": "classic",
  "fl": "E",
  "jor": "PM"
 }
];

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
  const libres = DATA.athletes.map((a,i)=>i);
  const par = {};
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
    const set=(campo,valor,etiqueta)=>{ if(String(a[campo]||'')!==String(valor)){ d.push(etiqueta+': "'+(a[campo]||'')+'" -> "'+valor+'"'); a[campo]=valor; } };
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

  // Escritura AUTORITATIVA: reemplaza el documento en vez de mergearlo. Sin
  // esto el borrado no viaja — el merge conserva a los que estan en el servidor
  // y no en local, asi que el eliminado volvia con el primer snapshot.
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

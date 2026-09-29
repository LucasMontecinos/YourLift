// livecast.html — Documentos de mesa y actas: hojas de rack, pesaje y equipo, papeletas, actas PDF y Excel, medallas y overall.
//
// Este archivo es parte del livecast: se carga como <script> clásico desde
// livecast.html, así que todo lo que define queda global, igual que antes de
// partir el archivo. Solo define funciones: lo que corre al abrir la página
// está en arranque.js, que se carga al final.

// ═══════════════════════════════════════════════════════════
// HOJA DE ALTURA DE RACK PDF  (portrait A4)
// ═══════════════════════════════════════════════════════════
// Los documentos de mesa —pesaje, altura de rack, revisión de equipo y las
// papeletas— se piden igual: todo el campeonato, o un solo día. El día lo pone
// el Cronograma (_diaDeAtleta lee la jornada del atleta) y vacío significa
// todos. Se dejan afuera los cuartos intentos, que son el mismo atleta otra vez
// y meterían una fila duplicada en cada hoja.
function _athDeDia(dia){
  const d=String(dia||'').trim();
  return DATA.athletes.filter(a=>!a.__is4&&(!d||_diaDeAtleta(a)===d));
}

// El día en el nombre del archivo, para no terminar con cuatro "AlturaRack.pdf"
// en la carpeta de descargas sin saber cuál es cuál.
function _sufDiaArchivo(dia,strip){
  const d=String(dia||'').trim();
  return d?('_'+strip(d).replace(/\s+/g,'_')):'';
}

async function _pdfLogosMesa(){
  if(_PDF_LOGOS_MESA)return _PDF_LOGOS_MESA;
  const cargar=src=>new Promise(r=>{
    const i=new Image();i.crossOrigin='anonymous';
    i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src+'?t='+Date.now();
  });
  const [fech,yl]=await Promise.all([
    cargar('fechipo_logo_blanco.png'),
    cargar('yourlift_logo_hd.png'),
  ]);
  return (_PDF_LOGOS_MESA={fech:fech,yl:yl});
}

// Los dibuja uno al lado del otro y dice hasta dónde llegó. Si alguno no cargó
// se salta y el otro corre a la izquierda; si no cargó ninguno, quien llama
// vuelve a escribir "FECHIPO" y la hoja no queda con un hueco.
function _pdfLogosDibuja(doc,logos,x,y,alto){
  let cx=x, puestos=0;
  const poner=(img,aspDef)=>{
    if(!img)return;
    const asp=(img.naturalWidth&&img.naturalHeight)?(img.naturalWidth/img.naturalHeight):aspDef;
    try{ doc.addImage(img,'PNG',cx,y,alto*asp,alto); cx+=alto*asp+2.5; puestos++; }catch(e){}
  };
  poner(logos&&logos.fech,883/265);
  poner(logos&&logos.yl,1400/537);
  return puestos?cx:0;
}

// Si se pidió un día que no tiene a nadie es un error del Cronograma: mejor
// decirlo que bajar un PDF vacío y descubrirlo en la mesa.
function _avisaSinAtletas(n,dia){
  if(n)return false;
  alert(dia?('No hay atletas en '+dia+'. Revisa el Cronograma.')
           :'No hay atletas cargados todavía.');
  return true;
}

async function generateHojaRack(dia,idBoton){
  const btn=document.getElementById(idBoton||'btnHojaRack');
  const rotulo=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Generando...';}
  try{
    if(!window.jspdf){
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    }
    const {jsPDF}=window.jspdf;
    const LG=await _pdfLogosMesa();   // FECHIPO en blanco + YourLift, arriba
    const strip=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\x00-\x7F]/g,'?').trim();

    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const PW=210,PH=297;
    const C=CP;

    // Sort by flight then lot
    const athletes=_athDeDia(dia).sort((a,b)=>{
      if(a.flight!==b.flight)return _cmpFl(a.flight,b.flight);
      return a.lot-b.lot;
    });
    if(_avisaSinAtletas(athletes.length,dia))return;

    // 5 cols — usable 194mm portrait
    // Tanda|Nombre|Rack SQ|Rack BP|Firma
    const cols=[
      {h:'Tanda',   w:18,  align:'center', writable:false},
      {h:'Nombre',  w:90,  align:'left',   writable:false},
      {h:'Rack SQ', w:28,  align:'center', writable:true},
      {h:'Rack BP', w:28,  align:'center', writable:true},
      {h:'Firma',   w:30,  align:'center', writable:true},
    ];
    // 18+90+28+28+30 = 194 ✓
    const totalW=cols.reduce((s,c)=>s+c.w,0);
    const startX=(PW-totalW)/2;

    const drawPageHeader=(cont=false)=>{
      doc.setFillColor(...C.bg);doc.rect(0,0,PW,PH,'F');
      doc.setFillColor(...C.hFill);doc.rect(0,0,PW,14,'F');
      if(!_pdfLogosDibuja(doc,LG,8,3.5,7)){
        doc.setTextColor(...C.hText);doc.setFont('helvetica','bold');doc.setFontSize(12);
        doc.text('FECHIPO',8,9.5);
      }
      doc.setFont('helvetica','normal');doc.setFontSize(9);
      doc.text(strip((DATA.event==null?void 0:DATA.event.name)||'Campeonato').toUpperCase(),PW/2,9.5,{align:'center'});
      doc.setFontSize(8);doc.text(new Date().toLocaleDateString('es-CL'),PW-8,9.5,{align:'right'});
      doc.setFillColor(...C.sub);doc.rect(0,14,PW,8,'F');
      doc.setTextColor(...C.subTx);doc.setFont('helvetica','bold');doc.setFontSize(9);
      doc.text('ALTURA DE RACK'+(cont?' (cont.)':' — '+athletes.length+' atletas'),PW/2,19.5,{align:'center'});
    };

    const drawColHeaders=(y)=>{
      doc.setFillColor(...C.colH);doc.rect(startX,y,totalW,7,'F');
      doc.setTextColor(...C.colTx);doc.setFont('helvetica','bold');doc.setFontSize(7);
      let cx=startX;
      cols.forEach(col=>{
        doc.text(col.h,cx+(col.align==='center'?col.w/2:3),y+4.5,{align:col.align==='center'?'center':'left'});
        cx+=col.w;
      });
      doc.setDrawColor(...C.line);doc.setLineWidth(0.4);doc.line(startX,y+7,startX+totalW,y+7);
    };

    drawPageHeader(false);
    drawColHeaders(26);
    let curY=33;
    let rowIndex=0;
    let lastFlight='';

    athletes.forEach(a=>{
      const rowH=11;
      if(curY+rowH>PH-12){
        doc.addPage();
        drawPageHeader(true);
        drawColHeaders(26);
        curY=33;rowIndex=0;lastFlight='';
      }

      // Flight separator band
      if(a.flight!==lastFlight){
        if(lastFlight!==''){curY+=2;}
        doc.setFillColor(...C.sep);doc.rect(startX,curY,totalW,5,'F');
        doc.setTextColor(...C.sepTx);doc.setFont('helvetica','bold');doc.setFontSize(7);
        doc.text('TANDA '+a.flight,startX+4,curY+3.5);
        curY+=5;
        lastFlight=a.flight;
      }

      doc.setFillColor(...(rowIndex%2===0?C.row0:C.row1));
      doc.rect(startX,curY,totalW,rowH,'F');

      const vals=[
        {t:a.flight||'', bold:true},
        {t:strip(a.name||''), bold:false, align:'left'},
        {t:(function(){const ab={izq:'I',der:'D',ambos:'I+D'}[String(a.sqAbat||'')]||'';return (a.rackSQ?String(a.rackSQ):'')+(ab?' ab:'+ab:'');})(), bold:!!a.rackSQ},
        {t:(function(){const p=parseInt(a.bpPalm,10)||0;return (a.rackBP?String(a.rackBP):'')+(a.bpSeg?' s:'+a.bpSeg:'')+(p>0?' p:'+p:'');})(), bold:!!a.rackBP},
        {t:'', bold:false},
      ];

      let cx=startX;
      cols.forEach((col,ci)=>{
        const cell=vals[ci];
        const ty=curY+rowH/2+2.5;
        doc.setTextColor(...C.text);
        doc.setFont('helvetica',cell.bold?'bold':'normal');
        doc.setFontSize(cell.bold?9:8);
        if(cell.t){
          const al=(cell.align||col.align)==='center'?'center':'left';
          const px=al==='center'?cx+col.w/2:cx+3;
          let txt=cell.t;
          if(ci===1){const maxW=col.w-6;while(txt.length>1&&doc.getTextWidth(txt)>maxW)txt=txt.slice(0,-1);if(txt!==cell.t)txt+='.';}
          doc.text(txt,px,ty,{align:al});
        }
        if(col.writable&&!cell.t){
          doc.setDrawColor(...C.uline);doc.setLineWidth(0.5);
          doc.line(cx+4,curY+rowH-2.5,cx+col.w-4,curY+rowH-2.5);
        }
        doc.setDrawColor(...C.line);doc.setLineWidth(0.15);
        doc.line(cx+col.w,curY,cx+col.w,curY+rowH);
        cx+=col.w;
      });

      doc.setDrawColor(...C.line);doc.setLineWidth(0.2);
      doc.line(startX,curY+rowH,startX+totalW,curY+rowH);
      curY+=rowH;
      rowIndex++;
    });

    const total=doc.internal.getNumberOfPages();
    for(let i=1;i<=total;i++){
      doc.setPage(i);
      doc.setDrawColor(...C.line);doc.setLineWidth(0.3);doc.line(8,PH-8,PW-8,PH-8);
      doc.setTextColor(...C.muted);doc.setFont('helvetica','normal');doc.setFontSize(6);
      doc.text('FECHIPO — Federacion Chilena de Powerlifting',8,PH-3);
      doc.text('Pag. '+i+'/'+total,PW-8,PH-3,{align:'right'});
    }

    const evShort=strip((DATA.event==null?void 0:DATA.event.short)||(DATA.event==null?void 0:DATA.event.name)||'campeonato').replace(/\s+/g,'_');
    doc.save('AlturaRack'+_sufDiaArchivo(dia,strip)+'_'+evShort+'.pdf');
  }catch(err){
    console.error('HojaRack error',err);
    alert('Error al generar hoja de rack: '+err.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=rotulo;}
  }
}

// ═══════════════════════════════════════════════════════════
// HOJA DE REVISIÓN DE EQUIPO PDF  (landscape A4)
// ═══════════════════════════════════════════════════════════
// Modalidad en la que se inscribió el atleta, en corto y sin acentos, para la
// hoja de revisión de equipo. 'equipped_bench' le toca tanto al combinado
// equipado como al Only Bench Equipado puro, así que los separa la bandera
// plusBench, igual que en el resto del livecast.
function _modHojaEquipo(a){
  const m=String(a&&a.mod||'');
  const plus=(typeof _isPlusBench==='function')?_isPlusBench(a):false;
  if(m==='invitado')    return 'INVITADO/A';
  if(m==='oe_classic')  return 'OE';
  if(m==='oe_bench')    return 'OE ONLY BENCH';
  if(m==='onlybench')   return 'ONLY BENCH';
  if(m==='equipped')    return 'EQUIPADO';
  if(m==='classic_bench')  return plus?'CLASSIC + ONLY BENCH':'CLASSIC';
  if(m==='equipped_bench') return plus?'EQUIPADO + ONLY BENCH':'ONLY BENCH EQUIPADO';
  return 'CLASSIC';
}

async function generateHojaEquipo(dia,idBoton){
  const btn=document.getElementById(idBoton||'btnHojaEquipo');
  const rotulo=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Generando...';}
  try{
    if(!window.jspdf){
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    }
    const {jsPDF}=window.jspdf;
    const LG=await _pdfLogosMesa();   // FECHIPO en blanco + YourLift, arriba
    const strip=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\x00-\x7F]/g,'?').trim();

    // Landscape A4: 297 x 210mm — usable 281mm wide, 194mm tall
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const PW=297,PH=210;
    const C=CP;

    // Sort: by flight then by category weight then by name
    const athletes=_athDeDia(dia).sort((a,b)=>{
      if(a.flight!==b.flight)return _cmpFl(a.flight,b.flight);
      const na=parseFloat((a.cat||'').replace(/[^0-9.]/g,''))||999;
      const nb=parseFloat((b.cat||'').replace(/[^0-9.]/g,''))||999;
      return na!==nb?na-nb:a.name.localeCompare(b.name);
    });
    if(_avisaSinAtletas(athletes.length,dia))return;

    // Cols: Tanda|Categoría|Nombre|Singlet|Polera|Cinturón|Rodilleras|Muñequeras|Calzado SQ|Calzado BP|Calzado DL|Calcetas
    // Total usable: 297 - 2*8 = 281mm
    // La columna Nombre se ensancha para que quepa la modalidad entre paréntesis:
    // en revisión de equipo importa saber de una si es classic o equipado, y quién
    // además hace Only Bench. Los milímetros salen de las casillas, que igual
    // quedan de sobra para una marca a mano.
    const cols=[
      {h:'Tanda',      w:14,  align:'center', check:false},
      {h:'Cat.',       w:17,  align:'center', check:false},
      {h:'Nombre (modalidad inscrita)', w:78, align:'left', check:false},
      {h:'Singlet',    w:18,  align:'center', check:true},
      {h:'Polera',     w:18,  align:'center', check:true},
      {h:'Cinturon',   w:18,  align:'center', check:true},
      {h:'Rodilleras', w:20,  align:'center', check:true},
      {h:'Munequeras', w:20,  align:'center', check:true},
      {h:'Calz. SQ',   w:20,  align:'center', check:true},
      {h:'Calz. BP',   w:20,  align:'center', check:true},
      {h:'Calz. DL',   w:20,  align:'center', check:true},
      {h:'Calcetas',   w:18,  align:'center', check:true},
    ];
    // total = 14+17+78+18+18+18+20+20+20+20+20+18 = 281 ✓
    const totalW=cols.reduce((s,c)=>s+c.w,0);
    const startX=(PW-totalW)/2;
    const BOX=11; // checkbox size mm — large enough to write/mark

    const drawPageHeader=(cont=false)=>{
      doc.setFillColor(...C.bg);doc.rect(0,0,PW,PH,'F');
      doc.setFillColor(...C.hFill);doc.rect(0,0,PW,12,'F');
      if(!_pdfLogosDibuja(doc,LG,8,2.8,6.4)){
        doc.setTextColor(...C.hText);doc.setFont('helvetica','bold');doc.setFontSize(11);
        doc.text('FECHIPO',8,8.5);
      }
      doc.setFont('helvetica','normal');doc.setFontSize(9);
      doc.text(strip((DATA.event==null?void 0:DATA.event.name)||'Campeonato').toUpperCase(),PW/2,8.5,{align:'center'});
      doc.setFontSize(8);doc.text(new Date().toLocaleDateString('es-CL'),PW-8,8.5,{align:'right'});
      doc.setFillColor(...C.sub);doc.rect(0,12,PW,7,'F');
      doc.setTextColor(...C.subTx);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
      doc.text('REVISION DE EQUIPO'+(cont?' (cont.)':' — '+athletes.length+' atletas'),PW/2,17,{align:'center'});
    };

    const drawColHeaders=(y)=>{
      doc.setFillColor(...C.colH);doc.rect(startX,y,totalW,7,'F');
      doc.setTextColor(...C.colTx);doc.setFont('helvetica','bold');doc.setFontSize(6.5);
      let cx=startX;
      cols.forEach(col=>{
        doc.text(col.h,cx+(col.align==='center'?col.w/2:2),y+4.5,{align:col.align==='center'?'center':'left'});
        cx+=col.w;
      });
      doc.setDrawColor(...C.line);doc.setLineWidth(0.4);doc.line(startX,y+7,startX+totalW,y+7);
    };

    drawPageHeader(false);
    drawColHeaders(22);
    let curY=29;
    let rowIndex=0;

    athletes.forEach(a=>{
      const rowH=15;
      if(curY+rowH>PH-10){
        doc.addPage();
        drawPageHeader(true);
        drawColHeaders(22);
        curY=29;rowIndex=0;
      }

      doc.setFillColor(...(rowIndex%2===0?C.row0:C.row1));
      doc.rect(startX,curY,totalW,rowH,'F');

      const vals=[
        {t:a.flight||'', bold:true},
        {t:strip(a.cat||''), bold:false},
        {t:strip(a.name||''),bold:false,align:'left'},
        null,null,null,null,null,null,null,null,null,
      ];

      let cx=startX;
      cols.forEach((col,ci)=>{
        const ty=curY+rowH/2+1.5;
        if(col.check){
          // celda vacía — se escribe a mano, sin recuadro interior
        } else {
          const cell=vals[ci];
          if(cell&&cell.t){
            doc.setTextColor(...C.text);
            doc.setFont('helvetica',cell.bold?'bold':'normal');
            doc.setFontSize(cell.bold?8:7);
            const al=(cell.align||col.align)==='center'?'center':'left';
            const px=al==='center'?cx+col.w/2:cx+2;
            let txt=cell.t;
            if(ci===2){
              // Nombre + modalidad entre paréntesis. Si no entra todo, se recorta
              // el NOMBRE y nunca la modalidad, que es el dato que se viene a mirar.
              const lbl=' ('+_modHojaEquipo(a)+')';
              doc.setFontSize(5.6);const wLbl=doc.getTextWidth(lbl);
              doc.setFontSize(7);
              const maxW=col.w-4-wLbl;
              while(txt.length>1&&doc.getTextWidth(txt)>maxW)txt=txt.slice(0,-1);
              if(txt!==cell.t)txt+='.';
              doc.text(txt,px,ty,{align:al});
              const wNom=doc.getTextWidth(txt);
              doc.setFontSize(5.6);doc.setTextColor(...C.muted);
              doc.text(lbl,px+wNom,ty,{align:'left'});
              doc.setTextColor(...C.text);
              cx+=col.w;
              doc.setDrawColor(...C.line);doc.setLineWidth(0.15);
              doc.line(cx,curY,cx,curY+rowH);
              return;
            }
            doc.text(txt,px,ty,{align:al});
          }
        }
        doc.setDrawColor(...C.line);doc.setLineWidth(0.15);
        doc.line(cx+col.w,curY,cx+col.w,curY+rowH);
        cx+=col.w;
      });

      doc.setDrawColor(...C.line);doc.setLineWidth(0.2);
      doc.line(startX,curY+rowH,startX+totalW,curY+rowH);
      curY+=rowH;
      rowIndex++;
    });

    const total=doc.internal.getNumberOfPages();
    for(let i=1;i<=total;i++){
      doc.setPage(i);
      doc.setDrawColor(...C.line);doc.setLineWidth(0.3);doc.line(8,PH-7,PW-8,PH-7);
      doc.setTextColor(...C.muted);doc.setFont('helvetica','normal');doc.setFontSize(6);
      doc.text('FECHIPO — Federacion Chilena de Powerlifting',8,PH-2.5);
      doc.text('Pag. '+i+'/'+total,PW-8,PH-2.5,{align:'right'});
    }

    const evShort=strip((DATA.event==null?void 0:DATA.event.short)||(DATA.event==null?void 0:DATA.event.name)||'campeonato').replace(/\s+/g,'_');
    doc.save('RevisionEquipo'+_sufDiaArchivo(dia,strip)+'_'+evShort+'.pdf');
  }catch(err){
    console.error('HojaEquipo error',err);
    alert('Error al generar hoja de equipo: '+err.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=rotulo;}
  }
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// PAPELETAS DE INTENTOS PDF
//
// Dos versiones de la misma papeleta:
//   · en blanco  → la de siempre, para llenar a mano en la mesa.
//   · con nombre → una por atleta, con el nombre ya impreso tal como está en la
//     nómina. Con 461 atletas, escribir el nombre a mano en cada papeleta es
//     media hora de trabajo y una fuente de nombres ilegibles.
//
// Y se puede pedir un solo día: en el Sudamericano son ocho, y llevar a la mesa
// del día 3 las 461 papeletas para buscar entre ellas las 55 que sirven no tiene
// sentido. `dia` es uno de los que devuelve _diasDelEvento() (los pone el
// Cronograma); vacío = el campeonato entero.
//
// Sale UNA papeleta por atleta, no una por movimiento: las copias las saca la
// impresora. Por eso también se dejan afuera los cuartos intentos, que son
// atletas duplicados y darían dos papeletas a la misma persona.
//
// Los logos: el del CAMPEONATO arriba a la izquierda (el que se subió en la
// ficha del campeonato), y el de YourLift chiquito, como marca de agua, adentro
// de cada cuadradito de intento.
// ═══════════════════════════════════════════════════════════
// Los botones de Documentos llaman a todos los PDF igual —(día, idBotón)—, así
// que las dos versiones de la papeleta entran por la misma puerta que las hojas.
function generatePapeletasNom(dia,idBoton){ return generatePapeletas(true,dia,idBoton); }

function generatePapeletasBco(dia,idBoton){ return generatePapeletas(false,dia,idBoton); }

async function generatePapeletas(conNombre,dia,idBoton){
  const btn=document.getElementById(idBoton||(conNombre?'btnPapeletasNom':'btnPapeletas'));
  const rotulo=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Generando...';}
  try{
    if(!window.jspdf){
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    }
    const {jsPDF}=window.jspdf;
    const strip=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\x00-\x7F]/g,'?').trim();
    // El nombre del atleta va con sus tildes y su ñ: las fuentes base de jsPDF
    // son WinAnsi y las tienen. Solo se saca lo que esa codificación no cubre,
    // para que no aparezca un cuadrito en medio de un apellido.
    const nomPdf=s=>String(s||'').normalize('NFC')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g,'').replace(/\s+/g,' ').trim();

    // Preload logos. Se prueban varias rutas para el logo FECHIPO (cuando exista
    // el archivo oficial, se toma automáticamente). YourLift usa la versión HD.
    // A las rutas locales se les pone anti-caché; a las URL de Firebase Storage
    // no, porque ya traen su propia query (?alt=media&token=…) y una segunda la
    // rompe.
    const loadImg=src=>new Promise(r=>{
      if(!src)return r(null);
      const i=new Image();i.crossOrigin='anonymous';i.onload=()=>r(i);i.onerror=()=>r(null);
      i.src=src+(/^https?:/i.test(src)?'':'?t='+Date.now());
    });
    const loadFirst=async(srcs)=>{for(const s of srcs){const img=await loadImg(s);if(img&&_dibujable(img))return img;}return null;};
    // Una imagen de otro dominio sin CORS carga bien pero envenena el canvas, y
    // jsPDF revienta recién al agregarla. Se comprueba antes, una sola vez, para
    // poder caer al plan B en vez de tirar el PDF entero abajo.
    const _dibujable=img=>{
      try{const c=document.createElement('canvas');c.width=c.height=1;
        c.getContext('2d').drawImage(img,0,0);c.toDataURL();return true;}catch(e){return false;}
    };
    // Logo del campeonato. Manda el que está cargado en su ficha: es el que se
    // ve en todas partes y el que cambia cuando el campeonato cambia de logo.
    // Detrás va un archivo local con el mismo nombre del campeonato, que sirve
    // de red por si el de la ficha no se deja incrustar en el PDF (Storage puede
    // servir la imagen a la pantalla y aun así no habilitar CORS).
    const _evId=String((DATA.event&&DATA.event.id)||'').trim();
    const campSrcs=[];
    const _remoto=(typeof _logoCamp==='function')?_logoCamp():'';
    if(_remoto)campSrcs.push(_remoto);
    if(_evId)campSrcs.push('eventos/'+_evId+'.png','eventos/'+_evId+'.jpg');
    const [fechipoImg,yourliftImg,campCrudo]=await Promise.all([
      loadFirst(['fechipo_logo.png','logo_fechipo.png','promo/assets/fechipo_logo.png']),
      loadFirst(['yourlift_logo_hd.png','YourLift_logo.png']),
      loadFirst(campSrcs),
    ]);
    const _prop=(img,d)=>(img&&img.naturalWidth&&img.naturalHeight)?(img.naturalWidth/img.naturalHeight):d;
    // Los logos vienen con fondo transparente, que es lo que necesitan las
    // pantallas de tarima. jsPDF, en cambio, aplasta la imagen a JPEG y lo
    // transparente le sale NEGRO: el logo del campeonato quedaba como una mancha
    // en cada papeleta. Se apoya sobre blanco —el color del papel— antes de
    // meterlo al PDF, y así el mismo archivo sirve para las dos cosas.
    const _sobreBlanco=img=>{
      if(!img)return null;
      try{
        const c=document.createElement('canvas');
        c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height;
        if(!c.width||!c.height)return img;
        const x=c.getContext('2d');
        x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
        x.drawImage(img,0,0);
        const plano=new Image(); plano.src=c.toDataURL('image/png');
        return plano;
      }catch(e){ return img; }
    };
    const campImg=_sobreBlanco(campCrudo);
    if(campImg&&!campImg.complete)await new Promise(r=>{campImg.onload=r;campImg.onerror=r;});

    // Una papeleta por atleta, ordenadas por lote. Si se pidió un día, solo los
    // que compiten ese día.
    const athletes=_athDeDia(dia).sort((a,b)=>(a.lot||0)-(b.lot||0));
    if(_avisaSinAtletas(athletes.length,dia))return;

    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const PW=210,PH=297;

    // Layout: 2 cols x 4 rows per A4 page
    const COLS=2,ROWS=4;
    const mX=8,mY=8,gX=6,gY=6;
    const cardW=(PW-2*mX-(COLS-1)*gX)/COLS;   // ~94 mm
    const cardH=(PH-2*mY-(ROWS-1)*gY)/ROWS;   // ~65.75 mm
    const pad=3.5;

    // Marca de agua de YourLift adentro de un cuadradito de intento. Solo el
    // logo, sin ningún recuadro detrás: sobre el papel blanco el logo se sostiene
    // igual —la "YOUR" blanca tiene contorno gris, y la "LIFT", la barra y las
    // franjas son rojas y azules—. Va tenue a propósito, porque encima se escribe
    // el kilaje a mano y eso es lo que tiene que leerse.
    const GS=o=>{try{doc.setGState(new doc.GState({opacity:o}));}catch(e){}};
    const marcaAgua=(bX,bY,bW,bH)=>{
      if(!yourliftImg||!doc.GState)return;
      const asp=_prop(yourliftImg,24/8.4);
      let wW=Math.min(bW-3.5,11), wH=wW/asp;
      if(wH>bH-4.5){wH=bH-4.5;wW=wH*asp;}
      const wX=bX+(bW-wW)/2, wY=bY+(bH-wH)/2;
      GS(0.45);
      try{doc.addImage(yourliftImg,'PNG',wX,wY,wW,wH);}catch(e){}
      GS(1);
    };

    const drawCard=(ox,oy,at)=>{
      // ── background & border ──────────────────────────────
      doc.setFillColor(255,255,255);doc.rect(ox,oy,cardW,cardH,'F');
      doc.setDrawColor(150,150,150);doc.setLineWidth(0.35);
      doc.rect(ox,oy,cardW,cardH,'S');

      // ── Name row (solo línea, sin relleno) ────────────────
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(0,0,0);
      const nameLabel='Nombre y Apellido';
      doc.text(nameLabel,ox+pad,oy+8.5);
      const nlW=doc.getTextWidth(nameLabel);
      doc.setDrawColor(0,0,0);doc.setLineWidth(0.35);
      const nomX=ox+pad+nlW+1.5;
      doc.line(nomX,oy+9,ox+cardW-pad,oy+9);
      // Con nombre impreso: el nombre va sobre la línea, tal cual está en la
      // nómina. Se achica solo si no entra — hay nombres de cinco palabras y
      // cortarlos deja al atleta sin apellido.
      if(at){
        const nom=nomPdf(at.name);
        if(nom){
          const anchoLibre=(ox+cardW-pad)-nomX-1;
          let fs=8.5;
          doc.setFont('helvetica','bold');doc.setFontSize(fs);
          while(fs>4.6&&doc.getTextWidth(nom)>anchoLibre){fs-=0.25;doc.setFontSize(fs);}
          doc.setTextColor(0,0,0);
          doc.text(nom,nomX+1,oy+8.3);
        }
      }

      // ── Divider ───────────────────────────────────────────
      doc.setDrawColor(200,200,200);doc.setLineWidth(0.2);
      doc.line(ox+pad,oy+11,ox+cardW-pad,oy+11);

      // ── Logo del campeonato (izquierda) ───────────────────
      // Es el que se subió en la ficha del campeonato. Si no hay ninguno, se
      // vuelve al par FECHIPO + YourLift que traía la papeleta antes, para que
      // el espacio no quede vacío.
      const lX=ox+pad, lY=oy+12.5;
      const zonaW=30, zonaH=18.5;
      let logoZoneW=zonaW+7;
      if(campImg){
        const asp=_prop(campImg,1.4);
        let w=zonaW, h=w/asp;
        if(h>zonaH){h=zonaH;w=h*asp;}
        try{doc.addImage(campImg,'PNG',lX+(zonaW-w)/2,lY+(zonaH-h)/2,w,h);}
        catch(e){/* si no se puede incrustar, queda el espacio en blanco */}
      }else{
        // FECHIPO logo (~4:1). Si no hay archivo de logo, texto negro legible
        // (sobre blanco) en vez del rojo que quedaba flotando.
        const fW2=30, fH2=8;
        const fechipoText=()=>{doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(20,20,20);doc.text('FECHIPO',lX,lY+fH2/2+1.5);};
        if(fechipoImg){try{doc.addImage(fechipoImg,'PNG',lX,lY,fW2,fH2);}catch(e){fechipoText();}}else{fechipoText();}
        // YourLift: el logo tiene partes blancas que se pierden sobre el papel, así que
        // va dentro de un chip oscuro redondeado (como se ve en la web) para que se
        // lea bien. Se usa la versión HD para que imprima nítido.
        const ylW=24, ylH=8.4;
        const ylX=lX, ylY=lY+fH2+2.5;
        const chPad=1.4;
        doc.setFillColor(10,22,40); // #0A1628 (fondo azul oscuro de la marca)
        if(doc.roundedRect)doc.roundedRect(ylX-chPad,ylY-chPad,ylW+2*chPad,ylH+2*chPad,1.2,1.2,'F');
        else doc.rect(ylX-chPad,ylY-chPad,ylW+2*chPad,ylH+2*chPad,'F');
        if(yourliftImg){try{doc.addImage(yourliftImg,'PNG',ylX,ylY,ylW,ylH);}catch(e){
          doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(255,255,255);
          doc.text('YourLift',ylX+ylW/2,ylY+ylH/2+1.5,{align:'center'});
        }}else{
          doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(255,255,255);
          doc.text('YourLift',ylX+ylW/2,ylY+ylH/2+1.5,{align:'center'});
        }
        logoZoneW=Math.max(fW2,ylW)+7;
      }

      // ── Discipline checkboxes (centro) ────────────────────
      const cbX=ox+pad+logoZoneW;
      const discs=[{l:'Sentadilla',dy:0},{l:'Press de Banca',dy:7},{l:'Peso Muerto',dy:14}];
      discs.forEach(d=>{
        const bY=oy+13.5+d.dy;
        doc.setDrawColor(0,0,0);doc.setLineWidth(0.5);
        doc.rect(cbX,bY,5,5,'S');
        doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(0,0,0);
        doc.text(d.l,cbX+7,bY+4);
      });

      // ── Lot number box (derecha, sin relleno) ─────────────
      const lotW=20,lotH=16;
      const lotX=ox+cardW-pad-lotW,lotY=oy+13;
      doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(0,0,0);
      doc.text('N° Lote',lotX+lotW/2,oy+12,{align:'center'});
      doc.setDrawColor(0,0,0);doc.setLineWidth(0.7);
      doc.rect(lotX,lotY,lotW,lotH,'S');

      // ── Divider ───────────────────────────────────────────
      const divY=oy+33;
      doc.setDrawColor(200,200,200);doc.setLineWidth(0.2);
      doc.line(ox+pad,divY,ox+cardW-pad,divY);

      // ── Attempt boxes ─────────────────────────────────────
      const boxes=[{l:'1'},{l:'2'},{l:'3'},{l:'3-1'},{l:'3-2'}];
      const bY=divY+2,bH=13;
      const totalBW=cardW-2*pad;
      const bW=(totalBW-4*1.5)/5;
      boxes.forEach((b,i)=>{
        const bX=ox+pad+i*(bW+1.5);
        marcaAgua(bX,bY,bW,bH);
        doc.setDrawColor(0,0,0);doc.setLineWidth(0.5);
        doc.rect(bX,bY,bW,bH,'S');
        doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(80,80,80);
        doc.text(b.l,bX+bW/2,bY+bH+3.5,{align:'center'});
      });

      // ── Divider ───────────────────────────────────────────
      const div2Y=bY+bH+5.5;
      doc.setDrawColor(200,200,200);doc.setLineWidth(0.2);
      doc.line(ox+pad,div2Y,ox+cardW-pad,div2Y);

      // ── Cat. de Peso | Firma (solo líneas, sin relleno) ───
      const botY=div2Y+5;
      doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(0,0,0);
      doc.text('Cat. de Peso',ox+pad,botY);
      const cpW=doc.getTextWidth('Cat. de Peso');
      doc.setDrawColor(0,0,0);doc.setLineWidth(0.3);
      doc.line(ox+pad+cpW+1.5,botY+0.5,ox+cardW/2-3,botY+0.5);
      const firmaX=ox+cardW/2+1;
      doc.setFont('helvetica','bold');doc.setFontSize(7);
      doc.text('Firma',firmaX,botY);
      const firmW=doc.getTextWidth('Firma');
      doc.line(firmaX+firmW+1.5,botY+0.5,ox+cardW-pad,botY+0.5);
    };

    // ── Render cards: una por atleta. Con nombre impreso o en blanco ──
    const total_cards=athletes.length;
    for(let ai=0;ai<total_cards;ai++){
      const pos=ai%(COLS*ROWS);
      if(pos===0&&ai>0)doc.addPage();
      const col=pos%COLS;
      const row=Math.floor(pos/COLS);
      const ox=mX+col*(cardW+gX);
      const oy=mY+row*(cardH+gY);
      drawCard(ox,oy,conNombre?athletes[ai]:null);
    }

    // ── Cut lines (dashed) on every page ─────────────────
    const totalPg=doc.internal.getNumberOfPages();
    for(let p=1;p<=totalPg;p++){
      doc.setPage(p);
      doc.setDrawColor(180,180,180);doc.setLineWidth(0.15);
      doc.setLineDashPattern([1.5,2],0);
      // vertical cut between columns
      const cutX=mX+cardW+gX/2;
      doc.line(cutX,4,cutX,PH-4);
      // horizontal cuts between rows
      for(let r=1;r<ROWS;r++){
        const cutY=mY+r*(cardH+gY)-gY/2;
        doc.line(4,cutY,PW-4,cutY);
      }
      doc.setLineDashPattern([],0);
    }

    const evShort=strip((DATA.event==null?void 0:DATA.event.short)||(DATA.event==null?void 0:DATA.event.name)||'campeonato').replace(/\s+/g,'_');
    doc.save('Papeletas'+(conNombre?'_con_nombre':'')+_sufDiaArchivo(dia,strip)+'_'+evShort+'.pdf');
  }catch(err){
    console.error('Papeletas error',err);
    alert('Error al generar papeletas: '+err.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=rotulo;}
  }
}

// ═══════════════════════════════════════════════════════════
// HOJA DE PESAJE PDF
// ═══════════════════════════════════════════════════════════
async function generateHojaPesaje(dia,idBoton){
  const btn=document.getElementById(idBoton||'btnHojaPesaje');
  const rotulo=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Generando...';}
  try{
    if(!window.jspdf){
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    }
    const {jsPDF}=window.jspdf;
    const LG=await _pdfLogosMesa();   // FECHIPO en blanco + YourLift, arriba
    const strip=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\x00-\x7F]/g,'?').trim();

    // All athletes sorted by lot
    const athletes=_athDeDia(dia).sort((a,b)=>a.lot-b.lot);
    if(_avisaSinAtletas(athletes.length,dia))return;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const PW=210,PH=297;
    const C=CP;

    // Cols: Tarima|Tanda|Lot#|Nombre|BW|Opener SQ|Opener BP|Opener DL|Ropa Int.|Firma
    // Total usable width: 210 - 2*8 = 194mm
    const cols=[
      {h:'Tarima',    w:16, align:'center', writable:true},
      {h:'Tanda',     w:14, align:'center', writable:false},
      {h:'Lot #',     w:14, align:'center', writable:false},
      {h:'Nombre',    w:52, align:'left',   writable:false},
      {h:'BW',        w:14, align:'center', writable:true},
      {h:'Opener SQ', w:18, align:'center', writable:true},
      {h:'Opener BP', w:18, align:'center', writable:true},
      {h:'Opener DL', w:18, align:'center', writable:true},
      {h:'Ropa Int.', w:16, align:'center', writable:true},
      {h:'Firma',     w:14, align:'center', writable:true},
    ];
    // total = 16+14+14+52+14+18+18+18+16+14 = 194 ✓
    const totalW=cols.reduce((s,c)=>s+c.w,0);
    const startX=(PW-totalW)/2;

    // Group athletes by flight, preserving lot order within each flight
    const flightKeys=[...new Set(athletes.map(a=>a.flight||'').filter(Boolean))].sort(_cmpFl);
    const byFlight=flightKeys.map(fl=>({fl,list:athletes.filter(a=>a.flight===fl)}));
    // Athletes with no flight go to their own group at the end
    const noFlight=athletes.filter(a=>!a.flight);
    if(noFlight.length) byFlight.push({fl:'?',list:noFlight});

    const drawPageHeader=(fl='',cont=false)=>{
      doc.setFillColor(...C.bg);doc.rect(0,0,PW,PH,'F');
      doc.setFillColor(...C.hFill);doc.rect(0,0,PW,14,'F');
      if(!_pdfLogosDibuja(doc,LG,8,3.5,7)){
        doc.setTextColor(...C.hText);doc.setFont('helvetica','bold');doc.setFontSize(12);
        doc.text('FECHIPO',8,9.5);
      }
      doc.setFont('helvetica','normal');doc.setFontSize(9);
      doc.text(strip((DATA.event==null?void 0:DATA.event.name)||'Campeonato').toUpperCase(),PW/2,9.5,{align:'center'});
      doc.setFontSize(8);doc.text(new Date().toLocaleDateString('es-CL'),PW-8,9.5,{align:'right'});
      doc.setFillColor(...C.sub);doc.rect(0,14,PW,8,'F');
      doc.setTextColor(...C.subTx);doc.setFont('helvetica','bold');doc.setFontSize(9);
      const label='HOJA DE PESAJE'+(fl&&fl!=='?'?' — TANDA '+fl:'')+(cont?' (cont.)':'');
      doc.text(label,PW/2,19.5,{align:'center'});
    };

    const drawColHeaders=(y)=>{
      doc.setFillColor(...C.colH);doc.rect(startX,y,totalW,7,'F');
      doc.setTextColor(...C.colTx);doc.setFont('helvetica','bold');doc.setFontSize(6.5);
      let cx=startX;
      cols.forEach(col=>{
        doc.text(col.h,cx+(col.align==='center'?col.w/2:2),y+4.5,{align:col.align==='center'?'center':'left'});
        cx+=col.w;
      });
      doc.setDrawColor(...C.line);doc.setLineWidth(0.4);doc.line(startX,y+7,startX+totalW,y+7);
    };

    byFlight.forEach(({fl,list},fi)=>{
      if(fi>0) doc.addPage();
      drawPageHeader(fl,false);
      drawColHeaders(26);
      let curY=33;
      let rowIndex=0;

      list.forEach(a=>{
        const rowH=10;
        if(curY+rowH>PH-12){
          doc.addPage();
          drawPageHeader(fl,true);
          drawColHeaders(26);
          curY=33;rowIndex=0;
        }

        doc.setFillColor(...(rowIndex%2===0?C.row0:C.row1));
        doc.rect(startX,curY,totalW,rowH,'F');

        const vals=[
          {t:'',        bold:false},
          {t:a.flight||'', bold:true},
          {t:String(a.lot||'—'), bold:true},
          {t:strip(a.name||''), bold:false, align:'left'},
          {t:a.bw>0?String(a.bw):'', bold:a.bw>0},
          {t:(a.att==null?void 0:(a.att.sq==null?void 0:(a.att.sq[0]==null?void 0:a.att.sq[0].w)))>0?String(a.att.sq[0].w):'', bold:false},
          {t:(a.att==null?void 0:(a.att.bp==null?void 0:(a.att.bp[0]==null?void 0:a.att.bp[0].w)))>0?String(a.att.bp[0].w):'', bold:false},
          {t:(a.att==null?void 0:(a.att.dl==null?void 0:(a.att.dl[0]==null?void 0:a.att.dl[0].w)))>0?String(a.att.dl[0].w):'', bold:false},
          {t:'', bold:false},
          {t:'', bold:false},
        ];

        let cx=startX;
        vals.forEach((cell,ci)=>{
          const col=cols[ci];
          const ty=curY+rowH/2+2.5;
          doc.setTextColor(...C.text);
          doc.setFont('helvetica',cell.bold?'bold':'normal');
          doc.setFontSize(cell.bold?8:7);
          if(cell.t){
            const al=(cell.align||col.align)==='center'?'center':'left';
            const px=al==='center'?cx+col.w/2:cx+2;
            let txt=cell.t;
            if(ci===3){const maxW=col.w-4;while(txt.length>1&&doc.getTextWidth(txt)>maxW)txt=txt.slice(0,-1);if(txt!==cell.t)txt+='.';}
            doc.text(txt,px,ty,{align:al});
          }
          if(col.writable&&!cell.t){
            doc.setDrawColor(...C.uline);doc.setLineWidth(0.4);
            doc.line(cx+2,curY+rowH-2,cx+col.w-2,curY+rowH-2);
          }
          doc.setDrawColor(...C.line);doc.setLineWidth(0.1);
          doc.line(cx+col.w,curY,cx+col.w,curY+rowH);
          cx+=col.w;
        });

        doc.setDrawColor(...C.line);doc.setLineWidth(0.2);
        doc.line(startX,curY+rowH,startX+totalW,curY+rowH);
        curY+=rowH;
        rowIndex++;
      });

      // footnote at bottom of last page for this flight
      curY+=4;
      if(curY<PH-16){
        doc.setTextColor(...C.muted);doc.setFont('helvetica','italic');doc.setFontSize(6);
        doc.text('La firma del atleta confirma conformidad con el pesaje y los primeros intentos declarados.',startX,curY);
      }
    });

    const total=doc.internal.getNumberOfPages();
    for(let i=1;i<=total;i++){
      doc.setPage(i);
      doc.setDrawColor(...C.line);doc.setLineWidth(0.3);doc.line(8,PH-8,PW-8,PH-8);
      doc.setTextColor(...C.muted);doc.setFont('helvetica','normal');doc.setFontSize(6);
      doc.text('FECHIPO — Federacion Chilena de Powerlifting',8,PH-3);
      doc.text('Pag. '+i+'/'+total,PW-8,PH-3,{align:'right'});
    }

    const evShort=strip((DATA.event==null?void 0:DATA.event.short)||(DATA.event==null?void 0:DATA.event.name)||'campeonato').replace(/\s+/g,'_');
    doc.save('HojaPesaje'+_sufDiaArchivo(dia,strip)+'_'+evShort+'.pdf');
  }catch(err){
    console.error('HojaPesaje error',err);
    alert('Error al generar hoja de pesaje: '+err.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=rotulo;}
  }
}

// ═══════════════════════════════════════════════════════════
// ACTA PDF — jsPDF + autoTable (lazy loaded)
// ═══════════════════════════════════════════════════════════
// Helper: limpia el texto para jsPDF (que solo soporta ASCII / WinAnsi).
// 1) Quita tildes/acentos por NFD
// 2) Reemplaza símbolos especiales (♀ ♂ — •) por equivalentes ASCII
// 3) Filtra cualquier char fuera de ASCII básico que pueda quedar
function _stripAccentsForPdf(s){
  if(!s)return '';
  let out = String(s).normalize('NFD').replace(/[̀-ͯ]/g,'');  // quita combining marks
  // Reemplazos de símbolos comunes que rompen jsPDF
  const map = {
    '♀':'F', '♂':'M',
    '—':'-', '–':'-', '−':'-',
    '•':'*', '·':'-',
    '“':'"', '”':'"', '‘':"'", '’':"'",
    '…':'...',
    '°':'',
    '✓':'OK', '✗':'X',
    '🥇':'1', '🥈':'2', '🥉':'3',
    '🏋️':'', '⚙️':'', '💪':'', '🏆':'',
    ' ':' '  // non-breaking space → space normal
  };
  out = out.replace(/[♀♂——−•·“”‘’…°✓✗🥇🥈🥉🏋️⚙️💪🏆 ]/gu, c => map[c]||'');
  // Última pasada: cualquier char fuera de ASCII básico (>127) → reemplazar por '?'
  // Esto cubre emojis y símbolos no contemplados arriba
  out = out.replace(/[^\x20-\x7E\n\r\t]/g, '');
  return out;
}

function _crc32(buf){
  let c, tabla=_crc32._t;
  if(!tabla){
    tabla=_crc32._t=new Int32Array(256);
    for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); tabla[n]=c; }
  }
  let crc=-1;
  for(let i=0;i<buf.length;i++) crc=(crc>>>8)^tabla[(crc^buf[i])&0xFF];
  return (crc^-1)>>>0;
}

// ZIP sin compresión: cabecera local + datos por archivo, y el directorio central.
function _zipStore(files){
  const enc=new TextEncoder(), partes=[], dir=[];
  let off=0;
  const u16=n=>[n&255,(n>>8)&255], u32=n=>[n&255,(n>>8)&255,(n>>16)&255,(n>>24)&255];
  files.forEach(f=>{
    const nombre=enc.encode(f.name), data=(typeof f.data==='string')?enc.encode(f.data):f.data;
    const crc=_crc32(data);
    const local=[].concat([80,75,3,4],u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nombre.length),u16(0));
    partes.push(new Uint8Array(local),nombre,data);
    dir.push({nombre,crc,len:data.length,off});
    off+=local.length+nombre.length+data.length;
  });
  const centro=[];
  let clen=0;
  dir.forEach(d=>{
    const h=[].concat([80,75,1,2],u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(d.crc),u32(d.len),u32(d.len),
      u16(d.nombre.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(d.off));
    centro.push(new Uint8Array(h),d.nombre);
    clen+=h.length+d.nombre.length;
  });
  const fin=new Uint8Array([].concat([80,75,5,6],u16(0),u16(0),u16(dir.length),u16(dir.length),u32(clen),u32(off),u16(0)));
  const todo=partes.concat(centro,[fin]);
  const total=todo.reduce((n,p)=>n+p.length,0);
  const out=new Uint8Array(total);
  let i=0; todo.forEach(p=>{out.set(p,i);i+=p.length;});
  return out;
}

function _xe(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function _colLetra(n){ let s=''; n++; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=(n-r-1)/26; } return s; }

// filas: [[{v,s}|null, …], …]   cols: [ancho, …]
function _xlsxDescargar(nombreArchivo, hoja, filas, cols){
  const ESTILOS=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="0"/>
<fonts count="6">
<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
<font><strike/><sz val="11"/><color rgb="FF8C8C8C"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF1A1200"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><color rgb="FF000000"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF7D63A"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFAAAAAA"/></left><right style="thin"><color rgb="FFAAAAAA"/></right><top style="thin"><color rgb="FFAAAAAA"/></top><bottom style="thin"><color rgb="FFAAAAAA"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  let sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  if(cols&&cols.length){
    sheet+='<cols>'+cols.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols>';
  }
  sheet+='<sheetData>';
  filas.forEach((fila,r)=>{
    sheet+='<row r="'+(r+1)+'">';
    (fila||[]).forEach((c,ci)=>{
      if(c===null||c===undefined||c.v===''||c.v===null||c.v===undefined)return;
      const ref=_colLetra(ci)+(r+1), st=c.s?' s="'+c.s+'"':'';
      if(typeof c.v==='number'&&isFinite(c.v)) sheet+='<c r="'+ref+'"'+st+'><v>'+c.v+'</v></c>';
      else sheet+='<c r="'+ref+'"'+st+' t="inlineStr"><is><t xml:space="preserve">'+_xe(c.v)+'</t></is></c>';
    });
    sheet+='</row>';
  });
  sheet+='</sheetData></worksheet>';
  const archivos=[
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      +'<Default Extension="xml" ContentType="application/xml"/>'
      +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      +'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      +'</Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      +'</Relationships>'},
    {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      +'<sheets><sheet name="'+_xe(String(hoja||'Hoja1').slice(0,28))+'" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      +'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      +'</Relationships>'},
    {name:'xl/styles.xml',data:ESTILOS},
    {name:'xl/worksheets/sheet1.xml',data:sheet}
  ];
  const bytes=_zipStore(archivos);
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a'); a.href=url; a.download=nombreArchivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}

function _actaModKey(a){
  const m=String(a.mod||'');
  if(m==='invitado')return 'invitado';   // cuadro aparte, fuera de competencia
  if(m==='oe_classic'||m==='oe_bench')return 'oe';
  // Combinado (PL + Only Bench): su tabla base es la de powerlifting; la de Only
  // Bench se le agrega aparte en _actaGrupos().
  if(_isPlusBench(a))return m==='equipped_bench'?'equipped':'classic';
  if(m==='onlybench'||m==='classic_bench')return 'ob_classic';
  if(m==='equipped_bench')return 'ob_equipped';
  if(m==='equipped')return 'equipped';
  return 'classic';
}

function _actaCatN(c){const s=String(c||'');const n=parseFloat(s.replace(/[^0-9.]/g,''))||999;return n+(s.indexOf('+')>=0?0.5:0);}

function _esNombreDeDia(s){
  const n=String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  if(!n)return false;
  if(/^d[ií]a\s*\d/.test(n))return true;          // "Día 1", "Dia 2"
  if(/^\d{1,2}[\/-]\d{1,2}/.test(n))return true;   // "08/11"
  return _DIAS_ACTA.some(d=>n.indexOf(d)>=0);     // "Sábado", "sabado 8"
}

function _diaDeAtleta(a){
  const j=String((a&&a.jornada)||'');
  // El Sudamericano escribe la jornada como "D1 20/09 · 09:00 · Mujeres -43/-47/-52
  // Classic": el día viene como D1, D2… y no como "Día 1". Es la misma forma que
  // ya lee la fila de días de la planilla (_diaDeTanda), pero acá no se
  // reconocía, así que para el campeonato de ocho días no aparecía NINGÚN día:
  // ni en las actas por día ni en los documentos de la mesa.
  // Se normaliza a "Día N" para que el rótulo en pantalla y el nombre del
  // archivo se lean igual venga escrito de una forma o de la otra.
  const dn=/^\s*D(\d{1,2})\b/.exec(j);
  if(dn)return 'Día '+(+dn[1]);
  const partes=j.split('·').map(x=>x.trim()).filter(Boolean);
  const hallado=partes.find(_esNombreDeDia)||'';
  const m=/^d[ií]a\s*(\d{1,2})\b/i.exec(hallado);
  return m?('Día '+(+m[1])):hallado;
}

// Los días del campeonato, en el orden en que se corren (el de las tandas).
function _diasDelEvento(){
  const out=[];
  DATA.athletes.filter(a=>!a.__is4).slice()
    .sort((x,y)=>_cmpFl(x.flight,y.flight))
    .forEach(a=>{const d=_diaDeAtleta(a);if(d&&out.indexOf(d)<0)out.push(d);});
  return out;
}

// Los atletas que entran al acta.
function _actaAthletes(){
  const d=window._ACTA_DIA||'';
  return _conUni(DATA.athletes.filter(a=>!a.__is4&&(!d||_diaDeAtleta(a)===d)));
}

// Para el título y el nombre del archivo.
function _actaSufijoDia(){ return window._ACTA_DIA?(' · '+window._ACTA_DIA.toUpperCase()):''; }

// Categorías que quedan repartidas entre dos días: si se premia por día, en el
// acta de hoy ese podio sale incompleto. Se avisa antes de generarla.
function _catsPartidas(){
  const porCat=new Map();
  DATA.athletes.filter(a=>!a.__is4).forEach(a=>{
    const d=_diaDeAtleta(a); if(!d)return;
    const k=[_actaModKey(a),_srSexo(a),_normDiv(a.div||''),_srCat(a)].join('|');
    if(!porCat.has(k))porCat.set(k,new Set());
    porCat.get(k).add(d);
  });
  const out=[];
  porCat.forEach((dias,k)=>{ if(dias.size>1)out.push(k.split('|').slice(1).join(' ')); });
  return out;
}

// El acta se arma como la de la IPF: una tabla por MODALIDAD + SEXO + DIVISIÓN +
// CATEGORÍA (ej. "Open -63 kg"), y adentro los atletas ordenados de mayor a menor
// por total. Antes se agrupaba solo por categoría y quedaban Open, Junior y Master
// mezclados en la misma tabla.
function _actaGrupos(){
  const g=new Map();
  _actaAthletes().forEach(a=>{
    // El que compite en PL y en Only Bench sale DOS VECES en el acta: una en la
    // tabla de powerlifting con su total y otra en la de Only Bench con su banca.
    // Es la misma banca en los dos lados — subió a tarima una sola vez.
    const claves=[_actaModKey(a)];
    if(_isPlusBench(a))claves.push(String(a.mod)==='equipped_bench'?'ob_equipped':'ob_classic');
    claves.forEach(mk=>{
      const k=[mk,_srSexo(a),_normDiv(a.div||''),_srCat(a)].join('|');
      if(!g.has(k))g.set(k,[]);
      g.get(k).push(a);
    });
  });
  const out=[];
  g.forEach((arr,k)=>{
    const [mod,sexo,div,cat]=k.split('|');
    const view=(mod.indexOf('ob_')===0)?'bench':'meet';
    const filas=arr.map(a=>{
      const t=totalOf(a,view);
      return {a,total:t,gl:calcGL(t,a.bw,a.sex,_glMod(a),view),view};
    // A igual total gana el más liviano (criterio IPF).
    }).sort((x,y)=>(y.total-x.total)||(x.a.bw-y.a.bw));
    let lugar=0;
    filas.forEach(f=>{ f.lugar=f.total>0?++lugar:0; });
    // Puesto de cada atleta EN CADA MOVIMIENTO dentro de su grupo: es el [n] que
    // va al lado de la mejor marca. Sirve para premiar mejor sentadilla, mejor
    // banca y mejor peso muerto, como en las actas de la IPF.
    const lifts=(view==='bench')?['bp']:['sq','bp','dl'];
    const puesto={};
    lifts.forEach(l=>{
      puesto[l]={};
      filas.map(f=>({id:f.a.id,best:bestOf(f.a,l),bw:f.a.bw})).filter(x=>x.best>0)
        .sort((x,y)=>(y.best-x.best)||(x.bw-y.bw))
        .forEach((x,i)=>{puesto[l][x.id]=i+1;});
    });
    out.push({mod,sexo,div,cat,view,filas,puesto,lifts});
  });
  return out.sort((x,y)=>
    (x.mod===y.mod?0:x.mod<y.mod?-1:1)
    ||(x.sexo===y.sexo?0:x.sexo==='F'?-1:1)
    ||_actaCatN(x.cat)-_actaCatN(y.cat)
    ||((_ACTA_DIVORD[x.div]===undefined?9:_ACTA_DIVORD[x.div])-(_ACTA_DIVORD[y.div]===undefined?9:_ACTA_DIVORD[y.div])));
}

// Título de una tabla: "POWERLIFTING CLASSIC · DAMAS · Open -63 kg"
function _actaTitulo(gr){
  return _ACTA_MOD_N[gr.mod]+'  ·  '+(gr.sexo==='F'?'DAMAS':'CABALLEROS')+'  ·  '+(gr.div||'')+' '+gr.cat+' kg';
}

// Celdas de intentos de un atleta: [{txt, rec}] — rec = fue récord sudamericano
// Intentos de un atleta para el acta. Cada casilla dice el peso y CÓMO se lee:
// válido → en negrita; nulo → gris y tachado (igual que las actas de FESUPO);
// récord → resaltado en amarillo.
function _actaAtts(a,l){
  const out=[];
  const cel=at=>{
    if(!at||!at.w)return {w:'',ok:false,nulo:false,rec:false};
    const ok=at.r==='g';
    return {w:at.w, ok, nulo:at.r==='n', rec:ok&&_srRompe(a,l,at.w).length>0};
  };
  for(let j=0;j<3;j++)out.push(cel((a.att[l]||[])[j]));
  // 4º intento / intento extra: va como una columna más solo si alguien lo tiene
  out.push(Object.assign(cel((a.att[l]||[])[3]),{extra:true}));
  return out;
}

function _actaNombreArchivo(ext){
  const ev=_stripAccentsForPdf((DATA.event==null?void 0:DATA.event.short)||(DATA.event==null?void 0:DATA.event.name)||'competencia').replace(/[^A-Za-z0-9]+/g,'_');
  // El acta de un día lleva el día en el nombre: si no, la del sábado y la del
  // domingo se pisan en la carpeta de descargas.
  const dia=window._ACTA_DIA?('_'+_stripAccentsForPdf(window._ACTA_DIA).replace(/[^A-Za-z0-9]+/g,'_')):'';
  return 'Acta_'+ev+dia+'_'+new Date().toISOString().slice(0,10)+'.'+ext;
}

function _medallasGrupos(){
  // Los invitados compiten fuera de competencia: salen en el acta, en su cuadro
  // aparte, pero no reciben medalla ni cuentan en el medallero.
  return _actaGrupos().filter(gr=>gr.mod!=='invitado').map(gr=>{
    const podios=[];
    const conTotal=gr.filas.filter(f=>f.total>0);
    if(gr.view==='bench'){
      // En banca sola el total ES la banca: una sola premiación, no dos medallas
      // por la misma marca.
      podios.push({tipo:'bp',label:_MED_LBL.bp,
        top:conTotal.slice(0,3).map(f=>({a:f.a,valor:f.total}))});
    }else{
      podios.push({tipo:'total',label:_MED_LBL.total,
        top:conTotal.slice(0,3).map(f=>({a:f.a,valor:f.total}))});
      gr.lifts.forEach(l=>{
        const top=gr.filas
          .map(f=>({a:f.a,valor:bestOf(f.a,l),p:(gr.puesto[l]||{})[f.a.id]}))
          .filter(x=>x.p>=1&&x.p<=3)
          .sort((x,y)=>x.p-y.p);
        podios.push({tipo:l,label:_MED_LBL[l],top});
      });
    }
    // En qué tanda compitió la categoría: la premiación se hace al terminar cada
    // tanda. Si una categoría quedó repartida en dos, lleva las dos ("M / N") y se
    // premia al terminar la última.
    const tandas=[...new Set(gr.filas.map(f=>f.a.flight).filter(Boolean))].sort(_cmpFl);
    return Object.assign({},gr,{podios,titulo:_actaTitulo(gr),tandas,tanda:tandas.join(' / ')||'—'});
  }).filter(gr=>gr.podios.some(p=>p.top.length));
}

// Las categorías juntas por tanda, en el orden en que se corren las tandas.
// Una categoría repartida va con la ÚLTIMA de sus tandas: recién ahí se premia.
function _medallasPorTanda(grupos){
  const m=new Map();
  grupos.forEach(gr=>{
    const k=gr.tandas.length?gr.tandas[gr.tandas.length-1]:'—';
    if(!m.has(k))m.set(k,[]);
    m.get(k).push(gr);
  });
  return [...m.entries()].sort((x,y)=>_cmpFl(x[0],y[0])).map(([tanda,gs])=>{
    let oro=0,plata=0,bronce=0;
    gs.forEach(g=>g.podios.forEach(p=>p.top.forEach((x,i)=>{ if(i===0)oro++; else if(i===1)plata++; else bronce++; })));
    const dia=(typeof _diaDeTanda==='function')?_diaDeTanda(tanda):'';
    return {tanda,grupos:gs,oro,plata,bronce,total:oro+plata+bronce,dia};
  });
}

// Cuántas medallas y de quiénes. `porQuien` agrupa por país en un internacional
// y por club en un nacional: en un nacional todos son de Chile y la tabla por
// país sería una sola fila.
function _medallasDetalle(){
  const grupos=_medallasGrupos();
  const porMod={}, porQuien={};
  let oro=0,plata=0,bronce=0;
  const varios=new Set(DATA.athletes.filter(a=>!a.__is4).map(a=>_ctry(a))).size>1;
  grupos.forEach(gr=>{
    porMod[gr.mod]=porMod[gr.mod]||{oro:0,plata:0,bronce:0,total:0};
    gr.podios.forEach(p=>p.top.forEach((x,i)=>{
      const m=['oro','plata','bronce'][i];
      porMod[gr.mod][m]++; porMod[gr.mod].total++;
      if(i===0)oro++; else if(i===1)plata++; else bronce++;
      const quien=varios?_ctryName(_ctry(x.a)):(x.a.club||'Sin club');
      // Se guarda también el código del país: la tabla muestra el NOMBRE, y de
      // un nombre no se puede sacar la bandera sin adivinar al revés.
      porQuien[quien]=porQuien[quien]||{oro:0,plata:0,bronce:0,total:0,cod:varios?_ctry(x.a):''};
      porQuien[quien][m]++; porQuien[quien].total++;
    }));
  });
  const tabla=Object.entries(porQuien)
    .map(([k,v])=>Object.assign({quien:k},v))
    .sort((x,y)=>(y.oro-x.oro)||(y.plata-x.plata)||(y.bronce-x.bronce)||x.quien.localeCompare(y.quien));
  return {grupos,porMod,tabla,oro,plata,bronce,
          total:oro+plata+bronce,porPais:varios};
}

// Una fila por medalla: así se puede filtrar y contar en la planilla.
function _medallasFilas(){
  const d=_medallasDetalle();
  const filas=[[{v:'Tanda',s:1},{v:'Categoría',s:1},{v:'Premio',s:1},{v:'Puesto',s:1},{v:'Medalla',s:1},
                {v:'Atleta',s:1},{v:d.porPais?'País':'Club',s:1},{v:'Marca',s:1}]];
  // Por tanda: en el orden en que se premia. Por categoría: como siempre.
  const orden=window._MED_POR_TANDA?[].concat(..._medallasPorTanda(d.grupos).map(s=>s.grupos)):d.grupos;
  orden.forEach(gr=>gr.podios.forEach(p=>p.top.forEach((x,i)=>{
    filas.push([{v:gr.tanda},{v:gr.titulo},{v:p.label},{v:i+1},{v:_MED_MET[i]},
                {v:x.a.name||''},{v:d.porPais?_ctryName(_ctry(x.a)):(x.a.club||'')},
                {v:+(+x.valor).toFixed(1)}]);
  })));
  if(window._MED_POR_TANDA){
    filas.push([]);
    filas.push([{v:'MEDALLAS POR TANDA',s:1}]);
    filas.push([{v:'Tanda',s:1},{v:'Categorías',s:1},{v:'Oro',s:1},{v:'Plata',s:1},{v:'Bronce',s:1},{v:'Total',s:1}]);
    _medallasPorTanda(d.grupos).forEach(t=>filas.push([{v:t.tanda},{v:t.grupos.length},{v:t.oro},{v:t.plata},{v:t.bronce},{v:t.total}]));
  }
  filas.push([]);
  filas.push([{v:'RESUMEN',s:1}]);
  filas.push([{v:'Oro'},{v:d.oro}],[{v:'Plata'},{v:d.plata}],[{v:'Bronce'},{v:d.bronce}],
             [{v:'TOTAL',s:1},{v:d.total,s:1}]);
  filas.push([]);
  filas.push([{v:'MEDALLERO POR '+(d.porPais?'PAÍS':'CLUB'),s:1}]);
  filas.push([{v:d.porPais?'País':'Club',s:1},{v:'Oro',s:1},{v:'Plata',s:1},{v:'Bronce',s:1},{v:'Total',s:1}]);
  d.tabla.forEach(r=>filas.push([{v:r.quien},{v:r.oro},{v:r.plata},{v:r.bronce},{v:r.total}]));
  return {filas,d};
}

function _ovPuntos(lugar,total){ if(!(total>0)||!lugar)return 0; return lugar<=9?_OV_PTS[lugar-1]:1; }

function _ovDivOrd(d){ if(d==='Master')d='Master I'; return _ACTA_DIVORD[d]===undefined?9:_ACTA_DIVORD[d]; }

// Masters juntos: en el Sudamericano 2026 el overall y la clasificación por
// países juntaron Master I, II, III y IV en una sola división "Master". Es lo
// que viene marcado; "Por división" las vuelve a separar.
function _ovDiv(d){ return (window._OV.masters!=='sep'&&/^master/i.test(String(d||'')))?'Master':d; }

// Qué hay para elegir, sacado de los resultados.
function _ovOpciones(){
  const divs=new Set(), mods=new Set(), sexos=new Set();
  _actaGrupos().forEach(g=>{ if(g.mod==='invitado')return; divs.add(_ovDiv(g.div)); mods.add(g.mod); sexos.add(g.sexo); });
  return {divs:[...divs].sort((a,b)=>_ovDivOrd(a)-_ovDivOrd(b)),
          mods:[...mods].sort((a,b)=>_OV_MODORD.indexOf(a)-_OV_MODORD.indexOf(b)),sexos:[...sexos]};
}

// ¿La clasificación por equipos va por país o por club? Por país solo en un
// campeonato internacional: con atletas de más de un país en competencia. Los
// invitados no cuentan —un extranjero invitado a un Nacional no lo vuelve
// internacional—. El panel deja cambiarlo a mano (EQUIPOS: POR CLUB / POR PAÍS).
function _ovPorPaisAuto(){
  return new Set(_actaAthletes().filter(a=>String(a.mod||'')!=='invitado').map(a=>_ctry(a))).size>1;
}

function _ovPorPais(){
  const e=window._OV.equipos;
  return e==='pais'?true:e==='club'?false:_ovPorPaisAuto();
}

function _ovDatos(){
  const o=window._OV;
  const varios=_ovPorPais();
  const quien=a=>varios?_ctry(a):(String(a.club||'').trim()||'Sin club');
  const bloques=new Map();
  _actaGrupos().forEach(g=>{
    if(g.mod==='invitado'||g.sexo!==o.sexo)return;
    const dv=_ovDiv(g.div);
    if(o.divs&&o.divs.indexOf(dv)<0)return;
    if(o.mods&&o.mods.indexOf(g.mod)<0)return;
    const k=dv+'|'+g.mod;
    if(!bloques.has(k))bloques.set(k,{div:dv,mod:g.mod,view:g.view,filas:[]});
    g.filas.forEach(f=>bloques.get(k).filas.push({a:f.a,cat:g.cat,total:f.total,gl:f.gl||0,
      lugarCat:f.lugar,pts:_ovPuntos(f.lugar,f.total),quien:quien(f.a)}));
  });
  const out=[...bloques.values()].sort((x,y)=>(_ovDivOrd(x.div)-_ovDivOrd(y.div))
    ||(_OV_MODORD.indexOf(x.mod)-_OV_MODORD.indexOf(y.mod)));
  out.forEach(b=>{
    // Con los masters juntos, el lugar en cada categoría —que da los puntos por
    // país— se vuelve a sacar entre todos los masters de esa categoría, con la
    // misma regla del acta: más total, y a igual total el más liviano.
    if(b.div==='Master'){
      const porCat={};
      b.filas.forEach(f=>{ (porCat[f.cat]=porCat[f.cat]||[]).push(f); });
      Object.keys(porCat).forEach(c=>{
        let n=0;
        porCat[c].slice().sort((x,y)=>(y.total-x.total)||((x.a.bw||0)-(y.a.bw||0)))
          .forEach(f=>{ f.lugarCat=f.total>0?++n:0; f.pts=_ovPuntos(f.lugarCat,f.total); });
      });
    }
    // Overall: por GL; a igual GL, el más liviano. Los que no hicieron total, al final.
    b.filas.sort((x,y)=>((y.total>0)-(x.total>0))||(y.gl-x.gl)||((x.a.bw||0)-(y.a.bw||0)));
    let n=0; b.filas.forEach(f=>{ f.lugar=f.total>0?++n:0; });
    // Países (reglamento IPF): los 5 que más puntos suman de cada uno.
    b.equipos=_ovEquipos(b.filas,f=>f.quien,varios);
    // En Universitario, además, por universidad: es lo que se premia ahí.
    if(/univ/i.test(b.div)){
      b.unis=_ovEquipos(b.filas,f=>String(f.a.uni||'').trim()||('Sin universidad ('+(varios?_ctry(f.a):(f.a.club||'—'))+')'),false);
    }
    b.titulo=(_ACTA_MOD_N[b.mod]||b.mod)+'  ·  '+(o.sexo==='F'?'DAMAS':'CABALLEROS')+'  ·  '+b.div;
  });
  return {bloques:out,porPais:varios};
}

// Clasificación por equipos (IPF) agrupando por lo que diga `clave`: país,
// club o universidad. Desempate IPF: más 1°, luego más 2°, etc. Si aun así
// siguen empatados (el reglamento no dice más), la mejor marca GL del equipo.
function _ovEquipos(filas,clave,conBandera){
  const porQ={};
  filas.forEach(f=>{ const q=clave(f); (porQ[q]=porQ[q]||[]).push(f); });
  const eq=Object.entries(porQ).map(([q,fs])=>{
    const cuentan=fs.filter(f=>f.pts>0).sort((x,y)=>(y.pts-x.pts)||(x.lugarCat-y.lugarCat)).slice(0,5);
    const lugares=Array(10).fill(0);
    cuentan.forEach(f=>{ lugares[Math.min(f.lugarCat,10)-1]++; });
    return {quien:q,cod:conBandera?q:'',puntos:cuentan.reduce((t,f)=>t+f.pts,0),lugares,
            suman:cuentan.length,atletas:fs.length,pais:_ctry(fs[0].a),mejorGL:Math.max(0,...fs.filter(f=>f.total>0).map(f=>+f.gl||0))};
  }).sort((x,y)=>(y.puntos-x.puntos)||(()=>{for(let i=0;i<10;i++){const d=y.lugares[i]-x.lugares[i];if(d)return d;}return 0;})()
    ||(y.mejorGL-x.mejorGL)||x.quien.localeCompare(y.quien));
  let p=0; eq.forEach(e=>{ e.puesto=e.puntos>0?++p:0; });
  return eq;
}

// Filas para Excel/PDF: por cada bloque, su overall y su tabla de países.
function _ovFilas(){
  const d=_ovDatos(), filas=[];
  d.bloques.forEach(b=>{
    filas.push([{v:b.titulo,s:5}]);
    filas.push([{v:'OVERALL · GL POINTS',s:1}]);
    filas.push(['#','Atleta',d.porPais?'País':'Club','Cat.','PC','Total','GL','Pts equipo'].map(v=>({v,s:8})));
    b.filas.forEach(f=>filas.push([{v:f.lugar||'—',s:6},{v:f.a.name||'',s:6},{v:d.porPais?_ctryName(_ctry(f.a)):f.quien,s:6},{v:f.cat,s:6},
      {v:f.a.bw||'',s:6},{v:f.total>0?f.total:'—',s:7},{v:f.total>0?+(+f.gl).toFixed(2):'—',s:7},{v:f.pts||'',s:6}]));
    filas.push([]);
    filas.push([{v:(d.porPais?'PAÍSES':'CLUBES')+' · PUNTOS IPF',s:1}]);
    filas.push(['#',d.porPais?'País':'Club','Puntos','1°','2°','3°','Suman','Atletas'].map(v=>({v,s:8})));
    b.equipos.forEach(e=>filas.push([{v:e.puesto||'—',s:6},{v:e.cod?_ctryName(e.cod):e.quien,s:6},{v:e.puntos,s:7},
      {v:e.lugares[0],s:6},{v:e.lugares[1],s:6},{v:e.lugares[2],s:6},{v:e.suman,s:6},{v:e.atletas,s:6}]));
    if(b.unis){
      filas.push([]);
      filas.push([{v:'UNIVERSIDADES · PUNTOS IPF',s:1}]);
      filas.push(['#','Universidad','País','Puntos','1°','2°','3°','Mejor GL','Suman'].map(v=>({v,s:8})));
      b.unis.forEach(e=>filas.push([{v:e.puesto||'—',s:6},{v:e.quien,s:6},{v:e.pais?_ctryName(e.pais):'',s:6},{v:e.puntos,s:7},
        {v:e.lugares[0],s:6},{v:e.lugares[1],s:6},{v:e.lugares[2],s:6},{v:e.mejorGL?+e.mejorGL.toFixed(2):'—',s:6},{v:e.suman,s:6}]));
    }
    filas.push([]);filas.push([]);
  });
  return {filas,d};
}

function _ovNombre(ext){
  const o=window._OV;
  return _actaNombreArchivo(ext).replace(/^Acta_/,'Overall_'+(_ovPorPais()?'Paises_':'Clubes_')+(o.sexo==='F'?'Mujeres':'Hombres')+'_');
}

function _rbSuda(){
  if(!_srOn())return [];
  const hoy=_srHoyCalc(), out=[];
  Object.keys(hoy).forEach(k=>{
    const h=hoy[k], base=RECSUDA&&RECSUDA[k];
    if(base&&!(h.kg>base.kg))return;
    const [sx,eq,dv,cat,l]=k.split('|');
    const a=DATA.athletes.find(x=>x.id===h.id)||{};
    out.push({sexo:sx==='F'?'Damas':'Caballeros',mod:eq==='equipped'?'Equipado':'Classic',div:dv,cat:cat,mov:_RB_MOV[l]||l,movK:l,
      nuevo:h.kg,atleta:h.quien,pais:_ctry(a),antes:base?base.kg:null,antesQuien:base?(base.quien||''):'',antesPais:base?(base.pais||''):''});
  });
  const LO={sq:0,bp:1,bpsl:2,dl:3,total:4};
  return out.sort((x,y)=>(x.sexo<y.sexo?1:x.sexo>y.sexo?-1:0)||(x.mod<y.mod?-1:x.mod>y.mod?1:0)
    ||(_actaCatN(x.cat)-_actaCatN(y.cat))||((_ACTA_DIVORD[x.div]||9)-(_ACTA_DIVORD[y.div]||9))||(LO[x.movK]-LO[y.movK]));
}

async function _rbNac(){
  const ev=(DATA.event&&DATA.event.name)||'';
  if(/regional/i.test(ev))return [];
  const TN={classic:'Classic',equipped:'Equipado',universitario:'Universitario'};
  const FEM=['43','47','52','57','63','69','76','84','84+'];
  try{
    const tabla=await _rnCargarTabla();
    // records.json es la copia de la tabla de antes del campeonato. Sirve de
    // respaldo para "la marca anterior" de los récords que se guardaron antes de
    // que se empezara a anotar (los primeros cierres del Sudamericano 2026).
    let base=null; try{ base=await fetch('records.json',{cache:'no-store'}).then(r=>r.json()); }catch(e){}
    const antesDeBase=(tipo,l,dv,cat,sexoR,marca)=>{
      const xs=(((base||{})[tipo]||{})[l]||[]).filter(y=>_normDiv(String(y.division||''))===dv&&String(y.categoria)===cat&&(!y.sexo||y.sexo===sexoR));
      const y=xs.sort((p,q)=>(+q.marca||0)-(+p.marca||0))[0];
      return (y&&(+y.marca||0)<marca)?{marca:+y.marca,nombre:y.nombre||'',campeonato:y.campeonato||y.evento||''}:null;
    };
    const m=new Map();
    // Los que ya quedaron guardados con este campeonato: después de Cerrar
    // competencia la tabla ya tiene la marca nueva y la comparación de abajo no
    // los vería como "batidos". Se leen de la tabla, con la marca que reemplazaron.
    Object.keys(TN).forEach(tipo=>['sq','bp','dl','total'].forEach(l=>(((tabla[tipo]||{})[l])||[]).forEach(x=>{
      if((x.campeonato||x.evento)!==ev)return;
      const cat=String(x.categoria), dv=tipo==='universitario'?'Universitario':_normDiv(String(x.division||''));
      const sexo=x.sexo?(x.sexo==='Mujer'?'Damas':'Caballeros'):(FEM.indexOf(cat)>=0?'Damas':'Caballeros');
      const ant=x.anterior||antesDeBase(tipo,l,dv,cat,x.sexo||(FEM.indexOf(cat)>=0?'Mujer':'Hombre'),+x.marca||0);
      m.set([tipo,l,dv,cat].join('|'),{sexo,mod:TN[tipo],div:dv,cat,mov:_RB_MOV[l]||l,nuevo:+x.marca,atleta:x.nombre,pais:'CHI',
        antes:ant?ant.marca:null,antesQuien:ant?(ant.nombre||''):'(no registrado)',antesPais:'',guardado:true});
    })));
    // Y los que todavía no se guardan.
    _rnDetectar(tabla).filter(r=>r.act).forEach(r=>{
      m.set([r.tipo,r.l,r.div,r.cat].join('|'),{sexo:r.sexo==='Mujer'?'Damas':'Caballeros',mod:TN[r.tipo],div:r.div,cat:r.cat,
        mov:_RB_MOV[r.l]||r.l,nuevo:r.w,atleta:r.a.name,pais:'CHI',antes:+r.act.marca,antesQuien:r.act.nombre||'',antesPais:'',guardado:false});
    });
    const ORD={Classic:0,Equipado:1,Universitario:2}, LO={Sentadilla:0,'Press de banca':1,'Peso muerto':2,Total:3};
    return [...m.values()].sort((x,y)=>(ORD[x.mod]-ORD[y.mod])||(x.sexo<y.sexo?1:x.sexo>y.sexo?-1:0)
      ||(_actaCatN(x.cat)-_actaCatN(y.cat))||String(x.div).localeCompare(String(y.div))||((LO[x.mov]||0)-(LO[y.mov]||0)));
  }catch(e){ console.warn('[récords batidos] nac',e); return null; }
}

function _rbSecciones(){
  const rb=window._RB||{suda:[],nac:[]}, out=[];
  if(_srOn())out.push({titulo:'RÉCORDS SUDAMERICANOS',lista:rb.suda||[],pais:true});
  out.push({titulo:'RÉCORDS NACIONALES DE CHILE',lista:rb.nac||[],pais:false});
  return out;
}

function _rbNombre(ext){ return _actaNombreArchivo(ext).replace(/^Acta_/,'Records_'); }

// ── PDF blanco ────────────────────────────────────────────────────
async function exportActaFesupoPDF(){
  const btn=document.getElementById('btnActaFesupo');
  if(btn){btn.disabled=true;btn.textContent='Generando…';}
  const bk=DATA.athletes.map(a=>({ref:a,name:a.name,club:a.club}));
  DATA.athletes.forEach(a=>{a.name=_stripAccentsForPdf(a.name);a.club=_stripAccentsForPdf(a.club);});
  try{
    if(!window.jspdf)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    if(!(window.jspdf==null?void 0:(window.jspdf.jsPDF==null?void 0:(window.jspdf.jsPDF.prototype==null?void 0:window.jspdf.jsPDF.prototype.autoTable))))await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const AMARILLO=[247,214,58], NEGRO=[0,0,0], GRIS=[130,130,130];
    const grupos=_actaGrupos();
    // Columna de procedencia. En un internacional el país es lo que importa; en un
    // campeonato nacional todos ponen CHI y la columna no dice nada, así que ahí va
    // el club, que es lo que la gente busca en el acta. Se decide solo: si hay más
    // de un país en la nómina, manda el país.
    const _paises=new Set(_actaAthletes().map(a=>_ctry(a)).filter(Boolean));
    const _porClub=_paises.size<=1;
    const _proc=a=>_porClub?(a.club||'—'):_ctry(a);
    let y=14, primera=true;
    const titulo=()=>{
      doc.setTextColor(...NEGRO);
      doc.setFont('helvetica','bold');doc.setFontSize(13);
      doc.text(_stripAccentsForPdf((DATA.event==null?void 0:DATA.event.name)||'Competencia'),148.5,y,{align:'center'});
      doc.setFont('helvetica','normal');doc.setFontSize(8);
      doc.text(_stripAccentsForPdf([(DATA.event==null?void 0:DATA.event.location)||'',(DATA.event==null?void 0:DATA.event.date)||'',window._ACTA_DIA||''].filter(Boolean).join(' - ')),148.5,y+4.5,{align:'center'});
      y+=10;
    };
    titulo();
    grupos.forEach(gr=>{
      const lifts=gr.lifts;
      // La columna del 4º intento sale SOLO si alguien de ESTA tabla lo tuvo.
      const n4={};
      lifts.forEach(l=>{ n4[l]=gr.filas.some(f=>((f.a.att[l]||[])[3]||{}).w>0); });
      const head=[[{content:'#',styles:{halign:'center'}},'Nombre',_porClub?'Club':'Pais','P.Corp.','Nac.']];
      lifts.forEach(l=>{
        for(let j=0;j<3;j++)head[0].push({content:LIFT_S[l]+(j+1),styles:{halign:'center'}});
        if(n4[l])head[0].push({content:LIFT_S[l]+'4',styles:{halign:'center'}});
        head[0].push({content:LIFT_S[l]+' [BST]',styles:{halign:'center'}});   // mejor marca [puesto]
      });
      head[0].push({content:gr.view==='bench'?'Mejor':'Total',styles:{halign:'center'}},{content:'IPF GL',styles:{halign:'center'}});
      // marcar = récords (amarillo) · validos = negrita · nulos = gris y tachado
      const body=[], marcar=[], validos=[], nulos=[], mejores=[];
      gr.filas.forEach((f,ri)=>{
        const a=f.a, row=[f.lugar||'-',a.name||'',_proc(a),a.bw?a.bw.toFixed(2):'',a.born||a.dob||''];
        lifts.forEach(l=>{
          _actaAtts(a,l).forEach(c=>{
            if(c.extra&&!n4[l])return;
            row.push(c.w===''?'':String(c.w));
            const ci=row.length-1;
            if(c.rec)marcar.push([ri,ci]);
            else if(c.ok)validos.push([ri,ci]);
            if(c.nulo)nulos.push([ri,ci]);
          });
          // Mejor marca del movimiento + puesto en la tabla, estilo IPF: 220.0 [3]
          const b=bestOf(a,l), pl=gr.puesto[l]&&gr.puesto[l][a.id];
          row.push(b>0?(b+(pl?' ['+pl+']':'')):'-');
          if(b>0)mejores.push([ri,row.length-1]);
        });
        const esRec=f.total>0&&_srRompe(a,gr.view==='bench'?'bp':'total',f.total).length>0;
        row.push(f.total>0?f.total:'-');
        if(esRec&&gr.view!=='bench')marcar.push([ri,row.length-1]); else if(f.total>0)validos.push([ri,row.length-1]);
        row.push(f.gl?f.gl.toFixed(2):'-');
        body.push(row);
      });
      const enLista=(L,d)=>L.some(m=>m[0]===d.row.index&&m[1]===d.column.index);
      if(y>172){doc.addPage();y=14;}
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...NEGRO);
      doc.text(_stripAccentsForPdf(_actaTitulo(gr)),12,y);
      y+=1.5;
      doc.autoTable({
        head, body, startY:y, margin:{left:10,right:10}, theme:'grid',
        styles:{fontSize:6.6,cellPadding:1,textColor:NEGRO,lineColor:[170,170,170],lineWidth:.15,fillColor:[255,255,255]},
        headStyles:{fillColor:[235,235,235],textColor:NEGRO,fontStyle:'bold',fontSize:6.4,halign:'center'},
        bodyStyles:{fillColor:[255,255,255]},
        alternateRowStyles:{fillColor:[248,248,248]},
        columnStyles:{0:{halign:'center',cellWidth:7},1:{cellWidth:_porClub?42:46},
          2:_porClub?{cellWidth:34}:{halign:'center',cellWidth:10},
          3:{halign:'center',cellWidth:13},4:{halign:'center',cellWidth:10}},
        didParseCell:d=>{
          if(d.section!=='body')return;
          if(d.column.index>=5)d.cell.styles.halign='center';
          if(enLista(nulos,d)){ d.cell.styles.textColor=GRIS; }              // nulo: gris (y tachado abajo)
          else if(enLista(validos,d)){ d.cell.styles.fontStyle='bold'; }     // válido: negrita
          if(enLista(mejores,d)){ d.cell.styles.fontStyle='bold'; d.cell.styles.fillColor=[236,242,252]; }
          if(enLista(marcar,d)){
            d.cell.styles.fillColor=AMARILLO; d.cell.styles.fontStyle='bold'; d.cell.styles.textColor=NEGRO;
          }
        },
        // El tachado de los nulos no existe en autoTable: se dibuja una línea gris
        // sobre el número, del mismo ancho que el texto.
        didDrawCell:d=>{
          if(d.section!=='body'||!enLista(nulos,d))return;
          const txt=String((d.cell.text&&d.cell.text[0])||'');
          if(!txt)return;
          const w=doc.getTextWidth(txt);
          const cx=d.cell.x+d.cell.width/2, cy=d.cell.y+d.cell.height/2;
          doc.setDrawColor(GRIS[0],GRIS[1],GRIS[2]); doc.setLineWidth(0.3);
          doc.line(cx-w/2-0.5,cy,cx+w/2+0.5,cy);
        }
      });
      y=doc.lastAutoTable.finalY+5; primera=false;
    });
    // Pie: leyenda
    const pgs=doc.internal.getNumberOfPages();
    for(let i=1;i<=pgs;i++){
      doc.setPage(i);doc.setFontSize(6.5);doc.setTextColor(...GRIS);
      doc.text('Negrita = intento valido.  Gris tachado = intento nulo.  Amarillo = record sudamericano.  [n] = puesto en ese movimiento.  YourLift - yourlift.cl',10,203);
      doc.text(i+'/'+pgs,287,203,{align:'right'});
    }
    doc.save(_actaNombreArchivo('pdf'));
    showToastLC('Acta PDF generada');
  }catch(e){ showToastLC('Error generando el PDF: '+e.message); console.error(e); }
  finally{ bk.forEach(b=>{b.ref.name=b.name;b.ref.club=b.club;}); if(btn){btn.disabled=false;btn.textContent='Acta FESUPO (PDF)';} }
}

// ── Excel ─────────────────────────────────────────────────────────
async function exportActaFesupoXLS(){
  const btn=document.getElementById('btnActaXls');
  if(btn){btn.disabled=true;btn.textContent='Generando…';}
  try{
    const F=[];                                   // filas: [{v,s}, …]
    const T=(v,st)=>({v:v,s:st||XL_NORMAL});
    F.push([T((DATA.event==null?void 0:DATA.event.name)||'Competencia',XL_TITULO)]);
    F.push([T([(DATA.event==null?void 0:DATA.event.location)||'',(DATA.event==null?void 0:DATA.event.date)||'',window._ACTA_DIA||''].filter(Boolean).join(' · '))]);
    F.push([T('Negrita = intento válido · gris tachado = intento nulo · amarillo = récord sudamericano · [n] = puesto en ese movimiento')]);
    F.push([]);
    _actaGrupos().forEach(gr=>{
      const lifts=gr.lifts;
      // La columna del 4º intento sale solo si alguien de ESTA tabla lo tuvo.
      const n4={}; lifts.forEach(l=>{ n4[l]=gr.filas.some(f=>((f.a.att[l]||[])[3]||{}).w>0); });
      F.push([T(_actaTitulo(gr),XL_TITULO)]);
      const head=['#','Nombre','País','Peso corp.','Nac.'];
      lifts.forEach(l=>{
        for(let j=1;j<=3;j++)head.push(LIFT_S[l]+j);
        if(n4[l])head.push(LIFT_S[l]+'4');
        head.push(LIFT_S[l]+' [BST]');
      });
      head.push(gr.view==='bench'?'Mejor':'Total','IPF GL','Récord');
      F.push(head.map(h=>T(h,XL_HEAD)));
      gr.filas.forEach(f=>{
        const a=f.a;
        const fila=[T(f.lugar||''),T(a.name||''),T(_ctry(a)),T(a.bw||''),T(a.born||a.dob||'')];
        const recs=[];
        lifts.forEach(l=>{
          _actaAtts(a,l).forEach(c=>{
            if(c.extra&&!n4[l])return;
            // válido → negrita · nulo → gris y tachado · récord → amarillo
            const st=c.rec?XL_REC:c.nulo?XL_NULO:c.ok?XL_BOLD:XL_NORMAL;
            fila.push(T(c.w===''?'':Number(c.w),st));
            if(c.rec)recs.push(LIFT_S[l]);
          });
          const b=bestOf(a,l), pl=gr.puesto[l]&&gr.puesto[l][a.id];
          fila.push(T(b>0?(b+(pl?' ['+pl+']':'')):'',XL_BOLD));
        });
        const esRec=f.total>0&&gr.view!=='bench'&&_srRompe(a,'total',f.total).length>0;
        if(esRec)recs.push('TOTAL');
        fila.push(T(f.total>0?f.total:'',esRec?XL_REC:(f.total>0?XL_BOLD:XL_NORMAL)));
        fila.push(T(f.gl?Number(f.gl.toFixed(2)):''));
        fila.push(T(recs.length?('RÉCORD SUD: '+[...new Set(recs)].join(', ')):'',recs.length?XL_BOLD:XL_NORMAL));
        F.push(fila);
      });
      F.push([]);
    });
    const cols=[5,32,7,11,8].concat(Array(15).fill(8),[10,10,26]);
    _xlsxDescargar(_actaNombreArchivo('xlsx'),'Acta',F,cols);
    showToastLC('Excel generado');
  }catch(e){ showToastLC('Error generando el Excel: '+e.message); console.error(e); }
  finally{ if(btn){btn.disabled=false;btn.textContent='Excel';} }
}

async function generateActaPDF(){
  const btn=document.getElementById('btnActaPDF');
  if(btn){btn.disabled=true;btn.textContent='Generando...';}
  // Backup nombres + clubes y normalizar (sin acentos) para el PDF
  const _pdfBackups=DATA.athletes.map(a=>({ref:a,name:a.name,club:a.club,uni:a.uni}));
  DATA.athletes.forEach(a=>{
    if(a.name)a.name=_stripAccentsForPdf(a.name);
    if(a.club)a.club=_stripAccentsForPdf(a.club);
    if(a.uni)a.uni=_stripAccentsForPdf(a.uni);
  });
  try{
    // Lazy load jsPDF + autoTable
    if(!window.jspdf){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload=res;s.onerror=rej;document.head.appendChild(s);
      });
    }
    if(!(window.jspdf==null?void 0:(window.jspdf.jsPDF==null?void 0:(window.jspdf.jsPDF.prototype==null?void 0:window.jspdf.jsPDF.prototype.autoTable)))){
      await new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        s.onload=res;s.onerror=rej;document.head.appendChild(s);
      });
    }

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const PW=297,PH=210;

    // ── Color palette ────────────────────────────────────
    const C={
      bg:[8,22,40],        // dark navy
      header:[196,30,58],  // FECHIPO red
      gold:[212,168,67],
      green:[22,163,74],
      red:[220,38,38],
      muted:[120,143,166],
      border:[30,58,95],
      rowAlt:[13,30,54],
      white:[255,255,255],
      lightGray:[230,235,242]
    };

    // ── Datos ────────────────────────────────────────────
    // Mismo agrupado que el acta FESUPO: una tabla por MODALIDAD + SEXO +
    // DIVISIÓN + CATEGORÍA. Antes acá se agrupaba solo por sexo y categoría, así
    // que dentro de "-83 kg" quedaban mezclados Junior y Open en un mismo top.
    const grupos=_actaGrupos();

    // OVERALL: dentro de una modalidad, un sexo y una división, el mejor por GL
    // points mezclando todas las categorías de peso. Es el premio que se entrega
    // por división (Sub-Junior, Junior, Open, Master…), y sale igual para Only
    // Bench y para las modalidades equipadas, cada una con su propio cuadro.
    function _overalls(){
      const m=new Map();
      grupos.forEach(gr=>{
        const k=[gr.mod,gr.sexo,gr.div].join('|');
        if(!m.has(k))m.set(k,{mod:gr.mod,sexo:gr.sexo,div:gr.div,view:gr.view,filas:[]});
        const o=m.get(k);
        // El que compite en dos modalidades sale en el overall de cada una, pero
        // una sola vez en cada cuadro.
        gr.filas.forEach(f=>{ if(f.total>0&&!o.filas.some(x=>x.a.id===f.a.id))o.filas.push(f); });
      });
      const out=[];
      m.forEach(o=>{
        if(!o.filas.length)return;
        // A igual GL gana el más liviano, mismo criterio que en las categorías.
        o.filas.sort((x,y)=>(y.gl-x.gl)||(x.a.bw-y.a.bw));
        out.push(o);
      });
      const dv=d=>(_ACTA_DIVORD[d]===undefined?9:_ACTA_DIVORD[d]);
      return out.sort((x,y)=>
        (x.mod===y.mod?0:x.mod<y.mod?-1:1)
        ||(x.sexo===y.sexo?0:x.sexo==='F'?-1:1)
        ||(dv(x.div)-dv(y.div)));
    }
    const overalls=_overalls();
    // El que gana su overall lleva la estrella en la tabla de su categoría.
    const ganadoresOv=new Set(overalls.map(o=>o.filas[0].a.id));

    // ── Helpers ──────────────────────────────────────────
    function attCell(at){
      if(!at||!at.w)return{text:'—',color:C.muted};
      if(at.r==='g')return{text:String(at.w),color:C.green};
      if(at.r==='n')return{text:String(at.w),color:C.red,strike:true};
      return{text:String(at.w),color:C.muted};
    }
    // Dibuja una fila de celdas centradas en sus columnas, con tachado opcional.
    function drawRow(cols,cells,x0,y,rowH){
      let cx=x0;
      cells.forEach((cell,ci)=>{
        const col=cols[ci];
        doc.setTextColor(...cell.color);
        doc.setFont('helvetica',cell.bold?'bold':'normal');
        doc.setFontSize(cell.bold?7:6.5);
        let txt=_stripAccentsForPdf(cell.text);
        const maxW=col.w-2;
        if(doc.getTextWidth(txt)>maxW){
          while(txt.length>1&&doc.getTextWidth(txt+'…')>maxW)txt=txt.slice(0,-1);
          txt+='…';
        }
        const ty=y+rowH/2+2;
        doc.text(txt,cx+col.w/2,ty,{align:'center'});
        if(cell.strike&&cell.text!=='—'){
          doc.setDrawColor(...cell.color); doc.setLineWidth(0.3);
          const tw=doc.getTextWidth(txt);
          doc.line(cx+col.w/2-tw/2,ty-1,cx+col.w/2+tw/2,ty-1);
        }
        cx+=col.w;
      });
    }
    function drawHeadRow(cols,x0,y){
      const totalW=cols.reduce((s,c)=>s+c.w,0);
      doc.setFillColor(20,38,68);
      doc.rect(x0,y,totalW,6,'F');
      doc.setTextColor(...C.muted);
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
      let cx=x0;
      cols.forEach(col=>{doc.text(col.header,cx+col.w/2,y+4,{align:'center'});cx+=col.w;});
    }

    // ── Draw page background ─────────────────────────────
    function drawPageBg(){
      doc.setFillColor(...C.bg);
      doc.rect(0,0,PW,PH,'F');
    }

    // ── Draw event header (first time only) ─────────────
    function drawHeader(){
      doc.setFillColor(...C.header);
      doc.rect(0,0,PW,12,'F');
      doc.setTextColor(...C.white);
      doc.setFont('helvetica','bold');
      doc.setFontSize(11);
      doc.text('FECHIPO',8,8.5);
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);
      const evName=((DATA.event==null?void 0:DATA.event.name)||'Campeonato FECHIPO').toUpperCase();
      doc.text(_stripAccentsForPdf(evName),PW/2,8.5,{align:'center'});
      doc.setFontSize(8);
      doc.text(new Date().toLocaleDateString('es-CL'),PW-8,8.5,{align:'right'});
      doc.setFillColor(...C.rowAlt);
      doc.rect(0,12,PW,7,'F');
      doc.setTextColor(...C.gold);
      doc.setFont('helvetica','bold');
      doc.setFontSize(8);
      doc.text(_stripAccentsForPdf('ACTA OFICIAL DE RESULTADOS - POWERLIFTING CHILE'+_actaSufijoDia()),PW/2,17,{align:'center'});
    }

    let curY=0;

    // ── Una tabla de categoría ───────────────────────────
    function renderGrupo(gr){
      const filas=gr.filas;
      if(!filas.length)return;
      const lifts=gr.lifts;
      const mA={}; lifts.forEach(l=>{mA[l]=Math.max(3,...filas.map(f=>(f.a.att[l]||[]).length));});
      // Con una sola columna de movimiento (Only Bench) sobra ancho: se lo damos
      // al nombre y al club, que son los que se cortan.
      const cols=[{header:'Pos',w:8},{header:'Atleta',w:lifts.length>1?42:64},
                  {header:'Club',w:lifts.length>1?28:46},{header:'BW',w:11}];
      lifts.forEach(l=>{const L=l.toUpperCase();for(let r=1;r<=mA[l];r++)cols.push({header:L+r+(r===4?'*':''),w:13});});
      cols.push({header:'Total',w:14},{header:'GL',w:13},{header:'OV',w:8});
      const totalW=cols.reduce((s,c)=>s+c.w,0), x0=(PW-totalW)/2;

      const neededH=22+(filas.length*7)+4;
      if(curY>0&&curY+neededH>PH-10){ doc.addPage(); drawPageBg(); drawHeader(); curY=22; }

      // Banda del título: modalidad · sexo · división y categoría
      doc.setFillColor(...C.border);
      doc.rect(8,curY,PW-16,8,'F');
      doc.setTextColor(...C.gold);
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text(_stripAccentsForPdf(_actaTitulo(gr)),12,curY+5.5);
      doc.setTextColor(...C.muted); doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
      doc.text(filas.length+(filas.length===1?' atleta':' atletas'),PW-12,curY+5.5,{align:'right'});
      curY+=10;

      drawHeadRow(cols,x0,curY); curY+=6;

      filas.forEach((f,ri)=>{
        const a=f.a, rowH=7;
        doc.setFillColor(...(ri%2===0?C.bg:C.rowAlt));
        doc.rect(x0,curY,totalW,rowH,'F');
        const cells=[
          {text:f.lugar?String(f.lugar):'DNF',color:(f.lugar&&f.lugar<=3)?C.gold:C.white,bold:!!f.lugar},
          {text:a.name||'',color:C.white},
          {text:a.club||'—',color:C.lightGray},
          {text:a.bw?String(a.bw):'—',color:C.muted}
        ];
        lifts.forEach(l=>{for(let r=0;r<mA[l];r++)cells.push(attCell((a.att[l]||[])[r]));});
        cells.push(
          {text:f.total?String(f.total):'—',color:C.white,bold:true},
          {text:f.gl?f.gl.toFixed(2):'—',color:C.gold,bold:true},
          {text:ganadoresOv.has(a.id)?'*':'',color:C.gold,bold:true}
        );
        drawRow(cols,cells,x0,curY,rowH);
        doc.setDrawColor(...C.border); doc.setLineWidth(0.15);
        doc.line(x0,curY+rowH,x0+totalW,curY+rowH);
        curY+=rowH;
      });
      curY+=4;
    }

    // ── Un cuadro de overall ─────────────────────────────
    function renderOverall(o){
      const filas=o.filas, bench=o.view==='bench';
      const cols=[{header:'Pos',w:12},{header:'Atleta',w:58},{header:'Club',w:42},
                  {header:'Cat.',w:16},{header:'BW',w:14}];
      if(bench)cols.push({header:'BP',w:20});
      else cols.push({header:'SQ',w:20},{header:'BP',w:20},{header:'DL',w:20});
      cols.push({header:'Total',w:22},{header:'GL',w:22});
      const totalW=cols.reduce((s,c)=>s+c.w,0), x0=(PW-totalW)/2;

      const neededH=16+(filas.length*7)+6;
      if(curY+neededH>PH-10){ doc.addPage(); drawPageBg(); drawHeader(); curY=22; }

      doc.setFillColor(...C.header);
      doc.rect(8,curY,PW-16,8,'F');
      doc.setTextColor(...C.white);
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text(_stripAccentsForPdf('OVERALL  ·  '+_ACTA_MOD_N[o.mod]+'  ·  '
        +(o.sexo==='F'?'DAMAS':'CABALLEROS')+'  ·  '+(o.div||'')),12,curY+5.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...C.lightGray);
      doc.text(_stripAccentsForPdf('Por GL points  ·  '+filas.length+(filas.length===1?' atleta':' atletas')),PW-12,curY+5.5,{align:'right'});
      curY+=10;

      drawHeadRow(cols,x0,curY); curY+=6;

      filas.forEach((f,ri)=>{
        const a=f.a, rowH=7, pos=ri+1;
        doc.setFillColor(...(ri%2===0?C.bg:C.rowAlt));
        doc.rect(x0,curY,totalW,rowH,'F');
        const cells=[
          {text:String(pos),color:pos<=3?C.gold:C.white,bold:pos<=3},
          {text:a.name||'',color:C.white,bold:pos<=3},
          {text:a.club||'—',color:C.lightGray},
          {text:a.cat||'—',color:C.muted},
          {text:a.bw?String(a.bw):'—',color:C.muted}
        ];
        if(bench)cells.push({text:String(bestOf(a,'bp')||'—'),color:C.green});
        else ['sq','bp','dl'].forEach(l=>cells.push({text:String(bestOf(a,l)||'—'),color:C.green}));
        cells.push(
          {text:String(f.total),color:C.white,bold:true},
          {text:f.gl.toFixed(2),color:C.gold,bold:true}
        );
        drawRow(cols,cells,x0,curY,rowH);
        doc.setDrawColor(...C.border); doc.setLineWidth(0.15);
        doc.line(x0,curY+rowH,x0+totalW,curY+rowH);
        curY+=rowH;
      });
      curY+=5;
    }

    // ── Primera página: las categorías ───────────────────
    drawPageBg();
    drawHeader();
    curY=22;
    grupos.forEach(renderGrupo);

    // ── Después, los overall ─────────────────────────────
    if(overalls.length){
      doc.addPage(); drawPageBg(); drawHeader(); curY=22;
      doc.setTextColor(...C.gold);
      doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.text('OVERALL POR DIVISION',PW/2,curY+3,{align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
      doc.text(_stripAccentsForPdf('El mejor de cada division por GL points, mezclando todas las categorias de peso'),
        PW/2,curY+8,{align:'center'});
      curY+=14;
      overalls.forEach(renderOverall);
    }

    // (Sin rankings de clubes ni universidades en el acta)

    // ── Footer on all pages ──────────────────────────────
    const totalPages=doc.internal.getNumberOfPages();
    for(let i=1;i<=totalPages;i++){
      doc.setPage(i);
      doc.setFillColor(...C.bg);
      doc.rect(0,PH-8,PW,8,'F');
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(8,PH-8,PW-8,PH-8);
      doc.setTextColor(...C.muted);
      doc.setFont('helvetica','normal');
      doc.setFontSize(6.5);
      doc.text(_stripAccentsForPdf('FECHIPO - Federacion Chilena de Powerlifting'),8,PH-3);
      doc.text(_stripAccentsForPdf('Verde = intento valido.  Rojo tachado = nulo.  Columna con * = 4to intento.  OV = gano el overall de su division.'),PW/2,PH-3,{align:'center'});
      doc.text('Pag. '+i+'/'+totalPages,PW-8,PH-3,{align:'right'});
    }

    // ── Save ─────────────────────────────────────────────
    // El acta cubre TODO el campeonato, no la tanda que se esté mirando: el nombre
    // del archivo decía "VueloA" y confundía.
    doc.save(_actaNombreArchivo('pdf').replace(/^Acta_/,'Acta_YourLift_'));

  }catch(err){
    console.error('PDF error',err);
    alert('Error al generar PDF: '+err.message);
  }finally{
    // Restaurar nombres/clubes originales con acentos (no se pierden datos)
    _pdfBackups.forEach(b=>{b.ref.name=b.name;b.ref.club=b.club;if(b.uni!==undefined)b.ref.uni=b.uni;});
    if(btn){btn.disabled=false;btn.textContent='Generar Acta PDF';}
  }
}

function exportJSON(){const r=rankings();const blob=new Blob([JSON.stringify(r.map((a,i)=>({rank:i+1,nombre:a.name,rut:a.rut,sexo:a.sex,division:a.div,categoria:a.cat,bw:a.bw,club:a.club,sq:bestOf(a,'sq'),bp:bestOf(a,'bp'),dl:bestOf(a,'dl'),total:a.total,gl:a.gl})),null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const l=document.createElement('a');l.href=u;l.download='resultados.json';l.click()}

// ═══════════════════════════════════════════════════════════
// DOCUMENTOS
//
// Todo lo que se imprime para la mesa, junto y en un solo lugar. Antes eran
// cinco botones apretados en la barra de Atletas & Pesaje, entre "Generar
// Lotes" y "Ordenar por Categoría", y ya son ocho documentos distintos: no
// entraban, y ninguno tenía dónde explicar qué trae.
//
// Lo que cambia de verdad son las papeletas con nombre: en un campeonato de
// varios días se bajan por día. La del día 3 trae UNA papeleta por cada atleta
// que compite el día 3 — las copias las saca después la impresora.
// ═══════════════════════════════════════════════════════════
function _docsAtletas(dia){ return _athDeDia(dia); }

// Un documento de la mesa: qué es, qué trae, y de dónde se baja. Si el
// campeonato tiene más de un día se ofrece día por día, porque a la mesa del
// día 3 se llevan los papeles del día 3 y no los ocho días completos. Los días
// los pone el Cronograma.
function _docBloque(o,dias,nTot){
  const uno=dias.length<2;
  let h='<div class="card" style="padding:14px 16px'
    +(uno?';display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap':'')+'">'
    +'<div'+(uno?' style="min-width:210px;flex:1"':'')+'>'
    +'<div class="os" style="font-size:14px;letter-spacing:1px;color:var(--text)">'+esc(o.titulo)+'</div>'
    +'<div style="color:var(--muted);font-size:11.5px;line-height:1.5;margin-top:3px'
    +(uno?'':';margin-bottom:11px')+'">'+o.detalle+'</div></div>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
  if(!uno)dias.forEach((d,i)=>{
    const n=_docsAtletas(d).length, id=o.id+'D'+i;
    h+='<button id="'+id+'" class="btn" onclick="'+o.fn+'('+JSON.stringify(d).replace(/"/g,'&quot;')
      +',\''+id+'\')" title="'+esc(n+' atletas compiten en '+d)+'" '
      +'style="background:rgba('+o.color+',.15);border-color:rgb('+o.color+');color:rgb('+o.color+')">'
      +esc(d)+' <span style="opacity:.7;font-weight:400">· '+n+'</span></button>';
  });
  h+='<button id="'+o.id+'" class="btn'+(uno?'':' btn-o')+'" onclick="'+o.fn+'()"'
    +(uno?' style="background:rgba('+o.color+',.15);border-color:rgb('+o.color+');color:rgb('+o.color+')"'
         :' title="Los '+nTot+' atletas del campeonato, en un solo archivo"')+'>'
    +(uno?'Descargar PDF':'Todo el campeonato · '+nTot)+'</button>';
  return h+'</div></div>';
}

function renderDocs(){
  const dias=_diasDelEvento();
  const nTot=_docsAtletas('').length;
  let h='<div class="fade"><div style="margin-bottom:16px">'
    +'<h2 class="os" style="font-size:22px;letter-spacing:1px">DOCUMENTOS</h2>'
    +'<p style="color:var(--muted);font-size:12px">'+esc((DATA.event==null?void 0:DATA.event.name)||'')+' · '+nTot+' atletas'
    +(dias.length>1?(' · '+dias.length+' días'):'')+'</p></div>';

  h+='<div style="display:grid;gap:10px;max-width:900px">';

  h+='<div class="side-label" style="margin:2px 0 0">Mesa de pesaje</div>';
  h+=_docBloque({id:'btnHojaPesaje',fn:'generateHojaPesaje',color:'59,130,246',
    titulo:'Hoja de Pesaje',
    detalle:'Para anotar peso corporal, aperturas y altura de rack a mano durante el pesaje.'},dias,nTot);
  h+=_docBloque({id:'btnHojaRack',fn:'generateHojaRack',color:'16,185,129',
    titulo:'Altura de Rack',
    detalle:'Las alturas de sentadilla y banca de cada atleta, para el equipo de tarima.'},dias,nTot);
  h+=_docBloque({id:'btnHojaEquipo',fn:'generateHojaEquipo',color:'168,85,247',
    titulo:'Revisión de Equipo',
    detalle:'La lista para marcar el equipamiento revisado a cada atleta.'},dias,nTot);

  h+='<div class="side-label" style="margin:10px 0 0">Papeletas de intentos</div>';
  // Las dos versiones se parten igual: la cantidad que hace falta ese día es la
  // misma se escriba el nombre o no. Sale UNA por atleta; las copias las saca
  // después la impresora.
  h+=_docBloque({id:'btnPapeletasNom',fn:'generatePapeletasNom',color:'234,179,8',
    titulo:'Papeletas con nombre',
    detalle:'Una papeleta por atleta, con el nombre ya impreso tal como está en la nómina.'},dias,nTot);
  h+=_docBloque({id:'btnPapeletas',fn:'generatePapeletasBco',color:'234,179,8',
    titulo:'Papeletas en blanco',
    detalle:'Las mismas, sin el nombre escrito, para llenar a mano en la mesa.'},dias,nTot);

  // Un atleta sin día en el Cronograma no cae en ninguno de los botones por día,
  // y ese papel no se imprime nunca. Vale la pena decirlo acá y no descubrirlo
  // en la mesa.
  if(dias.length>1){
    const sinDia=_docsAtletas('').filter(a=>!_diaDeAtleta(a));
    if(sinDia.length){
      h+='<div class="card" style="padding:11px 14px;border-color:rgba(245,158,11,.5);'
        +'background:rgba(245,158,11,.08);color:#f59e0b;font-size:11.5px;line-height:1.5">'
        +'<b>Ojo:</b> '+sinDia.length+' atleta'+(sinDia.length>1?'s no tienen':' no tiene')
        +' día asignado en el Cronograma, así que no aparece'+(sinDia.length>1?'n':'')
        +' en ningún documento por día: '
        +esc(sinDia.slice(0,5).map(a=>a.name).join(' · '))+(sinDia.length>5?' …':'')
        +'. Sí entra'+(sinDia.length>1?'n':'')+' en los de todo el campeonato.</div>';
    }
  }

  h+='</div></div>';
  return h;
}

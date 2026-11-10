// ══════════════════════════════════════════════
// ESTILO DEL CAMPEONATO
// ══════════════════════════════════════════════
// Un campeonato puede tener su propio estilo: se elige en el admin (Campeonatos
// → Editar → Estilo del campeonato) y queda en eventos/{id}.estilo. Cambia TODO
// lo de ese campeonato a la vez: la Competencia en Vivo del público, la
// transmisión (OBS), la Pantalla Tarima (cargadores, atleta en barra, luces,
// tabla jornada) y el Control Remoto. Los demás campeonatos siguen como están.
//
// Hoy hay uno, "primavera", sacado del logo del “Primavera Open” Regional Centro
// 2026: madera turquesa como el fondo de la máscara, contorno negro grueso de
// sticker, flores rosadas de centro amarillo, hojas verdes y una rama que corre
// por el borde de arriba de cada caja.
//
// Cómo funciona: cada pantalla dibuja lo de siempre, con algunos nombres de
// clase (pv…) en las piezas que el estilo cambia. Con el estilo puesto, el
// <html> lleva data-estilo="primavera" y livecast/estilo_primavera.css viste
// esas piezas; la rama, las flores y el logo se agregan desde acá. Sin estilo
// no se agrega nada y esa hoja no toca nada: el Normal queda idéntico.
//
// Hay un segundo, "lirio", sacado de la credencial y la cinta del mismo
// campeonato: vino, crema y verde azulado, lirios rojos, letra condensada
// gruesa y líneas finas en vez de contornos. Es una VARIANTE de Primavera: usa
// las mismas piezas (las mismas clases pv…, la misma escena del perfil, las
// mismas ramas), con otros colores, otras flores y otro acabado. El <html> lleva
// data-estilo="primavera" (la familia, para que valga toda la hoja de
// Primavera) y además data-estilo-var="lirio"; livecast/estilo_lirio.css cambia
// lo que hace falta. El logo es el del campeonato, el mismo en los dos.
//
// Y "liriocrema", Lirio al revés, para comparar: más crema que vino. Los
// paneles (marcador, tablas, la página del público, la tabla jornada, el
// Control Remoto) son crema con letra vino. Es Lirio con una capa más: el
// <html> lleva además data-estilo-sub="crema".
//
// Para mirar cómo queda sin cambiar el campeonato: ?estilo=primavera,
// ?estilo=lirio o ?estilo=liriocrema en el link (y ?estilo=normal para verlo
// sin estilo). Es solo para esa pestaña.
const ESTILOS={
  primavera:{nombre:'Primavera',logo:'estilos/primavera/logo.webp'},
  lirio:{nombre:'Lirio',familia:'primavera'},
  liriocrema:{nombre:'Lirio crema',familia:'primavera',variante:'lirio',sub:'crema'},
};
const _ESTILO_URL=(()=>{try{return new URLSearchParams(location.search).get('estilo')||'';}catch(e){return '';}})();
function _estiloId(){
  if(_ESTILO_URL==='normal')return '';
  if(ESTILOS[_ESTILO_URL])return _ESTILO_URL;
  const e=(typeof DATA!=='undefined'&&DATA&&DATA.event&&DATA.event.estilo)||'';
  return ESTILOS[e]?e:'';
}
// ¿El campeonato tiene escena propia? (Primavera o una de sus variantes)
function _estiloPrim(){ const id=_estiloId(); return id==='primavera'||!!(ESTILOS[id]&&ESTILOS[id].familia==='primavera'); }
// La variante: 'lirio', o '' para Primavera tal cual.
function _estiloVar(){ const id=_estiloId(), e=ESTILOS[id]; return (e&&e.familia)?(e.variante||id):''; }
function _pvLirio(){ return _estiloVar()==='lirio'; }
function _pvLogoUrl(){ return ESTILOS.primavera.logo; }   // el logo del campeonato, en los dos
let _estiloPuesto=null;
// Se llama en cada dibujo (R y renderTxWidget): solo hace algo si cambió.
function _estiloAplicar(){
  const id=_estiloId();
  if(id===_estiloPuesto)return;
  _estiloPuesto=id;
  const r=document.documentElement;
  const fam=(ESTILOS[id]&&ESTILOS[id].familia)||id;
  if(fam)r.setAttribute('data-estilo',fam); else r.removeAttribute('data-estilo');
  const vr=(ESTILOS[id]&&ESTILOS[id].familia)?(ESTILOS[id].variante||id):'';
  const sub=(ESTILOS[id]&&ESTILOS[id].sub)||'';
  if(vr)r.setAttribute('data-estilo-var',vr); else r.removeAttribute('data-estilo-var');
  if(sub)r.setAttribute('data-estilo-sub',sub); else r.removeAttribute('data-estilo-sub');
  // Los colores de los dibujos (ramas, flores, medallas) son los de la variante.
  Object.assign(_PV,vr==='lirio'?_PV_LIRIO:_PV_PRIM);
  const FUENTES={
    primavera:'https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;700;800;900&display=swap',
    lirio:'https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@500;600;700;800&display=swap',
  };
  const fk=vr||id;
  if(FUENTES[fk]&&!document.getElementById('estiloFuentes-'+fk)){
    const l=document.createElement('link'); l.id='estiloFuentes-'+fk; l.rel='stylesheet';
    l.href=FUENTES[fk];
    document.head.appendChild(l);
  }
}

// ── Dibujos del estilo Primavera (SVG) ─────────────────────────────────────
// Todo con contorno negro y una cara más clara, como el logo.
const _PV_PRIM={ink:'#15110E',wood:'#8B5530',woodL:'#C0864C',leaf:'#3E9A4A',leafL:'#69BE6C',leafD:'#246B30',
  pink:'#F28AAE',pinkL:'#F9BDD2',pinkD:'#DC6890',pollen:'#F6C744',cream:'#FFF4E6'};
// Lirio: tallos y hojas verde azulado, lirios vino, sin contorno negro.
const _PV_LIRIO={ink:'#4C0116',wood:'#0B5047',woodL:'#17695D',leaf:'#0B5047',leafL:'#17695D',leafD:'#073A33',
  pink:'#740221',pinkL:'#93183A',pinkD:'#4C0116',pollen:'#E2B866',cream:'#F1E2BD'};
const _PV=Object.assign({},_PV_PRIM);
function _pvRand(seed){ let a=seed>>>0||1; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function _pvTallo(d,w){
  if(_pvLirio())return '<path d="'+d+'" fill="none" stroke="'+_PV.wood+'" stroke-width="'+Math.max(3,w*.42).toFixed(1)+'" stroke-linecap="round" stroke-linejoin="round"/>';
  return '<path d="'+d+'" fill="none" stroke="'+_PV.ink+'" stroke-width="'+(w+8)+'" stroke-linecap="round" stroke-linejoin="round"/>'
    +'<path d="'+d+'" fill="none" stroke="'+_PV.wood+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>'
    +'<path d="'+d+'" fill="none" stroke="'+_PV.woodL+'" stroke-width="'+Math.max(1.6,w*.24)+'" stroke-linecap="round" stroke-dasharray="22 30" transform="translate(0,'+(-w*.2)+')" opacity=".85"/>';
}
function _pvHoja(x,y,r,s){
  if(_pvLirio()){
    // Hoja de lirio: larga y angosta, plana, con la nervadura más clara.
    const L='M0,0 C-9,-16 -10,-50 0,-78 C10,-50 9,-16 0,0Z';
    return '<g transform="translate('+x+','+y+') rotate('+r+') scale('+s+')"><path d="'+L+'" fill="'+_PV.leaf+'"/>'
      +'<path d="M0,-4 C1,-30 1,-52 0,-70" fill="none" stroke="'+_PV.leafL+'" stroke-width="'+(2.6/s).toFixed(2)+'" stroke-linecap="round"/></g>';
  }
  const P='M0,0 C-20,-14 -21,-44 0,-62 C21,-44 20,-14 0,0Z';
  return '<g transform="translate('+x+','+y+') rotate('+r+') scale('+s+')"><path d="'+P+'" fill="'+_PV.leaf+'"/><path d="M0,0 C20,-14 21,-44 0,-62Z" fill="'+_PV.leafL+'"/>'
    +'<path d="M0,-3 L0,-55" stroke="'+_PV.leafD+'" stroke-width="3" stroke-linecap="round"/><path d="M0,-18 L-9,-26 M0,-32 L-8,-40 M0,-24 L8,-32" stroke="'+_PV.leafD+'" stroke-width="2" stroke-linecap="round"/>'
    +'<path d="'+P+'" fill="none" stroke="'+_PV.ink+'" stroke-width="'+(4/s)+'" stroke-linejoin="round"/></g>';
}
const _PV_PETALO='M0,-5 C-14,-8 -26,-24 -18,-37 C-12,-44 -4,-43 0,-37 C4,-43 12,-44 18,-37 C26,-24 14,-8 0,-5Z';
const _PV_PETALO_L='M0,-5 C-14,-8 -26,-24 -18,-37 C-12,-44 -4,-43 0,-37Z';
// Lirio visto de frente: seis pétalos en punta, la nervadura más oscura y los
// estambres. Con un borde crema fino, para que se lea sobre el vino de la cinta.
const _LR_PETALO='M0,-4 C-10,-12 -12,-32 0,-50 C12,-32 10,-12 0,-4Z';
function _lrLirio(x,y,r,s){
  let o='',f='';
  for(let i=0;i<6;i++){ const e=(i%2)?.86:1;
    o+='<path transform="rotate('+(i*60)+') scale('+e+')" d="'+_LR_PETALO+'" fill="'+_PV.cream+'" stroke="'+_PV.cream+'" stroke-width="'+(7/s).toFixed(2)+'" stroke-linejoin="round"/>';
    f+='<g transform="rotate('+(i*60)+') scale('+e+')"><path d="'+_LR_PETALO+'" fill="'+((i%2)?_PV.pinkL:_PV.pink)+'"/>'
      +'<path d="M0,-8 C1,-22 1,-32 0,-42" fill="none" stroke="'+_PV.pinkD+'" stroke-width="2.4" stroke-linecap="round"/></g>';
  }
  let est='';
  for(let i=0;i<6;i++){ const a=(i*60+30)*Math.PI/180, L=24+(i%2)*5, ex=(Math.sin(a)*L).toFixed(1), ey=(-Math.cos(a)*L).toFixed(1);
    est+='<path d="M0,0 L'+ex+','+ey+'" stroke="'+_PV.pinkD+'" stroke-width="1.8"/><ellipse cx="'+ex+'" cy="'+ey+'" rx="2.6" ry="4.4" transform="rotate('+(i*60+30)+' '+ex+' '+ey+')" fill="'+_PV.pollen+'" stroke="'+_PV.pinkD+'" stroke-width="1.2"/>'; }
  return '<g transform="translate('+x+','+y+') rotate('+r+') scale('+s+')">'+o+f+est+'<circle r="5" fill="'+_PV.leaf+'"/></g>';
}
function _pvFlor(x,y,r,s){
  if(_pvLirio())return _lrLirio(x,y,r,s);
  let g='<g transform="translate('+x+','+y+') rotate('+r+') scale('+s+')">';
  for(let i=0;i<5;i++)g+='<g transform="rotate('+(i*72)+')"><path d="'+_PV_PETALO+'" fill="'+_PV.pink+'"/><path d="'+_PV_PETALO_L+'" fill="'+_PV.pinkL+'"/><path d="'+_PV_PETALO+'" fill="none" stroke="'+_PV.ink+'" stroke-width="'+(3.6/s)+'" stroke-linejoin="round"/></g>';
  return g+'<circle r="15" fill="'+_PV.pinkD+'"/><circle r="9.5" fill="'+_PV.pollen+'" stroke="'+_PV.ink+'" stroke-width="'+(3.4/s)+'"/><circle cx="-2.5" cy="-2.5" r="3" fill="#FFE68E"/></g>';
}
function _pvBoton(x,y,r,s){
  if(_pvLirio()){
    // Botón de lirio: cerrado, alargado, con dos hojitas en la base.
    const B='M0,0 C-8,-10 -9,-34 0,-52 C9,-34 8,-10 0,0Z';
    return '<g transform="translate('+x+','+y+') rotate('+r+') scale('+s+')">'+_pvHoja(-2,2,-34,.36)+_pvHoja(2,2,34,.36)
      +'<path d="'+B+'" fill="'+_PV.cream+'" stroke="'+_PV.cream+'" stroke-width="'+(6/s).toFixed(2)+'" stroke-linejoin="round"/>'
      +'<path d="'+B+'" fill="'+_PV.pink+'"/><path d="M0,0 C8,-10 9,-34 0,-52Z" fill="'+_PV.pinkL+'"/></g>';
  }
  const P='M0,0 C-11,-6 -14,-23 0,-36 C14,-23 11,-6 0,0Z';
  return '<g transform="translate('+x+','+y+') rotate('+r+') scale('+s+')">'+_pvHoja(-3,2,-38,.42)+_pvHoja(3,2,38,.42)
    +'<path d="'+P+'" fill="'+_PV.pink+'"/><path d="M0,0 C11,-6 14,-23 0,-36Z" fill="'+_PV.pinkL+'"/><path d="M0,-4 C-5,-14 -4,-25 0,-33" fill="none" stroke="'+_PV.ink+'" stroke-width="2.4"/>'
    +'<path d="'+P+'" fill="none" stroke="'+_PV.ink+'" stroke-width="'+(3.6/s)+'" stroke-linejoin="round"/>'
    +'<path d="M-9,-3 C-4,4 4,4 9,-3 L6,4 C3,8 -3,8 -6,4Z" fill="'+_PV.leaf+'" stroke="'+_PV.ink+'" stroke-width="2.6"/></g>';
}
// Una flor sola, como ícono (EN TARIMA, el intento en barra…)
function _pvFlorIcono(px){ return '<svg class="pvIcono" width="'+px+'" height="'+px+'" viewBox="-46 -46 92 92" aria-hidden="true">'+_pvFlor(0,0,0,1)+'</svg>'; }
// Medalla en forma de flor: oro, plata o bronce, con el número al centro.
const _PV_MED={1:['#F2C230','#F9DE7C'],2:['#BFC8CF','#E6ECEF'],3:['#C47A3A','#E3A06A']};
function _pvMedalla(n,px){
  const c=_PV_MED[n]; if(!c)return String(n);
  if(_pvLirio()){
    // Medalla redonda, del metal, con un anillo vino fino.
    return '<svg class="pvMedalla" width="'+px+'" height="'+px+'" viewBox="-50 -50 100 100" aria-label="'+n+'°">'
      +'<circle r="44" fill="'+c[0]+'" stroke="'+_PV.ink+'" stroke-width="3"/><circle r="35" fill="none" stroke="'+c[1]+'" stroke-width="3"/>'
      +'<text y="13" text-anchor="middle" font-family="Anton,Oswald,sans-serif" font-size="38" fill="'+_PV.ink+'">'+n+'</text></svg>';
  }
  let g='<svg class="pvMedalla" width="'+px+'" height="'+px+'" viewBox="-50 -50 100 100" aria-label="'+n+'°">';
  for(let i=0;i<5;i++)g+='<g transform="rotate('+(i*72)+')"><path d="'+_PV_PETALO+'" fill="'+c[0]+'"/><path d="'+_PV_PETALO_L+'" fill="'+c[1]+'"/><path d="'+_PV_PETALO+'" fill="none" stroke="'+_PV.ink+'" stroke-width="3.6" stroke-linejoin="round"/></g>';
  return g+'<circle r="19" fill="'+_PV.cream+'" stroke="'+_PV.ink+'" stroke-width="3.6"/><text y="9" text-anchor="middle" font-family="Lilita One,Oswald,sans-serif" font-size="27" fill="'+_PV.ink+'">'+n+'</text></svg>';
}
// Luz de juez con contorno negro y brillo.
function _pvLuz(color,px){
  return '<svg width="'+px+'" height="'+px+'" viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="58" r="46" fill="rgba(0,0,0,.35)"/><circle cx="55" cy="53" r="46" fill="'+color+'" stroke="'+_PV.ink+'" stroke-width="5"/><path d="M27,40 A32,32 0 0 1 52,22" stroke="rgba(255,255,255,.65)" stroke-width="7" fill="none" stroke-linecap="round"/></svg>';
}

// La rama: un tallo ondulado de W de largo, con ramitas que terminan en flor,
// botones y hojas. 'arriba': las flores crecen hacia arriba desde el tallo (va
// apoyada en el borde de arriba de una caja); 'cuelga': cuelgan hacia abajo
// (bajo una franja). Siempre la misma para el mismo W y semilla, así no "salta"
// cuando la pantalla se vuelve a dibujar.
function _pvRamaInterior(W,o){
  o=o||{}; const arriba=o.modo!=='cuelga', H=o.alto||110, R=_pvRand(o.semilla||7);
  const y0=arriba?H-16:16, dir=arriba?-1:1;
  const n=Math.max(2,Math.round(W/260)), pts=[];
  for(let i=0;i<=n;i++)pts.push([W*i/n, y0+((i%2)?7:-7)*(.45+R()*.55)]);
  let d='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);
  for(let i=1;i<pts.length;i++){ const a=pts[i-1],b=pts[i],cx=(b[0]-a[0])/2;
    d+=' C'+(a[0]+cx).toFixed(1)+','+a[1].toFixed(1)+' '+(b[0]-cx).toFixed(1)+','+b[1].toFixed(1)+' '+b[0].toFixed(1)+','+b[1].toFixed(1); }
  const yEn=x=>{ const i=Math.min(n-1,Math.max(0,Math.floor(x/(W/n)))); const a=pts[i],b=pts[i+1]; const t=(x-a[0])/(b[0]-a[0]); const u=t*t*(3-2*t); return a[1]+(b[1]-a[1])*u; };
  let tallos=_pvTallo(d,o.grosor||12), hojas='', flores='', botones='';
  const paso=o.paso||300; let x=o.inicio||110, i=0;
  while(x<W-30){
    const y=yEn(x), lado=(i%2)?1:-1, largo=(38+R()*12)*(o.escala||1);
    const tx=x+lado*26, ty=y+dir*largo;
    tallos+=_pvTallo('M'+x.toFixed(1)+','+y.toFixed(1)+' C'+(x+lado*6).toFixed(1)+','+(y+dir*largo*.45).toFixed(1)+' '+(x+lado*14).toFixed(1)+','+(y+dir*largo*.75).toFixed(1)+' '+tx.toFixed(1)+','+ty.toFixed(1),6);
    flores+=_pvFlor(tx,ty,R()*40-20,(.72+R()*.3)*(o.escala||1));
    const bx=x+paso*(.42+R()*.16);
    if(bx<W-24){ const by=yEn(bx); botones+=(R()<.5)?_pvBoton(bx,by,(arriba?0:180)+(R()<.5?-1:1)*(24+R()*30),.56*(o.escala||1)):_pvFlor(bx,by,R()*60,.46*(o.escala||1)); }
    x+=paso*(.85+R()*.3); i++;
  }
  for(let hx=26;hx<W-8;hx+=58+R()*26){
    const hy=yEn(hx), lado=(Math.floor(hx/61)%2)?1:-1, ang=lado*(56+R()*22);
    hojas+=_pvHoja(hx,hy,arriba?ang:180-ang,(.5+R()*.18)*(o.escala||1));
  }
  return {H, svg:tallos+hojas+botones+flores};
}
function _pvRama(W,o){
  const r=_pvRamaInterior(W,o);
  return '<svg class="pvRama" width="'+W+'" height="'+r.H+'" viewBox="0 0 '+W+' '+r.H+'" aria-hidden="true">'+r.svg+'</svg>';
}
// Para cajas de ancho variable (el marcador): la rama se dibuja larga y se
// recorta a la derecha, así las flores conservan su tamaño.
function _pvRamaAncho(o){
  const r=_pvRamaInterior(2000,o);
  return '<svg class="pvRama" width="100%" height="'+r.H+'" viewBox="0 0 2000 '+r.H+'" preserveAspectRatio="xMinYMax slice" aria-hidden="true">'+r.svg+'</svg>';
}
// Enredadera vertical (el costado de la clasificación).
function _pvEnredadera(H,o){
  const r=_pvRamaInterior(H,Object.assign({modo:'cuelga',alto:80},o||{}));
  return '<svg class="pvRama" width="'+r.H+'" height="'+H+'" viewBox="0 0 '+r.H+' '+H+'" aria-hidden="true"><g transform="translate('+r.H+',0) rotate(90)">'+r.svg+'</g></svg>';
}
// Ramas grandes en dos esquinas, para las pantallas completas (perfil, atleta en
// barra, luces). Va a 1920×1080 y se estira con la pantalla.
function _pvMarco(){
  let s='';
  s+=_pvTallo('M-20,120 C180,110 300,170 470,140 S700,70 860,90',18)+_pvTallo('M260,140 C290,96 316,70 360,48',9)+_pvTallo('M640,92 C632,60 644,36 670,14',8);
  s+=_pvTallo('M1940,980 C1760,990 1640,930 1460,960 S1220,1030 1060,1010',18)+_pvTallo('M1660,950 C1630,994 1606,1018 1560,1040',9);
  [[110,116,-70,1],[200,118,110,.95],[420,146,-120,1],[520,130,120,.9],[780,82,-66,.9],[350,52,-20,.8],[1840,980,110,1],[1740,976,-70,.95],[1520,958,116,1],[1400,972,-64,.9],[1160,1020,110,.9]].forEach(l=>s+=_pvHoja(l[0],l[1],l[2],l[3]));
  s+=_pvFlor(362,46,8,1.3)+_pvFlor(672,14,-10,1.15)+_pvFlor(860,90,20,1)+_pvFlor(1060,1010,-14,1.1)+_pvFlor(1558,1042,14,1.2)+_pvBoton(560,132,30,.95)+_pvBoton(1300,990,-150,.9);
  return '<svg class="pvMarco" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+s+'</svg>';
}
// El logo del estilo, recortado, con el borde crema de sticker.
function _pvLogo(px,css){ return '<img class="pvLogo" src="'+_pvLogoUrl()+'" alt="" style="width:'+px+'px;'+(css||'')+'">'; }
// La decoración que va encima de una caja: devuelve '' si el estilo no está.
//   tipo 'sb' (marcador), 'ta' (tabla actual), 'lb' (clasificación), 'md' (medallero),
//   'jr' (jurado), 'franja' (franja de arriba de una pantalla).
function _pvDeco(tipo,ancho){
  if(!_estiloPrim())return '';
  if(tipo==='sb')return '<div class="pvDeco pvDeco-sb">'+_pvRamaAncho({semilla:11})+'</div>'+_pvLogo(200,'position:absolute;left:-34px;top:-122px;z-index:4');
  if(tipo==='ta')return '<div class="pvDeco pvDeco-ta">'+_pvRama(ancho||700,{semilla:5,paso:250,inicio:180})+'</div>';
  if(tipo==='lb')return '<div class="pvDeco pvDeco-lb">'+_pvRama(ancho||1540,{semilla:3,paso:330,inicio:300,escala:1.1})+'</div>'
    +'<div class="pvDeco pvDeco-lbv">'+_pvEnredadera(640,{semilla:9,paso:210,inicio:60})+'</div>'+_pvLogo(250,'position:absolute;left:-70px;top:-130px;z-index:4');
  if(tipo==='md')return '<div class="pvDeco pvDeco-md">'+_pvRama(ancho||680,{semilla:4,paso:240,inicio:200})+'</div>';
  if(tipo==='jr')return '<div class="pvDeco pvDeco-jr">'+_pvRamaAncho({semilla:6,paso:260,inicio:150})+'</div>';
  if(tipo==='franja')return '<div class="pvDeco pvDeco-franja">'+_pvRamaAncho({modo:'cuelga',alto:96,semilla:13,paso:340,inicio:200})+'</div>';
  return '';
}

// ── Perfil del atleta (transmisión) en estilo Primavera ────────────────────
// Escena completa: tablas turquesas, ramas en dos esquinas, la foto en un marco
// de madera, el nombre grande y los datos en placas. Se dibuja a 1920×1080 y
// se escala a la ventana; el TAMAÑO de Control TX agranda lo de adentro.
function _pvPerfil(d){
  const W=window.innerWidth||1920, H=window.innerHeight||1080;
  const k=Math.min(W/1920,H/1080)*(d.escala||1);
  const esClub=r=>/^(CLUB|PAÍS)$/.test(r[0]);
  const club=(d.rows||[]).find(esClub);
  const placas=(d.rows||[]).filter(r=>!esClub(r)).map(r=>{
    const pb=/^MEJOR MARCA/.test(r[0]);
    return '<div class="pvPf-placa'+(pb?' pb':'')+'"><div class="k">'+r[0].replace(/^MEJOR MARCA /,'MEJOR ')+'</div><div class="v">'+r[1]+'</div></div>';
  }).join('');
  const ev=(typeof DATA!=='undefined'&&DATA.event&&DATA.event.name)||'';
  return '<div class="pvPf">'
    +'<div class="pvPf-marco">'+_pvMarco()+'</div>'
    +'<div class="pvPf-esc" style="transform:translate(-50%,-50%) scale('+k.toFixed(4)+')">'
      +'<div class="txCascade pvPf-in">'
        +'<div class="pvPf-foto"><div class="pvPf-ph" style="background:'+(/1a2e4f/.test(d.mediaBg||'')||!d.mediaBg?(_pvLirio()?'linear-gradient(180deg,#EBD8AA,#DFCB9A)':'linear-gradient(180deg,#5BB8CD,#2B8AA3)'):d.mediaBg)+'">'+(d.mediaHtml||'')+'</div></div>'
        +'<div class="pvPf-info">'
          +'<div class="pvPf-nombre">'+(d.nombre||'')+'</div>'
          +(club?'<div class="pvPf-club">'+club[1]+'</div>':'')
          +'<div class="pvPf-placas">'+placas+'</div>'
        +'</div>'
      +'</div>'
      +'<div class="pvPf-ev"><div class="t">'+String(ev).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>'+_pvLogo(170,'')+'</div>'
    +'</div>'
  +'</div>';
}

// ── Pantalla Tarima ────────────────────────────────────────────────────────
// En las pantallas de los cargadores, del atleta en barra y de las luces NO va
// ninguna rama sobre la pantalla: los bloques se mueven y se agrandan donde se
// quiera, y una rama colgando bajo la franja tapaba "SENTADILLA · 1er INTENTO ·
// RACK…" (se pidió así: ahí no puede ir nada). Queda el logo y el resto del
// estilo (fondo, franjas, recuadros).
function _pvPantDeco(tipo,alto){
  if(!_estiloPrim())return '';
  if(tipo==='franja')return '<img class="pvLogo pvPant-logo" src="'+_pvLogoUrl()+'" alt="">';
  if(tipo==='marco')return '<img class="pvLogo pvPant-logo der" src="'+_pvLogoUrl()+'" alt="">';
  if(tipo==='luces')return '<img class="pvLogo pvPant-logo" src="'+_pvLogoUrl()+'" alt="">';
  // En la tabla jornada la rama va apoyada en el borde de abajo de la franja,
  // en el hueco entre el nombre del campeonato y el logo: así no le quita ni un
  // pixel a la tabla, que se calcula para caber entera en la pantalla.
  if(tipo==='jornada')return '<div class="pvDeco pvJo-rama" style="top:'+Math.round((alto||80)-84)+'px">'+_pvRama(760,{alto:96,semilla:17,paso:250,inicio:120,escala:.8})+'</div>'
    +'<img class="pvLogo pvJo-logo" src="'+_pvLogoUrl()+'" alt="">';
  return '';
}

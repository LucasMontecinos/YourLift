// Idioma de la interfaz: español (el original), inglés o portugués.
//
// El sitio está escrito en español y así se queda: este archivo no toca ni una
// línea del resto. Si se elige otro idioma, carga su diccionario
// (compartido/idioma/en.js o pt.js) y va reemplazando los textos que aparecen
// en pantalla — también los que se dibujan después, porque mira cada cambio de
// la página. Lo que no está en el diccionario (nombres de atletas, clubes,
// campeonatos) queda tal cual.
//
// La elección se guarda en el navegador y vale para todas las páginas del sitio
// (index, livecast, admin, jueces). Un link con ?lang=en o ?lang=pt la fija.
// En español no se carga nada ni se observa nada: la página corre igual que
// siempre.
(function(){
  'use strict';
  var VDIC='7b70dae1';   // lo pone herramientas/armar_idioma.js: cambia cuando cambian los diccionarios
  var IDIOMAS=['es','en','pt'];
  var CLAVE='yl_idioma';
  var actual='es';
  try{
    var q=new URLSearchParams(location.search).get('lang');
    if(q&&IDIOMAS.indexOf(q)>=0){ actual=q; try{localStorage.setItem(CLAVE,q);}catch(e){} }
    else{ var g=localStorage.getItem(CLAVE); if(IDIOMAS.indexOf(g)>=0)actual=g; }
  }catch(e){}

  var DIC=null, DICL=null;              // exacto y en minúsculas
  var orig=new WeakMap();               // nodo de texto → texto original en español
  var escrito=new WeakMap();            // nodo de texto → lo último que escribimos
  var origAttr=new WeakMap();           // elemento → {atributo: original}
  var obs=null;
  var ATTRS=['placeholder','title','aria-label'];
  var SALTAR={SCRIPT:1,STYLE:1,TEXTAREA:1,NOSCRIPT:1,CODE:1,PRE:1};
  var LETRA=/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;

  function norm(s){ return s.replace(/\s+/g,' ').trim(); }

  // Respeta mayúsculas: "BUSCAR" → "SEARCH", "Buscar" → "Search".
  function caso(orig,tr){
    if(orig===orig.toUpperCase()&&orig!==orig.toLowerCase())return tr.toUpperCase();
    var c=orig.charAt(0);
    if(c===c.toUpperCase()&&c!==c.toLowerCase())return tr.charAt(0).toUpperCase()+tr.slice(1);
    return tr;
  }
  function buscar(k){
    if(!k)return null;
    if(Object.prototype.hasOwnProperty.call(DIC,k))return DIC[k];
    var l=k.toLowerCase();
    if(Object.prototype.hasOwnProperty.call(DICL,l))return caso(k,DICL[l]);
    return null;
  }
  // Un pedazo de texto sin números: tal cual, o sin los signos de los bordes
  // ("📋 Nómina:", "— TANDA", "Atleta ›").
  function pedazo(s){
    var k=norm(s); if(!k)return s;
    var t=buscar(k);
    if(t==null){
      var m=k.match(/^([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]*)(.*?)([\s:.,;·—–\-…›»)!?]*)$/);
      if(m&&m[2]&&(m[1]||m[3])){
        var cola=m[3].trim(), t2;
        if(cola&&(t2=buscar(m[2]+cola))!=null)t=m[1]+t2+m[3].slice(m[3].indexOf(cola)+cola.length);
        else if((t2=buscar(m[2]))!=null)t=m[1]+t2+m[3];
      }
    }
    if(t==null)return null;
    var a=s.match(/^\s*/)[0], z=s.match(/\s*$/)[0];
    return a+t+z;
  }
  // Etiquetas compuestas con "·" ("Classic Femenino · Open"): se traduce cada
  // parte que se conozca y el resto (nombres, siglas) queda igual.
  function porPuntos(s){
    if(s.indexOf('·')<0)return null;
    var p=s.split(/(\s*·\s*)/), alguno=false;
    for(var i=0;i<p.length;i+=2){ if(!LETRA.test(p[i]))continue; var t=conSigla(p[i]); if(t!=null){ p[i]=t; alguno=true; } }
    return alguno?p.join(''):null;
  }
  // "TANDA B", "TARIMA 2": la palabra y su letra o número.
  function conSigla(s){
    var t=pedazo(s); if(t!=null)return t;
    var m=s.match(/^(.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*?)(\s+[A-Z0-9]{1,2}\s*)$/);
    if(m){ var t2=pedazo(m[1]); if(t2!=null)return t2+m[2]; }
    return null;
  }
  function flex(s){ var t=conSigla(s); return t!=null?t:porPuntos(s); }
  function traducir(s){
    if(!s||!LETRA.test(s))return null;
    var t=flex(s);
    if(t!=null)return t;
    // Con números en el medio ("12 atletas encontrados", "Intento 2 · 140 kg"):
    // se traduce cada tramo de letras y los números quedan donde estaban.
    if(/\d/.test(s)){
      var partes=s.split(/(\d+(?:[.,]\d+)?)/), alguno=false;
      for(var i=0;i<partes.length;i+=2){
        if(!LETRA.test(partes[i]))continue;
        var p=flex(partes[i]);
        if(p==null)continue;            // un nombre o una sigla entre números: queda igual
        partes[i]=p; alguno=true;
      }
      if(alguno)return partes.join('');
    }
    // "Atleta: Juan Pérez" → solo la etiqueta.
    var dp=s.indexOf(': ');
    if(dp>0){ var et=pedazo(s.slice(0,dp+1)); if(et!=null)return et+s.slice(dp+1); }
    return null;
  }
  window.ylT=function(s){ if(actual==='es'||!DIC)return s; var t=traducir(String(s)); return t==null?s:t; };

  function saltar(el){
    for(var e=el;e&&e.nodeType===1;e=e.parentNode){
      if(SALTAR[e.tagName])return true;
      if(e.isContentEditable)return true;
      if(e.getAttribute&&(e.getAttribute('translate')==='no'||(e.classList&&e.classList.contains('notranslate'))))return true;
    }
    return false;
  }
  function nodoTexto(n){
    var v=n.nodeValue;
    if(escrito.get(n)===v)return;              // lo escribimos nosotros
    if(!LETRA.test(v))return;
    if(saltar(n.parentNode))return;
    var t=traducir(v);
    if(t!=null&&t!==v){ orig.set(n,v); escrito.set(n,t); n.nodeValue=t; }
    else { orig.delete(n); escrito.delete(n); }
  }
  function atributos(el){
    if(saltar(el))return;
    var o=origAttr.get(el)||{};
    var lista=ATTRS.slice();
    if(el.tagName==='INPUT'&&/^(button|submit|reset)$/i.test(el.type))lista.push('value');
    for(var i=0;i<lista.length;i++){
      var a=lista[i], v=el.getAttribute(a);
      if(!v||!LETRA.test(v))continue;
      if(o['_w_'+a]===v)continue;
      var t=traducir(v);
      if(t!=null&&t!==v){ o[a]=v; o['_w_'+a]=t; el.setAttribute(a,t); }
    }
    origAttr.set(el,o);
  }
  function recorrer(raiz){
    if(!raiz)return;
    if(raiz.nodeType===3){ nodoTexto(raiz); return; }
    if(raiz.nodeType!==1&&raiz.nodeType!==9&&raiz.nodeType!==11)return;
    if(raiz.nodeType===1){ if(SALTAR[raiz.tagName])return; atributos(raiz); }
    var w=document.createTreeWalker(raiz,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,null);
    var n;
    while((n=w.nextNode())){
      if(n.nodeType===3)nodoTexto(n);
      else if(SALTAR[n.tagName]){ /* el walker igual entra, nodoTexto lo descarta */ }
      else if(n.hasAttribute&&(n.hasAttribute('placeholder')||n.hasAttribute('title')||n.hasAttribute('aria-label')||n.tagName==='INPUT'))atributos(n);
    }
  }
  function titulo(){
    if(!document.title)return;
    if(!document.__ylTit||document.title!==document.__ylTitW){
      document.__ylTit=document.title;
      var t=traducir(document.title); if(t!=null){ document.__ylTitW=t; document.title=t; }
    }
  }
  function observar(){
    if(obs||!window.MutationObserver)return;
    obs=new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++){
        var m=ms[i];
        if(m.type==='characterData')nodoTexto(m.target);
        else if(m.type==='attributes')atributos(m.target);
        else for(var j=0;j<m.addedNodes.length;j++)recorrer(m.addedNodes[j]);
      }
    });
    obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS.concat(['value'])});
  }
  // Devuelve todo al español (para cambiar de idioma sin recargar).
  function restaurar(){
    if(obs){ obs.disconnect(); obs=null; }
    var w=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,null),n;
    while((n=w.nextNode())){
      if(n.nodeType===3){ var o=orig.get(n); if(o!=null&&escrito.get(n)===n.nodeValue)n.nodeValue=o; orig.delete(n); escrito.delete(n); }
      else{ var oa=origAttr.get(n); if(oa){ for(var k in oa){ if(k.indexOf('_w_')===0)continue; if(n.getAttribute(k)===oa['_w_'+k])n.setAttribute(k,oa[k]); } origAttr.delete(n); } }
    }
    if(document.__ylTit&&document.title===document.__ylTitW)document.title=document.__ylTit;
  }
  function aplicar(){
    if(actual==='es'||!DIC)return;
    titulo(); recorrer(document.body||document.documentElement); observar();
    document.documentElement.lang=actual;
  }
  function base(){
    var s=document.currentScript||[].slice.call(document.scripts).filter(function(x){return /compartido\/idioma\.js/.test(x.src);})[0];
    return s?s.src.replace(/idioma\.js.*$/,''):'compartido/';
  }
  var BASE=base();
  function cargar(l,cb){
    var nom='YL_DIC_'+l.toUpperCase();
    if(window[nom]){ cb(window[nom]); return; }
    var sc=document.createElement('script');
    sc.src=BASE+'idioma/'+l+'.js?v='+VDIC;
    sc.onload=function(){ cb(window[nom]||{}); };
    sc.onerror=function(){ cb(null); };
    (document.head||document.documentElement).appendChild(sc);
  }
  function usar(d){
    if(!d)return;
    DIC=d; DICL={};
    for(var k in d)if(Object.prototype.hasOwnProperty.call(d,k)){ var l=k.toLowerCase(); if(!(l in DICL))DICL[l]=d[k]; }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',aplicar);
    else aplicar();
  }
  // Los cuadros del navegador (alert, confirm, prompt) también.
  ['alert','confirm','prompt'].forEach(function(f){
    var o=window[f]; if(!o)return;
    window[f]=function(msg){
      var a=[].slice.call(arguments);
      if(actual!=='es'&&DIC&&typeof msg==='string')a[0]=msg.split('\n').map(function(x){ var t=traducir(x); return t==null?x:t; }).join('\n');
      return o.apply(window,a);
    };
  });

  function set(l){
    if(IDIOMAS.indexOf(l)<0||l===actual)return;
    try{localStorage.setItem(CLAVE,l);}catch(e){}
    restaurar(); actual=l; DIC=null; DICL=null;
    document.documentElement.lang=l;
    pintarSelectores();
    if(l!=='es')cargar(l,usar);
  }
  // Las páginas embebidas (ranking, atleta, inscripción dentro del index) siguen
  // al index: cuando cambia ahí, cambia acá.
  window.addEventListener('storage',function(e){ if(e.key===CLAVE&&e.newValue&&e.newValue!==actual)set(e.newValue); });

  // ── Selector ES · EN · PT ── cualquier elemento con data-yl-idioma lo recibe.
  function pintarSelectores(){
    var els=document.querySelectorAll('[data-yl-idioma]');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      el.setAttribute('translate','no');
      el.innerHTML=IDIOMAS.map(function(l){
        var on=l===actual;
        return '<button type="button" data-l="'+l+'" aria-pressed="'+on+'" style="all:unset;cursor:pointer;padding:4px 9px;border-radius:999px;'
          +'font:700 11px/1 Oswald,\'DM Sans\',sans-serif;letter-spacing:1.5px;'
          +(on?'background:#D4A843;color:#0A1628;':'color:rgba(220,230,245,.75);')+'">'+l.toUpperCase()+'</button>';
      }).join('');
      if(!el.__ylClick){ el.__ylClick=1; el.addEventListener('click',function(ev){ var b=ev.target.closest('button[data-l]'); if(b){ ev.stopPropagation(); set(b.getAttribute('data-l')); } }); }
      if(!el.style.display)el.style.cssText+=';display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:rgba(10,22,40,.55);border:1px solid rgba(212,168,67,.35)';
    }
  }
  window.YL_IDIOMA={ get:function(){return actual;}, set:set, t:window.ylT, pintar:pintarSelectores };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pintarSelectores);
  else pintarSelectores();
  // Los que se dibujan después (paneles armados por JS) se pintan solos.
  new MutationObserver(function(){ var p=document.querySelectorAll('[data-yl-idioma]:not([translate])'); if(p.length)pintarSelectores(); })
    .observe(document.documentElement,{childList:true,subtree:true});

  if(actual!=='es'){ document.documentElement.lang=actual; cargar(actual,usar); }
})();

// Tema de la página: "dia" (blanco y azul marino) o "noche" (el oscuro de siempre).
//
// Va en el <head>, antes que nada, para que la página no parpadee al cargar:
//   <script src="compartido/tema.js" data-tema="dia"></script>
// data-tema es el tema de la página. Con data-elegible, la persona puede
// cambiarlo (ylTema.cambiar) y se recuerda en este navegador.
// La transmisión y las pantallas de tarima (?tx=…) quedan siempre como están.
(function(){
  var s=document.currentScript;
  var porDefecto=(s&&s.getAttribute('data-tema'))||'dia';
  var elegible=!!(s&&s.hasAttribute('data-elegible'));
  if(/[?&]tx=/.test(location.search))return;
  var t=porDefecto;
  if(elegible){try{var g=localStorage.getItem('yl_tema');if(g==='dia'||g==='noche')t=g;}catch(e){}}
  document.documentElement.setAttribute('data-tema',t);
  window.ylTema={
    actual:function(){return document.documentElement.getAttribute('data-tema')||'noche';},
    cambiar:function(v){
      v=v||(this.actual()==='dia'?'noche':'dia');
      document.documentElement.setAttribute('data-tema',v);
      try{localStorage.setItem('yl_tema',v);}catch(e){}
      try{window.dispatchEvent(new Event('yl-tema'));}catch(e){}
      return v;
    }
  };
})();

// Aviso de cookies: Google Analytics solo con permiso.
//
// El sitio mide visitas con Google Analytics, que guarda cookies en el equipo de
// quien visita. Bajo la Ley 21.719 eso pide consentimiento: hasta que la persona
// diga que sí, Analytics no se carga, y sin cargarse no deja cookies. La
// elección se guarda en este equipo (localStorage "yl_cookies": "si" / "no") y
// se cambia desde la Política de privacidad (ylCookies.cambiar()).
//
// Las páginas lo cargan en el <head>, antes que todo: deja definido gtag() para
// que lo que mide eventos (el clic en un auspiciador) no falle sin Analytics.
//
// El aviso no sale:
//   · dentro de un iframe (la inscripción embebida en el sitio): ya está en la
//     página de afuera, que es la misma persona y el mismo equipo;
//   · donde la página lo pide con data-aviso="no": el livecast, que también se
//     usa en OBS y en las pantallas del recinto, y ahí quedaría al aire.
// En esos casos Analytics se carga solo si ya se había aceptado.
//
// Va sin ?. ni ?? : también la carga el livecast.
(function () {
  var ID = 'G-109D5LTPQ7', CLAVE = 'yl_cookies';
  var yo = document.currentScript;
  var sinAviso = !!(yo && yo.getAttribute('data-aviso') === 'no');
  var enMarco = false;
  try { enMarco = window.parent !== window; } catch (e) { enMarco = true; }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function leer() { try { return localStorage.getItem(CLAVE) || ''; } catch (e) { return ''; } }
  function guardar(v) { try { if (v) localStorage.setItem(CLAVE, v); else localStorage.removeItem(CLAVE); } catch (e) {} }

  var cargado = false;
  function cargar() {
    window['ga-disable-' + ID] = false;
    if (cargado) return;
    cargado = true;
    window.gtag('js', new Date());
    window.gtag('config', ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    (document.head || document.documentElement).appendChild(s);
  }

  // Al decir que no (o retirar el permiso) se borran las cookies que haya dejado
  // Analytics (_ga, _ga_…, _gid) y, si ya estaba cargado, deja de medir.
  function borrarCookies() {
    window['ga-disable-' + ID] = true;
    var host = location.hostname, partes = host.split('.');
    var doms = ['', host, '.' + host];
    if (partes.length > 2) doms.push('.' + partes.slice(-2).join('.'));
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].replace(/^\s+|\s+$/g, '');
      if (!/^_ga/.test(n) && n !== '_gid') return;
      doms.forEach(function (d) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  function quitarAviso() { var a = document.getElementById('yl-cookies'); if (a) a.remove(); }

  function aviso() {
    if (document.getElementById('yl-cookies') || !document.body) return;
    var d = document.createElement('div');
    d.id = 'yl-cookies';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', 'Aviso de cookies');
    d.innerHTML =
      '<style>' +
      '#yl-cookies{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99998;width:min(720px,calc(100% - 32px));' +
      'box-sizing:border-box;background:var(--card,#11223b);color:var(--text,#e8eef7);border:1px solid var(--gold,#D4A843);border-radius:12px;' +
      'padding:14px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;box-shadow:0 10px 30px rgba(0,0,0,.45);' +
      "font-family:'DM Sans',system-ui,sans-serif;font-size:13px;line-height:1.55}" +
      '#yl-cookies p{margin:0;flex:1 1 320px;color:var(--text,#e8eef7)}' +
      '#yl-cookies a{color:var(--gold,#D4A843)}' +
      '#yl-cookies .b{display:flex;gap:8px;flex:0 0 auto}' +
      "#yl-cookies button{font-family:'Oswald',sans-serif;font-size:12px;letter-spacing:1px;padding:9px 16px;border-radius:8px;cursor:pointer;" +
      'border:1px solid var(--gold,#D4A843);background:transparent;color:var(--gold,#D4A843)}' +
      '#yl-cookies button.si{background:var(--gold,#D4A843);color:#0a1628;font-weight:700}' +
      '#yl-cookies button:focus-visible{outline:2px solid var(--text,#e8eef7);outline-offset:2px}' +
      '</style>' +
      '<p>Usamos <b>Google Analytics</b> para contar visitas y saber qué secciones se usan. Guarda cookies en tu equipo; ' +
      'no se usa para publicidad. <a href="index.html#privacidad" onclick="if(window.sv&&window.parent===window){sv(\'terminos\');return false}">Más información</a></p>' +
      '<div class="b"><button type="button" data-v="no">RECHAZAR</button>' +
      '<button type="button" class="si" data-v="si">ACEPTAR</button></div>';
    d.addEventListener('click', function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute('data-v');
      if (v) elegir(v);
    });
    document.body.appendChild(d);
  }

  function elegir(v) {
    guardar(v);
    quitarAviso();
    if (v === 'si') cargar(); else borrarCookies();
  }

  window.ylCookies = {
    estado: leer,
    elegir: elegir,
    // Desde la Política de privacidad: vuelve a preguntar.
    cambiar: function () { aviso(); }
  };

  var ya = leer();
  if (ya === 'si') cargar();
  else if (!ya && !sinAviso && !enMarco) {
    if (document.body) aviso();
    else document.addEventListener('DOMContentLoaded', aviso);
  }
})();

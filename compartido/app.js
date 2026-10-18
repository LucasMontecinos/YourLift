/* YourLift — lo que cambia cuando el sitio corre dentro de la app.
 *
 * La app de Android y iOS (carpeta app/) no trae una copia del sitio: abre
 * yourlift.cl adentro. Así una inscripción hecha desde el teléfono es la misma
 * que se ve en la página, y la competencia en vivo es la misma transmisión.
 *
 * Pero adentro de la app no hay navegador, y hay tres cosas que un navegador
 * resuelve solo y la app no:
 *  · Descargar. Los PDF, Excel y el QR se arman en el teléfono y se bajan con
 *    un <a download href="blob:…">. Ni Android ni iOS saben qué hacer con eso
 *    adentro de una app; acá se guardan y se abre el menú de compartir del
 *    teléfono (Guardar en Archivos, WhatsApp, Drive…).
 *  · navigator.share no existe en Android. Se hace con el de la app.
 *  · Los enlaces del propio sitio con target="_blank": iOS los mandaría a
 *    Safari y la persona quedaría fuera de la app. Se abren en la misma.
 *    Los PDF y planillas del sitio (consentimientos, formatos) se abren en el
 *    visor del teléfono, que es el que sabe mostrarlos y guardarlos.
 *
 * En un navegador común este archivo no hace nada: lo primero que mira es si
 * está la app.
 */
(function (global) {
  var cap = global.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;

  var nativo = function (plugin, metodo, opc) { return cap.nativePromise(plugin, metodo, opc || {}); };
  var raiz = document.documentElement;
  raiz.classList.add('en-app', 'en-app-' + cap.getPlatform());

  // La pantalla con el logo se va apenas la página está lista (si no, a los 2,5 s).
  var listo = function () { nativo('SplashScreen', 'hide').catch(function () {}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listo);
  else listo();

  // ── Archivos armados en el teléfono ───────────────────────────────────
  // Se guarda cada Blob al crearle su dirección: muchas descargas la anulan
  // apenas hacen click, antes de que alcancemos a leerla.
  var blobs = {};
  var crear = URL.createObjectURL, anular = URL.revokeObjectURL;
  URL.createObjectURL = function (o) {
    var u = crear.apply(URL, arguments);
    if (o instanceof Blob) blobs[u] = o;
    return u;
  };
  URL.revokeObjectURL = function (u) {
    setTimeout(function () { delete blobs[u]; anular.call(URL, u); }, 60000);
  };

  var EXT = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'application/json': '.json',
    'text/csv': '.csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx' };
  var nombreDe = function (nombre, blob) {
    nombre = String(nombre || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim();
    return nombre || 'YourLift' + (EXT[(blob && blob.type || '').split(';')[0]] || '');
  };
  var base64 = function (blob) {
    return new Promise(function (ok, mal) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).slice(String(r.result).indexOf(',') + 1)); };
      r.onerror = function () { mal(r.error); };
      r.readAsDataURL(blob);
    });
  };
  // Escribe el archivo en el caché de la app y devuelve su dirección en el teléfono.
  var escribir = function (blob, nombre) {
    return base64(blob).then(function (data) {
      return nativo('Filesystem', 'writeFile', { path: nombreDe(nombre, blob), data: data, directory: 'CACHE' });
    }).then(function (r) { return r.uri; });
  };
  var cancelado = function (e) { return /cancel/i.test(String(e && (e.message || e.code) || '')); };

  // El QR prueba el <a download> y además abre la imagen en otra ventana, por
  // si el iPad no hizo caso. Acá serían dos menús seguidos: el segundo se salta.
  var recien = {};
  var descargar = function (href, nombre) {
    if (recien[href]) return;
    recien[href] = 1; setTimeout(function () { delete recien[href]; }, 5000);
    var blob = blobs[href];
    (blob ? Promise.resolve(blob) : fetch(href).then(function (r) { return r.blob(); }))
      .then(function (b) { blob = b; return escribir(b, nombre); })
      .then(function (uri) { return nativo('Share', 'share', { title: nombreDe(nombre, blob), files: [uri] }); })
      .catch(function (e) { if (!cancelado(e)) console.warn('[app] no se pudo guardar', e); });
  };

  var ARCHIVO = /\.(pdf|xlsx?|docx?|pptx?|csv|zip)$/i;
  var verAfuera = function (url) {
    nativo('Browser', 'open', { url: url }).catch(function () { location.assign(url); });
  };

  // true si la app se hizo cargo del enlace.
  var enlace = function (a) {
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return false;
    var u;
    try { u = new URL(href, location.href); } catch (e) { return false; }
    if (u.protocol === 'blob:' || u.protocol === 'data:') { descargar(u.href, a.getAttribute('download')); return true; }
    if (u.host !== location.host || !/^https?:$/.test(u.protocol)) return false;   // el resto lo abre el teléfono
    if (a.hasAttribute('download') || ARCHIVO.test(u.pathname)) { verAfuera(u.href); return true; }
    if (a.target && a.target !== '_self') { location.assign(u.href); return true; }
    return false;
  };

  // Los enlaces de la página. Va en la burbuja para que la página decida primero.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button > 0) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && enlace(a)) e.preventDefault();
  });

  // Los <a> que se arman solo para descargar y nunca se agregan a la página:
  // su click no llega al document, hay que atajarlo en el propio enlace.
  var suelto = function (a) {
    return !a.isConnected && (a.hasAttribute('download') || /^(blob|data):/i.test(a.getAttribute('href') || ''));
  };
  var clickOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (suelto(this) && enlace(this)) return;
    return clickOriginal.apply(this, arguments);
  };
  // jsPDF (doc.save) dispara el click con dispatchEvent.
  HTMLAnchorElement.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && suelto(this) && enlace(this)) return false;
    return EventTarget.prototype.dispatchEvent.call(this, ev);
  };

  var abrirOriginal = global.open;
  var ventana = { closed: false, close: function () {}, focus: function () {}, blur: function () {} };
  global.open = function (url) {
    if (url == null || url === '') return abrirOriginal.apply(global, arguments);
    var u;
    try { u = new URL(String(url), location.href); } catch (e) { return abrirOriginal.apply(global, arguments); }
    if (u.protocol === 'blob:' || u.protocol === 'data:') { descargar(u.href, ''); return ventana; }
    if (u.host === location.host && /^https?:$/.test(u.protocol)) {
      if (ARCHIVO.test(u.pathname)) verAfuera(u.href); else location.assign(u.href);
      return ventana;
    }
    return abrirOriginal.apply(global, arguments);
  };

  // ── Compartir ─────────────────────────────────────────────────────────
  if (!navigator.share) {
    navigator.canShare = function (d) {
      return !!d && !!((d.files && d.files.length) || d.url || d.text || d.title);
    };
    navigator.share = function (d) {
      d = d || {};
      var archivos = Array.prototype.slice.call(d.files || []);
      return Promise.all(archivos.map(function (f) { return escribir(f, f.name); })).then(function (uris) {
        var o = { title: d.title, text: d.text, url: d.url, dialogTitle: d.title };
        if (uris.length) o.files = uris;
        return nativo('Share', 'share', o);
      }).then(function () {}, function (e) {
        if (!cancelado(e)) throw e;
        var x = new Error('Share canceled'); x.name = 'AbortError';   // como en el navegador
        throw x;
      });
    };
  }
})(window);

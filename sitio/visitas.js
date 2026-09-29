// index.html — el contador de visitas propio (analytics_daily).
//
// Parte del código de index.html: se carga como <script> normal, así que lo
// que define queda global como antes. Solo define funciones (y las acciones de
// los botones, window.…); lo que corre al abrir la página está en arranque.js.

// ════════════════════════════════════════════════════════════════
// ANALYTICS PROPIO (Firestore) — visitas día/semana/mes, únicos, páginas
// Doc por día: analytics_daily/{YYYY-MM-DD}
//   { total, unique, ts, pages:{home,nominas,ranking,...}, refs:{...} }
// ════════════════════════════════════════════════════════════════
async function trackVisit(fb){
  if(!fbDB)return;
  const today=new Date();
  const ymd=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  const ref=fb.doc(fbDB,'analytics_daily',ymd);
  // ¿visitante único hoy? (localStorage marca 1 vez por día)
  let isUnique=false;
  try{
    const key='yl_visit_'+ymd;
    if(!localStorage.getItem(key)){ localStorage.setItem(key,'1'); isUnique=true; }
  }catch(e){ isUnique=true; }
  // Origen del tráfico (referrer host)
  let refHost='directo';
  try{
    if(document.referrer){
      const u=new URL(document.referrer);
      if(!/yourlift\.cl|fechipo-db/.test(u.hostname)) refHost=u.hostname.replace(/^www\./,'');
      else refHost='interno';
    }
  }catch(e){}
  refHost=refHost.replace(/[.#$/\[\]]/g,'_');
  window._YL_TRACK_FB=fb; // para registrar páginas en sv()
  const payload={
    total: fb.increment(1),
    ts: fb.serverTimestamp(),
    date: ymd,
    refs: { [refHost]: fb.increment(1) }
  };
  if(isUnique) payload.unique = fb.increment(1);
  try{
    await fb.setDoc(ref, payload, {merge:true});
    console.log('[analytics] visita registrada',ymd);
  }catch(e){ console.warn('[analytics] visit error:',e.code,e.message); }
}

// Registrar página vista (se llama desde sv)
async function trackPage(view){
  const fb=window._YL_TRACK_FB;
  if(!fb||!fbDB)return;
  const t=new Date();
  const ymd=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
  const ref=fb.doc(fbDB,'analytics_daily',ymd);
  const v=(view||'home').replace(/[.#$/\[\]]/g,'_');
  try{ await fb.setDoc(ref,{pages:{[v]: fb.increment(1)}},{merge:true}); }catch(e){}
}

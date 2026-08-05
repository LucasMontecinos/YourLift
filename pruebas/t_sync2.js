const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1300,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&controller=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 await p.evaluate(()=>{
   isAdmin=true;window.IS_CONTROLLER=true;fbReady=true;fbDB={};
   window.__w=[];window.__bytes=0;
   const reg=(tipo,pl)=>{window.__w.push(tipo);window.__bytes+=JSON.stringify(pl).length;};
   window._fb={doc:()=>({}),
     setDoc:async(r,pl)=>reg('setDoc',pl),
     updateDoc:async(r,pl)=>reg('updateDoc',pl),
     getDoc:async()=>({data:()=>({}),exists:()=>false})};
 });
 // 1) 60 segundos de reloj: cuantas escrituras y cuantos bytes
 const r1=await p.evaluate(async()=>{
   window.__w=[];window.__bytes=0;
   DATA.timer=60;startTimer(true);
   // simular 60 ticks sin esperar 60s reales
   for(let i=1;i<=60;i++){ DATA.timerStartedAt=_ahora()-i*1000; DATA.timer=60-i; await syncTimerOnlyToFB(); }
   const w=window.__w.length,bt=window.__bytes;
   if(mainTI){clearInterval(mainTI);mainTI=null;}
   return {escrituras:w, kb:Math.round(bt/1024)};
 });
 console.log('reloj de 60s → escrituras:',r1.escrituras,'· antes eran 60');
 // 2) escritura repetida sin cambios
 const r2=await p.evaluate(async()=>{
   window.__w=[];window._ultHuella=null;window._forceFullWrite=false;
   await syncToFB();                       // primera: escribe
   const a=window.__w.length;
   await syncToFB(); await syncToFB();      // sin cambios: no deberia escribir
   const b=window.__w.length;
   DATA.athletes[0].att.sq[0].w=137;        // cambio real
   await syncToFB();
   return {primera:a, trasDosIguales:b, trasCambioReal:window.__w.length};
 });
 console.log('escrituras repetidas →', JSON.stringify(r2));
 // 3) el descuento se calcula solo, con la hora de arranque
 const r3=await p.evaluate(()=>{
   window._skewMs=0;
   const t0=Date.now()-17000;              // arrancó hace 17s
   DATA.timerOn=true;DATA.timerStartedAt=t0;
   return {calculado:Math.max(0,60-Math.floor((_ahora()-DATA.timerStartedAt)/1000))};
 });
 console.log('reloj calculado local (arrancó hace 17s) →', r3.calculado, '· esperado 43');
 // 4) con la hora del equipo corrida 5s, se corrige
 const r4=await p.evaluate(()=>{
   window._skewMs=5000;                    // mi reloj adelantado 5s
   return {conCorreccion:Math.max(0,60-Math.floor((_ahora()-DATA.timerStartedAt)/1000)),
           sinCorreccion:Math.max(0,60-Math.floor((Date.now()-DATA.timerStartedAt)/1000))};
 });
 console.log('equipo con la hora corrida →', JSON.stringify(r4), '(con corrección debe dar 43)');
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&controller=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 const r=await p.evaluate(async()=>{
   isAdmin=true;window.IS_CONTROLLER=true;fbReady=true;fbDB={};
   window.__w=[];
   window._fb={doc:()=>({}),setDoc:async(r,pl)=>window.__w.push(pl),
     updateDoc:async(r,pl)=>window.__w.push({soloTimer:true,...pl}),
     getDoc:async()=>({data:()=>({}),exists:()=>false})};
   window._ultHuella=null;window._forceFullWrite=false;
   await syncToFB();                       // deja la huella
   window.__w=[];
   // El reloj arranca por primera vez
   DATA.timerOn=false;DATA.timer=60;
   startTimer(true); await new Promise(r=>setTimeout(r,60));
   const a=window.__w.length;
   if(mainTI){clearInterval(mainTI);mainTI=null;}
   // Se REINICIA el reloj para el atleta siguiente: timerOn ya era true
   window.__w=[];DATA.timerOn=true;DATA.timer=60;
   startTimer(true); await new Promise(r=>setTimeout(r,60));
   if(mainTI){clearInterval(mainTI);mainTI=null;}
   return {primerArranque:a, reinicioConRelojYaEncendido:window.__w.length};
 });
 console.log(JSON.stringify(r,null,1));
 console.log(r.reinicioConRelojYaEncendido===0?'>> BUG: el reinicio del reloj NO se propaga':'ok');
 await b.close();
})();

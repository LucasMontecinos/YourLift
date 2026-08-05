const {chromium}=require('playwright');
// Simula una competencia: 2 controladores + 1 pantalla de publico, con un
// "servidor" en memoria que hace de Firestore (mismo camino de merge y snapshot).
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1300,height:900}});
 const errs=[];
 const abrir=async(ctrl)=>{
   const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full'+(ctrl?'&controller=1':''),{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
   await p.evaluate(c=>{ isAdmin=true;window.IS_CONTROLLER=c;fbReady=true;fbDB={};
     window._fb={doc:()=>({}),setDoc:async()=>{},updateDoc:async()=>{},getDoc:async()=>({data:()=>({}),exists:()=>false})};
     // tanda chica y limpia
     DATA.athletes.forEach(a=>{a.flight='Z';['sq','bp','dl'].forEach(l=>{a.att[l]=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];});});
     DATA.athletes.slice(0,4).forEach((a,i)=>{a.flight='A';a.lot=i+1;a.att.sq[0].w=100+i*5;});
     DATA.lift='sq';DATA.round=0;DATA.flight='A';DATA.phase=c?'compete':'liveView';R();
   },ctrl);
   return p;
 };
 const A=await abrir(true), B=await abrir(true), PUB=await abrir(false);
 // "servidor": toma el estado de A y se lo pasa a los otros, como un snapshot
 const empujar=async(de,...a)=>{
   const d=await de.evaluate(()=>{
     const _nv=(window.NAV_LIBRE&&window._NAV_REMOTA)||null;
     return {writer:'otro',event:DATA.event,athletes:JSON.stringify(DATA.athletes),
       lift:(_nv&&_nv.lift)||DATA.lift,round:(_nv&&typeof _nv.round==='number')?_nv.round:DATA.round,
       flight:(_nv&&_nv.flight)||DATA.flight,changeTimers:JSON.stringify(DATA.changeTimers),
       forcedCurrent:DATA.forcedCurrent||null,compTimer:null,timer:DATA.timer,timerOn:DATA.timerOn,
       timerStartedAt:DATA.timerStartedAt||0,ts:Date.now()};
   });
   for(const p of a) await p.evaluate(d=>{
     window._NAV_REMOTA={lift:d.lift,round:d.round,flight:d.flight,forcedCurrent:d.forcedCurrent};
     const fresh=(Date.now()-(window._lastLocalAction||0))<2500;
     const rem=_normExtraAtts(JSON.parse(d.athletes));
     DATA.athletes=_mergeAthletes(DATA.athletes,rem);
     if(!fresh&&!window.NAV_LIBRE){DATA.lift=d.lift;DATA.round=d.round;DATA.flight=d.flight;DATA.forcedCurrent=d.forcedCurrent;}
     if(typeof d.timer==='number'){DATA.timerOn=d.timerOn||false;
       if(DATA.timerOn&&d.timerStartedAt){DATA.timerStartedAt=d.timerStartedAt;DATA.timer=Math.max(0,60-Math.floor((_ahora()-DATA.timerStartedAt)/1000));}else DATA.timer=d.timer;}
     R();
   },d);
 };
 const est=p=>p.evaluate(()=>({lift:DATA.lift,round:DATA.round,flight:DATA.flight,
   cur:(liftQueue()[0]||{}).name, n:DATA.athletes.filter(a=>a.flight==='A').length,
   pesos:DATA.athletes.filter(a=>a.flight==='A').map(a=>a.att.sq.map(x=>x.w+(x.r||'')).join('/'))}));

 console.log('— A juzga el 1er intento —');
 await A.evaluate(()=>{const q=liftQueue();overrideResult(q[0].id,'sq',0,'g');});
 await empujar(A,B,PUB);
 console.log('  A  :',JSON.stringify(await est(A)).slice(0,150));
 console.log('  B  :',JSON.stringify(await est(B)).slice(0,150));
 console.log('  PUB:',JSON.stringify(await est(PUB)).slice(0,150));

 console.log('— B carga un peso de otro atleta al mismo tiempo —');
 await B.evaluate(()=>{const a=DATA.athletes.filter(x=>x.flight==='A')[3];a.att.sq[1].w=133;_markAtt(a.id,'att_sq_1');});
 await empujar(B,A,PUB);
 const pa=await est(A), pp=await est(PUB);
 console.log('  el peso de B llegó a A  :', pa.pesos[3]);
 console.log('  y al público            :', pp.pesos[3]);

 console.log('— A avanza de ronda; el público lo sigue solo —');
 await A.evaluate(()=>{DATA.athletes.filter(x=>x.flight==='A').forEach(a=>{a.att.sq[0].r='g';a.att.sq[1].w=a.att.sq[1].w||120;});DATA.round=1;window._lastLocalAction=0;R();});
 await empujar(A,B,PUB);
 console.log('  PUB ronda:',(await est(PUB)).round,'· en tarima:',(await est(PUB)).cur);

 console.log('— B se pone en VISTA LIBRE y se va a otra ronda —');
 await B.evaluate(()=>{setNavLibre(true);DATA.round=2;window._lastLocalAction=0;R();});
 await empujar(A,B,PUB);
 console.log('  B se quedó en ronda:',(await est(B)).round,'(debe ser 2)');
 console.log('  A sigue en        :',(await est(A)).round,'(debe ser 1)');
 console.log('— y aunque B guarde, no arrastra a nadie —');
 await B.evaluate(()=>{const a=DATA.athletes.filter(x=>x.flight==='A')[0];a.att.sq[2].w=150;_markAtt(a.id,'att_sq_2');});
 await empujar(B,A,PUB);
 console.log('  A ronda:',(await est(A)).round,'· PUB ronda:',(await est(PUB)).round,'(las dos deben ser 1)');
 console.log('  y el peso igual llegó:',(await est(A)).pesos[0]);
 console.log('\nerrores JS:',errs.length?errs.slice(0,4):'ninguno');
 await b.close();
})();

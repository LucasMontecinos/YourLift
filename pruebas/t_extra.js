const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1400,height:1000}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const dialogos=[];
 p.on('dialog',async d=>{dialogos.push(d.message());await d.dismiss();});   // "No avanzar"
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&controller=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 const out=await p.evaluate(()=>{
   isAdmin=true;window.IS_CONTROLLER=true;window.saveNow=function(){};window.save=function(){};
   const r={};
   // tanda limpia con 3 atletas
   DATA.athletes.forEach(a=>{['sq','bp','dl'].forEach(l=>{a.att[l]=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];});a.flight='Z';});
   const A=DATA.athletes.slice(0,3); A.forEach((a,i)=>{a.flight='A';a.lot=i+1;});
   DATA.flight='A';DATA.lift='sq';DATA.round=0;
   A.forEach(a=>{a.att.sq[0]={w:100,r:'g'};});          // ronda 1 cerrada
   // al primero se le concede un 4º "al final de la ronda", SIN peso declarado
   A[0].att.sq.push({w:0,r:null,extra:true,mode:'endround',grantedRound:0});
   r.colaConExtraSinPeso=liftQueue().length;            // sin peso no entra: la ronda "parece" terminada
   r.pendientes=_extrasPendientes('sq').map(a=>a.name);
   // ahora se le declara el peso
   A[0].att.sq[3].w=105;
   r.colaConPeso=liftQueue().map(x=>x.name+(x.__is4?' (4º)':''));
   // se pasa de ronda sin haberlo levantado: NO se debe perder
   DATA.round=1; A.forEach(a=>{a.att.sq[1]={w:110,r:'g'};});
   r.enRonda2=liftQueue().map(x=>x.name+(x.__is4?' (4º)':''));
   DATA.round=2; A.forEach(a=>{a.att.sq[2]={w:115,r:'g'};});
   r.enRonda3=liftQueue().map(x=>x.name+(x.__is4?' (4º)':''));
   // intentar avanzar: tiene que preguntar
   const antes={l:DATA.lift,r:DATA.round};
   advanceLift();
   r.noAvanzo=(DATA.lift===antes.l&&DATA.round===antes.r);
   // se juzga el extra y recién ahí avanza sin preguntar
   A[0].att.sq[3].r='g';
   r.trasJuzgar=_extrasPendientes('sq').length;
   r.colaFinal=liftQueue().length;
   return r;
 });
 console.log(JSON.stringify(out,null,1));
 console.log('\naviso al intentar avanzar:\n'+dialogos.map(d=>d.replace(/\n/g,' | ')).join('\n'));
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

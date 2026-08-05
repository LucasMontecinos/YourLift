const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1500,height:1000}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&controller=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 const prueba=async(m)=>p.evaluate(m=>{
   isAdmin=true;window.IS_CONTROLLER=true;window.saveNow=function(){};window.save=function(){};
   DATA.athletes.forEach(a=>{a.flight='Z';['sq','bp','dl'].forEach(l=>{a.att[l]=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];});});
   const A=DATA.athletes.slice(0,4);
   A.forEach((a,i)=>{a.flight='A';a.lot=i+1;a.att.sq=[{w:100+i*5,r:null},{w:0,r:null},{w:0,r:null}];});
   A[1].att.sq.push({w:110,r:null,extra:true,mode:m,grantedRound:0});
   DATA.lift='sq';DATA.round=0;DATA.flight='A';DATA.phase='compete';R();
   // solo las filas de la tabla de la tanda (las que tienen nombre de atleta)
   const nombres=A.map(x=>x.name);
   return [...document.querySelectorAll('tbody tr')].map(t=>{
     const txt=t.innerText;
     const n=nombres.find(x=>txt.includes(x));
     if(!n)return null;
     return n+(/INTENTO EXTRA|4º INTENTO/.test(txt)?'  ← fila del EXTRA':'');
   }).filter(Boolean);
 },m);
 console.log('AL FINAL DE LA RONDA:');
 (await prueba('endround')).forEach((x,i)=>console.log('   '+(i+1)+'. '+x));
 console.log('\nSE SIGUE A SÍ MISMO:');
 (await prueba('self')).forEach((x,i)=>console.log('   '+(i+1)+'. '+x));
 console.log('\nerrores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

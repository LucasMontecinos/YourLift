const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1400,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',async d=>{await d.accept();});
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&controller=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 const r=await p.evaluate(()=>{
   isAdmin=true;window.IS_CONTROLLER=true;window.saveNow=function(){};window.save=function(){};
   window._CT_ENABLED=true;                       // timer de cambio ACTIVADO
   const out={};
   DATA.athletes.forEach(a=>{['sq','bp','dl'].forEach(l=>{a.att[l]=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];});a.flight='Z';});
   const A=DATA.athletes.slice(0,2); A.forEach((a,i)=>{a.flight='A';a.lot=i+1;});
   DATA.flight='A';DATA.lift='sq';DATA.round=0;DATA.changeTimers={};
   const X=A[0], k1=X.id+'_sq_1';
   // caso normal: marca su 1er intento -> arranca el minuto del 2º
   X.att.sq[0].w=100; setResult(X.id,'sq',0,'n');
   out['1_normal_arranca']=!!DATA.changeTimers[k1];
   // ahora se le concede un extra AL FINAL DE LA RONDA -> el minuto se tiene que cortar
   _do4thAttempt(X.id,'sq','endround',4);
   out['2_al_conceder_extra_se_corta']=!DATA.changeTimers[k1];
   // y no debe volver a arrancar mientras el extra siga pendiente
   _armarChangeTimer(X,'sq',1);
   out['3_no_arranca_con_extra_pendiente']=!DATA.changeTimers[k1];
   // se levanta el extra -> ahi si arranca el minuto del 2º
   X.att.sq[3].w=105; setResult(X.id,'sq',3,'g');
   out['4_tras_el_extra_arranca']=!!DATA.changeTimers[k1];
   out['4_segundos']=(DATA.changeTimers[k1]||{}).remaining;
   // modo "se sigue a si mismo": mismo comportamiento
   const Y=A[1], k2=Y.id+'_sq_1';
   Y.att.sq[0].w=100; setResult(Y.id,'sq',0,'n');
   _do4thAttempt(Y.id,'sq','self',4);
   out['5_self_se_corta']=!DATA.changeTimers[k2];
   Y.att.sq[3].w=100; setResult(Y.id,'sq',3,'g');
   out['6_self_tras_el_extra_arranca']=!!DATA.changeTimers[k2];
   // si el peso del siguiente YA estaba declarado, no arranca nada (como antes)
   const Z=DATA.athletes[2]; Z.flight='A';
   Z.att.sq[0].w=100; Z.att.sq[1].w=110; setResult(Z.id,'sq',0,'g');
   out['7_con_peso_ya_declarado_no_arranca']=!DATA.changeTimers[Z.id+'_sq_1'];
   return out;
 });
 console.log(JSON.stringify(r,null,1));
 const ok=r['1_normal_arranca']&&r['2_al_conceder_extra_se_corta']&&r['3_no_arranca_con_extra_pendiente']
   &&r['4_tras_el_extra_arranca']&&r['5_self_se_corta']&&r['6_self_tras_el_extra_arranca']&&r['7_con_peso_ya_declarado_no_arranca'];
 console.log('\nTODO CORRECTO:', ok);
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

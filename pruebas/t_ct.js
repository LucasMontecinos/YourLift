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
   // CORREGIR una decisión —válido a nulo, o al revés— le devuelve al atleta el
   // minuto completo para declarar el intento siguiente. (Hubo una etapa en que
   // no lo tocaba; en competencia se pidió que sí se reinicie.)
   const W=DATA.athletes[3]; W.flight='A';
   W.att.sq=[{w:100,r:null},{w:0,r:null},{w:0,r:null}];
   delete DATA.changeTimers[W.id+'_sq_1'];
   setResult(W.id,'sq',0,'g');
   const t1=DATA.changeTimers[W.id+'_sq_1'];
   out['8_al_juzgar_arranca']=!!t1;
   t1.remaining=17; t1.startedAt=_ahora()-43000;   // como si ya hubieran pasado 43 segundos
   setResult(W.id,'sq',0,'n');            // se corrige: era nulo
   const t2=DATA.changeTimers[W.id+'_sq_1'];
   out['9_al_corregir_vuelve_a_60']=!!t2&&t2.remaining===60&&_ahora()-t2.startedAt<1000;
   // y al revés: de nulo a válido, lo mismo
   DATA.changeTimers[W.id+'_sq_1'].remaining=8; DATA.changeTimers[W.id+'_sq_1'].startedAt=_ahora()-52000;
   setResult(W.id,'sq',0,'g');
   out['10_y_al_volver_a_valido_tambien']=(DATA.changeTimers[W.id+'_sq_1']||{}).remaining===60;
   // ── El CUADRADO NARANJO de Control en Vivo ────────────────────────────
   // Corregir desde Control en Vivo pasa por overrideResult: el minuto vuelve a
   // 60 aunque ya hubiera vencido, y el reloj de tarima no se toca.
   const V=DATA.athletes[4]; V.flight='A';
   DATA.lift='sq';DATA.round=0;
   V.att.sq=[{w:100,r:'g'},{w:0,r:null},{w:0,r:null}];
   DATA.changeTimers[V.id+'_sq_1']={remaining:0,expired:true,startedAt:_ahora()-70000};
   const relojAntes=DATA.timer;
   overrideResult(V.id,'sq',0,'n');                 // válido -> nulo
   const tv=DATA.changeTimers[V.id+'_sq_1']||{};
   out['11_override_vuelve_a_60']=tv.remaining===60&&!tv.expired;
   out['11b_reloj_de_tarima_igual']=DATA.timer===relojAntes;
   // Con el peso siguiente ya declarado no se arma nada.
   const U=DATA.athletes[5]; U.flight='A';
   U.att.sq=[{w:100,r:'g'},{w:110,r:null},{w:0,r:null}];
   delete DATA.changeTimers[U.id+'_sq_1'];
   overrideResult(U.id,'sq',0,'n');
   out['12_con_peso_declarado_no_arma']=!DATA.changeTimers[U.id+'_sq_1'];
   // Ronda que recién terminó (se compite la 2ª, se corrige la 1ª): también.
   const Q=DATA.athletes[8]||DATA.athletes[1]; Q.flight='A';
   DATA.round=1;
   Q.att.sq=[{w:100,r:'n'},{w:0,r:null},{w:0,r:null}];
   delete DATA.changeTimers[Q.id+'_sq_1'];
   changeResult(Q.id,'sq',0,'g');
   out['12b_ronda_anterior_arranca']=(DATA.changeTimers[Q.id+'_sq_1']||{}).remaining===60;
   DATA.round=0;
   // Corrección de un intento de OTRA ronda: no arma nada (queda como está).
   const T=DATA.athletes[6]; T.flight='A';
   T.att.sq=[{w:100,r:'g'},{w:110,r:'g'},{w:0,r:null}];
   delete DATA.changeTimers[T.id+'_sq_2'];
   overrideResult(T.id,'sq',1,'n');                 // ronda 1, se compite la 0
   out['13_otra_ronda_no_arranca']=!DATA.changeTimers[T.id+'_sq_2'];
   // PRIMERA decisión (no corrección) con el peso siguiente ya declarado: sigue sin
   // arrancar nada. Lo que cambió es solo el caso de corregir.
   const S=DATA.athletes[7]; S.flight='A';
   S.att.sq=[{w:100,r:null},{w:110,r:null},{w:0,r:null}];
   delete DATA.changeTimers[S.id+'_sq_1'];
   overrideResult(S.id,'sq',0,'g');
   out['14_primera_decision_con_peso_no_arranca']=!DATA.changeTimers[S.id+'_sq_1'];
   return out;
 });
 console.log(JSON.stringify(r,null,1));
 const ok=r['1_normal_arranca']&&r['2_al_conceder_extra_se_corta']&&r['3_no_arranca_con_extra_pendiente']
   &&r['4_tras_el_extra_arranca']&&r['5_self_se_corta']&&r['6_self_tras_el_extra_arranca']
   &&r['7_con_peso_ya_declarado_no_arranca']&&r['8_al_juzgar_arranca']
   &&r['9_al_corregir_vuelve_a_60']&&r['10_y_al_volver_a_valido_tambien']
   &&r['11_override_vuelve_a_60']&&r['11b_reloj_de_tarima_igual']&&r['12_con_peso_declarado_no_arma']&&r['12b_ronda_anterior_arranca']
   &&r['13_otra_ronda_no_arranca']&&r['14_primera_decision_con_peso_no_arranca'];
 console.log('\nTODO CORRECTO:', ok);
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
 // El veredicto tiene que estar en el CÓDIGO DE SALIDA: esta prueba solo
 // imprimía, así que la batería la daba por buena aunque fallara todo.
 if(!ok||errs.length){ console.log('\nFALLA'); process.exit(1); }
 process.exit(0);
})();

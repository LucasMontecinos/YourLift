const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1500,height:950}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',async d=>{await d.accept();});
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&controller=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.RECSUDA&&typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 const r=await p.evaluate(()=>{
   isAdmin=true;window.IS_CONTROLLER=true;window.saveNow=function(){};window.save=function(){};
   const out={};
   // Dos atletas de la MISMA categoria/division/linea
   const A=DATA.athletes[0], B=DATA.athletes[1], C=DATA.athletes[2];
   [A,B,C].forEach((x,i)=>{ x.sex='Femenino'; x.mod='classic'; x.cat='-63 kg (Mujer)'; x.div='Open';
     x.flight='A'; x.lot=i+1; ['sq','bp','dl'].forEach(l=>{x.att[l]=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];}); });
   // limpiar TODO el evento: si no, marcas ya cargadas de otros atletas de la
   // misma categoria mandan el récord del dia y la prueba no mide nada
   DATA.athletes.forEach(x=>{ if([A.id,B.id,C.id].indexOf(x.id)<0){ x.flight='Z';
     ['sq','bp','dl'].forEach(l=>{x.att[l]=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];}); } });
   DATA.lift='bp';DATA.round=0;DATA.flight='A';
   const key=['F','classic','Open','-63','bp'].join('|');
   // récord de arranque: lo fijamos a mano para que la prueba sea clara
   RECSUDA[key]={kg:102.5,quien:'Récord viejo',pais:'ARG',fecha:'2024',lugar:'X'};
   window._SR_HOY=null;
   out['0_record_inicial']=_srVigente(key).kg;
   // A declara 103 (récord), B declara 103 (récord), C declara 100 (NO es récord)
   A.att.bp[0].w=103; B.att.bp[0].w=103; C.att.bp[0].w=100;
   out['1_A_es_intento_de_record']=_srRompe(A,'bp',103).length>0;
   out['1_B_es_intento_de_record']=_srRompe(B,'bp',103).length>0;
   out['1_C_es_intento_de_record']=_srRompe(C,'bp',100).length>0;
   // A lo hace VALIDO -> récord 103
   setResult(A.id,'bp',0,'g');
   out['2_record_ahora']=_srVigente(key).kg;
   out['2_lo_puso']=_srVigente(key).quien;
   out['3_B_subio_a']=B.att.bp[0].w;
   out['3_C_quedo_en']=C.att.bp[0].w;
   out['4_B_sigue_siendo_record']=_srRompe(B,'bp',B.att.bp[0].w).length>0;
   out['5_A_conserva_su_marca_de_record']=_srRompe(A,'bp',103).length>0;
   // B lo hace valido con 105 -> récord 105; un cuarto con 105 declarado deberia ir a 107.5
   const D=DATA.athletes[3]; D.sex='Femenino';D.mod='classic';D.cat='-63 kg (Mujer)';D.div='Open';D.flight='A';D.lot=4;
   ['sq','bp','dl'].forEach(l=>{D.att[l]=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];});
   D.att.bp[0].w=105;
   setResult(B.id,'bp',0,'g');
   out['6_record_ahora']=_srVigente(key).kg;
   out['6_D_subio_a']=D.att.bp[0].w;
   // si se ANULA la marca de B, el récord vuelve a 103 solo
   overrideResult(B.id,'bp',0,'g');   // toggle: la borra
   window._SR_HOY=null;
   out['7_tras_anular_B_record']=_srVigente(key).kg;
   return out;
 });
 console.log(JSON.stringify(r,null,1));
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

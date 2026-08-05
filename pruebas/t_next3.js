const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1860,height:850}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&tx=screen',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 const leer=()=>p.evaluate(()=>{
   const l=document.body.innerText.split('\n').map(x=>x.trim()).filter(Boolean);
   const m=l.find(x=>/^SIGUIENTE/.test(x));
   return m||'(sin bloque SIGUIENTE)';
 });
 // caso 1: hay otro en la misma ronda y tanda
 await p.evaluate(()=>{
   const M=DATA.athletes.find(a=>/Moreira/i.test(a.name)), O=DATA.athletes.find(a=>/Ojeda/i.test(a.name));
   DATA.athletes.forEach(a=>{a.att.bp=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];a.flight='Z';});
   M.flight='A';O.flight='A';M.rackBP='6';
   M.att.bp=[{w:55,r:'g'},{w:57.5,r:'n'},{w:60,r:null}];
   O.att.bp=[{w:57.5,r:'g'},{w:60,r:'g'},{w:62.5,r:null}];
   DATA.lift='bp';DATA.round=2;DATA.flight='A';window._SCREEN_STATE={mode:'intentos'};R();
 });
 console.log('1) otro en la misma ronda  →', await leer());
 // caso 2: es el ULTIMO de su ronda, pero queda gente en la ronda siguiente
 await p.evaluate(()=>{
   const M=DATA.athletes.find(a=>/Moreira/i.test(a.name)), O=DATA.athletes.find(a=>/Ojeda/i.test(a.name));
   DATA.round=1;
   M.att.bp=[{w:55,r:'g'},{w:57.5,r:null},{w:0,r:null}];
   O.att.bp=[{w:57.5,r:'g'},{w:0,r:null},{w:62.5,r:null}];
   R();
 });
 console.log('2) ultimo de la ronda      →', await leer());
 // caso 3: es el ULTIMO de su tanda — el que sigue esta en otra tanda (el caso de la captura)
 await p.evaluate(()=>{
   const M=DATA.athletes.find(a=>/Moreira/i.test(a.name)), O=DATA.athletes.find(a=>/Ojeda/i.test(a.name));
   O.flight='B'; O.att.bp=[{w:57.5,r:null},{w:0,r:null},{w:0,r:null}];
   M.att.bp=[{w:55,r:'g'},{w:57.5,r:'n'},{w:60,r:null}];
   DATA.round=2;DATA.flight='A';R();
 });
 console.log('3) ultimo de la tanda      →', await leer());
 // caso 4: no queda absolutamente nadie
 await p.evaluate(()=>{
   const O=DATA.athletes.find(a=>/Ojeda/i.test(a.name));
   O.att.bp=[{w:57.5,r:'g'},{w:0,r:null},{w:0,r:null}]; R();
 });
 console.log('4) no queda nadie          →', await leer());
 await p.evaluate(()=>{const O=DATA.athletes.find(a=>/Ojeda/i.test(a.name));O.flight='B';O.att.bp=[{w:57.5,r:null},{w:0,r:null},{w:0,r:null}];R();});
 await p.waitForTimeout(300);
 await p.screenshot({path:'pant_next3.png'});
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

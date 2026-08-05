const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof calcGL==='function',null,{timeout:30000});
 // valores de referencia calculados con la tabla oficial IPF GL
 const esperado={
   'PL classic M':91.57,'PL equipado M':97.6,'Banca classic M':94.89,
   'Banca equipado M':99.23,'PL classic F':87.51,'Banca equipado F':90.52};
 const lc=await p.evaluate(()=>{
   const A=(mod,plus)=>({mod:mod,plusBench:!!plus,sex:'Hombre'});
   return {
     'PL classic M':      calcGL(700,93,'Hombre',_glMod({mod:'classic'})),
     'PL equipado M':     calcGL(900,93,'Hombre',_glMod({mod:'equipped'})),
     'Banca classic M':   calcGL(200,93,'Hombre',_glMod({mod:'onlybench'})),
     'Banca equipado M':  calcGL(300,93,'Hombre',_glMod({mod:'equipped_bench',plusBench:false})),
     'PL classic F':      calcGL(400,63,'Mujer', _glMod({mod:'classic'})),
     'Banca equipado F':  calcGL(150,63,'Mujer', _glMod({mod:'equipped_bench',plusBench:false})),
     // el COMBINADO equipado, medido por su total de powerlifting, va con PL equipado
     'combinado eq (PL)': calcGL(900,93,'Hombre',_glMod({mod:'equipped_bench',plusBench:true})),
     // y el mismo, en la tabla de banca sola
     'combinado eq (banca)': calcGL(300,93,'Hombre',_glMod({mod:'equipped_bench',plusBench:true}),'bench'),
   };
 });
 const adm=lc;
 console.log(`${'caso'.padEnd(22)}${'esperado'.padStart(9)}${'livecast'.padStart(10)}   ok`);
 let todo=true;
 for(const k of Object.keys(esperado)){
   const okL=Math.abs(lc[k]-esperado[k])<0.02;
   if(!okL)todo=false;
   console.log(`${k.padEnd(22)}${String(esperado[k]).padStart(9)}${String(lc[k]).padStart(10)}   ${okL?'✓':'✗'}`);
 }
 console.log('\ncombinado equipado — por su total de PL:', lc['combinado eq (PL)'], '(debe dar', esperado['PL equipado M'],')');
 console.log('combinado equipado — en la tabla de banca:', lc['combinado eq (banca)'], '(debe dar', esperado['Banca equipado M'],')');
 console.log('\nTODO CORRECTO:', todo && Math.abs(lc['combinado eq (PL)']-97.6)<0.02 && Math.abs(lc['combinado eq (banca)']-99.23)<0.02);
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

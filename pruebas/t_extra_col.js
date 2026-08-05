const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1500,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 const cols=()=>p.evaluate(()=>[...document.querySelectorAll('th')].map(t=>t.innerText.trim()).filter(x=>/INT|EXTRA/.test(x)).join(' '));
 await p.evaluate(()=>{
   isAdmin=false;window.IS_CONTROLLER=false;
   DATA.athletes.forEach(a=>{['sq','bp','dl'].forEach(l=>{a.att[l]=[{w:0,r:null},{w:0,r:null},{w:0,r:null}];});});
   DATA.lift='sq';DATA.round=0;DATA.phase='liveView';R();
 });
 console.log('1) datos limpios              →', await cols());
 await p.evaluate(()=>{ const a=DATA.athletes.find(x=>x.flight===DATA.flight); a.att.sq.push({w:0,r:null}); R(); });
 console.log('2) casilla extra VACÍA        →', await cols(), ' (no debe aparecer EXTRA)');
 await p.evaluate(()=>{ const a=DATA.athletes.find(x=>x.flight===DATA.flight); a.att.sq[3].w=140; R(); });
 console.log('3) extra con peso declarado   →', await cols(), ' (ahora sí)');
 await p.evaluate(()=>{ const a=DATA.athletes.find(x=>x.flight===DATA.flight); a.att.sq.pop(); R(); });
 console.log('4) extra eliminado            →', await cols());
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

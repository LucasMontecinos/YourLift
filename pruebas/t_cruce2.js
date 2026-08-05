const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1300,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full&controller=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:30000});
 const r=await p.evaluate(()=>{
   const out={};
   const mk=(id,n)=>({id:id,name:n,flight:'A',bw:0,div:'Open',cat:'83',
     att:{sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]}});
   // A) EL CRUCE: local = 85 del suda, remoto = 62 del regional (ningun nombre en comun)
   const suda=[...Array(85)].map((_,i)=>mk(i,'Suda '+i));
   const regional=[...Array(62)].map((_,i)=>mk(i,'Regional '+i));
   window._recentAtt={}; suda.forEach(a=>{window._recentAtt[a.id+'|meta']=Date.now();});
   const m1=_mergeAthletes(suda,regional);
   out['A_cruce_resultado']=m1.length;
   out['A_cruce_intrusos']=m1.filter(x=>/^Suda /.test(x.name)).length;
   // B) CASO LEGITIMO: agregue 1 atleta al roster del mismo evento
   const local=[...regional.map(a=>mk(a.id,a.name)), mk(999,'Recien Agregado')];
   window._recentAtt['999|meta']=Date.now();
   const m2=_mergeAthletes(local,regional);
   out['B_legitimo_resultado']=m2.length;
   out['B_conservo_al_nuevo']=m2.some(x=>x.name==='Recien Agregado');
   // C) mismo id, otra persona: manda el servidor
   const local2=[mk(0,'Persona del otro evento')];
   window._recentAtt={}; window._recentAtt['0|meta']=Date.now();
   local2[0].bw=99;
   const m3=_mergeAthletes(local2,[mk(0,'Regional 0')]);
   out['C_nombre']=m3[0].name; out['C_bw_no_se_pego']=m3[0].bw===0;
   return out;
 });
 console.log(JSON.stringify(r,null,1));
 const ok=r.A_cruce_resultado===62&&r.A_cruce_intrusos===0&&r.B_legitimo_resultado===63&&r.B_conservo_al_nuevo&&r.C_nombre==='Regional 0'&&r.C_bw_no_se_pego;
 console.log('\nTODO CORRECTO:',ok);
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

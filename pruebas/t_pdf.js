const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1400,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8972/livecast.html?evento=suda2026_fesupo_full',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.RECSUDA&&typeof DATA!=='undefined'&&DATA.athletes&&DATA.athletes.length,null,{timeout:15000});
 const out=await p.evaluate(async()=>{
   const cap={tablas:[],lineas:0,saved:null};
   class FakeDoc{
     constructor(){this.lastAutoTable={finalY:60};}
     setTextColor(){}setFont(){}setFontSize(){}addPage(){}setPage(){}text(){}
     setDrawColor(){}setLineWidth(){}
     getTextWidth(t){return String(t).length*1.6;}
     line(){cap.lineas++;}
     autoTable(o){
       const est={neg:0,nulo:0,rec:0,normal:0};
       o.body.forEach((row,ri)=>row.forEach((_,ci)=>{
         const d={section:'body',row:{index:ri},column:{index:ci},
           cell:{raw:row[ci],styles:{},text:[String(row[ci])],x:0,y:0,width:10,height:5}};
         o.didParseCell(d);
         const s=d.cell.styles;
         if(s.fillColor&&s.fillColor[0]===247)est.rec++;
         else if(s.textColor&&s.textColor[0]===130)est.nulo++;
         else if(s.fontStyle==='bold')est.neg++;
         else est.normal++;
         o.didDrawCell(d);
       }));
       cap.tablas.push(est);
       this.lastAutoTable={finalY:60};
     }
     internal={getNumberOfPages:()=>1};
     save(n){cap.saved=n;}
   }
   window.jspdf={jsPDF:FakeDoc};
   isAdmin=true;window.IS_CONTROLLER=true;
   pickEvent(DATA.events.findIndex(e=>e.id==="suda2026_fesupo_full"));
   DATA.athletes.forEach((a,i)=>{
     a.bw=(parseFloat(String(a.cat).replace(/[^0-9.]/g,''))||100)-0.4;
     const solo=a.mod==='onlybench', base={sq:170,bp:110,dl:190};
     ['sq','bp','dl'].forEach(l=>{ if(solo&&l!=='bp')return;
       for(let j=0;j<3;j++){a.att[l][j].w=base[l]+j*7.5+(i%6)*5; a.att[l][j].r=(j===2&&i%3===0)?'n':'g';} });
   });
   await exportActaFesupoPDF();
   const t=cap.tablas.reduce((s,x)=>({neg:s.neg+x.neg,nulo:s.nulo+x.nulo,rec:s.rec+x.rec,normal:s.normal+x.normal}),{neg:0,nulo:0,rec:0,normal:0});
   return {archivo:cap.saved,tablas:cap.tablas.length,celdas:t,tachones:cap.lineas};
 });
 console.log(JSON.stringify(out,null,1));
 console.log('tachones == celdas nulas:', out.tachones===out.celdas.nulo);
 console.log('errores:',errs.length?errs.slice(0,3):'ninguno');
 await b.close();
})();

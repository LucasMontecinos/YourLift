// Los discos de la barra tienen que verse como discos calibrados de powerlifting,
// no como bumpers de halterofilia.
//
// En el Regional Norte avisaron que en la pantalla se veían muy gruesos. Un 25 kg
// de competencia mide 45 cm de diámetro por unos 3 cm de canto: la proporción real
// es de más o menos 1 a 15, y estaban dibujados a 1 a 4,4. Se les bajó el ancho a
// la mitad, en todos los tipos de disco, en las dos vistas grandes: la pantalla de
// tarima y el overlay de OBS.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_discos.js
const { chromium } = require('playwright');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// 192.5 kg carga 25+25+25+5+2.5+1.25 por lado: entran discos grandes y chicos.
const MONTAR = `(()=>{
  const nueve=()=>({sq:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],bp:[{w:0,r:null},{w:0,r:null},{w:0,r:null}],dl:[{w:0,r:null},{w:0,r:null},{w:0,r:null}]});
  DATA.phase='compete'; DATA.lift='sq'; DATA.round=0; DATA.flight='A';
  DATA.event={id:'x',name:'Regional Norte FECHIPO 2026'};
  const a={id:1,name:'Atleta de prueba',lot:101,flight:'A',sex:'Hombre',cat:'93',div:'Junior',
    mod:'classic',bw:92,club:'Club',bombed:false,rackSQ:'14',att:nueve()};
  a.att.sq[0]={w:192.5,r:null};
  DATA.athletes=[a];
  window._SCREEN_STATE={mode:'intentos',flights:null};
  if(typeof renderTxWidget==='function')renderTxWidget();
})()`;

async function montar(b, tx) {
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8972/livecast.html?tx=' + tx + '&evento=suda2026_fesupo_full',
    { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof DATA !== 'undefined', null, { timeout: 20000 });
  await p.evaluate(MONTAR);
  await p.waitForTimeout(600);
  return { p, errs };
}

// Los discos son los <rect> de color (los grises son barra, collar y brillos).
const DISCOS = () => [...document.querySelectorAll('svg rect')]
  .map(r => ({ w: +r.getAttribute('width'), h: +r.getAttribute('height'), fill: (r.getAttribute('fill') || '').toLowerCase() }))
  .filter(r => r.h > 15 && /^#(dc2626|2563eb|d97706|16a34a|e5e7eb|111827|b91c1c|1e40af|b45309|15803d|d1d5db|ef4444|9ca3af)$/.test(r.fill));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\nPantalla de tarima');
  {
    const { p, errs } = await montar(b, 'screen');
    const d = await p.evaluate(DISCOS);
    ok(d.length === 6, 'se dibujan los 6 discos del lado (25·3 + 5 + 2.5 + 1.25): ' + d.length);
    // Lo que se pidió es la mitad de canto, disco por disco. Se identifican por su
    // alto, que es único: el color se repite (el 20 y el 1.25 son los dos azules).
    const ANTES = { 280: 64, 250: 58, 222: 52, 190: 46, 150: 38, 112: 34, 86: 26 };
    const mal = d.filter(x => ANTES[x.h] && x.w !== Math.round(ANTES[x.h] / 2));
    ok(mal.length === 0, 'cada disco quedó a la mitad de su canto' +
      (mal.length ? ': ' + mal.map(x => x.w + '×' + x.h + ' (esperaba ' + Math.round(ANTES[x.h] / 2) + ')').join(', ') : ''));
    const g = d.find(x => x.fill === '#dc2626');
    ok(g && g.w === 32, 'el de 25 kg mide 32 de canto, la mitad de los 64 de antes (' + (g && g.w) + ')');
    ok(d.every(x => x.w >= 8), 'y ninguno queda tan fino que no se vea (mínimo 8)');
    // Los grandes son los que dominan la imagen: ahí la proporción tiene que
    // acercarse a la de un disco real (1 a 15). Los chiquitos son cortos igual.
    const grandes = d.filter(x => x.h >= 150);
    ok(grandes.every(x => x.w / x.h <= 0.13), 'los grandes quedan finos: ' +
      grandes.map(x => x.w + '×' + x.h).join(', '));

    console.log('\n  Los números se siguen leyendo');
    const t = await p.evaluate(() => [...document.querySelectorAll('svg text')]
      .filter(e => /^(25|20|15|10|5|2\.5|1\.25)$/.test(e.textContent.trim()))
      .map(e => ({ txt: e.textContent.trim(), fs: +e.getAttribute('font-size'), rot: /rotate/.test(e.getAttribute('transform') || '') })));
    ok(t.length === 6, 'cada disco lleva su número: ' + t.map(x => x.txt).join(' '));
    ok(t.every(x => x.rot), 'todos rotados — de canto un disco fino no da el ancho');
    ok(t.every(x => x.fs >= 13), 'con cuerpo suficiente para leerse desde la platea (mínimo ' +
      Math.min(...t.map(x => x.fs)).toFixed(1) + ')');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  }

  console.log('\nOverlay de OBS (barra con discos)');
  {
    const { p, errs } = await montar(b, 'barbell');
    const d = await p.evaluate(DISCOS);
    ok(d.length === 12, 'se dibujan los dos lados de la barra: ' + d.length + ' discos');
    const ANTES2 = { 88: 24, 80: 22, 72: 20, 62: 18, 50: 16, 38: 13, 28: 11 };
    const mal2 = d.filter(x => ANTES2[x.h] && x.w > Math.ceil(ANTES2[x.h] / 2));
    ok(mal2.length === 0, 'cada disco quedó a la mitad de su canto' +
      (mal2.length ? ': ' + mal2.map(x => x.w + '×' + x.h).join(', ') : ''));
    const g = d.find(x => x.fill === '#b91c1c');
    ok(g && g.w === 12, 'el de 25 kg mide 12 de canto, la mitad de los 24 de antes (' + (g && g.w) + ')');

    // El brillo tiene que quedar DENTRO del disco en los dos lados: antes el de la
    // izquierda se dibujaba a 4 px fijos del borde y con el disco fino se salía.
    const fuera = await p.evaluate(() => {
      const rs = [...document.querySelectorAll('svg rect')].map(r => ({
        x: +r.getAttribute('x'), w: +r.getAttribute('width'), h: +r.getAttribute('height'),
        fill: (r.getAttribute('fill') || '').toLowerCase()
      }));
      const discos = rs.filter(r => r.h > 15 && r.fill.startsWith('#'));
      const brillos = rs.filter(r => /rgba\(255,255,255/.test(r.fill));
      return brillos.filter(br => !discos.some(p => br.x >= p.x - 0.01 && br.x + br.w <= p.x + p.w + 0.01)).length;
    });
    ok(fuera === 0, 'los brillos quedan dentro de su disco en los dos lados');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  }

  console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

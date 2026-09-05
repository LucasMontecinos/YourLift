// Entrar a una competencia por el link (o el QR) de la dirección.
//
// Escaneando el QR pasaba esto: la pantalla mostraba el selector de campeonatos
// diciendo "NO HAY COMPETENCIAS EN VIVO", pestañeaba un par de segundos y
// después entraba sola, sin que nadie tocara nada. Se veía como si algo hubiera
// fallado y se hubiera arreglado solo.
//
// Eran dos cosas distintas:
//
//   · La MENTIRA. Con ?evento=… la persona ya eligió; no viene a elegir de una
//     lista. Pero los datos tardan —nominas.json y los campeonatos de Firestore—
//     y mientras tanto se dibujaba el selector vacío, que además afirma algo
//     falso: sí hay competencia, todavía no termina de cargar.
//
//   · El PESTAÑEO. El selector se vuelve a dibujar varias veces mientras cargan
//     los datos (las nóminas, los campeonatos, el conteo de atletas de cada uno).
//     El contenedor lleva una animación de aparecer, así que cada reescritura la
//     disparaba de nuevo.
//
// Acá se prueban las dos con la carga frenada a propósito, que es la única forma
// de ver lo que ve alguien con mala señal en el recinto.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_entradaqr.js
const fs = require('fs');
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// Abre el livecast como espectador, con nominas.json llegando tarde.
async function abrir(b, url, demoraMs) {
  const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/firebasejs/**', r => r.abort());
  await p.route('**/nominas.json*', async r => {
    await new Promise(res => setTimeout(res, demoraMs));
    await r.continue();
  });
  // Se vigila lo que va apareciendo en pantalla desde el primer momento.
  await p.addInitScript(() => {
    window.__vistas = [];
    const mirar = () => {
      const el = document.getElementById('R');
      if (el) {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        const u = window.__vistas[window.__vistas.length - 1];
        if (!u || u.txt !== t) window.__vistas.push({ txt: t, ts: Date.now() });
      }
      requestAnimationFrame(mirar);
    };
    requestAnimationFrame(mirar);
  });
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  return { p, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  process.on('uncaughtException', async e => {
    console.log('\n  ✗ la prueba reventó: ' + (e && e.message));
    try { await b.close(); } catch (x) {}
    process.exit(1);
  });

  console.log('\nCon la carga lenta, no dice que no hay competencias');
  {
    const { p, errs } = await abrir(b,
      `http://localhost:${PUERTO}/livecast.html?evento=suda2026`, 2500);
    await p.waitForTimeout(1200);           // en plena espera
    const txt = await p.evaluate(() => (document.getElementById('R').innerText || ''));
    ok(/ENTRANDO A LA COMPETENCIA/i.test(txt), 'dice que está entrando');
    ok(!/NO HAY COMPETENCIAS EN VIVO/i.test(txt),
       'y NO dice que no hay ninguna, que es falso mientras carga');

    await p.waitForTimeout(3500);           // ya llegaron las nóminas
    const vistas = await p.evaluate(() => window.__vistas.map(v => v.txt));
    ok(!vistas.some(v => /NO HAY COMPETENCIAS EN VIVO/i.test(v)),
       'en ningún momento del arranque se asomó ese mensaje');
    const fin = await p.evaluate(() => ({
      fase: DATA.phase, ev: DATA.event && (DATA.event.id || DATA.event.name),
      esperando: window._EV_ESPERANDO,
    }));
    ok(fin.ev === 'suda2026' || /Sudamericano/i.test(String(fin.ev)),
       'entró al campeonato del link: ' + fin.ev);
    ok(fin.esperando === false, 'y la espera quedó apagada');
    ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs[0] : ''));
    await p.close();
  }

  console.log('\n  La pantalla de espera se queda quieta, no pestañea');
  {
    const { p } = await abrir(b,
      `http://localhost:${PUERTO}/livecast.html?evento=suda2026`, 3000);
    await p.waitForTimeout(2200);
    const v = await p.evaluate(() => window.__vistas.map(x => x.txt));
    // Se permite el arranque en blanco y la pantalla de espera; nada más.
    const distintas = [...new Set(v.filter(Boolean))];
    ok(distintas.length <= 1,
       'mientras espera hay una sola pantalla' + (distintas.length > 1 ? ': ' + JSON.stringify(distintas) : ''));
    await p.close();
  }

  console.log('\n  Sin ?evento= sigue mostrando la lista, como siempre');
  {
    const { p } = await abrir(b, `http://localhost:${PUERTO}/livecast.html`, 300);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({
      esperando: window._EV_ESPERANDO,
      txt: (document.getElementById('R').innerText || '').slice(0, 200),
    }));
    ok(r.esperando === false, 'no se queda esperando un evento que nadie pidió');
    ok(!/ENTRANDO A LA COMPETENCIA/i.test(r.txt), 'ni muestra la pantalla de entrada');
    await p.close();
  }

  console.log('\n  Un campeonato de varios días sí muestra sus jornadas');
  {
    // Elegir el día ES la pantalla que corresponde, no un tropiezo de carga: el
    // campeonato padre no tiene atletas propios. Sus días viven en Firestore, que
    // acá está cortado, así que se le entrega uno a mano y se le pide que resuelva
    // el link de nuevo — que es lo mismo que hace al llegar los datos de verdad.
    const { p } = await abrir(b,
      `http://localhost:${PUERTO}/livecast.html?evento=campeonato-de-varios-dias`, 200);
    await p.waitForFunction(() => typeof applyEventURLParam === 'function', null, { timeout: 20000 });
    const r = await p.evaluate(() => {
      DATA.events.push({ id: 'campeonato-de-varios-dias_d1', name: 'Camp X — Día 1',
        parent: 'campeonato-de-varios-dias', parentName: 'Camp X', athletes: [] });
      DATA.events.push({ id: 'campeonato-de-varios-dias_d2', name: 'Camp X — Día 2',
        parent: 'campeonato-de-varios-dias', parentName: 'Camp X', athletes: [] });
      applyEventURLParam();
      return { esperando: window._EV_ESPERANDO,
               flt: window._EV_FILTER && window._EV_FILTER.parent,
               txt: (document.getElementById('R').innerText || '').replace(/\s+/g, ' ') };
    });
    ok(r.flt === 'campeonato-de-varios-dias', 'queda dentro del campeonato: ' + r.flt);
    ok(r.esperando === false, 'y deja de esperar: esta pantalla sí corresponde');
    ok(/jornadas/i.test(r.txt), 'ofrece elegir la jornada');
    await p.close();
  }

  console.log('\n  Si el link apunta a algo que no existe, lo dice');
  {
    const { p } = await abrir(b,
      `http://localhost:${PUERTO}/livecast.html?evento=no-existe-este-campeonato`, 200);
    // La espera se agota sola; se le da tiempo a los reintentos.
    await p.waitForFunction(() => window._EV_ESPERANDO === false, null, { timeout: 25000 });
    const txt = await p.evaluate(() => (document.getElementById('R').innerText || ''));
    ok(!/ENTRANDO A LA COMPETENCIA/i.test(txt),
       'no se queda para siempre en "entrando"');
    await p.close();
  }

  await b.close();

  console.log('\n  Queda escrito en el código');
  {
    const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');
    ok(/window\._EV_ESPERANDO=/.test(lc), 'la marca de "vengo por un link" existe');
    ok(/if\(el\.innerHTML!==_nuevo\)el\.innerHTML=_nuevo/.test(lc),
       'y el selector no se reescribe si va a quedar igual');
    ok(/_applyEvtRetries<=6\?150:500/.test(lc),
       'los primeros reintentos van seguidos, para no esperar de más');
  }

  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

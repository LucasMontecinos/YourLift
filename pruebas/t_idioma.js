// Idioma de la interfaz: español, inglés o portugués (compartido/idioma.js).
//
// En español no se carga ningún diccionario. Con ?lang=en o eligiendo EN/PT en
// el selector, los textos de la página se traducen —también los que se dibujan
// después— y se puede volver al español sin recargar. La elección se recuerda.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_idioma.js
const { chromium } = require('playwright');
const PUERTO = process.env.PUERTO || '8972';
let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };
const URL = `http://localhost:${PUERTO}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  console.log('\nIndex');
  {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('index: ' + e.message));
    const dics = []; p.on('request', r => { if (/compartido\/idioma\/(en|pt)\.js/.test(r.url())) dics.push(r.url()); });
    await p.goto(URL + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.getElementById('menuItems') && document.getElementById('menuItems').innerText.length > 20, null, { timeout: 20000 });
    await p.waitForTimeout(800);
    const menu = () => p.evaluate(() => document.getElementById('menuItems').innerText.replace(/\s+/g, ' '));
    ok(/COMPETENCIA EN VIVO/i.test(await menu()) && dics.length === 0, 'en español no se carga ningún diccionario');
    ok(await p.evaluate(() => document.querySelectorAll('[data-yl-idioma] button').length >= 3), 'el selector ES · EN · PT está en la página');
    await p.click('[data-yl-idioma] button[data-l="en"]');
    await p.waitForFunction(() => /Live Competition/i.test(document.getElementById('menuItems').innerText), null, { timeout: 8000 }).catch(() => {});
    ok(/Live Competition/i.test(await menu()), 'EN: el menú en inglés (' + (await menu()).slice(0, 60) + ')');
    ok(await p.evaluate(() => document.documentElement.lang === 'en'), 'el documento queda con lang="en"');
    // Lo que se dibuja después también.
    const tarde = await p.evaluate(async () => { const d = document.createElement('div'); d.textContent = 'Inscripciones abiertas'; document.body.appendChild(d); await new Promise(r => setTimeout(r, 50)); return d.textContent; });
    ok(tarde === 'Registration open', 'un texto agregado después también se traduce: ' + tarde);
    await p.click('[data-yl-idioma] button[data-l="pt"]');
    await p.waitForFunction(() => /Competição ao Vivo/i.test(document.getElementById('menuItems').innerText), null, { timeout: 8000 }).catch(() => {});
    ok(/Competição ao Vivo/i.test(await menu()), 'PT: el menú en portugués');
    await p.click('[data-yl-idioma] button[data-l="es"]');
    await p.waitForTimeout(400);
    ok(/COMPETENCIA EN VIVO/i.test(await menu()), 'ES: vuelve al español sin recargar');
    await p.click('[data-yl-idioma] button[data-l="en"]');
    await p.waitForTimeout(300);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => /Live Competition/i.test((document.getElementById('menuItems') || {}).innerText || ''), null, { timeout: 15000 }).catch(() => {});
    ok(/Live Competition/i.test(await menu()), 'la elección se recuerda al volver a entrar');
    await ctx.close();
  }

  console.log('\nLivecast (Control en Vivo)');
  {
    const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    p.on('pageerror', e => errs.push('livecast: ' + e.message));
    await p.goto(URL + '/livecast.html?practica=1&lang=pt', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof DATA !== 'undefined' && DATA.athletes && DATA.athletes.length > 2, null, { timeout: 20000 });
    await p.evaluate(() => { if (typeof go === 'function') go('compete'); });
    await p.waitForTimeout(1500);
    const txt = await p.evaluate(() => document.body.innerText);
    ok(/Controle ao Vivo/.test(txt) && /JULGANDO AGORA/.test(txt), 'menú y Control en Vivo en portugués');
    ok(/SESSÃO B/.test(txt), '"TANDA B" → "SESSÃO B" (la letra queda)');
    ok(/Práctica\)/.test(txt), 'los nombres de los atletas no se tocan');
    let pr = ''; p.once('dialog', d => { pr = d.message(); d.dismiss(); });
    await p.evaluate(() => prompt('Nuevo peso (kg):'));
    ok(pr === 'Novo peso (kg):', 'los cuadros del navegador también: ' + pr);
  }

  ok(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
  process.exit(fallas ? 1 : 0);
})();

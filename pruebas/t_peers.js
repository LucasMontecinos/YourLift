// Comparativa en categoría: se calcula desde el padrón, no desde una tabla pegada
// a mano. Un resultado nuevo tiene que aparecer sin tocar el HTML.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_peers.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../atleta.html', 'utf8');

function sacar(nombre) {
  const i = src.search(new RegExp('(?:^|\\n)function ' + nombre + '\\('));
  if (i < 0) throw new Error('no encontré ' + nombre);
  const start = src.lastIndexOf('\n', i + 1) + 1;
  let p = start, open = 0, abrio = false;
  while (p < src.length) {
    const c = src[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    p++;
  }
  return src.slice(start, p);
}
eval(['getPeerKey', '_peerMejor', '_peersBuild', 'peerPerc'].map(sacar).join('\n'));

const db = JSON.parse(fs.readFileSync(__dirname + '/../data.json', 'utf8'));
const PEERS = _peersBuild(db);

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

console.log('\nGrupos armados desde data.json');
ok(Object.keys(PEERS).length > 30, Object.keys(PEERS).length + ' grupos');
const g = PEERS['M|120+|Open|classic'];
ok(!!g, 'existe M|120+|Open|classic');

console.log('\nSergio Mardones — el caso que reportó');
const sergio = g.members.find(m => m.codigo === '1718SMM-2025');
ok(!!sergio, 'está en el top de su categoría');
ok(sergio && sergio.total === 952.5, `sale con su mejor total, el del Mundial: ${sergio && sergio.total} kg (antes salía 860)`);
ok(g.top === 952.5, 'y el tope del grupo se actualiza: ' + g.top);

console.log('\nCoherencia de cada grupo');
const malos = Object.entries(PEERS).filter(([k, v]) =>
  v.top !== v.members[0].total || v.members.length > 10 || v.n < v.members.length ||
  v.members.some((m, i, a) => i && a[i - 1].total < m.total));
ok(malos.length === 0, 'top = primer miembro, máximo 10 miembros, orden descendente' +
   (malos.length ? ' — fallan ' + malos.slice(0, 3).map(x => x[0]).join(', ') : ''));
const sinNum = Object.entries(PEERS).filter(([k, v]) =>
  ![v.avg, v.p25, v.p50, v.p75, v.top].every(x => typeof x === 'number' && isFinite(x)));
ok(sinNum.length === 0, 'promedio y percentiles son números en todos los grupos');
const fueraDeRango = Object.entries(PEERS).filter(([k, v]) => !(v.p25 <= v.p50 && v.p50 <= v.p75 && v.p75 <= v.top));
ok(fueraDeRango.length === 0, 'p25 ≤ p50 ≤ p75 ≤ top' +
   (fueraDeRango.length ? ' — falla ' + fueraDeRango[0][0] : ''));

console.log('\nCada atleta se compara contra su propia categoría');
const cruces = [];
Object.entries(PEERS).forEach(([k, v]) => {
  const cat = k.split('|')[1], modal = k.split('|')[3];
  v.members.forEach(m => {
    const a = db.find(x => x.codigo === m.codigo);
    const calza = (a.competencias || []).some(c => {
      const r = c.resultado || {};
      const mm = String(c.modalidad || '').toLowerCase().includes('equip') ? 'equipped' : 'classic';
      return r.total === m.total && String(c.categoria || '').trim() === cat && mm === modal;
    });
    if (!calza) cruces.push(k + ' → ' + m.nombre + ' ' + m.total);
  });
});
ok(cruces.length === 0, 'el total de cada miembro sale de una competencia suya en esa categoría y modalidad' +
   (cruces.length ? ' — ' + cruces.slice(0, 3).join(' | ') : ''));

console.log('\nUn resultado nuevo entra solo');
const copia = JSON.parse(JSON.stringify(db));
const s2 = copia.find(a => a.codigo === '1718SMM-2025');
s2.competencias.unshift({ evento: 'Inventado 2026', fecha: '2026-07-01', division: 'Open',
  categoria: '120+', modalidad: 'Powerlifting Classic IPF', sexo: 'Hombre',
  resultado: { bw: 180, sq: 430, bp: 230, dl: 320, total: 980, glp: 97 } });
const P2 = _peersBuild(copia);
ok(P2['M|120+|Open|classic'].members[0].total === 980, 'sin tocar el HTML, el nuevo total encabeza la categoría');

console.log('\nEl percentil sigue funcionando');
const p = peerPerc(952.5, 'M|120+|Open|classic');
ok(p && p.rank === 1, 'Mardones queda #' + (p && p.rank) + ' con 952,5');
ok(p && p.pct >= 0 && p.pct <= 100, 'percentil dentro de rango: ' + (p && p.pct));

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

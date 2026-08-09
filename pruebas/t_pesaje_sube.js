// La apertura cargada en el modal de PESAJE tiene que llegar a Firestore.
//
// El bug de competencia: el BW y las alturas de rack subían, pero los primeros
// intentos cargados en ese mismo modal —o en el que sale al apretar el nombre del
// atleta en Control en Vivo, que es el MISMO modal— no llegaban ni al público ni a
// la pantalla de tarima, y al recargar la página desaparecían. Causa: confirmWeighIn
// escribía att[l][0].w sin marcar la celda, y el merge de escritura parte del estado
// REMOTO y solo le pega encima las celdas marcadas. Sin marca, la apertura se perdía.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_pesaje_sube.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

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

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

// ── Entorno mínimo ───────────────────────────────────────────────────────────
global.window = global;
window._recentAtt = {};
window._pendingEdits = new Set();
const _MERGE_META_FIELDS = ['bw','rackSQ','rackBP','sqAbat','bpSeg','bpPalm','mod','country',
  'flight','lot','bombed','weighedIn','jornada','name','div','cat','sex','club','uni'];
eval(sacar('_markAtt'));
eval(sacar('_nnCrono'));
eval(sacar('_mergeForWrite'));

const att = () => ({ sq: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                     bp: [{w:0,r:null},{w:0,r:null},{w:0,r:null}],
                     dl: [{w:0,r:null},{w:0,r:null},{w:0,r:null}] });
const DATA = { athletes: [
  { id: 1, name: 'Javiera Burgos', lot: 101, flight: 'A', cat: '76', div: 'Open',
    mod: 'classic', bw: 0, rackSQ: '', rackBP: '', weighedIn: false, att: att() },
] };
global.DATA = DATA;

// El modal, tal cual: BW + racks + apertura. Se replica lo que hace confirmWeighIn
// en el archivo real, extrayendo solo su cuerpo de guardado.
const a = DATA.athletes[0];
a.bw = 74.8; a.rackSQ = '14'; a.rackBP = '7'; a.mod = 'classic';
_markAtt(a.id, 'meta');
a.weighedIn = true;
// ↓ estas tres líneas son las que arreglan el bug (marcar cada celda tocada)
a.att.sq[0].w = 120; _markAtt(a.id, 'att_sq_0');
a.att.bp[0].w = 60;  _markAtt(a.id, 'att_bp_0');
a.att.dl[0].w = 140; _markAtt(a.id, 'att_dl_0');

console.log('\nEl código real marca las tres celdas de apertura');
const cuerpo = sacar('confirmWeighIn');
ok(/att\.sq\[0\]\.w\s*=\s*sq1;\s*_markAtt\(id,'att_sq_0'\)/.test(cuerpo), 'SQ 1 queda marcada');
ok(/att\.bp\[0\]\.w\s*=\s*bp1;\s*_markAtt\(id,'att_bp_0'\)/.test(cuerpo), 'BP 1 queda marcada');
ok(/att\.dl\[0\]\.w\s*=\s*dl1;\s*_markAtt\(id,'att_dl_0'\)/.test(cuerpo), 'DL 1 queda marcada');

console.log('\nLa apertura sobrevive al merge de escritura');
// Lo que hay en el servidor: el atleta sin pesar (lo que ven los otros PCs).
const remoto = [{ id: 1, name: 'Javiera Burgos', lot: 101, flight: 'A', cat: '76', div: 'Open',
  mod: 'classic', bw: 0, rackSQ: '', rackBP: '', weighedIn: false, att: att() }];
const salida = _mergeForWrite(DATA.athletes, remoto);
const s = salida[0];
ok(s.bw === 74.8, 'el peso corporal sube: ' + s.bw);
ok(s.rackSQ === '14' && s.rackBP === '7', 'las alturas de rack suben');
ok(s.att.sq[0].w === 120, 'la apertura de sentadilla sube: ' + s.att.sq[0].w);
ok(s.att.bp[0].w === 60,  'la apertura de banca sube: ' + s.att.bp[0].w);
ok(s.att.dl[0].w === 140, 'la apertura de peso muerto sube: ' + s.att.dl[0].w);

console.log('\nSin la marca la apertura se perdía (es el bug de ayer)');
window._pendingEdits = new Set();
_markAtt(a.id, 'meta');            // solo meta, como hacía la versión con el bug
const viejo = _mergeForWrite(DATA.athletes, remoto)[0];
ok(viejo.bw === 74.8, 'el BW igual subía — por eso el bug costaba de ver');
ok(viejo.att.sq[0].w === 0, 'y la apertura se perdía: quedaba en ' + viejo.att.sq[0].w);

console.log('\nEl borrado de pesaje también viaja');
window._pendingEdits = new Set();
// clearWeighIn se declara como window.clearWeighIn = function(id){…}, así que no
// la toma `sacar` (que busca `function nombre(`): se corta a mano.
const iClear = src.indexOf('window.clearWeighIn');
const cuerpoClear = src.slice(iClear, iClear + 1600);
ok(/_markAtt\(id,'att_'\+l\+'_'\+r\)/.test(cuerpoClear), 'clearWeighIn marca cada celda que borra');
ok(/_markAtt\(id,'meta'\)/.test(cuerpoClear), 'y marca el meta (BW, racks, weighedIn)');
// El servidor tiene la apertura; yo la borré local → tiene que quedar borrada.
const remoto2 = JSON.parse(JSON.stringify(salida));
['sq','bp','dl'].forEach(l => a.att[l].forEach((t, r) => { t.w = 0; t.r = null; _markAtt(a.id, 'att_' + l + '_' + r); }));
a.bw = 0; _markAtt(a.id, 'meta');
const borrado = _mergeForWrite(DATA.athletes, remoto2)[0];
ok(borrado.att.sq[0].w === 0 && borrado.bw === 0, 'el borrado no revive desde el servidor');

console.log('\nNo se pisa lo que cargó OTRO control');
window._pendingEdits = new Set();
a.att.sq[0].w = 120; _markAtt(a.id, 'att_sq_0');   // solo toqué la sentadilla
const otro = JSON.parse(JSON.stringify(remoto));
otro[0].att.bp[0] = { w: 65, r: null };            // el otro PC cargó la banca
const mix = _mergeForWrite(DATA.athletes, otro)[0];
ok(mix.att.sq[0].w === 120, 'mi apertura de sentadilla se mantiene');
ok(mix.att.bp[0].w === 65, 'y la banca del otro control no se borra: ' + mix.att.bp[0].w);

console.log(fallas ? `\n${fallas} FALLA(S)\n` : '\nTODO OK\n');
process.exit(fallas ? 1 : 0);

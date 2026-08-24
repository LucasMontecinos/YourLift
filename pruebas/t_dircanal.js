// El widget tiene que escuchar el MISMO documento en el que escribe el control.
//
// Lo que pasó en competencia: se apretaba perfil, marcador o medallero en el
// control remoto, el panel lo marcaba en verde, y en pantalla no pasaba nada.
// Ni con el medallero, ni con el marcador, ni con el perfil. Nada, toda la
// jornada, y recargar el navegador no lo arreglaba.
//
// La causa: el documento del director se llama 'current__<Evento>', o sea que su
// nombre depende de que el evento ya esté resuelto. El evento se resuelve DESPUÉS
// de que Firebase queda listo, porque hay que bajar nominas.json primero. El
// widget se suscribía a lo primero que hubiera —'current', el id viejo de
// compatibilidad— y no volvía a mirar nunca más. El control, mientras tanto,
// escribía en 'current__<Evento>'. Dos documentos distintos, y ningún error en
// ninguna parte: el comando salía bien y no llegaba a nadie.
//
// Es una carrera, así que a veces salía bien y a veces no. Dentro de OBS sale mal
// más seguido: el browser source arranca en frío y cada cambio de escena que
// reinicia la fuente vuelve a tirar los dados.
//
// Lo que se cuida:
//   · que el widget se re-suscriba cuando el id del documento cambia;
//   · que suelte la suscripción vieja en vez de dejar dos escuchando;
//   · que una vez resuelto el evento se quede quieto y no re-suscriba de más;
//   · y que el control y el widget calculen el mismo id, que es lo que hace que
//     el comando llegue.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node t_dircanal.js
const fs = require('fs');
const lc = fs.readFileSync(__dirname + '/../livecast.html', 'utf8');

let fallas = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fallas++; };

function sacar(texto, nombre) {
  const i = texto.search(new RegExp('(?:^|\\n)function ' + nombre + '\\('));
  if (i < 0) throw new Error('no encontré ' + nombre);
  const start = texto.lastIndexOf('\n', i + 1) + 1;
  let p = start, open = 0, abrio = false;
  while (p < texto.length) {
    const c = texto[p];
    if (c === '{') { open++; abrio = true; }
    else if (c === '}') { open--; if (abrio && open === 0) { p++; break; } }
    p++;
  }
  return texto.slice(start, p);
}

// Monta el listener del widget con un Firestore de mentira. `evento` es una caja
// mutable: empieza en null (todavía no se resolvió) y después se llena, que es
// justo la carrera que rompía esto.
function montar(evento) {
  const subs = [];          // cada suscripción hecha, en orden
  const vivas = new Set();  // las que siguen escuchando
  const timers = new Set();

  const fbReady = true;
  const fbDB = {};
  const TX_DIR_DEFAULT = { profile: { active: false, until: 0 }, medals: { active: false, until: 0 } };
  let _txDirState = null, _txDirUnsub = null, _txDirUnsubDocId = null, _txDirPoll = null, _txDirLastSig = null;

  const fbDocId = () => evento.nombre ? evento.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 55) : null;
  const txDocId = base => base;
  const evStateDocId = base => { const ev = fbDocId(); return ev ? (base + '__' + ev) : txDocId(base); };

  const setInterval = (fn) => { const t = { fn }; timers.add(t); return t; };
  const clearInterval = t => { timers.delete(t); };
  const renderTxWidget = () => {};
  const console = { log() {}, warn() {} };

  const window = {
    _fb: {
      doc: (db, col, id) => ({ col, id }),
      onSnapshot: (ref, cb) => {
        const s = { docId: ref.id, cb, viva: true };
        subs.push(s); vivas.add(s);
        return () => { s.viva = false; vivas.delete(s); };
      }
    }
  };

  // eslint-disable-next-line no-eval
  eval(sacar(lc, '_txStartDirectorListener'));

  return {
    correr: () => _txStartDirectorListener(),
    // Simula que el control escribió en `docId`. Devuelve si al widget le llegó.
    mandarComando: (docId, show) => {
      let llego = false;
      vivas.forEach(s => {
        if (s.docId === docId) { s.cb({ exists: () => true, data: () => ({ show }) }); llego = true; }
      });
      return llego;
    },
    subs, vivas,
    estado: () => _txDirState
  };
}

console.log('\nEl widget se suscribe aunque el evento no esté resuelto todavía');
const evento = { nombre: null };
const w = montar(evento);
{
  w.correr();
  ok(w.subs.length === 1, 'se suscribe apenas Firebase está listo');
  ok(w.subs[0].docId === 'current', 'y por ahora al id viejo, que es lo único que puede calcular');
}

console.log('\n  Cuando el evento se resuelve, se cambia de documento');
{
  evento.nombre = 'ENSAYO FESUPO Dia 3 completo';
  w.correr();
  ok(w.subs.length === 2, 'se vuelve a suscribir');
  ok(w.subs[1].docId === 'current__ENSAYO_FESUPO_Dia_3_completo', 'ahora sí al documento del evento');
  ok(w.subs[0].viva === false, 'y suelta el viejo, en vez de dejar dos escuchando');
  ok(w.vivas.size === 1, 'queda una sola suscripción viva');
}

console.log('\n  Y ahí sí llega lo que manda el control');
{
  const llego = w.mandarComando('current__ENSAYO_FESUPO_Dia_3_completo', { medals: { active: true, until: 0 } });
  ok(llego === true, 'el comando del medallero llega al widget');
  ok(w.estado().medals.active === true, 'y le prende el medallero');

  const viejo = w.mandarComando('current', { profile: { active: true, until: 0 } });
  ok(viejo === false, 'y ya nadie escucha el documento viejo');
}

console.log('\n  Con el evento resuelto se queda quieto');
{
  const antes = w.subs.length;
  w.correr(); w.correr(); w.correr();
  ok(w.subs.length === antes, 're-renderizar no vuelve a suscribir');
  ok(w.estado().medals.active === true, 'y no le borra el medallero que estaba puesto');
}

console.log('\n  El control y el widget calculan el mismo id');
{
  // Los dos lados tienen que pasar por evStateDocId(). Si uno usara fbDocId() o
  // un id fijo, escribirían y leerían en documentos distintos otra vez.
  const ctrl = lc.slice(lc.indexOf('async function _dirPush()'), lc.indexOf('async function _dirPush()') + 900);
  ok(/livecast_director'\s*,\s*evStateDocId\('current'\)/.test(ctrl), 'el control escribe en evStateDocId(current)');

  const wid = sacar(lc, '_txStartDirectorListener');
  ok(/evStateDocId\('current'\)/.test(wid), 'el widget calcula el id con la misma función');
  ok(!/if\(_txDirUnsub\)return;/.test(wid), 'y ya no se planta con la primera suscripción que hizo');
  ok(/_txDirUnsubDocId/.test(wid), 'compara contra el id que ya está escuchando');
}

console.log('\n  Los avisos de récord tenían el mismo problema');
{
  const rec = sacar(lc, '_txCerStartRecordListener');
  ok(!/if\(_txCerRecordUnsub\|\|/.test(rec), 'ya no se planta con la primera suscripción');
  ok(/_txCerRecordUnsubDocId/.test(rec), 'también compara el id del documento');
}

console.log('\n  La pantalla de tarima nunca tuvo el problema, y se cuida que siga así');
{
  const scr = sacar(lc, 'subscribeScreenChannel');
  ok(/const id=_screenDocId\(\);if\(!id\)return;/.test(scr),
    'espera a tener evento antes de suscribirse, en vez de caer a un id viejo');
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);

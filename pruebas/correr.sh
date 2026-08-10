#!/bin/sh
# Batería de pruebas del livecast. Levanta un servidor local, abre el livecast en
# Chromium y ejercita los caminos que importan en competencia. No toca Firestore:
# el sync se simula en memoria.
#   sh pruebas/correr.sh
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8972 >/dev/null 2>&1 &
SRV=$!; sleep 2
cd pruebas || exit 1
for t in t_meet.js t_cruce2.js t_extra.js t_ct.js t_rec.js t_next3.js t_extra_col.js t_sync.js t_sync2.js t_bug.js t_gl.js t_ordenextra.js t_crono.js t_hojaequipo.js t_peers.js t_foco.js t_lote.js t_forzado.js t_recparpadeo.js t_pesaje_sube.js t_ordenvivo.js t_invitado.js t_tandas.js t_obs.js t_pasadas.js t_discos.js t_perfilres.js t_cronodia.js t_pdf.js; do
  echo "════════ $t"
  NODE_PATH=/opt/node22/lib/node_modules "${NODE:-/opt/node22/bin/node}" "$t" 2>&1 | tail -14
done
kill $SRV 2>/dev/null

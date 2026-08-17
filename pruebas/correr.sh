#!/bin/sh
# Batería de pruebas del livecast. Levanta un servidor local, abre el livecast en
# Chromium y ejercita los caminos que importan en competencia. No toca Firestore:
# el sync se simula en memoria.
#   sh pruebas/correr.sh
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8972 >/dev/null 2>&1 &
SRV=$!; sleep 2
cd pruebas || exit 1
for t in t_meet.js t_cruce2.js t_extra.js t_ct.js t_rec.js t_next3.js t_extra_col.js t_sync.js t_sync2.js t_bug.js t_gl.js t_ordenextra.js t_crono.js t_hojaequipo.js t_peers.js t_foco.js t_lote.js t_forzado.js t_recparpadeo.js t_pesaje_sube.js t_ordenvivo.js t_invitado.js t_tandas.js t_obs.js t_pasadas.js t_discos.js t_perfilres.js t_cronodia.js t_marcador.js t_actayl.js t_extraborrado.js t_espectador.js t_streaming.js t_actadia.js t_resfiltros.js t_comparativa.js t_medallero.js t_banderas.js t_barra.js t_buscaratletas.js t_insignia.js t_lucestarima.js t_pantallaestado.js t_motivosnulo.js t_pdf.js; do
  echo "════════ $t"
  # Se guarda la salida completa y se muestra el final; pero si hubo fallas, se
  # imprimen TODAS las líneas con ✗ aunque hayan quedado fuera del recorte. Antes
  # el tail se comía los fallos y solo quedaba "N FALLA(S)" sin decir cuáles.
  out=$(NODE_PATH=/opt/node22/lib/node_modules "${NODE:-/opt/node22/bin/node}" "$t" 2>&1)
  echo "$out" | tail -14
  if echo "$out" | grep -q "FALLA"; then
    echo "  ── fallas de $t ──"
    echo "$out" | grep "✗"
  fi
done
kill $SRV 2>/dev/null

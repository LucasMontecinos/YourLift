#!/bin/sh
# Batería de pruebas del livecast. Levanta un servidor local, abre el livecast en
# Chromium y ejercita los caminos que importan en competencia. No toca Firestore:
# el sync se simula en memoria.
#   sh pruebas/correr.sh
cd "$(dirname "$0")/.." || exit 1
# El puerto tiene que estar libre. Si quedó un servidor de una corrida anterior,
# el que se levanta acá no puede tomarlo y muere en silencio: las pruebas terminan
# hablándole a un servidor viejo, que puede estar sirviendo otra carpeta o estar
# colgado. Pasó: media batería dando timeouts sin motivo aparente.
if python3 -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1',8972))==0 else 1)" 2>/dev/null; then
  echo "✗ El puerto 8972 ya está ocupado — hay otro servidor dando vueltas."
  echo "  Ciérralo antes de correr la batería:  kill \$(ps -eo pid,args | grep '[h]ttp.server' | awk '{print \$1}')"
  exit 1
fi
python3 -m http.server 8972 >/dev/null 2>&1 &
SRV=$!; sleep 2
if ! kill -0 "$SRV" 2>/dev/null; then
  echo "✗ No se pudo levantar el servidor local en 8972."
  exit 1
fi
cd pruebas || exit 1
for t in t_meet.js t_cruce2.js t_extra.js t_ct.js t_rec.js t_next3.js t_extra_col.js t_sync.js t_sync2.js t_bug.js t_gl.js t_ordenextra.js t_crono.js t_hojaequipo.js t_peers.js t_foco.js t_lote.js t_forzado.js t_recparpadeo.js t_pesaje_sube.js t_ordenvivo.js t_invitado.js t_tandas.js t_obs.js t_pasadas.js t_discos.js t_perfilres.js t_cronodia.js t_marcador.js t_actayl.js t_extraborrado.js t_espectador.js t_streaming.js t_actadia.js t_resfiltros.js t_comparativa.js t_medallero.js t_banderas.js t_barra.js t_buscaratletas.js t_insignia.js t_lucestarima.js t_pantallaestado.js t_motivosnulo.js t_juecessesion.js t_barraeditable.js t_yacompitio.js t_lucesapagan.js t_avisobloqueo.js t_medallero2.js t_dostarimas.js t_menoredad.js t_divisiones.js t_glpoints.js t_barridologo.js t_pantallaslinks.js t_luceshistorial.js t_correonomina.js t_dircanal.js t_gafoto.js t_tandas_auto.js t_tandas_reales.js t_basereal.js t_ediciones.js t_teclado.js t_pestaneo.js t_auspiciadores.js t_glranking.js t_solicitudedit.js t_permisosadmin.js t_entrenador.js t_ordenfechas.js t_fotospendientes.js t_cronosuda.js t_sudanomina.js t_pdf.js; do
  echo "════════ $t"
  # Se guarda la salida completa y se muestra el final; pero si hubo fallas, se
  # imprimen TODAS las líneas con ✗ aunque hayan quedado fuera del recorte. Antes
  # el tail se comía los fallos y solo quedaba "N FALLA(S)" sin decir cuáles.
  out=$(NODE_PATH=/opt/node22/lib/node_modules "${NODE:-/opt/node22/bin/node}" "$t" 2>&1)
  cod=$?
  echo "$out" | tail -14
  # El veredicto es el CÓDIGO DE SALIDA, no el texto. Una prueba que revienta —un
  # timeout, un error de Node— no alcanza a imprimir "FALLA", y buscando esa
  # palabra la batería la daba por buena. Así se perdió una falla real.
  if [ "$cod" -ne 0 ]; then
    MALAS="$MALAS $t"
    echo "  ── falló $t (código $cod) ──"
    echo "$out" | grep "✗"
  fi
done
kill $SRV 2>/dev/null
if [ -n "$MALAS" ]; then
  echo ""
  echo "════════ RESULTADO: FALLARON:$MALAS"
  exit 1
fi
echo ""
echo "════════ RESULTADO: todas las pruebas pasaron"

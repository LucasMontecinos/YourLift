# YourLift

Sistema de competencias de powerlifting de FECHIPO: inscripciones, nóminas,
ranking, fichas de atletas y la transmisión en vivo de cada campeonato.
Se publica en **yourlift.cl** con GitHub Pages directo desde la rama `main`:
lo que se sube a `main` queda en el sitio en uno o dos minutos.

## Qué hay en cada lugar

### Páginas (raíz)

Están en la raíz porque sus direcciones son públicas (yourlift.cl/livecast.html,
los QR, los links de OBS). Moverlas rompería esos links.

| Página | Para qué |
|---|---|
| `index.html` | El sitio público: nóminas, récords, cronograma, Competencia en Vivo |
| `inscripcion.html`, `inscripcion_entrenador.html` | Formularios de inscripción |
| `atleta.html`, `ranking.html`, `resultados.html` | Fichas, ranking y resultados |
| `cronograma.html`, `documentos.html` | Cronograma y documentos de cada campeonato |
| `livecast.html` | Competencia en vivo: Control en Vivo, Control TX, pantalla de tarima, widgets de OBS y la vista del público |
| `jueces.html` | Panel de los jueces (luces desde el teléfono) |
| `admin.html` | Panel de administración |
| `entrenador.html`, `videos-admin.html` | Panel del entrenador y videos |

### Código compartido: `compartido/`

Reglas y piezas que usan varias páginas. Se cambian en un solo lugar.

| Archivo | Qué es |
|---|---|
| `canales.js` | Los documentos de Firestore de cada campeonato. Así dos campeonatos a la misma hora no se mezclan |
| `divisiones.js` | División por edad (Sub-Junior, Junior, Open, Master) |
| `ediciones.js` | Correcciones y bajas hechas desde el panel sobre el padrón |
| `clubs.js` | Logos de los clubes |
| `qr.js` | Generador de códigos QR |
| `nacimientos.js` | Año de nacimiento por atleta (generado por `herramientas/build_nacimientos.py`) |
| `paleta.css`, `iconos.css`, `iconos.js` | Colores e íconos del sitio (`iconos.css` se genera con `herramientas/build_iconos.js`) |

### Datos (raíz)

`data.json`, `nominas.json`, `records*.json`, `nomina_sudamericano.json`,
`inscripciones.json`, `entrenadores_db.json`, `jueces_base.json`. Los leen las
páginas con su dirección pública. Lo que cambia en vivo (inscripciones, estado de
la competencia) está en Firestore, no en estos archivos.

### Resto

| Carpeta | Qué es |
|---|---|
| `clubs/`, `eventos/` | Logos de clubes y de campeonatos |
| `reglas/` | Reglas de seguridad de Firestore y Storage |
| `herramientas/` | Scripts para regenerar o corregir datos (ver su README) |
| `pruebas/` | La batería de pruebas automáticas |
| `documentos/` | Guías internas |

Los PDF, planillas y videos de la raíz se quedan ahí porque se comparten por link
directo (formularios de consentimiento, capacitación de jueces).

## Pruebas

```
sh pruebas/correr.sh
```

Levanta un servidor local y abre cada pantalla en un navegador. Firestore se
simula (`pruebas/apoyo/firebase_falso.js`), así que las pruebas no tocan la base
real. El resultado lo da el código de salida: 0 significa que todo pasó.

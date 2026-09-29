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
| `livecast.html` | Competencia en vivo: Control en Vivo, Control TX, pantalla de tarima, widgets de OBS y la vista del público (su código está en `livecast/`) |
| `jueces.html` | Panel de los jueces (luces desde el teléfono) |
| `admin.html` | Panel de administración (su código está en `admin/`) |
| `entrenador.html`, `videos-admin.html` | Panel del entrenador y videos |

### El livecast: `livecast/`

`livecast.html` es solo la página: carga su código desde `livecast/`, un archivo
por tema. Todos se cargan como scripts normales, así que lo que definen es global
igual que antes. Los archivos de tema solo definen funciones; lo que corre al
abrir la página está en `arranque.js`, que va al final y en su orden original.

| Archivo | Qué es |
|---|---|
| `reglas.js` | Reglas del deporte: GL, mejores intentos, totales, orden de la barra, categorías |
| `sesiones.js` | Días y turnos: qué tandas van juntas en cada sesión |
| `sincronizacion.js` | Firebase, el estado en vivo, guardado local, deshacer y respaldos |
| `padron.js`, `nomina.js` | La base de atletas y la nómina en vivo del campeonato |
| `pesaje.js` | Atletas & Pesaje |
| `competencia.js` | Control en Vivo: pesos, resultados, cronómetros |
| `jueces.js` | Las luces de los jueces |
| `records.js`, `cierre.js` | Récords durante la competencia y al cerrarla |
| `resultados.js` | La tabla de Resultados |
| `documentos.js` | Documentos de mesa y actas (PDF y Excel) |
| `transmision.js` | Widgets de OBS, Control TX y el director |
| `pantalla.js` | La pantalla de tarima |
| `control_remoto.js` | El Control Remoto del teléfono |
| `publico.js` | La vista del público |
| `banderas.js` | Banderas y logos de club |
| `practica.js` | Modo práctica para jueces |
| `interfaz.js` | El dibujo general, el menú y la elección de campeonato |
| `arranque.js` | Lo que corre al abrir: configuración, estado y el primer dibujo |

### El panel: `admin/`

`admin.html` carga un solo módulo, `admin/panel.js`, que **se arma** juntando las
fuentes de `admin/` (un archivo por tema). El panel es un módulo de JavaScript
(import de Firebase, await en el nivel superior), y un módulo no se puede partir
en varios scripts sin cambiar cómo funciona; por eso se edita por partes y el
navegador recibe una sola pieza.

- Se edita en `admin/<tema>.js`, **nunca** en `admin/panel.js`.
- Después: `node herramientas/armar_panel.js` (la prueba `t_panelarmado.js`
  avisa si quedó atrasado).

Temas: `sesion`, `datos`, `interfaz`, `atletas`, `inscripciones`,
`entrenadores`, `jueces`, `campeonatos`, `cronograma`, `nominas`, `ranking`,
`estadisticas`, `resultados`, `fotos`, `medallero`, `records`, `publicaciones`,
`certificados`, `sitio`, `administradores`, y `arranque.js` con los import y lo
que corre al abrir el panel.

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

## Antes de subir un cambio

```
node herramientas/armar_panel.js # si se tocó algo en admin/
node herramientas/versionar.js   # huellas ?v=… de los .js y .css propios
sh pruebas/correr.sh             # la batería de pruebas
```

Las huellas hacen que el navegador pida la versión nueva de un archivo apenas
cambia, en vez de mezclar una página nueva con un archivo viejo de su caché. Si
se olvida, la prueba `t_versiones.js` lo avisa.

## Pruebas

```
sh pruebas/correr.sh
```

Levanta un servidor local y abre cada pantalla en un navegador. Firestore se
simula (`pruebas/apoyo/firebase_falso.js`), así que las pruebas no tocan la base
real. El resultado lo da el código de salida: 0 significa que todo pasó.

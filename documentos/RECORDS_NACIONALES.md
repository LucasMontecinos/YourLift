# Récords nacionales: actualización automática

Trabajo pendiente. Esto es la especificación, escrita mientras estaba fresca, para
que cuando se construya no haya que reconstruir también las decisiones.

## Lo que se quiere

Dos comportamientos distintos según el campeonato.

**Sudamericano (FESUPO).** El récord que importa ahí es el sudamericano, y eso ya
funciona: `records_suda.json`, la detección en vivo y el cartel en pantalla. El
récord NACIONAL no se toca en toda la competencia: no sale en pantalla, no sale en
la transmisión, y **tampoco en Control TX**. El operador no lo ve. Es un proceso
interno y nada más.

Al apretar **Cerrar competencia**, y recién ahí, se comparan los resultados de los
**chilenos** contra la tabla de récords nacionales y se actualiza lo que se haya
roto. A FESUPO le da lo mismo el récord nacional; a la federación no, porque hay
que mantener la planilla.

**Nacional.** Ahí el récord nacional sí es el récord del campeonato, así que se
comporta como hoy se comportan los sudamericanos: la lista cargada en Control TX,
marcada en vivo, actualizándose a medida que se rompe para que al siguiente le
toque superar la marca nueva. Al cerrar competencia se compara y se actualiza
igual, aunque ahí la comparación casi no tenga trabajo: ya quedó marcado en vivo.

## Lo que ya está resuelto y hay que reusar

**El sexo no está en los récords.** `records.json` guarda nombre, división,
categoría, campeonato y marca; solo los universitarios traen `sexo`. Se deduce de
la categoría de peso, que no se repite entre hombres y mujeres — mujeres
43/47/52/57/63/69/76/84/+84, hombres 53/59/66/74/83/93/105/120/+120 —. Ya está
implementado en `index.html` como `sexoDeRecord()`, comprobado contra los 397
récords sin ninguno ambiguo. La −72 es de la tabla femenina antigua, está retirada
y se filtra al cargar (`CATS_RETIRADAS`).

**Un récord por casillero.** `sinRetiradas()` en index y `recSinRetiradas()` en
admin ya garantizan una sola entrada por modalidad + movimiento + división +
categoría, quedándose con la marca más alta. Es la red de seguridad de todo esto:
si el cierre agregara en vez de reemplazar, no se publica el récord viejo.

**Dónde viven los récords.** En Firestore, `records/data`. `records.json` es el
respaldo y solo se usa si ese documento no existe. Cualquier actualización
automática tiene que escribir en Firestore, y el panel (Admin → Récords) es el que
ya sabe hacerlo: lee, filtra y guarda con `setDoc(doc(db,'records','data'))`.

**La mecánica de comparación ya existe** para los sudamericanos en `livecast.html`,
alrededor de `RECSUDA`. Conviene mirarla antes de escribir la nacional: resuelve la
clave por modalidad, el caso de la banca de Only Bench, y qué modalidades no tienen
tabla (Special Olympics no tiene).

## Lo que hay que decidir antes de construir

**La regla del Open.** En los sudamericanos, un atleta puede batir el récord de su
división y además el Open, porque el Open está abierto a todas las edades (criterio
IPF). Falta confirmar si la tabla nacional se maneja igual: si un Junior que supera
el récord Open se lleva los dos, o solo el suyo. Cambia el resultado de cada cierre,
así que no conviene suponerlo.

**Qué hacer con los universitarios.** En FESUPO no tienen récord propio y se
comparan contra el Open. En la tabla nacional sí existe `universitario` como
modalidad aparte, con sus propios récords. Hay que definir si un universitario
compite además por el récord de clásico.

**Qué campeonatos habilitan récord nacional.** Hoy los eventos tienen
`recordsEnabled` y `records:'suda'`. Va a hacer falta algo equivalente para
distinguir "acá se pueden batir récords nacionales" de "acá se detectan en
silencio", porque no es lo mismo un Nacional que un regional.

## El orden en que conviene hacerlo

1. La comparación, sola y fuera del livecast: dado el acta de una competencia
   cerrada, qué récords nacionales se rompieron. Se puede correr a mano sobre el
   Sudamericano aunque el resto no esté listo, y es lo que de verdad hace falta
   para mantener la planilla.
2. Enganchar esa comparación al cierre de competencia, escribiendo en Firestore.
3. Recién después, mostrar los récords nacionales en Control TX para los
   campeonatos que corresponda.

Los tres pasos se pueden entregar por separado. El primero no toca nada de lo que
corre en competencia, que es lo que importa mientras el Sudamericano esté cerca.

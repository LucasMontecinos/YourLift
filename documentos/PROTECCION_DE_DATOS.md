# Protección de datos personales en YourLift

Ley N° 19.628, modificada por la Ley N° 21.719. Vigente desde el 22 de octubre de 2026.

Este documento es el que se usa puertas adentro. Lo que se le promete al público
está en la política de privacidad del sitio (yourlift.cl/#privacidad, código en
`sitio/interfaz.js`, `renderTerminos`). Los dos tienen que decir lo mismo que hace
el código: si cambia uno, se cambian los otros.

## 1. Quién es quién

| Rol | Quién | Qué hace |
|---|---|---|
| Responsable | Federación Chilena de Powerlifting (FECHIPO) | Decide para qué se usan los datos y responde ante los titulares y la Agencia. Contacto: fechipocontacto@gmail.com |
| Encargado | YourLift SpA | Opera la plataforma por encargo de FECHIPO: código, alojamiento, soporte. No usa los datos para fines propios. |
| Subencargados | Google LLC (Firebase: Firestore, Storage, Authentication; Google Analytics), GitHub, Inc. (GitHub Pages) | Alojan la base de datos, los archivos y el sitio. |
| Destinatarios | IPF, FESUPO | Nombre, categoría, resultados y documentos que exija cada campeonato internacional. |

Pendiente de firmar: el contrato de encargo entre FECHIPO y YourLift SpA. Debe decir
para qué se tratan los datos, las medidas de seguridad, la confidencialidad, que
YourLift SpA avisa a FECHIPO de inmediato si hay un incidente, y qué pasa con los
datos al terminar el contrato.

## 2. Inventario: qué datos, dónde, quién los ve

"Público" = se lee sin iniciar sesión. "Panel" = administradores de FECHIPO con
cuenta personal (rol owner, superadmin o admin). Las cuentas de competencia
(transmisión, mesa técnica, jueces) no ven nada de lo marcado como Panel:
`veDatosPersonales()` en `reglas/firestore.rules` y `reglas/storage.rules`.

| Dato | Dónde | Quién lo ve |
|---|---|---|
| Padrón: nombre, club, categoría, resultados, año de nacimiento, código de atleta | `data.json` (GitHub Pages y Storage `public/data.json`) | Público |
| Padrón: RUT y fecha de nacimiento | Firestore `privado/padron` | Panel |
| RUT → código (para reconocer a quien escribe su RUT) | Firestore `rut_indice/{rut}` | Se lee de a uno, no se lista; solo trae el código |
| Inscripción: nombre, código, categoría, división, modalidad, club, año, estado | Firestore `inscripciones/{evento}_{código}` | Público |
| Inscripción: RUT, fecha de nacimiento, comuna, correo, PIN, nombres de archivo, documentos | Firestore `inscripciones_private/{mismo id}` | Panel |
| Documentos (carnet, pasaporte, ADEL/WADA, SENADIS, consentimientos, fotos) | Storage `athlete_files/{rut}/` | Panel (ni listar ni abrir sin ser admin) |
| Debutante: nombre, código, club, año | Firestore `atletas_pending/{código}` | Público |
| Debutante: RUT y fecha | Firestore `atletas_pending_priv/{código}` | Panel |
| Ediciones del padrón | Firestore `athlete_edits` (público, sin RUT ni fecha) + `athlete_edits_priv` (Panel) | — |
| Foto de perfil | Firestore `atleta_fotos/{código}`, Storage `athlete_photos/{código}_…` | Público (no se lista la carpeta) |
| Resultados recién cerrados | Firestore `competition_results` (por código) | Público |
| Livecast: nómina en vivo | Firestore `livecast_sync`, `livecast_flash` (sin RUT ni fecha) | Público |
| Entrenadores: base completa (RUT, correos, acreditaciones) | Firestore `entrenadores/{rut}` | Panel |
| Entrenadores: nombre, club, categoría, código | Firestore `publico/entrenadores` | Público |
| Entrenadores: reconocer por RUT | Firestore `entrenadores_indice/{rut}` (nombre, club, categoría, vencimientos) | Se lee de a uno, no se lista |
| Inscripción de entrenador | `inscripciones_entrenador` (se lee de a uno; sin RUT) + `_priv` (Panel) + nómina pública `publico/entrenadores_nomina` | — |
| Jueces: base completa | Firestore `referees/{rut}` | Panel |
| Jueces: categoría por código | Firestore `publico/jueces` | Público |
| Cronograma: filas y nombres de handlers | Firestore `cronograma/{evento}` | Público |
| Correos de handlers | `cronograma_priv/{evento}`, `handlers_priv/{id}` | Panel (y el entrenador que los anotó) |
| Solicitudes de titulares | Firestore `solicitudes_datos` | Panel |
| Incidentes | Firestore `incidentes` | Panel |
| Registro de acciones del panel | Firestore `audit_log` | Panel |
| Visitas | Firestore `analytics_daily` (cifras agregadas), Google Analytics | Panel |

Las reglas de Firestore rechazan cualquier escritura que ponga RUT, fechas de
nacimiento, comuna, correos, teléfonos o PIN en una colección pública, también si
la hace un admin (`creaSinPersonales`, `modificaSinPersonales`). La lista de esos
campos está en `compartido/privacidad.js` (`INSC_PRIVADOS`) y en las reglas
(`camposPersonales`): tienen que coincidir.

## 3. Conservación

- Lo deportivo (nombre, club, categoría, resultados, récords): historial oficial, sin plazo.
- Documentos, correo, comuna y PIN de una inscripción: se borran 5 años después de
  la última competencia de la persona. Igual con los documentos y contactos de las
  inscripciones de entrenador, y los correos de handlers de campeonatos de hace más
  de 5 años.
- RUT y fecha de nacimiento: en privado mientras exista el historial.

Cómo: panel → Protección de datos → Conservación → "Borrar lo vencido". Una vez al
año como mínimo (sugerido: en enero). Queda en el registro de acciones.

## 4. Solicitudes de los titulares (acceso, rectificación, supresión, oposición, portabilidad, bloqueo)

1. Llegan por el formulario de yourlift.cl/#privacidad (quedan en panel →
   Protección de datos → Solicitudes) o por correo a FECHIPO (se anotan a mano en
   el mismo lugar para que corra el plazo).
2. Confirmar que quien pide es el titular o su representante: responder al correo
   que dejó y, si hay dudas, pedir copia del carnet.
3. Buscar a la persona (pestaña "Buscar persona"): muestra dónde están sus datos.
   - Acceso / portabilidad: "Descargar sus datos (JSON)" y enviárselo.
   - Rectificación: corregir en el panel (Atletas, Nóminas, Base Entrenadores…).
   - Supresión: "Borrar sus documentos de identidad"; lo demás según el caso. Los
     resultados deportivos son el registro oficial: si pide sacarlos, se evalúa con
     FECHIPO y, si corresponde, se anonimiza a mano.
   - Oposición / bloqueo: se marca y se deja de usar el dato para ese fin.
4. Responder dentro de 30 días corridos y marcar la solicitud como "Respondida"
   (o "Rechazada", con el motivo y avisándole que puede reclamar ante la Agencia de
   Protección de Datos Personales).

## 5. Si hay un incidente de seguridad

Incidente = pérdida, filtración, alteración o acceso no autorizado a datos
personales (una cuenta de admin comprometida, reglas de Firebase mal publicadas,
un archivo con datos subido al repositorio, un equipo del evento con la sesión
abierta, etc.).

1. **Contener (de inmediato).** Desactivar la cuenta comprometida (Gestión Admin),
   cambiar claves, revisar y volver a publicar `reglas/firestore.rules` y
   `reglas/storage.rules`, sacar el archivo expuesto.
2. **Registrar (el mismo día).** Panel → Protección de datos → Incidentes: qué
   pasó, desde cuándo, qué datos, cuántas personas (aproximado), qué se hizo.
   Todo incidente se registra, aunque después no haya que reportarlo.
3. **Avisar a FECHIPO** (responsable). YourLift SpA avisa sin demora.
4. **Evaluar el riesgo.** ¿Puede afectar a las personas (suplantación con RUT y
   fecha, exposición de documentos de identidad, de salud o de menores)?
5. **Reportar a la Agencia de Protección de Datos Personales** sin dilaciones
   indebidas cuando haya riesgo razonable para las personas, con lo registrado en
   el paso 2. Anotar la fecha del reporte en el incidente.
6. **Avisar a los afectados** cuando la ley lo exige —datos sensibles (salud,
   discapacidad), de menores de 14 años, o económicos/financieros— y, en general,
   cuando el aviso les sirve para protegerse. En lenguaje claro: qué pasó, qué
   datos, qué se hizo y qué pueden hacer. Anotar la fecha.
7. **Denunciar** si fue un ataque (Ley 21.459 de delitos informáticos): PDI,
   Brigada del Cibercrimen, o Fiscalía.
8. **Cerrar** el incidente en el registro con lo aprendido y lo que se cambió.

## 6. Medidas de seguridad

- Lo público no trae datos personales; las reglas lo hacen cumplir.
- Documentos en carpeta privada de Storage; se guardan por ubicación, no por
  enlace público, y solo el panel los abre.
- Cuentas personales por administrador; las de competencia no ven datos
  personales; se desactivan desde Gestión Admin.
- El panel no carga Google Analytics. El sitio lo carga sin señales publicitarias.
- Registro de acciones del panel (`audit_log`).
- Revisar dos veces al año: quién tiene cuenta de admin, que las reglas publicadas
  sean las del repositorio, y la conservación.

## 7. Pendientes conocidos

- **Historial del repositorio.** El repositorio de GitHub es público y sus
  versiones antiguas de `data.json` (hasta septiembre de 2026) traen RUT y fechas
  de nacimiento. Opciones: dejar el repositorio privado (GitHub Pages en un
  repositorio privado requiere plan pagado; otra opción es publicar el sitio con
  Firebase Hosting, que ya está configurado en `firebase.json`), o reescribir el
  historial y pedir a GitHub que limpie su caché. Es una decisión de FECHIPO y
  YourLift SpA.
- **Contrato de encargo** FECHIPO ↔ YourLift SpA (punto 1).
- **Clave inicial de las cuentas de entrenador**: hoy es el RUT, que se cambia al
  primer ingreso. Conviene una clave al azar enviada por correo.

## 8. Puesta en marcha (una vez)

1. Publicar `reglas/firestore.rules` y `reglas/storage.rules` en la consola de Firebase.
2. Panel → Protección de datos → Migración → "Revisar qué hay que cambiar" →
   "Aplicar" (con la cuenta Owner). Mueve lo privado de los datos guardados antes,
   renombra lo que tenía el RUT en el id, mueve las fotos con el RUT en el nombre,
   rehace el índice por RUT y publica las copias públicas de entrenadores y jueces.
3. Verificar en un navegador sin sesión que la nómina, la ficha del atleta, el
   ranking y el livecast se ven bien.

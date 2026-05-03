# YourLift — Seguridad

Este archivo documenta los pasos **manuales** que debes hacer en Firebase/Google
Cloud para completar los fixes críticos de seguridad. El código ya hace su parte.

---

## 1. Desplegar `firestore.rules`

El archivo [`firestore.rules`](./firestore.rules) contiene reglas que cierran la DB
(por defecto estaba **todo abierto**). Pásalas a producción de una de estas dos formas:

**Opción A — Consola:** Firebase Console → Firestore Database → **Rules** → pega el
contenido de `firestore.rules` → **Publish**.

**Opción B — CLI:**
```
firebase deploy --only firestore:rules
```

Efecto: lectores anónimos pueden ver eventos/inscripciones, cualquiera puede
enviar una inscripción nueva (form público), pero aprobar/editar/borrar requiere
ser admin autenticado.

## 2. Restringir la API key por dominio

La API key de Firebase web **no es secreta** (siempre viaja al navegador), pero
sí puedes limitar desde qué dominios funciona.

1. Google Cloud Console → APIs & Services → **Credentials**.
2. Abre la API key `AIzaSyA21IHMus2bklPLJm7ExRrVJJL9bzLhyp4`.
3. **Application restrictions** → HTTP referrers → agrega:
   - `https://yourlift.cl/*`
   - `https://www.yourlift.cl/*`
   - `https://lucasmontecinos.github.io/*`  *(si aún usas GitHub Pages directo)*
4. **API restrictions** → Restrict key → deja solo:
   - Cloud Firestore API
   - Firebase Authentication API
   - Identity Toolkit API
   - Cloud Storage for Firebase

Guarda. Cualquier otro dominio que use la key empezará a fallar.

## 3. Crear cuenta(s) de admin

Con las reglas nuevas, el panel de admin (inscripcion.html y admin.html) requiere
login con Firebase Auth y que el UID esté en `admins/{uid}`.

1. Firebase Console → **Authentication** → Users → Add user → email + password.
2. Copia el UID.
3. Firestore → crea documento `admins/{uid}` con campo `role: "superadmin"`.

## 4. Migración de entrenadores a Firebase Auth

El login de coach ya **no** compara passwords en texto plano. Ahora
`cronograma.html` usa `signInWithEmailAndPassword` y valida que el UID esté
en `coaches/{uid}`. Las rules permiten escritura en `acreditaciones` a cualquier
admin o coach autenticado (`isAdmin() || isCoach()`).

### Migrar a los coaches existentes

Los docs actuales en `coaches/{id_email_normalizado}` con campo `password` ya
**no sirven** — Firestore ahora espera `coaches/{uid}`. Para cada coach actual:

1. Entra a yourlift.cl/admin.html y loguéate como admin.
2. Abre la consola del navegador (F12 → Console).
3. Ejecuta:

   ```js
   await createCoach(
     'juan@correo.cl',      // email
     'GeneraUnaPasswordFuerte!',  // password ≥ 8 caracteres
     'Juan Pérez',          // nombre completo
     'Nacional',            // grado (opcional)
     '12345678'             // rut (opcional)
   )
   ```

   El helper:
   - Crea la cuenta Firebase Auth sin cerrar tu sesión de admin.
   - Escribe `coaches/{uid}` con los datos.
   - Deja traza en `audit_log`.

4. Comunícale al coach su email + password por canal privado. El coach entra
   por **cronograma.html → Entrenador / Handler** con esas credenciales.
5. (Opcional) Una vez migrados todos, borra los docs viejos de `coaches/`
   cuyo ID **no** sea un UID de Firebase Auth (los que tenían el campo
   `password`).

### Recuperación de password

Si un coach olvida la contraseña, desde la consola de Firebase Authentication
puedes disparar un reset por email, o simplemente actualizar la password manualmente.

---

## 5. Migración a `inscripciones_private` + `edit_requests`

### Qué cambió

Los campos sensibles (`pin`, `carnetURL`, `wadeURL`) **ya no viven** en
`inscripciones` (que es de lectura pública). Ahora van a
`inscripciones_private/{mismo_id}`, que solo admin puede leer.

El self-edit directo también cambió: antes el atleta modificaba el doc de
`inscripciones` validando su PIN contra el campo público. Ahora el atleta
envía una **solicitud de edición** a `edit_requests/{autoId}` con RUT +
PIN + cambios propuestos. Esa colección solo la lee el admin, que revisa
y aprueba en el panel (donde se valida el PIN contra el doc privado).

### Pasos manuales (en orden)

**5.1 — Desplegar `firestore.rules` actualizadas.** Contienen las reglas
nuevas de `inscripciones_private` y `edit_requests`. Si no las desplegás,
el formulario de inscripción va a fallar porque la rule bloquea PIN/URLs
en `inscripciones`.

```
firebase deploy --only firestore:rules
```

**5.2 — Correr la migración one-shot.** Los docs viejos todavía tienen
`pin`, `carnetURL`, `wadeURL` embebidos en `inscripciones`. Después del
deploy de reglas, logueate en `admin.html`, abrí la consola del
navegador (F12 → Console) y ejecutá:

```js
await migrateToPrivateCollection()
```

El helper:
- Copia los campos sensibles al doc `inscripciones_private/{mismo_id}`.
- Borra `pin`, `carnetURL`, `wadeURL` del doc público con `deleteField()`.
- Imprime cuántos movió/omitió/erró.

Es idempotente — correrlo varias veces no rompe nada (usa `merge:true`).

**5.3 — Probar.** En modo incógnito:
- Abrí `inscripcion.html`, enviá una inscripción nueva. Verificá en
  Firebase Console que se crearon **dos docs** (`inscripciones/{id}` sin
  PIN, y `inscripciones_private/{id}` con el PIN).
- Probá el flujo de "Editar mi inscripción" con RUT + PIN + cambio.
  Debería aparecer en el admin panel → **Solicitudes edit** con el
  badge "PIN ✓" si el PIN es correcto.
- Aprobá la solicitud — los cambios se aplican al doc público.

### Qué NO migra

- Los documentos en Firebase Storage (archivos de carnet y WADA) siguen
  donde estaban. Solo cambia dónde vive la URL.
- Los flujos que ya no usan el PIN (livecast, cronograma, nóminas
  públicas) no se tocan.

---

## 6. Security headers HTTP via `firebase.json`

El archivo [`firebase.json`](./firebase.json) configura headers de seguridad
que Firebase Hosting envía con cada respuesta. Sin esto, el sitio queda
vulnerable a clickjacking, XSS reflejado, sniffing de MIME types, etc.

### Headers configurados

| Header | Para qué sirve |
|---|---|
| `Strict-Transport-Security` | Fuerza HTTPS por 1 año (incluso si alguien teclea http://) |
| `X-Content-Type-Options: nosniff` | Browser no adivina tipos de archivo (evita ejecución como script) |
| `X-Frame-Options: SAMEORIGIN` | Protege de clickjacking (no se puede embeber yourlift.cl en otra página) |
| `Referrer-Policy: strict-origin-when-cross-origin` | No filtra URLs internas a sitios externos |
| `Permissions-Policy` | Bloquea acceso a cámara, micrófono, geolocalización |
| `Content-Security-Policy` | Whitelist de dominios para scripts, conexiones, imágenes |

### CSP — qué permite

- **Scripts**: solo desde el mismo dominio + `gstatic.com` (Firebase) + `cdn.jsdelivr.net` (obs-websocket-js)
- **Conexiones**: Firebase + WebSocket localhost (OBS) + LAN local (192.168.*)
- **Imágenes**: cualquier https + Google sites (logos)
- **Estilos**: inline + Google Fonts

Si en el futuro agregás un nuevo CDN o servicio externo, hay que actualizar
la CSP en `firebase.json` o el browser bloqueará la carga.

### Despliegue

```
firebase deploy --only hosting
```

⚠️ **No deployar 1-2 días antes de la compe sin testear primero.** Un CSP mal
configurado puede romper la carga de algún recurso. Probá en una rama de
preview primero si es posible.

---

## 7. Storage rules

El archivo [`storage.rules`](./storage.rules) restringe quién puede leer/escribir
en Firebase Storage. Antes de aplicarlo:

1. Andá a Firebase Console → Storage → Files.
2. Mirá qué archivos hay y bajo qué carpetas.
3. Compará con las paths definidas en `storage.rules`:
   - `/logos/*` — públicos
   - `/public/*` — públicos
   - `/athlete_files/{rut}/*` — solo admin lee, atletas autenticados pueden subir
   - `/backups/*` — solo admin
   - cualquier otra path → bloqueada (default deny)
4. Si tu Storage usa otras paths (ej. archivos en la raíz), agregalos a las
   reglas o moverlos antes de deployar.

### Despliegue

```
firebase deploy --only storage
```

O via consola: Firebase Console → Storage → Rules → pegar contenido.

⚠️ Si deployás sin auditar antes, archivos en paths no listadas dejan de ser
accesibles públicamente. Mejor revisar primero.

---

## 8. SRI (Subresource Integrity) para CDNs

`livecast.html` carga `obs-websocket-js` desde jsdelivr. Si el CDN se ve
comprometido, código malicioso podría inyectarse. Para evitar esto, el script
tag tiene un atributo `integrity` con un hash SHA-384 del archivo:

```html
<script src="https://cdn.jsdelivr.net/npm/obs-websocket-js@5/dist/obs-ws.min.js"
  integrity="sha384-Vce9u7FN5Pbapc8dhpMdg2EjTels5H1cGOVLAe7THp3fEtfb89nD6YOIaf8781ay"
  crossorigin="anonymous"></script>
```

Si el archivo en el CDN es modificado (incluso 1 byte), el browser rechaza la
ejecución. Si más adelante actualizás la versión del paquete, hay que
recalcular el hash:

```bash
curl -s https://cdn.jsdelivr.net/npm/obs-websocket-js@<NUEVA_VERSION>/dist/obs-ws.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

---

## 9. Bridge OBS — autenticación con AUTH_TOKEN

El `bridge.py` tiene un campo `AUTH_TOKEN` que cuando se setea, exige el
header `X-Auth-Token: <token>` en cada request POST. Sin esto, cualquier
dispositivo en la red puede mandar comandos al bridge cuando está en modo
LAN (`HTTP_HOST = '0.0.0.0'`).

### Token sugerido para esta compe

```
dBPRwNseW7zYEQqxZiguw8yFF57FbPYa
```

(generado con `openssl rand -base64 32`. Único y aleatorio. Cambialo si
preferís uno propio.)

### Activarlo (PRE-COMPE):

1. Abrir `bridge.py` con Notepad.
2. Buscar la línea `AUTH_TOKEN = ''` y cambiarla por:
   ```python
   AUTH_TOKEN = 'dBPRwNseW7zYEQqxZiguw8yFF57FbPYa'
   ```
3. Guardar.
4. En cada botón del Stream Deck (Web Requests), en la sección Headers
   agregar:
   ```
   X-Auth-Token: dBPRwNseW7zYEQqxZiguw8yFF57FbPYa
   ```
5. Reiniciar bridge: ver mensaje `[bridge] 🔒 Auth ACTIVA`.

Sin el header, el bridge responde **401 Unauthorized**.

---

## 10. Auditoría de admins

Con permisos de admin se puede borrar datos, crear coaches, modificar
inscripciones, etc. Verificá la lista periódicamente:

1. Firebase Console → Firestore → colección `admins/`.
2. Cada doc es un UID con permisos completos.
3. Para mapear UID → email: Firebase Console → Authentication → Users.
4. Si hay UIDs que no reconocés → borrar el doc en `admins/`.
5. Para revocar todo el acceso de un admin: borrar su doc EN `admins/` y
   también su cuenta en Authentication (si ya no debería entrar).

---

## Checklist rápido pre-compe

- [ ] Deployar `firestore.rules` con todos los cambios actuales (livecast_director, livecast_record, recordsEnabled, coaches, etc.)
- [ ] Deployar `storage.rules` (después de auditar archivos existentes)
- [ ] Deployar `firebase.json` headers (`firebase deploy --only hosting`)
- [ ] Verificar que `livecast.html` tiene el `integrity=` en el script CDN
- [ ] Activar `AUTH_TOKEN` en `bridge.py` para la compe
- [ ] Actualizar Stream Deck con el header `X-Auth-Token`
- [ ] Auditar lista de admins en `admins/` (borrar UIDs desconocidos)
- [ ] Verificar que las claves temporales de coaches creados son únicas
- [ ] Backup de Firestore antes de la compe (export desde consola)

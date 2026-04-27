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

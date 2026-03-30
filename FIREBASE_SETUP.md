# 🔥 Guía de Configuración Firebase para FECHIPO

## Paso 1: Crear proyecto Firebase (5 minutos)

1. Ve a **https://console.firebase.google.com**
2. Click **"Crear un proyecto"**
3. Nombre: `fechipo-db` (o el que quieras)
4. Google Analytics: puedes desactivarlo (no es necesario)
5. Click **"Crear proyecto"**

## Paso 2: Activar Firestore Database

1. En el menú izquierdo → **Firestore Database**
2. Click **"Crear base de datos"**
3. Selecciona **"Iniciar en modo de prueba"** (después ajustamos seguridad)
4. Ubicación: `us-central` o `southamerica-east1` (Chile)
5. Click **"Habilitar"**

## Paso 3: Activar Storage (almacenamiento de archivos)

1. En el menú izquierdo → **Storage**
2. Click **"Comenzar"**
3. Selecciona **"Iniciar en modo de prueba"**
4. Click **"Siguiente"** → **"Listo"**

## Paso 4: Registrar tu app web

1. En la página principal del proyecto, click el ícono **</>** (Web)
2. Nombre: `fechipo-web`
3. **NO marques** "Firebase Hosting" (usamos GitHub Pages)
4. Click **"Registrar app"**
5. Te mostrará un bloque de código con `firebaseConfig`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "fechipo-db.firebaseapp.com",
  projectId: "fechipo-db",
  storageBucket: "fechipo-db.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

6. **Copia estos valores** y reemplázalos en `inscripcion.html` donde dice:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY_AQUI",       // ← reemplaza
  authDomain: "TU_PROYECTO...",     // ← reemplaza
  projectId: "TU_PROYECTO",        // ← reemplaza
  storageBucket: "TU_PROYECTO...",  // ← reemplaza
  messagingSenderId: "123456789",   // ← reemplaza
  appId: "TU_APP_ID"               // ← reemplaza
};
```

## Paso 5: Configurar reglas de seguridad

### Firestore Rules
En Firestore → pestaña **"Reglas"**, pega:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /inscripciones/{docId} {
      // Cualquiera puede crear (inscribirse)
      allow create: if true;
      // Solo lectura y update desde tu dominio
      allow read, update: if true;
      // Nadie puede borrar
      allow delete: if false;
    }
  }
}
```

### Storage Rules
En Storage → pestaña **"Reglas"**, pega:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /inscripciones/{allPaths=**} {
      // Cualquiera puede subir archivos hasta 5MB
      allow write: if request.resource.size < 5 * 1024 * 1024;
      // Solo lectura autenticada (para admin)
      allow read: if true;
    }
  }
}
```

## Paso 6: Subir a GitHub Pages

Sube estos archivos a tu repo:

```
tu-repo/
├── index.html           (base de datos)
├── inscripcion.html      ← NUEVO
├── livecast.html         (competencia en vivo)
├── data.json
├── records.json
├── nominas.json
```

## Paso 7: Probar

1. Abre `https://tu-usuario.github.io/tu-repo/inscripcion.html`
2. Llena el formulario de prueba
3. Click 🔒 Admin → PIN: `2026`
4. Verifica que aparezca la inscripción
5. Aprueba → Click "Exportar Nóminas" → genera `nominas.json` actualizado

## Cambiar el PIN de Admin

En `inscripcion.html`, busca la línea:
```javascript
const ADMIN_PIN = '2026';
```
Cámbialo por el que quieras.

## Agregar nuevos eventos

En `inscripcion.html`, busca el array `EVENTS` y agrega:
```javascript
{id:"tu_evento_id", name:"Nombre Completo", date:"2026-XX-XX", closeDate:"2026-XX-XX", location:"Ciudad", org:"Club Organizador"},
```

## Agregar nuevos clubes

En `inscripcion.html`, busca el array `CLUBS` y agrega el nombre.

---

## Flujo completo

```
Atleta abre inscripcion.html
    → Llena formulario + sube carnet
    → Datos van a Firebase (privado)
    
Admin abre inscripcion.html → 🔒 Admin
    → Ve inscripciones pendientes
    → Aprueba/Rechaza
    → Exporta nominas.json
    → Sube nominas.json a GitHub
    → Nóminas aparecen en index.html automáticamente
```

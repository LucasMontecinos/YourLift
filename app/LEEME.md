# App YourLift (Android e iOS)

La app no trae una copia del sitio: abre **https://yourlift.cl** adentro, con
la misma base de datos. Lo que alguien hace en la app (inscribirse, ver
nóminas, seguir un campeonato en vivo) es lo mismo que en la página, y cada
cambio que se publica en el sitio llega a la app sin sacar una versión nueva.

Solo hace falta una versión nueva de la app cuando cambia algo de esta carpeta:
el ícono, el nombre o los permisos.

## Qué hay acá

| | |
|---|---|
| `capacitor.config.json` | Qué abre la app (yourlift.cl), colores, pantalla de inicio |
| `www/sin_conexion.html` | Lo que se ve si el teléfono no tiene internet |
| `assets/` | Ícono y pantalla de inicio (salen de `yourlift_logo_hd.png`) |
| `android/`, `ios/` | Los proyectos nativos |
| `../compartido/app.js` | Lo que cambia en el sitio cuando corre dentro de la app: descargas, compartir, enlaces |

## Armarla

GitHub la arma sola (pestaña **Actions**):

- **App Android**: corre con cada cambio en `app/`. En *Artifacts* queda
  `YourLift-prueba-….apk`, que se instala directo en un Android (hay que permitir
  "instalar apps de origen desconocido").
- **App iOS**: revisa que el proyecto de iPhone compile. Corre a mano o cuando
  cambia `app/ios/`.

En un computador propio:

```sh
cd app
npm ci
npx cap sync
npx cap open android   # Android Studio
npx cap open ios       # Xcode (solo en Mac)
```

Cambiar el ícono: `python3 assets/generar_iconos.py ../yourlift_logo_hd.png assets && npm run iconos`.

## Publicarla en las tiendas

**Google Play** (pago único de US$25 por la cuenta de desarrollador):

1. Crear la firma una sola vez y guardarla en un lugar seguro. Si se pierde,
   no se puede actualizar la app nunca más:
   `keytool -genkey -v -keystore yourlift.keystore -alias yourlift -keyalg RSA -keysize 2048 -validity 10000`
2. En GitHub → Settings → Secrets and variables → Actions, crear:
   `ANDROID_KEYSTORE_BASE64` (el archivo en base64: `base64 -w0 yourlift.keystore`),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`yourlift`) y `ANDROID_KEY_PASSWORD`.
3. La siguiente corrida de **App Android** deja también `YourLift-….aab`, que es
   el que se sube a Google Play Console.

**App Store** (US$99 al año por la cuenta Apple Developer):

1. Crear la cuenta y la app con el identificador `cl.yourlift.app`.
2. Abrir `ios/App/App.xcodeproj` en Xcode, elegir el equipo en *Signing* y
   hacer *Product → Archive → Distribute*. También se puede automatizar en
   GitHub agregando los certificados como secretos.
3. Apple revisa que una app no sea "solo una página web". Ayuda mostrar lo que
   la app suma: seguir un campeonato en vivo, el QR de inscripción, guardar y
   compartir los PDF.

La firma (`*.keystore`, `*.p12`) **nunca** va al repositorio: GitHub Pages
publica todo lo que está en él.

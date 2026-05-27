# YourLift — Setup del productor (OBS + Stream Deck + Bridge)

Guía paso a paso para que el productor maneje la transmisión con su propio
OBS + Stream Deck. El operador del LiveCast (cargar pesos, marcar resultados)
trabaja desde otra PC en paralelo — esta guía cubre solo la parte de TX.

> **Resumen del flujo:**
> ```
> Stream Deck (botón)  →  Bridge Python (HTTP localhost:3000)
>                          ↓
>                         OBS WebSocket (BroadcastCustomEvent)
>                          ↓
>                         Widget OBS → ON/OFF de cada componente en pantalla
> ```

---

## Lo que necesita la PC del productor

- Windows 10 u 11
- OBS Studio 28 o superior (trae WebSocket Server incluido)
- Python 3.10+ (instalar desde https://www.python.org/downloads/ marcando
  **"Add python.exe to PATH"** durante la instalación)
- Stream Deck app (desktop) — la mobile se conecta a través de la desktop
- Conexión a internet (solo para que el widget cargue Firebase)

---

## 1. Habilitar OBS WebSocket (una sola vez)

1. Abrir OBS.
2. Menú **Herramientas → Configuración del servidor WebSocket**.
3. ✓ **Habilitar servidor WebSocket**.
4. Puerto del servidor: `4455` (default).
5. Click **"Mostrar información de conexión"** → copiar la **contraseña**
   y guardarla aparte (la vas a necesitar en el paso 3).
6. Aplicar → Aceptar.

---

## 2. Copiar archivos del proyecto a la PC del productor

Copiar al menos estos archivos a una carpeta de la PC del productor (ej.
`C:\YourLift\`):

- `bridge.py` ← el server HTTP→OBS
- `bridge.bat` ← acceso rápido para arrancarlo

Otros archivos del repo (`livecast.html`, `clubs.js`, etc.) NO van en la PC
del productor — ese código corre desde el hosting (yourlift.cl) directamente
en el browser source de OBS.

---

## 3. Instalar dependencia Python (una sola vez)

Abrir **PowerShell** (tecla Windows → escribir `powershell` → Enter).

Verificar Python:

```powershell
python --version
```

Si dice `Python 3.x.x`, OK. Si dice "no se reconoce", reinstalar Python con
"Add to PATH" marcado.

Instalar la librería:

```powershell
python -m pip install simpleobsws
```

Esperar a que termine. Tarda ~30 segundos.

---

## 4. Configurar el bridge

Abrir `bridge.py` con Notepad o VS Code:

```powershell
notepad C:\YourLift\bridge.py
```

### 4.1 Password de OBS WebSocket

Buscar la línea (cerca del inicio):

```python
OBS_WS_PASSWORD = 'CAMBIAME_PONELA_DE_OBS'
```

Reemplazar `CAMBIAME_PONELA_DE_OBS` por la **contraseña de OBS WebSocket** que
copiaste en el paso 1.5.

> Si OBS no tiene contraseña configurada, dejar `OBS_WS_PASSWORD = ''`.

### 4.2 Token de autenticación (recomendado en cross-PC)

Buscar la línea:

```python
AUTH_TOKEN = ''
```

Si vas a usar el bridge **solo en la misma PC** (Escenario A), dejá el token
vacío — sin auth alcanza.

Si vas a usar el bridge en **modo LAN** (Escenario B, con Stream Deck en otra
PC o cualquier dispositivo de la red puede pingear el bridge), generá un
token random largo y ponelo:

```python
AUTH_TOKEN = 'k9XmP2qR7vN4jL8fH3wYbT5cZ6sA1dG'
```

> Generá uno con cualquier herramienta online ("password generator 32 chars"),
> o usá el de arriba como ejemplo. Lo importante es que sea único y secreto.

Cuando el `AUTH_TOKEN` está activo, **cada POST al bridge tiene que incluir
el header**:

```
X-Auth-Token: k9XmP2qR7vN4jL8fH3wYbT5cZ6sA1dG
```

(en el paso 8 te explico cómo agregarlo al Stream Deck).

Guardar (Ctrl+S) y cerrar.

---

## 5. Arrancar el bridge

**Doble click en `bridge.bat`** (en la carpeta donde lo copiaste).

Se abre una ventana de consola con algo como:

```
[bridge] Conectando a OBS en ws://localhost:4455 ...
[bridge] ✓ OBS conectado
[bridge] HTTP escuchando en http://0.0.0.0:3000
[bridge]   • Localmente:  http://localhost:3000
[bridge]   • Desde la red LAN: http://192.168.1.50:3000
[bridge]     ↳ usá ESTA IP en Stream Deck si está en otra PC
```

**Anotar la IP LAN** que aparece (en el ejemplo `192.168.1.50`). La vas a
usar en el paso 7 si Stream Deck está en otra PC.

> ⚠️ **No cerrar esta ventana durante la compe.** Si la cerrás, los botones
> del Stream Deck dejan de funcionar. Minimizala pero dejala viva.

---

## 6. Permitir el puerto 3000 en el Firewall (solo cross-PC)

La primera vez que arranca el bridge, Windows puede preguntar:

> "¿Permitir que Python comunique en estas redes?"

→ ✓ **Redes privadas (recomendado)**
→ Permitir acceso

Si no apareció el popup y querés usar Stream Deck desde otra PC:

1. Panel de control → Firewall de Windows Defender → Configuración avanzada.
2. Reglas de entrada → Nueva regla.
3. Tipo: Puerto → TCP → Puerto específico: `3000`.
4. Permitir la conexión → Privadas (✓), Públicas (✗).
5. Nombre: "YourLift Bridge".

---

## 7. Agregar el widget en OBS

En OBS:

1. Click **+** en el panel de Fuentes.
2. Elegir **Navegador** (Browser).
3. Crear nueva → nombre: `Widget Director` → Aceptar.
4. **URL** (reemplazar PASSWORD por la de OBS WS):
   ```
   https://yourlift.cl/livecast.html?tx=director&obsWs=localhost:4455&obsPwd=PASSWORD&evento=NombreDelCampeonato
   ```
5. **Ancho**: 1920
6. **Alto**: 1080
7. **DESMARCAR** "Actualizar el navegador cuando la escena se vuelva activa".
8. **DESMARCAR** "Apagar fuente cuando no esté visible".
9. Aceptar.

Posicionar el browser source para que cubra toda la escena (encima de la
cámara). El widget arranca transparente — solo se ve algo cuando el productor
toggle un componente desde Stream Deck.

---

## 8. Configurar botones del Stream Deck

Para cada función, crear un botón en la app de Stream Deck:

1. Arrastrar la acción **"Web Requests → HTTP Request"** a una casilla.
2. Configurar:
   - **Title**: nombre del botón (ej. "Perfil")
   - **URL**:
     - Si bridge está en la misma PC que Stream Deck Desktop: `http://localhost:3000`
     - Si bridge está en otra PC: `http://192.168.1.50:3000` (con la IP LAN del paso 5)
   - **Method**: `POST`
   - **Content Type**: `application/json`
   - **Headers** (si activaste AUTH_TOKEN en el paso 4.2):
     ```
     X-Auth-Token: k9XmP2qR7vN4jL8fH3wYbT5cZ6sA1dG
     ```
     (con el mismo valor que pusiste en `bridge.py`)
   - **Body** (cambia según la función — tabla abajo):

### Tabla de payloads JSON

| Función | Body JSON |
|---|---|
| Toggle Perfil | `{"action":"toggle","component":"profile"}` |
| Toggle Marcador | `{"action":"toggle","component":"scoreboard"}` |
| Toggle Tabla clasificación | `{"action":"toggle","component":"leaderboard"}` |
| Toggle Timer | `{"action":"toggle","component":"timer"}` |
| Toggle Break Timer | `{"action":"toggle","component":"breakTimer"}` |
| Slam ✓ GOOD LIFT | `{"action":"slam","type":"g"}` |
| Slam ✗ NO LIFT | `{"action":"slam","type":"n"}` |
| Esconder TODO | `{"action":"hideAll"}` |
| Iniciar break 10 min | `{"action":"breakStart","minutes":10}` |
| Iniciar break 15 min | `{"action":"breakStart","minutes":15}` |
| Detener break | `{"action":"breakStop"}` |
| Break +1 min | `{"action":"breakAdd","seconds":60}` |
| Break −1 min | `{"action":"breakAdd","seconds":-60}` |
| Mostrar tabla cat específica | `{"action":"showLb","cat":"-83 kg (Hombre)"}` |

> 💡 **Tip**: una vez configurado un botón, click derecho → Duplicar → cambiar
> solo el body. Más rápido que crear de cero.

---

## 9. Probar que todo funciona

**Desde PowerShell** (en la PC del bridge):

```powershell
curl.exe http://localhost:3000
```

Debería responder con un JSON donde diga `"obs_connected": true`.

Para test de un evento:

```powershell
Invoke-RestMethod -Uri http://localhost:3000 -Method Post -ContentType "application/json" -Body '{"action":"toggle","component":"profile"}'
```

En la ventana del bridge debería aparecer:

```
[bridge] → OBS: {'action': 'toggle', 'component': 'profile'}
```

Y en el widget (visible en la previsualización de OBS) debería aparecer el
perfil del lifter actual fullscreen.

**Desde Stream Deck**: apretar el botón de perfil. Mismo efecto.

---

## 10. Durante la compe

Lo único que tiene que estar abierto en la PC del productor:

1. **OBS** (transmitiendo).
2. **Bridge** (la ventana negra de PowerShell con `[bridge] ✓ OBS conectado`).
3. **Stream Deck app** (para que el plugin Web Requests funcione).

Si algo deja de responder:

- Mirar la ventana del bridge — si dice `[bridge] ERROR: ...` o se cerró,
  reiniciarlo (doble click `bridge.bat`).
- Mirar OBS WS — si OBS se reinició, el bridge intenta reconectar
  automáticamente cada 5 segundos.

---

## Solución de problemas

### "pip no se reconoce"
Usar `python -m pip install simpleobsws` en lugar de `pip install`.

### "python no se reconoce"
Reinstalar Python desde python.org marcando **"Add python.exe to PATH"**.

### El bridge dice `[bridge] ERROR: connection refused`
OBS no está abierto o WebSocket no está habilitado. Revisar paso 1.

### El bridge dice `[bridge] ERROR: auth failed`
La contraseña en `bridge.py` no coincide con la de OBS. Revisar paso 4.

### Stream Deck Mobile muestra signo de peligro al apretar un botón
El bridge no responde. Causas:

- La ventana del bridge se cerró → reiniciar.
- El Body del botón tiene un JSON mal formado → revisar comillas.
- El URL del botón tiene la IP/puerto mal → verificar.
- Firewall bloqueando puerto 3000 (solo cross-PC) → revisar paso 6.

### El widget en OBS no se actualiza
- Verificar que el URL del browser source tenga `obsWs=localhost:4455` y
  `obsPwd=...` con la contraseña correcta.
- Click derecho en el browser source → **Refrescar**.
- Si sigue, abrir el widget URL en un browser normal y revisar la consola
  (F12) por errores.

### Stream Deck en otra PC no llega al bridge
- Verificar que el bridge muestre la IP LAN al arrancar.
- Pinguear la IP del bridge desde la PC del Stream Deck:
  `ping 192.168.1.50` → debe responder.
- Si no responde: las dos PCs no están en la misma red, o hay firewall.

### El bridge se queda colgado o muere
Reiniciar con `bridge.bat`. Si pasa seguido, agregar al cron / arranque
automático de Windows (ver sección "Arranque automático" abajo).

---

## Arranque automático de Windows (opcional)

Para que el bridge arranque solo al prender la PC:

1. Click derecho en `bridge.bat` → **Crear acceso directo**.
2. Cortar el acceso directo (Ctrl+X).
3. Apretar `Win + R`, escribir `shell:startup` y Enter.
4. Pegar el acceso directo en la carpeta que se abrió (Ctrl+V).
5. Listo. Cada vez que arranca Windows, el bridge se ejecuta solo.

Para deshabilitar: borrar el acceso directo de esa misma carpeta.

---

## Variantes de setup

| Escenario | Bridge en | Stream Deck en | OBS en | URL en Stream Deck |
|---|---|---|---|---|
| Todo local (test) | PC productor | PC productor | PC productor | `http://localhost:3000` |
| Cross-PC LAN | PC productor | Otra PC misma red | PC productor | `http://192.168.x.x:3000` |
| Mobile only | PC productor | Stream Deck Mobile (cel) | PC productor | `http://localhost:3000` |

> Stream Deck Mobile manda los press events a la app desktop, que ejecuta
> la acción Web Request. Por eso la URL siempre apunta a la PC donde corre
> la app desktop de Stream Deck (que es donde está el bridge en la mayoría
> de los setups).

---

## Backup

Si algo se rompe en `bridge.py`, recuperá la versión anterior desde
`bridge.local-backup.py` (versión inicial, solo localhost).

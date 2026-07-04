# Capacitaciones App

The application can send emails using Gmail credentials. When deployed to Vercel, this is handled by the serverless function under `api/send-email.js`.
For local development you may still run the Node.js server to serve the files and the same endpoint.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file (or set environment variables) with:

```
EMAIL_USER=dirambiente.msi@gmail.com
EMAIL_PASS=Carpincho1234
# Opcional: recibir copias de cada correo (se agrega ambiente.msi@gmail.com por defecto)
NOTIFY_EMAILS=dirambiente.msi@gmail.com
```

3. Start the server locally:

```bash
npm start
```

The app will be available on `http://localhost:3000`, and POST requests to `/api/send-email` will send an email using the provided credentials.

## Sincronización de turnos con Google Calendar

Los turnos ECOescuelas reservados se crean automáticamente como eventos en un calendario de Google de la Dirección (y se eliminan si el turno se cancela). Esto lo maneja el endpoint `/api/calendar-event` (función serverless `api/calendar-event.js` en Vercel, o la misma ruta en el servidor Node local).

Si las variables de entorno no están configuradas, el endpoint responde `501` y la app sigue funcionando normalmente (la reserva se hace igual, solo que sin evento en el calendario).

### Configuración paso a paso

1. Entrar a [Google Cloud Console](https://console.cloud.google.com/) y crear un proyecto (o usar uno existente).
2. En **APIs y servicios → Biblioteca**, buscar **Google Calendar API** y habilitarla.
3. En **APIs y servicios → Credenciales**, crear una **Cuenta de servicio**. No hace falta asignarle roles.
4. Dentro de la cuenta de servicio, ir a **Claves → Agregar clave → Crear clave nueva → JSON** y descargar el archivo. De ese JSON se necesitan los campos `client_email` y `private_key`.
5. En [Google Calendar](https://calendar.google.com/), abrir la configuración del calendario donde se quieren ver los turnos (puede ser uno nuevo, p. ej. "Turnos ECOescuelas"). En **Compartir con determinadas personas**, agregar el email de la cuenta de servicio (`client_email`) con permiso **"Realizar cambios en eventos"**.
6. En la misma configuración del calendario, copiar el **ID del calendario** (sección "Integrar el calendario", tiene formato `xxxx@group.calendar.google.com`).
7. Configurar las variables de entorno (en `.env` local o en las Environment Variables de Vercel):

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=mi-cuenta@mi-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=xxxx@group.calendar.google.com
```

> Nota: `GOOGLE_PRIVATE_KEY` debe pegarse tal cual aparece en el JSON (con los `\n`); el servidor los convierte automáticamente en saltos de línea.

Además de la sincronización automática, el correo de confirmación de cada turno y la lista "Mis Turnos Reservados" incluyen un enlace **"Agregar a Google Calendar"** para que la institución agregue el evento a su propio calendario (esto no requiere ninguna configuración).

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
# Opcional: recibir copias de cada correo
NOTIFY_EMAILS=dirambiente.msi@gmail.com
```

3. Start the server locally:

```bash
npm start
```

The app will be available on `http://localhost:3000`, and POST requests to `/api/send-email` will send an email using the provided credentials.

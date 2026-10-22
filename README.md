# Loft Finanzas

App personal de finanzas. Acceso con una única contraseña.

| Parte | Carpeta | Deploy |
|---|---|---|
| Frontend (React + Vite) | `frontend/` | Vercel → `loftfinanzas.vercel.app` |
| Backend (Node + Express) | `backend/` | Railway |
| Base de datos | `supabase/` | Supabase |

Un solo ambiente: cada push a `main` despliega directo en Vercel y Railway.

## Cómo funciona el acceso

1. El navegador solo habla con `loftfinanzas.vercel.app`.
2. Vercel reenvía `/api/*` al backend en Railway (rewrite en `frontend/vercel.json`), así la cookie es del mismo dominio.
3. `POST /api/auth/login` compara la contraseña con `APP_PASSWORD` y entrega una cookie `httpOnly` firmada con `SESSION_SECRET`.
4. Todas las rutas `/api/*` (salvo `health` y `auth`) exigen esa cookie.
5. Login limitado a 10 intentos cada 15 minutos por IP.

Supabase se usa solo desde el backend con la service role key. Ninguna clave llega al navegador y Vercel no necesita variables.

## Setup

### 1. GitHub
```bash
git remote add origin https://github.com/<usuario>/loftfinanzas.git
git push -u origin main
```

### 2. Supabase
- Crear proyecto.
- Ejecutar `supabase/migrations/*.sql` en SQL Editor (en orden).
- Copiar de Project Settings → API: **Project URL** y **service_role key**.

### 3. Railway
- New Project → Deploy from GitHub repo → elegir el repo.
- Settings → **Root Directory**: `/backend`.
- Variables:

  | Variable | Valor |
  |---|---|
  | `APP_PASSWORD` | contraseña de acceso |
  | `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
  | `SUPABASE_URL` | Project URL |
  | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
  | `SESSION_DAYS` | opcional, default `30` |

- Settings → Networking → **Generate Domain**. Copiar el dominio (ej. `loftfinanzas-production.up.railway.app`).
- Verificar: `https://<dominio>/api/health` → `{"ok":true}`.

### 4. Conectar frontend con backend
En `frontend/vercel.json` reemplazar `RAILWAY_DOMAIN` por el dominio de Railway, commit y push.

### 5. Vercel
- Add New Project → importar el repo.
- **Root Directory**: `frontend` (framework Vite se detecta solo).
- Sin variables de entorno.
- Settings → Domains: dejar `loftfinanzas.vercel.app`.
- Opcional: desactivar Preview Deployments (Settings → Git) ya que hay un solo ambiente.

## Desarrollo local

```bash
# backend
cd backend
cp .env.example .env   # completar valores
npm install
npm run dev            # http://localhost:3000

# frontend (otra terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173, /api se proxea al backend
```

## Agregar rutas

En `backend/src/index.js`, toda ruta registrada después de `app.use('/api', requireAuth)` ya está protegida. Desde el frontend usar `api('/ruta')` de `src/api.js`.

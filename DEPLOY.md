# Deploy — FreeHouse S.A.

## Tiempo estimado: 20 minutos

---

## PASO 1 — Supabase (base de datos)

### 1.1 Crear proyecto
1. Ir a **https://supabase.com** → New project
2. Nombre: `freehouse` | Región: South America (São Paulo)
3. Guardar la contraseña de la DB — la vas a necesitar
4. Esperar ~2 min a que esté listo

### 1.2 Ejecutar el schema
1. En el dashboard: **SQL Editor → New query**
2. Pegar el contenido completo de `supabase/schema.sql`
3. Click **Run** — verificar que no hay errores rojos

### 1.3 Crear los usuarios
1. Ir a **Authentication → Users → Add user**
2. Crear dos usuarios:

```
Email:    mau@freehouse.com     Password: (el que quieran)
Email:    juani@freehouse.com   Password: (el que quieran)
```

> El trigger `on_auth_user_created` crea el profile automáticamente.

### 1.4 Asignar nombres correctos
En **SQL Editor**, ejecutar:
```sql
UPDATE public.profiles SET name = 'Mau'
WHERE id = (SELECT id FROM auth.users WHERE email = 'mau@freehouse.com');

UPDATE public.profiles SET name = 'Juani'
WHERE id = (SELECT id FROM auth.users WHERE email = 'juani@freehouse.com');
```

### 1.5 Obtener las credenciales
Ir a **Settings → API** y copiar:
- `Project URL`  → `NEXT_PUBLIC_SUPABASE_URL`
- `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ La `service_role` key tiene acceso total. Nunca exponerla al cliente.

---

## PASO 2 — Repositorio Git

```bash
# En la carpeta del proyecto
git init
git add .
git commit -m "Initial commit"

# Crear repo en GitHub (github.com/new) y luego:
git remote add origin https://github.com/TU_USUARIO/freehouse.git
git push -u origin main
```

---

## PASO 3 — Vercel (deploy)

### 3.1 Conectar el repo
1. Ir a **https://vercel.com** → Add New Project
2. Importar el repositorio de GitHub
3. Framework: **Next.js** (detectado automáticamente)
4. Click **Deploy** (va a fallar — falta configurar las env vars)

### 3.2 Variables de entorno
En Vercel → tu proyecto → **Settings → Environment Variables**, agregar:

| Variable | Valor | Entornos |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon key) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) | Production, Preview, Development |

### 3.3 Re-deploy
En Vercel → **Deployments → ... → Redeploy**

La app va a estar disponible en `https://freehouse-xxx.vercel.app`

### 3.4 (Opcional) Dominio propio
En Vercel → Settings → Domains → agregar tu dominio.

---

## PASO 4 — Configurar Supabase Auth para producción

### 4.1 Agregar la URL de producción
En Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://tu-app.vercel.app`
- **Redirect URLs**: `https://tu-app.vercel.app/auth/callback`

---

## PASO 5 — Verificar que todo funciona

1. Abrir `https://tu-app.vercel.app/login`
2. Hacer click en "MAU", ingresar la contraseña
3. Verificar que redirige al dashboard
4. Cargar un movimiento de prueba
5. Cerrar sesión y entrar como Juani
6. Verificar que el movimiento cargado por Mau es visible

---

## Variables de entorno — resumen completo

```bash
# .env.local (para desarrollo local)
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.local.example .env.local
# → Editar .env.local con las credenciales de Supabase

# Correr en modo desarrollo
npm run dev
# → http://localhost:3000

# Build de producción (verificar que compila sin errores)
npm run build
```

---

## Estructura del proyecto

```
freehouse/
├── supabase/
│   ├── schema.sql        ← Ejecutar en Supabase SQL Editor
│   ├── validate.sql      ← Tests opcionales
│   └── SETUP.md
│
├── src/
│   ├── app/
│   │   ├── api/          ← Backend (8 rutas REST)
│   │   ├── dashboard/    ← Balance + resumen
│   │   ├── movimientos/  ← Lista + cargar
│   │   ├── plantillas/   ← Plantillas + carga masiva
│   │   ├── reglas/       ← Reglas de reparto
│   │   └── login/
│   │
│   ├── components/
│   │   ├── forms/
│   │   │   └── MovementDrawer.tsx  ← Formulario de carga rápida
│   │   └── layout/
│   │       ├── TopBar.tsx
│   │       └── BottomNav.tsx
│   │
│   ├── lib/
│   │   ├── balance.ts    ← Motor de cálculo financiero
│   │   ├── fmt.ts        ← Formateo de números y fechas
│   │   └── supabase/     ← Clientes (browser + server)
│   │
│   ├── hooks/
│   │   └── useCatalog.ts ← Negocios + categorías + reglas
│   │
│   ├── types/index.ts    ← Tipos TypeScript completos
│   └── middleware.ts     ← Protección de rutas
│
├── .env.local.example
├── package.json
├── tailwind.config.js
└── next.config.js
```

---

## Troubleshooting

**Error: "No autorizado" en todas las rutas**
→ Verificar que `NEXT_PUBLIC_SUPABASE_ANON_KEY` está correctamente seteada en Vercel.

**El balance no calcula correctamente**
→ Verificar que el schema fue ejecutado completo en Supabase. Revisar la tabla `split_rules`.

**El login no redirige después de autenticar**
→ Verificar que la `Site URL` en Supabase Auth apunta a la URL correcta de producción.

**Error 404 en `/auth/callback`**
→ Asegurarse de que el archivo `src/app/auth/callback/route.ts` existe en el repo.

**Plantillas no cargan en el drawer**
→ Verificar que la tabla `templates` tiene datos. Ejecutar el bloque `DO $$ ... $$` de plantillas de ejemplo del schema.

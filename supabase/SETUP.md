# Configuración de Supabase — FreeHouse S.A.

## Paso 1: Crear proyecto en Supabase

1. Ir a https://supabase.com/dashboard
2. "New project" → nombre: `freehouse`
3. Elegir región: South America (São Paulo) o la más cercana
4. Guardar la contraseña de la base de datos
5. Esperar ~2 min a que el proyecto esté listo

## Paso 2: Ejecutar el schema

1. En el dashboard: **SQL Editor** → "New query"
2. Pegar el contenido completo de `supabase/schema.sql`
3. Click **Run**
4. Verificar que no hay errores en la consola

## Paso 3: Crear los usuarios (Mau y Juani)

Ir a **Authentication → Users → "Invite user"** o usar el SQL Editor:

```sql
-- Opción A: Crear desde el dashboard
-- Authentication > Users > Add user
-- Email: mau@freehouse.com    Password: (elegir)
-- Email: juani@freehouse.com  Password: (elegir)

-- Opción B: Crear via API desde terminal (después de configurar .env.local)
-- Ver scripts/create-users.ts
```

**El trigger `on_auth_user_created` crea el profile automáticamente.**

Para asignar el nombre correcto después de crear el usuario:
```sql
-- Actualizar nombre en profiles después de crear el usuario
UPDATE public.profiles
SET name = 'Mau'
WHERE id = (SELECT id FROM auth.users WHERE email = 'mau@freehouse.com');

UPDATE public.profiles
SET name = 'Juani'
WHERE id = (SELECT id FROM auth.users WHERE email = 'juani@freehouse.com');
```

## Paso 4: Ejecutar validación

1. SQL Editor → "New query"
2. Pegar el contenido de `supabase/validate.sql`
3. Click **Run**
4. Verificar que todos los pasos muestran ✅ en los NOTICE

## Paso 5: Obtener credenciales para Next.js

En el dashboard: **Settings → API**

```
NEXT_PUBLIC_SUPABASE_URL      = https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...  (anon/public key)
SUPABASE_SERVICE_ROLE_KEY     = eyJ...  (service_role — NUNCA exponerla al cliente)
```

Copiar a `.env.local` (ver `.env.local.example`)

## Verificaciones rápidas post-setup

```sql
-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Esperado: audit_log, businesses, categories, exchange_rates,
--           movements, profiles, split_rules, templates

-- Verificar negocios
SELECT name, color FROM public.businesses ORDER BY name;
-- FREEhouse | #00d4ff
-- FREEproject | #4fffb0
-- FREEwork | #ffb547

-- Verificar reglas de reparto (no debe haber duplicados)
SELECT
  b.name  AS negocio,
  c.name  AS categoria,
  r.pct_mau,
  r.pct_juani
FROM public.split_rules r
LEFT JOIN public.businesses b ON b.id = r.business_id
LEFT JOIN public.categories c ON c.id = r.category_id
ORDER BY b.name, c.name NULLS FIRST;
-- FREEhouse   | (null)         | 50 | 50
-- FREEproject | (null)         | 50 | 50
-- FREEwork    | (null)         | 40 | 60
-- FREEwork    | mantenimiento  | 40 | 60
-- FREEwork    | membresias     | 40 | 60
-- FREEwork    | obra           | 50 | 50

-- Verificar que existe exactamente UNA regla general por negocio
SELECT business_id, COUNT(*) as count
FROM public.split_rules
WHERE category_id IS NULL
GROUP BY business_id
HAVING COUNT(*) > 1;
-- Debe devolver 0 filas

-- Verificar trigger de profiles
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- on_auth_user_created

-- Verificar índices únicos parciales
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'split_rules' AND schemaname = 'public';
-- uq_split_rules_general  | ... WHERE category_id IS NULL
-- uq_split_rules_specific | ... WHERE category_id IS NOT NULL
```

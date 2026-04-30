-- ============================================================
-- FREEHOUSE S.A. — Esquema de base de datos v2 (auditado)
-- Ejecutar completo en Supabase > SQL Editor
-- ============================================================

-- ── Extensiones ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: profiles
-- Extiende auth.users de Supabase.
-- Se crea automáticamente vía trigger al registrar usuario.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'partner' CHECK (role IN ('partner', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FIX: Trigger que crea el profile automáticamente al registrar usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLA: businesses (negocios)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.businesses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#4fffb0',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.businesses (name, color) VALUES
  ('FREEproject', '#4fffb0'),
  ('FREEhouse',   '#00d4ff'),
  ('FREEwork',    '#ffb547')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- TABLA: categories (categorías)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.categories (name) VALUES
  ('servicios'),
  ('mejoras'),
  ('mantenimiento'),
  ('membresias'),
  ('obra'),
  ('ingresos'),
  ('sueldos'),
  ('impuestos'),
  ('otros'),
  ('honorarios')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- TABLA: split_rules (reglas de reparto)
-- Prioridad: (biz + cat) específica > (biz) general > default 50/50
--
-- FIX CRÍTICO: UNIQUE parcial para manejar NULLs correctamente.
-- PostgreSQL trata NULL != NULL en UNIQUE estándar, por lo que
-- permitiría múltiples reglas generales por negocio si se usa
-- UNIQUE(business_id, category_id). Se usan índices parciales.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.split_rules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  pct_mau       NUMERIC(5,2) NOT NULL CHECK (pct_mau >= 0 AND pct_mau <= 100),
  pct_juani     NUMERIC(5,2) NOT NULL CHECK (pct_juani >= 0 AND pct_juani <= 100),
  CONSTRAINT pct_sum_100 CHECK (ABS(pct_mau + pct_juani - 100) < 0.01)
);

-- Índice único para reglas específicas (negocio + categoría concreta)
CREATE UNIQUE INDEX IF NOT EXISTS uq_split_rules_specific
  ON public.split_rules (business_id, category_id)
  WHERE category_id IS NOT NULL;

-- Índice único para regla general por negocio (sin categoría)
CREATE UNIQUE INDEX IF NOT EXISTS uq_split_rules_general
  ON public.split_rules (business_id)
  WHERE category_id IS NULL;

-- Reglas iniciales según el spec.
-- IMPORTANTE: ON CONFLICT DO NOTHING no funciona con índices únicos parciales
-- porque PostgreSQL no puede inferir qué índice usar en un INSERT multi-fila
-- con NULLs mezclados. Se insertan una por una con manejo de excepciones.
DO $$
DECLARE
  biz_project UUID := (SELECT id FROM public.businesses WHERE name = 'FREEproject');
  biz_house   UUID := (SELECT id FROM public.businesses WHERE name = 'FREEhouse');
  biz_work    UUID := (SELECT id FROM public.businesses WHERE name = 'FREEwork');
  cat_mant    UUID := (SELECT id FROM public.categories WHERE name = 'mantenimiento');
  cat_memb    UUID := (SELECT id FROM public.categories WHERE name = 'membresias');
  cat_obra    UUID := (SELECT id FROM public.categories WHERE name = 'obra');

  PROCEDURE upsert_rule(p_biz UUID, p_cat UUID, p_mau NUMERIC, p_juani NUMERIC) AS $$
  BEGIN
    INSERT INTO public.split_rules (business_id, category_id, pct_mau, pct_juani)
    VALUES (p_biz, p_cat, p_mau, p_juani);
  EXCEPTION WHEN unique_violation THEN
    NULL; -- Ya existe, no hacer nada
  END;
  $$ LANGUAGE plpgsql;

BEGIN
  CALL upsert_rule(biz_project, NULL,     50, 50);  -- FREEproject general: 50/50
  CALL upsert_rule(biz_house,   NULL,     50, 50);  -- FREEhouse general: 50/50
  CALL upsert_rule(biz_work,    NULL,     40, 60);  -- FREEwork general: 40/60
  CALL upsert_rule(biz_work,    cat_mant, 40, 60);  -- FREEwork mantenimiento: 40/60
  CALL upsert_rule(biz_work,    cat_memb, 40, 60);  -- FREEwork membresías: 40/60
  CALL upsert_rule(biz_work,    cat_obra, 50, 50);  -- FREEwork obra: 50/50
END $$;

-- ============================================================
-- TABLA: templates (plantillas de movimientos recurrentes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  type            TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  default_paid_by TEXT NOT NULL CHECK (default_paid_by IN ('mau', 'juani', 'ambos')),
  description     TEXT,
  is_favorite     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plantillas de ejemplo
DO $$
DECLARE
  biz_work UUID := (SELECT id FROM public.businesses WHERE name = 'FREEwork');
  cat_serv UUID := (SELECT id FROM public.categories WHERE name = 'servicios');
  cat_memb UUID := (SELECT id FROM public.categories WHERE name = 'membresias');
  biz_project UUID := (SELECT id FROM public.businesses WHERE name = 'FREEproject');
  cat_honorarios UUID := (SELECT id FROM public.categories WHERE name = 'honorarios');
BEGIN
  IF biz_work IS NOT NULL THEN
    INSERT INTO public.templates (name, business_id, category_id, type, default_paid_by, description, is_favorite)
    VALUES
      ('Electricidad',         biz_work, cat_serv, 'gasto',   'mau',   'Pago mensual Edesur',    TRUE),
      ('Internet',             biz_work, cat_serv, 'gasto',   'mau',   'Abono fibra óptica',     TRUE),
      ('Gas',                  biz_work, cat_serv, 'gasto',   'juani', 'Pago mensual Metrogas',  TRUE),
      ('Expensas',             biz_work, cat_serv, 'gasto',   'juani', 'Expensas del edificio',  FALSE),
      ('Membresía coworking',  biz_work, cat_memb, 'ingreso', 'juani', 'Pago mensual de socios', TRUE);
  END IF;

  IF biz_project IS NOT NULL AND cat_honorarios IS NOT NULL THEN
    INSERT INTO public.templates (name, business_id, category_id, type, default_paid_by, description, is_favorite)
    VALUES
      ('Honorarios Proyecto',                 biz_project, cat_honorarios, 'ingreso', 'ambos', 'Honorarios Proyecto',                 TRUE),
      ('Honorarios Dirección de Obra',       biz_project, cat_honorarios, 'ingreso', 'ambos', 'Honorarios Dirección de Obra',       TRUE),
      ('Honorarios Administración de Obra',  biz_project, cat_honorarios, 'ingreso', 'ambos', 'Honorarios Administración de Obra',  TRUE),
      ('Honorarios Black',                   biz_project, cat_honorarios, 'ingreso', 'ambos', 'Honorarios Black',                   TRUE);
  END IF;
END $$;

-- ============================================================
-- TABLA: movements (transacciones)
--
-- DISEÑO CLAVE:
--   paid_by    → quién realizó el pago/cobro físicamente (DETERMINA EL BALANCE)
--   created_by → quién registró el movimiento en el sistema (auditoría)
--   Pueden ser distintos. El balance se calcula SOLO con paid_by.
--
--   amount_ars → columna generada: amount * exchange_rate
--                Siempre en ARS para el cálculo del balance.
--
--   pct_mau/pct_juani → snapshot del reparto al momento del registro.
--                       Si se modifica una regla, los movimientos históricos NO cambian.
--   split_override → FALSE: porcentajes calculados automáticamente desde split_rules
--                    TRUE:  porcentajes ingresados manualmente por el usuario
-- ============================================================
CREATE TABLE IF NOT EXISTS public.movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Datos financieros
  date            DATE           NOT NULL,
  amount          NUMERIC(14,2)  NOT NULL CHECK (amount > 0),
  currency        TEXT           NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD', 'EUR')),
  exchange_rate   NUMERIC(14,4)  NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
  amount_ars      NUMERIC(14,2)  GENERATED ALWAYS AS (amount * exchange_rate) STORED,

  type            TEXT           NOT NULL CHECK (type IN ('ingreso', 'gasto')),

  -- Clasificación
  business_id     UUID           NOT NULL REFERENCES public.businesses(id)  ON DELETE RESTRICT,
  category_id     UUID           NOT NULL REFERENCES public.categories(id)  ON DELETE RESTRICT,
  template_id     UUID                    REFERENCES public.templates(id)   ON DELETE SET NULL,

  -- Agrupa los dos movimientos creados por AMBOS para poder borrarlos juntos
  linked_group_id UUID,

  -- CRÍTICO: quién pagó o cobró (base del cálculo de balance)
  paid_by         TEXT           NOT NULL CHECK (paid_by IN ('mau', 'juani')),

  -- Quién cargó el movimiento al sistema (puede ser distinto a paid_by)
  created_by      UUID                    REFERENCES public.profiles(id)    ON DELETE SET NULL,

  description     TEXT,

  -- Excluir del balance sin borrar el registro
  affects_balance BOOLEAN        NOT NULL DEFAULT TRUE,

  -- Reparto: siempre guardado como snapshot inmutable tras creación
  split_override  BOOLEAN        NOT NULL DEFAULT FALSE,
  pct_mau         NUMERIC(5,2)   NOT NULL DEFAULT 50 CHECK (pct_mau   >= 0 AND pct_mau   <= 100),
  pct_juani       NUMERIC(5,2)   NOT NULL             CHECK (pct_juani >= 0 AND pct_juani <= 100),
  CONSTRAINT mov_pct_sum CHECK (ABS(pct_mau + pct_juani - 100) < 0.01),

  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: exchange_rates (tipos de cambio históricos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency    TEXT           NOT NULL CHECK (currency IN ('USD', 'EUR')),
  rate        NUMERIC(14,4)  NOT NULL CHECK (rate > 0),
  valid_from  DATE           NOT NULL DEFAULT CURRENT_DATE,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (currency, valid_from)
);

INSERT INTO public.exchange_rates (currency, rate) VALUES
  ('USD', 1200),
  ('EUR', 1350)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLA: audit_log
-- Registra todos los cambios sobre movimientos.
-- user_id se pasa desde la capa de API (más confiable que triggers
-- que no tienen acceso directo a auth.uid() en todas las config).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name  TEXT        NOT NULL,
  record_id   UUID        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data    JSONB,
  new_data    JSONB,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_movements_date_desc   ON public.movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_period      ON public.movements(date_trunc('month', date));
CREATE INDEX IF NOT EXISTS idx_movements_business    ON public.movements(business_id);
CREATE INDEX IF NOT EXISTS idx_movements_category    ON public.movements(category_id);
CREATE INDEX IF NOT EXISTS idx_movements_linked_group_id ON public.movements(linked_group_id) WHERE linked_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movements_paid_by     ON public.movements(paid_by);
-- Índice parcial: solo movimientos que afectan balance (los más consultados)
CREATE INDEX IF NOT EXISTS idx_movements_billable    ON public.movements(date DESC, business_id) WHERE affects_balance = TRUE;
-- Full-text search en descripción
CREATE INDEX IF NOT EXISTS idx_movements_fts         ON public.movements USING gin(to_tsvector('spanish', COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_audit_record          ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created         ON public.audit_log(created_at DESC);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_movements_updated_at ON public.movements;
CREATE TRIGGER trg_movements_updated_at
  BEFORE UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- VISTA: v_balance
-- Balance consolidado por período y negocio.
-- La lógica financiera implementada:
--   signed = gasto → +amount_ars | ingreso → -amount_ars
--   paid[socio]   += signed   (si paid_by = ese socio)
--   should[socio] += signed * pct_socio / 100
--   balance        = paid - should  (>0 le deben, <0 debe)
-- ============================================================
CREATE OR REPLACE VIEW public.v_balance AS
WITH billable AS (
  SELECT
    date_trunc('month', m.date)::DATE                                    AS period,
    m.business_id,
    b.name                                                               AS business_name,
    b.color                                                              AS business_color,
    m.type,
    m.paid_by,
    m.amount_ars,
    m.pct_mau,
    m.pct_juani,
    CASE WHEN m.type = 'gasto' THEN m.amount_ars ELSE -m.amount_ars END  AS signed_amount
  FROM public.movements m
  JOIN public.businesses b ON b.id = m.business_id
  WHERE m.affects_balance = TRUE
),
aggregated AS (
  SELECT
    period,
    business_id,
    business_name,
    business_color,
    SUM(CASE WHEN paid_by = 'mau'   THEN signed_amount ELSE 0 END)    AS mau_paid,
    SUM(CASE WHEN paid_by = 'juani' THEN signed_amount ELSE 0 END)    AS juani_paid,
    SUM(signed_amount * pct_mau   / 100)                              AS mau_should,
    SUM(signed_amount * pct_juani / 100)                              AS juani_should,
    SUM(CASE WHEN type = 'ingreso' THEN amount_ars ELSE 0 END)        AS total_income,
    SUM(CASE WHEN type = 'gasto'   THEN amount_ars ELSE 0 END)        AS total_expense,
    COUNT(*)                                                           AS movement_count
  FROM billable
  GROUP BY period, business_id, business_name, business_color
)
SELECT
  period,
  business_id,
  business_name,
  business_color,
  mau_paid,
  juani_paid,
  mau_should,
  juani_should,
  mau_paid   - mau_should   AS mau_balance,
  juani_paid - juani_should AS juani_balance,
  total_income,
  total_expense,
  total_income - total_expense AS net_result,
  movement_count
FROM aggregated;

-- ============================================================
-- FUNCIÓN RPC: get_balance
-- Calcula el balance para un rango de fechas y/o negocio.
-- Llamada desde la API de Next.js.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_balance(
  p_date_from   DATE DEFAULT NULL,
  p_date_to     DATE DEFAULT NULL,
  p_business_id UUID DEFAULT NULL
)
RETURNS TABLE (
  mau_paid        NUMERIC,
  juani_paid      NUMERIC,
  mau_should      NUMERIC,
  juani_should    NUMERIC,
  mau_balance     NUMERIC,
  juani_balance   NUMERIC,
  total_income    NUMERIC,
  total_expense   NUMERIC,
  net_result      NUMERIC,
  movement_count  BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH billable AS (
    SELECT
      m.paid_by,
      m.type,
      m.amount_ars,
      m.pct_mau,
      m.pct_juani,
      CASE WHEN m.type = 'gasto' THEN m.amount_ars ELSE -m.amount_ars END AS signed
    FROM public.movements m
    WHERE
      m.affects_balance = TRUE
      AND (p_date_from   IS NULL OR m.date >= p_date_from)
      AND (p_date_to     IS NULL OR m.date <= p_date_to)
      AND (p_business_id IS NULL OR m.business_id = p_business_id)
  )
  SELECT
    COALESCE(SUM(CASE WHEN paid_by = 'mau'   THEN signed ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN paid_by = 'juani' THEN signed ELSE 0 END), 0),
    COALESCE(SUM(signed * pct_mau   / 100), 0),
    COALESCE(SUM(signed * pct_juani / 100), 0),
    COALESCE(SUM(CASE WHEN paid_by = 'mau'   THEN signed ELSE 0 END), 0)
      - COALESCE(SUM(signed * pct_mau   / 100), 0),
    COALESCE(SUM(CASE WHEN paid_by = 'juani' THEN signed ELSE 0 END), 0)
      - COALESCE(SUM(signed * pct_juani / 100), 0),
    COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_ars ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'gasto'   THEN amount_ars ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_ars ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type = 'gasto' THEN amount_ars ELSE 0 END), 0),
    COUNT(*)
  FROM billable;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- Política: acceso total para usuarios autenticados.
-- Ambos socios ven y modifican los mismos datos.
-- ============================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles','businesses','categories','split_rules',
    'templates','movements','exchange_rates','audit_log'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS authenticated_full_access ON public.%I;
       CREATE POLICY authenticated_full_access ON public.%I
         FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);',
      tbl, tbl
    );
  END LOOP;
END $$;

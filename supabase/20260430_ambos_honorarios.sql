-- ============================================================
-- FREEHOUSE S.A. — Migración: AMBOS + honorarios FREEproject
-- Ejecutar en Supabase > SQL Editor sobre una base ya existente.
-- ============================================================

-- 1) Nueva categoría
INSERT INTO public.categories (name)
VALUES ('honorarios')
ON CONFLICT (name) DO NOTHING;

-- 2) Permitir AMBOS en plantillas
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'templates'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%default_paid_by%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.templates DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.templates
    ADD CONSTRAINT templates_default_paid_by_check
    CHECK (default_paid_by IN ('mau', 'juani', 'ambos'));
END $$;

-- 3) Nuevas plantillas de FREEproject
DO $$
DECLARE
  biz_project UUID := (SELECT id FROM public.businesses WHERE name = 'FREEproject');
  cat_honorarios UUID := (SELECT id FROM public.categories WHERE name = 'honorarios');
BEGIN
  IF biz_project IS NULL THEN
    RAISE EXCEPTION 'No existe el negocio FREEproject';
  END IF;

  IF cat_honorarios IS NULL THEN
    RAISE EXCEPTION 'No existe la categoría honorarios';
  END IF;

  INSERT INTO public.templates (name, business_id, category_id, type, default_paid_by, description, is_favorite)
  SELECT v.name, biz_project, cat_honorarios, 'ingreso', 'ambos', v.description, TRUE
  FROM (VALUES
    ('Honorarios Proyecto',                'Honorarios Proyecto'),
    ('Honorarios Dirección de Obra',       'Honorarios Dirección de Obra'),
    ('Honorarios Administración de Obra',  'Honorarios Administración de Obra'),
    ('Honorarios Black',                   'Honorarios Black')
  ) AS v(name, description)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.templates t
    WHERE t.name = v.name
      AND t.business_id = biz_project
  );
END $$;

-- 4) Vincular movimientos creados con AMBOS para borrado conjunto
ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS linked_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_movements_linked_group_id
ON public.movements(linked_group_id)
WHERE linked_group_id IS NOT NULL;


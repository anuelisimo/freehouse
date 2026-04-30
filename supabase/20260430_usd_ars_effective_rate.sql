-- ============================================================
-- FREEHOUSE — USD/ARS con dólar blue efectivo al registrar
-- Ejecutar en Supabase > SQL Editor.
--
-- Qué deja preparado:
-- 1) usd_exchange_rate = cotización ARS/USD usada en cada movimiento.
-- 2) amount_ars = equivalente ARS generado automáticamente.
-- 3) amount_usd = equivalente USD generado automáticamente.
--
-- Regla de datos:
-- - ARS: amount = pesos originales, exchange_rate = 1, amount_usd = amount / usd_exchange_rate.
-- - USD: amount = dólares originales, exchange_rate = usd_exchange_rate, amount_ars = amount * exchange_rate.
-- ============================================================

ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS usd_exchange_rate NUMERIC(14,4) CHECK (usd_exchange_rate IS NULL OR usd_exchange_rate > 0);

-- amount_ars ya existía en el esquema original como columna generada.
-- Se recrea para asegurar compatibilidad si venís de una versión intermedia.
ALTER TABLE public.movements
DROP COLUMN IF EXISTS amount_ars;

ALTER TABLE public.movements
ADD COLUMN amount_ars NUMERIC(14,2)
GENERATED ALWAYS AS (amount * exchange_rate) STORED;

-- amount_usd puede no existir o haber quedado como columna normal.
-- Se recrea como columna generada para que siempre quede consistente.
ALTER TABLE public.movements
DROP COLUMN IF EXISTS amount_usd;

ALTER TABLE public.movements
ADD COLUMN amount_usd NUMERIC(14,2)
GENERATED ALWAYS AS (
  CASE
    WHEN currency = 'USD' THEN amount
    WHEN usd_exchange_rate IS NOT NULL AND usd_exchange_rate > 0 THEN amount / usd_exchange_rate
    ELSE NULL
  END
) STORED;

CREATE INDEX IF NOT EXISTS idx_movements_amount_ars ON public.movements(amount_ars);
CREATE INDEX IF NOT EXISTS idx_movements_amount_usd ON public.movements(amount_usd);
CREATE INDEX IF NOT EXISTS idx_movements_usd_exchange_rate ON public.movements(usd_exchange_rate);

-- Normalizar registros existentes sin estimación histórica todavía.
-- El backfill histórico de la app puede reemplazar usd_exchange_rate luego por fecha.
UPDATE public.movements
SET exchange_rate = 1
WHERE currency = 'ARS' AND exchange_rate <> 1;

UPDATE public.movements m
SET usd_exchange_rate = COALESCE(
  m.usd_exchange_rate,
  CASE WHEN m.currency = 'USD' AND m.exchange_rate > 1 THEN m.exchange_rate ELSE NULL END,
  (
    SELECT er.rate
    FROM public.exchange_rates er
    WHERE er.currency = 'USD' AND er.valid_from <= m.date
    ORDER BY er.valid_from DESC
    LIMIT 1
  ),
  (
    SELECT er.rate
    FROM public.exchange_rates er
    WHERE er.currency = 'USD'
    ORDER BY er.valid_from DESC
    LIMIT 1
  )
)
WHERE m.usd_exchange_rate IS NULL;

NOTIFY pgrst, 'reload schema';

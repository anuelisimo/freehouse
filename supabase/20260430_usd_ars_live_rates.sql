-- ============================================================
-- FREEHOUSE — USD/ARS con cotización viva + histórico estimado
-- Ejecutar en Supabase > SQL Editor después de la migración AMBOS.
-- ============================================================

ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS usd_exchange_rate NUMERIC(14,4) CHECK (usd_exchange_rate IS NULL OR usd_exchange_rate > 0);

-- amount_usd se calcula con la cotización USD usada en el movimiento.
-- Para USD: amount_usd = amount.
-- Para ARS: amount_usd = amount / usd_exchange_rate.
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

CREATE INDEX IF NOT EXISTS idx_movements_amount_usd ON public.movements(amount_usd);
CREATE INDEX IF NOT EXISTS idx_movements_usd_exchange_rate ON public.movements(usd_exchange_rate);

-- Backfill mínimo seguro: no estima históricos, solo evita NULL usando la última cotización guardada.
-- Para estimar correctamente movimientos viejos por fecha, usar el botón/API de backfill incluida en la app.
UPDATE public.movements m
SET usd_exchange_rate = COALESCE(
  m.usd_exchange_rate,
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

-- Mantener exchange_rate consistente: ARS no debe multiplicar amount_ars.
UPDATE public.movements
SET exchange_rate = 1
WHERE currency = 'ARS' AND exchange_rate <> 1;

NOTIFY pgrst, 'reload schema';

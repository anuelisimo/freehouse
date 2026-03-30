-- ============================================================
-- FREEHOUSE S.A. — Validación end-to-end
-- Ejecutar en Supabase > SQL Editor DESPUÉS del schema principal
--
-- Este script:
--   1. Verifica los índices únicos parciales de split_rules
--   2. Verifica el trigger de profiles
--   3. Inserta datos de prueba reales
--   4. Valida el cálculo de balance con resultado esperado conocido
--   5. Limpia los datos de prueba al final
-- ============================================================

-- ============================================================
-- SECCIÓN 1: VERIFICAR ESTRUCTURA
-- ============================================================

-- 1a. Confirmar que los índices únicos parciales existen
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'split_rules'
  AND schemaname = 'public'
ORDER BY indexname;

/*
Resultado esperado:
  uq_split_rules_specific → ON split_rules (business_id, category_id) WHERE category_id IS NOT NULL
  uq_split_rules_general  → ON split_rules (business_id)              WHERE category_id IS NULL
*/

-- 1b. Confirmar que el trigger de profiles existe
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

/*
Resultado esperado:
  on_auth_user_created | INSERT | users | AFTER
*/

-- ============================================================
-- SECCIÓN 2: PROBAR QUE NO SE PUEDEN DUPLICAR REGLAS GENERALES
-- ============================================================

-- 2a. Intentar insertar una segunda regla general para FREEproject (debe fallar)
DO $$
DECLARE
  biz_id UUID := (SELECT id FROM public.businesses WHERE name = 'FREEproject');
  err_msg TEXT;
BEGIN
  BEGIN
    -- Este INSERT debe lanzar error de unique violation (código 23505)
    INSERT INTO public.split_rules (business_id, category_id, pct_mau, pct_juani)
    VALUES (biz_id, NULL, 70, 30);

    -- Si llega acá, el índice NO está funcionando
    RAISE EXCEPTION 'ERROR CRÍTICO: Se permitió insertar regla general duplicada para FREEproject';

  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✅ PASS: Regla general duplicada rechazada correctamente (unique_violation)';
  END;
END $$;

-- 2b. Intentar insertar una segunda regla específica duplicada (debe fallar)
DO $$
DECLARE
  biz_id UUID := (SELECT id FROM public.businesses   WHERE name = 'FREEwork');
  cat_id UUID := (SELECT id FROM public.categories   WHERE name = 'mantenimiento');
  err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO public.split_rules (business_id, category_id, pct_mau, pct_juani)
    VALUES (biz_id, cat_id, 20, 80);

    RAISE EXCEPTION 'ERROR CRÍTICO: Se permitió insertar regla específica duplicada';

  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✅ PASS: Regla específica duplicada rechazada correctamente (unique_violation)';
  END;
END $$;

-- 2c. Confirmar que sí se permite una regla específica NUEVA para el mismo negocio
DO $$
DECLARE
  biz_id UUID := (SELECT id FROM public.businesses WHERE name = 'FREEproject');
  cat_id UUID := (SELECT id FROM public.categories WHERE name = 'impuestos');
  new_id UUID;
BEGIN
  INSERT INTO public.split_rules (business_id, category_id, pct_mau, pct_juani)
  VALUES (biz_id, cat_id, 60, 40)
  RETURNING id INTO new_id;

  RAISE NOTICE '✅ PASS: Regla específica nueva permitida correctamente. ID: %', new_id;

  -- Limpiar regla de prueba
  DELETE FROM public.split_rules WHERE id = new_id;
  RAISE NOTICE '✅ Regla de prueba eliminada';
END $$;

-- ============================================================
-- SECCIÓN 3: SIMULAR CREACIÓN DE USUARIO (trigger de profiles)
-- ============================================================
-- En producción, auth.users solo acepta inserts via Supabase Auth API.
-- Verificamos que la función handle_new_user existe y es correcta.

-- 3a. Verificar que la función handle_new_user tiene la lógica correcta
SELECT
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- 3b. Verificar que profiles se puede insertar directamente (para testing)
-- En Supabase, podés crear usuarios desde Authentication > Users
-- y el trigger crea el profile automáticamente.
-- Este bloque simula lo que haría el trigger:
DO $$
DECLARE
  test_user_id UUID := uuid_generate_v4();
BEGIN
  -- Simular inserción directa en profiles (lo que hace el trigger)
  INSERT INTO public.profiles (id, name, role)
  VALUES (test_user_id, 'Mau Test', 'partner');

  RAISE NOTICE '✅ PASS: Profile insertable correctamente. ID: %', test_user_id;

  -- Limpiar
  DELETE FROM public.profiles WHERE id = test_user_id;
  RAISE NOTICE '✅ Profile de prueba eliminado';
END $$;

-- ============================================================
-- SECCIÓN 4: INSERCIÓN Y VALIDACIÓN END-TO-END COMPLETA
-- ============================================================
-- Escenario: Mau paga luz ($10.000) y Juani cobra membresía ($5.000)
-- en FREEwork con regla 40% Mau / 60% Juani.
--
-- Cálculo esperado:
--   signed(luz)       = +10.000  (gasto → positivo)
--   signed(membresia) = -5.000   (ingreso → negativo)
--
--   mau_paid   = +10.000  (Mau pagó la luz)
--   juani_paid = -5.000   (Juani cobró la membresía)
--
--   mau_should   = 10.000 * 0.40 + (-5.000) * 0.40 = 4.000 - 2.000 = +2.000
--   juani_should = 10.000 * 0.60 + (-5.000) * 0.60 = 6.000 - 3.000 = +3.000
--
--   mau_balance   = 10.000 - 2.000 = +8.000  → Juani le debe $8.000 a Mau
--   juani_balance = -5.000 - 3.000 = -8.000  → Juani debe $8.000
--
--   Verificación: 8.000 + (-8.000) = 0 ✅
-- ============================================================

DO $$
DECLARE
  -- IDs de prueba
  test_profile_id   UUID := uuid_generate_v4();
  test_mov_luz_id   UUID;
  test_mov_memb_id  UUID;
  biz_work_id       UUID;
  cat_serv_id       UUID;
  cat_memb_id       UUID;

  -- Resultados del balance
  v_mau_paid        NUMERIC;
  v_juani_paid      NUMERIC;
  v_mau_should      NUMERIC;
  v_juani_should    NUMERIC;
  v_mau_balance     NUMERIC;
  v_juani_balance   NUMERIC;
  v_invariant_check NUMERIC;

BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO VALIDACIÓN END-TO-END';
  RAISE NOTICE '========================================';

  -- Resolver IDs reales de la base de datos
  SELECT id INTO biz_work_id FROM public.businesses WHERE name = 'FREEwork';
  SELECT id INTO cat_serv_id FROM public.categories WHERE name = 'servicios';
  SELECT id INTO cat_memb_id FROM public.categories WHERE name = 'membresias';

  IF biz_work_id IS NULL THEN
    RAISE EXCEPTION 'FREEwork no encontrado — ejecutar schema.sql primero';
  END IF;

  -- ── Paso 1: Crear un profile de prueba ──────────────────────
  INSERT INTO public.profiles (id, name, role)
  VALUES (test_profile_id, 'Mau (test)', 'partner');
  RAISE NOTICE '✅ Paso 1: Profile creado (id=%)', test_profile_id;

  -- ── Paso 2: Insertar movimiento 1 — Gasto $10.000 (Mau pagó) ─
  INSERT INTO public.movements (
    date, amount, currency, exchange_rate,
    type, business_id, category_id,
    paid_by, created_by,
    description, affects_balance,
    split_override, pct_mau, pct_juani
  )
  VALUES (
    '2025-03-01', 10000, 'ARS', 1,
    'gasto', biz_work_id, cat_serv_id,
    'mau', test_profile_id,
    'Electricidad marzo (TEST)', TRUE,
    FALSE, 40, 60
  )
  RETURNING id INTO test_mov_luz_id;

  RAISE NOTICE '✅ Paso 2: Movimiento gasto creado — amount_ars calculado automáticamente';
  RAISE NOTICE '   ID: %, paid_by: mau, amount: 10000 ARS, pct: 40/60', test_mov_luz_id;

  -- ── Paso 3: Insertar movimiento 2 — Ingreso $5.000 (Juani cobró) ─
  INSERT INTO public.movements (
    date, amount, currency, exchange_rate,
    type, business_id, category_id,
    paid_by, created_by,
    description, affects_balance,
    split_override, pct_mau, pct_juani
  )
  VALUES (
    '2025-03-15', 5000, 'ARS', 1,
    'ingreso', biz_work_id, cat_memb_id,
    'juani', test_profile_id,
    'Membresía marzo (TEST)', TRUE,
    FALSE, 40, 60
  )
  RETURNING id INTO test_mov_memb_id;

  RAISE NOTICE '✅ Paso 3: Movimiento ingreso creado';
  RAISE NOTICE '   ID: %, paid_by: juani, amount: 5000 ARS, pct: 40/60', test_mov_memb_id;

  -- ── Paso 4: Verificar amount_ars generado automáticamente ────
  PERFORM id FROM public.movements
  WHERE id = test_mov_luz_id AND amount_ars = 10000;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERROR: amount_ars no se generó correctamente para movimiento de luz';
  END IF;
  RAISE NOTICE '✅ Paso 4: amount_ars generado correctamente (10000 * 1 = 10000)';

  -- ── Paso 5: Calcular balance usando la función RPC ───────────
  SELECT
    b.mau_paid, b.juani_paid,
    b.mau_should, b.juani_should,
    b.mau_balance, b.juani_balance
  INTO
    v_mau_paid, v_juani_paid,
    v_mau_should, v_juani_should,
    v_mau_balance, v_juani_balance
  FROM public.get_balance(
    '2025-03-01'::DATE,
    '2025-03-31'::DATE,
    biz_work_id
  ) b;

  RAISE NOTICE '';
  RAISE NOTICE '── RESULTADOS DEL BALANCE ──────────────────';
  RAISE NOTICE '  mau_paid:      %  (esperado: +10000)', v_mau_paid;
  RAISE NOTICE '  juani_paid:    %  (esperado: -5000)',  v_juani_paid;
  RAISE NOTICE '  mau_should:    %  (esperado: +2000)',  v_mau_should;
  RAISE NOTICE '  juani_should:  %  (esperado: +3000)',  v_juani_should;
  RAISE NOTICE '  mau_balance:   %  (esperado: +8000)',  v_mau_balance;
  RAISE NOTICE '  juani_balance: %  (esperado: -8000)',  v_juani_balance;

  -- ── Paso 6: Validar resultados contra valores esperados ──────
  IF v_mau_paid != 10000 THEN
    RAISE EXCEPTION 'FALLO: mau_paid esperado 10000, obtenido %', v_mau_paid;
  END IF;
  IF v_juani_paid != -5000 THEN
    RAISE EXCEPTION 'FALLO: juani_paid esperado -5000, obtenido %', v_juani_paid;
  END IF;
  IF v_mau_should != 2000 THEN
    RAISE EXCEPTION 'FALLO: mau_should esperado 2000, obtenido %', v_mau_should;
  END IF;
  IF v_juani_should != 3000 THEN
    RAISE EXCEPTION 'FALLO: juani_should esperado 3000, obtenido %', v_juani_should;
  END IF;
  IF v_mau_balance != 8000 THEN
    RAISE EXCEPTION 'FALLO: mau_balance esperado 8000, obtenido %', v_mau_balance;
  END IF;
  IF v_juani_balance != -8000 THEN
    RAISE EXCEPTION 'FALLO: juani_balance esperado -8000, obtenido %', v_juani_balance;
  END IF;

  RAISE NOTICE '✅ Paso 5-6: Todos los valores de balance son correctos';

  -- ── Paso 7: Verificar invariante matemático ──────────────────
  v_invariant_check := v_mau_balance + v_juani_balance;
  IF ABS(v_invariant_check) > 0.01 THEN
    RAISE EXCEPTION 'FALLO CRÍTICO: mau_balance + juani_balance = % (debe ser 0)', v_invariant_check;
  END IF;
  RAISE NOTICE '✅ Paso 7: Invariante matemático OK — mau_balance + juani_balance = 0';

  -- ── Paso 8: Probar movimiento con affects_balance = FALSE ────
  -- Este movimiento NO debe modificar el balance
  INSERT INTO public.movements (
    date, amount, currency, exchange_rate,
    type, business_id, category_id,
    paid_by, created_by,
    description, affects_balance,
    split_override, pct_mau, pct_juani
  )
  VALUES (
    '2025-03-20', 99999, 'ARS', 1,
    'gasto', biz_work_id, cat_serv_id,
    'mau', test_profile_id,
    'MOVIMIENTO QUE NO AFECTA BALANCE (TEST)', FALSE,
    FALSE, 40, 60
  );

  -- Recalcular balance — debe ser igual al anterior
  SELECT b.mau_balance INTO v_mau_balance
  FROM public.get_balance('2025-03-01'::DATE, '2025-03-31'::DATE, biz_work_id) b;

  IF v_mau_balance != 8000 THEN
    RAISE EXCEPTION 'FALLO: affects_balance=FALSE no fue ignorado. mau_balance = %', v_mau_balance;
  END IF;
  RAISE NOTICE '✅ Paso 8: affects_balance=FALSE correctamente ignorado en el cálculo';

  -- ── Paso 9: Verificar vista v_balance ────────────────────────
  PERFORM * FROM public.v_balance
  WHERE business_name = 'FREEwork'
    AND period = '2025-03-01'
    AND ABS(mau_balance - 8000) < 0.01;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FALLO: La vista v_balance no devuelve el resultado esperado';
  END IF;
  RAISE NOTICE '✅ Paso 9: Vista v_balance muestra resultados correctos';

  -- ── Paso 10: Probar updated_at trigger ───────────────────────
  DECLARE
    original_updated_at TIMESTAMPTZ;
    new_updated_at      TIMESTAMPTZ;
  BEGIN
    SELECT updated_at INTO original_updated_at
    FROM public.movements WHERE id = test_mov_luz_id;

    PERFORM pg_sleep(0.01); -- esperar 10ms

    UPDATE public.movements
    SET description = 'Electricidad marzo (TEST actualizado)'
    WHERE id = test_mov_luz_id;

    SELECT updated_at INTO new_updated_at
    FROM public.movements WHERE id = test_mov_luz_id;

    IF new_updated_at <= original_updated_at THEN
      RAISE EXCEPTION 'FALLO: updated_at no se actualizó tras UPDATE';
    END IF;
    RAISE NOTICE '✅ Paso 10: Trigger updated_at funciona correctamente';
  END;

  -- ── Paso 11: Probar auditoría ─────────────────────────────────
  -- La auditoría se escribe desde la API (no desde trigger),
  -- pero podemos insertar manualmente para verificar la tabla
  INSERT INTO public.audit_log (table_name, record_id, action, new_data, user_id)
  VALUES (
    'movements',
    test_mov_luz_id,
    'INSERT',
    jsonb_build_object('test', true, 'movement_id', test_mov_luz_id),
    test_profile_id
  );

  PERFORM * FROM public.audit_log WHERE record_id = test_mov_luz_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FALLO: audit_log no registró el movimiento';
  END IF;
  RAISE NOTICE '✅ Paso 11: audit_log funciona correctamente';

  -- ── Limpieza ─────────────────────────────────────────────────
  DELETE FROM public.audit_log  WHERE user_id = test_profile_id;
  DELETE FROM public.movements  WHERE created_by = test_profile_id;
  DELETE FROM public.profiles   WHERE id = test_profile_id;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ TODOS LOS TESTS PASARON CORRECTAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Resumen financiero validado:';
  RAISE NOTICE '  Gasto $10.000 (Mau pagó) + Ingreso $5.000 (Juani cobró)';
  RAISE NOTICE '  Regla FREEwork: 40%% Mau / 60%% Juani';
  RAISE NOTICE '  → Juani le debe $8.000 a Mau';

END $$;

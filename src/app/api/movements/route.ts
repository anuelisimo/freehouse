import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveRule } from '@/lib/balance'
import { z } from 'zod'

const MovementSchema = z.object({
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  amount:          z.number().positive('El monto debe ser positivo'),
  currency:        z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
  exchange_rate:   z.number().positive().default(1),
  type:            z.enum(['ingreso', 'gasto', 'liquidacion']),
  business_id:     z.string().uuid(),
  category_id:     z.string().uuid(),
  paid_by:         z.enum(['mau', 'juani']),
  description:     z.string().max(500).optional().nullable(),
  affects_balance: z.boolean().default(true),
  split_override:  z.boolean().default(false),
  // Solo requeridos si split_override = true
  pct_mau:         z.number().min(0).max(100).optional(),
  pct_juani:       z.number().min(0).max(100).optional(),
  template_id:     z.string().uuid().optional().nullable(),
  payment_method:  z.string().max(50).optional().nullable(),
}).refine(
  data => {
    // Si split_override = true, los porcentajes son obligatorios
    if (data.split_override) {
      return data.pct_mau !== undefined && data.pct_juani !== undefined
    }
    return true
  },
  { message: 'pct_mau y pct_juani son requeridos cuando split_override es true' }
).refine(
  data => {
    // Si se pasaron ambos porcentajes, deben sumar 100
    if (data.pct_mau !== undefined && data.pct_juani !== undefined) {
      return Math.abs(data.pct_mau + data.pct_juani - 100) < 0.01
    }
    return true
  },
  { message: 'pct_mau + pct_juani debe sumar 100' }
)

// GET /api/movements
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period         = searchParams.get('period')
  const businessId     = searchParams.get('business_id')
  const categoryId     = searchParams.get('category_id')
  const type           = searchParams.get('type')
  const paidBy         = searchParams.get('paid_by')
  const currency       = searchParams.get('currency')
  const search         = searchParams.get('search')
  const affectsBalance = searchParams.get('affects_balance')
  const page           = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit          = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))
  const offset         = (page - 1) * limit

  let query = supabase
    .from('movements')
    .select(
      `*, businesses(id,name,color), categories(id,name), profiles(id,name)`,
      { count: 'exact' }
    )
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (period) {
    const [year, month] = period.split('-').map(Number)
    if (!isNaN(year) && !isNaN(month)) {
      const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10)
      const endDate   = new Date(year, month, 0).toISOString().slice(0, 10)
      query = query.gte('date', startDate).lte('date', endDate)
    }
  }

  if (businessId)     query = query.eq('business_id', businessId)
  if (categoryId)     query = query.eq('category_id', categoryId)
  if (type)           query = query.eq('type', type)
  if (paidBy)         query = query.eq('paid_by', paidBy)
  if (currency)       query = query.eq('currency', currency)
  if (affectsBalance !== null && affectsBalance !== '')
                      query = query.eq('affects_balance', affectsBalance === 'true')
  if (search)         query = query.ilike('description', `%${search}%`)

  const { data, error, count } = await query

  if (error) {
    console.error('[GET /api/movements]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    meta: {
      total: count ?? 0,
      page,
      limit,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

// POST /api/movements
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const parsed = MovementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const payload = parsed.data

  // ── Resolver porcentajes de reparto ────────────────────────
  // FIX: Separar claramente los dos casos:
  //   split_override = false → calcular automáticamente desde split_rules
  //   split_override = true  → usar los porcentajes que vienen en el payload
  let pct_mau: number
  let pct_juani: number

  if (!payload.split_override) {
    // Resolución automática desde las reglas configuradas
    const { data: rules, error: rulesError } = await supabase
      .from('split_rules')
      .select('*')

    if (rulesError) {
      console.error('[POST /api/movements] Error cargando reglas:', rulesError.message)
      return NextResponse.json({ error: 'Error al cargar reglas de reparto' }, { status: 500 })
    }

    const resolved = resolveRule(payload.business_id, payload.category_id, rules ?? [])
    pct_mau   = resolved.pct_mau
    pct_juani = resolved.pct_juani
  } else {
    // El usuario definió manualmente los porcentajes
    // La validación Zod ya garantizó que ambos existen y suman 100
    pct_mau   = payload.pct_mau!
    pct_juani = payload.pct_juani!
  }

  // Escribir la auditoría y el movimiento en una sola operación
  const { data, error } = await supabase
    .from('movements')
    .insert({
      date:            payload.date,
      amount:          payload.amount,
      currency:        payload.currency,
      exchange_rate:   payload.exchange_rate,
      type:            payload.type,
      business_id:     payload.business_id,
      category_id:     payload.category_id,
      template_id:     payload.template_id ?? null,
      paid_by:         payload.paid_by,
      created_by:      user.id,
      description:     payload.description ?? null,
      affects_balance: payload.affects_balance,
      split_override:  payload.split_override,
      pct_mau,
      pct_juani,
      payment_method:  payload.payment_method ?? 'efectivo',
    })
    .select('*, businesses(id,name,color), categories(id,name), profiles(id,name)')
    .single()

  if (error) {
    console.error('[POST /api/movements]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Escribir auditoría
  await supabase.from('audit_log').insert({
    table_name: 'movements',
    record_id:  data.id,
    action:     'INSERT',
    new_data:   data as unknown as Record<string, unknown>,
    user_id:    user.id,
  })

  return NextResponse.json({ data }, { status: 201 })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveRule } from '@/lib/balance'
import { z } from 'zod'

const UpdateSchema = z.object({
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount:          z.number().positive().optional(),
  currency:        z.enum(['ARS', 'USD', 'EUR']).optional(),
  exchange_rate:   z.number().positive().optional(),
  usd_exchange_rate: z.number().positive().optional().nullable(),
  type:            z.enum(['ingreso', 'gasto', 'liquidacion']).optional(),
  business_id:     z.string().uuid().optional(),
  category_id:     z.string().uuid().optional(),
  paid_by:         z.enum(['mau', 'juani']).optional(),
  description:     z.string().max(500).optional().nullable(),
  affects_balance: z.boolean().optional(),
  linked_group_id: z.string().uuid().optional().nullable(),
  split_override:  z.boolean().optional(),
  pct_mau:         z.number().min(0).max(100).optional(),
  pct_juani:       z.number().min(0).max(100).optional(),
})

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('movements')
    .select('*, businesses(id,name,color), categories(id,name), profiles(id,name)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const updates = parsed.data

  const { data: current, error: fetchError } = await supabase
    .from('movements').select('*').eq('id', params.id).single()
  if (fetchError || !current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if ((current as any).linked_group_id) {
    return NextResponse.json(
      { error: 'Este movimiento fue creado con AMBOS. Para modificarlo, eliminá el registro y volvelo a cargar.' },
      { status: 409 }
    )
  }

  // Recalcular porcentajes si cambia negocio/categoría y no hay override manual
  const willBeOverride = updates.split_override ?? current.split_override
  if (!willBeOverride && (updates.business_id || updates.category_id)) {
    const { data: rules } = await supabase.from('split_rules').select('*')
    const resolved = resolveRule(
      updates.business_id ?? current.business_id,
      updates.category_id ?? current.category_id,
      rules ?? []
    )
    updates.pct_mau   = resolved.pct_mau
    updates.pct_juani = resolved.pct_juani
  }

  if (updates.pct_mau !== undefined && updates.pct_juani !== undefined) {
    if (Math.abs(updates.pct_mau + updates.pct_juani - 100) > 0.01)
      return NextResponse.json({ error: 'pct_mau + pct_juani debe sumar 100' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('movements').update(updates).eq('id', params.id)
    .select('*, businesses(id,name,color), categories(id,name), profiles(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    table_name: 'movements', record_id: params.id, action: 'UPDATE',
    old_data: current as any, new_data: data as any, user_id: user.id,
  })

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: current, error: fetchError } = await supabase
    .from('movements')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const linkedGroupId = (current as any).linked_group_id as string | null | undefined

  // Si el movimiento pertenece a un par AMBOS, borrar ambos miembros del grupo.
  // Si es un movimiento normal, borrar solo el movimiento solicitado.
  let deletedRows: any[] | null = null
  let deleteError: any = null

  if (linkedGroupId) {
    const result = await supabase
      .from('movements')
      .delete()
      .eq('linked_group_id', linkedGroupId)
      .select('*')
    deletedRows = result.data
    deleteError = result.error
  } else {
    const result = await supabase
      .from('movements')
      .delete()
      .eq('id', params.id)
      .select('*')
    deletedRows = result.data
    deleteError = result.error
  }

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (deletedRows?.length) {
    await supabase.from('audit_log').insert(
      deletedRows.map(row => ({
        table_name: 'movements',
        record_id: row.id,
        action: 'DELETE',
        old_data: row as any,
        user_id: user.id,
      }))
    )
  }

  return NextResponse.json({ data: null, deleted_count: deletedRows?.length ?? 0 })
}

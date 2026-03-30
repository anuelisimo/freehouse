import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RuleSchema = z.object({
  business_id:  z.string().uuid().nullable(),
  category_id:  z.string().uuid().nullable().optional(),
  pct_mau:      z.number().min(0).max(100),
  pct_juani:    z.number().min(0).max(100),
}).refine(
  d => Math.abs(d.pct_mau + d.pct_juani - 100) < 0.01,
  { message: 'pct_mau + pct_juani debe sumar 100' }
)

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('split_rules')
    .select('*, businesses(id,name,color), categories(id,name)')
    .order('business_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = RuleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('split_rules')
    .insert(parsed.data)
    .select('*, businesses(id,name,color), categories(id,name)')
    .single()

  if (error) {
    // Unique violation: ya existe una regla para este negocio/categoría
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe una regla para este negocio/categoría' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

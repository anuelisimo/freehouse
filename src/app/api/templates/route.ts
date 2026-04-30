import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const TemplateSchema = z.object({
  name:             z.string().min(1).max(100),
  business_id:      z.string().uuid(),
  category_id:      z.string().uuid(),
  type:             z.enum(['ingreso', 'gasto']),
  default_paid_by:  z.enum(['mau', 'juani', 'ambos']),
  description:      z.string().max(300).optional().nullable(),
  is_favorite:      z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('templates')
    .select('*, businesses(id,name,color), categories(id,name)')
    .order('is_favorite', { ascending: false })
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const parsed = TemplateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('templates')
    .insert({ ...parsed.data, created_by: user.id })
    .select('*, businesses(id,name,color), categories(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

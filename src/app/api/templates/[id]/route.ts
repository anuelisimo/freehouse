import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateSchema = z.object({
  name:            z.string().min(1).max(100).optional(),
  business_id:     z.string().uuid().optional(),
  category_id:     z.string().uuid().optional(),
  type:            z.enum(['ingreso', 'gasto']).optional(),
  default_paid_by: z.enum(['mau', 'juani', 'ambos']).optional(),
  description:     z.string().max(300).optional().nullable(),
  is_favorite:     z.boolean().optional(),
})

type Params = { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('templates')
    .update(parsed.data)
    .eq('id', params.id)
    .select('*, businesses(id,name,color), categories(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error } = await supabase.from('templates').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: null })
}

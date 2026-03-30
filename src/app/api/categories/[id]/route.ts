import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Verificar que no tiene movimientos asociados
  const { count } = await supabase
    .from('movements')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', params.id)

  if (count && count > 0) {
    return NextResponse.json({
      error: `No se puede eliminar — tiene ${count} movimiento${count > 1 ? 's' : ''} asociado${count > 1 ? 's' : ''}`
    }, { status: 409 })
  }

  const { error } = await supabase.from('categories').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: null })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsdBlueRate } from '@/lib/exchangeRate'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const currency = searchParams.get('currency') ?? 'USD'
  const date = searchParams.get('date')

  if (currency !== 'USD') {
    return NextResponse.json({ error: 'Por ahora solo se soporta USD' }, { status: 422 })
  }

  try {
    const rate = await getUsdBlueRate(date)

    await supabase.from('exchange_rates').upsert({
      currency: 'USD',
      rate: rate.rate,
      valid_from: rate.date,
      created_by: user.id,
    }, { onConflict: 'currency,valid_from' })

    return NextResponse.json({ data: rate })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Error obteniendo cotización' }, { status: 500 })
  }
}

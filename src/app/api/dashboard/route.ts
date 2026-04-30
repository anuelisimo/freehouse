import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateBalance, calculateBalanceByBusiness, getAvailablePeriods, getPeriodRange } from '@/lib/balance'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period     = searchParams.get('period')
  const businessId = searchParams.get('business_id')
  const currencyView = searchParams.get('currency') === 'USD' ? 'USD' : 'ARS'

  // Rango de fechas para el período
  let dateFilter: { gte?: string; lte?: string } = {}
  if (period && period !== 'all') {
    const { start, end } = getPeriodRange(period)
    dateFilter = { gte: start, lte: end }
  }

  // Cargar en paralelo: movimientos filtrados + todos los negocios + lista de fechas
  const [movsResult, bizResult, periodsResult] = await Promise.all([
    (() => {
      let q = supabase
        .from('movements')
        .select('*, businesses(id,name,color), categories(id,name)')
        .order('date', { ascending: false })
      if (dateFilter.gte) q = q.gte('date', dateFilter.gte)
      if (dateFilter.lte) q = q.lte('date', dateFilter.lte)
      if (businessId)     q = q.eq('business_id', businessId)
      return q
    })(),
    supabase.from('businesses').select('*').eq('active', true).order('name'),
    supabase.from('movements').select('date').order('date', { ascending: false }),
  ])

  if (movsResult.error) return NextResponse.json({ error: movsResult.error.message }, { status: 500 })

  const movements  = movsResult.data  ?? []
  const businesses = bizResult.data   ?? []
  const allDates   = periodsResult.data ?? []

  return NextResponse.json({
    data: {
      globalBalance:    calculateBalance(movements as any, currencyView),
      byBusiness:       calculateBalanceByBusiness(movements as any, businesses, currencyView),
      recentMovements:  movements.slice(0, 10),
      periods:          getAvailablePeriods(allDates),
      currentPeriod:    period ?? 'all',
    },
  })
}

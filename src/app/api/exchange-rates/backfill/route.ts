import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsdBlueRate } from '@/lib/exchangeRate'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { dryRun?: boolean; limit?: number }
  const dryRun = body.dryRun === true
  const limit = Math.min(1000, Math.max(1, Number(body.limit ?? 500)))

  const { data: movements, error } = await supabase
    .from('movements')
    .select('id,date,currency,amount,exchange_rate,usd_exchange_rate')
    .is('usd_exchange_rate', null)
    .order('date', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (movements ?? []) as Array<{ id: string; date: string; currency: string; amount: number; exchange_rate: number; usd_exchange_rate: number | null }>
  const uniqueDates = Array.from(new Set(rows.map(m => m.date)))
  const rateByDate = new Map<string, number>()
  const estimatedDates: string[] = []

  for (const date of uniqueDates) {
    const r = await getUsdBlueRate(date)
    rateByDate.set(date, r.rate)
    if (r.estimated) estimatedDates.push(date)

    if (!dryRun) {
      await supabase.from('exchange_rates').upsert({
        currency: 'USD', rate: r.rate, valid_from: r.date, created_by: user.id,
      }, { onConflict: 'currency,valid_from' })
    }
  }

  const updates = rows.map(m => ({
    id: m.id,
    currency: m.currency,
    date: m.date,
    amount: m.amount,
    usd_exchange_rate: rateByDate.get(m.date) ?? null,
    exchange_rate: m.currency === 'USD' ? (rateByDate.get(m.date) ?? Number(m.exchange_rate)) : 1,
  }))

  if (!dryRun) {
    for (const u of updates) {
      if (!u.usd_exchange_rate) continue
      const { error: updateError } = await supabase
        .from('movements')
        .update({ usd_exchange_rate: u.usd_exchange_rate, exchange_rate: u.exchange_rate })
        .eq('id', u.id)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    data: {
      dryRun,
      matched: movements?.length ?? 0,
      updated: dryRun ? 0 : updates.length,
      unique_dates: uniqueDates.length,
      estimated_dates: estimatedDates,
    }
  })
}

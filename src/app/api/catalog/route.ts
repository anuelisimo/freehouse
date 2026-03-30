import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/catalog — carga todos los datos de referencia en una sola llamada
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [bizRes, catRes, ratesRes] = await Promise.all([
    supabase.from('businesses').select('*').eq('active', true).order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase
      .from('exchange_rates')
      .select('*')
      .order('valid_from', { ascending: false }),
  ])

  if (bizRes.error || catRes.error) {
    return NextResponse.json({ error: 'Error cargando catálogos' }, { status: 500 })
  }

  // Tasa vigente por moneda (la más reciente)
  const currentRates: Record<string, number> = {}
  for (const r of (ratesRes.data ?? [])) {
    if (!currentRates[r.currency]) currentRates[r.currency] = r.rate
  }

  return NextResponse.json({
    data: {
      businesses:    bizRes.data ?? [],
      categories:    catRes.data ?? [],
      exchangeRates: currentRates,
      allRates:      ratesRes.data ?? [],
    },
  })
}

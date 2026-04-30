export type DollarRateSource = 'blue' | 'oficial'

export interface DollarRateResult {
  currency: 'USD'
  rate: number
  date: string
  source: DollarRateSource
  fetched_at: string
  estimated?: boolean
}

const BLUELYTICS_LATEST_URL = 'https://api.bluelytics.com.ar/v2/latest'
const BLUELYTICS_EVOLUTION_URL = 'https://api.bluelytics.com.ar/v2/evolution.json'

function normalizeDate(date?: string | null): string {
  if (!date) return new Date().toISOString().slice(0, 10)
  return date.slice(0, 10)
}

function parseBlueSell(row: any): number | null {
  const value = row?.value_sell ?? row?.blue?.value_sell ?? row?.blue?.sell
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function getCurrentUsdBlueRate(): Promise<DollarRateResult> {
  const res = await fetch(BLUELYTICS_LATEST_URL, { next: { revalidate: 60 * 10 } })
  if (!res.ok) throw new Error('No se pudo obtener la cotización actual')
  const json = await res.json()
  const rate = parseBlueSell(json)
  if (!rate) throw new Error('Respuesta inválida de cotización actual')

  return {
    currency: 'USD',
    rate,
    date: normalizeDate(json?.last_update),
    source: 'blue',
    fetched_at: new Date().toISOString(),
  }
}

export async function getHistoricalUsdBlueRate(date: string): Promise<DollarRateResult> {
  const target = normalizeDate(date)
  const res = await fetch(BLUELYTICS_EVOLUTION_URL, { next: { revalidate: 60 * 60 * 24 } })
  if (!res.ok) throw new Error('No se pudo obtener la cotización histórica')

  const rows = await res.json() as Array<any>
  const candidates = rows
    .filter(r => r?.source === 'Blue' && typeof r?.date === 'string' && r.date <= target)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))

  const selected = candidates[0]
  const rate = parseBlueSell(selected)
  if (!selected || !rate) throw new Error(`No hay cotización histórica para ${target}`)

  return {
    currency: 'USD',
    rate,
    date: selected.date,
    source: 'blue',
    fetched_at: new Date().toISOString(),
    estimated: selected.date !== target,
  }
}

export async function getUsdBlueRate(date?: string | null): Promise<DollarRateResult> {
  const target = normalizeDate(date)
  const today = normalizeDate()
  if (target >= today) return getCurrentUsdBlueRate()
  return getHistoricalUsdBlueRate(target)
}

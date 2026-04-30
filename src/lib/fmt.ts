export function fmtARS(n: number, compact = false): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export function fmtPeriod(period: string): string {
  const [y, m] = period.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${months[+m - 1]} ${y}`
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

export function fmtUSD(n: number, compact = false): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: compact ? 0 : 2, maximumFractionDigits: compact ? 0 : 2,
  }).format(n)
}


export type CurrencyView = 'ARS' | 'USD'

export function fmtMoney(n: number | null | undefined, currency: CurrencyView, compact = false): string {
  const value = Number(n ?? 0)
  return currency === 'USD' ? fmtUSD(value, compact) : fmtARS(value, compact)
}

export function movementDisplayAmount(
  movement: { amount?: number | null; currency?: string | null; amount_ars?: number | null; amount_usd?: number | null },
  currency: CurrencyView
): number {
  if (currency === 'USD') return Number(movement.amount_usd ?? (movement.currency === 'USD' ? movement.amount : 0) ?? 0)
  return Number(movement.amount_ars ?? (movement.currency === 'ARS' ? movement.amount : 0) ?? 0)
}

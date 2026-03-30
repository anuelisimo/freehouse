export function fmtARS(n: number, compact = false): string {
  const abs = Math.abs(n)
  if (compact && abs >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(1)}M`
  if (compact && abs >= 1_000)
    return `$${Math.round(n / 1_000)}K`
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

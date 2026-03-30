import type { Movement, SplitRule, Business, PeriodBalance, BusinessBalance } from '@/types'

// ============================================================
// BALANCE ENGINE — Lógica financiera central
//
// INVARIANTES MATEMÁTICOS:
//   1. mauBalance + juaniBalance === 0  (siempre)
//   2. signed = gasto → +amount_ars | ingreso → -amount_ars
//   3. balance = pagado_real - deberia_pagar
//      > 0 → le deben al socio
//      < 0 → el socio debe
//
// FUENTE DE VERDAD: paid_by (NUNCA created_by)
// ============================================================

export function calculateBalance(movements: Movement[]): PeriodBalance {
  // Solo movimientos que afectan el balance
  const billable = movements.filter(m => m.affects_balance)

  let mauPaid   = 0
  let juaniPaid = 0
  let mauShould   = 0
  let juaniShould = 0
  let totalIncome  = 0
  let totalExpense = 0

  for (const m of billable) {
    const amtARS = Number(m.amount_ars)

    // Signo financiero: gastos son positivos (salida de caja), ingresos negativos (entrada)
    const signed = m.type === 'gasto' ? amtARS : -amtARS

    // Pagado real: basado en paid_by, que es quien realizó el pago/cobro físico
    if (m.paid_by === 'mau') mauPaid   += signed
    else                     juaniPaid += signed

    // Distribución según regla de reparto (snapshot guardado en el movimiento)
    mauShould   += signed * (Number(m.pct_mau)   / 100)
    juaniShould += signed * (Number(m.pct_juani) / 100)

    // Totales brutos (siempre positivos) para el dashboard
    if (m.type === 'ingreso') totalIncome  += amtARS
    else                       totalExpense += amtARS
  }

  const mauBalance   = mauPaid   - mauShould
  const juaniBalance = juaniPaid - juaniShould

  // Verificación del invariante (diferencia por floating point aceptable < 0.01)
  // console.assert(Math.abs(mauBalance + juaniBalance) < 0.01, 'Balance invariant violated')

  // Deuda neta
  const isBalanced = Math.abs(mauBalance) < 0.01
  const debtor:   'mau' | 'juani' | null = isBalanced ? null : mauBalance > 0 ? 'juani' : 'mau'
  const creditor: 'mau' | 'juani' | null = isBalanced ? null : mauBalance > 0 ? 'mau'   : 'juani'

  return {
    mau:   { paid: mauPaid,   should: mauShould,   balance: mauBalance },
    juani: { paid: juaniPaid, should: juaniShould, balance: juaniBalance },
    totalIncome,
    totalExpense,
    netResult: totalIncome - totalExpense,
    movementCount: billable.length,
    debtor,
    creditor,
    debtAmount: Math.abs(mauBalance),
  }
}

export function calculateBalanceByBusiness(
  movements: Movement[],
  businesses: Business[]
): BusinessBalance[] {
  return businesses.map(biz => ({
    business: biz,
    ...calculateBalance(movements.filter(m => m.business_id === biz.id)),
  }))
}

// ============================================================
// RESOLVER REGLA DE REPARTO
//
// Prioridad:
//   1. Regla específica: business_id + category_id
//   2. Regla general:    business_id + category_id IS NULL
//   3. Default: 50/50
// ============================================================
export function resolveRule(
  businessId: string,
  categoryId: string,
  rules: SplitRule[]
): { pct_mau: number; pct_juani: number } {
  // 1. Específica: negocio + categoría exacta
  const specific = rules.find(
    r => r.business_id === businessId && r.category_id === categoryId
  )
  if (specific) return { pct_mau: Number(specific.pct_mau), pct_juani: Number(specific.pct_juani) }

  // 2. General: mismo negocio, sin categoría
  const general = rules.find(
    r => r.business_id === businessId && (r.category_id === null || r.category_id === undefined)
  )
  if (general) return { pct_mau: Number(general.pct_mau), pct_juani: Number(general.pct_juani) }

  // 3. Default
  return { pct_mau: 50, pct_juani: 50 }
}

// ============================================================
// UTILIDADES DE PERÍODOS
// ============================================================
export function getAvailablePeriods(movements: Array<{ date: string }>): string[] {
  const periods = new Set(movements.map(m => m.date.slice(0, 7)))
  return Array.from(periods).sort().reverse()
}

export function getPeriodRange(period: string): { start: string; end: string } {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0) // último día del mes
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  }
}

export function getCurrentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

export function groupByPeriod(movements: Movement[]): Record<string, Movement[]> {
  return movements.reduce<Record<string, Movement[]>>((acc, m) => {
    const period = m.date.slice(0, 7)
    if (!acc[period]) acc[period] = []
    acc[period].push(m)
    return acc
  }, {})
}

// ============================================================
// FORMATEO
// ============================================================
export function formatARS(n: number, compact = false): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (compact && abs >= 1_000_000) return `${sign}$ ${(abs / 1_000_000).toFixed(1)}M`
  if (compact && abs >= 1_000)     return `${sign}$ ${(abs / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

export function formatCurrency(amount: number, currency: string): string {
  return currency === 'USD' ? formatUSD(amount) : formatARS(amount)
}

export function formatPeriod(period: string): string {
  const [year, month] = period.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${months[parseInt(month) - 1]} ${year}`
}

export function partnerLabel(p: 'mau' | 'juani'): string {
  return p === 'mau' ? 'Mau' : 'Juani'
}

export function balanceSummary(b: PeriodBalance): string {
  if (!b.debtor) return 'Están al día ✓'
  return `${partnerLabel(b.debtor)} le debe ${formatARS(b.debtAmount)} a ${partnerLabel(b.creditor!)}`
}

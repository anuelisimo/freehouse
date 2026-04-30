'use client'

import { useEffect, useState } from 'react'
import { fmtMoney, movementDisplayAmount, fmtPeriod } from '@/lib/fmt'
import { useCurrencyView } from '@/context/CurrencyViewContext'

interface PeriodData {
  period: string
  income: number
  expense: number
  balance: number
  mauBalance: number
  juaniBalance: number
}

interface BizData {
  name: string
  color: string
  income: number
  expense: number
}

interface CatData {
  name: string
  total: number
}

export default function GraficosPage() {
  const [periods, setPeriods]   = useState<PeriodData[]>([])
  const [bizData, setBizData]   = useState<BizData[]>([])
  const [catData, setCatData]   = useState<CatData[]>([])
  const [loading, setLoading]   = useState(true)
  const { currencyView } = useCurrencyView()

  useEffect(() => {
    async function load() {
      // Cargar todos los movimientos
      const res  = await fetch('/api/movements?limit=200')
      const json = await res.json()
      const movs = json.data ?? []

      // Cargar catálogo
      const catRes  = await fetch('/api/catalog')
      const catJson = await catRes.json()
      const businesses = catJson.data?.businesses ?? []

      // Agrupar por período
      const byPeriod: Record<string, { income: number; expense: number; mauPaid: number; juaniPaid: number; mauShould: number; juaniShould: number }> = {}
      for (const m of movs) {
        const p = m.date.slice(0, 7)
        if (!byPeriod[p]) byPeriod[p] = { income: 0, expense: 0, mauPaid: 0, juaniPaid: 0, mauShould: 0, juaniShould: 0 }
        const amt = movementDisplayAmount(m, currencyView)
        if (m.type === 'ingreso') byPeriod[p].income += amt
        else                      byPeriod[p].expense += amt

        if (m.affects_balance) {
          const signed = m.type === 'gasto' ? amt : -amt
          if (m.paid_by === 'mau') byPeriod[p].mauPaid += signed
          else                     byPeriod[p].juaniPaid += signed
          byPeriod[p].mauShould   += signed * (m.pct_mau   / 100)
          byPeriod[p].juaniShould += signed * (m.pct_juani / 100)
        }
      }

      const periodList = Object.entries(byPeriod)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, d]) => ({
          period,
          income:      d.income,
          expense:     d.expense,
          balance:     d.income - d.expense,
          mauBalance:  d.mauPaid   - d.mauShould,
          juaniBalance:d.juaniPaid - d.juaniShould,
        }))

      // Por negocio
      const byBiz: Record<string, { income: number; expense: number; color: string }> = {}
      for (const m of movs) {
        const biz = m.businesses
        if (!biz) continue
        if (!byBiz[biz.name]) byBiz[biz.name] = { income: 0, expense: 0, color: biz.color }
        const amt = movementDisplayAmount(m, currencyView)
        if (m.type === 'ingreso') byBiz[biz.name].income  += amt
        else                      byBiz[biz.name].expense += amt
      }
      const bizList = Object.entries(byBiz).map(([name, d]) => ({ name, ...d }))

      // Por categoría (solo gastos)
      const byCat: Record<string, number> = {}
      for (const m of movs.filter((m: any) => m.type === 'gasto')) {
        const cat = m.categories?.name ?? 'otros'
        byCat[cat] = (byCat[cat] ?? 0) + movementDisplayAmount(m, currencyView)
      }
      const catList = Object.entries(byCat)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 6)
        .map(([name, total]) => ({ name, total }))

      setPeriods(periodList)
      setBizData(bizList)
      setCatData(catList)
      setLoading(false)
    }
    load()
  }, [currencyView])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="lbl animate-blink" style={{ color: 'var(--accent)' }}>CARGANDO DATOS…</div>
    </div>
  )

  if (periods.length === 0) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="lbl mb-2">SIN DATOS</div>
        <div className="text-xs font-mono" style={{ color: 'var(--text3)' }}>
          Cargá movimientos para ver los gráficos
        </div>
      </div>
    </div>
  )

  const maxExpense = Math.max(...periods.map(p => p.expense), 1)
  const maxIncome  = Math.max(...periods.map(p => p.income), 1)
  const maxBiz     = Math.max(...bizData.map(b => Math.max(b.income, b.expense)), 1)
  const maxBal     = Math.max(...periods.map(p => Math.abs(p.mauBalance)), 1)
  const totalCat   = catData.reduce((s, c) => s + c.total, 0)

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-5">

        <div>
          <div className="text-sm font-mono font-semibold uppercase tracking-wide">Gráficos</div>
          <div className="lbl mt-0.5">{periods.length} períodos · {periods.reduce((s,p) => s + p.income + p.expense, 0) > 0 ? fmtMoney(periods.reduce((s,p) => s + p.expense, 0), currencyView, true) + ' total gastos' : ''}</div>
        </div>

        {/* ── 1. EVOLUCIÓN MENSUAL ────────────────────────── */}
        <div className="card p-4 ticker-strip">
          <div className="lbl mb-3" style={{ color: 'var(--text2)' }}>EVOLUCIÓN MENSUAL</div>
          <div className="flex items-end gap-1.5 h-32">
            {periods.map(p => (
              <div key={p.period} className="flex-1 flex flex-col items-center gap-0.5">
                {/* Income bar */}
                <div className="w-full flex flex-col justify-end" style={{ height: 52 }}>
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(2, (p.income / maxIncome) * 52)}px`,
                      background: 'rgba(0,255,136,0.4)',
                      boxShadow: p.income > 0 ? '0 0 6px rgba(0,255,136,0.3)' : 'none',
                    }}
                  />
                </div>
                {/* Expense bar */}
                <div className="w-full flex flex-col justify-end" style={{ height: 52 }}>
                  <div
                    className="w-full rounded-b-sm transition-all"
                    style={{
                      height: `${Math.max(2, (p.expense / maxExpense) * 52)}px`,
                      background: 'rgba(255,51,85,0.4)',
                      boxShadow: p.expense > 0 ? '0 0 6px rgba(255,51,85,0.3)' : 'none',
                    }}
                  />
                </div>
                <div className="lbl mt-1" style={{ fontSize: '0.55rem', color: 'var(--text3)' }}>
                  {fmtPeriod(p.period).slice(0, 3).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(0,255,136,0.4)' }} />
              <span className="lbl">INGRESOS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(255,51,85,0.4)' }} />
              <span className="lbl">GASTOS</span>
            </div>
          </div>
        </div>

        {/* ── 2. BALANCE ENTRE SOCIOS POR MES ─────────────── */}
        <div className="card p-4 ticker-strip">
          <div className="lbl mb-3" style={{ color: 'var(--text2)' }}>BALANCE NETO POR MES</div>
          <div className="space-y-2">
            {periods.map(p => {
              const isPos  = p.mauBalance >= 0
              const pct    = Math.abs(p.mauBalance) / maxBal * 100
              return (
                <div key={p.period}>
                  <div className="flex justify-between mb-1">
                    <span className="lbl">{fmtPeriod(p.period)}</span>
                    <span className={`num text-xs font-semibold ${isPos ? 'num-pos' : 'num-neg'}`}>
                      {isPos ? 'J→M ' : 'M→J '}{fmtMoney(Math.abs(p.mauBalance), currencyView, true)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: isPos ? 'var(--accent)' : 'var(--danger)',
                        boxShadow: isPos ? '0 0 6px rgba(0,255,136,0.4)' : '0 0 6px rgba(255,51,85,0.4)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 3. GASTOS POR NEGOCIO ────────────────────────── */}
        {bizData.length > 0 && (
          <div className="card p-4 ticker-strip">
            <div className="lbl mb-3" style={{ color: 'var(--text2)' }}>POR NEGOCIO (ACUMULADO)</div>
            <div className="space-y-3">
              {bizData.map(b => (
                <div key={b.name}>
                  <div className="flex justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
                      <span className="text-xs font-mono font-medium" style={{ color: 'var(--text)' }}>{b.name}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="num text-xs num-pos">{fmtMoney(b.income, currencyView, true)}</span>
                      <span className="num text-xs num-neg">{fmtMoney(b.expense, currencyView, true)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full flex overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div style={{ width: `${(b.income / maxBiz) * 100}%`, background: b.color, opacity: 0.5 }} />
                    <div style={{ width: `${(b.expense / maxBiz) * 100}%`, background: 'var(--danger)', opacity: 0.5 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. DISTRIBUCIÓN DE GASTOS POR CATEGORÍA ──────── */}
        {catData.length > 0 && (
          <div className="card p-4 ticker-strip">
            <div className="lbl mb-3" style={{ color: 'var(--text2)' }}>GASTOS POR CATEGORÍA</div>
            <div className="space-y-2.5">
              {catData.map((c, i) => {
                const pct = (c.total / totalCat) * 100
                const colors = ['var(--accent)','var(--cyan)','var(--warn)','var(--danger)','#a78bfa','#fb923c']
                return (
                  <div key={c.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-mono capitalize" style={{ color: 'var(--text)' }}>{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="lbl">{pct.toFixed(0)}%</span>
                        <span className="num text-xs" style={{ color: colors[i] }}>{fmtMoney(c.total, currencyView, true)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: colors[i], opacity: 0.7 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 pt-2 flex justify-between" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="lbl">TOTAL GASTOS</span>
              <span className="num text-xs num-neg">{fmtMoney(totalCat, currencyView, true)}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

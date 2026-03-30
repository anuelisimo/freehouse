'use client'

import { useEffect, useState, useCallback } from 'react'
import type { PeriodBalance, BusinessBalance, Movement } from '@/types'
import { fmtARS, fmtDate, fmtPeriod, currentPeriod } from '@/lib/fmt'
import MovementDrawer from '@/components/forms/MovementDrawer'

interface DashData {
  globalBalance:   PeriodBalance
  byBusiness:      BusinessBalance[]
  recentMovements: Movement[]
  periods:         string[]
}

function Skel({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return (
    <div className={`${w} ${h} rounded-sm animate-pulse`}
      style={{ background: 'linear-gradient(90deg, var(--s2), var(--s3), var(--s2))', backgroundSize: '200% 100%' }} />
  )
}

export default function DashboardPage() {
  const [data, setData]     = useState<DashData | null>(null)
  const [period, setPeriod] = useState('all')
  const [loading, setLoad]  = useState(true)
  const [drawer, setDrawer] = useState(false)

  const load = useCallback(async (p: string) => {
    setLoad(true)
    const q = p !== 'all' ? `?period=${p}` : ''
    const r = await fetch(`/api/dashboard${q}`)
    const j = await r.json()
    setData(j.data)
    setLoad(false)
  }, [])

  useEffect(() => { load(period) }, [period, load])

  const bal      = data?.globalBalance
  const debtor   = bal?.debtor
  const creditor = bal?.creditor
  const debt     = bal?.debtAmount ?? 0
  const isGreen  = !debtor || debtor === 'juani' // juani le debe a mau = mau gana

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto pb-6">

        {/* ── PERIOD TABS ───────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {['all', ...(data?.periods ?? [currentPeriod()])].map(p => {
            const active = period === p
            return (
              <button key={p} onClick={() => setPeriod(p)}
                className="flex-shrink-0 px-3 py-1 rounded-sm text-xs font-mono transition-all uppercase tracking-wider"
                style={{
                  background:  active ? 'rgba(0,255,136,0.1)' : 'var(--s2)',
                  color:       active ? 'var(--accent)'        : 'var(--text3)',
                  border:      `1px solid ${active ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
                  boxShadow:   active ? '0 0 12px rgba(0,255,136,0.12)' : 'none',
                }}>
                {p === 'all' ? 'HIST' : fmtPeriod(p)}
              </button>
            )
          })}
        </div>

        {/* ── BALANCE HERO ──────────────────────────────── */}
        <div className={`card ticker-strip relative overflow-hidden ${!loading && isGreen ? 'card-glow-g' : !loading && !isGreen && debtor ? 'card-glow-r' : ''}`}
          style={{ paddingTop: 2 }}>

          {/* Grid texture inside card */}
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none rounded-lg" />

          <div className="relative p-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full"
                  style={{ background: loading ? 'var(--text3)' : isGreen ? 'var(--accent)' : 'var(--danger)',
                    boxShadow: loading ? 'none' : isGreen ? '0 0 6px var(--accent)' : '0 0 6px var(--danger)' }} />
                <span className="lbl">BALANCE NETO</span>
              </div>
              <span className="lbl" style={{ color: 'var(--text3)' }}>
                {period === 'all' ? 'ACUMULADO' : fmtPeriod(period).toUpperCase()}
              </span>
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skel w="w-48" h="h-10" />
                <Skel w="w-32" h="h-3" />
              </div>
            ) : (
              <>
                <div className={`num-xl mb-1 ${!debtor ? 'num-pos' : isGreen ? 'num-pos' : 'num-neg'}`}>
                  {!debtor ? '$ 0.00' : fmtARS(debt)}
                </div>
                <div className="text-xs font-mono" style={{ color: 'var(--text2)' }}>
                  {!debtor ? (
                    <span style={{ color: 'var(--accent)' }}>✓ SOCIOS AL DÍA</span>
                  ) : (
                    <>
                      <span style={{ color: debtor === 'mau' ? 'var(--mau)' : 'var(--juani)',
                        textShadow: debtor === 'mau' ? '0 0 10px var(--mau)' : '0 0 10px var(--juani)' }}>
                        {debtor === 'mau' ? 'MAU' : 'JUANI'}
                      </span>
                      <span style={{ color: 'var(--text3)' }}> → DEBE A → </span>
                      <span style={{ color: creditor === 'mau' ? 'var(--mau)' : 'var(--juani)',
                        textShadow: creditor === 'mau' ? '0 0 10px var(--mau)' : '0 0 10px var(--juani)' }}>
                        {creditor === 'mau' ? 'MAU' : 'JUANI'}
                      </span>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Partner positions */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              {(['mau', 'juani'] as const).map(p => {
                const pb  = bal?.[p]
                const rgb = p === 'mau' ? '0,255,136' : '0,229,255'
                const col = p === 'mau' ? 'var(--mau)' : 'var(--juani)'
                return (
                  <div key={p} className="p-2 rounded-sm" style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold"
                        style={{ background: `rgba(${rgb},0.12)`, color: col, fontFamily: 'monospace' }}>
                        {p === 'mau' ? 'MA' : 'JU'}
                      </div>
                      <span className="lbl" style={{ color: col }}>{p === 'mau' ? 'MAU' : 'JUANI'}</span>
                    </div>
                    {loading ? <Skel h="h-12" /> : (
                      <div className="space-y-1">
                        {[
                          ['PAGÓ',    pb?.paid   ?? 0],
                          ['CORR',    pb?.should ?? 0],
                          ['SALDO',   pb?.balance ?? 0],
                        ].map(([lbl, val]) => (
                          <div key={lbl as string} className="flex justify-between items-baseline">
                            <span className="lbl">{lbl as string}</span>
                            <span className={`num text-xs font-medium ${
                              lbl === 'SALDO'
                                ? (val as number) >= 0 ? 'num-pos' : 'num-neg'
                                : 'num-neu'
                            }`}>
                              {lbl === 'SALDO' && (val as number) > 0 ? '+' : ''}
                              {fmtARS(val as number, true)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── MARKET SUMMARY (stats) ─────────────────────── */}
        <div className="grid grid-cols-3 gap-2 animate-fade-up stagger-1">
          {[
            { lbl: 'VOL. INGR', val: bal?.totalIncome  ?? 0, col: 'var(--accent)', up: true },
            { lbl: 'VOL. EGRE', val: bal?.totalExpense ?? 0, col: 'var(--danger)', up: false },
            { lbl: 'RESULTADO', val: (bal?.totalIncome ?? 0) - (bal?.totalExpense ?? 0),
              col: ((bal?.totalIncome ?? 0) - (bal?.totalExpense ?? 0)) >= 0 ? 'var(--accent)' : 'var(--danger)',
              up: ((bal?.totalIncome ?? 0) - (bal?.totalExpense ?? 0)) >= 0 },
          ].map(s => (
            <div key={s.lbl} className="card p-3">
              <div className="lbl mb-1.5">{s.lbl}</div>
              {loading ? <Skel h="h-5" /> : (
                <div className="num text-sm font-semibold" style={{ color: s.col }}>
                  {s.up ? '▲ ' : '▼ '}{fmtARS(Math.abs(s.val), true)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── MARKETS (by business) ──────────────────────── */}
        <div className="animate-fade-up stagger-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="lbl">MERCADOS</div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, var(--border), transparent)' }} />
          </div>

          {/* Header row */}
          <div className="grid grid-cols-4 gap-2 px-3 mb-1">
            {['NEGOCIO','INGRESOS','GASTOS','BALANCE'].map(h => (
              <div key={h} className="lbl text-right first:text-left" style={{ fontSize: '0.58rem' }}>{h}</div>
            ))}
          </div>

          <div className="space-y-1">
            {loading
              ? [1,2,3].map(i => <Skel key={i} h="h-12" />)
              : data?.byBusiness.map(bb => <BizRow key={bb.business.id} bb={bb} />)
            }
          </div>
        </div>

        {/* ── ORDER BOOK (recent movements) ─────────────── */}
        <div className="animate-fade-up stagger-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="lbl">ÚLTIMAS OPERACIONES</div>
              <div className="w-1 h-1 rounded-full animate-blink" style={{ background: 'var(--accent)' }} />
            </div>
            <a href="/movimientos" className="lbl hover:opacity-70 transition-opacity"
              style={{ color: 'var(--accent)' }}>VER TODAS →</a>
          </div>

          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="grid px-3 py-2" style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--s2)' }}>
              {['FECHA','CONCEPTO','PAGÓ','MONTO'].map(h => (
                <div key={h} className="lbl text-right first:text-left" style={{ fontSize: '0.58rem' }}>{h}</div>
              ))}
            </div>

            {loading
              ? [1,2,3,4,5].map(i => (
                  <div key={i} className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <Skel h="h-4" />
                  </div>
                ))
              : !data?.recentMovements.length
                ? <div className="p-8 text-center lbl" style={{ color: 'var(--text3)' }}>SIN OPERACIONES</div>
                : data.recentMovements.map(m => <TradeRow key={m.id} m={m} />)
            }
          </div>
        </div>

      </div>

      {/* ── FAB ───────────────────────────────────────────── */}
      <button
        onClick={() => setDrawer(true)}
        className="fixed bottom-20 right-4 w-12 h-12 rounded-sm flex items-center justify-center z-40 animate-glow"
        style={{ background: 'var(--accent)', color: '#07090d',
          boxShadow: 'var(--glow-g)', border: '1px solid rgba(0,255,136,0.5)' }}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>

      <MovementDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        onSaved={() => { setDrawer(false); load(period) }}
      />
    </div>
  )
}

function BizRow({ bb }: { bb: BusinessBalance }) {
  const balance = bb.mau.balance
  const isZero  = Math.abs(balance) < 1
  return (
    <div className="card grid items-center px-3 py-2.5 transition-all hover:border-[var(--border2)]"
      style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8,
        borderLeft: `2px solid ${bb.business.color}` }}>
      <div className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text)' }}>
        {bb.business.name.replace('FREE', '')}
      </div>
      <div className="num text-xs text-right num-pos">{fmtARS(bb.totalIncome, true)}</div>
      <div className="num text-xs text-right num-neg">{fmtARS(bb.totalExpense, true)}</div>
      <div className={`num text-xs text-right font-semibold ${isZero ? 'num-neu' : balance > 0 ? 'num-pos' : 'num-neg'}`}>
        {isZero ? '—' : `${balance > 0 ? '+' : ''}${fmtARS(balance, true)}`}
      </div>
    </div>
  )
}

function TradeRow({ m }: { m: Movement }) {
  const isIncome = m.type === 'ingreso'
  return (
    <div className="grid px-3 py-2.5 transition-all hover:bg-[var(--s2)]"
      style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 8, borderBottom: '1px solid var(--border)' }}>
      <div className="lbl" style={{ color: 'var(--text3)' }}>{fmtDate(m.date)}</div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isIncome ? 'bg-[var(--accent)]' : 'bg-[var(--danger)]'}`}
          style={{ boxShadow: isIncome ? '0 0 4px var(--accent)' : '0 0 4px var(--danger)' }} />
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text)' }}>
          {m.description || (m.categories as any)?.name || '—'}
        </span>
      </div>
      <div className="lbl text-right" style={{ color: m.paid_by === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
        {m.paid_by === 'mau' ? 'MAU' : 'JUA'}
      </div>
      <div className={`num text-xs text-right font-medium ${isIncome ? 'num-pos' : 'num-neg'}`}>
        {isIncome ? '+' : '-'}{fmtARS(m.amount_ars, true)}
      </div>
    </div>
  )
}

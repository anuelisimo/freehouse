'use client'

import { useEffect, useState, useRef } from 'react'
import type { Template } from '@/types'
import { useCatalog } from '@/hooks/useCatalog'
import { resolveRule } from '@/lib/balance'
import { todayISO, fmtARS } from '@/lib/fmt'

interface Props { open: boolean; onClose: () => void; onSaved: () => void; editId?: string | null; prefillTemplateId?: string | null }
type MovType = 'gasto' | 'ingreso' | 'liquidacion'
type Partner = 'mau' | 'juani'

interface F {
  type: MovType; amount: string; currency: 'ARS' | 'USD'
  date: string; business_id: string; category_id: string
  paid_by: Partner; description: string
  affects_balance: boolean; split_override: boolean
  pct_mau: number; pct_juani: number
}

const EMPTY: F = {
  type: 'gasto', amount: '', currency: 'ARS', date: todayISO(),
  business_id: '', category_id: '', paid_by: 'mau',
  description: '', affects_balance: true, split_override: false,
  pct_mau: 50, pct_juani: 50,
}

export default function MovementDrawer({ open, onClose, onSaved, editId, prefillTemplateId }: Props) {
  const { businesses, categories, rules, exchangeRates, loading: catLoading } = useCatalog()
  const [form, setF]        = useState<F>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [advanced, setAdv]  = useState(true)
  const [templates, setTmpl] = useState<Template[]>([])
  const [query, setQuery]    = useState('')
  const [showSugg, setShowSugg] = useState(false)
  const amtRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(j => setTmpl(j.data ?? []))
  }, [])

  useEffect(() => {
    if (!open) return

    if (editId) {
      // Modo edición: cargar datos del movimiento existente
      setAdv(true); setQuery(''); setError(''); setShowSugg(false)
      fetch(`/api/movements/${editId}`)
        .then(r => r.json())
        .then(j => {
          const m = j.data
          if (!m) return
          setF({
            type:            m.type,
            amount:          String(m.amount),
            currency:        m.currency ?? 'ARS',
            date:            m.date,
            business_id:     m.business_id,
            category_id:     m.category_id,
            paid_by:         m.paid_by,
            description:     m.description ?? '',
            affects_balance: m.affects_balance,
            split_override:  m.split_override,
            pct_mau:         Number(m.pct_mau),
            pct_juani:       Number(m.pct_juani),
          })
          // Mostrar nombre en el campo concepto
          const tmplName = templates.find(t => t.id === m.template_id)?.name
          setQuery(tmplName ?? m.description ?? '')
        })
    } else {
      // Modo nuevo
      setF({ ...EMPTY, date: todayISO() })
      setAdv(true); setQuery(''); setError(''); setShowSugg(false)
      setTimeout(() => amtRef.current?.focus(), 150)
    }
  }, [open, editId])

  // Auto-apply template when launched from Plantillas page
  useEffect(() => {
    if (open && prefillTemplateId && templates.length) {
      const t = templates.find(x => x.id === prefillTemplateId)
      if (t) {
        setF(f => ({ ...f, type: t.type, business_id: t.business_id,
          category_id: t.category_id, paid_by: t.default_paid_by,
          description: t.description ?? t.name }))
        setQuery(t.name)
        setTimeout(() => amtRef.current?.focus(), 150)
      }
    }
  }, [open, prefillTemplateId, templates])

  useEffect(() => {
    if (businesses.length && !form.business_id)
      setF(f => ({ ...f, business_id: businesses[0].id, category_id: categories[0]?.id ?? '' }))
  }, [businesses, categories])

  useEffect(() => {
    if (!form.split_override && form.business_id && form.category_id && rules.length) {
      const r = resolveRule(form.business_id, form.category_id, rules)
      setF(f => ({ ...f, pct_mau: r.pct_mau, pct_juani: r.pct_juani }))
    }
  }, [form.business_id, form.category_id, form.split_override, rules])

  const suggestions = query.trim()
    ? templates.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : templates.filter(t => t.is_favorite)

  function applyTmpl(t: Template) {
    setF(f => ({ ...f, type: t.type, business_id: t.business_id,
      category_id: t.category_id, paid_by: t.default_paid_by,
      description: t.description ?? t.name }))
    setQuery(t.name); setShowSugg(false)
    setTimeout(() => amtRef.current?.focus(), 50)
  }

  function set<K extends keyof F>(k: K, v: F[K]) {
    setF(f => {
      const next = { ...f, [k]: v }
      // Si es liquidación y cambia paid_by, actualizar split automáticamente
      if (k === 'paid_by' && f.type === 'liquidacion') {
        next.pct_mau   = v === 'mau' ? 0 : 100
        next.pct_juani = v === 'mau' ? 100 : 0
      }
      return next
    })
    setError('')
  }

  const amount   = parseFloat(form.amount) || 0
  const rate     = form.currency === 'USD' ? (exchangeRates['USD'] ?? 1) : 1
  const amtARS   = amount * rate
  const mauAmt   = amtARS * form.pct_mau   / 100
  const juaniAmt = amtARS * form.pct_juani / 100
  const bizName  = businesses.find(b => b.id === form.business_id)?.name ?? '—'
  const catName  = categories.find(c => c.id === form.category_id)?.name ?? '—'

  async function save() {
    if (!amount || amount <= 0) { setError('Ingresá un monto'); return }
    if (!form.business_id || !form.category_id) { setError('Completá negocio y categoría'); return }
    setSaving(true)
    try {
      const res = await fetch(editId ? `/api/movements/${editId}` : '/api/movements', {
        method:  editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, amount, exchange_rate: rate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Error')
      onSaved()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 animate-fade-in"
        style={{ background: 'rgba(7,9,13,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={onClose} />

      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border2)',
          borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
          borderRadius: '10px 10px 0 0', maxHeight: '93dvh',
          boxShadow: '0 -20px 80px rgba(0,255,136,0.06)' }}>

        {/* Top accent line */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />

        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-0.5 rounded-full" style={{ background: 'var(--border2)' }} />
        </div>

        <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(93dvh - 20px)' }}>
          <div className="px-4 pb-safe">

            {/* Header */}
            <div className="flex items-center justify-between mb-4 pt-1">
              <div>
                <div className="text-sm font-mono font-semibold uppercase tracking-wide">
                  {editId ? 'EDITAR OPERACIÓN' : 'NUEVA OPERACIÓN'}
                </div>
                <div className="lbl mt-0.5">ORDER ENTRY</div>
              </div>
              <button onClick={onClose} className="btn-icon w-7 h-7 text-sm rounded-sm">✕</button>
            </div>

            {/* ── Type toggle: GASTO / INGRESO / LIQUIDACIÓN ─── */}
            <div className="grid grid-cols-3 gap-1.5 mb-4 p-1 rounded-sm"
              style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
              {([
                { t: 'gasto',      label: '▲ GASTO',  bg: 'rgba(255,51,85,0.12)',   color: 'var(--danger)', border: 'rgba(255,51,85,0.3)',   glow: 'var(--glow-r)' },
                { t: 'ingreso',    label: '▼ INGRESO', bg: 'rgba(0,255,136,0.1)',    color: 'var(--accent)', border: 'rgba(0,255,136,0.25)',  glow: 'var(--glow-g)' },
                { t: 'liquidacion',label: '⇄ LIQUID.', bg: 'rgba(0,229,255,0.1)',    color: 'var(--cyan)',   border: 'rgba(0,229,255,0.25)',  glow: 'var(--glow-c)' },
              ] as { t: MovType; label: string; bg: string; color: string; border: string; glow: string }[]).map(({ t, label, bg, color, border, glow }) => {
                const active = form.type === t
                return (
                  <button key={t} onClick={() => {
                    set('type', t)
                    // Liquidación: split automático 0/100 según quién paga
                    if (t === 'liquidacion') {
                      setF(f => ({ ...f, type: t, split_override: true,
                        pct_mau: f.paid_by === 'mau' ? 0 : 100,
                        pct_juani: f.paid_by === 'mau' ? 100 : 0,
                        affects_balance: true }))
                    }
                  }}
                    className="py-2.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: active ? bg : 'transparent',
                      color:      active ? color : 'var(--text3)',
                      border:     active ? `1px solid ${border}` : '1px solid transparent',
                      boxShadow:  active ? glow : 'none',
                    }}>
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Info liquidación */}
            {form.type === 'liquidacion' && (
              <div className="mb-4 p-3 rounded-sm" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
                <div className="text-xs font-mono" style={{ color: 'var(--cyan)' }}>
                  ⇄ LIQUIDACIÓN DE DEUDA
                </div>
                <div className="lbl mt-1" style={{ color: 'var(--text2)' }}>
                  Registra un pago entre socios para saldar deuda. No afecta ingresos ni gastos del negocio.
                </div>
                <div className="lbl mt-1.5" style={{ color: 'var(--text3)' }}>
                  {form.paid_by === 'mau'
                    ? '→ MAU le paga a JUANI'
                    : '→ JUANI le paga a MAU'}
                </div>
              </div>
            )}

            {/* ── Template / concept search ─── */}
            <div className="mb-4 relative">
              <div className="lbl mb-1.5">CONCEPTO / PLANTILLA</div>
              <input className="ctrl" placeholder="Buscar plantilla o ingresar concepto…"
                value={query} autoComplete="off"
                onChange={e => { setQuery(e.target.value); setShowSugg(true) }}
                onFocus={() => setShowSugg(true)} />

              {showSugg && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-10 overflow-hidden rounded-sm shadow-2xl"
                  style={{ background: 'var(--s3)', border: '1px solid var(--border2)',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
                  {/* Top line */}
                  <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
                  {suggestions.slice(0, 6).map(t => (
                    <button key={t.id} onMouseDown={() => applyTmpl(t)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[var(--s2)]"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="w-6 h-6 rounded-sm flex items-center justify-center text-xs flex-shrink-0"
                        style={{
                          background: t.type === 'ingreso' ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,85,0.1)',
                          color: t.type === 'ingreso' ? 'var(--accent)' : 'var(--danger)',
                        }}>
                        {t.is_favorite ? '★' : t.type === 'ingreso' ? '▼' : '▲'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text)' }}>
                          {t.name}
                        </div>
                        <div className="lbl" style={{ color: 'var(--text3)' }}>
                          {(t.businesses as any)?.name} · {(t.categories as any)?.name}
                        </div>
                      </div>
                      <div className="lbl" style={{ color: t.default_paid_by === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
                        {t.default_paid_by === 'mau' ? 'MAU' : 'JUA'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Amount input — the biggest field ─── */}
            <div className="mb-4">
              <div className="lbl mb-1.5">MONTO</div>
              <div className="flex gap-2">
                <select className="ctrl w-20 flex-shrink-0" value={form.currency}
                  onChange={e => set('currency', e.target.value as any)}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
                <input ref={amtRef} type="number" className="ctrl-amount flex-1"
                  placeholder="0" value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  inputMode="decimal" min="0" step="any" />
              </div>
              {form.currency === 'USD' && amount > 0 && (
                <div className="lbl mt-1.5">
                  ≈ {fmtARS(amtARS)} · TC {fmtARS(exchangeRates['USD'] ?? 0)}
                </div>
              )}
            </div>

            {/* ── Counterparty (paid by) ─── */}
            <div className="mb-4">
              <div className="lbl mb-1.5">REALIZADO POR</div>
              <div className="grid grid-cols-2 gap-2">
                {(['mau', 'juani'] as Partner[]).map(p => {
                  const active = form.paid_by === p
                  const col  = p === 'mau' ? 'var(--mau)' : 'var(--juani)'
                  const rgb  = p === 'mau' ? '0,255,136' : '0,229,255'
                  return (
                    <button key={p} onClick={() => set('paid_by', p)}
                      className="flex items-center gap-2.5 p-3 rounded-sm border transition-all"
                      style={{
                        background:  active ? `rgba(${rgb},0.07)` : 'var(--s2)',
                        borderColor: active ? col : 'var(--border)',
                        boxShadow:   active ? `0 0 12px rgba(${rgb},0.12)` : 'none',
                      }}>
                      <div className="w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-bold"
                        style={{ background: `rgba(${rgb},0.12)`, color: col, fontFamily: 'monospace' }}>
                        {p === 'mau' ? 'MA' : 'JU'}
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-mono font-medium" style={{ color: active ? col : 'var(--text)' }}>
                          {p === 'mau' ? 'MAU' : 'JUANI'}
                        </div>
                        <div className="lbl" style={{ color: 'var(--text3)' }}>PARTNER</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Order summary / expand ─── */}
            <div className="mb-4 p-3 rounded-sm flex items-center justify-between"
              style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="lbl mb-1">{bizName} · {catName}</div>
                <div className="flex items-center gap-3">
                  <span className="num text-xs" style={{ color: 'var(--mau)' }}>
                    M {form.pct_mau}% = {fmtARS(mauAmt, true)}
                  </span>
                  <span className="lbl">|</span>
                  <span className="num text-xs" style={{ color: 'var(--juani)' }}>
                    J {form.pct_juani}% = {fmtARS(juaniAmt, true)}
                  </span>
                </div>
              </div>
              <button onClick={() => setAdv(a => !a)}
                className="lbl px-2.5 py-1.5 rounded-sm transition-all hover:opacity-80"
                style={{ border: '1px solid var(--border2)', color: advanced ? 'var(--accent)' : 'var(--text3)' }}>
                {advanced ? 'CERRAR' : 'DETALLES ›'}
              </button>
            </div>

            {/* ── Advanced fields ─── */}
            {advanced && (
              <div className="space-y-3 mb-4 animate-fade-up">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="lbl mb-1">NEGOCIO</div>
                    <select className="ctrl" value={form.business_id}
                      onChange={e => set('business_id', e.target.value)}>
                      {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="lbl mb-1">CATEGORÍA</div>
                    <select className="ctrl" value={form.category_id}
                      onChange={e => set('category_id', e.target.value)}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="lbl mb-1">FECHA</div>
                  <input type="date" className="ctrl" value={form.date}
                    onChange={e => set('date', e.target.value)} />
                </div>

                <div>
                  <div className="lbl mb-1">DESCRIPCIÓN</div>
                  <input type="text" className="ctrl" placeholder="Opcional…"
                    value={form.description} onChange={e => set('description', e.target.value)} />
                </div>

                {/* Split */}
                <div className="p-3 rounded-sm" style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="lbl">REPARTO</div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.split_override}
                        onChange={e => set('split_override', e.target.checked)}
                        className="w-3.5 h-3.5" style={{ accentColor: 'var(--accent)' }} />
                      <span className="lbl" style={{ color: form.split_override ? 'var(--accent)' : 'var(--text3)' }}>
                        MANUAL
                      </span>
                    </label>
                  </div>
                  {form.split_override ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="lbl mb-1" style={{ color: 'var(--mau)' }}>MAU %</div>
                        <input type="number" className="ctrl" value={form.pct_mau} min="0" max="100"
                          onChange={e => { const v = +e.target.value; set('pct_mau', v); set('pct_juani', 100 - v) }} />
                      </div>
                      <div>
                        <div className="lbl mb-1" style={{ color: 'var(--juani)' }}>JUANI %</div>
                        <input type="number" className="ctrl" value={form.pct_juani} min="0" max="100"
                          onChange={e => { const v = +e.target.value; set('pct_juani', v); set('pct_mau', 100 - v) }} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {(['mau', 'juani'] as Partner[]).map(p => (
                        <div key={p} className="flex justify-between items-baseline">
                          <span className="lbl" style={{ color: p === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
                            {p === 'mau' ? 'MAU' : 'JUA'} {form[p === 'mau' ? 'pct_mau' : 'pct_juani']}%
                          </span>
                          <span className="num text-xs font-semibold" style={{ color: p === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
                            {fmtARS(p === 'mau' ? mauAmt : juaniAmt, true)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Affects balance */}
                <label className="flex items-center gap-3 p-3 rounded-sm cursor-pointer"
                  style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={form.affects_balance}
                    onChange={e => set('affects_balance', e.target.checked)}
                    className="w-4 h-4 flex-shrink-0" style={{ accentColor: 'var(--accent)' }} />
                  <div>
                    <div className="text-xs font-mono font-medium" style={{ color: 'var(--text)' }}>AFECTA BALANCE</div>
                    <div className="lbl">Desactivar para excluir del cálculo de deuda</div>
                  </div>
                </label>
              </div>
            )}

            {error && (
              <div className="mb-3 py-2 px-3 rounded-sm text-xs font-mono text-center animate-fade-in"
                style={{ background: 'rgba(255,51,85,0.07)', color: 'var(--danger)',
                  border: '1px solid rgba(255,51,85,0.18)' }}>
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button onClick={save} disabled={saving} className="btn-primary w-full h-11 mb-4 text-sm">
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  PROCESANDO…
                </span>
              ) : editId
                ? 'CONFIRMAR CAMBIOS'
                : form.type === 'gasto'
                  ? `▲ REGISTRAR GASTO · ${amount > 0 ? fmtARS(amtARS) : '$0'}`
                  : `▼ REGISTRAR INGRESO · ${amount > 0 ? fmtARS(amtARS) : '$0'}`
              }
            </button>

          </div>
        </div>
      </div>
    </>
  )
}

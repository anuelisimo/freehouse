'use client'

import { useEffect, useState, useRef } from 'react'
import type { Template } from '@/types'
import { useCatalog } from '@/hooks/useCatalog'
import { resolveRule } from '@/lib/balance'
import { todayISO, fmtARS } from '@/lib/fmt'

interface Props { open: boolean; onClose: () => void; onSaved: () => void; editId?: string | null; prefillTemplateId?: string | null }
type MovType = 'gasto' | 'ingreso' | 'liquidacion'
type Partner = 'mau' | 'juani' | 'ambos'

interface F {
  type: MovType | ''; amount: string; currency: 'ARS' | 'USD'
  date: string; business_id: string; category_id: string
  paid_by: Partner | ''; description: string
  affects_balance: boolean; split_override: boolean
  pct_mau: number; pct_juani: number
  payment_method: string
}

const EMPTY: F = {
  type: '', amount: '', currency: 'ARS', date: todayISO(),
  business_id: '', category_id: '', paid_by: '',
  description: '', affects_balance: true, split_override: false,
  pct_mau: 50, pct_juani: 50, payment_method: '',
}

interface FieldErrors {
  type?: string; amount?: string; paid_by?: string
  business_id?: string; category_id?: string; payment_method?: string
}

export default function MovementDrawer({ open, onClose, onSaved, editId, prefillTemplateId }: Props) {
  const { businesses, categories, rules, exchangeRates } = useCatalog()
  const [form, setF]          = useState<F>(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [fieldErrors, setFE]  = useState<FieldErrors>({})
  const [advanced, setAdv]    = useState(true)
  const [templates, setTmpl]  = useState<Template[]>([])
  const [query, setQuery]     = useState('')
  const [showSugg, setShowSugg] = useState(false)
  const amtRef = useRef<HTMLInputElement>(null)

  // "AMBOS" solo aplica cuando tipo es ingreso
  const isAmbos = form.paid_by === 'ambos'

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(j => setTmpl(j.data ?? []))
  }, [])

  useEffect(() => {
    if (!open) return
    if (editId) {
      setAdv(true); setQuery(''); setFE({}); setShowSugg(false)
      fetch(`/api/movements/${editId}`).then(r => r.json()).then(j => {
        const m = j.data
        if (!m) return
        setF({
          type: m.type, amount: String(m.amount), currency: m.currency ?? 'ARS',
          date: m.date, business_id: m.business_id, category_id: m.category_id,
          paid_by: m.paid_by, description: m.description ?? '',
          affects_balance: m.affects_balance, split_override: m.split_override,
          pct_mau: Number(m.pct_mau), pct_juani: Number(m.pct_juani),
          payment_method: m.payment_method ?? 'efectivo',
        })
        const tmplName = templates.find(t => t.id === m.template_id)?.name
        setQuery(tmplName ?? m.description ?? '')
      })
    } else {
      setF({ ...EMPTY, date: todayISO() })
      setAdv(true); setQuery(''); setFE({}); setShowSugg(false)
      setTimeout(() => amtRef.current?.focus(), 150)
    }
  }, [open, editId])

  useEffect(() => {
    if (open && prefillTemplateId && templates.length) {
      const t = templates.find(x => x.id === prefillTemplateId)
      if (t) {
        setF(f => ({ ...f, type: t.type as MovType, business_id: t.business_id,
          category_id: t.category_id, paid_by: t.default_paid_by as Partner,
          description: t.description ?? t.name, payment_method: f.payment_method || 'efectivo' }))
        setQuery(t.name)
        setTimeout(() => amtRef.current?.focus(), 150)
      }
    }
  }, [open, prefillTemplateId, templates])

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
    setF(f => ({ ...f, type: t.type as MovType, business_id: t.business_id,
      category_id: t.category_id, paid_by: t.default_paid_by as Partner,
      description: t.description ?? t.name, payment_method: f.payment_method || 'efectivo' }))
    setQuery(t.name); setShowSugg(false)
    setTimeout(() => amtRef.current?.focus(), 50)
  }

  function set<K extends keyof F>(k: K, v: F[K]) {
    setF(f => {
      const next = { ...f, [k]: v }
      if (k === 'paid_by') {
        if (v === 'ambos') {
          // AMBOS: split 50/50, no afecta balance, bloqueado
          next.split_override  = true
          next.pct_mau         = 50
          next.pct_juani       = 50
          next.affects_balance = false
        } else if (f.paid_by === 'ambos') {
          // Si venía de AMBOS, resetear affects_balance
          next.affects_balance = true
          next.split_override  = false
        }
        if (v === 'mau' && f.type === 'liquidacion') {
          next.pct_mau = 0; next.pct_juani = 100
        }
        if (v === 'juani' && f.type === 'liquidacion') {
          next.pct_mau = 100; next.pct_juani = 0
        }
      }
      if (k === 'business_id') next.category_id = ''
      return next
    })
    setFE(e => ({ ...e, [k]: undefined }))
  }

  const amount   = parseFloat(form.amount) || 0
  const rate     = form.currency === 'USD' ? (exchangeRates['USD'] ?? 1) : 1
  const amtARS   = amount * rate
  // Para AMBOS, cada uno recibe la mitad
  const mauAmt   = isAmbos ? amtARS / 2 : amtARS * form.pct_mau   / 100
  const juaniAmt = isAmbos ? amtARS / 2 : amtARS * form.pct_juani / 100
  const bizName  = businesses.find(b => b.id === form.business_id)?.name ?? '—'
  const catName  = categories.find(c => c.id === form.category_id)?.name ?? '—'

  const isEdit     = !!editId
  const hasType    = isEdit || !!form.type
  const hasAmount  = isEdit || (hasType && amount > 0)
  const hasPaidBy  = isEdit || (hasAmount && !!form.paid_by)
  const hasPayment = isEdit || (hasPaidBy && !!form.payment_method)
  const hasBiz     = isEdit || (hasPayment && !!form.business_id)
  const hasCat     = isEdit || (hasBiz && !!form.category_id)

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!form.type)           errors.type          = 'Seleccioná un tipo'
    if (!amount || amount<=0) errors.amount         = 'Ingresá un monto'
    if (!form.paid_by)        errors.paid_by        = 'Seleccioná quién cobró'
    if (!form.payment_method) errors.payment_method = 'Seleccioná el medio de pago'
    if (!form.business_id)    errors.business_id    = 'Seleccioná un negocio'
    if (!form.category_id)    errors.category_id    = 'Seleccioná una categoría'
    setFE(errors)
    return Object.keys(errors).length === 0
  }

  async function save() {
    if (!validate()) return
    setSaving(true)
    try {
      if (isAmbos) {
        // Crear DOS movimientos: uno para Mau (100/0) y uno para Juani (0/100)
        const half = amount / 2
        const base = {
          currency: form.currency, exchange_rate: rate,
          type: form.type, business_id: form.business_id,
          category_id: form.category_id, date: form.date,
          description: form.description || query || undefined,
          affects_balance: false, split_override: true,
          payment_method: form.payment_method,
        }
        await Promise.all([
          fetch('/api/movements', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...base, amount: half, paid_by: 'mau', pct_mau: 100, pct_juani: 0 }),
          }),
          fetch('/api/movements', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...base, amount: half, paid_by: 'juani', pct_mau: 0, pct_juani: 100 }),
          }),
        ])
      } else {
        const res = await fetch(editId ? `/api/movements/${editId}` : '/api/movements', {
          method:  editId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ...form, amount, exchange_rate: rate }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Error')
      }
      onSaved()
    } catch (e: any) { setFE({ type: e.message }) }
    finally { setSaving(false) }
  }

  function fieldStyle(hasError?: string, disabled?: boolean): React.CSSProperties {
    return {
      opacity:       disabled ? 0.35 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      borderColor:   hasError ? 'var(--danger)' : undefined,
      boxShadow:     hasError ? '0 0 0 2px rgba(255,51,85,0.15)' : undefined,
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade-in"
        style={{ background: 'rgba(7,9,13,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full animate-fade-up rounded-sm overflow-hidden"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border2)',
            maxWidth: 480, maxHeight: '90dvh',
            boxShadow: '0 0 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,255,136,0.06)',
          }}
          onClick={e => e.stopPropagation()}>

          <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />

          <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(90dvh - 4px)' }}>
            <div className="px-5 py-4">

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-mono font-semibold uppercase tracking-wide">
                    {editId ? 'EDITAR OPERACIÓN' : 'NUEVA OPERACIÓN'}
                  </div>
                  <div className="lbl mt-0.5">ORDER ENTRY</div>
                </div>
                <button onClick={onClose} className="btn-icon w-7 h-7 text-sm rounded-sm">✕</button>
              </div>

              {/* ── 1. TIPO ─── */}
              <div className="mb-4">
                <div className="lbl mb-1.5">
                  TIPO
                  {fieldErrors.type && <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--danger)' }}>← {fieldErrors.type}</span>}
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-sm"
                  style={{ background: 'var(--s2)', border: `1px solid ${fieldErrors.type ? 'var(--danger)' : 'var(--border)'}` }}>
                  {([
                    { t: 'gasto',       label: '▼ GASTO',   bg: 'rgba(255,51,85,0.12)',  color: 'var(--danger)', border: 'rgba(255,51,85,0.3)',  glow: 'var(--glow-r)' },
                    { t: 'ingreso',     label: '▲ INGRESO',  bg: 'rgba(0,255,136,0.1)',   color: 'var(--accent)', border: 'rgba(0,255,136,0.25)', glow: 'var(--glow-g)' },
                    { t: 'liquidacion', label: '⇄ LIQUID.',  bg: 'rgba(0,229,255,0.1)',   color: 'var(--cyan)',   border: 'rgba(0,229,255,0.25)', glow: 'var(--glow-c)' },
                  ] as { t: MovType; label: string; bg: string; color: string; border: string; glow: string }[]).map(({ t, label, bg, color, border, glow }) => {
                    const active = form.type === t
                    return (
                      <button key={t} onClick={() => {
                        set('type', t)
                        if (t === 'liquidacion') {
                          setF(f => ({ ...f, type: t, split_override: true,
                            pct_mau: f.paid_by === 'mau' ? 0 : 100,
                            pct_juani: f.paid_by === 'mau' ? 100 : 0,
                            affects_balance: true }))
                        }
                        // Si cambia a gasto, resetear AMBOS
                        if (t !== 'ingreso' && form.paid_by === 'ambos') {
                          setF(f => ({ ...f, type: t, paid_by: '', affects_balance: true, split_override: false }))
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
              </div>

              {/* Info liquidación */}
              {form.type === 'liquidacion' && (
                <div className="mb-4 p-3 rounded-sm" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
                  <div className="text-xs font-mono" style={{ color: 'var(--cyan)' }}>⇄ LIQUIDACIÓN DE DEUDA</div>
                  <div className="lbl mt-1" style={{ color: 'var(--text2)' }}>
                    Registra un pago entre socios para saldar deuda. No afecta ingresos ni gastos del negocio.
                  </div>
                  <div className="lbl mt-1.5" style={{ color: 'var(--text3)' }}>
                    {form.paid_by === 'mau' ? '→ MAU le paga a JUANI' : form.paid_by === 'juani' ? '→ JUANI le paga a MAU' : '→ Seleccioná quién paga'}
                  </div>
                </div>
              )}

              {/* ── 2. CONCEPTO + MONTO ─── */}
              <div style={fieldStyle(undefined, !hasType)}>
                <div className="mb-4 relative">
                  <div className="lbl mb-1.5">CONCEPTO / PLANTILLA <span style={{ color: 'var(--text3)' }}>(opcional)</span></div>
                  <input className="ctrl" placeholder="Buscar plantilla o ingresar concepto…"
                    value={query} autoComplete="off"
                    onChange={e => { setQuery(e.target.value); setShowSugg(true) }}
                    onFocus={() => setShowSugg(true)} />
                  {showSugg && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-10 overflow-hidden rounded-sm shadow-2xl"
                      style={{ background: 'var(--s3)', border: '1px solid var(--border2)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
                      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
                      {suggestions.slice(0, 6).map(t => (
                        <button key={t.id} onMouseDown={() => applyTmpl(t)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[var(--s2)]"
                          style={{ borderBottom: '1px solid var(--border)' }}>
                          <div className="w-6 h-6 rounded-sm flex items-center justify-center text-xs flex-shrink-0"
                            style={{ background: t.type === 'ingreso' ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,85,0.1)',
                              color: t.type === 'ingreso' ? 'var(--accent)' : 'var(--danger)' }}>
                            {t.is_favorite ? '★' : t.type === 'ingreso' ? '▲' : '▼'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text)' }}>{t.name}</div>
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

                <div className="mb-4">
                  <div className="lbl mb-1.5">
                    MONTO {isAmbos && <span style={{ color: 'var(--text3)' }}>(total — se divide en 2)</span>}
                    {fieldErrors.amount && <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--danger)' }}>← {fieldErrors.amount}</span>}
                  </div>
                  <div className="flex gap-2">
                    <select className="ctrl w-20 flex-shrink-0" value={form.currency}
                      onChange={e => set('currency', e.target.value as 'ARS'|'USD')}>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                    <input ref={amtRef} type="number" className="ctrl-amount flex-1"
                      placeholder="0" value={form.amount} min="0" step="any"
                      style={{ ...fieldStyle(fieldErrors.amount), fontFamily: 'monospace' }}
                      onChange={e => set('amount', e.target.value)} inputMode="decimal" />
                  </div>
                  {form.currency === 'USD' && amount > 0 && (
                    <div className="lbl mt-1.5">≈ {fmtARS(amtARS)} · TC {fmtARS(exchangeRates['USD'] ?? 0)}</div>
                  )}
                  {/* Preview cobro compartido */}
                  {isAmbos && amount > 0 && (
                    <div className="mt-2 p-2 rounded-sm flex justify-between"
                      style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                      <span className="num text-xs" style={{ color: 'var(--mau)' }}>MAU cobra {fmtARS(mauAmt)}</span>
                      <span className="num text-xs" style={{ color: 'var(--juani)' }}>JUANI cobra {fmtARS(juaniAmt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 3. REALIZADO POR ─── */}
              <div className="mb-4" style={fieldStyle(fieldErrors.paid_by, !hasAmount)}>
                <div className="lbl mb-1.5">
                  {form.type === 'ingreso' ? 'COBRADO POR' : 'PAGADO POR'}
                  {fieldErrors.paid_by && <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--danger)' }}>← {fieldErrors.paid_by}</span>}
                </div>
                {/* MAU + JUANI siempre visibles, AMBOS solo para ingresos */}
                <div className={`grid gap-2 ${form.type === 'ingreso' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {(['mau', 'juani', ...(form.type === 'ingreso' ? ['ambos'] : [])] as Partner[]).map(p => {
                    const active = form.paid_by === p
                    const isAmboBtn = p === 'ambos'
                    const col  = isAmboBtn ? '#a78bfa' : p === 'mau' ? 'var(--mau)' : 'var(--juani)'
                    const rgb  = isAmboBtn ? '167,139,250' : p === 'mau' ? '0,255,136' : '0,229,255'
                    return (
                      <button key={p} onClick={() => set('paid_by', p)}
                        className="flex items-center gap-2 p-3 rounded-sm border transition-all justify-center"
                        style={{
                          background:  active ? `rgba(${rgb},0.07)` : 'var(--s2)',
                          borderColor: active ? col : fieldErrors.paid_by ? 'var(--danger)' : 'var(--border)',
                          boxShadow:   active ? `0 0 12px rgba(${rgb},0.12)` : 'none',
                          flexDirection: isAmboBtn ? 'column' : 'row',
                        }}>
                        {isAmboBtn ? (
                          <>
                            <div className="text-xs font-mono font-bold" style={{ color: active ? col : 'var(--text3)' }}>AMBOS</div>
                            <div className="lbl" style={{ color: 'var(--text3)', fontSize: '0.55rem' }}>50 / 50</div>
                          </>
                        ) : (
                          <>
                            <div className="w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                              style={{ background: `rgba(${rgb},0.12)`, color: col, fontFamily: 'monospace' }}>
                              {p === 'mau' ? 'MA' : 'JU'}
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-mono font-medium" style={{ color: active ? col : 'var(--text)' }}>
                                {p === 'mau' ? 'MAU' : 'JUANI'}
                              </div>
                              <div className="lbl" style={{ color: 'var(--text3)' }}>PARTNER</div>
                            </div>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Info AMBOS */}
                {isAmbos && (
                  <div className="mt-2 p-2.5 rounded-sm" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
                    <div className="text-xs font-mono" style={{ color: '#a78bfa' }}>⚡ COBRO COMPARTIDO</div>
                    <div className="lbl mt-1" style={{ color: 'var(--text2)' }}>
                      Se crearán 2 movimientos automáticamente — uno por cada socio por el 50% del monto total.
                    </div>
                    <div className="lbl mt-1" style={{ color: 'var(--text3)' }}>
                      No afecta el balance de deuda entre socios.
                    </div>
                  </div>
                )}
              </div>

              {/* ── 4. MEDIO DE PAGO ─── */}
              <div className="mb-4" style={fieldStyle(fieldErrors.payment_method, !hasPaidBy)}>
                <div className="lbl mb-1.5">
                  MEDIO DE PAGO
                  {fieldErrors.payment_method && <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--danger)' }}>← {fieldErrors.payment_method}</span>}
                </div>
                <select className="ctrl" value={form.payment_method}
                  onChange={e => set('payment_method', e.target.value)}
                  style={fieldStyle(fieldErrors.payment_method)}>
                  <option value="">Seleccioná medio de pago…</option>
                  <option value="efectivo">💵 Efectivo / Transferencia</option>
                  <option value="tarjeta_freehouse">💳 Tarjeta FREEhouse</option>
                  <option value="tarjeta_freework">💳 Tarjeta FREEwork</option>
                  <option value="tarjeta_freeproject">💳 Tarjeta FREEproject</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {/* ── 5. NEGOCIO + CATEGORÍA ─── */}
              <div style={fieldStyle(undefined, !hasPayment)}>
                <div className="mb-4">
                  <div className="lbl mb-1.5">
                    NEGOCIO
                    {fieldErrors.business_id && <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--danger)' }}>← {fieldErrors.business_id}</span>}
                  </div>
                  <select className="ctrl" value={form.business_id} onChange={e => set('business_id', e.target.value)}
                    style={fieldStyle(fieldErrors.business_id)}>
                    <option value="">Seleccioná negocio…</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="mb-4" style={fieldStyle(fieldErrors.category_id, !hasBiz)}>
                  <div className="lbl mb-1.5">
                    CATEGORÍA
                    {fieldErrors.category_id && <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--danger)' }}>← {fieldErrors.category_id}</span>}
                  </div>
                  <select className="ctrl" value={form.category_id} onChange={e => set('category_id', e.target.value)}
                    style={fieldStyle(fieldErrors.category_id)}>
                    <option value="">Seleccioná categoría…</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ── 6. FECHA ─── */}
              <div className="mb-4" style={fieldStyle(undefined, !hasCat)}>
                <div className="lbl mb-1.5">FECHA</div>
                <input type="date" className="ctrl" value={form.date}
                  onChange={e => set('date', e.target.value)} />
              </div>

              {/* ── DETALLES (avanzado) ─── */}
              <div className="mb-4 p-3 rounded-sm flex items-center justify-between"
                style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                <div>
                  <div className="lbl mb-1">{bizName} · {catName}</div>
                  <div className="flex items-center gap-3">
                    <span className="num text-xs" style={{ color: 'var(--mau)' }}>
                      M {isAmbos ? '50' : form.pct_mau}% = {fmtARS(mauAmt)}
                    </span>
                    <span className="lbl">|</span>
                    <span className="num text-xs" style={{ color: 'var(--juani)' }}>
                      J {isAmbos ? '50' : form.pct_juani}% = {fmtARS(juaniAmt)}
                    </span>
                  </div>
                </div>
                {!isAmbos && (
                  <button onClick={() => setAdv(a => !a)}
                    className="lbl px-2.5 py-1.5 rounded-sm transition-all hover:opacity-80"
                    style={{ border: '1px solid var(--border2)', color: advanced ? 'var(--accent)' : 'var(--text3)' }}>
                    {advanced ? 'CERRAR' : 'DETALLES ›'}
                  </button>
                )}
              </div>

              {advanced && !isAmbos && (
                <div className="mb-4 space-y-3 p-3 rounded-sm"
                  style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>

                  <div>
                    <div className="lbl mb-1.5">DESCRIPCIÓN</div>
                    <input className="ctrl" placeholder="Opcional…" value={form.description}
                      onChange={e => set('description', e.target.value)} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="lbl">REPARTO</div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={form.split_override}
                          onChange={e => set('split_override', e.target.checked)}
                          style={{ accentColor: 'var(--accent)' }} />
                        <span className="lbl">MANUAL</span>
                      </label>
                    </div>
                    {form.split_override ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="lbl mb-1" style={{ color: 'var(--mau)' }}>MAU %</div>
                          <input type="number" className="ctrl" value={form.pct_mau} min="0" max="100" step="1"
                            onChange={e => { const v = parseFloat(e.target.value)||0; setF(f=>({...f,pct_mau:v,pct_juani:100-v})) }}
                            style={{ color: 'var(--mau)', fontFamily: 'monospace' }} />
                        </div>
                        <div>
                          <div className="lbl mb-1" style={{ color: 'var(--juani)' }}>JUANI %</div>
                          <input type="number" className="ctrl" value={form.pct_juani} min="0" max="100" step="1"
                            onChange={e => { const v = parseFloat(e.target.value)||0; setF(f=>({...f,pct_juani:v,pct_mau:100-v})) }}
                            style={{ color: 'var(--juani)', fontFamily: 'monospace' }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <span className="num text-xs" style={{ color: 'var(--mau)' }}>MAU {form.pct_mau}%</span>
                        <span className="lbl">/</span>
                        <span className="num text-xs" style={{ color: 'var(--juani)' }}>JUANI {form.pct_juani}%</span>
                      </div>
                    )}
                  </div>

                  {/* Afecta balance — bloqueado si es AMBOS */}
                  <label className="flex items-center gap-2 cursor-pointer" style={{ opacity: isAmbos ? 0.5 : 1 }}>
                    <input type="checkbox" checked={form.affects_balance}
                      onChange={e => !isAmbos && set('affects_balance', e.target.checked)}
                      disabled={isAmbos}
                      style={{ accentColor: 'var(--accent)' }} />
                    <div>
                      <div className="text-xs font-mono font-medium" style={{ color: 'var(--text)' }}>
                        AFECTA BALANCE {isAmbos && <span style={{ color: '#a78bfa' }}>(bloqueado — cobro compartido)</span>}
                      </div>
                      <div className="lbl" style={{ color: 'var(--text3)' }}>Desactivar para excluir del cálculo de deuda</div>
                    </div>
                  </label>
                </div>
              )}

              {/* Descripción visible para AMBOS */}
              {isAmbos && (
                <div className="mb-4 p-3 rounded-sm" style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                  <div className="lbl mb-1.5">DESCRIPCIÓN</div>
                  <input className="ctrl" placeholder="Opcional…" value={form.description}
                    onChange={e => set('description', e.target.value)} />
                </div>
              )}

              {/* Error general */}
              {fieldErrors.type && !['Seleccioná un tipo','Ingresá un monto','Seleccioná quién cobró','Seleccioná el medio de pago','Seleccioná un negocio','Seleccioná una categoría'].includes(fieldErrors.type) && (
                <div className="py-2 px-3 rounded-sm text-xs font-mono text-center mb-3"
                  style={{ background: 'rgba(255,51,85,0.07)', color: 'var(--danger)', border: '1px solid rgba(255,51,85,0.18)' }}>
                  ⚠ {fieldErrors.type}
                </div>
              )}

              {/* Submit */}
              <button onClick={save} disabled={saving} className="btn-primary w-full h-11 mb-2 text-sm">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    PROCESANDO…
                  </span>
                ) : editId ? 'CONFIRMAR CAMBIOS'
                  : isAmbos                      ? `⚡ REGISTRAR COBRO COMPARTIDO · ${amount > 0 ? fmtARS(amtARS) : '$0'}`
                  : form.type === 'gasto'        ? `▼ REGISTRAR GASTO · ${amount > 0 ? fmtARS(amtARS) : '$0'}`
                  : form.type === 'liquidacion'  ? `⇄ REGISTRAR LIQUIDACIÓN · ${amount > 0 ? fmtARS(amtARS) : '$0'}`
                  : form.type === 'ingreso'      ? `▲ REGISTRAR INGRESO · ${amount > 0 ? fmtARS(amtARS) : '$0'}`
                  : 'REGISTRAR'}
              </button>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}

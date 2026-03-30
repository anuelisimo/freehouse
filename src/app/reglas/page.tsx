'use client'

import { useEffect, useState } from 'react'
import type { SplitRule, Business, Category } from '@/types'
import { useCatalog } from '@/hooks/useCatalog'

export default function ReglasPage() {
  const { businesses, categories } = useCatalog()
  const [rules,   setRules]  = useState<SplitRule[]>([])
  const [loading, setLoad]   = useState(true)
  const [modal,   setModal]  = useState<SplitRule | 'new' | null>(null)
  const [deleting, setDel]   = useState<string | null>(null)

  async function loadRules() {
    setLoad(true)
    const r = await fetch('/api/rules')
    const j = await r.json()
    setRules(j.data ?? [])
    setLoad(false)
  }

  useEffect(() => { loadRules() }, [])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta regla?')) return
    setDel(id)
    await fetch(`/api/rules/${id}`, { method: 'DELETE' })
    setDel(null)
    loadRules()
  }

  // Sort: general rules first (no category), then specific
  const sorted = [...rules].sort((a, b) => {
    // First sort by business name
    const bizA = (a.businesses as any)?.name ?? ''
    const bizB = (b.businesses as any)?.name ?? ''
    if (bizA !== bizB) return bizA.localeCompare(bizB)
    // Then general before specific
    if (!a.category_id && b.category_id) return -1
    if (a.category_id && !b.category_id) return 1
    return ((a.categories as any)?.name ?? '').localeCompare((b.categories as any)?.name ?? '')
  })

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-3">

        {/* ── HEADER ────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-mono font-semibold uppercase tracking-wide">Reglas de Reparto</div>
            <div className="lbl mt-0.5">Porcentajes por negocio y categoría</div>
          </div>
          <button onClick={() => setModal('new')} className="btn-primary text-xs px-3 py-2">
            + NUEVA
          </button>
        </div>

        {/* ── HOW IT WORKS (collapsed info) ─────────── */}
        <div className="p-3 rounded-sm" style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
          <div className="lbl mb-1.5" style={{ color: 'var(--accent)' }}>PRIORIDAD DE RESOLUCIÓN</div>
          <div className="space-y-1">
            {[
              ['1°', 'Negocio + categoría específica'],
              ['2°', 'Negocio (regla general)'],
              ['3°', 'Default: 50% / 50%'],
            ].map(([n, txt]) => (
              <div key={n} className="flex items-center gap-2">
                <span className="num text-xs" style={{ color: 'var(--accent)', minWidth: 20 }}>{n}</span>
                <span className="lbl">{txt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RULES TABLE ───────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card h-14 animate-pulse" style={{ background: 'var(--s2)' }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="lbl mb-2">SIN REGLAS PERSONALIZADAS</div>
            <div className="text-xs font-mono mb-3" style={{ color: 'var(--text3)' }}>
              Sin reglas, todos los movimientos se reparten 50/50.
            </div>
            <button onClick={() => setModal('new')} className="btn-primary text-xs">+ CREAR PRIMERA</button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="grid px-3 py-2"
              style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 8,
                borderBottom: '1px solid var(--border)', background: 'var(--s2)' }}>
              {['NEGOCIO', 'CATEGORÍA', 'MAU', 'JUANI', ''].map(h => (
                <div key={h} className="lbl" style={{ fontSize: '0.58rem' }}>{h}</div>
              ))}
            </div>

            {sorted.map((r, i) => (
              <RuleRow
                key={r.id}
                rule={r}
                last={i === sorted.length - 1}
                onEdit={() => setModal(r)}
                onDelete={() => handleDelete(r.id)}
                deleting={deleting === r.id}
              />
            ))}
          </div>
        )}

      </div>

      {/* ── MODAL ─────────────────────────────────────── */}
      {modal !== null && (
        <RuleModal
          rule={modal === 'new' ? null : modal}
          businesses={businesses}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadRules() }}
        />
      )}
    </div>
  )
}

// ── Fila de regla ──────────────────────────────────────────
function RuleRow({ rule, last, onEdit, onDelete, deleting }: {
  rule: SplitRule; last: boolean
  onEdit: () => void; onDelete: () => void; deleting: boolean
}) {
  const biz = (rule.businesses as any)
  const cat = (rule.categories as any)
  const isGeneral = !rule.category_id

  return (
    <div className="grid items-center px-3 py-3 transition-all hover:bg-[var(--s2)]"
      style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 8,
        borderBottom: last ? 'none' : '1px solid var(--border)' }}>

      {/* Business */}
      <div className="flex items-center gap-1.5 min-w-0">
        {biz?.color && (
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: biz.color, boxShadow: `0 0 4px ${biz.color}` }} />
        )}
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text)' }}>
          {biz?.name?.replace('FREE','') ?? '—'}
        </span>
      </div>

      {/* Category */}
      <div className="min-w-0">
        {isGeneral ? (
          <span className="lbl" style={{ color: 'var(--text3)' }}>GENERAL</span>
        ) : (
          <span className="text-xs font-mono truncate block" style={{ color: 'var(--text2)' }}>
            {cat?.name ?? '—'}
          </span>
        )}
      </div>

      {/* Pct Mau */}
      <div className="num text-xs font-semibold" style={{ color: 'var(--mau)' }}>
        {rule.pct_mau}%
      </div>

      {/* Pct Juani */}
      <div className="num text-xs font-semibold" style={{ color: 'var(--juani)' }}>
        {rule.pct_juani}%
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        <button onClick={onEdit} className="btn-icon w-6 h-6 text-[10px]">✏</button>
        <button onClick={onDelete} className="btn-icon w-6 h-6 text-[10px]"
          style={{ opacity: deleting ? 0.4 : 1 }}>
          {deleting ? '…' : '✕'}
        </button>
      </div>
    </div>
  )
}

// ── Modal: crear / editar regla ────────────────────────────
function RuleModal({ rule, businesses, categories, onClose, onSaved }: {
  rule: SplitRule | null
  businesses: Business[]
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [bizId,   setBiz]   = useState(rule?.business_id ?? businesses[0]?.id ?? '')
  const [catId,   setCat]   = useState(rule?.category_id ?? '')
  const [pctMau,  setMau]   = useState(rule?.pct_mau ?? 50)
  const [pctJua,  setJua]   = useState(rule?.pct_juani ?? 50)
  const [saving,  setSave]  = useState(false)
  const [error,   setError] = useState('')

  // Keep percentages summing to 100
  function handleMau(v: number) {
    const clamped = Math.min(100, Math.max(0, v))
    setMau(clamped)
    setJua(100 - clamped)
    setError('')
  }
  function handleJua(v: number) {
    const clamped = Math.min(100, Math.max(0, v))
    setJua(clamped)
    setMau(100 - clamped)
    setError('')
  }

  const sumOk = Math.abs(pctMau + pctJua - 100) < 0.01

  async function save() {
    if (!sumOk)  { setError('Los porcentajes deben sumar 100%'); return }
    if (!bizId)  { setError('Seleccioná un negocio'); return }
    setSave(true)

    const body = {
      business_id:  bizId,
      category_id:  catId || null,
      pct_mau:      pctMau,
      pct_juani:    pctJua,
    }

    const url    = rule?.id ? `/api/rules/${rule.id}` : '/api/rules'
    const method = rule?.id ? 'PATCH' : 'POST'

    // PATCH only accepts pct fields
    const patchBody = rule?.id ? { pct_mau: pctMau, pct_juani: pctJua } : body

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    })
    const json = await res.json()

    if (!res.ok) {
      const msg = json.error ?? 'Error al guardar'
      // Friendly message for duplicate rule
      setError(typeof msg === 'string' && msg.includes('duplicate') || res.status === 409
        ? 'Ya existe una regla para este negocio/categoría'
        : msg)
      setSave(false)
      return
    }
    onSaved()
  }

  const isEdit = !!rule?.id

  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade-in"
        style={{ background: 'rgba(7,9,13,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 animate-fade-up rounded-sm"
        style={{ background: 'var(--surface)', border: '1px solid var(--border2)',
          maxWidth: 380, margin: '0 auto',
          boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}>
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />

        <div className="p-5">
          <div className="text-sm font-mono font-semibold uppercase mb-4">
            {isEdit ? 'EDITAR REGLA' : 'NUEVA REGLA'}
          </div>

          <div className="space-y-3">
            {/* Business — only for new */}
            {!isEdit && (
              <div>
                <div className="lbl mb-1.5">NEGOCIO</div>
                <select className="ctrl" value={bizId} onChange={e => setBiz(e.target.value)}>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {/* Category — only for new */}
            {!isEdit && (
              <div>
                <div className="lbl mb-1.5">CATEGORÍA <span style={{ color: 'var(--text3)' }}>(vacío = regla general)</span></div>
                <select className="ctrl" value={catId} onChange={e => setCat(e.target.value)}>
                  <option value="">Todas las categorías (general)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Percentage inputs — the critical part */}
            <div>
              <div className="lbl mb-2">REPARTO</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="lbl mb-1.5" style={{ color: 'var(--mau)' }}>MAU %</div>
                  <input
                    type="number" className="ctrl" value={pctMau}
                    min="0" max="100" step="1"
                    onChange={e => handleMau(parseFloat(e.target.value) || 0)}
                    style={{ fontFamily: 'monospace', fontSize: '1.1rem',
                      color: 'var(--mau)', borderColor: 'rgba(0,255,136,0.3)' }}
                  />
                </div>
                <div>
                  <div className="lbl mb-1.5" style={{ color: 'var(--juani)' }}>JUANI %</div>
                  <input
                    type="number" className="ctrl" value={pctJua}
                    min="0" max="100" step="1"
                    onChange={e => handleJua(parseFloat(e.target.value) || 0)}
                    style={{ fontFamily: 'monospace', fontSize: '1.1rem',
                      color: 'var(--juani)', borderColor: 'rgba(0,229,255,0.3)' }}
                  />
                </div>
              </div>

              {/* Sum indicator */}
              <div className="flex items-center justify-between mt-2 px-1">
                <div className="lbl">TOTAL</div>
                <div className={`num text-xs font-semibold ${sumOk ? 'num-pos' : 'num-neg'}`}>
                  {pctMau + pctJua}% {sumOk ? '✓' : '≠ 100%'}
                </div>
              </div>

              {/* Visual bar */}
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${pctMau}%`,
                    background: `linear-gradient(90deg, var(--mau), var(--juani))`,
                  }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="lbl" style={{ color: 'var(--mau)' }}>MAU {pctMau}%</span>
                <span className="lbl" style={{ color: 'var(--juani)' }}>JUANI {pctJua}%</span>
              </div>
            </div>

            {error && (
              <div className="py-2 px-3 rounded-sm text-xs font-mono text-center"
                style={{ background: 'rgba(255,51,85,0.07)', color: 'var(--danger)',
                  border: '1px solid rgba(255,51,85,0.18)' }}>
                ⚠ {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="btn-ghost flex-1 text-xs">CANCELAR</button>
              <button onClick={save} disabled={saving || !sumOk}
                className="btn-primary flex-1 text-xs"
                style={{ opacity: saving || !sumOk ? 0.6 : 1 }}>
                {saving ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

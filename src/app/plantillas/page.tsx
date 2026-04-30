'use client'

import { useEffect, useState } from 'react'
import type { Template, Business, Category } from '@/types'
import { fmtARS, fmtPeriod, todayISO } from '@/lib/fmt'
import MovementDrawer from '@/components/forms/MovementDrawer'
import { useCatalog } from '@/hooks/useCatalog'

// ─────────────────────────────────────────────────────────────
export default function PlantillasPage() {
  const { businesses, categories } = useCatalog()
  const [templates, setTmpl]    = useState<Template[]>([])
  const [loading,   setLoading] = useState(true)
  const [drawer,    setDrawer]  = useState(false)
  const [useTmpl,   setUseTmpl] = useState<string | null>(null)   // pre-fill drawer
  const [editModal, setEdit]    = useState<Template | null>(null)
  const [bulkOpen,  setBulk]    = useState(false)
  const [deleting,  setDel]     = useState<string | null>(null)

  async function loadTmpls() {
    setLoading(true)
    const r = await fetch('/api/templates')
    const j = await r.json()
    setTmpl(j.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTmpls() }, [])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    setDel(id)
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    setDel(null)
    loadTmpls()
  }

  async function toggleFavorite(t: Template) {
    await fetch(`/api/templates/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: !t.is_favorite }),
    })
    loadTmpls()
  }

  function openUse(id: string) {
    setUseTmpl(id)
    setDrawer(true)
  }

  // Sort: por negocio (FREEhouse → FREEwork → FREEproject) luego alfabético
  const BIZ_ORDER: Record<string, number> = { 'FREEhouse': 0, 'FREEwork': 1, 'FREEproject': 2 }
  const sorted = [...templates].sort((a, b) => {
    const bizA = (a.businesses as any)?.name ?? ''
    const bizB = (b.businesses as any)?.name ?? ''
    const orderA = BIZ_ORDER[bizA] ?? 99
    const orderB = BIZ_ORDER[bizB] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name, 'es')
  })

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-3">

        {/* ── HEADER ────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-mono font-semibold uppercase tracking-wide">Plantillas</div>
            <div className="lbl mt-0.5">{templates.length} plantillas</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setBulk(true)}
              className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5"
              style={{ color: 'var(--warn)', borderColor: 'rgba(240,180,41,0.3)' }}>
              <span>⚡</span> CARGAR MES
            </button>
            <button onClick={() => { setEdit(null); setEdit({} as Template) }}
              className="btn-primary text-xs px-3 py-2">
              + NUEVA
            </button>
          </div>
        </div>

        {/* ── LIST ──────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card h-16 animate-pulse" style={{ background: 'var(--s2)' }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="lbl mb-3">SIN PLANTILLAS</div>
            <div className="text-xs font-mono mb-4" style={{ color: 'var(--text3)' }}>
              Creá plantillas para cargar rápido gastos recurrentes como electricidad, internet, etc.
            </div>
            <button onClick={() => setEdit({} as Template)} className="btn-primary text-xs">
              + CREAR PRIMERA
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {sorted.map((t, i) => (
              <TmplRow
                key={t.id}
                t={t}
                last={i === sorted.length - 1}
                onUse={() => openUse(t.id)}
                onEdit={() => setEdit(t)}
                onDelete={() => handleDelete(t.id)}
                onFav={() => toggleFavorite(t)}
                deleting={deleting === t.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── DRAWER: usar plantilla ─────────────────────── */}
      <MovementDrawer
        open={drawer}
        onClose={() => { setDrawer(false); setUseTmpl(null) }}
        onSaved={() => { setDrawer(false); setUseTmpl(null) }}
        prefillTemplateId={useTmpl}
      />

      {/* ── MODAL: crear/editar plantilla ─────────────── */}
      {editModal !== null && (
        <TmplModal
          tmpl={'id' in editModal && editModal.id ? editModal : null}
          businesses={businesses}
          categories={categories}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); loadTmpls() }}
        />
      )}

      {/* ── MODAL: cargar mes ─────────────────────────── */}
      {bulkOpen && (
        <BulkModal
          templates={templates}
          onClose={() => setBulk(false)}
          onSaved={() => { setBulk(false) }}
        />
      )}
    </div>
  )
}

// ── Fila de plantilla ──────────────────────────────────────
function TmplRow({ t, last, onUse, onEdit, onDelete, onFav, deleting }: {
  t: Template; last: boolean
  onUse: () => void; onEdit: () => void
  onDelete: () => void; onFav: () => void
  deleting: boolean
}) {
  const isIncome = t.type === 'ingreso'
  const biz = (t.businesses as any)
  const cat = (t.categories as any)

  return (
    <div className="flex items-center gap-3 px-3 py-3 transition-all hover:bg-[var(--s2)]"
      style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}>

      {/* Fav + type */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <button onClick={onFav} className="text-sm leading-none transition-all"
          style={{ color: t.is_favorite ? 'var(--warn)' : 'var(--border2)' }}>
          ★
        </button>
        <div className="text-xs font-mono leading-none"
          style={{ color: isIncome ? 'var(--accent)' : 'var(--danger)' }}>
          {isIncome ? '▼' : '▲'}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text)' }}>
          {t.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="lbl" style={{ color: biz?.color ?? 'var(--text3)' }}>
            {biz?.name ?? '—'}
          </span>
          <span className="lbl">·</span>
          <span className="lbl">{cat?.name ?? '—'}</span>
          <span className="lbl">·</span>
          <span className="lbl" style={{ color: t.default_paid_by === 'ambos' ? '#a78bfa' : t.default_paid_by === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
            {t.default_paid_by === 'ambos' ? 'AMBOS' : t.default_paid_by === 'mau' ? 'MAU' : 'JUA'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={onUse}
          className="text-xs font-mono px-2.5 py-1.5 rounded-sm transition-all"
          style={{ background: 'rgba(0,255,136,0.08)', color: 'var(--accent)',
            border: '1px solid rgba(0,255,136,0.2)' }}>
          USAR →
        </button>
        <button onClick={onEdit} className="btn-icon w-7 h-7 text-xs">✏</button>
        <button onClick={onDelete} className="btn-icon w-7 h-7 text-xs"
          style={{ opacity: deleting ? 0.4 : 1 }}>
          {deleting ? '…' : '✕'}
        </button>
      </div>
    </div>
  )
}

// ── Modal: crear/editar plantilla ──────────────────────────
function TmplModal({ tmpl, businesses, categories, onClose, onSaved }: {
  tmpl: Template | null
  businesses: Business[]
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name,    setName]    = useState(tmpl?.name ?? '')
  const [bizId,   setBiz]     = useState(tmpl?.business_id ?? businesses[0]?.id ?? '')
  const [catId,   setCat]     = useState(tmpl?.category_id ?? categories[0]?.id ?? '')
  const [type,    setType]    = useState<'gasto'|'ingreso'>(tmpl?.type ?? 'gasto')
  const [paidBy,  setPaid]    = useState<'mau'|'juani'|'ambos'>(tmpl?.default_paid_by ?? 'mau')
  const [desc,    setDesc]    = useState(tmpl?.description ?? '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function save() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    const body = { name: name.trim(), business_id: bizId, category_id: catId,
      type, default_paid_by: paidBy, description: desc || null }
    const url    = tmpl?.id ? `/api/templates/${tmpl.id}` : '/api/templates'
    const method = tmpl?.id ? 'PATCH' : 'POST'
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error al guardar'); setSaving(false); return }
    onSaved()
  }

  return (
    <Overlay onClose={onClose}>
      <div className="text-sm font-mono font-semibold uppercase mb-4">
        {tmpl?.id ? 'EDITAR PLANTILLA' : 'NUEVA PLANTILLA'}
      </div>

      <div className="space-y-3">
        <div>
          <div className="lbl mb-1.5">NOMBRE</div>
          <input className="ctrl" placeholder="Ej: Electricidad" value={name}
            onChange={e => { setName(e.target.value); setError('') }} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="lbl mb-1.5">NEGOCIO</div>
            <select className="ctrl" value={bizId} onChange={e => setBiz(e.target.value)}>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <div className="lbl mb-1.5">CATEGORÍA</div>
            <select className="ctrl" value={catId} onChange={e => setCat(e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="lbl mb-1.5">TIPO</div>
            <div className="grid grid-cols-2 gap-1">
              {(['gasto','ingreso'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className="py-2 text-xs font-mono rounded-sm border transition-all"
                  style={{
                    background: type === t ? (t === 'gasto' ? 'rgba(255,51,85,0.1)' : 'rgba(0,255,136,0.08)') : 'var(--s2)',
                    borderColor: type === t ? (t === 'gasto' ? 'var(--danger)' : 'var(--accent)') : 'var(--border)',
                    color: type === t ? (t === 'gasto' ? 'var(--danger)' : 'var(--accent)') : 'var(--text3)',
                  }}>
                  {t === 'gasto' ? '▲' : '▼'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="lbl mb-1.5">{type === 'ingreso' ? 'COBRADO POR' : 'PAGADO POR'}</div>
            <div className="grid grid-cols-3 gap-1">
              {(['mau','juani','ambos'] as const).map(p => (
                <button key={p} onClick={() => setPaid(p)}
                  className="py-2 text-xs font-mono rounded-sm border transition-all"
                  style={{
                    background: paidBy === p ? (p === 'ambos' ? 'rgba(167,139,250,0.08)' : p === 'mau' ? 'rgba(0,255,136,0.08)' : 'rgba(0,229,255,0.08)') : 'var(--s2)',
                    borderColor: paidBy === p ? (p === 'ambos' ? '#a78bfa' : p === 'mau' ? 'var(--mau)' : 'var(--juani)') : 'var(--border)',
                    color: paidBy === p ? (p === 'ambos' ? '#a78bfa' : p === 'mau' ? 'var(--mau)' : 'var(--juani)') : 'var(--text3)',
                  }}>
                  {p === 'ambos' ? 'AMBOS' : p === 'mau' ? 'MAU' : 'JUA'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="lbl mb-1.5">DESCRIPCIÓN (OPCIONAL)</div>
          <input className="ctrl" placeholder="Ej: Pago mensual Edesur"
            value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        {error && (
          <div className="py-2 px-3 rounded-sm text-xs font-mono text-center"
            style={{ background: 'rgba(255,51,85,0.07)', color: 'var(--danger)', border: '1px solid rgba(255,51,85,0.18)' }}>
            ⚠ {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs">CANCELAR</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-xs">
            {saving ? 'GUARDANDO…' : 'GUARDAR'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ── Modal: carga masiva mensual ────────────────────────────
function BulkModal({ templates, onClose, onSaved }: {
  templates: Template[]
  onClose: () => void
  onSaved: () => void
}) {
  const now   = new Date()
  const [month,    setMonth]   = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [year,     setYear]    = useState(String(now.getFullYear()))
  const [amounts,  setAmounts] = useState<Record<string, string>>({})
  const [skipped,  setSkipped] = useState<Set<string>>(new Set())
  const [saving,   setSaving]  = useState(false)
  const [done,     setDone]    = useState(0)
  const [loaded,   setLoaded]  = useState<Set<string>>(new Set())
  const [bulkSearch, setBulkSearch] = useState('')
  const [paidByOverride, setPaidBy] = useState<Record<string, string>>({}) // plantillas ya cargadas ese mes
  const [checking, setChecking] = useState(false)

  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  const BIZ_ORDER: Record<string, number> = { 'FREEhouse': 0, 'FREEwork': 1, 'FREEproject': 2 }
  const sorted = [...templates].sort((a, b) => {
    const orderA = BIZ_ORDER[(a.businesses as any)?.name ?? ''] ?? 99
    const orderB = BIZ_ORDER[(b.businesses as any)?.name ?? ''] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name, 'es')
  })

  // Verificar qué plantillas ya tienen movimiento en el mes/año seleccionado
  useEffect(() => {
    async function checkLoaded() {
      setChecking(true)
      try {
        const res  = await fetch(`/api/movements?period=${year}-${month}&limit=200`)
        const json = await res.json()
        const movs = json.data ?? []

        // Una plantilla está "cargada" si existe un movimiento con ese template_id en ese período
        const loadedIds = new Set<string>()
        const preAmounts: Record<string, string> = {}
        for (const m of movs) {
          if (m.template_id) {
            loadedIds.add(m.template_id)
            // Pre-llenar con el monto ya cargado
            preAmounts[m.template_id] = String(m.amount)
          }
        }
        setLoaded(loadedIds)
        // Limpiar montos anteriores y pre-llenar solo los del mes seleccionado
        setAmounts(preAmounts)
        // Auto-skipear las que ya están cargadas
        setSkipped(loadedIds)
      } catch (e) {
        // silently fail
      } finally {
        setChecking(false)
      }
    }
    checkLoaded()
  }, [month, year])

  function toggleSkip(id: string) {
    setSkipped(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function saveAll() {
    const toLoad = sorted.filter(t => !skipped.has(t.id) && parseFloat(amounts[t.id] || '') > 0)
    if (toLoad.length === 0) { alert('Ingresá al menos un monto'); return }
    setSaving(true)
    let count = 0
    for (const t of toLoad) {
      const amount = parseFloat(amounts[t.id])
      const selectedPaidBy = paidByOverride[t.id] ?? t.default_paid_by
      const base = {
        date:            `${year}-${month}-01`,
        currency:        'ARS',
        exchange_rate:   1,
        type:            t.type,
        business_id:     t.business_id,
        category_id:     t.category_id,
        template_id:     t.id,
        description:     t.description ?? t.name,
      }

      if (selectedPaidBy === 'ambos') {
        await Promise.all([
          fetch('/api/movements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...base, amount: amount / 2, paid_by: 'mau', affects_balance: false, split_override: true, pct_mau: 100, pct_juani: 0 }),
          }),
          fetch('/api/movements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...base, amount: amount / 2, paid_by: 'juani', affects_balance: false, split_override: true, pct_mau: 0, pct_juani: 100 }),
          }),
        ])
      } else {
        await fetch('/api/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...base, amount, paid_by: selectedPaidBy, affects_balance: true, split_override: false }),
        })
      }
      count++
      setDone(count)
    }
    setSaving(false)
    onSaved()
  }

  const displaySorted = bulkSearch
    ? sorted.filter(t => t.name.toLowerCase().includes(bulkSearch.toLowerCase()) ||
        (t.businesses as any)?.name?.toLowerCase().includes(bulkSearch.toLowerCase()))
    : sorted
  const pendingCount = sorted.filter(t => !loaded.has(t.id)).length
  const toLoadCount  = sorted.filter(t => !skipped.has(t.id) && parseFloat(amounts[t.id] || '') > 0).length

  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-mono font-semibold uppercase">⚡ CARGAR MES</div>
          <div className="lbl mt-0.5">
            {checking ? 'Verificando…' : `${pendingCount} pendientes · ${loaded.size} ya cargadas`}
          </div>
        </div>
      </div>

      {/* Month/year selector */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <div className="lbl mb-1.5">MES</div>
          <select className="ctrl" value={month} onChange={e => setMonth(e.target.value)}>
            {MONTHS.map((m, i) => (
              <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="lbl mb-1.5">AÑO</div>
          <input type="number" className="ctrl" value={year}
            onChange={e => setYear(e.target.value)} min="2020" max="2099" />
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)' }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input className="ctrl pl-8" placeholder="Filtrar plantillas…"
          value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} />
        {bulkSearch && (
          <button onClick={() => setBulkSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 lbl"
            style={{ color: 'var(--text3)' }}>✕</button>
        )}
      </div>

      {/* Template rows */}
      <div className="space-y-2 mb-4">
        {displaySorted.map(t => {
          const isSkipped  = skipped.has(t.id)
          const isLoaded   = loaded.has(t.id)
          const biz = (t.businesses as any)
          return (
            <div key={t.id}
              className="flex items-center gap-2.5 p-2.5 rounded-sm border transition-all"
              style={{
                background:  isLoaded ? 'var(--s2)' : isSkipped ? 'var(--s2)' : 'var(--s3)',
                borderColor: isLoaded ? 'rgba(0,255,136,0.2)' : isSkipped ? 'var(--border)' : 'var(--border2)',
                opacity:     isSkipped && !isLoaded ? 0.45 : 1,
              }}>
              {/* Skip toggle */}
              <input type="checkbox" checked={!isSkipped}
                onChange={() => toggleSkip(t.id)}
                className="w-4 h-4 flex-shrink-0" style={{ accentColor: 'var(--accent)' }} />

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text)' }}>
                    {t.name}
                  </span>
                  {isLoaded && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm flex-shrink-0"
                      style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--accent)', border: '1px solid rgba(0,255,136,0.2)' }}>
                      ✓ YA CARGADA
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="lbl" style={{ color: biz?.color ?? 'var(--text3)' }}>{biz?.name ?? '—'}</span>
                  <span className="lbl">·</span>
                  {/* Toggle MAU / JUA / AMBOS */}
                  {(['mau','juani','ambos'] as const).map(p => {
                    const current = paidByOverride[t.id] ?? t.default_paid_by
                    const active  = current === p
                    const col     = p === 'ambos' ? '#a78bfa' : p === 'mau' ? 'var(--mau)' : 'var(--juani)'
                    const rgb     = p === 'ambos' ? '167,139,250' : p === 'mau' ? '0,255,136' : '0,229,255'
                    return (
                      <button key={p} disabled={isSkipped}
                        onClick={() => setPaidBy(prev => ({ ...prev, [t.id]: p }))}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm transition-all"
                        style={{
                          background: active ? `rgba(${rgb},0.12)` : 'transparent',
                          color:      active ? col : 'var(--text3)',
                          border:     `1px solid ${active ? col : 'var(--border)'}`,
                        }}>
                        {p === 'ambos' ? 'AMBOS' : p === 'mau' ? 'MAU' : 'JUA'}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Amount input */}
              <input
                type="number"
                className="ctrl w-28 flex-shrink-0"
                placeholder={isLoaded ? 'Ya cargada' : 'Monto'}
                value={amounts[t.id] ?? ''}
                disabled={isSkipped}
                onChange={e => setAmounts(a => ({ ...a, [t.id]: e.target.value }))}
                inputMode="decimal"
                style={{ textAlign: 'right', fontFamily: 'monospace',
                  opacity: isLoaded ? 0.5 : 1 }}
              />
            </div>
          )
        })}
      </div>

      {saving && (
        <div className="py-2 px-3 rounded-sm text-xs font-mono text-center mb-3"
          style={{ background: 'rgba(0,255,136,0.07)', color: 'var(--accent)', border: '1px solid rgba(0,255,136,0.2)' }}>
          PROCESANDO {done} / {toLoadCount}…
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onClose} className="btn-ghost flex-1 text-xs">CANCELAR</button>
        <button onClick={saveAll} disabled={saving} className="btn-primary flex-1 text-xs">
          {saving ? 'CARGANDO…' : `⚡ CARGAR ${MONTHS[+month - 1]} ${year}`}
        </button>
      </div>
    </Overlay>
  )
}

// ── Overlay genérico ───────────────────────────────────────
function Overlay({ children, onClose, wide = false }: {
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade-in flex items-center justify-center p-4"
        style={{ background: 'rgba(7,9,13,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}>
        <div
          className="z-50 animate-fade-up rounded-sm overflow-hidden w-full"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            boxShadow: '0 0 60px rgba(0,0,0,0.8)',
            maxWidth: wide ? 480 : 400,
            maxHeight: '85dvh',
            overflowY: 'auto',
          }}
          onClick={e => e.stopPropagation()}>
          {/* Top accent */}
          <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
          <div className="p-5">{children}</div>
        </div>
      </div>
    </>
  )
}

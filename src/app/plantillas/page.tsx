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

  // Sort: favorites first, then alpha
  const sorted = [...templates].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
    return a.name.localeCompare(b.name)
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
            {biz?.name?.replace('FREE','') ?? '—'}
          </span>
          <span className="lbl">·</span>
          <span className="lbl">{cat?.name ?? '—'}</span>
          <span className="lbl">·</span>
          <span className="lbl" style={{ color: t.default_paid_by === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
            {t.default_paid_by === 'mau' ? 'MAU' : 'JUA'}
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
  const [paidBy,  setPaid]    = useState<'mau'|'juani'>(tmpl?.default_paid_by ?? 'mau')
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
            <div className="lbl mb-1.5">PAGADO POR</div>
            <div className="grid grid-cols-2 gap-1">
              {(['mau','juani'] as const).map(p => (
                <button key={p} onClick={() => setPaid(p)}
                  className="py-2 text-xs font-mono rounded-sm border transition-all"
                  style={{
                    background: paidBy === p ? (p === 'mau' ? 'rgba(0,255,136,0.08)' : 'rgba(0,229,255,0.08)') : 'var(--s2)',
                    borderColor: paidBy === p ? (p === 'mau' ? 'var(--mau)' : 'var(--juani)') : 'var(--border)',
                    color: paidBy === p ? (p === 'mau' ? 'var(--mau)' : 'var(--juani)') : 'var(--text3)',
                  }}>
                  {p === 'mau' ? 'MAU' : 'JUA'}
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
  const [month,   setMonth]   = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [year,    setYear]    = useState(String(now.getFullYear()))
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(0)

  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  function toggleSkip(id: string) {
    setSkipped(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function saveAll() {
    const toLoad = templates.filter(t => !skipped.has(t.id) && parseFloat(amounts[t.id] || '') > 0)
    if (toLoad.length === 0) { alert('Ingresá al menos un monto'); return }
    setSaving(true)
    let count = 0
    for (const t of toLoad) {
      await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:            `${year}-${month}-01`,
          amount:          parseFloat(amounts[t.id]),
          currency:        'ARS',
          exchange_rate:   1,
          type:            t.type,
          business_id:     t.business_id,
          category_id:     t.category_id,
          paid_by:         t.default_paid_by,
          description:     t.description ?? t.name,
          affects_balance: true,
          split_override:  false,
        }),
      })
      count++
      setDone(count)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-mono font-semibold uppercase">⚡ CARGAR MES</div>
          <div className="lbl mt-0.5">Cargá varios gastos recurrentes de una vez</div>
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

      {/* Template rows */}
      <div className="space-y-2 mb-4">
        {templates.map(t => {
          const isSkipped = skipped.has(t.id)
          const biz = (t.businesses as any)
          return (
            <div key={t.id}
              className="flex items-center gap-2.5 p-2.5 rounded-sm border transition-all"
              style={{
                background: isSkipped ? 'var(--s2)' : 'var(--s3)',
                borderColor: isSkipped ? 'var(--border)' : 'var(--border2)',
                opacity: isSkipped ? 0.45 : 1,
              }}>
              {/* Skip toggle */}
              <input type="checkbox" checked={!isSkipped}
                onChange={() => toggleSkip(t.id)}
                className="w-4 h-4 flex-shrink-0" style={{ accentColor: 'var(--accent)' }} />

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text)' }}>
                  {t.name}
                </div>
                <div className="lbl" style={{ color: biz?.color ?? 'var(--text3)' }}>
                  {biz?.name?.replace('FREE','') ?? '—'}
                  {' · '}
                  <span style={{ color: t.default_paid_by === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
                    {t.default_paid_by === 'mau' ? 'MAU' : 'JUA'}
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <input
                type="number"
                className="ctrl w-28 flex-shrink-0"
                placeholder="Monto"
                value={amounts[t.id] ?? ''}
                disabled={isSkipped}
                onChange={e => setAmounts(a => ({ ...a, [t.id]: e.target.value }))}
                inputMode="decimal"
                style={{ textAlign: 'right', fontFamily: 'monospace' }}
              />
            </div>
          )
        })}
      </div>

      {saving && (
        <div className="py-2 px-3 rounded-sm text-xs font-mono text-center mb-3"
          style={{ background: 'rgba(0,255,136,0.07)', color: 'var(--accent)', border: '1px solid rgba(0,255,136,0.2)' }}>
          PROCESANDO {done} / {templates.filter(t => !skipped.has(t.id) && parseFloat(amounts[t.id] || '') > 0).length}…
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
      <div className="fixed inset-0 z-40 animate-fade-in"
        style={{ background: 'rgba(7,9,13,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 animate-fade-up rounded-sm overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
          maxWidth: wide ? 480 : 400,
          margin: '0 auto',
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}>
        {/* Top accent */}
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
        <div className="p-5">{children}</div>
      </div>
    </>
  )
}

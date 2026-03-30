'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Movement, Business, Category } from '@/types'
import { fmtARS, fmtDate, fmtPeriod, currentPeriod } from '@/lib/fmt'
import MovementDrawer from '@/components/forms/MovementDrawer'

interface Meta { total: number; pages: number }

// ── Tipos locales ──────────────────────────────────────────
interface Filters {
  period:      string
  business_id: string
  type:        string
  paid_by:     string
}

const EMPTY_FILTERS: Filters = { period: '', business_id: '', type: '', paid_by: '' }

// ── Componente principal ───────────────────────────────────
export default function MovimientosPage() {
  const [movs,      setMovs]    = useState<Movement[]>([])
  const [meta,      setMeta]    = useState<Meta>({ total: 0, pages: 1 })
  const [page,      setPage]    = useState(1)
  const [loading,   setLoading] = useState(true)
  const [filters,   setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [periods,   setPeriods] = useState<string[]>([])
  const [businesses, setBiz]    = useState<Business[]>([])
  const [drawer,    setDrawer]  = useState(false)
  const [editId,    setEditId]  = useState<string | null>(null)
  const [deleting,  setDel]     = useState<string | null>(null)

  // Cargar catálogo una vez
  useEffect(() => {
    fetch('/api/catalog').then(r => r.json()).then(j => {
      setBiz(j.data?.businesses ?? [])
    })
  }, [])

  const load = useCallback(async (f: Filters, p: number) => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(p), limit: '30' })
    if (f.period)      q.set('period',      f.period)
    if (f.business_id) q.set('business_id', f.business_id)
    if (f.type)        q.set('type',        f.type)
    if (f.paid_by)     q.set('paid_by',     f.paid_by)

    const res  = await fetch(`/api/movements?${q}`)
    const json = await res.json()
    setMovs(json.data ?? [])
    setMeta(json.meta ?? { total: 0, pages: 1 })
    setLoading(false)
  }, [])

  // Cargar períodos disponibles
  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(j => {
      setPeriods(j.data?.periods ?? [])
    })
  }, [])

  useEffect(() => { load(filters, page) }, [filters, page, load])

  function setFilter<K extends keyof Filters>(k: K, v: string) {
    setFilters(f => ({ ...f, [k]: v }))
    setPage(1)
  }

  function clearFilters() { setFilters(EMPTY_FILTERS); setPage(1) }

  function openEdit(id: string) { setEditId(id); setDrawer(true) }
  function openNew()            { setEditId(null); setDrawer(true) }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return
    setDel(id)
    await fetch(`/api/movements/${id}`, { method: 'DELETE' })
    setDel(null)
    load(filters, page)
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-3">

        {/* ── HEADER ──────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-mono font-semibold uppercase tracking-wide">Operaciones</div>
            <div className="lbl mt-0.5">
              {loading ? '…' : `${meta.total} registros`}
            </div>
          </div>
          <button onClick={openNew} className="btn-primary px-4 py-2 text-xs">
            + NUEVA
          </button>
        </div>

        {/* ── FILTERS ─────────────────────────────────── */}
        <div className="space-y-2">
          {/* Row 1: period + business */}
          <div className="grid grid-cols-2 gap-2">
            <select className="ctrl" value={filters.period}
              onChange={e => setFilter('period', e.target.value)}>
              <option value="">Todos los meses</option>
              {periods.map(p => (
                <option key={p} value={p}>{fmtPeriod(p)}</option>
              ))}
            </select>
            <select className="ctrl" value={filters.business_id}
              onChange={e => setFilter('business_id', e.target.value)}>
              <option value="">Todos los negocios</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          {/* Row 2: type + paid_by + clear */}
          <div className="flex gap-2">
            <select className="ctrl flex-1" value={filters.type}
              onChange={e => setFilter('type', e.target.value)}>
              <option value="">Tipo</option>
              <option value="gasto">▲ Gastos</option>
              <option value="ingreso">▼ Ingresos</option>
            </select>
            <select className="ctrl flex-1" value={filters.paid_by}
              onChange={e => setFilter('paid_by', e.target.value)}>
              <option value="">Por quien</option>
              <option value="mau">Mau</option>
              <option value="juani">Juani</option>
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-icon flex-shrink-0 text-xs px-3"
                style={{ color: 'var(--danger)' }}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── LIST ────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-16 animate-pulse"
                style={{ background: 'var(--s2)' }} />
            ))}
          </div>
        ) : movs.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="lbl mb-2">SIN OPERACIONES</div>
            <button onClick={openNew} className="btn-primary text-xs mt-2">+ CARGAR PRIMERA</button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {movs.map((m, i) => (
              <MovRow
                key={m.id}
                m={m}
                last={i === movs.length - 1}
                onEdit={() => openEdit(m.id)}
                onDelete={() => handleDelete(m.id)}
                deleting={deleting === m.id}
              />
            ))}
          </div>
        )}

        {/* ── PAGINATION ──────────────────────────────── */}
        {meta.pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              className="btn-ghost text-xs px-3 py-1.5"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              ← PREV
            </button>
            <span className="lbl">{page} / {meta.pages}</span>
            <button
              className="btn-ghost text-xs px-3 py-1.5"
              disabled={page >= meta.pages}
              onClick={() => setPage(p => p + 1)}
              style={{ opacity: page >= meta.pages ? 0.3 : 1 }}
            >
              NEXT →
            </button>
          </div>
        )}

      </div>

      {/* ── FAB ─────────────────────────────────────────── */}
      <button onClick={openNew}
        className="fixed bottom-20 right-4 w-12 h-12 rounded-sm flex items-center justify-center z-40"
        style={{ background: 'var(--accent)', color: '#07090d',
          boxShadow: 'var(--glow-g)', border: '1px solid rgba(0,255,136,0.4)' }}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>

      <MovementDrawer
        open={drawer}
        editId={editId}
        onClose={() => { setDrawer(false); setEditId(null) }}
        onSaved={() => { setDrawer(false); setEditId(null); load(filters, page) }}
      />
    </div>
  )
}

// ── Fila de movimiento ─────────────────────────────────────
function MovRow({
  m, last, onEdit, onDelete, deleting
}: {
  m: Movement
  last: boolean
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const isIncome = m.type === 'ingreso'
  const biz = (m.businesses as any)
  const cat = (m.categories as any)

  return (
    <div className="flex items-center gap-3 px-3 py-3 transition-all hover:bg-[var(--s2)]"
      style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}>

      {/* Type indicator */}
      <div className="w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 text-sm font-mono"
        style={{
          background: isIncome ? 'rgba(0,255,136,0.08)' : 'rgba(255,51,85,0.08)',
          color:      isIncome ? 'var(--accent)' : 'var(--danger)',
        }}>
        {isIncome ? '▼' : '▲'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text)' }}>
          {m.description || cat?.name || '—'}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="lbl" style={{ color: biz?.color ?? 'var(--text3)' }}>
            {biz?.name?.replace('FREE', '') ?? '—'}
          </span>
          <span className="lbl">·</span>
          <span className="lbl" style={{ color: m.paid_by === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
            {m.paid_by === 'mau' ? 'MAU' : 'JUA'}
          </span>
          <span className="lbl">·</span>
          <span className="lbl">{fmtDate(m.date)}</span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0 mr-1">
        <div className={`num text-sm font-semibold ${isIncome ? 'num-pos' : 'num-neg'}`}>
          {isIncome ? '+' : '-'}{fmtARS(m.amount_ars, true)}
        </div>
        {!m.affects_balance && (
          <div className="lbl" style={{ color: 'var(--text3)' }}>no bal.</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="btn-icon w-7 h-7 text-xs">✏</button>
        <button onClick={onDelete} className="btn-icon w-7 h-7 text-xs"
          style={{ opacity: deleting ? 0.4 : 1, color: deleting ? 'var(--danger)' : undefined }}>
          {deleting ? '…' : '✕'}
        </button>
      </div>
    </div>
  )
}

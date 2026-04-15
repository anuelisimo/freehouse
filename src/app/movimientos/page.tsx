'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Movement, Business } from '@/types'
import { fmtARS, fmtDate, fmtPeriod } from '@/lib/fmt'
import MovementDrawer from '@/components/forms/MovementDrawer'

interface Filters {
  period:      string
  business_id: string
  type:        string
  paid_by:     string
  search:      string
}

const EMPTY_FILTERS: Filters = { period: '', business_id: '', type: '', paid_by: '', search: '' }

export default function MovimientosPage() {
  const [movs,       setMovs]    = useState<Movement[]>([])
  const [total,      setTotal]   = useState(0)
  const [loading,    setLoading] = useState(true)
  const [filters,    setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [periods,    setPeriods] = useState<string[]>([])
  const [businesses, setBiz]     = useState<Business[]>([])
  const [drawer,     setDrawer]  = useState(false)
  const [editId,     setEditId]  = useState<string | null>(null)
  const [deleting,   setDel]     = useState<string | null>(null)
  const [exporting,  setExport]  = useState(false)

  useEffect(() => {
    fetch('/api/catalog').then(r => r.json()).then(j => setBiz(j.data?.businesses ?? []))
    fetch('/api/dashboard').then(r => r.json()).then(j => setPeriods(j.data?.periods ?? []))
  }, [])

  const load = useCallback(async (f: Filters) => {
    setLoading(true)
    // Sin paginación — traer todos los movimientos del período/filtro
    // Si hay búsqueda, ignorar límite y traer todo
    const q = new URLSearchParams({ limit: '500' })
    if (f.period)      q.set('period',      f.period)
    if (f.business_id) q.set('business_id', f.business_id)
    if (f.type)        q.set('type',        f.type)
    if (f.paid_by)     q.set('paid_by',     f.paid_by)
    if (f.search)      q.set('search',      f.search)
    const res  = await fetch(`/api/movements?${q}`)
    const json = await res.json()
    setMovs(json.data ?? [])
    setTotal(json.meta?.total ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load(filters) }, [filters, load])

  // Filtro client-side adicional para negocio y categoría (complementa búsqueda API)
  const filteredMovs = filters.search
    ? movs.filter(m => {
        const q   = filters.search.toLowerCase()
        const desc = (m.description ?? '').toLowerCase()
        const biz  = ((m.businesses as any)?.name ?? '').toLowerCase()
        const cat  = ((m.categories as any)?.name ?? '').toLowerCase()
        return desc.includes(q) || biz.includes(q) || cat.includes(q)
      })
    : movs

  function setFilter<K extends keyof Filters>(k: K, v: string) {
    setFilters(f => ({ ...f, [k]: v }))
  }
  function clearFilters() { setFilters(EMPTY_FILTERS) }
  function openEdit(id: string) { setEditId(id); setDrawer(true) }
  function openNew()            { setEditId(null); setDrawer(true) }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return
    setDel(id)
    await fetch(`/api/movements/${id}`, { method: 'DELETE' })
    setDel(null)
    load(filters)
  }

  async function handleExport() {
    setExport(true)
    try {
      const q = new URLSearchParams({ limit: '2000' })
      if (filters.period)      q.set('period',      filters.period)
      if (filters.business_id) q.set('business_id', filters.business_id)
      if (filters.type)        q.set('type',        filters.type)
      if (filters.paid_by)     q.set('paid_by',     filters.paid_by)
      if (filters.search)      q.set('search',      filters.search)

      const res  = await fetch(`/api/movements?${q}`)
      const json = await res.json()
      const data: Movement[] = json.data ?? []

      if (data.length === 0) { alert('No hay movimientos para exportar'); setExport(false); return }

      const headers = ['Fecha','Tipo','Negocio','Categoría','Descripción','Moneda','Monto','Monto ARS','Tipo de cambio','Pagado por','Registrado por','% Mau','% Juani','Corresponde Mau (ARS)','Corresponde Juani (ARS)','Afecta balance']
      const rows = data.map(m => {
        const amtARS   = Number(m.amount_ars)
        const mauAmt   = amtARS * (Number(m.pct_mau)   / 100)
        const juaniAmt = amtARS * (Number(m.pct_juani) / 100)
        return [
          m.date, m.type,
          (m.businesses as any)?.name ?? '',
          (m.categories as any)?.name ?? '',
          m.description ?? '',
          m.currency,
          String(m.amount).replace('.', ','),
          String(amtARS.toFixed(2)).replace('.', ','),
          String(m.exchange_rate).replace('.', ','),
          m.paid_by === 'mau' ? 'Mau' : 'Juani',
          (m.profiles as any)?.name ?? '',
          String(m.pct_mau), String(m.pct_juani),
          String(mauAmt.toFixed(2)).replace('.', ','),
          String(juaniAmt.toFixed(2)).replace('.', ','),
          m.affects_balance ? 'Sí' : 'No',
        ]
      })

      const bom = '\uFEFF'
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n')
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const dateStr = new Date().toISOString().slice(0, 10)
      const suffix  = filters.period ? `_${fmtPeriod(filters.period).replace(' ', '-')}` : ''
      a.href = url; a.download = `freehouse_movimientos${suffix}_${dateStr}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Error al exportar') }
    finally { setExport(false) }
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
              {loading ? '…' : `${filteredMovs.length}${total > filteredMovs.length ? ` de ${total}` : ''} registros`}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} disabled={exporting}
              className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5"
              style={{ opacity: exporting ? 0.6 : 1 }} title="Exportar a Excel">
              {exporting ? (
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
              )}
              {exporting ? 'EXPORTANDO…' : 'EXCEL'}
            </button>
            <button onClick={openNew} className="btn-primary px-4 py-2 text-xs">+ NUEVA</button>
          </div>
        </div>

        {/* ── FILTERS ─────────────────────────────────── */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select className="ctrl" value={filters.period} onChange={e => setFilter('period', e.target.value)}>
              <option value="">Todos los meses</option>
              {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
            </select>
            <select className="ctrl" value={filters.business_id} onChange={e => setFilter('business_id', e.target.value)}>
              <option value="">Todos los negocios</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <select className="ctrl flex-1" value={filters.type} onChange={e => setFilter('type', e.target.value)}>
              <option value="">Tipo</option>
              <option value="gasto">▼ Gastos</option>
              <option value="ingreso">▲ Ingresos</option>
            </select>
            <select className="ctrl flex-1" value={filters.paid_by} onChange={e => setFilter('paid_by', e.target.value)}>
              <option value="">Por quien</option>
              <option value="mau">Mau</option>
              <option value="juani">Juani</option>
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-icon flex-shrink-0 text-xs px-3" style={{ color: 'var(--danger)' }}>✕</button>
            )}
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input className="ctrl pl-8" placeholder="Buscar en descripción, negocio o categoría…"
            value={filters.search} onChange={e => setFilter('search', e.target.value)} />
          {filters.search && (
            <button onClick={() => setFilter('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 lbl hover:opacity-70"
              style={{ color: 'var(--text3)' }}>✕</button>
          )}
        </div>

        {/* ── LIST ────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-16 animate-pulse" style={{ background: 'var(--s2)' }} />
            ))}
          </div>
        ) : filteredMovs.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="lbl mb-2">{filters.search ? 'SIN RESULTADOS' : 'SIN OPERACIONES'}</div>
            {!filters.search && <button onClick={openNew} className="btn-primary text-xs mt-2">+ CARGAR PRIMERA</button>}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {filteredMovs.map((m, i) => (
              <MovRow key={m.id} m={m} last={i === filteredMovs.length - 1}
                onEdit={() => openEdit(m.id)} onDelete={() => handleDelete(m.id)}
                deleting={deleting === m.id} />
            ))}
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
        open={drawer} editId={editId}
        onClose={() => { setDrawer(false); setEditId(null) }}
        onSaved={() => { setDrawer(false); setEditId(null); load(filters) }}
      />
    </div>
  )
}

// ── Fila de movimiento ─────────────────────────────────────
function MovRow({ m, last, onEdit, onDelete, deleting }: {
  m: Movement; last: boolean
  onEdit: () => void; onDelete: () => void; deleting: boolean
}) {
  const isIncome = m.type === 'ingreso'
  const isLiquid = m.type === 'liquidacion'
  const biz = (m.businesses as any)
  const cat = (m.categories as any)

  return (
    <div className="flex items-center gap-3 px-3 py-3 transition-all hover:bg-[var(--s2)]"
      style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div className="w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 text-sm font-mono"
        style={{
          background: isLiquid ? 'rgba(0,229,255,0.08)' : isIncome ? 'rgba(0,255,136,0.08)' : 'rgba(255,51,85,0.08)',
          color:      isLiquid ? 'var(--cyan)' : isIncome ? 'var(--accent)' : 'var(--danger)',
        }}>
        {isLiquid ? '⇄' : isIncome ? '▲' : '▼'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-medium truncate" style={{ color: 'var(--text)' }}>
          {m.description || cat?.name || '—'}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="lbl" style={{ color: biz?.color ?? 'var(--text3)' }}>{biz?.name ?? '—'}</span>
          <span className="lbl">·</span>
          <span className="lbl" style={{ color: m.paid_by === 'mau' ? 'var(--mau)' : 'var(--juani)' }}>
            {m.paid_by === 'mau' ? 'MAU' : 'JUA'}
          </span>
          {(m as any).payment_method && (m as any).payment_method !== 'efectivo' && (
            <>
              <span className="lbl">·</span>
              <span className="lbl" style={{ color: 'var(--warn)' }}>
                💳 {(m as any).payment_method.replace('tarjeta_', '').toUpperCase()}
              </span>
            </>
          )}
          <span className="lbl">·</span>
          <span className="lbl">{fmtDate(m.date)}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0 mr-1">
        <div className={`num text-sm font-semibold ${isLiquid ? '' : isIncome ? 'num-pos' : 'num-neg'}`}
          style={isLiquid ? { color: 'var(--cyan)' } : {}}>
          {isLiquid ? '⇄ ' : isIncome ? '+' : '-'}{fmtARS(m.amount_ars)}
        </div>
        {!m.affects_balance && <div className="lbl" style={{ color: 'var(--text3)' }}>no bal.</div>}
      </div>
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

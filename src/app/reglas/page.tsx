'use client'

import { useEffect, useState } from 'react'
import type { SplitRule, Business, Category } from '@/types'
import { useCatalog, invalidateCatalogCache } from '@/hooks/useCatalog'

// ── Tabs ──────────────────────────────────────────────────
type Tab = 'reglas' | 'categorias' | 'negocios'

export default function ReglasPage() {
  const [tab, setTab] = useState<Tab>('reglas')

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-3">

        <div>
          <div className="text-sm font-mono font-semibold uppercase tracking-wide">Configuración</div>
          <div className="lbl mt-0.5">Reglas, categorías y negocios</div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 rounded-sm" style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
          {([['reglas','REGLAS'], ['categorias','CATEGORÍAS'], ['negocios','NEGOCIOS']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-xs font-mono font-medium rounded-sm transition-all"
              style={{
                background: tab === t ? 'var(--surface)' : 'transparent',
                color:      tab === t ? 'var(--accent)'  : 'var(--text3)',
                boxShadow:  tab === t ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'reglas'     && <ReglasTab />}
        {tab === 'categorias' && <CategoriasTab />}
        {tab === 'negocios'   && <NegociosTab />}
      </div>
    </div>
  )
}

// ══ TAB: REGLAS ═══════════════════════════════════════════
function ReglasTab() {
  const { businesses, categories } = useCatalog()
  const [rules,    setRules]  = useState<SplitRule[]>([])
  const [loading,  setLoad]   = useState(true)
  const [modal,    setModal]  = useState<SplitRule | 'new' | null>(null)
  const [deleting, setDel]    = useState<string | null>(null)

  async function load() {
    setLoad(true)
    const r = await fetch('/api/rules')
    const j = await r.json()
    setRules(j.data ?? [])
    setLoad(false)
  }
  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta regla?')) return
    setDel(id)
    await fetch(`/api/rules/${id}`, { method: 'DELETE' })
    setDel(null)
    load()
  }

  const sorted = [...rules].sort((a, b) => {
    const bizA = (a.businesses as any)?.name ?? ''
    const bizB = (b.businesses as any)?.name ?? ''
    if (bizA !== bizB) return bizA.localeCompare(bizB)
    if (!a.category_id && b.category_id) return -1
    if (a.category_id && !b.category_id) return 1
    return ((a.categories as any)?.name ?? '').localeCompare((b.categories as any)?.name ?? '')
  })

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="lbl">Prioridad: negocio+categoría → negocio → 50/50</div>
        <button onClick={() => setModal('new')} className="btn-primary text-xs px-3 py-2">+ NUEVA</button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-12 animate-pulse" style={{ background: 'var(--s2)' }} />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid px-3 py-2"
            style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 8,
              borderBottom: '1px solid var(--border)', background: 'var(--s2)' }}>
            {['NEGOCIO','CATEGORÍA','MAU','JUANI',''].map(h => (
              <div key={h} className="lbl" style={{ fontSize: '0.58rem' }}>{h}</div>
            ))}
          </div>
          {sorted.length === 0
            ? <div className="p-8 text-center lbl">Sin reglas — se aplica 50/50 por defecto</div>
            : sorted.map((r, i) => (
                <RuleRow key={r.id} rule={r} last={i === sorted.length - 1}
                  onEdit={() => setModal(r)} onDelete={() => handleDelete(r.id)}
                  deleting={deleting === r.id} />
              ))
          }
        </div>
      )}

      {modal !== null && (
        <RuleModal
          rule={modal === 'new' ? null : modal}
          businesses={businesses} categories={categories}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}

function RuleRow({ rule, last, onEdit, onDelete, deleting }: {
  rule: SplitRule; last: boolean
  onEdit: () => void; onDelete: () => void; deleting: boolean
}) {
  const biz = (rule.businesses as any)
  const cat = (rule.categories as any)
  return (
    <div className="grid items-center px-3 py-3 transition-all hover:bg-[var(--s2)]"
      style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 8,
        borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div className="flex items-center gap-1.5 min-w-0">
        {biz?.color && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: biz.color }} />}
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text)' }}>{biz?.name ?? '—'}</span>
      </div>
      <div className="min-w-0">
        {!rule.category_id
          ? <span className="lbl" style={{ color: 'var(--text3)' }}>GENERAL</span>
          : <span className="text-xs font-mono truncate block" style={{ color: 'var(--text2)' }}>{cat?.name ?? '—'}</span>
        }
      </div>
      <div className="num text-xs font-semibold" style={{ color: 'var(--mau)' }}>{rule.pct_mau}%</div>
      <div className="num text-xs font-semibold" style={{ color: 'var(--juani)' }}>{rule.pct_juani}%</div>
      <div className="flex gap-1">
        <button onClick={onEdit} className="btn-icon w-6 h-6 text-[10px]">✏</button>
        <button onClick={onDelete} className="btn-icon w-6 h-6 text-[10px]" style={{ opacity: deleting ? 0.4 : 1 }}>
          {deleting ? '…' : '✕'}
        </button>
      </div>
    </div>
  )
}

function RuleModal({ rule, businesses, categories, onClose, onSaved }: {
  rule: SplitRule | null; businesses: Business[]; categories: Category[]
  onClose: () => void; onSaved: () => void
}) {
  const [bizId, setBiz] = useState(rule?.business_id ?? businesses[0]?.id ?? '')
  const [catId, setCat] = useState(rule?.category_id ?? '')
  const [pctMau, setMau] = useState(Number(rule?.pct_mau ?? 50))
  const [pctJua, setJua] = useState(Number(rule?.pct_juani ?? 50))
  const [saving, setSave] = useState(false)
  const [error,  setErr]  = useState('')
  const isEdit = !!rule?.id

  function handleMau(v: number) { const c = Math.min(100,Math.max(0,v)); setMau(c); setJua(100-c); setErr('') }
  function handleJua(v: number) { const c = Math.min(100,Math.max(0,v)); setJua(c); setMau(100-c); setErr('') }
  const sumOk = Math.abs(pctMau + pctJua - 100) < 0.01

  async function save() {
    if (!sumOk) { setErr('Los porcentajes deben sumar 100%'); return }
    if (!bizId) { setErr('Seleccioná un negocio'); return }
    setSave(true)
    const url    = isEdit ? `/api/rules/${rule!.id}` : '/api/rules'
    const method = isEdit ? 'PATCH' : 'POST'
    const body   = isEdit
      ? { pct_mau: pctMau, pct_juani: pctJua }
      : { business_id: bizId, category_id: catId || null, pct_mau: pctMau, pct_juani: pctJua }
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) { setErr(res.status === 409 ? 'Ya existe una regla para este negocio/categoría' : (json.error ?? 'Error')); setSave(false); return }
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade-in" style={{ background: 'rgba(7,9,13,0.85)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 animate-fade-up rounded-sm"
        style={{ background: 'var(--surface)', border: '1px solid var(--border2)', maxWidth: 380, margin: '0 auto', boxShadow: '0 0 60px rgba(0,0,0,0.5)' }}>
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
        <div className="p-5">
          <div className="text-sm font-mono font-semibold uppercase mb-4">{isEdit ? 'EDITAR REGLA' : 'NUEVA REGLA'}</div>
          <div className="space-y-3">
            {isEdit ? (
              <div className="p-3 rounded-sm" style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                <div className="lbl mb-2">APLICADA A</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: (rule.businesses as any)?.color ?? 'var(--accent)' }} />
                  <span className="text-xs font-mono font-medium" style={{ color: 'var(--text)' }}>{(rule.businesses as any)?.name ?? '—'}</span>
                  <span className="lbl">·</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>
                    {rule.category_id ? (rule.categories as any)?.name ?? '—' : 'General (todas las categorías)'}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="lbl mb-1.5">NEGOCIO</div>
                  <select className="ctrl" value={bizId} onChange={e => setBiz(e.target.value)}>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="lbl mb-1.5">CATEGORÍA <span style={{ color: 'var(--text3)' }}>(vacío = general)</span></div>
                  <select className="ctrl" value={catId} onChange={e => setCat(e.target.value)}>
                    <option value="">Todas las categorías (general)</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <div className="lbl mb-2">REPARTO</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="lbl mb-1.5" style={{ color: 'var(--mau)' }}>MAU %</div>
                  <input type="number" className="ctrl" value={pctMau} min="0" max="100" step="1"
                    onChange={e => handleMau(parseFloat(e.target.value)||0)}
                    style={{ fontFamily:'monospace', fontSize:'1.1rem', color:'var(--mau)', borderColor:'rgba(0,255,136,0.3)' }} />
                </div>
                <div>
                  <div className="lbl mb-1.5" style={{ color: 'var(--juani)' }}>JUANI %</div>
                  <input type="number" className="ctrl" value={pctJua} min="0" max="100" step="1"
                    onChange={e => handleJua(parseFloat(e.target.value)||0)}
                    style={{ fontFamily:'monospace', fontSize:'1.1rem', color:'var(--juani)', borderColor:'rgba(0,229,255,0.3)' }} />
                </div>
              </div>
              <div className="flex justify-between mt-2 px-1">
                <span className="lbl">TOTAL</span>
                <span className={`num text-xs font-semibold ${sumOk ? 'num-pos' : 'num-neg'}`}>{pctMau+pctJua}% {sumOk?'✓':'≠ 100%'}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width:`${pctMau}%`, background:'linear-gradient(90deg,var(--mau),var(--juani))' }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="lbl" style={{ color:'var(--mau)' }}>MAU {pctMau}%</span>
                <span className="lbl" style={{ color:'var(--juani)' }}>JUANI {pctJua}%</span>
              </div>
            </div>
            {error && <div className="py-2 px-3 rounded-sm text-xs font-mono text-center" style={{ background:'rgba(255,51,85,0.07)', color:'var(--danger)', border:'1px solid rgba(255,51,85,0.18)' }}>⚠ {error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="btn-ghost flex-1 text-xs">CANCELAR</button>
              <button onClick={save} disabled={saving||!sumOk} className="btn-primary flex-1 text-xs" style={{ opacity:saving||!sumOk?0.6:1 }}>
                {saving ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ══ TAB: CATEGORÍAS ═══════════════════════════════════════
function CategoriasTab() {
  const [cats,    setCats]   = useState<Category[]>([])
  const [loading, setLoad]   = useState(true)
  const [newName, setNew]    = useState('')
  const [saving,  setSaving] = useState(false)
  const [error,   setError]  = useState('')
  const [deleting, setDel]   = useState<string | null>(null)

  async function load() {
    setLoad(true)
    const r = await fetch('/api/categories')
    const j = await r.json()
    setCats(j.data ?? [])
    setLoad(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!newName.trim()) return
    setSaving(true); setError('')
    const res  = await fetch('/api/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error'); setSaving(false); return }
    setNew(''); setSaving(false); invalidateCatalogCache(); load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar la categoría "${name}"?`)) return
    setDel(id)
    const res  = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { alert(json.error ?? 'No se pudo eliminar'); setDel(null); return }
    setDel(null); invalidateCatalogCache(); load()
  }

  return (
    <>
      {/* Agregar */}
      <div className="flex gap-2">
        <input className="ctrl flex-1" placeholder="Nueva categoría…" value={newName}
          onChange={e => { setNew(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && add()} />
        <button onClick={add} disabled={saving || !newName.trim()} className="btn-primary text-xs px-4"
          style={{ opacity: saving || !newName.trim() ? 0.5 : 1 }}>
          {saving ? '…' : '+ ADD'}
        </button>
      </div>
      {error && <div className="text-xs font-mono py-1.5 px-3 rounded-sm" style={{ background:'rgba(255,51,85,0.07)', color:'var(--danger)' }}>⚠ {error}</div>}

      {/* Lista */}
      {loading ? (
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => <div key={i} className="card h-10 animate-pulse" style={{ background:'var(--s2)' }} />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {cats.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2.5 transition-all hover:bg-[var(--s2)]"
              style={{ borderBottom: i === cats.length-1 ? 'none' : '1px solid var(--border)' }}>
              <span className="text-xs font-mono" style={{ color:'var(--text)' }}>{c.name}</span>
              <button onClick={() => remove(c.id, c.name)} className="btn-icon w-6 h-6 text-[10px]"
                style={{ opacity: deleting === c.id ? 0.4 : 1, color:'var(--danger)' }}>
                {deleting === c.id ? '…' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="lbl px-1" style={{ color:'var(--text3)' }}>
        * Solo se pueden eliminar categorías sin movimientos asociados
      </div>
    </>
  )
}

// ══ TAB: NEGOCIOS ══════════════════════════════════════════
const COLORS = ['#00ff88','#00e5ff','#ffb547','#ff3355','#a78bfa','#fb923c','#34d399','#f472b6']

function NegociosTab() {
  const [bizs,    setBizs]   = useState<Business[]>([])
  const [loading, setLoad]   = useState(true)
  const [newName, setNew]    = useState('')
  const [newColor,setColor]  = useState(COLORS[0])
  const [saving,  setSaving] = useState(false)
  const [error,   setError]  = useState('')
  const [editing, setEdit]   = useState<Business | null>(null)
  const [deleting,setDel]    = useState<string | null>(null)

  async function load() {
    setLoad(true)
    const r = await fetch('/api/businesses')
    const j = await r.json()
    setBizs(j.data ?? [])
    setLoad(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!newName.trim()) return
    setSaving(true); setError('')
    const res  = await fetch('/api/businesses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error'); setSaving(false); return }
    setNew(''); setSaving(false); invalidateCatalogCache(); load()
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const res  = await fetch(`/api/businesses/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editing.name, color: editing.color }),
    })
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Error'); setSaving(false); return }
    setEdit(null); setSaving(false); invalidateCatalogCache(); load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar el negocio "${name}"?`)) return
    setDel(id)
    const res  = await fetch(`/api/businesses/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { alert(json.error ?? 'No se pudo eliminar'); setDel(null); return }
    setDel(null); invalidateCatalogCache(); load()
  }

  return (
    <>
      {/* Agregar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input className="ctrl flex-1" placeholder="Nombre del negocio…" value={newName}
            onChange={e => { setNew(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && add()} />
          <button onClick={add} disabled={saving || !newName.trim()} className="btn-primary text-xs px-4"
            style={{ opacity: saving || !newName.trim() ? 0.5 : 1 }}>
            {saving ? '…' : '+ ADD'}
          </button>
        </div>
        {/* Color picker */}
        <div className="flex items-center gap-2">
          <span className="lbl">COLOR:</span>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className="w-5 h-5 rounded-full transition-all"
              style={{ background: c, boxShadow: newColor === c ? `0 0 0 2px var(--surface), 0 0 0 3px ${c}` : 'none' }} />
          ))}
        </div>
      </div>
      {error && <div className="text-xs font-mono py-1.5 px-3 rounded-sm" style={{ background:'rgba(255,51,85,0.07)', color:'var(--danger)' }}>⚠ {error}</div>}

      {/* Lista */}
      {loading ? (
        <div className="space-y-1.5">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-12 animate-pulse" style={{ background:'var(--s2)' }} />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {bizs.map((b, i) => (
            <div key={b.id} style={{ borderBottom: i === bizs.length-1 ? 'none' : '1px solid var(--border)' }}>
              {editing?.id === b.id ? (
                /* Modo edición inline */
                <div className="px-3 py-2.5 space-y-2">
                  <input className="ctrl" value={editing.name}
                    onChange={e => setEdit({ ...editing, name: e.target.value })} />
                  <div className="flex items-center gap-2">
                    <span className="lbl">COLOR:</span>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setEdit({ ...editing, color: c })}
                        className="w-5 h-5 rounded-full transition-all"
                        style={{ background: c, boxShadow: editing.color === c ? `0 0 0 2px var(--surface), 0 0 0 3px ${c}` : 'none' }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEdit(null)} className="btn-ghost flex-1 text-xs">CANCELAR</button>
                    <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 text-xs">
                      {saving ? '…' : 'GUARDAR'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Fila normal */
                <div className="flex items-center gap-3 px-3 py-2.5 transition-all hover:bg-[var(--s2)]">
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: b.color, boxShadow: `0 0 6px ${b.color}` }} />
                  <span className="text-xs font-mono flex-1 font-medium" style={{ color:'var(--text)' }}>{b.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setEdit(b)} className="btn-icon w-6 h-6 text-[10px]">✏</button>
                    <button onClick={() => remove(b.id, b.name)} className="btn-icon w-6 h-6 text-[10px]"
                      style={{ opacity: deleting===b.id ? 0.4:1, color:'var(--danger)' }}>
                      {deleting===b.id ? '…' : '✕'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="lbl px-1" style={{ color:'var(--text3)' }}>
        * Solo se pueden eliminar negocios sin movimientos asociados
      </div>
    </>
  )
}

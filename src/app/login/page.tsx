'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState<'mau' | 'juani' | null>(null)
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Credenciales inválidas'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  function fillUser(who: 'mau' | 'juani') {
    setSelected(who)
    setEmail(who === 'mau' ? 'mauaparo@gmail.com' : 'arqjuanignaciolopez@gmail.com')
    setError('')
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}>

      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      {/* Corner brackets — exchange UI detail */}
      {[['top-8 left-8','border-l border-t'], ['top-8 right-8','border-r border-t'],
        ['bottom-8 left-8','border-l border-b'], ['bottom-8 right-8','border-r border-b']
      ].map(([pos, borders], i) => (
        <div key={i} className={`absolute ${pos} w-6 h-6 ${borders} opacity-20`}
          style={{ borderColor: 'var(--accent)' }} />
      ))}

      {/* Central glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,255,136,0.05) 0%, transparent 65%)' }} />

      <div className="w-full max-w-sm animate-fade-up relative z-10">

        {/* Logo / header */}
        <div className="mb-8">
          {/* Status bar */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 rounded-full animate-blink" style={{ background: 'var(--accent)' }} />
            <span className="lbl" style={{ color: 'var(--text3)' }}>SISTEMA OPERATIVO · V2.0</span>
          </div>

          <div className="font-mono text-3xl font-semibold tracking-tight mb-1">
            FREE<span style={{ color: 'var(--accent)' }}>HOUSE</span>
          </div>
          <div className="lbl" style={{ color: 'var(--text3)' }}>
            GESTIÓN FINANCIERA · S.A.
          </div>
        </div>

        {/* Panel */}
        <div className="card ticker-strip relative">
          {/* Inner panel glow */}
          <div className="absolute inset-0 rounded-lg pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,255,136,0.04) 0%, transparent 60%)' }} />

          <div className="p-5 relative">

            {/* Account select */}
            <div className="mb-5">
              <div className="lbl mb-3">SELECCIONAR CUENTA</div>
              <div className="grid grid-cols-2 gap-2">
                {(['mau', 'juani'] as const).map(who => {
                  const isSel = selected === who
                  const color = who === 'mau' ? 'var(--mau)' : 'var(--juani)'
                  const rgb   = who === 'mau' ? '0,255,136' : '0,229,255'
                  return (
                    <button
                      key={who}
                      onClick={() => fillUser(who)}
                      className="p-3 rounded-md border text-left transition-all duration-150 relative overflow-hidden"
                      style={{
                        background:   isSel ? `rgba(${rgb},0.06)` : 'var(--s2)',
                        borderColor:  isSel ? color : 'var(--border)',
                        boxShadow:    isSel ? `0 0 16px rgba(${rgb},0.15)` : 'none',
                      }}
                    >
                      {isSel && (
                        <div className="absolute top-0 left-0 right-0 h-px"
                          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                      )}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: `rgba(${rgb},0.12)`, color, fontFamily: 'monospace' }}>
                          {who === 'mau' ? 'MA' : 'JU'}
                        </div>
                        <div>
                          <div className="text-sm font-medium" style={{ color: isSel ? color : 'var(--text)' }}>
                            {who === 'mau' ? 'Mau' : 'Juani'}
                          </div>
                          <div className="lbl" style={{ color: isSel ? color : 'var(--text3)', opacity: 0.7 }}>
                            PARTNER
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="divider mb-5" />

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <div className="lbl mb-1.5">EMAIL</div>
                <input type="email" className="ctrl" placeholder="cuenta@freehouse.com"
                  value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                  autoComplete="email" required />
              </div>

              <div>
                <div className="lbl mb-1.5">CONTRASEÑA</div>
                <input type="password" className="ctrl" placeholder="••••••••"
                  value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                  autoComplete="current-password" required />
              </div>

              {error && (
                <div className="py-2 px-3 rounded-md text-xs text-center animate-fade-in font-mono"
                  style={{ background: 'rgba(255,51,85,0.07)', color: 'var(--danger)',
                    border: '1px solid rgba(255,51,85,0.18)' }}>
                  ⚠ {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full h-11 mt-1">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    AUTENTICANDO…
                  </span>
                ) : 'INGRESAR →'}
              </button>
            </form>

          </div>
        </div>

        {/* Bottom status */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <span className="lbl" style={{ color: 'var(--text3)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
              style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
            CONEXIÓN SEGURA
          </span>
          <span className="lbl" style={{ color: 'var(--border2)' }}>·</span>
          <span className="lbl" style={{ color: 'var(--text3)' }}>SUPABASE AUTH</span>
        </div>

      </div>
    </div>
  )
}

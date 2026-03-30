'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/hooks/useTheme'

interface Props { name: string; initial: string; isMau: boolean }

export default function TopBar({ name, initial, isMau }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const { theme, toggle } = useTheme()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const color = isMau ? 'var(--mau)' : 'var(--juani)'
  const rgb   = isMau ? '0,201,110' : '0,153,204'
  const isDark = theme === 'dark'

  return (
    <header
      className="flex items-center justify-between px-4 h-11 flex-shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 rounded-sm"
          style={{ background: 'var(--accent)', boxShadow: isDark ? '0 0 8px var(--accent)' : 'none' }} />
        <span className="font-mono text-sm font-semibold tracking-wide" style={{ color: 'var(--text)' }}>
          FREE<span style={{ color: 'var(--accent)' }}>HOUSE</span>
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-md flex items-center justify-center transition-all"
          style={{
            background: 'var(--s2)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
          }}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDark ? (
            /* Sol — modo claro */
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
          ) : (
            /* Luna — modo oscuro */
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Account + logout */}
        <button
          onClick={logout}
          className="flex items-center gap-2 py-1 px-2 rounded-md transition-all hover:opacity-80"
          style={{ border: '1px solid var(--border)' }}
        >
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
            style={{ background: `rgba(${rgb},0.12)`, color, fontFamily: 'monospace' }}
          >
            {initial}
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>
            {name.toUpperCase()}
          </span>
          <span className="lbl" style={{ color: 'var(--text3)' }}>SALIR</span>
        </button>
      </div>
    </header>
  )
}

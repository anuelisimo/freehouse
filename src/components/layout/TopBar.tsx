'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props { name: string; initial: string; isMau: boolean }

export default function TopBar({ name, initial, isMau }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const color = isMau ? 'var(--mau)' : 'var(--juani)'
  const rgb   = isMau ? '0,255,136' : '0,229,255'

  return (
    <header className="flex items-center justify-between px-4 h-11 flex-shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>

      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 rounded-sm" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
        <span className="font-mono text-sm font-semibold tracking-wide">
          FREE<span style={{ color: 'var(--accent)' }}>HOUSE</span>
        </span>
      </div>

      {/* Right: account + logout */}
      <button onClick={logout}
        className="flex items-center gap-2 py-1 px-2 rounded-md transition-all hover:opacity-80"
        style={{ border: '1px solid var(--border)' }}>
        <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
          style={{ background: `rgba(${rgb},0.12)`, color, fontFamily: 'monospace' }}>
          {initial}
        </div>
        <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>{name.toUpperCase()}</span>
        <span className="lbl" style={{ color: 'var(--text3)' }}>SALIR</span>
      </button>
    </header>
  )
}

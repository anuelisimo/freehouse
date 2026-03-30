'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard',   label: 'OVERVIEW', icon: IconOverview },
  { href: '/movimientos', label: 'TRADES',   icon: IconTrades },
  { href: '/plantillas',  label: 'PLANS',    icon: IconPlans },
  { href: '/reglas',      label: 'RULES',    icon: IconRules },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="flex-shrink-0 pb-safe"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
      <div className="flex">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-all"
              style={{ color: active ? 'var(--accent)' : 'var(--text3)' }}>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
              )}
              <Icon active={active} />
              <span className="lbl" style={{
                color: active ? 'var(--accent)' : 'var(--text3)',
                fontSize: '0.6rem',
              }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function IconOverview({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text3)'
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth="1.5">
      <rect x="3" y="13" width="4" height="8" rx="0.5"/><rect x="10" y="9" width="4" height="12" rx="0.5"/>
      <rect x="17" y="5" width="4" height="16" rx="0.5"/>
    </svg>
  )
}
function IconTrades({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text3)'
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth="1.5">
      <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/>
    </svg>
  )
}
function IconPlans({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text3)'
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="1"/>
      <path d="M8 7h8M8 11h8M8 15h5"/>
    </svg>
  )
}
function IconRules({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text3)'
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
    </svg>
  )
}

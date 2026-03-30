import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Cargar profile del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const name = profile?.name ?? user.email?.split('@')[0] ?? '?'
  const initial = name[0]?.toUpperCase() ?? '?'
  const isMau = name.toLowerCase().includes('mau')

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'var(--bg)' }}>
      <TopBar name={name} initial={initial} isMau={isMau} />
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

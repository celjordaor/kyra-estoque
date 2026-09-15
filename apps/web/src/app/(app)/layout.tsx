import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@kyra/database'
import { AppShell } from '@/components/layout/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single()

  const profile = profileData as {
    full_name: string | null
    role: string | null
    avatar_url: string | null
  } | null

  const shellUser = {
    name: profile?.full_name ?? user.email ?? 'Usuário',
    email: user.email ?? '',
    role: profile?.role ?? undefined,
    avatarUrl: profile?.avatar_url ?? undefined,
  }

  return (
    <AppShell user={shellUser}>
      {children}
    </AppShell>
  )
}

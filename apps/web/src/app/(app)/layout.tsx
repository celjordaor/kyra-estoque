import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { AppShell } from '@/components/layout/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Buscar perfil via admin client para não ser bloqueado por RLS de is_active
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any)
    .from('profiles')
    .select('full_name, role, avatar_url, company_id, is_active')
    .eq('id', user.id)
    .single()

  const profile = profileData as {
    full_name: string | null
    role: string | null
    avatar_url: string | null
    company_id: string | null
    is_active: boolean
  } | null

  // Usuário sem empresa vinculada → não pode usar o app
  if (!profile?.company_id) {
    redirect('/login?error=no_company')
  }

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

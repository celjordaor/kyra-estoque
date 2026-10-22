import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { AppShell } from '@/components/layout/app-shell'
import { statusGrantsAccess } from '@kyra/business-rules'

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
    .select('full_name, role, avatar_url, company_id, is_active, is_super_admin')
    .eq('id', user.id)
    .single()

  const profile = profileData as {
    full_name: string | null
    role: string | null
    avatar_url: string | null
    company_id: string | null
    is_active: boolean
    is_super_admin: boolean | null
  } | null

  // Usuário sem empresa vinculada → não pode usar o app
  if (!profile?.company_id) {
    redirect('/login?error=no_company')
  }

  // Usuário desativado → bloquear acesso (ex-funcionário removido da empresa)
  if (profile?.is_active === false) {
    redirect('/login?error=account_inactive')
  }

  // Assinatura sem acesso (teste vencido, suspensa por inadimplência, cancelada):
  // o usuário entra, mas só vê a tela de planos e o perfil.
  if (!profile.is_super_admin) {
    const pathname = (await headers()).get('x-pathname') ?? ''
    const free = pathname.startsWith('/subscribe') || pathname.startsWith('/profile')
    if (!free) {
      const { data: sub } = await (admin as any)
        .from('subscriptions').select('status, trial_ends_at')
        .eq('company_id', profile.company_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (sub && !statusGrantsAccess(sub.status, sub.trial_ends_at)) redirect('/subscribe' as never)
    }
  }

  const shellUser = {
    name: profile?.full_name ?? user.email ?? 'Usuário',
    email: user.email ?? '',
    role: profile?.role ?? undefined,
    avatarUrl: profile?.avatar_url ?? undefined,
  }

  // Buscar contagem de notificações não-lidas para o sino do topbar
  const { count: notificationCount } = await (admin as any)
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .eq('read', false)

  return (
    <AppShell user={shellUser} notificationCount={notificationCount ?? 0}>
      {children}
    </AppShell>
  )
}

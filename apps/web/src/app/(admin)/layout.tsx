import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminSupabaseClient()
  const { data: profileData } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const profile = profileData as { is_super_admin: boolean } | null

  if (!profile?.is_super_admin) redirect('/dashboard')

  return <>{children}</>
}

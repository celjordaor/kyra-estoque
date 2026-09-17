import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { ProfileClient } from './profile-client'

export const metadata: Metadata = { title: 'Meu perfil | Kyra Estoque' }

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const { data: profileData } = await admin
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single()
  const profile = profileData as { full_name: string | null; role: string | null; avatar_url: string | null } | null

  return (
    <ProfileClient
      email={user.email ?? ''}
      fullName={profile?.full_name ?? ''}
      role={profile?.role ?? null}
    />
  )
}

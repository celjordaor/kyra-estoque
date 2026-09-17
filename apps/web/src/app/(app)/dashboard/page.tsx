import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { getDashboardData } from '@/lib/actions/dashboard'
import { DashboardClient } from '@/components/domain/dashboard/dashboard-client'
import { DashboardLoadingSkeleton } from '@/components/domain/dashboard/dashboard-states'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Dashboard',
}

async function DashboardContent() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  let userName = 'usuário'
  let companyId: string | null = null
  if (user) {
    const admin = createAdminSupabaseClient()
    const { data: profileData } = await admin
      .from('profiles')
      .select('full_name, company_id')
      .eq('id', user.id)
      .single()
    const profile = profileData as { full_name: string | null; company_id?: string | null } | null
    if (profile?.full_name) userName = profile.full_name
    companyId = (profile as any)?.company_id ?? null
  }

  const { data, error } = await getDashboardData()

  return (
    <DashboardClient
      initialData={data}
      initialError={error}
      userName={userName}
      companyId={companyId}
    />
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

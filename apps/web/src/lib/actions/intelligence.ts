'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { revalidatePath } from 'next/cache'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any)
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()
  const profile = profileData as { company_id: string | null; role: string } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id as string, myRole: profile.role, userId: user.id }
}

export interface KyraConfig {
  persona_name: string
  tone: 'formal' | 'friendly' | 'neutral'
  custom_instructions: string
  enabled_modules: string[]
  auto_suggestions: boolean
  language: string
}

const DEFAULT_CONFIG: KyraConfig = {
  persona_name: 'Kyra',
  tone: 'friendly',
  custom_instructions: '',
  enabled_modules: ['stock', 'sales', 'products'],
  auto_suggestions: true,
  language: 'pt-BR',
}

export async function getKyraConfig(): Promise<KyraConfig> {
  try {
    const { admin, companyId } = await getServerContext()
    const { data } = await (admin as any)
      .from('companies')
      .select('kyra_config')
      .eq('id', companyId)
      .single()
    return { ...DEFAULT_CONFIG, ...(data?.kyra_config ?? {}) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function updateKyraConfig(
  config: Partial<KyraConfig>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }

    const { data: current } = await (admin as any)
      .from('companies')
      .select('kyra_config')
      .eq('id', companyId)
      .single()

    const merged = { ...(current?.kyra_config ?? {}), ...config }

    const { error } = await (admin as any)
      .from('companies')
      .update({ kyra_config: merged })
      .eq('id', companyId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

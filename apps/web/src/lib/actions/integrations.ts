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
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id, myRole: profile.role }
}

export type IntegrationType = 'asaas' | 'whatsapp' | 'shopify' | 'mercadolivre' | 'woocommerce'

export interface Integration {
  type: IntegrationType
  is_active: boolean
  config: Record<string, string>
}

export async function getIntegrations(): Promise<Integration[]> {
  try {
    const { admin, companyId } = await getServerContext()
    const { data } = await admin
      .from('company_integrations')
      .select('type, is_active, config')
      .eq('company_id', companyId)
    return (data ?? []) as Integration[]
  } catch {
    return []
  }
}

export async function upsertIntegration(
  type: IntegrationType,
  config: Record<string, string>,
  is_active: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }

    const { error } = await admin
      .from('company_integrations')
      .upsert(
        { company_id: companyId, type, config, is_active },
        { onConflict: 'company_id,type' },
      )
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

export async function toggleIntegration(
  type: IntegrationType,
  is_active: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }

    const { error } = await admin
      .from('company_integrations')
      .update({ is_active })
      .eq('company_id', companyId)
      .eq('type', type)
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

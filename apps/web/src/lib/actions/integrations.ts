'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

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
  return { supabase, admin, companyId: profile.company_id as string, myRole: profile.role }
}

export type IntegrationType = 'asaas' | 'whatsapp'

export interface Integration {
  type: IntegrationType
  is_active: boolean
  config: Record<string, string>
}

const SECRET_KEYS = ['api_key', 'token']
const MASK = '••••••••'

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kyraestoque.com.br').replace(/\/$/, '')
}

/** Segredos nunca voltam para o navegador: só uma máscara. Apenas owner/admin veem a config. */
export async function getIntegrations(): Promise<Integration[]> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    const { data } = await (admin as any)
      .from('company_integrations')
      .select('type, is_active, config')
      .eq('company_id', companyId)
      .in('type', ['asaas', 'whatsapp'])
    const isAdmin = ['owner', 'admin'].includes(myRole)
    return ((data ?? []) as Integration[]).map(i => {
      if (!isAdmin) return { ...i, config: {} }
      const config: Record<string, string> = { ...i.config }
      for (const k of SECRET_KEYS) if (config[k]) config[k] = MASK
      if (i.type === 'asaas') config.webhook_url = `${appUrl()}/api/webhooks/asaas/tenant/${companyId}`
      return { ...i, config }
    })
  } catch {
    return []
  }
}

export async function upsertIntegration(
  type: IntegrationType,
  incoming: Record<string, string>,
  is_active: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }

    const { data: current } = await (admin as any)
      .from('company_integrations')
      .select('config')
      .eq('company_id', companyId)
      .eq('type', type)
      .maybeSingle()
    const prev = ((current?.config ?? {}) as Record<string, string>)

    // Campos mascarados/vazios mantêm o valor salvo; webhook_url é derivado (não persiste)
    const config: Record<string, string> = { ...prev }
    for (const [k, v] of Object.entries(incoming)) {
      if (k === 'webhook_url') continue
      if (SECRET_KEYS.includes(k) && (!v || v === MASK)) continue
      config[k] = v
    }
    if (type === 'asaas') {
      if (!config.api_key) return { success: false, error: 'Informe a chave de API do Asaas.' }
      config.environment = config.environment === 'production' ? 'production' : 'sandbox'
      if (!config.webhook_token) config.webhook_token = randomBytes(24).toString('hex')
    }

    const { error } = await (admin as any)
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

    const { error } = await (admin as any)
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

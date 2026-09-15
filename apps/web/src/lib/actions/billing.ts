'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await admin.from('profiles').select('company_id').eq('id', user.id).single()
  const profile = profileData as { company_id: string | null } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id, userId: user.id }
}

// ── Types ──────────────────────────────────────────────────────

export interface SubscriptionUsageItem {
  label: string
  current: number
  limit: number | null
}

export interface SubscriptionInfo {
  planId: string
  planName: string
  planSlug: string
  status: string
  trialEndsAt: string | null
  trialDaysLeft: number | null
  periodStart: string
  periodEnd: string
  usage: SubscriptionUsageItem[]
  features: Record<string, boolean>
}

// ── Actions ────────────────────────────────────────────────────

export async function getSubscriptionInfo(): Promise<SubscriptionInfo | null> {
  try {
    console.log('[billing] step 1: getServerContext')
    const { admin, companyId } = await getServerContext()
    console.log('[billing] step 2: companyId =', companyId)

    const { data: sub, error: subErr } = await admin
      .from('subscriptions')
      .select(`
        id, plan_id, status, trial_ends_at, current_period_start, current_period_end,
        plans (
          id, name, slug,
          plan_entitlements ( feature_key, int_value, bool_value )
        )
      `)
      .eq('company_id', companyId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log('[billing] step 3: sub =', JSON.stringify(sub), 'err =', subErr?.message)

    if (!sub) return null

    const plan = sub.plans as {
      id: string; name: string; slug: string
      plan_entitlements: { feature_key: string; int_value: number | null; bool_value: boolean | null }[]
    } | null

    console.log('[billing] step 4: plan =', plan?.name, 'entitlements =', plan?.plan_entitlements?.length)

    const entMap: Record<string, { int_value: number | null; bool_value: boolean | null }> = {}
    for (const e of plan?.plan_entitlements ?? []) {
      entMap[e.feature_key] = { int_value: e.int_value, bool_value: e.bool_value }
    }

    console.log('[billing] step 5: entMap financial.enabled =', entMap['financial.enabled'])

    const [{ count: productCount }, { count: userCount }] = await Promise.all([
      admin.from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
    ])

    console.log('[billing] step 6: productCount =', productCount, 'userCount =', userCount)

    let trialDaysLeft: number | null = null
    if (sub.status === 'trialing' && sub.trial_ends_at) {
      const diff = new Date(sub.trial_ends_at).getTime() - Date.now()
      trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    const usage: SubscriptionUsageItem[] = [
      { label: 'Produtos', current: productCount ?? 0, limit: entMap['products.max']?.int_value ?? null },
      { label: 'Usuários', current: userCount ?? 0, limit: entMap['users.max']?.int_value ?? null },
      { label: 'Canais', current: 0, limit: entMap['channels.max']?.int_value ?? null },
      { label: 'Automações', current: 0, limit: entMap['automations.max']?.int_value ?? null },
    ]

    const features: Record<string, boolean> = {
      'PDV Avançado': entMap['pdv.advanced.enabled']?.bool_value ?? false,
      'Canais Avançados': entMap['channels.advanced.enabled']?.bool_value ?? false,
      'Automações Avançadas': entMap['automations.advanced.enabled']?.bool_value ?? false,
      'Compras Avançadas': entMap['purchasing.advanced.enabled']?.bool_value ?? false,
      'WhatsApp Operacional': entMap['whatsapp.operational.enabled']?.bool_value ?? false,
      'IA Avançada': entMap['ai.advanced.enabled']?.bool_value ?? false,
      'Multi-estoque': entMap['multi_stock.enabled']?.bool_value ?? false,
      'Relatórios Avançados': entMap['reports.advanced.enabled']?.bool_value ?? false,
      'Financeiro': entMap['financial.enabled']?.bool_value ?? false,
    }

    const result: SubscriptionInfo = {
      planId: sub.plan_id,
      planName: plan?.name ?? '',
      planSlug: plan?.slug ?? '',
      status: sub.status,
      trialEndsAt: sub.trial_ends_at,
      trialDaysLeft,
      periodStart: sub.current_period_start,
      periodEnd: sub.current_period_end,
      usage,
      features,
    }

    console.log('[billing] step 7: returning result planName =', result.planName)
    return result
  } catch (err) {
    console.error('[billing] getSubscriptionInfo ERRO:', err)
    return null
  }
}

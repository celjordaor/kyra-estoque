'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any).from('profiles').select('company_id').eq('id', user.id).single()
  const profile = profileData as { company_id: string | null } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id as string, userId: user.id }
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
    const { admin, companyId } = await getServerContext()
    const { data: sub, error: subErr } = await (admin as any)
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


    if (!sub) return null

    const plan = sub.plans as {
      id: string; name: string; slug: string
      plan_entitlements: { feature_key: string; int_value: number | null; bool_value: boolean | null }[]
    } | null
    const entMap: Record<string, { int_value: number | null; bool_value: boolean | null }> = {}
    for (const e of plan?.plan_entitlements ?? []) {
      entMap[e.feature_key] = { int_value: e.int_value, bool_value: e.bool_value }
    }
    const [{ count: productCount }, { count: userCount }] = await Promise.all([
      (admin as any).from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      (admin as any).from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
    ])
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
    return result
  } catch (err) {
    console.error('[billing] getSubscriptionInfo ERRO:', err)
    return null
  }
}

// ── Invoice History ────────────────────────────────────────────

export interface InvoiceItem {
  id: string
  dueDate: string
  paidAt: string | null
  amountCents: number
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED'
  billingType: string
  invoiceUrl: string | null
  bankSlipUrl: string | null
}

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3'

async function asaasFetch(path: string) {
  const apiKey = process.env.ASAAS_API_KEY
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurado')
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Asaas ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getInvoiceHistory(): Promise<InvoiceItem[]> {
  try {
    const { admin, companyId } = await getServerContext()
    const { data: sub } = await (admin as any)
      .from('subscriptions')
      .select('provider, provider_subscription_id')
      .eq('company_id', companyId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub || sub.provider !== 'asaas' || !sub.provider_subscription_id) return []

    const data = await asaasFetch(`/subscriptions/${sub.provider_subscription_id}/payments?limit=12&offset=0`)
    const payments: Record<string, unknown>[] = data?.data ?? []

    const statusMap: Record<string, InvoiceItem['status']> = {
      PENDING: 'PENDING', RECEIVED: 'RECEIVED', CONFIRMED: 'CONFIRMED',
      OVERDUE: 'OVERDUE', REFUNDED: 'REFUNDED', CANCELLED: 'CANCELLED',
      REFUND_REQUESTED: 'REFUNDED', CHARGEBACK_REQUESTED: 'CANCELLED',
      DUNNING_REQUESTED: 'OVERDUE', DUNNING_RECEIVED: 'RECEIVED',
      AWAITING_RISK_ANALYSIS: 'PENDING',
    }

    return payments.map(p => ({
      id:          p.id as string,
      dueDate:     p.dueDate as string,
      paidAt:      (p.paymentDate ?? null) as string | null,
      amountCents: Math.round(((p.value as number) ?? 0) * 100),
      status:      statusMap[p.status as string] ?? 'PENDING',
      billingType: (p.billingType as string) ?? '',
      invoiceUrl:  (p.invoiceUrl ?? null) as string | null,
      bankSlipUrl: (p.bankSlipUrl ?? null) as string | null,
    }))
  } catch (err) {
    console.error('[billing] getInvoiceHistory ERRO:', err)
    return []
  }
}

export async function getBillingPortalUrl(): Promise<string | null> {
  try {
    const { admin, companyId } = await getServerContext()
    const { data: sub } = await (admin as any)
      .from('subscriptions')
      .select('provider, provider_subscription_id')
      .eq('company_id', companyId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub || sub.provider !== 'asaas' || !sub.provider_subscription_id) return null

    // Busca o pagamento mais recente pendente ou vencido para retornar o link de cobrança
    const data = await asaasFetch(`/subscriptions/${sub.provider_subscription_id}/payments?limit=1&offset=0`)
    const payment = (data?.data ?? [])[0] as Record<string, unknown> | undefined
    return (payment?.invoiceUrl ?? payment?.bankSlipUrl ?? null) as string | null
  } catch (err) {
    console.error('[billing] getBillingPortalUrl ERRO:', err)
    return null
  }
}

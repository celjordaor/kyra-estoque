/**
 * Entitlement Service — Sprint 10b
 *
 * Todas as verificações de permissão de features e limites de uso
 * passam por aqui. NUNCA faça `if plan === '...'` no código:
 * use `hasFeature()` ou `canUse()`.
 *
 * Regras fundamentais:
 *  - int_value NULL  → ilimitado (getLimit retorna null)
 *  - int_value 0     → bloqueado
 *  - Sempre usa admin client (service role) — chamado server-side
 */

import { createAdminSupabaseClient } from '@kyra/database/server'
import type {
  PlanEntitlementRow,
  SubscriptionStatus,
} from '@kyra/database'

// ─── Tipos públicos ───────────────────────────────────────────

export interface EntitlementResult {
  allowed: boolean
  featureKey: string
  /** Uso atual no período */
  current: number
  /** null = ilimitado; 0 = bloqueado */
  limit: number | null
}

export interface CompanyEntitlements {
  subscriptionId: string
  planId: string
  planName: string
  status: SubscriptionStatus
  trialEndsAt: string | null
  periodStart: string
  periodEnd: string
  /** Mapa feature_key → entitlement */
  entitlements: Record<
    string,
    Pick<PlanEntitlementRow, 'int_value' | 'bool_value' | 'str_value'>
  >
}

// ─── Helpers internos ─────────────────────────────────────────

/**
 * Busca a assinatura ativa mais recente com todos os entitlements do plano.
 * Retorna null se não houver assinatura válida.
 */
async function fetchActiveSubscription(companyId: string) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await (supabase as any)
    .from('subscriptions')
    .select(
      `
      id,
      plan_id,
      status,
      trial_ends_at,
      current_period_start,
      current_period_end,
      plans (
        name,
        plan_entitlements (
          feature_key,
          int_value,
          bool_value,
          str_value
        )
      )
    `
    )
    .eq('company_id', companyId)
    .in('status', ['active', 'trialing', 'past_due'] satisfies SubscriptionStatus[])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as any
}


// ─── Override helpers ─────────────────────────────────────────

/**
 * Busca override ativo para um company + feature_key.
 * Retorna null se não houver override ou se estiver expirado.
 */
async function fetchActiveOverride(
  companyId: string,
  featureKey: string
): Promise<Pick<{ int_value: number | null; bool_value: boolean | null; str_value: string | null }, 'int_value' | 'bool_value' | 'str_value'> | null> {
  const supabase = createAdminSupabaseClient()
  const { data } = await (supabase as any)
    .from('tenant_entitlement_overrides')
    .select('int_value, bool_value, str_value, expires_at')
    .eq('company_id', companyId)
    .eq('feature_key', featureKey)
    .maybeSingle()

  if (!data) return null
  // Verificar expiração
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null
  return { int_value: data.int_value, bool_value: data.bool_value, str_value: data.str_value }
}

/**
 * Verifica se uma feature está tecnicamente disponível via feature_flags.
 * Retorna true se a tabela não existir ainda ou se a feature não estiver cadastrada
 * (fail-open para features não mapeadas).
 */
async function isFeatureTechnicallyAvailable(featureKey: string): Promise<boolean> {
  try {
    const supabase = createAdminSupabaseClient()
    const { data } = await (supabase as any)
      .from('feature_flags')
      .select('commercial_enabled, technical_status')
      .eq('feature_key', featureKey)
      .maybeSingle()
    if (!data) return true // não cadastrado = fail-open
    return data.commercial_enabled && data.technical_status === 'available'
  } catch {
    return true // tabela ainda não existe = fail-open
  }
}

// ─── API pública ──────────────────────────────────────────────

/**
 * Retorna todos os entitlements da assinatura ativa de uma empresa,
 * incluindo nome do plano e período corrente.
 */
export async function getCompanyEntitlements(
  companyId: string
): Promise<CompanyEntitlements | null> {
  const subscription = await fetchActiveSubscription(companyId)
  if (!subscription) return null

  // Supabase retorna join como objeto (relação 1:1 com planos)
  const plan = subscription.plans as {
    name: string
    plan_entitlements: Pick<PlanEntitlementRow, 'feature_key' | 'int_value' | 'bool_value' | 'str_value'>[]
  } | null

  const entitlements: CompanyEntitlements['entitlements'] = {}
  for (const ent of plan?.plan_entitlements ?? []) {
    entitlements[ent.feature_key] = {
      int_value: ent.int_value,
      bool_value: ent.bool_value,
      str_value: ent.str_value,
    }
  }

  return {
    subscriptionId: subscription.id,
    planId: subscription.plan_id,
    planName: plan?.name ?? '',
    status: subscription.status as SubscriptionStatus,
    trialEndsAt: subscription.trial_ends_at,
    periodStart: subscription.current_period_start,
    periodEnd: subscription.current_period_end,
    entitlements,
  }
}

/**
 * Verifica se uma empresa tem acesso a uma feature booleana.
 *
 * Para features de contagem (ex: `max_products`), use `canUse()`.
 */
export async function hasFeature(
  companyId: string,
  featureKey: string
): Promise<boolean> {
  // 1. Verificar feature flag técnica (commercial_enabled + technical_status)
  const techAvailable = await isFeatureTechnicallyAvailable(featureKey)
  if (!techAvailable) return false

  // 2. Override por tenant tem prioridade sobre o plano
  const override = await fetchActiveOverride(companyId, featureKey)
  if (override) {
    if (override.bool_value !== null) return override.bool_value
    if (override.int_value !== null) return override.int_value !== 0
    if (override.str_value !== null) return true
  }

  // 3. Fallback: entitlement do plano
  const entitlements = await getCompanyEntitlements(companyId)
  if (!entitlements) return false

  const ent = entitlements.entitlements[featureKey]
  if (!ent) return false

  if (ent.bool_value !== null) return ent.bool_value
  if (ent.int_value !== null) return ent.int_value !== 0
  if (ent.str_value !== null) return true

  return false
}

/**
 * Retorna o limite numérico para uma métrica de contagem.
 *
 * - `null`  → ilimitado
 * - `0`     → bloqueado
 * - `N > 0` → limite máximo
 *
 * Retorna `0` (bloqueado) se não houver assinatura ou a feature não
 * constar no plano.
 */
export async function getLimit(
  companyId: string,
  metricKey: string
): Promise<number | null> {
  // Override por tenant tem prioridade
  const override = await fetchActiveOverride(companyId, metricKey)
  if (override && override.int_value !== undefined) {
    return override.int_value // NULL = ilimitado, 0 = bloqueado, N = limite
  }

  // Fallback: entitlement do plano
  const entitlements = await getCompanyEntitlements(companyId)
  if (!entitlements) return 0

  const ent = entitlements.entitlements[metricKey]
  if (!ent) return 0

  return ent.int_value
}

/**
 * Retorna o uso atual de uma métrica no período de faturamento corrente.
 */
export async function getUsage(
  companyId: string,
  metricKey: string
): Promise<number> {
  const entitlements = await getCompanyEntitlements(companyId)
  if (!entitlements) return 0

  const supabase = createAdminSupabaseClient()

  const { data } = await (supabase as any)
    .from('usage_counters')
    .select('current_value')
    .eq('company_id', companyId)
    .eq('metric_key', metricKey)
    .eq('period_start', entitlements.periodStart)
    .eq('period_end', entitlements.periodEnd)
    .maybeSingle()

  return data?.current_value ?? 0
}

/**
 * Verifica se uma empresa pode utilizar uma unidade adicional de uma
 * métrica de contagem (ex: cadastrar mais um produto).
 *
 * Retorna `{ allowed, featureKey, current, limit }`.
 * Consulte `allowed` antes de prosseguir com a operação.
 */
export async function canUse(
  companyId: string,
  metricKey: string
): Promise<EntitlementResult> {
  const [limit, current] = await Promise.all([
    getLimit(companyId, metricKey),
    getUsage(companyId, metricKey),
  ])

  // null = ilimitado → sempre permitido
  const allowed = limit === null || current < limit

  return {
    allowed,
    featureKey: metricKey,
    current,
    limit,
  }
}

/**
 * Incrementa atomicamente o contador de uso de uma métrica no período
 * de faturamento corrente.
 *
 * Delega ao RPC `increment_usage_counter` (upsert atômico no banco).
 * Lança erro se não houver assinatura ativa.
 *
 * IMPORTANTE: chame `canUse()` antes de `incrementUsage()` para não
 * ultrapassar o limite silenciosamente.
 */
export async function incrementUsage(
  companyId: string,
  metricKey: string,
  amount = 1
): Promise<void> {
  const entitlements = await getCompanyEntitlements(companyId)
  if (!entitlements) {
    throw new Error(`[EntitlementService] Sem assinatura ativa para empresa ${companyId}`)
  }

  const supabase = createAdminSupabaseClient()

  const { error } = await (supabase as any).rpc('increment_usage_counter' as any, {
    p_company_id: companyId,
    p_metric_key: metricKey,
    p_period_start: entitlements.periodStart,
    p_period_end: entitlements.periodEnd,
    p_amount: amount,
  } as any)

  if (error) {
    throw new Error(`[EntitlementService] Falha ao incrementar uso de "${metricKey}": ${error.message}`)
  }
}

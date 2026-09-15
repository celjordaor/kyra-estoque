'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { revalidatePath } from 'next/cache'

// ── Auth: verificar super admin ───────────────────────────────
async function requireSuperAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_super_admin) throw new Error('Acesso restrito')
  return { admin, userId: user.id }
}

// ── Types ──────────────────────────────────────────────────────
export interface TenantRow {
  id: string
  name: string
  slug: string
  email: string | null
  is_active: boolean
  created_at: string
  plan_name: string | null
  plan_slug: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  user_count: number
  product_count: number
}

export interface LeadRow {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  employees: string | null
  message: string | null
  source: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  notes: string | null
  created_at: string
}

export interface SupportTicketRow {
  id: string
  company_name: string | null
  user_email: string | null
  subject: string
  category: string
  priority: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  admin_notes: string | null
  created_at: string
  resolved_at: string | null
}

export interface AdminStats {
  total_tenants: number
  active_subscriptions: number
  trialing: number
  mrr_cents: number
  open_tickets: number
  new_leads: number
}

// ── Tenants ────────────────────────────────────────────────────
export async function getAdminTenants(): Promise<TenantRow[]> {
  const { admin } = await requireSuperAdmin()

  const { data: companies } = await admin
    .from('companies')
    .select('id, name, slug, email, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!companies?.length) return []

  // Buscar subscriptions em paralelo
  const companyIds = companies.map(c => c.id)

  const [{ data: subs }, { data: profileCounts }, { data: productCounts }] = await Promise.all([
    admin
      .from('subscriptions')
      .select('company_id, status, trial_ends_at, plans(name, slug)')
      .in('company_id', companyIds)
      .in('status', ['active', 'trialing', 'past_due']),
    admin
      .from('profiles')
      .select('company_id')
      .in('company_id', companyIds)
      .eq('is_active', true),
    admin
      .from('products')
      .select('company_id')
      .in('company_id', companyIds)
      .eq('is_active', true),
  ])

  // Agrupar contagens
  const subMap = new Map<string, { status: string; trial_ends_at: string | null; plan_name: string | null; plan_slug: string | null }>()
  for (const s of subs ?? []) {
    const plan = s.plans as { name: string; slug: string } | null
    subMap.set(s.company_id, {
      status: s.status,
      trial_ends_at: s.trial_ends_at,
      plan_name: plan?.name ?? null,
      plan_slug: plan?.slug ?? null,
    })
  }

  const userCountMap = new Map<string, number>()
  for (const p of profileCounts ?? []) {
    userCountMap.set(p.company_id, (userCountMap.get(p.company_id) ?? 0) + 1)
  }
  const productCountMap = new Map<string, number>()
  for (const p of productCounts ?? []) {
    productCountMap.set(p.company_id, (productCountMap.get(p.company_id) ?? 0) + 1)
  }

  return companies.map(c => {
    const sub = subMap.get(c.id)
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      email: c.email,
      is_active: c.is_active,
      created_at: c.created_at,
      plan_name: sub?.plan_name ?? null,
      plan_slug: sub?.plan_slug ?? null,
      subscription_status: sub?.status ?? null,
      trial_ends_at: sub?.trial_ends_at ?? null,
      user_count: userCountMap.get(c.id) ?? 0,
      product_count: productCountMap.get(c.id) ?? 0,
    }
  })
}

export async function toggleTenantActive(
  companyId: string,
  is_active: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin } = await requireSuperAdmin()
    const { error } = await admin.from('companies').update({ is_active }).eq('id', companyId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

// ── Leads ──────────────────────────────────────────────────────
export async function getLeads(): Promise<LeadRow[]> {
  const { admin } = await requireSuperAdmin()
  const { data } = await admin
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as LeadRow[]
}

export async function updateLeadStatus(
  id: string,
  status: LeadRow['status'],
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin } = await requireSuperAdmin()
    const { error } = await admin
      .from('leads')
      .update({ status, ...(notes !== undefined ? { notes } : {}) })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

// ── Support Tickets ────────────────────────────────────────────
export async function getSupportTickets(): Promise<SupportTicketRow[]> {
  const { admin } = await requireSuperAdmin()
  const { data } = await admin
    .from('support_tickets')
    .select('id, subject, category, priority, status, admin_notes, created_at, resolved_at, company_id, user_id')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!data?.length) return []

  const companyIds = [...new Set(data.map(t => t.company_id).filter(Boolean))]
  const userIds = [...new Set(data.map(t => t.user_id).filter(Boolean))]

  const [{ data: companies }, { data: authUsers }] = await Promise.all([
    companyIds.length ? admin.from('companies').select('id, name').in('id', companyIds) : Promise.resolve({ data: [] }),
    userIds.length ? admin.auth.admin.listUsers({ perPage: 1000 } as any) : Promise.resolve({ data: { users: [] } }),
  ])

  const companyMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]))
  const userMap = new Map(((authUsers as any)?.users ?? []).map((u: any) => [u.id, u.email]))

  return data.map(t => ({
    id: t.id,
    company_name: t.company_id ? companyMap.get(t.company_id) ?? null : null,
    user_email: t.user_id ? userMap.get(t.user_id) ?? null : null,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status as SupportTicketRow['status'],
    admin_notes: t.admin_notes,
    created_at: t.created_at,
    resolved_at: t.resolved_at,
  }))
}

export async function updateTicketStatus(
  id: string,
  status: SupportTicketRow['status'],
  admin_notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin } = await requireSuperAdmin()
    const update: Record<string, any> = { status }
    if (admin_notes !== undefined) update.admin_notes = admin_notes
    if (status === 'resolved' || status === 'closed') update.resolved_at = new Date().toISOString()
    const { error } = await admin.from('support_tickets').update(update).eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

// ── Stats ──────────────────────────────────────────────────────
export async function getAdminStats(): Promise<AdminStats> {
  try {
    const { admin } = await requireSuperAdmin()
    const [
      { count: total_tenants },
      { data: subs },
      { count: open_tickets },
      { count: new_leads },
    ] = await Promise.all([
      admin.from('companies').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('subscriptions').select('status').in('status', ['active', 'trialing', 'past_due']),
      admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      admin.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    ])

    const active = subs?.filter(s => s.status === 'active').length ?? 0
    const trialing = subs?.filter(s => s.status === 'trialing').length ?? 0

    return {
      total_tenants: total_tenants ?? 0,
      active_subscriptions: active,
      trialing,
      mrr_cents: 0, // calculado via billing_events futuramente
      open_tickets: open_tickets ?? 0,
      new_leads: new_leads ?? 0,
    }
  } catch {
    return { total_tenants: 0, active_subscriptions: 0, trialing: 0, mrr_cents: 0, open_tickets: 0, new_leads: 0 }
  }
}

// ── Logs (activity via subscriptions + billing_events) ────────
export interface LogEntry {
  id: string
  type: string
  company_name: string | null
  description: string
  created_at: string
}

export async function getAdminLogs(): Promise<LogEntry[]> {
  const { admin } = await requireSuperAdmin()

  const { data: events } = await admin
    .from('billing_events')
    .select('id, company_id, event_type, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!events?.length) return []

  const companyIds = [...new Set(events.map(e => e.company_id).filter(Boolean))]
  const { data: companies } = companyIds.length
    ? await admin.from('companies').select('id, name').in('id', companyIds)
    : { data: [] }

  const companyMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]))

  return events.map(e => ({
    id: e.id,
    type: e.event_type,
    company_name: e.company_id ? companyMap.get(e.company_id) ?? null : null,
    description: formatEventDescription(e.event_type, e.payload),
    created_at: e.created_at,
  }))
}

function formatEventDescription(type: string, payload: any): string {
  const p = payload ?? {}
  switch (type) {
    case 'subscription.created': return `Assinatura criada — plano ${p.plan_slug ?? '?'}`
    case 'subscription.updated': return `Assinatura atualizada — ${p.old_status ?? '?'} → ${p.new_status ?? '?'}`
    case 'subscription.cancelled': return 'Assinatura cancelada'
    case 'trial.started': return `Trial iniciado — ${p.days ?? 14} dias`
    case 'trial.ended': return 'Trial encerrado'
    case 'payment.succeeded': return `Pagamento confirmado — R$ ${((p.amount_cents ?? 0) / 100).toFixed(2)}`
    case 'payment.failed': return `Pagamento falhou — R$ ${((p.amount_cents ?? 0) / 100).toFixed(2)}`
    default: return type
  }
}

// ══════════════════════════════════════════════════════════════════
// SPRINT 22a — Novos actions: overrides, feature flags, AI usage,
//              tenant detail, changePlan
// ══════════════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────────

export interface TenantOverrideRow {
  id: string
  company_id: string
  feature_key: string
  int_value: number | null
  bool_value: boolean | null
  str_value: string | null
  reason: string
  expires_at: string | null
  granted_by_email: string | null
  created_at: string
}

export interface FeatureFlagRow {
  id: string
  feature_key: string
  display_name: string
  commercial_enabled: boolean
  technical_status: 'available' | 'in_homologation' | 'disabled'
  description: string | null
  updated_at: string
}

export interface AiUsageSummary {
  company_id: string
  company_name: string | null
  period_start: string | null
  total_calls: number
  total_tokens: number
  total_cost_brl_cents: number
}

export interface TenantDetail {
  company: {
    id: string
    name: string
    slug: string
    email: string | null
    is_active: boolean
    created_at: string
    kyra_config: Record<string, unknown>
  }
  subscription: {
    id: string
    plan_name: string
    plan_slug: string
    status: string
    trial_ends_at: string | null
    current_period_start: string
    current_period_end: string
  } | null
  overrides: TenantOverrideRow[]
  ai_usage: {
    total_calls: number
    total_tokens: number
    total_cost_brl_cents: number
  }
  onboarding: {
    checkpoint_key: string
    display_name: string
    day: number
    completed: boolean
    completed_at: string | null
  }[]
}

// ── Tenant Detail ──────────────────────────────────────────────

export async function getTenantDetail(companyId: string): Promise<TenantDetail | null> {
  const { admin } = await requireSuperAdmin()

  const [
    { data: company },
    { data: sub },
    { data: overrides },
    { data: usage },
    { data: onboarding },
  ] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, slug, email, is_active, created_at, kyra_config')
      .eq('id', companyId)
      .single(),

    admin
      .from('subscriptions')
      .select('id, status, trial_ends_at, current_period_start, current_period_end, plans(name, slug)')
      .eq('company_id', companyId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    admin
      .from('tenant_entitlement_overrides')
      .select('id, company_id, feature_key, int_value, bool_value, str_value, reason, expires_at, granted_by, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),

    admin
      .from('ai_usage_logs')
      .select('total_tokens, cost_brl_cents')
      .eq('company_id', companyId),

    admin
      .from('onboarding_checkpoints')
      .select('checkpoint_key, display_name, day, completed, completed_at')
      .eq('company_id', companyId)
      .order('day'),
  ])

  if (!company) return null

  // Resolver e-mails dos granted_by
  const granterIds = [...new Set((overrides ?? []).map(o => o.granted_by).filter(Boolean))]
  let granterMap = new Map<string, string>()
  if (granterIds.length) {
    const res = await admin.auth.admin.listUsers({ perPage: 1000 } as any)
    const users: any[] = (res as any).data?.users ?? []
    granterMap = new Map(users.map((u: any) => [u.id, u.email]))
  }

  // Agregar uso de IA
  const usageRows = usage ?? []
  const totalTokens = usageRows.reduce((s, r) => s + (r.total_tokens ?? 0), 0)
  const totalCost = usageRows.reduce((s, r) => s + (r.cost_brl_cents ?? 0), 0)

  const plan = sub?.plans as { name: string; slug: string } | null

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      email: company.email,
      is_active: company.is_active,
      created_at: company.created_at,
      kyra_config: (company.kyra_config ?? {}) as Record<string, unknown>,
    },
    subscription: sub && plan ? {
      id: sub.id,
      plan_name: plan.name,
      plan_slug: plan.slug,
      status: sub.status,
      trial_ends_at: sub.trial_ends_at,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
    } : null,
    overrides: (overrides ?? []).map(o => ({
      id: o.id,
      company_id: o.company_id,
      feature_key: o.feature_key,
      int_value: o.int_value,
      bool_value: o.bool_value,
      str_value: o.str_value,
      reason: o.reason,
      expires_at: o.expires_at,
      granted_by_email: o.granted_by ? (granterMap.get(o.granted_by) ?? null) : null,
      created_at: o.created_at,
    })),
    ai_usage: {
      total_calls: usageRows.length,
      total_tokens: totalTokens,
      total_cost_brl_cents: totalCost,
    },
    onboarding: (onboarding ?? []).map(o => ({
      checkpoint_key: o.checkpoint_key,
      display_name: o.display_name,
      day: o.day,
      completed: o.completed,
      completed_at: o.completed_at,
    })),
  }
}

// ── Tenant: trocar plano ───────────────────────────────────────

export async function changeTenantPlan(
  companyId: string,
  planSlug: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin } = await requireSuperAdmin()

    const { data: plan } = await admin
      .from('plans')
      .select('id, name')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .maybeSingle()

    if (!plan) return { success: false, error: `Plano "${planSlug}" não encontrado` }

    const now = new Date()
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()

    const { error } = await admin
      .from('subscriptions')
      .update({
        plan_id: plan.id,
        status: 'active',
        trial_ends_at: null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd,
      })
      .eq('company_id', companyId)
      .in('status', ['active', 'trialing', 'past_due'])

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

// ── Overrides ──────────────────────────────────────────────────

export async function getTenantOverrides(companyId: string): Promise<TenantOverrideRow[]> {
  const { admin } = await requireSuperAdmin()

  const { data } = await admin
    .from('tenant_entitlement_overrides')
    .select('id, company_id, feature_key, int_value, bool_value, str_value, reason, expires_at, granted_by, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (!data?.length) return []

  const granterIds = [...new Set(data.map(o => o.granted_by).filter(Boolean))]
  let granterMap = new Map<string, string>()
  if (granterIds.length) {
    const res = await admin.auth.admin.listUsers({ perPage: 1000 } as any)
    const users: any[] = (res as any).data?.users ?? []
    granterMap = new Map(users.map((u: any) => [u.id, u.email]))
  }

  return data.map(o => ({
    id: o.id,
    company_id: o.company_id,
    feature_key: o.feature_key,
    int_value: o.int_value,
    bool_value: o.bool_value,
    str_value: o.str_value,
    reason: o.reason,
    expires_at: o.expires_at,
    granted_by_email: o.granted_by ? (granterMap.get(o.granted_by) ?? null) : null,
    created_at: o.created_at,
  }))
}

export interface SetOverrideInput {
  company_id: string
  feature_key: string
  int_value?: number | null
  bool_value?: boolean | null
  str_value?: string | null
  reason: string
  expires_at?: string | null
}

export async function setTenantOverride(
  input: SetOverrideInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin, userId } = await requireSuperAdmin()

    if (input.int_value === undefined && input.bool_value === undefined && input.str_value === undefined) {
      return { success: false, error: 'Informe ao menos um valor (int, bool ou str)' }
    }

    const { error } = await admin
      .from('tenant_entitlement_overrides')
      .upsert(
        {
          company_id: input.company_id,
          feature_key: input.feature_key,
          int_value: input.int_value ?? null,
          bool_value: input.bool_value ?? null,
          str_value: input.str_value ?? null,
          reason: input.reason,
          expires_at: input.expires_at ?? null,
          granted_by: userId,
        },
        { onConflict: 'company_id,feature_key' },
      )

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

export async function deleteTenantOverride(
  companyId: string,
  featureKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin } = await requireSuperAdmin()
    const { error } = await admin
      .from('tenant_entitlement_overrides')
      .delete()
      .eq('company_id', companyId)
      .eq('feature_key', featureKey)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

// ── Feature Flags ──────────────────────────────────────────────

export async function getFeatureFlags(): Promise<FeatureFlagRow[]> {
  const { admin } = await requireSuperAdmin()

  const { data } = await admin
    .from('feature_flags')
    .select('id, feature_key, display_name, commercial_enabled, technical_status, description, updated_at')
    .order('feature_key')

  return (data ?? []) as FeatureFlagRow[]
}

export async function updateFeatureFlag(
  featureKey: string,
  updates: {
    commercial_enabled?: boolean
    technical_status?: 'available' | 'in_homologation' | 'disabled'
    description?: string
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin } = await requireSuperAdmin()

    if (!Object.keys(updates).length) {
      return { success: false, error: 'Nenhuma atualização informada' }
    }

    const { error } = await admin
      .from('feature_flags')
      .update(updates)
      .eq('feature_key', featureKey)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

// ── AI Usage ───────────────────────────────────────────────────

export async function getAiUsageStats(filters?: {
  companyId?: string
  from?: string
  to?: string
}): Promise<AiUsageSummary[]> {
  const { admin } = await requireSuperAdmin()

  let query = admin
    .from('ai_usage_logs')
    .select('company_id, total_tokens, cost_brl_cents, period_start')

  if (filters?.companyId) query = query.eq('company_id', filters.companyId)
  if (filters?.from) query = query.gte('period_start', filters.from)
  if (filters?.to) query = query.lte('period_start', filters.to)

  query = query.order('period_start', { ascending: false }).limit(5000)

  const { data: rows } = await query
  if (!rows?.length) return []

  // Agrupar por company_id
  const grouped = new Map<string, { total_calls: number; total_tokens: number; total_cost: number; period_start: string | null }>()
  for (const r of rows) {
    const prev = grouped.get(r.company_id) ?? { total_calls: 0, total_tokens: 0, total_cost: 0, period_start: r.period_start }
    grouped.set(r.company_id, {
      total_calls: prev.total_calls + 1,
      total_tokens: prev.total_tokens + (r.total_tokens ?? 0),
      total_cost: prev.total_cost + (r.cost_brl_cents ?? 0),
      period_start: prev.period_start,
    })
  }

  const companyIds = [...grouped.keys()]
  const { data: companies } = await admin
    .from('companies')
    .select('id, name')
    .in('id', companyIds)

  const companyMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]))

  return [...grouped.entries()].map(([company_id, stats]) => ({
    company_id,
    company_name: companyMap.get(company_id) ?? null,
    period_start: stats.period_start,
    total_calls: stats.total_calls,
    total_tokens: stats.total_tokens,
    total_cost_brl_cents: stats.total_cost,
  })).sort((a, b) => b.total_tokens - a.total_tokens)
}

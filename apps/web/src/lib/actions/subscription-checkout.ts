'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { getBillingProvider, statusGrantsAccess } from '@kyra/business-rules'

async function ctx() {
  const supabase = createServerSupabaseClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient() as any
  const { data: p } = await admin.from('profiles').select('company_id, role, email').eq('id', user.id).single()
  if (!p?.company_id) throw new Error('Empresa não encontrada')
  return { admin, companyId: p.company_id as string, role: p.role as string, email: p.email as string | null }
}

const billingReady = () => process.env.BILLING_PROVIDER === 'asaas' && !!process.env.ASAAS_API_KEY
const todayBr = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
const onlyDigits = (s: string) => (s ?? '').replace(/\D/g, '')

export interface CheckoutPlan {
  slug: string; name: string; description: string | null
  prices: { month: number | null; year: number | null }
}
export interface CheckoutState {
  status: string | null
  /** true quando o app está liberado (trial vigente, ativo, em tolerância). */
  hasAccess: boolean
  currentPlanSlug: string | null
  interval: 'month' | 'year' | null
  trialEndsAt: string | null
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  suspendReason: string | null
  hasDocument: boolean
  canManage: boolean
  billingReady: boolean
  plans: CheckoutPlan[]
}

export async function getCheckoutState(): Promise<CheckoutState> {
  const { admin, companyId, role } = await ctx()
  const [{ data: sub }, { data: company }, { data: plans }] = await Promise.all([
    admin.from('subscriptions').select('status, billing_interval, trial_ends_at, current_period_end, cancel_at_period_end, suspend_reason, plans(slug)')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('companies').select('document').eq('id', companyId).single(),
    admin.from('plans').select('slug, name, description, sort_order, plan_prices(billing_interval, amount_cents, active)').eq('active', true).order('sort_order'),
  ])
  return {
    status: sub?.status ?? null,
    hasAccess: sub ? statusGrantsAccess(sub.status, sub.trial_ends_at) : false,
    currentPlanSlug: sub?.plans?.slug ?? null,
    interval: sub?.billing_interval ?? null,
    trialEndsAt: sub?.trial_ends_at ?? null,
    periodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    suspendReason: sub?.suspend_reason ?? null,
    hasDocument: onlyDigits(company?.document ?? '').length >= 11,
    canManage: ['owner', 'admin'].includes(role),
    billingReady: billingReady(),
    plans: ((plans ?? []) as any[]).map(p => {
      const price = (i: string) => (p.plan_prices ?? []).find((x: any) => x.billing_interval === i && x.active)?.amount_cents ?? null
      return { slug: p.slug, name: p.name, description: p.description, prices: { month: price('month'), year: price('year') } }
    }),
  }
}

export interface CheckoutInput {
  planSlug: string
  interval: 'month' | 'year'
  method: 'PIX' | 'CREDIT_CARD'
  cpfCnpj?: string
}

/**
 * Contrata/troca de plano. Cria a recorrência no Asaas e devolve a URL onde o cliente paga
 * (cartão ou Pix). Dados de cartão nunca passam pelo nosso servidor.
 * No teste, o plano escolhido vale na hora; em conta expirada/suspensa, vale quando o pagamento confirma.
 */
export async function startCheckout(input: CheckoutInput): Promise<{ success: boolean; error?: string; url?: string | null; changed?: boolean }> {
  try {
    const { admin, companyId, role, email } = await ctx()
    if (!['owner', 'admin'].includes(role)) return { success: false, error: 'Somente o proprietário ou administrador pode contratar um plano.' }
    if (!billingReady()) return { success: false, error: 'A cobrança ainda não está habilitada. Fale com o suporte.' }
    if (!['PIX', 'CREDIT_CARD'].includes(input.method) || !['month', 'year'].includes(input.interval)) {
      return { success: false, error: 'Dados inválidos.' }
    }

    const { data: plan } = await admin.from('plans').select('id, name, slug').eq('slug', input.planSlug).eq('active', true).maybeSingle()
    if (!plan) return { success: false, error: 'Plano não encontrado.' }
    const { data: price } = await admin.from('plan_prices').select('id, amount_cents')
      .eq('plan_id', plan.id).eq('billing_interval', input.interval).eq('active', true).maybeSingle()
    if (!price) return { success: false, error: 'Preço indisponível para este plano.' }

    const { data: company } = await admin.from('companies').select('name, document, email').eq('id', companyId).single()
    let doc = onlyDigits(company?.document ?? '')
    if (doc.length < 11) {
      doc = onlyDigits(input.cpfCnpj ?? '')
      if (doc.length !== 11 && doc.length !== 14) return { success: false, error: 'Informe um CPF ou CNPJ válido para emitir a cobrança.' }
      await admin.from('companies').update({ document: doc }).eq('id', companyId)
    }

    const { data: sub } = await admin.from('subscriptions').select('*')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!sub) return { success: false, error: 'Assinatura não encontrada. Fale com o suporte.' }
    if (sub.status === 'paused' && sub.suspend_reason && sub.suspend_reason !== 'inadimplencia') {
      return { success: false, error: 'Conta suspensa. Entre em contato com o suporte.' }
    }

    const provider = getBillingProvider()
    const cycle = input.interval === 'year' ? 'YEARLY' : 'MONTHLY'

    // Assinatura já paga: troca de plano/ciclo na mesma recorrência
    if (sub.status === 'active' && sub.provider === 'asaas' && sub.provider_subscription_id) {
      await provider.changeSubscription(sub.provider_subscription_id, { amountCents: price.amount_cents, billingInterval: cycle })
      await admin.from('subscriptions').update({
        plan_id: plan.id, price_id: price.id, billing_interval: input.interval, updated_at: new Date().toISOString(),
      }).eq('id', sub.id)
      revalidatePath('/settings'); revalidatePath('/subscribe')
      return { success: true, changed: true }
    }

    // Cliente no Asaas (reaproveita se já existe)
    let customerId: string | null = sub.provider === 'asaas' ? sub.provider_customer_id : null
    if (!customerId) {
      customerId = await provider.createCustomer({
        name: company?.name ?? 'Cliente Kyra', email: company?.email ?? email ?? '', cpfCnpj: doc,
      })
    }

    // Solta o vínculo ANTES de cancelar a recorrência antiga, para o webhook de exclusão não afetar a conta
    const oldSubId: string | null = sub.provider === 'asaas' ? sub.provider_subscription_id : null
    if (oldSubId) {
      await admin.from('subscriptions').update({ provider_subscription_id: null }).eq('id', sub.id)
      await provider.cancelSubscription(oldSubId).catch(e => console.error('[checkout] cancel old sub:', e))
    }

    const newSubId = await provider.createSubscription({
      customerId, planId: plan.id, billingInterval: cycle, amountCents: price.amount_cents,
      nextDueDate: todayBr(), description: `Kyra Estoque — ${plan.name} (${input.interval === 'year' ? 'anual' : 'mensal'})`,
      billingType: input.method, externalReference: companyId,
    })

    // No teste o plano vale já; em conta expirada/suspensa o status só muda quando o pagamento confirmar
    await admin.from('subscriptions').update({
      plan_id: plan.id, price_id: price.id, billing_interval: input.interval,
      provider: 'asaas', provider_customer_id: customerId, provider_subscription_id: newSubId,
      provider_billing_type: input.method, updated_at: new Date().toISOString(),
    }).eq('id', sub.id)

    const url = await provider.getSubscriptionCheckoutUrl(newSubId).catch(() => null)
    revalidatePath('/settings'); revalidatePath('/subscribe')
    return { success: true, url }
  } catch (e) {
    console.error('[checkout] error:', e)
    return { success: false, error: 'Não foi possível iniciar a contratação. Tente novamente em instantes.' }
  }
}

/** URL para pagar/regularizar a cobrança em aberto (usado em atraso/suspensão). */
export async function getPayNowUrl(): Promise<string | null> {
  try {
    const { admin, companyId } = await ctx()
    const { data: sub } = await admin.from('subscriptions').select('provider, provider_subscription_id')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!sub || sub.provider !== 'asaas' || !sub.provider_subscription_id || !billingReady()) return null
    const key = process.env.ASAAS_API_KEY as string
    const base = process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3'
    const res = await fetch(`${base}/subscriptions/${sub.provider_subscription_id}/payments?status=OVERDUE&limit=1`, { headers: { access_token: key } })
    let data = res.ok ? await res.json() : null
    if (!data?.data?.length) {
      const r2 = await fetch(`${base}/subscriptions/${sub.provider_subscription_id}/payments?status=PENDING&limit=1`, { headers: { access_token: key } })
      data = r2.ok ? await r2.json() : null
    }
    return data?.data?.[0]?.invoiceUrl ?? null
  } catch { return null }
}

/**
 * Cancelar. Em teste com cobrança pendente: só desfaz a contratação (o teste continua).
 * Assinatura paga: cancela a recorrência e mantém o acesso até o fim do período já pago.
 */
export async function cancelMySubscription(): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin, companyId, role } = await ctx()
    if (!['owner', 'admin'].includes(role)) return { success: false, error: 'Sem permissão.' }
    const { data: sub } = await admin.from('subscriptions').select('*')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!sub) return { success: false, error: 'Assinatura não encontrada.' }

    const asaasId: string | null = sub.provider === 'asaas' ? sub.provider_subscription_id : null
    const now = new Date()
    const patch: Record<string, unknown> = { updated_at: now.toISOString() }

    if (sub.status === 'trialing') {
      patch.provider_subscription_id = null // desfaz só a contratação pendente
    } else if (sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) > now) {
      patch.cancel_at_period_end = true
      patch.canceled_at = now.toISOString()
    } else {
      patch.status = 'canceled'; patch.canceled_at = now.toISOString()
    }
    await admin.from('subscriptions').update(patch).eq('id', sub.id)
    if (asaasId && billingReady()) await getBillingProvider().cancelSubscription(asaasId).catch(e => console.error('[cancel] asaas:', e))
    revalidatePath('/settings'); revalidatePath('/subscribe')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

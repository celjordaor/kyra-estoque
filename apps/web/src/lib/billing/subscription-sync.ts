// Aplica no banco o resultado das regras de ciclo de vida (eventos do Asaas e rotina diária).

import { applyBillingEvent, planMaintenance, getBillingProvider, type SubState, type BillingEventInput } from '@kyra/business-rules'
import { notifyBilling } from './notify'

export const SUB_COLS =
  'id, company_id, status, billing_interval, current_period_end, trial_ends_at, past_due_since, cancel_at_period_end, provider, provider_subscription_id'

export async function applyEventToSubscription(admin: any, sub: any, ev: BillingEventInput): Promise<string> {
  const { patch, notice } = applyBillingEvent(sub as SubState, ev)
  if (patch) {
    const { error } = await admin.from('subscriptions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', sub.id)
    if (error) throw new Error(error.message)
  }
  if (notice) await notifyBilling(admin, sub.company_id, notice)
  return patch?.status ?? 'unchanged'
}

/** Rotina diária: expira testes, suspende inadimplentes, encerra cancelamentos agendados. */
export async function runBillingMaintenance(admin: any): Promise<{ expired: number; suspended: number; canceled: number }> {
  const out = { expired: 0, suspended: 0, canceled: 0 }
  const { data } = await admin.from('subscriptions').select(SUB_COLS)
    .in('status', ['trialing', 'active', 'past_due']).limit(2000)

  for (const sub of (data ?? []) as any[]) {
    try {
      const { patch, notice } = planMaintenance(sub as SubState)
      if (!patch) continue
      const pendingAsaasId = sub.provider === 'asaas' ? sub.provider_subscription_id : null
      const dropProviderSub = patch.status === 'expired' || patch.status === 'canceled'
      await admin.from('subscriptions').update({
        ...patch,
        ...(dropProviderSub ? { provider_subscription_id: null } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id)

      // Teste expirado com cobrança pendente: cancela a recorrência no Asaas (já sem vínculo no banco)
      if (patch.status === 'expired' && pendingAsaasId && process.env.BILLING_PROVIDER === 'asaas') {
        await getBillingProvider().cancelSubscription(pendingAsaasId).catch(e => console.error('[billing] cancel on expire:', e))
      }
      if (notice) await notifyBilling(admin, sub.company_id, notice)
      if (patch.status === 'expired') out.expired++
      else if (patch.status === 'paused') out.suspended++
      else if (patch.status === 'canceled') out.canceled++
    } catch (e) {
      console.error('[billing] maintenance error:', sub.id, e)
    }
  }

  // Aviso de fim de teste (3 dias e 1 dia), sem repetir
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString()
  const { data: trials } = await admin.from('subscriptions').select('id, company_id, trial_ends_at, provider_subscription_id')
    .eq('status', 'trialing').gt('trial_ends_at', new Date().toISOString()).lte('trial_ends_at', soon)
  for (const t of (trials ?? []) as any[]) {
    const days = Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86_400_000)
    const key = `trial_end:${t.id}:${days <= 1 ? 1 : 3}`
    const { data: seen } = await admin.from('automation_dedupe').select('dedupe_key').eq('company_id', t.company_id).eq('dedupe_key', key).maybeSingle()
    if (seen) continue
    await admin.from('automation_dedupe').upsert({ company_id: t.company_id, dedupe_key: key, last_sent_at: new Date().toISOString() })
    await notifyBilling(admin, t.company_id, {
      kind: 'trial_expired',
      title: days <= 1 ? 'Seu teste termina amanhã' : `Seu teste termina em ${days} dias`,
      body: 'Escolha um plano para continuar usando a Kyra sem interrupção.',
    })
  }
  return out
}

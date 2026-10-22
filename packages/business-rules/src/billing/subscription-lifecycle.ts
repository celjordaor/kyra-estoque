// Ciclo de vida da assinatura da Kyra (cobrada via Asaas).
// Funções puras: recebem o estado atual + evento e devolvem o que mudar. Sem acesso a banco.

export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'paused'
export type Interval = 'month' | 'year'

/** Dias de tolerância após o vencimento antes de suspender a conta. */
export const GRACE_DAYS = 5

export interface SubState {
  status: SubStatus
  billing_interval: Interval | null
  current_period_end: string | null
  trial_ends_at: string | null
  past_due_since: string | null
  cancel_at_period_end: boolean | null
}

export interface SubPatch {
  status?: SubStatus
  current_period_start?: string
  current_period_end?: string
  past_due_since?: string | null
  suspended_at?: string | null
  suspend_reason?: string | null
  canceled_at?: string | null
  cancel_at_period_end?: boolean
}

export interface BillingNotice {
  kind: 'payment_confirmed' | 'payment_overdue' | 'payment_failed' | 'suspended' | 'canceled' | 'trial_expired'
  title: string
  body: string
}

export interface LifecycleResult { patch: SubPatch | null; notice: BillingNotice | null }
const NONE: LifecycleResult = { patch: null, notice: null }

export function addInterval(from: Date, interval: Interval | null): Date {
  const d = new Date(from.getTime())
  if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

export interface BillingEventInput {
  event: string
  paidAt?: string
  /** O mesmo pagamento já gerou crédito antes (CONFIRMED seguido de RECEIVED no cartão). */
  alreadyCredited?: boolean
}

export function applyBillingEvent(sub: SubState, ev: BillingEventInput, now = new Date()): LifecycleResult {
  const nowIso = now.toISOString()

  switch (ev.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      if (sub.status === 'canceled' || ev.alreadyCredited) return NONE
      const paid = ev.paidAt ? new Date(ev.paidAt) : now
      const paidValid = isNaN(paid.getTime()) ? now : paid
      const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : null
      const renewing = sub.status === 'active' && currentEnd && currentEnd > now
      const start = renewing ? (currentEnd as Date) : paidValid
      const wasActive = sub.status === 'active'
      return {
        patch: {
          status: 'active',
          current_period_start: start.toISOString(),
          current_period_end: addInterval(start, sub.billing_interval).toISOString(),
          past_due_since: null, suspended_at: null, suspend_reason: null,
        },
        notice: wasActive ? null : {
          kind: 'payment_confirmed',
          title: 'Pagamento confirmado',
          body: 'Recebemos o pagamento da sua assinatura Kyra. Obrigado!',
        },
      }
    }

    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED': {
      const failed = ev.event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'
      const notice: BillingNotice = failed
        ? { kind: 'payment_failed', title: 'Cartão recusado', body: 'Não conseguimos cobrar o cartão da sua assinatura. Atualize a forma de pagamento para evitar a suspensão.' }
        : { kind: 'payment_overdue', title: 'Pagamento em atraso', body: `Sua assinatura Kyra está em atraso. Regularize em até ${GRACE_DAYS} dias para evitar a suspensão da conta.` }
      if (sub.status === 'active') {
        return { patch: { status: 'past_due', past_due_since: sub.past_due_since ?? nowIso }, notice }
      }
      // Em teste, a cobrança pendente não altera o acesso (o teste governa); só avisa
      if (sub.status === 'trialing') return { patch: null, notice }
      if (sub.status === 'past_due') return { patch: null, notice: null }
      return NONE
    }

    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_CHARGEBACK_REQUESTED': {
      if (['canceled', 'expired', 'paused'].includes(sub.status)) return NONE
      const reason = ev.event === 'PAYMENT_REFUNDED' ? 'estorno' : 'chargeback'
      return {
        patch: { status: 'paused', suspended_at: nowIso, suspend_reason: reason },
        notice: { kind: 'suspended', title: 'Conta suspensa', body: `Sua conta foi suspensa por ${reason}. Entre em contato com o suporte.` },
      }
    }

    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_INACTIVATED': {
      if (['canceled', 'expired'].includes(sub.status)) return NONE
      const end = sub.current_period_end ? new Date(sub.current_period_end) : null
      const keepUntilEnd = (sub.status === 'active' || sub.status === 'past_due') && end && end > now && sub.status === 'active'
      const notice: BillingNotice = {
        kind: 'canceled', title: 'Assinatura cancelada',
        body: keepUntilEnd ? 'Sua assinatura foi cancelada. O acesso segue até o fim do período já pago.' : 'Sua assinatura foi cancelada.',
      }
      if (keepUntilEnd) return { patch: { cancel_at_period_end: true, canceled_at: nowIso }, notice }
      return { patch: { status: 'canceled', canceled_at: nowIso, cancel_at_period_end: false }, notice }
    }

    default:
      return NONE
  }
}

/** Rotina diária: expira testes, suspende inadimplentes e encerra cancelamentos agendados. */
export function planMaintenance(sub: SubState, now = new Date(), graceDays = GRACE_DAYS): LifecycleResult {
  const nowIso = now.toISOString()

  if (sub.status === 'trialing' && sub.trial_ends_at && new Date(sub.trial_ends_at) < now) {
    return {
      patch: { status: 'expired' },
      notice: { kind: 'trial_expired', title: 'Seu período de teste terminou', body: 'Escolha um plano para continuar usando a Kyra. Seus dados estão preservados.' },
    }
  }

  if (sub.status === 'past_due' && sub.past_due_since) {
    const days = (now.getTime() - new Date(sub.past_due_since).getTime()) / 86_400_000
    if (days > graceDays) {
      return {
        patch: { status: 'paused', suspended_at: nowIso, suspend_reason: 'inadimplencia' },
        notice: { kind: 'suspended', title: 'Conta suspensa por falta de pagamento', body: 'Regularize o pagamento para reativar o acesso. Seus dados estão preservados.' },
      }
    }
  }

  if ((sub.status === 'active' || sub.status === 'past_due') && sub.cancel_at_period_end && sub.current_period_end && new Date(sub.current_period_end) < now) {
    return {
      patch: { status: 'canceled' },
      notice: { kind: 'canceled', title: 'Assinatura encerrada', body: 'O período pago terminou e a assinatura foi encerrada.' },
    }
  }
  return NONE
}

/** O status dá acesso ao app? (past_due ainda dá, durante a tolerância). */
export function statusGrantsAccess(status: string, trialEndsAt?: string | null, now = new Date()): boolean {
  if (status === 'active' || status === 'past_due') return true
  if (status === 'trialing') return !trialEndsAt || new Date(trialEndsAt) >= now
  return false
}

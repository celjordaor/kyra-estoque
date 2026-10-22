import assert from 'node:assert/strict'
import { applyBillingEvent, planMaintenance, addInterval, statusGrantsAccess, type SubState } from './subscription-lifecycle'

const NOW = new Date('2026-10-22T12:00:00Z')
const base = (o: Partial<SubState> = {}): SubState => ({
  status: 'trialing', billing_interval: 'month', current_period_end: null, trial_ends_at: '2026-10-30T00:00:00Z',
  past_due_since: null, cancel_at_period_end: false, ...o,
})
let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name) }

t('pagamento no trial ativa de imediato e soma 1 mês', () => {
  const r = applyBillingEvent(base(), { event: 'PAYMENT_CONFIRMED', paidAt: '2026-10-22' }, NOW)
  assert.equal(r.patch?.status, 'active')
  assert.equal(r.patch?.current_period_end?.slice(0, 10), '2026-11-22')
  assert.equal(r.notice?.kind, 'payment_confirmed')
})
t('plano anual soma 1 ano', () => {
  const r = applyBillingEvent(base({ billing_interval: 'year' }), { event: 'PAYMENT_RECEIVED', paidAt: '2026-10-22' }, NOW)
  assert.equal(r.patch?.current_period_end?.slice(0, 10), '2027-10-22')
})
t('RECEIVED depois de CONFIRMED (cartão) não estende de novo', () => {
  const r = applyBillingEvent(base({ status: 'active', current_period_end: '2026-11-22T00:00:00Z' }), { event: 'PAYMENT_RECEIVED', alreadyCredited: true }, NOW)
  assert.equal(r.patch, null)
})
t('renovação antecipada estende a partir do fim do período', () => {
  const r = applyBillingEvent(base({ status: 'active', current_period_end: '2026-11-22T00:00:00Z' }), { event: 'PAYMENT_CONFIRMED', paidAt: '2026-11-20' }, NOW)
  assert.equal(r.patch?.current_period_end?.slice(0, 10), '2026-12-22')
  assert.equal(r.notice, null)
})
t('pagamento de conta expirada reativa', () => {
  const r = applyBillingEvent(base({ status: 'expired' }), { event: 'PAYMENT_CONFIRMED' }, NOW)
  assert.equal(r.patch?.status, 'active')
})
t('pagamento de conta suspensa limpa a suspensão', () => {
  const r = applyBillingEvent(base({ status: 'paused', past_due_since: '2026-10-01T00:00:00Z' }), { event: 'PAYMENT_RECEIVED' }, NOW)
  assert.equal(r.patch?.status, 'active'); assert.equal(r.patch?.past_due_since, null); assert.equal(r.patch?.suspended_at, null)
})
t('pagamento em assinatura cancelada é ignorado', () => {
  assert.equal(applyBillingEvent(base({ status: 'canceled' }), { event: 'PAYMENT_CONFIRMED' }, NOW).patch, null)
})
t('atraso em assinatura ativa vira past_due', () => {
  const r = applyBillingEvent(base({ status: 'active' }), { event: 'PAYMENT_OVERDUE' }, NOW)
  assert.equal(r.patch?.status, 'past_due'); assert.equal(r.patch?.past_due_since, NOW.toISOString())
})
t('atraso repetido não reinicia a contagem', () => {
  const r = applyBillingEvent(base({ status: 'past_due', past_due_since: '2026-10-20T00:00:00Z' }), { event: 'PAYMENT_OVERDUE' }, NOW)
  assert.equal(r.patch, null)
})
t('cobrança pendente no trial só avisa, sem mudar status', () => {
  const r = applyBillingEvent(base(), { event: 'PAYMENT_OVERDUE' }, NOW)
  assert.equal(r.patch, null); assert.ok(r.notice)
})
t('cartão recusado em ativa vira past_due', () => {
  const r = applyBillingEvent(base({ status: 'active' }), { event: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED' }, NOW)
  assert.equal(r.patch?.status, 'past_due'); assert.equal(r.notice?.kind, 'payment_failed')
})
t('chargeback suspende na hora', () => {
  const r = applyBillingEvent(base({ status: 'active' }), { event: 'PAYMENT_CHARGEBACK_REQUESTED' }, NOW)
  assert.equal(r.patch?.status, 'paused'); assert.equal(r.patch?.suspend_reason, 'chargeback')
})
t('assinatura deletada com período pago mantém acesso até o fim', () => {
  const r = applyBillingEvent(base({ status: 'active', current_period_end: '2026-11-22T00:00:00Z' }), { event: 'SUBSCRIPTION_DELETED' }, NOW)
  assert.equal(r.patch?.cancel_at_period_end, true); assert.equal(r.patch?.status, undefined)
})
t('assinatura deletada no trial cancela', () => {
  assert.equal(applyBillingEvent(base(), { event: 'SUBSCRIPTION_DELETED' }, NOW).patch?.status, 'canceled')
})
t('SUBSCRIPTION_DELETED depois de expirar não regride', () => {
  assert.equal(applyBillingEvent(base({ status: 'expired' }), { event: 'SUBSCRIPTION_DELETED' }, NOW).patch, null)
})
t('evento desconhecido é ignorado', () => {
  assert.equal(applyBillingEvent(base(), { event: 'PAYMENT_CREATED' }, NOW).patch, null)
})
t('manutenção: trial vencido expira', () => {
  assert.equal(planMaintenance(base({ trial_ends_at: '2026-10-21T00:00:00Z' }), NOW).patch?.status, 'expired')
})
t('manutenção: trial vigente não muda', () => {
  assert.equal(planMaintenance(base(), NOW).patch, null)
})
t('manutenção: past_due dentro da tolerância não suspende', () => {
  assert.equal(planMaintenance(base({ status: 'past_due', past_due_since: '2026-10-19T00:00:00Z' }), NOW).patch, null)
})
t('manutenção: past_due além da tolerância suspende', () => {
  const r = planMaintenance(base({ status: 'past_due', past_due_since: '2026-10-10T00:00:00Z' }), NOW)
  assert.equal(r.patch?.status, 'paused'); assert.equal(r.patch?.suspend_reason, 'inadimplencia')
})
t('manutenção: cancelamento agendado encerra após o período', () => {
  const r = planMaintenance(base({ status: 'active', cancel_at_period_end: true, current_period_end: '2026-10-01T00:00:00Z' }), NOW)
  assert.equal(r.patch?.status, 'canceled')
})
t('acesso: trial vencido sem job não dá acesso', () => {
  assert.equal(statusGrantsAccess('trialing', '2026-10-01T00:00:00Z', NOW), false)
  assert.equal(statusGrantsAccess('past_due', null, NOW), true)
  assert.equal(statusGrantsAccess('paused', null, NOW), false)
})
t('addInterval', () => assert.equal(addInterval(new Date('2026-01-31T00:00:00Z'), 'month').getUTCMonth() >= 1, true))
console.log(`\n${n} testes passaram`)

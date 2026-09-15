export type { BillingProvider, CustomerData, ChargeData, ChargeResult,
  SubscriptionData, PlanData, WebhookResult } from './billing-provider'
export { AsaasAdapter } from './asaas-adapter'
export { MockAdapter } from './mock-adapter'

import { AsaasAdapter } from './asaas-adapter'
import { MockAdapter } from './mock-adapter'
import type { BillingProvider } from './billing-provider'

/** Retorna o adapter correto baseado na env — nunca expõe o provedor ao cliente */
export function getBillingProvider(): BillingProvider {
  const provider = process.env.BILLING_PROVIDER ?? 'mock'
  if (provider === 'asaas') return new AsaasAdapter()
  return new MockAdapter()
}

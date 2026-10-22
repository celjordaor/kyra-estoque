// AsaasAdapter — implementação do BillingProvider para Asaas
// Documentação: https://asaasv3.docs.apiary.io/

import type {
  BillingProvider, CustomerData, ChargeData, ChargeResult,
  SubscriptionData, PlanData, WebhookResult,
} from './billing-provider'

export const ASAAS_SANDBOX_URL = 'https://sandbox.asaas.com/api/v3'
export const ASAAS_PRODUCTION_URL = 'https://api.asaas.com/v3'

export interface AsaasCredentials {
  apiKey: string
  baseUrl: string
}

async function asaasRequest(creds: AsaasCredentials, path: string, options: RequestInit = {}) {
  if (!creds.apiKey) throw new Error('Chave de API do Asaas não configurada')

  const res = await fetch(`${creds.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': creds.apiKey,
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Asaas API ${res.status}: ${body}`)
  }

  return res.json()
}

function mapStatus(asaasStatus: string): ChargeResult['status'] {
  const map: Record<string, ChargeResult['status']> = {
    PENDING: 'PENDING',
    RECEIVED: 'RECEIVED',
    CONFIRMED: 'CONFIRMED',
    OVERDUE: 'OVERDUE',
    REFUNDED: 'REFUNDED',
    CANCELLED: 'CANCELLED',
    REFUND_REQUESTED: 'REFUNDED',
    CHARGEBACK_REQUESTED: 'CANCELLED',
    CHARGEBACK_DISPUTE: 'CANCELLED',
    AWAITING_CHARGEBACK_REVERSAL: 'PENDING',
    DUNNING_REQUESTED: 'OVERDUE',
    DUNNING_RECEIVED: 'RECEIVED',
    AWAITING_RISK_ANALYSIS: 'PENDING',
  }
  return map[asaasStatus] ?? 'PENDING'
}

export class AsaasAdapter implements BillingProvider {
  private readonly creds: AsaasCredentials

  /**
   * Sem argumento: usa a conta do próprio Kyra (env ASAAS_API_KEY / ASAAS_BASE_URL).
   * Com credenciais: usa a conta Asaas do cliente (tenant).
   */
  constructor(creds?: AsaasCredentials) {
    this.creds = creds ?? {
      apiKey: process.env.ASAAS_API_KEY ?? '',
      baseUrl: process.env.ASAAS_BASE_URL ?? ASAAS_SANDBOX_URL,
    }
  }

  async createCustomer(data: CustomerData): Promise<string> {
    const res = await asaasRequest(this.creds, '/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        phone: data.phone,
        address: data.address?.street,
        addressNumber: data.address?.number,
        complement: data.address?.complement,
        province: data.address?.neighborhood,
        city: data.address?.city,
        state: data.address?.state,
        postalCode: data.address?.postalCode,
      }),
    })
    return res.id
  }

  async getCustomer(customerId: string): Promise<CustomerData & { id: string }> {
    const res = await asaasRequest(this.creds, `/customers/${customerId}`)
    return {
      id: res.id,
      name: res.name,
      email: res.email,
      cpfCnpj: res.cpfCnpj,
      phone: res.phone,
    }
  }

  async createCharge(data: ChargeData): Promise<ChargeResult> {
    const res = await asaasRequest(this.creds, '/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: data.customerId,
        billingType: data.billingType,
        value: data.amountCents / 100,
        dueDate: data.dueDate,
        description: data.description,
        externalReference: data.externalReference,
        installmentCount: data.installmentCount,
        installmentValue: data.installmentValue ? data.installmentValue / 100 : undefined,
      }),
    })

    return {
      chargeId: res.id,
      status: mapStatus(res.status),
      bankSlipUrl: res.bankSlipUrl,
      pixQrCode: res.pixQrCode,
      pixCopyPaste: res.pixCopiaECola,
      dueDate: res.dueDate,
      invoiceUrl: res.invoiceUrl,
    }
  }

  async getCharge(chargeId: string): Promise<ChargeResult> {
    const res = await asaasRequest(this.creds, `/payments/${chargeId}`)
    return {
      chargeId: res.id,
      status: mapStatus(res.status),
      bankSlipUrl: res.bankSlipUrl,
      pixQrCode: res.pixQrCode,
      pixCopyPaste: res.pixCopiaECola,
      dueDate: res.dueDate,
      invoiceUrl: res.invoiceUrl,
    }
  }

  async cancelCharge(chargeId: string): Promise<void> {
    await asaasRequest(this.creds, `/payments/${chargeId}`, { method: 'DELETE' })
  }

  async createSubscription(data: SubscriptionData): Promise<string> {
    const cycle = data.billingInterval === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
    const res = await asaasRequest(this.creds, '/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: data.customerId,
        billingType: 'BOLETO',
        cycle,
        value: data.amountCents / 100,
        nextDueDate: data.nextDueDate,
        description: data.description,
      }),
    })
    return res.id
  }

  async changeSubscription(subscriptionId: string, planData: PlanData): Promise<void> {
    await asaasRequest(this.creds, `/subscriptions/${subscriptionId}`, {
      method: 'PUT',
      body: JSON.stringify({
        value: planData.amountCents / 100,
        cycle: planData.billingInterval === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
      }),
    })
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await asaasRequest(this.creds, `/subscriptions/${subscriptionId}`, { method: 'DELETE' })
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    const p = payload as Record<string, unknown>
    const event = p.event as string
    const payment = p.payment as Record<string, unknown> | undefined
    const subscription = p.subscription as Record<string, unknown> | undefined

    return {
      event,
      chargeId: payment?.id as string | undefined,
      subscriptionId: subscription?.id as string | undefined,
      customerId: (payment?.customer ?? subscription?.customer) as string | undefined,
      status: payment?.status as string | undefined,
      paidAt: payment?.paymentDate as string | undefined,
      amountCents: payment?.value ? Math.round((payment.value as number) * 100) : undefined,
    }
  }
}

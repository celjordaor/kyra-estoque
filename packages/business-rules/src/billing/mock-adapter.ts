// MockAdapter — implementação de BillingProvider para dev/testes
// Não faz chamadas externas; retorna dados fixos determinísticos

import type {
  BillingProvider, CustomerData, ChargeData, ChargeResult,
  SubscriptionData, PlanData, WebhookResult,
} from './billing-provider'

export class MockAdapter implements BillingProvider {
  async createCustomer(data: CustomerData): Promise<string> {
    return `mock_cus_${Date.now()}`
  }

  async getCustomer(customerId: string): Promise<CustomerData & { id: string }> {
    return {
      id: customerId,
      name: 'Mock Customer',
      email: 'mock@example.com',
    }
  }

  async createCharge(data: ChargeData): Promise<ChargeResult> {
    const chargeId = `mock_pay_${Date.now()}`
    return {
      chargeId,
      status: 'PENDING',
      bankSlipUrl: `https://mock.asaas.com/boleto/${chargeId}`,
      pixQrCode: `mock_qr_${chargeId}`,
      pixCopyPaste: `00020126580014br.gov.bcb.pix0136mock-pix-${chargeId}`,
      dueDate: data.dueDate,
      invoiceUrl: `https://mock.asaas.com/invoice/${chargeId}`,
    }
  }

  async getCharge(chargeId: string): Promise<ChargeResult> {
    return {
      chargeId,
      status: 'PENDING',
      dueDate: new Date().toISOString().slice(0, 10),
    }
  }

  async cancelCharge(_chargeId: string): Promise<void> {
    // no-op
  }

  async createSubscription(data: SubscriptionData): Promise<string> {
    return `mock_sub_${Date.now()}`
  }

  async changeSubscription(_subscriptionId: string, _planData: PlanData): Promise<void> {
    // no-op
  }

  async cancelSubscription(_subscriptionId: string): Promise<void> {
    // no-op
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    return {
      event: 'PAYMENT_RECEIVED',
      chargeId: 'mock_pay_test',
      status: 'RECEIVED',
    }
  }
}

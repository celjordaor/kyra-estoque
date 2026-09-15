// BillingProvider — adapter pattern para provedores de pagamento
// Domínio nunca fica acoplado ao provedor específico

export interface CustomerData {
  name: string
  email: string
  cpfCnpj?: string
  phone?: string
  address?: {
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
    postalCode: string
  }
}

export interface ChargeData {
  customerId: string
  description: string
  amountCents: number
  dueDate: string            // ISO date: 'YYYY-MM-DD'
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED'
  externalReference?: string // referência interna (transaction ID)
  installmentCount?: number
  installmentValue?: number
}

export interface ChargeResult {
  chargeId: string           // ID no provedor (ex: Asaas pay_xxx)
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED'
  bankSlipUrl?: string       // URL do boleto
  pixQrCode?: string         // QR code Pix
  pixCopyPaste?: string      // Pix copia-e-cola
  dueDate: string
  invoiceUrl?: string
}

export interface SubscriptionData {
  customerId: string
  planId: string
  billingInterval: 'MONTHLY' | 'YEARLY'
  amountCents: number
  nextDueDate: string
  description?: string
}

export interface PlanData {
  amountCents: number
  billingInterval: 'MONTHLY' | 'YEARLY'
}

export interface WebhookResult {
  event: string
  chargeId?: string
  subscriptionId?: string
  customerId?: string
  status?: string
  paidAt?: string
  amountCents?: number
}

export interface BillingProvider {
  createCustomer(data: CustomerData): Promise<string>
  getCustomer(customerId: string): Promise<CustomerData & { id: string }>
  createCharge(data: ChargeData): Promise<ChargeResult>
  getCharge(chargeId: string): Promise<ChargeResult>
  cancelCharge(chargeId: string): Promise<void>
  createSubscription(data: SubscriptionData): Promise<string>
  changeSubscription(subscriptionId: string, planData: PlanData): Promise<void>
  cancelSubscription(subscriptionId: string): Promise<void>
  handleWebhook(payload: unknown, signature?: string): Promise<WebhookResult>
}

// ── Channel Adapter Types — Sprint 18b ───────────────────────────────────────

export interface ChannelCredentials {
  /** Shopify Admin API token (shpat_...) */
  token?: string
  /** Shopify store URL (minha-loja.myshopify.com) */
  store_url?: string
  /** WooCommerce consumer key */
  api_key?: string
  /** WooCommerce consumer secret */
  client_secret?: string
  /** Mercado Livre access token */
  access_token?: string
  /** Mercado Livre refresh token */
  refresh_token?: string
  /** Mercado Livre seller ID */
  seller_id?: string
  /** Loja Integrada API key */
  loja_integrada_api_key?: string
  /** Nome/identificador da conta no canal */
  account_name?: string
}

export interface StockItem {
  /** ID do channel_listing */
  listingId: string
  /** ID externo do produto/item no canal */
  externalId: string
  /** SKU externo */
  externalSku?: string
  /** Quantidade atual no estoque Kyra */
  quantity: number
  /** Preço em centavos */
  priceCents?: number
}

export interface StockSyncResult {
  listingId: string
  externalId: string
  success: boolean
  error?: string
}

export interface ExternalOrder {
  externalOrderId: string
  externalStatus: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'canceled' | 'refunded'
  customerName?: string
  customerEmail?: string
  totalCents: number
  itemsCount: number
  rawPayload: Record<string, unknown>
  createdAt: string
}

export interface SyncResult {
  stockResults: StockSyncResult[]
  orders: ExternalOrder[]
  errors: string[]
}

export interface ChannelAdapter {
  validateCredentials(): Promise<boolean>
  syncStock(items: StockItem[]): Promise<StockSyncResult[]>
  fetchOrders(since?: Date): Promise<ExternalOrder[]>
}

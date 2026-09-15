// ── WooCommerce REST API Adapter — Sprint 18b ────────────────────────────────
// Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
// Auth: Basic Auth com Consumer Key + Consumer Secret (base64)

import type {
  ChannelAdapter, ChannelCredentials,
  StockItem, StockSyncResult, ExternalOrder,
} from './types'

export class WooCommerceAdapter implements ChannelAdapter {
  private readonly baseUrl: string
  private readonly authHeader: string

  constructor(credentials: ChannelCredentials) {
    if (!credentials.store_url || !credentials.api_key || !credentials.client_secret) {
      throw new Error('WooCommerce: store_url, api_key (consumer key) e client_secret (consumer secret) são obrigatórios')
    }
    const host = credentials.store_url.replace(/\/$/, '')
    this.baseUrl = `${host}/wp-json/wc/v3`
    this.authHeader = `Basic ${Buffer.from(`${credentials.api_key}:${credentials.client_secret}`).toString('base64')}`
  }

  private async wcFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
        ...options.headers,
      },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`WooCommerce API ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async validateCredentials(): Promise<boolean> {
    // GET /system_status — endpoint leve que requer autenticação válida
    await this.wcFetch('/system_status')
    return true
  }

  async syncStock(items: StockItem[]): Promise<StockSyncResult[]> {
    // WC: PUT /products/{id} com { stock_quantity, manage_stock: true }
    // O external_id do channel_listing deve ser o product ID numérico do WC.
    const results: StockSyncResult[] = []

    for (const item of items) {
      try {
        await this.wcFetch(`/products/${item.externalId}`, {
          method: 'PUT',
          body: JSON.stringify({
            stock_quantity: item.quantity,
            manage_stock: true,
          }),
        })
        results.push({ listingId: item.listingId, externalId: item.externalId, success: true })
      } catch (err) {
        results.push({
          listingId: item.listingId,
          externalId: item.externalId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return results
  }

  async fetchOrders(since?: Date): Promise<ExternalOrder[]> {
    const sinceParam = since
      ? `&after=${since.toISOString()}`
      : ''
    const orders = await this.wcFetch<WCOrder[]>(
      `/orders?per_page=100&orderby=date&order=desc${sinceParam}`,
    )

    return orders.map(order => ({
      externalOrderId: String(order.id),
      externalStatus: order.status,
      status: mapWCStatus(order.status),
      customerName: `${order.billing?.first_name ?? ''} ${order.billing?.last_name ?? ''}`.trim() || undefined,
      customerEmail: order.billing?.email ?? undefined,
      totalCents: Math.round(parseFloat(order.total ?? '0') * 100),
      itemsCount: order.line_items?.length ?? 0,
      rawPayload: order as unknown as Record<string, unknown>,
      createdAt: order.date_created,
    }))
  }
}

// ── Tipos internos WooCommerce ────────────────────────────────────────────────

interface WCOrder {
  id: number
  status: string
  total?: string
  date_created: string
  line_items?: unknown[]
  billing?: {
    first_name?: string
    last_name?: string
    email?: string
  }
}

function mapWCStatus(status: string): ExternalOrder['status'] {
  switch (status) {
    case 'processing':
    case 'on-hold':    return 'confirmed'
    case 'completed':  return 'delivered'
    case 'shipped':    return 'shipped'
    case 'refunded':   return 'refunded'
    case 'cancelled':
    case 'failed':     return 'canceled'
    default:           return 'pending'
  }
}

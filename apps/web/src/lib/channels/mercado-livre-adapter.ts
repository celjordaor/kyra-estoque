// ── Mercado Livre API Adapter — Sprint 18b ────────────────────────────────────
// Docs: https://developers.mercadolivre.com.br/pt_br/api-docs
// Auth: OAuth2 Bearer token no header Authorization

import type {
  ChannelAdapter, ChannelCredentials,
  StockItem, StockSyncResult, ExternalOrder,
} from './types'

const ML_BASE = 'https://api.mercadolibre.com'

export class MercadoLivreAdapter implements ChannelAdapter {
  private token: string
  private readonly sellerId?: string

  constructor(credentials: ChannelCredentials) {
    if (!credentials.access_token) {
      throw new Error('Mercado Livre: access_token é obrigatório')
    }
    this.token = credentials.access_token
    this.sellerId = credentials.seller_id
  }

  private async mlFetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(`${ML_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...options.headers,
      },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`ML API ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async validateCredentials(): Promise<boolean> {
    // GET /users/me — retorna dados do usuário autenticado
    await this.mlFetch('/users/me')
    return true
  }

  async syncStock(items: StockItem[]): Promise<StockSyncResult[]> {
    // ML: PUT /items/{item_id} com { available_quantity }
    // O external_id do channel_listing deve ser o MLB... do item.
    const results: StockSyncResult[] = []

    for (const item of items) {
      try {
        await this.mlFetch(`/items/${item.externalId}`, {
          method: 'PUT',
          body: JSON.stringify({ available_quantity: item.quantity }),
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
    if (!this.sellerId) {
      throw new Error('Mercado Livre: seller_id é necessário para buscar pedidos')
    }

    const dateFilter = since
      ? `&date_created.from=${since.toISOString()}`
      : ''
    const data = await this.mlFetch<MLOrdersResponse>(
      `/orders/search?seller=${this.sellerId}&sort=date_desc&limit=100${dateFilter}`,
    )

    return (data.results ?? []).map(order => ({
      externalOrderId: String(order.id),
      externalStatus: order.status,
      status: mapMLStatus(order.status),
      customerName: order.buyer
        ? `${order.buyer.first_name ?? ''} ${order.buyer.last_name ?? ''}`.trim()
        : undefined,
      customerEmail: order.buyer?.email ?? undefined,
      totalCents: Math.round((order.total_amount ?? 0) * 100),
      itemsCount: order.order_items?.length ?? 0,
      rawPayload: order as unknown as Record<string, unknown>,
      createdAt: order.date_created,
    }))
  }
}

// ── Tipos internos ML ─────────────────────────────────────────────────────────

interface MLOrdersResponse {
  results?: MLOrder[]
}

interface MLOrder {
  id: number
  status: string
  total_amount?: number
  date_created: string
  order_items?: unknown[]
  buyer?: {
    first_name?: string
    last_name?: string
    email?: string
  }
}

function mapMLStatus(status: string): ExternalOrder['status'] {
  switch (status) {
    case 'paid':          return 'confirmed'
    case 'payment_required':
    case 'confirmed':     return 'pending'
    case 'partially_refunded':
    case 'refunded':      return 'refunded'
    case 'cancelled':     return 'canceled'
    default:              return 'pending'
  }
}

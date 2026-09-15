// ── Shopify Admin API Adapter — Sprint 18b ───────────────────────────────────
// Docs: https://shopify.dev/docs/api/admin-rest/2024-01
// Auth: Admin API Token (shpat_...) no header X-Shopify-Access-Token

import type {
  ChannelAdapter, ChannelCredentials,
  StockItem, StockSyncResult, ExternalOrder,
} from './types'

export class ShopifyAdapter implements ChannelAdapter {
  private readonly baseUrl: string
  private readonly token: string

  constructor(credentials: ChannelCredentials) {
    if (!credentials.store_url || !credentials.token) {
      throw new Error('Shopify: store_url e token são obrigatórios')
    }
    const host = credentials.store_url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
    this.baseUrl = `https://${host}/admin/api/2024-01`
    this.token = credentials.token
  }

  private async shopifyFetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.token,
        ...options.headers,
      },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Shopify API ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async validateCredentials(): Promise<boolean> {
    // GET /shop.json — endpoint mínimo que requer autenticação
    await this.shopifyFetch('/shop.json')
    return true
  }

  async syncStock(items: StockItem[]): Promise<StockSyncResult[]> {
    // Shopify usa inventory_item_id + location_id para controlar estoque.
    // O external_id do channel_listing deve ser o inventory_item_id do variant.
    // Primeiro buscamos a location padrão.
    const locData = await this.shopifyFetch<{
      locations: Array<{ id: number; name: string }>
    }>('/locations.json?limit=1')
    const locationId = locData.locations[0]?.id
    if (!locationId) {
      return items.map(item => ({
        listingId: item.listingId,
        externalId: item.externalId,
        success: false,
        error: 'Nenhuma location encontrada na loja Shopify',
      }))
    }

    const results: StockSyncResult[] = []

    for (const item of items) {
      try {
        await this.shopifyFetch('/inventory_levels/set.json', {
          method: 'POST',
          body: JSON.stringify({
            location_id: Number(locationId),
            inventory_item_id: Number(item.externalId),
            available: item.quantity,
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
      ? `&updated_at_min=${since.toISOString()}`
      : ''
    const data = await this.shopifyFetch<{
      orders: ShopifyOrder[]
    }>(`/orders.json?status=any&limit=100${sinceParam}`)

    return data.orders.map(order => ({
      externalOrderId: String(order.id),
      externalStatus: order.financial_status ?? order.fulfillment_status ?? 'pending',
      status: mapShopifyStatus(order.financial_status, order.fulfillment_status),
      customerName: order.customer
        ? `${order.customer.first_name ?? ''} ${order.customer.last_name ?? ''}`.trim()
        : order.email ?? undefined,
      customerEmail: order.email ?? undefined,
      totalCents: Math.round(parseFloat(order.total_price ?? '0') * 100),
      itemsCount: order.line_items?.length ?? 0,
      rawPayload: order as unknown as Record<string, unknown>,
      createdAt: order.created_at,
    }))
  }
}

// ── Tipos internos Shopify ────────────────────────────────────────────────────

interface ShopifyOrder {
  id: number
  email?: string
  financial_status?: string
  fulfillment_status?: string
  total_price?: string
  created_at: string
  line_items?: unknown[]
  customer?: { first_name?: string; last_name?: string }
}

function mapShopifyStatus(
  financial?: string,
  fulfillment?: string,
): ExternalOrder['status'] {
  if (financial === 'refunded') return 'refunded'
  if (financial === 'voided') return 'canceled'
  if (fulfillment === 'fulfilled') return 'delivered'
  if (fulfillment === 'partial') return 'shipped'
  if (financial === 'paid') return 'confirmed'
  return 'pending'
}

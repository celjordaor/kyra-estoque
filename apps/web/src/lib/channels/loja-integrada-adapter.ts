// ── Loja Integrada API Adapter — Sprint 18b ───────────────────────────────────
// Docs: https://developers.lojaintegrada.com.br/
// Auth: Chave de API no header Authorization: chave {api_key}

import type {
  ChannelAdapter, ChannelCredentials,
  StockItem, StockSyncResult, ExternalOrder,
} from './types'

const LI_BASE = 'https://api.lojaintegrada.com.br/v1'

export class LojaIntegradaAdapter implements ChannelAdapter {
  private readonly apiKey: string

  constructor(credentials: ChannelCredentials) {
    const key = credentials.loja_integrada_api_key ?? credentials.api_key
    if (!key) {
      throw new Error('Loja Integrada: api_key é obrigatório')
    }
    this.apiKey = key
  }

  private async liFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${LI_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `chave ${this.apiKey}`,
        ...options.headers,
      },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Loja Integrada API ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async validateCredentials(): Promise<boolean> {
    // GET /produto/?limit=1 — endpoint leve
    await this.liFetch('/produto/?limit=1')
    return true
  }

  async syncStock(items: StockItem[]): Promise<StockSyncResult[]> {
    // LI: PUT /produto_variacao/{id}/
    // O external_id deve ser o ID da variação do produto na LI.
    const results: StockSyncResult[] = []

    for (const item of items) {
      try {
        await this.liFetch(`/produto_variacao/${item.externalId}/`, {
          method: 'PUT',
          body: JSON.stringify({ quantidade: item.quantity }),
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
      ? `&data_criacao__gte=${since.toISOString().split('T')[0]}`
      : ''
    const data = await this.liFetch<LIOrdersResponse>(
      `/pedido/?limit=100&ordene_por=-numero${sinceParam}`,
    )

    return (data.objects ?? []).map(order => ({
      externalOrderId: String(order.numero),
      externalStatus: order.situacao?.label ?? 'pendente',
      status: mapLIStatus(order.situacao?.label),
      customerName: order.cliente?.nome ?? undefined,
      customerEmail: order.cliente?.email ?? undefined,
      totalCents: Math.round((order.valor_total ?? 0) * 100),
      itemsCount: order.itens?.length ?? 0,
      rawPayload: order as unknown as Record<string, unknown>,
      createdAt: order.data_criacao,
    }))
  }
}

// ── Tipos internos Loja Integrada ─────────────────────────────────────────────

interface LIOrdersResponse {
  objects?: LIOrder[]
}

interface LIOrder {
  numero: number
  situacao?: { label?: string }
  valor_total?: number
  data_criacao: string
  itens?: unknown[]
  cliente?: {
    nome?: string
    email?: string
  }
}

function mapLIStatus(label?: string): ExternalOrder['status'] {
  if (!label) return 'pending'
  const l = label.toLowerCase()
  if (l.includes('aprovado') || l.includes('pago')) return 'confirmed'
  if (l.includes('enviado') || l.includes('transporte')) return 'shipped'
  if (l.includes('entregue')) return 'delivered'
  if (l.includes('cancelado') || l.includes('cancelada')) return 'canceled'
  if (l.includes('devolu') || l.includes('estorn')) return 'refunded'
  return 'pending'
}

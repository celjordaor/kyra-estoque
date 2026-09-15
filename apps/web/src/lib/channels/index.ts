// ── Channel Adapter Factory — Sprint 18b ────────────────────────────────────
// Uso: const adapter = getChannelAdapter(type, config)
// Nunca instanciar adapters diretamente fora deste módulo.

import type { ChannelAdapter, ChannelCredentials } from './types'
import { ShopifyAdapter } from './shopify-adapter'
import { MercadoLivreAdapter } from './mercado-livre-adapter'
import { WooCommerceAdapter } from './woocommerce-adapter'
import { LojaIntegradaAdapter } from './loja-integrada-adapter'

export type { ChannelAdapter, ChannelCredentials, StockItem, StockSyncResult, ExternalOrder, SyncResult } from './types'

type ChannelType =
  | 'mercado_livre'
  | 'shopify'
  | 'woocommerce'
  | 'loja_integrada'
  | 'instagram'
  | 'whatsapp'
  | 'loja_virtual'

/**
 * Factory: retorna o adapter correto para o tipo de canal.
 * O `config` vem direto do campo jsonb `company_integrations.config`.
 *
 * Para canais sem adapter real (instagram, whatsapp, loja_virtual),
 * lança erro — devem ser tratados antes de chamar esta função.
 */
export function getChannelAdapter(
  type: ChannelType,
  config: Record<string, unknown>,
): ChannelAdapter {
  const creds = config as ChannelCredentials

  switch (type) {
    case 'shopify':
      return new ShopifyAdapter(creds)

    case 'mercado_livre':
      return new MercadoLivreAdapter(creds)

    case 'woocommerce':
      return new WooCommerceAdapter(creds)

    case 'loja_integrada':
      return new LojaIntegradaAdapter(creds)

    case 'instagram':
    case 'whatsapp':
    case 'loja_virtual':
      throw new Error(
        `Canal "${type}" ainda não possui adapter de sincronização automática. ` +
        'Configure manualmente via painel do canal.',
      )

    default:
      throw new Error(`Canal desconhecido: ${String(type)}`)
  }
}

/** Retorna true se o canal tem adapter real de sync */
export function channelHasAdapter(type: string): boolean {
  return ['shopify', 'mercado_livre', 'woocommerce', 'loja_integrada'].includes(type)
}

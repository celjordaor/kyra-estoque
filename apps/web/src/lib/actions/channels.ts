'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { canUse, hasFeature } from '@kyra/business-rules'
import { revalidatePath } from 'next/cache'
import { getChannelAdapter, channelHasAdapter } from '@/lib/channels'

// ── Context ───────────────────────────────────────────────────────────────────

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id as string }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChannelType =
  | 'mercado_livre'
  | 'shopify'
  | 'woocommerce'
  | 'loja_integrada'
  | 'instagram'
  | 'whatsapp'
  | 'loja_virtual'

export type ChannelStatus = 'connected' | 'error' | 'inactive'

export interface ChannelSyncConfig {
  sync_stock: boolean
  sync_prices: boolean
  auto_publish: boolean
}

export interface ChannelData {
  id: string
  type: ChannelType
  is_active: boolean
  status: ChannelStatus
  account_name: string
  products_published: number
  orders_today: number
  last_sync_at: string | null
  sync_error: string | null
  sync_config: ChannelSyncConfig
}

export interface ConnectChannelInput {
  type: ChannelType
  credentials: {
    api_key?: string
    token?: string
    store_url?: string
    client_id?: string
    client_secret?: string
  }
  sync_config: ChannelSyncConfig
  account_name?: string
}

// ── getChannels ───────────────────────────────────────────────────────────────

export async function getChannels(): Promise<{
  channels: ChannelData[]
  canAddMore: boolean
  limit: number | null
  hasAdvanced: boolean
}> {
  const { admin, companyId } = await getServerContext()

  const CHANNEL_TYPES: ChannelType[] = [
    'mercado_livre', 'shopify', 'woocommerce',
    'loja_integrada', 'instagram', 'whatsapp', 'loja_virtual',
  ]

  const { data: integrations } = await admin
    .from('company_integrations')
    .select('id, type, is_active, config')
    .eq('company_id', companyId)
    .in('type', CHANNEL_TYPES)

  const today = new Date().toISOString().slice(0, 10)

  // Contar pedidos de hoje por integração
  const channels: ChannelData[] = (integrations ?? []).map(int => {
    const cfg = (int.config ?? {}) as Record<string, unknown>
    const hasSyncError = typeof cfg.sync_error === 'string' && cfg.sync_error.length > 0
    return {
      id: int.id,
      type: int.type as ChannelType,
      is_active: int.is_active,
      status: !int.is_active ? 'inactive' : hasSyncError ? 'error' : 'connected',
      account_name: (cfg.account_name as string) ?? '',
      products_published: (cfg.products_published as number) ?? 0,
      orders_today: (cfg.orders_today as number) ?? 0,
      last_sync_at: (cfg.last_sync_at as string) ?? null,
      sync_error: (cfg.sync_error as string) ?? null,
      sync_config: {
        sync_stock:   (cfg.sync_stock   as boolean) ?? true,
        sync_prices:  (cfg.sync_prices  as boolean) ?? true,
        auto_publish: (cfg.auto_publish as boolean) ?? false,
      },
    }
  })

  const activeCount = channels.filter(c => c.is_active).length
  const check = await canUse(companyId, 'channels.max')
  const hasAdvanced = await hasFeature(companyId, 'channels.advanced.enabled')

  return {
    channels,
    canAddMore: check.limit === null || activeCount < (check.limit ?? 0),
    limit: check.limit,
    hasAdvanced,
  }
}

// ── connectChannel ────────────────────────────────────────────────────────────

export async function connectChannel(input: ConnectChannelInput): Promise<{
  ok: boolean
  error?: string
  limitReached?: boolean
}> {
  const { admin, companyId } = await getServerContext()

  // Verificar limite de canais
  const { data: existing } = await admin
    .from('company_integrations')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const activeCount = existing?.length ?? 0
  const check = await canUse(companyId, 'channels.max')

  if (check.limit !== null && activeCount >= check.limit) {
    return { ok: false, limitReached: true, error: `Limite de ${check.limit} canal(is) atingido no seu plano.` }
  }

  // Validar credenciais mínimas por tipo
  const { credentials, sync_config, type, account_name } = input
  if (!credentials.api_key && !credentials.token) {
    return { ok: false, error: 'Credenciais inválidas. Informe ao menos uma chave de API ou token.' }
  }

  // Upsert (one row per type per company)
  const config = {
    api_key:            credentials.api_key ?? null,
    token:              credentials.token ?? null,
    store_url:          credentials.store_url ?? null,
    client_id:          credentials.client_id ?? null,
    client_secret:      credentials.client_secret ?? null,
    account_name:       account_name ?? credentials.store_url ?? type,
    sync_stock:         sync_config.sync_stock,
    sync_prices:        sync_config.sync_prices,
    auto_publish:       sync_config.auto_publish,
    products_published: 0,
    orders_today:       0,
    last_sync_at:       null,
    sync_error:         null,
  }

  const { error } = await admin
    .from('company_integrations')
    .upsert(
      { company_id: companyId, type, is_active: true, config },
      { onConflict: 'company_id,type' }
    )

  if (error) return { ok: false, error: error.message }

  revalidatePath('/channels')
  return { ok: true }
}

// ── disconnectChannel ─────────────────────────────────────────────────────────

export async function disconnectChannel(integrationId: string): Promise<{ ok: boolean; error?: string }> {
  const { admin, companyId } = await getServerContext()

  const { error } = await admin
    .from('company_integrations')
    .update({ is_active: false, config: {} })
    .eq('id', integrationId)
    .eq('company_id', companyId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/channels')
  return { ok: true }
}

// ── updateChannelConfig ───────────────────────────────────────────────────────

export async function updateChannelConfig(
  integrationId: string,
  sync_config: ChannelSyncConfig
): Promise<{ ok: boolean; error?: string }> {
  const { admin, companyId } = await getServerContext()

  // Buscar config atual
  const { data: int } = await admin
    .from('company_integrations')
    .select('config')
    .eq('id', integrationId)
    .eq('company_id', companyId)
    .single()

  if (!int) return { ok: false, error: 'Integração não encontrada' }

  const newConfig = {
    ...(int.config as Record<string, unknown>),
    sync_stock:   sync_config.sync_stock,
    sync_prices:  sync_config.sync_prices,
    auto_publish: sync_config.auto_publish,
  }

  const { error } = await admin
    .from('company_integrations')
    .update({ config: newConfig })
    .eq('id', integrationId)
    .eq('company_id', companyId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/channels')
  return { ok: true }
}

// ── syncChannel ───────────────────────────────────────────────────────────────
// Sprint 18b: usa adapters reais para sincronizar estoque e buscar pedidos.
// Para canais sem adapter (instagram, whatsapp) só atualiza o timestamp.

export async function syncChannel(integrationId: string): Promise<{ ok: boolean; error?: string }> {
  const { admin, companyId } = await getServerContext()

  // 1. Busca a integração
  const { data: int } = await admin
    .from('company_integrations')
    .select('config, type')
    .eq('id', integrationId)
    .eq('company_id', companyId)
    .single()

  if (!int) return { ok: false, error: 'Integração não encontrada' }

  const cfg = (int.config ?? {}) as Record<string, unknown>
  const channelType = int.type as string

  // 2. Se o canal tem adapter real, sincroniza estoque e pedidos
  if (channelHasAdapter(channelType)) {
    try {
      const adapter = getChannelAdapter(
        channelType as Parameters<typeof getChannelAdapter>[0],
        cfg,
      )

      // 2a. Busca listings ativos com estoque do produto
      const { data: listings } = await admin
        .from('channel_listings')
        .select(`
          id,
          external_id,
          external_sku,
          sync_stock,
          sync_prices,
          last_synced_at,
          products ( id, stock_quantity, price_cents )
        `)
        .eq('company_id', companyId)
        .eq('integration_id', integrationId)
        .eq('status', 'active')

      // 2b. Sincroniza estoque nos listings que têm sync_stock = true
      const stockItems = (listings ?? [])
        .filter((l: Record<string, unknown>) => l.sync_stock)
        .map((l: Record<string, unknown>) => {
          const product = l.products as Record<string, unknown> | null
          return {
            listingId: l.id as string,
            externalId: l.external_id as string,
            externalSku: l.external_sku as string | undefined,
            quantity: (product?.stock_quantity as number) ?? 0,
            priceCents: l.sync_prices ? (product?.price_cents as number) ?? 0 : undefined,
          }
        })

      const stockResults = stockItems.length > 0
        ? await adapter.syncStock(stockItems)
        : []

      // 2c. Atualiza sync_error por listing
      for (const r of stockResults) {
        await admin
          .from('channel_listings')
          .update({
            last_synced_at: new Date().toISOString(),
            sync_error: r.success ? null : r.error ?? 'Erro desconhecido',
          })
          .eq('id', r.listingId)
      }

      // 2d. Busca pedidos novos desde a última sync
      const lastSync = cfg.last_sync_at ? new Date(cfg.last_sync_at as string) : undefined
      const orders = await adapter.fetchOrders(lastSync)

      // 2e. Upsert channel_orders
      if (orders.length > 0) {
        const rows = orders.map(o => ({
          company_id: companyId,
          integration_id: integrationId,
          external_order_id: o.externalOrderId,
          status: o.status,
          external_status: o.externalStatus,
          customer_name: o.customerName ?? null,
          customer_email: o.customerEmail ?? null,
          total_cents: o.totalCents,
          items_count: o.itemsCount,
          raw_payload: o.rawPayload,
        }))

        await admin
          .from('channel_orders')
          .upsert(rows, { onConflict: 'integration_id,external_order_id', ignoreDuplicates: false })
      }

      // 2f. Atualiza config com timestamp e contadores
      const failedListings = stockResults.filter(r => !r.success).length
      const newConfig = {
        ...cfg,
        last_sync_at: new Date().toISOString(),
        sync_error: failedListings > 0
          ? `${failedListings} produto(s) com erro ao sincronizar`
          : null,
        orders_today: ((cfg.orders_today as number) ?? 0) + orders.length,
        products_published: listings?.length ?? 0,
      }

      await admin
        .from('company_integrations')
        .update({ config: newConfig })
        .eq('id', integrationId)
        .eq('company_id', companyId)

    } catch (err) {
      // Salva o erro de sincronização sem derrubar a integração
      const errMsg = err instanceof Error ? err.message : String(err)
      await admin
        .from('company_integrations')
        .update({ config: { ...cfg, sync_error: errMsg, last_sync_at: new Date().toISOString() } })
        .eq('id', integrationId)
        .eq('company_id', companyId)

      revalidatePath('/channels')
      return { ok: false, error: errMsg }
    }
  } else {
    // Canal sem adapter (instagram, whatsapp, loja_virtual): só atualiza timestamp
    await admin
      .from('company_integrations')
      .update({ config: { ...cfg, last_sync_at: new Date().toISOString(), sync_error: null } })
      .eq('id', integrationId)
      .eq('company_id', companyId)
  }

  revalidatePath('/channels')
  return { ok: true }
}

// ── getChannelOrders ──────────────────────────────────────────────────────────

export async function getChannelOrders(integrationId: string) {
  const { admin, companyId } = await getServerContext()

  const { data } = await admin
    .from('channel_orders')
    .select('id, external_order_id, status, customer_name, total_cents, items_count, created_at')
    .eq('company_id', companyId)
    .eq('integration_id', integrationId)
    .order('created_at', { ascending: false })
    .limit(50)

  return data ?? []
}

// ── getChannelListings ────────────────────────────────────────────────────────

export async function getChannelListings(integrationId: string) {
  const { admin, companyId } = await getServerContext()

  const { data } = await admin
    .from('channel_listings')
    .select(`
      id, status, external_id, external_url, last_synced_at, sync_error,
      products ( id, name, sku, price_cents )
    `)
    .eq('company_id', companyId)
    .eq('integration_id', integrationId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100)

  return data ?? []
}

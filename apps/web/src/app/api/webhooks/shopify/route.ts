// ── Shopify Webhook — Sprint 21 (fix: secret por-tenant) ─────────────────────
// Recebe eventos: orders/create, orders/updated, inventory_levels/update
// Verificação: HMAC-SHA256 do body com secret por-tenant (company_integrations.config.webhook_secret)
// Docs: https://shopify.dev/docs/apps/build/webhooks/subscribe/event-topics

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'

function verifyShopifyHmac(rawBody: Buffer, hmacHeader: string, secret: string): boolean {
  if (!secret) return false
  const digest = createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64')
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer())
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256') ?? ''
  const topic = req.headers.get('x-shopify-topic') ?? ''
  const shopDomain = req.headers.get('x-shopify-shop-domain') ?? ''

  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()

  // 1. Identifica o tenant pelo shopDomain ANTES de verificar o HMAC
  //    (o secret fica em company_integrations.config.webhook_secret por-tenant)
  const { data: integrations } = await (admin as any)
    .from('company_integrations')
    .select('id, company_id, config')
    .eq('type', 'shopify')
    .eq('is_active', true)

  const integration = (integrations ?? []).find((i: any) => {
    const cfg = i.config as Record<string, unknown>
    const url = (cfg.store_url as string ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')
    return url === shopDomain
  })

  if (!integration) {
    // Loja não cadastrada — retorna 200 para não gerar retry no Shopify
    return NextResponse.json({ ok: true })
  }

  // 2. Verifica HMAC com o secret por-tenant
  const cfg = integration.config as Record<string, unknown>
  const webhookSecret = (cfg.webhook_secret as string) ?? ''

  if (!verifyShopifyHmac(rawBody, hmacHeader, webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>
  const { id: integrationId, company_id: companyId } = integration

  if (topic === 'orders/create' || topic === 'orders/updated') {
    const order = payload as {
      id?: number
      financial_status?: string
      fulfillment_status?: string
      total_price?: string
      created_at?: string
      line_items?: unknown[]
      email?: string
      customer?: { first_name?: string; last_name?: string }
    }

    const statusMap: Record<string, string> = {
      refunded: 'refunded',
      voided: 'canceled',
    }

    let status = 'pending'
    if (order.financial_status && statusMap[order.financial_status]) {
      status = statusMap[order.financial_status] as string
    } else if (order.fulfillment_status === 'fulfilled') {
      status = 'delivered'
    } else if (order.fulfillment_status === 'partial') {
      status = 'shipped'
    } else if (order.financial_status === 'paid') {
      status = 'confirmed'
    }

    await (admin as any).from('channel_orders').upsert({
      company_id: companyId,
      integration_id: integrationId,
      external_order_id: String(order.id),
      status,
      external_status: (order.financial_status ?? order.fulfillment_status ?? 'unknown') as string,
      customer_name: order.customer
        ? `${order.customer.first_name ?? ''} ${order.customer.last_name ?? ''}`.trim()
        : (order.email ?? null),
      customer_email: order.email ?? null,
      total_cents: Math.round(parseFloat(order.total_price ?? '0') * 100),
      items_count: order.line_items?.length ?? 0,
      raw_payload: payload,
    }, { onConflict: 'integration_id,external_order_id' })
  }

  return NextResponse.json({ ok: true })
}

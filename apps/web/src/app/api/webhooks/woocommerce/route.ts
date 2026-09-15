// ── WooCommerce Webhook — Sprint 21 (fix: secret por-tenant + lookup correto) ─
// Eventos: order.created, order.updated
// Verificação: header x-wc-webhook-signature com HMAC-SHA256 por-tenant
// Docs: https://woocommerce.com/document/webhooks/

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'

function verifyWCSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!secret) return false
  const digest = createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64')
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

/** Normaliza URL removendo protocolo e trailing slash para comparação */
function normalizeUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
}

export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer())
  const signature = req.headers.get('x-wc-webhook-signature') ?? ''
  const topic = req.headers.get('x-wc-webhook-topic') ?? ''
  // WC envia a URL base da loja neste header
  const source = req.headers.get('x-wc-webhook-source') ?? ''

  if (!source) {
    return NextResponse.json({ error: 'Missing webhook source' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()

  // 1. Identifica o tenant pelo store_url ANTES de verificar a assinatura
  //    (o secret fica em company_integrations.config.webhook_secret por-tenant)
  const { data: integrations } = await (admin as any)
    .from('company_integrations')
    .select('id, company_id, config')
    .eq('type', 'woocommerce')
    .eq('is_active', true)

  const normalizedSource = normalizeUrl(source)

  const integration = (integrations ?? []).find((i: any) => {
    const cfg = i.config as Record<string, unknown>
    const storeUrl = normalizeUrl(cfg.store_url as string ?? '')
    return storeUrl === normalizedSource
  })

  if (!integration) {
    // Loja não cadastrada — retorna 200 para não gerar retry no WooCommerce
    return NextResponse.json({ ok: true })
  }

  // 2. Verifica assinatura com o secret por-tenant
  const cfg = integration.config as Record<string, unknown>
  const webhookSecret = (cfg.webhook_secret as string) ?? ''

  if (!verifyWCSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!topic.startsWith('order.')) {
    return NextResponse.json({ ok: true })
  }

  const payload = JSON.parse(rawBody.toString('utf-8')) as {
    id?: number
    status?: string
    total?: string
    date_created?: string
    line_items?: unknown[]
    billing?: { first_name?: string; last_name?: string; email?: string }
  }

  const { id: integrationId, company_id: companyId } = integration

  const wcStatusMap: Record<string, string> = {
    processing:  'confirmed',
    completed:   'delivered',
    refunded:    'refunded',
    cancelled:   'canceled',
    failed:      'canceled',
    'on-hold':   'pending',
  }

  await (admin as any).from('channel_orders').upsert({
    company_id: companyId,
    integration_id: integrationId,
    external_order_id: String(payload.id),
    status: wcStatusMap[payload.status ?? ''] ?? 'pending',
    external_status: payload.status ?? 'unknown',
    customer_name: payload.billing
      ? `${payload.billing.first_name ?? ''} ${payload.billing.last_name ?? ''}`.trim()
      : null,
    customer_email: payload.billing?.email ?? null,
    total_cents: Math.round(parseFloat(payload.total ?? '0') * 100),
    items_count: payload.line_items?.length ?? 0,
    raw_payload: payload as unknown as Record<string, unknown>,
  }, { onConflict: 'integration_id,external_order_id' })

  return NextResponse.json({ ok: true })
}

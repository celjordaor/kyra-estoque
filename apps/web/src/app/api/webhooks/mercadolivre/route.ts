// ── Mercado Livre Webhook (Notifications) — Sprint 18b ──────────────────────
// ML envia notificações para tópicos: orders_v2, items
// Verificação: header x-signature com HMAC-SHA256 (v2)
// Docs: https://developers.mercadolivre.com.br/pt_br/notificacoes-e-webhooks

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'

const CLIENT_SECRET = process.env.MERCADOLIVRE_CLIENT_SECRET ?? ''

function verifyMLSignature(rawBody: string, xSignature: string, xRequestId: string): boolean {
  if (!CLIENT_SECRET) return false
  // Formato do manifesto: ts={ts};v1={hash}
  const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')))
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false
  const message = `id:${xRequestId};request-id:${xRequestId};ts:${ts};`
  const digest = createHmac('sha256', CLIENT_SECRET).update(message).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(v1))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const xSignature = req.headers.get('x-signature') ?? ''
  const xRequestId = req.headers.get('x-request-id') ?? ''

  if (CLIENT_SECRET && !verifyMLSignature(rawBody, xSignature, xRequestId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody) as {
    topic?: string
    resource?: string
    user_id?: number
  }

  const { topic, resource, user_id } = payload

  // Apenas processamos notificações de pedidos
  if (topic !== 'orders_v2' || !resource || !user_id) {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminSupabaseClient()

  // Acha integração pelo seller_id
  const { data: integrations } = await (admin as any)
    .from('company_integrations')
    .select('id, company_id, config')
    .eq('type', 'mercado_livre')
    .eq('is_active', true)

  const integration = (integrations ?? []).find(i => {
    const cfg = i.config as Record<string, unknown>
    return String(cfg.seller_id) === String(user_id)
  })

  if (!integration) return NextResponse.json({ ok: true })

  const { id: integrationId, company_id: companyId, config } = integration
  const cfg = config as Record<string, unknown>

  // Busca detalhes do pedido via API ML
  const accessToken = cfg.access_token as string | undefined
  if (!accessToken) return NextResponse.json({ ok: true })

  const orderId = resource.replace('/orders/', '').replace(/\//g, '')

  const mlRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!mlRes.ok) return NextResponse.json({ ok: true })

  const order = await mlRes.json() as {
    id?: number
    status?: string
    total_amount?: number
    date_created?: string
    order_items?: unknown[]
    buyer?: { first_name?: string; last_name?: string; email?: string }
  }

  const mlStatusMap: Record<string, string> = {
    paid:               'confirmed',
    confirmed:          'pending',
    payment_required:   'pending',
    refunded:           'refunded',
    cancelled:          'canceled',
  }

  await (admin as any).from('channel_orders').upsert({
    company_id: companyId,
    integration_id: integrationId,
    external_order_id: String(order.id),
    status: mlStatusMap[order.status ?? ''] ?? 'pending',
    external_status: order.status ?? 'unknown',
    customer_name: order.buyer
      ? `${order.buyer.first_name ?? ''} ${order.buyer.last_name ?? ''}`.trim()
      : null,
    customer_email: order.buyer?.email ?? null,
    total_cents: Math.round((order.total_amount ?? 0) * 100),
    items_count: order.order_items?.length ?? 0,
    raw_payload: order as unknown as Record<string, unknown>,
  }, { onConflict: 'integration_id,external_order_id' })

  return NextResponse.json({ ok: true })
}

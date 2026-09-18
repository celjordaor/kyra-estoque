import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'
import { getBillingProvider } from '@kyra/business-rules'

// Webhook Asaas — processa eventos de pagamento
export async function POST(req: NextRequest) {
  try {
    const asaasToken = req.headers.get('asaas-access-token')
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN
    if (!expectedToken || asaasToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await req.json()
    const provider = getBillingProvider()
    const result = await provider.handleWebhook(payload)

    const supabase = createAdminSupabaseClient()

    // Registrar evento idempotente
    const eventKey = `${result.event}_${result.chargeId ?? Date.now()}`
    await (supabase as any).from('billing_events').insert({
      provider: 'asaas',
      event_id: eventKey,
      event_type: result.event,
      payload,
      status: 'processing',
    })

    // Atualizar status da transação financeira
    if (result.chargeId && result.status) {
      const statusMap: Record<string, string> = {
        RECEIVED: 'paid', CONFIRMED: 'paid',
        OVERDUE: 'overdue',
        CANCELLED: 'canceled', REFUNDED: 'canceled',
      }
      const newStatus = statusMap[result.status]
      if (newStatus) {
        await (supabase as any)
          .from('financial_transactions')
          .update({
            status: newStatus,
            paid_at: newStatus === 'paid' ? (result.paidAt ?? new Date().toISOString()) : null,
          })
          .eq('provider_charge_id', result.chargeId)
      }
    }

    await (supabase as any).from('billing_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('event_id', eventKey)
      .eq('provider', 'asaas')

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[webhook/asaas]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

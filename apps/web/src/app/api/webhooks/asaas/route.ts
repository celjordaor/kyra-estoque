import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'
import { getBillingProvider } from '@kyra/business-rules'
import { applyEventToSubscription, SUB_COLS } from '@/lib/billing/subscription-sync'

/**
 * Webhook do Asaas da Kyra — eventos de pagamento/assinatura dos planos.
 * Autenticado pelo header `asaas-access-token` (= ASAAS_WEBHOOK_TOKEN).
 */
export async function POST(req: NextRequest) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN
  if (!expectedToken || req.headers.get('asaas-access-token') !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try { payload = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  const admin = createAdminSupabaseClient() as any
  const result = await getBillingProvider().handleWebhook(payload)
  const eventId = result.eventId ?? `${result.event}_${result.chargeId ?? result.subscriptionId ?? 'x'}_${payload?.dateCreated ?? ''}`

  try {
    // Idempotência: o Asaas reenvia se não respondermos 200
    const { error: insErr } = await admin.from('billing_events').insert({
      provider: 'asaas', event_id: eventId, event_type: result.event, payload, status: 'pending',
    })
    if (insErr) {
      const { data: existing } = await admin.from('billing_events').select('status')
        .eq('provider', 'asaas').eq('event_id', eventId).maybeSingle()
      if (existing?.status === 'processed') return NextResponse.json({ received: true, duplicate: true })
      await admin.from('billing_events').update({ status: 'pending', error_message: null })
        .eq('provider', 'asaas').eq('event_id', eventId)
    }

    // Localiza a assinatura: pelo ID da recorrência; senão pela referência (company_id)
    let sub: any = null
    if (result.subscriptionId) {
      const { data } = await admin.from('subscriptions').select(SUB_COLS)
        .eq('provider_subscription_id', result.subscriptionId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      sub = data
    }
    if (!sub && result.externalReference) {
      const { data } = await admin.from('subscriptions').select(SUB_COLS)
        .eq('company_id', result.externalReference).eq('provider', 'asaas').order('created_at', { ascending: false }).limit(1).maybeSingle()
      sub = data
    }

    let outcome = 'sem assinatura vinculada'
    if (sub) {
      // Cartão: CONFIRMED e depois RECEIVED do mesmo pagamento — só o primeiro gera crédito
      let alreadyCredited = false
      if ((result.event === 'PAYMENT_CONFIRMED' || result.event === 'PAYMENT_RECEIVED') && result.chargeId) {
        const { count } = await admin.from('billing_events').select('id', { count: 'exact', head: true })
          .eq('provider', 'asaas').eq('status', 'processed')
          .in('event_type', ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])
          .filter('payload->payment->>id', 'eq', result.chargeId)
        alreadyCredited = (count ?? 0) > 0
      }
      outcome = await applyEventToSubscription(admin, sub, { event: result.event, paidAt: result.paidAt, alreadyCredited })
    }

    await admin.from('billing_events').update({
      status: 'processed', processed_at: new Date().toISOString(), error_message: sub ? outcome : outcome,
    }).eq('provider', 'asaas').eq('event_id', eventId)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[webhook/asaas]', error)
    await admin.from('billing_events').update({
      status: 'failed', error_message: error instanceof Error ? error.message : String(error),
    }).eq('provider', 'asaas').eq('event_id', eventId)
    // 500 → o Asaas tenta de novo
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Webhook Asaas POR EMPRESA — o cliente cadastra esta URL + token no painel do Asaas dele.
// Atualiza o status das cobranças (financial_transactions) da própria empresa.

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminSupabaseClient } from '@kyra/database'

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const STATUS_MAP: Record<string, string> = {
  RECEIVED: 'paid', CONFIRMED: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'canceled', REFUNDED: 'canceled',
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params
  const admin = createAdminSupabaseClient()

  const { data: integ } = await (admin as any)
    .from('company_integrations')
    .select('config, is_active')
    .eq('company_id', companyId)
    .eq('type', 'asaas')
    .maybeSingle()

  const expected = ((integ?.config ?? {}) as Record<string, string>).webhook_token ?? ''
  const received = req.headers.get('asaas-access-token') ?? ''
  if (!integ?.is_active || !expected || !safeEqual(received, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: { event?: string; payment?: { id?: string; status?: string; paymentDate?: string } }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const chargeId = payload.payment?.id
  const status = STATUS_MAP[payload.payment?.status ?? '']
  if (chargeId && status) {
    await (admin as any)
      .from('financial_transactions')
      .update({
        status,
        paid_at: status === 'paid' ? (payload.payment?.paymentDate ?? new Date().toISOString()) : null,
      })
      .eq('provider_charge_id', chargeId)
      .eq('company_id', companyId)
  }

  return NextResponse.json({ received: true })
}

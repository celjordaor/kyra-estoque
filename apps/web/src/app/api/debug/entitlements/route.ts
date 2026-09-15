/**
 * GET /api/debug/entitlements
 * Diagnóstico: verifica assinaturas e entitlements no banco.
 * REMOVER antes de ir para produção.
 */
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'

export async function GET() {
  try {
    const admin = createAdminSupabaseClient()

    const [
      { data: companies },
      { data: subscriptions, error: subErr },
      { data: plans },
      { data: entitlements, error: entErr },
    ] = await Promise.all([
      admin.from('companies').select('id, name').limit(10),
      admin.from('subscriptions').select('id, company_id, plan_id, status, current_period_start, current_period_end, provider').limit(20),
      admin.from('plans').select('id, slug, name'),
      admin.from('plan_entitlements').select('plan_id, feature_key, value_type, int_value, bool_value, str_value').eq('feature_key', 'financial.enabled'),
    ])

    return NextResponse.json({
      companies,
      subscriptions,
      subscriptionError: subErr?.message ?? null,
      plans,
      financialEntitlements: entitlements,
      entitlementError: entErr?.message ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

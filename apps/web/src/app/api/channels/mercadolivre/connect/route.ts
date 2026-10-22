// Inicia o OAuth do Mercado Livre: redireciona o cliente para autorizar o app Kyra.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { canUse } from '@kyra/business-rules'
import { buildAuthUrl, getMlAppCredentials, signState } from '@/lib/channels/mercado-livre-oauth'

export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  const back = (q: string) => NextResponse.redirect(`${origin}/channels?ml=${q}`)

  if (!getMlAppCredentials().configured) return back('not_configured')

  const supabase = createServerSupabaseClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const admin = createAdminSupabaseClient()
  const { data: profile } = await (admin as any).from('profiles').select('company_id').eq('id', user.id).single()
  const companyId = (profile as { company_id: string | null } | null)?.company_id
  if (!companyId) return back('error')

  // Respeita o limite de canais do plano (reconectar um canal já ativo é permitido)
  const { data: existing } = await (admin as any)
    .from('company_integrations').select('id, type').eq('company_id', companyId).eq('is_active', true)
  const rows = (existing ?? []) as { id: string; type: string }[]
  const alreadyML = rows.some(r => r.type === 'mercado_livre')
  if (!alreadyML) {
    const check = await canUse(companyId, 'channels.max')
    if (check.limit !== null && rows.length >= check.limit) return back('limit')
  }

  return NextResponse.redirect(buildAuthUrl(signState(companyId, user.id)))
}

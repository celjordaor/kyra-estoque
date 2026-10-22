// Retorno do OAuth do Mercado Livre: troca o code por tokens e grava na empresa.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { exchangeCode, verifyState } from '@/lib/channels/mercado-livre-oauth'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const back = (q: string) => NextResponse.redirect(`${url.origin}/channels?ml=${q}`)

  if (url.searchParams.get('error')) return back('denied')
  const code = url.searchParams.get('code')
  const state = verifyState(url.searchParams.get('state') ?? '')
  if (!code || !state) return back('error')

  // O usuário logado precisa ser o mesmo que iniciou o fluxo
  const supabase = createServerSupabaseClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== state.userId) return back('error')

  try {
    const tokens = await exchangeCode(code)
    const admin = createAdminSupabaseClient()

    const meRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const me = meRes.ok ? await meRes.json() as { nickname?: string } : {}

    // Preserva preferências de sync se o canal já existia
    const { data: current } = await (admin as any)
      .from('company_integrations').select('config')
      .eq('company_id', state.companyId).eq('type', 'mercado_livre').maybeSingle()
    const prev = ((current as { config: Record<string, unknown> | null } | null)?.config ?? {}) as Record<string, unknown>

    const config = {
      sync_stock: true, sync_prices: true, auto_publish: false,
      products_published: 0, orders_today: 0, last_sync_at: null, sync_error: null,
      webhook_secret: randomBytes(32).toString('hex'),
      ...prev,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      seller_id: String(tokens.user_id),
      account_name: me.nickname ?? `ML ${tokens.user_id}`,
    }

    const { error } = await (admin as any).from('company_integrations').upsert(
      { company_id: state.companyId, type: 'mercado_livre', is_active: true, config },
      { onConflict: 'company_id,type' },
    )
    if (error) return back('error')
    return back('connected')
  } catch (e) {
    console.error('[ml-oauth] callback error:', e)
    return back('error')
  }
}

// ── Mercado Livre OAuth — app único do Kyra ─────────────────────────────────
// Cada cliente autoriza o app Kyra com a própria conta de vendedor.
// Env: MERCADOLIVRE_CLIENT_ID, MERCADOLIVRE_CLIENT_SECRET
// Docs: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao

import { createHmac, timingSafeEqual } from 'crypto'

const AUTH_URL = 'https://auth.mercadolivre.com.br/authorization'
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token'
const STATE_TTL_MS = 10 * 60 * 1000
const REFRESH_MARGIN_MS = 5 * 60 * 1000

export function getMlAppCredentials() {
  const clientId = process.env.MERCADOLIVRE_CLIENT_ID ?? ''
  const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET ?? ''
  return { clientId, clientSecret, configured: !!(clientId && clientSecret) }
}

export function getMlRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kyraestoque.com.br'
  return `${base.replace(/\/$/, '')}/api/channels/mercadolivre/callback`
}

// ── state assinado (anti-CSRF + identifica a empresa) ────────────────────────

function sign(payload: string): string {
  return createHmac('sha256', getMlAppCredentials().clientSecret).update(payload).digest('hex')
}

export function signState(companyId: string, userId: string): string {
  const payload = `${companyId}.${userId}.${Date.now()}`
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`
}

export function verifyState(state: string): { companyId: string; userId: string } | null {
  const [b64, sig] = state.split('.')
  if (!b64 || !sig) return null
  const payload = Buffer.from(b64, 'base64url').toString()
  const expected = sign(payload)
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
  } catch {
    return null
  }
  const [companyId, userId, ts] = payload.split('.')
  if (!companyId || !userId || !ts) return null
  if (Date.now() - Number(ts) > STATE_TTL_MS) return null
  return { companyId, userId }
}

export function buildAuthUrl(state: string): string {
  const { clientId } = getMlAppCredentials()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getMlRedirectUri(),
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

// ── tokens ───────────────────────────────────────────────────────────────────

export interface MlTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user_id: number
}

async function tokenRequest(body: Record<string, string>): Promise<MlTokenResponse> {
  const { clientId, clientSecret } = getMlAppCredentials()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  })
  if (!res.ok) throw new Error(`Mercado Livre OAuth ${res.status}: ${await res.text()}`)
  return res.json() as Promise<MlTokenResponse>
}

export function exchangeCode(code: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: getMlRedirectUri() })
}

/**
 * Garante access_token válido na config da integração. Se estiver perto de expirar,
 * renova (o refresh_token do ML é de uso único, então persiste o novo par).
 */
export async function ensureFreshMlConfig(
  admin: any,
  integrationId: string,
  cfg: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const expiresAt = typeof cfg.expires_at === 'number' ? cfg.expires_at : 0
  const refreshToken = typeof cfg.refresh_token === 'string' ? cfg.refresh_token : ''
  if (!refreshToken || expiresAt - Date.now() > REFRESH_MARGIN_MS) return cfg

  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
  const next = {
    ...cfg,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: Date.now() + t.expires_in * 1000,
  }
  await admin.from('company_integrations').update({ config: next }).eq('id', integrationId)
  return next
}

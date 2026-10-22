// Cliente da WhatsApp Cloud API (Meta). Sem credenciais, opera em modo simulado.
// Env: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET,
//      WHATSAPP_VERIFY_TOKEN, WHATSAPP_TEMPLATE_LANG (padrão pt_BR)

import { createHmac, timingSafeEqual } from 'crypto'

const GRAPH = 'https://graph.facebook.com/v21.0'

export function getWaConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
  return {
    phoneNumberId,
    accessToken,
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    lang: process.env.WHATSAPP_TEMPLATE_LANG ?? 'pt_BR',
    configured: !!(phoneNumberId && accessToken),
  }
}

async function post(payload: Record<string, unknown>): Promise<string> {
  const { phoneNumberId, accessToken } = getWaConfig()
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  })
  const json = await res.json().catch(() => ({})) as { messages?: { id: string }[]; error?: { message?: string } }
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${json.error?.message ?? 'erro desconhecido'}`)
  return json.messages?.[0]?.id ?? ''
}

/** Texto livre — só funciona com a janela de 24h aberta (o usuário escreveu há pouco). */
export function sendWaText(to: string, body: string) {
  return post({ to, type: 'text', text: { body, preview_url: false } })
}

/**
 * Mensagem de modelo aprovado. Parâmetros de corpo não aceitam quebra de linha.
 * `buttonCode` é para modelos de autenticação (botão copiar código).
 */
export function sendWaTemplate(to: string, name: string, params: string[], buttonCode?: string) {
  const components: Record<string, unknown>[] = []
  if (params.length) {
    components.push({
      type: 'body',
      parameters: params.map(t => ({ type: 'text', text: t.replace(/\s*\n+\s*/g, ' | ').slice(0, 1000) })),
    })
  }
  if (buttonCode) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: buttonCode }] })
  }
  return post({ to, type: 'template', template: { name, language: { code: getWaConfig().lang }, components } })
}

/** Valida o header X-Hub-Signature-256 do webhook da Meta. */
export function verifyWaSignature(rawBody: string, header: string | null): boolean {
  const { appSecret } = getWaConfig()
  if (!appSecret || !header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const received = header.slice(7)
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  } catch {
    return false
  }
}

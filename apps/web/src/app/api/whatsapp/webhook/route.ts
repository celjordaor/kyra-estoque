/**
 * Webhook do WhatsApp Cloud API (número oficial da Kyra).
 * GET  → verificação da Meta (hub.challenge)
 * POST → mensagens recebidas do gestor; responde via Kyra IA.
 */
import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'
import { getWaConfig, verifyWaSignature } from '@/lib/whatsapp/meta'
import { phoneVariants } from '@/lib/whatsapp/phone'
import { replyNow } from '@/lib/whatsapp/outbox'
import { askKyra } from '@/lib/kyra/ask'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const token = getWaConfig().verifyToken
  if (p.get('hub.mode') === 'subscribe' && token && p.get('hub.verify_token') === token) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!verifyWaSignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new Response('invalid signature', { status: 401 })
  }

  let payload: any
  try { payload = JSON.parse(raw) } catch { return new Response('ok') }

  const admin = createAdminSupabaseClient() as any
  const messages: { id: string; from: string; text: string }[] = []
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const m of change?.value?.messages ?? []) {
        if (m?.id && m?.from) {
          messages.push({
            id: m.id,
            from: m.from,
            text: m.type === 'text' ? String(m.text?.body ?? '') : '',
          })
        }
      }
    }
  }

  for (const m of messages) {
    try {
      // Idempotência: a Meta reenvia o mesmo webhook se demorarmos
      const { error: dupErr } = await admin.from('whatsapp_inbound').insert({
        wa_message_id: m.id, from_phone: m.from, body: m.text.slice(0, 2000),
      })
      if (dupErr) continue

      const { data: profile } = await admin
        .from('profiles')
        .select('id, company_id, full_name')
        .in('phone', phoneVariants(m.from))
        .not('phone_verified_at', 'is', null)
        .limit(1)
        .maybeSingle()

      if (!profile?.company_id) {
        await replyNow(admin, m.from,
          'Não encontrei este número vinculado a uma conta Kyra. Cadastre e confirme seu telefone em Perfil, no Kyra Estoque, e escreva de novo.')
        continue
      }
      await admin.from('whatsapp_inbound').update({ company_id: profile.company_id, profile_id: profile.id }).eq('wa_message_id', m.id)

      if (!m.text.trim()) {
        await replyNow(admin, m.from, 'Por enquanto só consigo ler mensagens de texto. Pode escrever sua pergunta?')
        continue
      }

      // Contexto curto: últimas mensagens deste número na última hora
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: prev } = await admin
        .from('whatsapp_inbound').select('body').eq('from_phone', m.from)
        .gte('received_at', since).neq('wa_message_id', m.id)
        .order('received_at', { ascending: false }).limit(3)
      const history = ((prev ?? []) as { body: string | null }[]).reverse()
        .filter(h => h.body).map(h => ({ role: 'user' as const, content: h.body as string }))

      const result = await askKyra({
        companyId: profile.company_id,
        messages: [...history, { role: 'user', content: m.text }],
      })
      await replyNow(admin, m.from, result.ok ? result.text : result.message)
    } catch (e) {
      console.error('[whatsapp/webhook] erro ao processar mensagem:', e)
    }
  }
  return new Response('ok')
}

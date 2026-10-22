// Fila de envio de WhatsApp (tabela whatsapp_outbox). Quem gera o evento só enfileira;
// o job (/api/cron/tick) envia com repetição em caso de falha.

import { getWaConfig, sendWaTemplate, sendWaText } from './meta'
import { phoneVariants } from './phone'

export const TEMPLATE_AVISO = process.env.WHATSAPP_TEMPLATE_AVISO ?? 'kyra_aviso'
export const TEMPLATE_CODIGO = process.env.WHATSAPP_TEMPLATE_CODIGO ?? 'kyra_codigo'
const MAX_ATTEMPTS = 3
const WINDOW_MS = 24 * 60 * 60 * 1000

export interface EnqueueInput {
  companyId: string | null
  profileId?: string | null
  toPhone: string
  kind: 'alert' | 'report' | 'answer' | 'verification'
  title: string
  detail: string
  automationId?: string | null
  /** Para verificação: código a enviar no modelo de autenticação. */
  code?: string
}

export async function enqueueWhatsApp(admin: any, input: EnqueueInput): Promise<void> {
  const isCode = input.kind === 'verification'
  const { error } = await admin.from('whatsapp_outbox').insert({
    company_id: input.companyId,
    profile_id: input.profileId ?? null,
    to_phone: input.toPhone,
    kind: input.kind,
    template_name: isCode ? TEMPLATE_CODIGO : TEMPLATE_AVISO,
    template_vars: isCode ? [input.code ?? ''] : [input.title, input.detail],
    body: isCode ? input.detail : `*${input.title}*\n${input.detail}`,
    automation_id: input.automationId ?? null,
  })
  if (error) console.error('[whatsapp] enqueue error:', error.message)
}

async function windowOpen(admin: any, phone: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { count } = await admin
    .from('whatsapp_inbound')
    .select('wa_message_id', { count: 'exact', head: true })
    .in('from_phone', phoneVariants(phone))
    .gte('received_at', since)
  return (count ?? 0) > 0
}

/** Envia pendentes. Retorna quantas foram processadas. */
export async function processOutbox(admin: any, limit = 25): Promise<number> {
  const cfg = getWaConfig()
  const { data: rows } = await admin
    .from('whatsapp_outbox')
    .select('id, to_phone, kind, template_name, template_vars, body, attempts')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)

  let processed = 0
  for (const row of (rows ?? []) as any[]) {
    // Reivindica a linha (evita envio duplicado se dois jobs rodarem juntos)
    const { data: claimed } = await admin
      .from('whatsapp_outbox')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id).eq('status', 'pending').eq('attempts', row.attempts)
      .select('id')
    if (!claimed?.length) continue
    processed++

    if (!cfg.configured) {
      console.log(`[whatsapp:simulado] para ${row.to_phone}: ${String(row.body).slice(0, 120)}`)
      await admin.from('whatsapp_outbox').update({ status: 'simulated', last_error: 'WhatsApp não configurado' }).eq('id', row.id)
      continue
    }

    try {
      let messageId: string
      const isCode = row.kind === 'verification'
      if (!isCode && await windowOpen(admin, row.to_phone)) {
        messageId = await sendWaText(row.to_phone, row.body)
      } else if (row.template_name) {
        const vars = (row.template_vars ?? []) as string[]
        messageId = isCode
          ? await sendWaTemplate(row.to_phone, row.template_name, vars, vars[0])
          : await sendWaTemplate(row.to_phone, row.template_name, vars)
      } else {
        throw new Error('Sem modelo aprovado e fora da janela de 24h')
      }
      await admin.from('whatsapp_outbox').update({
        status: 'sent', provider_message_id: messageId, sent_at: new Date().toISOString(), last_error: null,
      }).eq('id', row.id)
    } catch (e) {
      const attempts = row.attempts + 1
      const final = attempts >= MAX_ATTEMPTS
      await admin.from('whatsapp_outbox').update({
        status: final ? 'failed' : 'pending',
        last_error: e instanceof Error ? e.message : String(e),
        scheduled_at: new Date(Date.now() + 2 ** attempts * 60_000).toISOString(),
      }).eq('id', row.id)
    }
  }
  return processed
}

/** Resposta imediata dentro da janela (usuário acabou de escrever): envia direto, sem fila. */
export async function replyNow(admin: any, phone: string, text: string): Promise<void> {
  if (!getWaConfig().configured) {
    console.log(`[whatsapp:simulado] resposta para ${phone}: ${text.slice(0, 120)}`)
    return
  }
  try {
    await sendWaText(phone, text)
  } catch (e) {
    console.error('[whatsapp] replyNow error:', e)
    await admin.from('whatsapp_outbox').insert({
      to_phone: phone, kind: 'answer', body: text, status: 'failed',
      last_error: e instanceof Error ? e.message : String(e),
    })
  }
}

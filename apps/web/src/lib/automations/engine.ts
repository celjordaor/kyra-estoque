// Motor de automações: executa sozinho (agendado ou por evento), sem n8n.
// Ações: e-mail (Resend), notificação no app e WhatsApp (fila outbox).

import { createAdminSupabaseClient } from '@kyra/database'
import { createNotification } from '@/lib/actions/notifications'
import { enqueueWhatsApp, processOutbox } from '@/lib/whatsapp/outbox'
import { TRIGGER_LABELS, ACTION_LABELS } from '@/lib/actions/automations-types'

type Admin = any
interface Automation {
  id: string; company_id: string; automation_type: string; title: string | null
  action_type: string | null; recipient_type: string | null; created_by: string | null
  last_run_at: string | null; run_count: number | null
}
interface Content { subject: string; lines: string[] }
interface Recipient { id: string; email: string | null; phone: string | null; phone_verified_at: string | null; role: string }

export type AutomationEvent =
  | { type: 'sale_happened'; saleId: string; saleNumber: string | null; total: number; customerName?: string | null }
  | { type: 'low_stock'; productId: string; name: string; qty: number; min: number }

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`
const DAY = 24 * 60 * 60 * 1000

async function getRecipients(admin: Admin, a: Automation): Promise<Recipient[]> {
  const { data } = await admin.from('profiles')
    .select('id, email, phone, phone_verified_at, role')
    .eq('company_id', a.company_id).eq('is_active', true)
  const all = (data ?? []) as Recipient[]
  const roles =
    a.recipient_type === 'sales_team' ? ['owner', 'admin', 'manager', 'member']
    : a.recipient_type === 'stock_manager' ? ['owner', 'admin', 'manager']
    : null
  if (roles) return all.filter(p => roles.includes(p.role))
  // 'self': quem criou a automação; se não houver, donos e administradores
  const creator = a.created_by ? all.filter(p => p.id === a.created_by) : []
  return creator.length ? creator : all.filter(p => ['owner', 'admin'].includes(p.role))
}

async function sendEmail(to: string[], content: Content, companyName: string): Promise<string | null> {
  const key = process.env.RESEND_API_KEY
  if (!key) return 'RESEND_API_KEY não configurado'
  if (!to.length) return 'Nenhum destinatário com e-mail'
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 12px;font-size:18px;color:#111827">${content.subject}</h2>
${content.lines.map(l => `<p style="margin:4px 0;font-size:14px;color:#374151">${l}</p>`).join('')}
<p style="margin:20px 0 0;font-size:11px;color:#9ca3af">${companyName} · enviado automaticamente pelo Kyra Estoque.</p></div>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Kyra Estoque <admin@kyraestoque.com.br>', to, subject: content.subject, html }),
  }).catch(() => null)
  return res && res.ok ? null : `Falha ao enviar e-mail (status ${res?.status ?? 'rede'})`
}

/** Executa a ação da automação com o conteúdo já montado e registra a execução. */
async function deliver(admin: Admin, a: Automation, content: Content, triggeredBy: 'schedule' | 'event', payload: object = {}) {
  const started = Date.now()
  const { data: run } = await admin.from('automation_runs').insert({
    company_id: a.company_id, automation_type: a.automation_type, status: 'running',
    triggered_by: triggeredBy === 'event' ? 'schedule' : triggeredBy, payload,
  }).select('id').single()

  const action = a.action_type ?? 'email'
  let error: string | null = null
  const result: Record<string, unknown> = {}
  try {
    const recipients = await getRecipients(admin, a)
    const plain = content.lines.map(l => l.replace(/<[^>]+>/g, ''))
    if (action === 'email') {
      const { data: c } = await admin.from('companies').select('name').eq('id', a.company_id).single()
      const emails = recipients.map(r => r.email).filter(Boolean) as string[]
      error = await sendEmail(emails, content, c?.name ?? 'Sua empresa')
      result.emails = emails.length
    } else if (action === 'notification') {
      await createNotification({
        companyId: a.company_id, type: 'automation', title: content.subject,
        body: plain.join(' · ').slice(0, 500), actionUrl: '/automations', metadata: { automation_id: a.id },
      })
      result.notification = true
    } else if (action === 'whatsapp') {
      const targets = recipients.filter(r => r.phone && r.phone_verified_at)
      for (const r of targets) {
        await enqueueWhatsApp(admin, {
          companyId: a.company_id, profileId: r.id, toPhone: r.phone as string, kind: 'alert',
          title: content.subject, detail: plain.join(' | ').slice(0, 900), automationId: a.id,
        })
      }
      result.whatsapp = targets.length
      if (!targets.length) error = 'Nenhum destinatário com WhatsApp confirmado (Perfil > WhatsApp)'
      else await processOutbox(admin, 25).catch(() => {})
    } else {
      error = `Ação "${ACTION_LABELS[action] ?? action}" ainda não está disponível.`
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  if (run?.id) {
    await admin.from('automation_runs').update({
      status: error ? 'failed' : 'success', error_message: error, result,
      finished_at: new Date().toISOString(), duration_ms: Date.now() - started,
    }).eq('id', run.id)
  }
  if (!error) {
    await admin.from('company_automations').update({
      last_run_at: new Date().toISOString(), run_count: (a.run_count ?? 0) + 1,
    }).eq('id', a.id)
  }
}

/** Anti-repetição: true se pode alertar (e já marca como enviado). */
async function claimDedupe(admin: Admin, companyId: string, key: string, hours: number): Promise<boolean> {
  const { data } = await admin.from('automation_dedupe').select('last_sent_at')
    .eq('company_id', companyId).eq('dedupe_key', key).maybeSingle()
  if (data && Date.now() - new Date(data.last_sent_at).getTime() < hours * 3600_000) return false
  await admin.from('automation_dedupe').upsert({ company_id: companyId, dedupe_key: key, last_sent_at: new Date().toISOString() })
  return true
}

async function loadAutomations(admin: Admin, types: string[], companyId?: string): Promise<Automation[]> {
  let q = admin.from('company_automations')
    .select('id, company_id, automation_type, title, action_type, recipient_type, created_by, last_run_at, run_count')
    .eq('enabled', true).in('automation_type', types)
  if (companyId) q = q.eq('company_id', companyId)
  const { data } = await q
  return (data ?? []) as Automation[]
}

// ── Gatilhos por evento (nunca lançam erro) ───────────────────
export async function fireEvent(companyId: string, event: AutomationEvent): Promise<void> {
  try {
    const admin = createAdminSupabaseClient() as Admin
    const autos = await loadAutomations(admin, [event.type], companyId)
    for (const a of autos) {
      if (event.type === 'sale_happened') {
        await deliver(admin, a, {
          subject: a.title ?? 'Nova venda registrada',
          lines: [`Venda ${event.saleNumber ?? ''} de <strong>${brl(event.total)}</strong>${event.customerName ? ` para ${event.customerName}` : ''}.`],
        }, 'event', { sale_id: event.saleId })
      } else if (await claimDedupe(admin, companyId, `low_stock:${event.productId}`, 24 * 7)) {
        await deliver(admin, a, {
          subject: a.title ?? `Estoque baixo: ${event.name}`,
          lines: [`<strong>${event.name}</strong>: ${event.qty} un em estoque (mínimo ${event.min}).`],
        }, 'event', { product_id: event.productId })
      }
    }
  } catch (e) {
    console.error('[automations] fireEvent error:', e)
  }
}

// ── Agendadas (chamadas pelo cron diário) ─────────────────────
async function buildSummary(admin: Admin, companyId: string, days: number): Promise<string[]> {
  const since = new Date(Date.now() - days * DAY).toISOString()
  const { data: sales } = await admin.from('sales').select('total_amount, margin, status')
    .eq('company_id', companyId).gte('created_at', since).neq('status', 'cancelled')
  const list = (sales ?? []) as { total_amount: number; margin: number | null }[]
  const total = list.reduce((s, x) => s + Number(x.total_amount ?? 0), 0)
  const { data: low } = await admin.from('products').select('name, stock_quantity, min_stock')
    .eq('company_id', companyId).eq('is_active', true).gt('min_stock', 0).limit(500)
  const lowList = ((low ?? []) as { name: string; stock_quantity: number; min_stock: number }[])
    .filter(p => p.stock_quantity <= p.min_stock)
  return [
    `Vendas no período: <strong>${list.length}</strong> (${brl(total)}).`,
    `Produtos com estoque baixo: <strong>${lowList.length}</strong>${lowList.length ? ` — ${lowList.slice(0, 5).map(p => p.name).join(', ')}` : ''}.`,
  ]
}

export async function runScheduledAutomations(): Promise<{ executed: number }> {
  const admin = createAdminSupabaseClient() as Admin
  const now = new Date()
  // Horário de Brasília para decidir "segunda" e "dia 1"
  const br = new Date(now.getTime() - 3 * 3600_000)
  const isMonday = br.getUTCDay() === 1
  const isFirst = br.getUTCDate() === 1
  let executed = 0

  const autos = await loadAutomations(admin, ['weekly', 'weekly_report', 'monthly', 'low_stock', 'no_sales', 'slow_moving', 'delayed_purchase'])
  for (const a of autos) {
    try {
      const sinceLast = a.last_run_at ? now.getTime() - new Date(a.last_run_at).getTime() : Infinity
      const t = a.automation_type

      if (t === 'weekly' || t === 'weekly_report') {
        if (!isMonday || sinceLast < 6 * DAY) continue
        await deliver(admin, a, { subject: a.title ?? 'Resumo semanal', lines: await buildSummary(admin, a.company_id, 7) }, 'schedule')
        executed++
      } else if (t === 'monthly') {
        if (!isFirst || sinceLast < 27 * DAY) continue
        await deliver(admin, a, { subject: a.title ?? 'Resumo mensal', lines: await buildSummary(admin, a.company_id, 30) }, 'schedule')
        executed++
      } else if (t === 'low_stock') {
        const { data } = await admin.from('products').select('id, name, stock_quantity, min_stock')
          .eq('company_id', a.company_id).eq('is_active', true).gt('min_stock', 0).limit(1000)
        const low = ((data ?? []) as { id: string; name: string; stock_quantity: number; min_stock: number }[])
          .filter(p => p.stock_quantity <= p.min_stock)
        const fresh: typeof low = []
        for (const p of low) if (await claimDedupe(admin, a.company_id, `low_stock:${p.id}`, 24 * 7)) fresh.push(p)
        if (!fresh.length) continue
        await deliver(admin, a, {
          subject: a.title ?? 'Estoque baixo',
          lines: fresh.slice(0, 10).map(p => `<strong>${p.name}</strong>: ${p.stock_quantity} un (mínimo ${p.min_stock})`)
            .concat(fresh.length > 10 ? [`…e mais ${fresh.length - 10} produtos.`] : []),
        }, 'schedule')
        executed++
      } else if (t === 'no_sales' || t === 'slow_moving') {
        const days = Number((a as any).config?.days ?? 30)
        const cutoff = new Date(now.getTime() - days * DAY).toISOString()
        const { data: prods } = await admin.from('products').select('id, name, stock_quantity')
          .eq('company_id', a.company_id).eq('is_active', true).gt('stock_quantity', 0).lt('created_at', cutoff).limit(1000)
        const { data: sold } = await admin.from('sale_items').select('product_id')
          .eq('company_id', a.company_id).gte('created_at', cutoff)
        const soldIds = new Set(((sold ?? []) as { product_id: string }[]).map(s => s.product_id))
        const stale = ((prods ?? []) as { id: string; name: string; stock_quantity: number }[]).filter(p => !soldIds.has(p.id))
        const fresh: typeof stale = []
        for (const p of stale) if (await claimDedupe(admin, a.company_id, `no_sales:${p.id}`, 24 * 14)) fresh.push(p)
        if (!fresh.length) continue
        await deliver(admin, a, {
          subject: a.title ?? `Produtos sem vendas há ${days} dias`,
          lines: fresh.slice(0, 10).map(p => `<strong>${p.name}</strong>: ${p.stock_quantity} un paradas`)
            .concat(fresh.length > 10 ? [`…e mais ${fresh.length - 10} produtos.`] : []),
        }, 'schedule')
        executed++
      } else if (t === 'delayed_purchase') {
        const today = br.toISOString().slice(0, 10)
        const { data } = await admin.from('purchase_orders').select('id, expected_delivery_date, total, status')
          .eq('company_id', a.company_id).lt('expected_delivery_date', today)
          .not('status', 'in', '(received,cancelled,draft)').limit(200)
        const late = (data ?? []) as { id: string; expected_delivery_date: string; total: number }[]
        const fresh: typeof late = []
        for (const o of late) if (await claimDedupe(admin, a.company_id, `po_late:${o.id}`, 24 * 7)) fresh.push(o)
        if (!fresh.length) continue
        await deliver(admin, a, {
          subject: a.title ?? 'Compras atrasadas',
          lines: fresh.slice(0, 10).map(o => `Pedido previsto para ${o.expected_delivery_date.split('-').reverse().join('/')} (${brl(Number(o.total ?? 0))})`),
        }, 'schedule')
        executed++
      }
    } catch (e) {
      console.error('[automations] scheduled error:', a.id, e)
    }
  }
  void TRIGGER_LABELS
  return { executed }
}

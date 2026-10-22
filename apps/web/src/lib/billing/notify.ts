// Avisos de cobrança ao tenant: notificação no app + e-mail para donos/admins.

import type { BillingNotice } from '@kyra/business-rules'
import { createNotification } from '@/lib/actions/notifications'

export async function notifyBilling(admin: any, companyId: string, notice: BillingNotice): Promise<void> {
  await createNotification({
    companyId, type: 'payment_event', title: notice.title, body: notice.body,
    actionUrl: '/subscribe', metadata: { kind: notice.kind },
  })
  const key = process.env.RESEND_API_KEY
  if (!key) return
  try {
    const { data } = await admin.from('profiles').select('email').eq('company_id', companyId)
      .eq('is_active', true).in('role', ['owner', 'admin'])
    const to = ((data ?? []) as { email: string | null }[]).map(p => p.email).filter(Boolean) as string[]
    if (!to.length) return
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kyraestoque.com.br').replace(/\/$/, '')
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kyra Estoque <admin@kyraestoque.com.br>', to, subject: notice.title,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 12px;font-size:18px">${notice.title}</h2>
<p style="font-size:14px;color:#374151">${notice.body}</p>
<p style="margin-top:20px"><a href="${base}/subscribe" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px">Ver minha assinatura</a></p></div>`,
      }),
    })
  } catch (e) {
    console.error('[billing/notify] email error:', e)
  }
}

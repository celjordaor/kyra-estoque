/**
 * GET /api/cron/tick — job periódico (Vercel Cron).
 * Executa automações agendadas e envia a fila de WhatsApp.
 * Protegido por CRON_SECRET (a Vercel envia "Authorization: Bearer <CRON_SECRET>").
 */
import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'
import { runScheduledAutomations } from '@/lib/automations/engine'
import { processOutbox } from '@/lib/whatsapp/outbox'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 })
  }
  const admin = createAdminSupabaseClient() as any
  const { executed } = await runScheduledAutomations()
  const sent = await processOutbox(admin, 50)
  return Response.json({ ok: true, automations: executed, outbox: sent })
}

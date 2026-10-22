/**
 * GET /api/cron/tick — job periódico (Vercel Cron).
 * Executa automações agendadas e envia a fila de WhatsApp.
 * Protegido por CRON_SECRET (a Vercel envia "Authorization: Bearer <CRON_SECRET>").
 */
import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'
import { runScheduledAutomations } from '@/lib/automations/engine'
import { processOutbox } from '@/lib/whatsapp/outbox'
import { runBillingMaintenance } from '@/lib/billing/subscription-sync'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 })
  }
  const admin = createAdminSupabaseClient() as any
  // Cada etapa isolada: uma falha não impede as demais (cobrança primeiro)
  const run = async <T,>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> => {
    try { return await fn() } catch (e) {
      console.error(`[cron/tick] ${name}:`, e)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }
  const billing = await run('billing', () => runBillingMaintenance(admin))
  const automations = await run('automations', () => runScheduledAutomations())
  const outbox = await run('outbox', () => processOutbox(admin, 50))
  return Response.json({ ok: true, billing, automations, outbox })
}

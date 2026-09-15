/**
 * POST /api/kyra/callback — n8n automation run callback
 *
 * n8n chama este endpoint ao finalizar uma execução de automação.
 * Usa KYRA_WEBHOOK_SECRET para autenticação.
 */
import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'

export async function POST(req: NextRequest) {
  try {
    // Verificar segredo compartilhado
    const secret = req.headers.get('x-kyra-secret')
    const expectedSecret = process.env.KYRA_WEBHOOK_SECRET

    if (!expectedSecret || secret !== expectedSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { run_id, status, result, error_message } = body

    if (!run_id || !status) {
      return Response.json({ error: 'run_id e status são obrigatórios' }, { status: 400 })
    }

    const validStatuses = ['success', 'failed', 'partial']
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Status inválido' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { error } = await admin.rpc('complete_automation_run', {
      p_run_id: run_id,
      p_status: status,
      p_result: result ?? null,
      p_error: error_message ?? null,
    })

    if (error) {
      console.error('[kyra/callback] RPC error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[kyra/callback] Error:', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}

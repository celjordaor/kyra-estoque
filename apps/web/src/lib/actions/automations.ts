'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { getLimit } from '@kyra/business-rules'
import {
  type AutomationTrigger, type AutomationAction, type AutomationRecipient,
  type CompanyAutomation, type AutomationRun, type AutomationLog,
  ACTION_LABELS, TRIGGER_LABELS, RECIPIENT_LABELS,
} from './automations-types'

// ─────────────────────────────────────────────────────────────
async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any)
    .from('profiles')
    .select('company_id, email')
    .eq('id', user.id)
    .single()
  const profile = profileData as { company_id: string | null; email: string | null } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id as string, userEmail: profile.email as string }
}

// ── Get all automations ───────────────────────────────────────
export async function getCompanyAutomations(): Promise<CompanyAutomation[]> {
  const { supabase, companyId } = await getServerContext()
  const { data, error } = await (supabase as any)
    .from('company_automations')
    .select('id, automation_type, title, action_type, recipient_type, enabled, config, n8n_workflow_id, n8n_webhook_url, last_run_at, run_count, updated_at')
    .eq('company_id', companyId)
    .order('created_at')
  if (error) throw new Error((error as any).message ?? String(error))
  return (data ?? []) as CompanyAutomation[]
}

// ── Create or update automation via wizard ────────────────────
export async function createAutomation(
  trigger: AutomationTrigger,
  action: AutomationAction,
  recipient: AutomationRecipient,
  title: string,
): Promise<{ success: boolean; error?: string; upgradeRequired?: boolean; limit?: number | null }> {
  try {
    const { supabase, companyId } = await getServerContext()

    const { count: currentEnabled } = await (supabase as any)
      .from('company_automations')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('enabled', true)
      .neq('automation_type', trigger)

    const autoLimit = await getLimit(companyId, 'automations.max')
    if (autoLimit !== null && (currentEnabled ?? 0) >= autoLimit) {
      return { success: false, error: 'LIMIT_REACHED', upgradeRequired: true, limit: autoLimit }
    }

    const { error } = await (supabase as any)
      .from('company_automations')
      .upsert(
        { company_id: companyId, automation_type: trigger, title, action_type: action, recipient_type: recipient, enabled: true },
        { onConflict: 'company_id,automation_type' }
      )

    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/automations')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Toggle enable/disable ─────────────────────────────────────
export async function toggleAutomation(
  automationType: AutomationTrigger,
  enabled: boolean,
): Promise<{ success: boolean; error?: string; upgradeRequired?: boolean; limit?: number | null }> {
  try {
    const { supabase, companyId } = await getServerContext()

    if (enabled) {
      const { count: currentEnabled } = await (supabase as any)
        .from('company_automations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('enabled', true)
        .neq('automation_type', automationType)

      const autoLimit = await getLimit(companyId, 'automations.max')
      if (autoLimit !== null && (currentEnabled ?? 0) >= autoLimit) {
        return { success: false, error: 'LIMIT_REACHED', upgradeRequired: true, limit: autoLimit }
      }
    }

    const { error } = await (supabase as any)
      .from('company_automations')
      .upsert(
        { company_id: companyId, automation_type: automationType, enabled },
        { onConflict: 'company_id,automation_type' }
      )

    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/automations')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Delete automation ─────────────────────────────────────────
export async function deleteAutomation(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { error } = await (supabase as any)
      .from('company_automations')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/automations')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Email HTML builder ────────────────────────────────────────
function buildEmailHtml(opts: {
  companyName: string; triggerLabel: string; actionLabel: string
  recipientLabel: string; bodyLines: string[]; footerNote?: string
}): string {
  const lines = opts.bodyLines.map(l => `<p style="margin:0 0 8px;color:#374151;font-size:14px">${l}</p>`).join('')
  return `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
  <div style="background:#0d9488;border-radius:12px 12px 0 0;padding:20px 24px;margin:-24px -24px 24px">
    <p style="margin:0;color:rgba(255,255,255,.8);font-size:12px;text-transform:uppercase;letter-spacing:.05em">Kyra Estoque · Automação</p>
    <h2 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700">${opts.triggerLabel}</h2>
  </div>
  ${lines}
  <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
    <p style="margin:0;font-size:12px;color:#6b7280"><strong>Empresa:</strong> ${opts.companyName}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#6b7280"><strong>Para:</strong> ${opts.recipientLabel}</p>
  </div>
  ${opts.footerNote ? `<p style="margin:16px 0 0;font-size:11px;color:#9ca3af">${opts.footerNote}</p>` : ''}
  <p style="margin:24px 0 0;font-size:11px;color:#d1d5db">Este e-mail foi enviado automaticamente pela plataforma Kyra Estoque.</p>
</div>`
}

// ── Trigger automation (executa via Resend, sem n8n) ──────────
export async function triggerAutomation(
  automationType: AutomationTrigger,
): Promise<{ success: boolean; error?: string; runId?: string }> {
  try {
    const { supabase, admin, companyId, userEmail } = await getServerContext()

    const { data: automation, error: fetchErr } = await (supabase as any)
      .from('company_automations')
      .select('id, action_type, recipient_type, title, enabled, run_count')
      .eq('company_id', companyId)
      .eq('automation_type', automationType)
      .single()

    if (fetchErr || !automation) return { success: false, error: 'Automação não encontrada' }
    if (!automation.enabled) return { success: false, error: 'Automação está desabilitada' }

    const actionType = (automation.action_type ?? 'email') as AutomationAction
    if (actionType !== 'email') {
      return { success: false, error: `Ação "${ACTION_LABELS[actionType] ?? actionType}" requer integração adicional (em breve).` }
    }

    const { data: run, error: runErr } = await (admin as any)
      .from('automation_runs')
      .insert({ company_id: companyId, automation_type: automationType, status: 'running', triggered_by: 'manual', payload: {} })
      .select('id').single()

    if (runErr || !run) return { success: false, error: 'Falha ao registrar execução' }

    const { data: company } = await (admin as any).from('companies').select('name').eq('id', companyId).single()
    const companyName = company?.name ?? 'Sua empresa'
    const recipientLabel = RECIPIENT_LABELS[automation.recipient_type as string] ?? 'Você'
    const triggerLabel = TRIGGER_LABELS[automationType] ?? automationType

    let subject = (automation.title as string | null) ?? triggerLabel
    let bodyLines: string[] = []
    let footerNote: string | undefined

    if (automationType === 'low_stock') {
      const { data: products } = await (supabase as any)
        .from('products').select('name, current_stock, min_stock')
        .eq('company_id', companyId).filter('current_stock', 'lte', 'min_stock').limit(10)
      const list = (products ?? []).map((p: { name: string; current_stock: number; min_stock: number }) =>
        `• <strong>${p.name}</strong>: ${p.current_stock} un (mínimo: ${p.min_stock})`).join('<br>')
      subject = '⚠️ Alerta: produtos com estoque baixo'
      bodyLines = ['Os seguintes produtos atingiram o estoque mínimo:', list || '(nenhum produto identificado)', 'Acesse o Kyra Estoque para criar uma ordem de compra.']
    } else if (automationType === 'no_sales' || automationType === 'slow_moving') {
      subject = '📦 Alerta: produtos sem movimentação'
      bodyLines = ['Identificamos produtos sem vendas há mais de 30 dias.', 'Acesse o relatório de estoque parado no Kyra para ver a lista completa e tomar ação.']
      footerNote = 'Dica: produtos parados representam capital imobilizado. Considere promoções ou revisão de preço.'
    } else if (automationType === 'delayed_purchase') {
      subject = '🕐 Alerta: compras em atraso'
      bodyLines = ['Há ordens de compra com prazo de entrega vencido.', 'Acesse o módulo de compras no Kyra para verificar e atualizar o status.']
    } else if (automationType === 'sale_happened') {
      subject = '✅ Nova venda registrada'
      bodyLines = ['Uma nova venda foi registrada no Kyra Estoque.', 'Acesse o módulo de vendas para ver os detalhes.']
    } else if (automationType === 'weekly' || automationType === 'weekly_report') {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      const { data: sales } = await (supabase as any).from('sales').select('total_amount').eq('company_id', companyId).gte('created_at', weekAgo.toISOString())
      const totalSales = (sales ?? []).length
      const totalRevenue = (sales ?? []).reduce((s: number, r: { total_amount: number }) => s + (r.total_amount ?? 0), 0)
      subject = '📊 Relatório semanal — Kyra Estoque'
      bodyLines = ['Aqui está o resumo da semana:', `• <strong>Vendas realizadas:</strong> ${totalSales}`, `• <strong>Receita total:</strong> R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Acesse o Kyra para ver o relatório completo com todos os detalhes.']
    } else if (automationType === 'monthly') {
      subject = '📈 Relatório mensal — Kyra Estoque'
      bodyLines = ['Seu relatório mensal está disponível no Kyra Estoque.', 'Acesse o módulo de relatórios para ver o desempenho completo do mês.']
    } else {
      subject = (automation.title as string | null) ?? `Automação: ${triggerLabel}`
      bodyLines = [`A automação "${triggerLabel}" foi disparada.`]
    }

    const html = buildEmailHtml({ companyName, triggerLabel, actionLabel: ACTION_LABELS[actionType] ?? actionType, recipientLabel, bodyLines, footerNote })

    const resendKey = process.env.RESEND_API_KEY
    let emailError: string | null = null

    if (resendKey && userEmail) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Kyra Estoque <automacoes@kyraestoque.com.br>', to: [userEmail], subject, html }),
      }).catch(err => { console.error('[triggerAutomation] Resend error:', err); return null })

      if (!res || !res.ok) {
        const errBody = await res?.json().catch(() => ({}))
        console.error('[triggerAutomation] Resend failed:', res?.status, errBody)
        emailError = `Falha ao enviar e-mail (status ${res?.status ?? 'unknown'})`
      }
    } else {
      emailError = 'RESEND_API_KEY não configurado'
    }

    await (admin as any).from('automation_runs').update({
      status: emailError ? 'failed' : 'success',
      error_message: emailError,
      finished_at: new Date().toISOString(),
      result: emailError ? null : { email_sent_to: userEmail },
    }).eq('id', run.id)

    if (emailError) return { success: false, error: emailError }

    await (supabase as any).from('company_automations').update({
      last_run_at: new Date().toISOString(),
      run_count: ((automation.run_count as number) ?? 0) + 1,
    }).eq('id', automation.id)

    revalidatePath('/automations')
    return { success: true, runId: run.id }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Stats ─────────────────────────────────────────────────────
export async function getAutomationStats(): Promise<{ activeCount: number; runsToday: number }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { count: activeCount } = await (supabase as any)
      .from('company_automations').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('enabled', true)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { count: runsToday } = await (supabase as any)
      .from('automation_runs').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).gte('started_at', todayStart.toISOString())
    return { activeCount: activeCount ?? 0, runsToday: runsToday ?? 0 }
  } catch { return { activeCount: 0, runsToday: 0 } }
}

// ── Get recent automation runs ────────────────────────────────
export async function getAutomationRuns(limit = 20): Promise<AutomationRun[]> {
  const { supabase, companyId } = await getServerContext()
  const { data, error } = await (supabase as any)
    .from('automation_runs')
    .select('id, automation_type, status, triggered_by, error_message, payload, started_at, finished_at, duration_ms')
    .eq('company_id', companyId).order('started_at', { ascending: false }).limit(limit)
  if (error) return []
  return (data ?? []) as AutomationRun[]
}

// ── Get recent automation logs (legacy compat) ────────────────
export async function getAutomationLogs(limit = 20): Promise<AutomationLog[]> {
  const { supabase, companyId } = await getServerContext()
  const { data, error } = await (supabase as any)
    .from('automation_logs')
    .select('id, workflow_name, trigger_type, status, error_message, started_at, finished_at, duration_ms')
    .eq('company_id', companyId).order('started_at', { ascending: false }).limit(limit)
  if (error) return []
  return (data ?? []) as AutomationLog[]
}

// ── Legacy: updateAutomationN8nConfig ─────────────────────────
export async function updateAutomationN8nConfig(
  automationType: AutomationTrigger, n8nWorkflowId: string, n8nWebhookUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { error } = await (supabase as any).from('company_automations').upsert(
      { company_id: companyId, automation_type: automationType, n8n_workflow_id: n8nWorkflowId, n8n_webhook_url: n8nWebhookUrl },
      { onConflict: 'company_id,automation_type' }
    )
    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/automations')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Plan gate: check if automations are allowed at all ────────
export async function getAutomationLimit(): Promise<{ allowed: boolean; max: number | null }> {
  try {
    const { companyId } = await getServerContext()
    const max = await getLimit(companyId, 'automations.max')
    // max === 0 → bloqueado; null → ilimitado; number → limite
    return { allowed: max === null || max > 0, max }
  } catch {
    return { allowed: true, max: null }
  }
}
